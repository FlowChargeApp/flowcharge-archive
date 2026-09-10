---
id: IL-15-mza9eb
type: issuelist
workstream: WS-105-neddbs
slug: architecture-audit-source-defects
title: "Source defects found while auditing ARCHITECTURE.md"
status: ready
created: 2026-09-10
updated: 2026-09-10
depends_on: []
links: []
---

# FlowCharge Issue List

- [ ] ISS-28-uphhhu. Two state files written to the repository root are not gitignored

  ```yaml
  id: ISS-28-uphhhu
  status: ready
  severity: medium
  author: Anthony Koukoullis
  description: "The app writes four state files into the directory that PRAXIS_DATA_DIR resolves to. .gitignore lines 5-6 list only .praxis-projects.json and .praxis-update.json. The other two, .praxis-installs.json and .praxis-telemetry.json, are left trackable. The two entries that are present show the intent. The two files reach the repository root by different routes. .praxis-installs.json is written by writeRegistry in src/lib/agentic-tools-install.ts (called from installToTarget and removeInstallation) at the path src/server.ts:57-60 computes, which is the repository root whenever PRAXIS_DATA_DIR is unset, so every unpackaged install writes it there. .praxis-telemetry.json is written by readOrCreateInstallId in src/lib/telemetry-install-id.ts, whose only caller is trackAppStarted in the generated CLI entry (tools/package-cli.mjs:149-155). An unpackaged run never calls it, and the packaged binary defaults PRAXIS_DATA_DIR to ~/.flowcharge (src/cli-bootstrap.ts:20), so that file lands at the repository root only when a developer runs the packaged binary with PRAXIS_DATA_DIR pointed at the checkout. Listing it is still the consistent choice: it is a state file of the same family and the same directory seam."
  steps_to_reproduce:
    - "Leave PRAXIS_DATA_DIR unset, so the data directory resolves to the repository root."
    - "Run `npm start` from a clean working tree."
    - "Open the integrations modal and install the skill suite into any detected tool."
    - "Run `git status` at the repository root."
  expected: "No state file appears as untracked repository content, exactly as happens for .praxis-projects.json and .praxis-update.json."
  actual: "`.praxis-installs.json` appears as an untracked file. Each InstallRecord in it carries resolvedPath, an absolute filesystem path into the developer's own tool config directory. A `git add -A` commits it. `.praxis-telemetry.json` does not appear after these steps, because no unpackaged run writes it (see the description), but when it is written to the checkout it carries the random telemetry install ID and is equally trackable."
  affected: ".gitignore lines 5-6; src/lib/agentic-tools-install.ts (writeRegistry, via installToTarget and removeInstallation); src/server.ts:57-60 (the registry path); src/lib/telemetry-install-id.ts (readOrCreateInstallId); tools/package-cli.mjs:149-155 (the only trackAppStarted call site)"
  environment: "For .praxis-installs.json: any unpackaged run — npm start, or a developer session — where PRAXIS_DATA_DIR is unset. For .praxis-telemetry.json: only a packaged-binary run with PRAXIS_DATA_DIR set to the checkout. The packaged binary with defaults is unaffected because it resolves the directory to ~/.flowcharge."
  tasks: []
  notes: "ARCHITECTURE.md lines 477-479 name all four files and record that only the first and third are listed in .gitignore. Its statement that all four live in the repository root during development overstates the telemetry file, for the reason in the description; that is a documentation matter outside this issue."
  ```

- [ ] ISS-29-m7w4dm. Two outbound release-host fetches carry no timeout and can hang a request indefinitely

  ```yaml
  id: ISS-29-m7w4dm
  status: ready
  severity: high
  author: Anthony Koukoullis
  description: "The fetch call in fetchReleases at src/lib/skill-release-fetch.ts:143 and the asset download inside getInstallContent at src/lib/skill-content-fetch.ts:289 pass no `signal`. Every other outbound call in the codebase passes one: src/lib/telemetry.ts:131 and src/lib/update-check.ts:138 both use `signal: AbortSignal.timeout(timeoutMs)`. The comment at src/lib/skill-release-fetch.ts:137-140 even discusses an AbortSignal-style rejection arriving as a DOMException, so the module anticipates a timeout that it never sets."
  steps_to_reproduce:
    - "Make the release host at PRAXIS_REPO_BASE_URL (src/lib/skill-content-fetch.ts:63) accept the TCP connection but never send a response — a suspended host, a black-holed route, or a hung reverse proxy."
    - "Open the integrations modal in the app."
    - "Select a detected tool and start an install, which sends POST /api/integrations/installs."
    - "Wait. Repeat with the modal's initial load, which sends GET /api/integrations/releases."
  expected: "Each fetch aborts after a bounded time and the HTTP request completes. For POST /api/integrations/installs the abort rejects getInstallContent, whose unconditional catch re-throws, so src/http/routes-integrations.ts:324 answers 500 with the timeout message and the modal shows a failure. For GET /api/integrations/releases the abort lands in fetchReleases' unconditional catch, which resolves [] as it does for every other unhappy path, so the route answers 200 with an empty list and the modal shows its no-release state instead of hanging."
  actual: "Neither fetch ever settles. The HTTP request hangs with no response and no error. The modal stays stuck with no failure message and no way to tell whether the install is progressing."
  affected: "src/lib/skill-release-fetch.ts:143 (fetchReleases); src/lib/skill-content-fetch.ts:289 (getInstallContent); reached from POST /api/integrations/installs and GET /api/integrations/releases"
  environment: "Node >=20.14. Both routes are reachable from the UI on a normal install attempt."
  tasks: []
  notes: "`AbortSignal.timeout` is a Node built-in and is already used in two modules, so no runtime dependency is needed. The project has no runtime dependency and must keep none. ARCHITECTURE.md lines 1782-1783 and 1873 already record both calls as carrying no abort timeout."
  ```

