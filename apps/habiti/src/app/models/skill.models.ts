/**
 * A user's skill track.
 *
 * Deliberately thin. A track stores a status, a start date, the highest tier
 * CLAIMED, frozen evidence for each claim, and four lists of ids pointing at
 * things that already exist. Everything shown on screen — practice days,
 * streaks, cumulative volume, what to do next — is derived from habit entries,
 * tasks, projects and campaigns at read time.
 *
 * That is what stops Skills becoming a second tracking system: there is no
 * counter to increment, so there is nothing to drift out of agreement with the
 * habit data it is describing.
 */

export type SkillTrackStatus = 'active' | 'paused' | 'completed' | 'abandoned';

/** How the user chose to pursue it. `campaignKeys` is the actual record. */
export type SkillMode = 'solo' | 'campaign';

/**
 * What the record showed at the moment a tier was claimed.
 *
 * Frozen for the same reason `ChallengeCheckInEvidence` is: a habit edited or
 * deleted later must not rewrite history, and a tier already earned must never
 * silently un-earn itself.
 */
export interface SkillTierClaim {
  tier: number;
  claimedAt: string;
  evidence: { label: string; have: number; need: number }[];
}

export interface SkillTrack {
  /** Baserow row id as a string while saved; a local `skl_` key before that. */
  id: string;
  /** Client-generated stable key, `skl_` prefixed so it is greppable. */
  skillKey: string;
  /** Catalogue slug. */
  skillId: string;
  userId: string;
  status: SkillTrackStatus;
  mode: SkillMode;
  /**
   * Date-only, `YYYY-MM-DD`. Requirements are evaluated FROM here — without
   * the clamp, starting a skill would hand you three tiers off past history.
   */
  startedAt: string;
  /** Highest tier CLAIMED. 0 means started, nothing claimed yet. */
  tier: number;
  claims: SkillTierClaim[];

  // --- bindings: the whole join surface, all ids of things that already exist
  /** The user's REAL habit ids, same contract as ChallengeTerms.habitIds. */
  habitIds: string[];
  /** Catalogue key -> the created task's id. */
  taskRefs: { key: string; taskId: string }[];
  projectRefs: { key: string; projectId: string }[];
  /** ChallengeRun.campaignKey values started for this skill. */
  campaignKeys: string[];

  updatedAt: string;
  completedAt?: string;
  /** Baserow row id, for PATCH. Absent while local-only. */
  rowId?: number;
}

// ---------------------------------------------------------------------------
// Baserow row shape
// ---------------------------------------------------------------------------

export interface BaserowSelectCell {
  id: number;
  value: string;
}

export interface SkillTrackRow {
  id: number;
  skill_key?: string;
  skill_id?: string;
  user_id?: string;
  status?: string | BaserowSelectCell;
  mode?: string | BaserowSelectCell;
  started_at?: string | null;
  completed_at?: string | null;
  tier?: number | string | null;
  /** JSON blob: habitIds, taskRefs, projectRefs, campaignKeys. */
  bindings?: string;
  /** JSON blob: SkillTierClaim[]. */
  claims?: string;
}

function cell(value: string | BaserowSelectCell | undefined | null): string {
  if (!value) return '';
  return typeof value === 'object' ? value.value : value;
}

/**
 * Parses a Baserow date as LOCAL midnight and returns a date-only string.
 *
 * `new Date('2026-08-09')` is midnight UTC, which is the previous day west of
 * Greenwich — a start date one day early silently shifts every requirement.
 */
export function toDateOnly(value: string | null | undefined): string {
  if (!value) return '';
  return value.split('T')[0];
}

function parseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return (parsed ?? fallback) as T;
  } catch {
    // A malformed blob must not take the whole track down with it.
    return fallback;
  }
}

const STATUSES: SkillTrackStatus[] = ['active', 'paused', 'completed', 'abandoned'];

export function toSkillTrack(row: SkillTrackRow): SkillTrack {
  const bindings = parseJson<Partial<SkillTrack>>(row.bindings, {});
  const status = cell(row.status) as SkillTrackStatus;

  return {
    id: String(row.id),
    rowId: row.id,
    skillKey: row.skill_key || `skl_${row.id}`,
    skillId: row.skill_id || '',
    userId: row.user_id || '',
    status: STATUSES.includes(status) ? status : 'active',
    mode: cell(row.mode) === 'campaign' ? 'campaign' : 'solo',
    startedAt: toDateOnly(row.started_at),
    completedAt: row.completed_at ? String(row.completed_at) : undefined,
    tier: Number(row.tier ?? 0) || 0,
    claims: parseJson<SkillTierClaim[]>(row.claims, []),
    habitIds: bindings.habitIds ?? [],
    taskRefs: bindings.taskRefs ?? [],
    projectRefs: bindings.projectRefs ?? [],
    campaignKeys: bindings.campaignKeys ?? [],
    updatedAt: new Date().toISOString()
  };
}

export function fromSkillTrack(track: SkillTrack, userId: string): Record<string, unknown> {
  return {
    skill_key: track.skillKey,
    skill_id: track.skillId,
    user_id: userId,
    status: track.status,
    mode: track.mode,
    started_at: track.startedAt || null,
    completed_at: track.completedAt ?? null,
    tier: track.tier,
    // One blob rather than four columns: these are read and written together,
    // and versioning a blob is cheaper than migrating columns.
    bindings: JSON.stringify({
      habitIds: track.habitIds,
      taskRefs: track.taskRefs,
      projectRefs: track.projectRefs,
      campaignKeys: track.campaignKeys
    }),
    claims: JSON.stringify(track.claims)
  };
}

/** A fresh track. `startedAt` is local-date, never a UTC ISO string. */
export function newSkillTrack(
  skillId: string,
  userId: string,
  mode: SkillMode,
  today: Date = new Date()
): SkillTrack {
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');

  return {
    id: `skl_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    skillKey: `skl_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    skillId,
    userId,
    status: 'active',
    mode,
    startedAt: `${y}-${m}-${d}`,
    tier: 0,
    claims: [],
    habitIds: [],
    taskRefs: [],
    projectRefs: [],
    campaignKeys: [],
    updatedAt: new Date().toISOString()
  };
}
