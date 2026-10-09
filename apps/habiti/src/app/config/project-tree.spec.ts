import {
  MAX_PROJECT_DEPTH,
  Nestable,
  ancestorsOf,
  canAddChild,
  canNest,
  childrenOf,
  depthOf,
  descendantsOf,
  subtreeHeight,
  treeOf,
  withDescendants
} from './project-tree';

function p(id: string, parentId?: string): Nestable {
  return { id, parentId };
}

/** house > downstairs > floors, the shape from the map. */
const house = [p('house'), p('downstairs', 'house'), p('floors', 'downstairs'), p('outside', 'house')];

describe('depth', () => {
  it('counts from one', () => {
    expect(depthOf(house[0], house)).toBe(1);
    expect(depthOf(house[1], house)).toBe(2);
    expect(depthOf(house[2], house)).toBe(3);
  });

  it('treats a parent that has been deleted as no parent', () => {
    // An orphan shows at the top rather than hiding under something gone.
    const orphan = [p('lost', 'deleted')];
    expect(depthOf(orphan[0], orphan)).toBe(1);
  });

  it('does not hang on a loop', () => {
    const looped = [p('a', 'b'), p('b', 'a')];
    expect(() => depthOf(looped[0], looped)).not.toThrow();
  });
});

describe('the family', () => {
  it('lists children, and everything below', () => {
    expect(childrenOf('house', house).map(x => x.id)).toEqual(['downstairs', 'outside']);
    expect(descendantsOf('house', house).map(x => x.id).sort()).toEqual([
      'downstairs',
      'floors',
      'outside'
    ]);
  });

  it('includes itself in what a roll-up covers', () => {
    expect(withDescendants('downstairs', house).map(x => x.id)).toEqual(['downstairs', 'floors']);
  });

  it('walks up for the breadcrumb, nearest first', () => {
    expect(ancestorsOf(house[2], house).map(x => x.id)).toEqual(['downstairs', 'house']);
  });

  it('measures how tall a branch is', () => {
    expect(subtreeHeight(house[0], house)).toBe(3);
    expect(subtreeHeight(house[2], house)).toBe(1);
  });
});

describe('what may be nested', () => {
  it('allows a plain move', () => {
    expect(canNest('outside', 'downstairs', house).ok).toBe(true);
  });

  it('refuses a project inside itself', () => {
    const check = canNest('house', 'house', house);
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toBe('cycle');
  });

  it('refuses a project inside its own descendant', () => {
    // Otherwise the branch is cut loose from everything.
    const check = canNest('house', 'floors', house);
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toBe('cycle');
  });

  it('refuses a fourth level', () => {
    const check = canNest('outside', 'floors', house);
    expect(check.ok).toBe(false);
    if (!check.ok) {
      expect(check.reason).toBe('too-deep');
      expect(check.message).toContain(String(MAX_PROJECT_DEPTH));
    }
  });

  it('measures the whole branch, not just the project being moved', () => {
    // 'downstairs' is only level 2, but it CARRIES 'floors'. Moving it under
    // another level-2 project would quietly create a level-4 one.
    const wider = [...house, p('garden', 'outside')];
    const check = canNest('downstairs', 'garden', wider);

    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toBe('too-deep');
  });

  it('always allows moving something back to the top', () => {
    expect(canNest('floors', undefined, house).ok).toBe(true);
  });

  it('refuses when one of them is gone', () => {
    const check = canNest('floors', 'vanished', house);
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toBe('missing');
  });
});

describe('the tree as a list', () => {
  const byId = (a: Nestable, b: Nestable) => a.id.localeCompare(b.id);

  it('reads parents before their children, with depth on every row', () => {
    const rows = treeOf(house, byId);

    expect(rows.map(row => `${row.depth}:${row.project.id}`)).toEqual([
      '1:house',
      '2:downstairs',
      '3:floors',
      '2:outside'
    ]);
  });

  it('says which rows have children, so a caret knows whether to draw', () => {
    const rows = treeOf(house, byId);
    expect(rows.find(row => row.project.id === 'house')?.hasChildren).toBe(true);
    expect(rows.find(row => row.project.id === 'floors')?.hasChildren).toBe(false);
  });

  it('shows an orphan at the top rather than losing it', () => {
    const rows = treeOf([p('a'), p('lost', 'deleted')], byId);
    expect(rows.map(row => row.project.id).sort()).toEqual(['a', 'lost']);
  });

  it('still lists everything when the data contains a loop', () => {
    // Nothing should be able to make a project invisible.
    const rows = treeOf([p('a', 'b'), p('b', 'a')], byId);
    expect(rows.length).toBe(2);
  });

  it('is empty for nothing', () => {
    expect(treeOf([])).toEqual([]);
  });
});

describe('adding a new project inside another', () => {
  it('is allowed while there is room', () => {
    expect(canAddChild('house', house).ok).toBe(true);
    expect(canAddChild('downstairs', house).ok).toBe(true);
  });

  it('is refused at the deepest level', () => {
    const check = canAddChild('floors', house);
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toBe('too-deep');
  });

  it('does not need the new project to exist yet', () => {
    // canNest looks the project up to measure what it carries; a project being
    // created is not in the list, and asking there returned "missing" — which
    // silently dropped the parent and made every sub-project top-level.
    expect(canAddChild('house', house).ok).toBe(true);
  });

  it('allows no parent at all', () => {
    expect(canAddChild(undefined, house).ok).toBe(true);
  });
});
