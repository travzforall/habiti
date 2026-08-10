import { PlanTier } from '../../models/daily-content.models';

/**
 * The skill catalogue.
 *
 * A skill is the only primitive in Habiti that is cumulative, scoped to one
 * topic, and never finished. Habits reset at midnight, tasks and projects
 * complete and vanish, campaigns end, and Level is a single global number — so
 * nothing could answer "how good am I at THIS, and what would make me better?"
 *
 * The mechanism that keeps it from being a fifth list: **a skill stores almost
 * nothing.** Progress is DERIVED from habit entries, completed tasks, completed
 * projects and completed campaigns the track is bound to. The skill is a lens;
 * the other primitives are the evidence. Ticking a habit already advances a
 * skill, so there is nothing extra to do daily.
 *
 * In code rather than Baserow, for the same reason as the challenge catalogue:
 * tier thresholds are a product decision that should be reviewed and pinned to
 * a release, and the page must work for a brand-new user before any table
 * exists.
 */

/**
 * How a tier is proven.
 *
 * A CLOSED set on purpose — every kind needs an evaluator in
 * skill-progress.util.ts, and a requirement nobody can compute is a tier nobody
 * can honestly reach.
 */
export type SkillRequirement =
  /**
   * Distinct DATES on which any bound habit was completed.
   *
   * Never a sum of per-habit completions: ticking six bound habits on Monday is
   * ONE day toward the skill, not six.
   */
  | { kind: 'habit-days'; days: number; habitIds?: string[] }
  /** Longest run of consecutive such dates. */
  | { kind: 'habit-streak'; days: number; habitIds?: string[] }
  /**
   * Σ HabitEntry.value across bound habits.
   *
   * The one thing only a skill can report. Every check-in already writes a
   * value — minutes practised, kilos lifted, pages read — and nothing in the
   * app aggregates it across time, because habits reset and challenges end.
   */
  | { kind: 'volume'; total: number; unit: string; habitIds?: string[] }
  /** Starter tasks from this definition, by catalogue key. */
  | { kind: 'tasks'; taskKeys: string[] }
  /** A starter project completed. */
  | { kind: 'project'; projectKey: string }
  /** A completed ChallengeRun whose templateId is in this list. */
  | { kind: 'campaign'; templateIds: string[] };

export interface SkillTier {
  /** 1-based. Tier 0 means "started, nothing claimed yet". */
  level: number;
  name: string;
  /** What you can actually DO at this tier — the reason to want it. */
  blurb: string;
  requires: SkillRequirement[];
}

export interface SkillStarterTask {
  key: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
}

export interface SkillStarterProject {
  key: string;
  title: string;
  description: string;
  taskTitles: string[];
}

export interface SkillDefinition {
  /** Stable slug. Tracks reference this, so it must never be renamed. */
  id: string;
  name: string;
  icon: string;
  description: string;
  categoryId: string;
  /**
   * Habit ids in the EXISTING habit library.
   *
   * Skills never define their own practice content. Strength points at
   * `back-squat`/`deadlift`; Running at `run`/`zone-2`. One description, one
   * point value, one set of form guidance, wherever it appears.
   *
   * Resolved through the library's throwing `pick()`, so a typo fails the spec.
   */
  habitIds: string[];
  starterTasks: SkillStarterTask[];
  starterProjects: SkillStarterProject[];
  /** Challenge templates that fit this skill — the "as a campaign" option. */
  campaignTemplateIds: string[];
  /** Exactly five, ascending. */
  tiers: SkillTier[];
  minTier: PlanTier;
  sortIndex: number;
  active: boolean;
}

export interface SkillCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** Tailwind gradient classes, same convention as LibraryCategory.accent. */
  accent: string;
}

export interface SkillSection {
  category: SkillCategory;
  skills: SkillDefinition[];
}

/** The default ladder. A definition may override any name. */
export const DEFAULT_TIER_NAMES = [
  'Novice',
  'Apprentice',
  'Practitioner',
  'Advanced',
  'Master'
] as const;

// ---------------------------------------------------------------------------
// Builders — most fields repeat, and the boilerplate hides what differs
// ---------------------------------------------------------------------------

/** Shorthand requirement constructors, so a ladder reads as a ladder. */
export const req = {
  days: (days: number, habitIds?: string[]): SkillRequirement => ({
    kind: 'habit-days',
    days,
    ...(habitIds ? { habitIds } : {})
  }),
  streak: (days: number, habitIds?: string[]): SkillRequirement => ({
    kind: 'habit-streak',
    days,
    ...(habitIds ? { habitIds } : {})
  }),
  volume: (total: number, unit: string, habitIds?: string[]): SkillRequirement => ({
    kind: 'volume',
    total,
    unit,
    ...(habitIds ? { habitIds } : {})
  }),
  tasks: (...taskKeys: string[]): SkillRequirement => ({ kind: 'tasks', taskKeys }),
  project: (projectKey: string): SkillRequirement => ({ kind: 'project', projectKey }),
  campaign: (...templateIds: string[]): SkillRequirement => ({ kind: 'campaign', templateIds })
};

/** One rung. `level` is positional so a ladder cannot be misnumbered by hand. */
export function tier(
  level: number,
  blurb: string,
  requires: SkillRequirement[],
  name?: string
): SkillTier {
  return {
    level,
    name: name ?? DEFAULT_TIER_NAMES[level - 1] ?? `Tier ${level}`,
    blurb,
    requires
  };
}

export function task(
  key: string,
  title: string,
  description: string,
  priority: SkillStarterTask['priority'] = 'medium'
): SkillStarterTask {
  return { key, title, description, priority };
}

export function project(
  key: string,
  title: string,
  description: string,
  taskTitles: string[]
): SkillStarterProject {
  return { key, title, description, taskTitles };
}

/**
 * A skill definition.
 *
 * `minTier` defaults to 'plus': skills are a Habiti Plus feature, and a
 * definition that forgets to say so would quietly give the whole catalogue away.
 */
export function skill(
  input: Omit<SkillDefinition, 'minTier' | 'active' | 'categoryId'> &
    Partial<Pick<SkillDefinition, 'minTier' | 'active' | 'categoryId'>>
): SkillDefinition {
  return {
    minTier: 'plus',
    active: true,
    categoryId: '',
    ...input
  };
}

/** Stamps the category onto a block of skills, as habit-library's group() does. */
export function inCategory(categoryId: string, skills: SkillDefinition[]): SkillDefinition[] {
  return skills.map(s => ({ ...s, categoryId }));
}
