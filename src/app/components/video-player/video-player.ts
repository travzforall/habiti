import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  ViewChild,
  OnInit,
  OnDestroy,
  AfterViewInit,
  signal,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CameraStreamService, StreamInfo, StreamState } from '../../services/camera-stream.service';

@Component({
  selector: 'app-video-player',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="video-player relative bg-black rounded-lg overflow-hidden"
         [class.aspect-video]="!fullHeight"
         [class.h-full]="fullHeight"
         (mouseenter)="showControls.set(true)"
         (mouseleave)="showControls.set(false)">

      <!-- Video Element -->
      <video #videoElement
             class="w-full h-full object-contain"
             [poster]="poster"
             playsinline
             (click)="togglePlay()">
      </video>

      <!-- Loading Overlay -->
      @if (streamState() === 'loading') {
        <div class="absolute inset-0 flex items-center justify-center bg-black/50">
          <span class="loading loading-spinner loading-lg text-white"></span>
        </div>
      }

      <!-- Error Overlay -->
      @if (streamState() === 'error') {
        <div class="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white p-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-error mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p class="text-center">{{ errorMessage() || 'Failed to load stream' }}</p>
          <button (click)="retry()" class="btn btn-sm btn-outline btn-white mt-3">
            Retry
          </button>
        </div>
      }

      <!-- Offline/Idle Overlay -->
      @if (streamState() === 'idle' && !autoplay) {
        <div class="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white cursor-pointer"
             (click)="play()">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16" fill="white" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
          <p class="mt-2">Click to play</p>
        </div>
      }

      <!-- Controls Overlay -->
      @if (showControlsBar) {
        <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 transition-opacity duration-300"
             [class.opacity-0]="!showControls() && streamState() === 'playing'"
             [class.opacity-100]="showControls() || streamState() !== 'playing'">

          <!-- Progress Bar (for recorded content) -->
          @if (hasDuration()) {
            <div class="mb-2">
              <input type="range"
                     class="range range-xs range-primary w-full"
                     [min]="0"
                     [max]="duration()"
                     [value]="currentTime()"
                     (input)="seek($event)">
            </div>
          }

          <div class="flex items-center gap-2">
            <!-- Play/Pause -->
            <button (click)="togglePlay()" class="btn btn-ghost btn-sm btn-circle text-white">
              @if (streamState() === 'playing') {
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="white" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                </svg>
              } @else {
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="white" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              }
            </button>

            <!-- Volume -->
            <button (click)="toggleMute()" class="btn btn-ghost btn-sm btn-circle text-white">
              @if (isMuted()) {
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              } @else {
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              }
            </button>

            <!-- Time Display -->
            @if (hasDuration()) {
              <span class="text-white text-xs">
                {{ formatTime(currentTime()) }} / {{ formatTime(duration()) }}
              </span>
            } @else {
              <span class="text-white text-xs flex items-center gap-1">
                <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                LIVE
              </span>
            }

            <div class="flex-1"></div>

            <!-- Quality Badge -->
            @if (quality()) {
              <span class="badge badge-sm badge-ghost text-white">
                {{ quality()?.height }}p
              </span>
            }

            <!-- Snapshot -->
            <button (click)="takeSnapshot()" class="btn btn-ghost btn-sm btn-circle text-white" title="Take Snapshot">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            <!-- Fullscreen -->
            <button (click)="toggleFullscreen()" class="btn btn-ghost btn-sm btn-circle text-white" title="Fullscreen">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          </div>
        </div>
      }

      <!-- Status Badge -->
      @if (showStatusBadge) {
        <div class="absolute top-2 right-2">
          <span class="badge"
                [class.badge-success]="streamState() === 'playing'"
                [class.badge-warning]="streamState() === 'loading'"
                [class.badge-error]="streamState() === 'error'"
                [class.badge-ghost]="streamState() === 'idle'">
            {{ getStatusLabel() }}
          </span>
        </div>
      }

      <!-- Camera Name -->
      @if (cameraName && showCameraName) {
        <div class="absolute top-2 left-2">
          <span class="badge badge-neutral text-white">{{ cameraName }}</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .video-player {
      min-height: 200px;
    }

    .video-player:fullscreen {
      width: 100vw;
      height: 100vh;
    }

    .video-player:fullscreen video {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  `]
})
export class VideoPlayerComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly streamService = inject(CameraStreamService);

  @ViewChild('videoElement') videoElementRef!: ElementRef<HTMLVideoElement>;

  // Inputs
  @Input() cameraId!: string;
  @Input() streamUrl!: string;
  @Input() cameraName?: string;
  @Input() poster?: string;
  @Input() autoplay = true;
  @Input() muted = true;
  @Input() showControlsBar = true;
  @Input() showStatusBadge = false;
  @Input() showCameraName = true;
  @Input() fullHeight = false;

  // Outputs
  @Output() stateChange = new EventEmitter<StreamState>();
  @Output() snapshotTaken = new EventEmitter<string>();
  @Output() error = new EventEmitter<string>();

  // Local state
  readonly showControls = signal(false);
  readonly isMuted = signal(true);
  readonly currentTime = signal(0);
  readonly duration = signal(0);

  private streamId: string | null = null;

  // Computed from stream service
  readonly streamInfo = computed(() => {
    if (!this.streamId) return null;
    return this.streamService.getStream(this.streamId);
  });

  readonly streamState = computed(() => this.streamInfo()?.state || 'idle');
  readonly quality = computed(() => this.streamInfo()?.quality);
  readonly errorMessage = computed(() => this.streamInfo()?.error);
  readonly hasDuration = computed(() => this.duration() > 0 && this.duration() < Infinity);

  ngOnInit(): void {
    this.isMuted.set(this.muted);
  }

  ngAfterViewInit(): void {
    if (this.autoplay && this.streamUrl) {
      this.startStream();
    }
  }

  ngOnDestroy(): void {
    if (this.streamId) {
      this.streamService.stopStream(this.streamId);
    }
  }

  async startStream(): Promise<void> {
    if (!this.videoElementRef?.nativeElement || !this.streamUrl) return;

    try {
      const streamInfo = await this.streamService.startStream(
        this.cameraId,
        this.streamUrl,
        this.videoElementRef.nativeElement,
        {
          autoplay: this.autoplay,
          muted: this.muted,
        }
      );

      this.streamId = streamInfo.id;
      this.stateChange.emit(streamInfo.state);

      // Set up video element listeners
      const video = this.videoElementRef.nativeElement;
      video.onloadedmetadata = () => {
        this.duration.set(video.duration);
      };

      video.ontimeupdate = () => {
        this.currentTime.set(video.currentTime);
      };

      video.onvolumechange = () => {
        this.isMuted.set(video.muted);
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to start stream';
      this.error.emit(errorMsg);
    }
  }

  play(): void {
    if (!this.streamId) {
      this.startStream();
    } else {
      this.videoElementRef?.nativeElement?.play().catch(console.warn);
    }
  }

  pause(): void {
    this.videoElementRef?.nativeElement?.pause();
  }

  togglePlay(): void {
    if (!this.streamId) {
      this.startStream();
      return;
    }

    const video = this.videoElementRef?.nativeElement;
    if (video?.paused) {
      video.play().catch(console.warn);
    } else {
      video?.pause();
    }
  }

  toggleMute(): void {
    const video = this.videoElementRef?.nativeElement;
    if (video) {
      video.muted = !video.muted;
      this.isMuted.set(video.muted);
    }
  }

  setVolume(volume: number): void {
    const video = this.videoElementRef?.nativeElement;
    if (video) {
      video.volume = Math.max(0, Math.min(1, volume));
      if (volume > 0 && video.muted) {
        video.muted = false;
      }
    }
  }

  seek(event: Event): void {
    const input = event.target as HTMLInputElement;
    const video = this.videoElementRef?.nativeElement;
    if (video) {
      video.currentTime = parseFloat(input.value);
    }
  }

  takeSnapshot(): void {
    if (!this.streamId) return;

    const dataUrl = this.streamService.takeSnapshot(this.streamId);
    if (dataUrl) {
      this.snapshotTaken.emit(dataUrl);

      // Download the snapshot
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `snapshot_${this.cameraName || this.cameraId}_${Date.now()}.jpg`;
      link.click();
    }
  }

  async toggleFullscreen(): Promise<void> {
    const container = this.videoElementRef?.nativeElement?.parentElement;
    if (!container) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await container.requestFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen not supported:', err);
    }
  }

  retry(): void {
    if (this.streamId) {
      this.streamService.stopStream(this.streamId);
      this.streamId = null;
    }
    this.startStream();
  }

  getStatusLabel(): string {
    const state = this.streamState();
    switch (state) {
      case 'playing': return 'Live';
      case 'loading': return 'Loading...';
      case 'error': return 'Error';
      case 'paused': return 'Paused';
      case 'ended': return 'Ended';
      default: return 'Offline';
    }
  }

  formatTime(seconds: number): string {
    if (!isFinite(seconds)) return '--:--';

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
