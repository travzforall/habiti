import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { HabitsService } from './habits';
import { LevelService } from './level.service';
import { SubscriptionService } from './subscription.service';
import { ToastService } from './toast.service';
import {
  ChallengeRunRepository,
  LocalChallengeRunRepository
} from './challenge-run.repository';
import { BaserowChallengeRunRepository } from './baserow-challenge-run.repository';
import { BaserowService } from './baserow.service';
import { AuthService } from './auth.service';
import { SyncBus } from './sync-public-api';
import { environment } from '../../environments/environment';
import { CHALLENGE_CATALOGUE } from '../config/challenge-catalogue.seed';
import {
  ChallengePledge,
  ChallengeSettlement,
  SettlementRow,
  owesSettlement,
  toSettlement
} from '../models/pledge.models';
import {
  CHALLENGE_DIFFICULTY_META,
  ChallengeDifficulty,
  ChallengeRun,
  ChallengeTemplate,
  addDays,
  buildChallengeTerms,
  challengeProgress,
  hasFailed,
  ChallengeTemplateRow,
  fromChallengeTemplate,
  levelValueFor,
  mergeTemplates,
  parseDateKey,
  toChallengeTemplate,
  periodsFor,
  runDates,
  resolveTier,
  toDateKey
} from '../models/challenge.models';

const DIFFICULTY_KEY = 'habiti-default-difficulty';
const DEFAULT_DIFFICULTY: ChallengeDifficulty = 'medium';

/**
 * Solo challenges: browse the catalogue, start one at a chosen difficulty,
 * check in, and collect the levels.
 *
 * Awards go through LevelService so the ledger has one writer. When partnered
 * challenges land they use the same completion path — the only difference is
 * who is allowed to declare the outcome.
 */
@Injectable({ providedIn: 'root' })
export class ChallengeService {
  private levelService = inject(LevelService);
  private subscription = inject(SubscriptionService);
  private habitsService = inject(HabitsService);
  private auth = inject(AuthService);
  private baserow = inject(BaserowService);
  private toast = inject(ToastService);
  private bus = inject(SyncBus);

  /**
   * Baserow when the campaign tables exist, localStorage otherwise.
   *
   * This one line is the entire cost of unifying solo challenges with
   * partnered campaigns — a ChallengeRun is shaped like a campaigns row, so
   * switching repositories moves data, not logic.
   */
  private readonly baserowTables = {
    campaigns: environment.baserow.tables.campaigns,
    participants: environment.baserow.tables.campaignParticipants,
    reports: environment.baserow.tables.campaignReports
  };

  private readonly isShared =
    !!this.baserowTables.campaigns &&
    !!this.baserowTables.participants &&
    !!this.baserowTables.reports;

  private repository: ChallengeRunRepository = this.isShared
    ? new BaserowChallengeRunRepository(inject(BaserowService), this.baserowTables)
    : new LocalChallengeRunRepository();

  /**
   * The catalogue. Bundled seed by default; rows in the Baserow
   * `challenge_templates` table override it by template id, so the table can be
   * empty and the app still works.
   */
  private readonly _templates = signal<ChallengeTemplate[]>(CHALLENGE_CATALOGUE);
  readonly templates = this._templates.asReadonly();

  private readonly _runs = signal<ChallengeRun[]>([]);
  private readonly _defaultDifficulty = signal<ChallengeDifficulty>(this.loadDefaultDifficulty());
  private readonly _today = signal(toDateKey());

  readonly runs = this._runs.asReadonly();
  readonly defaultDifficulty = this._defaultDifficulty.asReadonly();

  readonly activeRuns = computed(() => this._runs().filter(r => r.status === 'active'));
  readonly finishedRuns = computed(() =>
    this._runs()
      .filter(r => r.status !== 'active')
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
  );

