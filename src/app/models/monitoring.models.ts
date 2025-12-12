// 24/7 Professional Monitoring Service Models

export interface MonitoringSubscription {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  features: SubscriptionFeature[];
  startDate: Date;
  endDate?: Date;
  renewalDate?: Date;
  status: SubscriptionStatus;
  billingCycle: 'monthly' | 'yearly';
  price: number;
  currency: string;
  paymentMethodId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type SubscriptionTier = 'basic' | 'premium' | 'enterprise' | 'family';

export type SubscriptionStatus = 'active' | 'trial' | 'past_due' | 'cancelled' | 'expired' | 'suspended';

export type SubscriptionFeature =
  | 'camera_monitoring'
  | 'pet_monitoring'
  | 'emergency_response'
  | 'fall_detection'
  | 'two_way_audio'
  | 'dispatch_service'
  | 'unlimited_cameras'
  | 'unlimited_devices'
  | 'cloud_storage_30d'
  | 'cloud_storage_90d'
  | 'cloud_storage_unlimited'
  | 'priority_response'
  | 'family_accounts'
  | 'api_access';

export interface SubscriptionTierConfig {
  tier: SubscriptionTier;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: SubscriptionFeature[];
  maxCameras: number;
  maxDevices: number;
  maxFamilyMembers: number;
  responseTimeSLA: number; // seconds
  cloudStorageDays: number;
}

export interface Operator {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: OperatorRole;
  status: OperatorStatus;
  skills: OperatorSkill[];
  certifications: string[];
  activeIncidents: string[];
  maxConcurrentIncidents: number;
  currentShiftId?: string;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type OperatorRole = 'operator' | 'senior_operator' | 'supervisor' | 'admin';

export type OperatorStatus = 'available' | 'busy' | 'break' | 'training' | 'offline';

export type OperatorSkill =
  | 'emergency_response'
  | 'medical_knowledge'
  | 'pet_care'
  | 'technical_support'
  | 'multilingual_spanish'
  | 'multilingual_french'
  | 'multilingual_mandarin'
  | 'dispatch_coordination'
  | 'crisis_management';

export interface OperatorShift {
  id: string;
  operatorId: string;
  startTime: Date;
  endTime?: Date;
  scheduledEndTime: Date;
  status: 'active' | 'completed' | 'no_show';
  incidentsHandled: number;
  averageResponseTime: number; // seconds
  breaks: ShiftBreak[];
  notes?: string;
}

export interface ShiftBreak {
  startTime: Date;
  endTime?: Date;
  type: 'short' | 'meal' | 'emergency';
}

export interface ShiftSchedule {
  id: string;
  operatorId: string;
  date: Date;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  type: 'regular' | 'overtime' | 'on_call';
  status: 'scheduled' | 'confirmed' | 'cancelled';
}

export interface MonitoringSession {
  id: string;
  operatorId: string;
  incidentId: string;
  subscriberId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // seconds
  actions: MonitoringAction[];
  outcome?: SessionOutcome;
  feedback?: SessionFeedback;
}

export type SessionOutcome =
  | 'resolved_remotely'
  | 'contact_assisted'
  | 'emergency_dispatched'
  | 'false_alarm'
  | 'user_cancelled'
  | 'escalated'
  | 'transferred';

export interface MonitoringAction {
  id: string;
  sessionId: string;
  timestamp: Date;
  type: MonitoringActionType;
  details?: string;
  result?: 'success' | 'failed' | 'no_answer' | 'busy';
  duration?: number; // seconds for calls
}

export type MonitoringActionType =
  | 'call_user'
  | 'call_contact'
  | 'sms_user'
  | 'sms_contact'
  | 'email_user'
  | 'email_contact'
  | 'dispatch_911'
  | 'dispatch_non_emergency'
  | 'intercom_camera'
  | 'view_camera'
  | 'check_location'
  | 'add_note'
  | 'escalate'
  | 'transfer'
  | 'resolve';

export interface SessionFeedback {
  rating: number; // 1-5
  comments?: string;
  submittedAt: Date;
  submittedBy: 'user' | 'contact';
}

export interface IncidentQueue {
  activeIncidents: QueuedIncident[];
  pendingIncidents: QueuedIncident[];
  totalActive: number;
  totalPending: number;
  averageWaitTime: number; // seconds
  oldestPendingTime?: Date;
}

export interface QueuedIncident {
  incidentId: string;
  userId: string;
  userName: string;
  type: string;
  priority: string;
  status: string;
  timestamp: Date;
  waitTime: number; // seconds
  assignedOperatorId?: string;
  assignedOperatorName?: string;
  subscriptionTier: SubscriptionTier;
  location?: { lat: number; lng: number; address?: string };
}

export interface SubscriberProfile {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  photoUrl?: string;
  subscription: MonitoringSubscription;
  devices: DeviceSummary[];
  cameras: CameraSummary[];
  pets: PetSummary[];
  emergencyContacts: ContactSummary[];
  healthProfile?: HealthProfileSummary;
  address: SubscriberAddress;
  notes?: string;
  flags: SubscriberFlag[];
  incidentHistory: IncidentHistorySummary[];
  lastIncidentDate?: Date;
  totalIncidents: number;
  falseAlarmRate: number; // percentage
}

export interface DeviceSummary {
  id: string;
  name: string;
  type: string;
  status: string;
  batteryLevel: number;
  lastSeen: Date;
}

export interface CameraSummary {
  id: string;
  name: string;
  location: string;
  status: string;
  hasAudio: boolean;
}

export interface PetSummary {
  id: string;
  name: string;
  species: string;
  hasDevice: boolean;
  lastLocation?: { lat: number; lng: number };
}

export interface ContactSummary {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  priority: number;
}

export interface HealthProfileSummary {
  age?: number;
  bloodType?: string;
  allergies: string[];
  conditions: string[];
  mobility: string;
}

export interface SubscriberAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  accessNotes?: string; // gate code, building access, etc.
}

export type SubscriberFlag =
  | 'frequent_false_alarms'
  | 'medical_priority'
  | 'hearing_impaired'
  | 'vision_impaired'
  | 'non_english_speaker'
  | 'pet_in_home'
  | 'weapons_in_home'
  | 'gated_community'
  | 'high_rise'
  | 'rural_location';

export interface IncidentHistorySummary {
  id: string;
  date: Date;
  type: string;
  resolution: string;
  responseTime: number; // seconds
  operatorName?: string;
}

export interface MonitoringCenterStats {
  // Real-time stats
  activeOperators: number;
  availableOperators: number;
  activeIncidents: number;
  pendingIncidents: number;
  averageQueueTime: number; // seconds
  currentResponseTime: number; // seconds

