---
id: PLN-31-uxdkro
type: plan
workstream: WS-41-3783cz
slug: detect-agentic-tool-config-locations
title: "Detection catalogue and engine for agentic coding tool config locations"
status: done
created: 2026-08-18
updated: 2026-08-19
depends_on: []
links: []
---

## Summary

This plan builds a static, per-tool data catalogue plus a small detection engine that
classifies whether each of four named agentic coding tools (Claude Code, Cursor,
Windsurf, OpenCode) is installed on the current machine,
at what confidence, and what config-directory path, skill/rule file format, and MCP
config format it uses on macOS, Linux, and Windows. The catalogue and engine are the
"findings" WS-42-7fm9ak (install-and-sync engine) depends on, and transitively what
WS-43-4cpdch's onboarding screen runs.

The chosen design is **data-driven**: one `ToolDefinition` catalogue entry per tool
(paths, formats, detection signals) evaluated by a small set of shared,
category-level signal functions (one each for the CLI and GUI-app categories Context
itself identifies) — never one bespoke detector per tool. Adding a
fifth tool means appending one catalogue entry; it never touches the two
category-level signal functions or the orchestration function that runs them. All
filesystem/PATH/registry access goes through a small `FsAccess` port (an interface,
not an implementation) so this workstream's logic is fully unit-testable today, under
this repo's existing `node --test` convention (`src/lib/extract.test.ts` is the
precedent), without needing a concrete adapter to exist first — the eventual adapter
will simply call Node's `fs`/`fs/promises` directly from Electron's main process. A
concrete Node-backed `FsAccess` adapter is explicitly WS-42's job, not this plan's —
per Context's own instruction to treat WS-36's direct Node `fs` access in Electron's
main process as this plan's assumed foundation and not re-plan it.

