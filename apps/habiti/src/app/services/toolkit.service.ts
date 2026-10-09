import { Injectable, computed, inject, signal } from '@angular/core';
import { UserStorage } from '@habiti/storage';
import { AuthService } from './auth.service';
import { BaserowService } from './baserow.service';
import { ResettableRegistry } from './resettable.registry';
import {
  ToolkitItem,
  ToolkitItemRow,
  ToolkitKind,
  ToolkitStatus,
  fromToolkitItem,
  summarise,
  toToolkitItem
} from '../models/toolkit.models';

const STORE_KEY = 'habiti_toolkit_items';

/**
 * The user's standing kit.
 *
 * Local-first, in the shape ProjectBudgetService and LevelService already use:
 * every mutation lands in the signal and localStorage immediately, then goes to
 * Baserow. A failed write is not a lost edit — the cache is the record until
 * the next successful sync.
 *
 * While `toolkitItems` is 0 the whole feature is local-only and says so once.
 * That is not a degraded mode to apologise for: the table does not exist yet,
 * and a personal list that works before anyone runs db:setup is more useful
 * than one that refuses to.
 *
 * Ids: a locally-created item gets `local:<random>` until the server assigns a
 * real one. Anything holding an id must therefore tolerate it changing — which
 * is why project rows COPY from a toolkit item rather than referencing it.
 */
@Injectable({ providedIn: 'root' })
export class ToolkitService {
  private storage = inject(UserStorage);
  private auth = inject(AuthService);
  private baserow = inject(BaserowService);

  private readonly _items = signal<ToolkitItem[]>([]);
  readonly items = this._items.asReadonly();

