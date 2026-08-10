import {
  fromProject,
  fromTask,
  parseDateOnly,
  selectValue,
  toDateOnly,
  toProject,
  toTask
} from './task-row.models';
import { Project, Task } from './project.model';

/**
 * These mappings are the seam between the app's vocabulary and tables built for
 * something else. Baserow REJECTS a value outside a single-select's options, so
 * a wrong mapping fails the entire write — not just that column — and the user
 * sees a task that refuses to save with no explanation.
 */
function task(over: Partial<Task> = {}): Task {
  return {
    id: '42',
    projectId: 'standalone',
    title: 'Write the thing',
    completed: false,
    priority: 'medium',
    createdAt: new Date(2026, 7, 9),
    ...over
  };
}

function project(over: Partial<Project> = {}): Project {
  return {
    id: '7',
    title: 'Ship it',
    status: 'active',
    priority: 'high',
    createdAt: new Date(2026, 7, 9),
    updatedAt: new Date(2026, 7, 9),
    tasks: [],
    milestones: [],
    goals: [],
    progress: 0,
    ...over
  };
}

describe('task and project row mapping', () => {
  describe('dates', () => {
    it('parses a date as LOCAL midnight, not UTC', () => {
      // new Date('2026-08-09') is midnight UTC, which is Aug 8 for anyone west
      // of Greenwich — a due date would render a day early.
      const parsed = parseDateOnly('2026-08-09')!;
      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getMonth()).toBe(7);
      expect(parsed.getDate()).toBe(9);
    });

    it('handles a full timestamp and empty values', () => {
      expect(parseDateOnly('2026-08-09T13:45:00Z')!.getDate()).toBe(9);
      expect(parseDateOnly(null)).toBeUndefined();
      expect(parseDateOnly('')).toBeUndefined();
      expect(parseDateOnly('nonsense')).toBeUndefined();
    });

    it('formats from local parts, so the day cannot shift', () => {
      expect(toDateOnly(new Date(2026, 0, 1))).toBe('2026-01-01');
      expect(toDateOnly(undefined)).toBeNull();
    });

    it('round-trips', () => {
      expect(toDateOnly(parseDateOnly('2026-12-31'))).toBe('2026-12-31');
    });
  });

  it('unwraps a Baserow select cell', () => {
    expect(selectValue({ id: 1, value: 'high' })).toBe('high');
    expect(selectValue('high')).toBe('high');
    expect(selectValue(undefined)).toBe('');
  });

  describe('tasks', () => {
    it('maps urgent to the option the table actually has', () => {
      // The app says "urgent"; the column offers "critical". An unmapped value
      // is rejected outright.
      expect(fromTask(task({ priority: 'urgent' }), '6')['priority']).toBe('critical');
      expect(toTask({ id: 1, priority: 'critical' }).priority).toBe('urgent');
    });

    it('maps the other priorities unchanged', () => {
      for (const p of ['low', 'medium', 'high'] as const) {
        expect(fromTask(task({ priority: p }), '6')['priority']).toBe(p);
      }
    });

    it('expresses completion through the status column', () => {
      expect(fromTask(task({ completed: true }), '6')['status']).toBe('completed');
      expect(fromTask(task({ completed: false }), '6')['status']).toBe('pending');
      expect(toTask({ id: 1, status: { id: 2, value: 'completed' } }).completed).toBe(true);
      expect(toTask({ id: 1, status: 'in_progress' }).completed).toBe(false);
    });

    it('stamps the owner and a namespaced key', () => {
      const row = fromTask(task(), '6');
      expect(row['user_id']).toBe('6');
      // Distinct from automation rows sharing this table.
      expect(row['task_id']).toBe('u6-42');
    });

    it('does not send tags, which the column cannot hold', () => {
      // `tags` is a multiple_select limited to bug/feature/improvement/docs;
      // arbitrary user tags would fail the write.
      const row = fromTask(task({ tags: ['personal', 'errand'] }), '6');
      expect('tags' in row).toBe(false);
    });

    it('falls back to medium for an unknown priority', () => {
      expect(toTask({ id: 1, priority: 'whatever' }).priority).toBe('medium');
    });

    it('reads numbers that arrive as strings', () => {
      const mapped = toTask({ id: 1, estimated_hours: '2.5', actual_hours: '' });
      expect(mapped.estimatedHours).toBe(2.5);
      expect(mapped.actualHours).toBeUndefined();
    });
  });

  describe('projects', () => {
    it('matches the typo in the on-hold option exactly', () => {
      // The Baserow option is literally "on_hold," — trailing comma and all.
      // Sending "on-hold" or "on_hold" is rejected.
      expect(fromProject(project({ status: 'on-hold' }), '6')['status']).toBe('on_hold,');
      expect(toProject({ id: 1, status: 'on_hold,' }).status).toBe('on-hold');
      // Tolerated on the way in, in case the typo is ever fixed.
      expect(toProject({ id: 1, status: 'on_hold' }).status).toBe('on-hold');
    });

    it('parks cancelled as on-hold rather than failing the save', () => {
      // There is no `cancelled` option. Losing the distinction beats a write
      // that silently never succeeds.
      expect(fromProject(project({ status: 'cancelled' }), '6')['status']).toBe('on_hold,');
    });

    it('maps the title to the table\'s name column', () => {
      expect(fromProject(project({ title: 'Ship it' }), '6')['name']).toBe('Ship it');
      expect(toProject({ id: 1, name: 'Ship it' }).title).toBe('Ship it');
    });

    it('stamps the owner', () => {
      expect(fromProject(project(), '6')['user_id']).toBe('6');
    });

    it('uses target_date for the due date', () => {
      const row = fromProject(project({ dueDate: new Date(2026, 11, 25) }), '6');
      expect(row['target_date']).toBe('2026-12-25');
      expect(toProject({ id: 1, target_date: '2026-12-25' }).dueDate!.getMonth()).toBe(11);
    });

    it('defaults an unknown status to planning', () => {
      expect(toProject({ id: 1, status: 'nonsense' }).status).toBe('planning');
    });
  });
});
