---
id: PLN-2-7k9ycf
type: plan
workstream: WS-2-bg6ela
slug: src-dist-build-layout
title: "Relocate hand-written source into src/, mirroring today's layout so no path logic changes"
status: done
created: 2026-08-05
updated: 2026-08-05
depends_on: []
links: []
---

# Relocate hand-written source into src/, mirroring today's layout so no path logic changes

## Summary

All five hand-written files sit loose at the repo root or under `public/`. This plan moves
them, plus the one generated file that must be served alongside them, into a `src/` folder
that **mirrors the current shape exactly**:

```
src/server.js
src/scripts/extract-praxis-data.mjs
src/public/{index.html, app.js, styles.css, data.json}
```

The mirroring is the whole trick, not a cosmetic preference. `server.js:7` computes its
static root as `path.join(__dirname, 'public')`, and `extract-praxis-data.mjs:16` computes
its default output as `path.join(__dirname, '..', 'public', 'data.json')`. Both are relative
to the file's own location, so if the folder *relationships* survive the move, **both
expressions keep resolving correctly with zero edits**. The three browser-side references
(`href="styles.css"`, `src="app.js"`, `fetch('./data.json')`) are already relative and are
likewise untouched. Nothing that computes a path changes anywhere in the codebase.

What does change is the two files that name `server.js` and the extractor from outside the
tree — `package.json` scripts and `.claude/launch.json` — plus four human-facing strings that
would otherwise go stale (the extractor's header comment and `usage()` text, `index.html`'s
footer, and the README).

**`dist/` is deliberately not created by this plan.** The card asks that "compiled or bundled
output land in `dist/`". There is no compiled or bundled output in this repo — no compiler, no
bundler, no dependencies, no lockfile, no `tsconfig`; every file reaches the browser
byte-identical to what is on disk. A `dist/` populated by copying identical bytes is a `cp -r`
that buys no transformation and costs two real things: a stale-`dist` failure mode where
editing `src/` and forgetting to rebuild silently serves old content, and a mandatory extra
command before `npm start`. The `dist/` half of this card becomes meaningful the moment a
compiler exists to emit into it — which is WS-1 (TypeScript conversion), still `backlog`. This
plan therefore delivers the `src/` half in full and records the `dist/` half as follow-on work
gated on WS-1 (see *The deferred `dist/` half*).

## Scope

### Acceptance criteria

1. The repo root contains no `server.js`, no `scripts/` folder, and no `public/` folder.
   These exist instead: `src/server.js`, `src/scripts/extract-praxis-data.mjs`,
   `src/public/index.html`, `src/public/app.js`, `src/public/styles.css`,
   `src/public/data.json`.
2. Immediately after the move commit, `git show --stat` records all six paths as **renames at
   100% similarity** — i.e. not one byte of any moved file changed. (Cosmetic string edits to
   `index.html` and the extractor happen in a *later* commit, precisely so this evidence
   stays clean.)
3. `npm start`, run with cwd = repo root, serves the board at `http://localhost:4173`. The
   page renders identically to before the move: masthead, KPI strip with coloured bars,
   all six columns, both lower panels with the severity bar in colour.
4. On that page load, `styles.css`, `app.js` and `data.json` each return HTTP 200 with their
   correct `Content-Type`, and the browser console is clean.
5. `npm run refresh -- --root <dir>`, run with cwd = repo root and **no `--out` flag**, writes
   to `src/public/data.json` — the same file `npm start` serves. It must not write to a
   root-level `public/data.json`, and the destination must not depend on cwd.
6. `npm run refresh -- --root <dir> --out <path>` still resolves `<path>` against the process
   cwd exactly as it does today (`path.resolve` at extractor line 162 is unchanged).
7. With `src/public/data.json` absent, loading the page still shows the graceful
   "Couldn't load data.json" panel with the refresh instructions — not a blank page or an
   uncaught error. `npm start` must not require a refresh first.
8. The `praxis-dashboard` configuration in `.claude/launch.json` launches the server and the
   preview reaches a working board.
9. No `dist/` directory is created, and `.gitignore` is unchanged.
10. `src/public/data.json` remains tracked in git, so a fresh clone plus `npm start` still
    shows a populated board with no refresh step — the README's "works out of the box"
    promise survives verbatim.
11. No file under `src/` contains a path expression that differs from its pre-move version.
    The only edits inside moved files are comment and display strings.
12. The README's directory tree, quick-start block and Scripts table describe the new layout,
    and the "No build step, no framework, no npm dependencies" note at README.md:52 is still
    true and still present.

