---
id: TL-95-pf7il9
type: tasklist
workstream: WS-95-3r4cg5
slug: homebrew-tap-for-cli-binary
title: "Distribute the FlowCharge binary through a personal Homebrew tap"
status: done
created: 2026-09-04
updated: 2026-09-04
author: Anthony Koukoullis
depends_on: [PLN-82-w5jut5]
links: []
mode: spec
base_commit: 75d844a
---

# FlowCharge Tasks

## Homebrew tap for the CLI binary

macOS and Linux users install FlowCharge with one command,
`brew install <owner>/flowcharge/flowcharge`, instead of downloading a raw binary from
GitHub Releases. Homebrew's own fetch never sets the quarantine attribute, so this
sidesteps the unsigned-binary Gatekeeper block. No code signing and no notarization are
needed.

Three deliverables, in the plan's riskiest-first order. First, a fourth command in this
repository, `.github/scripts/bump-formula.mjs`, with its test file. It reads
`package.json`'s `version`, refuses through a six-rung ladder, hashes the three
Homebrew-relevant binaries in `release/cli/`, and regenerates a whole
`Formula/flowcharge.rb` into the tap working copy. It never commits and never pushes.
Second, a proof that the generated formula survives real Homebrew: `brew style`,
`brew audit --strict`, and an install-and-test loop through a throwaway local tap. Third,
the tap repository itself at `/Users/akoukoullis/Work/AK/homebrew-flowcharge/`, holding
one commit of `README.md` and `.gitignore`.

Nothing is pushed. No GitHub repository is created. No release is cut. `release.mjs`,
`publish-release.mjs`, `release-format.mjs`, `tools/package-cli.mjs` and
`.github/workflows/ci.yml` are read but never changed.

