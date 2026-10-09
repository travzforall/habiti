import { Milestone, Task } from '../models/project.model';
import { taskProgress } from './task-progress';

/**
 * A project's milestones laid out against time.
 *
 * Rows are milestones, the axis across the top is months. Pure, like the mind
 * map's layout: dates and tasks in, percentages out. Percentages rather than
 * pixels so the same numbers work at any width — the view is a CSS grid, and a
 * timeline that needs a resize listener to stay correct is a timeline that will
 * be wrong for one frame every time.
 *
 * ── WHAT DECIDES THE RANGE ────────────────────────────────────────────────
 *
 * Every date the project knows about: its own start and due dates, each
 * milestone's start and target, and the due date of every task. Then padded out
 * to whole months at both ends, because a bar that starts mid-column with no
 * month label above it tells you nothing.
 *
 * A project with no dates at all returns `null`. The view says so rather than
 * drawing an axis around today and pretending.
 */

/**
 * A calendar quarter, drawn as the band above the months.
 *
 * A project is planned in quarters and worked in weeks; the axis should say
 * both. The month band alone makes "is this landing in Q3" a counting exercise.
 */
export interface TimelineQuarter {
  /** "Q3" — the year sits alongside, and only where it changes. */
  label: string;
  year: string;
  showYear: boolean;
  left: number;
  width: number;
}

export interface TimelineMonth {
  label: string;
  /** e.g. "2026" — drawn once per year, at the month where the year changes. */
  year: string;
  showYear: boolean;
  /** Percentages across the track. */
  left: number;
  width: number;
}

export interface TimelineMarker {
  id: string;
  title: string;
  left: number;
  done: boolean;
  overdue: boolean;
  /**
   * Which line of the row this marker sits on.
   *
   * Markers carry their task's NAME now, and two tasks due the same week would
   * otherwise print one label over the other. Anything too close to the marker
   * before it drops to the next lane instead — the row grows a little, and
   * nothing is unreadable. 0 is the top lane.
   */
  lane: number;
  /**
   * How much of the track this marker's label covers, as a percentage.
   *
   * Kept on the marker because laning needs it and because a template that
   * wants to clamp a label has the number to hand.
   */
  labelWidth: number;
  /**
   * Draw the label on the LEFT of the dot.
   *
   * A task due in the last month of the range has its name running off the end
   * of the track, where it is clipped or spills over the card. Past this point
   * the label goes back the way it came, which is always inside.
   */
  flipLabel: boolean;
}

export interface TimelineRow {
  milestone: Milestone;
  /**
   * Absent when the milestone has no start — it is drawn as a marker instead,
   * and absent again when the whole bar falls outside the visible window.
   *
   * `continuesBefore` / `continuesAfter` mean the bar was CLIPPED: it carries on
   * past the edge of the window. The view squares off that end rather than
   * rounding it, so a three-month view of a year-long milestone does not read
   * as a milestone that starts and ends inside the quarter.
   */
  bar?: { left: number; width: number; continuesBefore: boolean; continuesAfter: boolean };
  /** Where the target date sits, or null when it is outside the window. */
  targetLeft: number | null;
  colour: string;
  progress: number;
  taskCount: number;
  doneCount: number;
  overdue: boolean;
  /** The milestone's tasks, as points on its row. */
  markers: TimelineMarker[];
  /** How many lanes those markers needed, so the row can be sized for them. */
  lanes: number;
  /** Same reasoning as `flipLabel`, for the diamond a start-less milestone draws. */
  flipTitle: boolean;
  /** Tasks hidden because their due date is outside the window. */
  hiddenMarkers: number;
}

export interface TimelineLayout {
  start: Date;
  end: Date;
  quarters: TimelineQuarter[];
  months: TimelineMonth[];
  /**
   * True when the months are too narrow to label.
   *
   * Past about a year, "Jan Feb Mar…" becomes a row of clipped stubs. The
   * gridlines still earn their place, so they stay; the labels go, and the
   * quarter band above carries the meaning.
   */
  denseMonths: boolean;
  /** Null when today is outside the range — do not draw a line off the end. */
  todayLeft: number | null;
  rows: TimelineRow[];
  /** Dated tasks belonging to no milestone. Their own row, so nothing is hidden. */
  unassigned: TimelineMarker[];
  unassignedLanes: number;
}

