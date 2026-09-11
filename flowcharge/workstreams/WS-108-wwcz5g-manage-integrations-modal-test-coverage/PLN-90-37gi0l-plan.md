---
id: PLN-90-37gi0l
type: plan
workstream: WS-108-wwcz5g
slug: manage-integrations-modal-test-coverage
title: "Pin the canonical skill ids and cover the chips' data source, before the modal's own render rules"
status: ready
created: 2026-09-11
updated: 2026-09-11
depends_on: []
links: []
---

## Summary

Two wrong chips shipped behind a green suite: "Missing skills" for a correctly
installed suite, and "Version unknown" for every tool. Neither came from a
rendering mistake in `src/public/home.ts`. Both came from wrong data arriving at
the modal. "Missing skills" came from `CANONICAL_PRAXIS_SKILL_IDS` holding ids
the real suite does not use, and "Version unknown" came from the install ledger
being the only version source. The modal rendered both faithfully.

This plan therefore covers the data source first, where it can be covered today
with no new dependency and no rule change, and covers the modal's own render
rules third, behind a small extraction that makes them reachable from
`node --test`.

Stage 1 pins the canonical skill id list. Stage 2 drives the real ids through
the real `POST /api/integrations/skill-presence` route over the real socket,
against temporary directories laid out the way an installed machine is laid
out, and asserts both the presence status and the `installedVersion` field that
WS-107-do28jk adds. Together those two stages would have caught both shipped
bugs at the point where each was born.

Stage 3 is the chip-derivation logic in `src/public/home.ts`. Reconnaissance
found that the current build makes that file unreachable from the compiled test
suite, for three independent reasons. Stage 3 therefore extracts those rules
into a new import-free module under `src/lib/`, which the Node compilation
already emits and `node --test` can already import, and rewrites `home.ts` to
call it. That extraction narrows one accepted constraint in `ARCHITECTURE.md`
section 11. Decision 4 records the narrowing and its consequences. This plan
carries no open question.

## Scope

### In scope

- A new unit test that pins `CANONICAL_PRAXIS_SKILL_IDS` against a golden list
  of the real FlowCharge Core skill ids.
- A small shared fixture module holding that golden list once, so the pin test
  and the route test read the same literal.
- New cases in `src/test/unit/server.test.ts` that lay the real skill ids out on
  disk and assert what the presence route answers for a full install, a partial
  install and an empty directory.
- A new import-free module under `src/lib/` holding the modal's row-eligibility
  and chip-decision rules, including the version-display and hide-on-zero-
  installed rules PLN-89-wpi985 designs, as a pure function of its inputs.
- A rewrite of `applyIntegrationsRowEligibility` in `src/public/home.ts` to call
  that module instead of holding the rules inline, keeping every user-facing
  string in `home.ts`.
- A narrowing of `ARCHITECTURE.md` section 11's `browser-entry-bundles` rule to
  permit exactly that one import path from a browser entry into `src/lib/`. See
  Decision 4.
- A new unit test file that drives the rules module through the decision table
  under Testing strategy.

### Out of scope

- Any production code change in stages 1 and 2. Both stages are tests only.
  Stage 3 is the only stage that changes shipped code.
- `src/public/lib/agentic-tools-scope.ts`. It keeps both of its functions and
  keeps its place in the browser tree. Stage 3's module takes the base path that
  `resolveBasePathForScope` already resolves; it does not re-author the path
  rule and does not move that file.
- `src/lib/agentic-tools-canonical-skills.ts` itself. WS-106-1xers0's correction
  to that file is applied in the working tree on this branch and this plan
  neither changes it nor re-checks its content beyond pinning it.
- Everything PLN-89-wpi985 already plans. That plan adds its own
  `src/test/unit/agentic-tools-skill-version.test.ts`, its own
  `agentic-tools-fs-adapter.test.ts` cases, and two `server.test.ts` cases for
  `installedVersion`. This plan adds only the cases PLN-89-wpi985 does not.
- `EXPECTED_IDS` in `src/test/unit/skill-content-fetch.test.ts`. That literal
  pins a different module against the published release and is correct for what
  it tests. See Decision 5 for why it now disagrees with the canonical list, and
  Adjacent opportunities for the consequence.
- Republishing the FlowCharge Core release, renaming any `praxis`-prefixed
  name, and `electron/`.
- Any new runtime dependency. Stages 1 and 2 need none.

### Assumptions

