import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { HabitsService } from '../../services/habits';
import { HabitSimComponent } from '../../components/habit-sim/habit-sim';

interface WeeklyData {
  date: string;
  dayName: string;
  completion: number;
}

interface WeeklySchedule {
  date: string;
  dayName: string;
  dayNumber: number;
  month: string;
  isToday: boolean;
  fullDate: Date;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, HabitSimComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent {
  private habitsService = inject(HabitsService);
  private router = inject(Router);
  
  protected readonly habits = this.habitsService.habits;
  protected readonly gameState = this.habitsService.gameState;
  
  // Category colors matching calendar component
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

  // Category icons
  private categoryIcons: { [key: string]: string } = {
    'health': '💪',
    'productivity': '⚡',
    'learning': '📚',
    'social': '👥',
    'mindfulness': '🧘',
    'creativity': '🎨',
    'finance': '💰',
    'other': '📌'
  };

  // Time-based greeting
  getTimeBasedGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning!';
    if (hour < 17) return 'Good afternoon!';
    return 'Good evening!';
  }

  // Enhanced stats methods
  getOverallProgress(): number {
    return this.habitsService.getOverallProgress();
  }

  getPointsForNextLevel(): number {
    const gameState = this.gameState();
    return 100 - (gameState.totalPoints % 100);
  }

  getLevelProgress(): number {
    const gameState = this.gameState();
    const currentLevelPoints = gameState.totalPoints % 100;
    return currentLevelPoints;
  }

  getStreakDescription(streak: number): string {
    if (streak >= 30) return 'Amazing streak!';
    if (streak >= 14) return 'On fire!';
    if (streak >= 7) return 'Great momentum!';
    if (streak >= 3) return 'Building habits!';
    return 'Getting started';
  }

  getNextStreakMilestone(streak: number): string {
    if (streak < 3) return `${3 - streak} days to first milestone`;
    if (streak < 7) return `${7 - streak} days to weekly streak`;
    if (streak < 14) return `${14 - streak} days to two weeks`;
    if (streak < 30) return `${30 - streak} days to monthly streak`;
    return 'Legendary streak achieved!';
  }

  getStreakIcon(streak: number): string {
    if (streak >= 30) return '🏆';
    if (streak >= 14) return '🔥';
    if (streak >= 7) return '⚡';
    if (streak >= 3) return '🌟';
    return '📅';
  }

  getGoodHabitsCount(): number {
    return this.habits().filter(h => h.type === 'good').length;
  }

  getBadHabitsCount(): number {
    return this.habits().filter(h => h.type === 'bad').length;
  }

  getCompletedHabitsToday(): number {
    const today = new Date();
    return this.habits().filter(habit => 
      this.habitsService.isHabitCompletedOnDate(habit.id, today)
    ).length;
  }

  // Habit interaction methods
  isHabitCompletedToday(habitId: string): boolean {
    return this.habitsService.isHabitCompletedOnDate(habitId, new Date());
  }

  toggleHabitToday(habitId: string): void {
    this.habitsService.toggleHabitForDate(habitId, new Date());
  }

  getCompletionRate(habitId: string): number {
    return this.habitsService.getCompletionRate(habitId);
  }

  getUnlockedAchievements() {
    return this.habitsService.getUnlockedAchievements();
  }

  // Weekly statistics
  getWeeklyCompletionRate(): number {
    const weeklyData = this.getWeeklyData();
    const totalCompletion = weeklyData.reduce((sum, day) => sum + day.completion, 0);
    return Math.round(totalCompletion / weeklyData.length);
  }

  getPerfectDaysThisWeek(): number {
    return this.getWeeklyData().filter(day => day.completion === 100).length;
  }

  getPointsThisWeek(): number {
    // Calculate points earned in the last 7 days
    let totalPoints = 0;
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      this.habits().forEach(habit => {
        if (this.habitsService.isHabitCompletedOnDate(habit.id, date)) {
          totalPoints += habit.points || 10;
        }
      });
    }
    