### Out of scope

- **Creating `dist/`, any build script, or any `prebuild`/`prestart` hook.** Explained above
  and in *The deferred `dist/` half*.
- **WS-1's TypeScript conversion**, and any bundler, minifier, transpiler, or npm dependency.
- **The extractor's behaviour, CLI flags, output format, or `data.json`'s content.** Only its
  default output *location* is affected, and that only implicitly — the expression at line 16
  is not edited at all.
- **Splitting, renaming, or restructuring the files themselves** beyond the move: no
  `src/server/` + `src/client/` reorganisation, no ES-module refactor of `app.js`'s IIFE, no
  renaming `extract-praxis-data.mjs` to `.js`.
- **WS-4's CSS extraction**, already complete. `src/public/styles.css` simply travels with the
  rest of `public/`.
- **`server.js`'s traversal guard** (`filePath.startsWith(root)`, line 24). Its semantics are
  unaffected — `root` is still derived from `__dirname` — and it is not being reviewed or
  changed here.
- **Cache headers, MIME table, port handling** — all unchanged.

### Assumptions

Settled without the user present. Each is a judgement call, not a requirement in the card.

1. **The `scripts/` sub-folder is preserved inside `src/`, not flattened.** Flattening to
   `src/extract-praxis-data.mjs` would make `path.join(__dirname, '..', 'public')` resolve to
   the *repo root's* `public/`, which will no longer exist — forcing an edit to the one line
   of path logic this plan most wants to leave alone. Keeping the sub-folder makes the hop
   count still correct by construction.
2. **The folder inside `src/` keeps the name `public`.** Renaming it (to `web/`, `client/`,
   `static/`) would require editing both `server.js:7` and the extractor's line 16, forfeiting
   the pure-rename property for a naming preference. Recorded as Open Question 1.
3. **`src/public/data.json` stays committed; `.gitignore` is not touched.** See
   *The generated file* below.
4. **No deployment or release constraints apply.** This is a local-only developer dashboard on
   `localhost:4173` with no production deployment, no live users, no persisted user data and
   nothing to migrate. So: no feature flag, no dark launch, no staged rollout — the phases
   below are ordinary commits on a branch, and rollback is `git revert`.
5. **Both npm scripts continue to assume cwd = repo root.** `npm run` sets cwd to the package
   root anyway, so `node src/server.js` is correct from anywhere npm is invoked.
6. **`index.html`'s footer text is updated to the new paths.** It names `public/data.json` and
   `scripts/extract-praxis-data.mjs` as instructions to the reader; leaving them stale would
   be a new inaccuracy. Recorded as Open Question 4 since it is arguably invisible detail.
7. **`.claude/launch.json` is in scope.** It is a config file outside the source tree, but it
   references `server.js` by path independently of npm, and the card's preservation list names
   the dev-server config as something that must keep working.

## Design

There is no new module, data model, or interface here. The design content is the path algebra
that makes the move a no-op for the code, and the wiring that has to change because it names
paths from outside.

### Verified current state

| Reference | Location | Kind | Survives move untouched? |
|---|---|---|---|
| `path.join(__dirname, 'public')` | `server.js:7` | relative to own file | **Yes** — `src/server.js` + `src/public/` preserves the relationship |
| `/` → `/index.html` rewrite | `server.js:21` | relative to `root` | Yes |
| `filePath.startsWith(root)` guard | `server.js:24` | relative to `root` | Yes |
| `path.join(__dirname, '..', 'public', 'data.json')` | `extract-praxis-data.mjs:16` | one `..` hop from own file | **Yes** — `src/scripts/` + `src/public/` preserves the hop count |
| `path.resolve(args.out)` | `extract-praxis-data.mjs:162` | cwd-relative | Yes |
| `href="styles.css"` | `index.html:7` | document-relative | Yes |
| `src="app.js"` | `index.html:75` | document-relative | Yes |
| `fetch('./data.json')` | `app.js:20` | document-relative | Yes |
| `"start": "node server.js"` | `package.json:11` | repo-root-relative | **No — must change** |
| `"refresh": "node scripts/extract-praxis-data.mjs"` | `package.json:12` | repo-root-relative | **No — must change** |
| `"runtimeArgs": ["server.js"]` | `.claude/launch.json:7` | repo-root-relative | **No — must change** |

Cosmetic-only path mentions, functionally inert but visible to humans:
`extract-praxis-data.mjs:2`, `:7`, `:29`, `:32`; `index.html:69`; `README.md:16, 20, 27–34,
45, 46, 48`. `server.js:23`'s comment says "outside public/", which stays accurate.

