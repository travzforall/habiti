import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FriendsService } from './friends.service';
import { AuthService } from './auth.service';
import { BaserowService } from './baserow.service';
import { ToastService } from './toast.service';
import { FriendshipRow } from '../models/friend.models';
import { SyncBus } from '@habiti/sync';
import { OutboundEvent } from '@habiti/realtime-protocol';

const ME = { id: 1, name: 'Testing User', email: 'test@test.com' };
const THEM = 'jstain@email.com';

class MockAuthService {
  currentUserValue: any = ME;
}

class MockToastService {
  success = jasmine.createSpy('success');
  info = jasmine.createSpy('info');
  warning = jasmine.createSpy('warning');
  error = jasmine.createSpy('error');
}

class MockBaserowService {
  rows: FriendshipRow[] = [];
  createRow = jasmine.createSpy('createRow').and.callFake((_t: number, data: any) => {
    const row = { id: 99, ...data } as FriendshipRow;
    this.rows.push(row);
    return of(row);
  });
  updateRow = jasmine.createSpy('updateRow').and.callFake((_t: number, id: number, data: any) => {
    const existing = this.rows.find(r => r.id === id) ?? ({ id } as FriendshipRow);
    const merged = { ...existing, ...data } as FriendshipRow;
    return of(merged);
  });
  deleteRow = jasmine.createSpy('deleteRow').and.returnValue(of(undefined));
  listAllRows = jasmine.createSpy('listAllRows').and.callFake(() => of(this.rows));
}

function build(seed: FriendshipRow[] = []) {
  TestBed.configureTestingModule({
    providers: [
      FriendsService,
      SyncBus,
      { provide: AuthService, useClass: MockAuthService },
      { provide: BaserowService, useClass: MockBaserowService },
      { provide: ToastService, useClass: MockToastService }
    ]
  });

  const baserow = TestBed.inject(BaserowService) as unknown as MockBaserowService;
  baserow.rows = [...seed];

  // Capture what goes out to the relay. Every one of these is invisible from
  // the UI, so only a test can tell whether the other side was ever told.
  const published: OutboundEvent[] = [];
  TestBed.inject(SyncBus).outbound$.subscribe(event => published.push(event));

  const service = TestBed.inject(FriendsService);
  service.load();

  return {
    service,
    baserow,
    published,
    toast: TestBed.inject(ToastService) as unknown as MockToastService
  };
}

function row(over: Partial<FriendshipRow> = {}): FriendshipRow {
  return {
    id: 8,
    requester_user_id: '1',
    requester_name: 'Testing User',
    requester_email: ME.email,
    addressee_email: THEM,
    status: 'declined',
    ...over
  } as FriendshipRow;
}

describe('FriendsService.sendRequest', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('creates a row for a brand new invite', () => {
    const { service, baserow } = build();
    service.sendRequest(THEM).subscribe();

    expect(baserow.createRow).toHaveBeenCalled();
    expect(service.outgoingRequests().length).toBe(1);
  });

  it('rejects an invite to yourself', () => {
    const { service, baserow, toast } = build();
    service.sendRequest(ME.email).subscribe();

    expect(baserow.createRow).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalled();
  });

  it('rejects an address with a space in it', () => {
    // The real one: a stray character before the address created a pending
    // invite to an account that cannot exist, and the intended recipient was
    // never told anything. "includes('@')" happily accepted it.
    const { service, baserow, toast } = build();
    service.sendRequest('j jstain@email.com').subscribe();

    expect(baserow.createRow).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalled();
  });

  it('rejects addresses with no domain suffix', () => {
    const { service, baserow } = build();
    for (const bad of ['jstain@email', 'jstain@', '@email.com', 'jstain email.com']) {
      service.sendRequest(bad).subscribe();
    }
    expect(baserow.createRow).not.toHaveBeenCalled();
  });

  it('accepts ordinary addresses, including plus-tags and subdomains', () => {
    const { service, baserow } = build();
    service.sendRequest('  First.Last+tag@mail.example.co.uk  ').subscribe();
    expect(baserow.createRow).toHaveBeenCalled();
  });

  it('rejects something that is not an email', () => {
    const { service, baserow } = build();
    service.sendRequest('not-an-email').subscribe();
    expect(baserow.createRow).not.toHaveBeenCalled();
  });

  describe('re-inviting after a decline', () => {
    it('REVIVES the existing row instead of creating a second one', () => {
      // The bug this fixes: one pair ended up with a declined row and no way
      // back, because a plain duplicate guard refused the re-invite.
      const { service, baserow } = build([row({ status: 'declined' })]);

      service.sendRequest(THEM, 'second try').subscribe();

      expect(baserow.createRow).not.toHaveBeenCalled();
      expect(baserow.updateRow).toHaveBeenCalled();

      const [, id, patch] = baserow.updateRow.calls.mostRecent().args;
      expect(id).toBe(8);
      expect(patch.status).toBe('pending');
      expect(patch.invite_message).toBe('second try');
    });

    it('clears the old decline timestamp', () => {
      const { service, baserow } = build([
        row({ status: 'declined', responded_at: '2026-08-01T10:00:00Z' })
      ]);

      service.sendRequest(THEM).subscribe();

      const patch = baserow.updateRow.calls.mostRecent().args[2];
      expect(patch.responded_at).toBeNull();
    });

    it('works even when this tab never learned about the decline', () => {
      // The actual failure: A's copy still said 'pending' because A never
      // reloaded. Reviving is correct whether the local copy is current or not.
      const { service, baserow } = build([row({ status: 'pending' })]);

      service.sendRequest(THEM).subscribe();

      // Still pending is a genuine duplicate — nothing new is written...
      expect(baserow.createRow).not.toHaveBeenCalled();
    });

    it('lets the other person invite back after declining', () => {
      // Row was A -> B, declined. Now B invites A: the same row flips direction.
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          FriendsService,
          { provide: AuthService, useValue: { currentUserValue: { id: 2, name: 'Them', email: THEM } } },
          { provide: BaserowService, useClass: MockBaserowService },
          { provide: ToastService, useClass: MockToastService }
        ]
      });
      const baserow = TestBed.inject(BaserowService) as unknown as MockBaserowService;
      baserow.rows = [row({ status: 'declined' })];
      const service = TestBed.inject(FriendsService);
      service.load();

      service.sendRequest(ME.email).subscribe();

      const patch = baserow.updateRow.calls.mostRecent().args[2];
      expect(patch.requester_email).toBe(THEM);
      expect(patch.addressee_email).toBe(ME.email);
      expect(patch.status).toBe('pending');
    });
  });

  it('refuses to re-invite someone already accepted', () => {
    const { service, baserow, toast } = build([row({ status: 'accepted', addressee_user_id: '2' })]);
    service.sendRequest(THEM).subscribe();

    expect(baserow.createRow).not.toHaveBeenCalled();
    expect(baserow.updateRow).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalled();
  });

  it('refuses to invite someone blocked', () => {
    const { service, baserow, toast } = build([row({ status: 'blocked' })]);
    service.sendRequest(THEM).subscribe();

    expect(baserow.createRow).not.toHaveBeenCalled();
    expect(baserow.updateRow).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalled();
  });
});

