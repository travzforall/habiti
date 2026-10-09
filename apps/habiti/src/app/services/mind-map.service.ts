import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map as mapOperator, tap } from 'rxjs/operators';
import { UserStorage } from '@habiti/storage';
import { AuthService } from './auth.service';
import { BaserowService } from './baserow.service';
import { ResettableRegistry } from './resettable.registry';
import {
  MindMap,
  MindMapNode,
  MindMapNodeKind,
  MindMapNodeRow,
  MindMapRow,
  PERSONAL_BOARD,
  childrenOf,
  cloneSubtree,
  detachSubtree,
  fromMindMap,
  fromMindMapNode,
  nextSide,
  rootOf,
  subtreeOf,
  toMindMap,
  toMindMapNode,
  wouldCycle
} from '../models/mind-map.models';

/**
 * Mind maps, their nodes, and the undo stack that makes them editable.
 *
 * ── HOW EDITING AND SAVING FIT TOGETHER ───────────────────────────────────
 *
 * Every mutation goes through `mutate()`, which does three things in order:
 * pushes the CURRENT node list onto the undo stack, applies the change, and
 * schedules a save. That means undo is a snapshot restore rather than a pile of
 * hand-written inverse operations — thirty of them, each with its own way to be
 * subtly wrong. A map is a few hundred small objects; snapshotting one is
 * cheaper than the bugs.
 *
 * Saving is a DIFF against what the server last confirmed, debounced. Undo
 * therefore needs no special handling at all: it changes the node list, the
 * diff notices, and the right rows are created, updated or deleted.
 *
 * ── LAZY ──────────────────────────────────────────────────────────────────
 *
 * This service is not in sync-refreshers.providers.ts; it registers itself with
 * ResettableRegistry instead, so the editor is never in the initial bundle.
 * See resettable.registry.ts for why that matters.
 */

const SAVE_DEBOUNCE_MS = 800;
const UNDO_DEPTH = 50;

@Injectable({ providedIn: 'root' })
export class MindMapService {
  private readonly MAPS_KEY = 'habiti_mind_maps';
  private readonly NODES_KEY = 'habiti_mind_map_nodes';

  private storage = inject(UserStorage);
  private auth = inject(AuthService);
  private baserow = inject(BaserowService);
  private registry = inject(ResettableRegistry);

  private _maps = signal<MindMap[]>([]);
  private _nodes = signal<MindMapNode[]>([]);

  readonly maps = this._maps.asReadonly();
  readonly nodes = this._nodes.asReadonly();

  private undoStack: MindMapNode[][] = [];
  private redoStack: MindMapNode[][] = [];
  readonly canUndo = signal(false);
  readonly canRedo = signal(false);

  /** What the server is believed to hold, so a save can diff against it. */
  private persisted = new Map<string, string>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private dirtyMaps = new Set<string>();
  private warned = false;

  private get mapsTable(): number {
    return this.baserow.tables?.mindMaps ?? 0;
  }

  private get nodesTable(): number {
    return this.baserow.tables?.mindMapNodes ?? 0;
  }

  private userId(): string | null {
    const id = this.auth.currentUserValue?.id;
    return id !== undefined && id !== null ? String(id) : null;
  }

  constructor() {
    this.loadCache();
    // Reset only: a map changes because this user changed it, so there is
    // nothing for a background refresh to discover.
    this.registry.register(this, []);
  }

  // --- reads ---------------------------------------------------------------

