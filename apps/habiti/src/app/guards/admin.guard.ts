import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Roles allowed into /admin. Everything else is redirected to the dashboard. */
const ADMIN_ROLES = new Set(['admin', 'owner', 'superadmin']);

/**
 * Gates the admin area on the user's role.
 *
 * `AuthGuard` only means "signed in", so /admin/challenges — which writes rows
 * every user reads — was reachable by anyone who guessed the URL. `User.role`
 * has been flowing from Xano into the user object since login was written and
 * had no consumer; this is it.
 *
 * WHAT THIS IS NOT: a security boundary. The Baserow token ships in the client
 * bundle, so a determined user can still write those rows directly with curl,
 * and role comes from a response this same client parses. It stops accidents
 * and casual poking, and that is all it can do until writes move behind the
 * Xano proxy. Do not let its presence justify putting anything genuinely
 * sensitive on an admin page.
 */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  const role = (auth.currentUserValue?.role ?? '').trim().toLowerCase();
  if (ADMIN_ROLES.has(role)) return true;

  // Deliberately a redirect and not a 403 page: an unlisted area should not
  // confirm it exists to someone who is not meant to see it.
  router.navigate(['/dashboard']);
  return false;
};

/** Exported for the nav, so an admin link only renders for an admin. */
export function isAdminRole(role: string | undefined | null): boolean {
  return ADMIN_ROLES.has((role ?? '').trim().toLowerCase());
}
