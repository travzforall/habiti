import { Injectable, computed, inject, signal } from '@angular/core';
import { UserStorage } from '@habiti/storage';
import { SyncBus } from '@habiti/sync';
import { ProjectTool, ProjectToolRow, fromProjectTool, toProjectTool } from '../models/tool.models';
import { stillToGet, toReturn } from '../config/tool-cost';
import {
  ProjectExpense,
  ProjectExpenseRow,
  ProjectItem,
  ProjectItemRow,
  fromProjectExpense,
  fromProjectItem,
  toProjectExpense,
  toProjectItem
} from '../models/budget.models';
import {
  Allocation,
  BudgetSummary,
  TaskRollUp,
  allocation,
  planByMilestone,
  rollUpByTask,
  summarise
} from '../config/budget-math';
import { RateTable } from '../config/currency';
import { AuthService } from './auth.service';
import { BaserowService } from './baserow.service';
import { ResettableRegistry } from './resettable.registry';

/**
 * A project's money: what it needs to buy, and what it has spent.
 *
 * Both lists live here rather than in two services because nothing ever wants
 * one without the other — every number worth showing (committed, projected,
 * what an item still owes) is a function of both.
 *
 * Local-first, like the rest: the signal is the truth for the session, writes
 * go to Baserow behind it, and a table id of 0 means "no table yet, keep it in
 * this browser" with one warning rather than a failure on every keystroke.
 */
/**
 * The rows that exist only in this browser.
 *
 * These tables did not exist until recently, so an account can hold items and
 * expenses the server has never seen. A server list that comes back empty is
 * ambiguous — "nothing here" and "this table is new" look identical — and
 * resolving it by replacing the local list would delete someone's shopping
 * list and their receipts. A local id is not a number; a row id always is.
 */
function onlyLocal<T extends { id: string }>(current: readonly T[], fromServer: readonly T[]): T[] {
  const known = new Set(fromServer.map(row => row.id));
  return current.filter(row => !known.has(row.id) && !Number.isFinite(Number(row.id)));
}

@Injectable({ providedIn: 'root' })
export class ProjectBudgetService {
  private readonly ITEMS_KEY = 'habiti_project_items';
  private readonly EXPENSES_KEY = 'habiti_project_expenses';
  private readonly TOOLS_KEY = 'habiti_project_tools';

  private storage = inject(UserStorage);
  private auth = inject(AuthService);
  private baserow = inject(BaserowService);
  private syncBus = inject(SyncBus);

  private _items = signal<ProjectItem[]>([]);
  private _expenses = signal<ProjectExpense[]>([]);
  private _tools = signal<ProjectTool[]>([]);

  readonly items = this._items.asReadonly();
  readonly expenses = this._expenses.asReadonly();
  readonly tools = this._tools.asReadonly();

  private warned = false;

  constructor() {
    inject(ResettableRegistry).register(this, ['projects']);
    this.loadCache();
    this.loadFromServer();
  }

  private get itemsTable(): number {
    return this.baserow.tables?.projectItems ?? 0;
  }

  private get expensesTable(): number {
    return this.baserow.tables?.projectExpenses ?? 0;
  }

  private get toolsTable(): number {
    return this.baserow.tables?.projectTools ?? 0;
  }

  private userId(): string | null {
    const id = this.auth.currentUserValue?.id;
    return id !== undefined && id !== null ? String(id) : null;
  }

  // --- reading -------------------------------------------------------------

