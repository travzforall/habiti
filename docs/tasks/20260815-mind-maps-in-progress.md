# Mind Maps

**Created:** 2026-08-15
**Status:** Phases 0–4 built 2026-08-15. Phase 5 outstanding.
**Scope:** An EdrawMind-style mind map editor. Maps stand alone as idea maps or
belong to a project, and a node can carry a real task rather than just the word
for one.

---

## 1. What this covers

1. A **mind map editor** — a central topic, branches either side, curved
   connectors, collapse/expand, keyboard-first editing.
2. Maps that are either **standalone** or **part of a project**, the same choice
   a task already has.
3. A **node that holds a task**: link an existing one, turn a node into one, tick
   it from the map, and turn a whole branch into a project's task list.

Deliberately not in scope: see §13.

---

## 2. What a mind map is here, decided up front

Three decisions shape everything below, so they come first.

**A map is a TREE, not a graph.** Every node has exactly one parent. That is
what makes automatic layout possible, and automatic layout is what makes a mind
map pleasant rather than a diagram you spend your evening tidying. Cross-links
("this idea relates to that one") are a later, cosmetic addition drawn on top —
never a second parent.

**Layout is computed, not stored.** Nodes have an order and a side; they do not
have x/y. Adding a node re-lays out the map in one pass, which is why a map
looks tidy without anyone tidying it. The cost is that free dragging of a node
to an arbitrary point is not a thing the v1 does (§12, decision 2).

**A node is an object, not a label.** It has a kind — idea, task, note, link —
and a task-kind node points at a real row in `user_tasks`. That is the whole
answer to "maybe a bubble can have tasks and stuff": a bubble does not *contain*
a task, it *is* one, and everything the app already knows about tasks (status,
progress, due date, checklist, files) comes with it.

---

## 3. Constraints this codebase puts on the design

None of these is optional, and each one has already cost something once.

### 3.1 The initial bundle has 11.2 kB of headroom

`npm run verify:bundle` fails the build past 800 kB. A mind map editor —
layout, hit-testing, undo, gestures — is comfortably 40–80 kB on its own.

So: **the entire feature is lazy**, no exceptions, and no library is added.
jsMind, GoJS, react-flow, d3-hierarchy: all of them either exceed the whole
remaining budget or drag in a framework. A tidy-tree layout is ~150 lines
(§5) and it is testable in a way a third-party canvas is not.

The one thing that would break laziness is §3.2.

### 3.2 Anything registered in `sync-refreshers.providers.ts` is eager

Every locally-cached service is registered there so it can be **cleared when the
signed-in account changes** — sign out, sign in as someone else in the same tab,
and without a reset the previous person's data is still in memory. That is the
exact bleed `UserStorage` was written to prevent, so registration is not
optional either.

But that file is eager, so registering `MindMapService` there would pull the
whole feature into every user's first load.

**Proposed fix, and it pays for itself:**

```ts
// One tiny EAGER service. ~20 lines, no feature imports.
@Injectable({ providedIn: 'root' })
export class ResettableRegistry {
  private members = new Set<{ reload(): void }>();
  register(member: { reload(): void }): void { this.members.add(member); }
  resetAll(): void { for (const member of this.members) member.reload(); }
}
```

A lazily-created service calls `inject(ResettableRegistry).register(this)` in its
constructor. It is only ever constructed when its lazy page loads, so nothing is
pulled forward; if the user never opens a map, there is nothing to clear and
nothing was loaded. One refresher in `sync-refreshers.providers.ts` calls
`resetAll()`, importing only the registry.

Worth doing regardless of mind maps: `AttachmentsService`, `ChecklistService` and
`InspirationService` are all eager today purely for their reset, and moving them
onto this would hand back roughly **5–8 kB** of the headroom §3.1 is short of.

### 3.3 Baserow drops unknown columns silently

Established the hard way in `20260815-task-management-in-progress.md` §2.1. So:
schema files first, column lists in the mapper, and a `verify:fields` pairing per
table before a single row is written.

