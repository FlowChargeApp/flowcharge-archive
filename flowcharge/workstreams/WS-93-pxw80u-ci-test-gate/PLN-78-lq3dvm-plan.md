---
id: PLN-78-lq3dvm
type: plan
workstream: WS-93-pxw80u
slug: ci-test-gate
title: "CI test gate on push and pull request"
status: done
created: 2026-09-04
updated: 2026-09-04
depends_on: []
links: []
---

# CI test gate on push and pull request

## Summary

This repo has 19 `node:test` files and no way to run them all with one command. It
also has no `.github/` directory and no CI at all. This plan adds two things. First,
one canonical `npm test` command that builds the project and then runs every test
file. Second, one `.github/workflows/ci.yml` file with a single `test` job that runs
that command on every push to `main` and every pull request to `main`.

The approach is to make `npm test` the only test entry point, and to make CI call it.
CI must never carry a test command of its own. If CI and a developer run different
commands, the two disagree, and the gate stops being trustworthy. The workflow follows
the shape of `/Users/akoukoullis/Work/AK/flowcharge-core-public/.github/workflows/ci.yml`,
which the sibling repo already proved against the same private Gitea host. Gitea
Actions reads GitHub Actions syntax, so one file serves both platforms.

## Scope

### Acceptance criteria

1. `npm test` in a clean checkout builds the project, runs all 19 test files, and exits 0.
2. `npm test` exits non-zero when any test fails, so CI fails with it.
3. `npm test` never reports a pass from a stale `dist/`, because the build always runs first.
4. `.github/workflows/ci.yml` exists and defines exactly one job, `test`.
5. The workflow triggers on push to `main` and on pull request to `main`, and on nothing else.
6. The `test` job checks out the repo, prints the Node version, installs from the lockfile, then runs `npm test`.
7. `package.json` gains only the test scripts and an `engines.node` of `>=20.14`; it gains no dependency of any kind.
8. No source file, no existing script, and no test file changes behaviour.

### Out of scope

- Any release, tag, publish, or asset-upload job. `WS-91-mecfuo` owns this repo's
  release process and will add its own CI-gated release job later, on top of this file.
- A push trigger on `v*.*.*` tags. The sibling repo has one because its workflow also
  releases. This one does not release, so the tag trigger belongs with `WS-91-mecfuo`.
- Branch protection. A workflow reports a status. Making that status block a merge is a
  Gitea repository setting, not a file in this repo. See Open questions.
- Writing new tests, changing existing tests, or adding a linter or a coverage job.

### Assumptions

- The default branch is `main`. `git branch -a` reports `origin/HEAD -> origin/main`.
- The runner ships Node 20.14 or newer. The test command uses `--test-force-exit`, which
  older Node releases do not understand. The `node --version` step puts the actual
  version in the log, so a wrong version is easy to see.
- The runner can reach `registry.npmjs.org` for `npm ci`, and can reach the download host
  for the `electron` devDependency's install script. If the electron download fails on
  the runner, `npm ci --ignore-scripts` is the fallback: it still installs the electron
  package's type declarations, which is all the build needs.
- There is no production data, there are no live users, and there is no migration. This
  is a repository configuration change. The app stays shippable at every point.

## Design

### How the suite runs today

This is the investigation the workstream asked for. These are facts read from the repo,
not inferences.

- `tsconfig.json` `include` lists `src/server.test.ts` and `src/lib/**/*.ts`. So
  `tsc -p tsconfig.json` compiles the tests into `dist/` beside the code they test.
  Tests run against compiled `dist/` output. They do not run against `.ts` sources, and
  no loader is involved.
- Every test file documents its own single-file command in its header comment. Example:
  `src/lib/detail.test.ts:13` says `node --test dist/lib/detail.test.js` after
  `npm run build`.
- `src/server.test.ts:5` is the one exception. It says
  `node --test --test-force-exit dist/server.test.js`. The flag is required. Importing
  the server binds a listening socket as a module side effect, and nothing exports a
  close handle, so the runner would never exit.
