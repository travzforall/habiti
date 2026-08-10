import { Injectable, InjectionToken, computed, effect, inject, signal } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, distinctUntilChanged, map } from 'rxjs/operators';
import { SYNC_SESSION } from './sync-session';
import { SyncBus } from './sync-bus';
import { RealtimeService } from './realtime.service';
import { SYNC_REFRESHERS, SyncContext } from './sync-refresher';
import { TabBus } from './tab-bus';
import { UserStorage } from '@habiti/storage';
import { RefreshScope, RelayEnvelope, scopesFor } from '@habiti/realtime-protocol';
import { toDateKey } from '@habiti/util';

/** Injected so tests can drive time without fighting zone.js. */
export interface TimerPort {
  setInterval(handler: () => void, ms: number): number;
  clearInterval(handle: number): void;
  now(): number;
}

export const TIMER_PORT = new InjectionToken<TimerPort>('TIMER_PORT', {
  providedIn: 'root',
  factory: () => ({
    setInterval: (h, ms) => window.setInterval(h, ms),
    clearInterval: h => window.clearInterval(h),
    now: () => Date.now()
  })
});

export type SyncTrigger =
  | 'boot'
  | 'auth'
  | 'interval'
  | 'focus'
  | 'online'
  | 'realtime'
  | 'mutation'
  | 'manual'
  | 'day-rollover';

const HOT_WINDOW_MS = 90_000;
const HOT_INTERVAL_MS = 10_000;
const IDLE_INTERVAL_MS = 60_000;
/** Push is doing the work; poll rarely just in case an event was missed. */
const LIVE_INTERVAL_MS = 120_000;
/** A refocus closer than this to the last sync is ignored, so alt-tabbing isn't a storm. */
const REFOCUS_FLOOR_MS = 5_000;

/**
 * The one owner of "when do we reload".
 *
 * Nothing in this app refreshed itself before: every service loaded once on
 * construct, so a friend's invite or a partner's check-in was invisible until
 * you reloaded the page.
 *
 * Deliberately does NOT toast. It refreshes signals; NotificationsService
 * derives the toast from those signals and already de-dupes. A second toast
 * source would produce doubles.
 */
@Injectable({ providedIn: 'root' })
export class SyncService {
  private session = inject(SYNC_SESSION);
  private bus = inject(SyncBus);
  private timer = inject(TIMER_PORT);

  private realtime = inject(RealtimeService);
  private tabs = inject(TabBus);
  private userStorage = inject(UserStorage);

  /**
   * Every domain that can be reloaded, registered by the features themselves.
   *
   * Empty is legitimate — a host that provides no refreshers still gets working
   * cadence, tab coordination and connection state, it simply has nothing to
   * reload. See provideSyncRefreshers() for this app's set.
   */
  private refreshers = inject(SYNC_REFRESHERS, { optional: true }) ?? [];

  private readonly _isOnline = signal(navigator.onLine);
  private readonly _isVisible = signal(!document.hidden);
  private readonly _isSyncing = signal(false);
  private readonly _lastSyncAt = signal<Date | null>(null);
  private readonly _lastError = signal<string | null>(null);
  private readonly _hotUntil = signal(0);
  private readonly _today = signal(toDateKey());

  readonly isOnline = this._isOnline.asReadonly();
  readonly isSyncing = this._isSyncing.asReadonly();
  readonly lastSyncAt = this._lastSyncAt.asReadonly();
  readonly lastError = this._lastError.asReadonly();

  /**
   * Something is waiting on someone else, so poll fast.
   * The hot window is what makes "I just accepted — did they see it?" feel
   * immediate even with no realtime connection.
   */
  readonly hasPending = computed(() => {
    if (this.timer.now() < this._hotUntil()) return true;
    return this.refreshers.some(refresher => refresher.hasPending?.() ?? false);
  });

  /** Paused (0) means the timer is torn down, not merely skipped. */
  readonly currentIntervalMs = computed(() => {
    if (!this._isVisible() || !this._isOnline()) return 0;
    // With push working, polling is only a safety net.
    if (this.realtime.isLive()) return LIVE_INTERVAL_MS;
    return this.hasPending() ? HOT_INTERVAL_MS : IDLE_INTERVAL_MS;
  });

  readonly isLive = this.realtime.isLive;

  readonly connectionLabel = computed<'live' | 'synced' | 'syncing' | 'offline'>(() => {
    if (!this._isOnline()) return 'offline';
    if (this._isSyncing()) return 'syncing';
    return this.realtime.isLive() ? 'live' : 'synced';
  });

  private handle: number | null = null;
  private inFlight: Promise<void> | null = null;
  private queued = new Set<RefreshScope>();

  constructor() {
    // One interval, rebuilt whenever the cadence changes. Not rxjs `interval`,
    // because the period itself changes and rebuilding a pipeline each time is
    // more code than one clearInterval.
    effect(() => {
      const ms = this.currentIntervalMs();
      if (this.handle !== null) {
        this.timer.clearInterval(this.handle);
        this.handle = null;
      }
      if (ms > 0) {
        this.handle = this.timer.setInterval(() => this.syncNow('interval'), ms);
      }
    });

    this.listen();
    this.watchAuth();

    this.bus.mutations$.subscribe(scope => {
      this._hotUntil.set(this.timer.now() + HOT_WINDOW_MS);
      void this.syncNow('mutation', [scope]);
    });

    // A pushed hint: refresh only what it names, and tell sibling tabs so one
    // socket serves the whole browser.
    this.realtime.events$.subscribe(envelope => {
      this.tabs.post({ type: 'realtime', envelope });
      this.applyEnvelope(envelope);
    });

    this.tabs.messages$.subscribe(message => {
      if (message.type === 'realtime') this.applyEnvelope(message.envelope);
      else if (message.type === 'refresh') void this.syncNow('realtime', message.scopes);
      else if (message.type === 'auth') this.reset();
    });
  }

