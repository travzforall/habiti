# Full Task & Project Management

**Created:** 2026-08-15
**Status:** Phases 0–4 built 2026-08-15. Phase 5 outstanding.
**Scope:** Attachments (documents, images, video), progress tracking, a view page
and an edit page per task, and the same treatment for projects — with tasks that
can be standalone or belong to a project.

---

## 1. What this covers

From the request, in the order it was asked:

1. `/tasks` gains attachments — documents, pictures and video.
2. Tasks track **progress**, not just done/not-done.
3. The pencil button in the task row navigates to an **edit page**.
4. Clicking the task row navigates to a **view page** showing everything about it.
5. Projects get the same, and a task is either **standalone** or **part of a project**.

---

## 2. Read this before writing any code

Four things are broken underneath the features above. They are cheap to fix and
impossible to build on top of, so they are Phase 0. Each claim below was checked
against the live Baserow instance on 2026-08-15, not inferred.

### 2.1 The mappers write a shape the tables do not have

`apps/habiti/src/app/models/task-row.models.ts` still maps to the SCHEDULER
tables (507/508, Baserow database 127) — its own header says so. But
`TasksService` and `ProjectsService` point at `userTasks` (631) and
`userProjects` (630) in database 128, which were created later from
`database-schemas/27-user-projects.json` and `28-user-tasks.json` with a
different, cleaner column set.

Baserow with `user_field_names=true` **ignores a field name it does not
recognise** instead of rejecting the write. So every one of these writes returns
200 and silently drops data:

| Mapper writes | Table 630/631 actually has | Result today |
|---|---|---|
| `fromProject` → `name` | `title` | **Every project row on the server has `title: null`** — confirmed on row 3 of table 630 |
| `fromProject` → `target_date` | `due_date` | Project due dates never persist |
| `fromProject` → (nothing) | `progress`, `color`, `icon`, `tags`, `archived`, `completed_at` | Never written, never read back |
| `fromTask` → `status: 'completed'` | `completed` (boolean) | **Ticking a task never persists.** Reload and it is untidied again |
| `fromTask` → `task_id` | — | Dropped |
| `fromTask` → (nothing) | `project_id`, `tags`, `assignee`, `sort_order` | Never written — see 2.3 |
| `toTask` reads `row.status` | — | `completed` is always `false` on load |
| `toTask` sets `createdAt` from `completed_at` | `created_at` exists | Created dates are wrong or "now" |

### 2.2 Two values will hard-fail the whole write

A value outside a `single_select`'s options makes Baserow reject the **entire
row**, not just that column:

- `PRIORITY_TO_ROW` maps `urgent → 'critical'`. Table 631's options are
  `low/medium/high/urgent`. **Saving any urgent task fails outright.**
- `PROJECT_STATUS_TO_ROW` maps `on-hold → 'on_hold,'` — reproducing a trailing-comma
  typo that exists in the scheduler table but *not* in `user_projects`, whose
  options are clean. **Saving an on-hold or cancelled project fails outright.**

Both mappings existed to work around the old tables. The new tables were built
to use the app's own vocabulary, so the translation layer should mostly go away.

### 2.3 There is no link between a task and a project

`toTask` hardcodes `projectId: 'standalone'` and `fromTask` never writes
`project_id`, even though table 631 has the column and schema 28 documents it
("`user_projects` row id, or the literal `'standalone'`"). This is exactly the
"standalone or part of a project" requirement, and it is one column away.

`ProjectsService` keeps `project.tasks` in the local cache only, so a project's
task list does not survive a different browser.

### 2.4 `/tasks` seeds five sample tasks into the account

`TasksComponent.ngOnInit` calls `createSampleTasks()` whenever the list is empty
— which writes five rows to the server for a brand-new user, and again for
anyone who deletes everything. "Grocery shopping" and "Call insurance company"
in the current UI are these. They must go before the page gets any more real.

### 2.5 Smaller things in the same area

