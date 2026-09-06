---
id: PLN-6-3wzsc6
type: plan
workstream: WS-6-jsue46
slug: git-branch-display
title: "Current git branch in the board masthead, read from .git/HEAD server-side"
status: done
created: 2026-08-06
updated: 2026-08-06
depends_on: []
links: []
---

# Current git branch in the board masthead, read from .git/HEAD server-side

## Summary

The board masthead already tells you *which project* you are looking at (`#tagline`, the
source path's basename) and *when* the data was read (`#gen-date`). It cannot tell you which
branch that project is on, which is the one piece of context that changes several times a day.

This plan adds it in three additive moves:

1. **A new pure library, `src/lib/git.ts`**, exporting one function — `readBranch(root)` —
   that resolves a project directory to its current branch name by reading `.git/HEAD`, and
   returns `null` from every failure path instead of throwing. No child process, no
   dependency, no `git` on `PATH`: the branch name is literally the text in `HEAD`
   (`ref: refs/heads/<branch>`), and the one non-trivial case — `.git` as a *file* holding a
   `gitdir:` pointer, which covers both worktrees and submodules — is one extra hop.
2. **A transport-layer merge in `server.ts`'s existing data route.** `GET
   /api/projects/<id>/data` answers `{ ...extractPraxisData(entry.path), branch: readBranch(entry.path) }`.
   One HTTP request, one `findProject` lookup, and `extract.ts` stays exactly what its header
   comment says it is — a reader of `flowcharge/` frontmatter — so the `npm run refresh` dump
   keeps its current shape byte for byte.
3. **A third masthead line that hides itself when there is nothing to show.** `.meta`'s lines
   are joined by literal `<br>` tags, so an empty branch line would leave a visible gap at
   `line-height: 1.6`. The fix is to put the `<br>` *inside* the branch element and ship that
   element `style="display:none"` in the markup — the same pattern `#lower` already uses in
   `board.html:54` and `app.ts:66`. Absent branch, absent line, absent gap, and no new CSS.

The whole feature is roughly 30 lines of new code across four files, with zero new
dependencies and no change to any existing renderer, payload field, or route contract.

## Scope

### Acceptance criteria

1. Opening `/board.html?project=<id>` for a project whose directory is a normal git checkout
   shows a third line in the right-hand masthead block reading `Branch <name>`, with the
   branch name in the same emphasised style as the generated date (`.meta strong`).
2. A branch name containing slashes (`feature/ws-6-git-branch-display`) renders in full — the
   branch value is never split on `/` the way `#tagline` splits the source path.
3. A project directory with no `.git` entry shows **no third line and no blank gap**: the
   masthead renders at exactly the height it does today, and no error appears anywhere.
4. A project whose `.git` is a *file* containing a `gitdir:` pointer (a git worktree, or a
   submodule) shows the branch named in the pointed-to directory's `HEAD`.
5. A project on a detached HEAD shows nothing, exactly as if there were no repository. This is
   the committed default; see Open question 1.
6. Two registered projects sitting on different branches each show their own branch. No
   project ever shows the dashboard repo's branch unless the dashboard repo is the project
   being viewed.
7. `GET /api/projects/<id>/data` gains exactly one new top-level key, `branch`, whose value is
   a non-empty string or `null`. Every existing key — `generated`, `source`, `workstreams`,
   `issues` — is unchanged in name, type and content.
8. `npm run refresh -- --root <dir>` writes a JSON file with **no** `branch` key; the dump's
   shape is identical to today's.
9. No input makes the route fail: a `.git` file pointing at a directory that no longer exists,
   an unreadable `HEAD`, an empty `HEAD`, or arbitrary garbage in `HEAD` each produce
   `branch: null` inside a normal `200` response.
10. When the data request fails entirely (unknown project, `410`, network error), the board
    shows its existing guidance panel and no branch line — the element is hidden by default in
    the markup, so the failure path needs no extra handling.
11. Still zero runtime dependencies, still two devDependencies, and still no `child_process`,
    `execSync` or `spawn` anywhere in `src/` or `tools/`.

### Out of scope

- Any git operation beyond reading the current branch name: no status, no dirty/clean flag, no
  ahead/behind counts, no commit SHA, message or author, no branch list, no branch switching.
  The workstream card excludes these by its own wording.
- Handling a project registered as a *subdirectory* of a larger git repository. See "Accepted
  limitation" in Design — stated, not solved.
- Live updates. The branch is read fresh on each data request, which means on each page load.
  A branch switched in another terminal appears after a reload, and nothing polls. (Live
  refresh belongs to the separate `live-board-refresh` workstream and is not touched here.)
- Any change to `findProject`, `addProject`, `readProjects`, or the `.praxis-projects.json`
  shape.
- Showing the branch anywhere other than the board masthead — the home page tiles are
  untouched.
- Anything in the in-flight WS-5 detail work (`src/lib/detail.ts`, the `…/detail` route). This
  plan assumes neither exists and touches nothing related to them.

### Assumptions

These were taken rather than asked, because none of them changes the structure of the work:

1. **Deployment and release.** This is a local, single-user, localhost-bound tool with no
   production deployment, no live users, no persisted state beyond a gitignored registry, and
   no migration surface. No feature flag or dark-launch mechanism is warranted; Phase 1 is
   inherently dark (the payload gains a field nothing reads yet), and rollback is `git revert`
   of the phase commits with nothing left behind. Recorded under Open questions as the
   question that would have been asked.
2. **Label wording is `Branch`**, mirroring the existing `Data generated` label. See Open
   question 2 for placement.
3. **The value shown is only ever a real branch name.** `readBranch` returns a branch name or
   nothing — never a SHA, never a placeholder string. This is what makes criterion 2's "render
   verbatim" safe and keeps the client free of any presentation logic.
4. **`.git` is followed through symlinks** — `fs.statSync` does that by default and no special
   handling is added for it.
5. **The `HEAD` read is not size-capped.** `extract.ts` already reads every file under
   `flowcharge/` uncapped, and a registered project directory is content the user explicitly
   pointed the tool at. Adding a cap here and nowhere else would be inconsistent, so the
   existing trust boundary is kept as-is.

## Design

### Approaches weighed and rejected

**Shelling out to `git rev-parse --abbrev-ref HEAD` — rejected.** It is the obvious move and it
is the wrong one here. There is currently zero `child_process` usage in `src/` or `tools/`;
every file read in this codebase is `fs` + `path` (`extract.ts`'s whole `flowcharge/` walk,
`projects.ts`'s registry read). Shelling out would add the first process spawn in the codebase,
a per-request child process on the board's hot path, and a runtime assumption that `git` is on
`PATH` of whatever shell started the server — all to obtain a value that is sitting in a
sub-200-byte text file. Its one genuine advantage is noted as an accepted limitation below.

**A git library dependency (`isomorphic-git` or similar) — rejected.** The repo's stated
character is zero runtime dependencies, and this feature needs one regex against one file.

**Seam (a): add `branch` inside `extractPraxisData()`/`PraxisData` — rejected.** `extract.ts`
opens with "reads a Praxis project's `flowcharge/` frontmatter and returns the `PraxisData`
payload". Git is not `flowcharge/`, and the same function backs the standalone `npm run refresh`
dump, so every dumped JSON file would gain a git key it has no use for. Single responsibility
is the deciding argument, and it costs nothing to honour: the transport seam gets the same
single HTTP request.

**Seam (c): a separate `GET /api/projects/<id>/branch` endpoint — rejected.** It costs a second
round trip, a second `readProjects()` + `findProject` pass over the registry, and a masthead
that paints its branch line a beat after everything else `boot()` renders. It buys separation
that seam (b) already provides at the module level. It would be the right shape if the branch
needed to refresh independently of the board data — it does not, and that is explicitly out of
scope.

**Seam (b): merge in the data route — chosen.** One request, one lookup, `extract.ts` and the
CLI dump untouched, and the field is added at the layer that actually owns "what the browser
receives". Note that there is no standing commitment freezing `PraxisData`'s shape — the
byte-parity language in the WS-1 and WS-3 plans was the regression test for those refactors,
not a permanent contract — so the choice here is made on merits, not precedent.

**UI absence: build the line in JS and append only when present — rejected, narrowly.** It
works, and it is one fewer piece of markup. It was rejected because the masthead's other two
dynamic values live in `board.html` as visible structure, and the hidden-container pattern
already has a precedent in this exact file pair (`board.html:54` ships `#lower` with
`style="display:none"`; `app.ts:66` un-hides it). Consistency wins a close call.

### New module: `src/lib/git.ts`

```ts
// Git branch reader: resolves a project directory to the name of the branch its
// checkout is on, by reading .git/HEAD. Knows a filesystem path and git's on-disk
// HEAD format; knows nothing about the registry, the transport layer, flowcharge, or
// the board payload.

export function readBranch(root: string): string | null
```

`readBranch` is the module's only export. What it knows: how a git checkout records its current
branch on disk. What it must **not** know: that projects have ids, that a registry exists, that
an HTTP response is being assembled, or that a masthead will display the result. It takes a
path and returns a string or `null`; nothing else.

Algorithm, in order:

1. `gitPath = path.join(path.resolve(root), '.git')`.
2. `fs.statSync(gitPath)` — if it is a **directory**, the git directory *is* `gitPath`.
3. If it is a **file**, read it and match `/^gitdir:\s*(.+)$/m`. No match → `null`. Otherwise
   the git directory is `path.resolve(path.dirname(gitPath), captured.trim())`, which handles
   both the absolute pointer git normally writes and a legal relative one in a single call.
   This is one hop and only one hop — a worktree's `…/.git/worktrees/<name>` and a submodule's
   `…/.git/modules/<name>` both contain a real `HEAD`, so there is no second pointer to chase.
4. Read `<gitDir>/HEAD` as utf8, `.trim()`, and match `/^ref:\s*refs\/heads\/(.+)$/`.
5. Match → return capture group 1, trimmed (branch names may contain `/`, which `(.+)` keeps
   intact). No match → `null`. A bare 40-hex SHA (detached HEAD) falls into this branch by
   construction; see Open question 1.
6. The entire body sits inside one `try { … } catch { return null }`. This is the same
   degradation contract `readProjects()` established in `src/lib/projects.ts:39-52`: every
   failure mode returns a value, none throws, and the caller never needs a guard.

A `null` is a normal, expected state — not an error — so `readBranch` logs nothing, exactly as
`readProjects()` logs nothing on its failure paths.

Ref resolution, `packed-refs` and the object store are all irrelevant: the branch *name* is the
text in `HEAD`, and it never needs resolving to a SHA.

**Accepted limitation.** `git` itself walks *up* from the working directory to find an ancestor
repository root. Reading `<root>/.git` only sees a repository whose root is exactly the
registered project path. A project registered as a subdirectory of a larger repo will therefore
show no branch — indistinguishable from having no repo. All three currently-registered projects
are repository roots, so this has no fixture today. It is the one thing shelling out to `git`
would have given for free, and it is knowingly traded away for the reasons above.

### Contract: the board route's response

`GET /api/projects/<id>/data` → `200`:

```jsonc
{
  "generated":   "YYYY-MM-DD",   // unchanged
  "source":      "/abs/path",    // unchanged
  "workstreams": [ /* … */ ],    // unchanged
  "issues":      [ /* … */ ],    // unchanged
  "branch":      "main"          // NEW — non-empty string, or null
}
```

`404`, `410`, `405` and `500` responses are unchanged in every respect.

In `src/types/praxis-data.d.ts`, added below `PraxisData` (additive — no existing interface is
edited):

```ts
// What the board route sends: the extractor's payload plus the fields the server
// adds at the transport layer. PraxisData itself stays exactly what
// extractPraxisData() returns and what `npm run refresh` dumps.
interface BoardPayload extends PraxisData {
  branch: string | null;
}
```

This keeps `PraxisData` structurally identical, so `extract.ts`, `extract-praxis-data.ts` and
the dumped file are provably unaffected — the compiler enforces it, since adding a required
field to `PraxisData` itself would have broken `extractPraxisData`'s return.

### Server wiring

In `src/server.ts`, the `dataMatch` branch's single response line (currently `server.ts:148`)
becomes:

```ts
const payload: BoardPayload = { ...extractPraxisData(entry.path), branch: readBranch(entry.path) };
sendJson(res, 200, payload);
```

plus the import of `readBranch` from `./lib/git.js`.

`entry.path` — the absolute, `path.resolve`'d path already in hand from `findProject(id)` — is
the **only** root ever passed to `readBranch`. `projects.ts`'s module-level `repoRoot` constant
is the *dashboard's* own directory and must never be used here; doing so would make every
project's board display the dashboard repo's branch. No new path resolution or validation is
introduced: the route already 404s an unknown id and 410s a path that has lost its `flowcharge/`,
and both guards run before this line.

The route's existing `try/catch` stays as it is. It is now redundant for the branch read
specifically (`readBranch` cannot throw), which is fine — it still guards `extractPraxisData`.

### Masthead markup

`src/public/board.html:20-23` becomes:

```html
  <div class="meta">
    Data generated <strong id="gen-date">—</strong><br>
    <span id="meta-counts"></span>
    <span id="branch-line" style="display:none"><br>Branch <strong id="branch-name"></strong></span>
  </div>
```

The load-bearing detail: **the `<br>` is inside `#branch-line`**. Hiding the span therefore
removes the line break with it, so absence costs zero vertical space — which the naive
`<br><span id="branch"></span>` would not, at `line-height: 1.6`. Shipping it hidden in the
markup also means the pre-boot state and every error path are correct with no extra code.

The whitespace between `</span>` and the new `<span>` collapses to a single trailing space at
the end of the counts line, which is discarded at line-end in normal white-space processing —
no visual effect in the right-aligned block.

No CSS changes. `.masthead .meta` (mono, 11.5px, right-aligned) and `.masthead .meta strong`
(`styles.css:157-164`) already style both the label and the value correctly.

### Client wiring

In `src/public/app.ts`, `boot`'s signature becomes `function boot(raw: BoardPayload)`, and one
block joins the three existing masthead writes, immediately after the `#meta-counts` assignment
(`app.ts:64-65`):

```ts
if (raw.branch) {
  byId('branch-name').textContent = raw.branch;
  byId('branch-line').style.display = '';
}
```

Falsy covers both `null` and the empty string, so the client needs no knowledge of git at all —
it renders a string if it got one. `#gen-date`, `#tagline` and `#meta-counts` behaviour is
untouched, and `textContent` keeps the branch name inert as text.

### Non-functional notes

- **Performance:** one `statSync` plus one or two `readFileSync` calls on sub-200-byte files
  per board load, against a route that already walks an entire `flowcharge/` tree. Immaterial.
- **Least privilege:** the module reads; it never writes, never spawns, and never touches a
  path outside `<entry.path>/.git` except via a `gitdir:` pointer the user's own repository
  wrote. The only value that escapes is a string matching `ref: refs/heads/…`, to a
  localhost-bound server whose user explicitly registered that directory.
- **Observability:** the server's existing per-route `console.error` containment is unchanged
  and sufficient. `readBranch` stays silent by design — a missing repository is a normal state,
  and logging it on every page load of a non-git project would be noise.

## Staged task breakdown

Three phases, all small. Each leaves the app fully working.

### Phase 1 — `readBranch` and the route field (small)

**Build:** `src/lib/git.ts` exactly as specified in Design; the `BoardPayload` interface in
`src/types/praxis-data.d.ts`; the import and the two-line change in `server.ts`'s `dataMatch`
branch.

**Files:** `src/lib/git.ts` (new), `src/types/praxis-data.d.ts`, `src/server.ts`.

**Dependencies:** none.

**Verify:**
1. Build a scratch fixture tree outside the repo with four directories: a normal checkout on a
   slash-containing branch, a linked worktree, a checkout on a detached HEAD, and a plain
   directory with no `.git`. Register each and `curl -s localhost:4173/api/projects/<id>/data |
   head -c 400` — the first two report their branch names, the last two report `"branch":null`,
   and all four return `200`.
2. Corrupt cases against the same fixtures: point a `.git` file's `gitdir:` at a deleted path,
   `chmod 000` a `HEAD`, empty a `HEAD`, and write junk into one. Each still returns `200` with
   `"branch":null`, and the server process stays up.
3. `npm run refresh -- --root .` and confirm the written JSON has no `branch` key.
4. The board renders exactly as before — nothing reads the new field yet.

### Phase 2 — The masthead line (small)

**Build:** the `#branch-line` markup in `board.html`, the `BoardPayload` signature change and
the three-line branch block in `app.ts`.

**Files:** `src/public/board.html`, `src/public/app.ts`.

**Dependencies:** Phase 1 (the field must exist in the payload).

**Verify:**
1. Open the dashboard's own board — the masthead's right block reads `Branch <name>` on a third
   line, and the name matches `git branch --show-current` run in the repo.
2. Check out a branch whose name contains `/`, reload, and confirm the full name renders.
3. Open the no-`.git` fixture's board and compare a screenshot against one taken before this
   phase: identical masthead, no gap, no stray blank line.
4. Open the worktree fixture's board — its own branch shows, not the main checkout's.
5. Open two projects on different branches in two tabs — each shows its own.
6. Open `/board.html?project=nonexistent` — the guidance panel appears and no branch line is
   visible.

### Phase 3 — README (small)

**Build:** add the `src/lib/git.ts` line to the README's `How it fits together` file tree,
alongside `extract.ts` and `projects.ts`.

**Files:** `README.md`.

**Dependencies:** Phase 1.

**Verify:** the tree lists every file under `src/lib/` that exists on disk.

## Data & compatibility

- **Migrations:** none. Nothing is persisted, nothing is cached, and `.praxis-projects.json` is
  untouched in both shape and content.
- **Payload compatibility:** strictly additive. `app.ts` reads the payload by key, so an added
  key cannot disturb any existing renderer, and the four existing fields keep their exact
  names, types and values. A hypothetical third-party consumer of the data route sees one extra
  key it can ignore.
- **CLI compatibility:** `npm run refresh` output is unchanged — the entire reason the merge
  happens at the transport layer rather than inside `extractPraxisData`.
- **Type-level guarantee:** because `branch` lives on `BoardPayload` and not on `PraxisData`,
  `tsc` (strict, `noEmitOnError`) would fail the build if the extractor or the CLI drifted into
  needing it. The compiler enforces the separation the design claims.
- **Nullability is part of the contract, not an accident.** `branch` is `string | null` and
  never absent from the response object, so a consumer can distinguish "no branch" from "old
  server" if it ever needs to.
- **Rollback:** `git revert` the phase commits. Nothing persists, no state to unwind, and each
  phase boundary is a coherent working state — after Phase 1 the payload has a field nobody
  reads, after Phase 2 the feature is complete. Reverting Phase 2 alone leaves a harmless
  unused field.

## Testing strategy

No test framework exists in this repo and none is added. Evidence per phase is mechanical:

- **The scratch fixture tree is this feature's real test** (Phase 1 verify 1 and 2). All four
  on-disk shapes — directory `.git`, file `.git` with `gitdir:`, detached HEAD, no repo — plus
  the four corruption cases are cheap to construct with a handful of `git init` / `git worktree
  add` / `git checkout <sha>` commands and are the only way to exercise `readBranch`'s
  branches. Keep the setup commands in the phase's commit message; there is nowhere else to
  put them.
- **`curl` is the route's integration test** (Phase 1). The assertion is narrow and total: the
  response is `200`, `branch` is present, and the other four keys are byte-identical to a
  capture taken before the change.
- **The compiler is the unit test for the contract.** `BoardPayload extends PraxisData` plus
  `strict` and `noEmitOnError` means any mismatch between what the server sends and what
  `boot()` reads is a build failure, and `"types": []` on the browser config keeps `app.ts`
  from reaching for Node globals.
- **The masthead gets a visual before/after** (Phase 2 verify 3). This matters more than it
  usually would, because the specific failure mode this design guards against — a blank line at
  `line-height: 1.6` — is invisible in the DOM and visible only on screen.
- **Pointer for a later write-tests pass:** `readBranch(root)` is a pure, deterministic,
  single-argument function over a filesystem fixture — the cheapest thing in this repo to unit
  test, and a natural companion to the `extractPraxisData` / `projects.ts` fixtures already
  identified as candidates in PLN-4. That remains a separate workstream.

## Open questions

None blocks the work — each has a committed default in the plan above, and each is a one-line
change to flip.

1. **What should a detached HEAD show?** The default committed here is **nothing**, identical
   to having no repository. The alternatives are the abbreviated SHA (`a439d4d`) or a literal
   marker like `(detached)`. *Recommendation:* keep `null`. It makes the contract "this string
   is always a branch name" true without exception, which is what lets the client render the
   value verbatim with no formatting logic and no way for a hex string to appear where a reader
   expects a branch. The honest cost is that a detached HEAD becomes indistinguishable from no
   repo at all, which is real information loss for anyone who bisects or checks out tags often.
   If that is you, say so: it is a two-line change in step 5 of `readBranch` and one extra
   acceptance criterion, and it would arrive with a second field or a marker prefix so that
   "branch" never silently means "SHA".

2. **Third line in `.meta`, or appended to the tagline?** The plan puts `Branch <name>` as a
   third right-aligned line under the counts. The alternative reads the workstream card's
   "beside the source line" more literally and extends `#tagline` to `WORKSTREAM STATE ·
   PRAXIS-DASHBOARD · MAIN` on the left. *Recommendation:* the `.meta` line. `.tagline` is
   uppercased by CSS (`text-transform: uppercase`), which would mangle a case-sensitive branch
   name into something that is no longer copy-pasteable, and `.meta` already has the
   label-plus-emphasised-value idiom this value wants. If the tagline placement is preferred,
   it needs a CSS carve-out for the branch segment.

3. **Label wording.** `Branch main` is assumed. `On branch main` (git's own phrasing) or a bare
   `⑂ main` are equally defensible. *Recommendation:* `Branch`, for symmetry with
   `Data generated`. Trivial to change, listed only so it is not mistaken for a considered
   product decision.

4. **The deployment/release question, asked and answered by assumption.** Whether there is
   production data to protect, whether the app must stay shippable mid-feature, and whether
   there are migration or rollback constraints. This run assumed no to all three on the grounds
   that this is a localhost-bound single-user tool with no persisted state touched by the
   feature. If any of that is wrong for your setup, the plan's phasing already accommodates it
   — Phase 1 is inherently dark and Phase 2 is the only user-visible change.
