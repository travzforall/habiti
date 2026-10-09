import { Component, computed, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Milestone, Project, Task } from '../../models/project.model';
import { ItemStatus, ProjectItem } from '../../models/budget.models';
import { ProjectTool } from '../../models/tool.models';
import { ToolStatus, toolCost } from '../../config/tool-cost';
import { itemCost, outstandingForItem } from '../../config/budget-math';
import { formatMoney, withEquivalent } from '../../config/currency';
import { CurrencyService } from '../../services/currency.service';
import { ProjectBudgetService } from '../../services/project-budget.service';
import { SupplyPickerComponent } from '../supply-picker/supply-picker.component';
import { ToolkitService } from '../../services/toolkit.service';
import { TOOLKIT_KIND_META, iconFor, toProjectItemDraft } from '../../models/toolkit.models';

/**
 * A project's money: the budget, what it needs to buy, and what it has spent.
 *
 * ── WHY THREE NUMBERS AND NOT ONE ─────────────────────────────────────────
 *
 * "Spent" alone is comforting and useless: a project can be under budget right
 * up to the afternoon it isn't, because the spending was decided weeks ago and
 * simply hadn't happened yet. So the header shows SPENT (gone), COMMITTED
 * (decided, not yet paid) and PROJECTED (the two together, which is the number
 * that tells you whether to change the plan) — and it turns amber before the
 * money moves, not after.
 *
 * The item list doubles as the plan: grouped by milestone, in timeline order,
 * with a running total, so the useful question — "what will I have spent by
 * the time the floors are done" — is answered by reading down the page.
 */
