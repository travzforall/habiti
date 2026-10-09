import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideTestUserId } from '@habiti/storage/testing';
import { UserStorage } from '@habiti/storage';
import { SyncBus } from '@habiti/sync';
import { TasksService } from './tasks.service';
import { AuthService } from './auth.service';
import { BaserowService } from './baserow.service';
import { STANDALONE } from '../models/task-row.models';

/**
 * The behaviours that were wrong for months without anything failing.
 *
 * Ticking a task did not persist (the mapper wrote a column the table does not
 * have), a task could not belong to a project, and a row id typed into the URL
 * fetched whoever's task it happened to be. None of those are visible from a
 * green build, which is exactly why they are pinned here.
 */

class MockAuth {
  currentUserValue: { id: number } | null = { id: 6 };
}

class MockBaserow {
  tables = { userTasks: 631 };
  rows: Record<number, unknown> = {};
  created: Record<string, unknown>[] = [];
  updated: { rowId: number; data: Record<string, unknown> }[] = [];
  deleted: number[] = [];

  listAllRows = jasmine.createSpy('listAllRows').and.returnValue(of([]));

  getRow = (_table: number, rowId: number) => of(this.rows[rowId] ?? null);

  createRow = (_table: number, data: Record<string, unknown>) => {
    this.created.push(data);
    return of({ id: 900 + this.created.length });
  };

  updateRow = (_table: number, rowId: number, data: Record<string, unknown>) => {
    this.updated.push({ rowId, data });
    return of({ id: rowId });
  };

  deleteRow = (_table: number, rowId: number) => {
    this.deleted.push(rowId);
    return of(undefined);
  };
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
      TasksService,
      SyncBus,
      { provide: AuthService, useClass: MockAuth },
      { provide: BaserowService, useClass: MockBaserow },
      { provide: UserStorage, useClass: MockStorage }
    ]
  });

  return {
    service: TestBed.inject(TasksService),
    baserow: TestBed.inject(BaserowService) as unknown as MockBaserow
  };
}