### Target layout

```
Praxis-Dashboard/
├── package.json                          scripts point into src/
├── README.md
├── .claude/launch.json                   runtimeArgs → src/server.js
└── src/
    ├── server.js                         static server; root = __dirname/public
    ├── scripts/
    │   └── extract-praxis-data.mjs       default out = __dirname/../public/data.json
    └── public/                           the served root, unchanged internally
        ├── index.html
        ├── styles.css
        ├── app.js
        └── data.json                     generated, committed
```

### The wiring contract

Exactly three functional edits exist in this entire plan:

```jsonc
// package.json
"start":   "node src/server.js",
"refresh": "node src/scripts/extract-praxis-data.mjs"

// .claude/launch.json
"runtimeArgs": ["src/server.js"]
```

Everything else is a `git mv` or a string.

### The generated file

`src/public/data.json` is the repo's one genuinely generated artefact, and it is the one place
this plan knowingly leaves a build output sitting next to source. That is a deliberate,
constrained choice, not an oversight:

- The browser fetches it with `./data.json`, document-relative. `index.html`, `app.js`,
  `styles.css` and `data.json` therefore *must* be served from one directory, and `server.js`
  has exactly one `root`.
- Moving only `data.json` to a sibling `dist/` would require `server.js` to serve two roots
  with fallback — new server complexity, a new traversal-guard surface, and a second `root`
  to reason about. That is more machinery than the card asks for, and it is machinery that
  WS-1 would immediately rewrite.
- Moving all of `public/` to `dist/` instead would put three hand-written files inside the
  build-output folder, inverting the very separation the card wants.

So `data.json` stays where it is served from, and stays committed. The README's promise that
"the board works out of the box" survives unchanged, now pointing at `src/public/data.json`.
`.gitignore` gains no `dist/` entry because no `dist/` exists to ignore; adding one
speculatively would advertise a folder the repo does not have.

### The deferred `dist/` half

When WS-1 lands a compiler, the natural completion is: compiled `server.js` and the extractor
emit to `dist/`, `dist/public/` becomes the served root, the extractor's default output becomes
`dist/public/data.json`, `dist/` is added to `.gitignore` — and at that point the
"works out of the box from a checked-in snapshot" promise has to be either dropped or
re-established some other way, because a gitignored `dist/` cannot carry a committed snapshot.
That trade-off is real and belongs to whoever plans WS-1's landing, with the full picture of
what the compiler emits. It is recorded here so it is not lost, not planned here because
planning it now would mean inventing the compiler's output shape. See Open Questions 2 and 3
for how to record it as a Praxis artefact.

## Staged task breakdown

Four phases, strictly ordered, all small. Phase 2 is the only one that changes behaviour;
Phases 3 and 4 are text. Phase 2 must move the files **and** fix the wiring in one step —
splitting them would leave `npm start` broken between phases.

### Phase 1 — Capture the baseline (small)

**Build:** nothing. Establish what "unchanged" means, so Phase 2 has something to be checked
against.

1. Record a content manifest of the six files that will move:
   `shasum -a 256 server.js scripts/extract-praxis-data.mjs public/index.html public/app.js public/styles.css public/data.json`
2. Run `npm start` and capture the rendered board (light scheme is enough; WS-4 already proved
   the theme paths). Confirm the KPI strip, all six columns and both lower panels render.
3. Run `npm run refresh -- --root .` and note the path it prints — it logs the absolute
   `outPath` at extractor line 166. This is the value Phase 2 must see change to
   `.../src/public/data.json`.
4. Temporarily rename `public/data.json` aside, reload, and confirm the "Couldn't load
   data.json" panel appears. Restore it. This is the graceful-degradation behaviour that must
   still hold in Phase 2, and it is far easier to confirm it works *now* than to debug it later.

**Files touched:** none.

**Depends on:** nothing.

**Verify:** manifest saved, capture saved, both commands' output recorded, degradation panel
seen and `data.json` restored.

### Phase 2 — Move the tree and repoint the wiring (medium)

**Build:**

1. `git mv` the six files into place:
   - `server.js` → `src/server.js`
   - `scripts/extract-praxis-data.mjs` → `src/scripts/extract-praxis-data.mjs`
   - `public/index.html`, `public/app.js`, `public/styles.css`, `public/data.json` →
     `src/public/`
   The now-empty `scripts/` and `public/` directories disappear with the move.
