---
id: PLN-83-nn4sj3
type: plan
workstream: WS-92-t964y8
slug: readme-flowcharge-board-positioning
title: "Reauthor README.md around FlowCharge's product positioning and binary distribution"
status: done
created: 2026-09-04
updated: 2026-09-04
depends_on: []
links: []
---

# Reauthor README.md around FlowCharge's product positioning and binary distribution

## Summary

The root `README.md` of this private repository still describes FlowCharge as a passive,
read-only board viewer, links FlowCharge Core to the placeholder URL `https://github.com`
(`README.md:6`), and presents the unsigned Electron builds as the only distribution path
(`README.md:120-149`). All three statements are now wrong.

This plan reauthors that one file in place. It rewrites the positioning paragraph, adds a
distribution section for the D-26 Bun-binary release form, links the real FlowCharge Core
repository, reframes the Electron section as the supported secondary build path, and
sweeps the developer-facing sections for claims the repository has outgrown.

The chosen approach is a **targeted section-level rewrite** of the existing file rather
than a fresh document. The file's developer content — Quick start, the layout tree, the
Scripts table, most of Notes — is the only written record of how this repository is
worked on, and it is largely still true. Rewriting from scratch would destroy accurate
content to fix inaccurate content. Docs-only: no code, no `package.json`, no CI changes.

## Scope

### Acceptance criteria

1. The opening states FlowCharge is the primary product and names both of its jobs —
   rendering the board, and installing and syncing FlowCharge Core skill files into
   agentic coding tools — while the "Private repository / closed-source" banner at
   `README.md:3-4` survives byte-for-byte.
2. The placeholder link `https://github.com` at `README.md:6` is gone, and the README
   links `https://github.com/FlowChargeApp/flowcharge-core`, described as the companion
   open-source skill suite this application installs and orchestrates.
3. A distribution section states the D-26 model: version 1 ships as a Bun-compiled native
   binary for macOS, Linux and Windows; running it starts a local server; the user opens
   the board in a browser.
4. That section names where a user gets the binary — the public `flowcharge-public`
   repository's Releases page and the Homebrew tap one-liner — in a pointer of a few
   lines, without reproducing the public README's download steps.
5. That section states that Electron remains a supported build path and is not the
   version 1 release form.
6. The section at `README.md:120` no longer reads as the primary distribution path, and
   still carries its Gatekeeper and `com.apple.quarantine` explanation and its
   signing-prerequisites list.
7. The Scripts table names every runnable script in `package.json` (the `pre*` hooks
   excepted), and the "How it fits together" tree matches the repository's real top-level
   layout, including `electron/`, all three files in `tools/`, and `.github/scripts/`.
8. Every remaining factual claim the README makes about this repository's own tooling is
   true against the current `package.json` and working tree.

### Out of scope

- Any file other than `README.md`. No code, no `package.json`, no CI, no scripts.
- `flowcharge-public/README.md` and `homebrew-flowcharge/README.md`. Other workstreams own
  those, and this plan only reads them for tone.
- A maintainer release runbook. `release.mjs`, `publish-release.mjs` and
  `bump-formula.mjs` are named where the Scripts table and the tree already require it;
  no step-by-step release procedure is authored.
- Staging or otherwise tracking `flowcharge/`, which is deliberately untracked here.
- Fixing `build.publish.owner` / `build.publish.repo`, still `TODO-REPLACE-OWNER` and
  `TODO-REPLACE-REPO` at `package.json:108-109`. That is a code change.

### Assumptions

- **Docs-only release constraints.** There is no production data, no live user, no
  migration and no feature flag in play. The repository stays shippable at every point,
  because a README edit cannot break a build. Rollback is `git checkout README.md`.
- **No release is cut yet.** No GitHub repository exists for `flowcharge-public` or the
  tap, so the distribution section describes where a user *will* get the binary and
  carries no live download URL and no version number.
- **Owner placeholders stay literal.** The Homebrew line is written
  `brew install <owner>/flowcharge/flowcharge`, matching `homebrew-flowcharge/README.md`
  exactly, and the public repository is named rather than hyperlinked, because the GitHub
  account is undecided — `package.json:108` still says `TODO-REPLACE-OWNER`.
- **The Core URL is used as given.** `https://github.com/FlowChargeApp/flowcharge-core`
  is written verbatim, from D-21 and from `flowcharge-public/README.md`, even though the
  repository is not yet created.
