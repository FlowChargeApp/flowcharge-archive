---
id: TL-91-9oa3oo
type: tasklist
workstream: WS-93-pxw80u
slug: ci-test-gate
title: "CI test gate on push and pull request"
status: done
created: 2026-09-04
updated: 2026-09-04
author: Anthony Koukoullis
depends_on: [PLN-78-lq3dvm]
links: []
mode: spec
base_commit: fcdd0da
---

# FlowCharge Tasks

## CI test gate on push and pull request

This list implements PLN-78-lq3dvm. The repository holds 19 `node:test` files and
no command that runs them all. It also holds no `.github` directory and no CI.

Two files change, in two stages. Stage 1 adds `pretest` and `test` to
`package.json` and raises `engines.node` from `>=18` to `>=20.14`, because the
test command uses `--test-force-exit`. Stage 2 adds `.github/workflows/ci.yml`
with one `test` job that calls `npm test` on every push to `main` and every pull
request to `main`.

The workflow knows one thing: run this repository's test command. It must not
know which test files exist, where they compile to, or which flags the runner
needs. That knowledge stays in the `test` script.

Out of scope, per the plan: any release, tag, publish, or asset-upload job
(WS-91-mecfuo owns those), branch protection (a Gitea server setting, not a file
here), new tests, changed tests, a linter, and a coverage job.

Every fact the plan asserts was re-read at `fcdd0da` and still held, so there are
no divergences. Measured at `fcdd0da`: 19 test files (`src/server.test.ts` plus
18 under `src/lib/`), no `.github` directory, no `test` script, `engines.node` of
`>=18`, no `dependencies` key, `package-lock.json` present, `dist/` ignored on
line 4 of `.gitignore`, default branch `main`, and `npm run build` followed by
`node --test --test-force-exit "dist/**/*.test.js"` reporting 157 passing tests
with exit code 0.

