import { provideTestUserId } from '@habiti/storage/testing';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { BehaviorSubject, of } from 'rxjs';
import { SyncService, TIMER_PORT, TimerPort } from './sync.service';
import { SyncBus } from './sync-bus';
import { AuthService } from './auth.service';
import { ChallengeService } from './challenge.service';
import { DailyContentService } from './daily-content.service';
import { FriendsService } from './friends.service';
import { HabitsService } from './habits';
import { LevelService } from './level.service';
import { NotificationsService } from './notifications.service';
import { TasksService } from './tasks.service';
import { ProjectsService } from './projects.service';
import { UserStorage } from '@habiti/storage';
import { SkillsService } from './skills.service';
import { provideSyncRefreshers } from './sync-refreshers.providers';

/** Drives time synchronously — jasmine.clock() fights zone and effect scheduling. */
class FakeTimer implements TimerPort {
  private handlers = new Map<number, { fn: () => void; ms: number; next: number }>();
  private nextHandle = 1;
  private clock = 0;

  setInterval(fn: () => void, ms: number): number {
    const handle = this.nextHandle++;
    this.handlers.set(handle, { fn, ms, next: this.clock + ms });
    return handle;
  }
  clearInterval(handle: number): void {
    this.handlers.delete(handle);
  }
  now(): number {
    return this.clock;
  }

  /** Number of live intervals — proves a paused timer was torn down. */
  get activeCount(): number {
    return this.handlers.size;
  }

  advance(ms: number): void {
    const target = this.clock + ms;
    let guard = 0;
    while (guard++ < 1000) {
      const due = [...this.handlers.entries()]
        .filter(([, h]) => h.next <= target)
        .sort((a, b) => a[1].next - b[1].next)[0];
      if (!due) break;
      const [handle, h] = due;
      this.clock = h.next;
      h.next += h.ms;
      h.fn();
      if (!this.handlers.has(handle)) continue;
    }
    this.clock = target;
  }
}