- [x] 1. The generator and its tests

  ```yaml
  description: "Author .github/scripts/bump-formula.mjs and .github/scripts/bump-formula.test.mjs against the plan's command contract, refusal ladder and formula contract."
  ```

  - [x] 1.1 Author `.github/scripts/bump-formula.mjs`
    ```yaml
    description: "Create the fourth release command: it reads the version, walks the six-rung refusal ladder, hashes the three release/cli/ binaries, and regenerates Formula/flowcharge.rb whole into the tap working copy."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create the new file .github/scripts/bump-formula.mjs. Model its whole shape on .github/scripts/publish-release.mjs, which is the sibling command it sits beside: a leading header comment stating the module boundary, a HELP template literal, module-scope constants, small named helpers, then a single main() called at the end of the file."
      - "Write the header comment to state the module boundary from PLN-82-w5jut5 Design, 'Module boundary': this file knows the Homebrew formula's text, the three Homebrew-relevant platform labels, the artefact filename prefix, package.json's version field, both repository roots, and how to read an origin remote URL. State explicitly that it does not know the CHANGELOG.md heading regex, the gh CLI, the Bun build or any Bun target string, the tag shape, or the four-artefact count."
      - "Resolve this repository's root from the file's own location, not from process.cwd(). Copy the exact two-constant pattern at publish-release.mjs:83-84 — SELF_DIR from path.dirname(decodeURIComponent(new URL(import.meta.url).pathname)), then SELF_ROOT as path.resolve(SELF_DIR, '..', '..'). This is what makes a copy placed inside a test fixture act on that fixture alone."
      - "Import isBareVersion from './release-format.mjs'. Import nothing else from a sibling script. Hash with node:crypto's createHash('sha256') over the file bytes read with fs.readFileSync; there is no existing hashing helper in this repository."
      - "Copy slugFromRemoteUrl from publish-release.mjs:121-141 as a local function, byte-for-byte, with a header comment naming publish-release.mjs as its origin and saying why it is duplicated rather than shared. Do not edit publish-release.mjs to export it."
      - "Write HELP to document the interface from PLN-82-w5jut5 Design, 'the command contract': the two usage lines, the five options --tap-repo=<path>, --public-repo=<path>, --repo=<owner>/<name>, --dry-run and --help, the numbered refusal list, and the exit codes. State in it that there is no version argument and that the version comes from this repository's package.json version field."
      - "In main(), make --help the first thing checked, ahead of any option parsing that could fail, any file read and any git call: write HELP to stdout and exit 0. Follow the Step 0 comment shape at publish-release.mjs:146-152."
      - "Parse the argument vector with a for..of loop over process.argv.slice(2), matching publish-release.mjs:154-172. Default tapRepo to path.resolve(SELF_ROOT, '..', 'homebrew-flowcharge') and publicRepo to path.resolve(SELF_ROOT, '..', 'flowcharge-public'). Reject any unrecognised argument with the same 'unexpected argument' refusal shape."
      - "Implement the refusal ladder in exactly this order, each exiting 1 through a fail() helper that prefixes 'bump-formula: ' and writes to stderr, and each writing no file. Rung 1: package.json unreadable, or its version not a bare X.Y.Z per isBareVersion. Rung 2: the tap repository path does not exist, or `git rev-parse --git-dir` fails there. Rung 3: the tap repository's tracked working tree is dirty — `git status --porcelain --untracked-files=no` returns any line. Rung 4: the public repository path does not exist or holds no git repository, skipped entirely when --repo was given. Rung 5: no slug resolves from --repo or from the public repository's origin remote. Rung 6: any of the three artefacts release/cli/flowcharge-<version>-{darwin-arm64,darwin-x64,linux-x64} is missing or zero bytes."
      - "Give each rung one named message that no other rung could produce, so a test can match one rung without matching another. Follow the wording style of publish-release.mjs:189-263, which names the offending path and the command that fixes it."
      - "Keep rungs 2 and 3 ahead of the slug and the artefacts, so a run that cannot write anywhere refuses before it reads a remote or hashes a byte. Add a comment saying so."
      - "Build the formula text by regenerating the whole file from one template string this file owns, interpolating only the slug, the version and the three digests. Do not patch values into an existing file and do not use anchored regular expressions — three near-identical sha256 lines are exactly where surgical replacement silently updates two of three."
      - "Emit exactly the shape in PLN-82-w5jut5 Design, 'The formula contract': class Flowcharge < Formula; desc \"Local Kanban board for FlowCharge project-management workstreams\"; homepage \"https://github.com/<owner>/<name>\"; license :cannot_represent; an on_macos block holding on_arm and on_intel; an on_linux block holding only on_intel; a def install of bin.install Dir[\"flowcharge-*\"].first => \"flowcharge\"; and a test do block of assert_predicate bin/\"flowcharge\", :executable?. Each url is https://github.com/<owner>/<name>/releases/download/v<version>/flowcharge-<version>-<label>."
      - "Emit no version stanza. Homebrew scans the version from the github.com release path and brew audit reports an explicit version line as redundant."
      - "Emit no url for Linux arm64 and none for Windows. tools/package-cli.mjs:27-32 builds no Linux arm64 artefact, and Homebrew does not run natively on Windows."
      - "Under --dry-run, print the formula text on stdout and exit 0 without writing any file. Otherwise write it to <tapRepo>/Formula/flowcharge.rb, creating the Formula directory when it is absent, then print the two follow-up git commands the maintainer runs next — a `git -C <tapRepo> add`/`commit` line and a `git -C <tapRepo> push` line. Never run git commit and never run git push, matching release.mjs:270-273, which prints its outward-facing steps rather than performing them."
    pattern: ".github/scripts/bump-formula.mjs — one new file. Reads .github/scripts/release-format.mjs, package.json and release/cli/ only; writes only inside the tap repository."
    imports: "node:fs, node:path, node:crypto (createHash), node:child_process (spawnSync), and isBareVersion from ./release-format.mjs."
    compatibility: "Plain ESM .mjs run by node directly, per PLN-82-w5jut5 Design. package.json engines require node >=20.14. No dependency may be added. The three exported contracts of release-format.mjs, and every line of release.mjs, publish-release.mjs and tools/package-cli.mjs, stay unchanged."
    gotcha: "release/cli/ at base_commit holds no file matching the plan's artefact names — see Divergence 1 — so a real run here refuses at rung 6, which is correct behaviour, not a defect. Rung 4 must be skipped when --repo is given, or a run with an explicit slug refuses for a repository it does not need. slugFromRemoteUrl must be copied from the file as read, not retyped, because it handles both the SSH and the scheme forms. The generated Ruby must not carry a version stanza; adding one to make a local file:// fixture work would fail brew audit for the real formula."
    verify:
      - "node .github/scripts/bump-formula.mjs --help; echo \"exit=$?\" — must print the usage text on stdout and report exit=0. At base_commit 75d844a this file does not exist and node fails with MODULE_NOT_FOUND, so the step discriminates."
      - "node .github/scripts/bump-formula.mjs --repo=owner/name --tap-repo=/nonexistent-tap 2>&1 >/dev/null | head -1 — must name the tap repository path and say it does not exist. At base_commit the same command prints a node MODULE_NOT_FOUND stack instead."
      - "git diff --name-only 75d844a -- .github/scripts/release.mjs .github/scripts/publish-release.mjs .github/scripts/release-format.mjs tools/package-cli.mjs .github/workflows/ci.yml | wc -l — must return 0. Measured 0 at base_commit: this is a non-regression guard on files the plan forbids touching, so it cannot fail before the change and exists to stay at 0 after it."
    checklist:
      - "Does `--help` print and exit 0 before any option parsing, any file read and any git call?"
      - "Do all six refusal rungs fire in the plan's order, each with its own message, each exiting 1, and each writing no file?"
      - "Is rung 4 skipped when --repo is supplied?"
      - "Is the repository root resolved from import.meta.url and never from process.cwd()?"
      - "Is the formula regenerated whole from one template string, with no version stanza, no Linux arm64 url and no Windows url?"
      - "Does the script run no git commit and no git push, and is release-format.mjs imported rather than modified?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.2 Author `.github/scripts/bump-formula.test.mjs` — fixture harness, `--help`, and every refusal rung
    ```yaml
    description: "Create the test file with its tmpdir fixture builder, the --help case, and one named case per refusal rung, each asserting exit 1, the rung's own message, and that no file was written."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create .github/scripts/bump-formula.test.mjs using node:test and node:assert/strict. Follow the fixture method the header comment at publish-release.test.mjs:1-25 establishes, and reuse its helper shapes: git(cwd, args) that throws with the tool's stderr attached, initRepo(dir) that inits on an explicit main branch with a local identity and gpgsign off, and a makeFixture({...}) whose defaults all pass, with each case overriding only the one thing its rung is about."
      - "Build each fixture under os.mkdtempSync(path.join(os.tmpdir(), 'fc-bump-test-')), holding: a source repository with .github/scripts/ into which the real bump-formula.mjs and its release-format.mjs sibling are copied with fs.copyFileSync; a package.json carrying the fixture version; a release/cli/ folder; a tap working copy; and a public working copy with a second, bare local repository as its origin so slug derivation is reachable with no network."
      - "Copy both scripts into the fixture's own .github/scripts/ folder. That copy is the whole point: running the real file with a cwd of the fixture would still resolve the root to this repository, so only the copy exercises the self-location root resolution."
      - "Add a runBump(fixture, args) helper that spawns process.execPath against the fixture's own copy of bump-formula.mjs with a cwd of os.tmpdir(), so a script that resolved its root from process.cwd() would fail here. Return { status, stdout, stderr }."
      - "Add an assertRefusal(fixture, res, { message, absent = [] }) helper asserting exit 1, that stderr matches the rung's own message, that stderr matches none of the `absent` patterns, and that <tapRepo>/Formula/flowcharge.rb does not exist. The no-file assertion is what proves a refusal wrote nothing."
      - "Write the --help case: assert exit 0, that stdout carries the usage line, and that it answers with no package.json, no tap repository and no public repository present at all — so the test proves --help runs ahead of every read."
      - "Write one test per refusal rung, naming each test so its title begins 'rung N ' for N from 1 to 6. Rung 1 gets four sub-cases as publish-release.test.mjs does: version field missing, v-prefixed, two-part, and pre-release. Rung 2 gets two: a tap path that does not exist, and a tap path holding no git repository. Rung 3: a tap repository with a modified tracked file. Rung 4: a public path that does not exist, plus a case proving --repo skips this rung. Rung 5: a public repository with no origin remote and no --repo. Rung 6: one artefact missing, and one artefact present but zero bytes."
      - "Give each refusal case an `absent` pattern naming a neighbouring rung's message, so a ladder that fires the wrong rung fails the test rather than passing on the exit code alone."
      - "Put git on the child process PATH by symlinking the resolved real git into the fixture's own bin directory and passing that as PATH, following publish-release.test.mjs's resolveTool helper. No gh stub is needed here; this command never calls gh."
      - "Add a cleanup(fixture) that removes the fixture root, and call it from a finally block in every case."
    pattern: ".github/scripts/bump-formula.test.mjs — one new file. Reads .github/scripts/bump-formula.mjs and .github/scripts/release-format.mjs; writes only under os.tmpdir()."
    imports: "node:test, node:assert/strict, node:fs, node:os, node:path, node:child_process (spawnSync), node:url (fileURLToPath)."
    compatibility: "Discovered by package.json:22's existing glob \".github/scripts/**/*.test.mjs\" with no change to package.json or .github/workflows/ci.yml. Plain ESM. No test framework may be added — the repository uses node --test only."
    gotcha: "A fixture must never touch the real /Users/akoukoullis/Work/AK/homebrew-flowcharge or flowcharge-public; always pass explicit --tap-repo and --public-repo. Fixture repositories need a local user.email, user.name and commit.gpgsign=false or commits fail on a machine with no global identity. Rung 3's dirty-tree case needs a tracked file to modify, so the tap fixture must have at least one commit first. Asserting the exit code alone does not distinguish one rung from another — the message match and the `absent` patterns are what do."
    verify:
      - "node --test .github/scripts/bump-formula.test.mjs 2>&1 | grep -E ' (tests|pass|fail)' — must report fail 0. At base_commit 75d844a the runner answers \"Could not find '.github/scripts/bump-formula.test.mjs'\", so the step discriminates. Match the word only: node --test prefixes its summary lines with the multi-byte character ℹ, which a leading single-character wildcard never matches under this shell's C locale."
      - "node --test .github/scripts/bump-formula.test.mjs 2>&1 | grep -cE ' rung [1-6] ' — must return at least 6, one passing case per ladder rung. Measured 0 at base_commit."
      - "node --test .github/scripts/bump-formula.test.mjs 2>&1 | grep -cE ' --help ' — must return at least 1. Measured 0 at base_commit."
    checklist:
      - "Does every case run the fixture's own copy of bump-formula.mjs, from a cwd of os.tmpdir(), rather than the real file?"
      - "Does every refusal case assert exit 1, the rung's own message, and that no Formula/flowcharge.rb was written?"
      - "Does every refusal case carry at least one `absent` pattern naming a neighbouring rung?"
      - "Is there a case proving --repo skips rung 4?"
      - "Does the --help case run with no package.json and no repositories present?"
      - "Is every fixture root removed in a finally block, and is no real repository under /Users/akoukoullis/Work/AK/ touched?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.3 Extend `.github/scripts/bump-formula.test.mjs` with the success path
    ```yaml
    description: "Add the good-state cases: a run that writes the formula with three independently recomputed digests, an equality assertion on the whole generated text, and a --dry-run case that prints the text and writes no file."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Add to the existing .github/scripts/bump-formula.test.mjs, after the refusal cases. Reuse makeFixture, runBump and cleanup unchanged; add no second fixture builder."
      - "Add a success case: run the fixture's bump-formula.mjs from an all-defaults fixture, assert exit 0, and assert <tapRepo>/Formula/flowcharge.rb now exists."
      - "Recompute the three expected digests inside the test with node:crypto's createHash('sha256') over the fixture's own release/cli/ bytes. Never copy a digest out of the script's stdout or out of the file it wrote — that would assert nothing about correctness. Give each fixture binary distinct content so a formula that wrote the same digest three times fails."
      - "Assert each recomputed digest appears in the formula text under the right platform block: the darwin-arm64 digest inside on_macos/on_arm, the darwin-x64 digest inside on_macos/on_intel, and the linux-x64 digest inside on_linux/on_intel. A digest present anywhere in the file is not enough — a transposed pair would pass that."
      - "Add a whole-text case: build the complete expected formula string in the test from the fixture's slug, version and recomputed digests, and assert strict equality against the file's contents. This is what makes a change to the formula's shape impossible to land unnoticed."
      - "Assert in that case that the text carries no line matching /^\\s*version\\s+\"/, no url naming linux-arm64, and no url naming win-x64."
      - "Add a --dry-run case: assert exit 0, that stdout carries the formula text including all three digests, and that <tapRepo>/Formula/flowcharge.rb does not exist afterwards."
      - "Add a case asserting the successful run left the tap repository with no new commit — `git -C <tapRepo> rev-list --count HEAD` is unchanged and `git status --porcelain` now shows the formula as an untracked or modified path. This is what proves the generator writes but never commits."
      - "Add a case passing --repo=<owner>/<name> explicitly and asserting the homepage and the three urls carry that slug, so the override path is covered as well as the derived one."
    pattern: ".github/scripts/bump-formula.test.mjs — additions to the file authored in task 1.2. No other file changes."
    imports: "node:crypto (createHash) in addition to the imports task 1.2 established."
    compatibility: "Same node --test runner and the same package.json:22 glob. No new dependency and no change to package.json or ci.yml."
    gotcha: "Building the expected formula text in the test by calling the script's own template function would make the equality assertion circular — write the expected string out literally in the test. Fixture binaries with identical contents hash identically, which hides a generator that reuses one digest for all three platforms. The --dry-run case must assert the absence of the file, not only the presence of stdout."
    verify:
      - "node --test .github/scripts/bump-formula.test.mjs 2>&1 | grep -E ' (tests|pass|fail)' — must report fail 0 and a tests count of at least 12. At base_commit 75d844a the file does not exist and the runner reports \"Could not find\"; after task 1.2 alone the count is below 12. Match the word only: node --test prefixes its summary lines with the multi-byte character ℹ, which a leading single-character wildcard never matches under this shell's C locale."
      - "node --test .github/scripts/bump-formula.test.mjs 2>&1 | grep -cE '(dry-run|digest|formula text)' — must return at least 3. Measured 0 at base_commit."
      - "grep -c \"createHash\" .github/scripts/bump-formula.test.mjs — must return at least 1, proving the expected digests are recomputed rather than copied. Measured 0 at base_commit, where the file does not exist."
    checklist:
      - "Are the three expected digests recomputed with node:crypto inside the test, and never read back from the script's own output?"
      - "Do the three fixture binaries carry distinct contents?"
      - "Is each digest asserted inside its own platform block rather than merely present in the file?"
      - "Does a whole-text equality assertion cover the complete generated formula?"
      - "Does the --dry-run case assert that no file was written?"
      - "Is there a case proving the run added no commit to the tap repository?"
    self_eval:
      passed: true
      failures:
        - item: "Does a whole-text equality assertion cover the complete generated formula?"
          reason: "The first draft's companion guard asserted doesNotMatch(text, /win-x64/), which also matches the legitimate darwin-x64 label, so the case failed against a correct formula."
          fix: "Anchored the pattern as /-win-x64/, which darwin-x64 cannot match, and added a comment saying why the leading hyphen is load-bearing."
        - item: "Is there a case proving the run added no commit to the tap repository?"
          reason: "The first draft read git status --porcelain, which collapses a newly created directory to '?? Formula/' and never names the file, so the match on Formula/flowcharge.rb failed."
          fix: "Passed --untracked-files=all so the status names the written file itself, and added a comment saying why the default is not enough."
    ```
  - [x] 1.4 Confirm the suite gate and the untouched-files guard
    ```yaml
    description: "Run the project's own test command to prove the new test file is discovered and passes, and prove the five files the plan forbids touching are byte-identical to base_commit."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run `npm test`. It builds first through the pretest script, then runs node --test over both globs in package.json:22. Change nothing in package.json and nothing in .github/workflows/ci.yml — the existing glob already covers .github/scripts/**/*.test.mjs."
      - "If the new file is not discovered, fix the file's name or location rather than widening the glob."
      - "Confirm .github/scripts/release.mjs, .github/scripts/publish-release.mjs, .github/scripts/release-format.mjs, tools/package-cli.mjs and .github/workflows/ci.yml are unchanged against base_commit 75d844a."
      - "Confirm nothing under flowcharge/ has been staged. That folder is deliberately untracked in this repository."
      - "When committing this repository's two new files, end the commit message with the trailer 'Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>'. Commits made later inside homebrew-flowcharge carry no such trailer."
    pattern: "No file is edited by this task. It gates .github/scripts/bump-formula.mjs and .github/scripts/bump-formula.test.mjs against the repository's own test command."
    imports: "None. The project's own npm scripts and git."
    compatibility: "npm test runs `npm run build` first through pretest, so the TypeScript toolchain must be installed — run `npm install` if node_modules is absent."
    gotcha: "npm test compiles the whole project before running, so a TypeScript error anywhere fails this gate for reasons unrelated to the new files. Read the failure before assuming the new test file caused it."
    verify:
      - "npm test 2>&1 | grep -E ' (tests|pass|fail)' — must report fail 0 and a tests count strictly greater than 212. Measured at base_commit 75d844a: tests 212, pass 212, fail 0, so the count is what discriminates. Match the word only: node --test prefixes its summary lines with the multi-byte character ℹ, which a leading single-character wildcard never matches under this shell's C locale."
      - "git diff --name-only 75d844a -- .github/scripts/release.mjs .github/scripts/publish-release.mjs .github/scripts/release-format.mjs tools/package-cli.mjs .github/workflows/ci.yml | wc -l — must return 0. Measured 0 at base_commit: a non-regression guard on files the plan forbids touching, so it cannot fail before the change."
      - "git diff --cached --name-only | grep -c '^flowcharge/' — must return 0. Measured 0 at base_commit with nothing staged: a guard that flowcharge/ is never staged, so it cannot fail before the change."
      - "git status --porcelain .github/scripts/ — must list exactly two new paths, bump-formula.mjs and bump-formula.test.mjs, and nothing else."
    checklist:
      - "Does npm test discover and pass the new test file with no change to package.json?"
      - "Is .github/workflows/ci.yml unchanged?"
      - "Are release.mjs, publish-release.mjs, release-format.mjs and tools/package-cli.mjs all unchanged against 75d844a?"
      - "Is the total test count higher than the 212 measured at base_commit, with zero failures?"
      - "Is nothing under flowcharge/ staged?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Prove the generated formula against real Homebrew

  ```yaml
  description: "Take the generator's own output into a throwaway local tap, run brew style and brew audit against the real text, redirect the urls at local fixture binaries for the install loop, then leave no trace on the machine."
  ```

  - [x] 2.1 Generate the formula into a throwaway tap fixture
    ```yaml
    description: "Build a scratch source repository and a scratch tap repository outside the project tree, run the generator against them, and cross-check the three written digests against shasum."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create one scratch root outside the project tree: SCRATCH=\"$(mktemp -d \"${TMPDIR:-/tmp}/fc-tap-check.XXXXXX\")\". Keep this value for tasks 2.2, 2.3 and 2.4. Write nothing under the user's home directory and nothing under Praxis-Dashboard."
      - "Build $SCRATCH/source as a fake source repository: a .github/scripts/ folder holding copies of the real bump-formula.mjs and release-format.mjs, a package.json carrying {\"version\":\"0.1.0\"}, and a release/cli/ folder."
      - "Put three non-empty fixture binaries in $SCRATCH/source/release/cli/, named flowcharge-0.1.0-darwin-arm64, flowcharge-0.1.0-darwin-x64 and flowcharge-0.1.0-linux-x64. Make each a small executable shell script with distinct content, so the three digests differ and so the installed file can actually be run in task 2.3. release/cli/ in the real repository holds no usable binary — see Divergence 1."
      - "Build $SCRATCH/tap as a git repository with at least one commit, so brew can clone it. brew tap requires a git repository, not a loose folder."
      - "Run the fixture's own copy of the generator: node $SCRATCH/source/.github/scripts/bump-formula.mjs --tap-repo=$SCRATCH/tap --repo=akoukoullis/flowcharge-public. Pass --repo so no public repository fixture is needed."
      - "Read the generated $SCRATCH/tap/Formula/flowcharge.rb and confirm it matches the shape in PLN-82-w5jut5 Design, 'The formula contract'."
      - "Commit the generated formula inside $SCRATCH/tap, because brew tap clones the repository and only sees committed content."
    pattern: "A throwaway tree under $TMPDIR only. No file in Praxis-Dashboard, in flowcharge-public, or in homebrew-flowcharge is created or changed by this task."
    imports: "node, git, shasum, mktemp. All present on this machine."
    compatibility: "Homebrew 6.0.21 is what is installed here. The generator must already exist and pass task 1.4."
    gotcha: "release/cli/ in this repository holds only zero-byte .rsls placeholders, so the generator must be pointed at the scratch source copy and not at the real tree — see Divergence 1. Fixture binaries with identical contents produce identical digests and hide a transposition bug. brew clones a tap, so an uncommitted formula is invisible to it."
    verify:
      - "test -f \"$SCRATCH/tap/Formula/flowcharge.rb\" && echo present — must print present. At base_commit 75d844a the generator does not exist and no such path can be produced."
      - "test -n \"$SCRATCH\" && diff <(for f in darwin-arm64 darwin-x64 linux-x64; do shasum -a 256 \"$SCRATCH/source/release/cli/flowcharge-0.1.0-$f\" | cut -d' ' -f1; done) <(grep -o '[0-9a-f]\\{64\\}' \"$SCRATCH/tap/Formula/flowcharge.rb\") && echo digests-match — must print digests-match, proving the three written digests are the three fixture files' own, in platform order. The -n guard is load-bearing: with $SCRATCH unset both sides of the comparison are empty, diff of two empty streams succeeds, and the step prints digests-match with no fixture present at all. At base_commit 75d844a the guarded form prints nothing and exits 1, so the step discriminates."
      - "grep -cE '^\\s*version \"' \"$SCRATCH/tap/Formula/flowcharge.rb\" — must return 0, confirming no version stanza was emitted."
      - "grep -cE 'linux-arm64|-win-x64' \"$SCRATCH/tap/Formula/flowcharge.rb\" — must return 0, confirming no Linux arm64 and no Windows url was emitted. The leading hyphen on -win-x64 is load-bearing: the bare pattern win-x64 is a substring of the legitimate label darwin-x64, so the unanchored form returns 1 against a correct formula. Corrected during execution — see self_eval."
    checklist:
      - "Is every scratch path under $TMPDIR, with nothing written under the home directory or the project tree?"
      - "Do the three fixture binaries carry distinct contents and the executable bit?"
      - "Do the three digests in the formula match shasum -a 256 of the three fixture files, in platform order?"
      - "Does the formula carry no version stanza, no Linux arm64 url and no Windows url?"
      - "Is $SCRATCH/tap a git repository whose generated formula is committed?"
    self_eval:
      passed: true
      failures:
        - item: "Does the formula carry no version stanza, no Linux arm64 url and no Windows url?"
          reason: "This task's own fourth verify step read grep -cE 'linux-arm64|win-x64' and required 0, but the substring win-x64 is contained in the legitimate label darwin-x64, so the step returned 1 against a correctly generated formula. Measured both forms on the real output: the unanchored pattern returned 1, the anchored pattern returned 0."
          fix: "Anchored the pattern as -win-x64 with a leading hyphen, which darwin-x64 cannot match, and recorded why in the verify step's own text. Same defect class as the one task 1.3 caught in its doesNotMatch assertion."
    ```
  - [x] 2.2 Run `brew style` and `brew audit --strict` against the generator's real output
    ```yaml
    description: "Tap the scratch repository and run Homebrew's two static checks against the unmodified generated formula, requiring zero offenses from each."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Tap the scratch repository under a throwaway name: brew tap fcscratch/flowcharge \"$SCRATCH/tap\". Use a name that cannot collide with the real tap — /opt/homebrew/Library/Taps/akoukoullis/ already holds homebrew-versions, and the eventual real tap will be akoukoullis/flowcharge."
      - "Run brew style --formula fcscratch/flowcharge/flowcharge and require it to report no offenses."
      - "Run brew audit --strict --tap fcscratch/flowcharge and require exit 0 with no offense listed."
      - "Run both checks against the generator's real, unmodified output. The redirected copy made in task 2.3 must never be what these two checks see."
      - "If either check reports an offense, correct .github/scripts/bump-formula.mjs's template, re-run task 2.1's generation, commit inside $SCRATCH/tap, then run `git -C \"$(brew --repository fcscratch/flowcharge)\" pull` before re-checking. brew tap clones the local path, so edits in $SCRATCH/tap do not reach the tap until that pull."
      - "Do not run brew audit --os all --arch all. It raises an internal error on Homebrew 6.0.21. Plain brew audit --strict --tap covers what is needed."
      - "Do not run brew style against a loose .rb path. Outside a tap it applies non-formula RuboCop cops and reports false Sorbet/StrictSigil, Style/Documentation and Style/FrozenStringLiteralComment offenses."
    pattern: "The throwaway tap fcscratch/flowcharge and the scratch tree from task 2.1. If a defect is found, .github/scripts/bump-formula.mjs's template string is the only file corrected."
    imports: "brew (Homebrew 6.0.21 on this machine), git."
    compatibility: "Homebrew 6.0.21. license :cannot_represent is one of the three symbols /opt/homebrew/Library/Homebrew/utils/spdx.rb:14-18 allows, and Formula/ is the subdirectory /opt/homebrew/docs/How-to-Create-and-Maintain-a-Tap.md:66 recommends."
    gotcha: "brew rejects a formula outside a tap — brew info --formula <path> answers 'Homebrew requires formulae to be in a tap'. brew tap clones, so a source edit needs a pull into the tap clone. brew audit --os all --arch all errors internally on this version. The formula's basename fixes the Ruby class name, so flowcharge.rb must hold class Flowcharge."
    verify:
      - "brew tap fcscratch/flowcharge \"$SCRATCH/tap\" && brew style --formula fcscratch/flowcharge/flowcharge — must report no offenses. Measured at base_commit: brew tap | grep -c flowcharge returns 0, so this tap does not exist and the command cannot run there."
      - "brew audit --strict --tap fcscratch/flowcharge; echo \"exit=$?\" — must report exit=0 with no offense listed."
      - "test -n \"$SCRATCH\" && brew cat fcscratch/flowcharge/flowcharge > \"$SCRATCH/audited.rb\" && grep -cE '^\\s*version \"' \"$SCRATCH/audited.rb\" — must return 0, confirming the audited text is the generator's real output and not a redirected copy. The two guards are load-bearing: without them, an unset $SCRATCH or an absent tap makes brew cat fail, and grep -c over empty input answers 0 and passes the step vacuously. At base_commit 75d844a the guarded form prints nothing and exits 1, so the step discriminates."
    checklist:
      - "Do both checks run through a tap rather than against a loose file path?"
      - "Does brew style report zero offenses?"
      - "Does brew audit --strict --tap exit 0 with zero offenses?"
      - "Is the audited formula the generator's unmodified output, with no version stanza and no file:// url?"
      - "Was brew audit --os all --arch all avoided?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 2.3 Install and test a redirected copy of the formula
    ```yaml
    description: "Point a copy of the formula at the local fixture binaries, install it through the throwaway tap, run the installed flowcharge, and pass brew test."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Copy the three fixture binaries from task 2.1 to a stable path such as $SCRATCH/bins/, so the urls the redirected formula carries resolve for the whole of this task."
      - "In $SCRATCH/tap only, edit Formula/flowcharge.rb to replace the three https://github.com/... urls with file://$SCRATCH/bins/flowcharge-0.1.0-<label> urls carrying the same basenames, and add one version \"0.1.0\" line."
      - "The added version line is required only because Homebrew's url version scanner is github.com-specific: a file:// url with the same basename scans 64 out of arm64. The real formula must never carry that line, which is why tasks 2.1 and 2.2 ran against the unmodified output."
      - "Commit the redirected copy inside $SCRATCH/tap, then run git -C \"$(brew --repository fcscratch/flowcharge)\" pull so the tap clone sees it."
      - "Run brew install fcscratch/flowcharge/flowcharge."
      - "Run the installed binary and confirm it is on PATH and runnable."
      - "Run brew test fcscratch/flowcharge/flowcharge and require it to pass. The test do block asserts only that the installed file is executable, per PLN-82-w5jut5 assumption 5."
      - "Change nothing in .github/scripts/bump-formula.mjs to make this step pass. The redirection lives in the throwaway copy alone."
    pattern: "The throwaway tap clone and the scratch tree only. No file in Praxis-Dashboard is edited by this task."
    imports: "brew, git."
    compatibility: "Homebrew 6.0.21. /opt/homebrew/Library/Homebrew/unpack_strategy/uncompressed.rb copies an uncompressed download under its basename, so the staging directory holds exactly one file named flowcharge-0.1.0-<label> and the Dir[\"flowcharge-*\"] glob in def install matches it on every platform."
    gotcha: "Only the arm64 url is exercised on this machine; the two other blocks are proved by brew style and brew audit in task 2.2, not by this install. Homebrew 6.0.0 and later demand explicit trust for a non-official tap, so the fully qualified fcscratch/flowcharge/flowcharge form is the one to use. The added version line is a fixture artefact and must never reach the generator's template."
    verify:
      - "brew install fcscratch/flowcharge/flowcharge; echo \"exit=$?\" — must report exit=0."
      - "which flowcharge — must print a path under the Homebrew prefix. Measured at base_commit: `which flowcharge` answers 'flowcharge not found', so the step discriminates."
      - "flowcharge; echo \"exit=$?\" — the installed fixture binary must run."
      - "brew test fcscratch/flowcharge/flowcharge; echo \"exit=$?\" — must report exit=0."
      - "git diff --name-only c133605 -- .github/scripts/bump-formula.mjs | wc -l — must return 0 against the state task 1.4 left, confirming the generator was not edited to make the install pass. The baseline is c133605, task 1's own commit, not 75d844a: the file is created by task 1, so a diff against 75d844a returns 1 for a correct run. Corrected during execution — see self_eval."
    checklist:
      - "Do the three urls in the redirected copy point at $SCRATCH/bins/ with the same basenames as the real ones?"
      - "Does the redirected copy carry exactly one added version line, and does the generator's template still carry none?"
      - "Did the tap clone get the redirected copy through a pull rather than an edit inside the clone?"
      - "Does brew install exit 0 and put a runnable flowcharge on PATH?"
      - "Does brew test exit 0?"
    self_eval:
      passed: true
      failures:
        - item: "Does the redirected copy carry exactly one added version line, and does the generator's template still carry none?"
          reason: "This task's own fifth verify step measured the generator against base_commit 75d844a, where the file does not yet exist. Task 1 creates it at commit c133605, so the step returned 1 for a run that edited nothing."
          fix: "Changed the verify step's baseline to c133605, the state task 1.4 left, which the step's own text already named as its intent. Confirmed 0 against c133605 and an empty git status --porcelain .github/scripts/."
    ```
  - [x] 2.4 Tear the throwaway tap down and confirm no trace
    ```yaml
    description: "Uninstall the formula, untap the throwaway tap, remove the scratch tree, and confirm the machine is back to the state measured at base_commit."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run brew uninstall flowcharge."
      - "Run brew untap fcscratch/flowcharge."
      - "Remove the scratch tree: rm -rf \"$SCRATCH\". Remove only that path, and only because this task created it."
      - "Confirm no other tap and no other installed formula was affected. Do not remove any other tap under /opt/homebrew/Library/Taps/, including akoukoullis/homebrew-versions."
    pattern: "Homebrew's own tap and cellar state, plus the scratch tree from task 2.1."
    imports: "brew, rm."
    compatibility: "Homebrew 6.0.21."
    gotcha: "brew untap on the wrong name removes somebody else's tap. Name fcscratch/flowcharge exactly. This task restores the base_commit machine state, so its checks pass trivially before stage 2 runs at all — they discriminate only against a stage 2 that ran and was not cleaned up."
    verify:
      - "brew tap | grep -c flowcharge — must return 0. Measured 0 at base_commit: this step restores the baseline, so it cannot fail before stage 2 runs; it fails only when tasks 2.2 or 2.3 have left the tap behind."
      - "which flowcharge — must answer 'flowcharge not found', matching the state measured at base_commit."
      - "ls /opt/homebrew/Library/Taps/ | wc -l — must return 17, the count measured at base_commit 75d844a."
      - "test -n \"$SCRATCH\" && test ! -d \"$SCRATCH\" && echo removed — must print removed. The -n guard is load-bearing: with $SCRATCH unset, `test ! -d \"\"` is true and the step prints removed even though nothing was ever created or removed. At base_commit 75d844a the guarded form prints nothing and exits 1, so the step discriminates."
    checklist:
      - "Is fcscratch/flowcharge untapped?"
      - "Is flowcharge no longer on PATH?"
      - "Is the tap count back to the 17 measured at base_commit, with akoukoullis/homebrew-versions untouched?"
      - "Is the scratch tree removed?"
      - "Was no tap other than fcscratch/flowcharge removed?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 3. Create the tap repository

  ```yaml
  description: "Scaffold /Users/akoukoullis/Work/AK/homebrew-flowcharge/ the way WS-90-1gmwvj scaffolded flowcharge-public: git init -b main, the two local config keys, a .gitignore and a README.md, then one commit staged by filename."
  ```

  - [x] 3.1 Initialise the repository and set its local git identity
    ```yaml
    description: "Create /Users/akoukoullis/Work/AK/homebrew-flowcharge/, run git init -b main, and set user.name and user.email with git config --local only, leaving the global config untouched."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Record the current global identity before doing anything: git config --global --get user.email and git config --global --get user.name. Measured at base_commit: akoukoullis@gmail.com and Anthony Koukoullis. These two values must be identical afterwards."
      - "Create the directory /Users/akoukoullis/Work/AK/homebrew-flowcharge/. It is a sibling of Praxis-Dashboard and flowcharge-public, and it does not exist at base_commit."
      - "Run git init -b main inside it."
      - "Set user.name to Anthony Koukoullis with git config --local."
      - "Set user.email to 324025743+FlowChargeDev@users.noreply.github.com with git config --local. This pair is byte-for-byte what /Users/akoukoullis/Work/AK/flowcharge-public's local config holds today."
      - "Never run git config --global for a value to write, and never read the global config for a value to copy in."
      - "Add no remote. Nothing is pushed and no GitHub repository is created by this workstream."
    pattern: "/Users/akoukoullis/Work/AK/homebrew-flowcharge/ — a new standalone repository. No file in Praxis-Dashboard or flowcharge-public is touched."
    imports: "git."
    compatibility: "The identity table in PLN-82-w5jut5 Design, 'Git identity contract for the tap repository'. The folder name must be homebrew-flowcharge, because Homebrew strips the homebrew- prefix and the tap is then <owner>/flowcharge."
    gotcha: "git init -b main needs git 2.28 or later; on an older git use git init followed by git symbolic-ref HEAD refs/heads/main. A machine-wide commit.gpgsign or a global template hook can change what the later commit looks like — check before committing in task 3.4. Writing anything under the home directory outside this one folder is out of scope."
    verify:
      - "git -C /Users/akoukoullis/Work/AK/homebrew-flowcharge rev-parse --abbrev-ref HEAD — must return main. At base_commit 75d844a the directory does not exist and the command fails with a 'no such file or directory' error, so the step discriminates."
      - "git -C /Users/akoukoullis/Work/AK/homebrew-flowcharge config --local --get user.name — must return exactly 'Anthony Koukoullis'."
      - "git -C /Users/akoukoullis/Work/AK/homebrew-flowcharge config --local --get user.email — must return exactly '324025743+FlowChargeDev@users.noreply.github.com'."
      - "git config --global --get user.email — must still return 'akoukoullis@gmail.com', the value measured at base_commit. This is a guard on the global config, so it cannot fail before the change."
      - "git -C /Users/akoukoullis/Work/AK/homebrew-flowcharge remote | wc -l — must return 0, confirming no remote was configured."
    checklist:
      - "Is the repository at /Users/akoukoullis/Work/AK/homebrew-flowcharge on branch main?"
      - "Were both identity keys set with git config --local and not --global?"
      - "Does the local user.email match flowcharge-public's byte-for-byte?"
      - "Is the global user.email still akoukoullis@gmail.com and the global user.name still Anthony Koukoullis?"
      - "Is no remote configured?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 3.2 Write the tap repository's `.gitignore`
    ```yaml
    description: "Add a one-line .gitignore holding .DS_Store, per the plan's layout for the tap repository."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create /Users/akoukoullis/Work/AK/homebrew-flowcharge/.gitignore holding exactly one line, .DS_Store, with a trailing newline."
      - "Add nothing else. The plan's 'Where each piece lives' block specifies one line and no more."
    pattern: "/Users/akoukoullis/Work/AK/homebrew-flowcharge/.gitignore — one new file."
    imports: "None."
    compatibility: "PLN-82-w5jut5 Design, 'Where each piece lives'."
    gotcha: "Do not ignore Formula/ or *.rb. The generated formula is the whole point of the repository and must be committable when the first real bump runs."
    verify:
      - "cat /Users/akoukoullis/Work/AK/homebrew-flowcharge/.gitignore — must print exactly '.DS_Store'. At base_commit 75d844a the directory does not exist, so the file cannot be read."
      - "wc -l < /Users/akoukoullis/Work/AK/homebrew-flowcharge/.gitignore — must return 1."
      - "grep -cE 'Formula|\\.rb' /Users/akoukoullis/Work/AK/homebrew-flowcharge/.gitignore — must return 0."
    checklist:
      - "Does the file hold exactly one line?"
      - "Is that line .DS_Store?"
      - "Does the file end with a newline?"
      - "Does it ignore neither Formula/ nor *.rb?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 3.3 Write the tap repository's `README.md`
    ```yaml
    description: "Add a short README stating the four things the plan requires: what the repository is, the fully qualified install command, that the formula is generated, and where Windows and Linux arm64 users get the binary."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create /Users/akoukoullis/Work/AK/homebrew-flowcharge/README.md. Keep it short."
      - "State that the repository is a personal Homebrew tap for FlowCharge."
      - "Give the install command in its fully qualified one-line form, brew install <owner>/flowcharge/flowcharge. Publish this form only. Homebrew 6.0.0 and later demand explicit trust for a non-official tap, and the qualified form grants that trust for this one formula. Do not document the two-step brew tap then brew install route: its exact trust requirement is unverified."
      - "State that Formula/flowcharge.rb is generated by .github/scripts/bump-formula.mjs in the private source repository, and that hand edits are overwritten by the next bump."
      - "State that Windows and Linux arm64 users take the binary from the Releases page instead, because Homebrew does not run natively on Windows and no Linux arm64 artefact is built."
      - "Name no FlowCharge version and no sha256 value anywhere in the file."
    pattern: "/Users/akoukoullis/Work/AK/homebrew-flowcharge/README.md — one new file."
    imports: "None."
    compatibility: "PLN-82-w5jut5 Design, 'The tap repository's README'. The install form matches the plan's Key flows, 'Install FlowCharge with Homebrew'."
    gotcha: "Naming a version here means every release makes the README stale, which is why the plan forbids it. flowcharge-public's own README.md download wording belongs to WS-90-1gmwvj and WS-92-t964y8 and must not be edited from here."
    verify:
      - "grep -c 'brew install' /Users/akoukoullis/Work/AK/homebrew-flowcharge/README.md — must return at least 1. At base_commit 75d844a the directory does not exist, so the file cannot be read."
      - "grep -c 'bump-formula.mjs' /Users/akoukoullis/Work/AK/homebrew-flowcharge/README.md — must return at least 1."
      - "grep -cE 'flowcharge-[0-9]+\\.[0-9]+\\.[0-9]+|v[0-9]+\\.[0-9]+\\.[0-9]+' /Users/akoukoullis/Work/AK/homebrew-flowcharge/README.md — must return 0, confirming no FlowCharge version is named."
      - "grep -cE '[0-9a-f]{64}' /Users/akoukoullis/Work/AK/homebrew-flowcharge/README.md — must return 0, confirming no sha256 is named."
      - "git -C /Users/akoukoullis/Work/AK/flowcharge-public status --porcelain | wc -l — must return 0, confirming flowcharge-public was not edited."
    checklist:
      - "Does the README say the repository is a personal Homebrew tap for FlowCharge?"
      - "Is the install command given only in its fully qualified one-line form?"
      - "Does it say Formula/flowcharge.rb is generated and that hand edits are overwritten?"
      - "Does it point Windows and Linux arm64 users at the Releases page?"
      - "Does it name no version and no sha256?"
      - "Is flowcharge-public unchanged?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 3.4 Make the tap repository's single commit
    ```yaml
    description: "Stage .gitignore and README.md by filename and make one commit under the Design identity, carrying no Co-Authored-By trailer."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Stage by filename: git -C /Users/akoukoullis/Work/AK/homebrew-flowcharge add .gitignore README.md. Do not use git add -A or git add ."
      - "Commit once with a short message describing the scaffold."
      - "End the message with no trailer. Commits made directly in homebrew-flowcharge carry no Co-Authored-By line, matching flowcharge-public's convention. The trailer applies only to commits in Praxis-Dashboard."
      - "Commit no Formula/flowcharge.rb. The tap's first commit holds README.md and .gitignore only — see the open question recorded in PLN-82-w5jut5, 'Open questions'."
      - "Push nothing and add no remote."
    pattern: "/Users/akoukoullis/Work/AK/homebrew-flowcharge/ — one commit. No file content changes in this task."
    imports: "git."
    compatibility: "PLN-82-w5jut5 acceptance criterion 1 and its 'Testing strategy', stage 3."
    gotcha: "A machine-wide commit template or a prepare-commit-msg hook can insert a trailer without being asked; check the committed message rather than the message written. git add -A would sweep in an untracked .DS_Store."
    verify:
      - "git -C /Users/akoukoullis/Work/AK/homebrew-flowcharge log --format='%an <%ae>' — must return exactly 'Anthony Koukoullis <324025743+FlowChargeDev@users.noreply.github.com>' on one line. At base_commit 75d844a the directory does not exist and the command fails, so the step discriminates."
      - "git -C /Users/akoukoullis/Work/AK/homebrew-flowcharge log --format=%B | grep -c 'Co-Authored-By' — must return 0."
      - "git -C /Users/akoukoullis/Work/AK/homebrew-flowcharge ls-files — must list exactly two paths, .gitignore and README.md; piped to wc -l it must return 2."
      - "git -C /Users/akoukoullis/Work/AK/homebrew-flowcharge log --all --oneline | wc -l — must return 1."
      - "git -C /Users/akoukoullis/Work/AK/homebrew-flowcharge status --porcelain | wc -l — must return 0, confirming a clean tree the generator's rung 3 will accept."
    checklist:
      - "Is there exactly one commit, on main?"
      - "Is its author Anthony Koukoullis <324025743+FlowChargeDev@users.noreply.github.com>?"
      - "Does its message carry no Co-Authored-By trailer?"
      - "Does git ls-files list exactly .gitignore and README.md?"
      - "Is the working tree clean and is no remote configured?"
    self_eval:
      passed: true
      failures: []
    ```

## Divergences

1. **`release/cli/` holds `.rsls` placeholders, not the plan's artefact names.** The plan's
   refusal rung 6 and its assumption 7 both read
   `release/cli/flowcharge-<version>-{darwin-arm64,darwin-x64,linux-x64}` as the bytes to
   hash. At base_commit `75d844a` that directory holds four zero-byte files whose names all
   carry a trailing `.rsls` suffix: `flowcharge-0.1.0-darwin-arm64.rsls`,
   `flowcharge-0.1.0-darwin-x64.rsls`, `flowcharge-0.1.0-linux-x64.rsls` and
   `flowcharge-0.1.0-win-x64.exe.rsls`. No file matches the plan's names, and every one is
   empty. The consequence is that no run of `bump-formula.mjs` against this repository can
   reach the write step today — it refuses at rung 6, which is the correct behaviour. Every
   task therefore verifies against a throwaway fixture built under `$TMPDIR`, never against
   the real `release/cli/`. No task was dropped and nothing in the plan's design is affected.

Every other file the plan cites matched what it assumed, at the lines it named:
`publish-release.mjs:83-84`, `publish-release.mjs:121-141`, `publish-release.mjs:275-286`,
`release.mjs:150`, `release.mjs:270-273`, `release-format.mjs`'s `isBareVersion` export,
`tools/package-cli.mjs:27-32`, `package.json:22`, `flowcharge-public/README.md:24`,
`/opt/homebrew/Library/Homebrew/utils/spdx.rb:14-18`,
`/opt/homebrew/Library/Homebrew/unpack_strategy/uncompressed.rb`, and
`/opt/homebrew/docs/How-to-Create-and-Maintain-a-Tap.md:66`. The tap folder is absent as the
plan states, `/opt/homebrew/Library/Taps/akoukoullis/` holds only `homebrew-versions`, and
`flowcharge-public`'s local identity is the exact pair the plan's Design table names.
