import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { OnboardingService } from './onboarding.service';
import { TourService, TourStep } from './tour.service';

/** A real element the service can find and measure. */
function mountTarget(name: string, size = { width: 100, height: 40 }): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-tour', name);
  el.style.cssText = `position:fixed;left:10px;top:10px;width:${size.width}px;height:${size.height}px;`;
  document.body.appendChild(el);
  return el;
}

function step(over: Partial<TourStep> = {}): TourStep {
  return { id: 'a', title: 'A', body: 'Body', placement: 'center', ...over };
}

describe('TourService', () => {
  let onboardingStub: {
    wizardOpen: ReturnType<typeof signal<boolean>>;
    shouldOpen: ReturnType<typeof signal<boolean>>;
    pageTipsSeen: ReturnType<typeof signal<string[]>>;
    hasSeenPageTip: jasmine.Spy;
    markPageTipSeen: jasmine.Spy;
    recordGuideProgress: jasmine.Spy;
    finishGuide: jasmine.Spy;
  };

  let service: TourService;

  beforeEach(() => {
    onboardingStub = {
      wizardOpen: signal(false),
      shouldOpen: signal(false),
      pageTipsSeen: signal<string[]>([]),
      hasSeenPageTip: jasmine.createSpy('hasSeenPageTip').and.returnValue(false),
      markPageTipSeen: jasmine.createSpy('markPageTipSeen'),
      recordGuideProgress: jasmine.createSpy('recordGuideProgress'),
      finishGuide: jasmine.createSpy('finishGuide')
    };

    TestBed.configureTestingModule({
      providers: [
        // Real (if empty) routes: navigateByUrl resolves false for an unknown
        // path, which the service correctly treats as an interruption and
        // exits on — so a router with no routes would fail every routed step.
        provideRouter([
          { path: 'dashboard', children: [] },
          { path: 'settings', children: [] }
        ]),
        { provide: OnboardingService, useValue: onboardingStub }
      ]
    });

    service = TestBed.inject(TourService);
  });

  afterEach(() => {
    document.querySelectorAll('[data-tour]').forEach(el => el.remove());
  });

  describe('start', () => {
    it('drops steps whose media query does not match', () => {
      // Impossible pair: exactly one can ever apply.
      service.start([
        step({ id: 'wide', media: '(min-width: 100000px)' }),
        step({ id: 'narrow', media: '(max-width: 99999px)' })
      ]);

      expect(service.steps().length).toBe(1);
      expect(service.steps()[0].id).toBe('narrow');
    });

    it('reports a total that matches what the user will actually see', () => {
      service.start([
        step({ id: 'one' }),
        step({ id: 'hidden', media: '(min-width: 100000px)' }),
        step({ id: 'two' })
      ]);

      expect(service.progress().total).toBe(2);
    });

    it('does nothing when no step applies', () => {
      service.start([step({ media: '(min-width: 100000px)' })]);
      expect(service.active()).toBe(false);
    });

    it('can start partway through, for Resume', () => {
      service.start([step({ id: 'a' }), step({ id: 'b' }), step({ id: 'c' })], 2);
      expect(service.step()?.id).toBe('c');
    });

    it('clamps an out-of-range resume index', () => {
      service.start([step({ id: 'a' }), step({ id: 'b' })], 99);
      expect(service.step()?.id).toBe('b');
    });
  });

  /**
   * Every move is async — a step may navigate and then wait for a lazy chunk to
   * render — so these flush microtasks rather than asserting straight after the
   * call.
   */
  describe('navigation', () => {
    beforeEach(fakeAsync(() => {
      service.start([step({ id: 'a' }), step({ id: 'b' }), step({ id: 'c' })]);
      tick();
    }));

    it('advances and goes back', fakeAsync(() => {
      expect(service.isFirst()).toBe(true);

      service.next();
      tick();
      expect(service.step()?.id).toBe('b');

      service.prev();
      tick();
      expect(service.step()?.id).toBe('a');
    }));

    it('will not go back past the first step', fakeAsync(() => {
      service.prev();
      tick();
      expect(service.step()?.id).toBe('a');
    }));

    it('finishes when next() runs off the end', fakeAsync(() => {
      service.goTo(2);
      tick();
      expect(service.isLast()).toBe(true);

      service.next();
      tick();

      expect(service.active()).toBe(false);
      expect(onboardingStub.finishGuide).toHaveBeenCalledWith('finished');
    }));

    it('records progress as each step is entered', fakeAsync(() => {
      onboardingStub.recordGuideProgress.calls.reset();
      service.next();
      tick();
      expect(onboardingStub.recordGuideProgress).toHaveBeenCalledWith(1, 'b');
    }));
  });

  describe('exit', () => {
    it('reports a skip to the onboarding record', () => {
      service.start([step()]);
      service.exit('skipped');

      expect(service.active()).toBe(false);
      expect(onboardingStub.finishGuide).toHaveBeenCalledWith('skipped');
    });

    it('does NOT record an interruption as a skip', () => {
      // An AuthGuard bounce is not the user declining the tour, and retiring
      // it for that reason would silently lose them the guide.
      service.start([step()]);
      service.exit('interrupted');

      expect(service.active()).toBe(false);
      expect(onboardingStub.finishGuide).not.toHaveBeenCalled();
    });

    it('is a no-op when nothing is running', () => {
      service.exit('skipped');
      expect(onboardingStub.finishGuide).not.toHaveBeenCalled();
    });
  });

  describe('targets', () => {
    it('anchors to a live element', fakeAsync(() => {
      mountTarget('present');
      service.start([step({ target: [{ selector: '[data-tour="present"]' }], placement: 'bottom' })]);
      tick(3000);

      expect(service.anchor()).not.toBeNull();
    }));

    it('inflates the anchor by the step padding', fakeAsync(() => {
      mountTarget('padded');
      service.start([
        step({ target: [{ selector: '[data-tour="padded"]' }], placement: 'bottom', padding: 10 })
      ]);
      tick(3000);

      // 100x40 grown by 10 on every side.
      expect(service.anchor()?.width).toBe(120);
      expect(service.anchor()?.height).toBe(60);
    }));

    it('ignores a zero-sized element, which means hidden or still a skeleton', fakeAsync(() => {
      mountTarget('collapsed', { width: 0, height: 0 });
      service.start([
        step({
          target: [{ selector: '[data-tour="collapsed"]' }],
          placement: 'bottom',
          waitMs: 50
        })
      ]);
      tick(500);

      expect(service.anchor()).toBeNull();
    }));

    it('picks the first target whose media matches', fakeAsync(() => {
      mountTarget('wide-only');
      mountTarget('fallback');

      service.start([
        step({
          target: [
            { selector: '[data-tour="wide-only"]', media: '(min-width: 100000px)' },
            { selector: '[data-tour="fallback"]' }
          ],
          placement: 'bottom'
        })
      ]);
      tick(3000);

      expect(service.anchor()).not.toBeNull();
      expect(service.anchor()?.left).toBe(2); // 10 - 8 default padding
    }));

    it('centres a step whose target never appears', fakeAsync(() => {
      service.start([
        step({ target: [{ selector: '[data-tour="ghost"]' }], placement: 'bottom', waitMs: 50 })
      ]);
      tick(500);

      expect(service.active()).toBe(true);
      expect(service.anchor()).toBeNull();
    }));

    it('skips past a missing target marked onMissing:skip', fakeAsync(() => {
      service.start([
        step({ id: 'first' }),
        step({
          id: 'ghost',
          target: [{ selector: '[data-tour="nope"]' }],
          onMissing: 'skip',
          waitMs: 50
        }),
        step({ id: 'third' })
      ]);

      service.next();
      tick(500);

      expect(service.step()?.id).toBe('third');
    }));

    it('finishes if the last step is skipped for a missing target', fakeAsync(() => {
      service.start([
        step({ id: 'first' }),
        step({
          id: 'ghost',
          target: [{ selector: '[data-tour="nope"]' }],
          onMissing: 'skip',
          waitMs: 50
        })
      ]);

      service.next();
      tick(500);

      expect(service.active()).toBe(false);
      expect(onboardingStub.finishGuide).toHaveBeenCalledWith('finished');
    }));
  });

  describe('page tips', () => {
    it('shows a single centred tip and records it on dismissal', () => {
      service.showPageTip(step({ id: '/challenges', title: 'Challenges' }));

      expect(service.active()).toBe(true);
      expect(service.isPageTip()).toBe(true);
      expect(service.progress()).toEqual({ current: 1, total: 1 });

      service.exit('finished');

      expect(onboardingStub.markPageTipSeen).toHaveBeenCalledWith('/challenges');
      // A page tip is not progress through the main guide.
      expect(onboardingStub.finishGuide).not.toHaveBeenCalled();
    });

    it('does not record a tip that was interrupted', () => {
      service.showPageTip(step({ id: '/friends' }));
      service.exit('interrupted');

      expect(onboardingStub.markPageTipSeen).not.toHaveBeenCalled();
    });

    it('does not write guide progress for a tip', () => {
      onboardingStub.recordGuideProgress.calls.reset();
      service.showPageTip(step({ id: '/tasks' }));

      expect(onboardingStub.recordGuideProgress).not.toHaveBeenCalled();
    });
  });

  describe('remeasure', () => {
    it('re-reads the target box', fakeAsync(() => {
      const el = mountTarget('movable');
      service.start([step({ target: [{ selector: '[data-tour="movable"]' }], placement: 'bottom' })]);
      tick(3000);

      const before = service.anchor()!.top;
      el.style.top = '200px';
      service.remeasure();

      expect(service.anchor()!.top).toBeGreaterThan(before);
    }));

    it('is a no-op when no tour is running', () => {
      service.remeasure();
      expect(service.anchor()).toBeNull();
    });
  });

  describe('stale anchors', () => {
    it('drops the previous anchor as soon as the next step starts resolving', fakeAsync(() => {
      mountTarget('first-target');

      service.start([
        step({ id: 'a', target: [{ selector: '[data-tour="first-target"]' }], placement: 'bottom' }),
        step({
          id: 'b',
          target: [{ selector: '[data-tour="slow"]' }],
          placement: 'bottom',
          waitMs: 1000
        })
      ]);
      // 600ms clears the smooth-scroll settle wait, which falls back to 400ms.
      tick(600);
      expect(service.anchor()).not.toBeNull();

      // While step B waits for a target that is not there yet, step A's rect
      // must not stay painted — on a cross-route step it would ring whatever
      // now occupies those coordinates on the new page, captioned with A's tip.
      service.next();
      expect(service.resolving()).toBe(true);
      expect(service.anchor()).toBeNull();

      tick(1500);
    }));

    /**
     * The tour's own navigation must not be mistaken for the user wandering off.
     *
     * NavigationEnd fires while `step()` is still the PREVIOUS step, whose route
     * no longer matches the URL. Treating that as user navigation cancelled the
     * in-flight step and re-resolved the old one against the new page — the tour
     * stuck on step 5's tip while sitting on step 6's page.
     */
    it('does not hijack its own cross-route navigation', fakeAsync(() => {
      mountTarget('on-page-two');

      service.start([
        step({ id: 'one', route: '/dashboard' }),
        step({
          id: 'two',
          route: '/settings',
          target: [{ selector: '[data-tour="on-page-two"]' }],
          placement: 'bottom'
        })
      ]);
      tick(600);

      service.next();
      tick(2000);

      expect(service.step()?.id).toBe('two');
      expect(service.progress().current).toBe(2);
      expect(service.anchor()).not.toBeNull();
    }));
  });
});
