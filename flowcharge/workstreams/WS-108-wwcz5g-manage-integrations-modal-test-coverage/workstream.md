---
id: WS-108-wwcz5g
type: workstream
workstream: WS-108-wwcz5g
slug: manage-integrations-modal-test-coverage
title: "Manage Integrations modal has no test coverage"
status: done
tags: [testing, agentic-tools, feature]
created: 2026-09-11
updated: 2026-09-11
author: Anthony Koukoullis
depends_on: [WS-107-do28jk]
links: [ISS-42-q1t9bh, WS-107-do28jk]
---

Nothing tests the Manage Integrations modal, which let two wrong status labels — "Missing skills" and "Version unknown" — ship behind a fully green test suite.

## Background

`src/public/home.ts` has zero test coverage, and `package.json` has no UI test tooling at all today. The existing skill-presence unit tests (`src/test/unit/agentic-tools-skill-presence.test.ts`) use fake ids (`prx-alpha`, `prx-beta`, `prx-gamma`), never the real shipped skill suite, so nothing would have caught `CANONICAL_PRAXIS_SKILL_IDS` drifting from the real suite (`ISS-42-q1t9bh`, `WS-106-1xers0`). `src/test/unit/server.test.ts:49-131` checks the integrations route's response shapes and guards only, never the modal's own label logic.

## What to build

Start with a test that pins the real, currently shipped skill-suite id list against whatever the fixed presence check compares against, so a future rename or addition is caught automatically instead of drifting silently again. Then add coverage for the modal's chip-rendering logic in `home.ts` — the row eligibility and label rules — including the version-display logic once `WS-107-do28jk` builds it.

## Constraints

- No new runtime dependency (including a UI test framework) without asking first; record any added in `ARCHITECTURE.md` section 9.
- `src/public/` code sees no Node types, and stays DOM-only per `src/public/tsconfig.json`; any new test tooling must respect that split.

## Not yet planned

No plan, issue list or task list has been authored for this workstream. Start with a plan, once `WS-106-1xers0`'s presence fix and `WS-107-do28jk`'s version-read feature have a settled design to test against.
