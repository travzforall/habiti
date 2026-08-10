# Xano proxy contract (Phase 6)

What has to exist in Xano before Habiti can put real money behind a challenge.

## The problem this solves

`environment.ts` ships a **Baserow database token in the JS bundle**. Every user
has it. With devtools, any user can today:

- read every row of every table — other people's habits, challenges, pledges
- PATCH their own challenge to `completed` and award themselves levels
- flip a settlement to `waived` and erase what they owe
- delete the audit trail that would show they did

The client-side integrity work already in the app — the hashed level chain,
append-only ledger, `findChainBreaks()` — is **tamper-evident, not
tamper-resistant**. It makes cheating visible to an attentive counterparty. It
does not prevent it.

That is fine for levels and forfeits between friends. It is **not** fine for
money. This document is the gate.

## The shape

Move every **write** behind Xano. Xano holds the Baserow token server-side,
verifies the caller's JWT, and enforces one rule the client cannot:

> a user may only write rows where `user_id` equals their own authenticated id

Reads can stay direct-to-Baserow initially — the exposure there is privacy, not
integrity, and it can follow later.

```
        today                          after
   ┌──────────────┐              ┌──────────────┐
   │   browser    │              │   browser    │
   │ Baserow token│              │   JWT only   │
   └──────┬───────┘              └──────┬───────┘
          │ writes                      │ writes
          ▼                             ▼
   ┌──────────────┐              ┌──────────────┐
   │   Baserow    │              │    Xano      │ ← verifies JWT,
   └──────────────┘              │ Baserow token│   enforces ownership
                                 └──────┬───────┘
                                        ▼
                                 ┌──────────────┐
                                 │   Baserow    │
                                 └──────────────┘
```

## Endpoints

All take `Authorization: Bearer <jwt>`; the interceptor
(`src/app/interceptors/auth.interceptor.ts`) already attaches it. `auth.id`
below means the id Xano resolves from that token — **never** a value from the
request body.

### `POST /challenges/start`

```jsonc
// request
{ "templateId": "cold-start-7", "difficulty": "hard",
  "partnerUserId": "2",              // optional
  "pledge": { "kind": "charity_donation", "amount": 100, "currency": "USD" } }
// response: the created run
```

Server must: create the `campaigns` row with `owner_user_id = auth.id`, the
owner's `campaign_participants` row, the partner's row as `invited`, and the
pledge row. **Resolve `levelValue` from a server-side copy of the catalogue —
never trust an amount from the client**, or a user sets their own payout.

### `POST /challenges/:key/check-in`

```jsonc
{ "periodKey": "2026-08-08" }
```

Server must: reject if `auth.id` is not an accepted participant; reject a
duplicate `(campaign_key, user_id, period_key)`; reject a `periodKey` outside
`starts_on..ends_on`; reject a **future** date. That last one is what stops
someone back-filling thirty check-ins in an afternoon.

### `POST /challenges/:key/complete`

No body. Server must re-run the completion test **server-side** —
`periodsPassed >= ceil(periodsTotal × requiredPassRate)`, misses within grace,
and `now >= ends_on` — then write the `level_records` row itself. The client
must not be able to award a level. Idempotent on
`user_id:challenge:campaign_key`.

### `POST /challenges/:key/settle` and `/confirm-settlement`

Server must: only let the **debtor** self-report, only let the **creditor**
confirm, and refuse either while the run is `disputed`.

### `POST /friends/request` · `/friends/:id/respond`

Server must: reject self-invites, reject a duplicate pending pair, and only let
the addressee accept.

## What changes in the client

Small, because the seams exist:

1. **`BaserowService` write methods** (`createRow` / `updateRow` / `deleteRow`)
   point at Xano instead. Every feature already goes through them — that was
   the reason for the generic-helper refactor in Phase 0.
2. **`ChallengeRunRepository`** gains a third implementation. `ChallengeService`
   already picks between two; a third is the same one-line ternary.
3. **`LevelService.award()`** stops writing rows and calls
   `POST /challenges/:key/complete`, which returns the record. The optimistic
   local append stays — it is what makes the level move instantly.
4. **Remove the Baserow token from `environment.ts`** once reads move too. Until
   then it stays, and stays a known exposure.

## Order

1. `check-in` and `complete` first. They are what make levels mean anything, and
   they are the smallest endpoints.
2. `start` — needs the server-side catalogue copy, which is the only genuinely
   new state.
3. Friends and settlement.
4. Reads, then delete the client token.

## Until then

- Keep money stakes off. The pledge UI already gates on a disclaimer; the honest
  position is that a stake is a promise between people who trust each other,
  which is what the copy says.
- `charity.iluvProjectAfricaUrl` is still empty in `environment.ts`. Nobody can
  donate until that is set, and the settlement card says so rather than showing
  a dead link.
- Baserow database tokens support **per-table CRUD scoping**. Removing the
  `delete` grant costs nothing and stops the worst case — a user wiping another
  user's ledger. Worth doing this week regardless of the above.
