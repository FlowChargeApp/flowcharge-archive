---
id: PLN-86-8iia6f
type: plan
workstream: WS-99-qxgzip
slug: domain-logic-unit-test-suite
title: "Unit test suite for src/core/board-api.ts over fake ports"
status: ready
created: 2026-09-09
updated: 2026-09-09
depends_on: []
links: []
---

# Unit test suite for src/core/board-api.ts over fake ports

## Summary

`src/core/board-api.ts` is the application service WS-98-tbznpw extracted from `src/server.ts`'s
route handlers. Nothing imports it except `src/server.ts:16`, and no test imports it at all: it is
covered today only through `src/test/boundary/server-board.test.ts` and
`src/test/boundary/server-projects.test.ts`, which drive a real HTTP server over a socket against a
real markdown tree on disk.

This plan adds one file, `src/test/unit/board-api.test.ts`, that drives `createBoardApi()` directly
with hand-written fake implementations of its two driven ports — `ProjectRegistry`
(`src/ports/project-registry.ts`) and `WorkstreamStore` (`src/ports/workstream-store.ts`). Both are
plain interfaces with no imports, so a fake is an object literal. The suite runs in-process,
synchronously, with no server, no socket, no filesystem and no child process. It uses `node:test`
and `node:assert/strict`, the pattern every existing suite under `src/test/unit/` already follows,
and it adds no dependency.

This is the payoff WS-98-tbznpw was done for: the six `BoardApi` operations and their nine result
variants become directly addressable, including the failure modes the boundary suite can only reach
by building a broken tree on disk.

## Scope

In scope, as acceptance criteria:

1. `src/test/unit/board-api.test.ts` exists, and `node --test dist/test/unit/board-api.test.js` passes after `npm run build`.
2. Each of the six `BoardApi` methods — `listProjects`, `addProject`, `removeProject`, `renameProject`, `getBoard`, `getDetail` — has at least one case, and each of the nine result variants declared in `src/ports/app-api.ts` is asserted at least once.
3. The suite imports only `node:test`, `node:assert/strict`, `../../core/board-api.js` and the three type modules; it imports no `node:fs`, `node:os`, `node:path`, `node:http` or `node:child_process`, and nothing under `src/lib/`, `src/http/` or `src/server.ts`.
4. Both fakes record every call with its arguments, and cases assert both the calls the core must make with the arguments it must pass, and the calls it must not make on a rejected input.
5. `getBoard`'s ok payload asserts the key order `['generated', 'source', 'workstreams', 'issues', 'branch', 'name']`, which `src/core/board-api.ts:57-63` declares load-bearing.
6. `legacyLayoutDir` is asserted for all three resolutions — no layout, current layout, legacy layout — on each of the three `ok` variants that carry it.
7. A `readBoard` throw and a `readDetail` throw each propagate out of the core rather than being converted into a result variant.
8. No file other than `src/test/unit/board-api.test.ts` is added or changed.

Out of scope: `src/core/board-api.ts` itself and every other production file; anything under
`src/test/boundary/` or `src/http/`; the port adapters `createJsonFileProjectRegistry`
(`src/lib/projects.ts`) and `createMarkdownWorkstreamStore` (`src/lib/workstream-store.ts`), whose
behaviour is covered by `src/test/unit/projects.test.ts`, `tree-layout.test.ts`, `extract.test.ts`
and `detail.test.ts`; the ports-and-adapters refactor (WS-98-tbznpw, done); the boundary regression
suite (WS-97-7fvoc0, done); telemetry (WS-100-t1os8w).

Assumptions, all still open for challenge:

- **A1.** `node:test` plus `node:assert/strict` is the framework, as in every file under `src/test/unit/`. No test runner, assertion library or mocking package is added.
- **A2.** "Comprehensive" means the case inventory in Design below: every method, every result variant, every `legacyLayoutDir` resolution, every argument-forwarding fact, and the two throw paths. Adding a case later is a one-line follow-up, so this threshold is recoverable.
- **A3.** The fakes are hand-written object literals built by two local factory functions in the test file, not `mock.fn()` and not a shared helper module. `src/test/fixture-project.ts` exists as a separate module only because two suites import it; this suite is the only consumer of these fakes.
- **A4.** `PraxisData`, `BoardPayload`, `ProjectEntry` and `PraxisWorkstreamDetail` are ambient globals from `src/types/praxis-data.d.ts`, already in `tsconfig.json`'s `include`, and are referenced unqualified in the test file exactly as `src/ports/app-api.ts` does.
- **A5.** Release and deployment constraints do not apply. The change is one test file: there is no production code change, no live data, no migration, no user-visible behaviour and no feature flag. The app stays shippable at every point, and rollback is deleting the file. CI (`.github/workflows/ci.yml`) runs `npm test` on every push and pull request against `main`, so the suite must be deterministic and must not touch the network or the disk.
- **A6.** `DEVELOPMENT.md` needs no edit. Its Test section names `src/test/unit/` as the home of the unit suites and cites `extract.test.ts` as an example, not as an inventory.

