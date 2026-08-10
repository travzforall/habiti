/**
 * Pure helpers for turning raw habit numbers into a user-facing status.
 *
 * These live outside any service so they can be unit tested and so the three
 * places that previously each rolled their own streak-to-copy mapping
 * (dashboard, bottom nav, and now the status avatar) share one source of truth.
 */

import { DASHBOARD_CONFIG } from '../config/dashboard.config';

// ---------------------------------------------------------------------------
// Tiers
// ---------------------------------------------------------------------------

export type StreakTier = 'none' | 'starting' | 'building' | 'strong' | 'legendary';
export type DayProgressTier = 'none' | 'low' | 'partial' | 'most' | 'complete';
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

/** Maps a raw streak count onto a tier using the shared DASHBOARD_CONFIG milestones. */
export function streakTier(streak: number): StreakTier {
  const { streakMilestones } = DASHBOARD_CONFIG;
  if (streak >= streakMilestones.monthly) return 'legendary';
  if (streak >= streakMilestones.twoWeeks) return 'strong';
  if (streak >= streakMilestones.weekly) return 'building';
  if (streak >= streakMilestones.first) return 'starting';
  return 'none';
}

/** Maps today's completion ratio (0..1) onto a tier. */
export function dayProgressTier(completed: number, total: number): DayProgressTier {
  if (total <= 0) return 'none';
  const ratio = completed / total;
  if (ratio >= 1) return 'complete';
  if (ratio >= 0.66) return 'most';
  if (ratio >= 0.34) return 'partial';
  if (ratio > 0) return 'low';
  return 'none';
}

export function timeOfDay(date: Date = new Date()): TimeOfDay {
  const hour = date.getHours();
  if (hour < 5) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 22) return 'evening';
  return 'night';
}

/**
 * True when `date`'s local hour falls inside the user's sleep window.
 * Handles windows that wrap past midnight (the normal case, e.g. 22 -> 6).
 */
export function isWithinSleepWindow(startHour: number, endHour: number, date: Date = new Date()): boolean {
  const hour = date.getHours();
  if (startHour === endHour) return false;
  return startHour < endHour
    ? hour >= startHour && hour < endHour
    : hour >= startHour || hour < endHour;
}

// ---------------------------------------------------------------------------
// Status derivation
// ---------------------------------------------------------------------------

export type UserStatus =
  /** In the user's sleep window, or explicitly set. */
  | 'sleeping'
  /** High completion and a real streak — the "dancing" state. */
  | 'thriving'
  /** Doing fine, nothing remarkable. */
  | 'onTrack'
  /** A focus session is running. */
  | 'focused'
  /** Late in the day with little done. */
  | 'struggling'
  /** A campaign report is overdue, or a streak is about to break. */
  | 'atRisk'
  /** Transient burst after a level-up, milestone, or campaign win. */
  | 'celebrating'
  /** Default when there is nothing to say. */
  | 'idle';

/** Stable order — the Rive state machine's numeric `status` input indexes into this. */
export const USER_STATUS_ORDER: readonly UserStatus[] = [
  'idle',
  'sleeping',
  'onTrack',
  'thriving',
  'focused',
  'struggling',
  'atRisk',
  'celebrating'
] as const;

export function statusToRiveIndex(status: UserStatus): number {
  const index = USER_STATUS_ORDER.indexOf(status);
  return index === -1 ? 0 : index;
}

/** Emoji shown on the fallback badge when Rive is unavailable. */
export const STATUS_EMOJI: Record<UserStatus, string> = {
  sleeping: '😴',
  thriving: '🕺',
  onTrack: '🙂',
  focused: '🎯',
  struggling: '😮‍💨',
  atRisk: '⚠️',
  celebrating: '🎉',
  idle: '👋'
};

