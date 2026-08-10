import { provideTestUserId } from '@habiti/storage/testing';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
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
      providers: [provideTestUserId(), provideHttpClient(), provideRouter([])]
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
});
