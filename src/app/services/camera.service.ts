import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  Camera,
  CameraType,
  CameraStatus,
  CameraSettings,
  CameraEvent,
  CameraEventType,
  CameraRecording,
  CameraZone,
  SecurityDashboardStats,
  CameraConnectionTest,
} from '../models/security.models';
import { WebSocketService } from './websocket.service';
import { AlertService } from './alert.service';
import { CameraStreamService } from './camera-stream.service';

export interface CreateCameraRequest {
  name: string;
  type: CameraType;
  streamUrl: string;
  location: string;
  settings?: Partial<CameraSettings>;
}

export interface UpdateCameraRequest {
  name?: string;
  streamUrl?: string;
  location?: string;
  motionDetection?: boolean;
  recordingEnabled?: boolean;
  settings?: Partial<CameraSettings>;
}

@Injectable({
  providedIn: 'root'
})
export class CameraService {
  private readonly http = inject(HttpClient);
  private readonly wsService = inject(WebSocketService);
  private readonly alertService = inject(AlertService);
  private readonly streamService = inject(CameraStreamService);

  // Reactive state
  private readonly _cameras = signal<Camera[]>([]);
  private readonly _events = signal<CameraEvent[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _selectedCameraId = signal<string | null>(null);

  // Public computed signals
  readonly cameras = this._cameras.asReadonly();
  readonly events = this._events.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly selectedCameraId = this._selectedCameraId.asReadonly();

  readonly selectedCamera = computed(() => {
    const id = this._selectedCameraId();
    return id ? this._cameras().find(c => c.id === id) || null : null;
  });

  readonly onlineCameras = computed(() =>
    this._cameras().filter(c => c.status === 'online')
  );

  readonly offlineCameras = computed(() =>
    this._cameras().filter(c => c.status === 'offline' || c.status === 'error')
  );

  readonly stats = computed((): SecurityDashboardStats => {
    const cameras = this._cameras();
    const events = this._events();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return {
      totalCameras: cameras.length,
      onlineCameras: cameras.filter(c => c.status === 'online').length,
      offlineCameras: cameras.filter(c => c.status === 'offline').length,
      todayEvents: events.filter(e => new Date(e.timestamp) >= today).length,
      unacknowledgedEvents: events.filter(e => !e.acknowledged).length,
      storageUsed: 0, // TODO: Implement storage tracking
      storageLimit: 10 * 1024 * 1024 * 1024, // 10GB default
    };
  });

  readonly unacknowledgedEvents = computed(() =>
    this._events().filter(e => !e.acknowledged)
  );

  // LocalStorage key for persistence
  private readonly STORAGE_KEY = 'habiti_cameras';
  private readonly EVENTS_KEY = 'habiti_camera_events';

  constructor() {
    this.loadFromStorage();
    this.subscribeToWebSocketEvents();
  }

  /**
   * Load cameras from local storage
   */
  private loadFromStorage(): void {
    try {
      const camerasJson = localStorage.getItem(this.STORAGE_KEY);
      if (camerasJson) {
        const cameras = JSON.parse(camerasJson) as Camera[];
        this._cameras.set(cameras.map(c => ({
          ...c,
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt),
        })));
      }

      const eventsJson = localStorage.getItem(this.EVENTS_KEY);
      if (eventsJson) {
        const events = JSON.parse(eventsJson) as CameraEvent[];
        this._events.set(events.map(e => ({
          ...e,
          timestamp: new Date(e.timestamp),
          acknowledgedAt: e.acknowledgedAt ? new Date(e.acknowledgedAt) : undefined,
        })));
      }
    } catch (error) {
      console.error('Failed to load cameras from storage:', error);
    }
  }

  /**
   * Save cameras to local storage
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this._cameras()));
      localStorage.setItem(this.EVENTS_KEY, JSON.stringify(this._events()));
    } catch (error) {
      console.error('Failed to save cameras to storage:', error);
    }
  }

  /**
   * Subscribe to WebSocket camera events
   */
  private subscribeToWebSocketEvents(): void {
    this.wsService.onMessage<{ cameraId: string; status: CameraStatus }>('camera_status')
      .subscribe(msg => {
        this.updateCameraStatus(msg.payload.cameraId, msg.payload.status);
      });

    this.wsService.onMessage<CameraEvent>('camera_event')
      .subscribe(msg => {
        this.addEvent(msg.payload);
      });
  }

  /**
   * Get all cameras
   */
  getCameras(): Camera[] {
    return this._cameras();
  }

  /**
   * Get camera by ID
   */
  getCamera(id: string): Camera | undefined {
    return this._cameras().find(c => c.id === id);
  }

  /**
   * Select a camera for viewing
   */
  selectCamera(id: string | null): void {
    this._selectedCameraId.set(id);
  }