- `createTask()` does `new Date('2026-08-20')` for the due date — that is **UTC**
  midnight, which is the previous day west of Greenwich. `parseDateOnly()` in
  `task-row.models.ts` already exists for precisely this and is documented as
  such; the create form does not use it.
- The create modal's Priority select opens blank because `newTask.priority` is
  undefined (visible in the current UI). No focus trap, no `Escape` to close,
  no `aria-modal`.
- `tasks.html` opens with `min-h-screen bg-gradient-to-br … p-6`, a second
  full-page background rendered *inside* the shell's glass panel.
- `getFilteredTasks()` is called from the template and sorts **in place** on
  every change-detection pass — it mutates the array behind a signal and does
  the work several times per frame. It should be a `computed()`.
- Deletion uses `window.confirm`.

---

## 3. Attachments: where the files actually go

### 3.1 What was verified

Baserow's file endpoint accepts the app's **database token** — no user JWT
needed. Probed against `db.jollycares.com` on 2026-08-15:

```
POST /api/user-files/upload-file/   (multipart, field name `file`)
Authorization: Token <environment.baserow.token>

→ 200 {"size":19,"mime_type":"text/plain","is_image":false,
       "image_width":null,"image_height":null,"uploaded_at":"…",
       "url":"https://db.jollycares.com/media/user_files/<random>_<hash>.txt",
       "thumbnails":null,"name":"<random>_<hash>.txt","original_name":"probe.txt"}
```

For images, `thumbnails` comes back with `tiny`/`small`/`card` URLs — that is
the gallery grid for free.

### 3.2 The finding that shapes the design

**The returned URL is public.** `GET` on it with no `Authorization` header
returns `200`. The path is long and random, so it is unguessable, but it is not
protected: anyone with the link can read the file, forever, from anywhere. Two
consequences:

- Deleting the attachment row does **not** delete the file. "Deleted" attachments
  remain fetchable at their URL indefinitely.
- A user photographing a prescription, a payslip or a letter to attach to a task
  has put that image on an unauthenticated URL. Given the Article 9 consent gate
  this app already ships for habits, and the Trust page that states what is
  actually true, this cannot be left unsaid.

The database token is also already in the client bundle, so anyone reading the
JS can upload arbitrary files to the instance. That is not new (row writes have
the same exposure) but storage abuse is a different cost from row spam.

### 3.3 Options

| | How | Cost | Verdict |
|---|---|---|---|
| **A. Direct to Baserow** | Browser → `upload-file`, store the URL in a row | None. Verified working today | **Recommended for phase 1**, with the disclosure in §8 and a size cap |
| **B. Proxy through `realtime-server`** | Add an upload route; it holds the token, checks the session, streams to Baserow | The relay stops being "off is fine" — see its README. New deploy surface | Right answer once uploads matter; phase 5 |
| **C. Signed URLs via Xano** | Xano storage + short-lived links | Xano only holds auth today; new bill, new store | Only if private-by-default becomes a requirement |

Go with **A**, build `AttachmentUploadService` as the *only* place that talks to
the upload endpoint, and make the switch to **B** a change to that one file.

### 3.4 Limits and handling

- **Size cap:** Baserow enforces `BASEROW_FILE_UPLOAD_SIZE_LIMIT_MB` server-side
  (commonly 20 MB). **Confirm the deployed value before promising video.** The
  client caps at whatever that is minus a margin, and says so before the upload
  starts rather than after.
- **Images:** downscale client-side (max edge 2048, JPEG q0.82) via `canvas`.
  This keeps phone photos under the cap and, as a side effect, **strips EXIF —
  including GPS**. Read orientation first (`createImageBitmap(file, {
  imageOrientation: 'from-image' })`) or portrait photos come back rotated.
- **Video:** no transcoding exists and none is planned. A 4K clip from a phone
  will exceed any sane cap. The uploader states the limit up front, accepts what
  fits, and refuses the rest with a plain message. Play with `<video controls
  preload="metadata">`; `hls.js` is already a dependency but is for streams, not
  for a single uploaded MP4.
