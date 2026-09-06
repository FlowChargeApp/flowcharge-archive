---
id: PLN-7-3mo1nv
type: plan
workstream: WS-7-c5ispw
slug: live-board-refresh
title: "Client polling of the existing data route, on a board made safe to re-render"
status: done
created: 2026-08-06
updated: 2026-08-06
depends_on: []
links: []
---

# Client polling of the existing data route, on a board made safe to re-render

## Summary

The board keeps itself in sync by **polling `GET /api/projects/<id>/data` from `app.ts` every
5 seconds**, comparing the raw response text to the last one it received, and re-running the
render only when the bytes differ. No new route, no server-side state, no new dependency, no
`engines` change — `server.ts`, `lib/extract.ts` and `lib/projects.ts` are not touched at all.

That is only possible after one prerequisite that both candidate mechanisms needed anyway:
`app.ts` cannot currently be rendered twice. `renderKpis`, `renderAttention` and `renderSeverity`
append without clearing, and `renderSeverity` is the sharp one — its segment widths are
percentages of the open-issue total, so a second pass makes the bar's segments sum to 200% and
overflow, not merely duplicate. The three `addEventListener` calls sit inside `boot()` and would
re-bind on every re-render, each new closure pinning a stale `workstreams` array for as long as
the tab stays open. Phase 1 fixes both with the same move: hoist `sortKey`, `sortDir`, `query`
and the data arrays out of the re-run path, clear before appending, bind the listeners once.
`renderBoard` already clears first (`app.ts:288`) and is left alone.

The hoist does double duty. Because `query`/`sortKey`/`sortDir` now live outside the re-render,
a poll that lands while the user is mid-search or mid-sort preserves their selection instead of
silently resetting it — the state-preservation problem and the idempotency problem have one
answer.

