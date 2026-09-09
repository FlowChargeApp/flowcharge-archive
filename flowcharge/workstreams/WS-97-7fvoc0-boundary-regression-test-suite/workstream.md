---
id: WS-97-7fvoc0
type: workstream
workstream: WS-97-7fvoc0
slug: boundary-regression-test-suite
title: "Missing boundary regression test suite"
description: "The app has no test suite. Before refactoring into a ports-and-adapters architecture, write boundary-level regression tests (HTTP routes, CLI behavior, flowcharge/ extraction) first, so the refactor has a safety net whose tests survive it, since boundary-level tests do not need rewriting when internals change."
status: ready
tags: [testing, server, cli, extraction]
created: 2026-09-08
updated: 2026-09-09
author: Anthony Koukoullis
depends_on: []
links: []
---

There is no real test suite for this app yet, and that needs to change before it grows further, given a planned refactor into a ports-and-adapters (hexagonal) architecture is also coming.

Write boundary-level regression tests first, before any refactoring work starts. The reasoning: tests written against boundaries (not internals) survive an internal refactor largely unchanged, because the whole point of that refactor is to preserve external behavior while relocating the internals — whereas tests written against the current, unstructured internals would need to be rewritten once the architecture changes, which defeats the purpose of writing them now.

Boundaries to cover:

- The HTTP server's routes, including every `/api/` endpoint (`src/server.ts`).
- The CLI's observable behavior — the packaged Bun binary's entry point (`dist/cli-entry.js`, built by `tools/package-cli.mjs`).
- The `flowcharge/` markdown extraction and board-rendering logic (`src/lib/extract.ts` and related), verified against known fixture projects.

Explicitly out of scope for this workstream: the ports-and-adapters refactor itself, the later unit-test suite for the isolated domain logic that refactor will expose, and telemetry. Those are separate, later pieces of work.
