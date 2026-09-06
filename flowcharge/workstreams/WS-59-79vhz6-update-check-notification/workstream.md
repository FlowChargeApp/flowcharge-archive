---
id: WS-59-79vhz6
type: workstream
workstream: WS-59-79vhz6
slug: update-check-notification
title: "Check for newer app versions and notify the user"
description: "Periodically check the app's own published releases for a newer version than the one currently running, and notify the user with a dismissible, non-modal banner when one exists."
status: done
tags: [packaging, electron, ui, ux, feature]
created: 2026-08-22
updated: 2026-08-22
author: Anthony Koukoullis
depends_on: [WS-58-06dvnk]
links: []
---

The packaged Electron app must check whether a newer version has been released, and tell the user with an unobtrusive, dismissible notice — not a bare bubble/dot and not a modal dialog.

This came out of the same distribution consultation as WS-58 (which this workstream depends on for `getAppVersion()`). The recommendation: do NOT adopt `electron-updater` yet, because real silent auto-update needs code-signed builds on both macOS (Squirrel.Mac refuses an unsigned update) and Windows, and this app is unsigned today. Instead, hand-roll a small check: request the distribution channel's "latest release" endpoint from the main process (never the renderer directly — this app's CSP sets `connect-src 'self'`, so any external network call must happen in the main process or the server, then cross to the renderer over the existing IPC bridge), compare semver against the running version, and — only when a newer version is confirmed — show a dismissible, non-modal banner/toast naming the new version with a link to the release page. Check once at startup, then at most once a day; remember the last-checked time and the last version the user dismissed, so a dismissed notice does not reappear for that same version. Add a setting the user can use to turn the check off entirely, since this is the app's first outbound network call and its README currently states there is no telemetry — that claim needs a one-line update either way.

The exact distribution channel (which URL the check hits) depends on a decision made outside this codebase (a GitHub repo for release binaries, see the Praxis-Business pre-launch checklist) — the plan should read that as an assumption it is free to record, using GitHub's public Releases API shape as the working example, since that channel was the consultation's own recommendation.