**Why polling and not a server-side watcher over SSE.** The decisive fact is that polling needs
**zero server-side code**. The route it polls already exists, is already stateless, and is
already correct; the entire feature lives in one client file. The watcher buys sub-100ms latency
in exchange for: a new `/api/projects/<id>/events` route, a `Map<projectId, {watcher, clients,
timer}>` with start-on-first-client and `watcher.close()`-on-last-disconnect lifecycle,
mandatory debouncing (a measured **1256 watch events in 1248ms** for one bulk file operation on
this repo's own `flowcharge/`), `EventSource` reconnect handling, extract-once-fan-out-to-N-clients
discipline, and a platform caveat — `fs.watch({recursive:true})` throws
`ERR_FEATURE_UNAVAILABLE_ON_PLATFORM` on Linux below Node 20.13, against a declared
`engines: node >=18` (`package.json:8`). Every one of those is a permanent maintenance surface
on a 127.0.0.1-bound, single-user, zero-runtime-dependency tool. The thing being bought is that
a hand-edited markdown file appears on the board in 80ms rather than up to 5s, in a workflow
where the user has just alt-tabbed away from an editor. That is not worth a lifecycle-managed
registry of OS file watchers. Full comparison in Design.

## Scope

### Acceptance criteria

1. With a board open at `/board.html?project=<id>`, editing a workstream's frontmatter in that
   project's `flowcharge/` (for example changing `title` or `status`) causes the board to show the
   change within ~5 seconds, with no page reload and no user action.
2. Adding a whole new workstream folder, and deleting an existing one, are both reflected within
   the same window — columns, counts, KPI figures and both lower panels all update together.
3. When nothing in the project has changed, a poll causes **no DOM mutation at all** — the board
   does not flicker, redraw, or re-sort on the interval.
4. After any number of automatic refreshes, the "Open issues by severity" bar's segments still
   sum to 100% of its width, and the KPI strip still contains exactly four cards.
5. After any number of automatic refreshes, "Needs attention" shows each stale artefact once,
   not once per refresh.
6. A refresh that lands while the user has text in the search box preserves the query, the
   filtered result set, and the `N / M workstreams shown` count — recomputed against the new
   data, not reset to unfiltered.
7. A refresh preserves the active sort key and sort direction, including the `active` class on
   the two segmented controls.
8. A refresh does not steal focus from the search input or move its caret.
9. The board's horizontal scroll position survives a refresh.
10. Two tabs open on the same project both update independently and correctly; a tab open on a
    different project is unaffected by changes to the first.
11. A tab left in the background for several minutes and then brought to the foreground shows
    current data within about a second of becoming visible, without waiting for the next
    interval tick.
12. If the server is stopped, or the project's `flowcharge/` is removed, the board **keeps showing
    its last good render** and displays a visible "not updating" state; it does not blank, does
    not throw an uncaught error, and does not replace the board with the load-state panel.
13. When the server comes back, the board resumes updating on its own and the "not updating"
    state clears — no reload required.
14. Polling never has more than one request in flight per tab: a tick that arrives while a poll
    is outstanding is skipped, not queued.
15. `GET /api/projects/<id>/data`'s request and response contracts are byte-for-byte unchanged,
    and `src/server.ts`, `src/lib/extract.ts` and `src/lib/projects.ts` have no diff.
16. Zero runtime dependencies and exactly two devDependencies, unchanged. `engines.node` is
    unchanged at `>=18`.
17. `dist/public/app.js` is still a classic script — no `import`, `export`, or module wrapper.
18. The board's initial load behaviour is unchanged: the loading panel, the no-`project`-param
    panel, the unknown-id panel and the missing-`flowcharge/` panel all still appear exactly as
    they do today for a *first* load.

### Out of scope

- **Any server-side change.** No new route, no watcher, no `fs.watch`, no SSE, no WebSocket, no
  server-held client registry, no caching or mtime short-circuit on the data route.
- **Any new dependency.** No `ws`, no polling/reconnect library, no framework.
- **Changes to what is extracted or how.** `extractPraxisData`'s logic is untouched; this plan
  only changes how often the client asks for its output.
- **Changing the `PraxisData` shape**, including adding a real timestamp to `generated`. See
  Open Question 2 — it is tempting and it is a payload change, so it stays out.
- **Live refresh of the home page's project tiles** (`index.html` / `home.ts`). The card scopes
  this to "an open board". See Open Question 5.
- **A "what changed" diff, highlight, or animation** on the refreshed board; no "last edited by".
- **Conflict resolution.** This is a read-only dashboard; there is nothing to resolve.
- **A user-facing setting for the poll interval**, or any config file. One named constant.
- **Anything belonging to WS-5 (card detail modal) or WS-6 (git branch display).** Neither
  feature's files exist yet and this plan does not reference them. A forward-compatibility note
  for both is in Design; it is a note, not work.
- **A test framework, linter, or formatter.** None exists, none is added.

### Assumptions

Settled without the user present. Each is a judgement call, not a requirement in the card.

1. **No deployment or release constraints apply.** A `localhost:4173`, `"private": true`,
   single-user developer tool: no production data, no live users, no migration, nothing that
   must stay shippable mid-feature. Phases are ordinary commits on a branch and rollback is
   `git revert`. This is the question I would have asked — recorded as Open Question 6.
2. **5 seconds is the right default interval.** Chosen against the measured extraction cost of
   **26.7ms for the largest currently-registered project** (455 files, 278KB payload) on a
   synchronous, single-threaded server. Open Question 1.
3. **Full raw-body comparison is the change detector.** `generated` is
   `new Date().toISOString().slice(0,10)` (`extract.ts:127`) — a *date*, byte-identical across
   every poll on the same day including polls that straddle a real edit, so it cannot be used.
   Comparing the raw response text before `JSON.parse` is the cheapest honest alternative.
4. **A false positive from body comparison is a wasted re-render, not a bug.** Two known
   sources: `generated` flips at midnight (one spurious re-render per tab per day), and
   `fs.readdirSync` ordering is assumed stable for an unchanged directory but is not guaranteed
   by contract. After Phase 1 a re-render is idempotent and visually identical, so the cost of
   either is a few milliseconds of DOM work. This is why the detector is allowed to be
   imperfect.
5. **The board's horizontal scroll position is worth preserving** (~2 lines). A refresh that
   yanks a scrolled board back to column one is a defect introduced *by this feature*, not a
   pre-existing one. Open Question 3.
6. **The user must be able to tell "nothing has changed" from "nothing is updating".** This
   feature makes those two states look identical, so it owes a small indicator. Kept to one
   line of text in the masthead. Open Question 4.
7. **Polling retries forever rather than giving up after N failures.** A local dev server is
   restarted often; a board that permanently gave up after a restart would be worse than one
   that quietly reconnects.
8. **Browser throttling of hidden tabs is a feature, not a problem to defeat.** No Web Worker,
   no `Worker`-hosted timer, no audio-context keepalive. A `visibilitychange` listener that
   fires one immediate poll on becoming visible is the whole answer.

## Design

### Approaches weighed and rejected

**Client polling of the existing data route — CHOSEN.** Every open board tab re-requests
`GET /api/projects/<id>/data` on an interval and re-renders only when the bytes differ. The
route already exists (`server.ts:131-154`), is already stateless, already extracts fresh on every
call, and already returns exactly the payload `boot()` consumes. The server needs no code change
whatsoever, which means the feature has no server-side lifecycle to get wrong: no watcher to
close, no client set to prune, no per-project map to key correctly, nothing that leaks when a
tab is closed by killing the browser rather than navigating away. Multi-project and multi-tab
scoping is free and structural — each tab polls its own `?project=` id and knows nothing about
any other tab. The entire diff is `src/public/app.ts`, plus one span in `board.html`, one CSS
rule, and one corrected sentence in the footer.

**Server-side recursive watcher pushing over SSE — rejected.** It is the better *mechanism* in
isolation: sub-100ms latency, near-zero idle cost, one extraction per real change no matter how
many tabs are watching. It is rejected on total cost against this codebase's stated character,
on five separate counts, any two of which would be enough:

- *Platform support.* `fs.watch({recursive: true})` works on macOS and Windows but on Linux only
  from Node 20.13+, throwing `ERR_FEATURE_UNAVAILABLE_ON_PLATFORM` below that. `package.json:8`
  declares `engines: node >=18`. Using it as-is narrows supported Node — the same category of
  compatibility decision WS-1's plan explicitly declined when it rejected native type-stripping.
  Avoiding the bump means hand-rolling walk-and-watch-every-subdirectory with
  re-watch-on-newly-created-directory, which is materially more than the "~60-70 server lines"
  the optimistic estimate assumes.
- *Debouncing is mandatory, and measured.* One bulk file operation on this repo's own `flowcharge/`
  produced **1256 watch events in 1248ms**. Naive per-event push means ~1250 SSE messages and
  ~1250 re-extractions for one logical change. A 200-300ms trailing debounce is load-bearing
  infrastructure, not a refinement — and it puts a floor under the latency advantage that was
  the whole justification.
- *Real server-side state with a real teardown obligation.* `Map<projectId, {watcher, clients:
  Set<res>, timer}>`, watchers started on first SSE connect and closed on last disconnect via
  `res.on('close')`, plus extract-once-fan-out-to-N discipline so three tabs on one project do
  not trigger three redundant extractions. Get the teardown wrong and every project a user ever
  opened keeps a recursive OS watcher alive for the life of the process. `server.ts` holds no
  cross-request state at all today; this would be the first.
- *Watch scope is a trap.* It must be `path.join(entry.path, 'flowcharge')` and never the project
  root — a project root is typically a whole git repo, and watching it fires constantly on
  `node_modules`, `.git` and build output. Even correctly scoped, `flowcharge/index.md`,
  `kanban.md` and `ids.md` sit directly under `flowcharge/` and are *not* read by the
  extractor (only `workstreams/**` and `archive/**` are, `extract.ts:121-124`), so editing them
  still fires a no-op push unless the watch is narrowed further or the client absorbs it — which
  is exactly the body comparison polling gets for free.
- *Client cost is not zero either.* `EventSource` reconnect behaviour, the "server restarted,
  did I miss an event while disconnected?" resync, and a `close()` on unload. Polling's failure
  mode is "the next tick works"; SSE's failure mode needs code.

**WebSocket instead of SSE — rejected before the above even applies.** Node exposes a global
`WebSocket` *client* only; there is no built-in `WebSocketServer` or upgrade handling. It would
mean adding the `ws` dependency to a repo with zero runtime dependencies, or hand-rolling
RFC 6455 framing. And the traffic here is strictly server→client, which is precisely SSE's
shape. If a push mechanism were ever chosen, SSE is the right one — this is recorded so the
question does not get re-litigated later.

**A hybrid — poll a cheap server-side `mtime` digest, extract only on change — rejected as
premature.** It would cut the per-poll cost from a 26.7ms extraction to a directory stat walk.
But it is a new route, new server code, and a second definition of "has this project changed"
that must be kept in agreement with what the extractor actually reads. It is the correct answer
*if* the measured cost ever becomes a real problem; it is speculative machinery today. Recorded
here as the named escalation path rather than built.

### What changes

```
src/public/app.ts        the feature: applyData(), the poll loop, visibility handling, status
src/public/board.html    += one <span id="live-status"> in the masthead meta; footer sentence corrected
src/public/styles.css    += one rule for #live-status
```

Nothing else in the repo has a diff. In particular `src/server.ts`, `src/lib/extract.ts`,
`src/lib/projects.ts`, `src/types/praxis-data.d.ts`, `package.json`, `tsconfig.json` and
`tools/copy-assets.mjs` are all untouched, and no build step changes.

### Contracts

**HTTP.** Unchanged, in both directions. The client polls the existing route with the existing
options — `fetch(url, { cache: 'no-store' })`, the same call `app.ts:40` already makes — and
consumes the existing `PraxisData` shape. No new field is sent or requested. No header is added.
The route cannot tell a poll from a first load, which is the point: there is nothing on the
server that could be got wrong.

**`app.ts`'s internal shape** is the real contract this plan defines, because Phase 1 changes
what is safe to call twice. After Phase 1 the IIFE is organised as:

```ts
// module (IIFE) scope — survives every re-render
var sortKey = 'id';
var sortDir = 'asc';
var query = '';
var workstreams: PraxisWorkstream[] = [];
var issues: PraxisIssue[] = [];
var lastBody: string | null = null;   // raw response text of the last applied payload
var polling = false;                  // a request is in flight

function applyData(raw: PraxisData): void   // idempotent: safe to call N times, any order
function renderBoard(): void                // reads workstreams/query/sortKey/sortDir from above
```

`applyData` replaces today's `boot`. Its contract, and the invariant every later change to this
file must respect:

> **`applyData` is idempotent.** Calling it twice with the same payload leaves the DOM in the
> same state as calling it once. Every renderer it invokes clears its own container before
> appending. It binds no event listeners.

The three listener registrations (`app.ts:328`, `:335`, `:342`) move *out* of `applyData` to
IIFE scope and run exactly once, before the first fetch. They already only mutate the hoisted
state and call `renderBoard()`, so they need no other change — but they must be attached before
any data arrives, since a click on a sort button with `workstreams` still empty must render an
empty board rather than throw.

**Containers each renderer owns and must clear** — the complete list, so a later renderer knows
where it belongs:

| Renderer | Clears |
|---|---|
| `renderKpis` | `#kpi-strip` |
| `renderAttention` | `#attn-list` (`#attn-count` is a `textContent` assignment, already idempotent) |
| `renderSeverity` | `#sev-bar` and `#sev-legend` (`#sev-total` likewise already idempotent) |
| `renderBoard` | `#board` — **already correct at `app.ts:288`, do not touch** |

The clear is `host.innerHTML = ''`, matching the pattern already established at `home.ts:19`.
`home.ts`'s comment there — "Clears its container before appending: this runs again after every
successful add" — is the precedent; the board is simply joining it.

### The poll loop

```
every POLL_MS, and once immediately on visibilitychange→visible:
  if a request is already in flight, skip this tick
  fetch(/api/projects/<id>/data, {cache:'no-store'})
    ok      → text = await r.text()
              if text === lastBody: mark live, done — no parse, no DOM work
              else: lastBody = text; save board.scrollLeft;
                    applyData(JSON.parse(text)); restore board.scrollLeft; mark live
    not ok  → mark not-updating; keep lastBody and the current DOM
    throw   → mark not-updating; keep lastBody and the current DOM
  finally → clear the in-flight flag
```

Four things this shape gets right, each deliberate:

- **The unchanged case costs one string comparison.** No `JSON.parse` of 278KB, no DOM work, no
  flicker. Acceptance criterion 3 is true by construction.
- **A failed poll never destroys a working board.** This is the sharpest difference from the
  initial load, which *does* replace the board with `showLoadState` on failure (`app.ts:51-53`).
  That is right for a first load with nothing to show and wrong for a refresh with a perfectly
  good render on screen. The two paths therefore have different error handling on purpose, and
  the code should say so in a comment.
- **The in-flight guard prevents stacking.** At 26.7ms against a 5000ms interval this cannot
  happen today, but the guard costs two lines and removes a whole failure mode from a
  synchronous single-threaded server.
- **Scroll restore brackets `applyData`, not `renderBoard`.** `renderBoard` clears `#board`,
  which resets `scrollLeft` to 0; saving and restoring around the whole apply is one place
  rather than one per renderer.

`POLL_MS = 5000` as a named constant at the top of the IIFE, next to `STATUS_ORDER`.

The loop starts only on the success path of the initial fetch, inside the existing `.then(...)`
chain at `app.ts:50`. A board that never loaded — no `project` param, unknown id, missing
`flowcharge/` — never starts polling, so acceptance criterion 18 is preserved and the three
guidance panels are not overwritten a moment later by a poll's error state.

### Cost, honestly

Measured extraction cost on the synchronous, single-threaded server:

| Project | Files | Payload | Extraction |
|---|---|---|---|
| This repo's own `flowcharge/` | 24 | 4.6KB | 1.25ms |
| Largest registered (LAD) | 455 | 278KB | 26.7ms |

At `POLL_MS = 5000`, one tab on the largest project costs **26.7ms every 5s — about 0.5% of one
core**, and 278KB over loopback. Three tabs on that project: ~1.6%. The server blocks for the
duration of each extraction, so a concurrent request can be delayed by up to ~27ms; on a
127.0.0.1 single-user dashboard that is unobservable.

The honest worst case worth naming: ten tabs on the largest project is ~5% of a core and a 27ms
block roughly every 500ms. Still fine, and well past any plausible usage. If it ever stops being
fine the escalation is the mtime-digest route described under rejected approaches — not a
shorter interval, and not a watcher.

### Forward compatibility (a note, not work)

This plan establishes one invariant that any later board feature inherits:

> **Anything rendered from `PraxisData` must be rendered by a function `applyData` calls, and
> that function must clear its own container before appending.**

A renderer added later that follows it refreshes automatically and needs no polling code of its
own; one that does not follow it will duplicate its output on every refresh. That invariant is
worth a comment above `applyData` in the source, because it is the thing a future change is most
likely to break silently.

Two specific forward-looking observations, recorded because they are cheap to record now and
expensive to discover later. Neither is implemented, and neither references a file that exists:

- Any field a future workstream adds to `PraxisData` refreshes for free — the mechanism re-reads
  and re-applies the *whole* payload, so it has no per-field knowledge to keep in sync.
- A future feature that opens a modal or detail panel bound to a specific card will find that
  card's DOM node destroyed by the next refresh's `board.innerHTML = ''`. Whoever builds that
  feature owns deciding what happens — re-bind, or suppress refresh while open. Flagging it, not
  solving it.

### Non-functional

- **Security.** No new attack surface: no new route, no new input, no new parsing. The polled
  route is the same 127.0.0.1-bound endpoint the board already calls on load; this changes only
  how often.
- **Observability.** Server logging is unchanged. Client-side, the `#live-status` line *is* the
  observability, and it is the only reason the user can distinguish "this project is quiet" from
  "this board died twenty minutes ago". Two states, one line of text in the masthead meta block
  next to the existing `#gen-date` and `#meta-counts`.
- **Performance.** Analysed above with real numbers rather than asserted.

## Staged task breakdown

Three phases, each leaving the app working and each demonstrable on its own.

### Phase 1 — Make `app.ts` safe to render more than once (small)

The prerequisite both mechanisms needed. Behaviour-preserving: after this phase the board looks
and behaves exactly as it does today, because `applyData` is still called exactly once.

- Hoist `sortKey`, `sortDir`, `query` (currently `app.ts:216-218`) and `workstreams`, `issues`
  (currently `app.ts:57-58`) to IIFE scope.
- Rename `boot` to `applyData` and reduce it to: assign the hoisted arrays from `raw`, update the
  masthead fields, then call the four renderers. The three `addEventListener` calls and the
  `renderBoard()` at `app.ts:347` move out of it.
- Add `host.innerHTML = ''` at the top of `renderKpis` (`#kpi-strip`), `renderAttention`
  (`#attn-list`), and `renderSeverity` (both `#sev-bar` and `#sev-legend`). Leave `renderBoard`
  alone — `app.ts:288` already does this correctly.
- Move the three listener registrations to IIFE scope, running once before the initial fetch.
- Add the idempotency-invariant comment above `applyData`.

Files: `src/public/app.ts`.
Depends on: nothing.
Verify: `npm start`, open a board. It renders identically to before — four KPI cards, six
columns, both lower panels. Both sort toggles, both direction toggles and the search box all
still work, including clicking a sort button *before* data arrives (empty board, no error in the
console). `dist/public/app.js` still has no `import`/`export`.

### Phase 2 — Poll and re-apply (medium)

The feature itself.

- Add `POLL_MS = 5000`, `lastBody`, and the in-flight flag at IIFE scope.
- Set `lastBody` from the initial load, then start `setInterval` from the initial fetch's success
  path only.
- Implement the tick exactly as specified under "The poll loop": in-flight guard, `r.text()`,
  string comparison, parse-and-apply only on difference, `board.scrollLeft` saved and restored
  around `applyData`, errors swallowed with the current DOM left intact and a comment explaining
  why this differs from the initial load's `showLoadState` path.

Files: `src/public/app.ts`.
Depends on: Phase 1 (an unfixed `applyData` breaks the severity bar on the first refresh).
Verify, end to end:
1. Open a board. Edit a workstream's `title` in that project's `flowcharge/`. Within ~5s the card's
   title changes with no reload, and the "Data generated" line and counts stay coherent.
2. Watch the DevTools Elements panel through several ticks with nothing changing: no mutations.
3. Force ten refreshes by touching a file repeatedly. The severity bar's segments still fill
   exactly the bar (not 200%+), the KPI strip still has four cards, and "Needs attention" lists
   each item once.
4. Type a search query and change the sort, then trigger a change. The query, the filtered set,
   the result count and the active toggle classes all survive.
5. Scroll the board horizontally, trigger a change: scroll position holds.
6. Two tabs on the same project both update; a third tab on a different project does not.

### Phase 3 — Visibility handling and the not-updating state (small)

- `document.addEventListener('visibilitychange', …)` → when `document.visibilityState` becomes
  `'visible'`, run one immediate tick. No attempt to defeat the browser's hidden-tab throttling.
- Add `<span id="live-status">` to the masthead `.meta` block in `board.html`, after
  `#meta-counts`. Two states only: live (with the time of the last successful poll) and not
  updating. Set from the poll's success and failure paths.
- One CSS rule for `#live-status` in `styles.css`, following the existing `.masthead .meta`
  treatment (mono, 11.5px, `--ink-faint`) with a distinct colour for the not-updating state.
- Correct the footer sentence in `board.html:69-70`, which currently states the board reads the
  project's state "on every page load — so a reload always shows the project's current state".
  That sentence is made false by this feature and is the one piece of prose the change strictly
  obliges.

Files: `src/public/app.ts`, `src/public/board.html`, `src/public/styles.css`.
Depends on: Phase 2.
Verify:
1. Background the tab for 2+ minutes, then foreground it. The board is current within about a
   second, and the status line's timestamp is fresh.
2. Stop the server. Within ~5s the status flips to not-updating; the board still shows its last
   render in full, with no console exception and no load-state panel.
3. Restart the server. The status returns to live on its own and updates resume, with no reload.
4. Rename the project's `flowcharge/` folder away (the 410 path). Same behaviour as 2 — last good
   render retained, status flipped. Rename it back: recovery.

## Data & compatibility

- **No data migration.** Nothing is persisted by this feature — no new file, no registry field,
  no `localStorage`.
- **No API change.** `GET /api/projects/<id>/data` keeps its exact request and response
  contract. The board simply calls it more often. Any other client of that route (there is
  none today) is unaffected.
- **No payload shape change.** `PraxisData` is untouched, so `src/types/praxis-data.d.ts` has no
  diff and the `npm run refresh` CLI's output is unchanged. This deliberately matches how WS-6's
  plan treated `PraxisData` — additive or nothing.
- **No `engines` or dependency change**, which was one of the deciding factors against the
  watcher. Node 18 remains supported.
- **Backward compatibility with an older cached `app.js`** is not a concern: the build emits
  both the HTML and the script together and the server sets no cache headers.
- **Rollback.** Reverting Phases 3 and 2 removes the feature entirely and leaves Phase 1's
  refactor in place — which is behaviour-preserving on its own and harmless to keep. There is no
  point past which this is irreversible, because there is no state to unwind. A softer rollback
  short of reverting anything: raise `POLL_MS`, or return early from the tick.

## Testing strategy

No test framework exists in this repo and this plan does not add one, so Phase verification is
the manual sequences above. This section is a pointer for a later `write-tests` pass, if a
framework ever lands:

- **`applyData` idempotency is the single highest-value unit test in this file** — build a fixed
  `PraxisData` fixture, apply it twice against a JSDOM copy of `board.html`, and assert the DOM
  is identical to applying it once. That one test pins acceptance criteria 4 and 5, which are the
  criteria most likely to regress silently when a future renderer is added without a clear.
- **State preservation across apply** — set `query`/`sortKey`/`sortDir`, apply new data, assert
  they and the rendered result count survive (criteria 6, 7).
- **The change detector** — assert that two identical response bodies produce no call to
  `applyData`, and that bodies differing by one character produce exactly one (criterion 3, 14).
- **The poll loop's error path** — mock a rejected fetch and a non-ok response, assert the DOM is
  untouched and the status flipped (criterion 12), then a subsequent success restores it
  (criterion 13).
- Integration-level, the existing route needs no new coverage: it is unchanged, and the polling
  client exercises exactly the path a page load already exercised.

## Open questions

1. **Poll interval — 5 seconds?** Options: 2s (crisper, ~2.5x the cost, 67ms/5s on the largest
   project), 5s, 10s (half the cost, noticeably laggy when you are actively editing).
   *Recommendation: 5s.* It keeps the largest measured project at ~0.5% of a core per tab while
   staying inside the window where an edit feels like it "just appeared". Trivially changed
   later — it is one constant.

2. **Should `generated` become a real timestamp?** It would make the "Data generated" line in the
   masthead genuinely informative once the board is live-updating, where today it shows a date
   that never changes mid-session. But it is a change to the `PraxisData` contract, it affects
   the `npm run refresh` CLI's output, and the change detector does not need it.
   *Recommendation: no — leave it, and let `#live-status` carry the freshness information
   instead.* Raising it because "the timestamp is right there and it's a date" is exactly the
   kind of thing that gets absorbed silently otherwise.

3. **Preserve the board's horizontal scroll position across a refresh?** ~2 lines.
   *Recommendation: yes.* A board wide enough to scroll snapping back to column one every time
   someone saves a file would be the most-noticed thing about this feature. But it is a UX
   decision the card did not ask for, so it is yours to drop.

4. **How visible should the not-updating state be?** Options: (a) one line of text in the
   masthead meta, the plan's assumption; (b) that plus a colour change or dot, more noticeable;
   (c) nothing at all, silent failure.
   *Recommendation: (a).* (c) is genuinely bad — this feature *creates* the ambiguity between "no
   changes" and "not connected", so it owes the user a way to tell them apart. (b) is easy to add
   later if (a) proves too quiet.

5. **Should the home page's project tiles also live-refresh?** They would need it if a project is
   added from a second tab, which is a much rarer event than a `flowcharge/` edit. The card says "an
   open board", so this plan does not do it.
   *Recommendation: no.* If you want it later it is the same ~15 lines against
   `GET /api/projects`, and `home.ts:18` already clears before rendering, so it needs no
   prerequisite work at all.

6. **Deployment and release constraints — confirming there are none.** Assumed: no production
   data, no live users, no requirement to stay shippable mid-feature, no flag, rollback is
   `git revert`. Asked every run because the answer varies per project.
   *Recommendation: confirm the assumption; if any of it is wrong, Phase 2 is the phase that
   changes, since Phases 1 and 3 are individually inert.*
