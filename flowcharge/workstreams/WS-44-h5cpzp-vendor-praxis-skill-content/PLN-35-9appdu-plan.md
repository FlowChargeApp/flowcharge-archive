---
id: PLN-35-9appdu
type: plan
workstream: WS-44-h5cpzp
slug: vendor-praxis-skill-content
title: "Vendor the Praxis skill suite and implement the real getInstallContent reader"
status: dropped
created: 2026-08-18
updated: 2026-08-20
depends_on: []
links: []
---

## Summary

Add a hand-run sync script that copies the whole `prx-*` skill suite from the sibling
`/Users/akoukoullis/Work/AK/Praxis/skills/` repo into a new top-level `skills/` directory in
this repo, with the result committed to git. On top of that vendored content, implement the
real `getInstallContent` reader function that WS-42's plan left as a placeholder/fixture
(Gap 1), so it reads the vendored tree and returns real `SkillContent`/`InstallContent`
values shaped exactly to WS-42's documented contract. The sync script follows
`tools/copy-assets.mjs`'s existing style (plain ESM, no dependencies, one `console.log` per
step, no try/catch), extended with recursive-directory-copy logic it doesn't currently have.
Wiring the reader into WS-42's own IPC handler is included as a final phase of this plan, but
is only executable once WS-42's code exists — that ordering is documented, not encoded as a
formal `depends_on`, per this workstream's own scope statement in `workstream.md`.

## Scope

### Acceptance criteria

1. `tools/sync-praxis-skills.mjs` exists, matches `tools/copy-assets.mjs`'s style (ESM, no
   dependencies, `repoRoot` from `__dirname`, one `console.log` per copied file, no
   try/catch), and when run performs `rm -rf skills/` followed by a full recursive copy of
   every entry under `/Users/akoukoullis/Work/AK/Praxis/skills/` into `<repoRoot>/skills/`.
2. While walking the source tree, the script skips dotfiles, anything matching `.git*`, and
   anything matching `*.zip` — a defensive safeguard against future additions, since none
   exist in the source tree today.
3. Running the script once produces `skills/prx-bug-hunt/`, `skills/prx-dev-principles/`,
   `skills/prx-git/`, `skills/prx-issue-list/`, `skills/prx-orchestrate/` (with its
   `CONVENTIONS.md`, `prompts/*.md`, and `scripts/**` intact), `skills/prx-plain-text-kanban/`,
   `skills/prx-plan-feature/`, and `skills/prx-task-list/`, each mirroring the source folder
   name and contents exactly.
4. The vendored `skills/` tree is reviewed with `git status`/`git diff` and committed.
5. `src/lib/skill-content.ts` exists and exports an async `getInstallContent(toolId: string):
   Promise<InstallContent>` matching WS-42's documented `GetInstallContent` port shape
   (`flowcharge/workstreams/WS-42-7fm9ak-skill-install-sync-engine/plan.md:235`) closely enough
   to be passed as that dependency once WS-42 lands, without needing an adapter — verified by
   a structural-compatibility comment/test, not a real import (WS-42's own type-defining file
   does not exist yet; see Design).
6. `getInstallContent` ignores its `toolId` argument and returns the same eight-skill
   `InstallContent` regardless of which tool is asked, per Context.
7. For each of the 8 vendored `prx-*` directories, the returned `SkillContent` has `id` and
   `name` parsed from `SKILL.md`'s frontmatter `name:` key, `description` parsed from the
   frontmatter `description:` key (including the one skill, `prx-dev-principles`, whose
   description uses a folded `>-` block scalar spanning multiple lines), and `body` set to
   `SKILL.md`'s content with the frontmatter block removed.
8. For `prx-orchestrate`, `files` contains one entry per non-`SKILL.md` file in its directory
   (`CONVENTIONS.md`, each `prompts/*.md`, `scripts/prx-index.mjs`,
   `scripts/test/run-tests.mjs`), each with a forward-slash `relativePath` relative to the
   skill's own directory and its file content. For the other 7 single-file skills, `files` is
   `[]` or omitted.
