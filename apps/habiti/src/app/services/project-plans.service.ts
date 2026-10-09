import { Injectable, inject, signal } from '@angular/core';
import { UserStorage } from '@habiti/storage';
import { SyncBus } from '@habiti/sync';
import {
  ProjectPlan,
  ProjectPlanRow,
  fromProjectPlan,
  toProjectPlan
} from '../models/plan.models';
import { ScoredPlan, scorePlans } from '../config/plan-score';
import { AuthService } from './auth.service';
import { BaserowService } from './baserow.service';
import { ResettableRegistry } from './resettable.registry';

/**
 * The plans a project is choosing between.
 *
 * Local-first like everything else here: the signal is the truth for the
 * session, writes go to Baserow behind it, and a table id of 0 keeps them in
 * this browser with one warning rather than a failure per keystroke.
 */
@Injectable({ providedIn: 'root' })
export class ProjectPlansService {
  private readonly KEY = 'habiti_project_plans';

  private storage = inject(UserStorage);
  private auth = inject(AuthService);
  private baserow = inject(BaserowService);
  private syncBus = inject(SyncBus);

  private _plans = signal<ProjectPlan[]>([]);
  readonly plans = this._plans.asReadonly();

  private warned = false;

  constructor() {
    inject(ResettableRegistry).register(this, ['projects']);
    this.loadCache();
    this.loadFromServer();
  }

  private get tableId(): number {
    return this.baserow.tables?.projectPlans ?? 0;
  }

  private userId(): string | null {
    const id = this.auth.currentUserValue?.id;
    return id !== undefined && id !== null ? String(id) : null;
  }

  plansFor(projectId: string): ProjectPlan[] {
    return this._plans().filter(plan => plan.projectId === projectId);
  }

  /**
   * The plans, best first, each with the reasons behind its place.
   *
   * The ordering is computed here rather than stored, because a plan's score
   * only means anything next to the others — add a cheaper option and every
   * score changes.
   */
  rankedFor(projectId: string): ScoredPlan<ProjectPlan>[] {
    return scorePlans(this.plansFor(projectId));
  }

  addPlan(projectId: string, data: Partial<ProjectPlan>): ProjectPlan {
    const existing = this.plansFor(projectId);
    const plan: ProjectPlan = {
      id: this.generateId(),
      projectId,
      title: data.title?.trim() || `Plan ${String.fromCharCode(65 + existing.length)}`,
      summary: data.summary,
      status: data.status ?? 'draft',
      rating: data.rating,
      cost: data.cost,
      currency: data.currency,
      durationDays: data.durationDays,
      effort: data.effort,
      risk: data.risk,
      confidence: data.confidence,
      pros: data.pros,
      cons: data.cons,
      sortOrder: existing.length + 1
    };

    this._plans.update(plans => [...plans, plan]);
    this.save();
    this.persist(plan);
    return plan;
  }

  updatePlan(planId: string, updates: Partial<ProjectPlan>): void {
    let updated: ProjectPlan | undefined;
    this._plans.update(plans =>
      plans.map(plan => {
        if (plan.id !== planId) return plan;
        updated = { ...plan, ...updates };

        // Deciding stamps the day, and un-deciding clears it — a decided_at on
        // a plan that is back under consideration is a date that lies.
        if (updates.status && updates.status !== plan.status) {
          updated.decidedAt =
            updates.status === 'chosen' || updates.status === 'rejected' ? new Date() : undefined;
        }
        return updated;
      })
    );
    this.save();
    if (updated) this.persist(updated);
  }

  /**
   * Marks one plan as the chosen one.
   *
   * The others that were chosen go back to `considering` rather than being
   * rejected: changing your mind about which to do is not the same as ruling
   * the old one out, and only the person can say that.
   */
  choosePlan(projectId: string, planId: string): void {
    for (const plan of this.plansFor(projectId)) {
      if (plan.id === planId) this.updatePlan(plan.id, { status: 'chosen' });
      else if (plan.status === 'chosen') this.updatePlan(plan.id, { status: 'considering' });
    }
  }

  deletePlan(planId: string): void {
    this._plans.update(plans => plans.filter(plan => plan.id !== planId));
    this.save();
    this.removeRow(planId);
  }

  // --- persistence ---------------------------------------------------------

  private persist(plan: ProjectPlan): void {
    const userId = this.userId();
    if (!userId) return;
    if (!this.tableId) return void this.warnOnce();

    const data = fromProjectPlan(plan, userId);
    const rowId = Number(plan.id);
    const request = Number.isFinite(rowId)
      ? this.baserow.updateRow<ProjectPlanRow>(this.tableId, rowId, data)
      : this.baserow.createRow<ProjectPlanRow>(this.tableId, data);

    request.subscribe({
      next: row => {
        if (row && !Number.isFinite(rowId)) {
          const serverId = String(row.id);
          this._plans.update(plans =>
            plans.map(candidate =>
              candidate.id === plan.id ? { ...candidate, id: serverId } : candidate
            )
          );
          this.save();
        }
        this.syncBus.touched('projects');
      },
      error: err => console.warn('ProjectPlansService: plan not saved.', err)
    });
  }

  private removeRow(planId: string): void {
    const rowId = Number(planId);
    if (!this.tableId || !Number.isFinite(rowId)) return;
    this.baserow.deleteRow(this.tableId, rowId).subscribe({
      error: err => console.warn('ProjectPlansService: plan not deleted.', err)
    });
  }

  private loadFromServer(): void {
    const userId = this.userId();
    if (!userId) return;
    if (!this.tableId) return void this.warnOnce();

    this.baserow
      .listAllRows<ProjectPlanRow>(this.tableId, {
        filters: [{ field: 'user_id', op: 'equal', value: userId }]
      })
      .subscribe({
        next: rows => {
          const fromServer = (rows ?? []).map(toProjectPlan);
          const known = new Set(fromServer.map(plan => plan.id));
          // Anything written before the table existed is uploaded, not dropped.
          const localOnly = this._plans().filter(
            plan => !known.has(plan.id) && !Number.isFinite(Number(plan.id))
          );

          this._plans.set([...fromServer, ...localOnly]);
          this.save();
          for (const plan of localOnly) this.persist(plan);
        },
        error: err => console.warn('ProjectPlansService: could not load plans.', err)
      });
  }

  reload(): void {
    this._plans.set([]);
    this.warned = false;
    this.loadCache();
    this.loadFromServer();
  }

  private loadCache(): void {
    try {
      const raw = this.storage.readRaw(this.KEY);
      if (!raw) return;

      this._plans.set(
        (JSON.parse(raw) as ProjectPlan[]).map(plan => ({
          ...plan,
          decidedAt: plan.decidedAt ? new Date(plan.decidedAt) : undefined
        }))
      );
    } catch (error) {
      console.error('ProjectPlansService: could not read the cache.', error);
    }
  }

  private save(): void {
    try {
      this.storage.writeRaw(this.KEY, JSON.stringify(this._plans()));
    } catch (error) {
      console.error('ProjectPlansService: could not write the cache.', error);
    }
  }

  private warnOnce(): void {
    if (this.warned) return;
    this.warned = true;
    console.warn(
      'ProjectPlansService: tables.projectPlans is 0 — plans stay on this browser. ' +
        'Create the table with: npm run db:setup -- --apply --write-env'
    );
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
}
