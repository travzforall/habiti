import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HabitsService } from '../../services/habits';
import { TemplatePickerComponent } from '../../components/template-picker/template-picker.component';
import { HabitGuidanceComponent } from '../../components/habit-guidance/habit-guidance.component';
import {
  HABIT_TEMPLATE_PACKS,
  HabitTemplatePack,
  isAlreadyAdded
} from '../../config/habit-template-packs';
import {
  HABIT_LIBRARY,
  LibraryCategory,
  LibraryHabit,
  LibrarySubcategory,
  hasGuidance,
  searchLibrary
} from '../../config/habit-library';

type Tab = 'packs' | 'browse';

@Component({
  selector: 'app-templates',
  standalone: true,
  imports: [CommonModule, RouterModule, TemplatePickerComponent, HabitGuidanceComponent],
  templateUrl: './templates.html',
  styleUrl: './templates.scss'
})
export class TemplatesComponent {
  private habitsService = inject(HabitsService);

  protected readonly habits = this.habitsService.habits;
  protected readonly packs = HABIT_TEMPLATE_PACKS;
  protected readonly library = HABIT_LIBRARY;

  protected readonly tab = signal<Tab>('packs');
  protected readonly query = signal('');
  protected readonly selectedPack = signal<HabitTemplatePack | null>(null);
  protected readonly guidanceFor = signal<LibraryHabit | null>(null);

  /** Which category is expanded in browse mode. Null shows the category grid. */
  protected readonly openCategory = signal<LibraryCategory | null>(null);
  protected readonly openSubcategory = signal<string | null>(null);

  // --- Packs -------------------------------------------------------------

  protected readonly visiblePacks = computed(() => {
    const term = this.query().trim().toLowerCase();
    if (!term) return this.packs;

    return this.packs.filter(pack => {
      if (pack.name.toLowerCase().includes(term)) return true;
      if (pack.description.toLowerCase().includes(term)) return true;
      return pack.habits.some(habit => habit.name.toLowerCase().includes(term));
    });
  });

  // --- Browse ------------------------------------------------------------

  /** Search cuts across the whole library, ignoring the category drill-down. */
  protected readonly searchResults = computed(() => searchLibrary(this.query()));

  protected readonly visibleHabits = computed<LibraryHabit[]>(() => {
    if (this.query().trim()) return this.searchResults();

    const category = this.openCategory();
    if (!category) return [];

    const section = this.library.find(s => s.category.id === category.id);
    const all = section?.habits ?? [];
    const sub = this.openSubcategory();
    return sub ? all.filter(h => h.subcategoryId === sub) : all;
  });

  protected countIn(category: LibraryCategory, subcategoryId?: string): number {
    const section = this.library.find(s => s.category.id === category.id);
    const habits = section?.habits ?? [];
    return subcategoryId ? habits.filter(h => h.subcategoryId === subcategoryId).length : habits.length;
  }

  protected openCategoryView(category: LibraryCategory): void {
    this.openCategory.set(category);
    this.openSubcategory.set(null);
  }

  protected backToCategories(): void {
    this.openCategory.set(null);
    this.openSubcategory.set(null);
  }

  protected toggleSubcategory(sub: LibrarySubcategory): void {
    this.openSubcategory.update(current => (current === sub.id ? null : sub.id));
  }

  // --- Shared ------------------------------------------------------------

  protected alreadyHas(name: string): boolean {
    return isAlreadyAdded(name, this.habits());
  }

  protected remainingCount(pack: HabitTemplatePack): number {
    const existing = this.habits();
    return pack.habits.filter(habit => !isAlreadyAdded(habit.name, existing)).length;
  }

  protected open(pack: HabitTemplatePack): void {
    this.selectedPack.set(pack);
  }

  protected showsGuidance(habit: LibraryHabit): boolean {
    return hasGuidance(habit);
  }

  /**
   * Adds a single habit straight from the browse list.
   *
   * The picker is for choosing among a set; browsing is one-at-a-time, and
   * making someone open a dialog to add one habit is friction for no gain.
   */
  protected addOne(habit: LibraryHabit): void {
    if (this.alreadyHas(habit.name)) return;

    this.selectedPack.set({
      id: `single:${habit.id}`,
      name: habit.name,
      icon: habit.icon,
      description: habit.description,
      accent: 'from-blue-500 to-indigo-600',
      habits: [habit]
    });
  }
}
