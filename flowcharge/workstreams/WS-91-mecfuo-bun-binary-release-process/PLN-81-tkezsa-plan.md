---
id: PLN-81-tkezsa
type: plan
workstream: WS-91-mecfuo
slug: bun-binary-release-process
title: "Cut and publish versioned FlowCharge Board binary releases"
status: done
created: 2026-09-04
updated: 2026-09-04
depends_on: []
links: []
---

# Cut and publish versioned FlowCharge Board binary releases

## Summary

A maintainer cuts a FlowCharge Board release with two commands. The first,
`node .github/scripts/release.mjs`, refuses every bad state across both
repositories, builds the four Bun binaries through the existing `npm run package:cli`,
confirms they landed, and creates the annotated tag `vX.Y.Z` in the separate
`flowcharge-public` repository. The second, `node .github/scripts/publish-release.mjs`,
attaches those four binaries to a GitHub Release on `flowcharge-public`
through `gh release create`, with release notes taken from that repository's own
`CHANGELOG.md` section. Both commands read the version to release from this
repository's `package.json` `version` field. Neither command takes the version as an
argument.

The split is deliberate and copies the model at
`/Users/akoukoullis/Work/AK/flowcharge-core-public/.github/scripts/release.mjs`: the
first command writes only local state, so it is safe to re-run and cheap to reverse; the
second is outward-facing and stays a separate, deliberate act. Neither command pushes.
`release.mjs` prints the two `git push` commands and the publish command to run next.

Two repositories are involved and the script never confuses them. The source repository,
`Praxis-Dashboard`, supplies the `package.json` `version` field and builds the binaries.
The public repository, `flowcharge-public`, supplies the `CHANGELOG.md` heading and
receives the tag and the release. A small shared module, `.github/scripts/release-format.mjs`,
owns both textual shapes — the bare `X.Y.Z` version string and the `## X.Y.Z` release
heading — so the two commands agree by construction.

The release process publishes binaries because decision D-26
(`Praxis-Business/strategy/02-decision-log.md`) settles that FlowCharge Board ships v1
as a Bun-compiled CLI binary. It versions FlowCharge Board with SemVer, independently
of flowcharge-core's own version numbering. The first release is `v0.1.0`.

## Scope

### Acceptance criteria

1. `node .github/scripts/release.mjs --help` prints its usage text on stdout and exits 0, before any option parsing, any git call and any file read.
2. `release.mjs` refuses with exit 1 and one named message, in the order Design fixes, for a `package.json` `version` field that is missing or is not a bare `X.Y.Z`, a source repository not on `main`, a dirty tracked source tree, a missing or non-git public repository, a public repository not on `main`, a dirty tracked public tree, a `CHANGELOG.md` that is missing or holds no `## X.Y.Z` heading or whose newest heading disagrees with the `package.json` `version`, an existing `vX.Y.Z` tag, and a missing `bun` or `gh` — and in every case nothing is built and no tag is created.
3. From a clean state `release.mjs` runs `npm run package:cli` in the source repository, confirms exactly four non-empty `release/cli/flowcharge-<version>-*` artefacts, and creates the annotated tag `vX.Y.Z` in `flowcharge-public` whose message records the source repository's HEAD commit.
4. `release.mjs` pushes nothing and prints, on success, the two `git push` commands for `flowcharge-public` and the `publish-release.mjs` command to run next.
5. `node .github/scripts/publish-release.mjs --dry-run` prints the exact `gh release create` argument vector — tag, repository slug, title, notes body and the four asset paths — and exits 0 without calling `gh`.
6. `publish-release.mjs` refuses with exit 1 and one named message when the public repository has no `origin` remote and no `--repo` flag, when the tag is absent locally or absent from `origin`, when the `CHANGELOG.md` section for the version holds no text, or when the four artefacts are not all present and non-empty.
7. `npm test` runs the new `.github/scripts/` test files alongside the existing `dist/**/*.test.js` files, and the existing `test` job in `.github/workflows/ci.yml` picks them up with no change to any job or step in that file.
8. Executing this plan cuts no release: no GitHub repository is created, no remote is configured, nothing is pushed, no `gh` command runs for real, and `flowcharge-public`'s tracked files and commit history are unchanged.

### Out of scope