  /** Templates the user can see, with their resolved tier at the current default. */
  readonly catalogue = computed(() => {
    const difficulty = this._defaultDifficulty();
    const activeTemplateIds = new Set(this.activeRuns().map(r => r.templateId));

    return this._templates().filter(t => t.active)
      .filter(t => this.subscription.allows(t.minTier))
      .sort((a, b) => a.sortIndex - b.sortIndex)
      .map(template => ({
        template,
        tier: resolveTier(template, difficulty),
        levelValue: levelValueFor(template, difficulty),
        periods: periodsFor(template),
        inProgress: activeTemplateIds.has(template.id)
      }));
  });

  /** Active runs due a check-in today — what the dashboard would badge. */
  readonly needsCheckInToday = computed(() =>
    this.activeRuns().filter(run => !challengeProgress(run, this._today()).checkedInToday)
  );

  /**
   * How many habits the user actually completed today.
   *
   * A check-in is a claim; this is the evidence for it. Surfaced next to the
   * button so the claim is made against a real number rather than in a vacuum.
   */
  readonly habitsCompletedToday = computed(() => {
    const summary = this.habitsService.getTodaysHabitSummary();
    return { completed: summary.completed, total: summary.total };
  });

  /**
   * True when today's habit data backs up a check-in.
   *
   * Deliberately does NOT block the check-in. Challenges cover things Habiti
   * does not track as habits ("stayed clean", "went to the meeting"), so
   * refusing an unbacked check-in would make those challenges unusable. The
   * evidence is shown, and the claim is recorded either way — which is what
   * `self_attest` adjudication means.
   */
  isCheckInBacked(run: ChallengeRun): boolean {
    const bound = run.terms.habitIds ?? [];

    // A challenge bound to specific habits is judged on those alone.
    if (bound.length) {
      const today = new Date();
      const done = bound.filter(id => this.habitsService.isHabitCompletedOnDate(id, today)).length;
      return done >= Math.min(run.terms.targetPerPeriod, bound.length);
    }

    const { completed } = this.habitsCompletedToday();
    return completed >= run.terms.targetPerPeriod;
  }

  /**
   * Changes which habits a running challenge is measured against.
   *
   * Everything else in `terms` — especially `levelValue` — is left frozen. The
   * payout was agreed when the run started and must not move; only what the
   * grid tracks is editable.
   */
  setBoundHabits(runId: string, habitIds: string[]): Observable<ChallengeRun | null> {
    const run = this._runs().find(r => r.id === runId);
    if (!run) return of(null);

    const updated: ChallengeRun = {
      ...run,
      terms: { ...run.terms, habitIds: habitIds.length ? [...habitIds] : undefined }
    };

    return this.repository.save(updated).pipe(
      map(saved => {
        this.replace(saved);
        this.toast.success(
          'Habits updated',
          habitIds.length
            ? `${habitIds.length} habit(s) now tracked on ${saved.title}.`
            : 'Any habit now counts toward a check-in.'
        );
        return saved;
      })
    );
  }

  /** The habits a run is measured against, resolved to real habit objects. */
  boundHabits(run: ChallengeRun) {
    const ids = new Set(run.terms.habitIds ?? []);
    return this.habitsService.habits().filter(h => ids.has(h.id));
  }

  /**
   * The habit × date grid behind a run — one row per bound habit, one column
   * per day, plus whether the user checked in that day.
   *
   * Built from live habit entries rather than the frozen check-in evidence: the
   * evidence answers "what did they claim at the time", this answers "what does
   * the record show now". Both are useful; this is the one worth looking at.
   */
  progressGrid(run: ChallengeRun) {
    const dates = runDates(run);
    const today = toDateKey();
    const checkIns = new Set(run.checkIns);

    const habits = this.boundHabits(run).map(habit => ({
      habit,
      cells: dates.map(date => ({
        date,
        completed: this.habitsService.isHabitCompletedOnDate(habit.id, parseDateKey(date)),
        isFuture: date > today,
        isToday: date === today
      }))
    }));

    return {
      dates,
      habits,
      checkInRow: dates.map(date => ({
        date,
        checkedIn: checkIns.has(date),
        isFuture: date > today,
        isToday: date === today
      }))
    };
  }