/** Ring colour for the fallback avatar, and the accent used in tooltips. */
export const STATUS_COLOR: Record<UserStatus, string> = {
  sleeping: '#6366f1',
  thriving: '#10b981',
  onTrack: '#3b82f6',
  focused: '#8b5cf6',
  struggling: '#f59e0b',
  atRisk: '#ef4444',
  celebrating: '#ec4899',
  idle: '#94a3b8'
};

export const STATUS_LABEL: Record<UserStatus, string> = {
  sleeping: 'Sleeping',
  thriving: 'Thriving',
  onTrack: 'On track',
  focused: 'Focused',
  struggling: 'Struggling',
  atRisk: 'At risk',
  celebrating: 'Celebrating',
  idle: 'Idle'
};

export interface StatusInputs {
  /** Habits completed today. */
  completedToday: number;
  /** Total habits tracked. */
  totalToday: number;
  /** Rolling 30-day completion rate, 0-100. */
  overallProgress: number;
  dailyStreak: number;
  /** Count of campaign items needing attention (overdue reports, disputes...). */
  campaignAttention: number;
  /** True while a focus/pomodoro session is running. */
  focusSessionActive: boolean;
  /** Set for a few seconds after a level-up or milestone. */
  celebrating: boolean;
  sleepWindow: { startHour: number; endHour: number };
  now: Date;
}

export interface DerivedStatus {
  status: UserStatus;
  /** 0..1 — how energetic the animation should be. */
  intensity: number;
  /** Short human explanation, shown on hover. */
  reason: string;
}

/**
 * Resolves the inputs to a single status.
 *
 * Precedence, highest first: celebrating, sleeping, focused, atRisk, thriving,
 * struggling, onTrack, idle. The order matters more than any single threshold —
 * "you have an overdue campaign report" should outrank "you had a good day".
 */
export function deriveStatus(inputs: StatusInputs): DerivedStatus {
  const {
    completedToday,
    totalToday,
    overallProgress,
    dailyStreak,
    campaignAttention,
    focusSessionActive,
    celebrating,
    sleepWindow,
    now
  } = inputs;

  const progress = dayProgressTier(completedToday, totalToday);
  const tier = streakTier(dailyStreak);
  const part = timeOfDay(now);
  const done = `${completedToday} of ${totalToday} habits done today`;

  if (celebrating) {
    return { status: 'celebrating', intensity: 1, reason: 'Nice work — that just unlocked something.' };
  }

  if (isWithinSleepWindow(sleepWindow.startHour, sleepWindow.endHour, now)) {
    return { status: 'sleeping', intensity: 0.15, reason: 'Resting up. Habits resume in the morning.' };
  }

  if (focusSessionActive) {
    return { status: 'focused', intensity: 0.7, reason: 'In a focus session — heads down.' };
  }

  if (campaignAttention > 0) {
    return {
      status: 'atRisk',
      intensity: 0.85,
      reason:
        campaignAttention === 1
          ? '1 campaign needs your attention.'
          : `${campaignAttention} campaigns need your attention.`
    };
  }

  if (totalToday === 0) {
    return { status: 'idle', intensity: 0.3, reason: 'No habits tracked yet — add one to get started.' };
  }

  if (progress === 'complete' || (progress === 'most' && tier !== 'none')) {
    const streakNote = tier === 'none' ? '' : `, ${dailyStreak}-day streak`;
    return { status: 'thriving', intensity: 1, reason: `${done}${streakNote}. Keep it rolling.` };
  }

  // Only call it struggling once there's been enough of the day to judge.
  const lateInDay = part === 'evening' || part === 'night';
  if (lateInDay && (progress === 'none' || progress === 'low')) {
    return {
      status: 'struggling',
      intensity: 0.4,
      reason: `${done}. Still time to close the gap.`
    };
  }

  if (progress === 'none' && overallProgress < 25) {
    return { status: 'idle', intensity: 0.3, reason: 'Nothing logged yet today.' };
  }

  return {
    status: 'onTrack',
    intensity: 0.55,
    reason: `${done}. Steady.`
  };
}
