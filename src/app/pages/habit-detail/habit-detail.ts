import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { HabitsService } from '../../services/habits';
import type { Habit } from '../../services/habits';

@Component({
  selector: 'app-habit-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
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

  protected readonly completionHistory = computed(() => {
    const habit = this.habit();
    if (!habit) return [];

    const history: { date: string; dayName: string; status: string; completed: boolean }[] = [];
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

      history.push({
        date: dateString,
        dayName,
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
