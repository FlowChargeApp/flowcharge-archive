---
id: TL-50-5dft3e
type: tasklist
workstream: WS-50-wnvfyq
slug: security-hardening
title: "Security hardening — path handling, process robustness, resource limits"
status: done
created: 2026-08-21
updated: 2026-08-21
author: Anthony Koukoullis
depends_on: [IL-8-275q0s]
links: []
mode: spec
base_commit: 938e91e
---

# PRX Tasks

## Security hardening — path handling, process robustness, resource limits

This list implements the five open issues in IL-8-275q0s, filed from a security audit of the
Praxis Dashboard. The app is a local Kanban dashboard over `flowcharge/` data. It runs two ways:
as a plain Node HTTP server started by `npm start`, and as an Electron desktop app whose main
process imports that same compiled server module and opens a `BrowserWindow` against it.

The five issues fall into three groups. Two are path-trust defects: the Electron IPC bridge
writes and recursively deletes at a filesystem path the renderer supplies, and the tar reader
that unpacks the downloaded skill archive lets an entry name escape its target directory. One
is a process-robustness defect: the loopback port is a fixed constant that is never verified,
so a squatting process can both crash the app's listen call and be loaded into the window with
the preload bridge attached. One is a resource-limit defect: the skill archive is buffered and
decompressed with no cap, inside the Electron main process. One is a latent traversal defect in
the static file server's root guard.

Every task here corrects code that already exists. No task adds a feature, an option, a new
abstraction, or a new capability. Where an issue's own remediation notes suggest a mechanism
that is larger than the defect, the task takes the smaller correction and says so — see the
`## Divergences` section at the end of this file.

The project has no lint step and no `test` script. Its own commands are `npm run build`
(three `tsc` projects with `noEmitOnError: true`, then `node tools/copy-assets.mjs`) and the
`node --test dist/lib/*.test.js` pattern each test file documents in its own header. Those are
what the `verify` steps use.

