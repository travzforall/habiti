import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { BaserowService } from './baserow.service';
import { HabitsService } from './habits';
import { StatusService } from './status.service';
import { ToastService } from './toast.service';
import {
  LevelAward,
  LevelRecord,
  LevelRecordRow,
  fromLevelRecord,
  reviveLevelRecord,
  toLevelRecord
} from '../models/level.models';
import {
  byOccurredAtDesc,
  findChainBreaks,
  groupByMonth,
  levelBand,
  levelFromRecords,
  levelsToNextBand,
  sumBySource,
  withLevelChain
} from '../utils/level-derivation.util';

const RECORDS_KEY = 'habiti-level-records';
const LEVEL_CACHE_KEY = 'habiti-level-cache';
const LEGACY_GAMESTATE_KEY = 'habiti-gamestate';

/**
 * Owns the user's level.
 *
 * Level is the sum of an append-only ledger, never a stored counter. Points
 * moved it before and no longer do — that is now HabitsService's business
 * alone, and it pushes nothing back here.
 *
 * Dependency direction is one-way by design (see the note in status.service.ts):
 * LevelService imports HabitsService and StatusService and pushes into them.
 * Neither imports this. ChallengeService will import this. No cycles.
 */
@Injectable({ providedIn: 'root' })
export class LevelService {
  private auth = inject(AuthService);
  private baserow = inject(BaserowService);
  private habits = inject(HabitsService);
  private status = inject(StatusService);
  private toast = inject(ToastService);

  private readonly tableId = environment.baserow.tables.levelRecords;

  private readonly _records = signal<LevelRecord[]>(this.loadCachedRecords());
  private readonly _loading = signal(false);
  private readonly _migrated = signal(false);
  /** True once the ledger has been fetched (or determined to be local-only). */
  private readonly _ledgerLoaded = signal(false);
  /** Awards made while there is no table id; flushed once one appears. */
  private readonly _pending = signal<LevelRecord[]>([]);

  readonly loading = this._loading.asReadonly();

  /** Newest first — the order the history popup renders. */
  readonly records = computed(() => [...this._records()].sort(byOccurredAtDesc));
  readonly level = computed(() => levelFromRecords(this._records()));
  readonly recordCount = computed(() => this._records().length);
  readonly lastAward = computed<LevelRecord | null>(() => this.records()[0] ?? null);
  readonly historySections = computed(() => groupByMonth(this.records()));

  readonly band = computed(() => levelBand(this.level()));
  readonly toNextBand = computed(() => levelsToNextBand(this.level()));
  readonly levelsFromChallenges = computed(() => sumBySource(this._records(), 'challenge'));

  /** Non-empty when the ledger does not add up — surfaces a tamper warning. */
  readonly chainBreaks = computed(() => findChainBreaks(this._records()));

  constructor() {
    // Push, never pull: HabitsService must not know this service exists.
    effect(() => this.habits.setLevel(this.level()));

    // Migration needs BOTH the ledger and the user's habit data, and habits
    // arrive asynchronously from Baserow. Reading gameState at construction
    // would see zeros and silently migrate nothing, stranding an existing
    // user at level 1. So watch for both to land instead.
    effect(() => {
      if (!this._ledgerLoaded()) return;
      const gameState = this.habits.gameState();
      const habitsLoaded = this.habits.habits().length > 0;
      const looksUnloaded = !habitsLoaded && gameState.totalPoints === 0 && (gameState.level ?? 1) <= 1;
      if (looksUnloaded) return;
      this.ensureMigrated();
    });

    this.load();
  }

  /**
   * Idempotency keys of awards written but not yet acknowledged.
   *
   * Without this, a background refresh landing between the optimistic append
   * and the HTTP response replaces _records with server rows that do not
   * include the new award — the optimistic row is wiped, the remap below
   * matches nothing, and the level silently drops back.
   */
  private readonly _awardsInFlight = new Set<string>();

  hasAwardsInFlight(): boolean {
    return this._awardsInFlight.size > 0;
  }

