---
id: PLN-80-8pdouh
type: plan
workstream: WS-90-1gmwvj
slug: public-flowcharge-repo-scaffolding
title: "Scaffold the public flowcharge docs repository"
status: done
created: 2026-09-04
updated: 2026-09-04
depends_on: []
links: []
---

# Scaffold the public flowcharge docs repository

## Summary

FlowCharge needs a public GitHub home that carries release binaries and documentation
only, never source, per Praxis-Business decision D-13. This plan creates a new,
permanent sibling folder at `/Users/akoukoullis/Work/AK/flowcharge-public/`, gives it a
fresh `git init -b main` with a local-only noreply commit identity, and authors three
documents inside it — `README.md`, `CHANGELOG.md` and `SECURITY.md` — modelled on
`/Users/akoukoullis/Work/AK/flowcharge-core-public/` but written fresh for a docs-only,
no-source, single-binary repository.

The chosen approach authors the three files from the settled decisions rather than
copying and trimming the sibling repository's files. Copying carries MIT licence text,
skills-install instructions and a `VERSIONING.md` pointer that are all wrong here; every
one of them would have to be found and deleted, and a missed one contradicts D-13 in
public. Authoring fresh removes that failure mode.

Nothing is pushed. No GitHub repository is created. No remote is configured. The
deliverable is a local folder holding one commit, ready for the user to push whenever
they choose.

## Scope

### Acceptance criteria

1. `/Users/akoukoullis/Work/AK/flowcharge-public/` exists and holds a git repository whose current branch is `main`.
2. `git log` in the new repository shows only the commit this workstream makes, and no object, branch, tag or ref from `Praxis-Dashboard` is reachable in it.
3. `git config --local user.email` and `user.name` in the new repository return the values named in Design, and `git config --global` is unchanged.
4. The repository's tracked files are exactly `README.md`, `CHANGELOG.md` and `SECURITY.md`: no `LICENSE` file exists, and no licence name, licence grant or licence badge **for FlowCharge itself** appears in any of the three. The honesty line's reference to FlowCharge Core's MIT licence is deliberate and is permitted: it names a different project's licence, and it grants nothing for this repository. Do not widen this criterion back to "no licence name at all" — that would forbid the honesty line the Design section requires.
5. `README.md` carries the banner, the positioning paragraph, a Download section, a link to `https://github.com/FlowChargeApp/flowcharge-core`, a Security section linking `SECURITY.md`, and closes with the bare copyright line.
6. `README.md` states the open-source and closed-source split in plain words, in the adapted honesty line given in Design, before any Download instruction.
7. `CHANGELOG.md` follows Keep a Changelog, opens its history with an `## Unreleased` heading, and carries no bracketed version heading.
8. `SECURITY.md` names the advisory URL `https://github.com/akoukoullis/flowcharge/security/advisories/new`, the response-time commitments, and the in-scope and out-of-scope lists given in Design.

### Out of scope

- Creating the GitHub repository `akoukoullis/flowcharge`. The user does this themselves.
- Running `git remote add origin ...`, `git push`, or any other outward-facing git command.
- Building, naming or attaching a release binary. That is WS-91-mecfuo.
- Any `LICENSE` file, licence badge, or licence name. Settled by D-13.
- A formal EULA or terms-of-use document. Settled: a bare copyright notice instead.
- Gatekeeper, notarisation or code-signing wording in the README. WS-94-ked1ye owns the signing deferral, and pre-launch checklist item 17 leaves the macOS Gatekeeper behaviour of an unsigned binary unconfirmed.
- Any change to `Praxis-Dashboard`'s own `README.md`. That is WS-92-t964y8.
- Any `.github/` folder, issue template, CI workflow or release script in the new repository.
- Any edit to `Praxis-Business` documents, including the pre-rename wording in `05-branding-strategy.md`.

### Assumptions

These are settled readings, not open questions. Each is cheap to reverse with a
follow-up edit before the first push.

