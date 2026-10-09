import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideTestUserId } from '@habiti/storage/testing';
import { UserStorage } from '@habiti/storage';
import { MindMapService } from './mind-map.service';
import { AuthService } from './auth.service';
import { BaserowService } from './baserow.service';
import { childrenOf, detachSubtree, rootOf, subtreeOf, wouldCycle } from '../models/mind-map.models';

/**
 * The editing model. Undo is the reason most of this exists: every mutation
 * goes through one funnel that snapshots first, so "can this be undone" has a
 * single answer rather than thirty.
 */

class MockAuth {
  currentUserValue: { id: number } | null = { id: 6 };
}

class MockBaserow {
  // 0 — the tables do not exist yet, which is how the feature ships.
  tables = { mindMaps: 0, mindMapNodes: 0 };
  listAllRows = jasmine.createSpy('listAllRows').and.returnValue(of([]));
  getRow = jasmine.createSpy('getRow').and.returnValue(of(null));
  createRow = jasmine.createSpy('createRow').and.returnValue(of(null));
  updateRow = jasmine.createSpy('updateRow').and.returnValue(of(null));
  deleteRow = jasmine.createSpy('deleteRow').and.returnValue(of(undefined));
}

class MockStorage {
  values = new Map<string, string>();
  readRaw = (key: string) => this.values.get(key) ?? null;
  writeRaw = (key: string, value: string) => void this.values.set(key, value);
}

function build() {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTestUserId(),
      MindMapService,
      { provide: AuthService, useClass: MockAuth },
      { provide: BaserowService, useClass: MockBaserow },
      { provide: UserStorage, useClass: MockStorage }
    ]
  });
  return TestBed.inject(MindMapService);
}