- Cutting the real `v0.1.0` release, creating `github.com/akoukoullis/flowcharge`, configuring an `origin` remote on `flowcharge-public`, or pushing anything. The user is not ready, and criterion 8 forbids it.
- Editing `flowcharge-public`'s `CHANGELOG.md` to turn `## Unreleased` into `## 0.1.0 - <date>`. That is the maintainer's own edit at real release time, and `release.mjs` refuses until it exists. Nothing in this plan writes a file inside `flowcharge-public`.
- Any CI workflow, `.github/` folder or release script inside `flowcharge-public`. Design records this as a settled decision with its reason.
- Any release job or tag trigger in this repository's `.github/workflows/ci.yml`. The only change to that file is the one-line correction Design names.
- Any change to `tools/package-cli.mjs`, to the Bun target table, to the four artefact names, or to Windows executable metadata. WS-89-t2g5to owns that file and this plan calls it through its existing CLI contract only.
- Code signing and notarization of the published binaries. WS-94-ked1ye owns the deferral.
- The `build.publish` block in `package.json`, which still names `TODO-REPLACE-OWNER` and `TODO-REPLACE-REPO`. That is the electron-builder auto-update path, a different distribution form.
- Any change to the in-app update checker or the repository it queries.
- Any change to `README.md` in either repository, including download instructions and asset filenames. WS-92-t964y8 and WS-90-1gmwvj own that text.
- Staging or tracking `flowcharge/` in this repository. It stays untracked here.

### Assumptions

These are settled readings, not open questions. Each is reversible by a later follow-up
change.

1. **Four artefacts, three platforms.** The workstream describes three platform binaries; `tools/package-cli.mjs:27-32` builds four files, because macOS is built twice, for `arm64` and `x64`. Four assets are attached. The count four is the contract.
2. **Version source of truth.** Both commands read the version from this repository's `package.json` `version` field, and take no version argument. That field is the single source of truth: `tools/package-cli.mjs:58` names every artefact from the same field, so the tag, the artefact names and the changelog heading cannot disagree by construction. Each command still refuses when the field is missing or is not a bare `X.Y.Z`. Neither command writes `package.json`; raising the version is a separate human edit committed before the release.
3. **Public repository location.** It defaults to `path.resolve(<source root>, '..', 'flowcharge-public')`, which resolves correctly for the real layout, and a `--public-repo=<path>` flag overrides it. A flag rather than an environment variable, for the reason `tools/bundle-public.mjs:19-21` already records for this repository.
4. **Tag in one repository only.** `vX.Y.Z` is created in `flowcharge-public` alone. The source repository is not tagged. Its HEAD commit is recorded in the annotated tag's message instead, so a source commit can still be tagged retroactively if that is ever wanted.
5. **Raw binaries as assets.** The four files are attached under the names `tools/package-cli.mjs` already gives them, with no archiving and no renaming. One download per platform, no extraction step, and no new naming logic. `flowcharge-public`'s README already tells a user to make the file executable.
6. **Repository slug.** `publish-release.mjs` derives `<owner>/<name>` from `flowcharge-public`'s `origin` remote, and refuses with a named message when there is none. The eventual move from a personal account to a `FlowChargeApp` organisation is then a remote change with no code change, which is why the slug is never written into a script.
7. **The maintainer's platform.** Releases are cut on macOS or Linux. `release.mjs` spawns `npm` without a shell, which does not resolve `npm` on Windows. This is accepted rather than worked around: the source repository is the maintainer's own machine.
8. **Release constraints.** There are no live users, no production data and no published release to protect. `flowcharge-public` holds one commit and no tag. There is no migration, and no compatibility window to hold open.
9. **Commit trailers.** Commits this plan's tasks produce in this repository (Praxis-Dashboard) end with the trailer `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`, and commits made directly in the `flowcharge-public` repository carry no such trailer.

## Key flows

**Cut a release** — **Actor:** the maintainer, on their own machine, with `bun` and `gh`
on `PATH`. **Preconditions:** both repositories are on `main` with clean tracked trees;
`package.json`'s `version` is the version being released; `flowcharge-public`'s
`CHANGELOG.md` newest release heading is that same version and is committed; the tag does
not exist; `flowcharge-public` has an `origin` remote. **Main flow:** the maintainer runs
`node .github/scripts/release.mjs`; every refusal check passes in seconds; the Bun
build runs; four artefacts are confirmed; the annotated tag is created in
`flowcharge-public`; the next commands are printed. The maintainer runs the two printed
`git push` commands, then `node .github/scripts/publish-release.mjs`, which creates
the GitHub Release with the changelog section as its notes and the four binaries attached.
**Outcome:** a `vX.Y.Z` release row on `flowcharge-public` carrying four downloadable
binaries, and a tag pointing at the commit whose changelog describes them. **Edge cases:**
the changelog still says `## Unreleased`, which refuses before the build; a repeated run
after a completed release, which refuses at the existing-tag check; `bun` or `gh` absent,
which refuses before the build rather than after it; a build that fails part way, which
leaves no tag because the tag step is never reached; the tag created but not yet pushed,
which `publish-release.mjs` refuses by name; a stale `release/cli/` holding artefacts from
an older version, which does not match the version-qualified prefix and so is ignored.

