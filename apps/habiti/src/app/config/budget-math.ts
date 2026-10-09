/**
 * What a project has spent, what it has promised, and what is left.
 *
 * ── WHY EVERYTHING IS IN MINOR UNITS ──────────────────────────────────────
 *
 * 0.1 + 0.2 is 0.30000000000000004, and a budget is nothing but a long column
 * of those. Ten bags at £6.50 summed as pounds drifts; summed as 650 pence it
 * cannot. So every total is computed in whole pence and converted back once, at
 * the end, where a human reads it.
 *
 * ── AND WHY COMMITTED IS NOT SPENT ────────────────────────────────────────
 *
 * An item is a decision to spend; an expense is money gone. A budget that adds
 * them together answers neither "how much have I actually paid" nor "how much
 * is this going to cost me". Keeping them apart is the point of the whole
 * feature: `projected` is the number that tells you whether to worry.
 */

import { RateTable, hasRate, missingRates, toHome } from './currency';
import { CostedTool, toolsCommittedMinor } from './tool-cost';
import { fromMinor, toMinor } from './money';

// Re-exported so every caller keeps importing money helpers from one place.
export { fromMinor, toMinor };

export interface CostedItem {
  id: string;
  /** Blank means the home currency. */
  currency?: string;
  quantity?: number;
  unitCost?: number;
  status?: 'needed' | 'ordered' | 'have';
  milestoneId?: string;
  taskId?: string;
  plannedFor?: Date;
}

export interface CostedExpense {
  id: string;
  amount: number;
  /** Blank means the home currency. */
  currency?: string;
  itemId?: string;
  taskId?: string;
  spentAt?: Date;
}

export interface BudgetSummary {
  /** What was set aside. Undefined when no budget has been set. */
  budget?: number;
  /** Money that has actually left the account. */
  spent: number;
  /** Cost of items decided on but not yet paid for. */
  committed: number;
  /** spent + committed: what this is heading towards. */
  projected: number;
  /** budget - projected. Negative means over. Undefined without a budget. */
  remaining?: number;
  /** How far through the budget the projection is, 0-100+. */
  usedPct?: number;
  over: boolean;
  /**
   * Currencies present here that could not be converted.
   *
   * Their amounts are NOT in the totals above. A sum is either right or
   * visibly incomplete; it is never quietly wrong.
   */
  unconverted: string[];
}

/** What one line of the item list costs, in minor units. */
export function itemCostMinor(item: CostedItem): number {
  const quantity = Number.isFinite(item.quantity) ? (item.quantity as number) : 1;
  return Math.round(toMinor(item.unitCost) * quantity);
}

export function itemCost(item: CostedItem): number {
  return fromMinor(itemCostMinor(item));
}

/**
 * The cost still to come: everything not yet in hand.
 *
 * `have` is excluded because it is either already paid for — and therefore an
 * expense — or it was free. Counting it here would show every finished project
 * as still owing the price of everything it ever used.
 */
export function committedMinor(items: readonly CostedItem[]): number {
  return items
    .filter(item => item.status !== 'have')
    .reduce((total, item) => total + itemCostMinor(item), 0);
}

export function spentMinor(expenses: readonly CostedExpense[]): number {
  return expenses.reduce((total, expense) => total + toMinor(expense.amount), 0);
}

export function summarise(
  items: readonly CostedItem[],
  expenses: readonly CostedExpense[],
  budget?: number,
  rates?: RateTable,
  tools: readonly CostedTool[] = []
): BudgetSummary {
  // Without a rate table there is one currency and nothing to convert; with
  // one, anything that cannot be converted is left out and named.
  const usable = <T extends { currency?: string }>(rows: readonly T[]) =>
    rates ? rows.filter(row => hasRate(row.currency, rates)) : rows;

  const spent = rates
    ? usable(expenses).reduce(
        (total, expense) => total + toMinor(toHome(expense.amount, expense.currency, rates) ?? 0),
        0
      )
    : spentMinor(expenses);

  const committed = rates
    ? usable(items)
        .filter(item => item.status !== 'have')
        .reduce(
          (total, item) =>
            total + toMinor(toHome(fromMinor(itemCostMinor(item)), item.currency, rates) ?? 0),
          0
        )
    : committedMinor(items);

  // Tools you own or have been lent cost nothing; hire and purchase do, until
  // a bought one is in hand and has become an expense. See config/tool-cost.ts.
  const toolsCommitted = toolsCommittedMinor(tools);

  const projected = spent + committed + toolsCommitted;
  const budgetMinor = budget === undefined ? undefined : toMinor(budget);
  const unconverted = rates
    ? missingRates(
        [...items.map(item => item.currency), ...expenses.map(expense => expense.currency)],
        rates
      )
    : [];

  return {
    budget,
    spent: fromMinor(spent),
    committed: fromMinor(committed + toolsCommitted),
    projected: fromMinor(projected),
    remaining: budgetMinor === undefined ? undefined : fromMinor(budgetMinor - projected),
    // A zero budget with anything projected is 100% used, not divide-by-zero.
    usedPct:
      budgetMinor === undefined
        ? undefined
        : budgetMinor === 0
          ? projected > 0
            ? 100
            : 0
          : Math.round((projected / budgetMinor) * 100),
    over: budgetMinor !== undefined && projected > budgetMinor,
    unconverted
  };
}

