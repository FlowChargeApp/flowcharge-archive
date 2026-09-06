---
id: WS-89-t2g5to
type: workstream
workstream: WS-89-t2g5to
slug: bun-cli-binary-packaging
title: "Ship FlowCharge Board as a Bun-compiled native CLI binary"
description: "D-26 makes a Bun-compiled native CLI binary the v1 release form for macOS, Linux and Windows: running the binary starts the existing local Node HTTP server and the user opens the board at localhost:4173. Electron stays a supported build path but is not v1's release form. Blocked behind WS-79-1fr8mp, which closes the last functional gap between the Electron and web/HTTP paths."
status: done
tags: [packaging, cross-platform, bun, cli]
created: 2026-09-04
updated: 2026-09-04
author: Anthony Koukoullis
depends_on: [WS-79-1fr8mp, WS-93-pxw80u]
links: []
---

Compile FlowCharge Board with `bun build --compile` into native CLI binaries for macOS (x64 and arm64), Linux and Windows, as v1's release form.

## Why now

Decision D-26 in `Praxis-Business/strategy/02-decision-log.md`, recorded just now and superseding D-15, sets v1's release form: FlowCharge Board ships as a Bun-compiled native CLI binary for macOS, Linux and Windows. Running the binary starts the existing local Node HTTP server, and the user opens the board in a browser at `localhost:4173`. Electron stays a supported build path, but it is not v1's release form. Code signing and notarization are deferred by the same decision, with no set trigger.

## Scope

- `bun build --compile` targets for macOS (x64 and arm64), Linux and Windows.
- Wire the existing entry point, `src/server.ts`. Confirmed by prior investigation: it already has zero runtime npm dependencies and uses only Node builtins, so nothing has to be vendored or shimmed for a compiled binary.
- Define the output binary naming and versioning scheme. Version starts at `0.1.0`, matching flowcharge-core's own reset to `v0.1.0` for consistency across the two public repos — not `1.0.0`, which was only `package.json`'s npm-init default and has been corrected there directly (no workstream needed for that one-line fix).

## Dependency

This workstream depends on WS-79-1fr8mp, the `integrations-http-transport` workstream at `flowcharge/workstreams/WS-79-1fr8mp-integrations-http-transport/`. That workstream is already planned and spec-tasked in this project, but it is NOT YET EXECUTED. It closes the one functional gap between the Electron path and the web/HTTP path — the "Manage integrations" feature. Until it is executed, a CLI binary would ship with that feature broken relative to the Electron build. That is the reason for the `depends_on` link, not a preference about ordering.

## Not in scope

Code signing and notarization, per D-26's deferral (see the separate parked workstream). The public release repository and the release process are their own workstreams.
