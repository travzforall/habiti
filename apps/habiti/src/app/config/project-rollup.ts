import { Nestable, descendantsOf, subtreeHeight } from './project-tree';
import { byOrder } from './ordering';

/**
 * A whole family of projects as one line.
 *
 * The cards view answers "what is this project"; this answers "how is the house
 * going" — and they are different questions. Once "Downstairs A" holds ten
 * sub-projects, a grid of eleven cards showing 0% each says nothing at all,
 * because the work moved DOWN a level and the totals did not follow it.
 *
 * ── WHY EVERYTHING IS COUNTED ACROSS THE FAMILY ───────────────────────────
 *
 * A root project's own task list is usually empty by the time it has
 * sub-projects — that is what promoting a task does. Counting only its own
 * tasks would report an empty project that is in fact ten jobs deep. So every
 * figure here covers the root AND everything under it, and `ownTaskCount` is
 * kept separately for anyone who needs to tell them apart.
 */

export interface RollableProject extends Nestable {
  title: string;
  sortOrder?: number;
  tasks?: readonly { completed: boolean }[];
  budget?: number;
}

/** Money for one project, however the caller works it out. */
export interface ProjectMoney {
  spent: number;
  committed: number;
}

export interface FamilySummary<T extends RollableProject> {
  root: T;
  /** The root's own children, in order. */
  children: T[];
  /** Everything below the root, at any depth. */
  descendants: T[];
  /** Including the root itself. */
  projectCount: number;
  /** How many levels the family reaches, 1 when the root stands alone. */
  depth: number;
  taskCount: number;
  doneCount: number;
  /** Tasks filed directly on the root, not on anything under it. */
  ownTaskCount: number;
  /** 0-100 across every task in the family. */
  progress: number;
  /** The budgets that were set, added up. Undefined when nobody set one. */
  budget?: number;
  spent: number;
  committed: number;
  projected: number;
  /** Projected past the budget — only meaningful when there is one. */
  over: boolean;
}

/**
 * Rolls a root project and everything under it into one summary.
 *
 * Budgets are summed only where they exist, and the total is undefined when no
 * project in the family has one — nought would read as "budgeted nothing",
 * which is a different and much more alarming statement than "not budgeted".
 */
export function summariseFamily<T extends RollableProject>(
  root: T,
  all: readonly T[],
  money?: ReadonlyMap<string, ProjectMoney>
): FamilySummary<T> {
  const descendants = descendantsOf(root.id, all);
  const family = [root, ...descendants];

  const tasks = family.flatMap(project => project.tasks ?? []);
  const doneCount = tasks.filter(task => task.completed).length;

  const budgets = family
    .map(project => project.budget)
    .filter((budget): budget is number => budget !== undefined);

  const spent = family.reduce((total, project) => total + (money?.get(project.id)?.spent ?? 0), 0);
  const committed = family.reduce(
    (total, project) => total + (money?.get(project.id)?.committed ?? 0),
    0
  );

  const budget = budgets.length > 0 ? round2(budgets.reduce((a, b) => a + b, 0)) : undefined;
  const projected = round2(spent + committed);

  return {
    root,
    // The same order the rest of the app shows them in: hand-placed first.
    children: all
      .filter(project => project.parentId === root.id)
      .sort(byOrder((a, b) => a.title.localeCompare(b.title))),
    descendants,
    projectCount: family.length,
    depth: subtreeHeight(root, all),
    taskCount: tasks.length,
    doneCount,
    ownTaskCount: root.tasks?.length ?? 0,
    progress: tasks.length === 0 ? 0 : Math.round((doneCount / tasks.length) * 100),
    budget,
    spent: round2(spent),
    committed: round2(committed),
    projected,
    over: budget !== undefined && projected > budget
  };
}

/**
 * Every root, summarised — the whole page in one call.
 *
 * A project whose parent has been deleted counts as a root: it has to appear
 * somewhere, and the top is the only place it can be found and moved.
 */
export function summariseRoots<T extends RollableProject>(
  all: readonly T[],
  money?: ReadonlyMap<string, ProjectMoney>,
  compare: (a: T, b: T) => number = (a, b) => a.title.localeCompare(b.title)
): FamilySummary<T>[] {
  const ids = new Set(all.map(project => project.id));
  const roots = all.filter(project => !project.parentId || !ids.has(project.parentId));

  return [...roots].sort(compare).map(root => summariseFamily(root, all, money));
}

/** Money is summed in pounds here, so the halfpennies are rounded off once. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
