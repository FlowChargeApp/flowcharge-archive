---
id: PLN-29-lfqkvw
type: plan
workstream: WS-39-20u3dv
slug: tauri-cross-platform-packaging
title: "Configure electron-builder packaging and distribution for macOS, Linux, and Windows"
status: done
created: 2026-08-17
updated: 2026-08-19
depends_on: []
links: []
---

## Summary

This plan configures `electron-builder` (pinned `^26`, current stable as of this writing and
confirmed compatible with the `electron@^43` devDependency WS-36 already added) to package the
existing Electron shell — `dist/electron/main.cjs` as `package.json`'s `"main"` entry, already
established by WS-36 (`flowcharge/workstreams/WS-36-b3b2pw-tauri-shell-scaffold/plan.md`) — into
installable artefacts for macOS (`.dmg`/`.zip`), Linux (`.deb`/`.AppImage`), and Windows
(NSIS, ARM64). It adds `electron-builder` as a devDependency, an `"author"` field
`package.json` currently lacks (hard-required by the `.deb` target), a `"build"` config block
inside `package.json`, and three per-platform `"package:*"` scripts, each run manually on its
own machine per this workstream's phase structure — matching WS-36's own "no CI, three real
machines" verification model, since this repo has no `.github/workflows` to extend.

`electron-builder` is chosen over `electron-forge`, per Context's own recommendation: it ships
every needed target from one devDependency and reads config straight out of `package.json`,
avoiding a second JS-module-format question the way an `electron-forge.config.js` file would
reopen the CommonJS-vs-`"type":"module"` question WS-36 already closed with `.cts`/`.cjs`. No
counter-evidence turned up during reconnaissance, so the recommendation is adopted as-is (see
Alternatives).

One repo-grounded design decision made in this plan, not named in Context: `electron-builder`'s
own default `directories.output` is `dist` — the same directory name this repo's own
`npm run build` already owns for compiled TypeScript output (README.md's documented `dist/`
layout, lines 34-62). Left at that default, every `package:*` run would write installer
artefacts (`dist/mac/`, `dist/win-arm64/`, `.dmg`/`.deb`/`.exe` files, `builder-effective-config.yaml`)
into the same tree this plan's own `"files"` allowlist reads *from* (`dist/**`), which is unsafe
to reason about across repeated runs. This plan sets `directories.output` to a new top-level
`release/` directory instead, kept fully separate from `dist/`'s existing compiled-output
meaning, and adds one `.gitignore` line for it (the one edit outside `package.json` this plan
makes, and strictly necessitated by choosing that output directory).

Code signing and notarization are explicitly out of scope throughout and left for a later,
separate workstream, per Context's own instruction.

## Scope

**In scope — acceptance criteria:**

