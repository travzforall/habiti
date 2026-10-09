/**
 * Projects inside projects.
 *
 * "Downstairs A" is a project; so are the floors inside it; so is the whole
 * house above both. Three levels is enough for that and stops before the shape
 * people actually regret — a tree deep enough that nobody can say where a task
 * lives without opening four screens.
 *
 * ── WHY A LIMIT AT ALL ────────────────────────────────────────────────────
 *
 * Unlimited nesting is easier to write and worse to use. Every level costs a
 * breadcrumb, an indent, and a rule about what rolls up into what; past three
 * the answer to "where does this belong" stops being obvious, and the thing
 * people wanted was a list.
 *
 * The limit is enforced by REFUSING, never by silently reparenting: a move that
 * would break it returns false and the caller says why, exactly like a mind-map
 * node that cannot become its own child.
 */

export interface Nestable {
  id: string;
  parentId?: string;
}

/** Top level is 1, so a project nested twice is 3 — the deepest allowed. */
export const MAX_PROJECT_DEPTH = 3;

/**
 * How deep a project sits, counting from 1.
 *
 * A parent that does not exist is treated as no parent: an orphan is shown at
 * the top rather than hidden under something that was deleted.
 */
export function depthOf<T extends Nestable>(project: T, all: readonly T[]): number {
  const byId = new Map(all.map(candidate => [candidate.id, candidate]));
  let depth = 1;
  let current = project.parentId ? byId.get(project.parentId) : undefined;
  const seen = new Set<string>([project.id]);

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    depth++;
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return depth;
}

/** How many levels of descendants hang below this one. 1 when it has none. */
export function subtreeHeight<T extends Nestable>(project: T, all: readonly T[]): number {
  const children = childrenOf(project.id, all);
  if (children.length === 0) return 1;
  return 1 + Math.max(...children.map(child => subtreeHeight(child, all)));
}

export function childrenOf<T extends Nestable>(parentId: string, all: readonly T[]): T[] {
  return all.filter(candidate => candidate.parentId === parentId);
}

/** Every project below this one, at any depth. */
export function descendantsOf<T extends Nestable>(projectId: string, all: readonly T[]): T[] {
  const found: T[] = [];
  const queue = [projectId];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);

    for (const child of childrenOf(id, all)) {
      found.push(child);
      queue.push(child.id);
    }
  }

  return found;
}

/** This project and everything under it — what a roll-up covers. */
export function withDescendants<T extends Nestable>(projectId: string, all: readonly T[]): T[] {
  const self = all.find(candidate => candidate.id === projectId);
  return self ? [self, ...descendantsOf(projectId, all)] : [];
}

/** The chain up to the top, nearest parent first. The breadcrumb. */
export function ancestorsOf<T extends Nestable>(project: T, all: readonly T[]): T[] {
  const byId = new Map(all.map(candidate => [candidate.id, candidate]));
  const chain: T[] = [];
  const seen = new Set<string>([project.id]);

  let current = project.parentId ? byId.get(project.parentId) : undefined;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.push(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return chain;
}

export interface NestingRefusal {
  ok: false;
  reason: 'cycle' | 'too-deep' | 'missing';
  message: string;
}

export type NestingCheck = { ok: true } | NestingRefusal;

/**
 * May `projectId` be moved under `parentId`?
 *
 * Three ways it cannot, and each gets its own answer rather than one flat "no",
 * because the fix is different every time: it would loop, it would be too deep,
 * or one of them is not there.
 */
export function canNest<T extends Nestable>(
  projectId: string,
  parentId: string | undefined,
  all: readonly T[]
): NestingCheck {
  if (!parentId) return { ok: true };

  const project = all.find(candidate => candidate.id === projectId);
  const parent = all.find(candidate => candidate.id === parentId);
  if (!project || !parent) {
    return { ok: false, reason: 'missing', message: 'That project no longer exists.' };
  }

  if (projectId === parentId) {
    return { ok: false, reason: 'cycle', message: 'A project cannot sit inside itself.' };
  }

  // Moving a project under its own descendant would cut the branch loose.
  if (descendantsOf(projectId, all).some(candidate => candidate.id === parentId)) {
    return {
      ok: false,
      reason: 'cycle',
      message: 'That would put a project inside one of its own sub-projects.'
    };
  }

  // The whole branch moves, so it is the TALLEST part of it that has to fit —
  // checking only the project itself would let a two-deep branch land at level
  // three and quietly make a level-four project.
  const height = subtreeHeight(project, all);
  const wouldBe = depthOf(parent, all) + height;
  if (wouldBe > MAX_PROJECT_DEPTH) {
    return {
      ok: false,
      reason: 'too-deep',
      message: `Projects go ${MAX_PROJECT_DEPTH} levels deep. That would make ${wouldBe}.`
    };
  }

  return { ok: true };
}

/**
 * May a NEW project be created inside this one?
 *
 * A different question from moving an existing project, and it has to be:
 * `canNest` looks the project up to measure the branch it carries, and a
 * project being created is not in the list yet — asking there returns
 * "missing" and quietly drops the parent, which is exactly the bug this
 * function exists to prevent.
 */
export function canAddChild<T extends Nestable>(
  parentId: string | undefined,
  all: readonly T[]
): NestingCheck {
  if (!parentId) return { ok: true };

  const parent = all.find(candidate => candidate.id === parentId);
  if (!parent) {
    return { ok: false, reason: 'missing', message: 'That project no longer exists.' };
  }

  const wouldBe = depthOf(parent, all) + 1;
  if (wouldBe > MAX_PROJECT_DEPTH) {
    return {
      ok: false,
      reason: 'too-deep',
      message: `Projects go ${MAX_PROJECT_DEPTH} levels deep. That would make ${wouldBe}.`
    };
  }

  return { ok: true };
}

export interface TreeRow<T> {
  project: T;
  depth: number;
  hasChildren: boolean;
}

/**
 * The whole set as a flat list in reading order, each row knowing its depth.
 *
 * Flat rather than nested arrays so a template can `@for` over it once and
 * indent by depth; nesting in the data would mean a recursive component for a
 * tree that is three deep by law.
 *
 * A project whose parent is missing is shown at the top level — never dropped.
 */
export function treeOf<T extends Nestable>(
  all: readonly T[],
  compare: (a: T, b: T) => number = () => 0
): TreeRow<T>[] {
  const ids = new Set(all.map(project => project.id));
  const roots = all.filter(project => !project.parentId || !ids.has(project.parentId));
  const rows: TreeRow<T>[] = [];

  const walk = (project: T, depth: number, seen: Set<string>) => {
    if (seen.has(project.id)) return;
    seen.add(project.id);

    const children = childrenOf(project.id, all).sort(compare);
    rows.push({ project, depth, hasChildren: children.length > 0 });
    for (const child of children) walk(child, depth + 1, seen);
  };

  const seen = new Set<string>();
  for (const root of [...roots].sort(compare)) walk(root, 1, seen);

  // A cycle among orphaned rows would otherwise vanish from the list entirely.
  for (const project of all) {
    if (!seen.has(project.id)) rows.push({ project, depth: 1, hasChildren: false });
  }

  return rows;
}
