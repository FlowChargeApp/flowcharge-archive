---
id: PLN-84-c6d01h
type: plan
workstream: WS-97-7fvoc0
slug: boundary-regression-test-suite
title: "Boundary regression tests for the HTTP routes, the packaged CLI and the board payload"
status: done
created: 2026-09-09
updated: 2026-09-09
depends_on: []
links: []
---

# Boundary regression tests for the HTTP routes, the packaged CLI and the board payload

## Summary

This app has boundary coverage for `/api/integrations/*` only. Every other boundary is
uncovered: the project registry routes, the board payload route, the workstream detail
route, the request guards, static serving, and the packaged CLI binary.

This plan adds four test files and two shared helpers. They drive the real server over a
real socket, and they drive the real Bun binary as a separate process. They assert
external behavior only — status codes, payload shapes and observable side effects — so
the later ports-and-adapters refactor (WS-98-tbznpw) can move the internals without
rewriting them.

The suite keeps the existing convention: `node --test` over the compiled output, test
files beside the code they cover, run by `npm test`. It adds no test framework and no
dependency.

## Scope

**Acceptance criteria**

1. `npm test` passes on a machine with Bun, and passes with the CLI cases reported as skipped when `bun --version` fails.
2. No test file this plan adds reads or writes the repository's own `.praxis-projects.json`, `.praxis-installs.json`, or the real `~/.flowcharge`. This criterion binds the new files only. It does not bind the existing suite, because `src/server-env-seams.test.ts:132-150` deliberately runs the server with `PRAXIS_DATA_DIR` unset and asserts that the repository-root registry is read.
3. Every `/api/projects` and `/api/projects/:id` route answers its documented status and body, for the success and the refusal cases, driven over a real socket.
4. `GET /api/projects/:id/data` returns the whole board payload for a realistic fixture tree, in both the `flowcharge/` and the legacy `prxwork/` generation.
5. `GET /api/projects/:id/workstreams/:wsId/detail` returns the detail payload for that fixture tree, plus its documented 400, 404, 410 and 405 refusals.
6. The cross-cutting guards and static serving answer as written today: 403 on a wrong Content-Type, 413 on an oversize body, 403 on a rejected Host, 403 on a mismatched Origin, 403 on traversal, 405 on a wrong method for `GET /api/integrations/releases`, 200 with the CSP header for `/`, 200 with the CSP header for `/board.html`, 200 for one static asset with its documented MIME type and the CSP header, and 404 for an unknown static path.
7. The binary that `tools/package-cli.mjs` builds boots and answers `/api/version`, `/api/projects` and `/`, with `PRAXIS_APP_VERSION`, `PRAXIS_DATA_DIR`, `HOST` and `PORT` behaving as `DEVELOPMENT.md` documents.
8. No file under `src/` that the product ships changes; the work adds test files and fixture builders only.

**Out of scope**

- The ports-and-adapters refactor (WS-98-tbznpw), the domain-logic unit suite (WS-99-qxgzip), and telemetry (WS-100-t1os8w).
- Re-testing what `src/lib/extract.test.ts`, `src/lib/detail.test.ts`, `src/lib/tree-layout.test.ts`, `src/lib/projects.test.ts` and `src/server.test.ts` already cover.
- `/api/version`, whose set, unset and empty branches `src/server-env-seams.test.ts` already covers through child processes.
- The 200 path of `GET /api/integrations/releases`. `listSkillReleases()` in `src/lib/skill-content-fetch.ts:201` calls a fixed URL and takes no injectable source, so an offline test of its body needs a production seam this workstream does not authorize. Its method guard is covered instead.
- The 403 that `isLoopbackRemote` returns for a non-local peer. Producing a non-loopback peer needs a second host, so no portable test can reach that branch.
- The self-entry fallback in `readProjects()`. It is observable only with `PRAXIS_DATA_DIR` unset, which reads the maintainer's real registry, so it stays uncovered here.
- Browser-side code under `src/public/`, the Electron IPC transport, and the release scripts.