2. `package.json:11–12` → `node src/server.js` and `node src/scripts/extract-praxis-data.mjs`.
3. `.claude/launch.json:7` → `"runtimeArgs": ["src/server.js"]`.
4. **Edit nothing inside the moved files.** No comment, no string, no path — those are Phase 3.

**Files touched:** the six moved files (as renames only), `package.json`, `.claude/launch.json`.

**Depends on:** Phase 1.

**Verify:**

1. **Content parity — the decisive check.** `git status` / `git diff --cached -M --stat` shows
   six `rename` entries at 100%. Independently, re-run the Phase 1 `shasum` against the new
   paths and diff the two manifests: identical hashes, different paths only.
2. **Server root.** `npm start` from the repo root; open `http://localhost:4173/`. The board
   renders as in the Phase 1 capture. In devtools, `styles.css`, `app.js` and `data.json` are
   all 200. Console clean. (This proves `server.js:7` still resolves — no assertion needed.)
3. **Extractor default output.** `npm run refresh -- --root .` from the repo root prints an
   `outPath` ending `/src/public/data.json`, and no `public/` folder reappears at the repo
   root. Reload the page and confirm the "Data generated" date reflects the new run — proving
   the extractor writes to the same file the server serves.
4. **cwd-independence of the default.** Run the same command from a different cwd
   (`node /abs/path/to/src/scripts/extract-praxis-data.mjs --root /abs/path/to/project`) and
   confirm it still targets `src/public/data.json`.
5. **`--out` still cwd-relative.** `npm run refresh -- --root . --out /tmp/probe.json` writes
   `/tmp/probe.json` and leaves `src/public/data.json` alone. Delete the probe.
6. **Graceful degradation.** Move `src/public/data.json` aside, hard-reload, see the
   "Couldn't load data.json" panel; restore it.
7. **Launch config.** Start via the `praxis-dashboard` config in `.claude/launch.json` and
   confirm the preview reaches a working board.
8. **No `dist/`.** `ls` shows no `dist/`; `git diff .gitignore` is empty.

### Phase 3 — Refresh the stale path strings inside the source (small)

**Build:** update the human-facing text that now names paths that no longer exist. Kept out of
Phase 2 so that phase's rename evidence stays at 100%.

1. `src/scripts/extract-praxis-data.mjs`: header comment line 2 (`writes public/data.json`),
   the usage comment line 7, the `usage()` invocation line 29, and the `--out` default
   description line 32 → `src/public/data.json` and `node src/scripts/extract-praxis-data.mjs`.
2. `src/public/index.html:69`: footer `<code>public/data.json</code>` →
   `<code>src/public/data.json</code>` and `<code>scripts/extract-praxis-data.mjs</code>` →
   `<code>src/scripts/extract-praxis-data.mjs</code>`.

**Files touched:** `src/scripts/extract-praxis-data.mjs`, `src/public/index.html`.

**Depends on:** Phase 2.

**Verify:** `node src/scripts/extract-praxis-data.mjs --help` prints usage naming
`src/scripts/...` and `src/public/data.json`; running that exact printed command line works.
Reload the page and read the footer — it names paths that exist. `grep -rn "public/data.json"
src/ | grep -v "src/public/data.json"` returns nothing.

### Phase 4 — Update the README (small)

**Build:** in `README.md`, update the quick-start comment (line 16), the checked-in-snapshot
sentence (line 20), the directory tree (lines 25–35) to show `src/` with `scripts/` and
`public/` nested inside it, the Scripts table (lines 45–46), and the `--out` note (line 48).
Leave the "No build step, no framework, no npm dependencies" note at line 52 exactly as it is —
this plan keeps it true.

**Files touched:** `README.md`.

**Depends on:** Phases 2 and 3.

**Verify:** every path in the README exists on disk (`find src -type f` matches the tree), and
the two commands in the quick-start block run successfully as written, copy-pasted.

## Data & compatibility

- **Migrations:** none. No schema, no persisted state, no data format changes.
  `data.json`'s content and the extractor's output shape are untouched.
- **Consumers:** the only consumers are a browser loading the board from `server.js`, `npm`
  running the two scripts, and the `.claude/launch.json` preview. All three are inside this
  repo and all three are updated in Phase 2. There is no public API, no published package
  (`"private": true`), and no external importer of any of these files.