Also: creating a table or a `single_select` option needs a **user JWT**, which
the shipped token cannot do. Every table here therefore lands as id `0`, with the
service local-first and warning once — the pattern used by skills, attachments,
checklists and inspiration.

### 3.4 There is no sanitiser in this app, and that is a feature

No `innerHTML`, no `DomSanitizer`, no markdown renderer. So node text is **plain
text rendered as SVG `<text>`**. No bold-inside-a-node, no HTML labels, no
pasting rich content. A node's longer thoughts go in its note field, which
renders as plain text too.

### 3.5 A phone is not a small desktop

The app's `lg` breakpoint already switches navigation wholesale. A drag-to-
reparent, pinch-to-zoom canvas editor on a 390 px screen is a different product,
not a responsive stylesheet. Recommendation in §12, decision 3: **the map is
readable and collapsible on a phone; editing on a phone is the outline view.**

---

## 4. Data model

### 4.1 Two tables

**`database-schemas/34-mind-maps.json`** — the document.

| field | type | note |
|---|---|---|
| `title` | text, primary | |
| `user_id` | text, required | every read filters on it |
| `board` | text, required | `personal`, or a `user_projects` row id — the same string a task's `project_id` uses, and an inspiration board's `board` |
| `description` | long_text | |
| `theme` | text | colour set name; layout is not a per-map choice in v1 |
| `node_count` | number | denormalised so a list can show size without loading nodes |
| `archived` | boolean | |
| `created_at` / `updated_at` | date | Baserow-owned, read only |

**`database-schemas/35-mind-map-nodes.json`** — one row per node.

| field | type | note |
|---|---|---|
| `title` | text, primary | the node's text |
| `user_id` | text, required | |
| `map_id` | text, required | `mind_maps` row id |
| `parent_id` | text | empty for the root — the one node that has none |
| `side` | single_select `left`/`right`/`auto` | only meaningful for the root's children |
| `sort_order` | number | position among siblings |
| `collapsed` | boolean | |
| `kind` | single_select `idea`/`task`/`note`/`link` | §9 |
| `task_id` | text | `user_tasks` row id, when this node IS a task |
| `url` | url | for `link` nodes |
| `note` | long_text | the longer thought behind the short label |
| `colour` | text | hex, optional per-node override |
| `icon` | text | emoji |
| `created_at` | date | |

### 4.2 Rows per node, not one JSON blob — and why

| | rows per node | one JSON document |
|---|---|---|
| Concurrent edits | two devices editing different nodes both survive | last write wins, silently |
| Write size | one small row per edit | the whole map on every keystroke-batch |
| Creating a 40-node map | one `batchCreateRows` call | one write |
| Deleting a branch | N deletes (batchable) | one write |
| Reading a map | one filtered list call | one row |
| Fits the house pattern | yes — same reasoning as `task_checklist_items` | no |

**Recommendation: rows**, with (a) writes debounced ~600 ms per node while
typing, (b) `batchCreateRows`/`batchUpdateRows` for structural operations, and
(c) the local cache as the source of truth for the session, exactly as tasks work
today. The checklist table already carries this argument in its schema notes; a
map is the same problem with more nodes.

### 4.3 TypeScript

```ts
export type MindMapNodeKind = 'idea' | 'task' | 'note' | 'link';
export type NodeSide = 'left' | 'right' | 'auto';

export interface MindMapNode {
  id: string;
  mapId: string;
  parentId?: string;          // absent on the root
  text: string;
  kind: MindMapNodeKind;
  side: NodeSide;
  sortOrder: number;
  collapsed: boolean;
  taskId?: string;            // §9
  url?: string;
  note?: string;
  colour?: string;
  icon?: string;
}

export interface MindMap {
  id: string;
  board: string;              // 'personal' | user_projects row id
  title: string;
  description?: string;
  theme: string;
  nodeCount: number;
  archived: boolean;
  updatedAt: Date;
}
```

