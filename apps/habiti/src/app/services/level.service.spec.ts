import { provideTestUserId } from '@habiti/storage/testing';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { LevelService } from './level.service';
import { AuthService } from './auth.service';
import { BaserowService } from './baserow.service';
import { HabitsService } from './habits';
import { StatusService } from './status.service';
import { ToastService } from './toast.service';

class MockHabitsService {
  gameState = signal({
    totalPoints: 0,
    level: 1,
    achievements: [] as string[],
    dailyStreak: 0,
    longestStreak: 0,
    theme: 'auto' as const,
    weekStartsOn: 'monday' as const,
    notificationsEnabled: true,
    soundEnabled: true
  });
  habits = signal<any[]>([]);
  setLevel = jasmine.createSpy('setLevel');
}

class MockStatusService {
  celebrate = jasmine.createSpy('celebrate');
}

class MockAuthService {
  currentUserValue: { id: number } | null = { id: 42 };
}

class MockToastService {
  success = jasmine.createSpy('success');
}

class MockBaserowService {
  listAllRows = jasmine.createSpy('listAllRows').and.returnValue(of([]));
  createRow = jasmine.createSpy('createRow').and.returnValue(of(null));
  batchCreateRows = jasmine.createSpy('batchCreateRows').and.returnValue(of({ items: [] }));
}

function build() {
  TestBed.configureTestingModule({
    providers: [
      provideTestUserId(),
      LevelService,
      { provide: AuthService, useClass: MockAuthService },
      { provide: BaserowService, useClass: MockBaserowService },
      { provide: HabitsService, useClass: MockHabitsService },
      { provide: StatusService, useClass: MockStatusService },
      { provide: ToastService, useClass: MockToastService }
    ]
  });
  return {
    service: TestBed.inject(LevelService),
    habits: TestBed.inject(HabitsService) as unknown as MockHabitsService,
    status: TestBed.inject(StatusService) as unknown as MockStatusService,
    toast: TestBed.inject(ToastService) as unknown as MockToastService
  };
}

