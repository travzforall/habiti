import { MindMapNode, rootOf, sideOf } from '../models/mind-map.models';

/**
 * Where every node goes.
 *
 * ── WHY THIS IS A PURE FUNCTION ───────────────────────────────────────────
 *
 * It takes nodes and a text measurer and returns geometry. No Angular, no DOM,
 * no service. That is what makes an editor like this testable at all: "siblings
 * never overlap" and "a collapsed subtree occupies no space" are assertions
 * about a return value, not about pixels on a screen.
 *
 * ── THE ALGORITHM ─────────────────────────────────────────────────────────
 *
 * Reingold–Tilford, in the form most mind maps use: a horizontal tidy tree,
 * laid out twice — once for the right-hand branches and once mirrored for the
 * left — then joined at the root.
 *
 *   1. First walk (bottom-up): give every node a `y` relative to its subtree.
 *      A leaf sits directly under its previous sibling; a parent centres itself
 *      on its children. When centring pushes a subtree into the one above it,
 *      the whole subtree is shifted down — that shift is the entire trick, and
 *      it is what stops branches from colliding.
 *   2. Second walk (top-down): add each ancestor's shift to get absolute `y`.
 *   3. `x` comes from depth: each level is the widest node of the level before
 *      it, plus a gap. Levels line up, which is what makes a map look combed.
 *
 * Depth-first recursion is fine here: a mind map deep enough to blow the stack
 * is a mind map nobody can read.
 */

export interface NodeSize {
  width: number;
  height: number;
}

export interface LaidOutNode {
  node: MindMapNode;
  /** Top-left corner. */
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  side: 'left' | 'right';
  /** Children hidden behind a collapsed node, so the badge can say how many. */
  hiddenCount: number;
}

export interface LaidOutEdge {
  id: string;
  /** Start and end are node EDGE midpoints, not centres. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  side: 'left' | 'right';
  depth: number;
}

export interface LaidOutMap {
  nodes: LaidOutNode[];
  edges: LaidOutEdge[];
  bounds: { x: number; y: number; width: number; height: number };
}

export interface LayoutOptions {
  /** Vertical gap between sibling boxes. */
  siblingGap?: number;
  /** Horizontal gap between one level and the next. */
  levelGap?: number;
}

const DEFAULTS = { siblingGap: 14, levelGap: 64 };

/** What a node measures when nothing measures it — used by tests and as a fallback. */
export const FALLBACK_SIZE: NodeSize = { width: 140, height: 40 };

interface Internal {
  node: MindMapNode;
  size: NodeSize;
  depth: number;
  children: Internal[];
  /** Position within the subtree, before ancestors' shifts are applied. */
  y: number;
  shift: number;
  hiddenCount: number;
}