1. **This plan executes after PLN-89-wpi985.** PLN-89-wpi985's stage 2 adds the
   `installedVersion` field that stage 2 here asserts, and its stage 3 rewrites
   the exact function stage 3 here would extract. PLN-89-wpi985 states that
   WS-106-1xers0, WS-107-do28jk and WS-108-wwcz5g land together on one branch in
   one combined commit, so the ordering is available. Stage 1 of this plan does
   not depend on it and may run at any point.
2. **The golden list is the corrected eight ids**, the ones WS-106-1xers0 wrote:
   `fc-dev-principles`, `fc-git`, `fc-issue-list`, `fc-plain-text-kanban`,
   `fc-plan-feature`, `fc-task-list`, `fc-validate`, `flowcharge`. This is the
   reading Context states, and it matches the skill folders actually installed
   on the owner's machine. It does not match the published release. Decision 5
   settles that and records the consequence.
3. **The pin is deterministic and offline.** It compares two literals and makes
   no network call, so it runs in CI and offline. Its value is that a future
   edit to `CANONICAL_PRAXIS_SKILL_IDS` must be made deliberately in two places
   rather than silently in one. It cannot, on its own, detect the published
   suite changing upstream; only a live check can do that, and Decision 5
   rejects adding one in this workstream.
4. **The route tests use `claude-code`.** It is the first catalogue entry whose
   global format is `skill-directory` with the template `skills/<name>/SKILL.md`
   and a real, named layout to reproduce. It is not the only one: `opencode`
   declares an identical global entry in `src/lib/agentic-tools-catalogue.ts` at
   lines 235-240, beside `claude-code`'s at lines 56-62. Either would serve, and
   the cases use `claude-code`. The presence route applies no
   permitted-root guard, unlike the installs route, so a temporary directory is
   an acceptable `basePath`.
5. **The route tests write files, never install.** `getInstallContent` is a live
   network call and no case here touches it. Each case writes its own
   `skills/<id>/SKILL.md` files with `node:fs` into the suite's existing
   temporary directory.

### Decisions

1. **Coverage goes to the data source before the renderer.** Both shipped bugs
   were wrong data, not wrong rendering. Stage 2 asserts the exact route
   response the two chips read. This is settled here and is why stage 3 is last
   rather than first, despite the workstream record naming the modal.
2. **The golden list lives in one shared fixture module**,
   `src/test/expected-skill-ids.ts`, not duplicated across two test files. It
   carries no `.test.` in its name, because it declares no test, per the
   `test-suites` constraint in `ARCHITECTURE.md` section 11.
3. **Stage 3 runs last, but it is fully designed.** It depends on
   PLN-89-wpi985's rewrite of the same function, so it must follow that work.
   Its module, its signature, its tests and its `home.ts` changes are written
   out under Design and Testing strategy, so tasks can be authored for it.

4. **The chip rules move into an import-free module under `src/lib/`, and
   `ARCHITECTURE.md` section 11's `browser-entry-bundles` rule is narrowed to
   permit that one import path.** The rule reads today: "Nothing in a bundle may
   reach `src/lib/`." After this plan it permits a browser entry to import a
   module under `src/lib/` that itself imports nothing at all, and it keeps
   refusing every other reach into `src/lib/`.

   This is the plan's one risky decision. It changes an accepted architecture
   constraint and it moves code across a layer boundary. Its consequences are
   stated here rather than left as detail:

   - The rule's purpose survives the narrowing. A module with no import can
     reach no Node built-in and no server module, so no server-side code enters
     the browser graph through it. `"types": []` in `src/public/tsconfig.json`
     already refuses Node globals mechanically for every file the browser
     project type-checks.
   - Nothing enforces the narrowed rule automatically. `tools/bundle-public.mjs`
     guards only `eval(` and `Function(`, `tools/copy-assets.mjs` guards source
     maps, and no build check reads the import graph. A later editor who adds
     one import to the new module
     pulls server code into `home.js` with a green build. The module's header
     comment is the only guard, in the same load-bearing-comment style this
     file family already uses.
   - The closing `ARCHITECTURE.md` review, which every task list in this project
     ends with, is where section 11 is rewritten to match. That closing task is
     fixed boilerplate and already runs, so this plan adds no separate task for
     the document change and forecasts no wording for it.
   - The codebase's present habit is the opposite one: `home.ts` re-authors
     `parseSemver` and `isNewer`, and two browser modules mirror library types
     by hand. Stage 3 does not reverse that habit wholesale. It moves exactly
     the rules it puts under test and leaves every other duplicate alone.

