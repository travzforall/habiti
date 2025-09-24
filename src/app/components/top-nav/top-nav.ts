import { Component, inject, OnInit, HostListener, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HabitsService } from '../../services/habits';
import { NightlyPlannerComponent } from '../nightly-planner/nightly-planner';

@Component({
  selector: 'app-top-nav',
  standalone: true,
  imports: [CommonModule, RouterModule, NightlyPlannerComponent],
  templateUrl: './top-nav.html',
  styleUrl: './top-nav.scss'
})
export class TopNavComponent implements OnInit {
  private habitsService = inject(HabitsService);
  
  @ViewChild(NightlyPlannerComponent) nightlyPlanner!: NightlyPlannerComponent;
  
  protected readonly gameState = this.habitsService.gameState;
  protected readonly habits = this.habitsService.habits;
  protected showThemeDropdown = false;
  protected showProfileDropdown = false;

  ngOnInit(): void {
    // Initialize theme on component load
    const savedTheme = localStorage.getItem('habiti-theme') || 'auto';
    this.applyTheme(savedTheme as 'light' | 'dark' | 'auto');
  }


  getOverallProgress(): number {
    return this.habitsService.getOverallProgress();
  }

  getLevelProgress(): number {
    const gameState = this.gameState();
    const currentLevelPoints = gameState.totalPoints % 100;
    return (currentLevelPoints / 100) * 100;
  }

  getPointsForNextLevel(): number {
    const gameState = this.gameState();
    return 100 - (gameState.totalPoints % 100);
  }

  toggleTheme(): void {
    const currentTheme = this.gameState().theme;
    const newTheme = currentTheme === 'dark' ? 'light' : currentTheme === 'light' ? 'auto' : 'dark';
    
    this.habitsService.gameState.update(state => ({
      ...state,
      theme: newTheme
    }));
    
    this.applyTheme(newTheme);
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

  exportData(): void {
    this.habitsService.exportData();
  }

  openNightlyPlanner(): void {
    this.nightlyPlanner?.openPlanner();
    this.closeDropdowns();
  }

  setTheme(theme: 'light' | 'dark' | 'auto'): void {
    localStorage.setItem('habiti-theme', theme);
    this.applyTheme(theme);
    
    this.habitsService.gameState.update(state => ({
      ...state,
      theme: theme
    }));
  }

  protected getUserInitial(): string {
    return 'U';
  }

  protected toggleThemeDropdown(): void {
    this.showThemeDropdown = !this.showThemeDropdown;
    this.showProfileDropdown = false;
  }

  protected toggleProfileDropdown(): void {
    this.showProfileDropdown = !this.showProfileDropdown;
    this.showThemeDropdown = false;
  }

  protected closeDropdowns(): void {
    this.showThemeDropdown = false;
    this.showProfileDropdown = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.relative')) {
      this.closeDropdowns();
    }
  }
}
