// Security & Camera System Models

export interface Camera {
  id: string;
  userId: string;
  name: string;
  type: CameraType;
  streamUrl: string;
  status: CameraStatus;
  location: string;
  motionDetection: boolean;
  recordingEnabled: boolean;
  settings: CameraSettings;
  createdAt: Date;
  updatedAt: Date;
}

export type CameraType = 'ip' | 'webcam' | 'wyze' | 'ring' | 'nest' | 'rtsp' | 'hls';

export type CameraStatus = 'online' | 'offline' | 'error' | 'connecting';

export interface CameraSettings {
  resolution: '480p' | '720p' | '1080p' | '4k';
  frameRate: number;
  nightVision: boolean;
  audioEnabled: boolean;
  motionSensitivity: 'low' | 'medium' | 'high';
  recordingQuality: 'low' | 'medium' | 'high';
  retentionDays: number;
}

export interface CameraEvent {
  id: string;
  cameraId: string;
  type: CameraEventType;
  timestamp: Date;
  thumbnailUrl?: string;
  clipUrl?: string;
  duration?: number; // seconds
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  metadata?: CameraEventMetadata;
}

export type CameraEventType = 'motion' | 'person' | 'vehicle' | 'pet' | 'sound' | 'line_cross' | 'zone_intrusion';

export interface CameraEventMetadata {
  confidence?: number; // 0-100 for AI detection
  boundingBox?: { x: number; y: number; width: number; height: number };
  objectCount?: number;
  soundLevel?: number; // decibels
}

export interface CameraRecording {
  id: string;
  cameraId: string;
  startTime: Date;
  endTime: Date;
  duration: number; // seconds
  fileUrl: string;
  fileSize: number; // bytes
  type: 'continuous' | 'event' | 'manual';
  eventId?: string;
}

export interface CameraZone {
  id: string;
  cameraId: string;
  name: string;
  type: 'motion' | 'intrusion' | 'line';
  points: { x: number; y: number }[]; // polygon points as percentages
  enabled: boolean;
  alertOnTrigger: boolean;
}

export interface SecurityDashboardStats {
  totalCameras: number;
  onlineCameras: number;
  offlineCameras: number;
  todayEvents: number;
  unacknowledgedEvents: number;
  storageUsed: number; // bytes
  storageLimit: number; // bytes
}

// Camera brand-specific configurations
export interface WyzeCameraConfig {
  deviceId: string;
  deviceMac: string;
  accessToken: string;
  refreshToken: string;
}

export interface RingCameraConfig {
  deviceId: string;
  locationId: string;
  accessToken: string;
  refreshToken: string;
}

export interface NestCameraConfig {
  deviceId: string;
  projectId: string;
  accessToken: string;
  refreshToken: string;
}

export interface CameraConnectionTest {
  success: boolean;
  latency?: number; // ms
  resolution?: string;
  error?: string;
}