5. **Stage 1 pins the corrected eight ids, and this plan adds no live
   cross-check against the published release.** The corrected list is what
   `CANONICAL_PRAXIS_SKILL_IDS` holds after WS-106-1xers0's fix, and it matches
   the skill folders installed on the owner's machine, so it is the right
   expectation for the product.

   One consequence is already known, and it is a consequence, not an open
   question. The published release archive `v0.1.0` is the installer's only
   content source, and it still ships the pre-fix skill names. Until that
   release is republished with the corrected list, an install performed through
   FlowCharge's own installer — as opposed to the hand-synced install already on
   this machine — writes the old names, and the presence check then reports
   "Missing skills" for that machine. That is ISS-42-q1t9bh's symptom returning
   through the installer path. No filed issue tracks that installer-path gap
   today. Filing one is a separate step, and this plan does not take it.
   Republishing is out of scope for this workstream. A live cross-check is the
   only automatic drift detector, but
   it would be red on the day it was written, and this project's closing test
   gate forbids merging a red suite.

## What exists today

- `src/test/unit/agentic-tools-skill-presence.test.ts` passes 7 of 7 with
  invented fixture ids (`prx-alpha`, `prx-beta`, `prx-gamma`) and one case using
  `prx-orchestrate`. It tests `checkSkillPresence`'s algebra correctly and is
  unchanged by this plan.
- `src/test/unit/server.test.ts:49-131` asserts only that
  `POST /api/integrations/skill-presence` answers a `200` whose `checkKind` is a
  string, plus the `404`, `400`, `405` guards. It never writes a skill file and
  never asserts a status or an id.
- `src/lib/agentic-tools-canonical-skills.ts` has no test of any kind.
- `src/public/home.ts` and `src/public/lib/agentic-tools-scope.ts` have no test
  of any kind, and no test can import them today. See stage 3.

## Design

### Stage 1 — pin the canonical skill ids

New fixture module `src/test/expected-skill-ids.ts`:

```
export const EXPECTED_CANONICAL_SKILL_IDS: string[];
```

Eight ids, sorted ascending, with a header comment stating what it pins, that it
is a hand-maintained duplicate, and that changing `CANONICAL_PRAXIS_SKILL_IDS`
requires changing this file in the same edit.

New test file `src/test/unit/agentic-tools-canonical-skills.test.ts`, in the
`node:test` plus `node:assert/strict` style every other unit file uses:

- A sorted copy of `CANONICAL_PRAXIS_SKILL_IDS` deep-equals
  `EXPECTED_CANONICAL_SKILL_IDS`. Sorted on both sides, so the declaration order
  in the source file is not pinned; only membership and count are.
- `CANONICAL_PRAXIS_SKILL_IDS` contains no duplicate id.
- `CANONICAL_PRAXIS_SKILL_IDS` does not contain `ak-prx-migrate`. The source
  file's own header comment names that id as a real skill deliberately excluded
  from the suite, so the exclusion is worth holding.

### Stage 2 — drive the real ids through the presence route

New cases in `src/test/unit/server.test.ts`, in the file's existing style: real
socket, real routes, its existing `tmpDir` and its existing `postJson` helper. A
small local helper writes `skills/<id>/SKILL.md` under a per-case subdirectory
of `tmpDir`, so the cases do not interfere with one another.

The relative layout is written as the literal `skills/<id>/SKILL.md`, not
derived from `formatForTarget`. Deriving it from the code under test would make
the case pass whatever that code produced, which is the mistake this workstream
exists to correct.

Each `SKILL.md` body carries a frontmatter block with a nested
`metadata.version`, so the same fixture serves both the presence assertions and
the `installedVersion` assertions.

- **Full install.** Write all eight `EXPECTED_CANONICAL_SKILL_IDS`. POST
  `skill-presence` for `claude-code` at global scope with that base path. Assert
  `checkKind: 'per-skill'`, `status: 'fully-installed'`, `missingSkillIds: []`,
  and a sorted `presentSkillIds` deep-equal to `EXPECTED_CANONICAL_SKILL_IDS`.
  This is the case that fails the moment the canonical list and the real ids
  part company, and it is the one that would have caught ISS-42-q1t9bh.