  // Today's stats
  todayIncidents: number;
  todayResolved: number;
  todayFalseAlarms: number;
  todayDispatchCount: number;

  // Performance metrics
  slaCompliance: number; // percentage
  customerSatisfaction: number; // average rating 1-5
  firstCallResolution: number; // percentage
}

export interface OperatorPerformanceMetrics {
  operatorId: string;
  period: 'day' | 'week' | 'month';
  incidentsHandled: number;
  averageResponseTime: number; // seconds
  averageHandleTime: number; // seconds
  firstCallResolution: number; // percentage
  customerSatisfactionAvg: number; // 1-5
  escalationRate: number; // percentage
  falseAlarmIdentification: number; // percentage correctly identified
}

export interface DispatchRecord {
  id: string;
  incidentId: string;
  operatorId: string;
  type: 'police' | 'fire' | 'ems' | 'non_emergency';
  dispatchedAt: Date;
  confirmedAt?: Date;
  arrivedAt?: Date;
  clearedAt?: Date;
  dispatchNumber: string;
  caseNumber?: string;
  agency?: string;
  notes?: string;
}

export interface CommunicationLog {
  id: string;
  incidentId?: string;
  sessionId?: string;
  operatorId: string;
  subscriberId: string;
  type: 'inbound_call' | 'outbound_call' | 'sms' | 'email' | 'intercom';
  direction: 'inbound' | 'outbound';
  recipient: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // seconds
  status: 'initiated' | 'connected' | 'completed' | 'failed' | 'no_answer' | 'busy';
  recordingUrl?: string;
  transcription?: string;
  notes?: string;
}

export interface AlertEscalation {
  id: string;
  incidentId: string;
  level: number; // 1, 2, 3, etc.
  triggeredAt: Date;
  reason: string;
  previousOperatorId?: string;
  newOperatorId?: string;
  supervisorNotified: boolean;
  resolved: boolean;
}