- [ ] ISS-30-a05gs5. A src/lib module logs to the console, so one failure produces two differently-worded reports

  ```yaml
  id: ISS-30-a05gs5
  status: ready
  severity: low
  author: Anthony Koukoullis
  description: "src/lib/skill-content-fetch.ts:330 calls console.error with a fixed message before rethrowing. It is the only console.* call anywhere under src/lib/. Sibling module headers state the opposite rule: src/lib/tree-layout.ts says it returns facts and logs nothing so the caller decides what to print, src/lib/workstream-store.ts says it adds no logging of its own, and src/lib/git.ts says nothing is logged. The established pattern puts the wording at the route boundary, which is why warnLegacyLayout exists in src/http/routes-board.ts."
  steps_to_reproduce:
    - "Cause a skill install to fail — for example, point the release host at an address that returns a non-2xx status."
    - "Trigger the install from the integrations modal, which sends POST /api/integrations/installs."
    - "Watch the terminal running the server, and read the HTTP response body."
  expected: "The library rethrows and reports nothing. The route boundary owns the wording, so the failure is reported exactly once, in wording the caller controls."
  actual: "The library writes its own fixed line to the process stderr of whatever host imported it, interleaved with the server's startup output in the packaged CLI binary. The HTTP layer separately answers with its own differently-worded 500 body, so one failure produces two reports. A caller that wants to handle the failure silently cannot suppress the line."
  affected: "src/lib/skill-content-fetch.ts:330; the boundary pattern in src/http/routes-integrations.ts and src/http/routes-board.ts (warnLegacyLayout)"
  environment: "The HTTP server, whether started unpackaged by npm start or as the packaged CLI binary, which runs the same server. src/http/routes-integrations.ts is the one src/ importer."
  tasks: []
  notes: "ARCHITECTURE.md lines 1783 and 1850 already record this module as the one src/lib/ module that logs."
  ```

- [ ] ISS-31-t8rpze. Two module header comments state a six-method IPC surface that has eight members

  ```yaml
  id: ISS-31-t8rpze
  status: ready
  severity: low
  author: Anthony Koukoullis
  description: "src/public/ipc-adapter.ts:1 calls it 'the six-channel IPC surface' and src/public/browser-ipc-shim.ts:4 says 'This file defines the same six-method surface'. The PraxisAPI interface at src/public/ipc-adapter.ts:30-39 declares eight members: listProjects, addProject, renameProject, removeProject, getProjectData, getWorkstreamDetail, getAppVersion, and the optional pickProjectFolder. The shim implements seven of the eight, omitting pickProjectFolder, which is optional because it is Electron-only."
  steps_to_reproduce:
    - "Read the header comment at src/public/ipc-adapter.ts:1 and the header comment at src/public/browser-ipc-shim.ts:4."
    - "Count the members declared by the PraxisAPI interface at src/public/ipc-adapter.ts:30-39."
    - "Compare the two counts."
  expected: "Both header comments state the surface size that PraxisAPI actually declares."
  actual: "Both comments say six. The interface declares eight. A developer who reads either header to learn the surface's shape under-counts it by two."
  affected: "src/public/ipc-adapter.ts:1; src/public/browser-ipc-shim.ts:4; the PraxisAPI interface at src/public/ipc-adapter.ts:30-39"
  environment: ""
  tasks: []
  notes: "Comments only — no runtime behaviour changes. These two comments are load-bearing because tools/bundle-public.mjs forbids renameProperties in its obfuscator configuration, on the grounds that these method names are a cross-process contract. A reader who trusts the count may under-count what that contract covers when changing the obfuscator settings. File this for the src/ impact only: the Electron counterpart is leftover scaffolding per CLAUDE.md and is not in scope."
  ```