- **Partial install.** Write every id but one. Assert
  `status: 'missing-incomplete'` and `missingSkillIds` deep-equal to the one
  omitted id. This is the "Missing skills" chip's true trigger.
- **Partial install still reports a version.** On that same partial base path,
  assert `installedVersion` equals the version written into the files. This is
  PLN-89-wpi985's Assumption 7 — a partial install shows both the "Missing
  skills" chip and a version — asserted at the route.

PLN-89-wpi985 already covers a full read of a real version and a `null` against
an empty directory. Neither is repeated here.

### Stage 3 — the chip-derivation rules in `src/public/home.ts`

Reconnaissance established that the existing `node --test` setup **cannot**
exercise `src/public/home.ts`'s logic as the code stands, for three independent
reasons. Each one alone is sufficient:

1. `src/public/tsconfig.json` sets `"noEmit": true`. The browser compilation
   type-checks and emits nothing, so no per-file JavaScript for `home.ts` or
   `src/public/lib/*.ts` ever exists under `dist/`.
2. `tools/bundle-public.mjs` sweeps **every** `.js` file under `dist/public/`,
   recursively, before it bundles. Its own comment names
   `lib/agentic-tools-scope.js` as a file it removes. So even if a compilation
   were made to emit there, `npm test`'s `pretest` build would delete the output
   before the suite ran. `dist/public/` currently holds only the three bundles
   and the copied assets, which confirms this.
3. `ARCHITECTURE.md` section 11, `browser-entry-bundles`, carries the accepted
   constraint: "Nothing in a bundle may reach `src/lib/`. Server-side modules
   must never enter the browser graph, which is why the workstream-id fragment
   is duplicated in `boardEntry` rather than imported." The codebase applies
   that rule consistently: `home.ts` re-authors `parseSemver` and `isNewer`
   rather than importing `src/lib/update-check.ts`,
   `src/public/lib/agentic-tools-api.ts` mirrors library types by hand, and
   `skill-content-fetch.ts` mirrors interfaces rather than importing them.
   Decision 4 narrows this rule for one import path, which is what makes the
   ordinary fix available.

`src/public/home.ts` is additionally a single IIFE that resolves page elements
by id at module evaluation time, so the built bundle cannot be imported into a
Node process at all without a document. The rules therefore have to leave that
file to be testable; nothing that keeps them inside it is reachable.

#### The new module

`src/lib/agentic-tools-chip-rules.ts`, a pure module in the same `agentic-tools-`
family as the rest of this surface. Its contract, which Decision 4 depends on:

- **No `import` statement of any kind.** Not even a type-only one, and not
  `node:path`. It declares its own structural input types instead of importing
  `SkillPresenceResult`, because importing that would pull
  `agentic-tools-skill-presence.ts`, and through it `node:path`, into the
  browser graph.
- No DOM access, no `fetch`, no user-facing string and no side effect. It is a
  function of its arguments only.
- It is compiled twice: by the root `tsconfig.json` to
  `dist/lib/agentic-tools-chip-rules.js`, which the test suite imports, and by
  `src/public/tsconfig.json` as part of the browser type-check, once its path is
  added to that file's `include` list beside the two existing `lib/` entries. It
  must therefore stay inside the intersection of the two projects: ES2020
  syntax and ES2020 library only, since the browser project targets es2020.

Exported shape:

```ts
export type IntegrationsScopeKind = 'global' | 'project';

export type SkillPresenceLike =
  | {
      checkKind: 'per-skill';
      status: 'fully-installed' | 'missing-incomplete' | 'not-installed';
      presentSkillIds: string[];
      missingSkillIds: string[];
    }
  | { checkKind: 'shared-file'; exists: boolean }
  | { checkKind: 'no-format' };

export interface IntegrationsRowRuleInput {
  scopeKind: IntegrationsScopeKind;
  // resolveBasePathForScope's answer at the current scope; null means the row
  // has no installable target there.
  basePath: string | null;
  needsManualVerification: boolean;
  hasLiveResult: boolean;
  // Passed unconditionally. The project-scope gate lives in this module.
  presence: SkillPresenceLike | undefined;
  installedVersion: string | null | undefined;
  ledgerVersion: string | undefined;
  latestReleaseTag: string | null;
}

export type InstallChipDecision =
  'hidden' | 'already-installed' | 'missing-skills' | 'unchanged';

export type VersionChipDecision =
  | { kind: 'hidden' }
  | { kind: 'unknown' }
  | { kind: 'version'; major: number; minor: number; patch: number };

export type RowNote = 'not-supported-at-scope' | 'path-unverified';

export interface IntegrationsRowDecision {
  eligible: boolean;
  installChip: InstallChipDecision;
  versionChip: VersionChipDecision;
  updateOffered: boolean;
  notes: RowNote[];
}

export function deriveIntegrationsRowDecision(
  input: IntegrationsRowRuleInput,
): IntegrationsRowDecision;

export function parseSemver(
  raw: string,
): { major: number; minor: number; patch: number } | null;

export function isNewer(candidate: string, running: string): boolean;
```

