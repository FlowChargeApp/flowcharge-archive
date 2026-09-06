---
id: TL-94-nray5k
type: tasklist
workstream: WS-91-mecfuo
slug: bun-binary-release-process
title: "Cut and publish versioned FlowCharge Board binary releases"
status: done
created: 2026-09-04
updated: 2026-09-04
author: Anthony Koukoullis
depends_on: [PLN-81-tkezsa]
links: []
mode: spec
base_commit: 149b127
---

# FlowCharge Tasks

## Cut and publish versioned FlowCharge Board binary releases

Two local commands under a new `.github/scripts/` folder in this repository cut a
FlowCharge Board release. `release.mjs` runs a ten-rung refusal ladder across both
repositories, triggers `npm run package:cli`, confirms the four Bun binaries landed in
`release/cli/`, and creates the annotated tag `vX.Y.Z` in the separate
`/Users/akoukoullis/Work/AK/flowcharge-public` repository. `publish-release.mjs` runs its
own refusal ladder and attaches those four binaries to a GitHub Release through
`gh release create`, with notes taken from `flowcharge-public`'s own `CHANGELOG.md`
section. A third file, `release-format.mjs`, is a pure shared module owning the two
textual shapes — the bare `X.Y.Z` version string and the `## X.Y.Z` release heading — so
the two commands agree by construction.

Both commands read the version from this repository's `package.json` `version` field and
take no version argument. Neither command pushes. `release.mjs` prints the two `git push`
commands and the publish command to run next.

Executing this list cuts no release. No GitHub repository is created, no remote is
configured, nothing is pushed, and no `gh` command runs for real. The only outward-facing
path is exercised through `--dry-run` and through throwaway fixture repositories under
`os.tmpdir()`. The real `flowcharge-public` repository is read but never written.

Three stages, smallest first, in the plan's order: the shared module and the test lane,
then the local release command, then the publish command.

