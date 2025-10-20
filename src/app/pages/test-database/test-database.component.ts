import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaserowService } from '../../services/baserow.service';
import { HabitsService } from '../../services/habits';

@Component({
  selector: 'app-test-database',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="p-8">
      <h1 class="text-2xl font-bold mb-4">Database Integration Test</h1>
      
      <div class="space-y-4">
        <div class="border p-4 rounded">
          <h2 class="font-semibold mb-2">Habit Categories from Database:</h2>
          <div *ngIf="loading">Loading...</div>
          <div *ngIf="!loading && categories.length === 0">No categories found in database</div>
          <ul *ngIf="!loading && categories.length > 0">
            <li *ngFor="let cat of categories" class="mb-1">
              {{ cat.icon }} {{ cat.name }} - {{ cat.description }}
            </li>
          </ul>
        </div>

        <div class="border p-4 rounded">
          <h2 class="font-semibold mb-2">Habits from Database:</h2>
          <div *ngIf="loading">Loading...</div>
          <div *ngIf="!loading && habits.length === 0">No habits found in database</div>
          <ul *ngIf="!loading && habits.length > 0">
            <li *ngFor="let habit of habits" class="mb-1">
              {{ habit.icon }} {{ habit.name }} ({{ habit.type }}) - Points: {{ habit.points }}
            </li>
          </ul>
        </div>

        <div class="border p-4 rounded">
          <h2 class="font-semibold mb-2">Test Create Habit:</h2>
          <button (click)="createTestHabit()" class="px-4 py-2 bg-blue-500 text-white rounded">
            Create Test Habit
          </button>
          <div *ngIf="testResult" class="mt-2 p-2 bg-green-100 rounded">
            {{ testResult }}
          </div>
        </div>
      </div>
    </div>
  `
})
export class TestDatabaseComponent implements OnInit {
  loading = true;
  categories: any[] = [];
  habits: any[] = [];
  testResult = '';

  constructor(
    private baserowService: BaserowService,
    private habitsService: HabitsService
  ) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading = true;
    
    // Load categories
    this.baserowService.getHabitCategories().subscribe({
      next: (response) => {
        this.categories = response.results || [];
        console.log('Categories loaded:', this.categories);
      },
      error: (error) => {
        console.error('Failed to load categories:', error);
      }
    });

    // Load habits
    this.baserowService.getHabits().subscribe({
      next: (response) => {
        this.habits = response.results || [];
        console.log('Habits loaded:', this.habits);
        this.loading = false;
      },
      error: (error) => {
        console.error('Failed to load habits:', error);
        this.loading = false;
      }
    });
  }

  createTestHabit() {
    const testHabit = {
      name: 'Test Habit ' + new Date().getTime(),
      type: 2100, // good habit
      difficulty: 2102, // easy
      points: 10,
      goal: 1,
      description: 'This is a test habit created from the app',
      icon: '🧪',
      is_active: true,
      user_id: 'test-user'
    };

    this.baserowService.createHabit(testHabit).subscribe({
      next: (response) => {
        this.testResult = 'Habit created successfully! ID: ' + response.id;
        this.loadData(); // Reload to show new habit
      },
      error: (error) => {
        this.testResult = 'Failed to create habit: ' + error.message;
      }
    });
  }
}