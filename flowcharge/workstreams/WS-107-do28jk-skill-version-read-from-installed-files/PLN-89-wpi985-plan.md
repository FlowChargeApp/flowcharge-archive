---
id: PLN-89-wpi985
type: plan
workstream: WS-107-do28jk
slug: skill-version-read-from-installed-files
title: "Read the installed skill version from disk and hide the version chip when nothing is installed"
status: done
created: 2026-09-11
updated: 2026-09-11
depends_on: []
links: []
---

## Summary

The Manage Integrations modal shows "Version unknown" for Claude Code and
OpenCode even when the whole FlowCharge Core suite is installed. The version
chip reads only the install ledger record from `GET /api/integrations/installs`.
FlowCharge writes that ledger only for installs it performs itself, so any other
install method leaves the ledger empty. The "Update available" chip reads the
same record, so it can never show for those users either.

This plan makes the version come from each installed skill's own `SKILL.md`
frontmatter on disk, for Claude Code and OpenCode at global scope. It also hides
the version chip when a tool has zero skills installed, because there is no
version to be unknown about.

The disk read rides on the existing `POST /api/integrations/skill-presence`
route. That route already resolves each canonical skill's exact on-disk path per
tool at global scope, and the browser already calls it once per row at dialog
open. Adding one field to its response adds no round trip and no new path rule.

## Scope

### In scope

- A text-read method on the `FsAccess` read port, plus its Node adapter.
- A new pure module that parses `metadata.version` out of a `SKILL.md`
  frontmatter block, and resolves one version for a tool from the skill files
  the presence probe already found present.
- One additive field, `installedVersion`, on the
  `POST /api/integrations/skill-presence` 200 response.
- The browser mirror type for that response.
- The version chip and the "Update available" chip rules in
  `src/public/home.ts`, including the hide rule for zero installed skills.
- Unit tests for the new module and the new adapter method, and route tests for
  the new response field.

### Out of scope

- `src/lib/agentic-tools-canonical-skills.ts`. WS-106-1xers0's correction to
  that list is applied in the working tree on this branch, not yet in its own
  commit: `git log` for that file stops at commit `39b5367`, which wrote the old
  `fc-orchestrate` and `fc-bug-hunt` ids, and the corrected `flowcharge` and
  `fc-validate` ids sit as an uncommitted working-tree change. This run keeps
  WS-106-1xers0's, WS-107-do28jk's and WS-108-wwcz5g's work together on one
  branch and lands all of it in one combined commit at the end, so this plan
  builds on a working tree that already holds the corrected list. There is no
  commit-ordering dependency to satisfy first. This plan neither changes that
  file nor re-checks it.
- The install ledger's own write path, and every `praxis`-prefixed name.
  Nothing here renames `PraxisData`, `window.praxisAPI`, `PRAXIS_DATA_DIR`,
  `.praxis-installs.json` or `.praxis-projects.json`.
- `electron/`. `src/http/routes-integrations.ts` carries header comments saying
  each route is a hand-mirror of an Electron IPC channel that must change with
  it. Those comments are stale: the project ships CLI-only and `electron/` is
  scaffolding. The executor leaves `electron/` untouched and does not act on
  those comments. The comments themselves are also left alone, because editing
  them is not part of this feature.
- Automated tests for `src/public/home.ts`. No browser test harness exists for
  that file today, and WS-108-wwcz5g owns modal test coverage.
- Reading a version for Cursor and Windsurf from disk (see Assumption 2).
- Any new runtime dependency. None is needed: `src/lib/yaml-block.ts` already
  parses the nested frontmatter grammar, and `node:fs/promises` already backs
  the read adapter.

### Assumptions

1. **Project scope keeps today's behaviour.** Skill presence is fetched at
   global scope only, and the install chip is already hidden at project scope
   for that reason. The disk-read version is therefore a global-scope value too.
   At project scope the version chip keeps reading the scope-keyed ledger
   record, exactly as it does today, and the hide rule does not apply there.