describe('MindMapService', () => {
  it('creates a map with its central topic already there', () => {
    const service = build();
    const map = service.createMap('personal', 'Launch plan');

    const nodes = service.nodesForMap(map.id);
    expect(nodes.length).toBe(1);
    expect(rootOf(nodes)!.text).toBe('Launch plan');
    expect(rootOf(nodes)!.parentId).toBeUndefined();
  });

  describe('growing a tree', () => {
    it('adds a child', () => {
      const service = build();
      const map = service.createMap('personal', 'Map');
      const root = rootOf(service.nodesForMap(map.id))!;

      const child = service.addChild(root.id, 'Before launch')!;
      expect(child.parentId).toBe(root.id);
      expect(childrenOf(service.nodesForMap(map.id), root.id).length).toBe(1);
    });

    it('alternates sides so a map grows both ways', () => {
      const service = build();
      const map = service.createMap('personal', 'Map');
      const root = rootOf(service.nodesForMap(map.id))!;

      const sides = [0, 1, 2, 3].map(() => service.addChild(root.id, 'branch')!.side);
      expect(sides.filter(side => side === 'left').length).toBe(2);
      expect(sides.filter(side => side === 'right').length).toBe(2);
    });

    it('adds a sibling directly after the node, not at the end', () => {
      const service = build();
      const map = service.createMap('personal', 'Map');
      const root = rootOf(service.nodesForMap(map.id))!;

      const first = service.addChild(root.id, 'first')!;
      const third = service.addChild(root.id, 'third')!;
      const second = service.addSibling(first.id, 'second')!;

      const order = childrenOf(service.nodesForMap(map.id), root.id).map(node => node.text);
      expect(order).toEqual(['first', 'second', 'third']);
      expect(second.parentId).toBe(third.parentId);
    });

    it('turns Enter on the root into a child, since the root has no siblings', () => {
      const service = build();
      const map = service.createMap('personal', 'Map');
      const root = rootOf(service.nodesForMap(map.id))!;

      expect(service.addSibling(root.id, 'x')!.parentId).toBe(root.id);
    });

    it('expands a collapsed parent rather than hiding the new child', () => {
      const service = build();
      const map = service.createMap('personal', 'Map');
      const root = rootOf(service.nodesForMap(map.id))!;
      const branch = service.addChild(root.id, 'branch')!;

      service.toggleCollapse(branch.id);
      expect(service.getNode(branch.id)!.collapsed).toBe(true);

      service.addChild(branch.id, 'leaf');
      expect(service.getNode(branch.id)!.collapsed).toBe(false);
    });
  });

  describe('deleting', () => {
    it('takes the whole subtree', () => {
      const service = build();
      const map = service.createMap('personal', 'Map');
      const root = rootOf(service.nodesForMap(map.id))!;
      const branch = service.addChild(root.id, 'branch')!;
      const leaf = service.addChild(branch.id, 'leaf')!;
      service.addChild(leaf.id, 'deeper');

      service.deleteNode(branch.id);
      expect(service.nodesForMap(map.id).length).toBe(1);
    });

    it('refuses to delete the root — a map without one is not a map', () => {
      const service = build();
      const map = service.createMap('personal', 'Map');
      const root = rootOf(service.nodesForMap(map.id))!;

      service.deleteNode(root.id);
      expect(service.nodesForMap(map.id).length).toBe(1);
    });
  });

  describe('reparenting', () => {
    it('moves a node under a new parent', () => {
      const service = build();
      const map = service.createMap('personal', 'Map');
      const root = rootOf(service.nodesForMap(map.id))!;
      const a = service.addChild(root.id, 'a')!;
      const b = service.addChild(root.id, 'b')!;

      expect(service.reparent(b.id, a.id)).toBe(true);
      expect(service.getNode(b.id)!.parentId).toBe(a.id);
    });

    it('refuses a cycle rather than trying to repair one', () => {
      const service = build();
      const map = service.createMap('personal', 'Map');
      const root = rootOf(service.nodesForMap(map.id))!;
      const parent = service.addChild(root.id, 'parent')!;
      const child = service.addChild(parent.id, 'child')!;

      expect(service.reparent(parent.id, child.id)).toBe(false);
      expect(service.getNode(parent.id)!.parentId).toBe(root.id);
    });

    it('leaves the root where it is', () => {
      const service = build();
      const map = service.createMap('personal', 'Map');
      const root = rootOf(service.nodesForMap(map.id))!;
      const child = service.addChild(root.id, 'child')!;

      expect(service.reparent(root.id, child.id)).toBe(false);
    });
  });

  describe('undo', () => {
    it('puts back a deleted branch', () => {
      const service = build();
      const map = service.createMap('personal', 'Map');
      const root = rootOf(service.nodesForMap(map.id))!;
      const branch = service.addChild(root.id, 'branch')!;
      service.addChild(branch.id, 'leaf');

      expect(service.nodesForMap(map.id).length).toBe(3);
      service.deleteNode(branch.id);
      expect(service.nodesForMap(map.id).length).toBe(1);

      service.undo(map.id);
      expect(service.nodesForMap(map.id).length).toBe(3);
      expect(service.getNode(branch.id)!.text).toBe('branch');
    });

    it('walks back several steps and forward again', () => {
      const service = build();
      const map = service.createMap('personal', 'Map');
      const root = rootOf(service.nodesForMap(map.id))!;

      service.addChild(root.id, 'one');
      service.addChild(root.id, 'two');
      service.addChild(root.id, 'three');
      expect(service.nodesForMap(map.id).length).toBe(4);

      service.undo(map.id);
      service.undo(map.id);
      expect(service.nodesForMap(map.id).length).toBe(2);

      service.redo(map.id);
      expect(service.nodesForMap(map.id).length).toBe(3);
    });

    it('drops the redo stack once a new edit is made', () => {
      const service = build();
      const map = service.createMap('personal', 'Map');
      const root = rootOf(service.nodesForMap(map.id))!;

      service.addChild(root.id, 'one');
      service.undo(map.id);
      expect(service.canRedo()).toBe(true);

      service.addChild(root.id, 'different');
      expect(service.canRedo()).toBe(false);
    });

    it('does nothing when there is nothing to undo', () => {
      const service = build();
      const map = service.createMap('personal', 'Map');
      service.undo(map.id);
      expect(service.nodesForMap(map.id).length).toBe(1);
    });

    it('restores a renamed node"s previous text', () => {
      const service = build();
      const map = service.createMap('personal', 'Map');
      const root = rootOf(service.nodesForMap(map.id))!;

      service.updateNode(root.id, { text: 'Renamed' });
      expect(service.getNode(root.id)!.text).toBe('Renamed');

      service.undo(map.id);
      expect(service.getNode(root.id)!.text).toBe('Map');
    });
  });

  describe('boards and tasks', () => {
    it('keeps a project"s maps apart from personal ones', () => {
      const service = build();
      service.createMap('personal', 'Ideas');
      service.createMap('7', 'Launch plan');

      expect(service.mapsForBoard('personal').map(m => m.title)).toEqual(['Ideas']);
      expect(service.mapsForBoard('7').map(m => m.title)).toEqual(['Launch plan']);
    });

    it('finds every map a task appears on, for the backlink', () => {
      const service = build();
      const map = service.createMap('personal', 'Map');
      const root = rootOf(service.nodesForMap(map.id))!;
      const node = service.addChild(root.id, 'do the thing')!;

      service.updateNode(node.id, { kind: 'task', taskId: '482' });
      expect(service.mapsForTask('482').map(m => m.id)).toEqual([map.id]);
      expect(service.mapsForTask('999')).toEqual([]);
    });
  });

  it('deletes a map and all of its nodes', () => {
    const service = build();
    const map = service.createMap('personal', 'Map');
    const root = rootOf(service.nodesForMap(map.id))!;
    service.addChild(root.id, 'branch');

    service.deleteMap(map.id);
    expect(service.getMap(map.id)).toBeUndefined();
    expect(service.nodesForMap(map.id).length).toBe(0);
  });
});

