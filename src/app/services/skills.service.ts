import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { AuthService } from './auth.service';
import { BaserowService } from './baserow.service';
import { ChallengeService } from './challenge.service';
import { HabitsService } from './habits';
import { ProjectsService } from './projects.service';
import { SubscriptionService } from './subscription.service';
import { SyncBus } from './sync-bus';
import { TasksService } from './tasks.service';
import { ToastService } from './toast.service';
import { UserStorage } from './user-storage';
import {
  SkillMode,
  SkillTrack,
  SkillTrackRow,
  fromSkillTrack,
  newSkillTrack,
  toSkillTrack
} from '../models/skill.models';
import { SkillDefinition } from '../config/skill-catalogue/types';
import {
  EvidencePort,
  PracticeEntry,
  TierProgress,
  canClaim,
  eligibleTier,
  nextAction,
  nextTier,
  practiceDays,
  tierProgress,
  totalVolume
} from '../utils/skill-progress.util';

const STORAGE_KEY = 'habiti_skill_tracks';

/**
 * Skill tracks: the user's long-horizon capability records.
 *
 * Owns almost no data. Progress is derived on read from habits, tasks,
 * projects and campaigns, so this service is mostly bindings and lifecycle.
 *
 * Deliberately does NOT import the skill catalogue. SyncService injects this
 * service eagerly, so an import here would drag ~110 kB of content into the
 * initial bundle for every user, including those who never open /skills. The
 * caller supplies the definition — the catalogue is a UI-layer concern.
 *
 * Dependency direction is one-way, as with LevelService: this imports Habits,
 * Tasks, Projects and Challenge, and nothing imports it except SyncService and
 * the page. Skills never write to the level ledger — a campaign started for a
 * skill still pays out through ChallengeService's existing path.
 */
@Injectable({ providedIn: 'root' })
export class SkillsService {
  private auth = inject(AuthService);
  private baserow = inject(BaserowService);
  private storage = inject(UserStorage);
  private syncBus = inject(SyncBus);
  private toast = inject(ToastService);
  private subscription = inject(SubscriptionService);

  private habits = inject(HabitsService);
  private tasks = inject(TasksService);
  private projects = inject(ProjectsService);
  private challenges = inject(ChallengeService);

  private readonly _tracks = signal<SkillTrack[]>([]);
  private readonly _hydrated = signal(false);

  readonly tracks = this._tracks.asReadonly();
  readonly hydrated = this._hydrated.asReadonly();

  readonly activeTracks = computed(() => this._tracks().filter(t => t.status === 'active'));

  readonly canStartSkills = computed(() => this.subscription.allows('plus'));

  constructor() {
    this.loadLocal();
    this.loadFromServer();
  }

  // -------------------------------------------------------------------------
  // Evidence
  // -------------------------------------------------------------------------

  /**
   * Habit entries indexed by habit id, built ONCE per change.
   *
   * habitEntries is a flat Map keyed `habitId-date`, so a per-habit scan inside
   * a derivation that runs for every skill on every tick would walk the whole
   * map dozens of times. One index, shared by every track.
   */
  private readonly entriesByHabit = computed(() => {
    const index = new Map<string, PracticeEntry[]>();

    for (const entry of this.habits.habitEntries().values()) {
      const list = index.get(entry.habitId) ?? [];
      list.push({
        habitId: entry.habitId,
        date: entry.date,
        completed: entry.status === 'completed',
        value: entry.value
      });
      index.set(entry.habitId, list);
    }
    return index;
  });

  /** The port the pure derivation reads through. */
  private port(): EvidencePort {
    const index = this.entriesByHabit();
    const completedRuns = this.challenges
      .runs()
      .filter(run => run.status === 'completed');

    return {
      entriesFor: habitIds => habitIds.flatMap(id => index.get(id) ?? []),
      isTaskComplete: taskId => !!this.tasks.getTask(taskId)?.completed,
      isProjectComplete: projectId =>
        this.projects.projects().find(p => p.id === projectId)?.status === 'completed',
      completedCampaignTemplateIds: keys =>
        completedRuns.filter(run => keys.includes(run.campaignKey)).map(run => run.templateId)
    };
  }

