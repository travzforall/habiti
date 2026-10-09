import { MindMapNode } from '../models/mind-map.models';
import { LaidOutNode, edgePath, layoutMap, measureNode, wrapText } from './mind-map-layout';

/**
 * The layout is a pure function of the tree, which is the only reason an editor
 * like this can be tested without pixels. Everything below is an assertion
 * about a return value.
 */

function node(id: string, parentId?: string, extra: Partial<MindMapNode> = {}): MindMapNode {
  return {
    id,
    mapId: 'm1',
    parentId,
    text: id,
    kind: 'idea',
    side: 'auto',
    sortOrder: Number(id.replace(/\D/g, '')) || 0,
    collapsed: false,
    ...extra
  };
}

/** Every box the same size, so overlap assertions are about the algorithm. */
const uniform = () => ({ width: 100, height: 40 });

function overlaps(a: LaidOutNode, b: LaidOutNode): boolean {
  return (
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
  );
}

describe('layoutMap', () => {
  it('returns nothing for an empty map rather than throwing', () => {
    const result = layoutMap([], uniform);
    expect(result.nodes).toEqual([]);
    expect(result.bounds.width).toBe(0);
  });

  it('puts a lone root at the origin', () => {
    const [box] = layoutMap([node('root')], uniform).nodes;
    expect(box.x).toBe(-50);
    expect(box.y).toBe(-20);
    expect(box.depth).toBe(0);
  });

  describe('no two boxes ever overlap', () => {
    it('with a flat fan of children', () => {
      const nodes = [node('root'), ...Array.from({ length: 8 }, (_, i) => node(`c${i}`, 'root'))];
      const { nodes: boxes } = layoutMap(nodes, uniform);

      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          expect(overlaps(boxes[i], boxes[j]))
            .withContext(`${boxes[i].node.id} overlaps ${boxes[j].node.id}`)
            .toBe(false);
        }
      }
    });

    it('with deep, lopsided branches — the case that catches a missing shift', () => {
      const nodes = [
        node('root'),
        node('a1', 'root', { side: 'right' }),
        node('a2', 'a1'),
        node('a3', 'a2'),
        node('a4', 'a2'),
        node('a5', 'a4'),
        node('b1', 'root', { side: 'right', sortOrder: 2 }),
        node('b2', 'b1'),
        node('b3', 'b1'),
        node('c1', 'root', { side: 'right', sortOrder: 3 })
      ];
      const { nodes: boxes } = layoutMap(nodes, uniform);

      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          expect(overlaps(boxes[i], boxes[j]))
            .withContext(`${boxes[i].node.id} overlaps ${boxes[j].node.id}`)
            .toBe(false);
        }
      }
    });

    it('with boxes of different heights', () => {
      const nodes = [node('root'), node('a', 'root'), node('b', 'root'), node('c', 'root')];
      const varying = (n: MindMapNode) => ({ width: 100, height: n.id === 'b' ? 120 : 30 });
      const { nodes: boxes } = layoutMap(nodes, varying);

      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          expect(overlaps(boxes[i], boxes[j])).toBe(false);
        }
      }
    });
  });

  it('centres a parent on its children', () => {
    const nodes = [node('root'), node('p', 'root'), node('c1', 'p'), node('c2', 'p')];
    const boxes = layoutMap(nodes, uniform).nodes;

    const parent = boxes.find(b => b.node.id === 'p')!;
    const first = boxes.find(b => b.node.id === 'c1')!;
    const last = boxes.find(b => b.node.id === 'c2')!;

    const parentMid = parent.y + parent.height / 2;
    const childrenMid = (first.y + (last.y + last.height)) / 2;
    expect(Math.abs(parentMid - childrenMid)).toBeLessThan(0.001);
  });

  it('lines each level up in a column', () => {
    const nodes = [node('root'), node('a', 'root'), node('b', 'root'), node('a1', 'a'), node('b1', 'b')];
    const boxes = layoutMap(nodes, uniform).nodes;

    expect(boxes.find(b => b.node.id === 'a')!.x).toBe(boxes.find(b => b.node.id === 'b')!.x);
    expect(boxes.find(b => b.node.id === 'a1')!.x).toBe(boxes.find(b => b.node.id === 'b1')!.x);
  });

  describe('sides', () => {
    it('mirrors a left branch through the root', () => {
      const nodes = [node('root'), node('r', 'root', { side: 'right' }), node('l', 'root', { side: 'left' })];
      const boxes = layoutMap(nodes, uniform).nodes;

      const right = boxes.find(b => b.node.id === 'r')!;
      const left = boxes.find(b => b.node.id === 'l')!;

      expect(right.x).toBeGreaterThan(0);
      expect(left.x + left.width).toBeLessThan(0);
      expect(right.x).toBe(-(left.x + left.width));
    });

    it('gives a descendant its branch"s side', () => {
      const nodes = [
        node('root'),
        node('l', 'root', { side: 'left' }),
        node('l1', 'l'),
        node('l2', 'l1')
      ];
      const boxes = layoutMap(nodes, uniform).nodes;
      expect(boxes.find(b => b.node.id === 'l2')!.side).toBe('left');
      expect(boxes.find(b => b.node.id === 'l2')!.x).toBeLessThan(0);
    });
  });

  describe('collapse', () => {
    it('takes a hidden subtree out of the layout entirely', () => {
      const base = [node('root'), node('a', 'root'), node('b', 'root')];
      const withHidden = [
        ...base.map(n => (n.id === 'a' ? { ...n, collapsed: true } : n)),
        node('a1', 'a'),
        node('a2', 'a'),
        node('a3', 'a')
      ];

      const expanded = layoutMap(base, uniform);
      const collapsed = layoutMap(withHidden, uniform);

      expect(collapsed.nodes.length).toBe(expanded.nodes.length);
      expect(collapsed.bounds.height).toBe(expanded.bounds.height);
    });

    it('reports how many children are hidden, so the badge can say', () => {
      const nodes = [
        node('root'),
        { ...node('a', 'root'), collapsed: true },
        node('a1', 'a'),
        node('a2', 'a')
      ];
      const box = layoutMap(nodes, uniform).nodes.find(b => b.node.id === 'a')!;
      expect(box.hiddenCount).toBe(2);
    });
  });

  it('is deterministic — the same tree twice is the same geometry', () => {
    const nodes = [node('root'), node('a', 'root'), node('b', 'root'), node('a1', 'a')];
    expect(JSON.stringify(layoutMap(nodes, uniform))).toBe(JSON.stringify(layoutMap(nodes, uniform)));
  });

  it('survives a broken tree without hanging', () => {
    // A parent that does not exist: the node is simply not reachable from the
    // root and must not take the layout down with it.
    const nodes = [node('root'), node('orphan', 'missing')];
    expect(() => layoutMap(nodes, uniform)).not.toThrow();
  });

  describe('edges', () => {
    it('joins parent edge to child edge, not centre to centre', () => {
      const nodes = [node('root'), node('a', 'root', { side: 'right' })];
      const { nodes: boxes, edges } = layoutMap(nodes, uniform);

      const root = boxes.find(b => b.node.id === 'root')!;
      const child = boxes.find(b => b.node.id === 'a')!;

      expect(edges.length).toBe(1);
      expect(edges[0].x1).toBe(root.x + root.width);
      expect(edges[0].x2).toBe(child.x);
    });

    it('draws a curve with horizontal control points', () => {
      const path = edgePath({ id: 'e', x1: 0, y1: 0, x2: 100, y2: 50, side: 'right', depth: 1 });
      expect(path).toBe('M 0 0 C 50 0, 50 50, 100 50');
    });
  });

  /**
   * A big map must not fall off a cliff.
   *
   * This used to assert a wall-clock budget — under 16ms for 1000 nodes — and
   * it failed at 29ms on a machine that was busy doing something else, which
   * says nothing whatever about the layout. A constant like that measures the
   * hardware and the load, not the code.
   *
   * What actually matters is the SHAPE of the cost. Five times the nodes should
   * cost roughly five times the work; an accidental O(n²) would cost
   * twenty-five. The ratio is what is asserted, with a floor under the small
   * measurement so a sub-millisecond reading cannot turn noise into a failure.
   */
  function buildTree(branches: number): MindMapNode[] {
    const nodes: MindMapNode[] = [node('root')];
    for (let i = 0; i < branches; i++) {
      nodes.push(node(`b${i}`, 'root', { side: i % 2 ? 'left' : 'right', sortOrder: i }));
      for (let j = 0; j < 9; j++) nodes.push(node(`b${i}-${j}`, `b${i}`, { sortOrder: j }));
    }
    return nodes;
  }

  function timeLayout(nodes: MindMapNode[]): number {
    const started = performance.now();
    layoutMap(nodes, uniform);
    return performance.now() - started;
  }

  it('lays a thousand nodes out completely', () => {
    const nodes = buildTree(100);
    expect(nodes.length).toBe(1001);

    const map = layoutMap(nodes, uniform);
    expect(map.nodes.length).toBe(1001);
    expect(map.edges.length).toBe(1000);
  });

  it('does not get quadratically slower as a map grows', () => {
    const small = buildTree(20);
    const large = buildTree(100);

    // Warm up, so the first run's compilation is not charged to `small`.
    timeLayout(small);
    timeLayout(large);

    const smallTime = Math.max(timeLayout(small), 0.5);
    const largeTime = timeLayout(large);
    const ratio = largeTime / smallTime;

    // Five times the nodes: linear is ~5, quadratic is ~25.
    expect(ratio)
      .withContext(`${largeTime.toFixed(1)}ms vs ${smallTime.toFixed(1)}ms — ratio ${ratio.toFixed(1)}`)
      .toBeLessThan(12);
  });
});