- **Documents:** allow-list by MIME — pdf, plain text, markdown, csv, the Office
  and OpenDocument types, zip. Everything else is rejected by name, not silently.
- **Never** trust `file.type` alone for display decisions; use it for the
  allow-list, then sniff the first bytes for images before rendering inline.
- **Quota:** sum `size` per user from the attachments table. Free 100 MB, Plus
  2 GB, read through `SubscriptionService.isPaid()`. The number shows in Settings.

---

## 4. Data model

### 4.1 New Baserow tables

Follow the house conventions in `database-schemas/`: `user_id` is TEXT holding
`String(user.id)` (users live in Xano), **every read filters on it**, no link
fields, free-text where a select would reject something unplanned.

**`database-schemas/31-task-attachments.json`** (`task_attachments`)

| field | type | note |
|---|---|---|
| `title` | text, primary | original filename |
| `user_id` | text, required | every read filters on it |
| `parent_type` | single_select `task`/`project` | one table serves both |
| `parent_id` | text, required | `user_tasks` or `user_projects` row id |
| `kind` | single_select `image`/`video`/`document`/`link` | decided at upload from MIME |
| `url` | url, required | Baserow media URL, or an external link for `kind: link` |
| `thumbnail_url` | url | Baserow's `thumbnails.small` for images |
| `mime_type` | text | |
| `size_bytes` | number | quota is a sum of this column |
| `width` / `height` | number | from the upload response; avoids layout shift |
| `caption` | long_text | |
| `baserow_name` | text | the `name` the upload returned — the only handle for a future real delete |
| `uploaded_at` | date_time, auto_now_add | |

**`database-schemas/32-task-checklist-items.json`** (`task_checklist_items`)

`title` (primary), `user_id`, `task_id`, `completed` (boolean), `sort_order`,
`completed_at`, `created_at`.

A separate table rather than a JSON blob on the task: items are ticked
individually, often from a second device, and a blob makes that last-write-wins
— which is the one failure mode the sync model (per-scope refetch) cannot
paper over.

**`database-schemas/33-task-activity.json`** (`task_activity`) — phase 4, deferred.
`task_id`, `user_id`, `kind` (`created`/`status`/`attachment`/`comment`/`due_date`),
`from_value`, `to_value`, `at`. Feeds the detail page's history strip.

### 4.2 Columns to add to existing tables

Via `scripts/add-baserow-field.mjs` (needs a user JWT, as its header explains):

- `user_tasks` (631): `status` single_select `todo`/`in_progress`/`blocked`/`done`,
  default `todo`. `completed` stays and is kept in step (`completed === (status === 'done')`)
  so nothing that reads it today breaks.
- `user_tasks` (631): `progress_pct` number 0–100 — **only** for tasks with no
  checklist, where the user sets it by hand. With a checklist it is derived and
  not stored.
- `user_projects` (630): nothing new. `progress` already exists and is already
  documented as client-derived.

### 4.3 TypeScript (`models/project.model.ts`)

```ts
export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';
export type AttachmentKind = 'image' | 'video' | 'document' | 'link';

export interface Attachment {
  id: string;
  parentType: 'task' | 'project';
  parentId: string;
  kind: AttachmentKind;
  filename: string;
  url: string;
  thumbnailUrl?: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  caption?: string;
  baserowName?: string;
  uploadedAt: Date;
}

export interface ChecklistItem {
  id: string; taskId: string; title: string;
  completed: boolean; sortOrder: number; completedAt?: Date;
}

// Task gains: status, projectId (real), checklist, attachments,
// sortOrder, updatedAt, progressPct?. `completed` stays as a derived mirror
// of `status === 'done'` so existing callers keep working.
```

`Attachment` already exists but has no `kind`, `mimeType` or thumbnail, and
`Task.attachments` is never populated. Extend rather than replace.

---

## 5. Routes and pages

