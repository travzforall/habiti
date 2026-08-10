import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { OutboundEvent, RefreshScope } from '../models/realtime.models';

/**
 * A dependency-free meeting point between the data services and the sync layer.
 *
 * WHY THIS EXISTS: SyncService must call FriendsService.refresh(), and
 * FriendsService must announce that it wrote something. If they injected each
 * other, Angular throws a circular-dependency error at bootstrap. This is a
 * leaf with zero injected dependencies, so the graph stays one-way:
 *
 *   SyncService ──▶ Habits / Friends / Challenge / Level / DailyContent
 *                        │
 *                        ▼
 *                     SyncBus  ◀── RealtimeService
 *
 * Same "push, don't import" convention documented in status.service.ts.
 */
@Injectable({ providedIn: 'root' })
export class SyncBus {
  private readonly _outbound = new Subject<OutboundEvent>();
  private readonly _mutations = new Subject<RefreshScope>();

  /** Events to relay to other users. RealtimeService listens. */
  readonly outbound$: Observable<OutboundEvent> = this._outbound.asObservable();

  /** "I just changed something" — opens SyncService's hot window. */
  readonly mutations$: Observable<RefreshScope> = this._mutations.asObservable();

  /**
   * Announce a write that a peer should hear about.
   * Call this only AFTER the write succeeded — never optimistically, or a
   * failed write would send someone off to refetch nothing.
   */
  emit(event: OutboundEvent): void {
    this._outbound.next(event);
  }

  /** Announce a local change so polling goes fast for a while. */
  touched(scope: RefreshScope): void {
    this._mutations.next(scope);
  }
}
