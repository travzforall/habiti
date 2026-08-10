/**
 * All level math, as pure functions.
 *
 * Lives outside any service for the same reason `status-derivation.util.ts`
 * does: it is the single source of truth for a calculation that used to be
 * duplicated (level was computed three different ways — habits.ts, dashboard.ts
 * and top-nav.ts — with two different divisors), and it can be unit tested
 * without instantiating Angular.
 */

export const BASE_LEVEL = 1;

export type LevelSource =
  | 'challenge'
  | 'streak'
  | 'achievement'
  | 'habit_milestone'
  | 'manual'
  | 'migration';

export type LevelRefType = 'campaign' | 'habit' | 'achievement' | 'none';

/** The minimum shape the math needs — the full record lives in level.models.ts. */
export interface LevelRecordLike {
  id: string;
  levelsAwarded: number;
  levelBefore: number;
  levelAfter: number;
  occurredAt: Date;
  source: LevelSource;
}

// ---------------------------------------------------------------------------
// Level from the ledger
// ---------------------------------------------------------------------------

/**
 * The user's level: 1 plus everything they have ever been awarded.
 *
 * Negative awards are ignored rather than subtracted — levels are permanent by
 * design, and a negative row can only be corruption or a forgery.
 */
export function levelFromRecords(records: Pick<LevelRecordLike, 'levelsAwarded'>[]): number {
  return records.reduce(
    (level, record) => level + Math.max(0, Math.floor(record.levelsAwarded || 0)),
    BASE_LEVEL
  );
}

/** The level the user was at immediately before `at`. */
export function levelAsOf(records: LevelRecordLike[], at: Date): number {
  return levelFromRecords(records.filter(r => r.occurredAt.getTime() <= at.getTime()));
}

/**
 * Recomputes `levelBefore`/`levelAfter` across the whole ledger in
 * chronological order. Used by the migration and to repair a chain whose
 * denormalized values have drifted.
 */
export function withLevelChain<T extends LevelRecordLike>(records: T[]): T[] {
  const chronological = [...records].sort(byOccurredAtAsc);
  let running = BASE_LEVEL;

  return chronological.map(record => {
    const awarded = Math.max(0, Math.floor(record.levelsAwarded || 0));
    const levelBefore = running;
    running += awarded;
    return { ...record, levelsAwarded: awarded, levelBefore, levelAfter: running };
  });
}

/**
 * Indices (into the chronologically sorted ledger) where the chain does not
 * add up — either a record's own arithmetic is wrong, or it does not continue
 * from the previous record. Powers the tamper banner.
 *
 * This detects accidents and casual forgery. It cannot stop someone who
 * recomputes the whole chain, because they hold the same API token we do.
 */
export function findChainBreaks(records: LevelRecordLike[]): number[] {
  const chronological = [...records].sort(byOccurredAtAsc);
  const breaks: number[] = [];
  let expected = BASE_LEVEL;

  chronological.forEach((record, index) => {
    if (record.levelBefore !== expected) breaks.push(index);
    else if (record.levelAfter !== record.levelBefore + record.levelsAwarded) breaks.push(index);
    expected = record.levelAfter;
  });

  return breaks;
}

export function sumBySource(records: LevelRecordLike[], source: LevelSource): number {
  return records
    .filter(r => r.source === source)
    .reduce((total, r) => total + Math.max(0, r.levelsAwarded), 0);
}

// ---------------------------------------------------------------------------
// Bands
// ---------------------------------------------------------------------------

export type LevelBand = 'novice' | 'steady' | 'committed' | 'relentless' | 'legendary';

export interface LevelBandMeta {
  id: LevelBand;
  label: string;
  icon: string;
  color: string;
  minLevel: number;
}

/**
 * Bands exist because a single challenge can award tens of levels, so the raw
 * number inflates fast. The UI leads with the band name and treats the number
 * as secondary, which keeps "level 137" reading as a milestone rather than as a
 * broken counter.
 */
