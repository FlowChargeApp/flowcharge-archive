---
id: PLN-3-xh05c7
type: plan
workstream: WS-1-bacexa
slug: typescript-source-conversion
title: "Convert all three source files to TypeScript with tsc emitting a served dist/ build"
status: done
created: 2026-08-05
updated: 2026-08-05
depends_on: []
links: []
---

# Convert all three source files to TypeScript with tsc emitting a served dist/ build

## Summary

Three files, 547 lines, all ESM, **zero relative imports anywhere** — only `node:` builtins.
That single fact decides the toolchain: there is nothing to bundle, nothing to resolve, and no
module graph to walk. `tsc` alone, emitting readable unbundled JavaScript, is the whole build.

The conversion is:

```
src/server.js                       → src/server.ts                       → dist/server.js
src/scripts/extract-praxis-data.mjs → src/scripts/extract-praxis-data.ts  → dist/scripts/extract-praxis-data.js
src/public/app.js                   → src/public/app.ts                   → dist/public/app.js
src/public/{index.html, styles.css}   copied verbatim                     → dist/public/
src/public/data.json                  seeded if absent                    → dist/public/data.json
```

**`dist/` is created.** WS-2 declined to build it and said so explicitly: it "becomes meaningful
the moment a compiler exists to emit into it — which is WS-1", and its Open Question 2
recommended folding the output-directory decision into this workstream because "the compiler and
its output directory are one decision" (`flowcharge/workstreams/src-dist-build-layout/plan.md`,
lines 47–50 and 392–397). The original request that produced both cards asked that "the built or
compiled version" be "placed in a dist folder". A compiler now exists, so the deferred half lands
here.

The layout trick that made WS-2 safe works a second time, for free. With `rootDir: src` and
`outDir: dist`, the compiled tree mirrors the source tree, so `server.js:7`'s
`path.join(__dirname, 'public')` resolves to `dist/public/`, and the extractor's
`path.join(__dirname, '..', 'public', 'data.json')` resolves to `dist/public/data.json`. **Neither
path expression is edited.** The extractor's default output re-points itself to the served
location purely by being compiled into `dist/scripts/`.

Two things `tsc` cannot do get one small helper each: it does not copy non-TS assets
(`tools/copy-assets.mjs`, ~25 lines), and it cannot share types across two compilations that have
no imports between them (`src/types/praxis-data.d.ts`, a global ambient declaration file included
by both configs). The `.d.ts` is where the conversion actually pays: `data.json`'s shape is `any`
on both the producer and consumer side today, and typing it makes producer/consumer drift a
compile error.

The governing rule everywhere else is **assert, don't coerce** — where the existing code already
assumes a value is present, the TypeScript version asserts it rather than inserting a fallback,
because a fallback is a runtime behaviour change and behaviour preservation is a hard requirement
of this card.

## Scope

### Acceptance criteria

1. `src/` contains no `.js` or `.mjs` file. It contains `src/server.ts`,
   `src/scripts/extract-praxis-data.ts`, `src/public/app.ts`, `src/types/praxis-data.d.ts`, plus
   the unchanged assets `src/public/index.html`, `src/public/styles.css`, `src/public/data.json`.
2. `npm run build` from the repo root produces `dist/server.js`,
   `dist/scripts/extract-praxis-data.js`, `dist/public/app.js`, `dist/public/index.html`,
   `dist/public/styles.css`, `dist/public/data.json` — and exits non-zero, emitting nothing new,
   if any file has a type error (`noEmitOnError`).
3. `npm start` is still a single command from the repo root and serves the board at
   `http://localhost:4173`. It builds first via `prestart`. The rendered page is visually
   identical to the pre-conversion board: masthead, KPI strip with coloured bars, all six
   columns, both lower panels with the severity bar in colour. Browser console clean;
   `styles.css`, `app.js`, `data.json` all HTTP 200 with correct `Content-Type`.
4. `npm run refresh -- --root <dir>` is still a single command, still accepts `--root`, `--out`
   and `--help` with unchanged semantics, and with no `--out` writes to `dist/public/data.json` —
   the file `npm start` serves. Reloading the page shows the new "Data generated" date.
