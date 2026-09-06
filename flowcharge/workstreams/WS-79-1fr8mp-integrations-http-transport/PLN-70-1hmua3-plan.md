---
id: PLN-70-1hmua3
type: plan
workstream: WS-79-1fr8mp
slug: integrations-http-transport
title: "HTTP transport for the Manage integrations feature"
status: done
created: 2026-08-30
updated: 2026-08-30
depends_on: []
links: []
---

# HTTP transport for the Manage integrations feature

## Summary

The "Manage integrations" modal works only in the Electron build, because
`src/public/home.ts` calls `window.praxisSkillInstallAPI`, a global that only
`electron/preload.cts` creates. This plan adds a second transport for the same
engine: five HTTP routes in `src/server.ts` that call the same portable
`src/lib/agentic-tools-*.ts` functions `electron/agentic-tools-ipc-handlers.cts`
calls, five matching `fetch()` methods in `src/public/browser-ipc-shim.ts`, and
an existence-and-error guard in `home.ts`.

The chosen approach mirrors the parity pattern this codebase already uses for
the six-method `window.praxisAPI` surface: routes in `server.ts`, a
`fetch()`-backed fallback in `browser-ipc-shim.ts` that installs itself only
when the Electron global is absent. The Electron path is not touched at all.
The route layer re-implements the permitted-root guard from
`electron/agentic-tools-ipc-handlers.cts:284-309`, because that file cannot be
edited under this workstream's constraints and cannot share code with `src/lib`
at compile time (its own header, lines 8-53, records why).

## Scope

### Acceptance criteria

1. With `npm start` and no Electron, opening "Manage integrations" lists every
   `TOOL_CATALOGUE` tool with its detection confidence, as the Electron build does.
2. "Rescan" in a browser tab re-runs detection and re-renders both tab panels.
3. "Install selected" in a browser tab writes the same files and shows the same
   per-row status label as the Electron build for the same selection.
4. Each of the five methods resolves a `PraxisIpcResult` whose `ok`, `status`
   and `data` match the Electron channel's result for the same input.
5. A failed request renders the modal's existing failure box carrying the
   server's own error string, never an empty panel.
6. With `window.praxisSkillInstallAPI` absent, the modal renders that same
   failure box and the page raises no uncaught exception.
7. A request to an `/api/integrations/*` route from a non-loopback client is
   refused `403`, and the modal shows the refusal message.
8. The Electron build behaves exactly as today: `electron/preload.cts` and
   `electron/agentic-tools-ipc-handlers.cts` are unmodified.

### Out of scope

- Any behavior change in `src/lib/agentic-tools-*.ts` or `src/lib/skill-content-fetch.ts`.
- Any edit to `electron/preload.cts`, `electron/agentic-tools-ipc-handlers.cts`
  or `electron/main.cts`.
- New UI: no control is added for `getInstallStatus` or `removeInstallation`,
  which the modal still does not call.
- The CLI-binary packaging target, which is context for this work, not part of it.
- `.praxis-installs.json` is written under the repo root while
  `.praxis-projects.json` honours `PRAXIS_DATA_DIR` (`src/lib/projects.ts:22`).
  This plan mirrors the existing computation and changes neither.

### Assumptions still open

1. The HTTP path computes its registry path exactly as
   `electron/agentic-tools-ipc-handlers.cts:234-235` does, so both transports
   read and write one file. `PRAXIS_DATA_DIR` is deliberately not consulted.
2. All five `/api/integrations/*` routes are refused unless the request's remote
   address is loopback. The rationale is in Design; the effect is that a
   `HOST=0.0.0.0` server still serves boards to the network but never installs,
   removes, or probes paths for a remote client.
3. `MAX_BODY_BYTES` (8192) is left unchanged: a full install batch is one entry
   per catalogue tool, roughly two orders of magnitude below that ceiling.
4. Tests are compiled by the root `tsconfig.json` and run with Node's own test
   runner against `dist/`; there is no `npm test` script and none is added.

## Key flows

