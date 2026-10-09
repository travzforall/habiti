import { BaserowSelect, parseDateTimeValue, selectValue } from './task-row.models';

/**
 * Mind maps: tables 34 (`mind_maps`) and 35 (`mind_map_nodes`).
 *
 * A map is a TREE — every node has exactly one parent, and exactly one node per
 * map has none. That single constraint is what makes the layout in
 * config/mind-map-layout.ts possible, and the layout is what stops a mind map
 * being a diagram you spend the evening tidying.
 *
 * There are no x/y columns. Position is computed on every render.
 */

export type MindMapNodeKind = 'idea' | 'task' | 'note' | 'link';
export type NodeSide = 'left' | 'right' | 'auto';

/** A map lives on a board: the personal one, or a project. Same string as a task's projectId. */
export const PERSONAL_BOARD = 'personal';

export interface MindMap {
  id: string;
  board: string;
  title: string;
  description?: string;
  theme: string;
  nodeCount: number;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MindMapNode {
  id: string;
  mapId: string;
  /** Absent on the root, and on nothing else. */
  parentId?: string;
  text: string;
  kind: MindMapNodeKind;
  side: NodeSide;
  sortOrder: number;
  collapsed: boolean;
  /** A `user_tasks` row id, when this node IS a task. */
  taskId?: string;
  url?: string;
  note?: string;
  colour?: string;
  icon?: string;
}

// ---------------------------------------------------------------------------
// Tree helpers — pure, and the only place that knows the parent/child rules
// ---------------------------------------------------------------------------

export function rootOf(nodes: readonly MindMapNode[]): MindMapNode | undefined {
  return nodes.find(node => !node.parentId);
}

export function childrenOf(nodes: readonly MindMapNode[], parentId: string): MindMapNode[] {
  return nodes
    .filter(node => node.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** A node and everything beneath it. Used by delete, promote-to-tasks and export. */
export function subtreeOf(nodes: readonly MindMapNode[], nodeId: string): MindMapNode[] {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return [];

  const collected = [node];
  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const child of childrenOf(nodes, current)) {
      collected.push(child);
      queue.push(child.id);
    }
  }
  return collected;
}

/**
 * A subtree lifted out on its own, with the top node made a root.
 *
 * What "copy branch" and "export branch" both need: a set of nodes that is a
 * valid map in its own right, so everything that takes a tree — the layout, the
 * exporters — works on it without a special case.
 */
export function detachSubtree(nodes: readonly MindMapNode[], nodeId: string): MindMapNode[] {
  const subtree = subtreeOf(nodes, nodeId);
  return subtree.map(node =>
    node.id === nodeId ? { ...node, parentId: undefined, side: 'auto' as const } : { ...node }
  );
}

/**
 * Copies a detached subtree, giving every node a new id.
 *
 * Ids are remapped in one pass over a lookup, so a child always points at its
 * copied parent rather than the original — pasting twice must produce two
 * independent branches, not two views of one.
 */
export function cloneSubtree(
  subtree: readonly MindMapNode[],
  mapId: string,
  newParentId: string,
  generateId: () => string
): MindMapNode[] {
  const idMap = new Map<string, string>();
  for (const node of subtree) idMap.set(node.id, generateId());

  return subtree.map(node => ({
    ...node,
    id: idMap.get(node.id)!,
    mapId,
    // The top of the copy hangs off the paste target; everything else keeps
    // its shape.
    parentId: node.parentId ? idMap.get(node.parentId) : newParentId,
    // A pasted branch starts expanded — a collapsed paste looks like nothing
    // happened.
    collapsed: false
  }));
}

/**
 * Would making `nodeId` a child of `newParentId` create a cycle?
 *
 * The check that stops a drag turning the tree into a ring, at which point the
 * layout would recurse until the stack gave out. Refused, never repaired.
 */
export function wouldCycle(
  nodes: readonly MindMapNode[],
  nodeId: string,
  newParentId: string
): boolean {
  if (nodeId === newParentId) return true;

  let cursor: string | undefined = newParentId;
  const seen = new Set<string>();
  while (cursor) {
    // A tree that is already broken must not hang this function either.
    if (seen.has(cursor)) return true;
    seen.add(cursor);
    if (cursor === nodeId) return true;
    cursor = nodes.find(n => n.id === cursor)?.parentId;
  }
  return false;
}

/** Which way a node's branch grows: inherited from its top-level ancestor. */
export function sideOf(nodes: readonly MindMapNode[], node: MindMapNode): 'left' | 'right' {
  let current: MindMapNode | undefined = node;
  const seen = new Set<string>();

  while (current?.parentId && !seen.has(current.id)) {
    seen.add(current.id);
    const parent: MindMapNode | undefined = nodes.find(n => n.id === current!.parentId);
    if (!parent) break;
    // The root's children are the ones that carry a side.
    if (!parent.parentId) return current.side === 'left' ? 'left' : 'right';
    current = parent;
  }

  return 'right';
}

/**
 * The side a new top-level branch should take.
 *
 * Whichever has fewer branches, right winning a tie — so a map grows outwards
 * evenly instead of down one side.
 */
export function nextSide(nodes: readonly MindMapNode[], rootId: string): 'left' | 'right' {
  const top = childrenOf(nodes, rootId);
  const left = top.filter(node => node.side === 'left').length;
  return left < top.length - left ? 'left' : 'right';
}

/** Depth from the root, used for styling and for Markdown export. */
export function depthOf(nodes: readonly MindMapNode[], node: MindMapNode): number {
  let depth = 0;
  let cursor = node.parentId;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    depth++;
    cursor = nodes.find(n => n.id === cursor)?.parentId;
  }
  return depth;
}