export const LEVEL_BAND_META: Record<LevelBand, LevelBandMeta> = {
  novice: { id: 'novice', label: 'Novice', icon: '🌱', color: '#94a3b8', minLevel: 1 },
  steady: { id: 'steady', label: 'Steady', icon: '🌿', color: '#3b82f6', minLevel: 10 },
  committed: { id: 'committed', label: 'Committed', icon: '🔥', color: '#8b5cf6', minLevel: 25 },
  relentless: { id: 'relentless', label: 'Relentless', icon: '⚡', color: '#f59e0b', minLevel: 50 },
  legendary: { id: 'legendary', label: 'Legendary', icon: '👑', color: '#ec4899', minLevel: 100 }
};

export function levelBand(level: number): LevelBand {
  if (level >= LEVEL_BAND_META.legendary.minLevel) return 'legendary';
  if (level >= LEVEL_BAND_META.relentless.minLevel) return 'relentless';
  if (level >= LEVEL_BAND_META.committed.minLevel) return 'committed';
  if (level >= LEVEL_BAND_META.steady.minLevel) return 'steady';
  return 'novice';
}

/** Levels remaining until the next band, or null once legendary. */
export function levelsToNextBand(level: number): number | null {
  const ordered = [
    LEVEL_BAND_META.steady,
    LEVEL_BAND_META.committed,
    LEVEL_BAND_META.relentless,
    LEVEL_BAND_META.legendary
  ];
  const next = ordered.find(band => level < band.minLevel);
  return next ? next.minLevel - level : null;
}

// ---------------------------------------------------------------------------
// Grouping for the history popup
// ---------------------------------------------------------------------------

export interface LevelHistorySection<T> {
  monthLabel: string;
  records: T[];
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/** Groups newest-first into month buckets, preserving the order given. */
export function groupByMonth<T extends { occurredAt: Date }>(rows: T[]): LevelHistorySection<T>[] {
  const sections: LevelHistorySection<T>[] = [];

  for (const row of rows) {
    const label = `${MONTHS[row.occurredAt.getMonth()]} ${row.occurredAt.getFullYear()}`;
    const current = sections[sections.length - 1];
    if (current?.monthLabel === label) current.records.push(row);
    else sections.push({ monthLabel: label, records: [row] });
  }

  return sections;
}

export function byOccurredAtAsc(a: { occurredAt: Date }, b: { occurredAt: Date }): number {
  return a.occurredAt.getTime() - b.occurredAt.getTime();
}

export function byOccurredAtDesc(a: { occurredAt: Date }, b: { occurredAt: Date }): number {
  return b.occurredAt.getTime() - a.occurredAt.getTime();
}

// ---------------------------------------------------------------------------
// Challenge outcome
// ---------------------------------------------------------------------------

export interface RunEvaluationInput {
  periodsTotal: number;
  periodsPassed: number;
  periodsMissed: number;
  /** Fraction of periods that must pass, 0..1. */
  requiredPassRate: number;
  /** Misses forgiven before the run fails outright. */
  graceMisses: number;
}

export interface RunEvaluation {
  outcome: 'success' | 'failure' | 'pending';
  passRate: number;
}

/**
 * Decides whether a challenge run passed.
 *
 * Shared by the solo self-attest path and the partner-confirm path so the two
 * can never diverge on what "completed" means.
 */
export function evaluateRun(input: RunEvaluationInput): RunEvaluation {
  const { periodsTotal, periodsPassed, periodsMissed, requiredPassRate, graceMisses } = input;

  if (periodsTotal <= 0) return { outcome: 'pending', passRate: 0 };

  const passRate = periodsPassed / periodsTotal;

  // Blowing the grace allowance fails the run immediately, even if enough
  // periods remain to reach the required rate.
  if (periodsMissed > graceMisses) return { outcome: 'failure', passRate };

  const decided = periodsPassed + periodsMissed >= periodsTotal;
  if (!decided) return { outcome: 'pending', passRate };

  return { outcome: passRate >= requiredPassRate ? 'success' : 'failure', passRate };
}
