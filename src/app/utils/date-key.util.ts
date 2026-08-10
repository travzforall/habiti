/**
 * `YYYY-MM-DD` date keys, in LOCAL time.
 *
 * Every date in this app is a day, not an instant — "did I check in today?"
 * has no timezone. These four functions are the only sanctioned way to move
 * between a Date and a day key, and they exist as a group because the naive
 * versions of each are wrong in the same way:
 *
 *   toDateKey    — never toISOString(), which shifts the day in any negative
 *                  UTC offset, so a 7pm check-in in New York lands on tomorrow
 *   parseDateKey — never new Date('2026-08-09'), which the spec parses as UTC
 *                  midnight and therefore renders as the 8th west of Greenwich
 *
 * They lived in challenge.models.ts, which meant anything needing a date key
 * imported the challenge domain to get one — including the sync scheduler,
 * which otherwise knows about no feature at all.
 */

/** Local `YYYY-MM-DD`. Never uses toISOString, which would shift the day in a negative offset. */
export function toDateKey(date: Date = new Date()): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** 'YYYY-MM-DD' back to a local Date — never `new Date(str)`, which is UTC. */
export function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const a = new Date(fy, fm - 1, fd).getTime();
  const b = new Date(ty, tm - 1, td).getTime();
  return Math.round((b - a) / 86_400_000);
}
