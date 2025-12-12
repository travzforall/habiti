// Emergency Response System Models

export interface EmergencyDevice {
  id: string;
  userId: string;
  deviceType: EmergencyDeviceType;
  name: string;
  serialNumber: string;
  model?: string;
  firmwareVersion?: string;
  batteryLevel: number; // 0-100
  lastSeen: Date;
  status: EmergencyDeviceStatus;
  capabilities: EmergencyDeviceCapabilities;
  settings: EmergencyDeviceSettings;
  createdAt: Date;
  updatedAt: Date;
}

export type EmergencyDeviceType = 'bracelet' | 'pendant' | 'watch' | 'base_station' | 'mobile_app';

export type EmergencyDeviceStatus = 'active' | 'inactive' | 'low_battery' | 'offline' | 'error';

export interface EmergencyDeviceCapabilities {
  sosButton: boolean;
  fallDetection: boolean;
  heartRateMonitor: boolean;
  bloodOxygen: boolean;
  gps: boolean;
  indoorPositioning: boolean;
  twoWayAudio: boolean;
  waterproof: boolean;
  activityTracking: boolean;
}

export interface EmergencyDeviceSettings {
  fallDetectionEnabled: boolean;
  fallDetectionSensitivity: 'low' | 'medium' | 'high';
  noMovementAlertEnabled: boolean;
  noMovementThresholdMinutes: number;
  geofenceAlertEnabled: boolean;
  heartRateAlertEnabled: boolean;
  heartRateLowThreshold: number;
  heartRateHighThreshold: number;
  autoAnswerCalls: boolean;
  locationUpdateInterval: number; // seconds
}

export interface EmergencyContact {
  id: string;
  userId: string;
  name: string;
  phone: string;
  email?: string;
  relationship: ContactRelationship;
  priority: number; // 1 = highest priority
  notifyOnAlert: boolean;
  notifyOnFallDetection: boolean;
  notifyOnGeofence: boolean;
  canCancelAlert: boolean; // can this contact cancel a false alarm
  photoUrl?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ContactRelationship =
  | 'spouse'
  | 'child'
  | 'parent'
  | 'sibling'
  | 'friend'
  | 'neighbor'
  | 'caregiver'
  | 'doctor'
  | 'other';

export interface EmergencyIncident {
  id: string;
  userId: string;
  deviceId: string;
  type: IncidentType;
  status: IncidentStatus;
  priority: IncidentPriority;
  location: EmergencyLocation;
  timestamp: Date;
  respondedAt?: Date;
  resolvedAt?: Date;
  operatorId?: string;
  operatorName?: string;
  resolution?: IncidentResolution;
  notes?: string;
  timeline: IncidentTimelineEvent[];
  contactsNotified: NotifiedContact[];
  recordings?: IncidentRecording[];
}

export type IncidentType =
  | 'sos'
  | 'fall'
  | 'no_movement'
  | 'geofence_exit'
  | 'heart_rate_abnormal'
  | 'device_offline'
  | 'low_battery_critical'
  | 'manual_check_in_missed';

export type IncidentStatus =
  | 'active'
  | 'responding'
  | 'contacting_user'
  | 'contacting_contacts'
  | 'dispatching'
  | 'resolved'
  | 'false_alarm'
  | 'cancelled';

export type IncidentPriority = 'critical' | 'high' | 'medium' | 'low';

export type IncidentResolution =
  | 'user_ok'
  | 'false_alarm'
  | 'help_provided'
  | 'emergency_dispatched'
  | 'contact_assisted'
  | 'cancelled_by_user'
  | 'cancelled_by_contact'
  | 'no_response';

export interface EmergencyLocation {
  lat: number;
  lng: number;
  accuracy?: number; // meters
  altitude?: number;
  address?: string;
  indoorLocation?: IndoorLocation;
  timestamp: Date;
}

export interface IndoorLocation {
  buildingName?: string;
  floor?: number;
  room?: string;
  beaconId?: string;
}

export interface IncidentTimelineEvent {
  id: string;
  incidentId: string;
  timestamp: Date;
  type: TimelineEventType;
  description: string;
  performedBy?: string; // operator ID or 'system' or 'user'
  metadata?: Record<string, unknown>;
}

export type TimelineEventType =
  | 'incident_created'
  | 'operator_assigned'
  | 'call_initiated'
  | 'call_connected'
  | 'call_ended'
  | 'contact_notified'
  | 'contact_responded'
  | 'emergency_dispatched'
  | 'location_updated'
  | 'status_changed'
  | 'note_added'
  | 'incident_resolved';

export interface NotifiedContact {
  contactId: string;
  contactName: string;
  phone: string;
  notifiedAt: Date;
  notificationMethod: 'call' | 'sms' | 'push' | 'email';
  status: 'pending' | 'delivered' | 'acknowledged' | 'failed';
  response?: string;
}

export interface IncidentRecording {
  id: string;
  incidentId: string;
  type: 'audio' | 'video';
  startTime: Date;
  endTime?: Date;
  duration?: number; // seconds
  fileUrl: string;
  fileSize: number; // bytes
}

export interface UserHealthProfile {
  id: string;
  userId: string;
  dateOfBirth?: Date;
  bloodType?: string;
  allergies: string[];
  medications: UserMedication[];
  medicalConditions: string[];
  mobility: 'full' | 'limited' | 'wheelchair' | 'bedridden';
  cognitiveStatus: 'normal' | 'mild_impairment' | 'moderate_impairment' | 'severe_impairment';
  primaryPhysician?: PhysicianContact;
  hospitalPreference?: string;
  dnrStatus?: boolean;
  notes?: string;
  updatedAt: Date;
}

export interface UserMedication {
  name: string;
  dosage: string;
  frequency: string;
  purpose?: string;
}

export interface PhysicianContact {
  name: string;
  phone: string;
  clinic?: string;
  specialty?: string;
}

export interface CheckInSchedule {
  id: string;
  userId: string;
  name: string;
  times: string[]; // HH:mm format
  daysOfWeek: number[]; // 0-6, Sunday = 0
  enabled: boolean;
  gracePeriodMinutes: number;
  escalationDelayMinutes: number;
  message?: string;
}

export interface CheckInLog {
  id: string;
  userId: string;
  scheduleId: string;
  scheduledTime: Date;
  checkedInAt?: Date;
  status: 'pending' | 'completed' | 'missed' | 'escalated';
  method?: 'button' | 'app' | 'voice';
}

export interface EmergencyGeofence {
  id: string;
  userId: string;
  name: string;
  type: 'home' | 'safe_zone' | 'danger_zone' | 'custom';
  center: { lat: number; lng: number };
  radius: number; // meters
  enabled: boolean;
  alertOnExit: boolean;
  alertOnEnter: boolean;
  schedule?: GeofenceSchedule;
}

export interface GeofenceSchedule {
  enabled: boolean;
  activeHours: { start: string; end: string }; // HH:mm format
  activeDays: number[]; // 0-6
}

export interface EmergencyDashboardStats {
  activeDevices: number;
  lowBatteryDevices: number;
  offlineDevices: number;
  activeIncidents: number;
  todayIncidents: number;
  resolvedToday: number;
  averageResponseTime: number; // seconds
  pendingCheckIns: number;
}

export interface EmergencyServiceConfig {
  dispatchEnabled: boolean;
  dispatchNumber: string; // usually 911
  dispatchProtocol: 'auto' | 'manual' | 'confirm_first';
  callbackNumber: string;
  defaultResponseTimeout: number; // seconds before escalation
  maxEscalationAttempts: number;
}
