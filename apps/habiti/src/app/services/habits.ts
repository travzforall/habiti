import { Injectable, signal } from '@angular/core';
import { BaserowService } from './baserow.service';
import { AuthService } from './auth.service';
import { SyncBus } from '@habiti/sync';
import { UserStorage } from '@habiti/storage';
import { Observable, ReplaySubject, catchError, map, of, forkJoin, switchMap } from 'rxjs';

export interface WorkoutExercise {
  name: string;
  sets: number;
  reps: number;
  weight: number; // in lbs
  weightProgression?: {
    startWeight: number;
    increaseAfterWeeks: number;
    increaseAmount: number;
  };
}

export interface CardioSession {
  type: 'intervals' | 'incline-walk' | 'steady-jog';
  distance: number; // in miles
  description: string;
  pace?: string; // e.g., "3.0-3.8 mph"
  incline?: string; // e.g., "5-9%"
}

export interface WorkoutPlan {
  id: string;
  name: string;
  description: string;
  durationWeeks: number;
  daysPerWeek: string[]; // e.g., ['monday', 'wednesday', 'friday']
  exercises: WorkoutExercise[];
  cardio: {
    monday?: CardioSession;
    wednesday?: CardioSession;
    friday?: CardioSession;
    [key: string]: CardioSession | undefined;
  };
  notes?: string;
}

export interface HabitEntry {
  habitId: string;
  date: string;
  status: string;
  /** What the habit measures. See TrackingSpec — units come from the habit. */
  value?: number;
  notes?: string;
  mood?: 'great' | 'good' | 'okay' | 'bad' | 'terrible';
  timeSpent?: number;
  completedAt?: string;
  proof?: {
    imageUrl?: string;
    note?: string;
    uploadedAt?: string;
  };
  workoutData?: {
    exercises: {
      name: string;
      sets: number;
      reps: number;
      weight: number;
    }[];
    cardio?: {
      type: string;
      distance: number;
      duration?: number; // in minutes
      pace?: number; // mph
    };
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
  punishment?: string;
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
  workoutPlan?: WorkoutPlan;
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

/**
 * Local category slug <-> the category NAME in Baserow table 517.
 *
 * habits.category_id is a link_row, so writing it needs the category's ROW id —
 * which differs per environment and must not be hardcoded (the old sync path
 * hardcoded select-option ids like 2100 and would break the moment someone
 * edited the field). Matching on name is stable across environments and is
 * resolved once, lazily, then cached.
 *
 * Used in BOTH directions: Baserow returns the category as a lookup showing the
 * name, so reading maps it back to the slug the UI groups by.
 */
export const CATEGORY_SLUG_TO_NAME: Record<string, string> = {
  health: 'Health & Fitness',
  productivity: 'Productivity',
  learning: 'Learning',
  mindfulness: 'Mindfulness',
  social: 'Social',
  creative: 'Creativity',
  finance: 'Finance',
  other: 'Other'
};

const CATEGORY_NAME_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_SLUG_TO_NAME).map(([slug, name]) => [name.toLowerCase(), slug])
);

