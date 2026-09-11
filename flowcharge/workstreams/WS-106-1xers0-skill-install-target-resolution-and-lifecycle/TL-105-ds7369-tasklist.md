---
id: TL-105-ds7369
type: tasklist
workstream: WS-106-1xers0
slug: skill-install-target-resolution-and-lifecycle
title: "Canonical skill id list corrected to the real published suite"
status: done
created: 2026-09-11
updated: 2026-09-11
author: Anthony Koukoullis
depends_on: [IL-16-78bnrq]
links: []
mode: spec
base_commit: 6e0029b
---

# FlowCharge Tasks

## Canonical skill id list corrected to the real published suite

This task list is scoped to one issue in `IL-16-78bnrq-issuelist.md`.

- **ISS-42-q1t9bh (task 1).** The "Manage Integrations" modal shows a "Missing skills"
  chip for Claude Code and OpenCode at global scope, on a machine that carries the
  whole FlowCharge Core suite. `CANONICAL_PRAXIS_SKILL_IDS` in
  `src/lib/agentic-tools-canonical-skills.ts` names two skills the suite does not
  publish, `fc-orchestrate` and `fc-bug-hunt`, and omits two it does, `flowcharge` and
  `fc-validate`. `src/http/routes-integrations.ts:205` passes that array to
  `checkSkillPresence`, which probes one path per id, so two paths never exist and the
  result is always `missing-incomplete`. The fix is a direct hand update of the eight
  ids. The user confirmed on 2026-09-11 that the suite's file names are final, and
  ISS-42's own `notes` record this update as sufficient on its own.

Tasks 2 and 3 trace to no issue. `CLAUDE.md` "Closing a task list" requires them on
every task list: a full `npm test` gate, then an `ARCHITECTURE.md` review.

Run the tasks in order. Every count, exit code and state quoted in a `verify` step was
measured at `base_commit` 6e0029b. Each `node --input-type=module -e` snippet is
self-contained, needs only a build, and must run from the project root.

