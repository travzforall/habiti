import { Project, Task } from './project.model';
import {
  STANDALONE,
  USER_PROJECT_COLUMNS,
  USER_TASK_COLUMNS,
  UserProjectRow,
  UserTaskRow,
  fromProject,
  fromTask,
  keepWhatTheServerCannotStore,
  parseDateOnly,
  parseTags,
  serializeTags,
  statusFromRow,
  toDateOnly,
  toProject,
  toTask
} from './task-row.models';

/**
 * These tests exist because of one specific failure.
 *
 * The mappers wrote `name` where the table has `title`, and `status` where it
 * has `completed`. Baserow ignores unknown field names rather than rejecting
 * them, so every write returned 200 while silently dropping the data — nine
 * project rows on the server ended up with a null title and no task completion
 * ever persisted. Nothing in the app failed. Nothing in CI failed.
 *
 * The first describe block below is the guard: whatever the mappers produce,
 * every key must be a column that exists. `scripts/check-baserow-fields.mjs`
 * then ties those column lists back to the schema JSON, so the loop is closed
 * from the app all the way to the table definition.
 */
describe('user task/project row mapping', () => {
  const task: Task = {
    id: '42',
    projectId: '7',
    title: 'Write the launch post',
    description: 'Draft, edit, publish.',
    completed: false,
    status: 'in_progress',
    priority: 'urgent',
    dueDate: new Date(2026, 7, 20),
    createdAt: new Date(2026, 7, 1),
    estimatedHours: 2.5,
    actualHours: 1.25,
    tags: ['writing', 'launch'],
    assignee: 'Travon'
  };

  const project: Project = {
    id: '7',
    title: 'Launch the side project',
    description: 'Ship the first public version.',
    type: 'business',
    status: 'on-hold',
    priority: 'high',
    startDate: new Date(2026, 7, 1),
    dueDate: new Date(2026, 8, 30),
    createdAt: new Date(2026, 7, 1),
    updatedAt: new Date(2026, 7, 2),
    tasks: [],
    milestones: [],
    goals: [],
    tags: ['personal'],
    color: '#3b82f6',
    icon: '🚀',
    progress: 40
  };

  describe('every written key is a real column', () => {
    it('for tasks', () => {
      const written = Object.keys(fromTask(task, '6'));
      expect(written.length).toBeGreaterThan(0);
      for (const key of written) {
        expect(USER_TASK_COLUMNS as readonly string[])
          .withContext(`fromTask writes "${key}", which user_tasks does not have`)
          .toContain(key);
      }
    });

    it('for projects', () => {
      const written = Object.keys(fromProject(project, '6'));
      expect(written.length).toBeGreaterThan(0);
      for (const key of written) {
        expect(USER_PROJECT_COLUMNS as readonly string[])
          .withContext(`fromProject writes "${key}", which user_projects does not have`)
          .toContain(key);
      }
    });

    /** The exact regression: a project row must carry a title, under that name. */
    it('writes the project title as `title`, never `name`', () => {
      const row = fromProject(project, '6');
      expect(row['title']).toBe('Launch the side project');
      expect(row['name']).toBeUndefined();
    });
  });

  describe('single_select values', () => {
    /**
     * A value outside a select's options makes Baserow reject the WHOLE ROW.
     * `urgent` used to be translated to `critical`, which this table does not
     * have — so urgent tasks silently failed to save at all.
     */
    it('keeps `urgent` as `urgent`', () => {
      expect(fromTask(task, '6')['priority']).toBe('urgent');
    });

    it('writes `on_hold` without the scheduler table"s trailing comma', () => {
      expect(fromProject(project, '6')['status']).toBe('on_hold');
    });

    it('still reads a legacy `on_hold,` value', () => {
      const row: UserProjectRow = { id: 1, status: { id: 1, value: 'on_hold,' } };
      expect(toProject(row).status).toBe('on-hold');
    });

    it('falls back to personal for a type the select does not have', () => {
      const odd = { ...project, type: 'nonsense' as Project['type'] };
      expect(fromProject(odd, '6')['type']).toBe('personal');
      expect(toProject({ id: 1, type: 'nonsense' }).type).toBe('personal');
    });

    it('falls back to medium rather than sending an unknown priority', () => {
      const odd = { ...task, priority: 'critical' as Task['priority'] };
      expect(fromTask(odd, '6')['priority']).toBe('medium');
    });
  });

  describe('completion', () => {
    it('writes the boolean the table actually has', () => {
      const row = fromTask({ ...task, completed: true }, '6');
      expect(row['completed']).toBe(true);
      expect(row['status']).toBe('done');
    });

    it('reads completion back from the boolean', () => {
      const row: UserTaskRow = { id: 1, title: 'x', completed: true };
      const mapped = toTask(row);
      expect(mapped.completed).toBe(true);
      expect(mapped.status).toBe('done');
    });

    /**
     * `status` does not exist in the live table yet. Until it does, every read
     * has to derive it, and a task must not come back as `todo` when the row
     * says it is finished.
     */
    it('derives status when the column is absent', () => {
      expect(statusFromRow({ id: 1, completed: false })).toBe('todo');
      expect(statusFromRow({ id: 1, completed: true })).toBe('done');
      expect(statusFromRow({ id: 1, completed: false, status: 'blocked' })).toBe('blocked');
    });

    it('lets the boolean win over a stale status', () => {
      expect(statusFromRow({ id: 1, completed: true, status: 'todo' })).toBe('done');
    });
  });

  describe('project membership', () => {
    it('writes the project id', () => {
      expect(fromTask(task, '6')['project_id']).toBe('7');
    });

    it('writes standalone for a task with no project', () => {
      expect(fromTask({ ...task, projectId: STANDALONE }, '6')['project_id']).toBe(STANDALONE);
    });

    it('reads a null project_id as standalone', () => {
      expect(toTask({ id: 1, title: 'x', project_id: null }).projectId).toBe(STANDALONE);
    });

    it('reads a project id back', () => {
      expect(toTask({ id: 1, title: 'x', project_id: '7' }).projectId).toBe('7');
    });
  });

  describe('dates', () => {
    it('writes a due date as local YYYY-MM-DD', () => {
      expect(fromTask(task, '6')['due_date']).toBe('2026-08-20');
    });

    it('reads a date-only column as local midnight, not UTC', () => {
      const parsed = parseDateOnly('2026-08-20')!;
      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getMonth()).toBe(7);
      expect(parsed.getDate()).toBe(20);
    });

    it('round-trips through the two date helpers', () => {
      const date = new Date(2026, 0, 5);
      expect(parseDateOnly(toDateOnly(date)!)!.getTime()).toBe(date.getTime());
    });

    /** created_at is Baserow's own created-on type: read, never written. */
    it('never writes created_at or updated_at', () => {
      const row = fromTask(task, '6');
      expect(row['created_at']).toBeUndefined();
      expect(row['updated_at']).toBeUndefined();
    });

    it('reads createdAt from created_at, not from completed_at', () => {
      const mapped = toTask({
        id: 1,
        title: 'x',
        created_at: '2026-01-02T03:04:05Z',
        completed_at: '2026-05-05T00:00:00Z'
      });
      expect(mapped.createdAt.getUTCFullYear()).toBe(2026);
      expect(mapped.createdAt.getUTCMonth()).toBe(0);
      expect(mapped.createdAt.getUTCDate()).toBe(2);
    });
  });

  describe('tags', () => {
    it('round-trips comma separated free text', () => {
      expect(parseTags(serializeTags(['writing', 'launch']))).toEqual(['writing', 'launch']);
    });

    it('tolerates spacing and empty entries', () => {
      expect(parseTags(' a ,, b ')).toEqual(['a', 'b']);
    });

    it('writes tags, which the old mapper dropped entirely', () => {
      expect(fromTask(task, '6')['tags']).toBe('writing,launch');
    });
  });

  describe('numbers', () => {
    it('keeps two decimal places of hours', () => {
      const row = fromTask(task, '6');
      expect(row['estimated_hours']).toBe(2.5);
      expect(row['actual_hours']).toBe(1.25);
    });

    it('reads hours back from strings, which Baserow returns for decimals', () => {
      const mapped = toTask({ id: 1, title: 'x', estimated_hours: '2.50', actual_hours: '' });
      expect(mapped.estimatedHours).toBe(2.5);
      expect(mapped.actualHours).toBeUndefined();
    });
  });

  describe('a full round trip', () => {
    it('survives task → row → task', () => {
      const row = fromTask(task, '6') as unknown as UserTaskRow;
      const back = toTask({ ...row, id: 42 });

      expect(back.title).toBe(task.title);
      expect(back.projectId).toBe('7');
      expect(back.priority).toBe('urgent');
      expect(back.status).toBe('in_progress');
      expect(back.tags).toEqual(['writing', 'launch']);
      expect(back.estimatedHours).toBe(2.5);
      expect(toDateOnly(back.dueDate)).toBe('2026-08-20');
    });

    it('survives project → row → project', () => {
      const row = fromProject(project, '6') as unknown as UserProjectRow;
      const back = toProject({ ...row, id: 7 });

      expect(back.title).toBe(project.title);
      expect(back.type).toBe('business');
      expect(back.status).toBe('on-hold');
      expect(back.priority).toBe('high');
      expect(back.progress).toBe(40);
      expect(back.icon).toBe('🚀');
      expect(toDateOnly(back.dueDate)).toBe('2026-09-30');
    });
  });
});