1. **Folder name.** The local folder is `flowcharge-public`, matching the `flowcharge-core-public` naming pattern already in use. The GitHub repository it will be pushed to is named `flowcharge`. The folder does not exist today; this was checked.
2. **Commit identity.** The repository uses `user.email = 324025743+FlowChargeDev@users.noreply.github.com` and `user.name = Anthony Koukoullis`, byte-for-byte the local configuration `flowcharge-core-public` carries today. This is a real, working, privacy-preserving address rather than an invented one. It belongs to the `FlowChargeDev` GitHub account, so GitHub will attribute the commit to `FlowChargeDev` even while the repository sits under the `akoukoullis` account. That is cosmetic, and it is accepted as designed. No amend step is planned, and none is required by this workstream.
3. **First changelog heading.** The changelog opens with `## Unreleased` and carries no version heading. No binary has been built or published, so no version heading could honestly carry a release date. WS-91-mecfuo converts `## Unreleased` into `## 0.1.0 - <release date>` when the first binary actually ships.
4. **No brackets on version headings.** The changelog keeps `## X.Y.Z - YYYY-MM-DD` with no brackets, matching `flowcharge-core-public`. Nothing in this repository parses the heading today. The reason is house consistency across the two public repositories, and the likelihood that WS-91-mecfuo adds release tooling that parses it, exactly as `flowcharge-core-public`'s `.github/scripts/release.mjs` does.
5. **Release constraints.** There are no live users, no production data and no published release to protect. The repository has no history, so there is no migration and no rollback story beyond deleting the folder. This was read from the workstream record and from checklist item 21, which records the GitHub repository as "not yet created".
6. **Licence name in the README.** The honesty line names MIT as the FlowCharge Core licence. D-12 settles the skills licence as MIT, and `flowcharge-core-public/LICENSE` is an MIT licence. Naming another project's licence is not a licence grant for this repository, so it does not conflict with D-13.

## Design

### The new repository

```
/Users/akoukoullis/Work/AK/flowcharge-public/
  .git/                 fresh, empty history, default branch main
  README.md
  CHANGELOG.md
  SECURITY.md
```

Three tracked files. No `LICENSE`, no `VERSIONING.md`, no `CONTRIBUTING.md`, no
`.github/`, no source tree.

### Git identity contract

Set inside the new repository only, with `git config --local`:

| Key | Value |
|---|---|
| `user.email` | `324025743+FlowChargeDev@users.noreply.github.com` |
| `user.name` | `Anthony Koukoullis` |

`git config --global` is never read for a value to write, and never written to. The pair
above is what `flowcharge-core-public`'s own local configuration holds today.

### README.md — required content

Sections in this order. No Licence section anywhere.

1. **Banner.** Reuse the fenced ASCII block at `/Users/akoukoullis/Work/AK/flowcharge-core-public/README.md` lines 1-8 verbatim. It spells FLOWCHARGE, which is correct for the application as well as for the suite.
2. **Tagline and positioning.** Drawn from `Praxis-Business/strategy/00-positioning.md`. It must state: FlowCharge is the application and the primary product; version 1 ships as a Bun-compiled native binary for macOS, Linux and Windows; the binary starts a local server and the user opens the board in a browser; it reads a project's `flowcharge/` folder and renders every workstream as a card; it also installs the Core skill files, tracks their versions and updates them in one click; the board is read-only today. It must not promise autonomy, and it must not call FlowCharge a vibe-coding tool.
3. **The honesty line.** Placed before any Download instruction, adapted from `Praxis-Business/strategy/05-branding-strategy.md` section 12 point 5 to current branding. The line is, exactly:

   > FlowCharge Core, the skill suite, is open source under the MIT licence. FlowCharge is free to use, and its source is not published.

   The section states plainly that this repository carries release binaries and
   documentation only, and that there is no source code here to read. It must not
   describe the free product as a trial, a starter or a limited edition, per branding
   section 12 point 6.
4. **Download.** Describes obtaining a binary from this repository's Releases page for macOS, Linux or Windows, making it executable on macOS and Linux, running it, and opening the board in a browser at `http://localhost:4173`. It names no asset filename and no version number — WS-91-mecfuo owns those. It states in one line that no release is published yet. It contains no clone instruction and no build instruction.
5. **FlowCharge Core.** One short section naming the companion open-source skill suite this application installs and orchestrates, linking `https://github.com/FlowChargeApp/flowcharge-core`, and stating that Core is free, complete and fully functional on its own.
6. **Security.** One line pointing at `SECURITY.md`, matching `flowcharge-core-public/README.md`'s own Security section shape.
7. **Closing copyright.** The final line of the file, exactly:

   > Copyright © 2026 Anthony Koukoullis. All rights reserved.

   It stands alone under no heading named "License", and it grants nothing.

### CHANGELOG.md — required content

Keep a Changelog format. Contents, in order:

1. `# Changelog` heading.
2. A short preamble stating that the file records notable changes to FlowCharge, that release headings are written `## X.Y.Z - YYYY-MM-DD` with no brackets for consistency with `flowcharge-core-public`, that nothing in this repository parses the heading today, and that versions follow Semantic Versioning.
3. `## Unreleased`, with an `### Added` subsection recording that the public repository was scaffolded with its README, changelog and security policy.

