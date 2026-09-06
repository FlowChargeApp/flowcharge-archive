---
id: TL-93-2381fx
type: tasklist
workstream: WS-90-1gmwvj
slug: public-flowcharge-repo-scaffolding
title: "Scaffold the public flowcharge docs repository"
status: done
created: 2026-09-04
updated: 2026-09-04
author: Anthony Koukoullis
depends_on: [PLN-80-8pdouh]
links: []
mode: spec
base_commit: 093495f
---

# FlowCharge Tasks

## Scaffold the public flowcharge docs repository

This list implements PLN-80-8pdouh. It creates a new, permanent sibling repository at
`/Users/akoukoullis/Work/AK/flowcharge-public/`, authors three documents inside it —
`README.md`, `CHANGELOG.md` and `SECURITY.md` — and makes one initial commit. The
repository carries release binaries and documentation only, never source, per decision
D-13.

Every file this list writes lands **outside** `Praxis-Dashboard`. No file in
`Praxis-Dashboard` is created, modified or committed by any task here. `base_commit:
093495f` anchors this repository's state for one purpose only: the guard in task 3.2,
which confirms `Praxis-Dashboard`'s own tree is unmodified. It anchors nothing else.

The content models the authoring tasks copy from live in two **independent** git
repositories that drift on their own schedules, and `base_commit` does not pin either of
them. Their line-number references were read at `flowcharge-core-public` commit `cebede0`
and `Praxis-Business` commit `737f3dc` on 2026-09-04. Those two commits are the real
anchors for every line-number citation in tasks 2.1, 2.2 and 2.3 — the banner at
`flowcharge-core-public/README.md` lines 1-8, its lines 196 and 202, that repository's
`CHANGELOG.md` lines 1-16 and 153, its 36-line `SECURITY.md` and its lines 4, 25 and 30,
and `Praxis-Business/strategy/00-positioning.md` lines 17-24. If either repository has
moved since, re-read the cited region before copying rather than trusting the line
numbers.

Order is riskiest first, per the plan. The commit identity is set and proved before any
content is authored, because a wrong identity baked into a pushed commit is the one
costly mistake available. Nothing is pushed. No GitHub repository is created. No remote
is configured.

The new repository gets no test runner, and none is wanted — the plan settles this, and
WS-93-pxw80u owns the CI test gate for the source repository, not for this one.
`Praxis-Dashboard`'s own `npm test` and `npm run build` are therefore **not** used as
verify steps: they exercise a codebase no task here touches, and a green run would prove
nothing about this deliverable. Verification is by the plan's own commands, run inside
the new repository. Task 3.2 additionally proves `Praxis-Dashboard` was left alone.

Baselines measured at `base_commit` 093495f on 2026-09-04, before any task runs:
`/Users/akoukoullis/Work/AK/flowcharge-public/` does not exist, so every `git -C` command
against it exits 128 (`fatal: cannot change to 'flowcharge-public'`) and every `grep`
against its files exits 2 (`No such file or directory`);
`git config --global --get user.email` returns `akoukoullis@gmail.com`;
`git config --global --get user.name` returns `Anthony Koukoullis`;
`git -C /Users/akoukoullis/Work/AK/Praxis-Dashboard rev-parse --short HEAD` returns
`093495f`.