@Component({
  selector: 'app-project-budget-panel',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, SupplyPickerComponent],
  template: `
    <section class="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
      <header class="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Budget &amp; items</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            What it needs, what it costs, what has gone out.
          </p>
        </div>

        @if (editingBudget()) {
          <form class="flex items-center gap-2" (ngSubmit)="saveBudget()">
            <input
              type="number"
              step="0.01"
              min="0"
              [(ngModel)]="budgetDraft"
              name="budget"
              placeholder="0.00"
              class="w-32 rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
            <button type="submit" class="rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white">
              Save
            </button>
            <button type="button" class="text-sm text-slate-500" (click)="editingBudget.set(false)">
              Cancel
            </button>
          </form>
        } @else {
          <button
            type="button"
            class="rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            (click)="startEditingBudget()"
          >
            {{ project().budget === undefined ? 'Set a budget' : 'Budget ' + money(project().budget ?? 0) }}
          </button>
        }
      </header>

      <!-- The three numbers, and the bar that puts them in proportion. -->
      <div class="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
          <p class="text-xs uppercase tracking-wide text-slate-500">Spent</p>
          <p class="text-lg font-semibold text-slate-900 dark:text-white">{{ money(summary().spent) }}</p>
        </div>
        <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
          <p class="text-xs uppercase tracking-wide text-slate-500">Committed</p>
          <p class="text-lg font-semibold text-slate-900 dark:text-white">{{ money(summary().committed) }}</p>
        </div>
        <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
          <p class="text-xs uppercase tracking-wide text-slate-500">Projected</p>
          <p class="text-lg font-semibold" [class.text-red-600]="summary().over">
            {{ money(summary().projected) }}
          </p>
        </div>
        <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
          <p class="text-xs uppercase tracking-wide text-slate-500">
            {{ (summary().remaining ?? 0) < 0 ? 'Over by' : 'Left' }}
          </p>
          <p class="text-lg font-semibold" [class.text-red-600]="summary().over">
            {{ summary().remaining === undefined ? '—' : money(absRemaining()) }}
          </p>
        </div>
      </div>

      @if (summary().usedPct !== undefined) {
        <div class="mb-5">
          <div class="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <!-- Spent and committed as one bar in two shades: the pale part is
                 the money that has not moved yet. -->
            <div class="flex h-full">
              <div class="h-full bg-blue-600" [style.width.%]="barSpent()"></div>
              <div class="h-full bg-blue-300" [style.width.%]="barCommitted()"></div>
            </div>
          </div>
          <p class="mt-1 text-xs text-slate-500">
            {{ summary().usedPct }}% of {{ money(project().budget ?? 0) }}
            @if (summary().over) {
              <span class="font-medium text-red-600">— over before it is spent</span>
            }
            @if (allocation().allocated > 0) {
              <span class="ml-2 text-slate-400">
                · {{ money(allocation().allocated) }} handed to tasks
                @if (allocation().overAllocated) {
                  <span class="font-medium text-red-600">
                    — {{ money(-(allocation().unallocated ?? 0)) }} more than there is
                  </span>
                }
              </span>
            }
          </p>
        </div>
      }

      <!-- The item plan. -->
      <div class="mb-4 flex items-center justify-between">
        <h3 class="text-sm font-semibold text-slate-900 dark:text-white">
          Item plan
          <span class="ml-1 font-normal text-slate-500">{{ items().length }}</span>
        </h3>
        <button type="button" class="text-sm font-medium text-blue-600" (click)="showItemForm.set(!showItemForm())">
          {{ showItemForm() ? 'Close' : '+ Add item' }}
        </button>
      </div>

      @if (showItemForm()) {
        <!--
          Prefill from the user's standing kit rather than retyping "Cordless
          drill" into every project. This COPIES: the row records what this job
          needed at this price, so editing the toolkit later never rewrites a
          finished job. Quantity is deliberately not carried over — how many you
          own says nothing about how many this job needs.
        -->
        @if (toolkitOptions().length) {
          <div class="mb-2 flex items-center gap-2">
            <label for="from-toolkit" class="text-xs font-medium text-slate-500 dark:text-slate-400">
              From my toolkit
            </label>
            <select
              id="from-toolkit"
              [ngModel]="''"
              name="fromToolkit"
              (ngModelChange)="prefillFromToolkit($event)"
              class="rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            >
              <option value="">Pick something…</option>
              @for (option of toolkitOptions(); track option.id) {
                <option [value]="option.id">{{ option.label }}</option>
              }
            </select>
          </div>
        }

        <form class="mb-4 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-6 dark:bg-slate-900/40" (ngSubmit)="addItem()">
          <input
            [(ngModel)]="draftTitle"
            name="title"
            placeholder="What is needed"
            class="rounded-lg border border-slate-300 px-2 py-1 text-sm sm:col-span-2 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
          <input
            type="number"
            step="0.01"
            [(ngModel)]="draftQuantity"
            name="quantity"
            placeholder="Qty"
            class="rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
          <input
            [(ngModel)]="draftUnit"
            name="unit"
            placeholder="bags"
            class="rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
          <input
            type="number"
            step="0.01"
            [(ngModel)]="draftUnitCost"
            name="unitCost"
            placeholder="Each"
            class="rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
          <select
            [(ngModel)]="draftMilestone"
            name="milestone"
            class="rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          >
            <option value="">No stage</option>
            @for (milestone of milestones(); track milestone.id) {
              <option [value]="milestone.id">{{ milestone.title }}</option>
            }
          </select>
          <button type="submit" class="rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white sm:col-span-6">
            Add to the list
          </button>
        </form>
      }

      @if (items().length === 0) {
        <p class="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-600">
          Nothing on the list yet. Add what the job needs and the budget follows.
        </p>
      } @else {
        @for (group of plan(); track group.key ?? 'none') {
          <div class="mb-4">
            <div class="mb-1 flex items-baseline justify-between border-b border-slate-200 pb-1 dark:border-slate-700">
              <h4 class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {{ milestoneTitle(group.key) }}
              </h4>
              <p class="text-xs text-slate-500">
                {{ money(group.subtotal) }}
                <span class="ml-2 text-slate-400">running {{ money(group.runningTotal) }}</span>
              </p>
            </div>

            @for (item of group.items; track item.id) {
              <div class="flex items-center gap-3 py-1.5">
                <button
                  type="button"
                  class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
                  [class]="statusClass(item.status)"
                  (click)="cycleStatus(item)"
                  [title]="'Mark as ' + nextStatus(item.status)"
                >
                  {{ item.status }}
                </button>

                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm text-slate-900 dark:text-white">
                    @if (item.quantity && item.quantity !== 1) {
                      <span class="text-slate-500">{{ item.quantity }}{{ item.unit ? ' ' + item.unit : '' }} ·</span>
                    }
                    {{ item.title }}
                  </p>
                  @if (item.unitCost !== undefined && (item.quantity ?? 1) !== 1) {
                    <p class="text-xs text-slate-400">{{ money(item.unitCost) }} each</p>
                  }
                </div>

                <p class="shrink-0 text-sm tabular-nums text-slate-700 dark:text-slate-200">
                  {{ item.unitCost === undefined ? 'no price' : shown(cost(item), item.currency) }}
                </p>

                @if (item.status !== 'have') {
                  <button
                    type="button"
                    class="shrink-0 text-xs font-medium text-blue-600"
                    (click)="buy(item)"
                    title="Record this as bought"
                  >
                    Bought
                  </button>
                }
                <button
                  type="button"
                  class="shrink-0 text-xs text-slate-400 hover:text-red-600"
                  (click)="removeItem(item)"
                  aria-label="Remove item"
                >
                  ✕
                </button>
              </div>
            }
          </div>
        }
      }

      @if (summary().unconverted.length > 0) {
        <p class="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          Not included above:
          {{ summary().unconverted.join(', ') }} —
          <a routerLink="/settings" class="font-medium underline">set a rate</a>
          and these join the totals. Counting them as
          {{ homeCurrency() }} would be a total that looks right and is not.
        </p>
      }

      <!--
        Every task with money on it. A task's items and expenses belong to the
        project as well, so this is the same money seen a second way — not a
        second pot, and never added to the totals above.
      -->
      @if (byTask().length > 0) {
        <div class="mt-6 border-t border-slate-200 pt-4 dark:border-slate-700">
          <h3 class="mb-2 text-sm font-semibold text-slate-900 dark:text-white">By task</h3>

          @for (row of byTask(); track row.taskId) {
            <div class="flex items-center gap-3 py-1.5">
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm text-slate-900 dark:text-white">{{ taskTitle(row.taskId) }}</p>
                <p class="text-xs text-slate-400">
                  {{ money(row.spent) }} spent
                  @if (row.committed > 0) {
                    · {{ money(row.committed) }} committed
                  }
                </p>
              </div>

              <div class="shrink-0 text-right">
                <p class="text-sm tabular-nums" [class.text-red-600]="row.over">
                  {{ money(row.projected) }}
                  @if (row.budget !== undefined) {
                    <span class="text-slate-400">/ {{ money(row.budget) }}</span>
                  }
                </p>
                @if (row.budget === undefined) {
                  <p class="text-[11px] text-slate-400">no budget of its own</p>
                } @else if (row.over) {
                  <p class="text-[11px] font-medium text-red-600">
                    over by {{ money(-(row.remaining ?? 0)) }}
                  </p>
                }
              </div>
            </div>
          }
        </div>
      }

      <!--
        Tools: what the job needs to lay hands on.

        Separate from the item plan because the question is different — an item
        is bought and used up, a tool is borrowed, hired or already in the shed.
        Only the ones that cost money reach the budget above.
      -->
      <div class="mt-6 mb-3 flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-700">
        <h3 class="text-sm font-semibold text-slate-900 dark:text-white">
          Tools
          @if (toolsToGet().length > 0) {
            <span class="ml-1 font-normal text-amber-600">{{ toolsToGet().length }} to get</span>
          } @else if (tools().length > 0) {
            <span class="ml-1 font-normal text-slate-500">all here</span>
          }
        </h3>
        <div class="flex items-center gap-3">
          <button type="button" class="text-sm font-medium text-blue-600" (click)="showPicker.set(!showPicker())">
            {{ showPicker() ? 'Close list' : 'Pick from list' }}
          </button>
          <button type="button" class="text-sm text-slate-500 hover:text-slate-700" (click)="showToolForm.set(!showToolForm())">
            {{ showToolForm() ? 'Close' : '+ One-off' }}
          </button>
        </div>
      </div>

      <!--
        @defer, so the catalogue and the search only load when someone opens
        the picker. It is a few hundred entries; nobody should download it to
        look at a budget.
      -->
      @if (showPicker()) {
        @defer (on immediate) {
          <div class="mb-3">
            <app-supply-picker
              [projectId]="project().id"
              [currency]="project().currency"
              (added)="showPicker.set(false)"
              (closed)="showPicker.set(false)"
            ></app-supply-picker>
          </div>
        } @loading {
          <p class="mb-3 text-sm text-slate-500">Loading the list…</p>
        }
      }

      @if (showToolForm()) {
        <form class="mb-3 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-6 dark:bg-slate-900/40" (ngSubmit)="addTool()">
          <input
            [(ngModel)]="toolTitle"
            name="toolTitle"
            placeholder="SDS drill"
            class="rounded-lg border border-slate-300 px-2 py-1 text-sm sm:col-span-2 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
          <select
            [(ngModel)]="toolStatus"
            name="toolStatus"
            class="rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          >
            <option value="buy">buy</option>
            <option value="hire">hire</option>
            <option value="borrow">borrow</option>
            <option value="own">own</option>
          </select>
          <input
            [(ngModel)]="toolSource"
            name="toolSource"
            placeholder="From whom"
            class="rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />

          <!-- Only the fields that mean anything for the chosen way of getting
               it: a borrowed drill has no rate, and asking for one is noise. -->
          @if (toolStatus === 'buy') {
            <input
              type="number"
              step="0.01"
              [(ngModel)]="toolCostDraft"
              name="toolCost"
              placeholder="Price"
              class="rounded-lg border border-slate-300 px-2 py-1 text-sm sm:col-span-2 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          } @else if (toolStatus === 'hire') {
            <input
              type="number"
              step="0.01"
              [(ngModel)]="toolRate"
              name="toolRate"
              placeholder="Per day"
              class="rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
            <input
              type="number"
              [(ngModel)]="toolDays"
              name="toolDays"
              placeholder="Days"
              class="rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          }

          <button type="submit" class="rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white sm:col-span-6">
            Add tool
          </button>
        </form>
      }

      @if (tools().length === 0) {
        <p class="text-sm text-slate-500">No tools listed. Add what the job needs before it starts.</p>
      } @else {
        @for (tool of tools(); track tool.id) {
          <div class="flex items-center gap-3 py-1.5">
            <button
              type="button"
              class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
              [class]="toolClass(tool)"
              (click)="cycleToolStatus(tool)"
              [title]="'Getting it: ' + tool.status"
            >
              {{ tool.status }}
            </button>

            <div class="min-w-0 flex-1">
              <p class="truncate text-sm text-slate-900 dark:text-white">{{ tool.title }}</p>
              <p class="text-xs text-slate-400">
                @if (tool.source) {
                  {{ tool.source }}
                }
                @if (tool.status === 'hire' && tool.hireRate) {
                  · {{ money(tool.hireRate) }}/day × {{ tool.hireDays || 1 }}
                }
                @if (tool.returnBy) {
                  · back {{ tool.returnBy | date: 'd MMM' }}
                }
              </p>
            </div>

            <p class="shrink-0 text-sm tabular-nums text-slate-700 dark:text-slate-200">
              {{ costOfTool(tool) === 0 ? '—' : money(costOfTool(tool)) }}
            </p>

            <button
              type="button"
              class="shrink-0 text-xs font-medium"
              [class]="tool.inHand ? 'text-green-600' : 'text-blue-600'"
              (click)="toggleInHand(tool)"
            >
              {{ tool.inHand ? 'here' : 'got it' }}
            </button>
            <button
              type="button"
              class="shrink-0 text-xs text-slate-400 hover:text-red-600"
              (click)="removeTool(tool)"
              aria-label="Remove tool"
            >
              ✕
            </button>
          </div>
        }
      }

      <!-- What actually went out. -->
      <div class="mt-6 mb-3 flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-700">
        <h3 class="text-sm font-semibold text-slate-900 dark:text-white">
          Expenses
          <span class="ml-1 font-normal text-slate-500">{{ expenses().length }}</span>
        </h3>
        <button type="button" class="text-sm font-medium text-blue-600" (click)="showExpenseForm.set(!showExpenseForm())">
          {{ showExpenseForm() ? 'Close' : '+ Log spend' }}
        </button>
      </div>

      @if (showExpenseForm()) {
        <form class="mb-3 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-4 dark:bg-slate-900/40" (ngSubmit)="addExpense()">
          <input
            [(ngModel)]="expenseTitle"
            name="expenseTitle"
            placeholder="What for"
            class="rounded-lg border border-slate-300 px-2 py-1 text-sm sm:col-span-2 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
          <input
            type="number"
            step="0.01"
            [(ngModel)]="expenseAmount"
            name="expenseAmount"
            placeholder="Amount"
            class="rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
          <input
            type="date"
            [(ngModel)]="expenseDate"
            name="expenseDate"
            class="rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
          <button type="submit" class="rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white sm:col-span-4">
            Log it
          </button>
        </form>
      }

      @if (expenses().length === 0) {
        <p class="text-sm text-slate-500">Nothing spent yet.</p>
      } @else {
        @for (expense of expenses(); track expense.id) {
          <div class="flex items-center gap-3 py-1.5">
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm text-slate-900 dark:text-white">{{ expense.title }}</p>
              <p class="text-xs text-slate-400">
                {{ expense.spentAt | date: 'd MMM yyyy' }}
                @if (expense.payee) {
                  · {{ expense.payee }}
                }
              </p>
            </div>
            <p
              class="shrink-0 text-sm tabular-nums"
              [class.text-green-600]="expense.amount < 0"
              [class.text-slate-700]="expense.amount >= 0"
            >
              {{ shown(expense.amount, expense.currency) }}
            </p>
            <button
              type="button"
              class="shrink-0 text-xs text-slate-400 hover:text-red-600"
              (click)="removeExpense(expense.id)"
              aria-label="Remove expense"
            >
              ✕
            </button>
          </div>
        }
      }
    </section>
  `
})
export class ProjectBudgetPanelComponent {
  readonly project = input.required<Project>();
  readonly milestones = input<Milestone[]>([]);
  readonly tasks = input<Task[]>([]);