| Route | Page | Notes |
|---|---|---|
| `/tasks` | list (exists) | list / board views, filters, bulk actions |
| `/tasks/new` | create | same form component as edit, empty |
| `/tasks/:id` | **view** | where a row click lands |
| `/tasks/:id/edit` | **edit** | where the pencil lands |
| `/projects` | list (exists) | |
| `/projects/:id` | project detail | tabs: Overview · Tasks · Files · Milestones |
| `/projects/:id/edit` | edit | |

All lazy-loaded with `canActivate: [AuthGuard]`, matching every other feature
route in `app.routes.ts`.

**Cold cache is the interesting case.** Open `/tasks/482` in a new tab and the
service has an empty list — today's services only ever load *all* rows for the
user. Both services need `loadOne(id)` backed by `BaserowService.getRow`, and the
page needs three states: loading, found, and a plain "this task no longer
exists" with a link back — `habit-detail` already models this and should be
copied rather than reinvented.

**View page** (`/tasks/:id`): breadcrumb (`Tasks` or `Projects › <project>`),
title, status control, progress bar, due date with overdue styling, priority,
tags, estimate vs actual, description, checklist, attachment gallery, activity
strip (phase 4), and actions — Edit, Move to project, Duplicate, Delete.

**Edit page** (`/tasks/:id/edit`): the same `TaskFormComponent` used by create.
Dirty-state guard on navigating away, `Escape`/Cancel returns to the view page,
save returns to the view page with a toast. Attachments are managed on the view
page, not inside the form — uploads are immediate and should not be trapped
behind an unsaved form.

---

## 6. Progress tracking

Four inputs, one number, no magic:

1. **Status** — `todo`/`in_progress`/`blocked`/`done`. Blocked is deliberately a
   status and not a flag; it is the thing worth seeing on a board.
2. **Checklist** — `done / total` when a checklist exists. This *is* the progress.
3. **Manual percentage** — only offered when there is no checklist.
4. **Time** — `estimated_hours` vs `actual_hours`, both already columns. Shown as
   context, never folded into the percentage; hours spent are not progress made.

```
progress(task) =
  status === 'done'            → 100
  checklist.length > 0         → round(100 * done / total)
  progressPct set              → progressPct
  status === 'in_progress'     → 10   (something has started; be honest that it is a floor)
  otherwise                    → 0
```

**Project rollup:** `project.progress` = mean of its tasks' progress, weighted by
`estimated_hours` where every task has one, unweighted otherwise. Computed on the
client, written to the existing `progress` column on change so the list view does
not have to load every task to draw a bar.

**Time logging:** phase 4. A start/stop control on the view page that adds elapsed
time to `actual_hours`, which is where the planned Pomodoro work joins up
(`docs/tasks/20251206-pomodoro-timer-planned.md`).

---

## 7. Components to build

Under `apps/habiti/src/app/components/`, standalone, following the house style:

- **`attachment-uploader`** — drop zone, file picker, paste-from-clipboard,
  `capture` on mobile for camera. Per-file progress, cancel, retry. Refuses
  oversize/disallowed files before the request, with the reason.
- **`attachment-gallery`** — image grid off `thumbnail_url`, lightbox with
  keyboard nav, inline `<video>`, documents as icon + name + size + download.
  Delete with confirmation, caption editing.
- **`task-form`** — one form, three hosts (create page, edit page, quick-add modal).
- **`task-checklist`** — add/tick/reorder/delete, optimistic, per-item persistence.
- **`progress-bar`** — used by tasks, projects and the project list.
- **`status-select`** — the four statuses with consistent colours everywhere.
- **`project-picker`** — "Standalone" plus the user's projects; used by the form
  and by "Move to project".
- **`confirm-dialog`** — replaces `window.confirm` across tasks, projects and the
  dashboard. Focus trap, `Escape`, `aria-modal`; the create-task modal adopts it too.
- **`empty-state`** — the same three-part empty block the tasks and projects pages
  each hand-roll today.

---

## 8. Privacy, legal and the Trust page

This repo gates Article 9 habits behind explicit consent and keeps a Trust page
that says what is actually true. Attachments have to meet that bar:

- **First-upload notice** (once per account, in the shape of `sensitive-consent`):
  files are stored on Habiti's Baserow instance at an unguessable but
  **unauthenticated** URL; anyone with the link can open it; and removing an
  attachment removes it from the task but does not currently erase the stored file.
- **Trust page + privacy policy:** add attachments to what is stored, where, and
  for how long. Do not write "encrypted at rest" or "private" unless and until
  option B or C in §3.3 lands and makes it true.
- **Deletion:** an honest path is either a real delete (needs the proxy, since
  file deletion is not exposed to a database token) or a documented "detached but
  retained". Pick one and say it in the UI, not only in the policy.
- **Export:** the data export must include attachment URLs; a task export without
  its files is a partial export.
- **EXIF stripping** from the downscale step is a genuine privacy win — but only
  for images, and only because they are re-encoded. Video keeps its metadata.

---

## 9. Phases

### Phase 0 — Make persistence tell the truth (blocks everything)

- [x] Rewrite `task-row.models.ts` against tables 630/631: `title` not `name`,
      `completed` boolean not `status` select, `due_date` not `target_date`,
      drop `task_id`, keep `urgent` as `urgent`, `on_hold` without the comma
- [x] Round-trip `project_id`, `tags`, `assignee`, `sort_order`, `created_at`
- [x] Unit-test the mappers against the real column names — a `toRow`/`fromRow`
      round trip plus a test asserting every written key exists in the schema JSON,
      which is what would have caught `title: null`
- [x] Fix `TasksService.persist` so completion actually saves; verify by reloading
- [x] Add `loadOne(id)` to both services for cold-cache deep links
- [x] Delete `createSampleTasks()` and its `ngOnInit` call
- [ ] Repair the existing rows: 9 project rows in table 630 have `title: null`
      (a one-off `scripts/` fix, or re-save from the local caches that still hold them)
- [x] Use `parseDateOnly` in the create form so a due date is not off by a day

**Done when:** create a task, tick it, set it urgent, reload in a private window —
everything is exactly as left. A project keeps its title on the server.

### Phase 1 — View and edit pages

- [x] `/tasks/:id` view page with loading / found / not-found states
- [x] `/tasks/:id/edit` page with the shared `task-form`
- [ ] Dirty guard on that page (CanDeactivate) — NOT built; leaving mid-edit loses it
- [x] `/tasks/new` reusing the same form
- [x] Row click → view; pencil → edit (`routerLink`, so middle-click and
      "open in new tab" work — not a `(click)` handler)
- [x] Breadcrumbs
- [ ] Back to the list PRESERVING FILTERS — NOT built; filters are component state
      and reset when you come back from a task
- [x] `confirm-dialog` replaces `window.confirm`; create modal gets focus trap,
      `Escape`, `aria-modal`, and a Priority default
- [x] `getFilteredTasks()` becomes a `computed()` and stops sorting in place
- [x] Drop the nested `min-h-screen` gradient from `tasks.html`
- [x] Dashboard "Today's Tasks" rows link to the new view page

**Done when:** every task field can be read on one page and changed on another,
by URL, with the back button behaving.

### Phase 2 — Attachments

- [x] Schema file 31 (`task_attachments`) written, id registered in `environment.ts`
- [ ] Actually CREATE the table: `node scripts/create-baserow-table.mjs
      31-task-attachments.json --apply` (needs a user JWT, so it could not be run
      from here). Until then `taskAttachments` stays 0 and attachments live in
      local storage only — uploads still work, the record just does not sync
- [x] **Confirm the instance's upload size limit** and hard-code the client cap below it
- [x] `AttachmentUploadService`: single-file upload, progress, cancel, MIME
      allow-list, size check, image downscale + orientation fix
- [x] `AttachmentsService`: list/create/delete rows, per-user quota sum, `SyncBus`
- [x] `attachment-uploader` and `attachment-gallery`
- [x] Wire into the task view page and the project detail Files tab
- [x] First-upload privacy notice; Trust page and privacy policy updated
- [x] Offline: uploads are refused with a clear message rather than queued