- [x] 1. Validate renderer-supplied install paths in the Electron main process

  ```yaml
  description: "Make the installSelected and removeInstallation IPC handlers refuse any path that does not match a permitted root the main process derives for itself, instead of trusting the basePath and the registry resolvedPath the renderer originally chose."
  author: Anthony Koukoullis
  issues: [ISS-14-qwcmik]
  implement:
    - "In electron/agentic-tools-ipc-handlers.cts, extend the existing dynamic-import block inside registerAgenticToolsIpcHandlers so the main process can derive permitted roots on its own. Two additions only: add findInstallRecord to the destructured shape of the existing '../lib/agentic-tools-install-tracking.js' import, and add one new dynamicImport of '../lib/projects.js' for readProjects. Both compile to dist/lib, which is where every other specifier in that block already points. Add the matching module-level `let` bindings and the matching local function types beside the existing GetInstallContentFn / ParseInstallRegistryFn declarations — this file must keep getting its types from hand-mirrored local declarations, never from an import, per its own file-header comment."
    - "Add one module-private helper in the same file that answers, for a given toolId and InstallScope, what the single permitted root is. For a scope of kind 'project', the permitted root is scope.projectPath, and it is permitted only when it matches the `path` of an entry returned by readProjects(). For a scope of kind 'global', the permitted root is that tool's detection.resolvedConfigDir, recomputed here by calling detectAllTools(createNodeFsAccess(), mappedOs) and reading the entry at the tool's index in TOOL_CATALOGUE — the exact index alignment the existing detectTools handler already relies on at the TOOL_CATALOGUE.map call. Return null when no permitted root exists, so the caller can refuse rather than guess."
    - "In the ipcMain.handle('installSelected', ...) callback, before the getInstallContent call for each target, resolve target.basePath with path.resolve and compare it for exact equality against the resolved permitted root for that target's toolId and scope. On no match, return the handler's existing failure shape { ok: false, status: 400, error: ... } naming the rejected path, and do not call installToTarget for any target in the batch. Exact equality is the right comparison, not containment: the renderer's own resolveBasePathForScope in src/public/lib/agentic-tools-scope.ts returns exactly resolvedConfigDir or exactly projectPath, so a legitimate basePath is always equal to the permitted root, never merely inside it."
    - "In the ipcMain.handle('removeInstallation', ...) callback, before calling removeInstallation, read the registry the same way the getInstallStatus handler already does — fsWrite.readTextFile(registryPath) then parseInstallRegistry — and locate the record with findInstallRecord(records, toolId, scope). When no record exists, keep today's silent no-op behaviour, because removeInstallation already documents an idempotent remove. When a record exists, resolve its resolvedPath and refuse unless it sits under the permitted root for that (toolId, scope), comparing with a trailing path.sep boundary rather than a bare prefix. Only on a pass should removeInstallation run and reach the recursive fs.rm in createNodeFsWriteAccess's remove."
    - "Leave the checkInstalledSkills handler alone. It also takes a renderer-supplied basePath, but it only reads, and ISS-14-qwcmik is scoped to the write and delete sinks."
  pattern: "electron/agentic-tools-ipc-handlers.cts — registerAgenticToolsIpcHandlers, its dynamic-import block, and the installSelected and removeInstallation ipcMain.handle callbacks."
  imports: "node:path is already imported at the top of this file and is what path.resolve and path.sep come from. Everything else arrives through the existing dynamicImport helper, never a static import: findInstallRecord joins the existing '../lib/agentic-tools-install-tracking.js' destructure, and readProjects needs one new dynamicImport of '../lib/projects.js'. detectAllTools, createNodeFsAccess, TOOL_CATALOGUE, parseInstallRegistry, fsWrite and registryPath are already resolved into module-level bindings by this function and need no new wiring."
  compatibility: "This file must never import — value or type — from src/lib/*.ts at the top level. Its own file-header comment records both reasons, each confirmed by direct testing: electron/tsconfig.json emits .cts as CommonJS, so a value import becomes a require() that throws ERR_REQUIRE_ESM against the ESM output of src/lib; and electron/tsconfig.json's narrow rootDir of '.' makes even an `import type` fail with TS6059 at emit. So the new readProjects binding needs a hand-mirrored local type (a ProjectEntry-shaped interface with at least a `path: string`) declared beside the existing mirrored types, and the value must come through dynamicImport. The dynamicImport helper is deliberately built with `new Function('specifier', 'return import(specifier)')` so tsc's CommonJS downlevel never rewrites it into a require(); do not replace it with a literal import(). Specifiers stay relative to the compiled dist/electron/ location, not to this source file. The handlers' return type is PraxisIpcResult<T>, whose failure arm is exactly { ok: false; status: number; error: string }."
  gotcha: "readProjects() reads .praxis-projects.json out of PRAXIS_DATA_DIR when that variable is set, and electron/main.cts sets it only when app.isPackaged. Packaged and unpackaged runs therefore see different registries; the permitted-root check must read the registry at call time rather than caching a list at registration time, or a project added during the session is wrongly refused. detectAllTools touches the filesystem for every catalogue tool, so calling it once per batch is right and calling it once per target is wasteful — but do not cache it across IPC calls either, because a tool installed mid-session must become permitted. The scope object arrives over IPC and is structurally typed only; treat an unrecognised scope kind as no permitted root rather than falling through. The containment assertion on the final joined write path inside installToTarget is deliberately NOT part of this task — it belongs to task 4.2, see Divergence 1 — so do not add one here and do not edit src/lib/agentic-tools-install.ts from this task."
  verify:
    - "npm run build — the electron/tsconfig.json project must compile with no TS6059 and no ERR_REQUIRE_ESM-shaped static import introduced."
    - "node --test dist/lib/agentic-tools-install-tracking.test.js dist/lib/projects.test.js — confirms the two modules this task newly depends on still behave as their unit tests expect."
  checklist:
    - "An install whose basePath is not the tool's own detected global config directory, and is not a registered project root, is refused before any file is written."
    - "A remove whose registry resolvedPath lies outside the permitted root for its (toolId, scope) is refused before fs.rm runs, and a remove for a tool with no registry record still returns success without throwing."
    - "A legitimate install and a legitimate remove, driven from the Integrations panel exactly as before, still succeed with the same results."
    - "electron/agentic-tools-ipc-handlers.cts still contains no static import from src/lib, value or type, and the build produces no stray dist/src/lib tree."
    - "No caller of installToTarget or removeInstallation in src/lib had its signature changed by this task."
  self_eval:
    passed: true
    failures: []
  ```