describe('LevelService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  afterEach(() => localStorage.clear());

  it('starts at level 1 with an empty ledger', () => {
    const { service } = build();
    expect(service.level()).toBe(1);
    expect(service.recordCount()).toBe(0);
  });

  describe('award', () => {
    it('raises the level and records the before/after chain', () => {
      const { service } = build();
      service.award({
        source: 'challenge',
        levels: 12,
        reason: 'Completed "7-Day Cold Start" on Hard',
        idempotencyKey: 'u:challenge:a'
      }).subscribe();

      expect(service.level()).toBe(13);
      const record = service.lastAward()!;
      expect(record.levelBefore).toBe(1);
      expect(record.levelAfter).toBe(13);
      expect(record.levelsAwarded).toBe(12);
    });

    it('refuses an award below one level — levels only go up', () => {
      const { service } = build();
      service.award({ source: 'manual', levels: 0, reason: 'x', idempotencyKey: 'k1' }).subscribe();
      service.award({ source: 'manual', levels: -5, reason: 'y', idempotencyKey: 'k2' }).subscribe();

      expect(service.level()).toBe(1);
      expect(service.recordCount()).toBe(0);
    });

    it('is idempotent — the same key never awards twice', () => {
      const { service } = build();
      const award = () =>
        service.award({
          source: 'challenge',
          levels: 10,
          reason: 'Completed a challenge',
          idempotencyKey: 'u:challenge:same'
        }).subscribe();

      award();
      award();
      award();

      expect(service.level()).toBe(11);
      expect(service.recordCount()).toBe(1);
    });

    it('celebrates and toasts a real award', () => {
      const { service, status, toast } = build();
      service.award({
        source: 'challenge',
        levels: 10,
        reason: 'Completed "First Seven"',
        idempotencyKey: 'u:challenge:b'
      }).subscribe();

      expect(status.celebrate).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalled();
      expect((toast.success as jasmine.Spy).calls.mostRecent().args[0]).toBe('Level 11!');
    });

    it('pushes the new level into HabitsService', () => {
      const { service, habits } = build();
      service.award({
        source: 'challenge',
        levels: 7,
        reason: 'r',
        idempotencyKey: 'u:challenge:c'
      }).subscribe();

      TestBed.tick();
      expect(habits.setLevel).toHaveBeenCalledWith(8);
    });

    it('keeps the award locally when the write fails, rather than losing it', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
      provideTestUserId(),
          LevelService,
          { provide: AuthService, useClass: MockAuthService },
          {
            provide: BaserowService,
            useValue: {
              listAllRows: () => of([]),
              createRow: () => throwError(() => new Error('offline')),
              batchCreateRows: () => of({ items: [] })
            }
          },
          { provide: HabitsService, useClass: MockHabitsService },
          { provide: StatusService, useClass: MockStatusService },
          { provide: ToastService, useClass: MockToastService }
        ]
      });
      const service = TestBed.inject(LevelService);

      service.award({
        source: 'challenge',
        levels: 9,
        reason: 'r',
        idempotencyKey: 'u:challenge:d'
      }).subscribe();

      expect(service.level()).toBe(10);
    });
  });

  describe('migration', () => {
    it('carries an existing points-derived level onto the ledger, once', () => {
      const { service, habits } = build();

      habits.gameState.update(s => ({ ...s, level: 5, totalPoints: 450 }));
      habits.habits.set([{ id: 'h1' }]);
      TestBed.tick();

      expect(service.level()).toBe(5);
      expect(service.recordCount()).toBe(1);
      expect(service.lastAward()!.source).toBe('migration');

      // A second settling of the signals must not award again.
      habits.gameState.update(s => ({ ...s, totalPoints: 460 }));
      TestBed.tick();
      expect(service.recordCount()).toBe(1);
      expect(service.level()).toBe(5);
    });

    it('takes the highest of the stored level and the points-derived level', () => {
      const { service, habits } = build();

      // level says 3, but 900 points would have meant level 10
      habits.gameState.update(s => ({ ...s, level: 3, totalPoints: 900 }));
      habits.habits.set([{ id: 'h1' }]);
      TestBed.tick();

      expect(service.level()).toBe(10);
    });

    it('is silent — no celebration for bookkeeping', () => {
      const { habits, status, toast } = build();

      habits.gameState.update(s => ({ ...s, level: 8, totalPoints: 700 }));
      habits.habits.set([{ id: 'h1' }]);
      TestBed.tick();

      expect(status.celebrate).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('does nothing for a brand new user', () => {
      const { service, habits } = build();
      habits.habits.set([{ id: 'h1' }]);
      TestBed.tick();

      expect(service.level()).toBe(1);
      expect(service.recordCount()).toBe(0);
    });

    it('waits for habit data instead of migrating against an empty gameState', () => {
      const { service } = build();
      // Habits have not loaded yet — nothing should have been written.
      TestBed.tick();
      expect(service.recordCount()).toBe(0);
    });

    it('does not migrate when the ledger already has records', () => {
      const { service, habits } = build();

      service.award({
        source: 'challenge',
        levels: 20,
        reason: 'r',
        idempotencyKey: 'u:challenge:e'
      }).subscribe();

      habits.gameState.update(s => ({ ...s, level: 5, totalPoints: 450 }));
      habits.habits.set([{ id: 'h1' }]);
      TestBed.tick();

      expect(service.recordCount()).toBe(1);
      expect(service.level()).toBe(21);
    });
  });

  describe('history grouping', () => {
    it('orders newest first', () => {
      const { service } = build();
      service.award({
        source: 'challenge', levels: 5, reason: 'older',
        idempotencyKey: 'k-old', occurredAt: new Date(2026, 0, 1)
      }).subscribe();
      service.award({
        source: 'challenge', levels: 5, reason: 'newer',
        idempotencyKey: 'k-new', occurredAt: new Date(2026, 5, 1)
      }).subscribe();

      expect(service.records()[0].reason).toBe('newer');
      expect(service.historySections()[0].monthLabel).toBe('June 2026');
    });
  });
});