`parseSemver` and `isNewer` move here from `home.ts` unchanged, with their
comments. They are exported so the version and update cases can be driven
directly rather than through the whole decision. The duplicate of
`src/lib/update-check.ts`'s rule moves; it does not multiply.

The rules the function holds are today's rules, moved rather than redesigned:

- `eligible` is `basePath !== null`. Path resolution stays in
  `src/public/lib/agentic-tools-scope.ts`; this module consumes its answer.
- `presence` is ignored at project scope. That gate is inline in `home.ts`
  today.
- `installChip` is `'unchanged'` when `hasLiveResult` is true, so a live install
  result is never clobbered.
- The version resolves to `installedVersion` when it is a non-empty string,
  otherwise `ledgerVersion`, otherwise unknown. An unparseable value is unknown.
  The chip is hidden when presence is `per-skill` with `not-installed`.
- `updateOffered` is false whenever the version chip is hidden, and otherwise
  requires a non-null `latestReleaseTag` and `isNewer(tag, effectiveVersion)`.
- `notes` carries `'not-supported-at-scope'` when the row is ineligible and
  `'path-unverified'` when `needsManualVerification` is set, in that order,
  matching the order `home.ts` appends them today.

#### What `src/public/home.ts` changes to

`applyIntegrationsRowEligibility` stops holding rules and becomes a builder plus
a painter.

1. It builds one `IntegrationsRowRuleInput` from values it already has:
   `resolveBasePathForScope(currentIntegrationsScope, entry.row.detection)`,
   `currentIntegrationsScope.kind`, `entry.row.detection.needsManualVerification`,
   `entry.hasLiveResult`, `integrationsSkillPresence[entry.row.toolId]` passed
   with no scope gate, that entry's `installedVersion`, the ledger record's
   `version` at `installRecordKey(entry.row.toolId, currentIntegrationsScope)`,
   and `latestRelease === null ? null : latestRelease.tag`.
2. It calls `deriveIntegrationsRowDecision` once.
3. It paints the decision: `checkbox.disabled = !eligible`; the install chip's
   text from `ALREADY_INSTALLED_LABEL` or `INCOMPLETE_INSTALL_LABEL` and its
   `hidden` flag, left untouched for `'unchanged'`; the version chip from
   `UNKNOWN_VERSION_LABEL` or `VERSION_LABEL_PREFIX` plus the numeric triple;
   `updateChip.hidden = !updateOffered`; `updateButton.hidden = !updateOffered`
   and `updateButton.disabled = !eligible`; and one note span per `RowNote`.
4. Every user-facing string stays in `home.ts`, including the scope word inside
   "Not supported at project scope", which `home.ts` still builds from
   `currentIntegrationsScope`.
5. `parseSemver`, `isNewer` and `SEMVER_RE` are deleted from `home.ts`. Nothing
   else in that file calls them.
6. The import is extensionless: `'../lib/agentic-tools-chip-rules'`. This
   matches the existing style of `home.ts`, which already imports
   `'./lib/agentic-tools-scope'` with no extension. The root `tsconfig.json`'s
   `include` list holds no `src/public` path, so the root project never compiles
   `home.ts` and its `node16` resolution never applies to this import. The
   browser project's `bundler` resolution and esbuild both resolve the
   extensionless specifier to the `.ts` file. The `.js` extension is used only
   in the new test file's import of the same module, because `src/test/` is what
   the root project compiles and resolves under `node16`. `isolatedModules` is
   on for the browser project, so the type-only names must arrive through
   `import type`.
7. The comment blocks PLN-89-wpi985 rewrites at lines 415-424 and 578-604 are
   rewritten once more here, to name the module that now owns each rule. They
   are load-bearing documentation in this file's style.

## Stages