- [x] 1. The shared module and the test lane

  ```yaml
  description: "Add the pure release-format module with unit coverage, widen the npm test pattern list to reach it, and correct the ci.yml header comment. First position because whether node --test reaches a file inside the leading-dot .github directory is the one unproven mechanism every later stage's verification rests on."
  ```

  - [x] 1.1 Add the pure shared format module `.github/scripts/release-format.mjs`
    ```yaml
    description: "Create the dependency-free ESM module exporting isBareVersion, newestVersion and sectionBody, with no CLI and no side effects at module scope."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create the new folder .github/scripts/ in this repository. Only .github/workflows/ci.yml exists under .github/ today, so the scripts/ directory is new."
      - "Create .github/scripts/release-format.mjs as dependency-free ESM. Open it with a header comment stating its module boundary in the form tools/package-cli.mjs and tools/bundle-public.mjs already use in this repository: it owns the release version string shape and the CHANGELOG.md release-heading shape, and it must not know git, either repository root, the artefact names, gh, or what its output is used for."
      - "Export isBareVersion(value) -> boolean. True only for three groups of digits separated by dots, with no leading 'v' and no pre-release or build suffix. Anchor the regex at both ends."
      - "Export newestVersion(changelogText) -> string | null. Return the version named by the first '## X.Y.Z' heading in the text, or null when the text names none. Use an unanchored multiline regex so the first match wins and an '## Unreleased' heading above the release heading is read past. flowcharge-public writes its headings as '## X.Y.Z - YYYY-MM-DD', so the regex must tolerate a trailing tail after the version."
      - "Export sectionBody(changelogText, version) -> string | null. Return the lines under the heading that names version, up to the next line beginning '## ' or the end of the text, with blank lines removed from both ends. Return null when no heading names the version, and the empty string when the heading exists but the section holds no text. The two outcomes must stay distinguishable because publish-release.mjs gives them different refusal messages."
      - "Make sectionBody able to read any release section, not only the newest one, and make it stop at the next '## ' line whichever heading that is — an '## Unreleased' heading closes the section above it exactly as a release heading does."
      - "Add no CLI, no main(), no argv read, no file read, no console output and no top-level statement with an effect. The module must be safe to import."
    pattern: "New file .github/scripts/release-format.mjs only. Touch no existing file in this task."
    imports: "None. The module must import nothing at all — not node:fs, not node:path, not node:child_process. It receives text and returns text."
    compatibility: "Plain ESM at this repository's Node floor, package.json engines.node >=20.14 (verified at 149b127). package.json already declares \"type\": \"module\", so a .mjs extension is consistent rather than required. Modelled on the boundary the plan PLN-81-tkezsa Design section fixes; the reference implementation at /Users/akoukoullis/Work/AK/flowcharge-core-public/.github/scripts/changelog-section.mjs is deliberately NOT copied, because it calls main() at module scope and importing it would run its CLI."
    gotcha: "flowcharge-public's real CHANGELOG.md at /Users/akoukoullis/Work/AK/flowcharge-public/CHANGELOG.md carries an explanatory paragraph that quotes the literal text '## X.Y.Z - YYYY-MM-DD' mid-line, inside backticks, at line 6. Those are the letters X, Y and Z, not digits, so a three-groups-of-digits regex does not in fact match that line today. Anchor the regex to the start of a line with the multiline flag anyway, because an unanchored one would read a real version quoted mid-line in prose. The same file's only current heading is '## Unreleased', which newestVersion must return null for."
    verify:
      - "node --input-type=module -e \"const m = await import('/Users/akoukoullis/Work/AK/Praxis-Dashboard/.github/scripts/release-format.mjs'); const a = await import('node:assert/strict'); a.default.equal(m.isBareVersion('0.1.0'), true); a.default.equal(m.isBareVersion('v0.1.0'), false); a.default.equal(m.newestVersion('## Unreleased\\n\\n## 0.1.0 - 2026-09-04\\n'), '0.1.0'); a.default.equal(m.sectionBody('## 0.1.0 - 2026-09-04\\n\\nbody\\n\\n## Older\\n', '0.1.0'), 'body'); console.log('ok');\" — at 149b127 this exits non-zero with ERR_MODULE_NOT_FOUND because the file does not exist; it must print ok and exit 0 once the task lands."
      - "grep -cE \"node:fs|node:path|node:child_process|process\\\\.argv|console\\\\.\" /Users/akoukoullis/Work/AK/Praxis-Dashboard/.github/scripts/release-format.mjs — must return 0. This is the purity check: no import, no argv read, no output. At 149b127 grep exits 2 with 'No such file or directory'."
    checklist:
      - "The file exports exactly isBareVersion, newestVersion and sectionBody, and no fourth export."
      - "The module imports nothing and produces no output when imported."
      - "isBareVersion rejects 'v0.1.0', '0.2', '0.2.0-rc.1' and the empty string, and accepts '0.1.0'."
      - "newestVersion reads past an '## Unreleased' heading and tolerates a ' - YYYY-MM-DD' tail."
      - "sectionBody returns null for an unnamed version and the empty string for an empty section, and the two are distinguishable by the caller."
      - "The header comment states the module boundary and names what the module must not know."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.2 Add unit coverage `.github/scripts/release-format.test.mjs`
    ```yaml
    description: "Cover all three exports against fixture strings, never against files, using node:test."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create .github/scripts/release-format.test.mjs importing { test } from 'node:test', assert from 'node:assert/strict', and the three exports from './release-format.mjs'."
      - "Cover isBareVersion: accepts '0.1.0'; rejects 'v0.1.0', '0.2', '0.2.0-rc.1' and the empty string."
      - "Cover newestVersion: reads past an '## Unreleased' heading to the release heading below it; tolerates the ' - YYYY-MM-DD' tail flowcharge-public uses; returns null for text holding no release heading."
      - "Cover sectionBody: returns the body of a release section that is not the newest one; stops at the next '## ' line whichever heading it is, including an '## Unreleased' heading; trims blank lines at both ends; returns the empty string for a heading with no text; returns null for a version no heading names."
      - "Use fixture strings declared inline in the test file. Read no file and create no temporary directory in this task — the module under test takes text, so no filesystem is involved."
      - "Give at least one test name the literal substring 'release-format' so task 1.3's discovery check has something to grep for in the npm test output."
    pattern: "New file .github/scripts/release-format.test.mjs only."
    imports: "node:test, node:assert/strict, and ./release-format.mjs from task 1.1."
    compatibility: "node:test as the existing suite uses it — see src/lib/projects.test.ts, which imports { test } from 'node:test' and assert from 'node:assert/strict'. No test framework is added; the repository has no vitest, jest or mocha dependency at 149b127."
    gotcha: "This test file is .mjs and lives outside src/, so tsc never compiles it and it never lands in dist/. It is run directly from its source location, which is exactly the discovery question task 1.3 settles."
    verify:
      - "node --test /Users/akoukoullis/Work/AK/Praxis-Dashboard/.github/scripts/release-format.test.mjs — at 149b127 this exits 1 with 'Could not find' because the file does not exist; it must report fail 0 once the task lands."
      - "node --test /Users/akoukoullis/Work/AK/Praxis-Dashboard/.github/scripts/release-format.test.mjs 2>&1 | grep -E '(tests|pass|fail) [0-9]+' — the pass count must be at least 3 and the fail count exactly 0. Three is the floor of one test per export; the thirteen behaviours the plan's testing strategy enumerates are asserted by the checklist below rather than by a fixed count."
    checklist:
      - "Every isBareVersion case the plan names is asserted: 0.1.0, v0.1.0, 0.2, 0.2.0-rc.1, empty string."
      - "Every newestVersion case the plan names is asserted: reading past Unreleased, the date tail, and the null case."
      - "Every sectionBody case the plan names is asserted: a non-newest section, stopping at the next ## line, both-end trimming, the empty-string case and the null case."
      - "No test reads a file from disk or creates a temporary directory."
      - "At least one test name contains the literal substring 'release-format'."
      - "The suite reports fail 0."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.3 Widen the `npm test` pattern list in `package.json` to reach `.github/scripts/`
    ```yaml
    description: "Add a second pattern to the canonical test command so the new .mjs test files are discovered, keeping one test command and needing no edit to ci.yml's test job."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Option A, preferred and measured to work. Add a second glob pattern to the test script. The pattern .github/scripts/**/*.test.mjs was run against a fixture at authoring time on Node v24.12.0 and did reach the file inside the leading-dot directory, alongside the existing dist pattern. Apply this block:"
      - |
        /Users/akoukoullis/Work/AK/Praxis-Dashboard/package.json
        <<<<<<< SEARCH
            "test": "node --test --test-force-exit \"dist/**/*.test.js\"",
        =======
            "test": "node --test --test-force-exit \"dist/**/*.test.js\" \".github/scripts/**/*.test.mjs\"",
        >>>>>>> REPLACE
      - "Option B, the fallback the plan names, to be adopted only if Option A's verify shows the new tests are not discovered on the Node version actually in use. Replace the second glob with the three new test files named by explicit relative path in the same command, keeping one canonical test command either way."
      - "Change nothing else in package.json. Do not touch the pretest script, the engines floor, the build.publish block, or any other script."
    pattern: "/Users/akoukoullis/Work/AK/Praxis-Dashboard/package.json, the scripts.test line only."
    imports: "None."
    compatibility: "The change must stay additive: the existing dist/**/*.test.js pattern keeps working and every existing test keeps running. pretest is npm run build, so npm test still builds first. The test job in .github/workflows/ci.yml runs npm test and must need no edit."
    gotcha: "The glob was measured on Node v24.12.0, not at this repository's declared floor of >=20.14 (package.json engines at 149b127). Node 20 may exclude leading-dot directories from a glob. If a Node 20 runner is available, confirm there; otherwise Option A's verify below is the gate and Option B is the fallback. Also note the JSON escaping: the inner quotes in the test script are backslash-escaped in the file, and both patterns need that escaping."
    verify:
      - "node -e \"const s=require('fs').readFileSync('/Users/akoukoullis/Work/AK/Praxis-Dashboard/package.json','utf8'); process.exit(JSON.parse(s).scripts.test.includes('.github/scripts') ? 0 : 1)\" — at 149b127 this exits 1, because grep -c '\\.github/scripts' package.json returns 0 there."
      - "cd /Users/akoukoullis/Work/AK/Praxis-Dashboard && npm test 2>&1 | grep -c 'release-format' — at 149b127 this returns 0 and exits 1. It must return at least 1 once the task lands, which is what settles the glob-versus-explicit-path question."
      - "cd /Users/akoukoullis/Work/AK/Praxis-Dashboard && npm test 2>&1 | grep -E '(tests|pass|fail) [0-9]+' — at 149b127 this reported tests 161, pass 161, fail 0. The count must now be strictly greater than 161 and fail must stay 0, proving the change is additive and broke nothing."
    checklist:
      - "The test script still runs every existing dist/**/*.test.js file."
      - "The npm test total is strictly greater than the 161 measured at 149b127."
      - "npm test reports fail 0."
      - "No job or step in .github/workflows/ci.yml was edited to make this work."
      - "Only the scripts.test line of package.json changed."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.4 Correct the forward-reference comment in `.github/workflows/ci.yml`
    ```yaml
    description: "Replace the header comment's promise of a CI-gated release job with the decision actually taken — two local commands under .github/scripts/ — and its reason. No job or step changes."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "The header comment today promises that WS-91-mecfuo 'adds its own CI-gated release job on top of this file'. This plan declines that, so the comment is corrected to state the decision taken and why. Apply this block:"
      - |
        /Users/akoukoullis/Work/AK/Praxis-Dashboard/.github/workflows/ci.yml
        <<<<<<< SEARCH
        # There is deliberately no release job and no tag trigger. WS-91-mecfuo owns
        # this repository's release process, and it adds its own CI-gated release job
        # on top of this file.
        =======
        # There is deliberately no release job and no tag trigger. WS-91-mecfuo owns
        # this repository's release process, and it is two local commands under
        # .github/scripts/ rather than a CI job here. The release tag lives in the
        # separate flowcharge-public repository, so a tag trigger in this file would
        # never fire, and publishing from here into that repository would need a
        # cross-repository token held as a secret here — a real credential surface
        # bought for no gain over one local command.
        >>>>>>> REPLACE
      - "Change nothing below the header comment. The name, on and jobs blocks stay byte-for-byte as they are."
    pattern: "/Users/akoukoullis/Work/AK/Praxis-Dashboard/.github/workflows/ci.yml, the header comment only."
    imports: "None."
    compatibility: "Gitea Actions reads this file as GitHub Actions syntax, as the file's own opening comment records. A comment-only edit is safe on both."
    gotcha: "This is the only edit this whole task list makes to ci.yml. The plan's Out of scope section forbids any release job, any tag trigger and any other change to this file."
    verify:
      - "grep -c 'adds its own CI-gated release job' /Users/akoukoullis/Work/AK/Praxis-Dashboard/.github/workflows/ci.yml — at 149b127 this returns 1. It must return 0 once the task lands."
      - "sed -n '/^jobs:/,$p' /Users/akoukoullis/Work/AK/Praxis-Dashboard/.github/workflows/ci.yml | shasum | cut -c1-40 — must equal d4f7c528103945fecfbdc497b0ad2c00f0086e80, the value measured at 149b127. This step cannot fail at 149b127 by design: it is the invariant that the jobs block is byte-for-byte unchanged, so it passes before the edit and must still pass after it."
      - "git -C /Users/akoukoullis/Work/AK/Praxis-Dashboard diff --numstat -- .github/workflows/ci.yml — the changed-line counts must account for the header comment only."
    checklist:
      - "The phrase 'adds its own CI-gated release job' no longer appears in the file."
      - "The replacement comment states both the decision and its reason."
      - "The jobs block hash still matches d4f7c528103945fecfbdc497b0ad2c00f0086e80."
      - "No job, step, trigger or workflow name was added, removed or renamed."
      - "No release job and no tag trigger were added."
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. The local release command

  ```yaml
  description: "Add .github/scripts/release.mjs with its full ten-rung refusal ladder, two-repository resolution, build trigger, artefact verification and annotated tag, plus fixture-repository coverage of every refusal and one hand-run of the build-and-tag path. Second position because the refusal ordering and the two-repository path resolution are where a mistake is expensive, and because the publish command depends on the tag this one creates."
  ```

  - [x] 2.1 Add `.github/scripts/release.mjs` with its refusal ladder, build, verify, tag and report steps
    ```yaml
    description: "Create the local release command: no positional arguments, version read from this repository's package.json, ten refusal rungs in a fixed order, then build, artefact verification, annotated tag in flowcharge-public, and a report of the next commands."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create .github/scripts/release.mjs. Open it with a HELP constant that is both the file's usage documentation and the text --help prints, so the interface is recorded once. Follow the shape of /Users/akoukoullis/Work/AK/flowcharge-core-public/.github/scripts/release.mjs, which is the model, adapting it rather than copying it."
      - "Derive the source repository root from the script's own file location as path.resolve(<its own directory>, '..', '..'), never from process.cwd(), so the command behaves the same run from any subdirectory and a copy placed inside a test fixture acts on that fixture."
      - "Accept no positional arguments. Support exactly two flags: --help, and --public-repo=<path>. Default the public repository to path.resolve(<source root>, '..', 'flowcharge-public')."
      - "Answer --help first, before option parsing that could fail, before any file read and before any git call, printing HELP on stdout and exiting 0. This is plan acceptance criterion 1."
      - "Run the refusal ladder in exactly this order, each rung printing one message that names the problem and the value it found, then exiting 1: (1) source package.json is readable and its version field passes isBareVersion; (2) the source repository's current branch is main; (3) the source tracked working tree is clean, with git status --porcelain --untracked-files=no so untracked files are ignored; (4) the --public-repo path exists and holds a git repository; (5) the public repository's current branch is main; (6) the public tracked working tree is clean, untracked files ignored; (7) the public CHANGELOG.md exists, holds a '## X.Y.Z' heading, and newestVersion of it equals the source package.json version; (8) the tag vX.Y.Z does not already exist in the public repository; (9) bun resolves on PATH; (10) gh resolves on PATH."
      - "Give rungs 7's three failure modes their own distinct messages: no CHANGELOG.md, no release heading at all, and a newest heading that disagrees with the version. The model's release.mjs separates these the same way."
      - "Probe bun and gh with spawnSync(<tool>, ['--version']) and treat both a spawn error and a non-zero exit as 'not usable here', exactly as tools/package-cli.mjs:94-101 already probes bun. Rung 10 belongs in this command even though this command never calls gh, so the maintainer is not stranded with a tag and no way to publish it."
      - "After the ladder, build: spawn 'npm run package:cli' as a child process with stdio 'inherit' and cwd set to the source root. A spawn error or a non-zero exit fails the run with a named message, and nothing is tagged."
      - "Then verify: list release/cli/ in the source repository and count the entries whose name begins 'flowcharge-<version>-'. Refuse unless there are exactly four and every one is non-empty. Know the filename prefix and the count four; know no Bun target string and no platform label — that table stays solely in tools/package-cli.mjs."
      - "Then tag: run git -C <public> tag -a vX.Y.Z -m \"FlowCharge vX.Y.Z (Praxis-Dashboard <short sha of source HEAD>)\". The source repository is not tagged; its HEAD is recorded in the message instead."
      - "Then report and exit 0: print the tag, the public repository path, the four artefact paths, and the three commands to run next — git -C <public> push origin main, git -C <public> push origin vX.Y.Z, and node .github/scripts/publish-release.mjs."
      - "Push nothing, and write nothing outside release/cli/ before the tag. The tag is the last write, which is what preserves the all-or-nothing property."
      - "Import isBareVersion and newestVersion from ./release-format.mjs. Do not restate the changelog heading regex or the version regex in this file."
    pattern: "New file .github/scripts/release.mjs only."
    imports: "node:fs, node:path, node:child_process (spawnSync), and { isBareVersion, newestVersion } from ./release-format.mjs."
    compatibility: "Dependency-free beyond node built-ins and the sibling module. Calls npm run package:cli through its existing CLI contract only — tools/package-cli.mjs is owned by WS-89-t2g5to and must not be edited. Releases are cut on macOS or Linux: npm is spawned without a shell, which does not resolve npm on Windows, and the plan accepts that rather than working around it."
    gotcha: "Module boundary, per the plan's Design section: this script knows git, both repository roots, package.json's version field, the npm run package:cli contract, the artefact filename prefix and count, and the tag shape. It must NOT know the changelog heading regex, the gh CLI, the GitHub repository slug, or any Bun target string. Separately: release/cli/ at 149b127 already holds four flowcharge-0.1.0-* artefacts left from an earlier build, so the verify step passes there for the wrong reason during development — a stale directory holding artefacts of an older version is the case the version-qualified prefix is designed to ignore."
    verify:
      - "node /Users/akoukoullis/Work/AK/Praxis-Dashboard/.github/scripts/release.mjs --help; echo \"exit=$?\" — at 149b127 this exits 1 with 'Cannot find module'. It must print the usage text on stdout and report exit=0 once the task lands. This is plan acceptance criterion 1."
      - "grep -c 'release-format.mjs' /Users/akoukoullis/Work/AK/Praxis-Dashboard/.github/scripts/release.mjs — must return at least 1, proving the changelog shape is imported rather than restated. At 149b127 grep exits 2 with 'No such file or directory'."
      - "grep -cE 'bun-darwin|bun-linux|bun-windows|release create' /Users/akoukoullis/Work/AK/Praxis-Dashboard/.github/scripts/release.mjs — must return 0. This is the boundary check: no Bun target string and no gh release contract in this file."
    checklist:
      - "--help exits 0 and prints on stdout before any option parsing, file read or git call."
      - "The ten rungs run in the plan's exact order and each prints one named message and exits 1."
      - "The build is spawned only after every rung passes, so a bad state fails in seconds rather than after a multi-minute compile."
      - "The artefact check requires exactly four non-empty entries matching the version-qualified prefix."
      - "The annotated tag is created in the public repository only, and its message records the source repository's short HEAD SHA."
      - "The script pushes nothing and prints the two git push commands and the publish command on success."
      - "No Bun target string, no gh release contract, and no changelog heading regex appear in this file."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.2 Add the fixture harness and `--help` coverage in `.github/scripts/release.test.mjs`
    ```yaml
    description: "Create the test file with a throwaway-git-repository fixture builder and the --help cases, which must pass with no readable package.json and with no git repository present."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create .github/scripts/release.test.mjs using node:test and node:assert/strict."
      - "Write a fixture builder that makes a throwaway pair of git repositories under os.tmpdir() with fs.mkdtempSync, following the temporary-directory pattern src/lib/projects.test.ts:41-59 already establishes in this repository, and removes them with fs.rmSync({ recursive: true, force: true }) in a finally block."
      - "The source fixture must hold a .github/scripts/ folder into which release.mjs and release-format.mjs are copied, so the script's self-location root resolution points at the fixture and at nothing else. Give the source fixture its own package.json whose version field each case sets to reach the rung under test, and its own git repository on branch main."
      - "The public fixture is a second throwaway git repository on branch main with its own CHANGELOG.md, created as a sibling directory so the default --public-repo resolution can also be exercised."
      - "Drive release.mjs as a child process with execFileSync or spawnSync on process.execPath, capturing stdout, stderr and the exit status, so each case asserts on the real command rather than on an imported function."
      - "Cover --help: exit 0 and usage text on stdout, asserted twice — once against a fixture with no readable package.json, and once against a fixture directory holding no git repository at all. This proves --help precedes both the file read and the git call."
      - "Set the fixture git identity locally (git -C <fixture> config user.email / user.name) so the fixture commits succeed on a machine with no global git identity."
      - "Never point any test at /Users/akoukoullis/Work/AK/flowcharge-public. Every fixture lives under os.tmpdir()."
    pattern: "New file .github/scripts/release.test.mjs only. Tasks 2.3 and 2.4 add further cases to this same file."
    imports: "node:test, node:assert/strict, node:fs, node:os, node:path, node:child_process."
    compatibility: "node:test as the existing suite uses it. The file is .mjs and is discovered by the pattern task 1.3 added, so it needs no tsc compilation and lands in no dist/ folder."
    gotcha: "Copying release.mjs into the fixture is what makes the self-location root resolution testable — running the real file with a cwd of the fixture would still resolve the root to this repository. Copy release-format.mjs alongside it, or the import will not resolve. Fixture git repositories need an initial commit before git status and branch queries behave, and a fresh git init may default to a branch name other than main, so set it explicitly."
    verify:
      - "node --test /Users/akoukoullis/Work/AK/Praxis-Dashboard/.github/scripts/release.test.mjs — at 149b127 this exits 1 with 'Could not find' because the file does not exist. It must report fail 0 once the task lands."
      - "node --test /Users/akoukoullis/Work/AK/Praxis-Dashboard/.github/scripts/release.test.mjs 2>&1 | grep -cE 'help' — must return at least 2, one per --help case."
      - "ls /var/folders /tmp 2>/dev/null >/dev/null; git -C /Users/akoukoullis/Work/AK/flowcharge-public status --porcelain — must print nothing, and git -C /Users/akoukoullis/Work/AK/flowcharge-public tag must print nothing, proving no test touched the real public repository. Both were measured empty at 149b127, so this step is an invariant that cannot fail there; it discriminates only against a test that wrongly targets the real repository."
    checklist:
      - "Every fixture is created under os.tmpdir() and removed in a finally block."
      - "release.mjs and release-format.mjs are copied into the fixture's own .github/scripts/ folder."
      - "--help is asserted to exit 0 with usage on stdout, with no readable package.json and with no git repository present."
      - "No test path references /Users/akoukoullis/Work/AK/flowcharge-public."
      - "Fixture repositories set a local git identity and an explicit main branch."
      - "The suite reports fail 0."
    self_eval:
      passed: true
      failures:
        - item: "Every fixture is created under os.tmpdir() and removed in a finally block."
          reason: "The first fixture builder took the missing-version case as `{ version: undefined }`, but a destructuring default treats an explicit undefined as absent, so that fixture silently got the default 0.1.0, passed all ten rungs and reached `npm run package:cli`. The build failed at once on the fixture's missing package:cli script, so nothing was compiled, but the case proved nothing about rung 1."
          fix: "Added a separate `hasVersion` flag to makeFixture and drove the rung 1 cases from option objects instead of a bare version value. Re-ran: 21 pass, 0 fail, whole file under 5 seconds."
    ```

  - [x] 2.3 Add one refusal case per ladder rung to `.github/scripts/release.test.mjs`
    ```yaml
    description: "Cover all ten rungs of release.mjs's refusal ladder against fixture repositories, each asserting exit 1, the named message, and that no tag exists afterwards."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Extend .github/scripts/release.test.mjs with one case per rung, reusing the fixture builder from task 2.2. Each case sets up the fixture's own package.json version field to reach the rung under test."
      - "Cover rung 1 with four fixtures whose version field is missing, is 'v0.1.0', is '0.2', and is '0.2.0-rc.1'."
      - "Cover rung 2 with a source fixture checked out on a branch other than main; rung 3 with a modified tracked file in the source fixture."
      - "Cover rung 4 with a --public-repo path that does not exist, and with one that exists but holds no git repository; rung 5 with a public fixture on a branch other than main; rung 6 with a modified tracked file in the public fixture."
      - "Cover rung 7 three ways: no CHANGELOG.md in the public fixture; a CHANGELOG.md holding no '## X.Y.Z' heading at all, such as one holding only '## Unreleased'; and a CHANGELOG.md whose newest release heading names a different version from the fixture's package.json."
      - "Cover rung 8 with the tag vX.Y.Z already created in the public fixture."
      - "Cover rungs 9 and 10 by running the child process with a PATH from which bun, then gh, is absent — for example a PATH pointing at a throwaway bin directory holding only the other tools each rung needs to get that far."
      - "Assert three things in every case: the exit status is 1, stderr names the specific problem for that rung, and git -C <public fixture> tag prints nothing afterwards."
      - "Assert additionally in every case that release/cli/ inside the source fixture holds no new artefact, proving nothing was built. Every rung is reachable without a build, which is what makes this coverage fast."
    pattern: "/Users/akoukoullis/Work/AK/Praxis-Dashboard/.github/scripts/release.test.mjs, adding cases to the file task 2.2 created."
    imports: "The same node built-ins as task 2.2. No new dependency."
    compatibility: "Every case must run in seconds. No case may reach the build, so no case may pass all ten rungs. This is the property the plan relies on to keep the coverage fast."
    gotcha: "Rungs 9 and 10 need a controlled PATH. Overriding PATH for the child process also hides node, npm and git from it, so the throwaway bin directory must hold symlinks to the tools that rung still needs. Rung 9 must find git but not bun; rung 10 must find git and bun but not gh, which means a machine without bun installed cannot exercise rung 10 — record that as a skipped case rather than a silent pass if bun is absent."
    verify:
      - "node --test /Users/akoukoullis/Work/AK/Praxis-Dashboard/.github/scripts/release.test.mjs 2>&1 | grep -E '(tests|pass|fail) [0-9]+' — the pass count must be at least 10, one per rung, and fail must be 0. At 149b127 the command exits 1 with 'Could not find' and prints no such lines."
      - "node --test /Users/akoukoullis/Work/AK/Praxis-Dashboard/.github/scripts/release.test.mjs 2>&1 | grep -c 'not ok' — must return 0."
      - "git -C /Users/akoukoullis/Work/AK/flowcharge-public tag; git -C /Users/akoukoullis/Work/AK/flowcharge-public rev-list --count HEAD — must print nothing and then 1, the values measured at 149b127. This is plan acceptance criterion 8 for this task; it is an invariant that passes before the change and must still pass after it."
    checklist:
      - "All ten rungs have at least one case, and rung 1 has four and rung 7 has three."
      - "Every case asserts exit 1, a rung-specific message on stderr, and no tag afterwards."
      - "Every case asserts that nothing was built."
      - "No case reaches npm run package:cli, so the whole file runs in seconds."
      - "Any rung that cannot be exercised on this machine is explicitly skipped, never silently passed."
      - "The suite reports fail 0."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.4 Add ladder-ordering coverage to `.github/scripts/release.test.mjs`
    ```yaml
    description: "Pin the refusal order by asserting that a fixture wrong on two rungs at once reports the earlier one."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Extend .github/scripts/release.test.mjs with ordering cases, reusing the same fixture builder."
      - "Build a fixture that is wrong on two rungs at once and assert the message names the earlier rung, not the later. Cover at least: a bad version field together with a wrong source branch (1 before 2); a dirty source tree together with a missing public repository (3 before 4); a changelog mismatch together with an existing tag (7 before 8)."
      - "Assert on the specific message text of the earlier rung, so a reordering of the ladder makes the test fail loudly rather than silently."
      - "This pins the ladder table in the plan's Design section rather than leaving the order incidental."
    pattern: "/Users/akoukoullis/Work/AK/Praxis-Dashboard/.github/scripts/release.test.mjs, adding cases to the file tasks 2.2 and 2.3 built."
    imports: "The same node built-ins. No new dependency."
    compatibility: "Same fixture method and same speed constraint as task 2.3 — no ordering case may reach the build either."
    gotcha: "An ordering assertion that only checks 'exit 1' proves nothing, because both rungs exit 1. Each case must assert the earlier rung's own message text and, where the messages could be confused, assert the later rung's message is absent."
    verify:
      - "node --test /Users/akoukoullis/Work/AK/Praxis-Dashboard/.github/scripts/release.test.mjs 2>&1 | grep -E '(tests|pass|fail) [0-9]+' — the pass count must now be at least 13, three more than task 2.3's floor of 10, and fail must be 0."
      - "node --test /Users/akoukoullis/Work/AK/Praxis-Dashboard/.github/scripts/release.test.mjs 2>&1 | grep -ciE 'order' — must return at least 3, one per ordering case, assuming the case names carry the word."
    checklist:
      - "At least three ordering cases exist, covering the 1-before-2, 3-before-4 and 7-before-8 pairs."
      - "Each case asserts the earlier rung's own message text, not merely exit 1."
      - "Each case asserts the later rung's message does not appear."
      - "No ordering case reaches the build."
      - "The suite reports fail 0."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.5 Hand-run the build-and-tag happy path against a throwaway clone
    ```yaml
    description: "Verify plan acceptance criteria 3 and 4 once by hand, because a four-target Bun compile is too slow to unit-test, and prove nothing was pushed and the real public repository is untouched."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Clone the real public repository to a throwaway path under the session scratchpad: git clone /Users/akoukoullis/Work/AK/flowcharge-public <scratch>/flowcharge-public-clone. Work only in the clone. Never write inside /Users/akoukoullis/Work/AK/flowcharge-public."
      - "In the clone only, edit CHANGELOG.md to turn '## Unreleased' into '## 0.1.0 - <today>' with a short body under it, and commit that edit in the clone. This mirrors the maintainer's own real-release edit, which the plan places out of scope for the real repository."
      - "Set the clone's branch to main and confirm its tracked tree is clean."
      - "Run node .github/scripts/release.mjs --public-repo=<scratch>/flowcharge-public-clone from this repository. Expect the ladder to pass, npm run package:cli to run, four artefacts to be confirmed, and the annotated tag v0.1.0 to be created in the clone."
      - "Read the printed report and confirm it names the tag, the clone path, the four artefact paths, and the three next commands."
      - "Run none of the printed commands. Do not push, do not add a remote, and do not run gh."
      - "Record the outcome in this task's self_eval, since this is the one verification limit the plan states rather than works around."
      - "Delete the clone last, and only after this task's first verify step has run against it. That step reads the clone's tag and the tag message, so deleting the clone earlier destroys the evidence the verify steps need."
    pattern: "No file is created or edited by this task in this repository. It exercises .github/scripts/release.mjs end to end."
    imports: "bun and git on PATH, and gh on PATH for rung 10 to pass. npm run package:cli downloads a Bun runtime per target on first use."
    compatibility: "The run must be on macOS or Linux, because npm is spawned without a shell. The four artefacts land in release/cli/, which .gitignore already covers via its release/ entry, so no artefact becomes a tracked file. Commit trailers, per plan PLN-81-tkezsa Assumption 9: a commit made in this repository (Praxis-Dashboard) must end with the trailer 'Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>'. The CHANGELOG.md commit this task makes is made inside the clone of flowcharge-public, which is a different repository, so that clone commit carries no such trailer."
    gotcha: "The compile produces four binaries of roughly 64 MB to 100 MB and takes minutes. release/cli/ at 149b127 already holds four flowcharge-0.1.0-* files from an earlier build, so delete or move them first — otherwise the artefact check passes on stale files and the run proves nothing about the build. The clone gets no origin remote pointing anywhere public: a clone of a local path gets an origin pointing at that local path, so do not run any push."
    verify:
      - "ls <scratch>/flowcharge-public-clone && git -C <scratch>/flowcharge-public-clone tag — must list v0.1.0, and git -C <scratch>/flowcharge-public-clone cat-file -p v0.1.0 must show an annotated tag whose message records this repository's short HEAD SHA. This is plan acceptance criterion 3."
      - "find /Users/akoukoullis/Work/AK/Praxis-Dashboard/release/cli -maxdepth 1 -name 'flowcharge-0.1.0-*' -type f -size +0 -newer /Users/akoukoullis/Work/AK/Praxis-Dashboard/.github/scripts/release.mjs | wc -l — must return exactly 4. Each of the four artefacts must exist, be non-empty, and carry an mtime newer than the release.mjs that built it, which proves the four files are the ones this hand-run produced. At 149b127 this step cannot pass: .github/scripts/release.mjs does not exist there, so find exits non-zero, and the four stale flowcharge-0.1.0-* files left from an earlier build cannot satisfy it."
      - "git -C /Users/akoukoullis/Work/AK/flowcharge-public tag; git -C /Users/akoukoullis/Work/AK/flowcharge-public rev-list --count HEAD; git -C /Users/akoukoullis/Work/AK/flowcharge-public status --porcelain; git -C /Users/akoukoullis/Work/AK/flowcharge-public remote -v — must print nothing, then 1, then nothing, then nothing: the values measured at 149b127. This is plan acceptance criterion 8, and it is an invariant that passes before the run and must still pass after it."
    checklist:
      - "Stale release/cli/ artefacts were removed before the run, so the four confirmed artefacts are the ones this run built."
      - "The annotated tag exists in the clone and its message records this repository's short HEAD SHA."
      - "The report names the tag, the clone path, the four artefact paths and the three next commands."
      - "Nothing was pushed, no remote was added, and gh was never called."
      - "The real /Users/akoukoullis/Work/AK/flowcharge-public still has one commit, no tag, no remote and a clean tree."
      - "The clone was deleted after the run."
    self_eval:
      passed: true
      failures:
        - item: "The report names the tag, the clone path, the four artefact paths and the three next commands."
          reason: "The hand-run as written cannot be launched from this working copy at this point in the workstream. Rung 2 requires the source repository to be on main, and this task list is executed on feature/bun-binary-release-process, whose merge to main happens after the list returns. The literal command `node .github/scripts/release.mjs --public-repo=<clone>` therefore refused at rung 2 with `this repository's current branch is \"feature/bun-binary-release-process\", not main`, which is correct behaviour but exercises no build and no tag."
          fix: "Ran the same command from a throwaway clone of this repository under the session scratchpad, checked out on a branch named main at the identical commit 1dec946, with node_modules symlinked and the two untracked .github/scripts files copied in. The ladder passed, `npm run package:cli` compiled all four Bun targets, the four artefacts were confirmed, and the annotated tag v0.1.0 was created in the flowcharge-public clone with the message \"FlowCharge v0.1.0 (Praxis-Dashboard 1dec946)\" — the live repository's own short HEAD SHA. Both clones were deleted after the verify steps ran. The one consequence: this task's second verify step counts artefacts under the live /Users/akoukoullis/Work/AK/Praxis-Dashboard/release/cli, and the four artefacts landed in the source clone's release/cli instead, so that count is 4 in the clone and 0 in the live repository. Re-run this hand-run from main after the merge to satisfy that step in its literal form."
        - item: "Stale release/cli/ artefacts were removed before the run."
          reason: "release/cli held four flowcharge-0.1.0-* files from an earlier build, which would have let the artefact check pass on stale files."
          fix: "Moved them to <scratchpad>/stale-release-cli/ before the run, so the live release/cli is now empty. They are regenerable build output and .gitignore already covers release/."
    ```

- [x] 3. The publish command

  ```yaml
  description: "Add .github/scripts/publish-release.mjs with its seven-rung refusal ladder, slug resolution, notes extraction and --dry-run, plus fixture coverage of every refusal and of the full argument vector. Last position because it is the only outward-facing surface and it consumes both earlier stages' output."
  ```

  - [x] 3.1 Add `.github/scripts/publish-release.mjs`
    ```yaml
    description: "Create the outward-facing publish command: seven refusal rungs, a repository slug derived from the public repository's origin remote, notes from sectionBody, and either a printed argument vector under --dry-run or a real gh spawn."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create .github/scripts/publish-release.mjs with the same HELP-constant convention and the same self-location root resolution as release.mjs: path.resolve(<its own directory>, '..', '..'), never process.cwd()."
      - "Accept no positional arguments. Support exactly four flags: --help, --public-repo=<path>, --repo=<owner>/<name>, and --dry-run. Answer --help first, before any option parsing, file read or git call."
      - "Read the version from this repository's package.json version field, the same source release.mjs reads."
      - "Run this refusal ladder, all of it before any outward call, each rung printing one named message and exiting 1: (1) package.json is readable and its version field passes isBareVersion; (2) the --public-repo path exists and holds a git repository; (3) a repository slug is resolvable — --repo when given, otherwise derived from the public repository's origin remote URL, and with neither, refuse naming 'git remote add origin' as the fix; (4) the tag vX.Y.Z exists in the public repository and git ls-remote --tags origin reports it on the remote, refusing otherwise and naming the push command; (5) sectionBody of the public CHANGELOG.md for this version is neither null nor empty; (6) exactly four non-empty release/cli/flowcharge-<version>-* artefacts exist in the source repository; (7) gh resolves on PATH."
      - "Give rung 5's two failure modes distinct messages, since sectionBody deliberately distinguishes null from the empty string."
      - "Support both SSH and HTTPS origin URL forms when deriving <owner>/<name>, and strip a trailing .git. Never write a slug into the file: the eventual move from a personal account to an organisation must be a remote change with no code change."
      - "Build the argument vector gh release create vX.Y.Z --repo <slug> --title \"FlowCharge vX.Y.Z\" --notes <body> <four asset paths>, with the asset paths in a stable order."
      - "Pass the notes as a single --notes argument rather than through a temporary file. No shell is involved, so backticks, quotes and newlines in the changelog body need no escaping and nothing needs cleaning up."
      - "Under --dry-run, print the exact argument vector and exit 0 without calling gh. Otherwise spawn gh with the vector, without a shell, and propagate its exit status."
      - "Import isBareVersion and sectionBody from ./release-format.mjs. Do not restate the changelog heading regex in this file."
    pattern: "New file .github/scripts/publish-release.mjs only."
    imports: "node:fs, node:path, node:child_process (spawnSync), and { isBareVersion, sectionBody } from ./release-format.mjs."
    compatibility: "gh must be on PATH for a real run, but never for --dry-run. The four assets are attached under the names tools/package-cli.mjs already gives them, with no archiving and no renaming. The Windows artefact carries a .exe suffix that Bun appends, so the four names are not uniform — match on the version-qualified prefix, not on an exact name list."
    gotcha: "Module boundary, per the plan's Design section: this script knows gh's CLI contract, both repository roots, package.json's version field, the artefact prefix and count, and how to read an origin URL. It must NOT know the changelog heading regex or the Bun build. Separately: /Users/akoukoullis/Work/AK/flowcharge-public has no origin remote at 149b127, so rung 3's success path and rung 4's remote check can only be exercised against a fixture remote — the plan states this limit rather than working around it."
    verify:
      - "node /Users/akoukoullis/Work/AK/Praxis-Dashboard/.github/scripts/publish-release.mjs --help; echo \"exit=$?\" — at 149b127 this exits 1 with 'Cannot find module'. It must print the usage text on stdout and report exit=0 once the task lands."
      - "node /Users/akoukoullis/Work/AK/Praxis-Dashboard/.github/scripts/publish-release.mjs --dry-run 2>&1; echo \"exit=$?\" — run against the real /Users/akoukoullis/Work/AK/flowcharge-public, which has no origin remote and no tag at 149b127, this must refuse at rung 3 or rung 4 with a named message and exit 1. It must never call gh."
      - "grep -c 'release-format.mjs' /Users/akoukoullis/Work/AK/Praxis-Dashboard/.github/scripts/publish-release.mjs — must return at least 1; and grep -cE 'bun-darwin|bun-linux|bun-windows|package:cli' on the same file must return 0, proving the Bun build is outside this file's boundary."
    checklist:
      - "--help exits 0 and prints on stdout before any option parsing, file read or git call."
      - "All seven rungs run in the plan's order and each prints one named message and exits 1."
      - "The slug is derived from origin, or taken from --repo, and never hard-coded."
      - "The notes are passed as a single --notes argument, with no temporary file and no shell."
      - "--dry-run prints the vector and exits 0 without calling gh."
      - "No Bun target string, no package:cli call and no changelog heading regex appear in this file."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.2 Add one refusal case per rung in `.github/scripts/publish-release.test.mjs`
    ```yaml
    description: "Cover all seven rungs of publish-release.mjs's refusal ladder against throwaway fixture repositories with a fake origin remote."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create .github/scripts/publish-release.test.mjs with the same fixture method as release.test.mjs: throwaway repositories under os.tmpdir(), publish-release.mjs and release-format.mjs copied into the fixture's own .github/scripts/ folder, cleanup in a finally block."
      - "Give the public fixture a fake origin — a second local bare repository the fixture can push a tag to — so rung 3's success path and rung 4's git ls-remote check are exercisable. This is the fixture remote the plan says stands in for the absent real one."
      - "Cover rung 1 with fixtures whose version field is missing, is 'v0.1.0', is '0.2' and is '0.2.0-rc.1'."
      - "Cover rung 2 with a --public-repo path that does not exist and one holding no git repository."
      - "Cover rung 3 with a public fixture that has no origin remote and no --repo flag, asserting the message names git remote add origin as the fix."
      - "Cover rung 4 twice: the tag absent locally, and the tag present locally but absent from the fake origin, asserting the second names the push command."
      - "Cover rung 5 twice: a version no heading names, and a heading whose section holds no text — the two must produce different messages."
      - "Cover rung 6 with fewer than four artefacts, with more than four, and with four where one is zero-length."
      - "Cover rung 7 with a PATH from which gh is absent."
      - "Assert in every case that the exit status is 1, that stderr names the rung-specific problem, and that gh was never invoked."
      - "Never point any test at /Users/akoukoullis/Work/AK/flowcharge-public and never let any test reach a real gh release create."
    pattern: "New file .github/scripts/publish-release.test.mjs only. Task 3.3 adds further cases to this same file."
    imports: "node:test, node:assert/strict, node:fs, node:os, node:path, node:child_process."
    compatibility: "Discovered by the pattern task 1.3 added to the npm test script. No test framework is added."
    gotcha: "Proving gh was never invoked needs a positive mechanism, not an absence: put a stub gh on the child process PATH that writes a marker file when run, then assert the marker file does not exist. A test that merely asserts exit 1 does not prove gh stayed uncalled. The same PATH-override caveat as task 2.3 applies — node and git must stay reachable."
    verify:
      - "node --test /Users/akoukoullis/Work/AK/Praxis-Dashboard/.github/scripts/publish-release.test.mjs 2>&1 | grep -E '(tests|pass|fail) [0-9]+' — the pass count must be at least 7, one per rung, and fail must be 0. At 149b127 the command exits 1 with 'Could not find' and prints no such lines."
      - "node --test /Users/akoukoullis/Work/AK/Praxis-Dashboard/.github/scripts/publish-release.test.mjs 2>&1 | grep -c 'not ok' — must return 0."
      - "git -C /Users/akoukoullis/Work/AK/flowcharge-public tag; git -C /Users/akoukoullis/Work/AK/flowcharge-public remote -v — must both print nothing, the values measured at 149b127. This is an invariant that passes before the change; it discriminates only against a test that wrongly targets the real repository."
    checklist:
      - "All seven rungs have at least one case, and rungs 4, 5 and 6 have their distinct sub-cases."
      - "A fake origin bare repository exists so rung 4's remote check is exercisable."
      - "Every case asserts exit 1 and a rung-specific message."
      - "A stub gh with a marker file proves gh was never invoked."
      - "No test path references /Users/akoukoullis/Work/AK/flowcharge-public."
      - "The suite reports fail 0."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.3 Add `--dry-run` argument-vector coverage to `.github/scripts/publish-release.test.mjs`
    ```yaml
    description: "Assert the complete gh release create argument vector --dry-run prints: tag, slug, title, notes body and exactly four asset paths in a stable order."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Extend .github/scripts/publish-release.test.mjs with a fixture that passes all seven rungs: a valid package.json version, a public fixture on main with a fake origin, the tag created locally and pushed to that fake origin, a CHANGELOG.md holding a non-empty section for the version, and exactly four non-empty artefacts in the source fixture's release/cli/."
      - "Run publish-release.mjs --dry-run against that fixture and assert the printed vector element by element: the tag taken from the fixture package.json version field; the slug derived from the fixture origin; the title 'FlowCharge vX.Y.Z'; the notes body matching sectionBody's own output for that version; and exactly four asset paths."
      - "Assert the four asset paths appear in a stable order, so the vector is reproducible across runs."
      - "Assert the exit status is 0 and that gh was never invoked, using the stub-gh marker file from task 3.2."
      - "Add a second case passing --repo=<owner>/<name> explicitly and assert it overrides the origin-derived slug."
      - "This is plan acceptance criterion 5 and the only verification the publish path receives: no gh release create is ever run for real by this workstream."
    pattern: "/Users/akoukoullis/Work/AK/Praxis-Dashboard/.github/scripts/publish-release.test.mjs, adding cases to the file task 3.2 created."
    imports: "The same node built-ins as task 3.2, plus sectionBody from ./release-format.mjs so the expected notes body is computed independently of publish-release.mjs's own reading."
    compatibility: "The fixture's four artefacts can be zero-content stand-ins of any small non-zero size — no Bun compile is needed here, because the rung only checks the prefix, the count and that each file is non-empty."
    gotcha: "The Windows artefact name carries a .exe suffix while the other three do not, so a fixture that creates four uniformly named files does not represent the real set. Create the fixture artefacts with the real shape: flowcharge-<version>-darwin-arm64, -darwin-x64, -linux-x64, and -win-x64.exe. Asserting the notes body by recomputing it with sectionBody is only meaningful if the expected value is derived from the fixture text, not copied from the script's output."
    verify:
      - "node --test /Users/akoukoullis/Work/AK/Praxis-Dashboard/.github/scripts/publish-release.test.mjs 2>&1 | grep -E '(tests|pass|fail) [0-9]+' — the pass count must now be at least 9, two more than task 3.2's floor of 7, and fail must be 0."
      - "node --test /Users/akoukoullis/Work/AK/Praxis-Dashboard/.github/scripts/publish-release.test.mjs 2>&1 | grep -ciE 'dry.run' — must return at least 2, one per --dry-run case, assuming the case names carry the phrase."
    checklist:
      - "The --dry-run case exits 0 and prints the full vector: tag, --repo slug, --title, --notes and four asset paths."
      - "The four asset paths carry the real names, including the .exe suffix on the Windows one."
      - "The asset order is asserted and is stable across runs."
      - "The expected notes body is derived from the fixture changelog text, not copied from the script's own output."
      - "A --repo case proves the flag overrides the origin-derived slug."
      - "The stub-gh marker file proves gh was never invoked."
    self_eval:
      passed: true
      failures:
        - item: "The --dry-run case exits 0 and prints the full vector: tag, --repo slug, --title, --notes and four asset paths."
          reason: "The first run of the element-by-element assertion failed on the four asset paths alone. os.tmpdir() on macOS answers /var/folders/..., which is a symlink to /private/var/folders/..., and the script resolves its own root from its own already-resolved module URL. The expected paths were built from the mkdtemp path, so every one of the four differed by that prefix while the tag, slug, title and notes all matched."
          fix: "Built the expected asset paths from fs.realpathSync(fixture.source) instead of fixture.source, with a comment recording why. Re-ran: 17 pass, 0 fail, whole file under 4 seconds."
    ```

  - [x] 3.4 Run the whole-plan acceptance sweep
    ```yaml
    description: "Confirm npm test discovers and runs both new .github/scripts test files alongside every existing dist test, that ci.yml's jobs are unchanged, and that nothing outward-facing happened."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run the project's canonical test command once, whole, and confirm it is green."
      - "Confirm the new test files are discovered by the pattern task 1.3 adopted, not run separately — this is plan acceptance criterion 7."
      - "Confirm no job or step in .github/workflows/ci.yml changed, so the existing test job picks the new files up with no edit."
      - "Confirm plan acceptance criterion 8 in full: no GitHub repository was created, no remote was configured, nothing was pushed, no gh command ran for real, and flowcharge-public's tracked files and commit history are unchanged."
      - "Confirm the plan's exclusions held: tools/package-cli.mjs is unchanged, the four artefact names are unchanged, no release job or tag trigger was added to ci.yml, the build.publish block in package.json is unchanged, no README in either repository changed, and flowcharge/ is still untracked in this repository."
      - "Create no file in this task. It is a verification pass only."
    pattern: "No file is created or edited. This task verifies the state the previous nine produced."
    imports: "None."
    compatibility: "npm test runs pretest, which is npm run build, so this pass also proves the TypeScript build is still clean."
    gotcha: "flowcharge/ is deliberately untracked in this repository and must not be staged. A git status check for criterion 8 will list flowcharge/ as untracked; that is the expected state, not a failure."
    verify:
      - "cd /Users/akoukoullis/Work/AK/Praxis-Dashboard && npm test 2>&1 | grep -E '(tests|pass|fail) [0-9]+' — at 149b127 this reported tests 161, pass 161, fail 0. The total must now be strictly greater than 161 and fail must be 0. This is plan acceptance criterion 7."
      - "cd /Users/akoukoullis/Work/AK/Praxis-Dashboard && npm test 2>&1 | grep -cE 'release-format|dry.run' — at 149b127 this returns 0. It must return at least 3 once the three new test files are discovered by the single npm test command."
      - "sed -n '/^jobs:/,$p' /Users/akoukoullis/Work/AK/Praxis-Dashboard/.github/workflows/ci.yml | shasum | cut -c1-40 — must still equal d4f7c528103945fecfbdc497b0ad2c00f0086e80, measured at 149b127."
      - "git -C /Users/akoukoullis/Work/AK/Praxis-Dashboard status --porcelain -- tools/package-cli.mjs; git -C /Users/akoukoullis/Work/AK/flowcharge-public status --porcelain; git -C /Users/akoukoullis/Work/AK/flowcharge-public rev-list --count HEAD; git -C /Users/akoukoullis/Work/AK/flowcharge-public tag; git -C /Users/akoukoullis/Work/AK/flowcharge-public remote -v — must print nothing, nothing, 1, nothing, nothing: the values measured at 149b127. This is plan acceptance criterion 8, an invariant that passes before the change and must still pass after it."
      - "git -C /Users/akoukoullis/Work/AK/Praxis-Dashboard diff --name-only 149b127 -- package.json .github/workflows/ci.yml tools/ — must list package.json and .github/workflows/ci.yml only, and must not list any file under tools/."
    checklist:
      - "npm test is green and its total is strictly greater than the 161 measured at 149b127."
      - "The three new .github/scripts test files are discovered by the single npm test command."
      - "The ci.yml jobs block hash is unchanged and no release job or tag trigger was added."
      - "tools/package-cli.mjs, the four artefact names and the build.publish block are unchanged."
      - "flowcharge-public still has one commit, no tag, no remote and a clean tree, and no gh command ran for real."
      - "flowcharge/ is still untracked in this repository and was not staged."
    self_eval:
      passed: true
      failures: []
    ```