**Assumptions**

- "Every `/api/` endpoint in `src/server.ts`" governs, and the route list in the request is illustrative. The workstream detail route is therefore in scope, although the list omits it.
- The CLI suite runs inside `npm test`, gated on Bun. CI supplies Node only, so those cases skip there and the CI job stays green with no workflow change.
- The CLI suite calls `node tools/package-cli.mjs --target=<host label>`, so it exercises the real packaging command rather than a copy of its Bun flags. That command overwrites `dist/cli-entry.js` and one file under `release/cli/`. Both paths are gitignored build output. The compile is estimated at about 0.15 seconds and about 64 MB. Both figures are estimates with no cited source, and stage 4 must re-measure them before it starts, because the compile time is part of the reason a Bun compile sits inside `npm test`.
- The CLI suite overrides `HOME` for every child process, so the `~/.flowcharge` default is observed inside a temporary directory and the real home directory is never written.
- There is no production data, no live user and no migration to protect. The app is unreleased, the suite adds no production code, and each stage leaves `npm test` green on its own.

## Design

Contracts first. Two new helper modules carry every mechanism the four test files share.

**`src/server-harness.ts`** — new. It carries no `.test.` in its name, so a test file may
import it without registering that file's cases a second time. The precedent is
`src/lib/fixture-project.ts:1-10`.

```ts
export interface TestServer {
  base: string;      // e.g. http://127.0.0.1:53422, from the bound ephemeral port
  dataDir: string;   // the temporary directory PRAXIS_DATA_DIR points at
}

export interface RawResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  text: string;
}

export async function startTestServer(): Promise<TestServer>;
export async function requestJson(
  base: string,
  route: string,
  init?: { method?: string; body?: string; headers?: Record<string, string> },
): Promise<{ status: number; body: unknown }>;
export async function requestRaw(
  base: string,
  route: string,
  init?: { method?: string; body?: string; headers?: Record<string, string> },
): Promise<RawResponse>;
```

`startTestServer` creates a temporary directory, assigns `PRAXIS_DATA_DIR`, `PORT=0` and
`HOST=127.0.0.1`, then imports `./server.js` and awaits its exported `serverReady`
promise (`src/server.ts:939`). Assignment before the import is load-bearing:
`src/server.ts:30-31` and `src/lib/projects.ts:22` read the environment once at module
evaluation. The caller removes `dataDir` in its own `after()` hook.

`requestRaw` uses `node:http`, never `fetch`. `Host` is a forbidden header name for
`fetch`, and the guard cases have to set it.

The harness knows three environment variable names and one exported promise. It must not
know a route path, a payload field, or a registry field.

**`src/lib/fixture-project.ts`** — one additive export. The existing
`withFixtureProject` and the `GENERATION_NAMES` table stay exactly as they are, because
`src/lib/extract.test.ts` and `src/lib/detail.test.ts` assert against them today.

```ts
export interface BoardFixtureOptions {
  generation?: FixtureGeneration;   // default 'flowcharge'
  branch?: string | null;           // default null; a string writes .git/HEAD
}

export async function withBoardFixtureProject(
  run: (root: string) => Promise<void>,
  options?: BoardFixtureOptions,
): Promise<void>;
```

It writes one realistic project tree and removes it again, whatever the callback does.
The tree folder name and the marker filename come from the existing `GENERATION_NAMES`
table, so one definition serves both generations. Required content:

- `<tree>/workstreams/` holds two workstream folders. The first carries `workstream.md`
  with a multi-paragraph body, plus a plan file, an issue list file and a task list file,
  so artefact order (plan, issuelist, tasklist), the item counters and the aggregated
  `issues[]` are all observable. The second carries a marker file only, so a workstream
  with no artefacts is covered.
- The issue list holds one suffixed and one unsuffixed issue id, one checked and one
  unchecked, with a `severity` and a `status` each.
