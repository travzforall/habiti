/**
 * Challenges — the thing that earns levels.
 *
 * A `ChallengeTemplate` is a definition from the catalogue. A `ChallengeRun` is
 * one user's attempt at one, and is shaped field-for-field like a `campaigns`
 * row so that a solo run and a partnered one are the same entity: solo simply
 * has a single participant and skips the invite/negotiate/lock transitions.
 *
 * Naming note: `src/app/game/challenges/` is an unrelated dating-sim minigame
 * that owns the `app-challenges` selector. Everything here is prefixed
 * `Challenge*` and the page uses `app-challenge-list`.
 */

import { PlanTier } from './daily-content.models';
import { ChallengePledge } from './pledge.models';
import { addDays, daysBetween, parseDateKey, toDateKey } from '../utils/date-key.util';

export type ChallengeDifficulty = 'easy' | 'medium' | 'hard';

export const CHALLENGE_DIFFICULTIES: readonly ChallengeDifficulty[] = [
  'easy',
  'medium',
  'hard'
] as const;

export interface ChallengeDifficultyMeta {
  id: ChallengeDifficulty;
  label: string;
  description: string;
  icon: string;
  /** Applied to a template's baseLevelValue when a tier omits its own. */
  levelMultiplier: number;
  /** Fraction of periods that must pass. */
  requiredPassRate: number;
  /** Misses forgiven before the run fails outright. */
  graceMisses: number;
}

export const CHALLENGE_DIFFICULTY_META: Record<ChallengeDifficulty, ChallengeDifficultyMeta> = {
  easy: {
    id: 'easy',
    label: 'Easy',
    description: 'Room to breathe',
    icon: '🟢',
    levelMultiplier: 1,
    requiredPassRate: 0.7,
    graceMisses: 3
  },
  medium: {
    id: 'medium',
    label: 'Standard',
    description: 'The honest version',
    icon: '🟡',
    levelMultiplier: 1.5,
    requiredPassRate: 0.85,
    graceMisses: 1
  },
  hard: {
    id: 'hard',
    label: 'Hard',
    description: 'No misses',
    icon: '🔴',
    levelMultiplier: 2,
    requiredPassRate: 1,
    graceMisses: 0
  }
};

export type ChallengeCategory =
  | 'fitness'
  | 'mind'
  | 'discipline'
  | 'sobriety'
  | 'faith'
  | 'craft';

export const CHALLENGE_CATEGORY_META: Record<ChallengeCategory, { label: string; icon: string }> = {
  fitness: { label: 'Fitness', icon: '💪' },
  mind: { label: 'Mind', icon: '🧘' },
  discipline: { label: 'Discipline', icon: '⚔️' },
  sobriety: { label: 'Sobriety', icon: '🌊' },
  faith: { label: 'Faith', icon: '✝️' },
  craft: { label: 'Craft', icon: '🛠️' }
};

export interface ChallengeTier {
  levelValue: number;
  targetPerPeriod: number;
  requiredPassRate: number;
  graceMisses: number;
  blurb: string;
}

export interface ChallengeTemplate {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: ChallengeCategory;
  durationDays: number;
  cadence: 'daily' | 'weekly';
  /** Fallback when a tier omits levelValue. */
  baseLevelValue: number;
  tiers: Partial<Record<ChallengeDifficulty, ChallengeTier>>;
  minTier: PlanTier;
  /** False until partnered challenges ship. */
  allowsPartner: boolean;
  /**
   * Library habit ids this challenge is meant to be measured against.
   *
   * Advisory, not required: a challenge can cover things Habiti does not track
   * ("went to the meeting"), and isCheckInBacked() still works with none bound.
   * Starting a challenge offers to create any of these the user lacks, so the
   * grid has something to show on day one.
   *
   * IDS rather than copies, so a challenge and a template pack referring to
   * the same habit cannot drift apart. Resolved through the library at the
   * point of use, which keeps models free of a dependency on config data.
   */
  suggestedHabitIds?: string[];
  sortIndex: number;
  active: boolean;
}