1. `package.json` gains an `"author"` field (name + email), an `"electron-builder"` devDependency
   pinned `^26`, and a `"build"` config block with `appId`, `productName: "Praxis Board"`
   (matching WS-36's own window-title choice), `directories.output: "release"`, a `"files"`
   allowlist of exactly `["dist/**/*", "package.json"]`, and per-platform target lists for
   `mac`, `linux`, and `win`. `npm run build` and every existing script continue to work
   unchanged — this plan adds to `package.json`, it does not edit the existing `"main"`,
   `"scripts".build`, or any WS-36/WS-37/WS-38 key.
2. Three new npm scripts exist — `package:mac`, `package:linux`, `package:win` — each of the
   shape `npm run build && electron-builder --<platform flags>`, run manually per machine.
   None is wired into `prestart`/`prerefresh`/CI, since none should run on every build.
3. On the MacBook Pro M4 Pro (macOS Sequoia): `npm run package:mac` exits 0 and produces a
   `.dmg` and a `.zip` for `arm64`, plus a `.dmg` and `.zip` for `x64` (cross-built in the same
   invocation). The `arm64` artefacts are verified by mounting the `.dmg`, launching the app,
   and confirming the same home page / board / KPI / issue-severity behaviour WS-36 already
   proved in its own Electron window. **The `x64` artefacts are build-only, not
   run-verified** — there is no Intel Mac among the three available test machines, so this is
   stated as a real, unclosed gap, not silently claimed as full macOS coverage (matching WS-36's
   own precedent of stating what a milestone does and does not prove).
4. On the Dell Latitude (Debian 11): `npm run package:linux` exits 0 and produces a `.deb` and
   an `.AppImage`, no extra system tooling installed beyond what Debian 11 ships by default.
   Both are verified: the `.deb` via `dpkg -i` followed by launching the installed app; the
   `.AppImage` via `chmod +x` and running it directly. Both show the same working board as the
   native Electron window.
5. `.rpm` is **not** attempted and is not an acceptance criterion of this workstream (see
   Design and Alternatives for why, and Open Questions for the one item this leaves unresolved).
6. On the Windows 11 ARM VM (UTM): `npm run package:win -- --arm64` (or the ARM64 flag folded
   directly into the `package:win` script — see Design) is run **on that VM itself**, not
   cross-built from macOS/Linux. It exits 0 and produces an NSIS installer for `win32-arm64`.
   Installing it and launching the installed app shows the same working board. **This proves
   ARM64 Windows only** — Intel/AMD Windows (`win32-x64`) is not built or verified anywhere in
   this workstream, stated plainly as a gap, matching WS-36's own Windows-leg precedent.
7. Nothing under `src/` or `electron/` changes. `npm run build`, `npm start`, and
   `npm run electron:dev` (WS-36) continue to work exactly as before.
8. No code-signing or notarization configuration exists anywhere in the `"build"` block or in
   any `package:*` script on any platform.

**Out of scope:**

- Code signing and notarization on any platform — explicitly deferred to a later, separate
  workstream, per Context's own instruction.
- `.rpm` packaging (see Design/Open Questions).
- A custom app icon. WS-36's own plan text noted a custom icon as "packaging polish, deferred
  to WS-39," but Context for this specific workstream does not request one, and `electron-builder`
  builds correctly without one (it falls back to Electron's own default icon). Adding one now
  would be scope invented by this plan, not asked for by Context — flagged, not actioned.
- Auto-update, installer branding beyond `electron-builder`'s own defaults, a CI pipeline, or
  any UI change — none of this is named in Context.
- Any change to `electron/main.cts`, `electron/preload.cts`, or any `src/` file — this
  workstream is packaging configuration only, layered on top of WS-36's already-working
  `"main": "dist/electron/main.cjs"` entry point, which `electron-builder` reads exactly as
  `electron .` already does.
- The `webkit2gtk` system-webview risk the discarded Tauri plan carried — does not apply under
  Electron (Electron bundles its own Chromium) and is not re-flagged here.
- Eliminating a separate server process — already satisfied before this workstream starts,
  since `server.ts` already runs entirely inside the one Electron process via WS-36/WS-37, never
  as a standalone binary. Nothing in this plan touches that.

**Assumptions (stated, not confirmed by a user — this plan runs without one):**

- WS-36, WS-37, and WS-38 have all landed by the time this plan executes:
  `dist/electron/main.cjs` exists and is the working `"main"` entry, the frontend's IPC bridge
  (WS-37) and native folder picker (WS-38) are both in place. This plan builds forward from
  those plans' own contracts, the same forward-building pattern WS-38's plan used against
  WS-37's.
- `electron-builder@^26` is used — confirmed current stable (`26.15.x` as of this plan's
  writing; `27.x` exists only as pre-release alphas) and requires no `electron` version pin
  beyond what WS-36 already set (`^43`). The exact minor/patch resolves via `npm install` and
  locks in `package-lock.json`, matching how `typescript`/`@types/node`/`electron` are already
  pinned.
- The `"author"` field uses this repo's own git-configured identity — `git config user.name`
  (`Anthony Koukoullis`) and `git config user.email` (`akoukoullis@gmail.com`) in this
  checkout — since no other author identity is named anywhere in Context. Whether this is the
  identity wanted on a build ever handed to another person is a separate, open question (see
  Open Questions), paralleling the placeholder `appId` below.
- `appId` uses the same placeholder bundle identifier the discarded Tauri plan already flagged
  as open and unresolved — `com.praxisboard.app` — carried forward unchanged rather than
  re-decided here, per Context's own instruction not to re-decide it.
- `package-lock.json` (not `bun.lock`) is treated as the canonical lockfile for this
  workstream's `npm install`/`npm run package:*` commands, matching every prior workstream in
  this chain's own stated assumption. The dual-lockfile question itself stays open and
  pre-existing, not created by this plan.
- Windows packaging is run with `npm install` on the ARM VM pulling Electron's prebuilt
  `win32-arm64` binary, exactly as WS-36's Phase 5 already does for `electron:dev` — this plan
  adds no new install step beyond `electron-builder` itself.

## Design

### `package.json` changes

**New devDependency:**
```json
"electron-builder": "^26"
```

**New top-level field** (electron-builder's `.deb` target hard-requires this; it is currently
absent):
```json
"author": "Anthony Koukoullis <akoukoullis@gmail.com>"
```

**New `"build"` config block**, placed in `package.json` rather than a sibling
`electron-builder.yml`/`.json5` file. This is a deliberate choice, not the untouched default:
the repo has no YAML files anywhere today, and every other tool's config here already lives
either inside `package.json` (`"scripts"`, `"engines"`) or as a same-format sibling
(`tsconfig.json`, `electron/tsconfig.json`) — introducing the one YAML file in the repo for a
single config block would add a new format for no benefit over the JSON `package.json` already
central to this project's own convention (see Alternatives).

```json
"build": {
  "appId": "com.praxisboard.app",
  "productName": "Praxis Board",
  "directories": {
    "output": "release"
  },
  "files": [
    "dist/**/*",
    "package.json"
  ],
  "mac": {
    "target": [
      { "target": "dmg", "arch": ["x64", "arm64"] },
      { "target": "zip", "arch": ["x64", "arm64"] }
    ]
  },
  "linux": {
    "target": [
      { "target": "deb", "arch": ["x64"] },
      { "target": "AppImage", "arch": ["x64"] }
    ]
  },
  "win": {
    "target": [
      { "target": "nsis", "arch": ["arm64"] }
    ]
  }
}
```

`"files": ["dist/**/*", "package.json"]` is the critical line named in Context: left at
`electron-builder`'s own default inclusion glob, the entire project directory — `src/`,
`tools/`, every `flowcharge/` workstream markdown file — would be packaged into the shipped app.
This allowlist scopes packaging to exactly what WS-36's `main.cjs` needs at runtime:
`dist/electron/**` (the Electron entry and preload), `dist/server.js`, `dist/lib/**` (`extract.js`,
`git.js`, `projects.js`, `detail.js`), and `dist/public/**` (the static frontend) — all already
produced by the existing, unmodified `npm run build`. `dist/scripts/extract-praxis-data.js`
(the standalone `npm run refresh` CLI) is also swept in by the `dist/**/*` glob; it is dead
weight in a shipped desktop app but harmless (unreachable, never invoked by `main.cjs`) and
Context does not ask this plan to hand-carve the allowlist to exclude it — narrower than
Context's own specified allowlist would be over-engineering a plan step Context didn't call for.

**Windows target is NSIS, not Squirrel.Windows** — Squirrel.Windows does not support ARM64 and
is deprecated in `electron-builder`'s own guidance regardless of tool choice, so `nsis` is the
only correct choice for the `win32-arm64` target this workstream actually builds and verifies.

**Three new scripts** (named `package:*`, not `dist:*`, specifically to avoid confusion between
an npm script called `dist` and this repo's existing `dist/` build-output directory, which the
`"files"` allowlist above reads from directly):
```json
"package:mac": "npm run build && electron-builder --mac --x64 --arm64",
"package:linux": "npm run build && electron-builder --linux deb AppImage",
"package:win": "npm run build && electron-builder --win --arm64"
```
Each rebuilds `dist/` fresh via the existing `npm run build` before packaging, so a stale
compiled tree is never shipped. None is wired into `prestart`, `prerefresh`, or any
existing script — they are additive, manually invoked per platform per phase, matching
Context's own "run manually per platform per this workstream's phase structure."

**`.gitignore`** gains one line, `release/` — the single edit outside `package.json` this plan
makes, and strictly required by setting `directories.output` away from the already-ignored
`dist/`. Without it, every `package:*` run would leave an untracked, unignored `release/`
directory full of multi-hundred-megabyte installer binaries sitting in `git status`.

### Why `directories.output` moves to `release/`, not left at the default `dist`

`electron-builder`'s own default output directory is `dist` (documented default, unrelated to
this repo). This repo's `npm run build` (`src/server.ts`'s compiled output, per README.md lines
34-62) already owns `dist/` as "everything the TypeScript compiler and `tools/copy-assets.mjs`
produce." Two real problems follow from leaving `electron-builder` at that same default:

1. **Self-inclusion risk.** The `"files"` allowlist this plan sets is `dist/**/*`. If
   `electron-builder` also wrote its own output (`dist/mac/Praxis Board.app/`, `.dmg` files,
   `builder-effective-config.yaml`) into `dist/`, a second `package:*` run's file-collection
   pass would see the first run's installer output sitting inside the very tree it globs as
   packaging input — `electron-builder` generally excludes its own configured output directory
   from the files it packages, but relying on that implicit exclusion when the output directory
   is otherwise indistinguishable from genuine app content is fragile and unnecessary to accept.
2. **README's own documented `dist/` semantics break.** README.md states plainly that `dist/`
   is "generated by npm run build" and that `rm -rf dist` is a safe, complete clean step. Mixing
   multi-hundred-MB platform installers into that same directory changes what "clean" means
   without documentation catching up, and this plan is not chartered to rewrite README.md.

Setting `directories.output: "release"` sidesteps both: `dist/` keeps meaning exactly what
README.md already says it means, `release/` is unambiguously the new thing this plan adds, and
the `"files"` allowlist's `dist/**/*` glob never needs to reason about excluding the packager's
own prior output.

### What is reused, not reinvented

`npm run build` (the existing two `tsc` passes plus `tools/copy-assets.mjs`), WS-36's
`"main": "dist/electron/main.cjs"` entry point, and every existing script are untouched.
`electron-builder` reads the `"main"` field and produces a working packaged app from it with
zero new file-layout work — Context's own finding that "file-layout/entry-point resolution
needs no new work" is taken as given and not re-verified here.

