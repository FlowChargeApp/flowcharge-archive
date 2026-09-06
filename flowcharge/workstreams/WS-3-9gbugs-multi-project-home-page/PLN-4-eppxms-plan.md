---
id: PLN-4-eppxms
type: plan
workstream: WS-3-9gbugs
slug: multi-project-home-page
title: "Project-tile home page backed by a local registry and on-demand extraction"
status: done
created: 2026-08-05
updated: 2026-08-06
depends_on: []
links: []
---

# Project-tile home page backed by a local registry and on-demand extraction

## Summary

Today the dashboard is single-project because of exactly two hardcoded facts: `app.ts:21`
fetches `./data.json`, and `server.ts` is a pure static file server with no route table. Both
are one-line facts, but the machinery needed to replace them does not exist yet — the server
has never read a request body or dispatched on `req.method`, and the extractor cannot be
imported at all (`extract-praxis-data.ts` calls `main()` at module scope and `process.exit()`
on its error paths, so importing it would run an extraction and then kill the server process).

The plan makes three structural moves, in this order:

1. **Split the extractor into a pure library and a thin CLI.** `src/lib/extract.ts` exports
   `extractPraxisData(root): PraxisData` and `hasPrxwork(root): boolean`, with no `process.argv`,
   no `process.exit`, no `console`, and no module-level mutable state.
   `src/scripts/extract-praxis-data.ts` keeps `parseArgs`/`usage`/`main()` and becomes a
   ~40-line wrapper. `npm run refresh -- --root <dir>` behaves identically, proven by a
   byte-parity diff.
2. **Add three `/api/` routes to `server.ts`**, before the existing static fallthrough, in
   Node's `http` with zero new dependencies. Registered projects persist in a gitignored
   `.praxis-projects.json` at the repo root. The board's data comes from
   `GET /api/projects/<id>/data`, which runs the extractor **on demand** — so there are no
   per-project JSON files to manage, no staleness, and no clash with `copy-assets.mjs`.
3. **Split the page in two.** `src/public/index.html` becomes the home page (project tiles plus
   an add-project form, driven by a new `home.ts`); the current board markup moves verbatim to
   `src/public/board.html`, reached at `/board.html?project=<id>`. Navigation is plain anchors —
   `<a href="/board.html?project=…">` out, `<a href="/">` back — so the browser back button,
   deep links, bookmarks, and cmd-click all work with no router and no view-switching code.

The last point is the one that protects WS-1's verified board. Because each page load boots
once, `app.ts`'s append-only renderers (`renderKpis`, `renderAttention`, `renderSeverity` never
clear before appending) and its inside-`boot()` `addEventListener` calls remain *correct as
written*. No idempotency surgery, no listener rebinding, no regression risk on 333 lines that
WS-1 proved by emit-parity diff. The board file changes in exactly two places: where it gets
its URL, and a back link.

The casualty is the committed `src/public/data.json` seed. Under on-demand extraction nothing
fetches it, so it has no project to belong to. The "works out of the box" promise survives with
a better mechanism: this repo's own `flowcharge/` is pre-registered on first run, so a fresh clone
shows one tile that opens a **live** board of the dashboard's own workstreams instead of a
frozen 281KB snapshot of a different project. This reverses WS-1 acceptance criterion 9 and
WS-2 acceptance criterion 10 deliberately, not silently — see Open Question 1.

## Scope

### Acceptance criteria

1. `npm start` serves a home page at `http://localhost:4173/` showing one tile per registered
   project. Each tile shows the project's display name, its absolute path, and the date it was
   added.
2. With no projects registered, the home page shows an empty state naming what to do, not a
   blank grid and not an error.
3. The home page has a text input and a button. Entering an absolute path whose directory
   contains a `flowcharge/` folder and submitting adds a tile for it without a page reload, and
   the tile is still there after a reload and after a server restart.
4. Submitting a path that is not absolute is rejected with a visible message and nothing is
   registered.
5. Submitting an absolute path with no `flowcharge/` under it is rejected with a visible message
   naming that as the reason, and nothing is registered.
6. Submitting a path that is already registered does not create a duplicate tile.
7. Clicking a tile opens the board for that project. The board is visually and behaviourally
   identical to today's: masthead, four KPI cards with coloured bars and chips, all six status
   columns with cards, both lower panels, both sort toggles, both direction toggles, the search
   box and its result count. The masthead tagline names that project.
8. The board's data reflects the project's `flowcharge/` **at the moment the page was loaded** —
   editing a workstream's frontmatter and reloading the board shows the change, with no
   `npm run refresh` in between.
9. The board has a back control that returns to the home page grid.
10. The browser's own back button also returns to the home page grid, and forward returns to
    the board. `/board.html?project=<id>` can be bookmarked and reopened directly.
11. Opening `/board.html` with no `project` parameter, or with an unknown id, shows a guidance
    panel with a link home — not a blank page and not an uncaught error.
12. Opening a board whose project directory has since lost its `flowcharge/` folder shows a
    guidance panel naming that as the reason. The server does not crash.