No version heading, and no date, until WS-91-mecfuo ships a binary.

### SECURITY.md — required content

Adapted from `/Users/akoukoullis/Work/AK/flowcharge-core-public/SECURITY.md`, which is 36
lines and carries the section shape to follow. Sections in the same order:

1. **Reporting a vulnerability.** GitHub private vulnerability reporting at `https://github.com/akoukoullis/flowcharge/security/advisories/new`. Do not open a public issue. Reports are received by one solo maintainer, Anthony Koukoullis. The URL returns 404 until the user creates the repository; that is expected and is not a defect.
2. **What to include.** The released version or the binary's build identifier, the operating system and architecture, steps to reproduce, and the impact the reporter believes it has. This differs from the sibling repository's list, which asks for a file or script path — there is no source path a reporter can name here.
3. **What to expect.** Acknowledgement within 7 days. Best effort thereafter, with no fix deadline, because the project has one unpaid maintainer. A 90-day default coordinated-disclosure window, negotiable on the advisory thread. Credit in the advisory unless declined. No bug bounty, and none planned.
4. **Supported versions.** Only the latest published release is supported. Below `1.0.0` there is no compatibility promise. A fix ships as a new release, never as a patch to an older tag. This must be written self-contained: it must not cite a `VERSIONING.md`, because this repository has none.
5. **Scope.** In scope: the behaviour of the released binary itself — arbitrary file read or write and path traversal reachable through its local HTTP API, unsafe handling of a project folder path the user supplies, and unsafe download or archive extraction in the skill install and update mechanism — together with the release build and publish path that produces and signs off the published binaries. Out of scope: defects in third-party tools such as GitHub itself or the agentic coding tool the skills run in; and what a user's own projects contain, since the application reads whatever project folders the user points it at and renders their contents.

The in-scope wording is grounded in the application's real surface, which is closed
source and therefore cannot be cited by path in the public file. For this plan's record,
the surfaces are `src/server.ts:31` (the loopback bind and its `HOST` override),
`src/server.ts:675` and `src/server.ts:799` (the `/api/projects` and `/api/integrations/`
route families), `src/lib/projects.ts:34` and `src/lib/projects.ts:84` (project path
resolution), and `src/lib/skill-release-fetch.ts`, `src/lib/zip-read.ts` and
`src/lib/agentic-tools-install.ts` (the download, extract and install path). No file path
from this list appears in the published `SECURITY.md`.

### What each file must not say

| File | Must not contain |
|---|---|
| `README.md` | Any licence name for FlowCharge, a licence badge, a `LICENSE` link, a clone or build instruction, a release filename, a version number, Gatekeeper or notarisation wording, the name "Praxis" or "Praxis Board" |
| `CHANGELOG.md` | A bracketed version heading, a version heading with a date, a reference to `VERSIONING.md` |
| `SECURITY.md` | A reference to `VERSIONING.md`, any `skills/` or `src/` path, the `FlowChargeApp/flowcharge-core` advisory URL |

## Stages

Three stages, riskiest first. The riskiest item is the commit identity, because it is the
only thing in this workstream that becomes awkward to change once a commit exists and is
pushed. It is therefore set and verified before any content is authored.

1. **Create the folder, initialise git, and pin the identity.** Confirm `/Users/akoukoullis/Work/AK/flowcharge-public/` does not exist, create it, run `git init -b main`, and set the two local config keys. It holds this position because a wrong or unset identity baked into a pushed commit is the one costly mistake available here. Observable at the end: an empty repository on branch `main` whose `git config --local --get user.email` and `--get user.name` return the Design values, and whose `git config --global` output is unchanged.
2. **Author the three documents.** Write `README.md`, `CHANGELOG.md` and `SECURITY.md` to the contracts in Design. Nothing is committed yet. Observable at the end: `git status` lists exactly three untracked files, and a read of each confirms every required section is present and every forbidden string is absent.
3. **Make the single initial commit.** Stage the three files by name, never with `git add -A` or `git add .`, so a stray `.DS_Store` cannot enter the history. Commit once. It holds this position because it is the only irreversible step, and it verifies the work of both stages before it. Observable at the end: `git log` shows one commit, `git ls-files` lists exactly the three files, and the commit's recorded author matches the Design identity.

## Data & compatibility

There is no data, no schema, no API and no consumer. The repository has no history to be
compatible with, and no release exists to be compatible with.

**Rollback.** Until the first push, rollback is deleting
`/Users/akoukoullis/Work/AK/flowcharge-public/`. Nothing outside that folder is written
by this workstream, and `Praxis-Dashboard` is untouched. A wrong commit identity is
corrected with a local config change followed by `git commit --amend --reset-author`.