// ---------------------------------------------------------------------------
// Baserow mapping
// ---------------------------------------------------------------------------

export interface MindMapRow {
  id: number;
  title?: string;
  user_id?: string;
  board?: string;
  description?: string | null;
  theme?: string | null;
  node_count?: number | string | null;
  archived?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface MindMapNodeRow {
  id: number;
  title?: string;
  user_id?: string;
  map_id?: string;
  parent_id?: string | null;
  side?: string | BaserowSelect;
  sort_order?: number | string | null;
  collapsed?: boolean;
  kind?: string | BaserowSelect;
  task_id?: string | null;
  url?: string | null;
  note?: string | null;
  colour?: string | null;
  icon?: string | null;
  created_at?: string | null;
}

/** `created_at`/`updated_at` are Baserow-owned: read, never written. */
export const MIND_MAP_COLUMNS = [
  'title',
  'user_id',
  'board',
  'description',
  'theme',
  'node_count',
  'archived'
] as const;

export const MIND_MAP_NODE_COLUMNS = [
  'title',
  'user_id',
  'map_id',
  'parent_id',
  'side',
  'sort_order',
  'collapsed',
  'kind',
  'task_id',
  'url',
  'note',
  'colour',
  'icon'
] as const;

const KINDS: readonly MindMapNodeKind[] = ['idea', 'task', 'note', 'link'];
const SIDES: readonly NodeSide[] = ['left', 'right', 'auto'];

export function toMindMap(row: MindMapRow): MindMap {
  return {
    id: String(row.id),
    board: row.board?.trim() || PERSONAL_BOARD,
    title: row.title ?? '',
    description: row.description || undefined,
    theme: row.theme || 'default',
    nodeCount: Number(row.node_count ?? 0) || 0,
    archived: row.archived ?? false,
    createdAt: parseDateTimeValue(row.created_at) ?? new Date(),
    updatedAt: parseDateTimeValue(row.updated_at) ?? new Date()
  };
}

export function fromMindMap(map: MindMap, userId: string): Record<string, unknown> {
  return {
    title: map.title,
    user_id: userId,
    board: map.board || PERSONAL_BOARD,
    description: map.description ?? '',
    theme: map.theme || 'default',
    node_count: map.nodeCount ?? 0,
    archived: map.archived ?? false
  };
}

export function toMindMapNode(row: MindMapNodeRow): MindMapNode {
  const kind = selectValue(row.kind);
  const side = selectValue(row.side);

  return {
    id: String(row.id),
    mapId: row.map_id ?? '',
    // Empty string and null both mean "this is the root".
    parentId: row.parent_id?.trim() ? row.parent_id.trim() : undefined,
    text: row.title ?? '',
    kind: (KINDS as readonly string[]).includes(kind) ? (kind as MindMapNodeKind) : 'idea',
    side: (SIDES as readonly string[]).includes(side) ? (side as NodeSide) : 'auto',
    sortOrder: Number(row.sort_order ?? 0) || 0,
    collapsed: row.collapsed ?? false,
    taskId: row.task_id || undefined,
    url: row.url || undefined,
    note: row.note || undefined,
    colour: row.colour || undefined,
    icon: row.icon || undefined
  };
}

export function fromMindMapNode(node: MindMapNode, userId: string): Record<string, unknown> {
  return {
    title: node.text,
    user_id: userId,
    map_id: node.mapId,
    parent_id: node.parentId ?? '',
    side: node.side || 'auto',
    sort_order: node.sortOrder ?? 0,
    collapsed: node.collapsed ?? false,
    kind: node.kind || 'idea',
    task_id: node.taskId ?? '',
    url: node.url ?? '',
    note: node.note ?? '',
    colour: node.colour ?? '',
    icon: node.icon ?? ''
  };
}