13. `npm run refresh -- --root <dir>` still works from the command line with unchanged
    `--root`, `--out`, `--help` semantics and unchanged exit codes (0 on success or `--help`,
    1 on missing/invalid `--root`), and with no `--out` still writes `dist/public/data.json`.
14. The JSON that `npm run refresh` writes is **byte-identical** to what the pre-refactor
    extractor writes for the same `--root`.
15. Calling `extractPraxisData(root)` twice in one process returns two payloads with identical
    `issues` arrays — no accumulation across calls.
16. Exactly two devDependencies (`typescript`, `@types/node`) and zero runtime dependencies,
    unchanged from WS-1.
17. `dist/public/app.js` and `dist/public/home.js` are both classic scripts — no `import`,
    `export`, or module wrapper.
18. The registry file is gitignored and `git status` is clean after adding a project.
19. A fresh clone followed by `npm install && npm start` shows a home page with one working
    tile, whose board renders populated.
20. Static file serving is unchanged for every non-`/api/` path: the MIME table, the traversal
    guard's semantics, the 404 body, and the `PORT` override all behave as they do today.

### Out of scope

- **Any UI framework, bundler, or runtime dependency.** Three routes do not justify Express and
  its ~50 transitive packages against a repo whose zero-runtime-dependency character every
  prior workstream defended (README "Notes"; `typescript-source-conversion/plan.md`
  lines 171–178).
- **Authentication or access control.** Local single-user tool.
- **Removing or deprecating the `npm run refresh` CLI.** It keeps working exactly as it does
  today; it simply stops being the board's feed.
- **Path sanitising beyond `path.isAbsolute` plus the `flowcharge/`-existence check** the extractor
  already performs.
- **Cloud sync, multi-user, or any storage of the project list outside this machine.**
- **Editing, reordering, or removing a registered project from the UI.** The card asks for "a
  button to add a project" only. See Open Question 4.
- **Per-project summary figures on the tiles** (workstream counts, progress bars). Rendering
  those means extracting every project on every home page load. See Open Question 7.
- **Caching or invalidating extraction results.** On-demand extraction is fast enough for one
  user; a cache is speculative machinery with an invalidation problem attached.
- **Any change to the board's rendering logic, sort/filter behaviour, DOM structure, or the
  `PraxisData` payload shape.** WS-1 verified all of it; this plan does not reopen it.
- **A test framework, linter, or formatter.** None exists, none is added.

### Assumptions

Settled without the user present. Each is a judgement call, not a requirement in the card.

1. **No deployment or release constraints apply.** A `localhost:4173`, `"private": true`,
   single-user developer tool with no production deployment, no live users, and no data to
   migrate. So: no feature flag, no dark launch, no staged rollout. Phases are ordinary commits
   on a branch; rollback is `git revert`. This is the question I would have asked — recorded as
   Open Question 5.
2. **"Entered by its absolute path" is a requirement, not a description.** The server rejects
   non-absolute paths even though `path.resolve` would accept them, because a relative path
   would silently resolve against the *server's* working directory (the dashboard repo) rather
   than anything the user meant. Enforcing it is POLA, not new hardening.
3. **A leading `~` is not expanded.** It is rejected with a message that says so explicitly, so
   the user is not left guessing why `~/Work/foo` failed. Expanding it is behaviour the card
   did not ask for — Open Question 3.
4. **On-demand extraction is fast enough.** One user, one extraction per board page load. The
   largest known payload (the LAD snapshot at `src/public/data.json`) is 281KB from a few
   hundred markdown files read synchronously — tens to low hundreds of milliseconds. No cache
   is planned.
5. **The project list is small.** Tens of entries, not thousands. A flat JSON array read and
   rewritten whole on each add is the right shape.
6. **Two browser tabs will not add projects simultaneously.** The registry write is a
   read-modify-write with no locking; a genuine simultaneous add would lose one entry. Single
   local user, so this is accepted rather than solved.
7. **The dashboard repo pre-registers itself** so a fresh clone has something to show. Its own
   `flowcharge/` is real, non-empty data.

## Design

### Approaches weighed and rejected

**The extractor: refactor to a library — CHOSEN.** `src/lib/extract.ts` gets the parsing
functions and exports `extractPraxisData(root)`; the CLI keeps `argv`, `exit`, and file
writing. The split is worth more than an entry-point guard on the existing file
(`if (process.argv[1] === fileURLToPath(import.meta.url)) main()`), because it makes
"importing this cannot run a CLI" *structural* rather than dependent on a subtle equality check
that symlinks and npm bin shims can break. It also forces the fix to the module-level
`let issuesAccumulator` (line 139), which `walkWorkstreams` writes to as a side channel: in the
library it becomes a parameter threaded through the walk, so repeated in-process extraction
cannot concatenate stale issues. The whole move is ~15 lines of cut-and-paste plus one signature
change, and it produces the first genuinely unit-testable function in this repo.