5. `npm run refresh -- --root <dir> --out <path>` still resolves `<path>` against the process cwd
   (`path.resolve` at the extractor's line 162, unchanged).
6. `data.json` written by the compiled extractor is **byte-identical** to the output of the
   pre-conversion `.mjs` extractor run against the same `--root`. The payload's content and
   format do not change.
7. `dist/public/app.js` is a classic script — no `import`, `export`, `require`, or module
   wrapper — loaded by the unchanged `<script src="app.js">` at `index.html:75`. `index.html`
   needs no functional edit at any point in this plan.
8. With `dist/public/data.json` absent, the page still shows the graceful "Couldn't load
   data.json" panel with refresh instructions — not a blank page, not an uncaught error.
   `npm start` never requires a refresh first.
9. A fresh clone followed by `npm install && npm start` shows a **populated** board, from the
   committed `src/public/data.json` snapshot seeded into `dist/public/`.
10. `dist/` is listed in `.gitignore` and no file under `dist/` is tracked.
    `package-lock.json` **is** committed.
11. The `praxis-dashboard` configuration in `.claude/launch.json` starts the server through
    `npm start`, so the build hook fires, and the preview reaches a working board.
12. `engines.node` remains `>=18`.
13. Exactly two devDependencies exist: `typescript` and `@types/node`. No runtime dependency, no
    bundler, no linter, no test framework.
14. No file's path-computing expression differs from its pre-conversion version —
    specifically `server.ts`'s `path.join(__dirname, 'public')` and the extractor's
    `path.join(__dirname, '..', 'public', 'data.json')` are untouched.
15. Every path named in `README.md`, `index.html`'s footer, and the extractor's `usage()` output
    exists on disk after a build, and every command printed by `--help` runs as written.

### Out of scope

- **A test framework, a linter, or a formatter.** None exists, none is requested. `tsc` is the
  only checker this plan introduces.
- **Changing `data.json`'s content or schema.** `src/types/praxis-data.d.ts` describes the shape
  the extractor produces *today*, derived from its existing code. It adds no field, removes none,
  and tightens nothing.
- **Runtime validation of `data.json`.** The shared types are a compile-time contract on both
  sides. Adding a runtime schema check would change what happens on malformed input — a
  behaviour change. Recorded as Open Question 4.
- **Any UI or feature change to `app.ts`.** The DOM structure, event wiring, sort/filter logic,
  and rendered output are identical. Typing changes how the file is checked, not what it does.
- **Converting `app.ts` to an ES module** (`type="module"` on the script tag, `import`/`export`).
  It has no imports to justify it, and doing so would break the "classic script, same filename,
  no HTML edit" property that makes this conversion nearly invisible.
- **Bundling or minifying anything.** Three files, zero imports.
- **Re-touching WS-2's `src/` relocation**, and **WS-4's completed CSS work**. `styles.css` is
  copied verbatim and never opened.
- **Restructuring, splitting, or renaming beyond the extension changes**, and no
  `src/server/` + `src/client/` reorganisation.
- **`server.ts`'s traversal guard, MIME table, port handling, and cache headers** — carried over
  unchanged; `root` is still derived from `__dirname`, so the guard's semantics are identical.

### Assumptions

Settled without the user present. Each is a judgement call, not a requirement in the card.

1. **No deployment or release constraints apply.** This is a local-only developer dashboard on
   `localhost:4173` with no production deployment, no live users, no persisted user data and
   nothing to migrate. So: no feature flag, no dark launch, no staged rollout. Phases are
   ordinary commits on a branch and rollback is `git revert`. Recorded as Open Question 5,
   which is the question I would have asked.
2. **`npm install` becomes a prerequisite, and that is acceptable.** The repo goes from
   zero-install to two devDependencies. This is unavoidable — TypeScript *is* a dependency — but
   it does retire the README's "no npm dependencies" claim, which Phase 5 rewrites.
3. **`strict: true`.** Converting to TypeScript without `strictNullChecks` would deliver
   annotations without safety. The friction it creates is mechanical and enumerated in Design.
4. **`noUncheckedIndexedAccess` stays OFF.** It would make every array and record index
   `T | undefined`, forcing churn on `a.id.split('-')[1]`, `m[1]`, `mm[2]`, `idm[3]` and every
   `STATUS_LABEL[s]` read, for no behaviour gain in a file whose indices are all known-good.
5. **The committed `src/public/data.json` snapshot survives as a build-time seed** rather than
   being deleted or being copied unconditionally. This is the load-bearing decision; the full
   trade-off and the two rejected alternatives are in Design → *The `data.json` three-way
   conflict*.
6. **`npm run build` does not wipe `dist/`.** Wiping would delete a refreshed
   `dist/public/data.json` on every `npm start`, which is exactly the silent-stale failure this
   plan is trying to avoid. Consequence: if a source file is ever renamed or deleted, its old
   output lingers in `dist/` until a manual `rm -rf dist`. With six files and no renames planned
   after this workstream, that is an acceptable trade. No `clean` script is added (Open
   Question 3).
7. **`.claude/launch.json` is in scope**, on the same reasoning WS-2 used: it names the server
   from outside the source tree and the card's preservation list depends on it working.
8. **Human-facing path strings inside the extractor and `index.html` are updated** (Phase 5).
   Leaving `--help` printing a path that no longer exists would be a new inaccuracy.

## Design

### Approaches weighed and rejected

**(a) `tsc` alone, `outDir: dist` — CHOSEN.** Two devDependencies. Emits readable, unbundled,
unminified JavaScript that reads like the hand-written source it replaces, which matches this
repo's whole character ("no build step, no framework" was a stated virtue). Needs two compiler
configurations, because `app.ts` requires `lib: ["dom"]` and must NOT see `@types/node`, while
the other two require the opposite — but with zero imports between the two halves, two
independent compilations are the honest model of the situation, not a workaround. Needs an
asset-copy step, which is a real cost, paid once in ~25 lines.

**(b) esbuild or Vite — rejected.** Both would handle asset copying and bundling in one tool, and
for a codebase with a module graph that would win. This codebase has no module graph: three
files, zero relative imports, a 333-line browser file that is already a single IIFE. There is
nothing to bundle. Worse, esbuild strips types without checking them, so `typescript` stays a
devDependency for `tsc --noEmit` regardless — **more** dependencies than (a), not fewer, to
obtain a feature with no work to do. Vite additionally pulls 100+ transitive packages into a repo
that currently has zero. Straight YAGNI, and a direct contradiction of the project's stated
no-framework character.

**(c) Native Node type-stripping for the two server-side files — rejected, and it was the
closest call.** Its appeal is real: no emit step for `server.ts` and the extractor, run the
`.ts` files directly. Three specific costs sink it. First, type stripping does not type-check, so
`typescript` remains a devDependency plus a `tsc --noEmit` script — it reduces the dependency
count by zero, which was its main selling point. Second, it is unflagged only from Node 22.18 /
23.6, forcing `engines` from `>=18` to `>=22.18` — a real narrowing for a tool whose only virtue
is running anywhere. Third and decisive: `app.ts` can *never* be type-stripped, because a browser
cannot execute TypeScript, so it must compile into `dist/public/`. That leaves the server running
from `src/` while serving a root under `dist/` — meaning either the compiler emits build output
back into the source tree (precisely what WS-2 worked to avoid), or `server.ts` grows a second
root and a fallback. Paying an `engines` bump to acquire an asymmetry is a bad trade. Rejected on
its specifics, not on principle.

### Target layout

```
Praxis-Dashboard/
├── package.json                  devDeps + build/prestart/start/prerefresh/refresh
├── package-lock.json             committed
├── tsconfig.json                 Node side: server.ts + extractor
├── .gitignore                    += dist/
├── .claude/launch.json           runtimeExecutable "npm", runtimeArgs ["start"]
├── tools/
│   └── copy-assets.mjs           plain ESM; cannot be TS (bootstrapping)
├── src/
│   ├── server.ts
│   ├── scripts/
│   │   └── extract-praxis-data.ts
│   ├── types/
│   │   └── praxis-data.d.ts      global ambient interfaces; emits nothing
│   └── public/
│       ├── tsconfig.json         browser side: app.ts
│       ├── app.ts
│       ├── index.html            asset, copied verbatim
│       ├── styles.css            asset, copied verbatim
│       └── data.json             committed snapshot, seeds dist/ when absent
└── dist/                         gitignored, generated
    ├── server.js
    ├── scripts/extract-praxis-data.js
    └── public/{app.js, index.html, styles.css, data.json}
```

### The two compiler configurations

They are two files rather than one because `app.ts` and the Node files need mutually exclusive
`lib` and `types` settings. They are **co-located with what they govern** — root for the Node
side, `src/public/` for the browser side — so that an editor's TypeScript server resolves each
file to its correct project by the ordinary nearest-tsconfig rule, with no project references, no
`composite`, no `.tsbuildinfo`, and no duplicated options.

`tsconfig.json` (repo root, Node side):

```jsonc
{
  "compilerOptions": {
    "target": "es2022",
    "lib": ["es2022"],
    "module": "node16",
    "moduleResolution": "node16",
    "esModuleInterop": true,     // keeps `import http from 'node:http'` compiling unchanged
    "types": ["node"],
    "rootDir": "src",
    "outDir": "dist",
    "strict": true,
    "noEmitOnError": true,
    "skipLibCheck": true
  },
  "include": ["src/server.ts", "src/scripts/**/*.ts", "src/types/**/*.d.ts"]
}
```

`module: "node16"` is what makes `import.meta.url` legal and what makes the emitted `dist/*.js`
ESM — correct, because the root `package.json` carries `"type": "module"` and `dist/` inherits it.
`esModuleInterop` exists specifically to keep the three existing default imports (`http`, `fs`,
`path`) valid against `@types/node` without rewriting them to namespace imports.

`src/public/tsconfig.json` (browser side):

```jsonc
{
  "compilerOptions": {
    "target": "es2020",
    "lib": ["dom", "es2020"],
    "module": "none",            // guarantees a classic script; an added import becomes an error
    "types": [],                 // load-bearing: without it tsc auto-includes @types/node
    "rootDir": "..",             // = src/, so output lands at dist/public/app.js
    "outDir": "../../dist",
    "strict": true,
    "noEmitOnError": true,
    "skipLibCheck": true
  },
  "include": ["app.ts", "../types/praxis-data.d.ts"]
}
```

`"types": []` is the single most important line here: `tsc` auto-includes every package under
`node_modules/@types` unless told otherwise, which would give the browser file Node globals it
must never see. `module: "none"` is belt-and-braces — `app.ts` has no imports, so the emit is a
plain script either way, but `none` turns a future accidental `import` into a compile error
rather than a silently emitted module wrapper that a classic `<script>` tag cannot run. If a TS
5.x check rejects `none` in combination with these options, `"module": "es2020"` is the fallback,
verified by grepping the emitted `dist/public/app.js` for `import`/`export` (there are none to
emit).

`app.ts` keeps its `var`/`function` style verbatim; at `target: es2020` the emitted JavaScript is
the input minus type annotations, which is what makes the parity diff in Testing meaningful.

### The shared data contract — `src/types/praxis-data.d.ts`

The extractor writes `data.json`; `app.ts` reads it; neither imports the other, and neither can
without turning `app.ts` into a module. An **ambient declaration file** — a `.d.ts` with no
top-level `import` or `export`, whose interfaces are therefore global to every file in the
program — is the exact tool for this. Both configs `include` it, `.d.ts` files emit nothing, so
`dist/` is unaffected and `app.ts` stays a classic script.

The interfaces are transcribed from what the extractor writes today
(`extract-praxis-data.mjs:89–93`, `104–111`, `116–128`, `155–160`) — nothing invented:

```ts
interface PraxisArtefact {
  id: string;
  type: string;
  status: string;
  updated: string;
  total?: number;   // present only for issuelist/tasklist (line 92)
  done?: number;    // ditto (line 93)
}

interface PraxisWorkstream {
  id: string;
  slug: string;
  title: string;
  status: string;
  tags: string[];
  created: string;
  updated: string;
  depends_on: string[];
  body: string;
  archived: boolean;
  artefacts: PraxisArtefact[];
}

interface PraxisIssue {
  id: string;
  title: string;
  checked: boolean;
  severity: string | null;   // line 108
  status: string | null;     // line 109
  workstream: string;
}

interface PraxisData {
  generated: string;
  source: string;
  workstreams: PraxisWorkstream[];
  issues: PraxisIssue[];
}
```

Producer side: `const payload: PraxisData = { ... }` and `issuesAccumulator: PraxisIssue[]` (which
also fixes the `never[]` inference on the bare `[]` at line 133). Consumer side:
`function boot(raw: PraxisData)`. `Response.json()` returns `any`, so `.then(boot)` type-checks
with no cast at the call site.

**What this catches and what it does not.** It catches structural drift: rename `depends_on` in
the extractor and `app.ts` stops compiling; add a field to the payload without declaring it and
the build fails. It does **not** validate the actual file at runtime — a hand-edited or
half-written `data.json` produces exactly the same failure it produces today. That is deliberate:
runtime validation would change behaviour, and behaviour preservation is a hard requirement here.
See Open Question 4.

### Assert, don't coerce

The single rule governing every place `strict` surfaces friction. Where the existing code already
assumes a value is present, the TypeScript version **asserts** it (`!`, `as`) and never inserts a
fallback, because a fallback changes what happens at runtime. Complete list of assertion sites:

| Site | Why | Form |
|---|---|---|
| `server.ts` `req.url` (line 20) | `string \| undefined` under `@types/node`; always populated for `http.createServer` requests. Today an undefined value throws; `?? '/'` would silently serve index.html instead — a behaviour change | `req.url!` with a one-line comment |
| `app.ts` — 16 `document.getElementById` sites | Today a missing element throws `TypeError`. A helper preserves that exactly and keeps the diff to one line per site | `function byId(id: string): HTMLElement { return document.getElementById(id)!; }` |
| `app.ts` lines 313, 320, 327 — `e.target` | `EventTarget` has no `.closest` or `.value` | `(e.target as HTMLElement).closest('button')`, `(e.target as HTMLInputElement).value` |
| extractor — scalar frontmatter reads (`fm.id`, `fm.type`, `wsFm.title`, …) | `parseFrontmatter` returns `Record<string, string \| string[]>`; the code already assumes scalars for these keys | one helper, `function fmStr(v: string \| string[] \| undefined): string { return v as string; }` |

Annotations, not assertions, fix the rest:

- `MIME` (`server.ts:10`) and `artefactTypeLabel`'s inline map (`app.ts:213`), `STATUS_LABEL`,
  `SEV_LABEL`, `wsByStatus`, `sevCounts`, `counts`, `byStatus` → explicit `Record<string, …>`
  so string indexing is legal.
- `parseArgs` → an `Args` interface (`{ root?: string; out: string; help?: boolean }`), since
  properties are assigned incrementally.
- `sortKey` / `sortDir` are declared `string | undefined` rather than given a `?? 'id'` fallback,
  because `btn.dataset.key` is `string | undefined` and a fallback would change which sort a
  data-attribute-less button produces. Widening the declared type is free; coercing the value is
  not.
- `tags` and `depends_on` need nothing: the existing `Array.isArray(...) ? ... : (... ? [...] : [])`
  ternaries at extractor lines 121 and 124 narrow to `string[]` on their own.

**One guard is added, and it is provably equivalent.** At `app.ts:108` and `app.ts:179`,
`sevCounts[i.severity]` indexes with `string | null`, which TypeScript rejects outright. The fix
is `i.severity != null && sevCounts[i.severity] != null`. At runtime today, a null severity
becomes the key `"null"`, which is absent from the record, so the `!= null` test already fails and
no counter increments. The guard reaches the same outcome one step earlier. This is the only new
conditional in the entire conversion.

### The `data.json` three-way conflict

`src/public/data.json` is a committed 275KB generated snapshot that makes the README's "works out
of the box" promise true, and WS-2 made preserving it acceptance criterion 10. Under a `dist/`
layout the served copy lives at `dist/public/data.json`, which is gitignored. Three options, none
free:

**Rejected — drop the snapshot, extractor writes straight to `dist/public/data.json`.** The
cleanest separation: `src/` becomes purely hand-written, the generated file lives only in the
generated folder, the asset copy shrinks to two files, and the extractor needs no change at all
(compiling it into `dist/scripts/` re-points its default output for free). Rejected because it
deletes a documented, advertised capability — a fresh clone would show the empty-state panel
instead of a populated board — and WS-2 treated that promise as important enough to make it a
numbered acceptance criterion. Trading a working demo for a tidier tree is the wrong direction.

**Rejected — keep the snapshot and copy it into `dist/public/` unconditionally on every build.**
This is the naive form, and it is actively dangerous: `prestart` runs `build` before every
`npm start`, so the copy would overwrite a freshly refreshed `dist/public/data.json` with the
frozen demo snapshot and the board would silently show stale data. That is the exact
stale-`dist` failure mode WS-2 named as its reason for declining to build a passthrough `dist/`.

**Chosen — keep the snapshot committed at `src/public/data.json`; the build copies it into
`dist/public/data.json` only when that file does not already exist.** One `existsSync` check in
`tools/copy-assets.mjs`. Refresh writes directly to the served location and is never clobbered;
a fresh clone gets a populated board; `dist/` stays gitignored. The costs I am accepting, stated
plainly:

- `src/public/data.json` is now a *seed fixture*, not the live artefact. After the first build it
  never changes again, and someone inspecting it after `npm run refresh` will find it unchanged.
  Mitigated by a comment in `copy-assets.mjs` and a line in the README; a rename is Open Question 2.
- `rm -rf dist` discards refreshed data and the next build reseeds the demo snapshot. Expected
  given the design, but worth knowing before it surprises someone.
- A generated file remains committed inside `src/`. This wart is inherited from WS-2, which
  called it out as a knowing compromise; this plan does not deepen it.

### The build

```jsonc
// package.json
"engines": { "node": ">=18" },
"scripts": {
  "build":      "tsc -p tsconfig.json && tsc -p src/public/tsconfig.json && node tools/copy-assets.mjs",
  "prestart":   "npm run build",
  "start":      "node dist/server.js",
  "prerefresh": "npm run build",
  "refresh":    "node dist/scripts/extract-praxis-data.js"
},
"devDependencies": { "typescript": "^5", "@types/node": "^22" }
```

`npm start` and `npm run refresh` remain single commands, which the card requires. npm runs
`pre<script>` before any script of that name, so both build first. `tsc` exits non-zero on a type
error, so the `&&` chain stops; `noEmitOnError` additionally prevents writing partial output.
`npm run refresh -- --root X` appends the flags to the `refresh` command only, which is correct —
`prerefresh` neither needs nor receives them. **No separate `typecheck` script**: `build` already
type-checks, and a second entry point for the same work is duplication.

`tools/copy-assets.mjs` — the only new file with logic, and its contract is four lines:

1. ensure `dist/public/` exists;
2. copy `src/public/index.html` and `src/public/styles.css` → `dist/public/`, overwriting;
3. copy `src/public/data.json` → `dist/public/data.json` **only if the destination is absent**;
4. log each action, including whether `data.json` was seeded or skipped.

It resolves every path from its own `import.meta.url`, matching the cwd-independence convention
the repo already uses at `server.js:6-7` and `extract-praxis-data.mjs:13`. It stays **plain ESM
JavaScript and is not converted**, for one reason: it has to run before any compilation exists,
and compiling the build script with the build script is circular. It lives in `tools/` rather
than `src/` precisely because `src/` now means "compiled application source", and rather than the
repo root because WS-2 spent a workstream clearing loose files out of there.

### Wiring outside the source tree

`.claude/launch.json` currently runs `node src/server.js` directly, bypassing npm — so an npm
`prestart` hook would **not** fire for it. Two fixes were available; this plan changes
`runtimeExecutable` to `"npm"` and `runtimeArgs` to `["start"]`. Pointing `runtimeArgs` at
`dist/server.js` instead would preserve the current shape but reintroduce the failure WS-2
warned about: a preview that silently serves stale or missing output when someone forgets to
build. Routing through `npm start` makes the launch config and the terminal use one entry point
with one guarantee, for one line of change. `"npm"` as `runtimeExecutable` is the documented
form for this config file.

### What each new piece knows about

- `tools/copy-assets.mjs` knows file paths and nothing else. No knowledge of TypeScript, of the
  server, or of `data.json`'s contents — it must never learn to generate, merge, or inspect data.
- `src/types/praxis-data.d.ts` knows the payload's shape and nothing about how either side uses
  it. No DOM types, no Node types, no functions, no runtime code — if it ever needs an `import`,
  the design has gone wrong.
- `src/public/app.ts` still knows only the DOM and `PraxisData`. It gains no knowledge of Node, of
  the extractor, or of the filesystem; `"types": []` enforces this mechanically rather than by
  discipline.

## Staged task breakdown

Five phases, strictly ordered. Every phase ends with `npm start` serving a working board.
Phases 1 and 2 carry all the structural risk; 3 and 4 are conversion; 5 is text.

### Phase 1 — Stand up the toolchain and move the server into `dist/` (medium)

**Build:**

1. `npm install --save-dev typescript @types/node`; commit `package-lock.json`. Add `dist/` to
   `.gitignore`.
2. Add root `tsconfig.json` exactly as specified in Design (its `include` may name
   `src/scripts/**/*.ts` now even though nothing matches yet).
3. `git mv src/server.js src/server.ts`. Add: `MIME: Record<string, string>`, `req.url!` with its
   comment. Change no path expression.
4. Add `tools/copy-assets.mjs` per its four-line contract, **plus a fourth copy entry for
   `src/public/app.js`** — during Phases 1–3 the browser file is still plain JavaScript and
   travels as an asset. `data.json` uses the seed-if-absent rule from the start.
5. `package.json`: add `build` (Node config + copy-assets only for now), `prestart`, and change
   `start` to `node dist/server.js`. Leave `refresh` pointing at the `.mjs` extractor.
6. `.claude/launch.json` → `runtimeExecutable: "npm"`, `runtimeArgs: ["start"]`.

**Note on this phase's transient state:** `npm run refresh` still writes to `src/public/data.json`
while the board serves `dist/public/data.json`, which the seed rule will not overwrite. This is
the one phase boundary where a refresh does not reach the board. It closes in Phase 2, one commit
later, and it is preferable to the alternative of writing the seed logic one way here and
rewriting it in Phase 2.

**Files touched:** `package.json`, `package-lock.json`, `.gitignore`, `tsconfig.json`,
`tools/copy-assets.mjs`, `src/server.js` → `src/server.ts`, `.claude/launch.json`.

**Depends on:** nothing.

**Verify:**

1. `npm run build` creates `dist/server.js`, `dist/public/{index.html,styles.css,app.js,data.json}`.
2. `diff dist/server.js <(git show HEAD~1:src/server.js)` — differences confined to the removed
   type annotations and the `!` on `req.url`. Nothing else moved.
3. `npm start` serves the board at `:4173`, rendering as before; `styles.css`, `app.js`,
   `data.json` all 200; console clean. This proves `dist/server.js`'s `__dirname/public` resolves
   without asserting anything about it.
4. Fresh-clone simulation: `rm -rf dist && npm start` → populated board from the seeded snapshot.
5. Graceful degradation: `rm dist/public/data.json`, hard-reload → "Couldn't load data.json"
   panel. Then `npm start` again and confirm the seed restores it.
6. Seed is not clobbered: `touch`-modify `dist/public/data.json`, run `npm run build`, confirm the
   file is untouched and the log says it skipped the seed.
7. Introduce a deliberate type error in `server.ts`; `npm run build` exits non-zero and
   `dist/server.js` is not rewritten. Revert.
8. Launch the `praxis-dashboard` config from `.claude/launch.json` and confirm the preview builds
   and reaches a working board.
9. `git status` shows no `dist/` entry.

### Phase 2 — Convert the extractor and re-point refresh (medium)

**Build:**

1. `git mv src/scripts/extract-praxis-data.mjs src/scripts/extract-praxis-data.ts`.
2. Add the `Args` interface for `parseArgs`; type `parseFrontmatter` as returning
   `Record<string, string | string[]>`; add the `fmStr` helper and apply it at each scalar
   frontmatter read; give `issuesAccumulator` an explicit element type (`any[]` for now — it
   becomes `PraxisIssue[]` in Phase 3); type `entry` so the conditional `total`/`done` assignments
   are legal. **Do not touch** `path.join(__dirname, '..', 'public', 'data.json')` or
   `path.resolve(args.out)`.
3. Confirm `tsc` preserved the `#!/usr/bin/env node` shebang in `dist/scripts/extract-praxis-data.js`.
4. `package.json`: `refresh` → `node dist/scripts/extract-praxis-data.js`; add `prerefresh`.

**Files touched:** `src/scripts/extract-praxis-data.mjs` → `.ts`, `package.json`.

**Depends on:** Phase 1.

**Verify:**

1. **Output parity, the decisive check.** Before converting, run the `.mjs` extractor against a
   known root with `--out /tmp/before.json`. After converting, run the compiled one with
   `--out /tmp/after.json`. `diff /tmp/before.json /tmp/after.json` is empty. Delete both.
2. `npm run refresh -- --root <dir>` with no `--out` writes `dist/public/data.json`; the printed
   `outPath` ends `/dist/public/data.json`; reloading the page shows the new "Data generated"
   date. This closes Phase 1's transient gap.
3. Immediately run `npm start`. The board still shows the **refreshed** date, not the demo
   snapshot — proving the seed rule did not clobber it. This is the single most important check
   in the plan.
4. `npm run refresh -- --root . --out /tmp/probe.json` writes `/tmp/probe.json` and leaves
   `dist/public/data.json` alone. Delete the probe.
5. cwd-independence: run `node /abs/path/dist/scripts/extract-praxis-data.js --root /abs/path`
   from `/` and confirm it still targets `dist/public/data.json`.
6. `head -1 dist/scripts/extract-praxis-data.js` is the shebang.
7. `npm run refresh -- --help` exits 0 and prints usage; no `--root` exits 1.

### Phase 3 — Introduce the shared data contract on the producer side (small)

**Build:**

1. Add `src/types/praxis-data.d.ts` with the four interfaces exactly as specified in Design, and
   verify it contains no top-level `import` or `export`.
2. Root `tsconfig.json` already includes `src/types/**/*.d.ts`.
3. In the extractor: `const payload: PraxisData = { ... }`,
   `let issuesAccumulator: PraxisIssue[] = []`, and type `walkWorkstreams`'s return as
   `PraxisWorkstream[]` and `entry` as `PraxisArtefact`.

**Files touched:** `src/types/praxis-data.d.ts` (new), `src/scripts/extract-praxis-data.ts`.

**Depends on:** Phase 2.

**Verify:**

1. `npm run build` passes with no cast at the `payload` assignment beyond the `fmStr` sites
   already introduced — if one is needed somewhere new, the interface is wrong for the real
   output and should be corrected to match the code, never the reverse.
2. Re-run the Phase 2 step 1 parity diff. Still empty — types changed nothing at runtime.
3. Drift check: temporarily rename `depends_on` to `dependsOn` in the interface;
   `npm run build` fails on the extractor. Revert.
4. `ls dist/types` does not exist — `.d.ts` emits nothing.

### Phase 4 — Convert the browser file and close the contract (medium)

**Build:**

1. Add `src/public/tsconfig.json` exactly as specified in Design.
2. `git mv src/public/app.js src/public/app.ts`.
3. Add the `byId` helper and replace all 16 `document.getElementById(...)` call sites.
4. Apply the annotations and casts listed in Design: `el`'s signature, the four
   `Record<string, …>` maps, the three `e.target` casts, `sortKey`/`sortDir` widened to
   `string | undefined`, and the two `i.severity != null` guards.
5. `function boot(raw: PraxisData)`.
6. Remove `src/public/app.js` from `tools/copy-assets.mjs`'s copy list.
7. `package.json`: `build` gains `tsc -p src/public/tsconfig.json`.
8. `index.html` is not edited. The compiled output is `dist/public/app.js`, the same filename the
   existing `<script src="app.js">` already loads.

**Files touched:** `src/public/tsconfig.json` (new), `src/public/app.js` → `.ts`,
`tools/copy-assets.mjs`, `package.json`.

**Depends on:** Phase 3.

**Verify:**

1. **Emit parity.** `diff dist/public/app.js <(git show HEAD~1:src/public/app.js)` — the only
   differences are the `byId` helper and its call sites, the erased annotations and casts, and
   the two `severity != null` guards. Anything else in that diff is an unintended change and must
   be reverted.
2. `grep -E '^\s*(import|export|require)' dist/public/app.js` returns nothing — it is a classic
   script.
3. `grep -c 'window\|process' dist/public/app.js` shows no Node globals leaked in; the build would
   have failed first, since `"types": []` denies `app.ts` any Node types.
4. Full behavioural pass in the browser against the pre-conversion capture: KPI strip values and
   bar segments identical, all six columns with the same card counts, both sort toggles, both
   direction toggles, the search box filtering and the result count updating, the severity legend
   and the attention panel. Console clean.
5. Graceful degradation once more: `rm dist/public/data.json`, hard-reload, panel appears.
6. Drift check both ways: add a field to `PraxisData` without producing it → the extractor still
   compiles but reading it in `app.ts` is now legal against a field that does not exist at
   runtime, so instead rename `generated` in the interface and confirm **both** compilations fail.
   Revert.

### Phase 5 — Update the documentation and the stale path strings (small)

**Build:**

1. `README.md`: quick start becomes `npm install` → `npm run refresh -- --root <dir>` →
   `npm start`; the directory tree shows `src/`, `tools/`, and a generated `dist/`; the Scripts
   table gains `npm run build` and re-points the other two at `dist/`; the snapshot sentence
   explains that `src/public/data.json` seeds `dist/public/data.json` on first build. **The "No
   build step, no framework, no npm dependencies" note at line 53 becomes false and must be
   rewritten** — the accurate replacement is that there is a TypeScript compile step, two
   devDependencies, no runtime dependency, no framework and no bundler.
2. `src/public/index.html:69`: footer names `dist/public/data.json` and
   `src/scripts/extract-praxis-data.ts`.
3. `src/scripts/extract-praxis-data.ts`: header comment (lines 2, 7), `usage()` invocation line
   and the `--out` default description → `npm run refresh -- --root <dir>` and
   `dist/public/data.json`.

**Files touched:** `README.md`, `src/public/index.html`, `src/scripts/extract-praxis-data.ts`.

**Depends on:** Phase 4.

**Verify:** `npm run refresh -- --help` prints a command that runs verbatim when copy-pasted, and
names a default output path that exists after a build. The README's three quick-start commands
run as written from a fresh clone. Every path in the README exists after `npm run build`
(`find src tools dist -type f` matches the tree). Reload the page and read the footer — it names
files that exist. `grep -rn "\.mjs" README.md src/ index.html` returns only `tools/copy-assets.mjs`.

## Data & compatibility

- **Migrations:** none. No schema, no persisted state. `data.json`'s content and format are
  unchanged and Phase 2 verification step 1 proves it byte-for-byte.
- **The one genuinely new requirement: `npm install`.** The repo goes from zero-install to two
  devDependencies, so a fresh clone must install before `npm start` works. Without
  `node_modules`, `prestart` fails on a missing `tsc` with a moderately opaque npm error. This is
  intrinsic to the feature — TypeScript is a dependency — and is handled by documentation
  (Phase 5), not by machinery.
- **Breaking:** `node src/server.js` and `node src/scripts/extract-praxis-data.mjs` typed from
  muscle memory now fail — the files no longer exist under those names. This is the same class of
  break WS-2 accepted for the same reason: `npm start` and `npm run refresh` exist precisely to
  insulate against it. No compatibility shim is planned.
- **Also breaking, quietly:** anyone who scripted
  `npm run refresh -- --out src/public/data.json` will now overwrite the committed seed instead of
  the served file, and the board will appear not to refresh. Symptom: the "Data generated" date
  does not move. Same failure mode WS-2 flagged for `--out public/data.json`, one directory over.
- **Not breaking:** `--root`, `--out`, `--help`, the payload shape, the DOM structure, the served
  URLs, the port and its `PORT` override, the MIME table, and the traversal guard.
- **Rollback:** `git revert` the phase commits. `dist/` is gitignored and disposable;
  `rm -rf dist node_modules package-lock.json` returns the repo to a pure-JavaScript,
  zero-install state with nothing to repair. Every phase boundary is a coherent working state —
  stopping after Phase 2 leaves a TypeScript Node side and a plain-JavaScript browser file, which
  runs correctly; stopping after Phase 4 leaves only stale prose.

## Testing strategy

No test framework exists, none is being added, and for this change none is the right answer —
every phase's real evidence is either mechanical or a one-command run.

- **The compiler is the unit test.** `strict` plus `noEmitOnError` means the build itself is the
  check, and it is the only new checking machinery this plan introduces.
- **Emit-parity diffs are the regression test, and they are the strongest evidence available**
  (Phase 1 step 2, Phase 4 step 1). For a conversion whose entire promise is "behaviour is
  identical", diffing the emitted JavaScript against the original source proves it directly, in a
  way no behavioural check could — an accidental one-character logic edit shows up immediately
  rather than hiding behind a board that happens to still render.
- **Output parity is the extractor's integration test** (Phase 2 step 1). A byte-identical
  `data.json` from the same `--root` covers the whole file — every regex, every frontmatter read,
  every accumulator — in one command. It is worth capturing `/tmp/before.json` before Phase 2
  starts, because it cannot be regenerated afterwards.
- **The two npm scripts are the end-to-end tests.** `npm start` rendering a board exercises the
  `dist/` layout, the `__dirname` algebra, the asset copy and all three document-relative browser
  references at once. `npm run refresh` with no `--out` exercises the extractor's `..` hop into
  the new tree.
- **Two behaviours get an explicit check every phase because nothing else would catch them:**
  the absent-`data.json` degradation panel, and the seed-not-clobbering-refreshed-data rule
  (Phase 2 step 3).
- **The browser file gets a manual pass** (Phase 4 step 4) against a capture taken before Phase 4
  begins. 333 lines of DOM construction with no test runner leaves no better option, and the emit
  diff already carries most of the weight.

If a future workstream adds a test runner, the obvious first tests are a server smoke test (200
on `/` and `/data.json`) and a fixture-based extractor test — both cheap once a runner exists,
both more expensive than this entire change if built for it alone.

## Open questions

None block the work — each has a committed default above — but all five are the user's call.

1. **Two co-located tsconfigs, or project references?** The plan uses `tsconfig.json` at the root
   and `src/public/tsconfig.json`, relying on the nearest-tsconfig rule so editors resolve each
   file to the right project with no extra machinery. The alternative is a root config with
   `references` to two `composite` projects and `tsc -b`, which is the textbook answer to the
   two-runtime problem but adds `declaration` emit, `.tsbuildinfo` files and a third config file.
   *Recommendation:* keep the two co-located configs. Revisit only if editor resolution
   misbehaves in practice — for three files, project references is machinery bought on
   speculation.

2. **Rename `src/public/data.json` to signal it is a seed?** After this change it is a fixture
   that seeds `dist/public/data.json` and is never written again, but it still carries the live
   artefact's name, which will mislead anyone who greps for it. `data.seed.json` or
   `data.sample.json` would be honest. *Recommendation:* keep the name. Renaming makes the copy
   step special-case a filename instead of copying `src/public/*`, and the README plus a comment
   in `copy-assets.mjs` cover the confusion at lower cost. Pure naming; no design consequence
   either way.

3. **Add a `clean` script?** The plan deliberately does not wipe `dist/` during a build, so stale
   output can only appear after a source file is renamed or deleted. A `"clean": "rm -rf dist"`
   script would handle that, but it also silently discards refreshed data and reseeds the demo
   snapshot on the next build. *Recommendation:* no script; document `rm -rf dist` in the README
   with that caveat attached. Adding a one-word command that quietly resets the board's data is a
   POLA trap.

4. **Should a later workstream add runtime validation of `data.json`?** The shared `.d.ts` is a
   compile-time contract only; a malformed or half-written file fails exactly as it does today.
   *Recommendation:* yes, but separately — it is a behaviour change (the card forbids those here)
   and it needs its own decision about what "invalid" should do: refuse to render, render
   partially, or surface a second empty-state panel.

5. **Deployment and release constraints — the question I would have asked.** The plan assumes
   there is no production deployment, no live user, no data to migrate and no rollback window to
   respect, on the evidence that this is a `localhost:4173` read-only dashboard with
   `"private": true` and no publish step. If any of that is wrong — if this is served somewhere,
   or if someone else clones it on a schedule — the `npm install` prerequisite and the
   `dist/`-is-gitignored decision both need revisiting before Phase 1.
