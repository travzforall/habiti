import { Injectable, inject, signal } from '@angular/core';
import { UserStorage } from '@habiti/storage';
import { SyncBus } from '@habiti/sync';
import { AuthService } from './auth.service';
import { BaserowService } from './baserow.service';
import { ResettableRegistry } from './resettable.registry';
import { ChecklistItem } from '../models/project.model';
import { ChecklistRow, fromChecklistItem, toChecklistItem } from '../models/attachment-row.models';

/**
 * The steps inside a task.
 *
 * Rows, not a JSON blob on the task, and that is the whole reason this service
 * exists separately: items get ticked one at a time, often from a second
 * device, and a blob makes that last-write-wins — two phones ticking two
 * different steps would lose one of them, silently. Independent rows cannot
 * collide that way.
 *
 * While `tables.taskChecklistItems` is 0 the table does not exist yet and this
 * stays local-only, warning once, in the manner of SkillsService.
 */
@Injectable({ providedIn: 'root' })
export class ChecklistService {
  private readonly STORAGE_KEY = 'habiti_task_checklists';
  private storage = inject(UserStorage);
  private auth = inject(AuthService);
  private baserow = inject(BaserowService);
  private syncBus = inject(SyncBus);
  private registry = inject(ResettableRegistry);

  private _items = signal<ChecklistItem[]>([]);
  public readonly items = this._items.asReadonly();

  private warned = false;

  private get tableId(): number {
    return this.baserow.tables?.taskChecklistItems ?? 0;
  }

  private userId(): string | null {
    const id = this.auth.currentUserValue?.id;
    return id !== undefined && id !== null ? String(id) : null;
  }

  constructor() {
    this.loadCache();
    this.registry.register(this, ['tasks']);
  }

  forTask(taskId: string): ChecklistItem[] {
    return this._items()
      .filter(item => item.taskId === taskId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  add(taskId: string, title: string): ChecklistItem | null {
    const trimmed = title.trim();
    if (!trimmed) return null;

    const existing = this.forTask(taskId);
    const item: ChecklistItem = {
      id: this.generateId(),
      taskId,
      title: trimmed,
      completed: false,
      sortOrder: existing.length > 0 ? existing[existing.length - 1].sortOrder + 1 : 1
    };

    this._items.update(list => [...list, item]);
    this.saveCache();
    this.persist(item);
    return item;
  }

  toggle(itemId: string): void {
    this._items.update(list =>
      list.map(item =>
        item.id === itemId
          ? {
              ...item,
              completed: !item.completed,
              completedAt: !item.completed ? new Date() : undefined
            }
          : item
      )
    );
    this.saveCache();

    const updated = this._items().find(item => item.id === itemId);
    if (updated) this.persist(updated);
  }

  rename(itemId: string, title: string): void {
    const trimmed = title.trim();
    if (!trimmed) return;

    this._items.update(list =>
      list.map(item => (item.id === itemId ? { ...item, title: trimmed } : item))
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
      next: () => this.syncBus.touched('tasks'),
      error: err => console.warn('ChecklistService: item not deleted.', err)
    });
  }

  /** Removes every item belonging to a task — used when the task itself goes. */
  removeForTask(taskId: string): void {
    for (const item of this.forTask(taskId)) this.remove(item.id);
  }

  loadForTask(taskId: string): void {
    const userId = this.userId();
    if (!taskId || !userId) return;
    if (!this.tableId) {
      this.warnOnce();
      return;
    }

    this.baserow
      .listAllRows<ChecklistRow>(this.tableId, {
        filters: [
          { field: 'user_id', op: 'equal', value: userId },
          { field: 'task_id', op: 'equal', value: taskId }
        ]
      })
      .subscribe({
        next: rows => {
          const fetched = (rows ?? []).map(toChecklistItem);
          this._items.update(list => [
            ...list.filter(item => item.taskId !== taskId),
            ...fetched
          ]);
          this.saveCache();
        },
        error: err => console.warn('ChecklistService: could not load items.', err)
      });
  }

  private persist(item: ChecklistItem): void {
    const userId = this.userId();
    if (!userId) return;
    if (!this.tableId) {
      this.warnOnce();
      return;
    }

    const data = fromChecklistItem(item, userId);
    const rowId = Number(item.id);

    const request = Number.isFinite(rowId)
      ? this.baserow.updateRow<ChecklistRow>(this.tableId, rowId, data)
      : this.baserow.createRow<ChecklistRow>(this.tableId, data);

    request.subscribe({
      next: row => {
        if (row && !Number.isFinite(rowId)) {
          this._items.update(list =>
            list.map(i => (i.id === item.id ? { ...i, id: String(row.id) } : i))
          );
          this.saveCache();
        }
        this.syncBus.touched('tasks');
      },
      error: err => console.warn('ChecklistService: item not persisted.', err)
    });
  }

  reload(): void {
    this._items.set([]);
    this.loadCache();
  }

  private warnOnce(): void {
    if (this.warned) return;
    this.warned = true;
    console.warn(
      'ChecklistService: tables.taskChecklistItems is 0 — checklists stay on this browser. ' +
        'Create it with: node scripts/create-baserow-table.mjs 32-task-checklist-items.json --apply'
    );
  }

  private loadCache(): void {
    try {
      const raw = this.storage.readRaw(this.STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ChecklistItem[];
      this._items.set(
        parsed.map(item => ({
          ...item,
          completedAt: item.completedAt ? new Date(item.completedAt) : undefined
        }))
      );
    } catch (error) {
      console.error('ChecklistService: could not read the cache.', error);
      this._items.set([]);
    }
  }

  private saveCache(): void {
    try {
      this.storage.writeRaw(this.STORAGE_KEY, JSON.stringify(this._items()));
    } catch (error) {
      console.error('ChecklistService: could not write the cache.', error);
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
}