export function layoutMap(
  nodes: readonly MindMapNode[],
  measure: (node: MindMapNode) => NodeSize = () => FALLBACK_SIZE,
  options: LayoutOptions = {}
): LaidOutMap {
  const { siblingGap, levelGap } = { ...DEFAULTS, ...options };
  const root = rootOf(nodes);
  if (!root) return { nodes: [], edges: [], bounds: { x: 0, y: 0, width: 0, height: 0 } };

  const rootSize = measure(root);

  /**
   * Children indexed once, rather than filtering the whole list per node.
   *
   * `childrenOf` scans every node to answer one parent, so calling it inside
   * the walk made the layout quadratic: a thousand-node map did a million
   * comparisons, and a test comparing 200 nodes with 1000 measured a ratio of
   * 19 where linear work would be 5. Building the index costs one pass.
   */
  const byParent = new Map<string, MindMapNode[]>();
  for (const node of nodes) {
    if (!node.parentId) continue;
    const siblings = byParent.get(node.parentId);
    if (siblings) siblings.push(node);
    else byParent.set(node.parentId, [node]);
  }
  for (const siblings of byParent.values()) {
    siblings.sort((a, b) => a.sortOrder - b.sortOrder);
  }
  const children = (id: string): MindMapNode[] => byParent.get(id) ?? [];

  const topLevel = children(root.id);

  const build = (node: MindMapNode, depth: number): Internal => {
    const visibleChildren = node.collapsed ? [] : children(node.id);
    return {
      node,
      size: measure(node),
      depth,
      children: visibleChildren.map(child => build(child, depth + 1)),
      y: 0,
      shift: 0,
      hiddenCount: node.collapsed ? children(node.id).length : 0
    };
  };

  const sides: Record<'left' | 'right', Internal[]> = { left: [], right: [] };
  for (const child of topLevel) {
    sides[sideOf(nodes, child)].push(build(child, 1));
  }

  const laidOut: LaidOutNode[] = [];
  const edges: LaidOutEdge[] = [];

  // The root sits at the origin, vertically centred on itself.
  const rootBox: LaidOutNode = {
    node: root,
    x: -rootSize.width / 2,
    y: -rootSize.height / 2,
    width: rootSize.width,
    height: rootSize.height,
    depth: 0,
    side: 'right',
    hiddenCount: root.collapsed ? children(root.id).length : 0
  };
  laidOut.push(rootBox);

  for (const side of ['right', 'left'] as const) {
    const branches = sides[side];
    if (branches.length === 0) continue;

    // First walk, per side: stack the top-level branches, then centre parents.
    let cursor = 0;
    for (const branch of branches) {
      firstWalk(branch, siblingGap);
      const extent = subtreeExtent(branch);
      branch.shift = cursor - extent.min;
      cursor = branch.shift + extent.max + siblingGap;
    }

    // Centre the whole side on the root.
    const sideHeight = cursor - siblingGap;
    const offset = -sideHeight / 2;

    // Column x positions: each level clears the widest box of the level before.
    const widths = levelWidths(branches);
    const columnX: number[] = [];
    let edge = rootSize.width / 2 + levelGap;
    for (let depth = 1; depth <= widths.length; depth++) {
      columnX[depth] = edge;
      edge += (widths[depth - 1] ?? FALLBACK_SIZE.width) + levelGap;
    }

    for (const branch of branches) {
      secondWalk(branch, branch.shift + offset, (item, absoluteY) => {
        const width = item.size.width;
        // On the left the same column is mirrored through the root.
        const x = side === 'right' ? columnX[item.depth] : -columnX[item.depth] - width;

        laidOut.push({
          node: item.node,
          x,
          y: absoluteY,
          width,
          height: item.size.height,
          depth: item.depth,
          side,
          hiddenCount: item.hiddenCount
        });
      });
    }
  }

  // Edges, once every box has a position.
  const byId = new Map(laidOut.map(box => [box.node.id, box]));
  for (const box of laidOut) {
    const parentId = box.node.parentId;
    if (!parentId) continue;
    const parent = byId.get(parentId);
    if (!parent) continue;

    const fromRight = box.side === 'right';
    edges.push({
      id: `${parentId}-${box.node.id}`,
      x1: fromRight ? parent.x + parent.width : parent.x,
      y1: parent.y + parent.height / 2,
      x2: fromRight ? box.x : box.x + box.width,
      y2: box.y + box.height / 2,
      side: box.side,
      depth: box.depth
    });
  }

  return { nodes: laidOut, edges, bounds: boundsOf(laidOut) };
}

/** Bottom-up: position children, then centre the parent on them. */
function firstWalk(item: Internal, siblingGap: number): void {
  if (item.children.length === 0) {
    item.y = 0;
    return;
  }

  let cursor = 0;
  for (const child of item.children) {
    firstWalk(child, siblingGap);
    const extent = subtreeExtent(child);
    child.shift = cursor - extent.min;
    cursor = child.shift + extent.max + siblingGap;
  }

  const first = item.children[0];
  const last = item.children[item.children.length - 1];
  const top = first.shift + first.y;
  const bottom = last.shift + last.y + last.size.height;
  item.y = top + (bottom - top) / 2 - item.size.height / 2;
}

