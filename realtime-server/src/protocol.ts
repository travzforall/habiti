/**
 * Wire contract. Mirror of src/app/models/realtime.models.ts in the Angular app
 * — keep the two in step.
 */

// <protocol>
export const RELAY_PROTOCOL_VERSION = 1;

/** Who an event is for. Email is needed because invites are addressed by email. */
export type RelayAddress = { userId: string } | { email: string };

/** Which data a client should refetch. */
export type RefreshScope =
  | 'friends'
  | 'challenges'
  | 'settlements'
  | 'levels'
  | 'habits'
  | 'dailyContent'
  | 'tasks'
  | 'projects'
  | 'skills';

export const ALL_SCOPES: readonly RefreshScope[] = [
  'friends',
  'challenges',
  'settlements',
  'levels',
  'habits',
  'dailyContent',
  'tasks',
  'projects',
  'skills'
] as const;

export type RelayEventKind =
  | 'friend.invited'
  | 'friend.accepted'
  | 'friend.declined'
  | 'friend.cancelled'
  | 'friend.removed'
  | 'challenge.invited'
  | 'challenge.invite_answered'
  | 'challenge.checked_in'
  | 'challenge.completed'
  | 'challenge.abandoned'
  | 'challenge.habits_changed'
  | 'settlement.raised'
  | 'settlement.self_reported'
  | 'settlement.confirmed'
  | 'settlement.waived'
  | 'self.habits'
  | 'self.levels';

export interface RelayHint {
  /** The ONLY field a client acts on. */
  scope: RefreshScope[];
  /** Opaque id, used solely to detect "not visible yet" and retry once. */
  refKey?: string;
  /** Debugging only. Never rendered to a user. */
  label?: string;
}

export interface RelayEnvelope {
  v: 1;
  kind: RelayEventKind;
  /** Verified user id, stamped by the SERVER. Inbound values are discarded. */
  from: string;
  to: RelayAddress[];
  /** ISO-8601, stamped by the SERVER. */
  at: string;
  /** Server-generated. Used for cross-tab dedupe. */
  nonce: string;
  hint?: RelayHint;
}

/** What a client may send: no `from`, no `at`, no `nonce` — the server sets those. */
export interface OutboundEvent {
  kind: RelayEventKind;
  to: RelayAddress[];
  hint?: RelayHint;
}

export type ClientFrame =
  | { v: 1; kind: 'hello'; token: string }
  | { v: 1; kind: 'publish'; event: OutboundEvent };

export type ServerFrame =
  | { v: 1; kind: 'ready'; userId: string; at: string }
  | { v: 1; kind: 'event'; envelope: RelayEnvelope }
  | { v: 1; kind: 'error'; code: 'rate_limited' | 'bad_frame' | 'unauthorized' }
  | { v: 1; kind: 'bye'; reason: string };
// </protocol>

const KINDS = new Set<string>([
  'friend.invited', 'friend.accepted', 'friend.declined', 'friend.cancelled', 'friend.removed',
  'challenge.invited', 'challenge.invite_answered', 'challenge.checked_in',
  'challenge.completed', 'challenge.abandoned', 'challenge.habits_changed',
  'settlement.raised', 'settlement.self_reported', 'settlement.confirmed', 'settlement.waived',
  'self.habits', 'self.levels'
]);

const SCOPES = new Set<string>([
  'friends', 'challenges', 'settlements', 'levels', 'habits', 'dailyContent',
  'tasks', 'projects', 'skills'
]);

/** A hint relay has no legitimate broadcast use; this stops it being a spam cannon. */
const MAX_RECIPIENTS = 20;

export function isPublishFrame(
  value: unknown
): value is { v: 1; kind: 'publish'; event: OutboundEvent } {
  const frame = value as { event?: OutboundEvent };
  const event = frame?.event;
  if (!event || typeof event !== 'object') return false;
  if (!KINDS.has(event.kind)) return false;
  if (!Array.isArray(event.to) || event.to.length === 0) return false;
  if (event.to.length > MAX_RECIPIENTS) return false;

  return event.to.every(
    address =>
      address &&
      typeof address === 'object' &&
      (typeof (address as { userId?: unknown }).userId === 'string' ||
        typeof (address as { email?: unknown }).email === 'string')
  );
}

/**
 * Keeps only the three fields a client is allowed to influence.
 *
 * This is what makes "the relay never carries data" enforceable rather than a
 * promise: anything else attached to a hint is dropped here.
 */
export function sanitizeHint(hint: unknown): RelayHint | undefined {
  if (!hint || typeof hint !== 'object') return undefined;
  const h = hint as RelayHint;

  const scope = Array.isArray(h.scope)
    ? h.scope.filter(s => typeof s === 'string' && SCOPES.has(s)).slice(0, 6)
    : [];
  if (scope.length === 0) return undefined;

  return {
    scope,
    ...(typeof h.refKey === 'string' ? { refKey: h.refKey.slice(0, 128) } : {}),
    ...(typeof h.label === 'string' ? { label: h.label.slice(0, 128) } : {})
  };
}
