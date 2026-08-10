import {
  Friendship,
  FriendshipRow,
  fromFriendship,
  involves,
  normalizeEmail,
  pairKeyFor,
  toFriend,
  toFriendship
} from './friend.models';

const ME = { id: '1', email: 'me@example.com' };
const THEM = { id: '2', email: 'them@example.com' };

function friendship(over: Partial<Friendship> = {}): Friendship {
  return {
    id: 'f1',
    requesterUserId: ME.id,
    requesterName: 'Me',
    requesterEmail: ME.email,
    addresseeEmail: THEM.email,
    addresseeUserId: THEM.id,
    addresseeName: 'Them',
    status: 'accepted',
    requestedAt: new Date(2026, 7, 1),
    ...over
  };
}

describe('normalizeEmail', () => {
  it('lowercases and trims, so comparisons are consistent', () => {
    expect(normalizeEmail('  Me@Example.COM ')).toBe('me@example.com');
  });

  it('turns nothing into an empty string rather than throwing', () => {
    expect(normalizeEmail(undefined)).toBe('');
    expect(normalizeEmail(null)).toBe('');
  });
});

describe('pairKeyFor', () => {
  it('is order-independent, so a pair has one key whoever asked first', () => {
    expect(pairKeyFor('1', '2')).toBe(pairKeyFor('2', '1'));
    expect(pairKeyFor('1', '2')).toBe('1:2');
  });

  it('handles numeric ids passed as numbers', () => {
    expect(pairKeyFor(2 as unknown as string, 1 as unknown as string)).toBe('1:2');
  });
});

describe('toFriendship', () => {
  it('unwraps a Baserow single-select object', () => {
    const row = {
      id: 9,
      requester_user_id: '1',
      requester_email: 'A@Example.com',
      addressee_email: 'B@Example.com',
      status: { value: 'accepted' }
    } as FriendshipRow;

    const result = toFriendship(row);
    expect(result.status).toBe('accepted');
    expect(result.requesterEmail).toBe('a@example.com');
    expect(result.addresseeEmail).toBe('b@example.com');
  });

  it('accepts a plain string status too', () => {
    expect(toFriendship({ id: 1, requester_user_id: '1', requester_email: 'a@b.c', addressee_email: 'd@e.f', status: 'blocked' } as FriendshipRow).status).toBe('blocked');
  });

  it('falls back to pending for an unrecognised status', () => {
    expect(toFriendship({ id: 1, requester_user_id: '1', requester_email: 'a@b.c', addressee_email: 'd@e.f', status: 'nonsense' } as FriendshipRow).status).toBe('pending');
  });

  it('turns empty optional strings into undefined rather than rendering blanks', () => {
    const result = toFriendship({
      id: 1, requester_user_id: '1', requester_email: 'a@b.c',
      addressee_email: 'd@e.f', addressee_name: '', invite_message: ''
    } as FriendshipRow);
    expect(result.addresseeName).toBeUndefined();
    expect(result.inviteMessage).toBeUndefined();
  });
});

describe('fromFriendship', () => {
  it('only writes the fields it was given, so a patch stays a patch', () => {
    const patch = fromFriendship({ status: 'accepted' });
    expect(Object.keys(patch)).toEqual(['status']);
  });

  it('lowercases emails on the way out', () => {
    expect(fromFriendship({ addresseeEmail: 'X@Y.COM' })['addressee_email']).toBe('x@y.com');
  });
});

describe('toFriend — direction normalizing', () => {
  it('gives the addressee when I sent the invite', () => {
    const friend = toFriend(friendship(), ME.id, ME.email);
    expect(friend.iInitiated).toBe(true);
    expect(friend.email).toBe(THEM.email);
    expect(friend.name).toBe('Them');
  });

  it('gives the requester when they sent it', () => {
    const incoming = friendship({
      requesterUserId: THEM.id,
      requesterName: 'Them',
      requesterEmail: THEM.email,
      addresseeEmail: ME.email,
      addresseeUserId: ME.id,
      addresseeName: 'Me'
    });

    const friend = toFriend(incoming, ME.id, ME.email);
    expect(friend.iInitiated).toBe(false);
    expect(friend.email).toBe(THEM.email);
    expect(friend.name).toBe('Them');
  });

  it('identifies me by email when I have no user id on the row yet', () => {
    // The addressee has no user id until they accept — matching must still work.
    const invite = friendship({
      requesterUserId: THEM.id,
      requesterEmail: THEM.email,
      requesterName: 'Them',
      addresseeEmail: ME.email,
      addresseeUserId: undefined,
      addresseeName: undefined,
      status: 'pending'
    });

    const friend = toFriend(invite, ME.id, ME.email);
    expect(friend.iInitiated).toBe(false);
    expect(friend.email).toBe(THEM.email);
  });

  it('falls back to the email when the other side has no name yet', () => {
    const pending = friendship({ addresseeName: undefined, addresseeUserId: undefined, status: 'pending' });
    expect(toFriend(pending, ME.id, ME.email).name).toBe(THEM.email);
  });

  it('is case-insensitive about my own email', () => {
    const friend = toFriend(friendship(), ME.id, 'ME@EXAMPLE.COM');
    expect(friend.iInitiated).toBe(true);
  });
});

describe('involves', () => {
  it('matches on either end, by id or email', () => {
    const f = friendship();
    expect(involves(f, ME.id, ME.email)).toBe(true);
    expect(involves(f, THEM.id, THEM.email)).toBe(true);
    expect(involves(f, '99', 'someone@else.com')).toBe(false);
  });

  it('matches an addressee who has not accepted yet', () => {
    const f = friendship({ addresseeUserId: undefined, status: 'pending' });
    expect(involves(f, '99', THEM.email)).toBe(true);
  });
});