2. **Cursor and Windsurf keep the ledger as their version source.** Neither
   tool declares an implemented format at global scope in
   `src/lib/agentic-tools-catalogue.ts`. Cursor declares only `rule-directory`
   and `mcp-json`, both at project scope. Windsurf declares `rule-directory`
   and `single-rule-file` at project scope, `markdown-context-file` at no
   scope, and `mcp-json` at global scope, which `selectPrimaryFormat` filters
   out as unimplemented. `selectPrimaryFormat` therefore answers `null` for
   both at global scope and `checkSkillPresence` answers
   `checkKind: 'no-format'`. The route answers `installedVersion: null` for a
   `no-format` result, and the chip falls back to the ledger.
3. **Disk first, ledger second.** The chip prefers the disk-read version. When
   disk yields nothing it falls back to the ledger record for the current scope.
   This fixes the reported bug without regressing a FlowCharge-performed install
   of a shared-file tool, whose only version source is the ledger.
4. **One version per tool, first readable file wins.** The suite shares one
   collective version, so the reader walks the present skill files in resolved
   order and returns the first `metadata.version` it can read. It does not
   compare versions across files and does not report disagreement.
5. **The library returns the raw version string.** The browser keeps sole
   ownership of the semver rule, exactly as it does today for the ledger
   version. A string the browser cannot parse shows "Version unknown".
6. **A failed or pending presence probe still shows "Version unknown".** When no
   presence result exists for a tool, the code cannot tell zero-installed from
   unknown, so it keeps the chip visible. The hide rule fires only on a real
   `per-skill` / `not-installed` result.
7. **A partial install still shows a version.** A `missing-incomplete` result
   shows the "Missing skills" chip and the version chip together, because some
   skills are present and one of them carries a readable version.

### Decisions

1. **Zero installed skills hides the "Update available" chip and its Update
   button, as well as "Version unknown".** This is settled here, not deferred.
   When the presence result is `per-skill` with `status: 'not-installed'`, the
   row hides all three: the version chip, the update chip, and the Update
   button. Nothing is installed, so there is no version to report and nothing
   to update.

   This decision changes today's behaviour in one real case. A tool whose
   ledger still holds a stale install record, but whose skill files were later
   deleted by hand outside FlowCharge, shows an Update prompt today. After this
   change it shows none. That is intended. Installation stays reachable for
   that row through its checkbox and the "Install selected" button.

## Key flows

### Today

1. The modal opens. `loadIntegrationsDetection` calls `detectTools`, renders one
   row per catalogue tool, then calls `checkInstalledSkills` once per row at
   global scope.
2. `loadIntegrationsInstallRecords` calls `getInstallStatus` and keys every
   ledger record by tool id and scope.
3. `applyIntegrationsRowEligibility` reads the ledger record for the current
   scope. No record means "Version unknown" and no update chip.

### After this change

1. Steps 1 and 2 are unchanged in shape. The presence response now also carries
   `installedVersion`, read from disk by the route.
2. `applyIntegrationsRowEligibility` resolves the version as
   `installedVersion` first, then the ledger record's version.
3. When the presence result is `per-skill` with `status: 'not-installed'`, the
   version chip and the update chip are both hidden, and the update button is
   hidden with them.

## Design

### Port change

`src/lib/agentic-tools-signals.ts` gains one method on `FsAccess`:

```
readTextFile(path: string): Promise<string | null>
```

`null` for a missing file, a throw for anything else, matching
`FsWriteAccess.readTextFile`'s existing contract. `createNodeFsAccess` in
`src/lib/agentic-tools-fs-adapter.ts` implements it on `node:fs/promises`, the
same shape the write adapter already uses.

`FsAccess` is the codebase's read-side filesystem port. A text read belongs
beside `pathExists`. Five test doubles, across four test files, type an object
literal as `FsAccess` and will need the new method stubbed:
`src/test/unit/agentic-tools-signals.test.ts`,
`src/test/unit/agentic-tools-detect.test.ts`,
`src/test/unit/agentic-tools-catalogue.test.ts`, and
`src/test/unit/agentic-tools-skill-presence.test.ts` (two doubles live in the
detect test). Each gets a throwing stub, matching the throwing `isDirectory`
stub already in the presence test; the other three files stub `isDirectory`
with a fixed boolean instead, so their new stub is the first throwing one they
carry. None of these tests needs a real read.

### New module