- [x] 1. Canonical test command

  ```yaml
  description: "Stage 1 of PLN-78-lq3dvm. Make `npm test` the one command that builds the project and runs every test file, and raise the declared Node floor to the version that command needs."
  ```

  - [x] 1.1 Add the test scripts and the Node floor to `package.json`
    ```yaml
    description: "Add `pretest` and `test` to the scripts block, and raise `engines.node` from >=18 to >=20.14 in the same change."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open `package.json` at the repository root. Two regions change and nothing else does."
      - "In the `engines` block, change the `node` value from the literal `>=18` to the literal `>=20.14`. The plan requires this in the same change as the scripts, because the `test` script uses `--test-force-exit`, which Node 18 does not have. A floor of `>=18` would promise a Node version on which the canonical command cannot run."
      - "In the `scripts` block, add two keys. Set `pretest` to the literal `npm run build`. Set `test` to the literal `node --test --test-force-exit \"dist/**/*.test.js\"`, with the inner double quotes escaped in JSON. npm runs `pretest` before `test` on its own, which copies the `prestart` and `prerefresh` pattern already in this file."
      - "Place the two new keys after the existing `refresh` key and before `electron:dev`, so the run-oriented scripts stay grouped. The position is a readability choice only; no verify step depends on it."
      - "The quotes around the glob are load-bearing. They hand the `**` pattern to Node's own glob engine. An unquoted pattern is expanded by the shell, `sh` does not recurse, and `dist/server.test.js` is then missed in silence."
      - "Change nothing else in the file. Add no `dependencies` key. Do not touch `build:base`, `build`, `build:release`, `prestart`, `start`, `start:lan`, `prerefresh`, `refresh`, any `package:*` script, `devDependencies`, or the `build` block."
    pattern: "`package.json` only. No file under `src/`, `electron/`, or `tools/` changes."
    imports: "None. `node:test` and `node:assert/strict` are built into Node, and PLN-78-lq3dvm requires that no dependency is added."
    compatibility: "The three values are the contract in PLN-78-lq3dvm, section `Changed file: package.json`. Task-local facts: `package.json` has no `dependencies` key at `fcdd0da`, and the file uses two-space JSON indentation."
    gotcha: "The plan rejects three near-misses. A `test` script without the build lets a stale `dist/` report a green run. `build:base` skips the esbuild bundle step that every test header documents. A bare `tsc -p tsconfig.json` skips the public and electron type-check gates. Use `npm run build` for `pretest`. Also: `node --test dist/` fails on Node 24 with MODULE_NOT_FOUND, so the glob form is required."
    verify:
      - |
        node -e "const p=JSON.parse(require('fs').readFileSync('package.json','utf8'));const want='node --test --test-force-exit \"dist/**/*.test.js\"';if(p.scripts.pretest!=='npm run build')throw new Error('pretest='+p.scripts.pretest);if(p.scripts.test!==want)throw new Error('test='+p.scripts.test);if(p.engines.node!=='>=20.14')throw new Error('engines.node='+p.engines.node);if('dependencies' in p)throw new Error('dependencies key present');console.log('package.json ok')"
      - "The step above must print `package.json ok`. At `fcdd0da` it throws `pretest=undefined`, because no `test` script and no `pretest` script exist there. This was run at `fcdd0da` and it failed as stated."
      - "Run `npm test`. It must exit 0 and its summary must report `ℹ tests 157`, `ℹ pass 157`, and `ℹ fail 0`. At `fcdd0da` this command fails with npm's `Missing script: test`, which was measured. The 157 count was measured from `npm run build` plus the raw test command at `fcdd0da`."
      - "Run `git diff --name-only`. It must print exactly one line, `package.json`. At `fcdd0da` it prints nothing, so this step does not pass until the edit lands."
    checklist:
      - "Does `scripts.pretest` hold exactly `npm run build`?"
      - "Does `scripts.test` hold exactly `node --test --test-force-exit \"dist/**/*.test.js\"`, glob quotes included?"
      - "Does `engines.node` hold exactly `>=20.14`?"
      - "Is `package.json` still free of any `dependencies` key?"
      - "Does `git diff --name-only` name `package.json` and no other file?"
      - "Does `npm test` exit 0 with 157 passing tests?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.2 Prove the gate fails on a failing test and never passes from a stale `dist/`
    ```yaml
    description: "Confirm acceptance criteria 2 and 3 of PLN-78-lq3dvm: `npm test` exits non-zero when a test fails, and it never reports a pass from a stale build."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "This task leaves no tracked file changed. It runs the two failure-path checks the plan's testing strategy names, then restores the tree. Run it only after task 1.1 is complete."
      - "Failure path, by the plan's own method. Open `src/lib/agentic-tools-content.test.ts`. In the test named `hashInstallContent is stable under skills array reordering`, on line 37 at `fcdd0da`, change the single call `assert.equal` to `assert.notEqual`. That flip is the whole break. The file is 66 lines, it is the smallest test file in the suite, and the change is one token, so the revert is trivial."
      - "Break a source `.test.ts` file, and never an injected file in `dist/`. Only the source break proves the whole path: the regression must survive `tsc`, land in `dist/`, and then be caught by `npm test`. A file dropped into `dist/` after the build never exercises that path."
      - "Run `npm test`. `pretest` rebuilds the source, so the flipped assertion reaches `dist/lib/agentic-tools-content.test.js` and fails there."
      - "Restore the file to its exact original content with `git checkout -- src/lib/agentic-tools-content.test.ts`. Do this as the last action of the failure path, before the freshness check. A left-over break makes every later run red."
      - "Freshness path. Delete the whole `dist/` directory, then run `npm test` again. `pretest` must rebuild it and the suite must pass."
      - "Add no script, no fixture, and no file that outlives this task."
    pattern: "`src/lib/agentic-tools-content.test.ts`, broken and then restored inside this task. No file is left changed."
    imports: "None. The flipped assertion uses the `node:assert/strict` import the file already has."
    compatibility: "Realises acceptance criteria 2 and 3 of PLN-78-lq3dvm, by the method its Testing strategy names. Task-local fact measured at `fcdd0da`: `assert.notEqual` type-checks in this file, so `npm run build` still exits 0 and the failure lands in the test run, not in the build."
    gotcha: "At `fcdd0da` a bare `npm test` already exits non-zero, because the script does not exist. So a non-zero exit alone proves nothing. Assert the reported counts, not only the exit code. Second: the restore is the step that is easy to forget. `git checkout -- src/lib/agentic-tools-content.test.ts` is the safe form, because it names one path and touches no other file. Third: flip the assertion, and do not delete a line, so `tsc` keeps compiling and the failure appears in the suite where the criterion needs it."
    verify:
      - "With the assertion flipped, run `npm test`. It must exit 1 and report `ℹ tests 157`, `ℹ pass 156`, and `ℹ fail 1`, and the failing case must be `hashInstallContent is stable under skills array reordering`. All three counts were measured at `fcdd0da` with this exact break, and `npm run build` still exited 0. At `fcdd0da` the command instead prints `Missing script: test`, so the counts are absent and the step fails."
      - "Run `git status --porcelain -- src/lib/agentic-tools-content.test.ts`. It must print nothing, which proves the file was restored to its exact original content. This was measured after `git checkout --` on that path at `fcdd0da`."
      - "Run `rm -rf dist && npm test`. It must exit 0 and report `ℹ tests 157`, `ℹ pass 157`, `ℹ fail 0`, which proves `pretest` rebuilt from source. Measured at `fcdd0da` with the raw build and test commands."
      - "Run `git status --porcelain -- package.json src electron tools`. It must print nothing, which proves no tracked file was left modified by the failure-path check."
    checklist:
      - "Did `npm test` report `ℹ fail 1` with 156 passing while the source assertion was flipped?"
      - "Was the break made in a source `.test.ts` file, so it had to pass through `tsc` into `dist/` to be caught?"
      - "Does `git status --porcelain -- src/lib/agentic-tools-content.test.ts` print nothing after the restore?"
      - "Did `npm test` pass with 157 tests after `dist/` was deleted entirely?"
      - "Does `git status --porcelain -- package.json src electron tools` print nothing?"
      - "Was no new script, fixture, or helper file added to the repository by this task?"
    self_eval:
      passed: true
      failures: []
      note: "Verify step 4 and checklist item 5 name `package.json` in the path list. The raw command prints ` M package.json`, because task 1.1 edits that file on purpose. The stated proposition still holds: the failure-path check left no tracked file modified. Re-run over `src electron tools` alone prints nothing."
    ```

