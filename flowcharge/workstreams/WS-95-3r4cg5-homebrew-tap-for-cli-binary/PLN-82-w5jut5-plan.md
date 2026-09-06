---
id: PLN-82-w5jut5
type: plan
workstream: WS-95-3r4cg5
slug: homebrew-tap-for-cli-binary
title: "Distribute the FlowCharge binary through a personal Homebrew tap"
status: done
created: 2026-09-04
updated: 2026-09-04
depends_on: []
links: []
---

# Distribute the FlowCharge binary through a personal Homebrew tap

## Summary

macOS and Linux users install FlowCharge with one command,
`brew install <owner>/flowcharge/flowcharge`, instead of downloading a raw binary from
GitHub Releases. Homebrew's own fetch never sets the quarantine attribute, so this
sidesteps the unsigned-binary Gatekeeper block a browser download hits. No code signing
and no notarization are needed.

Three deliverables. A new standalone git repository at
`/Users/akoukoullis/Work/AK/homebrew-flowcharge/`, scaffolded the way WS-90-1gmwvj
scaffolded `flowcharge-public`. A single formula, `Formula/flowcharge.rb`, covering the
three Homebrew-supported platforms. And a fourth command in this repository,
`.github/scripts/bump-formula.mjs`, which regenerates that formula from the version and
the freshly built binaries each time a release is cut.

The generator lives beside `release.mjs` and `publish-release.mjs` rather than inside
the tap repository, because this repository already holds the version, the artefacts,
the test runner and the CI gate, while the tap repository holds no toolchain at all. It
regenerates the whole formula from a template it owns rather than patching values in
place, because three near-identical `sha256` lines are exactly where surgical text
replacement silently updates two of three. It hashes the local `release/cli/` bytes,
which are the same bytes `publish-release.mjs` uploads.

Nothing is pushed. No GitHub repository is created for either `flowcharge-public` or the
tap. No release is cut.

## Scope

### Acceptance criteria

1. `/Users/akoukoullis/Work/AK/homebrew-flowcharge/` holds a git repository on `main` whose local identity matches Design and whose single commit carries no `Co-Authored-By` trailer.
2. `node .github/scripts/bump-formula.mjs --help` prints its usage on stdout and exits 0, before any option parsing, any file read and any git call.
3. `bump-formula.mjs` refuses with exit 1 and one named message, in the Design order, at each rung of its refusal ladder, and writes no file in any refusal.
4. From a good state `bump-formula.mjs` writes `Formula/flowcharge.rb` into the tap repository with the three platform URLs and the three `sha256` values computed from `release/cli/`, and it commits nothing and pushes nothing.
5. `bump-formula.mjs --dry-run` prints the formula text it would write and exits 0 without writing any file.
6. The formula the generator writes passes `brew style` and `brew audit --strict` inside a tap, with zero offenses.
7. A throwaway tap holding that formula, with its URLs redirected at local fixture binaries, installs a runnable `flowcharge` on `PATH` and passes `brew test`.
8. `npm test` discovers and passes `.github/scripts/bump-formula.test.mjs`, and `ci.yml`, `release.mjs`, `publish-release.mjs` and `release-format.mjs` are unchanged.

### Out of scope

- Cutting a real release, running a real `npm run package:cli` build, creating any GitHub repository, configuring any remote, or pushing anything.
- A Windows formula entry. Homebrew does not run natively on Windows, so `flowcharge-<version>-win-x64.exe` stays a direct Releases download.
- A Linux arm64 formula entry. `tools/package-cli.mjs:27-32` builds no such artefact.
- Any change to `release.mjs`, `publish-release.mjs`, `release-format.mjs` or `tools/package-cli.mjs`, including the next-step lines `release.mjs:270-273` prints.
- Any change to `.github/workflows/ci.yml`. The existing `npm test` step already discovers `.github/scripts/**/*.test.mjs` through `package.json:22`.
- Any change to `flowcharge-public`, including its `README.md` download wording. WS-90-1gmwvj and WS-92-t964y8 own that text.
- Any change to this repository's own `README.md`. WS-92-t964y8 owns it.
- Homebrew bottles, a `livecheck` block, autobump opt-in, or a `.github/workflows/` folder in the tap repository.
- A `--version` or `--help` flag on the FlowCharge binary itself. `src/server.ts` reads no `process.argv`, and adding one means editing the application.
- Staging or tracking `flowcharge/` in this repository. It stays untracked here.

