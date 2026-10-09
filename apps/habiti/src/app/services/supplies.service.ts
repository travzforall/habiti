import { Injectable, computed, inject, signal } from '@angular/core';
import { UserStorage } from '@habiti/storage';
import { SyncBus } from '@habiti/sync';
import {
  UserSupplyRow,
  fromSupplyOverride,
  toSupplyOverride
} from '../models/supply.models';
import { LibraryEntry, SupplyOverride, buildLibrary, countHidden, pickable } from '../config/supply-library';
import { AuthService } from './auth.service';
import { BaserowService } from './baserow.service';
import { ResettableRegistry } from './resettable.registry';

/**
 * This account's own tools and materials list.
 *
 * The built-in catalogue plus whatever has been changed about it — see
 * config/supply-library.ts for why that is stored as overrides rather than as
 * a copy per person.
 *
 * An edit to a catalogue entry CREATES an override the first time and updates
 * it afterwards, so hiding forty things costs forty small rows rather than a
 * copy of the whole list.
 */
@Injectable({ providedIn: 'root' })
export class SuppliesService {
  private readonly KEY = 'habiti_user_supplies';

  private storage = inject(UserStorage);
  private auth = inject(AuthService);
  private baserow = inject(BaserowService);
  private syncBus = inject(SyncBus);

  private _overrides = signal<SupplyOverride[]>([]);
  private warned = false;

  /** The whole list: catalogue merged with this account's changes. */
  readonly library = computed(() => buildLibrary(this._overrides()));
  readonly hiddenCount = computed(() => countHidden(this.library()));

  constructor() {
    inject(ResettableRegistry).register(this, ['projects']);
    this.loadCache();
    this.loadFromServer();
  }

  private get tableId(): number {
    return this.baserow.tables?.userSupplies ?? 0;
  }

  private userId(): string | null {
    const id = this.auth.currentUserValue?.id;
    return id !== undefined && id !== null ? String(id) : null;
  }

  /** What the picker offers, favourites first. */
  pickable(showHidden = false): LibraryEntry[] {
    return pickable(this.library(), showHidden);
  }

  entry(id: string): LibraryEntry | undefined {
    return this.library().find(candidate => candidate.id === id);
  }

  // --- changing it ----------------------------------------------------------

  /**
   * Changes one entry, creating the override row the first time.
   *
   * Takes the LibraryEntry rather than an id so the catalogue id and any
   * existing override are both to hand — the caller has the row it is looking
   * at, and asking it to work out which of the two this is would put the same
   * three lines in every caller.
   */
  update(entry: LibraryEntry, changes: Partial<SupplyOverride>): void {
    const existing = entry.overrideId
      ? this._overrides().find(candidate => candidate.id === entry.overrideId)
      : undefined;

    if (existing) {
      const updated = { ...existing, ...changes };
      this._overrides.update(list =>
        list.map(candidate => (candidate.id === existing.id ? updated : candidate))
      );
      this.save();
      this.persist(updated);
      return;
    }

    const created: SupplyOverride = {
      id: this.generateId(),
      catalogueId: entry.custom ? undefined : entry.id,
      // Only what changed is stored; everything else still comes from the
      // catalogue, so a later version can improve the rest.
      ...changes
    };

    this._overrides.update(list => [...list, created]);
    this.save();
    this.persist(created);
  }

  hide(entry: LibraryEntry): void {
    this.update(entry, { hidden: true });
  }

  show(entry: LibraryEntry): void {
    this.update(entry, { hidden: false });
  }

  toggleFavourite(entry: LibraryEntry): void {
    this.update(entry, { favourite: !entry.favourite });
  }

  /** Adds something the shipped list has never heard of. */
  addOwn(data: Partial<SupplyOverride>): SupplyOverride {
    const created: SupplyOverride = {
      id: this.generateId(),
      title: data.title?.trim() || 'New supply',
      kind: data.kind ?? 'material',
      category: data.category?.trim() || 'Mine',
      unit: data.unit,
      sizes: data.sizes,
      defaultStatus: data.defaultStatus,
      defaultCost: data.defaultCost,
      hidden: false,
      favourite: data.favourite ?? false,
      url: data.url,
      sku: data.sku,
      note: data.note
    };

    this._overrides.update(list => [...list, created]);
    this.save();
    this.persist(created);
    return created;
  }

  /**
   * Removes an override.
   *
   * For something of the user's own that is a delete. For a catalogue entry it
   * is a RESET — the entry comes back exactly as it ships, which is the only
   * sane meaning of deleting a change to something you do not own.
   */
  reset(entry: LibraryEntry): void {
    if (!entry.overrideId) return;

    this._overrides.update(list => list.filter(candidate => candidate.id !== entry.overrideId));
    this.save();

    const rowId = Number(entry.overrideId);
    if (!this.tableId || !Number.isFinite(rowId)) return;
    this.baserow.deleteRow(this.tableId, rowId).subscribe({
      error: err => console.warn('SuppliesService: row not deleted.', err)
    });
  }

  // --- persistence ----------------------------------------------------------

  private persist(override: SupplyOverride): void {
    const userId = this.userId();
    if (!userId) return;
    if (!this.tableId) return void this.warnOnce();

    const data = fromSupplyOverride(override, userId);
    const rowId = Number(override.id);
    const request = Number.isFinite(rowId)
      ? this.baserow.updateRow<UserSupplyRow>(this.tableId, rowId, data)
      : this.baserow.createRow<UserSupplyRow>(this.tableId, data);

    request.subscribe({
      next: row => {
        if (row && !Number.isFinite(rowId)) {
          const serverId = String(row.id);
          this._overrides.update(list =>
            list.map(candidate =>
              candidate.id === override.id ? { ...candidate, id: serverId } : candidate
            )
          );
          this.save();
        }
        this.syncBus.touched('projects');
      },
      error: err => console.warn('SuppliesService: change not saved.', err)
    });
  }

  private loadFromServer(): void {
    const userId = this.userId();
    if (!userId) return;
    if (!this.tableId) return void this.warnOnce();

    this.baserow
      .listAllRows<UserSupplyRow>(this.tableId, {
        filters: [{ field: 'user_id', op: 'equal', value: userId }]
      })
      .subscribe({
        next: rows => {
          const fromServer = (rows ?? []).map(toSupplyOverride);
          const known = new Set(fromServer.map(o => o.id));
          const localOnly = this._overrides().filter(
            o => !known.has(o.id) && !Number.isFinite(Number(o.id))
          );

          this._overrides.set([...fromServer, ...localOnly]);
          this.save();
          for (const override of localOnly) this.persist(override);
        },
        error: err => console.warn('SuppliesService: could not load your list.', err)
      });
  }

  reload(): void {
    this._overrides.set([]);
    this.warned = false;
    this.loadCache();
    this.loadFromServer();
  }

  private loadCache(): void {
    try {
      const raw = this.storage.readRaw(this.KEY);
      if (raw) this._overrides.set(JSON.parse(raw) as SupplyOverride[]);
    } catch (error) {
      console.error('SuppliesService: could not read the cache.', error);
    }
  }

  private save(): void {
    try {
      this.storage.writeRaw(this.KEY, JSON.stringify(this._overrides()));
    } catch (error) {
      console.error('SuppliesService: could not write the cache.', error);
    }
  }

  private warnOnce(): void {
    if (this.warned) return;
    this.warned = true;
    console.warn(
      'SuppliesService: tables.userSupplies is 0 — your list stays on this browser. ' +
        'Create it with: npm run db:setup -- --apply --write-env'
    );
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
}
