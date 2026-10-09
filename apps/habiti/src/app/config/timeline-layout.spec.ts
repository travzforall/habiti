import { Milestone, Task } from '../models/project.model';
import { layoutTimeline, milestoneProgress } from './timeline-layout';

function milestone(id: string, target: Date, overrides: Partial<Milestone> = {}): Milestone {
  return {
    id,
    projectId: 'p1',
    title: id,
    targetDate: target,
    completed: false,
    sortOrder: 1,
    tasks: [],
    progress: 0,
    ...overrides
  };
}

function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    projectId: 'p1',
    title: id,
    completed: false,
    status: 'todo',
    priority: 'medium',
    createdAt: new Date(2026, 0, 1),
    ...overrides
  };
}

const JUNE = new Date(2026, 5, 15);
const SEPT = new Date(2026, 8, 20);

describe('layoutTimeline', () => {
  it('returns null when the project has no dates at all', () => {
    expect(layoutTimeline({ milestones: [], tasks: [] })).toBeNull();
  });

  it('spans every date it knows about, padded to whole months', () => {
    const layout = layoutTimeline({
      milestones: [milestone('m1', SEPT, { startDate: JUNE })],
      tasks: [],
      today: JUNE
    })!;

    expect(layout.start.getMonth()).toBe(5); // June
    expect(layout.start.getDate()).toBe(1);
    expect(layout.months.map(month => month.label)).toEqual(['Jun', 'Jul', 'Aug', 'Sep']);
  });

  it('includes task due dates in the range, so nothing falls off the end', () => {
    const layout = layoutTimeline({
      milestones: [milestone('m1', JUNE)],
      tasks: [task('t1', { dueDate: new Date(2026, 10, 3) })],
      today: JUNE
    })!;

    expect(layout.months[layout.months.length - 1].label).toBe('Nov');
  });

  it('gives a one-month project two columns rather than one', () => {
    const layout = layoutTimeline({
      milestones: [milestone('m1', new Date(2026, 5, 20), { startDate: new Date(2026, 5, 2) })],
      tasks: [],
      today: JUNE
    })!;

    expect(layout.months.length).toBe(2);
  });

  it('marks the year only where it changes', () => {
    const layout = layoutTimeline({
      milestones: [milestone('m1', new Date(2027, 1, 1), { startDate: new Date(2026, 10, 1) })],
      tasks: [],
      today: JUNE
    })!;

    const flagged = layout.months.filter(month => month.showYear).map(month => month.year);
    expect(flagged).toEqual(['2026', '2027']);
  });

  describe('bars', () => {
    it('runs from start to target', () => {
      const layout = layoutTimeline({
        milestones: [milestone('m1', SEPT, { startDate: JUNE })],
        tasks: [],
        today: JUNE
      })!;

      const row = layout.rows[0];
      expect(row.bar).toBeDefined();
      expect(row.bar!.left).toBeGreaterThan(0);
      expect(row.bar!.left + row.bar!.width).toBeCloseTo(row.targetLeft!, 5);
    });

    it('is still visible when start and target are the same day', () => {
      const day = new Date(2026, 5, 10);
      const layout = layoutTimeline({
        milestones: [milestone('m1', day, { startDate: day })],
        tasks: [],
        today: day
      })!;

      expect(layout.rows[0].bar!.width).toBeGreaterThan(0);
    });

    it('has no bar without a start — that milestone is a point in time', () => {
      const layout = layoutTimeline({ milestones: [milestone('m1', SEPT)], tasks: [], today: JUNE })!;
      expect(layout.rows[0].bar).toBeUndefined();
      expect(layout.rows[0].targetLeft).toBeGreaterThan(0);
    });

    it('keeps every position inside the track', () => {
      const layout = layoutTimeline({
        milestones: [milestone('m1', SEPT, { startDate: JUNE })],
        tasks: [task('t1', { dueDate: new Date(2026, 6, 4) })],
        today: JUNE
      })!;

      for (const row of layout.rows) {
        expect(row.targetLeft).toBeGreaterThanOrEqual(0);
        expect(row.targetLeft).toBeLessThanOrEqual(100);
        for (const marker of row.markers) {
          expect(marker.left).toBeGreaterThanOrEqual(0);
          expect(marker.left).toBeLessThanOrEqual(100);
        }
      }
    });
  });

  describe('today', () => {
    it('is placed when it falls inside the range', () => {
      const layout = layoutTimeline({
        milestones: [milestone('m1', SEPT, { startDate: JUNE })],
        tasks: [],
        today: new Date(2026, 6, 15)
      })!;

      expect(layout.todayLeft).toBeGreaterThan(0);
      expect(layout.todayLeft).toBeLessThan(100);
    });

    it('is null when the whole project is in the past', () => {
      const layout = layoutTimeline({
        milestones: [milestone('m1', new Date(2025, 1, 1), { startDate: new Date(2025, 0, 1) })],
        tasks: [],
        today: new Date(2026, 5, 1)
      })!;

      expect(layout.todayLeft).toBeNull();
    });
  });

  describe('tasks on a row', () => {
    it('puts a task under the milestone it belongs to', () => {
      const layout = layoutTimeline({
        milestones: [milestone('m1', SEPT, { startDate: JUNE })],
        tasks: [task('t1', { milestoneId: 'm1', dueDate: new Date(2026, 6, 1) })],
        today: JUNE
      })!;

      expect(layout.rows[0].markers.length).toBe(1);
      expect(layout.rows[0].taskCount).toBe(1);
      expect(layout.unassigned.length).toBe(0);
    });

    it('gives a milestone-less task its own row rather than hiding it', () => {
      const layout = layoutTimeline({
        milestones: [milestone('m1', SEPT, { startDate: JUNE })],
        tasks: [task('t1', { dueDate: new Date(2026, 6, 1) })],
        today: JUNE
      })!;

      expect(layout.unassigned.length).toBe(1);
    });

    it('shows a task whose milestone is not here, rather than losing it', () => {
      // The milestone was deleted, or lives on a device that has not synced.
      // The task must still appear — it is real work with a real due date.
      const layout = layoutTimeline({
        milestones: [milestone('m1', SEPT, { startDate: JUNE })],
        tasks: [task('t1', { milestoneId: 'gone', dueDate: new Date(2026, 6, 1) })],
        today: JUNE
      })!;

      expect(layout.unassigned.length).toBe(1);
      expect(layout.rows[0].taskCount).toBe(0);
    });

    it('shows every task when there are no milestones at all', () => {
      const layout = layoutTimeline({
        milestones: [],
        tasks: [
          task('t1', { milestoneId: 'gone', dueDate: new Date(2026, 6, 1) }),
          task('t2', { dueDate: new Date(2026, 7, 1) })
        ],
        projectStart: JUNE,
        projectDue: SEPT,
        today: JUNE
      })!;

      expect(layout.unassigned.length).toBe(2);
    });

    it('flags an overdue task, and never a finished one', () => {
      const layout = layoutTimeline({
        milestones: [milestone('m1', SEPT, { startDate: JUNE })],
        tasks: [
          task('late', { milestoneId: 'm1', dueDate: new Date(2026, 5, 20) }),
          task('done', { milestoneId: 'm1', dueDate: new Date(2026, 5, 20), completed: true })
        ],
        today: new Date(2026, 6, 1)
      })!;

      const markers = layout.rows[0].markers;
      expect(markers.find(marker => marker.id === 'late')!.overdue).toBe(true);
      expect(markers.find(marker => marker.id === 'done')!.overdue).toBe(false);
    });

    it('does not place a task with no due date', () => {
      const layout = layoutTimeline({
        milestones: [milestone('m1', SEPT, { startDate: JUNE })],
        tasks: [task('t1', { milestoneId: 'm1' })],
        today: JUNE
      })!;

      expect(layout.rows[0].taskCount).toBe(1);
      expect(layout.rows[0].markers.length).toBe(0);
    });
  });

  it('orders rows by sortOrder, then by target date', () => {
    const layout = layoutTimeline({
      milestones: [
        milestone('later', new Date(2026, 8, 1), { sortOrder: 1 }),
        milestone('first', new Date(2026, 6, 1), { sortOrder: 1 }),
        milestone('last', new Date(2026, 7, 1), { sortOrder: 9 })
      ],
      tasks: [],
      today: JUNE
    })!;

    expect(layout.rows.map(row => row.milestone.id)).toEqual(['first', 'later', 'last']);
  });

  it('flags an overdue milestone, and never a completed one', () => {
    const layout = layoutTimeline({
      milestones: [
        milestone('late', new Date(2026, 5, 1)),
        milestone('shipped', new Date(2026, 5, 1), { completed: true })
      ],
      tasks: [],
      today: new Date(2026, 7, 1)
    })!;

    expect(layout.rows.find(row => row.milestone.id === 'late')!.overdue).toBe(true);
    expect(layout.rows.find(row => row.milestone.id === 'shipped')!.overdue).toBe(false);
  });
});