## Design

### The file

`src/test/unit/board-api.test.ts`, compiled to `dist/test/unit/board-api.test.js` by the root
`tsconfig.json`, and picked up by `package.json`'s existing `dist/**/*.test.js` glob with no script
change. It opens with a header comment stating what it covers and why it needs no I/O, and closes
that comment with the run line every sibling carries:
`Run with node --test dist/test/unit/board-api.test.js after npm run build.`

### What the test module knows, and must not know

It knows `createBoardApi` from `../../core/board-api.js`, the two driven-port interfaces, the
`TreeLayout` type from `../../ports/workstream-store.js`, the three result types from
`../../ports/app-api.js`, and the ambient payload globals. It must **not** know HTTP status codes,
any error-body string, the route table, the filesystem, the environment, or any adapter under
`src/lib/`. Those belong to the boundary suite.

### Contracts the suite builds

```ts
type Call = { fn: string; args: readonly unknown[] };

function fakeRegistry(overrides?: Partial<ProjectRegistry>): ProjectRegistry & { calls: Call[] };
function fakeStore(overrides?: Partial<WorkstreamStore>): WorkstreamStore & { calls: Call[] };

function makeApi(parts?: {
  registry?: Partial<ProjectRegistry>;
  store?: Partial<WorkstreamStore>;
}): { api: BoardApi; registry: ProjectRegistry & { calls: Call[] }; store: WorkstreamStore & { calls: Call[] } };
```

Each factory records `{ fn, args }` for every method it implements before returning, then returns
the override's value when the override supplies that method, and the default otherwise. The
recorder mirrors `src/test/unit/agentic-tools-install.test.ts:26-66`, the codebase's existing
fake-with-call-log pattern.

Default port behaviour, chosen so each case overrides only the one method it is about:

| Port method | Default return |
|---|---|
| `registry.list()` | `[]` |
| `registry.find(id)` | `undefined` |
| `registry.add(path)` | `{ entry: ENTRY, created: true }` |
| `registry.remove(id)` | `undefined` |
| `registry.rename(id, name)` | `undefined` |
| `store.resolveLayout(root)` | `null` |
| `store.hasTree(root)` | `true` |
| `store.readBoard(root)` | a fresh copy of `BOARD` |
| `store.readDetail(root, id)` | `null` |
| `store.readBranch(root)` | `null` |

Fixture constants, all inline literals with no disk behind them:

```ts
const ENTRY: ProjectEntry = { id: 'abc12345', name: 'Fixture project', path: '/fake/project', added: '2026-01-01' };
const BOARD: PraxisData = { generated: '2026-01-01T00:00:00.000Z', source: '/fake/project/flowcharge', workstreams: [], issues: [] };
const DETAIL: PraxisWorkstreamDetail = { id: 'WS-1-aa11bb', slug: 'fixture', title: 'Fixture', status: 'ready', archived: false, plans: [], issueLists: [], taskLists: [] };
const LAYOUT_CURRENT: TreeLayout = { dir: '/fake/project/flowcharge', generation: 'flowcharge', legacy: false };
const LAYOUT_LEGACY: TreeLayout  = { dir: '/fake/project/prxwork',   generation: 'prxwork',   legacy: true  };
```

`BOARD` carries empty `workstreams` and `issues` arrays on purpose: the core never reads inside the
extractor's payload, it only spreads it, so a richer fixture would assert the extractor's work and
belongs to `extract.test.ts`.

### Case inventory

