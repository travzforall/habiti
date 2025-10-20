import { Component, inject, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { HabitsService } from '../../services/habits';
// import { HabitSimComponent } from '../../components/habit-sim/habit-sim';
import { AuthService, User } from '../../services/auth.service';
import { TasksService } from '../../services/tasks.service';
// import { ProjectsService } from '../../services/projects.service';
import { Observable } from 'rxjs';

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
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit {
  private habitsService = inject(HabitsService);
  private authService = inject(AuthService);
  private tasksService = inject(TasksService);
  // private projectsService = inject(ProjectsService);
  protected router = inject(Router);
  
  protected readonly habits = this.habitsService.habits;
  protected readonly gameState = this.habitsService.gameState;
  protected readonly todaysTasks = this.tasksService.todaysTasks;
  protected readonly overdueTasks = this.tasksService.overdueTasks;
  // protected readonly projects = this.projectsService.projects;
  protected currentUser$: Observable<User | null> = this.authService.currentUser;
  protected currentUser: User | null = null;
  
  // Week navigation
  protected currentWeekOffset = signal(0);
  
  // Computed weekly schedule
  protected readonly weeklySchedule = computed(() => {
    const offset = this.currentWeekOffset();
    
    const schedule: WeeklySchedule[] = [];
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Calculate the start of the week (Sunday) with offset
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - currentDay + (offset * 7));
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      
      const isToday = offset === 0 && this.isSameDay(date, today);
      
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
  });
  
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

  ngOnInit(): void {
    // Subscribe to current user
    this.currentUser$ = this.authService.currentUser;
    this.currentUser$.subscribe(user => {
      this.currentUser = user;
      // If we have a user but no full data, fetch it
      if (user && !user.bio && !user.profile_picture) {
        this.authService.getCurrentUser().subscribe({
          next: (fullUser) => {
            this.currentUser = fullUser;
          },
          error: (error) => {
            console.error('Error fetching user data:', error);
          }
        });
      }
    });

    // Create sample tasks if none exist
    if (this.tasksService.standaloneTasks().length === 0) {
      this.tasksService.createSampleTasks();
    }
  }

  // Format date for display
  formatDate(dateInput: string | number): string {
    if (!dateInput) return '';
    
    // Handle timestamp (number in milliseconds)
    const date = typeof dateInput === 'number' 
      ? new Date(dateInput) 
      : new Date(dateInput);
    
    if (isNaN(date.getTime())) return '';
    
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  // Calculate age from date of birth
  calculateAge(dateOfBirth: string): number | null {
    if (!dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

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

  private lastToggleTime: { [key: string]: number } = {};

  toggleHabitToday(habitId: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    
    // Debounce rapid clicks on the same habit
    const now = Date.now();
    if (this.lastToggleTime[habitId] && now - this.lastToggleTime[habitId] < 300) {
      return;
    }
    this.lastToggleTime[habitId] = now;
    
    console.log('Toggling habit today:', habitId); // Debug log
    
    // Use setTimeout to avoid change detection issues
    setTimeout(() => {
      this.habitsService.toggleHabitForDate(habitId, new Date());
    }, 0);
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
    const schedule = this.weeklySchedule();
    
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
    const schedule = this.weeklySchedule();
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
    const schedule = this.weeklySchedule();
    
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

  // Task management methods
  toggleTask(taskId: string): void {
    this.tasksService.toggleTask(taskId);
  }

  getPriorityColor(priority: string): string {
    const colors = {
      low: '#10b981',
      medium: '#f59e0b',
      high: '#ef4444',
      urgent: '#dc2626'
    };
    return colors[priority as keyof typeof colors] || '#6b7280';
  }

  isTaskOverdue(dueDate: Date | undefined): boolean {
    if (!dueDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
  }

  isTaskDueToday(dueDate: Date | undefined): boolean {
    if (!dueDate) return false;
    const today = new Date();
    return dueDate.toDateString() === today.toDateString();
  }

  formatTaskDate(date: Date | undefined): string {
    if (!date) return '';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  }

  // Project methods for dashboard - Temporarily disabled
  /*
  getProjectTodaysTasks(projectId: string) {
    const project = this.projects().find(p => p.id === projectId);
    if (!project) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return project.tasks.filter(task => {
      if (!task.dueDate) return false;
      const taskDate = new Date(task.dueDate);
      taskDate.setHours(0, 0, 0, 0);
      return taskDate >= today && taskDate < tomorrow;
    });
  }

  /*
  getProjectProgress(projectId: string): number {
    const project = this.projects().find(p => p.id === projectId);
    if (!project || project.tasks.length === 0) return 0;
    
    const completedTasks = project.tasks.filter(task => task.completed).length;
    return Math.round((completedTasks / project.tasks.length) * 100);
  }

  getProjectColor(projectId: string): string {
    const project = this.projects().find(p => p.id === projectId);
    if (!project) return '#6b7280';
    
    const colors = [
      '#3b82f6', // blue
      '#10b981', // green
      '#f59e0b', // amber
      '#ec4899', // pink
      '#8b5cf6', // purple
      '#ef4444', // red
      '#06b6d4', // cyan
      '#84cc16'  // lime
    ];
    
    // Use project ID to consistently assign a color
    const index = project.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  }

  navigateToProject(projectId: string): void {
    this.router.navigate(['/projects'], { queryParams: { project: projectId } });
  }
  */

  // Week navigation methods
  goToPreviousWeek(): void {
    console.log('Previous week clicked! Current offset:', this.currentWeekOffset());
    this.currentWeekOffset.update(offset => offset - 1);
    console.log('New offset:', this.currentWeekOffset());
  }

  goToNextWeek(): void {
    console.log('Next week clicked! Current offset:', this.currentWeekOffset());
    this.currentWeekOffset.update(offset => offset + 1);
    console.log('New offset:', this.currentWeekOffset());
  }

  goToCurrentWeek(): void {
    console.log('Current week clicked!');
    this.currentWeekOffset.set(0);
    console.log('Reset to offset:', this.currentWeekOffset());
  }
}