**The extractor: shell out via `child_process` — rejected.** Its only merit is not touching the
extractor. Everything else is worse: a process spawn per board load, the server needing to
compute the path to its own sibling `dist/scripts/extract-praxis-data.js`, errors arriving as
exit codes and stderr text rather than exceptions, a temp file or stdout parsing to get the
payload back, and a `JSON.parse` boundary with no type safety where `extractPraxisData(root)`
returns a typed `PraxisData` directly. It also leaves the module-level accumulator in place —
harmless across processes, but the fragility stays in the code. Paying real complexity to avoid
a 15-line refactor is the wrong trade.

**Data delivery: extract on demand from an API route — CHOSEN.** `GET /api/projects/<id>/data`
calls `extractPraxisData(entry.path)` and writes the payload straight to the response. No files,
no `--out` juggling, no per-project filenames, no interaction with `copy-assets.mjs`, no
gitignore question, and the board is always current — acceptance criterion 8 becomes true for
free, where today it requires a manual `npm run refresh`.

**Data delivery: per-project static JSON files (`dist/public/data/<id>.json`) — rejected.**
It keeps `app.ts` fetching a static file, which is the smaller client diff, but it buys a file
lifecycle: when is each file written, what triggers a rewrite, what happens when it is stale,
what happens when `rm -rf dist` deletes them all (which the README documents as the clean
procedure), and what `npm run refresh`'s single hardcoded `dist/public/data.json` destination
means in a world of N files. On-demand extraction deletes every one of those questions.

**Navigation: two documents plus plain anchors — CHOSEN.** `/` is the home page, and
`/board.html?project=<id>` is the board. The browser back button works because this is real
history, not simulated history. Deep-linking, bookmarking, cmd-click and middle-click all work
because the tiles are `<a>` elements, not click-handled `<div>`s. Most importantly: each page
boots once, so `app.ts`'s append-only renderers and its inside-`boot()` listener binding stay
correct without modification. The static server already serves any file under `dist/public/`, so
this needs zero server work.

**Navigation: sibling `<div>`s with a JS `display` toggle — rejected.** The browser back button
does nothing useful, which is a real defect in a feature whose whole point is a back affordance
— users will reach for it reflexively. It also requires fixing render idempotency (three
renderers that append without clearing) and listener double-binding (three `addEventListener`
calls inside `boot()`) before home→project→home→project can work, which means surgery on the
exact 333 lines WS-1 verified by emit-parity diff. The `style="display:none"` on `#lower`
(`index.html:54`, unhidden by `app.ts:51`) is a one-off "hide until data arrives" line, not a
view-switching convention to extend.

**Navigation: hash or History-API client-side routing — rejected.** It fixes the back button
too, but at the cost of a router, `hashchange` handling, initial-route resolution, *and* the
same idempotency and listener surgery, to arrive at a URL that is strictly less useful than a
real one. Two documents get the same benefits for less code.

**HTTP: Node's `http` — CHOSEN over Express**, on this codebase's stated character rather than
on principle. Three routes, one body reader, one regex for the id — roughly 40 lines. Express
would add ~50 transitive packages to a repo that has two devDependencies and zero runtime
dependencies, to serve three routes. WS-1 rejected Vite on exactly this reasoning.

### Target layout

```
Praxis-Dashboard/
├── .gitignore                      += .praxis-projects.json
├── .praxis-projects.json           machine-local registry (gitignored, created on first add)
├── tsconfig.json                   include += "src/lib/**/*.ts"
├── tools/copy-assets.mjs           copies index.html, board.html, styles.css; seeding removed
└── src/
    ├── server.ts                   /api/ routes, then the unchanged static fallthrough
    ├── lib/
    │   ├── extract.ts              NEW — pure extraction, exported
    │   └── projects.ts             NEW — registry read/write
    ├── scripts/
    │   └── extract-praxis-data.ts  thin CLI wrapper (argv, exit, file write)
    ├── types/
    │   └── praxis-data.d.ts        += ProjectEntry, ProjectList
    └── public/
        ├── index.html              HOME — tiles + add form (replaces the board markup)
        ├── board.html              NEW — the board markup, moved verbatim
        ├── home.ts                 NEW — home page script
        ├── app.ts                  board script; reads ?project=, fetches the API
        ├── styles.css              += tile grid, add-form, back-link styles
        └── tsconfig.json           include += "home.ts"
```

`src/public/data.json` is deleted in Phase 4 (Open Question 1).

### Contracts

**Ambient types** go in the existing `src/types/praxis-data.d.ts`, which is exactly the
mechanism WS-1 built for sharing shapes between the Node and browser compilations without
imports. The file must keep having no top-level `import` or `export` — adding one turns it into
a module and every interface stops being global.

```ts
interface ProjectEntry {
  id: string;     // 8 lowercase hex chars: sha1 of `path`, truncated
  name: string;   // path.basename(path) — display only, never an identifier
  path: string;   // absolute, path.resolve'd
  added: string;  // YYYY-MM-DD
}

interface ProjectList {
  projects: ProjectEntry[];
}
```

`ProjectList` is deliberately both the on-disk registry shape and the `GET /api/projects`
response body — they are the same thing, so they get one type.

The id is a hash of the absolute path rather than a counter or a slug: it is deterministic (so
re-adding the same path is idempotent and a bookmarked board URL survives the registry being
recreated), collision-free in practice, and URL-safe. The alternative — putting the
URL-encoded absolute path in the URL — is transparent but writes a home directory path into
every board URL, which is both ugly and needless.