| Method | Case | What it fixes |
|---|---|---|
| `listProjects` | returns the registry's list unchanged | pure delegation; the store is never called |
| `addProject` | `hasTree` false | `{ kind: 'no-tree', path }` carries the input path, and `registry.add` is never called |
| `addProject` | `created: true` | `{ kind: 'ok', entry, created: true }` |
| `addProject` | `created: false` | `created` is passed through, not recomputed |
| `addProject` | argument forwarding | `hasTree` and `add` both receive the absolute path verbatim; the core normalises nothing |
| `addProject` | three layout resolutions | `legacyLayoutDir` is `null`, `null`, `'/fake/project/prxwork'` |
| `removeProject` | entry, and `undefined` | both registry outcomes pass through; the id is forwarded verbatim; the store is never called |
| `renameProject` | entry, and `undefined` | both registry outcomes pass through; `(id, name)` forwarded in that order; the store is never called |
| `getBoard` | `find` returns `undefined` | `{ kind: 'unknown-project' }`, and no store method is called |
| `getBoard` | `hasTree` false | `{ kind: 'tree-missing', path }` carries `entry.path`; `readBoard` and `readBranch` are never called |
| `getBoard` | ok payload composition | payload is the extraction result plus `branch` and `name`; `name` comes from `entry.name` |
| `getBoard` | key order | `Object.keys(payload)` equals the order in acceptance criterion 5 |
| `getBoard` | branch null and branch string | both `readBranch` outcomes reach the payload unchanged |
| `getBoard` | store receives `entry.path` | the store is never handed the project id |
| `getBoard` | three layout resolutions | `legacyLayoutDir` on the ok variant |
| `getBoard` | `readBoard` throws | the throw propagates; no variant is returned |
| `getDetail` | `find` returns `undefined` | `{ kind: 'unknown-project' }`, and no store method is called |
| `getDetail` | `hasTree` false | `{ kind: 'tree-missing', path }` carries `entry.path`; `readDetail` is never called |
| `getDetail` | `readDetail` returns `null` | `{ kind: 'unknown-workstream' }`, distinct from `tree-missing` and carrying no other field |
| `getDetail` | ok | `{ kind: 'ok', detail }` returns the store's object unchanged |
| `getDetail` | argument forwarding | `readDetail` receives `(entry.path, workstreamId)` verbatim |
| `getDetail` | three layout resolutions | `legacyLayoutDir` on the ok variant |
| `getDetail` | `readDetail` throws | the throw propagates; no variant is returned |

The "never called" assertions are not incidental. They fix the guard order the transport layer
depends on: `src/http/routes-board.ts:50-57` maps `unknown-project` to 404 and `tree-missing` to
410, and `src/http/routes-projects.ts:49-52` maps `no-tree` to 400 with its own message. If
`addProject` reached `registry.add` before `hasTree`, a rejected path would still be written to the
registry file while the caller saw a 400.

The two throw cases fix the split `src/ports/workstream-store.ts:19-24` states explicitly:
`readBoard` throws on a missing tree, `readDetail` returns `null` on an unknown id, and the core
must keep those two failure shapes apart. The route handlers wrap both calls in `try`/`catch` and
answer 500, so a core that swallowed a throw would turn a real extraction failure into a 200 with a
half-built payload.

## Stages

1. **Harness and the ok board path.** Build the two fake factories, the fixture constants and `makeApi`, then the `getBoard` ok cases including payload composition and key order. It holds first position because every later stage builds on the fake shapes, and because the payload-composition cases are the ones that fail if a fake's typing or the ambient globals are wrong. Observable at the end: `node --test dist/test/unit/board-api.test.js` passes with the `getBoard` ok cases.
2. **Read-path failure variants.** `unknown-project`, `tree-missing` and `unknown-workstream` for `getBoard` and `getDetail`, each with its "port never called" assertion. It follows first because these are the variants the boundary suite reaches only through a hand-built broken tree, and they are the highest-value cases in the file. Observable at the end: all four `getBoard`/`getDetail` non-ok variants are asserted and the file still passes.
3. **The `legacyLayoutDir` matrix.** All three layout resolutions across the three `ok` variants. It is separated because it is one fact repeated over three call sites, and doing it in one pass keeps the three assertions identical. Observable at the end: nine cases covering no layout, current layout and legacy layout.
4. **Registry-facing methods.** `addProject`'s variants and argument forwarding, plus the `listProjects`, `removeProject` and `renameProject` pass-through cases. It sits after the read path because it is the simpler half. Observable at the end: all six methods have cases and every result variant is asserted.
5. **Throw propagation and full-suite check.** The `readBoard` and `readDetail` throw cases, then `npm test` end to end. It is last because it is the only stage that asserts what the core does not do, and because the full run confirms the new file adds cases without disturbing any existing suite. Observable at the end: `npm test` passes, with the previous pass count plus this file's cases.

