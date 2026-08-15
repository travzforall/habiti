import { FITNESS } from './fitness';
import { HEALTH } from './health';
import { LIFE } from './life';
import { MIND } from './mind';
import { WORK } from './work';
import { LibraryCategory, LibraryHabit, LibrarySection, LibrarySubcategory } from './types';
import { TrackingSpec, trackingFor } from './tracking';
import { sensitiveCategoryOf } from '../sensitive-habits';

export * from './types';
export * from './tracking';

/**
 * The whole library.
 *
 * Order matters — it is the order the browse UI shows, so the categories most
 * people want are first.
 */
export const HABIT_LIBRARY: LibrarySection[] = [FITNESS, HEALTH, MIND, WORK, LIFE];

export const LIBRARY_CATEGORIES: LibraryCategory[] = HABIT_LIBRARY.map(s => s.category);

export const ALL_LIBRARY_HABITS: LibraryHabit[] = HABIT_LIBRARY.flatMap(s => s.habits);

const BY_ID = new Map(ALL_LIBRARY_HABITS.map(h => [h.id, h]));

/**
 * Looks a habit up by its stable slug.
 *
 * Packs and challenges reference habits by id, so an unknown id means a typo —
 * `pick()` throws rather than silently producing a shorter pack that nobody
 * notices until a user opens it.
 */
export function libraryHabit(id: string): LibraryHabit {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown library habit: "${id}"`);
  return found;
}

/** Several at once, in the order given. */
export function pick(...ids: string[]): LibraryHabit[] {
  return ids.map(libraryHabit);
}

export function categoryById(id: string): LibraryCategory | undefined {
  return LIBRARY_CATEGORIES.find(c => c.id === id);
}

export function subcategoryById(
  categoryId: string,
  subcategoryId: string
): LibrarySubcategory | undefined {
  return categoryById(categoryId)?.subcategories.find(s => s.id === subcategoryId);
}

export function habitsIn(categoryId: string, subcategoryId?: string): LibraryHabit[] {
  return ALL_LIBRARY_HABITS.filter(
    h => h.categoryId === categoryId && (!subcategoryId || h.subcategoryId === subcategoryId)
  );
}

/** Free-text search across name, description and tags. */
export function searchLibrary(term: string): LibraryHabit[] {
  const needle = term.trim().toLowerCase();
  if (!needle) return [];

  return ALL_LIBRARY_HABITS.filter(
    h =>
      h.name.toLowerCase().includes(needle) ||
      h.description.toLowerCase().includes(needle) ||
      (h.tags ?? []).some(tag => tag.includes(needle))
  );
}

/** True when the habit has enough guidance to be worth opening a detail view. */
export function hasGuidance(h: LibraryHabit): boolean {
  const g = h.guidance;
  if (!g) return false;
  return !!(
    g.summary ||
    g.steps?.length ||
    g.tips?.length ||
    g.mistakes?.length ||
    g.safety ||
    g.equipment?.length ||
    g.muscles?.length
  );
}

const BY_NAME = new Map(ALL_LIBRARY_HABITS.map(h => [h.name.trim().toLowerCase(), h]));

/**
 * The library entry behind a user's habit, matched by name.
 *
 * Habits are stored as ordinary rows with no link back to the library, so name
 * is the only join available. It is the same key the duplicate check uses, so
 * the two agree by construction.
 */
export function libraryHabitByName(name: string): LibraryHabit | undefined {
  return BY_NAME.get(name.trim().toLowerCase());
}

/**
 * The tracking spec for one of the user's habits.
 *
 * Kind, unit and direction come from the library; the TARGET can be overridden
 * per user, because 07:00 is a sensible default wake time and a terrible
 * universal rule. Baserow's `target_value` is a plain number column, so the
 * override persists without needing new select options.
 */
export function specForHabit(habit: {
  name?: string;
  unit?: string;
  goal?: number;
  targetValue?: number;
  trackingUnit?: string;
  type?: 'good' | 'bad';
}): TrackingSpec {
  const entry = habit.name ? libraryHabitByName(habit.name) : undefined;

  const base = entry
    ? trackingFor(entry)
    : trackingFor({
        unit: habit.unit ?? habit.trackingUnit,
        goal: habit.goal,
        type: habit.type
      });

  if (habit.targetValue === undefined || habit.targetValue === null) return base;
  return { ...base, target: habit.targetValue };
}

/** The shape HabitsService.addHabits() expects. */
/**
 * Library category -> the habit category slug the rest of the app uses.
 *
 * These two vocabularies were built independently and only overlap on
 * 'health'. The library organises by area of life (fitness, health, mind,
 * work, life); habits.ts's CATEGORY_SLUG_TO_NAME organises by the Baserow
 * category rows (health, productivity, learning, mindfulness, social,
 * creative, finance, other).
 *
 * Without this map, `categoryRowIds().get('fitness')` returns undefined and
 * persistNewHabits() omits category_id entirely — so every habit added from a
 * template pack landed uncategorised in Baserow, which is also what the
 * grouped view on the habits page reads.
 *
 * Subcategory wins where it is more specific than its parent: 'work/learning'
 * is Learning, not Productivity, and 'life/money' is Finance, not Social.
 */
const SUBCATEGORY_TO_APP_SLUG: Record<string, string> = {
  'work/learning': 'learning',
  'work/creative': 'creative',
  'life/money': 'finance',
  'life/home': 'other',
  'life/planet': 'other'
};

const CATEGORY_TO_APP_SLUG: Record<string, string> = {
  fitness: 'health', // the app's 'health' slug is the "Health & Fitness" row
  health: 'health',
  mind: 'mindfulness',
  work: 'productivity',
  life: 'social'
};

/** The app-side category slug for a library habit. */
export function appCategorySlug(h: LibraryHabit): string {
  return (
    SUBCATEGORY_TO_APP_SLUG[`${h.categoryId}/${h.subcategoryId}`] ??
    CATEGORY_TO_APP_SLUG[h.categoryId] ??
    'other'
  );
}

export function toHabitDraft(h: LibraryHabit) {
  const spec = trackingFor(h);
  return {
    name: h.name,
    type: h.type,
    difficulty: h.difficulty,
    points: h.points,
    goal: h.goal,
    category: appCategorySlug(h),
    icon: h.icon,
    description: h.description,
    // Carried onto the habit so the target survives without a library lookup,
    // and so the user can change it later.
    trackingUnit: spec.unit,
    targetValue: spec.target,
    /**
     * Whether this habit reveals Article 9 data, and which kind.
     *
     * TRAVELS WITH THE DRAFT, and that is the whole design. HabitsService has
     * to refuse an unconsented sensitive habit, but it deliberately does not
     * import the habit library — it is constructed eagerly by the nav bars, and
     * importing the library there is what put ~137 kB into the initial bundle
     * once before. Classifying here and carrying the answer keeps the
     * enforcement in the service and the catalogue out of the bundle.
     *
     * NOT persisted onto the Habit; it is derived, and re-deriving it is always
     * more truthful than trusting a copy stored months ago.
     */
    sensitiveCategory: sensitiveCategoryOf(h)
  };
}
