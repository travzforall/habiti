import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TourService } from '../../services/tour.service';
import {
  PlacementResult,
  placeAnchored,
  placeCentered,
  safeAreaForWidth
} from '@habiti/util';

/** Matches Tailwind's `lg`, which is where the whole shell switches layout. */
const LG_QUERY = '(min-width: 1024px)';

/**
 * The spotlight and the tip card.
 *
 * Mounted once in the app shell, beside <app-toast>. It MUST stay outside the
 * glass panel in root.html — see the note there: `backdrop-filter` makes an
 * element a containing block for `position: fixed` descendants, which has
 * already broken every modal in this app once. For the same reason the
 * spotlight itself uses `box-shadow` and no blur.
 *
 * Spotlight technique: one absolutely-positioned element carrying a
 * 9999px-spread box-shadow, so the dim, the hole and the ring are a single
 * element whose four numbers CSS can transition for free. An SVG mask would
 * need its <rect> attributes animated by hand, and four scrim panels cannot do
 * rounded corners.
 *
 * The catch, and why the blocker div exists: a box-shadow captures no pointer
 * events, so on its own EVERYTHING stays clickable, not just the highlighted
 * element. A separate transparent blocker eats those clicks — and simply not
 * rendering it is how `interactive: true` steps let the user reach the real
 * control underneath.
 */
@Component({
  selector: 'app-tour-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tour-overlay.component.html',
  styleUrl: './tour-overlay.component.scss'
})
export class TourOverlayComponent {
  private tour = inject(TourService);

  @ViewChild('card') private cardRef?: ElementRef<HTMLDivElement>;

  protected readonly active = this.tour.active;
  protected readonly step = this.tour.step;
  protected readonly resolving = this.tour.resolving;
  protected readonly anchor = this.tour.anchor;
  protected readonly progress = this.tour.progress;
  protected readonly isFirst = this.tour.isFirst;
  protected readonly isLast = this.tour.isLast;
  protected readonly isPageTip = this.tour.isPageTip;

  /** Where the tip card sits. Null until it has been measured. */
  protected readonly position = signal<PlacementResult | null>(null);

  protected readonly blockerVisible = computed(() => this.active() && !this.step()?.interactive);

  protected readonly spotlight = computed(() => {
    const rect = this.anchor();
    if (!rect || !this.active()) return null;
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  });

  protected readonly announcement = computed(() => {
    const step = this.step();
    if (!step) return '';
    if (this.isPageTip()) return step.title;
    const { current, total } = this.progress();
    return `Step ${current} of ${total}: ${step.title}`;
  });

  private previouslyFocused: HTMLElement | null = null;
  private rafHandle: number | null = null;
  private readonly breakpoint = window.matchMedia(LG_QUERY);

  constructor() {
    // Re-place whenever the step, the anchor, or the resolve revision changes.
    effect(() => {
      this.tour.revision();
      this.anchor();
      if (!this.active()) {
        this.position.set(null);
        return;
      }
      // Two-pass: the card renders hidden, we measure it, then reveal it in
      // place. Positioning before measuring would flash it at the wrong spot.
      queueMicrotask(() => requestAnimationFrame(() => this.place()));
    });

    // Remember what had focus so it can be handed back on exit.
    effect(() => {
      if (this.active()) {
        this.previouslyFocused ??= document.activeElement as HTMLElement | null;
        queueMicrotask(() => this.cardRef?.nativeElement.focus());
      } else if (this.previouslyFocused) {
        this.previouslyFocused.focus?.();
        this.previouslyFocused = null;
      }
    });

    const onBreakpoint = () => this.tour.onBreakpointChange();
    this.breakpoint.addEventListener('change', onBreakpoint);

    inject(DestroyRef).onDestroy(() => {
      this.breakpoint.removeEventListener('change', onBreakpoint);
      if (this.rafHandle !== null) cancelAnimationFrame(this.rafHandle);
    });
  }

  // --- Measurement ----------------------------------------------------------

  private place(): void {
    const card = this.cardRef?.nativeElement;
    if (!card) return;

    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const safe = safeAreaForWidth(viewport.width);
    const size = { width: card.offsetWidth, height: card.offsetHeight };

    const rect = this.anchor();
    const placement = this.step()?.placement ?? 'bottom';

    this.position.set(
      rect && placement !== 'center'
        ? placeAnchored(rect, size, placement, safe, viewport, 12)
        : placeCentered(size, safe, viewport)
    );
  }

  /**
   * Both listeners are throttled through one animation frame. A tour step
   * anchored to something inside a scrolling list would otherwise re-measure
   * on every scroll event.
   */
  @HostListener('window:scroll')
  @HostListener('window:resize')
  protected onViewportChange(): void {
    if (!this.active()) return;
    if (this.rafHandle !== null) return;

    this.rafHandle = requestAnimationFrame(() => {
      this.rafHandle = null;
      this.tour.remeasure();
      this.place();
    });
  }

  // --- Input ----------------------------------------------------------------

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (!this.active()) return;

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.skip();
        break;
      case 'ArrowRight':
      case 'Enter':
        event.preventDefault();
        this.next();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.tour.prev();
        break;
      case 'Home':
        event.preventDefault();
        this.tour.goTo(0);
        break;
      case 'Tab':
        // Trapped for ordinary steps. NOT trapped when the step is interactive,
        // because the whole point of those is reaching the real control.
        if (!this.step()?.interactive) this.trapFocus(event);
        break;
    }
  }

  private trapFocus(event: KeyboardEvent): void {
    const card = this.cardRef?.nativeElement;
    if (!card) return;

    const focusable = card.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  protected next(): void {
    if (this.isPageTip()) {
      this.tour.exit('finished');
      return;
    }
    this.tour.next();
  }

  protected prev(): void {
    this.tour.prev();
  }

  protected skip(): void {
    this.tour.exit('skipped');
  }

  /**
   * A click on the blocker. Deliberately does nothing but keep focus in the
   * card: dismissing a tour on a stray backdrop click loses the user's place
   * for no clear intent.
   */
  protected onBlockerClick(): void {
    this.cardRef?.nativeElement.focus();
  }
}