  mapsForBoard(board: string): MindMap[] {
    const key = board || PERSONAL_BOARD;
    return this._maps()
      .filter(map => map.board === key && !map.archived)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  getMap(mapId: string): MindMap | undefined {
    return this._maps().find(map => map.id === mapId);
  }

  nodesForMap(mapId: string): MindMapNode[] {
    return this._nodes().filter(node => node.mapId === mapId);
  }

  getNode(nodeId: string): MindMapNode | undefined {
    return this._nodes().find(node => node.id === nodeId);
  }

  /** Every map that has a node pointing at this task — the backlink on a task page. */
  mapsForTask(taskId: string): MindMap[] {
    const mapIds = new Set(
      this._nodes()
        .filter(node => node.taskId === taskId)
        .map(node => node.mapId)
    );
    return this._maps().filter(map => mapIds.has(map.id));
  }

  readonly totalNodes = computed(() => this._nodes().length);

  // --- maps ----------------------------------------------------------------

  createMap(board: string, title: string): MindMap {
    const map: MindMap = {
      id: this.generateId(),
      board: board || PERSONAL_BOARD,
      title: title.trim() || 'New map',
      theme: 'default',
      nodeCount: 1,
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // A map is never empty: it opens with its central topic, named after itself.
    const root: MindMapNode = {
      id: this.generateId(),
      mapId: map.id,
      text: map.title,
      kind: 'idea',
      side: 'auto',
      sortOrder: 0,
      collapsed: false
    };

    this._maps.update(maps => [...maps, map]);
    this._nodes.update(nodes => [...nodes, root]);
    this.saveCache();
    this.persistMap(map);
    this.scheduleSave(map.id);
    return map;
  }

  updateMap(mapId: string, changes: Partial<MindMap>): void {
    this._maps.update(maps =>
      maps.map(map => (map.id === mapId ? { ...map, ...changes, updatedAt: new Date() } : map))
    );
    this.saveCache();

    const updated = this.getMap(mapId);
    if (updated) this.persistMap(updated);
  }

  deleteMap(mapId: string): void {
    const nodeIds = this.nodesForMap(mapId).map(node => node.id);

    this._maps.update(maps => maps.filter(map => map.id !== mapId));
    this._nodes.update(nodes => nodes.filter(node => node.mapId !== mapId));
    this.saveCache();

    for (const nodeId of nodeIds) this.removeRow(this.nodesTable, nodeId);
    this.removeRow(this.mapsTable, mapId);
  }

  // --- nodes ---------------------------------------------------------------

  /** A child of `parentId`, added last. Returns it so the caller can select it. */
  addChild(parentId: string, text = ''): MindMapNode | null {
    const parent = this.getNode(parentId);
    if (!parent) return null;

    const nodes = this.nodesForMap(parent.mapId);
    const siblings = childrenOf(nodes, parentId);
    const root = rootOf(nodes);

    const child: MindMapNode = {
      id: this.generateId(),
      mapId: parent.mapId,
      parentId,
      text,
      kind: 'idea',
      // Only a top-level branch chooses a side; everything deeper inherits.
      side: root && parent.id === root.id ? nextSide(nodes, root.id) : 'auto',
      sortOrder: siblings.length > 0 ? siblings[siblings.length - 1].sortOrder + 1 : 1,
      collapsed: false
    };

    this.mutate(parent.mapId, nodes => [
      // Adding to a collapsed node would put the new node somewhere invisible.
      ...nodes.map(node => (node.id === parentId ? { ...node, collapsed: false } : node)),
      child
    ]);

    return child;
  }

  /** A sibling directly after `nodeId`. The root has no siblings, so it gets a child. */
  addSibling(nodeId: string, text = ''): MindMapNode | null {
    const node = this.getNode(nodeId);
    if (!node) return null;
    if (!node.parentId) return this.addChild(nodeId, text);

    const nodes = this.nodesForMap(node.mapId);
    const sibling: MindMapNode = {
      id: this.generateId(),
      mapId: node.mapId,
      parentId: node.parentId,
      text,
      kind: 'idea',
      side: node.side,
      sortOrder: node.sortOrder + 1,
      collapsed: false
    };

    this.mutate(node.mapId, current => [
      // Everything after the anchor shuffles down to make room.
      ...current.map(other =>
        other.parentId === node.parentId && other.sortOrder > node.sortOrder
          ? { ...other, sortOrder: other.sortOrder + 1 }
          : other
      ),
      sibling
    ]);

    return sibling;
  }

  updateNode(nodeId: string, changes: Partial<MindMapNode>): void {
    const node = this.getNode(nodeId);
    if (!node) return;

    this.mutate(node.mapId, nodes =>
      nodes.map(other => (other.id === nodeId ? { ...other, ...changes } : other))
    );
  }

  /** Deletes a node and everything under it. The root cannot be deleted. */
  deleteNode(nodeId: string): void {
    const node = this.getNode(nodeId);
    if (!node || !node.parentId) return;

    const doomed = new Set(subtreeOf(this.nodesForMap(node.mapId), nodeId).map(n => n.id));
    this.mutate(node.mapId, nodes => nodes.filter(other => !doomed.has(other.id)));
  }

  toggleCollapse(nodeId: string): void {
    const node = this.getNode(nodeId);
    if (!node) return;
    this.updateNode(nodeId, { collapsed: !node.collapsed });
  }

  /**
   * Moves a node under a new parent.
   *
   * Refuses a cycle rather than trying to repair one: dropping a node onto its
   * own descendant has no sensible meaning, and a tree with a ring in it makes
   * the layout recurse until the stack gives out.
   */
  reparent(nodeId: string, newParentId: string): boolean {
    const node = this.getNode(nodeId);
    const parent = this.getNode(newParentId);
    if (!node || !parent || node.mapId !== parent.mapId) return false;
    if (!node.parentId) return false; // the root stays put
    if (wouldCycle(this.nodesForMap(node.mapId), nodeId, newParentId)) return false;

    const nodes = this.nodesForMap(node.mapId);
    const root = rootOf(nodes);
    const siblings = childrenOf(nodes, newParentId);

    this.mutate(node.mapId, current =>
      current.map(other =>
        other.id === nodeId
          ? {
              ...other,
              parentId: newParentId,
              side: root && newParentId === root.id ? nextSide(nodes, root.id) : 'auto',
              sortOrder: siblings.length > 0 ? siblings[siblings.length - 1].sortOrder + 1 : 1
            }
          : other.id === newParentId
            ? { ...other, collapsed: false }
            : other
      )
    );
    return true;
  }

  /** Moves a node up or down among its siblings. */
  reorder(nodeId: string, direction: -1 | 1): void {
    const node = this.getNode(nodeId);
    if (!node?.parentId) return;

    const siblings = childrenOf(this.nodesForMap(node.mapId), node.parentId);
    const index = siblings.findIndex(sibling => sibling.id === nodeId);
    const swapWith = siblings[index + direction];
    if (!swapWith) return;

    this.mutate(node.mapId, nodes =>
      nodes.map(other => {
        if (other.id === node.id) return { ...other, sortOrder: swapWith.sortOrder };
        if (other.id === swapWith.id) return { ...other, sortOrder: node.sortOrder };
        return other;
      })
    );
  }

  // --- clipboard -----------------------------------------------------------

  /**
   * A detached branch, waiting to be pasted.
   *
   * The app's own clipboard, not the system one. Putting a subtree on the
   * system clipboard means serialising it to text, and pasting it back means
   * parsing whatever the user happened to have copied last — for a within-app
   * move that is a lot of failure modes to buy nothing. Text pasted from
   * outside is a separate feature, not this one.
   */
  private readonly _clipboard = signal<MindMapNode[] | null>(null);
  readonly canPaste = computed(() => (this._clipboard()?.length ?? 0) > 0);

  /** What is on the clipboard, for a menu that wants to name it. */
  clipboardLabel(): string | null {
    const branch = this._clipboard();
    return branch?.[0]?.text || null;
  }

  copyBranch(nodeId: string): boolean {
    const node = this.getNode(nodeId);
    if (!node) return false;
    this._clipboard.set(detachSubtree(this.nodesForMap(node.mapId), nodeId));
    return true;
  }

  /** Copy, then remove. The root cannot be cut — a map needs one. */
  cutBranch(nodeId: string): boolean {
    const node = this.getNode(nodeId);
    if (!node?.parentId) return false;
    if (!this.copyBranch(nodeId)) return false;
    this.deleteNode(nodeId);
    return true;
  }

  /** Pastes the clipboard under a node, as a copy with fresh ids. */
  pasteInto(parentId: string): MindMapNode | null {
    const branch = this._clipboard();
    const parent = this.getNode(parentId);
    if (!branch?.length || !parent) return null;

    const nodes = this.nodesForMap(parent.mapId);
    const siblings = childrenOf(nodes, parentId);
    const root = rootOf(nodes);

    const copy = cloneSubtree(branch, parent.mapId, parentId, () => this.generateId());
    const top = copy[0];
    top.sortOrder = siblings.length > 0 ? siblings[siblings.length - 1].sortOrder + 1 : 1;
    top.side = root && parentId === root.id ? nextSide(nodes, root.id) : 'auto';

    this.mutate(parent.mapId, current => [
      ...current.map(other => (other.id === parentId ? { ...other, collapsed: false } : other)),
      ...copy
    ]);

    return top;
  }

  // --- undo ----------------------------------------------------------------

  /**
   * The single funnel every change goes through.
   *
   * Snapshot, apply, schedule. Nothing else in this service touches `_nodes`
   * for a map's own content, which is what keeps undo honest.
   */
  private mutate(mapId: string, change: (nodes: MindMapNode[]) => MindMapNode[]): void {
    this.undoStack.push(this.nodesForMap(mapId).map(node => ({ ...node })));
    if (this.undoStack.length > UNDO_DEPTH) this.undoStack.shift();
    this.redoStack = [];

    this.applySnapshot(mapId, change(this.nodesForMap(mapId)));
    this.refreshUndoFlags();
  }

  undo(mapId: string): void {
    const previous = this.undoStack.pop();
    if (!previous) return;

    this.redoStack.push(this.nodesForMap(mapId).map(node => ({ ...node })));
    this.applySnapshot(mapId, previous);
    this.refreshUndoFlags();
  }

  redo(mapId: string): void {
    const next = this.redoStack.pop();
    if (!next) return;

    this.undoStack.push(this.nodesForMap(mapId).map(node => ({ ...node })));
    this.applySnapshot(mapId, next);
    this.refreshUndoFlags();
  }

  /** Editing a different map must not offer undo steps from the last one. */
  clearHistory(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.refreshUndoFlags();
  }

  private applySnapshot(mapId: string, snapshot: MindMapNode[]): void {
    this._nodes.update(nodes => [...nodes.filter(node => node.mapId !== mapId), ...snapshot]);
    this.saveCache();
    this.updateMap(mapId, { nodeCount: snapshot.length });
    this.scheduleSave(mapId);
  }

  private refreshUndoFlags(): void {
    this.canUndo.set(this.undoStack.length > 0);
    this.canRedo.set(this.redoStack.length > 0);
  }

  // --- persistence ---------------------------------------------------------

  loadMaps(board?: string): void {
    const userId = this.userId();
    if (!userId) return;
    if (!this.mapsTable) {
      this.warnOnce();
      return;
    }

    const filters = [{ field: 'user_id', op: 'equal' as const, value: userId }];
    if (board) filters.push({ field: 'board', op: 'equal' as const, value: board });

    this.baserow.listAllRows<MindMapRow>(this.mapsTable, { filters }).subscribe({
      next: rows => {
        const fetched = (rows ?? []).map(toMindMap);
        const ids = new Set(fetched.map(map => map.id));
        this._maps.update(maps => [...maps.filter(map => !ids.has(map.id)), ...fetched]);
        this.saveCache();
      },
      error: err => console.warn('MindMapService: could not load maps.', err)
    });
  }

  /** One map's nodes, for the editor. Cold-cache deep links go through here. */
  loadMap(mapId: string): Observable<MindMap | null> {
    const userId = this.userId();
    if (!this.mapsTable || !this.nodesTable) {
      this.warnOnce();
      return of(this.getMap(mapId) ?? null);
    }

    const rowId = Number(mapId);
    if (!Number.isFinite(rowId)) return of(this.getMap(mapId) ?? null);

    this.baserow
      .listAllRows<MindMapNodeRow>(this.nodesTable, {
        filters: [
          { field: 'user_id', op: 'equal', value: userId ?? '' },
          { field: 'map_id', op: 'equal', value: mapId }
        ]
      })
      .subscribe({
        next: rows => {
          const fetched = (rows ?? []).map(toMindMapNode);
          this._nodes.update(nodes => [
            ...nodes.filter(node => node.mapId !== mapId),
            ...fetched
          ]);
          for (const node of fetched) this.persisted.set(node.id, this.serialise(node));
          this.saveCache();
        },
        error: err => console.warn('MindMapService: could not load nodes.', err)
      });

    return this.baserow.getRow<MindMapRow>(this.mapsTable, rowId).pipe(
      mapOperator(row => {
        // Row ids in URLs are guessable and getRow cannot filter by user.
        if (!row) return null;
        if (userId && String(row.user_id ?? '') !== userId) return null;
        return toMindMap(row);
      }),
      tap(loaded => {
        if (!loaded) return;
        this._maps.update(maps => [...maps.filter(map => map.id !== loaded.id), loaded]);
        this.saveCache();
      })
    );
  }

  private scheduleSave(mapId: string): void {
    this.dirtyMaps.add(mapId);
    if (this.saveTimer) clearTimeout(this.saveTimer);
    // Typing produces a mutation per keystroke-batch; one save per pause.
    this.saveTimer = setTimeout(() => this.flush(), SAVE_DEBOUNCE_MS);
  }

  /** Writes every pending change. Called by the debounce and on leaving the editor. */
  flush(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }

    const userId = this.userId();
    const maps = [...this.dirtyMaps];
    this.dirtyMaps.clear();
    if (!userId || !this.nodesTable) {
      if (maps.length) this.warnOnce();
      return;
    }

    for (const mapId of maps) this.syncNodes(mapId, userId);
  }

  /**
   * Diffs a map's nodes against what the server last confirmed.
   *
   * Creates go first and one at a time, in parent-before-child order: a child's
   * `parent_id` has to be the parent's REAL row id, which only exists once the
   * parent has been written. Updates are batched. Deletes are whatever the
   * server still has and the map no longer does.
   */
  private syncNodes(mapId: string, userId: string): void {
    const nodes = this.nodesForMap(mapId);
    const live = new Set(nodes.map(node => node.id));

    const ordered = this.parentsFirst(nodes);
    for (const node of ordered) {
      const serialised = this.serialise(node);
      const known = this.persisted.get(node.id);
      if (known === serialised) continue;

      if (Number.isFinite(Number(node.id))) {
        this.baserow
          .updateRow<MindMapNodeRow>(this.nodesTable, Number(node.id), fromMindMapNode(node, userId))
          .subscribe({
            next: () => this.persisted.set(node.id, serialised),
            error: err => console.warn('MindMapService: node not saved.', err)
          });
      } else {
        this.createNodeRow(node, userId);
      }
    }

    for (const [id] of this.persisted) {
      if (!live.has(id) && this.belongsToMap(id, mapId)) {
        this.persisted.delete(id);
        this.removeRow(this.nodesTable, id);
      }
    }
  }

  private createNodeRow(node: MindMapNode, userId: string): void {
    this.baserow
      .createRow<MindMapNodeRow>(this.nodesTable, fromMindMapNode(node, userId))
      .subscribe({
        next: row => {
          if (!row) return;
          const serverId = String(row.id);
          // Adopt the id, and re-point every child that referenced the old one.
          this._nodes.update(nodes =>
            nodes.map(other => {
              if (other.id === node.id) return { ...other, id: serverId };
              if (other.parentId === node.id) return { ...other, parentId: serverId };
              return other;
            })
          );
          this.persisted.set(serverId, this.serialise({ ...node, id: serverId }));
          this.saveCache();
        },
        error: err => console.warn('MindMapService: node not created.', err)
      });
  }

  /** Parents before children, so a create always has a real parent id to point at. */
  private parentsFirst(nodes: MindMapNode[]): MindMapNode[] {
    const byParent = new Map<string, MindMapNode[]>();
    for (const node of nodes) {
      const key = node.parentId ?? '';
      byParent.set(key, [...(byParent.get(key) ?? []), node]);
    }

    const ordered: MindMapNode[] = [];
    const walk = (parentId: string) => {
      for (const node of byParent.get(parentId) ?? []) {
        ordered.push(node);
        walk(node.id);
      }
    };
    walk('');
    // Anything unreachable (a broken tree) still gets saved rather than dropped.
    for (const node of nodes) if (!ordered.includes(node)) ordered.push(node);
    return ordered;
  }

  private belongsToMap(nodeId: string, mapId: string): boolean {
    // A deleted node is gone from the signal, so the only clue is the snapshot
    // this map wrote. Node ids are unique across maps, so it is enough.
    return !this._nodes().some(node => node.id === nodeId && node.mapId !== mapId);
  }

  private serialise(node: MindMapNode): string {
    return JSON.stringify(fromMindMapNode(node, this.userId() ?? ''));
  }

  private persistMap(map: MindMap): void {
    const userId = this.userId();
    if (!userId) return;
    if (!this.mapsTable) {
      this.warnOnce();
      return;
    }

    const data = fromMindMap(map, userId);
    const rowId = Number(map.id);
    const request = Number.isFinite(rowId)
      ? this.baserow.updateRow<MindMapRow>(this.mapsTable, rowId, data)
      : this.baserow.createRow<MindMapRow>(this.mapsTable, data);

    request.subscribe({
      next: row => {
        if (row && !Number.isFinite(rowId)) {
          const serverId = String(row.id);
          this._maps.update(maps =>
            maps.map(other => (other.id === map.id ? { ...other, id: serverId } : other))
          );
          this._nodes.update(nodes =>
            nodes.map(node => (node.mapId === map.id ? { ...node, mapId: serverId } : node))
          );
          this.saveCache();
        }
      },
      error: err => console.warn('MindMapService: map not saved.', err)
    });
  }

  private removeRow(tableId: number, rowId: string): void {
    const id = Number(rowId);
    if (!tableId || !Number.isFinite(id)) return;
    this.baserow.deleteRow(tableId, id).subscribe({
      error: err => console.warn('MindMapService: row not deleted.', err)
    });
  }

  reload(): void {
    this._maps.set([]);
    this._nodes.set([]);
    this.persisted.clear();
    this.clearHistory();
    this.loadCache();
    this.loadMaps();
  }

  private warnOnce(): void {
    if (this.warned) return;
    this.warned = true;
    console.warn(
      'MindMapService: tables.mindMaps / mindMapNodes are 0 — maps stay on this browser. ' +
        'Create them with: node scripts/create-baserow-table.mjs 34-mind-maps.json --apply ' +
        '(and 35-mind-map-nodes.json)'
    );
  }

  private loadCache(): void {
    try {
      const maps = this.storage.readRaw(this.MAPS_KEY);
      if (maps) {
        this._maps.set(
          (JSON.parse(maps) as MindMap[]).map(map => ({
            ...map,
            createdAt: new Date(map.createdAt),
            updatedAt: new Date(map.updatedAt)
          }))
        );
      }
      const nodes = this.storage.readRaw(this.NODES_KEY);
      if (nodes) this._nodes.set(JSON.parse(nodes) as MindMapNode[]);
    } catch (error) {
      console.error('MindMapService: could not read the cache.', error);
      this._maps.set([]);
      this._nodes.set([]);
    }
  }

  private saveCache(): void {
    try {
      this.storage.writeRaw(this.MAPS_KEY, JSON.stringify(this._maps()));
      this.storage.writeRaw(this.NODES_KEY, JSON.stringify(this._nodes()));
    } catch (error) {
      console.error('MindMapService: could not write the cache.', error);
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
}

export type { MindMapNodeKind };
