import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { BaserowService } from './baserow.service';
import { HabitsService } from './habits';
import {
  GuideStatus,
  OnboardingPreferences,
  OnboardingRow,
  OnboardingState,
  defaultPreferences,
  emptyOnboardingState,
  fromOnboardingState,
  reviveOnboardingState,
  toOnboardingState
} from '../models/onboarding.models';

const MIRROR_KEY_PREFIX = 'habiti-onboarding';

/** Debounce for guide-progress writes, so a fast click-through is one PATCH. */
const PROGRESS_DEBOUNCE_MS = 1200;

/**
 * How the app decides whether a user has been onboarded.
 *
 * `unavailable` is the whole point of this type. `BaserowService.skip()` emits
 * an EMPTY RESULT SET rather than throwing when the table id is 0 or the token
 * is missing, and an empty result is byte-identical to "this user has no row" —
 * which means "show the wizard". Collapsing the two into a boolean shows the
 * wizard on every load, forever, to everyone, the moment Baserow is unreachable.
 *
 * The rule, enforced below and asserted in the spec:
 * ONLY A GENUINE HTTP 200 MAY CONCLUDE `pending`.
 */
export type LoadState = 'idle' | 'loading' | 'loaded' | 'unavailable';

/** Routes where the wizard must never appear, even with a stale cached user. */
const SUPPRESSED_ROUTES = ['/login', '/register'];

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private auth = inject(AuthService);
  private baserow = inject(BaserowService);
  private habits = inject(HabitsService);

  private readonly tableId = environment.baserow.tables.userOnboarding;

  private readonly _state = signal<OnboardingState | null>(null);
  private readonly _loadState = signal<LoadState>('idle');
  /** True while the wizard is on screen, so page tips stay quiet. */
  private readonly _wizardOpen = signal(false);
  /** Set once the wizard has been dismissed this session, however it ended. */
  private readonly _dismissedThisSession = signal(false);

  private progressTimer: ReturnType<typeof setTimeout> | null = null;
  private lastUserId: string | null = null;

  /** AuthService exposes a BehaviorSubject, so bridge it to a signal. */
  private readonly currentUser = toSignal(this.auth.currentUser, { initialValue: null });

  readonly state = this._state.asReadonly();
  readonly loadState = this._loadState.asReadonly();
  readonly wizardOpen = this._wizardOpen.asReadonly();

  readonly preferences = computed<OnboardingPreferences>(
    () => this._state()?.preferences ?? defaultPreferences()
  );

  readonly guideStatus = computed<GuideStatus>(() => this._state()?.guideStatus ?? 'not_started');
  readonly guideStepIndex = computed(() => this._state()?.guideStepIndex ?? 0);
  readonly pageTipsSeen = computed(() => this._state()?.pageTipsSeen ?? []);

  /**
   * Whether to ask this user to pick starter habits.
   *
   * Backfilling existing users means someone with thirty habits can land in the
   * wizard, and asking them to choose their first three is nonsense. Derived
   * from habit count rather than account age because that is what the question
   * actually depends on.
   */
  readonly mode = computed<'new' | 'returning'>(() =>
    this.habits.habits().length > 0 ? 'returning' : 'new'
  );

  /**
   * True once we can trust `mode()`.
   *
   * Habits arrive asynchronously, so an un-awaited empty list reads as 'new'
   * and would show an established user the starter-habit step. The wizard host
   * waits for this before opening.
   */
  readonly modeSettled = computed(() => this.habits.dataLoaded());

  /** True when the wizard should be on screen right now. */
  readonly shouldOpen = computed(() => {
    if (this._dismissedThisSession()) return false;

    const load = this._loadState();
    // 'idle'/'loading' deliberately render nothing — this is what guarantees
    // the wizard can never flash before the real answer is known.
    if (load === 'idle' || load === 'loading') return false;

    if (!this.auth.isAuthenticated()) return false;
    if (SUPPRESSED_ROUTES.some(route => window.location.pathname.startsWith(route))) return false;

    const state = this._state();
    if (!state) return false;
    if (state.status !== 'pending') return false;

    // Baserow unreachable AND nothing mirrored locally. Falling back to "never
    // show" would mean a genuine new user is never onboarded, so lean on the
    // app's existing first-run signal instead. Worst case a returning user on a
    // wiped browser sees the wizard once.
    if (load === 'unavailable' && state.rowId === null) {
      // Wait for the habit fetch before reading emptiness as "brand new".
      return this.habits.dataLoaded() && this.habits.habits().length === 0;
    }

    return true;
  });

  constructor() {
    // Mirrors SyncService's watchAuth: react to the user ID changing, not to
    // object identity, or every /me refresh would re-trigger a load.
    effect(() => {
      const user = this.currentUser();
      const userId = user ? String(user.id) : null;

      if (userId === this.lastUserId) return;
      this.lastUserId = userId;

      if (!userId) {
        this.reset();
        return;
      }

      this.load(userId);
    });
  }

  reset(): void {
    this._state.set(null);
    this._loadState.set('idle');
    this._dismissedThisSession.set(false);
    this._wizardOpen.set(false);
    this.flushProgressTimer();
  }

  load(userId: string): void {
    // Read the mirror synchronously so a returning user's completed state is
    // known before first paint — no network round-trip can produce a flash.
    const mirrored = this.readMirror(userId);

    if (!this.tableId) {
      console.warn(
        'OnboardingService: baserow.tables.userOnboarding is 0, onboarding state is local-only until the table exists.'
      );
      this._state.set(mirrored ?? emptyOnboardingState(userId));
      this._loadState.set('unavailable');
      return;
    }

    this._state.set(mirrored ?? emptyOnboardingState(userId));
    this._loadState.set('loading');

    this.baserow
      .listRows<OnboardingRow>(this.tableId, {
        filters: [{ field: 'user_id', op: 'equal', value: userId }]
      })
      .subscribe({
        next: response => {
          const rows = response?.results ?? [];

          // Baserow cannot enforce uniqueness, so a double-POST race can leave
          // two rows. Take the newest and leave the orphan — a duplicate
          // onboarding row is harmless.
          const row = rows.length
            ? rows.reduce((newest, candidate) => (candidate.id > newest.id ? candidate : newest))
            : null;

          if (row) {
            const server = toOnboardingState(row);
            this._state.set(server);
            this.writeMirror(server);
          } else {
            // A real 200 with no row. This is the ONLY path that may conclude
            // pending, and it is what makes the existing-user backfill work.
            this._state.set(mirrored?.rowId ? mirrored : emptyOnboardingState(userId));
          }

          this._loadState.set('loaded');
          this.flushPending();
        },
        error: err => {
          // Keep the mirror rather than assuming a fresh user. An outage must
          // never re-onboard somebody who is already set up.
          console.warn('OnboardingService: could not load onboarding state, using mirror.', err);
          this._loadState.set('unavailable');
        }
      });
  }

  setWizardOpen(open: boolean): void {
    this._wizardOpen.set(open);
  }

  /** Finish the wizard with the user's choices. */
  complete(input: {
    preferences: OnboardingPreferences;
    starterHabits: string[];
    launchGuide: boolean;
  }): void {
    this._dismissedThisSession.set(true);
    this.patch(current => ({
      ...current,
      status: 'completed',
      preferences: input.preferences,
      starterHabits: input.starterHabits,
      guideStatus: input.launchGuide ? 'not_started' : 'skipped',
      completedAt: new Date()
    }));
  }

  /**
   * Accept every default and move on.
   *
   * Deliberately leaves `guideStatus: 'not_started'` rather than 'skipped':
   * skipping *setup* is not declining the *tour*, and a user who skipped is
   * precisely the one who benefits from being shown around.
   */
  skip(): void {
    this._dismissedThisSession.set(true);
    this.patch(current => ({
      ...current,
      status: 'skipped',
      preferences: defaultPreferences(),
      starterHabits: [],
      guideStatus: 'not_started',
      completedAt: new Date()
    }));
  }

  /** Reopen the wizard from Settings without discarding stored preferences. */
  replayWizard(): void {
    this._dismissedThisSession.set(false);
    this._state.update(current =>
      current ? { ...current, status: 'pending' } : current
    );
  }

  setGuideStatus(status: GuideStatus, stepIndex = 0): void {
    this.patch(current => ({ ...current, guideStatus: status, guideStepIndex: stepIndex }));
  }

  /**
   * Records tour progress.
   *
   * Debounced because a user holding Next would otherwise fire one PATCH per
   * step. The mirror is written immediately either way, so a reload mid-debounce
   * still resumes in the right place.
   */
  recordGuideProgress(stepIndex: number, stepId: string): void {
    this._state.update(current => {
      if (!current) return current;

      const seen = current.guideStepsSeen.includes(stepId)
        ? current.guideStepsSeen
        : [...current.guideStepsSeen, stepId];

      const next: OnboardingState = {
        ...current,
        guideStatus: 'in_progress',
        guideStepIndex: stepIndex,
        guideStepsSeen: seen
      };

      this.writeMirror(next);
      return next;
    });

    this.flushProgressTimer();
    this.progressTimer = setTimeout(() => {
      this.progressTimer = null;
      this.persist();
    }, PROGRESS_DEBOUNCE_MS);
  }

  /** Terminal guide states are written straight through, never debounced. */
  finishGuide(reason: 'finished' | 'skipped'): void {
    this.flushProgressTimer();
    this.patch(current => ({
      ...current,
      guideStatus: reason === 'finished' ? 'completed' : 'skipped',
      guideStepIndex: -1
    }));
  }

  hasSeenPageTip(routeKey: string): boolean {
    return this.pageTipsSeen().includes(routeKey);
  }

  markPageTipSeen(routeKey: string): void {
    if (this.hasSeenPageTip(routeKey)) return;
    this.patch(current => ({
      ...current,
      pageTipsSeen: [...current.pageTipsSeen, routeKey]
    }));
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  /** Update in memory, mirror immediately, then push to Baserow. */
  private patch(update: (current: OnboardingState) => OnboardingState): void {
    const current = this._state();
    if (!current) return;

    const next = update(current);
    this._state.set(next);
    this.writeMirror(next);
    this.persist();
  }

  private persist(): void {
    const state = this._state();
    if (!state || !this.tableId) return;

    const payload = fromOnboardingState(state);

    if (state.rowId != null) {
      this.baserow.updateRow<OnboardingRow>(this.tableId, state.rowId, payload).subscribe({
        error: err =>
          console.warn('OnboardingService: onboarding update failed, mirror retained.', err)
      });
      return;
    }

    this.baserow.createRow<OnboardingRow>(this.tableId, payload).subscribe({
      next: row => {
        if (!row?.id) return;
        // Capture the assigned id so the next write is an update, not a second
        // insert. Re-reads state rather than closing over it, since a guide
        // step may have advanced while this was in flight.
        this._state.update(current => {
          if (!current) return current;
          const withId = { ...current, rowId: row.id };
          this.writeMirror(withId);
          return withId;
        });
      },
      error: err =>
        console.warn('OnboardingService: onboarding create failed, mirror retained.', err)
    });
  }

  /** Push a locally-recorded state up once a real table id exists. */
  private flushPending(): void {
    const state = this._state();
    if (!state || !this.tableId) return;
    if (state.status === 'pending' || state.rowId != null) return;

    this.persist();
  }

  private flushProgressTimer(): void {
    if (this.progressTimer === null) return;
    clearTimeout(this.progressTimer);
    this.progressTimer = null;
  }

  private mirrorKey(userId: string): string {
    return `${MIRROR_KEY_PREFIX}-${userId}`;
  }

  private readMirror(userId: string): OnboardingState | null {
    try {
      const raw = localStorage.getItem(this.mirrorKey(userId));
      if (!raw) return null;
      return reviveOnboardingState(JSON.parse(raw) as OnboardingState);
    } catch {
      return null;
    }
  }

  private writeMirror(state: OnboardingState): void {
    try {
      localStorage.setItem(this.mirrorKey(state.userId), JSON.stringify(state));
    } catch {
      // Private browsing or a full quota. Baserow is still the record; the only
      // cost is a possible wizard flash on the next load.
    }
  }
}