**Open the modal in a browser tab** — **Actor:** a user on `http://localhost:4173`.
**Preconditions:** the server is running; no Electron. **Main flow:** the click
handler calls `window.praxisSkillInstallAPI.detectTools()`, which the shim
serves with `GET /api/integrations/tools`; rows render; one
`POST /api/integrations/skill-presence` per globally-eligible row fills the
install chips. **Outcome:** the same populated modal the Electron build shows.
**Edge cases:** an unsupported OS answers `500` and renders the failure box; a
non-loopback client answers `403` and renders the same box with the refusal
message.

**Install selected tools in a browser tab** — **Actor:** the same user.
**Preconditions:** at least one eligible row is checked. **Main flow:**
`installSelected(targets)` posts to `POST /api/integrations/installs`; the route
validates every target's `basePath` against a root it derives itself, then
installs each target and answers the `InstallResult[]`. **Outcome:** each row's
chip shows its real status. **Edge cases:** one refused `basePath` fails the
whole batch with `400` before any write, exactly as the Electron handler does;
the fetch of skill content is a live network call, so the request can take
several seconds and the button stays disabled until it settles.

**The API is unavailable** — **Actor:** a user in any build where the global is
missing. **Preconditions:** neither the preload nor the shim installed
`window.praxisSkillInstallAPI`. **Main flow:** the modal's load path finds no
API and renders the failure box instead of calling into `undefined`.
**Outcome:** a readable message, no uncaught `TypeError`. **Edge cases:** the
same box is used for a transport failure, so both paths read alike.

## Design

### Route contract

All routes live in `src/server.ts`'s `handleApi`, alongside the existing ones,
and answer the bare payload with an HTTP status — never a `PraxisIpcResult`
envelope. The envelope is reconstructed client-side by `fetchIpc`
(`src/public/browser-ipc-shim.ts:18-48`) from the status and body, which is what
makes the two transports' results identical.

| Method | Path | Request body | 200 body | Mirrors IPC channel |
|---|---|---|---|---|
| GET | `/api/integrations/tools` | — | `ToolDetectionRow[]` | `detectTools` |
| POST | `/api/integrations/skill-presence` | `InstallTargetRequest` | `SkillPresenceResult` | `checkInstalledSkills` |
| GET | `/api/integrations/installs` | — | `InstallRecord[]` | `getInstallStatus` |
| POST | `/api/integrations/installs` | `{ targets: InstallTargetRequest[] }` | `InstallResult[]` | `installSelected` |
| POST | `/api/integrations/installs/remove` | `{ toolId: string, scope: InstallScope }` | `null` | `removeInstallation` |

`InstallTargetRequest` is `{ toolId: string; basePath: string; scope: InstallScope }`,
matching `electron/agentic-tools-ipc-handlers.cts:223-227`. `InstallScope` is
`{ kind: 'global' } | { kind: 'project'; projectPath: string }`.

Failure statuses carry `{ error: string }` and are chosen so the reconstructed
`PraxisIpcResult.status` equals the Electron envelope's `status` for the same
condition: `400` for a malformed body or a refused install/remove path (with the
handler's own `Refused install path outside the permitted root for <toolId>: <path>`
wording), `404` for an unknown `toolId`, `500` for an unsupported OS or an
unexpected throw, `405` for a wrong method. The existing boundary rules apply
unchanged: `403` for a rejected `Host`/`Origin`, `403` for a `POST` without
`application/json`, `413` over `MAX_BODY_BYTES`.

`GET /api/integrations/tools` answers a bare JSON array, and
`POST /api/integrations/installs/remove` answers the literal `null`, because
`fetchIpc` assigns the parsed body straight to `data`.

### Server-side additions in `src/server.ts`

Static imports, which this file can use freely — its ESM output and
`src/lib`'s are the same compilation, so the dynamic-import wiring the Electron
file needs does not apply here: `detectAllTools`, `checkSkillPresence`,
`installToTarget`, `removeInstallation`, `parseInstallRegistry`,
`findInstallRecord`, `createNodeFsAccess`, `createNodeFsWriteAccess`,
`TOOL_CATALOGUE`, `CANONICAL_PRAXIS_SKILL_IDS`, `getInstallContent`, and the
already-imported `readProjects`.

Module-scope values, computed once beside the existing `APP_VERSION` block:

- `INSTALL_REGISTRY_PATH = path.join(__dirname, '..', '.praxis-installs.json')`
  — `__dirname` is `dist/`, so this resolves to the same file
  `electron/agentic-tools-ipc-handlers.cts:234-235` resolves to.
- `installFsWrite = createNodeFsWriteAccess()`.

New boundary helpers, kept next to `isLoopbackHost` and `passesOriginCheck`:

- `isLoopbackRemote(req: http.IncomingMessage): boolean` — true only for a
  remote address of `127.0.0.1`, `::1`, or an IPv4-mapped `::ffff:127.0.0.1`;
  an absent address is false. Fails closed.
- `mapNodePlatformToOs(platform: NodeJS.Platform): 'macos' | 'linux' | 'windows' | null`
  — the same mapping as `electron/agentic-tools-ipc-handlers.cts:100-111`, with
  `null` for an unmapped platform.
- `permittedRootFor(toolId: string, scope: InstallScope, detections: DetectionResult[]): string | null`
  — the same derivation as `electron/agentic-tools-ipc-handlers.cts:284-309`:
  a `project` scope resolves only to a path currently in the registry read by
  `readProjects()`; a `global` scope resolves only to that tool's own
  `resolvedConfigDir`, read at the tool's index in `TOOL_CATALOGUE`; anything
  else is `null`.

These three are a deliberate mirror of the Electron handler's private
functions, following this codebase's established mirror-not-import convention
(`electron/agentic-tools-ipc-handlers.cts:36-53`, `src/public/home.ts:10-17`).
Each carries a comment naming its counterpart so the two are greppable
together.

Route handlers follow the shape of `handleAddProject` and `handleRenameProject`:
one function per route, each swallowing its own throws and answering JSON via
`sendJson`, each reading its body through `readRequestBody`. The install and
remove handlers reproduce the Electron handler's ordering exactly — validate
every target against a derived root before installing any of them; on remove,
resolve the tracked record and check its `resolvedPath` sits under the
permitted root on a separator boundary before deleting.

The loopback gate is one check at the top of the `/api/integrations/` branch,
above every route match, in the same position and with the same uniform
rejection shape as the existing `Content-Type` check
(`src/server.ts:286-289`). It answers `403` with
`{ error: 'Integrations are available only from this machine' }`. It exists
because these routes write and recursively delete files under a user's real
tool config directories, and this server has no authentication — `README.md`
already warns that a `HOST=0.0.0.0` bind exposes every route to the network.
The permitted-root guard bounds *where* a write can land; the gate bounds *who*
can ask for one, and keeps the HTTP path's reach equal to the Electron path's.

What the route layer knows: HTTP shape, body validation, permitted-root
derivation, the loopback gate, and status mapping. What it must not know:
per-tool install formats, skill content, or the registry file's serialization —
all of which stay behind `installToTarget`, `getInstallContent` and
`parseInstallRegistry`.

### `src/public/lib/agentic-tools-api.ts` (new)

The browser-side owner of this surface's types, mirroring what `ipc-adapter.ts`
already is for `window.praxisAPI` — both `home.ts` and `browser-ipc-shim.ts`
need these shapes, so neither can own them. It imports `InstallScope` from the
existing `./agentic-tools-scope`, declares `DetectionConfidence`,
`DetectionResult`, `ToolDetectionRow`, `InstallResult`, `InstallRecord`,
`SkillPresenceResult` and `InstallTargetRequest` (all moved verbatim from
`src/public/home.ts:28-87`), and publishes:

```ts
export interface PraxisSkillInstallAPI {
  detectTools(): Promise<PraxisIpcResult<ToolDetectionRow[]>>;
  installSelected(targets: InstallTargetRequest[]): Promise<PraxisIpcResult<InstallResult[]>>;
  getInstallStatus(): Promise<PraxisIpcResult<InstallRecord[]>>;
  removeInstallation(toolId: string, scope: InstallScope): Promise<PraxisIpcResult<null>>;
  checkInstalledSkills(target: InstallTargetRequest): Promise<PraxisIpcResult<SkillPresenceResult>>;
}

declare global {
  interface Window {
    praxisSkillInstallAPI?: PraxisSkillInstallAPI;
  }
}
```

