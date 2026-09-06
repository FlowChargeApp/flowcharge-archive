---
id: WS-81-qkgk3t
type: workstream
workstream: WS-81-qkgk3t
slug: integrations-release-install-version-detection
title: "Install FlowCharge Core releases from Manage Integrations, with version and update detection"
description: "The Manage Integrations installer is a live 404 today: src/lib/skill-content-fetch.ts pins PRAXIS_REPO_REF at 'master', but the sibling repo renamed that branch to 'main', so every 'Install selected' fails for every user. Beyond that fix, installs should come from real FlowCharge Core releases: Gitea's GitHub-compatible release API is live (v0.1.0, asset flowcharge-skills-0.1.0.zip), the newest release should list at the top, and an installed-but-older version should show an update is available with a one-click update. Three obstacles: the release zip has no top-level dir and no skills/ prefix the current archive parser expects, InstallRecord carries no version field at all (it is content-hash addressed), and the whole install pipeline is in-memory with no zip ever written to disk."
status: done
tags: [agentic-tools, versioning, bug]
created: 2026-08-30
updated: 2026-08-30
author: Anthony Koukoullis
depends_on: []
links: []
---

Point "Manage integrations" at real FlowCharge Core releases — fix the live 404, install the latest release's zip asset, and detect the installed version so an older one offers a one-click update.

## What the user wants

The Manage Integrations feature should install the latest FlowCharge Core release, listed at the top. It should grab the release's zip asset, download it to a destination, unzip it, install it, and remove the zip. It must also detect the currently-installed version and, if older than the latest release, show that an update is available with a one-click update (same download/unzip/install flow).

## Current state, confirmed by direct investigation, including live probes of the real Gitea host

### 1. The installer is currently broken — a live 404

`src/lib/skill-content-fetch.ts:38-39` fetches `PRAXIS_REPO_BASE_URL = 'http://100.87.185.97:8110/akoukoullis/Praxis'` at `PRAXIS_REPO_REF = 'master'`, building `{base}/archive/master.tar.gz`. The sibling repo's branch was renamed `master` -> `main` and this constant was never updated: `.../archive/master.tar.gz` returns HTTP 404 right now; `.../archive/main.tar.gz` and `.../archive/v0.1.0.tar.gz` both return HTTP 200 (verified live). "Install selected" currently fails for every user with `Failed to fetch FlowCharge Core skill archive: 404 Not Found`. This needs fixing regardless of anything else in this workstream, and is arguably urgent enough to land first/separately from the rest.

### 2. Gitea's release API is live and reachable, and is GitHub-compatible

Verified live: `GET http://100.87.185.97:8110/api/v1/repos/akoukoullis/Praxis/releases` and `.../releases/latest` both return HTTP 200 with the same one release: `tag_name: "v0.1.0"`, `name: "FlowCharge v0.1.0"`, `published_at: "2026-08-29T20:31:55+10:00"`, `draft: false`, `prerelease: false`, and `assets[0]`: `name: "flowcharge-skills-0.1.0.zip"`, `size: 160057`, `browser_download_url: "http://netplex:8110/akoukoullis/Praxis/releases/download/v0.1.0/flowcharge-skills-0.1.0.zip"`. `GET .../tags` also works.

- **Host mismatch to design around:** every URL the Gitea API returns uses hostname `netplex`, not the IP `100.87.185.97` the app is pinned to. `netplex` happens to resolve on this machine, but following `browser_download_url` verbatim is fragile — the design should build download URLs from the app's own `PRAXIS_REPO_BASE_URL` plus the API-supplied path/tag, not blindly follow the API's own absolute URLs.
- **The release zip's internal layout differs from the branch tarball's.** The tag tarball (`archive/v0.1.0.tar.gz`) has entries like `praxis/skills/fc-bug-hunt/SKILL.md` (one top-level dir, then `skills/`) — this matches what the current parser expects (it strips the top dir, then keeps only `skills/`-prefixed paths, `skill-content-fetch.ts:240-243`). The release asset zip (`flowcharge-skills-0.1.0.zip`) has entries like `fc-bug-hunt/SKILL.md` directly — **no top-level dir, no `skills/` prefix.** The existing parsing logic would discard every entry from the release zip unmodified.

### 3. No version field exists anywhere in the install record