## Design

### Where the scripts live

`.github/scripts/`, new in this repository, matching the model repository's layout and
keeping release orchestration separate from the build tooling in `tools/`. Each script
derives the source repository root from its own file location — `path.resolve(<its own
directory>, '..', '..')` — never from `process.cwd()`, so the commands behave the same run
from any subdirectory, and so a copy placed inside a test fixture acts on that fixture.

Three new files:

| File | Role |
|---|---|
| `.github/scripts/release-format.mjs` | Pure shared module. No CLI, no side effects at module scope. |
| `.github/scripts/release.mjs` | The local release command: refuse, build, verify, tag, print. |
| `.github/scripts/publish-release.mjs` | The outward-facing publish command: `gh release create`. |

### Contract: `.github/scripts/release-format.mjs`

Dependency-free ESM. It owns the two textual shapes a release has, and nothing else. It
never calls git, never reads a file, never takes a path, and exports no CLI.

- `isBareVersion(value) -> boolean` — true for three groups of digits separated by dots, with no leading `v` and no pre-release or build suffix.
- `newestVersion(changelogText) -> string | null` — the version named by the first `## X.Y.Z` heading in the text, or `null` when the text names none. The regex is unanchored and the first match wins, so an `## Unreleased` heading above the release heading is read past. `flowcharge-public`'s headings carry a trailing ` - YYYY-MM-DD`, which the shape tolerates.
- `sectionBody(changelogText, version) -> string | null` — the lines under the heading that names `version`, up to the next line beginning `## ` or the end of the text, with blank lines removed from both ends. `null` when no heading names the version; the empty string when the heading exists and the section holds no text. The two outcomes are distinguished because they carry different refusal messages.

This module knows the release version string shape and the `CHANGELOG.md` release-heading
shape. It must NOT know git, either repository root, the artefact names, `gh`, or what its
output is used for.

### Contract: `.github/scripts/release.mjs`

No positional arguments. The version to release is read from this repository's
`package.json` `version` field. Flags: `--help`, and `--public-repo=<path>`.

`--help` is answered first, before option parsing that could fail, before any file read
and before any git call, so it always answers. The `HELP` constant is both the file's usage
documentation and the text `--help` prints, so the interface is recorded once.

The refusal ladder runs in this fixed order. Every check is cheap and every one precedes
the build, so a bad state fails in seconds rather than after a multi-minute compile. Each
refusal prints one message naming the problem and the value it found, and exits 1.

| # | Check | Repository |
|---|---|---|
| 1 | `package.json` is readable and its `version` field is a bare `X.Y.Z` | source |
| 2 | The current branch is `main` | source |
| 3 | The tracked working tree is clean, untracked files ignored | source |
| 4 | The `--public-repo` path exists and holds a git repository | public |
| 5 | The current branch is `main` | public |
| 6 | The tracked working tree is clean, untracked files ignored | public |
| 7 | `CHANGELOG.md` exists, holds a `## X.Y.Z` heading, and its newest one is the `package.json` `version` | public |
| 8 | The tag `vX.Y.Z` does not already exist | public |
| 9 | `bun` resolves on `PATH` | — |
| 10 | `gh` resolves on `PATH` | — |

Rung 1 replaces the old argument check, and no separate agreement check follows it: with
one source of truth there is nothing left to disagree with. Checks 9 and 10 mirror
`tools/package-cli.mjs:94-101`'s own `bun` probe: a spawn failure
or a non-zero exit both mean the tool is not usable here. Check 10 belongs in this command
even though this command never calls `gh`, so the maintainer is not stranded with a tag and
no way to publish it.

After the ladder, in order:

- **Build.** Spawn `npm run package:cli` as a child process with `stdio: 'inherit'` and cwd set to the source root, exactly as the model spawns its stamper in the same position. A spawn error or a non-zero exit fails the run with a named message; nothing is tagged.
- **Verify.** List `release/cli/` and count the entries whose name begins `flowcharge-<version>-`. Refuse unless there are exactly four and every one is non-empty. The script therefore knows the artefact filename prefix and the count four, and knows no Bun target string and no platform label — that table stays solely in `tools/package-cli.mjs:27-32`. A future fifth target makes this check refuse loudly by name, which is the correct failure.
- **Tag.** Create the annotated tag in the public repository: `git -C <public> tag -a vX.Y.Z -m "FlowCharge vX.Y.Z (Praxis-Dashboard <short sha of source HEAD>)"`. The source commit is recorded here because the source repository itself is not tagged.
- **Report.** Print the tag, the public repository path, the four artefact paths, and then the three commands to run next: `git -C <public> push origin main`, `git -C <public> push origin vX.Y.Z`, and `node .github/scripts/publish-release.mjs`. Exit 0.

The ordering is what preserves the all-or-nothing property. Nothing outside `release/cli/`
is written before the tag, and the tag is the last write.

This script knows git, both repository roots, `package.json`'s `version` field, the
`npm run package:cli` CLI contract, the artefact filename prefix and count, and the tag
shape. It must NOT know the changelog heading regex, which `release-format.mjs` owns; the
`gh` CLI; the GitHub repository slug; or any Bun target string.

### Contract: `.github/scripts/publish-release.mjs`

No positional arguments. The version to publish is read from this repository's
`package.json` `version` field, the same source `release.mjs` reads. Flags: `--help`,
`--public-repo=<path>`, `--repo=<owner>/<name>`, `--dry-run`.

Its own refusal ladder, again all before any outward call:

1. `package.json` is readable and its `version` field is a bare `X.Y.Z`.
2. The `--public-repo` path exists and holds a git repository.
3. A repository slug is resolvable: `--repo` when given, otherwise derived from the public repository's `origin` remote URL. With neither, refuse and name `git remote add origin` as the fix.
4. The tag `vX.Y.Z` exists in the public repository, and `git ls-remote --tags origin` reports it on the remote. Refuse otherwise, naming the push command, because `gh release create` must attach to a tag the remote already has.
5. `sectionBody` of the public `CHANGELOG.md` for this version is neither `null` nor empty.
6. Exactly four non-empty `release/cli/flowcharge-<version>-*` artefacts exist in the source repository.
7. `gh` resolves on `PATH`.

Then it builds the argument vector
`gh release create vX.Y.Z --repo <slug> --title "FlowCharge vX.Y.Z" --notes <body> <four
asset paths>` and either prints it and exits 0 under `--dry-run`, or spawns `gh` with it,
without a shell, and propagates the exit status. The notes are passed as a single `--notes`
argument rather than through a temporary file: no shell is involved, so backticks, quotes
and newlines in the changelog body need no escaping and nothing needs cleaning up.

This script knows `gh`'s CLI contract, both repository roots, `package.json`'s `version`
field, the artefact prefix and count, and how to read an `origin` URL. It must NOT know
the changelog heading regex, which `release-format.mjs` owns, or the Bun build.

### The two CI decisions

**No CI in `flowcharge-public`.** That repository holds no source, no tests and no build,
so the only thing a workflow there could check is that a tag's release row carries four
assets. The timing makes that structurally wrong: the maintainer pushes the tag first and
creates the release row second, so a tag-triggered job would run before any asset exists
and would fail on every release. Adding a `.github/` folder there also buys a public
surface with nothing behind it.

**No release job in this repository's `.github/workflows/ci.yml`.** The release tag lives
in `flowcharge-public`, so a tag trigger here would never fire. Publishing from here into
another repository would need a cross-repository token held as a secret in this repository,
which is a real credential surface bought for no gain over one local command. The existing
`test` job is neither duplicated nor replaced, and no job or step in that file changes.

The one edit to `.github/workflows/ci.yml` is its header comment, which today promises that
this workstream "adds its own CI-gated release job on top of this file". That promise is
declined above, so the comment is corrected to state that the release process is two local
commands under `.github/scripts/` and to give the reason. Correcting a forward reference
this plan deliberately invalidates is part of delivering the decision; nothing else in that
file is touched.

### How the new tests reach `npm test`

`npm test` is `node --test --test-force-exit "dist/**/*.test.js"`, and `dist/` holds only
what `tsc` compiles from `src/`. A `.mjs` file under `.github/scripts/` is neither compiled
nor discovered, so the script is extended with a second pattern covering the new test files.
The change is additive, keeps one canonical test command, and needs no edit to the `test`
job in `ci.yml`, which already runs `npm test`.