describe('tree helpers', () => {
  const nodes = [
    { id: 'r', mapId: 'm', text: 'r', kind: 'idea' as const, side: 'auto' as const, sortOrder: 0, collapsed: false },
    { id: 'a', mapId: 'm', parentId: 'r', text: 'a', kind: 'idea' as const, side: 'auto' as const, sortOrder: 1, collapsed: false },
    { id: 'b', mapId: 'm', parentId: 'a', text: 'b', kind: 'idea' as const, side: 'auto' as const, sortOrder: 1, collapsed: false }
  ];

  it('collects a subtree including its own root', () => {
    expect(subtreeOf(nodes, 'a').map(n => n.id)).toEqual(['a', 'b']);
  });

  it('spots a cycle before one is made', () => {
    expect(wouldCycle(nodes, 'a', 'b')).toBe(true);
    expect(wouldCycle(nodes, 'a', 'a')).toBe(true);
    expect(wouldCycle(nodes, 'b', 'r')).toBe(false);
  });

  it('does not hang on a tree that is already broken', () => {
    const looped = [
      { ...nodes[1], parentId: 'b' },
      { ...nodes[2], parentId: 'a' }
    ];
    expect(wouldCycle(looped, 'a', 'b')).toBe(true);
  });
});

describe('MindMapService clipboard', () => {
  it('copies a branch and pastes it as an independent copy', () => {
    const service = build();
    const map = service.createMap('personal', 'Map');
    const root = rootOf(service.nodesForMap(map.id))!;
    const branch = service.addChild(root.id, 'branch')!;
    service.addChild(branch.id, 'leaf');
    const target = service.addChild(root.id, 'target')!;

    expect(service.copyBranch(branch.id)).toBe(true);
    const pasted = service.pasteInto(target.id)!;

    // The copy is a copy: new ids, same shape, and editing one must not touch
    // the other.
    expect(pasted.id).not.toBe(branch.id);
    expect(pasted.parentId).toBe(target.id);
    expect(childrenOf(service.nodesForMap(map.id), pasted.id).length).toBe(1);

    service.updateNode(pasted.id, { text: 'renamed copy' });
    expect(service.getNode(branch.id)!.text).toBe('branch');
  });

  it('pastes twice without the two copies sharing anything', () => {
    const service = build();
    const map = service.createMap('personal', 'Map');
    const root = rootOf(service.nodesForMap(map.id))!;
    const branch = service.addChild(root.id, 'branch')!;

    service.copyBranch(branch.id);
    const first = service.pasteInto(root.id)!;
    const second = service.pasteInto(root.id)!;

    expect(first.id).not.toBe(second.id);
    expect(service.nodesForMap(map.id).length).toBe(4);
  });

  it('cut removes the original and keeps it on the clipboard', () => {
    const service = build();
    const map = service.createMap('personal', 'Map');
    const root = rootOf(service.nodesForMap(map.id))!;
    const branch = service.addChild(root.id, 'branch')!;

    expect(service.cutBranch(branch.id)).toBe(true);
    expect(service.getNode(branch.id)).toBeUndefined();
    expect(service.canPaste()).toBe(true);

    const pasted = service.pasteInto(root.id)!;
    expect(pasted.text).toBe('branch');
  });

  it('refuses to cut the root, which would leave no map', () => {
    const service = build();
    const map = service.createMap('personal', 'Map');
    const root = rootOf(service.nodesForMap(map.id))!;

    expect(service.cutBranch(root.id)).toBe(false);
    expect(service.nodesForMap(map.id).length).toBe(1);
  });

  it('has nothing to paste until something is copied', () => {
    const service = build();
    const map = service.createMap('personal', 'Map');
    const root = rootOf(service.nodesForMap(map.id))!;

    expect(service.canPaste()).toBe(false);
    expect(service.pasteInto(root.id)).toBeNull();
  });

  it('is undoable, like every other edit', () => {
    const service = build();
    const map = service.createMap('personal', 'Map');
    const root = rootOf(service.nodesForMap(map.id))!;
    const branch = service.addChild(root.id, 'branch')!;

    service.copyBranch(branch.id);
    service.pasteInto(root.id);
    expect(service.nodesForMap(map.id).length).toBe(3);

    service.undo(map.id);
    expect(service.nodesForMap(map.id).length).toBe(2);
  });

  it('detaches a branch so it can be exported as a map of its own', () => {
    const service = build();
    const map = service.createMap('personal', 'Map');
    const root = rootOf(service.nodesForMap(map.id))!;
    const branch = service.addChild(root.id, 'branch')!;
    service.addChild(branch.id, 'leaf');

    const detached = detachSubtree(service.nodesForMap(map.id), branch.id);
    expect(detached.length).toBe(2);
    expect(rootOf(detached)!.text).toBe('branch');
  });
});
