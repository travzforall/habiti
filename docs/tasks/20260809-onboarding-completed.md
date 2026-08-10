# New-User Onboarding: Setup Wizard + Interactive App Guide

**Status:** Completed — 2026-08-09
**Scope:** First-run setup wizard, interactive spotlight guide, per-page first-visit tips

---

## Why

Habiti had no onboarding of any kind. A grep of `src/` for
`onboard|walkthrough|firstTime|isNewUser|welcome|tour|intro` returned only false
positives. A new user went `/register` → `/login?registered=true` → sign in →
`/dashboard`, and landed on an empty habit grid with one button — with 17
template packs, a five-category habit library, challenges, calendar, analytics
and gamification all sitting unmentioned behind it.

## What shipped

**1. Setup wizard** (`src/app/components/onboarding-wizard/`) — five steps:
welcome → focus areas → starter habits → theme & difficulty → done. Skippable in
one click from every step (and via Esc). The final step carries a
checked-by-default "Show me around the app" checkbox.

**2. Interactive app guide** (`src/app/components/tour-overlay/`,
`src/app/services/tour.service.ts`) — a custom ten-step spotlight walkthrough
routing across dashboard → habits → templates → calendar → analytics → settings.
No third-party tour library.

**3. Per-page first-visit tips** (`src/app/config/page-tips.ts`) — one-off
centred tips for `/challenges`, `/friends`, `/game`, `/tasks`, `/projects` and
`/calendar`, which is what keeps the main guide at ten steps.

---

## Decisions worth remembering

### Only a genuine HTTP 200 may conclude "not onboarded"

