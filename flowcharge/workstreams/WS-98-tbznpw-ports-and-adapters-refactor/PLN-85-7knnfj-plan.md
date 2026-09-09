---
id: PLN-85-7knnfj
type: plan
workstream: WS-98-tbznpw
slug: ports-and-adapters-refactor
title: "Ports and adapters refactor with test folder restructure"
status: done
created: 2026-09-09
updated: 2026-09-09
depends_on: []
links: []
---

# Ports and adapters refactor with test folder restructure

## Summary

Restructure `praxis-dashboard` (product FlowCharge) into a ports-and-adapters architecture
across the four boundaries WS-98-tbznpw names: the `flowcharge/` markdown store, the project
registry `.praxis-projects.json`, the HTTP layer `src/server.ts`, and the CLI entry point
`tools/package-cli.mjs` / `dist/cli-entry.js`. The chosen approach is **interfaces first,
adapters in place**: declare each port as a TypeScript interface under a new `src/ports/`,
put the application orchestration behind those ports in a new `src/core/`, move the HTTP
transport into a new `src/http/`, and leave the existing driven-adapter implementations at
their current `src/lib/` paths. That last constraint is not taste. `electron/agentic-tools-ipc-handlers.cts:335-359`
resolves eight `src/lib` modules through untyped dynamic-import strings such as
`'../lib/projects.js'`, and `electron/main.cts:78` resolves `'../server.js'` the same way;
`tsc` cannot check those strings and the WS-97-7fvoc0 boundary suite does not cover the
Electron path, so a file move there would break silently.

The same workstream folds in the test-folder restructure into `src/test/boundary/` and
`src/test/unit/`. It runs first, as Stage 1, so every later stage is verified once, in the
final layout.

No user-visible behavior changes anywhere in this workstream. Every route, status code,
payload shape, log line and on-disk file format is preserved byte for byte.

## Scope

### Acceptance criteria

1. `npm test` reports the same test names and the same pass count as the baseline captured before Stage 1, at the end of every stage.
2. No `.test.ts` file remains beside production code; every one lives under `src/test/boundary/` or `src/test/unit/`.
3. The five WS-97-7fvoc0 files keep every assertion unchanged — only import specifiers and `__dirname`-derived path constants differ.
4. `src/server.ts` holds only the composition root: no route handler, no validation predicate, and no direct `src/lib` import beyond the adapter factories it wires.
5. The board payload and the workstream detail reach HTTP only through the `WorkstreamStore` port, and `.praxis-projects.json` is read and written only through the `ProjectRegistry` port.
6. `dist/server.js` still starts the server as a module side effect and still exports `serverReady`, so `electron/main.cts`, `dist/cli-entry.js` and `src/test/boundary/server-harness.ts` start it exactly as they do today.
7. `dist/lib/projects.js`, `dist/lib/agentic-tools-*.js`, `dist/lib/skill-content-fetch.js`, `dist/lib/update-check.js` and `dist/lib/update-prefs.js` keep their paths and their named exports, so every dynamic-import specifier in `electron/agentic-tools-ipc-handlers.cts` and `electron/update-check-ipc-handlers.cts` keeps resolving.
8. A binary built by `npm run package:cli` answers `/api/version`, `/api/projects` and `GET /` exactly as `cli-binary.test.ts` asserts, with `PRAXIS_APP_VERSION` and `PRAXIS_DATA_DIR` set and unset.

### Out of scope

- WS-99-qxgzip's domain-logic unit test suite. This workstream adds no new test cases at all.
- WS-100-t1os8w's telemetry work.
- The Electron adapters `electron/main.cts`, `electron/preload.cts` and the four `*-ipc-handlers.cts` modules. Their contracts are preserved; their internals are not touched.
- Unifying the hand-mirrored permitted-root logic that `src/server.ts:242-266` and `electron/agentic-tools-ipc-handlers.cts:284-309` both carry.
- The browser code under `src/public/`, the release scripts under `.github/scripts/`, and `src/scripts/extract-praxis-data.ts`.
- Any change to a route path, status code, payload field, log line, on-disk file format or environment variable name.

### Assumptions

