import { provideTestSession } from '@habiti/sync/testing';
import { provideTestUserId } from '@habiti/storage/testing';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { RootComponent } from './root';

/**
 * These assert the shell against the component main.ts ACTUALLY bootstraps.
 *
 * The previous version of this suite tested a different component — one that
 * held the sidebar, bottom nav and toast host but was never bootstrapped, so
 * none of it rendered. "should mount the global toast host" passed the whole
 * time while no toast could ever appear on screen. Testing the wrong component
 * is worse than not testing at all: it reports confidence you do not have.
 */
describe('RootComponent (the bootstrapped shell)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RootComponent],
      providers: [provideTestSession(), provideTestUserId(), provideHttpClient(), provideRouter([])]
    }).compileComponents();
  });

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(RootComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('creates', () => {
    expect(TestBed.createComponent(RootComponent).componentInstance).toBeTruthy();
  });

  it('mounts the global toast host', () => {
    // Without this element in the rendered tree, ToastService can raise all it
    // likes and nothing is ever shown.
    expect(render().querySelector('app-toast')).toBeTruthy();
  });

  it('mounts the top bar, which carries the profile menu and sign-out', () => {
    expect(render().querySelector('app-top-nav')).toBeTruthy();
  });

  it('mounts navigation at both breakpoints', () => {
    const el = render();
    // Desktop links live in the sidebar; below lg the bottom bar takes over.
    // Losing either leaves a breakpoint with no way to move around the app.
    expect(el.querySelector('app-side-nav')).toBeTruthy();
    expect(el.querySelector('app-bottom-nav')).toBeTruthy();
  });

  it('renders a router outlet', () => {
    expect(render().querySelector('router-outlet')).toBeTruthy();
  });

  /**
   * The bare layout.
   *
   * /legal and /trust have to be readable by people who are not signed in, and
   * frequently are not users at all — someone whose email address was used in
   * an invite, or a regulator following a link. Surrounding those pages with a
   * sidebar of links to guarded routes is noise.
   *
   * Chrome is on by DEFAULT, so a new feature route cannot silently lose its
   * navigation by forgetting to opt in. Only `chrome: false` turns it off.
   */
  describe('the bare layout', () => {
    async function renderAt(path: string, routeData?: Record<string, unknown>): Promise<HTMLElement> {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [RootComponent],
        providers: [
          provideTestSession(),
          provideTestUserId(),
          provideHttpClient(),
          provideRouter([{ path, children: [], data: routeData }])
        ]
      }).compileComponents();

      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl(`/${path}`);

      const fixture = TestBed.createComponent(RootComponent);
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    it('hides the nav chrome for a route marked chrome: false', async () => {
      const el = await renderAt('legal', { chrome: false });
      expect(el.querySelector('app-top-nav')).toBeNull();
      expect(el.querySelector('app-side-nav')).toBeNull();
      expect(el.querySelector('app-bottom-nav')).toBeNull();
      // The page itself must still render, and toasts must still be possible.
      expect(el.querySelector('router-outlet')).toBeTruthy();
      expect(el.querySelector('app-toast')).toBeTruthy();
    });

    it('keeps the chrome for a route that says nothing about it', async () => {
      const el = await renderAt('dashboard');
      expect(el.querySelector('app-top-nav')).toBeTruthy();
      expect(el.querySelector('app-side-nav')).toBeTruthy();
      expect(el.querySelector('app-bottom-nav')).toBeTruthy();
    });
  });
});