    return totalPoints;
  }

  getWeeklyData(): WeeklyData[] {
    const data: WeeklyData[] = [];
    const today = new Date();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      const totalHabits = this.habits().length;
      let completedHabits = 0;
      
      if (totalHabits > 0) {
        completedHabits = this.habits().filter(habit => 
          this.habitsService.isHabitCompletedOnDate(habit.id, date)
        ).length;
      }
      
      const completion = totalHabits > 0 ? Math.round((completedHabits / totalHabits) * 100) : 0;
      
      data.push({
        date: date.toLocaleDateString(),
        dayName: dayNames[date.getDay()],
        completion
      });
    }
    
    return data;
  }

  // Category methods
  getUniqueCategories(): string[] {
    const categories = new Set(this.habits().map(h => h.category || 'other'));
    return Array.from(categories);
  }

  getHabitsByCategory(category: string) {
    return this.habits().filter(h => (h.category || 'other') === category);
  }

  getCategoryProgress(category: string): number {
    const habitsInCategory = this.getHabitsByCategory(category);
    if (habitsInCategory.length === 0) return 0;
    
    const today = new Date();
    const completedHabits = habitsInCategory.filter(habit => 
      this.habitsService.isHabitCompletedOnDate(habit.id, today)
    ).length;
    
    return Math.round((completedHabits / habitsInCategory.length) * 100);
  }

  getCategoryDisplayName(category: string): string {
    return category.charAt(0).toUpperCase() + category.slice(1);
  }

  getCategoryColor(category: string): string {
    return this.categoryColors[category] || this.categoryColors['other'];
  }

  getCategoryIcon(category: string): string {
    return this.categoryIcons[category] || this.categoryIcons['other'];
  }

  filterByCategory(category: string): void {
    // Navigate to habits page with category filter
    this.router.navigate(['/habits'], { queryParams: { category } });
  }

  getHabitTypeIcon(type: 'good' | 'bad'): string {
    return type === 'good' ? '✅' : '🚫';
  }

  // Weekly Schedule methods
  getWeeklySchedule(): WeeklySchedule[] {
    const schedule: WeeklySchedule[] = [];
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Calculate the start of the week (Sunday)
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - currentDay);
    
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      
      const isToday = this.isSameDay(date, today);
      
      schedule.push({
        date: date.toISOString(),
        dayName: dayNames[i],
        dayNumber: date.getDate(),
        month: monthNames[date.getMonth()],
        isToday,
        fullDate: date
      });
    }
    
    return schedule;
  }

  isHabitCompletedOnDate(habitId: string, date: Date): boolean {
    return this.habitsService.isHabitCompletedOnDate(habitId, date);
  }

  toggleHabitForDate(habitId: string, date: Date): void {
    this.habitsService.toggleHabitForDate(habitId, date);
  }

  // Weekly table calculation methods
  getHabitWeeklyPoints(habitId: string): number {
    const habit = this.habits().find(h => h.id === habitId);
    if (!habit) return 0;

    let totalPoints = 0;
    const schedule = this.getWeeklySchedule();
    
    schedule.forEach(day => {
      if (this.isHabitCompletedOnDate(habitId, day.fullDate)) {
        if (habit.type === 'good') {
          totalPoints += habit.points || 10;
        } else {
          totalPoints -= habit.points || 10;
        }
      }
    });
    
    return totalPoints;
  }

  getHabitWeeklyCompletions(habitId: string): number {
    const schedule = this.getWeeklySchedule();
    return schedule.filter(day => 
      this.isHabitCompletedOnDate(habitId, day.fullDate)
    ).length;
  }

  getDailyTotalPoints(date: Date): number {
    let totalPoints = 0;
    
    this.habits().forEach(habit => {
      if (this.isHabitCompletedOnDate(habit.id, date)) {
        if (habit.type === 'good') {
          totalPoints += habit.points || 10;
        } else {
          totalPoints -= habit.points || 10;
        }
      }
    });
    
    return totalPoints;
  }

  getWeeklyTotalPoints(): number {
    let totalPoints = 0;
    const schedule = this.getWeeklySchedule();
    
    schedule.forEach(day => {
      totalPoints += this.getDailyTotalPoints(day.fullDate);
    });
    
    return totalPoints;
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }
}
