import { Injectable, inject } from '@angular/core';
import { UserStorage } from '@habiti/storage';

/**
 * The small choices a person makes about how a screen looks.
 *
 * Which view of the projects page, which way a list is sorted — things that are
 * nobody's business but this browser's, and that are infuriating when they
 * reset. A reload putting the page back to a view you did not choose is the
 * kind of small rudeness that makes an app feel like it is not listening.
 *
 * ── WHY NOT A TABLE ───────────────────────────────────────────────────────
 *
 * These are per-device by nature: a phone and a desktop want different views
 * of the same data, and syncing them would be a feature nobody asked for that
 * silently changes your screen when you pick up another machine. UserStorage
 * still namespaces them per ACCOUNT, so two people on one browser do not
 * inherit each other's choices.
 *
 * Anything unreadable falls back to the default rather than throwing: a
 * corrupted preference must never be able to stop a page rendering.
 */
@Injectable({ providedIn: 'root' })
export class UiPreferencesService {
  private storage = inject(UserStorage);

  private key(name: string): string {
    return `habiti_pref_${name}`;
  }

  /**
   * Reads a preference, checking it is still one of the allowed values.
   *
   * The check matters: a stored view that a later version removed would
   * otherwise leave a page rendering nothing, and the person has no way to
   * discover why.
   */
  read<T extends string>(name: string, allowed: readonly T[], fallback: T): T {
    try {
      const stored = this.storage.readRaw(this.key(name));
      return stored && (allowed as readonly string[]).includes(stored) ? (stored as T) : fallback;
    } catch {
      return fallback;
    }
  }

  write(name: string, value: string): void {
    try {
      this.storage.writeRaw(this.key(name), value);
    } catch (error) {
      // A full or blocked localStorage must not break the click that set it.
      console.warn('UiPreferencesService: preference not saved.', error);
    }
  }
}