A leading-dot directory is the risk: a glob matcher may exclude `.github` by default. The
preferred form is a second glob pattern; the fallback, if the glob does not match, is naming
the two test files by explicit relative path in the same command. Stage 1 settles which
form works and adopts it.

Test fixtures are throwaway git repositories created under `os.tmpdir()`, following the
temporary-directory pattern `src/lib/projects.test.ts:41-59` already establishes. No test
ever runs against the real `flowcharge-public`.

## Stages

1. **The shared module and the test lane.** Add `.github/scripts/release-format.mjs` with unit coverage, extend the `npm test` pattern list to reach it, and correct the `ci.yml` header comment. It holds first position because the one unproven mechanism in the whole workstream is whether `node --test` reaches a file inside a leading-dot directory at this repository's Node floor; every later stage's verification rests on the answer. Observable at the end: `npm test` runs the new `release-format` tests together with every existing `dist` test, all green, and `ci.yml`'s jobs are byte-for-byte unchanged.
2. **The local release command.** Add `.github/scripts/release.mjs` with its full refusal ladder, two-repository resolution, build trigger, artefact verification and annotated tag, plus fixture-repository coverage of every refusal. It holds second position because the refusal ordering and the two-repository path resolution are where a mistake is expensive, and because the publish command depends on the tag this one creates. Observable at the end: every refusal in the ladder fires with its own message against fixture repositories, and one hand-run against the real source repository and a throwaway clone of `flowcharge-public` produces four artefacts and the annotated tag, with nothing pushed.
3. **The publish command.** Add `.github/scripts/publish-release.mjs` with its refusal ladder, slug resolution, notes extraction and `--dry-run`. It holds last position because it is the only outward-facing surface and it consumes both earlier stages' output. Observable at the end: `--dry-run` prints the complete `gh release create` argument vector against a throwaway clone with a fake `origin`, every refusal fires by name, and no `gh` call runs for real.

## Data & compatibility

There is no data model, no schema, no API and no migration. The three new scripts are
additive: nothing existing imports them, and no existing command changes behaviour. The two
edits to existing files are the `npm test` pattern list, which only widens what the command
discovers, and one comment in `ci.yml`.

`release/cli/` is already covered by the `release/` entry in `.gitignore`, so no artefact
becomes a tracked file in either repository and no ignore rule is added.

**Rollback.** Deleting the three new scripts and reverting the two edits restores today's
behaviour exactly. A tag created in error and not yet pushed is removed with
`git -C <public> tag -d vX.Y.Z`. Past the tag push and the release creation the change
becomes public and is no longer cleanly reversible, which is precisely why both of those
acts stay outside the first command and outside this workstream's execution.

**The irreversibility boundary.** Nothing this plan executes crosses it. The first crossing
is the maintainer's own `git push` of a tag, at a time of their choosing.

## Testing strategy

Stage 1:

- Unit coverage for `release-format.mjs` against fixture strings, not files: `isBareVersion` accepting `0.1.0` and rejecting `v0.1.0`, `0.2`, `0.2.0-rc.1` and the empty string; `newestVersion` reading past an `## Unreleased` heading, tolerating the ` - YYYY-MM-DD` tail `flowcharge-public` uses, and returning `null` for text with no release heading; `sectionBody` returning the body of any release section including one that is not the newest, stopping at the next `## ` line whichever heading it is, trimming blank lines at both ends, returning the empty string for a heading with no text, and `null` for a version no heading names.
- A verification that `npm test` discovers and runs the new file, which is what settles the glob-versus-explicit-path question.

Stage 2:

- Refusal coverage for `release.mjs`, driven as a child process against throwaway git repositories under `os.tmpdir()`, one case per rung of the ladder, each asserting exit 1, the named message, and that no tag exists afterwards. Each case sets up the fixture's own `package.json` `version` field to reach the rung under test, and rung 1 is covered by a fixture whose `version` field is missing, is `v0.1.0`, is `0.2`, or is `0.2.0-rc.1`. Every rung is reachable without a build, which is what makes this coverage fast.
- `--help` coverage: exit 0, usage on stdout, asserted with no readable `package.json` and with no git repository present.
- Ordering coverage: a fixture wrong on two rungs at once reports the earlier one, which pins the table in Design rather than leaving the order incidental.

Stage 3:

- Refusal coverage for `publish-release.mjs` by the same fixture method, one case per rung, each setting up the fixture's own `package.json` `version` field to reach the rung under test, and including the bad-`version`-field case, the no-`origin` case and the tag-not-on-remote case.
- `--dry-run` coverage asserting the full argument vector: the tag taken from the fixture `package.json` `version` field, the slug derived from a fixture `origin`, the title, the notes body matching `sectionBody`'s output, and exactly four asset paths in a stable order.