## Staged task breakdown

**Phase 1 — `package.json` config and script wiring.** Effort: small. Dependencies: WS-36,
WS-37, WS-38 landed (Assumptions, above).
- Add `electron-builder` (`^26`) as a devDependency.
- Add the `"author"` field.
- Add the `"build"` config block per Design, including `directories.output: "release"`.
- Add the three `package:*` scripts.
- Add `release/` to `.gitignore`.
- Files touched: `package.json`, `.gitignore`.
- Verify: `npm install` succeeds; `npm run build` still exits 0 unchanged; `node -e
  "require('./package.json').build.appId"` (or equivalent) confirms the config block parses as
  valid JSON.

**Phase 2 — macOS build and verify (MacBook Pro M4 Pro, macOS Sequoia).** Effort: small.
Dependencies: Phase 1.
- Run `npm run package:mac`.
- Mount the `arm64` `.dmg`, launch the installed app, confirm home page, board navigation, KPI
  panel, and issue/severity panels all render and behave exactly as WS-36's own Electron window
  already does.
- Confirm the `x64` `.dmg`/`.zip` were produced (build exits 0, files exist) but record plainly
  that they are not launched or verified — no Intel Mac is available.
- Verify: acceptance criteria 3 passes, with the `x64` gap recorded exactly as stated there.