- `src/lib/fixture-project.ts:5` states that the shared fixture lives in its own module
  so that no test file imports another test file. That was done so a combined run does
  not report the same cases twice. A whole-suite run is therefore an intended mode.
- There is no `test` script, and `README.md` documents no test command. So no canonical
  whole-suite command exists yet. This workstream establishes it.
- The tests need no network. `src/lib/skill-content-fetch.test.ts:210` replaces
  `globalThis.fetch` and restores it afterwards.
- `package.json` has no `dependencies` key at all. Nothing new is needed to run the
  tests. `node:test` and `node:assert/strict` are built in.
- `package-lock.json` is present, so `npm ci` is valid. A `bun.lock` also exists, but
  every script in `package.json` is an npm script, so the workflow uses npm.

### The canonical command, verified

`npm run build` followed by
`node --test --test-force-exit "dist/**/*.test.js"` reports 157 passing tests
across all 19 files. This was run against this working copy and it passed.

The quotes are load-bearing. They pass the `**` pattern to Node's own glob engine. An
unquoted pattern is expanded by the shell instead, and `sh` does not recurse, so
`dist/server.test.js` is silently missed.

The directory form `node --test dist/` does not work. Node 24 treats it as a module path
and fails with `MODULE_NOT_FOUND`.

### Changed file: `package.json`

Two scripts are added to the existing `scripts` block, and the existing `engines.node`
value is raised. These three values are the contract:

- `"pretest": "npm run build"`
- `"test": "node --test --test-force-exit \"dist/**/*.test.js\""`
- `engines.node`, currently `">=18"`, becomes `">=20.14"`

npm runs `pretest` automatically before `test`. This copies the `prestart` and
`prerefresh` pattern already in this file, so the repo keeps one convention for
"build, then run". The build is `npm run build`, not `build:base` and not a bare `tsc`,
because that is what every test file's header already tells a developer to run, and
because it keeps the public and electron type-check gates in the test path.

The `engines.node` change belongs with these scripts and not in a later workstream. The
`test` script uses `--test-force-exit`, which Node 18 does not have. A declared floor of
`>=18` would promise a developer a Node version on which the one canonical command cannot
run. The floor and the requirement move together, in the same change, so they never
disagree.

Nothing else in `package.json` changes. No dependency is added.

### New file: `.github/workflows/ci.yml`

Required content, in prose. The task that writes it owns the literal YAML.

- Workflow name: `CI`.
- Triggers: `push` with `branches: [main]`, and `pull_request` with `branches: [main]`.
- One job with the id `test`, `runs-on: ubuntu-latest`.
- Steps, in this order:
  1. `actions/checkout@v4`.
  2. A step named for printing the Node version, running `node --version`. This is the
     sibling repo's pattern. A runner without Node, or with a Node too old for
     `--test-force-exit`, then fails here with a readable message instead of an obscure
     one inside the suite.
  3. A step that installs dependencies with `npm ci`.
  4. A step that runs `npm test`.
- The job carries no `if` condition. It always runs.
- `actions/checkout@v4` is the only action used. Every other step is a plain command.
  A self-hosted Gitea runner's access to an action registry is not guaranteed, so the
  workflow depends on as few actions as it can.
- The file carries a header comment that records why there is no `actions/setup-node`
  step, and that the release job of the sibling workflow is deliberately absent because
  `WS-91-mecfuo` owns it.

### What the workflow must not know

The workflow knows one thing: run this repo's test command. It must not know which test
files exist, which directory they compile into, or which flags the runner needs. All of
that lives in the `test` script in `package.json`. When the test layout changes, only
`package.json` changes, and CI keeps working untouched.

## Stages

