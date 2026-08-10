import { Injectable, inject } from '@angular/core';
import { HabitsService, Habit } from './habits';

interface CSVHabit {
  category: string;
  task: string;
  details: string;
  rating: string;
  type: string;
  timeFrame: string;
}

@Injectable({
  providedIn: 'root'
})
export class HabitImporterService {
  private habitsService = inject(HabitsService);

  // Map to store created category IDs
  private categoryMap = new Map<string, string>();
  private subcategoryMap = new Map<string, string>();

  parseCSV(csvText: string): CSVHabit[] {
    const lines = csvText.split('\n');
    const habits: CSVHabit[] = [];

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = this.parseCSVLine(line);
      if (parts.length >= 6) {
        habits.push({
          category: parts[0],
          task: parts[1],
          details: parts[2],
          rating: parts[3],
          type: parts[4],
          timeFrame: parts[5]
        });
      }
    }

    return habits;
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  private mapTimeFrameToFrequency(timeFrame: string): 'daily' | 'weekly' | 'custom' {
    const lower = timeFrame.toLowerCase();
    if (lower.includes('everyday') || lower.includes('daily')) return 'daily';
    if (lower.includes('weekly')) return 'weekly';
    return 'custom';
  }

  private mapTimeFrameToTargetDays(timeFrame: string): ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday')[] | undefined {
    const lower = timeFrame.toLowerCase();

    if (lower.includes('everyday') || lower.includes('daily')) {
      return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    }

    // For specific workout days (Mon, Wed, Fri)
    if (lower.includes('mon') && lower.includes('wed') && lower.includes('fri')) {
      return ['monday', 'wednesday', 'friday'];
    }

    return undefined;
  }

  private calculatePoints(rating: string): number {
    // Extract first number from rating (e.g., "-2 first / -3 repeat" -> 2)
    const match = rating.match(/-?\d+/);
    if (!match) return 10;

    const value = Math.abs(parseInt(match[0]));

    // Map rating to points
    if (value === 5) return 20; // Highest priority
    if (value === 4) return 15;
    if (value === 3) return 10;
    if (value === 2) return 5;
    return 5;
  }

  private mapCategoryToIcon(category: string): string {
    const lower = category.toLowerCase();

    if (lower.includes('spiritual') || lower.includes('prayer')) return '🙏';
    if (lower.includes('reading')) return '📖';
    if (lower.includes('exercise') || lower.includes('push') || lower.includes('pull') || lower.includes('legs')) return '💪';
    if (lower.includes('cardio')) return '🏃';
    if (lower.includes('meals') || lower.includes('breakfast') || lower.includes('lunch') || lower.includes('dinner')) return '🍽️';
    if (lower.includes('snacks')) return '🍎';
    if (lower.includes('hygiene')) return '🚿';
    if (lower.includes('music') || lower.includes('guitar') || lower.includes('bass') || lower.includes('drums')) return '🎸';
    if (lower.includes('keyboard')) return '🎹';
    if (lower.includes('fl studio') || lower.includes('recording')) return '🎵';
    if (lower.includes('dj')) return '🎧';
    if (lower.includes('household') || lower.includes('cleaning')) return '🏠';
    if (lower.includes('laundry')) return '🧺';
    if (lower.includes('yard')) return '🌿';
    if (lower.includes('leisure') || lower.includes('weed')) return '🎮';

    return '✅';
  }

  private findOrCreateCategoryId(categoryName: string): string {
    // Check if we already mapped this category
    if (this.categoryMap.has(categoryName)) {
      return this.categoryMap.get(categoryName)!;
    }

    // Generate ID from name
    const categoryId = categoryName.toLowerCase().replace(/\s+/g, '-');

    // Check if category already exists in service
    const existingCategory = this.habitsService.categories.find(c =>
      c.id === categoryId || c.name.toLowerCase() === categoryName.toLowerCase()
    );

    if (existingCategory) {
      this.categoryMap.set(categoryName, existingCategory.id);
      return existingCategory.id;
    }

    // Store the generated ID for new category
    this.categoryMap.set(categoryName, categoryId);
    return categoryId;
  }

  importFromCSV(csvText: string): number {
    const csvHabits = this.parseCSV(csvText);
    let imported = 0;

    // Reset maps for fresh import
    this.categoryMap.clear();
    this.subcategoryMap.clear();

    for (const csvHabit of csvHabits) {
      try {
        // Parse hierarchy: "Project/Category" is main category, "Task/Step" is subcategory/group
        const categoryParts = csvHabit.category.split(' / ');
        const mainCategory = categoryParts[0].trim(); // e.g., "Spiritual", "Exercise", "Meals"
        const subCategory = categoryParts.length > 1 ? categoryParts[1].trim() : undefined; // e.g., "Mind", "Push", "Breakfast"

        const categoryId = this.findOrCreateCategoryId(mainCategory);
        const subcategoryId = subCategory ? subCategory.toLowerCase().replace(/\s+/g, '-') : undefined;

        const habit: Partial<Habit> = {
          name: csvHabit.details || csvHabit.task, // Details is the actual habit name
          type: csvHabit.type.toLowerCase() === 'bad' ? 'bad' : 'good',
          difficulty: this.calculatePoints(csvHabit.rating) >= 15 ? 'hard' :
                      this.calculatePoints(csvHabit.rating) >= 10 ? 'medium' : 'easy',
          points: this.calculatePoints(csvHabit.rating),
          icon: this.mapCategoryToIcon(mainCategory),
          description: csvHabit.details, // Just the details field
          frequency: this.mapTimeFrameToFrequency(csvHabit.timeFrame),
          targetDays: this.mapTimeFrameToTargetDays(csvHabit.timeFrame),
          category: categoryId, // Use the found/created category ID
          subcategory: subcategoryId, // Use subcategory ID if available
          group: csvHabit.task, // Store the Task/Step as the group name for accordion display
          trackingType: mainCategory.toLowerCase().includes('exercise') ? 'sets' : 'simple',
          isActive: true
        };

        this.habitsService.addHabit(habit as any);
        imported++;
      } catch (error) {
        console.error('Error importing habit:', csvHabit, error);
      }
    }

    return imported;
  }

  async importFromFile(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const count = this.importFromCSV(text);
          resolve(count);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }
}
