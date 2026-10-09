/**
 * Money as whole minor units.
 *
 * Its own file because both the budget and the tool list need it, and having
 * tool-cost.ts import it from budget-math.ts — which imports tool-cost back —
 * made a cycle. Function declarations survive that by hoisting, so it works
 * until the day someone adds a constant to one of them and it silently reads
 * undefined at start-up. One small module underneath both is the fix.
 */

/**
 * Rounds to whole minor units — the only place a fraction of a penny dies.
 *
 * The `toFixed` is not decoration. 1.005 is held as 1.00499999999999989, so
 * `Math.round(1.005 * 100)` gives 100 — a penny lost, half-up rounding quietly
 * turned into rounding down. Fixing the product to four places first restores
 * the number a person actually typed, and only then is it rounded.
 */
export function toMinor(amount: number | undefined): number {
  if (amount === undefined || !Number.isFinite(amount)) return 0;
  return Math.round(Number((amount * 100).toFixed(4)));
}

export function fromMinor(minor: number): number {
  return minor / 100;
}
