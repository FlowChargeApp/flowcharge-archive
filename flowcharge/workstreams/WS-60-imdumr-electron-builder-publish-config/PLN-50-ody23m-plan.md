---
id: PLN-50-ody23m
type: plan
workstream: WS-60-imdumr
slug: electron-builder-publish-config
title: "Add a dormant GitHub Releases publish block to the electron-builder config"
status: done
created: 2026-08-22
updated: 2026-08-22
depends_on: []
links: []
---

# Add a dormant GitHub Releases publish block

## Summary

`package.json` gets one new key: `build.publish`. It declares the `github` provider with an
obviously-fake placeholder `owner`/`repo`, plus the two behaviour keys this workstream's
investigation already decided (`releaseType: "draft"`, `publishAutoUpdate: true`).

The block is dormant. It starts no upload, needs no token, and changes no script. Its one
observable effect today is that `electron-builder` writes the update-manifest files
(`latest-mac.yml`, `latest-linux.yml`, `latest.yml`, and an embedded `app-update.yml`) into
the existing local `release/` output. Those files are the artefact a future auto-update
mechanism needs, and generating them now is the whole point of the workstream.

No runtime code changes. No dependency is added. No publish runs.

This plan implements nothing.

## Scope

### Acceptance criteria

1. `package.json` contains a `build.publish` object with `provider: "github"`, an
   obviously-fake `owner`, an obviously-fake `repo`, `releaseType: "draft"`, and
   `publishAutoUpdate: true`.
2. No `token` key, and no credential of any kind, appears anywhere in `package.json`.
   `grep -iE '"token"|gh_token|github_token|ghp_' package.json` returns nothing.
3. `package.json` is still valid JSON. `node -e 'JSON.parse(require("fs").readFileSync("package.json","utf8"))'`
   exits 0.
4. `electron-builder` accepts the config. No `Invalid configuration object` error appears
   when a `package:*` script runs. This proves no unknown key was introduced.
5. `npm run package:mac` runs with no flag, exits 0, needs no `GH_TOKEN`, makes no upload,
   and creates no GitHub release and no git tag. Its log contains no publishing step.
6. `release/` still holds the same installers as before: the `dmg` and `zip` pairs for
   `x64` and `arm64`.
7. `release/latest-mac.yml` exists after `npm run package:mac`.
8. `Praxis Board.app/Contents/Resources/app-update.yml` exists inside the packaged mac app.
9. `release/latest-linux.yml` exists after `npm run package:linux`, covering both the `deb`
   and the `AppImage` target.
10. `release/latest.yml` exists after `npm run package:win`.
11. The `scripts` block of `package.json` is byte-identical to its current content. No
    command line changes and no script is added.
12. `dependencies` stays absent and `devDependencies` is unchanged. `electron-updater` is
    not present.
13. `git diff --name-only` lists exactly one file: `package.json`. Nothing under `electron/`
    or `src/` is touched.
14. `npm run build`, `npm start` and `npm run electron:dev` behave exactly as before.

Criteria 9 and 10 are verified on the next run of those scripts on a host that can build
those targets. See Open question 3.

### Out of scope

- Creating the public GitHub distribution repository. That is a separate manual action in
  the Praxis-Business pre-launch checklist, outside this codebase.
- Replacing the placeholder `owner`/`repo` with real values.
- Adding `electron-updater` or any other dependency.
- Running a real publish, or adding any script or CI workflow that runs one.
- Changing `releaseType` to `release` or `prerelease`.
- Code signing, notarization, `hardenedRuntime`, `entitlements`, and `win.signtoolOptions`.
  The README already records these as prerequisites of first distribution.
- Anything in WS-58's or WS-59's scope. This plan does not read, edit, or depend on their
  files.
- Any edit to `README.md`. See Open question 2.
- Any change to `src/`, `electron/`, `tools/`, or the build scripts.

### Assumptions

- **A1 — The placeholder is a literal, unmistakable stand-in.** This plan proposes
  `owner: "REPLACE-ME-github-owner"` and `repo: "REPLACE-ME-repo-name"`. Any string that
  could be mistaken for a real account is wrong. The exact wording is Open question 1,
  because this plan is forbidden to read WS-59's files to copy its style.
