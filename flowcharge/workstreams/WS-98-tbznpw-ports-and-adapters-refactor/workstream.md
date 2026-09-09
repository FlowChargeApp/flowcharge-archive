---
id: WS-98-tbznpw
type: workstream
workstream: WS-98-tbznpw
slug: ports-and-adapters-refactor
title: "Refactor the codebase into a ports-and-adapters architecture"
description: "The app reaches its dependencies directly rather than through interfaces. The natural ports are the flowcharge/ markdown store, the project registry (.praxis-projects.json), the HTTP layer (src/server.ts) and the CLI entry point (tools/package-cli.mjs / dist/cli-entry.js). Do it early, before the app grows further, because untangling it gets more expensive the longer it waits. It must not start until WS-97-7fvoc0 lands, because that workstream writes the boundary-level regression tests that give this refactor its safety net."
status: ready
tags: [architecture, refactor]
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