**Done when:** a photo, a PDF and a short video can be attached, seen, downloaded
and removed, on a phone and a desktop, and the storage story is written down.

### Phase 3 — Progress and status

- [x] `status` and `progress_pct` added to schema 28 and written by the mapper
- [ ] Actually ADD the two columns to live table 631 with
      `scripts/add-baserow-field.mjs` (needs a user JWT). Baserow drops them
      silently meanwhile and status is derived from `completed`, so nothing breaks
- [x] Status control, progress bars, `task-checklist` + schema file 32
- [ ] Create table 32 (same command, same JWT constraint) — checklists are
      local-only until then
- [x] `progress()` as a pure, tested function
- [x] Project rollup written to `user_projects.progress`
- [x] Board (kanban) view on `/tasks` and on the project Overview tab, WITHOUT
      drag-and-drop — `@angular/cdk` was not added, as the plan's open decision 4
      recommended. Status is changed from the task page instead
- [x] Estimate vs actual shown on the view page

### Phase 4 — Projects as first-class

- [x] `/projects/:id` with Overview · Tasks · Files · Milestones
- [x] `/projects/:id/edit`
- [x] Move a task between projects and standalone, from the form and the list
- [x] Project task list reads from table 631 filtered on `project_id` (not the cache)
- [ ] Milestones persisted (table 511 is the scheduler's; a `user_milestones`
      schema file is needed, same pattern as 27/28)
- [ ] Activity strip + table 33
- [x] Time logging into `actual_hours`

### Phase 5 — Hardening

- [ ] Move uploads behind `realtime-server` (option B), keeping
      `AttachmentUploadService` as the only caller
- [ ] Real file deletion, or the honest statement that files are retained
- [ ] Attachments in the data export
- [ ] Recurring tasks, dependencies, templates — the parts of
      `20251206-project-management-planned.md` this plan does not touch

---

## 10. Testing

The repo's habit is pure functions plus focused specs, and this feature has three
things worth testing that way:

- **Mappers** (`task-row.models.spec.ts`) — round trips, and an assertion that
  every key written appears in the table's schema JSON. This is the test that
  makes 2.1 impossible to repeat.
- **`progress()`** — each branch, including "checklist beats manual percentage".
- **`AttachmentUploadService`** — `HttpTestingController` for the multipart call,
  the allow-list, the size cap, and that a failed upload creates no row.
- **Routing** — `RouterTestingHarness` (as in `root.spec.ts`) for `/tasks/:id`
  with a cold cache and for an id that does not exist.
- **Pages** — smoke specs that the view page renders a task's fields and the
  pencil's `routerLink` points at `/tasks/:id/edit`.

`npm run verify` (lint, typecheck, tests, build, bundle, assets, legal) is the gate.

---

## 11. Open decisions

1. **Upload size cap** — needs the deployed `BASEROW_FILE_UPLOAD_SIZE_LIMIT_MB`.
   Everything about video promises depends on it. *Recommend: find out before
   phase 2 starts; if it is 20 MB, say "short clips" in the UI and mean it.*
2. **Public file URLs** — accept for now with disclosure, or build the proxy
   first? *Recommend: accept + disclose for phase 2, proxy in phase 5. The
   disclosure is not optional.*
3. **Checklist storage** — table (recommended) vs JSON blob on the task.
4. **`@angular/cdk`** for drag-and-drop — new dependency vs a board without DnD
   in phase 3. *Recommend: ship the board without DnD, add the dep only if the
   board earns it.*
5. **Comments on tasks** — not in the request; deferred. Table 510 is the
   scheduler's and is not reusable here.
6. **Sharing a project with a friend** — out of scope. The friends system exists,
   but every read here filters on `user_id`, and sharing changes that model
   everywhere at once.

---

## 12. Out of scope

