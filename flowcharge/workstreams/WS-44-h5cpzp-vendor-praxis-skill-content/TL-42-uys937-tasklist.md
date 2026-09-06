---
id: TL-42-uys937
type: tasklist
workstream: WS-44-h5cpzp
slug: vendor-praxis-skill-content
title: "Vendor the Praxis skill suite and implement the real getInstallContent reader"
status: done
created: 2026-08-18
updated: 2026-08-20
author: Anthony Koukoullis
depends_on: [PLN-35-9appdu]
links: []
mode: spec
base_commit: 0d82a04
---

# PRX Tasks

## Vendor the Praxis skill suite and implement the real getInstallContent reader

Tasks PLN-35-9appdu (`flowcharge/workstreams/WS-44-h5cpzp-vendor-praxis-skill-content/plan.md`).
Two independent pieces: a hand-run sync script (`tools/sync-praxis-skills.mjs`) that vendors the
sibling `/Users/akoukoullis/Work/AK/Praxis/skills/` tree into a new `skills/` directory in this
repo, committed to git; and a new `src/lib/skill-content.ts` reader that implements the real
`getInstallContent(toolId)` against WS-42's documented (but not-yet-landed) `GetInstallContent`
port shape, reading the vendored tree fresh on every call. The plan's Phase 4 (wiring the reader
into WS-42's IPC handler) is conditional on WS-42 having landed `electron/agentic-tools-ipc-handlers.cts`
first — confirmed absent from this repo at authoring time — so it is not tasked here; see the
chat report for why.

- [x] 1. Build the vendoring sync script
  ```yaml
  description: "Create tools/sync-praxis-skills.mjs, a copy-assets.mjs-style script that wipes and recursively re-copies the sibling Praxis repo's skills/ into this repo's skills/."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Create tools/sync-praxis-skills.mjs, following tools/copy-assets.mjs's exact style (read at authoring time): plain ESM, `__dirname` via `path.dirname(fileURLToPath(import.meta.url))`, `repoRoot = path.join(__dirname, '..')`, one console.log per copied file, no try/catch."
    - "Compute sourceDir = path.join(repoRoot, '..', 'Praxis', 'skills') (plan Assumption 2) and destDir = path.join(repoRoot, 'skills')."
    - "Before copying, remove any existing destDir with fs.rmSync(destDir, { recursive: true, force: true })."
    - "Walk sourceDir recursively: for each entry, skip dotfiles, anything matching .git*, and anything matching *.zip; for a directory, fs.mkdirSync(dest, { recursive: true }) then recurse; for a file, fs.copyFileSync(src, dest) then console.log a message naming the copied file's path relative to sourceDir."
  pattern: "tools/sync-praxis-skills.mjs (new)"
  imports: "node:fs, node:path, node:url (fileURLToPath) — same as tools/copy-assets.mjs, no third-party dependencies"
  compatibility: "Must match tools/copy-assets.mjs's plain-ESM, no-dependency, no-try/catch style exactly; repoRoot computed from __dirname exactly as copy-assets.mjs does."
  gotcha: "The source path must be computed relative to repoRoot, not hardcoded to a username-specific absolute path, so the script keeps working if this repo is cloned elsewhere on the same machine (plan Assumption 2)."
  verify:
    - "node tools/sync-praxis-skills.mjs"
    - "ls skills/ shows prx-bug-hunt, prx-dev-principles, prx-git, prx-issue-list, prx-orchestrate, prx-plain-text-kanban, prx-plan-feature, prx-task-list, and no dotfiles/.git*/.zip entries"
    - "Run node tools/sync-praxis-skills.mjs a second time and confirm it exits cleanly with an identical resulting tree (idempotency from the rm -rf pre-step)"
  checklist:
    - "Script contains no try/catch block"
    - "Script logs exactly one console.log line per copied file"
    - "Source path is computed from repoRoot, not hardcoded"
    - "The rm -rf pre-step runs before the copy on every invocation"
    - "Dotfiles, .git*, and *.zip entries are excluded from the walk"
  self_eval:
    passed: true
    failures: []
  ```

