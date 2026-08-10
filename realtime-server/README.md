# habiti-realtime

A small WebSocket relay that carries **"refetch this"** between users. It is not a data server.

Baserow remains the only source of truth. The relay's entire job is to shorten the gap between
"user A did something" and "user B's app notices" from 10–60 seconds of polling to under a second.

**If this server is off, the app works.** Polling produces identical results at a slower cadence —
that is the same mode at lower frequency, not a degraded one. Nothing here is on the critical path.

---

## ⚠️ SINGLE INSTANCE ONLY

**Run exactly one process. Do not scale this horizontally. Do not put it behind a load balancer with
more than one backend. Do not set `replicas: 2`.**

Connection rooms live in this process's memory. With two instances, user A lands on instance 1 and
user B on instance 2, and every event between them is dropped **silently** — no error, no log line,
no failed health check. It looks exactly like "the relay is working, the other person just isn't
online". That is a genuinely awful bug to chase.

One process handles thousands of idle WebSockets on minimal memory; Habiti will not outgrow it for a
long time. When it does, the fix is a Redis pub/sub bridge in `registry.ts` so instances forward
fan-out to each other — **that has to land before a second instance does.**

---

## What it does and does not carry

Messages carry a **hint** — a list of scopes to refetch — and never authoritative content:

```jsonc
{
  "v": 1,
  "kind": "friend.invited",
  "from": "42",                    // stamped by the server, never the client
  "to": [{ "email": "b@example.com" }],
  "at": "2026-01-01T00:00:00.000Z", // stamped by the server
  "nonce": "…",                     // server-generated, used for cross-tab dedupe
  "hint": { "scope": ["friends"] }  // the only field a client acts on
}
```

Two rules make "hints only" a property of the code rather than a convention, both in
[`src/protocol.ts`](src/protocol.ts):

1. `from`, `at` and `nonce` are **overwritten** with server-controlled values. A client cannot claim
   to be someone else or backdate an event.
2. `sanitizeHint()` keeps only `scope`, `refKey` and `label`. Anything else attached to a hint is
   dropped before fan-out.

So a **fully compromised relay can cause a spurious refetch, and nothing more.** It cannot mint a
friendship, forge a check-in, or grant a level. It also stores nothing — no data at rest, nothing to
delete on request.

There are no acks, no queues, and no store-and-forward. A recipient who is offline simply misses the
nudge and picks the change up on their next poll. Adding delivery guarantees would mean duplicating
what Baserow already does.

## Identity

The client sends its Xano token in a `hello` **frame**, never in the URL — query strings land in
every proxy and CDN access log, and a JWT in a log file is a session compromise.

The server learns who someone is **only** from Xano's `/auth/me` response. A client-declared user id
is never read. Sockets that do not authenticate within `HELLO_TIMEOUT_MS` are closed.

Verified tokens are cached for `TOKEN_CACHE_TTL_MS`, keyed on `sha256(token)` rather than the token
itself, with single-flight — fifty tabs reconnecting after a Wi-Fi blip produce one `/auth/me` call.

Connections are indexed by user id **and by verified email**. The email index is not optional:
friend invites are addressed by email because Habiti has no user-search endpoint, so at invite time
the sender does not know the recipient's user id.

## Run it

```bash
npm install
cp .env.example .env      # then edit XANO_API_URL / ALLOWED_ORIGINS
npm run dev               # or: npm run build && npm start
curl localhost:8080/healthz
```

`dev` and `start` read `.env` via Node's own `--env-file-if-exists` — there is no dotenv dependency.
It is `-if-exists` rather than `--env-file` on purpose: in production the variables come from the
platform and no `.env` file exists, which plain `--env-file` treats as fatal.

Point the app at it in `src/environments/environment.ts`:

```ts
realtime: { url: 'ws://localhost:8080' }
```

Use `wss://` in production. A browser on an `https://` page refuses to open a plaintext `ws://`
socket, so an http-only deployment will fail with a mixed-content error and no fallback.

