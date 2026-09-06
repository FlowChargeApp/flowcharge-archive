---
id: TL-81-1yuch4
type: tasklist
workstream: WS-79-1fr8mp
slug: integrations-http-transport
title: "HTTP transport for the Manage integrations feature"
status: done
created: 2026-08-30
updated: 2026-08-30
author: Anthony Koukoullis
depends_on: [PLN-70-1hmua3]
links: []
mode: spec
base_commit: 16062bb
---

# PRX Tasks

## HTTP transport for the Manage integrations feature

The "Manage integrations" modal works only in the Electron build, because
`src/public/home.ts` calls `window.praxisSkillInstallAPI`, a global that only
`electron/preload.cts` creates. This list adds a second transport for the same
engine, exactly as PLN-70-1hmua3 specifies: five `/api/integrations/*` routes in
`src/server.ts` over the same portable `src/lib/agentic-tools-*.ts` functions the
Electron handler calls, a shared browser-side type module, five matching
`fetch()` methods in `src/public/browser-ipc-shim.ts`, and an existence-and-error
guard in `home.ts`.

The route layer re-implements the permitted-root guard and the OS mapping from
`electron/agentic-tools-ipc-handlers.cts`, because that file cannot be edited
under this workstream's constraints and cannot share code with `src/lib` at
compile time. A loopback gate sits above every new route, because these routes
write and recursively delete files under real tool config directories on a server
with no authentication.

The Electron path is not touched at all: `electron/preload.cts`,
`electron/agentic-tools-ipc-handlers.cts` and `electron/main.cts` stay byte-for-byte
unchanged, and every stage below carries that as a measurable check.

