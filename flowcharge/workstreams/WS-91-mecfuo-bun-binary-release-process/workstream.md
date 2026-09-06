---
id: WS-91-mecfuo
type: workstream
workstream: WS-91-mecfuo
slug: bun-binary-release-process
title: "Set up the FlowCharge Board Bun-binary release process"
description: "Adapt flowcharge-core-public's .github/scripts/release.mjs — version validation, dirty-tree/branch/tag refusals, a CHANGELOG heading match, an annotated tag, printed push commands — to an app that has no skills to stamp but does have three platform binaries to build and attach as GitHub Release assets, never as tracked files. SemVer, versioned independently of flowcharge-core."
status: done
tags: [packaging, versioning, tooling, git, feature]
created: 2026-09-04
updated: 2026-09-04
author: Anthony Koukoullis
depends_on: [WS-89-t2g5to, WS-90-1gmwvj]
links: []
---

Build the release process that cuts a versioned FlowCharge Board release: build the three-platform Bun binaries, tag, and attach the binaries as GitHub Release assets.

## Model to adapt

Adapt the logic of `/Users/akoukoullis/Work/AK/flowcharge-core-public/.github/scripts/release.mjs`: version validation, refusal on a dirty tree, refusal on the wrong branch, refusal on an existing tag, the requirement that `CHANGELOG.md` carries a matching heading, annotated tag creation, and printing the push commands rather than pushing itself.

## What changes for this app

- There are no skills to version-stamp here. Instead, the release script must trigger — or itself run — the three-platform Bun binary build.
- It then attaches the resulting binaries as GitHub Release assets via `gh release create`. The binaries are never committed or tracked files.
- SemVer versioning for this app's own releases, independent of flowcharge-core's version. The first release is `v0.1.0`, matching flowcharge-core's own reset to `v0.1.0` for consistency across the two public repos. `package.json`'s `version` field has already been corrected from `1.0.0` (the npm-init default, never a deliberate choice) to `0.1.0` directly, ahead of this workstream — the release script's version-validation step should read that field as already correct, not assume it needs raising to `1.0.0`.

## CI gate

Reuse flowcharge-core-public's `.github/workflows/ci.yml` pattern for a `test` CI gate if useful, adapted to this repo's own test setup. Confirmed gap: this repo currently has no `.github/` directory, no CI, and no `test` script in `package.json` at all, despite having `src/server.test.ts` and other `.test.ts` files under `src/lib`. Flag this explicitly — it may need its own preliminary fix, and it is tracked separately as the CI test gate workstream.

## Dependencies

Depends on the Bun CLI binary workstream (buildable binaries to publish) and on the public flowcharge repository workstream (a repo to publish into).

## Timing

The user is not ready to create any releases yet. This is setup and backlog work, to be planned and executed later.