  /** Everything not archived, in kind then sort order then title. */
  readonly live = computed(() =>
    this._items()
      .filter(item => !item.archived)
      .sort(
        (a, b) =>
          (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.title.localeCompare(b.title)
      )
  );

  readonly archived = computed(() => this._items().filter(item => item.archived));
  readonly summary = computed(() => summarise(this._items()));

  /** The shopping list: what is missing or broken. */
  readonly wanted = computed(() =>
    this.live().filter(item => item.status === 'need' || item.status === 'broken')
  );

  private warned = false;

  constructor() {
    inject(ResettableRegistry).register(this, ['projects']);
    this.loadCache();
    this.loadFromServer();
  }

  private get table(): number {
    return this.baserow.tables?.toolkitItems ?? 0;
  }

  private userId(): string | null {
    const id = this.auth.currentUserValue?.id;
    return id !== undefined && id !== null ? String(id) : null;
  }

  // --- reading --------------------------------------------------------------

  byKind(kind: ToolkitKind): ToolkitItem[] {
    return this.live().filter(item => item.kind === kind);
  }

  /** Kit that supports a given habit — the barbell behind "Back squat". */
  forHabit(habitId: string): ToolkitItem[] {
    return this.live().filter(item => item.linkedHabitIds.includes(habitId));
  }

  find(id: string): ToolkitItem | undefined {
    return this._items().find(item => item.id === id);
  }

  search(term: string): ToolkitItem[] {
    const needle = term.trim().toLowerCase();
    if (!needle) return this.live();

    return this.live().filter(
      item =>
        item.title.toLowerCase().includes(needle) ||
        (item.supplier ?? '').toLowerCase().includes(needle) ||
        (item.location ?? '').toLowerCase().includes(needle) ||
        (item.note ?? '').toLowerCase().includes(needle)
    );
  }

  // --- writing --------------------------------------------------------------

  add(draft: Partial<ToolkitItem> & { title: string }): ToolkitItem {
    const item: ToolkitItem = {
      id: `local:${Math.random().toString(36).slice(2, 10)}`,
      userId: this.userId() ?? '',
      title: draft.title.trim(),
      kind: draft.kind ?? 'tool',
      status: draft.status ?? 'have',
      icon: draft.icon,
      quantity: draft.quantity,
      unit: draft.unit,
      unitCost: draft.unitCost,
      currency: draft.currency ?? 'GBP',
      supplier: draft.supplier,
      url: draft.url,
      location: draft.location,
      purchasedOn: draft.purchasedOn,
      renewsOn: draft.renewsOn,
      linkedHabitIds: draft.linkedHabitIds ?? [],
      note: draft.note,
      archived: false,
      sortOrder: draft.sortOrder ?? this._items().length + 1
    };

    this._items.update(items => [...items, item]);
    this.persist();
    this.createOnServer(item);
    return item;
  }

  update(id: string, patch: Partial<ToolkitItem>): void {
    let updated: ToolkitItem | undefined;

    this._items.update(items =>
      items.map(item => {
        if (item.id !== id) return item;
        updated = { ...item, ...patch, id: item.id };
        return updated;
      })
    );

    this.persist();
    if (updated) this.updateOnServer(updated);
  }

  setStatus(id: string, status: ToolkitStatus): void {
    this.update(id, { status });
  }

  /**
   * Archive rather than delete by default.
   *
   * A sold drill is still the answer to "what did I have when I priced that
   * job", so the row is kept and hidden. `remove()` is there for a typo.
   */
  archive(id: string): void {
    this.update(id, { archived: true });
  }

  restore(id: string): void {
    this.update(id, { archived: false });
  }

  remove(id: string): void {
    const item = this.find(id);
    this._items.update(items => items.filter(i => i.id !== id));
    this.persist();

    if (item && this.table && !item.id.startsWith('local:')) {
      this.baserow.deleteRow(this.table, Number(item.id)).subscribe({
        error: err => console.warn('ToolkitService: delete failed, cache updated.', err)
      });
    }
  }

  // --- persistence ----------------------------------------------------------

  private loadCache(): void {
    // UserStorage namespaces per account and handles JSON, so a signed-out
    // browser and two accounts on one machine cannot see each other's kit.
    const cached = this.storage.read<ToolkitItem[]>(STORE_KEY, []);
    this._items.set(Array.isArray(cached) ? cached.map(revive) : []);
  }

  private persist(): void {
    this.storage.write(STORE_KEY, this._items());
  }

  private loadFromServer(): void {
    const userId = this.userId();
    if (!this.table || !userId) {
      this.warnOnce();
      return;
    }

    this.baserow
      .listAllRows<ToolkitItemRow>(this.table, {
        filters: [{ field: 'user_id', op: 'equal', value: userId }]
      })
      .subscribe({
        next: rows => {
          const server = (rows ?? []).map(toToolkitItem);

          // Keep anything created offline that the server has not seen, or a
          // sync mid-add silently discards it.
          const pending = this._items().filter(item => item.id.startsWith('local:'));
          this._items.set([...server, ...pending]);
          this.persist();
          this.flushPending();
        },
        error: err => {
          console.warn('ToolkitService: could not load the toolkit, using cache.', err);
        }
      });
  }

  /** Push anything still carrying a local id, once a real table exists. */
  private flushPending(): void {
    if (!this.table) return;
    for (const item of this._items().filter(i => i.id.startsWith('local:'))) {
      this.createOnServer(item);
    }
  }

  private createOnServer(item: ToolkitItem): void {
    const userId = this.userId();
    if (!this.table || !userId) {
      this.warnOnce();
      return;
    }

    this.baserow
      .createRow<ToolkitItemRow>(this.table, fromToolkitItem(item, userId))
      .subscribe({
        next: row => {
          if (!row?.id) return;
          // Swap the local id for the real one, matched on the local id rather
          // than by index — an edit may have reordered the list meanwhile.
          this._items.update(items =>
            items.map(i => (i.id === item.id ? { ...i, id: String(row.id) } : i))
          );
          this.persist();
        },
        error: err => console.warn('ToolkitService: create failed, kept locally.', err)
      });
  }

  private updateOnServer(item: ToolkitItem): void {
    const userId = this.userId();
    if (!this.table || !userId || item.id.startsWith('local:')) return;

    this.baserow
      .updateRow<ToolkitItemRow>(this.table, Number(item.id), fromToolkitItem(item, userId))
      .subscribe({
        error: err => console.warn('ToolkitService: update failed, cache retained.', err)
      });
  }

  private warnOnce(): void {
    if (this.warned) return;
    this.warned = true;
    console.warn(
      'ToolkitService: baserow.tables.toolkitItems is 0 — your kit stays on this browser. ' +
        'Create it with: node scripts/create-baserow-table.mjs 42-toolkit-items.json --apply'
    );
  }

  /**
   * ResettableRegistry calls this when the account changes.
   *
   * Re-reads the cache rather than only clearing it: UserStorage is namespaced
   * per account, so this is what loads the NEW user's kit rather than leaving
   * the page blank until the server responds.
   */
  reload(): void {
    this.loadCache();
    this.loadFromServer();
  }

  refresh(): void {
    this.loadFromServer();
  }
}

/** JSON.parse gives strings where Dates belong. */
function revive(raw: ToolkitItem): ToolkitItem {
  return {
    ...raw,
    linkedHabitIds: raw.linkedHabitIds ?? [],
    archived: !!raw.archived,
    purchasedOn: raw.purchasedOn ? new Date(raw.purchasedOn) : undefined,
    renewsOn: raw.renewsOn ? new Date(raw.renewsOn) : undefined
  };
}
