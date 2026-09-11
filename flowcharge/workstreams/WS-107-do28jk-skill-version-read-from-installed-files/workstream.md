---
id: WS-107-do28jk
type: workstream
workstream: WS-107-do28jk
slug: skill-version-read-from-installed-files
title: "Read the installed skill suite's own version instead of relying on the install ledger"
status: ready
tags: [agentic-tools, versioning, feature]
created: 2026-09-11
updated: 2026-09-11
author: Anthony Koukoullis
depends_on: []
links: [ISS-42-q1t9bh]
---

The Manage Integrations modal shows "Version unknown" and can never show "Update available", because FlowCharge never reads the version already written inside each installed skill file.

## Background

Every installed `SKILL.md` carries a nested `metadata:\n  version: "0.1.0"` field in its frontmatter. The whole FlowCharge Core suite shares one collective version — no individual skill file ever ships a version bump on its own. The user built this: every skill file already carries the shared version number.

What was never built is the read side. The modal's version chip reads only `record.version` from the install-tracking ledger (`src/public/home.ts:582-587`, sourced from `GET /api/integrations/installs`), never the installed file itself. FlowCharge writes that ledger only for installs it performs itself. A user who installs or syncs the suite by any other means leaves the ledger empty, so the chip reads "Version unknown" even when the suite is correctly and completely installed, and the "Update available" chip, gated by the same ledger record, can never fire for them either.

Confirmed directly by the user on 2026-09-11: this is a missing feature, not a defect to correct. They intended to build the read of the installed file's own version and never did.

## What to build

Read the version out of each installed skill's own `SKILL.md` frontmatter (`metadata.version`) directly from disk, for Claude Code and OpenCode at global scope, and use that reading — not the install ledger — to drive both the version display and the "Update available" comparison.

## Constraints

- No new runtime dependency without asking first; record any added in `ARCHITECTURE.md` section 9.
- Hexagonal split: `src/ports/` carries no imports; `src/core/` knows no transport; `src/http/` never touches the filesystem directly, only through the injected `BoardApi`.
- `src/lib/agentic-tools-skill-presence.ts` deliberately checks presence independently of the install-tracking ledger — a documented, accepted decision. Reading a version from disk for display is not the same as making presence depend on the ledger; do not blur the two.
- Each coding tool (Claude Code, OpenCode) is still checked and read separately.
- This is a separate deliverable from ISS-42-q1t9bh's fix (`WS-106-1xers0`), which corrects what list of skill ids presence is checked against. Both touch `src/lib/agentic-tools-*` and `src/public/home.ts`, but the version read is new capability, not a correction to that issue.

## Not yet planned

No plan, issue list or task list has been authored for this workstream. Start with a plan.