  /**
   * Add a new camera
   */
  addCamera(request: CreateCameraRequest): Camera {
    const now = new Date();
    const camera: Camera = {
      id: this.generateId(),
      userId: 'current-user', // TODO: Get from auth service
      name: request.name,
      type: request.type,
      streamUrl: request.streamUrl,
      status: 'connecting',
      location: request.location,
      motionDetection: true,
      recordingEnabled: false,
      settings: {
        resolution: '1080p',
        frameRate: 30,
        nightVision: true,
        audioEnabled: true,
        motionSensitivity: 'medium',
        recordingQuality: 'high',
        retentionDays: 7,
        ...request.settings,
      },
      createdAt: now,
      updatedAt: now,
    };

    this._cameras.update(cameras => [...cameras, camera]);
    this.saveToStorage();

    // Test connection
    this.testCameraConnection(camera.id);

    return camera;
  }

  /**
   * Update a camera
   */
  updateCamera(id: string, updates: UpdateCameraRequest): Camera | null {
    let updatedCamera: Camera | null = null;

    this._cameras.update(cameras =>
      cameras.map(camera => {
        if (camera.id === id) {
          updatedCamera = {
            ...camera,
            ...updates,
            settings: updates.settings
              ? { ...camera.settings, ...updates.settings }
              : camera.settings,
            updatedAt: new Date(),
          };
          return updatedCamera;
        }
        return camera;
      })
    );

    if (updatedCamera) {
      this.saveToStorage();
    }

    return updatedCamera;
  }

  /**
   * Delete a camera
   */
  deleteCamera(id: string): boolean {
    const initialLength = this._cameras().length;
    this._cameras.update(cameras => cameras.filter(c => c.id !== id));

    if (this._cameras().length < initialLength) {
      // Also delete associated events
      this._events.update(events => events.filter(e => e.cameraId !== id));
      this.saveToStorage();

      if (this._selectedCameraId() === id) {
        this._selectedCameraId.set(null);
      }

      return true;
    }

    return false;
  }

  /**
   * Update camera status
   */
  updateCameraStatus(id: string, status: CameraStatus): void {
    const camera = this.getCamera(id);
    const previousStatus = camera?.status;

    this._cameras.update(cameras =>
      cameras.map(c =>
        c.id === id ? { ...c, status, updatedAt: new Date() } : c
      )
    );
    this.saveToStorage();

    // Alert on status change to offline
    if (previousStatus === 'online' && status === 'offline') {
      this.alertService.addAlert({
        source: 'camera',
        type: 'camera_offline',
        priority: 'high',
        title: 'Camera Offline',
        message: `${camera?.name || 'Camera'} has gone offline`,
        data: { cameraId: id },
      });
    }
  }

