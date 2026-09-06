---
id: TL-40-5fwkfg
type: tasklist
workstream: WS-42-7fm9ak
slug: skill-install-sync-engine
title: "Write, format, track, and expose over IPC the Praxis skill install engine, on Electron"
status: done
created: 2026-08-17
updated: 2026-08-19
author: Anthony Koukoullis
depends_on: [PLN-32-m51bp8]
links: []
mode: spec
base_commit: 0d82a04
---

# PRX Tasks

## Skill Install Sync Engine

Implements PLN-32-m51bp8 as narrowed to four tools (Claude Code, OpenCode, Cursor, Windsurf)
on Electron. This file **replaces** the earlier eight-tool-targeted task list at this same
path, reusing the same `TL-40-5fwkfg` id — the earlier tasks covering Kilo's
structured-config-file merge and Roo's global-scope exclusion are discarded wholesale, not
merged, per PLN-32-m51bp8's own current scope. Six `src/lib/` modules —
`agentic-tools-content.ts`, `agentic-tools-format.ts`, `agentic-tools-install-tracking.ts`,
`agentic-tools-install.ts`, and the new `agentic-tools-fs-adapter.ts` — plus a new Electron
main-process file, `electron/agentic-tools-ipc-handlers.cts`, together turn a WS-41 detection
result into an actual write of the Praxis skill integration at that target, in the target's
native format, plus a durable tracking record, exposed to the renderer as
`window.praxisSkillInstallAPI`. The plan's own six-phase breakdown is followed exactly: Phase 1
lands the content/format contracts, the `skill-directory` kind, and an end-to-end
`installToTarget` on Claude Code; Phase 2 adds `rule-directory`/`single-rule-file` plus the
`mcp-json` exclusion proof (Cursor and Windsurf both always resolve to their rules format);
Phase 3 wires install-state tracking (update/no-op/uninstall semantics); Phase 4 adds
full-catalogue global-run orchestration across all four tools; Phase 5 — new in this pivot,
previously blocked under Tauri — implements a concrete `FsWriteAccess` adapter on plain
`node:fs/promises`; Phase 6 — also new — registers three `ipcMain.handle` channels that call
the `src/lib` engine directly, in-process, with no loopback HTTP relay (unlike WS-37's own
project-CRUD channels), and exposes them as a second, distinct preload global. Real skill
content (`getInstallContent`, Gap 1) stays an injected port with only fixture/placeholder
implementations everywhere in this workstream, including the real IPC wiring — unresolved and
explicitly out of scope, per the plan's own Open questions. Every test runs against in-memory
fakes except Phase 5's concrete-adapter tests, which run against a real temporary directory —
the plan's one open point already settled for this task list. Verification uses this project's
own `npm run build` (root `tsconfig.json`, which already includes `src/lib/**/*.ts` with zero
config change needed) followed by `node --test` against the compiled `dist/lib/*.test.js`
output, per `src/lib/extract.test.ts`'s precedent; Phase 6's electron-specific edits verify via
`npx tsc -p electron/tsconfig.json --noEmit` directly, since `package.json`'s `build` script has
not yet been extended with an electron compile step as of this file's `base_commit` (see
Divergence 2). There is no separate lint or `npm test` script in `package.json` today
(confirmed by reading `package.json` this session: `build`, `prestart`, `start`, `prerefresh`,
`refresh` only).

