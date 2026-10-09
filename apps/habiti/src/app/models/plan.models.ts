import { PlanLevel, PlanStatus } from '../config/plan-score';
import { BaserowSelect, parseDateOnly, selectValue, toDateOnly } from './task-row.models';

/**
 * A plan: one way of doing a project, with what it would cost, take and risk.
 *
 * Several belong to a project at once — that is the whole point. The score that
 * orders them is NOT stored: it only ever compares a plan with its siblings, so
 * a stored one would go stale the moment another plan was added. See
 * config/plan-score.ts.
 */
export interface ProjectPlan {
  id: string;
  projectId: string;
  title: string;
  summary?: string;
  status: PlanStatus;
  /** 1-5, the person's own judgement. */
  rating?: number;
  cost?: number;
  currency?: string;
  durationDays?: number;
  effort?: PlanLevel;
  risk?: PlanLevel;
  /** 0-100. */
  confidence?: number;
  /** One per line, as typed. */
  pros?: string;
  cons?: string;
  decidedAt?: Date;
  sortOrder?: number;
}

export interface ProjectPlanRow {
  id: number;
  title?: string;
  user_id?: string;
  project_id?: string | null;
  summary?: string | null;
  status?: string | BaserowSelect | null;
  rating?: number | string | null;
  cost?: number | string | null;
  currency?: string | null;
  duration_days?: number | string | null;
  effort?: string | BaserowSelect | null;
  risk?: string | BaserowSelect | null;
  confidence?: number | string | null;
  pros?: string | null;
  cons?: string | null;
  decided_at?: string | null;
  sort_order?: number | string | null;
}

export const PROJECT_PLAN_COLUMNS = [
  'title',
  'user_id',
  'project_id',
  'summary',
  'status',
  'rating',
  'cost',
  'currency',
  'duration_days',
  'effort',
  'risk',
  'confidence',
  'pros',
  'cons',
  'decided_at',
  'sort_order'
] as const;

const STATUSES: readonly PlanStatus[] = ['draft', 'considering', 'chosen', 'rejected'];
const LEVELS: readonly PlanLevel[] = ['low', 'medium', 'high'];

function statusOrDefault(value: string): PlanStatus {
  return (STATUSES as readonly string[]).includes(value) ? (value as PlanStatus) : 'draft';
}

/** An unset level stays unset — see plan-score: unknown is not the same as bad. */
function levelOrUndefined(value: string): PlanLevel | undefined {
  return (LEVELS as readonly string[]).includes(value) ? (value as PlanLevel) : undefined;
}

function numberOrUndefined(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function toProjectPlan(row: ProjectPlanRow): ProjectPlan {
  return {
    id: String(row.id),
    projectId: row.project_id?.trim() ?? '',
    title: row.title ?? '',
    summary: row.summary || undefined,
    status: statusOrDefault(selectValue(row.status)),
    rating: numberOrUndefined(row.rating),
    cost: numberOrUndefined(row.cost),
    currency: row.currency || undefined,
    durationDays: numberOrUndefined(row.duration_days),
    effort: levelOrUndefined(selectValue(row.effort)),
    risk: levelOrUndefined(selectValue(row.risk)),
    confidence: numberOrUndefined(row.confidence),
    pros: row.pros || undefined,
    cons: row.cons || undefined,
    decidedAt: parseDateOnly(row.decided_at),
    sortOrder: numberOrUndefined(row.sort_order)
  };
}

export function fromProjectPlan(plan: ProjectPlan, userId: string): Record<string, unknown> {
  return {
    title: plan.title,
    user_id: userId,
    project_id: plan.projectId,
    summary: plan.summary ?? '',
    status: plan.status,
    rating: plan.rating ?? null,
    cost: plan.cost ?? null,
    currency: plan.currency ?? '',
    duration_days: plan.durationDays ?? null,
    // A select rejects '' as an option, so an unset level must be null.
    effort: plan.effort ?? null,
    risk: plan.risk ?? null,
    confidence: plan.confidence ?? null,
    pros: plan.pros ?? '',
    cons: plan.cons ?? '',
    decided_at: toDateOnly(plan.decidedAt),
    sort_order: plan.sortOrder ?? 0
  };
}
