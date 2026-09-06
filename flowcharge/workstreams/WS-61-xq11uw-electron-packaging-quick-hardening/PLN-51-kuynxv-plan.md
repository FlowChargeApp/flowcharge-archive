---
id: PLN-51-kuynxv
type: plan
workstream: WS-61-xq11uw
slug: electron-packaging-quick-hardening
title: "Close the easy source-reading paths in the packaged Electron build"
status: done
created: 2026-08-22
updated: 2026-08-22
depends_on: []
links: []
---

# Close the easy source-reading paths in the packaged Electron build

## Summary

Three small, independent edits to three files. Together they close the cheapest ways to read
this closed-source app's code out of a packaged build.

1. `package.json` gets a `build.electronFuses` block. It turns off `ELECTRON_RUN_AS_NODE`,
   `NODE_OPTIONS` and the `--inspect` family in the packaged binary.
2. `electron/main.cts` gets one line in `createWindow`'s `webPreferences`:
   `devTools: !app.isPackaged`.
3. `tools/copy-assets.mjs` gets a closing assertion that fails `npm run build` if any `.map`
   file is found anywhere under `dist/`.

Item 1 is the large one. Today a person can start the shipped binary with the Node inspector
attached and read every loaded script in full. That single path defeats minification,
obfuscation and bytecode at once, so closing it is worth more than the rest of the wider
hardening plan combined.

This plan raises the cost of casual reading. It is not a security boundary. Nothing here
stops a determined person with the binary on their machine. That framing is inherited from
the consultation this workstream came from and is repeated here so no later stage mistakes
these steps for protection.

No dependency is added. `electron-builder` 26.15.3, `@electron/fuses` 1.8.0 and Electron
43.4.0 are already installed. No runtime code path changes for `npm start` or
`npm run electron:dev`.

This plan implements nothing.

## Scope

### Acceptance criteria

**Fuses**

1. `package.json` contains a `build.electronFuses` object with exactly these five keys:
   `runAsNode: false`, `enableNodeOptionsEnvironmentVariable: false`,
   `enableNodeCliInspectArguments: false`, `grantFileProtocolExtraPrivileges: false`,
   `resetAdHocDarwinSignature: true`.
2. `enableCookieEncryption`, `onlyLoadAppFromAsar`, `enableEmbeddedAsarIntegrityValidation`
   and `loadBrowserProcessSpecificV8Snapshot` do not appear anywhere in `package.json`.
3. `package.json` is still valid JSON. `node -e 'JSON.parse(require("fs").readFileSync("package.json","utf8"))'`
   exits 0.
4. `npm run package:mac` exits 0 and prints no `Invalid configuration object` error. This
   proves no unknown key was introduced.
5. The `package:mac` log contains an `executing @electron/fuses` line for each packaged
   binary.
6. `npx electron-fuses read --app "release/mac-arm64/Praxis Board.app"` reports `RunAsNode`,
   `EnableNodeOptionsEnvironmentVariable`, `EnableNodeCliInspectArguments` and
   `GrantFileProtocolExtraPrivileges` as `Disabled`.
7. `release/mac-arm64/Praxis Board.app` launches on this Apple Silicon machine and renders a
   board. This is the criterion that proves `resetAdHocDarwinSignature` did its job.
8. `release/mac/Praxis Board.app` (the x64 bundle) also launches, under Rosetta.
9. `ELECTRON_RUN_AS_NODE=1 "release/mac-arm64/Praxis Board.app/Contents/MacOS/Praxis Board"`
   starts the normal app window. It does not start a Node REPL.
10. `"release/mac-arm64/Praxis Board.app/Contents/MacOS/Praxis Board" --inspect=9229` prints
    no `Debugger listening on ws://...` line, and `chrome://inspect` lists no target.
11. `NODE_OPTIONS="--inspect" "release/mac-arm64/Praxis Board.app/Contents/MacOS/Praxis Board"`
    likewise opens no inspector.
12. `npm run electron:dev` still starts the app and still allows DevTools. Fuses are applied
    by `electron-builder` at package time only, so the dev run is untouched.

