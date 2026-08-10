/**
 * The social graph.
 *
 * One row per relationship — a friend *request* is simply a friendship in
 * `pending`, not a separate entity. Two tables would need a cross-table
 * consistency the client cannot guarantee.
 *
 * Invites are addressed by EMAIL because there is no user-search endpoint:
 * Xano's `/users/profile` is declared but never called. The recipient finds
 * their invites by filtering on `addressee_email`. The cost is the
 * denormalized `*_name` / `*_avatar_url` columns, which can go stale.
 */

export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'blocked' | 'cancelled';

/** App-domain shape (string id, Date, camelCase). */
export interface Friendship {
  id: string;
  requesterUserId: string;
  requesterName: string;
  requesterEmail: string;
  requesterAvatarUrl?: string;
  addresseeEmail: string;
  addresseeUserId?: string;
  addresseeName?: string;
  addresseeAvatarUrl?: string;
  status: FriendshipStatus;
  inviteMessage?: string;
  pairKey?: string;
  requestedAt: Date;
  respondedAt?: Date;
}

/** Baserow row shape (numeric id, ISO strings, snake_case). */
export interface FriendshipRow {
  id: number;
  requester_user_id: string;
  requester_name?: string;
  requester_email: string;
  requester_avatar_url?: string;
  addressee_email: string;
  addressee_user_id?: string;
  addressee_name?: string;
  addressee_avatar_url?: string;
  status?: string | { value: string };
  invite_message?: string;
  pair_key?: string;
  requested_at?: string;
  responded_at?: string;
}

/**
 * "The other person", from the current user's point of view.
 *
 * A Friendship is directional — whoever sent it is the requester. Components
 * should never have to work out which end they are; this normalizes it.
 */
export interface Friend {
  friendshipId: string;
  userId?: string;
  email: string;
  name: string;
  avatarUrl?: string;
  status: FriendshipStatus;
  since?: Date;
  /**
   * When this invite was last SENT.
   *
   * Distinct from `since` (which answers) because a re-invite revives the same
   * row: without it, a second invite is indistinguishable from the first and
   * anything keyed on the friendship id treats it as already handled.
   */
  invitedAt?: Date;
  /** True when the current user sent the invite. */
  iInitiated: boolean;
  inviteMessage?: string;
}

const VALID_STATUSES: FriendshipStatus[] = [
  'pending',
  'accepted',
  'declined',
  'blocked',
  'cancelled'
];

export function toFriendship(row: FriendshipRow): Friendship {
  // Baserow returns a single-select as an object; the app wants the value.
  const rawStatus = typeof row.status === 'object' ? row.status?.value : row.status;
  const status = VALID_STATUSES.includes(rawStatus as FriendshipStatus)
    ? (rawStatus as FriendshipStatus)
    : 'pending';

  return {
    id: String(row.id),
    requesterUserId: row.requester_user_id ?? '',
    requesterName: row.requester_name || '',
    requesterEmail: normalizeEmail(row.requester_email),
    requesterAvatarUrl: row.requester_avatar_url || undefined,
    addresseeEmail: normalizeEmail(row.addressee_email),
    addresseeUserId: row.addressee_user_id || undefined,
    addresseeName: row.addressee_name || undefined,
    addresseeAvatarUrl: row.addressee_avatar_url || undefined,
    status,
    inviteMessage: row.invite_message || undefined,
    pairKey: row.pair_key || undefined,
    requestedAt: row.requested_at ? new Date(row.requested_at) : new Date(0),
    respondedAt: row.responded_at ? new Date(row.responded_at) : undefined
  };
}

export function fromFriendship(f: Partial<Friendship>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (f.requesterUserId !== undefined) out['requester_user_id'] = f.requesterUserId;
  if (f.requesterName !== undefined) out['requester_name'] = f.requesterName;
  if (f.requesterEmail !== undefined) out['requester_email'] = normalizeEmail(f.requesterEmail);
  if (f.requesterAvatarUrl !== undefined) out['requester_avatar_url'] = f.requesterAvatarUrl ?? '';
  if (f.addresseeEmail !== undefined) out['addressee_email'] = normalizeEmail(f.addresseeEmail);
  if (f.addresseeUserId !== undefined) out['addressee_user_id'] = f.addresseeUserId ?? '';
  if (f.addresseeName !== undefined) out['addressee_name'] = f.addresseeName ?? '';
  if (f.addresseeAvatarUrl !== undefined) out['addressee_avatar_url'] = f.addresseeAvatarUrl ?? '';
  if (f.status !== undefined) out['status'] = f.status;
  if (f.inviteMessage !== undefined) out['invite_message'] = f.inviteMessage ?? '';
  if (f.pairKey !== undefined) out['pair_key'] = f.pairKey ?? '';
  if (f.requestedAt !== undefined) out['requested_at'] = f.requestedAt?.toISOString() ?? null;
  if (f.respondedAt !== undefined) out['responded_at'] = f.respondedAt?.toISOString() ?? null;
  return out;
}

/** Emails are compared lowercased everywhere; this is the one place that decides. */
export function normalizeEmail(email: string | undefined | null): string {
  return (email ?? '').trim().toLowerCase();
}

/**
 * Deliberately strict about whitespace.
 *
 * `normalizeEmail` only trims the ENDS, so "j jstain@email.com" survived a
 * `includes('@')` check and became a real invite addressed to an account that
 * cannot exist. Nothing downstream can detect that: the row saves, the sender
 * sees "Invite sent", and the intended recipient is never told — because they
 * were never the recipient.
 *
 * Not RFC 5322. It rejects the typos people actually make.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string | undefined | null): boolean {
  return EMAIL_PATTERN.test(normalizeEmail(email));
}

/** Stable key for a pair, order-independent, so duplicates are detectable. */
export function pairKeyFor(a: string, b: string): string {
  return [String(a), String(b)].sort().join(':');
}

/**
 * Flips a friendship into "the other person", given who is asking.
 *
 * Matches on user id first and falls back to email, because the addressee has
 * no user id until they accept.
 */
export function toFriend(
  friendship: Friendship,
  currentUserId: string,
  currentEmail: string
): Friend {
  const email = normalizeEmail(currentEmail);
  const iInitiated =
    friendship.requesterUserId === String(currentUserId) || friendship.requesterEmail === email;

  return iInitiated
    ? {
        friendshipId: friendship.id,
        userId: friendship.addresseeUserId,
        email: friendship.addresseeEmail,
        // Someone who has not accepted yet has no name on record.
        name: friendship.addresseeName || friendship.addresseeEmail,
        avatarUrl: friendship.addresseeAvatarUrl,
        status: friendship.status,
        since: friendship.respondedAt,
        invitedAt: friendship.requestedAt,
        iInitiated: true,
        inviteMessage: friendship.inviteMessage
      }
    : {
        friendshipId: friendship.id,
        userId: friendship.requesterUserId,
        email: friendship.requesterEmail,
        name: friendship.requesterName || friendship.requesterEmail,
        avatarUrl: friendship.requesterAvatarUrl,
        status: friendship.status,
        since: friendship.respondedAt,
        invitedAt: friendship.requestedAt,
        iInitiated: false,
        inviteMessage: friendship.inviteMessage
      };
}

/** True when this friendship involves the given user, on either end. */
export function involves(
  friendship: Friendship,
  userId: string,
  email: string
): boolean {
  const normalized = normalizeEmail(email);
  return (
    friendship.requesterUserId === String(userId) ||
    friendship.requesterEmail === normalized ||
    friendship.addresseeUserId === String(userId) ||
    friendship.addresseeEmail === normalized
  );
}
