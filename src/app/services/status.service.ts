import { Injectable, computed, inject, signal } from '@angular/core';
import { HabitsService } from './habits';
import {
  DerivedStatus,
  STATUS_COLOR,
  STATUS_EMOJI,
  STATUS_LABEL,
  UserStatus,
  deriveStatus
} from '../utils/status-derivation.util';

export interface StatusSnapshot extends DerivedStatus {
  source: 'manual' | 'derived';
  since: Date;
  label: string;
  emoji: string;
  color: string;
}

export interface SleepWindow {
  startHour: number;
  endHour: number;
}

/**
 * What the avatar circle shows.
 * - `character`: the animated status character fills the circle
 * - `photo`: the user's profile picture, with status carried by the ring alone
 */
export type AvatarDisplayMode = 'character' | 'photo';

interface ManualOverride {
  status: UserStatus;
  /** Epoch ms after which the override lapses; null means until cleared. */
  expiresAt: number | null;
}

const MANUAL_KEY = 'habiti-status-override';
const SLEEP_KEY = 'habiti-sleep-window';
const DISPLAY_KEY = 'habiti-avatar-display';
const DEFAULT_DISPLAY: AvatarDisplayMode = 'character';
const DEFAULT_SLEEP: SleepWindow = { startHour: 22, endHour: 6 };
const CELEBRATION_MS = 6000;
/** How often the clock signal ticks, so time-of-day transitions happen on their own. */
const TICK_MS = 60_000;

/**
 * Resolves what the user is currently "doing" into a single status, which the
 * avatar renders. Derived from habit data by default; a manual override always
 * wins until it expires.
 */
@Injectable({ providedIn: 'root' })
export class StatusService {
  private habitsService = inject(HabitsService);

  private readonly _manual = signal<ManualOverride | null>(this.loadManual());
  private readonly _sleepWindow = signal<SleepWindow>(this.loadSleepWindow());
  private readonly _focusActive = signal(false);
  private readonly _celebratingUntil = signal(0);
  /** Ticks every minute so time-based statuses re-evaluate without user input. */
  private readonly _now = signal(new Date());

  /**
   * Campaign pressure. Wired up in a later phase — CampaignsService will push
   * its attention count here rather than this service importing it, which would
   * make the two mutually dependent.
   */
  private readonly _campaignAttention = signal(0);

  private readonly _displayMode = signal<AvatarDisplayMode>(this.loadDisplayMode());

  readonly sleepWindow = this._sleepWindow.asReadonly();
  readonly displayMode = this._displayMode.asReadonly();
  readonly manualOverride = computed(() => this._manual()?.status ?? null);

  readonly snapshot = computed<StatusSnapshot>(() => {
    const now = this._now();
    const manual = this._manual();

    if (manual && (manual.expiresAt === null || manual.expiresAt > now.getTime())) {
      return this.decorate(
        {
          status: manual.status,
          intensity: manual.status === 'sleeping' ? 0.15 : 0.6,
          reason: 'Status set manually.'
        },
        'manual',
        now
      );
    }

    const summary = this.habitsService.getTodaysHabitSummary();

    return this.decorate(
      deriveStatus({
        completedToday: summary.completed,
        totalToday: summary.total,
        overallProgress: this.habitsService.getOverallProgress(),
        dailyStreak: this.habitsService.gameState().dailyStreak,
        campaignAttention: this._campaignAttention(),
        focusSessionActive: this._focusActive(),
        celebrating: this._celebratingUntil() > now.getTime(),
        sleepWindow: this._sleepWindow(),
        now
      }),
      'derived',
      now
    );
  });

  readonly status = computed<UserStatus>(() => this.snapshot().status);

  constructor() {
    setInterval(() => this._now.set(new Date()), TICK_MS);
  }

  /**
   * Pin a status regardless of habit data. `ttlMinutes` of 0 or undefined means
   * it holds until explicitly cleared.
   */
  setStatus(status: UserStatus, ttlMinutes?: number): void {
    const override: ManualOverride = {
      status,
      expiresAt: ttlMinutes ? Date.now() + ttlMinutes * 60_000 : null
    };
    this._manual.set(override);
    this._now.set(new Date());
    this.persist(MANUAL_KEY, override);
  }

  clearStatus(): void {
    this._manual.set(null);
    this._now.set(new Date());
    try {
      localStorage.removeItem(MANUAL_KEY);
    } catch {
      // Storage unavailable (private mode); the in-memory clear still applies.
    }
  }

  setSleepWindow(window: SleepWindow): void {
    this._sleepWindow.set(window);
    this.persist(SLEEP_KEY, window);
  }

  /** Switch the avatar between the animated character and the profile photo. */
  setDisplayMode(mode: AvatarDisplayMode): void {
    this._displayMode.set(mode);
    this.persist(DISPLAY_KEY, mode);
  }

  setFocusActive(active: boolean): void {
    this._focusActive.set(active);
    this._now.set(new Date());
  }

  /** Fires the transient celebration burst — level-ups, milestones, campaign wins. */
  celebrate(): void {
    this._celebratingUntil.set(Date.now() + CELEBRATION_MS);
    this._now.set(new Date());
    setTimeout(() => this._now.set(new Date()), CELEBRATION_MS + 100);
  }

  /** Called by CampaignsService so campaign pressure can raise the 'atRisk' status. */
  setCampaignAttention(count: number): void {
    this._campaignAttention.set(count);
  }

  private decorate(derived: DerivedStatus, source: 'manual' | 'derived', now: Date): StatusSnapshot {
    return {
      ...derived,
      source,
      since: now,
      label: STATUS_LABEL[derived.status],
      emoji: STATUS_EMOJI[derived.status],
      color: STATUS_COLOR[derived.status]
    };
  }

  private persist(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Non-fatal: the status still works for this session.
    }
  }

  private loadManual(): ManualOverride | null {
    try {
      const raw = localStorage.getItem(MANUAL_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as ManualOverride;
      if (parsed.expiresAt !== null && parsed.expiresAt <= Date.now()) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private loadDisplayMode(): AvatarDisplayMode {
    try {
      const raw = localStorage.getItem(DISPLAY_KEY);
      const parsed = raw ? (JSON.parse(raw) as AvatarDisplayMode) : null;
      return parsed === 'photo' || parsed === 'character' ? parsed : DEFAULT_DISPLAY;
    } catch {
      return DEFAULT_DISPLAY;
    }
  }

  private loadSleepWindow(): SleepWindow {
    try {
      const raw = localStorage.getItem(SLEEP_KEY);
      return raw ? { ...DEFAULT_SLEEP, ...JSON.parse(raw) } : DEFAULT_SLEEP;
    } catch {
      return DEFAULT_SLEEP;
    }
  }
}
