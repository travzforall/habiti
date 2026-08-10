import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard';
import { LoginComponent } from './pages/login/login.component';
import { AuthGuard } from './guards/auth.guard';
import { OperatorGuard } from './guards/operator.guard';

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
  {
    path: 'test-db',
    loadComponent: () =>
      import('./pages/test-database/test-database.component').then(m => m.TestDatabaseComponent),
    canActivate: [AuthGuard]
  },

  // Security & Camera Routes
  {
    path: 'security',
    loadComponent: () =>
      import('./pages/security/security-dashboard').then(m => m.SecurityDashboardComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'security/cameras',
    loadComponent: () => import('./pages/security/camera-list').then(m => m.CameraListComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'security/cameras/add',
    loadComponent: () => import('./pages/security/add-camera').then(m => m.AddCameraComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'security/cameras/:id',
    loadComponent: () => import('./pages/security/camera-detail').then(m => m.CameraDetailComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'security/events',
    loadComponent: () =>
      import('./pages/security/events-timeline').then(m => m.EventsTimelineComponent),
    canActivate: [AuthGuard]
  },

  // Pet Management Routes — every path renders the same dashboard component (unchanged behaviour)
  ...['pets', 'pets/add', 'pets/training', 'pets/:id', 'pets/:id/training', 'pets/:id/health'].map(
    path => ({
      path,
      loadComponent: () => import('./pages/pets/pets-dashboard').then(m => m.PetsDashboardComponent),
      canActivate: [AuthGuard]
    })
  ),

  // Emergency Response Routes
  ...[
    'emergency',
    'emergency/contacts',
    'emergency/contacts/add',
    'emergency/devices',
    'emergency/devices/add',
    'emergency/history',
    'emergency/settings'
  ].map(path => ({
    path,
    loadComponent: () =>
      import('./pages/emergency/emergency-dashboard').then(m => m.EmergencyDashboardComponent),
    canActivate: [AuthGuard]
  })),

  // 24/7 Monitoring Center Routes (Operator Only)
  ...[
    'monitoring',
    'monitoring/incidents',
    'monitoring/incidents/:id',
    'monitoring/subscribers',
    'monitoring/subscribers/:id'
  ].map(path => ({
    path,
    loadComponent: () =>
      import('./pages/monitoring/monitoring-center').then(m => m.MonitoringCenterComponent),
    canActivate: [AuthGuard, OperatorGuard]
  })),

  { path: '**', redirectTo: '/dashboard' }
];