**Phase 3 — Linux build and verify (Dell Latitude, Debian 11).** Effort: small. Dependencies:
Phase 1 (sequenced after Phase 2 since this is a solo, sequential plan; independent of it in
practice).
- Run `npm run package:linux`.
- Install the `.deb` (`dpkg -i`) and launch the installed app; separately `chmod +x` the
  `.AppImage` and run it directly. Confirm both show the same working board.
- Verify: acceptance criterion 4 passes; criterion 5 (`.rpm` not attempted) holds by
  construction, since the `linux.target` list in `package.json` never names `rpm`.

**Phase 4 — Windows (ARM) build and verify (Windows 11 ARM VM under UTM).** Effort: small.
Dependencies: Phase 1.
- On the VM itself (not cross-built): `npm install` (pulls Electron's prebuilt `win32-arm64`
  binary, per WS-36's own precedent), then `npm run package:win`.
- Install the produced NSIS installer and launch the installed app; confirm the same working
  board.
- Verify: acceptance criterion 6 passes; record explicitly that this proves ARM64 Windows only.

All four phases are sequential in this plan's own numbering, but Phases 2-4 are independent of
each other and could run in any order or in parallel across the three machines — listed
sequentially here only because this is a solo, one-person-verifying plan, matching WS-36's own
phase-ordering convention.

## Data & compatibility

No data model exists in this change; no migrations. `src/`, `electron/`, the existing `/api/*`-
free Electron IPC surface WS-37/WS-38 establish, and the plain `npm start` / `npm run
electron:dev` flows are all untouched — this plan only adds a packaging layer on top of the
already-working, already-verified Electron shell.

**Rollback:** revert the `package.json` changes (devDependency, `"author"`, `"build"` block,
the three `package:*` scripts) and the one `.gitignore` line; delete `release/` and
`node_modules/electron-builder`. Nothing under `src/` or `electron/` was touched, so rollback is
a pure config revert with no data or migration story to reverse.

## Testing strategy

- This workstream is packaging configuration and cross-platform, on-device build verification
  by nature — there is no pure logic added here worth a unit test, matching every prior
  workstream in this chain's own finding that this repo has no CI (`.github/workflows` does not
  exist) to extend, and standing one up for three-OS native packaging runs is disproportionate
  to a packaging-only workstream.
- One mechanical, greppable check worth calling out explicitly: after Phase 1, `node -p
  "JSON.stringify(require('./package.json').build)"` parses without error and contains no
  `rpm` entry under `linux.target` and no `squirrel`/code-signing keys anywhere — confirming the
  config matches this plan's own decisions, not a copy-paste drift.
- No new tests are needed for `src/` or `electron/` — nothing there changes.

## Open questions

1. **`appId` (`com.praxisboard.app`).** Carried forward unresolved from the discarded Tauri
   plan, per Context's own instruction not to re-decide it here. It becomes part of the
   installed app's OS-level identity on every platform; changing it later is a breaking change
   for anyone who already installed under the placeholder. Recommend confirming the real
   reverse-DNS string before any build meant for actual distribution — every artefact this
   workstream produces should be treated as internal-only until that value is confirmed, exactly
   as the discarded Tauri plan's own resolution already stated.
2. **`.rpm` — build-only-and-unverified vs. dropped entirely.** This plan drops it entirely
   from `linux.target` and from the acceptance criteria (criterion 5), rather than adding it as
   a build-only, never-launched target. Recommend confirming this is acceptable: the
   alternative (add `rpm` to `linux.target`, install `rpm`/`rpmbuild` on the Dell Latitude, but
   never verify the output since no RPM-based distro exists among the three machines) produces
   an artefact nobody on this workstream can install-and-launch even once, which this plan
   judges not worth the added tooling install for a target this workstream cannot honestly claim
   "verified" for either way.