Three verification limits are real and are stated rather than worked around. First, the
build-and-tag happy path in stage 2 cannot be unit-tested, because `npm run package:cli`
compiles four Bun binaries of 64 MB to 100 MB and downloads a Bun runtime per target on
first use; it is verified once by hand against the real source repository and a throwaway
clone of `flowcharge-public`, and that limit is the same one WS-89-t2g5to's plan already
accepted for the same command. Second, no `gh release create` is ever run for real by this
workstream, so the publish path is verified only to the argument vector `--dry-run` prints;
whether GitHub accepts that vector is proven at the first real release and not before.
Third, `flowcharge-public` has no `origin` remote today, so slug derivation and the
tag-on-remote check are exercised against a fixture remote only.

The release commands are not added to any CI job. `npm test` gains their unit coverage,
which is the whole of what CI runs.

## Open questions

1. **Question:** Should the first public release attach the two unsigned macOS binaries, given that a macOS user who downloads one hits a Gatekeeper block and `flowcharge-public`'s README carries no instruction for clearing it?
   **Recommendation:** Attach all four and publish the release anyway, then treat the missing Gatekeeper instruction as the fix. Holding the macOS assets back leaves the primary development platform with no download at all, which is worse than a documented extra step, and code signing is deferred to WS-94-ked1ye with no date. This is raised rather than assumed because the first release is the one a new user forms an impression from, and a later release does not undo that impression. Any README wording that results belongs to WS-90-1gmwvj or WS-92-t964y8, not to this workstream.

## Adjacent opportunities

Not requested, and written into no stage, criterion or contract.

1. A `--dry-run` flag on `release.mjs` as well, printing the ladder result and the artefact and tag it would produce without running the build — build now if wanted; it is the only way to confirm the whole ladder passes without waiting for a multi-minute compile.
2. A `CHANGELOG.md` in this repository, so the source tree records its own history beside the public one — skip; the released binary's history is the public changelog, and a second file would need keeping in step with it by hand.
3. Windows executable metadata through Bun's `--windows-icon`, `--windows-title` and `--windows-publisher` flags, which WS-89-t2g5to's plan parked in this workstream — skip; it changes `tools/package-cli.mjs`, which this plan deliberately calls rather than edits, and nothing in this workstream's brief asks for it.

## Alternatives considered and rejected

1. **Publish from a CI job inside `flowcharge-public` on tag push** — rejected: that repository holds no source, so its runner cannot build the binaries, and putting the source there to make it possible would contradict decision D-13.
2. **Publish from a tag-triggered `release` job in this repository's `ci.yml`** — rejected: the release tag lives in `flowcharge-public`, so a tag trigger here never fires, and cross-repository publishing needs a token secret held in this repository for no gain over one local command.
3. **Have `release.mjs` run `gh release create` itself, so one command does everything** — rejected: it collapses the model's separation between local, reversible work and the outward-facing publish, and it makes the whole flow unverifiable without cutting a live release, which this workstream forbids.
4. **Require the four artefacts to exist already and refuse otherwise, rather than triggering `npm run package:cli`** — rejected: the workstream states the release process triggers the build, and the model runs its equivalent step as a child process in exactly this position; the gain would be a faster test, which the refusal ladder's placement before the build already delivers.
5. **Copy the model's `changelog-section.mjs` and `check-release.mjs` across as separate executables** — rejected: there is nothing to stamp here so `check-release.mjs` has no subject, and the model's changelog reader `changelog-section.mjs` calls `main()` at module scope, so importing it would run its CLI — a hazard a pure exported module does not carry.

## Final summary

Two local commands under `.github/scripts/`, sharing one pure format module: `release.mjs`
refuses, builds, verifies and tags `flowcharge-public`; `publish-release.mjs` attaches the
four binaries through `gh release create`. Neither pushes. Three stages, smallest first,
roughly one sitting each.

Top risks: `node --test` may not reach a file inside the leading-dot `.github` directory,
which stage 1 settles before anything depends on it; the build-and-tag path can only be
verified by one hand-run, because a four-target Bun compile is too slow for a test; and no
`gh` call is ever made for real, so the publish argument vector is proven only at the first
real release.

One open question needs an answer: whether the first public release attaches the unsigned
macOS binaries, given the Gatekeeper block and the README's silence about it.
