import { provideTestUserId } from '@habiti/storage/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';

import { HabitsComponent } from './habits';
import { OnboardingService } from '../../services/onboarding.service';
import { HABIT_TEMPLATE_PACKS } from '../../config/habit-template-packs';
import { OnboardingPreferences, defaultPreferences } from '../../models/onboarding.models';

describe('HabitsComponent', () => {
  let component: HabitsComponent;
  let fixture: ComponentFixture<HabitsComponent>;
  let preferences: ReturnType<typeof signal<OnboardingPreferences>>;

  async function setup(focusAreas: string[] = []): Promise<void> {
    preferences = signal<OnboardingPreferences>({ ...defaultPreferences(), focusAreas });

    await TestBed.configureTestingModule({
      imports: [HabitsComponent],
      providers: [
        provideTestUserId(),
        provideHttpClient(),
        provideRouter([]),
        {
          provide: OnboardingService,
          useValue: { preferences: () => preferences() }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HabitsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function featured() {
    return (component as unknown as { featuredPacks: () => { id: string }[] }).featuredPacks();
  }

  it('should create', async () => {
    await setup();
    expect(component).toBeTruthy();
  });

  /**
   * The card shows a slice of a longer list, so the two things that matter are
   * how many it shows and which ten it picks.
   */
  describe('featured packs', () => {
    it('shows ten, not all of them', async () => {
      await setup();
      expect(HABIT_TEMPLATE_PACKS.length).toBeGreaterThan(10);
      expect(featured().length).toBe(10);
    });

    it('falls back to curated order when no focus areas were chosen', async () => {
      await setup([]);
      expect(featured().map(p => p.id)).toEqual(
        HABIT_TEMPLATE_PACKS.slice(0, 10).map(p => p.id)
      );
    });

    it('puts packs matching a focus area first', async () => {
      await setup(['life']);

      const matches = (id: string) =>
        HABIT_TEMPLATE_PACKS.find(p => p.id === id)!.habits.some(h => h.categoryId === 'life');

      const ids = featured().map(p => p.id);
      const lastMatch = ids.map(matches).lastIndexOf(true);
      const firstMiss = ids.map(matches).indexOf(false);

      expect(lastMatch).toBeGreaterThanOrEqual(0);
      // Every match precedes every non-match.
      if (firstMiss !== -1) expect(lastMatch).toBeLessThan(firstMiss);
    });

    it('keeps curated order WITHIN each group', async () => {
      // A comparator returning 0 for ties would not guarantee this, and the
      // order in habit-template-packs.ts is deliberate.
      await setup(['mind']);

      const matches = (id: string) =>
        HABIT_TEMPLATE_PACKS.find(p => p.id === id)!.habits.some(h => h.categoryId === 'mind');

      const curated = HABIT_TEMPLATE_PACKS.map(p => p.id);
      const shown = featured().map(p => p.id);

      const shownMatches = shown.filter(matches);
      const expectedMatches = curated.filter(matches).slice(0, shownMatches.length);
      expect(shownMatches).toEqual(expectedMatches);
    });

    it('still shows ten when the focus area matches only a couple of packs', async () => {
      await setup(['mind']);
      expect(featured().length).toBe(10);
    });

    it('never repeats a pack', async () => {
      await setup(['fitness', 'life']);
      const ids = featured().map(p => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('ignores a focus area that matches nothing', async () => {
      await setup(['not-a-real-category']);
      expect(featured().map(p => p.id)).toEqual(
        HABIT_TEMPLATE_PACKS.slice(0, 10).map(p => p.id)
      );
    });
  });

  describe('rendered grid', () => {
    it('renders one card per featured pack and no horizontal scroller', async () => {
      await setup();

      const grid = fixture.nativeElement.querySelector('.grid.grid-cols-2') as HTMLElement;
      expect(grid).toBeTruthy();
      expect(grid.className).not.toContain('overflow-x-auto');
      expect(grid.querySelectorAll('button').length).toBe(10);
    });

    it('keeps a route to the full list', async () => {
      await setup();
      const links = Array.from(
        fixture.nativeElement.querySelectorAll('a[href="/templates"]')
      ) as HTMLElement[];
      expect(links.length).toBeGreaterThan(0);
    });
  });
});
