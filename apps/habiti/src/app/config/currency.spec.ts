import {
  RateTable,
  emptyRates,
  formatMoney,
  fromHome,
  hasRate,
  missingRates,
  rateAgeDays,
  toHome,
  withEquivalent
} from './currency';

const table: RateTable = {
  home: 'GBP',
  rates: { USD: 1.27, EUR: 1.17 },
  updatedAt: new Date(2026, 7, 1)
};

describe('converting into the home currency', () => {
  it('leaves an amount already in it alone', () => {
    expect(toHome(65, 'GBP', table)).toBe(65);
    expect(toHome(65, undefined, table)).toBe(65);
  });

  it('divides by the rate, because the rate says how many you get for one', () => {
    // 1 GBP = 1.27 USD, so $127 is £100.
    expect(toHome(127, 'USD', table)).toBeCloseTo(100, 6);
  });

  it('does not care about case', () => {
    expect(toHome(127, 'usd', table)).toBeCloseTo(100, 6);
  });

  it('returns null rather than pretending, when there is no rate', () => {
    // The alternative is adding $120 to a pounds total as £120.
    expect(toHome(120, 'JMD', table)).toBeNull();
  });

  it('returns null for a rate that is not a rate', () => {
    const broken: RateTable = { home: 'GBP', rates: { USD: 0, EUR: -1 } };
    expect(toHome(10, 'USD', broken)).toBeNull();
    expect(toHome(10, 'EUR', broken)).toBeNull();
  });
});

describe('converting out of it', () => {
  it('multiplies', () => {
    expect(fromHome(100, 'USD', table)).toBeCloseTo(127, 6);
  });

  it('is the inverse of coming back', () => {
    const there = fromHome(100, 'USD', table)!;
    expect(toHome(there, 'USD', table)).toBeCloseTo(100, 6);
  });
});

describe('what is missing', () => {
  it('names every currency with no rate, once', () => {
    expect(missingRates(['USD', 'JMD', 'JMD', undefined, 'NGN'], table)).toEqual(['JMD', 'NGN']);
  });

  it('is empty when everything can be converted', () => {
    expect(missingRates(['USD', 'GBP'], table)).toEqual([]);
  });

  it('knows the home currency always converts', () => {
    expect(hasRate(undefined, emptyRates('GBP'))).toBe(true);
    expect(hasRate('USD', emptyRates('GBP'))).toBe(false);
  });
});

describe('how old the rates are', () => {
  it('counts the days', () => {
    expect(rateAgeDays(table, new Date(2026, 7, 16))).toBe(15);
  });

  it('says nothing when they were never stamped', () => {
    expect(rateAgeDays(emptyRates())).toBeUndefined();
  });
});

describe('showing an amount', () => {
  it('shows the original first, and the conversion as an approximation', () => {
    const shown = withEquivalent(127, 'USD', table);
    expect(shown).toContain('127');
    expect(shown).toContain('≈');
    expect(shown).toContain('100');
  });

  it('adds nothing when it is already the home currency', () => {
    expect(withEquivalent(65, 'GBP', table)).not.toContain('≈');
  });

  it('says which rate is missing instead of hiding the problem', () => {
    expect(withEquivalent(120, 'JMD', table)).toContain('no JMD rate set');
  });

  it('still shows the number and the code for a currency Intl does not know', () => {
    expect(formatMoney(65, 'NOPE')).toBe('65.00 NOPE');
  });
});
