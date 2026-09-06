---
id: TL-45-s0t4ii
type: tasklist
workstream: WS-47-z1v46r
slug: onboarding-existing-install-detection
title: "Manage integrations dialog: read persisted install status on open"
status: done
created: 2026-08-19
updated: 2026-08-19
author: Anthony Koukoullis
depends_on: [IL-7-mtt0l5]
links: []
mode: spec
base_commit: bec0548
---

# PRX Tasks

## Manage integrations dialog install-status read

Fixes ISS-11-sbxv53: the "Manage integrations" dialog (`src/public/home.ts`) never calls
`window.praxisSkillInstallAPI.getInstallStatus()` when it opens, so a target Praxis has
already installed to shows no install-status indication until the user re-runs
`installSelected()` in the current session. `getInstallStatus()` and its IPC/preload
wiring already exist and work (WS-42/WS-43); this is a client-side consumption gap in
`src/public/home.ts` only. The fix fetches the persisted `InstallRecord[]` registry
alongside the existing `detectTools()` call, joins it client-side by `toolId` +
scope-equality, and renders a distinct "Already installed" chip — status only, the
checkbox stays unchecked by default, and no new IPC call is made on a scope toggle.

This file also covers ISS-13-hwhz6b (task 2) and ISS-12-yngl4x (task 3), authored in
the same session as the investigation that diagnosed both. Task 2 fixes
`selectPrimaryFormat` (`src/lib/agentic-tools-format.ts`) so it skips every
`IntegrationFormat` kind `formatForTarget` doesn't implement, not just `mcp-json` —
without this, OpenCode's real catalogue entry always resolves to an unimplemented
`structured-config-file` format and every OpenCode install silently fails as
`skipped-no-format`. Task 3 depends on task 2's fix: it adds a real filesystem
presence check for the canonical 8-skill Praxis suite (a new
`agentic-tools-canonical-skills.ts` id list and `agentic-tools-skill-presence.ts`
check, wired through a new `checkInstalledSkills` IPC channel), and replaces this
dialog's ISS-11 ledger-based pre-action chip with this strictly-more-accurate one —
since the app's own `.praxis-installs.json` ledger has no way to know about a Praxis
skill suite that exists on disk for any reason other than this app's own past
`installSelected()` runs.

- [x] 1. Read persisted install status into the integrations dialog and render it as a distinct chip
  ```yaml
  description: "loadIntegrationsDetection() fetches getInstallStatus() alongside detectTools(); applyIntegrationsRowEligibility() joins the persisted registry against the current scope and renders a separate 'Already installed' chip, leaving checkboxes unchecked and requiring no refetch on scope toggle."
  author: Anthony Koukoullis
  issues: [ISS-11-sbxv53]
  implement:
    - "In src/public/home.ts, add a module-scoped `scopesEqual` predicate mirroring agentic-tools-install-tracking.ts's private `scopesEqual` (that file's lines 24-28, not exported) — place it inside the IIFE near the other Manage-integrations helpers, e.g. directly above `buildIntegrationsRow` (home.ts:462), matching this file's own header-documented mirror-not-import pattern (home.ts:1-11) rather than importing it."
    - "Add a module state variable holding the fetched registry, e.g. `var integrationsInstallRecords: InstallRecord[] = [];`, right after `var integrationsRowEntries: IntegrationsRowEntry[] = [];` (home.ts:460) — same fetched-once / cleared-on-close lifecycle documented in that variable's own comment (home.ts:455-459)."
    - "Add a label constant for a persisted, merely-matched InstallRecord, distinct from INSTALL_STATUS_LABEL (home.ts:440-445) — e.g. `var ALREADY_INSTALLED_LABEL = 'Already installed';` placed directly after it, in its own binding rather than folded into INSTALL_STATUS_LABEL's Record."
    - "In the IntegrationsRowEntry type (home.ts:447-453), add a boolean field (e.g. `hasLiveResult`) that lets applyIntegrationsRowEligibility tell a row whose installChip was already set by a live installSelected() result this dialog session apart from one that hasn't. Initialize it to `false` in buildIntegrationsRow's returned object (home.ts:483)."
    - "In installIntegrationsSelected's results.forEach callback that sets entry.installChip.textContent/.hidden (home.ts:590-595), also set `entry.hasLiveResult = true` — see Divergence 1 for why this guard is needed beyond the original recommendation."
    - "In applyIntegrationsRowEligibility (home.ts:488-499), after the existing eligibility/notes logic and only when `!entry.hasLiveResult`: find a record in integrationsInstallRecords whose toolId matches entry.row.toolId and whose scope satisfies scopesEqual against currentIntegrationsScope; if found set entry.installChip.textContent = ALREADY_INSTALLED_LABEL and entry.installChip.hidden = false, otherwise set entry.installChip.hidden = true. Do not touch entry.checkbox.checked — every freshly-built row must stay unchecked, per this file's own stated invariant (home.ts:535-536). Because this function already runs once per row from renderIntegrationsRows (home.ts:533) and again for every row from refreshIntegrationsEligibility on every scope toggle (home.ts:501-506), this one change covers both the dialog-open render and the scope-toggle re-evaluation — refreshIntegrationsEligibility itself needs no edit, and no new IPC call happens on toggle."
    - "In loadIntegrationsDetection (home.ts:543-561), fetch detectTools() and getInstallStatus() in parallel with Promise.all instead of only calling detectTools(), storing the resolved InstallRecord[] into integrationsInstallRecords before calling renderIntegrationsRows(rows). Illustrative only: \n```js\nreturn Promise.all([\n  window.praxisSkillInstallAPI.detectTools().then(unwrapIpc),\n  window.praxisSkillInstallAPI.getInstallStatus().then(unwrapIpc)\n]).then(function (results) {\n  integrationsInstallRecords = results[1];\n  renderIntegrationsRows(results[0]);\n})\n```\nOn the existing .catch path (home.ts:549-560), also reset `integrationsInstallRecords = [];` alongside the existing `integrationsRowEntries = [];` so a failed fetch never leaves a stale registry behind."
    - "In resetIntegrationsModalState (home.ts:610-617), clear `integrationsInstallRecords = [];` alongside the existing `integrationsRowEntries = [];` (home.ts:613), so the fetched registry does not persist across a close+reopen cycle, per that function's own stated purpose."
  pattern: "src/public/home.ts"
  imports: "None new. InstallRecord (home.ts:36-44) and window.praxisSkillInstallAPI.getInstallStatus() (home.ts:52) are already mirrored/declared in this file from WS-42/WS-43 — only their consumption is missing. Do not touch electron/preload.cts or electron/agentic-tools-ipc-handlers.cts; both already work."
  compatibility: "Must compile under src/public/tsconfig.json's strict:true, module:'none' classic-script config (no ES import/export — this is a plain <script>, not a module), matching the rest of the file's var/function (non-arrow, non-const) style. scopesEqual must be mirrored, not imported: agentic-tools-install-tracking.ts's version (lines 24-28) is a private, non-exported function, and this file pair's own header comment (home.ts:1-11) establishes mirror-not-import as the deliberate pattern for every install-tracking shape reused here — do not add an export to agentic-tools-install-tracking.ts to work around this."
  gotcha: "InstallRecord (src/lib/agentic-tools-install-tracking.ts:14-22) has no status field — never compare it against INSTALL_STATUS_LABEL's InstallResult['status'] union or reuse that map's keys; a merely-matched, persisted record has had no hash comparison run against it, unlike a live installSelected() outcome. getInstallStatus() returns the ENTIRE .praxis-installs.json registry (every toolId, every scope) with no server-side filtering (electron/preload.cts:28, electron/agentic-tools-ipc-handlers.cts) — all toolId/scope matching must happen client-side in home.ts. A scope toggle must never trigger a new detectTools()/getInstallStatus() call — only re-run the client-side join against the array already fetched at dialog open. Without the hasLiveResult guard, a scope toggle performed after a live installSelected() call in the same dialog session would re-run applyIntegrationsRowEligibility and clobber (or hide) that fresh, real InstallResult chip with a stale or absent persisted-match verdict, since integrationsInstallRecords was fetched before the live install ran and will not contain it. Do not pre-check checkbox.checked for a matched row — status is rendered, selection stays opt-in, matching this dialog's existing unchecked-by-default invariant."
  verify:
    - "npx tsc -p src/public/tsconfig.json --noEmit"
    - "grep -n \"integrationsInstallRecords\\|ALREADY_INSTALLED_LABEL\\|hasLiveResult\" src/public/home.ts to confirm all three new identifiers landed"
  checklist:
    - "Opening 'Manage integrations' for a tool with a matching InstallRecord at the current scope shows the 'Already installed' chip immediately, without clicking Install selected or Re-scan"
    - "The matched row's checkbox is still unchecked by default"
    - "Toggling Global<->Project scope re-derives every chip from the already-fetched integrationsInstallRecords with no new detectTools() or getInstallStatus() call"
    - "A chip set by a live installSelected() result during this dialog session is left unchanged by a later scope toggle"
    - "INSTALL_STATUS_LABEL and the new persisted-match label remain two distinct constants, never merged"
    - "integrationsInstallRecords is cleared on both a failed loadIntegrationsDetection() fetch and on dialog close (resetIntegrationsModalState)"
  self_eval:
    passed: true
    failures: []
  ```