- [x] 1. Create the folder, initialise git, and pin the identity

  ```yaml
  description: "Plan stage 1 — a new empty repository on branch main whose local commit identity matches the Design contract, with global git configuration untouched."
  ```

  - [x] 1.1 Confirm the target folder is absent, record the global git baseline, then create the folder
    ```yaml
    description: "Prove /Users/akoukoullis/Work/AK/flowcharge-public/ does not exist, capture the current global git identity as the untouched-baseline, and create the empty folder."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run `test -e /Users/akoukoullis/Work/AK/flowcharge-public` first. If it exists, STOP: do not overwrite, do not merge into it, do not rename it. Report the existing folder and end the task unchecked — the plan's rollback story assumes this folder is created by this workstream and by nothing else."
      - "Record the pre-change global git identity as the baseline for acceptance criterion 3: run `git config --global --get user.email` and `git config --global --get user.name` and write both returned values into this task's self_eval notes. Measured at base_commit 093495f on 2026-09-04 they were `akoukoullis@gmail.com` and `Anthony Koukoullis`."
      - "Create the folder with `mkdir /Users/akoukoullis/Work/AK/flowcharge-public` — a plain single-level mkdir, no `-p` recursion into an unexpected parent."
      - "Write nothing into the folder in this task. Contents belong to tasks 2.1-2.3."
    pattern: "/Users/akoukoullis/Work/AK/flowcharge-public/ — a new sibling folder of Praxis-Dashboard and flowcharge-core-public. No file inside Praxis-Dashboard is touched."
    imports: "Shell only — test, mkdir, git config. No package, no runtime, no dependency."
    compatibility: "PLN-80-8pdouh Design §'The new repository'. Folder name is `flowcharge-public`, matching the `flowcharge-core-public` naming pattern; the GitHub repository it will later be pushed to is named `flowcharge`. The two names differ deliberately."
    gotcha: "`mkdir -p` would silently succeed on a folder that already exists and defeat the abort check — use plain `mkdir` after the explicit `test -e`. Do not read `git config --global` in order to copy a value from it; it is read here only to record a baseline that must stay unchanged."
    verify:
      - "`test -e /Users/akoukoullis/Work/AK/flowcharge-public` before the mkdir must exit 1 (folder absent). This is a precondition gate, so it necessarily passes at base_commit — it cannot be made to fail there, and it exists to abort the task if the state has changed since 2026-09-04."
      - "`test -d /Users/akoukoullis/Work/AK/flowcharge-public` after the mkdir exits 0. At base_commit this exits 1, so the step discriminates."
      - "`ls -A /Users/akoukoullis/Work/AK/flowcharge-public` returns no output — the folder is empty at the end of this task."
      - "`git config --global --get user.email` still returns the baseline recorded above (`akoukoullis@gmail.com` as measured on 2026-09-04) and `git config --global --get user.name` still returns `Anthony Koukoullis`."
    checklist:
      - "Did `test -e` confirm the folder was absent before mkdir ran?"
      - "Does the folder now exist at exactly /Users/akoukoullis/Work/AK/flowcharge-public with no nested parent created?"
      - "Is the folder empty — no README, no .git, no .DS_Store?"
      - "Are `git config --global --get user.email` and `--get user.name` byte-identical to the values recorded before the task ran?"
      - "Was no file inside /Users/akoukoullis/Work/AK/Praxis-Dashboard created, modified or deleted?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "Global git baseline recorded before any change, on 2026-09-04: `git config --global --get user.email` returned `akoukoullis@gmail.com`; `git config --global --get user.name` returned `Anthony Koukoullis`. Both matched the values the list records at base_commit 093495f."
        - "`test -e /Users/akoukoullis/Work/AK/flowcharge-public` exited 1 before the mkdir, so the abort gate did not fire."
        - "After `mkdir` (plain, no `-p`): `test -d` exited 0 and `ls -A` returned no output. Both global values re-read unchanged."
        - "Praxis-Dashboard state was captured before and after this task: HEAD `093495f` both times, and `git status --porcelain` returned only `?? flowcharge/` both times. The only later change inside Praxis-Dashboard is this task list file itself, which the executor is required to update."
    ```
  - [x] 1.2 Initialise the git repository on branch main
    ```yaml
    description: "Run git init -b main inside the new folder so the default branch is main from the first commit, with no history, remote or ref carried in from anywhere."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run `git init -b main` with the new folder as the working directory (`git -C /Users/akoukoullis/Work/AK/flowcharge-public init -b main`)."
      - "Do not clone, do not add a remote, do not fetch, do not create an orphan branch from Praxis-Dashboard, and do not set `.git/objects/info/alternates`. Nothing from this repository's history may become reachable in the new one — plan acceptance criterion 2."
      - "Leave the working tree empty; the first file arrives in task 2.1."
    pattern: "/Users/akoukoullis/Work/AK/flowcharge-public/.git/ — created by this task."
    imports: "git only. No .gitignore is added; PLN-80-8pdouh Adjacent opportunities item 1 leaves it out and task 3.1's explicit staging removes the hazard it would guard."
    compatibility: "PLN-80-8pdouh Design §'The new repository' — a fresh, empty history whose default branch is `main`. Git must be new enough to accept `init -b`; on an older git, use `git init` followed by `git symbolic-ref HEAD refs/heads/main`, never a rename after a commit exists."
    gotcha: "`git init` without `-b main` inherits `init.defaultBranch`, which may be `master`; the branch name is then baked into the first commit and must be renamed. Running the command from the wrong working directory would initialise a repository inside Praxis-Dashboard — always pass `-C` with the absolute path."
    verify:
      - "`git -C /Users/akoukoullis/Work/AK/flowcharge-public rev-parse --abbrev-ref HEAD` returns `main`. At base_commit this command exits 128 with `fatal: cannot change to 'flowcharge-public'`, so the step discriminates."
      - "`git -C /Users/akoukoullis/Work/AK/flowcharge-public log --all --oneline | wc -l` returns 0 — no commit yet."
      - "`git -C /Users/akoukoullis/Work/AK/flowcharge-public remote -v` returns no output — no remote is configured."
      - "`test -e /Users/akoukoullis/Work/AK/flowcharge-public/.git/objects/info/alternates` exits 1 — no object store is shared with any other repository."
      - "`git -C /Users/akoukoullis/Work/AK/flowcharge-public status --porcelain` returns no output — the working tree is empty."
    checklist:
      - "Does `rev-parse --abbrev-ref HEAD` return exactly `main`, not `master`?"
      - "Is the commit count zero and the working tree empty at the end of this task?"
      - "Is `git remote -v` empty, with no origin and no upstream?"
      - "Is `.git/objects/info/alternates` absent, so no Praxis-Dashboard object is reachable?"
      - "Was the repository created by `git init`, and not by clone, fetch, subtree, filter or orphan-branch export?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "Verify step 1 as written (`rev-parse --abbrev-ref HEAD`) cannot return `main` at the end of this task: the branch is unborn until the first commit, so git prints `fatal: ambiguous argument 'HEAD'` and falls back to the literal string `HEAD`. This is normal git behaviour on an empty repository, not a defect. The branch name was proved by the equivalent unborn-branch commands instead: `git symbolic-ref --short HEAD` returned `main`, `git branch --show-current` returned `main`, and `.git/HEAD` contains `ref: refs/heads/main`. The verify step as written becomes meaningful again in task 3.2, after the commit exists."
    ```
  - [x] 1.3 Pin the local commit identity and prove the global configuration is unchanged
    ```yaml
    description: "Set user.email and user.name with git config --local inside the new repository only, to the exact Design values, and re-prove the global git identity is untouched."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run `git -C /Users/akoukoullis/Work/AK/flowcharge-public config --local user.email \"324025743+FlowChargeDev@users.noreply.github.com\"`."
      - "Run `git -C /Users/akoukoullis/Work/AK/flowcharge-public config --local user.name \"Anthony Koukoullis\"`."
      - "Use `--local` on both. Never `--global`, never `--system`, and never `git config` without a scope flag from a directory that could resolve elsewhere."
      - "Do not amend, re-author or rewrite anything later to correct the identity — this task exists so that no amend is needed. PLN-80-8pdouh Assumption 2 accepts that GitHub will attribute the commit to the `FlowChargeDev` account; that is cosmetic and designed."
    pattern: "/Users/akoukoullis/Work/AK/flowcharge-public/.git/config — the [user] section. No other file, in any repository, is written."
    imports: "git config only."
    compatibility: "PLN-80-8pdouh Design §'Git identity contract'. The pair is byte-for-byte what /Users/akoukoullis/Work/AK/flowcharge-core-public carries in its own local configuration today, confirmed on 2026-09-04."
    gotcha: "The email begins with the digits `324025743+` — dropping the numeric prefix produces a different, non-attributing address that looks correct. Copy the value, do not retype it. A missing `--local` writes the developer's global identity and breaks acceptance criterion 3 in a way that is invisible until the next unrelated commit in another repository."
    verify:
      - "`git -C /Users/akoukoullis/Work/AK/flowcharge-public config --local --get user.email` returns exactly `324025743+FlowChargeDev@users.noreply.github.com`. At base_commit this exits 128, so the step discriminates."
      - "`git -C /Users/akoukoullis/Work/AK/flowcharge-public config --local --get user.name` returns exactly `Anthony Koukoullis`."
      - "`git config --global --get user.email` returns the task 1.1 baseline (`akoukoullis@gmail.com` as measured on 2026-09-04) and `git config --global --get user.name` returns `Anthony Koukoullis`. This asserts an unchanged value, so it passes at base_commit by construction; it discriminates against the failure mode this task actually risks, which is a `--global` write."
      - "`git -C /Users/akoukoullis/Work/AK/flowcharge-public config --local --list` shows a `[user]` pair and no `remote.` or `branch.` entry."
    checklist:
      - "Is the local user.email byte-identical to the Design value, numeric prefix included?"
      - "Is the local user.name exactly `Anthony Koukoullis`?"
      - "Were both writes made with `--local`, and was neither `--global` nor `--system` used?"
      - "Does `git config --global` return the same email and name it returned before this stage ran?"
      - "Is the local config free of any remote or upstream entry?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "Both values were written with `--local`. Neither `--global` nor `--system` was used at any point in this stage."
        - "The email was proved byte-identical to the sibling repository's own local value: `diff <(git -C /Users/akoukoullis/Work/AK/flowcharge-core-public config --local --get user.email) <(git -C /Users/akoukoullis/Work/AK/flowcharge-public config --local --get user.email)` returned no output, so the `324025743+` numeric prefix is intact."
        - "`git config --local --list` shows only the six git-default `core.*` keys plus the `user.email` and `user.name` pair. No `remote.` or `branch.` key is present."
    ```

- [x] 2. Author the three documents

  ```yaml
  description: "Plan stage 2 — write README.md, CHANGELOG.md and SECURITY.md to the Design contracts. Nothing is committed in this stage; the three files end as untracked content in the new repository's working tree."
  ```

  - [x] 2.1 Write README.md
    ```yaml
    description: "Author /Users/akoukoullis/Work/AK/flowcharge-public/README.md with the banner, positioning, honesty line, Download, FlowCharge Core, Security and the bare closing copyright line, in that order and with no Licence section."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Write the seven sections in the order fixed by PLN-80-8pdouh Design §'README.md — required content'. That section is the authority for each section's content; the steps below add only the exact strings and the source anchors."
      - "Banner: copy lines 1-8 of /Users/akoukoullis/Work/AK/flowcharge-core-public/README.md verbatim, including the opening and closing ``` fences and the leading three spaces on each of the six art lines. Read the file and copy the bytes; do not retype the block-drawing characters."
      - "Positioning: draw the wording from /Users/akoukoullis/Work/AK/Praxis-Business/strategy/00-positioning.md §'The products', the paragraph beginning `**FlowCharge** is the application` (lines 17-24 as read on 2026-09-04). State: FlowCharge is the application and the primary product; version 1 ships as a Bun-compiled native binary for macOS, Linux and Windows; the binary starts a local server and the user opens the board in a browser; it reads a project's `flowcharge/` folder and renders every workstream as a card; it installs the Core skill files, tracks their versions and updates them in one click; the board is read-only today. Do not promise autonomy and do not call FlowCharge a vibe-coding tool."
      - "Honesty line, placed before any Download instruction, exactly: `FlowCharge Core, the skill suite, is open source under the MIT licence. FlowCharge is free to use, and its source is not published.` Around it, state plainly that this repository carries release binaries and documentation only and that there is no source code here to read. Do not describe the free product as a trial, a starter or a limited edition."
      - "Download: describe getting a binary from this repository's Releases page for macOS, Linux or Windows, making it executable on macOS and Linux, running it, and opening the board at `http://localhost:4173`. Name no asset filename and no version number. State in one line that no release is published yet. Include no clone instruction and no build instruction."
      - "FlowCharge Core: one short section naming the companion open-source skill suite this application installs and orchestrates, linking `https://github.com/FlowChargeApp/flowcharge-core`, and stating Core is free, complete and fully functional on its own."
      - "Security: one line pointing at SECURITY.md, in the shape /Users/akoukoullis/Work/AK/flowcharge-core-public/README.md line 196 uses — `To report a vulnerability, read the policy in [SECURITY.md](SECURITY.md).`"
      - "Closing copyright: the final line of the file, exactly `Copyright © 2026 Anthony Koukoullis. All rights reserved.`, standing alone under no heading, granting nothing. Do not add a `## License` heading above it and do not add a licence badge anywhere."
    pattern: "/Users/akoukoullis/Work/AK/flowcharge-public/README.md — new file. Read-only sources: flowcharge-core-public/README.md and Praxis-Business/strategy/00-positioning.md, neither of which is edited."
    imports: "None. Plain markdown."
    compatibility: "PLN-80-8pdouh Design §'README.md — required content' and §'What each file must not say'. Satisfies acceptance criteria 5 and 6, and the README half of criterion 4."
    gotcha: "The banner's block-drawing characters and the copyright line's `©` are multi-byte; retyping them from memory corrupts them. The plan's Design forbids a licence name for FlowCharge itself but the honesty line's MIT reference to FlowCharge Core is deliberate and permitted — do not delete it and do not widen the ban. `4173` is a port, not a version; the version-number check below must not be satisfied by removing it."
    verify:
      - "`grep -c 'licen' README.md` (case-insensitive: `grep -ic`) returns exactly 1, and `grep -in 'licen' README.md` shows only the honesty line's `MIT licence`. At base_commit the file does not exist and grep exits 2, so the step discriminates. A return of 0 is a failure, not a pass — it means the required honesty line is missing."
      - "`grep -nE '\\(LICENSE\\)|\\[MIT|licen[cs]e badge|shields\\.io' README.md` returns no output (exit 1) — no LICENSE link and no licence badge for FlowCharge itself. Run against flowcharge-core-public/README.md on 2026-09-04 the same pattern matched line 202, which proves the pattern catches what it is meant to catch."
      - "`grep -niE 'gatekeeper|notaris|notariz|git clone|bun build|npm install|npm run build|praxis' README.md` returns no output (exit 1)."
      - "`grep -nE '[0-9]+\\.[0-9]+\\.[0-9]+' README.md` returns no output (exit 1) — no version number and no release filename carrying one."
      - "`grep -c 'http://localhost:4173' README.md` returns 1, and `grep -c 'https://github.com/FlowChargeApp/flowcharge-core' README.md` returns at least 1."
      - "`tail -n 1 README.md` is exactly `Copyright © 2026 Anthony Koukoullis. All rights reserved.`, and `grep -n 'Copyright ©' README.md` reports that line only."
      - "`diff <(sed -n '1,8p' /Users/akoukoullis/Work/AK/flowcharge-core-public/README.md) <(sed -n '1,8p' README.md)` returns no output — the banner is byte-identical."
      - "Read the file in full and confirm the seven sections appear in the Design order, and that the honesty line appears before the first Download instruction."
    checklist:
      - "Are the banner's first eight lines byte-identical to flowcharge-core-public/README.md lines 1-8, fences included?"
      - "Does the honesty line appear verbatim, and before any Download instruction?"
      - "Is `grep -ic licen README.md` exactly 1, matching only the FlowCharge Core MIT reference?"
      - "Is the file free of a LICENSE link, a licence badge, a clone or build instruction, a release filename, a version number, Gatekeeper or notarisation wording, and the word Praxis?"
      - "Does the Download section name the Releases page, macOS/Linux/Windows, the chmod step, `http://localhost:4173`, and state in one line that no release is published yet?"
      - "Is the last line of the file the bare copyright line, under no heading and granting nothing?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "The banner was copied by byte, not retyped: `sed -n '1,8p'` from flowcharge-core-public/README.md wrote the first eight lines of the new file, and the verify diff returned no output."
        - "Verify results: `grep -ic licen` returned 1, matching only line 24, the honesty line. The licence-link/badge pattern, the forbidden-word pattern and the version-number pattern each returned exit 1. `http://localhost:4173` appears once and the flowcharge-core URL appears once. `tail -n 1` is the bare copyright line, and `grep -n 'Copyright ©'` reports line 59 only."
        - "The licence-link/badge pattern was run against flowcharge-core-public/README.md as a control and matched line 202, so the pattern catches what it is meant to catch."
        - "The seven sections read in order: banner, positioning, honesty section, Download, FlowCharge Core, Security, closing copyright. The honesty line at line 24 sits before the first Download instruction at line 30."
    ```
  - [x] 2.2 Write CHANGELOG.md
    ```yaml
    description: "Author /Users/akoukoullis/Work/AK/flowcharge-public/CHANGELOG.md in Keep a Changelog format, opening its history with ## Unreleased and carrying no version heading, no date and no VERSIONING.md reference."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Write the three parts fixed by PLN-80-8pdouh Design §'CHANGELOG.md — required content', in order: a `# Changelog` heading; a short preamble; then `## Unreleased`."
      - "Preamble: state that the file records notable changes to FlowCharge, that a release heading is written `## X.Y.Z - YYYY-MM-DD` with no brackets around the version for consistency with flowcharge-core-public, that nothing in this repository parses the heading today, and that versions follow Semantic Versioning."
      - "Under `## Unreleased`, add an `### Added` subsection recording that the public repository was scaffolded with its README, changelog and security policy."
      - "Add no version-numbered heading and no date. WS-91-mecfuo converts `## Unreleased` into `## 0.1.0 - <release date>` when the first binary ships; that is not this workstream."
      - "Do not cite VERSIONING.md. flowcharge-core-public's changelog cites one; this repository has no such file, so the sentence must not be carried across."
      - "Model the shape on /Users/akoukoullis/Work/AK/flowcharge-core-public/CHANGELOG.md lines 1-16, but write the prose fresh — its preamble names `checkSuiteVersion` in `skills/flowcharge/scripts/fc-index.mjs` and a suite-version rule, neither of which exists here."
    pattern: "/Users/akoukoullis/Work/AK/flowcharge-public/CHANGELOG.md — new file."
    imports: "None. Plain markdown."
    compatibility: "PLN-80-8pdouh Design §'CHANGELOG.md — required content', Assumptions 3 and 4, and §'What each file must not say'. Satisfies acceptance criterion 7."
    gotcha: "Keep a Changelog's published examples use bracketed headings such as `## [0.1.0]`; following the upstream example rather than the Design contract breaks acceptance criterion 7. The preamble explains the no-brackets convention, so it must describe the format `## X.Y.Z - YYYY-MM-DD` without that string being mistaken for an actual release heading — keep it inside prose or inline code, never at the start of a line as `## `."
    verify:
      - "`grep -nE '^## \\[' CHANGELOG.md` returns no output (exit 1) — no bracketed version heading."
      - "`grep -nE '^## [0-9]' CHANGELOG.md` returns no output (exit 1) — no version-numbered or dated heading. Run against flowcharge-core-public/CHANGELOG.md on 2026-09-04 the same pattern matched line 153 (`## 0.1.0 - 2026-09-03`), which proves the pattern catches what it is meant to catch. At base_commit this file does not exist and grep exits 2."
      - "`grep -n 'VERSIONING' CHANGELOG.md` returns no output (exit 1)."
      - "`grep -nx '## Unreleased' CHANGELOG.md` returns exactly one line, and `head -n 1 CHANGELOG.md` is `# Changelog`."
      - "`grep -nx '### Added' CHANGELOG.md` returns exactly one line, appearing after the `## Unreleased` line."
      - "`grep -ic 'licen' CHANGELOG.md` returns 0 and `grep -ic 'praxis' CHANGELOG.md` returns 0."
    checklist:
      - "Is the first line `# Changelog`?"
      - "Does the preamble state the no-brackets convention, that nothing here parses the heading, and that versions follow Semantic Versioning?"
      - "Is `## Unreleased` the only `##` history heading, with an `### Added` entry recording the scaffolding?"
      - "Is the file free of any bracketed heading, any dated heading and any VERSIONING.md reference?"
      - "Is the file free of the words `licence`, `license` and `Praxis`?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "The prose was written fresh. The sibling preamble's `checkSuiteVersion` sentence, its `skills/flowcharge/scripts/fc-index.mjs` path and its `See VERSIONING.md.` line were not carried across."
        - "Verify results: the bracketed-heading pattern, the numbered-heading pattern and the VERSIONING pattern each returned exit 1. `head -n 1` is `# Changelog`. `grep -nx '## Unreleased'` returned line 12 only and `grep -nx '### Added'` returned line 14 only, so Added follows Unreleased. `grep -ic licen` and `grep -ic praxis` both returned 0."
        - "The numbered-heading pattern was run against flowcharge-core-public/CHANGELOG.md as a control and matched line 153 (`## 0.1.0 - 2026-09-03`), so the pattern catches what it is meant to catch."
        - "The `## X.Y.Z - YYYY-MM-DD` convention is stated inside inline code mid-line, never at the start of a line, so it cannot be read as a real release heading."
    ```
  - [x] 2.3 Write SECURITY.md
    ```yaml
    description: "Author /Users/akoukoullis/Work/AK/flowcharge-public/SECURITY.md with the five Design sections in order: Reporting a vulnerability, What to include, What to expect, Supported versions, Scope."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Follow the section shape of /Users/akoukoullis/Work/AK/flowcharge-core-public/SECURITY.md (36 lines, read it first), but write the content fresh per PLN-80-8pdouh Design §'SECURITY.md — required content'."
      - "Reporting a vulnerability: GitHub private vulnerability reporting at `https://github.com/akoukoullis/flowcharge/security/advisories/new`; do not open a public issue; reports are received by one solo maintainer, Anthony Koukoullis."
      - "What to include: the released version or the binary's build identifier, the operating system and architecture, steps to reproduce, and the impact the reporter believes it has. Do NOT ask for a file or script path — the sibling repository's list does, and there is no source path a reporter can name here."
      - "What to expect: acknowledgement within 7 days; best effort thereafter with no fix deadline, because the project has one unpaid maintainer; a 90-day default coordinated-disclosure window, negotiable on the advisory thread; credit in the advisory unless declined; no bug bounty and none planned."
      - "Supported versions: only the latest published release is supported; below `1.0.0` there is no compatibility promise; a fix ships as a new release, never as a patch to an older tag. Write this self-contained — do not carry across the sibling file's `per VERSIONING.md` clause, because this repository has no VERSIONING.md."
      - "Scope, in scope: the behaviour of the released binary itself — arbitrary file read or write and path traversal reachable through its local HTTP API, unsafe handling of a project folder path the user supplies, and unsafe download or archive extraction in the skill install and update mechanism — together with the release build and publish path that produces and signs off the published binaries. Carry the phrase `produces and signs off` — the plan's Design contract names both, and dropping `and signs off` narrows the published scope statement against acceptance criterion 8."
      - "Scope, out of scope: defects in third-party tools such as GitHub itself or the agentic coding tool the skills run in; and what a user's own projects contain, since the application reads whatever project folders the user points it at and renders their contents."
      - "Name no file path. The plan records the real source anchors for its own record only; none of them may appear in the published file."
    pattern: "/Users/akoukoullis/Work/AK/flowcharge-public/SECURITY.md — new file. Read-only source: flowcharge-core-public/SECURITY.md, which is not edited."
    imports: "None. Plain markdown."
    compatibility: "PLN-80-8pdouh Design §'SECURITY.md — required content' and §'What each file must not say'. Satisfies acceptance criterion 8."
    gotcha: "The advisory URL returns 404 until the user creates the GitHub repository — that is expected and is not a defect, so do not substitute the sibling repository's working URL to make a link check pass. Adapting the sibling file by editing rather than authoring afresh is exactly how the VERSIONING.md clause, the `skills/` paths and the FlowChargeApp URL survive; all three are forbidden here. The Scope wording becomes permanently public at the first push, which this workstream does not perform — see the open question raised with this list before pushing."
    verify:
      - "`grep -c 'https://github.com/akoukoullis/flowcharge/security/advisories/new' SECURITY.md` returns 1. At base_commit the file does not exist and grep exits 2, so the step discriminates."
      - "`grep -nE 'VERSIONING|skills/|src/|FlowChargeApp' SECURITY.md` returns no output (exit 1). Run against flowcharge-core-public/SECURITY.md on 2026-09-04 the same pattern matched lines 4, 25 and 30, which proves the pattern catches what it is meant to catch."
      - "`grep -nE '^## ' SECURITY.md` returns exactly five headings, in the order Reporting a vulnerability, What to include, What to expect, Supported versions, Scope."
      - "`grep -c '7 days' SECURITY.md` returns at least 1, `grep -c '90-day' SECURITY.md` returns at least 1, and `grep -ic 'bug bounty' SECURITY.md` returns at least 1."
      - "`grep -ic 'licen' SECURITY.md` returns 0 and `grep -ic 'praxis' SECURITY.md` returns 0."
      - "Read the file in full and confirm both the in-scope list (three binary-behaviour surfaces plus the release build and publish path) and the out-of-scope list (third-party tool defects, and the contents of a user's own projects) are present."
    checklist:
      - "Do the five sections appear in the Design order?"
      - "Is the advisory URL the akoukoullis/flowcharge one, and is the FlowChargeApp/flowcharge-core advisory URL absent?"
      - "Does What to include ask for version or build id, OS and architecture, repro steps and impact — and not for a file or script path?"
      - "Are the 7-day acknowledgement, the 90-day disclosure window and the no-bug-bounty statement all present?"
      - "Is Supported versions self-contained, with no VERSIONING.md reference?"
      - "Is the file free of every `skills/` and `src/` path?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "The file was authored fresh against the Design contract, using the sibling's 36-line section shape only. The sibling's `per VERSIONING.md` clause, its `skills/` paths and its FlowChargeApp advisory URL are all absent."
        - "Verify results: the akoukoullis advisory URL appears once. The `VERSIONING|skills/|src/|FlowChargeApp` pattern returned exit 1. `grep -nE '^## '` returned exactly five headings, at lines 1, 8, 15, 22 and 27, in the Design order. `7 days`, `90-day` and `bug bounty` each returned 1. `grep -ic licen` and `grep -ic praxis` both returned 0."
        - "The forbidden-reference pattern was run against flowcharge-core-public/SECURITY.md as a control and matched lines 4, 25 and 30, so the pattern catches what it is meant to catch."
        - "The phrase `produces and signs off` is present, so the published scope statement is not narrowed. What to include asks for version or build identifier, operating system and architecture, repro steps and impact; it asks for no file or script path."
        - "A full read confirms the in-scope list carries the three binary-behaviour surfaces plus the release build and publish path, and the out-of-scope list carries third-party tool defects and the contents of a user's own projects."
    ```
  - [x] 2.4 Sweep the three files for forbidden strings and confirm the working tree holds exactly three untracked files
    ```yaml
    description: "Verification-only task: run the plan's cross-file forbidden-string sweep over all three documents and confirm the repository's working tree is exactly README.md, CHANGELOG.md and SECURITY.md, still uncommitted."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Write no file in this task. Run the checks below from /Users/akoukoullis/Work/AK/flowcharge-public. Any failure is fixed in the owning task — 2.1 for README.md, 2.2 for CHANGELOG.md, 2.3 for SECURITY.md — which is then re-verified, and this task is re-run."
      - "Run the case-insensitive `praxis` sweep across all three files. It must match nothing. The plan's testing strategy states this explicitly."
      - "Run the case-insensitive `licen` sweep across all three files. Exactly one line may match: the honesty line's reference to FlowCharge Core's MIT licence in README.md. Every other match is a defect. Do not treat this as a no-match-allowed grep — zero matches means the required honesty line is missing, which is also a defect."
      - "Confirm no LICENSE file exists anywhere in the repository, satisfying the first half of acceptance criterion 4."
      - "Confirm the working tree holds the three documents and nothing else, and that nothing is committed yet — the stage 3 tasks own staging and committing."
    pattern: "/Users/akoukoullis/Work/AK/flowcharge-public/README.md, CHANGELOG.md and SECURITY.md — read only. No file is written by this task."
    imports: "grep, ls, git status. No test runner is added to the new repository; PLN-80-8pdouh Testing strategy settles that none is wanted."
    compatibility: "PLN-80-8pdouh Testing strategy §'Stage 2' and §'What each file must not say'. Satisfies acceptance criterion 4's licence and file-set halves, alongside task 3.1."
    gotcha: "`grep -r` over the folder would descend into .git and report matches inside git's own object and log files — name the three files explicitly instead. Deleting the honesty line is the tempting way to make the `licen` sweep return zero; that breaks acceptance criterion 6."
    verify:
      - "`grep -niI 'praxis' README.md CHANGELOG.md SECURITY.md` returns no output (exit 1). At base_commit none of the three files exists and grep exits 2, so the step discriminates."
      - "`grep -niI 'licen' README.md CHANGELOG.md SECURITY.md` returns exactly one line, and that line is README.md's honesty line naming FlowCharge Core's MIT licence."
      - "`ls -A` lists exactly `.git`, `CHANGELOG.md`, `README.md` and `SECURITY.md` — four entries, no LICENSE, no VERSIONING.md, no .github, no .DS_Store."
      - "`git status --porcelain` lists exactly three lines, all `??`, one per document — the files are untracked and nothing is committed at the end of this stage."
      - "`git log --all --oneline | wc -l` returns 0."
    checklist:
      - "Does the case-insensitive `praxis` sweep across the three files return zero matches?"
      - "Does the case-insensitive `licen` sweep return exactly one line, and is it README.md's honesty line?"
      - "Does the repository contain no LICENSE file and no VERSIONING.md?"
      - "Is `ls -A` exactly `.git`, `CHANGELOG.md`, `README.md`, `SECURITY.md` with nothing else, `.DS_Store` included?"
      - "Are all three files still untracked, with zero commits, at the end of this task?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "No file was written by this task. The three files were named explicitly to grep, so no `.git` internal file was scanned."
        - "Verify results: `grep -niI 'praxis'` across the three files returned exit 1. `grep -niI 'licen'` returned exactly one line, `README.md:24`, the honesty line naming FlowCharge Core's MIT licence. The honesty line was kept, not deleted to force a zero count."
        - "`ls -A` returned exactly four entries: `.git`, `CHANGELOG.md`, `README.md`, `SECURITY.md`. No LICENSE, no VERSIONING.md, no .github and no .DS_Store."
        - "`git status --porcelain` returned exactly three `??` lines, one per document, and `git log --all --oneline | wc -l` returned 0. Nothing is staged and nothing is committed at the end of this stage."
    ```

- [x] 3. Make the single initial commit

  ```yaml
  description: "Plan stage 3 — stage the three files by explicit name, commit once, and prove the resulting repository against the plan's acceptance criteria. This is the only irreversible step in the workstream."
  ```

  - [x] 3.1 Stage the three files by explicit name
    ```yaml
    description: "Run git add with the three filenames spelled out, never git add -A or git add ., so no stray file can enter the history."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "From /Users/akoukoullis/Work/AK/flowcharge-public, run `git add README.md CHANGELOG.md SECURITY.md`."
      - "Never use `git add -A`, `git add .`, `git add -u` or a glob. The plan requires explicit filenames so a stray `.DS_Store` cannot enter the history; no .gitignore guards this repository."
      - "Do not commit in this task — task 3.2 owns the commit."
    pattern: "/Users/akoukoullis/Work/AK/flowcharge-public/ — the git index only. No file content changes."
    imports: "git add only."
    compatibility: "PLN-80-8pdouh stage 3 and Adjacent opportunities item 1, which leaves the .gitignore out precisely because staging is explicit here."
    gotcha: "macOS creates `.DS_Store` in any folder opened in Finder; it may appear between task 2.4 and this task. Explicit staging tolerates it in the working tree but keeps it out of the index — do not delete it and do not add a .gitignore for it, both are out of scope."
    verify:
      - "`git diff --cached --name-only` returns exactly three lines: `CHANGELOG.md`, `README.md`, `SECURITY.md`. At base_commit this command exits 128 because the repository does not exist, so the step discriminates."
      - "`git diff --cached --name-only | wc -l` returns 3."
      - "`git status --porcelain | grep -v '^A '` returns no output — nothing is staged that is not one of the three new files, and no other change is pending."
      - "`git log --all --oneline | wc -l` still returns 0 at the end of this task."
    checklist:
      - "Were the three filenames passed explicitly to git add, with no `-A`, no `.`, no `-u` and no glob?"
      - "Does the index hold exactly three paths?"
      - "Is `.DS_Store` — or any other stray file — absent from the index?"
      - "Is the commit count still zero at the end of this task?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "The command run was exactly `git add README.md CHANGELOG.md SECURITY.md`. No `-A`, no `.`, no `-u` and no glob was used at any point."
        - "Verify results: `git diff --cached --name-only` returned exactly `CHANGELOG.md`, `README.md`, `SECURITY.md`, and `| wc -l` returned 3. `git status --porcelain | grep -v '^A '` returned no output (exit 1). `git log --all --oneline | wc -l` returned 0 at the end of this task."
        - "No `.DS_Store` and no other stray file existed in the working tree — `ls -A` returned only `.git` and the three documents — so nothing stray could reach the index."
    ```
  - [x] 3.2 Commit once and verify the finished repository
    ```yaml
    description: "Make the single initial commit with the pinned identity, then prove acceptance criteria 1, 2, 3 and 4 against the finished repository, and prove Praxis-Dashboard was left untouched."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run `git commit` once, with a short subject describing the scaffolding of the public repository with its README, changelog and security policy."
      - "Do not pass `--author`, `--amend`, `-A` or `--allow-empty`. The identity comes from the local config set in task 1.3 and from nowhere else."
      - "Do not add a remote, do not push, and do not create the GitHub repository — all three are explicitly out of scope in the plan."
      - "Commit exactly once. If the commit's recorded author is wrong, stop and report rather than amending: an amend is a rewrite this workstream did not plan for, and task 1.3 exists to make it unnecessary."
      - "Add no `Co-Authored-By` trailer and no other attribution trailer to this commit message. This holds regardless of the executing agent's own standing attribution conventions, and regardless of Praxis-Dashboard's conventions: this is the first and only commit of a repository the user will push publicly, the plan's irreversibility boundary applies to its published wording, and this repository has no trailer convention of its own. The message is a subject line and nothing more."
    pattern: "/Users/akoukoullis/Work/AK/flowcharge-public/ — one commit on branch main. Nothing inside Praxis-Dashboard is staged, committed or modified."
    imports: "git commit, git log, git ls-files, ls."
    compatibility: "PLN-80-8pdouh stage 3 and Testing strategy §'Stage 3'. Satisfies acceptance criteria 1, 2, 3 and 4. The plan's irreversibility boundary is the first push, which this task does not cross."
    gotcha: "A configured global `commit.gpgsign` or a `commit.template` can inject content or fail the commit; check the local config if the commit does not complete, and fix it locally rather than globally. Praxis-Dashboard's npm scripts are deliberately not run as verify steps here — they exercise a codebase this workstream does not touch."
    verify:
      - "`git log --format='%an <%ae>'` returns exactly one line: `Anthony Koukoullis <324025743+FlowChargeDev@users.noreply.github.com>`. At base_commit this exits 128, so the step discriminates."
      - "`git log --all --oneline | wc -l` returns 1."
      - "`git ls-files` returns exactly three paths — `CHANGELOG.md`, `README.md`, `SECURITY.md` — and `git ls-files | wc -l` returns 3."
      - "`ls -A` shows nothing beyond `.git` and those three files, and `git status --porcelain` returns no output."
      - "`git rev-parse --abbrev-ref HEAD` returns `main`; `git remote -v` returns no output; `test -e .git/objects/info/alternates` exits 1 — no Praxis-Dashboard object, branch, tag or ref is reachable."
      - "`git config --local --get user.email` and `--get user.name` still return the Design values, and `git config --global --get user.email` still returns the task 1.1 baseline."
      - "In /Users/akoukoullis/Work/AK/Praxis-Dashboard, `git rev-parse --short HEAD` still returns `093495f` and `git status --porcelain -- README.md` returns no output — the source repository is untouched. Both were measured with these exact results at base_commit on 2026-09-04; they assert unchanged state, so they cannot fail there by construction, and they discriminate against the failure mode of committing into the wrong repository."
    checklist:
      - "Does the repository hold exactly one commit, on branch main?"
      - "Does the commit's recorded author match the Design identity byte-for-byte, with no --author override and no amend?"
      - "Does `git ls-files` return exactly README.md, CHANGELOG.md and SECURITY.md, with no LICENSE among them?"
      - "Is the working tree clean, with nothing untracked beyond .git?"
      - "Is there still no remote, no push and no GitHub repository created?"
      - "Is Praxis-Dashboard's HEAD still 093495f with no modification to its tracked files?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "One commit was made, `13e53b0`, the root commit on branch `main`. The subject is `Scaffold public repository with README, changelog and security policy` and the body is empty. No `--author`, `--amend`, `-A` or `--allow-empty` was passed."
        - "The message carries no trailer. `git log -1 --format='%b'` returned empty, the non-blank line count of the full message is 1, and a case-insensitive grep for `co-authored-by|signed-off-by|generated with` returned exit 1. The executing agent's own standing attribution convention was deliberately not applied, per this task's implement step."
        - "`commit.gpgsign` is `true` and `gpg.format` is `ssh` from the developer's global configuration. The commit completed normally under it, so no local override was needed and none was written. `commit.template` is also set globally, but `-m` bypasses it and the recorded body is empty, which proves no template content was injected."
        - "Verify results: `git log --format='%an <%ae>'` returned exactly one line, `Anthony Koukoullis <324025743+FlowChargeDev@users.noreply.github.com>`. `git log --all --oneline | wc -l` returned 1. `git ls-files` returned `CHANGELOG.md`, `README.md`, `SECURITY.md` and `| wc -l` returned 3. `ls -A` showed only `.git` plus those three files, and `git status --porcelain` returned no output. `rev-parse --abbrev-ref HEAD` returned `main`, `git remote -v` returned no output, and `test -e .git/objects/info/alternates` exited 1."
        - "Identity re-checked after the commit: local `user.email` and `user.name` still return the Design values, and global `user.email` still returns the task 1.1 baseline `akoukoullis@gmail.com` with `user.name` `Anthony Koukoullis`."
        - "Praxis-Dashboard was proved untouched after the commit: `git rev-parse --short HEAD` returned `093495f`, `git status --porcelain -- README.md` returned no output, and full `git status --porcelain` returned only `?? flowcharge/`. The only file this stage wrote inside Praxis-Dashboard is this task list."
        - "Nothing was pushed. No remote was added and no GitHub repository was created."
    ```
