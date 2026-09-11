---
id: WS-110-ccijqv
type: workstream
workstream: WS-110-ccijqv
slug: skill-update-silent-overwrite-warning
title: "Update button overwrites locally modified skill files with no warning"
status: ready
tags: [agentic-tools, ux]
created: 2026-09-11
updated: 2026-09-11
author: Anthony Koukoullis
depends_on: [WS-109-skrkxj]
links: [WS-107-do28jk]
---

Clicking "Update" in the Manage Integrations modal overwrites a tool's installed skill
files with the published release, with no warning, even when the files on disk carry
local hand-edits the install ledger never recorded.

## Where this came from

Found while planning WS-107-do28jk (read the installed skill suite's own version instead
of relying on the install ledger). That plan's design keeps the "Update available" chip
and button offered for a tool whose skills were installed by some means other than
FlowCharge's own installer — for example a manual sync or a hand edit — because the
install path already overwrites unconditionally for every FlowCharge-performed install,
and disabling Update for a ledger-less install was judged out of that plan's scope. The
user accepted that for WS-107-do28jk as-is, on the reasoning that anyone who hand-modifies
an open-source skill file should expect an update to overwrite it, the same as any other
software — and asked for this as its own workstream instead, because the real gap is
narrower than "modification is unsupported": today's Update button overwrites silently,
with no confirmation that local edits exist and are about to be lost.

## What this workstream is for

Decide and build a warning or confirmation step before Update overwrites a tool's skill
files, for the case where the files on disk differ from what the ledger or the release
would write. Not yet planned: whether that comparison is feasible cheaply (a content hash
per skill file, most likely), what the confirmation should say, and whether it applies to
every tool or only the ones WS-107-do28jk's per-skill presence check covers (Claude Code
and OpenCode). Start with a plan.

## Not this workstream

Whether Update should be offered at all for a ledger-less install is already decided
(yes, in WS-107-do28jk) and is not open to revisit here. This workstream only adds a
warning before the existing overwrite, not a new restriction on who can update.