`src/lib/agentic-tools-install-tracking.ts:14-22`'s `InstallRecord` interface has `toolId`, `resolvedPath`, `format`, `scope`, `installedAt`, `updatedAt`, `contentHash` — no tag, no commit SHA, no release id, no semantic version. It is content-addressed (SHA-256 of the skill bodies, `agentic-tools-content.ts:48-55`), not version-addressed. "The installed version is older" is literally unanswerable today without adding a version field to this record. `parseInstallRegistry` does no per-record shape validation and casts through (`agentic-tools-install-tracking.ts:33-40`), so adding an optional field is backward-compatible with existing records.

### 4. The install mechanism is entirely in-memory — no zip ever touches disk today, and there is no "download/unzip/delete" step to reuse

`installToTarget` (`src/lib/agentic-tools-install.ts`) takes already-fetched `InstallContent` as a parameter; it never fetches. The full existing pipeline is: HTTP response -> capped in-memory `Buffer` -> `gunzipSync` in memory -> a hand-rolled tar parser (`skill-content-fetch.ts:149-174`) -> `SkillContent[]` in memory -> `FileWrite[]` (plain strings) -> individual UTF-8 text files written directly to the destination via `writeTextFileAtomic`. No temp directory, no zip file, nothing deleted afterward, because nothing was ever written as an archive.

- Reproducing the user's literal description (download a real zip file to a destination, unzip it, install, delete the zip) would need a **hand-rolled zip reader** (central-directory parsing + `zlib.inflateRawSync`) or the **project's first-ever runtime dependency** — `package.json` currently has zero runtime dependencies, everything is devDependencies — plus a **binary write port**, since `FsWriteAccess` (`agentic-tools-install.ts:35-41`) and its adapter (`agentic-tools-fs-adapter.ts:95-99`) are text-only, hardcoded to `'utf8'`.
- The much smaller alternative: keep the in-memory architecture (fetch the release zip's bytes, unzip in memory instead of un-tar-gz in memory, write the resulting files exactly as today), and never actually write a zip file to disk at any point. This satisfies "download and install the release's zip content" without literally writing/deleting a zip file on disk.
- This is a real design fork worth deciding explicitly at the plan stage, not something to silently pick.

### 5. The UI has no version display of any kind today, and doesn't even read the install registry

The whole integrations dialog has: a title, a Global/Project scope control, two tool-list tabs, a Re-scan button, an Install selected button, and per-row confidence/status chips (`'Confirmed'`, `'Likely'`, `'Weak signal'`, `'Not detected'`, `'Installed'`, `'Updated'`, `'Up to date'`, `'No format for this tool'`, `'Already installed'`, `'Missing skills'`) — none of them version-aware. `'Up to date'` means "byte-identical to what I just downloaded" (a hash match), never "you have the newest release". `getInstallStatus()` exists on the API surface and returns `InstallRecord[]`, but `home.ts` never calls it — a deliberate prior removal, per its own comment at `home.ts:433-435`.

### 6. "Latest version at the top of the list" is entirely new territory

There is no ordering concept anywhere in this feature today — row order is fixed catalogue order, and the install registry is an unordered array keyed by `(toolId, scope)`. Nothing sorts by date, version, or recency anywhere in the codebase.

## A related, pre-existing defect surfaced during investigation, worth deciding whether it is in scope here

`src/lib/agentic-tools-canonical-skills.ts:13-22` still lists eight `prx-*` skill ids (e.g. `prx-orchestrate`, `prx-git`), but the sibling repo's release actually ships eight `fc-*` skills (confirmed from the real release's changelog body, which lists `skills/fc-*` folders). `checkSkillPresence` therefore probes paths the installer never writes, so the `'Already installed'` chip can never correctly appear even after a correct install. That file's own header comment already calls itself provisional. This may need fixing as part of getting version/update detection actually working end-to-end, or may be its own separate concern — worth flagging either way.

## Also worth noting, not necessarily in scope

A multi-tool install currently re-downloads the full archive once per selected tool (`getInstallContent` is called once per target in both the Electron and HTTP install loops) — an existing inefficiency, unrelated to this feature but adjacent to it.

## Files in play

`src/public/home.ts`, `src/public/index.html`, `src/lib/agentic-tools-*.ts`, `src/lib/skill-content-fetch.ts`, `electron/agentic-tools-ipc-handlers.cts`, and the `/api/integrations/*` routes in `src/server.ts`.
