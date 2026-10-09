import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard';
import { LoginComponent } from './pages/login/login.component';
import { AuthGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

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
      {
        path: ':docId/diff/:from/:to',
        loadComponent: () => import('./pages/legal/legal-diff.page').then(m => m.LegalDiffPage)
      },
      { path: '**', redirectTo: '' }
    ]
  },

  /**
   * How Habiti is built and secured. Public, and the page a security-minded
   * reader checks against reality — so it is written honestly or not at all.
   */
  {
    path: 'trust',
    loadComponent: () => import('./pages/legal/trust.page').then(m => m.TrustPage),
    data: { chrome: false }
  },

  /**
   * The re-acceptance gate. GUARDED — unlike everything else under /legal,
   * because it records an acceptance and needs to know who is accepting.
   *
   * Sits outside the /legal children so it does not inherit the public
   * treatment, and keeps `chrome: false` because it is a decision to make
   * without the rest of the app in the way.
   */
  {
    path: 'legal-accept',
    loadComponent: () => import('./pages/legal/legal-accept.page').then(m => m.LegalAcceptPage),
    canActivate: [AuthGuard],
    data: { chrome: false }
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
  /**
   * ORDER MATTERS HERE. 'tasks/new' must be declared before 'tasks/:id', or
   * the parameterised route matches first and the create page becomes a
   * detail page for a task whose id is the string "new".
   */
  {
    path: 'tasks/new',
    loadComponent: () => import('./pages/task-edit/task-edit').then(m => m.TaskEditComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'tasks/:id',
    loadComponent: () =>
      import('./pages/task-detail/task-detail').then(m => m.TaskDetailComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'tasks/:id/edit',
    loadComponent: () => import('./pages/task-edit/task-edit').then(m => m.TaskEditComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'projects',
    loadComponent: () => import('./pages/projects/projects').then(m => m.ProjectsComponent),
    canActivate: [AuthGuard]
  },
  {
    // Before 'projects/:id', for the same reason 'tasks/new' comes first.
    path: 'projects/new',
    loadComponent: () =>
      import('./pages/project-edit/project-edit').then(m => m.ProjectEditComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'projects/:id',
    loadComponent: () =>
      import('./pages/project-detail/project-detail').then(m => m.ProjectDetailComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'projects/:id/edit',
    loadComponent: () =>
      import('./pages/project-edit/project-edit').then(m => m.ProjectEditComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'maps',
    loadComponent: () => import('./pages/maps/maps').then(m => m.MapsComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'maps/:id',
    loadComponent: () => import('./pages/map-editor/map-editor').then(m => m.MapEditorComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'inspiration',
    loadComponent: () => import('./pages/inspiration/inspiration').then(m => m.InspirationComponent),
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
    path: 'supplies',
    loadComponent: () => import('./pages/supplies/supplies.page').then(m => m.SuppliesPage),
    canActivate: [AuthGuard]
  },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin').then(m => m.AdminComponent),
    canActivate: [AuthGuard, adminGuard]
  },
  {
    /**
     * Was AuthGuard only, which means "logged in" — so any signed-in user who
     * guessed the URL could edit the challenge catalogue everyone reads.
     * adminGuard checks `User.role`, which Xano has been returning all along.
     */
    path: 'admin/challenges',
    loadComponent: () =>
      import('./pages/admin-challenges/admin-challenges').then(m => m.AdminChallengesComponent),
    canActivate: [AuthGuard, adminGuard]
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
    path: 'toolkit',
    loadComponent: () => import('./pages/toolkit/toolkit').then(m => m.ToolkitComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings').then(m => m.SettingsComponent),
    canActivate: [AuthGuard]
  },
  { path: '**', redirectTo: '/dashboard' }
];
