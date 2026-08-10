/**
 * New-user onboarding state.
 *
 * One row per user in Baserow table 26, plus a localStorage mirror. The mirror
 * is not a nicety: `BaserowService.skip()` emits an EMPTY RESULT SET rather than
 * throwing when the table id is 0 or the token is missing, and an empty result
 * is byte-identical to "this user has no row" — which means "show the wizard".
 * Without a mirror, an unreachable backend shows the wizard on every load,
 * forever, to everyone.
 *
 * Hence the central rule, enforced in OnboardingService and asserted in its
 * spec: ONLY A GENUINE HTTP 200 MAY CONCLUDE `pending`.
 *
 * Users live in Xano, not Baserow (see database-schemas/00-import-order.md), so
 * `user_id` is a plain text column holding `String(user.id)` — never a link
 * field. That is the same convention tables 15-22 and level_records use.
 */

/**
 * Wizard state.
 *
 * `pending` is never written to Baserow — the ABSENCE of a row is what pending
 * means. Storing it would make "no row" and "row saying pending" two ways to
 * express one thing, and the backfill for existing users depends on absence.
 */
export type OnboardingStatus = 'pending' | 'skipped' | 'completed';

export type GuideStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';

export type ThemeChoice = 'light' | 'dark' | 'auto';

export type DifficultyChoice = 'easy' | 'medium' | 'hard';

/**
 * What the wizard collects.
 *
 * Deliberately short. Every field here has a real consumer — theme drives
 * `habiti-theme`, difficulty drives `habiti-default-difficulty`, focus areas
 * filter the starter-habit step. `GameState.weekStartsOn`, `soundEnabled` and
 * `notificationsEnabled` were considered and rejected: nothing in the app reads
 * them, so asking would have been decoration.
 */
export interface OnboardingPreferences {
  displayName?: string;
  /** Library category ids: fitness | health | mind | work | life. Empty = all. */
  focusAreas: string[];
  theme: ThemeChoice;
  defaultDifficulty: DifficultyChoice;
}

/**
 * The defaults the Skip path writes.
 *
 * Deliberately identical to what the app already does with no onboarding at
 * all, so that skipping changes nothing observable. If you change a default
 * here, check it still matches the app's un-onboarded behaviour.
 */
export const DEFAULT_PREFERENCES: OnboardingPreferences = Object.freeze({
  focusAreas: Object.freeze([]) as unknown as string[],
  theme: 'auto',
  defaultDifficulty: 'medium'
});

/**
 * A fresh, mutable copy of the defaults.
 *
 * Always use this rather than spreading DEFAULT_PREFERENCES: a spread is
 * shallow, so the copy would share the same `focusAreas` array and the first
 * `push` would mutate the module constant for the whole app.
 */
export function defaultPreferences(): OnboardingPreferences {
  return { ...DEFAULT_PREFERENCES, focusAreas: [] };
}

/**
 * Bump to legitimately re-show a redesigned wizard to users who already
 * completed the old one. Nothing reads it yet; it exists so that decision does
 * not require a data migration later.
 */
export const WIZARD_VERSION = 1;

/** Same idea for the guide. */
export const GUIDE_VERSION = 1;

/** App-domain shape (camelCase, real arrays) — mirrors level.models.ts. */
export interface OnboardingState {
  /** Baserow row id. Null until the row has been created. */
  rowId: number | null;
  userId: string;
  status: OnboardingStatus;
  wizardVersion: number;
  preferences: OnboardingPreferences;
  /** Library ids of habits the wizard actually created. */
  starterHabits: string[];
  guideStatus: GuideStatus;
  guideVersion: number;
  guideStepIndex: number;
  /** TourStep ids already shown. */
  guideStepsSeen: string[];
  /** Route keys whose first-visit tip has been shown. */
  pageTipsSeen: string[];
  completedAt?: Date;
}

/** Baserow row shape (numeric id, snake_case, JSON-in-long_text). */
export interface OnboardingRow {
  id: number;
  user_id: string;
  status: string;
  wizard_version?: number;
  preferences?: string;
  starter_habits?: string;
  guide_status?: string;
  guide_version?: number;
  guide_step_index?: number;
  guide_steps_seen?: string;
  page_tips_seen?: string;
  completed_at?: string;
  updated_at?: string;
}

