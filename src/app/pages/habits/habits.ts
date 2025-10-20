import { Component, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HabitsService } from '../../services/habits';
import type { Habit, HabitCategory, HabitSubcategory } from '../../services/habits';

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
  @ViewChild('editForm') editForm: any;

  filterType: 'all' | 'good' | 'bad' = 'all';
  
  // Accordion state for group collapsing
  collapsedGroups: Set<string> = new Set();
  showView: 'grouped' | 'flat' = 'grouped';
  
  newHabit = {
    name: '',
    type: '' as 'good' | 'bad' | '',
    categoryId: '',
    subcategoryId: '',
    groupId: '',
    trackingType: 'simple' as 'simple' | 'quantity' | 'duration' | 'sets',
    points: 10,
    icon: '',
    description: ''
  };

  selectedCategory: HabitCategory | null = null;
  selectedSubcategory: HabitSubcategory | null = null;

  editingHabit: Partial<Habit> | null = null;

  addHabit(): void {
    if (!this.newHabit.name || !this.newHabit.type || !this.newHabit.categoryId) {
      return;
    }

    this.habitsService.addHabit({
      name: this.newHabit.name,
      type: this.newHabit.type as 'good' | 'bad',
      category: this.newHabit.categoryId,
      subcategory: this.newHabit.subcategoryId || undefined,
      group: this.newHabit.groupId || undefined,
      trackingType: this.newHabit.trackingType,
      icon: this.newHabit.icon || undefined,
      description: this.newHabit.description || undefined,
      difficulty: 'medium',
      points: this.newHabit.points,
      goal: 30,
      reward: 'Keep up the great work!'
    });

    // Reset form
    this.resetForm();
  }

  resetForm(): void {
    this.newHabit = {
      name: '',
      type: '',
      categoryId: '',
      subcategoryId: '',
      groupId: '',
      trackingType: 'simple',
      points: 10,
      icon: '',
      description: ''
    };
    this.selectedCategory = null;
    this.selectedSubcategory = null;
  }

  onCategoryChange(): void {
    this.selectedCategory = this.categories.find(c => c.id === this.newHabit.categoryId) || null;
    this.newHabit.subcategoryId = '';
    this.newHabit.groupId = '';
    this.selectedSubcategory = null;
  }

  onSubcategoryChange(): void {
    this.selectedSubcategory = this.selectedCategory?.subcategories?.find(s => s.id === this.newHabit.subcategoryId) || null;
    this.newHabit.groupId = '';
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
    return category ? `${category.icon} ${category.name}` : 'Unknown';
  }

  getSubcategoryName(subcategoryId: string): string {
    for (const category of this.categories) {
      const subcategory = category.subcategories?.find(s => s.id === subcategoryId);
      if (subcategory) {
        return `${subcategory.icon || ''} ${subcategory.name}`.trim();
      }
    }
    return 'Unknown';
  }

  getGroupName(groupId: string): string {
    for (const category of this.categories) {
      for (const subcategory of category.subcategories || []) {
        const group = subcategory.groups?.find(g => g.id === groupId);
        if (group) {
          return group.name;
        }
      }
    }
    return 'Unknown';
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

  // Group organization methods
  getHabitsGroupedByCategories(): any[] {
    const habits = this.getFilteredHabits();
    const grouped: any[] = [];

    // Group by category first
    for (const category of this.categories) {
      const categoryHabits = habits.filter(h => h.category === category.id);
      
      if (categoryHabits.length === 0) continue;

      const categoryGroup: any = {
        id: category.id,
        name: category.name,
        icon: category.icon,
        color: category.color,
        type: 'category',
        subcategories: []
      };

      // Group by subcategories within category
      if (category.subcategories) {
        for (const subcategory of category.subcategories) {
          const subcategoryHabits = categoryHabits.filter(h => h.subcategory === subcategory.id);
          
          if (subcategoryHabits.length === 0) continue;

          const subcategoryGroup: any = {
            id: subcategory.id,
            name: subcategory.name,
            icon: subcategory.icon,
            type: 'subcategory',
            groups: []
          };

          // Group by workout groups within subcategory
          if (subcategory.groups) {
            for (const group of subcategory.groups) {
              const groupHabits = subcategoryHabits.filter(h => h.group === group.id);
              
              if (groupHabits.length > 0) {
                subcategoryGroup.groups.push({
                  id: group.id,
                  name: group.name,
                  description: group.description,
                  exercises: group.exercises,
                  type: 'group',
                  habits: groupHabits
                });
              }
            }
          }

          // Add habits without specific groups to subcategory level
          const ungroupedHabits = subcategoryHabits.filter(h => !h.group);
          if (ungroupedHabits.length > 0) {
            subcategoryGroup.habits = ungroupedHabits;
          }

          categoryGroup.subcategories.push(subcategoryGroup);
        }
      }

      // Add habits without subcategories to category level
      const ungroupedCategoryHabits = categoryHabits.filter(h => !h.subcategory);
      if (ungroupedCategoryHabits.length > 0) {
        categoryGroup.habits = ungroupedCategoryHabits;
      }

      grouped.push(categoryGroup);
    }

    return grouped;
  }

  toggleGroup(groupId: string): void {
    if (this.collapsedGroups.has(groupId)) {
      this.collapsedGroups.delete(groupId);
    } else {
      this.collapsedGroups.add(groupId);
    }
  }

  isGroupCollapsed(groupId: string): boolean {
    return this.collapsedGroups.has(groupId);
  }

  toggleView(): void {
    this.showView = this.showView === 'grouped' ? 'flat' : 'grouped';
  }

  // Helper method to count habits in a category group
  getHabitsCountInGroup(categoryGroup: any): number {
    let count = categoryGroup.habits?.length || 0;
    
    if (categoryGroup.subcategories) {
      for (const sub of categoryGroup.subcategories) {
        count += sub.habits?.length || 0;
        if (sub.groups) {
          for (const grp of sub.groups) {
            count += grp.habits?.length || 0;
          }
        }
      }
    }
    
    return count;
  }

  // Helper method to count habits in a subcategory
  getHabitsCountInSubcategory(subcategoryGroup: any): number {
    let count = subcategoryGroup.habits?.length || 0;
    
    if (subcategoryGroup.groups) {
      for (const grp of subcategoryGroup.groups) {
        count += grp.habits?.length || 0;
      }
    }
    
    return count;
  }
}
