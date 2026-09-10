---
id: TL-104-jnhg0w
type: tasklist
workstream: WS-106-1xers0
slug: skill-install-target-resolution-and-lifecycle
title: "Install removal queue and dead install-content type"
status: ready
created: 2026-09-10
updated: 2026-09-10
author: Anthony Koukoullis
depends_on: [IL-18-slf23i]
links: []
mode: spec
base_commit: 7fe1564
---

# FlowCharge Tasks

## Install removal queue and dead install-content type

IL-18-slf23i holds two open, low-severity issues, found by a review of `ARCHITECTURE.md`
after TL-103-9npvav executed. They are independent of each other.

- **ISS-48-zlx88q (task 1).** `removeInstallation` in `src/lib/agentic-tools-install.ts`
  does an unqueued read-modify-write of the install ledger. Only `installToTarget`
  goes through the per-registry-path queue (`registryChains`, `withRegistryLock`). A
  concurrent remove and install on one ledger path each write a next state computed
  from their own stale copy. The fix routes removal through the same queue, so no
  second locking mechanism appears.
- **ISS-49-my5t2k (task 2).** `GetInstallContent` in `src/lib/agentic-tools-content.ts`
  is an exported type that nothing imports. Its comment falsely claims install content
  is placeholder-only. The fix deletes the type and that comment.

Tasks 3 and 4 trace to no issue. `CLAUDE.md` "Closing a task list" requires them on
every task list: a full `npm test` gate, then an `ARCHITECTURE.md` review.

Run the tasks in order. Every count and state quoted in a `verify` step was measured at
`base_commit` 7fe1564. The two `node --input-type=module -e` snippets in task 1 are
self-contained, need only a build, and must run from the project root.