Every medium/low-confidence tool named in Context was checked this pass against
current, real documentation (cited inline in Design, below). The most notable finding
from that pass was that Windsurf's own documentation domain (`docs.windsurf.com`) now
redirects to `docs.devin.ai` (the product's docs have moved under Cognition/Devin
branding). Where verification still could not pin down a fact (chiefly: several
tools' exact Windows install/config paths), the catalogue entry is tagged
`placeholder-unverified` rather than asserted as fact, per Context's explicit
instruction.

## Scope

### Acceptance criteria

1. A `ToolDefinition` catalogue entry exists for all four named tools. Each entry
   carries: a `category` (`'cli' | 'gui-app'`), per-OS
   config-directory/app-bundle candidate paths (where known), its skill/rule/MCP
   integration-format spec(s), and a `sourceConfidence` tag
   (`'verified' | 'carried-from-investigation' | 'placeholder-unverified'`) on each
   OS-specific fact, distinguishing what this pass confirmed from what Context
   supplied as already-trusted, from what remains a guess.
2. `detectTool(definition, fsAccess, os)` returns a `DetectionResult` whose
   `confidence` follows the category-specific combination rules recorded in Design
   below — in particular: a CLI tool's PATH binary alone is sufficient for
   `'confirmed'` (handles the lazily-created-config-dir false negative Context names
   for Claude Code/OpenCode).
3. `detectAllTools(fsAccess, os)` runs every catalogue entry and returns one
   `DetectionResult` per tool, with zero per-tool branching inside the orchestration
   function itself — resolving the extensibility open question Context raises (adding
   a fifth tool touches only the catalogue, never `detect.ts` or `signals.ts`).
4. Any resolved path/fact whose `sourceConfidence` is `'placeholder-unverified'` is
   surfaced on the corresponding `DetectionResult` (a `needsManualVerification: true`
   flag), scoped to the specific OS the placeholder applies to — not blanket-applied
   to a whole tool when only one of its three OS entries is unverified.
5. Every category's signal-combination rule, including the false-negative scenario
   Context names by name, is proven by a passing `node --test`
   run against an in-memory fake `FsAccess` — no real filesystem, PATH, or Electron
   main-process access is exercised by this workstream's own tests.
6. `npm run build` (root `tsconfig.json`, which already includes `src/lib/**/*.ts`)
   compiles the new files with zero errors, with no change to `tsconfig.json` itself.

### Out of scope

- Any actual file write, install, or sync logic against a detected tool's config
  directory — that is WS-42-7fm9ak's job.
- Any onboarding or settings UI — that is WS-43-4cpdch's job.
- A concrete Node-backed `FsAccess` implementation (the adapter that will actually
  call `fs`/`fs/promises` directly from Electron's main process, PATH resolution, and
  any Windows registry lookup at runtime) — per Context's instruction, WS-36's direct
  Node `fs` access in Electron's main process is this plan's assumed foundation,
  referenced but not re-planned; wiring a real adapter against it is WS-42's scope.
- GitHub Copilot, Continue.dev, or any tool beyond the four Context names — recorded
  as Open Question 1, not silently added.
- Any mechanism to keep the catalogue current automatically over time (e.g. checking
  vendor docs at runtime). The catalogue is static, hand-verified data; ongoing
  maintenance as tools change their formats is a future concern, not this workstream's.
- Windows registry-based detection (e.g. an `HKLM\...\Uninstall` scan as a GUI-app
  signal). No source found during this pass documents any of the four tools relying
  on registry-only installation with no discoverable filesystem path, so the simpler
  filesystem/PATH-only signal set is judged sufficient; flagged under Open Question 3
  in case implementation-time testing on real Windows machines proves otherwise.

### Assumptions

1. **No production data, live users, or migration/rollback constraints apply.** This
   workstream produces net-new, unwired code — nothing in the existing app calls any
   of it until WS-42/WS-43 land. Standard per-run deployment question, answered here
   as "none apply"; recorded under Open Questions per process.
2. **Single local user, no multi-tenant variation** — matches this project's existing
   posture (no auth, no per-user config anywhere in the current codebase). The
   catalogue needs no per-user or per-tenant dimension.
3. **`os` is an explicit parameter, not read from `process.platform`/Node's `os` module
   internally.** Keeps every function pure and lets one test run exercise all three
   OS's path sets without needing three machines. The real OS value is supplied by
   whichever caller eventually wires this in (WS-42, presumably via Node's built-in
   `os` module (`os.platform()`), directly available in Electron's main process with
   no plugin needed) — out of this plan's scope to fetch it.
4. **New files live flat under `src/lib/`**, matching this repo's existing convention
   (`src/lib/{extract,detail,git,projects,yaml-block}.ts`, no subdirectories) rather
   than introducing a new `src/lib/agentic-tools/` folder — confirmed by inspection of
   the current `src/lib/` tree and `tsconfig.json`'s `"include": [..., "src/lib/**/*.ts", ...]`,
   which already picks up any new flat file with zero config change.

## Design

### Where this fits

`src/lib/*.ts` is this repo's existing home for pure, Node-testable logic with a
`*.test.ts` sibling run via `node --test` after `npm run build`
(`src/lib/extract.test.ts` is the live precedent, using `node:test` +
`node:assert/strict`). This plan adds three new modules to that same flat family:

- `src/lib/agentic-tools-catalogue.ts` — types (`OS`, `ToolCategory`,
  `SourceConfidence`, `ToolDefinition`, `IntegrationFormat`) and the static
  `TOOL_CATALOGUE: ToolDefinition[]` data.
- `src/lib/agentic-tools-signals.ts` — the `FsAccess` port interface and the shared,
  category-level signal-check functions.
- `src/lib/agentic-tools-detect.ts` — `detectTool()` and `detectAllTools()`.

Plus `*.test.ts` siblings for each, per this repo's existing convention.

### Contracts

```ts
// agentic-tools-catalogue.ts
type OS = 'macos' | 'linux' | 'windows';
type ToolCategory = 'cli' | 'gui-app';
type SourceConfidence = 'verified' | 'carried-from-investigation' | 'placeholder-unverified';

interface OsPath {
  path: string;              // may contain '~' or '%VAR%' tokens; FsAccess resolves them
  sourceConfidence: SourceConfidence;
  citation?: string;          // URL, present when sourceConfidence === 'verified'
}

interface IntegrationFormat {
  kind: 'skill-directory' | 'rule-directory' | 'single-rule-file'
      | 'mcp-json' | 'markdown-context-file' | 'structured-config-file';
  pathTemplate: string;       // e.g. 'skills/<name>/SKILL.md', relative to configDir or project root
  deprecatedFallback?: string;
  notes?: string;
}

interface ToolDefinition {
  id: string;                 // 'claude-code' | 'cursor' | 'windsurf' | 'opencode'
  displayName: string;
  category: ToolCategory;
  configDir: Partial<Record<OS, OsPath[]>>;   // candidate list, not a single path — see GUI-app note below
  pathBinaryNames?: string[];                 // cli category, plus optional Linux gui-app corroborating signal
  integrationFormats: IntegrationFormat[];
}
```

```ts
// agentic-tools-signals.ts
interface FsAccess {
  pathExists(path: string): Promise<boolean>;
  isDirectory(path: string): Promise<boolean>;
  resolveBinaryOnPath(name: string): Promise<string | null>;
  expandTokens(path: string): Promise<string>; // resolves '~', '%APPDATA%', '%USERPROFILE%', '%LOCALAPPDATA%'
}

type DetectionConfidence = 'confirmed' | 'likely' | 'weak' | 'not-detected';

interface DetectionResult {
  toolId: string;
  confidence: DetectionConfidence;
  resolvedConfigDir: string | null;
  matchedSignals: string[];
  needsManualVerification: boolean; // true iff any fact this result relied on is 'placeholder-unverified' for the queried OS
}
```

### Category-level signal rules (the core logic, shared across tools)

These two functions are the entire behavioral surface; `TOOL_CATALOGUE` supplies
only data. This is the direct answer to Context's own extensibility question.

- **`cli` (Claude Code, OpenCode).** Primary signal: `resolveBinaryOnPath()` on each
  of `pathBinaryNames`. Corroborating: `pathExists()` on `configDir`. Rule: binary
  found → `'confirmed'`, independent of config-dir state (this is what defeats the
  lazily-created-config-dir false negative Context names). Binary not found, config
  dir exists → `'likely'`, never `'confirmed'` — matching Context's own instruction
  that this combination is "a weaker, not confirmed, signal." Neither → `'not-detected'`.

- **`gui-app` (Cursor, Windsurf).** Primary signal: `pathExists()` across
  the OS's app-bundle/install-location candidate list. Corroborating:
  `pathExists()` on `configDir`, plus (Linux only) `resolveBinaryOnPath()` on
  `pathBinaryNames` if present. Rule: a candidate install path found → `'confirmed'`.
  No candidate found but `configDir` exists → `'likely'` on macOS/Windows (where a
  single-app-bundle convention is generally reliable, so its absence is informative),
  but capped at `'weak'` on Linux specifically — Linux packaging for these tools
  has no single authoritative install path (AppImage/`.deb`/`.tar.gz` all place the
  binary differently, confirmed during this pass's research, see Cursor below), so a
  missing bundle match there is far less informative than the same result on the other
  two OSes. Neither → `'not-detected'`.

### Verified catalogue (per tool)

Claude Code is carried exactly as Context supplied it — high confidence already, not
re-verified per Context's own instruction. The remaining three were checked this pass
against current documentation; citations are inline.

**Cursor** — category `gui-app`. Config dir: `~/.cursor/` (macOS/Linux),
`%USERPROFILE%\.cursor\` (Windows) — verified, including that this is also where
*global* (not just project) rules live locally
([cursor.com/help/customization/rules](https://cursor.com/help/customization/rules)).
Rule format: `.cursor/rules/*.mdc` (Markdown + frontmatter), deprecated single-file
fallback `.cursorrules` — verified deprecated, same source. MCP config:
`~/.cursor/mcp.json` (global) / `.cursor/mcp.json` (project) — verified
([cursor.com/docs/mcp](https://cursor.com/docs/mcp)). Windows install location:
`%LOCALAPPDATA%\Programs\cursor\` (**not** `Program Files` — it is a per-user
Electron-builder install) — verified
([dilsayar.com](https://dilsayar.com/complete-guide-adding-cursor-to-path-on-mac-windows-linux/),
[forum.cursor.com](https://forum.cursor.com/t/system-installer-for-windows/17343)).
macOS app bundle `/Applications/Cursor.app` is the standard convention but was not
independently re-sourced this pass — tagged `carried-from-investigation`. Linux has no
single install path (AppImage user-placed anywhere, or `.deb` via package manager) —
verified structurally
([dilsayar.com](https://dilsayar.com/complete-guide-adding-cursor-to-path-on-mac-windows-linux/));
the `cursor` PATH binary is the practical Linux signal instead.

**Windsurf** — category `gui-app`. **Major finding: `docs.windsurf.com` now
307-redirects to `docs.devin.ai`** — Windsurf's own documentation has moved under
Cognition/Devin branding, confirmed by fetching
`docs.windsurf.com/windsurf/cascade/memories` and following its redirect to
`docs.devin.ai/desktop/cascade/memories`. This is a bigger drift than Context's own
"Codeium-not-Windsurf naming is likely stale" flag anticipated. Config dir: base
`~/.codeium/windsurf/` — verified for macOS/Linux directly from `docs.devin.ai`; that
same primary doc also lists `~/.codeium/windsurf/` for Windows verbatim, which is an
unusual literal `~` for a Windows path, so the practical Windows translation
(`%USERPROFILE%\.codeium\windsurf\`) is tagged `placeholder-unverified` pending a real
Windows check, even though the base directory *name* is verified. Rule format:
workspace `.devin/rules/*.md` (now preferred, takes precedence) or `.windsurf/rules/*.md`
(fallback) — both verified, `docs.devin.ai`; legacy single-file `.windsurfrules` —
verified, same source; global rules at
`~/.codeium/windsurf/memories/global_rules.md` — verified, same source. MCP config:
`~/.codeium/windsurf/mcp_config.json` — corroborated by three independent secondary
sources ([fast.io](https://fast.io/resources/windsurf-mcp-setup-guide/),
[mcpfind.org](https://mcpfind.org/blog/how-to-use-mcp-with-windsurf),
[natoma.ai](https://natoma.ai/blog/how-to-enabling-mcp-in-windsurf)) but not
independently confirmed against `docs.devin.ai` itself in this pass — tagged
`verified` on the strength of source agreement, with the caveat noted. Windows
install location `C:\Program Files\Windsurf` comes from one lower-authority source
([apidog.com](https://apidog.com/blog/download-install-windsurf/)) and conflicts with
Cursor's confirmed per-user pattern from a comparable Electron-based competitor —
tagged `placeholder-unverified`.

**OpenCode** — category `cli`. Global config dir `~/.config/opencode/` verified for
macOS/Linux ([opencode.ai/docs/config/](https://opencode.ai/docs/config/)); files
`opencode.json`/`opencode.jsonc` (runtime config) and `tui.json` (TUI settings) —
verified, same source. **Resolves Context's open point in OpenCode's favor:** the docs
list a dedicated `skills/` subdirectory alongside `agents/`, `commands/`, `modes/`,
`plugins/`, `tools/`, `themes/` under the config dir — OpenCode does have a distinct
skill concept beyond `AGENTS.md`, at `~/.config/opencode/skills/`. `AGENTS.md` is read
from the project root automatically, plus a global copy at
`~/.config/opencode/AGENTS.md` — verified
([opencode.ai/docs/rules/](https://opencode.ai/docs/rules/)). Windows path: OpenCode's
own docs do not state one; `%APPDATA%\opencode\` is kept only as the best-guess
candidate, explicitly tagged `placeholder-unverified` — not asserted as fact, per
Context's instruction for exactly this situation.

### What each module knows / must not know

- `agentic-tools-catalogue.ts` knows tool facts (paths, formats, confidence tags). It
  must not know how those facts get evaluated against a real machine — no `FsAccess`
  calls, no OS-detection logic.
- `agentic-tools-signals.ts` knows the two category rules and the `FsAccess` port
  shape. It must not know which specific tools exist — it takes a `ToolDefinition` as
  a plain argument and never references `'cursor'`, `'windsurf'`, etc. by name.
- `agentic-tools-detect.ts` knows how to iterate the catalogue and dispatch each entry
  to its category's signal function. It must not know the fs/PATH mechanics — those
  live entirely behind `FsAccess`, whose concrete implementation this workstream never
  writes.

## Staged task breakdown

Three phases, each independently buildable and testable, ordered so the shared
contracts land before any tool-specific data leans on them.

**Phase 1 — Contracts, `cli` category, Claude Code end-to-end.** (small–medium)

1. Define `OS`, `ToolCategory`, `SourceConfidence`, `OsPath`, `IntegrationFormat`,
   `ToolDefinition`, and an empty `TOOL_CATALOGUE: ToolDefinition[]`. File:
   `src/lib/agentic-tools-catalogue.ts`. Effort: small. Depends on: nothing. Verify:
   `npm run build` succeeds.
2. Define the `FsAccess` port, `DetectionConfidence`, `DetectionResult`, and the `cli`
   category signal function. File: `src/lib/agentic-tools-signals.ts`. Effort: small.
   Depends on: task 1. Verify: `node --test` against an in-memory fake `FsAccess`
   covering binary-found, config-dir-only, and neither.
3. Implement `detectTool()`/`detectAllTools()`, and add the Claude Code catalogue
   entry (`sourceConfidence: 'carried-from-investigation'`). Files:
   `src/lib/agentic-tools-detect.ts`, entry in `agentic-tools-catalogue.ts`. Effort:
   small. Depends on: task 2. Verify: `node --test` — `detectTool()` against the
   Claude Code entry returns `'confirmed'` when the fake reports the `claude` binary
   on PATH, `'likely'` when only the config dir exists, `'not-detected'` otherwise.

**Phase 2 — `gui-app` category, Cursor/Windsurf entries.** (medium)

1. Implement the `gui-app` signal function, including the Linux-specific confidence
   cap and its PATH-binary corroborating fallback. File: `agentic-tools-signals.ts`.
   Effort: medium (the Linux nuance is the non-trivial part). Depends on: Phase 1.
2. Add the Cursor and Windsurf catalogue entries using the verified
   data above, each fact carrying its correct `sourceConfidence` tag. File:
   `agentic-tools-catalogue.ts`. Effort: medium (two tools' worth of per-OS data).
   Depends on: task 1.
3. Tests: app-bundle-found → `'confirmed'`; Linux config-dir-only → capped at
   `'weak'`; a `placeholder-unverified` fact (e.g. Windsurf's Windows install
   location) surfaces `needsManualVerification: true` on the result. File:
   `agentic-tools-detect.test.ts`. Effort: small. Depends on: task 2.

**Phase 3 — OpenCode entry, full-catalogue integration, placeholder surfacing.**
(small–medium)

1. Add the OpenCode catalogue entry (`cli` category, reusing Phase 1's signal
   function unmodified), including its `skills/` subdirectory and the
   `placeholder-unverified`-tagged Windows path. File: `agentic-tools-catalogue.ts`.
   Effort: small. Depends on: Phase 1.
2. Implement `needsManualVerification` derivation on `DetectionResult` — scoped to
   the specific OS queried, since a tool can be `verified` on macOS/Linux and
   `placeholder-unverified` on Windows simultaneously (OpenCode and
   Windsurf both fit this shape). File: `agentic-tools-detect.ts`. Effort: medium (the
   per-OS-not-per-tool precision is the real work here). Depends on: every catalogue
   entry existing (Phases 1–2 plus this phase's task 1).
3. A full `detectAllTools()` test across all four entries, plus a "golden catalogue"
   shape test asserting every entry has a non-empty signal set and at least
   macOS-and-Linux path data. File: `agentic-tools-catalogue.test.ts`. Effort: small.
   Depends on: tasks 1–2.

## Data & compatibility

No migrations — no existing data model is touched. All three new files are purely
additive; nothing in `src/server.ts`, `src/public/*.ts`, or any existing `src/lib/*.ts`
file imports them by the end of this plan, since no consumer exists yet (WS-42/WS-43
are the consumers). Rollback, if ever needed, is a plain `git revert` — there is no
wiring anywhere else in the app to unwind. Backward compatibility is not applicable:
this is new code with no prior version.

## Testing strategy

Every phase's own unit tests are `node --test`-based, following
`src/lib/extract.test.ts`'s existing pattern exactly (a fake/in-memory dependency, no
real filesystem access, run via `node --test dist/lib/*.test.js` after `npm run
build`). Coverage per module:

- `agentic-tools-signals.ts`: each of the two category functions gets a test per
  branch of its confidence rule (see each phase's task list above) — this is where
  the false-negative scenario Context names by name is pinned down
  as a regression test, not left as a prose claim.
- `agentic-tools-detect.ts`: `detectTool()` against one representative entry per
  category, plus `detectAllTools()` end-to-end across the full four-tool catalogue
  once Phase 3 lands.
- `agentic-tools-catalogue.ts`: a data-shape ("golden catalogue") test — every entry
  has a `category`, at least one signal source appropriate to that category, and
  macOS/Linux path data — cheap insurance against a future catalogue edit silently
  leaving a tool's entry incomplete.

No integration test against a real installed tool is in scope here — that needs a
real machine with the tool actually installed, which is exactly the kind of
verification WS-42/WS-43's own later testing phases are better placed to do once a
real `FsAccess` adapter exists.

## Open questions

1. **Should GitHub Copilot and/or Continue.dev be added to the catalogue?** Context
   explicitly flags both as candidates without deciding, and instructs this plan not
   to silently add them. Options: (a) leave both out of this workstream entirely,
   revisit as a follow-up workstream once the four-tool engine has shipped and proven
   itself; (b) add both now while the catalogue shape is fresh. *Recommendation: (a)*
   — Context's own three-item batch (WS-41/42/43) is scoped and ordered around the
   four named tools; folding in two more mid-plan would widen WS-42's and WS-43's
   already-fixed dependencies without their own sign-off.

2. **Several Windows paths remain genuinely unverified** — Windsurf's exact Windows
   config-dir resolution, its Windows install location, and OpenCode's Windows config
   dir. All three are tagged
   `placeholder-unverified` in the catalogue rather than asserted. *Recommendation:*
   resolve these against a real Windows machine (or a maintainer who runs one) at
   WS-42 implementation time, before that workstream's install-writer trusts any of
   these three paths for a real write.

3. **Is filesystem/PATH detection alone sufficient for the `gui-app` category, or
   does a real Windows installer sometimes require a registry check** (e.g. an
   `HKLM\...\Uninstall` scan) when neither a fixed install path nor a PATH binary is
   present? No source found during this pass indicated any of the two `gui-app`
   tools need this. *Recommendation:* ship without registry detection (Out of scope,
   above); add it only if implementation-time testing on a real Windows install shows
   the filesystem/PATH signals actually miss a real installation.

## Alternatives considered and rejected

- **One bespoke detector file per tool** (a `detectors/<tool>.ts` strategy-pattern
  file per tool, four files). Rejected: the category-level signal functions
  already capture 100% of the actual behavioral variance between tools; a per-tool
  file would mostly be near-duplicate wiring around the same rules, which is
  exactly the DRY violation the data-driven design avoids, and it directly
  contradicts the extensibility goal Context itself raises as an open concern.
- **A single monolithic `detectAllTools()` with an inline `if/else` chain per tool.**
  Rejected outright: this is the literal shape Context's own open question warns
  against — a fifth tool would require editing the core dispatch function, the
  opposite of what a catalogue-driven design buys.
- **Building directly against Node's `fs`/`fs/promises` now, instead of an
  `FsAccess` port.** Rejected: under Electron, Node's `fs` module is directly callable
  from Electron main-process code today, with no bundler obstacle at all. The port's
  real justification is testability (keeping I/O behind an injected interface so
  `node --test` can exercise it with an in-memory fake, not a real filesystem) and
  scope separation (a concrete adapter is deliberately WS-42's job, not this
  workstream's). An injected port keeps this workstream buildable and unit-testable
  today, and defers the concrete Node adapter to WS-42, which is exactly where
  Context's own workstream boundary puts it.
- **Config-directory existence alone, no per-category signals.** Rejected outright —
  this is precisely the false-negative failure mode Context's own investigation
  names by name (lazily-created Claude Code/OpenCode config dirs).

### Final summary

Data-driven catalogue (`ToolDefinition[]`) plus two shared category-level signal
functions behind an injected `FsAccess` port, evaluated by `detectTool()`/
`detectAllTools()` — three phases, small-to-medium effort each, fully unit-testable via
`node --test` — no real filesystem, PATH, or Electron main-process access needed. Top risks: several Windows-specific paths
(Windsurf, OpenCode) remain genuinely unverified and are explicitly
flagged rather than guessed; Windsurf's documentation having moved to `docs.devin.ai`
is a bigger drift than Context anticipated and may keep shifting. Open questions
needing your answer: whether to add Copilot/Continue.dev (recommend: no, not in this
workstream), and whether the three flagged Windows placeholders need real-machine
verification before WS-42 trusts them (recommend: yes, at WS-42 implementation time).
