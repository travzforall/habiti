import { Injectable, signal } from '@angular/core';
import { BaserowService } from './baserow.service';
import { Observable, map, of, forkJoin } from 'rxjs';

export interface HabitEntry {
  habitId: string;
  date: string;
  status: string;
  notes?: string;
  mood?: 'great' | 'good' | 'okay' | 'bad' | 'terrible';
  timeSpent?: number;
  completedAt?: string;
  proof?: {
    imageUrl?: string;
    note?: string;
    uploadedAt?: string;
  };
}

export interface Habit {
  id: string;
  name: string;
  type: 'good' | 'bad';
  color?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  streak: number;
  bestStreak: number;
  points: number;
  goal: number;
  reward: string;
  category?: string;
  subcategory?: string;
  group?: string;
  tags?: string[];
  icon?: string;
  description?: string;
  reminderTime?: string;
  isActive?: boolean;
  createdAt?: string;
  targetDays?: ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday')[];
  frequency?: 'daily' | 'weekly' | 'custom';
  trackingType?: 'simple' | 'quantity' | 'duration' | 'sets';
  trackingUnit?: string;
  targetValue?: number;
}

export interface DayColumn {
  date: Date;
  dateString: string;
  dayName: string;
  dayNumber: number;
}

export interface GameState {
  totalPoints: number;
  level: number;
  achievements: string[];
  dailyStreak: number;
  longestStreak: number;
  theme: 'light' | 'dark' | 'auto';
  weekStartsOn: 'sunday' | 'monday';
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  lastLoginDate?: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement: (gameState: GameState, habits: Habit[]) => boolean;
}

export interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromEmail: string;
  toEmail: string;
}

export interface HabitTemplate {
  id: string;
  name: string;
  category: string;
  icon: string;
  type: 'good' | 'bad';
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
  goal: number;
  description: string;
  tags: string[];
}

export interface HabitCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  subcategories?: HabitSubcategory[];
}

export interface HabitSubcategory {
  id: string;
  name: string;
  icon?: string;
  groups?: HabitGroup[];
}

export interface HabitGroup {
  id: string;
  name: string;
  description?: string;
  exercises?: ExerciseDetail[];
}

export interface ExerciseDetail {
  id: string;
  name: string;
  sets?: number;
  reps?: number;
  weight?: number;
  duration?: number;
  unit?: string;
  notes?: string;
}

export interface HabitProgress {
  habitId: string;
  date: string;
  value?: number;
  sets?: ExerciseSet[];
  notes?: string;
  mood?: string;
}

export interface ExerciseSet {
  reps: number;
  weight?: number;
  duration?: number;
  completed: boolean;
}

export interface Analytics {
  weeklyCompletion: number;
  monthlyCompletion: number;
  bestDay: string;
  worstDay: string;
  avgTimeSpent: number;
  moodTrend: string;
}