  refresh(): Observable<void> {
    return new Observable<void>(observer => {
      this.load(() => {
        observer.next();
        observer.complete();
      });
    });
  }

  reset(): void {
    this._records.set([]);
    this._pending.set([]);
    this._ledgerLoaded.set(false);
    this._migrated.set(false);
    this._awardsInFlight.clear();
  }

  load(done?: () => void): void {
    if (!this.tableId) {
      console.warn(
        'LevelService: baserow.tables.levelRecords is 0, levels are local-only until the table exists.'
      );
      // The localStorage cache read in the field initializer IS the ledger in
      // this mode, so it is already as loaded as it will get.
      this._ledgerLoaded.set(true);
      done?.();
      return;
    }

    this._loading.set(true);
    this.baserow
      .listAllRows<LevelRecordRow>(this.tableId, {
        filters: [{ field: 'user_id', op: 'equal', value: this.userId() }],
        orderBy: 'occurred_at'
      })
      .subscribe({
        next: rows => {
          const server = (rows ?? []).map(toLevelRecord);

          // Merge, never replace: keep any optimistic award still in flight
          // that the server has not returned yet, or a poll mid-write makes
          // the user's level visibly drop and then jump back.
          const serverKeys = new Set(server.map(r => r.idempotencyKey));
          const stillPending = this._records().filter(
            r => this._awardsInFlight.has(r.idempotencyKey) && !serverKeys.has(r.idempotencyKey)
          );

          this._records.set(withLevelChain([...server, ...stillPending]));
          this.cacheRecords();
          this._loading.set(false);
          this._ledgerLoaded.set(true);
          this.flushPending();
          done?.();
        },
        error: err => {
          // Keep whatever was cached rather than showing level 1 to someone
          // who has earned more. Deliberately do NOT mark the ledger loaded —
          // migrating against an unknown ledger could double-award on the next
          // successful fetch.
          console.warn('LevelService: could not load the ledger, using cached records.', err);
          this._loading.set(false);
          done?.();
        }
      });
  }

  hasAward(idempotencyKey: string): boolean {
    return this._records().some(r => r.idempotencyKey === idempotencyKey);
  }

  /**
   * Appends one award. Rejects anything below 1 level — the ledger only ever
   * goes up, and a negative row could only be corruption.
   */
  award(input: LevelAward): Observable<LevelRecord | null> {
    const levels = Math.floor(input.levels);
    if (!Number.isFinite(levels) || levels < 1) {
      console.warn('LevelService: refusing an award below 1 level.', input);
      return of(null);
    }

    // Checked synchronously against the in-memory ledger before any HTTP, so a
    // double-tap is caught. A genuine network race can still slip through.
    if (this.hasAward(input.idempotencyKey)) return of(null);

    const levelBefore = this.level();
    const record: LevelRecord = {
      id: `local-${input.idempotencyKey}`,
      userId: this.userId(),
      source: input.source,
      levelsAwarded: levels,
      levelBefore,
      levelAfter: levelBefore + levels,
      reason: input.reason,
      detail: input.detail,
      refType: input.refType ?? 'none',
      refKey: input.refKey,
      refId: input.refId,
      icon: input.icon,
      idempotencyKey: input.idempotencyKey,
      occurredAt: input.occurredAt ?? new Date()
    };

    // Optimistic: the user sees the level move immediately.
    this.appendLocal(record);
    this.celebrate(record);

    if (!this.tableId) {
      this._pending.update(queue => [...queue, record]);
      return of(record);
    }

    this._awardsInFlight.add(record.idempotencyKey);

    const { id, ...withoutId } = record;
    return this.baserow.createRow<LevelRecordRow>(this.tableId, fromLevelRecord(withoutId)).pipe(
      map(row => {
        this._awardsInFlight.delete(record.idempotencyKey);
        if (!row) return record;
        const saved = toLevelRecord(row);
        this._records.update(rs => rs.map(r => (r.id === record.id ? saved : r)));
        this.cacheRecords();
        return saved;
      }),
      catchError(err => {
        this._awardsInFlight.delete(record.idempotencyKey);
        // The optimistic record stands and gets queued for a later flush —
        // losing an earned level to a flaky network would be worse.
        console.warn('LevelService: award not persisted, queued for retry.', err);
        this._pending.update(queue => [...queue, record]);
        return of(record);
      })
    );
  }

