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
  color?: string;
}

interface DayColumn {
  date: Date;
  dateString: string;
  dayName: string;
  dayNumber: number;
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
  
  statusOptions = [
    { label: 'Not Started', value: 'not-started', icon: '⭕' },
    { label: 'In Progress', value: 'in-progress', icon: '🔄' },
    { label: 'Completed', value: 'completed', icon: '✅' },
    { label: 'Skipped', value: 'skipped', icon: '⏭️' },
    { label: 'Failed', value: 'failed', icon: '❌' }
  ];

  currentMonth: Date = new Date();
  newHabitName: string = '';

  ngOnInit() {
    this.initializeMonth();
    this.loadHabits();
    this.loadHabitEntries();
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
    } else {
      this.habits = [
        { id: '1', name: 'Exercise', color: 'bg-blue-500' },
        { id: '2', name: 'Read', color: 'bg-green-500' },
        { id: '3', name: 'Meditate', color: 'bg-purple-500' }
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

  addHabit() {
    if (this.newHabitName.trim()) {
      const newHabit: Habit = {
        id: Date.now().toString(),
        name: this.newHabitName,
        color: this.getRandomColor()
      };
      this.habits.push(newHabit);
      this.newHabitName = '';
      this.saveHabits();
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
    const entry: HabitEntry = {
      habitId,
      date: dateString,
      status
    };
    this.habitEntries.set(key, entry);
    this.saveHabitEntries();
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
}
