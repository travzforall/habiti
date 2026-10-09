import { Milestone } from './project.model';
import {
  MILESTONE_COLUMNS,
  MilestoneRow,
  fromMilestone,
  toMilestone
} from './milestone-row.models';

/**
 * The same guard task-row.models.spec.ts exists for: Baserow with
 * `user_field_names=true` DROPS a field name it does not recognise instead of
 * rejecting the write, so a typo here is silent data loss. Every key the mapper
 * produces must be a column that exists.
 */

function milestone(overrides: Partial<Milestone> = {}): Milestone {
  return {
    id: '1',
    projectId: '15',
    title: 'MVP Release',
    targetDate: new Date(2026, 8, 4),
    completed: false,
    sortOrder: 2,
    progress: 0,
    tasks: [],
    ...overrides
  };
}

describe('fromMilestone', () => {
  it('writes only columns the table has', () => {
    const keys = Object.keys(fromMilestone(milestone(), '1'));
    const unknown = keys.filter(key => !(MILESTONE_COLUMNS as readonly string[]).includes(key));

    expect(unknown).toEqual([]);
  });

  it('sends a date as a plain day, not an instant', () => {
    const row = fromMilestone(milestone({ startDate: new Date(2026, 6, 1) }), '1');

    // '2026-07-01', never an ISO string — the column is a date, and an instant
    // would land on the previous day for anyone west of Greenwich.
    expect(row['start_date']).toBe('2026-07-01');
    expect(row['target_date']).toBe('2026-09-04');
  });

  it('sends no start date as null rather than a broken string', () => {
    expect(fromMilestone(milestone(), '1')['start_date']).toBeNull();
  });

  it('serialises prerequisites as a comma separated list', () => {
    expect(fromMilestone(milestone({ dependsOn: ['4', '7'] }), '1')['depends_on']).toBe('4,7');
    expect(fromMilestone(milestone(), '1')['depends_on']).toBe('');
  });

  it('defaults the status, because an unknown one fails the whole row', () => {
    expect(fromMilestone(milestone(), '1')['status']).toBe('planned');
    expect(fromMilestone(milestone({ status: 'at_risk' }), '1')['status']).toBe('at_risk');
  });
});

describe('toMilestone', () => {
  it('reads a row back into a milestone', () => {
    const row: MilestoneRow = {
      id: 42,
      title: 'MVP Release',
      project_id: '15',
      description: 'Everything a first user needs',
      start_date: '2026-07-01',
      target_date: '2026-09-04',
      completed: false,
      status: { id: 1, value: 'at_risk' },
      owner: 'Travon',
      definition_of_done: 'A stranger can pay',
      colour: '#8b5cf6',
      sort_order: 2,
      progress: 40,
      depends_on: '40,41'
    };

    const result = toMilestone(row);
    expect(result.id).toBe('42');
    expect(result.title).toBe('MVP Release');
    expect(result.startDate).toEqual(new Date(2026, 6, 1));
    expect(result.targetDate).toEqual(new Date(2026, 8, 4));
    expect(result.status).toBe('at_risk');
    expect(result.owner).toBe('Travon');
    expect(result.definitionOfDone).toBe('A stranger can pay');
    expect(result.dependsOn).toEqual(['40', '41']);
    expect(result.sortOrder).toBe(2);
  });

  it('survives a row with a target date missing', () => {
    // Milestone requires a targetDate, so this must produce one rather than an
    // Invalid Date that poisons every comparison the timeline makes.
    const result = toMilestone({ id: 1, title: 'x' });

    expect(result.targetDate instanceof Date).toBe(true);
    expect(Number.isNaN(result.targetDate.getTime())).toBe(false);
  });

  it('falls back to planned for a status it does not know', () => {
    expect(toMilestone({ id: 1, status: 'nonsense' }).status).toBe('planned');
  });

  it('round-trips', () => {
    const original = milestone({
      startDate: new Date(2026, 6, 1),
      status: 'active',
      owner: 'Travon',
      definitionOfDone: 'Signed off',
      colour: '#0ea5e9',
      dependsOn: ['9']
    });

    const back = toMilestone({ id: 1, ...fromMilestone(original, '1') } as MilestoneRow);

    expect(back.title).toBe(original.title);
    expect(back.startDate).toEqual(original.startDate);
    expect(back.targetDate).toEqual(original.targetDate);
    expect(back.status).toBe(original.status);
    expect(back.owner).toBe(original.owner);
    expect(back.definitionOfDone).toBe(original.definitionOfDone);
    expect(back.colour).toBe(original.colour);
    expect(back.dependsOn).toEqual(original.dependsOn);
    expect(back.sortOrder).toBe(original.sortOrder);
  });
});