### Assumptions

Settled readings, not open questions. Each is reversible by a later follow-up change.

1. **Tap repository name.** The local folder is `homebrew-flowcharge`, a sibling of `Praxis-Dashboard` and `flowcharge-public`. Homebrew strips the `homebrew-` prefix, so the tap is `<owner>/flowcharge`. The folder does not exist today; this was checked. `/opt/homebrew/Library/Taps/akoukoullis/` already holds `homebrew-versions` and no `homebrew-flowcharge`, so there is no local collision.
2. **Commit identity.** The tap repository uses `user.name = Anthony Koukoullis` and `user.email = 324025743+FlowChargeDev@users.noreply.github.com`, set with `git config --local` only. This pair is byte-for-byte what `/Users/akoukoullis/Work/AK/flowcharge-public`'s local config holds today.
3. **No `version` stanza in the formula.** Homebrew scans `0.1.0` from a `github.com/.../releases/download/v0.1.0/...` URL, and `brew audit` reports an explicit `version` line as redundant. This was reproduced on Homebrew 6.0.21. The stanza is therefore omitted.
4. **Version-independent install line.** `def install` uses a glob rather than an interpolated filename, so the install step does not depend on Homebrew's URL version scanner. Verified installing on Homebrew 6.0.21.
5. **A minimal `test do` block.** The block asserts the installed file is executable. The binary starts a server and takes no flags, so any richer smoke test must start a server, pick a free port, and kill a child process. That cost is not worth it for a personal tap.
6. **The generator writes, the maintainer commits.** `bump-formula.mjs` writes the formula file and prints the `git commit` and `git push` commands to run next. It never commits and never pushes, matching `release.mjs:270-273`, which prints its outward-facing steps rather than performing them.
7. **Hashes come from `release/cli/`.** Those are the exact paths `publish-release.mjs:275-286` hands to `gh release create`, so hashing them hashes the uploaded bytes.
8. **Release constraints.** There are no live users, no production data and no published release. `flowcharge-public` holds one commit, no tag and no remote. There is no migration and no compatibility window.
9. **Commit trailers.** Commits in `Praxis-Dashboard` end with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. Commits made directly in `homebrew-flowcharge` carry none.

## Key flows

**Install FlowCharge with Homebrew** — **Actor:** a macOS or Linux user. **Preconditions:**
Homebrew is installed; a FlowCharge release is published. **Main flow:** the user runs
`brew install <owner>/flowcharge/flowcharge`; Homebrew taps the repository, downloads the
platform's asset, verifies its `sha256`, and links `flowcharge` into the Homebrew prefix;
the user runs `flowcharge` and opens the board in a browser. **Outcome:** a runnable
`flowcharge` on `PATH` with no Gatekeeper prompt. **Edge cases:** the fully qualified
one-line command is the only install instruction this plan publishes, because Homebrew
6.0.0 and later demand explicit trust for a non-official tap and the qualified form grants
that trust for this one formula; a two-step `brew tap` then `brew install flowcharge` route
also exists, but its exact trust requirement is unverified here, so it stays background and
is never offered to a user; a Linux arm64 or Windows user matches no `url` and must take
the direct Releases download instead.

**Bump the tap after a release** — **Actor:** the maintainer, on their own machine.
**Preconditions:** `release.mjs` has built the artefacts and cut the tag; the tag and
branch are pushed; `publish-release.mjs` has created the GitHub Release. **Main flow:** the
maintainer runs `node .github/scripts/bump-formula.mjs`; every refusal rung passes; the
three `sha256` values are computed from `release/cli/`; `Formula/flowcharge.rb` is
rewritten in the tap repository; the two follow-up git commands are printed. The maintainer
reviews the diff, commits and pushes. **Outcome:** `brew install` resolves the new version.
**Edge cases:** a `release/cli/` still holding an older release's artefacts, which does not
match the version-qualified prefix and refuses; a dirty tap working tree, which refuses
before writing; no `origin` on `flowcharge-public`, which refuses unless `--repo` is given.