**The irreversibility boundary.** Everything becomes irreversible at the first push,
which this workstream does not perform. After a push, the published wording — the
copyright line, the honesty line, and the `SECURITY.md` scope statement — is public
permanently, because git history, forks and web archives all persist it. Every wording
choice in Design must therefore be settled before the user pushes, not after.

## Testing strategy

The deliverable is three markdown files and a git repository, so there is no unit or
integration coverage to write. Verification is by command, run in the new repository, and
belongs to the matching tasks in the task list.

- **Stage 1:** `git rev-parse --abbrev-ref HEAD` returns `main`; `git config --local --get user.email` and `--get user.name` return the Design values; `git config --global --get user.email` returns whatever it returned before the stage.
- **Stage 2:** each file is read in full against its Design contract, and the repository is grepped for every forbidden string in the "What each file must not say" table, plus a case-insensitive search for `praxis` across all three files, which must return nothing. A case-insensitive search for `licen` runs too, and its **only** permitted match is the honesty line's reference to FlowCharge Core's MIT licence in `README.md`. Every other match is a defect. Do not treat this grep as "no match allowed" — that would fail on the correct designed content.
- **Stage 3:** `git log --format='%an <%ae>' ` shows the Design identity; `git ls-files` returns exactly three paths; `ls -A` shows no untracked file beyond `.git`; `git log --all --oneline | wc -l` returns 1.

No test runner is added to the new repository, and none is wanted — WS-93-pxw80u owns the
CI test gate, and it applies to the source repository, not to this one.

## Open questions

1. **Question:** Should the published `SECURITY.md` name FlowCharge's attack surface as specifically as the Design section states — the local HTTP API, project-folder path handling, and the skill download and extraction path — given that the application is closed source under D-13 and the file becomes permanently public at the first push?
   **Recommendation:** Publish the specific wording as designed. A security policy that hides its scope tells a researcher nothing, invites out-of-scope reports, and wastes the one maintainer's time; the three surfaces named are generic classes for any local-server desktop application, not a disclosure of any particular defect; and `flowcharge-core-public/SECURITY.md` already sets this level of specificity as the house standard. This is raised rather than assumed because it is the single wording choice in the workstream that cannot be reversed once pushed.

## Adjacent opportunities

Not requested, and not written into any stage, criterion or contract.

1. A one-line `.gitignore` holding `.DS_Store`, matching `flowcharge-core-public/.gitignore` — build now if wanted; stage 3's explicit `git add` by filename already removes the hazard it would guard against.
2. A `.github/` folder mirroring `flowcharge-core-public`'s issue templates and pinned feature-request policy — skip, there is nothing to triage until a release exists and the repository is public.
3. A `VERSIONING.md` stating how the binary's version relates to the FlowCharge Core suite version — skip, WS-91-mecfuo owns the release process and should decide it there.

## Alternatives considered and rejected

1. **Copy `flowcharge-core-public`'s three files and edit them down** — rejected: they carry MIT licence text, a `LICENSE` link, clone-and-symlink install instructions, an operations table and a `VERSIONING.md` pointer, and a single missed deletion publishes a contradiction of D-13.
2. **Produce the new repository from `Praxis-Dashboard` history with an orphan branch, subtree or filter export** — rejected: the workstream requires that nothing from this repository's history crosses over, and any export path risks carrying source objects into a repository that must never hold source.
3. **Open the changelog with `## 0.1.0 - 2026-09-04`** — rejected: it dates a release that does not exist and has no binary, and WS-91-mecfuo would have to renumber or redate it when the first binary actually ships.
4. **Use bracketed Keep a Changelog headings, since nothing here parses them** — rejected: it breaks house style against the sibling public repository, and would need reformatting if WS-91-mecfuo adds release tooling of the kind `flowcharge-core-public` already runs.
5. **Set the commit email to a placeholder such as `noreply@users.noreply.github.com` with a TODO** — rejected: GitHub links it to no account, and a placeholder in a repository the user pushes on their own schedule is far more likely to ship unnoticed than a real address is to be wrong.

## Final summary

Author three documents fresh into a new `flowcharge-public` sibling folder with its own
`git init -b main` and a local-only noreply identity; do not copy and trim the sibling
repository's files. Three stages, identity first, roughly one sitting of mostly
content-authoring work. Top risks: a wrong commit identity baked in before a push; a
licence reference surviving into the README against D-13; and `SECURITY.md` wording that
becomes permanently public at the first push. One open question needs an answer — how
specifically the published security policy should name the closed-source application's
attack surface.