**HTTP API.** All three routes are handled by a branch on `reqPath.startsWith('/api/')` placed
*before* the static logic in `server.ts`, so it never reaches the traversal guard. Every
response is `application/json; charset=utf-8`.

```
GET /api/projects
  200  { "projects": ProjectEntry[] }
       A missing or unreadable registry file yields { "projects": [] }, never an error.

POST /api/projects        request body: application/json, max 8192 bytes
  request   { "path": "/Users/x/Work/LAD" }
  201       { "project": ProjectEntry }   newly registered
  200       { "project": ProjectEntry }   already registered (same absolute path)
  400       { "error": "…" }              unparseable body, missing/non-string `path`,
                                          path not absolute, or no flowcharge/ under it
  413       { "error": "Request body too large" }
  500       { "error": "…" }              registry could not be written

GET /api/projects/<id>/data
  200       PraxisData                    freshly extracted, identical shape to today's data.json
  404       { "error": "Unknown project …" }
  410       { "error": "… no longer contains a flowcharge/ folder" }
  500       { "error": "Extraction failed" }   details go to console.error server-side

any other /api/… path      404  { "error": "Not found" }
wrong method on the above  405  { "error": "Method not allowed" }
```

The client renders the `error` string verbatim in both the 404 and 410 cases; the distinct
status codes exist because they are accurate, not because the client branches on them.

**`src/lib/extract.ts`** — knows the `flowcharge/` markdown convention and the `PraxisData` shape.
Must NOT know about `process.argv`, `process.exit`, `console`, HTTP, or where the payload ends
up.

```ts
export function hasPrxwork(root: string): boolean;          // fs.existsSync(resolve(root)/flowcharge)
export function extractPraxisData(root: string): PraxisData; // throws on unreadable tree
```

`walkWorkstreams` becomes `walkWorkstreams(base: string, archived: boolean, issues: PraxisIssue[])`
— the accumulator is a parameter, and the module-level `let issuesAccumulator` is deleted.
`extractPraxisData` creates a fresh array per call, which is what makes acceptance criterion 15
true by construction rather than by remembering to reset.

`extractPraxisData` **throws** where the old `main()` called `process.exit(1)`. Callers decide:
the CLI catches and exits 1 with the same message on stderr; the server catches and returns 500.
The `hasPrxwork` guard stays a separate predicate so both callers use one definition of "is a
valid project" (the CLI's `console.error("No flowcharge/ found under …")` path and the POST route's
400 are the same check).

**`src/lib/projects.ts`** — knows the registry file and its shape. Must NOT know about HTTP,
request/response objects, the extractor, or `PraxisData`.

```ts
export function projectId(absPath: string): string;
export function readProjects(): ProjectEntry[];
export function findProject(id: string): ProjectEntry | undefined;
export function addProject(absPath: string): { entry: ProjectEntry; created: boolean };
```

The registry lives at `path.join(__dirname, '..', '.praxis-projects.json')` — from
`dist/lib/projects.js` that is the repo root, matching the `__dirname`-relative,
cwd-independent convention already used at `server.ts:7`, `extract-praxis-data.ts:13`, and
`copy-assets.mjs:8`. It is a single hidden file rather than a directory because one file is all
that is needed, and rather than a visible `projects.json` because WS-2 spent a workstream
clearing loose files out of the repo root. It cannot live in `dist/`: `dist/` is gitignored and
`README.md` documents `rm -rf dist` as the clean procedure, so a registry there would be
silently disposable. It cannot be seeded by `copy-assets.mjs` either — a user's registered
projects are machine-local, not a committable fixture.

**`src/public/home.ts`** — knows the two `/api/projects` routes and its own DOM. Must NOT know
about `PraxisData`, the board's rendering, or the filesystem. **Its renderer clears its
container before appending**, deliberately unlike the board's three append-only renderers,
because it re-renders after every successful add.

**`src/public/app.ts`** — unchanged except for its data source and a back link. It knows
`PraxisData`, the DOM, and now one URL parameter. It gains no knowledge of the registry: it
never sees a filesystem path, only an opaque id it read from its own URL.

### Reading a request body

`server.ts` has never done this. The whole addition:

```
collect chunks → if the running total exceeds 8192 bytes, respond 413 and destroy the request
               → otherwise JSON.parse in a try/catch, 400 on failure
```

8KB is the "what happens at 10,000× the expected size" answer for an endpoint whose only input
is a filesystem path. It is the only unbounded input this feature introduces.

### Error containment

An uncaught throw inside an `http.createServer` handler takes the process down. Every API
branch therefore sits inside a `try/catch` that responds 500 and `console.error`s the reason.
This matters most for `extractPraxisData`, which parses arbitrary markdown from a directory the
server does not control — a permissions error or a malformed tree must produce a 500 and a log
line, not a dead dashboard. The server currently logs nothing per request and this plan does not
change that; the error log is the one new piece of observability, and it is the difference
between a diagnosable failure and a mystery.

