---
id: PLN-30-dos4hw
type: plan
workstream: WS-40-qxxfl9
slug: closed-source-readme-cleanup
title: "Closed-source reframe of README.md"
status: done
created: 2026-08-18
updated: 2026-08-19
depends_on: []
links: []
---

# Closed-source reframe of README.md

## Summary

README.md (101 lines, the only markdown file at the repo root) currently reads like a
public, clone-and-self-host open-source project. This repo is now a closed-source
project (an Electron desktop-app pivot is underway; this item is independent of that
pivot's other four workstreams). The plan reworks four specific spots in README.md —
add a closed-source notice, reword the title/intro, reword the Quick start framing,
and lightly reword one Notes-section line — leaving everything else in the file
untouched. There is no license or Contributing content anywhere in the repo to remove
(confirmed: no LICENSE file, no license badge, no `license` field in `package.json`,
which already has `"private": true`), so this is purely an additive-and-reworded
documentation edit, not a removal task. The chosen approach is a single direct edit
of README.md in place — no new files, no restructuring.

## Scope

**In scope — acceptance criteria:**

- A reader opening README.md sees a short closed-source notice within the first
  ~15 lines of the file, stating plainly that the repository is private and not for
  redistribution.
- The title/intro block (current lines 1-11) no longer reads with a public-project
  tone (no framing that invites an external audience to adopt or redistribute the
  project), while the existing `[Praxis](https://github.com)` link's URL and link
  text stay byte-for-byte unchanged (see Out of scope).
- The Quick start section (current lines 13-29) keeps the `npm install` / `npm start`
  commands verbatim, but its surrounding prose is reworded from "anyone who clones
  this repo" framing to "how to run this locally for development" framing.
- The Notes section's line "Works with any project that follows the Praxis `flowcharge/`
  convention, not just LAD" (current line 98) is lightly reworded so it reads as
  internal documentation of a true technical fact, not a public-facing selling point.
  The underlying fact (the extractor works with any `flowcharge/`-convention project,
  not only LAD) is preserved, only the framing changes.
- "How it fits together" (current lines 31-66) and the Scripts table (current lines
  68-78) are byte-for-byte unchanged — they are neutral technical reference.
- No LICENSE file, license section, license badge, or Contributing section is added.
  None exists today, and the source request does not ask for one.

**Out of scope:**

- Fixing, replacing, or removing the placeholder `https://github.com` link on line 3.
  It is dead/generic, but the source request does not ask for it to be fixed, and
  fixing it is not implied by "remove self-host framing, add a closed-source notice."
- Any change to package.json, source code, or any file other than README.md.
- Adding a LICENSE file or a license/Contributing section (nothing to migrate; not
  requested).
- Any change to the file-tree explanation or Scripts table content.

**Assumptions confirmed by investigation (taken as given, not re-verified beyond a
spot check):**

- No `.github/` directory and no badges/shields in README.md reference the current
  public framing (spot-checked: `.github` does not exist; no `badge`/`shield` string
  in README.md), so no secondary file needs updating alongside README.md.
- The four target spots are exactly as described in the workstream investigation:
  title/intro (lines 1-11), Quick start (lines 13-29), and Notes line 98, plus one
  new notice near the top.

**Assumptions still open (also listed under Open questions):**

- The exact wording of the closed-source notice. A draft wording is proposed in
  Design below and used as the working assumption for the task breakdown.
- Exact placement of the notice: this plan places it as a short paragraph
  immediately after the H1 title, before the existing intro paragraph, since "near
  the top" and maximum visibility both favor being first.

## Design

This is a documentation-only change with no code, data model, or interface surface.
"Design" here means the exact edit plan for each of the four target regions in
`README.md`, so the task breakdown has nothing left to improvise on structure —
only final phrasing is left open (flagged above).

**Target 1 — new closed-source notice (insertion, not present today).**
Insert immediately after the H1 (`# Praxis Board`, line 1) and before the existing
intro paragraph (current line 3). Draft wording, to confirm per Open questions:

> **Private repository.** This is closed-source software for internal use. It is not
> published, licensed for reuse, or intended for external redistribution.

**Target 2 — title/intro tone (current lines 1-11).**
Current text describes the dashboard's function neutrally ("A local, bird's-eye
Kanban dashboard for..."); the public-project tone comes from the combination of
this section with the Quick start section reading as onboarding for an unknown
external adopter. Edit: keep the functional description (what the board does, the
six-column layout, read-only design) but rework any phrasing that presumes an
external audience discovering the project for the first time, into phrasing that
documents the tool for its own (internal) continued use. The `https://github.com`
link stays exactly as-is per Out of scope.

**Target 3 — Quick start framing (current lines 13-29).**
The `npm install` / `npm start` code block (current lines 15-18) is unchanged
verbatim — those commands remain the correct way to run the project locally and
stay useful for this project's own future development. Reword the surrounding prose
(current lines 20, 23-24, 26-29) from language addressed to a generic new adopter
("Then open the home page and add a project...") toward language documenting the
local dev workflow for this project's own future work on it.

**Target 4 — Notes line 98.**
Current: "Works with any project that follows the Praxis `flowcharge/` convention, not
just LAD — add whichever projects you want to inspect on the home page, and switch
between their boards from there." Reword to state the same fact (extraction logic is
not LAD-specific) as internal technical documentation rather than a feature pitch to
external users, e.g. removing the "add whichever projects you want" second-person
sales framing while keeping the technical claim about `flowcharge/`-convention support.

