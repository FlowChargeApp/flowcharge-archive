---
id: WS-106-1xers0
type: workstream
workstream: WS-106-1xers0
slug: skill-install-target-resolution-and-lifecycle
title: "Fix the skill install subsystem: wrong target directories, partial removal, stale updates and tests that pin the defects"
description: "Half of the tool-and-scope combinations install FlowCharge Core into a directory the target tool never reads, and report success. Cursor and Windsurf at global scope get a doubled path; Claude Code and OpenCode at project scope lose the tool's config prefix. The root cause is one structural gap: IntegrationFormat states what its pathTemplate is relative to, and which scopes it is valid for, only in free-text notes that no code reads. The same record-shape problem makes removal delete one file of eight, and an update never deletes the previous install, which is live today because the suite was renamed prx-* to fc-*. Two unit tests assert the wrong paths as correct and so pin the defects in place. Found by reading the whole subsystem after an architecture audit surfaced one symptom of it."
status: in-progress
tags: [agentic-tools, bug, filesystem, hardening, testing, server, issue]
created: 2026-09-10
updated: 2026-09-10
author: Anthony Koukoullis
depends_on: []
links: []
---

Four of eight tool-and-scope combinations install FlowCharge Core where the target tool never reads, and report success; removal deletes one file of eight; updates never clean up.

## How this was found

An architecture audit of `ARCHITECTURE.md` against the source surfaced one symptom — that
`removeInstallation` is wired end to end with no UI reaching it. Pulling on that turned up a
structural problem underneath it, so the whole Manage-integrations path was read: detection,
the catalogue, content fetch, format selection, install, update, remove, presence checking,
the ledger, both transports, the modal and the tests. Roughly twenty files.

The path findings are not inferred. They were produced by running the compiled modules in
`dist/lib/` against the real `TOOL_CATALOGUE`, with real detection on this machine, and
printing the resolved write paths per tool per scope.

## The root cause

`selectPrimaryFormat` picks the first format in `tool.integrationFormats` whose kind is
implemented, with no knowledge of the install scope. `resolveBasePathForScope` picks a base
path with no knowledge of the format. `IntegrationFormat` declares what its `pathTemplate` is
relative to, and which scopes it is valid at, **only in a free-text `notes` string that no
code reads**.

Everything below follows from that one gap, or from the same record-shape problem in
`InstallRecord`.

## Where installs actually land

| Tool | Scope | Writes to | Tool reads | |
|---|---|---|---|---|
| Claude Code | global | `~/.claude/skills/<id>/SKILL.md` | same | correct |
| Claude Code | project | `<project>/skills/<id>/SKILL.md` | `<project>/.claude/skills/…` | WRONG |
| OpenCode | global | `~/.config/opencode/skills/…` | same | correct |
| OpenCode | project | `<project>/skills/…` | configDir-relative | WRONG |
| Cursor | global | `~/.cursor/.cursor/rules/<id>.mdc` | `<project>/.cursor/rules/*.mdc` | WRONG |
| Cursor | project | `<project>/.cursor/rules/*.mdc` | same | correct |
| Windsurf | global | `~/.codeium/windsurf/.devin/rules/*.md` | project-level `.devin/rules/`; global is `memories/global_rules.md` | WRONG |
| Windsurf | project | `<project>/.devin/rules/*.md` | same | correct |

Windsurf already declares a correct global format — `markdown-context-file` at
`memories/global_rules.md`. `selectPrimaryFormat` never reaches it, because `rule-directory`
sits earlier in the array.

Every wrong case fails silently. The modal reports "Installed".

## The findings, as analysed

1. **Global installs for Cursor and Windsurf land in an unread, doubled path.** Critical.
2. **Project installs for Claude Code and OpenCode omit the tool's config prefix.** Critical.
3. **`removeInstallation` deletes one file of N.** `InstallRecord.resolvedPath` is a single
   string and `installToTarget` keeps only the first write. A real install writes eight
   `SKILL.md` files plus every bundled reference file. High.
4. **An update never deletes the previous install's files.** Live today: the suite was renamed
   `prx-*` to `fc-*`, so anyone updating from a pre-rename install keeps both sets forever.
   High.
5. **Two tests assert the defective behaviour as correct**, so the suite is green and cannot
   catch 1 or 3. High.
6. **`ruleDirectoryWrites` and `singleDocumentWrite` silently drop `skill.files`.** Cursor and
   Windsurf receive SKILL.md bodies only; every bundled reference file vanishes. Medium.
7. **No interface control reaches `removeInstallation`.** Medium. Filed already as
   ISS-32-3hfjhe and moved into this workstream, because it sits behind 3, which sits behind
   the record-shape change.
8. **`installAllGlobal` reports every failure as `skipped-no-format`**, so a permissions or
   disk error reaches the user as "No format for this tool". Medium.
9. **`parseInstallRegistry` documents a wrong-shape rejection it does not perform.** Medium.
10. **The registry has no locking**, and `writeTextFileAtomic`'s temp file is keyed on pid
    alone. Medium.
11. **`CANONICAL_PRAXIS_SKILL_IDS` is a hand-maintained list** the presence check compares
    against, rather than what was installed. Medium.
12. **`installAllGlobal` is dead code.** Low.
13. **An empty skills array yields `resolvedPath: ''`, then `remove('')`.** Low.
14. **Paths are joined with a hardcoded `/`.** Low; Windows is not a shipping target.

## Fix order

The catalogue and format model must change first: `IntegrationFormat` needs a machine-readable
statement of what its `pathTemplate` is relative to and which scopes it is valid at. That one
change addresses findings 1, 2 and 6 together. `InstallRecord` must then carry the set of
paths written, or a single containing directory, which is the prerequisite for 3 and 4. The
tests in finding 5 must be corrected in the same change that fixes what they pin, or they will
block it. Only then is finding 7 — the missing remove control — worth building.

## Not in scope here

`ISS-29-m7w4dm` in `WS-105-neddbs` covers the two release-host fetches that carry no timeout.
Those calls sit on this subsystem's content path, so the two workstreams touch, but that issue
stays where it was filed rather than moving.

Deliberate and correctly documented, and therefore not defects: presence checking running only
at global scope, and `mcp-json` and `structured-config-file` formats being unimplemented.
