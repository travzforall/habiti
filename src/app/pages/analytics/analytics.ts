import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HabitsService } from '../../services/habits';

interface MetricCard {
  title: string;
  value: string | number;
  subtitle: string;
  icon: string;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'stable';
  };
  color: string;
}

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './analytics.html',
  styleUrl: './analytics.scss'
})
export class AnalyticsComponent {
  private habitsService = inject(HabitsService);

  protected readonly habits = this.habitsService.habits;
  protected readonly gameState = this.habitsService.gameState;

  // Computed metrics
  // Completion rate timeline data (last 7 days)
  protected readonly completionTimeline = computed(() => {
    const habits = this.habits();
    const timeline: { date: string; dayName: string; rate: number; completed: number; total: number }[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayName = dayNames[date.getDay()];

      const activeHabits = habits.filter(h => h.isActive !== false);
      const completedCount = activeHabits.filter(h =>
        this.habitsService.getEntryStatus(h.id, dateString) === 'completed'
      ).length;

      const rate = activeHabits.length > 0
        ? Math.round((completedCount / activeHabits.length) * 100)
        : 0;

      timeline.push({
        date: dateString,
        dayName,
        rate,
        completed: completedCount,
        total: activeHabits.length
      });
    }

    return timeline;
  });

  // Habit comparison data
  protected readonly habitComparison = computed(() => {
    const habits = this.habits();

    return habits
      .filter(h => h.isActive !== false)
      .map(h => ({
        id: h.id,
        name: h.name,
        completionRate: this.habitsService.getCompletionRate(h.id),
        streak: h.streak,
        points: h.points,
        category: h.category || 'Other',
        type: h.type
      }))
      .sort((a, b) => b.completionRate - a.completionRate)
      .slice(0, 10); // Top 10 habits
  });

  protected readonly metrics = computed(() => {
    const habits = this.habits();
    const gameState = this.gameState();

    const totalHabits = habits.length;
    const goodHabits = habits.filter(h => h.type === 'good').length;
    const badHabits = habits.filter(h => h.type === 'bad').length;

    // Calculate overall completion rate (today)
    const today = new Date().toISOString().split('T')[0];
    const todayHabits = habits.filter(h => h.isActive !== false);
    const completedToday = todayHabits.filter(h => {
      return this.habitsService.getEntryStatus(h.id, today) === 'completed';
    });
    const completionRate = todayHabits.length > 0
      ? Math.round((completedToday.length / todayHabits.length) * 100)
      : 0;

    // Calculate average streak across all habits
    const avgStreak = habits.length > 0
      ? Math.round(habits.reduce((sum, h) => sum + h.streak, 0) / habits.length)
      : 0;

    // Active days this month (days with at least one habit completed)
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const activeDays = new Set<string>();

    // Get all dates from month start to now
    const currentDate = new Date(monthStart);
    while (currentDate <= now) {
      const dateString = currentDate.toISOString().split('T')[0];

      // Check if any habit was completed on this date
      const hasCompletion = habits.some(h =>
        this.habitsService.getEntryStatus(h.id, dateString) === 'completed'
      );

      if (hasCompletion) {
        activeDays.add(dateString);
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    const cards: MetricCard[] = [
      {
        title: 'Total Habits Tracked',
        value: totalHabits,
        subtitle: `${goodHabits} good, ${badHabits} to break`,
        icon: '📋',
        color: 'bg-blue-500'
      },
      {
        title: 'Overall Completion Rate',
        value: `${completionRate}%`,
        subtitle: `${completedToday.length}/${todayHabits.length} completed today`,
        icon: '✅',
        trend: completionRate >= 80 ? { value: completionRate, direction: 'up' } :
               completionRate >= 50 ? { value: completionRate, direction: 'stable' } :
               { value: completionRate, direction: 'down' },
        color: 'bg-green-500'
      },
      {
        title: 'Current Streak',
        value: gameState.dailyStreak,
        subtitle: `Avg: ${avgStreak} days across all habits`,
        icon: '🔥',
        color: 'bg-orange-500'
      },
      {
        title: 'Total Points Earned',
        value: gameState.totalPoints.toLocaleString(),
        subtitle: `Level ${gameState.level}`,
        icon: '⭐',
        color: 'bg-purple-500'
      },
      {
        title: 'Active Days This Month',
        value: activeDays.size,
        subtitle: `${Math.round((activeDays.size / now.getDate()) * 100)}% of days`,
        icon: '📅',
        color: 'bg-indigo-500'
      },
      {
        title: 'Average Daily Completion',
        value: `${Math.round(completionRate)}%`,
        subtitle: 'Last 30 days',
        icon: '📊',
        color: 'bg-teal-500'
      }
    ];

    return cards;
  });
}
