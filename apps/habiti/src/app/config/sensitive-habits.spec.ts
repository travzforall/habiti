import { ALL_LIBRARY_HABITS, HABIT_LIBRARY, pick } from './habit-library';
import { SENSITIVE_CATEGORY_COPY, isSensitive, sensitiveCategoriesIn, sensitiveCategoryOf } from './sensitive-habits';
import { SensitiveCategory } from '../models/consent.models';

/**
 * The highest-value test in the legal work.
 *
 * The Article 9 gate is only as good as the classifier behind it, and the
 * classifier fails SILENTLY: a new sensitive habit that nobody classified is
 * simply collected without consent, and nothing anywhere goes red. So the
 * habits that must be caught are named here explicitly. Adding
 * `take-insulin` next to `take-medication` without a tag now fails a build.
 */
describe('sensitive habit classification', () => {
  /** Named because getting any of these wrong is a real problem, not a style issue. */
  const MUST_BE_SENSITIVE: { id: string; category: SensitiveCategory }[] = [
    { id: 'take-medication', category: 'health' },
    { id: 'doctor-checkup', category: 'health' },
    { id: 'no-alcohol', category: 'sobriety' },
    { id: 'no-smoking', category: 'sobriety' },
    { id: 'therapy-session', category: 'mental_health' },
    { id: 'support-group', category: 'sobriety' },
    { id: 'note-the-trigger', category: 'sobriety' },
    { id: 'pray', category: 'religion' },
    { id: 'read-scripture', category: 'religion' },
    { id: 'attend-service', category: 'religion' }
  ];

  /**
   * Equally important in the other direction. A classifier that catches
   * everything trains users to click through the prompt that matters.
   */
  const MUST_NOT_BE_SENSITIVE = [
    'water-8',
    'no-sugary-drinks',
    'sleep-7-hours',
    'walk-10k',
    // 'meditate-10' stood here until the meditation habits were removed from
    // the library. Box breathing takes its place as the ordinary, non-revealing
    // wellbeing habit.
    'box-breathing',
    'journal'
  ];

  it('classifies every habit that reveals a condition, treatment or belief', () => {
    for (const { id, category } of MUST_BE_SENSITIVE) {
      const [habit] = pick(id);
      expect(habit).withContext(`${id} is missing from the library`).toBeDefined();
      expect(sensitiveCategoryOf(habit))
        .withContext(
          `${id} must be classified as ${category}. If this habit changed, fix its ` +
            `tags or subcategory — do not relax the classifier.`
        )
        .toBe(category);
    }
  });

  it('leaves ordinary habits alone', () => {
    for (const id of MUST_NOT_BE_SENSITIVE) {
      const [habit] = pick(id);
      expect(isSensitive(habit))
        .withContext(`${id} should not require Article 9 consent — that is consent fatigue`)
        .toBe(false);
    }
  });

  it('catches anything tagged sobriety, wherever it lives', () => {
    // The tag is applied across two library files. A habit carrying it must be
    // caught by the tag rule alone, not by which section it happens to be in.
    const tagged = ALL_LIBRARY_HABITS.filter(h => (h.tags ?? []).includes('sobriety'));
    expect(tagged.length).withContext('no habits tagged sobriety — has the tag been renamed?').toBeGreaterThan(0);
    for (const habit of tagged) {
      expect(sensitiveCategoryOf(habit)).withContext(habit.id).toBe('sobriety');
    }
  });

  it('catches every habit in the faith and emotional-health subcategories', () => {
    // Belonging to one of these is enough on its own, which is what stops a new
    // habit dropped into the section from being missed.
    const inSection = ALL_LIBRARY_HABITS.filter(
      h => h.subcategoryId === 'faith' || h.subcategoryId === 'emotional'
    );
    expect(inSection.length).toBeGreaterThan(0);
    for (const habit of inSection) {
      expect(isSensitive(habit)).withContext(`${habit.id} (${habit.subcategoryId})`).toBe(true);
    }
  });

  it('prefers the tag when a habit matches both rules', () => {
    // support-group sits in the `emotional` subcategory AND carries the
    // `sobriety` tag, so both rules fire. Asking for recovery consent is more
    // honest than asking for mental-health consent when the habit is plainly
    // about staying clean.
    const [habit] = pick('support-group');
    expect(habit.subcategoryId).withContext('the both-rules example moved').toBe('emotional');
    expect(habit.tags).toContain('sobriety');
    expect(sensitiveCategoryOf(habit)).toBe('sobriety');
  });

  it('classifies a tagged habit wherever it sits', () => {
    // note-the-trigger is in `journaling`, an ordinary subcategory, and is only
    // caught because of its tag. That is the case a subcategory-only rule would
    // miss entirely.
    const [habit] = pick('note-the-trigger');
    expect(habit.subcategoryId).toBe('journaling');
    expect(sensitiveCategoryOf(habit)).toBe('sobriety');
  });

  it('reports the distinct categories in a set of habits', () => {
    const habits = pick('no-alcohol', 'pray', 'read-scripture', 'water-8');
    expect(sensitiveCategoriesIn(habits).sort()).toEqual(['religion', 'sobriety']);
  });

  it('needs no consent for a set of ordinary habits', () => {
    expect(sensitiveCategoriesIn(pick('water-8', 'walk-10k'))).toEqual([]);
  });

  it('has user-facing copy for every category it can return', () => {
    // A category with no copy would render an empty consent prompt, which is
    // not consent at all.
    const categories = new Set(
      ALL_LIBRARY_HABITS.map(sensitiveCategoryOf).filter((c): c is SensitiveCategory => !!c)
    );
    expect(categories.size).withContext('the library has no sensitive habits at all?').toBeGreaterThan(0);
    for (const category of categories) {
      const copy = SENSITIVE_CATEGORY_COPY[category];
      expect(copy).withContext(`no copy for ${category}`).toBeDefined();
      expect(copy.label.trim()).not.toBe('');
      expect(copy.stores.trim()).not.toBe('');
    }
  });

  it('classifies a minority of the library, not most of it', () => {
    // A sanity bound in both directions. If this ever catches most of the
    // library, the rules have gone wrong and every user will be prompted on
    // their first habit.
    const all = ALL_LIBRARY_HABITS;
    const sensitive = all.filter(isSensitive);
    expect(sensitive.length).toBeGreaterThan(5);
    expect(sensitive.length).toBeLessThan(all.length / 3);
  });

  it('covers every category the library actually contains', () => {
    // Guards the reverse mistake: a rule removed, leaving a whole category
    // uncaught while the named habits above still pass.
    const found = new Set(ALL_LIBRARY_HABITS.map(sensitiveCategoryOf).filter(Boolean));
    expect([...found].sort()).toEqual(['health', 'mental_health', 'religion', 'sobriety']);
  });

  it('the library is non-empty, so none of the above passes vacuously', () => {
    expect(HABIT_LIBRARY.length).toBeGreaterThan(0);
    expect(ALL_LIBRARY_HABITS.length).toBeGreaterThan(100);
  });
});
