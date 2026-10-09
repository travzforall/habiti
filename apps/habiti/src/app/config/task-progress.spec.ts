import { ChecklistItem, Task } from '../models/project.model';
import {
  IN_PROGRESS_FLOOR,
  checklistProgress,
  projectProgress,
  taskProgress
} from './task-progress';

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: '1',
    projectId: 'standalone',
    title: 'A task',
    completed: false,
    status: 'todo',
    priority: 'medium',
    createdAt: new Date(),
    ...overrides
  };
}

function items(done: number, total: number): ChecklistItem[] {
  return Array.from({ length: total }, (_, i) => ({
    id: String(i),
    taskId: '1',
    title: `item ${i}`,
    completed: i < done,
    sortOrder: i
  }));
}

describe('taskProgress', () => {
  it('is 0 for an untouched task', () => {
    expect(taskProgress(task())).toBe(0);
  });

  it('is 100 when done, whatever else is set', () => {
    expect(taskProgress(task({ completed: true, status: 'done' }))).toBe(100);
    // A finished task with unticked items is still finished.
    expect(taskProgress(task({ completed: true, checklist: items(1, 4) }))).toBe(100);
  });

  it('uses the checklist when there is one', () => {
    expect(taskProgress(task({ checklist: items(1, 4) }))).toBe(25);
    expect(taskProgress(task({ checklist: items(3, 4) }))).toBe(75);
  });

  it('lets the checklist beat a hand-set percentage', () => {
    expect(taskProgress(task({ progressPct: 90, checklist: items(1, 4) }))).toBe(25);
  });

  it('uses the hand-set percentage when there is no checklist', () => {
    expect(taskProgress(task({ progressPct: 60 }))).toBe(60);
  });

  it('clamps a percentage from outside the range', () => {
    expect(taskProgress(task({ progressPct: 140 }))).toBe(100);
    expect(taskProgress(task({ progressPct: -5 }))).toBe(0);
  });

  it('gives in-progress a visible floor rather than zero', () => {
    expect(taskProgress(task({ status: 'in_progress' }))).toBe(IN_PROGRESS_FLOOR);
  });

  it('does not give blocked the floor — blocked is not underway', () => {
    expect(taskProgress(task({ status: 'blocked' }))).toBe(0);
  });

  it('ignores hours entirely', () => {
    const burned = task({ estimatedHours: 2, actualHours: 8 });
    expect(taskProgress(burned)).toBe(0);
  });
});

describe('checklistProgress', () => {
  it('is 0 for an empty list rather than NaN', () => {
    expect(checklistProgress([])).toBe(0);
  });

  it('rounds to whole percent', () => {
    expect(checklistProgress(items(1, 3))).toBe(33);
  });
});

describe('projectProgress', () => {
  it('is 0 with no tasks', () => {
    expect(projectProgress([])).toBe(0);
  });

  it('is the plain mean when estimates are missing', () => {
    expect(projectProgress([task({ completed: true }), task()])).toBe(50);
  });

  it('weights by estimate when every task has one', () => {
    const big = task({ id: 'a', completed: true, estimatedHours: 9 });
    const small = task({ id: 'b', estimatedHours: 1 });
    expect(projectProgress([big, small])).toBe(90);
  });

  it('falls back to the plain mean when only some tasks are estimated', () => {
    const big = task({ id: 'a', completed: true, estimatedHours: 9 });
    const small = task({ id: 'b' });
    expect(projectProgress([big, small])).toBe(50);
  });
});
