/**
 * `@habiti/sync` — the one owner of "when do we reload".
 *
 * Adaptive polling, a realtime hint transport, cross-tab coordination, and a
 * registry features plug themselves into. Domain-free by construction: nothing
 * in here names a habit, a challenge or a skill.
 *
 * Three things must be provided by the host app, and all three are tokens
 * rather than injected services so that a different app can answer them
 * differently — the kiosk holds a device credential and has no `currentUser`
 * at all, but it can still answer SYNC_SESSION:
 *
 *   SYNC_SESSION     who is signed in, and the token for the socket
 *   REALTIME_URL     where the relay is; '' means never open a socket
 *   SYNC_REFRESHERS  which domains exist and how each reloads
 *
 * provideSyncRefreshers() is deliberately NOT here. It names every feature in
 * a particular app, so it is that app's composition root, not library code.
 */
export { SyncService, TIMER_PORT } from './lib/sync.service';
export type { SyncTrigger, TimerPort } from './lib/sync.service';
export { SYNC_REFRESHERS } from './lib/sync-refresher';
export type { SyncContext, SyncRefresher } from './lib/sync-refresher';
export { SYNC_SESSION } from './lib/sync-session';
export type { SyncSession } from './lib/sync-session';
export { REALTIME_URL, RealtimeService, WEBSOCKET_FACTORY } from './lib/realtime.service';
export type { RealtimeStatus, WebSocketFactory } from './lib/realtime.service';
export { SyncBus } from './lib/sync-bus';
export { TabBus } from './lib/tab-bus';

/**
 * NO TEST TARGET ON THIS LIBRARY, ON PURPOSE — AND IT IS A DEBT, NOT A DESIGN.
 *
 * SyncService's specs live in apps/habiti because they drive it through
 * provideSyncRefreshers() and this app's eight real domains, which makes them
 * integration tests of that composition rather than of the scheduler. They are
 * genuinely in the right place today and still cover this code: cadence,
 * in-flight collapsing, targeted refresh, the settlements de-duplication, and
 * an empty registry.
 *
 * What is missing is a lib-level spec that pins the three tokens above against
 * FAKE refreshers, so this library can be trusted by an app that is not Habiti.
 * Write it before the second app depends on it.
 */