  constructor() {
    this.loadTemplates();
    this.load();
  }

  // -------------------------------------------------------------------------
  // Catalogue management
  // -------------------------------------------------------------------------

  private get templatesTableId(): number {
    return environment.baserow.tables.challengeTemplates;
  }

  loadTemplates(): void {
    if (!this.templatesTableId) return;

    this.baserow
      .listAllRows<ChallengeTemplateRow>(this.templatesTableId, { orderBy: 'sort_index' })
      .subscribe({
        next: rows => {
          const mapped = (rows ?? []).map(toChallengeTemplate).filter(t => t.id && t.title);
          this._templates.set(mergeTemplates(CHALLENGE_CATALOGUE, mapped));
        },
        error: err => console.warn('ChallengeService: using the bundled catalogue.', err)
      });
  }

  /**
   * Creates or updates a template.
   *
   * NOTE: editing a level value here does NOT change any run already in
   * flight — a run freezes its payout into `terms` when it starts. That is
   * deliberate, and it is what makes editing the catalogue safe.
   */
  saveTemplate(template: ChallengeTemplate, rowId?: number): Observable<boolean> {
    if (!this.templatesTableId) {
      this.toast.error('Not configured', 'Set baserow.tables.challengeTemplates first.');
      return of(false);
    }

    const data = fromChallengeTemplate(template);
    const write = rowId
      ? this.baserow.updateRow<ChallengeTemplateRow>(this.templatesTableId, rowId, data)
      : this.baserow.createRow<ChallengeTemplateRow>(this.templatesTableId, data);

    return write.pipe(
      map(() => {
        this.loadTemplates();
        this.toast.success('Saved', `${template.title} updated.`);
        return true;
      })
    );
  }

  /** Archives rather than deletes — a finished run still references its template. */
  archiveTemplate(template: ChallengeTemplate, rowId: number): Observable<boolean> {
    return this.saveTemplate({ ...template, active: false }, rowId);
  }

  private readonly _hydrated = signal(false);
  readonly hydrated = this._hydrated.asReadonly();

  load(): void {
    this.refreshRuns().subscribe();
  }

  /**
   * Reloads runs, then settlements, THEN reconciles.
   *
   * Order matters: createSettlementIfOwed() guards against duplicates by
   * checking the _settlements signal, so reconciling before settlements load
   * reads an empty array and can create a duplicate settlement row.
   *
   * `reconcile` is opt-in because it WRITES. A targeted refresh triggered by a
   * partner's check-in should never flip runs to failed as a side effect.
   */
  refreshRuns(opts: { reconcile?: boolean } = { reconcile: true }): Observable<void> {
    if (!this.auth.currentUserValue) return of(undefined);

    return new Observable<void>(observer => {
      this.repository.list(this.userId()).subscribe({
        next: runs => {
          this._runs.set(runs);
          this._hydrated.set(true);
          this.loadSettlements(() => {
            if (opts.reconcile !== false) this.reconcile();
            observer.next();
            observer.complete();
          });
        },
        /**
         * A failed load must still hydrate and still complete.
         *
         * Without this handler the observable never completed, so SyncService's
         * in-flight promise never settled and every later sync was queued
         * behind it forever. And `hydrated` stayed false, which gates
         * NotificationsService — so one failed challenge request silently
         * turned off every toast in the app, friend invites included.
         */
        error: err => {
          console.warn('ChallengeService: could not load runs.', err);
          this._hydrated.set(true);
          observer.next();
          observer.complete();
        }
      });
    });
  }

  refreshSettlements(): Observable<void> {
    return new Observable<void>(observer => {
      this.loadSettlements(() => {
        observer.next();
        observer.complete();
      });
    });
  }

  reset(): void {
    this._runs.set([]);
    this._settlements.set([]);
    this._hydrated.set(false);
    this._reconcilingRuns.clear();
    this._today.set(toDateKey());
  }

