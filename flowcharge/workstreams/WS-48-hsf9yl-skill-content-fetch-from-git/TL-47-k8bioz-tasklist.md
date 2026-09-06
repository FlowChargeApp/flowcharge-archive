---
id: TL-47-k8bioz
type: tasklist
workstream: WS-48-hsf9yl
slug: skill-content-fetch-from-git
title: "Fetch Praxis skill content live from Gitea instead of vendoring it"
status: done
created: 2026-08-20
updated: 2026-08-20
author: Anthony Koukoullis
depends_on: [PLN-39-e5xu5k]
links: []
mode: spec
base_commit: b741e98
---

# PRX Tasks

## Fetch Praxis skill content live from Gitea instead of vendoring it

Implements PLN-39-e5xu5k: replace WS-44's vendored `skills/` copy with a new
`src/lib/skill-content-fetch.ts` module that fetches the Praxis skill suite live, on every
`getInstallContent` call, from the self-hosted Gitea instance's
`GET /{owner}/{repo}/archive/{ref}.tar.gz` route
(`http://100.87.185.97:8110/akoukoullis/Praxis/archive/master.tar.gz`), using Node's built-in
`fetch` and `node:zlib` plus a hand-rolled USTAR tar reader (no new runtime dependency), wired
into `electron/agentic-tools-ipc-handlers.cts`'s still-placeholder `getInstallContent` via that
file's existing dynamic-import pattern. WS-44's vendored deliverables (`skills/`,
`tools/sync-praxis-skills.mjs`, `src/lib/skill-content.ts`, `src/lib/skill-content.test.ts`) are
deleted last, once the replacement is proven wired and working. Both of the plan's own Open
Questions are already settled per this workstream's Context: no cache (re-fetch fresh every
call) and no ref-pinning (track `master`'s moving tip) — both match the plan's Design/Contracts
as written, so no task below revisits them.

- [x] 1. Phase 1 — Fetch/extract/parse module, fully tested in isolation
  ```yaml
  description: "Build the new dependency-free live-fetch module and its offline+live test suite, exercised entirely in isolation from the IPC wiring."
  ```

  - [x] 1.1 Build `src/lib/skill-content-fetch.ts`
    ```yaml
    description: "New module: config constants, fetch+gunzip download, hand-rolled USTAR parseTar, path-prefix stripping, exclusion filtering, frontmatter parsing, and getInstallContent, per the plan's Design/Contracts section."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/lib/skill-content-fetch.ts, following the exact structure and header-comment style of src/lib/skill-content.ts (the file this replaces) — it must not know about install targets, tool-specific formats, install tracking, or how content gets written to disk."
      - "Define local SkillContent/InstallContent interfaces identical in shape to src/lib/agentic-tools-content.ts's (id/name/description/body/files? and version/skills), so getInstallContent is structurally assignable to that file's GetInstallContent port with no adapter — same technique the deleted skill-content.ts used."
      - "Define const PRAXIS_REPO_BASE_URL = 'http://100.87.185.97:8110/akoukoullis/Praxis' and const PRAXIS_REPO_REF = 'master', and function buildArchiveUrl(baseUrl, ref) returning `${baseUrl}/archive/${ref}.tar.gz` — templated so a future host swap (e.g. github.com) is a one-line constant change (acceptance criterion 5)."
      - "Define interface TarEntry { name: string; typeflag: string; content: Buffer } and function parseTar(buf: Buffer): TarEntry[] that walks 512-byte header blocks, reading name (bytes 0-100, NUL-padded), typeflag (byte 156), and size (bytes 124-136, octal ASCII). It must advance the read offset past ceil(size/512)*512 data bytes regardless of typeflag — this is what safely skips the archive's leading PAX 'g' pax_global_header record (see plan Assumptions) — and only push a TarEntry for typeflag '0' (file) or '5' (directory), stopping at the first all-zero 512-byte block."
      - "Carry forward, verbatim, the frontmatter grammar from the pre-deletion src/lib/skill-content.ts:41-112: the isExcluded(name) three-rule filter (dotfile, .git*, *.zip), the FRONTMATTER/FOLDED_INDICATOR regexes, unquote, parseFrontmatterFields, and parseSkillFrontmatter — it is already correct and needs no redesign."
      - "Implement async function getInstallContent(_toolId: string): Promise<InstallContent> per the plan's 7-step Design: (1) fetch(buildArchiveUrl(...)), throw if !res.ok; (2) gunzipSync(Buffer.from(await res.arrayBuffer())); (3) parseTar(...); (4) strip each entry's first path segment generically via name.split('/').slice(1).join('/') — never hardcode 'praxis'; (5) keep only stripped paths starting with 'skills/', group by the next segment (skill id) into { skillMdContent, files[] }, applying isExcluded per path segment; (6) for each skill id with a SKILL.md entry, run parseSkillFrontmatter, sort files[] by relativePath, sort skills by id; (7) return { version: 'fetched-from-git', skills }."
    pattern: "src/lib/skill-content-fetch.ts (new)"
    imports: "node:zlib (gunzipSync), Node's global fetch — no new runtime dependency (package.json's build.files excludes node_modules from the packaged app, per the plan's Alternatives-considered rejection of a real tar/unzipper dependency)"
    compatibility: "SkillContent/InstallContent must stay structurally identical to src/lib/agentic-tools-content.ts's exported shapes (src/lib/agentic-tools-content.ts:10-20) so this module's getInstallContent satisfies the GetInstallContent port with no adapter."
    gotcha: "The archive's first 512-byte header block is a PAX global extended header (typeflag 'g', not '0'/'5') that git archive (which Gitea's archive route shells out to) always emits before the real entries — a parser that only recognizes '0'/'5' and doesn't skip an unrecognized typeflag's data blocks will misinterpret every offset after it and fail on the very first real entry. Caching and ref-pinning are explicitly out of scope for this task (both Open Questions are settled: no cache, no pin)."
    verify:
      - "npm run build"
      - "grep -n \"export async function getInstallContent\" dist/lib/skill-content-fetch.js confirms the compiled module exports the port function (full behavioural coverage is task 1.2's job)"
    checklist:
      - "buildArchiveUrl and PRAXIS_REPO_BASE_URL/PRAXIS_REPO_REF are separate named constants, not inlined into one fetch call"
      - "parseTar advances past any entry's data blocks regardless of typeflag, only emitting entries for '0' and '5'"
      - "getInstallContent strips the first path segment generically, with no literal 'praxis' string in the stripping logic"
      - "SkillContent/InstallContent interfaces are structurally identical to agentic-tools-content.ts's shapes"
      - "No new dependency is added to package.json"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.2 Write `src/lib/skill-content-fetch.test.ts`
    ```yaml
    description: "Three-tier test suite: offline parseTar unit tests, offline frontmatter-parser unit tests, and one live-network integration test against the real Gitea host."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/lib/skill-content-fetch.test.ts using the project's existing node:test + node:assert/strict convention (see src/lib/skill-content.test.ts, src/lib/agentic-tools-content.test.ts for the established style)."
      - "Tier (a), offline: build a small in-memory USTAR Buffer covering a regular file entry, a directory entry, and a leading unrecognized-typeflag ('g') record, and assert parseTar skips the 'g' record and correctly parses the two real entries."
      - "Tier (b), offline: assert parseSkillFrontmatter/parseFrontmatterFields against inline fixture strings covering a same-line description: scalar and a folded '>-' multi-line block-scalar case — port the equivalent assertions from the deleted src/lib/skill-content.test.ts (its 'folded-block-scalar description parses to a single non-empty string' test), since that fixture directory (skills/) is gone."
      - "Tier (c), live: one test calling the real getInstallContent() end-to-end, asserting the known 8 prx-* skill ids (prx-bug-hunt, prx-dev-principles, prx-git, prx-issue-list, prx-orchestrate, prx-plain-text-kanban, prx-plan-feature, prx-task-list) and prx-orchestrate's known nested files[] list (CONVENTIONS.md plus its 11 prompts/*.md and 2 scripts/* files) — mirroring the deleted skill-content.test.ts's assertions, now against the live fetch instead of the committed fixture."
      - "Do not add any skip-when-offline mechanism for tier (c) — a Gitea-unreachable failure is this feature's accepted, by-design failure mode (acceptance criterion 3), not a reason to make the test conditional."
    pattern: "src/lib/skill-content-fetch.test.ts (new)"
    imports: "node:test, node:assert/strict; getInstallContent and parseTar (or an internal test-only export of it) from ./skill-content-fetch.js"
    compatibility: "Run via the project's existing `node --test dist/lib/*.test.js` convention — no new test runner or framework."
    gotcha: "Tier (c) depends on the Gitea host being reachable over Tailscale at test time; that is expected and matches the plan's Testing strategy, not a defect to work around."
    verify:
      - "npm run build"
      - "node --test dist/lib/skill-content-fetch.test.js"
    checklist:
      - "Offline parseTar test covers a regular file, a directory, and a leading unrecognized-typeflag ('g') record in one synthetic buffer"
      - "Offline frontmatter test covers both a same-line description and a folded '>-' multi-line case"
      - "The live test asserts the known 8 prx-* skill ids and prx-orchestrate's known nested files[] list"
      - "No test reads from the deleted skills/ fixture directory"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Phase 2 — Wire the real reader into the IPC handler
  ```yaml
  description: "Replace the standalone placeholder getInstallContent in electron/agentic-tools-ipc-handlers.cts with a dynamic-import-backed call into the new live-fetch module, following the file's existing eight-module dynamic-import pattern."
  ```

  - [x] 2.1 Wire `electron/agentic-tools-ipc-handlers.cts` to the real `getInstallContent`
    ```yaml
    description: "Delete the placeholder getInstallContent function and add an eighth dynamic-import block (matching the file's existing seven) that resolves the real implementation from src/lib/skill-content-fetch.ts."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Delete the placeholder `async function getInstallContent` at electron/agentic-tools-ipc-handlers.cts:221-223 (`return { version: 'placeholder', skills: [] };`), along with its preceding 'still-placeholder Gap 1 port' comment at lines 218-220."
      - "Add `type GetInstallContentFn = (toolId: string) => Promise<InstallContent>;` alongside the file's other locally-mirrored type aliases (InstallToTargetFn, RemoveInstallationFn, etc. at lines 170-193). The existing local InstallContent interface at lines 147-156 already matches the new module's shape and needs no change."
      - "Add `let getInstallContent!: GetInstallContentFn;` alongside the file's other definite-assignment lets at lines 235-243."
      - "Inside registerAgenticToolsIpcHandlers, add an eighth dynamic-import block alongside the seven existing ones (lines 251-273), in the same style: `const skillContentModule = (await dynamicImport('../lib/skill-content-fetch.js')) as { getInstallContent: GetInstallContentFn };`"
      - "Alongside the file's other post-import assignments (lines 275-283), add `getInstallContent = skillContentModule.getInstallContent;`"
      - "Leave the installSelected handler's call site (`const content = await getInstallContent(target.toolId);`, line 296) and its surrounding try/catch (lines 288-308) unchanged — same signature, same await; the try/catch already turns any thrown fetch/gunzip/tar error into { ok: false, status: 500, error } for free."
    pattern: "electron/agentic-tools-ipc-handlers.cts"
    imports: "../lib/skill-content-fetch.js, resolved only via the file's existing dynamicImport() helper — never a static value or type import (see the file's own header comment on why: CommonJS/ESM mismatch and the narrow electron/tsconfig.json rootDir)."
    compatibility: "Must compile under electron/tsconfig.json's narrow rootDir (this directory only) — no import from src/lib/*.ts other than through dynamicImport()."
    gotcha: "This file's dynamic-import specifiers resolve relative to its compiled location (dist/electron/agentic-tools-ipc-handlers.cjs), not the .cts source — '../lib/skill-content-fetch.js' is correct because dist/lib/ sits two levels up, exactly like the other seven modules."
    verify:
      - "npm run build"
      - "Manual smoke test (plan Phase 2, task 3 — no automated IPC-level harness exists today): npm run electron:dev, open the onboarding install screen, select a detected tool and the canonical skills, run install, and confirm the installed files on disk contain real skill body/description content, not an empty list."
    checklist:
      - "getInstallContent(toolId) ignores toolId and returns the same InstallContent regardless of which tool asked (acceptance criterion 2)"
      - "A Gitea-unreachable or non-2xx response causes getInstallContent to reject, surfacing through the existing try/catch as { ok: false, status: 500, error } with no offline/vendored fallback (acceptance criterion 3)"
      - "installSelected's call site and surrounding try/catch are byte-for-byte unchanged"
      - "None of agentic-tools-install.ts, agentic-tools-install-tracking.ts, agentic-tools-fs-adapter.ts, agentic-tools-catalogue.ts, agentic-tools-detect.ts, agentic-tools-skill-presence.ts, or agentic-tools-canonical-skills.ts is touched (plan's Out of scope)"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 3. Phase 3 — Remove the superseded vendored deliverables
  ```yaml
  description: "Delete WS-44's vendored skills/ tree and its supporting sync script and reader module, once Phase 2's live-fetch wiring is proven working. Confirmed during reconnaissance that this deletion carries no runtime regression risk: agentic-tools-ipc-handlers.cts's real, wired getInstallContent was always the standalone placeholder, never skill-content.ts's implementation."
  ```

  - [x] 3.1 Delete `skills/`
    ```yaml
    description: "Remove the vendored skills/ tree (8 prx-* skill directories), superseded by the live Gitea fetch."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run `git rm -r skills/` to delete the vendored skills/ directory and its 8 prx-* subdirectories."
    pattern: "skills/ (directory)"
    imports: "none"
    compatibility: "none additional beyond Phase 2 being wired and working first"
    gotcha: "Delete only after task 2.1 is verified working — do this deletion last among Phase 3's children if executing out of order, since it removes the fixture the deleted test file (task 3.4) used to read from."
    verify:
      - "ls skills/ reports no such file or directory"
    checklist:
      - "skills/ no longer exists in the working tree"
      - "The deletion is staged via git rm -r, not a bare filesystem delete"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 3.2 Delete `tools/sync-praxis-skills.mjs`
    ```yaml
    description: "Remove the vendoring sync script, superseded by the live Gitea fetch."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run `git rm tools/sync-praxis-skills.mjs` to delete the sync script."
    pattern: "tools/sync-praxis-skills.mjs"
    imports: "none"
    compatibility: "none additional"
    gotcha: "Confirm no npm script or CI step still invokes this file before deleting (none found in package.json's scripts during reconnaissance)."
    verify:
      - "ls tools/sync-praxis-skills.mjs reports no such file or directory"
    checklist:
      - "tools/sync-praxis-skills.mjs no longer exists"
      - "No package.json script references it"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 3.3 Delete `src/lib/skill-content.ts`
    ```yaml
    description: "Remove the vendored-tree reader module, superseded by src/lib/skill-content-fetch.ts."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run `git rm src/lib/skill-content.ts` to delete the module."
    pattern: "src/lib/skill-content.ts"
    imports: "none"
    compatibility: "none additional"
    gotcha: "Nothing outside this file and its own test file references it (confirmed by grep during reconnaissance), so no other source edit is required alongside this deletion."
    verify:
      - "ls src/lib/skill-content.ts reports no such file or directory"
    checklist:
      - "src/lib/skill-content.ts no longer exists"
      - "grep -rn \"from './skill-content.js'\" src/ returns nothing"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 3.4 Delete `src/lib/skill-content.test.ts`, then confirm the full Phase 3 acceptance criteria
    ```yaml
    description: "Remove the vendored-tree reader's test file, then run the plan's combined acceptance check (acceptance criterion 4) across all four Phase 3 deletions together."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run `git rm src/lib/skill-content.test.ts` to delete the test file."
      - "Only after tasks 3.1-3.3 are also complete: run the combined acceptance check below, which validates all four deletions together."
    pattern: "src/lib/skill-content.test.ts"
    imports: "none"
    compatibility: "none additional"
    gotcha: "This is the last task in the plan's staged breakdown; its verify step is intentionally the plan's combined, cross-file acceptance check (acceptance criterion 4), not just a check on this one file."
    verify:
      - "grep -rn \"skill-content\\.|sync-praxis-skills\" --include=*.ts --include=*.cts --include=*.mjs . (excluding node_modules and flowcharge/) returns nothing"
      - "npm run build succeeds"
      - "node --test dist/lib/*.test.js — the full existing suite stays green with the deleted files gone"
      - "git status shows only these four Phase 3 deletions plus Phase 1/2's additions and edits for this workstream"
    checklist:
      - "src/lib/skill-content.test.ts no longer exists"
      - "The combined grep for skill-content./sync-praxis-skills returns zero matches outside node_modules/flowcharge/"
      - "npm run build and the full node --test dist/lib/*.test.js suite both pass with skills/, tools/sync-praxis-skills.mjs, src/lib/skill-content.ts, and src/lib/skill-content.test.ts all gone"
    self_eval:
      passed: true
      failures: []
    ```
