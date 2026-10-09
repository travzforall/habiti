import { Project, ProjectType, Task, TaskStatus } from './project.model';

/**
 * Mapping between the app's tasks/projects and the tables that actually hold
 * them: `user_tasks` (631) and `user_projects` (630), in Habiti's Baserow
 * database 128.
 *
 * ── WHAT THIS FILE USED TO DO, AND WHY IT MATTERS ─────────────────────────
 *
 * It mapped to the SCHEDULER's tables (507/508, database 127) long after both
 * services had been pointed at 630/631. Everything still returned 200, because
 * Baserow with `user_field_names=true` IGNORES a field name it does not
 * recognise instead of rejecting the write. So:
 *
 *   - `fromProject` wrote `name`; the column is `title`. Every project row on
 *     the server ended up with a null title (rows 3–11, all of them).
 *   - `fromTask` wrote a `status` select; completion is a `completed` BOOLEAN.
 *     Ticking a task never reached the server — reload and it came back undone.
 *   - `project_id` was never written and `toTask` hardcoded 'standalone', so a
 *     task could not belong to a project at all.
 *   - `priority: urgent` was translated to 'critical', which is not one of this
 *     table's options — and an invalid single_select value makes Baserow reject
 *     the WHOLE ROW. The urgent sample task is the one that never saved.
 *
 * Two things keep that from happening again, and both are cheap:
 *
 *   1. Every column name this file writes is declared in the `*_COLUMNS` arrays
 *      below, and `task-row.models.spec.ts` asserts the mappers never produce a
 *      key outside them.
 *   2. `scripts/check-baserow-fields.mjs` (part of `npm run verify`) asserts
 *      those arrays against the field lists in database-schemas/27 and /28.
 *      A column renamed in the schema and not here fails the build.
 *
 * Everything here is pure, so the awkward parts are testable without a network.
 */

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/**
 * The tables were built to speak the app's own vocabulary, so priority needs no
 * translation at all — `low | medium | high | urgent` on both sides. The guard
 * is only for a value arriving from somewhere unexpected: an unknown option
 * value fails the entire row, so it must never reach the wire.
 */
const TASK_PRIORITIES: readonly Task['priority'][] = ['low', 'medium', 'high', 'urgent'];

function priorityOrDefault(value: string): Task['priority'] {
  return (TASK_PRIORITIES as readonly string[]).includes(value)
    ? (value as Task['priority'])
    : 'medium';
}

/** Only the underscore differs: the app says `on-hold`, the select says `on_hold`. */
const PROJECT_STATUS_TO_ROW: Record<Project['status'], string> = {
  planning: 'planning',
  active: 'active',
  'on-hold': 'on_hold',
  completed: 'completed',
  cancelled: 'cancelled'
};

const PROJECT_STATUS_FROM_ROW: Record<string, Project['status']> = {
  planning: 'planning',
  active: 'active',
  on_hold: 'on-hold',
  // The scheduler table's option carries a trailing comma. Rows written before
  // the move can still hold it, so it is read but never written.
  'on_hold,': 'on-hold',
  completed: 'completed',
  cancelled: 'cancelled'
};

const TASK_STATUSES: readonly TaskStatus[] = ['todo', 'in_progress', 'blocked', 'done'];

const PROJECT_TYPES: readonly ProjectType[] = [
  'personal',
  'work',
  'business',
  'study',
  'home',
  'creative',
  'health'
];

/** An unknown or absent type is `personal` — never a value the select would reject. */
function projectTypeOrDefault(value: string): ProjectType {
  return (PROJECT_TYPES as readonly string[]).includes(value) ? (value as ProjectType) : 'personal';
}

/**
 * The literal `project_id` for a task that belongs to no project.
 *
 * A TEXT column rather than a link_row precisely so this value can exist —
 * see the notes in database-schemas/28-user-tasks.json.
 */
export const STANDALONE = 'standalone';

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

export interface BaserowSelect {
  id: number;
  value: string;
}

