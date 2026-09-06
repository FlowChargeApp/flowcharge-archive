---
id: WS-48-hsf9yl
type: workstream
workstream: WS-48-hsf9yl
slug: skill-content-fetch-from-git
title: "Fetch Praxis skill content from a git repo instead of vendoring it"
status: done
tags: [agentic-tools, git]
created: 2026-08-20
updated: 2026-08-20
author: Anthony Koukoullis
depends_on: []
links: []
---

Replace the vendored (bundled-copy) approach to Praxis skill content with a live fetch-at-install mechanism that pulls the skill files from a real git repo at install time.

## Background

WS-44 vendored the Praxis skill suite into this repo (`skills/`, `tools/sync-praxis-skills.mjs`, `src/lib/skill-content.ts`) as a stand-in `getInstallContent` reader, because the sibling `Praxis` repo had no remote at authoring time. That is no longer true: the user now runs a self-hosted Gitea instance, reachable at all times over Tailscale, with real repos already created for `Praxis` and `Praxis-Dashboard`:

- `http://100.87.185.97:8110/akoukoullis/Praxis.git` (public-read)
- `git@netplex:akoukoullis/Praxis.git`

Bundling was rejected as a permanent approach: every Praxis skill update would force a new Praxis Dashboard release, even when Dashboard itself had no changes. The user wants Dashboard to fetch, unzip, and read the latest Praxis skill content from the `Praxis` git repo at install time instead, so the two projects stay independently releasable.

## Decision

- Use the Gitea `Praxis` repo URL above as the fetch source for now. It is public-read, so no credentials are needed.
- This URL is a development stand-in only. When Praxis is published to its final public location (expected to be GitHub), only the URL needs to change, not the fetch mechanism — design the fetch code as a generic "download an archive from this URL, then unzip it" step, not something Gitea-specific.
- No vendored/bundled fallback copy is wanted. If the fetch fails (e.g. Gitea unreachable), that is an acceptable failure — this is not a production concern today, since neither Praxis nor Praxis Dashboard is public yet.
- WS-44's vendored deliverables (`skills/`, `tools/sync-praxis-skills.mjs`, `src/lib/skill-content.ts`, `src/lib/skill-content.test.ts`) are to be removed as part of this workstream, since they are being superseded, not kept as a fallback.
- WS-44's plan Phase 4 (wiring the vendored reader into `electron/agentic-tools-ipc-handlers.cts`'s placeholder `getInstallContent`) is superseded by this workstream: the real wiring now happens against the new fetch-based reader instead.

## Requested flow for this workstream

1. Investigate the codebase to determine the best way to implement a fetch-unzip-read mechanism for skill content, including removal of WS-44's vendored deliverables.
2. Write a plan based on the investigation's findings.
3. Author spec-mode tasks from the plan.
4. Cut a feature branch.
5. Execute the tasks (gated).