export interface TimelineInput {
  milestones: readonly Milestone[];
  tasks: readonly Task[];
  projectStart?: Date;
  projectDue?: Date;
  today?: Date;
  /** Fallback colour for a milestone with none of its own — the project's type colour. */
  defaultColour?: string;
  /**
   * How much room a label needs, as a percentage of the track.
   *
   * A percentage rather than pixels because that is what the whole layout
   * speaks; it is an approximation of "will these two labels collide", and
   * being slightly generous costs one extra lane, while being mean costs
   * legibility.
   */
  minMarkerGap?: number;
  /**
   * How wide the track is on screen, in pixels.
   *
   * The layout speaks percentages, but a LABEL is measured in pixels — so
   * turning "this title is 19 characters" into "this much of the track" needs
   * to know how much track there is. The default suits a desktop card; passing
   * the measured width makes the spacing right on a phone too.
   */
  trackWidthPx?: number;
  /** Average character width of a marker label, in pixels. */
  labelCharPx?: number;
  /**
   * Show only this slice of time, instead of the whole project.
   *
   * Without it the axis fits everything, which is right until a two-year
   * project makes every month a sliver. With it, the range is exactly the
   * months asked for and anything outside is clipped or dropped — the caller
   * moves the window rather than the layout guessing.
   */
  window?: { start: Date; months: number };
  /**
   * Past this percentage, a label is drawn to the left of its marker.
   *
   * Roughly "is there a label's width of track left" — the same approximation
   * as `minMarkerGap`, and generous for the same reason.
   */
  flipLabelsAfter?: number;
}

