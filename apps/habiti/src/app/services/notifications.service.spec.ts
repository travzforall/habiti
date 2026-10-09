import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { NotificationsService } from './notifications.service';
import { AuthService } from './auth.service';
import { ChallengeService } from './challenge.service';
import { FriendsService } from './friends.service';
import { ToastService } from './toast.service';
import { Friend } from '../models/friend.models';

const SEEN_KEY = 'habiti-seen-notifications';

class MockFriendsService {
  incomingRequests = signal<Friend[]>([]);
  friends = signal<Friend[]>([]);
  outgoingRequests = signal<Friend[]>([]);
  /** The effect waits for real data before baselining or toasting. */
  hydrated = signal(true);
}

class MockChallengeService {
  partnerInvites = signal<any[]>([]);
  runs = signal<any[]>([]);
  openSettlements = signal<any[]>([]);
  hydrated = signal(true);
}

class MockAuthService {
  currentUserValue = { id: 1 };
}

class MockToastService {
  info = jasmine.createSpy('info');
  success = jasmine.createSpy('success');
  warning = jasmine.createSpy('warning');
  error = jasmine.createSpy('error');
}

function friend(over: Partial<Friend> = {}): Friend {
  return {
    friendshipId: 'f1',
    email: 'them@example.com',
    name: 'Them',
    status: 'pending',
    iInitiated: false,
    ...over
  };
}

function build() {
  TestBed.configureTestingModule({
    providers: [
      NotificationsService,
      { provide: FriendsService, useClass: MockFriendsService },
      { provide: ChallengeService, useClass: MockChallengeService },
      { provide: AuthService, useClass: MockAuthService },
      { provide: ToastService, useClass: MockToastService }
    ]
  });
  return {
    service: TestBed.inject(NotificationsService),
    friends: TestBed.inject(FriendsService) as unknown as MockFriendsService,
    challenges: TestBed.inject(ChallengeService) as unknown as MockChallengeService,
    toast: TestBed.inject(ToastService) as unknown as MockToastService
  };
}

describe('NotificationsService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  afterEach(() => localStorage.clear());

  it('is empty with nothing going on', () => {
    const { service } = build();
    TestBed.tick();
    expect(service.all().length).toBe(0);
    expect(service.unreadCount()).toBe(0);
  });

  describe('what it reports', () => {
    it('reports an incoming friend request', () => {
      const { service, friends } = build();
      TestBed.tick();

      friends.incomingRequests.set([friend({ name: 'Ada' })]);
      TestBed.tick();

      expect(service.all()[0].kind).toBe('friend_request');
      expect(service.all()[0].title).toContain('Ada');
    });

    it('tells the SENDER their invite was accepted, not the accepter', () => {
      const { service, friends } = build();
      TestBed.tick();

      // I accepted someone else's invite — I already know, no notification.
      friends.friends.set([friend({ status: 'accepted', iInitiated: false })]);
      TestBed.tick();
      expect(service.all().length).toBe(0);

      // They accepted mine — that I want to hear about.
      friends.friends.set([friend({ status: 'accepted', iInitiated: true, name: 'Ada' })]);
      TestBed.tick();
      expect(service.all()[0].kind).toBe('friend_accepted');
      expect(service.all()[0].title).toContain('Ada');
    });

    it('reports a declined invite — otherwise the sender never finds out', () => {
      const { service, friends } = build();
      TestBed.tick();

      friends.outgoingRequests.set([friend({ status: 'declined', iInitiated: true, name: 'Ada' })]);
      TestBed.tick();

      expect(service.all()[0].kind).toBe('friend_declined');
    });

    it('ignores a still-pending outgoing invite', () => {
      const { service, friends } = build();
      TestBed.tick();

      friends.outgoingRequests.set([friend({ status: 'pending', iInitiated: true })]);
      TestBed.tick();

      expect(service.all().length).toBe(0);
    });

    it('reports a partner joining a challenge I own', () => {
      const { service, challenges } = build();
      TestBed.tick();

      challenges.runs.set([
        {
          campaignKey: 'chl_1',
          title: 'Iron Thirty',
          icon: '🏋️',
          ownerUserId: '1',
          createdAt: new Date().toISOString(),
          participants: [
            { userId: '1', name: 'Me', isOwner: true, inviteStatus: 'accepted', checkIns: [] },
            { userId: '2', name: 'Ada', isOwner: false, inviteStatus: 'accepted', checkIns: [] }
          ]
        }
      ]);
      TestBed.tick();

      expect(service.all()[0].kind).toBe('challenge_joined');
      expect(service.all()[0].title).toContain('Ada');
    });

    it('does not report on challenges I do not own', () => {
      const { service, challenges } = build();
      TestBed.tick();

      challenges.runs.set([
        {
          campaignKey: 'chl_1',
          title: 'Iron Thirty',
          ownerUserId: '99',
          createdAt: new Date().toISOString(),
          participants: [
            { userId: '99', name: 'Someone', isOwner: true, inviteStatus: 'accepted', checkIns: [] },
            { userId: '1', name: 'Me', isOwner: false, inviteStatus: 'accepted', checkIns: [] }
          ]
        }
      ]);
      TestBed.tick();

      expect(service.all().length).toBe(0);
    });
  });

  describe('read state', () => {
    it('does not toast a wall of history on a first-ever load', () => {
      // No stored "seen" set: everything already there is baselined silently.
      const { service, friends, toast } = build();
      friends.incomingRequests.set([friend(), friend({ friendshipId: 'f2' })]);
      TestBed.tick();

      expect(toast.info).not.toHaveBeenCalled();
      expect(service.unreadCount()).toBe(0);
    });

    it('toasts something genuinely new after the baseline', () => {
      const { friends, toast } = build();
      TestBed.tick();

      friends.incomingRequests.set([friend({ name: 'Ada' })]);
      TestBed.tick();

      expect(toast.info).toHaveBeenCalled();
      expect((toast.info as jasmine.Spy).calls.mostRecent().args[0]).toContain('Ada');
    });

    it('toasts each thing only once, however often the data reloads', () => {
      const { friends, toast } = build();
      TestBed.tick();

      friends.incomingRequests.set([friend({ name: 'Ada' })]);
      TestBed.tick();
      // A poll returns the same row again.
      friends.incomingRequests.set([friend({ name: 'Ada' })]);
      TestBed.tick();

      expect((toast.info as jasmine.Spy).calls.count()).toBe(1);
    });

    it('marking read clears the badge and survives a reload', () => {
      const { service, friends } = build();
      TestBed.tick();

      friends.incomingRequests.set([friend()]);
      TestBed.tick();
      expect(service.unreadCount()).toBe(1);

      service.markAllRead();
      expect(service.unreadCount()).toBe(0);

      const stored = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]');
      // Derived, not hardcoded: the id carries an occurrence stamp so that a
      // re-invite on the same row is a distinct notification.
      expect(stored.length).toBe(1);
      expect(stored[0]).toMatch(/^friend_request:f1:/);
    });

    it('marks a single item read without touching the others', () => {
      const { service, friends } = build();
      TestBed.tick();

      friends.incomingRequests.set([friend(), friend({ friendshipId: 'f2' })]);
      TestBed.tick();
      expect(service.unreadCount()).toBe(2);

      const first = service.all().find(n => n.id.startsWith('friend_request:f1:'))!;
      service.markRead(first.id);
      expect(service.unreadCount()).toBe(1);
      expect(service.unread()[0].id).toMatch(/^friend_request:f2:/);
    });
  });
});


