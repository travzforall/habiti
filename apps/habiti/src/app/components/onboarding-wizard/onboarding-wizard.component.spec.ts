import { provideTestUserId } from '@habiti/storage/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { OnboardingWizardComponent } from './onboarding-wizard.component';
import { OnboardingService } from '../../services/onboarding.service';
import { HabitsService } from '../../services/habits';
import { ChallengeService } from '../../services/challenge.service';
import { ThemeService } from '../../services/theme.service';
import { AuthService } from '../../services/auth.service';
import { TourService } from '../../services/tour.service';
import { defaultPreferences } from '../../models/onboarding.models';

describe('OnboardingWizardComponent', () => {
  let fixture: ComponentFixture<OnboardingWizardComponent>;
  let onboarding: {
    shouldOpen: ReturnType<typeof signal<boolean>>;
    modeSettled: ReturnType<typeof signal<boolean>>;
    mode: ReturnType<typeof signal<'new' | 'returning'>>;
    preferences: () => ReturnType<typeof defaultPreferences>;
    setWizardOpen: jasmine.Spy;
    skip: jasmine.Spy;
    complete: jasmine.Spy;
  };
  let habits: { habits: ReturnType<typeof signal<{ name: string }[]>>; addHabits: jasmine.Spy };
  let theme: { set: jasmine.Spy; preview: jasmine.Spy; revertPreview: jasmine.Spy };
  let tour: { start: jasmine.Spy };

  beforeEach(async () => {
    onboarding = {
      shouldOpen: signal(true),
      modeSettled: signal(true),
      mode: signal<'new' | 'returning'>('new'),
      preferences: () => defaultPreferences(),
      setWizardOpen: jasmine.createSpy('setWizardOpen'),
      skip: jasmine.createSpy('skip'),
      complete: jasmine.createSpy('complete')
    };

    habits = {
      habits: signal<{ name: string }[]>([]),
      addHabits: jasmine.createSpy('addHabits').and.returnValue(of([]))
    };

    theme = {
      set: jasmine.createSpy('set'),
      preview: jasmine.createSpy('preview'),
      revertPreview: jasmine.createSpy('revertPreview')
    };

    tour = { start: jasmine.createSpy('start') };

    await TestBed.configureTestingModule({
      imports: [OnboardingWizardComponent],
      providers: [
      provideTestUserId(),
        provideHttpClient(),
        provideRouter([]),
        { provide: OnboardingService, useValue: onboarding },
        { provide: HabitsService, useValue: habits },
        { provide: ThemeService, useValue: theme },
        { provide: TourService, useValue: tour },
        { provide: ChallengeService, useValue: { setDefaultDifficulty: jasmine.createSpy() } },
        { provide: AuthService, useValue: { currentUserValue: { id: 1, name: 'Alex Kim' } } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(OnboardingWizardComponent);
    fixture.detectChanges();
  });

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('creates', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders nothing until the service says to open', () => {
    onboarding.shouldOpen.set(false);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('[role="dialog"]')).toBeNull();
  });

  it('stays closed until the habit fetch has settled', () => {
    // Otherwise `mode` is read too early and an established user is shown the
    // starter-habit step.
    onboarding.modeSettled.set(false);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('[role="dialog"]')).toBeNull();
  });

  it('greets the user by first name', () => {
    expect(text()).toContain('Alex');
  });

  it('drops the starter-habit step for a returning user', () => {
    onboarding.mode.set('returning');
    habits.habits.set([{ name: 'Read' }]);
    fixture.detectChanges();

    expect(fixture.componentInstance['steps']()).not.toContain('habits');
    expect(fixture.componentInstance['steps']()).toContain('focus');
  });

  it('keeps the starter-habit step for a new user', () => {
    expect(fixture.componentInstance['steps']()).toContain('habits');
  });

  describe('skip', () => {
    it('writes defaults and creates no habits', () => {
      fixture.componentInstance['skip']();

      expect(onboarding.skip).toHaveBeenCalled();
      expect(habits.addHabits).not.toHaveBeenCalled();
      expect(onboarding.complete).not.toHaveBeenCalled();
    });

    it('reverts a live theme preview, so skipping changes nothing', () => {
      fixture.componentInstance['chooseTheme']('dark');
      expect(theme.preview).toHaveBeenCalledWith('dark');

      fixture.componentInstance['skip']();
      expect(theme.revertPreview).toHaveBeenCalled();
      expect(theme.set).not.toHaveBeenCalled();
    });

    it('still starts the guide — skipping setup is not declining the tour', () => {
      jasmine.clock().install();
      try {
        fixture.componentInstance['skip']();

        // Handed off on a delay so the confirmation toast lands before the
        // spotlight covers the screen.
        expect(tour.start).not.toHaveBeenCalled();
        jasmine.clock().tick(600);
        expect(tour.start).toHaveBeenCalled();
      } finally {
        jasmine.clock().uninstall();
      }
    });
  });

  describe('finish', () => {
    it('persists the theme rather than leaving it a preview', () => {
      fixture.componentInstance['chooseTheme']('dark');
      fixture.componentInstance['finish']();

      expect(theme.set).toHaveBeenCalledWith('dark');
    });

    it('creates no habits when none were chosen', () => {
      fixture.componentInstance['finish']();

      expect(habits.addHabits).not.toHaveBeenCalled();
      expect(onboarding.complete).toHaveBeenCalled();
    });

    it('reports the chosen focus areas', () => {
      fixture.componentInstance['toggleFocus']('fitness');
      fixture.componentInstance['toggleFocus']('mind');
      fixture.componentInstance['finish']();

      const arg = onboarding.complete.calls.mostRecent().args[0];
      expect(arg.preferences.focusAreas).toEqual(['fitness', 'mind']);
    });
  });

  describe('focus areas', () => {
    it('toggles on and off', () => {
      const c = fixture.componentInstance;
      expect(c['isFocused']('mind')).toBe(false);

      c['toggleFocus']('mind');
      expect(c['isFocused']('mind')).toBe(true);

      c['toggleFocus']('mind');
      expect(c['isFocused']('mind')).toBe(false);
    });

    it('shows every pack when nothing is chosen', () => {
      const c = fixture.componentInstance;
      const all = c['visiblePacks']().length;

      c['toggleFocus']('fitness');
      expect(c['visiblePacks']().length).toBeLessThan(all);
      expect(c['visiblePacks']().length).toBeGreaterThan(0);
    });
  });

  describe('habit selection', () => {
    it('marks a habit the user already has', () => {
      habits.habits.set([{ name: 'Stretch' }]);
      fixture.detectChanges();

      const c = fixture.componentInstance;
      const stretch = { id: 'stretch', name: 'stretch' } as never;
      expect(c['alreadyAdded'](stretch)).toBe(true);
    });

    it('toggles selection by library id', () => {
      const c = fixture.componentInstance;
      const habit = { id: 'run', name: 'Run' } as never;

      c['toggleHabit'](habit);
      expect(c['selectedCount']()).toBe(1);

      c['toggleHabit'](habit);
      expect(c['selectedCount']()).toBe(0);
    });
  });
});
