import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';

import { DashboardComponent } from './dashboard';
import { HabitsService } from '../../services/habits';
import { AuthService, User } from '../../services/auth.service';
import { TasksService } from '../../services/tasks.service';
import { ToastService } from '../../services/toast.service';
import { SyncService } from '@habiti/sync';

// Mock data
const mockUser: User = {
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  created_at: Date.now(),
  date_of_birth: '1990-01-15',
  location: 'New York',
  bio: 'Test bio',
  profile_picture: { url: 'https://example.com/avatar.jpg' }
};

const mockHabits = [
  {
    id: 'habit-1',
    name: 'Exercise',
    type: 'good' as const,
    category: 'health',
    points: 20,
    streak: 5,
    difficulty: 'medium' as const,
    icon: '🏃'
  },
  {
    id: 'habit-2',
    name: 'No Smoking',
    type: 'bad' as const,
    category: 'health',
    points: 15,
    streak: 10,
    difficulty: 'hard' as const,
    icon: '🚭'
  }
];

const mockGameState = {
  level: 5,
  totalPoints: 450,
  dailyStreak: 7,
  achievements: []
};

const mockTasks = [
  {
    id: 'task-1',
    title: 'Complete project',
    description: 'Finish the dashboard',
    priority: 'high',
    completed: false,
    dueDate: new Date(),
    estimatedHours: 2,
    tags: ['work', 'urgent']
  }
];

// Mock services
class MockHabitsService {
  habits = signal(mockHabits);
  gameState = signal(mockGameState);
  // The dashboard's memoized computeds read this signal directly.
  habitEntries = signal(new Map<string, any>());

  // LevelService pushes the ledger-derived level in here via an effect.
  setLevel = jasmine.createSpy('setLevel');

  isHabitCompletedOnDate = jasmine.createSpy('isHabitCompletedOnDate').and.returnValue(false);
  isHabitCompletedToday = jasmine.createSpy('isHabitCompletedToday').and.returnValue(false);
  getTodaysHabitSummary = jasmine
    .createSpy('getTodaysHabitSummary')
    .and.returnValue({ completed: 0, total: mockHabits.length, habits: [] });
  toggleHabitForDate = jasmine.createSpy('toggleHabitForDate');
  getOverallProgress = jasmine.createSpy('getOverallProgress').and.returnValue(50);
  getCompletionRate = jasmine.createSpy('getCompletionRate').and.returnValue(75);
  getUnlockedAchievements = jasmine.createSpy('getUnlockedAchievements').and.returnValue([]);
}

class MockAuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(mockUser);
  currentUser = this.currentUserSubject.asObservable();

  getCurrentUser = jasmine.createSpy('getCurrentUser').and.returnValue(of(mockUser));
}

class MockTasksService {
  standaloneTasks = signal(mockTasks);
  todaysTasks = signal(mockTasks);
  overdueTasks = signal<any[]>([]);

  toggleTask = jasmine.createSpy('toggleTask');
  createSampleTasks = jasmine.createSpy('createSampleTasks');
}

class MockSyncService {
  isSyncing = signal(false);
  isOnline = signal(true);
  lastSyncAt = signal<Date | null>(null);
  syncNow = jasmine.createSpy('syncNow').and.returnValue(Promise.resolve());
}

