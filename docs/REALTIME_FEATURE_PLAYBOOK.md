# Playbook: "both people see it immediately"

How to ask for — and how to build — a feature where one user does something and
another user's screen reacts at once, with a toast, on whatever page they happen
to be on.

Written after the friend-invite feature took roughly a dozen rounds to get
working. Almost none of that was the hard part (the relay). It was six separate
places where a link in the chain failed **silently**. This file exists so the
next feature costs one round instead of twelve.

---

## 1. The prompt

Copy this, replace the bracketed parts:

> I want **[ACTION]** to feel instant for **[WHO ELSE SEES IT]**.
>
> When **[user A does X]**, then **[user B]** should — without reloading and on
> whatever page they're on — see **[what changes]** and get a toast saying
> **[roughly what]**.
>
> Wire it through the existing realtime path: publish from the service on
> **every** code path that can cause it (including the update/revive paths, not
> just the create path), hint only the scopes that actually changed, and let
> `NotificationsService` derive the toast — don't raise one from the sync layer.
>
> Before telling me it works:
> - list every mutating path in the feature and confirm each one publishes
> - confirm the notification id changes when the same row causes the event a
>   second time
> - add a test that pushes an envelope in and asserts a toast comes out, with no
>   component mounted
> - tell me what I should see in the relay log and in the receiver's console
>
> If any layer can fail without an error, make it say so.

### Why each part is in there

| The line | What it prevents |
|---|---|
| "on whatever page they're on" | Forces the work into services, not a component. A page-level subscription only works while that page is open. |
| "every code path… including revive" | The bug that cost the most time: create published, update didn't. |
| "hint only the scopes that changed" | Stops a friend event reloading challenges, habits and levels. |
| "let NotificationsService derive the toast" | Two toast sources produce duplicates and disagree. |
| "notification id changes on a second occurrence" | Dismissed-once meant muted-forever. |
| "test that pushes an envelope, no component" | The only test that proves the "any page" claim. |
| "if any layer can fail without an error, make it say so" | Every single bug here was silent. |

---

## 2. The chain

Seven links. **Six of the seven failed silently at some point.** When something
doesn't work, find the first broken link rather than guessing at the ends.

```
A writes to Baserow
   → A's service publishes a hint      (SyncBus.emit)
      → relay fans out by user id / email
         → B's RealtimeService receives
            → B's SyncService refreshes the hinted scopes
               → B's data signals change
                  → NotificationsService derives a toast
                     → toast host renders it
```

### Where to look, in order

| # | Check | Healthy | Fails silently as |
|---|---|---|---|
| 1 | Row in Baserow | correct row, correct address | invite to a typo'd address looks identical to a dead relay |
| 2 | `SyncBus.emit` called | one per mutating path | sender's UI is perfect, peer never told |
| 3 | Relay log | `publish … delivered: 1` | `delivered: 0` = addressed a room nobody is in |
| 4 | `curl :8080/healthz` | `users: 2` | `users: 1` = only one side connected |
| 5 | B's console | `Realtime: received <kind>` | nothing = never arrived |
| 6 | B's badge/list updates | scope refreshed | data moves but no toast = it's the notification layer |
| 7 | Toast appears | — | host not mounted, or id already seen |

`users` matters more than `connections`: two windows of the *same* account is
`connections: 2, users: 1`, and a one-to-one event still delivers nothing.

---

## 3. Rules for this codebase

**Publish from the service, after the write succeeds.** `SyncBus.emit()` for
"tell the other person", `SyncBus.touched(scope)` for "I changed something
locally, poll faster". They are not interchangeable — `touched` never leaves the
browser. In `FriendsService`, `patch()` takes an optional post-success event
callback; follow that shape.

**Enumerate the mutating paths.** Create, update, revive, cancel, delete. Write
them down and tick each one off. Four of five were missing here, and the create
path working made it look done.

**Address by user id AND email when both are known.** Someone invited by email
has no user id until they accept — email is the only way to reach them. See
`peerAddresses()` in `FriendsService`.

**Hint the smallest true set of scopes.** `{ scope: ['friends'] }`, not every
scope. Scopes are declared in `realtime.models.ts`; adding one means updating
the relay's copy too — `npm run check:protocol` in `realtime-server/` fails the
build if the two drift, including the runtime `KINDS`/`SCOPES` sets, which are
the ones that fail invisibly.