describe('milestoneProgress', () => {
  const target = new Date(2026, 8, 1);

  it('is its tasks, when it has some', () => {
    const tasks = [task('a', { completed: true }), task('b')];
    expect(milestoneProgress(milestone('m', target), tasks)).toBe(50);
  });

  it('is the flag when it has none', () => {
    expect(milestoneProgress(milestone('m', target), [])).toBe(0);
    expect(milestoneProgress(milestone('m', target, { completed: true }), [])).toBe(100);
  });

  it('is 100 when marked done, whatever the tasks say', () => {
    expect(milestoneProgress(milestone('m', target, { completed: true }), [task('a')])).toBe(100);
  });

  it('never guesses from the date — time passing is not progress', () => {
    const overdue = milestone('m', new Date(2020, 0, 1));
    expect(milestoneProgress(overdue, [task('a')])).toBe(0);
  });
});

describe('marker lanes', () => {
  const JUN = new Date(2026, 5, 15);
  const SEP2 = new Date(2026, 8, 20);

  function withTasks(dueDates: Date[]) {
    return layoutTimeline({
      milestones: [milestone('m1', SEP2, { startDate: JUN })],
      tasks: dueDates.map((due, index) =>
        task('t' + index, { milestoneId: 'm1', dueDate: due, title: 'Task ' + index })
      ),
      today: JUN
    })!;
  }

  it('keeps well-spaced tasks on one line', () => {
    const layout = withTasks([new Date(2026, 5, 20), new Date(2026, 7, 20)]);
    expect(layout.rows[0].markers.every(marker => marker.lane === 0)).toBe(true);
    expect(layout.rows[0].lanes).toBe(1);
  });

  it('drops a label to the next lane when it would sit on the one before', () => {
    // Two days apart: their names would print over each other.
    const layout = withTasks([new Date(2026, 5, 20), new Date(2026, 5, 22)]);
    expect(layout.rows[0].markers.map(marker => marker.lane)).toEqual([0, 1]);
    expect(layout.rows[0].lanes).toBe(2);
  });

  it('reuses a lane once there is room again', () => {
    const layout = withTasks([
      new Date(2026, 5, 20),
      new Date(2026, 5, 22),
      new Date(2026, 8, 1)
    ]);
    // The third is far from both, so it goes back on the top line.
    expect(layout.rows[0].markers.map(marker => marker.lane)).toEqual([0, 1, 0]);
    expect(layout.rows[0].lanes).toBe(2);
  });

  it('orders markers left to right, whatever order the tasks arrived in', () => {
    const layout = withTasks([new Date(2026, 8, 1), new Date(2026, 5, 20)]);
    const lefts = layout.rows[0].markers.map(marker => marker.left);
    expect(lefts[0]).toBeLessThan(lefts[1]);
  });

  it('reports one lane even when a row has no tasks, so the row still has height', () => {
    const layout = layoutTimeline({
      milestones: [milestone('m1', SEP2, { startDate: JUN })],
      tasks: [],
      today: JUN
    })!;
    expect(layout.rows[0].lanes).toBe(1);
  });

  it('lanes the unassigned row too', () => {
    const layout = layoutTimeline({
      milestones: [milestone('m1', SEP2, { startDate: JUN })],
      tasks: [
        task('a', { dueDate: new Date(2026, 5, 20) }),
        task('b', { dueDate: new Date(2026, 5, 21) })
      ],
      today: JUN
    })!;
    expect(layout.unassignedLanes).toBe(2);
  });

  it('gives a long title its own lane where a short one would have fitted', () => {
    const layout = layoutTimeline({
      milestones: [milestone('m1', SEP2, { startDate: JUN })],
      tasks: [
        task('a', { milestoneId: 'm1', dueDate: new Date(2026, 5, 20), title: 'Ship' }),
        task('b', {
          milestoneId: 'm1',
          dueDate: new Date(2026, 5, 28),
          title: 'Gate the paid features behind the plan'
        })
      ],
      today: JUN,
      trackWidthPx: 600
    })!;

    // Eight days apart on a narrow track: the first label is still running.
    expect(layout.rows[0].markers.map(marker => marker.lane)).toEqual([0, 1]);
  });

  it('keeps a flipped label off the one before it', () => {
    // The reported bug. The second marker is past flipLabelsAfter, so its label
    // is drawn LEFT of its dot — straight into the first label, even though the
    // dots are a comfortable distance apart.
    const layout = layoutTimeline({
      milestones: [milestone('m1', SEP2, { startDate: JUN })],
      tasks: [
        task('a', { milestoneId: 'm1', dueDate: new Date(2026, 7, 5), title: 'Email receipts' }),
        task('b', {
          milestoneId: 'm1',
          dueDate: new Date(2026, 7, 25),
          title: 'Run a two-week beta'
        })
      ],
      today: JUN,
      trackWidthPx: 600
    })!;

    const [first, second] = layout.rows[0].markers;
    expect(second.flipLabel).toBe(true);
    // Either they are on different lanes, or the flipped label starts after the
    // first one ends. Both are fine; overlapping is not.
    const firstEnds = first.left + first.labelWidth;
    const secondStarts = second.left - second.labelWidth;
    expect(second.lane !== first.lane || secondStarts >= firstEnds).toBe(true);
  });

  it('respects a wider gap when labels need more room', () => {
    const layout = layoutTimeline({
      milestones: [milestone('m1', SEP2, { startDate: JUN })],
      tasks: [
        task('a', { milestoneId: 'm1', dueDate: new Date(2026, 5, 20) }),
        task('b', { milestoneId: 'm1', dueDate: new Date(2026, 6, 20) })
      ],
      today: JUN,
      minMarkerGap: 90
    })!;
    expect(layout.rows[0].lanes).toBe(2);
  });
});