describe('FriendsService lists', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('keeps a declined invite visible under Sent so the sender finds out', () => {
    const { service } = build([row({ status: 'declined' })]);

    expect(service.outgoingRequests().length).toBe(1);
    expect(service.outgoingRequests()[0].status).toBe('declined');
    // ...but it is not counted as still waiting.
    expect(service.pendingOutgoing().length).toBe(0);
  });

  it('shows an incoming invite addressed to my email', () => {
    const { service } = build([
      row({ requester_user_id: '2', requester_email: THEM, addressee_email: ME.email, status: 'pending' })
    ]);

    expect(service.incomingRequests().length).toBe(1);
    expect(service.incomingRequests()[0].email).toBe(THEM);
  });
});


/**
 * Every action that changes what the OTHER person sees must publish.
 *
 * These were silently missing for re-invite, withdraw and remove: the row was
 * written correctly, the sender's UI updated, and the recipient learned about
 * it only on their next poll — up to a minute later, with no toast. Nothing in
 * the app surfaces a missing publish, so it has to be asserted here.
 */
describe('FriendsService realtime publishing', () => {
  it('publishes on a brand new invite', () => {
    const { service, published } = build();
    service.sendRequest(THEM).subscribe();

    const event = published.find(e => e.kind === 'friend.invited');
    expect(event).toBeTruthy();
    expect(event!.to).toEqual([{ email: THEM }]);
    expect(event!.hint?.scope).toEqual(['friends']);
  });

  it('publishes on a RE-invite, not just a first one', () => {
    // The regression: reviving an existing row went through a path that only
    // nudged locally, so re-inviting pushed nothing at all.
    const { service, published } = build([row({ status: 'declined' })]);
    service.sendRequest(THEM).subscribe();

    const event = published.find(e => e.kind === 'friend.invited');
    expect(event).toBeTruthy();
    expect(event!.to).toEqual([{ email: THEM }]);
  });

  it('publishes to the requester on accept', () => {
    const { service, published } = build([
      row({ id: 8, requester_user_id: '7', requester_email: 'them@x.com', addressee_email: ME.email, status: 'pending' })
    ]);
    service.acceptRequest('8').subscribe();

    const event = published.find(e => e.kind === 'friend.accepted');
    expect(event).toBeTruthy();
    expect(event!.to).toEqual([{ userId: '7' }]);
  });

  it('publishes to the requester on decline', () => {
    const { service, published } = build([
      row({ id: 8, requester_user_id: '7', requester_email: 'them@x.com', addressee_email: ME.email, status: 'pending' })
    ]);
    service.declineRequest('8').subscribe();

    const event = published.find(e => e.kind === 'friend.declined');
    expect(event).toBeTruthy();
    expect(event!.to).toEqual([{ userId: '7' }]);
  });

  it('publishes on withdraw, so a dead invite cannot be accepted', () => {
    const { service, published } = build([row({ id: 8, status: 'pending' })]);
    service.cancelRequest('8').subscribe();

    const event = published.find(e => e.kind === 'friend.cancelled');
    expect(event).toBeTruthy();
    // Addressed by email: an invitee has no user id until they answer.
    expect(event!.to).toContain({ email: THEM } as never);
  });

  it('publishes on remove', () => {
    const { service, published } = build([
      row({ id: 8, status: 'accepted', addressee_user_id: '7' })
    ]);
    service.removeFriend('8').subscribe();

    const event = published.find(e => e.kind === 'friend.removed');
    expect(event).toBeTruthy();
    expect(event!.to).toContain({ userId: '7' } as never);
  });

  it('does not publish when the write fails', () => {
    const { service, baserow, published } = build();
    (baserow.createRow as jasmine.Spy).and.returnValue(of(null));

    service.sendRequest(THEM).subscribe();

    // Telling a peer to refetch a row that was never written wastes their
    // request and shows them nothing new.
    expect(published.length).toBe(0);
  });
});
