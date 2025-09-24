import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HabitsService, Habit } from '../../services/habits';

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
}

interface StreakInfo {
  hasStreak: boolean;
  streakLength: number;
}

type ViewMode = 'overview' | 'detailed';
type FilterType = 'all' | 'good' | 'bad' | string;

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss'
})
export class CalendarComponent implements OnInit {
  private habitsService = inject(HabitsService);
  
  protected readonly habits = this.habitsService.habits;
  protected readonly gameState = this.habitsService.gameState;
  
  protected currentDate = new Date();
  protected calendarDays: CalendarDay[] = [];
  protected dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  protected viewMode: ViewMode = 'overview';
  protected activeFilter: FilterType = 'all';
  protected selectedDay: Date | null = null;

  // Category colors for visual distinction
  private categoryColors: { [key: string]: string } = {
    'health': '#10b981',
    'productivity': '#3b82f6',
    'learning': '#8b5cf6',
    'social': '#ec4899',
    'mindfulness': '#6366f1',
    'creativity': '#f97316',
    'finance': '#eab308',
    'other': '#6b7280'
  };

  ngOnInit(): void {
    this.generateCalendarDays();
  }

  // Calendar Navigation
  protected previousMonth(): void {
    this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1);
    this.generateCalendarDays();
  }

  protected nextMonth(): void {
    this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 1);
    this.generateCalendarDays();
  }

  protected goToToday(): void {
    this.currentDate = new Date();
    this.generateCalendarDays();
  }

  // View Mode Controls
  protected setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
  }

  // Filter Controls
  protected toggleFilter(filter: FilterType): void {
    this.activeFilter = filter;
  }

  protected getFilteredHabits(): Habit[] {
    const allHabits = this.habits();
    
    switch (this.activeFilter) {
      case 'all':
        return allHabits;
      case 'good':
        return allHabits.filter(h => h.type === 'good');
      case 'bad':
        return allHabits.filter(h => h.type === 'bad');
      default:
        return allHabits.filter(h => h.category === this.activeFilter);
    }
  }

  // Calendar Generation
  private generateCalendarDays(): void {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    
    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);
    
    // Days to show from previous month
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    // Days to show from next month
    const endDate = new Date(lastDay);
    const daysToAdd = 6 - lastDay.getDay();
    endDate.setDate(endDate.getDate() + daysToAdd);
    
    this.calendarDays = [];
    const currentDate = new Date(startDate);
    const today = new Date();
    
    while (currentDate <= endDate) {
      this.calendarDays.push({
        date: new Date(currentDate),
        isCurrentMonth: currentDate.getMonth() === month,
        isToday: this.isSameDay(currentDate, today)
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  // Date Utilities
  protected getCurrentMonthYear(): string {
    return this.currentDate.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
  }

  protected getTotalDaysInMonth(): number {
    return new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0).getDate();
  }

  protected getCompletedDaysInMonth(): number {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    
    let completedDays = 0;
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      
      // Only count days up to today
      if (date <= today && this.getDayProgress(date) === 100) {
        completedDays++;
      }
    }
    
    return completedDays;
  }

  protected getTodayDate(): number {
    return new Date().getDate();
  }

  // Enhanced Statistics
  protected getDayProgress(date: Date): number {
    const filteredHabits = this.getFilteredHabits();
    if (filteredHabits.length === 0) return 0;
    
    const completedHabits = filteredHabits.filter(habit => 
      this.isHabitCompletedOnDate(habit.id, date)
    ).length;
    
    return Math.round((completedHabits / filteredHabits.length) * 100);
  }

  protected getMonthProgress(): number {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    
    let totalDays = 0;
    let completedDays = 0;
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      
      // Only count days up to today
      if (date <= today) {
        totalDays++;
        if (this.getDayProgress(date) === 100) {
          completedDays++;
        }
      }
    }
    
    return totalDays === 0 ? 0 : Math.round((completedDays / totalDays) * 100);
  }

  protected getCurrentStreak(): number {
    let streak = 0;
    const today = new Date();
    let currentDate = new Date(today);
    
    while (true) {
      if (this.getDayProgress(currentDate) === 100) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }
    
    return streak;
  }

  protected getBestStreak(): number {
    const habits = this.habits();
    if (habits.length === 0) return 0;
    
    return Math.max(...habits.map(habit => habit.bestStreak || 0));
  }

  protected getPerfectDays(): number {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    
    let perfectDays = 0;
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      
      // Only count days up to today
      if (date <= today && this.getDayProgress(date) === 100) {
        perfectDays++;
      }
    }
    
    return perfectDays;
  }

  protected getPerfectDaysPercentage(): number {
    const totalDays = this.getCompletedDaysInMonth();
    const perfectDays = this.getPerfectDays();
    return totalDays === 0 ? 0 : Math.round((perfectDays / totalDays) * 100);
  }

  protected getGoodHabitsCount(): number {
    return this.habits().filter(h => h.type === 'good').length;
  }

  protected getBadHabitsCount(): number {
    return this.habits().filter(h => h.type === 'bad').length;
  }

  protected getAverageCompletion(): number {
    const today = new Date();
    let totalProgress = 0;
    let daysCount = 0;
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      totalProgress += this.getDayProgress(date);
      daysCount++;
    }
    
    return daysCount === 0 ? 0 : Math.round(totalProgress / daysCount);
  }

  // Category and Filter Utilities
  protected getUniqueCategories(): string[] {
    const categories = new Set(this.habits().map(h => h.category || 'other'));
    return Array.from(categories);
  }

  protected getCategoryDisplayName(category: string): string {
    return category.charAt(0).toUpperCase() + category.slice(1);
  }

  protected getHabitsInCategory(category: string): Habit[] {
    return this.habits().filter(h => (h.category || 'other') === category);
  }

  protected getCategoryColor(category: string): string {
    return this.categoryColors[category] || this.categoryColors['other'];
  }

  // Habit Display Utilities
  protected getShortHabitName(name: string): string {
    return name.length > 12 ? name.substring(0, 12) + '...' : name;
  }

  protected getHabitTooltip(habit: Habit, date: Date): string {
    const isCompleted = this.isHabitCompletedOnDate(habit.id, date);
    const streak = this.getHabitStreakForDate(habit.id, date);
    const status = isCompleted ? 'Completed' : 'Not completed';
    
    return `${habit.name}\n${status}\nStreak: ${streak} days\nCategory: ${habit.category}\nDifficulty: ${habit.difficulty}`;
  }

  // Streak Information
  protected getDayStreakInfo(date: Date): StreakInfo {
    const progress = this.getDayProgress(date);
    if (progress < 100) return { hasStreak: false, streakLength: 0 };
    
    let streak = 0;
    const currentDate = new Date(date);
    
    while (this.getDayProgress(currentDate) === 100) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    }
    
    return { hasStreak: streak >= 3, streakLength: streak };
  }

  protected getHabitStreakForDate(habitId: string, date: Date): number {
    let streak = 0;
    const currentDate = new Date(date);
    
    while (this.isHabitCompletedOnDate(habitId, currentDate)) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    }
    
    return streak;
  }

  // Day Details
  protected getCompletedHabitsForDay(date: Date): number {
    return this.getFilteredHabits().filter(habit => 
      this.isHabitCompletedOnDate(habit.id, date)
    ).length;
  }

  protected getDayMood(date: Date): string | null {
    // Placeholder for future mood tracking feature
    return null;
  }

  protected getDayMoodEmoji(date: Date): string {
    const mood = this.getDayMood(date);
    const moodEmojis: { [key: string]: string } = {
      'great': '😄',
      'good': '😊',
      'okay': '😐',
      'bad': '😞',
      'terrible': '😫'
    };
    return mood ? moodEmojis[mood] || '😐' : '😐';
  }

  // Day Details Modal
  protected openDayDetails(date: Date): void {
    this.selectedDay = date;
  }

  protected closeDayDetails(): void {
    this.selectedDay = null;
  }

  protected formatDateFull(date: Date): string {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  protected markAllComplete(date: Date): void {
    this.habits().forEach(habit => {
      if (!this.isHabitCompletedOnDate(habit.id, date)) {
        this.habitsService.toggleHabitForDate(habit.id, date);
      }
    });
  }

  protected markAllIncomplete(date: Date): void {
    this.habits().forEach(habit => {
      if (this.isHabitCompletedOnDate(habit.id, date)) {
        this.habitsService.toggleHabitForDate(habit.id, date);
      }
    });
  }

  // Habit Interaction
  protected isHabitCompletedOnDate(habitId: string, date: Date): boolean {
    return this.habitsService.isHabitCompletedOnDate(habitId, date);
  }

  protected toggleHabitForDate(habitId: string, date: Date): void {
    // Only allow toggling for current month days
    const calendarDay = this.calendarDays.find(day => 
      this.isSameDay(day.date, date)
    );
    
    if (calendarDay?.isCurrentMonth) {
      this.habitsService.toggleHabitForDate(habitId, date);
    }
  }

  // TrackBy Functions for Performance
  protected trackByDate(index: number, day: CalendarDay): string {
    return day.date.toISOString();
  }

  protected trackByHabit(index: number, habit: Habit): string {
    return habit.id;
  }
}