import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { TourOverlayComponent } from './tour-overlay.component';
import { TourService, TourStep } from '../../services/tour.service';

describe('TourOverlayComponent', () => {
  let fixture: ComponentFixture<TourOverlayComponent>;
  let tour: {
    active: ReturnType<typeof signal<boolean>>;
    step: ReturnType<typeof signal<TourStep | null>>;
    resolving: ReturnType<typeof signal<boolean>>;
    anchor: ReturnType<typeof signal<DOMRect | null>>;
    revision: ReturnType<typeof signal<number>>;
    isPageTip: ReturnType<typeof signal<boolean>>;
    isFirst: ReturnType<typeof signal<boolean>>;
    isLast: ReturnType<typeof signal<boolean>>;
    progress: () => { current: number; total: number };
    next: jasmine.Spy;
    prev: jasmine.Spy;
    goTo: jasmine.Spy;
    exit: jasmine.Spy;
    remeasure: jasmine.Spy;
    onBreakpointChange: jasmine.Spy;
  };

  const step: TourStep = {
    id: 'today-habits',
    title: 'Your day, in one card',
    body: 'Everything due today lives here.',
    placement: 'bottom'
  };

  beforeEach(async () => {
    tour = {
      active: signal(true),
      step: signal<TourStep | null>(step),
      resolving: signal(false),
      anchor: signal<DOMRect | null>(new DOMRect(100, 100, 200, 60)),
      revision: signal(1),
      isPageTip: signal(false),
      isFirst: signal(false),
      isLast: signal(false),
      progress: () => ({ current: 2, total: 10 }),
      next: jasmine.createSpy('next'),
      prev: jasmine.createSpy('prev'),
      goTo: jasmine.createSpy('goTo'),
      exit: jasmine.createSpy('exit'),
      remeasure: jasmine.createSpy('remeasure'),
      onBreakpointChange: jasmine.createSpy('onBreakpointChange')
    };

    await TestBed.configureTestingModule({
      imports: [TourOverlayComponent],
      providers: [{ provide: TourService, useValue: tour }]
    }).compileComponents();

    fixture = TestBed.createComponent(TourOverlayComponent);
    fixture.detectChanges();
  });

  function el(selector: string): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(selector);
  }

  it('creates', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders nothing when no tour is running', () => {
    tour.active.set(false);
    fixture.detectChanges();

    expect(el('[role="dialog"]')).toBeNull();
    expect(el('.tour-spotlight')).toBeNull();
  });

  it('shows the step title and body', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Your day, in one card');
    expect(text).toContain('Everything due today lives here.');
  });

  it('positions the spotlight over the anchor', () => {
    const spot = el('.tour-spotlight');
    expect(spot).not.toBeNull();
    expect(spot!.style.left).toBe('100px');
    expect(spot!.style.width).toBe('200px');
  });

  it('falls back to a full-screen dim when there is no anchor', () => {
    tour.anchor.set(null);
    fixture.detectChanges();

    expect(el('.tour-spotlight')).toBeNull();
    // The tip still renders; it is just centred.
    expect(el('[role="dialog"]')).not.toBeNull();
  });

  describe('the click blocker', () => {
    it('is present for an ordinary step', () => {
      // A box-shadow captures no pointer events, so without this the whole page
      // stays clickable during the tour.
      expect(fixture.componentInstance['blockerVisible']()).toBe(true);
    });

    it('is absent for an interactive step, so the target can be tapped', () => {
      tour.step.set({ ...step, interactive: true });
      fixture.detectChanges();

      expect(fixture.componentInstance['blockerVisible']()).toBe(false);
    });
  });

  describe('keyboard', () => {
    function press(key: string): void {
      document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    }

    it('exits on Escape', () => {
      press('Escape');
      expect(tour.exit).toHaveBeenCalledWith('skipped');
    });

    it('advances on ArrowRight and Enter', () => {
      press('ArrowRight');
      press('Enter');
      expect(tour.next).toHaveBeenCalledTimes(2);
    });

    it('goes back on ArrowLeft', () => {
      press('ArrowLeft');
      expect(tour.prev).toHaveBeenCalled();
    });

    it('jumps to the start on Home', () => {
      press('Home');
      expect(tour.goTo).toHaveBeenCalledWith(0);
    });

    it('ignores keys when no tour is running', () => {
      tour.active.set(false);
      fixture.detectChanges();

      press('Escape');
      expect(tour.exit).not.toHaveBeenCalled();
    });
  });

  describe('progress', () => {
    it('shows the position in the tour', () => {
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('2 / 10');
    });

    it('reads Done on the last step', () => {
      tour.isLast.set(true);
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Done');
    });

    it('hides Back on the first step', () => {
      tour.isFirst.set(true);
      fixture.detectChanges();

      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).not.toContain('Back');
    });
  });

  describe('page tips', () => {
    beforeEach(() => {
      tour.isPageTip.set(true);
      tour.anchor.set(null);
      fixture.detectChanges();
    });

    it('offers a single Got it button instead of tour controls', () => {
      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('Got it');
      expect(text).not.toContain('Skip tour');
      expect(text).not.toContain('/ 10');
    });

    it('dismissing it finishes rather than skipping', () => {
      fixture.componentInstance['next']();
      expect(tour.exit).toHaveBeenCalledWith('finished');
    });
  });

  describe('viewport changes', () => {
    it('asks the service to re-measure on scroll', done => {
      fixture.componentInstance['onViewportChange']();

      requestAnimationFrame(() => {
        expect(tour.remeasure).toHaveBeenCalled();
        done();
      });
    });

    it('does nothing when inactive', () => {
      tour.active.set(false);
      fixture.detectChanges();

      fixture.componentInstance['onViewportChange']();
      expect(tour.remeasure).not.toHaveBeenCalled();
    });
  });
});
