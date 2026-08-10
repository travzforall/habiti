import { createHash } from 'node:crypto';
import { config } from './config.js';

export interface VerifiedIdentity {
  userId: string;
  email: string;
  verifiedAt: number;
}

interface CacheEntry {
  identity: VerifiedIdentity | null;
  expiresAt: number;
}

/** Keyed on a hash, never the token — a heap dump must not yield a session. */
const cache = new Map<string, CacheEntry>();
/** In-flight verifications, so N reconnects with one token make ONE Xano call. */
const inFlight = new Map<string, Promise<VerifiedIdentity | null>>();

const NEGATIVE_TTL_MS = 30_000;

/**
 * Establishes who a socket belongs to, from Xano and nowhere else.
 *
 * The caller never passes in a user id, and this never reads one from the
 * client — identity comes only from Xano's response body.
 */
export async function verifyToken(token: string): Promise<VerifiedIdentity | null> {
  const key = createHash('sha256').update(token).digest('hex');

  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.identity;

  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = fetchIdentity(token)
    .then(identity => {
      cache.set(key, {
        identity,
        // A bad token gets a short TTL so it cannot be used to hammer Xano.
        expiresAt: Date.now() + (identity ? config.tokenCacheTtlMs : NEGATIVE_TTL_MS)
      });
      evictIfNeeded();
      return identity;
    })
    .finally(() => inFlight.delete(key));

  inFlight.set(key, promise);
  return promise;
}

async function fetchIdentity(token: string): Promise<VerifiedIdentity | null> {
  try {
    const response = await fetch(`${config.xanoApiUrl}${config.xanoMePath}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(4000)
    });

    if (!response.ok) return null;

    const body = (await response.json()) as { id?: number | string; email?: string };
    if (body?.id === undefined || body?.id === null) return null;

    return {
      userId: String(body.id),
      email: String(body.email ?? '').trim().toLowerCase(),
      verifiedAt: Date.now()
    };
  } catch {
    // Xano unreachable: refuse the connection. Never fail open.
    return null;
  }
}

function evictIfNeeded(): void {
  if (cache.size <= config.tokenCacheMax) return;
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
  // Still oversized: drop oldest insertions until under the cap.
  while (cache.size > config.tokenCacheMax) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}
