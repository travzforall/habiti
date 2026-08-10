import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HabitsService } from '../../services/habits';
import { FriendsService } from '../../services/friends.service';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './bottom-nav.html',
  styleUrl: './bottom-nav.scss'
})
export class BottomNavComponent {
  private habitsService = inject(HabitsService);
  private friendsService = inject(FriendsService);
  private router = inject(Router);

  protected readonly habits = this.habitsService.habits;
  protected readonly gameState = this.habitsService.gameState;
  /** Surfaced on the More button, since Friends now lives inside it. */
  protected readonly incomingFriendRequests = this.friendsService.incomingCount;
  protected showQuickAdd = false;
  protected showMore = false;

  /** Everything the five slots cannot hold. Settings included — it has no other route below lg. */
  protected readonly moreItems = [
    { route: '/challenges', icon: '\u{1F3C6}', label: 'Challenges' },
    { route: '/skills', icon: '\u{1F9ED}', label: 'Skills' },
    { route: '/friends', icon: '\u{1F465}', label: 'Friends' },
    { route: '/analytics', icon: '\u{1F4C8}', label: 'Stats' },
    { route: '/calendar', icon: '\u{1F4C5}', label: 'Calendar' },
    { route: '/projects', icon: '\u{1F4CB}', label: 'Projects' },
    { route: '/templates', icon: '\u{1F4DD}', label: 'Templates' },
    { route: '/settings', icon: '\u{2699}\u{FE0F}', label: 'Settings' }
  ];

  protected toggleMore(): void {
    this.showMore = !this.showMore;
    // Two sheets open at once would overlap; the quick-add sits right beside it.
    this.showQuickAdd = false;
  }

  protected closeMore(): void {
    this.showMore = false;
  }

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
    this.showMore = false;
  }

  isActive(route: string): boolean {
    return this.router.url === route;
  }

  /** A tap anywhere outside the bar closes whichever sheet is open. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.showMore && !this.showQuickAdd) return;
    const target = event.target as HTMLElement;
    if (target.closest('app-bottom-nav')) return;
    this.showMore = false;
    this.showQuickAdd = false;
  }
}