- [x] 1. Serialize removeInstallation through the existing per-registry-path queue (ISS-48-zlx88q)
  ```yaml
  description: "Route removeInstallation's read-modify-write of the install ledger through the withRegistryLock queue that installToTarget already uses, so a concurrent remove and install on one ledger path can no longer resurrect a removed record or drop an installed one."
  author: Anthony Koukoullis
  issues: [ISS-48-zlx88q]
  implement:
    - "In src/lib/agentic-tools-install.ts, at the exported `removeInstallation` (:216-231), run the whole read-modify-write inside the existing `withRegistryLock(registryPath, ...)`. That covers readRegistry at :222, findInstallRecord and its no-record early return, the `recordedInstallPaths` removal loop at :226-228, removeInstallRecord, and writeRegistry at :230. Mirror the `installToTarget` / `installToTargetLocked` split at :97-111: the export becomes a thin wrapper that returns `withRegistryLock(...)`, and the current body moves unchanged into a module-private `removeInstallationLocked`. Why: the ledger read and write must hold one queue slot shared with every install on the same path. Otherwise each operation computes its next ledger from a stale copy."
    - "In the same file, reword the comment block above `const registryChains` (:79-84) and the comment inside `withRegistryLock` (:90-92). They now describe the queue as install-only. Make them say the queue orders installs and removals on one registry path, and that a failed remove rejects only its own caller, like a failed install. Change no code in that region."
    - "Keep the doc comment above `removeInstallation` (:212-215) true. It still describes deleting every recorded path and the idempotent no-op. Add at most one clause saying the operation queues on the registry path."
  pattern: "src/lib/agentic-tools-install.ts only."
  imports: "No new import and no runtime dependency. Everything the change needs is already in the file: the module-private `withRegistryLock` (:87) and `registryChains` (:85), `readRegistry` (:61), `writeRegistry` (:66), `recordedInstallPaths` (:208), and the imported `findInstallRecord` and `removeInstallRecord` (:19-25)."
  compatibility: "Keep the exported name `removeInstallation`, its parameters `(toolId: string, scope: InstallScope, registryPath: string, deps: { fsWrite: FsWriteAccess })`, and its `Promise<void>` return type. Dropping the `async` keyword from the export, as `installToTarget` does, does not change that contract. Callers that must keep working unchanged: src/http/routes-integrations.ts:401, which awaits it inside a try that answers 500 on rejection. The unit tests at src/test/unit/agentic-tools-install.test.ts:323 and :344. electron/agentic-tools-ipc-handlers.cts:370 and :496, which load it through a dynamic import typed by its own local `RemoveInstallationFn`. electron/ is scaffolding and must not be edited, so the signature must stay assignable to that type. The queue key is the registryPath string exactly as passed. Both routes pass `deps.installRegistryPath` (routes-integrations.ts:317 for install, :401 for remove), so one key orders both. Hexagonal split: src/lib/ stays transport-free, with no status code and no user-facing string."
  gotcha: "Deadlock: code that already runs inside a withRegistryLock callback must never call the public `installToTarget` or `removeInstallation` on the same path. The inner call queues behind the outer one and never runs. That is why installToTargetLocked's update cleanup at :145-149 calls `deps.fsWrite.remove` directly. Do not DRY that loop into a removeInstallation call. The no-record early return must stay inside the locked body, after the locked read. A check before queuing brings the stale read back. Rejection isolation already exists: `registryChains.set(registryPath, next.catch(() => undefined))` at :93 keeps a failed operation from failing the work queued behind it. Do not add a catch that swallows the caller's own rejection, because the route depends on it to answer 500. The route's validation read at routes-integrations.ts:359-361 stays outside the queue by design. It runs first and answers 400 before removeInstallation is called. Moving that check into the lock would put a status code into src/lib/ or change the ordering, and both are out of bounds. The short window between the route's validation read and the queued remove is not part of ISS-48. Leave it alone. No test covers the 400 remove refusal: server.test.ts has only the untracked-toolId case at :117. That ordering guarantee therefore rests on routes-integrations.ts staying unchanged, which the last verify step checks. Leave installToTarget's doc comment at :70-78 and the file header at :1-7 as they are."
  verify:
    - "npx tsc --noEmit -p tsconfig.json — passes at 7fe1564 and must still pass. It proves every src/ caller still type-checks against the unchanged signature. It cannot fail at base."
    - "grep -n withRegistryLock src/lib/agentic-tools-install.ts — prints two lines at 7fe1564: the declaration at :87 and the installToTarget call at :103. After this task it must print at least one more line. Read it to confirm it is the call that wraps removeInstallation's body."
    - "grep -c 'new Map<string, Promise<unknown>>' src/lib/agentic-tools-install.ts — returns 1 at 7fe1564 and must still return 1. This is the DRY guard: no second queue map appears. It checks that nothing changed, so it cannot fail at base. Also read the diff and confirm that no other mutex, lock helper or queue was added."
    - |
      npm run build && node --input-type=module -e '
      const d = process.cwd() + "/dist/lib/";
      const { installToTarget, removeInstallation } = await import(d + "agentic-tools-install.js");
      const { TOOL_CATALOGUE } = await import(d + "agentic-tools-catalogue.js");
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const mk = (f) => ({ readTextFile: async (p) => { await sleep(5); return f.has(p) ? f.get(p) : null; }, writeTextFileAtomic: async (p, c) => { await sleep(5); f.set(p, c); }, readBinaryFile: async () => null, writeBinaryFileAtomic: async () => {}, mkdir: async () => {}, remove: async (p) => { for (const k of [...f.keys()]) if (k === p || k.startsWith(p + "/")) f.delete(k); }, expandTokens: async (p) => p });
      const cc = TOOL_CATALOGUE.find((t) => t.id === "claude-code"), oc = TOOL_CATALOGUE.find((t) => t.id === "opencode");
      const C = { version: "1", skills: [{ id: "fc-a", name: "a", description: "", body: "x" }] }, R = "/mem/reg.json", G = { kind: "global" };
      let bad = 0;
      for (const first of ["remove", "install"]) {
        const f = new Map(), fsWrite = mk(f);
        await installToTarget({ tool: cc, basePath: "/mem/.claude", scope: G }, C, R, { fsWrite });
        const rm = () => removeInstallation("claude-code", G, R, { fsWrite });
        const inst = () => installToTarget({ tool: oc, basePath: "/mem/.config/opencode", scope: G }, C, R, { fsWrite });
        await Promise.all(first === "remove" ? [rm(), inst()] : [inst(), rm()]);
        const ledger = JSON.parse(f.get(R)).map((r) => r.toolId).sort().join(",");
        const ccFiles = [...f.keys()].filter((k) => k.startsWith("/mem/.claude/")).length;
        console.log(first + " first: ledger [" + ledger + "] claude-code files " + ccFiles);
        if (ledger !== "opencode" || ccFiles !== 0) bad++;
      }
      console.log(bad ? "FAIL" : "PASS"); process.exit(bad ? 1 : 0);'
      The race probe. It runs fully in memory, with nothing on disk. At 7fe1564 it prints
      "remove first: ledger [claude-code,opencode] claude-code files 0" and
      "install first: ledger [claude-code,opencode] claude-code files 0", then FAIL, and exits 1.
      After this task it must print "ledger [opencode] claude-code files 0" for both
      orders, then PASS, and exit 0.
    - |
      node --input-type=module -e '
      const d = process.cwd() + "/dist/lib/";
      const { installToTarget, removeInstallation } = await import(d + "agentic-tools-install.js");
      const { TOOL_CATALOGUE } = await import(d + "agentic-tools-catalogue.js");
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      let failRemove = false;
      const f = new Map();
      const fsWrite = { readTextFile: async (p) => { await sleep(5); return f.has(p) ? f.get(p) : null; }, writeTextFileAtomic: async (p, c) => { await sleep(5); f.set(p, c); }, readBinaryFile: async () => null, writeBinaryFileAtomic: async () => {}, mkdir: async () => {}, remove: async (p) => { if (failRemove) throw new Error("boom"); f.delete(p); }, expandTokens: async (p) => p };
      const cc = TOOL_CATALOGUE.find((t) => t.id === "claude-code"), oc = TOOL_CATALOGUE.find((t) => t.id === "opencode");
      const C = { version: "1", skills: [{ id: "fc-a", name: "a", description: "", body: "x" }] }, R = "/mem/reg.json", G = { kind: "global" };
      await installToTarget({ tool: cc, basePath: "/mem/.claude", scope: G }, C, R, { fsWrite });
      failRemove = true;
      const [rm, inst] = await Promise.allSettled([removeInstallation("claude-code", G, R, { fsWrite }), installToTarget({ tool: oc, basePath: "/mem/.config/opencode", scope: G }, C, R, { fsWrite })]);
      const ledger = JSON.parse(f.get(R)).map((r) => r.toolId).sort().join(",");
      console.log("remove " + rm.status + ", install " + inst.status + " " + (inst.value && inst.value.status) + ", ledger [" + ledger + "]");
      const ok = rm.status === "rejected" && inst.status === "fulfilled" && inst.value.status === "installed" && ledger.includes("opencode");
      console.log(ok ? "PASS" : "FAIL"); process.exit(ok ? 0 : 1);'
      The rejection-isolation probe. It runs after the build in the step above. A remove
      whose first delete throws is queued ahead of an install on the same ledger. At
      7fe1564 it prints "remove rejected, install fulfilled installed, ledger
      [claude-code,opencode]", then PASS, and exits 0. It cannot fail at base, because
      removal is not queued there at all. It guards that queuing removal does not let a
      rejected remove block the install behind it. The remove must still reject its own
      caller. After this task it must still print PASS and exit 0.
    - "node --test dist/test/unit/agentic-tools-install.test.js — 10 of 10 pass at 7fe1564, and all 10 must still pass. That includes the every-path removal case at src/test/unit/agentic-tools-install.test.ts:316 and the idempotent no-op case at :341. It cannot fail at base. It guards the removal behaviour that must not change."
    - "node --test --test-force-exit dist/test/unit/server.test.js — 10 of 10 pass at 7fe1564, and all 10 must still pass. That includes the remove-route case at src/test/unit/server.test.ts:117."
    - "git diff --quiet 7fe1564 -- src/http/routes-integrations.ts electron — exits 0 at 7fe1564 and must still exit 0. The route's 400 check still runs before removeInstallation, and electron/ is untouched. It checks that nothing changed, so it cannot fail at base."
  checklist:
    - "A concurrent removeInstallation and installToTarget on one registry path leave the ledger holding only the surviving install, in both start orders."
    - "removeInstallation keeps its exported name, parameters and Promise<void> return type, and it resolves as a no-op with no fsWrite.remove call when no record exists."
    - "removeInstallation still deletes every path recordedInstallPaths returns before it drops the record."
    - "A rejected removeInstallation rejects its own caller and does not block an install queued behind it on the same registry path."
    - "The file holds one queue mechanism only, registryChains with withRegistryLock, and no second map, mutex or lock helper."
    - "src/http/routes-integrations.ts and electron/ are unchanged, and no status code or user-facing string entered src/lib/."
  self_eval:
    passed: true
    failures: []
  ```