### Configuration

| Variable                   | Required | Default     | Notes                                                     |
| -------------------------- | -------- | ----------- | --------------------------------------------------------- |
| `XANO_API_URL`             | **yes**  | —           | Fails fast if unset, rather than accepting everyone        |
| `ALLOWED_ORIGINS`          | **yes**\* | *(any)*     | Comma-separated. Empty means any origin — local dev only   |
| `PORT`                     | no       | `8080`      |                                                            |
| `XANO_ME_PATH`             | no       | `/auth/me`  |                                                            |
| `TOKEN_CACHE_TTL_MS`       | no       | `300000`    | 5 min                                                      |
| `HEARTBEAT_MS`             | no       | `30000`     | See below — do not raise past ~45s                         |
| `HELLO_TIMEOUT_MS`         | no       | `5000`      |                                                            |
| `MAX_CONNECTIONS`          | no       | `5000`      |                                                            |
| `MAX_CONNECTIONS_PER_USER` | no       | `8`         | Oldest socket is evicted, so cycling tabs can't lock a user out |
| `PUBLISH_RATE`             | no       | `20`        | Publishes per 10s per connection                           |

\* Not enforced by the process, but shipping to production without it means any website can open a
socket. Set it.

**`HEARTBEAT_MS` is 30s deliberately.** Cloudflare drops idle proxied WebSockets at around 100
seconds. A longer heartbeat lets healthy connections die silently and users quietly stop getting
updates while the indicator still reads "Live".

## Deploying

Any host that supports long-lived WebSocket connections works — Fly.io, Railway, a small VPS behind
nginx. **Not** a serverless/Lambda-style platform: they terminate idle connections and bill per
invocation, which is the opposite of what a persistent socket wants.

Requirements: Node ≥ 22, one instance (see above), `wss://`, an idle timeout above 100s if a proxy
is in front, and `/healthz` for liveness (it returns connection count and uptime).

`SIGTERM` and `SIGINT` send every client a `bye` frame before closing, so a restart shows up as
normal reconnect backoff rather than a wave of errors.

## Tests

```bash
npm test
```

Covers the security boundary (`sanitizeHint` dropping unknown fields, recipient caps, malformed
frames) and routing (email case-insensitivity, multi-tab delivery, no leakage to bystanders,
cleanup on disconnect).

### Protocol drift

The wire contract is duplicated: [`src/protocol.ts`](src/protocol.ts) here and
`src/app/models/realtime.models.ts` in the app. It has to be — this is a separate package with its
own tsconfig and cannot import from `src/app`.

`npm run check:protocol` compares the two `// <protocol>` blocks and fails on any difference. It
runs automatically before `build` and `test`. It also checks the `KINDS`/`SCOPES` runtime sets
against their type unions, which is the failure that actually bites: types vanish at runtime, so a
kind added to the union but not the Set is **rejected in silence** with a green typecheck on both
sides.

## Layout

| File          | Responsibility                                                   |
| ------------- | ---------------------------------------------------------------- |
| `index.ts`    | HTTP + WebSocket server, hello deadline, heartbeat, rate limit, shutdown |
| `config.ts`   | Env parsing; exits on missing required vars                       |
| `auth.ts`     | `verifyToken()` — Xano `/auth/me`, hashed cache, single-flight    |
| `registry.ts` | Rooms by user id and by verified email                            |
| `protocol.ts` | The wire contract and its validators — the security boundary      |

## Close codes

| Code   | Meaning                                                 |
| ------ | ------------------------------------------------------- |
| `4000` | Evicted — you opened more than `MAX_CONNECTIONS_PER_USER` |
| `4401` | Unauthorized — bad token, or published before `hello`    |
| `4408` | Did not say `hello` in time                             |
| `4503` | Server at capacity                                      |
| `1001` | Planned restart; the client reconnects on normal backoff |

The client treats all of these as ordinary reconnect conditions except `4401`, which stops retrying
until the next sign-in.