9. `src/lib/skill-content.test.ts` exists, runs under this repo's existing `node --test`
   convention, and covers: all 8 skills present with non-empty `id`/`name`/`description`/
   `body`; `prx-dev-principles`'s folded-block-scalar description parses to a non-empty single
   string; `prx-orchestrate`'s `files` enumerates its known nested files with correct
   `relativePath`s; a stray dotfile/`.git*`/`*.zip` placed under a skill directory is excluded
   from `files`.
10. `npm run build` compiles `src/lib/skill-content.ts` and its test file with zero errors
    (already covered by `tsconfig.json`'s existing `"src/lib/**/*.ts"` include — no config
    change needed).
11. Once WS-42 has landed `electron/agentic-tools-ipc-handlers.cts` with its placeholder
    `getInstallContent`, that placeholder is replaced with a call into
    `src/lib/skill-content.ts`'s `getInstallContent`. This criterion is satisfied only when
    WS-42's file exists to edit; see Staged task breakdown, Phase 4.

### Out of scope

- Any build-time or runtime fetch from the sibling `Praxis` repo. It has no remote configured
  and only exists on this machine, so vendoring by hand-run script is the only viable route
  (per `workstream.md`'s own investigation) — a fetch mechanism is not designed here.
- A diff-aware or incremental sync mode (e.g. only copying changed files). The chosen strategy
  is wipe-and-recopy every run; see Alternatives.
- Any change to WS-42's own contracts (`SkillContent`, `InstallContent`, `GetInstallContent`,
  `formatForTarget`, `hashInstallContent`) beyond conforming to their already-documented shape.
  `formatForTarget`'s per-tool slicing is untouched.
- Any change to WS-41's or WS-43's code, or to the onboarding UI.
- A versioning/history system for vendored content beyond what git itself already gives (no
  "last synced at" metadata file, no diff report between syncs).
- Anything to do with the four target tools' actual install locations, formats, or the install
  -tracking registry — all WS-42 territory, untouched here beyond Phase 4's one-line swap.

### Assumptions

1. **No production data, live users, or migration/rollback constraints apply.** This
   workstream adds a dev-run script, vendored static markdown/text content, and one new,
   currently-unreferenced `src/lib/` module. Nothing here is wired into a shipped runtime path
   until WS-42's real code exists to call it (Phase 4). Standard per-run deployment question,
   answered here as "none apply."
2. **The sibling `Praxis` repo stays at `/Users/akoukoullis/Work/AK/Praxis`, one level up from
   and alongside this repo's own root** (`/Users/akoukoullis/Work/AK/Praxis-Dashboard`), per
   the user's confirmation recorded in `workstream.md:17`. The sync script computes the
   source path as `<repoRoot>/../Praxis/skills` rather than hardcoding the full
   username-specific absolute path, so it keeps working if this repo is cloned to a different
   location on the same machine, as long as the sibling relationship holds. See Open questions
   if this assumption is wrong.
3. **`InstallContent.version` needs no richer value than a static literal** (e.g.
   `'vendored-skills'`), since WS-42's contract documents it as "caller-supplied content
   identity, informational only" and Context does not ask for a sync-history or versioning
   scheme. See Open questions.
4. **The reader function re-reads `skills/` from disk on every `getInstallContent` call, with
   no in-memory cache**, matching WS-42's own Assumption 6 ("no caching layer inside this
   engine") and this repo's existing "extracted live on request" philosophy (README.md:96-97,
   `src/lib/extract.ts`'s live-read pattern).
5. **Every vendored file is UTF-8 text.** Confirmed true of the source tree today (360K, no
   binaries); the reader function does not special-case or guard against binary content.

## Design

### Where this fits

Two independent pieces, following two existing precedents:

- **The sync script** extends `tools/copy-assets.mjs`'s pattern (`tools/copy-assets.mjs:1-21`)
  — plain ESM, `repoRoot` computed from `__dirname` via `fileURLToPath`, `mkdirSync(...,
  {recursive: true})`, `fs.copyFileSync`, one `console.log` per step, no try/catch (Node's own
  errors abort loudly). New: a recursive walk/copy and a `rm -rf` pre-step, neither of which
  `copy-assets.mjs` currently needs.
