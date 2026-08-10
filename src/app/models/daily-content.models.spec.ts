import {
  DAILY_CONTENT_CATEGORY_META,
  DailyContent,
  dayOfYear,
  pickForDay,
  toDailyContent
} from './daily-content.models';
import { DAILY_CONTENT_SEED } from '../config/daily-content.seed';

function item(id: string, over: Partial<DailyContent> = {}): DailyContent {
  return {
    id,
    category: 'scripture',
    body: `body ${id}`,
    sortIndex: Number(id) || 0,
    minTier: 'free',
    active: true,
    ...over
  };
}

describe('dayOfYear', () => {
  it('counts from 1 on Jan 1', () => {
    expect(dayOfYear(new Date(2026, 0, 1))).toBe(1);
    expect(dayOfYear(new Date(2026, 0, 31))).toBe(31);
    expect(dayOfYear(new Date(2026, 11, 31))).toBe(365);
  });

  it('accounts for a leap day', () => {
    expect(dayOfYear(new Date(2024, 11, 31))).toBe(366);
  });
});

describe('pickForDay', () => {
  const pool = [item('1'), item('2'), item('3')];

  it('returns null when there is nothing to show', () => {
    expect(pickForDay([])).toBeNull();
    expect(pickForDay([item('1', { active: false })])).toBeNull();
  });

  it('is deterministic — the same day always yields the same item', () => {
    const day = new Date(2026, 7, 8);
    const first = pickForDay(pool, day);
    expect(pickForDay(pool, day)).toBe(first!);
    expect(pickForDay(pool, day)).toBe(first!);
  });

  it('advances on the next day and wraps around the pool', () => {
    const a = pickForDay(pool, new Date(2026, 7, 8));
    const b = pickForDay(pool, new Date(2026, 7, 9));
    const wrapped = pickForDay(pool, new Date(2026, 7, 11)); // +3 = full cycle

    expect(b).not.toBe(a!);
    expect(wrapped).toBe(a!);
  });

  it('skips inactive items entirely', () => {
    const withInactive = [item('1'), item('2', { active: false }), item('3')];
    for (let d = 1; d <= 10; d++) {
      const picked = pickForDay(withInactive, new Date(2026, 0, d));
      expect(picked!.id).not.toBe('2');
    }
  });

  it('a pinned date beats the rotation', () => {
    const day = new Date(2026, 7, 8);
    const withPin = [...pool, item('99', { pinnedDate: '2026-08-08' })];

    expect(pickForDay(withPin, day)!.id).toBe('99');
    // ...and only on that day.
    expect(pickForDay(withPin, new Date(2026, 7, 9))!.id).not.toBe('99');
  });

  it('keeps pinned items out of the normal rotation', () => {
    const withPin = [item('1'), item('2', { pinnedDate: '2030-01-01' })];
    for (let d = 1; d <= 5; d++) {
      expect(pickForDay(withPin, new Date(2026, 0, d))!.id).toBe('1');
    }
  });

  it('orders by sortIndex so the rotation does not depend on array order', () => {
    const shuffled = [item('3'), item('1'), item('2')];
    const ordered = [item('1'), item('2'), item('3')];
    const day = new Date(2026, 3, 17);
    expect(pickForDay(shuffled, day)!.id).toBe(pickForDay(ordered, day)!.id);
  });
});

describe('toDailyContent', () => {
  it('defaults a missing tier to free and missing active to true', () => {
    const mapped = toDailyContent({ id: 7, category: 'stoic', body: 'x' });
    expect(mapped.id).toBe('7');
    expect(mapped.minTier).toBe('free');
    expect(mapped.active).toBe(true);
    expect(mapped.sortIndex).toBe(0);
  });

  it('respects an explicit plus tier and inactive flag', () => {
    const mapped = toDailyContent({
      id: 8,
      category: 'quotes',
      body: 'y',
      min_tier: 'plus',
      active: false
    });
    expect(mapped.minTier).toBe('plus');
    expect(mapped.active).toBe(false);
  });

  it('turns empty strings into undefined rather than rendering blanks', () => {
    const mapped = toDailyContent({ id: 9, category: 'quotes', body: 'z', attribution: '' });
    expect(mapped.attribution).toBeUndefined();
  });
});

describe('bundled seed content', () => {
  it('covers every category so no category can render empty', () => {
    for (const category of Object.keys(DAILY_CONTENT_CATEGORY_META)) {
      const inCategory = DAILY_CONTENT_SEED.filter(i => i.category === category);
      expect(inCategory.length)
        .withContext(`seed content for ${category}`)
        .toBeGreaterThan(0);
    }
  });

  it('gives free members scripture and gates the rest behind plus', () => {
    const scripture = DAILY_CONTENT_SEED.filter(i => i.category === 'scripture');
    expect(scripture.every(i => i.minTier === 'free')).toBe(true);

    const paidOnly = DAILY_CONTENT_SEED.filter(i => i.category !== 'scripture');
    expect(paidOnly.every(i => i.minTier === 'plus')).toBe(true);
  });

  it('has no empty bodies and no duplicate ids', () => {
    expect(DAILY_CONTENT_SEED.every(i => i.body.trim().length > 0)).toBe(true);
    const ids = DAILY_CONTENT_SEED.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
