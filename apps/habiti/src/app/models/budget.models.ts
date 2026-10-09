import {
  BaserowSelect,
  parseDateOnly,
  selectValue,
  toDateOnly
} from './task-row.models';

/**
 * The item list and the expense list — a project's money, in two halves.
 *
 * An ITEM is a decision to spend: ten bags of Quikrete, not yet bought. An
 * EXPENSE is money gone. They are separate types over separate tables because
 * the useful questions need both apart: what have I actually paid, and what is
 * this still going to cost me. See config/budget-math.ts for the arithmetic.
 */

export type ItemStatus = 'needed' | 'ordered' | 'have';

export interface ProjectItem {
  id: string;
  projectId: string;
  /** The task that needs it, when it is that specific. */
  taskId?: string;
  /** The stage it belongs to — what the item plan groups by. */
  milestoneId?: string;
  title: string;
  quantity?: number;
  /** bags, m², each. Free text: a fixed list is wrong by the second job. */
  unit?: string;
  unitCost?: number;
  currency?: string;
  status: ItemStatus;
  supplier?: string;
  url?: string;
  note?: string;
  plannedFor?: Date;
  sortOrder?: number;
}

export interface ProjectExpense {
  id: string;
  projectId: string;
  taskId?: string;
  /** The item this paid for, so an item can show as settled. */
  itemId?: string;
  title: string;
  /** Positive. A refund is negative, so one sum is always the truth. */
  amount: number;
  currency?: string;
  spentAt: Date;
  category?: string;
  payee?: string;
  note?: string;
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export interface ProjectItemRow {
  id: number;
  title?: string;
  user_id?: string;
  project_id?: string | null;
  task_id?: string | null;
  milestone_id?: string | null;
  quantity?: number | string | null;
  unit?: string | null;
  unit_cost?: number | string | null;
  currency?: string | null;
  status?: string | BaserowSelect | null;
  supplier?: string | null;
  url?: string | null;
  note?: string | null;
  planned_for?: string | null;
  sort_order?: number | string | null;
}

export interface ProjectExpenseRow {
  id: number;
  title?: string;
  user_id?: string;
  project_id?: string | null;
  task_id?: string | null;
  item_id?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  spent_at?: string | null;
  category?: string | null;
  payee?: string | null;
  note?: string | null;
}

/** Every column the mappers may write. Asserted by budget.models.spec.ts. */
export const PROJECT_ITEM_COLUMNS = [
  'title',
  'user_id',
  'project_id',
  'task_id',
  'milestone_id',
  'quantity',
  'unit',
  'unit_cost',
  'currency',
  'status',
  'supplier',
  'url',
  'note',
  'planned_for',
  'sort_order'
] as const;

export const PROJECT_EXPENSE_COLUMNS = [
  'title',
  'user_id',
  'project_id',
  'task_id',
  'item_id',
  'amount',
  'currency',
  'spent_at',
  'category',
  'payee',
  'note'
] as const;

const ITEM_STATUSES: readonly ItemStatus[] = ['needed', 'ordered', 'have'];

/** An unknown status would fail the whole row, so it becomes `needed`. */
function statusOrDefault(value: string): ItemStatus {
  return (ITEM_STATUSES as readonly string[]).includes(value) ? (value as ItemStatus) : 'needed';
}

function numberOrUndefined(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function toProjectItem(row: ProjectItemRow): ProjectItem {
  return {
    id: String(row.id),
    projectId: row.project_id?.trim() ?? '',
    taskId: row.task_id || undefined,
    milestoneId: row.milestone_id || undefined,
    title: row.title ?? '',
    quantity: numberOrUndefined(row.quantity),
    unit: row.unit || undefined,
    unitCost: numberOrUndefined(row.unit_cost),
    currency: row.currency || undefined,
    status: statusOrDefault(selectValue(row.status)),
    supplier: row.supplier || undefined,
    url: row.url || undefined,
    note: row.note || undefined,
    plannedFor: parseDateOnly(row.planned_for),
    sortOrder: numberOrUndefined(row.sort_order)
  };
}

export function fromProjectItem(item: ProjectItem, userId: string): Record<string, unknown> {
  return {
    title: item.title,
    user_id: userId,
    project_id: item.projectId,
    task_id: item.taskId ?? '',
    milestone_id: item.milestoneId ?? '',
    quantity: item.quantity ?? 1,
    unit: item.unit ?? '',
    unit_cost: item.unitCost ?? null,
    currency: item.currency ?? '',
    status: item.status,
    supplier: item.supplier ?? '',
    url: item.url ?? '',
    note: item.note ?? '',
    planned_for: toDateOnly(item.plannedFor),
    sort_order: item.sortOrder ?? 0
  };
}

export function toProjectExpense(row: ProjectExpenseRow): ProjectExpense {
  return {
    id: String(row.id),
    projectId: row.project_id?.trim() ?? '',
    taskId: row.task_id || undefined,
    itemId: row.item_id || undefined,
    title: row.title ?? '',
    amount: numberOrUndefined(row.amount) ?? 0,
    currency: row.currency || undefined,
    // An expense with no date still needs one — it sorts and groups by date,
    // and an Invalid Date poisons every comparison it takes part in.
    spentAt: parseDateOnly(row.spent_at) ?? new Date(),
    category: row.category || undefined,
    payee: row.payee || undefined,
    note: row.note || undefined
  };
}

export function fromProjectExpense(
  expense: ProjectExpense,
  userId: string
): Record<string, unknown> {
  return {
    title: expense.title,
    user_id: userId,
    project_id: expense.projectId,
    task_id: expense.taskId ?? '',
    item_id: expense.itemId ?? '',
    amount: expense.amount,
    currency: expense.currency ?? '',
    spent_at: toDateOnly(expense.spentAt),
    category: expense.category ?? '',
    payee: expense.payee ?? '',
    note: expense.note ?? ''
  };
}
