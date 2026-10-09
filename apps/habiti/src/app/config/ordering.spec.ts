import { Ordered, byOrder, moveItem, renumber } from './ordering';

function item(id: string, sortOrder?: number): Ordered {
  return { id, sortOrder };
}

describe('moving an item', () => {
  const list = ['a', 'b', 'c', 'd'];

  it('moves one down', () => {
    expect(moveItem(list, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves one up', () => {
    expect(moveItem(list, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('changes nothing when it lands where it started', () => {
    expect(moveItem(list, 2, 2)).toEqual(list);
  });

  it('clamps a drop past the end rather than throwing', () => {
    // A drop below the last row means "put it last", which is what was meant.
    expect(moveItem(list, 0, 99)).toEqual(['b', 'c', 'd', 'a']);
    expect(moveItem(list, 99, 0)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('never mutates the list it was given', () => {
    const original = [...list];
    moveItem(list, 0, 3);
    expect(list).toEqual(original);
  });

  it('copes with an empty list', () => {
    expect(moveItem([], 0, 1)).toEqual([]);
  });
});

describe('renumbering', () => {
  it('numbers the group from one', () => {
    const changed = renumber([item('a'), item('b'), item('c')]);
    expect(changed.map(row => [row.item.id, row.sortOrder])).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3]
    ]);
  });

  it('returns only the rows that actually moved', () => {
    // Dragging the last item one place up is two writes, not twenty.
    const changed = renumber([item('a', 1), item('c', 3), item('b', 2)]);
    expect(changed.map(row => row.item.id)).toEqual(['c', 'b']);
  });

  it('writes nothing when the order is already right', () => {
    expect(renumber([item('a', 1), item('b', 2)])).toEqual([]);
  });
});

describe('the order a list reads in', () => {
  const byTitle = (a: Ordered, b: Ordered) => a.id.localeCompare(b.id);

  it('puts hand-placed items in their number order', () => {
    const sorted = [item('c', 2), item('a', 1)].sort(byOrder(byTitle));
    expect(sorted.map(x => x.id)).toEqual(['a', 'c']);
  });

  it('puts anything never dragged after everything that was', () => {
    // A new project appearing in the middle of an order someone arranged looks
    // like the list rearranged itself.
    const sorted = [item('new'), item('placed', 5)].sort(byOrder(byTitle));
    expect(sorted.map(x => x.id)).toEqual(['placed', 'new']);
  });

  it('falls back for two items with no number', () => {
    const sorted = [item('b'), item('a')].sort(byOrder(byTitle));
    expect(sorted.map(x => x.id)).toEqual(['a', 'b']);
  });

  it('falls back to break a tie', () => {
    const sorted = [item('b', 1), item('a', 1)].sort(byOrder(byTitle));
    expect(sorted.map(x => x.id)).toEqual(['a', 'b']);
  });
});
