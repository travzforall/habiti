import {
  describeTarget,
  formatTrackedValue,
  inputTypeFor,
  meetsTarget,
  minutesToTime,
  progressToward,
  timeToMinutes,
  trackingFor,
  trackingPrompt
} from './tracking';
import { libraryHabit } from './index';

describe('habit tracking', () => {
  describe('clock times', () => {
    it('round-trips a time through minutes', () => {
      expect(timeToMinutes('06:30')).toBe(390);
      expect(minutesToTime(390)).toBe('06:30');
      expect(minutesToTime(timeToMinutes('23:59'))).toBe('23:59');
    });

    it('pads single digits', () => {
      expect(minutesToTime(5)).toBe('00:05');
      expect(minutesToTime(0)).toBe('00:00');
    });

    it('survives nonsense rather than producing NaN', () => {
      expect(timeToMinutes('')).toBe(0);
      expect(timeToMinutes('not a time')).toBe(0);
    });

    it('wraps values outside a day', () => {
      expect(minutesToTime(1440)).toBe('00:00');
      expect(minutesToTime(-60)).toBe('23:00');
    });
  });

  describe('derived specs', () => {
    it('treats a habit you are breaking as yes/no', () => {
      // There is no number that improves "did not drink today".
      expect(trackingFor({ type: 'bad', unit: 'day', goal: 1 }).kind).toBe('simple');
    });

    it('reads minutes as a duration and other units as counts', () => {
      expect(trackingFor({ unit: 'minutes', goal: 30 }).kind).toBe('duration');
      expect(trackingFor({ unit: 'glasses', goal: 8 }).kind).toBe('count');
      expect(trackingFor({ unit: 'sets', goal: 3 }).kind).toBe('sets');
    });

    it('treats "day" and "times" as nothing worth measuring', () => {
      expect(trackingFor({ unit: 'day', goal: 1 }).kind).toBe('simple');
      expect(trackingFor({ unit: 'times', goal: 3 }).kind).toBe('simple');
    });

    it('prefers an explicit spec over anything derived', () => {
      const explicit = { kind: 'time-of-day' as const, target: 420 };
      expect(trackingFor({ tracking: explicit, unit: 'minutes', goal: 30 })).toBe(explicit);
    });
  });

  describe('meeting the target', () => {
    const wake = { kind: 'time-of-day' as const, target: timeToMinutes('07:00'), direction: 'before' as const };

    it('counts an earlier wake time as a success', () => {
      expect(meetsTarget(wake, timeToMinutes('06:30'))).toBe(true);
      expect(meetsTarget(wake, timeToMinutes('07:00'))).toBe(true);
      expect(meetsTarget(wake, timeToMinutes('07:30'))).toBe(false);
    });

    it('counts more as better when the direction says so', () => {
      const water = { kind: 'count' as const, target: 8, direction: 'at-least' as const };
      expect(meetsTarget(water, 8)).toBe(true);
      expect(meetsTarget(water, 9)).toBe(true);
      expect(meetsTarget(water, 7)).toBe(false);
    });

    it('treats a simple habit as done when anything was logged', () => {
      expect(meetsTarget({ kind: 'simple' }, undefined)).toBe(false);
      expect(meetsTarget({ kind: 'simple' }, 1)).toBe(true);
    });

    it('accepts any value when there is no target', () => {
      expect(meetsTarget({ kind: 'count', direction: 'at-least' }, 3)).toBe(true);
    });
  });

  describe('partial progress', () => {
    it('is complete once the target is met', () => {
      expect(progressToward({ kind: 'count', target: 8, direction: 'at-least' }, 8)).toBe(1);
      expect(progressToward({ kind: 'count', target: 8, direction: 'at-least' }, 20)).toBe(1);
    });

    it('is proportional below an at-least target', () => {
      expect(progressToward({ kind: 'count', target: 8, direction: 'at-least' }, 4)).toBe(0.5);
    });

    it('does not use a plain ratio for "earlier is better"', () => {
      // Waking at 07:30 against a 07:00 target is close. A ratio of the raw
      // minute counts (450/420) would report it as over-achieved.
      const wake = { kind: 'time-of-day' as const, target: 420, direction: 'before' as const };
      const near = progressToward(wake, 450);
      expect(near).toBeGreaterThan(0);
      expect(near).toBeLessThan(1);
      expect(progressToward(wake, 900)).toBe(0);
    });

    it('is zero with nothing logged', () => {
      expect(progressToward({ kind: 'count', target: 5 }, undefined)).toBe(0);
    });
  });

  describe('formatting', () => {
    it('shows a clock time for time-of-day', () => {
      expect(formatTrackedValue({ kind: 'time-of-day' }, 390)).toBe('06:30');
    });

    it('shows durations in hours and minutes', () => {
      expect(formatTrackedValue({ kind: 'duration' }, 45)).toBe('45m');
      expect(formatTrackedValue({ kind: 'duration' }, 90)).toBe('1h 30m');
      expect(formatTrackedValue({ kind: 'duration' }, 120)).toBe('2h');
      expect(formatTrackedValue({ kind: 'duration', unit: 'hours' }, 7)).toBe('7h');
    });

    it('shows a unit for counts and measures', () => {
      expect(formatTrackedValue({ kind: 'count', unit: 'glasses' }, 8)).toBe('8 glasses');
      expect(formatTrackedValue({ kind: 'measure', unit: 'kg' }, 100)).toBe('100 kg');
    });

    it('shows an em dash when nothing was logged', () => {
      expect(formatTrackedValue({ kind: 'count', unit: 'reps' }, undefined)).toBe('—');
    });
  });

  describe('phrasing', () => {
    it('describes the target in the direction it is judged', () => {
      expect(describeTarget({ kind: 'time-of-day', target: 420, direction: 'before' })).toBe(
        'Before 07:00'
      );
      expect(describeTarget({ kind: 'count', target: 8, unit: 'glasses', direction: 'at-least' })).toBe(
        '8 glasses or more'
      );
      expect(describeTarget({ kind: 'simple' })).toBe('Just do it');
    });

    it('asks a question that fits the kind', () => {
      expect(trackingPrompt({ kind: 'time-of-day' }, 'Wake up')).toBe('What time?');
      expect(trackingPrompt({ kind: 'duration' }, 'Run')).toBe('How long?');
      expect(trackingPrompt({ kind: 'time-of-day', prompt: 'Woke at?' }, 'x')).toBe('Woke at?');
    });

    it('picks the right input control', () => {
      expect(inputTypeFor({ kind: 'simple' })).toBe('none');
      expect(inputTypeFor({ kind: 'time-of-day' })).toBe('time');
      expect(inputTypeFor({ kind: 'rating' })).toBe('rating');
      expect(inputTypeFor({ kind: 'measure' })).toBe('number');
    });
  });

  describe('library specs', () => {
    it('records the TIME for the wake-time habit, not a tick', () => {
      const spec = trackingFor(libraryHabit('same-wake-time'));
      expect(spec.kind).toBe('time-of-day');
      expect(spec.direction).toBe('before');
      expect(minutesToTime(spec.target!)).toBe('07:00');
    });

    it('records weight on the bar for the big lifts', () => {
      for (const id of ['deadlift', 'back-squat', 'bench-press']) {
        const spec = trackingFor(libraryHabit(id));
        expect(spec.kind).withContext(id).toBe('measure');
        expect(spec.unit).withContext(id).toBe('kg');
      }
    });

    it('derives something sensible for habits with no explicit spec', () => {
      expect(trackingFor(libraryHabit('water-8')).kind).toBe('count');
      expect(trackingFor(libraryHabit('no-junk-food')).kind).toBe('simple');
    });
  });
});

