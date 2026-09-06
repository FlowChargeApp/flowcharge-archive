---
id: IL-12-r4zsp2
type: issuelist
workstream: WS-81-qkgk3t
slug: integrations-release-install-version-detection
title: "Manage Integrations install failures from stale FlowCharge Core git ref"
status: done
created: 2026-08-30
updated: 2026-08-30
depends_on: []
links: []
---

# PRX Issue List

- [x] ISS-23-22bcfg. Stale `master` git ref makes every Manage Integrations install fail with 404

  ```yaml
  id: ISS-23-22bcfg
  status: done
  severity: critical
  author: Anthony Koukoullis
  description: "PRAXIS_REPO_REF is the literal 'master' at src/lib/skill-content-fetch.ts:38-39. getInstallContent reads it at line 224 and buildArchiveUrl (lines 50-52) builds ${PRAXIS_REPO_BASE_URL}/archive/${PRAXIS_REPO_REF}.tar.gz. The sibling FlowCharge Core repository renamed its default branch from master to main on 2026-08-25, confirmed by that repo's reflog entry '5d5f5af main@{2026-08-25 17:29:30 +1000}: Branch: renamed refs/heads/master to refs/heads/main' and by git ls-remote --heads on its origin, which now lists only refs/heads/main. The constant was never updated, so the archive URL points at a ref that no longer exists and every install request 404s."
  steps_to_reproduce:
    - "Open the Manage Integrations dialog in the app."
    - "Select any catalogue tool, for example claude-code, in either the Global or the Project scope."
    - "Click 'Install selected'."
    - "Observe the alert dialog that appears."
  expected: "The archive downloads from the FlowCharge Core repository and the selected tools install into the chosen scope."
  actual: "A window.alert appears reading exactly: Couldn't install the selected tools. Detail: Failed to fetch FlowCharge Core skill archive: 404 Not Found. Nothing is installed. A live probe of GET http://100.87.185.97:8110/akoukoullis/Praxis/archive/master.tar.gz returns HTTP 404 Not Found with the 42-byte text/plain body 'unrecognized repository reference: master', while GET .../archive/main.tar.gz returns HTTP 200 with 160385 bytes."
  affected: "src/lib/skill-content-fetch.ts (PRAXIS_REPO_REF at lines 38-39, buildArchiveUrl at lines 50-52, getInstallContent at line 224); src/renderer/home.ts (installIntegrationsSelected at lines 651-676, alert at lines 687-689); src/preload.cts line 28; src/main/agentic-tools-ipc-handlers.cts lines 361-408 with the catch at 405-407; src/renderer/ipc-adapter.ts unwrapIpc at lines 23-28; src/renderer/browser-ipc-shim.ts lines 44-48 and 93-95; src/server.ts lines 514-577 with the catch at 574-575 and lines 805-812."
  environment: "Both transports are affected because both call the same getInstallContent: the Electron IPC build and the loopback HTTP/browser server build. Gitea host 100.87.185.97:8110."
  tasks: [TL-84-c4ja15.1.1]
  notes: "Reproduction rate is 100 percent, not intermittent. Blast radius is all four catalogue tools (claude-code, cursor, windsurf, opencode), both scopes and both transports. A multi-tool selection fails as a single batch because the first target's throw aborts the whole loop, so no row gets a result. There is no filesystem side effect: the fetch fails before any write, so there is no partial install and no registry corruption. Detection and 'Re-scan', checkInstalledSkills (which only calls fsAccess.pathExists and never calls getInstallContent), getInstallStatus and removeInstallation are all unaffected. There is no user-facing workaround, because the ref is a compiled-in constant with no setting or environment override, so a code change and a rebuild are required."
  ```

- [x] ISS-24-4rf1rr. Test EXPECTED_IDS asserts stale `prx-*` skill ids that no longer exist upstream

  ```yaml
  id: ISS-24-4rf1rr
  status: done
  severity: low
  author: Anthony Koukoullis
  description: "The EXPECTED_IDS constant at src/lib/skill-content-fetch.test.ts:100-109 asserts that the fetched archive contains a hardcoded list of prx-* skill ids. The real upstream content at the main ref contains a different set, confirmed by direct inspection of the fetched main.tar.gz: fc-bug-hunt, fc-dev-principles, fc-git, fc-issue-list, fc-orchestrate, fc-plain-text-kanban, fc-plan-feature and fc-task-list. The assertion list is therefore wrong independently of the ref defect in ISS-23-22bcfg, and the test will still fail after that ref is corrected."
  steps_to_reproduce:
    - "Build the project so dist/lib/skill-content-fetch.test.js exists."
    - "Run node --test dist/lib/skill-content-fetch.test.js."
    - "Observe the failing case."
  expected: "The live integration test compares the fetched archive against the skill ids the repository actually ships, and passes."
  actual: "The run gives 3 pass and 1 fail. Today the failing case's error is the 404 from the stale ref. Once that ref is corrected, the same case still fails, because EXPECTED_IDS lists prx-* ids that upstream no longer contains."
  affected: "src/lib/skill-content-fetch.test.ts lines 100-109 (the EXPECTED_IDS constant) and the live-network test case that consumes it."
  environment: "Node built-in test runner against the compiled dist output, with live network access to the Gitea host."
  tasks: [TL-83-qg4zjp.1.13]
  notes: "This is a test-suite defect, not a production defect, and it changes no user-facing behaviour on its own. It does mean the suite cannot verify the fetch-and-parse pipeline against real upstream content, either now or after ISS-23-22bcfg lands, which is exactly the safety net that fix needs. Reassigned on 2026-08-30 from TL-84-c4ja15 task 1.2 to TL-83-qg4zjp task 1.13. Task 1.2 was dropped, because task 1.13 rewrites the same tier (c) block for the release-based install design in PLN-72-ph4oel and its scope already replaces the stale prx-* ids. Nothing has executed yet, so the status stays in-progress."
  ```
