import { Injectable } from '@angular/core';
import { RefreshScope } from '@habiti/realtime-protocol';

/**
 * How a LAZY service still gets cleared when the account changes.
 *
 * ── THE PROBLEM THIS SOLVES ───────────────────────────────────────────────
 *
 * Every locally-cached service has to be reset when a different person signs in
 * on the same tab, or their predecessor's data is still sitting in memory —
 * the exact bleed UserStorage was written to prevent. Registration for that has
 * always happened in sync-refreshers.providers.ts, which names every domain
 * service and is therefore EAGER: anything registered there lands in the
 * initial bundle whether or not the user ever opens that feature.
 *
 * That was affordable for four small services. It stopped being affordable at
 * a mind map editor, and it was already costing ~6 kB for attachments,
 * checklists and inspiration — features most sessions never touch.
 *
 * ── HOW IT WORKS ──────────────────────────────────────────────────────────
 *
 * This registry is the only eager part. A lazily-created service calls
 * `register(this, scopes)` from its constructor, which cannot happen before the
 * feature's chunk has loaded — so nothing is pulled forward. One refresher in
 * sync-refreshers.providers.ts imports this file and nothing else.
 *
 * If a feature is never opened, there is no member, nothing was downloaded, and
 * there is nothing to clear. That is correct rather than merely convenient: a
 * service that was never constructed cannot be holding the previous account's
 * anything.
 *
 * Members are held strongly. `providedIn: 'root'` services live for the life of
 * the injector anyway, so a WeakRef would buy nothing but a source of
 * intermittent bugs.
 */
export interface Resettable {
  /** Drop everything held for the previous account and re-read for the current one. */
  reload(): void;
}

interface Member {
  resettable: Resettable;
  /** Scopes that should also trigger a plain refresh. Empty = reset only. */
  scopes: readonly RefreshScope[];
}

@Injectable({ providedIn: 'root' })
export class ResettableRegistry {
  private readonly members = new Map<Resettable, Member>();

  register(resettable: Resettable, scopes: readonly RefreshScope[] = []): void {
    // A Map keyed on the instance, so a service constructed twice in a test
    // does not end up registered twice.
    this.members.set(resettable, { resettable, scopes });
  }

  /** Every member whose scopes intersect the requested set. */
  refresh(scopes: ReadonlySet<RefreshScope>): void {
    for (const member of this.members.values()) {
      if (member.scopes.some(scope => scopes.has(scope))) member.resettable.reload();
    }
  }

  /** The account changed. Everything goes. */
  resetAll(): void {
    for (const member of this.members.values()) member.resettable.reload();
  }
}
