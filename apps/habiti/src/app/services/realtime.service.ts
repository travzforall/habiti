import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { SyncBus } from '@habiti/sync';
import {
  ClientFrame,
  OutboundEvent,
  RELAY_PROTOCOL_VERSION,
  RelayEnvelope,
  ServerFrame,
  isRelayEnvelope
} from '@habiti/realtime-protocol';

/** Injected so tests can supply a fake socket. */
export type WebSocketFactory = (url: string) => WebSocket;

export const WEBSOCKET_FACTORY = new InjectionToken<WebSocketFactory>('WEBSOCKET_FACTORY', {
  providedIn: 'root',
  factory: () => (url: string) => new WebSocket(url)
});

export type RealtimeStatus =
  | 'disabled' // no url configured — the day-one state
  | 'idle' // no token yet (signed out)
  | 'connecting'
  | 'live'
  | 'reconnecting'
  | 'unavailable'; // circuit open; polling carries the app

const MAX_BACKOFF_MS = 30_000;
const FAILURES_BEFORE_GIVING_UP = 5;
const QUIET_RETRY_MS = 60_000;
const MAX_QUEUED = 20;

/**
 * The realtime connection.
 *
 * Talks to realtime-server/ and nothing else. The relay carries refresh HINTS,
 * never row data — a dropped hint degrades to SyncService's adaptive polling,
 * which is what lets the relay stay a single instance.
 *
 * DAY-ONE BEHAVIOUR: with no url configured this never constructs a WebSocket
 * at all. That is not laziness — the browser's own "WebSocket connection
 * failed" message comes from the network stack, is not routed through
 * console.error, and cannot be suppressed by application code. Not opening the
 * socket is the only way to keep the console clean before the relay exists.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private bus = inject(SyncBus);
  private createSocket = inject(WEBSOCKET_FACTORY);

  private readonly url = environment.realtime?.url ?? '';
  private readonly _status = signal<RealtimeStatus>(this.url ? 'idle' : 'disabled');
  private readonly _lastConnectedAt = signal<Date | null>(null);

  readonly status = this._status.asReadonly();
  readonly isLive = computed(() => this._status() === 'live');
  readonly lastConnectedAt = this._lastConnectedAt.asReadonly();

  private readonly _events = new Subject<RelayEnvelope>();
  readonly events$: Observable<RelayEnvelope> = this._events.asObservable();

  private socket: WebSocket | null = null;
  private token: string | null = null;
  private failures = 0;
  private retryHandle: number | null = null;
  private queue: OutboundEvent[] = [];
  private closedByUs = false;

  constructor() {
    // Anything a service wants a peer to know about goes out here.
    this.bus.outbound$.subscribe(event => this.publish(event));
  }

  connect(token: string): void {
    if (!this.url) return;
    if (this.token === token && (this._status() === 'live' || this._status() === 'connecting')) {
      return;
    }

    this.token = token;
    this.closedByUs = false;
    this.failures = 0;
    this.open();
  }

  disconnect(): void {
    this.closedByUs = true;
    this.token = null;
    this.clearRetry();
    this.queue = [];
    this.socket?.close(1000, 'signed out');
    this.socket = null;
    this._status.set(this.url ? 'idle' : 'disabled');
  }

  /**
   * Sends a hint. Returns false when it could not go out — which is never an
   * error path: the Baserow write already succeeded, only the nudge was lost,
   * and the peer's next poll covers it.
   */
  publish(event: OutboundEvent): boolean {
    if (!this.url || this.closedByUs) return false;

    if (this._status() !== 'live' || !this.socket) {
      if (this._status() === 'connecting' && this.queue.length < MAX_QUEUED) {
        this.queue.push(event);
      }
      return false;
    }

    return this.send({ v: RELAY_PROTOCOL_VERSION, kind: 'publish', event });
  }

  /** Re-arm after the circuit opened — called on refocus and on regaining network. */
  nudge(): void {
    if (!this.url || this.closedByUs || !this.token) return;
    if (this._status() === 'live' || this._status() === 'connecting') return;
    this.failures = 0;
    this.open();
  }

  private open(): void {
    if (!this.url || !this.token) return;

    this.clearRetry();
    this._status.set(this.failures > 0 ? 'reconnecting' : 'connecting');

    let socket: WebSocket;
    try {
      socket = this.createSocket(this.url);
    } catch {
      this.scheduleRetry();
      return;
    }

    this.socket = socket;

    socket.onopen = () => {
      // Token travels in a frame, never the URL — a query string lands in
      // every proxy and CDN access log, and a JWT in a log file is a session
      // compromise.
      this.send({ v: RELAY_PROTOCOL_VERSION, kind: 'hello', token: this.token! });
    };

    socket.onmessage = event => this.receive(event.data);

    socket.onclose = () => {
      this.socket = null;
      if (this.closedByUs) return;
      this.failures++;
      this.scheduleRetry();
    };

    // onerror always precedes onclose; letting close drive the retry avoids
    // double-counting a single failure.
    socket.onerror = () => {};
  }

  private receive(raw: unknown): void {
    let frame: ServerFrame;
    try {
      frame = JSON.parse(String(raw)) as ServerFrame;
    } catch {
      return;
    }

    switch (frame?.kind) {
      case 'ready':
        // One line per successful connect. A window that pushes nothing looks
        // identical to one that is working, so "did this window even connect?"
        // needs an answer that does not involve reading server logs.
        console.info(`Realtime: live as user ${frame.userId}.`);
        this.failures = 0;
        this._status.set('live');
        this._lastConnectedAt.set(new Date());
        this.flushQueue();
        break;

      case 'event':
        if (isRelayEnvelope(frame.envelope)) {
          // Outside production, say what arrived. A push that silently does
          // nothing and a push that never arrived look identical from the UI,
          // and that difference is the whole debugging question.
          if (!environment.production) {
            console.info(
              `Realtime: received ${frame.envelope.kind}`,
              frame.envelope.hint?.scope ?? []
            );
          }
          this._events.next(frame.envelope);
        }
        break;

      case 'bye':
        // A planned restart. Normal backoff, not a failure.
        this.socket?.close(1000, 'server said bye');
        break;

      case 'error':
        if (frame.code === 'unauthorized') {
          this.closedByUs = true;
          this._status.set('idle');
          this.socket?.close(1000, 'unauthorized');
        }
        break;
    }
  }

  private flushQueue(): void {
    const pending = this.queue;
    this.queue = [];
    for (const event of pending) this.publish(event);
  }

  private send(frame: ClientFrame): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
    try {
      this.socket.send(JSON.stringify(frame));
      return true;
    } catch {
      return false;
    }
  }

  private scheduleRetry(): void {
    if (this.closedByUs || !this.token) return;

    if (this.failures >= FAILURES_BEFORE_GIVING_UP) {
      // Circuit open. Exactly one info line, ever — never warn or error, since
      // polling is carrying the app perfectly well without this.
      if (this._status() !== 'unavailable') {
        console.info('Realtime unavailable; updates will arrive by polling.');
      }
      this._status.set('unavailable');
      this.retryHandle = window.setTimeout(() => this.open(), QUIET_RETRY_MS);
      return;
    }

    this._status.set('reconnecting');
    // Full jitter: without it, every client reconnects in lockstep after an
    // outage and stampedes the relay.
    const ceiling = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** this.failures);
    const delay = Math.random() * ceiling;
    this.retryHandle = window.setTimeout(() => this.open(), delay);
  }

  private clearRetry(): void {
    if (this.retryHandle !== null) {
      window.clearTimeout(this.retryHandle);
      this.retryHandle = null;
    }
  }
}
