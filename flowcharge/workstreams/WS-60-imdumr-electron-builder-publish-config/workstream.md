---
id: WS-60-imdumr
type: workstream
workstream: WS-60-imdumr
slug: electron-builder-publish-config
title: "Add a GitHub Releases publish target to electron-builder"
description: "Configure electron-builder's publish block to upload built installers as GitHub Release assets, generating the update-manifest files that a future real auto-update mechanism would need."
status: done
tags: [packaging, electron]
created: 2026-08-22
updated: 2026-08-22
author: Anthony Koukoullis
depends_on: [WS-59-79vhz6]
links: []
---

Configure electron-builder's `publish` block so `electron-builder --publish` can upload the built installers (dmg/zip/deb/AppImage/nsis) as assets on a GitHub Release, instead of only writing them to the local `release/` folder as it does today.

This came out of the same distribution consultation as WS-58 and WS-59. The recommendation: add the `publish` config now, even while the app only notifies about updates rather than auto-installing them, because it generates the `latest.yml`/`latest-mac.yml` manifest files that `electron-updater` would need later — making a future move to real auto-update small. This is a build-config change only: it does not add electron-updater as a dependency, does not change what gets built, and does not itself perform a publish (no upload runs as part of `npm run build`; a real publish only happens if someone later runs an explicit publish command, which requires a token this workstream must not hardcode).

Like WS-59, this depends on the actual public GitHub distribution repository existing (see the Praxis-Business pre-launch checklist, item 16) — the owner/repo value should be a clearly-commented placeholder, consistent with WS-59's own placeholder approach, not a guessed final value.