  // -------------------------------------------------------------------------
  // Read helpers for the UI
  // -------------------------------------------------------------------------

  trackFor(skillId: string): SkillTrack | undefined {
    return this._tracks().find(t => t.skillId === skillId && t.status !== 'abandoned');
  }

  progress(track: SkillTrack, definition: SkillDefinition): TierProgress | null {
    return nextTier(track, definition, this.port());
  }

  ladder(track: SkillTrack, definition: SkillDefinition): TierProgress[] {
    const port = this.port();
    return definition.tiers.map(t => tierProgress(t, track, definition, port));
  }

  nextStep(track: SkillTrack, definition: SkillDefinition) {
    return nextAction(track, definition, this.port());
  }

  practiceDayCount(track: SkillTrack): number {
    return practiceDays(track, this.port());
  }

  volume(track: SkillTrack): number {
    return totalVolume(track, this.port());
  }

  isClaimable(track: SkillTrack, definition: SkillDefinition): boolean {
    return canClaim(track, definition, this.port());
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Starts a skill, binding any recommended habits the user ALREADY has.
   *
   * The pre-bind is not an optimisation. The template picker only reports
   * habits it created, so a user who already tracks "Deadlift" would have it
   * quietly excluded from the picker and therefore never bound — and the skill
   * would show a permanently-zero bar for a habit they do every day. Name is
   * the only join available, and it is the same key the picker's duplicate
   * check uses, so the two agree by construction.
   */
  start(
    definition: SkillDefinition,
    preboundHabitIds: string[] = [],
    mode: SkillMode = 'solo'
  ): SkillTrack | null {
    if (!this.subscription.allows(definition.minTier)) {
      this.toast.warning('Habiti Plus', 'Skills need a paid plan.');
      return null;
    }

    const existing = this.trackFor(definition.id);
    if (existing && existing.status !== 'completed') {
      this.toast.info('Already started', `You are already developing ${definition.name}.`);
      return existing;
    }

    const userId = this.userId() ?? '';
    const track = newSkillTrack(definition.id, userId, mode);
    track.habitIds = [...new Set(preboundHabitIds)];

    this._tracks.update(list => [...list, track]);
    this.saveLocal();
    this.persist(track);

    return track;
  }

  /** Adds habit ids to a track, ignoring duplicates. */
  bindHabits(trackId: string, habitIds: string[]): void {
    this.update(trackId, track => ({
      ...track,
      habitIds: [...new Set([...track.habitIds, ...habitIds])]
    }));
  }

  bindTask(trackId: string, key: string, taskId: string): void {
    this.update(trackId, track => ({
      ...track,
      taskRefs: [...track.taskRefs.filter(r => r.key !== key), { key, taskId }]
    }));
  }

  bindProject(trackId: string, key: string, projectId: string): void {
    this.update(trackId, track => ({
      ...track,
      projectRefs: [...track.projectRefs.filter(r => r.key !== key), { key, projectId }]
    }));
  }

  /** Records that a campaign was started for this skill. */
  bindCampaign(trackId: string, campaignKey: string): void {
    this.update(trackId, track => ({
      ...track,
      mode: 'campaign',
      campaignKeys: [...new Set([...track.campaignKeys, campaignKey])]
    }));
  }

  /**
   * Claims the next tier.
   *
   * Re-derives eligibility rather than trusting the button, and refuses with a
   * named shortfall — the same shape as ChallengeService.complete(). Without
   * that, the numbers on screen would be decorative.
   */
  claimTier(trackId: string, definition: SkillDefinition): void {
    const track = this._tracks().find(t => t.id === trackId);
    if (!track) return;

    const eligible = eligibleTier(track, definition, this.port());
    if (eligible <= track.tier) {
      const outstanding = nextAction(track, definition, this.port());
      this.toast.warning(
        'Not yet',
        outstanding
          ? `${outstanding.label}: ${Math.floor(outstanding.have)} of ${outstanding.need}.`
          : 'Nothing to claim yet.'
      );
      return;
    }

    const next = definition.tiers.find(t => t.level === track.tier + 1);
    if (!next) return;

    const snapshot = tierProgress(next, track, definition, this.port());

    this.update(trackId, current => ({
      ...current,
      tier: next.level,
      // Frozen: a habit edited or deleted later must not rewrite what was true
      // at the moment the tier was earned.
      claims: [
        ...current.claims,
        {
          tier: next.level,
          claimedAt: new Date().toISOString(),
          evidence: snapshot.requirements.map(r => ({
            label: r.label,
            have: Math.floor(r.have),
            need: r.need
          }))
        }
      ]
    }));

    this.toast.success(`${next.name} — ${definition.name}`, next.blurb);
  }

  pause(trackId: string): void {
    this.update(trackId, t => ({ ...t, status: 'paused' }));
  }

  /** Resuming never moves startedAt — a pause is not a progress reset. */
  resume(trackId: string): void {
    this.update(trackId, t => ({ ...t, status: 'active' }));
  }

  complete(trackId: string): void {
    this.update(trackId, t => ({
      ...t,
      status: 'completed',
      completedAt: new Date().toISOString()
    }));
  }

  /**
   * Stops tracking a skill.
   *
   * Never deletes the habits, tasks or projects it was bound to. The skill is
   * a lens over the user's data, and closing the lens must not destroy it.
   */
  abandon(trackId: string): void {
    this.update(trackId, t => ({ ...t, status: 'abandoned' }));
  }

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  private get tableId(): number {
    return this.baserow.tables.userSkills;
  }

  private userId(): string | null {
    const id = this.auth.currentUserValue?.id;
    return id !== undefined && id !== null ? String(id) : null;
  }

  private update(trackId: string, change: (track: SkillTrack) => SkillTrack): void {
    let updated: SkillTrack | undefined;

    this._tracks.update(list =>
      list.map(track => {
        if (track.id !== trackId) return track;
        updated = { ...change(track), updatedAt: new Date().toISOString() };
        return updated;
      })
    );

    this.saveLocal();
    if (updated) this.persist(updated);
  }

  private loadLocal(): void {
    const raw = this.storage.readRaw(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as SkillTrack[];
      if (Array.isArray(parsed)) this._tracks.set(parsed);
    } catch {
      // A corrupt cache must not stop the service starting.
    }
  }

  private saveLocal(): void {
    this.storage.writeRaw(STORAGE_KEY, JSON.stringify(this._tracks()));
  }

  private loadFromServer(): void {
    const userId = this.userId();

    if (!this.tableId) {
      // An empty result from an unconfigured table is byte-identical to "this
      // user has no skills", so never let it clear a populated local cache.
      console.warn('SkillsService: baserow.tables.userSkills is 0, skills are local-only.');
      this._hydrated.set(true);
      return;
    }
    if (!userId) return;

    this.baserow
      .listAllRows<SkillTrackRow>(this.tableId, {
        filters: [{ field: 'user_id', op: 'equal', value: userId }]
      })
      .subscribe({
        next: rows => {
          this._tracks.set((rows ?? []).map(toSkillTrack));
          this.saveLocal();
          this._hydrated.set(true);
        },
        error: err => {
          console.warn('SkillsService: could not load skills.', err);
          this._hydrated.set(true);
        }
      });
  }

  private persist(track: SkillTrack): void {
    const userId = this.userId();
    if (!userId || !this.tableId) return;

    const data = fromSkillTrack(track, userId);

    const request = track.rowId
      ? this.baserow.updateRow<SkillTrackRow>(this.tableId, track.rowId, data)
      : this.baserow.createRow<SkillTrackRow>(this.tableId, data);

    request.subscribe({
      next: row => {
        if (row && !track.rowId) {
          // Adopt the server id so the next edit updates rather than duplicates.
          this._tracks.update(list =>
            list.map(t => (t.id === track.id ? { ...t, id: String(row.id), rowId: row.id } : t))
          );
          this.saveLocal();
        }
        this.syncBus.touched('skills');
      },
      error: err => console.warn('SkillsService: skill not persisted.', err)
    });
  }

  /** SyncService calls this on the `skills` scope and on account switch. */
  reload(): void {
    this._tracks.set([]);
    this._hydrated.set(false);
    this.loadLocal();
    this.loadFromServer();
  }

  refresh(): Observable<void> {
    this.reload();
    return of(undefined);
  }

  reset(): void {
    this._tracks.set([]);
    this._hydrated.set(false);
  }

}