// ---------------------------------------------------------------------------
// A user's run
// ---------------------------------------------------------------------------

export type ChallengeRunStatus = 'active' | 'completed' | 'failed' | 'cancelled';

/** Frozen at start time so a later catalogue edit cannot change the payout. */
export interface ChallengeTerms {
  difficulty: ChallengeDifficulty;
  levelValue: number;
  targetPerPeriod: number;
  requiredPassRate: number;
  graceMisses: number;
  periodsTotal: number;
  /**
   * The habits this challenge is measured against, chosen when it starts.
   *
   * Empty means "any habit counts" — the behaviour before habits could be
   * bound, and still the right default for a challenge covering something
   * Habiti does not track (staying clean, going to a meeting).
   */
  habitIds?: string[];
}

/** What the user's habit data looked like on the day they checked in. */
export interface ChallengeCheckInEvidence {
  date: string;
  habitsCompleted: number;
  habitsTotal: number;
}

export interface ChallengeRun {
  id: string;
  /** Client-generated stable key. `chl_` prefixed so challenge runs are greppable. */
  campaignKey: string;
  templateId: string;
  title: string;
  description: string;
  icon: string;
  category: ChallengeCategory;
  status: ChallengeRunStatus;
  ownerUserId: string;
  cadence: 'daily' | 'weekly';
  /** Local date-only strings, `YYYY-MM-DD`. */
  startsOn: string;
  endsOn: string;
  timezone: string;
  terms: ChallengeTerms;
  /** Date-only strings the user has checked in on. Unique, ascending. */
  checkIns: string[];
  /**
   * Habit data captured at each check-in, frozen so a later habit edit cannot
   * rewrite history. Optional because runs created before this existed won't
   * have it.
   */
  evidence?: ChallengeCheckInEvidence[];
  outcome: 'pending' | 'success' | 'failure' | 'void';
  createdAt: string;
  completedAt?: string;

  // ---- Partnered runs -----------------------------------------------------
  /**
   * Everyone taking part, owner first. A solo run has exactly one.
   * Solo vs partnered is decided by this length and nothing else.
   */
  participants?: ChallengeParticipant[];
  /** Baserow row ids, so an update knows what to PATCH. Absent for local runs. */
  rowId?: number;
  participantRowId?: number;

  /**
   * What the owner put up. Frozen at start. Habiti records it and never holds
   * or moves anything — see pledge.models.ts.
   */
  pledge?: ChallengePledge;
}

export type ChallengeInviteStatus = 'invited' | 'accepted' | 'declined' | 'left';

export interface ChallengeParticipant {
  userId: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  isOwner: boolean;
  inviteStatus: ChallengeInviteStatus;
  /** Their check-in dates — visible to the other side, which is the point. */
  checkIns: string[];
  rowId?: number;
}

/** A run nobody else is in. */
export function isSolo(run: ChallengeRun): boolean {
  return (run.participants?.length ?? 1) <= 1;
}

/** The other person on a two-party run, if there is one. */
export function partnerOf(run: ChallengeRun, meUserId: string): ChallengeParticipant | undefined {
  return (run.participants ?? []).find(p => p.userId !== String(meUserId));
}