export interface UserTaskRow {
  id: number;
  title?: string;
  user_id?: string;
  project_id?: string | null;
  description?: string;
  completed?: boolean;
  /** Pending in the live table — see TASK_COLUMNS. Read defensively. */
  status?: string | BaserowSelect | null;
  progress_pct?: number | string | null;
  priority?: string | BaserowSelect;
  due_date?: string | null;
  completed_at?: string | null;
  estimated_hours?: number | string | null;
  actual_hours?: number | string | null;
  tags?: string | null;
  assignee?: string | null;
  sort_order?: number | string | null;
  /** Pending in the live table, like `status`. */
  milestone_id?: string | null;
  /** Comma separated task ids. Pending too. */
  depends_on?: string | null;
  /** What this task is meant to cost. Pending in the live table. */
  budget?: number | string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface UserProjectRow {
  id: number;
  title?: string;
  /** Pending in the live table. Unknown values read as `personal`. */
  type?: string | BaserowSelect;
  user_id?: string;
  description?: string;
  status?: string | BaserowSelect;
  priority?: string | BaserowSelect;
  start_date?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
  progress?: number | string | null;
  color?: string | null;
  icon?: string | null;
  tags?: string | null;
  owner?: string | null;
  archived?: boolean;
  budget?: number | string | null;
  currency?: string | null;
  /** The project this one sits inside. Pending in the live table. */
  parent_id?: string | null;
  /** Hand-sorted position among its siblings. Pending in the live table. */
  sort_order?: number | string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

/**
 * Every column `fromTask` may write.
 *
 * `created_at` and `updated_at` are absent DELIBERATELY: they are Baserow's own
 * created-on / last-modified types, which are read-only. They are read below,
 * never written.
 *
 * `status` and `progress_pct` are listed but DO NOT EXIST in the live table
 * yet (they need `scripts/add-baserow-field.mjs`, which requires a user JWT).
 * Writing them is harmless in the meantime — Baserow drops unknown names — and
 * `toTask` derives status from `completed` whenever the column is absent. The
 * day the columns land, this file already speaks to them.
 */
export const USER_TASK_COLUMNS = [
  'title',
  'user_id',
  'project_id',
  'description',
  'completed',
  'status',
  'progress_pct',
  'priority',
  'due_date',
  'completed_at',
  'estimated_hours',
  'actual_hours',
  'tags',
  'assignee',
  'sort_order',
  'milestone_id',
  'depends_on',
  'budget'
] as const;

export const USER_PROJECT_COLUMNS = [
  'title',
  'user_id',
  'description',
  'status',
  'priority',
  'start_date',
  'due_date',
  'completed_at',
  'progress',
  'color',
  'icon',
  'tags',
  'owner',
  'archived',
  'type',
  'budget',
  'currency',
  'parent_id',
  'sort_order'
] as const;

// ---------------------------------------------------------------------------
// Value helpers
// ---------------------------------------------------------------------------

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

/** A date_time column keeps the time of day, so it gets the full ISO string. */
export function toDateTime(date: Date | undefined): string | null {
  return date ? date.toISOString() : null;
}

export function parseDateTimeValue(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

const parseDateTime = parseDateTimeValue;

function numberOrUndefined(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** `tags` is free text, comma separated — a multiple_select would reject anything unplanned. */
export function parseTags(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);
}

export function serializeTags(tags: string[] | undefined): string {
  return (tags ?? []).map(tag => tag.trim()).filter(Boolean).join(',');
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

/**
 * `completed` and `status` are two views of the same fact, and the table is the
 * one that has been carrying it. So `completed` wins: a row that says done is
 * done, whatever a (possibly absent, possibly stale) status column says.
 */
export function statusFromRow(row: UserTaskRow): TaskStatus {
  if (row.completed) return 'done';
  const raw = selectValue(row.status ?? undefined);
  return (TASK_STATUSES as readonly string[]).includes(raw) && raw !== 'done'
    ? (raw as TaskStatus)
    : 'todo';
}

export function toTask(row: UserTaskRow): Task {
  const status = statusFromRow(row);

  return {
    id: String(row.id),
    projectId: row.project_id?.trim() ? row.project_id.trim() : STANDALONE,
    title: row.title ?? '',
    description: row.description || undefined,
    completed: status === 'done',
    status,
    priority: priorityOrDefault(selectValue(row.priority)),
    dueDate: parseDateOnly(row.due_date),
    createdAt: parseDateTime(row.created_at) ?? new Date(),
    updatedAt: parseDateTime(row.updated_at),
    completedAt: parseDateTime(row.completed_at),
    estimatedHours: numberOrUndefined(row.estimated_hours),
    actualHours: numberOrUndefined(row.actual_hours),
    progressPct: numberOrUndefined(row.progress_pct),
    sortOrder: numberOrUndefined(row.sort_order),
    milestoneId: row.milestone_id || undefined,
    dependencies: parseTags(row.depends_on),
    budget: numberOrUndefined(row.budget),
    assignee: row.assignee || undefined,
    tags: parseTags(row.tags),
    // Sub-collections have their own tables and their own services; a row read
    // here must not blank what those hold.
    subtasks: [],
    checklist: [],
    attachments: [],
    comments: []
  };
}

/**
 * Keeps the fields the server has no column for.
 *
 * `milestone_id` and `depends_on` do not exist in Baserow yet — until
 * `npm run db:setup` runs, a row comes back with no such key at all, and
 * toTask() reads undefined. Letting that win would quietly wipe every milestone
 * assignment and every dependency on the next page load: the app would look
 * like it had forgotten, when in truth it had never been able to save.
 *
 * The rule is about the COLUMN, not the value. A key missing from the row means
 * the server cannot hold this field, so the local value stands. A key that is
 * present but empty means the server genuinely holds nothing, so the server
 * wins and a deletion made on another device is honoured. Once the columns
 * exist this stops doing anything at all — there is nothing to undo later.
 */
export function keepWhatTheServerCannotStore(
  mapped: Task,
  local: Task,
  row: UserTaskRow
): Task {
  const kept = { ...mapped };
  if (!('milestone_id' in row)) kept.milestoneId = local.milestoneId;
  if (!('depends_on' in row)) kept.dependencies = local.dependencies;
  if (!('progress_pct' in row)) kept.progressPct = local.progressPct;
  if (!('budget' in row)) kept.budget = local.budget;
  return kept;
}

export function fromTask(task: Task, userId: string): Record<string, unknown> {
  const status: TaskStatus = task.completed ? 'done' : (task.status ?? 'todo');

  return {
    title: task.title,
    user_id: userId,
    project_id: task.projectId || STANDALONE,
    description: task.description ?? '',
    completed: status === 'done',
    status,
    progress_pct: task.progressPct ?? null,
    priority: priorityOrDefault(task.priority),
    due_date: toDateOnly(task.dueDate),
    completed_at: toDateTime(task.completedAt),
    estimated_hours: task.estimatedHours ?? null,
    actual_hours: task.actualHours ?? null,
    tags: serializeTags(task.tags),
    assignee: task.assignee ?? '',
    sort_order: task.sortOrder ?? null,
    milestone_id: task.milestoneId ?? '',
    budget: task.budget ?? null,
    depends_on: serializeTags(task.dependencies)
  };
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export function toProject(row: UserProjectRow): Project {
  return {
    id: String(row.id),
    title: row.title ?? '',
    description: row.description || undefined,
    type: projectTypeOrDefault(selectValue(row.type)),
    status: PROJECT_STATUS_FROM_ROW[selectValue(row.status)] ?? 'planning',
    priority: priorityOrDefault(selectValue(row.priority)),
    startDate: parseDateOnly(row.start_date),
    dueDate: parseDateOnly(row.due_date),
    completedAt: parseDateTime(row.completed_at),
    createdAt: parseDateTime(row.created_at) ?? new Date(),
    updatedAt: parseDateTime(row.updated_at) ?? new Date(),
    owner: row.owner || undefined,
    color: row.color || undefined,
    icon: row.icon || undefined,
    tags: parseTags(row.tags),
    archived: row.archived ?? false,
    progress: numberOrUndefined(row.progress) ?? 0,
    budget: numberOrUndefined(row.budget),
    currency: row.currency || undefined,
    parentId: row.parent_id || undefined,
    sortOrder: numberOrUndefined(row.sort_order),
    // Tasks are derived from the tasks store, keyed on project_id. Milestones
    // and goals have no table yet and live in the local cache.
    tasks: [],
    milestones: [],
    goals: []
  };
}

export function fromProject(project: Project, userId: string): Record<string, unknown> {
  return {
    title: project.title,
    user_id: userId,
    description: project.description ?? '',
    type: projectTypeOrDefault(project.type),
    status: PROJECT_STATUS_TO_ROW[project.status] ?? 'planning',
    priority: priorityOrDefault(project.priority),
    start_date: toDateOnly(project.startDate),
    due_date: toDateOnly(project.dueDate),
    completed_at: toDateTime(project.completedAt),
    progress: Math.round(project.progress ?? 0),
    color: project.color ?? '',
    icon: project.icon ?? '',
    tags: serializeTags(project.tags),
    owner: project.owner ?? '',
    archived: project.archived ?? false,
    budget: project.budget ?? null,
    currency: project.currency ?? '',
    parent_id: project.parentId ?? '',
    sort_order: project.sortOrder ?? null
  };
}