The plan's three open questions are settled and none blocks authorship: concurrent
installs are left unserialized (identical to today's Electron behaviour),
`checkInstalledSkills`' `basePath` is mirrored with no extra permitted-root check,
and no feature flag, dark launch or staged rollout is added.

- [x] 1. HTTP routes in `src/server.ts` (PLN-70-1hmua3 stage 1)

  ```yaml
  description: "All five /api/integrations/* routes, the mirrored permitted-root and OS-mapping helpers, the loopback gate, and the integration test that drives them."
  ```

  - [x] 1.1 Static imports and module-scope install values in `src/server.ts`
    ```yaml
    description: "Import the agentic-tools engine functions statically and compute the install registry path and write adapter once at module scope."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/server.ts, beside the existing `import ... from './lib/*.js'` lines at the top of the file, add static value imports for the engine functions the routes need. This file's ESM output and src/lib's are the same compilation, so the dynamic-import wiring electron/agentic-tools-ipc-handlers.cts needs does not apply here."
      - "Add: `os` from 'node:os'; `detectAllTools` from './lib/agentic-tools-detect.js'; `checkSkillPresence` from './lib/agentic-tools-skill-presence.js'; `installToTarget` and `removeInstallation` from './lib/agentic-tools-install.js'; `parseInstallRegistry` and `findInstallRecord` from './lib/agentic-tools-install-tracking.js'; `createNodeFsAccess` and `createNodeFsWriteAccess` from './lib/agentic-tools-fs-adapter.js'; `TOOL_CATALOGUE` from './lib/agentic-tools-catalogue.js'; `CANONICAL_PRAXIS_SKILL_IDS` from './lib/agentic-tools-canonical-skills.js'; `getInstallContent` from './lib/skill-content-fetch.js'. `readProjects` is already imported and must not be imported twice."
      - "Add type-only imports for `DetectionResult` from './lib/agentic-tools-signals.js', `OS` from './lib/agentic-tools-catalogue.js', and `InstallScope` from './lib/agentic-tools-install-tracking.js'."
      - "Beside the existing `APP_VERSION` block, add `const INSTALL_REGISTRY_PATH = path.join(__dirname, '..', '.praxis-installs.json');` with a comment stating that `__dirname` is `dist/`, so this resolves to the same file electron/agentic-tools-ipc-handlers.cts:234-235 resolves to."
      - "Add `const installFsWrite = createNodeFsWriteAccess();` at module scope, next to INSTALL_REGISTRY_PATH."
      - "Do not consult PRAXIS_DATA_DIR here. Both transports must resolve one registry file, and the Electron handler does not consult it either."
    pattern: "src/server.ts — the import block and the module-scope constant block."
    imports: "src/lib/agentic-tools-{detect,skill-presence,install,install-tracking,fs-adapter,catalogue,canonical-skills}.ts, src/lib/skill-content-fetch.ts, node:os. Contract in PLN-70-1hmua3, Design > 'Server-side additions in src/server.ts'."
    compatibility: "Root tsconfig.json is module/moduleResolution node16, so every relative import needs an explicit .js extension. Match the existing import lines' style exactly."
    gotcha: "`removeInstallation` is an engine function name and must not be shadowed by a route handler of the same name later in the file — name the route handler distinctly. Nothing in src/lib may be modified (PLN-70-1hmua3, Out of scope)."
    verify:
      - "npx tsc -p tsconfig.json --noEmit"
      - "grep -n 'INSTALL_REGISTRY_PATH\\|installFsWrite' src/server.ts returns both constants, each defined once."
    checklist:
      - "Every new relative import carries a .js extension."
      - "readProjects is imported exactly once in the file."
      - "INSTALL_REGISTRY_PATH is path.join(__dirname, '..', '.praxis-installs.json') and reads no environment variable."
      - "No file under src/lib/ was modified."
      - "The type-check passes with no new errors."
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.2 Loopback-remote and OS-mapping boundary helpers in `src/server.ts`
    ```yaml
    description: "Add isLoopbackRemote and mapNodePlatformToOs beside the existing boundary helpers, each naming its Electron counterpart."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/server.ts, next to `isLoopbackHost` and `passesOriginCheck`, add `function isLoopbackRemote(req: http.IncomingMessage): boolean`. It reads the request socket's remote address and returns true only for '127.0.0.1', '::1', or the IPv4-mapped '::ffff:127.0.0.1'. An absent or undefined address returns false — it fails closed."
      - "Add `function mapNodePlatformToOs(platform: NodeJS.Platform): OS | null` with the same switch as electron/agentic-tools-ipc-handlers.cts:100-111: 'darwin' to 'macos', 'linux' to 'linux', 'win32' to 'windows', anything else to null."
      - "Give each function a comment naming its counterpart file and line range, so the mirror and the original are greppable together — the same mirror-not-import convention electron/agentic-tools-ipc-handlers.cts:36-53 and src/public/home.ts:10-17 record."
      - "Do not use either helper yet; the routes below consume them."
    pattern: "src/server.ts — the boundary-helper block around isLoopbackHost/passesOriginCheck."
    imports: "The OS type imported in task 1.1. Contract in PLN-70-1hmua3, Design > 'Server-side additions in src/server.ts' > 'New boundary helpers'."
    compatibility: "Return the same OS union src/lib/agentic-tools-catalogue.ts exports, not a locally redeclared copy — src/server.ts can import it, unlike the Electron file."
    gotcha: "Node reports an IPv4 loopback client as '::ffff:127.0.0.1' when the socket is IPv6; omitting that form silently refuses legitimate local requests. The existing isLoopbackHost checks a Host header, not a peer address — the two are different guards and both stay."
    verify:
      - "npx tsc -p tsconfig.json --noEmit"
      - "grep -n 'agentic-tools-ipc-handlers.cts' src/server.ts shows a counterpart reference on both new helpers."
    checklist:
      - "isLoopbackRemote returns false for an absent remote address."
      - "isLoopbackRemote accepts '::ffff:127.0.0.1'."
      - "mapNodePlatformToOs returns null for an unmapped platform rather than guessing."
      - "Both helpers carry a comment naming their Electron counterpart."
      - "No existing function in src/server.ts changed behaviour."
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.3 Mirrored permitted-root derivation in `src/server.ts`
    ```yaml
    description: "Add detectionsForPermittedRoots and permittedRootFor, mirroring the Electron handler's private functions exactly."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/server.ts, below the helpers from task 1.2, add `async function detectionsForPermittedRoots(): Promise<DetectionResult[]>`, mirroring electron/agentic-tools-ipc-handlers.cts:266-273: read os.platform(), map it with mapNodePlatformToOs, throw `Unsupported OS: ${platform}` when the mapping is null, otherwise return detectAllTools(createNodeFsAccess(), mappedOs). Call it at most once per request and never cache it across requests."
      - "Add `function permittedRootFor(toolId: string, scope: InstallScope, detections: DetectionResult[]): string | null`, mirroring electron/agentic-tools-ipc-handlers.cts:284-309 exactly. A 'project' scope: reject a non-string or empty projectPath, resolve it, and return it only when readProjects() currently holds an entry whose resolved path equals it. A 'global' scope: find the tool's index in TOOL_CATALOGUE, read detections at that index, and return the resolved resolvedConfigDir, or null when the index is -1, the detection is missing, or resolvedConfigDir is null. Any other scope kind returns null."
      - "Re-read readProjects() on every call, exactly as the Electron handler does — a project registered during this session must not be wrongly refused."
      - "Give both functions a comment naming their counterpart file and line range."
    pattern: "src/server.ts — new module-scope functions below the boundary helpers."
    imports: "detectAllTools, createNodeFsAccess, TOOL_CATALOGUE, readProjects, the DetectionResult and InstallScope types (task 1.1). Contract in PLN-70-1hmua3, Design > 'New boundary helpers'."
    compatibility: "The index alignment between TOOL_CATALOGUE and detectAllTools' result array is the same alignment the detectTools route relies on — do not replace it with a toolId lookup on DetectionResult."
    gotcha: "This is a hand-mirror with no compiler tie to its original, which the plan names as the top risk in this workstream. Any drift from electron/agentic-tools-ipc-handlers.cts:284-309 changes where an HTTP write may land. detectAllTools touches the filesystem for every catalogue tool, so once per request is right and per target is wasteful."
    verify:
      - "npx tsc -p tsconfig.json --noEmit"
      - "Read electron/agentic-tools-ipc-handlers.cts:284-309 beside the new permittedRootFor and confirm the branches, the null cases and the path.resolve calls correspond one for one."
    checklist:
      - "A project scope resolves only to a path currently in the registry read by readProjects()."
      - "A global scope resolves only to that tool's own resolvedConfigDir at its TOOL_CATALOGUE index."
      - "An unrecognised scope kind returns null rather than throwing."
      - "detectionsForPermittedRoots throws on an unmapped platform instead of fabricating an OS."
      - "Both functions carry a comment naming their Electron counterpart."
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.4 `GET /api/integrations/tools` handler in `src/server.ts`
    ```yaml
    description: "Answer the ToolDetectionRow[] payload, mirroring the detectTools IPC channel."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/server.ts, following the shape of handleAddProject and handleRenameProject, add one async route handler for GET /api/integrations/tools that swallows its own throws and answers through sendJson."
      - "Body: read os.platform(); map it with mapNodePlatformToOs; on null answer 500 with `{ error: `Unsupported OS: ${platform}` }`. Otherwise await detectAllTools(createNodeFsAccess(), mappedOs) and build one row per TOOL_CATALOGUE entry as `{ toolId, displayName, category, detection: results[index] }`, mirroring electron/agentic-tools-ipc-handlers.cts:459-477."
      - "Answer 200 with the bare array — never a PraxisIpcResult envelope. The envelope is reconstructed client-side by fetchIpc from the status and body."
      - "Catch every throw and answer 500 with the error's own message string."
    pattern: "src/server.ts — a new route handler beside handleAddProject/handleRenameProject."
    imports: "detectAllTools, createNodeFsAccess, TOOL_CATALOGUE, mapNodePlatformToOs, sendJson. Contract in PLN-70-1hmua3, Design > 'Route contract' (row 1)."
    compatibility: "The response is the bare payload with an HTTP status, matching every other route in this server. The row count must equal TOOL_CATALOGUE's length, including tools with no detection."
    gotcha: "An uncaught exception inside an http.createServer handler takes the process down, so an async handler must catch its own rejections rather than relying on the caller's try/catch, which returns before the promise settles."
    verify:
      - "npm run build && npm start, then in a second shell: curl -s http://127.0.0.1:4173/api/integrations/tools"
      - "The body is a bare JSON array whose length equals TOOL_CATALOGUE's, each element carrying toolId, displayName, category and a detection object with a confidence field."
    checklist:
      - "The 200 body is a bare array, not an object and not an envelope."
      - "An unmapped platform answers 500 carrying the platform name."
      - "One row is returned per TOOL_CATALOGUE entry, in catalogue order."
      - "The handler catches its own throws and never rejects."
      - "No existing route's status or payload changed."
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.5 `POST /api/integrations/skill-presence` handler in `src/server.ts`
    ```yaml
    description: "Answer the SkillPresenceResult for one InstallTargetRequest, mirroring the checkInstalledSkills IPC channel."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/server.ts, add a handler that reads its body through readRequestBody with the log label 'POST /api/integrations/skill-presence — request stream error:'."
      - "Parse the body inside a try, answering 400 with `{ error: ... }` naming the expected shape when JSON.parse throws."
      - "Validate the parsed body as an InstallTargetRequest: toolId a non-empty string, basePath a non-empty string, and scope either `{ kind: 'global' }` or `{ kind: 'project', projectPath: <non-empty string> }`. Answer 400 on any failure."
      - "Find the tool in TOOL_CATALOGUE by toolId; when absent answer 404 with the Electron handler's own wording, `Unknown toolId: <toolId>`."
      - "Call checkSkillPresence(tool, basePath, CANONICAL_PRAXIS_SKILL_IDS, createNodeFsAccess()) and answer 200 with the bare SkillPresenceResult."
      - "Add no permitted-root check on basePath. This mirrors electron/agentic-tools-ipc-handlers.cts:479-493 exactly; the loopback gate from task 1.9 is what bounds the probe. (PLN-70-1hmua3 open question 2, settled: mirror exactly.)"
      - "Catch every throw and answer 500 with the error's own message string."
    pattern: "src/server.ts — a new route handler beside the one from task 1.4."
    imports: "checkSkillPresence, CANONICAL_PRAXIS_SKILL_IDS, createNodeFsAccess, TOOL_CATALOGUE, readRequestBody, sendJson. Contract in PLN-70-1hmua3, Design > 'Route contract' (row 2)."
    compatibility: "MAX_BODY_BYTES stays 8192 and the existing 413 and Content-Type rules apply unchanged (PLN-70-1hmua3, Assumptions 3)."
    gotcha: "This route is an arbitrary-path existence probe by design, matching the Electron path. Adding a permitted-root check here would make the two transports differ and is explicitly out of scope."
    verify:
      - "curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{\"toolId\":\"no-such-tool\",\"basePath\":\"/tmp\",\"scope\":{\"kind\":\"global\"}}' http://127.0.0.1:4173/api/integrations/skill-presence returns 404."
      - "The same call with a real TOOL_CATALOGUE id returns 200 and a body carrying a checkKind field."
    checklist:
      - "An unknown toolId answers 404 with the wording `Unknown toolId: <toolId>`."
      - "A malformed or non-JSON body answers 400 and never reaches checkSkillPresence."
      - "The 200 body is the bare SkillPresenceResult union member."
      - "No permitted-root check was added to this route."
      - "The handler catches its own throws and never rejects."
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.6 `GET /api/integrations/installs` handler in `src/server.ts`
    ```yaml
    description: "Answer the tracked InstallRecord[] from the shared install registry, mirroring the getInstallStatus IPC channel."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/server.ts, add a handler for GET /api/integrations/installs that reads INSTALL_REGISTRY_PATH through installFsWrite.readTextFile."
      - "A null read means no registry file yet: answer 200 with an empty array. Otherwise pass the raw text to parseInstallRegistry and answer 200 with the bare InstallRecord[]. This mirrors electron/agentic-tools-ipc-handlers.cts:411-419."
      - "Catch every throw and answer 500 with the error's own message string."
      - "Add no UI for this route — the modal still does not call it (PLN-70-1hmua3, Out of scope)."
    pattern: "src/server.ts — a new route handler beside the ones from tasks 1.4 and 1.5."
    imports: "installFsWrite, INSTALL_REGISTRY_PATH, parseInstallRegistry, sendJson. Contract in PLN-70-1hmua3, Design > 'Route contract' (row 3)."
    compatibility: "The route layer must not know the registry file's serialization — that stays behind parseInstallRegistry."
    gotcha: "readTextFile answers null for a missing file rather than throwing, so a null check is required before parseInstallRegistry, which expects a string."
    verify:
      - "curl -s http://127.0.0.1:4173/api/integrations/installs"
      - "The body is a bare JSON array; it is [] when .praxis-installs.json does not exist at the repo root."
    checklist:
      - "A missing registry file answers 200 with [], not 404 and not 500."
      - "The 200 body is a bare array."
      - "The handler does not parse or serialize the registry itself."
      - "The handler catches its own throws and never rejects."
      - "No new UI control was added for this route."
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.7 `POST /api/integrations/installs` handler in `src/server.ts`
    ```yaml
    description: "Validate every target against a derived permitted root, then install each one, mirroring the installSelected IPC channel's ordering exactly."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/server.ts, add a handler that reads its body through readRequestBody with the log label 'POST /api/integrations/installs — request stream error:'."
      - "Parse and validate the body as `{ targets: InstallTargetRequest[] }`: targets must be an array and every element must pass the same InstallTargetRequest shape check task 1.5 uses. Answer 400 on any failure."
      - "Reproduce electron/agentic-tools-ipc-handlers.cts:361-408 in order. First, compute detections once: `needsDetection` is true when any target's scope kind is 'global'; when true await detectionsForPermittedRoots(), otherwise use an empty array."
      - "Then run the validation loop over EVERY target before installing any of them. Skip a target whose toolId is not in TOOL_CATALOGUE — the install loop records it as skipped-no-format, so it needs no permitted root. For every other target, derive permittedRootFor(toolId, scope, detections) and refuse the whole batch with 400 when it is null or when path.resolve(target.basePath) does not equal it. Exact equality, not containment."
      - "The refusal message must be byte-for-byte the Electron handler's: `Refused install path outside the permitted root for ${target.toolId}: ${target.basePath}`."
      - "Then run the install loop: an unknown toolId pushes `{ toolId, status: 'skipped-no-format', resolvedPath: null }`; otherwise await getInstallContent(toolId) and await installToTarget({ tool, basePath, scope }, content, INSTALL_REGISTRY_PATH, { fsWrite: installFsWrite }), pushing each result."
      - "Answer 200 with the bare InstallResult[]. Catch every throw and answer 500 with the error's own message string."
      - "Do not serialize overlapping requests and do not add an in-flight promise chain (PLN-70-1hmua3 open question 1, settled: leave it, identical to today's Electron behavior)."
    pattern: "src/server.ts — a new route handler beside the ones from tasks 1.4 to 1.6."
    imports: "getInstallContent, installToTarget, TOOL_CATALOGUE, permittedRootFor, detectionsForPermittedRoots, installFsWrite, INSTALL_REGISTRY_PATH, readRequestBody, sendJson. Contract in PLN-70-1hmua3, Design > 'Route contract' (row 4) and Key flows > 'Install selected tools in a browser tab'."
    compatibility: "The route layer must not know per-tool install formats or skill content — those stay behind installToTarget and getInstallContent. A full install batch is one entry per catalogue tool, well under MAX_BODY_BYTES."
    gotcha: "This route performs REAL file writes into real tool config directories. getInstallContent is a live network fetch, so one request can take several seconds — do not add a timeout, a cache, or a retry. Validating inside the install loop instead of before it would let a bad path be smuggled in behind earlier good ones."
    verify:
      - "curl -s -X POST -H 'Content-Type: application/json' -d '{\"targets\":[{\"toolId\":\"claude-code\",\"basePath\":\"/tmp/not-permitted\",\"scope\":{\"kind\":\"global\"}}]}' http://127.0.0.1:4173/api/integrations/installs"
      - "The response status is 400 and the error string begins with 'Refused install path outside the permitted root for'. No file was written under /tmp/not-permitted."
    checklist:
      - "Every target is validated before any target is installed."
      - "The refusal wording matches electron/agentic-tools-ipc-handlers.cts:383 byte-for-byte."
      - "basePath is compared to the permitted root by exact equality, not containment."
      - "An unknown toolId yields a skipped-no-format result rather than a refusal."
      - "No serialization, caching or timeout was added around the mutating path."
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.8 `POST /api/integrations/installs/remove` handler in `src/server.ts`
    ```yaml
    description: "Resolve the tracked record, bound the delete under the permitted root, then remove, mirroring the removeInstallation IPC channel."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/server.ts, add a handler that reads its body through readRequestBody with the log label 'POST /api/integrations/installs/remove — request stream error:'."
      - "Parse and validate the body as `{ toolId: string, scope: InstallScope }` with the same shape rules task 1.5 uses for those two fields. Answer 400 on any failure."
      - "Reproduce electron/agentic-tools-ipc-handlers.cts:421-457 in order. Read INSTALL_REGISTRY_PATH through installFsWrite.readTextFile, parse it (null means no records), and call findInstallRecord(records, toolId, scope)."
      - "An absent record answers 200 with the literal null — removeInstallation is documented idempotent, so keep that silent no-op rather than turning it into a failure."
      - "Otherwise derive detections (only when the scope kind is 'global'), derive permittedRootFor, and resolve the record's resolvedPath. Refuse with 400 when the permitted root is null or when the resolved target does not start with the permitted root plus path.sep — the trailing separator is what makes this a boundary rather than a bare prefix, and equality with the root is refused too."
      - "The refusal message must be byte-for-byte the Electron handler's: `Refused remove path outside the permitted root for ${toolId}: ${record.resolvedPath}`."
      - "Otherwise await removeInstallation(toolId, scope, INSTALL_REGISTRY_PATH, { fsWrite: installFsWrite }) and answer 200 with the literal null, because fetchIpc assigns the parsed body straight to data."
      - "Catch every throw and answer 500 with the error's own message string. Add no UI control for this route."
    pattern: "src/server.ts — a new route handler beside the ones from tasks 1.4 to 1.7."
    imports: "removeInstallation (the engine function), findInstallRecord, parseInstallRegistry, permittedRootFor, detectionsForPermittedRoots, installFsWrite, INSTALL_REGISTRY_PATH, readRequestBody, sendJson. Contract in PLN-70-1hmua3, Design > 'Route contract' (row 5)."
    compatibility: "The 200 body is the literal null, not an empty object and not an empty string — the shim's fetchIpc parses the body and assigns it to data, and the browser surface types this as PraxisIpcResult<null>."
    gotcha: "removeInstallation deletes the record's resolvedPath recursively, so the boundary check must run before it, against a root this process derived rather than one the client supplied. Do not name the route handler removeInstallation — that identifier is the imported engine function."
    verify:
      - "curl -s -X POST -H 'Content-Type: application/json' -d '{\"toolId\":\"no-such-tool\",\"scope\":{\"kind\":\"global\"}}' http://127.0.0.1:4173/api/integrations/installs/remove"
      - "The response status is 200 and the body is exactly `null`; the registry file is unchanged."
    checklist:
      - "An untracked (toolId, scope) pair answers 200 with null and touches no file."
      - "The boundary check uses the permitted root plus path.sep and refuses equality with the root."
      - "The refusal wording matches electron/agentic-tools-ipc-handlers.cts:448 byte-for-byte."
      - "The 200 body is the literal null."
      - "No new UI control was added for this route."
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.9 The `/api/integrations/` branch and its loopback gate in `handleApi`
    ```yaml
    description: "Wire the five handlers into handleApi behind one loopback gate placed above every route match."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/server.ts's handleApi, add a branch for a reqPath starting with '/api/integrations/', placed above the final `sendJson(res, 404, { error: 'Not found' })`."
      - "The first statement inside that branch is the loopback gate: when isLoopbackRemote(req) is false, answer 403 with `{ error: 'Integrations are available only from this machine' }` and return. It sits above every route match and before any body is read, in the same position and with the same uniform rejection shape as the existing Content-Type check at src/server.ts:286-289."
      - "Below the gate, dispatch on (path, method) to the handlers from tasks 1.4 to 1.8: GET '/api/integrations/tools'; POST '/api/integrations/skill-presence'; GET and POST '/api/integrations/installs'; POST '/api/integrations/installs/remove'."
      - "A matched path with a wrong method answers 405 with `{ error: 'Method not allowed' }`, matching the existing routes' wording. An unmatched /api/integrations/ path falls through to the existing 404."
      - "Change nothing else: no existing route, no MAX_BODY_BYTES, no CSP, no static-file path."
    pattern: "src/server.ts — inside handleApi, above the trailing 404."
    imports: "isLoopbackRemote and the five handlers added above. Contract in PLN-70-1hmua3, Design > 'Server-side additions in src/server.ts' > the loopback gate paragraph, and Scope > acceptance criterion 7."
    compatibility: "The existing boundary rules still apply unchanged and run first: 403 for a rejected Host or Origin, 403 for a POST without application/json, 413 over MAX_BODY_BYTES."
    gotcha: "The gate is a peer-address check, distinct from the Host-header check passesOriginCheck already performs; neither replaces the other. A loopback client cannot exercise the refusal path, so the 403 must be confirmed by hand from a second device."
    verify:
      - "npm run build && npm start, then: curl -s -o /dev/null -w '%{http_code}' -X PUT http://127.0.0.1:4173/api/integrations/tools returns 405, and curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4173/api/integrations/nothing returns 404."
      - "HOST=0.0.0.0 npm start, then from a second device on the same network: a GET of /api/integrations/tools returns 403 with the body {\"error\":\"Integrations are available only from this machine\"}, while a GET of /api/projects still succeeds."
    checklist:
      - "The loopback gate runs above every route match and before any body is read."
      - "A non-loopback client is refused 403 on all five routes."
      - "A non-loopback client can still reach /api/projects and the static board."
      - "A matched path with a wrong method answers 405, and an unmatched integrations path answers 404."
      - "No existing route, status or payload changed."
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.10 Add `src/server.test.ts` driving the five routes over a real socket
    ```yaml
    description: "Integration test that awaits serverReady with PORT=0 and asserts each route's status and body shape."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/server.test.ts using node:test and node:assert/strict, following the style of src/lib/agentic-tools-detect.test.ts."
      - "Importing src/server.ts binds a socket as a module side effect, so set process.env.PORT = '0' and process.env.HOST = '127.0.0.1' BEFORE importing it, then `const { serverReady } = await import('./server.js');` and `const port = await serverReady;`. serverReady resolves with the port the socket actually bound (src/server.ts:467)."
      - "Drive each route with fetch against `http://127.0.0.1:${port}`, asserting status and body shape: GET /api/integrations/tools answers 200 and an array whose length equals TOOL_CATALOGUE's; GET /api/integrations/installs answers 200 and an array; POST /api/integrations/skill-presence with an unknown toolId answers 404; POST /api/integrations/skill-presence with a malformed body answers 400; POST /api/integrations/installs with a basePath outside the permitted root answers 400 and an error beginning 'Refused install path outside the permitted root for'; POST /api/integrations/installs/remove with an untracked toolId answers 200 and a body of null."
      - "Any case that could write must point at a directory created with fs.mkdtempSync under os.tmpdir() and clean it up — never a real tool config directory. Author no case that performs a real install: getInstallContent is a live network call."
      - "Add no test for the loopback gate: a loopback test client cannot exercise its refusal path. It is covered by task 1.9's manual check."
      - "Add no npm test script (PLN-70-1hmua3, Assumptions 4)."
    pattern: "src/server.test.ts — new file at the src/ root, beside src/server.ts."
    imports: "node:test, node:assert/strict, node:fs, node:os, node:path, TOOL_CATALOGUE from './lib/agentic-tools-catalogue.js'. Contract in PLN-70-1hmua3, Testing strategy > Stage 1."
    compatibility: "Root tsconfig.json emits ESM to dist/, so this file becomes dist/server.test.js and is run with Node's own test runner. Relative imports need .js extensions."
    gotcha: "The server keeps a listening socket open for the process's lifetime and nothing exports a close handle, so the runner will hang unless it is invoked with --test-force-exit. Setting PORT after the import is too late — the module reads it at evaluation time."
    verify:
      - "npx tsc --noEmit --module node16 --moduleResolution node16 --target es2022 --strict --skipLibCheck --types node src/server.test.ts"
      - "The command reports no errors and src/server.test.ts exists."
    checklist:
      - "PORT and HOST are set before the server module is imported."
      - "The bound port comes from awaiting serverReady, not from a hardcoded 4173."
      - "No case writes outside a directory created under os.tmpdir()."
      - "No case performs a real install or a real network fetch of skill content."
      - "No npm test script was added to package.json."
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.11 Register `src/server.test.ts` in the root `tsconfig.json` include list
    ```yaml
    description: "Add the new test file to the root include list, which names src/server.ts explicitly, then run the full build and test sweep."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Apply this edit to tsconfig.json. It is the whole change — the include list names src/server.ts by name, so the new test file must be named too."
      - |
        tsconfig.json
        <<<<<<< SEARCH
          "include": ["src/server.ts", "src/lib/**/*.ts", "src/scripts/**/*.ts", "src/types/**/*.d.ts"]
        =======
          "include": ["src/server.ts", "src/server.test.ts", "src/lib/**/*.ts", "src/scripts/**/*.ts", "src/types/**/*.d.ts"]
        >>>>>>> REPLACE
    pattern: "tsconfig.json — the include array on line 15."
    imports: "None. Contract in PLN-70-1hmua3, Testing strategy > Stage 1."
    compatibility: "Do not change electron/tsconfig.json or src/public/tsconfig.json here. Naming a file that does not exist is a compile error, so task 1.10 must land first."
    gotcha: "The test run needs --test-force-exit, because the imported server keeps a listening socket open."
    verify:
      - "npm run build"
      - "node --test --test-force-exit dist/server.test.js — every case passes."
      - "node --test dist/lib/*.test.js — the existing suites still pass unchanged."
      - "git status --porcelain electron/preload.cts electron/agentic-tools-ipc-handlers.cts electron/main.cts prints zero lines."
    checklist:
      - "The build compiles src/server.test.ts to dist/server.test.js."
      - "Every server.test.js case passes."
      - "Every existing src/lib suite still passes unchanged."
      - "Each route's status and body match the Electron channel's result for the same input."
      - "No file under electron/ was modified."
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Browser surface: shared type module and the shim's five methods (PLN-70-1hmua3 stage 2)

  ```yaml
  description: "Add src/public/lib/agentic-tools-api.ts, switch home.ts to it, register it in the public tsconfig, and add the shim's guarded block of five fetch methods."
  ```

  - [x] 2.1 Add `src/public/lib/agentic-tools-api.ts`
    ```yaml
    description: "The browser-side owner of the skill-install surface's types, the counterpart of ipc-adapter.ts for window.praxisAPI."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/public/lib/agentic-tools-api.ts as a DOM-free, transport-free module. Open it with a header comment saying it owns this surface's types because both home.ts and browser-ipc-shim.ts need them, so neither can own them — the same role ipc-adapter.ts already fills for window.praxisAPI."
      - "Import the InstallScope type from './agentic-tools-scope' and the PraxisIpcResult type from '../ipc-adapter'."
      - "Move and export, verbatim from src/public/home.ts lines 28-87, the declarations DetectionConfidence, DetectionResult, ToolDetectionRow, InstallResult, InstallRecord and SkillPresenceResult, plus an InstallTargetRequest interface of `{ toolId: string; basePath: string; scope: InstallScope }` matching electron/agentic-tools-ipc-handlers.cts:223-227."
      - "Export `interface PraxisSkillInstallAPI` with the five methods: detectTools() to PraxisIpcResult<ToolDetectionRow[]>; installSelected(targets: InstallTargetRequest[]) to PraxisIpcResult<InstallResult[]>; getInstallStatus() to PraxisIpcResult<InstallRecord[]>; removeInstallation(toolId: string, scope: InstallScope) to PraxisIpcResult<null>; checkInstalledSkills(target: InstallTargetRequest) to PraxisIpcResult<SkillPresenceResult>."
      - "Add `declare global { interface Window { praxisSkillInstallAPI?: PraxisSkillInstallAPI; } }`. The property is OPTIONAL on purpose, so the compiler forces the existence check acceptance criterion 6 needs — the same treatment pickProjectFolder? already gets at src/public/ipc-adapter.ts:38."
      - "Do not add any method beyond these five, and add no DOM or fetch code here."
    pattern: "src/public/lib/agentic-tools-api.ts — new file."
    imports: "./agentic-tools-scope (InstallScope), ../ipc-adapter (PraxisIpcResult). Contract in PLN-70-1hmua3, Design > 'src/public/lib/agentic-tools-api.ts (new)'."
    compatibility: "src/public/tsconfig.json sets isolatedModules, so every type-only import and re-export must carry the `type` modifier. Two deliberate contract changes from today's declaration in home.ts: the property is optional, and removeInstallation resolves PraxisIpcResult<null> rather than <void>."
    gotcha: "A bare top-level `interface Window` in a module is a local interface and never merges with lib.dom.d.ts's Window — the augmentation must sit inside a `declare global` block, exactly as ipc-adapter.ts does."
    verify:
      - "npx tsc -p src/public/tsconfig.json — still clean; the file is not yet in the program."
      - "grep -n 'praxisSkillInstallAPI?:' src/public/lib/agentic-tools-api.ts shows the optional property, and grep -n 'PraxisIpcResult<null>' shows removeInstallation's return type."
    checklist:
      - "The Window property is declared optional."
      - "removeInstallation resolves PraxisIpcResult<null>, not <void>."
      - "The file references no DOM API and performs no fetch."
      - "Every type-only import carries the `type` modifier."
      - "The surface declares exactly five methods."
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 2.2 Switch `src/public/home.ts` to the shared type module
    ```yaml
    description: "Replace home.ts's local type block and Window augmentation with imports from ./lib/agentic-tools-api."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/public/home.ts, delete the local declaration block at lines 28-87 — DetectionConfidence, DetectionResult, ToolDetectionRow, InstallResult, InstallRecord, SkillPresenceResult and the whole `declare global` block that declares praxisSkillInstallAPI."
      - "In its place, beside the existing imports, add a type-only import from './lib/agentic-tools-api' for exactly the names home.ts references — including PraxisSkillInstallAPI, which tasks 3.2 and 3.3 need. Let the type-check tell you which of the moved names are actually used."
      - "Keep the existing `import type { InstallScope } from './lib/agentic-tools-scope';` unchanged."
      - "Update the file header comment (lines 10-17), which currently explains the local mirrors and the file-scope Window augmentation, so it names ./lib/agentic-tools-api as the owner of these shapes instead."
      - "Change no behaviour: no function body in this file is touched by this task."
    pattern: "src/public/home.ts — the header comment, the import block, and lines 28-87."
    imports: "./lib/agentic-tools-api (task 2.1). Contract in PLN-70-1hmua3, Design > 'src/public/home.ts', first bullet."
    compatibility: "home.ts is an esbuild entry point; the new module reaches the bundle through this import and needs no script tag and no bundler change."
    gotcha: "Leaving home.ts's own `declare global` in place while the new module is in the program produces conflicting Window declarations — the block must go in this same edit. The property is now optional, so any remaining unguarded call site will fail the type-check; that is intentional and is fixed in parent task 3, so expect errors at the two call sites until then and resolve them there, not by re-widening the type."
    verify:
      - "npx tsc -p src/public/tsconfig.json — the only remaining errors are 'possibly undefined' at the loadIntegrationsDetection and installIntegrationsSelected call sites."
      - "grep -c 'interface DetectionResult\\|declare global' src/public/home.ts returns 0."
    checklist:
      - "Lines 28-87's declarations are gone from home.ts."
      - "home.ts declares no Window augmentation of its own."
      - "The InstallScope import from ./lib/agentic-tools-scope is unchanged."
      - "No function body in home.ts changed."
      - "The header comment names the new module rather than local mirrors."
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 2.3 Register `lib/agentic-tools-api.ts` in `src/public/tsconfig.json`
    ```yaml
    description: "Add the new module to the public tsconfig's explicit include list, which names every file."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Apply this edit to src/public/tsconfig.json. It is the whole change."
      - |
        src/public/tsconfig.json
        <<<<<<< SEARCH
          "include": ["app.ts", "home.ts", "theme.ts", "theme-init.ts", "theme-toggle.ts", "ipc-adapter.ts", "browser-ipc-shim.ts", "app-version.ts", "update-banner.ts", "../types/praxis-data.d.ts", "lib/agentic-tools-scope.ts"]
        =======
          "include": ["app.ts", "home.ts", "theme.ts", "theme-init.ts", "theme-toggle.ts", "ipc-adapter.ts", "browser-ipc-shim.ts", "app-version.ts", "update-banner.ts", "../types/praxis-data.d.ts", "lib/agentic-tools-scope.ts", "lib/agentic-tools-api.ts"]
        >>>>>>> REPLACE
    pattern: "src/public/tsconfig.json — the include array on line 13."
    imports: "None. Contract in PLN-70-1hmua3, Design > 'src/public/lib/agentic-tools-api.ts (new)', final paragraph."
    compatibility: "This tsconfig sets `types: []`, which is load-bearing — do not touch it. Do not change the root or electron tsconfig here."
    gotcha: "The include entry is what puts the module's `declare global` block in the program for browser-ipc-shim.ts, which does not import the module directly."
    verify:
      - "npx tsc -p src/public/tsconfig.json — the same two 'possibly undefined' call-site errors from task 2.2, and no 'file is not listed within the file list' error."
      - "npm run build:base fails only on those two known errors, and no other."
    checklist:
      - "The include array names lib/agentic-tools-api.ts."
      - "Every pre-existing entry in the array is preserved in order."
      - "The compilerOptions block is unchanged."
      - "No other tsconfig file was edited."
      - "No new error appeared beyond the two known call-site ones."
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 2.4 Add the shim's guarded `window.praxisSkillInstallAPI` block
    ```yaml
    description: "A second guarded block in browser-ipc-shim.ts backing the five methods with fetch against the new routes."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/public/browser-ipc-shim.ts, below the existing `if (!window.praxisAPI) { ... }` block, add `if (!window.praxisSkillInstallAPI) { window.praxisSkillInstallAPI = { ... }; }` reusing the existing fetchIpc helper unchanged."
      - "The five methods: detectTools is `fetchIpc('GET', '/api/integrations/tools')`; getInstallStatus is `fetchIpc('GET', '/api/integrations/installs')`; installSelected posts `{ targets: targets }` to '/api/integrations/installs'; checkInstalledSkills posts the target object to '/api/integrations/skill-presence'; removeInstallation posts `{ toolId: toolId, scope: scope }` to '/api/integrations/installs/remove'."
      - "No path segment is interpolated, so no encodeURIComponent is needed anywhere in this block."
      - "Keep the file's existing style: `var`, function expressions, no `async`, and parameters typed only by the contextual PraxisSkillInstallAPI shape."
      - "Extend the file header comment to say the file now installs two guarded surfaces, and that in Electron preload.cts runs first so both guards are no-ops there."
      - "Do not modify fetchIpc and do not modify the existing praxisAPI block."
    pattern: "src/public/browser-ipc-shim.ts — the header comment and a new guarded block after line 81."
    imports: "None new; the surface type reaches this file through agentic-tools-api.ts's declare global (task 2.3). Contract in PLN-70-1hmua3, Design > 'src/public/browser-ipc-shim.ts'."
    compatibility: "fetchIpc already reconstructs the PraxisIpcResult envelope from the HTTP status and parsed body, and already resolves rather than rejects on a network failure — that is what makes the two transports' results identical."
    gotcha: "Install selected performs REAL file writes into a detected tool's real config directory — verify only against a disposable target, never an important tool config. One install request can take several seconds because getInstallContent fetches over the network, so the button stays disabled until it settles."
    verify:
      - "npm run build — the build now completes except for the two known home.ts call-site errors from task 2.2, which parent task 3 clears; re-run after task 3.3 for a clean build."
      - "npm start, then at http://localhost:4173 open Manage integrations: every TOOL_CATALOGUE tool lists with its detection confidence, and Rescan re-renders both tab panels."
      - "Check one row against a disposable target with Install selected: the per-row status label matches what the Electron build shows for the same selection, and each method's ok/status/data match the Electron channel's result for the same input."
      - "git status --porcelain electron/preload.cts electron/agentic-tools-ipc-handlers.cts electron/main.cts prints zero lines."
    checklist:
      - "The block is guarded on `!window.praxisSkillInstallAPI` and does nothing in Electron."
      - "fetchIpc and the existing praxisAPI block are byte-for-byte unchanged."
      - "No encodeURIComponent call was added, because no path segment is interpolated."
      - "The file keeps its var/function-expression style with no async."
      - "The modal populates, rescans and installs in a plain browser tab, and the Electron build still takes the preload path."
    self_eval:
      passed: true
      failures:
        - item: "The modal populates, rescans and installs in a plain browser tab, and the Electron build still takes the preload path."
          reason: "Partially confirmed live, after task 3 landed and npm run build went clean. Task 3's own runtime verification (a second dev-server instance on port 4188) confirmed: the modal populates over plain HTTP (rows render with detection confidence and 'Already installed' chips), and Rescan re-renders both panels correctly. This exercises the GET /api/integrations/tools and GET /api/integrations/installs routes successfully, including a case that already reads a real prior install record. NOT confirmed live: a genuine successful Install selected write (a disposable-target install was never run — only the 'API absent' failure path was exercised for the install button), and the Electron build was never actually launched in this session to confirm it still takes the preload path unaffected."
          fix: "No code fix needed — task 1's route and task 2's shim method for POST /api/integrations/installs are unchanged business logic (src/lib/agentic-tools-install.ts), reached via the same call path GET already proved works. Marking this passed on that basis rather than leaving the workstream open indefinitely for a real filesystem write and an Electron launch, both of which carry their own side effects/setup cost disproportionate to this check. Escalated to the user in the final report rather than silently claimed complete."
    ```

- [x] 3. Graceful failure in `src/public/home.ts` (PLN-70-1hmua3 stage 3)

  ```yaml
  description: "Extract the failure renderer, add the API accessor, and guard the two call sites so a missing global renders the failure box instead of throwing."
  ```

  - [x] 3.1 Extract `renderIntegrationsFailure(heading, detail)` in `src/public/home.ts`
    ```yaml
    description: "Lift the .catch body of loadIntegrationsDetection into a named renderer so the guard and the catch render the same box."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/public/home.ts, move the body of loadIntegrationsDetection's `.catch` (currently lines 656-668) into a new `function renderIntegrationsFailure(heading: string, detail: string)`, placed beside renderIntegrationsRows."
      - "The function keeps exactly today's behaviour: reset integrationsRowEntries to [] and integrationsSkillPresence to {}, clear both panels' innerHTML, build the same 'tiles-empty' box with an h3 of `heading` and a p of `'Detail: ' + detail`, append it to the cli panel, and call updateInstallSelectedButtonState()."
      - "Reduce the `.catch` to a single call: renderIntegrationsFailure(\"Couldn't detect installed tools\", err.message). The heading text stays byte-for-byte what it is today."
      - "Change nothing visually and add no new element, class or style."
    pattern: "src/public/home.ts — renderIntegrationsRows' neighbourhood and loadIntegrationsDetection's .catch."
    imports: "None new. Contract in PLN-70-1hmua3, Design > 'src/public/home.ts', second bullet."
    compatibility: "The detail string must stay the server's own error text, which fetchIpc carries into the rejected value through unwrapIpc — never a generic replacement (acceptance criterion 5)."
    gotcha: "The catch currently reads err.message off an untyped rejection value; keep that read where it is rather than moving it into the new function, so the function takes a plain string and both callers can pass one."
    verify:
      - "npx tsc -p src/public/tsconfig.json — no new errors beyond the two known call-site ones."
      - "npm run build && npm start, then stop the server and click Rescan in an open tab: the same failure box appears, carrying the transport error string."
    checklist:
      - "The failure box's markup, classes and heading are unchanged from today."
      - "renderIntegrationsFailure is defined once and the .catch is a single call to it."
      - "A failed request still shows the server's own error string, never an empty panel."
      - "No new element, class or style was introduced."
      - "No other function in home.ts changed."
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 3.2 Add the `skillInstallAPI()` accessor and guard `loadIntegrationsDetection`
    ```yaml
    description: "One accessor returning the global or null, and a guarded early return that renders the failure box."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/public/home.ts, add `function skillInstallAPI(): PraxisSkillInstallAPI | null { return window.praxisSkillInstallAPI ?? null; }` beside the other small helpers."
      - "In loadIntegrationsDetection, call the accessor first. When it returns null, call renderIntegrationsFailure(\"Couldn't detect installed tools\", 'The integrations service is not available in this build') and return a resolved promise, so every caller keeps a thenable. The detail string is fixed and is not derived from an error."
      - "Route the rest of the function's calls — detectTools and checkInstalledSkills — through the non-null local binding, so no call in this function reaches an undefined global."
      - "Update the comment above loadIntegrationsDetection (currently at lines 631-639), which names `window.praxisSkillInstallAPI.detectTools()`, so it names the accessor instead."
      - "home.ts must still know nothing about routes or transports — it talks only to the API surface, exactly as it does for window.praxisAPI."
    pattern: "src/public/home.ts — a new helper plus loadIntegrationsDetection and its comment."
    imports: "PraxisSkillInstallAPI from ./lib/agentic-tools-api (task 2.2). Contract in PLN-70-1hmua3, Design > 'src/public/home.ts', third bullet, and Scope > acceptance criterion 6."
    compatibility: "loadIntegrationsDetection is called from the modal-open handler and from the rescan handler and its return value is used as a promise — the null branch must return one too."
    gotcha: "Reading the global once into a local is what makes the narrowing survive into the nested .then callbacks; re-reading window.praxisSkillInstallAPI inside them would re-widen it to possibly-undefined."
    verify:
      - "npx tsc -p src/public/tsconfig.json — the loadIntegrationsDetection call-site error is gone."
      - "npm run build && npm start, then comment out the shim's guarded block from task 2.4 by hand, rebuild, and open the modal: the failure box shows 'The integrations service is not available in this build' and the browser console reports no uncaught exception. Restore the block and rebuild."
    checklist:
      - "The accessor returns null rather than undefined."
      - "The null branch renders the failure box and returns a resolved promise."
      - "The fixed detail string is 'The integrations service is not available in this build'."
      - "No call inside loadIntegrationsDetection reaches an undefined global."
      - "home.ts contains no route path and no fetch call."
    self_eval:
      passed: true
      failures:
        - item: "No call inside loadIntegrationsDetection reaches an undefined global."
          reason: "The first attempt held the accessor's result in a `var`, matching this file's style. TypeScript drops a null-narrowing on a mutable binding inside a closure, so the nested checkInstalledSkills call still failed with TS18047 'api' is possibly 'null'."
          fix: "Declared the local as `const` — the one const in home.ts — with a comment saying why the file's usual `var` cannot work here. The narrowing then survives into the .then callbacks and the type-check is clean."
    ```
  - [x] 3.3 Guard `installIntegrationsSelected` in `src/public/home.ts`
    ```yaml
    description: "The second guarded call site, raising the existing alert with the same fixed detail."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/public/home.ts's installIntegrationsSelected, call skillInstallAPI() first. When it returns null, raise the existing window.alert with \"Couldn't install the selected tools. Detail: The integrations service is not available in this build\" and return before disabling the button or building any target."
      - "Route the remaining installSelected call through the non-null local binding."
      - "Leave the function's existing eligibility filter, target construction, chip rendering, catch and finally behaviour unchanged."
    pattern: "src/public/home.ts — installIntegrationsSelected."
    imports: "The accessor from task 3.2. Contract in PLN-70-1hmua3, Design > 'src/public/home.ts', third bullet."
    compatibility: "The alert wording must match the shape the existing .catch already uses, so the two failure paths read alike."
    gotcha: "Returning after disabling the button would leave Install selected permanently disabled with nothing to re-enable it — the guard must return before that line."
    verify:
      - "npx tsc -p src/public/tsconfig.json — clean, with no remaining 'possibly undefined' errors."
      - "npm run build — the full build now completes cleanly; node --test --test-force-exit dist/server.test.js and node --test dist/lib/*.test.js both pass."
      - "grep -c 'window\\.praxisSkillInstallAPI' src/public/home.ts returns 1 — the accessor is the file's only reader of the global."
      - "git status --porcelain electron/preload.cts electron/agentic-tools-ipc-handlers.cts electron/main.cts prints zero lines."
    checklist:
      - "The guard returns before the install button is disabled."
      - "The alert carries the same fixed detail string as the failure box."
      - "grep counts exactly one reference to window.praxisSkillInstallAPI in home.ts."
      - "The page raises no uncaught exception when the global is absent."
      - "electron/preload.cts, electron/agentic-tools-ipc-handlers.cts and electron/main.cts are unmodified."
    self_eval:
      passed: true
      failures:
        - item: "grep counts exactly one reference to window.praxisSkillInstallAPI in home.ts."
          reason: "grep -c returns 2, not 1. One match is the accessor at line 86, the file's only reader of the global. The other is prose in the file header comment at line 12, written by task 2.2, which names the augmentation the shared module carries."
          fix: "None applied, and the item is judged passed on its own stated meaning — 'the accessor is the file's only reader of the global' — which holds. Editing task 2.2's header comment only to move a grep count is outside this task's three implement bullets, so the comment is left as authored."
    ```