`src/lib/agentic-tools-skill-version.ts`, a read-only module in the same family
as `agentic-tools-skill-presence.ts`. It exports two functions.

```
parseSkillVersion(text: string): string | null
```

Matches a leading frontmatter block with an anchored pattern and no `g` flag,
tolerating CRLF, then hands the captured lines to `parseYamlBlock` from
`src/lib/yaml-block.ts`. It returns `fields.metadata.version` when that path
holds a string, and `null` otherwise. It never throws.

`parseYamlBlock` is the right parser here and `parseFrontmatter` from
`src/lib/extract.ts` is not: `parseFrontmatter` reads flat keys only, and the
version is nested under `metadata`. `parseYamlBlock` already handles the nested
map case and already trims a trailing carriage return out of a scalar.

```
readInstalledSkillVersion(
  tool: ToolDefinition,
  basePath: string,
  presentSkillIds: string[],
  fsAccess: FsAccess,
): Promise<string | null>
```

It resolves each present skill's path with `selectPrimaryFormat` and
`formatForTarget`, the same two helpers `checkSkillPresence` uses, so the path
rule stays in `src/lib/agentic-tools-format.ts` and is not duplicated. It reads
each resolved path in order and returns the first version `parseSkillVersion`
can read. It returns `null` for an empty `presentSkillIds`, for a format that is
not `skill-directory` or `rule-directory`, and when no present file yields a
version.

The module carries no transport, no status code and no user-facing string, and
imports only `node:path`, the format helpers, and the `FsAccess`,
`ToolDefinition` and `InstallContent` types — the same import set
`agentic-tools-skill-presence.ts` already carries, because `formatForTarget`
takes an `InstallContent` argument and the signature above takes a
`ToolDefinition`.

### Why a separate module rather than folding it into `checkSkillPresence`

`checkSkillPresence` answers one question and is named for it. Version reading
is a second question with its own failure modes, and the route is the right
place to ask both and compose one answer. The two share the path rule through
`agentic-tools-format.ts`, so nothing is duplicated by the split.

### Route change

In `src/http/routes-integrations.ts`, `handleIntegrationsSkillPresence` calls
`checkSkillPresence` as it does today. When the result is `checkKind:
'per-skill'` and `presentSkillIds` is non-empty, it then calls
`readInstalledSkillVersion` with that same tool, `basePath`, and
`presentSkillIds`, reusing the `FsAccess` instance it already built. It responds
with `{ ...result, installedVersion }`.

`installedVersion` is `null` for every other case: `shared-file`, `no-format`,
an empty `presentSkillIds`, and a present file with no readable version.

The route keeps reading no environment variable and keeps every filesystem reach
behind the injected `createFsAccess()` adapter, so the hexagonal split holds.

### Browser change

`src/public/lib/agentic-tools-api.ts` adds the response mirror:

```
export type SkillPresenceResponse = SkillPresenceResult & {
  installedVersion: string | null;
};
```

`checkInstalledSkills` returns `PraxisIpcResult<SkillPresenceResponse>`.
`SkillPresenceResult` itself stays as it is, so nothing that mirrors the library
union drifts.

`src/public/home.ts` changes in `applyIntegrationsRowEligibility` only. The
presence lookup already runs there, and already returns `undefined` at project
scope. The new derivation, in order:

1. `presence` — the existing global-scope-only lookup, moved above the version
   block so the version rules can read it.
2. `zeroInstalled` — `presence` is a `per-skill` result with `status:
   'not-installed'`.
3. `effectiveVersion` — `presence.installedVersion` when it is a non-empty
   string, otherwise the current scope's ledger record version, otherwise
   undefined.
4. The version chip is hidden when `zeroInstalled`. Otherwise it renders exactly
   as today, from `effectiveVersion` instead of `recordedVersion`.
5. The update chip and the update button are hidden when `zeroInstalled`, and
   otherwise ride on `isNewer(latestRelease.tag, effectiveVersion)` as today.

`integrationsSkillPresence` becomes `Record<string, SkillPresenceResponse>`.

Four comment blocks in `src/public/home.ts` go stale with this change and must
each be rewritten to state the new source and the hide rule. They are
load-bearing documentation in this file's style, not decoration.

- Lines 415-424, on the version-chip and update-chip labels. They state that
  the version comes from a ledger record.
