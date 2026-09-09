---
id: WS-98-tbznpw
type: workstream
workstream: WS-98-tbznpw
slug: ports-and-adapters-refactor
title: "Refactor the codebase into a ports-and-adapters architecture"
description: "The app reaches its dependencies directly rather than through interfaces. The natural ports are the flowcharge/ markdown store, the project registry (.praxis-projects.json), the HTTP layer (src/server.ts) and the CLI entry point (tools/package-cli.mjs / dist/cli-entry.js). Do it early, before the app grows further, because untangling it gets more expensive the longer it waits. It must not start until WS-97-7fvoc0 lands, because that workstream writes the boundary-level regression tests that give this refactor its safety net."
status: done
tags: [architecture, refactor, feature]
created: 2026-09-09
updated: 2026-09-09
author: Anthony Koukoullis
depends_on: [WS-97-7fvoc0]
links: []
---

Restructure the codebase into a ports-and-adapters (hexagonal) architecture, putting the flowcharge/ store, the project registry, the HTTP layer and the CLI entry point behind ports.

The application shipped its first public release with no particular architectural pattern
applied to the codebase. It currently reaches its dependencies directly rather than through
interfaces.

## The natural ports

- The `flowcharge/` markdown store.
- The project registry, `.praxis-projects.json`.
- The HTTP layer, `src/server.ts`.
- The CLI entry point, `tools/package-cli.mjs` / `dist/cli-entry.js`.

## Why now

This refactor was recommended by another agent session that also pointed at this same
project. It should happen early, before the app grows further, since untangling it gets
more expensive the longer it waits.

## Ordering

It must not start until WS-97-7fvoc0 "Missing boundary regression test suite" has landed.
That workstream writes boundary-level regression tests — HTTP routes, CLI behavior,
`flowcharge/` extraction — specifically so this refactor has a safety net. The constraint is
recorded in `depends_on`.

A second workstream, WS-99-qxgzip, follows this one: it writes a comprehensive unit test
suite for the domain logic that this refactor isolates.

## Test-folder layout to fold in

This refactor should also move the project's test files into a proper folder structure,
decided during WS-97-7fvoc0 but deliberately deferred to here rather than done standalone,
since it is the same kind of structural change:

- Target layout: `src/test/boundary/` and `src/test/unit/`, nested inside `src/`, not a
  root-level `test/` sibling. `tsconfig.json` sets `"rootDir": "src"` and `"outDir": "dist"`;
  a root-level `test/` folder would sit outside `rootDir` and force either widening it (which
  reshapes the whole `dist/` layout — `dist/lib/...` and `dist/server.js` would move to
  `dist/src/...`, breaking `tools/copy-assets.mjs`, `tools/package-cli.mjs`'s asset path, and
  `package.json`'s `main: dist/electron/main.cjs`) or a second, separate tsconfig for tests.
  `src/test/` stays inside the existing `rootDir` and compiles to `dist/test/...` with no
  other config change beyond `tsconfig.json`'s `include` array.
- "Boundary", not "integration": WS-97-7fvoc0 already established "boundary" as this
  project's term for this test style (its title, its plan `PLN-84-c6d01h`, its task list
  `TL-98-v8145x`), so keep that word rather than introducing a synonym.
- `src/test/boundary/` receives the five files WS-97-7fvoc0 added:
  `src/server-harness.ts`, `src/server-projects.test.ts`, `src/server-board.test.ts`,
  `src/server-guards.test.ts`, `src/cli-binary.test.ts`.
- `src/test/unit/` receives the existing colocated unit tests under `src/lib/` (and any
  other `foo.ts`/`foo.test.ts` pairs outside the boundary set) — roughly two dozen files,
  each needing its relative imports fixed for the new depth alongside `tsconfig.json`'s
  `include` array.
