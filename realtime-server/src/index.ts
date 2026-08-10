import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, type WebSocket } from 'ws';
import { config } from './config.js';
import { verifyToken } from './auth.js';
import { Registry } from './registry.js';
import {
  RELAY_PROTOCOL_VERSION,
  isPublishFrame,
  sanitizeHint,
  type RelayEnvelope,
  type ServerFrame
} from './protocol.js';

/**
 * The Habiti hint relay.
 *
 * It carries "refetch this" between users and NOTHING else. Baserow remains
 * the only source of truth, so the worst a compromised relay can do is cause a
 * spurious refetch — it cannot forge a friendship, a check-in or a level.
 *
 * ⚠ SINGLE INSTANCE ONLY. Rooms live in this process's memory. Run two and
 * user A on instance 1 silently cannot reach user B on instance 2. Scaling
 * needs a Redis pub/sub bridge first — see README.
 */

interface Conn {
  socket: WebSocket;
  userId: string | null;
  email: string | null;
  isAlive: boolean;
  publishes: number[];
}

const registry = new Registry<Conn>();

const http = createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      // `users` is the number that matters when push "isn't working": a
      // one-to-one event needs BOTH parties present, so connections=2 with
      // users=1 (one account in two tabs) still delivers nothing.
      JSON.stringify({
        ok: true,
        connections: registry.size(),
        users: registry.userCount(),
        uptime: Math.round(process.uptime())
      })
    );
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({
  server: http,
  maxPayload: 8 * 1024,
  verifyClient: ({ origin }, done) => {
    // A browser cannot spoof Origin. Non-browser clients can, which is why the
    // hello handshake below verifies identity against Xano regardless.
    if (config.allowedOrigins.length === 0) return done(true);
    if (!origin || config.allowedOrigins.includes(origin)) return done(true);
    // Say so. A rejected handshake is invisible from the app side — the socket
    // simply never opens — so silence here means hunting for a bug that is
    // really just a missing entry in ALLOWED_ORIGINS.
    log('rejected: origin not allowed', { origin, allowed: config.allowedOrigins });
    done(false, 403, 'origin not allowed');
  }
});

