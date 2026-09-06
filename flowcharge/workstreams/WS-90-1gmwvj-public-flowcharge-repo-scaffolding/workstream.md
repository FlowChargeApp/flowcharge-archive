---
id: WS-90-1gmwvj
type: workstream
workstream: WS-90-1gmwvj
slug: public-flowcharge-repo-scaffolding
title: "Scaffold the public flowcharge repository — binaries and docs, no source"
description: "FlowCharge Board needs a public GitHub home that carries release binaries and documentation only, never source, per Praxis-Business decision D-13. A fresh sibling folder with its own git init, a local-only noreply commit identity, README.md, CHANGELOG.md and SECURITY.md adapted from flowcharge-core-public. No LICENSE file: D-13 settles that the repo carries no public licence at all. Open question instead: whether the binary itself needs separate EULA/terms-of-use wording."
status: done
tags: [documentation, closed-source, git, licensing]
created: 2026-09-04
updated: 2026-09-04
author: Anthony Koukoullis
depends_on: [WS-89-t2g5to]
links: []
---

Build the public `flowcharge` repository as a new permanent sibling folder that carries release binaries and documentation only — no source code, ever.

## Why this repo differs from flowcharge-core's

Per Praxis-Business decision D-13, FlowCharge Board "has no public source repository, under any licence. It ships only as a compiled, signed desktop application". So this app's public presence differs fundamentally from flowcharge-core's: the public repo carries release binaries and documentation only, never source code. No git-archaeology or export mechanism is needed the way it was for the flowcharge-core split, because there is no source to export.

## Shape

- A new, permanent sibling folder, not derived from this repo's git history at all — nothing crosses over.
- Fresh `git init -b main`.
- Local-only noreply commit identity, matching the discipline the flowcharge-core split used: a GitHub-account-derived noreply email set with `git config --local`, never touching the global personal email config.

## Content

Use `/Users/akoukoullis/Work/AK/flowcharge-core-public/` as the model and copy or adapt its already-authored documentation wherever it fits this different repo's shape.

- `README.md` — reuse flowcharge-core-public's README structure and section shape where it fits a docs-only repo: an idea section, an install/download section in place of flowcharge-core's clone instructions, and a security section pointing at SECURITY.md. Pull the "free to use, source not published" positioning language from `Praxis-Business/strategy/00-positioning.md` and from `05-branding-strategy.md`'s honesty rule — "say it before somebody asks" — verbatim or closely paraphrased.
- `CHANGELOG.md` — Keep a Changelog format, matching flowcharge-core-public's structure. Superseded by the plan's own choice: it opens with `## Unreleased` instead, since no binary has been built or published yet at scaffolding time — the `## 0.1.0 - <date>` heading lands later, when WS-91-mecfuo ships the first binary, not `1.0.0`.
- `SECURITY.md` — adapt flowcharge-core-public's actual content (GitHub private vulnerability reporting, response-time commitments, scope) to this app: a compiled binary distributed via GitHub Releases, not a skill suite of scripts.

## Licence — settled, no LICENSE file

Checked against Praxis-Business directly. **D-13** states this plainly: "The licence question for the Board is moot. There is nothing to licence publicly." Checklist item 1 in `04-pre-launch-checklist.md` confirms it: "The Board carries no public licence; it is never published in source form, in any licence (D-13)." So the repo ships with no LICENSE file and no licence badge — not a proprietary notice standing in for one, just silence on the question, because there is no source to attach a licence to.

## Open question — decide before the first commit

A licence for source and a EULA/terms-of-use for a downloaded binary are two different documents. D-13 settles the first (none needed) but says nothing about the second: what terms, if any, govern someone who downloads and runs the compiled binary — redistribution, reverse-engineering, resale. Nothing in Praxis-Business addresses this. Recommendation: don't draft a formal EULA unless there's something specific to enforce — a one-line copyright notice with no licence grant (`Copyright © 2026 Anthony Koukoullis. All rights reserved.`) in the README footer already withholds redistribution/modification rights by default, with no document to maintain. A real EULA is a legal decision, not a technical one, and should go to a lawyer if wanted.

## Repo location

Interim location per `Praxis-Business/strategy/04-pre-launch-checklist.md` item 21: `akoukoullis/flowcharge`. This is explicitly not the final placement; it presumably migrates under the `FlowChargeApp` GitHub org later, matching flowcharge-core's home, once the user is ready.

## Timing

The user is not ready to create any releases yet. This is setup and backlog work, to be planned and executed later, and the user will create the GitHub repo themselves when ready.