/** Top-down: fold each ancestor's shift into an absolute y. */
function secondWalk(
  item: Internal,
  accumulated: number,
  emit: (item: Internal, y: number) => void
): void {
  const y = accumulated + item.y;
  emit(item, y);
  for (const child of item.children) {
    secondWalk(child, accumulated + child.shift, emit);
  }
}

/** How far a subtree reaches above and below its own origin. */
function subtreeExtent(item: Internal): { min: number; max: number } {
  let min = item.y;
  let max = item.y + item.size.height;

  for (const child of item.children) {
    const extent = subtreeExtent(child);
    min = Math.min(min, child.shift + extent.min);
    max = Math.max(max, child.shift + extent.max);
  }

  return { min, max };
}

/** The widest box at each depth, so columns line up. */
function levelWidths(branches: Internal[]): number[] {
  const widths: number[] = [];
  const visit = (item: Internal) => {
    const index = item.depth - 1;
    widths[index] = Math.max(widths[index] ?? 0, item.size.width);
    item.children.forEach(visit);
  };
  branches.forEach(visit);
  return widths;
}

function boundsOf(boxes: LaidOutNode[]): { x: number; y: number; width: number; height: number } {
  if (boxes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const box of boxes) {
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * The connector shape.
 *
 * A cubic Bézier with horizontal control points — the curve every mind map
 * tool draws, because a straight line between two boxes at different heights
 * reads as a crossing rather than a branch.
 */
export function edgePath(edge: LaidOutEdge): string {
  const dx = Math.abs(edge.x2 - edge.x1) * 0.5;
  const c1 = edge.side === 'right' ? edge.x1 + dx : edge.x1 - dx;
  const c2 = edge.side === 'right' ? edge.x2 - dx : edge.x2 + dx;
  return `M ${edge.x1} ${edge.y1} C ${c1} ${edge.y1}, ${c2} ${edge.y2}, ${edge.x2} ${edge.y2}`;
}

// ---------------------------------------------------------------------------
// Measuring text
// ---------------------------------------------------------------------------

export const NODE_PADDING_X = 14;
export const NODE_PADDING_Y = 9;
export const NODE_LINE_HEIGHT = 18;
export const NODE_MAX_TEXT_WIDTH = 180;

/**
 * Wraps a label to `NODE_MAX_TEXT_WIDTH` and reports the resulting box.
 *
 * `measureWidth` is injected rather than measured here so specs can run without
 * a canvas — and so the real one can be a single offscreen 2D context. Measuring
 * by inserting elements and reading offsetWidth would be one forced reflow per
 * node, which at 400 nodes is the difference between instant and janky.
 */
export function measureNode(
  text: string,
  measureWidth: (text: string) => number,
  extras: { hasBadge?: boolean; hasIcon?: boolean } = {}
): { size: NodeSize; lines: string[] } {
  const lines = wrapText(text || ' ', measureWidth, NODE_MAX_TEXT_WIDTH);
  const widest = lines.reduce((max, line) => Math.max(max, measureWidth(line)), 0);

  const extraWidth = (extras.hasBadge ? 26 : 0) + (extras.hasIcon ? 20 : 0);

  return {
    size: {
      width: Math.ceil(Math.min(widest, NODE_MAX_TEXT_WIDTH) + NODE_PADDING_X * 2 + extraWidth),
      height: Math.ceil(lines.length * NODE_LINE_HEIGHT + NODE_PADDING_Y * 2)
    },
    lines
  };
}

export function wrapText(
  text: string,
  measureWidth: (text: string) => number,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [' '];

  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && measureWidth(candidate) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);

  // Four lines is enough of a label; the rest is what the note field is for.
  if (lines.length > 4) {
    return [...lines.slice(0, 3), lines[3].slice(0, 18).trimEnd() + '…'];
  }
  return lines;
}