## Design

### Where each piece lives

```
/Users/akoukoullis/Work/AK/homebrew-flowcharge/     new, standalone git repository
  .gitignore                                        one line, .DS_Store
  README.md                                         what the tap is and how to install
  Formula/flowcharge.rb                             written by the generator

/Users/akoukoullis/Work/AK/Praxis-Dashboard/
  .github/scripts/bump-formula.mjs                  new — the generator
  .github/scripts/bump-formula.test.mjs             new — its tests
```

`Formula/` is the subdirectory Homebrew recommends for a tap
(`/opt/homebrew/docs/How-to-Create-and-Maintain-a-Tap.md:66`). The formula's basename
fixes the Ruby class name, so `flowcharge.rb` holds `class Flowcharge < Formula`.

### Git identity contract for the tap repository

Set inside the new repository only, with `git config --local`. `git config --global` is
never read for a value to write and never written to.

| Key | Value |
|---|---|
| `user.name` | `Anthony Koukoullis` |
| `user.email` | `324025743+FlowChargeDev@users.noreply.github.com` |

### The formula contract

The generator emits exactly this shape. `<owner>/<name>` is the release repository slug,
`<version>` the bare `X.Y.Z`, and each `<sha256-*>` a lowercase 64-character hex digest.
This exact shape was checked on Homebrew 6.0.21: `brew style` and `brew audit --strict`
both report zero offenses, and it installs and passes `brew test`.

```ruby
class Flowcharge < Formula
  desc "Local Kanban board for FlowCharge project-management workstreams"
  homepage "https://github.com/<owner>/<name>"
  license :cannot_represent

  on_macos do
    on_arm do
      url "https://github.com/<owner>/<name>/releases/download/v<version>/flowcharge-<version>-darwin-arm64"
      sha256 "<sha256-darwin-arm64>"
    end
    on_intel do
      url "https://github.com/<owner>/<name>/releases/download/v<version>/flowcharge-<version>-darwin-x64"
      sha256 "<sha256-darwin-x64>"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/<owner>/<name>/releases/download/v<version>/flowcharge-<version>-linux-x64"
      sha256 "<sha256-linux-x64>"
    end
  end

  def install
    bin.install Dir["flowcharge-*"].first => "flowcharge"
  end

  test do
    assert_predicate bin/"flowcharge", :executable?
  end
end
```

Four facts hold this shape together, each verified rather than assumed.

- **No `version` stanza.** Homebrew scans the version from the `github.com` release path.
  `brew audit` rejects a `version` line that repeats it.
- **The staged filename is the URL basename.**
  `/opt/homebrew/Library/Homebrew/unpack_strategy/uncompressed.rb` copies the downloaded
  file under its basename, so the staging directory holds exactly one file named
  `flowcharge-<version>-<platform>`. The glob matches it on every platform, and
  `bin.install` sets the executable bit.
- **`license :cannot_represent`** is one of the three symbols
  `/opt/homebrew/Library/Homebrew/utils/spdx.rb:14-18` allows. It is the correct value for
  `flowcharge-public/README.md:24`'s position: FlowCharge is free to use, its source is not
  published, and there is no `LICENSE` file, per decision D-13.
- **No `url` for Linux arm64 or Windows.** Homebrew reports no available download on those
  platforms, which is the honest result.

### `bump-formula.mjs` — the command contract

```
node .github/scripts/bump-formula.mjs [--tap-repo=<path>] [--public-repo=<path>] [--repo=<owner>/<name>] [--dry-run]
node .github/scripts/bump-formula.mjs --help
```

| Option | Meaning |
|---|---|
| `--tap-repo=<path>` | The `homebrew-flowcharge` working copy. Defaults to `../homebrew-flowcharge`, resolved from this repository's own root. |
| `--public-repo=<path>` | The `flowcharge-public` working copy whose `origin` supplies the slug. Defaults to `../flowcharge-public`. |
| `--repo=<owner>/<name>` | The release repository slug. Overrides the derived one. |
| `--dry-run` | Print the formula text on stdout and exit 0 without writing a file. |
| `--help` | Print usage on stdout and exit 0, ahead of everything else. |