3. **`"author"` identity for a real distribution build.** This plan uses this checkout's own
   `git config user.name`/`user.email` (`Anthony Koukoullis <akoukoullis@gmail.com>`), since no
   other identity is named in Context. Recommend confirming whether this is the identity wanted
   on any build ever handed to another person, or whether a different public-facing name/email
   should be used instead — the same open-identity shape as the `appId` question above, not
   previously raised because the discarded Tauri plan's bundler had no equivalent hard
   requirement.
4. **Electron-builder major-version pin (`^26`).** Confirmed current stable as of this plan's
   writing (`26.15.x`; `27.x` exists only as pre-release alphas). If implementation happens
   meaningfully later and a newer major has since become current and stable, confirm whether to
   track it instead — none of this plan's design (the `directories.output` decision, the
   `"files"` allowlist, the NSIS/deb/AppImage target choices) depends on the exact major, so this
   does not block writing the config, only which `^N` gets typed into `package.json`.

## Alternatives considered and rejected

- **`electron-forge` instead of `electron-builder`.** Rejected per Context's own recommendation,
  confirmed rather than second-guessed during reconnaissance: `electron-forge` needs a separate
  `@electron-forge/maker-*` devDependency per target format (versus `electron-builder` shipping
  every needed target — dmg, deb, AppImage, NSIS — from one package) and its own JS-module config
  file would reopen the CommonJS-vs-`"type":"module"` question WS-36 already closed with
  `.cts`/`.cjs`. No advantage surfaced during this plan's reconnaissance that would justify
  reopening that question, so the recommendation stands as given.
- **Leaving `directories.output` at `electron-builder`'s own default (`dist`).** Rejected — see
  Design's dedicated section above. It collides with this repo's own pre-existing, documented
  meaning of `dist/` as "TypeScript build output only," and creates a self-referential
  packaging/input relationship this plan is not willing to depend on implicit tool behaviour to
  resolve safely.
- **A sibling `electron-builder.yml`/`electron-builder.json5` config file, instead of
  `package.json`'s `"build"` key.** Rejected: this repo has no YAML/JSON5 files today: every
  existing per-tool config lives in `package.json` itself or as a same-format sibling
  (`tsconfig.json`, `electron/tsconfig.json`). Introducing the repo's first YAML file for one
  config block adds a new file format for no benefit `package.json`'s own `"build"` key doesn't
  already provide.
- **Attempting `.rpm` on Debian 11 via installed `rpm`/`rpmbuild` tooling, as a build-only,
  unverified target.** Rejected — see Open Questions item 2 for the reasoning; recorded as open
  rather than silently decided, since Context explicitly leaves this choice to be made and
  recorded here.
- **Squirrel.Windows instead of NSIS for the Windows target.** Rejected outright, not a close
  call: Squirrel.Windows does not support ARM64 at all, and `electron-builder`'s own guidance
  deprecates it regardless of target architecture — NSIS is the only viable choice for the
  `win32-arm64` build this workstream actually produces and verifies.
- **Cross-building the Windows NSIS installer from macOS or Linux via Wine, instead of building
  natively on the Windows 11 ARM VM.** Rejected: Context is explicit that native, on-VM building
  is the only genuinely verifiable path given the available hardware, and it avoids taking on a
  Wine cross-build dependency this workstream has no other reason to introduce.
- **Adding a custom app icon now**, since WS-36's own plan text named it as polish "deferred to
  WS-39." Rejected: Context for this specific workstream does not request one, and inventing it
  here would be scope this plan wasn't asked for — noted under Out of Scope rather than silently
  actioned or silently dropped.