The single highest-risk thing in this feature. `BaserowService.skip()`
([baserow.service.ts:98](../../src/app/services/baserow.service.ts#L98)) emits an
**empty result set** rather than throwing when the table id is `0` or the token
is missing — byte-identical to "this user has no row", which means "show the
wizard". Read naively, an unreachable Baserow shows the wizard on every load,
forever, to everyone.

`OnboardingService` therefore tracks a tri-state
(`idle | loading | loaded | unavailable`), never calls Baserow when the table id
is 0, and mirrors everything to `localStorage['habiti-onboarding-<userId>']`.
The remaining hole — unavailable *and* no mirror — falls back to the app's
existing first-run signal (`habits().length === 0`), so a genuine new user is
still onboarded while an established one is left alone.

### Onboarding state is a new Baserow table, not a Xano user field

Users live in Xano, not Baserow. Adding columns there would mean editing the
workspace, `/users/update` and `/auth/me`'s response shape — three changes
outside version control. `26-user-onboarding.json` follows the tables-15–22
convention instead: `user_id` as plain text holding `String(user.id)`.

**It is forgeable** (the Baserow token ships in the bundle). Never gate an
entitlement, trial or paywall on these fields.

### The wizard is `@defer`'d, and that is load-bearing

It pulls in the whole habit library to build the starter-habit step, which added
**~137 kB to the initial bundle** when eager — paid by every user on every
visit, to render nothing for all but the handful being onboarded. Deferring the
wizard and the tour overlay brought the initial bundle from 840 kB back to
745 kB (baseline was 704 kB, budget 750 kB).

### The wizard only asks what the app can honour

Theme, challenge difficulty, focus areas and starter habits — each has a real
consumer. `GameState.weekStartsOn`, `soundEnabled` and `notificationsEnabled`
were considered and **rejected**: grep shows nothing reads them. Habit reminder
times likewise — there is no notification delivery system, and
`persistNewHabits()` does not write `reminder_time`.

### Spotlight: one box-shadow element plus a separate click blocker

`box-shadow: 0 0 0 9999px` paints the dim, the hole and the ring as one element
whose four numbers CSS transitions for free. Chosen over an SVG mask (4× the
markup, hand-animated `<rect>` attributes) and four scrim panels (no rounded
corners).

The catch: **a box-shadow captures no pointer events**, so on its own everything
stays clickable. A separate transparent blocker eats those clicks — and simply
not rendering it is how `interactive: true` steps let the user tap the real
control.

No `backdrop-filter` on the spotlight, ever. It would make it a containing block
for `position: fixed` descendants and re-create the bug documented at
[root.html:20-34](../../src/app/root/root.html#L20-L34).

---

## Bugs found and fixed along the way

| Bug | Where | Effect |
|---|---|---|
| Game-state load discarded preferences | `habits.ts` ~:1779 | `theme`, `weekStartsOn`, `notificationsEnabled`, `soundEnabled` **and unlocked `achievements`** were hardcoded back to defaults on every Baserow load. Now merges. |
| Library categories never resolved | `habit-library/index.ts` | Library ids (`fitness/health/mind/work/life`) only overlap `CATEGORY_SLUG_TO_NAME` on `health`, so `categoryRowIds().get('fitness')` was undefined and **every templated habit was written to Baserow with no category**. Added `appCategorySlug()`. |
| `toggleTheme()` never persisted | `top-nav.ts` | Wrote `GameState.theme` and re-applied the attribute but never touched localStorage, so cycling the theme reverted on reload. It was also unreachable — nothing in the template called it. Deleted; `ThemeService` now owns theme in one place (it had three copies). |
| Tour hijacked its own navigation | `tour.service.ts` | `NavigationEnd` fires while `step()` is still the *previous* step, whose route no longer matches — so the tour treated its own move as the user wandering off, cancelled the in-flight step and re-resolved the old one. Symptom: stuck on step 5's tip while on step 6's page. Now ignored while `resolving()`. |
| Stale spotlight across routes | `tour.service.ts` | The previous step's rect stayed painted during navigation, ringing unrelated content on the new page. Anchor is now cleared at the start of `resolve()`. |
| `waitForTarget` mixed clocks | `tour.service.ts` | A `performance.now()` deadline inside an rAF poll never trips under a virtual clock. Deadline is now a real timer. |
| `DEFAULT_PREFERENCES` shared its array | `onboarding.models.ts` | A shallow spread shared `focusAreas`, so the first `push` mutated the module constant app-wide. Frozen, plus `defaultPreferences()`. |

---

## Verification

`npx tsc --noEmit` clean · **532 unit tests pass** · `ng build` clean, under budget.

Driven in real Chrome over CDP (no puppeteer in this project; `ws` + system
Chrome is enough):

- **Desktop 1440×900 — 23/23**: wizard opens for a new user, all five steps,
  live theme preview, finish creates habits with real Baserow ids, guide starts,
  spotlight anchors, cross-route navigation, Esc exits, nothing reappears on
  reload.
- **Mobile 390×844 — 10/10**: wizard fits with no horizontal scroll, Skip still
  starts the guide, the nav step correctly swaps to the bottom-nav target with
  its own copy, and the tip card clears the fixed bottom nav.
- **Degradation** (the critical negative case): with table 26 absent and the
  mirror wiped, an established user is **not** re-onboarded.

---

## Follow-ups (deliberately out of scope)

- **Create Baserow table 26** and set `environment.ts` →
  `baserow.tables.userOnboarding`. Until then the feature runs local-only, which
  is why the degradation path above matters.
- **Auto-login after registration.** `register()`
  ([auth.service.ts:78-138](../../src/app/services/auth.service.ts#L78-L138))
  discards the token it receives, so the wizard only appears after the user's
  *second* form. Fixing it is a better first run but a behaviour change with its
  own risk profile.
- **Settings' other controls are still dead markup** — the theme select and the
  notification checkboxes have no bindings. The new "Getting started" card is
  genuinely wired; do not copy the ones around it.
- **Dark mode is half-wired**: `data-theme` drives daisyUI, but
  `tailwind.config.js` sets no `darkMode` key, so Tailwind's `dark:` variants
  follow the OS instead. The wizard's theme preview is therefore only partly
  visible.
- **`rive/status-avatar.riv` is missing from `public/`** — the top-nav avatar
  logs "Bad header" / "file failed to load" on every route. Pre-existing,
  unrelated, but noisy.