  /** The project row belongs to ProjectsService, so the page saves the figure. */
  readonly budgetChanged = output<number | undefined>();

  private budgetService = inject(ProjectBudgetService);
  private toolkit = inject(ToolkitService);
  private currency = inject(CurrencyService);

  protected readonly homeCurrency = this.currency.home;

  protected readonly showItemForm = signal(false);
  protected readonly showToolForm = signal(false);
  protected readonly showPicker = signal(false);

  protected toolTitle = '';
  protected toolStatus: ToolStatus = 'buy';
  protected toolSource = '';
  protected toolCostDraft: number | null = null;
  protected toolRate: number | null = null;
  protected toolDays: number | null = null;
  protected readonly showExpenseForm = signal(false);
  protected readonly editingBudget = signal(false);

  protected budgetDraft: number | null = null;
  protected draftTitle = '';
  protected draftQuantity: number | null = 1;
  protected draftUnit = '';
  protected draftUnitCost: number | null = null;
  protected draftMilestone = '';

  protected expenseTitle = '';
  protected expenseAmount: number | null = null;
  protected expenseDate = new Date().toISOString().slice(0, 10);

  protected readonly items = computed(() => this.budgetService.itemsFor(this.project().id));
  protected readonly expenses = computed(() => this.budgetService.expensesFor(this.project().id));