---

## 5. The layout engine — the actual hard part

`config/mind-map-layout.ts`, a **pure function**, which is what makes an editor
like this testable at all:

```ts
export function layoutMap(
  nodes: readonly MindMapNode[],
  measure: (node: MindMapNode) => { width: number; height: number },
  options?: LayoutOptions
): LaidOutMap;   // { boxes: PositionedNode[]; edges: Edge[]; bounds: Rect }
```

**Algorithm:** Reingold–Tilford tidy tree, run twice — once for the right-hand
subtrees, once mirrored for the left — then joined at the root. Two passes per
side: a first walk assigning preliminary positions and modifiers bottom-up, a
second walk resolving them top-down. Siblings never overlap, subtrees stay
compact, and the result is deterministic for the same input, which is what lets
it be snapshot-tested.

**Sizing text without thrashing the DOM.** Node width comes from measured text.
Measuring 400 nodes by inserting them into the DOM and reading `offsetWidth` is
400 forced reflows. Instead: one offscreen `CanvasRenderingContext2D`,
`measureText`, memoised by `text + fontSize`. Wrapping is fixed at a max width
(~180 px) with a word-break pass, so height is `lines × lineHeight + padding`.

**Balancing.** New top-level branches alternate sides, or go to whichever side
has less total height — the second is what EdrawMind does and looks better on an
uneven map. A node's `side` is stored once assigned so the map does not reshuffle
under the user.

**Connectors.** Cubic Bézier from the parent's edge to the child's edge, control
points offset horizontally by `distance × 0.5`. That is the EdrawMind curve. The
root's connector starts at the ellipse edge rather than its centre.

**Collapse.** A collapsed node's subtree is excluded from layout entirely and the
node shows a count badge. This is also the performance escape hatch for large
maps.

**Budget:** 1000 nodes laid out in under 16 ms, measured in a spec, so the
editor stays at 60 fps while typing.

---

## 6. Interaction

Keyboard-first, because that is how mind maps are actually written — the reason
EdrawMind puts Tab and Enter on the same keys everyone else does:

| key | action |
|---|---|
| `Tab` | new child of the selected node |
| `Enter` | new sibling below |
| `F2` / double-click / typing | edit the selected node's text |
| `Esc` | cancel edit, keep selection |
| `Delete` | delete node and its subtree (confirm when it has children) |
| arrows | move selection through the tree, geometrically |
| `Space` | collapse / expand |
| `⌘Z` / `⇧⌘Z` | undo / redo |
| `⌘+` / `⌘-` / `⌘0` | zoom in / out / fit |

Pointer: click to select, drag a node onto another to reparent (with a drop
indicator and a cycle check — dropping a node onto its own descendant is
refused, not repaired), drag empty canvas to pan, `⌘`/`ctrl` + wheel to zoom.
Touch: pinch to zoom, one finger to pan, tap to select, long press for the menu.

**Undo/redo** is a command stack of inverse operations, not snapshots of the
whole map: `{ do, undo }` pairs, with consecutive text edits on one node
coalesced so undo does not walk back one character at a time.

---

## 7. Views and export

- **Map** — the SVG editor.
- **Outline** — a nested list of the same tree. This is not a nice-to-have: it is
  the accessible surface (a real `role="tree"` with keyboard navigation, which an
  SVG canvas cannot honestly provide), the phone editing surface (§3.5), and the
  cheapest way to type a map quickly.
- **Export**: SVG (serialise the live `<svg>`), PNG (that SVG drawn into a canvas
  and `toBlob`), Markdown (`#` heading depth per level), and **send a branch to a
  project's tasks** (§9), which is the export that matters most here.

No Kanban view — the app already has a task board — and no Slides.

---

## 8. Where it lives

| route | page |
|---|---|
| `/maps` | list: personal maps and project maps, with node counts |
| `/maps/new` | create, then straight into the editor |
| `/maps/:id` | the editor |

