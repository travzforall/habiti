import { Component, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface HabitEntry {
  habitId: string;
  date: string;
  status: string;
}

interface Habit {
  id: string;
  name: string;
  type: 'good' | 'bad';
  color?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  streak: number;
  bestStreak: number;
}

interface DayColumn {
  date: Date;
  dateString: string;
  dayName: string;
  dayNumber: number;
}

interface GameState {
  totalPoints: number;
  level: number;
  achievements: string[];
  dailyStreak: number;
  longestStreak: number;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement: (gameState: GameState, habits: Habit[]) => boolean;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly title = signal('Habiti');
  
  habits: Habit[] = [];
  days: DayColumn[] = [];
  habitEntries: Map<string, HabitEntry> = new Map();
  gameState: GameState = {
    totalPoints: 0,
    level: 1,
    achievements: [],
    dailyStreak: 0,
    longestStreak: 0
  };
  
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

  currentMonth: Date = new Date();
  newHabitName: string = '';
  newHabitType: 'good' | 'bad' = 'good';
  newHabitDifficulty: 'easy' | 'medium' | 'hard' = 'medium';

  ngOnInit() {
    this.initializeMonth();
    this.loadHabits();
    this.loadHabitEntries();
    this.loadGameState();
    this.checkAchievements();
  }

  initializeMonth() {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    this.days = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      this.days.push({
        date: date,
        dateString: this.formatDate(date),
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: day
      });
    }
  }

  formatDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  loadHabits() {
    const storedHabits = localStorage.getItem('habits');
    if (storedHabits) {
      this.habits = JSON.parse(storedHabits);
      // Migrate old habits without game properties
      this.habits = this.habits.map(habit => ({
        ...habit,
        type: habit.type || 'good',
        difficulty: habit.difficulty || 'medium',
        streak: habit.streak || 0,
        bestStreak: habit.bestStreak || 0
      }));
    } else {
      this.habits = [
        { id: '1', name: 'Exercise', type: 'good', color: 'bg-blue-500', difficulty: 'medium', streak: 0, bestStreak: 0 },
        { id: '2', name: 'Read', type: 'good', color: 'bg-green-500', difficulty: 'easy', streak: 0, bestStreak: 0 },
        { id: '3', name: 'Stop Smoking', type: 'bad', color: 'bg-red-500', difficulty: 'hard', streak: 0, bestStreak: 0 }
      ];
      this.saveHabits();
    }
  }

  loadHabitEntries() {
    const storedEntries = localStorage.getItem('habitEntries');
    if (storedEntries) {
      const entriesArray = JSON.parse(storedEntries) as HabitEntry[];
      this.habitEntries = new Map(
        entriesArray.map(entry => [`${entry.habitId}-${entry.date}`, entry])
      );
    }
  }

  saveHabits() {
    localStorage.setItem('habits', JSON.stringify(this.habits));
  }

  saveHabitEntries() {
    const entriesArray = Array.from(this.habitEntries.values());
    localStorage.setItem('habitEntries', JSON.stringify(entriesArray));
  }

  loadGameState() {
    const storedState = localStorage.getItem('gameState');
    if (storedState) {
      this.gameState = JSON.parse(storedState);
    }
  }

  saveGameState() {
    localStorage.setItem('gameState', JSON.stringify(this.gameState));
  }

  addHabit() {
    if (this.newHabitName.trim()) {
      const newHabit: Habit = {
        id: Date.now().toString(),
        name: this.newHabitName,
        type: this.newHabitType,
        color: this.getRandomColor(),
        difficulty: this.newHabitDifficulty,
        streak: 0,
        bestStreak: 0
      };
      this.habits.push(newHabit);
      this.newHabitName = '';
      this.newHabitType = 'good';
      this.newHabitDifficulty = 'medium';
      this.saveHabits();
      this.checkAchievements();
    }
  }

  removeHabit(habitId: string) {
    this.habits = this.habits.filter(h => h.id !== habitId);
    const keysToDelete: string[] = [];
    this.habitEntries.forEach((value, key) => {
      if (key.startsWith(habitId + '-')) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.habitEntries.delete(key));
    this.saveHabits();
    this.saveHabitEntries();
  }

  getRandomColor(): string {
    const colors = [
      'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
      'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  getEntryStatus(habitId: string, dateString: string): string {
    const key = `${habitId}-${dateString}`;
    return this.habitEntries.get(key)?.status || 'not-started';
  }

  updateEntry(habitId: string, dateString: string, status: string) {
    const key = `${habitId}-${dateString}`;
    const oldStatus = this.getEntryStatus(habitId, dateString);
    const entry: HabitEntry = {
      habitId,
      date: dateString,
      status
    };
    this.habitEntries.set(key, entry);
    this.saveHabitEntries();
    
    // Update points and streaks
    this.updatePoints(habitId, oldStatus, status);
    this.updateStreaks(habitId);
    this.checkAchievements();
  }

  previousMonth() {
    this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() - 1);
    this.initializeMonth();
  }

  nextMonth() {
    this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1);
    this.initializeMonth();
  }

  getMonthYear(): string {
    return this.currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  getCompletionRate(habitId: string): number {
    let completed = 0;
    let total = 0;
    
    this.days.forEach(day => {
      const status = this.getEntryStatus(habitId, day.dateString);
      if (status !== 'not-started') {
        total++;
        if (status === 'completed') {
          completed++;
        }
      }
    });
    
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }

  getOverallProgress(): number {
    if (this.habits.length === 0) return 0;
    const sum = this.habits.reduce((acc, habit) => acc + this.getCompletionRate(habit.id), 0);
    return Math.round(sum / this.habits.length);
  }

  // Game Logic Methods
  updatePoints(habitId: string, oldStatus: string, newStatus: string) {
    const habit = this.habits.find(h => h.id === habitId);
    if (!habit) return;

    const difficultyMultiplier = { easy: 1, medium: 2, hard: 3 };
    const basePoints = difficultyMultiplier[habit.difficulty];

    // Remove old points
    if (oldStatus === 'completed') {
      this.gameState.totalPoints -= (habit.type === 'good' ? basePoints : basePoints * 2);
    } else if (oldStatus === 'failed' && habit.type === 'bad') {
      this.gameState.totalPoints -= basePoints;
    }

    // Add new points
    if (newStatus === 'completed') {
      this.gameState.totalPoints += (habit.type === 'good' ? basePoints : basePoints * 2);
    } else if (newStatus === 'failed' && habit.type === 'bad') {
      this.gameState.totalPoints += basePoints; // Failing a bad habit gives points
    }

    // Update level
    this.gameState.level = Math.floor(this.gameState.totalPoints / 50) + 1;
    this.saveGameState();
  }

  updateStreaks(habitId: string) {
    const habit = this.habits.find(h => h.id === habitId);
    if (!habit) return;

    // Calculate current streak
    let currentStreak = 0;
    const today = new Date();
    
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateString = this.formatDate(checkDate);
      const status = this.getEntryStatus(habitId, dateString);
      
      const isSuccess = (habit.type === 'good' && status === 'completed') || 
                       (habit.type === 'bad' && (status === 'not-started' || status === 'skipped'));
      
      if (isSuccess) {
        currentStreak++;
      } else if (status !== 'not-started') {
        break;
      }
    }

    habit.streak = currentStreak;
    habit.bestStreak = Math.max(habit.bestStreak, currentStreak);
    
    // Update overall streaks
    this.gameState.dailyStreak = this.calculateDailyStreak();
    this.gameState.longestStreak = Math.max(this.gameState.longestStreak, this.gameState.dailyStreak);
    
    this.saveHabits();
    this.saveGameState();
  }

  calculateDailyStreak(): number {
    const today = new Date();
    let streak = 0;
    
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateString = this.formatDate(checkDate);
      
      let dayCompleted = false;
      for (const habit of this.habits) {
        const status = this.getEntryStatus(habit.id, dateString);
        const isSuccess = (habit.type === 'good' && status === 'completed') || 
                         (habit.type === 'bad' && (status === 'not-started' || status === 'skipped'));
        if (isSuccess) {
          dayCompleted = true;
          break;
        }
      }
      
      if (dayCompleted) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  }

  checkAchievements() {
    const newAchievements: string[] = [];
    
    for (const achievement of this.achievements) {
      if (!this.gameState.achievements.includes(achievement.id) && 
          achievement.requirement(this.gameState, this.habits)) {
        newAchievements.push(achievement.id);
        this.gameState.achievements.push(achievement.id);
      }
    }
    
    if (newAchievements.length > 0) {
      this.saveGameState();
      // Could show notification here
    }
  }

  getHabitTypeIcon(type: 'good' | 'bad'): string {
    return type === 'good' ? '✨' : '🚫';
  }

  getDifficultyColor(difficulty: 'easy' | 'medium' | 'hard'): string {
    const colors = { easy: 'text-green-500', medium: 'text-yellow-500', hard: 'text-red-500' };
    return colors[difficulty];
  }

  getStreakIcon(streak: number): string {
    if (streak >= 30) return '🔥🔥🔥';
    if (streak >= 7) return '🔥🔥';
    if (streak >= 3) return '🔥';
    return '';
  }

  getLevelProgress(): number {
    const pointsInCurrentLevel = this.gameState.totalPoints % 50;
    return (pointsInCurrentLevel / 50) * 100;
  }

  getPointsForNextLevel(): number {
    return 50 - (this.gameState.totalPoints % 50);
  }

  getUnlockedAchievements(): Achievement[] {
    return this.achievements.filter(a => this.gameState.achievements.includes(a.id));
  }

  getGoodHabitsCount(): number {
    return this.habits.filter(h => h.type === 'good').length;
  }

  getBadHabitsCount(): number {
    return this.habits.filter(h => h.type === 'bad').length;
  }
}