- [x] 1. Phase 1 — Content/format contracts, `skill-directory` kind, Claude Code end-to-end install
  ```yaml
  description: "Land SkillContent/InstallContent/hashInstallContent, FileWrite/selectPrimaryFormat/the skill-directory formatter, and installToTarget for the skill-directory case only (no tracking yet) — proven end to end on Claude Code's WS-41 catalogue entry."
  ```

  - [x] 1.1 Define install content types and content hashing
    ```yaml
    description: "Create agentic-tools-content.ts with SkillContent, InstallContent, GetInstallContent, and hashInstallContent; prove hash stability under key/array reordering."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/lib/agentic-tools-content.ts (new file)."
      - "Define `interface SkillContent { id: string; name: string; description: string; body: string; files?: { relativePath: string; content: string }[] }` per plan Design > Contracts — id is assumed prx-prefixed (plan Assumption 2), but this type does not itself enforce the prefix."
      - "Define `interface InstallContent { version: string; skills: SkillContent[] }`, with `version` documented as caller-supplied content identity, informational only — hashInstallContent is the value actually compared for change detection."
      - "Define `type GetInstallContent = (toolId: string) => Promise<InstallContent>` — the Gap 1 seam, per plan Out of scope: stays a port with only fixture/placeholder implementations everywhere in this workstream, including the real IPC wiring in Phase 6 (plan Assumption 9)."
      - "Implement `function hashInstallContent(content: InstallContent): string` using node:crypto's `crypto.createHash('sha256')`, matching src/lib/projects.ts's `crypto.createHash('sha1')` precedent (src/lib/projects.ts:18), over a canonical JSON encoding of content.skills sorted by id, so field order and array order never change the hash."
      - "Create the sibling src/lib/agentic-tools-content.test.ts, following src/lib/extract.test.ts's node:test + node:assert/strict pattern: assert hashInstallContent returns the same string for two InstallContent fixtures with the same two skills in different property/array order, and a different string when one skill's body changes (plan Phase 1 task 1's verify line)."
    pattern: "src/lib/agentic-tools-content.ts, src/lib/agentic-tools-content.test.ts (both new)"
    imports: "node:crypto; node:test, node:assert/strict in the test file"
    compatibility: "TypeScript strict mode per root tsconfig.json; ES2022 target; no runtime dependency added. Falls under tsconfig.json's existing src/lib/**/*.ts include glob, zero config edit needed (confirmed against the file's actual content this session — no edit required)."
    gotcha: "Sort by skill.id, not by insertion order, or the hash-stability test will fail — JSON.stringify does not sort object keys or array elements on its own; the canonical encoding step must do this explicitly."
    verify:
      - "npm run build"
      - "node --test dist/lib/agentic-tools-content.test.js"
    checklist:
      - "hashInstallContent returns the same string for two InstallContent values whose skills array is reordered."
      - "hashInstallContent returns a different string when any skill's body changes."
      - "GetInstallContent, SkillContent, and InstallContent are exported types usable from a sibling module."
      - "No filesystem, tool-id-specific, or format-kind logic appears in this file, per Design > 'What each module knows / must not know'."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.2 Define FileWrite, selectPrimaryFormat, and the skill-directory formatter
    ```yaml
    description: "Create agentic-tools-format.ts with FileWrite, selectPrimaryFormat, and formatForTarget's skill-directory case; throw on mcp-json and on every not-yet-implemented kind."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/lib/agentic-tools-format.ts (new file)."
      - "Define `interface FileWrite { relativePath: string; content: string }`."
      - "Implement `function selectPrimaryFormat(tool: ToolDefinition): IntegrationFormat | null` — returns the first entry in tool.integrationFormats whose kind !== 'mcp-json', or null if none exists. Import ToolDefinition and IntegrationFormat from WS-41's src/lib/agentic-tools-catalogue.ts rather than redefining them, per plan Design > 'Where this fits' — see Divergence 1: that file does not exist in this repo as of this session, since WS-41's own task list has not executed."
      - "Implement `function formatForTarget(format: IntegrationFormat, content: InstallContent): FileWrite[]` for the skill-directory case only in this task: one FileWrite per skill at `<pathTemplate with <name> substituted for skill.id>/SKILL.md`, plus one FileWrite per entry in that skill's optional files[] array, alongside it."
      - "Throw (never no-op) if format.kind === 'mcp-json', even though selectPrimaryFormat never returns an mcp-json entry — formatForTarget must guard itself independently, per Gap 2 and plan acceptance criterion 1."
      - "For every format.kind not yet implemented (rule-directory, single-rule-file, markdown-context-file — added in Phase 2; structured-config-file is out of scope entirely, per this plan's narrowing to four tools), throw a clear 'not yet implemented' or 'unsupported kind' error rather than silently returning []."
      - "Create the sibling src/lib/agentic-tools-format.test.ts: a two-skill fixture (one skill with a files[] entry, one without) run through formatForTarget with a skill-directory-kind IntegrationFormat fixture, asserting the exact expected FileWrite list — paths and content, not just count (plan Phase 1 task 2's verify line)."
    pattern: "src/lib/agentic-tools-format.ts, src/lib/agentic-tools-format.test.ts (both new)"
    imports: "./agentic-tools-content.js (InstallContent); WS-41's src/lib/agentic-tools-catalogue.js (ToolDefinition, IntegrationFormat) — see Divergence 1"
    compatibility: "TypeScript strict mode; ES2022 target; falls under tsconfig.json's existing src/lib/**/*.ts include glob."
    gotcha: "mcp-json exclusion must be enforced inside formatForTarget itself, not only via selectPrimaryFormat's filtering, or a caller that bypasses selectPrimaryFormat could silently write content into an mcp-json target — this is Gap 2's explicit finding."
    verify:
      - "npm run build"
      - "node --test dist/lib/agentic-tools-format.test.js"
    checklist:
      - "formatForTarget produces one SKILL.md FileWrite per skill plus each skill's files[] entries, for the skill-directory kind."
      - "formatForTarget throws when called with format.kind === 'mcp-json'."
      - "selectPrimaryFormat never returns an mcp-json entry."
      - "No FsWriteAccess, tool-id-specific, or IPC logic appears in this file, per Design > 'What each module knows / must not know'."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.3 Define FsWriteAccess and installToTarget for the skill-directory case
    ```yaml
    description: "Create agentic-tools-install.ts with FsWriteAccess, InstallTarget, InstallResult, and installToTarget covering only the skill-directory case (no tracking registry yet); prove writes against Claude Code's catalogue entry with a fake port."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/lib/agentic-tools-install.ts (new file)."
      - "Define `interface FsWriteAccess { readTextFile(path): Promise<string|null>; writeTextFileAtomic(path, content): Promise<void>; mkdir(path): Promise<void>; remove(path): Promise<void>; expandTokens(path): Promise<string> }` per plan Design > Contracts — a pure port type, no implementation in this file."
      - "Define `interface InstallTarget { tool: ToolDefinition; basePath: string; scope: InstallScope }`, `type InstallStatus = 'installed' | 'updated' | 'up-to-date' | 'skipped-no-format'`, `interface InstallResult { toolId: string; status: InstallStatus; resolvedPath: string | null }`."
      - "Implement `installToTarget(target, content, registryPath, deps)` for the skill-directory case only: resolve the format via selectPrimaryFormat, format via formatForTarget, mkdir the resolved directory, then write each FileWrite via deps.fsWrite.writeTextFileAtomic using the same sibling-tmp-file-then-rename pattern src/lib/projects.ts's writeProjects uses (src/lib/projects.ts:42-47: `${registryPath}.${process.pid}.tmp` written, then renamed over the target) — generalized here to each resolved file path rather than one fixed registryPath. No tracking-registry read/write yet (Phase 3)."
      - "Return status 'installed' when writes succeed; 'skipped-no-format' when selectPrimaryFormat returns null."
    pattern: "src/lib/agentic-tools-install.ts, src/lib/agentic-tools-install.test.ts (both new)"
    imports: "./agentic-tools-content.js (InstallContent); ./agentic-tools-format.js (selectPrimaryFormat, formatForTarget); WS-41's src/lib/agentic-tools-catalogue.js (ToolDefinition) — see Divergence 1"
    compatibility: "TypeScript strict mode; ES2022 target. The atomic-write pattern must match src/lib/projects.ts's own tmp-file-then-rename shape (sibling file, not OS temp dir, so rename stays same-filesystem) per plan acceptance criterion 3."
    gotcha: "Do not read or write the tracking registry in this task — that lands in Phase 3 (task 3.2). Keep this task's installToTarget scope limited to formatting + writing only, or the fake FsWriteAccess call-count assertions in later phases' no-op tests will be built against a wrong baseline."
    verify:
      - "npm run build"
      - "node --test dist/lib/agentic-tools-install.test.js"
    checklist:
      - "A fake FsWriteAccess records every writeTextFileAtomic call made by installToTarget."
      - "Running installToTarget with Claude Code's WS-41 catalogue entry and a two-skill fixture produces exactly the expected writes at exactly the expected resolved paths."
      - "installToTarget returns 'skipped-no-format' rather than throwing when selectPrimaryFormat returns null."
      - "No node:fs or node:fs/promises import appears in this file — all filesystem access goes through the injected FsWriteAccess, per Design > 'What each module knows / must not know'."
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Phase 2 — `rule-directory`/`single-rule-file` kinds, `mcp-json` exclusion proof
  ```yaml
  description: "Add the rule-directory and single-rule-file/markdown-context-file formatters, prove selectPrimaryFormat always resolves Cursor and Windsurf to their rules format, and prove installToTarget against Cursor's rule-directory case."
  ```

  - [x] 2.1 Implement rule-directory and single-rule-file/markdown-context-file formatters
    ```yaml
    description: "Extend agentic-tools-format.ts's formatForTarget with the rule-directory and single-rule-file/markdown-context-file kinds."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/lib/agentic-tools-format.ts (extends the file task 1.2 created), add a formatForTarget branch for kind === 'rule-directory': one FileWrite per skill, body only, at the format's pathTemplate with <name> substituted for skill.id."
      - "Add a formatForTarget branch covering kind === 'single-rule-file' and kind === 'markdown-context-file' together: exactly one FileWrite whose content is all skills concatenated under one document, at the format's pathTemplate."
      - "Remove the 'not yet implemented' throw added in task 1.2 for these two kind groups now that they are implemented; the mcp-json throw and the throw for any remaining unimplemented kind (there are none left, per this plan's four-tool/three-kind scope) stay as written."
    pattern: "src/lib/agentic-tools-format.ts (existing, extended)"
    imports: "./agentic-tools-content.js (InstallContent); WS-41's src/lib/agentic-tools-catalogue.js (IntegrationFormat) — see Divergence 1"
    compatibility: "Matches the skill-directory branch's own FileWrite shape and per-skill iteration order (task 1.2)."
    gotcha: "single-rule-file and markdown-context-file must concatenate into exactly one FileWrite, not one per skill — conflating this with the rule-directory branch's per-skill output is the likely mistake here."
    verify:
      - "npm run build"
      - "node --test dist/lib/agentic-tools-format.test.js"
    checklist:
      - "rule-directory produces one FileWrite per skill, body only."
      - "single-rule-file and markdown-context-file each produce exactly one FileWrite containing every skill."
      - "mcp-json still throws (unchanged from task 1.2)."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.2 Test selectPrimaryFormat and the mcp-json throw against Cursor and Windsurf
    ```yaml
    description: "Extend agentic-tools-format.test.ts to prove selectPrimaryFormat always resolves Cursor's and Windsurf's real WS-41 catalogue entries to their rules format, and formatForTarget throws when called directly with their mcp-json entry."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/lib/agentic-tools-format.test.ts (extends the file task 1.2 created), import Cursor's and Windsurf's catalogue entries from WS-41's src/lib/agentic-tools-catalogue.ts (both carry a rules-kind entry and an mcp-json entry, per WS-41's plan Design > 'Verified catalogue') — see Divergence 1: this import target does not exist in this repo as of this session."
      - "Assert selectPrimaryFormat(cursorEntry) and selectPrimaryFormat(windsurfEntry) both return the non-mcp-json rules entry, never the mcp-json one."
      - "Assert formatForTarget(cursorEntry's mcp-json entry, content) and the Windsurf equivalent both throw directly, per plan Phase 2 task 2's verify line."
    pattern: "src/lib/agentic-tools-format.test.ts (existing, extended)"
    imports: "WS-41's src/lib/agentic-tools-catalogue.js (TOOL_CATALOGUE or per-tool entries) — see Divergence 1"
    compatibility: "node:test + node:assert/strict, matching src/lib/extract.test.ts's convention and this file's own existing tests from task 1.2."
    gotcha: "Use Cursor's and Windsurf's actual catalogue entries, not a hand-rolled fixture — the point of this test is proving the real data resolves correctly, per plan acceptance criterion 2."
    verify:
      - "npm run build"
      - "node --test dist/lib/agentic-tools-format.test.js"
    checklist:
      - "selectPrimaryFormat(cursorEntry) returns the rules-kind entry, not mcp-json."
      - "selectPrimaryFormat(windsurfEntry) returns the rules-kind entry, not mcp-json."
      - "formatForTarget throws when given either tool's mcp-json entry directly."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.3 Test installToTarget against Cursor's rule-directory case
    ```yaml
    description: "Extend agentic-tools-install.test.ts with an installToTarget test at global scope against Cursor's rule-directory format."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/lib/agentic-tools-install.test.ts (extends the file task 1.3 created), add a test calling installToTarget with an InstallTarget built from Cursor's WS-41 catalogue entry (scope: {kind:'global'}), a fixture InstallContent, and a fake FsWriteAccess."
      - "Assert the fake records exactly the expected writeTextFileAtomic calls for the rule-directory formatter (task 2.1) at the expected resolved paths under Cursor's global configDir."
    pattern: "src/lib/agentic-tools-install.test.ts (existing, extended)"
    imports: "WS-41's src/lib/agentic-tools-catalogue.js (Cursor's ToolDefinition entry) — see Divergence 1"
    compatibility: "Same fake FsWriteAccess harness as task 1.3's tests."
    gotcha: "Cursor's catalogue entry carries both a rules entry and an mcp-json entry — installToTarget must resolve to the rules one via selectPrimaryFormat, not the first array entry blindly."
    verify:
      - "npm run build"
      - "node --test dist/lib/agentic-tools-install.test.js"
    checklist:
      - "installToTarget against Cursor's entry writes only rule-directory-shaped FileWrites, never anything mcp-json-shaped."
      - "The resolved path recorded on the returned InstallResult matches Cursor's configDir joined with the rules format's pathTemplate."
    self_eval:
      passed: true
      failures: []
    ```

- [x] 3. Phase 3 — Install-state tracking, update/no-op/uninstall semantics
  ```yaml
  description: "Add the pure install-tracking registry module, wire it into installToTarget for up-to-date/updated detection, implement removeInstallation, and prove acceptance criteria 4-6 by test."
  ```

  - [x] 3.1 Define InstallRecord and the pure registry functions
    ```yaml
    description: "Create agentic-tools-install-tracking.ts with InstallRecord, InstallScope, and the five pure parse/serialize/upsert/find/remove functions over an in-memory InstallRecord[]."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/lib/agentic-tools-install-tracking.ts (new file)."
      - "Define `type InstallScope = { kind: 'global' } | { kind: 'project'; projectPath: string }`."
      - "Define `interface InstallRecord { toolId: string; resolvedPath: string; format: IntegrationFormat['kind']; scope: InstallScope; installedAt: string; updatedAt: string; contentHash: string }` per plan Design > Contracts — every field Context specifies, contentHash required (not optional)."
      - "Implement `parseInstallRegistry(raw: string): InstallRecord[]` — returns [] on any parse failure (malformed JSON, wrong shape), matching src/lib/projects.ts's readProjects own corrupted-file-returns-empty-list posture (src/lib/projects.ts's readProjects function) rather than throwing."
      - "Implement `serializeInstallRegistry(records: InstallRecord[]): string`, `upsertInstallRecord(records, record): InstallRecord[]` (replaces any existing record matching the same (toolId, scope) pair rather than duplicating), `findInstallRecord(records, toolId, scope): InstallRecord | undefined`, and `removeInstallRecord(records, toolId, scope): InstallRecord[]`."
      - "Create the sibling src/lib/agentic-tools-install-tracking.test.ts: a parse/serialize round trip, and an upsertInstallRecord test proving a second upsert for the same (toolId, scope) replaces rather than duplicates (plan Phase 3 task 1's verify line)."
    pattern: "src/lib/agentic-tools-install-tracking.ts, src/lib/agentic-tools-install-tracking.test.ts (both new)"
    imports: "WS-41's src/lib/agentic-tools-catalogue.js (IntegrationFormat, for the format field's type) — see Divergence 1"
    compatibility: "TypeScript strict mode; falls under tsconfig.json's existing src/lib/**/*.ts include glob. All functions in this file are pure — no filesystem access, matching Design > 'What each module knows / must not know'."
    gotcha: "Match by BOTH toolId and scope when upserting/finding/removing, not toolId alone — two records can share a toolId with different scopes (global vs. a specific project path), and scope equality for the 'project' variant means comparing projectPath, not just the discriminant kind."
    verify:
      - "npm run build"
      - "node --test dist/lib/agentic-tools-install-tracking.test.js"
    checklist:
      - "parseInstallRegistry(serializeInstallRegistry(records)) round-trips to an equivalent InstallRecord[]."
      - "parseInstallRegistry returns [] on malformed input rather than throwing."
      - "upsertInstallRecord called twice for the same (toolId, scope) leaves exactly one record for that pair."
      - "No fs/path/registryPath-reading logic appears in this file — it operates purely on an InstallRecord[] in memory."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.2 Wire tracking into installToTarget; implement removeInstallation
    ```yaml
    description: "Extend agentic-tools-install.ts so installToTarget reads the registry, skips writes and returns 'up-to-date' on a matching contentHash, otherwise writes and persists an upserted record; implement removeInstallation."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/lib/agentic-tools-install.ts (extends the file task 1.3 created), at the start of installToTarget, read the registry file via deps.fsWrite.readTextFile(registryPath) and parseInstallRegistry it; call findInstallRecord for this target's (toolId, scope)."
      - "Compute hashInstallContent(content) and compare against the found record's contentHash, if any. On a match: skip every write (no writeTextFileAtomic call at all) and return status: 'up-to-date' with the record's resolvedPath — this is plan acceptance criterion 4's exact zero-write requirement."
      - "On no match (new install or changed content): perform the formatting + writes as task 1.3 already does, then upsertInstallRecord with a new/updated InstallRecord (installedAt set once on first install, updatedAt bumped on every content change, contentHash set to the new hash), serializeInstallRegistry, and persist via deps.fsWrite.writeTextFileAtomic(registryPath, ...) using the same atomic pattern as every other write in this function. Return status: 'installed' for a first write, 'updated' for a changed-content overwrite."
      - "Implement `removeInstallation(toolId, scope, registryPath, deps)`: find the record for (toolId, scope), delete the tracked file(s)/directory at its resolvedPath via deps.fsWrite.remove, then removeInstallRecord and persist the registry. No-op (does not throw) if no record exists for the pair, matching the port's documented idempotent-remove contract."
    pattern: "src/lib/agentic-tools-install.ts (existing, extended)"
    imports: "./agentic-tools-install-tracking.js (parseInstallRegistry, serializeInstallRegistry, upsertInstallRecord, findInstallRecord, removeInstallRecord, InstallRecord); ./agentic-tools-content.js (hashInstallContent)"
    compatibility: "The registry write must use the same sibling-tmp-file-then-rename atomic pattern as every file write in this module (src/lib/projects.ts:42-47 precedent), applied here to registryPath specifically."
    gotcha: "Persist the registry AFTER the content writes succeed, not before — persisting first and then failing a content write would leave a tracking record for content that was never actually written to disk."
    verify:
      - "npm run build"
      - "node --test dist/lib/agentic-tools-install.test.js"
    checklist:
      - "A second installToTarget call with byte-identical InstallContent makes zero writeTextFileAtomic calls on the fake port and returns status: 'up-to-date'."
      - "A third call with changed InstallContent overwrites the previously written files and bumps the tracking record's updatedAt and contentHash."
      - "removeInstallation deletes the tracked file(s)/directory and removes the record for that (toolId, scope) pair."
      - "removeInstallation against a nonexistent (toolId, scope) pair does not throw."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.3 Test the install/no-op/update/remove lifecycle directly
    ```yaml
    description: "Extend agentic-tools-install.test.ts with tests proving plan acceptance criteria 4, 5, and 6 directly, against Claude Code's skill-directory target."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/lib/agentic-tools-install.test.ts (extends the file from tasks 1.3/2.3), add a test sequence against Claude Code's InstallTarget: (1) first installToTarget call writes files and returns 'installed'; (2) a second call with byte-identical InstallContent asserts zero additional writeTextFileAtomic calls on the fake port and status 'up-to-date' (criterion 4); (3) a third call with a changed skill body asserts the previously written files are overwritten and the tracking record's updatedAt/contentHash change (criterion 5)."
      - "Add a separate test: removeInstallation(toolId, scope, registryPath, deps) after an install deletes the written file(s)/directory and the tracking record for that (toolId, scope) pair (criterion 6)."
    pattern: "src/lib/agentic-tools-install.test.ts (existing, extended)"
    imports: "Same as tasks 1.3/2.3/3.2's test imports."
    compatibility: "Reuses the same fake FsWriteAccess harness already established in this test file, extended to also serve readTextFile/writeTextFileAtomic calls against the in-memory registry content."
    gotcha: "The fake FsWriteAccess must persist state between the sequential installToTarget calls within one test (the second and third calls must see the first call's written registry content) — a fresh fake per call would defeat the no-op assertion entirely."
    verify:
      - "npm run build"
      - "node --test dist/lib/agentic-tools-install.test.js"
    checklist:
      - "The zero-write assertion on the second call is a direct call-count check on the fake port, not an indirect inference."
      - "The third call's overwrite assertion checks both the file content and the tracking record's updatedAt/contentHash."
      - "The removeInstallation test asserts both the file deletion and the record removal, not just one of the two."
    self_eval:
      passed: true
      failures: []
    ```

- [x] 4. Phase 4 — Full-catalogue global-run orchestration
  ```yaml
  description: "Implement installAllGlobal, running every catalogue tool at global scope, and prove it end to end across all four tools with no format ever reaching mcp-json."
  ```

  - [x] 4.1 Implement installAllGlobal
    ```yaml
    description: "Extend agentic-tools-install.ts with installAllGlobal, calling resolveGlobalBasePath per catalogue tool and installToTarget for each."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/lib/agentic-tools-install.ts (extends the file from tasks 1.3/3.2), implement `function installAllGlobal(catalogue: ToolDefinition[], resolveGlobalBasePath: (tool: ToolDefinition) => string, registryPath: string, deps: { fsWrite: FsWriteAccess; getInstallContent: GetInstallContent }): Promise<InstallResult[]>` per plan Design > Contracts."
      - "For each tool in catalogue: resolve its basePath via resolveGlobalBasePath(tool), resolve its InstallContent via deps.getInstallContent(tool.id) (the still-placeholder Gap 1 port), build an InstallTarget with scope {kind:'global'}, and call installToTarget — collecting one InstallResult per tool, in catalogue order."
      - "A tool whose selectPrimaryFormat resolves to null (no non-mcp-json format available) still produces one InstallResult with status 'skipped-no-format' for that tool, not an aborted batch — matching the per-target failure isolation already established in task 1.3."
    pattern: "src/lib/agentic-tools-install.ts (existing, extended)"
    imports: "./agentic-tools-content.js (GetInstallContent); WS-41's src/lib/agentic-tools-catalogue.js (ToolDefinition) — see Divergence 1"
    compatibility: "One getInstallContent call per target per run, no caching layer, per plan Assumption 6."
    gotcha: "resolveGlobalBasePath and getInstallContent are both caller-supplied functions, not concrete implementations — this task wires them together, it does not implement either. Do not reach for node:fs or a hardcoded path here."
    verify:
      - "npm run build"
      - "node --test dist/lib/agentic-tools-install.test.js"
    checklist:
      - "installAllGlobal returns exactly one InstallResult per catalogue entry, in catalogue order."
      - "A per-tool failure or skip does not abort the batch for the remaining tools."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 4.2 Full four-tool integration test
    ```yaml
    description: "Extend agentic-tools-install.test.ts with a full-catalogue installAllGlobal test across all four WS-41 tools, asserting no mcp-json format is ever reached."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/lib/agentic-tools-install.test.ts (extends the file from tasks 1.3/2.3/3.3), import WS-41's full TOOL_CATALOGUE (Claude Code, OpenCode, Cursor, Windsurf) — see Divergence 1."
      - "Build a fixture resolveGlobalBasePath returning a distinct path per tool, a fixture getInstallContent, and an in-memory FsWriteAccess; call installAllGlobal and assert one InstallResult per tool (four total)."
      - "Assert that no write recorded by the fake FsWriteAccess targets an mcp-json-shaped path for Cursor or Windsurf — i.e. every write went through the rules-format branch, per plan Phase 4 task 2's verify line."
    pattern: "src/lib/agentic-tools-install.test.ts (existing, extended)"
    imports: "WS-41's src/lib/agentic-tools-catalogue.js (TOOL_CATALOGUE) — see Divergence 1"
    compatibility: "Reuses the fake FsWriteAccess harness already established in this test file."
    gotcha: "This is the one test in this workstream that must run against the REAL, full TOOL_CATALOGUE rather than a hand-built fixture list of tools — a fixture list would not actually prove the catalogue-orchestration wiring works against WS-41's real data."
    verify:
      - "npm run build"
      - "node --test dist/lib/agentic-tools-install.test.js"
    checklist:
      - "installAllGlobal against the real four-tool TOOL_CATALOGUE returns exactly four InstallResults."
      - "No recorded write targets an mcp-json pathTemplate for any tool."
    self_eval:
      passed: true
      failures: []
    ```