  /**
   * Test camera connection
   */
  async testCameraConnection(id: string): Promise<CameraConnectionTest> {
    const camera = this.getCamera(id);
    if (!camera) {
      return { success: false, error: 'Camera not found' };
    }

    this.updateCameraStatus(id, 'connecting');

    try {
      // For demo purposes, simulate connection test
      // In production, this would actually test the stream URL
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Simulate 90% success rate
      const success = Math.random() > 0.1;

      if (success) {
        this.updateCameraStatus(id, 'online');
        return {
          success: true,
          latency: Math.floor(Math.random() * 100) + 50,
          resolution: camera.settings.resolution,
        };
      } else {
        this.updateCameraStatus(id, 'error');
        return {
          success: false,
          error: 'Failed to connect to camera stream',
        };
      }
    } catch (error) {
      this.updateCameraStatus(id, 'error');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Add a camera event
   */
  addEvent(event: Partial<CameraEvent> & { cameraId: string; type: CameraEventType }): CameraEvent {
    const newEvent: CameraEvent = {
      id: this.generateId(),
      cameraId: event.cameraId,
      type: event.type,
      timestamp: event.timestamp || new Date(),
      thumbnailUrl: event.thumbnailUrl,
      clipUrl: event.clipUrl,
      duration: event.duration,
      acknowledged: false,
      metadata: event.metadata,
    };

    this._events.update(events => [newEvent, ...events].slice(0, 1000)); // Keep last 1000 events
    this.saveToStorage();

    // Create alert for significant events
    const camera = this.getCamera(event.cameraId);
    if (event.type === 'person' || event.type === 'motion') {
      this.alertService.addAlert({
        source: 'camera',
        type: event.type === 'person' ? 'person_detected' : 'motion_detected',
        priority: event.type === 'person' ? 'high' : 'medium',
        title: `${event.type.charAt(0).toUpperCase() + event.type.slice(1)} Detected`,
        message: `${camera?.name || 'Camera'} detected ${event.type}`,
        data: {
          cameraId: event.cameraId,
          thumbnailUrl: event.thumbnailUrl,
          clipUrl: event.clipUrl,
        },
      });
    }

    return newEvent;
  }

  /**
   * Acknowledge an event
   */
  acknowledgeEvent(eventId: string, acknowledgedBy?: string): boolean {
    let found = false;

    this._events.update(events =>
      events.map(e => {
        if (e.id === eventId) {
          found = true;
          return {
            ...e,
            acknowledged: true,
            acknowledgedAt: new Date(),
            acknowledgedBy,
          };
        }
        return e;
      })
    );

    if (found) {
      this.saveToStorage();
    }

    return found;
  }

  /**
   * Acknowledge all events for a camera
   */
  acknowledgeAllEvents(cameraId?: string): number {
    let count = 0;

    this._events.update(events =>
      events.map(e => {
        if (!e.acknowledged && (!cameraId || e.cameraId === cameraId)) {
          count++;
          return {
            ...e,
            acknowledged: true,
            acknowledgedAt: new Date(),
          };
        }
        return e;
      })
    );

    if (count > 0) {
      this.saveToStorage();
    }

    return count;
  }

  /**
   * Get events for a specific camera
   */
  getCameraEvents(cameraId: string, limit?: number): CameraEvent[] {
    const events = this._events().filter(e => e.cameraId === cameraId);
    return limit ? events.slice(0, limit) : events;
  }

  /**
   * Get events by type
   */
  getEventsByType(type: CameraEventType, limit?: number): CameraEvent[] {
    const events = this._events().filter(e => e.type === type);
    return limit ? events.slice(0, limit) : events;
  }

  /**
   * Clear old events
   */
  clearOldEvents(daysOld: number): number {
    const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    const initialLength = this._events().length;

    this._events.update(events =>
      events.filter(e => new Date(e.timestamp) > cutoff)
    );

    const removed = initialLength - this._events().length;
    if (removed > 0) {
      this.saveToStorage();
    }

    return removed;
  }

  /**
   * Toggle motion detection
   */
  toggleMotionDetection(id: string): boolean {
    const camera = this.getCamera(id);
    if (!camera) return false;

    this.updateCamera(id, { motionDetection: !camera.motionDetection });
    return true;
  }

  /**
   * Toggle recording
   */
  toggleRecording(id: string): boolean {
    const camera = this.getCamera(id);
    if (!camera) return false;

    this.updateCamera(id, { recordingEnabled: !camera.recordingEnabled });
    return true;
  }

  /**
   * Get stream URL for a camera (with any necessary transformations)
   */
  getStreamUrl(id: string): string | null {
    const camera = this.getCamera(id);
    if (!camera) return null;

    // Check if RTSP URL needs proxying
    if (this.streamService.isRtspUrl(camera.streamUrl)) {
      // Return proxied URL through media server
      return this.streamService.getRtspProxyUrl(camera.streamUrl);
    }

    // In production, this might involve generating a signed URL
    // or proxying through a server
    return camera.streamUrl;
  }

  /**
   * Get original stream URL (without proxy transformations)
   */
  getOriginalStreamUrl(id: string): string | null {
    const camera = this.getCamera(id);
    return camera?.streamUrl || null;
  }

  /**
   * Check if camera uses RTSP and needs a media server proxy
   */
  needsRtspProxy(id: string): boolean {
    const camera = this.getCamera(id);
    return camera ? this.streamService.isRtspUrl(camera.streamUrl) : false;
  }

  /**
   * Generate sample cameras for demo
   */
  generateSampleCameras(): void {
    const samples: CreateCameraRequest[] = [
      {
        name: 'Front Door',
        type: 'ip',
        streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        location: 'Main Entrance',
      },
      {
        name: 'Backyard',
        type: 'ip',
        streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        location: 'Garden',
      },
      {
        name: 'Garage',
        type: 'ip',
        streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        location: 'Parking',
      },
      {
        name: 'IP Camera (RTSP)',
        type: 'ip',
        streamUrl: 'rtsp://admin:admin123@192.168.1.100:554/cam/realmonitor?channel=1&subtype=0',
        location: 'Network Camera',
      },
    ];

    samples.forEach(sample => this.addCamera(sample));

    // Add some sample events
    const cameras = this._cameras();
    if (cameras.length > 0) {
      const eventTypes: CameraEventType[] = ['motion', 'person', 'vehicle', 'pet'];

      for (let i = 0; i < 10; i++) {
        const camera = cameras[Math.floor(Math.random() * cameras.length)];
        const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        const hoursAgo = Math.floor(Math.random() * 24);

        this.addEvent({
          cameraId: camera.id,
          type,
          timestamp: new Date(Date.now() - hoursAgo * 60 * 60 * 1000),
        });
      }
    }
  }

  private generateId(): string {
    return `cam_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
