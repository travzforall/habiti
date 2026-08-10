import { Component, inject, OnInit, OnDestroy, computed, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { Subject, interval, fromEvent } from 'rxjs';
import { takeUntil, debounceTime, filter } from 'rxjs/operators';

import { HabitsService } from '../../services/habits';
import { AuthService, User } from '../../services/auth.service';
import { TasksService } from '../../services/tasks.service';
import { ToastService } from '../../services/toast.service';
import { StatusAvatarComponent } from '../../components/status-avatar/status-avatar.component';
import { DailyInspirationComponent } from '../../components/daily-inspiration/daily-inspiration.component';
import { LevelHistoryComponent } from '../../components/level-history/level-history.component';
import { calculateAge, parseDateOnly } from '../../utils/age.util';
import { ChallengeService } from '../../services/challenge.service';
import { SkillsService } from '../../services/skills.service';
import { SkillStripComponent } from '../../components/skill-strip/skill-strip.component';
import { SyncService } from '../../services/sync.service';
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  PRIORITY_COLORS,
  DAY_NAMES,
  DAY_NAMES_SHORT,
  MONTH_NAMES,
  DASHBOARD_CONFIG,
  KEYBOARD_SHORTCUTS,
  getCategoryColor,
  getCategoryIcon,
  getPriorityColor,
  isSameDay,
  getStartOfWeek,
  getWeekDates
} from '../../config/dashboard.config';

// Interfaces
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

interface DashboardState {
  isLoading: boolean;
  isRefreshing: boolean;
  isOnline: boolean;
  lastSyncTime: Date | null;
  syncError: string | null;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    StatusAvatarComponent,
    DailyInspirationComponent,
    LevelHistoryComponent,
    SkillStripComponent
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  // Services
  private readonly habitsService = inject(HabitsService);
  private readonly authService = inject(AuthService);
  private readonly tasksService = inject(TasksService);
  private readonly toastService = inject(ToastService);
  protected readonly router = inject(Router);

  // Destroy subject for cleanup
  private readonly destroy$ = new Subject<void>();

  // Toggle debounce subject
  private readonly toggleSubject$ = new Subject<{ habitId: string; date: Date }>();

  // Dashboard state
  protected readonly dashboardState = signal<DashboardState>({
    isLoading: true,
    isRefreshing: false,
    isOnline: navigator.onLine,
    lastSyncTime: null,
    syncError: null
  });

  // Service signals
  protected readonly habits = this.habitsService.habits;

  // ---------------------------------------------------------------------------
  // Filters
  //
  // Replaced the keyboard-shortcuts card, which was a reference sheet nobody
  // needed twice. The shortcuts still work — they are just not documented in a
  // permanent panel.
  // ---------------------------------------------------------------------------

  private challengeService = inject(ChallengeService);
  private skillsService = inject(SkillsService);

  /**
   * Drives the @defer around the strip, so the skill catalogue is only fetched
   * for someone who actually has a skill. The dashboard is loaded eagerly.
   */
  protected readonly hasSkills = computed(() => this.skillsService.activeTracks().length > 0);
  protected readonly sync = inject(SyncService);

  protected readonly filterType = signal<'all' | 'good' | 'bad'>('all');
  protected readonly filterCategory = signal<string>('all');
  protected readonly filterChallenge = signal<string>('all');
  protected readonly filterPartner = signal<string>('all');
  protected readonly filterStatus = signal<'all' | 'pending' | 'done'>('all');

  protected readonly activeChallenges = this.challengeService.activeRuns;

  /** Categories actually in use — an empty dropdown helps nobody. */
  protected readonly availableCategories = computed(() =>
    [...new Set(this.habits().map(h => h.category).filter((c): c is string => !!c))].sort()
  );

  /** People you share a running challenge with. */
  protected readonly challengePartners = computed(() => {
    const seen = new Map<string, { userId: string; name: string }>();
    for (const run of this.activeChallenges()) {
      for (const p of run.participants ?? []) {
        if (p.isOwner || p.inviteStatus !== 'accepted') continue;
        if (!seen.has(p.userId)) seen.set(p.userId, { userId: p.userId, name: p.name });
      }
    }
    return [...seen.values()];
  });

  protected readonly hasActiveFilters = computed(
    () =>
      this.filterType() !== 'all' ||
      this.filterCategory() !== 'all' ||
      this.filterChallenge() !== 'all' ||
      this.filterPartner() !== 'all' ||
      this.filterStatus() !== 'all'
  );