- **A2 — The dormant block is safe today, and gets safer.** `PublishManager` only
  constructs a publisher when `isPublish` is true. `isPublish` comes from the `--publish`
  CLI flag or from one of three implicit triggers, never from the presence of a `publish`
  config block. None of the three applies here. The v26 source also warns that every
  implicit trigger is removed in v27, so the residual path narrows over time.
- **A3 — No release or deployment constraint applies.** The app is private, closed-source,
  unsigned, installed by hand on the author's own machines. There are no live users, no
  release train, and no rollout to stage. The change is one commit and the app stays
  shippable at every point.
- **A4 — The extra `release/` files are wanted, not noise.** `release/` is a build output
  folder. Three small YAML files joining the installers there is the intended result, not
  a regression.
- **A5 — Explicit defaults are the only documentation channel available.** `package.json`
  is strict JSON and cannot carry a comment. This drives the design decision below.

## Design

### The change

Add `publish` as the last key of the existing `build` object in `package.json`, after the
`win` block:

```json
    "publish": {
      "provider": "github",
      "owner": "REPLACE-ME-github-owner",
      "repo": "REPLACE-ME-repo-name",
      "releaseType": "draft",
      "publishAutoUpdate": true
    }
```

That is the whole change. Placement last keeps the three platform target blocks
contiguous and keeps the diff to one contiguous addition.

### Why the two default-valued keys are written out

`releaseType: "draft"` and `publishAutoUpdate: true` are the electron-builder defaults, so
writing them changes nothing. They are written out anyway, for three reasons:

1. **There is no comment channel.** `package.json` is strict JSON, so `//` is impossible.
   A `_comment` key is also impossible: `app-builder-lib/scheme.json` sets
   `additionalProperties: false` on both the top-level config and on `GithubOptions`, and
   `app-builder-lib/out/util/config/schemaValidator.js` throws
   `Invalid configuration object` on any unknown key. The config block itself is therefore
   the only place the decisions can be recorded.
2. **`releaseType` guards the one outward-facing surprise.** A draft release is reviewed
   before anyone sees it. `release` publishes live the first time a publish ever runs.
   Pinning the value states the intent and survives a default change in a future major.
3. **`publishAutoUpdate` is the reason this workstream exists.** If that default ever
   flipped, the manifest files would stop appearing and the block would be pointless. The
   key names the requirement.

`token` is never written. `electron-builder` reads `GH_TOKEN` or `GITHUB_TOKEN` from the
environment at publish time. No credential belongs in a committed file.

Every other `GithubOptions` key is omitted. `host`, `protocol`, `channel`,
`vPrefixedTagName`, `tagNamePrefix`, `private`, `requestHeaders` and `timeout` all have
correct defaults for a plain github.com repository, and naming them would be noise.

### Why nothing starts publishing

`node_modules/app-builder-lib/out/publish/PublishManager.js:33-67` is the gate. The
constructor sets `this.isPublish = false`, then raises it only when `publishOptions.publish`
is set. That value comes from the `--publish` CLI flag, or from one of three implicit
triggers when the flag is absent:

- `process.env.npm_lifecycle_event === "release"` — no script in this project is named
  `release`.
- a CI tag, via `getCiTag()` — this project runs no CI.
- `isCI` true, from `ci-info` — this project runs no CI.

The presence of a `publish` config block is not one of them. `package:mac`,
`package:linux` and `package:win` therefore keep behaving exactly as today, and need no
edit. This is what acceptance criterion 5 tests.

### Why the manifest files appear anyway

Manifest writing is on the packaging path, not the publish path. Each target asks for a
publish configuration to embed and to describe the artefact, whether or not a publisher
exists. All five current targets support it in v26:

- mac `dmg` and `zip` produce `release/latest-mac.yml`.
- linux `AppImage` and `deb` both produce `release/latest-linux.yml`. `deb` qualifies via
  `FpmTarget.supportsAutoUpdate()` at `app-builder-lib/out/targets/FpmTarget.js:309`.
- win `nsis` produces `release/latest.yml`.

Each packaged app also gains an `app-update.yml` resource carrying the same provider,
owner and repo. On mac that is
`release/mac-arm64/Praxis Board.app/Contents/Resources/app-update.yml`.

Those embedded values will hold the placeholder until the real repository exists. Nothing
in the app reads them, because `electron-updater` is not installed, so a placeholder there
is inert.

### The residual CI risk — decision

If any `package:*` script were ever run inside a CI environment, the `isCI` trigger would
raise `isPublish`, and the failure mode changes shape: today it is a clean config error
because no repository can be detected, after this change it is a `404` against the
placeholder repository. Neither uploads anything, because no token would be present.