- [x] 2. Bind the local server to a port the app owns, and load only that server

  ```yaml
  description: "Stop the fixed loopback port from being both an unhandled crash path and a way for a squatting process to be loaded into the Electron window with the preload bridge attached."
  ```

  - [x] 2.1 Report the bound port and handle a failed listen in src/server.ts

    ```yaml
    description: "Give src/server.ts a handled error path for a failed bind, and let a consumer learn the port the server actually bound instead of assuming the 4173 default."
    author: Anthony Koukoullis
    issues: [ISS-15-8a4w1p]
    implement:
      - "In src/server.ts, at the module-level `server.listen(port, host, () => { ... })` call that is the module's only startup side effect, attach an error listener to the same `server` binding. Today there is none, so an EADDRINUSE from listen becomes an uncaught exception in whatever process imported this module — including the Electron main process, which imports the compiled module for exactly this side effect."
      - "Export from src/server.ts a single promise that settles with the outcome of that listen: it resolves with the port number the server actually bound, read from server.address() inside the existing listen callback, and it rejects with the error the new error listener receives. One export, because readiness and the bound port are the same fact and a consumer needs both. The module keeps its current behaviour when nobody imports the export — `npm start` still logs and serves exactly as it does now."
      - "Keep the existing `const port = process.env.PORT ? Number(process.env.PORT) : 4173;` line as it is. It is already the seam a consumer uses to ask for a different port, so no new configuration knob is needed or wanted here; task 2.2 uses it. Note that when PORT is 0 the OS assigns an ephemeral port, which is precisely why the bound port must be read back from server.address() rather than from this constant."
      - "Leave the existing listen-callback console.log and the isLoopbackHost warning block untouched. They are unrelated to this defect."
    pattern: "src/server.ts — the module-level `const server = http.createServer(...)` binding, the `server.listen(port, host, () => { ... })` call, and the `const port = ...` constant near the top."
    imports: "No new imports. http, fs, path and fileURLToPath are already imported at the top of the file, and server.address() plus the 'error' event are on the http.Server instance the file already holds."
    compatibility: "src/server.ts compiles under the root tsconfig.json with module/moduleResolution 'node16', strict true and noEmitOnError true, into ESM at dist/server.js — ESM because the root package.json sets \"type\": \"module\". Adding a named export keeps that ESM shape, which is what electron/main.cts's genuine native dynamic import already loads. server.address() is typed as string | AddressInfo | null under @types/node, so under strict mode the port must be narrowed rather than asserted. The module must stay side-effect-started: electron/main.cts's comment records that no exported start function exists, and this task does not add one — the listen call still runs on module evaluation."
    gotcha: "An exported promise that can reject creates an unhandled-rejection risk for `npm start`, where nothing awaits it; attach a no-op catch at the point of creation, or otherwise make the rejection safe to ignore, so a bind failure under `npm start` still surfaces through the error listener rather than as an unhandled rejection warning. server.address() returns null until the socket is actually listening, so it must be read inside the listen callback and never at module scope. When host is '0.0.0.0' via the start:lan script, address() reports that host, so the consumer must build its URL from the port and its own loopback assumption rather than echoing address().address back. The 'error' event can fire for causes other than EADDRINUSE, such as EACCES on a privileged port, so do not narrow the handler to one code."
    verify:
      - "npm run build — the root tsconfig.json project must compile clean under strict and noEmitOnError."
      - "npm start, then confirm the process logs its running URL and stays up; stop it. This proves the added export and error listener did not disturb the module's existing side-effect startup."
    checklist:
      - "A failed bind is delivered to a handler and no longer becomes an uncaught exception in the importing process."
      - "A consumer that imports the module can learn the port the server actually bound, including when the OS assigned it."
      - "npm start still serves on the same default port with the same log output as before this change."
      - "No exported start function was added and the listen call still runs as a module-evaluation side effect."
      - "A bind failure under npm start does not produce an unhandled promise rejection."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.2 Load the window from the app's own bound port in electron/main.cts

    ```yaml
    description: "Have the Electron main process ask for an ephemeral port, learn the port its own server bound, and load the window from that, instead of assuming anything answering on the fixed 4173 is this app's server."
    author: Anthony Koukoullis
    issues: [ISS-15-8a4w1p]
    implement:
      - "In electron/main.cts, inside the app.whenReady() callback, set process.env.PORT to '0' immediately before the `await dynamicImport('../server.js')` line, next to the existing `if (app.isPackaged) { process.env.PRAXIS_DATA_DIR = ... }` block. This mirrors that block exactly: the main process is the only place that knows it wants a private port, and src/server.ts's existing PORT read is already the seam for saying so. Asking the OS for an ephemeral port is what removes the squat premise entirely — a port this process was just handed cannot already be held by someone else."
      - "Capture the namespace returned by that dynamicImport call, which is discarded today, and await the readiness promise task 2.1 exports from src/server.ts. Build the window URL from the port it resolves with. The SERVER_URL constant, currently exported and hardcoded to 'http://127.0.0.1:4173', no longer describes anything true once the port is ephemeral; replace it with a value derived at runtime and pass that URL into createWindow rather than having createWindow read a module constant."
      - "Remove the waitForServer function and the POLL_INTERVAL_MS / POLL_TIMEOUT_MS constants it uses. Its blind HTTP poll is the second half of this defect: it treats any response on the port as proof this app's server is running, and it never checks who answered. Awaiting the app's own server's readiness is both stricter and simpler — the process that resolved the promise is by construction this app's server."
      - "Keep the failure path. Wrap the readiness await in the same try/catch that wraps waitForServer today, and keep the dialog.showErrorBox followed by app.quit() and return. Update its message so it no longer names a fixed URL and timeout that no longer exist."
      - "Leave createWindow's webPreferences exactly as they are — contextIsolation true, nodeIntegration false, sandbox true, and the preload path. Do not add a will-navigate handler or a setWindowOpenHandler: the issue's expected outcome asks only that the window load a page served by this app's own server, verified rather than assumed, and this task delivers that. Navigation restriction is separate hardening and is out of scope here."
    pattern: "electron/main.cts — the SERVER_URL constant, the waitForServer function with POLL_INTERVAL_MS and POLL_TIMEOUT_MS, the createWindow function, and the app.whenReady() callback body."
    imports: "The node:http import at the top of this file exists only to serve waitForServer's http.get poll; once waitForServer is removed it becomes unused and must be dropped, or the electron/tsconfig.json build will carry a dead import. node:path stays — createWindow still uses path.join for the preload path. The readiness value comes from the namespace object the existing dynamicImport returns, typed at the call site with a local cast in the same style as the `as { ... }` casts in electron/agentic-tools-ipc-handlers.cts's dynamic-import block."
    compatibility: "Same hard constraint as task 1: electron/tsconfig.json compiles .cts to CommonJS with a narrow rootDir, so this file must not gain a static import — value or type — from src/lib or src/server.ts. The port must be read from the awaited value at runtime and typed with a hand-written local shape, never with an `import type` from src/server.ts. The dynamicImport helper's `new Function` construction is load-bearing and must not be replaced with a literal import(); the file's own comment explains that tsc's CommonJS downlevel would otherwise rewrite it into a require() that throws ERR_REQUIRE_ESM against the ESM dist/server.js. SERVER_URL is currently exported; check for any other consumer before removing or changing its shape."
    gotcha: "Ordering is delicate. process.env.PORT must be set before the dynamicImport, because src/server.ts reads it at module evaluation and listens immediately; setting it afterwards has no effect. The registerIpcHandlers() call that follows uses a loopback HTTP relay to the server — confirm what URL or port that path resolves, because an ephemeral port must reach it too, and a relay still pointing at a hardcoded 4173 would break the moment the port moves. Setting PORT here affects only the Electron process, not `npm start`, which is why the default stays 4173 for the plain server. The Electron main process is CommonJS, so top-level await is unavailable; the await must stay inside the existing async app.whenReady() callback. Because the failure path is now a rejected promise rather than a poll timeout, an unawaited readiness promise would surface as an unhandled rejection instead of the error dialog — keep it inside the try."
    verify:
      - "npm run build — the electron/tsconfig.json project must compile clean with no unused-import or TS6059 error."
      - "npm run electron:dev — the window must open showing the dashboard, which proves the ephemeral port was bound, reported, and loaded end to end."
    checklist:
      - "The window loads a URL whose port this app's own server reported binding, not a compile-time constant."
      - "Occupying 127.0.0.1:4173 with an unrelated process no longer affects the Electron app's startup at all."
      - "A server that fails to start still produces the error dialog and quits, rather than an uncaught exception or a hung window."
      - "The loopback IPC relay used by registerIpcHandlers still reaches the server on its new port."
      - "createWindow's webPreferences are unchanged and no navigation handler was added."
    self_eval:
      passed: true
      failures: []
    ```

- [x] 3. Cap the skill archive before buffering and before decompressing

  ```yaml
  description: "Stop getInstallContent from buffering an unbounded response and decompressing it with no output limit inside the Electron main process."
  author: Anthony Koukoullis
  issues: [ISS-16-oqvwh2]
  implement:
    - "In src/lib/skill-content-fetch.ts, in getInstallContent, replace the unconditional `const gz = Buffer.from(await res.arrayBuffer());` with a bounded read. res.arrayBuffer() buffers whatever the server sends with no cap at all, so the cap has to be applied while reading, not after. Consult the Content-Length header first and fail fast when it already exceeds the cap, then read res.body's stream with a running byte total and abort as soon as the total passes the cap — a Content-Length check alone is not sufficient, because a chunked response carries no such header."
    - "Give the `const tarBuf = gunzipSync(gz);` call on the next line a maxOutputLength option. Without it a small archive that expands to gigabytes is decompressed in full before anything notices."
    - "Declare both limits as two named module-level constants near the existing PRAXIS_REPO_BASE_URL and PRAXIS_REPO_REF constants, with a comment recording that the real archive is a git-archive tarball of a skills directory and is orders of magnitude smaller than either. Suggested values are 64 MiB compressed and 256 MiB decompressed; they are generous headroom, not tuning."
    - "Both failures must throw an Error whose message names the limit that was exceeded, matching the style of the existing `throw new Error(\\`Failed to fetch Praxis skill archive: ...\\`)` a few lines above, so the IPC layer's catch turns it into the same ok:false result any other fetch failure produces. Illustrative shape, not literal text: `throw new Error(\\`Praxis skill archive exceeds ${MAX_ARCHIVE_BYTES} bytes\\`)`."
    - "Do not change gunzipSync to an asynchronous call. The issue's expected outcome asks for caps so an oversized archive fails fast; converting the decompression to async is a larger change to this module's contract and is not part of this correction."
  pattern: "src/lib/skill-content-fetch.ts — getInstallContent, specifically the fetch/arrayBuffer/gunzipSync sequence, plus two new constants beside PRAXIS_REPO_BASE_URL and PRAXIS_REPO_REF."
  imports: "gunzipSync is already imported from node:zlib at the top of the file and its options argument is the only change needed there. The bounded read uses res.body, a web ReadableStream on the global fetch Response, which needs no import. Buffer is a Node global and is already used in this file, including in parseTar. Add no new dependency."
  compatibility: "This module compiles under the root tsconfig.json with strict true, target es2022, lib es2022 and types ['node'], so global fetch and Response come from the Node typings rather than DOM lib — res.body is ReadableStream<Uint8Array> | null and must be null-checked under strict mode. maxOutputLength is a ZlibOptions field supported by Node 18 and above, matching the engines field in package.json; when exceeded, gunzipSync throws ERR_BUFFER_TOO_LARGE rather than returning a truncated buffer. parseTar downstream takes a Buffer, so whatever the bounded read accumulates must be concatenated into a real Buffer before gunzipSync, exactly as Buffer.from(await res.arrayBuffer()) produces one today. getInstallContent must stay structurally assignable to the GetInstallContent port in agentic-tools-content.ts and to the GetInstallContentFn type mirrored in electron/agentic-tools-ipc-handlers.cts — its signature must not change."
  gotcha: "Aborting mid-stream leaves the connection open unless the reader is cancelled; cancel the reader (or abort the request) on the over-limit path rather than just breaking out of the loop. Node's own maximum buffer length is smaller than some platforms' available memory, so a cap above it fails with a less useful error than the explicit check — keep the constants well below it. The caps must be tight enough to matter but never tighter than the real archive, which grows as skills are added; a cap set too close to today's size turns a routine skill addition into a hard install failure. The existing test at src/lib/skill-content-fetch.test.ts fetches the live archive over the network from PRAXIS_REPO_BASE_URL, so that file's suite cannot pass offline — a failure there when disconnected is not a regression from this task."
  verify:
    - "npm run build — the root tsconfig.json project must compile clean under strict, including the null check on res.body."
    - "node --test dist/lib/skill-content-fetch.test.js — the parseTar and parseSkillFrontmatter tests must pass; the getInstallContent test additionally requires network reachability to PRAXIS_REPO_BASE_URL and must pass when connected, proving the bounded read still fetches the real archive intact."
  checklist:
    - "The real skill archive still fetches, decompresses, and yields the same skills it did before this change."
    - "A response larger than the compressed cap fails with an error naming the limit, without the whole body being buffered first."
    - "A response whose decompressed size exceeds the output cap fails instead of being decompressed in full."
    - "getInstallContent's signature is unchanged and it remains assignable to the GetInstallContent port and the mirrored GetInstallContentFn."
    - "No new package dependency was added to package.json."
  self_eval:
    passed: true
    failures: []
  ```

- [x] 4. Stop a tar entry name from escaping its target directory

  ```yaml
  description: "Close the tar-slip path: the entry-segment check that misses backslashes, and the write sink that builds the final path by concatenation with no containment assertion."
  ```

  - [x] 4.1 Tighten the tar entry segment check in src/lib/skill-content-fetch.ts

    ```yaml
    description: "Make isExcluded reject a path segment that carries its own separators or upward traversal, not only one that starts with a dot."
    author: Anthony Koukoullis
    issues: [ISS-17-78kw69]
    implement:
      - "In src/lib/skill-content-fetch.ts, rewrite the body of isExcluded. It currently returns true only for a name starting with '.', starting with '.git', or ending with '.zip'. The leading-dot rule happens to block a bare '..' segment on POSIX, but nothing in the function inspects the interior of a segment, so a segment such as 'sub\\..\\..\\..\\evil.md' passes every rule because it starts with 's'."
      - "Add rejection of any segment that contains a backslash, contains a forward slash, contains a colon, or is exactly '..'. Keep the three existing rules — they are the vendoring exclusions this function was written for and are still wanted. The new rules are a containment guard on the segment's own shape, which is what is missing."
      - "The function's contract is unchanged: it takes one already-split path segment and answers whether to skip it. Keep it a pure predicate with the same signature. Its only caller is the `segments.some((seg) => isExcluded(seg))` guard inside getInstallContent, which needs no change."
      - "Update the function's comment. It currently says the three rules are the vendoring exclusions re-applied as a defensive second pass; it must now also say the segment-shape rules exist because segments reach a write sink that joins them onto a base path."
    pattern: "src/lib/skill-content-fetch.ts — the isExcluded function and its preceding comment; its single call site is the segments.some(...) guard in getInstallContent."
    imports: "No new imports. This stays a pure string predicate — do not reach for node:path here, because these are archive entry segments in the archive's own forward-slash grammar, not host filesystem paths, and normalising them with the host's separator rules is what lets a Windows-shaped segment slip through on a POSIX build machine."
    compatibility: "Compiles under the root tsconfig.json with strict true and noEmitOnError true. The guard runs on segments produced by splitting on '/' after the archive's single top-level directory is stripped, so a segment can legitimately contain dots, dashes and underscores — skill ids and file names such as 'CONVENTIONS.md' and 'prx-index.mjs' must all still pass. The same segment list also yields skillId at index 0, so tightening here covers the skill id too, which is the second half of what the issue describes."
    gotcha: "Reject a colon as well as the separators: on Windows a segment such as 'C:evil' is a drive-relative path, not a plain name. Do not reject a leading '.' more broadly than today and do not start rejecting a dot anywhere in the segment, or every '.md' file in the archive disappears and getInstallContent silently returns skills with no files. This guard alone does not make the write safe — a segment could still be legal here and the joined path still be wrong — which is why task 4.2 adds the containment assertion at the sink; the two are complementary and both are required. The archive is real and live, so an over-tight rule here shows up as missing skills rather than as an error."
    verify:
      - "npm run build — the root tsconfig.json project must compile clean."
      - "node --test dist/lib/skill-content-fetch.test.js — the offline parseTar and parseSkillFrontmatter tests must pass, and when network is available the live getInstallContent test must still return the full set of skills with their nested files, proving no legitimate segment became excluded."
    checklist:
      - "A tar entry segment containing a backslash, a forward slash, or a colon, or equal to '..', is skipped."
      - "Every legitimate skill id and nested file name in the real archive still passes the guard, and the skill set getInstallContent returns is unchanged."
      - "isExcluded still takes one segment and returns a boolean, and its only call site is unchanged."
      - "The guard applies to the skill id segment as well as to the nested file segments."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 4.2 Assert the final write path stays under basePath in installToTarget

    ```yaml
    description: "Resolve the joined write path in installToTarget and refuse to write when it escapes the target's basePath, instead of concatenating and trusting the result."
    author: Anthony Koukoullis
    issues: [ISS-17-78kw69]
    implement:
      - "In src/lib/agentic-tools-install.ts, in the write loop inside installToTarget, the line `const fullPath = `${target.basePath}/${write.relativePath}`;` builds the write target by raw string concatenation, and the next line derives the directory from it with a regular expression before calling deps.fsWrite.mkdir and deps.fsWrite.writeTextFileAtomic. Nothing between the concatenation and the write asserts that the result is still inside target.basePath."
      - "Resolve both target.basePath and the joined path, then assert the resolved joined path is inside the resolved base — compared with a trailing separator boundary, not a bare string prefix, so a sibling directory whose name merely begins with the base's name is not accepted. On a failure, throw an Error naming the offending relativePath and stop the loop; a partial install that already wrote earlier files is acceptable here, because the tracking record is written only after the loop and so is never recorded for content that escaped."
      - "Keep the existing derivation of `dir` and the existing mkdir/writeTextFileAtomic calls, and keep resolvedPath being set from the first write. The assertion is a gate in front of the write, not a rewrite of the loop."
      - "Do not touch removeInstallation in this file. Validating the registry resolvedPath before the recursive delete belongs to task 1, which does it in the Electron main process where the permitted roots are known."
    pattern: "src/lib/agentic-tools-install.ts — the `for (const write of writes)` loop inside installToTarget, between the fullPath computation and the deps.fsWrite.mkdir call."
    imports: "Add `import path from 'node:path';` at the top of the file. This module currently imports only from its own siblings and holds no node: import at all, by design — it reaches the filesystem exclusively through the injected FsWriteAccess port. node:path is a pure path-algebra module and touches no filesystem, so it does not breach that boundary; its sibling src/lib/agentic-tools-fs-adapter.ts already imports node:path for the same reason."
    compatibility: "This file's own header records the rule it must keep: it must never import node:fs or node:fs/promises directly, only the injected FsWriteAccess port. The assertion must therefore be pure path algebra with no stat and no existence check. Compiles under the root tsconfig.json, strict true, noEmitOnError true, emitting ESM. installToTarget's signature and its InstallResult return shape must not change — electron/agentic-tools-ipc-handlers.cts mirrors both by hand as InstallToTargetFn with no compiler check tying them together, so a signature change would break silently at runtime rather than at build. The existing unit tests in src/lib/agentic-tools-install.test.ts drive installToTarget with POSIX basePaths such as '/home/fakeuser/.claude' against a fake FsWriteAccess, so the assertion must accept those unchanged."
    gotcha: "path.resolve applies the host platform's rules, so on Windows it treats a backslash as a separator and on POSIX it does not — that asymmetry is the whole reason a POSIX-built check can look correct while the Windows write escapes. Resolve the joined path rather than normalising the relative part alone. relativePath values come from formatForTarget's pathTemplate substitutions in src/lib/agentic-tools-format.ts, where skillDirectoryWrites builds them as `${dir}/${file.relativePath}` from the skill's own files, so an escaping segment that got past task 4.1 arrives here already embedded in a longer path — assert on the final joined result, not on the fragment. Do not switch the fullPath construction to path.join wholesale: the derivation of `dir` immediately below uses a forward-slash regular expression, and a path.join result on Windows would no longer match it. Task 4.1 must land with this one; either alone leaves the issue only half corrected."
    verify:
      - "npm run build — the root tsconfig.json project must compile clean."
      - "node --test dist/lib/agentic-tools-install.test.js dist/lib/agentic-tools-format.test.js — the existing install lifecycle and formatting tests must all still pass with their POSIX basePaths."
    checklist:
      - "A write whose joined path resolves outside the target's basePath throws instead of writing."
      - "A sibling directory whose name merely begins with basePath's name is rejected, not accepted."
      - "Every legitimate skill-directory and rule-directory write in the existing unit tests still succeeds unchanged."
      - "installToTarget's signature and InstallResult shape are unchanged, so the hand-mirrored InstallToTargetFn in electron/agentic-tools-ipc-handlers.cts still matches."
      - "The file still imports no node:fs or node:fs/promises and still writes only through the injected FsWriteAccess port."
    self_eval:
      passed: true
      failures: []
    ```

