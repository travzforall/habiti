import { provideTestUserId } from '@habiti/storage/testing';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { BaserowService } from './baserow.service';
import { HabitsService } from './habits';
import { SyncBus } from '@habiti/sync';

/**
 * Focused coverage of the two things onboarding depends on.
 *
 * HabitsService is large and reaches Baserow from its constructor, so this
 * stubs the whole data layer rather than attempting broad coverage.
 */
describe('HabitsService', () => {
  let baserowStub: {
    getHabits: jasmine.Spy;
    getHabitEntries: jasmine.Spy;
    getGameState: jasmine.Spy;
    getHabitCategories: jasmine.Spy;
  };

  function emptyList() {
    return of({ count: 0, next: null, previous: null, results: [] });
  }

  function configure(gameStateRow?: Record<string, unknown>) {
    baserowStub = {
      getHabits: jasmine.createSpy('getHabits').and.returnValue(emptyList()),
      getHabitEntries: jasmine.createSpy('getHabitEntries').and.returnValue(emptyList()),
      getGameState: jasmine
        .createSpy('getGameState')
        .and.returnValue(
          of({ count: 0, next: null, previous: null, results: gameStateRow ? [gameStateRow] : [] })
        ),
      getHabitCategories: jasmine.createSpy('getHabitCategories').and.returnValue(emptyList())
    };

    TestBed.configureTestingModule({
      providers: [
      provideTestUserId(),
        HabitsService,
        SyncBus,
        { provide: BaserowService, useValue: baserowStub },
        { provide: AuthService, useValue: { currentUserValue: { id: 1 } } }
      ]
    });

    return TestBed.inject(HabitsService);
  }

  describe('game state loading', () => {
    it('preserves user preferences that Baserow does not store', () => {
      // The Baserow game_state row carries only points, level and streaks. The
      // loader used to set() a fresh object with theme/weekStartsOn/
      // notifications/sound hardcoded, silently discarding the user's choices
      // on every single load.
      const service = configure();

      service.gameState.update(state => ({
        ...state,
        theme: 'dark',
        weekStartsOn: 'sunday',
        notificationsEnabled: false,
        soundEnabled: false
      }));

      service.loadDataFromDatabase();

      expect(service.gameState().theme).toBe('dark');
      expect(service.gameState().weekStartsOn).toBe('sunday');
      expect(service.gameState().notificationsEnabled).toBe(false);
      expect(service.gameState().soundEnabled).toBe(false);
    });

    it('still applies the server values it does own', () => {
      const service = configure();
      baserowStub.getGameState.and.returnValue(
        of({
          count: 1,
          next: null,
          previous: null,
          results: [{ total_points: 250, level: 6, daily_streak: 4, longest_streak: 11 }]
        })
      );

      service.loadDataFromDatabase();

      expect(service.gameState().totalPoints).toBe(250);
      expect(service.gameState().level).toBe(6);
      expect(service.gameState().dailyStreak).toBe(4);
      expect(service.gameState().longestStreak).toBe(11);
    });

    it('keeps unlocked achievements, which the same bug used to wipe', () => {
      const service = configure();
      baserowStub.getGameState.and.returnValue(
        of({ count: 1, next: null, previous: null, results: [{ total_points: 10, level: 2 }] })
      );

      service.gameState.update(state => ({ ...state, achievements: ['first-habit'] }));
      service.loadDataFromDatabase();

      expect(service.gameState().achievements).toEqual(['first-habit']);
    });
  });

  describe('dataLoaded', () => {
    it('flips true once the habit fetch returns', () => {
      const service = configure();

      // The constructor already ran one load, so reset to observe the next.
      service.dataLoaded.set(false);
      service.loadDataFromDatabase();

      expect(service.dataLoaded()).toBe(true);
    });

    it('flips true even when the fetch fails and falls back to localStorage', () => {
      const service = configure();
      baserowStub.getHabits.and.returnValue(throwError(() => new Error('offline')));

      service.dataLoaded.set(false);
      service.loadDataFromDatabase();

      // Otherwise an offline user is stuck in "still loading" forever and the
      // onboarding wizard never resolves.
      expect(service.dataLoaded()).toBe(true);
    });

    it('goes back to false on reset, so the next user is not read as brand new', () => {
      const service = configure();
      service.dataLoaded.set(true);

      service.reset();

      expect(service.dataLoaded()).toBe(false);
      expect(service.habits()).toEqual([]);
    });
  });
});
