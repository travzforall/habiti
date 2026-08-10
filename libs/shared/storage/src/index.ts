/**
 * `@habiti/storage` — localStorage namespaced per account.
 *
 * Depends on @angular/core and nothing else. It needs to know who is signed in,
 * and takes that as a CURRENT_USER_ID function rather than injecting an auth
 * service, so it does not care how a given app authenticates. That is what lets
 * the kiosk — which has a device credential, not a session — reuse it.
 */
export { CURRENT_USER_ID, UserStorage } from './lib/user-storage';
