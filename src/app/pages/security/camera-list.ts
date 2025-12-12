import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CameraService } from '../../services/camera.service';
import { VideoPlayerComponent } from '../../components/video-player/video-player';
import { Camera } from '../../models/security.models';

@Component({
  selector: 'app-camera-list',
  standalone: true,
  imports: [CommonModule, RouterModule, VideoPlayerComponent],
  template: `
    <div class="min-h-screen bg-base-200 p-4 pb-24">
      <!-- Header -->
      <div class="flex justify-between items-center mb-6">
        <div class="flex items-center gap-2">
          <a routerLink="/security" class="btn btn-ghost btn-sm btn-circle">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <div>
            <h1 class="text-2xl font-bold">All Cameras</h1>
            <p class="text-base-content/60">{{ cameras().length }} cameras configured</p>
          </div>
        </div>
        <div class="flex gap-2">
          <button (click)="toggleViewMode()" class="btn btn-ghost btn-sm">
            @if (viewMode() === 'grid') {
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            } @else {
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
            }
          </button>
          <a routerLink="/security/cameras/add" class="btn btn-primary btn-sm gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
            </svg>
            Add Camera
          </a>
        </div>
      </div>

      <!-- Filter Tabs -->
      <div class="tabs tabs-boxed mb-6 bg-base-100 p-1">
        <button (click)="filterStatus.set('all')"
                class="tab"
                [class.tab-active]="filterStatus() === 'all'">
          All ({{ cameras().length }})
        </button>
        <button (click)="filterStatus.set('online')"
                class="tab"
                [class.tab-active]="filterStatus() === 'online'">
          Online ({{ onlineCount() }})
        </button>
        <button (click)="filterStatus.set('offline')"
                class="tab"
                [class.tab-active]="filterStatus() === 'offline'">
          Offline ({{ offlineCount() }})
        </button>
      </div>

      <!-- Camera Grid/List -->
      @if (filteredCameras().length === 0) {
        <div class="card bg-base-100 shadow">
          <div class="card-body text-center py-12">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto text-base-content/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            @if (filterStatus() === 'all') {
              <h3 class="font-semibold text-lg mb-2">No Cameras</h3>
              <p class="text-base-content/60 mb-4">Add your first camera to start monitoring</p>
              <a routerLink="/security/cameras/add" class="btn btn-primary">Add Camera</a>
            } @else {
              <h3 class="font-semibold text-lg mb-2">No {{ filterStatus() }} cameras</h3>
              <p class="text-base-content/60">
                @if (filterStatus() === 'online') {
                  All cameras are currently offline
                } @else {
                  All cameras are currently online
                }
              </p>
            }
          </div>
        </div>
      } @else {
        @if (viewMode() === 'grid') {
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            @for (camera of filteredCameras(); track camera.id) {
              <div class="card bg-base-100 shadow hover:shadow-lg transition-shadow">
                <figure class="relative">
                  <app-video-player
                    [cameraId]="camera.id"
                    [streamUrl]="camera.streamUrl"
                    [cameraName]="camera.name"
                    [autoplay]="false"
                    [showControlsBar]="false"
                    [showStatusBadge]="true"
                    [showCameraName]="false">
                  </app-video-player>
                </figure>
                <div class="card-body p-3">
                  <div class="flex justify-between items-start">
                    <div>
                      <h3 class="font-semibold">{{ camera.name }}</h3>
                      <p class="text-sm text-base-content/60">{{ camera.location }}</p>
                    </div>
                    <div class="dropdown dropdown-end">
                      <label tabindex="0" class="btn btn-ghost btn-xs btn-circle">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                      </label>
                      <ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-40">
                        <li><a [routerLink]="['/security/cameras', camera.id]">View Details</a></li>
                        <li><a (click)="toggleMotionDetection(camera)">
                          {{ camera.motionDetection ? 'Disable' : 'Enable' }} Motion
                        </a></li>
                        <li><a (click)="testConnection(camera)">Test Connection</a></li>
                        <li><a class="text-error" (click)="deleteCamera(camera)">Delete</a></li>
                      </ul>
                    </div>
                  </div>
                  <div class="flex gap-2 mt-2">
                    @if (camera.motionDetection) {
                      <span class="badge badge-sm badge-primary">Motion</span>
                    }
                    @if (camera.recordingEnabled) {
                      <span class="badge badge-sm badge-error">REC</span>
                    }
                  </div>
                </div>
                <div class="card-actions p-3 pt-0">
                  <a [routerLink]="['/security/cameras', camera.id]" class="btn btn-sm btn-block btn-ghost">
                    Open Camera
                  </a>
                </div>
              </div>
            }
          </div>
        } @else {
          <!-- List View -->
          <div class="card bg-base-100 shadow">
            <div class="overflow-x-auto">
              <table class="table">
                <thead>
                  <tr>
                    <th>Camera</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Features</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (camera of filteredCameras(); track camera.id) {
                    <tr class="hover">
                      <td>
                        <div class="flex items-center gap-3">
                          <div class="w-16 h-10 bg-base-300 rounded overflow-hidden">
                            <app-video-player
                              [cameraId]="camera.id"
                              [streamUrl]="camera.streamUrl"
                              [autoplay]="false"
                              [showControlsBar]="false"
                              [showCameraName]="false"
                              [fullHeight]="true">
                            </app-video-player>
                          </div>
                          <div>
                            <p class="font-medium">{{ camera.name }}</p>
                            <p class="text-xs text-base-content/60">{{ camera.type | uppercase }}</p>
                          </div>
                        </div>
                      </td>
                      <td>{{ camera.location }}</td>
                      <td>
                        <span class="badge"
                              [class.badge-success]="camera.status === 'online'"
                              [class.badge-error]="camera.status === 'offline'"
                              [class.badge-warning]="camera.status === 'connecting' || camera.status === 'error'">
                          {{ camera.status }}
                        </span>
                      </td>
                      <td>
                        <div class="flex gap-1">
                          @if (camera.motionDetection) {
                            <span class="badge badge-sm badge-ghost">Motion</span>
                          }
                          @if (camera.recordingEnabled) {
                            <span class="badge badge-sm badge-ghost">Recording</span>
                          }
                        </div>
                      </td>
                      <td>
                        <div class="flex gap-1">
                          <a [routerLink]="['/security/cameras', camera.id]" class="btn btn-ghost btn-xs">View</a>
                          <button (click)="testConnection(camera)" class="btn btn-ghost btn-xs">Test</button>
                          <button (click)="deleteCamera(camera)" class="btn btn-ghost btn-xs text-error">Delete</button>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      }

      <!-- Demo Button (for testing) -->
      @if (cameras().length === 0) {
        <div class="fixed bottom-24 right-4">
          <button (click)="loadSampleCameras()" class="btn btn-secondary shadow-lg">
            Load Demo Cameras
          </button>
        </div>
      }
    </div>
  `
})
export class CameraListComponent implements OnInit {
  private readonly cameraService = inject(CameraService);

