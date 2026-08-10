import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { RefreshScope } from '@habiti/realtime-protocol';

/**
 * What a refresher is told about the pass it is taking part in.
 *
 * `scopes` is the whole requested set, not just the ones this refresher
 * declared. That matters for the one case where a service owns two scopes whose
 * handling differs — see the challenges refresher, which must not fetch
 * settlements twice when runs were already requested.
 */
export interface SyncContext {
  readonly scopes: ReadonlySet<RefreshScope>;
  /** A full pass: reconcile against the server rather than trusting the cache. */
  readonly reconcile: boolean;
}

/**
 * One domain's answer to "reload yourself".
 *
 * SyncService used to name every domain directly: a hardcoded scope list, a
 * chain of `if (wanted.has('friends')) ...` in run(), and another chain in
 * reset(). That made the scheduler depend on every feature in the app, so it
 * could never move into a shared library without dragging habits, challenges,
 * friends, levels, skills, tasks and projects along with it.
 *
 * Now the dependency points the other way: features register themselves and the
 * scheduler knows only this interface. Adding a domain is one provider, not
 * edits in three places — and forgetting one of those three was silent.
 */
export interface SyncRefresher {
  /** The scopes that should cause this refresher to run. */
  readonly scopes: readonly RefreshScope[];

  /**
   * Reload. Return an Observable to be awaited as part of the pass, or nothing
   * for a synchronous re-read.
   */
  refresh(context: SyncContext): Observable<void> | void;

  /** Skip this pass — used to avoid refreshing over a write still in flight. */
  canRun?(): boolean;

  /** Clear state on sign-out or account switch. */
  reset?(): void;

  /** Something is waiting on someone else, so poll fast. Must read signals. */
  hasPending?(): boolean;

  /** Local midnight passed; state frozen at construction is now stale. */
  onDayRollover?(today: string): void;
}

export const SYNC_REFRESHERS = new InjectionToken<readonly SyncRefresher[]>('SYNC_REFRESHERS');