describe('TasksService', () => {
  describe('completion', () => {
    it('writes the completed BOOLEAN when a task is ticked', () => {
      const { service, baserow } = build();
      const task = service.createTask({ title: 'Book the skip' });
      baserow.updated.length = 0;

      service.toggleTask(task.id);

      const written = baserow.created.concat(baserow.updated.map(u => u.data));
      expect(written.some(row => row['completed'] === true))
        .withContext('completion must reach the server as `completed: true`')
        .toBe(true);
    });

    it('keeps status and completed in step from either direction', () => {
      const { service } = build();
      const task = service.createTask({ title: 'x' });

      service.setStatus(task.id, 'done');
      expect(service.getTask(task.id)?.completed).toBe(true);

      service.toggleTask(task.id);
      expect(service.getTask(task.id)?.status).toBe('todo');
      expect(service.getTask(task.id)?.completed).toBe(false);
    });

    it('stamps and clears completedAt across the transition', () => {
      const { service } = build();
      const task = service.createTask({ title: 'x' });

      service.toggleTask(task.id);
      expect(service.getTask(task.id)?.completedAt).toBeInstanceOf(Date);

      service.toggleTask(task.id);
      expect(service.getTask(task.id)?.completedAt).toBeUndefined();
    });
  });

  describe('project membership', () => {
    it('defaults to standalone', () => {
      const { service } = build();
      expect(service.createTask({ title: 'x' }).projectId).toBe(STANDALONE);
    });

    it('writes project_id so the task belongs to the project on the server too', () => {
      const { service, baserow } = build();
      service.createTask({ title: 'x', projectId: '7' });
      expect(baserow.created[0]['project_id']).toBe('7');
    });

    it('moves a task between a project and standalone', () => {
      const { service } = build();
      const task = service.createTask({ title: 'x', projectId: '7' });

      expect(service.tasksForProject('7').length).toBe(1);

      service.moveToProject(task.id, STANDALONE);
      expect(service.tasksForProject('7').length).toBe(0);
      expect(service.standaloneTasks().length).toBe(1);
    });

    it('separates standalone tasks from project ones', () => {
      const { service } = build();
      service.createTask({ title: 'a' });
      service.createTask({ title: 'b', projectId: '7' });

      expect(service.tasks().length).toBe(2);
      expect(service.standaloneTasks().length).toBe(1);
    });
  });

  describe('due-date views', () => {
    it('includes project tasks, not just standalone ones', () => {
      const { service } = build();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      service.createTask({ title: 'in a project', projectId: '7', dueDate: yesterday });

      expect(service.overdueTasks().length)
        .withContext('a deadline is a deadline whichever list it sits in')
        .toBe(1);
    });

    it('leaves undated tasks out of Today', () => {
      const { service } = build();
      service.createTask({ title: 'someday' });
      expect(service.todaysTasks().length).toBe(0);
    });

    it('counts a task due today as due today', () => {
      const { service } = build();
      service.createTask({ title: 'today', dueDate: new Date() });
      expect(service.todaysTasks().length).toBe(1);
    });
  });

  describe('loadOne', () => {
    it('refuses a row belonging to someone else', done => {
      const { service, baserow } = build();
      baserow.rows[42] = { id: 42, title: "someone else's task", user_id: '99' };

      service.loadOne('42').subscribe(task => {
        expect(task)
          .withContext('row ids in URLs are guessable — ownership has to be checked here')
          .toBeNull();
        expect(service.getTask('42')).toBeUndefined();
        done();
      });
    });

    it('adopts a row belonging to this account', done => {
      const { service, baserow } = build();
      baserow.rows[42] = { id: 42, title: 'mine', user_id: '6' };

      service.loadOne('42').subscribe(task => {
        expect(task?.title).toBe('mine');
        expect(service.getTask('42')?.title).toBe('mine');
        done();
      });
    });
  });

  describe('logHours', () => {
    it('adds to what is already there', () => {
      const { service } = build();
      const task = service.createTask({ title: 'x', actualHours: 1.5 });

      service.logHours(task.id, 0.75);
      expect(service.getTask(task.id)?.actualHours).toBe(2.25);
    });

    it('rounds to two decimals, which is all Baserow will accept', () => {
      const { service } = build();
      const task = service.createTask({ title: 'x' });

      service.logHours(task.id, 1 / 3);
      const hours = service.getTask(task.id)?.actualHours ?? 0;
      expect(hours).toBe(0.33);
    });

    it('ignores nonsense', () => {
      const { service } = build();
      const task = service.createTask({ title: 'x', actualHours: 2 });

      service.logHours(task.id, -5);
      service.logHours(task.id, Number.NaN);
      expect(service.getTask(task.id)?.actualHours).toBe(2);
    });
  });

  it('creates nothing on its own — no sample data, ever', () => {
    const { service, baserow } = build();
    expect(service.tasks().length).toBe(0);
    expect(baserow.created.length).toBe(0);
  });
});

describe('TasksService milestones', () => {
  it('puts a task in a milestone and finds it again', () => {
    const { service } = build();
    const task = service.createTask({ title: 'Write the post', projectId: '7' });

    service.updateTask(task.id, { milestoneId: 'm1' });

    // By title, not id: the row adopts the server's id as soon as the create
    // returns, which in this mock is synchronous.
    expect(service.tasksForMilestone('m1').map(t => t.title)).toEqual(['Write the post']);
    expect(service.tasksForMilestone('m2')).toEqual([]);
  });

  it('takes it back out again', () => {
    const { service } = build();
    const task = service.createTask({ title: 'x', projectId: '7', milestoneId: 'm1' });
    expect(service.tasksForMilestone('m1').length).toBe(1);

    service.updateTask(task.id, { milestoneId: undefined });
    expect(service.tasksForMilestone('m1').length).toBe(0);
  });

  it('writes milestone_id, so the grouping is not only in this browser', () => {
    const { service, baserow } = build();
    service.createTask({ title: 'x', projectId: '7', milestoneId: 'm1' });

    // Pending in the live table — Baserow drops it silently until the column
    // exists — but the app must be sending it.
    expect(baserow.created[0]['milestone_id']).toBe('m1');
  });

  it('leaves a task in place when its project changes but the milestone does not', () => {
    const { service } = build();
    const task = service.createTask({ title: 'x', projectId: '7', milestoneId: 'm1' });

    service.moveToProject(task.id, 'standalone');
    // Moving projects does NOT silently clear the milestone here — the form is
    // what clears it, because it knows which milestones the new project has.
    expect(service.getTask(task.id)?.milestoneId).toBe('m1');
  });
});