describe('labels near the end of the track', () => {
  const JUN2 = new Date(2026, 5, 1);
  const DEC = new Date(2026, 11, 20);

  it('flips a task label that would run off the right edge', () => {
    const layout = layoutTimeline({
      milestones: [milestone('m1', DEC, { startDate: JUN2 })],
      tasks: [
        task('early', { milestoneId: 'm1', dueDate: new Date(2026, 6, 1) }),
        task('late', { milestoneId: 'm1', dueDate: new Date(2026, 11, 10) })
      ],
      today: JUN2
    })!;

    const markers = layout.rows[0].markers;
    expect(markers.find(marker => marker.id === 'early')!.flipLabel).toBe(false);
    expect(markers.find(marker => marker.id === 'late')!.flipLabel).toBe(true);
  });

  it('flips a start-less milestone"s name near the end', () => {
    const layout = layoutTimeline({
      milestones: [
        milestone('early', new Date(2026, 6, 1), { sortOrder: 1 }),
        milestone('late', new Date(2026, 11, 10), { sortOrder: 2 })
      ],
      tasks: [task('t', { dueDate: JUN2 })],
      today: JUN2
    })!;

    expect(layout.rows.find(row => row.milestone.id === 'early')!.flipTitle).toBe(false);
    expect(layout.rows.find(row => row.milestone.id === 'late')!.flipTitle).toBe(true);
  });

  it('takes the threshold from the caller', () => {
    const layout = layoutTimeline({
      milestones: [milestone('m1', DEC, { startDate: JUN2 })],
      tasks: [task('mid', { milestoneId: 'm1', dueDate: new Date(2026, 8, 1) })],
      today: JUN2,
      flipLabelsAfter: 10
    })!;

    expect(layout.rows[0].markers[0].flipLabel).toBe(true);
  });
});