wss.on('connection', socket => {
  if (registry.size() >= config.maxConnections) {
    socket.close(4503, 'at capacity');
    return;
  }

  const conn: Conn = { socket, userId: null, email: null, isAlive: true, publishes: [] };

  // Unauthenticated sockets get a short window to say hello and nothing else.
  const helloTimer = setTimeout(() => {
    if (!conn.userId) socket.close(4408, 'auth timeout');
  }, config.helloTimeoutMs);

  socket.on('pong', () => {
    conn.isAlive = true;
  });

  socket.on('message', async raw => {
    let frame: unknown;
    try {
      frame = JSON.parse(String(raw));
    } catch {
      return send(socket, { v: 1, kind: 'error', code: 'bad_frame' });
    }

    const f = frame as { v?: number; kind?: string; token?: string; event?: unknown };
    if (f?.v !== RELAY_PROTOCOL_VERSION) {
      return send(socket, { v: 1, kind: 'error', code: 'bad_frame' });
    }

    // ---- hello ----------------------------------------------------------
    if (f.kind === 'hello') {
      if (conn.userId) return;
      if (typeof f.token !== 'string' || !f.token) {
        return socket.close(4401, 'unauthorized');
      }

      const identity = await verifyToken(f.token);
      if (!identity) {
        // The quietest failure in the system, and the most confusing: the app
        // keeps working on a dead Xano token because its DATA comes from
        // Baserow with a different credential. The window looks signed in and
        // simply never pushes.
        log('rejected: Xano did not accept the token', { hint: 'sign out and back in' });
        return socket.close(4401, 'unauthorized');
      }

      clearTimeout(helloTimer);
      conn.userId = identity.userId;
      conn.email = identity.email;

      // Evict this user's oldest socket rather than rejecting the new one —
      // somebody cycling tabs must never lock themselves out.
      const existing = registry.forUser(identity.userId);
      if (existing.length >= config.maxConnectionsPerUser) {
        existing[0]?.socket.close(4000, 'too many connections');
      }

      registry.add(conn, identity.userId, identity.email);
      // User id only, never the email: this log is the first thing anyone reads
      // when push "isn't working", and the answer is almost always a count.
      log('connected', { user: identity.userId, connections: registry.size() });
      send(socket, {
        v: 1,
        kind: 'ready',
        userId: identity.userId,
        at: new Date().toISOString()
      });
      return;
    }

    // ---- publish --------------------------------------------------------
    if (f.kind === 'publish') {
      if (!conn.userId) return socket.close(4401, 'unauthorized');
      if (!isPublishFrame(frame)) {
        return send(socket, { v: 1, kind: 'error', code: 'bad_frame' });
      }
      if (!allowPublish(conn)) {
        return send(socket, { v: 1, kind: 'error', code: 'rate_limited' });
      }

      const { event } = frame;

      /**
       * The security boundary, in five lines.
       *
       * `from`, `at` and `nonce` are OVERWRITTEN with server-controlled values,
       * and the hint is stripped to its three known fields. A client cannot
       * claim to be someone else, cannot backdate an event, and cannot smuggle
       * payload data through a hint — which is what makes "hints only" a
       * property of the code rather than a convention.
       */
      const envelope: RelayEnvelope = {
        v: RELAY_PROTOCOL_VERSION,
        kind: event.kind,
        from: conn.userId,
        to: event.to,
        at: new Date().toISOString(),
        nonce: randomUUID(),
        hint: sanitizeHint(event.hint)
      };

      const delivered = registry.fanout(event.to, target =>
        send(target.socket, { v: 1, kind: 'event', envelope })
      );

      // Nobody listening is normal and fine — their next poll picks it up. It
      // is also the single most common "push isn't working" cause, so say so
      // rather than dropping the event in silence.
      log('publish', {
        from: conn.userId,
        kind: event.kind,
        delivered,
        ...(config.debugAddresses ? { to: event.to } : {})
      });
      return;
    }

    send(socket, { v: 1, kind: 'error', code: 'bad_frame' });
  });

  socket.on('close', () => {
    clearTimeout(helloTimer);
    const wasAuthed = !!conn.userId;
    registry.remove(conn);
    if (wasAuthed) log('disconnected', { user: conn.userId, connections: registry.size() });
  });

  socket.on('error', () => {
    /* close handles cleanup */
  });
});

/**
 * 30s is deliberate: Cloudflare drops idle proxied WebSockets at ~100s, so a
 * longer heartbeat would let healthy connections die silently.
 */
const heartbeat = setInterval(() => {
  for (const conn of registry.all()) {
    if (!conn.isAlive) {
      conn.socket.terminate();
      continue;
    }
    conn.isAlive = false;
    conn.socket.ping();
  }
}, config.heartbeatMs);

function allowPublish(conn: Conn): boolean {
  const now = Date.now();
  conn.publishes = conn.publishes.filter(t => now - t < 10_000);
  if (conn.publishes.length >= config.publishRate) return false;
  conn.publishes.push(now);
  return true;
}

function log(msg: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ msg, ...fields }));
}

function send(socket: WebSocket, frame: ServerFrame): void {
  if (socket.readyState !== socket.OPEN) return;
  try {
    socket.send(JSON.stringify(frame));
  } catch {
    /* a dead socket is cleaned up by close */
  }
}

function shutdown(): void {
  clearInterval(heartbeat);
  for (const conn of registry.all()) {
    // 1001 tells clients "planned restart" — they reconnect on normal backoff
    // rather than treating it as a failure.
    send(conn.socket, { v: 1, kind: 'bye', reason: 'restart' });
    conn.socket.close(1001, 'server restart');
  }
  wss.close();
  http.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 10_000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

http.listen(config.port, () => {
  console.log(
    JSON.stringify({
      msg: 'habiti-realtime listening',
      port: config.port,
      origins: config.allowedOrigins.length ? config.allowedOrigins : '(any)',
      xano: config.xanoApiUrl
    })
  );
});
