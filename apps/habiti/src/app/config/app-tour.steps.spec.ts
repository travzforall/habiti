import { routes } from '../app.routes';
import { APP_TOUR_STEPS } from './app-tour.steps';
import { PAGE_TIPS, pageTipFor } from './page-tips';
import { TourStep } from '../services/tour.service';

/** Every concrete path the router knows about, with the leading slash. */
const KNOWN_ROUTES = new Set(
  routes
    .map(r => r.path)
    .filter((p): p is string => typeof p === 'string' && p !== '**' && p !== '')
    .map(p => `/${p}`)
);

/**
 * Data integrity for the guide, in the spirit of habit-template-packs.spec.ts:
 * catch a typo at test time rather than as a tour that silently skips a step.
 */
describe('APP_TOUR_STEPS', () => {
  it('has unique ids', () => {
    const ids = APP_TOUR_STEPS.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every step a title and a body', () => {
    for (const step of APP_TOUR_STEPS) {
      expect(step.title.trim()).withContext(`${step.id} title`).toBeTruthy();
      expect(step.body.trim()).withContext(`${step.id} body`).toBeTruthy();
    }
  });

  it('keeps every tip readable at a glance', () => {
    for (const step of APP_TOUR_STEPS) {
      expect(step.body.length).withContext(`${step.id} body length`).toBeLessThanOrEqual(200);
    }
  });

  it('only routes to paths the router actually has', () => {
    for (const step of APP_TOUR_STEPS) {
      if (!step.route) continue;
      expect(KNOWN_ROUTES.has(step.route)).withContext(`${step.id} → ${step.route}`).toBe(true);
    }
  });

  it('gives every step either a target or an explicit centre', () => {
    for (const step of APP_TOUR_STEPS) {
      const anchored = (step.target?.length ?? 0) > 0;
      expect(anchored || step.placement === 'center')
        .withContext(`${step.id} has no target and is not centred`)
        .toBe(true);
    }
  });

  it('uses data-tour attribute selectors, so anchors are greppable', () => {
    for (const step of APP_TOUR_STEPS) {
      for (const target of step.target ?? []) {
        expect(target.selector)
          .withContext(`${step.id} selector`)
          .toMatch(/^\[data-tour="[a-z-]+"\]$/);
      }
    }
  });

  /**
   * The nav step exists twice — a sidebar variant and a bottom-nav variant —
   * because those elements are mutually exclusive by breakpoint. Exactly one
   * must apply at any width, or the user sees the tip twice or not at all.
   */
  it('shows exactly one nav step at any width', () => {
    const widths = [320, 767, 1023, 1024, 1279, 1280, 1920];
    const navSteps = APP_TOUR_STEPS.filter(s => s.id.startsWith('nav-'));

    expect(navSteps.length).toBeGreaterThan(1);

    for (const width of widths) {
      const matching = navSteps.filter(s => matchesAtWidth(s.media, width));
      expect(matching.length).withContext(`at ${width}px`).toBe(1);
    }
  });

  it('marks the habit-card step optional, since a skipped user has none', () => {
    const step = APP_TOUR_STEPS.find(s => s.id === 'complete-habit');
    expect(step?.onMissing).toBe('skip');
  });

  it('makes the habit-card step interactive, so the tap can actually happen', () => {
    expect(APP_TOUR_STEPS.find(s => s.id === 'complete-habit')?.interactive).toBe(true);
  });

  it('starts on a route, so the tour never opens against an unknown page', () => {
    expect(APP_TOUR_STEPS[0].route).toBe('/dashboard');
  });
});

describe('PAGE_TIPS', () => {
  const tips = Object.values(PAGE_TIPS);

  it('keys every tip by its own route', () => {
    for (const [key, tip] of Object.entries(PAGE_TIPS)) {
      expect(tip.id).withContext(`${key} id`).toBe(key);
    }
  });

  it('only covers routes the router has', () => {
    for (const key of Object.keys(PAGE_TIPS)) {
      expect(KNOWN_ROUTES.has(key)).withContext(key).toBe(true);
    }
  });

  it('centres every tip — a page tip orients, it does not point', () => {
    for (const tip of tips) {
      expect(tip.placement).withContext(tip.id).toBe('center');
      expect(tip.target).withContext(tip.id).toBeUndefined();
    }
  });

  it('holds tips to the same length limit as the main guide', () => {
    for (const tip of tips) {
      expect(tip.body.length).withContext(tip.id).toBeLessThanOrEqual(200);
    }
  });

  it('does not duplicate a page the main guide already stops on', () => {
    // Calendar is the deliberate exception: the guide points at the grid, and
    // the tip explains what clicking a day does.
    const guideRoutes = new Set(
      APP_TOUR_STEPS.map(s => s.route).filter((r): r is string => !!r && r !== '/calendar')
    );

    for (const key of Object.keys(PAGE_TIPS)) {
      expect(guideRoutes.has(key)).withContext(`${key} is covered twice`).toBe(false);
    }
  });

  describe('pageTipFor', () => {
    it('strips query strings and fragments', () => {
      expect(pageTipFor('/challenges?from=email')?.id).toBe('/challenges');
      expect(pageTipFor('/challenges#top')?.id).toBe('/challenges');
    });

    it('returns null for a route with no tip', () => {
      expect(pageTipFor('/dashboard')).toBeNull();
      expect(pageTipFor('/nonsense')).toBeNull();
    });
  });
});

/**
 * Evaluates a step's media query at a hypothetical width.
 *
 * The steps only use simple min-width/max-width queries, so parsing them beats
 * trying to fake matchMedia across seven widths.
 */
function matchesAtWidth(media: string | undefined, width: number): boolean {
  if (!media) return true;

  const min = /min-width:\s*(\d+)px/.exec(media);
  const max = /max-width:\s*(\d+)px/.exec(media);

  if (min && width < Number(min[1])) return false;
  if (max && width > Number(max[1])) return false;
  return true;
}

/** Guards the helper above against a step using a query shape it cannot read. */
describe('the media-query helper', () => {
  it('understands every query the steps actually use', () => {
    const queries = [...APP_TOUR_STEPS, ...Object.values(PAGE_TIPS)]
      .flatMap((s: TourStep) => [s.media, ...(s.target ?? []).map(t => t.media)])
      .filter((m): m is string => !!m);

    for (const query of queries) {
      expect(query).withContext(query).toMatch(/^\((min|max)-width:\s*\d+px\)$/);
    }
  });
});
