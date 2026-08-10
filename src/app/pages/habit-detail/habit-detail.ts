import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { HabitsService } from '../../services/habits';
import type { Habit } from '../../services/habits';
import { HabitLogComponent } from '../../components/habit-log/habit-log.component';
import {
  TrackingSpec,
  minutesToTime,
  timeToMinutes,
  describeTarget,
  formatTrackedValue,
  meetsTarget,
  specForHabit
} from '../../config/habit-library';

@Component({
  selector: 'app-habit-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, HabitLogComponent],
  templateUrl: './habit-detail.html',
  styleUrl: './habit-detail.scss'
})
export class HabitDetailComponent {
  private habitsService = inject(HabitsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected readonly habits = this.habitsService.habits;
  protected habitId = signal<string>('');

  protected readonly habit = computed(() => {
    const id = this.habitId();
    return this.habits().find(h => h.id === id);
  });

  /** What this habit measures, and therefore what its legend says. */
  protected readonly spec = computed<TrackingSpec>(() => {
    const habit = this.habit();
    return habit ? specForHabit(habit) : { kind: 'simple' };
  });

  protected readonly targetLabel = computed(() => describeTarget(this.spec()));

  // --- Backfilling a past day -------------------------------------------

  /**
   * Which day the log dialog is editing.
   *
   * Backfilling matters more for tracked habits than for simple ones: nobody
   * opens the app at 06:40 to record waking up, so without this the value is
   * simply lost.
   */
  protected readonly logDate = signal<Date | null>(null);

  protected readonly logValue = computed(() => {
    const date = this.logDate();
    const habit = this.habit();
    if (!date || !habit) return undefined;
    return this.habitsService.getEntryForDate(habit.id, date)?.value;
  });

  protected openLog(dateString: string): void {
    if (!this.tracksValue()) return;
    // Parsed as local, not UTC: `new Date('2026-08-09')` is midnight UTC and
    // lands on the previous day for anyone west of Greenwich.
    const [y, m, d] = dateString.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (date > new Date()) return;
    this.logDate.set(date);
  }

  protected onLogged(value: number | undefined): void {
    const habit = this.habit();
    const date = this.logDate();
    this.logDate.set(null);
    if (!habit || !date) return;
    this.habitsService.completeHabitOnDate(habit.id, date, value);
  }

  // --- The user's own target --------------------------------------------

  protected readonly editingTarget = signal(false);
  protected readonly draftTarget = signal<number | undefined>(undefined);

  protected startEditingTarget(): void {
    this.draftTarget.set(this.spec().target);
    this.editingTarget.set(true);
  }

  protected saveTarget(): void {
    const habit = this.habit();
    if (habit) this.habitsService.setHabitTarget(habit.id, this.draftTarget());
    this.editingTarget.set(false);
  }

  protected setTargetFromTime(hhmm: string): void {
    this.draftTarget.set(timeToMinutes(hhmm));
  }

  protected setTargetFromNumber(raw: string): void {
    const parsed = Number(raw);
    this.draftTarget.set(raw === '' || !Number.isFinite(parsed) ? undefined : parsed);
  }

  protected readonly draftTargetAsTime = computed(() => minutesToTime(this.draftTarget() ?? 0));
  protected readonly targetIsTime = computed(() => this.spec().kind === 'time-of-day');

  /** True when the grid should show numbers rather than only colours. */
  protected readonly tracksValue = computed(() => this.spec().kind !== 'simple');

  /** Best, worst and average of what was logged — the habit's own summary. */
  protected readonly valueSummary = computed(() => {
    const values = this.completionHistory()
      .map(d => d.value)
      .filter((v): v is number => v !== undefined);

    if (values.length === 0) return null;

    const spec = this.spec();
    const sorted = [...values].sort((a, b) => a - b);
    const better = spec.direction === 'before' || spec.direction === 'at-most' ? sorted[0] : sorted[sorted.length - 1];
    const worse = spec.direction === 'before' || spec.direction === 'at-most' ? sorted[sorted.length - 1] : sorted[0];
    const average = Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);

    return {
      count: values.length,
      best: formatTrackedValue(spec, better),
      worst: formatTrackedValue(spec, worse),
      average: formatTrackedValue(spec, average),
      hitRate: Math.round(
        (values.filter(v => meetsTarget(spec, v)).length / values.length) * 100
      )
    };
  });

  protected readonly completionHistory = computed(() => {
    const habit = this.habit();
    if (!habit) return [];

    const spec = this.spec();
    const history: {
      date: string;
      dayName: string;
      status: string;
      completed: boolean;
      value?: number;
      label: string;
    }[] = [];
    const now = new Date();

    // Get last 30 days
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayName = dayNames[date.getDay()];

      const status = this.habitsService.getEntryStatus(habit.id, dateString);
      const completed = status === 'completed';
      const value = this.habitsService.getEntryForDate(habit.id, date)?.value;

      history.push({
        date: dateString,
        dayName,
        value,
        // Shown inside the cell when there is one: the point of tracking a
        // value is being able to read the trend off the grid at a glance.
        label: value !== undefined ? formatTrackedValue(spec, value) : '',
        status,
        completed
      });
    }

    return history;
  });

  protected readonly stats = computed(() => {
    const habit = this.habit();
    if (!habit) return null;

    const history = this.completionHistory();
    const totalDays = history.length;
    const completedDays = history.filter(h => h.completed).length;
    const completionRate = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

    // Calculate best streak in last 30 days
    let bestStreak = 0;
    let currentStreak = 0;
    for (const day of history) {
      if (day.completed) {
        currentStreak++;
        bestStreak = Math.max(bestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    // Get creation date (first entry)
    const entries = this.habitsService.getHabitEntries(habit.id);
    const createdDate = entries.length > 0
      ? new Date(Math.min(...entries.map(e => new Date(e.date).getTime())))
      : new Date();

    const daysSinceCreation = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

    return {
      completionRate,
      completedDays,
      totalDays,
      bestStreak,
      currentStreak: habit.streak,
      totalPoints: habit.points * completedDays,
      createdDate,
      daysSinceCreation
    };
  });

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.habitId.set(id);

        // Check if habit exists
        if (!this.habit()) {
          this.router.navigate(['/habits']);
        }
      } else {
        this.router.navigate(['/habits']);
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/habits']);
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'skipped': return 'bg-yellow-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-slate-200';
    }
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}
