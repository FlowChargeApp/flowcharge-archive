---
id: WS-109-skrkxj
type: workstream
workstream: WS-109-skrkxj
slug: skill-install-engine-leftover-defects
title: "Skill-install-engine leftover defects"
status: backlog
tags: [agentic-tools, bug, filesystem, server, maintenance]
created: 2026-09-11
updated: 2026-09-11
author: Anthony Koukoullis
depends_on: []
links: [WS-106-1xers0]
---

Five distinct, already-diagnosed defects in the skill-install engine, none related to each other, moved here so WS-106-1xers0 can close.

## Where these came from

WS-106-1xers0 ("Fix the skill install subsystem") was opened after a full audit of the
install/removal/update code path turned up several unrelated defects at once, plus one
issue filed later during a separate investigation. The audit's main symptom — the
"Missing skills" and "Version unknown" chips in the Manage Integrations modal — is fixed
and closed. These six issues are what is left: real, separately confirmed defects that
never got a task list, because they are not related to each other or to the chip bug,
and bundling them into one workstream any longer was making WS-106 hard to read. They
are moved here as-is, unstarted, to be planned and tasked as their own piece of work.
Nothing about their content changed in the move.

## The issues

- **ISS-32-3hfjhe** — the install-removal capability is wired end to end (the code path
  exists and is tested) but no button or menu item in the UI ever calls it. A user can
  install through the app but cannot remove through the app. Status: blocked (on a UI
  design decision for where that control belongs).
- **ISS-38-gv3p2x** — two of the install format writers silently drop every bundled
  reference file an install is supposed to carry, instead of writing them alongside the
  main skill file.
- **ISS-46-j993sr** — an install's ledger record is written before `resolvedPaths` is
  fully populated, so it names only one path. A removal or cleanup driven from that
  ledger record cannot find the rest of what the install actually wrote.
- **ISS-47-yug5gc** — the presence check reports OpenCode's legacy singular `skill/`
  folder layout as "not installed" even when it holds the suite, because the check only
  recognises the current plural `skills/` folder.
- **ISS-50-92mh3i** — the code that fetches skill release content is hardcoded to a
  temporary local Gitea address on the developer's own network, not the public
  FlowCharge Core origin, so it cannot work for any user off that network.
- **ISS-51-kc70n7** — two of this project's own artefacts (a plan and an issue) name two
  different hosts as "the" release origin. May turn out to be resolved once the release
  republish discussed with the user lands; kept open until confirmed.

## Status

Not planned, not tasked. Left here deliberately, unstarted — the user will decide how to
sequence and split this work in a later session.