- [x] 1. Correct CANONICAL_PRAXIS_SKILL_IDS to the eight ids the suite publishes today (ISS-42-q1t9bh)
  ```yaml
  description: "Replace the two skill ids that no longer exist in the FlowCharge Core suite with the two that do, so the global-scope presence check probes the paths a complete install actually writes and the integrations modal stops reporting Missing skills for a fully installed tool."
  author: Anthony Koukoullis
  issues: [ISS-42-q1t9bh]
  implement:
    - "In src/lib/agentic-tools-canonical-skills.ts, at the exported array literal `CANONICAL_PRAXIS_SKILL_IDS` (:13-22), make its eight entries exactly these eight ids: fc-dev-principles, fc-git, fc-issue-list, fc-plain-text-kanban, fc-plan-feature, fc-task-list, fc-validate, flowcharge. That drops `fc-orchestrate` (:14) and `fc-bug-hunt` (:16), which the suite does not publish, and adds `flowcharge` and `fc-validate`, which it does. Keep the other six entries. Keep `export const`, the name, and the `: string[]` annotation. Keep the count at eight. Why: checkSkillPresence resolves one expected path per id, so an id with no published skill behind it can never be found on disk and forces `missing-incomplete` forever."
    - "Order inside the array is free — pick one and keep it. It changes only the order of presentSkillIds and missingSkillIds in the API response, never the status. Match the existing style: one quoted id per line, trailing comma."
    - "Change nothing else in the file. The header comment (:1-12) stays as written. Every statement in it is still true after this edit: the array is still a hand-maintained duplicate, WS-44-h5cpzp is still the workstream meant to replace it, and ak-prx-migrate is still deliberately excluded."
  pattern: "src/lib/agentic-tools-canonical-skills.ts only."
  imports: "No import is added, and none is removed. The file has no import statement today and must keep none. The list stays a literal array of strings: no filesystem read, no release fetch, no derivation from getInstallContent, and no runtime dependency. The project ships with zero runtime dependencies and this task does not change that."
  compatibility: "Keep the exported name `CANONICAL_PRAXIS_SKILL_IDS` and the type `string[]`. Two consumers must keep working with no edit. src/http/routes-integrations.ts imports it at :25 and passes it as the `skillIds` argument of `checkSkillPresence` at :205. electron/agentic-tools-ipc-handlers.cts reads it through a dynamic import at :359-360, assigns it to a `let CANONICAL_PRAXIS_SKILL_IDS!: string[]` declared at :276 (:379), and passes it at :532 — electron/ is leftover scaffolding per CLAUDE.md and must not be edited, so the `string[]` type has to stay assignable to that declaration. checkSkillPresence (src/lib/agentic-tools-skill-presence.ts:33) builds a stub InstallContent from the ids at :47-51 and maps writes[i] back onto skillIds[i] positionally at :59-69, so any order is correct. No test asserts this constant's contents: the presence unit tests at src/test/unit/agentic-tools-skill-presence.test.ts use their own fixture ids (prx-alpha/prx-beta/prx-gamma at :88, prx-orchestrate/prx-git at :148) and stay green untouched. Hexagonal split unchanged: this file carries no transport, no status code and no user-facing string."
  gotcha: "An id here is an on-disk directory name, not a display title. skillDirectoryWrites in src/lib/agentic-tools-format.ts emits `skills/<id>/SKILL.md`, and checkSkillPresence probes exactly that path with path.join at src/lib/agentic-tools-skill-presence.ts:62. `flowcharge` carries no `fc-` prefix and that is correct — do not normalise it to `fc-flowcharge`. Do not add `ak-prx-migrate`; the header comment at :9-12 records why it is excluded. Do not add any `prx-*` id. The strings `fc-orchestrate` and `fc-bug-hunt` also appear in src/test/unit/skill-content-fetch.test.ts (:72, :76, :84, :99-100, :119, :293, :313-316) and in a zip fixture at src/test/unit/zip-read.test.ts (:109, :112). Those name the published release archive's own content and a synthetic archive entry, not this constant. ISS-50-92mh3i records that the published release is itself stale. Leave every one of those lines alone: editing them changes what those tests assert about the release and is out of this task's scope. Do not touch the chip logic in src/public/home.ts (INCOMPLETE_INSTALL_LABEL at :413, the chip branch at :621-638). It is correct given correct input and needs no change. Do not implement the release-derived source designed in PLN-88-tpbc8f: that is a separate, separately tracked hardening step, and ISS-42's notes state it is not required to close this issue. Presence checking runs at global scope only — src/lib/agentic-tools-skill-presence.ts:42 passes the literal 'global' — which is a documented, bounded limit and not part of this task."
  verify:
    - "grep -c \"fc-orchestrate\\|fc-bug-hunt\" src/lib/agentic-tools-canonical-skills.ts — returns 2 at 6e0029b (the entries at :14 and :16). It must return 0."
    - "grep -c \"'flowcharge'\\|'fc-validate'\" src/lib/agentic-tools-canonical-skills.ts — returns 0 at 6e0029b. It must return 2."
    - "npx tsc --noEmit -p tsconfig.json — exits 0 at 6e0029b and must still exit 0. It proves src/http/routes-integrations.ts still type-checks against the unchanged `string[]` export. It cannot fail at base, because it checks a contract this task must not change."
    - |
      npm run build && node --input-type=module -e '
      import assert from "node:assert/strict";
      const { CANONICAL_PRAXIS_SKILL_IDS: ids } = await import(process.cwd() + "/dist/lib/agentic-tools-canonical-skills.js");
      assert.deepEqual([...ids].sort(), ["fc-dev-principles","fc-git","fc-issue-list","fc-plain-text-kanban","fc-plan-feature","fc-task-list","fc-validate","flowcharge"]);
      console.log("PASS " + ids.length);'
      The compiled-list assertion. At 6e0029b it throws an AssertionError and exits 1,
      because the sorted list there is
      ["fc-bug-hunt","fc-dev-principles","fc-git","fc-issue-list","fc-orchestrate","fc-plain-text-kanban","fc-plan-feature","fc-task-list"].
      After this task it must print "PASS 8" and exit 0. It also proves the build
      carried the edit into dist/.
    - |
      node --input-type=module -e '
      const d = process.cwd() + "/dist/lib/";
      const { checkSkillPresence } = await import(d + "agentic-tools-skill-presence.js");
      const { TOOL_CATALOGUE } = await import(d + "agentic-tools-catalogue.js");
      const { CANONICAL_PRAXIS_SKILL_IDS } = await import(d + "agentic-tools-canonical-skills.js");
      const fs = await import("node:fs/promises"); const os = await import("node:os");
      const fsAccess = { pathExists: async (p) => { try { await fs.stat(p); return true; } catch { return false; } } };
      let bad = 0;
      for (const [id, base] of [["claude-code", os.homedir() + "/.claude"], ["opencode", os.homedir() + "/.config/opencode"]]) {
        const r = await checkSkillPresence(TOOL_CATALOGUE.find((t) => t.id === id), base, CANONICAL_PRAXIS_SKILL_IDS, fsAccess);
        console.log(id + ": " + r.status + " missing [" + (r.missingSkillIds || []).join(",") + "]");
        if (r.status !== "fully-installed") bad++;
      }
      console.log(bad ? "FAIL" : "PASS"); process.exit(bad ? 1 : 0);'
      The real-symptom probe: it reproduces the chip the issue reports. It runs after
      the build in the step above. At 6e0029b it prints
      "claude-code: missing-incomplete missing [fc-orchestrate,fc-bug-hunt]" and the same
      line for opencode, then FAIL, and exits 1. After this task both lines must read
      "fully-installed missing []", and it must print PASS and exit 0. Precondition,
      measured at 6e0029b on this machine: all eight current skill directories exist
      under ~/.claude/skills/ and under ~/.config/opencode/skills/. On a machine without
      the suite installed at global scope this probe cannot pass — skip it there and
      record that you skipped it and why.
    - "node --test dist/test/unit/agentic-tools-skill-presence.test.js — 7 of 7 pass at 6e0029b and all 7 must still pass. They use their own fixture ids, so they cannot fail at base. They guard that no presence-check behaviour changed."
    - "git diff --quiet 6e0029b -- src/public src/http src/test electron — exits 0 at 6e0029b and must still exit 0. It checks that nothing changed outside src/lib/, so it cannot fail at base. It is the scope guard: no chip code, no route, no test and no Electron file was edited."
  checklist:
    - "On a machine carrying the full current FlowCharge Core suite at global scope, the presence check reports fully-installed for Claude Code and for OpenCode, so the modal shows no Missing skills chip for either."
    - "The comparison list names exactly the eight skill ids the suite publishes today and names no id it does not publish."
    - "Every consumer of CANONICAL_PRAXIS_SKILL_IDS still compiles against an unchanged string[] export, and no consumer was edited."
    - "The module still has no import, no filesystem read, no release fetch and no runtime dependency."
    - "The release-archive tests and the zip fixture that name fc-orchestrate and fc-bug-hunt are unchanged, and the presence unit tests still pass untouched."
    - "No file other than src/lib/agentic-tools-canonical-skills.ts changed."
  self_eval:
    passed: true
    failures: []
  ```

