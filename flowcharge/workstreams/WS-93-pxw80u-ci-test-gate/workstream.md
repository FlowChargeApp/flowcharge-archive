---
id: WS-93-pxw80u
type: workstream
workstream: WS-93-pxw80u
slug: ci-test-gate
title: "Add a CI test gate to this repo"
description: "This repo ships with zero automated verification: no .github/ directory, no CI workflow, and no test script in package.json, despite src/server.test.ts and several .test.ts files under src/lib/ that all use node:test directly. Find and record how those tests are actually invoked, then add a test job on push and PR, following flowcharge-core-public's ci.yml pattern."
status: done
tags: [testing, tooling]
created: 2026-09-04
updated: 2026-09-04
author: Anthony Koukoullis
depends_on: []
links: []
---

Give this repo a CI test gate: a `test` job on push and pull request that runs the repo's real test command.

## Confirmed state today

There is no `.github/` directory, no CI workflow, and no `test` script in `package.json` at all — despite this repo having `src/server.test.ts` and multiple `.test.ts` files under `src/lib/`. They all use `node:test` directly, and it is unclear how they are currently run. Investigate that and record the actual invocation command as part of this workstream.

## Approach

Adapt flowcharge-core-public's `.github/workflows/ci.yml` pattern — a `test` job on push and PR that runs this repo's actual test command. Gitea Actions runs GitHub Actions syntax, so one workflow serves both: this repo's origin is the same private Gitea host that flowcharge-core's working copy used.

## Relationship to other work

This is a prerequisite for, or at least pairs well with, the CI-gated release process in the Bun-binary release workstream. It blocks no other item, but it is genuinely pertinent, because this repo currently ships with zero automated verification.
