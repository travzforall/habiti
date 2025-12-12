import { Injectable, signal, computed, inject } from '@angular/core';
import { WebSocketService, WebSocketMessage } from './websocket.service';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export interface UnifiedAlert {
  id: string;
  source: AlertSource;
  type: AlertType;
  priority: AlertPriority;
  title: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  data?: AlertData;
  actions?: AlertAction[];
}

export type AlertSource = 'camera' | 'pet' | 'emergency' | 'system' | 'monitoring';

export type AlertType =
  // Camera alerts
  | 'motion_detected'
  | 'person_detected'
  | 'vehicle_detected'
  | 'camera_offline'
  | 'camera_tampering'
  // Pet alerts
  | 'pet_left_geofence'
  | 'pet_entered_geofence'
  | 'pet_device_low_battery'
  | 'pet_device_offline'
  | 'pet_inactivity'
  // Emergency alerts
  | 'sos_triggered'
  | 'fall_detected'
  | 'no_movement'
  | 'geofence_breach'
  | 'heart_rate_abnormal'
  | 'check_in_missed'
  | 'emergency_device_low_battery'
  | 'emergency_device_offline'
  // System alerts
  | 'connection_lost'
  | 'subscription_expiring'
  | 'storage_full'
  // Monitoring alerts
  | 'incident_assigned'
  | 'incident_escalated'
  | 'shift_starting';

export type AlertPriority = 'critical' | 'high' | 'medium' | 'low';

export interface AlertData {
  // Source IDs
  cameraId?: string;
  petId?: string;
  deviceId?: string;
  incidentId?: string;

  // Location data
  location?: { lat: number; lng: number; address?: string };

  // Media
  thumbnailUrl?: string;
  clipUrl?: string;
  streamUrl?: string;

  // Additional context
  [key: string]: unknown;
}

export interface AlertAction {
  id: string;
  label: string;
  icon?: string;
  type: 'primary' | 'secondary' | 'danger';
  action: string; // action identifier to handle
}

