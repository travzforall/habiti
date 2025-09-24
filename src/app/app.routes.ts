import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard';
import { HabitsComponent } from './pages/habits/habits';
import { CalendarComponent } from './pages/calendar/calendar';
import { AnalyticsComponent } from './pages/analytics/analytics';
import { TemplatesComponent } from './pages/templates/templates';
import { SettingsComponent } from './pages/settings/settings';
import { GameComponent } from './game/game';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'habits', component: HabitsComponent },
  { path: 'calendar', component: CalendarComponent },
  { path: 'analytics', component: AnalyticsComponent },
  { path: 'templates', component: TemplatesComponent },
  { path: 'settings', component: SettingsComponent },
  { path: 'game', component: GameComponent },
  { path: '**', redirectTo: '/dashboard' }
];
