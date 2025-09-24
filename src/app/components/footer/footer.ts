import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HabitsService } from '../../services/habits';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './footer.html',
  styleUrl: './footer.scss'
})
export class FooterComponent {
  private habitsService = inject(HabitsService);
  
  protected readonly habits = this.habitsService.habits;
  protected readonly gameState = this.habitsService.gameState;
  
  currentYear = new Date().getFullYear();
  
  private motivationalQuotes = [
    "Success is the sum of small efforts repeated day in and day out",
    "We are what we repeatedly do. Excellence, then, is not an act, but a habit",
    "The secret of getting ahead is getting started",
    "Small daily improvements over time lead to stunning results",
    "Your habits will determine your future",
    "Motivation gets you started, habit keeps you going",
    "The best time to plant a tree was 20 years ago. The second best time is now",
    "Progress, not perfection, is the goal",
    "Every master was once a disaster",
    "Rome wasn't built in a day, but they worked on it every single day"
  ];

  exportData(): void {
    this.habitsService.exportData();
  }

  setTheme(theme: 'light' | 'dark' | 'auto'): void {
    localStorage.setItem('habiti-theme', theme);
    this.applyTheme(theme);
  }

  private applyTheme(theme: 'light' | 'dark' | 'auto'): void {
    const htmlElement = document.documentElement;
    
    if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      htmlElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      htmlElement.setAttribute('data-theme', theme);
    }
  }

  getMotivationalQuote(): string {
    const today = new Date().toDateString();
    const hash = this.simpleHash(today);
    const index = hash % this.motivationalQuotes.length;
    return this.motivationalQuotes[index];
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}