class MockToastService {
  success = jasmine.createSpy('success');
  error = jasmine.createSpy('error');
  warning = jasmine.createSpy('warning');
  info = jasmine.createSpy('info');
}

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let habitsService: MockHabitsService;
  let authService: MockAuthService;
  let tasksService: MockTasksService;
  let toastService: MockToastService;
  let syncService: MockSyncService;
  let router: Router;

  beforeEach(async () => {
    habitsService = new MockHabitsService();
    authService = new MockAuthService();
    tasksService = new MockTasksService();
    toastService = new MockToastService();
    syncService = new MockSyncService();

    await TestBed.configureTestingModule({
      imports: [DashboardComponent, RouterTestingModule],
      providers: [
        // The dashboard now renders StatusAvatar / DailyInspiration /
        // LevelHistory, which reach BaserowService -> HttpClient.
        provideHttpClient(),
        { provide: HabitsService, useValue: habitsService },
        { provide: AuthService, useValue: authService },
        { provide: TasksService, useValue: tasksService },
        { provide: ToastService, useValue: toastService },
        { provide: SyncService, useValue: syncService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    fixture.destroy();
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should show loading state initially', () => {
      fixture.detectChanges();
      expect((component as any).dashboardState().isLoading).toBe(true);
    });

    it('should hide loading state after initialization', fakeAsync(() => {
      fixture.detectChanges();
      tick(600);
      expect((component as any).dashboardState().isLoading).toBe(false);
    }));

    it('should load user data on init', fakeAsync(() => {
      fixture.detectChanges();
      tick(100);
      expect((component as any).currentUser()).toEqual(mockUser);
    }));

    it('should create sample tasks if none exist', fakeAsync(() => {
      tasksService.standaloneTasks = signal([]);
      fixture.detectChanges();
      tick(100);
      expect(tasksService.createSampleTasks).toHaveBeenCalled();
    }));
  });

  describe('Date Formatting', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should format date correctly', () => {
      const result = component.formatDate('2024-01-15');
      expect(result).toContain('January');
      expect(result).toContain('15');
      expect(result).toContain('2024');
    });

    it('should return empty string for invalid date', () => {
      expect(component.formatDate('')).toBe('');
    });

    it('should handle timestamp input', () => {
      // Built from parts: `new Date('2024-06-15')` is UTC midnight, which is
      // the 14th in any negative-offset timezone.
      const timestamp = new Date(2024, 5, 15).getTime();
      const result = component.formatDate(timestamp);
      expect(result).toContain('June');
      expect(result).toContain('15');
    });

    it('should calculate age correctly', () => {
      const today = new Date();
      const birthYear = today.getFullYear() - 30;
      const birthDate = `${birthYear}-01-01`;
      const age = component.calculateAge(birthDate);
      expect(age).toBe(30);
    });

    it('should return null for empty birth date', () => {
      expect(component.calculateAge('')).toBeNull();
    });
  });

  describe('Greeting', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should return a greeting based on time of day', () => {
      const greeting = component.getTimeBasedGreeting();
      expect(['Good morning!', 'Good afternoon!', 'Good evening!']).toContain(greeting);
    });
  });

  describe('Stats Methods', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should get overall progress', () => {
      expect(component.getOverallProgress()).toBe(50);
      expect(habitsService.getOverallProgress).toHaveBeenCalled();
    });

    it('should calculate points to the next milestone', () => {
      // totalPoints = 450, so 450 % 100 = 50, next milestone needs 100 - 50 = 50
      expect(component.getPointsToNextMilestone()).toBe(50);
    });

    it('should calculate milestone progress', () => {
      // totalPoints = 450, so 450 % 100 = 50
      expect(component.getMilestoneProgress()).toBe(50);
    });

    it('should return correct streak description', () => {
      expect(component.getStreakDescription(0)).toBe('Getting started');
      expect(component.getStreakDescription(3)).toBe('Building habits!');
      expect(component.getStreakDescription(7)).toBe('Great momentum!');
      expect(component.getStreakDescription(14)).toBe('On fire!');
      expect(component.getStreakDescription(30)).toBe('Amazing streak!');
    });

    it('should return correct streak icon', () => {
      expect(component.getStreakIcon(0)).toBe('📅');
      expect(component.getStreakIcon(3)).toBe('🌟');
      expect(component.getStreakIcon(7)).toBe('⚡');
      expect(component.getStreakIcon(14)).toBe('🔥');
      expect(component.getStreakIcon(30)).toBe('🏆');
    });

    it('should return next streak milestone', () => {
      expect(component.getNextStreakMilestone(0)).toContain('3 days');
      expect(component.getNextStreakMilestone(30)).toBe('Legendary streak achieved!');
    });
  });

  describe('Habit Methods', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should check if habit is completed today', () => {
      component.isHabitCompletedToday('habit-1');
      expect(habitsService.isHabitCompletedOnDate).toHaveBeenCalledWith('habit-1', jasmine.any(Date));
    });

    it('should toggle habit with debounce', fakeAsync(() => {
      component.toggleHabitToday('habit-1');
      tick(400);

      expect(habitsService.toggleHabitForDate).toHaveBeenCalledWith('habit-1', jasmine.any(Date));
      expect(toastService.success).toHaveBeenCalled();
    }));

    it('should get habit type icon', () => {
      expect(component.getHabitTypeIcon('good')).toBe('✅');
      expect(component.getHabitTypeIcon('bad')).toBe('🚫');
    });

    it('should get category color', () => {
      expect(component.getCategoryColor('health')).toBe('#10b981');
      expect(component.getCategoryColor('unknown')).toBe('#6b7280');
    });

    it('should get category icon', () => {
      expect(component.getCategoryIcon('health')).toBe('💪');
      expect(component.getCategoryIcon('unknown')).toBe('📌');
    });
  });

  describe('Computed Properties', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should compute good habits count', () => {
      expect((component as any).goodHabitsCount()).toBe(1);
    });

    it('should compute bad habits count', () => {
      expect((component as any).badHabitsCount()).toBe(1);
    });

    it('should compute weekly schedule', () => {
      const schedule = (component as any).weeklySchedule();
      expect(schedule.length).toBe(7);
      expect(schedule[0].dayName).toBeDefined();
      expect(schedule[0].dayNumber).toBeDefined();
      expect(schedule[0].isToday).toBeDefined();
    });

    it('should compute weekly data', () => {
      const data = (component as any).weeklyData();
      expect(data.length).toBe(7);
      expect(data[0].date).toBeDefined();
      expect(data[0].dayName).toBeDefined();
      expect(data[0].completion).toBeDefined();
    });
  });

  describe('Week Navigation', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should go to previous week', () => {
      expect((component as any).currentWeekOffset()).toBe(0);
      component.goToPreviousWeek();
      expect((component as any).currentWeekOffset()).toBe(-1);
    });

    it('should go to next week', () => {
      expect((component as any).currentWeekOffset()).toBe(0);
      component.goToNextWeek();
      expect((component as any).currentWeekOffset()).toBe(1);
    });

    it('should go to current week', () => {
      component.goToNextWeek();
      component.goToNextWeek();
      expect((component as any).currentWeekOffset()).toBe(2);

      component.goToCurrentWeek();
      expect((component as any).currentWeekOffset()).toBe(0);
    });
  });

  describe('Task Methods', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should toggle task', () => {
      component.toggleTask('task-1');
      expect(tasksService.toggleTask).toHaveBeenCalledWith('task-1');
      expect(toastService.success).toHaveBeenCalled();
    });

    it('should check if task is overdue', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      expect(component.isTaskOverdue(pastDate)).toBe(true);
      expect(component.isTaskOverdue(undefined)).toBe(false);
    });

    it('should check if task is due today', () => {
      const today = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      expect(component.isTaskDueToday(today)).toBe(true);
      expect(component.isTaskDueToday(tomorrow)).toBe(false);
      expect(component.isTaskDueToday(undefined)).toBe(false);
    });

    it('should format task date', () => {
      // Built from parts, not `new Date('2024-06-15')` — that string parses as
      // UTC midnight and renders as the 14th west of Greenwich.
      const date = new Date(2024, 5, 15);
      expect(component.formatTaskDate(date)).toContain('Jun');
      expect(component.formatTaskDate(date)).toContain('15');
      expect(component.formatTaskDate(undefined)).toBe('');
    });
  });

  describe('Dashboard State', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should track online status', () => {
      expect((component as any).dashboardState().isOnline).toBe(true);
    });

    it('delegates refresh to SyncService instead of faking it', () => {
      // This used to be a setTimeout that called no service and then toasted
      // "Dashboard data has been updated" every 5 minutes.
      component.refreshDashboard();
      expect(syncService.syncNow).toHaveBeenCalledWith('manual');
    });

    it('does not toast on a successful manual refresh', () => {
      component.refreshDashboard();
      expect(toastService.info).not.toHaveBeenCalledWith(
        'Refreshed',
        'Dashboard data has been updated'
      );
    });

    // The last-sync formatter went with the Online / Last sync / Refresh strip
    // it fed. refreshDashboard() stays — the keyboard shortcut still uses it.
  });

  describe('Keyboard Navigation', () => {
    beforeEach(fakeAsync(() => {
      fixture.detectChanges();
      tick(600);
    }));

    it('should navigate to next habit with ArrowDown', () => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      component.handleKeyboardNavigation(event);

      expect((component as any).selectedHabitIndex()).toBe(0);
    });

    it('should navigate to previous habit with ArrowUp', () => {
      (component as any).selectedHabitIndex.set(1);
      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      component.handleKeyboardNavigation(event);

      expect((component as any).selectedHabitIndex()).toBe(0);
    });

    it('should not go below 0 with ArrowUp', () => {
      (component as any).selectedHabitIndex.set(0);
      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      component.handleKeyboardNavigation(event);

      expect((component as any).selectedHabitIndex()).toBe(0);
    });

    it('should toggle selected habit with Space', fakeAsync(() => {
      (component as any).selectedHabitIndex.set(0);
      const event = new KeyboardEvent('keydown', { key: ' ' });
      component.handleKeyboardNavigation(event);

      tick(400);
      expect(habitsService.toggleHabitForDate).toHaveBeenCalled();
    }));

    it('should refresh with r key', fakeAsync(() => {
      const event = new KeyboardEvent('keydown', { key: 'r' });
      component.handleKeyboardNavigation(event);

      expect(syncService.syncNow).toHaveBeenCalled();
      tick(1100);
    }));
  });

  describe('Memoized Calculations', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should cache daily points', () => {
      const cache = (component as any).dailyPointsCache();
      expect(cache instanceof Map).toBe(true);
      expect(cache.size).toBe(7);
    });

    it('should cache habit weekly points', () => {
      const cache = (component as any).habitWeeklyPointsCache();
      expect(cache instanceof Map).toBe(true);
      expect(cache.has('habit-1')).toBe(true);
      expect(cache.has('habit-2')).toBe(true);
    });

    it('should get habit weekly points from cache', () => {
      const points = component.getHabitWeeklyPoints('habit-1');
      expect(typeof points).toBe('number');
    });

    it('should get habit weekly completions from cache', () => {
      const completions = component.getHabitWeeklyCompletions('habit-1');
      expect(typeof completions).toBe('number');
    });

    it('should compute weekly total points', () => {
      const total = component.getWeeklyTotalPoints();
      expect(typeof total).toBe('number');
    });
  });

  describe('Cleanup', () => {
    it('should complete destroy subject on ngOnDestroy', () => {
      fixture.detectChanges();
      const destroySpy = spyOn((component as any).destroy$, 'complete');

      component.ngOnDestroy();

      expect(destroySpy).toHaveBeenCalled();
    });
  });

  describe('Category Methods', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should get habits by category', () => {
      const healthHabits = component.getHabitsByCategory('health');
      expect(healthHabits.length).toBe(2);
    });

    it('should get category progress', () => {
      habitsService.isHabitCompletedOnDate.and.returnValue(true);
      const progress = component.getCategoryProgress('health');
      expect(progress).toBe(100);
    });

    it('should return 0 progress for empty category', () => {
      const progress = component.getCategoryProgress('nonexistent');
      expect(progress).toBe(0);
    });

    it('should get category display name', () => {
      expect(component.getCategoryDisplayName('health')).toBe('Health');
      expect(component.getCategoryDisplayName('productivity')).toBe('Productivity');
    });

    it('should navigate to habits page with category filter', () => {
      const navigateSpy = spyOn(router, 'navigate');
      component.filterByCategory('health');

      expect(navigateSpy).toHaveBeenCalledWith(['/habits'], {
        queryParams: { category: 'health' }
      });
    });
  });

  describe('Priority Color', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should return correct priority colors', () => {
      expect(component.getPriorityColor('low')).toBe('#10b981');
      expect(component.getPriorityColor('medium')).toBe('#f59e0b');
      expect(component.getPriorityColor('high')).toBe('#ef4444');
      expect(component.getPriorityColor('urgent')).toBe('#dc2626');
      expect(component.getPriorityColor('unknown')).toBe('#6b7280');
    });
  });
});
