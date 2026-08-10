import {
  BASE_LEVEL,
  LevelRecordLike,
  LevelSource,
  evaluateRun,
  findChainBreaks,
  groupByMonth,
  levelAsOf,
  levelBand,
  levelFromRecords,
  levelsToNextBand,
  sumBySource,
  withLevelChain
} from './level-derivation.util';

function rec(
  id: string,
  levelsAwarded: number,
  occurredAt: Date,
  over: Partial<LevelRecordLike> = {}
): LevelRecordLike {
  return {
    id,
    levelsAwarded,
    levelBefore: 0,
    levelAfter: 0,
    occurredAt,
    source: 'challenge' as LevelSource,
    ...over
  };
}

const JAN = new Date(2026, 0, 10);
const FEB = new Date(2026, 1, 10);
const MAR = new Date(2026, 2, 10);

describe('levelFromRecords', () => {
  it('starts at level 1 with an empty ledger', () => {
    expect(levelFromRecords([])).toBe(BASE_LEVEL);
    expect(BASE_LEVEL).toBe(1);
  });

  it('sums awards on top of the base level', () => {
    expect(levelFromRecords([{ levelsAwarded: 4 }])).toBe(5);
    expect(levelFromRecords([{ levelsAwarded: 4 }, { levelsAwarded: 12 }])).toBe(17);
  });

  it('ignores negative awards rather than subtracting — levels are permanent', () => {
    expect(levelFromRecords([{ levelsAwarded: 10 }, { levelsAwarded: -5 }])).toBe(11);
  });

  it('floors fractional awards', () => {
    expect(levelFromRecords([{ levelsAwarded: 2.9 }])).toBe(3);
  });
});

describe('levelAsOf', () => {
  it('only counts records up to the given moment', () => {
    const ledger = [rec('a', 4, JAN), rec('b', 12, FEB), rec('c', 20, MAR)];
    expect(levelAsOf(ledger, JAN)).toBe(5);
    expect(levelAsOf(ledger, FEB)).toBe(17);
    expect(levelAsOf(ledger, MAR)).toBe(37);
    expect(levelAsOf(ledger, new Date(2025, 0, 1))).toBe(1);
  });
});

describe('withLevelChain', () => {
  it('rebuilds before/after in chronological order regardless of input order', () => {
    const chained = withLevelChain([rec('c', 20, MAR), rec('a', 4, JAN), rec('b', 12, FEB)]);

    expect(chained.map(r => r.id)).toEqual(['a', 'b', 'c']);
    expect(chained.map(r => [r.levelBefore, r.levelAfter])).toEqual([
      [1, 5],
      [5, 17],
      [17, 37]
    ]);
  });

  it('produces a chain that findChainBreaks accepts', () => {
    const chained = withLevelChain([rec('a', 4, JAN), rec('b', 12, FEB)]);
    expect(findChainBreaks(chained)).toEqual([]);
  });

  it('repairs a chain whose denormalized values have drifted', () => {
    const broken = [
      rec('a', 4, JAN, { levelBefore: 1, levelAfter: 99 }),
      rec('b', 12, FEB, { levelBefore: 99, levelAfter: 111 })
    ];
    expect(findChainBreaks(broken).length).toBeGreaterThan(0);
    expect(findChainBreaks(withLevelChain(broken))).toEqual([]);
  });
});

describe('findChainBreaks', () => {
  it('is empty for a well-formed chain', () => {
    expect(findChainBreaks(withLevelChain([rec('a', 4, JAN), rec('b', 12, FEB)]))).toEqual([]);
  });

  it('flags a forged record that does not continue from the previous one', () => {
    const forged = [
      rec('a', 4, JAN, { levelBefore: 1, levelAfter: 5 }),
      rec('b', 12, FEB, { levelBefore: 40, levelAfter: 52 }) // jumped from 5 to 40
    ];
    expect(findChainBreaks(forged)).toEqual([1]);
  });

  it('flags a record whose own arithmetic is wrong', () => {
    const bad = [rec('a', 4, JAN, { levelBefore: 1, levelAfter: 50 })];
    expect(findChainBreaks(bad)).toEqual([0]);
  });

  it('flags a first record that does not start from the base level', () => {
    const bad = [rec('a', 4, JAN, { levelBefore: 7, levelAfter: 11 })];
    expect(findChainBreaks(bad)).toEqual([0]);
  });
});