1. **Canonical test command.** Add `pretest` and `test` to `package.json`, and raise
   `engines.node` from `>=18` to `>=20.14` in the same change, because this is the stage
   that creates the Node-version requirement. This stage is first because everything else
   rests on it, and because it is the only part that can be wrong in a way a reader would
   not notice. Observable at the end: `npm test` in a clean tree builds and reports 157
   passing tests, a deliberately broken assertion makes it exit non-zero, and
   `package.json` declares `engines.node` as `>=20.14`.
2. **CI workflow.** Add `.github/workflows/ci.yml` calling that command. Observable at the
   end: a push of a branch and a pull request to `main` each show a `test` job in the Gitea
   Actions view, and the job passes.

## Data & compatibility

- There is no data model, no schema, no migration, and no stored state.
- No existing consumer breaks. There is no `test` script today, so adding `pretest` cannot
  change the behaviour of an existing command.
- `dist/` is in `.gitignore`, so the build the test run triggers adds no tracked file.
- Rollback is complete and immediate at every point. Delete `.github/workflows/ci.yml` and
  remove the two scripts. Nothing else has to be undone.
- Stage 1 is useful on its own if stage 2 is dropped. Stage 2 is useless without stage 1.

## Testing strategy

The deliverable is configuration, so its verification is running it. No new unit tests are
written, and no existing test changes.

- Stage 1 is verified by running `npm test` in this working copy and confirming a 0 exit
  and 157 passing tests. It is verified for the failure path by breaking one assertion
  temporarily, confirming a non-zero exit, then restoring the file.
- Stage 1 is verified for freshness by deleting `dist/` and running `npm test` again. The
  run must rebuild and still pass.
- Stage 2 is verified on the server, not locally. Push a branch, open a pull request to
  `main`, and confirm the `test` job appears and passes. A local YAML parse check is not
  enough, because the question is whether the runner picks the file up at all.

## Open questions

1. **Question:** Is Gitea Actions enabled for this repository, and is a runner registered
   whose labels match `runs-on: ubuntu-latest`?
   **Recommendation:** Keep `ubuntu-latest`, because the sibling `flowcharge-core` repo
   already uses it against this same Gitea host. Confirm a runner picks the job up before
   treating the job as a real gate. A wrong answer here is not fixed by editing this repo;
   it needs a server-side setting.

2. **Question:** Should a failing `test` job block a merge into `main`, or only report a
   status next to the pull request?
   **Recommendation:** Leave it reporting only in this workstream, then turn on the
   required status check in the Gitea repository settings after the first green run. The
   setting lives on the server, so no file in this repo can deliver it.

## Adjacent opportunities

Not requested. Listed only so they can be promoted later if wanted.

1. Add an npm cache step to the workflow to cut install time. Skip; the suite runs in under
   a second and the install is not yet a problem.

## Alternatives considered and rejected

1. A `test` script that only runs the tests, with the build left to the caller. Rejected: a
   stale `dist/` then reports a green run for code that is not in it.
2. `pretest: npm run build:base`, skipping the esbuild bundle step. Rejected: every test
   file's header documents `npm run build`, and the saved step costs only seconds.
3. `pretest: tsc -p tsconfig.json` alone. Rejected: it skips the public and electron
   type-check gates, so CI would pass on code that `npm start` cannot build.
4. Running the tests straight from `.ts` sources with a loader or a test framework.
   Rejected: it adds a dependency to a repo that deliberately ships none, and it
   contradicts the `dist/` invocation every test file documents.
5. One workflow step per test file, or `node --test dist/`. Rejected: 19 steps drift out of
   date, and the directory form fails on Node 24 with `MODULE_NOT_FOUND`.

## Final summary

Make `npm test` the one canonical command, then have a single CI `test` job call it.

- 2 stages. Both are small. The whole workstream is well under a sitting.
- Top risks: no runner may be registered for `ubuntu-latest` on the Gitea host; the runner's
  Node may predate `--test-force-exit`; `npm ci` pulls the electron devDependency, which
  needs outbound network on the runner.
- Two open questions need an answer, and both are answered on the Gitea server, not in this
  repo: is Actions enabled with a matching runner, and should a failing job block a merge.
