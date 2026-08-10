import { SkillDefinition, SkillRequirement, SkillTier } from '../config/skill-catalogue';
import { SkillTrack } from '../models/skill.models';

/**
 * Skill progress, derived.
 *
 * Pure functions, no injection — the same shape as level-derivation.util.ts,
 * and for the same reason: this is where the rules that matter live, and they
 * need to be testable without a browser.
 *
 * Nothing here increments anything. Every number is recomputed from evidence
 * that already exists, so a skill can never disagree with the habit data it is
 * describing.
 */

/** One habit-day: the date, and what was recorded. */
export interface PracticeEntry {
  habitId: string;
  /** Date-only, `YYYY-MM-DD`. */
  date: string;
  completed: boolean;
  /** What the habit measured that day, if anything. */
  value?: number;
}

/**
 * Everything the derivation needs, supplied by the caller.
 *
 * A port rather than injected services, so the rules can be tested against
 * plain arrays and the service decides how to gather them efficiently.
 */
export interface EvidencePort {
  /** Every recorded entry for the given habits. Order does not matter. */
  entriesFor(habitIds: string[]): PracticeEntry[];
  isTaskComplete(taskId: string): boolean;
  isProjectComplete(projectId: string): boolean;
  /** Template ids of COMPLETED runs among the given campaign keys. */
  completedCampaignTemplateIds(campaignKeys: string[]): string[];
}

export interface RequirementProgress {
  label: string;
  have: number;
  need: number;
  done: boolean;
  /** 0–1, for a meter. */
  fraction: number;
}

export interface TierProgress {
  tier: SkillTier;
  requirements: RequirementProgress[];
  met: boolean;
  /** 0–1 across all requirements, evenly weighted. */
  fraction: number;
}

// ---------------------------------------------------------------------------
// The two rules that make the numbers honest
// ---------------------------------------------------------------------------

/**
 * Entries that count toward this track.
 *
 * Clamped to `startedAt`. Without it, starting "Strength" would immediately
 * grant three tiers off a year of existing squats, and the ladder would be
 * meaningless on the day it matters most.
 */
function eligibleEntries(
  track: SkillTrack,
  port: EvidencePort,
  habitIds?: string[]
): PracticeEntry[] {
  const wanted = habitIds?.length ? habitIds.filter(id => track.habitIds.includes(id)) : track.habitIds;
  if (wanted.length === 0) return [];

  return port
    .entriesFor(wanted)
    .filter(entry => entry.completed && entry.date >= track.startedAt);
}

/**
 * Distinct DATES on which any bound habit was completed.
 *
 * NOT the number of completions. Ticking six bound habits on Monday is one day
 * of practice toward the skill, not six — the single most important line in
 * this file, and the easiest thing in the world to get wrong.
 */
export function practiceDays(track: SkillTrack, port: EvidencePort, habitIds?: string[]): number {
  return distinctDates(eligibleEntries(track, port, habitIds)).size;
}

function distinctDates(entries: PracticeEntry[]): Set<string> {
  return new Set(entries.map(e => e.date));
}