Two contract changes from today's declaration in `home.ts`, both deliberate.
The property is optional, so the compiler forces the existence check acceptance
criterion 6 requires — the same treatment `pickProjectFolder?` already gets
(`src/public/ipc-adapter.ts:38`). `removeInstallation` resolves
`PraxisIpcResult<null>`, which is what both transports actually carry; today's
`void` is inaccurate and nothing reads the value.

This file is DOM-free and transport-free. It must be added to
`src/public/tsconfig.json`'s explicit `include` list, which names every file.

### `src/public/browser-ipc-shim.ts`

A second guarded block below the existing `if (!window.praxisAPI)` block,
reusing the same `fetchIpc` helper unchanged:

```ts
if (!window.praxisSkillInstallAPI) {
  window.praxisSkillInstallAPI = { /* five methods over the routes above */ };
}
```

`detectTools` and `getInstallStatus` are `GET` with no body; `installSelected`
posts `{ targets: targets }`; `checkInstalledSkills` posts the target object;
`removeInstallation` posts `{ toolId: toolId, scope: scope }`. No path segment
is interpolated, so no `encodeURIComponent` is needed. The file keeps its
existing style: `var`, function expressions, no `async`.

### `src/public/home.ts`

- Its local type block (lines 28-87) is replaced by imports from
  `./lib/agentic-tools-api`.
- The body of `loadIntegrationsDetection`'s `.catch` (lines 656-668) becomes a
  named `renderIntegrationsFailure(heading: string, detail: string)` so the
  guard and the catch render the same box.
- A `skillInstallAPI(): PraxisSkillInstallAPI | null` accessor returns
  `window.praxisSkillInstallAPI ?? null`. `loadIntegrationsDetection` and
  `installIntegrationsSelected` call it first and, on `null`, render the failure
  box (respectively raise the existing `window.alert`) with the fixed detail
  `The integrations service is not available in this build`, then return a
  resolved promise. No call reaches an undefined global.
- `home.ts` still knows nothing about routes or transports: it talks only to the
  API surface, exactly as it does for `window.praxisAPI`.

## Stages

1. **HTTP routes in `src/server.ts`.** All five routes, the mirrored
   permitted-root and OS-mapping helpers, and the loopback gate. First because
   it carries every risk in this workstream — mirrored security logic and the
   one file all serving depends on. Observable: `curl` from this machine returns
   detection rows and install results; a request from another host gets `403`;
   the Electron build is untouched and still works.
2. **Browser surface: the shared type module and the shim's five methods.**
   Adds `src/public/lib/agentic-tools-api.ts`, its `tsconfig` include entry, and
   the guarded shim block; `home.ts` switches to the imported types. Observable:
   the modal populates, installs and rescans in a plain browser tab at
   `http://localhost:4173`, and the Electron build still takes the preload path.
3. **Graceful failure in `home.ts`.** The accessor, the extracted failure
   renderer, and the two guarded call sites. Last because it is the smallest
   change and depends on nothing above — it could equally be done first.
   Observable: with the shim's block disabled by hand, the modal shows the
   failure box and the console reports no uncaught exception.

## Data & compatibility

- No migration and no new persisted state. `.praxis-installs.json` keeps its
  current shape, written by the same `installToTarget` on both transports, and
  both transports resolve the same file path.
- The Electron IPC path is byte-for-byte unchanged, so a desktop build sees no
  difference. The shim's guard means the new browser methods never install
  inside Electron, exactly as the existing `window.praxisAPI` guard behaves.
- The five routes are new paths that answered `404` before, so no existing
  client can be broken by them. No existing route, status or payload changes.
- Rollback is a plain revert: the routes are additive, the shim block is
  guarded, and nothing on disk is written in a new format. Reverting stage 2
  alone returns the browser build to today's broken modal without affecting the
  server; reverting all three returns the repo to today's behavior exactly.

## Testing strategy

- **Stage 1.** Integration coverage is the only honest level here: importing
  `src/server.ts` binds a socket, so its helpers cannot be unit-tested in
  isolation. A new `src/server.test.ts` can await the exported `serverReady`
  (`src/server.ts:467`) with `PORT=0` and drive each route with `fetch`,
  asserting status and body shape for the happy path, an unknown `toolId`
  (`404`), a malformed body (`400`), and a `basePath` outside the permitted root
  (`400`). Adding that file needs an `include` entry in the root
  `tsconfig.json`, which currently lists `src/server.ts` by name. The install
  and remove cases must point at a temporary directory, never a real tool config
  directory. The loopback gate cannot be exercised from a loopback test client;
  verify it by hand with `HOST=0.0.0.0` and a second device, or leave it to
  review.
