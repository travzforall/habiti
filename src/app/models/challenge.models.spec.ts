import { CHALLENGE_CATALOGUE } from '../config/challenge-catalogue.seed';
import {
  CHALLENGE_DIFFICULTIES,
  ChallengeRun,
  ChallengeTemplate,
  addDays,
  buildChallengeTerms,
  challengeProgress,
  daysBetween,
  hasFailed,
  levelValueFor,
  periodsFor,
  resolveTier,
  toDateKey
} from './challenge.models';

const SEVEN_DAY = CHALLENGE_CATALOGUE.find(t => t.id === 'cold-start-7')!;

function runOf(over: Partial<ChallengeRun> = {}): ChallengeRun {
  const startsOn = '2026-08-01';
  return {
    id: 'r1',
    campaignKey: 'chl_x',
    templateId: SEVEN_DAY.id,
    title: SEVEN_DAY.title,
    description: SEVEN_DAY.description,
    icon: SEVEN_DAY.icon,
    category: SEVEN_DAY.category,
    status: 'active',
    ownerUserId: 'u1',
    cadence: 'daily',
    startsOn,
    endsOn: addDays(startsOn, 6),
    timezone: 'UTC',
    terms: buildChallengeTerms(SEVEN_DAY, 'hard'),
    checkIns: [],
    outcome: 'pending',
    createdAt: '2026-08-01T09:00:00Z',
    ...over
  };
}

function days(from: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(from, i));
}