**Decision: accept it, with no mitigation inside this plan.** The reasoning:

- The project runs no CI today, and adding one is out of scope.
- The mitigation the Context suggests — a code comment beside the block — is impossible.
  `package.json` is strict JSON, and a `_comment` key is rejected by the schema, as shown
  above. There is no way to spend a comment here.
- The `REPLACE-ME-` placeholder is itself the warning. A `404` naming
  `REPLACE-ME-github-owner` explains the problem in its own error text more directly than
  a comment would.
- electron-builder v27 removes the implicit CI trigger outright, per the deprecation
  warning in the v26 source. The risk expires on the next major upgrade.
- Nothing is exposed either way. No token, no upload, no release.

A README line is the one remaining option, and it is left as Open question 2 rather than
decided here, because the Context puts documentation outside this plan's file boundary.

### Principles check

- **YAGNI.** No publish script, no dependency, no CI workflow. Only the config the
  workstream asks for.
- **Least privilege.** No credential in the repository, and the default `draft` release
  type keeps the first publish reviewable.
- **Convention over configuration.** Every key with a correct default is omitted. The two
  exceptions are argued above.
- **Least surprise.** The placeholder is unmistakable, so nobody can mistake the config
  for a working one.

## Staged task breakdown

One phase, one task. The change is one JSON key and cannot be sliced smaller.

### Phase 1 — Add the publish block

- **What to build:** Insert the five-key `publish` object as the last key of `build` in
  `package.json`, exactly as shown in Design. Change nothing else in the file.
- **Files touched:** `package.json` only.
- **Effort:** small.
- **Dependencies:** none.
- **Verify:**
  1. Run `node -e 'JSON.parse(require("fs").readFileSync("package.json","utf8"))'` and
     confirm exit 0.
  2. Run `git diff --name-only` and confirm the only entry is `package.json`.
  3. Run `git diff package.json` and confirm the `scripts`, `devDependencies`, `mac`,
     `linux` and `win` blocks are untouched.
  4. Run `npm run package:mac` with no flag and no `GH_TOKEN` in the environment. Confirm
     exit 0, no `Invalid configuration object` error, and no publishing step in the log.
  5. Confirm `release/` still holds the four installers and their blockmaps, and now also
     holds `latest-mac.yml`.
  6. Open `release/latest-mac.yml` and confirm it names the built files and their hashes.
  7. Confirm `release/mac-arm64/Praxis Board.app/Contents/Resources/app-update.yml` exists
     and carries `provider: github` with the placeholder owner and repo.
  8. Confirm no new GitHub release and no git tag was created. `git tag` output is
     unchanged.
  9. Launch the packaged app and confirm the board opens and renders as before.
  10. Run `npm start` and confirm the browser board is unaffected.
  11. On the next occasion a linux or a windows build runs, confirm `release/latest-linux.yml`
      and `release/latest.yml` appear. See Open question 3.

## Data & compatibility

No data model change, no API change, no schema change, no migration. The server,
`src/lib/extract.ts` and the payload types are untouched. Nothing the app reads at runtime
changes, because `app-update.yml` has no reader without `electron-updater`.

The only compatibility note is the packaged installers themselves. Builds made before this
change carry no `app-update.yml`; builds made after carry one holding a placeholder. No
code in either build reads it, so old and new installers behave identically.

**Rollback:** delete the `publish` key, or revert the single commit. `release/` may then
still hold stale manifest files from an earlier run. Deleting them is safe, and the next
build regenerates whatever it needs.

## Testing strategy

The repository has no test framework and no `test` script, and the change is a build
configuration key that only a real packaging run can exercise. It is therefore verified by
the manual steps in Phase 1, not by automated tests. Adding a first test harness for one
JSON key is out of proportion and out of scope.

The steps are chosen so that each acceptance criterion has one command behind it: a JSON
parse for criterion 3, a `grep` for criterion 2, `git diff --name-only` for criterion 13,
and a full unflagged `package:mac` run for criteria 4 to 8. The `package:mac` run is the
important one, because it is the only evidence that adding the block starts nothing.

If a build-config test is ever wanted, the natural assertion is that
`require('./package.json').build.publish` has `provider === 'github'` and no `token` key.
That belongs to a test-writing pass, not to this workstream.

## Open questions