- **Stage 2.** No test runner exists for browser code and none is introduced.
  Verify by hand in a tab: rows render, rescan re-renders, install reports real
  statuses, and the Electron build still shows the same results.
- **Stage 3.** Verify by hand by commenting out the shim's guarded block: the
  failure box appears and the console stays clean.
- The existing `src/lib/agentic-tools-*.test.ts` suites keep passing unchanged;
  no library they cover is modified.

## Open questions

1. **Concurrent installs over HTTP.** `installToTarget` and `removeInstallation`
   read `.praxis-installs.json`, mutate it, and write it back, so two overlapping
   requests can lose one another's records. The Electron path has the same shape
   and is protected only by the modal disabling its button. Options: leave it
   (identical to today's Electron behavior), or serialize the two mutating routes
   behind a single in-flight promise chain in the route layer. Recommendation:
   leave it, and treat serialization as its own workstream if it is ever observed.
2. **Guarding `checkInstalledSkills`' `basePath`.** The Electron handler passes
   the renderer's `basePath` to `checkSkillPresence` with no permitted-root
   check, so it is an arbitrary-path existence probe. Mirroring that over HTTP
   reproduces the probe, bounded by the loopback gate. Options: mirror exactly
   (parity, and the gate bounds it), or add a permitted-root check on the HTTP
   route only, which makes the two transports differ. Recommendation: mirror
   exactly.
3. **Deployment and release constraints were not confirmed.** This plan assumes
   there is no live deployment, no shared instance and no production data — the
   server is a local, loopback-bound tool — so no feature flag, dark launch or
   staged rollout is planned. If any shared or long-lived instance exists, the
   loopback gate and question 1 both need re-examining before stage 1.

## Adjacent opportunities

Not requested, listed only so they can be promoted deliberately.

- A "Remove" control in the modal would give `getInstallStatus` and
  `removeInstallation` their first caller; both are otherwise built and unused.
  Skip.
- Caching `getInstallContent` for the duration of one install batch would turn
  N network fetches into one. Skip.

## Alternatives considered and rejected

- Relay the Electron IPC handler through loopback HTTP, as
  `electron/ipc-handlers.cts` already does for `window.praxisAPI`, leaving one
  implementation — rejected: it rewrites the Electron path, which this
  workstream must preserve exactly.
- Extract the permitted-root guard into a shared `src/lib` module used by both
  transports — rejected for the same reason: the Electron file cannot import
  `src/lib` at the top level (its header, lines 8-53), so adopting it there
  means editing that file's dynamic-import wiring.
- Put the new routes in their own module rather than in `src/server.ts` —
  rejected: `sendJson`, `readRequestBody` and every validation rule live in
  `server.ts`, and a separate module would either duplicate them or force new
  exports for no gain.
- `DELETE /api/integrations/installs/:toolId` with the scope in the query string
  — rejected: it would put a filesystem path in a URL, and a JSON body reuses
  the existing `readRequestBody` path unchanged.
- A single RPC endpoint taking a method name — rejected: every existing route in
  this server is a noun with an HTTP verb, and the RPC shape would be the only
  one of its kind.

## Final summary

Add five `/api/integrations/*` routes to `src/server.ts` over the existing
`src/lib/agentic-tools-*.ts` functions, five `fetch()` methods to
`browser-ipc-shim.ts`, and an existence guard in `home.ts`; the Electron path is
untouched. Three stages, roughly one sitting each, riskiest first. Top risks:
the permitted-root guard is a hand-mirror of the Electron handler's and can
drift; these routes write and delete real files on an unauthenticated server,
which the loopback gate exists to bound; and the shared install registry has no
concurrency protection on either transport. Three answers needed: whether to
serialize the mutating routes, whether to guard `checkInstalledSkills`'
`basePath` on the HTTP route only, and whether any shared or long-lived instance
of this server exists.