1. **Pin the canonical skill ids.** Add `src/test/expected-skill-ids.ts` and
   `src/test/unit/agentic-tools-canonical-skills.test.ts`.
   Verify: `npm test` passes with three new cases. Then, at the same commit,
   temporarily change one id in `src/lib/agentic-tools-canonical-skills.ts`,
   confirm `npm test` fails, and revert. The pin is worthless if it cannot fail.

2. **Cover the presence route with the real ids.** Add the three cases above to
   `src/test/unit/server.test.ts`.
   Verify: `npm test` passes. Then temporarily revert
   `src/lib/agentic-tools-canonical-skills.ts` to its committed content
   (`fc-orchestrate` and `fc-bug-hunt` in place of `flowcharge` and
   `fc-validate`), confirm the full-install case fails with
   `status: 'missing-incomplete'`, and restore. That is ISS-42-q1t9bh's exact
   symptom, reproduced by the new test.

3. **Extract the chip rules and cover them.** Add
   `src/lib/agentic-tools-chip-rules.ts`, add its path to
   `src/public/tsconfig.json`'s `include`, rewrite
   `applyIntegrationsRowEligibility` and the two comment blocks in
   `src/public/home.ts` to call it, delete `home.ts`'s `parseSemver`, `isNewer`
   and `SEMVER_RE`, and add
   `src/test/unit/agentic-tools-chip-rules.test.ts` with the cases under
   Testing strategy.
   Runs after PLN-89-wpi985's stage 3, which rewrites the same function.
   Verify: `npm run build` passes all three `tsc` runs, the eval guard and the
   source-map check, and `npm test` passes with the new cases. Then temporarily
   invert one rule in the module — hide the version chip on
   `missing-incomplete` — confirm `npm test` fails, and revert. Then `npm start`
   and open Manage Integrations, and confirm by hand that the four states
   PLN-89-wpi985's stage 3 lists still render the same way, because this stage
   moves rules and must change no behaviour.

The two closing tasks this project requires — the `npm test` gate and the
`ARCHITECTURE.md` review — are fixed boilerplate the task-list author appends.
This plan forecasts no edit for either.

## Data & compatibility

- **No production code changes in stages 1 and 2.** No wire shape, no on-disk
  format, no port signature and no component boundary changes. `ARCHITECTURE.md`
  sections 2, 3, 5, 6, 7 and 8 are unaffected by these two stages.
- **No new dependency, runtime or development, in any stage.** `node:test`,
  `node:assert/strict` and `node:fs` cover stages 1 and 2, and stage 3's module
  imports nothing at all.
- **Layer rules hold.** Stages 1 and 2 add files under `src/test/` only, which
  the root `tsconfig.json` already compiles to `dist/test/` and `npm test`
  already globs. Stage 3 adds one file under `src/lib/`, which that same
  compilation already covers. Browser code still sees no Node type, because the
  new module uses none and the browser project keeps `"types": []`. Node code
  still sees no DOM type. The three `tsconfig.json` files stay three.
- **Test-suite rules hold.** `src/test/expected-skill-ids.ts` declares no test
  and carries no `.test.` in its name, per the `test-suites` constraint.
- **Stage 3 changes `ARCHITECTURE.md` section 11 and nothing else in that
  document.** The `browser-entry-bundles` constraint is narrowed as Decision 4
  states. Section 9 is untouched, because stage 3 adds no dependency of either
  kind. Sections 2, 3, 5, 6, 7 and 8 are untouched, because no component
  boundary, payload, route or external call changes: the new module is an
  internal refactor of rules that already run in the browser. The closing
  `ARCHITECTURE.md` review makes the section 11 edit.
- **Stage 3 changes no behaviour.** It moves rules and leaves each one as it is,
  so the modal renders exactly as PLN-89-wpi985 leaves it. Any visible
  difference after stage 3 is a defect in the move.
- **Stage 3 adds one file to the browser bundle graph.** `home.js` grows by the
  rules module only, because that module imports nothing.

## Testing strategy

This plan is itself test work, so this section records what each new case
asserts, stage by stage.

### `src/test/unit/agentic-tools-canonical-skills.test.ts` (new)

As listed under Design, stage 1: exact membership against the golden list, no
duplicates, `ak-prx-migrate` absent.

### `src/test/unit/server.test.ts` (extended)

As listed under Design, stage 2: full install, partial install, and a version
read from a partial install.

### `src/test/unit/agentic-tools-chip-rules.test.ts` (new)