Plus a **Mind maps** card on `/projects/:id`, listing that project's maps with a
"New map" button — the same sidebar the inspiration board sits in.

Navigation: a side-nav entry (🧠 Maps) and an entry in the mobile More sheet.

Deep links behave like tasks and projects do: fetch by row id when the cache is
cold, verify `user_id` before rendering (row ids in URLs are guessable), and show
a plain "this map no longer exists" rather than an empty canvas.

---

## 9. Tasks in a bubble

This is the part that makes it Habiti's mind map rather than a mind map that
happens to be installed here.

**A node can be linked to a task.** `kind: 'task'` plus `task_id`. The node then
renders with the task's status pill and progress bar (`taskProgress()` already
exists), its due date if it has one and is close, and a tick control that writes
through `TasksService` — so ticking on the map is the same act as ticking on
`/tasks`, with the same persistence.

Four operations:

1. **Convert node → task.** Creates a `user_tasks` row with
   `project_id` = the map's `board` when the map belongs to a project, and
   `standalone` when it does not. The node keeps its text; the task takes it as
   its title.
2. **Link node → existing task.** A picker over the user's tasks, for when the
   task already exists.
3. **Promote branch → tasks.** The interesting one: take a subtree and create a
   task per node, in order, preserving depth as either a checklist (children of a
   leaf become its checklist items) or as flat tasks tagged with the parent's
   text. This is how a planning session becomes a to-do list in one action.
4. **Unlink.** Node goes back to `idea`; the task is untouched. Deleting a *node*
   never deletes a task — the confirm dialog says so.

**The reverse link matters too:** a task that appears on a map shows "on the map
*Launch plan*" on `/tasks/:id`, so the connection is discoverable from both ends.

**"And stuff":** a node's note field covers the long thought; `kind: 'link'`
covers a reference; pictures on a node are deliberately deferred (§12, decision
6) — an inspiration board is already the place for those, and a map full of
images is a layout problem of its own.

---

## 10. Phases

### Phase 0 — Foundations (no UI)

- [x] `ResettableRegistry` (§3.2) + one refresher, and move Attachments,
      Checklist and Inspiration onto it to reclaim eager bytes
- [x] Schema files 34 and 35; ids registered as 0 in `environment.ts`
- [x] `models/mind-map.models.ts` with column lists + row mapping
- [x] Two `verify:fields` pairings
- [x] `config/mind-map-layout.ts` — tidy tree, pure, with the text measurer
      injected so specs do not need a canvas
- [x] Layout specs: sibling non-overlap, subtree compaction, collapse, mirroring,
      determinism, and the 1000-node timing budget

**Done when:** `layoutMap()` produces stable, non-overlapping geometry for a
fixture map, in under 16 ms at 1000 nodes, with no Angular involved.

### Phase 1 — Read a map

- [x] `MindMapService`: load maps for a board, load one map's nodes, local-first
- [x] `/maps` list and `/maps/:id` editor shell (lazy, cold-cache fetch, 404 state)
- [x] SVG renderer: nodes, curved connectors, root styling, theme colours
- [x] Pan, zoom, fit-to-screen, collapse/expand
- [x] Outline view of the same tree

**Done when:** a map seeded in local storage renders, collapses and pans, and the
outline shows the same tree.

### Phase 2 — Edit a map

- [x] Tab/Enter/F2/Delete/arrows and inline text editing
- [x] Undo/redo stack with coalesced typing
- [x] Drag to reparent, with cycle refusal and a drop indicator
- [x] Debounced persistence, diffed against what the server last confirmed
- [ ] `batchCreateRows` for structural changes — creates go one at a time, in
      parent-before-child order, because a child needs its parent's real row id
- [x] Create (from /maps and from a project), rename, delete
- [ ] Archive — the column exists, no UI uses it yet
- [x] Editing from the outline view (phones)

**Done when:** a map can be built from an empty canvas with hands on the
keyboard, survives a reload, and every action can be undone.

### Phase 3 — Tasks in nodes

