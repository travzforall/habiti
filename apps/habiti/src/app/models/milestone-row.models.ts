import { Milestone, MilestoneStatus } from './project.model';
import {
  BaserowSelect,
  parseDateOnly,
  parseDateTimeValue,
  parseTags,
  selectValue,
  serializeTags,
  toDateOnly
} from './task-row.models';

/**
 * Mapping between a Milestone and a row of `project_milestones` (638).
 *
 * ── WHY THIS FILE EXISTS ──────────────────────────────────────────────────
 *
 * Milestones used to live INSIDE the cached project row in localStorage. That
 * made them real on exactly one browser: clear the cache and a project's whole
 * timeline was gone, and a second device never saw them at all. Table 638 was
 * created for them; this is what speaks to it.
 *
 * The date helpers are shared with task-row.models.ts on purpose — the bug that
 * file documents (a due date read as midnight UTC showing a day early) applies
 * here to every target date, and there is no reason for two versions of it.
 */

export interface MilestoneRow {
  id: number;
  title?: string;
  user_id?: string;
  project_id?: string | null;
  description?: string | null;
  start_date?: string | null;
  target_date?: string | null;
  completed?: boolean;
  completed_at?: string | null;
  status?: string | BaserowSelect | null;
  owner?: string | null;
  definition_of_done?: string | null;
  colour?: string | null;
  sort_order?: number | string | null;
  progress?: number | string | null;
  /** Comma separated milestone ids. */
  depends_on?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

/** Every column `fromMilestone` may write. Asserted by milestone-row.models.spec.ts. */
export const MILESTONE_COLUMNS = [
  'title',
  'user_id',
  'project_id',
  'description',
  'start_date',
  'target_date',
  'completed',
  'completed_at',
  'status',
  'owner',
  'definition_of_done',
  'colour',
  'sort_order',
  'progress',
  'depends_on'
] as const;

const STATUSES: readonly MilestoneStatus[] = ['planned', 'active', 'at_risk', 'done'];

/**
 * A status Baserow would reject fails the WHOLE row, so an unknown one becomes
 * `planned` rather than being sent on and losing everything else with it.
 */
function statusOrDefault(value: string): MilestoneStatus {
  return (STATUSES as readonly string[]).includes(value) ? (value as MilestoneStatus) : 'planned';
}

export function toMilestone(row: MilestoneRow): Milestone {
  return {
    id: String(row.id),
    projectId: row.project_id?.trim() ?? '',
    title: row.title ?? '',
    description: row.description || undefined,
    startDate: parseDateOnly(row.start_date),
    // A row with no target date still has to produce a Date, because Milestone
    // requires one and the timeline sorts on it. Today is the least surprising
    // stand-in: the milestone shows up at the current edge of the plan rather
    // than in 1970.
    targetDate: parseDateOnly(row.target_date) ?? new Date(),
    completed: row.completed ?? false,
    completedAt: parseDateTimeValue(row.completed_at),
    status: statusOrDefault(selectValue(row.status)),
    owner: row.owner || undefined,
    definitionOfDone: row.definition_of_done || undefined,
    dependsOn: parseTags(row.depends_on),
    colour: row.colour || undefined,
    sortOrder: Number(row.sort_order ?? 0) || 0,
    progress: Number(row.progress ?? 0) || 0,
    tasks: []
  };
}

export function fromMilestone(milestone: Milestone, userId: string): Record<string, unknown> {
  return {
    title: milestone.title,
    user_id: userId,
    project_id: milestone.projectId,
    description: milestone.description ?? '',
    start_date: toDateOnly(milestone.startDate),
    target_date: toDateOnly(milestone.targetDate),
    completed: milestone.completed,
    completed_at: milestone.completedAt?.toISOString() ?? null,
    status: milestone.status ?? 'planned',
    owner: milestone.owner ?? '',
    definition_of_done: milestone.definitionOfDone ?? '',
    colour: milestone.colour ?? '',
    sort_order: milestone.sortOrder ?? 0,
    progress: milestone.progress ?? 0,
    depends_on: serializeTags(milestone.dependsOn)
  };
}