  /** The habit list every filtered view reads. */
  protected readonly filteredHabits = computed(() => {
    const type = this.filterType();
    const category = this.filterCategory();
    const challengeId = this.filterChallenge();
    const partnerId = this.filterPartner();
    const status = this.filterStatus();

    // Challenge and partner both narrow to a set of habit ids.
    let habitIds: Set<string> | null = null;

    if (challengeId !== 'all') {
      const run = this.activeChallenges().find(r => r.id === challengeId);
      habitIds = new Set(run?.terms.habitIds ?? []);
    }

    if (partnerId !== 'all') {
      const ids = new Set<string>();
      for (const run of this.activeChallenges()) {
        const shared = (run.participants ?? []).some(
          p => p.userId === partnerId && p.inviteStatus === 'accepted'
        );
        if (shared) (run.terms.habitIds ?? []).forEach(id => ids.add(id));
      }
      habitIds = habitIds ? new Set([...habitIds].filter(id => ids.has(id))) : ids;
    }

    return this.habits().filter(habit => {
      if (type !== 'all' && habit.type !== type) return false;
      if (category !== 'all' && habit.category !== category) return false;
      if (habitIds && !habitIds.has(habit.id)) return false;

      if (status !== 'all') {
        const done = this.habitsService.isHabitCompletedToday(habit.id);
        if (status === 'done' && !done) return false;
        if (status === 'pending' && done) return false;
      }

      return true;
    });
  });

  protected clearFilters(): void {
    this.filterType.set('all');
    this.filterCategory.set('all');
    this.filterChallenge.set('all');
    this.filterPartner.set('all');
    this.filterStatus.set('all');
  }

  protected readonly habitEntries = this.habitsService.habitEntries;
  protected readonly gameState = this.habitsService.gameState;
  protected readonly todaysTasks = this.tasksService.todaysTasks;
  protected readonly overdueTasks = this.tasksService.overdueTasks;

  // User state
  protected readonly currentUser = signal<User | null>(null);

  // Week navigation
  protected readonly currentWeekOffset = signal(0);

  // Keyboard navigation
  protected readonly selectedHabitIndex = signal(-1);

  // Computed: Weekly schedule
  protected readonly weeklySchedule = computed(() => {
    const offset = this.currentWeekOffset();
    const today = new Date();
    const startOfWeek = getStartOfWeek(today, offset);
    const weekDates = getWeekDates(startOfWeek);

    return weekDates.map((date, index) => ({
      date: date.toISOString(),
      dayName: DAY_NAMES[index],
      dayNumber: date.getDate(),
      month: MONTH_NAMES[date.getMonth()],
      isToday: offset === 0 && isSameDay(date, today),
      fullDate: date
    }));
  });

  // Helper to check completion from entries map
  private isCompletedOnDate(entries: Map<string, any>, habitId: string, date: Date): boolean {
    const dateString = this.formatDateKey(date);
    const key = `${habitId}-${dateString}`;
    return entries.get(key)?.status === 'completed';
  }

