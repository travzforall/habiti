/**
 * What a habit actually records when you check it off.
 *
 * A tick is the wrong unit for most habits. "Wake at a set time" wants the time
 * you woke; "Drink water" wants glasses; "Deadlift" wants the weight on the
 * bar. Recording only done/not-done throws away the thing that shows progress —
 * you can hold a 30-day streak while quietly getting worse at the habit.
 *
 * Every spec answers three questions: what number is recorded, what unit it is
 * in, and which direction counts as success.
 */

export type TrackingKind =
  | 'simple' // done or not
  | 'count' // reps, glasses, pages, steps
  | 'duration' // minutes
  | 'sets' // sets of an exercise
  | 'time-of-day' // a clock time, stored as minutes past midnight
  | 'measure' // weight, distance — anything with a unit
  | 'rating' // a 1–5 subjective score
  | 'currency'; // an amount of money

/** Which way is "good". Decides whether a logged value counts as a success. */
export type GoalDirection = 'at-least' | 'at-most' | 'before' | 'after' | 'any';

export interface TrackingSpec {
  kind: TrackingKind;
  /** Shown next to the number. Omitted for `simple`. */
  unit?: string;
  /** The number to beat. For `time-of-day`, minutes past midnight. */
  target?: number;
  direction?: GoalDirection;
  /** Increment for steppers. */
  step?: number;
  min?: number;
  max?: number;
  /** Overrides the auto-generated prompt in the log dialog. */
  prompt?: string;
}

/** Minutes past midnight, so times sort and compare as plain numbers. */
export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const safe = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * The spec for a habit, falling back to something sensible.
 *
 * Most library habits describe themselves well enough through `unit` and
 * `goal` that an explicit spec is unnecessary — only the unusual ones
 * (wake time, body weight, mood) need to say more.
 */
export function trackingFor(habit: {
  tracking?: TrackingSpec;
  unit?: string;
  goal?: number;
  type?: 'good' | 'bad';
}): TrackingSpec {
  if (habit.tracking) return habit.tracking;

  const unit = habit.unit;
  const target = habit.goal;

  // A habit you are breaking is a yes/no by nature: you either avoided it today
  // or you did not, and there is no number that improves.
  if (habit.type === 'bad') return { kind: 'simple', direction: 'any' };

  if (!unit) return { kind: 'simple', direction: 'any' };

  switch (unit) {
    case 'minutes':
    case 'hours':
      return { kind: 'duration', unit, target, direction: 'at-least', step: 5, min: 0 };
    case 'sets':
      return { kind: 'sets', unit, target, direction: 'at-least', step: 1, min: 0 };
    case 'day':
    case 'days':
    case 'time':
    case 'times':
      return { kind: 'simple', direction: 'any' };
    default:
      return { kind: 'count', unit, target, direction: 'at-least', step: 1, min: 0 };
  }
}

/** True when a logged value hits the habit's target. */
export function meetsTarget(spec: TrackingSpec, value: number | undefined): boolean {
  if (spec.kind === 'simple') return value !== undefined;
  if (value === undefined) return false;
  if (spec.target === undefined) return true;

  switch (spec.direction) {
    case 'at-most':
    case 'before':
      return value <= spec.target;
    case 'at-least':
    case 'after':
      return value >= spec.target;
    default:
      return true;
  }
}

/** How close to target, 0–1. Drives the grid's colour intensity. */
export function progressToward(spec: TrackingSpec, value: number | undefined): number {
  if (value === undefined) return 0;
  if (spec.kind === 'simple' || spec.target === undefined) return 1;
  if (meetsTarget(spec, value)) return 1;

  // "Earlier is better" progress cannot be a plain ratio — 07:30 against a
  // 07:00 target is close, but 7.5/7 is not the number that says so.
  if (spec.direction === 'at-most' || spec.direction === 'before') {
    const overshoot = value - spec.target;
    const tolerance = Math.max(spec.target * 0.5, 60);
    return Math.max(0, 1 - overshoot / tolerance);
  }

  return Math.max(0, Math.min(1, value / spec.target));
}

/** The value as a person would say it. */
export function formatTrackedValue(spec: TrackingSpec, value: number | undefined): string {
  if (value === undefined) return '—';

  switch (spec.kind) {
    case 'simple':
      return 'Done';
    case 'time-of-day':
      return minutesToTime(value);
    case 'duration':
      return formatDuration(value, spec.unit);
    case 'currency':
      return `${spec.unit ?? ''}${value}`;
    case 'rating':
      return `${value}/${spec.max ?? 5}`;
    default:
      return spec.unit ? `${value} ${spec.unit}` : String(value);
  }
}

function formatDuration(value: number, unit?: string): string {
  if (unit === 'hours') return `${value}h`;
  if (value < 60) return `${value}m`;
  const h = Math.floor(value / 60);
  const m = value % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** What the log dialog asks. */
export function trackingPrompt(spec: TrackingSpec, habitName: string): string {
  if (spec.prompt) return spec.prompt;

  switch (spec.kind) {
    case 'simple':
      return `Did you do "${habitName}" today?`;
    case 'time-of-day':
      return 'What time?';
    case 'duration':
      return 'How long?';
    case 'sets':
      return 'How many sets?';
    case 'rating':
      return 'How did it go?';
    case 'currency':
      return 'How much?';
    case 'measure':
      return `How much ${spec.unit ?? ''}?`.trim();
    default:
      return `How many ${spec.unit ?? ''}?`.trim();
  }
}

/** The target, phrased for a summary line. */
export function describeTarget(spec: TrackingSpec): string {
  if (spec.kind === 'simple' || spec.target === undefined) return 'Just do it';

  const value = formatTrackedValue(spec, spec.target);
  switch (spec.direction) {
    case 'before':
      return `Before ${value}`;
    case 'after':
      return `After ${value}`;
    case 'at-most':
      return `${value} or less`;
    default:
      return `${value} or more`;
  }
}

/** Which HTML input the log dialog should show. */
export function inputTypeFor(spec: TrackingSpec): 'none' | 'time' | 'number' | 'rating' {
  if (spec.kind === 'simple') return 'none';
  if (spec.kind === 'time-of-day') return 'time';
  if (spec.kind === 'rating') return 'rating';
  return 'number';
}
