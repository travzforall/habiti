import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { TopNavComponent } from '../components/top-nav/top-nav';
import { SideNavComponent } from '../components/side-nav/side-nav.component';
import { BottomNavComponent } from '../components/bottom-nav/bottom-nav';
import { ToastComponent } from '../components/toast/toast.component';
import { OnboardingWizardComponent } from '../components/onboarding-wizard/onboarding-wizard.component';
import { TourOverlayComponent } from '../components/tour-overlay/tour-overlay.component';
import { SyncService } from '@habiti/sync';
import { OnboardingService } from '../services/onboarding.service';
import { ThemeService } from '../services/theme.service';
import { TourService } from '../services/tour.service';

/**
 * The bootstrapped component — see main.ts. The only application shell.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    TopNavComponent,
    SideNavComponent,
    BottomNavComponent,
    ToastComponent,
    OnboardingWizardComponent,
    TourOverlayComponent
  ],
  templateUrl: './root.html',
  styleUrl: './root.scss'
})
export class RootComponent implements OnInit {
  /**
   * Injected purely for its side effect: the sync layer must be alive on every
   * route, including /login, so it can react the moment a user signs in.
   */
  private sync = inject(SyncService);

  /**
   * Same deal. OnboardingService watches currentUser and has to be alive before
   * the first sign-in, or a brand-new user's wizard never gets a chance to
   * resolve. The overlay hosts below render nothing until it says so.
   */
  private onboarding = inject(OnboardingService);

  private theme = inject(ThemeService);

  /**
   * Drives the @defer around the wizard, so its chunk (and the habit library
   * inside it) is only fetched for a user who is actually being onboarded.
   *
   * `shouldOpen` is false until the tri-state load settles, which is also what
   * stops the wizard flashing before the real answer is known.
   */
  protected readonly wizardNeeded = this.onboarding.shouldOpen;

  /** Same idea for the tour overlay — see the note in root.html. */
  protected readonly tourActive = inject(TourService).active;

  private router = inject(Router);
  private route = inject(ActivatedRoute);

  /**
   * Whether to render the navigation chrome around the outlet.
   *
   * Sign-in, sign-up and the legal pages are reachable by people who are not
   * signed in — and the legal pages by people who are not users at all: someone
   * whose email was used in an invite, or a regulator following a link. Wrapping
   * those in a sidebar full of links to guarded routes is noise at best.
   *
   * A route opts out with `data: { chrome: false }`. Default is on, so a new
   * feature route cannot lose its navigation by forgetting something.
   */
  protected readonly chromeVisible = signal(true);

  ngOnInit(): void {
    this.theme.applyStored();

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => this.chromeVisible.set(this.wantsChrome()));

    // NavigationEnd has usually already fired for the first route by the time
    // this component initialises, so the initial value has to be read directly.
    this.chromeVisible.set(this.wantsChrome());
  }

  /** Reads the deepest activated child, which is where a lazy route's data lands. */
  private wantsChrome(): boolean {
    let route = this.route.snapshot;
    while (route.firstChild) route = route.firstChild;
    return route.data['chrome'] !== false;
  }
}
