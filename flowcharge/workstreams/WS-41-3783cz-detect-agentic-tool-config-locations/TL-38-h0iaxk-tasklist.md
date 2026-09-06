---
id: TL-38-h0iaxk
type: tasklist
workstream: WS-41-3783cz
slug: detect-agentic-tool-config-locations
title: "Detection catalogue and engine for agentic coding tool config locations"
status: done
created: 2026-08-17
updated: 2026-08-19
author: Anthony Koukoullis
depends_on: [PLN-31-uxdkro]
links: []
mode: spec
base_commit: 0d82a04
---

# PRX Tasks

## Detect Agentic Tool Config Locations

Implements PLN-31-uxdkro: a static, per-tool `ToolDefinition` catalogue
(`src/lib/agentic-tools-catalogue.ts`) plus a small detection engine
(`src/lib/agentic-tools-signals.ts`, `src/lib/agentic-tools-detect.ts`) that
classifies whether each of four named agentic coding tools (Claude Code, Cursor,
Windsurf, OpenCode) is installed on the current machine, at what confidence,
using two shared category-level signal functions (`cli`, `gui-app`) evaluated
through an injected `FsAccess` port — never a bespoke per-tool detector. The
plan's own three-phase breakdown is followed exactly: Phase 1 lands the shared
contracts plus the `cli` category end-to-end on Claude Code; Phase 2 adds the
`gui-app` category and the Cursor and Windsurf entries; Phase 3 adds the
OpenCode entry and hardens per-OS `needsManualVerification` scoping across the
complete four-tool catalogue. GitHub Copilot, Continue.dev, and Windows
registry-based detection are out of scope, per the plan's own Open Questions 1
and 3. Three Windows paths (Windsurf's config dir and install location,
OpenCode's config dir) are tasked as explicit `placeholder-unverified`
catalogue facts flagged for real-machine verification at WS-42 implementation
time, per the plan's own Open Question 2 — not as blockers here. None of the
three target files exist yet in the repo, matching the plan's own assumption
that this is wholly net-new code (Assumption 1); no task below diverges from
what the plan describes.

- [x] 1. Phase 1 — Contracts, `cli` category, Claude Code end-to-end
  ```yaml
  description: "Land the shared OS/category/confidence types, the FsAccess port and DetectionResult shape, the cli category signal function, detectTool()/detectAllTools(), and the Claude Code catalogue entry — proven end to end via node --test. Implements plan.md Staged task breakdown Phase 1 (lines 298-313)."
  ```

  - [x] 1.1 Define catalogue types and an empty `TOOL_CATALOGUE`
    ```yaml
    description: "Define the OS/category/confidence types, OsPath/IntegrationFormat/ToolDefinition interfaces, and an empty TOOL_CATALOGUE array."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/lib/agentic-tools-catalogue.ts. Export the union types OS ('macos'|'linux'|'windows'), ToolCategory ('cli'|'gui-app'), and SourceConfidence ('verified'|'carried-from-investigation'|'placeholder-unverified'), exactly as specified in plan.md's Contracts section (PLN-31-uxdkro, lines 143-145)."
      - "Export interfaces OsPath (path, sourceConfidence, optional citation), IntegrationFormat (kind, pathTemplate, optional deprecatedFallback/notes), and ToolDefinition (id, displayName, category, configDir: Partial<Record<OS, OsPath[]>>, optional pathBinaryNames, integrationFormats), per the same Contracts section (lines 147-169)."
      - "Export an empty `export const TOOL_CATALOGUE: ToolDefinition[] = [];` — later tasks append entries to this array; this task does not populate it."
      - "This file holds only tool facts and type shapes. It must not import FsAccess or perform any filesystem/PATH/OS-detection logic, per Design > 'What each module knows / must not know' (lines 282-284)."
    pattern: "src/lib/agentic-tools-catalogue.ts (new file)"
    imports: "None — pure TypeScript types and a static array literal, no runtime dependencies."
    compatibility: "Module resolution is node16 (tsconfig.json); any relative import added later in this file must use an explicit .js extension, matching src/lib/extract.ts's existing style. The file falls under tsconfig.json's existing include glob src/lib/**/*.ts with no tsconfig.json edit needed."
    gotcha: "Keep this file free of any FsAccess reference or tool-name-specific evaluation logic — that boundary is what lets a fifth-tool addition (AC3) stay a pure data change. Do not add a vscode-extension category or a fifth/sixth tool — the plan scopes exactly cli/gui-app and exactly four tools."
    verify:
      - "npm run build"
    checklist:
      - "src/lib/agentic-tools-catalogue.ts exports OS, ToolCategory, SourceConfidence, OsPath, IntegrationFormat, ToolDefinition, and TOOL_CATALOGUE."
      - "TOOL_CATALOGUE is typed ToolDefinition[] and is empty."
      - "npm run build completes with zero TypeScript errors."
      - "git diff tsconfig.json is empty."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.2 Define `FsAccess`, `DetectionResult`, and the `cli` signal function
    ```yaml
    description: "Define the FsAccess port, DetectionConfidence/DetectionResult types, and the cli category signal function, with a base needsManualVerification derivation; cover the three cli branches with node --test."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/lib/agentic-tools-signals.ts. Export the FsAccess interface (pathExists, isDirectory, resolveBinaryOnPath, expandTokens) exactly as specified in plan.md's Contracts section (lines 173-178)."
      - "Export type DetectionConfidence ('confirmed'|'likely'|'weak'|'not-detected') and interface DetectionResult (toolId, confidence, resolvedConfigDir, matchedSignals, needsManualVerification), same section (lines 180-188)."
      - "Implement the cli category signal function per Design > 'Category-level signal rules' (lines 196-201): call resolveBinaryOnPath() for each of the ToolDefinition's pathBinaryNames as the primary signal; a match on any of them is sufficient for 'confirmed', independent of config-dir state (this is what defeats the lazily-created-config-dir false negative, AC2). If no binary is found, fall back to pathExists() on configDir[os] as a corroborating-only signal, capped at 'likely'. Neither → 'not-detected'."
      - "Derive needsManualVerification from only the OsPath fact(s) actually used to produce the result for the queried os: true iff that fact's sourceConfidence is 'placeholder-unverified' for that os, false otherwise (AC4). Never inspect the tool's other OS entries — this per-OS scoping is hardened further, across the full catalogue, in task 3.2."
      - "This function takes a ToolDefinition (imported from ./agentic-tools-catalogue.js) as a plain argument. It must not reference any specific tool id by name, per Design > 'What each module knows / must not know' (lines 285-287)."
      - "Create the sibling src/lib/agentic-tools-signals.test.ts, following src/lib/extract.test.ts's node:test + node:assert/strict + in-memory-fake pattern. Assert the cli function returns 'confirmed' when the fake reports a pathBinaryNames match, 'likely' when only configDir exists, and 'not-detected' when neither is present (AC5)."
    pattern: "src/lib/agentic-tools-signals.ts, src/lib/agentic-tools-signals.test.ts (both new)"
    imports: "ToolDefinition, OS from ./agentic-tools-catalogue.js (task 1.1)."
    compatibility: "Relative imports need explicit .js extensions (node16 moduleResolution). Test file uses node:test/node:assert/strict as extract.test.ts does, run via `node --test dist/lib/*.test.js` after npm run build — this repo has no dedicated npm test script."
    gotcha: "Do not let the cli signal function branch on toolId or any literal tool name — that would defeat the extensibility goal AC3 proves in task 3.3. Keep resolveBinaryOnPath() iteration generic over pathBinaryNames. Do not implement the gui-app function here — that is task 2.1."
    verify:
      - "npm run build"
      - "node --test dist/lib/agentic-tools-signals.test.js"
    checklist:
      - "FsAccess, DetectionConfidence, and DetectionResult match the Contracts section's shape exactly."
      - "The cli signal function returns 'confirmed' on a PATH-binary match regardless of configDir state, and never returns 'confirmed' from configDir existence alone."
      - "needsManualVerification reflects only the queried os's fact, not any other OS entry on the same tool."
      - "grep -E -c \"claude-code|cursor|windsurf|opencode\" src/lib/agentic-tools-signals.ts returns 0."
      - "node --test dist/lib/agentic-tools-signals.test.js exits 0."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.3 Implement `detectTool()`/`detectAllTools()` and add the Claude Code catalogue entry
    ```yaml
    description: "Implement the orchestration functions that dispatch each catalogue entry to its category's signal function, and add the Claude Code catalogue entry carried as-is from Context. Prove detectTool() end to end for Claude Code via node --test."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/lib/agentic-tools-detect.ts exporting detectTool(definition: ToolDefinition, fsAccess: FsAccess, os: OS): Promise<DetectionResult>, which dispatches on definition.category to the matching signal function from ./agentic-tools-signals.js (cli only exists yet; the dispatch must already be structured to add gui-app in task 2.1 without touching the dispatch shape itself)."
      - "Export detectAllTools(fsAccess: FsAccess, os: OS): Promise<DetectionResult[]> that maps TOOL_CATALOGUE through detectTool() with zero per-tool branching inside the function body itself (AC3) — it must read purely off TOOL_CATALOGUE and definition.category, never a tool id."
      - "Add the Claude Code entry to TOOL_CATALOGUE in src/lib/agentic-tools-catalogue.ts: category 'cli', its config-dir/path data and integration formats carried exactly as Context supplied them (per Design > Verified catalogue, line 217-219 — 'carried exactly as Context supplied it... not re-verified'), tagged sourceConfidence: 'carried-from-investigation' on its OsPath facts."
      - "Create src/lib/agentic-tools-detect.test.ts (node:test + in-memory fake FsAccess). Assert detectTool() against the Claude Code entry returns 'confirmed' when the fake reports the claude binary on PATH, 'likely' when only the config dir exists, and 'not-detected' otherwise, per Staged task breakdown Phase 1 item 3's verify note (lines 311-313)."
    pattern: "src/lib/agentic-tools-detect.ts, src/lib/agentic-tools-detect.test.ts (both new); src/lib/agentic-tools-catalogue.ts (edit — append one TOOL_CATALOGUE entry)"
    imports: "ToolDefinition, OS, TOOL_CATALOGUE from ./agentic-tools-catalogue.js; FsAccess, DetectionResult, and the cli signal function from ./agentic-tools-signals.js (task 1.2)."
    compatibility: "Relative imports need explicit .js extensions. detectAllTools()'s signature and zero-branching shape must stay stable through Phase 2/3 — later tasks add catalogue entries and a second category, never edit this function's dispatch logic beyond adding the gui-app case in task 2.1."
    gotcha: "Do not special-case 'claude-code' anywhere in detect.ts — the Claude Code entry must reach 'confirmed'/'likely'/'not-detected' purely through the generic cli signal function and its own catalogue data, otherwise AC3's zero-per-tool-branching claim is false. Do not add Cursor, Windsurf, or OpenCode entries here — those are tasks 2.2 and 3.1."
    verify:
      - "npm run build"
      - "node --test dist/lib/agentic-tools-detect.test.js"
    checklist:
      - "detectTool() dispatches purely on definition.category, with no toolId comparison anywhere in its body."
      - "detectAllTools() contains no per-tool conditional and iterates TOOL_CATALOGUE generically."
      - "The Claude Code TOOL_CATALOGUE entry carries sourceConfidence: 'carried-from-investigation' on its OsPath facts."
      - "grep -E -c \"cursor|windsurf|opencode\" src/lib/agentic-tools-detect.ts returns 0."
      - "node --test dist/lib/agentic-tools-detect.test.js exits 0, proving all three Claude Code confidence branches."
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Phase 2 — `gui-app` category, Cursor/Windsurf entries
  ```yaml
  description: "Implement the gui-app signal function including its Linux confidence cap, add the Cursor and Windsurf catalogue entries with the verified per-OS data, and extend the detect test suite to cover both. Implements plan.md Staged task breakdown Phase 2 (lines 315-327)."
  ```

  - [x] 2.1 Implement the `gui-app` signal function, including the Linux confidence cap
    ```yaml
    description: "Add the gui-app category signal function to agentic-tools-signals.ts: app-bundle path match as primary signal, configDir plus Linux PATH-binary as corroborating signals, with the Linux-specific 'weak' cap."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/lib/agentic-tools-signals.ts, add the gui-app category signal function per Design > 'Category-level signal rules' (lines 203-213): primary signal is pathExists() across the queried OS's app-bundle/install-location candidate list in configDir[os] (or a dedicated install-path list per ToolDefinition, matching whatever shape task 1.1's ToolDefinition already defines for this) — a match → 'confirmed'."
      - "Corroborating signals when no install-path candidate matches: pathExists() on configDir[os], plus — Linux only — resolveBinaryOnPath() on pathBinaryNames if present. Rule: configDir exists → 'likely' on macOS/Windows, but capped at 'weak' on Linux specifically, never 'confirmed' from configDir alone on any OS. Neither → 'not-detected'."
      - "Wire the new function into detectTool()'s dispatch in src/lib/agentic-tools-detect.ts (task 1.3) so definition.category === 'gui-app' routes to it, without altering the dispatch function's overall shape or adding any toolId branch."
      - "Keep the function generic over ToolDefinition exactly as the cli function is (task 1.2) — it must not reference 'cursor' or 'windsurf' by name, since it is proven here against a fake definition and only wired to real tool data in task 2.2."
    pattern: "src/lib/agentic-tools-signals.ts (edit — add gui-app function); src/lib/agentic-tools-detect.ts (edit — extend dispatch)"
    imports: "Same FsAccess/ToolDefinition/OS types already imported in these files from tasks 1.1-1.3."
    compatibility: "Must not change the cli function's behavior or the DetectionResult/FsAccess shapes from task 1.2."
    gotcha: "The Linux nuance is the non-trivial part per the plan's own effort note (line 317): a missing app-bundle match on Linux is far less informative than on macOS/Windows because Linux packaging (AppImage/.deb/.tar.gz) has no single authoritative install path — do not let Linux configDir-only reach 'likely' the way macOS/Windows does. Do not add a Windows registry check (HKLM Uninstall scan) — Out of scope / Open Question 3, explicitly excluded."
    verify:
      - "npm run build"
    checklist:
      - "gui-app signal function returns 'confirmed' only on an app-bundle/install-path match, never from configDir alone."
      - "configDir-only match returns 'likely' on macos/windows and 'weak' on linux, per the same function on the same fake definition run with each os value."
      - "The gui-app function does not reference any literal tool id."
      - "grep -E -c \"cursor|windsurf\" src/lib/agentic-tools-signals.ts returns 0."
      - "npm run build completes with zero TypeScript errors."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.2 Add the Cursor and Windsurf catalogue entries
    ```yaml
    description: "Append the Cursor and Windsurf ToolDefinition entries to TOOL_CATALOGUE using the verified per-OS data and sourceConfidence tags from the plan's Verified catalogue section."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/lib/agentic-tools-catalogue.ts, append the Cursor entry (category 'gui-app') per plan.md's Verified catalogue (lines 221-238): configDir '~/.cursor/' (macOS/Linux) and '%USERPROFILE%\\.cursor\\' (Windows), each tagged sourceConfidence: 'verified' with the cursor.com citations; integration formats for '.cursor/rules/*.mdc' (current) and '.cursorrules' (deprecatedFallback); MCP config at '~/.cursor/mcp.json' (global) / '.cursor/mcp.json' (project); macOS app bundle '/Applications/Cursor.app' tagged 'carried-from-investigation' (not independently re-sourced this pass); Windows install location '%LOCALAPPDATA%\\Programs\\cursor\\' tagged 'verified'; Linux has no single install path — use the 'cursor' PATH binary via pathBinaryNames as the practical Linux signal."
      - "Append the Windsurf entry (category 'gui-app') per the same section (lines 240-264): base configDir '~/.codeium/windsurf/' tagged 'verified' for macOS/Linux (docs.devin.ai); the Windows translation '%USERPROFILE%\\.codeium\\windsurf\\' tagged 'placeholder-unverified' (the source doc lists a literal '~' verbatim even for Windows); rule formats '.devin/rules/*.md' (preferred) and '.windsurf/rules/*.md' (fallback), legacy '.windsurfrules', global rules at '~/.codeium/windsurf/memories/global_rules.md' — all tagged 'verified'; MCP config '~/.codeium/windsurf/mcp_config.json' tagged 'verified' (source-agreement caveat per the plan); Windows install location 'C:\\Program Files\\Windsurf' tagged 'placeholder-unverified'."
      - "Every OsPath fact must carry the exact sourceConfidence tag the plan assigns it — this is the per-OS-not-per-tool precision that task 3.2's needsManualVerification derivation and task 2.3's tests depend on."
    pattern: "src/lib/agentic-tools-catalogue.ts (edit — append two TOOL_CATALOGUE entries)"
    imports: "None beyond what task 1.1 already established in this file."
    compatibility: "Entry shape must match the ToolDefinition interface from task 1.1 exactly — no ad hoc fields."
    gotcha: "Do not silently upgrade a plan-tagged 'placeholder-unverified' or 'carried-from-investigation' fact to 'verified', and do not silently downgrade a 'verified' fact — the tags are the whole point of AC1 and AC4. Do not add GitHub Copilot or Continue.dev entries — Open Question 1, explicitly deferred, not this workstream's call to make."
    verify:
      - "npm run build"
    checklist:
      - "Cursor entry exists with category 'gui-app', per-OS configDir OsPath entries, pathBinaryNames including 'cursor', and integration formats for rules (.mdc + deprecated .cursorrules) and MCP config."
      - "Windsurf entry exists with category 'gui-app', its Windows configDir and Windows install location both tagged sourceConfidence: 'placeholder-unverified', and its macOS/Linux facts tagged 'verified'."
      - "No OsPath fact's sourceConfidence value was changed from what plan.md's Verified catalogue section states."
      - "npm run build completes with zero TypeScript errors."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.3 Extend detect tests for the `gui-app` category
    ```yaml
    description: "Extend agentic-tools-detect.test.ts to prove app-bundle-found confirms, Linux config-dir-only caps at weak, and a placeholder-unverified fact surfaces needsManualVerification: true."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/lib/agentic-tools-detect.test.ts (created in task 1.3), add cases against the Cursor and/or Windsurf entries per Staged task breakdown Phase 2 item 3 (lines 324-327): app-bundle/install-path found → detectTool() returns 'confirmed'; on 'linux', configDir-only (no bundle, no binary) → capped at 'weak', not 'likely'."
      - "Add a case asserting that when the resolved fact for the queried os is tagged 'placeholder-unverified' (e.g. Windsurf's Windows install location or config dir, queried with os: 'windows'), the returned DetectionResult has needsManualVerification: true, per AC4."
      - "Add a case asserting needsManualVerification is false when the same tool is queried on an os whose facts are all 'verified' (e.g. Windsurf on 'macos') — proving the per-OS scoping, not a blanket per-tool flag."
    pattern: "src/lib/agentic-tools-detect.test.ts (edit — add gui-app cases)"
    imports: "TOOL_CATALOGUE entries from task 2.2; detectTool() from task 1.3/2.1; an in-memory fake FsAccess, extended as needed for app-bundle/install-path checks."
    compatibility: "Follows the same node:test + node:assert/strict pattern as the existing cli cases in this file."
    gotcha: "Use the real Cursor/Windsurf catalogue entries from task 2.2, not synthetic fixtures, so the test also exercises the actual sourceConfidence tags authored there — a synthetic fixture would not catch a mistagged fact in the catalogue itself."
    verify:
      - "npm run build"
      - "node --test dist/lib/agentic-tools-detect.test.js"
    checklist:
      - "A gui-app 'confirmed' case, a Linux 'weak'-cap case, and a needsManualVerification: true case are all present and passing."
      - "A needsManualVerification: false case exists for a fully-verified OS on the same tool, proving per-OS not per-tool scoping."
      - "node --test dist/lib/agentic-tools-detect.test.js exits 0."
    self_eval:
      passed: true
      failures: []
    ```

- [x] 3. Phase 3 — OpenCode entry, full-catalogue integration, placeholder surfacing
  ```yaml
  description: "Add the OpenCode catalogue entry, harden needsManualVerification's per-OS derivation across the complete catalogue, and prove detectAllTools() end to end across all four tools plus a golden-catalogue shape test. Implements plan.md Staged task breakdown Phase 3 (lines 329-345)."
  ```

  - [x] 3.1 Add the OpenCode catalogue entry
    ```yaml
    description: "Append the OpenCode ToolDefinition entry (cli category, reusing the Phase 1 signal function unmodified) with its skills/ subdirectory and placeholder-unverified Windows path."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/lib/agentic-tools-catalogue.ts, append the OpenCode entry (category 'cli') per plan.md's Verified catalogue (lines 266-278): global configDir '~/.config/opencode/' tagged 'verified' for macOS/Linux (opencode.ai/docs/config/); files opencode.json/opencode.jsonc and tui.json under that dir, and a dedicated skills/ subdirectory ('~/.config/opencode/skills/') alongside agents/commands/modes/plugins/tools/themes — all tagged 'verified', same source."
      - "AGENTS.md is read from the project root automatically, plus a global copy at '~/.config/opencode/AGENTS.md' — tagged 'verified' (opencode.ai/docs/rules/)."
      - "Windows configDir: OpenCode's own docs state no Windows path; use '%APPDATA%\\opencode\\' as the best-guess candidate, tagged sourceConfidence: 'placeholder-unverified' — not asserted as fact, per the plan's explicit instruction for this case."
      - "Set pathBinaryNames to include 'opencode' so the unmodified Phase 1 cli signal function (task 1.2) applies to this entry with no new signal logic."
    pattern: "src/lib/agentic-tools-catalogue.ts (edit — append one TOOL_CATALOGUE entry)"
    imports: "None beyond what task 1.1 already established in this file."
    compatibility: "Entry shape must match the ToolDefinition interface from task 1.1 exactly; category 'cli' means detectTool() routes it to the existing cli signal function with zero new code in agentic-tools-signals.ts or agentic-tools-detect.ts."
    gotcha: "Do not add any new signal-function logic for OpenCode — the plan's whole point here is that cli category code is reused unmodified (Phase 3 item 1, line 332-335). Do not assert a Windows path as fact; it must be tagged 'placeholder-unverified'."
    verify:
      - "npm run build"
    checklist:
      - "OpenCode entry exists with category 'cli', pathBinaryNames including 'opencode', and a skills/ integration format distinct from AGENTS.md."
      - "OpenCode's Windows configDir OsPath is tagged sourceConfidence: 'placeholder-unverified'."
      - "OpenCode's macOS/Linux configDir facts are tagged sourceConfidence: 'verified'."
      - "No new code was added to agentic-tools-signals.ts or agentic-tools-detect.ts by this task (git diff on both files is empty)."
      - "npm run build completes with zero TypeScript errors."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.2 Harden per-OS `needsManualVerification` derivation across the full catalogue
    ```yaml
    description: "Ensure needsManualVerification is derived per queried OS, not per tool, so a tool verified on macOS/Linux but placeholder-unverified on Windows reports correctly for each OS independently, across all four catalogue entries."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/lib/agentic-tools-detect.ts, review/adjust detectTool()'s needsManualVerification derivation (first implemented narrowly in task 1.2) so it holds for every entry now in TOOL_CATALOGUE, per Staged task breakdown Phase 3 item 2 (lines 336-341): a tool can be 'verified' on macOS/Linux and 'placeholder-unverified' on Windows simultaneously (OpenCode and Windsurf both fit this shape) — the flag must reflect only the fact(s) actually resolved for the os argument passed to that call, never any other OS entry on the same ToolDefinition."
      - "This is a review/tightening pass, not new signal logic — the derivation rule itself was already stated in task 1.2; this task's job is proving it holds once every entry (Claude Code, Cursor, Windsurf, OpenCode) exists and exercising the OpenCode/Windsurf Windows-placeholder cases specifically."
    pattern: "src/lib/agentic-tools-detect.ts (edit — tighten needsManualVerification derivation if the review finds a gap)"
    imports: "TOOL_CATALOGUE (now complete with all four entries) from ./agentic-tools-catalogue.js."
    compatibility: "Must not change DetectionResult's shape or detectTool()'s signature from task 1.2/2.1."
    gotcha: "The failure mode this guards against is a per-tool flag (e.g. 'this tool has any placeholder fact anywhere') instead of a per-OS one — that would wrongly mark OpenCode's macOS query as needing manual verification just because its Windows entry is a placeholder. Verify this against OpenCode specifically, since it is the entry added immediately before this task."
    verify:
      - "npm run build"
    checklist:
      - "detectTool() for OpenCode queried with os: 'macos' or 'linux' returns needsManualVerification: false."
      - "detectTool() for OpenCode queried with os: 'windows' returns needsManualVerification: true."
      - "detectTool() for Windsurf shows the same macOS/Linux-false, Windows-true split."
      - "npm run build completes with zero TypeScript errors."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.3 Full `detectAllTools()` integration test and golden-catalogue shape test
    ```yaml
    description: "Add a full detectAllTools() test across all four catalogue entries, plus a golden-catalogue data-shape test, in a new agentic-tools-catalogue.test.ts file."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/lib/agentic-tools-catalogue.test.ts (node:test + node:assert/strict), per Staged task breakdown Phase 3 item 3 (lines 342-345) and Testing strategy's catalogue coverage note (lines 370-373)."
      - "Add a detectAllTools() integration test: run it against the full TOOL_CATALOGUE with an in-memory fake FsAccess, asserting it returns exactly one DetectionResult per catalogue entry (four, currently) and that each result's toolId matches its catalogue entry's id."
      - "Add a golden-catalogue shape test: for every TOOL_CATALOGUE entry, assert it has a category, at least one signal source appropriate to that category (pathBinaryNames for cli, an app-bundle/install-path candidate for gui-app), and macOS-and-Linux path data present, per AC1 and the plan's own 'cheap insurance against a future catalogue edit silently leaving a tool's entry incomplete' rationale."
      - "Confirm, as a final checklist item rather than new code, that no consumer imports these modules yet: grep for 'agentic-tools' across src/server.ts and src/public/*.ts returns nothing, matching Data & compatibility's statement that WS-42/WS-43 are the first consumers (lines 349-352)."
    pattern: "src/lib/agentic-tools-catalogue.test.ts (new file)"
    imports: "TOOL_CATALOGUE from ./agentic-tools-catalogue.js; detectAllTools() from ./agentic-tools-detect.js."
    compatibility: "Follows the same node:test + node:assert/strict + in-memory-fake pattern as the other *.test.ts files in this workstream and src/lib/extract.test.ts."
    gotcha: "The golden-catalogue test is meant to catch a future incomplete entry, so assert structurally (category present, signal source present, macOS/Linux paths present) rather than pinning exact string values already covered by tasks 1.3/2.2/3.1's own tests — duplicating those assertions here adds no coverage and couples this test to catalogue data churn."
    verify:
      - "npm run build"
      - "node --test dist/lib/agentic-tools-catalogue.test.js"
      - "node --test dist/lib/agentic-tools-signals.test.js dist/lib/agentic-tools-detect.test.js dist/lib/agentic-tools-catalogue.test.js"
    checklist:
      - "detectAllTools() returns exactly four DetectionResults, one per catalogue entry, each with a matching toolId."
      - "Every TOOL_CATALOGUE entry passes the golden-catalogue shape assertions."
      - "grep -rE \"agentic-tools\" src/server.ts src/public/*.ts returns nothing, confirming no consumer exists yet."
      - "All three new *.test.ts files (agentic-tools-signals, agentic-tools-detect, agentic-tools-catalogue) pass together in one node --test run."
      - "npm run build completes with zero TypeScript errors and git diff tsconfig.json remains empty."
    self_eval:
      passed: true
      failures: []
    ```