- **A1.** There is no production data and there are no live users to protect. `DEVELOPMENT.md` states no release has been cut, and the app's whole state is three JSON files under `PRAXIS_DATA_DIR` whose formats this workstream does not touch. The workstream record says a first public release shipped and `README.md` carries a 0.1.0 badge and a Releases link, so the two sources disagree; the conclusion holds either way, because this workstream changes no on-disk format and so puts no live user at risk.
- **A2.** No feature flag or dark launch is needed. Nothing user-visible changes, so "shippable mid-feature" is satisfied by each stage leaving `npm run build`, `npm start`, `npm test` and `npm run package:cli` working.
- **A3.** Rollback is `git revert` of the stage's commit. There is no migration and no data change, so rollback is clean at every point.
- **A4.** `src/server.test.ts` and `src/server-env-seams.test.ts` go to `src/test/unit/`. The workstream record assigns `src/test/unit/` "any other `foo.ts`/`foo.test.ts` pairs outside the boundary set", and these two are the `server.ts` pair. Both in fact drive the server over a socket or a child process; a later `git mv` can reclassify them.
- **A5.** `src/lib/fixture-project.ts` moves to `src/test/fixture-project.ts`. It is a test helper, not production code, and it is imported by one boundary suite and two unit suites, so it belongs at the shared parent of both folders rather than inside either.
- **A6.** Stages 2 and 6 close with a manual `npm run electron:dev` smoke check — list projects, open a board, open a workstream modal, open Manage integrations. Those two stages touch code the Electron adapters reach, and no automated test covers that path.
- **A7.** The six free-function exports of `src/lib/projects.ts` are kept as a compatibility shim over the new adapter, because `electron/agentic-tools-ipc-handlers.cts:343` imports `readProjects` from it by name at runtime. Removing them is not part of this workstream.

## Design

### The four ports

Interfaces live in a new `src/ports/` folder and contain types only — no `node:fs`, no
`node:http`, no `process.env`. Every ambient payload type (`ProjectEntry`, `ProjectList`,
`PraxisData`, `BoardPayload`, `PraxisWorkstreamDetail`) is already global from
`src/types/praxis-data.d.ts` and is referenced unqualified, exactly as `src/lib/projects.ts:33`
and `src/server.ts:701` reference them today.

**`src/ports/project-registry.ts`** — the driven port for `.praxis-projects.json`.

```ts
export interface ProjectRegistry {
  list(): ProjectEntry[];
  find(id: string): ProjectEntry | undefined;
  add(absPath: string): { entry: ProjectEntry; created: boolean };
  remove(id: string): ProjectEntry | undefined;
  rename(id: string, name: string): ProjectEntry | undefined;
}

export interface ProjectRegistryConfig {
  dataDir: string;   // where .praxis-projects.json lives
  repoRoot: string;  // the self-entry's path
  packaged: boolean; // suppresses the self-entry on a missing file
}
```

**`src/ports/workstream-store.ts`** — the driven port for the `flowcharge/` markdown store.
`LayoutGeneration` and `TreeLayout` move here from `src/lib/tree-layout.ts:13-19`, and
`tree-layout.ts` imports them back, so the port owns the type and the adapter implements it.

```ts
export type LayoutGeneration = 'flowcharge' | 'prxwork';
export interface TreeLayout { dir: string; generation: LayoutGeneration; legacy: boolean; }

export interface WorkstreamStore {
  resolveLayout(projectRoot: string): TreeLayout | null;
  hasTree(projectRoot: string): boolean;
  readBoard(projectRoot: string): PraxisData;                                   // throws when no tree
  readDetail(projectRoot: string, workstreamId: string): PraxisWorkstreamDetail | null;
  readBranch(projectRoot: string): string | null;
}
```

**`src/ports/app-api.ts`** — the driving port. It is what the HTTP adapter and the CLI
adapter reach the application through, and it is where the current route handlers' branch
decisions become data. Statuses stay in the HTTP adapter; the core returns variants.

```ts
export type BoardResult =
  | { kind: 'ok'; payload: BoardPayload; legacyLayoutDir: string | null }
  | { kind: 'unknown-project' }
  | { kind: 'tree-missing'; path: string };

export type DetailResult =
  | { kind: 'ok'; detail: PraxisWorkstreamDetail; legacyLayoutDir: string | null }
  | { kind: 'unknown-project' }
  | { kind: 'tree-missing'; path: string }
  | { kind: 'unknown-workstream' };

export type AddProjectResult =
  | { kind: 'ok'; entry: ProjectEntry; created: boolean; legacyLayoutDir: string | null }
  | { kind: 'no-tree'; path: string };

export interface BoardApi {
  listProjects(): ProjectEntry[];
  addProject(absolutePath: string): AddProjectResult;
  removeProject(id: string): ProjectEntry | undefined;
  renameProject(id: string, name: string): ProjectEntry | undefined;
  getBoard(projectId: string): BoardResult;
  getDetail(projectId: string, workstreamId: string): DetailResult;
}
```

