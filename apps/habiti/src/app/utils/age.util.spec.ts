import {
  MINIMUM_AGE,
  calculateAge,
  isAdult,
  latestAdultBirthDate,
  parseDateOnly,
  toDateOnlyString
} from './age.util';

const TODAY = new Date(2026, 7, 8); // 2026-08-08, local

describe('parseDateOnly', () => {
  it('parses YYYY-MM-DD in the LOCAL timezone, not UTC', () => {
    const d = parseDateOnly('1990-01-15')!;
    // `new Date('1990-01-15')` parses as UTC and reports the 14th west of
    // Greenwich. This is the bug the util exists to avoid.
    expect(d.getFullYear()).toBe(1990);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(15);
  });

  it('passes a Date through unchanged', () => {
    const d = new Date(2000, 5, 1);
    expect(parseDateOnly(d)).toBe(d);
  });

  it('returns null for junk', () => {
    expect(parseDateOnly('not a date')).toBeNull();
    expect(parseDateOnly('' as string)).toBeNull();
  });
});

describe('calculateAge', () => {
  it('returns null for missing or invalid input', () => {
    expect(calculateAge('')).toBeNull();
    expect(calculateAge(null)).toBeNull();
    expect(calculateAge(undefined)).toBeNull();
    expect(calculateAge('nonsense')).toBeNull();
  });

  it('returns null for a future date of birth rather than a negative age', () => {
    expect(calculateAge('2030-01-01', TODAY)).toBeNull();
  });

  it('counts whole years', () => {
    expect(calculateAge('1990-01-15', TODAY)).toBe(36);
    expect(calculateAge('2000-08-08', TODAY)).toBe(26);
  });

  it('does not count a birthday that has not happened yet this year', () => {
    expect(calculateAge('2000-08-09', TODAY)).toBe(25);
    expect(calculateAge('2000-08-08', TODAY)).toBe(26);
    expect(calculateAge('2000-12-31', TODAY)).toBe(25);
  });
});

describe('isAdult', () => {
  it('is false without a date of birth — absence is never treated as consent', () => {
    expect(isAdult('')).toBe(false);
    expect(isAdult(null)).toBe(false);
    expect(isAdult(undefined)).toBe(false);
    expect(isAdult('nonsense')).toBe(false);
  });

  it('is exact on the 18th birthday', () => {
    expect(isAdult('2008-08-08', TODAY)).toBe(true); // turns 18 today
    expect(isAdult('2008-08-09', TODAY)).toBe(false); // turns 18 tomorrow
  });

  it('rejects the clearly under-age', () => {
    expect(isAdult('2015-01-01', TODAY)).toBe(false);
  });
});

describe('latestAdultBirthDate', () => {
  it('is exactly MINIMUM_AGE years before today', () => {
    expect(latestAdultBirthDate(TODAY)).toBe('2008-08-08');
  });

  it('produces a date that itself qualifies', () => {
    expect(isAdult(latestAdultBirthDate(TODAY), TODAY)).toBe(true);
    expect(MINIMUM_AGE).toBe(18);
  });
});

describe('toDateOnlyString', () => {
  it('zero-pads month and day', () => {
    expect(toDateOnlyString(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toDateOnlyString(new Date(2026, 11, 25))).toBe('2026-12-25');
  });
});