  protected readonly tools = computed(() => this.budgetService.toolsFor(this.project().id));
  protected readonly toolsToGet = computed(() => this.budgetService.toolsToGet(this.project().id));

  protected readonly summary = computed(() =>
    this.budgetService.summaryFor(this.project().id, this.project().budget, this.currency.table())
  );

  /** Milestones in timeline order — the order the plan is read in. */
  protected readonly plan = computed(() => {
    const order = [...this.milestones()]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.targetDate.getTime() - b.targetDate.getTime())
      .map(milestone => milestone.id);

    return this.budgetService.planFor(this.project().id, order);
  });

  /** What each task was given, whether or not it has spent anything. */
  private readonly taskBudgets = computed(
    () => new Map(this.tasks().map(task => [task.id, task.budget]))
  );

  protected readonly allocation = computed(() =>
    this.budgetService.allocationFor(this.taskBudgets(), this.project().budget)
  );

  /** Only the tasks with money attached, biggest first — the ones worth reading. */
  protected readonly byTask = computed(() =>
    this.budgetService
      .rollUpFor(this.project().id, this.taskBudgets())
      .sort((a, b) => b.projected - a.projected)
  );

  protected taskTitle(taskId: string): string {
    return this.tasks().find(task => task.id === taskId)?.title ?? 'A task that has been deleted';
  }

  /** Two segments of one bar, clamped so an overspend cannot run off the end. */
  protected readonly barSpent = computed(() => this.share(this.summary().spent));
  protected readonly barCommitted = computed(() =>
    Math.max(0, Math.min(100 - this.barSpent(), this.share(this.summary().committed)))
  );

  private share(amount: number): number {
    const budget = this.project().budget;
    if (!budget) return amount > 0 ? 100 : 0;
    return Math.max(0, Math.min(100, Math.round((amount / budget) * 100)));
  }

  protected absRemaining(): number {
    return Math.abs(this.summary().remaining ?? 0);
  }

  /** Totals are always in the person's own currency — that is what home means. */
  protected money(amount: number): string {
    return formatMoney(amount, this.currency.home());
  }

  /**
   * A single amount, as it was written, plus the equivalent.
   *
   * An item bought from a supplier who bills in dollars stays $120 — that is
   * what the receipt says and what anyone will argue about — with the home
   * figure beside it, marked as the approximation it is.
   */
  protected shown(amount: number, code: string | undefined): string {
    return withEquivalent(amount, code, this.currency.table());
  }

  protected cost(item: ProjectItem): number {
    return itemCost(item);
  }

  protected costOfTool(tool: ProjectTool): number {
    return toolCost(tool);
  }

  protected toolClass(tool: ProjectTool): string {
    switch (tool.status) {
      case 'own':
        return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
      case 'borrow':
        return 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300';
      case 'hire':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
      default:
        return 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
    }
  }

  /** buy → hire → borrow → own → buy. One control, no menu. */
  protected cycleToolStatus(tool: ProjectTool): void {
    const next: Record<ToolStatus, ToolStatus> = {
      buy: 'hire',
      hire: 'borrow',
      borrow: 'own',
      own: 'buy'
    };
    this.budgetService.updateTool(tool.id, { status: next[tool.status] });
  }

  protected toggleInHand(tool: ProjectTool): void {
    this.budgetService.updateTool(tool.id, { inHand: !tool.inHand });
  }

  protected addTool(): void {
    const title = this.toolTitle.trim();
    if (!title) return;

    this.budgetService.addTool(this.project().id, {
      title,
      status: this.toolStatus,
      source: this.toolSource.trim() || undefined,
      purchaseCost: this.toolStatus === 'buy' ? (this.toolCostDraft ?? undefined) : undefined,
      hireRate: this.toolStatus === 'hire' ? (this.toolRate ?? undefined) : undefined,
      hireDays: this.toolStatus === 'hire' ? (this.toolDays ?? undefined) : undefined,
      currency: this.project().currency
    });

    this.toolTitle = '';
    this.toolSource = '';
    this.toolCostDraft = null;
    this.toolRate = null;
    this.toolDays = null;
  }

  protected removeTool(tool: ProjectTool): void {
    this.budgetService.deleteTool(tool.id);
  }

  protected outstanding(item: ProjectItem): number {
    return outstandingForItem(item, this.expenses());
  }

  protected milestoneTitle(id: string | undefined): string {
    if (!id) return 'Not in a stage';
    return this.milestones().find(milestone => milestone.id === id)?.title ?? 'Not in a stage';
  }

  protected statusClass(status: ItemStatus): string {
    switch (status) {
      case 'have':
        return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
      case 'ordered':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
      default:
        return 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
    }
  }

  /** needed → ordered → have → needed. One control, no menu. */
  protected nextStatus(status: ItemStatus): ItemStatus {
    return status === 'needed' ? 'ordered' : status === 'ordered' ? 'have' : 'needed';
  }

  protected cycleStatus(item: ProjectItem): void {
    this.budgetService.updateItem(item.id, { status: this.nextStatus(item.status) });
  }

  protected startEditingBudget(): void {
    this.budgetDraft = this.project().budget ?? null;
    this.editingBudget.set(true);
  }

  protected saveBudget(): void {
    this.budgetChanged.emit(this.budgetDraft ?? undefined);
    this.editingBudget.set(false);
  }

  /** The user's kit, as options for the prefill picker. */
  protected readonly toolkitOptions = computed(() =>
    this.toolkit
      .live()
      .filter(item => TOOLKIT_KIND_META[item.kind].costed)
      .map(item => ({
        id: item.id,
        label: `${iconFor(item)} ${item.title}${item.supplier ? ' · ' + item.supplier : ''}`
      }))
  );

  protected prefillFromToolkit(id: string): void {
    const item = id ? this.toolkit.find(id) : undefined;
    if (!item) return;

    const draft = toProjectItemDraft(item);
    this.draftTitle = draft.title;
    this.draftUnit = draft.unit ?? '';
    this.draftUnitCost = draft.unitCost ?? null;
    // Quantity stays at whatever the form had — see the note in the template.
  }

  protected addItem(): void {
    const title = this.draftTitle.trim();
    if (!title) return;

    this.budgetService.addItem(this.project().id, {
      title,
      quantity: this.draftQuantity ?? 1,
      unit: this.draftUnit.trim() || undefined,
      unitCost: this.draftUnitCost ?? undefined,
      milestoneId: this.draftMilestone || undefined,
      currency: this.project().currency
    });

    this.draftTitle = '';
    this.draftQuantity = 1;
    this.draftUnit = '';
    this.draftUnitCost = null;
  }

  protected removeItem(item: ProjectItem): void {
    this.budgetService.deleteItem(item.id);
  }

  protected buy(item: ProjectItem): void {
    this.budgetService.buyItem(item.id);
  }

  protected addExpense(): void {
    const title = this.expenseTitle.trim();
    if (!title || this.expenseAmount === null) return;

    this.budgetService.addExpense(this.project().id, {
      title,
      amount: this.expenseAmount,
      // A date input gives 'YYYY-MM-DD'; splitting it keeps the day the user
      // picked instead of shifting it a timezone.
      spentAt: fromDateInput(this.expenseDate),
      currency: this.project().currency
    });

    this.expenseTitle = '';
    this.expenseAmount = null;
  }

  protected removeExpense(id: string): void {
    this.budgetService.deleteExpense(id);
  }
}

function fromDateInput(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}
