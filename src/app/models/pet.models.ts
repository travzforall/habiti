// Pet Management System Models

export interface Pet {
  id: string;
  userId: string;
  name: string;
  species: PetSpecies;
  breed?: string;
  birthDate?: Date;
  weight?: number; // kg
  weightUnit: 'kg' | 'lb';
  photoUrl?: string;
  color?: string;
  gender?: 'male' | 'female' | 'unknown';
  neutered?: boolean;
  microchipId?: string;
  deviceId?: string; // linked smart collar/bracelet
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type PetSpecies = 'dog' | 'cat' | 'bird' | 'rabbit' | 'hamster' | 'fish' | 'reptile' | 'other';

export interface PetDevice {
  id: string;
  petId: string;
  userId: string;
  name: string;
  type: PetDeviceType;
  model?: string;
  serialNumber: string;
  firmwareVersion?: string;
  batteryLevel: number; // 0-100
  lastSeen: Date;
  status: DeviceStatus;
  capabilities: PetDeviceCapabilities;
  settings: PetDeviceSettings;
}

export type PetDeviceType = 'collar' | 'bracelet' | 'tag' | 'feeder' | 'camera';

export type DeviceStatus = 'connected' | 'disconnected' | 'low_battery' | 'error';

export interface PetDeviceCapabilities {
  gps: boolean;
  activityTracking: boolean;
  heartRate: boolean;
  temperature: boolean;
  sound: boolean; // can emit sounds for training
  vibration: boolean; // can vibrate for training
  light: boolean; // LED indicator
  waterproof: boolean;
}

export interface PetDeviceSettings {
  gpsInterval: number; // seconds between GPS updates
  activityInterval: number; // seconds between activity syncs
  lowBatteryAlert: number; // percentage threshold
  geofenceEnabled: boolean;
  trainingMode: boolean;
}

export interface PetActivity {
  id: string;
  petId: string;
  date: Date;
  steps: number;
  activeMinutes: number;
  restMinutes: number;
  playMinutes: number;
  sleepMinutes: number;
  calories: number;
  distance: number; // meters
  location?: GeoLocation;
  hourlyBreakdown?: HourlyActivity[];
}

export interface HourlyActivity {
  hour: number; // 0-23
  steps: number;
  activeMinutes: number;
  activityLevel: 'rest' | 'low' | 'moderate' | 'high';
}

export interface GeoLocation {
  lat: number;
  lng: number;
  accuracy?: number; // meters
  timestamp: Date;
}

export interface PetLocationHistory {
  id: string;
  petId: string;
  locations: GeoLocation[];
  startTime: Date;
  endTime: Date;
}

export interface PetHealthMetrics {
  id: string;
  petId: string;
  date: Date;
  weight?: number;
  heartRate?: number; // bpm, if device supports
  temperature?: number; // celsius, if device supports
  activityScore: number; // 0-100
  sleepQuality: number; // 0-100
  notes?: string;
}

export interface Geofence {
  id: string;
  petId: string;
  userId: string;
  name: string;
  type: 'circle' | 'polygon';
  center?: GeoLocation; // for circle
  radius?: number; // meters, for circle
  points?: GeoLocation[]; // for polygon
  enabled: boolean;
  alertOnExit: boolean;
  alertOnEnter: boolean;
  safeZone: boolean; // true = alert when leaving, false = alert when entering
}

export interface GeofenceEvent {
  id: string;
  geofenceId: string;
  petId: string;
  type: 'enter' | 'exit';
  timestamp: Date;
  location: GeoLocation;
  acknowledged: boolean;
}

export interface TrainingSession {
  id: string;
  petId: string;
  userId: string;
  type: TrainingType;
  name: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // seconds
  status: 'active' | 'completed' | 'cancelled';
  commands: TrainingCommand[];
  successRate?: number; // 0-100
  notes?: string;
}

export type TrainingType = 'boundary' | 'recall' | 'command' | 'leash' | 'behavior' | 'custom';

export interface TrainingCommand {
  id: string;
  sessionId: string;
  command: string;
  timestamp: Date;
  response: 'success' | 'partial' | 'fail' | 'no_response';
  rewardGiven: boolean;
  deviceAction?: 'sound' | 'vibration' | 'light' | 'none';
}

export interface TrainingProgram {
  id: string;
  petId: string;
  name: string;
  description: string;
  type: TrainingType;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  commands: string[];
  sessionsCompleted: number;
  totalSessions: number;
  startDate: Date;
  completedDate?: Date;
  status: 'active' | 'completed' | 'paused';
}

export interface FeedingSchedule {
  id: string;
  petId: string;
  name: string;
  times: string[]; // HH:mm format
  amount: number;
  unit: 'cups' | 'grams' | 'oz';
  foodType: string;
  enabled: boolean;
  reminderEnabled: boolean;
  reminderMinutesBefore: number;
}

export interface FeedingLog {
  id: string;
  petId: string;
  scheduleId?: string;
  timestamp: Date;
  amount: number;
  unit: 'cups' | 'grams' | 'oz';
  foodType: string;
  notes?: string;
  fedBy?: string;
}

export interface VetVisit {
  id: string;
  petId: string;
  date: Date;
  vetName: string;
  clinicName?: string;
  reason: string;
  diagnosis?: string;
  treatment?: string;
  medications?: PetMedication[];
  nextVisitDate?: Date;
  cost?: number;
  notes?: string;
  documents?: string[]; // URLs to uploaded documents
}

export interface PetMedication {
  id: string;
  petId: string;
  name: string;
  dosage: string;
  frequency: string;
  startDate: Date;
  endDate?: Date;
  reminderEnabled: boolean;
  reminderTimes: string[]; // HH:mm format
  notes?: string;
  active: boolean;
}

export interface PetDashboardStats {
  totalPets: number;
  connectedDevices: number;
  lowBatteryDevices: number;
  activeAlerts: number;
  todaySteps: number;
  todayActiveMinutes: number;
  upcomingReminders: number;
}
