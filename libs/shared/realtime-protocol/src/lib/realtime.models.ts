/**
 * The realtime contract.
 *
 * ── THE ONE RULE ─────────────────────────────────────────────────────────
 *  Events are HINTS TO REFETCH. They never carry authoritative content.
 *
 *  Everything good follows from that. A fully compromised relay can cause a
 *  spurious refetch and nothing else — it cannot mint a friendship, a
 *  check-in, or a level, because Baserow stays the only source of truth.
 *  There is no ordering, versioning or conflict resolution to get wrong,
 *  because a refetch always yields current state and two events arriving out
 *  of order are indistinguishable from one.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `realtime-server/src/protocol.ts` holds a copy of the block between the
 * <protocol> markers below. Keep them identical.
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
  | 'skills'
  /**
   * Inspiration boards.
   *
   * CLIENT-ONLY, and knowingly so: the relay keeps its own copy of this union
   * (realtime-server/src/protocol.ts) and drops any scope it does not
   * recognise, so an `inspiration` hint sent over the wire would vanish without
   * a trace. That is fine because nothing another user does can change your
   * board — the scope exists so a tab of your own, or a reconnect, refetches
   * it. If boards ever become shareable, add it to the relay's list FIRST.
   */
  | 'inspiration';

export const ALL_SCOPES: readonly RefreshScope[] = [
  'friends',
  'challenges',
  'settlements',
  'levels',
  'habits',
  'dailyContent',
  'tasks',
  'projects',
  'skills',
  'inspiration'
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

const KNOWN_SCOPES = new Set<string>(ALL_SCOPES);

/** Defensive: anything malformed off the wire is dropped rather than trusted. */
export function isRelayEnvelope(value: unknown): value is RelayEnvelope {
  if (!value || typeof value !== 'object') return false;
  const e = value as Partial<RelayEnvelope>;

  if (e.v !== RELAY_PROTOCOL_VERSION) return false;
  if (typeof e.kind !== 'string' || typeof e.from !== 'string') return false;
  if (typeof e.at !== 'string' || typeof e.nonce !== 'string') return false;
  if (!Array.isArray(e.to)) return false;

  if (e.hint !== undefined) {
    if (typeof e.hint !== 'object' || e.hint === null) return false;
    if (!Array.isArray(e.hint.scope)) return false;
    if (!e.hint.scope.every(s => typeof s === 'string' && KNOWN_SCOPES.has(s))) return false;
  }

  return true;
}

/** Scopes to refresh for an event, falling back to a sensible default per kind. */
export function scopesFor(envelope: RelayEnvelope): RefreshScope[] {
  if (envelope.hint?.scope?.length) return envelope.hint.scope;

  if (envelope.kind.startsWith('friend.')) return ['friends'];
  if (envelope.kind.startsWith('settlement.')) return ['settlements'];
  if (envelope.kind === 'self.levels') return ['levels'];
  if (envelope.kind === 'self.habits') return ['habits', 'challenges'];
  if (envelope.kind === 'challenge.completed') return ['challenges', 'levels'];
  if (envelope.kind.startsWith('challenge.')) return ['challenges'];

  return [];
}