- Lines 475-482, on `integrationsSkillPresence`. They describe that map as
  carrying presence results only, and say a scope toggle re-derives "chip
  visibility" from it. After this change the same map also carries
  `installedVersion` and drives the version chip.
- Lines 489-498, on `integrationsInstallRecords`. They call that map the
  version join.
- Lines 578-604, on the chip derivation itself. They state that the version
  chip is always visible and reads from the record map.

### Render ordering

Rows render as soon as `detectTools` resolves, before any presence probe
returns, so a row briefly shows "Version unknown" and then hides or replaces the
chip when its probe lands. This is the existing render order and this plan does
not change it. See Alternatives considered and rejected.

## Stages

Riskiest first. Each stage is verifiable on its own.

1. **Port, reader module and their tests.** Add `FsAccess.readTextFile` and its
   Node implementation, add `src/lib/agentic-tools-skill-version.ts`, stub the
   four `FsAccess` test doubles, and write
   `src/test/unit/agentic-tools-skill-version.test.ts` plus the new
   `createNodeFsAccess` cases in
   `src/test/unit/agentic-tools-fs-adapter.test.ts`.
   Verify: `npm test` passes, and the new cases cover every branch listed under
   Testing strategy.

2. **Route composition and route tests.** Compose `installedVersion` into the
   `skill-presence` 200 body and add the `src/test/unit/server.test.ts` cases
   that drive it over the real socket against a temporary directory.
   Verify: `npm test` passes, including a case that reads a real version off a
   real file and a case that answers `null`.

3. **Browser types and chip rules.** Add `SkillPresenceResponse`, retype the
   presence map, rewrite the chip derivation and the four comment blocks
   listed under Browser change.
   Verify: `npm run build` passes all three `tsc` runs and the bundle checks,
   then `npm start` and open Manage Integrations, and confirm the four states by
   hand: a fully installed tool shows its real version; a tool with nothing
   installed shows no version chip; a partly installed tool shows both "Missing
   skills" and a version; project scope is unchanged.

The two closing tasks this project requires — the `npm test` gate and the
`ARCHITECTURE.md` review — are fixed boilerplate the task-list author appends.
This plan forecasts no edit for either.

## Data & compatibility

- **Wire shape.** `POST /api/integrations/skill-presence` gains one field. The
  route and its only caller ship in the same build, over loopback, with no
  external consumer, so the additive field needs no version negotiation. An old
  cached bundle reading the new body simply ignores the field.
- **On-disk formats.** Nothing is written. No file format changes, no ledger
  entry changes, and `.praxis-installs.json` is read exactly as it is today.
- **No new runtime dependency.** `parseYamlBlock` and `node:fs/promises` cover
  the whole read.
- **Layer rules.** Browser code still sees no Node type: the new module lives in
  `src/lib` and the browser only gains a mirrored type. Node code still sees no
  DOM type. The CSP is untouched, because nothing adds a script.
- **Board read path.** Untouched. This read backs the integrations modal, not
  the board, and adds no cache and no state store.

## Testing strategy

### `src/test/unit/agentic-tools-skill-version.test.ts` (new)

`parseSkillVersion`:

- Nested `metadata.version` quoted, and unquoted.
- A frontmatter block with no `metadata` key.
- A `metadata` map with no `version` key.
- A `metadata.version` that is a list rather than a string.
- A file with no frontmatter block at all.
- A body line starting with `---`, proving the anchored match does not split on
  it.
- CRLF line endings.

`readInstalledSkillVersion`, driven by a fake `FsAccess` whose `readTextFile`
answers from a path-keyed map, with no real filesystem access:

- A `skill-directory` tool where the first present skill carries a version.
- A `skill-directory` tool where the first present file has no readable version
  and a later one does.
- Every present file unreadable, expecting `null`.
- An empty `presentSkillIds`, expecting `null` and zero reads.
- A `single-rule-file` tool, expecting `null`.
- A tool with no implemented format, expecting `null`.

### `src/test/unit/agentic-tools-fs-adapter.test.ts` (extended)

- `createNodeFsAccess().readTextFile` returns the contents of a real file.
- It returns `null` for a missing path.