- **The product is called "FlowCharge" throughout.** Per D-19 and D-21 the public name is
  FlowCharge; the existing banner already says so. "FlowCharge Board" is not introduced.
- **The developer-section sweep is in scope.** The brief directs a check of the current
  `package.json` scripts and the real `tools/` and `.github/scripts/` contents against
  what the README says. This plan reads that as licence to correct any claim in those
  sections found false, not only the ones the positioning rewrite touches.
- **The release scripts are named, not documented.** They appear as one-line entries in
  the tree, because the tree claims to show the repository's layout.
- **Commit trailer.** A git commit made in this repository for this workstream's work ends
  with the trailer `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

## Design

The deliverable is one file, `/Users/akoukoullis/Work/AK/Praxis-Dashboard/README.md`.
The contract below fixes its section order and each section's required content. It does
not fix its prose; the task that writes each section owns the wording.

### Required section order

| # | Heading | State after this plan |
|---|---|---|
| 1 | `# FlowCharge` + private-repository banner | Unchanged |
| 2 | Positioning paragraph (no heading) | Rewritten |
| 3 | `## How FlowCharge ships` | New |
| 4 | `## FlowCharge Core` | New |
| 5 | `## Quick start` | Unchanged |
| 6 | `## How it fits together` | Tree corrected |
| 7 | `## Scripts` | Table corrected |
| 8 | `## Notes` | Two bullets corrected |
| 9 | `## Building the Electron app` | Retitled and reframed from `## Packaged builds` |

Sections 3 and 4 sit above `## Quick start` because they describe the product; everything
from `## Quick start` down describes working on this repository's source. Section 9 keeps
its position last, which is itself part of the reframe: the Electron path reads as a
build option, not as the release.

### Section 2 — positioning

Must state, in this order: FlowCharge is the application and the primary product; it reads
a project's `flowcharge/` folder and renders every workstream as a card; it installs the
FlowCharge Core skill files into the user's agentic coding tools, tracks their versions,
and updates them in one click; the board itself is read-only, and board movement still
happens through the `fc-*` skills. It must not claim the skill-install feature is
read-only — it writes into the user's tools.

Grounded facts available to this section: the feature ships as "Manage integrations"
(`src/public/index.html:15`), covers four tools — Claude Code, Cursor, Windsurf, OpenCode
(`src/lib/agentic-tools-catalogue.ts:40,76,126,177`) — and reaches the browser build over
`/api/integrations/*` (`src/server.ts:822-875`) as well as Electron's IPC bridge
(`src/public/browser-ipc-shim.ts:16-21`).

### Section 3 — `## How FlowCharge ships`

Must state: version 1 ships as a Bun-compiled native binary for macOS, Linux and Windows;
running the binary starts a local server and the user opens the board in a browser;
`npm run package:cli` produces the four artefacts
(`flowcharge-<version>-darwin-arm64`, `-darwin-x64`, `-linux-x64`, `-win-x64.exe`) via
`tools/package-cli.mjs`; a user takes the binary from the public `flowcharge-public`
repository's Releases page, or installs it with
`brew install <owner>/flowcharge/flowcharge` from the personal tap; Electron stays a
supported build path (`npm run electron:dev`, `npm run package:mac|linux|win`) but is not
the version 1 release form, and section 9 covers it.

This section is a pointer, not a download page. It must not carry `chmod +x` steps, a
localhost URL walkthrough, or anything else already written in
`flowcharge-public/README.md`.

### Section 4 — `## FlowCharge Core`

One short block linking `https://github.com/FlowChargeApp/flowcharge-core` and stating
that Core is the open-source skill and JavaScript suite, that it is free, complete and
fully usable on its own, and that FlowCharge installs and orchestrates it.

### Section 6 — the layout tree

The tree must match the working tree. Additions and corrections required, all verified
against the repository:

- `electron/` — `main.cts`, `preload.cts` and four IPC handler modules
  (`ipc-handlers.cts`, `agentic-tools-ipc-handlers.cts`, `theme-ipc-handlers.cts`,
  `update-check-ipc-handlers.cts`), plus `tsconfig.json`.
- `tools/` — `copy-assets.mjs` (already present in the tree),
  plus `bundle-public.mjs` and `package-cli.mjs`.
- `.github/scripts/` — `release.mjs`, `publish-release.mjs`, `bump-formula.mjs`,
  `release-format.mjs` and their `.test.mjs` siblings.
