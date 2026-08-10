import {
  ALL_SKILLS,
  SKILL_CATALOGUE,
  SKILL_CATEGORIES,
  findSkill,
  practiceHabits,
  pickSkills,
  searchSkills,
  skillDefinition,
  skillsIn,
  starterKeys
} from './index';
import { CHALLENGE_CATALOGUE } from '../challenge-catalogue.seed';

/**
 * The catalogue is data that reaches the screen and the database unchanged, and
 * most of what can go wrong here is invisible to a typecheck:
 *
 * - a habit id that does not exist → the skill silently practises nothing
 * - a requirement naming a starter task that was renamed → a tier nobody can reach
 * - thresholds that do not increase → tier 4 easier than tier 3
 * - a missing `minTier` → a Plus feature given away
 *
 * Every one of those is asserted below, which is what makes it safe to add the
 * remaining category files in bulk.
 */
describe('skill catalogue', () => {
  it('has categories, each with skills', () => {
    expect(SKILL_CATALOGUE.length).toBeGreaterThan(0);
    for (const section of SKILL_CATALOGUE) {
      expect(section.skills.length)
        .withContext(`${section.category.name} is empty`)
        .toBeGreaterThan(0);
    }
  });

  it('has globally unique skill ids', () => {
    const ids = ALL_SKILLS.map(s => s.id);
    const seen = new Set<string>();
    const dupes = ids.filter(id => (seen.has(id) ? true : (seen.add(id), false)));
    expect(dupes).toEqual([]);
  });

  it('has unique names, since the UI groups and searches by them', () => {
    const names = ALL_SKILLS.map(s => s.name.trim().toLowerCase());
    const seen = new Set<string>();
    expect(names.filter(n => (seen.has(n) ? true : (seen.add(n), false)))).toEqual([]);
  });

  it('stamps every skill with a real category', () => {
    for (const definition of ALL_SKILLS) {
      expect(definition.categoryId)
        .withContext(`${definition.id} has no categoryId — did inCategory() wrap it?`)
        .toBeTruthy();
      expect(SKILL_CATEGORIES.some(c => c.id === definition.categoryId))
        .withContext(`${definition.id} points at unknown category "${definition.categoryId}"`)
        .toBe(true);
    }
  });

  it('gives every skill a name, icon, description and accent', () => {
    for (const s of ALL_SKILLS) {
      expect(s.name.trim().length).withContext(s.id).toBeGreaterThan(0);
      expect(s.icon.trim().length).withContext(s.id).toBeGreaterThan(0);
      expect(s.description.trim().length).withContext(s.id).toBeGreaterThan(0);
    }
    for (const c of SKILL_CATEGORIES) {
      expect(c.accent).withContext(`${c.id} accent`).toMatch(/^from-/);
    }
  });

  it('is entirely Habiti Plus', () => {
    // The user's decision. A definition that forgot minTier would hand the
    // whole feature to free accounts, and nothing else would notice.
    for (const s of ALL_SKILLS) {
      expect(s.minTier).withContext(s.id).toBe('plus');
    }
  });

  describe('practice habits', () => {
    it('resolves every habit id against the habit library', () => {
      // practiceHabits() goes through the library's throwing pick(), so this
      // fails loudly on a typo instead of producing a skill with no practice.
      for (const definition of ALL_SKILLS) {
        expect(() => practiceHabits(definition))
          .withContext(`${definition.id} references a habit that does not exist`)
          .not.toThrow();
      }
    });

    it('gives every skill at least one practice habit', () => {
      for (const definition of ALL_SKILLS) {
        expect(definition.habitIds.length).withContext(definition.id).toBeGreaterThan(0);
      }
    });

    it('does not repeat a habit within one skill', () => {
      for (const definition of ALL_SKILLS) {
        const unique = new Set(definition.habitIds);
        expect(unique.size).withContext(definition.id).toBe(definition.habitIds.length);
      }
    });

    it('DOES allow the same habit across different skills', () => {
      // Deliberate: `stretch` belongs to both Strength and Mobility. They are
      // different proficiencies drawing on the same behaviour, and a day of
      // stretching legitimately advances both. Do not "fix" this.
      const counts = new Map<string, number>();
      for (const s of ALL_SKILLS) {
        for (const id of s.habitIds) counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      expect([...counts.values()].some(n => n > 1)).toBe(true);
    });
  });

  describe('tier ladders', () => {
    it('has exactly five tiers, numbered 1..5 in order', () => {
      for (const s of ALL_SKILLS) {
        expect(s.tiers.length).withContext(s.id).toBe(5);
        expect(s.tiers.map(t => t.level)).withContext(s.id).toEqual([1, 2, 3, 4, 5]);
      }
    });

    it('names and describes every tier', () => {
      for (const s of ALL_SKILLS) {
        for (const t of s.tiers) {
          expect(t.name.trim().length).withContext(`${s.id} tier ${t.level}`).toBeGreaterThan(0);
          expect(t.blurb.trim().length).withContext(`${s.id} tier ${t.level}`).toBeGreaterThan(0);
        }
      }
    });

    it('requires something at every tier', () => {
      for (const s of ALL_SKILLS) {
        for (const t of s.tiers) {
          expect(t.requires.length).withContext(`${s.id} tier ${t.level}`).toBeGreaterThan(0);
        }
      }
    });

    it('increases habit-days strictly up the ladder', () => {
      // A tier 4 easier than tier 3 makes the ladder meaningless, and nothing
      // else in the app would ever notice.
      for (const s of ALL_SKILLS) {
        const days = s.tiers.map(
          t => (t.requires.find(r => r.kind === 'habit-days') as { days: number } | undefined)?.days
        );
        const present = days.filter((d): d is number => d !== undefined);
        for (let i = 1; i < present.length; i++) {
          expect(present[i])
            .withContext(`${s.id}: tier ${i + 1} requires ${present[i]} days, previous ${present[i - 1]}`)
            .toBeGreaterThan(present[i - 1]);
        }
      }
    });

    it('starts every ladder at a reachable first tier', () => {
      // Tier 1 must be achievable in a week or the skill never gets off the
      // ground and the whole ladder reads as decoration.
      for (const s of ALL_SKILLS) {
        const first = s.tiers[0].requires.find(r => r.kind === 'habit-days') as
          | { days: number }
          | undefined;
        expect(first).withContext(`${s.id} tier 1 has no habit-days requirement`).toBeTruthy();
        expect(first!.days).withContext(s.id).toBeLessThanOrEqual(14);
      }
    });
  });

  describe('requirement references', () => {
    it('names only starter tasks the skill actually declares', () => {
      for (const s of ALL_SKILLS) {
        const known = new Set(starterKeys(s).tasks);
        for (const t of s.tiers) {
          for (const r of t.requires) {
            if (r.kind !== 'tasks') continue;
            for (const key of r.taskKeys) {
              expect(known.has(key))
                .withContext(`${s.id} tier ${t.level} requires unknown task "${key}"`)
                .toBe(true);
            }
          }
        }
      }
    });

    it('names only starter projects the skill actually declares', () => {
      for (const s of ALL_SKILLS) {
        const known = new Set(starterKeys(s).projects);
        for (const t of s.tiers) {
          for (const r of t.requires) {
            if (r.kind !== 'project') continue;
            expect(known.has(r.projectKey))
              .withContext(`${s.id} tier ${t.level} requires unknown project "${r.projectKey}"`)
              .toBe(true);
          }
        }
      }
    });

    it('names only challenge templates that exist', () => {
      const templateIds = new Set(CHALLENGE_CATALOGUE.map(t => t.id));

      for (const s of ALL_SKILLS) {
        for (const id of s.campaignTemplateIds) {
          expect(templateIds.has(id))
            .withContext(`${s.id} offers unknown challenge template "${id}"`)
            .toBe(true);
        }
        for (const t of s.tiers) {
          for (const r of t.requires) {
            if (r.kind !== 'campaign') continue;
            for (const id of r.templateIds) {
              expect(templateIds.has(id))
                .withContext(`${s.id} tier ${t.level} requires unknown template "${id}"`)
                .toBe(true);
            }
          }
        }
      }
    });

    it('only asks for volume from habits the skill practises', () => {
      // A volume requirement over an unbound habit can never be satisfied.
      for (const s of ALL_SKILLS) {
        const bound = new Set(s.habitIds);
        for (const t of s.tiers) {
          for (const r of t.requires) {
            if (r.kind !== 'volume' || !r.habitIds) continue;
            for (const id of r.habitIds) {
              expect(bound.has(id))
                .withContext(`${s.id} tier ${t.level} counts volume from unbound habit "${id}"`)
                .toBe(true);
            }
          }
        }
      }
    });

    it('gives every starter task and project a unique key within its skill', () => {
      for (const s of ALL_SKILLS) {
        const { tasks, projects } = starterKeys(s);
        expect(new Set(tasks).size).withContext(`${s.id} tasks`).toBe(tasks.length);
        expect(new Set(projects).size).withContext(`${s.id} projects`).toBe(projects.length);
      }
    });

    it('gives every starter project at least one task title', () => {
      for (const s of ALL_SKILLS) {
        for (const p of s.starterProjects) {
          expect(p.taskTitles.length).withContext(`${s.id}/${p.key}`).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('lookup', () => {
    it('finds a skill by id', () => {
      expect(skillDefinition('strength').name).toBe('Strength');
    });

    it('throws on an unknown id rather than returning undefined', () => {
      expect(() => skillDefinition('not-a-skill')).toThrowError(/Unknown skill/);
    });

    it('offers a null-safe variant for a track whose skill was retired', () => {
      expect(findSkill('not-a-skill')).toBeUndefined();
    });

    it('picks several in order', () => {
      expect(pickSkills('guitar', 'strength').map(s => s.id)).toEqual(['guitar', 'strength']);
    });

    it('lists by category', () => {
      expect(skillsIn('body').length).toBeGreaterThan(0);
      expect(skillsIn('nope')).toEqual([]);
    });
  });

  describe('search', () => {
    it('matches on name and description', () => {
      expect(searchSkills('strength').length).toBeGreaterThan(0);
      expect(searchSkills('STRENGTH').length).toBeGreaterThan(0);
    });

    it('matches on the names of the habits a skill practises', () => {
      // Someone searching "deadlift" is looking for Strength.
      expect(searchSkills('deadlift').map(s => s.id)).toContain('strength');
    });

    it('returns nothing for an empty term', () => {
      expect(searchSkills('   ')).toEqual([]);
    });
  });
});
