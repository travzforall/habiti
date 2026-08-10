import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { BehaviorSubject, Observable, Subject, of } from 'rxjs';
import { SyncService, TIMER_PORT, TimerPort } from './sync.service';
import { SyncBus } from './sync-bus';
import { TabBus } from './tab-bus';
import { RealtimeService } from './realtime.service';
import { NotificationsService } from './notifications.service';
import { AuthService } from './auth.service';
import { ChallengeService } from './challenge.service';
import { DailyContentService } from './daily-content.service';
import { FriendsService } from './friends.service';
import { HabitsService } from './habits';
import { LevelService } from './level.service';
import { ToastService } from './toast.service';
import { TasksService } from './tasks.service';
import { ProjectsService } from './projects.service';
import { UserStorage } from '@habiti/storage';
import { SkillsService } from './skills.service';
import { provideSyncRefreshers } from './sync-refreshers.providers';
import { RelayEnvelope } from '@habiti/realtime-protocol';
import { Friend } from '../models/friend.models';

/**
 * The receiver's experience, end to end, with no component in sight.
 *
 * "A toast appears no matter what page they are on" is a claim about the
 * SERVICE layer: a relay hint arrives, the right data refreshes, and a toast is
 * raised — all without any page being mounted or asked. The existing sync spec
 * mocks NotificationsService and so can prove none of it.
 *
 * Real SyncService, real SyncBus, real NotificationsService. Only the network
 * edges are faked.
 */

class FakeTimer implements TimerPort {
  setInterval(): number {
    return 1;
  }
  clearInterval(): void {}
  now(): number {
    return 0;
  }
}

class FakeRealtime {
  readonly events = new Subject<RelayEnvelope>();
  readonly events$: Observable<RelayEnvelope> = this.events.asObservable();
  isLive = signal(true);
  connect = jasmine.createSpy('connect');
  disconnect = jasmine.createSpy('disconnect');
  nudge = jasmine.createSpy('nudge');
  publish = jasmine.createSpy('publish').and.returnValue(true);

  /** What the relay delivers when someone invites this user. */
  deliverInvite(): void {
    this.events.next({
      v: 1,
      kind: 'friend.invited',
      from: '1',
      to: [{ email: 'me@example.com' }],
      at: new Date().toISOString(),
      nonce: 'n1',
      hint: { scope: ['friends'] }
    });
  }
}

function friend(over: Partial<Friend> = {}): Friend {
  return {
    friendshipId: 'f1',
    email: 'them@example.com',
    name: 'Ada',
    status: 'pending',
    iInitiated: false,
    ...over
  };
}

class MockFriends {
  incomingRequests = signal<Friend[]>([]);
  friends = signal<Friend[]>([]);
  outgoingRequests = signal<Friend[]>([]);
  pendingOutgoing = signal<Friend[]>([]);
  hydrated = signal(true);
  reset = jasmine.createSpy('reset');

  /** Stands in for the server: refreshing is what surfaces the new invite. */
  pendingFromServer: Friend[] = [];
  refresh = jasmine.createSpy('refresh').and.callFake(() => {
    this.incomingRequests.set([...this.pendingFromServer]);
    return of(undefined);
  });
}

class MockChallenges {
  activeRuns = signal<any[]>([]);
  runs = signal<any[]>([]);
  partnerInvites = signal<any[]>([]);
  openSettlements = signal<any[]>([]);
  settlementsToConfirm = signal<any[]>([]);
  hydrated = signal(true);
  refreshRuns = jasmine.createSpy('refreshRuns').and.returnValue(of(undefined));
  refreshSettlements = jasmine.createSpy('refreshSettlements').and.returnValue(of(undefined));
  reset = jasmine.createSpy('reset');
  setToday = jasmine.createSpy('setToday');
}

class MockToast {
  info = jasmine.createSpy('info');
  success = jasmine.createSpy('success');
  warning = jasmine.createSpy('warning');
  error = jasmine.createSpy('error');
}

class MockAuth {
  subject = new BehaviorSubject<any>({ id: 6, email: 'me@example.com' });
  currentUser = this.subject.asObservable();
  get currentUserValue() {
    return this.subject.value;
  }
  getToken = () => 'token';
}

/**
 * Lets the in-flight sync promise settle, then flushes effects.
 *
 * syncNow() returns a promise, and a hint arriving while one is still in
 * flight is folded into a queued set rather than run immediately. Without
 * draining microtasks the envelope's refresh never happens and the test
 * measures the auth sync instead.
 */