The status mapping the HTTP adapter must preserve: `unknown-project` → 404,
`tree-missing` → 410, `unknown-workstream` → 404, `no-tree` → 400 with the existing message
text, `ok` from `addProject` → 201 when `created`, else 200.

**`src/ports/cli-bootstrap.ts`** — the CLI entry point's contract, today embedded as
generated string lines in `tools/package-cli.mjs:128-141`.

```ts
export interface CliBootstrapInput {
  version: string;                 // injected at build time from package.json
  homeDir: string;                 // os.homedir()
  env: NodeJS.ProcessEnv;          // mutated in place
}
export interface CliBootstrapResult { dataDir: string; }
```

### The adapters

| Port | Adapter factory | File | Notes |
|---|---|---|---|
| `ProjectRegistry` | `createJsonFileProjectRegistry(config)` | `src/lib/projects.ts` (unchanged path) | The six existing exported functions are retained as a module-scope default instance built from `process.env.PRAXIS_DATA_DIR` exactly as `src/lib/projects.ts:22-24` reads it today. |
| `WorkstreamStore` | `createMarkdownWorkstreamStore()` | `src/lib/workstream-store.ts` (new) | Delegates to the existing `extract.ts`, `detail.ts`, `tree-layout.ts` and `git.ts` functions; adds no parsing of its own. |
| `BoardApi` | `createBoardApi({ registry, store })` | `src/core/board-api.ts` (new) | The only new orchestration module. |
| CLI bootstrap | `applyCliDefaults(input): CliBootstrapResult` | `src/cli-bootstrap.ts` (new) → `dist/cli-bootstrap.js` | Typed replacement for the generated env lines. |

### What each new module knows, and must not know

- `src/core/board-api.ts` knows the two driven ports and the result variants. It must **not** know `node:http`, HTTP status codes, `console`, `process.env`, or any string the user sees in an error body.
- `src/http/*` knows `node:http`, the route table, status codes, header guards, request-body limits and every error message string. It must **not** know `node:fs` for anything except static file serving, and must **not** import `src/lib/extract.js`, `src/lib/detail.js`, `src/lib/tree-layout.js` or `src/lib/git.js`.
- `src/ports/*` knows nothing. Types and interfaces only.
- `src/lib/workstream-store.ts` knows the filesystem and the four existing libraries. It must **not** know the registry, HTTP, or the CLI.

### The validation split

Validation stays where `src/server.ts:363-367` already puts it — at the route boundary.
String-shape rules stay in `src/http/`: trimming, the `~` refusal, `path.isAbsolute`,
`MAX_NAME_LENGTH`, `CONTROL_CHARS`, `isJsonContentType`, `WORKSTREAM_ID`, `isInstallScope`
and `isInstallTargetRequest`. Only the "a project is a directory holding a workstream tree"
rule moves into `createBoardApi`, because that is a domain rule rather than a wire-format
rule.

### The HTTP adapter split

`src/server.ts` divides into six modules under a new `src/http/`, plus a composition root
that keeps the name `src/server.ts`.

- `src/http/json.ts` — `sendJson`, `readRequestBody`, `MAX_BODY_BYTES`, `errorMessage`.
- `src/http/guards.ts` — `hostnameOf`, `passesOriginCheck`, `isLoopbackRemote`, `isJsonContentType`, `CONTROL_CHARS`, `MAX_NAME_LENGTH`. `ALLOWED_HOSTS` becomes a parameter, not a module-scope env read.
- `src/http/static-files.ts` — `MIME`, `CSP`, the `root + path.sep` traversal boundary, and the `fs.readFile` response. `publicRoot` arrives as an argument.
- `src/http/routes-projects.ts` — `/api/projects` and `/api/projects/:id`.
- `src/http/routes-board.ts` — `/api/projects/:id/data` and `/api/projects/:id/workstreams/:wsId/detail`, including `WORKSTREAM_ID` and the `LEGACY LAYOUT:` warn line, whose text stays byte for byte identical to `src/server.ts:129-132` and `src/scripts/extract-praxis-data.ts`.
- `src/http/routes-integrations.ts` — the five `/api/integrations/*` routes, the loopback peer gate, `permittedRootFor`, `detectionsForPermittedRoots` and `mapNodePlatformToOs`.
- `src/http/create-server.ts` — `createHttpServer(config: HttpServerConfig): http.Server`. It builds the server and returns it. It never calls `listen`, never reads `process.env`, and never calls `process.exit`.