describe('the quarter band', () => {
  it('names the quarters the range falls in', () => {
    const layout = layoutTimeline({
      milestones: [milestone('m1', new Date(2026, 8, 20), { startDate: new Date(2026, 5, 5) })],
      tasks: [],
      today: new Date(2026, 6, 1)
    })!;

    // June is Q2, July–September is Q3.
    expect(layout.quarters.map(quarter => quarter.label)).toEqual(['Q2', 'Q3']);
  });

  it('clips the first and last quarter to the range', () => {
    const layout = layoutTimeline({
      milestones: [milestone('m1', new Date(2026, 8, 20), { startDate: new Date(2026, 7, 5) })],
      tasks: [],
      today: new Date(2026, 7, 10)
    })!;

    // August and September are the back two thirds of Q3, so the band starts
    // at 0 and covers the whole track rather than hanging off the left.
    expect(layout.quarters.length).toBe(1);
    expect(layout.quarters[0].left).toBe(0);
    expect(layout.quarters[0].width).toBeCloseTo(100, 5);
  });

  it('lines quarter boundaries up with a month boundary', () => {
    const layout = layoutTimeline({
      milestones: [milestone('m1', new Date(2027, 1, 1), { startDate: new Date(2026, 5, 1) })],
      tasks: [],
      today: new Date(2026, 6, 1)
    })!;

    const monthEdges = layout.months.map(month => Math.round(month.left * 100) / 100);
    for (const quarter of layout.quarters) {
      expect(monthEdges).toContain(Math.round(quarter.left * 100) / 100);
    }
  });

  it('marks the year only where it changes', () => {
    const layout = layoutTimeline({
      milestones: [milestone('m1', new Date(2027, 4, 1), { startDate: new Date(2026, 9, 1) })],
      tasks: [],
      today: new Date(2026, 10, 1)
    })!;

    expect(layout.quarters.filter(quarter => quarter.showYear).map(q => q.year)).toEqual([
      '2026',
      '2027'
    ]);
  });

  it('spans every quarter of a long project, in order', () => {
    const layout = layoutTimeline({
      milestones: [milestone('m1', new Date(2027, 2, 31), { startDate: new Date(2026, 0, 1) })],
      tasks: [],
      today: new Date(2026, 6, 1)
    })!;

    expect(layout.quarters.map(q => `${q.label} ${q.year}`)).toEqual([
      'Q1 2026',
      'Q2 2026',
      'Q3 2026',
      'Q4 2026',
      'Q1 2027'
    ]);
  });

  describe('dense months', () => {
    it('keeps month labels for a project of a year or less', () => {
      const layout = layoutTimeline({
        milestones: [milestone('m1', new Date(2026, 11, 1), { startDate: new Date(2026, 0, 1) })],
        tasks: [],
        today: new Date(2026, 6, 1)
      })!;

      expect(layout.months.length).toBeLessThanOrEqual(12);
      expect(layout.denseMonths).toBe(false);
    });

    it('drops them once the columns are too narrow to read', () => {
      const layout = layoutTimeline({
        milestones: [milestone('m1', new Date(2028, 0, 1), { startDate: new Date(2026, 0, 1) })],
        tasks: [],
        today: new Date(2026, 6, 1)
      })!;

      expect(layout.denseMonths).toBe(true);
      // The quarters still label themselves — that is what carries the axis.
      expect(layout.quarters.length).toBeGreaterThan(4);
    });
  });
});