- [x] Node kinds and their rendering (status pill, progress, due date)
- [x] Convert, link, unlink; picker over existing tasks
- [x] Promote branch → tasks, with the checklist/flat choice
- [x] Tick-through to `TasksService`
- [x] Backlink on `/tasks/:id`

### Phase 4 — Projects and export

- [x] Mind maps card on the project dashboard
- [x] Create a map inside a project; move a map between boards
- [x] SVG and Markdown export
- [ ] PNG export — needs the SVG drawn into a canvas; not built
- [ ] Print stylesheet

### Phase 5 — Polish

- [ ] Themes and per-node colour/icon
- [ ] Search and highlight within a map
- [ ] Performance pass: viewport culling beyond ~500 visible nodes
- [ ] Cross-links drawn over the tree (the "relates to" line)

---

## 11. Testing

The layout is a pure function of data, so most of the risk is testable without a
browser fixture:

- **Layout** — no two sibling boxes overlap; a collapsed subtree contributes
  nothing; mirroring is exact; the same input twice gives identical output; 1000
  nodes inside the frame budget.
- **Tree operations** — reparent refuses cycles; deleting a node deletes exactly
  its subtree; sibling reordering is stable; side assignment balances.
- **Undo** — every command's inverse restores the previous state, checked by
  round-tripping a randomised sequence of operations.
- **Mapping** — `verify:fields` plus the "every written key is a real column"
  spec that `task-row.models.spec.ts` established.
- **Task linkage** — converting a node creates a task on the right project;
  deleting a node never deletes its task.
- **Routing** — cold-cache deep link; another account's map id renders "no longer
  exists", never someone else's map.

---

## 12. Open decisions

1. **Rows vs one JSON document per map.** *Recommend rows* (§4.2). The blob is
   simpler until two devices touch one map, and this repo has already been bitten
   by exactly that class of bug.
2. **Free positioning.** *Recommend auto-layout only in v1.* Dragging a node
   anywhere means storing x/y, which means the layout can no longer tidy the map,
   which is most of the value. A "detach this node" escape hatch can come later.
3. **Editing on a phone.** *Recommend outline-only below `lg`*, with the map
   read-only (pan, zoom, collapse). Honest, and a tenth of the work of a real
   touch editor.
4. **Realtime.** *Recommend none.* Maps are single-user; a `maps` refresh scope
   for one's own other tabs is enough, and the relay does not need to know about
   it (the same call inspiration boards made).
5. **Rich text in nodes.** *No* — see §3.4. Plain text plus a note field.
6. **Images on nodes.** *Defer.* Attachments and inspiration boards both already
   hold pictures, and image nodes change the layout problem.
7. **A size check for lazy chunks.** `check-bundle.mjs` only guards the initial
   bundle. *Recommend* adding `--max-chunk-kb` so the editor cannot quietly grow
   to 300 kB for the people who do open it.

---

## 13. Not in scope

AI-generated maps, real-time collaboration, presentation/Slides mode, Gantt,
an infinite freeform whiteboard, hand-drawn styles, and importing `.emmx` or
`.xmind` files. Each is a feature in its own right; none is needed for "an idea
map that can hold my tasks".

---

## 14. What was built, 2026-08-15

Phases 0–4. The editor works, maps belong to a board, and a node can be a task.

### The bundle answer

The whole editor is **one 36.8 kB lazy chunk (10.6 kB gzipped)**, loaded only by
`/maps` and `/maps/:id`. The initial bundle grew **1.2 kB** — the registry and
two route entries.

Better than that: moving attachments, checklists and inspiration onto
`ResettableRegistry` gave back **14.2 kB**, so headroom went from 11.2 kB before
this work to **24.2 kB after it**, with a mind map editor added.

| | initial total | headroom |
|---|---|---|
| before | 788.8 kB | 11.2 kB |
| after the registry change | 774.6 kB | 25.4 kB |
| after the mind map feature | 775.8 kB | 24.2 kB |

