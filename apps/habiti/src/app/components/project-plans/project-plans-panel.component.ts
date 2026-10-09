import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Project } from '../../models/project.model';
import { ProjectPlan } from '../../models/plan.models';
import { PlanLevel, PlanStatus } from '../../config/plan-score';
import { formatMoney } from '../../config/currency';
import { CurrencyService } from '../../services/currency.service';
import { ProjectPlansService } from '../../services/project-plans.service';

/**
 * Plan A, Plan B — the alternatives, side by side and in order.
 *
 * The best-looking plan is at the top, and every card says WHY it is where it
 * is. A ranking that cannot be argued with is a ranking nobody trusts; this one
 * shows its reasons in plain words so disagreeing with it is easy — and
 * choosing a plan pins it to the top regardless, because a decision outranks a
 * calculation.
 */
@Component({
  selector: 'app-project-plans-panel',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="rounded-xl bg-white p-6 shadow-lg dark:bg-slate-800">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="font-semibold text-slate-800 dark:text-slate-100">
            Plans
            <span class="ml-1 text-sm font-normal text-slate-500">({{ ranked().length }})</span>
          </h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            Ways of doing this, best first. Choosing one pins it to the top.
          </p>
        </div>

        <button type="button" class="text-sm font-medium text-blue-600" (click)="showForm.set(!showForm())">
          {{ showForm() ? 'Close' : '+ New plan' }}
        </button>
      </div>

      @if (showForm()) {
        <form class="mb-4 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-6 dark:bg-slate-900/40" (ngSubmit)="add()">
          <input
            [(ngModel)]="draftTitle"
            name="planTitle"
            placeholder="Plan A — do the floors first"
            class="rounded-lg border border-slate-300 px-2 py-1 text-sm sm:col-span-6 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
          <textarea
            [(ngModel)]="draftSummary"
            name="planSummary"
            rows="2"
            placeholder="What this plan actually is"
            class="rounded-lg border border-slate-300 px-2 py-1 text-sm sm:col-span-6 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          ></textarea>

          <label class="text-xs text-slate-500 sm:col-span-1">
            Cost
            <input
              type="number"
              step="0.01"
              [(ngModel)]="draftCost"
              name="planCost"
              class="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </label>
          <label class="text-xs text-slate-500 sm:col-span-1">
            Days
            <input
              type="number"
              [(ngModel)]="draftDays"
              name="planDays"
              class="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </label>
          <label class="text-xs text-slate-500 sm:col-span-1">
            Rating
            <select
              [(ngModel)]="draftRating"
              name="planRating"
              class="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            >
              <option [ngValue]="null">—</option>
              @for (value of [1, 2, 3, 4, 5]; track value) {
                <option [ngValue]="value">{{ value }}</option>
              }
            </select>
          </label>
          <label class="text-xs text-slate-500 sm:col-span-1">
            Effort
            <select
              [(ngModel)]="draftEffort"
              name="planEffort"
              class="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            >
              <option [ngValue]="undefined">—</option>
              @for (level of levels; track level) {
                <option [ngValue]="level">{{ level }}</option>
              }
            </select>
          </label>
          <label class="text-xs text-slate-500 sm:col-span-1">
            Risk
            <select
              [(ngModel)]="draftRisk"
              name="planRisk"
              class="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            >
              <option [ngValue]="undefined">—</option>
              @for (level of levels; track level) {
                <option [ngValue]="level">{{ level }}</option>
              }
            </select>
          </label>
          <label class="text-xs text-slate-500 sm:col-span-1">
            Confidence %
            <input
              type="number"
              min="0"
              max="100"
              [(ngModel)]="draftConfidence"
              name="planConfidence"
              class="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </label>

          <button type="submit" class="rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white sm:col-span-6">
            Add this plan
          </button>
        </form>
      }

      @if (ranked().length === 0) {
        <p class="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-600">
          No plans yet. Write down two ways of doing this and the comparison makes itself.
        </p>
      } @else {
        <div class="space-y-3">
          @for (entry of ranked(); track entry.plan.id; let first = $first) {
            <article
              class="rounded-xl border p-4"
              [class]="
                entry.chosen
                  ? 'border-green-400 bg-green-50/60 dark:border-green-700 dark:bg-green-900/20'
                  : entry.plan.status === 'rejected'
                    ? 'border-slate-200 bg-slate-50 opacity-60 dark:border-slate-700 dark:bg-slate-900/30'
                    : 'border-slate-200 dark:border-slate-700'
              "
            >
              <div class="mb-1 flex flex-wrap items-start justify-between gap-2">
                <div class="min-w-0">
                  <h3 class="font-medium text-slate-900 dark:text-white">
                    {{ entry.plan.title }}
                    @if (entry.chosen) {
                      <span class="ml-2 rounded-full bg-green-600 px-2 py-0.5 text-[11px] font-medium text-white">
                        chosen
                      </span>
                    } @else if (first) {
                      <span class="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                        best on paper
                      </span>
                    } @else if (entry.plan.status === 'rejected') {
                      <span class="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        rejected
                      </span>
                    }
                  </h3>
                  @if (entry.plan.summary) {
                    <p class="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{{ entry.plan.summary }}</p>
                  }
                </div>

                <div class="shrink-0 text-right">
                  <p class="text-lg font-semibold text-slate-900 dark:text-white">{{ entry.score }}</p>
                  <p class="text-[11px] text-slate-400">out of 100</p>
                </div>
              </div>

              <!-- The trackable fields, only the ones that were filled in. -->
              <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                @if (entry.plan.cost !== undefined) {
                  <span>{{ money(entry.plan.cost) }}</span>
                }
                @if (entry.plan.durationDays !== undefined) {
                  <span>{{ entry.plan.durationDays }} days</span>
                }
                @if (entry.plan.rating !== undefined) {
                  <span>{{ entry.plan.rating }}/5</span>
                }
                @if (entry.plan.effort) {
                  <span>{{ entry.plan.effort }} effort</span>
                }
                @if (entry.plan.risk) {
                  <span>{{ entry.plan.risk }} risk</span>
                }
                @if (entry.plan.confidence !== undefined) {
                  <span>{{ entry.plan.confidence }}% confident</span>
                }
              </div>

              @if (entry.reasons.length > 0) {
                <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {{ entry.reasons.join(' · ') }}
                </p>
              }

              <div class="mt-3 flex flex-wrap items-center gap-3 text-xs">
                @if (!entry.chosen) {
                  <button type="button" class="font-medium text-green-700 dark:text-green-400" (click)="choose(entry.plan)">
                    Choose this
                  </button>
                }
                @if (entry.plan.status !== 'rejected') {
                  <button type="button" class="text-slate-500 hover:text-slate-700" (click)="setStatus(entry.plan, 'rejected')">
                    Rule out
                  </button>
                } @else {
                  <button type="button" class="text-slate-500 hover:text-slate-700" (click)="setStatus(entry.plan, 'considering')">
                    Reconsider
                  </button>
                }
                <button type="button" class="ml-auto text-slate-400 hover:text-red-600" (click)="remove(entry.plan)">
                  Delete
                </button>
              </div>
            </article>
          }
        </div>
      }
    </section>
  `
})
export class ProjectPlansPanelComponent {
  readonly project = input.required<Project>();

  private plansService = inject(ProjectPlansService);
  private currency = inject(CurrencyService);

  protected readonly levels: PlanLevel[] = ['low', 'medium', 'high'];
  protected readonly showForm = signal(false);

  protected draftTitle = '';
  protected draftSummary = '';
  protected draftCost: number | null = null;
  protected draftDays: number | null = null;
  protected draftRating: number | null = null;
  protected draftEffort: PlanLevel | undefined = undefined;
  protected draftRisk: PlanLevel | undefined = undefined;
  protected draftConfidence: number | null = null;

  protected readonly ranked = computed(() => this.plansService.rankedFor(this.project().id));

  protected money(amount: number): string {
    return formatMoney(amount, this.project().currency || this.currency.home());
  }

  protected add(): void {
    this.plansService.addPlan(this.project().id, {
      title: this.draftTitle.trim(),
      summary: this.draftSummary.trim() || undefined,
      cost: this.draftCost ?? undefined,
      durationDays: this.draftDays ?? undefined,
      rating: this.draftRating ?? undefined,
      effort: this.draftEffort,
      risk: this.draftRisk,
      confidence: this.draftConfidence ?? undefined,
      status: 'considering',
      currency: this.project().currency
    });

    this.draftTitle = '';
    this.draftSummary = '';
    this.draftCost = null;
    this.draftDays = null;
    this.draftRating = null;
    this.draftEffort = undefined;
    this.draftRisk = undefined;
    this.draftConfidence = null;
  }

  protected choose(plan: ProjectPlan): void {
    this.plansService.choosePlan(this.project().id, plan.id);
  }

  protected setStatus(plan: ProjectPlan, status: PlanStatus): void {
    this.plansService.updatePlan(plan.id, { status });
  }

  protected remove(plan: ProjectPlan): void {
    this.plansService.deletePlan(plan.id);
  }
}