describe('a windowed timeline', () => {
  const project = {
    milestones: [
      milestone('early', new Date(2026, 2, 31), { startDate: new Date(2026, 0, 15) }),
      // Ends the 20th, not the 1st: a milestone ending exactly ON the window
      // edge is not clipped, and that boundary deserves its own test below.
      milestone('spanning', new Date(2026, 9, 20), { startDate: new Date(2026, 1, 1), sortOrder: 2 }),
      milestone('late', new Date(2026, 11, 20), { startDate: new Date(2026, 10, 1), sortOrder: 3 })
    ],
    tasks: [
      task('inside', { milestoneId: 'spanning', dueDate: new Date(2026, 6, 15) }),
      task('before', { milestoneId: 'spanning', dueDate: new Date(2026, 1, 10) }),
      task('after', { milestoneId: 'spanning', dueDate: new Date(2026, 10, 10) })
    ],
    today: new Date(2026, 6, 1)
  };

  /** July, August, September. */
  const q3 = { start: new Date(2026, 6, 1), months: 3 };

  it('shows exactly the months asked for', () => {
    const layout = layoutTimeline({ ...project, window: q3 })!;
    expect(layout.months.map(month => month.label)).toEqual(['Jul', 'Aug', 'Sep']);
  });

  it('spans the whole project when no window is given', () => {
    const layout = layoutTimeline(project)!;
    expect(layout.months.length).toBe(12);
  });

  it('clips a bar that runs through the window, and says which ends were cut', () => {
    const layout = layoutTimeline({ ...project, window: q3 })!;
    const row = layout.rows.find(item => item.milestone.id === 'spanning')!;

    expect(row.bar).toBeDefined();
    expect(row.bar!.left).toBe(0);
    expect(row.bar!.left + row.bar!.width).toBe(100);
    expect(row.bar!.continuesBefore).toBe(true);
    expect(row.bar!.continuesAfter).toBe(true);
  });

  it('does not draw a bar that is entirely outside', () => {
    const layout = layoutTimeline({ ...project, window: q3 })!;
    expect(layout.rows.find(item => item.milestone.id === 'early')!.bar).toBeUndefined();
    expect(layout.rows.find(item => item.milestone.id === 'late')!.bar).toBeUndefined();
  });

  it('leaves the row in place, so a milestone never vanishes from the list', () => {
    const layout = layoutTimeline({ ...project, window: q3 })!;
    expect(layout.rows.map(row => row.milestone.id)).toEqual(['early', 'spanning', 'late']);
  });

  it('has no target position for a milestone due outside the window', () => {
    const layout = layoutTimeline({ ...project, window: q3 })!;
    expect(layout.rows.find(item => item.milestone.id === 'late')!.targetLeft).toBeNull();
    expect(layout.rows.find(item => item.milestone.id === 'spanning')!.targetLeft).toBeNull();
  });

  it('drops markers outside the window and counts them', () => {
    const layout = layoutTimeline({ ...project, window: q3 })!;
    const row = layout.rows.find(item => item.milestone.id === 'spanning')!;

    expect(row.markers.map(marker => marker.id)).toEqual(['inside']);
    expect(row.hiddenMarkers).toBe(2);
    // The count of what the milestone is MADE of does not change with the view.
    expect(row.taskCount).toBe(3);
  });

  it('does not call a bar clipped when it ends exactly on the edge', () => {
    const layout = layoutTimeline({
      milestones: [milestone('m', new Date(2026, 9, 1), { startDate: new Date(2026, 6, 1) })],
      tasks: [],
      today: new Date(2026, 6, 1),
      window: q3
    })!;

    const row = layout.rows[0];
    expect(row.bar!.continuesAfter).toBe(false);
    expect(row.targetLeft).toBe(100);
  });

  it('hides today when the window is somewhere else', () => {
    const layout = layoutTimeline({
      ...project,
      window: { start: new Date(2026, 0, 1), months: 3 }
    })!;
    expect(layout.todayLeft).toBeNull();
  });

  it('still labels the quarters of the window', () => {
    const layout = layoutTimeline({ ...project, window: { start: new Date(2026, 5, 1), months: 6 } })!;
    expect(layout.quarters.map(quarter => quarter.label)).toEqual(['Q2', 'Q3', 'Q4']);
  });

  it('starts the window at the beginning of its month, whatever day is passed', () => {
    const layout = layoutTimeline({
      ...project,
      window: { start: new Date(2026, 6, 17), months: 3 }
    })!;
    expect(layout.start.getDate()).toBe(1);
    expect(layout.start.getMonth()).toBe(6);
  });
});