  readonly cameras = this.cameraService.cameras;
  readonly viewMode = signal<'grid' | 'list'>('grid');
  readonly filterStatus = signal<'all' | 'online' | 'offline'>('all');

  readonly onlineCount = computed(() =>
    this.cameras().filter(c => c.status === 'online').length
  );

  readonly offlineCount = computed(() =>
    this.cameras().filter(c => c.status === 'offline' || c.status === 'error').length
  );

  readonly filteredCameras = computed(() => {
    const status = this.filterStatus();
    if (status === 'all') return this.cameras();
    if (status === 'online') return this.cameras().filter(c => c.status === 'online');
    return this.cameras().filter(c => c.status === 'offline' || c.status === 'error');
  });

  ngOnInit(): void {}

  toggleViewMode(): void {
    this.viewMode.update(mode => mode === 'grid' ? 'list' : 'grid');
  }

  toggleMotionDetection(camera: Camera): void {
    this.cameraService.toggleMotionDetection(camera.id);
  }

  async testConnection(camera: Camera): Promise<void> {
    const result = await this.cameraService.testCameraConnection(camera.id);
    if (result.success) {
      console.log('Connection successful, latency:', result.latency);
    } else {
      console.error('Connection failed:', result.error);
    }
  }

  deleteCamera(camera: Camera): void {
    if (confirm(`Are you sure you want to delete "${camera.name}"?`)) {
      this.cameraService.deleteCamera(camera.id);
    }
  }

  loadSampleCameras(): void {
    this.cameraService.generateSampleCameras();
  }
}
