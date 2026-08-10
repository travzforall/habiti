/**
 * Placing a floating card next to a target element.
 *
 * Generalised from the flip math in status-avatar.component.ts, with two
 * changes that the tour needs and an anchored status popover did not:
 *
 *  1. The card's real measured size is passed in, rather than a fixed height
 *     constant. Tour tips vary from one line to four.
 *  2. Clamping is against a SAFE AREA, not the raw viewport. The app's top bar
 *     is fixed at 112px below `lg` and 80px at `lg`+, and the bottom nav
 *     reserves 96px below `lg` (root.html:16, `pt-28 lg:pt-20 pb-24 lg:pb-8`).
 *     Clamping to the viewport alone slides tips underneath both.
 *
 * Pure by design — no DOM reads, no injection — so the awkward geometry is
 * unit-testable without a fixture.
 */

export type Placement = 'top' | 'bottom' | 'left' | 'right' | 'center';

export interface Size {
  width: number;
  height: number;
}

/** Pixels to keep clear on each edge. */
export interface SafeArea {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PlacementResult {
  top: number;
  left: number;
  /** Where it actually ended up, which may differ from what was asked for. */
  placement: Placement;
}

/** The app's fixed chrome, which a tip must never hide behind. */
export const DESKTOP_SAFE_AREA: SafeArea = { top: 88, right: 8, bottom: 16, left: 8 };
export const MOBILE_SAFE_AREA: SafeArea = { top: 120, right: 8, bottom: 104, left: 8 };

/** Matches Tailwind's `lg`, the breakpoint the whole shell switches on. */
export const LG_BREAKPOINT = 1024;

export function safeAreaForWidth(viewportWidth: number): SafeArea {
  return viewportWidth >= LG_BREAKPOINT ? DESKTOP_SAFE_AREA : MOBILE_SAFE_AREA;
}

/** Grows a rect by `padding` on every side, without letting it invert. */
export function inflate(rect: DOMRect, padding: number): DOMRect {
  return new DOMRect(
    rect.left - padding,
    rect.top - padding,
    rect.width + padding * 2,
    rect.height + padding * 2
  );
}

function clamp(value: number, min: number, max: number): number {
  // max < min when the card is larger than the space available. Preferring min
  // keeps the card's top-left on screen; preferring max would push its visible
  // corner off, which is the worse of the two failures.
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

/** Does the card fit on `side` of the anchor without crossing the safe area? */
function fits(
  side: Placement,
  anchor: DOMRect,
  size: Size,
  safe: SafeArea,
  viewport: Size,
  gap: number
): boolean {
  switch (side) {
    case 'top':
      return anchor.top - gap - size.height >= safe.top;
    case 'bottom':
      return anchor.bottom + gap + size.height <= viewport.height - safe.bottom;
    case 'left':
      return anchor.left - gap - size.width >= safe.left;
    case 'right':
      return anchor.right + gap + size.width <= viewport.width - safe.right;
    default:
      return true;
  }
}

/** Tried in order when the requested side doesn't fit. */
const FALLBACKS: Record<Exclude<Placement, 'center'>, Placement[]> = {
  top: ['bottom', 'right', 'left'],
  bottom: ['top', 'right', 'left'],
  left: ['right', 'bottom', 'top'],
  right: ['left', 'bottom', 'top']
};

/** Dead centre of the safe area — used for `center` and as the last resort. */
export function placeCentered(size: Size, safe: SafeArea, viewport: Size): PlacementResult {
  const usableWidth = viewport.width - safe.left - safe.right;
  const usableHeight = viewport.height - safe.top - safe.bottom;

  return {
    left: Math.round(safe.left + Math.max(0, (usableWidth - size.width) / 2)),
    top: Math.round(safe.top + Math.max(0, (usableHeight - size.height) / 2)),
    placement: 'center'
  };
}

/**
 * Positions `size` against `anchor`, flipping to another side if the preferred
 * one overflows, then clamping the result into the safe area.
 *
 * Returns viewport coordinates, for a `position: fixed` element.
 */
export function placeAnchored(
  anchor: DOMRect,
  size: Size,
  placement: Placement,
  safe: SafeArea,
  viewport: Size,
  gap = 12
): PlacementResult {
  if (placement === 'center') return placeCentered(size, safe, viewport);

  // Take the preferred side if it fits, else the first fallback that does. If
  // nothing fits — a small viewport, or a target filling the screen — fall back
  // to centering rather than clamping a side placement into overlapping the
  // target, which reads as a bug.
  const side = fits(placement, anchor, size, safe, viewport, gap)
    ? placement
    : FALLBACKS[placement].find(candidate =>
        fits(candidate, anchor, size, safe, viewport, gap)
      );

  if (!side || side === 'center') return placeCentered(size, safe, viewport);

  let top: number;
  let left: number;

  switch (side) {
    case 'top':
      top = anchor.top - gap - size.height;
      left = anchor.left + anchor.width / 2 - size.width / 2;
      break;
    case 'bottom':
      top = anchor.bottom + gap;
      left = anchor.left + anchor.width / 2 - size.width / 2;
      break;
    case 'left':
      top = anchor.top + anchor.height / 2 - size.height / 2;
      left = anchor.left - gap - size.width;
      break;
    default:
      top = anchor.top + anchor.height / 2 - size.height / 2;
      left = anchor.right + gap;
      break;
  }

  return {
    top: Math.round(clamp(top, safe.top, viewport.height - safe.bottom - size.height)),
    left: Math.round(clamp(left, safe.left, viewport.width - safe.right - size.width)),
    placement: side
  };
}