1. **What exact placeholder strings should `owner` and `repo` hold?** This plan proposes
   `REPLACE-ME-github-owner` and `REPLACE-ME-repo-name`. The Context asks for consistency
   with WS-59's placeholder style, and also forbids this plan from reading WS-59's files,
   so the two cannot both be satisfied here. Options: keep the proposed strings, or
   substitute WS-59's exact convention. Recommendation: substitute WS-59's convention if
   one exists, since a single grep for the placeholder should later find every site that
   needs the real value. This needs one look at WS-59 by someone permitted to make it.
2. **Should `README.md` gain one line noting that the manifest files in `release/` are
   generated but never uploaded?** The Context puts this plan's file boundary at
   `package.json`, so it is not decided here. Options: leave the README alone, or add one
   bullet to its existing "Packaged builds" section. Recommendation: add the bullet as a
   separate, explicitly approved edit, because a reader who finds `latest-mac.yml` in
   `release/` with no explanation may reasonably think a publish already happened.
3. **How are the linux and windows manifest criteria verified?** `npm run package:linux`
   and `npm run package:win` cannot be exercised on a plain macOS host without Docker or
   Wine, and the `release/` folder shows only mac artefacts today. Options: verify them on
   the next real cross-platform build, set up the tooling now, or drop criteria 9 and 10
   to "expected, unverified". Recommendation: verify on the next real build. The mac run
   already proves the mechanism, and the linux and windows paths differ only in which
   target writes the file.
4. **Should the real `owner`/`repo` values be filled in by this workstream later, or by
   the workstream that creates the distribution repository?** Recommendation: by the
   latter, since the value cannot be known until the repository exists. Recorded so the
   placeholder is not left orphaned.

## Alternatives considered and rejected

- **Add the `publish` block plus a new `publish:github` npm script.** Rejected. The Context
  makes it optional and it fails YAGNI. A script that carries `--publish always` is a
  loaded gun in a repository whose distribution target does not exist yet, and a script
  that stops short of the flag adds nothing over typing the flag. Adding it would also
  create the one condition that makes the residual CI risk real.
- **Move the whole `build` block into an `electron-builder.yml` file so YAML comments can
  document the placeholder and the CI risk.** Rejected. It relocates configuration this
  plan does not own, produces a large diff for zero functional change, and breaks the
  stated boundary of touching only `package.json`'s `build.publish` key. The comment is
  not worth the move.
- **Write only `provider`, `owner` and `repo`, and rely on both defaults.** The minimal
  option, and defensible. Rejected because `package.json` cannot hold a comment, so
  omitting the keys leaves two deliberate decisions recorded nowhere in the repository,
  and leaves `releaseType` free to drift to a live release on a future default change.
  Two lines is a fair price.
- **Set `releaseType: "release"` so a future publish goes live directly.** Rejected. The
  Context settles this. A first publish that goes live without review is exactly the
  surprise a draft prevents.
- **Set `publishAutoUpdate: false`.** Rejected. It would suppress the manifest files, which
  are the entire deliverable.
- **Add `electron-updater` now and wire a real auto-update path.** Rejected. It is out of
  scope, the app is unsigned so real auto-update cannot work, and WS-59 already covers the
  notify-only path.
- **Add a `_comment` key inside the `publish` block.** Rejected because it does not work.
  `app-builder-lib/scheme.json` sets `additionalProperties: false` on `GithubOptions`, so
  the build would fail validation.
- **Wait until the distribution repository exists before adding any of this.** Rejected.
  The block is inert without the real values, and adding it now makes the later change a
  two-string edit instead of a design decision.

## Final summary

- **Approach:** add one `publish` object to `package.json`'s `build` block, holding
  `provider: "github"`, an obviously-fake `owner` and `repo`, and the two behaviour keys
  `releaseType: "draft"` and `publishAutoUpdate: true`. Nothing else changes.
- **Size:** one phase, one small task, one file, one contiguous JSON addition.
- **Effect today:** update-manifest files start appearing in the local `release/` folder,
  and an inert `app-update.yml` is embedded in each packaged app. No upload, no token, no
  script change, no runtime change.
- **Risks:** all low. The residual CI-implicit-publish path is accepted, argued in Design,
  and expires in electron-builder v27.
- **Needs a decision:** the exact placeholder strings, whether the README gains a line
  about the new `release/` files, and how the linux and windows manifest criteria get
  verified.
