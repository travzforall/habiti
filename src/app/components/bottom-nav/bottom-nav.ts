import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HabitsService } from '../../services/habits';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './bottom-nav.html',
  styleUrl: './bottom-nav.scss'
})
export class BottomNavComponent {
  private habitsService = inject(HabitsService);
  private router = inject(Router);
  
  protected readonly habits = this.habitsService.habits;
  protected readonly gameState = this.habitsService.gameState;
  protected showQuickAdd = false;

  quickAddHabit(): void {
    // This will be handled by the habits page
    // For now, just navigate to habits page
  }

  quickMarkHabit(): void {
    // Quick mark first incomplete habit as complete
    const habits = this.habits();
    const firstIncomplete = habits.find(h => !this.habitsService.isHabitCompletedToday(h.id));
    if (firstIncomplete) {
      this.habitsService.toggleHabit(firstIncomplete.id);
    }
  }

  getOverallProgress(): number {
    return this.habitsService.getOverallProgress();
  }

  getStreakEncouragement(): string {
    const streak = this.gameState().dailyStreak;
    if (streak >= 30) return "Amazing! You're unstoppable!";
    if (streak >= 14) return "Fantastic! Keep it up!";
    if (streak >= 7) return "Great job! You're building momentum!";
    if (streak >= 3) return "Nice streak! Keep going!";
    return "Every day counts!";
  }

  getTodayProgress(): number {
    const habits = this.habits();
    if (habits.length === 0) return 0;
    
    const completedToday = habits.filter(h => 
      this.habitsService.isHabitCompletedToday(h.id)
    ).length;
    
    return Math.round((completedToday / habits.length) * 100);
  }

  getCompletedHabitsToday(): number {
    return this.habits().filter(h => 
      this.habitsService.isHabitCompletedToday(h.id)
    ).length;
  }

  exportData(): void {
    this.habitsService.exportData();
  }

  toggleQuickAdd(): void {
    this.showQuickAdd = !this.showQuickAdd;
  }

  isActive(route: string): boolean {
    return this.router.url === route;
  }
}
