/**
 * Moving something up or down a list, and writing the new order down.
 *
 * ── WHY THE WHOLE GROUP IS RENUMBERED ─────────────────────────────────────
 *
 * The cheap trick is to give the moved item a number between its new
 * neighbours — 1, 1.5, 2 — and write one row. It works until it doesn't: the
 * gaps halve every time something is dropped in the same place, and after
 * enough moves two items have orders a floating-point step apart and stop
 * being distinguishable. Renumbering the group 1..n costs a handful of writes
 * on an action a person takes by hand, and can never drift.
 *
 * Only the rows whose number actually CHANGED are written — dragging the last
 * item one place up is two writes, not twenty.
 */

export interface Ordered {
  id: string;
  sortOrder?: number;
}

/**
 * The list with one item moved. Out-of-range indices are clamped rather than
 * throwing: a drop past the end of a list means "put it last", which is what
 * the person was doing.
 */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (items.length === 0) return [];

  const last = items.length - 1;
  const source = Math.min(Math.max(from, 0), last);
  const target = Math.min(Math.max(to, 0), last);
  if (source === target) return [...items];

  const next = [...items];
  const [moved] = next.splice(source, 1);
  next.splice(target, 0, moved);
  return next;
}

/**
 * The rows whose order changed, numbered 1..n in their new positions.
 *
 * Returns only what needs writing, so the caller can persist exactly that.
 */
export function renumber<T extends Ordered>(
  ordered: readonly T[]
): { item: T; sortOrder: number }[] {
  const changed: { item: T; sortOrder: number }[] = [];

  ordered.forEach((item, index) => {
    const sortOrder = index + 1;
    if (item.sortOrder !== sortOrder) changed.push({ item, sortOrder });
  });

  return changed;
}

/**
 * The order a hand-sorted list reads in.
 *
 * Anything never dragged has no number at all, and those sort AFTER everything
 * placed by hand — a new project appearing in the middle of an order someone
 * arranged would look like the list had rearranged itself. Within the unplaced
 * ones, and to break any tie, the fallback decides.
 */
export function byOrder<T extends Ordered>(
  fallback: (a: T, b: T) => number = () => 0
): (a: T, b: T) => number {
  return (a, b) => {
    const left = a.sortOrder;
    const right = b.sortOrder;

    if (left === undefined && right === undefined) return fallback(a, b);
    if (left === undefined) return 1;
    if (right === undefined) return -1;

    return left - right || fallback(a, b);
  };
}
