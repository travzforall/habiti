/**
 * The surface `@habiti/sync` will expose once it is a library.
 *
 * The scheduler, its registry contract, and the two buses it coordinates
 * through. All domain-free already — that is what the refresher inversion
 * bought, and this barrel is where it gets stated.
 *
 * STILL IN THE APP, because two dependencies have to be inverted first:
 *
 *   AuthService      SyncService needs the current account and its token, to
 *                    reset on a switch and to open the socket. Same shape of
 *                    problem UserStorage had, and the same fix: a token
 *                    describing what it needs, not the service that answers it.
 *   RealtimeService  belongs in the library — it is the transport — but reads
 *                    environment.realtime.url directly, so it needs a
 *                    REALTIME_URL token before it can move.
 *
 * sync.service.spec.ts also has to split: the part that drives cadence and
 * scopes belongs to the library, the part that asserts provideSyncRefreshers()
 * wires up this app's eight domains belongs here.
 *
 * provideSyncRefreshers() will NOT move either way — it names every feature in
 * this app, so it is the composition root by definition.
 */
export { SyncService, TIMER_PORT } from './sync.service';
export type { SyncTrigger, TimerPort } from './sync.service';
export { SYNC_REFRESHERS } from './sync-refresher';
export type { SyncContext, SyncRefresher } from './sync-refresher';
export { SyncBus } from './sync-bus';
export { TabBus } from './tab-bus';
