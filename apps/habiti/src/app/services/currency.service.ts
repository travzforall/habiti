import { Injectable, computed, inject, signal } from '@angular/core';
import { UserStorage } from '@habiti/storage';
import { DEFAULT_HOME, RateTable, emptyRates, rateAgeDays } from '../config/currency';

/**
 * The currency this person thinks in, and the rates they have told us about.
 *
 * ── WHY THIS IS PER DEVICE AND SAID SO ────────────────────────────────────
 *
 * It is kept in UserStorage — namespaced per account, but not on a table, so
 * it does not follow you to another browser. That is a real limitation and the
 * settings screen says it out loud rather than letting someone discover it by
 * finding their budget in the wrong currency on their phone. Giving it a table
 * is a small change when it earns one; pretending it already syncs is not.
 */
@Injectable({ providedIn: 'root' })
export class CurrencyService {
  private readonly KEY = 'habiti_currency';
  private storage = inject(UserStorage);

  private _table = signal<RateTable>(emptyRates());

  readonly table = this._table.asReadonly();
  readonly home = computed(() => this._table().home);

  /** How old the rates are, in days. Undefined when none have been set. */
  readonly ageDays = computed(() => rateAgeDays(this._table()));

  constructor() {
    this.load();
  }

  setHome(currency: string): void {
    const home = (currency || DEFAULT_HOME).toUpperCase().slice(0, 8);

    this._table.update(table => ({
      ...table,
      home,
      // A rate to your own currency is meaningless and would read as 1 GBP =
      // 1.27 GBP. Dropping it is the only sane thing to do.
      rates: Object.fromEntries(
        Object.entries(table.rates).filter(([code]) => code !== home)
      )
    }));
    this.save();
  }

  /**
   * "1 <home> = <rate> <currency>", the sentence the settings screen shows.
   *
   * A blank or nonsense rate REMOVES the entry rather than storing a zero,
   * because a zero rate would divide to Infinity and a total would become a
   * symbol.
   */
  setRate(currency: string, rate: number | null | undefined): void {
    const code = currency.trim().toUpperCase();
    if (!code || code === this._table().home) return;

    this._table.update(table => {
      const rates = { ...table.rates };
      if (rate === null || rate === undefined || !Number.isFinite(rate) || rate <= 0) {
        delete rates[code];
      } else {
        rates[code] = rate;
      }
      return { ...table, rates, updatedAt: new Date() };
    });
    this.save();
  }

  removeRate(currency: string): void {
    this.setRate(currency, null);
  }

  private load(): void {
    try {
      const raw = this.storage.readRaw(this.KEY);
      if (!raw) return;

      const stored = JSON.parse(raw) as RateTable;
      this._table.set({
        home: stored.home || DEFAULT_HOME,
        rates: stored.rates ?? {},
        updatedAt: stored.updatedAt ? new Date(stored.updatedAt) : undefined
      });
    } catch (error) {
      console.error('CurrencyService: could not read the saved rates.', error);
    }
  }

  private save(): void {
    try {
      this.storage.writeRaw(this.KEY, JSON.stringify(this._table()));
    } catch (error) {
      console.error('CurrencyService: could not save the rates.', error);
    }
  }
}