### The `data.json` question

Under on-demand extraction, nothing fetches `data.json` any more. Three consequences, all
stated rather than absorbed:

- **`copy-assets.mjs`'s seeding branch must go** (lines 24–31). It would otherwise copy a 281KB
  file into `dist/public/` that no page requests. This is strictly required by the change, not
  a tidy-up.
- **`src/public/data.json` itself is deleted**, and the "works out of the box" promise is kept
  by a different mechanism: `readProjects()` returns a pre-registered entry for the dashboard
  repo's own root when the registry file is absent, so a fresh clone shows one tile whose board
  renders live from this repo's own `flowcharge/`. That is a *better* out-of-box experience — a
  live board of a real project rather than a frozen snapshot of an unrelated one — but it does
  reverse WS-1 acceptance criterion 9 and WS-2 acceptance criterion 10, so it is Open Question 1
  and it lands in the last reversible phase.
- **`npm run refresh` becomes a standalone JSON dump**, no longer the board's feed. The card
  requires it to keep working and it does, byte-for-byte. But its default output
  `dist/public/data.json` is now a file nothing reads, which is a POLA wart. The honest fix is
  documentation (Phase 5): the README and `usage()` present it as "dump a project's Praxis state
  to JSON", which is literally all it ever did.

### Two browser files in one compilation

`src/public/tsconfig.json` has `"module": "none"` and will now include both `app.ts` and
`home.ts`. Under `module: none` these compile as one global program, so **`home.ts` must wrap
its entire body in an IIFE**, exactly as `app.ts` does (`app.ts:1`, `:334`). If it declares
anything at top level that `app.ts` also declares, `tsc` reports a duplicate identifier. Both
files emit as separate classic scripts to `dist/public/`, loaded by their own page's
`<script>` tag. `rootDir: ".."` already places output correctly.

## Staged task breakdown

Five phases, strictly ordered. Every phase ends with `npm start` serving a working application.
Phases 1 and 2 carry all the structural risk and neither changes the UI; Phases 3 and 4 are the
feature; Phase 5 is text.

### Phase 1 — Split the extractor into a library and a CLI (small)

**Before starting:** run the current extractor against a known root with
`--out /tmp/before.json` and keep the file. It cannot be regenerated after this phase.

**Build:**

1. Create `src/lib/extract.ts`. Move `parseFrontmatter`, `fmStr`, `countChecks`, and
   `walkWorkstreams` into it verbatim, plus the `flowcharge` existence check as `hasPrxwork`.
2. Change `walkWorkstreams`'s signature to take the issues array as a third parameter; delete
   the module-level `let issuesAccumulator`.
3. Export `extractPraxisData(root)`: resolves `root`, throws `new Error("No flowcharge/ found
   under " + root)` if `hasPrxwork` is false, creates a fresh issues array, runs both walks
   (workstreams then archive), returns the `PraxisData` object. It performs no file I/O beyond
   reading, and calls neither `console` nor `process.exit`.
4. Reduce `src/scripts/extract-praxis-data.ts` to `parseArgs`, `usage`, and `main()`: it imports
   from `../lib/extract.js`, keeps its `--help`/missing-`--root` exit codes, catches the throw
   and prints the same stderr message before `process.exit(1)`, and keeps `path.resolve(args.out)`,
   the `mkdirSync`, the `writeFileSync`, and the success log line unchanged. Its default `--out`
   expression is untouched.
5. Add `"src/lib/**/*.ts"` to the root `tsconfig.json` `include` array.

**Files touched:** `src/lib/extract.ts` (new), `src/scripts/extract-praxis-data.ts`,
`tsconfig.json`.

**Depends on:** nothing.

**Verify:**

1. **Byte parity, the decisive check.** `npm run refresh -- --root <same dir> --out /tmp/after.json`
   then `diff /tmp/before.json /tmp/after.json` is empty. Delete both.
2. `npm run refresh -- --help` exits 0 and prints usage; with no `--root` exits 1; with a
   `--root` that has no `flowcharge/` prints the same message as before and exits 1.
3. `npm run refresh -- --root <dir>` with no `--out` still writes `dist/public/data.json`, and
   the printed path is unchanged.
4. **Repeat-call check** (acceptance criterion 15): a throwaway one-liner that imports
   `dist/lib/extract.js` and calls `extractPraxisData(root)` twice prints two equal
   `issues.length` values. Delete it.
5. `grep -n "process\.\|console\." src/lib/extract.ts` returns nothing.
6. `npm start` still serves the board unchanged — this phase touched nothing it reads.

### Phase 2 — Registry and API routes, dark-launched (medium)

**Build:**

1. Add `ProjectEntry` and `ProjectList` to `src/types/praxis-data.d.ts`; confirm the file still
   has no top-level `import` or `export`.
2. Create `src/lib/projects.ts` with the four exported functions from Design. `addProject`
   resolves the path, computes the id, returns the existing entry with `created: false` if the
   id is already registered, otherwise appends and writes the whole file back.