It takes no version argument. The version is this repository's `package.json` `version`
field, the same field `release.mjs:150` and `publish-release.mjs:182` read, so the three
commands cannot disagree about which release is being handled.

It resolves this repository's root from its own file location —
`path.resolve(<its own directory>, '..', '..')`, the pattern at
`publish-release.mjs:83-84` — and never from `process.cwd()`, so a copy placed inside a
test fixture acts on that fixture alone.

**Refusal ladder**, in order, each exiting 1 with one named message and writing nothing:

1. `package.json` is unreadable, or its `version` is not a bare `X.Y.Z`.
2. The tap repository path does not exist, or holds no git repository.
3. The tap repository's tracked working tree is dirty.
4. The public repository path does not exist, or holds no git repository. Skipped when `--repo` is given, because nothing in that repository is then needed.
5. No slug resolves from `--repo` or from the public repository's `origin` remote.
6. Any of the three artefacts `release/cli/flowcharge-<version>-{darwin-arm64,darwin-x64,linux-x64}` is missing or zero bytes.

Rungs 2 and 3 come before the slug and the artefacts so a run that cannot write anywhere
refuses before it reads a remote or hashes a byte.

**Module boundary.** This file knows the Homebrew formula's text, the three
Homebrew-relevant platform labels, the artefact filename prefix, `package.json`'s version
field, both repository roots, and how to read an `origin` remote URL. It does **not** know
the `CHANGELOG.md` heading regex, which stays in `release-format.mjs` alone; the `gh` CLI;
the Bun build or any Bun target string, which stay in `tools/package-cli.mjs`; the tag
shape; or the four-artefact count, which is `release.mjs` and `publish-release.mjs`'s
contract, not this one's. It holds no repository slug, exactly as `publish-release.mjs`
holds none.

**Reuse.** It imports `isBareVersion` from `./release-format.mjs`. Hashing is
`node:crypto`'s `createHash('sha256')` over the file bytes; there is no existing hashing
helper in this repository. Slug parsing repeats `publish-release.mjs:121-141`'s
`slugFromRemoteUrl` as a local copy with a header comment naming its origin, because the
brief forbids changing that file's contracts and a fourth shared module would still leave
two copies in the tree.

**Generation, not patching.** The formula is regenerated whole from a template string this
file owns. Every value in the file is derived, so nothing hand-maintained is lost, and a
partial update of three near-identical `sha256` lines becomes impossible. The tap
repository's `README.md` records that the file is generated and that hand edits do not
survive the next bump.

### The tap repository's README

Short, and it must state four things: that the repository is a personal Homebrew tap for
FlowCharge; the install command in its fully qualified one-line form, because Homebrew
6.0.0 and later require explicit trust for a non-official tap and that form grants it for
this one formula; that `Formula/flowcharge.rb` is generated by
`.github/scripts/bump-formula.mjs` in the private source repository and hand edits are
overwritten; and that Windows and Linux arm64 users take the binary from the Releases page
instead. It names no version and no `sha256`.

### Where the bump sits in the release flow

The release flow becomes four commands rather than three, and the fourth is documented
rather than wired in, because the brief forbids changing the three existing files:

```
node .github/scripts/release.mjs
git -C ../flowcharge-public push origin main && git -C ../flowcharge-public push origin vX.Y.Z
node .github/scripts/publish-release.mjs
node .github/scripts/bump-formula.mjs
```

The order matters only for honesty: the bump writes URLs that resolve once the release
exists. The hashes themselves do not depend on the release, so a bump run early is
correct but points at an asset that is not there yet.

## Stages

Three stages, riskiest first.

1. **The generator and its tests.** Author `.github/scripts/bump-formula.mjs` and
   `.github/scripts/bump-formula.test.mjs` against the contracts above. It holds first
   place because the formula's exact text is the one thing here that, once published,
   fails for every user at once, and this file owns that text. Observable at the end:
   `--help` prints and exits 0; each refusal rung fires with its own message against
   tmpdir fixtures; a good fixture run writes a formula whose three digests match
   `shasum -a 256` of the fixture files; `npm test` passes with the new file discovered.