Team collaboration, OKRs, business profiles, Gantt charts, natural-language quick
add, and the rest of `20251206-project-management-planned.md`. That document
stays as the long-term vision; this one is the part that makes tasks and projects
genuinely usable.

---

## 13. What was built, 2026-08-15

Phases 0–4 are in. What follows is the part that matters when picking this up
again: what is finished, and what is deliberately still open.

### Three things need a Baserow user JWT and could not be done from here

The database token in `environment.ts` reads and writes rows but cannot create
tables or fields. These are one command each, and the app degrades honestly
without them (local-only, warning once) rather than failing:

```bash
node scripts/create-baserow-table.mjs 31-task-attachments.json --apply
node scripts/create-baserow-table.mjs 32-task-checklist-items.json --apply
node scripts/add-baserow-field.mjs   # status + progress_pct on table 631
```

Paste the returned ids into `environment.ts → baserow.tables.taskAttachments`
and `.taskChecklistItems`. Until then: attachments and checklists work but stay
on one browser, and a task's status is derived from `completed`.

### Junk rows the old mapper left behind

Nothing was deleted from the live database — that is the owner's call. On the
dev account (`user_id: 1`):

- **table 630:** rows 3–11, nine copies of the same project, every one with
  `title: null`. They render as "Untitled project" and can be renamed on
  `/projects/:id/edit` or deleted from `/projects`.
- **table 631:** rows 3–6, the four sample tasks that used to be seeded. Note
  there were five: the fifth was `urgent`, and its write was rejected outright
  by the priority mapping described in §2.2 — visible proof of that bug.

### The bundle

Initial total went from **769.26 kB to 783.8 kB** (+14.5 kB), leaving
**16.2 kB** of headroom against the budget. Every new page is lazy; the eager
growth is the mappers, the progress helper, and a 3.4 kB chunk holding
AttachmentsService and ChecklistService, which `sync-refreshers.providers.ts`
reaches so they can be cleared when the signed-in account changes.
`config/attachment-limits.ts` exists solely to keep the upload service — canvas
downscaler and all — out of that eager graph.

### Verified

`npm run verify` passes end to end: lint, typecheck, **732 unit tests**
(up from 653), build, bundle budget, assets, legal hashes, and the new
`verify:fields` check.

### The /projects page lost its inline detail view

Clicking a project card used to reveal a detail view rendered inside
`projects.html` — roughly 300 lines of tasks, milestones and goals, reachable
no other way. With `/projects/:id` existing, that was two copies of one screen,
so the inline one was deleted and its milestone and goal editing moved onto the
new page (with the same on-screen note that both are still device-local). The
List/Board toggle went too: only the list branch was ever written, so choosing
Board rendered an empty page.

### The project page has no tabs

Overview, Tasks, Files, Milestones and Goals were tabs for about an hour. On a
page whose whole purpose is the overview, a tab strip means seeing any one
section costs a click and hides the other four — so they are all on screen at
once: numbers, then the board, then a main column of tasks with files,
milestones and goals stacked beside it.

The first attempt at that was a three-column grid, which was wrong twice over:
four cards do not divide into three columns, so it left a hole, and grid rows
stretched a short Files card to match a long task list. The sidebar is its own
nested stack now, with `items-start` on the grid.

## Project types and the timeline (added 2026-08-16)

**Types.** `personal | work | business | study | home | creative | health`, in
`config/project-types.ts` — one place, so a type means the same thing on the
list, the header, the picker and the timeline. Each carries a colour, an icon
and a one-line hint; the colour is what stops five projects being five identical
blue cards, and on the timeline it tints the month axis. A closed set: free text
becomes forty spellings of "work", and a Baserow single_select rejects anything
outside its options anyway, so an unknown value read from a row falls back to
`personal` rather than failing the save.

The `type` column is PENDING in table 630 — Baserow drops it silently until
`add-baserow-field.mjs` runs, and the fallback makes that harmless.

**The timeline.** `/projects/:id` has a full-width card: milestones down the
left, months across the top, a red line for today.