**DevTools**

13. `createWindow` in `electron/main.cts` passes `devTools: !app.isPackaged` inside
    `webPreferences`. The four existing keys (`contextIsolation`, `nodeIntegration`,
    `sandbox`, `preload`) are unchanged.
14. In `npm run electron:dev`, DevTools still open: the View menu item works, and
    `Cmd+Option+I` works.
15. In the packaged app, DevTools do not open by any route: the menu item, the keyboard
    shortcut, and the window right-click context menu all produce nothing.
16. The packaged app otherwise behaves as before. The board loads, project tiles render, and
    the detail modal opens.

**Source-map guard**

17. `tools/copy-assets.mjs` ends with a check that walks the whole of `dist/` recursively —
    not `dist/public` alone — and collects every file whose name ends with `.map`. The scan
    root therefore covers `dist/public/` (browser compilation), `dist/electron/` (main
    process compilation) and `dist/` itself with `dist/lib/` and `dist/scripts/` (Node-side
    compilation).
18. On a clean tree the check finds nothing, prints one short confirmation line, and
    `npm run build` exits 0 exactly as today.
19. With `"sourceMap": true` temporarily set in `src/public/tsconfig.json`, `npm run build`
    exits non-zero and prints an error naming every offending file by path and saying why it
    must not ship.
20. The same failure occurs with `"sourceMap": true` set in the root `tsconfig.json`, whose
    maps land in `dist/` and `dist/lib/`. This is the case the narrower `dist/public` scan
    would have missed, so it is the criterion that proves the widening works.
21. The same failure occurs with `"sourceMap": true` set in `electron/tsconfig.json`, whose
    maps land in `dist/electron/`.
22. After each temporary setting is reverted, `npm run build` exits 0 again.
23. Because `npm run build` is the first command of `package:mac`, `package:linux` and
    `package:win`, a failing check also fails all three. Verified once by running
    `npm run package:mac` with a temporary `sourceMap: true` in place and confirming it
    stops before `electron-builder` starts.
24. The check adds no dependency, no new file, and no new npm script.

**Whole change**

25. `git diff --name-only` lists exactly three files: `package.json`, `electron/main.cts`,
    `tools/copy-assets.mjs`.
26. `npm start` still serves the board at `http://localhost:4173`.

### Out of scope

- Renderer bundling, minification and obfuscation. That is WS-62.
- Code signing, notarization and ASAR integrity. That is WS-63. This plan must not set
  `onlyLoadAppFromAsar` or `enableEmbeddedAsarIntegrityValidation`, not even to `false`.
- Bytenode compilation of the Electron main process. That is WS-64.
- `enableCookieEncryption`. See "Decisions taken" below.
- Any change to `build.files`, including the fact that it currently ships this project's
  compiled unit tests. See Open question 2.
- Any change to `README.md`. See Open question 3.
- Any change to `src/`, to the three `tsconfig.json` files, or to the `scripts` block.
- Any attempt to make the app resistant to a determined reverse engineer.

### Assumptions

- **A1 — No release constraint applies.** The app is private, closed-source, unsigned, and
  installed by hand on the author's own machines. There are no live users, no production
  data, and no rollout to stage. Each phase is one commit and the app stays shippable
  between them. This was not confirmed by the user in this run; it is read from the README's
  "Packaged builds" section, which states the builds are for the author's own machine only.
- **A2 — The unsigned state persists for now.** `build.mac` declares no signing identity and
  no notarization today. The whole reason `resetAdHocDarwinSignature: true` is needed is that
  `electron-builder` cannot produce a real signature after mutating the binary. If a real
  Developer ID identity is added, that key needs a second look — but the look belongs to
  WS-63, not here. This plan only leaves the forward pointer.
- **A3 — Verification happens on macOS Apple Silicon.** That is the machine this repo is
  worked on. Criteria 6 to 11 are macOS commands. The Linux and Windows equivalents are
  Open question 1.
