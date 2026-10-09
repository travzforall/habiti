import { Injectable, inject, signal } from '@angular/core';
import { UserStorage } from '@habiti/storage';
import { SyncBus } from '@habiti/sync';
import { AuthService } from './auth.service';
import { BaserowService } from './baserow.service';
import { ResettableRegistry } from './resettable.registry';
import {
  InspirationItem,
  InspirationKind,
  InspirationRow,
  PERSONAL_BOARD,
  fromInspirationItem,
  toInspirationItem
} from '../models/inspiration.models';
/**
 * TYPE-ONLY. Recognising a URL happens in the board component, which is lazy;
 * a value import from this service — which the eager sync refreshers reach —
 * would pull the parser into the initial bundle. See config/media-links.ts.
 */
import type { RecognisedMedia } from '../config/media-links';

/**
 * The things a user keeps because they make them want to do the work.
 *
 * One store, many boards: `personal` is the standalone one at /inspiration, and
 * a `user_projects` row id is a project's own. Same shape as `project_id` on a
 * task — a board is a string, and 'personal' is a real value rather than an
 * absence.
 *
 * NOTHING IS RE-HOSTED. An item is a pointer at someone else's video or
 * picture, so a board costs no storage and no quota — and if the far end
 * deletes it, the card breaks. That is the trade, and the UI does not pretend
 * otherwise. Uploading a picture of your own is what attachments are for.
 *
 * While `tables.inspirationItems` is 0 this stays in local storage and warns
 * once, in the manner of SkillsService.
 */
@Injectable({ providedIn: 'root' })
export class InspirationService {
  private readonly STORAGE_KEY = 'habiti_inspiration';
  private storage = inject(UserStorage);
  private auth = inject(AuthService);
  private baserow = inject(BaserowService);
  private syncBus = inject(SyncBus);
  private registry = inject(ResettableRegistry);

  private _items = signal<InspirationItem[]>([]);
  public readonly items = this._items.asReadonly();

  private warned = false;
  private loadedBoards = new Set<string>();

  private get tableId(): number {
    return this.baserow.tables?.inspirationItems ?? 0;
  }

  private userId(): string | null {
    const id = this.auth.currentUserValue?.id;
    return id !== undefined && id !== null ? String(id) : null;
  }

  constructor() {
    this.loadCache();
    this.registry.register(this, ['inspiration']);
  }

  // --- reads ---------------------------------------------------------------

