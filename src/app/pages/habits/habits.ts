import { Component, inject, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
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
  private router = inject(Router);

  protected readonly habits = this.habitsService.habits;
  protected readonly gameState = this.habitsService.gameState;
  protected readonly categories = this.habitsService.categories;

  @ViewChild('editModal') editModal!: ElementRef<HTMLDialogElement>;
  @ViewChild('editForm') editForm: any;

  filterType: 'all' | 'good' | 'bad' = 'all';

  // Accordion state for group collapsing
  collapsedGroups: Set<string> = new Set();
  showView: 'grouped' | 'flat' = 'grouped'; // Grouped accordion view as default

  // Dropdown state tracking
  openDropdownId: string | null = null;
  
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

  // Debug mode
  showDebug = true;

  getDebugData(): string {
    return JSON.stringify({
      habitsCount: this.habits().length,
      habits: this.habits(),
      categories: this.categories,
      filterType: this.filterType,
      showView: this.showView
    }, null, 2);
  }

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
    if (!categoryId) return 'Uncategorized';
    const category = this.categories.find(c => c.id === categoryId);
    return category ? `${category.icon} ${category.name}` : 'Uncategorized';
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

  toggleDropdown(habitId: string, event: Event): void {
    event.stopPropagation();
    if (this.openDropdownId === habitId) {
      this.openDropdownId = null;
    } else {
      this.openDropdownId = habitId;
    }
  }

  isDropdownOpen(habitId: string): boolean {
    return this.openDropdownId === habitId;
  }

  closeDropdown(): void {
    this.openDropdownId = null;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    // Close dropdown when clicking anywhere on the document
    this.openDropdownId = null;
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
    this.editingHabit = {
      ...habit,
      targetDays: habit.targetDays ? [...habit.targetDays] : []
    };
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

  isTargetDay(day: string): boolean {
    if (!this.editingHabit?.targetDays) return false;
    return this.editingHabit.targetDays.includes(day as any);
  }

  toggleTargetDay(day: string): void {
    if (!this.editingHabit) return;

    if (!this.editingHabit.targetDays) {
      this.editingHabit.targetDays = [];
    }

    const index = this.editingHabit.targetDays.indexOf(day as any);
    if (index > -1) {
      this.editingHabit.targetDays.splice(index, 1);
    } else {
      this.editingHabit.targetDays.push(day as any);
    }
  }

  updateHabitType(habitId: string, type: 'good' | 'bad'): void {
    this.habitsService.updateHabit(habitId, { type });
  }

  updateHabitPoints(habitId: string, points: number | Event): void {
    const pointsValue = typeof points === 'number' ? points : parseInt((points.target as HTMLSelectElement).value);
    this.habitsService.updateHabit(habitId, { points: pointsValue });
  }

  updateHabitReward(habitId: string, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const reward = select.value;
    this.habitsService.updateHabit(habitId, { reward });
  }

  updateHabitPunishment(habitId: string, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const punishment = select.value;
    this.habitsService.updateHabit(habitId, { punishment });
  }

  deleteHabit(habitId: string): void {
    if (confirm('Are you sure you want to delete this habit? This cannot be undone.')) {
      this.habitsService.deleteHabit(habitId);
    }
  }

  viewHabitDetails(habit: Habit): void {
    this.router.navigate(['/habits', habit.id]);
  }

  // Group organization methods
  getHabitsGroupedByCategories(): any[] {
    const habits = this.getFilteredHabits();
    const grouped: any[] = [];

    console.log('Total habits:', habits.length);
    if (habits.length > 0) {
      console.log('Sample habit:', habits[0]);
    }

    // Get all unique category IDs from actual habits
    const categoryIds = new Set(habits.map(h => h.category).filter(Boolean));
    console.log('Category IDs found:', Array.from(categoryIds));

    // Get habits without any category
    const uncategorizedHabits = habits.filter(h => !h.category);
    console.log('Uncategorized habits:', uncategorizedHabits.length);

    // Group by category first
    for (const categoryId of categoryIds) {
      const categoryHabits = habits.filter(h => h.category === categoryId);

      if (categoryHabits.length === 0) continue;

      // Find category definition or create a dynamic one
      const category = this.categories.find(c => c.id === categoryId);
      const firstHabitInCategory = categoryHabits[0];

      const categoryGroup: any = {
        id: categoryId as string,
        name: category?.name || this.formatCategoryName(categoryId as string),
        icon: category?.icon || firstHabitInCategory.icon || '📁',
        color: category?.color || 'text-slate-600',
        type: 'category',
        subcategories: []
      };

      // Get all unique subcategories within this category
      const subcategoryIds = new Set(
        categoryHabits
          .map(h => h.subcategory)
          .filter(Boolean)
      );

      // Group by subcategories
      for (const subcategoryId of subcategoryIds) {
        const subcategoryHabits = categoryHabits.filter(h => h.subcategory === subcategoryId);

        if (subcategoryHabits.length === 0) continue;

        const subcategory = category?.subcategories?.find(s => s.id === subcategoryId);

        const subcategoryGroup: any = {
          id: subcategoryId as string,
          name: subcategory?.name || this.formatCategoryName(subcategoryId as string),
          icon: subcategory?.icon || '📂',
          type: 'subcategory',
          groups: []
        };

        // Get all unique groups (Task/Step from CSV) within this subcategory
        const groupNames = new Set(
          subcategoryHabits
            .map(h => h.group)
            .filter(Boolean)
        );

        // Group by Task/Step groups
        for (const groupName of groupNames) {
          const groupHabits = subcategoryHabits.filter(h => h.group === groupName);

          if (groupHabits.length > 0) {
            subcategoryGroup.groups.push({
              id: groupName as string,
              name: groupName as string,
              type: 'group',
              habits: groupHabits
            });
          }
        }

        // Add habits without specific groups to subcategory level
        const ungroupedHabits = subcategoryHabits.filter(h => !h.group);
        if (ungroupedHabits.length > 0) {
          subcategoryGroup.habits = ungroupedHabits;
        }

        categoryGroup.subcategories.push(subcategoryGroup);
      }

      // Add habits without subcategories to category level
      const ungroupedCategoryHabits = categoryHabits.filter(h => !h.subcategory);
      console.log(`Category ${categoryId}: ${ungroupedCategoryHabits.length} habits without subcategory`);
      if (ungroupedCategoryHabits.length > 0) {
        categoryGroup.habits = ungroupedCategoryHabits;
        console.log('Habits added to category:', ungroupedCategoryHabits.map(h => h.name));
      }

      grouped.push(categoryGroup);
    }

    // Add uncategorized habits as a separate group
    if (uncategorizedHabits.length > 0) {
      grouped.push({
        id: 'uncategorized',
        name: 'Uncategorized',
        icon: '📌',
        color: 'text-gray-600',
        type: 'category',
        habits: uncategorizedHabits,
        subcategories: []
      });
    }

    console.log('Grouped categories:', grouped.length);
    console.log('Grouped data:', grouped);
    return grouped;
  }

  // Helper to format category ID to display name
  private formatCategoryName(id: string): string {
    return id
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
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