describe('text measuring', () => {
  // 7 px a character is close enough to a 14 px sans-serif for a test.
  const measure = (text: string) => text.length * 7;

  it('wraps at the maximum width', () => {
    const lines = wrapText('one two three four five six seven eight', measure, 100);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(measure(line)).toBeLessThanOrEqual(100);
  });

  it('never drops a word that is longer than the line', () => {
    expect(wrapText('supercalifragilistic', measure, 50)).toEqual(['supercalifragilistic']);
  });

  it('stops at four lines and marks the truncation', () => {
    const lines = wrapText('a '.repeat(200), measure, 60);
    expect(lines.length).toBe(4);
    expect(lines[3].endsWith('…')).toBe(true);
  });

  it('gives an empty label a box rather than a zero', () => {
    expect(measureNode('', measure).size.height).toBeGreaterThan(0);
  });

  it('grows with the number of lines', () => {
    const one = measureNode('short', measure).size.height;
    const many = measureNode('one two three four five six seven', measure).size.height;
    expect(many).toBeGreaterThan(one);
  });

  it('leaves room for a task badge', () => {
    const plain = measureNode('write the post', measure).size.width;
    const badged = measureNode('write the post', measure, { hasBadge: true }).size.width;
    expect(badged).toBeGreaterThan(plain);
  });
});
