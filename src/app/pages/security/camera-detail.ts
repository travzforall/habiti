import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CameraService } from '../../services/camera.service';
import { VideoPlayerComponent } from '../../components/video-player/video-player';
import { Camera, CameraEvent } from '../../models/security.models';

@Component({
  selector: 'app-camera-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, VideoPlayerComponent],
  template: `
    <div class="min-h-screen bg-base-200 pb-24">
      @if (camera()) {
        <!-- RTSP Proxy Warning -->
        @if (isRtspCamera()) {
          <div class="alert alert-warning mx-4 mt-4 mb-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 class="font-bold">RTSP Stream Requires Proxy</h3>
              <p class="text-sm">Browsers cannot play RTSP directly. Set up a media server (MediaMTX, go2rtc, or FFmpeg) to transcode to HLS.</p>
            </div>
            <a href="https://github.com/bluenviron/mediamtx" target="_blank" class="btn btn-sm">Setup Guide</a>
          </div>
        }

        <!-- Video Section -->
        <div class="bg-black">
          <div class="max-w-6xl mx-auto">
            <app-video-player
              [cameraId]="camera()!.id"
              [streamUrl]="playbackUrl()"
              [cameraName]="camera()!.name"
              [autoplay]="true"
              [showStatusBadge]="false"
              [showCameraName]="true"
              (snapshotTaken)="onSnapshotTaken($event)"
              (error)="onStreamError($event)">
            </app-video-player>
          </div>
        </div>

        <div class="p-4 max-w-6xl mx-auto">
          <!-- Header -->
          <div class="flex justify-between items-start mb-6">
            <div class="flex items-center gap-3">
              <a routerLink="/security/cameras" class="btn btn-ghost btn-sm btn-circle">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                </svg>
              </a>
              <div>
                <h1 class="text-2xl font-bold">{{ camera()!.name }}</h1>
                <p class="text-base-content/60">{{ camera()!.location }}</p>
              </div>
            </div>
            <div class="flex gap-2">
              <span class="badge badge-lg"
                    [class.badge-success]="camera()!.status === 'online'"
                    [class.badge-error]="camera()!.status === 'offline'"
                    [class.badge-warning]="camera()!.status === 'connecting'">
                {{ camera()!.status | uppercase }}
              </span>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Main Content -->
            <div class="lg:col-span-2 space-y-6">
              <!-- Quick Actions -->
              <div class="card bg-base-100 shadow">
                <div class="card-body">
                  <h2 class="card-title">Quick Actions</h2>
                  <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <button (click)="toggleMotionDetection()"
                            class="btn btn-outline flex-col h-auto py-3"
                            [class.btn-primary]="camera()!.motionDetection">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span class="text-xs">Motion {{ camera()!.motionDetection ? 'On' : 'Off' }}</span>
                    </button>

                    <button (click)="toggleRecording()"
                            class="btn btn-outline flex-col h-auto py-3"
                            [class.btn-error]="camera()!.recordingEnabled">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span class="text-xs">{{ camera()!.recordingEnabled ? 'Recording' : 'Record' }}</span>
                    </button>

                    <button (click)="testConnection()" class="btn btn-outline flex-col h-auto py-3">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                      </svg>
                      <span class="text-xs">Test</span>
                    </button>

                    <button (click)="openSettings()" class="btn btn-outline flex-col h-auto py-3">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span class="text-xs">Settings</span>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Recent Events -->
              <div class="card bg-base-100 shadow">
                <div class="card-body">
                  <div class="flex justify-between items-center mb-4">
                    <h2 class="card-title">Recent Events</h2>
                    @if (events().length > 0) {
                      <button (click)="acknowledgeAllEvents()" class="btn btn-ghost btn-sm">
                        Mark All Read
                      </button>
                    }
                  </div>

                  @if (events().length === 0) {
                    <div class="text-center py-8 text-base-content/60">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      <p>No events recorded</p>
                    </div>
                  } @else {
                    <div class="space-y-2">
                      @for (event of events().slice(0, 10); track event.id) {
                        <div class="flex items-center gap-3 p-3 rounded-lg bg-base-200 hover:bg-base-300 transition-colors"
                             [class.opacity-60]="event.acknowledged">
                          <div class="w-10 h-10 rounded-lg bg-base-300 flex items-center justify-center">
                            @switch (event.type) {
                              @case ('person') {
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              }
                              @case ('vehicle') {
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                                </svg>
                              }
                              @case ('pet') {
                                <span class="text-lg">🐾</span>
                              }
                              @default {
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-base-content/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                              }
                            }
                          </div>
                          <div class="flex-1">
                            <p class="font-medium capitalize">{{ event.type }} Detected</p>
                            <p class="text-sm text-base-content/60">{{ formatEventTime(event.timestamp) }}</p>
                          </div>
                          @if (!event.acknowledged) {
                            <button (click)="acknowledgeEvent(event.id)" class="btn btn-ghost btn-xs">
                              Dismiss
                            </button>
                          }
                        </div>
                      }
                    </div>
                    @if (events().length > 10) {
                      <div class="mt-4 text-center">
                        <a routerLink="/security/events" [queryParams]="{camera: camera()!.id}" class="btn btn-ghost btn-sm">
                          View All {{ events().length }} Events
                        </a>
                      </div>
                    }
                  }
                </div>
              </div>
            </div>

            <!-- Sidebar -->
            <div class="space-y-6">
              <!-- Camera Info -->
              <div class="card bg-base-100 shadow">
                <div class="card-body">
                  <h2 class="card-title">Camera Info</h2>
                  <div class="space-y-3">
                    <div class="flex justify-between">
                      <span class="text-base-content/60">Type</span>
                      <span class="font-medium uppercase">{{ camera()!.type }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-base-content/60">Resolution</span>
                      <span class="font-medium">{{ camera()!.settings.resolution }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-base-content/60">Frame Rate</span>
                      <span class="font-medium">{{ camera()!.settings.frameRate }} fps</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-base-content/60">Night Vision</span>
                      <span class="font-medium">{{ camera()!.settings.nightVision ? 'Enabled' : 'Disabled' }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-base-content/60">Audio</span>
                      <span class="font-medium">{{ camera()!.settings.audioEnabled ? 'Enabled' : 'Disabled' }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-base-content/60">Motion Sensitivity</span>
                      <span class="font-medium capitalize">{{ camera()!.settings.motionSensitivity }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Snapshots -->
              @if (snapshots().length > 0) {
                <div class="card bg-base-100 shadow">
                  <div class="card-body">
                    <h2 class="card-title">Recent Snapshots</h2>
                    <div class="grid grid-cols-2 gap-2">
                      @for (snapshot of snapshots().slice(0, 4); track $index) {
                        <img [src]="snapshot" alt="Snapshot" class="rounded-lg w-full aspect-video object-cover cursor-pointer hover:opacity-80"
                             (click)="viewSnapshot(snapshot)">
                      }
                    </div>
                  </div>
                </div>
              }

              <!-- Danger Zone -->
              <div class="card bg-base-100 shadow border-error/20 border">
                <div class="card-body">
                  <h2 class="card-title text-error">Danger Zone</h2>
                  <p class="text-sm text-base-content/60 mb-4">
                    Permanently delete this camera and all its events.
                  </p>
                  <button (click)="deleteCamera()" class="btn btn-error btn-outline btn-block">
                    Delete Camera
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      } @else {
        <!-- Loading or Not Found -->
        <div class="flex items-center justify-center min-h-[50vh]">
          @if (isLoading()) {
            <span class="loading loading-spinner loading-lg"></span>
          } @else {
            <div class="text-center">
              <h2 class="text-xl font-bold mb-2">Camera Not Found</h2>
              <p class="text-base-content/60 mb-4">The camera you're looking for doesn't exist.</p>
              <a routerLink="/security/cameras" class="btn btn-primary">Back to Cameras</a>
            </div>
          }
        </div>
      }

      <!-- Settings Modal -->
      @if (showSettingsModal()) {
        <div class="modal modal-open">
          <div class="modal-box">
            <h3 class="font-bold text-lg mb-4">Camera Settings</h3>

            <div class="space-y-4">
              <div class="form-control">
                <label class="label"><span class="label-text">Camera Name</span></label>
                <input type="text" [(ngModel)]="editName" class="input input-bordered" />
              </div>

              <div class="form-control">
                <label class="label"><span class="label-text">Location</span></label>
                <input type="text" [(ngModel)]="editLocation" class="input input-bordered" />
              </div>

              <div class="form-control">
                <label class="label"><span class="label-text">Stream URL</span></label>
                <input type="text" [(ngModel)]="editStreamUrl" class="input input-bordered" />
              </div>

              <div class="form-control">
                <label class="label"><span class="label-text">Motion Sensitivity</span></label>
                <select [(ngModel)]="editMotionSensitivity" class="select select-bordered">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div class="modal-action">
              <button (click)="closeSettings()" class="btn btn-ghost">Cancel</button>
              <button (click)="saveSettings()" class="btn btn-primary">Save Changes</button>
            </div>
          </div>
          <div class="modal-backdrop" (click)="closeSettings()"></div>
        </div>
      }
    </div>
  `
})
export class CameraDetailComponent implements OnInit {
  private readonly cameraService = inject(CameraService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly camera = signal<Camera | null>(null);
  readonly events = signal<CameraEvent[]>([]);
  readonly snapshots = signal<string[]>([]);
  readonly isLoading = signal(true);
  readonly showSettingsModal = signal(false);

  // Computed playback URL - uses proxy for RTSP streams
  readonly playbackUrl = computed(() => {
    const cam = this.camera();
    if (!cam) return '';
    // Use the service to get the correct playback URL (proxied for RTSP)
    return this.cameraService.getStreamUrl(cam.id) || cam.streamUrl;
  });

  // Edit form
  editName = '';
  editLocation = '';
  editStreamUrl = '';
  editMotionSensitivity: 'low' | 'medium' | 'high' = 'medium';

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const cameraId = params['id'];
      if (cameraId) {
        this.loadCamera(cameraId);
      }
    });
  }

  loadCamera(id: string): void {
    this.isLoading.set(true);
    const camera = this.cameraService.getCamera(id);

    if (camera) {
      this.camera.set(camera);
      this.events.set(this.cameraService.getCameraEvents(id));
      this.initEditForm(camera);
    }

    this.isLoading.set(false);
  }

  initEditForm(camera: Camera): void {
    this.editName = camera.name;
    this.editLocation = camera.location;
    this.editStreamUrl = camera.streamUrl;
    this.editMotionSensitivity = camera.settings.motionSensitivity;
  }

  toggleMotionDetection(): void {
    const cam = this.camera();
    if (cam) {
      this.cameraService.toggleMotionDetection(cam.id);
      this.camera.set(this.cameraService.getCamera(cam.id) || null);
    }
  }

  toggleRecording(): void {
    const cam = this.camera();
    if (cam) {
      this.cameraService.toggleRecording(cam.id);
      this.camera.set(this.cameraService.getCamera(cam.id) || null);
    }
  }

  async testConnection(): Promise<void> {
    const cam = this.camera();
    if (cam) {
      const result = await this.cameraService.testCameraConnection(cam.id);
      this.camera.set(this.cameraService.getCamera(cam.id) || null);

      if (result.success) {
        alert(`Connection successful! Latency: ${result.latency}ms`);
      } else {
        alert(`Connection failed: ${result.error}`);
      }
    }
  }

  openSettings(): void {
    const cam = this.camera();
    if (cam) {
      this.initEditForm(cam);
      this.showSettingsModal.set(true);
    }
  }

  closeSettings(): void {
    this.showSettingsModal.set(false);
  }

  saveSettings(): void {
    const cam = this.camera();
    if (cam) {
      this.cameraService.updateCamera(cam.id, {
        name: this.editName,
        location: this.editLocation,
        streamUrl: this.editStreamUrl,
        settings: {
          motionSensitivity: this.editMotionSensitivity,
        },
      });
      this.camera.set(this.cameraService.getCamera(cam.id) || null);
      this.closeSettings();
    }
  }

  acknowledgeEvent(eventId: string): void {
    this.cameraService.acknowledgeEvent(eventId);
    const cam = this.camera();
    if (cam) {
      this.events.set(this.cameraService.getCameraEvents(cam.id));
    }
  }

  acknowledgeAllEvents(): void {
    const cam = this.camera();
    if (cam) {
      this.cameraService.acknowledgeAllEvents(cam.id);
      this.events.set(this.cameraService.getCameraEvents(cam.id));
    }
  }

  onSnapshotTaken(dataUrl: string): void {
    this.snapshots.update(s => [dataUrl, ...s].slice(0, 10));
  }

  onStreamError(error: string): void {
    console.error('Stream error:', error);
  }

  viewSnapshot(dataUrl: string): void {
    window.open(dataUrl, '_blank');
  }

  deleteCamera(): void {
    const cam = this.camera();
    if (cam && confirm(`Are you sure you want to delete "${cam.name}"? This cannot be undone.`)) {
      this.cameraService.deleteCamera(cam.id);
      this.router.navigate(['/security/cameras']);
    }
  }

  formatEventTime(date: Date): string {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hours ago`;

    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  isRtspCamera(): boolean {
    const cam = this.camera();
    return cam ? this.cameraService.needsRtspProxy(cam.id) : false;
  }
}