export interface PlanGroup<T> {
  /** The milestone these items belong to, or undefined for the loose ones. */
  key: string | undefined;
  items: T[];
  subtotal: number;
  /** Everything up to and including this group. */
  runningTotal: number;
}

/**
 * The item plan: what to buy, in the order the work needs it.
 *
 * Grouped by milestone because that is already how the project is staged, and
 * a running total because the useful question is not "what does stage three
 * cost" but "what will I have spent by the time stage three is done".
 *
 * Items with no milestone come LAST, not first: they are the unscheduled ones,
 * and putting them at the top would push the running total out of order.
 */
export function planByMilestone<T extends CostedItem>(
  items: readonly T[],
  milestoneOrder: readonly string[]
): PlanGroup<T>[] {
  const position = new Map(milestoneOrder.map((id, index) => [id, index]));
  const groups = new Map<string | undefined, T[]>();

  for (const item of items) {
    // A milestone that is not in the order (deleted, or on another device) is
    // treated as none at all, so its items are shown rather than lost.
    const key = item.milestoneId && position.has(item.milestoneId) ? item.milestoneId : undefined;
    const existing = groups.get(key);
    if (existing) existing.push(item);
    else groups.set(key, [item]);
  }

  const ordered = [...groups.entries()].sort(([a], [b]) => {
    if (a === undefined) return 1;
    if (b === undefined) return -1;
    return (position.get(a) ?? 0) - (position.get(b) ?? 0);
  });

  let running = 0;
  return ordered.map(([key, group]) => {
    const subtotal = group.reduce((total, item) => total + itemCostMinor(item), 0);
    running += subtotal;
    return {
      key,
      items: group,
      subtotal: fromMinor(subtotal),
      runningTotal: fromMinor(running)
    };
  });
}

export interface Allocation {
  /** The sum of the task budgets under this project. */
  allocated: number;
  /** Project budget less what has been handed out. Negative means over. */
  unallocated?: number;
  /** More promised to tasks than the project has. */
  overAllocated: boolean;
  /** How much of the project budget has been handed out, 0-100+. */
  allocatedPct?: number;
}

/**
 * How much of a project's budget has been given to its tasks.
 *
 * A separate question from spending, and it goes wrong earlier. Handing £900,
 * £800 and £700 to three tasks inside a £2,000 project is a problem the moment
 * the third budget is typed — months before a penny moves and while it is still
 * cheap to fix. Nothing here stops it; it is reported, like every other limit
 * in this app.
 *
 * Tasks with no budget of their own count as nothing, not as zero-cost: they
 * are simply unbudgeted, and their spending still lands on the project.
 */
export function allocation(
  taskBudgets: readonly (number | undefined)[],
  projectBudget?: number
): Allocation {
  const allocatedMinor = taskBudgets.reduce<number>(
    (total, budget) => total + toMinor(budget),
    0
  );
  const projectMinor = projectBudget === undefined ? undefined : toMinor(projectBudget);

  return {
    allocated: fromMinor(allocatedMinor),
    unallocated: projectMinor === undefined ? undefined : fromMinor(projectMinor - allocatedMinor),
    overAllocated: projectMinor !== undefined && allocatedMinor > projectMinor,
    allocatedPct:
      projectMinor === undefined
        ? undefined
        : projectMinor === 0
          ? allocatedMinor > 0
            ? 100
            : 0
          : Math.round((allocatedMinor / projectMinor) * 100)
  };
}

/** One task's line in the project's money: what it was given, what it will cost. */
export interface TaskRollUp {
  taskId: string;
  budget?: number;
  spent: number;
  committed: number;
  projected: number;
  /** budget - projected, when there is a budget. */
  remaining?: number;
  over: boolean;
}

/**
 * Every task that has money attached, rolled up.
 *
 * "Has money attached" means a budget, an item or an expense — a task with none
 * of the three is left out, because a project of forty tasks would otherwise
 * show thirty-eight empty rows to find the two that matter.
 */
export function rollUpByTask(
  items: readonly CostedItem[],
  expenses: readonly CostedExpense[],
  budgets: ReadonlyMap<string, number | undefined>
): TaskRollUp[] {
  const ids = new Set<string>();
  for (const item of items) if (item.taskId) ids.add(item.taskId);
  for (const expense of expenses) if (expense.taskId) ids.add(expense.taskId);
  for (const [id, budget] of budgets) if (budget !== undefined) ids.add(id);

  return [...ids].map(taskId => {
    const summary = summarise(
      items.filter(item => item.taskId === taskId),
      expenses.filter(expense => expense.taskId === taskId),
      budgets.get(taskId)
    );

    return {
      taskId,
      budget: summary.budget,
      spent: summary.spent,
      committed: summary.committed,
      projected: summary.projected,
      remaining: summary.remaining,
      over: summary.over
    };
  });
}

/** What an item still owes: its cost, less anything already paid against it. */
export function outstandingForItem(
  item: CostedItem,
  expenses: readonly CostedExpense[]
): number {
  const paid = expenses
    .filter(expense => expense.itemId === item.id)
    .reduce((total, expense) => total + toMinor(expense.amount), 0);

  return fromMinor(Math.max(itemCostMinor(item) - paid, 0));
}

/** Formats money for display. Falls back to a plain number for an unknown code. */
export function formatMoney(amount: number, currency = 'GBP'): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
}
