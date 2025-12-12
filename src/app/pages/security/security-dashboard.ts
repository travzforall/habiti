import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AlertService, UnifiedAlert } from '../../services/alert.service';
import { CameraService } from '../../services/camera.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-security-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen bg-base-200 p-4 pb-24">
      <!-- Header -->
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-2xl font-bold">Security Dashboard</h1>
          <p class="text-base-content/60">Monitor your cameras and alerts</p>
        </div>
        <button routerLink="/security/cameras/add" class="btn btn-primary gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
          </svg>
          Add Camera
        </button>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="card bg-base-100 shadow">
          <div class="card-body p-4">
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-lg bg-success/20">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p class="text-2xl font-bold">{{ stats().onlineCameras }}</p>
                <p class="text-xs text-base-content/60">Online</p>
              </div>
            </div>
          </div>
        </div>

        <div class="card bg-base-100 shadow">
          <div class="card-body p-4">
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-lg bg-error/20">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <div>
                <p class="text-2xl font-bold">{{ stats().offlineCameras }}</p>
                <p class="text-xs text-base-content/60">Offline</p>
              </div>
            </div>
          </div>
        </div>

        <div class="card bg-base-100 shadow">
          <div class="card-body p-4">
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-lg bg-warning/20">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p class="text-2xl font-bold">{{ stats().todayEvents }}</p>
                <p class="text-xs text-base-content/60">Events Today</p>
              </div>
            </div>
          </div>
        </div>

        <div class="card bg-base-100 shadow">
          <div class="card-body p-4">
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-lg bg-info/20">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div>
                <p class="text-2xl font-bold">{{ stats().unacknowledgedEvents }}</p>
                <p class="text-xs text-base-content/60">Unread Alerts</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Active Alerts -->
      @if (cameraAlerts().length > 0) {
        <div class="card bg-base-100 shadow mb-6">
          <div class="card-body">
            <div class="flex justify-between items-center mb-4">
              <h2 class="card-title">Recent Alerts</h2>
              <button (click)="acknowledgeAllAlerts()" class="btn btn-ghost btn-sm">
                Mark All Read
              </button>
            </div>
            <div class="space-y-2">
              @for (alert of cameraAlerts().slice(0, 5); track alert.id) {
                <div class="flex items-center gap-3 p-3 rounded-lg hover:bg-base-200 transition-colors"
                     [class.bg-warning/10]="!alert.acknowledged">
                  <div class="w-2 h-2 rounded-full"
                       [class.bg-error]="alert.priority === 'critical'"
                       [class.bg-warning]="alert.priority === 'high'"
                       [class.bg-info]="alert.priority === 'medium'"
                       [class.bg-base-300]="alert.priority === 'low'">
                  </div>
                  <div class="flex-1">
                    <p class="font-medium">{{ alert.title }}</p>
                    <p class="text-sm text-base-content/60">{{ alert.message }}</p>
                  </div>
                  <span class="text-xs text-base-content/50">
                    {{ formatTime(alert.timestamp) }}
                  </span>
                  @if (!alert.acknowledged) {
                    <button (click)="acknowledgeAlert(alert.id)" class="btn btn-ghost btn-xs">
                      Dismiss
                    </button>
                  }
                </div>
              }
            </div>
            @if (cameraAlerts().length > 5) {
              <div class="mt-4">
                <a routerLink="/security/events" class="btn btn-ghost btn-sm w-full">
                  View All {{ cameraAlerts().length }} Alerts
                </a>
              </div>
            }
          </div>
        </div>
      }

      <!-- Camera Grid -->
      <div class="card bg-base-100 shadow">
        <div class="card-body">
          <div class="flex justify-between items-center mb-4">
            <h2 class="card-title">Cameras</h2>
            <a routerLink="/security/cameras" class="btn btn-ghost btn-sm">View All</a>
          </div>

          @if (cameras().length === 0) {
            <div class="text-center py-12">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto text-base-content/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <h3 class="font-semibold mb-2">No Cameras Added</h3>
              <p class="text-base-content/60 mb-4">Add your first camera to start monitoring</p>
              <button routerLink="/security/cameras/add" class="btn btn-primary">
                Add Camera
              </button>
            </div>
          } @else {
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              @for (camera of cameras(); track camera.id) {
                <a [routerLink]="['/security/cameras', camera.id]"
                   class="card bg-base-200 hover:bg-base-300 transition-colors cursor-pointer">
                  <figure class="relative">
                    <div class="w-full h-40 bg-base-300 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-base-content/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div class="absolute top-2 right-2">
                      <span class="badge"
                            [class.badge-success]="camera.status === 'online'"
                            [class.badge-error]="camera.status === 'offline'"
                            [class.badge-warning]="camera.status === 'error' || camera.status === 'connecting'">
                        {{ camera.status }}
                      </span>
                    </div>
                  </figure>
                  <div class="card-body p-3">
                    <h3 class="font-semibold">{{ camera.name }}</h3>
                    <p class="text-sm text-base-content/60">{{ camera.location }}</p>
                  </div>
                </a>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `
})
export class SecurityDashboardComponent implements OnInit, OnDestroy {
  private readonly alertService = inject(AlertService);
  private readonly cameraService = inject(CameraService);
  private readonly destroy$ = new Subject<void>();

  // Use live data from CameraService
  readonly cameras = this.cameraService.cameras;
  readonly stats = this.cameraService.stats;

  readonly cameraAlerts = computed(() =>
    this.alertService.getFilteredAlerts({ sources: ['camera'] })
  );

  ngOnInit(): void {
    // Subscribe to new alerts
    this.alertService.onNewAlert()
      .pipe(takeUntil(this.destroy$))
      .subscribe(alert => {
        if (alert.source === 'camera') {
          console.log('New camera alert:', alert);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  acknowledgeAlert(alertId: string): void {
    this.alertService.acknowledgeAlert(alertId);
  }

  acknowledgeAllAlerts(): void {
    this.alertService.acknowledgeAll({ sources: ['camera'] });
  }

  formatTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return new Date(date).toLocaleDateString();
  }
}