### `src/test/unit/server.test.ts` (extended)

Driven over the real socket, against the suite's existing temporary directory:

- Write `skills/<id>/SKILL.md` for one canonical skill id under a temporary
  directory, with nested `metadata.version`, then POST `skill-presence` for a
  `skill-directory` tool with that `basePath`, and assert `installedVersion`
  equals the version in the file.
- POST `skill-presence` against an empty temporary directory and assert
  `installedVersion` is `null`.

### Unchanged tests

`src/test/unit/agentic-tools-skill-presence.test.ts` keeps asserting the
presence union unchanged. Its only edit is the new stub on the fake.

### Not automated

The chip rules in `src/public/home.ts`. No harness exists for that file and
WS-108-wwcz5g owns that gap. Stage 3 verifies them by hand, by the four states
listed in the Stages section.

## Open questions

1. **Question:** Should the "Update available" chip and its Update button be
   offered for an install FlowCharge did not perform, given that clicking Update
   overwrites the installed skill files with the published release and would
   destroy any local edits in a hand-synced skill tree?
   **Recommendation:** Yes, offer it. Context names the update chip never firing
   as part of the bug being fixed, and the install path already overwrites for
   every FlowCharge-performed install. The consequence is worth stating out
   loud, because a user who syncs their skill folders from their own source is
   exactly the user this fix newly exposes to that overwrite, and lost local
   edits are not recovered by a later code change.

## Adjacent opportunities

Noted only. None is planned here and none is actioned.

- `src/public/home.ts` has no automated test. WS-108-wwcz5g already owns it.
- The Electron mirror comments in `src/http/routes-integrations.ts` describe a
  release path that no longer exists.
- Skill presence is fetched at global scope only. Project-scope presence would
  remove Assumption 1's limit.

## Alternatives considered and rejected

1. **A separate `POST /api/integrations/skill-version` route.** Rejected: it
   adds one round trip per row, four extra fetches at dialog open, and a second
   place in the browser that resolves a base path per scope. The presence route
   already resolves the exact paths this read needs.

2. **Reading the version inside `checkSkillPresence` and returning it on the
   presence union.** Rejected: it gives one function two jobs and changes a type
   that `src/public/lib/agentic-tools-api.ts` mirrors by hand. The route
   composing two library calls is the cheaper split, and the shared path rule
   stays in one place either way.

3. **A new narrow one-method reader port instead of widening `FsAccess`.**
   Rejected: it avoids four one-line test-double stubs but introduces a second
   read port beside the one the whole detection family already injects.
   `FsAccess` is the read port; a text read belongs in it.

4. **Replacing the ledger version outright, with no fallback.** Rejected:
   Cursor and Windsurf declare no implemented format at global scope, so
   `checkSkillPresence` answers `checkKind: 'no-format'` for both and there is
   no file on disk to read a version from, and project scope has no presence
   probe at all. Removing the fallback would turn a working version chip into
   "Version unknown" for those cases. Disk still wins wherever disk can answer.

5. **Reading a version out of a shared concatenated document for Cursor and
   Windsurf.** Rejected: Context scopes this feature to Claude Code and
   OpenCode, and at global scope there is no such document to read. Neither
   tool declares an implemented global-scope format, so `selectPrimaryFormat`
   answers `null` and the presence check answers `no-format`. Reading a version
   for these two would first require giving them a global install target, which
   this feature does not do. Assumption 2 keeps those two on the ledger.

6. **Hiding the version chip until its presence probe resolves, to remove the
   brief "Version unknown" flash.** Rejected: it adds a third state to a chip
   that has two, and it changes what a failed probe shows. Assumption 6 keeps a
   failed probe on "Version unknown", which is the honest answer. The flash is
   the existing render order, not a regression this change introduces.

## Final summary

Three code stages, all behind the route that already runs. `FsAccess` gains a
text read. A new pure module parses `metadata.version` out of a `SKILL.md` and
answers one version per tool from the files the presence probe already found.
The `skill-presence` route composes that into one additive response field. The
modal prefers it over the ledger, and hides the version chip, the update chip
and the Update button entirely when a tool has nothing installed. No new
dependency, no rename, no Electron, no cache, and one open question about
offering Update over a hand-synced skill tree.