- **A4 — The three items are mutually independent.** Nothing in the fuse block depends on the
  `devTools` line or on the guard, and the reverse. The phase order below is a risk order,
  not a dependency order.
- **A5 — The whole current `dist/` tree is clean.** Confirmed three ways by this workstream's
  investigation: none of the three tsconfigs sets `sourceMap`, `inlineSourceMap` or
  `declarationMap`, and TypeScript defaults all three to off; `find dist -name "*.map"`
  returns nothing anywhere under `dist/`; and `tools/copy-assets.mjs` copies a hardcoded list
  of four named paths (line 15), so it cannot copy a map even today. The guard therefore
  fixes no present bug. It catches a future regression.

### Decisions taken (not open questions)

These were left to this plan's judgement by the workstream brief, or settled after its first
draft. They are decided here so no downstream stage stalls on them.

- **The source-map guard scans all of `dist/`, not `dist/public` alone.** This was Open
  question 1 in the first draft of this plan and is now settled. The deciding reason: a
  `sourceMap: true` flip in the root `tsconfig.json` or in `electron/tsconfig.json` puts maps
  in `dist/`, `dist/lib/`, `dist/scripts/` and `dist/electron/`, where `build.files`'s
  `dist/**/*` glob still ships them and a `dist/public`-only scan would never see them. The
  widened scan is the same code with a different starting path, so it closes the larger hole
  at no extra cost. The workstream brief named `dist/public`; this plan deliberately widens
  that, with the decision recorded here rather than left implicit.

- **`grantFileProtocolExtraPrivileges: false` is included.** This app only ever loads
  `http://127.0.0.1:<port>`. `electron/main.cts:91` builds that URL and `main.cts:95` passes
  it to `createWindow`, which calls `loadURL` at `main.cts:29`. No `file://` load exists
  anywhere in the main process. The fuse therefore costs nothing and removes a set of extra
  privileges the app has no use for.
- **`enableCookieEncryption` is excluded.** The app has no cookies, no auth and no session
  store worth encrypting. The fuse is a one-way transition: enabling it and later disabling
  it corrupts the cookie store. Paying a permanent, irreversible cost for zero present
  benefit is unwarranted scope, so the key is left absent rather than set to `false`.

## Design

### 1. `package.json` — the `build.electronFuses` block

The key sits directly under `build`, as a sibling of `files`, `mac`, `linux` and `win`.

```json
"electronFuses": {
  "runAsNode": false,
  "enableNodeOptionsEnvironmentVariable": false,
  "enableNodeCliInspectArguments": false,
  "grantFileProtocolExtraPrivileges": false,
  "resetAdHocDarwinSignature": true
}
```

The shape is flat camelCase booleans, not the `FuseV1Options` enum names. This is confirmed
against the installed code, not from memory:

- `node_modules/app-builder-lib/out/configuration.d.ts:235` declares
  `readonly electronFuses?: FuseOptionsV1 | null`.
- `configuration.d.ts:471-526` defines `FuseOptionsV1` with exactly these camelCase optional
  booleans.
- `node_modules/app-builder-lib/out/platformPackager.js:266-297` translates each camelCase key
  into its `FuseV1Options` enum entry. It skips any key that is `null` or `undefined`, which
  is why an omitted key such as `enableCookieEncryption` is genuinely left untouched rather
  than defaulted.

**Why `resetAdHocDarwinSignature: true` is required here.** `platformPackager.js:258` carries
the comment "the fuses MUST be flipped right before signing", and `doAddElectronFuses` runs at
line 252, immediately before `doSignAfterPack` at line 255. Flipping a fuse rewrites bytes in
the Electron binary, which invalidates whatever signature that binary carried. When a signing
identity exists, the sign step that follows repairs this. This project declares no identity,
so nothing repairs it, and on Apple Silicon a macOS binary with a broken signature can refuse
to launch outright. Setting `resetAdHocDarwinSignature: true` makes `@electron/fuses` re-apply
an ad-hoc signature itself after the flip, which is what keeps the arm64 build launchable in
the current unsigned state.