describe('sumBySource', () => {
  it('totals only the requested source', () => {
    const ledger = [
      rec('a', 4, JAN, { source: 'migration' }),
      rec('b', 12, FEB, { source: 'challenge' }),
      rec('c', 8, MAR, { source: 'challenge' })
    ];
    expect(sumBySource(ledger, 'challenge')).toBe(20);
    expect(sumBySource(ledger, 'migration')).toBe(4);
    expect(sumBySource(ledger, 'streak')).toBe(0);
  });
});

describe('levelBand', () => {
  it('maps levels onto bands at the documented boundaries', () => {
    expect(levelBand(1)).toBe('novice');
    expect(levelBand(9)).toBe('novice');
    expect(levelBand(10)).toBe('steady');
    expect(levelBand(24)).toBe('steady');
    expect(levelBand(25)).toBe('committed');
    expect(levelBand(49)).toBe('committed');
    expect(levelBand(50)).toBe('relentless');
    expect(levelBand(99)).toBe('relentless');
    expect(levelBand(100)).toBe('legendary');
    expect(levelBand(1000)).toBe('legendary');
  });
});

describe('levelsToNextBand', () => {
  it('counts levels remaining to the next band', () => {
    expect(levelsToNextBand(1)).toBe(9);
    expect(levelsToNextBand(9)).toBe(1);
    expect(levelsToNextBand(10)).toBe(15);
    expect(levelsToNextBand(99)).toBe(1);
  });

  it('is null once legendary — there is nothing above it', () => {
    expect(levelsToNextBand(100)).toBeNull();
    expect(levelsToNextBand(250)).toBeNull();
  });
});

describe('groupByMonth', () => {
  it('buckets by month and year, preserving the given order', () => {
    const rows = [
      rec('c', 1, new Date(2026, 2, 20)),
      rec('b', 1, new Date(2026, 2, 2)),
      rec('a', 1, new Date(2026, 0, 5))
    ];
    const sections = groupByMonth(rows);

    expect(sections.map(s => s.monthLabel)).toEqual(['March 2026', 'January 2026']);
    expect(sections[0].records.map(r => r.id)).toEqual(['c', 'b']);
  });

  it('keeps the same month in different years apart', () => {
    const sections = groupByMonth([
      rec('a', 1, new Date(2026, 0, 5)),
      rec('b', 1, new Date(2025, 0, 5))
    ]);
    expect(sections.map(s => s.monthLabel)).toEqual(['January 2026', 'January 2025']);
  });

  it('returns nothing for an empty ledger', () => {
    expect(groupByMonth([])).toEqual([]);
  });
});

describe('evaluateRun', () => {
  const hard = { requiredPassRate: 1.0, graceMisses: 0 };
  const easy = { requiredPassRate: 0.7, graceMisses: 3 };

  it('is pending before the run is decided', () => {
    expect(evaluateRun({ periodsTotal: 7, periodsPassed: 3, periodsMissed: 0, ...easy }).outcome).toBe(
      'pending'
    );
  });

  it('is pending with no periods at all rather than claiming success', () => {
    expect(evaluateRun({ periodsTotal: 0, periodsPassed: 0, periodsMissed: 0, ...hard }).outcome).toBe(
      'pending'
    );
  });

  it('succeeds on a perfect hard run', () => {
    const result = evaluateRun({ periodsTotal: 7, periodsPassed: 7, periodsMissed: 0, ...hard });
    expect(result.outcome).toBe('success');
    expect(result.passRate).toBe(1);
  });

  it('fails a hard run on the first miss, without waiting for the run to finish', () => {
    const result = evaluateRun({ periodsTotal: 7, periodsPassed: 3, periodsMissed: 1, ...hard });
    expect(result.outcome).toBe('failure');
  });

  it('forgives misses up to exactly the grace allowance', () => {
    expect(
      evaluateRun({ periodsTotal: 10, periodsPassed: 7, periodsMissed: 3, ...easy }).outcome
    ).toBe('success');
    expect(
      evaluateRun({ periodsTotal: 10, periodsPassed: 6, periodsMissed: 4, ...easy }).outcome
    ).toBe('failure');
  });

  it('succeeds at exactly the required pass rate', () => {
    expect(
      evaluateRun({ periodsTotal: 10, periodsPassed: 7, periodsMissed: 3, ...easy }).passRate
    ).toBe(0.7);
    expect(
      evaluateRun({ periodsTotal: 10, periodsPassed: 7, periodsMissed: 3, ...easy }).outcome
    ).toBe('success');
  });
});
