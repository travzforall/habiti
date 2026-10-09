import {
  Dependent,
  addDependency,
  blockersOf,
  blocking,
  chainOf,
  isBlocked,
  wouldCycle
} from './dependencies';

function item(id: string, dependsOn: string[] = [], completed = false): Dependent {
  return { id, completed, dependsOn };
}

describe('blockers', () => {
  it('are the prerequisites that are not finished', () => {
    const all = [item('a', ['b', 'c']), item('b', [], true), item('c')];
    expect(blockersOf(all[0], all).map(x => x.id)).toEqual(['c']);
  });

  it('are none when everything it waits on is done', () => {
    const all = [item('a', ['b']), item('b', [], true)];
    expect(isBlocked(all[0], all)).toBe(false);
  });

  it('are none when it waits on nothing', () => {
    expect(isBlocked(item('a'), [item('a')])).toBe(false);
  });

  it('ignore a prerequisite that no longer exists', () => {
    // A deleted task must not block its dependants forever.
    const all = [item('a', ['gone'])];
    expect(blockersOf(all[0], all)).toEqual([]);
    expect(isBlocked(all[0], all)).toBe(false);
  });
});

describe('blocking — the reverse view', () => {
  it('lists everything waiting on this one', () => {
    const all = [item('a'), item('b', ['a']), item('c', ['a']), item('d')];
    expect(blocking(all[0], all).map(x => x.id)).toEqual(['b', 'c']);
  });

  it('is empty when nothing waits on it', () => {
    const all = [item('a'), item('b')];
    expect(blocking(all[0], all)).toEqual([]);
  });
});

describe('cycles', () => {
  it('refuses a thing waiting on itself', () => {
    expect(wouldCycle([item('a')], 'a', 'a')).toBe(true);
  });

  it('refuses a direct swap', () => {
    const all = [item('a', ['b']), item('b')];
    expect(wouldCycle(all, 'b', 'a')).toBe(true);
  });

  it('refuses one further down the chain', () => {
    // c waits on b waits on a. a must not be allowed to wait on c.
    const all = [item('a'), item('b', ['a']), item('c', ['b'])];
    expect(wouldCycle(all, 'a', 'c')).toBe(true);
  });

  it('allows an unrelated prerequisite', () => {
    const all = [item('a'), item('b'), item('c')];
    expect(wouldCycle(all, 'a', 'b')).toBe(false);
  });

  it('allows a diamond — two things waiting on the same one', () => {
    const all = [item('base'), item('left', ['base']), item('right', ['base']), item('top')];
    expect(wouldCycle(all, 'top', 'left')).toBe(false);
    expect(wouldCycle(all, 'top', 'right')).toBe(false);
  });

  it('does not hang on a graph that is already looped', () => {
    const all = [item('a', ['b']), item('b', ['a'])];
    expect(wouldCycle(all, 'a', 'b')).toBe(true);
  });
});

describe('addDependency', () => {
  it('returns the new list', () => {
    const all = [item('a'), item('b')];
    expect(addDependency(all, 'a', 'b')).toEqual(['b']);
  });

  it('returns null rather than making a loop', () => {
    const all = [item('a', ['b']), item('b')];
    expect(addDependency(all, 'b', 'a')).toBeNull();
  });

  it('is idempotent — adding the same one twice changes nothing', () => {
    const all = [item('a', ['b']), item('b')];
    expect(addDependency(all, 'a', 'b')).toEqual(['b']);
  });

  it('returns null for something that is not there', () => {
    expect(addDependency([item('a')], 'missing', 'a')).toBeNull();
  });
});

describe('the whole chain', () => {
  it('includes prerequisites of prerequisites', () => {
    const all = [item('a'), item('b', ['a']), item('c', ['b'])];
    expect(chainOf(all[2], all).map(x => x.id)).toEqual(['b', 'a']);
  });

  it('reports each one once, however many paths lead to it', () => {
    const all = [
      item('base'),
      item('left', ['base']),
      item('right', ['base']),
      item('top', ['left', 'right'])
    ];
    expect(chainOf(all[3], all).map(x => x.id).sort()).toEqual(['base', 'left', 'right']);
  });

  it('terminates on a looped graph rather than walking it forever', () => {
    const all = [item('a', ['b']), item('b', ['a'])];
    expect(() => chainOf(all[0], all)).not.toThrow();
    // 'b', and not 'a': a thing is never its own prerequisite, however the
    // graph loops back round to it.
    expect(chainOf(all[0], all).map(x => x.id)).toEqual(['b']);
  });
});
