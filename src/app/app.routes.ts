import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard';
import { HabitsComponent } from './pages/habits/habits';
import { TasksComponent } from './pages/tasks/tasks';
import { CalendarComponent } from './pages/calendar/calendar';
import { AnalyticsComponent } from './pages/analytics/analytics';
import { TemplatesComponent } from './pages/templates/templates';
import { SettingsComponent } from './pages/settings/settings';
import { ProjectsComponent } from './pages/projects/projects';
import { GameComponent } from './game/game';
import { TestDatabaseComponent } from './pages/test-database/test-database.component';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard] },
  { path: 'habits', component: HabitsComponent, canActivate: [AuthGuard] },
  { path: 'tasks', component: TasksComponent, canActivate: [AuthGuard] },
  { path: 'projects', component: ProjectsComponent, canActivate: [AuthGuard] },
  { path: 'calendar', component: CalendarComponent, canActivate: [AuthGuard] },
  { path: 'analytics', component: AnalyticsComponent, canActivate: [AuthGuard] },
  { path: 'templates', component: TemplatesComponent, canActivate: [AuthGuard] },
  { path: 'settings', component: SettingsComponent, canActivate: [AuthGuard] },
  { path: 'game', component: GameComponent, canActivate: [AuthGuard] },
  { path: 'test-db', component: TestDatabaseComponent, canActivate: [AuthGuard] },
  { path: '**', redirectTo: '/dashboard' }
];