Plain `node:test` and `node:assert/strict`, importing
`../../lib/agentic-tools-chip-rules.js` the way every other unit file imports
its subject. No DOM, no fetch, no temporary directory, no fixture beyond plain
object literals. Each row and each case below is one test case, asserted
against the returned `IntegrationsRowDecision`.

### Stage 3's decision table

Each row is one case. Presence values are the `SkillPresenceLike` union.

| Scope | hasLiveResult | Presence | Install chip | Version chip | Update offered |
| --- | --- | --- | --- | --- | --- |
| project | false | ignored | hidden | from the ledger record for that project | ledger rule |
| global | true | any | unchanged | normal rules | normal rules |
| global | false | undefined | hidden | normal rules | ledger rule |
| global | false | per-skill / fully-installed | already-installed | normal rules | normal rules |
| global | false | per-skill / missing-incomplete | missing-skills | normal rules | normal rules |
| global | false | per-skill / not-installed | hidden | hidden | false |
| global | false | shared-file / exists true | already-installed | normal rules | normal rules |
| global | false | shared-file / exists false | hidden | normal rules | normal rules |
| global | false | no-format | hidden | normal rules | normal rules |

Version resolution cases: `installedVersion` wins over the ledger version; an
empty or null `installedVersion` falls back to the ledger; neither present reads
unknown; an unparseable string reads unknown; a suffixed string such as
`1.2.3-beta.1` yields the numeric triple `1.2.3`.

Update cases: a strictly newer release tag offers the update; an equal tag does
not; an older tag does not; an unreadable tag on either side does not; a null
latest release does not; and the update is never offered when the version chip
is hidden.

Eligibility cases, driven through `basePath`: a non-null base path is eligible,
carries no `'not-supported-at-scope'` note and leaves the update button's
`disabled` state off; a `null` base path is ineligible, carries that note, and
still reports the same chips as its eligible twin, because ineligibility
disables controls and never hides a chip. Note cases: a row that is both
ineligible and unverified reports both notes, in that order; a verified,
eligible row reports none.

### Not covered by this plan

- The modal's DOM assembly, its dialog lifecycle, its scope toggle and its
  install path. The workstream record names the chip rules, and nothing wider.
- The painting step that stage 3 leaves in `src/public/home.ts`. Stage 3 covers
  the decisions, not the assignment of each decision to an element. That
  remainder is verified by hand, by the four states in stage 3's verify step.
- `src/public/lib/agentic-tools-scope.ts`, which keeps its two functions and
  stays untestable for the same reasons stage 3 lists.
- `src/public/app.ts` and the board renderers.

## Open questions

None. The two questions this plan carried are both settled. Stage 3's route is
Decision 4, and the golden list and the release gap are Decision 5. Every stage
is actionable.

## Adjacent opportunities

Noted only. None is planned here and none is actioned.

- `EXPECTED_IDS` in `src/test/unit/skill-content-fetch.test.ts` pins the live
  release to `fc-bug-hunt` and `fc-orchestrate`. It is correct today and will go
  red the moment the release is republished with the new names. That is a useful
  tripwire, but it means one republish turns one green suite red in a file this
  plan does not touch.
- `PRAXIS_REPO_BASE_URL` in `src/lib/skill-content-fetch.ts` points at
  `/akoukoullis/Praxis`, which the host now serves as a redirect to
  `/akoukoullis/flowcharge-core-archive`. The fetch still succeeds because
  redirects are followed.
- `src/public/lib/agentic-tools-scope.ts` has no test and, for the same three
  reasons stage 3 lists, cannot have one while it sits under `src/public/`.
  Decision 4's narrowing would also permit moving it, and this plan does not.
- `src/public/home.ts` re-authors `parseSemver` and `isNewer` from
  `src/lib/update-check.ts`. Stage 3 moves that copy into the rules module and
  covers it there, so the duplicate stays at two copies and one of them is then
  tested. Merging the two is not planned here, because `update-check.ts` uses
  the Node-only `Buffer` global and cannot enter the browser graph.

## Alternatives considered and rejected

1. **Start with the modal, as the workstream record's ordering suggests.**
   Rejected for sequencing only, not for value. Both shipped chips were wrong
   because the data was wrong, so stages 1 and 2 cover the actual defect sites,
   need no production code change and can land on their own. Stage 3 also has
   to follow PLN-89-wpi985's rewrite of the same function, so the modal cannot
   go first without waiting on that work.