Note the `configuration.d.ts:521-523` doc comment says this key "should be unneeded since
electron-builder signs the app directly after flipping the fuses". That sentence assumes a
signing identity is configured. It is not, here. Acceptance criterion 7 is the check that
settles this empirically for this repo.

**Forward pointer for WS-63.** When real code signing lands, revisit whether
`resetAdHocDarwinSignature` should stay. An ad-hoc reset applied before a real Developer ID
signature is at best redundant. Deciding that is WS-63's job. This plan changes nothing about
it and only records the link.

**Why no breakage is expected.** This workstream's investigation confirmed nothing under
`electron/`, `src/` or `tools/` uses `child_process`, `process.fork`, `utilityProcess`,
`NODE_OPTIONS`, `ELECTRON_RUN_AS_NODE` or `--inspect`. The one relevant subtlety is that
`runAsNode: false` breaks `process.fork` in the main process. `electron/main.cts:65-73` does
not fork. It routes a genuine native dynamic `import()` through `new Function` to load
`../server.js` in-process, precisely so the ESM server module evaluates inside the main
process. That is unaffected by the fuse.

### 2. `electron/main.cts` — `devTools`

One line inside the existing `webPreferences` object at `main.cts:22-27`:

```ts
webPreferences: {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  devTools: !app.isPackaged,
  preload: path.join(__dirname, 'preload.cjs'),
},
```

`app` is already imported at `main.cts:8`. `app.isPackaged` is already read directly in this
file at `main.cts:52`, so this introduces no new concept. It is settled by the time
`createWindow` runs, because `createWindow(SERVER_URL)` is called at `main.cts:95` from inside
the `app.whenReady()` callback that opens at `main.cts:32`.

**Which signal, and why not the other one.** Do not use `isPackaged` from
`src/lib/projects.ts`. That is a different, derived proxy — `Boolean(process.env.PRAXIS_DATA_DIR)`
— which exists only because the server process cannot see `app.isPackaged`. The main process
can. Reading the derived proxy here would mean reading the wrong signal from the wrong layer,
and would couple the main process to a server-side convention it has no reason to know.
`main.cts:49-51`'s own comment already states this boundary.

**What this does and does not stop.** `devTools: false` removes the renderer's inspector. It
does not remove the main process's Node inspector — that is fuse 3's job — and the two are
worth doing together for that reason.

### 3. `tools/copy-assets.mjs` — the source-map guard

The file today is 20 lines: it creates `dist/public` (line 12) and copies four hardcoded
paths into it (lines 15-20). The guard is appended after that loop.

**Scan root.** The guard scans the whole of `dist/`, not `dist/public`. The file already
holds `repoRoot` at line 8, so the root is `path.join(repoRoot, 'dist')` — a sibling constant
to the existing `distPublic` at line 10, which the copy loop keeps using unchanged. One scan
from `dist/` covers all three compilations at once: `dist/` with `dist/lib/` and
`dist/scripts/` from the root `tsconfig.json`, `dist/public/` from `src/public/tsconfig.json`,
and `dist/electron/` from `electron/tsconfig.json`. `build.files`'s `dist/**/*` glob ships
every one of those trees, so every one of them needs the guard.

Public shape of the added code:

```js
// returns paths relative to `dir`, for every file whose name ends in `.map`
function findSourceMaps(dir, prefix = '') { ... }
```

Behaviour contract:

- Walks `dir` with `fs.readdirSync(dir, { withFileTypes: true })` and recurses into entries
  where `dirent.isDirectory()` is true. Hand-rolled recursion rather than
  `readdirSync(..., { recursive: true })`, because `package.json`'s `engines` field allows
  Node 18 and the recursive option only arrived in 18.17. Using `isDirectory()` also means a
  symlinked directory is not followed, so the walk cannot loop.
- Called once, with `dist/` as its root. It needs no exclusions: `dist/` holds only build
  output, is gitignored, and every subtree in it is shipped by `build.files`.