2. **Prove the generated formula against real Homebrew.** Take the generator's own output
   into a throwaway local tap, redirect its URLs at local fixture binaries, and run the
   full Homebrew loop. It holds this position because it is the only step that proves
   Homebrew accepts and installs what the generator writes, and finding a shape defect
   here costs nothing, while finding it after the tap repository is public costs a
   correction commit. Observable at the end: `brew style` and `brew audit --strict` report
   zero offenses, `brew install` links a runnable `flowcharge`, `brew test` passes, and
   the uninstall and untap leave no trace on the machine.

3. **Create the tap repository.** `git init -b main`, the two local config keys, then
   `README.md` and `.gitignore`, then one commit staged by filename. It holds last place
   because it is the only artefact outside this repository, and it should be created only
   once the formula it will carry is proven. Observable at the end: `git log` shows one
   commit by the Design identity with no `Co-Authored-By` trailer, `git ls-files` lists
   exactly two paths, and `git config --global` is unchanged.

## Data & compatibility

There is no data model, no schema, no API and no existing consumer. No published release
exists, so no user's `brew install` can break.

**Compatibility with the existing release scripts.** The generator adds a fourth command
and changes none of the three. It reads `package.json`'s `version` field and
`release/cli/`, both of which the two existing commands already read, and it writes only
inside the tap repository. `package.json:22`'s test glob already covers
`.github/scripts/**/*.test.mjs`, so the new test file is discovered with no change to
`package.json` or `ci.yml`.

**Formula compatibility across releases.** Each bump replaces the whole formula, so a
Homebrew user always gets the newest version. Homebrew keeps no history of a tap's earlier
formulas beyond the tap's own git history, so a user pinning an older version checks out
an older commit of the tap. That is Homebrew's own model and this plan does not extend it.

**Rollback.** Until the tap repository is pushed, rollback is deleting
`/Users/akoukoullis/Work/AK/homebrew-flowcharge/`. In this repository, rollback is
deleting the two new `.github/scripts/` files; nothing else is touched. After a push, a
wrong formula is corrected by a follow-up commit to the tap, which every `brew update`
picks up. Stage 2's throwaway tap is reversed by `brew uninstall`, then `brew untap`,
both of which remove only what that stage created.

## Testing strategy

**Stage 1 — unit and command-level, in `.github/scripts/bump-formula.test.mjs`.** Follow
the fixture method `publish-release.test.mjs:1-25` establishes: build throwaway
repositories under `os.tmpdir()`, copy `bump-formula.mjs` and its `release-format.mjs`
sibling into the fixture's own `.github/scripts/` folder so the self-location root
resolution is what is actually exercised, and give the public fixture a second bare local
repository as its `origin` so slug derivation is reachable with no network. Cover: `--help`
ahead of everything; every refusal rung by name; a successful run whose three digests are
recomputed independently with `node:crypto` rather than copied from the script's output;
`--dry-run` writing no file; and the whole generated text against an expected string, so a
change to the formula's shape cannot pass unnoticed.

**Stage 2 — integration against the real `brew`, by command.** No test-runner coverage;
these are manual verification steps belonging to the matching task. Sequence:
`brew tap <throwaway>/<name> <local fixture repo path>`; `brew style --formula ...`;
`brew audit --strict --tap ...`; `brew install <throwaway>/<name>/<formula>`; run the
installed binary; `brew test ...`; `brew uninstall ...`; `brew untap ...`.

Four mechanics this stage must respect, each learned by running it:

- `brew` rejects a formula outside a tap. `brew info --formula <path>` answers
  `Homebrew requires formulae to be in a tap`, so the local install check must go through
  a tap, not a loose file.
- `brew tap <name> <path>` **clones** the local path. Edits to the source repository do not
  reach the tap until `git -C "$(brew --repository <name>)" pull`.
- `brew style` on a loose file applies non-formula RuboCop cops and reports false
  `Sorbet/StrictSigil`, `Style/Documentation` and `Style/FrozenStringLiteralComment`
  offenses. Only `brew style --formula <tap>/<name>` is meaningful.
- Homebrew's URL version scanner is `github.com`-specific. A `file://` fixture URL with the
  same basename scans `64` out of `arm64`, so the throwaway copy needs one added
  `version "X.Y.Z"` line that the real formula must not carry. The style and audit checks
  therefore run against the generator's real output, and only the install check runs
  against the redirected copy.