  // Format date for entry key lookup
  private formatDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Computed: Weekly data (memoized)
  protected readonly weeklyData = computed(() => {
    const data: WeeklyData[] = [];
    const today = new Date();
    const habitsList = this.habits();
    // Access habitEntries signal directly within computed for proper reactivity
    const entries = this.habitEntries();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      const totalHabits = habitsList.length;
      let completedHabits = 0;

      if (totalHabits > 0) {
        completedHabits = habitsList.filter(habit =>
          this.isCompletedOnDate(entries, habit.id, date)
        ).length;
      }

      const completion = totalHabits > 0 ? Math.round((completedHabits / totalHabits) * 100) : 0;

      data.push({
        date: date.toLocaleDateString(),
        dayName: DAY_NAMES_SHORT[date.getDay()],
        completion
      });
    }

    return data;
  });

  // Computed: Daily points cache (memoized)
  protected readonly dailyPointsCache = computed(() => {
    const cache = new Map<string, number>();
    const schedule = this.weeklySchedule();
    const habitsList = this.habits();
    // Access habitEntries signal directly within computed for proper reactivity
    const entries = this.habitEntries();

    schedule.forEach(day => {
      let totalPoints = 0;
      habitsList.forEach(habit => {
        // Ensure points is a number (may come as string from database)
        const habitPoints = Number(habit.points) || 10;
        if (this.isCompletedOnDate(entries, habit.id, day.fullDate)) {
          if (habit.type === 'good') {
            totalPoints += habitPoints;
          } else {
            totalPoints -= habitPoints;
          }
        }
      });
      cache.set(day.date, totalPoints);
    });

    return cache;
  });

  // Computed: Habit weekly points cache (memoized)
  protected readonly habitWeeklyPointsCache = computed(() => {
    const cache = new Map<string, { points: number; completions: number }>();
    const schedule = this.weeklySchedule();
    const habitsList = this.habits();
    // Access habitEntries signal directly within computed for proper reactivity
    const entries = this.habitEntries();

    habitsList.forEach(habit => {
      let totalPoints = 0;
      let completions = 0;
      // Ensure points is a number (may come as string from database)
      const habitPoints = Number(habit.points) || 10;

      schedule.forEach(day => {
        if (this.isCompletedOnDate(entries, habit.id, day.fullDate)) {
          completions++;
          if (habit.type === 'good') {
            totalPoints += habitPoints;
          } else {
            totalPoints -= habitPoints;
          }
        }
      });

      cache.set(habit.id, { points: totalPoints, completions });
    });

    return cache;
  });

  // Computed: Weekly total points
  protected readonly weeklyTotalPoints = computed(() => {
    const cache = this.dailyPointsCache();
    let total = 0;
    cache.forEach(points => total += points);
    return total;
  });

  // Computed: Good/Bad habits count
  protected readonly goodHabitsCount = computed(() =>
    this.habits().filter(h => h.type === 'good').length
  );

  protected readonly badHabitsCount = computed(() =>
    this.habits().filter(h => h.type === 'bad').length
  );

  // Computed: Completed habits today
  protected readonly completedHabitsToday = computed(() => {
    const today = new Date();
    // Access habitEntries signal directly within computed for proper reactivity
    const entries = this.habitEntries();
    return this.habits().filter(habit =>
      this.isCompletedOnDate(entries, habit.id, today)
    ).length;
  });

  // Computed: Unique categories
  protected readonly uniqueCategories = computed(() => {
    const categories = new Set(this.habits().map(h => h.category || 'other'));
    return Array.from(categories);
  });

  // Computed: Habits grouped by category for weekly table
  protected readonly habitsByCategory = computed(() => {
    const habitsList = this.habits();
    const grouped = new Map<string, typeof habitsList>();

    // Group habits by category
    habitsList.forEach(habit => {
      const category = habit.category || 'other';
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(habit);
    });

    // Convert to array and sort categories alphabetically (but 'other' last)
    const sortedCategories = Array.from(grouped.entries()).sort((a, b) => {
      if (a[0] === 'other') return 1;
      if (b[0] === 'other') return -1;
      return a[0].localeCompare(b[0]);
    });

    return sortedCategories;
  });

  ngOnInit(): void {
    this.initializeComponent();
    this.setupToggleDebounce();
    this.loadUserData();
    this.createSampleTasksIfNeeded();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeComponent(): void {
    // Simulate initial loading
    setTimeout(() => {
      this.dashboardState.update(state => ({
        ...state,
        isLoading: false,
        lastSyncTime: new Date()
      }));
    }, 500);
  }

  private setupToggleDebounce(): void {
    this.toggleSubject$.pipe(
      debounceTime(DASHBOARD_CONFIG.toggleDebounceTime),
      takeUntil(this.destroy$)
    ).subscribe(({ habitId, date }) => {
      try {
        this.habitsService.toggleHabitForDate(habitId, date);
        this.toastService.success('Habit updated', 'Your progress has been saved');
      } catch (error) {
        console.error('Error toggling habit:', error);
        this.toastService.error('Update failed', 'Could not save your progress. Please try again.');
      }
    });
  }

  // setupAutoRefresh() removed — SyncService owns cadence app-wide.

  // setupOnlineStatusListener() removed — SyncService owns online/offline,
  // deduped so a flaky connection does not toast repeatedly.

  private loadUserData(): void {
    this.authService.currentUser.pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (user) => {
        this.currentUser.set(user);
        if (user && !user.bio && !user.profile_picture) {
          this.fetchFullUserData();
        }
      },
      error: (error) => {
        console.error('Error loading user data:', error);
        this.toastService.error('Error', 'Could not load user profile');
      }
    });
  }

  private fetchFullUserData(): void {
    this.authService.getCurrentUser().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (fullUser) => {
        this.currentUser.set(fullUser);
      },
      error: (error) => {
        console.error('Error fetching full user data:', error);
      }
    });
  }

  private createSampleTasksIfNeeded(): void {
    if (this.tasksService.standaloneTasks().length === 0) {
      this.tasksService.createSampleTasks();
    }
  }

  // Keyboard navigation
  @HostListener('document:keydown', ['$event'])
  handleKeyboardNavigation(event: KeyboardEvent): void {
    // Ignore if user is typing in an input
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    const habitsList = this.habits();

    switch (event.key) {
      case KEYBOARD_SHORTCUTS.nextHabit:
        event.preventDefault();
        this.selectedHabitIndex.update(i =>
          Math.min(i + 1, habitsList.length - 1)
        );
        break;

      case KEYBOARD_SHORTCUTS.prevHabit:
        event.preventDefault();
        this.selectedHabitIndex.update(i => Math.max(i - 1, 0));
        break;

      case KEYBOARD_SHORTCUTS.toggleHabit:
        event.preventDefault();
        const index = this.selectedHabitIndex();
        if (index >= 0 && index < habitsList.length) {
          this.toggleHabitToday(habitsList[index].id);
        }
        break;

      case KEYBOARD_SHORTCUTS.refresh:
        if (!event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          this.refreshDashboard();
        }
        break;

      case KEYBOARD_SHORTCUTS.goToHabits:
        if (!event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          this.router.navigate(['/habits']);
        }
        break;

      case KEYBOARD_SHORTCUTS.goToTasks:
        if (!event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          this.router.navigate(['/tasks']);
        }
        break;

      case KEYBOARD_SHORTCUTS.goToAnalytics:
        if (!event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          this.router.navigate(['/analytics']);
        }
        break;
    }
  }

  // Public methods
  /**
   * A real refresh.
   *
   * This used to be a setTimeout that called no service and then toasted
   * "Dashboard data has been updated" — a lie, fired every 5 minutes by an
   * interval that also lived here. Cadence belongs to SyncService; a
   * per-component timer means N timers as the user navigates.
   *
   * No success toast: a manual refresh that visibly updates the page does not
   * need one.
   */
  refreshDashboard(): void {
    void this.sync.syncNow('manual');
  }

  // Date formatting
  formatDate(dateInput: string | number): string {
    if (!dateInput) return '';

    // `new Date('2024-01-15')` parses date-only strings as UTC midnight, which
    // renders as the 14th anywhere west of Greenwich. parseDateOnly reads them
    // as local dates instead. Timestamps are unambiguous and pass through.
    const date = typeof dateInput === 'number' ? new Date(dateInput) : parseDateOnly(dateInput);

    if (!date || isNaN(date.getTime())) return '';

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Retained for the spec and for any future need. Habiti does not display an
   * age anywhere — the only thing it cares about is the 18+ check at signup.
   */
  calculateAge(dateOfBirth: string): number | null {
    return calculateAge(dateOfBirth);
  }

  getTimeBasedGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning!';
    if (hour < 17) return 'Good afternoon!';
    return 'Good evening!';
  }

  // Stats methods
  getOverallProgress(): number {
    return this.habitsService.getOverallProgress();
  }

  // Renamed from getPointsForNextLevel/getLevelProgress: points stopped
  // driving level, so "to next level" was no longer true. These describe
  // progress toward the next 100-point milestone and nothing more.
  getPointsToNextMilestone(): number {
    const gameState = this.gameState();
    return (
      DASHBOARD_CONFIG.pointsPerMilestone -
      (gameState.totalPoints % DASHBOARD_CONFIG.pointsPerMilestone)
    );
  }

  getMilestoneProgress(): number {
    const gameState = this.gameState();
    return gameState.totalPoints % DASHBOARD_CONFIG.pointsPerMilestone;
  }

  getStreakDescription(streak: number): string {
    const { streakMilestones } = DASHBOARD_CONFIG;
    if (streak >= streakMilestones.monthly) return 'Amazing streak!';
    if (streak >= streakMilestones.twoWeeks) return 'On fire!';
    if (streak >= streakMilestones.weekly) return 'Great momentum!';
    if (streak >= streakMilestones.first) return 'Building habits!';
    return 'Getting started';
  }

  getNextStreakMilestone(streak: number): string {
    const { streakMilestones } = DASHBOARD_CONFIG;
    if (streak < streakMilestones.first) return `${streakMilestones.first - streak} days to first milestone`;
    if (streak < streakMilestones.weekly) return `${streakMilestones.weekly - streak} days to weekly streak`;
    if (streak < streakMilestones.twoWeeks) return `${streakMilestones.twoWeeks - streak} days to two weeks`;
    if (streak < streakMilestones.monthly) return `${streakMilestones.monthly - streak} days to monthly streak`;
    return 'Legendary streak achieved!';
  }

  getStreakIcon(streak: number): string {
    const { streakMilestones } = DASHBOARD_CONFIG;
    if (streak >= streakMilestones.monthly) return '🏆';
    if (streak >= streakMilestones.twoWeeks) return '🔥';
    if (streak >= streakMilestones.weekly) return '⚡';
    if (streak >= streakMilestones.first) return '🌟';
    return '📅';
  }

  // Habit methods
  isHabitCompletedToday(habitId: string): boolean {
    return this.habitsService.isHabitCompletedOnDate(habitId, new Date());
  }

  toggleHabitToday(habitId: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    this.toggleSubject$.next({ habitId, date: new Date() });
  }

  isHabitCompletedOnDate(habitId: string, date: Date): boolean {
    return this.habitsService.isHabitCompletedOnDate(habitId, date);
  }

  toggleHabitForDate(habitId: string, date: Date): void {
    this.toggleSubject$.next({ habitId, date });
  }

  getCompletionRate(habitId: string): number {
    return this.habitsService.getCompletionRate(habitId);
  }

  getUnlockedAchievements() {
    return this.habitsService.getUnlockedAchievements();
  }

  // Weekly statistics
  getWeeklyCompletionRate(): number {
    const data = this.weeklyData();
    const totalCompletion = data.reduce((sum, day) => sum + day.completion, 0);
    return Math.round(totalCompletion / data.length);
  }

  getPerfectDaysThisWeek(): number {
    return this.weeklyData().filter(day => day.completion === 100).length;
  }

  getPointsThisWeek(): number {
    let totalPoints = 0;
    const today = new Date();
    const habitsList = this.habits();
    const entries = this.habitEntries();

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      habitsList.forEach(habit => {
        // Ensure points is a number (may come as string from database)
        const habitPoints = Number(habit.points) || 10;
        if (this.isCompletedOnDate(entries, habit.id, date)) {
          totalPoints += habitPoints;
        }
      });
    }

    return totalPoints;
  }

  // Category methods - using config functions
  getCategoryColor = getCategoryColor;
  getCategoryIcon = getCategoryIcon;
  getPriorityColor = getPriorityColor;

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

  filterByCategory(category: string): void {
    this.router.navigate(['/habits'], { queryParams: { category } });
  }

  getHabitTypeIcon(type: 'good' | 'bad'): string {
    return type === 'good' ? '✅' : '🚫';
  }

  // Memoized weekly table methods
  getHabitWeeklyPoints(habitId: string): number {
    return this.habitWeeklyPointsCache().get(habitId)?.points ?? 0;
  }

  getHabitWeeklyCompletions(habitId: string): number {
    return this.habitWeeklyPointsCache().get(habitId)?.completions ?? 0;
  }

  getDailyTotalPoints(date: Date): number {
    // Find matching date in cache
    const schedule = this.weeklySchedule();
    const matchingDay = schedule.find(d => isSameDay(d.fullDate, date));
    if (matchingDay) {
      return this.dailyPointsCache().get(matchingDay.date) ?? 0;
    }

    // Fallback: calculate directly
    let totalPoints = 0;
    const entries = this.habitEntries();
    this.habits().forEach(habit => {
      // Ensure points is a number (may come as string from database)
      const habitPoints = Number(habit.points) || 10;
      if (this.isCompletedOnDate(entries, habit.id, date)) {
        if (habit.type === 'good') {
          totalPoints += habitPoints;
        } else {
          totalPoints -= habitPoints;
        }
      }
    });
    return totalPoints;
  }

  getWeeklyTotalPoints(): number {
    return this.weeklyTotalPoints();
  }

  // Task management methods
  toggleTask(taskId: string): void {
    try {
      this.tasksService.toggleTask(taskId);
      this.toastService.success('Task updated');
    } catch (error) {
      console.error('Error toggling task:', error);
      this.toastService.error('Error', 'Could not update task');
    }
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

  // Week navigation methods
  goToPreviousWeek(): void {
    this.currentWeekOffset.update(offset => offset - 1);
  }

  goToNextWeek(): void {
    this.currentWeekOffset.update(offset => offset + 1);
  }

  goToCurrentWeek(): void {
    this.currentWeekOffset.set(0);
  }

  // Helper for tracking habit selection
  isHabitSelected(index: number): boolean {
    return this.selectedHabitIndex() === index;
  }

  // getLastSyncTimeFormatted() removed along with the status strip it fed.
  // `sync` itself stays: refreshDashboard() still backs the keyboard shortcut.
}