export interface AlertFilter {
  sources?: AlertSource[];
  types?: AlertType[];
  priorities?: AlertPriority[];
  acknowledged?: boolean;
  startDate?: Date;
  endDate?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class AlertService {
  private readonly wsService = inject(WebSocketService);
  private readonly destroy$ = new Subject<void>();

  // Reactive state
  private readonly _alerts = signal<UnifiedAlert[]>([]);
  private readonly _isLoading = signal(false);

  // Public computed signals
  readonly alerts = this._alerts.asReadonly();
  readonly unacknowledgedAlerts = computed(() =>
    this._alerts().filter(a => !a.acknowledged)
  );
  readonly criticalAlerts = computed(() =>
    this._alerts().filter(a => a.priority === 'critical' && !a.acknowledged)
  );
  readonly alertCount = computed(() => this._alerts().length);
  readonly unacknowledgedCount = computed(() => this.unacknowledgedAlerts().length);
  readonly isLoading = this._isLoading.asReadonly();

  // Alert grouping
  readonly alertsBySource = computed(() => {
    const groups = new Map<AlertSource, UnifiedAlert[]>();
    this._alerts().forEach(alert => {
      const existing = groups.get(alert.source) || [];
      groups.set(alert.source, [...existing, alert]);
    });
    return groups;
  });

  readonly alertsByPriority = computed(() => {
    const groups = new Map<AlertPriority, UnifiedAlert[]>();
    this._alerts().forEach(alert => {
      const existing = groups.get(alert.priority) || [];
      groups.set(alert.priority, [...existing, alert]);
    });
    return groups;
  });

  // Event emitter for new alerts
  private readonly newAlert$ = new Subject<UnifiedAlert>();

  constructor() {
    this.subscribeToWebSocketEvents();
  }

  /**
   * Get observable for new alerts
   */
  onNewAlert(): Observable<UnifiedAlert> {
    return this.newAlert$.asObservable();
  }

  /**
   * Get filtered alerts
   */
  getFilteredAlerts(filter: AlertFilter): UnifiedAlert[] {
    return this._alerts().filter(alert => {
      if (filter.sources && !filter.sources.includes(alert.source)) return false;
      if (filter.types && !filter.types.includes(alert.type)) return false;
      if (filter.priorities && !filter.priorities.includes(alert.priority)) return false;
      if (filter.acknowledged !== undefined && alert.acknowledged !== filter.acknowledged) return false;
      if (filter.startDate && alert.timestamp < filter.startDate) return false;
      if (filter.endDate && alert.timestamp > filter.endDate) return false;
      return true;
    });
  }

  /**
   * Add a new alert
   */
  addAlert(alert: Omit<UnifiedAlert, 'id' | 'timestamp' | 'acknowledged'>): UnifiedAlert {
    const newAlert: UnifiedAlert = {
      ...alert,
      id: this.generateAlertId(),
      timestamp: new Date(),
      acknowledged: false,
      actions: alert.actions || this.getDefaultActions(alert.type, alert.source),
    };

    this._alerts.update(alerts => [newAlert, ...alerts]);
    this.newAlert$.next(newAlert);

    // Play sound for critical alerts
    if (newAlert.priority === 'critical') {
      this.playCriticalAlertSound();
    }

    // Trigger browser notification
    this.showBrowserNotification(newAlert);

    return newAlert;
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy?: string): boolean {
    const alertIndex = this._alerts().findIndex(a => a.id === alertId);
    if (alertIndex === -1) return false;

    this._alerts.update(alerts => {
      const updated = [...alerts];
      updated[alertIndex] = {
        ...updated[alertIndex],
        acknowledged: true,
        acknowledgedAt: new Date(),
        acknowledgedBy,
      };
      return updated;
    });

    return true;
  }

  /**
   * Acknowledge all alerts matching filter
   */
  acknowledgeAll(filter?: AlertFilter, acknowledgedBy?: string): number {
    let count = 0;
    const alertsToAcknowledge = filter ? this.getFilteredAlerts(filter) : this._alerts();

    this._alerts.update(alerts =>
      alerts.map(alert => {
        if (alertsToAcknowledge.some(a => a.id === alert.id) && !alert.acknowledged) {
          count++;
          return {
            ...alert,
            acknowledged: true,
            acknowledgedAt: new Date(),
            acknowledgedBy,
          };
        }
        return alert;
      })
    );

    return count;
  }

  /**
   * Remove an alert
   */
  removeAlert(alertId: string): boolean {
    const initialLength = this._alerts().length;
    this._alerts.update(alerts => alerts.filter(a => a.id !== alertId));
    return this._alerts().length < initialLength;
  }

  /**
   * Clear all acknowledged alerts
   */
  clearAcknowledged(): number {
    const initialLength = this._alerts().length;
    this._alerts.update(alerts => alerts.filter(a => !a.acknowledged));
    return initialLength - this._alerts().length;
  }

  /**
   * Clear alerts older than specified duration
   */
  clearOlderThan(hours: number): number {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const initialLength = this._alerts().length;
    this._alerts.update(alerts => alerts.filter(a => a.timestamp > cutoff));
    return initialLength - this._alerts().length;
  }

  private subscribeToWebSocketEvents(): void {
    // Camera events
    this.wsService.onMessage('camera_event').pipe(takeUntil(this.destroy$)).subscribe(msg => {
      this.handleCameraEvent(msg);
    });

    this.wsService.onMessage('camera_status').pipe(takeUntil(this.destroy$)).subscribe(msg => {
      this.handleCameraStatus(msg);
    });

    // Pet events
    this.wsService.onMessage('pet_geofence').pipe(takeUntil(this.destroy$)).subscribe(msg => {
      this.handlePetGeofence(msg);
    });

    this.wsService.onMessage('pet_device_status').pipe(takeUntil(this.destroy$)).subscribe(msg => {
      this.handlePetDeviceStatus(msg);
    });

    // Emergency events
    this.wsService.onMessage('emergency_sos').pipe(takeUntil(this.destroy$)).subscribe(msg => {
      this.handleEmergencySOS(msg);
    });

    this.wsService.onMessage('emergency_fall').pipe(takeUntil(this.destroy$)).subscribe(msg => {
      this.handleEmergencyFall(msg);
    });

    this.wsService.onMessage('incident_update').pipe(takeUntil(this.destroy$)).subscribe(msg => {
      this.handleIncidentUpdate(msg);
    });
  }

  private handleCameraEvent(msg: WebSocketMessage): void {
    const payload = msg.payload as {
      cameraId: string;
      cameraName: string;
      eventType: string;
      thumbnailUrl?: string;
      clipUrl?: string;
    };

    const typeMap: Record<string, AlertType> = {
      motion: 'motion_detected',
      person: 'person_detected',
      vehicle: 'vehicle_detected',
    };

    this.addAlert({
      source: 'camera',
      type: typeMap[payload.eventType] || 'motion_detected',
      priority: payload.eventType === 'person' ? 'high' : 'medium',
      title: `${payload.eventType.charAt(0).toUpperCase() + payload.eventType.slice(1)} Detected`,
      message: `${payload.cameraName} detected ${payload.eventType}`,
      data: {
        cameraId: payload.cameraId,
        thumbnailUrl: payload.thumbnailUrl,
        clipUrl: payload.clipUrl,
      },
    });
  }

  private handleCameraStatus(msg: WebSocketMessage): void {
    const payload = msg.payload as {
      cameraId: string;
      cameraName: string;
      status: string;
    };

    if (payload.status === 'offline') {
      this.addAlert({
        source: 'camera',
        type: 'camera_offline',
        priority: 'high',
        title: 'Camera Offline',
        message: `${payload.cameraName} has gone offline`,
        data: { cameraId: payload.cameraId },
      });
    }
  }

  private handlePetGeofence(msg: WebSocketMessage): void {
    const payload = msg.payload as {
      petId: string;
      petName: string;
      geofenceName: string;
      eventType: 'enter' | 'exit';
      location: { lat: number; lng: number };
    };

    this.addAlert({
      source: 'pet',
      type: payload.eventType === 'exit' ? 'pet_left_geofence' : 'pet_entered_geofence',
      priority: payload.eventType === 'exit' ? 'high' : 'medium',
      title: payload.eventType === 'exit' ? 'Pet Left Safe Zone' : 'Pet Entered Zone',
      message: `${payload.petName} ${payload.eventType === 'exit' ? 'left' : 'entered'} ${payload.geofenceName}`,
      data: {
        petId: payload.petId,
        location: payload.location,
      },
    });
  }

  private handlePetDeviceStatus(msg: WebSocketMessage): void {
    const payload = msg.payload as {
      petId: string;
      petName: string;
      deviceId: string;
      batteryLevel?: number;
      status: string;
    };

    if (payload.batteryLevel && payload.batteryLevel < 20) {
      this.addAlert({
        source: 'pet',
        type: 'pet_device_low_battery',
        priority: 'medium',
        title: 'Pet Device Low Battery',
        message: `${payload.petName}'s device is at ${payload.batteryLevel}%`,
        data: { petId: payload.petId, deviceId: payload.deviceId },
      });
    }

    if (payload.status === 'offline') {
      this.addAlert({
        source: 'pet',
        type: 'pet_device_offline',
        priority: 'high',
        title: 'Pet Device Offline',
        message: `${payload.petName}'s tracking device is offline`,
        data: { petId: payload.petId, deviceId: payload.deviceId },
      });
    }
  }

  private handleEmergencySOS(msg: WebSocketMessage): void {
    const payload = msg.payload as {
      userId: string;
      userName: string;
      deviceId: string;
      location: { lat: number; lng: number; address?: string };
      incidentId: string;
    };

    this.addAlert({
      source: 'emergency',
      type: 'sos_triggered',
      priority: 'critical',
      title: 'SOS ALERT',
      message: `${payload.userName} has triggered an SOS alert`,
      data: {
        deviceId: payload.deviceId,
        incidentId: payload.incidentId,
        location: payload.location,
      },
    });
  }

  private handleEmergencyFall(msg: WebSocketMessage): void {
    const payload = msg.payload as {
      userId: string;
      userName: string;
      deviceId: string;
      location: { lat: number; lng: number; address?: string };
      incidentId: string;
    };

    this.addAlert({
      source: 'emergency',
      type: 'fall_detected',
      priority: 'critical',
      title: 'FALL DETECTED',
      message: `A fall was detected for ${payload.userName}`,
      data: {
        deviceId: payload.deviceId,
        incidentId: payload.incidentId,
        location: payload.location,
      },
    });
  }

  private handleIncidentUpdate(msg: WebSocketMessage): void {
    const payload = msg.payload as {
      incidentId: string;
      status: string;
      message: string;
    };

    this.addAlert({
      source: 'monitoring',
      type: 'incident_assigned',
      priority: 'high',
      title: 'Incident Update',
      message: payload.message,
      data: { incidentId: payload.incidentId },
    });
  }

  private getDefaultActions(type: AlertType, source: AlertSource): AlertAction[] {
    const actions: AlertAction[] = [
      { id: 'acknowledge', label: 'Acknowledge', type: 'secondary', action: 'acknowledge' },
    ];

    if (source === 'camera') {
      actions.unshift({ id: 'view', label: 'View Camera', icon: 'camera', type: 'primary', action: 'view_camera' });
    }

    if (source === 'pet') {
      actions.unshift({ id: 'locate', label: 'Locate Pet', icon: 'location', type: 'primary', action: 'locate_pet' });
    }

    if (source === 'emergency') {
      actions.unshift({ id: 'respond', label: 'Respond', icon: 'phone', type: 'danger', action: 'respond_emergency' });
    }

    return actions;
  }

  private playCriticalAlertSound(): void {
    try {
      const audio = new Audio('/assets/sounds/critical-alert.mp3');
      audio.volume = 0.7;
      audio.play().catch(() => {
        // Audio autoplay may be blocked
        console.log('Unable to play alert sound');
      });
    } catch {
      console.log('Audio not available');
    }
  }

  private async showBrowserNotification(alert: UnifiedAlert): Promise<void> {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }

    if (Notification.permission === 'granted') {
      new Notification(alert.title, {
        body: alert.message,
        icon: '/assets/icons/alert-icon.png',
        tag: alert.id,
        requireInteraction: alert.priority === 'critical',
      });
    }
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
