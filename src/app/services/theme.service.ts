import { Injectable, signal } from '@angular/core';

const THEME_KEY = 'habiti-theme';

export type ThemeChoice = 'light' | 'dark' | 'auto';

/**
 * The one place the theme is applied.
 *
 * This logic existed three times before — root.ts:30-40, top-nav.ts:65-74 and
 * footer.ts:39-50 — and the copies had already drifted: `top-nav.toggleTheme()`
 * updated `GameState.theme` and re-applied the attribute but never wrote
 * localStorage, so cycling the theme from the toggle looked like it worked and
 * then reverted on the next reload. Only `setTheme()` persisted.
 *
 * localStorage is the source of truth, NOT `GameState.theme`. GameState looks
 * like the natural home, but habits.ts hardcodes `theme: 'auto'` every time it
 * loads game state from Baserow, so anything stored there is discarded on the
 * next refresh. `habiti-theme` is what root.ts has always read at boot and is
 * the only value that actually survives.
 *
 * `auto` resolves against `prefers-color-scheme` at apply time. Note the app's
 * dark mode is only half-wired: this attribute drives daisyUI, but
 * tailwind.config.js sets no `darkMode` key, so Tailwind's own `dark:` variants
 * follow the OS setting rather than this attribute. Components that must match
 * exactly use `:host-context([data-theme="dark"])`.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _theme = signal<ThemeChoice>(readStored());

  /** The user's choice — 'auto', not the resolved light/dark value. */
  readonly theme = this._theme.asReadonly();

  /** Applies whatever is already stored. Called once, by the app shell. */
  applyStored(): void {
    this.apply(this._theme());
  }

  set(theme: ThemeChoice): void {
    this._theme.set(theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Private browsing, or a full quota. The attribute below still applies,
      // so the choice holds for this session and is simply not remembered.
    }
    this.apply(theme);
  }

  /** light → dark → auto → light. The order the top-nav toggle has always used. */
  cycle(): ThemeChoice {
    const current = this._theme();
    const next: ThemeChoice = current === 'dark' ? 'auto' : current === 'light' ? 'dark' : 'light';
    this.set(next);
    return next;
  }

  /**
   * Applies without persisting — for the wizard's live preview, where the user
   * is still deciding and may yet hit Back or Skip.
   */
  preview(theme: ThemeChoice): void {
    this.apply(theme);
  }

  /** Puts back whatever is actually stored, undoing any preview(). */
  revertPreview(): void {
    this.apply(this._theme());
  }

  private apply(theme: ThemeChoice): void {
    const resolved =
      theme === 'auto'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : theme;

    document.documentElement.setAttribute('data-theme', resolved);
  }
}

function readStored(): ThemeChoice {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    return raw === 'light' || raw === 'dark' || raw === 'auto' ? raw : 'auto';
  } catch {
    return 'auto';
  }
}