**What this task must NOT do:** touch `src/`, `tools/`, `package.json`, or any file
other than `README.md`; alter the file-tree diagram or Scripts table; change the
`https://github.com` URL; or add any license/contributing content.

## Staged task breakdown

Given the entire change is four edits inside one 101-line file, this is a single
phase. Each task is independently reviewable and the file stays valid Markdown after
each one.

**Phase 1 — README closed-source reframe**

1. **Add the closed-source notice.**
   - Build: insert the notice paragraph (Target 1) directly after the H1.
   - Files: `README.md`.
   - Effort: small.
   - Depends on: nothing.
   - Verify: `git diff README.md` shows only an insertion after line 1; the notice
     is visible within the first ~15 lines when the file is viewed or rendered.

2. **Reword the title/intro section.**
   - Build: rework lines 1-11 per Target 2, preserving the `https://github.com` link
     unchanged.
   - Files: `README.md`.
   - Effort: small.
   - Depends on: task 1 (edits the same region; doing the insertion first avoids a
     re-diff).
   - Verify: `git diff README.md` shows only prose changes in this region; the link
     `[Praxis](https://github.com)` is byte-for-byte unchanged; the section no longer
     reads as inviting external adoption.

3. **Reword the Quick start section.**
   - Build: rework the prose in lines 13-29 per Target 3; the fenced `npm install` /
     `npm start` code block is untouched.
   - Files: `README.md`.
   - Effort: small.
   - Depends on: nothing (independent region from tasks 1-2).
   - Verify: `git diff README.md` shows the code block lines unchanged; `npm install`
     and `npm start` still appear verbatim and remain accurate instructions for
     running the project locally.

4. **Reword the Notes-section line.**
   - Build: reword current line 98 per Target 4, preserving the technical claim.
   - Files: `README.md`.
   - Effort: small.
   - Depends on: nothing (independent region).
   - Verify: `git diff README.md` shows only that one bullet changed; the rest of the
     Notes section (lines 82-97, 99-101) is unchanged; the technical claim (works
     with any `flowcharge/`-convention project) still reads correctly.

All four tasks can be done in one sitting and committed together or individually;
none blocks demonstrating the others, since each touches a disjoint region of the
same file except tasks 1-2 which touch adjacent lines in sequence.

## Data & compatibility

No data model, API, schema, or runtime behavior is touched — this is a prose-only
edit to a single Markdown file. No migration is needed. Nothing to keep backward
compatible: README.md has no consumers other than human readers and (per the file's
own description) other Praxis tooling that parses `flowcharge/` files, not README.md
itself. Rollback is trivial: `git revert` the commit, or hand-restore the four
regions, since the change is confined to one file with no downstream state.

## Testing strategy

No automated test coverage applies to a documentation-only change; the repo has no
markdownlint or other doc-linting tooling configured (checked: no markdownlint
config, no lint script in `package.json`). Verification is manual for each task, as
specified in the task breakdown above: `git diff README.md` scoped to the intended
region, plus a visual proofread that the notice reads plainly, the reworded sections
no longer address an external adopter, and every unchanged section (file tree,
Scripts table, code blocks) is byte-for-byte identical to before.

## Open questions

1. Exact wording of the closed-source notice. This plan's working assumption is the
   draft in Design ("Private repository. This is closed-source software for internal
   use. It is not published, licensed for reuse, or intended for external
   redistribution."). Recommendation: use it as-is, or approve a shorter variant —
   either way it should keep the two stated facts (private, not for redistribution)
   and stay to one or two sentences given the source request's "short" instruction.
2. Exact placement of the notice — immediately after the H1 (this plan's choice) or
   after the existing intro paragraph. Recommendation: after the H1, since it is the
   most prominent position and the source request asks for it "near the top."

## Alternatives considered and rejected

- **Rewrite README.md from scratch.** Rejected: most of the file ("How it fits
  together", the Scripts table) is neutral technical reference that the investigation
  already confirmed needs no change; a full rewrite would touch content the source
  request explicitly does not ask to change, and risks introducing drift in accurate
  technical detail for no benefit.
- **Put the closed-source notice in a separate file (e.g. `NOTICE.md`) instead of
  inline in README.md.** Rejected: the repo has exactly one markdown file
  (README.md) and no convention for satellite doc files; a reader's single entry
  point is README.md, so a notice there is more visible than one in a file nobody is
  pointed to, and the source request asks for the notice to live "near the top of
  README.md" specifically.
- **Fix the placeholder `https://github.com` link while reworking the surrounding
  tone.** Rejected: explicitly out of scope per the source investigation — the link
  is dead/generic but fixing it is a separate, unrequested piece of work; recorded
  as an out-of-scope item rather than folded into this plan's tasks.