### The layout

`config/mind-map-layout.ts` is a pure function: nodes and a text measurer in,
geometry out. 22 specs cover it, including the two that matter — no two boxes
overlap on a deep lopsided tree, and 1000 nodes lay out inside a 16 ms frame
(measured, not assumed). Text is measured through one offscreen 2D context,
memoised by string, so nothing touches the DOM before the first paint.

The renderer was checked by running the real `exportSvg()` over a realistic map
and looking at the result, rather than by eye in the browser.

### What a bubble can be

`idea | task | note | link`. A task node carries a real `user_tasks` row: it
shows a status stripe and a progress bar, ticking it writes through
`TasksService`, and **"Turn this branch into tasks"** creates one task per topic
in the subtree, in order, into the map's project. `/tasks/:id` shows which maps
a task appears on, so the link works from both ends.

Deleting a node never deletes its task, and the confirm dialog says so.

### Undo

Every mutation goes through one funnel that snapshots the map's nodes first, so
undo is a restore rather than thirty hand-written inverse operations. Saving
diffs against what the server last confirmed, which is why undo needs no special
handling: the diff simply notices.

### Before it syncs

Two more tables need a user JWT:

```bash
node scripts/create-baserow-table.mjs 34-mind-maps.json --apply
node scripts/create-baserow-table.mjs 35-mind-map-nodes.json --apply
```

Until then maps work fully but live in local storage, warning once — the same
pattern as skills, attachments, checklists and inspiration. That is now **five**
features waiting on the same credential.

### Verified

`npm run verify`: lint, typecheck, **811 unit tests** (up from 767), build,
bundle budget, assets, legal hashes, seven table mappings.

### The right-click menu (added same day)

`components/context-menu/context-menu.component.ts` — generic: it takes items
and a point and emits an id, so the map is not the only thing that can ever have
one. What it offers depends on what was clicked; a menu that shows the same
twelve greyed-out items wherever you click teaches people to ignore it.

**On a node:** add child / add sibling / rename · cut / copy / paste / delete
branch · collapse, move up, move down · make it a task (or open it, tick it,
unlink it) · turn this branch into tasks · colour ▸ · export branch as ▸
Markdown or SVG.

**On empty canvas:** add branch, paste, fit to screen, export map as ▸.

Cut/copy/paste move a BRANCH, not text — there is no text selection on a map —
and they are on ⌘X/⌘C/⌘V as well as in the menu. The clipboard is the app's own,
not the system one: putting a subtree on the system clipboard means serialising
it and parsing back whatever the user last copied, which is a lot of failure
modes for a within-app move. Pasting clones with fresh ids, so pasting twice
gives two independent branches, and the paste is undoable like everything else.

Four things the menu gets right that are easy to leave out: it FLIPS near a
viewport edge (a menu opened bottom-right otherwise puts Delete off-screen); it
is fully KEYBOARD operable (arrows, Enter, Escape, Right/Left for submenus —
and the Menu key on Windows and Linux opens exactly this); focus goes in on open
and back on close; and it closes on scroll and resize, because a menu pinned to
a point stops pointing at anything once the page moves. `preventDefault` is
scoped to the canvas — the browser's own menu is the right one everywhere else.
On touch, a 500 ms long press opens it, cancelled if the finger starts panning.

Submenus render inline and indented rather than as flyouts: a flyout has to
solve hover intent, its own edge flipping, and touch, and this menu is two
levels deep at most.

The editor chunk went from 36.8 kB to **48.3 kB** (13.3 kB gzipped) — still lazy,
initial bundle unchanged at 24.1 kB of headroom.

### Still open

- Phase 5 in full: themes, per-node icons, search, viewport culling, cross-links.
- PNG export, archive UI, `batchCreateRows` for structural saves.
- Touch editing below `lg` is still outline-only, as decision 3 recommended.
- No specs yet for the canvas component's pan/zoom maths — the layout it draws
  is covered, the camera is not.