  forBoard(board: string): InspirationItem[] {
    const key = board || PERSONAL_BOARD;
    return this._items()
      .filter(item => item.board === key)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime());
  }

  // --- writes --------------------------------------------------------------

  /**
   * Saves something already recognised by `recogniseMedia`.
   *
   * The caller does the recognising: it is the one that has to show a message
   * when a paste is not a usable address, and it keeps the parser out of the
   * eager bundle.
   */
  addLink(
    board: string,
    media: RecognisedMedia,
    fallbackTitle: string,
    title?: string,
    note?: string
  ): InspirationItem {
    return this.append({
      board: board || PERSONAL_BOARD,
      kind: media.kind,
      title: title?.trim() || fallbackTitle,
      url: media.url,
      thumbnailUrl: media.thumbnailUrl,
      provider: media.provider,
      sourceId: media.sourceId,
      note: note?.trim() || undefined
    });
  }

  /** A thought with no link behind it. Still inspiration. */
  addNote(board: string, text: string): InspirationItem | null {
    const trimmed = text.trim();
    if (!trimmed) return null;

    return this.append({
      board: board || PERSONAL_BOARD,
      kind: 'note',
      // The first line is the title, so a long note still has a short heading.
      title: trimmed.split('\n')[0].slice(0, 120),
      note: trimmed
    });
  }

  /** Points a board at a picture already uploaded through attachments. */
  addUploadedImage(board: string, url: string, filename: string): InspirationItem {
    return this.append({
      board: board || PERSONAL_BOARD,
      kind: 'image',
      title: filename,
      url,
      thumbnailUrl: url,
      provider: 'image'
    })!;
  }

  update(itemId: string, changes: Partial<InspirationItem>): void {
    this._items.update(list =>
      list.map(item => (item.id === itemId ? { ...item, ...changes } : item))
    );
    this.saveCache();

    const updated = this._items().find(item => item.id === itemId);
    if (updated) this.persist(updated);
  }

  remove(itemId: string): void {
    this._items.update(list => list.filter(item => item.id !== itemId));
    this.saveCache();

    const rowId = Number(itemId);
    if (!this.tableId || !Number.isFinite(rowId)) return;
    this.baserow.deleteRow(this.tableId, rowId).subscribe({
      next: () => this.syncBus.touched('inspiration'),
      error: err => console.warn('InspirationService: item not deleted.', err)
    });
  }

  /** Moves an item one place up or down its board. */
  move(itemId: string, direction: -1 | 1): void {
    const item = this._items().find(i => i.id === itemId);
    if (!item) return;

    const board = this.forBoard(item.board);
    const index = board.findIndex(i => i.id === itemId);
    const swapWith = board[index + direction];
    if (!swapWith) return;

    const a = item.sortOrder;
    const b = swapWith.sortOrder;
    // Equal orders (everything defaulted to 0) would swap to no effect.
    const [nextA, nextB] = a === b ? [index + direction, index] : [b, a];

    this.update(item.id, { sortOrder: nextA });
    this.update(swapWith.id, { sortOrder: nextB });
  }

  private append(
    input: Omit<InspirationItem, 'id' | 'tags' | 'sortOrder' | 'createdAt'> &
      Partial<Pick<InspirationItem, 'tags'>>
  ): InspirationItem {
    const existing = this.forBoard(input.board);
    const item: InspirationItem = {
      id: this.generateId(),
      tags: input.tags ?? [],
      sortOrder: existing.length > 0 ? existing[existing.length - 1].sortOrder + 1 : 1,
      createdAt: new Date(),
      ...input
    };

    this._items.update(list => [...list, item]);
    this.saveCache();
    this.persist(item);
    return item;
  }

  // --- persistence ---------------------------------------------------------

  loadBoard(board: string): void {
    const key = board || PERSONAL_BOARD;
    const userId = this.userId();
    if (!userId) return;
    if (!this.tableId) {
      this.warnOnce();
      return;
    }
    this.loadedBoards.add(key);

    this.baserow
      .listAllRows<InspirationRow>(this.tableId, {
        filters: [
          { field: 'user_id', op: 'equal', value: userId },
          { field: 'board', op: 'equal', value: key }
        ]
      })
      .subscribe({
        next: rows => {
          const fetched = (rows ?? []).map(toInspirationItem);
          this._items.update(list => [...list.filter(item => item.board !== key), ...fetched]);
          this.saveCache();
        },
        error: err => console.warn('InspirationService: could not load the board.', err)
      });
  }

  private persist(item: InspirationItem): void {
    const userId = this.userId();
    if (!userId) return;
    if (!this.tableId) {
      this.warnOnce();
      return;
    }

    const data = fromInspirationItem(item, userId);
    const rowId = Number(item.id);

    const request = Number.isFinite(rowId)
      ? this.baserow.updateRow<InspirationRow>(this.tableId, rowId, data)
      : this.baserow.createRow<InspirationRow>(this.tableId, data);

    request.subscribe({
      next: row => {
        if (row && !Number.isFinite(rowId)) {
          this._items.update(list =>
            list.map(i => (i.id === item.id ? { ...i, id: String(row.id) } : i))
          );
          this.saveCache();
        }
        this.syncBus.touched('inspiration');
      },
      error: err => console.warn('InspirationService: item not persisted.', err)
    });
  }

  reload(): void {
    const boards = [...this.loadedBoards];
    this._items.set([]);
    this.loadedBoards.clear();
    this.loadCache();
    for (const board of boards) this.loadBoard(board);
  }

  private warnOnce(): void {
    if (this.warned) return;
    this.warned = true;
    console.warn(
      'InspirationService: tables.inspirationItems is 0 — boards stay on this browser. ' +
        'Create it with: node scripts/create-baserow-table.mjs 33-inspiration-items.json --apply'
    );
  }

  private loadCache(): void {
    try {
      const raw = this.storage.readRaw(this.STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as InspirationItem[];
      this._items.set(parsed.map(item => ({ ...item, createdAt: new Date(item.createdAt) })));
    } catch (error) {
      console.error('InspirationService: could not read the cache.', error);
      this._items.set([]);
    }
  }

  private saveCache(): void {
    try {
      this.storage.writeRaw(this.STORAGE_KEY, JSON.stringify(this._items()));
    } catch (error) {
      console.error('InspirationService: could not write the cache.', error);
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
}

export type { InspirationKind };