- Matches on a lowercase `.map` suffix of the file name.
- Returns relative paths so the error message is readable.
- The caller collects the result and, if it is non-empty, `throw`s a single `Error` that
  lists every offending path and states plainly that source maps must never ship in a
  packaged build. An uncaught `throw` gives a non-zero exit, which fails `npm run build`.
- If the list is empty it prints one line, in the same `console.log` style the file already
  uses, so a passing build shows the check actually ran.

**Why this file, and what it must not become.** `tools/copy-assets.mjs` is already the last
command of the `build` script, already knows `repoRoot` (line 8) and `distPublic` (line 10),
and already runs on every path into packaging. Being the last step also means all three `tsc`
invocations have finished by the time it runs, so the whole `dist/` tree is complete and the
scan sees every emitted file. It needs no new file, no new script, and no dependency — which
matters in a repo the README describes as having no runtime dependency, no framework and no
bundler. The guard must stay a guard: it asserts and throws. It must never delete, filter or
rewrite a `.map` file, because silently removing the file would hide the tsconfig regression
that produced it, which is the thing actually worth knowing about.

**Why the scan is the right shape.** `package.json`'s `build.files` is `dist/**/*` with no
filtering, so anything sitting in `dist/` at package time ships. `dist/` is gitignored, so a
code review diff would never show a map appearing. The failure mode being guarded is
therefore invisible by every other means available in this repo, which has no test runner and
no CI.

## Staged task breakdown

The three phases are independent. The order below is riskiest-first: the fuse change is the
only one that could produce a build that does not launch, so it should be proven before time
goes into the other two. Any other order works.

### Phase 1 — Electron fuses (medium)

**Build.** Add the five-key `build.electronFuses` object to `package.json`, as specified in
Design section 1.

**Files touched.** `package.json` only.

**Dependencies.** None.

**Verify.** Acceptance criteria 1 to 12. In order: check the JSON parses, run
`npm run package:mac`, confirm the `executing @electron/fuses` log line, read the fuse states
back with `npx electron-fuses read --app "release/mac-arm64/Praxis Board.app"`, launch both
mac bundles, then attempt each of the three escape hatches (`ELECTRON_RUN_AS_NODE=1`,
`--inspect=9229`, `NODE_OPTIONS="--inspect"`) and confirm each does nothing. Finally run
`npm run electron:dev` and confirm the dev experience is unchanged.

**Risk.** If criterion 7 fails and the arm64 bundle will not launch, the cause is the ad-hoc
signature. Reverting this one commit restores a launchable build immediately.

### Phase 2 — DevTools off in the packaged window (small)

**Build.** Add `devTools: !app.isPackaged` to `createWindow`'s `webPreferences` in
`electron/main.cts`, as specified in Design section 2.

**Files touched.** `electron/main.cts` only.

**Dependencies.** None. It does not need Phase 1.

**Verify.** Acceptance criteria 13 to 16. Run `npm run electron:dev` and confirm DevTools
still open by menu and by `Cmd+Option+I`. Then run `npm run package:mac`, launch the built
app, and confirm no route opens DevTools while the board itself still works.

### Phase 3 — Source-map guard in the build chain (small)

**Build.** Append the recursive `.map` check to `tools/copy-assets.mjs`, rooted at `dist/`,
as specified in Design section 3.

**Files touched.** `tools/copy-assets.mjs` only.

**Dependencies.** None.

**Verify.** Acceptance criteria 17 to 24. Prove both directions, and prove the widened root
in particular. First run `npm run build` on the clean tree and confirm it passes and prints
the confirmation line. Then set `"sourceMap": true` temporarily in each of the three
tsconfigs in turn — `src/public/tsconfig.json`, then the root `tsconfig.json`, then
`electron/tsconfig.json` — running `npm run build` after each and confirming it exits
non-zero with the offending paths named. The root and electron cases are the ones a
`dist/public`-only scan would have missed, so skipping them leaves the widening unproven.
With one setting still in place, run `npm run package:mac` once and confirm it stops before
`electron-builder` starts. Revert every tsconfig and confirm the build passes again, then
confirm `git diff --name-only` lists no tsconfig. A guard only tested in its passing
direction is not tested.