describe('TasksService dependencies', () => {
  it('reports what a task is waiting on, and only what is unfinished', () => {
    const { service } = build();
    const first = service.createTask({ title: 'Design' });
    const second = service.createTask({ title: 'Build' });
    const third = service.createTask({ title: 'Ship' });

    service.addDependency(third.id, first.id);
    service.addDependency(third.id, second.id);
    service.toggleTask(first.id);

    const shipId = service.tasks().find(t => t.title === 'Ship')!.id;
    expect(service.blockersFor(shipId).map(t => t.title)).toEqual(['Build']);
    expect(service.isBlocked(shipId)).toBe(true);

    service.toggleTask(second.id);
    expect(service.isBlocked(shipId)).toBe(false);
  });

  it('reports the reverse: what is waiting on this one', () => {
    const { service } = build();
    const base = service.createTask({ title: 'Design' });
    const a = service.createTask({ title: 'Build' });
    const b = service.createTask({ title: 'Document' });

    service.addDependency(a.id, base.id);
    service.addDependency(b.id, base.id);

    const baseId = service.tasks().find(t => t.title === 'Design')!.id;
    expect(service.blockedBy(baseId).map(t => t.title).sort()).toEqual(['Build', 'Document']);
  });

  it('refuses a loop rather than making one', () => {
    const { service } = build();
    const a = service.createTask({ title: 'A' });
    const b = service.createTask({ title: 'B' });

    expect(service.addDependency(b.id, a.id)).toBe(true);
    expect(service.addDependency(a.id, b.id)).toBe(false);

    const aId = service.tasks().find(t => t.title === 'A')!.id;
    expect(service.getTask(aId)!.dependencies ?? []).toEqual([]);
  });

  it('refuses a loop further down the chain', () => {
    const { service } = build();
    const a = service.createTask({ title: 'A' });
    const b = service.createTask({ title: 'B' });
    const c = service.createTask({ title: 'C' });

    service.addDependency(b.id, a.id);
    service.addDependency(c.id, b.id);
    // A waiting on C would close the ring A → C → B → A.
    expect(service.addDependency(a.id, c.id)).toBe(false);
  });

  it('removes one', () => {
    const { service } = build();
    const a = service.createTask({ title: 'A' });
    const b = service.createTask({ title: 'B' });

    service.addDependency(b.id, a.id);
    const bId = service.tasks().find(t => t.title === 'B')!.id;
    const aId = service.tasks().find(t => t.title === 'A')!.id;

    service.removeDependency(bId, aId);
    expect(service.getTask(bId)!.dependencies ?? []).toEqual([]);
    expect(service.isBlocked(bId)).toBe(false);
  });

  it('never enforces — a blocked task can still be ticked', () => {
    const { service } = build();
    const a = service.createTask({ title: 'A' });
    const b = service.createTask({ title: 'B' });
    service.addDependency(b.id, a.id);

    const bId = service.tasks().find(t => t.title === 'B')!.id;
    expect(service.isBlocked(bId)).toBe(true);

    service.toggleTask(bId);
    expect(service.getTask(bId)!.completed).toBe(true);
  });

  it('writes depends_on, so the chain is not only in this browser', () => {
    const { service, baserow } = build();
    const a = service.createTask({ title: 'A' });
    const b = service.createTask({ title: 'B' });
    baserow.updated.length = 0;

    service.addDependency(b.id, a.id);

    const written = baserow.updated.map(u => u.data['depends_on']).filter(Boolean);
    expect(written.length).toBeGreaterThan(0);
  });
});

describe('creating a task', () => {
  it('keeps a budget it was given', () => {
    // Every field this constructor forgets is silent data loss: the caller
    // passed it, the UI showed it once, and it was never stored.
    const { service } = build();
    const task = service.createTask({ title: 'Floors', budget: 900 });

    expect(service.getTask(task.id)?.budget).toBe(900);
  });
});
