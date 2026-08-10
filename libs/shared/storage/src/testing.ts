import { Provider } from '@angular/core';
import { CURRENT_USER_ID } from './lib/user-storage';

/**
 * Provides a signed-in account for tests.
 *
 * CURRENT_USER_ID has no default on purpose — an app that forgets to provide it
 * would namespace every account under `::guest`, which is exactly the data
 * bleed UserStorage exists to prevent. That strictness is correct in production
 * and merely tedious in a spec, so this is the one-liner for specs.
 *
 * A separate entry point (`@habiti/storage/testing`) so test helpers are not
 * reachable from application code by accident.
 */
export function provideTestUserId(id: string | null = '6'): Provider {
  return { provide: CURRENT_USER_ID, useValue: () => id };
}
