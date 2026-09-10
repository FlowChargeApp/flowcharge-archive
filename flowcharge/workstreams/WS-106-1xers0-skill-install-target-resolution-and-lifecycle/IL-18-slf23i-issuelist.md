---
id: IL-18-slf23i
type: issuelist
workstream: WS-106-1xers0
slug: skill-install-target-resolution-and-lifecycle
title: "Install removal concurrency and dead install-content type"
status: ready
created: 2026-09-10
updated: 2026-09-10
depends_on: []
links: [IL-16-78bnrq, ISS-41-qbdzgt, ISS-32-3hfjhe]
---

# FlowCharge Issue List

- [ ] ISS-48-zlx88q. removeInstallation bypasses the per-registry install queue, so a concurrent remove and install resurrect the removed record

  ```yaml
  id: ISS-48-zlx88q
  status: ready
  severity: low
  author: Anthony Koukoullis
  description: "src/lib/agentic-tools-install.ts serializes registry access per ledger path through `registryChains` and `withRegistryLock` at :85-95. Only installToTarget uses that queue, at :103, where it wraps installToTargetLocked. removeInstallation at :216-231 performs its own unqueued read-modify-write of the same ledger: readRegistry at :222, a loop that removes every recorded path, then writeRegistry at :230. Its production caller is the POST /api/integrations/installs/remove route, which calls it at src/http/routes-integrations.ts:401. A remove and an install that overlap on the same ledger path therefore each read the ledger, each compute a next state from their own copy, and each write it, with nothing ordering the two."
  steps_to_reproduce:
    - "Build the app at f66a86d, so the compiled modules exist in dist/lib/."
    - "Back an FsWriteAccess with an in-memory Map and add a 5 ms delay to each registry read and write, so the two operations interleave."
    - "Seed the ledger with a global Claude Code install record and its files."
    - "Run `removeInstallation('claude-code', global)` and an installToTarget of OpenCode at global scope concurrently against the same ledger path."
    - "Read the ledger and count each tool's files."
    - "Repeat with the install started first."
  expected: "The ledger holds [opencode] only. Claude Code has 0 files. OpenCode has 1 file."
  actual: "Measured with the compiled dist/lib/ at f66a86d, in both start orders. Remove first: ledger [claude-code, opencode], Claude Code files 0, OpenCode files 1. Install first: the same result. The install reads the ledger while the Claude Code record is still present. The remove deletes Claude Code's files and writes the ledger without that record. The install then writes its next state from its own stale copy, which still holds the Claude Code record. The ledger claims Claude Code is installed while its files are gone. A later install of the same release into Claude Code finds that resurrected record with a matching contentHash, takes the up-to-date branch, makes zero content writes, and returns `up-to-date`. The skills are never restored, and the integrations modal reports the tool as up to date. The same race can equally lose the install's own record, when the remove's write lands last from a copy that predates the install."
  affected: "src/lib/agentic-tools-install.ts:85-95 (registryChains, withRegistryLock), :103 (installToTarget, the only queued caller), :216-231 (removeInstallation: readRegistry at :222, writeRegistry at :230); src/http/routes-integrations.ts:401 (the POST /api/integrations/installs/remove call)"
  environment: "Any server process that serves a remove request and an install request on the same ledger path at the same time. Measured in-process against a fake FsWriteAccess backed by a Map; nothing touched disk."
  tasks: []
  notes: "Confidence is high: the race was measured in both start orders against the compiled code, not inferred. This is not a regression and is not ISS-41-qbdzgt reopened. ISS-41-qbdzgt serialized the installToTarget read-modify-write only, because that issue named installToTarget alone, and its task deliberately left removeInstallation unserialized. This issue is the gap that scoping left. Live exposure today is narrow: no interface control calls removeInstallation (ISS-32-3hfjhe), so the race is reachable only by a direct loopback POST to the remove route that overlaps an install. Severity is low today because the UI cannot reach it. It rises to medium once ISS-32-3hfjhe gets a remove control, because the race then becomes an ordinary user action. This issue names no fix. File for the src/ impact only; electron/ is leftover scaffolding per CLAUDE.md. Any correction must add no runtime dependency."
  ```

- [ ] ISS-49-my5t2k. GetInstallContent is an exported type that nothing imports, and its comment makes a false claim

  ```yaml
  id: ISS-49-my5t2k
  status: ready
  severity: low
  author: Anthony Koukoullis
  description: "src/lib/agentic-tools-content.ts:24-27 exports `export type GetInstallContent = (toolId: string) => Promise<InstallContent>;` under a comment that calls it the Gap 1 seam, which stays a port with only fixture or placeholder implementations everywhere in this workstream, including the real IPC wiring in Phase 6 (plan Assumption 9). `grep -rn GetInstallContent src electron` finds only that definition in src/. Its only consumer, installAllGlobal, was deleted by TL-103-9npvav task 3 under ISS-43-xszeei. electron/agentic-tools-ipc-handlers.cts:197 declares its own local `GetInstallContentFn` type and does not import this one. The comment is false: install content is not placeholder-only. getInstallContent in src/lib/skill-content-fetch.ts is the real implementation, and the HTTP install route calls it."
  steps_to_reproduce:
    - "Run `grep -rn GetInstallContent src electron` and read every hit."
    - "Confirm that the only hit in src/ is the definition at src/lib/agentic-tools-content.ts:27."
    - "Read the comment at src/lib/agentic-tools-content.ts:24-26."
    - "Read getInstallContent in src/lib/skill-content-fetch.ts and its call from the HTTP install route in src/http/routes-integrations.ts."
  expected: "GetInstallContent is not exported without a consumer, and its comment describes the real content path."
  actual: "The type is dead exported code that nothing imports. Its comment tells a reader that install content is still a placeholder, which misdescribes the real content path. ARCHITECTURE.md section 5 still lists the type, because the type exists."
  affected: "src/lib/agentic-tools-content.ts:24-27 (GetInstallContent and its comment); src/lib/skill-content-fetch.ts (getInstallContent, the real implementation); ARCHITECTURE.md section 5 (the GetInstallContent class entry)"
  environment: ""
  tasks: []
  notes: "No runtime failure. Confidence is high. The dead type dates from the deletion of installAllGlobal under ISS-43-xszeei. This issue names no fix. File for the src/ impact only: the electron/ GetInstallContentFn type is leftover scaffolding per CLAUDE.md and is not in scope. Any correction must add no runtime dependency."
  ```