  /**
   * Carries an existing user's points-derived level onto the ledger, once.
   *
   * Takes the max of three sources because each can be stale in a different
   * direction: the Baserow column holds real values even though nothing writes
   * it, totalPoints may have decayed since, and localStorage may hold the
   * highest-ever. Levels only go up, so max is the safe reducer.
   */
  private ensureMigrated(): void {
    if (this._migrated()) return;
    this._migrated.set(true);

    if (this._records().length > 0) return;

    const gameState = this.habits.gameState();
    const fromPoints = Math.floor((gameState.totalPoints || 0) / 100) + 1;
    const legacy = Math.max(1, gameState.level || 1, fromPoints, this.legacyLocalLevel());

    if (legacy <= 1) return;

    this.award({
      source: 'migration',
      levels: legacy - 1,
      reason: 'Carried over from points earned before levels became permanent.',
      detail: `You were level ${legacy} under the old points system. That level is now yours for good.`,
      icon: '🎁',
      refType: 'none',
      refKey: 'legacy-points',
      idempotencyKey: `${this.userId()}:migration:legacy-points`
    }).subscribe();
  }

  /** Writes any queued awards once a real table id is available. */
  private flushPending(): void {
    const queue = this._pending();
    if (!this.tableId || queue.length === 0) return;

    const items = queue.map(({ id, ...rest }) => fromLevelRecord(rest));
    this.baserow.batchCreateRows<LevelRecordRow>(this.tableId, items).subscribe({
      next: () => {
        this._pending.set([]);
        this.load();
      },
      error: err => console.warn('LevelService: could not flush queued awards.', err)
    });
  }

  private celebrate(record: LevelRecord): void {
    // Migration is bookkeeping, not an achievement — it stays silent.
    if (record.source === 'migration') return;

    this.status.celebrate();
    this.toast.success(
      `Level ${record.levelAfter}!`,
      record.levelsAwarded > 1
        ? `+${record.levelsAwarded} levels — ${record.reason}`
        : record.reason,
      { duration: 7000 }
    );
  }

  private appendLocal(record: LevelRecord): void {
    this._records.update(rs => withLevelChain([...rs, record]));
    this.cacheRecords();
  }

  /**
   * The ledger is per-user, so this has to be the real Xano user id.
   *
   * It deliberately does NOT read localStorage['userId'] first: nothing in the
   * app ever writes that key, so it always fell through to 'default' and every
   * user would have shared one ledger. The legacy key is only a last resort so
   * records written before this fix are not orphaned.
   */
  private userId(): string {
    const id = this.auth.currentUserValue?.id;
    if (id !== undefined && id !== null) return String(id);

    try {
      return localStorage.getItem('userId') || 'default';
    } catch {
      return 'default';
    }
  }

  private cacheRecords(): void {
    try {
      localStorage.setItem(RECORDS_KEY, JSON.stringify(this._records()));
      localStorage.setItem(
        LEVEL_CACHE_KEY,
        JSON.stringify({ level: this.level(), recordCount: this.recordCount() })
      );
    } catch {
      // Cache is an optimisation; the ledger is still the truth on next load.
    }
  }

  private loadCachedRecords(): LevelRecord[] {
    try {
      const raw = localStorage.getItem(RECORDS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as LevelRecord[];
      return Array.isArray(parsed) ? parsed.map(reviveLevelRecord) : [];
    } catch {
      return [];
    }
  }

  /** The level held by the old localStorage gameState, if any. */
  private legacyLocalLevel(): number {
    try {
      const raw = localStorage.getItem(LEGACY_GAMESTATE_KEY);
      if (!raw) return 1;
      const parsed = JSON.parse(raw) as { level?: number; totalPoints?: number };
      return Math.max(parsed.level ?? 1, Math.floor((parsed.totalPoints ?? 0) / 100) + 1);
    } catch {
      return 1;
    }
  }
}
