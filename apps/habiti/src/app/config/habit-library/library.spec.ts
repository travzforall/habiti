import {
  ALL_LIBRARY_HABITS,
  HABIT_LIBRARY,
  LIBRARY_CATEGORIES,
  appCategorySlug,
  habitsIn,
  hasGuidance,
  libraryHabit,
  pick,
  searchLibrary,
  toHabitDraft
} from './index';
import { HABIT_TEMPLATE_PACKS, PACK_GROUPS, packsInGroup } from '../habit-template-packs';
import { CHALLENGE_CATALOGUE } from '../challenge-catalogue.seed';

/**
 * The library is data that reaches the database and the screen unchanged.
 *
 * A bad `type` or `difficulty` is rejected by Baserow at the moment a user
 * clicks Add; a broken id in a pack silently produces a shorter pack. Neither
 * shows up in a typecheck, so both are asserted here.
 */
describe('habit library', () => {
  it('has habits in every category and subcategory', () => {
    expect(HABIT_LIBRARY.length).toBeGreaterThan(0);

    for (const section of HABIT_LIBRARY) {
      expect(section.habits.length)
        .withContext(`${section.category.name} is empty`)
        .toBeGreaterThan(0);

      for (const sub of section.category.subcategories) {
        expect(habitsIn(section.category.id, sub.id).length)
          .withContext(`${section.category.name} / ${sub.name} has no habits`)
          .toBeGreaterThan(0);
      }
    }
  });

  it('has globally unique habit ids', () => {
    // Packs and challenges reference these; a collision would silently
    // redirect one to the other.
    const ids = ALL_LIBRARY_HABITS.map(h => h.id);
    const seen = new Set<string>();
    const dupes = ids.filter(id => (seen.has(id) ? true : (seen.add(id), false)));
    expect(dupes).toEqual([]);
  });

  it('points every habit at a real category and subcategory', () => {
    for (const habit of ALL_LIBRARY_HABITS) {
      const section = HABIT_LIBRARY.find(s => s.category.id === habit.categoryId);
      expect(section).withContext(`${habit.id} has unknown category`).toBeTruthy();
      expect(section!.category.subcategories.some(s => s.id === habit.subcategoryId))
        .withContext(`${habit.id} has unknown subcategory "${habit.subcategoryId}"`)
        .toBe(true);
    }
  });

  it('uses only values the Baserow single-selects accept', () => {
    for (const habit of ALL_LIBRARY_HABITS) {
      expect(['good', 'bad']).withContext(habit.id).toContain(habit.type);
      expect(['easy', 'medium', 'hard']).withContext(habit.id).toContain(habit.difficulty);
    }
  });

  it('uses point values on the 5-point scale', () => {
    // The points selector offers multiples of 5. Off-scale values used to
    // render the select blank, which then reported no value at all.
    for (const habit of ALL_LIBRARY_HABITS) {
      expect(habit.points % 5)
        .withContext(`${habit.id} is worth ${habit.points}`)
        .toBe(0);
      expect(habit.points).withContext(habit.id).toBeGreaterThan(0);
    }
  });

  it('gives every habit a name, icon, description and positive goal', () => {
    for (const habit of ALL_LIBRARY_HABITS) {
      expect(habit.name.trim().length).withContext(habit.id).toBeGreaterThan(0);
      expect(habit.icon.trim().length).withContext(habit.id).toBeGreaterThan(0);
      expect(habit.description.trim().length).withContext(habit.id).toBeGreaterThan(0);
      expect(habit.goal).withContext(habit.id).toBeGreaterThan(0);
    }
  });

  it('has no duplicate habit names, which would confuse the already-added check', () => {
    // Duplicate detection is by name, so two library entries sharing a name
    // would each mark the other as already added.
    const names = ALL_LIBRARY_HABITS.map(h => h.name.trim().toLowerCase());
    const seen = new Set<string>();
    const dupes = names.filter(n => (seen.has(n) ? true : (seen.add(n), false)));
    expect(dupes).toEqual([]);
  });

  describe('lookup', () => {
    it('finds a habit by id', () => {
      expect(libraryHabit('deadlift').name).toBe('Deadlift');
    });

    it('throws on an unknown id rather than returning undefined', () => {
      // A silent miss would produce a pack one habit short that nobody notices.
      expect(() => libraryHabit('not-a-real-habit')).toThrowError(/Unknown library habit/);
    });

    it('picks several in order', () => {
      expect(pick('plank', 'deadlift').map(h => h.id)).toEqual(['plank', 'deadlift']);
    });
  });

  describe('search', () => {
    it('matches on name, description and tags', () => {
      expect(searchLibrary('deadlift').length).toBeGreaterThan(0);
      expect(searchLibrary('barbell').length).toBeGreaterThan(0);
      expect(searchLibrary('DEADLIFT').length).toBeGreaterThan(0);
    });

    it('returns nothing for an empty term', () => {
      expect(searchLibrary('   ')).toEqual([]);
    });
  });

  describe('guidance', () => {
    it('reports guidance only when there is something to show', () => {
      expect(hasGuidance(libraryHabit('deadlift'))).toBe(true);
      expect(hasGuidance({ ...libraryHabit('deadlift'), guidance: undefined })).toBe(false);
      expect(hasGuidance({ ...libraryHabit('deadlift'), guidance: {} })).toBe(false);
    });

    it('gives the heavy compound lifts real instructions and a safety note', () => {
      // These are the ones where getting it wrong causes injury rather than
      // just wasted effort.
      for (const id of ['deadlift', 'back-squat', 'bench-press']) {
        const g = libraryHabit(id).guidance!;
        expect(g.steps?.length).withContext(id).toBeGreaterThan(3);
        expect(g.mistakes?.length).withContext(id).toBeGreaterThan(1);
        expect(g.safety).withContext(`${id} has no safety note`).toBeTruthy();
      }
    });

    it('never ships an image URL it cannot back up', () => {
      // No photography is bundled; a made-up URL would render as a broken
      // image in the guidance dialog.
      for (const habit of ALL_LIBRARY_HABITS) {
        expect(habit.guidance?.media?.imageUrl).withContext(habit.id).toBeUndefined();
      }
    });
  });

  it('produces a draft the habits service can accept', () => {
    const draft = toHabitDraft(libraryHabit('deadlift'));
    expect(draft.name).toBe('Deadlift');
    // 'fitness' is the LIBRARY's category id. The draft has to carry the app's
    // slug instead, or categoryRowIds() cannot resolve it and the habit is
    // written to Baserow with no category at all.
    expect(draft.category).toBe('health');
    expect(Object.keys(draft).sort()).toEqual(
      [
        'category',
        'description',
        'difficulty',
        'goal',
        'icon',
        'name',
        'points',
        // Whether this habit reveals Article 9 data. Undefined for most, and
        // present on every draft so HabitsService can refuse an unconsented
        // sensitive habit without importing the catalogue — it is constructed
        // eagerly by the nav bars, where the library costs ~137 kB.
        'sensitiveCategory',
        // Carried through so a new habit keeps its target without a library
        // lookup, and so the user can change it later.
        'targetValue',
        'trackingUnit',
        'type'
      ].sort()
    );
  });

  /**
   * The library's five areas of life and the app's eight Baserow category rows
   * are separate vocabularies that only overlap on 'health'. Every habit must
   * land on a slug habits.ts can actually resolve, or it is saved with no
   * category and disappears from the grouped view.
   */
  describe('app category mapping', () => {
    const APP_SLUGS = new Set([
      'health',
      'productivity',
      'learning',
      'mindfulness',
      'social',
      'creative',
      'finance',
      'other'
    ]);

    it('maps every habit in the library to a real app slug', () => {
      for (const habit of ALL_LIBRARY_HABITS) {
        expect(APP_SLUGS.has(appCategorySlug(habit)))
          .withContext(`${habit.id} → ${appCategorySlug(habit)}`)
          .toBe(true);
      }
    });

    it('never leaves a habit on a raw library category id', () => {
      const libraryIds = new Set(LIBRARY_CATEGORIES.map(c => c.id));
      for (const habit of ALL_LIBRARY_HABITS) {
        const slug = appCategorySlug(habit);
        // 'health' is the one id present in both vocabularies, legitimately.
        if (slug === 'health') continue;
        expect(libraryIds.has(slug)).withContext(`${habit.id} → ${slug}`).toBe(false);
      }
    });

    it('prefers the subcategory where it is more specific than its parent', () => {
      // Both live under 'work', but reading is Learning, not Productivity.
      expect(appCategorySlug(libraryHabit('read-30'))).toBe('learning');
      // Both live under 'life', but spending is Finance, not Social.
      expect(appCategorySlug(libraryHabit('log-spending'))).toBe('finance');
      expect(appCategorySlug(libraryHabit('deadlift'))).toBe('health');
    });

    it('sends both fitness and health to the Health & Fitness row', () => {
      const fitness = ALL_LIBRARY_HABITS.find(h => h.categoryId === 'fitness')!;
      const health = ALL_LIBRARY_HABITS.find(h => h.categoryId === 'health')!;

      expect(appCategorySlug(fitness)).toBe('health');
      expect(appCategorySlug(health)).toBe('health');
    });
  });
});

