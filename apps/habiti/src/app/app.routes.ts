import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard';
import { LoginComponent } from './pages/login/login.component';
import { AuthGuard } from './guards/auth.guard';

// Dashboard and login are eager: they are the two entry points every session hits.
// Everything else is lazy so it lands in its own chunk instead of the initial bundle.
export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },

  // `chrome: false` drops the nav bars — see root.ts. Sign-in and sign-up were
  // rendering the full app shell, sidebar included, to signed-out visitors.
  { path: 'login', component: LoginComponent, data: { chrome: false } },
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/register/register.component').then(m => m.RegisterComponent),
    data: { chrome: false }
  },

  /**
   * The legal documents. PUBLIC, DELIBERATELY — no AuthGuard.
   *
   * A privacy policy nobody can read without an account is not a privacy
   * policy. These have to work for someone who is not a user at all: a person
   * whose email address was used in an invite, or a regulator following a link.
   *
   * Declared ABOVE the `**` wildcard, which redirects to /dashboard and would
   * otherwise swallow them. The scoped `legal/**` below catches typos within
   * this section without touching the global wildcard.
   *
   * Lazily loaded: LegalDocumentPage is the only thing that imports the prose,
   * and that is what keeps seven documents out of the initial bundle.
   */
  {
    path: 'legal',
    data: { chrome: false },
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/legal/legal-index.page').then(m => m.LegalIndexPage)
      },
      {
        path: ':docId',
        loadComponent: () =>
          import('./pages/legal/legal-document.page').then(m => m.LegalDocumentPage)
      },
      {
        path: ':docId/v/:version',
        loadComponent: () =>
          import('./pages/legal/legal-document.page').then(m => m.LegalDocumentPage)
      },
      { path: '**', redirectTo: '' }
    ]
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
  { path: '**', redirectTo: '/dashboard' }
];