  /** Bumped by SyncService — one app-wide clock owner, no timer in here. */
  setToday(dateKey: string): void {
    if (this._today() !== dateKey) this._today.set(dateKey);
  }

  progressFor(run: ChallengeRun) {
    return challengeProgress(run, this._today());
  }

  setDefaultDifficulty(difficulty: ChallengeDifficulty): void {
    this._defaultDifficulty.set(difficulty);
    try {
      localStorage.setItem(DIFFICULTY_KEY, difficulty);
    } catch {
      // Preference is session-only if storage is unavailable.
    }
  }

  /**
   * Starts a run. Creates, locks and activates in one step — a solo challenge
   * has nobody to negotiate with, so the invite/negotiate/lock transitions
   * collapse.
   *
   * The tier's level value is FROZEN into the run's terms here. Editing the
   * catalogue later cannot change what an in-flight run pays out.
   */
  start(
    template: ChallengeTemplate,
    difficulty: ChallengeDifficulty,
    partner?: { userId: string; name: string; email?: string; avatarUrl?: string },
    pledge?: ChallengePledge,
    habitIds: string[] = []
  ): Observable<ChallengeRun | null> {
    if (!this.subscription.allows(template.minTier)) {
      this.toast.warning('Habiti Plus', 'That challenge needs a paid plan.');
      return of(null);
    }
    if (this.activeRuns().some(r => r.templateId === template.id)) {
      this.toast.info('Already running', `You're partway through ${template.title}.`);
      return of(null);
    }

    const startsOn = toDateKey();
    const terms = buildChallengeTerms(template, difficulty, habitIds);
    const key = `chl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

    const run: ChallengeRun = {
      id: key,
      campaignKey: key,
      templateId: template.id,
      title: template.title,
      description: template.description,
      icon: template.icon,
      category: template.category,
      status: 'active',
      ownerUserId: this.userId(),
      cadence: template.cadence,
      startsOn,
      endsOn: addDays(startsOn, Math.max(0, template.durationDays - 1)),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      terms,
      checkIns: [],
      outcome: 'pending',
      createdAt: new Date().toISOString(),
      // Frozen here. Habiti records what was agreed; it never holds anything.
      pledge: pledge && pledge.kind !== 'none' ? pledge : undefined,
      participants: [
        {
          userId: this.userId(),
          name: this.auth.currentUserValue?.name ?? 'You',
          email: this.auth.currentUserValue?.email,
          avatarUrl: this.auth.currentUserValue?.profile_picture?.url,
          isOwner: true,
          // The owner never negotiates with themselves — accepted at creation.
          inviteStatus: 'accepted',
          checkIns: []
        },
        ...(partner
          ? [
              {
                userId: partner.userId,
                name: partner.name,
                email: partner.email,
                avatarUrl: partner.avatarUrl,
                isOwner: false,
                inviteStatus: 'invited' as const,
                checkIns: []
              }
            ]
          : [])
      ]
    };

    return this.repository.save(run).pipe(
      map(saved => {
        this._runs.update(runs => [...runs, saved]);
        this.toast.success(
          `${template.title} started`,
          partner
            ? `${CHALLENGE_DIFFICULTY_META[difficulty].label} — ${partner.name} has been invited.`
            : `${CHALLENGE_DIFFICULTY_META[difficulty].label} — worth ${terms.levelValue} levels.`
        );
        return saved;
      })
    );
  }

  /** Records today's check-in. Idempotent per day. */
  checkIn(runId: string): Observable<ChallengeRun | null> {
    const run = this._runs().find(r => r.id === runId);
    if (!run || run.status !== 'active') return of(null);

    const today = this._today();
    if (run.checkIns.includes(today)) return of(run);

    const me = this.userId();
    const evidence = this.habitsCompletedToday();
    const updated: ChallengeRun = {
      ...run,
      checkIns: [...run.checkIns, today].sort(),
      // Snapshot the habit data behind the claim. Frozen at check-in time so a
      // later habit edit cannot rewrite the record.
      evidence: [
        ...(run.evidence ?? []),
        { date: today, habitsCompleted: evidence.completed, habitsTotal: evidence.total }
      ],
      participants: (run.participants ?? []).map(p =>
        p.userId === me ? { ...p, checkIns: [...p.checkIns, today].sort() } : p
      )
    };

    // Shared runs append a report row rather than rewriting the run, so two
    // people checking in on the same day cannot clobber each other.
    const write =
      this.repository instanceof BaserowChallengeRunRepository
        ? this.repository.addCheckIn(run, me, today).pipe(map(() => updated))
        : this.repository.save(updated);

    return write.pipe(
      map(saved => {
        this.replace(saved);
        this.bus.touched('challenges');
        this.notifyParticipants(saved, 'challenge.checked_in');
        const progress = this.progressFor(saved);
        if (progress.canComplete) {
          this.toast.success('Challenge complete!', `${saved.title} is ready to claim.`);
        }
        return saved;
      })
    );
  }

  /** Runs someone has invited me to and I have not answered. */
  readonly partnerInvites = computed(() =>
    this._runs().filter(run =>
      (run.participants ?? []).some(
        p => p.userId === this.userId() && !p.isOwner && p.inviteStatus === 'invited'
      )
    )
  );

  /** Accept or decline an invitation to someone else's challenge. */
  respondToInvite(runId: string, accept: boolean): Observable<ChallengeRun | null> {
    const run = this._runs().find(r => r.id === runId);
    if (!run) return of(null);

    const me = this.userId();
    const updated: ChallengeRun = {
      ...run,
      participants: (run.participants ?? []).map(p =>
        p.userId === me ? { ...p, inviteStatus: accept ? 'accepted' : 'declined' } : p
      )
    };

    return this.repository.save(updated).pipe(
      map(saved => {
        this.replace(saved);
        this.bus.touched('challenges');
        this.bus.emit({
          kind: 'challenge.invite_answered',
          to: [{ userId: saved.ownerUserId }],
          hint: { scope: ['challenges'], refKey: saved.campaignKey }
        });
        this.toast.success(
          accept ? "You're in" : 'Invite declined',
          accept ? `${saved.title} — check in daily.` : undefined
        );
        return saved;
      })
    );
  }

  /**
   * Claims a finished run and awards its levels.
   *
   * Refuses when the run has not actually been earned. Without this a user
   * could start a 30-day challenge on Hard and claim 40 levels immediately,
   * which would make every number in the catalogue decorative.
   */
  complete(runId: string): Observable<ChallengeRun | null> {
    const run = this._runs().find(r => r.id === runId);
    if (!run || run.status !== 'active') return of(null);

    const progress = this.progressFor(run);
    if (!progress.canComplete) {
      this.toast.warning(
        'Not yet',
        `${progress.periodsPassed} of ${progress.periodsTotal} check-ins, and it runs to ${run.endsOn}.`
      );
      return of(null);
    }

    const completed: ChallengeRun = {
      ...run,
      status: 'completed',
      outcome: 'success',
      completedAt: new Date().toISOString()
    };

    return this.repository.save(completed).pipe(
      map(saved => {
        this.replace(saved);
        this.awardFor(saved);
        return saved;
      })
    );
  }

  /** Gives up on a run. No levels, no penalty — levels only ever go up. */
  abandon(runId: string): Observable<ChallengeRun | null> {
    const run = this._runs().find(r => r.id === runId);
    if (!run || run.status !== 'active') return of(null);

    const cancelled: ChallengeRun = {
      ...run,
      status: 'cancelled',
      outcome: 'void',
      completedAt: new Date().toISOString()
    };

    return this.repository.save(cancelled).pipe(
      map(saved => {
        this.replace(saved);
        this.toast.info('Challenge ended', `${saved.title} was stopped. Nothing lost.`);
        return saved;
      })
    );
  }

  /** Tells everyone else on a run that something changed. */
  private notifyParticipants(run: ChallengeRun, kind: 'challenge.checked_in' | 'challenge.completed'): void {
    const me = this.userId();
    const others = (run.participants ?? [])
      .filter(p => p.userId !== me && p.inviteStatus === 'accepted')
      .map(p => ({ userId: p.userId }));

    if (others.length === 0) return;

    this.bus.emit({
      kind,
      to: others,
      hint: {
        scope: kind === 'challenge.completed' ? ['challenges', 'levels'] : ['challenges'],
        refKey: run.campaignKey
      }
    });
  }

  /** The single seam both solo and (later) partnered completion go through. */
  private awardFor(run: ChallengeRun): void {
    const difficultyLabel = CHALLENGE_DIFFICULTY_META[run.terms.difficulty].label;
    this.levelService
      .award({
        source: 'challenge',
        levels: run.terms.levelValue,
        reason: `Completed "${run.title}" on ${difficultyLabel}`,
        detail: `${run.checkIns.length} of ${run.terms.periodsTotal} check-ins.`,
        icon: run.icon,
        refType: 'campaign',
        refKey: run.campaignKey,
        idempotencyKey: `${this.userId()}:challenge:${run.campaignKey}`
      })
      .subscribe();
  }

  /** Runs currently being written by reconcile(), so a second pass skips them. */
  private readonly _reconcilingRuns = new Set<string>();

  /**
   * Marks runs that can no longer reach their target as failed.
   *
   * WRITES. The guard matters once anything polls: two passes landing before
   * the first save returns would double-write the run and its settlement.
   */
  private reconcile(): void {
    const today = this._today();
    for (const run of this._runs()) {
      if (this._reconcilingRuns.has(run.id)) continue;
      if (run.status === 'active' && hasFailed(run, today)) {
        this._reconcilingRuns.add(run.id);
        const failed: ChallengeRun = {
          ...run,
          status: 'failed',
          outcome: 'failure',
          completedAt: new Date().toISOString()
        };
        this.repository.save(failed).subscribe({
          next: () => {
            this.replace(failed);
            this.createSettlementIfOwed(failed);
            this._reconcilingRuns.delete(run.id);
          },
          error: () => this._reconcilingRuns.delete(run.id)
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Settlements
  //
  // Habiti records the obligation and shows a donation link. It does not take
  // payment, and there is no code here that could.
  // -------------------------------------------------------------------------

  private readonly _settlements = signal<ChallengeSettlement[]>([]);
  readonly settlements = this._settlements.asReadonly();

  /** What I still owe. */
  readonly openSettlements = computed(() =>
    this._settlements().filter(
      s =>
        s.debtorUserId === this.userId() &&
        (s.status === 'due' || s.status === 'overdue' || s.status === 'self_reported_paid')
    )
  );

  /** What someone owes me and says they have paid — waiting on my confirmation. */
  readonly settlementsToConfirm = computed(() =>
    this._settlements().filter(
      s => s.creditorUserId === this.userId() && s.status === 'self_reported_paid'
    )
  );

  loadSettlements(done?: () => void): void {
    const tableId = environment.baserow.tables.campaignSettlements;
    if (!tableId) {
      done?.();
      return;
    }

    this.baserow
      .listAllRows<SettlementRow>(tableId, {
        filterType: 'OR',
        filters: [
          { field: 'debtor_user_id', op: 'equal', value: this.userId() },
          { field: 'creditor_user_id', op: 'equal', value: this.userId() }
        ]
      })
      .subscribe(rows => {
        const titles = new Map(this._runs().map(r => [r.campaignKey, r.title]));
        this._settlements.set(
          (rows ?? []).map(row => toSettlement(row, titles.get(row.campaign_key) ?? ''))
        );
        done?.();
      });
  }

  /** The user donates outside Habiti, then says so here. */
  markSettled(settlementId: string, note?: string): Observable<void> {
    return this.patchSettlement(
      settlementId,
      {
        settlement_status: 'self_reported_paid',
        receipt_note: note ?? '',
        self_reported_at: new Date().toISOString()
      },
      'Thanks for settling',
      'Your partner will be asked to confirm.'
    );
  }

  /** The other side confirms they received it. */
  confirmSettled(settlementId: string): Observable<void> {
    return this.patchSettlement(
      settlementId,
      {
        settlement_status: 'counterparty_confirmed',
        confirmed_by_user_id: this.userId(),
        confirmed_at: new Date().toISOString()
      },
      'Settled',
      'Marked as done.'
    );
  }

  /** Let someone off. Anyone owed something can waive it. */
  waiveSettlement(settlementId: string): Observable<void> {
    return this.patchSettlement(
      settlementId,
      { settlement_status: 'waived', confirmed_by_user_id: this.userId(), confirmed_at: new Date().toISOString() },
      'Waived'
    );
  }

  /** The link the debtor is sent to. Empty config is surfaced, not hidden. */
  donationLink(): string {
    return environment.charity?.iluvProjectAfricaUrl ?? '';
  }

  charityName(): string {
    const charity = environment.charity;
    return `${charity?.iluvFoundationName ?? 'iLuv Foundation'} — ${charity?.projectName ?? 'Project Africa'}`;
  }

  private createSettlementIfOwed(run: ChallengeRun): void {
    const tableId = environment.baserow.tables.campaignSettlements;
    if (!tableId || !owesSettlement(run.pledge, run.outcome)) return;

    // One settlement per run. Re-running reconcile must not stack them up.
    if (this._settlements().some(s => s.campaignKey === run.campaignKey)) return;

    const pledge = run.pledge!;
    const partner = (run.participants ?? []).find(p => !p.isOwner && p.inviteStatus === 'accepted');

    this.baserow
      .createRow<SettlementRow>(tableId, {
        campaign_key: run.campaignKey,
        debtor_user_id: run.ownerUserId,
        creditor_user_id: pledge.kind === 'peer_prize' ? partner?.userId ?? '' : '',
        amount: pledge.amount ?? 0,
        currency: pledge.currency,
        settlement_status: 'due',
        // Snapshotted so the agreed destination survives a config change.
        donation_link_url: pledge.kind === 'charity_donation' ? this.donationLink() : '',
        receipt_note: pledge.description ?? '',
        due_by: addDays(toDateKey(), 7)
      })
      .subscribe(row => {
        if (!row) return;
        this._settlements.update(list => [...list, toSettlement(row, run.title)]);
        this.toast.warning('You staked something', `${run.title} didn't land. Time to settle up.`);
      });
  }

  private patchSettlement(
    settlementId: string,
    data: Record<string, unknown>,
    title: string,
    message?: string
  ): Observable<void> {
    const tableId = environment.baserow.tables.campaignSettlements;
    const settlement = this._settlements().find(s => s.id === settlementId);
    if (!tableId || !settlement?.rowId) return of(undefined);

    return this.baserow.updateRow<SettlementRow>(tableId, settlement.rowId, data).pipe(
      map(row => {
        if (row) {
          this._settlements.update(list =>
            list.map(s => (s.id === settlementId ? toSettlement(row, s.runTitle) : s))
          );
        }
        this.toast.success(title, message);
        return undefined;
      })
    );
  }

  private replace(run: ChallengeRun): void {
    this._runs.update(runs => runs.map(r => (r.id === run.id ? run : r)));
  }

  /** The real Xano id — nothing writes localStorage['userId'], so it is not used. */
  private userId(): string {
    const id = this.auth.currentUserValue?.id;
    return id !== undefined && id !== null ? String(id) : 'default';
  }

  private loadDefaultDifficulty(): ChallengeDifficulty {
    try {
      const raw = localStorage.getItem(DIFFICULTY_KEY) as ChallengeDifficulty | null;
      return raw && raw in CHALLENGE_DIFFICULTY_META ? raw : DEFAULT_DIFFICULTY;
    } catch {
      return DEFAULT_DIFFICULTY;
    }
  }
}
