/**
 * Age helpers.
 *
 * Habiti does not display a user's age anywhere — it only needs to establish
 * that they are old enough to use the app, and later to enter a staked
 * campaign. Keep it that way: read `isAdult`, not `calculateAge`, unless you
 * genuinely need the number.
 */

export const MINIMUM_AGE = 18;

/**
 * Whole years between `dateOfBirth` and `on`, or null when the input is
 * missing or unparseable.
 *
 * Date-only strings ('1990-01-15') are parsed as LOCAL midnight, not UTC.
 * `new Date('1990-01-15')` would parse as UTC and land on the 14th for anyone
 * west of Greenwich, which is how the app ends up reporting the wrong age near
 * a birthday.
 */
export function calculateAge(dateOfBirth: string | Date | null | undefined, on: Date = new Date()): number | null {
  if (!dateOfBirth) return null;

  const birth = parseDateOnly(dateOfBirth);
  if (!birth || isNaN(birth.getTime())) return null;
  if (birth > on) return null;

  let age = on.getFullYear() - birth.getFullYear();
  const monthDiff = on.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && on.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/** True only when the date of birth is present, valid, and at least 18 years ago. */
export function isAdult(dateOfBirth: string | Date | null | undefined, on: Date = new Date()): boolean {
  const age = calculateAge(dateOfBirth, on);
  return age !== null && age >= MINIMUM_AGE;
}

/** The latest date of birth that still qualifies — used as a date input's `max`. */
export function latestAdultBirthDate(on: Date = new Date()): string {
  const d = new Date(on.getFullYear() - MINIMUM_AGE, on.getMonth(), on.getDate());
  return toDateOnlyString(d);
}

/**
 * Parses 'YYYY-MM-DD' in the local timezone. Anything else is handed to the
 * Date constructor unchanged.
 */
export function parseDateOnly(value: string | Date): Date | null {
  if (value instanceof Date) return value;
  if (typeof value !== 'string') return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (match) {
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function toDateOnlyString(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
