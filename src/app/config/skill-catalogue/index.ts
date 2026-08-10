import { BODY } from './body';
import { CRAFT } from './craft';
import { GAMES } from './games';
import { HOME } from './home';
import { KITCHEN } from './kitchen';
import { LANGUAGE } from './language';
import { MIND } from './mind';
import { MONEY } from './money';
import { WORK } from './work';
import { SkillCategory, SkillDefinition, SkillSection } from './types';
import { LibraryHabit, pick } from '../habit-library';

export * from './types';

/**
 * The whole skill catalogue.
 *
 * Order is browse order, so the categories most people are looking for come
 * first.
 */
export const SKILL_CATALOGUE: SkillSection[] = [
  BODY,
  CRAFT,
  KITCHEN,
  MIND,
  LANGUAGE,
  WORK,
  MONEY,
  HOME,
  GAMES
];

export const SKILL_CATEGORIES: SkillCategory[] = SKILL_CATALOGUE.map(s => s.category);

export const ALL_SKILLS: SkillDefinition[] = SKILL_CATALOGUE.flatMap(s => s.skills);

const BY_ID = new Map(ALL_SKILLS.map(s => [s.id, s]));

/**
 * Looks a skill up by its stable slug.
 *
 * Throws rather than returning undefined, for the same reason
 * `libraryHabit()` does: a track stores a `skillId`, and a silent miss would
 * render an empty page instead of failing loudly where the typo is.
 */
export function skillDefinition(id: string): SkillDefinition {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown skill: "${id}"`);
  return found;
}

export function pickSkills(...ids: string[]): SkillDefinition[] {
  return ids.map(skillDefinition);
}

/** Null-safe variant, for a track whose skill was removed from the catalogue. */
export function findSkill(id: string): SkillDefinition | undefined {
  return BY_ID.get(id);
}

export function skillsIn(categoryId: string): SkillDefinition[] {
  return ALL_SKILLS.filter(s => s.categoryId === categoryId && s.active);
}

export function skillCategory(id: string): SkillCategory | undefined {
  return SKILL_CATEGORIES.find(c => c.id === id);
}

/**
 * The library habits a skill practises.
 *
 * Resolved through the habit library's throwing `pick()`, so a bad id fails at
 * module evaluation — which means it fails in the spec rather than in front of
 * a user.
 */
export function practiceHabits(definition: SkillDefinition): LibraryHabit[] {
  return pick(...definition.habitIds);
}

/** Free-text search across name, description and the names of its habits. */
export function searchSkills(term: string): SkillDefinition[] {
  const needle = term.trim().toLowerCase();
  if (!needle) return [];

  return ALL_SKILLS.filter(definition => {
    if (definition.name.toLowerCase().includes(needle)) return true;
    if (definition.description.toLowerCase().includes(needle)) return true;
    return practiceHabits(definition).some(h => h.name.toLowerCase().includes(needle));
  });
}

/** Every starter task/project key a definition declares, for spec validation. */
export function starterKeys(definition: SkillDefinition): { tasks: string[]; projects: string[] } {
  return {
    tasks: definition.starterTasks.map(t => t.key),
    projects: definition.starterProjects.map(p => p.key)
  };
}