```ts
export interface IntegrationsDeps {
  registry: ProjectRegistry;
  installRegistryPath: string;
  fsWrite: FsWriteAccess;                 // from src/lib/agentic-tools-install.js
  createFsAccess: () => FsAccess;         // from src/lib/agentic-tools-signals.js
}

export interface HttpServerConfig {
  api: BoardApi;
  integrations: IntegrationsDeps;
  publicRoot: string;
  allowedHosts: ReadonlySet<string>;
  appVersion: string | null;
}
```

The request pipeline order in `createHttpServer` is load-bearing and is preserved exactly as
`src/server.ts:890-931` and `src/server.ts:686-696` have it: origin check, then the static
traversal boundary, then the `/api/` dispatch, then the `Content-Type` check, then the
loopback peer gate on `/api/integrations/`. `src/test/boundary/server-guards.test.ts` is
the gate on that order.

### The composition root

`src/server.ts` keeps its path, because `dist/server.js` is named by `package.json`'s
`start` script, by `electron/main.cts:78`, by the generated `dist/cli-entry.js`, and by
`src/test/boundary/server-harness.ts`. After Stage 5 it contains only:

1. the module-scope environment reads — `PORT`, `HOST`, `ALLOWED_HOSTS`, `PRAXIS_APP_VERSION`, `PRAXIS_DATA_DIR`;
2. the three `__dirname`-derived paths;
3. the adapter and service construction;
4. `createHttpServer(...)`, the `error` listener, `server.listen(...)`, the non-loopback warning, and the exported `serverReady`.

**Three paths must stay computed in `src/server.ts` and nowhere else**, because each is
derived from `dist/server.js`'s own location and would resolve differently from
`dist/http/`:

- `publicRoot = path.join(__dirname, 'public')` (`src/server.ts:29`) — also the path Bun's embedded read-only asset filesystem resolves against in the packaged binary.
- the `package.json` fallback for `APP_VERSION`, `path.join(__dirname, '..', 'package.json')` (`src/server.ts:84`).
- `INSTALL_REGISTRY_PATH`'s unset-`PRAXIS_DATA_DIR` fallback, `path.join(__dirname, '..')` (`src/server.ts:108-111`).

The same rule keeps `src/lib/projects.ts` and `src/lib/update-prefs.ts` at their present
paths: both derive `repoRoot` as `__dirname/../..` from `dist/lib/`.

The module-scope hoists that exist for cost reasons stay module-scope in their new homes:
`WORKSTREAM_ID`, `ALLOWED_HOSTS`, `installFsWrite`, `APP_VERSION`, `CONTROL_CHARS`,
`INSTALL_TARGET_SHAPE`. None becomes per-request.

`serverReady` keeps its exact present contract: importing `dist/server.js` binds the socket
as a module side effect, and the exported promise resolves with the port actually bound.
See Decision 1.

### The CLI entry point

`src/cli-bootstrap.ts` compiles to `dist/cli-bootstrap.js` and exports `applyCliDefaults`.
It reproduces `tools/package-cli.mjs:135-138` exactly: an explicit emptiness test rather
than `??=` for both variables, `PRAXIS_APP_VERSION` defaulting to the injected version,
`PRAXIS_DATA_DIR` defaulting to `path.join(homeDir, '.flowcharge')`, and a recursive
`mkdirSync` of the resolved directory.

`tools/package-cli.mjs` keeps every responsibility it has — target selection, the two
guards, reading `version`, the Bun flags, the `release/cli/` output naming — and changes
only the body it generates. The generated `dist/cli-entry.js` keeps three ordering rules:
the `with { type: 'file' }` asset imports stay first and stay static, so Bun embeds bytes
rather than transformed code; the `applyCliDefaults` call is a statement, so it runs before
anything imports the server even though its own import is hoisted; and `./server.js` stays
the final **dynamic** import, so the environment is already in place when the server's
module-scope constants evaluate.

### The test folder layout