- `src/lib/` — currently lists only `extract.ts`, `git.ts` and `projects.ts`. It must also
  reflect the skill-install engine (`agentic-tools-*.ts`, `skill-content-fetch.ts`,
  `skill-release-fetch.ts`, `zip-read.ts`), the update-check modules
  (`update-check.ts`, `update-prefs.ts`), and `detail.ts`, `tree-layout.ts`,
  `yaml-block.ts`. A grouped one-line entry per cluster is sufficient; a file-by-file
  listing of 20 modules is not the point of the tree.
- `src/public/` — add `fonts/`, `img/`, `lib/`, `ipc-adapter.ts`,
  `browser-ipc-shim.ts`, the theme modules and `update-banner.ts`, in the same grouped
  style.
- `release/` — the `electron-builder` and `package-cli.mjs` output directory
  (`package.json:41`, `tools/package-cli.mjs:23`).

### Section 7 — the Scripts table

The table currently lists three commands. `package.json:12-28` defines fifteen, three of
which are `pre*` hooks that never get typed, leaving twelve typeable scripts. The table
must carry all twelve: `build`, `build:base`, `build:release`, `start`, `start:lan`,
`refresh`, `test`, `electron:dev`, `package:mac`, `package:linux`, `package:win`,
`package:cli`.

`build:release` is `build:base` plus `tools/bundle-public.mjs --harden`
(`package.json:15`), and every packaging script runs `build:release`, not `build`.
`npm test` runs `node --test` over `dist/**/*.test.js` and `.github/scripts/**/*.test.mjs`
(`package.json:22`).

### Section 8 — the two false Notes bullets

- `README.md:88-90` claims "two devDependencies (`typescript`, `@types/node`) … no
  framework and no bundler". `package.json:29-36` lists six devDependencies, including
  `esbuild` (a bundler, driven by `tools/bundle-public.mjs`), `javascript-obfuscator`,
  `electron` and `electron-builder`. The bullet's surviving true claim is that the
  shipped code has no *runtime* dependency; it must be rewritten to say only that.
- `README.md:107-113` describes the update-check banner as a property of "the packaged
  app". Once section 3 names two packaged forms, that is ambiguous. The banner is wired
  only to the Electron IPC channels registered in
  `electron/update-check-ipc-handlers.cts` (`src/public/update-banner.ts:4`); the browser
  shim installs `praxisAPI` and `praxisSkillInstallAPI` only
  (`src/public/browser-ipc-shim.ts:16-18`), and `src/server.ts` exposes no update route.
  The bullet must name the Electron build specifically.

Every other bullet in Notes is verified true and stays.

### Section 9 — `## Building the Electron app`

Retitled from `## Packaged builds`. It keeps, unchanged in substance: the unsigned and
unnotarized statement, the `com.apple.quarantine` explanation, the `xattr -dr` command,
and the Linux note. Two changes:

- An opening line placing it as the secondary path per D-26, pointing back to section 3
  for the release form.
- The prerequisites list keeps all four bullets, but the second is now false as written:
  it says the `hardenedRuntime`, `entitlements` and `notarize` keys must be *added*, while
  `package.json:73-74` already sets `hardenedRuntime: true` and `notarize: true`. It must
  be restated as "the credentials are missing, the configuration is not" — which is also
  what `WS-94-ked1ye`'s record says.

### What this document must not do

It must not imply this repository's own source becomes public, must not carry a release
runbook, must not restate `flowcharge-public/README.md`'s download instructions, and must
not name a GitHub owner that has not been decided.

## Stages

1. **Positioning and the Core link.** Rewrite section 2 and add section 4. This goes first
   because it is the claim the whole workstream exists to fix, and because the placeholder
   URL at `README.md:6` is the file's most visible defect. Observable when the opening
   describes both of the product's jobs and no `https://github.com` placeholder remains.
2. **The distribution section.** Add section 3 above `## Quick start`. Second because it
   depends on the positioning above it and because it is the section with the most
   external facts to get right. Observable when the section names the binary targets, the
   local-server-plus-browser model, both acquisition routes, and Electron's secondary
   status.
3. **The Electron section reframe.** Retitle and reopen section 9 and correct its
   prerequisites bullet. Third because it only makes sense once section 3 exists to point
   at. Observable when the section reads as a build option and its four prerequisites are
   each true today.
