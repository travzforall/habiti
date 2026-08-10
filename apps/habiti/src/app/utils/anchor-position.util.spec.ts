import {
  DESKTOP_SAFE_AREA,
  MOBILE_SAFE_AREA,
  Placement,
  SafeArea,
  Size,
  inflate,
  placeAnchored,
  placeCentered,
  safeAreaForWidth
} from './anchor-position.util';

/** jsdom/Chrome headless both have DOMRect, but building one by hand is clearer. */
function rect(left: number, top: number, width: number, height: number): DOMRect {
  return new DOMRect(left, top, width, height);
}

const DESKTOP: Size = { width: 1440, height: 900 };
const MOBILE: Size = { width: 390, height: 844 };
const CARD: Size = { width: 352, height: 160 };

describe('anchor-position.util', () => {
  describe('safeAreaForWidth', () => {
    it('switches at the lg breakpoint', () => {
      expect(safeAreaForWidth(1024)).toBe(DESKTOP_SAFE_AREA);
      expect(safeAreaForWidth(1023)).toBe(MOBILE_SAFE_AREA);
    });

    it('reserves more room on mobile, where both nav bars are taller', () => {
      expect(MOBILE_SAFE_AREA.top).toBeGreaterThan(DESKTOP_SAFE_AREA.top);
      expect(MOBILE_SAFE_AREA.bottom).toBeGreaterThan(DESKTOP_SAFE_AREA.bottom);
    });
  });

  describe('inflate', () => {
    it('grows on every side', () => {
      const r = inflate(rect(100, 100, 50, 20), 8);
      expect(r.left).toBe(92);
      expect(r.top).toBe(92);
      expect(r.width).toBe(66);
      expect(r.height).toBe(36);
    });
  });

  describe('placeAnchored', () => {
    it('uses the requested side when it fits', () => {
      const result = placeAnchored(
        rect(600, 400, 200, 60),
        CARD,
        'bottom',
        DESKTOP_SAFE_AREA,
        DESKTOP
      );

      expect(result.placement).toBe('bottom');
      expect(result.top).toBe(472); // 400 + 60 + 12 gap
      expect(result.left).toBe(524); // centred: 600 + 100 - 176
    });

    it('flips to bottom when there is no room above', () => {
      // Target hard against the top bar — 'top' cannot fit the card.
      const result = placeAnchored(
        rect(600, 100, 200, 60),
        CARD,
        'top',
        DESKTOP_SAFE_AREA,
        DESKTOP
      );

      expect(result.placement).toBe('bottom');
    });

    it('flips to top when there is no room below', () => {
      const result = placeAnchored(
        rect(600, 800, 200, 60),
        CARD,
        'bottom',
        DESKTOP_SAFE_AREA,
        DESKTOP
      );

      expect(result.placement).toBe('top');
    });

    it('flips right to left against the right edge', () => {
      const result = placeAnchored(
        rect(1300, 400, 100, 60),
        CARD,
        'right',
        DESKTOP_SAFE_AREA,
        DESKTOP
      );

      expect(result.placement).toBe('left');
    });

    it('never returns a position outside the safe area', () => {
      const placements: Placement[] = ['top', 'bottom', 'left', 'right'];
      const anchors = [
        rect(0, 0, 40, 40),
        rect(1400, 0, 40, 40),
        rect(0, 860, 40, 40),
        rect(1400, 860, 40, 40),
        rect(700, 450, 40, 40)
      ];

      for (const placement of placements) {
        for (const anchor of anchors) {
          const r = placeAnchored(anchor, CARD, placement, DESKTOP_SAFE_AREA, DESKTOP);

          expect(r.left).toBeGreaterThanOrEqual(DESKTOP_SAFE_AREA.left);
          expect(r.top).toBeGreaterThanOrEqual(DESKTOP_SAFE_AREA.top);
          expect(r.left + CARD.width).toBeLessThanOrEqual(DESKTOP.width - DESKTOP_SAFE_AREA.right);
          expect(r.top + CARD.height).toBeLessThanOrEqual(DESKTOP.height - DESKTOP_SAFE_AREA.bottom);
        }
      }
    });

    it('clears the mobile nav bands', () => {
      // A target near the bottom nav must not put the card underneath it.
      const result = placeAnchored(
        rect(20, 700, 350, 80),
        { width: 350, height: 140 },
        'bottom',
        MOBILE_SAFE_AREA,
        MOBILE
      );

      expect(result.top + 140).toBeLessThanOrEqual(MOBILE.height - MOBILE_SAFE_AREA.bottom);
      expect(result.top).toBeGreaterThanOrEqual(MOBILE_SAFE_AREA.top);
    });

    it('centres when no side fits, rather than overlapping the target', () => {
      // A target filling the viewport leaves nowhere to sit beside it.
      const result = placeAnchored(
        rect(0, 0, 1440, 900),
        CARD,
        'right',
        DESKTOP_SAFE_AREA,
        DESKTOP
      );

      expect(result.placement).toBe('center');
    });

    it('keeps the card on screen when it is taller than the usable area', () => {
      const tall: Size = { width: 352, height: 2000 };
      const result = placeAnchored(rect(600, 400, 200, 60), tall, 'bottom', DESKTOP_SAFE_AREA, DESKTOP);

      // Cannot satisfy both edges; the top-left must still be visible.
      expect(result.top).toBeGreaterThanOrEqual(DESKTOP_SAFE_AREA.top);
      expect(result.left).toBeGreaterThanOrEqual(DESKTOP_SAFE_AREA.left);
    });

    it('routes placement "center" straight to placeCentered', () => {
      const result = placeAnchored(rect(0, 0, 10, 10), CARD, 'center', DESKTOP_SAFE_AREA, DESKTOP);
      expect(result).toEqual(placeCentered(CARD, DESKTOP_SAFE_AREA, DESKTOP));
    });

    it('honours a custom gap', () => {
      const result = placeAnchored(
        rect(600, 400, 200, 60),
        CARD,
        'bottom',
        DESKTOP_SAFE_AREA,
        DESKTOP,
        40
      );

      expect(result.top).toBe(500); // 400 + 60 + 40
    });
  });

  describe('placeCentered', () => {
    it('centres within the safe area, not the raw viewport', () => {
      const safe: SafeArea = { top: 100, right: 0, bottom: 0, left: 0 };
      const result = placeCentered({ width: 100, height: 100 }, safe, { width: 500, height: 500 });

      // Usable height is 400, so a 100-tall card sits at 100 + 150.
      expect(result.top).toBe(250);
      expect(result.left).toBe(200);
    });

    it('does not go negative when the card exceeds the usable area', () => {
      const result = placeCentered({ width: 900, height: 900 }, DESKTOP_SAFE_AREA, DESKTOP);
      expect(result.left).toBeGreaterThanOrEqual(DESKTOP_SAFE_AREA.left);
      expect(result.top).toBeGreaterThanOrEqual(DESKTOP_SAFE_AREA.top);
    });
  });
});