async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
}

async function build() {
  Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
  Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true });
  localStorage.clear();

  const realtime = new FakeRealtime();

  TestBed.configureTestingModule({
    providers: [
      SyncService,
      SyncBus,
      TabBus,
      NotificationsService,
      { provide: TIMER_PORT, useClass: FakeTimer },
      { provide: RealtimeService, useValue: realtime },
      { provide: AuthService, useClass: MockAuth },
      { provide: FriendsService, useClass: MockFriends },
      { provide: ChallengeService, useClass: MockChallenges },
      { provide: ToastService, useClass: MockToast },
      // Server-backed but locally cached; only reload() is reachable from here.
      { provide: TasksService, useValue: { reload: () => {} } },
      { provide: ProjectsService, useValue: { reload: () => {} } },
      { provide: UserStorage, useValue: { resetMigrationState: () => {} } },
      { provide: SkillsService, useValue: { reload: () => {} } },
      { provide: LevelService, useValue: { refresh: () => of(undefined), reset: () => {}, hasAwardsInFlight: () => false } },
      { provide: HabitsService, useValue: { refresh: () => of(undefined), reset: () => {} } },
      {
        provide: DailyContentService,
        useValue: { refresh: () => of(undefined), reset: () => {}, refreshForToday: () => {} }
      },

      // Without this SyncService has an empty refresher registry and reloads
      // NOTHING — no error, no warning, just a relay hint that arrives and does
      // nothing. Which is precisely the end-to-end path this file exists to
      // prove, so leaving it out fails these tests rather than weakening them.
      provideSyncRefreshers()
    ]
  });

  const sync = TestBed.inject(SyncService);
  const notifications = TestBed.inject(NotificationsService);
  const friends = TestBed.inject(FriendsService) as unknown as MockFriends;
  const toast = TestBed.inject(ToastService) as unknown as MockToast;

  // Settle the baseline pass: everything already present counts as seen, so
  // the user is not buried in toasts for history on first load.
  await flush();
  toast.info.calls.reset();

  return { sync, notifications, friends, toast, realtime };
}

describe('a pushed invite reaches the receiver as a toast', () => {
  afterEach(() => localStorage.clear());

  it('toasts when the relay delivers a friend invite', async () => {
    const { realtime, friends, toast } = await build();

    friends.pendingFromServer = [friend({ name: 'Ada' })];
    realtime.deliverInvite();
    await flush();

    expect(friends.refresh).toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalled();
    expect(toast.info.calls.mostRecent().args[0]).toContain('Ada');
  });

  it('needs no page mounted — this is why it works on any route', async () => {
    // Nothing here creates a component. The chain is relay -> SyncService ->
    // FriendsService -> NotificationsService -> ToastService, all root-level,
    // so the active route is irrelevant.
    const { realtime, friends, toast } = await build();

    friends.pendingFromServer = [friend({ name: 'Grace' })];
    realtime.deliverInvite();
    await flush();

    expect(toast.info).toHaveBeenCalledTimes(1);
  });

  it('refreshes only what the hint names', async () => {
    const { realtime, friends } = await build();
    const challenges = TestBed.inject(ChallengeService) as unknown as MockChallenges;
    challenges.refreshRuns.calls.reset();

    realtime.deliverInvite();
    await flush();

    expect(friends.refresh).toHaveBeenCalled();
    // A friend hint must not drag the whole app through a reload.
    expect(challenges.refreshRuns).not.toHaveBeenCalled();
  });

  it('does not toast the same invite twice when a second hint arrives', async () => {
    const { realtime, friends, toast } = await build();

    friends.pendingFromServer = [friend({ name: 'Ada' })];
    realtime.deliverInvite();
    await flush();
    realtime.deliverInvite();
    await flush();

    // Duplicate hints are normal — a poll and a push can both land.
    expect(toast.info).toHaveBeenCalledTimes(1);
  });

  it('toasts each distinct invite', async () => {
    const { realtime, friends, toast } = await build();

    friends.pendingFromServer = [friend({ friendshipId: 'f1', name: 'Ada' })];
    realtime.deliverInvite();
    await flush();

    friends.pendingFromServer = [
      friend({ friendshipId: 'f1', name: 'Ada' }),
      friend({ friendshipId: 'f2', name: 'Grace' })
    ];
    realtime.deliverInvite();
    await flush();

    expect(toast.info).toHaveBeenCalledTimes(2);
    expect(toast.info.calls.mostRecent().args[0]).toContain('Grace');
  });
});
