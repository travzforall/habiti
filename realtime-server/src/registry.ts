import type { RelayAddress } from './protocol.js';

interface Addressable {
  userId: string | null;
  email: string | null;
}

/**
 * Who is connected, and how to reach them.
 *
 * The EMAIL index is not optional. Friend invites are addressed by email
 * because Habiti has no user-search endpoint — at invite time the sender does
 * not know the recipient's user id. Without it, "send an invite and they see a
 * toast" is unimplementable.
 */
export class Registry<T extends Addressable> {
  private byUser = new Map<string, Set<T>>();
  private byEmail = new Map<string, Set<T>>();
  private conns = new Set<T>();

  add(conn: T, userId: string, email: string): void {
    this.conns.add(conn);
    addTo(this.byUser, userId, conn);
    if (email) addTo(this.byEmail, email.toLowerCase(), conn);
  }

  remove(conn: T): void {
    this.conns.delete(conn);
    if (conn.userId) removeFrom(this.byUser, conn.userId, conn);
    if (conn.email) removeFrom(this.byEmail, conn.email.toLowerCase(), conn);
  }

  forUser(userId: string): T[] {
    return [...(this.byUser.get(userId) ?? [])];
  }

  all(): T[] {
    return [...this.conns];
  }

  size(): number {
    return this.conns.size;
  }

  /** How many DISTINCT users are present. Two tabs of one account count once. */
  userCount(): number {
    return this.byUser.size;
  }

  /** Delivers to every addressed recipient that happens to be connected. */
  fanout(addresses: RelayAddress[], deliver: (conn: T) => void): number {
    const targets = new Set<T>();

    for (const address of addresses) {
      if ('userId' in address) {
        for (const conn of this.byUser.get(String(address.userId)) ?? []) targets.add(conn);
      } else if ('email' in address) {
        for (const conn of this.byEmail.get(String(address.email).toLowerCase()) ?? []) {
          targets.add(conn);
        }
      }
    }

    for (const conn of targets) deliver(conn);
    return targets.size;
  }
}

function addTo<T>(map: Map<string, Set<T>>, key: string, value: T): void {
  const set = map.get(key) ?? new Set<T>();
  set.add(value);
  map.set(key, set);
}

function removeFrom<T>(map: Map<string, Set<T>>, key: string, value: T): void {
  const set = map.get(key);
  if (!set) return;
  set.delete(value);
  if (set.size === 0) map.delete(key);
}
