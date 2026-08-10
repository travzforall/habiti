import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * Attaches the right credential to each outbound request, and reacts to a
 * rejected one.
 *
 * The app talks to two backends with two different auth schemes, which is why
 * this has to discriminate by URL rather than blanket-adding a header:
 *
 *   Xano    → `Bearer <jwt>`   — per-user, from login
 *   Baserow → `Token <static>` — shared, already in the bundle
 *
 * Sending the Xano JWT to Baserow would leak a user credential to a third
 * party, so the match is on the configured host, not a substring guess.
 *
 * Baserow requests are left alone: BaserowService sets its own header, and it
 * is the seam that moves behind a server-side proxy in Phase 6. Centralizing
 * it here would just have to be undone.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  if (isXanoRequest(req.url)) {
    const token = readToken();

    // Login and signup have no token yet, and sending an empty header on them
    // makes some gateways reject the request outright.
    if (token && !isPublicXanoEndpoint(req.url)) {
      req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
    }
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // A rejected Xano credential means the session is over. Baserow 401s are
      // a configuration problem, not a session problem, so they pass through.
      if (error.status === 401 && isXanoRequest(req.url) && !isPublicXanoEndpoint(req.url)) {
        clearSession();
        router.navigate(['/login'], { queryParams: { expired: 'true' } });
      }
      return throwError(() => error);
    })
  );
};

function isXanoRequest(url: string): boolean {
  const base = environment.xano?.apiUrl;
  return !!base && url.startsWith(base);
}

/** Endpoints that must work without a token. */
function isPublicXanoEndpoint(url: string): boolean {
  const auth = environment.xano?.endpoints?.auth;
  if (!auth) return false;

  return [auth.login, auth.register, auth.forgotPassword, auth.resetPassword]
    .filter(Boolean)
    .some(path => url.includes(path as string));
}

function readToken(): string | null {
  try {
    // Matches AuthService: localStorage when "remember me", sessionStorage otherwise.
    return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
  } catch {
    return null;
  }
}

function clearSession(): void {
  try {
    for (const key of ['auth_token', 'refresh_token', 'current_user']) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
  } catch {
    // Storage unavailable; the redirect still happens.
  }
}