2. **Pin the canonical list by comparing it with the live published release
   through `getInstallContent`.** Rejected for now. It is the only genuine drift
   detector, and `src/test/unit/skill-content-fetch.test.ts` already establishes
   a live-network tier with no skip-when-offline mechanism, so the precedent
   exists. It is rejected because the two lists disagree today, so the case
   would be red on the day it was written, and the project's closing test gate
   forbids merging that. Decision 5 owns this and states the consequence.

3. **Derive the golden list from `CANONICAL_PRAXIS_SKILL_IDS` itself.**
   Rejected: a test whose expectation is read from the code under test asserts
   nothing. The duplicate literal is the whole mechanism.

4. **Build the route fixture paths with `formatForTarget`.** Rejected for the
   same reason: the case would then pass for whatever path the code produced.
   The literal `skills/<id>/SKILL.md` pins the layout as well as the ids.

5. **Test `src/public/home.ts` by importing `dist/public/home.js` behind a
   hand-rolled DOM double.** Rejected. The bundle is an IIFE that exports
   nothing and resolves roughly twenty elements by id at evaluation time, so the
   double would have to fake `document`, `window`, `fetch`, `localStorage`, a
   `dialog`, `createElementNS`, `closest` and `dataset` before a single chip
   could be read, and it would then drive the rules only indirectly through
   fabricated events. It needs no dependency and no rule change, which is why it
   is recorded rather than dismissed, but it is several hundred lines of fixture
   to reach a nine-row decision table, and it breaks on any DOM call the page
   later adds.

6. **Emit `src/public/lib/*.ts` into `dist/public/lib/` and spare it from the
   bundler's sweep.** Rejected. The sweep exists so that readable per-file copies
   of browser code never ship beside the obfuscated bundle, and
   `ARCHITECTURE.md` section 11 states the rule that depends on it. Weakening a
   hardening measure to make a test reachable is the wrong trade.

7. **Add a fourth TypeScript project that compiles the browser's pure modules to
   a directory outside `dist/public/`.** Rejected. `CLAUDE.md` names the three
   separate `tsconfig.json` files as an invariant, and a fourth compilation with
   its own output root is a larger structural change than the narrowing Open
   question 1 recommends.

8. **Put the shared rules module in `src/core/` or `src/ports/`.** Rejected.
   `src/core/` is the board domain and may hold no user-facing concept; the
   integrations modal is not that domain. `src/ports/` holds contracts, not
   logic, even though its "no imports of any kind" rule happens to match what
   the rules module needs. Neither placement escapes the
   `browser-entry-bundles` constraint anyway, which forbids the bundle reaching
   server-side modules in general.

9. **Add `jsdom` as a devDependency and drive the built `home.js` bundle
   through a simulated page.** Rejected. It buys coverage of the DOM painting
   as well as the rules, which the chosen route leaves to a hand check, but it
   costs a development dependency for a nine-row decision table, it tests the
   obfuscated-or-not bundle rather than the rule, and it makes every future
   chip case slower to write. The project's standing position is to ask before
   any dependency, and the extraction needs none.

10. **Leave the modal's render rules uncovered and close the workstream on
    stages 1 and 2.** Rejected. The workstream record names the modal's chip
    rules as the gap, and both stages 1 and 2 cover the data behind the chips
    rather than the chips. Closing there would leave the named gap open.

## Final summary

Cover the data before the renderer. Stage 1 pins the eight canonical skill ids
against a golden literal held once in `src/test/expected-skill-ids.ts`. Stage 2
lays those same ids out on disk and drives them through the real presence route,
asserting a full install, a partial install and the version a partial install
reports. Both stages are tests only, need no dependency, and each is verified by
being made to fail on purpose before it is trusted. Stage 3 lifts the modal's
chip rules out of `src/public/home.ts` into one import-free module under
`src/lib/`, leaves every user-facing string behind, and drives the nine-row
decision table through plain `node --test`. That extraction narrows one accepted
constraint, `ARCHITECTURE.md` section 11's "nothing in a bundle may reach
`src/lib/`", to permit a browser entry importing a module that imports nothing;
the closing `ARCHITECTURE.md` review makes that edit, and nothing enforces the
narrowed rule automatically. One known consequence stands outside this
workstream: the published release still ships the pre-fix skill names, so an
install through FlowCharge's own installer still reproduces the "Missing skills"
symptom. No filed issue tracks that installer-path gap today, and filing one is
a separate step this plan does not take. No open question remains.