```
src/test/
├── fixture-project.ts          (from src/lib/fixture-project.ts)
├── boundary/                   server-harness.ts, server-projects.test.ts,
│                               server-board.test.ts, server-guards.test.ts,
│                               cli-binary.test.ts
└── unit/                       the 18 src/lib/*.test.ts files, plus
                                server.test.ts and server-env-seams.test.ts
```

`tsconfig.json`'s `include` becomes `["src/server.ts", "src/cli-bootstrap.ts", "src/core/**/*.ts", "src/http/**/*.ts", "src/lib/**/*.ts", "src/ports/**/*.ts", "src/scripts/**/*.ts", "src/test/**/*.ts", "src/types/**/*.d.ts"]`,
replacing the seven explicitly named test files it lists today. `rootDir` stays `"src"` and
`outDir` stays `"dist"`, so the output becomes `dist/test/boundary/*.js` and
`dist/test/unit/*.js`, which `package.json`'s existing `dist/**/*.test.js` glob still
matches with no script change.

Four path constants are derived from a test file's own location and must be re-based when
that file moves. They are the only non-mechanical part of Stage 1:

| File, after the move | Constant | New depth |
|---|---|---|
| `src/test/boundary/cli-binary.test.ts:41` | `REPO_ROOT` | three levels up from `dist/test/boundary/` |
| `src/test/unit/server-env-seams.test.ts:24-25` | `serverJsPath`, `packageJsonPath` | `../../server.js`, `../../../package.json` |
| `src/test/unit/projects.test.ts:18` | `projectsJsPath` | `../../lib/projects.js` |
| `src/test/unit/update-prefs.test.ts:20,122` | `prefsJsPath`, `repoRoot` | `../../lib/update-prefs.js`, three levels up |

`DEVELOPMENT.md`'s Test section alone names `src/lib/extract.test.ts`,
`dist/lib/extract.test.js` and "Test files sit beside the code they cover", at lines 82 and
85-87. The Project layout tree names none of those three. Two further statements go stale
once `src/test/`, `src/ports/`, `src/core/` and `src/http/` exist: the `tsconfig.json` bullet
at line 45, which lists the Node side as `src/server.ts`, `src/lib/`, `src/scripts/` and
`src/types/`, and the `src/` branch of the project layout tree at lines 97-103. All five
statements are updated in Stage 1 and nothing else in that document changes.

## Stages

1. **Test folder relocation.** Move the five WS-97-7fvoc0 files to `src/test/boundary/`, the remaining twenty test files to `src/test/unit/`, and `fixture-project.ts` to `src/test/`; fix relative imports, the four path constants above, `tsconfig.json`'s `include`, and the five `DEVELOPMENT.md` statements. It holds first position because it is purely mechanical and independently provable, and because doing it first means every later stage is written and verified once, in the final layout. Observable at the end: `npm test` lists the same case names and the same pass count as the captured baseline, and `dist/test/boundary/` and `dist/test/unit/` hold the compiled files.
2. **`ProjectRegistry` port and adapter.** Declare the port, turn `src/lib/projects.ts` into `createJsonFileProjectRegistry` plus a default instance behind the existing six exports, and have `src/server.ts` consume the injected instance. It goes first among the ports because it is the riskiest driven port: it carries the module-scope environment read, the `selfEntry` / `isPackaged` rule, the atomic temp-file write, and the one `src/lib` module the Electron IPC layer imports dynamically. Observable at the end: the projects boundary suite and `projects.test.ts` pass unchanged, `dist/lib/projects.js` still exports `readProjects` and its five siblings, and the Electron smoke check lists projects.
3. **`WorkstreamStore` port and adapter.** Declare the port, move `TreeLayout` into it, add `src/lib/workstream-store.ts` over the four existing libraries, and have the board and detail handlers read through it. It follows the registry because the board service in Stage 4 needs both ports to exist. Observable at the end: `server-board.test.ts` passes unchanged and no HTTP code imports `extract.js`, `detail.js`, `tree-layout.js` or `git.js`.
4. **Core application services.** Add `src/core/board-api.ts` implementing `BoardApi` over the two ports, and reduce the six route handlers to variant-to-status mappers. It sits here because the ports it composes now exist and the HTTP split in Stage 5 needs a thin thing to call. Observable at the end: all three HTTP boundary suites pass unchanged, and no status code, message string or `console` call appears in `src/core/`.
5. **HTTP adapter extraction.** Move the transport primitives, the guards, the static file serving and the projects, board, detail and version routes into `src/http/`, and reduce `src/server.ts` to the composition root. It is the largest stage and it sits after the ports so it happens once. Observable at the end: `server-projects.test.ts`, `server-board.test.ts` and `server-guards.test.ts` pass unchanged, `npm start` serves the board, and `src/server.ts` holds no route handler.
6. **Integrations routes.** Move the five `/api/integrations/*` routes, the loopback gate and the permitted-root derivation into `src/http/routes-integrations.ts`, driven by injected ports. It is separated from Stage 5 because the WS-97-7fvoc0 boundary suite reaches only the edge of this branch — `src/test/boundary/server-guards.test.ts:165-191` drives `POST /api/integrations/releases` through the loopback peer gate to a 405, and `src/test/unit/server.test.ts` is the only automated cover of the route bodies themselves — and because it is the hand-mirror of the Electron handler. Observable at the end: `server.test.ts` and `src/test/boundary/server-guards.test.ts` pass unchanged and the Electron smoke check opens Manage integrations.
7. **CLI bootstrap port.** Add `src/cli-bootstrap.ts` and reduce the body `tools/package-cli.mjs` generates to the asset imports, one bootstrap call and the final dynamic server import. It is last because it is the only stage whose verification needs Bun on the host. Observable at the end: `npm run package:cli` succeeds and `node --test dist/test/boundary/cli-binary.test.js` passes on a Bun-capable host.