import { specForHabit, libraryHabitByName, toHabitDraft } from './index';

/**
 * The per-user target override.
 *
 * Kind, unit and direction belong to the habit; the target is personal. 07:00
 * is a reasonable default wake time and a terrible universal rule.
 */
describe('specForHabit', () => {
  it('takes kind and direction from the library, by name', () => {
    const spec = specForHabit({ name: 'Same wake time daily' });
    expect(spec.kind).toBe('time-of-day');
    expect(spec.direction).toBe('before');
    expect(minutesToTime(spec.target!)).toBe('07:00');
  });

  it('matches the library name case-insensitively', () => {
    expect(libraryHabitByName('  same WAKE time daily ')?.id).toBe('same-wake-time');
  });

  it('lets the user override the target without changing the kind', () => {
    const spec = specForHabit({ name: 'Same wake time daily', targetValue: timeToMinutes('05:30') });
    expect(spec.kind).toBe('time-of-day');
    expect(spec.direction).toBe('before');
    expect(minutesToTime(spec.target!)).toBe('05:30');
  });

  it('falls back to unit and goal for a habit the user invented', () => {
    const spec = specForHabit({ name: 'Feed the cat', unit: 'minutes', goal: 5 });
    expect(spec.kind).toBe('duration');
    expect(spec.target).toBe(5);
  });

  it('treats an undefined target as "use the default", not zero', () => {
    // target_value used to be read as `|| 1`, turning "no target" into 1.
    const spec = specForHabit({ name: 'Same wake time daily', targetValue: undefined });
    expect(minutesToTime(spec.target!)).toBe('07:00');
  });

  it('carries the tracking target onto a new habit', () => {
    const draft = toHabitDraft(libraryHabitByName('Same wake time daily')!);
    expect(draft.targetValue).toBe(timeToMinutes('07:00'));
  });
});