  itemsFor(projectId: string): ProjectItem[] {
    return this._items()
      .filter(item => item.projectId === projectId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  expensesFor(projectId: string): ProjectExpense[] {
    return this._expenses()
      .filter(expense => expense.projectId === projectId)
      .sort((a, b) => b.spentAt.getTime() - a.spentAt.getTime());
  }

  itemsForTask(taskId: string): ProjectItem[] {
    return this._items()
      .filter(item => item.taskId === taskId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  expensesForTask(taskId: string): ProjectExpense[] {
    return this._expenses()
      .filter(expense => expense.taskId === taskId)
      .sort((a, b) => b.spentAt.getTime() - a.spentAt.getTime());
  }

  /**
   * One task's money.
   *
   * The same items and expenses also belong to the task's project, so this is
   * a VIEW of the project's money rather than a second pot — nothing is counted
   * twice, and a task's spending shows in both places because it is in both
   * places.
   */
  summaryForTask(taskId: string, budget?: number, rates?: RateTable): BudgetSummary {
    return summarise(
      this.itemsForTask(taskId),
      this.expensesForTask(taskId),
      budget,
      rates,
      this.toolsForTask(taskId)
    );
  }

  /** Every task under a project that has a budget, an item or an expense. */
  rollUpFor(projectId: string, budgets: ReadonlyMap<string, number | undefined>): TaskRollUp[] {
    return rollUpByTask(this.itemsFor(projectId), this.expensesFor(projectId), budgets);
  }

  /** How much of a project's budget has been handed out to its tasks. */
  allocationFor(
    budgets: ReadonlyMap<string, number | undefined>,
    projectBudget?: number
  ): Allocation {
    return allocation([...budgets.values()], projectBudget);
  }

  toolsFor(projectId: string): ProjectTool[] {
    return this._tools()
      .filter(tool => tool.projectId === projectId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  toolsForTask(taskId: string): ProjectTool[] {
    return this._tools().filter(tool => tool.taskId === taskId);
  }

  /** What a project still has to lay hands on. */
  toolsToGet(projectId: string): ProjectTool[] {
    return stillToGet(this.toolsFor(projectId));
  }

  /** Borrowed and hired tools with a date on them, soonest first. */
  toolsToReturn(projectId: string): ProjectTool[] {
    return toReturn(this.toolsFor(projectId));
  }

  /** Everything a project's budget can say, in one object. */
  summaryFor(projectId: string, budget?: number, rates?: RateTable): BudgetSummary {
    return summarise(
      this.itemsFor(projectId),
      this.expensesFor(projectId),
      budget,
      rates,
      this.toolsFor(projectId)
    );
  }

  /** The item plan: what to buy, staged by milestone, with a running total. */
  planFor(projectId: string, milestoneOrder: readonly string[]) {
    return planByMilestone(this.itemsFor(projectId), milestoneOrder);
  }

  /** Everything, for a dashboard that wants one number across all projects. */
  readonly totalOutstanding = computed(() =>
    summarise(this._items(), this._expenses()).committed
  );

  // --- items ---------------------------------------------------------------

  addItem(projectId: string, data: Partial<ProjectItem>): ProjectItem {
    const existing = this.itemsFor(projectId);
    const item: ProjectItem = {
      id: this.generateId(),
      projectId,
      taskId: data.taskId,
      milestoneId: data.milestoneId,
      title: data.title?.trim() || 'New item',
      quantity: data.quantity ?? 1,
      unit: data.unit,
      unitCost: data.unitCost,
      currency: data.currency,
      status: data.status ?? 'needed',
      supplier: data.supplier,
      url: data.url,
      note: data.note,
      plannedFor: data.plannedFor,
      sortOrder:
        data.sortOrder ??
        (existing.length > 0 ? Math.max(...existing.map(i => i.sortOrder ?? 0)) + 1 : 1)
    };

    this._items.update(items => [...items, item]);
    this.save();
    this.persistItem(item);
    return item;
  }

  updateItem(itemId: string, updates: Partial<ProjectItem>): void {
    let updated: ProjectItem | undefined;
    this._items.update(items =>
      items.map(item => {
        if (item.id !== itemId) return item;
        updated = { ...item, ...updates };
        return updated;
      })
    );
    this.save();
    if (updated) this.persistItem(updated);
  }

  deleteItem(itemId: string): void {
    this._items.update(items => items.filter(item => item.id !== itemId));
    // The spending stays. Money that left the account is a fact, and deleting
    // the shopping-list line it was attached to does not unspend it.
    this._expenses.update(expenses =>
      expenses.map(expense =>
        expense.itemId === itemId ? { ...expense, itemId: undefined } : expense
      )
    );
    this.save();
    this.removeRow(this.itemsTable, itemId);
  }

  // --- tools ---------------------------------------------------------------

  addTool(projectId: string, data: Partial<ProjectTool>): ProjectTool {
    const existing = this.toolsFor(projectId);
    const tool: ProjectTool = {
      id: this.generateId(),
      projectId,
      taskId: data.taskId,
      milestoneId: data.milestoneId,
      title: data.title?.trim() || 'New tool',
      // Buy, not own: guessing "own" would drop it off the list of things to
      // get hold of AND off the budget, invisibly. See tool.models.ts.
      status: data.status ?? 'buy',
      source: data.source,
      purchaseCost: data.purchaseCost,
      hireRate: data.hireRate,
      hireDays: data.hireDays,
      currency: data.currency,
      neededBy: data.neededBy,
      returnBy: data.returnBy,
      inHand: data.inHand ?? false,
      note: data.note,
      sortOrder:
        data.sortOrder ??
        (existing.length > 0 ? Math.max(...existing.map(t => t.sortOrder ?? 0)) + 1 : 1)
    };

    this._tools.update(tools => [...tools, tool]);
    this.save();
    this.persistTool(tool);
    return tool;
  }

  updateTool(toolId: string, updates: Partial<ProjectTool>): void {
    let updated: ProjectTool | undefined;
    this._tools.update(tools =>
      tools.map(tool => {
        if (tool.id !== toolId) return tool;
        updated = { ...tool, ...updates };
        return updated;
      })
    );
    this.save();
    if (updated) this.persistTool(updated);
  }

  deleteTool(toolId: string): void {
    this._tools.update(tools => tools.filter(tool => tool.id !== toolId));
    this.save();
    this.removeRow(this.toolsTable, toolId);
  }

  // --- expenses ------------------------------------------------------------

  addExpense(projectId: string, data: Partial<ProjectExpense>): ProjectExpense {
    const expense: ProjectExpense = {
      id: this.generateId(),
      projectId,
      taskId: data.taskId,
      itemId: data.itemId,
      title: data.title?.trim() || 'Expense',
      amount: data.amount ?? 0,
      currency: data.currency,
      spentAt: data.spentAt ?? new Date(),
      category: data.category,
      payee: data.payee,
      note: data.note
    };

    this._expenses.update(expenses => [...expenses, expense]);
    this.save();
    this.persistExpense(expense);
    return expense;
  }

  updateExpense(expenseId: string, updates: Partial<ProjectExpense>): void {
    let updated: ProjectExpense | undefined;
    this._expenses.update(expenses =>
      expenses.map(expense => {
        if (expense.id !== expenseId) return expense;
        updated = { ...expense, ...updates };
        return updated;
      })
    );
    this.save();
    if (updated) this.persistExpense(updated);
  }

  deleteExpense(expenseId: string): void {
    this._expenses.update(expenses => expenses.filter(expense => expense.id !== expenseId));
    this.save();
    this.removeRow(this.expensesTable, expenseId);
  }

  /**
   * Records having bought an item: one expense, and the item marked as in hand.
   *
   * The two belong together — an item bought without the spend recorded makes
   * the budget look better than it is, which is the failure mode that matters.
   */
  buyItem(itemId: string, paid?: number, payee?: string): ProjectExpense | undefined {
    const item = this._items().find(candidate => candidate.id === itemId);
    if (!item) return undefined;

    const amount = paid ?? (item.unitCost ?? 0) * (item.quantity ?? 1);
    const expense = this.addExpense(item.projectId, {
      title: item.title,
      amount,
      itemId: item.id,
      taskId: item.taskId,
      category: 'materials',
      payee: payee ?? item.supplier,
      spentAt: new Date()
    });

    this.updateItem(item.id, { status: 'have' });
    return expense;
  }

  // --- persistence ---------------------------------------------------------

  private persistItem(item: ProjectItem): void {
    const userId = this.userId();
    if (!userId) return;
    if (!this.itemsTable) return void this.warnOnce();

    const data = fromProjectItem(item, userId);
    const rowId = Number(item.id);
    const request = Number.isFinite(rowId)
      ? this.baserow.updateRow<ProjectItemRow>(this.itemsTable, rowId, data)
      : this.baserow.createRow<ProjectItemRow>(this.itemsTable, data);

    request.subscribe({
      next: row => {
        if (row && !Number.isFinite(rowId)) {
          const serverId = String(row.id);
          this._items.update(items =>
            items.map(candidate =>
              candidate.id === item.id ? { ...candidate, id: serverId } : candidate
            )
          );
          // Expenses already pointing at the local id have to follow it.
          this._expenses.update(expenses =>
            expenses.map(expense =>
              expense.itemId === item.id ? { ...expense, itemId: serverId } : expense
            )
          );
          this.save();
        }
        this.syncBus.touched('projects');
      },
      error: err => console.warn('ProjectBudgetService: item not saved.', err)
    });
  }

  private persistExpense(expense: ProjectExpense): void {
    const userId = this.userId();
    if (!userId) return;
    if (!this.expensesTable) return void this.warnOnce();

    const data = fromProjectExpense(expense, userId);
    const rowId = Number(expense.id);
    const request = Number.isFinite(rowId)
      ? this.baserow.updateRow<ProjectExpenseRow>(this.expensesTable, rowId, data)
      : this.baserow.createRow<ProjectExpenseRow>(this.expensesTable, data);

    request.subscribe({
      next: row => {
        if (row && !Number.isFinite(rowId)) {
          const serverId = String(row.id);
          this._expenses.update(expenses =>
            expenses.map(candidate =>
              candidate.id === expense.id ? { ...candidate, id: serverId } : candidate
            )
          );
          this.save();
        }
        this.syncBus.touched('projects');
      },
      error: err => console.warn('ProjectBudgetService: expense not saved.', err)
    });
  }

  private persistTool(tool: ProjectTool): void {
    const userId = this.userId();
    if (!userId) return;
    if (!this.toolsTable) return void this.warnOnce();

    const data = fromProjectTool(tool, userId);
    const rowId = Number(tool.id);
    const request = Number.isFinite(rowId)
      ? this.baserow.updateRow<ProjectToolRow>(this.toolsTable, rowId, data)
      : this.baserow.createRow<ProjectToolRow>(this.toolsTable, data);

    request.subscribe({
      next: row => {
        if (row && !Number.isFinite(rowId)) {
          const serverId = String(row.id);
          this._tools.update(tools =>
            tools.map(candidate =>
              candidate.id === tool.id ? { ...candidate, id: serverId } : candidate
            )
          );
          this.save();
        }
        this.syncBus.touched('projects');
      },
      error: err => console.warn('ProjectBudgetService: tool not saved.', err)
    });
  }

  private removeRow(table: number, id: string): void {
    const rowId = Number(id);
    if (!table || !Number.isFinite(rowId)) return;
    this.baserow.deleteRow(table, rowId).subscribe({
      error: err => console.warn('ProjectBudgetService: row not deleted.', err)
    });
  }

  private loadFromServer(): void {
    const userId = this.userId();
    if (!userId) return;
    if (!this.itemsTable || !this.expensesTable) return void this.warnOnce();

    this.baserow
      .listAllRows<ProjectItemRow>(this.itemsTable, {
        filters: [{ field: 'user_id', op: 'equal', value: userId }]
      })
      .subscribe({
        next: rows => {
          const fromServer = (rows ?? []).map(toProjectItem);
          const localOnly = onlyLocal(this._items(), fromServer);

          this._items.set([...fromServer, ...localOnly]);
          this.save();
          for (const item of localOnly) this.persistItem(item);
        },
        error: err => console.warn('ProjectBudgetService: could not load items.', err)
      });

    if (this.toolsTable) {
      this.baserow
        .listAllRows<ProjectToolRow>(this.toolsTable, {
          filters: [{ field: 'user_id', op: 'equal', value: userId }]
        })
        .subscribe({
          next: rows => {
            const fromServer = (rows ?? []).map(toProjectTool);
            const localOnly = onlyLocal(this._tools(), fromServer);

            this._tools.set([...fromServer, ...localOnly]);
            this.save();
            for (const tool of localOnly) this.persistTool(tool);
          },
          error: err => console.warn('ProjectBudgetService: could not load tools.', err)
        });
    }

    this.baserow
      .listAllRows<ProjectExpenseRow>(this.expensesTable, {
        filters: [{ field: 'user_id', op: 'equal', value: userId }]
      })
      .subscribe({
        next: rows => {
          const fromServer = (rows ?? []).map(toProjectExpense);
          const localOnly = onlyLocal(this._expenses(), fromServer);

          this._expenses.set([...fromServer, ...localOnly]);
          this.save();
          for (const expense of localOnly) this.persistExpense(expense);
        },
        error: err => console.warn('ProjectBudgetService: could not load expenses.', err)
      });
  }

  reload(): void {
    this._items.set([]);
    this._expenses.set([]);
    this._tools.set([]);
    this.warned = false;
    this.loadCache();
    this.loadFromServer();
  }

  private loadCache(): void {
    try {
      const items = this.storage.readRaw(this.ITEMS_KEY);
      if (items) {
        this._items.set(
          (JSON.parse(items) as ProjectItem[]).map(item => ({
            ...item,
            plannedFor: item.plannedFor ? new Date(item.plannedFor) : undefined
          }))
        );
      }

      const tools = this.storage.readRaw(this.TOOLS_KEY);
      if (tools) {
        this._tools.set(
          (JSON.parse(tools) as ProjectTool[]).map(tool => ({
            ...tool,
            neededBy: tool.neededBy ? new Date(tool.neededBy) : undefined,
            returnBy: tool.returnBy ? new Date(tool.returnBy) : undefined
          }))
        );
      }

      const expenses = this.storage.readRaw(this.EXPENSES_KEY);
      if (expenses) {
        this._expenses.set(
          (JSON.parse(expenses) as ProjectExpense[]).map(expense => ({
            ...expense,
            spentAt: new Date(expense.spentAt)
          }))
        );
      }
    } catch (error) {
      console.error('ProjectBudgetService: could not read the cache.', error);
    }
  }

  private save(): void {
    try {
      this.storage.writeRaw(this.ITEMS_KEY, JSON.stringify(this._items()));
      this.storage.writeRaw(this.EXPENSES_KEY, JSON.stringify(this._expenses()));
      this.storage.writeRaw(this.TOOLS_KEY, JSON.stringify(this._tools()));
    } catch (error) {
      console.error('ProjectBudgetService: could not write the cache.', error);
    }
  }

  private warnOnce(): void {
    if (this.warned) return;
    this.warned = true;
    console.warn(
      'ProjectBudgetService: tables.projectItems / projectExpenses are 0 — the ' +
        'item and expense lists stay on this browser. Create them with: ' +
        'npm run db:setup -- --apply --write-env'
    );
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
}
