---
id: WS-95-3r4cg5
type: workstream
workstream: WS-95-3r4cg5
slug: homebrew-tap-for-cli-binary
title: "Distribute the FlowCharge Board CLI binary through a Homebrew tap"
description: "A personal tap repo (a repo such as homebrew-flowcharge holding one Formula/flowcharge.rb) that downloads a GitHub Release asset by URL, verifies its sha256 and installs it into bin/. Homebrew's own fetch does not set the quarantine attribute, so brew install sidesteps the unsigned-binary Gatekeeper block a browser download would hit, with no code signing or notarization. Not a homebrew-core submission: that tap requires notability (30 forks / 30 watchers / 75 stars) and generally expects building from source, neither of which fits a new project distributing prebuilt Bun binaries. Scope is the tap repository, the formula, and whatever bumps the formula's version and per-platform sha256 on each release — not redoing the release process WS-91-mecfuo already built."
status: done
tags: [packaging, cli, versioning, cross-platform, feature]
created: 2026-09-04
updated: 2026-09-04
author: Anthony Koukoullis
depends_on: [WS-91-mecfuo]
links: []
---

Stand up a Homebrew tap so macOS and Linux users can `brew install` the FlowCharge Board CLI binary instead of downloading a raw GitHub Release binary.

## Why a tap

`brew install <owner>/flowcharge/flowcharge` replaces downloading a raw binary from GitHub Releases. A binary downloaded through a browser would otherwise hit an unsigned-binary Gatekeeper block. Homebrew's own fetch mechanism does not set the quarantine attribute that triggers Gatekeeper, so a tap sidesteps that problem entirely rather than requiring code signing or notarization.

## A personal tap, not homebrew-core

This is a personal/custom tap — a repo such as `homebrew-flowcharge` holding one `Formula/flowcharge.rb` — not a submission to the official `homebrew-core` tap.

- `homebrew-core` requires notability (30 forks / 30 watchers / 75 stars) that a new project does not have.
- `homebrew-core` also generally expects building from source rather than fetching a prebuilt binary, which does not fit this project's Bun-binary distribution model.
- A personal tap has no such bar: one repo, one Ruby formula file that downloads a GitHub Release asset by URL, verifies its sha256, and installs it into `bin/`. No review process — the maintainer merges their own PR.

## Keeping the formula current

The formula needs a version bump and a fresh sha256 per platform release binary each time a release is cut. That bump should be scripted alongside — or triggered from — the existing release process this repo already built in workstream WS-91-mecfuo (`.github/scripts/release.mjs` and `publish-release.mjs`, which build and publish the four Bun binaries — darwin-arm64, darwin-x64, linux-x64, win-x64 — to GitHub Releases on the separate `flowcharge-public` repository).

## Scope

This workstream's job is to add the tap repository, the formula, and whatever bumps the formula's version and checksums on each release. It is not to redo the release process itself.

## Ordering

Depends on WS-91-mecfuo (Bun binary release process, done — release binaries and a release process now exist to point the formula at). It is a prerequisite for WS-92-t964y8 (rewriting this repo's own README around FlowCharge Board's public positioning and real install instructions): that README rewrite should be able to document `brew install` as the recommended macOS/Linux install method once the tap exists. This workstream is therefore inserted into the chain between WS-91-mecfuo and WS-92-t964y8, not appended after WS-94.

## Timing

The user has not asked for a plan or tasks yet. Record this as a backlog workstream only, matching the pattern used to add and later start WS-91.