- [x] 5. Give the static file server's root guard a separator boundary

  ```yaml
  description: "Replace the raw prefix comparison that guards the static file branch, so a sibling directory whose name merely begins with the served root's name is no longer treated as inside it."
  author: Anthony Koukoullis
  issues: [ISS-18-47kypg]
  implement:
    - "In src/server.ts, inside the http.createServer request callback, the guard `if (!filePath.startsWith(root)) { ... 403 ... }` compares two strings with no separator boundary. root is `path.join(__dirname, 'public')`, and filePath is `path.join(root, reqPath === '/' ? '/index.html' : reqPath)`. path.join collapses '..' first, so a genuine escape is already rejected, but any sibling under dist whose name begins with the characters 'public' satisfies the comparison — a request for '/../public-backup/a.txt' resolves to dist/public-backup/a.txt and passes."
    - "Change the guard so it only admits a path that is genuinely inside root. Either compare against root plus path.sep, or compute path.relative(root, filePath) and reject a result that is absolute or begins with '..'. Whichever form is used, filePath must still equal root itself for no case that matters — every served request appends at least a file name — so the boundary form is sufficient and the simpler of the two."
    - "Keep the surrounding behaviour exactly: the 403 response with the literal body 'Forbidden', its position ahead of the `reqPath.startsWith('/api/')` branch, and the fs.readFile call and MIME lookup below."
  pattern: "src/server.ts — the http.createServer callback, specifically the traversal guard immediately after the reqPath and filePath computations and before the '/api/' branch."
  imports: "No new imports. path is already imported at the top of src/server.ts and supplies both path.sep and path.relative; root is already computed there as path.join(__dirname, 'public')."
  compatibility: "Compiles under the root tsconfig.json, strict true, noEmitOnError true, emitting ESM at dist/server.js. The guard runs before the '/api/' dispatch, so it must keep admitting every '/api/...' request — those paths join under root harmlessly and are handed to handleApi immediately after, and a guard that started rejecting them would take the whole API down. reqPath comes from decodeURIComponent(req.url!.split('?')[0]), so it is already percent-decoded when it reaches path.join. On Windows path.sep is a backslash, which is another reason to use path.sep rather than a hardcoded '/'."
  gotcha: "There is no exploitable impact today — dist holds only electron, lib, public, scripts and server.js, so no 'public'-prefixed sibling exists — which means a mistake here will not announce itself as a broken feature; the only proof is that legitimate assets still serve and the sibling shape is refused. Task 2.1 also edits src/server.ts, at the listen call near the end of the file, a different anchor from this one; if both land in one pass, apply them independently rather than merging them. Do not add a separate check on reqPath: path.join has already collapsed the traversal by the time filePath exists, so guarding the raw request path duplicates work and would reject legitimate encoded paths."
  verify:
    - "npm run build — the root tsconfig.json project must compile clean."
    - "npm start, then load the dashboard home page in a browser and confirm the page, its stylesheet, its scripts and its icons all load with no 403 and no 404. This proves the tightened guard still admits every real asset under dist/public."
  checklist:
    - "A path that resolves to a sibling of the served root whose name begins with 'public' is refused with 403."
    - "Every asset actually served from dist/public still loads, including nested paths."
    - "Every '/api/...' request still reaches handleApi and is unaffected by the guard."
    - "The 403 response body and the guard's position ahead of the '/api/' branch are unchanged."
    - "The guard uses path.sep or path.relative rather than a hardcoded forward slash, so it holds on Windows too."
  self_eval:
    passed: true
    failures: []
  ```