- [x] 2. Fix selectPrimaryFormat to skip every IntegrationFormat kind formatForTarget doesn't implement

  ```yaml
  description: "selectPrimaryFormat(tool) in src/lib/agentic-tools-format.ts currently skips only the 'mcp-json' kind when picking a tool's primary integration format. formatForTarget's own kind-dispatch implements exactly four kinds (skill-directory, rule-directory, single-rule-file, markdown-context-file) and throws for the other two (mcp-json explicitly, structured-config-file via its generic fallback) — confirmed by reading formatForTarget in this session. Widening selectPrimaryFormat's exclusion set to match fixes OpenCode's real catalogue entry, which currently resolves to a structured-config-file entry (opencode.json) ahead of its working skill-directory entry."
  ```

  - [x] 2.1 Widen selectPrimaryFormat's exclusion set from 'mcp-json' only to every kind formatForTarget doesn't implement
    ```yaml
    description: "selectPrimaryFormat (src/lib/agentic-tools-format.ts:17-19) returns tool.integrationFormats.find((f) => f.kind !== 'mcp-json') ?? null. Change the predicate so it also skips 'structured-config-file' — the only other IntegrationFormat kind formatForTarget's dispatch (agentic-tools-format.ts:58-72) does not implement (it throws explicitly for 'mcp-json' at line 60, and falls through to the generic 'is not yet implemented' throw at line 71 for anything else, which today means only 'structured-config-file' — 'skill-directory', 'rule-directory', 'single-rule-file', and 'markdown-context-file' are all implemented above it)."
    author: Anthony Koukoullis
    issues: [ISS-13-hwhz6b]
    implement:
      - "In src/lib/agentic-tools-format.ts, replace selectPrimaryFormat's inline `f.kind !== 'mcp-json'` predicate (lines 17-19) with a check against the full set of kinds formatForTarget does not implement — both 'mcp-json' and 'structured-config-file' — rather than 'mcp-json' alone. Illustrative only:\n```ts\nconst UNIMPLEMENTED_KINDS = new Set(['mcp-json', 'structured-config-file']);\nexport function selectPrimaryFormat(tool: ToolDefinition): IntegrationFormat | null {\n  return tool.integrationFormats.find((f) => !UNIMPLEMENTED_KINDS.has(f.kind)) ?? null;\n}\n```"
      - "Update the function's own doc comment (lines 15-16, 'Returns the first integrationFormats entry whose kind is not mcp-json') to describe the widened rule, so the comment stays accurate rather than describing the old, narrower behaviour."
      - "Leave formatForTarget itself (lines 58-72) completely untouched — it already throws correctly for both kinds; this task only changes which entry selectPrimaryFormat hands it in the first place."
    pattern: "src/lib/agentic-tools-format.ts"
    imports: "None new — IntegrationFormat is already imported (line 7)."
    compatibility: "Must keep selectPrimaryFormat's signature (tool: ToolDefinition) => IntegrationFormat | null unchanged — agentic-tools-install.ts:74 and this workstream's own home.ts call sites depend on that exact shape."
    gotcha: "This exclusion set duplicates knowledge that formatForTarget's if/else chain already encodes (a kind is 'implemented' iff formatForTarget doesn't throw for it) — there is no compiler check tying the two together, so a future kind added to IntegrationFormat['kind'] (agentic-tools-catalogue.ts:18-19) or a future kind implemented in formatForTarget must update this exclusion set too, or selectPrimaryFormat will silently start returning either a now-implemented kind it still filters out, or a still-unimplemented kind it forgot to filter. A comment stating this duplication and the requirement to keep it in sync is expected, since the code itself cannot enforce it. Do not touch agentic-tools-catalogue.ts's OpenCode integrationFormats array order (ISS-13's own investigation ruled out catalogue reordering as the fix) — the array order is fine as-is once the wider exclusion set is applied."
    verify:
      - "npm run build"
      - "node --test dist/lib/agentic-tools-format.test.js (see task 2.2 for the new assertion this must pass)"
    checklist:
      - "selectPrimaryFormat no longer ever returns a structured-config-file entry for any tool in TOOL_CATALOGUE"
      - "selectPrimaryFormat(opencodeTool) now resolves to the skill-directory entry (skills/<name>/SKILL.md), not opencode.json"
      - "selectPrimaryFormat's result for Cursor and Windsurf (both rule-directory-first, no structured-config-file entries) is unchanged"
      - "formatForTarget's own source (lines 58-72) is byte-for-byte unmodified"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.2 Extend agentic-tools-format.test.ts to prove selectPrimaryFormat now resolves OpenCode's catalogue entry to its skill-directory format
    ```yaml
    description: "agentic-tools-format.test.ts already has real-catalogue selectPrimaryFormat tests for Cursor and Windsurf (lines 101-115) but none for OpenCode. Add one, following the same catalogueTool()-lookup pattern, asserting the fixed selectPrimaryFormat resolves OpenCode to its skill-directory entry and never to structured-config-file."
    author: Anthony Koukoullis
    issues: [ISS-13-hwhz6b]
    implement:
      - "In src/lib/agentic-tools-format.test.ts, add a new test immediately after the existing 'selectPrimaryFormat resolves the real Windsurf catalogue entry...' test (lines 109-115) and before 'formatForTarget throws when called directly with Cursor's real mcp-json entry' (line 117), using catalogueTool('opencode') the same way the Cursor/Windsurf tests use catalogueTool('cursor')/('windsurf'). Illustrative only:\n```ts\ntest('selectPrimaryFormat resolves the real OpenCode catalogue entry to its skill-directory format, never structured-config-file', () => {\n  const opencode = catalogueTool('opencode');\n  const resolved = selectPrimaryFormat(opencode);\n  assert.notEqual(resolved, null);\n  assert.equal(resolved?.kind, 'skill-directory');\n  assert.notEqual(resolved?.kind, 'structured-config-file');\n});\n```"
      - "Leave the existing 'formatForTarget throws for a not-yet-implemented kind' test (lines 70-77) and its comment untouched — formatForTarget itself is not changing, so structured-config-file remains the kind that test exercises directly against formatForTarget."
    pattern: "src/lib/agentic-tools-format.test.ts"
    imports: "None new — catalogueTool, selectPrimaryFormat, and assert are already imported/defined in this file."
    compatibility: "Follow this file's existing node:test + node:assert/strict style exactly (test(name, fn) blocks, assert.equal/assert.notEqual) — no new test framework or helper."
    gotcha: "This test only passes once task 2.1's fix has landed; written against the current (pre-fix) selectPrimaryFormat it would fail with resolved?.kind === 'structured-config-file'. Author/run this after 2.1, not before."
    verify:
      - "npm run build"
      - "node --test dist/lib/agentic-tools-format.test.js"
    checklist:
      - "The new test asserts resolved?.kind === 'skill-directory' for OpenCode's real catalogue entry"
      - "The new test also asserts resolved?.kind !== 'structured-config-file', guarding the specific regression ISS-13 describes"
      - "All pre-existing tests in this file (Cursor, Windsurf, mcp-json-throws, not-yet-implemented-kind) still pass unmodified"
    self_eval:
      passed: true
      failures:
        - item: "Full test-suite sweep (post-completion, before commit)"
          reason: "Task 2.1's fix (widening selectPrimaryFormat's exclusion set) was correct and scoped exactly as intended, but it legitimately changed real behavior two OTHER pre-existing test files depended on: (1) agentic-tools-catalogue.test.ts's 'no consumer imports agentic-tools modules yet' test, a WS-41-authored one-time fact-check whose premise (no consumer exists yet) WS-42/43 already made permanently false by design, unrelated to this fix but caught in the same sweep; (2) agentic-tools-install.test.ts's four-tool installAllGlobal test, which hardcoded the OLD bug as its expected OpenCode outcome (status: 'skipped-no-format') — now that OpenCode correctly resolves to skill-directory, it installs successfully like the other three tools, so the old assertion is factually wrong post-fix, not a regression to preserve."
          fix: "Removed the obsolete catalogue test entirely (nothing meaningful left to assert). Updated the install test to fold OpenCode into the same 'status: installed' assertion loop as the other three tools, with a note that installAllGlobal's own try/catch remains defensive for any future unimplemented-format tool even though nothing exercises it today. Full suite re-run after both corrections: node --test dist/lib/*.test.js — 69/69 pass, 0 failures."
    ```

- [x] 3. Add real filesystem presence detection for the canonical Praxis skill suite, independent of the app's own install-tracking ledger

  ```yaml
  description: "ISS-11-sbxv53's fix (task 1) reads the app's own .praxis-installs.json ledger on dialog open, but that ledger only records installs this app performed itself — it has no knowledge of a Praxis skill suite already present on disk for any other reason. This adds a real filesystem presence check for the canonical 8-skill Praxis suite (a new src/lib/agentic-tools-canonical-skills.ts + agentic-tools-skill-presence.ts pair, a new checkInstalledSkills IPC channel, its preload exposure, and home.ts wiring that replaces the dialog's ledger-based pre-action chip with this strictly-more-accurate one) and depends on task 2's selectPrimaryFormat fix landing first, since the presence check resolves each skill's expected path via selectPrimaryFormat + formatForTarget."
  ```

  - [x] 3.1 Add the canonical Praxis skill id list as a new, explicitly provisional file
    ```yaml
    description: "New file src/lib/agentic-tools-canonical-skills.ts exporting CANONICAL_PRAXIS_SKILL_IDS: string[], the 8 canonical skill ids in a fixed order, documented as a provisional stand-in for WS-44's not-yet-landed vendored suite."
    author: Anthony Koukoullis
    issues: [ISS-12-yngl4x]
    implement:
      - "Create src/lib/agentic-tools-canonical-skills.ts exporting `export const CANONICAL_PRAXIS_SKILL_IDS: string[] = [...]` with exactly these 8 ids, in this order: prx-orchestrate, prx-git, prx-bug-hunt, prx-issue-list, prx-dev-principles, prx-plan-feature, prx-task-list, prx-plain-text-kanban."
      - "Head the file with a comment stating plainly that this array is a provisional, hardcoded duplicate of the skill suite WS-44-h5cpzp ('Vendor the Praxis skill suite into this repo as the installer's real content source', status: ready, unimplemented as of this session — confirmed by reading flowcharge/workstreams/WS-44-h5cpzp-vendor-praxis-skill-content/workstream.md) will eventually vendor for real, and that once WS-44 lands this array should be replaced or derived from the real skills/ directory or from getInstallContent()'s returned skill ids instead of hand-maintained here."
      - "In that same comment, explicitly state that 'ak-prx-migrate' — a real skill present in this machine's own ~/.claude/skills/, per ISS-12-yngl4x's own repro steps — is NOT part of this suite and is deliberately excluded, so a future editor is not tempted to add it."
    pattern: "src/lib/agentic-tools-canonical-skills.ts (new file)"
    imports: "None."
    compatibility: "Plain ESM module, matching every sibling src/lib/agentic-tools-*.ts file (compiled by the root tsconfig.json, not src/public's classic-script config)."
    gotcha: "This list's order matters to task 3.2's per-skill correspondence logic only insofar as it must line up 1:1, by position, with formatForTarget's per-skill FileWrite output — it does not need to match any particular on-disk or catalogue order otherwise. Keep membership to exactly these 8 — do not add ak-prx-migrate or any tool-specific skill."
    verify:
      - "npm run build"
      - "grep -n \"CANONICAL_PRAXIS_SKILL_IDS\" dist/lib/agentic-tools-canonical-skills.js to confirm the compiled export exists"
    checklist:
      - "The exported array has exactly 8 entries, in the specified order"
      - "ak-prx-migrate does not appear anywhere in the file"
      - "The header comment names WS-44-h5cpzp and its ready/unimplemented status"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.2 Add a real filesystem presence-check function for one tool's canonical skill suite
    ```yaml
    description: "New file src/lib/agentic-tools-skill-presence.ts exporting checkSkillPresence(tool, basePath, skillIds, fsAccess), reusing formatForTarget (task 2's fixed selectPrimaryFormat) to resolve each skill's expected on-disk path and FsAccess.pathExists to check it, returning a three-state per-skill result for skill-directory/rule-directory kinds and a coarser shared-file result for single-rule-file/markdown-context-file kinds."
    author: Anthony Koukoullis
    issues: [ISS-12-yngl4x]
    implement:
      - "Create src/lib/agentic-tools-skill-presence.ts. Export a SkillPresenceResult discriminated union and an async checkSkillPresence(tool: ToolDefinition, basePath: string, skillIds: string[], fsAccess: FsAccess): Promise<SkillPresenceResult>. Illustrative only:\n```ts\nexport type SkillPresenceResult =\n  | { checkKind: 'per-skill'; status: 'fully-installed' | 'missing-incomplete' | 'not-installed';\n      presentSkillIds: string[]; missingSkillIds: string[] }\n  | { checkKind: 'shared-file'; exists: boolean }\n  | { checkKind: 'no-format' };\n```"
      - "Resolve the format via selectPrimaryFormat(tool) (src/lib/agentic-tools-format.ts, fixed by task 2.1). If it returns null, return `{ checkKind: 'no-format' }` immediately — there is nothing on disk to check for a tool with no implemented format."
      - "Build a stub InstallContent whose skills array is skillIds.map(id => ({ id, name: '', description: '', body: '' })) — confirmed against SkillContent (agentic-tools-content.ts:10-16): id/name/description/body are the only required fields, files is optional and can be omitted — then call formatForTarget(format, stubContent) to get its FileWrite[]."
      - "For format.kind === 'skill-directory' or 'rule-directory': formatForTarget's skillDirectoryWrites/ruleDirectoryWrites (agentic-tools-format.ts:21-32, 38-43) each emit exactly one FileWrite per input skill, in the same order as content.skills, so writes[i] corresponds to skillIds[i]. For each i, resolve `${basePath}/${writes[i].relativePath}` — the same join agentic-tools-install.ts:91 already uses — and call fsAccess.pathExists on it (agentic-tools-signals.ts:9); partition skillIds into presentSkillIds/missingSkillIds and derive status ('fully-installed' when nothing is missing, 'not-installed' when nothing is present, else 'missing-incomplete'); return the 'per-skill' result."
      - "For format.kind === 'single-rule-file' or 'markdown-context-file': formatForTarget's singleDocumentWrite (agentic-tools-format.ts:48-51) always emits exactly one shared FileWrite regardless of skill count, so no individual skill's presence can be distinguished within it. Per the investigation's Gap 1 (documented as a real, intentional scope limit, not an oversight), return the coarser `{ checkKind: 'shared-file', exists }` from a single fsAccess.pathExists call on that one resolved path, and say so in a code comment."
    pattern: "src/lib/agentic-tools-skill-presence.ts (new file)"
    imports: "ToolDefinition (type) from ./agentic-tools-catalogue.js; FsAccess (type) from ./agentic-tools-signals.js; selectPrimaryFormat and formatForTarget (values) from ./agentic-tools-format.js; InstallContent (type, for the stub's shape only) from ./agentic-tools-content.js."
    compatibility: "Read-only: only ever call fsAccess.pathExists, never anything from FsWriteAccess (agentic-tools-install.ts) — this module checks presence, it never writes. Plain ESM module like every sibling src/lib/agentic-tools-*.ts file."
    gotcha: "Depends on task 2.1 landing first: before that fix, selectPrimaryFormat(opencodeTool) resolves to a structured-config-file entry and formatForTarget throws on it, so this function would throw for OpenCode instead of returning a result — do not add a defensive try/catch here to paper over that; task 2.1 is the real fix and this function should trust selectPrimaryFormat's corrected output. The per-skill index correspondence (writes[i] <-> skillIds[i]) relies on skillDirectoryWrites/ruleDirectoryWrites never reordering or filtering content.skills — true today (both are a single unfiltered iteration) but would silently break this function if either ever changed. Cursor and Windsurf's real catalogue entries resolve (after task 2's fix) to rule-directory, never single-rule-file/markdown-context-file, so the coarser shared-file path is currently unreached by any real catalogue tool's primary format — it exists only for defensive completeness against the full IntegrationFormat['kind'] union."
    verify:
      - "npm run build"
      - "node --test dist/lib/agentic-tools-skill-presence.test.js (see task 3.3)"
    checklist:
      - "checkSkillPresence returns 'no-format' for a tool whose only integrationFormats entries are kinds selectPrimaryFormat now excludes"
      - "checkSkillPresence returns a 'per-skill' result with correct presentSkillIds/missingSkillIds for a skill-directory-format tool"
      - "checkSkillPresence returns a 'shared-file' result, never a 'per-skill' one, for a single-rule-file/markdown-context-file-format tool"
      - "No FsWriteAccess method (mkdir/writeTextFileAtomic/remove) is called or imported anywhere in this file"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.3 Add unit tests for checkSkillPresence
    ```yaml
    description: "New file src/lib/agentic-tools-skill-presence.test.ts, following agentic-tools-format.test.ts's node:test + node:assert/strict pattern, covering the three SkillPresenceResult states plus the no-format case, against both fixture formats and OpenCode's real catalogue entry (proving task 2's fix and task 3.2's function compose correctly end to end)."
    author: Anthony Koukoullis
    issues: [ISS-12-yngl4x]
    implement:
      - "Create src/lib/agentic-tools-skill-presence.test.ts. Define a small fake FsAccess test double whose pathExists resolves based on membership in a Set/array of 'existing' paths supplied per test, with isDirectory/resolveBinaryOnPath/expandTokens as unused stubs — no real filesystem access, matching agentic-tools-format.test.ts's own fixture-over-real-I/O style."
      - "Cover, at minimum: (1) a skill-directory-kind fixture format with all skillIds present → 'per-skill'/'fully-installed'; (2) the same format with some present → 'missing-incomplete', with correct presentSkillIds/missingSkillIds; (3) none present → 'per-skill'/'not-installed'; (4) a single-rule-file-kind fixture format → 'shared-file' with exists true and false in separate tests; (5) a fixture tool whose only format is mcp-json → 'no-format'; (6) an integration test against catalogueTool('opencode') (TOOL_CATALOGUE, same helper pattern as agentic-tools-format.test.ts:16-20) confirming it resolves via the real skill-directory format post-task-2-fix, not by throwing."
    pattern: "src/lib/agentic-tools-skill-presence.test.ts (new file)"
    imports: "node:test, node:assert/strict; TOOL_CATALOGUE and IntegrationFormat (type) from ./agentic-tools-catalogue.js; checkSkillPresence and SkillPresenceResult (type) from ./agentic-tools-skill-presence.js; FsAccess (type) from ./agentic-tools-signals.js."
    compatibility: "Run via `node --test dist/lib/agentic-tools-skill-presence.test.js` after npm run build, exactly like every other *.test.ts file in this directory — no new test runner or dependency."
    gotcha: "Test (6) only passes once task 2.1 has landed — it is a direct regression guard for ISS-13 composed with ISS-12, so if it fails, check task 2's fix before suspecting this file. The fake FsAccess's pathExists must match paths by the exact resolved string checkSkillPresence builds (`${basePath}/${relativePath}`) — an off-by-one in a test's basePath or expected relativePath will silently produce a false 'not-installed' rather than a test failure, so assert on presentSkillIds/missingSkillIds explicitly rather than only on the summary status."
    verify:
      - "npm run build"
      - "node --test dist/lib/agentic-tools-skill-presence.test.js"
    checklist:
      - "All three per-skill statuses (fully-installed, missing-incomplete, not-installed) are exercised by at least one passing test each"
      - "The shared-file case is exercised for both exists:true and exists:false"
      - "The no-format case is exercised"
      - "The real-catalogue OpenCode test passes, proving it no longer throws"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.4 Register the checkInstalledSkills IPC channel
    ```yaml
    description: "electron/agentic-tools-ipc-handlers.cts gets a fifth ipcMain.handle channel, checkInstalledSkills, that dynamic-imports checkSkillPresence and CANONICAL_PRAXIS_SKILL_IDS (never a static import, per this file's own header-comment rule) and calls checkSkillPresence with the request's toolId+basePath resolved against TOOL_CATALOGUE, mirroring installSelected's existing lookup/try-catch shape."
    author: Anthony Koukoullis
    issues: [ISS-12-yngl4x]
    implement:
      - "In electron/agentic-tools-ipc-handlers.cts, add a hand-mirrored local SkillPresenceResult type (matching task 3.2's exported union) alongside the other locally-mirrored types, e.g. directly after the InstallContent interface (lines 147-156) and before the *Fn type aliases (line 158) — following this file's established mirror-not-import pattern (see the file's own header comment, lines 9-53) for exactly the same reason: a static import of task 3.2's value or type exports would crash at runtime (ERR_REQUIRE_ESM) or fail to compile (TS6059), as already diagnosed for every other src/lib dependency this file uses."
      - "Add a CheckSkillPresenceFn type alias next to the other *Fn aliases (lines 158-175), and `let checkSkillPresence!: CheckSkillPresenceFn;` plus `let CANONICAL_PRAXIS_SKILL_IDS!: string[];` next to the other `let ...!: ...;` declarations (lines 217-223)."
      - "Inside registerAgenticToolsIpcHandlers (lines 225-256), add two more dynamicImport() calls — for '../lib/agentic-tools-skill-presence.js' and '../lib/agentic-tools-canonical-skills.js' — following the exact same `(await dynamicImport(specifier)) as {...}` shape the five existing calls already use (lines 231-247), and assign their results into the new variables the same way the existing assignments do (lines 249-255)."
      - "After the existing detectTools handler (ends line 324, before the function's closing brace on line 325), register `ipcMain.handle('checkInstalledSkills', async (_event, request: InstallTargetRequest): Promise<PraxisIpcResult<SkillPresenceResult>> => {...})`, reusing the already-declared InstallTargetRequest type (lines 186-190) verbatim as the request shape rather than inventing a narrower one — scope goes unused by this handler but the type is already shared across every other channel here. Follow installSelected's exact try/catch and TOOL_CATALOGUE.find((t) => t.id === request.toolId) lookup shape (lines 257-282): on an unknown toolId, return an ok:false PraxisIpcResult rather than calling checkSkillPresence with an undefined tool; otherwise call checkSkillPresence(tool, request.basePath, CANONICAL_PRAXIS_SKILL_IDS, createNodeFsAccess()) and wrap the result as { ok: true, status: 200, data: result }."
    pattern: "electron/agentic-tools-ipc-handlers.cts"
    imports: "None new at the top level (ipcMain, path, os are already imported, lines 55-57) — the only new dependencies (checkSkillPresence, CANONICAL_PRAXIS_SKILL_IDS) come solely through the existing dynamicImport() mechanism, never a static import statement."
    compatibility: "createNodeFsAccess (already dynamic-imported and assigned at line 254) is reused as-is — call createNodeFsAccess() fresh per request, exactly as the existing detectTools handler does at line 313, not cached across requests."
    gotcha: "This file's header comment (lines 9-53) documents, from direct testing this session, exactly why a static VALUE or TYPE-ONLY import from any src/lib/agentic-tools-*.ts module breaks this file (ERR_REQUIRE_ESM at runtime, or TS6059 at compile time even for `import type`) — the new SkillPresenceResult type and the checkSkillPresence/CANONICAL_PRAXIS_SKILL_IDS values must go through the same hand-mirror-plus-dynamic-import pattern as every existing dependency here, with zero exceptions. The local SkillPresenceResult mirror must be kept in sync by hand with task 3.2's real export, same caveat this file already states for its other mirrored types (lines 47-53)."
    verify:
      - "npm run build"
      - "grep -n \"checkInstalledSkills\" dist/electron/agentic-tools-ipc-handlers.cjs to confirm the channel compiled and registered"
    checklist:
      - "No static `import` statement (value or type-only) from any src/lib/agentic-tools-*.ts module appears anywhere in this file"
      - "checkInstalledSkills resolves checkSkillPresence and CANONICAL_PRAXIS_SKILL_IDS through dynamicImport(), exactly like the other five modules this file already loads"
      - "An unknown toolId in the request returns an ok:false PraxisIpcResult instead of throwing or calling checkSkillPresence with undefined"
      - "The handler compiles cleanly under electron/tsconfig.json (npm run build produces no TS6059 or other error for this file)"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.5 Expose checkInstalledSkills on window.praxisSkillInstallAPI
    ```yaml
    description: "electron/preload.cts's praxisSkillInstallAPI object gets a fifth forwarding method, checkInstalledSkills, alongside installSelected/getInstallStatus/removeInstallation/detectTools — a plain ipcRenderer.invoke forward, no adapter logic, matching every other method in this object."
    author: Anthony Koukoullis
    issues: [ISS-12-yngl4x]
    implement:
      - "Add checkInstalledSkills to the praxisSkillInstallAPI object literal in electron/preload.cts, forwarding straight to the new 'checkInstalledSkills' channel — see the SEARCH/REPLACE block below."
    pattern: "electron/preload.cts"
    imports: "None new — contextBridge and ipcRenderer are already imported (line 8)."
    compatibility: "Must stay inside the existing contextBridge.exposeInMainWorld('praxisSkillInstallAPI', {...}) call (lines 26-32) — a second, separate exposeInMainWorld('praxisSkillInstallAPI', ...) call would overwrite this one rather than merge with it."
    gotcha: "This file forwards raw PraxisIpcResult promises with zero adapter/error-translation logic by design (file header, lines 1-6) — do not unwrap, catch, or reshape the result here; task 3.6's home.ts caller is what unwraps via unwrapIpc, exactly as it already does for the other four methods."
    verify:
      - "npm run build"
      - "grep -n \"checkInstalledSkills\" dist/electron/preload.cjs to confirm it compiled into the exposed object"
    checklist:
      - "checkInstalledSkills forwards to ipcRenderer.invoke('checkInstalledSkills', ...) with no added logic"
      - "The other four existing methods on praxisSkillInstallAPI are byte-for-byte unchanged"
    self_eval:
      passed: true
      failures: []
    ```

    ```typescript
    electron/preload.cts
    <<<<<<< SEARCH
    contextBridge.exposeInMainWorld('praxisSkillInstallAPI', {
      installSelected: (targets: unknown) => ipcRenderer.invoke('installSelected', targets),
      getInstallStatus: () => ipcRenderer.invoke('getInstallStatus'),
      removeInstallation: (toolId: string, scope: unknown) =>
        ipcRenderer.invoke('removeInstallation', toolId, scope),
      detectTools: () => ipcRenderer.invoke('detectTools'),
    });
    =======
    contextBridge.exposeInMainWorld('praxisSkillInstallAPI', {
      installSelected: (targets: unknown) => ipcRenderer.invoke('installSelected', targets),
      getInstallStatus: () => ipcRenderer.invoke('getInstallStatus'),
      removeInstallation: (toolId: string, scope: unknown) =>
        ipcRenderer.invoke('removeInstallation', toolId, scope),
      detectTools: () => ipcRenderer.invoke('detectTools'),
      checkInstalledSkills: (target: unknown) => ipcRenderer.invoke('checkInstalledSkills', target),
    });
    >>>>>>> REPLACE
    ```

  - [x] 3.6 Wire the integrations dialog to real fs presence, replacing the ledger-based pre-action chip
    ```yaml
    description: "loadIntegrationsDetection() stops fetching getInstallStatus() for the row-rendering path and instead calls checkInstalledSkills() per eligible row; applyIntegrationsRowEligibility renders the pre-action chip from that real presence result instead of the persisted-ledger join, leaving the post-action hasLiveResult chip (ISS-11's fix) completely untouched."
    author: Anthony Koukoullis
    issues: [ISS-12-yngl4x]
    implement:
      - "Add a SkillPresenceResult type mirror to home.ts's top-of-file mirror block (alongside InstallResult/InstallRecord, lines 30-44), and add `checkInstalledSkills(target: { toolId: string; basePath: string; scope: InstallScope }): Promise<PraxisIpcResult<SkillPresenceResult>>;` as a fifth method on the Window.praxisSkillInstallAPI interface (lines 46-55) — leave getInstallStatus's own declaration there untouched, since preload.cts/the IPC handler still expose it for installToTarget's internal use."
      - "Remove scopesEqual (lines 452-459) — its only caller is the ledger-join block this task replaces, so once that block is gone it has no remaining caller in this file."
      - "Replace `var integrationsInstallRecords: InstallRecord[] = [];` (lines 480-484) with a new state map, e.g. `var integrationsSkillPresence: Record<string, SkillPresenceResult> = {};`, keeping the same fetched-once/cleared-on-close lifecycle comment style."
      - "Add a second chip label next to ALREADY_INSTALLED_LABEL (line 450), e.g. `var INCOMPLETE_INSTALL_LABEL = 'Missing skills';`, for the missing-incomplete state, and update ALREADY_INSTALLED_LABEL's own comment (lines 447-449) — it no longer describes a ledger match, it now describes a fully-present real fs check."
      - "In applyIntegrationsRowEligibility (lines 519-544), replace the `!entry.hasLiveResult` block (lines 533-543) so it reads `integrationsSkillPresence[entry.row.toolId]` instead of joining integrationsInstallRecords: map a 'per-skill'/'fully-installed' or a 'shared-file'/exists:true result to ALREADY_INSTALLED_LABEL, a 'per-skill'/'missing-incomplete' result to INCOMPLETE_INSTALL_LABEL, and anything else (not-installed, no-format, shared-file/exists:false, or no entry at all) to installChip.hidden = true. Because checkInstalledSkills's result is only valid for the basePath it was fetched against, and that basePath is scope-dependent while the fetch (below) only ever runs at global scope, gate this whole block on `currentIntegrationsScope.kind === 'global'` — hide the chip outright at Project scope rather than showing a stale global-scope result under a Project-scope label. This is a deliberate, bounded scope limit (see task list Divergence 2), not an oversight; say so in a code comment."
      - "In loadIntegrationsDetection (lines 591-613), stop calling getInstallStatus(). Call detectTools() alone, call renderIntegrationsRows(rows) as soon as it resolves (so entries exist to update), then Promise.all over each row where resolveBasePathForScope({ kind: 'global' }, row.detection) !== null, calling window.praxisSkillInstallAPI.checkInstalledSkills({ toolId: row.toolId, basePath: <that basePath>, scope: { kind: 'global' } }).then(unwrapIpc), storing each into integrationsSkillPresence[row.toolId], then calling refreshIntegrationsEligibility() once all resolve so already-rendered rows pick up their chips. Illustrative only:\n```js\nfunction loadIntegrationsDetection() {\n  return window.praxisSkillInstallAPI.detectTools().then(unwrapIpc).then(function (rows) {\n    renderIntegrationsRows(rows);\n    var checks = rows.map(function (row) {\n      var basePath = resolveBasePathForScope({ kind: 'global' }, row.detection);\n      if (basePath === null) return null;\n      return window.praxisSkillInstallAPI.checkInstalledSkills({ toolId: row.toolId, basePath: basePath, scope: { kind: 'global' } })\n        .then(unwrapIpc).then(function (r) { integrationsSkillPresence[row.toolId] = r; });\n    });\n    return Promise.all(checks).then(refreshIntegrationsEligibility);\n  });\n}\n```On the existing .catch path (lines 600-611), reset `integrationsSkillPresence = {};` in place of the removed `integrationsInstallRecords = [];`."
      - "In resetIntegrationsModalState (lines 663-671), replace `integrationsInstallRecords = [];` (line 667) with `integrationsSkillPresence = {};`."
    pattern: "src/public/home.ts"
    imports: "None new. resolveBasePathForScope (src/public/lib/agentic-tools-scope.ts:19-25) is already loaded ahead of this script and already used elsewhere in this file (line 634)."
    compatibility: "Must keep compiling under src/public/tsconfig.json's strict:true, module:'none' classic-script config — var/function style, no import/export, matching the rest of this IIFE."
    gotcha: "getInstallStatus() itself, electron/preload.cts's exposure of it, and .praxis-installs.json are NOT touched by this task — installToTarget() still reads that ledger internally for its own hash/up-to-date logic (agentic-tools-install.ts:80-84); only this dialog's pre-action display stops reading it. The post-action hasLiveResult chip (installIntegrationsSelected, lines 625-656, and its guard in applyIntegrationsRowEligibility) is a completely separate mechanism from ISS-11's fix and must be left untouched — one chip slot, two mutually exclusive sources (pre-action fs-truth vs. post-action live result), never both. The global-scope-only gating of the presence chip (see Divergence 2) means a user who switches to Project scope sees no presence chip at all for any row, even a genuinely-installed one — this is intentional, not a bug, given no per-scope refetch was in scope for this task."
    verify:
      - "npx tsc -p src/public/tsconfig.json --noEmit"
      - "grep -n \"integrationsSkillPresence\\|checkInstalledSkills\\|INCOMPLETE_INSTALL_LABEL\" src/public/home.ts to confirm the new identifiers landed, and grep -n \"scopesEqual\\|integrationsInstallRecords\" src/public/home.ts to confirm both are fully gone"
    checklist:
      - "Opening the dialog for a tool with all 8 canonical skills present on disk shows ALREADY_INSTALLED_LABEL without any getInstallStatus() call"
      - "A tool with some but not all canonical skills present shows INCOMPLETE_INSTALL_LABEL, distinct from ALREADY_INSTALLED_LABEL"
      - "A tool with none present, or no implemented format, shows no chip at all"
      - "Toggling to Project scope hides the presence chip rather than showing a stale global-scope result"
      - "A live installSelected() result (hasLiveResult) during this dialog session is left completely unchanged by this task's logic"
      - "scopesEqual and integrationsInstallRecords no longer appear anywhere in home.ts"
    self_eval:
      passed: true
      failures: []
    ```

## Divergences

1. **Live-result guard not in the original recommendation.** The investigation's recommendation 4 assumed the scope-toggle join could live entirely inside `applyIntegrationsRowEligibility` with no additional state. Reading `installIntegrationsSelected` as authored in this session (home.ts:573-603) shows it already writes a real `InstallResult` outcome directly onto `entry.installChip` (home.ts:590-595) after a live install in the current dialog session. Without a guard, a scope toggle performed afterward would re-run the join in `applyIntegrationsRowEligibility` against `integrationsInstallRecords` — which was fetched once at dialog-open and therefore does not contain that just-written record — and would overwrite or hide the fresh, correct live chip with a stale or absent persisted-match verdict. Consequence: task 1 adds one field beyond the investigation's stated scope, `IntegrationsRowEntry.hasLiveResult`, set by `installIntegrationsSelected` and checked by `applyIntegrationsRowEligibility`, purely to prevent this regression — no other capability is added.

2. **Presence-chip scope gating not specified by the investigation.** The investigation's recommendation for wiring `checkInstalledSkills` into `home.ts` (point 5) described replacing the `getInstallStatus()` call but did not address what a scope toggle (Global vs Project) should do to the new fs-truth presence chip, unlike ISS-11's ledger join, which was inherently scope-aware (`scopesEqual` matched a persisted record's own recorded scope). `checkInstalledSkills` instead needs a resolved `basePath`, which is itself scope-dependent (`resolveBasePathForScope`, `src/public/lib/agentic-tools-scope.ts:19-25`), and the dialog's existing invariant is that a scope toggle never triggers a new IPC call (`home.ts:425-428`, `585-590`). Consequence: task 3.6 resolves this gap by fetching `checkInstalledSkills` once, at dialog-open time, always at Global scope (the scope `resetIntegrationsModalState` always leaves the dialog in on close, `home.ts:663-665`), and gating the chip's visibility on `currentIntegrationsScope.kind === 'global'` — hiding it outright at Project scope rather than either showing a stale global-scope result under a Project-scope label, or adding a new per-scope refetch beyond this task's stated scope.

3. **A dedicated test file for `agentic-tools-skill-presence.ts` was not itself requested.** The investigation's five-item recommendation for ISS-12 (canonical-skills file, skill-presence file, IPC channel, preload exposure, home.ts wiring) did not mention a test file, unlike ISS-13's instructions, which explicitly asked for one. Every existing sibling file in `src/lib/agentic-tools-*.ts` (`agentic-tools-format.ts`, `agentic-tools-content.ts`, `agentic-tools-install-tracking.ts`, `agentic-tools-fs-adapter.ts`) has a co-located `*.test.ts`, and this task list's own `verify` guidance prefers the project's own test commands. Consequence: task 3 was split into six children rather than the five the investigation listed, adding task 3.3 (`agentic-tools-skill-presence.test.ts`) as a companion to task 3.2, purely for verification — no additional production functionality was added beyond what the investigation specified.
</content>