**Never toast from the sync layer.** `SyncService` refreshes signals;
`NotificationsService` derives notifications from those signals and de-dupes.
Adding a second source produces doubles that disagree with the bell.

**Make the notification id include the occurrence, not just the row.**

```ts
id: `friend_request:${friend.friendshipId}:${stamp(friend.invitedAt)}`
```

The seen-set is persisted in `localStorage`. An id built from the row alone
means: dismiss once → that row can never notify again. If a row can cause the
same event twice, the id must carry a timestamp that changes.

**Anything rendered on every route belongs in `root/root.html`.** That is the
bootstrapped shell (`main.ts`). A component nothing renders is invisible to
everything except its own unit test.

**Always hydrate and always complete.** `NotificationsService` gates on
`hydrated()` signals, so a service that leaves `hydrated` false on an error path
silently mutes every toast in the app. An observable that never completes also
wedges `SyncService`'s in-flight promise and stalls all later syncs. Handle the
error branch: set hydrated, complete, warn.

---

## 4. Tests that would have caught these

Two kinds. Unit tests on the feature service missed all of it.

**Did it publish?** Subscribe to `SyncBus.outbound$` and assert the event, its
`to`, and its scopes — per mutating path, plus one asserting nothing is
published when the write fails. A missing publish is invisible from the UI:
the row saves, the sender's screen updates, and only the other person notices,
later. See `friends.service.spec.ts`.

**Envelope in, toast out.** Real `SyncService` + real `SyncBus` + real
`NotificationsService`, fake only the network edges. Push an envelope, assert a
toast. **Mount no component** — that absence is the proof that the route doesn't
matter. See `realtime-toast.integration.spec.ts`.

Two traps in that integration test:

- `syncNow()` returns a promise, and a hint arriving mid-flight is queued rather
  than run. Drain microtasks (`await Promise.resolve()` a few times) before
  asserting, or you measure the previous sync and get a false pass.
- Assert on a *changed* signal, not merely that `refresh` was called — `refresh`
  may have been called by the auth sync.

---

## 5. Debugging, in order

Cheapest and most decisive first.

1. **`curl localhost:8080/healthz`** — relay up? `users: 2`?
2. **Look at the row in Baserow.** Right address, right status? A typo'd
   recipient is indistinguishable from a broken push, and it cost an hour here.
3. **Relay log.** No `publish` line = the sender never published (usually a
   stale bundle, or a path that doesn't emit). `delivered: 0` = the address
   matched no room; set `DEBUG_ADDRESSES=true` to see what was targeted.
4. **Receiver's console.** `Realtime: received …` = it arrived; the remaining
   problem is in the app.
5. **Does the badge move?** If yes, the whole pipeline works and it is purely
   the notification/toast layer — check the id against the seen-set.

**Hard-reload both windows after any client change.** `environment.ts` is
compiled into the bundle; a window opened before an edit keeps the old values
forever. Several rounds here were spent on a window running stale code.

Two accounts side by side: a normal window and a private window on the same
origin have separate storage, which is the easy way to do it. The profile
dropdown shows name and email — check it, since "which window is which" is a
genuine source of confusion.

---

## 6. What actually went wrong last time

Ordered by how long each took to find. Note how few were the "hard" part.

1. **The shell was never rendered.** `main.ts` bootstraps `RootComponent`;
   `<app-toast>` lived in a different, orphaned component. No toast could ever
   appear, from any feature. Its unit test passed by rendering the orphan.
2. **Notification ids didn't change per occurrence.** Re-inviting reused the
   row id; dismissed once meant muted forever.
3. **The revive path never published.** Create emitted, update didn't.
4. **Baserow filters were silently ignored.** `filter__field_<name>__` instead
   of `filter__<name>__` returned the entire table, so every user read the first
   row — someone else's data — with no error.
5. **A typo'd email** (`"j  jstain@email.com"`) passed a `includes('@')` check
   and produced an invite addressed to nobody.
6. **`logout()` cleaned up in RxJS `complete`,** which never runs after an
   error — so an expired token made sign-out impossible.
7. **The relay wasn't running,** twice, while we debugged the app.

The relay itself worked from the first attempt.