describe('fields the server has no column for', () => {
  const local: Task = {
    ...toTask({ id: 1, title: 'x' } as UserTaskRow),
    milestoneId: 'm1',
    dependencies: ['t9'],
    progressPct: 40
  };

  it('keeps them when the column is missing from the row', () => {
    // A row from a table where db:setup has not run yet.
    const row = { id: 1, title: 'x', status: 'todo' } as UserTaskRow;
    const kept = keepWhatTheServerCannotStore(toTask(row), local, row);

    expect(kept.milestoneId).toBe('m1');
    expect(kept.dependencies).toEqual(['t9']);
    expect(kept.progressPct).toBe(40);
  });

  it('lets the server win once the column exists, even when it is empty', () => {
    // Emptied on another device: that is a real deletion, not a missing column.
    const row = {
      id: 1,
      title: 'x',
      milestone_id: '',
      depends_on: '',
      progress_pct: null
    } as unknown as UserTaskRow;
    const kept = keepWhatTheServerCannotStore(toTask(row), local, row);

    expect(kept.milestoneId).toBeUndefined();
    expect(kept.dependencies).toEqual([]);
    expect(kept.progressPct).toBeUndefined();
  });

  it('takes the server value when there is one', () => {
    const row = {
      id: 1,
      title: 'x',
      milestone_id: 'm2',
      depends_on: 't1,t2',
      progress_pct: 75
    } as unknown as UserTaskRow;
    const kept = keepWhatTheServerCannotStore(toTask(row), local, row);

    expect(kept.milestoneId).toBe('m2');
    expect(kept.dependencies).toEqual(['t1', 't2']);
    expect(kept.progressPct).toBe(75);
  });
});