describe('date helpers', () => {
  it('formats a local date key without shifting the day', () => {
    expect(toDateKey(new Date(2026, 7, 8))).toBe('2026-08-08');
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('adds days across a month boundary', () => {
    expect(addDays('2026-08-30', 3)).toBe('2026-09-02');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('counts days between keys', () => {
    expect(daysBetween('2026-08-01', '2026-08-08')).toBe(7);
    expect(daysBetween('2026-08-08', '2026-08-01')).toBe(-7);
    expect(daysBetween('2026-08-01', '2026-08-01')).toBe(0);
  });
});

describe('resolveTier / levelValueFor', () => {
  it('uses the template tier when it exists', () => {
    expect(levelValueFor(SEVEN_DAY, 'easy')).toBe(6);
    expect(levelValueFor(SEVEN_DAY, 'medium')).toBe(9);
    expect(levelValueFor(SEVEN_DAY, 'hard')).toBe(12);
  });

  it('synthesizes a tier from baseLevelValue when the template omits one', () => {
    const bare: ChallengeTemplate = { ...SEVEN_DAY, tiers: {}, baseLevelValue: 10 };
    expect(levelValueFor(bare, 'easy')).toBe(10);
    expect(levelValueFor(bare, 'medium')).toBe(15);
    expect(levelValueFor(bare, 'hard')).toBe(20);
    expect(resolveTier(bare, 'hard').graceMisses).toBe(0);
  });

  it('never synthesizes a zero-level tier', () => {
    const tiny: ChallengeTemplate = { ...SEVEN_DAY, tiers: {}, baseLevelValue: 0 };
    expect(levelValueFor(tiny, 'easy')).toBeGreaterThanOrEqual(1);
  });
});

describe('periodsFor', () => {
  it('counts days for a daily cadence and weeks for a weekly one', () => {
    expect(periodsFor(SEVEN_DAY)).toBe(7);
    const weekly = CHALLENGE_CATALOGUE.find(t => t.cadence === 'weekly')!;
    expect(periodsFor(weekly)).toBe(4);
  });
});

describe('challengeProgress', () => {
  it('counts only days that are OVER as missed — never today', () => {
    // Day 3 with no check-ins: days 1 and 2 are missed. Today is still open,
    // so it is not a miss yet. Counting it failed Hard runs mid-morning.
    const p = challengeProgress(runOf(), '2026-08-03');
    expect(p.daysElapsed).toBe(3);
    expect(p.periodsPassed).toBe(0);
    expect(p.periodsMissed).toBe(2);
  });

  it('does not count today as missed on the very first day', () => {
    expect(challengeProgress(runOf(), '2026-08-01').periodsMissed).toBe(0);
  });

  it('leaves a hard run alive on day 2 before you have checked in', () => {
    // The exact failure: one check-in on day 1, Hard (zero misses allowed),
    // opening the app on day 2. The run must still be alive.
    const run = runOf({ checkIns: ['2026-08-01'] });
    const p = challengeProgress(run, '2026-08-02');
    expect(p.periodsMissed).toBe(0);
    expect(hasFailed(run, '2026-08-02')).toBe(false);
  });

  it('does fail it on day 3 once day 2 is genuinely gone', () => {
    const run = runOf({ checkIns: ['2026-08-01'] });
    expect(challengeProgress(run, '2026-08-03').periodsMissed).toBe(1);
    expect(hasFailed(run, '2026-08-03')).toBe(true);
  });

  it('reports today\'s check-in', () => {
    const run = runOf({ checkIns: ['2026-08-01', '2026-08-02'] });
    expect(challengeProgress(run, '2026-08-02').checkedInToday).toBe(true);
    expect(challengeProgress(run, '2026-08-03').checkedInToday).toBe(false);
  });

  it('computes a percentage of the whole run, not of elapsed time', () => {
    const run = runOf({ checkIns: days('2026-08-01', 3) });
    expect(challengeProgress(run, '2026-08-03').percent).toBe(43); // 3/7
  });
});

describe('completion guard', () => {
  it('refuses to complete a run that was started moments ago', () => {
    // The whole point: start Hard, claim 12 levels the same day.
    const run = runOf({ checkIns: ['2026-08-01'] });
    expect(challengeProgress(run, '2026-08-01').canComplete).toBe(false);
  });

  it('refuses part-way through, however many check-ins exist', () => {
    // Four days in with four check-ins: on track, but not finished.
    const run = runOf({ checkIns: days('2026-08-01', 4) });
    expect(challengeProgress(run, '2026-08-04').canComplete).toBe(false);
  });

  it('allows completion after a full, clean run', () => {
    const run = runOf({ checkIns: days('2026-08-01', 7) });
    expect(challengeProgress(run, '2026-08-07').canComplete).toBe(true);
  });

  it('refuses on Hard when a day was missed', () => {
    const run = runOf({ checkIns: days('2026-08-01', 6) }); // one short
    expect(challengeProgress(run, '2026-08-07').canComplete).toBe(false);
  });

  it('allows an easy run to finish with misses inside the grace allowance', () => {
    const easy = runOf({ terms: buildChallengeTerms(SEVEN_DAY, 'easy') });
    // 5 of 7 = 71% >= 70%, 2 missed <= 3 grace
    const run = { ...easy, checkIns: [...days('2026-08-01', 5)] };
    expect(challengeProgress(run, '2026-08-07').canComplete).toBe(true);
  });

  it('refuses a run that is already finished', () => {
    const run = runOf({ status: 'completed', checkIns: days('2026-08-01', 7) });
    expect(challengeProgress(run, '2026-08-07').canComplete).toBe(false);
  });
});

describe('hasFailed', () => {
  it('fails a hard run as soon as the grace allowance is blown', () => {
    const run = runOf({ checkIns: ['2026-08-01'] });
    expect(hasFailed(run, '2026-08-03')).toBe(true);
  });

  it('does not fail an easy run still inside its grace', () => {
    const easy = runOf({ terms: buildChallengeTerms(SEVEN_DAY, 'easy'), checkIns: ['2026-08-01'] });
    expect(hasFailed(easy, '2026-08-03')).toBe(false);
  });

  it('never reports an already-finished run as failing', () => {
    const run = runOf({ status: 'cancelled', checkIns: [] });
    expect(hasFailed(run, '2026-08-07')).toBe(false);
  });
});

describe('catalogue integrity', () => {
  it('has unique ids and stable sort indexes', () => {
    const ids = CHALLENGE_CATALOGUE.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    const sorts = CHALLENGE_CATALOGUE.map(t => t.sortIndex);
    expect(new Set(sorts).size).toBe(sorts.length);
  });

  it('awards more levels for harder tiers, everywhere', () => {
    for (const template of CHALLENGE_CATALOGUE) {
      const [easy, medium, hard] = CHALLENGE_DIFFICULTIES.map(d => levelValueFor(template, d));
      expect(easy)
        .withContext(`${template.id} easy < medium`)
        .toBeLessThan(medium);
      expect(medium)
        .withContext(`${template.id} medium < hard`)
        .toBeLessThan(hard);
    }
  });

  it('never awards zero or negative levels', () => {
    for (const template of CHALLENGE_CATALOGUE) {
      for (const difficulty of CHALLENGE_DIFFICULTIES) {
        expect(levelValueFor(template, difficulty)).toBeGreaterThan(0);
      }
    }
  });

  it('keeps every template solo-only until partnered challenges ship', () => {
    expect(CHALLENGE_CATALOGUE.every(t => t.allowsPartner === false)).toBe(true);
  });
});
