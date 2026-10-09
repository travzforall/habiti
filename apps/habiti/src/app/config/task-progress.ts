import { ChecklistItem, Task } from '../models/project.model';

/**
 * How far along a task is, as one number, from four inputs that can disagree.
 *
 * The order below is the whole design, and it is deliberate:
 *
 *   1. Done is 100. Nothing else is consulted — a finished task with two
 *      unticked checklist items is still finished, and arguing with the user
 *      about that is not the job.
 *   2. A checklist, if there is one, IS the progress. It is the most specific
 *      thing the user has said about this task.
 *   3. Otherwise a hand-set percentage, if they set one.
 *   4. Otherwise `in_progress` reports a floor of 10 rather than 0, because a
 *      bar that reads zero while the task is visibly underway is a bar nobody
 *      trusts. It is a floor and it is documented as one; it is not a guess at
 *      the real figure.
 *
 * HOURS ARE NOT PROGRESS. `estimatedHours` and `actualHours` are shown next to
 * this number on the detail page and never folded into it: burning the whole
 * estimate is a signal about the estimate, not about how much is finished.
 */
export const IN_PROGRESS_FLOOR = 10;

export function checklistProgress(items: readonly ChecklistItem[]): number {
  if (items.length === 0) return 0;
  const done = items.filter(item => item.completed).length;
  return Math.round((done / items.length) * 100);
}

export function taskProgress(task: Task): number {
  if (task.completed || task.status === 'done') return 100;

  const checklist = task.checklist ?? [];
  if (checklist.length > 0) return checklistProgress(checklist);

  if (task.progressPct !== undefined && task.progressPct !== null) {
    return clamp(task.progressPct);
  }

  return task.status === 'in_progress' ? IN_PROGRESS_FLOOR : 0;
}

/**
 * A project's progress, rolled up from its tasks.
 *
 * Weighted by estimate ONLY when every task has one. A part-weighted mean —
 * where three estimated tasks carry the average and twelve unestimated ones
 * count for nothing — is worse than either honest alternative, so the weighting
 * is all or nothing.
 */
export function projectProgress(tasks: readonly Task[]): number {
  if (tasks.length === 0) return 0;

  const everyTaskEstimated = tasks.every(t => (t.estimatedHours ?? 0) > 0);

  if (everyTaskEstimated) {
    const totalHours = tasks.reduce((sum, t) => sum + (t.estimatedHours ?? 0), 0);
    if (totalHours > 0) {
      const weighted = tasks.reduce((sum, t) => sum + taskProgress(t) * (t.estimatedHours ?? 0), 0);
      return Math.round(weighted / totalHours);
    }
  }

  const total = tasks.reduce((sum, t) => sum + taskProgress(t), 0);
  return Math.round(total / tasks.length);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Label and colour for a status, in one place so every view agrees. */
export const TASK_STATUS_META = {
  todo: { label: 'To do', icon: '○', classes: 'bg-slate-100 text-slate-700 border-slate-200' },
  in_progress: {
    label: 'In progress',
    icon: '◐',
    classes: 'bg-blue-100 text-blue-700 border-blue-200'
  },
  blocked: { label: 'Blocked', icon: '⏸', classes: 'bg-amber-100 text-amber-800 border-amber-200' },
  done: { label: 'Done', icon: '●', classes: 'bg-green-100 text-green-700 border-green-200' }
} as const;