/** Longest run of consecutive practice dates. */
export function longestStreak(
  track: SkillTrack,
  port: EvidencePort,
  habitIds?: string[]
): number {
  const dates = [...distinctDates(eligibleEntries(track, port, habitIds))].sort();
  if (dates.length === 0) return 0;

  let best = 1;
  let run = 1;

  for (let i = 1; i < dates.length; i++) {
    run = isNextDay(dates[i - 1], dates[i]) ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

/** Parsed as LOCAL dates — `new Date('2026-08-09')` is UTC and shifts the day. */
function isNextDay(previous: string, current: string): boolean {
  const [py, pm, pd] = previous.split('-').map(Number);
  const [cy, cm, cd] = current.split('-').map(Number);
  const before = new Date(py, pm - 1, pd);
  const after = new Date(cy, cm - 1, cd);
  return (after.getTime() - before.getTime()) / 86400000 === 1;
}

/**
 * Σ of what the bound habits measured.
 *
 * The one number no other page in the app can produce: every check-in already
 * writes a value, and nothing aggregates it across time because habits reset
 * and challenges end.
 */
export function totalVolume(
  track: SkillTrack,
  port: EvidencePort,
  habitIds?: string[]
): number {
  return eligibleEntries(track, port, habitIds).reduce((sum, e) => sum + (e.value ?? 0), 0);
}

// ---------------------------------------------------------------------------
// Requirements
// ---------------------------------------------------------------------------

export function requirementProgress(
  requirement: SkillRequirement,
  track: SkillTrack,
  definition: SkillDefinition,
  port: EvidencePort
): RequirementProgress {
  switch (requirement.kind) {
    case 'habit-days': {
      const have = practiceDays(track, port, requirement.habitIds);
      return build('Practice days', have, requirement.days);
    }

    case 'habit-streak': {
      const have = longestStreak(track, port, requirement.habitIds);
      return build('Longest streak', have, requirement.days);
    }

    case 'volume': {
      const have = totalVolume(track, port, requirement.habitIds);
      return build(`Total ${requirement.unit}`, have, requirement.total);
    }

    case 'tasks': {
      const have = requirement.taskKeys.filter(key => {
        const ref = track.taskRefs.find(r => r.key === key);
        return !!ref && port.isTaskComplete(ref.taskId);
      }).length;
      return build(labelForTasks(requirement.taskKeys, definition), have, requirement.taskKeys.length);
    }

    case 'project': {
      const ref = track.projectRefs.find(r => r.key === requirement.projectKey);
      const done = !!ref && port.isProjectComplete(ref.projectId);
      const project = definition.starterProjects.find(p => p.key === requirement.projectKey);
      return build(project?.title ?? 'Project', done ? 1 : 0, 1);
    }

    case 'campaign': {
      const completed = port.completedCampaignTemplateIds(track.campaignKeys);
      const have = requirement.templateIds.some(id => completed.includes(id)) ? 1 : 0;
      return build('A campaign completed', have, 1);
    }
  }
}

function labelForTasks(keys: string[], definition: SkillDefinition): string {
  if (keys.length === 1) {
    return definition.starterTasks.find(t => t.key === keys[0])?.title ?? 'Task';
  }
  return 'Starter tasks';
}

function build(label: string, have: number, need: number): RequirementProgress {
  return {
    label,
    have,
    need,
    done: have >= need,
    fraction: need <= 0 ? 1 : Math.max(0, Math.min(1, have / need))
  };
}

export function tierProgress(
  tier: SkillTier,
  track: SkillTrack,
  definition: SkillDefinition,
  port: EvidencePort
): TierProgress {
  const requirements = tier.requires.map(r => requirementProgress(r, track, definition, port));
  const met = requirements.every(r => r.done);
  const fraction = requirements.length
    ? requirements.reduce((sum, r) => sum + r.fraction, 0) / requirements.length
    : 1;

  return { tier, requirements, met, fraction };
}

/**
 * The highest tier whose requirements are ALL met.
 *
 * Tiers are cumulative and must be earned in order: a ladder where tier 4 is
 * reachable while tier 3 is not would let someone skip a rung by doing one
 * unusual thing.
 */
export function eligibleTier(
  track: SkillTrack,
  definition: SkillDefinition,
  port: EvidencePort
): number {
  let highest = 0;
  for (const tier of definition.tiers) {
    if (!tierProgress(tier, track, definition, port).met) break;
    highest = tier.level;
  }
  return highest;
}

/** The next tier's progress, or null once the ladder is finished. */
export function nextTier(
  track: SkillTrack,
  definition: SkillDefinition,
  port: EvidencePort
): TierProgress | null {
  const tier = definition.tiers.find(t => t.level === track.tier + 1);
  return tier ? tierProgress(tier, track, definition, port) : null;
}

/**
 * One line: the single most useful thing to do next.
 *
 * Exactly one, deliberately. A list of everything outstanding turns the skill
 * page into a backlog, which is the failure mode this feature has to avoid.
 */
export function nextAction(
  track: SkillTrack,
  definition: SkillDefinition,
  port: EvidencePort
): RequirementProgress | null {
  const next = nextTier(track, definition, port);
  if (!next) return null;

  const outstanding = next.requirements.filter(r => !r.done);
  if (outstanding.length === 0) return null;

  // The closest to done, so the suggestion is the one most worth acting on.
  return outstanding.reduce((best, r) => (r.fraction > best.fraction ? r : best));
}

/** True when there is a tier to claim. Drives the Claim button and the badge. */
export function canClaim(
  track: SkillTrack,
  definition: SkillDefinition,
  port: EvidencePort
): boolean {
  return track.status === 'active' && eligibleTier(track, definition, port) > track.tier;
}