/** True while a partner has been invited but has not answered. */
export function awaitingPartner(run: ChallengeRun): boolean {
  return (run.participants ?? []).some(p => !p.isOwner && p.inviteStatus === 'invited');
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Resolves a template's tier, synthesizing one from `baseLevelValue` and the
 * difficulty meta when the template doesn't spell it out. Lets a template
 * author specify only a base value and still get three coherent tiers.
 */
export function resolveTier(
  template: ChallengeTemplate,
  difficulty: ChallengeDifficulty
): ChallengeTier {
  const explicit = template.tiers[difficulty];
  if (explicit) return explicit;

  const meta = CHALLENGE_DIFFICULTY_META[difficulty];
  return {
    levelValue: Math.max(1, Math.round(template.baseLevelValue * meta.levelMultiplier)),
    targetPerPeriod: 1,
    requiredPassRate: meta.requiredPassRate,
    graceMisses: meta.graceMisses,
    blurb: meta.description
  };
}

export function levelValueFor(
  template: ChallengeTemplate,
  difficulty: ChallengeDifficulty
): number {
  return resolveTier(template, difficulty).levelValue;
}

/** Number of check-in periods a run has, given its cadence and duration. */
export function periodsFor(template: ChallengeTemplate): number {
  return template.cadence === 'weekly'
    ? Math.max(1, Math.round(template.durationDays / 7))
    : template.durationDays;
}

export function buildChallengeTerms(
  template: ChallengeTemplate,
  difficulty: ChallengeDifficulty,
  habitIds: string[] = []
): ChallengeTerms {
  const tier = resolveTier(template, difficulty);
  return {
    difficulty,
    levelValue: tier.levelValue,
    targetPerPeriod: tier.targetPerPeriod,
    requiredPassRate: tier.requiredPassRate,
    graceMisses: tier.graceMisses,
    periodsTotal: periodsFor(template),
    habitIds: habitIds.length ? [...habitIds] : undefined
  };
}

/** Every date the run covers, oldest first — the columns of the progress grid. */
export function runDates(run: ChallengeRun): string[] {
  const dates: string[] = [];
  const total = Math.max(0, daysBetween(run.startsOn, run.endsOn));
  for (let i = 0; i <= total; i++) dates.push(addDays(run.startsOn, i));
  return dates;
}

/**
 * Date keys now live in utils/date-key.util.ts — they are general-purpose and
 * had nothing to do with challenges. Re-exported here so the many existing
 * importers keep working; new code should import the util directly.
 */
export { addDays, daysBetween, parseDateKey, toDateKey };

export interface ChallengeProgress {
  periodsTotal: number;
  periodsPassed: number;
  /** Elapsed periods the user did not check in for. */
  periodsMissed: number;
  periodsRemaining: number;
  percent: number;
  checkedInToday: boolean;
  daysElapsed: number;
  isPastEnd: boolean;
  /**
   * True when the run has earned its completion — enough check-ins, and the
   * run has actually run its course. Guards against starting a 30-day
   * challenge and claiming it thirty seconds later.
   */
  canComplete: boolean;
}

export function challengeProgress(run: ChallengeRun, today: string = toDateKey()): ChallengeProgress {
  const { periodsTotal, requiredPassRate, graceMisses } = run.terms;

  const elapsed = Math.max(0, daysBetween(run.startsOn, today) + 1);
  const daysElapsed = Math.min(elapsed, periodsTotal);
  const periodsPassed = run.checkIns.length;

  /**
   * A day can only be MISSED once it is over.
   *
   * Counting today as missed failed people mid-morning: on day 2 of a Hard run
   * you have one check-in and two elapsed days, so `elapsed - passed` was 1 —
   * over the zero-miss allowance — and the run died before you had a chance to
   * check in. Only days strictly before today count.
   */
  const pastDays = Math.min(Math.max(0, daysBetween(run.startsOn, today)), periodsTotal);
  const checkInsBeforeToday = run.checkIns.filter(date => date < today).length;
  const periodsMissed = Math.max(0, pastDays - checkInsBeforeToday);
  // On-or-after the final day. A 7-day run that ends on day 7 must be
  // claimable on day 7, not day 8.
  const isPastEnd = daysBetween(today, run.endsOn) <= 0;

  const requiredCheckIns = Math.ceil(periodsTotal * requiredPassRate);

  return {
    periodsTotal,
    periodsPassed,
    periodsMissed,
    periodsRemaining: Math.max(0, periodsTotal - periodsPassed),
    percent: periodsTotal > 0 ? Math.round((periodsPassed / periodsTotal) * 100) : 0,
    checkedInToday: run.checkIns.includes(today),
    daysElapsed,
    isPastEnd,
    // Both conditions matter: enough check-ins AND enough real time. Either
    // alone lets a user claim a 30-day challenge in an afternoon.
    canComplete:
      run.status === 'active' &&
      periodsPassed >= requiredCheckIns &&
      (isPastEnd || periodsPassed >= periodsTotal) &&
      periodsMissed <= graceMisses
  };
}

/** True once the run can no longer reach its required pass rate. */
export function hasFailed(run: ChallengeRun, today: string = toDateKey()): boolean {
  if (run.status !== 'active') return false;
  const progress = challengeProgress(run, today);
  if (progress.periodsMissed > run.terms.graceMisses) return true;

  const stillPossible = progress.periodsPassed + progress.periodsRemaining;
  const required = Math.ceil(run.terms.periodsTotal * run.terms.requiredPassRate);
  return progress.isPastEnd && stillPossible < required;
}

// ---------------------------------------------------------------------------
// Baserow row shape for the template catalogue
//
// The bundled seed remains the fallback. A row here overrides it by `template_id`,
// so the table can be empty and everything still works.
// ---------------------------------------------------------------------------

export interface ChallengeTemplateRow {
  id: number;
  template_id: string;
  title: string;
  description?: string;
  icon?: string;
  category?: string | { value: string };
  duration_days?: number;
  cadence?: string | { value: string };
  base_level_value?: number;
  tiers_json?: string;
  min_tier?: string | { value: string };
  allows_partner?: boolean;
  sort_index?: number;
  active?: boolean;
}

function unwrapSelect(value: string | { value: string } | undefined): string {
  if (!value) return '';
  return typeof value === 'object' ? value.value : value;
}

export function toChallengeTemplate(row: ChallengeTemplateRow): ChallengeTemplate {
  let tiers: ChallengeTemplate['tiers'] = {};
  try {
    tiers = row.tiers_json ? JSON.parse(row.tiers_json) : {};
  } catch {
    // A malformed tiers blob must not take the catalogue down — resolveTier()
    // synthesizes coherent tiers from baseLevelValue instead.
    tiers = {};
  }

  const category = unwrapSelect(row.category) as ChallengeCategory;

  return {
    id: row.template_id || String(row.id),
    title: row.title ?? '',
    description: row.description ?? '',
    icon: row.icon || '🏆',
    category: category in CHALLENGE_CATEGORY_META ? category : 'discipline',
    durationDays: Math.max(1, row.duration_days ?? 7),
    cadence: unwrapSelect(row.cadence) === 'weekly' ? 'weekly' : 'daily',
    baseLevelValue: Math.max(1, row.base_level_value ?? 1),
    tiers,
    minTier: unwrapSelect(row.min_tier) === 'plus' ? 'plus' : 'free',
    allowsPartner: row.allows_partner === true,
    sortIndex: row.sort_index ?? 0,
    active: row.active !== false
  };
}

export function fromChallengeTemplate(t: ChallengeTemplate): Record<string, unknown> {
  return {
    template_id: t.id,
    title: t.title,
    description: t.description,
    icon: t.icon,
    category: t.category,
    duration_days: t.durationDays,
    cadence: t.cadence,
    base_level_value: t.baseLevelValue,
    tiers_json: JSON.stringify(t.tiers ?? {}),
    min_tier: t.minTier,
    allows_partner: t.allowsPartner,
    sort_index: t.sortIndex,
    active: t.active
  };
}

/** Rows override the bundled seed by template id; the rest of the seed remains. */
export function mergeTemplates(
  seed: ChallengeTemplate[],
  rows: ChallengeTemplate[]
): ChallengeTemplate[] {
  const byId = new Map(seed.map(t => [t.id, t]));
  for (const row of rows) byId.set(row.id, row);
  return [...byId.values()].sort((a, b) => a.sortIndex - b.sortIndex);
}
