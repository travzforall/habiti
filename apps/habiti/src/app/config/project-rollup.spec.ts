import { RollableProject, summariseFamily, summariseRoots } from './project-rollup';

function project(
  id: string,
  parentId?: string,
  tasks: { completed: boolean }[] = [],
  budget?: number
): RollableProject {
  return { id, title: id, parentId, tasks, budget };
}

/** The shape from the map: a house area with sub-projects under it. */
const family = [
  project('downstairs', undefined, [], 2000),
  project('floors', 'downstairs', [{ completed: true }, { completed: false }], 900),
  project('stairs', 'downstairs', [{ completed: false }]),
  project('self-level', 'floors', [{ completed: true }])
];

describe('summarising a family', () => {
  it('counts every project under the root, and itself', () => {
    const summary = summariseFamily(family[0], family);

    expect(summary.projectCount).toBe(4);
    expect(summary.children.map(child => child.id).sort()).toEqual(['floors', 'stairs']);
    expect(summary.descendants.length).toBe(3);
    expect(summary.depth).toBe(3);
  });

  it('counts tasks all the way down, not just the root’s own', () => {
    // The root's list is empty once its tasks have been promoted — reporting
    // that as an empty project would hide ten jobs.
    const summary = summariseFamily(family[0], family);

    expect(summary.ownTaskCount).toBe(0);
    expect(summary.taskCount).toBe(4);
    expect(summary.doneCount).toBe(2);
    expect(summary.progress).toBe(50);
  });

  it('is 0% rather than NaN when there is nothing to do yet', () => {
    const summary = summariseFamily(project('empty'), [project('empty')]);
    expect(summary.progress).toBe(0);
    expect(summary.taskCount).toBe(0);
  });

  it('adds up the budgets that exist', () => {
    expect(summariseFamily(family[0], family).budget).toBe(2900);
  });

  it('says nothing rather than nought when nobody set a budget', () => {
    // "Budgeted nothing" and "not budgeted" are very different statements.
    const none = [project('a'), project('b', 'a')];
    expect(summariseFamily(none[0], none).budget).toBeUndefined();
  });

  it('adds up money from every project in the family', () => {
    const money = new Map([
      ['floors', { spent: 40, committed: 65 }],
      ['self-level', { spent: 10, committed: 0 }]
    ]);

    const summary = summariseFamily(family[0], family, money);
    expect(summary.spent).toBe(50);
    expect(summary.committed).toBe(65);
    expect(summary.projected).toBe(115);
    expect(summary.over).toBe(false);
  });

  it('flags a family projected past its combined budget', () => {
    const money = new Map([['floors', { spent: 2500, committed: 600 }]]);
    expect(summariseFamily(family[0], family, money).over).toBe(true);
  });

  it('has no opinion about being over when there is no budget', () => {
    const none = [project('a'), project('b', 'a')];
    const money = new Map([['b', { spent: 500, committed: 0 }]]);

    expect(summariseFamily(none[0], none, money).over).toBe(false);
  });

  it('adds money without the halfpenny drift', () => {
    const two = [project('a'), project('b', 'a')];
    const money = new Map([
      ['a', { spent: 0.1, committed: 0 }],
      ['b', { spent: 0.2, committed: 0 }]
    ]);

    expect(summariseFamily(two[0], two, money).spent).toBe(0.3);
  });
});

describe('every root', () => {
  it('summarises one per top-level project, in title order', () => {
    const all = [...family, project('outside')];
    const roots = summariseRoots(all);

    expect(roots.map(summary => summary.root.id)).toEqual(['downstairs', 'outside']);
  });

  it('treats a project whose parent is gone as a root, so it can be found', () => {
    const orphaned = [project('lost', 'deleted')];
    expect(summariseRoots(orphaned).map(summary => summary.root.id)).toEqual(['lost']);
  });

  it('never lists a sub-project as a root of its own', () => {
    expect(summariseRoots(family).length).toBe(1);
  });

  it('is empty for nothing', () => {
    expect(summariseRoots([])).toEqual([]);
  });
});