describe('packs and challenges reference the library', () => {
  it('every pack resolves and has habits', () => {
    // pick() throws on an unknown id, so simply building the packs is the test.
    for (const pack of HABIT_TEMPLATE_PACKS) {
      expect(pack.habits.length).withContext(pack.name).toBeGreaterThan(0);
    }
  });

  it('has unique pack ids', () => {
    const ids = HABIT_TEMPLATE_PACKS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not repeat a habit within a pack', () => {
    for (const pack of HABIT_TEMPLATE_PACKS) {
      const ids = pack.habits.map(h => h.id);
      expect(new Set(ids).size).withContext(pack.name).toBe(ids.length);
    }
  });

  /**
   * The templates page renders packs BY GROUP, so an unshelved pack is not a
   * cosmetic problem — it exists and is unreachable. Nothing else catches that.
   */
  describe('pack groups', () => {
    const shelved = PACK_GROUPS.flatMap(g => g.packIds);

    it('shelves every pack', () => {
      const missing = HABIT_TEMPLATE_PACKS.map(p => p.id).filter(id => !shelved.includes(id));
      expect(missing).withContext(`unshelved packs: ${missing.join(', ')}`).toEqual([]);
    });

    it('shelves each pack exactly once', () => {
      expect(new Set(shelved).size).toBe(shelved.length);
    });

    it('references no pack that does not exist', () => {
      const real = new Set(HABIT_TEMPLATE_PACKS.map(p => p.id));
      const ghosts = shelved.filter(id => !real.has(id));
      expect(ghosts).withContext(`unknown pack ids: ${ghosts.join(', ')}`).toEqual([]);
    });

    it('has no empty group', () => {
      for (const group of PACK_GROUPS) {
        expect(packsInGroup(group).length).withContext(group.name).toBeGreaterThan(0);
      }
    });

    it('resolves groups in their declared order', () => {
      for (const group of PACK_GROUPS) {
        expect(packsInGroup(group).map(p => p.id)).toEqual(group.packIds);
      }
    });
  });

  /**
   * The product decision recorded as a test: Habiti does not recommend
   * meditation or new-age practice. Without this, someone reinstates it in a
   * seed file and nothing objects.
   */
  describe('content policy', () => {
    const REMOVED = [
      'meditate-10',
      'body-scan',
      'walking-meditation',
      'loving-kindness',
      'noting-practice'
    ];

    it('no longer carries the meditation habits', () => {
      const present = REMOVED.filter(id => ALL_LIBRARY_HABITS.some(h => h.id === id));
      expect(present).withContext(`reinstated: ${present.join(', ')}`).toEqual([]);
    });

    it('has no meditation subcategory', () => {
      const subs = LIBRARY_CATEGORIES.flatMap(c => c.subcategories.map(s => s.id));
      expect(subs).not.toContain('meditation');
    });

    it('no pack recommends a removed habit', () => {
      for (const pack of HABIT_TEMPLATE_PACKS) {
        const bad = pack.habits.filter(h => REMOVED.includes(h.id));
        expect(bad.map(h => h.id)).withContext(pack.name).toEqual([]);
      }
    });
  });

  it('every challenge suggests habits that exist', () => {
    for (const template of CHALLENGE_CATALOGUE) {
      const ids = template.suggestedHabitIds ?? [];
      expect(ids.length).withContext(`${template.title} suggests nothing`).toBeGreaterThan(0);
      expect(() => pick(...ids)).withContext(template.title).not.toThrow();
    }
  });
});
