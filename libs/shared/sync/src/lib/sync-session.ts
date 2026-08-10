import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * Who is signed in, as far as the sync scheduler is concerned.
 *
 * SyncService needs three things from authentication and nothing else: whether
 * anyone is signed in at all (so it does not poll for a guest), a stream of
 * account changes (so it can reset state and re-sync on a switch), and a token
 * to open the realtime socket with.
 *
 * Taking those as a token rather than injecting AuthService is what lets the
 * scheduler move into a shared library: the admin portal and the kiosk do not
 * resolve a session the way the main app does — the kiosk holds a long-lived
 * device credential and has no `currentUser` at all — but all three can answer
 * these three questions.
 *
 * Same shape of inversion as CURRENT_USER_ID in @habiti/storage and
 * SYNC_REFRESHERS: the library states what it needs; the app says how it is
 * answered.
 */
export interface SyncSession {
  /** Emits the account id on every change, null when signed out. */
  readonly userId$: Observable<string | null>;

  /** The account id right now. Null means signed out — do not sync. */
  currentUserId(): string | null;

  /**
   * The credential the realtime socket authenticates with, or null.
   *
   * Signed in WITH NO TOKEN is a real fault, not a quiet fallback: that window
   * can never publish, so the other side never hears from it. SyncService warns
   * loudly rather than degrading silently.
   */
  token(): string | null;
}

export const SYNC_SESSION = new InjectionToken<SyncSession>('SYNC_SESSION');