- **Backward compatibility — the one real break:** anyone with muscle memory or scripts
  invoking `node server.js` or `node scripts/extract-praxis-data.mjs` directly will get
  "Cannot find module". This is unavoidable in a relocation and is exactly what `npm start` /
  `npm run refresh` exist to insulate against. No compatibility shim (a root `server.js` that
  re-exports `src/server.js`) is planned: it would reintroduce the loose root file the card
  is trying to remove.
- **A stale `--out` invocation is the subtle risk.** Anyone who has scripted
  `npm run refresh -- --root X --out public/data.json` will, after this change, silently
  recreate a root-level `public/data.json` that nothing serves — the board would appear not to
  refresh. Symptom to watch for: the "Data generated" date not moving after a refresh. Phase 2
  verification step 3 explicitly checks that no root `public/` reappears.
- **Rollback:** revert the commits. Git renames revert cleanly and the moved content is
  byte-identical, so there is no repair work and no partially-applied state. The change is
  fully reversible at every phase boundary. Phase 2 alone is a coherent, working state if
  Phases 3–4 are abandoned — only text would be stale.

## Testing strategy

The repo has no test framework, no `test` script and no dependencies, and this plan adds none.
Coverage is therefore mechanical evidence plus targeted manual runs:

- **Automated, Phase 2:** the git rename-detection output and the `shasum` manifest diff
  together are the real test. For a pure relocation, proving byte-identity of every moved file
  is stronger evidence than any behavioural check — it rules out an accidental one-character
  edit that a rendering check would never surface.
- **Integration, Phase 2:** the two npm scripts *are* the integration tests. `npm start` serving
  a rendered board exercises `server.js:7`'s `__dirname` resolution and all three
  document-relative browser references in one shot. `npm run refresh` with no `--out`
  exercises the extractor's `..`-hop. These are the only two path expressions with any risk in
  this change, and each has a one-command check.
- **Regression, Phase 2:** the absent-`data.json` degradation check (step 6) guards the one
  behaviour the card names explicitly that no other step would catch — the page must not
  require a refresh before a start.
- **Manual, Phases 3–4:** read-through against `find src -type f`, plus running the README's
  quick-start commands verbatim.

If WS-1 later introduces a test runner, a smoke test that boots the server and asserts a 200
on `/` and `/data.json` would be worth adding then. Building one for this change alone would
cost more than the change.

## Open questions

None of these block the work — each has a committed default above — but all five are the
user's call, and any answer other than the default changes what gets built or recorded.

1. **Keep the name `public` inside `src/`?** The plan assumes `src/public/`. It is arguably an
   odd name for a folder that is now nested inside source, and `src/web/` or `src/client/`
   would read better. *Recommendation:* keep `public`. Renaming forces edits to `server.js:7`
   and the extractor's line 16 — the two lines whose untouchability is this plan's central
   safety property — in exchange for aesthetics. If WS-1 restructures anyway, rename then,
   with the compiler's output shape already known.

2. **How should the deferred `dist/` work be recorded?** The plan defers it in prose. The
   options are: (a) leave it as prose in this plan; (b) add `depends_on: [WS-1]` to a new
   follow-up workstream for the `dist/` emit layout; (c) fold it into WS-1's own scope, since
   WS-1 has to choose an output directory regardless. *Recommendation:* (c) — the compiler and
   its output directory are one decision, and splitting them across two workstreams guarantees
   they are planned twice. If you prefer it tracked separately, (b).

3. **Does WS-2 become `done` when only the `src/` half ships?** Under recommendation 2(c),
   yes — the `dist/` clause transfers to WS-1 and WS-2 has delivered everything actionable
   today. Under 2(b), WS-2 stays open pending the follow-up. Related: this plan's frontmatter
   carries `links: []` as specified, but `links: [WS-1]` would make the relationship visible
   on the board (WS-2's own workstream record already has `links: [WS-1]`).
   *Recommendation:* mark WS-2 `done` after Phase 4 and let WS-1 carry `dist/`.

4. **Update `index.html`'s footer paths?** The plan assumes yes (Phase 3). The narrower reading
   is that the footer is user-facing prose about *how to refresh*, and the exact folder is
   noise to a viewer who only ever types `npm run refresh`. *Recommendation:* update it — the
   footer names a specific file the reader might go looking for, and a path that does not
   exist is worse than no path.

5. **Commit granularity.** The plan assumes four commits, one per phase, so the Phase 2 rename
   diff stays reviewable in isolation. The alternative is a single squashed commit.
   *Recommendation:* keep Phase 2 separate at minimum — a pure-rename commit is trivially
   verifiable, and mixing string edits into it destroys that property. Phases 3 and 4 could
   reasonably be one commit.
