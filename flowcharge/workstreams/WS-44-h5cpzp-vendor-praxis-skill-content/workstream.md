---
id: WS-44-h5cpzp
type: workstream
workstream: WS-44-h5cpzp
slug: vendor-praxis-skill-content
title: "Vendor the Praxis skill suite into this repo as the installer's real content source"
status: dropped
tags: [feature, agentic-tools, tooling, group2]
created: 2026-08-18
updated: 2026-08-20
author: Anthony Koukoullis
depends_on: []
links: []
---
Vendor a real copy of the Praxis skill suite from its own development repo into this repo, so the skill-install feature (WS-41 through WS-43) has real content to write instead of placeholder fixtures.

This repo has no copy of the actual Praxis skill content anywhere — confirmed during WS-42's investigation. The real prx-orchestrate skill and its siblings (prx-bug-hunt, prx-dev-principles, prx-git, prx-issue-list, prx-plain-text-kanban, prx-plan-feature, prx-task-list — the whole prx- prefixed suite, not prx-orchestrate alone) are developed in a separate, sibling repo on this machine: /Users/akoukoullis/Work/AK/Praxis, which has its own git history and its own skills/ directory. That repo has no remote configured, so a build-time fetch is not viable — it would only work on this one machine. The user confirmed the sibling-folder location is durable and will keep existing there.

Chosen approach, per prior discussion: not a one-time copy-paste, and not a build-time fetch. Add one small sync script, in the style of this repo's existing tools/copy-assets.mjs, that copies the current Praxis repo's skills/ content into this repo at a known location, run by hand when the user wants to refresh it, with the result committed. This keeps builds self-contained (no network step, no dependency on the Praxis repo being present at build time on someone else's machine) while keeping updates one command away.

Scope: the whole prx- prefixed skill suite gets vendored, not prx-orchestrate alone — prx-orchestrate's own templates reference sibling skills by name (e.g. /prx-dev-principles, /prx-plan-feature, /prx-issue-list), so installing it alone would ship a skill that references skills the target machine does not have.

This workstream has no dependency on WS-41/WS-42/WS-43 executing — it can run at any time. Once it lands, WS-42's getInstallContent port (currently backed by a placeholder/fixture) can be wired to read from this workstream's real vendored output, closing Gap 1.

**Dropped 2026-08-20.** Superseded by WS-48 (skill-content-fetch-from-git): the user rejected bundling as a permanent approach — it forces a Dashboard release on every Praxis update — in favor of fetching skill content live from a git repo at install time. WS-48 deleted this workstream's vendored deliverables (`skills/`, `tools/sync-praxis-skills.mjs`, `src/lib/skill-content.ts`, `src/lib/skill-content.test.ts`) and wired the real IPC connection itself, so this workstream's own Phase 4 will never execute.
