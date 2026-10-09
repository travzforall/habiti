import { ToolStatus } from '../config/tool-cost';
import { BaserowSelect, parseDateOnly, selectValue, toDateOnly } from './task-row.models';

/**
 * A tool a job needs — owned, borrowed, hired, or still to buy.
 *
 * Kept apart from ProjectItem because the two behave differently with money and
 * with time: an item is consumed and gone, a tool is used and handed back. See
 * config/tool-cost.ts for what each state costs.
 */
export interface ProjectTool {
  id: string;
  projectId: string;
  taskId?: string;
  milestoneId?: string;
  title: string;
  status: ToolStatus;
  /** Who from, or where from. */
  source?: string;
  purchaseCost?: number;
  hireRate?: number;
  hireDays?: number;
  currency?: string;
  /** When the job needs it in hand. */
  neededBy?: Date;
  /** When a borrowed or hired one goes back. */
  returnBy?: Date;
  inHand: boolean;
  note?: string;
  sortOrder?: number;
}

export interface ProjectToolRow {
  id: number;
  title?: string;
  user_id?: string;
  project_id?: string | null;
  task_id?: string | null;
  milestone_id?: string | null;
  status?: string | BaserowSelect | null;
  source?: string | null;
  purchase_cost?: number | string | null;
  hire_rate?: number | string | null;
  hire_days?: number | string | null;
  currency?: string | null;
  needed_by?: string | null;
  return_by?: string | null;
  in_hand?: boolean;
  note?: string | null;
  sort_order?: number | string | null;
}

export const PROJECT_TOOL_COLUMNS = [
  'title',
  'user_id',
  'project_id',
  'task_id',
  'milestone_id',
  'status',
  'source',
  'purchase_cost',
  'hire_rate',
  'hire_days',
  'currency',
  'needed_by',
  'return_by',
  'in_hand',
  'note',
  'sort_order'
] as const;

const STATUSES: readonly ToolStatus[] = ['own', 'borrow', 'hire', 'buy'];

/**
 * An unknown status becomes `buy`, not `own`.
 *
 * The two defaults are not equally safe: guessing `own` would quietly drop a
 * tool off the list of things still to get hold of, and off the budget with it.
 * Guessing `buy` is visible and easily corrected.
 */
function statusOrDefault(value: string): ToolStatus {
  return (STATUSES as readonly string[]).includes(value) ? (value as ToolStatus) : 'buy';
}

function numberOrUndefined(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function toProjectTool(row: ProjectToolRow): ProjectTool {
  return {
    id: String(row.id),
    projectId: row.project_id?.trim() ?? '',
    taskId: row.task_id || undefined,
    milestoneId: row.milestone_id || undefined,
    title: row.title ?? '',
    status: statusOrDefault(selectValue(row.status)),
    source: row.source || undefined,
    purchaseCost: numberOrUndefined(row.purchase_cost),
    hireRate: numberOrUndefined(row.hire_rate),
    hireDays: numberOrUndefined(row.hire_days),
    currency: row.currency || undefined,
    neededBy: parseDateOnly(row.needed_by),
    returnBy: parseDateOnly(row.return_by),
    inHand: row.in_hand ?? false,
    note: row.note || undefined,
    sortOrder: numberOrUndefined(row.sort_order)
  };
}

export function fromProjectTool(tool: ProjectTool, userId: string): Record<string, unknown> {
  return {
    title: tool.title,
    user_id: userId,
    project_id: tool.projectId,
    task_id: tool.taskId ?? '',
    milestone_id: tool.milestoneId ?? '',
    status: tool.status,
    source: tool.source ?? '',
    purchase_cost: tool.purchaseCost ?? null,
    hire_rate: tool.hireRate ?? null,
    hire_days: tool.hireDays ?? null,
    currency: tool.currency ?? '',
    needed_by: toDateOnly(tool.neededBy),
    return_by: toDateOnly(tool.returnBy),
    in_hand: tool.inHand,
    note: tool.note ?? '',
    sort_order: tool.sortOrder ?? 0
  };
}