/** A brand-new user's state — the shape `pending` takes in memory. */
export function emptyOnboardingState(userId: string): OnboardingState {
  return {
    rowId: null,
    userId,
    status: 'pending',
    wizardVersion: WIZARD_VERSION,
    preferences: defaultPreferences(),
    starterHabits: [],
    guideStatus: 'not_started',
    guideVersion: GUIDE_VERSION,
    guideStepIndex: 0,
    guideStepsSeen: [],
    pageTipsSeen: []
  };
}

/**
 * Parses a JSON blob out of a long_text column.
 *
 * Baserow columns are free text, and a hand-edit in the Baserow UI is entirely
 * possible, so malformed JSON is a real case rather than a theoretical one.
 * Returning the fallback beats throwing: a corrupt preferences blob should cost
 * the user their theme choice, not lock them out of the app.
 */
function parseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : (parsed as T);
  } catch {
    return fallback;
  }
}

function parseStringArray(raw: string | undefined): string[] {
  const parsed = parseJson<unknown>(raw, []);
  return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
}

/**
 * An unrecognised status resolves to `completed`, NOT `pending`.
 *
 * This is the fail-safe direction. A row exists, so this user has been through
 * onboarding at some point; if the value is garbage, the worst outcome of
 * guessing `completed` is that they miss a wizard they have already seen, while
 * guessing `pending` re-nags someone who is already set up.
 */
function toStatus(raw: string | undefined): OnboardingStatus {
  return raw === 'pending' || raw === 'skipped' ? raw : 'completed';
}

function toGuideStatus(raw: string | undefined): GuideStatus {
  return raw === 'in_progress' || raw === 'completed' || raw === 'skipped' ? raw : 'not_started';
}

export function toOnboardingState(row: OnboardingRow): OnboardingState {
  const prefs = parseJson<Partial<OnboardingPreferences>>(row.preferences, {});

  return {
    rowId: row.id,
    userId: row.user_id,
    status: toStatus(row.status),
    wizardVersion: row.wizard_version ?? WIZARD_VERSION,
    preferences: {
      displayName: prefs.displayName,
      focusAreas: Array.isArray(prefs.focusAreas) ? prefs.focusAreas : [],
      theme: prefs.theme ?? DEFAULT_PREFERENCES.theme,
      defaultDifficulty: prefs.defaultDifficulty ?? DEFAULT_PREFERENCES.defaultDifficulty
    },
    starterHabits: parseStringArray(row.starter_habits),
    guideStatus: toGuideStatus(row.guide_status),
    guideVersion: row.guide_version ?? GUIDE_VERSION,
    guideStepIndex: row.guide_step_index ?? 0,
    guideStepsSeen: parseStringArray(row.guide_steps_seen),
    pageTipsSeen: parseStringArray(row.page_tips_seen),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined
  };
}

/** The write shape. `id` is omitted — Baserow assigns it. */
export function fromOnboardingState(state: OnboardingState): Record<string, unknown> {
  return {
    user_id: state.userId,
    status: state.status,
    wizard_version: state.wizardVersion,
    preferences: JSON.stringify(state.preferences),
    starter_habits: JSON.stringify(state.starterHabits),
    guide_status: state.guideStatus,
    guide_version: state.guideVersion,
    guide_step_index: state.guideStepIndex,
    guide_steps_seen: JSON.stringify(state.guideStepsSeen),
    page_tips_seen: JSON.stringify(state.pageTipsSeen),
    completed_at: state.completedAt?.toISOString(),
    updated_at: new Date().toISOString()
  };
}

/**
 * Restores a state object parsed out of localStorage.
 *
 * JSON.parse gives back a string where a Date belongs, which then fails on
 * `.toISOString()` at the next write. Mirrors `reviveLevelRecord`.
 */
export function reviveOnboardingState(raw: OnboardingState): OnboardingState {
  return {
    ...emptyOnboardingState(raw.userId),
    ...raw,
    preferences: { ...defaultPreferences(), ...(raw.preferences ?? {}) },
    starterHabits: raw.starterHabits ?? [],
    guideStepsSeen: raw.guideStepsSeen ?? [],
    pageTipsSeen: raw.pageTipsSeen ?? [],
    completedAt: raw.completedAt ? new Date(raw.completedAt) : undefined
  };
}
