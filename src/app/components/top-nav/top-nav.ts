import { Component, inject, HostListener, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { HabitsService } from '../../services/habits';
import { AuthService } from '../../services/auth.service';
import { ThemeChoice, ThemeService } from '../../services/theme.service';
import { NightlyPlannerComponent } from '../nightly-planner/nightly-planner';
import { StatusAvatarComponent } from '../status-avatar/status-avatar.component';
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';
import { LiveIndicatorComponent } from '../live-indicator/live-indicator.component';

@Component({
  selector: 'app-top-nav',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    NightlyPlannerComponent,
    StatusAvatarComponent,
    NotificationBellComponent,
    LiveIndicatorComponent
  ],
  templateUrl: './top-nav.html',
  styleUrl: './top-nav.scss'
})
export class TopNavComponent {
  private habitsService = inject(HabitsService);
  private authService = inject(AuthService);
  private themeService = inject(ThemeService);

  @ViewChild(NightlyPlannerComponent) nightlyPlanner!: NightlyPlannerComponent;

  protected readonly gameState = this.habitsService.gameState;
  /** AuthService exposes a BehaviorSubject, so bridge it to a signal for the template. */
  protected readonly currentUser = toSignal(this.authService.currentUser, { initialValue: null });
  protected showThemeDropdown = false;
  protected showProfileDropdown = false;

  getOverallProgress(): number {
    return this.habitsService.getOverallProgress();
  }

  // getLevelProgress() / getPointsForNextLevel() removed: they hardcoded a
  // third copy of the old points-per-level math, which no longer determines
  // level at all. The LVL badge renders gameState().level directly.

  // applyTheme() and toggleTheme() removed. The first was a duplicate of
  // root.ts's copy; the second was unreachable (nothing in the template called
  // it) and wrote GameState.theme without touching localStorage, so the choice
  // never survived a reload. ThemeService owns all of this now, and the shell
  // applies the stored theme at boot.

  exportData(): void {
    this.habitsService.exportData();
  }

  openNightlyPlanner(): void {
    this.nightlyPlanner?.openPlanner();
    this.closeDropdowns();
  }

  setTheme(theme: ThemeChoice): void {
    this.themeService.set(theme);
  }

  protected getUserInitial(): string {
    return (this.currentUser()?.name || '').charAt(0).toUpperCase() || 'U';
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

  /**
   * AuthService clears local state and routes to /login. SyncService is watching
   * currentUser, so it resets the data services and drops the relay connection
   * on its own — nothing to coordinate here.
   */
  protected logout(): void {
    this.closeDropdowns();
    this.authService.logout();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.relative')) {
      this.closeDropdowns();
    }
  }
}
