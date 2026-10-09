/**
 * One person's currency, and what to do when the money is in another one.
 *
 * ── WHY THE RATES ARE TYPED IN, NOT FETCHED ───────────────────────────────
 *
 * Habiti could call an exchange-rate API. It deliberately does not. A rate
 * service means every budget screen tells a third party what this person is
 * looking at and when, for a number that changes by a fraction of a percent a
 * day and that nobody here is trading on. The same reasoning as the inspiration
 * board, which says out loud that YouTube sees your IP.
 *
 * So rates are entered by the person who cares, in the sentence they would say
 * out loud — "1 GBP = 1.27 USD" — and stamped with the day they were set, so a
 * two-year-old rate can be seen for what it is.
 *
 * ── AND WHY AN UNKNOWN RATE IS NEVER GUESSED ──────────────────────────────
 *
 * Converting at 1:1 because no rate is known would silently add $120 to a
 * pounds total as £120. Anything that cannot be converted is EXCLUDED from the
 * total and reported beside it, so the sum is either right or visibly
 * incomplete — never quietly wrong.
 */

export interface RateTable {
  /** The currency this person thinks in. Everything converts TO this. */
  home: string;
  /**
   * How many of each currency one unit of `home` buys.
   *
   * `{ USD: 1.27 }` with home GBP reads "1 GBP = 1.27 USD" — the sentence the
   * settings screen shows, so what is typed and what is stored cannot drift.
   */
  rates: Record<string, number>;
  /** When these were last set, so a stale rate can be seen as stale. */
  updatedAt?: Date;
}

export const DEFAULT_HOME = 'GBP';

/** The currencies offered first. Anything else can be typed in. */
export const COMMON_CURRENCIES = [
  'GBP',
  'USD',
  'EUR',
  'CAD',
  'AUD',
  'JMD',
  'NGN',
  'INR',
  'ZAR',
  'JPY'
] as const;

export function emptyRates(home = DEFAULT_HOME): RateTable {
  return { home, rates: {} };
}

/**
 * Converts into the home currency, or null when it cannot be done.
 *
 * Null rather than the original amount: a caller that forgets to check gets an
 * obvious hole rather than a number that looks converted and is not.
 */
export function toHome(
  amount: number,
  currency: string | undefined,
  table: RateTable
): number | null {
  const from = (currency || table.home).toUpperCase();
  if (from === table.home.toUpperCase()) return amount;

  const rate = table.rates[from];
  // A zero or negative rate is not a rate. It would divide to Infinity.
  if (!rate || !Number.isFinite(rate) || rate <= 0) return null;

  return amount / rate;
}

/** The other direction, for showing a home amount to someone who thinks in USD. */
export function fromHome(amount: number, currency: string, table: RateTable): number | null {
  const to = currency.toUpperCase();
  if (to === table.home.toUpperCase()) return amount;

  const rate = table.rates[to];
  if (!rate || !Number.isFinite(rate) || rate <= 0) return null;

  return amount * rate;
}

export function hasRate(currency: string | undefined, table: RateTable): boolean {
  const code = (currency || table.home).toUpperCase();
  return code === table.home.toUpperCase() || !!table.rates[code];
}

/** Every currency used here that has no rate — what the totals are missing. */
export function missingRates(
  currencies: readonly (string | undefined)[],
  table: RateTable
): string[] {
  const missing = new Set<string>();
  for (const currency of currencies) {
    const code = (currency || table.home).toUpperCase();
    if (!hasRate(code, table)) missing.add(code);
  }
  return [...missing].sort();
}

/**
 * How stale a rate table is, in days. Undefined when it was never stamped.
 *
 * Shown rather than acted on: nothing here refuses to convert on an old rate,
 * because an old rate is usually close enough for a shopping list and the
 * person can see the date and decide.
 */
export function rateAgeDays(table: RateTable, today = new Date()): number | undefined {
  if (!table.updatedAt) return undefined;
  const ms = today.getTime() - table.updatedAt.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function formatMoney(amount: number, currency = DEFAULT_HOME): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    // An unknown code must still show the number and the code, or an amount
    // becomes anonymous — the one thing worse than an ugly one.
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/**
 * An amount as written, plus what it comes to in the home currency.
 *
 * "$120.00 (≈ £94.49)". The original comes FIRST because that is what the
 * receipt says and what a supplier will argue about; the conversion is the
 * approximation, and is marked as one.
 */
export function withEquivalent(
  amount: number,
  currency: string | undefined,
  table: RateTable
): string {
  const code = (currency || table.home).toUpperCase();
  const original = formatMoney(amount, code);

  if (code === table.home.toUpperCase()) return original;

  const converted = toHome(amount, code, table);
  if (converted === null) return `${original} (no ${code} rate set)`;

  return `${original} (≈ ${formatMoney(converted, table.home)})`;
}