## Data & compatibility

No migration, no persisted data, no API change, no client change. The suite writes nothing and reads
nothing outside its own process, so it cannot leave state behind between runs or between CI jobs —
unlike `src/test/unit/projects.test.ts`, which creates and removes temporary directories.

Rollback is deleting `src/test/unit/board-api.test.ts`; nothing else references it.

The one compatibility surface is against `src/core/board-api.ts` itself. The suite asserts that
module's published contract — the result variants of `src/ports/app-api.ts` and the argument flow
between the two ports — plus the payload key order, which the source declares as intentional
(`src/core/board-api.ts:57-59`), and the guard order, which no source line declares but which the
variant-to-status mapping at `src/ports/app-api.ts:9-15` implies, as the Design section above argues.
A later change to the core that breaks one of those is meant to fail here.

## Testing strategy

This workstream is the tests. The whole file is unit-level: no integration coverage is added, and
none is removed.

- Stage 1-5 coverage is unit only, driven through the two fakes.
- The same paths keep their existing integration coverage in `src/test/boundary/server-board.test.ts` and `src/test/boundary/server-projects.test.ts`, which stay untouched. The overlap is intended: the boundary suite proves the wiring and the status mapping, this suite proves the branch logic.
- Non-functional load is nil. Every case is synchronous and allocates a handful of object literals, so the file adds no measurable time to `npm test` and needs no timeout, no `--test-force-exit` interaction and no cleanup hook.
- Observability needs nothing beyond the runner's own output. The core writes no log line, and the test file must not assert on `console`.

## Open questions

None. Every remaining choice is a recoverable default and is recorded as an assumption in Scope,
where it can be challenged before the task list is authored.

## Adjacent opportunities

Not requested, listed only as offers:

1. A shared `src/test/unit/fake-ports.ts` holding the two fake factories, once a second core service exists to import them — skip now, one consumer.
2. Unit tests for the `src/http/` route modules driven by a fake `BoardApi`, covering the variant-to-status mapping directly — skip, Context excludes `src/http/` and the boundary suite covers it.
3. A compile-time exhaustiveness check that fails when a new result variant is added to `src/ports/app-api.ts` without a case here — skip, it widens the file past what Context asks for.

## Alternatives considered and rejected

1. **Test through a real HTTP server instead.** That is the boundary suite WS-97-7fvoc0 already delivered, and it cannot reach these branches cheaply.
2. **Drive the core through the real adapters over a temp tree built by `src/test/fixture-project.ts`.** It would make this an adapter test, duplicate `extract.test.ts` and `tree-layout.test.ts`, add disk I/O, and defeat the reason WS-98-tbznpw introduced the ports.
3. **Use `node:test`'s `mock.fn()` instead of hand-written fakes.** Typed object literals satisfy the interfaces at compile time, which a mock does not, and `src/test/unit/agentic-tools-install.test.ts` already sets the hand-written precedent.
4. **Split into two files, one per port grouping.** One module under test gets one test file in this repo, and the fakes would then need a shared module before anything needs to share them.
5. **Extract the fakes into a shared helper module now.** `src/test/fixture-project.ts:5-10` records the rule: a helper becomes its own module when more than one suite imports it, which is not yet true here.

## Final summary

- Approach: one new file, `src/test/unit/board-api.test.ts`, driving `createBoardApi()` with hand-written fakes of `ProjectRegistry` and `WorkstreamStore`, using `node:test` and no new dependency.
- Five stages, roughly 23 cases, each stage small enough to finish and verify in one sitting.
- Risks: the suite pins the core's guard order and the board payload's key order, so a later refactor of `src/core/board-api.ts` must keep both; the fakes must stay minimal, or they start asserting the extractor's work instead of the core's; the overlap with the boundary suite is deliberate and must not be resolved by deleting boundary cases.
- Open questions: none. Six assumptions in Scope carry the judgement calls, chiefly A2's definition of "comprehensive" and A3's decision to keep the fakes in the test file.
