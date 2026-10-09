import {
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { Milestone, Project, Task } from '../../models/project.model';
import { TimelineMarker, layoutTimeline } from '../../config/timeline-layout';
import { projectTypeMeta } from '../../config/project-types';


/** What the hover card is showing, and where to put it. */
interface HoverState {
  task: Task;
  x: number;
  y: number;
}

/**
 * The project's own calendar: milestones down the side, time across the top.
 *
 * ── WHY CSS AND NOT SVG ───────────────────────────────────────────────────
 *
 * The mind map is SVG because it needs arbitrary geometry and hit-testing on
 * curves. This needs neither: every bar is a rectangle on a horizontal track,
 * and the hard parts are text truncation, hover, links and wrapping — all of
 * which are free in HTML and hand-rolled in SVG. `layoutTimeline` returns
 * percentages, so the whole thing is responsive without a resize listener.
 *
 * ── NAMES, NOT JUST DOTS ──────────────────────────────────────────────────
 *
 * Every marker carries its task's name. A timeline of anonymous dots tells you
 * how much is happening and nothing about what — you had to hover each one to
 * find out, which is the opposite of what a timeline is for. Where two labels
 * would collide, the layout drops the later one to another lane rather than
 * printing them over each other.
 *
 * Hovering adds THE DATE, and nothing else.
 *
 * It briefly showed a card with the title, status, priority, milestone and a
 * progress bar — every one of which was already on screen: the title is the
 * label being hovered, the milestone is the row it sits on, and status and
 * priority are on the task list below. A tooltip that repeats what you can
 * already see is noise in front of the thing you were looking at.
 *
 * What the timeline genuinely cannot say is WHICH DAY: a marker two-thirds
 * along August is somewhere around the 20th. So that is what the tooltip says,
 * plus how late it is when that applies.
 */
@Component({
  selector: 'app-project-timeline',
  standalone: true,
  imports: [RouterModule],
  template: `
    <!--
      How much time to show.

      "Everything" is the right default — a project you can see all of is a
      project you can plan. It stops being right at about a year, where each
      month is a sliver, so the window can be narrowed to a quarter, half a year
      or a year, and then stepped through. The arrows move by a month, which is
      predictable in a way that "half a window" is not.
    -->
    <div class="mb-3 flex flex-wrap items-center justify-end gap-2">
      @if (span() !== 'all') {
        <button
          type="button"
          (click)="step(-1)"
          aria-label="Earlier"
          class="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
        >
          ‹
        </button>
        <button
          type="button"
          (click)="goToToday()"
          class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
        >
          Today
        </button>
        <button
          type="button"
          (click)="step(1)"
          aria-label="Later"
          class="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
        >
          ›
        </button>
      }

      <label class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        <span class="sr-only">Time shown</span>
        <select
          [value]="span()"
          (change)="setSpan($any($event.target).value)"
          class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        >
          <option value="3">3 months</option>
          <option value="6">6 months</option>
          <option value="12">1 year</option>
          <option value="all">Whole project</option>
        </select>
      </label>
    </div>

    @if (layout(); as timeline) {
      <div class="overflow-x-auto">
        <div class="min-w-[46rem]">
          <!--
            The axis. Months, with the year marked only where it changes.

            The label column is STICKY. The track is wider than the card and
            scrolls sideways; without this the names scroll away with it, and
            two months in you are looking at bars with no idea whose they are.
            It needs its own background, or the track shows through it.
          -->
          <div class="mb-2 flex items-stretch gap-3">
            <div class="sticky left-0 z-30 w-40 shrink-0 bg-white dark:bg-slate-800"></div>

            <!-- #track is measured for label spacing. The axis is exactly as
                 wide as every row's track, so one observer serves them all. -->
            <div class="flex-1" #track>
              <!-- Quarters: how a project is planned. -->
              <div class="relative h-7 overflow-hidden rounded-t-lg" [style.background-color]="tint()">
                @for (quarter of timeline.quarters; track quarter.left) {
                  <div
                    class="absolute top-0 flex h-full items-center justify-center border-l-2 border-white/60 text-xs font-semibold text-white"
                    [style.left.%]="quarter.left"
                    [style.width.%]="quarter.width"
                  >
                    <span class="truncate px-1">
                      {{ quarter.label }}
                      @if (quarter.showYear) {
                        <span class="font-normal opacity-75">{{ quarter.year }}</span>
                      }
                    </span>
                  </div>
                }
              </div>

              <!-- Months: how it is worked. Labels drop out once they cannot
                   be read, and the gridlines carry on. -->
              <div class="relative h-6 overflow-hidden rounded-b-lg" [style.background-color]="tint()">
                <span class="absolute inset-0 bg-black/15"></span>
                @for (month of timeline.months; track month.left) {
                  <div
                    class="absolute top-0 flex h-full items-center justify-center border-l border-white/30 text-[11px] font-medium text-white"
                    [style.left.%]="month.left"
                    [style.width.%]="month.width"
                  >
                    @if (!timeline.denseMonths) {
                      <span class="truncate px-1">{{ month.label }}</span>
                    }
                  </div>
                }

                @if (timeline.todayLeft !== null) {
                  <div
                    class="absolute -bottom-1 z-10 -translate-x-1/2 text-[10px] font-bold text-red-600"
                    [style.left.%]="timeline.todayLeft"
                  >
                    ▼
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- One row per milestone -->
          <div class="space-y-2">
            @for (row of timeline.rows; track row.milestone.id) {
              <div class="flex items-stretch gap-3">
                <div class="sticky left-0 z-30 shrink-0 bg-white pr-0 dark:bg-slate-800">
                <button
                  type="button"
                  (click)="milestoneSelected.emit(row.milestone.id)"
                  class="h-full w-40 rounded-lg px-3 py-2 text-left text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  [style.background-color]="row.colour"
                >
                  <span class="line-clamp-2">{{ row.milestone.title }}</span>
                  <span class="mt-0.5 block text-xs font-normal text-white/80">
                    @if (row.taskCount > 0) {
                      {{ row.doneCount }}/{{ row.taskCount }} tasks
                    } @else {
                      {{ row.milestone.completed ? 'Done' : 'No tasks yet' }}
                    }
                  </span>
                </button>
                </div>

                <div
                  class="relative flex-1 rounded-lg bg-slate-100 dark:bg-slate-900/40"
                  [style.height.px]="rowHeight(row.lanes)"
                >
                  <!-- Month gridlines, so a bar can be read against the axis,
                       with the quarter boundaries drawn stronger. -->
                  @for (month of timeline.months; track month.left) {
                    <div
                      class="absolute top-0 h-full border-l border-slate-200 dark:border-slate-700"
                      [style.left.%]="month.left"
                    ></div>
                  }
                  @for (quarter of timeline.quarters; track quarter.left) {
                    <div
                      class="absolute top-0 h-full border-l-2 border-slate-300 dark:border-slate-600"
                      [style.left.%]="quarter.left"
                    ></div>
                  }

                  @if (timeline.todayLeft !== null) {
                    <div
                      class="absolute top-0 z-10 h-full border-l-2 border-red-400/70"
                      [style.left.%]="timeline.todayLeft"
                    ></div>
                  }

                  @if (row.bar; as bar) {
                    <!-- A clipped end is squared off, so a bar running past the
                         window does not read as one that ends there. -->
                    <div
                      class="absolute top-2 flex h-6 items-center overflow-hidden px-2.5 text-xs font-medium text-white"
                      [class.rounded-l-full]="!bar.continuesBefore"
                      [class.rounded-r-full]="!bar.continuesAfter"
                      [style.left.%]="bar.left"
                      [style.width.%]="bar.width"
                      [style.background-color]="row.colour"
                    >
                      <!-- Progress fills the bar from the left, so a stalled
                           milestone reads as an empty one. -->
                      <span
                        class="absolute inset-y-0 left-0 bg-black/20"
                        [style.width.%]="row.progress"
                      ></span>
                      <span class="relative flex-1 truncate">{{ row.milestone.title }}</span>
                      <span class="relative ml-2 shrink-0 opacity-90">{{ row.progress }}%</span>
                    </div>
                  } @else if (row.targetLeft !== null) {
                    <!-- Near the end of the track the label points back the
                         way it came, so it stays inside. -->
                    <div
                      class="absolute top-2 flex h-6 items-center gap-1.5"
                      [class.flex-row-reverse]="row.flipTitle"
                      [style.left.%]="row.targetLeft"
                      [style.transform]="
                        row.flipTitle ? 'translateX(calc(-100% + 0.375rem))' : 'translateX(-0.375rem)'
                      "
                    >
                      <span class="block h-3 w-3 shrink-0 rotate-45" [style.background-color]="row.colour"></span>
                      <span class="whitespace-nowrap text-xs font-medium text-slate-600 dark:text-slate-300">
                        {{ row.milestone.title }}
                      </span>
                    </div>
                  }

                  <!-- The tasks the milestone is made of, by name. -->
                  @for (marker of row.markers; track marker.id) {
                    <a
                      [routerLink]="['/tasks', marker.id]"
                      (mouseenter)="hover($event, marker)"
                      (focus)="hover($event, marker)"
                      (mouseleave)="hovered.set(null)"
                      (blur)="hovered.set(null)"
                      class="group absolute z-10 flex max-w-[45%] items-center gap-1.5"
                      [class.flex-row-reverse]="marker.flipLabel"
                      [style.left.%]="marker.left"
                      [style.top.px]="laneTop(marker.lane)"
                      [style.transform]="marker.flipLabel ? 'translateX(-100%)' : null"
                    >
                      <span
                        class="block h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white transition-transform group-hover:scale-125 dark:ring-slate-800"
                        [class.bg-green-500]="marker.done"
                        [class.bg-red-500]="marker.overdue"
                        [class.bg-slate-400]="!marker.done && !marker.overdue"
                      ></span>
                      <span
                        class="truncate text-[11px] leading-none text-slate-600 group-hover:text-blue-600 dark:text-slate-300"
                        [class.line-through]="marker.done"
                      >
                        {{ marker.title }}
                      </span>
                    </a>
                  }

                  @if (row.overdue && row.targetLeft !== null) {
                    <span
                      class="absolute bottom-1 -translate-x-1/2 text-[10px] font-semibold text-red-600"
                      [style.left.%]="row.targetLeft"
                    >
                      late
                    </span>
                  }

                  <!-- Say what the window is hiding, rather than quietly
                       dropping it. -->
                  @if (row.hiddenMarkers > 0) {
                    <span class="absolute bottom-1 right-2 text-[10px] text-slate-400">
                      +{{ row.hiddenMarkers }} outside this view
                    </span>
                  }
                </div>
              </div>
            }

            <!--
              An empty timeline used to render as a month band, a legend and a
              void — which reads as broken rather than empty. Say which of the
              two it is, and what would fill it.
            -->
            @if (timeline.rows.length === 0 && timeline.unassigned.length === 0) {
              <div
                class="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400"
              >
                Nothing to show in this window yet.
                <span class="mt-1 block text-xs">
                  Add a milestone below, or give a task a due date — either one draws a row here.
                </span>
              </div>
            }

            <!--
              Dated tasks that belong to no milestone. Their own row rather than
              nothing: grouping must not be the reason a piece of work stops
              being visible.
            -->
            @if (timeline.unassigned.length > 0) {
              <div class="flex items-stretch gap-3">
                <div class="sticky left-0 z-30 shrink-0 bg-white dark:bg-slate-800">
                  <div class="h-full w-40 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-left text-sm font-medium text-slate-500 dark:border-slate-600">
                    Not in a milestone
                    <span class="mt-0.5 block text-xs font-normal">
                      {{ timeline.unassigned.length }} dated
                    </span>
                  </div>
                </div>

                <div
                  class="relative flex-1 rounded-lg bg-slate-50 dark:bg-slate-900/20"
                  [style.height.px]="rowHeight(timeline.unassignedLanes)"
                >
                  @for (month of timeline.months; track month.left) {
                    <div
                      class="absolute top-0 h-full border-l border-slate-200 dark:border-slate-700"
                      [style.left.%]="month.left"
                    ></div>
                  }
                  @for (quarter of timeline.quarters; track quarter.left) {
                    <div
                      class="absolute top-0 h-full border-l-2 border-slate-300 dark:border-slate-600"
                      [style.left.%]="quarter.left"
                    ></div>
                  }
                  @if (timeline.todayLeft !== null) {
                    <div
                      class="absolute top-0 z-10 h-full border-l-2 border-red-400/70"
                      [style.left.%]="timeline.todayLeft"
                    ></div>
                  }
                  @for (marker of timeline.unassigned; track marker.id) {
                    <a
                      [routerLink]="['/tasks', marker.id]"
                      (mouseenter)="hover($event, marker)"
                      (focus)="hover($event, marker)"
                      (mouseleave)="hovered.set(null)"
                      (blur)="hovered.set(null)"
                      class="group absolute z-10 flex max-w-[45%] items-center gap-1.5"
                      [class.flex-row-reverse]="marker.flipLabel"
                      [style.left.%]="marker.left"
                      [style.top.px]="laneTop(marker.lane)"
                      [style.transform]="marker.flipLabel ? 'translateX(-100%)' : null"
                    >
                      <span
                        class="block h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white transition-transform group-hover:scale-125 dark:ring-slate-800"
                        [class.bg-green-500]="marker.done"
                        [class.bg-red-500]="marker.overdue"
                        [class.bg-slate-400]="!marker.done && !marker.overdue"
                      ></span>
                      <span
                        class="truncate text-[11px] leading-none text-slate-600 group-hover:text-blue-600 dark:text-slate-300"
                        [class.line-through]="marker.done"
                      >
                        {{ marker.title }}
                      </span>
                    </a>
                  }
                </div>
              </div>
            }
          </div>

          <div class="mt-3 flex flex-wrap items-center gap-4 pl-[11.75rem] text-xs text-slate-500">
            <span class="flex items-center gap-1">
              <span class="h-2.5 w-2.5 rounded-full bg-slate-400"></span> task due
            </span>
            <span class="flex items-center gap-1">
              <span class="h-2.5 w-2.5 rounded-full bg-green-500"></span> done
            </span>
            <span class="flex items-center gap-1">
              <span class="h-2.5 w-2.5 rounded-full bg-red-500"></span> overdue
            </span>
            <span class="flex items-center gap-1">
              <span class="h-3 w-3 rotate-45 bg-slate-400"></span> milestone with no start date
            </span>
            <span class="text-slate-400">Hover a task for detail</span>
          </div>
        </div>
      </div>

      <!--
        The hover card. FIXED, positioned from the pointer: the track scrolls
        sideways and clips its own overflow, so a card inside it would be cut in
        half at the edge of the view.
      -->
      @if (hovered(); as state) {
        <div
          class="pointer-events-none fixed z-[70] rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-xl dark:bg-slate-700"
          [style.left.px]="state.x"
          [style.top.px]="state.y"
          role="tooltip"
        >
          {{ fullDate(state.task.dueDate) }}
          @if (isLate(state.task)) {
            <span class="text-red-300">· {{ daysLate(state.task) }} days late</span>
          }
        </div>
      }
    } @else {
      <p class="py-10 text-center text-sm text-slate-500">
        Nothing to plot yet. Give the project a due date, or a milestone a target date, and the
        timeline appears.
      </p>
    }
  `
})
export class ProjectTimelineComponent {
  readonly project = input.required<Project>();
  readonly milestones = input<Milestone[]>([]);
  readonly tasks = input<Task[]>([]);

  readonly milestoneSelected = output<string>();

  protected readonly hovered = signal<HoverState | null>(null);

  /** '3' | '6' | '12' months, or 'all'. */
  protected readonly span = signal<'3' | '6' | '12' | 'all'>('all');
  /** The first month of the window. Only used when a span is chosen. */
  private readonly windowStart = signal(startOfThisMonth());

  /**
   * How wide the track is, in pixels — measured, not guessed.
   *
   * Label spacing is decided in percentages, so the layout has to know how much
   * track a title's pixels amount to. On a wide desktop card the same title
   * covers a third of what it does on a phone, and guessing one number for both
   * means labels either collide or get spread over lanes they did not need.
   */
  private readonly trackWidth = signal(960);

  private readonly track = viewChild<ElementRef<HTMLElement>>('track');

  constructor() {
    effect(cleanup => {
      const element = this.track()?.nativeElement;
      if (!element || typeof ResizeObserver === 'undefined') return;

      const observer = new ResizeObserver(([entry]) => {
        const width = Math.round(entry.contentRect.width);
        if (width > 0) this.trackWidth.set(width);
      });
      observer.observe(element);
      cleanup(() => observer.disconnect());
    });
  }

  protected readonly layout = computed(() => {
    const span = this.span();
    return layoutTimeline({
      milestones: this.milestones(),
      tasks: this.tasks(),
      projectStart: this.project().startDate,
      projectDue: this.project().dueDate,
      defaultColour: projectTypeMeta(this.project().type).colour,
      trackWidthPx: this.trackWidth(),
      window:
        span === 'all' ? undefined : { start: this.windowStart(), months: Number(span) }
    });
  });

  protected setSpan(value: string): void {
    const span = value === 'all' ? 'all' : (value as '3' | '6' | '12');
    this.span.set(span);
    // Opening a window puts it somewhere useful rather than at the project's
    // first month: today if the project is under way, otherwise its start.
    if (span !== 'all') this.windowStart.set(this.sensibleStart());
  }

  protected step(months: -1 | 1): void {
    const current = this.windowStart();
    this.windowStart.set(new Date(current.getFullYear(), current.getMonth() + months, 1));
  }

  protected goToToday(): void {
    this.windowStart.set(startOfThisMonth());
  }

  /**
   * Where a freshly-opened window should sit.
   *
   * This month, unless the project is entirely in the past or the future — a
   * three-month view of next January, on a project that ended in March, is an
   * empty grid that looks broken.
   */
  private sensibleStart(): Date {
    const now = startOfThisMonth();
    const start = this.project().startDate;
    const due = this.project().dueDate;

    if (due && due < now) return new Date(due.getFullYear(), due.getMonth(), 1);
    if (start && start > now) return new Date(start.getFullYear(), start.getMonth(), 1);
    return now;
  }

  /** The axis strip takes the project's type colour, so two projects never look alike. */
  protected readonly tint = computed(() => projectTypeMeta(this.project().type).colour);

  // --- geometry ------------------------------------------------------------

  /** Bar band, then one line per lane of task labels. */
  protected rowHeight(lanes: number): number {
    return 40 + Math.max(lanes, 1) * 16;
  }

  protected laneTop(lane: number): number {
    return 36 + lane * 16;
  }

  // --- the hover card ------------------------------------------------------

  protected hover(event: MouseEvent | FocusEvent, marker: TimelineMarker): void {
    const task = this.tasks().find(item => item.id === marker.id);
    if (!task) return;

    const target = event.target as HTMLElement;
    const rect = target.getBoundingClientRect();

    // Just above the marker, flipped below when it would leave the window.
    // Small enough now to sit close to what it describes.
    const width = 170;
    const height = 32;
    const x = Math.min(rect.left, window.innerWidth - width - 12);
    const y = rect.top - height - 6 < 8 ? rect.bottom + 6 : rect.top - height - 6;

    this.hovered.set({ task, x: Math.max(12, x), y: Math.max(8, y) });
  }

  // --- display -------------------------------------------------------------

  protected fullDate(date: Date | undefined): string {
    if (!date) return 'No date';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  protected isLate(task: Task): boolean {
    if (!task.dueDate || task.completed) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return task.dueDate < today;
  }

  protected daysLate(task: Task): number {
    if (!task.dueDate) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((today.getTime() - task.dueDate.getTime()) / 86400000));
  }
}

/** The first of the current month — where a window opens by default. */
function startOfThisMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