/** Baserow's category name back to the slug the habits page groups by. */
export function categorySlugFromName(name: string | undefined | null): string | undefined {
  if (!name) return undefined;
  return CATEGORY_NAME_TO_SLUG[name.trim().toLowerCase()] ?? name;
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
  habitEntries = signal<Map<string, HabitEntry>>(new Map());
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

  /**
   * True once habits have been fetched, from Baserow or from the localStorage
   * fallback.
   *
   * `habits().length === 0` is the app's first-run signal, but on its own it
   * cannot tell "this user has no habits" from "the fetch has not come back
   * yet". Anything that branches on emptiness — the onboarding wizard deciding
   * whether to offer starter habits — has to wait for this first.
   */
  readonly dataLoaded = signal(false);

  constructor(
    private baserowService: BaserowService,
    private authService: AuthService,
    private syncBus: SyncBus,
    private userStorage: UserStorage
  ) {
    // Initialize by loading data from Baserow (ONLY data source)
    this.loadDataFromDatabase();
    // DISABLED: Not using localStorage - only Baserow database
    // this.loadData();
    // DISABLED: Sample data not needed
    // this.initializeSampleData();
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
    // Retuned from 5 to 10: levels now come from challenges, and a single easy
    // challenge clears 5, which made this fire immediately and mean nothing.
    // The id stays 'level-5' on purpose — it is persisted in user_achievements
    // and renaming it would orphan every existing unlock.
    { id: 'level-5', name: 'Level Up!', description: 'Reach level 10', icon: '⭐', requirement: (gameState) => gameState.level >= 10 },
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

  // Utility Methods
  formatDate(date: Date): string {
    // Use local date components to avoid timezone issues
    // toISOString() converts to UTC which can shift the date
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
      }

      seenIds.add(newId);
      updatedHabits.push({ ...habit, id: newId });
    });

    // Update habit entries with new IDs
    if (Object.keys(idMapping).length > 0) {
      const newEntries = new Map<string, HabitEntry>();
      this.habitEntries().forEach((entry, key) => {
        const [habitId, date] = key.split('-');
        const newHabitId = idMapping[habitId] || habitId;
        const newKey = `${newHabitId}-${date}`;
        newEntries.set(newKey, { ...entry, habitId: newHabitId });
      });
      this.habitEntries.set(newEntries);

      this.habits.set(updatedHabits);
      this.saveData();
    }
  }

  addHabit(habit: Partial<Habit>): void {
    this.addHabits([habit]);
  }

  /**
   * Adds one or more habits, locally first and then to Baserow.
   *
   * Creation used to write localStorage ONLY — syncHabitToDatabase() existed
   * with zero callers, exactly as syncEntryToDatabase() did. A habit added on
   * one device was invisible on every other and gone with the site data.
   * Applying a template pack would have created ten of those at once.
   *
   * Local-first so the list repaints instantly; a failed write leaves the habit
   * on screen rather than yanking it away, and the next sync reconciles.
   */
  addHabits(drafts: Partial<Habit>[]): Observable<Habit[]> {
    const done = new ReplaySubject<Habit[]>(1);

    if (drafts.length === 0) {
      done.next([]);
      done.complete();
      return done.asObservable();
    }

    const created = drafts.map(habit => this.toNewHabit(habit));

    this.habits.update(habits => [...habits, ...created]);
    this.saveData();
    // Emits only once persistence settles, carrying the FINAL ids. A caller
    // that binds these to a challenge must not capture the temporary local id —
    // it is replaced by Baserow's row id moments later, and the binding would
    // silently point at nothing.
    this.persistNewHabits(created, done);

    return done.asObservable();
  }

  private toNewHabit(habit: Partial<Habit>): Habit {
    return {
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
      trackingUnit: habit.trackingUnit,
      targetValue: habit.targetValue,
      icon: habit.icon || '✅',
      description: habit.description || '',
      isActive: true,
      createdAt: new Date().toISOString(),
      frequency: 'daily',
      targetDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    };
  }

  /** Cached slug -> Baserow category row id. Resolved once per session. */
  private categoryIdCache: Map<string, number> | null = null;

  private categoryRowIds(): Observable<Map<string, number>> {
    if (this.categoryIdCache) return of(this.categoryIdCache);

    return this.baserowService.getHabitCategories().pipe(
      map((response: any) => {
        const byName = new Map<string, number>();
        for (const row of response?.results ?? []) {
          if (row?.name) byName.set(String(row.name).trim().toLowerCase(), row.id);
        }

        const bySlug = new Map<string, number>();
        for (const [slug, name] of Object.entries(CATEGORY_SLUG_TO_NAME)) {
          const id = byName.get(name.toLowerCase());
          if (id) bySlug.set(slug, id);
        }

        this.categoryIdCache = bySlug;
        return bySlug;
      }),
      catchError(() => {
        // Categories unavailable: still save the habits, uncategorised.
        console.warn('HabitsService: could not resolve habit categories.');
        return of(new Map<string, number>());
      })
    );
  }

  /**
   * One batch request rather than N creates — adding a pack of ten habits
   * should not be ten round trips.
   *
   * Single-selects are sent as their VALUE ('good', 'medium'), not the option
   * id. The old sync path hardcoded numeric ids like 2100, which break silently
   * the day someone edits that field's options in Baserow.
   */
  private persistNewHabits(habits: Habit[], done?: ReplaySubject<Habit[]>): void {
    const settle = (final: Habit[]) => {
      done?.next(final);
      done?.complete();
    };

    const userId = this.currentUserId();
    if (!userId) {
      settle(habits);
      return;
    }

    this.categoryRowIds()
      .pipe(
        switchMap(categoryIds => {
          const rows = habits.map(habit => {
            const categoryRowId = habit.category ? categoryIds.get(habit.category) : undefined;
            return {
              name: habit.name,
              type: habit.type,
              difficulty: habit.difficulty,
              points: habit.points,
              goal: habit.goal,
              reward: habit.reward ?? '',
              description: habit.description ?? '',
              icon: habit.icon,
              frequency: 'daily',
              is_active: true,
              streak: 0,
              best_streak: 0,
              user_id: userId,
              // link_row: an array of row ids. Omitted rather than sent empty
              // when unresolvable, so the habit still saves — it just lands
              // under Uncategorized instead of failing the whole batch.
              ...(categoryRowId ? { category_id: [categoryRowId] } : {})
            };
          });

          return this.baserowService.batchCreateRows<{ id: number }>(
            this.baserowService.tables.habits,
            rows
          );
        })
      )
      .subscribe({
        next: response => {
          // Adopt Baserow's row ids: entries link to a habit by id, so a local
          // id that never reaches the server would orphan every check-in.
          const ids = (response?.items ?? []).map(item => item.id);
          let final = habits;

          if (ids.length === habits.length) {
            const remap = new Map(habits.map((habit, i) => [habit.id, String(ids[i])]));
            this.habits.update(list =>
              list.map(h => (remap.has(h.id) ? { ...h, id: remap.get(h.id)! } : h))
            );
            this.saveData();
            final = habits.map((habit, i) => ({ ...habit, id: String(ids[i]) }));
          }

          this.syncBus.touched('habits');
          settle(final);
        },
        error: err => {
          console.warn('HabitsService: habits not persisted.', err);
          // The habits are on screen either way; the caller should still hear.
          settle(habits);
        }
      });
  }

  removeHabit(habitId: string): void {
    this.habits.update(habits => habits.filter(h => h.id !== habitId));
    this.saveData();
  }

  /**
   * Records a habit-day.
   *
   * `value` is what the habit actually measures — the time you woke, the
   * glasses you drank, the weight on the bar. A tick alone hides whether the
   * habit is getting better or quietly sliding: you can hold a 30-day streak
   * while your wake time drifts by two hours.
   */
  /**
   * Changes the target for one of the user's habits.
   *
   * Only the number is editable — the KIND of measurement (a clock time, a
   * weight, a count) is a property of the habit itself, but "before 07:00" is
   * a personal choice and a bad universal default.
   */
  setHabitTarget(habitId: string, target: number | undefined): void {
    this.habits.update(list =>
      list.map(h => (h.id === habitId ? { ...h, targetValue: target } : h))
    );
    this.saveData();

    const numericId = Number(habitId);
    if (!Number.isFinite(numericId)) return;

    this.baserowService
      .updateHabit(numericId, { target_value: target ?? null })
      .subscribe({
        next: () => this.syncBus.touched('habits'),
        error: err => console.warn('HabitsService: target not persisted.', err)
      });
  }

  /** Marks a habit done on a PAST day, with its value. Used to backfill. */
  completeHabitOnDate(habitId: string, date: Date, value: number | undefined): void {
    this.updateEntry(habitId, this.formatDate(date), 'completed', value);
  }

  /** Today's (or any day's) entry, if there is one. */
  getEntryForDate(habitId: string, date: Date): HabitEntry | undefined {
    return this.habitEntries().get(this.getHabitEntryKey(habitId, date));
  }

  /**
   * Marks a habit done and records what it measured.
   *
   * Separate from toggleHabit() because a value only makes sense when
   * completing — un-checking removes the entry, and there is nothing to record.
   */
  completeHabitWithValue(habitId: string, value: number | undefined): void {
    this.updateEntry(habitId, this.formatDate(new Date()), 'completed', value);
  }

  updateEntry(habitId: string, date: string, status: string, value?: number): void {
    const key = `${habitId}-${date}`;
    const entry: HabitEntry = {
      habitId,
      date,
      status,
      value,
      completedAt: new Date().toISOString()
    };

    // Create new Map to trigger signal update
    const newEntries = new Map(this.habitEntries());
    newEntries.set(key, entry);
    this.habitEntries.set(newEntries);

    this.updateStreaksAndPoints();
    this.saveData();

    // Local state first so the tick is instant, then persist. Until this
    // existed, saveData() wrote five localStorage keys and nothing else —
    // habit history never left the browser, so clearing site data lost it and
    // a second device saw nothing.
    this.persistEntry(entry);
  }

  /**
   * Writes one habit-day to Baserow.
   *
   * Failure is non-fatal: the local signal already has the entry, so the UI is
   * correct and the next successful write or reload reconciles. Same shape as
   * LevelService.award() — never lose a user action to a flaky network.
   */
  /** Reloads habits, entries and game state from Baserow. */
  refresh(): Observable<void> {
    return new Observable<void>(observer => {
      this.loadDataFromDatabase();
      observer.next();
      observer.complete();
    });
  }

  reset(): void {
    this.habits.set([]);
    this.habitEntries.set(new Map());
    this.gameState.update(s => ({ ...s, totalPoints: 0, dailyStreak: 0, longestStreak: 0 }));
    // The next user's habits have not been fetched yet, and an empty list from
    // the previous user must not read as "this one is brand new".
    this.dataLoaded.set(false);
  }

  private persistEntry(entry: HabitEntry): void {
    const userId = this.currentUserId();
    if (!userId) return;

    this.baserowService
      .upsertHabitEntry({
        habit_id: entry.habitId,
        user_id: userId,
        date: entry.date,
        status: entry.status,
        completed_at: entry.completedAt ?? null,
        notes: entry.notes ?? '',
        value: entry.value ?? entry.timeSpent ?? null
      })
      .subscribe({
        next: () => this.syncBus.touched('habits'),
        error: err => console.warn('HabitsService: habit entry not persisted.', err)
      });
  }

  /**
   * The signed-in user's id.
   *
   * NOT localStorage['userId'] — nothing in the app ever writes that key, so
   * reading it would file every user's data under 'default'.
   */
  private currentUserId(): string | null {
    const id = this.authService.currentUserValue?.id;
    return id !== undefined && id !== null ? String(id) : null;
  }

  getEntryStatus(habitId: string, date: string): string {
    const key = `${habitId}-${date}`;
    return this.habitEntries().get(key)?.status || 'not-started';
  }

  getHabitEntries(habitId: string): HabitEntry[] {
    const entries: HabitEntry[] = [];
    this.habitEntries().forEach((entry, key) => {
      if (key.startsWith(`${habitId}-`)) {
        entries.push(entry);
      }
    });
    return entries.sort((a, b) => a.date.localeCompare(b.date));
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
      // dailyStreak is the user's current best run across habits. It was never
      // assigned here, so the dashboard streak tile and the avatar status both
      // always read 0.
      dailyStreak: maxStreak,
      longestStreak: Math.max(currentGameState.longestStreak, maxStreak)
      // `level` is deliberately absent. It is owned by LevelService and summed
      // from the append-only level ledger, so it is earned and permanent.
      // Points are volatile — they are recomputed from current completion
      // rates on every call — and must never move the level again. The spread
      // above preserves whatever LevelService last pushed via setLevel().
    }));
  }

  /**
   * Written only by LevelService. Habits never compute level.
   * Kept narrow on purpose so the dependency stays one-way.
   */
  setLevel(level: number): void {
    this.gameState.update(state => (state.level === level ? state : { ...state, level }));
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
    this.userStorage.writeRaw('habiti-habits', JSON.stringify(this.habits()));
    this.userStorage.writeRaw('habiti-entries', JSON.stringify(Array.from(this.habitEntries().entries())));
    this.userStorage.writeRaw('habiti-gamestate', JSON.stringify(this.gameState()));
    this.userStorage.writeRaw('habiti-nightly-plans', JSON.stringify(this.nightlyPlans()));
  }

  private loadData(): void {
    try {
      const habitsData = this.userStorage.readRaw('habiti-habits');
      if (habitsData) {
        this.habits.set(JSON.parse(habitsData));
      }

      const entriesData = this.userStorage.readRaw('habiti-entries');
      if (entriesData) {
        this.habitEntries.set(new Map(JSON.parse(entriesData)));
      }

      const gameStateData = this.userStorage.readRaw('habiti-gamestate');
      if (gameStateData) {
        this.gameState.set(JSON.parse(gameStateData));
      }

      // A dormant SMTP config (host, username, PASSWORD) used to be read here and
      // written back out by exportData(). Nothing ever sent mail — a browser
      // cannot open an SMTP socket — so it stored a credential to no purpose and
      // then handed it to the user in a downloaded file. Removed entirely.
      this.userStorage.remove('habiti-smtp');

      const nightlyPlansData = this.userStorage.readRaw('habiti-nightly-plans');
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

  /**
   * A local backup of habit data.
   *
   * NOT a GDPR Article 20 portability export, and it must not be described as
   * one: it serialises client-side signals only — habits, entries, game state —
   * and knows nothing about the profile, challenges, pledges, levels, friends,
   * skills, projects or tasks. A real export has to come from the server.
   *
   * It also used to include `smtpConfig`, which carried a stored PASSWORD, so
   * every "backup" handed the user a credential in a plaintext file. That field
   * is gone along with the rest of the dormant SMTP config.
   */
  exportData(): void {
    const data = {
      habits: this.habits(),
      habitEntries: Array.from(this.habitEntries().entries()),
      gameState: this.gameState(),
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
      if (data.habitEntries) this.habitEntries.set(new Map(data.habitEntries));
      if (data.gameState) this.gameState.set(data.gameState);
      // data.smtpConfig in an older backup is ignored on purpose — see exportData().

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
    const currentEntries = this.habitEntries();
    const entry = currentEntries.get(key);

    if (entry) {
      const updatedEntry = {
        ...entry,
        proof: {
          ...entry.proof,
          ...proof,
          uploadedAt: new Date().toISOString()
        }
      };
      const newEntries = new Map(currentEntries);
      newEntries.set(key, updatedEntry);
      this.habitEntries.set(newEntries);
      this.saveData();
    }
  }

  getHabitProof(habitId: string, date: Date): { imageUrl?: string; note?: string } | undefined {
    const key = this.getHabitEntryKey(habitId, date);
    const entry = this.habitEntries().get(key);
    return entry?.proof;
  }

  removeHabitProofImage(habitId: string, date: Date): void {
    const key = this.getHabitEntryKey(habitId, date);
    const currentEntries = this.habitEntries();
    const entry = currentEntries.get(key);

    if (entry?.proof) {
      const updatedProof = { ...entry.proof };
      delete updatedProof.imageUrl;
      const updatedEntry = {
        ...entry,
        proof: updatedProof.note ? updatedProof : undefined
      };
      const newEntries = new Map(currentEntries);
      newEntries.set(key, updatedEntry);
      this.habitEntries.set(newEntries);
      this.saveData();
    }
  }

  removeHabitProofNote(habitId: string, date: Date): void {
    const key = this.getHabitEntryKey(habitId, date);
    const currentEntries = this.habitEntries();
    const entry = currentEntries.get(key);

    if (entry?.proof) {
      const updatedProof = { ...entry.proof };
      delete updatedProof.note;
      const updatedEntry = {
        ...entry,
        proof: updatedProof.imageUrl ? updatedProof : undefined
      };
      const newEntries = new Map(currentEntries);
      newEntries.set(key, updatedEntry);
      this.habitEntries.set(newEntries);
      this.saveData();
    }
  }

  // Database integration methods
  
  loadDataFromDatabase(): void {
    // Scoped to the signed-in user. This passed `undefined` before, so every
    // user loaded every habit in the table.
    const userId = this.currentUserId();

    this.baserowService.getHabits(userId ?? undefined, true).subscribe({
      next: (response) => {
        if (response.results) {
          const habits = response.results.map((row: any) => this.transformBaserowHabitToLocal(row));
          this.habits.set(habits);
        } else {
          console.warn('⚠️ No results in Baserow response');
        }
        this.dataLoaded.set(true);
      },
      error: (error) => {
        console.error('❌ Failed to load habits from Baserow:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        // Fall back to local storage
        this.loadData();
        this.dataLoaded.set(true);
      }
    });

    // Load habit entries
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    this.baserowService.getHabitEntries(undefined, userId ?? undefined, thirtyDaysAgo.toISOString(), today.toISOString()).subscribe({
      next: (response) => {
        if (response.results) {
          const newEntries = new Map(this.habitEntries());
          response.results.forEach((entry: any) => {
            const habitEntry = this.transformBaserowEntryToLocal(entry);
            const key = this.getHabitEntryKey(habitEntry.habitId, new Date(habitEntry.date));
            newEntries.set(key, habitEntry);
          });
          this.habitEntries.set(newEntries);
        }
      },
      error: (error) => {
        console.error('Failed to load habit entries from Baserow:', error);
      }
    });

    // Load game state
    this.baserowService.getGameState(userId ?? 'default').subscribe({
      next: (response) => {
        if (response.results && response.results.length > 0) {
          const gameStateData = response.results[0];

          /**
           * Merge, do not replace.
           *
           * This used to `set()` a whole new object with `theme: 'auto'`,
           * `weekStartsOn: 'monday'`, `notificationsEnabled: true` and
           * `soundEnabled: true` hardcoded — so every load silently discarded
           * whatever the user had chosen. The Baserow game_state row carries
           * only points, level and streaks (see getGameState/updateGameState),
           * so those four fields have no server value to restore and must be
           * carried over from what is already in memory.
           */
          this.gameState.update(state => ({
            ...state,
            totalPoints: gameStateData.total_points || 0,
            level: gameStateData.level || 1,
            dailyStreak: gameStateData.daily_streak ?? gameStateData.current_streak ?? 0,
            longestStreak: gameStateData.longest_streak ?? gameStateData.best_streak ?? 0
          }));
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
      type: this.mapHabitType(baserowHabit.type),
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
      // `|| 1` here turned "no target" into a target of 1, which then read as
      // a real user choice. Undefined means "use the library default".
      targetValue:
        baserowHabit.target_value != null && baserowHabit.target_value !== ''
          ? Number(baserowHabit.target_value)
          : undefined,
      // Lookup fields for category hierarchy
      category: categorySlugFromName(baserowHabit.category?.[0]?.value),
      subcategory: baserowHabit.subcategory?.[0]?.value || undefined,
      group: baserowHabit.group || undefined,
      targetDays: baserowHabit.target_days || undefined
    };
  }

  transformBaserowEntryToLocal(baserowEntry: any): HabitEntry {
    return {
      habitId: baserowEntry.habit_id?.[0]?.toString() || '',
      date: baserowEntry.date || new Date().toISOString(),
      status: baserowEntry.completed ? 'completed' : 'not-started',
      notes: baserowEntry.notes || '',
      mood: this.mapMood(baserowEntry.mood_after),
      // Both: `value` is the tracked measurement, `timeSpent` is the legacy
      // name several older screens still read.
      value: baserowEntry.value != null ? Number(baserowEntry.value) : undefined,
      timeSpent: baserowEntry.value || 0,
      completedAt: baserowEntry.created_at
    };
  }

  mapHabitType(value: any): 'good' | 'bad' {
    // Handle various Baserow return formats for single_select fields
    if (!value) return 'good'; // Default to good if no value

    // If it's a string, check directly
    if (typeof value === 'string') {
      return value.toLowerCase() === 'bad' ? 'bad' : 'good';
    }

    // If it's an object with a 'value' property (Baserow single_select format)
    if (typeof value === 'object' && value.value) {
      return value.value.toLowerCase() === 'bad' ? 'bad' : 'good';
    }

    // If it's a number (Baserow option ID), 2100 = good, 2101 = bad
    if (typeof value === 'number') {
      return value === 2100 ? 'good' : 'bad';
    }

    // If it's an object with an 'id' property
    if (typeof value === 'object' && value.id) {
      return value.id === 2100 ? 'good' : 'bad';
    }

    return 'good'; // Default fallback
  }

  mapDifficulty(value: any): 'easy' | 'medium' | 'hard' {
    // Handle string values
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'easy') return 'easy';
      if (lower === 'hard') return 'hard';
      return 'medium';
    }

    // Handle object with value property (Baserow single_select format)
    if (typeof value === 'object' && value?.value) {
      const lower = value.value.toLowerCase();
      if (lower === 'easy') return 'easy';
      if (lower === 'hard') return 'hard';
      return 'medium';
    }

    // Handle numeric IDs
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
      error: (error) => console.error('Failed to sync entry:', error)
    });
  }
}