4. **Developer-section accuracy sweep.** Correct the tree, the Scripts table and the two
   Notes bullets. Last because it is independent of the product framing and is the
   easiest to verify mechanically. Observable when every path in the tree exists on disk
   and the table matches `package.json` in both directions: every command in the table is
   a script in `package.json`, and every typeable (non-`pre*`) script in `package.json`
   appears in the table.

## Data & compatibility

No data model, no migration, no API, no client. `README.md` is not read by any code in
this repository: `tools/copy-assets.mjs` copies `src/public/` assets only, and
`package.json:43-46` ships `dist/**/*` and `package.json` into the Electron bundle.

Rollback is `git checkout README.md`, or a revert of the single commit, at any stage. No
stage is irreversible. Nothing downstream — no build, no test, no release script — reads
this file, so a partially rewritten README cannot break anything.

## Testing strategy

There is no automated coverage for prose, and none is added. Verification per stage is a
manual, mechanical check the task list makes executable:

- **Stages 1-3:** each acceptance criterion is a statement to find in the file, or a
  string to confirm absent. The Core URL is checked character-for-character against
  `flowcharge-public/README.md`, and the Homebrew line against
  `homebrew-flowcharge/README.md`.
- **Stage 4:** every path named in the tree is confirmed to exist, and the Scripts table
  is compared with `package.json`'s `scripts` object in both directions — every command in
  the table is confirmed to be a key of that object, and every key of that object except
  the `pre*` hooks is confirmed to appear in the table. A one-directional check passes on
  a table that is missing a row, so both directions are required. This is the one check
  worth running as a command rather than by eye.
- **Whole workstream:** `npm test` must still pass, purely as evidence nothing outside
  `README.md` was touched. `git status` must show `README.md` as the only modified path,
  and must not show `flowcharge/` staged.

## Open questions

None. Every unsettled point in this plan is recorded as an assumption above, and each one
is recoverable by a later edit to the same file.

## Adjacent opportunities

Not requested by this workstream. Recorded as offers only; none is written into a stage,
a criterion or the contract above.

- A maintainer release runbook — `release.mjs` → push → `publish-release.mjs` →
  `bump-formula.mjs` — as a section of this README or its own document. **Skip** here; it
  is a separate workstream, and the three scripts already carry `--help` text.
- Replacing `TODO-REPLACE-OWNER` / `TODO-REPLACE-REPO` at `package.json:108-109` once the
  GitHub account exists. **Skip**; it is a code change and this workstream is docs-only.
- A short "what is FlowCharge Core" primer in this README, rather than a link. **Skip**;
  Core's own repository owns that text, and a second copy would drift.

## Alternatives considered and rejected

- **Rewrite the README from scratch, modelled on `flowcharge-public/README.md`.** Rejected:
  that file addresses a downloader, this one addresses the maintainer working on the
  source, and a rewrite would discard the accurate Quick start, tree, Scripts and Notes
  content this repository has nowhere else.
- **Copy the public README's download instructions verbatim.** Rejected: the brief forbids
  duplication, and two copies of `chmod +x` and a localhost URL drift apart at the first
  release.
- **Put the distribution model in a new `DISTRIBUTION.md` and link it.** Rejected: the
  workstream touches `README.md` only, and one section is not enough content to justify a
  second file.
- **Keep `## Packaged builds` as it stands and add the CLI section below it.** Rejected:
  leaving the Electron section first and unqualified is exactly the impression D-26 makes
  false, whatever is added underneath.
- **Leave the tree, the Scripts table and Notes untouched as "already correct".** Rejected:
  the tree omits `electron/`, `.github/scripts/` and two of three `tools/` scripts, the
  table omits nine commands including `package:cli`, and two Notes bullets are false
  against the current `package.json`.

## Final summary

- **Approach:** a targeted, section-level rewrite of `README.md` in place — positioning
  and Core link, a new distribution section, an Electron reframe, then an accuracy sweep.
- **Effort:** 4 stages, one file, one sitting. Docs-only.
- **Risks:** naming a GitHub owner or a download URL that does not exist yet; overrunning
  into `flowcharge-public`'s territory by restating its download steps; scope drift into
  `package.json` while correcting claims *about* `package.json`.
- **Open questions:** none. The assumptions worth a second look are the literal `<owner>`
  placeholder, naming the public repository without a hyperlink, and treating the
  developer-section corrections as in scope.
