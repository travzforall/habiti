import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';

/**
 * localStorage, namespaced per account.
 *
 * Every key in this app was global: `habiti_standalone_tasks`, `habiti_projects`,
 * `habiti-habits`, and so on. Sign out, sign in as someone else on the same
 * browser, and you were looking at the previous person's tasks, projects and
 * habits — with no indication anything was wrong. On a shared machine that is a
 * privacy problem, not just a confusing one.
 *
 * Keys become `<name>::<userId>`. Signed out uses `::guest`, so anything typed
 * before signing in is kept but never mixed into a real account.
 */
@Injectable({ providedIn: 'root' })
export class UserStorage {
  private auth = inject(AuthService);

  /** Keys already migrated this session, so the copy runs at most once each. */
  private migrated = new Set<string>();

  private userId(): string {
    const id = this.auth.currentUserValue?.id;
    return id !== undefined && id !== null ? String(id) : 'guest';
  }

  /** The namespaced key for the signed-in account. */
  key(name: string): string {
    return `${name}::${this.userId()}`;
  }

  read<T>(name: string, fallback: T): T {
    this.migrateLegacy(name);
    try {
      const raw = localStorage.getItem(this.key(name));
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  }

  write(name: string, value: unknown): void {
    try {
      localStorage.setItem(this.key(name), JSON.stringify(value));
    } catch {
      // Quota or private-mode failures must not break the caller's flow.
    }
  }

  remove(name: string): void {
    try {
      localStorage.removeItem(this.key(name));
    } catch {
      /* nothing to do */
    }
  }

  /** Raw string access, for values that are not JSON. */
  readRaw(name: string): string | null {
    this.migrateLegacy(name);
    try {
      return localStorage.getItem(this.key(name));
    } catch {
      return null;
    }
  }

  writeRaw(name: string, value: string): void {
    try {
      localStorage.setItem(this.key(name), value);
    } catch {
      /* nothing to do */
    }
  }

  /**
   * Adopts pre-namespacing data for the first account that asks for it.
   *
   * There is no record of who the global data belonged to, so the first
   * signed-in user is the only available guess — and losing someone's habit
   * history to a refactor is worse than one imperfect adoption. The legacy key
   * is REMOVED afterwards so the next account to sign in cannot inherit it too,
   * which is the exact bleed this class exists to stop.
   *
   * Guests never adopt: a signed-out visitor must not absorb a real account's
   * data just by opening the app.
   */
  private migrateLegacy(name: string): void {
    if (this.migrated.has(name)) return;
    this.migrated.add(name);

    if (this.userId() === 'guest') return;

    try {
      const legacy = localStorage.getItem(name);
      if (legacy === null) return;

      const scoped = this.key(name);
      if (localStorage.getItem(scoped) === null) {
        localStorage.setItem(scoped, legacy);
      }
      localStorage.removeItem(name);
    } catch {
      /* nothing to do */
    }
  }

  /**
   * Forgets migration bookkeeping. Called on account switch so the next user
   * re-evaluates each key against their own namespace.
   */
  resetMigrationState(): void {
    this.migrated.clear();
  }
}
