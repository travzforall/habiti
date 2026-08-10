/**
 * The public surface of `@habiti/sync`.
 *
 * The scheduler, its registry contract, and the two buses it coordinates
 * through. All of it is domain-free — that is the property the refresher
 * inversion bought, and this barrel is where it gets stated.
 *
 * provideSyncRefreshers() is NOT exported here on purpose. It names every
 * feature in this app, so it is the composition root, not part of the library:
 * a different app registers a different set. Import it from
 * ./sync-refreshers.providers.
 */
export { SyncService, TIMER_PORT } from './sync.service';
export type { SyncTrigger, TimerPort } from './sync.service';
export { SYNC_REFRESHERS } from './sync-refresher';
export type { SyncContext, SyncRefresher } from './sync-refresher';
export { SyncBus } from './sync-bus';
export { TabBus } from './tab-bus';