## Data & compatibility

- **On-disk formats.** `.praxis-projects.json`, `.praxis-installs.json` and `.praxis-update.json` keep their shapes, their filenames and their `PRAXIS_DATA_DIR` resolution. There is no migration and nothing to backfill.
- **Wire contracts.** No route path, method, status code, header or payload field changes. The Electron renderer reaches the same routes through `electron/ipc-handlers.cts`'s loopback requests and is unaffected.
- **Module contracts consumed at runtime by untyped strings.** `dist/server.js`, `dist/lib/projects.js`, `dist/lib/agentic-tools-install.js`, `dist/lib/agentic-tools-install-tracking.js`, `dist/lib/agentic-tools-fs-adapter.js`, `dist/lib/agentic-tools-catalogue.js`, `dist/lib/agentic-tools-detect.js`, `dist/lib/agentic-tools-skill-presence.js`, `dist/lib/agentic-tools-canonical-skills.js`, `dist/lib/skill-content-fetch.js` (`electron/agentic-tools-ipc-handlers.cts:362`), `dist/lib/update-check.js` (`electron/update-check-ipc-handlers.cts:124`) and `dist/lib/update-prefs.js` (`electron/update-check-ipc-handlers.cts:129`) keep both their paths and their named exports.
- **`dist/` layout.** Gains `dist/ports/`, `dist/core/`, `dist/http/`, `dist/test/` and `dist/cli-bootstrap.js`; loses `dist/*.test.js` and `dist/lib/*.test.js`. `dist/server.js`, `dist/lib/*.js` and `dist/public/*` stay where they are. `electron-builder`'s `files: ["dist/**/*"]` and `tools/copy-assets.mjs`'s source-map walk both cover the new folders without a change, and compiled tests were already inside that glob before this work.
- **Rollback.** Each stage is one commit on the workstream branch. Reverting a stage restores the previous structure completely, because no stage writes data, changes a format, or leaves anything on disk behind it. There is no point past which this work is irreversible.

## Testing strategy

The WS-97-7fvoc0 boundary suite is the gate for every stage, and it is run in full at each
stage boundary rather than only at the end. This workstream adds no new test cases: WS-99-qxgzip
owns the unit coverage for the domain logic these ports isolate.

- **Baseline.** Before Stage 1 begins, capture `npm test`'s full output. Every later stage compares against it for case names and pass count, not just for a green exit code.
- **Stage 1.** Parity against that baseline is the whole verification. A case that disappears from the list is a file the glob no longer matches, and it must be found before the stage closes.
- **Stages 2, 3, 4, 5.** `src/test/boundary/server-projects.test.ts`, `server-board.test.ts` and `server-guards.test.ts` are the gate, plus the existing `src/test/unit/` suites for `extract`, `detail`, `projects`, `tree-layout` and `update-prefs`, which must pass with no assertion edited.
- **Stages 2 and 6.** Additionally a manual `npm run electron:dev` pass, per assumption A6, because the Electron adapters have no automated coverage and both stages touch code they reach.
- **Stage 7.** `npm run package:cli` followed by `node --test dist/test/boundary/cli-binary.test.js` on a host with Bun. CI supplies Node only, so that suite skips there with its stated reason and the CI job stays green, exactly as it does today.
- **Assertion changes.** No stage may edit an assertion in a WS-97-7fvoc0 file. Import specifiers and `__dirname`-derived path constants are not assertions and are expected to change in Stage 1 only. A stage that appears to need an assertion changed has stopped being internal, and must stop and report rather than edit the test.