- [x] 2. Closing test gate: run the full suite with npm test
  ```yaml
  description: "Closing task 1 of 2, required by CLAUDE.md \"Closing a task list\", and traced to no issue. Running the full suite IS this task. Run it on this branch after task 1. Pass only when the suite reports zero failures."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "From the project root, run `npm test`. Running the suite is the work of this task, not a side check. This project's execute-task template otherwise limits verify steps to lint, typecheck and inspection — that default is overridden for this one task, per CLAUDE.md \"Closing a task list\"."
    - "`pretest` runs `npm run build` first, so the suite runs against freshly compiled dist/. Do not substitute a partial, filtered or single-file run."
    - "If the suite reports zero failures, mark this task complete."
    - "If any test fails, fix nothing inside this task. Leave the task unchecked, copy every failing test's name and failure message verbatim into self_eval.failures, and stop. Then follow CLAUDE.md: record every failure in a new issue list in WS-106-1xers0, author spec tasks for those issues, execute them on this same branch, and run this gate again. Repeat until the suite is green. No fix goes in unrecorded. Do not merge while the gate is red."
    - "The suite includes skill-content-fetch, which reaches the release host hardcoded at src/lib/skill-content-fetch.ts:63. That host is a private LAN address, recorded as ISS-50-92mh3i. A failure there because the host is unreachable is environmental. Record it in self_eval.failures with that label, not as a code defect."
  pattern: "The whole repository. This task edits no file."
  imports: "None."
  compatibility: "`npm test` is `node --test --test-force-exit \"dist/**/*.test.js\" \".github/scripts/**/*.test.mjs\"`, and `pretest` is `npm run build`. Tests run compiled output, so a failing path names a dist/ file. Map it back to its src/ original before you report it."
  gotcha: "Do not edit a test or a source file to turn the gate green. Do not re-run only the failing file to hide a flaky failure; record a flaky failure verbatim too. A build failure inside `pretest` is a gate failure — record its compiler output verbatim. This is a gate over the whole branch, not a check on task 1."
  verify:
    - "npm test — the final summary line `ℹ fail` must read 0. This is a whole-branch gate, and by CLAUDE.md it is a gate rather than a change detector, so it is not expected to fail at 6e0029b."
  checklist:
    - "npm test ran in full, with its pretest build, over the whole suite."
    - "The run reported zero failures, or every failure is recorded verbatim in self_eval.failures."
    - "Any skill-content-fetch failure caused by an unreachable release host is labelled environmental."
    - "This task edited no source, test or configuration file."
  self_eval:
    passed: true
    failures: []
  ```

- [x] 3. Closing ARCHITECTURE.md review against this task list's changes
  ```yaml
  description: "Closing task 2 of 2, required by CLAUDE.md \"Closing a task list\", and traced to no issue. Review every section of ARCHITECTURE.md against this branch's real diff, and update what no longer matches the code."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Run `git diff 6e0029b..HEAD` and read it in full. That diff, not this task, is the authority on what changed. This task names no section and forecasts no edit."
    - "Read ARCHITECTURE.md one `## N.` section at a time, never in full — the file is about 2,160 lines. Compare each section against the diff."
    - "Update every statement that no longer matches the code at HEAD. Keep every statement that is still true, verbatim. Make targeted edits. Do not regenerate whole sections and do not rewrite prose that is still correct."
    - "If a section needs no change, change nothing in it. A review that ends with no edit is a valid outcome."
    - "Keep the eleven `## N.` headings in their existing order and numbering, and keep the file's no-metadata-header format."
  pattern: "ARCHITECTURE.md only."
  imports: "None."
  compatibility: "Use the owner's fixed 11-section format with inline Mermaid. Three cross-section rules must hold after the review: every Section 3 component is named in Section 4, every Section 8 Data/Contract type is a Section 5 class, and every Section 8 endpoint is a Section 3 component or a Section 2 external. ARCHITECTURE.md is authored and regenerated by the atd-generate-architecture skill; this task makes targeted corrections within that format, not a regeneration."
  gotcha: "Never write ARCHITECTURE.md as a bare `@` import — link it or wrap it in backticks. Do not describe Electron as a supported target and do not add an Electron check: it is leftover scaffolding per CLAUDE.md. Existing statements that record an Electron divergence are still true if electron/ was not changed — keep them. In a Mermaid class diagram, a bare relation line auto-creates a class, so a diagram can still parse while naming a type that no longer exists; if you delete a class, delete its relation lines too. Do not rename PraxisData, window.praxisAPI, PRAXIS_DATA_DIR, PRAXIS_REPO_REF or CANONICAL_PRAXIS_SKILL_IDS on sight — the praxis namespace survives deliberately."
  verify:
    - "grep -c '^## [0-9][0-9]*\\. ' ARCHITECTURE.md — returns 11 at 6e0029b and must still return 11. Also confirm by reading that line 1 is still not a metadata header. It checks that nothing structural changed, so it cannot fail at base."
    - "grep -c '^```mermaid' ARCHITECTURE.md — returns 21 at 6e0029b. It must still return 21 unless the review deliberately added or removed a whole block; if the count moved, say in self_eval which block and why."
    - |
      Every Mermaid block must still parse. The project ships no Mermaid tooling of its
      own, and adding one as a repository dependency is forbidden, so run the parser
      from a scratch directory outside the repository. A working copy exists at
      /private/tmp/claude-501/-Users-akoukoullis-Work-AK-Praxis-Dashboard/d31d9256-bd20-4e75-ba6e-1c5fda707aef/scratchpad/mermaid,
      which holds parse.mjs beside a local install of mermaid and jsdom; run
      `node parse.mjs /Users/akoukoullis/Work/AK/Praxis-Dashboard/ARCHITECTURE.md` from
      that directory. If that scratch directory is gone, recreate it anywhere outside the
      repository with `npm i mermaid jsdom` and a script that extracts every ```mermaid
      fence and calls `mermaid.parse` on each. At 6e0029b it prints "21 blocks, 0 failing"
      and exits 0. It must still print "N blocks, 0 failing" and exit 0. It cannot fail at
      base; it guards this task's own edits.
    - "Check by reading, with no command: every Section 3 component is named in Section 4, every Section 8 Data/Contract type is a Section 5 class, and every Section 8 endpoint is a Section 3 component or a Section 2 external."
    - "git diff --name-only 6e0029b..HEAD -- ARCHITECTURE.md — at 6e0029b it prints nothing. After this task it prints ARCHITECTURE.md if the review found anything to correct, and nothing if every section was already accurate. Either outcome passes; record which one occurred in self_eval."
  checklist:
    - "Every section of ARCHITECTURE.md was read and compared against git diff 6e0029b..HEAD."
    - "Every statement that no longer matches the code at HEAD was corrected, and every statement still true was left verbatim."
    - "The file still has its eleven `## N.` sections in order, with no metadata header."
    - "Every Mermaid block parses, and the parser reports zero failing blocks."
    - "All three cross-section consistency rules hold."
  self_eval:
    passed: true
    failures: []
    notes: "Reviewed all eleven sections against the branch diff. HEAD still sits at 6e0029b, so `git diff 6e0029b..HEAD` is empty and task 1's change is uncommitted; the review was run against `git diff 6e0029b`, the working tree, which holds exactly the four-line change to src/lib/agentic-tools-canonical-skills.ts (two array entries: fc-orchestrate to flowcharge, fc-bug-hunt to fc-validate). No section names an individual canonical skill id, states the list's length, or describes the list's contents. Sections 3, 4 and 8 reference canonicalSkills only by module name, file path, export name and its two consumers, and every one of those statements is still true at HEAD. ARCHITECTURE.md therefore needed no edit, which the task records as a valid outcome. Verify results: 11 `## N.` sections; line 1 is the `# ARCHITECTURE.md` title, not a metadata header; 21 mermaid fences, unchanged; the scratch parser printed \"21 blocks, 0 failing\" and exited 0; `git diff --name-only 6e0029b -- ARCHITECTURE.md` printed nothing, the no-edit outcome. Cross-section rules checked mechanically: all 67 Section 3 components appear in Section 4, and all 62 Section 8 Data/Contract types are Section 5 classes. Of 71 Section 8 endpoints, only \"Tool config directory\" is not a literal Section 3 component name; it is the Section 2 external codingTools, named by the `participant ToolDir as Tool config directory` alias Section 6 declares at line 1290, so the rule holds. That naming predates this branch and ARCHITECTURE.md is byte-identical to base."
  ```

## Skipped

1. **ISS-32-3hfjhe — the install-removal capability has no interface control.** Out of
   scope for this task list — not part of today's request. No task authored, and no
   direction chosen here.

2. **ISS-38-gv3p2x — two format writers drop every bundled reference file.** Out of
   scope for this task list — not part of today's request.

3. **ISS-46-j993sr — a legacy single-path ledger record leaves a cleanup unable to find
   the rest.** Out of scope for this task list — not part of today's request.

4. **ISS-50-92mh3i — the skill-release fetch is pinned to a temporary local Gitea
   address.** Out of scope for this task list — not part of today's request.

## Divergences

1. **One task, one file, and no diff-mode blocks.** ISS-42-q1t9bh's decided fix touches
   exactly one array literal in one file, so the file holds one substantive task and no
   parent/child split. The edit is mechanical enough to be diff-shaped, but it is pinned
   unambiguously in prose — the anchor is a single named export and the eight
   replacement ids are listed in full — so no SEARCH/REPLACE block was used.

2. **PLN-88-tpbc8f is not implemented here.** The briefing and ISS-42's own `notes`
   both record the release-derived skill-id source as a separate hardening step that
   this issue does not require. The plan's own text says it would not change this chip.
   No task in this file implements it.

3. **The header comment in the target file is left unchanged.** Every statement in
   `src/lib/agentic-tools-canonical-skills.ts:1-12` was checked against the corrected
   array and none of them becomes false, so the task instructs no comment edit and the
   diff stays at four lines.