export function layoutTimeline(input: TimelineInput): TimelineLayout | null {
  const today = input.today ?? new Date();
  // Two percent, not fourteen: the label's own width now decides the spacing,
  // and this is only the floor beneath it.
  const gap = input.minMarkerGap ?? 2;
  const labelWidth = labelWidthFactory(input.trackWidthPx ?? 960, input.labelCharPx ?? 6);
  const flipAfter = input.flipLabelsAfter ?? 62;
  const dates: Date[] = [];

  const collect = (date: Date | undefined) => {
    if (date && !Number.isNaN(date.getTime())) dates.push(date);
  };

  collect(input.projectStart);
  collect(input.projectDue);
  for (const milestone of input.milestones) {
    collect(milestone.startDate);
    collect(milestone.targetDate);
  }
  for (const task of input.tasks) collect(task.dueDate);

  if (dates.length === 0) return null;

  const earliest = new Date(Math.min(...dates.map(date => date.getTime())));
  const latest = new Date(Math.max(...dates.map(date => date.getTime())));

  const start = input.window ? startOfMonth(input.window.start) : startOfMonth(earliest);
  const end = input.window
    ? addMonths(start, Math.max(1, input.window.months))
    : endOfMonth(latest);

  // A single-month project would otherwise be one column wide, with every bar
  // on top of every other. Two months is the narrowest thing worth drawing.
  const span = Math.max(end.getTime() - start.getTime(), monthsApart(start, 2) - start.getTime());
  const rangeEnd = new Date(start.getTime() + span);

  /** Unclamped: the caller decides whether something outside is clipped or dropped. */
  const raw = (date: Date) => ((date.getTime() - start.getTime()) / span) * 100;
  const position = (date: Date) => clamp(raw(date));
  const inWindow = (value: number) => value >= 0 && value <= 100;

  const quarters: TimelineQuarter[] = [];
  let quarterCursor = startOfQuarter(start);
  let lastQuarterYear = '';
  while (quarterCursor.getTime() < rangeEnd.getTime()) {
    const next = addMonths(quarterCursor, 3);
    // The first and last quarters are usually part-quarters: a project starting
    // in August is two thirds of a Q3, and the band has to say so or the
    // months beneath it stop lining up.
    const from = Math.max(quarterCursor.getTime(), start.getTime());
    const to = Math.min(next.getTime(), rangeEnd.getTime());
    const year = String(quarterCursor.getFullYear());

    quarters.push({
      label: `Q${Math.floor(quarterCursor.getMonth() / 3) + 1}`,
      year,
      showYear: year !== lastQuarterYear,
      left: position(new Date(from)),
      width: clamp(((to - from) / span) * 100)
    });

    lastQuarterYear = year;
    quarterCursor = next;
  }

  const months: TimelineMonth[] = [];
  let cursor = new Date(start);
  let lastYear = '';
  while (cursor.getTime() < rangeEnd.getTime()) {
    const next = addMonths(cursor, 1);
    const year = String(cursor.getFullYear());
    months.push({
      label: cursor.toLocaleDateString('en-US', { month: 'short' }),
      year,
      showYear: year !== lastYear,
      left: position(cursor),
      width: clamp(((Math.min(next.getTime(), rangeEnd.getTime()) - cursor.getTime()) / span) * 100)
    });
    lastYear = year;
    cursor = next;
  }

  const byMilestone = new Map<string, Task[]>();
  for (const task of input.tasks) {
    if (!task.milestoneId) continue;
    byMilestone.set(task.milestoneId, [...(byMilestone.get(task.milestoneId) ?? []), task]);
  }

  const rows: TimelineRow[] = [...input.milestones]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.targetDate.getTime() - b.targetDate.getTime())
    .map(milestone => {
      const tasks = byMilestone.get(milestone.id) ?? [];
      const doneCount = tasks.filter(task => task.completed).length;
      const rawTarget = raw(milestone.targetDate);
      const targetLeft = inWindow(rawTarget) ? rawTarget : null;

      const rawStart = milestone.startDate ? raw(milestone.startDate) : null;
      // A bar shows if any part of it is inside; both ends are then clipped to
      // the window, and the clipped ends are flagged.
      const barVisible =
        rawStart !== null && rawStart <= 100 && rawTarget >= 0 && rawTarget >= rawStart;
      const clippedLeft = barVisible ? Math.max(0, rawStart!) : 0;
      const clippedRight = barVisible ? Math.min(100, rawTarget) : 0;

      const visibleMarkers = tasks
        .filter(task => task.dueDate && inWindow(raw(task.dueDate)))
        .map(task => markerFor(task, position, today, flipAfter, labelWidth));

      return {
        milestone,
        bar: barVisible
          ? {
              left: clippedLeft,
              // A bar has to be visible even when start and target are the same
              // day, or a one-day milestone renders as nothing at all.
              width: Math.max(clippedRight - clippedLeft, 0.6),
              continuesBefore: rawStart! < 0,
              continuesAfter: rawTarget > 100
            }
          : undefined,
        targetLeft,
        colour: milestone.colour || input.defaultColour || '#3b82f6',
        progress: milestoneProgress(milestone, tasks),
        taskCount: tasks.length,
        doneCount,
        overdue: !milestone.completed && milestone.targetDate.getTime() < today.getTime(),
        flipTitle: (targetLeft ?? 0) > flipAfter,
        hiddenMarkers: tasks.filter(task => task.dueDate).length - visibleMarkers.length,
        ...withLanes(visibleMarkers, gap)
      };
    });

  /**
   * A task counts as unassigned when its milestone is not HERE, not merely when
   * it has no milestoneId.
   *
   * A dangling id — the milestone was deleted, or belongs to a device that has
   * not synced — used to make the task vanish outright: no row of its own to
   * appear in, and excluded from this lane because the id was non-empty. An
   * entire project's worth of work could be invisible while every task still
   * showed up in the list below, which reads as "the timeline is broken".
   * Falling back to unassigned is the same rule blockersOf() follows for a
   * prerequisite that no longer exists.
   */
  const milestoneIds = new Set(input.milestones.map(milestone => milestone.id));
  const unassignedLaid = withLanes(
    input.tasks
      .filter(
        task =>
          (!task.milestoneId || !milestoneIds.has(task.milestoneId)) &&
          task.dueDate &&
          inWindow(raw(task.dueDate))
      )
      .map(task => markerFor(task, position, today, flipAfter, labelWidth)),
    gap
  );

  const todayTime = today.getTime();
  const todayLeft =
    todayTime >= start.getTime() && todayTime <= rangeEnd.getTime() ? position(today) : null;

  return {
    start,
    end: rangeEnd,
    quarters,
    months,
    // Twelve is where a month column stops being wide enough for "Sep".
    denseMonths: months.length > 12,
    todayLeft,
    rows,
    unassigned: unassignedLaid.markers,
    unassignedLanes: unassignedLaid.lanes
  };
}