/**
 * A re-invite must notify again.
 *
 * Re-inviting revives the SAME friendship row, so an id built from the row
 * alone made the second invite indistinguishable from the first. Dismissing
 * one — or the first-load baseline, which marks everything present as seen and
 * persists it — permanently muted that row. In practice: someone re-invites
 * you, the badge moves, and no toast ever appears again.
 */
describe('NotificationsService re-invites', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });
  afterEach(() => localStorage.clear());

  const invite = (at: Date) =>
    friend({ friendshipId: '10', name: 'Testing User', invitedAt: at });

  /**
   * Invite timestamps are RELATIVE to now, and have to be.
   *
   * They used to be pinned at 2026-08-09T01:00:00Z. NotificationsService
   * ignores anything older than seven days — deliberately, so a stale seen-set
   * cannot produce a wall of toasts about ancient history — so on
   * 2026-08-16T01:00Z these fixtures aged out of the window and both tests
   * began failing on unmodified code. A test that starts failing because time
   * passed teaches everyone to ignore a red suite.
   */
  const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);

  it('toasts again when the same row is re-invited', () => {
    const { service, friends, toast } = build();
    TestBed.tick();

    friends.incomingRequests.set([invite(hoursAgo(3))]);
    TestBed.tick();
    expect(toast.info).toHaveBeenCalledTimes(1);

    // Dismissed, exactly as the bell or the baseline would.
    service.markAllRead();
    TestBed.tick();

    // Withdrawn, then sent again — same row id, new timestamp.
    friends.incomingRequests.set([]);
    TestBed.tick();
    friends.incomingRequests.set([invite(hoursAgo(1))]);
    TestBed.tick();

    expect(toast.info).toHaveBeenCalledTimes(2);
  });

  it('still does not toast the same invite twice', () => {
    const { friends, toast } = build();
    TestBed.tick();

    const at = hoursAgo(3);
    friends.incomingRequests.set([invite(at)]);
    TestBed.tick();
    // A poll and a push both landing must not double up.
    friends.incomingRequests.set([invite(at)]);
    TestBed.tick();

    expect(toast.info).toHaveBeenCalledTimes(1);
  });

  it('survives an invite with no timestamp', () => {
    const { friends, toast } = build();
    TestBed.tick();

    friends.incomingRequests.set([friend({ friendshipId: '11', name: 'Ada' })]);
    TestBed.tick();

    expect(toast.info).toHaveBeenCalledTimes(1);
  });
});
