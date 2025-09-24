import { Component, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HabitsService } from '../../services/habits';
import type { Habit } from '../../services/habits';

@Component({
  selector: 'app-habits',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './habits.html',
  styleUrl: './habits.scss'
})
export class HabitsComponent {
  private habitsService = inject(HabitsService);
  
  protected readonly habits = this.habitsService.habits;
  protected readonly gameState = this.habitsService.gameState;
  protected readonly categories = this.habitsService.categories;

  @ViewChild('editModal') editModal!: ElementRef<HTMLDialogElement>;

  filterType: 'all' | 'good' | 'bad' = 'all';
  
  newHabit = {
    name: '',
    type: '' as 'good' | 'bad' | '',
    categoryId: '',
    icon: '',
    description: ''
  };

  editingHabit: Partial<Habit> | null = null;

  addHabit(): void {
    if (!this.newHabit.name || !this.newHabit.type || !this.newHabit.categoryId) {
      return;
    }

    this.habitsService.addHabit({
      name: this.newHabit.name,
      type: this.newHabit.type as 'good' | 'bad',
      category: this.newHabit.categoryId,
      icon: this.newHabit.icon || undefined,
      description: this.newHabit.description || undefined,
      difficulty: 'medium',
      points: 10,
      goal: 30,
      reward: 'Keep up the great work!'
    });

    // Reset form
    this.newHabit = {
      name: '',
      type: '',
      categoryId: '',
      icon: '',
      description: ''
    };
  }

  getFilteredHabits(): Habit[] {
    const allHabits = this.habits();
    if (this.filterType === 'all') {
      return allHabits;
    }
    return allHabits.filter(habit => habit.type === this.filterType);
  }

  getHabitTypeIcon(type: 'good' | 'bad'): string {
    return type === 'good' ? '✅' : '🚫';
  }

  getCategoryName(categoryId: string): string {
    const category = this.categories.find(c => c.id === categoryId);
    return category ? category.name : 'Unknown';
  }

  getStreakIcon(streak: number): string {
    if (streak >= 30) return '🏆';
    if (streak >= 14) return '🔥';
    if (streak >= 7) return '⚡';
    if (streak >= 3) return '🌟';
    return '📅';
  }

  getCompletionRate(habitId: string): number {
    return this.habitsService.getCompletionRate(habitId);
  }

  markHabitComplete(habitId: string): void {
    this.habitsService.toggleHabit(habitId);
  }

  isHabitCompletedToday(habitId: string): boolean {
    return this.habitsService.isHabitCompletedToday(habitId);
  }

  getActionText(type: 'good' | 'bad'): string {
    return type === 'good' ? 'Mark Complete' : 'Mark Avoided';
  }

  editHabit(habit: Habit): void {
    this.editingHabit = { ...habit };
    this.editModal.nativeElement.showModal();
  }

  updateHabit(): void {
    if (this.editingHabit && this.editingHabit.id) {
      this.habitsService.updateHabit(this.editingHabit.id, this.editingHabit);
      this.closeEditModal();
    }
  }

  closeEditModal(): void {
    this.editingHabit = null;
    this.editModal.nativeElement.close();
  }

  deleteHabit(habitId: string): void {
    if (confirm('Are you sure you want to delete this habit? This cannot be undone.')) {
      this.habitsService.deleteHabit(habitId);
    }
  }

  viewHabitDetails(habit: Habit): void {
    // TODO: Navigate to habit details page or show details modal
    console.log('View details for habit:', habit.name);
  }
}