## Data & compatibility

- **No data model changes.** No schema, no migration, no stored format. The project registry
  `.praxis-projects.json` and every `flowcharge/` file are untouched.
- **No API or contract changes.** No server route, no IPC channel and no preload surface is
  added, removed or altered.
- **Dev behaviour is unchanged.** Fuses apply to the packaged binary only, and
  `!app.isPackaged` is `true` under `npm run electron:dev`. `npm start` runs no Electron at
  all and is entirely unaffected.
- **Compatibility with existing installed builds.** None is needed. Each packaged build is a
  self-contained bundle installed by hand; a new build replaces an old one and shares no
  state format with it.
- **Rollback.** Every phase is a single-file revert with no residue.
  - Phase 1: remove the `electronFuses` block and repackage. The next build's binary is
    unmutated. Note the direction of travel: fuses are burned into the *packaged output*, not
    into the source tree, so reverting the config fully undoes it on the next package run. An
    already-distributed binary keeps its flipped fuses, which is irrelevant here because
    nothing is distributed.
  - Phase 2: remove the one line.
  - Phase 3: remove the appended block.
- **One irreversibility to be aware of, and why it is avoided.** `enableCookieEncryption` is
  the only fuse in this set whose effect is a one-way transition. It is deliberately excluded,
  so no part of this plan is irreversible.

## Testing strategy

This repo has `*.test.js` files compiled into `dist/lib/` but no test runner wired into any
npm script and no CI. Adding either is outside this workstream. The strategy is therefore
honest about what it is: manual verification against the acceptance criteria, plus one
self-checking build step.

- **Phase 1 — manual, integration level only.** A fuse's effect exists only in a packaged
  binary, so there is no unit to test. `npx electron-fuses read` is the direct assertion that
  the intended bits are set; the three escape-hatch attempts are the behavioural proof that
  the bits do what is wanted. Both are recorded in the acceptance criteria above so they can
  be re-run after any future `electron` or `electron-builder` upgrade.
- **Phase 2 — manual, two environments.** The only meaningful test is the dev-versus-packaged
  pair. Testing one without the other proves nothing, because the whole change is a
  conditional on `app.isPackaged`.
- **Phase 3 — self-testing by construction.** The guard is itself the regression test for
  source maps, and it runs on every build from the moment it lands. What still needs a human
  once is the proof that it can fail, and that it can fail for each of the three
  compilations, which is why criteria 19 to 21 exist. If a later workstream
  ever adds a test runner, `findSourceMaps` is a pure function over a directory tree and would
  be the natural first unit test — a pointer for a future `write-tests` pass, not work for
  this plan.

