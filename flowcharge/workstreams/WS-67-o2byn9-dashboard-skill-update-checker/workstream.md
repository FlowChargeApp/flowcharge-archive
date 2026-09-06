---
id: WS-67-o2byn9
type: workstream
workstream: WS-67-o2byn9
slug: dashboard-skill-update-checker
title: "The Dashboard cannot tell an installed skill from the latest released one"
description: "Build the Dashboard's update checker against the latest GitHub Release manifest, classifying each installed skill as current, outdated, locally-modified or unknown-or-forked, and repoint its skill-fetch URL from the private Gitea host to the public GitHub repo."
status: backlog
tags: [versioning, packaging, launch]
created: 2026-08-24
updated: 2026-08-29
author: Anthony Koukoullis
depends_on: []
links: []
---
Make the Praxis Dashboard compare each installed skill against the published release manifest and report whether it is current, outdated, modified, or forked.

Build or fix the Praxis-Dashboard's skill-update-check mechanism:

- Resolve the latest GitHub Release with `gh api repos/<owner>/<repo>/releases/latest`. Do not read `main` — track releases, not unreleased work.
- Fetch `skills/manifest.json` at that tag.
- Compare each locally installed skill's frontmatter `version` and content hash against the manifest.
- Classify each skill as: current; outdated (report the semver delta and whether it is a major, minor or patch change); locally-modified (hash differs at the same version — warn before overwriting); or unknown-or-forked (local version newer than remote, or no version key — never auto-update these).

This also needs the Dashboard's current skill-fetch URL repointed from its private Gitea host to the public GitHub repo. That is item 14 of the pre-launch checklist.

It depends on the generated manifest existing, because the manifest it reads is the input.
