---
id: WS-50-wnvfyq
type: workstream
workstream: WS-50-wnvfyq
slug: security-hardening
title: "Harden the dashboard server, Electron IPC, and file handling against unauthenticated and unvalidated access"
status: done
tags: [security, server, electron, filesystem, issue]
created: 2026-08-21
updated: 2026-08-21
author: Anthony Koukoullis
depends_on: []
links: []
---

Fix the security findings from a full audit of the dashboard: unauthenticated LAN API access, an unvalidated Electron IPC file path, a port-squatting risk, and more.

This covers every finding from the security audit except finding 2 ("Agent skill content is fetched over cleartext HTTP with no integrity check") — that one is deliberately left off. The interim HTTP URL will be replaced once the Praxis repo is published to GitHub with proper versioning and a releases page, and the two related sub-issues (uncapped decompression, tar-path traversal) are filed here as parts of findings 6 and 7 since they are independent of which URL is used. Finding 2 itself, and how the app should fetch pinned releases from GitHub once that repo exists, will be planned separately later.

Full finding list covered here: DNS-rebinding exposure, a fixed-port squatting risk in the Electron main process, an uncapped gzip decompression in the skill-archive fetch, a Windows-only tar-path traversal gap in the same fetch, a missing Content-Security-Policy, an incomplete prefix check in the static file server, and unsigned/unnotarized packaged builds.