- [x] 2. Run and commit the vendored content
  ```yaml
  description: "Run tools/sync-praxis-skills.mjs against the real sibling repo, review the result, and commit skills/ together with the sync script."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Run `node tools/sync-praxis-skills.mjs` from the repo root to populate skills/."
    - "Review the change with `git status` and `git diff --stat`, confirming only additions under skills/ plus tools/sync-praxis-skills.mjs appear."
    - "Spot-check a few copied files against their Praxis source (e.g. skills/prx-dev-principles/SKILL.md, skills/prx-orchestrate/CONVENTIONS.md) to confirm byte-for-byte match."
    - "Commit skills/ and tools/sync-praxis-skills.mjs together in one commit."
  pattern: "skills/** (new, ~360K), tools/sync-praxis-skills.mjs (from task 1)"
  imports: "git"
  compatibility: "n/a — content-only commit, no code changes beyond task 1's script"
  gotcha: "Commit skills/ and the script together in one commit, per the plan's Phase 2 — not as separate commits."
  verify:
    - "git diff --stat shows only additions under skills/ plus the one new tools/sync-praxis-skills.mjs"
    - "diff -r skills/prx-dev-principles /Users/akoukoullis/Work/AK/Praxis/skills/prx-dev-principles reports no differences (spot-check)"
    - "git log -1 --stat on the resulting commit shows both skills/ and tools/sync-praxis-skills.mjs"
  checklist:
    - "skills/ contains exactly the 8 prx-* directories, no dotfiles/.git*/.zip"
    - "skills/prx-orchestrate/CONVENTIONS.md, prompts/*.md, and scripts/** are present and intact"
    - "git diff --stat shows no modifications or deletions outside skills/ and tools/sync-praxis-skills.mjs"
    - "Spot-checked files match the Praxis source byte-for-byte"
  self_eval:
    passed: true
    failures:
      - item: "git diff --stat shows no modifications or deletions outside skills/ and tools/sync-praxis-skills.mjs"
        reason: "The working tree also carries a pre-existing, unrelated .gitignore modification and an untracked flowcharge-pre-migration-2026-08-17/ directory, both present before this task ran and out of this task's scope (not touched by tools/sync-praxis-skills.mjs or this task's own work)."
        fix: "No fix applied — out of scope per task instructions. A commit scoped to `git add skills/ tools/sync-praxis-skills.mjs` (not `git add .`) would contain only the intended additions; this was confirmed but not executed, since actually running git add/commit is deferred to a separate gated step per this task's execution instructions."
  ```