- `<tree>/archive/` holds a third workstream folder, so `archived: true` is observable.
- `.git/HEAD` holding `ref: refs/heads/<branch>` when `branch` is a string, so the
  `branch` field of the board payload is observable rather than always null.

**New test files**, each beside the code it covers, each one `node --test` process, so
each may fix its own environment before importing the server:

| File | Boundary it covers |
|---|---|
| `src/server-projects.test.ts` | `/api/projects` and `/api/projects/:id` |
| `src/server-board.test.ts` | `/api/projects/:id/data` and the detail route |
| `src/server-guards.test.ts` | the cross-cutting guards, static serving, and the method guard of `GET /api/integrations/releases` |
| `src/cli-binary.test.ts` | the packaged Bun binary |

Every case registers a project through `POST /api/projects` and uses the id the route
returns. No test file imports `src/lib/projects.js` to compute an id, and no test file
imports a parser from `src/lib/extract.js`. That rule is what makes these tests survive
the later refactor.

`src/cli-binary.test.ts` maps the host to one packaging label — `darwin`+`arm64` to
`darwin-arm64`, `darwin`+`x64` to `darwin-x64`, `linux`+`x64` to `linux-x64` — and skips
with a stated reason on any other host, or when a `bun --version` probe fails. It builds
once per run, then spawns the binary per case with `HOME`, `PRAXIS_DATA_DIR`,
`PRAXIS_APP_VERSION`, `HOST` and `PORT` set for that case. Readiness is the
`FlowCharge running at http://<host>:<port>` line the server prints on stdout
(`src/server.ts:956`); the child is killed in an `after()` hook. The port comes from
binding a `net` server on port 0 and closing it, because a black-box child cannot report
its own bound port when `PORT` is 0.

Nothing in `src/server.ts`, `src/lib/` or `tools/` changes.

## Stages

1. **Isolated registry harness and the project registry routes.** Delivers
   `src/server-harness.ts` and `src/server-projects.test.ts`. It holds first position
   because it carries the only data-safety risk in this plan — a wrong data-directory
   seam writes into the maintainer's real project list — and because the three later HTTP
   stages all build on the harness it introduces. At the end, `npm test` runs the new file
   green and the repository's own `.praxis-projects.json` is unchanged by the run.
2. **The board payload and the workstream detail, end to end over HTTP.** Delivers the
   fixture builder and `src/server-board.test.ts`. It holds second position because it is
   the largest coverage gap and the behavior the later refactor is most likely to disturb.
   At the end, a fixture tree in either generation is asserted from disk through to the
   JSON the board reads.
3. **The request guards and static serving.** Delivers `src/server-guards.test.ts`. It
   holds third position because it needs no fixture and introduces no new mechanism. At
   the end, every check above the route table, and the HTML and asset path, are covered.
4. **The packaged CLI binary as a black box.** Delivers `src/cli-binary.test.ts`. It holds
   last position because it depends on no earlier stage and is the only stage that cannot
   run in CI. At the end, `npm test` on a machine with Bun builds the host binary and
   asserts its four documented environment behaviors, and skips them elsewhere.

## Data & compatibility

- No migration, no schema change and no production code change. The deliverable is test
  files and two helper modules.
- Rollback is deleting the new files. There is no partial state to reverse, and each stage
  is independently revertible.
- The compiled test files land in `dist/`, so `electron-builder`'s `dist/**/*` glob
  includes them, exactly as it already includes the existing test files. The count of
  twenty-three existing test files is an estimate with no cited source, and stage 4 must
  re-measure it before it starts. This is unchanged in kind.
- `npm test` gains one Bun compile and one write to `release/cli/` on a machine with
  Bun, estimated at about 64 MB. That size is an estimate to re-measure before stage 4
  starts. The file is overwritten, not accumulated, and `release/` is gitignored.
- Existing consumers are unaffected: no existing test file is edited, and
  `src/lib/fixture-project.ts` gains an export rather than changing one.

## Testing strategy

This plan is itself the testing work, so this section states what each stage's coverage is
and what it deliberately is not.

