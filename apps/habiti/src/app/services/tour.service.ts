import { Injectable, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { OnboardingService } from './onboarding.service';
import { pageTipFor } from '../config/page-tips';

/**
 * One entry in a step's target chain.
 *
 * An ordered list with per-entry media queries, rather than a
 * `{ desktop, mobile }` pair, because this app's breakpoints are not uniform:
 * the top-bar stats cluster is `hidden xl:flex` (1280px), the sidebar is
 * `hidden lg:block` (1024px), the bottom nav is `lg:hidden`. A single `lg`
 * switch would silently mis-target everything between 1024 and 1280.
 */
export interface TourTarget {
  selector: string;
  /** Omit to mean "always applicable". */
  media?: string;
}

export interface TourStep {
  /** Stable — persisted in guide_steps_seen. Never renumber. */
  id: string;
  title: string;
  /** The tip itself. Kept under ~200 chars; the spec enforces it. */
  body: string;
  /** Navigate here first. Omit to stay on the current route. */
  route?: string;
  /** Resolved in order; the first media match with a live element wins. */
  target?: TourTarget[];
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  /** Extra spotlight padding, px. */
  padding?: number;
  /** How long to wait for the element before giving up. */
  waitMs?: number;
  /** What to do if it never appears. Default 'center'. */
  onMissing?: 'skip' | 'center';
  /** Let clicks reach the target — drops the blocker and the focus trap. */
  interactive?: boolean;
  /** Drop the step entirely when this query does not match at start(). */
  media?: string;
}

const DEFAULT_WAIT_MS = 3000;
const DEFAULT_PADDING = 8;

/** How long to keep polling per frame before declaring a target missing. */
function matchesMedia(query: string | undefined): boolean {
  if (!query) return true;
  return window.matchMedia(query).matches;
}

/**
 * Drives the interactive app guide.
 *
 * Owns navigation, waiting and measurement; TourOverlayComponent owns painting
 * and input. That split is what lets this be unit-tested with `provideRouter`
 * and a synthetic DOM, with no component fixture.
 */
@Injectable({ providedIn: 'root' })
export class TourService {
  private router = inject(Router);
  private onboarding = inject(OnboardingService);

  private readonly _steps = signal<TourStep[]>([]);
  private readonly _index = signal(0);
  private readonly _active = signal(false);
  private readonly _resolving = signal(false);
  private readonly _anchor = signal<DOMRect | null>(null);

  /** Bumped on every resolve so the overlay knows to re-measure its tooltip. */
  private readonly _revision = signal(0);

  readonly steps = this._steps.asReadonly();
  readonly index = this._index.asReadonly();
  readonly active = this._active.asReadonly();
  readonly resolving = this._resolving.asReadonly();
  readonly anchor = this._anchor.asReadonly();
  readonly revision = this._revision.asReadonly();

  readonly step = computed<TourStep | null>(() => this._steps()[this._index()] ?? null);

  readonly progress = computed(() => ({
    current: this._index() + 1,
    total: this._steps().length
  }));

  readonly isFirst = computed(() => this._index() === 0);
  readonly isLast = computed(() => this._index() === this._steps().length - 1);

  /** Set while a one-off page tip is showing, so it can be styled differently. */
  private readonly _isPageTip = signal(false);
  readonly isPageTip = this._isPageTip.asReadonly();

  private currentToken = 0;

  constructor() {
    /**
     * If the user navigates away mid-step — the browser Back button, or a stray
     * click during an `interactive` step — re-resolve where we are rather than
     * forcing them back. Fighting someone's Back button is worse than showing
     * the tip centred.
     */
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      if (!this._active()) {
        this.maybeShowPageTip();
        return;
      }

      /**
       * Ignore navigation the tour itself started.
       *
       * Without this, advancing to a step with a different route fires
       * NavigationEnd while `step()` is still the PREVIOUS step — whose route
       * no longer matches — so this handler treated the tour's own move as the
       * user wandering off, bumped the token (cancelling the in-flight step)
       * and re-resolved the previous step against the new page. The visible
       * symptom was the tour sticking on step 5's tip while sitting on step
       * 6's page. This handler is only for user-initiated navigation, which by
       * definition happens while we are idle.
       */
      if (this._resolving()) return;

      const step = this.step();
      if (!step?.route) return;
      if (this.stripQuery(this.router.url) === step.route) return;

      void this.resolve(this._index(), { navigate: false });
    });
  }

  /**
   * Shows this route's first-visit tip, if it has one and has not been seen.
   *
   * Suppressed while the wizard is open — stacking a tip on top of the setup
   * dialog would be two modals deep on someone's first thirty seconds — and
   * while a main tour is running, since that already covers the ground.
   */
  private maybeShowPageTip(): void {
    if (this.onboarding.wizardOpen()) return;
    if (this.onboarding.shouldOpen()) return;

    const tip = pageTipFor(this.router.url);
    if (!tip) return;
    if (this.onboarding.hasSeenPageTip(tip.id)) return;

    this.showPageTip(tip);
  }

  /** Starts a tour. Steps whose `media` does not match are dropped up front. */
  start(steps: TourStep[], fromIndex = 0): void {
    const applicable = steps.filter(s => matchesMedia(s.media));
    if (applicable.length === 0) return;

    this._isPageTip.set(false);
    this._steps.set(applicable);
    this._active.set(true);

    const start = Math.min(Math.max(fromIndex, 0), applicable.length - 1);
    // Set eagerly as well as in resolve(): resuming at step 5 would otherwise
    // render step 1's copy until the first await settles.
    this._index.set(start);
    void this.resolve(start);
  }

  /**
   * Shows a single, un-anchored tip — the per-page first-visit variant.
   *
   * Deliberately does not touch guide progress: seeing a page tip is not
   * progress through the main tour.
   */
  showPageTip(step: TourStep): void {
    this._isPageTip.set(true);
    this._steps.set([step]);
    this._index.set(0);
    this._anchor.set(null);
    this._active.set(true);
    this._resolving.set(false);
    this._revision.update(r => r + 1);
  }

  next(): void {
    if (!this._active()) return;
    if (this.isLast()) {
      this.exit('finished');
      return;
    }
    void this.resolve(this._index() + 1);
  }

  prev(): void {
    if (!this._active() || this.isFirst()) return;
    void this.resolve(this._index() - 1);
  }

  goTo(index: number): void {
    if (!this._active()) return;
    void this.resolve(index);
  }

  exit(reason: 'finished' | 'skipped' | 'interrupted'): void {
    if (!this._active()) return;

    const wasPageTip = this._isPageTip();
    const step = this.step();

    this.currentToken++;
    this._active.set(false);
    this._anchor.set(null);
    this._resolving.set(false);
    this._steps.set([]);
    this._index.set(0);
    this._isPageTip.set(false);

    if (wasPageTip) {
      if (step && reason !== 'interrupted') this.onboarding.markPageTipSeen(step.id);
      return;
    }

    // 'interrupted' means the router refused a navigation (an AuthGuard bounce,
    // usually). Recording that as skipped would silently retire the tour for a
    // reason that has nothing to do with the user's intent.
    if (reason === 'interrupted') return;

    this.onboarding.finishGuide(reason);
  }

  /** Re-reads the current target's box. Called on scroll and resize. */
  remeasure(): void {
    const step = this.step();
    if (!step || !this._active()) return;

    const element = this.findTarget(step);
    this._anchor.set(element ? this.inflate(element, step.padding ?? DEFAULT_PADDING) : null);
  }

  /**
   * A breakpoint change may mean a different TourTarget now wins, so the whole
   * selector chain has to be resolved again rather than just re-measured.
   */
  onBreakpointChange(): void {
    if (!this._active()) return;
    void this.resolve(this._index(), { navigate: false });
  }

  // ---------------------------------------------------------------------------

  private async resolve(index: number, options: { navigate?: boolean } = {}): Promise<void> {
    const steps = this._steps();
    if (index < 0 || index >= steps.length) return;

    const step = steps[index];
    // Guards against two resolves racing — a fast Next while a lazy chunk for
    // the previous step is still downloading.
    const token = ++this.currentToken;

    this._resolving.set(true);

    /**
     * Drop the old anchor immediately.
     *
     * Otherwise the previous step's rect stays painted while this one
     * navigates, so the spotlight sits over whatever now happens to occupy
     * those coordinates on the NEW page — a ring around unrelated content,
     * captioned with the previous step's tip. The overlay renders a plain dim
     * while the anchor is null, which is the honest "working on it" state.
     */
    this._anchor.set(null);

    if (options.navigate !== false && step.route && this.stripQuery(this.router.url) !== step.route) {
      const ok = await this.router.navigateByUrl(step.route).catch(() => false);
      if (token !== this.currentToken) return;
      if (!ok) {
        this.exit('interrupted');
        return;
      }
    }

    const element = await this.waitForTarget(step, token);
    if (token !== this.currentToken) return;

    if (!element && step.onMissing === 'skip') {
      // Nothing to point at — e.g. no habit card for someone who skipped
      // starter habits. Move on silently rather than showing a tip about a
      // thing that is not on screen.
      this._resolving.set(false);
      if (index >= steps.length - 1) {
        this.exit('finished');
      } else {
        void this.resolve(index + 1);
      }
      return;
    }

    if (element) {
      element.scrollIntoView({
        block: 'center',
        inline: 'nearest',
        behavior: this.prefersReducedMotion() ? 'auto' : 'smooth'
      });
      await this.afterScroll();
      if (token !== this.currentToken) return;
    }

    const live = element ? this.findTarget(step) ?? element : null;

    this._index.set(index);
    this._anchor.set(live ? this.inflate(live, step.padding ?? DEFAULT_PADDING) : null);
    this._resolving.set(false);
    this._revision.update(r => r + 1);

    if (!this._isPageTip()) this.onboarding.recordGuideProgress(index, step.id);
  }

  /** The first selector whose media matches AND which is actually on screen. */
  private findTarget(step: TourStep): HTMLElement | null {
    for (const target of step.target ?? []) {
      if (!matchesMedia(target.media)) continue;

      const element = document.querySelector<HTMLElement>(target.selector);
      if (!element) continue;

      // A zero-sized box means it is hidden (`lg:hidden`, or still a skeleton),
      // which is not a valid thing to spotlight.
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return element;
    }
    return null;
  }

  /**
   * Polls on animation frames until the target appears.
   *
   * rAF rather than a MutationObserver: simpler, and naturally aligned with
   * paint. The wait is genuinely necessary — these routes are all
   * `loadComponent` lazy, and the dashboard renders a skeleton for a few
   * hundred ms after that, so the real element does not exist yet.
   */
  private waitForTarget(step: TourStep, token: number): Promise<HTMLElement | null> {
    if (!step.target?.length) return Promise.resolve(null);

    // The overwhelmingly common case: already rendered, no waiting needed.
    const immediate = this.findTarget(step);
    if (immediate) return Promise.resolve(immediate);

    return new Promise(resolve => {
      let frame = 0;
      let settled = false;

      const finish = (element: HTMLElement | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        // Cancel rather than letting a stray callback run: an orphaned rAF
        // leaves a pending task that trips fakeAsync's queue check.
        if (frame) cancelAnimationFrame(frame);
        resolve(element);
      };

      /**
       * The deadline is a real timer rather than a `performance.now()`
       * comparison inside the poll. `performance.now()` is wall-clock, so under
       * a virtual clock the comparison never becomes true and the rAF loop
       * spins forever.
       */
      const timer = setTimeout(() => finish(null), step.waitMs ?? DEFAULT_WAIT_MS);

      const poll = () => {
        if (settled) return;
        if (token !== this.currentToken) return finish(null);

        const found = this.findTarget(step);
        if (found) return finish(found);

        frame = requestAnimationFrame(poll);
      };

      frame = requestAnimationFrame(poll);
    });
  }

  /**
   * Waits for a smooth scroll to settle.
   *
   * `scrollend` is the right event but is recent on iOS Safari, so a timeout
   * carries it. Whichever lands first wins.
   */
  private afterScroll(): Promise<void> {
    if (this.prefersReducedMotion()) return Promise.resolve();

    return new Promise(resolve => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        window.removeEventListener('scrollend', finish);
        resolve();
      };

      window.addEventListener('scrollend', finish, { once: true });
      setTimeout(finish, 400);
    });
  }

  private inflate(element: HTMLElement, padding: number): DOMRect {
    const r = element.getBoundingClientRect();
    return new DOMRect(
      r.left - padding,
      r.top - padding,
      r.width + padding * 2,
      r.height + padding * 2
    );
  }

  private prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private stripQuery(url: string): string {
    return url.split('?')[0].split('#')[0];
  }
}
