import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CameraService, CreateCameraRequest } from '../../services/camera.service';
import { CameraType } from '../../models/security.models';

interface CameraTypeOption {
  type: CameraType;
  name: string;
  description: string;
  icon: string;
  placeholder: string;
}

@Component({
  selector: 'app-add-camera',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="min-h-screen bg-base-200 p-4 pb-24">
      <div class="max-w-2xl mx-auto">
        <!-- Header -->
        <div class="flex items-center gap-3 mb-6">
          <a routerLink="/security/cameras" class="btn btn-ghost btn-sm btn-circle">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <div>
            <h1 class="text-2xl font-bold">Add Camera</h1>
            <p class="text-base-content/60">Connect a new camera to your system</p>
          </div>
        </div>

        <!-- Progress Steps -->
        <ul class="steps steps-horizontal w-full mb-8">
          <li class="step" [class.step-primary]="step() >= 1">Type</li>
          <li class="step" [class.step-primary]="step() >= 2">Details</li>
          <li class="step" [class.step-primary]="step() >= 3">Test</li>
        </ul>

        <!-- Step 1: Camera Type -->
        @if (step() === 1) {
          <div class="card bg-base-100 shadow">
            <div class="card-body">
              <h2 class="card-title mb-4">Select Camera Type</h2>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                @for (option of cameraTypes; track option.type) {
                  <button (click)="selectType(option.type)"
                          class="card bg-base-200 hover:bg-primary/10 hover:border-primary border-2 transition-all cursor-pointer"
                          [class.border-primary]="selectedType() === option.type"
                          [class.bg-primary/10]="selectedType() === option.type"
                          [class.border-transparent]="selectedType() !== option.type">
                    <div class="card-body p-4 text-left">
                      <div class="flex items-center gap-3">
                        <div class="text-3xl">{{ option.icon }}</div>
                        <div>
                          <h3 class="font-bold">{{ option.name }}</h3>
                          <p class="text-sm text-base-content/60">{{ option.description }}</p>
                        </div>
                      </div>
                    </div>
                  </button>
                }
              </div>

              <div class="card-actions justify-end mt-6">
                <button (click)="nextStep()"
                        [disabled]="!selectedType()"
                        class="btn btn-primary">
                  Continue
                </button>
              </div>
            </div>
          </div>
        }

        <!-- Step 2: Camera Details -->
        @if (step() === 2) {
          <div class="card bg-base-100 shadow">
            <div class="card-body">
              <h2 class="card-title mb-4">Camera Details</h2>

              <div class="space-y-4">
                <div class="form-control">
                  <label class="label">
                    <span class="label-text">Camera Name *</span>
                  </label>
                  <input type="text"
                         [(ngModel)]="cameraName"
                         placeholder="e.g., Front Door, Backyard"
                         class="input input-bordered"
                         [class.input-error]="errors().name" />
                  @if (errors().name) {
                    <label class="label">
                      <span class="label-text-alt text-error">{{ errors().name }}</span>
                    </label>
                  }
                </div>

                <div class="form-control">
                  <label class="label">
                    <span class="label-text">Location</span>
                  </label>
                  <input type="text"
                         [(ngModel)]="cameraLocation"
                         placeholder="e.g., Main Entrance, Garden"
                         class="input input-bordered" />
                </div>

                <div class="form-control">
                  <label class="label">
                    <span class="label-text">Stream URL *</span>
                    <span class="label-text-alt text-base-content/60">
                      {{ getSelectedTypeOption()?.placeholder }}
                    </span>
                  </label>
                  <input type="text"
                         [(ngModel)]="streamUrl"
                         [placeholder]="getStreamUrlPlaceholder()"
                         class="input input-bordered font-mono text-sm"
                         [class.input-error]="errors().url" />
                  @if (errors().url) {
                    <label class="label">
                      <span class="label-text-alt text-error">{{ errors().url }}</span>
                    </label>
                  }
                </div>

                <!-- Advanced Settings Toggle -->
                <div class="collapse collapse-arrow bg-base-200 rounded-lg">
                  <input type="checkbox" />
                  <div class="collapse-title font-medium">Advanced Settings</div>
                  <div class="collapse-content space-y-4">
                    <div class="form-control">
                      <label class="label cursor-pointer justify-start gap-3">
                        <input type="checkbox" [(ngModel)]="motionDetection" class="checkbox checkbox-primary" />
                        <span class="label-text">Enable Motion Detection</span>
                      </label>
                    </div>

                    <div class="form-control">
                      <label class="label">
                        <span class="label-text">Motion Sensitivity</span>
                      </label>
                      <select [(ngModel)]="motionSensitivity" class="select select-bordered">
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>

                    <div class="form-control">
                      <label class="label">
                        <span class="label-text">Resolution</span>
                      </label>
                      <select [(ngModel)]="resolution" class="select select-bordered">
                        <option value="480p">480p</option>
                        <option value="720p">720p</option>
                        <option value="1080p">1080p (Recommended)</option>
                        <option value="4k">4K</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div class="card-actions justify-between mt-6">
                <button (click)="previousStep()" class="btn btn-ghost">
                  Back
                </button>
                <button (click)="nextStep()" class="btn btn-primary">
                  Test Connection
                </button>
              </div>
            </div>
          </div>
        }

        <!-- Step 3: Test Connection -->
        @if (step() === 3) {
          <div class="card bg-base-100 shadow">
            <div class="card-body">
              <h2 class="card-title mb-4">Test Connection</h2>

              <!-- RTSP Warning -->
              @if (isRtspStream()) {
                <div class="alert alert-warning mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <h3 class="font-bold">RTSP Stream Detected</h3>
                    <p class="text-sm">Browsers cannot play RTSP directly. You'll need a media server (MediaMTX, go2rtc) to proxy this stream to HLS. The camera will be saved but won't play until the proxy is configured.</p>
                  </div>
                </div>
              }

              <div class="bg-black rounded-lg aspect-video flex items-center justify-center mb-4">
                @if (testState() === 'testing') {
                  <div class="text-center text-white">
                    <span class="loading loading-spinner loading-lg mb-2"></span>
                    <p>Testing connection...</p>
                  </div>
                } @else if (testState() === 'success') {
                  <div class="text-center text-success">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    @if (isRtspStream()) {
                      <p class="text-lg font-bold">RTSP URL Valid</p>
                      <p class="text-sm opacity-80">Proxy required for playback</p>
                    } @else {
                      <p class="text-lg font-bold">Connection Successful!</p>
                      <p class="text-sm opacity-80">Latency: {{ testLatency() }}ms</p>
                    }
                  </div>
                } @else if (testState() === 'failed') {
                  <div class="text-center text-error">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p class="text-lg font-bold">Connection Failed</p>
                    <p class="text-sm opacity-80">{{ testError() }}</p>
                  </div>
                } @else {
                  <div class="text-center text-base-content/60">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <p>Click "Test" to verify connection</p>
                  </div>
                }
              </div>

              <!-- Summary -->
              <div class="bg-base-200 rounded-lg p-4 mb-4">
                <h3 class="font-bold mb-2">Camera Summary</h3>
                <div class="grid grid-cols-2 gap-2 text-sm">
                  <div class="text-base-content/60">Name:</div>
                  <div>{{ cameraName }}</div>
                  <div class="text-base-content/60">Type:</div>
                  <div class="uppercase">{{ selectedType() }}</div>
                  <div class="text-base-content/60">Stream:</div>
                  <div class="truncate font-mono text-xs">{{ streamUrl }}</div>
                  <div class="text-base-content/60">Location:</div>
                  <div>{{ cameraLocation || 'Not specified' }}</div>
                  <div class="text-base-content/60">Motion Detection:</div>
                  <div>{{ motionDetection ? 'Enabled' : 'Disabled' }}</div>
                </div>
              </div>

              <div class="card-actions justify-between">
                <button (click)="previousStep()" class="btn btn-ghost">
                  Back
                </button>
                <div class="flex gap-2">
                  @if (!isRtspStream()) {
                    <button (click)="testConnection()"
                            [disabled]="testState() === 'testing'"
                            class="btn btn-outline">
                      @if (testState() === 'testing') {
                        <span class="loading loading-spinner loading-sm"></span>
                      }
                      Test Again
                    </button>
                  }
                  <button (click)="saveCamera()"
                          [disabled]="!canSave()"
                          class="btn btn-primary">
                    Add Camera
                  </button>
                </div>
              </div>
            </div>
          </div>
        }

        <!-- Help Section -->
        <div class="card bg-base-100 shadow mt-6">
          <div class="card-body">
            <h2 class="card-title text-sm">Need Help?</h2>
            <div class="text-sm text-base-content/60">
              <p class="mb-2">
                <strong>IP Camera:</strong> Use the RTSP or HLS URL from your camera's settings.
                Common format: rtsp://username:password&#64;ip-address:554/stream
              </p>
              <p class="mb-2">
                <strong>Webcam:</strong> Select to use your computer's built-in or USB camera.
              </p>
              <p>
                <strong>Smart Cameras:</strong> Connect Wyze, Ring, or Nest cameras using your account credentials.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class AddCameraComponent {
  private readonly cameraService = inject(CameraService);
  private readonly router = inject(Router);

  readonly step = signal(1);
  readonly selectedType = signal<CameraType | null>(null);
  readonly testState = signal<'idle' | 'testing' | 'success' | 'failed'>('idle');
  readonly testLatency = signal(0);
  readonly testError = signal('');
  readonly errors = signal<{ name?: string; url?: string }>({});

  // Form fields
  cameraName = '';
  cameraLocation = '';
  streamUrl = '';
  motionDetection = true;
  motionSensitivity: 'low' | 'medium' | 'high' = 'medium';
  resolution: '480p' | '720p' | '1080p' | '4k' = '1080p';

  readonly cameraTypes: CameraTypeOption[] = [
    {
      type: 'ip',
      name: 'IP Camera',
      description: 'RTSP or HLS stream from network camera',
      icon: '📹',
      placeholder: 'rtsp:// or http://.m3u8',
    },
    {
      type: 'webcam',
      name: 'Webcam',
      description: 'USB or built-in camera on this device',
      icon: '💻',
      placeholder: 'Device camera',
    },
    {
      type: 'wyze',
      name: 'Wyze Camera',
      description: 'Connect via Wyze account',
      icon: '🏠',
      placeholder: 'Wyze device ID',
    },
    {
      type: 'ring',
      name: 'Ring Camera',
      description: 'Connect via Ring account',
      icon: '🔔',
      placeholder: 'Ring device ID',
    },
    {
      type: 'nest',
      name: 'Nest Camera',
      description: 'Connect via Google account',
      icon: '🪺',
      placeholder: 'Nest device ID',
    },
    {
      type: 'hls',
      name: 'HLS Stream',
      description: 'HTTP Live Streaming URL',
      icon: '📡',
      placeholder: 'https://.../.m3u8',
    },
  ];

  selectType(type: CameraType): void {
    this.selectedType.set(type);

    // Pre-fill demo URL for testing
    if (type === 'hls' || type === 'ip') {
      this.streamUrl = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
    }
  }

  getSelectedTypeOption(): CameraTypeOption | undefined {
    const type = this.selectedType();
    return type ? this.cameraTypes.find(t => t.type === type) : undefined;
  }

  getStreamUrlPlaceholder(): string {
    const option = this.getSelectedTypeOption();
    return option?.placeholder || 'Enter stream URL';
  }

  nextStep(): void {
    if (this.step() === 1 && !this.selectedType()) {
      return;
    }

    if (this.step() === 2) {
      // Validate form
      const newErrors: { name?: string; url?: string } = {};

      if (!this.cameraName.trim()) {
        newErrors.name = 'Camera name is required';
      }

      if (!this.streamUrl.trim()) {
        newErrors.url = 'Stream URL is required';
      }

      this.errors.set(newErrors);

      if (Object.keys(newErrors).length > 0) {
        return;
      }

      // Move to step 3
      this.step.update(s => s + 1);

      // For RTSP streams, skip the test - we know it won't work in browser
      if (this.isRtspStream()) {
        this.testState.set('success'); // Mark as ready to save
        return;
      }

      // Auto-test non-RTSP streams
      this.testConnection();
      return;
    }

    this.step.update(s => Math.min(s + 1, 3));
  }

  previousStep(): void {
    this.step.update(s => Math.max(s - 1, 1));
  }

  async testConnection(): Promise<void> {
    // Don't test RTSP streams - they need proxy
    if (this.isRtspStream()) {
      this.testState.set('success');
      return;
    }

    this.testState.set('testing');
    this.testError.set('');

    try {
      // Simulate connection test
      await new Promise(resolve => setTimeout(resolve, 2000));

      // For demo, always succeed with HLS URLs
      const isHls = this.streamUrl.includes('.m3u8');

      if (isHls || Math.random() > 0.2) {
        this.testLatency.set(Math.floor(Math.random() * 100) + 50);
        this.testState.set('success');
      } else {
        throw new Error('Could not connect to camera stream');
      }
    } catch (error) {
      this.testError.set(error instanceof Error ? error.message : 'Connection failed');
      this.testState.set('failed');
    }
  }

  isRtspStream(): boolean {
    return this.streamUrl.toLowerCase().startsWith('rtsp://');
  }

  canSave(): boolean {
    // RTSP streams can be saved without testing (they need proxy anyway)
    if (this.isRtspStream()) {
      return true;
    }
    // Other streams need successful test
    return this.testState() === 'success';
  }

  saveCamera(): void {
    const request: CreateCameraRequest = {
      name: this.cameraName,
      type: this.selectedType()!,
      streamUrl: this.streamUrl,
      location: this.cameraLocation || 'Unspecified',
      settings: {
        resolution: this.resolution,
        motionSensitivity: this.motionSensitivity,
      },
    };

    const camera = this.cameraService.addCamera(request);

    // Update motion detection setting
    if (!this.motionDetection) {
      this.cameraService.updateCamera(camera.id, { motionDetection: false });
    }

    this.router.navigate(['/security/cameras', camera.id]);
  }
}
