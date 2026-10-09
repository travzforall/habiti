import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HabitsService, Habit } from '../../services/habits';

/**
 * Everything the month grid needs about one day, worked out once.
 *
 * The grid used to render every habit in every cell — 14 habits across 42 cells
 * is ~590 rows of truncated text, which is unreadable as a month view and is
 * also what the day-detail dialog is for. Now each cell shows a single
 * completion ring, and this is the only shape it reads.
 *
 * Precomputing also fixes a quieter problem: the template called
 * getDayProgress() six times per cell, each one filtering the whole habit list,
 * on every change-detection pass.
 */
export interface DaySummary {
  date: Date;
  /** Stable trackBy key. */
  key: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  /** Nothing to report yet — rendered blank rather than as a 0% failure. */
  isFuture: boolean;
  completed: number;
  total: number;
  percent: number;
  /** 0 = untouched, 4 = everything done. Drives the cell tint. */
  level: 0 | 1 | 2 | 3 | 4;
  isPerfect: boolean;
  /** Consecutive perfect days ending on this one. */
  streak: number;
}

type FilterType = 'all' | 'good' | 'bad' | string;

/**
 * How far back to look before the visible grid when seeding streak counts.
 *
 * A streak that began last month should still show on the 1st. Bounded because
 * the previous implementation walked backwards with no limit.
 */
const STREAK_LOOKBACK_DAYS = 60;

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss'
})
export class CalendarComponent {
  private habitsService = inject(HabitsService);

  protected readonly habits = this.habitsService.habits;

  protected readonly currentDate = signal(startOfMonth(new Date()));
  protected readonly activeFilter = signal<FilterType>('all');
  protected readonly selectedDay = signal<Date | null>(null);

  protected readonly dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  private categoryColors: Record<string, string> = {
    health: '#10b981',
    productivity: '#3b82f6',
    learning: '#8b5cf6',
    social: '#ec4899',
    mindfulness: '#6366f1',
    creativity: '#f97316',
    finance: '#eab308',
    other: '#6b7280'
  };

  // --- Derived data ---------------------------------------------------------

  protected readonly filteredHabits = computed<Habit[]>(() => {
    const all = this.habits();
    const filter = this.activeFilter();

    if (filter === 'all') return all;
    if (filter === 'good') return all.filter(h => h.type === 'good');
    if (filter === 'bad') return all.filter(h => h.type === 'bad');
    return all.filter(h => (h.category || 'other') === filter);
  });

