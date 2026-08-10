import { Project, Task } from './project.model';

/**
 * Mapping between the app's tasks/projects and Baserow tables 508 and 507.
 *
 * These tables were built for the Claude automation system — `task_id`,
 * `assigned_agent_id`, `phase` — and are now shared with users' personal tasks.
 * That was a deliberate choice (one table, one migration) and it costs some
 * fidelity, documented per field below rather than discovered later.
 *
 * Everything here is pure so the awkward parts are testable without a network.
 */

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/**
 * The app says `urgent`; the table's single-select says `critical`.
 *
 * A value outside a single-select's options is REJECTED by Baserow, so an
 * unmapped priority fails the whole write — not just that column.
 */
const PRIORITY_TO_ROW: Record<Task['priority'], string> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  urgent: 'critical'
};

const PRIORITY_FROM_ROW: Record<string, Task['priority']> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  critical: 'urgent'
};

/**
 * Project status. Note `on_hold,` — the trailing comma is a typo in the
 * Baserow option itself, and the value must match it EXACTLY or the write is
 * rejected. Fixing the option in Baserow is the real answer; until then this
 * mapping is what keeps saves working.
 */
const PROJECT_STATUS_TO_ROW: Record<Project['status'], string> = {
  planning: 'planning',
  active: 'active',
  'on-hold': 'on_hold,',
  completed: 'completed',
  // No `cancelled` option exists; parked as on-hold rather than failing the save.
  cancelled: 'on_hold,'
};

const PROJECT_STATUS_FROM_ROW: Record<string, Project['status']> = {
  planning: 'planning',
  active: 'active',
  'on_hold,': 'on-hold',
  on_hold: 'on-hold',
  completed: 'completed'
};

export interface BaserowSelect {
  id: number;
  value: string;
}

export interface TaskRow {
  id: number;
  task_id?: string;
  title?: string;
  description?: string;
  status?: string | BaserowSelect;
  priority?: string | BaserowSelect;
  due_date?: string | null;
  completed_at?: string | null;
  estimated_hours?: number | string | null;
  actual_hours?: number | string | null;
  user_id?: string;
}

export interface ProjectRow {
  id: number;
  name?: string;
  description?: string;
  status?: string | BaserowSelect;
  priority?: string | BaserowSelect;
  start_date?: string | null;
  target_date?: string | null;
  user_id?: string;
}

export function selectValue(value: string | BaserowSelect | undefined | null): string {
  if (!value) return '';
  return typeof value === 'object' ? value.value : value;
}

/**
 * Parses a Baserow date as LOCAL midnight.
 *
 * `new Date('2026-08-09')` is midnight UTC, which is the previous day for
 * anyone west of Greenwich — a due date would show as one day early.
 */
export function parseDateOnly(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const [datePart] = value.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return undefined;
  return new Date(y, m - 1, d);
}

/** Baserow date columns want `YYYY-MM-DD`, built from local parts. */
export function toDateOnly(date: Date | undefined): string | null {
  if (!date) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export function toTask(row: TaskRow): Task {
  const status = selectValue(row.status);

  return {
    id: String(row.id),
    // `project_id` is a link_row to table 507, which cannot hold the app's
    // string project ids. Standalone is the honest default until projects are
    // linked by row id.
    projectId: 'standalone',
    title: row.title ?? '',
    description: row.description || undefined,
    completed: status === 'completed',
    priority: PRIORITY_FROM_ROW[selectValue(row.priority)] ?? 'medium',
    dueDate: parseDateOnly(row.due_date),
    createdAt: parseDateOnly(row.completed_at) ?? new Date(),
    completedAt: parseDateOnly(row.completed_at),
    estimatedHours: numberOrUndefined(row.estimated_hours),
    actualHours: numberOrUndefined(row.actual_hours)
  };
}

export function fromTask(task: Task, userId: string): Record<string, unknown> {
  return {
    // The table's own key column. Kept distinct from the row id so automation
    // rows and user rows cannot collide on it.
    task_id: `u${userId}-${task.id}`,
    title: task.title,
    description: task.description ?? '',
    status: task.completed ? 'completed' : 'pending',
    priority: PRIORITY_TO_ROW[task.priority] ?? 'medium',
    due_date: toDateOnly(task.dueDate),
    completed_at: toDateOnly(task.completedAt),
    estimated_hours: task.estimatedHours ?? null,
    actual_hours: task.actualHours ?? null,
    user_id: userId
    // NOT written: `tags`. The column is a multiple_select limited to
    // bug/feature/improvement/docs, so arbitrary user tags would be rejected.
    // They stay in the local cache until a free-text tags column exists.
  };
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export function toProject(row: ProjectRow): Project {
  return {
    id: String(row.id),
    title: row.name ?? '',
    description: row.description || undefined,
    status: PROJECT_STATUS_FROM_ROW[selectValue(row.status)] ?? 'planning',
    priority: PRIORITY_FROM_ROW[selectValue(row.priority)] ?? 'medium',
    startDate: parseDateOnly(row.start_date),
    dueDate: parseDateOnly(row.target_date),
    createdAt: parseDateOnly(row.start_date) ?? new Date(),
    updatedAt: new Date(),
    // Sub-collections live in link_row tables of their own; the local cache
    // keeps them until those are wired up.
    tasks: [],
    milestones: [],
    goals: [],
    progress: 0
  };
}

export function fromProject(project: Project, userId: string): Record<string, unknown> {
  return {
    name: project.title,
    description: project.description ?? '',
    status: PROJECT_STATUS_TO_ROW[project.status] ?? 'planning',
    priority: PRIORITY_TO_ROW[project.priority] ?? 'medium',
    start_date: toDateOnly(project.startDate),
    target_date: toDateOnly(project.dueDate),
    user_id: userId
  };
}

function numberOrUndefined(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