3. Add `.praxis-projects.json` to `.gitignore`.
4. In `server.ts`: add the body reader, then an `if (reqPath.startsWith('/api/'))` branch above
   the existing static logic implementing the three routes exactly as specified in Design, each
   wrapped in `try/catch` → 500 + `console.error`. Everything below the branch — the traversal
   guard, `fs.readFile`, the MIME table, the 404 — is untouched.

**Files touched:** `src/types/praxis-data.d.ts`, `src/lib/projects.ts` (new), `server.ts`,
`.gitignore`.

**Depends on:** Phase 1.

**Verify** — with `npm start` running, by `curl`:

1. `GET /api/projects` on a machine with no registry file → `200 {"projects":[]}`.
2. `POST /api/projects` with `{"path":"<this repo's absolute path>"}` → `201`, and
   `.praxis-projects.json` now exists containing that entry with an 8-hex id.
3. The same POST again → `200`, same id, still one entry in the file.
4. `POST` with `{"path":"./relative"}` → `400`, message names the absolute-path requirement.
5. `POST` with `{"path":"~/anything"}` → `400`, message says `~` is not expanded.
6. `POST` with an absolute path that has no `flowcharge/` → `400`, message names that reason.
7. `POST` with a malformed body → `400`. `POST` with a 20KB body → `413`.
8. `GET /api/projects/<id>/data` → `200` with a payload whose `source` is the project root, and
   whose `workstreams.length` and `issues.length` match a `npm run refresh -- --root <same>`
   run against the same directory.
9. `GET /api/projects/deadbeef/data` → `404`. `PUT /api/projects` → `405`. `GET /api/nope` → `404`.
10. Rename the project's `flowcharge/` folder aside, re-request its data → `410` and the server is
    still running. Rename it back.
11. Regression: `/`, `/styles.css`, `/app.js`, `/data.json` all still 200 with correct
    `Content-Type`; `/../package.json` still 403; the board still renders. `PORT=5000 npm start`
    still works.
12. `git status` is clean.

### Phase 3 — Home page at `/`, board moved to `/board.html` (medium)

The board still fetches `./data.json` at the end of this phase. Navigation is the deliverable.

**Build:**

1. `git mv src/public/index.html src/public/board.html`. Its markup is otherwise untouched.
2. Add a back control to `board.html`'s masthead: `<a class="back-link" href="/">← Projects</a>`.
   A plain anchor, so middle-click, cmd-click and the context menu all behave.
3. Create `src/public/index.html`: the same `<head>` and masthead brand as the board, a heading,
   a `<div id="project-tiles">`, an add-project form (`<input id="project-path">`, a submit
   button, and a `<div id="add-error">` for messages), a footer note, and
   `<script src="home.js"></script>`.
4. Create `src/public/home.ts`, whole body inside an IIFE. On load it fetches `/api/projects`
   and renders one `<a class="tile" href="/board.html?project=<id>">` per entry, showing name,
   path and added date; an empty state when the list is empty. Submitting the form POSTs to
   `/api/projects`, and on success re-fetches the list and re-renders — **the render function
   clears `#project-tiles` before appending.** On a non-2xx response it shows the response's
   `error` string in `#add-error` and leaves the input's value alone.
5. Client-side, reject a non-absolute path before sending, with the same message the server
   uses. The server remains the authority; this is only for instant feedback.
6. Add the tile grid, add-form, and back-link rules to `styles.css`, reusing the existing
   custom properties (`--paper-raised`, `--line`, `--radius`, `--shadow`, `--font-mono`) so both
   colour schemes work with no new palette. Static styling goes in `styles.css`, not inline —
   WS-4's rule.
7. `src/public/tsconfig.json`: add `"home.ts"` to `include`.
8. `tools/copy-assets.mjs`: add `board.html` to the copy list.

**Files touched:** `src/public/index.html` → `board.html` (moved, plus the back link),
`src/public/index.html` (new), `src/public/home.ts` (new), `src/public/styles.css`,
`src/public/tsconfig.json`, `tools/copy-assets.mjs`.

**Depends on:** Phase 2.

**Verify:**

1. `npm start`, open `/`: the home page lists the project registered in Phase 2 as a tile with
   its name, path and date. Console clean.
2. Delete the registry file, reload: the empty state appears, not an error.
3. Add a valid path through the form: a tile appears without a page reload. Add it again: still
   one tile, no duplicate. Reload: the tile is still there.
4. Add a relative path, then `~/something`, then an absolute path with no `flowcharge/`: each shows
   its message in `#add-error` and adds no tile.
5. Click a tile: `/board.html?project=<id>` opens and renders the full board (from `data.json`
   for now). The back link returns to `/`. The **browser back button** also returns to `/`, and
   forward returns to the board.
6. `grep -E '^\s*(import|export)' dist/public/home.js` returns nothing; `tsc` reported no
   duplicate identifiers across `app.ts` and `home.ts`.
7. Both colour schemes: toggle the OS appearance and confirm tiles and form are legible in each.
8. Keyboard: tab to a tile and press Enter — it navigates, because it is an anchor.

### Phase 4 — The board renders its own project (medium)

**Build:**