  /**
   * The six-week grid, summarised.
   *
   * One pass: count completions per day, then a single forward sweep for
   * streaks, seeded by a bounded look-back so a run that started last month
   * still shows on the 1st.
   */
  protected readonly monthDays = computed<DaySummary[]>(() => {
    const habits = this.filteredHabits();
    const month = this.currentDate();
    const today = startOfDay(new Date());

    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    const gridStart = new Date(first);
    gridStart.setDate(gridStart.getDate() - first.getDay());

    const gridEnd = new Date(last);
    gridEnd.setDate(gridEnd.getDate() + (6 - last.getDay()));

    const completedOn = (date: Date) =>
      habits.filter(h => this.habitsService.isHabitCompletedOnDate(h.id, date)).length;

    const isPerfectOn = (date: Date) =>
      habits.length > 0 && date <= today && completedOn(date) === habits.length;

    // Seed the streak counter from before the grid so it does not restart at 0
    // on the first visible day.
    let running = 0;
    if (habits.length > 0) {
      const probe = new Date(gridStart);
      probe.setDate(probe.getDate() - 1);
      for (let i = 0; i < STREAK_LOOKBACK_DAYS && isPerfectOn(probe); i++) {
        running++;
        probe.setDate(probe.getDate() - 1);
      }
    }

    const days: DaySummary[] = [];
    const cursor = new Date(gridStart);

    while (cursor <= gridEnd) {
      const date = new Date(cursor);
      const isFuture = date > today;
      const completed = isFuture ? 0 : completedOn(date);
      const total = habits.length;
      const percent = total === 0 || isFuture ? 0 : Math.round((completed / total) * 100);
      const isPerfect = total > 0 && !isFuture && completed === total;

      running = isPerfect ? running + 1 : 0;

      days.push({
        date,
        key: toKey(date),
        dayOfMonth: date.getDate(),
        isCurrentMonth: date.getMonth() === month.getMonth(),
        isToday: isSameDay(date, today),
        isFuture,
        completed,
        total,
        percent,
        level: toLevel(percent, completed),
        isPerfect,
        streak: running
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    return days;
  });

  /** Days of THIS month that have already happened. */
  private readonly elapsedDays = computed(() =>
    this.monthDays().filter(d => d.isCurrentMonth && !d.isFuture)
  );

  protected readonly monthStats = computed(() => {
    const elapsed = this.elapsedDays();
    const perfect = elapsed.filter(d => d.isPerfect).length;
    const tracked = elapsed.filter(d => d.completed > 0).length;

    const avg = elapsed.length
      ? Math.round(elapsed.reduce((sum, d) => sum + d.percent, 0) / elapsed.length)
      : 0;

    return {
      perfect,
      tracked,
      elapsed: elapsed.length,
      totalDays: new Date(
        this.currentDate().getFullYear(),
        this.currentDate().getMonth() + 1,
        0
      ).getDate(),
      averagePercent: avg
    };
  });

  /** Perfect-day run ending today, or 0 if today is not yet perfect. */
  protected readonly currentStreak = computed(() => {
    const today = this.monthDays().find(d => d.isToday);
    return today?.streak ?? 0;
  });

  protected readonly bestStreak = computed(() =>
    this.habits().reduce((best, h) => Math.max(best, h.bestStreak || 0), 0)
  );

  protected readonly categories = computed(() =>
    Array.from(new Set(this.habits().map(h => h.category || 'other'))).sort()
  );

  protected readonly monthLabel = computed(() =>
    this.currentDate().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  );

  /** Habit rows for the day dialog — the one place per-habit detail belongs. */
  protected readonly selectedDayHabits = computed(() => {
    const date = this.selectedDay();
    if (!date) return [];

    return this.filteredHabits().map(habit => ({
      habit,
      completed: this.habitsService.isHabitCompletedOnDate(habit.id, date)
    }));
  });

  protected readonly selectedDaySummary = computed<DaySummary | null>(() => {
    const date = this.selectedDay();
    if (!date) return null;
    return this.monthDays().find(d => isSameDay(d.date, date)) ?? null;
  });

  // --- Navigation -----------------------------------------------------------

  protected previousMonth(): void {
    this.currentDate.update(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  protected nextMonth(): void {
    this.currentDate.update(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  protected goToToday(): void {
    this.currentDate.set(startOfMonth(new Date()));
  }

  protected setFilter(filter: FilterType): void {
    this.activeFilter.set(filter);
  }

  protected countByType(type: 'good' | 'bad'): number {
    return this.habits().filter(h => h.type === type).length;
  }

  protected countInCategory(category: string): number {
    return this.habits().filter(h => (h.category || 'other') === category).length;
  }

  protected categoryLabel(category: string): string {
    return category.charAt(0).toUpperCase() + category.slice(1);
  }

  protected getCategoryColor(category: string): string {
    return this.categoryColors[category] ?? this.categoryColors['other'];
  }

  // --- Day dialog -----------------------------------------------------------

  protected openDay(day: DaySummary): void {
    // Future days have nothing to show and nothing to toggle.
    if (day.isFuture) return;
    this.selectedDay.set(day.date);
  }

  protected closeDay(): void {
    this.selectedDay.set(null);
  }

  protected formatDateFull(date: Date): string {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  protected toggleHabit(habitId: string, date: Date): void {
    this.habitsService.toggleHabitForDate(habitId, date);
  }

  protected markAll(date: Date, complete: boolean): void {
    for (const habit of this.filteredHabits()) {
      const done = this.habitsService.isHabitCompletedOnDate(habit.id, date);
      if (done !== complete) this.habitsService.toggleHabitForDate(habit.id, date);
    }
  }

  /** Screen-reader label — the visual is a ring, which says nothing on its own. */
  protected dayLabel(day: DaySummary): string {
    const date = this.formatDateFull(day.date);
    if (day.isFuture) return `${date}, upcoming`;
    if (day.total === 0) return `${date}, no habits tracked`;
    return `${date}, ${day.completed} of ${day.total} habits completed`;
  }

  protected trackByKey(_: number, day: DaySummary): string {
    return day.key;
  }
}

// --- Date helpers -----------------------------------------------------------

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Local, not ISO: toISOString shifts to UTC and can land on the wrong day. */
function toKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function toLevel(percent: number, completed: number): DaySummary['level'] {
  if (completed === 0) return 0;
  if (percent >= 100) return 4;
  if (percent >= 67) return 3;
  if (percent >= 34) return 2;
  return 1;
}