**Non-functional notes, kept proportional.** There is no performance concern: fuses are a
package-time byte flip, `devTools` is a boolean, and the guard walks a directory tree of a few
dozen files once per build. There is no new observability need either — each change surfaces
itself in the console output of the command that applies it (`executing @electron/fuses`, the
guard's own line), and there is no runtime path to instrument.

## Open questions

The scan-root question that stood here in the first draft is settled: the guard scans all of
`dist/`. See "Decisions taken" above for the reasoning and Design section 3 for the shape.

1. **How are the Linux and Windows builds verified?** Criteria 6 to 11 are macOS commands run
   on this machine. `npm run package:linux` and `npm run package:win` cannot be verified here.
   Options: (a) treat them as verified on the next run on a machine that can build them;
   (b) verify Linux under a container now. Recommendation: (a), matching how WS-60 handled the
   same limitation. Note that `resetAdHocDarwinSignature` is macOS-only and so carries no risk
   for the other two platforms.
2. **`build.files: "dist/**/*"` currently ships this project's compiled unit tests** —
   `dist/lib/*.test.js`, 16 files — inside the packaged app. This is a real finding from this
   workstream's investigation and it is adjacent to the source-map concern, since both are
   about what the unfiltered glob lets through. It is explicitly **not** one of the three
   named hardening steps and this plan does not task it. Raised here only so it is not lost.
3. **Does the README need a line about any of this?** The "Packaged builds" section documents
   the unsigned state in detail, and Phase 1 interacts with that state through
   `resetAdHocDarwinSignature`. Options: (a) no README change, keeping this plan to the three
   named files; (b) one sentence added to that section. Recommendation: (a) for this plan, and
   let WS-63 rewrite that section properly when signing lands.

## Alternatives considered and rejected

- **An `afterPack` hook calling `context.packager.addElectronFuses` by hand.**
  `platformPackager.js:305-312` documents this as the supported route for custom fuse logic or
  for pinning a different `@electron/fuses` version. Rejected: it needs a new JavaScript file
  and a new `build.afterPack` entry to achieve exactly what five lines of declarative JSON
  already achieve. The declarative key is the convention the installed tooling offers, and
  there is no custom logic to express.
- **Omitting `resetAdHocDarwinSignature` and hoping electron-builder's own ad-hoc signing
  covers it.** Rejected: the fuse flip happens immediately before the sign step
  (`platformPackager.js:252-256`), and with no identity declared in `build.mac` there is no
  reliable repair of the signature the flip just broke. On Apple Silicon that can mean a
  bundle that will not launch. The cost of including the key is one line; the cost of being
  wrong is a broken build.
- **A separate `tools/check-no-source-maps.mjs` wired into the `build` script.** Rejected:
  it adds a file and a chain link to do work that belongs in the step that already runs last,
  already knows `repoRoot` (`copy-assets.mjs:8`), and already runs on every path into
  packaging.
- **Excluding maps in `build.files` with a negated glob such as `!dist/**/*.map`.** Rejected
  for two reasons. It fails quietly: a tsconfig regression would keep producing maps and the
  packaging step would keep dropping them, so nobody would ever learn the setting was flipped.
  And it means editing `build.files`, which drags in the out-of-scope test-file question
  (Open question 2).
- **Scanning `dist/public` only, as the workstream brief worded it.** Rejected: the same code
  with a shorter path covers only one of the three compilations. A `sourceMap: true` in the
  root `tsconfig.json` or in `electron/tsconfig.json` would ship maps from `dist/`,
  `dist/lib/`, `dist/scripts/` or `dist/electron/` and the narrower scan would report a clean
  build. A guard with a known blind spot is worse than none, because it is trusted.
- **Deleting any `.map` found, rather than throwing.** Rejected for the same quiet-failure
  reason. A guard that cleans up after a mistake removes the only signal the mistake happened.
- **`enableCookieEncryption: false`, stated explicitly for completeness.** Rejected: the app
  has no cookies to encrypt, and writing the key at all invites a future reader to flip it,
  which is a one-way transition. Absent is the honest state.
- **Doing all three edits as one commit.** Rejected: Phase 1 is the only one with a real
  chance of producing a non-launching build, and folding it in with two trivial edits would
  make a revert coarser than it needs to be.

## Final summary

Three independent one-file edits: a five-key `build.electronFuses` block in `package.json`,
`devTools: !app.isPackaged` in `electron/main.cts`, and a throwing `.map` scan of the whole
`dist/` tree at the end of `tools/copy-assets.mjs`. Three phases, riskiest first, roughly one
medium plus two small — comfortably one sitting each.

Top risks:

1. The mac arm64 build fails to launch after the fuse flip. `resetAdHocDarwinSignature: true`
   is included to prevent this, and criterion 7 is the check. A one-file revert fixes it.
2. Linux and Windows builds cannot be verified on this machine (Open question 1).
3. The source-map guard is only as good as its failing-direction test. Criteria 19 to 21
   exercise all three tsconfigs on purpose; proving only the `src/public` case would leave
   the widened scan root unproven.

Needs your answer: how to verify the non-mac builds (1), and whether the README gets a line
(3). Question 2 is a flagged finding only — it is out of this plan's scope and nothing here
will act on it. The scan-root question from the first draft is settled: the guard scans all
of `dist/`.