- [ ] 2. Delete the unused GetInstallContent type and its false comment (ISS-49-my5t2k)
  ```yaml
  description: "Delete the exported GetInstallContent type alias, which nothing imports, together with the comment above it that falsely calls install content placeholder-only."
  author: Anthony Koukoullis
  issues: [ISS-49-my5t2k]
  implement:
    - "In src/lib/agentic-tools-content.ts, delete `export type GetInstallContent = (toolId: string) => Promise<InstallContent>;` (:27) and the three-line comment above it, which begins `// The Gap 1 seam` (:24-26). Leave exactly one blank line between the closing brace of `InstallContent` (:22) and the comment above `canonicalSkill` (:29). Why: nothing has imported the type since installAllGlobal was deleted. The comment's placeholder claim is also false: `getInstallContent` in src/lib/skill-content-fetch.ts (:267) is the real implementation, and the HTTP install route calls it at src/http/routes-integrations.ts:305."
  pattern: "src/lib/agentic-tools-content.ts only."
  imports: "Nothing is added or removed. The type is the only thing deleted. `InstallContent`, which it referenced, is declared in this same file and is still used. The `node:crypto` import still serves hashInstallContent. `grep -rnw GetInstallContent src` finds only the definition, so no importer needs editing."
  compatibility: "This is a type-only export, so its removal changes no emitted runtime code. electron/agentic-tools-ipc-handlers.cts declares its own local `GetInstallContentFn` type and does not import this one, so the electron tsc run inside `npm run build` is unaffected. electron/ must not be edited. ARCHITECTURE.md section 5 still lists the type at :857 and :956. Task 4 updates that, not this task."
  gotcha: "The file header at :4-6 makes a similar placeholder claim. ISS-49 does not cite it, so leave it byte for byte. A plain `grep -rn GetInstallContent src electron` also matches electron's `GetInstallContentFn`, 3 hits at 7fe1564. Use `-w`, or search src/ only, when you check for leftovers. Do not touch `getInstallContent` in src/lib/skill-content-fetch.ts or its call in routes-integrations.ts. Do not add a replacement comment that restates the removed claim."
  verify:
    - "grep -rnw GetInstallContent src | wc -l — returns 1 at 7fe1564, the definition at src/lib/agentic-tools-content.ts:27. Must return 0."
    - "grep -c 'Gap 1 seam' src/lib/agentic-tools-content.ts — returns 1 at 7fe1564. Must return 0."
    - "grep -c 'fixture/placeholder implementations throughout this workstream' src/lib/agentic-tools-content.ts — returns 1 at 7fe1564 and must still return 1. This proves the header comment that ISS-49 does not cite is untouched. It checks that nothing changed, so it cannot fail at base."
    - "npm run build — exits 0 at 7fe1564 and must still exit 0. Its three tsc runs cover the Node, browser and electron configs, which proves no file depended on the type."
    - "git diff --quiet 7fe1564 -- electron src/lib/skill-content-fetch.ts — exits 0 at 7fe1564 and must still exit 0. It checks that nothing changed, so it cannot fail at base."
  checklist:
    - "No file in src/ or electron/ names the GetInstallContent type after the change, and every tsc run in npm run build passes."
    - "The false placeholder comment above the type is gone, and no new comment repeats the claim."
    - "The header comment at the top of src/lib/agentic-tools-content.ts is unchanged."
    - "SkillContent, InstallContent and hashInstallContent are unchanged, so content hashes are unaffected."
    - "electron/ and src/lib/skill-content-fetch.ts are unchanged."
  self_eval:
    passed: false
    failures: []
  ```

- [ ] 3. Closing test gate: run the full suite with npm test
  ```yaml
  description: "Closing task 1 of 2, required by CLAUDE.md \"Closing a task list\", and traced to no issue. Run the full test suite on this branch after tasks 1 and 2. Pass only when the suite reports zero failures."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "From the project root, run `npm test`. Its `pretest` script runs `npm run build` first, so the suite runs against freshly compiled dist/. Do not substitute a partial or filtered run."
    - "If the suite reports zero failures, mark this task complete."
    - "If any test fails, fix nothing inside this task. Leave the task unchecked, copy every failing test's name and failure message verbatim into self_eval.failures, and stop. The orchestrator then follows CLAUDE.md: it files a new issue list in WS-106-1xers0, authors spec tasks for it, executes them on this branch, and re-runs this gate."
    - "The suite includes skill-content-fetch, which reaches the project's self-hosted release host. A failure there because the host is unreachable is environmental. Record it in self_eval.failures with that label, not as a code defect."
  pattern: "The whole repository. This task edits no file."
  imports: "None."
  compatibility: "`npm test` is `node --test --test-force-exit \"dist/**/*.test.js\" \".github/scripts/**/*.test.mjs\"`, and `pretest` runs `npm run build` first. Tests run compiled output under dist/, so a failing path names a dist/ file. Map it back to src/ before you report it."
  gotcha: "Do not edit a test or source file to turn the gate green. Do not re-run only the failing file to hide a flaky failure. Record a flaky failure verbatim too. A build failure in `pretest` is a gate failure. Record its compiler output verbatim."
  verify:
    - "npm test — the final summary line `ℹ fail` must read 0. Per the brief, every offline suite passes at 7fe1564. This is a gate over the whole branch, not a check on one change, so it is not expected to fail at base."
  checklist:
    - "npm test ran with its pretest build, over the whole suite."
    - "The run reported zero failures, or every failure is recorded verbatim in self_eval.failures."
    - "Any skill-content-fetch failure caused by an unreachable release host is labelled environmental."
    - "This task edited no source, test or config file."
  self_eval:
    passed: false
    failures: []
  ```

- [ ] 4. Closing ARCHITECTURE.md review against this task list's changes
  ```yaml
  description: "Closing task 2 of 2, required by CLAUDE.md \"Closing a task list\", and traced to no issue. Review ARCHITECTURE.md against what this task list changed in src/, and update every section that no longer matches the code."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Run `git diff 7fe1564..HEAD -- src` to see exactly what tasks 1 and 2 changed. Expect at least these two changes: removeInstallation now queues through withRegistryLock in src/lib/agentic-tools-install.ts, and GetInstallContent is gone from src/lib/agentic-tools-content.ts."
    - "Read ARCHITECTURE.md one `## N.` section at a time, never in full, and compare each against that diff. Update every statement that no longer matches the code. Keep every statement that is still true verbatim. Make targeted edits, and do not regenerate whole sections."
    - "Section 5: expect to remove the `class GetInstallContent` entry (:857) and its `GetInstallContent --> InstallContent` relation (:956) from the class diagram. Then confirm that no other section names the type."
    - "Sections 6 to 8, 10 and 11: check every install and remove description against the queue, which now covers removal. The only queue statement at 7fe1564 is the section 6 install-sequence step at :1336, which describes installs only. Also check the removal transitions in section 7 (:1583-1588), the remove rows in section 8 (:1717, :1756), the idempotent-remove row in section 10 (:1904), and the remove-path constraint in section 11 (:2023-2027). Record that removals share the per-registry-path queue with installs, and that the route's permitted-root check still runs and answers 400 before the queued remove."
    - "Keep the eleven `## N.` headings in their order and numbering, and keep the file's no-metadata-header format."
  pattern: "ARCHITECTURE.md only."
  imports: "None."
  compatibility: "Use the owner's fixed 11-section format with inline Mermaid. Keep three cross-section rules: every Section 3 component is named in Section 4, every Section 8 Data/Contract type is a Section 5 class, and every Section 8 endpoint is a Section 3 component or a Section 2 external. The Mermaid validator is installed at /private/tmp/claude-501/-Users-akoukoullis-Work-AK-Praxis-Dashboard/d31d9256-bd20-4e75-ba6e-1c5fda707aef/scratchpad/mermaid, and it runs from that directory."
  gotcha: "When you delete the GetInstallContent class, delete its relation line too. Mermaid auto-creates a class from a bare relation, so the file still parses while it names a type that no longer exists. Keep the section 8 electronToolsIpc row at :1756 that records the Electron remove-channel divergence. It is still true, because electron/ was not changed. Do not describe Electron as a supported target, and do not add an Electron check. The C4 relations at :210 and :247 name removeInstallation and are still true, so keep them. Never add a bare `@` import of the file."
  verify:
    - "grep -c GetInstallContent ARCHITECTURE.md — returns 2 at 7fe1564: `class GetInstallContent` at :857 and `GetInstallContent --> InstallContent` at :956. Must return 0."
    - "grep -ni queue ARCHITECTURE.md — returns one line at 7fe1564, :1336 in section 6, and it describes the queue as install-only. After this task, the queue's description must cover removal. Either that line names removals too, or a removal statement in section 7, 10 or 11 names the queue. Fail the step if every queue line still reads install-only."
    - "grep -c '^## [0-9][0-9]*\\. ' ARCHITECTURE.md — returns 11 at 7fe1564 and must still return 11. Also confirm that line 1 is still not a metadata header. It checks that nothing changed, so it cannot fail at base."
    - "cd /private/tmp/claude-501/-Users-akoukoullis-Work-AK-Praxis-Dashboard/d31d9256-bd20-4e75-ba6e-1c5fda707aef/scratchpad/mermaid && node parse.mjs /Users/akoukoullis/Work/AK/Praxis-Dashboard/ARCHITECTURE.md — prints '21 blocks, 0 failing' at 7fe1564. It must print 'N blocks, 0 failing', where N stays 21 unless the review added or removed a whole block. It cannot fail at base. It guards this task's edits."
    - "Check by reading, with no command: every Section 3 component is named in Section 4, every Section 8 Data/Contract type is a Section 5 class, and every Section 8 endpoint is a Section 3 component or a Section 2 external."
  checklist:
    - "Every ARCHITECTURE.md statement about removeInstallation, the registry queue and install content matches the code at HEAD."
    - "The GetInstallContent class and its relation are gone from section 5, and no other section names the type."
    - "Statements still true at HEAD are preserved verbatim, including the recorded Electron remove-channel divergence."
    - "The file still has its eleven `## N.` sections in order, and no metadata header."
    - "The validator prints 'N blocks, 0 failing' for ARCHITECTURE.md."
    - "All three cross-section consistency rules hold."
  self_eval:
    passed: false
    failures: []
  ```