- A milestone WITH a start date draws as a bar, filled by its progress; one
  without draws as a diamond on its target date, because a milestone that is
  only a deadline should not pretend to have a duration.
- Its tasks are dots on the same row — grey for due, green done, red overdue.
  That is what "a milestone made of tasks" looks like when you stand back.
- Dated tasks in no milestone get their own row. Grouping must never be the
  reason a piece of work stops being visible.
- Milestone membership is `milestone_id` on the TASK, not a list on the
  milestone: a task belongs to one milestone, so it is a property of the task,
  and one write moves it rather than two lists needing to agree. Also pending in
  table 631.

`config/timeline-layout.ts` is pure — dates and tasks in, percentages out — with
23 specs: the range covers every date the project knows about and is padded to
whole months, a one-month project still gets two columns, a same-day milestone
still has a visible bar, today is null when it falls outside the range, and
`milestoneProgress` never guesses from a date, because time passing is not
progress. Percentages rather than pixels means no resize listener.

CSS and not SVG, unlike the mind map: every bar is a rectangle on a horizontal
track, and the hard parts here are truncation, hover, links and wrapping — all
free in HTML.

Deleting a milestone releases its tasks rather than deleting them, and says so.

### Still open

- Phase 5 in full (upload proxy, real file deletion, attachments in the export).
- Milestones and goals remain local-cache-only; the project page says so on screen.
- No dirty guard when leaving a half-edited task.
- Filters on `/tasks` reset when you navigate away and back.

---

## 14. Inspiration boards (added same day)

A board of the things that make you want to do the work: YouTube videos,
pictures, links and notes.

- **`/inspiration`** is the personal board, plus an index of any project boards
  that have something on them.
- **Every project has its own**, in the sidebar of `/projects/:id`.
- `board` is a TEXT column holding `'personal'` or a `user_projects` row id —
  the same shape as `project_id` on a task, and for the same reason.

**Nothing is re-hosted.** A card points at the original address, so a board
costs no storage and no attachment quota — and if the far end deletes the
video, the card shows "Preview unavailable" rather than pretending. Uploading a
picture of your own is what attachments are for.

### Two decisions worth knowing

**Videos do not play in the page.** An inline player means an `<iframe>` whose
src must be marked safe, which means `DomSanitizer` — and this app deliberately
has no HTML-injection surface at all (no innerHTML, no sanitiser, no markdown
renderer). An embed is also a third-party frame with its own cookies inside an
app that sets none. So a video is a thumbnail with a play badge, and clicking
opens YouTube in a new tab.

**The thumbnail is still fetched from Google**, which is the one privacy cost
and is stated on the board itself, not just in the policy: the privacy document
gained an "Inspiration boards" section saying exactly what that request does and
does not reveal. Requests carry `referrerpolicy="no-referrer"` and `loading="lazy"`.

`recogniseMedia()` (config/media-links.ts) handles the six YouTube URL shapes —
watch, youtu.be, shorts, embed, live, mobile — keeps a `?t=` timestamp, strips
share-tracking parameters, refuses anything that is not http(s), and declines to
call a search page a video. It lives in `config/` rather than beside the models
because the service is eagerly reachable and the parser is not needed until
someone pastes something.

### Table and bundle

`database-schemas/33-inspiration-items.json`, id registered as 0 in
`environment.ts`, local-only until:

```bash
node scripts/create-baserow-table.mjs 33-inspiration-items.json --apply
```

`inspiration` was added to `RefreshScope` in the shared protocol lib. The RELAY
does not know it and drops unknown scopes — deliberate, since nothing another
user does can change your board. If boards ever become shareable, add it to
realtime-server's list first.

Bundle: 783.8 → 788.8 kB, leaving **11.2 kB** of headroom. The service is eager
because sync-refreshers must be able to clear it when the account changes —
that is not optional, it is the data-bleed UserStorage exists to prevent — so
the parser was split into `config/media-links.ts` to keep the rest lazy.
**Headroom is now the constraint to watch: it was ~30 kB before this session.**