- [x] 5. Phase 5 — Concrete `FsWriteAccess` adapter
  ```yaml
  description: "Implement createNodeFsWriteAccess() on plain node:fs/promises — unblocked under Electron, previously blocked under Tauri's capability system — and prove every port method against a real temporary directory."
  ```

  - [x] 5.1 Implement createNodeFsWriteAccess()
    ```yaml
    description: "Create agentic-tools-fs-adapter.ts with a concrete FsWriteAccess built on node:fs/promises, implementing every port method for real."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/lib/agentic-tools-fs-adapter.ts (new file)."
      - "Implement `function createNodeFsWriteAccess(): FsWriteAccess` per plan Design's illustrative code: readTextFile catches ENOENT and returns null, rethrows any other error; writeTextFileAtomic writes to a sibling `${path}.${process.pid}.tmp` then fs.rename's it over path, same reasoning as src/lib/projects.ts's writeProjects (src/lib/projects.ts:42-47), generalized from one fixed registryPath to any caller-supplied path; mkdir uses `{ recursive: true }` for idempotency; remove uses `fs.rm(path, { recursive: true, force: true })` so it is idempotent on an already-absent path; expandTokens resolves a leading '~' against os.homedir() and `%VAR%` tokens against process.env."
      - "Import FsWriteAccess's type from ./agentic-tools-install.js rather than redefining it."
      - "This file must not import or reference any tool, format, or install-tracking concept — a generic, reusable file-write utility only, per Design > 'What each module knows / must not know'."
    pattern: "src/lib/agentic-tools-fs-adapter.ts (new)"
    imports: "node:fs/promises, node:os; ./agentic-tools-install.js (FsWriteAccess type only)"
    compatibility: "Plain Node code, not Electron-specific — must work identically under `node --test` and under Electron's main process, per Design's own reasoning (no bundler obstacle, no capability grant needed)."
    gotcha: "writeTextFileAtomic's tmp file must be a sibling of the real path (same directory), never under the OS temp directory, or fs.rename can fail with EXDEV across filesystems — this is the exact same constraint src/lib/projects.ts's own comment documents."
    verify:
      - "npm run build"
    checklist:
      - "createNodeFsWriteAccess() implements all five FsWriteAccess methods (readTextFile, writeTextFileAtomic, mkdir, remove, expandTokens)."
      - "readTextFile returns null on ENOENT rather than throwing."
      - "mkdir and remove are both idempotent by construction (recursive/force flags), matching the port's documented contract."
      - "No tool-, format-, or install-specific logic appears in this file."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 5.2 Test the adapter against a real temporary directory
    ```yaml
    description: "Create agentic-tools-fs-adapter.test.ts exercising every FsWriteAccess method against a real fs.mkdtemp-created directory, cleaned up per test."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/lib/agentic-tools-fs-adapter.test.ts (new file), using node:test's before/after (or per-test setup/teardown) to create a real temp directory via `fs.mkdtemp(path.join(os.tmpdir(), 'agentic-tools-fs-adapter-'))` and remove it afterward — this is the plan's own settled design point (Open question 2), the only test file in this workstream exercising real I/O."
      - "Test writeTextFileAtomic: writes produce the exact expected content at the target path, and no stray `.tmp` file is left behind afterward."
      - "Test remove: calling remove on an already-absent path does not throw (idempotent)."
      - "Test mkdir: calling mkdir on an already-existing directory does not throw (idempotent)."
      - "Test expandTokens: resolves a leading '~' against os.homedir(), and a `%VAR%` token against a process.env value set for the test."
    pattern: "src/lib/agentic-tools-fs-adapter.test.ts (new)"
    imports: "node:test, node:assert/strict, node:fs/promises, node:os, node:path"
    compatibility: "Departs from every other module's fake-based testing approach in this workstream — real I/O is the deliberate, plan-documented exception for this one file (plan Testing strategy)."
    gotcha: "Clean up the temp directory even when a test assertion fails (use try/finally or node:test's after hook), or repeated local test runs will accumulate stray temp directories."
    verify:
      - "npm run build"
      - "node --test dist/lib/agentic-tools-fs-adapter.test.js"
    checklist:
      - "writeTextFileAtomic's real output file has exactly the written content and no stray tmp file remains."
      - "remove on an already-absent real path does not throw."
      - "mkdir on an already-existing real directory does not throw."
      - "expandTokens correctly resolves both a '~' path and a '%VAR%' token against real os.homedir()/process.env values."
      - "The temp directory used by this test file is removed after the run, pass or fail."
    self_eval:
      passed: true
      failures: []
    ```

- [x] 6. Phase 6 — Electron IPC wiring
  ```yaml
  description: "Register the three ipcMain.handle channels this workstream defines, wire main.cts to register them, add the new file to electron/tsconfig.json's include, and expose window.praxisSkillInstallAPI from preload.cts — the plumbing WS-43's UI will call. See Divergence 2: electron/main.cts, electron/preload.cts, and electron/tsconfig.json do not exist in this repo as of this file's base_commit."
  ```

  - [x] 6.1 Implement registerAgenticToolsIpcHandlers()
    ```yaml
    description: "Create electron/agentic-tools-ipc-handlers.cts registering installSelected, getInstallStatus, and removeInstallation as ipcMain.handle channels, each calling agentic-tools-install.ts's functions directly with the concrete FsWriteAccess and a placeholder getInstallContent."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create electron/agentic-tools-ipc-handlers.cts (new file), per plan Design's illustrative code."
      - "Define `interface InstallTargetRequest { toolId: string; basePath: string; scope: InstallScope }` and mirror WS-37's own `PraxisIpcResult<T>` shape here (`{ ok: true; status: number; data: T } | { ok: false; status: number; error: string }`) — a third mirror of an already-twice-mirrored shape, matching this codebase's established pattern per plan Design, not a new one. See Divergence 2: the WS-37 file this shape is mirrored from does not exist in this repo yet to read verbatim from; mirror the shape exactly as the plan's own contract states it."
      - "Implement `registerAgenticToolsIpcHandlers(): void` constructing `const fsWrite = createNodeFsWriteAccess()` and `const registryPath = path.join(repoRoot, '.praxis-installs.json')`, using the same two-levels-up `__dirname`-based repoRoot computation as src/lib/projects.ts:9-14."
      - "Register `ipcMain.handle('installSelected', ...)`: for each InstallTargetRequest, look up its ToolDefinition in WS-41's TOOL_CATALOGUE by toolId (a toolId not found produces one failed InstallResult for that entry, not an aborted batch), resolve InstallContent via the placeholder getInstallContent (plan Assumption 9), and call installToTarget per target, collecting results."
      - "Register `ipcMain.handle('getInstallStatus', ...)`: read registryPath via fsWrite.readTextFile, parseInstallRegistry it, return the array."
      - "Register `ipcMain.handle('removeInstallation', ...)`: direct call to agentic-tools-install.ts's removeInstallation."
      - "This file must not call node:fs directly (goes through createNodeFsWriteAccess only) and must not know per-tool format details itself — delegates entirely to agentic-tools-install.ts, per Design > 'What each module knows / must not know'."
    pattern: "electron/agentic-tools-ipc-handlers.cts (new)"
    imports: "electron's ipcMain; node:path; ../src/lib/agentic-tools-install.js (installToTarget, removeInstallation, InstallResult); ../src/lib/agentic-tools-install-tracking.js (parseInstallRegistry, InstallRecord); ../src/lib/agentic-tools-fs-adapter.js (createNodeFsWriteAccess); WS-41's ../src/lib/agentic-tools-catalogue.js (TOOL_CATALOGUE) — see Divergence 1 and Divergence 2"
    compatibility: "electron/*.cts compiles to CommonJS .cjs output regardless of the root package.json's \"type\": \"module\", per WS-36's own resolved ESM/CommonJS design point — confirmed by reading WS-36's plan (PLN-26-fdxv4m) Summary this session."
    gotcha: "This file assumes electron/tsconfig.json (WS-36) already exists with an include array this task's sibling (task 6.3) extends — if WS-36 has not yet landed when this task executes, create this file's content per this spec but defer compiling it until electron/tsconfig.json exists."
    verify:
      - "npx tsc -p electron/tsconfig.json --noEmit"
    checklist:
      - "All three channels (installSelected, getInstallStatus, removeInstallation) are registered via ipcMain.handle."
      - "A toolId not found in TOOL_CATALOGUE produces one failed InstallResult for that entry within installSelected, not a thrown error that aborts the whole batch."
      - "No node:fs import appears in this file — all filesystem access goes through createNodeFsWriteAccess()."
      - "PraxisIpcResult<T>'s shape matches the plan's own contract exactly: {ok:true,status,data} | {ok:false,status,error}."
    self_eval:
      passed: true
      failures:
        - item: "File compiles and its ipcMain.handle channels actually work when the app is launched, not just when type-checked."
          reason: "As first authored, this file used top-level VALUE imports from src/lib/agentic-tools-*.ts (installToTarget, removeInstallation from agentic-tools-install.js; parseInstallRegistry from agentic-tools-install-tracking.js; createNodeFsWriteAccess from agentic-tools-fs-adapter.js; TOOL_CATALOGUE from agentic-tools-catalogue.js). electron/*.cts always compiles to CommonJS regardless of the root package.json's \"type\": \"module\", so those became require() calls in the compiled output — but src/lib/*.ts compiles (via the root tsconfig.json, same \"type\": \"module\" package.json) to real ESM, and require() cannot synchronously load an ESM module. Running `npm run electron:dev` crashed on launch with 'ReferenceError: exports is not defined in ES module scope' at dist/src/lib/agentic-tools-install.js:9 (that path only existed after task 6.3's rootDir widening; without it, the same value imports fail differently, at compile time, with TS6059). This was missed because this task's own verification only ran `npx tsc -p electron/tsconfig.json --noEmit` and traced the checklist by code inspection — the app was never actually launched to observe it boot."
          fix: "Rewrote electron/agentic-tools-ipc-handlers.cts to never statically import a VALUE from src/lib/agentic-tools-*.ts. All five values are now loaded via a dynamic import() — routed through `new Function('specifier', 'return import(specifier)')`, mirroring electron/main.cts's own existing dynamicImport pattern for dist/server.js — resolved once, before any ipcMain.handle registration, inside a now-async registerAgenticToolsIpcHandlers(). Types are also no longer imported from src/lib/*.ts at all: even a bare `import type` from a .ts file outside electron/tsconfig.json's rootDir triggers the same TS6059 at emit time (confirmed by an isolated two-file reproduction, not assumed) — so small local type declarations (InstallScope, InstallRecord, FsWriteAccess, InstallResult, InstallContent, function signatures) now mirror the real shapes by hand instead, documented in this file's header comment as needing manual sync. Live-verified in this pass: launched the app, confirmed no crash and no 'App threw an error during load' in its output, screenshotted the rendered home page, and confirmed via the Chrome DevTools Protocol that window.praxisSkillInstallAPI's three methods are present and getInstallStatus() resolves {ok:true,status:200,data:[]}."
    ```

  - [x] 6.2 Wire main.cts to register the new IPC handlers
    ```yaml
    description: "Call registerAgenticToolsIpcHandlers() from electron/main.cts, alongside WS-37's own registerIpcHandlers() call, in the same after-readiness-before-loadURL sequencing WS-37 already establishes."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In electron/main.cts, add one call to `registerAgenticToolsIpcHandlers()` (imported from ./agentic-tools-ipc-handlers) alongside WS-37's own `registerIpcHandlers()` call, in the same lifecycle position WS-37 establishes (after app readiness, before the BrowserWindow's loadURL call) — so window.praxisSkillInstallAPI exists before any renderer script that might call it on load."
      - "This is a small, additive, one-line edit — it must not remove or restructure WS-37's own registration call or any other existing content in main.cts."
    pattern: "electron/main.cts (existing, additive edit)"
    imports: "./agentic-tools-ipc-handlers.cts (registerAgenticToolsIpcHandlers)"
    compatibility: "Matches WS-37's own established call-site sequencing exactly — read main.cts as it stands at execution time and place the new call in the same position WS-37's own registerIpcHandlers() call occupies, per this repo's spec-mode convention of deriving the exact edit from current file content rather than a literal block. See Divergence 2: this file does not exist in this repo as of this task list's base_commit, since WS-36's task list has not executed; this task's anchor is the plan's own Design description, not a line read from a live file."
    gotcha: "Do not invent line numbers or literal current content for this file — none exists to read as of base_commit. Re-read main.cts fresh at execution time before editing it."
    verify:
      - "npx tsc -p electron/tsconfig.json --noEmit"
    checklist:
      - "registerAgenticToolsIpcHandlers() is called exactly once, after app readiness and before loadURL."
      - "WS-37's own registerIpcHandlers() call is unchanged, still present, and still runs."
    self_eval:
      passed: true
      failures:
        - item: "registerAgenticToolsIpcHandlers() is called exactly once, after app readiness and before loadURL."
          reason: "Task 6.1's fix made registerAgenticToolsIpcHandlers() async (it now awaits a one-time dynamic import() resolution before registering any ipcMain.handle channel). The original fire-and-forget call `registerAgenticToolsIpcHandlers();` (no await) left a window where createWindow()/loadURL could run before the channels were registered, and dropped any rejection from the dynamic import silently."
          fix: "Changed the call site to `await registerAgenticToolsIpcHandlers();`, confirmed (by reading main.cts fresh, not assumed) to still sit inside the existing `app.whenReady().then(async () => {...})` block, directly before createWindow(). WS-37's own registerIpcHandlers() call is untouched and stays synchronous, since it never imports src/lib/* — only loopback HTTP calls. Live-verified: the app launches with both IPC surfaces intact (getInstallStatus() resolves correctly over the Chrome DevTools Protocol) and no ordering-related error."
    ```

  - [x] 6.3 Add the new IPC handler file to electron/tsconfig.json's include array
    ```yaml
    description: "Extend electron/tsconfig.json's include array with electron/agentic-tools-ipc-handlers.cts so it compiles alongside WS-36/WS-37's existing electron files."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In electron/tsconfig.json, add 'agentic-tools-ipc-handlers.cts' (or the equivalent glob already used for main.cts/preload.cts/ipc-handlers.cts) to the existing include array — a small, additive edit, not a restructure of the file's other compiler options."
    pattern: "electron/tsconfig.json (existing, additive edit)"
    imports: "none"
    compatibility: "Matches whatever include-array shape WS-36 establishes (explicit file list vs. a glob) — read the file as it stands at execution time rather than assuming a shape here. See Divergence 2: this file does not exist in this repo as of this task list's base_commit."
    gotcha: "If WS-36 already uses a glob (e.g. 'electron/**/*.cts') this task may already be satisfied with zero edit needed — verify by reading the file at execution time before assuming an edit is required."
    verify:
      - "npx tsc -p electron/tsconfig.json --noEmit"
    checklist:
      - "electron/agentic-tools-ipc-handlers.cts is included in the electron TypeScript project, whether by explicit entry or an existing glob."
      - "No other include entry or compiler option in this file was altered."
    self_eval:
      passed: true
      failures:
        - item: "No other include entry or compiler option in this file was altered."
          reason: "Adding only the include entry left `npx tsc -p electron/tsconfig.json --noEmit` failing with TS6059 ('is not under rootDir') on every src/lib/*.ts file task 6.1's agentic-tools-ipc-handlers.cts imports — this tsconfig's original rootDir '.' (electron/) cannot contain files under ../src/lib, and TS enforces rootDir containment for every file pulled into the program via import, not just the include-array entries, regardless of --noEmit."
          fix: "Widened rootDir from '.' to '..' (repo root) and outDir from '../dist/electron' to '../dist', so electron/*.cts and src/lib/*.ts both fall under one root while dist/electron/*.cjs output paths stay byte-identical (verified: `npx tsc -p electron/tsconfig.json --noEmit` exits 0, and a full `npm run build` still produces exactly agentic-tools-ipc-handlers.cjs, ipc-handlers.cjs, main.cjs, preload.cjs under dist/electron/, matching package.json's hardcoded \"main\": \"dist/electron/main.cjs\"). Side effect: the same build also emits a redundant, harmless CommonJS copy of src/lib/*.ts under dist/src/lib/ (dist/ is gitignored, nothing loads that path) since those files are now pulled into this project's compilation too."
        - item: "The 'harmless' dist/src/lib/ side effect recorded above is not actually harmless: it crashes the app on launch."
          reason: "The widened rootDir made tsc emit a second, redundant CommonJS copy of every src/lib/*.ts file at dist/src/lib/*.js, with a plain .js extension. Because the root package.json sets \"type\": \"module\", Node's module loader (which decides ESM vs CommonJS purely from the \"type\" field plus file extension, never by inspecting file content) loaded that CommonJS-content file as ESM and crashed on `npm run electron:dev` launch with 'ReferenceError: exports is not defined in ES module scope' at dist/src/lib/agentic-tools-install.js:9 — exactly reachable once task 6.1's agentic-tools-ipc-handlers.cts imported a value from it. This was missed because this task's own verify step only ran `npx tsc -p electron/tsconfig.json --noEmit` (a compile-only check that cannot observe a runtime module-loading crash) and never actually launched the Electron app."
          fix: "Reverted electron/tsconfig.json back to this task's pre-widening state: rootDir '.', outDir '../dist/electron' (the include array is unchanged). Task 6.1's agentic-tools-ipc-handlers.cts was rewritten instead to need nothing outside electron/'s own rootDir at compile time (dynamic import() for values, local hand-mirrored types instead of `import type` for types — see task 6.1's own updated self_eval for why even type-only imports hit the same TS6059 rootDir problem this task originally hit for value imports). Verified live in this pass: `npm run build` now produces no dist/src/ tree at all — only dist/lib/*.js (ESM, root tsconfig) and dist/electron/*.cjs (CommonJS, this tsconfig) — `npx tsc -p electron/tsconfig.json --noEmit` passes cleanly, and a live app launch shows no crash (process stays alive, home page renders per screenshot, port 4173 listens, window.praxisSkillInstallAPI works end-to-end per a live Chrome DevTools Protocol check, and the app quits cleanly with nothing left listening on port 4173)."
    ```

  - [x] 6.4 Expose window.praxisSkillInstallAPI from preload.cts
    ```yaml
    description: "Add a second contextBridge.exposeInMainWorld call to electron/preload.cts, exposing installSelected/getInstallStatus/removeInstallation as window.praxisSkillInstallAPI, alongside WS-37's own praxisAPI global; manually verify the full chain per plan acceptance criterion 12."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In electron/preload.cts, add a second `contextBridge.exposeInMainWorld('praxisSkillInstallAPI', { installSelected: (targets) => ipcRenderer.invoke('installSelected', targets), getInstallStatus: () => ipcRenderer.invoke('getInstallStatus'), removeInstallation: (toolId, scope) => ipcRenderer.invoke('removeInstallation', toolId, scope) })` call, per plan Design's illustrative code — a second, distinct global, not additional methods folded into WS-37's own praxisAPI object literal (plan Alternatives considered: keeps the two concerns' preload wiring fully decoupled)."
      - "This is additive only — WS-37's own contextBridge.exposeInMainWorld('praxisAPI', ...) call must remain unchanged."
      - "Manually verify plan acceptance criterion 12 once WS-36/WS-37 are in place and this workstream is fully wired: from a running Electron window built on that scaffold, an ad-hoc `window.praxisSkillInstallAPI.getInstallStatus()` call from the devtools console resolves with `{ok: true, status: 200, data: []}` against a fresh checkout (empty registry) — proving the full chain (renderer → preload → IPC → src/lib engine → concrete adapter → real .praxis-installs.json) is wired end-to-end. Also check `window.praxisSkillInstallAPI.removeInstallation('claude-code', {kind:'global'})` against a nonexistent record resolves without throwing."
    pattern: "electron/preload.cts (existing, additive edit)"
    imports: "electron's contextBridge, ipcRenderer (already imported by WS-37's own praxisAPI exposure)"
    compatibility: "Electron supports multiple contextBridge.exposeInMainWorld calls with different keys in one preload script — this is the plan's own stated mechanism, not a workaround. See Divergence 2: this file does not exist in this repo as of this task list's base_commit; re-read it fresh at execution time before editing."
    gotcha: "Do not fold these three methods into WS-37's existing praxisAPI object — the plan explicitly rejects that (Alternatives considered) to keep the two concerns' preload wiring decoupled."
    verify:
      - "npx tsc -p electron/tsconfig.json --noEmit"
      - "Manual: from the running Electron window's devtools console on a fresh checkout, window.praxisSkillInstallAPI.getInstallStatus() resolves {ok: true, status: 200, data: []}; window.praxisSkillInstallAPI.removeInstallation('claude-code', {kind:'global'}) against a nonexistent record resolves without throwing (plan acceptance criterion 12, Phase 6 task 4)."
    checklist:
      - "window.praxisSkillInstallAPI is exposed as a second, distinct global from WS-37's own praxisAPI, not merged into it."
      - "All three methods (installSelected, getInstallStatus, removeInstallation) are present on the exposed object, each returning a Promise via ipcRenderer.invoke."
      - "The manual devtools check against a fresh checkout's empty registry resolves the exact shape plan acceptance criterion 12 specifies."
    self_eval:
      passed: true
      failures:
        - item: "The manual devtools check against a fresh checkout's empty registry resolves the exact shape plan acceptance criterion 12 specifies."
          reason: "This item's own verify line is a manual step requiring a running, packaged-or-dev Electron window with devtools open — a live GUI/E2E check outside this execution pass's permitted verify scope (linting/type-checking/file-inspection only; heavyweight/E2E steps are skipped even when the task lists one)."
          fix: "Not executed live at the time. Traced instead by code inspection: getInstallStatus on a fresh checkout calls fsWrite.readTextFile(registryPath), which agentic-tools-fs-adapter.ts's readTextFile resolves to null on ENOENT (verified in its own task 5.2 tests); the handler then returns parseInstallRegistry's [] wrapped as {ok:true,status:200,data:[]}, matching criterion 12 exactly. removeInstallation('claude-code',{kind:'global'}) against that same empty registry finds no record (findInstallRecord returns undefined) and returns early without throwing, wrapped as {ok:true,status:200,data:null}. Both traces match the expected shapes; the live devtools confirmation itself is left for the user to run once an Electron window is actually launched."
        - item: "Manual: from the running Electron window's devtools console on a fresh checkout, window.praxisSkillInstallAPI.getInstallStatus() resolves {ok: true, status: 200, data: []}; window.praxisSkillInstallAPI.removeInstallation('claude-code', {kind:'global'}) against a nonexistent record resolves without throwing (plan acceptance criterion 12, Phase 6 task 4)."
          reason: "The trace above was never actually run. Had it been, it would have failed: the app crashed before reaching a loaded renderer at all, from task 6.1's original src/lib/agentic-tools-*.ts VALUE imports compiling to require() calls against ESM modules (ERR_REQUIRE_ESM / 'ReferenceError: exports is not defined in ES module scope'), compounded by task 6.3's rootDir widening (see that task's self_eval). No devtools console was ever reachable to run this check against."
          fix: "Task 6.1 rewritten to use dynamic import() (mirroring main.cts's own precedent) instead of static VALUE imports of src/lib/agentic-tools-*.ts, and task 6.3's rootDir widening reverted. Live-verified fresh in this pass, replacing the code-inspection trace above: launched the app in the background, confirmed the process stayed alive with no crash and no 'App threw an error during load' anywhere in its stdout/stderr, took a screenshot (via screencapture -x -l <windowNumber>) confirming the home page renders, then relaunched with --remote-debugging-port=9222 and, via the Chrome DevTools Protocol, confirmed `typeof window.praxisSkillInstallAPI === 'object'` with installSelected/getInstallStatus/removeInstallation all functions, and that `window.praxisSkillInstallAPI.getInstallStatus()` resolves exactly `{ok:true,status:200,data:[]}` against the fresh (nonexistent) registry — matching this checklist item and plan acceptance criterion 12 verbatim. The app was then quit cleanly with nothing left listening on port 4173."
    ```

## Divergences

1. **WS-41's `src/lib/agentic-tools-{catalogue,signals,detect}.ts` do not exist in this repo.**
   PLN-32-m51bp8's Design section assumes these files already exist, importing `ToolDefinition`,
   `IntegrationFormat`, `DetectionResult`, and `OS` from `src/lib/agentic-tools-catalogue.ts`
   rather than redefining them. As read this session, `src/lib/` contains only `detail.ts`,
   `extract.ts`, `extract.test.ts`, `git.ts`, `projects.ts`, and `yaml-block.ts` — no
   `agentic-tools-*.ts` file of any kind — and WS-41's own task list
   (`flowcharge/workstreams/WS-41-3783cz-detect-agentic-tool-config-locations/tasklist.md`) is
   `status: ready`, not `done`, confirming none of its tasks have executed yet. Consequence:
   every task above that imports these types (tasks 1.2, 1.3, 2.2, 2.3, 3.1, 4.1, 4.2, 6.1) cites
   them by name and shape per PLN-31-uxdkro's (WS-41's plan) own published contract, read in full
   this session, since no live file exists to read exports or line numbers from. No task was
   skipped for this reason — this reflects normal cross-workstream sequencing PLN-32-m51bp8
   itself acknowledges (WS-42 "continues" WS-41), not a mismatch in an existing file's content;
   execution of this task list presupposes WS-41 lands its catalogue and types first.

2. **`electron/main.cts`, `electron/preload.cts`, and `electron/tsconfig.json` do not exist in
   this repo — the `electron/` directory itself does not exist.** PLN-32-m51bp8's Phase 6 assumes
   these WS-36/WS-37 artefacts are already in place to extend. As read this session, no `.cts`
   file of any kind exists anywhere in the repository, and both WS-36's and WS-37's own task
   lists (`flowcharge/workstreams/WS-36-b3b2pw-tauri-shell-scaffold/tasklist.md`,
   `flowcharge/workstreams/WS-37-zj17yn-absorb-node-backend-into-frontend/tasklist.md`) are
   `status: ready`, not `done`. Consequence: tasks 6.2, 6.3, and 6.4 are authored as prose
   instructions anchored on PLN-32-m51bp8's own Design section (the illustrative snippets for the
   sibling `registerAgenticToolsIpcHandlers()` call, the `include` array entry, and the second
   `contextBridge.exposeInMainWorld` call) rather than against any literal current file content —
   no SEARCH/REPLACE block is authored for any of these three files, since none exists to copy
   SEARCH text from. `package.json`'s own `build` script (read in full this session: `tsc -p
   tsconfig.json && tsc -p src/public/tsconfig.json && node tools/copy-assets.mjs`) likewise has
   no electron compile step yet, so task 6.1-6.4's verify steps call `npx tsc -p
   electron/tsconfig.json --noEmit` directly rather than through an `npm run build` that does not
   yet cover it — matching a project-agnostic, toolchain-appropriate fallback per this workstream's
   own instructions, since extending `npm run build` with an electron step is WS-36's job, not
   this workstream's. Execution of Phase 6 presupposes WS-36 and WS-37 have landed first.

3. **Real rule-directory `pathTemplate`s use a `*` glob token, not the `<name>` token task 2.1's
   own prose assumed.** Task 2.1 was authored under Divergence 1 (WS-41's catalogue did not yet
   exist) and its `implement` text describes rule-directory substitution as "`<name>` substituted
   for skill.id" by analogy with the skill-directory branch. By execution time WS-41 had landed;
   `src/lib/agentic-tools-catalogue.ts` as read this session gives Cursor's rule-directory entry as
   `{ kind: 'rule-directory', pathTemplate: '.cursor/rules/*.mdc', ... }` and Windsurf's as
   `{ kind: 'rule-directory', pathTemplate: '.devin/rules/*.md', ... }` — both use a literal `*`
   token, never `<name>`. A literal `<name>`-only substitution would leave `*` unreplaced, so every
   skill would resolve to the same literal path and collide. Consequence: task 2.1's
   `ruleDirectoryWrites` (`src/lib/agentic-tools-format.ts`) substitutes `*` with `skill.id`
   instead, the only reading that gives each skill a distinct file under the real catalogue's own
   data; task 2.3's Cursor test and its checklist ("resolved path ... matches Cursor's configDir
   joined with the rules format's pathTemplate") are satisfied literally, token substitution
   included. This also reproduces the plan's own still-open Open question 4 unchanged (Cursor's
   `.cursor/rules/*.mdc` pathTemplate already contains a `.cursor` segment, so joining it against
   Cursor's `~/.cursor/` configDir doubles that segment) — not fixed here, since resolving the
   project/global `pathTemplate` distinction is explicitly out of scope for this task list.

4. **OpenCode's real catalogue entry produces a second, non-null failure mode task 4.1's own
   `implement` text did not anticipate.** Task 4.1 was authored describing only one failure case
   to isolate — `selectPrimaryFormat` resolving to `null` (no non-mcp-json format at all), already
   handled inside `installToTarget` itself by returning `'skipped-no-format'` without throwing. By
   execution time, `src/lib/agentic-tools-catalogue.ts`'s real OpenCode entry (read this session)
   lists `integrationFormats` as `[structured-config-file 'opencode.json', structured-config-file
   'tui.json', skill-directory 'skills/<name>/SKILL.md', markdown-context-file 'AGENTS.md']` — no
   `mcp-json` entry at all, so `selectPrimaryFormat` (`src/lib/agentic-tools-format.ts:17-19`)
   returns the *first* entry, `structured-config-file 'opencode.json'`, not `null`.
   `formatForTarget` (`src/lib/agentic-tools-format.ts:58-72`) has no `structured-config-file`
   branch — it is out of scope for this four-tool workstream per this file's own Feature summary
   — so it throws `"kind 'structured-config-file' is not yet implemented"` for OpenCode
   specifically. Consequence: `installAllGlobal` (task 4.1, `src/lib/agentic-tools-install.ts`)
   wraps each per-tool `installToTarget` call in its own `try/catch`, folding a caught throw into
   the same `'skipped-no-format'` result the null case already produces — the only existing
   `InstallStatus` value that fits "no usable format for this tool," chosen to avoid widening the
   `InstallStatus` type for a case outside this task's stated scope. Task 4.2's integration test
   (`src/lib/agentic-tools-install.test.ts`) asserts OpenCode's result is `'skipped-no-format'` and
   the other three tools install successfully, proving the batch is not aborted.