  /**
   * Refreshes the given scopes, or everything.
   *
   * Overlapping calls never stack: a request arriving mid-flight has its scopes
   * folded into a queued set and drains in one follow-up pass.
   */
  syncNow(trigger: SyncTrigger, scopes?: RefreshScope[]): Promise<void> {
    if (!this.session.currentUserId()) return Promise.resolve();
    if (!this._isOnline()) return Promise.resolve();

    const requested = scopes ?? this.allScopes();

    if (this.inFlight) {
      requested.forEach(s => this.queued.add(s));
      return this.inFlight;
    }

    const isFull = !scopes;
    this._isSyncing.set(true);

    this.inFlight = this.run(requested, isFull)
      .then(() => {
        this._lastSyncAt.set(new Date());
        this._lastError.set(null);
        if (trigger !== 'realtime') {
          this.tabs.post({
            type: 'refresh',
            scopes: requested,
            nonce: `${this.timer.now()}-${Math.random().toString(36).slice(2, 8)}`
          });
        }
      })
      .catch(err => {
        this._lastError.set(String(err?.message ?? err));
      })
      .finally(() => {
        this.inFlight = null;
        this._isSyncing.set(false);

        if (this.queued.size > 0) {
          const next = [...this.queued];
          this.queued.clear();
          void this.syncNow(trigger, next);
        }
      });

    return this.inFlight;
  }

  private applyEnvelope(envelope: RelayEnvelope): void {
    const scopes = scopesFor(envelope);
    if (scopes.length === 0) return;
    this._hotUntil.set(this.timer.now() + HOT_WINDOW_MS);
    void this.syncNow('realtime', scopes);
  }

  /** Opens the hot window without forcing an immediate pass. */
  markHot(): void {
    this._hotUntil.set(this.timer.now() + HOT_WINDOW_MS);
  }

  reset(): void {
    // Storage is namespaced per account, so the migration bookkeeping has to be
    // re-evaluated for whoever signs in next. Before the refreshers, because the
    // locally-cached ones re-read storage as they reset.
    this.userStorage.resetMigrationState();

    for (const refresher of this.refreshers) refresher.reset?.();

    this._lastSyncAt.set(null);
    this._lastError.set(null);
  }

  private allScopes(): RefreshScope[] {
    return [...new Set(this.refreshers.flatMap(refresher => refresher.scopes))];
  }

  private run(scopes: RefreshScope[], reconcile: boolean): Promise<void> {
    const wanted = new Set(scopes);
    const context: SyncContext = { scopes: wanted, reconcile };
    const calls: Observable<void>[] = [];

    for (const refresher of this.refreshers) {
      if (!refresher.scopes.some(scope => wanted.has(scope))) continue;
      if (refresher.canRun && !refresher.canRun()) continue;
      // A synchronous re-read returns nothing and is already done by here.
      const pending = refresher.refresh(context);
      if (pending) calls.push(pending);
    }

    if (calls.length === 0) return Promise.resolve();

    return new Promise((resolve, reject) => {
      forkJoin(calls)
        .pipe(
          map(() => undefined),
          catchError(err => {
            console.warn('SyncService: a refresh failed.', err);
            return of(undefined);
          })
        )
        .subscribe({ next: () => resolve(), error: reject });
    });
  }

  private listen(): void {
    document.addEventListener('visibilitychange', () => {
      const visible = !document.hidden;
      this._isVisible.set(visible);
      if (!visible) return;

      this.realtime.nudge();
      this.checkDayRollover();

      // A 5s floor: alt-tabbing between two windows must not become a request
      // storm, but a genuine return after a while syncs immediately.
      const last = this._lastSyncAt()?.getTime() ?? 0;
      if (this.timer.now() - last > REFOCUS_FLOOR_MS) void this.syncNow('focus');
    });

    window.addEventListener('online', () => {
      this._isOnline.set(true);
      this.realtime.nudge();
      void this.syncNow('online');
    });

    window.addEventListener('offline', () => this._isOnline.set(false));
  }

  /**
   * A tab left open overnight computed check-in state against yesterday,
   * because services freeze their date at construction. One clock owner lives
   * here rather than a second timer in each service.
   */
  private checkDayRollover(): void {
    const today = toDateKey();
    if (today === this._today()) return;

    this._today.set(today);
    for (const refresher of this.refreshers) refresher.onDayRollover?.(today);
    void this.syncNow('day-rollover');
  }

  /**
   * Services construct on the login page with no user: FriendsService no-ops
   * and the others would load under 'default'. Login navigates by router with
   * no page reload, so without this they are never loaded for the real user.
   */
  private watchAuth(): void {
    this.session.userId$
      .pipe(distinctUntilChanged())
      .subscribe(userId => {
        this.reset();
        this.tabs.post({ type: 'auth', userId });

        if (!userId) {
          this.realtime.disconnect();
          return;
        }

        void this.syncNow('auth');
        const token = this.session.token();
        if (token) {
          this.realtime.connect(token);
        } else {
          // Signed in with no token is a real fault, not a quiet fallback: this
          // window can never publish, so the other side never hears from it.
          console.warn(
            'SyncService: signed in but no auth token found — realtime is off for this window. ' +
              'Sign out and back in.'
          );
        }
      });
  }
}
