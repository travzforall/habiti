import { Injectable, signal, computed } from '@angular/core';
import { Subject, Observable, timer, Subscription } from 'rxjs';
import { retry, takeUntil } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface WebSocketMessage<T = unknown> {
  type: WebSocketMessageType;
  channel?: string;
  payload: T;
  timestamp: Date;
  id?: string;
}

export type WebSocketMessageType =
  // Camera events
  | 'camera_event'
  | 'camera_status'
  | 'camera_stream_start'
  | 'camera_stream_stop'
  // Pet events
  | 'pet_location'
  | 'pet_activity'
  | 'pet_geofence'
  | 'pet_device_status'
  // Emergency events
  | 'emergency_sos'
  | 'emergency_fall'
  | 'emergency_location'
  | 'emergency_device_status'
  | 'incident_update'
  | 'incident_assigned'
  // Monitoring events
  | 'operator_status'
  | 'queue_update'
  | 'session_update'
  // System events
  | 'ping'
  | 'pong'
  | 'subscribe'
  | 'unsubscribe'
  | 'error'
  | 'connected'
  | 'disconnected';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  // Connection state
  private ws: WebSocket | null = null;
  private readonly destroy$ = new Subject<void>();
  private reconnectSubscription: Subscription | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  // Reactive signals
  private readonly _connectionStatus = signal<ConnectionStatus>('disconnected');
  private readonly _lastError = signal<string | null>(null);
  private readonly _subscribedChannels = signal<Set<string>>(new Set());

  // Public computed signals
  readonly connectionStatus = this._connectionStatus.asReadonly();
  readonly isConnected = computed(() => this._connectionStatus() === 'connected');
  readonly lastError = this._lastError.asReadonly();
  readonly subscribedChannels = computed(() => Array.from(this._subscribedChannels()));

  // Message subjects by type
  private readonly messageSubjects = new Map<WebSocketMessageType, Subject<WebSocketMessage>>();

  // Configuration
  private readonly config = {
    url: environment.wsUrl || 'wss://ws.jollycares.com',
    reconnectInterval: 5000,
    maxReconnectAttempts: 10,
    pingInterval: 30000,
    connectionTimeout: 10000,
  };

  private reconnectAttempts = 0;
  private authToken: string | null = null;

  constructor() {
    // Initialize message subjects for all types
    this.initializeMessageSubjects();
  }

  private initializeMessageSubjects(): void {
    const types: WebSocketMessageType[] = [
      'camera_event', 'camera_status', 'camera_stream_start', 'camera_stream_stop',
      'pet_location', 'pet_activity', 'pet_geofence', 'pet_device_status',
      'emergency_sos', 'emergency_fall', 'emergency_location', 'emergency_device_status',
      'incident_update', 'incident_assigned',
      'operator_status', 'queue_update', 'session_update',
      'ping', 'pong', 'subscribe', 'unsubscribe', 'error', 'connected', 'disconnected'
    ];

    types.forEach(type => {
      this.messageSubjects.set(type, new Subject<WebSocketMessage>());
    });
  }

  /**
   * Connect to WebSocket server with optional auth token
   */
  connect(token?: string): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      console.log('WebSocket already connected or connecting');
      return;
    }

    this.authToken = token || null;
    this._connectionStatus.set('connecting');
    this._lastError.set(null);

    try {
      const url = token ? `${this.config.url}?token=${token}` : this.config.url;
      this.ws = new WebSocket(url);

      // Connection timeout
      const timeout = setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close();
          this._lastError.set('Connection timeout');
          this.scheduleReconnect();
        }
      }, this.config.connectionTimeout);

      this.ws.onopen = () => {
        clearTimeout(timeout);
        this._connectionStatus.set('connected');
        this.reconnectAttempts = 0;
        this.startPingInterval();
        this.resubscribeChannels();
        console.log('WebSocket connected');
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event);
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this._lastError.set('WebSocket error occurred');
      };

      this.ws.onclose = (event) => {
        clearTimeout(timeout);
        this.stopPingInterval();
        this._connectionStatus.set('disconnected');

        if (!event.wasClean) {
          console.log('WebSocket closed unexpectedly, attempting reconnect...');
          this.scheduleReconnect();
        } else {
          console.log('WebSocket closed cleanly');
        }
      };
    } catch (error) {
      this._lastError.set(`Failed to create WebSocket: ${error}`);
      this._connectionStatus.set('error');
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.reconnectAttempts = this.config.maxReconnectAttempts; // Prevent reconnection
    this.stopReconnectTimer();
    this.stopPingInterval();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this._connectionStatus.set('disconnected');
    this._subscribedChannels.set(new Set());
  }

  /**
   * Send a message through WebSocket
   */
  send<T>(type: WebSocketMessageType, payload: T, channel?: string): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, cannot send message');
      return false;
    }

    const message: WebSocketMessage<T> = {
      type,
      channel,
      payload,
      timestamp: new Date(),
      id: this.generateMessageId(),
    };

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
      return false;
    }
  }

  /**
   * Subscribe to a channel for receiving messages
   */
  subscribeToChannel(channel: string): void {
    const channels = this._subscribedChannels();
    if (channels.has(channel)) {
      return;
    }

    channels.add(channel);
    this._subscribedChannels.set(new Set(channels));

    if (this.isConnected()) {
      this.send('subscribe', { channel });
    }
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribeFromChannel(channel: string): void {
    const channels = this._subscribedChannels();
    if (!channels.has(channel)) {
      return;
    }

    channels.delete(channel);
    this._subscribedChannels.set(new Set(channels));

    if (this.isConnected()) {
      this.send('unsubscribe', { channel });
    }
  }

  /**
   * Get observable for specific message type
   */
  onMessage<T = unknown>(type: WebSocketMessageType): Observable<WebSocketMessage<T>> {
    const subject = this.messageSubjects.get(type);
    if (!subject) {
      throw new Error(`Unknown message type: ${type}`);
    }
    return subject.asObservable() as Observable<WebSocketMessage<T>>;
  }

  /**
   * Get observable for all messages on a specific channel
   */
  onChannel<T = unknown>(channel: string): Observable<WebSocketMessage<T>> {
    const channelSubject = new Subject<WebSocketMessage<T>>();

    // Subscribe to all message types and filter by channel
    this.messageSubjects.forEach((subject) => {
      subject.pipe(takeUntil(this.destroy$)).subscribe((message) => {
        if (message.channel === channel) {
          channelSubject.next(message as WebSocketMessage<T>);
        }
      });
    });

    return channelSubject.asObservable();
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      message.timestamp = new Date(message.timestamp);

      // Handle ping/pong
      if (message.type === 'ping') {
        this.send('pong', {});
        return;
      }

      // Dispatch to appropriate subject
      const subject = this.messageSubjects.get(message.type);
      if (subject) {
        subject.next(message);
      } else {
        console.warn('Received unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      this._connectionStatus.set('error');
      this._lastError.set('Unable to reconnect after maximum attempts');
      return;
    }

    this.reconnectAttempts++;
    this._connectionStatus.set('reconnecting');

    const delay = this.config.reconnectInterval * Math.min(this.reconnectAttempts, 5);
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

    this.stopReconnectTimer();
    this.reconnectSubscription = timer(delay).subscribe(() => {
      this.connect(this.authToken || undefined);
    });
  }

  private stopReconnectTimer(): void {
    if (this.reconnectSubscription) {
      this.reconnectSubscription.unsubscribe();
      this.reconnectSubscription = null;
    }
  }

  private startPingInterval(): void {
    this.stopPingInterval();
    this.pingInterval = setInterval(() => {
      this.send('ping', {});
    }, this.config.pingInterval);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private resubscribeChannels(): void {
    const channels = this._subscribedChannels();
    channels.forEach(channel => {
      this.send('subscribe', { channel });
    });
  }

  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up on service destroy
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.disconnect();
    this.messageSubjects.forEach(subject => subject.complete());
  }
}