## Divergences

1. **Overlapping remediation for the installToTarget write sink.** Two issues name the same
   anchor. ISS-14-qwcmik's description says the joined write path has "no canonicalisation" and
   "no containment assertion against basePath", and ISS-17-78kw69's notes ask to "resolve and
   assert the final write path in installToTarget". Both point at the write loop in
   `src/lib/agentic-tools-install.ts`, read at lines 90-96 in this session, where
   ``const fullPath = `${target.basePath}/${write.relativePath}`;`` is followed directly by the
   mkdir and write calls. The containment assertion is authored once, in task 4.2, under
   ISS-17-78kw69, because that issue is specifically about a relative path escaping its base.
   Task 1, under ISS-14-qwcmik, covers the other half of that issue: the trust boundary for
   `basePath` itself, in the Electron main process. The consequence is that neither task fully
   satisfies its own issue's stated expectation alone — ISS-14-qwcmik is only closed once task 1
   and task 4.2 have both landed.

2. **ISS-15-8a4w1p's startup-nonce remediation is not adopted.** The issue's notes propose to
   "bind an ephemeral port in src/server.ts, pass the chosen port back to electron/main.cts
   instead of the shared constant, and have waitForServer verify a startup nonce the server
   echoes before loadURL runs." Tasks 2.1 and 2.2 take the first two parts and drop the third.
   Once `electron/main.cts` sets PORT to 0 and awaits the readiness promise that
   `src/server.ts`'s own listen callback resolves, the process that reports the port is by
   construction this app's server, so there is no second party for a nonce to distinguish. The
   nonce would be new protocol machinery guarding a premise the ephemeral bind has already
   removed. The consequence is that no nonce is authored anywhere in this list, and the issue's
   expectation that the window "loads only a page served by this app's own server, verified
   rather than assumed" is met by the readiness handshake instead.

