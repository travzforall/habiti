import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard';
import { HabitsComponent } from './pages/habits/habits';
import { HabitDetailComponent } from './pages/habit-detail/habit-detail';
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
import { OperatorGuard } from './guards/operator.guard';

// Security & Monitoring Feature Components
import { SecurityDashboardComponent } from './pages/security/security-dashboard';
import { CameraListComponent } from './pages/security/camera-list';
import { CameraDetailComponent } from './pages/security/camera-detail';
import { AddCameraComponent } from './pages/security/add-camera';
import { EventsTimelineComponent } from './pages/security/events-timeline';
import { PetsDashboardComponent } from './pages/pets/pets-dashboard';
import { EmergencyDashboardComponent } from './pages/emergency/emergency-dashboard';
import { MonitoringCenterComponent } from './pages/monitoring/monitoring-center';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard] },
  { path: 'habits', component: HabitsComponent, canActivate: [AuthGuard] },
  { path: 'habits/:id', component: HabitDetailComponent, canActivate: [AuthGuard] },
  { path: 'tasks', component: TasksComponent, canActivate: [AuthGuard] },
  { path: 'projects', component: ProjectsComponent, canActivate: [AuthGuard] },
  { path: 'calendar', component: CalendarComponent, canActivate: [AuthGuard] },
  { path: 'analytics', component: AnalyticsComponent, canActivate: [AuthGuard] },
  { path: 'templates', component: TemplatesComponent, canActivate: [AuthGuard] },
  { path: 'settings', component: SettingsComponent, canActivate: [AuthGuard] },
  { path: 'game', component: GameComponent, canActivate: [AuthGuard] },
  { path: 'test-db', component: TestDatabaseComponent, canActivate: [AuthGuard] },

  // Security & Camera Routes
  { path: 'security', component: SecurityDashboardComponent, canActivate: [AuthGuard] },
  { path: 'security/cameras', component: CameraListComponent, canActivate: [AuthGuard] },
  { path: 'security/cameras/add', component: AddCameraComponent, canActivate: [AuthGuard] },
  { path: 'security/cameras/:id', component: CameraDetailComponent, canActivate: [AuthGuard] },
  { path: 'security/events', component: EventsTimelineComponent, canActivate: [AuthGuard] },

  // Pet Management Routes
  { path: 'pets', component: PetsDashboardComponent, canActivate: [AuthGuard] },
  { path: 'pets/add', component: PetsDashboardComponent, canActivate: [AuthGuard] },
  { path: 'pets/training', component: PetsDashboardComponent, canActivate: [AuthGuard] },
  { path: 'pets/:id', component: PetsDashboardComponent, canActivate: [AuthGuard] },
  { path: 'pets/:id/training', component: PetsDashboardComponent, canActivate: [AuthGuard] },
  { path: 'pets/:id/health', component: PetsDashboardComponent, canActivate: [AuthGuard] },

  // Emergency Response Routes
  { path: 'emergency', component: EmergencyDashboardComponent, canActivate: [AuthGuard] },
  { path: 'emergency/contacts', component: EmergencyDashboardComponent, canActivate: [AuthGuard] },
  { path: 'emergency/contacts/add', component: EmergencyDashboardComponent, canActivate: [AuthGuard] },
  { path: 'emergency/devices', component: EmergencyDashboardComponent, canActivate: [AuthGuard] },
  { path: 'emergency/devices/add', component: EmergencyDashboardComponent, canActivate: [AuthGuard] },
  { path: 'emergency/history', component: EmergencyDashboardComponent, canActivate: [AuthGuard] },
  { path: 'emergency/settings', component: EmergencyDashboardComponent, canActivate: [AuthGuard] },

  // 24/7 Monitoring Center Routes (Operator Only)
  { path: 'monitoring', component: MonitoringCenterComponent, canActivate: [AuthGuard, OperatorGuard] },
  { path: 'monitoring/incidents', component: MonitoringCenterComponent, canActivate: [AuthGuard, OperatorGuard] },
  { path: 'monitoring/incidents/:id', component: MonitoringCenterComponent, canActivate: [AuthGuard, OperatorGuard] },
  { path: 'monitoring/subscribers', component: MonitoringCenterComponent, canActivate: [AuthGuard, OperatorGuard] },
  { path: 'monitoring/subscribers/:id', component: MonitoringCenterComponent, canActivate: [AuthGuard, OperatorGuard] },

  { path: '**', redirectTo: '/dashboard' }
];