1. `app.ts`: read `project` from `location.search`; if absent, render the guidance panel with a
   link home and do not fetch. Otherwise fetch `/api/projects/<id>/data` instead of
   `./data.json`. The rest of the file — `boot` and the four renderers — is not touched.
2. Rewrite the existing catch-branch panel text: it currently says "Couldn't load data.json"
   and prints the `npm run refresh` command. It now renders the API's `error` message when
   there is one, plus a link back to the project list. Same `.load-state` markup and styling.
3. `board.html`: the initial loading panel's "Loading data.json…" text, and the footer note
   describing `dist/public/data.json`, both re-point at the API and the project's own `flowcharge/`.
4. `tools/copy-assets.mjs`: delete the `data.json` seeding branch (lines 24–31) and its comment.
5. Delete `src/public/data.json`.
6. `src/lib/projects.ts`: when the registry file is absent, `readProjects()` returns a single
   pre-registered entry for the dashboard repo's own root (`path.join(__dirname, '..')`), so a
   fresh clone has a working tile. Adding a project writes the file and that default no longer
   applies.

**Files touched:** `src/public/app.ts`, `src/public/board.html`, `tools/copy-assets.mjs`,
`src/public/data.json` (deleted), `src/lib/projects.ts`.

**Depends on:** Phase 3.

**Verify:**

1. Click a tile: the board renders that project's data. The masthead tagline names it (it
   already derives from `raw.source`, so this needs no code — confirm it is right).
2. **Behavioural pass against a capture taken before Phase 3**: all four KPI cards with the same
   values and bar segments, all six columns with the same card counts, both sort toggles, both
   direction toggles, the search box filtering and the result count updating, the severity
   legend, the attention panel. Console clean.
3. Register a second project and confirm its board shows different data, and that going
   home and into the first one again shows the first project's data.
4. Live data: edit a workstream's `status` in a registered project's `flowcharge/`, reload the
   board, confirm the card moved column — with no `npm run refresh`.
5. `/board.html` with no parameter, and with `?project=deadbeef`: guidance panel with a link
   home, in both cases. No uncaught error.
6. Rename a registered project's `flowcharge/` aside and open its board: the 410 message is shown
   and the server survives. Rename it back.
7. Fresh-clone simulation: `rm -rf dist node_modules .praxis-projects.json && npm install &&
   npm start` → home page with one tile for this repo, whose board renders populated
   (acceptance criterion 19).
8. `npm run refresh -- --root <dir>` still succeeds and still writes `dist/public/data.json`;
   `npm run build` no longer logs anything about seeding `data.json`.
9. `git status` clean; `git ls-files src/public` no longer lists `data.json`.

### Phase 5 — Documentation (small)

**Build:**

1. `README.md`: the quick start becomes `npm install` → `npm start` → add a project in the UI
   (`npm run refresh` is no longer a step). Rewrite the paragraph about the committed snapshot
   to describe the pre-registered self-entry instead. Update the directory tree for `src/lib/`,
   `board.html`, `home.ts`, and the removed `data.json`. Add `.praxis-projects.json` with a line
   saying it is machine-local and gitignored. In the Scripts table, describe `npm run refresh`
   as a standalone JSON dump that no longer feeds the board. Add a line to Notes recording that
   the API reads any registered project's directory, and whatever Open Question 2 decides about
   the listen address.
2. `src/scripts/extract-praxis-data.ts`: the header comment currently says the script writes the
   file "for the dashboard to fetch" — no longer true. Correct it and the `usage()` text.
3. `src/public/board.html` footer: confirm Phase 4's edit reads correctly on the rendered page.

**Files touched:** `README.md`, `src/scripts/extract-praxis-data.ts`, `src/public/board.html`.

**Depends on:** Phase 4.

**Verify:** every path named in the README exists after `npm run build`; the three quick-start
commands run as written from a fresh clone; `npm run refresh -- --help` prints a command that
runs verbatim; `grep -rn "data\.json" README.md src/ tools/` returns only the extractor's own
default-output references.

## Data & compatibility

- **Migrations:** none. `.praxis-projects.json` is created on the first successful add; before
  that its absence is a valid state meaning "the built-in self-entry only".
- **Breaking — `/` no longer shows a board.** Anyone with `http://localhost:4173/` bookmarked
  lands on the project list. This is the feature.
- **Breaking — `dist/public/data.json` no longer feeds the board.** A user who scripted
  `npm run refresh` and expected the page to change must register the project instead. The
  extractor's own behaviour is unchanged; only the consumer went away. README, Phase 5.
- **Breaking — `src/public/data.json` is deleted**, reversing WS-1 acceptance criterion 9 and
  WS-2 acceptance criterion 10. The promise those criteria protected is kept by the
  pre-registered self-entry. Open Question 1.
- **Not breaking:** the `PraxisData` payload shape, the board's DOM and rendering, `--root` /
  `--out` / `--help`, the exit codes, the MIME table, the traversal guard, the `PORT` override,
  `engines.node >= 18`, and the two-devDependency count.
- **Forward compatibility:** the registry is a flat JSON object with a `projects` array and no
  version field. A future key can be added without breaking a reader that ignores it, and an
  unreadable file degrades to the empty list rather than to an error — so a corrupted registry
  costs the user their list, never their ability to start the app.