- [x] 2. CI workflow

  ```yaml
  description: "Stage 2 of PLN-78-lq3dvm. Add one workflow file with a single `test` job that calls `npm test` on push to `main` and on pull request to `main`. The stage creates exactly one file, so it holds one child task."
  ```

  - [x] 2.1 Add `.github/workflows/ci.yml`
    ```yaml
    description: "Create the CI workflow: name `CI`, push and pull_request triggers on `main`, one `test` job on `ubuntu-latest`, four steps ending in `npm test`."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create the directory `.github/workflows/` and the file `.github/workflows/ci.yml`. Neither exists at `fcdd0da`; this is a new directory and a new file."
      - "Open the file with a comment header that records two decisions. First, there is no `actions/setup-node` step, because the runner is expected to supply Node 20.14 or newer and the `node --version` step puts the version it actually has into the log. Second, there is deliberately no release job and no tag trigger, because WS-91-mecfuo owns this repository's release process and adds its own CI-gated release job on top of this file."
      - "Set the workflow name to the literal `CI`."
      - "Give the workflow exactly two triggers: `push` with `branches: [main]`, and `pull_request` with `branches: [main]`. Write both branch lists in the inline `[main]` form, because the verify greps match that form. Add no other trigger and add no `tags:` key."
      - "Declare exactly one job, keyed `test`, with `runs-on: ubuntu-latest`. Give the job no `if:` key, so it always runs."
      - "Give the job exactly four steps, in this order: `uses: actions/checkout@v4`; a named step whose `run` is `node --version`; a named step whose `run` is `npm ci`; a named step whose `run` is `npm test`."
      - "Use `actions/checkout@v4` as the only `uses:` in the file. Every other step is a plain `run:` command. A self-hosted Gitea runner's access to an action registry is not guaranteed, so the workflow depends on as few actions as it can."
      - "Add nothing else. No cache step, no matrix, no second job, no release job, no artifact upload, no permissions block, and no test command of its own. The workflow calls `npm test` and knows nothing about which test files exist or where they compile to."
    pattern: "`.github/workflows/ci.yml` only. `package.json` is already correct after task 1.1 and must not change again."
    imports: "`actions/checkout@v4`, and nothing else. The job uses the runner's own `node` and `npm`."
    compatibility: "The required content is set by PLN-78-lq3dvm, section `New file: .github/workflows/ci.yml`, and its `Out of scope` list. Gitea Actions reads GitHub Actions syntax, so one file serves both platforms. Task-local fact: `package-lock.json` is present at `fcdd0da`, so `npm ci` is valid."
    gotcha: "Server-side pickup cannot be verified here. Whether a Gitea runner with a label matching `ubuntu-latest` actually claims the job is a server question, and the plan says so. Every verify step below is a local static check on the file's content. Second: a parse check must handle the bare `on:` key, which YAML 1.1 parsers such as pyyaml read as the boolean `True`, not the string `on`. Third: the exclusion grep must strip comment lines first, because the header comment names `release` and `setup-node` on purpose. Fourth: `npm ci` pulls the `electron` devDependency, whose install script needs outbound network on the runner; the plan's fallback is `npm ci --ignore-scripts`, which still installs the type declarations the build needs."
    verify:
      - "Run `test -f .github/workflows/ci.yml`. It must succeed. At `fcdd0da` there is no `.github` directory at all, so this fails, and it gates every step below."
      - "Run `grep -c '^name: CI$' .github/workflows/ci.yml`. It must print 1. Measured 1 against a draft of the specified file."
      - "Run `grep -cE '^[[:space:]]+branches: \\[main\\]$' .github/workflows/ci.yml`. It must print 2, one for `push` and one for `pull_request`. Measured 2."
      - "Run `grep -cE '^[[:space:]]+test:$' .github/workflows/ci.yml` and `grep -cE '^[[:space:]]+runs-on: ubuntu-latest$' .github/workflows/ci.yml`. Each must print 1, which shows one job named `test` on one runner. Measured 1 and 1."
      - "Run `grep -c 'uses:' .github/workflows/ci.yml` and `grep -c 'uses: actions/checkout@v4' .github/workflows/ci.yml`. Both must print 1, which shows `actions/checkout@v4` is the only action in the file. Measured 1 and 1."
      - "Run `grep -cE '^[[:space:]]+- (uses|name):' .github/workflows/ci.yml`. It must print 4, which is the step count. Measured 4."
      - "Run `grep -cE '^[[:space:]]+run: (node --version|npm ci|npm test)$' .github/workflows/ci.yml`. It must print 3, which shows the three plain commands and no fourth. Measured 3."
      - "Run `grep -vE '^[[:space:]]*#' .github/workflows/ci.yml | grep -ciE 'release|tags:|publish|setup-node|if:'`. It must print 0, which shows the plan's exclusions hold outside the header comment. Measured 0. This step prints 0 on a missing file too, so it only discriminates once the first step has passed."
      - "Optional parse confirmation, not a project dependency: if `python3 -c 'import yaml'` succeeds, load the file with `yaml.safe_load`, then assert `name` is `CI`, the trigger mapping holds exactly `push` and `pull_request` each with `branches == ['main']`, `list(jobs)` equals `['test']`, the job has `runs-on: ubuntu-latest` and no `if` key, and its four steps are `actions/checkout@v4` followed by three `run` steps holding `node --version`, `npm ci`, and `npm test`. Read the trigger mapping under the key `True` when the string key `on` is absent. This passed against a draft on the authoring machine with pyyaml 6.0.3. Skip it where python3 or pyyaml is absent; the greps above are the primary check."
      - "Run `npm test`. It must still exit 0 with 157 passing tests, which shows this stage changed nothing about the suite."
      - "Server-side pickup is not verifiable here, and the plan states this. Whether a runner claims the job is confirmed later by pushing a branch and opening a pull request to `main`, then reading the Gitea Actions view. Do not author or run a check that needs the Gitea server."
    checklist:
      - "Does `.github/workflows/ci.yml` exist, and does it define exactly one job, keyed `test`?"
      - "Does the workflow trigger on push to `main` and pull request to `main`, and on nothing else?"
      - "Do the job's four steps run checkout, `node --version`, `npm ci`, then `npm test`, in that order?"
      - "Is `actions/checkout@v4` the only `uses:` in the file, with every other step a plain `run:`?"
      - "Is the file free of any release job, tag trigger, publish step, `setup-node` step, and `if:` condition outside the header comment?"
      - "Does the header comment record why there is no `setup-node` step and why the release job is absent?"
      - "Did `package.json` stay unchanged by this task?"
    self_eval:
      passed: true
      failures: []
      note: "All eight grep verify steps printed their required counts: name 1, branches 2, test job 1, runs-on 1, uses 1, checkout 1, steps 4, run commands 3, exclusions 0. The optional pyyaml parse check also passed, read under the boolean `True` key because YAML 1.1 reads the bare `on:` key as a boolean. `npm test` exited 0 with 157 passing tests. `git status --porcelain -- package.json` printed nothing. Server-side runner pickup was not checked, as the task directs."
    ```