3. **The project has no lint step and no test script.** `package.json`, read at commit 938e91e,
   defines `build`, `start`, `start:lan`, `refresh`, `electron:dev` and three `package:*`
   scripts, and no `test` or `lint` script; there is no ESLint, Prettier, Vitest or Jest
   configuration in the repository root, and no CI configuration. Unit tests do exist as
   `src/lib/*.test.ts` files, each documenting in its own header that it is run with
   `node --test dist/lib/<name>.test.js` after `npm run build`. The consequence is that every
   task's primary `verify` step is `npm run build`, which type-checks all three `tsc` projects
   with `noEmitOnError: true`, and follow-up steps name the specific compiled test files
   affected rather than a suite command that does not exist.

4. **The one existing test for `src/lib/skill-content-fetch.ts` needs the network.** The test
   at `src/lib/skill-content-fetch.test.ts`, read in this session, includes a case that fetches
   the live archive from `PRAXIS_REPO_BASE_URL` — the self-hosted Gitea host that
   `src/lib/skill-content-fetch.ts` declares at line 38. The consequence is that the `verify`
   steps for tasks 3 and 4.1 flag that file's suite as passing only when that host is
   reachable, and record that an offline failure of that one case is not a regression caused by
   the task.

Every other file cited by the issue list matched the line references recorded there when read
at commit 938e91e.
