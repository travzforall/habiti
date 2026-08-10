import { Provider } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { SYNC_SESSION, SyncSession } from './lib/sync-session';

/**
 * A controllable session for tests.
 *
 * SYNC_SESSION has no default — a scheduler that guesses who is signed in
 * would poll for a guest or open a socket with nobody's token — so every
 * TestBed that constructs SyncService has to supply one. This is that
 * one-liner, plus a handle to switch accounts mid-test.
 *
 * Behind `@habiti/sync/testing` so test helpers are not reachable from
 * application code by accident.
 */
export interface TestSession extends SyncSession {
  /** Sign in as someone else, or pass null to sign out. */
  signInAs(userId: string | null): void;
}

export function createTestSession(userId: string | null = '1', token = 'test-token'): TestSession {
  const subject = new BehaviorSubject<string | null>(userId);
  return {
    userId$: subject.asObservable() as Observable<string | null>,
    currentUserId: () => subject.value,
    token: () => (subject.value ? token : null),
    signInAs: (next: string | null) => subject.next(next)
  };
}

export function provideTestSession(session: SyncSession = createTestSession()): Provider {
  return { provide: SYNC_SESSION, useValue: session };
}

/** Builds a session from an existing mock auth object, for specs that own one. */
export function sessionFromMockAuth(mock: {
  subject: BehaviorSubject<{ id?: number | string } | null>;
}): SyncSession {
  const idOf = (user: { id?: number | string } | null) =>
    user?.id === undefined || user?.id === null ? null : String(user.id);
  return {
    userId$: mock.subject.pipe(map(idOf)),
    currentUserId: () => idOf(mock.subject.value),
    token: () => 'test-token'
  };
}