## Decisions

Both decisions below are settled. Neither blocks any stage.

1. **Decision:** `dist/server.js` keeps starting the server as a module side effect with an exported `serverReady` promise. It does not become an explicit exported `startServer(config)` that the three callers invoke.
   **Reasoning:** Changing it means editing `src/test/boundary/server-harness.ts`, `electron/main.cts:78` and the generated `dist/cli-entry.js` in one step, and the harness is a WS-97-7fvoc0 file whose whole purpose is to stay still under this refactor. The plan above assumes the side-effect contract throughout; reversing this decision would change Stage 5 and Stage 7 together.

2. **Decision:** `src/lib/` keeps its name, with the new `src/ports/`, `src/core/` and `src/http/` folders beside it. It is not renamed to `src/adapters/`.
   **Reasoning:** Renaming it breaks eight untyped dynamic-import specifiers in `electron/agentic-tools-ipc-handlers.cts:335-359` that `tsc` cannot check and no automated test exercises, and it would move `src/lib/projects.ts` and `src/lib/update-prefs.ts`, whose `__dirname/../..` repo-root derivation depends on their depth. A later rename would have to redo that same untested work, so the decision is taken now rather than after the ports exist.

## Adjacent opportunities

Not requested, and none is written into a stage, a criterion or a contract above.

1. Convert `src/scripts/extract-praxis-data.ts` to read through the `WorkstreamStore` port, so the store is the only door to the markdown tree — skip, because no automated test covers that script.
2. Retire the hand-mirrored permitted-root logic in `electron/agentic-tools-ipc-handlers.cts` in favour of the core service — skip, because the Electron path has no boundary suite to prove the change safe.
3. Export a `close()` handle from the server so `npm test` no longer needs `--test-force-exit` — skip, because it changes the start contract Decision 1 keeps.

## Alternatives considered and rejected

1. **One big-bang reshuffle into `src/domain/`, `src/ports/` and `src/adapters/`.** Rejected: it breaks the untyped `'../lib/*.js'` dynamic-import strings at `electron/agentic-tools-ipc-handlers.cts:335-359` with no compiler error and no test failure, and it produces one change too large to verify against the boundary suite in pieces.
2. **Move the test files last, after the port extraction.** Rejected: every port stage would fix the same import paths that the final move then rewrites, and the largest mechanical change would land on the least-settled code.
3. **A root-level `test/` folder beside `src/`.** Rejected by the workstream record's own reasoning: `tsconfig.json` sets `"rootDir": "src"`, so the folder would force either widening `rootDir` — which reshapes all of `dist/` and breaks `tools/copy-assets.mjs`, `tools/package-cli.mjs` and `package.json`'s `main` — or a second tsconfig for tests.
4. **Parameter injection into the existing free functions, with no named port interfaces.** Rejected: it delivers none of the four named ports, and it leaves `src/lib/projects.ts` and the store still resolving their own paths and environment at module scope.
5. **A dependency-injection container.** Rejected: one process with one wiring needs one composition root, and this repository ships with zero runtime dependencies by design.

## Final summary

Seven stages, interfaces first and adapters in place: move the tests, then extract the
registry port, the store port, the core service, the HTTP adapter, the integrations routes,
and the CLI bootstrap. Effort is moderate but wide — roughly one sitting per stage, with
Stage 5 the largest and Stage 1 the most files touched. The top three risks are the untyped
dynamic-import strings in `electron/agentic-tools-ipc-handlers.cts` that no compiler or test
protects, the three `__dirname`-derived paths in `src/server.ts` that must not move out of
`dist/server.js`, and the Electron desktop path having no automated regression cover at all.
Two decisions are already settled and recorded above: the module-side-effect server start is
kept, and `src/lib/` keeps its name. No question in this plan is still open.