export interface NightlyPlan {
  id: string;
  date: string;
  dailyReflection: {
    accomplishments: string[];
    challenges: string[];
    lessonsLearned: string;
    gratitude: string[];
    energyLevel: number; // 1-10
    mood: 'great' | 'good' | 'okay' | 'challenging' | 'difficult';
  };
  tomorrowsPlan: {
    topPriorities: string[];
    focusArea: string;
    energyPlan: string;
  };
  sleepPlan: {
    bedtime: string;
    wakeTime: string;
    routine: string[];
    environment: string;
  };
  createdAt: string;
  completedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class HabitsService {
  
  // Core data
  habits = signal<Habit[]>([]);
  habitEntries = new Map<string, HabitEntry>();
  nightlyPlans = signal<NightlyPlan[]>([]);
  gameState = signal<GameState>({
    totalPoints: 0,
    level: 1,
    achievements: [],
    dailyStreak: 0,
    longestStreak: 0,
    theme: 'auto',
    weekStartsOn: 'monday',
    notificationsEnabled: true,
    soundEnabled: true
  });

  constructor(private baserowService: BaserowService) {
    // Initialize by loading data from Baserow
    this.loadDataFromDatabase();
    // Also load existing local data
    this.loadData();
    this.initializeSampleData();
    this.fixDuplicateIds();
  }

  // Static data
  statusOptions = [
    { label: 'Not Started', value: 'not-started', icon: '⭕' },
    { label: 'In Progress', value: 'in-progress', icon: '🔄' },
    { label: 'Completed', value: 'completed', icon: '✅' },
    { label: 'Skipped', value: 'skipped', icon: '⏭️' },
    { label: 'Failed', value: 'failed', icon: '❌' }
  ];

  achievements: Achievement[] = [
    { id: 'first-habit', name: 'Getting Started', description: 'Create your first habit', icon: '🌱', requirement: (_, habits) => habits.length >= 1 },
    { id: 'streak-7', name: 'Week Warrior', description: 'Maintain a 7-day streak', icon: '🔥', requirement: (gameState) => gameState.longestStreak >= 7 },
    { id: 'level-5', name: 'Level Up!', description: 'Reach level 5', icon: '⭐', requirement: (gameState) => gameState.level >= 5 },
    { id: 'points-100', name: 'Century Club', description: 'Earn 100 points', icon: '💯', requirement: (gameState) => gameState.totalPoints >= 100 },
    { id: 'habit-master', name: 'Habit Master', description: 'Have 10 active habits', icon: '👑', requirement: (_, habits) => habits.length >= 10 }
  ];

  categories: HabitCategory[] = [
    { 
      id: 'health', 
      name: 'Health & Fitness', 
      icon: '💪', 
      color: 'text-green-600', 
      description: 'Physical wellbeing and exercise',
      subcategories: [
        {
          id: 'strength',
          name: 'Strength Training',
          icon: '🏋️',
          groups: [
            {
              id: 'leg-day',
              name: 'Leg Day',
              description: 'Lower body strength training',
              exercises: [
                { id: 'squats', name: 'Squats', sets: 3, reps: 12, unit: 'reps' },
                { id: 'deadlifts', name: 'Deadlifts', sets: 3, reps: 10, unit: 'reps' },
                { id: 'lunges', name: 'Lunges', sets: 3, reps: 12, unit: 'reps' },
                { id: 'calf-raises', name: 'Calf Raises', sets: 3, reps: 15, unit: 'reps' }
              ]
            },
            {
              id: 'push-day',
              name: 'Push Day',
              description: 'Chest, shoulders, and triceps',
              exercises: [
                { id: 'bench-press', name: 'Bench Press', sets: 3, reps: 10, unit: 'reps' },
                { id: 'shoulder-press', name: 'Shoulder Press', sets: 3, reps: 12, unit: 'reps' },
                { id: 'push-ups', name: 'Push-ups', sets: 3, reps: 15, unit: 'reps' },
                { id: 'tricep-dips', name: 'Tricep Dips', sets: 3, reps: 12, unit: 'reps' }
              ]
            },
            {
              id: 'pull-day',
              name: 'Pull Day',
              description: 'Back and biceps',
              exercises: [
                { id: 'pull-ups', name: 'Pull-ups', sets: 3, reps: 8, unit: 'reps' },
                { id: 'rows', name: 'Rows', sets: 3, reps: 12, unit: 'reps' },
                { id: 'bicep-curls', name: 'Bicep Curls', sets: 3, reps: 12, unit: 'reps' },
                { id: 'lat-pulldowns', name: 'Lat Pulldowns', sets: 3, reps: 12, unit: 'reps' }
              ]
            }
          ]
        },
        {
          id: 'cardio',
          name: 'Cardio & Endurance',
          icon: '🏃',
          groups: [
            {
              id: 'running',
              name: 'Running',
              description: 'Distance and sprint training'
            },
            {
              id: 'cycling',
              name: 'Cycling',
              description: 'Indoor and outdoor cycling'
            }
          ]
        },
        {
          id: 'nutrition',
          name: 'Nutrition',
          icon: '🥗',
          groups: [
            {
              id: 'meal-prep',
              name: 'Meal Preparation',
              description: 'Planning and preparing healthy meals'
            },
            {
              id: 'hydration',
              name: 'Hydration',
              description: 'Daily water intake tracking'
            }
          ]
        }
      ]
    },
    { 
      id: 'productivity', 
      name: 'Productivity', 
      icon: '⚡', 
      color: 'text-blue-600', 
      description: 'Work and efficiency habits',
      subcategories: [
        {
          id: 'work',
          name: 'Work Focus',
          icon: '💼',
          groups: [
            {
              id: 'deep-work',
              name: 'Deep Work Sessions',
              description: 'Focused work blocks'
            },
            {
              id: 'meetings',
              name: 'Meeting Management',
              description: 'Efficient meeting practices'
            }
          ]
        },
        {
          id: 'organization',
          name: 'Organization',
          icon: '📋',
          groups: [
            {
              id: 'planning',
              name: 'Daily Planning',
              description: 'Schedule and task organization'
            }
          ]
        }
      ]
    },
    { 
      id: 'learning', 
      name: 'Learning', 
      icon: '📚', 
      color: 'text-purple-600', 
      description: 'Education and skill development',
      subcategories: [
        {
          id: 'skills',
          name: 'Skill Development',
          icon: '🎯',
          groups: [
            {
              id: 'programming',
              name: 'Programming',
              description: 'Coding and development skills'
            },
            {
              id: 'languages',
              name: 'Language Learning',
              description: 'Foreign language practice'
            }
          ]
        },
        {
          id: 'reading',
          name: 'Reading',
          icon: '📖',
          groups: [
            {
              id: 'books',
              name: 'Book Reading',
              description: 'Regular reading practice'
            }
          ]
        }
      ]
    },
    { 
      id: 'social', 
      name: 'Social', 
      icon: '👥', 
      color: 'text-pink-600', 
      description: 'Relationships and communication',
      subcategories: [
        {
          id: 'relationships',
          name: 'Relationships',
          icon: '❤️',
          groups: [
            {
              id: 'family',
              name: 'Family Time',
              description: 'Quality time with family'
            },
            {
              id: 'friends',
              name: 'Social Activities',
              description: 'Maintaining friendships'
            }
          ]
        }
      ]
    },
    { 
      id: 'mindfulness', 
      name: 'Mindfulness', 
      icon: '🧘', 
      color: 'text-indigo-600', 
      description: 'Mental health and meditation',
      subcategories: [
        {
          id: 'meditation',
          name: 'Meditation',
          icon: '🧘‍♀️',
          groups: [
            {
              id: 'daily-meditation',
              name: 'Daily Practice',
              description: 'Regular meditation sessions'
            }
          ]
        },
        {
          id: 'journaling',
          name: 'Journaling',
          icon: '📝',
          groups: [
            {
              id: 'gratitude',
              name: 'Gratitude Journal',
              description: 'Daily gratitude practice'
            }
          ]
        }
      ]
    },
    { id: 'creativity', name: 'Creativity', icon: '🎨', color: 'text-orange-600', description: 'Artistic and creative pursuits' },
    { id: 'finance', name: 'Finance', icon: '💰', color: 'text-yellow-600', description: 'Money management and saving' },
    { id: 'other', name: 'Other', icon: '📌', color: 'text-gray-600', description: 'Miscellaneous habits' }
  ];

  habitTemplates: HabitTemplate[] = [
    { id: '1', name: 'Morning Exercise', category: 'health', icon: '🏃', type: 'good', difficulty: 'medium', points: 15, goal: 30, description: 'Start your day with 30 minutes of exercise', tags: ['morning', 'fitness', 'energy'] },
    { id: '2', name: 'Read for 30 minutes', category: 'learning', icon: '📖', type: 'good', difficulty: 'easy', points: 10, goal: 30, description: 'Read books, articles, or educational content', tags: ['education', 'knowledge', 'reading'] },
    { id: '3', name: 'Drink 8 glasses of water', category: 'health', icon: '💧', type: 'good', difficulty: 'easy', points: 8, goal: 8, description: 'Stay hydrated throughout the day', tags: ['health', 'hydration', 'wellness'] },
    { id: '4', name: 'Meditate for 10 minutes', category: 'mindfulness', icon: '🧘', type: 'good', difficulty: 'easy', points: 12, goal: 10, description: 'Practice mindfulness and meditation', tags: ['meditation', 'mindfulness', 'mental-health'] },
    { id: '5', name: 'No social media scrolling', category: 'productivity', icon: '📱', type: 'bad', difficulty: 'hard', points: 20, goal: 1, description: 'Avoid mindless social media consumption', tags: ['focus', 'productivity', 'digital-detox'] },
    { id: '6', name: 'Practice gratitude', category: 'mindfulness', icon: '🙏', type: 'good', difficulty: 'easy', points: 8, goal: 3, description: 'Write down 3 things you\'re grateful for', tags: ['gratitude', 'positivity', 'mental-health'] },
    { id: '7', name: 'Learn a new skill', category: 'learning', icon: '🎯', type: 'good', difficulty: 'medium', points: 15, goal: 30, description: 'Spend time learning something new', tags: ['skill-development', 'growth', 'learning'] },
    { id: '8', name: 'No junk food', category: 'health', icon: '🥗', type: 'bad', difficulty: 'medium', points: 12, goal: 1, description: 'Avoid processed and unhealthy foods', tags: ['nutrition', 'health', 'diet'] }
  ];

  smtpConfig: SMTPConfig = {
    host: '',
    port: 587,
    secure: false,
    username: '',
    password: '',
    fromEmail: '',
    toEmail: ''
  };

  // Utility Methods
  formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  getTodayDateString(): string {
    return this.formatDate(new Date());
  }

  // Habit Management
  private generateUniqueId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Fix duplicate IDs if they exist
  fixDuplicateIds(): void {
    const currentHabits = this.habits();
    const seenIds = new Set<string>();
    const updatedHabits: Habit[] = [];
    const idMapping: { [oldId: string]: string } = {};

    currentHabits.forEach(habit => {
      let newId = habit.id;
      
      // If ID is already seen, generate a new one
      if (seenIds.has(habit.id)) {
        newId = this.generateUniqueId();
        idMapping[habit.id] = newId;
        console.log(`Fixing duplicate ID: ${habit.id} -> ${newId} for habit: ${habit.name}`);
      }
      
      seenIds.add(newId);
      updatedHabits.push({ ...habit, id: newId });
    });

    // Update habit entries with new IDs
    if (Object.keys(idMapping).length > 0) {
      const newEntries = new Map<string, HabitEntry>();
      this.habitEntries.forEach((entry, key) => {
        const [habitId, date] = key.split('-');
        const newHabitId = idMapping[habitId] || habitId;
        const newKey = `${newHabitId}-${date}`;
        newEntries.set(newKey, { ...entry, habitId: newHabitId });
      });
      this.habitEntries = newEntries;
      
      this.habits.set(updatedHabits);
      this.saveData();
      console.log('Fixed duplicate habit IDs');
    }
  }

  addHabit(habit: Partial<Habit>): void {
    const newHabit: Habit = {
      id: this.generateUniqueId(),
      name: habit.name || '',
      type: habit.type || 'good',
      difficulty: habit.difficulty || 'medium',
      streak: 0,
      bestStreak: 0,
      points: habit.points || 10,
      goal: habit.goal || 30,
      reward: habit.reward || '',
      category: habit.category || 'other',
      icon: habit.icon || '✅',
      description: habit.description || '',
      isActive: true,
      createdAt: new Date().toISOString(),
      frequency: 'daily',
      targetDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    };

    this.habits.update(habits => [...habits, newHabit]);
    this.saveData();
  }

  removeHabit(habitId: string): void {
    this.habits.update(habits => habits.filter(h => h.id !== habitId));
    this.saveData();
  }

  updateEntry(habitId: string, date: string, status: string): void {
    const key = `${habitId}-${date}`;
    const entry: HabitEntry = {
      habitId,
      date,
      status,
      completedAt: new Date().toISOString()
    };
    
    this.habitEntries.set(key, entry);
    this.updateStreaksAndPoints();
    this.saveData();
  }

  getEntryStatus(habitId: string, date: string): string {
    const key = `${habitId}-${date}`;
    return this.habitEntries.get(key)?.status || 'not-started';
  }

  // Analytics and Progress
  getCompletionRate(habitId: string): number {
    const last30Days = this.getLastNDays(30);
    const completedDays = last30Days.filter(date => 
      this.getEntryStatus(habitId, date) === 'completed'
    ).length;
    return Math.round((completedDays / 30) * 100);
  }

  getHabitAnalytics(habitId: string): Analytics {
    const last7Days = this.getLastNDays(7);
    const last30Days = this.getLastNDays(30);
    
    const weeklyCompleted = last7Days.filter(date => 
      this.getEntryStatus(habitId, date) === 'completed'
    ).length;
    
    const monthlyCompleted = last30Days.filter(date => 
      this.getEntryStatus(habitId, date) === 'completed'
    ).length;

    const weeklyCompletion = Math.round((weeklyCompleted / 7) * 100);
    const monthlyCompletion = Math.round((monthlyCompleted / 30) * 100);

    const dayStats: { [key: string]: number } = {
      'Monday': 0, 'Tuesday': 0, 'Wednesday': 0, 'Thursday': 0,
      'Friday': 0, 'Saturday': 0, 'Sunday': 0
    };

    for (const date of last30Days) {
      const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
      const status = this.getEntryStatus(habitId, date);
      if (status === 'completed') dayStats[dayName]++;
    }

    const bestDay = Object.entries(dayStats).reduce((a, b) => dayStats[a[0]] > dayStats[b[0]] ? a : b)[0] || 'N/A';

    return {
      weeklyCompletion,
      monthlyCompletion,
      bestDay,
      worstDay: 'N/A',
      avgTimeSpent: 0,
      moodTrend: 'neutral'
    };
  }

  getLastNDays(n: number): string[] {
    const dates: string[] = [];
    for (let i = 0; i < n; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(this.formatDate(date));
    }
    return dates;
  }

  getOverallProgress(): number {
    const habits = this.habits();
    if (habits.length === 0) return 0;
    
    const totalProgress = habits.reduce((sum, h) => sum + this.getCompletionRate(h.id), 0);
    return Math.round(totalProgress / habits.length);
  }

  getHabitsByCategory(categoryId: string): Habit[] {
    return this.habits().filter(h => h.category === categoryId);
  }

  getCategoryProgress(categoryId: string): string {
    const categoryHabits = this.getHabitsByCategory(categoryId);
    if (categoryHabits.length === 0) return '0%';
    
    const totalProgress = categoryHabits.reduce((sum, h) => sum + this.getCompletionRate(h.id), 0);
    const avgProgress = Math.round(totalProgress / categoryHabits.length);
    return `${avgProgress}%`;
  }

  // Game mechanics
  updateStreaksAndPoints(): void {
    const currentGameState = this.gameState();
    let totalPoints = 0;
    let maxStreak = 0;

    this.habits().forEach(habit => {
      const habitStreak = this.calculateStreak(habit.id);
      habit.streak = habitStreak;
      if (habitStreak > habit.bestStreak) {
        habit.bestStreak = habitStreak;
      }
      if (habitStreak > maxStreak) {
        maxStreak = habitStreak;
      }
      totalPoints += this.calculateHabitPoints(habit);
    });

    this.gameState.update(state => ({
      ...state,
      totalPoints,
      longestStreak: Math.max(currentGameState.longestStreak, maxStreak),
      level: Math.floor(totalPoints / 100) + 1
    }));
  }

  calculateStreak(habitId: string): number {
    let streak = 0;
    let currentDate = new Date();
    
    while (true) {
      const dateString = this.formatDate(currentDate);
      const status = this.getEntryStatus(habitId, dateString);
      
      if (status === 'completed') {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }
    
    return streak;
  }

  calculateHabitPoints(habit: Habit): number {
    const completionRate = this.getCompletionRate(habit.id);
    const basePoints = habit.points;
    const streakBonus = habit.streak * 2;
    return Math.round((basePoints * completionRate / 100) + streakBonus);
  }

  getUnlockedAchievements(): Achievement[] {
    const currentGameState = this.gameState();
    const currentHabits = this.habits();
    
    return this.achievements.filter(achievement => 
      achievement.requirement(currentGameState, currentHabits) &&
      currentGameState.achievements.includes(achievement.id)
    );
  }

  // Data persistence
  private saveData(): void {
    localStorage.setItem('habiti-habits', JSON.stringify(this.habits()));
    localStorage.setItem('habiti-entries', JSON.stringify(Array.from(this.habitEntries.entries())));
    localStorage.setItem('habiti-gamestate', JSON.stringify(this.gameState()));
    localStorage.setItem('habiti-smtp', JSON.stringify(this.smtpConfig));
    localStorage.setItem('habiti-nightly-plans', JSON.stringify(this.nightlyPlans()));
  }

  private loadData(): void {
    try {
      const habitsData = localStorage.getItem('habiti-habits');
      if (habitsData) {
        this.habits.set(JSON.parse(habitsData));
      }

      const entriesData = localStorage.getItem('habiti-entries');
      if (entriesData) {
        this.habitEntries = new Map(JSON.parse(entriesData));
      }

      const gameStateData = localStorage.getItem('habiti-gamestate');
      if (gameStateData) {
        this.gameState.set(JSON.parse(gameStateData));
      }

      const smtpData = localStorage.getItem('habiti-smtp');
      if (smtpData) {
        this.smtpConfig = JSON.parse(smtpData);
      }

      const nightlyPlansData = localStorage.getItem('habiti-nightly-plans');
      if (nightlyPlansData) {
        this.nightlyPlans.set(JSON.parse(nightlyPlansData));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  private initializeSampleData(): void {
    const currentHabits = this.habits();
    // Always reload sample data to demonstrate accordion functionality
    // Comment out this condition to force reload of organized sample data
    // if (currentHabits.length === 0) {
    if (true) {
      // Clear existing habits first
      this.habits.set([]);
      // Health & Fitness habits with proper subcategory and group organization
      
      // Strength Training - Leg Day Group
      this.addHabit({
        name: 'Squats',
        type: 'good',
        difficulty: 'medium',
        points: 15,
        goal: 3,
        reward: 'Build leg strength!',
        category: 'health',
        subcategory: 'strength',
        group: 'leg-day',
        icon: '🏋️',
        description: '3 sets of 12 squats',
        trackingType: 'sets'
      });

      this.addHabit({
        name: 'Lunges',
        type: 'good',
        difficulty: 'medium',
        points: 12,
        goal: 3,
        reward: 'Strong quads and glutes!',
        category: 'health',
        subcategory: 'strength',
        group: 'leg-day',
        icon: '🦵',
        description: '3 sets of 10 lunges each leg',
        trackingType: 'sets'
      });

      this.addHabit({
        name: 'Deadlifts',
        type: 'good',
        difficulty: 'hard',
        points: 20,
        goal: 3,
        reward: 'Full body strength!',
        category: 'health',
        subcategory: 'strength',
        group: 'leg-day',
        icon: '💪',
        description: '3 sets of 8 deadlifts',
        trackingType: 'sets'
      });

      // Strength Training - Upper Body Group
      this.addHabit({
        name: 'Push-ups',
        type: 'good',
        difficulty: 'medium',
        points: 12,
        goal: 3,
        reward: 'Strong chest and arms!',
        category: 'health',
        subcategory: 'strength',
        group: 'upper-body',
        icon: '💪',
        description: '3 sets of 15 push-ups',
        trackingType: 'sets'
      });

      this.addHabit({
        name: 'Pull-ups',
        type: 'good',
        difficulty: 'hard',
        points: 18,
        goal: 3,
        reward: 'Back and bicep strength!',
        category: 'health',
        subcategory: 'strength',
        group: 'upper-body',
        icon: '🏋️',
        description: '3 sets of 8 pull-ups',
        trackingType: 'sets'
      });

      // Cardio Group
      this.addHabit({
        name: 'Morning Run',
        type: 'good',
        difficulty: 'medium',
        points: 15,
        goal: 30,
        reward: 'Feel energized all day!',
        category: 'health',
        subcategory: 'cardio',
        icon: '🏃',
        description: '30 minutes of running',
        trackingType: 'duration'
      });

      this.addHabit({
        name: '10,000 steps daily',
        type: 'good',
        difficulty: 'medium',
        points: 12,
        goal: 10000,
        reward: 'Improved cardiovascular health',
        category: 'health',
        subcategory: 'cardio',
        icon: '👟',
        description: 'Walk at least 10,000 steps each day',
        trackingType: 'quantity'
      });

      // Nutrition habits
      this.addHabit({
        name: 'Drink 8 glasses of water',
        type: 'good',
        difficulty: 'easy',
        points: 8,
        goal: 8,
        reward: 'Stay hydrated and healthy',
        category: 'health',
        subcategory: 'nutrition',
        group: 'hydration',
        icon: '💧',
        description: 'Stay hydrated throughout the day',
        trackingType: 'quantity'
      });

      this.addHabit({
        name: 'No junk food',
        type: 'bad',
        difficulty: 'hard',
        points: 18,
        goal: 1,
        reward: 'Better nutrition and energy',
        category: 'health',
        subcategory: 'nutrition',
        group: 'meal-prep',
        icon: '🚫',
        description: 'Avoid processed and unhealthy foods'
      });

      // Learning & Development habits with proper grouping
      this.addHabit({
        name: 'Read technical books',
        type: 'good',
        difficulty: 'easy',
        points: 10,
        goal: 20,
        reward: 'Expand your knowledge',
        category: 'learning',
        subcategory: 'reading',
        group: 'books',
        icon: '📚',
        description: 'Read technical books for 20 minutes',
        trackingType: 'duration'
      });

      this.addHabit({
        name: 'Practice JavaScript',
        type: 'good',
        difficulty: 'medium',
        points: 15,
        goal: 60,
        reward: 'Improve programming skills',
        category: 'learning',
        subcategory: 'skills',
        group: 'programming',
        icon: '💻',
        description: 'JavaScript coding practice for 1 hour',
        trackingType: 'duration'
      });

      this.addHabit({
        name: 'Learn Spanish vocabulary',
        type: 'good',
        difficulty: 'easy',
        points: 8,
        goal: 5,
        reward: 'Expand language skills',
        category: 'learning',
        subcategory: 'skills',
        group: 'languages',
        icon: '🇪🇸',
        description: 'Learn 5 new Spanish words',
        trackingType: 'quantity'
      });

      // Productivity habits with proper grouping
      this.addHabit({
        name: 'Plan daily tasks',
        type: 'good',
        difficulty: 'easy',
        points: 10,
        goal: 1,
        reward: 'Stay organized and focused',
        category: 'productivity',
        subcategory: 'organization',
        group: 'planning',
        icon: '📋',
        description: 'Write down and organize daily tasks'
      });

      this.addHabit({
        name: 'No social media during work',
        type: 'bad',
        difficulty: 'hard',
        points: 20,
        goal: 1,
        reward: 'Improved focus and productivity',
        category: 'productivity',
        subcategory: 'work',
        icon: '📱',
        description: 'Avoid social media during work hours'
      });

      this.addHabit({
        name: 'Deep work session',
        type: 'good',
        difficulty: 'medium',
        points: 18,
        goal: 90,
        reward: 'Accomplish meaningful work',
        category: 'productivity',
        subcategory: 'work',
        group: 'deep-work',
        icon: '🎯',
        description: '90 minutes of focused, uninterrupted work',
        trackingType: 'duration'
      });

      // Mindfulness & Mental Health habits with proper grouping
      this.addHabit({
        name: 'Daily meditation',
        type: 'good',
        difficulty: 'easy',
        points: 12,
        goal: 10,
        reward: 'Mental clarity and calmness',
        category: 'mindfulness',
        subcategory: 'meditation',
        group: 'daily-meditation',
        icon: '🧘',
        description: 'Practice mindfulness and meditation for 10 minutes',
        trackingType: 'duration'
      });

      this.addHabit({
        name: 'Gratitude journal',
        type: 'good',
        difficulty: 'easy',
        points: 8,
        goal: 3,
        reward: 'Improved mood and perspective',
        category: 'mindfulness',
        subcategory: 'journaling',
        group: 'gratitude',
        icon: '🙏',
        description: 'Write down 3 things you\'re grateful for',
        trackingType: 'quantity'
      });

      this.addHabit({
        name: 'Evening reflection',
        type: 'good',
        difficulty: 'easy',
        points: 10,
        goal: 1,
        reward: 'Better self-awareness',
        category: 'mindfulness',
        subcategory: 'journaling',
        group: 'gratitude',
        icon: '📔',
        description: 'Reflect and write about your day'
      });

      // Social & Relationships habits with proper grouping
      this.addHabit({
        name: 'Call family',
        type: 'good',
        difficulty: 'easy',
        points: 12,
        goal: 1,
        reward: 'Stronger family bonds',
        category: 'social',
        subcategory: 'relationships',
        group: 'family',
        icon: '👨‍👩‍👧‍👦',
        description: 'Make a meaningful call to family members'
      });

      this.addHabit({
        name: 'Meet with friends',
        type: 'good',
        difficulty: 'easy',
        points: 15,
        goal: 1,
        reward: 'Stronger friendships',
        category: 'social',
        subcategory: 'relationships',
        group: 'friends',
        icon: '👫',
        description: 'Spend quality time with friends'
      });

      this.addHabit({
        name: 'Random act of kindness',
        type: 'good',
        difficulty: 'easy',
        points: 15,
        goal: 1,
        reward: 'Spread positivity',
        category: 'social',
        icon: '💝',
        description: 'Do something nice for someone'
      });

      // Creativity habits
      this.addHabit({
        name: 'Creative expression',
        type: 'good',
        difficulty: 'medium',
        points: 12,
        goal: 30,
        reward: 'Unleash your creativity',
        category: 'creativity',
        icon: '🎨',
        description: 'Draw, write, or create something for 30 minutes'
      });

      // Finance habits
      this.addHabit({
        name: 'Track daily expenses',
        type: 'good',
        difficulty: 'easy',
        points: 8,
        goal: 1,
        reward: 'Better financial awareness',
        category: 'finance',
        icon: '💰',
        description: 'Record all money spent today'
      });
    }
  }

  // Calendar and date-specific methods
  isHabitCompletedToday(habitId: string): boolean {
    const today = this.formatDate(new Date());
    return this.getEntryStatus(habitId, today) === 'completed';
  }

  isHabitCompletedOnDate(habitId: string, date: Date): boolean {
    const dateString = this.formatDate(date);
    return this.getEntryStatus(habitId, dateString) === 'completed';
  }

  toggleHabitForDate(habitId: string, date: Date): void {
    const dateString = this.formatDate(date);
    const currentStatus = this.getEntryStatus(habitId, dateString);
    const newStatus = currentStatus === 'completed' ? 'not-started' : 'completed';
    this.updateEntry(habitId, dateString, newStatus);
  }

  toggleHabit(habitId: string): void {
    const today = this.formatDate(new Date());
    this.toggleHabitForDate(habitId, new Date());
  }

  deleteHabit(habitId: string): void {
    this.removeHabit(habitId);
  }

  updateHabit(habitId: string, updates: Partial<Habit>): void {
    this.habits.update(habits => 
      habits.map(habit => 
        habit.id === habitId ? { ...habit, ...updates } : habit
      )
    );
    this.saveData();
  }

  // Export/Import functionality
  exportData(): void {
    const data = {
      habits: this.habits(),
      habitEntries: Array.from(this.habitEntries.entries()),
      gameState: this.gameState(),
      smtpConfig: this.smtpConfig,
      exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `habiti-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async importData(file: File): Promise<void> {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (data.habits) this.habits.set(data.habits);
      if (data.habitEntries) this.habitEntries = new Map(data.habitEntries);
      if (data.gameState) this.gameState.set(data.gameState);
      if (data.smtpConfig) this.smtpConfig = data.smtpConfig;
      
      this.saveData();
    } catch (error) {
      console.error('Error importing data:', error);
    }
  }

  // Nightly Planner Methods
  createNightlyPlan(date: Date = new Date()): NightlyPlan {
    const dateString = this.formatDate(date);
    const plan: NightlyPlan = {
      id: `nightly-${dateString}-${Date.now()}`,
      date: dateString,
      dailyReflection: {
        accomplishments: [],
        challenges: [],
        lessonsLearned: '',
        gratitude: [],
        energyLevel: 5,
        mood: 'okay'
      },
      tomorrowsPlan: {
        topPriorities: [],
        focusArea: '',
        energyPlan: ''
      },
      sleepPlan: {
        bedtime: '22:00',
        wakeTime: '07:00',
        routine: [],
        environment: ''
      },
      createdAt: new Date().toISOString()
    };
    
    return plan;
  }

  saveNightlyPlan(plan: NightlyPlan): void {
    const plans = this.nightlyPlans();
    const existingIndex = plans.findIndex(p => p.date === plan.date);
    
    if (existingIndex >= 0) {
      plans[existingIndex] = { ...plan, completedAt: new Date().toISOString() };
    } else {
      plans.push({ ...plan, completedAt: new Date().toISOString() });
    }
    
    this.nightlyPlans.set([...plans]);
    this.saveData();
  }

  getNightlyPlan(date: Date = new Date()): NightlyPlan | null {
    const dateString = this.formatDate(date);
    return this.nightlyPlans().find(plan => plan.date === dateString) || null;
  }

  hasNightlyPlanForDate(date: Date): boolean {
    const dateString = this.formatDate(date);
    return this.nightlyPlans().some(plan => plan.date === dateString);
  }

  getNightlyPlanStreak(): number {
    const plans = this.nightlyPlans().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    let streak = 0;
    let currentDate = new Date();
    
    for (let i = 0; i < 30; i++) { // Check last 30 days
      const dateString = this.formatDate(currentDate);
      const hasPlan = plans.some(plan => plan.date === dateString);
      
      if (hasPlan) {
        streak++;
      } else {
        break;
      }
      
      currentDate.setDate(currentDate.getDate() - 1);
    }
    
    return streak;
  }

  getTodaysHabitSummary(): { completed: number; total: number; habits: Habit[] } {
    const habits = this.habits();
    const today = new Date();
    const completedHabits = habits.filter(habit => 
      this.isHabitCompletedOnDate(habit.id, today)
    );
    
    return {
      completed: completedHabits.length,
      total: habits.length,
      habits: completedHabits
    };
  }

  // Helper method to generate habit entry key
  private getHabitEntryKey(habitId: string, date: Date): string {
    return `${habitId}-${this.formatDate(date)}`;
  }

  // Proof documentation methods
  addHabitProof(habitId: string, date: Date, proof: { imageUrl?: string; note?: string }): void {
    const key = this.getHabitEntryKey(habitId, date);
    const entry = this.habitEntries.get(key);
    
    if (entry) {
      entry.proof = {
        ...entry.proof,
        ...proof,
        uploadedAt: new Date().toISOString()
      };
      this.habitEntries.set(key, entry);
      this.saveData();
    }
  }

  getHabitProof(habitId: string, date: Date): { imageUrl?: string; note?: string } | undefined {
    const key = this.getHabitEntryKey(habitId, date);
    const entry = this.habitEntries.get(key);
    return entry?.proof;
  }

  removeHabitProofImage(habitId: string, date: Date): void {
    const key = this.getHabitEntryKey(habitId, date);
    const entry = this.habitEntries.get(key);
    
    if (entry?.proof) {
      delete entry.proof.imageUrl;
      if (!entry.proof.note) {
        delete entry.proof;
      }
      this.habitEntries.set(key, entry);
      this.saveData();
    }
  }

  removeHabitProofNote(habitId: string, date: Date): void {
    const key = this.getHabitEntryKey(habitId, date);
    const entry = this.habitEntries.get(key);
    
    if (entry?.proof) {
      delete entry.proof.note;
      if (!entry.proof.imageUrl) {
        delete entry.proof;
      }
      this.habitEntries.set(key, entry);
      this.saveData();
    }
  }

  // Database integration methods
  
  loadDataFromDatabase(): void {
    // Load habits from Baserow
    this.baserowService.getHabits(undefined, true).subscribe({
      next: (response) => {
        if (response.results) {
          const habits = response.results.map((row: any) => this.transformBaserowHabitToLocal(row));
          this.habits.set(habits);
          console.log('Loaded habits from Baserow:', habits.length);
        }
      },
      error: (error) => {
        console.error('Failed to load habits from Baserow:', error);
        // Fall back to local storage
        this.loadData();
      }
    });

    // Load habit entries
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    this.baserowService.getHabitEntries(undefined, undefined, thirtyDaysAgo.toISOString(), today.toISOString()).subscribe({
      next: (response) => {
        if (response.results) {
          response.results.forEach((entry: any) => {
            const habitEntry = this.transformBaserowEntryToLocal(entry);
            const key = this.getHabitEntryKey(habitEntry.habitId, new Date(habitEntry.date));
            this.habitEntries.set(key, habitEntry);
          });
          console.log('Loaded habit entries from Baserow:', response.results.length);
        }
      },
      error: (error) => {
        console.error('Failed to load habit entries from Baserow:', error);
      }
    });

    // Load game state
    const userId = localStorage.getItem('userId') || 'default';
    this.baserowService.getGameState(userId).subscribe({
      next: (response) => {
        if (response.results && response.results.length > 0) {
          const gameStateData = response.results[0];
          this.gameState.set({
            totalPoints: gameStateData.total_points || 0,
            level: gameStateData.level || 1,
            achievements: [],
            dailyStreak: gameStateData.current_streak || 0,
            longestStreak: gameStateData.best_streak || 0,
            theme: 'auto',
            weekStartsOn: 'monday',
            notificationsEnabled: true,
            soundEnabled: true
          });
          console.log('Loaded game state from Baserow');
        }
      },
      error: (error) => {
        console.error('Failed to load game state from Baserow:', error);
      }
    });
  }

  transformBaserowHabitToLocal(baserowHabit: any): Habit {
    return {
      id: baserowHabit.id.toString(),
      name: baserowHabit.name || '',
      type: baserowHabit.type === 2100 ? 'good' : 'bad',
      difficulty: this.mapDifficulty(baserowHabit.difficulty),
      streak: baserowHabit.streak || 0,
      bestStreak: baserowHabit.best_streak || 0,
      points: baserowHabit.points || 0,
      goal: baserowHabit.goal || 1,
      reward: baserowHabit.reward || '',
      description: baserowHabit.description || '',
      icon: baserowHabit.icon || '',
      reminderTime: baserowHabit.reminder_time || '',
      isActive: baserowHabit.is_active || false,
      frequency: this.mapFrequency(baserowHabit.frequency),
      trackingType: this.mapTrackingType(baserowHabit.tracking_type),
      trackingUnit: this.mapTrackingUnit(baserowHabit.tracking_unit),
      targetValue: baserowHabit.target_value || 1
    };
  }

  transformBaserowEntryToLocal(baserowEntry: any): HabitEntry {
    return {
      habitId: baserowEntry.habit_id?.[0]?.toString() || '',
      date: baserowEntry.date || new Date().toISOString(),
      status: baserowEntry.completed ? 'completed' : 'not-started',
      notes: baserowEntry.notes || '',
      mood: this.mapMood(baserowEntry.mood_after),
      timeSpent: baserowEntry.value || 0,
      completedAt: baserowEntry.created_at
    };
  }

  mapDifficulty(value: number): 'easy' | 'medium' | 'hard' {
    switch (value) {
      case 2102: return 'easy';
      case 2104: return 'medium';
      case 2103: return 'hard';
      default: return 'medium';
    }
  }

  mapFrequency(value: number): 'daily' | 'weekly' | 'custom' {
    switch (value) {
      case 2112: return 'daily';
      case 2113: return 'weekly';
      default: return 'daily';
    }
  }

  mapTrackingType(value: number): 'simple' | 'quantity' | 'duration' | 'sets' {
    switch (value) {
      case 2106: return 'simple';
      case 2107: return 'quantity';
      case 2105: return 'duration';
      case 2108: return 'sets';
      default: return 'simple';
    }
  }

  mapTrackingUnit(value: number): string {
    switch (value) {
      case 2109: return 'minutes';
      case 2110: return 'items';
      case 2111: return 'glasses';
      default: return '';
    }
  }

  mapMood(value: number): 'great' | 'good' | 'okay' | 'bad' | 'terrible' {
    if (value >= 9) return 'great';
    if (value >= 7) return 'good';
    if (value >= 5) return 'okay';
    if (value >= 3) return 'bad';
    return 'terrible';
  }

  // Sync local changes to database
  syncHabitToDatabase(habit: Habit): void {
    const habitData = {
      name: habit.name,
      type: habit.type === 'good' ? 2100 : 2101,
      difficulty: habit.difficulty === 'easy' ? 2102 : habit.difficulty === 'hard' ? 2103 : 2104,
      streak: habit.streak,
      best_streak: habit.bestStreak,
      points: habit.points,
      goal: habit.goal,
      reward: habit.reward,
      description: habit.description,
      icon: habit.icon,
      reminder_time: habit.reminderTime,
      is_active: habit.isActive,
      user_id: localStorage.getItem('userId') || 'default'
    };

    if (habit.id && !habit.id.startsWith('habit-')) {
      // Update existing habit
      this.baserowService.updateHabit(parseInt(habit.id), habitData).subscribe({
        next: () => console.log('Habit synced to Baserow'),
        error: (error) => console.error('Failed to sync habit:', error)
      });
    } else {
      // Create new habit
      this.baserowService.createHabit(habitData).subscribe({
        next: (response) => {
          // Update local habit with Baserow ID
          const habits = this.habits();
          const index = habits.findIndex(h => h.id === habit.id);
          if (index !== -1) {
            habits[index].id = response.id.toString();
            this.habits.set([...habits]);
          }
          console.log('New habit created in Baserow');
        },
        error: (error) => console.error('Failed to create habit:', error)
      });
    }
  }

  syncEntryToDatabase(entry: HabitEntry): void {
    const entryData = {
      habit_id: [parseInt(entry.habitId)],
      date: entry.date,
      completed: entry.status === 'completed',
      notes: entry.notes,
      mood_after: entry.mood === 'great' ? 10 : 
                  entry.mood === 'good' ? 8 :
                  entry.mood === 'okay' ? 6 :
                  entry.mood === 'bad' ? 4 : 2,
      value: entry.timeSpent,
      user_id: localStorage.getItem('userId') || 'default'
    };

    this.baserowService.createHabitEntry(entryData).subscribe({
      next: () => console.log('Entry synced to Baserow'),
      error: (error) => console.error('Failed to sync entry:', error)
    });
  }
}