/**
 * Spreads markers over as few lines as they can be read on.
 *
 * Greedy and left to right: a marker takes the first lane where its LABEL does
 * not land on the label already there.
 *
 * ── WHY FOOTPRINTS AND NOT DISTANCE ───────────────────────────────────────
 *
 * This used to compare dot positions against one flat gap, which got two
 * things wrong. A long title needs more room than a short one — and past
 * `flipLabelsAfter` a label is drawn to the LEFT of its dot, so two markers a
 * comfortable distance apart could still print on top of each other, one
 * growing right and the other growing left into it. That is exactly what
 * "Email receipts" and "Run a two-week beta" did.
 *
 * So each marker claims the span its label actually occupies, and a lane is
 * free when the claims do not overlap. `gap` survives as a floor for callers
 * that want markers further apart than legibility alone demands.
 */
function withLanes(
  markers: TimelineMarker[],
  gap: number
): { markers: TimelineMarker[]; lanes: number } {
  const sorted = [...markers].sort((a, b) => a.left - b.left);
  const laneEnds: number[] = [];

  for (const marker of sorted) {
    const width = Math.max(marker.labelWidth ?? 0, gap);
    // A flipped label hangs to the left of its dot; a normal one to the right.
    const start = marker.flipLabel ? marker.left - width : marker.left;
    const end = start + width;

    let lane = laneEnds.findIndex(last => start >= last);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      // Never let a flipped label move a lane's edge backwards.
      laneEnds[lane] = Math.max(laneEnds[lane], end);
    }
    marker.lane = lane;
  }

  return { markers: sorted, lanes: Math.max(laneEnds.length, 1) };
}

/**
 * How far along a milestone is.
 *
 * Its tasks decide, when it has any — that is what "a milestone made of tasks"
 * means. With none, it is the flag: done or not. Never a date-based guess; time
 * passing is not progress.
 */
export function milestoneProgress(milestone: Milestone, tasks: readonly Task[]): number {
  if (milestone.completed) return 100;
  if (tasks.length === 0) return 0;
  return Math.round(tasks.reduce((sum, task) => sum + taskProgress(task), 0) / tasks.length);
}

function markerFor(
  task: Task,
  position: (date: Date) => number,
  today: Date,
  flipAfter: number,
  labelWidth: (title: string) => number
): TimelineMarker {
  const left = position(task.dueDate!);
  return {
    id: task.id,
    title: task.title,
    left,
    done: task.completed,
    overdue: !task.completed && task.dueDate!.getTime() < today.getTime(),
    lane: 0,
    labelWidth: labelWidth(task.title),
    flipLabel: left > flipAfter
  };
}

/**
 * A label's width as a percentage of the track.
 *
 * An estimate from the character count, not a measurement — the layout is pure
 * and has no DOM to ask. Capped at 45% to match the template's max-width, so a
 * very long title cannot claim the whole row.
 */
function labelWidthFactory(trackWidthPx: number, charPx: number): (title: string) => number {
  return title => {
    // The dot and its gap sit inside the label's footprint.
    const pixels = (title?.length ?? 0) * charPx + 18;
    return Math.min(45, (pixels / trackWidthPx) * 100);
  };
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfQuarter(date: Date): Date {
  return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function addMonths(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function monthsApart(start: Date, count: number): number {
  return addMonths(start, count).getTime();
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}
