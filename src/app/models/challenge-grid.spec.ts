import {
  ChallengeRun,
  addDays,
  buildChallengeTerms,
  parseDateKey,
  runDates,
  toDateKey
} from './challenge.models';
import { CHALLENGE_CATALOGUE } from '../config/challenge-catalogue.seed';

const SEVEN_DAY = CHALLENGE_CATALOGUE.find(t => t.id === 'cold-start-7')!;

function run(over: Partial<ChallengeRun> = {}): ChallengeRun {
  return {
    id: 'r1',
    campaignKey: 'chl_x',
    templateId: SEVEN_DAY.id,
    title: SEVEN_DAY.title,
    description: '',
    icon: '🥶',
    category: 'discipline',
    status: 'active',
    ownerUserId: '1',
    cadence: 'daily',
    startsOn: '2026-08-01',
    endsOn: '2026-08-07',
    timezone: 'UTC',
    terms: buildChallengeTerms(SEVEN_DAY, 'hard'),
    checkIns: [],
    outcome: 'pending',
    createdAt: '2026-08-01T09:00:00Z',
    ...over
  };
}

describe('habit binding', () => {
  it('records the chosen habits on the run', () => {
    const terms = buildChallengeTerms(SEVEN_DAY, 'hard', ['h1', 'h2']);
    expect(terms.habitIds).toEqual(['h1', 'h2']);
  });

  it('leaves habitIds undefined when nothing is chosen — meaning any habit counts', () => {
    expect(buildChallengeTerms(SEVEN_DAY, 'hard').habitIds).toBeUndefined();
    expect(buildChallengeTerms(SEVEN_DAY, 'hard', []).habitIds).toBeUndefined();
  });

  it('copies the array so a later edit to the caller does not mutate the run', () => {
    const source = ['h1'];
    const terms = buildChallengeTerms(SEVEN_DAY, 'hard', source);
    source.push('h2');
    expect(terms.habitIds).toEqual(['h1']);
  });

  it('does not disturb the frozen payout', () => {
    expect(buildChallengeTerms(SEVEN_DAY, 'hard', ['h1']).levelValue).toBe(12);
  });
});

describe('runDates — the grid columns', () => {
  it('covers every day inclusive of both ends', () => {
    const dates = runDates(run());
    expect(dates.length).toBe(7);
    expect(dates[0]).toBe('2026-08-01');
    expect(dates[6]).toBe('2026-08-07');
  });

  it('handles a single-day run', () => {
    const dates = runDates(run({ startsOn: '2026-08-01', endsOn: '2026-08-01' }));
    expect(dates).toEqual(['2026-08-01']);
  });

  it('crosses a month boundary', () => {
    const dates = runDates(run({ startsOn: '2026-08-30', endsOn: '2026-09-02' }));
    expect(dates).toEqual(['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02']);
  });

  it('crosses a year boundary', () => {
    const dates = runDates(run({ startsOn: '2026-12-30', endsOn: '2027-01-02' }));
    expect(dates).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  });

  it('returns nothing sensible rather than looping forever on a backwards range', () => {
    expect(runDates(run({ startsOn: '2026-08-07', endsOn: '2026-08-01' })).length).toBe(1);
  });

  it('covers a 30-day run exactly', () => {
    const start = '2026-08-01';
    const dates = runDates(run({ startsOn: start, endsOn: addDays(start, 29) }));
    expect(dates.length).toBe(30);
  });
});

describe('parseDateKey', () => {
  it('reads a date key as LOCAL, not UTC', () => {
    const d = parseDateKey('2026-08-08');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(8);
  });

  it('round-trips with toDateKey', () => {
    for (const key of ['2026-01-01', '2026-08-08', '2026-12-31']) {
      expect(toDateKey(parseDateKey(key))).toBe(key);
    }
  });
});