- Stage 1 is integration coverage over a real socket, with the data directory redirected
  to a temporary path. It covers the success and refusal cases of the registry routes,
  including the 405 answers for the wrong method.
- Stage 2 is full-pipeline integration coverage: fixture files on disk, through the
  extractor, through the route, to the JSON body. It asserts payload structure — workstream
  count, ids, statuses, the `archived` flag, artefact order and counters, the aggregated
  issue list, `branch` and `name` — not the internal functions that produce them.
- Stage 3 is integration coverage of the guards. The 413 case is the one with real
  flakiness risk: `readRequestBody` destroys the request after answering
  (`src/server.ts:299-304`), so the response must be read before the socket closes.
- Stage 4 is black-box process coverage. It asserts only what an external caller can
  observe: the startup line, the HTTP answers, and the directory the binary creates.
- No new unit test of an internal function is written. `src/lib/extract.test.ts` already
  covers the parsers directly, and WS-99-qxgzip owns unit coverage of the domain logic the
  refactor will expose.
- Every case is offline. No case performs a real skill install, and no case calls the
  release listing endpoint's handler.

## Open questions

1. **How strict should the assertions on refusal bodies be?** Option A asserts the status
   code and the presence of an `error` string only. Option B asserts the exact error text
   as well, for example `Refused install path outside the permitted root for ...`. Option B
   is a tighter regression net and would catch a message the refactor silently drops, but
   it also fails on a deliberate rewording and so churns during WS-98-tbznpw. The choice
   sets the churn cost of the whole suite, and it is hard to reverse once thirty cases are
   written to one style. Recommendation: option A for the message text, with the status
   code and the JSON shape asserted exactly, and option B only where the text encodes a
   security decision the refactor must not lose — the permitted-root refusals and the
   malformed-workstream-id refusal.

## Adjacent opportunities

Not requested, and none is written into a stage or a criterion.

1. An injectable release source in `src/lib/skill-content-fetch.ts`, which would make
   `/api/integrations/releases` offline-testable — skip, it is a production change and fits
   naturally inside WS-98-tbznpw.
2. A `test:boundary` script that runs the four new files alone — skip, one `npm test`
   entry point is the existing convention.
3. A Bun setup step in CI so the CLI cases run there too — skip, the CI file is
   deliberately minimal, with no `setup-node` step and no Bun.

## Alternatives considered and rejected

- A test framework such as vitest or jest, with HTTP mocking — rejected: the repository runs `node --test` over compiled output, and a second runner would split the suite.
- Injecting a fake request object instead of using a real socket — rejected: `src/server.ts` exports no handler, only a bound socket and `serverReady`, so a socket is the real boundary.
- Refactoring `src/server.ts` to export a `createServer()` factory, so tests need no environment-before-import ordering — rejected: that change is the ports-and-adapters refactor these tests must precede.
- Running `bun dist/cli-entry.js` uncompiled instead of the compiled binary — rejected: it reads `dist/public/` from the real disk, so it never exercises the embedded read-only asset filesystem, which is the packaging risk.
- Adding the new cases to `src/server.test.ts` — rejected: that file imports `./server.js` at module scope with no `PRAXIS_DATA_DIR`, so a registry-writing route tested there would write into the maintainer's real project list.

## Final summary

Four new `node --test` files plus two shared helpers, all asserting external behavior only,
so the WS-98-tbznpw refactor can move the internals without rewriting them.

- Approach: drive the real server over a real socket with the data directory redirected to a temporary path, and drive the real packaged binary as a child process.
- Four stages, each a day or less: registry routes, board payload, guards and static, packaged CLI.
- Risk one: a wrong data-directory seam writes into the maintainer's real `.praxis-projects.json`. Stage 1 exists to settle that first.
- Risk two: the 413 case can flake, because the server destroys the request after answering.
- Risk three: over-strict assertions on error text would churn during the refactor and defeat the purpose of writing these tests now.
- Open question 1 needs an answer before stage 1 starts: how strict the assertions on refusal bodies should be.