function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { get: () => state, configurable: true });
  Object.defineProperty(document, 'hidden', { get: () => state === 'hidden', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

function setOnline(on: boolean): void {
  Object.defineProperty(navigator, 'onLine', { get: () => on, configurable: true });
  window.dispatchEvent(new Event(on ? 'online' : 'offline'));
}

class MockFriends {
  pendingOutgoing = signal<any[]>([]);
  incomingRequests = signal<any[]>([]);
  refresh = jasmine.createSpy('friends.refresh').and.returnValue(of(undefined));
  reset = jasmine.createSpy('friends.reset');
}
class MockChallenges {
  activeRuns = signal<any[]>([]);
  settlementsToConfirm = signal<any[]>([]);
  refreshRuns = jasmine.createSpy('challenges.refreshRuns').and.returnValue(of(undefined));
  refreshSettlements = jasmine.createSpy('challenges.refreshSettlements').and.returnValue(of(undefined));
  reset = jasmine.createSpy('challenges.reset');
  setToday = jasmine.createSpy('challenges.setToday');
}
class MockLevels {
  refresh = jasmine.createSpy('levels.refresh').and.returnValue(of(undefined));
  reset = jasmine.createSpy('levels.reset');
  hasAwardsInFlight = jasmine.createSpy('levels.hasAwardsInFlight').and.returnValue(false);
}
class MockHabits {
  refresh = jasmine.createSpy('habits.refresh').and.returnValue(of(undefined));
  reset = jasmine.createSpy('habits.reset');
}
class MockDailyContent {
  refresh = jasmine.createSpy('daily.refresh').and.returnValue(of(undefined));
  reset = jasmine.createSpy('daily.reset');
  refreshForToday = jasmine.createSpy('daily.refreshForToday');
}
class MockNotifications {
  reset = jasmine.createSpy('notifications.reset');
}
class MockTasks {
  reload = jasmine.createSpy('tasks.reload');
}
class MockProjects {
  reload = jasmine.createSpy('projects.reload');
}
class MockUserStorage {
  resetMigrationState = jasmine.createSpy('storage.resetMigrationState');
}
class MockSkills {
  reload = jasmine.createSpy('skills.reload');
}
class MockAuth {
  subject = new BehaviorSubject<any>({ id: 1 });
  currentUser = this.subject.asObservable();
  get currentUserValue() {
    return this.subject.value;
  }
}

function build() {
  const timer = new FakeTimer();
  setVisibility('visible');
  setOnline(true);

  TestBed.configureTestingModule({
    providers: [
      provideTestUserId(),
      SyncService,
      SyncBus,
      { provide: TIMER_PORT, useValue: timer },
      { provide: AuthService, useClass: MockAuth },
      { provide: FriendsService, useClass: MockFriends },
      { provide: ChallengeService, useClass: MockChallenges },
      { provide: LevelService, useClass: MockLevels },
      { provide: HabitsService, useClass: MockHabits },
      { provide: DailyContentService, useClass: MockDailyContent },
      { provide: NotificationsService, useClass: MockNotifications },
      { provide: TasksService, useClass: MockTasks },
      { provide: ProjectsService, useClass: MockProjects },
      { provide: UserStorage, useClass: MockUserStorage },
      { provide: SkillsService, useClass: MockSkills },

      /**
       * The REAL refresher wiring, over the mocks above.
       *
       * SyncService no longer names any domain — it reads SYNC_REFRESHERS — so
       * hand-rolling fake refreshers here would test the scheduler against a
       * registry the app does not use, and every one of these assertions would
       * keep passing while the production wiring was wrong. Using the real
       * providers means this spec covers sync-refreshers.providers.ts too:
       * the settlements de-duplication and the levels in-flight skip are
       * declared there now, and are asserted below.
       */
      provideSyncRefreshers()
    ]
  });

  const service = TestBed.inject(SyncService);
  TestBed.tick();

  return {
    timer,
    service,
    friends: TestBed.inject(FriendsService) as unknown as MockFriends,
    challenges: TestBed.inject(ChallengeService) as unknown as MockChallenges,
    levels: TestBed.inject(LevelService) as unknown as MockLevels,
    bus: TestBed.inject(SyncBus),
    auth: TestBed.inject(AuthService) as unknown as MockAuth
  };
}

describe('SyncService', () => {
  beforeEach(() => TestBed.resetTestingModule());
  afterEach(() => {
    setVisibility('visible');
    setOnline(true);
  });

  describe('adaptive cadence', () => {
    it('polls slowly when nothing is pending', () => {
      const { service } = build();
      expect(service.currentIntervalMs()).toBe(60_000);
    });

    it('polls fast while an invite is unanswered, and slows down when it clears', () => {
      const { service, friends } = build();

      friends.pendingOutgoing.set([{ friendshipId: 'f1' }]);
      TestBed.tick();
      expect(service.currentIntervalMs()).toBe(10_000);

      friends.pendingOutgoing.set([]);
      TestBed.tick();
      expect(service.currentIntervalMs()).toBe(60_000);
    });

    it('polls fast while a challenge invite is unanswered', () => {
      const { service, challenges } = build();
      challenges.activeRuns.set([
        { id: 'r1', participants: [{ inviteStatus: 'invited' }] }
      ]);
      TestBed.tick();
      expect(service.currentIntervalMs()).toBe(10_000);
    });

    it('TEARS DOWN the timer when hidden rather than skipping ticks', () => {
      const { service, timer, friends } = build();
      expect(timer.activeCount).toBe(1);

      setVisibility('hidden');
      TestBed.tick();

      expect(service.currentIntervalMs()).toBe(0);
      expect(timer.activeCount).toBe(0);

      // Ten minutes in a background tab costs nothing. Counted from here,
      // because logging in already triggered one sync at construction.
      friends.refresh.calls.reset();
      timer.advance(600_000);
      expect(friends.refresh).not.toHaveBeenCalled();
    });

    it('pauses when offline and resumes on reconnect', () => {
      const { service, timer } = build();

      setOnline(false);
      TestBed.tick();
      expect(timer.activeCount).toBe(0);

      setOnline(true);
      TestBed.tick();
      expect(service.currentIntervalMs()).toBe(60_000);
    });
  });

  describe('triggers', () => {
    it('syncs on the interval', async () => {
      const { timer, friends } = build();
      timer.advance(60_000);
      await Promise.resolve();
      expect(friends.refresh).toHaveBeenCalled();
    });

    it('syncs immediately on refocus', async () => {
      const { friends } = build();
      setVisibility('hidden');
      setVisibility('visible');
      await Promise.resolve();
      expect(friends.refresh).toHaveBeenCalled();
    });

    it('does nothing at all while signed out', async () => {
      const { service, auth, friends } = build();
      friends.refresh.calls.reset();

      auth.subject.next(null);
      await service.syncNow('manual');

      expect(friends.refresh).not.toHaveBeenCalled();
    });

    it('resets everything on an account switch, before syncing', async () => {
      const { auth, friends, challenges } = build();

      auth.subject.next({ id: 2 });
      await Promise.resolve();

      expect(friends.reset).toHaveBeenCalled();
      expect(challenges.reset).toHaveBeenCalled();
    });
  });

  describe('targeted refresh', () => {
    it('a friends hint does NOT reload challenges', async () => {
      const { service, friends, challenges } = build();
      friends.refresh.calls.reset();
      challenges.refreshRuns.calls.reset();

      await service.syncNow('realtime', ['friends']);

      expect(friends.refresh).toHaveBeenCalled();
      expect(challenges.refreshRuns).not.toHaveBeenCalled();
    });

    it('a mutation opens the hot window', () => {
      const { service, bus } = build();
      expect(service.currentIntervalMs()).toBe(60_000);

      bus.touched('friends');
      TestBed.tick();

      expect(service.currentIntervalMs()).toBe(10_000);
    });

    it('skips levels while an award is still being written', async () => {
      const { service, levels } = build();
      levels.refresh.calls.reset();
      levels.hasAwardsInFlight.and.returnValue(true);

      await service.syncNow('interval', ['levels']);

      // Refreshing mid-write would wipe the optimistic record and the level
      // would visibly drop back.
      expect(levels.refresh).not.toHaveBeenCalled();
    });

    it('asking for settlements alone fetches only settlements', async () => {
      const { service, challenges } = build();
      challenges.refreshRuns.calls.reset();
      challenges.refreshSettlements.calls.reset();

      await service.syncNow('realtime', ['settlements']);

      expect(challenges.refreshSettlements).toHaveBeenCalled();
      expect(challenges.refreshRuns).not.toHaveBeenCalled();
    });

    it('asking for both does NOT fetch settlements twice', async () => {
      const { service, challenges } = build();
      challenges.refreshRuns.calls.reset();
      challenges.refreshSettlements.calls.reset();

      await service.syncNow('realtime', ['challenges', 'settlements']);

      // refreshRuns already reloads settlements. One service owning two scopes
      // is the reason SyncRefresher.refresh() is handed the whole requested
      // set rather than only the scopes it declared.
      expect(challenges.refreshRuns).toHaveBeenCalled();
      expect(challenges.refreshSettlements).not.toHaveBeenCalled();
    });
  });

  describe('the refresher registry', () => {
    it('a full pass covers every registered scope', async () => {
      const { service, friends, challenges, levels } = build();
      friends.refresh.calls.reset();
      challenges.refreshRuns.calls.reset();
      levels.refresh.calls.reset();

      // No scope argument: the list is derived from the registry, so a domain
      // that registers is swept in without SyncService being edited.
      await service.syncNow('manual');

      expect(friends.refresh).toHaveBeenCalled();
      expect(challenges.refreshRuns).toHaveBeenCalled();
      expect(levels.refresh).toHaveBeenCalled();
    });

    it('runs with an empty registry instead of throwing', async () => {
      const timer = new FakeTimer();
      setVisibility('visible');
      setOnline(true);

      // A host with no features registered — the shape SyncService is in once
      // it moves to a shared library and before anything provides refreshers.
      TestBed.configureTestingModule({
        providers: [
      provideTestUserId(),
          SyncService,
          SyncBus,
          { provide: TIMER_PORT, useValue: timer },
          { provide: AuthService, useClass: MockAuth },
          { provide: NotificationsService, useClass: MockNotifications },
          { provide: UserStorage, useClass: MockUserStorage }
        ]
      });

      const service = TestBed.inject(SyncService);
      TestBed.tick();

      await service.syncNow('manual');

      // Cadence and connection state still work; there is simply nothing to load.
      expect(service.lastSyncAt()).not.toBeNull();
      expect(service.lastError()).toBeNull();
      expect(service.currentIntervalMs()).toBe(60_000);
    });
  });

  describe('in-flight guard', () => {
    it('collapses overlapping syncs instead of stacking them', async () => {
      const { service, friends } = build();
      friends.refresh.calls.reset();

      const a = service.syncNow('manual');
      const b = service.syncNow('manual');
      expect(a).toBe(b);

      await a;
      expect(friends.refresh.calls.count()).toBe(1);
    });
  });

  it('records the last sync time only on success', async () => {
    const { service } = build();
    expect(service.lastSyncAt()).toBeNull();

    await service.syncNow('manual');
    expect(service.lastSyncAt()).not.toBeNull();
  });
});
