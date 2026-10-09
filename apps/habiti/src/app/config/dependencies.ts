/**
 * "This cannot start until that is finished."
 *
 * The same rules serve tasks and milestones, so they are written once against
 * the smallest shape both share: something with an id, a done flag, and a list
 * of things it waits on.
 *
 * ── WHY PREREQUISITES ARE STORED ON THE DEPENDENT ─────────────────────────
 *
 * `dependsOn` lives on the thing that is waiting, not as a `blocks` list on the
 * thing being waited for. One direction, one write when a dependency changes,
 * and no pair of lists that can disagree. The reverse view — "what is waiting
 * on me" — is derived, which is the half that can be computed cheaply and the
 * half that would rot if it were stored.
 *
 * ── AND WHY NOTHING HERE ENFORCES ─────────────────────────────────────────
 *
 * A blocked item can still be ticked. People work out of order for good
 * reasons: the blocker turned out not to matter, or it was done and never
 * recorded. The app's job is to make the situation visible, not to argue.
 */

export interface Dependent {
  id: string;
  completed: boolean;
  dependsOn?: string[];
}

/** The prerequisites that are NOT finished — what is actually holding this up. */
export function blockersOf<T extends Dependent>(item: T, all: readonly T[]): T[] {
  if (!item.dependsOn?.length) return [];

  const byId = new Map(all.map(candidate => [candidate.id, candidate]));
  return item.dependsOn
    .map(id => byId.get(id))
    .filter((candidate): candidate is T => !!candidate && !candidate.completed);
}

export function isBlocked<T extends Dependent>(item: T, all: readonly T[]): boolean {
  return blockersOf(item, all).length > 0;
}

/** The reverse view: everything waiting on this one. Derived, never stored. */
export function blocking<T extends Dependent>(item: T, all: readonly T[]): T[] {
  return all.filter(candidate => candidate.dependsOn?.includes(item.id));
}

/**
 * Would `id` waiting on `prerequisiteId` create a loop?
 *
 * Refused rather than repaired, exactly like reparenting a mind map node: a
 * cycle here means two things each waiting for the other, which is not a plan,
 * and any code that walks the chain would follow it forever.
 */
export function wouldCycle<T extends Dependent>(
  all: readonly T[],
  id: string,
  prerequisiteId: string
): boolean {
  if (id === prerequisiteId) return true;

  const byId = new Map(all.map(item => [item.id, item]));
  const seen = new Set<string>();
  const queue = [prerequisiteId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === id) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    queue.push(...(byId.get(current)?.dependsOn ?? []));
  }

  return false;
}

/**
 * Every prerequisite, including prerequisites of prerequisites.
 *
 * What "before others can move on" really means once a chain is more than two
 * long: finishing A may unblock B, which is the only thing C was waiting for.
 */
export function chainOf<T extends Dependent>(item: T, all: readonly T[]): T[] {
  const byId = new Map(all.map(candidate => [candidate.id, candidate]));
  const found: T[] = [];
  const seen = new Set<string>([item.id]);
  const queue = [...(item.dependsOn ?? [])];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);

    const next = byId.get(id);
    if (!next) continue;
    found.push(next);
    queue.push(...(next.dependsOn ?? []));
  }

  return found;
}

/**
 * Adds a prerequisite, or returns null when it cannot be added.
 *
 * Null rather than a thrown error or a silently-ignored click: the caller says
 * why, and the reason is always the same one — it would make a loop.
 */
export function addDependency<T extends Dependent>(
  all: readonly T[],
  id: string,
  prerequisiteId: string
): string[] | null {
  const item = all.find(candidate => candidate.id === id);
  if (!item) return null;
  if (item.dependsOn?.includes(prerequisiteId)) return item.dependsOn;
  if (wouldCycle(all, id, prerequisiteId)) return null;

  return [...(item.dependsOn ?? []), prerequisiteId];
}