- [x] 3. Implement the getInstallContent reader
  ```yaml
  description: "Implement src/lib/skill-content.ts's getInstallContent reader and its co-located test file, conforming to WS-42's documented GetInstallContent port shape."
  self_eval:
    passed: true
    failures: []
  ```

  - [x] 3.1 Create src/lib/skill-content.ts
    ```yaml
    description: "Implement the SkillContent/InstallContent types, getInstallContent, and the hand-rolled SKILL.md frontmatter parser."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/lib/skill-content.ts per the plan's Contracts section: local `SkillContent`/`InstallContent` interfaces (provisional copies of WS-42's documented port shape, flowcharge/workstreams/WS-42-7fm9ak-skill-install-sync-engine/plan.md:235), and an exported `async function getInstallContent(toolId: string): Promise<InstallContent>` that ignores toolId and reads `<repoRoot>/skills/` fresh on every call (plan Assumption 4, no caching)."
      - "Add a header comment on the interfaces noting they are provisional local copies of WS-42's not-yet-existing agentic-tools-content.ts, kept structurally compatible so getInstallContent is assignable to WS-42's real GetInstallContent type once that file exists, per the plan's Design section."
      - "Implement `parseSkillFrontmatter(raw: string): { name: string; description: string; body: string }` as a hand-rolled parser (per the plan's settled Open Question 1) for exactly SKILL.md's two-key grammar: a same-line `name:` scalar; a `description:` that is either a same-line scalar or a folded block scalar (`description: >-` followed by more-indented continuation lines joined with single spaces per YAML folding rules); `body` is SKILL.md's content with the frontmatter block removed."
      - "Implement `readSkillDirectory(dir: string): SkillContent` — reads SKILL.md, splits frontmatter via parseSkillFrontmatter, sets id/name from the frontmatter name: value, description from the parsed description, body from the parsed body, then walks the rest of the directory (skipping SKILL.md and the same dotfile/.git*/*.zip exclusions the sync script uses) to build `files: { relativePath, content }[]` with forward-slash relativePaths relative to the skill's own directory, sorted by relativePath ascending; omit or empty-array files when there are none."
      - "Implement getInstallContent to list the skills/ directory's entries, call readSkillDirectory on each, sort the resulting SkillContent[] by id ascending, and return `{ version: 'vendored-skills', skills }` (plan Assumption 3's static literal)."
    pattern: "src/lib/skill-content.ts (new)"
    imports: "node:fs, node:path — matching src/lib/extract.ts's and src/lib/yaml-block.ts's plain, dependency-free style"
    compatibility: "Must join src/lib/'s existing flat, dependency-free module family (extract.ts, git.ts, projects.ts, yaml-block.ts) — no new dependencies. Must NOT import IntegrationFormat, ToolDefinition, or anything from WS-42's install-target/tracking concerns (Design: 'Where this fits')."
    gotcha: "yaml-block.ts's grammar explicitly does not support block scalars (src/lib/yaml-block.ts:19), so this module must not reuse it for description parsing — prx-dev-principles/SKILL.md's description uses `>-` folded across 10 lines and would silently land in yaml-block.ts's _raw catch-all if reused unmodified. This module's own parseSkillFrontmatter is the fix, per the plan's settled Open Question 1."
    verify:
      - "npm run build"
      - "node -e \"import('./dist/lib/skill-content.js').then(m => m.getInstallContent('claude-code')).then(c => console.log(c.skills.length))\" prints 8"
    checklist:
      - "getInstallContent ignores its toolId argument and returns the same 8-skill result regardless of input"
      - "SkillContent.id and .name both come from SKILL.md's frontmatter name: value"
      - "prx-dev-principles's description parses as a single non-empty folded string, not truncated or landed in a raw catch-all"
      - "prx-orchestrate's files includes CONVENTIONS.md, each prompts/*.md, scripts/prx-index.mjs, and scripts/test/run-tests.mjs with forward-slash relativePaths"
      - "The other 7 single-file skills have files omitted or []"
      - "No import of IntegrationFormat, ToolDefinition, or any WS-42 install-target/tracking type"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.2 Create src/lib/skill-content.test.ts
    ```yaml
    description: "Write the node --test suite covering all 8 skills, the folded-description case, prx-orchestrate's nested files, and the exclusion rules."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/lib/skill-content.test.ts under node --test (matching extract.test.ts's precedent, read at authoring time: import { test } from 'node:test', import assert from 'node:assert/strict')."
      - "Cover: all 8 skills present with non-empty id/name/description/body."
      - "Cover: prx-dev-principles's folded-block-scalar description parses to a non-empty single string."
      - "Cover: prx-orchestrate's files enumerates its known nested files (CONVENTIONS.md, each prompts/*.md, scripts/prx-index.mjs, scripts/test/run-tests.mjs) with correct forward-slash relativePaths."
      - "Cover: a stray dotfile/.git*/*.zip placed under a skill directory (in a throwaway temp copy, not the committed skills/ tree) is excluded from files."
    pattern: "src/lib/skill-content.test.ts (new)"
    imports: "node:test, node:assert/strict, node:fs, node:os, node:path — matching src/lib/extract.test.ts's precedent"
    compatibility: "Run via `node --test dist/lib/skill-content.test.js` after npm run build, matching extract.test.ts's own documented invocation."
    gotcha: "The dotfile/.git*/.zip exclusion test needs a throwaway copy of one skill directory (e.g. under os.tmpdir()) with an extra stray file added, so it doesn't mutate the committed skills/ tree — follow extract.test.ts's own temp-dir setup/teardown pattern."
    verify:
      - "npm run build"
      - "node --test dist/lib/skill-content.test.js"
    checklist:
      - "All 8 skills asserted present with non-empty id/name/description/body"
      - "prx-dev-principles folded-description case is covered and asserts a non-empty single string"
      - "prx-orchestrate nested-files case asserts exact relativePaths for all 4 known nested files"
      - "Dotfile/.git*/.zip exclusion case is covered without mutating the committed skills/ tree"
      - "node --test dist/lib/skill-content.test.js exits 0"
    self_eval:
      passed: true
      failures: []
    ```