- `brew audit --os all --arch all` raises an internal error on Homebrew 6.0.21. Do not use
  it. Plain `brew audit --strict --tap` covers what is needed.

**Stage 3 — by command, in the new repository.** `git rev-parse --abbrev-ref HEAD` returns
`main`; `git config --local --get user.email` and `--get user.name` return the Design
values; `git config --global --get user.email` returns whatever it returned before;
`git log --format='%an <%ae>%n%B'` shows the Design identity and no `Co-Authored-By`
trailer; `git ls-files` lists exactly `.gitignore` and `README.md`;
`git log --all --oneline | wc -l` returns 1.

**Non-functional.** The generator reads three files, hashes them and writes one file, all
locally, so there is nothing to measure. It makes no network call. Its one security-relevant
property is that the `sha256` values it writes are what protect every user's download from a
tampered asset, which is why stage 1 recomputes them independently rather than trusting the
script's own output. Observability is the script's own printed output, matching its two
siblings.

## Open questions

1. **Question:** Should the tap repository's first commit already contain
   `Formula/flowcharge.rb`, given that no release exists and therefore no correct `sha256`
   can be computed for one?
   **Recommendation:** No. Commit `README.md` and `.gitignore` only, and let the first real
   `bump-formula.mjs` run add the formula. Bun compiles are not guaranteed byte-reproducible,
   so a formula generated from today's build would very likely carry three digests that do
   not match the binaries eventually uploaded, and a tap whose formula fails checksum
   verification is worse for a user than a tap with no formula yet. This is raised rather
   than assumed because the brief names the formula file as a deliverable of this workstream,
   and this reading delivers its generator and its exact contract instead of the file itself.

## Adjacent opportunities

Not requested, and written into no stage, criterion or contract.

1. A `--version` flag on the FlowCharge binary, which would let the formula's `test do`
   block assert the installed version instead of only the executable bit — skip, it means
   editing `src/server.ts`, which this workstream does not own.
2. A fourth printed line in `release.mjs`'s next-steps block naming the bump command, so
   the release flow documents itself — skip, the brief forbids changing that file.
3. A `livecheck` block in the formula so `brew livecheck` can report a newer release — skip,
   the formula is regenerated on every release anyway, so it would report only what the
   maintainer already knows.

## Alternatives considered and rejected

1. **Put the bump script inside the tap repository** — rejected: the tap repository has no
   Node project, no test runner and no CI, so the script would ship untested, and it would
   still need to reach across into this repository for the version and the artefacts.
2. **Patch the version, URLs and digests in place with anchored regular expressions** —
   rejected: three `sha256` lines differ only by the digest, and a partial update publishes
   a formula that fails checksum verification for one platform's users while looking correct.
3. **Download the published release assets and hash those instead of the local build** —
   rejected: it proves only that the URL resolves, which the first real `brew install`
   proves anyway; it cannot run before the release is published; and it makes the generator
   and its tests depend on the network, which no script in `.github/scripts/` does today.
4. **Submit to `homebrew-core` rather than run a personal tap** — rejected: `homebrew-core`
   requires notability this project does not have and generally expects building from
   source, which does not fit a prebuilt Bun binary.
5. **Export `slugFromRemoteUrl` from `publish-release.mjs` and import it** — rejected: the
   brief forbids changing that file's contracts, and lifting it into `release-format.mjs`
   would break that module's stated boundary of knowing text shapes and nothing else.

## Final summary

Generate the formula from a fourth command in `.github/scripts/`, hashing the local
`release/cli/` bytes, and keep the tap repository a formula and a README with no toolchain.
Three stages: the generator with its tests, a real `brew` install loop against a throwaway
tap, then the tap repository itself. Roughly one to two sittings. Top risks: a formula shape
Homebrew rejects, which stage 2 exists to catch before anything is public; three digests
that do not match the uploaded binaries, which stage 1 guards by recomputing them
independently; and Homebrew 6's tap-trust requirement, which makes the fully qualified
install command the only correct one to publish. One open question needs an answer — whether
the tap's first commit ships a formula file at all, when no correct checksum for it can
exist yet.
