import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard';
import { LoginComponent } from './pages/login/login.component';
import { AuthGuard } from './guards/auth.guard';

// Dashboard and login are eager: they are the two entry points every session hits.
// Everything else is lazy so it lands in its own chunk instead of the initial bundle.
export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register.component').then(m => m.RegisterComponent)
  },
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard] },
  {
    path: 'habits',
    loadComponent: () => import('./pages/habits/habits').then(m => m.HabitsComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'habits/:id',
    loadComponent: () => import('./pages/habit-detail/habit-detail').then(m => m.HabitDetailComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'tasks',
    loadComponent: () => import('./pages/tasks/tasks').then(m => m.TasksComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'projects',
    loadComponent: () => import('./pages/projects/projects').then(m => m.ProjectsComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'calendar',
    loadComponent: () => import('./pages/calendar/calendar').then(m => m.CalendarComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'analytics',
    loadComponent: () => import('./pages/analytics/analytics').then(m => m.AnalyticsComponent),
    canActivate: [AuthGuard]
  },
  {
    // Unlisted internal tool — see the note in the component. AuthGuard means
    // "logged in", not "admin"; no admin role exists yet.
    path: 'admin/challenges',
    loadComponent: () =>
      import('./pages/admin-challenges/admin-challenges').then(m => m.AdminChallengesComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'friends',
    loadComponent: () => import('./pages/friends/friends').then(m => m.FriendsComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'challenges',
    loadComponent: () => import('./pages/challenges/challenges').then(m => m.ChallengesComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'skills',
    loadComponent: () => import('./pages/skills/skills').then(m => m.SkillsComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'templates',
    loadComponent: () => import('./pages/templates/templates').then(m => m.TemplatesComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings').then(m => m.SettingsComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'game',
    loadComponent: () => import('./game/game').then(m => m.GameComponent),
    canActivate: [AuthGuard]
  },
  { path: '**', redirectTo: '/dashboard' }
];