- **The reader function** joins `src/lib/`'s existing flat, dependency-free module family
  (`extract.ts`, `git.ts`, `projects.ts`, `yaml-block.ts`, each with a co-located `*.test.ts`
  per `extract.test.ts`'s precedent) as a new sibling, `skill-content.ts`. It knows the
  vendored `skills/` directory's on-disk layout and `SKILL.md`'s frontmatter grammar; it must
  NOT know about `IntegrationFormat`, `ToolDefinition`, install targets, or tracking — those
  stay entirely WS-42's concern, reached only through the `GetInstallContent` port shape this
  module conforms to.

### Contracts

```ts
// src/lib/skill-content.ts
//
// Provisional local copies of WS-42's documented contract
// (flowcharge/workstreams/WS-42-7fm9ak-skill-install-sync-engine/plan.md:219-235). WS-42's own
// agentic-tools-content.ts does not exist yet, so these are defined locally rather than
// imported — TypeScript's structural typing makes this function assignable to WS-42's real
// GetInstallContent once that type exists, with no adapter needed, as long as the shapes stay
// in sync. Phase 4 (or a small WS-42-side follow-up) reconciles the two into one definition.

interface SkillContent {
  id: string;                 // SKILL.md frontmatter's `name:` value, e.g. 'prx-bug-hunt'
  name: string;                // same value as id, per WS-42's contract
  description: string;
  body: string;                 // SKILL.md content with the frontmatter block stripped
  files?: { relativePath: string; content: string }[];  // forward-slash paths; omitted/[] if none
}

interface InstallContent {
  version: string;              // static literal, informational only (Assumption 3)
  skills: SkillContent[];       // sorted by id ascending
}

async function getInstallContent(toolId: string): Promise<InstallContent>;
// Ignores toolId. Reads <repoRoot>/skills/ fresh on every call (Assumption 4).
```

Internal helpers (not exported beyond what tests need):

- `readSkillDirectory(dir: string): SkillContent` — parses one `prx-*` directory: reads
  `SKILL.md`, splits frontmatter from body, parses `name`/`description`, then walks the rest
  of the directory (skipping `SKILL.md` itself and the same dotfile/`.git*`/`*.zip` exclusions
  the sync script uses) to build `files`, sorted by `relativePath` ascending.
- `parseSkillFrontmatter(raw: string): { name: string; description: string; body: string }` —
  a small, purpose-built parser for exactly the two-key grammar `SKILL.md` files use: `name:
  <scalar>` on one line, and `description:` either as a same-line scalar or as a folded block
  scalar (`description: >-` followed by more-indented continuation lines, joined with single
  spaces per YAML folding rules). See Open questions for why this is hand-rolled rather than
  reusing `src/lib/yaml-block.ts`.

### Sync script outline

```
repoRoot = <tools/sync-praxis-skills.mjs's own dir>/..
sourceDir = repoRoot/../Praxis/skills       (Assumption 2)
destDir = repoRoot/skills

rm -rf destDir (fs.rmSync(destDir, {recursive: true, force: true}))
walk(sourceDir, destDir):
  for each entry (dotfiles / .git* / *.zip skipped):
    if directory: mkdirSync(dest, {recursive: true}); recurse
    if file: copyFileSync(src, dest); console.log('copied <relative path>')
```

## Staged task breakdown

**Phase 1 — Sync script.** Small.
- Build: `tools/sync-praxis-skills.mjs` per the Design outline above.
- Files: `tools/sync-praxis-skills.mjs` (new).
- Dependencies: none.
- Verify: `node tools/sync-praxis-skills.mjs` run once against the real sibling repo produces
  a `skills/` tree with all 8 `prx-*` directories and no `.git*`/`.zip`/dotfile entries; run a
  second time is idempotent (same output, no errors) because of the `rm -rf` pre-step.

**Phase 2 — Run and commit the vendored content.** Small.
- Build: nothing new — run Phase 1's script, review with `git status`/`git diff`, commit
  `skills/` and `tools/sync-praxis-skills.mjs` together.
- Files: `skills/**` (new, ~360K), `tools/sync-praxis-skills.mjs` (from Phase 1).
- Dependencies: Phase 1.
- Verify: `git diff --stat` shows only additions under `skills/` plus the one new script; the
  committed tree matches the source repo's `skills/` byte-for-byte (spot-check a few files).

**Phase 3 — `getInstallContent` reader function.** Medium.
- Build: `src/lib/skill-content.ts` and `src/lib/skill-content.test.ts` per the Contracts
  section above.
- Files: `src/lib/skill-content.ts` (new), `src/lib/skill-content.test.ts` (new).
- Dependencies: Phase 2 (needs `skills/` to exist to read and to test against).
- Verify: `npm run build` compiles cleanly; `node --test dist/lib/skill-content.test.js`
  passes, including the `prx-dev-principles` folded-description case and the
  `prx-orchestrate` nested-`files` case; a manual `node -e "import('./dist/lib/skill-content.js').then(m => m.getInstallContent('claude-code')).then(c => console.log(c.skills.length))"`
  prints `8`.

**Phase 4 — Wire the caller (conditional on WS-42 having landed).** Small.
- Build: in `electron/agentic-tools-ipc-handlers.cts`, replace the placeholder/fixture
  `getInstallContent` with `getInstallContent` imported from `src/lib/skill-content.ts`.
- Files: `electron/agentic-tools-ipc-handlers.cts` (existing file, WS-42's).
- Dependencies: Phase 3, **and** WS-42 having actually landed that file — at plan-authoring
  time neither `electron/` nor any `agentic-tools-*.ts` file exists in this repo yet (confirmed
  by search). This is a real-world prerequisite, not a formal Praxis `depends_on`, per this
  workstream's own scope statement (`workstream.md:23`). If WS-42 has not landed when this
  plan is executed, stop after Phase 3 and leave this phase for whenever WS-42 lands — do not
  create `electron/agentic-tools-ipc-handlers.cts` here; that file is WS-42's to author.
- Verify: from a running Electron window (WS-36/WS-37/WS-42's own scaffold),
  `window.praxisSkillInstallAPI.getInstallStatus()`/`installSelected` calls now flow through
  real vendored skill content instead of the fixture — the same manual devtools check WS-42's
  own plan describes (`WS-42-7fm9ak-skill-install-sync-engine/plan.md:88-93`), now exercised
  against real content.

## Data & compatibility

No data migrations. `skills/` is a new, additive top-level directory with no name collision
against this repo's existing `flowcharge/`/`src/` conventions (confirmed during investigation).
`src/lib/skill-content.ts` is a new, currently-unreferenced module through Phase 3 — adding it
changes nothing about any existing behavior. Phase 4 changes WS-42's own not-yet-written IPC
handler, and only if that file already exists.

Rollback: through Phase 3, reverting is `git revert` of the two commits (script+vendored
content, then the reader module) or simply deleting `skills/` and `src/lib/skill-content.*` —
nothing else in the app references either. Phase 4's rollback is reverting its one-line swap
back to WS-42's placeholder.

## Testing strategy

- `src/lib/skill-content.test.ts`, under `node --test` (matching `extract.test.ts`'s
  precedent): unit coverage for frontmatter parsing (plain scalar and folded block-scalar
  `description`), body extraction, `files` enumeration and exclusion rules, and the full
  8-skill `getInstallContent` result shape.
- `tools/sync-praxis-skills.mjs` gets no automated test, matching `copy-assets.mjs`'s own
  precedent (untested) and because its real behavior depends on the sibling repo's local,
  developer-machine-only presence — verification is the manual `git diff` review in Phase 2.
- Phase 4's verification is the same manual devtools smoke check WS-42's own plan already
  specifies; no new automated test is added for IPC wiring here, consistent with WS-42's own
  scope.

## Open questions

1. **SKILL.md frontmatter parsing: hand-rolled parser vs. reusing `src/lib/yaml-block.ts`.**
   This plan recommends and designs around a small, purpose-built hand-rolled parser (see
   Design). Evidence found during reconnaissance: `yaml-block.ts`'s own header comment states
   block scalars (`|`, `>`) are "not supported, because nothing in the schema produces it"
   (`src/lib/yaml-block.ts:19`) — and one of the 8 real source files,
   `Praxis/skills/prx-dev-principles/SKILL.md`, uses exactly that: `description: >-` folded
   across 10 lines. Reusing `yaml-block.ts` unmodified would silently drop that skill's
   description into its `_raw` catch-all. The alternative — extending `yaml-block.ts` to
   support folded/literal block scalars — would fix that but broadens a module several other
   call sites (`extract.ts`, index generation) depend on, for a grammar feature Praxis's own
   frontmatter has never needed. Recommendation: hand-rolled, purpose-built parser (as
   designed), rejecting reuse-as-is (silently wrong for one skill) and rejecting extending
   `yaml-block.ts` (broadens a shared, precisely-scoped module for an unrelated content
   format). Needs your confirmation before Phase 3 starts.
2. **`InstallContent.version`'s literal value.** Assumption 3 proposes a static string. If you
   want it to reflect *when* the content was last synced (e.g. today's date, or the vendored
   commit), say so — it's a one-line change to Phase 3, not a design change, but it's your
   call since WS-42's contract leaves it caller-defined.
3. **Sibling-repo path assumption (Assumption 2).** If the `Praxis` repo is ever not a direct
   sibling of this repo's root, the sync script's source-path computation needs adjusting (or
   an env var / CLI flag added). Not designed here since Context states the location is
   confirmed durable; flagging in case that changes.

## Alternatives considered and rejected

- **Build-time or runtime fetch from the sibling repo instead of vendoring.** Rejected: the
  `Praxis` repo has no remote configured, so this only works on this one machine and breaks
  CI/other clones — already ruled out during investigation (`workstream.md:17`).
- **One-time manual copy-paste, no script.** Rejected: not repeatable. The source content will
  keep evolving upstream and needs a documented, low-friction refresh path; a small script
  matching an existing precedent costs little and removes the manual-copy error surface.
- **Diff-aware/incremental sync (e.g. only copying changed files, or `rsync --delete`).**
  Rejected in favor of `rm -rf` + full recopy: the source tree is tiny (360K) and entirely
  text, full recopy has no measurable cost at this size, and it avoids orphaned files after
  upstream renames or deletions with no extra logic — `git diff` remains the real review step
  either way.
- **Extending `src/lib/yaml-block.ts` to support block scalars, instead of a separate
  hand-rolled parser.** Tentatively rejected pending Open Question 1 — see there for the
  reasoning (separation of concerns: a shared, precisely-scoped Praxis-frontmatter parser
  shouldn't grow a third-party content format's grammar quirks).
- **Naming the new reader module `agentic-tools-content.ts` to pre-match WS-42's planned file
  name.** Rejected: WS-42's plan already reserves that exact file for `SkillContent`/
  `InstallContent`'s type definitions and `hashInstallContent()`
  (`WS-42-7fm9ak-skill-install-sync-engine/plan.md:193-194`), and explicitly scopes any
  concrete `getInstallContent` implementation out of its own workstream
  (`WS-42-7fm9ak-skill-install-sync-engine/plan.md:104-107`). Reusing the name risks a
  file-ownership collision when WS-42 lands and creates that file for real. Chose
  `src/lib/skill-content.ts` instead — a distinct name Phase 4 (or WS-42) can reconcile with a
  simple import once both exist.

### Final summary

Chosen approach: a `copy-assets.mjs`-style hand-run sync script vendoring `Praxis/skills/`
into a new `skills/` directory (Phases 1-2), plus a new `src/lib/skill-content.ts` reader
implementing the real `getInstallContent` against WS-42's documented (but not-yet-landed)
contract (Phase 3), with the IPC-handler wiring itself deferred to a conditional Phase 4 that
only runs once WS-42's code exists. Four phases, small/small/medium/small effort. Top risks:
(1) the SKILL.md frontmatter parser choice (Open Question 1) — one real skill's description
uses a folded block scalar that the repo's existing YAML parser doesn't support; (2) Phase 4
genuinely cannot execute until WS-42 lands, so this plan may ship with Phase 3 as its real
endpoint for a while. Needs your call on: the frontmatter-parsing approach (Open Question 1),
the `version` field's literal value (Open Question 2), and confirmation that the sibling-repo
path assumption holds (Open Question 3).