- **Rollback:** `git revert` the phase commits and delete `.praxis-projects.json`; nothing else
  persists. Every phase boundary is a coherent working state — after Phase 1 nothing user-facing
  changed at all, after Phase 2 the API exists but no page calls it, after Phase 3 navigation
  works against the old data source. The single irreversible-by-`git revert` act is deleting
  `src/public/data.json` in Phase 4, and it is recoverable from history.

## Testing strategy

No test framework exists and none is added; the evidence for each phase is mechanical or a
one-command run.

- **The byte-parity diff is the extractor refactor's regression test** (Phase 1 verify 1), and
  it is the strongest evidence available — the same technique WS-1 used to prove its conversion.
  It covers every regex, every frontmatter read and the whole accumulator in one comparison.
  `/tmp/before.json` must be captured before Phase 1 starts.
- **`curl` is the API's integration test** (Phase 2). Twelve requests cover every route, every
  status code and every rejection path. They are worth keeping as a shell snippet in the phase's
  commit message, since there is nowhere else to put them.
- **The compiler remains the unit test** for everything typed: `strict` plus `noEmitOnError`
  means a payload/consumer mismatch is a build failure, and `"types": []` on the browser config
  mechanically prevents `home.ts` from reaching for Node globals.
- **The board gets a manual behavioural pass** (Phase 4 verify 2) against a capture taken before
  Phase 3. This is acceptable *only* because the two-document design leaves the board's 333
  lines structurally untouched; under any in-page view-switching design it would not be.
- **Two behaviours need an explicit check in every phase that could break them:** the
  guidance panel when data cannot be loaded, and the browser back button.
- **Pointer for a later write-tests pass:** `extractPraxisData(root)` is the first pure,
  importable, deterministic function in this repo, and `projects.ts`'s four functions are the
  second. A fixture directory with a small `flowcharge/` tree would make both cheaply testable.
  That is a separate workstream, not this one.

## Open questions

None block the work — each has a committed default above — but all seven are the user's call.

1. **Delete the committed `src/public/data.json` seed?** The plan deletes it in Phase 4 and
   keeps the out-of-box promise by pre-registering this repo's own root, so a fresh clone gets a
   *live* board of a real project instead of a frozen 281KB snapshot of an unrelated one. This
   reverses WS-1 acceptance criterion 9 and WS-2 acceptance criterion 10, which is why it is
   here rather than assumed. *Recommendation:* delete it. The alternative — keeping a 281KB
   generated file committed inside `src/` that nothing reads — is strictly worse than the wart
   WS-1 already apologised for.

2. **Bind the server to `127.0.0.1`?** `server.listen(port)` currently binds every interface.
   Today that exposes a static folder; after this change it exposes an API that reads arbitrary
   registered directories and will register any absolute path posted to it, to anyone on the
   same network. One argument makes it local-only. The cost is real if the user ever opens the
   board from a phone or another machine on their LAN. *Recommendation:* bind to `127.0.0.1`;
   it is one line in Phase 2 and it makes the "local single-user tool" assumption this plan
   rests on actually true. If LAN access matters, say so and it stays as it is.

3. **Expand a leading `~` to the home directory?** The plan rejects `~/Work/foo` with a message
   saying `~` is not expanded, because expanding it is behaviour the card did not ask for. But
   `~/…` *is* how people write absolute paths, so this will be hit. *Recommendation:* reject
   with the explicit message in the first version; add `os.homedir()` expansion (two lines in
   `server.ts`'s POST branch) if it proves annoying in practice.

4. **A way to remove a project?** Not asked for, so not planned. A mistyped-but-valid path stays
   on the home page until the user hand-edits `.praxis-projects.json`. Validation makes accidental
   junk unlikely, and the file is small and documented. *Recommendation:* leave it out; a
   `DELETE /api/projects/<id>` plus a small control on each tile is a clean follow-up card if it
   turns out to be wanted.

5. **Deployment and release constraints — the question I would have asked.** The plan assumes no
   production deployment, no live users, no data to migrate and no rollback window, on the
   evidence of `"private": true`, `localhost:4173`, and no publish step. If any of that is wrong,
   Open Question 2 and the `.praxis-projects.json` location both need revisiting before Phase 2.

6. **Rename `app.ts` to `board.ts` to pair with `board.html`?** After this change `board.html`
   loads `app.js` while `index.html` loads `home.js`, which is mildly inconsistent.
   *Recommendation:* keep `app.ts`. The rename touches the README tree, the tsconfig, the
   copy-asset list and the script tag for a naming improvement, and WS-1 only just settled that
   filename. Pure naming; no design consequence either way.

7. **Should tiles show per-project summary figures?** Workstream counts or a progress bar would
   make the home page genuinely informative, but rendering them means extracting *every*
   registered project on every home page load rather than one project per board load.
   *Recommendation:* not now. If it is wanted, the right shape is a separate
   `GET /api/projects/<id>/summary` that the home page requests per tile after the grid has
   already rendered, so a slow project never blocks the page.
