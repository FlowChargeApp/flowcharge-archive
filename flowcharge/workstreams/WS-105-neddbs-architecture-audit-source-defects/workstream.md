---
id: WS-105-neddbs
type: workstream
workstream: WS-105-neddbs
slug: architecture-audit-source-defects
title: "Close five source defects: untracked state files, unbounded release fetches, library logging, unreachable remove wiring and stale comments"
description: "Five defects surfaced while auditing the newly written ARCHITECTURE.md against the source. None was introduced by that audit and none is a documentation problem — the document now describes all five accurately. They are unrelated to each other and vary in severity, so they are filed as one issue list rather than one fix: the unbounded release fetches can hang an install request indefinitely and are the only one with a user-visible failure mode, while the stale comments are cosmetic. Deliberately excluded are four already-known gaps recorded elsewhere: the update-check repository placeholders, the missing package-lock.json against CI's npm ci, DEVELOPMENT.md's four-binaries claim, and the uncopied fonts."
status: in-progress
tags: [bug, maintenance, agentic-tools, hardening, server, issue]
created: 2026-09-10
updated: 2026-09-10
author: Anthony Koukoullis
depends_on: []
links: []
---

Five unrelated source defects found while auditing ARCHITECTURE.md against the code: two untracked state files, two fetches with no timeout, a logging library, dead remove wiring, stale comments.

## Where these came from

A `cl-fable-high` subagent audited the newly authored `ARCHITECTURE.md` against the
source, section by section, and corrected 37 statements in that document. While doing so
it found five defects in the **code** rather than the document. It was instructed not to
fix them and did not. The document now describes all five accurately, so nothing here is
a documentation task — each item is a real change to the source.

## The five, as the audit reported them

1. `.gitignore` omits `.praxis-installs.json` and `.praxis-telemetry.json`. An unpackaged
   run writes both to the repository root, where they are trackable. The file already
   ignores the other two state files, `.praxis-projects.json` and `.praxis-update.json`,
   so the omission is inconsistent rather than deliberate.
2. `skillReleaseFetch.fetchReleases` and `skillContentFetch.getInstallContent` make
   outbound `fetch` calls with no `AbortSignal.timeout`. A stalled release host stalls the
   install request indefinitely. Every other outbound call in the codebase — telemetry and
   the update check — carries a timeout, so these two are the exception.
3. `src/lib/skill-content-fetch.ts:330` logs from `src/lib/`, contrary to the "libraries
   return facts and log nothing" rule stated in every sibling module header. The
   established pattern is that the route boundary decides the wording.
4. `removeInstallation` is wired through the browser shim, the HTTP route and the Electron
   IPC channel, but no UI in `home.ts` calls it. The capability exists end to end and is
   unreachable.
5. Comments in `browser-ipc-shim.ts` and `ipc-adapter.ts` still describe a "six-method
   surface". The `PraxisAPI` interface has eight members — the six data methods plus
   `getAppVersion` and the optional `pickProjectFolder`.

## Constraints on any fix

- The project has **no runtime dependency** and must keep none. Every fix here is
  achievable with Node built-ins.
- Item 4 is the only one carrying a design question: whether to surface a remove control
  in the integrations modal, or to remove the unreachable wiring. That decision is the
  maintainer's and is not settled here.
- Item 2 is the only item with a user-visible failure mode and is the one worth doing
  first.

## Explicitly out of scope

Four already-known gaps, recorded deliberately elsewhere and confirmed by this same audit,
are **not** part of this workstream: the `TODO-REPLACE-OWNER` / `TODO-REPLACE-REPO`
placeholders in `src/lib/update-check.ts`; the absent `package-lock.json` against CI's
`npm ci`; `DEVELOPMENT.md`'s claim that `package:cli` produces four binaries when the
script defaults to three; and `DEVELOPMENT.md`'s claim that the asset copier copies the
fonts when it does not.
