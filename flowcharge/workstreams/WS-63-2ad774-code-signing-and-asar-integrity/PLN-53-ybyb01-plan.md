---
id: PLN-53-ybyb01
type: plan
workstream: WS-63-2ad774
slug: code-signing-and-asar-integrity
title: "Enable the ASAR integrity fuses and wire dormant signing config"
status: done
created: 2026-08-22
updated: 2026-08-22
depends_on: []
links: []
---

# Enable the ASAR integrity fuses and wire dormant signing config

## Summary

`package.json` gets five new keys, in three blocks of the existing `build` object.

Two of them are live today. `build.electronFuses.enableEmbeddedAsarIntegrityValidation: true`
and `build.electronFuses.onlyLoadAppFromAsar: true` make the packaged app refuse to run a
tampered or a replaced `app.asar`. This works with no certificate, because the hash manifest
the fuse reads is already written into every build this repository produces today. This plan
verified that directly: the current unsigned build at
`release/mac-arm64/Praxis Board.app/Contents/Info.plist` already carries an
`ElectronAsarIntegrity` dictionary with a SHA256 hash of `Resources/app.asar`. Nothing
consumes it yet. The fuse is what starts consuming it.

Three of them are dormant. `build.mac.hardenedRuntime: true`, `build.mac.notarize: true`, and
`build.win.signtoolOptions.rfc3161TimeStampServer` are each either the installed default or
an unreachable code path while no signing identity exists. They change no byte of today's
output. They exist so that the day a real certificate arrives, the only remaining action is
setting environment variables — no config design decision is left to make under time pressure.

No certificate, no Apple enrolment, and no credential is required to build or to verify any
task in this plan. No dependency is added. No runtime code changes. `electron-builder`
26.15.3, `app-builder-lib` 26.15.3, `@electron/fuses` 1.8.0 and `electron` 43.4.0 are the
installed versions this plan was written against, all confirmed from `node_modules`.

This plan implements nothing.

## Scope

### Acceptance criteria

**Configuration**

1. `package.json` has exactly one `build.electronFuses` object, and it contains
   `enableEmbeddedAsarIntegrityValidation: true` and `onlyLoadAppFromAsar: true`.
2. If WS-61's five fuse keys are present when this work runs, they are unchanged and still
   present afterwards. If they are absent, this plan does not author them. `git diff` shows
   only the two keys this plan owns being added to the fuse object.
3. `build.mac` contains `hardenedRuntime: true` and `notarize: true`.
4. `build.win` contains `signtoolOptions` holding exactly one key,
   `rfc3161TimeStampServer: "http://timestamp.digicert.com"`.
5. No `identity`, `entitlements`, `entitlementsInherit`, `certificateFile`,
   `certificatePassword`, `certificateSubjectName`, `certificateSha1`, `publisherName`,
   `azureSignOptions`, or `forceCodeSigning` key appears anywhere in `package.json`.
   `grep -iE '"identity"|entitlements|certificate|publisherName|azureSign|forceCodeSigning' package.json`
   returns nothing.
6. No credential, password, Apple ID, team ID, or token appears in `package.json`.
7. `package.json` is still valid JSON. `node -e 'JSON.parse(require("fs").readFileSync("package.json","utf8"))'`
   exits 0.
8. `electron-builder` accepts the config. No `Invalid configuration object` error appears when
   a `package:*` script runs. Every one of the five keys is schema-valid, which matters
   because `app-builder-lib/scheme.json` sets `additionalProperties: false` on the root and on
   `MacConfiguration`, `WindowsConfiguration`, `WindowsSigntoolConfiguration` and
   `FuseOptionsV1`.
9. `git diff --name-only` lists exactly one file: `package.json`. Nothing under `electron/`,
   `src/` or `tools/` is touched.
10. The `scripts` and `devDependencies` blocks of `package.json` are byte-identical to their
    current content.

**Build behaviour is unchanged where it should be**

11. `npm run package:mac` exits 0 with no certificate present and no `CSC_*`, `WIN_CSC_*` or
    `APPLE_*` variable in the environment.
12. The `package:mac` log contains no notarization step and no `InvalidConfigurationError`.
    Signing is still skipped silently, exactly as today.
13. `release/` still holds the same four macOS installers as today: the `dmg` and the `zip` for
    `x64` and for `arm64`.
14. `npm run build`, `npm start`, `npm run refresh` and `npm run electron:dev` behave exactly
    as before. Fuses apply to packaged output only, so `electron:dev` is untouched.

**The integrity fuses actually work**

15. `npx electron-fuses read --app "release/mac-arm64/Praxis Board.app"` reports
    `EnableEmbeddedAsarIntegrityValidation` and `OnlyLoadAppFromAsar` as enabled.
16. The freshly packaged app launches normally and renders the board. This is the criterion
    that proves the fuses did not break the ordinary path.
17. Tamper test. On a **copy** of the packaged `.app`, append any byte to
    `Contents/Resources/app.asar`, then launch the copy. The app refuses to start. Repeating
    the same edit on a build made before this change starts normally.
18. Replacement test. On a second **copy**, delete `Contents/Resources/app.asar` and put an
    unpacked `app/` directory beside it holding a minimal `package.json` and `main.js`. The
    app refuses to start. This is what `onlyLoadAppFromAsar` buys, and it fails without it.

Criteria 15 to 18 are macOS-only in this pass. See Open question 3 for Windows.

### Out of scope

- Obtaining an Apple Developer Program enrolment, a Developer ID Application certificate, an
  OV Windows certificate, or an Azure Trusted Signing account. This is a manual, external
  action tracked in Praxis-Business, `strategy/04-pre-launch-checklist.md`, row 17. See
  assumption A1.
- Setting any real credential, in the repository or in an environment. No task here needs one.
- `mac.identity`, including `identity: "-"` ad-hoc signing.
- `mac.entitlements` and any entitlements plist file. None is created, so none is referenced.
- `forceCodeSigning`.
- `win.azureSignOptions`, and every `win.signtoolOptions` key other than
  `rfc3161TimeStampServer`.
- Linux. `electron-builder` does not sign Linux output, so there is nothing to configure.
- CI, CI secrets, and a macOS runner.
- Removing `resetAdHocDarwinSignature` from WS-61's fuse block. See the note in Design.
- Authoring or editing WS-61's five fuse keys.
- WS-62's renderer bundling and WS-64's bytenode work. This plan does not read, edit, or
  depend on their files.
- Any edit to `README.md`. See Open question 1.
- Any change to `src/`, `electron/`, `tools/`, or the build scripts.

### Assumptions

- **A1 — Certificate acquisition is a tracked external dependency, not a blocker.** It is
  already recorded in Praxis-Business's pre-launch checklist. This plan records it and moves
  on. Every task below is buildable and verifiable today, with no certificate.
- **A2 — WS-61's fuse block may or may not have landed when this work starts.** It had not
  landed when this plan was written: `package.json` contains no `electronFuses` key, and
  `git log -- package.json` shows the last change is "Add x64 to the Windows packaging
  target". Both orderings are handled in Design. This plan never removes or rewrites a WS-61
  key, and never creates a second `electronFuses` object.
- **A3 — `asar` stays on.** It is unset in `package.json` and therefore defaults to `true`.
  Both fuses depend on that. If a future change sets `asar: false`, both fuses must come out
  in the same change or the packaged app will not start.
- **A4 — Nothing rewrites `app.asar` after packaging.** No post-package step exists today. A
  future step that edits the archive after `electron-builder` computes the hash would break
  every build. This is a live constraint for WS-62 and WS-64 to respect, not a task here.
- **A5 — No release or deployment constraint applies.** The app is private, closed-source,
  unsigned, installed by hand on the author's own machines. There are no live users and no
  release train. The change is one commit and the app stays shippable at every point. This is
  the question the plan-feature gate would normally ask; it is answered here rather than
  asked.
- **A6 — "Dormant but ready" means environment variables only.** Every credential this
  configuration will ever need is delivered by environment variable, never by a committed
  value. `package.json` holds shape, never secrets.
- **A7 — A packaged macOS build can be produced on the machine doing this work.** `release/`
  already holds macOS output, so this is established. Windows and Linux packaging are not
  available on a plain macOS host, which drives Open question 3.

## Design

### The change

Three edits to `package.json`, all inside the existing `build` object.

**1. The fuse keys.**

```json
"enableEmbeddedAsarIntegrityValidation": true,
"onlyLoadAppFromAsar": true
```

If `build.electronFuses` already exists (WS-61 landed), add these two keys to it. Insert them
after `enableNodeCliInspectArguments`, which is where `FuseOptionsV1` declares them in
`app-builder-lib/out/configuration.d.ts`. Key order has no functional effect; matching the
declared order just keeps the object readable. The resulting object is:

```json
"electronFuses": {
  "runAsNode": false,
  "enableNodeOptionsEnvironmentVariable": false,
  "enableNodeCliInspectArguments": false,
  "enableEmbeddedAsarIntegrityValidation": true,
  "onlyLoadAppFromAsar": true,
  "grantFileProtocolExtraPrivileges": false,
  "resetAdHocDarwinSignature": true
}
```

If `build.electronFuses` does not exist (WS-61 has not landed), create it holding **only**
this plan's two keys, as a new key of `build`:

```json
"electronFuses": {
  "enableEmbeddedAsarIntegrityValidation": true,
  "onlyLoadAppFromAsar": true
}
```

Do not author WS-61's five keys in that case. A partially specified fuse object is safe:
`platformPackager.js` builds the `@electron/fuses` config key by key and skips any entry that
is `null` or `undefined`, so unnamed fuses keep their Electron defaults.

**The anchor rule for whoever makes this edit.** Read `package.json` first and branch on what
is actually there. Anchor on the `electronFuses` object as a whole, or on the
`enableNodeCliInspectArguments` line, never on a line number. WS-60's `publish` block may also
have landed by then, which shifts the tail of the file.

**2. The macOS keys**, added to the existing `build.mac` block beside `target`:

```json
"hardenedRuntime": true,
"notarize": true
```

**3. The Windows key**, added to the existing `build.win` block beside `target`:

```json
"signtoolOptions": {
  "rfc3161TimeStampServer": "http://timestamp.digicert.com"
}
```

That is the whole change. `build.linux` is not touched.

### Why the integrity fuse is worth enabling with no certificate

This is the finding that decides the shape of the plan, and it was verified in this
repository rather than assumed.

The hash manifest already exists. `platformPackager.js:226-227` calls `computeData(...)`
whenever `asarOptions` is non-null and neither `options.disableAsarIntegrity` nor
`config.disableAsarIntegrity` is set. All three conditions already hold here: `asar` is unset
and defaults to `true`, and neither disable flag appears anywhere in `package.json`. The
proof is in the existing build. Running

```bash
/usr/libexec/PlistBuddy -c "Print :ElectronAsarIntegrity" \
  "release/mac-arm64/Praxis Board.app/Contents/Info.plist"
```

on the current, unsigned, pre-change build prints a dictionary mapping
`Resources/app.asar` to a SHA256 hash. That build is ad-hoc, linker-signed, with
`Info.plist=not bound` and `Sealed Resources=none` — in other words, `electron-builder`
signing was skipped entirely, and the manifest was written anyway. Manifest writing sits on
the packaging path, not on the signing path.

So the fuse is not a placeholder waiting for a certificate. Flipping it today produces a
packaged app that reads that hash at load time and refuses a modified `app.asar`. What a
signature adds later is trust in the manifest itself: unsigned, an attacker who rewrites
`app.asar` can also rewrite the hash in `Info.plist` and the check passes. Signing makes the
manifest tamper-evident. It is not what makes the check run.

The honest framing, consistent with the source-hardening consultation this workstream came
from: this raises the cost of tampering. It is not a security boundary. Today it stops a
careless edit and forces a deliberate one. After signing, it forces a deliberate edit that
also breaks the signature.

### Why `onlyLoadAppFromAsar` is enabled in the same change

Without it, the integrity fuse has an open side door, and it is not subtle.

Electron's app search order is `app.asar`, then `app`, then `default_app.asar`. Integrity
validation only applies to the first. An attacker does not need to defeat the hash check: they
delete `app.asar` and drop an unpacked `app/` directory beside it. Electron then loads the
second entry, no archive is involved, and the fuse never fires. `onlyLoadAppFromAsar` reduces
the search to the single entry `app.asar`, which is why the `FuseOptionsV1` documentation says
that combined with `embeddedAsarIntegrityValidation` it makes it "impossible to load
non-validated code".

Enabling one without the other is the worst of the three options: it costs the same and
protects against strictly less. This plan therefore treats the two as one change, verified by
one pair of tests (criteria 17 and 18).

The risk of enabling it here is low and specific. It breaks a build that ships an unpacked
`app/` directory instead of an archive. This repository ships neither: `build.files` is
`["dist/**/*", "package.json"]`, there is no `asarUnpack` key, and no `extraResources`. It is
not a one-way transition — that property belongs only to `enableCookieEncryption`, which this
plan does not touch — and fuses are burned into packaged output, not into the source tree, so
a revert plus a repackage fully undoes it.

### Why `mac.notarize: true` is safe, and what it actually does

`macPackager.js`'s `sign()` returns `false` at `if (!identity) { return false; }`, and
`notarizeIfProvided(appPath)` is called several lines later, inside the same function. With no
identity in the keychain and no `CSC_*` variable, `findSigningIdentity` returns nothing, the
function returns early, and notarization is never reached. That is why the key cannot change
today's build.

Two things are worth stating plainly rather than glossing.

First, in this installed version `notarizeIfProvided` only short-circuits on
`notarize === false`. It does not require `notarize === true`. So `notarize: true` is
behaviourally identical to leaving the key out, today and after a certificate lands. The key
is documentation, not a switch.

Second, that is precisely why it is worth writing. `package.json` is strict JSON and cannot
hold a comment, and `additionalProperties: false` on `MacConfiguration` rejects a `_comment`
key outright. The config block is the only place inside `package.json` where the intent
"this app is meant to be notarized" can be recorded. Writing an explicit `true` also protects
the intent if the default ever inverts in a future major version. This mirrors the reasoning
WS-60 used for `releaseType` and `publishAutoUpdate`.

`mac.hardenedRuntime: true` is added on the same grounds. It is already the installed default
per the `@default true` annotation on `MacConfiguration.hardenedRuntime`, so it changes
nothing, and it is a prerequisite of notarization that no future editor should have to
rediscover.

### The partial-credential trap — an operational note for the future signer

This is recorded here because it cannot be recorded in `package.json`, and because the person
it is aimed at is a future actor, not the person executing this plan.

`MacTargetHelper.getNotarizeOptions` accepts exactly three credential sets and throws
`InvalidConfigurationError` on any partial one:

1. `APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD` + `APPLE_TEAM_ID`. Setting any one of the three
   makes the other two mandatory. `APPLE_ID` alone throws `APPLE_TEAM_ID env var needs to be
   set`.
2. `APPLE_API_KEY` + `APPLE_API_KEY_ID` + `APPLE_API_ISSUER`. Same rule — setting any one
   makes all three mandatory. The `MacConfiguration.notarize` documentation recommends this
   set over set 1 for security reasons.
3. `APPLE_KEYCHAIN_PROFILE`, optionally with `APPLE_KEYCHAIN`. This one has no partial form.

If none of the three is present but signing succeeded, the build logs
`skipped macOS notarization` as a warning and continues. It does not fail.

This cannot fire today, because notarization is unreachable with no identity. It becomes live
the moment a certificate lands. The rule for whoever lands it: set a complete set or set
nothing. Half a set turns a working build into a hard failure.

The macOS certificate itself arrives through `CSC_LINK` and `CSC_KEY_PASSWORD`, or through
`CSC_NAME` for an identity already in the keychain. The Windows certificate arrives through
`WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`, falling back to `CSC_LINK` and `CSC_KEY_PASSWORD`.

### Why the Windows block gets a timestamp server and nothing else

`win.signtoolOptions.rfc3161TimeStampServer` is documented with
`@default http://timestamp.digicert.com`. Writing that exact value is a deliberate no-op: it
is the value already in use, it is a public and free RFC3161 service needing no account, and
it is inert without a certificate because `windowsSignToolManager.js:156` logs
`no signing info identified, signing is skipped` at debug level and returns `false` before any
timestamp server is consulted. The real signer can keep it or replace it with their
certificate authority's own service in one line.

The old flat `win.certificateFile` and `win.certificateSubjectName` keys no longer exist at
the top level in 26.x. They live under `win.signtoolOptions`, so creating that object now also
records where the next editor has to look.

**`win.azureSignOptions` is not added.** `WindowsAzureSigningConfiguration` declares
`publisherName`, `endpoint` and `certificateProfileName` as non-optional. There is no valid
empty or partial form, so it cannot be stubbed. It is also mutually exclusive with
`signtoolOptions`: setting both logs a warning and Azure wins. Choosing between Azure Trusted
Signing and an OV certificate is a decision that belongs with whoever buys one. See Open
question 2.

**`win.signtoolOptions.publisherName` is not added either**, and this plan disagrees with the
investigation's tentative "probably safe" reading. Safety is not the issue — the issue is that
the value must match the common name on the certificate exactly, and its documented default
is to be read from the certificate itself. A placeholder there is not inert, it is wrong: it
would be a committed claim about a certificate that does not exist, and its only symptom would
appear much later, as a signature verification mismatch that is tedious to trace. Omitting the
key means the correct value is derived automatically. There is no dormant benefit to trade
against that.

### `resetAdHocDarwinSignature` — resolving WS-61's open question

WS-61 sets `resetAdHocDarwinSignature: true` and asks what happens once real signing lands.
This plan does not change the key, but it can answer the question, since the answer came out
of the same investigation.

**No conflict, and no removal is required.** In `@electron/fuses` 1.8.0, the ad-hoc reset only
runs against `.app` bundles, so it is macOS-only. `platformPackager.js` runs
`doAddElectronFuses` at line 252 and `doSignAfterPack` at line 255, under the comment "the
fuses MUST be flipped right before signing". With a real identity the sequence is therefore:
flip fuses, ad-hoc re-sign, then real `codesign` overwrites the ad-hoc signature. The real
signature is last and is what ships. `electron-builder`'s own type documentation says the key
"should be unneeded since electron-builder signs the app directly after flipping the fuses" —
redundant, not harmful.

Two caveats to carry forward, neither of which is a task while no certificate exists:

1. It is not free. It spawns an extra full-bundle `codesign --deep` pass on every macOS build,
   and it throws a hard error if that ad-hoc codesign fails.
2. If real signing were ever silently skipped later — a broken `CSC_LINK` in some future CI
   run, for instance — the shipped app would carry an ad-hoc signature. That reads as less
   obviously wrong in a review than a plainly unsigned app does, which makes the failure
   quieter than it should be.

**This plan's judgment: once real signing is verified working, removing the key becomes
worthwhile cleanup, but it is not required for correctness.** It is deliberately not tasked
now, because it depends on a signing setup that does not exist and cannot be verified.

### Principles check

- **YAGNI.** Only keys that are either functional today or provably inert. No entitlements
  file, no Azure block, no CI, no script.
- **Least privilege.** No credential in the repository. Every secret stays an environment
  variable, supplied by the person who owns it.
- **Configuration safety.** Nothing added can turn a passing build into a failing one.
  `forceCodeSigning` is the one key that would, and it is refused.
- **Least surprise.** The two fuses change runtime behaviour, so they get direct tamper and
  replacement tests rather than an assurance.
- **Reversibility.** Every key can be deleted and the next build returns to today's output.
  Neither fuse is a one-way transition.

## Staged task breakdown

Three phases, riskiest first. Phase 1 carries all of the behaviour change; phases 2 and 3 are
inert by construction. Each phase leaves the repository packageable.

### Phase 1 — The ASAR integrity fuses (medium)

**Build.** Read `package.json`. If `build.electronFuses` exists, add
`enableEmbeddedAsarIntegrityValidation: true` and `onlyLoadAppFromAsar: true` to it after
`enableNodeCliInspectArguments`, leaving every existing key untouched. If it does not exist,
create `build.electronFuses` holding only those two keys, and do not author WS-61's keys.

**Files touched:** `package.json` only.

**Effort:** medium. The edit is small; the verification is not.

**Dependencies:** none. Interleaves with WS-61 in either order.

**Verify:**
1. `node -e 'JSON.parse(require("fs").readFileSync("package.json","utf8"))'` exits 0.
2. `git diff package.json` shows exactly two added lines inside `electronFuses`, or one new
   two-key object. No WS-61 key is modified.
3. `grep -c '"electronFuses"' package.json` returns `1`.
4. Before repackaging, keep a copy of the current `release/mac-arm64/Praxis Board.app` as the
   pre-change control for step 9.
5. `npm run package:mac` exits 0 with no `CSC_*` and no `APPLE_*` variable set. No
   `Invalid configuration object` error appears.
6. The log contains an `executing @electron/fuses` line for each packaged architecture.
7. `npx electron-fuses read --app "release/mac-arm64/Praxis Board.app"` reports
   `EnableEmbeddedAsarIntegrityValidation` and `OnlyLoadAppFromAsar` enabled.
8. Launch the packaged app. The board opens and renders as before.
9. Tamper test. Copy the `.app` to a scratch directory, append one byte to
   `Contents/Resources/app.asar` in the copy, and launch it. It refuses to start. Repeat the
   same edit on the pre-change control from step 4 and confirm that one still starts. Delete
   both copies afterwards.
10. Replacement test. Copy the `.app` again, delete `Contents/Resources/app.asar` from the
    copy, create `Contents/Resources/app/` holding a minimal `package.json` with a `main`
    field and a trivial `main.js`, and launch. It refuses to start. Delete the copy afterwards.
11. `npm run electron:dev` still starts and still allows DevTools. Fuses do not apply in dev.
12. `npm start` still serves the browser board.

### Phase 2 — Dormant macOS signing keys (small)

**Build.** Add `hardenedRuntime: true` and `notarize: true` to `build.mac`, beside the
existing `target` array. Add nothing else. Do not add `identity` and do not add `entitlements`.

**Files touched:** `package.json` only.

**Effort:** small.

**Dependencies:** none. Independent of phase 1.

**Verify:**
1. `node -e 'JSON.parse(...)'` exits 0.
2. `grep -iE '"identity"|entitlements' package.json` returns nothing.
3. `npm run package:mac` exits 0 with no `CSC_*` and no `APPLE_*` variable set.
4. The log shows no notarization step, no `InvalidConfigurationError`, and no new warning
   compared with the phase 1 run.
5. `codesign -dv "release/mac-arm64/Praxis Board.app"` reports the same ad-hoc, linker-signed
   state as before: signing is still skipped, not attempted and failed.
6. `release/` holds the same four macOS installers as before.
7. Launch the packaged app and confirm it still opens the board. This matters because
   `hardenedRuntime` is the key that would break launch if it were ever paired with ad-hoc
   signing, which is exactly why `identity` is refused.

### Phase 3 — Dormant Windows timestamp key (small)

**Build.** Add `signtoolOptions` to `build.win`, holding only
`rfc3161TimeStampServer: "http://timestamp.digicert.com"`.

**Files touched:** `package.json` only.

**Effort:** small.

**Dependencies:** none. Independent of phases 1 and 2.

**Verify:**
1. `node -e 'JSON.parse(...)'` exits 0.
2. `grep -iE 'certificate|publisherName|azureSign' package.json` returns nothing.
3. `npm run package:mac` exits 0 and is unaffected. This is the available proof that the
   Windows key is schema-valid, since schema validation runs on the whole config regardless of
   the target platform. A rejected key would fail this run.
4. On the next occasion `npm run package:win` can run, confirm it exits 0, that the log
   contains `no signing info identified, signing is skipped` at debug level, and that the
   `nsis` installer is produced unsigned as before. See Open question 3.

## Data & compatibility

No data model change, no API change, no schema change, no migration. `src/server.ts`,
`src/lib/extract.ts` and the payload types in `src/types/praxis-data.d.ts` are untouched.
Nothing the board reads at runtime changes.

The compatibility surface is the packaged installers themselves, and it has one real edge.

- Builds made before this change ignore the `ElectronAsarIntegrity` entry in `Info.plist` and
  will load an unpacked `app/` directory if `app.asar` is missing. Builds made after this
  change validate the archive and load nothing else.
- Both build generations run the same application code and read the same
  `.praxis-projects.json` registry, so a user can move between them freely.
- The edge: any workflow that patches a packaged app in place after `electron-builder` has
  run stops working. None exists today. It is a constraint on WS-62 and WS-64, recorded as
  assumption A4.

**Rollback.** Delete the added keys and repackage. Fuses are burned into packaged output, not
into the source tree, so the next build is unmutated. Already-distributed binaries keep their
flipped fuses, which is irrelevant here because none has been distributed. If only the fuse
change needs reverting, delete the two fuse keys and leave phases 2 and 3 in place; they are
independent.

## Testing strategy

The repository has no test framework and no `test` script, and every change here is build
configuration that only a real packaging run can exercise. Verification is therefore the
manual steps in each phase. Adding a first test harness for five JSON keys is out of
proportion and out of scope.

The steps are chosen so that each acceptance criterion has one command behind it: a JSON parse
for criterion 7, greps for criteria 5 and 6, `git diff --name-only` for criterion 9, and a full
`package:mac` run with an empty credential environment for criteria 11 to 13.

Phase 1 carries the only tests that are genuinely tests rather than checks. `electron-fuses
read` proves the fuse bits were written. It does not prove the runtime honours them, which is
why the tamper test and the replacement test both exist, and why the tamper test is run
against a pre-change control build as well. A test that only ever shows one outcome proves
nothing; running the same byte edit on both generations shows the behaviour actually changed.

Phases 2 and 3 are tested by absence: the same successful build, the same installer set, the
same skipped-signing state, no new warning. That is the whole claim being made about them.

If a build-config test is ever wanted, the natural assertions are that
`require('./package.json').build.electronFuses.onlyLoadAppFromAsar === true` and that no key
matching `/certificate|identity|entitlements/i` exists anywhere in the `build` object. That
belongs to a test-writing pass, not to this workstream.

## Open questions

1. **Should the partial-credential trap and the environment-variable sets be written into
   `README.md`?** The Context fixes this plan's file boundary at `package.json`, and
   `package.json` cannot carry a comment — `additionalProperties: false` on the root and on
   `MacConfiguration` rejects a `_comment` key, so there is no in-file channel. The note is
   recorded in this plan's Design section, which is the only place it exists today. Options:
   leave `README.md` alone and rely on this plan being found; or add a short block to the
   existing "Packaged builds" section listing the three Apple credential sets, the
   all-or-nothing rule, and the `CSC_LINK` / `WIN_CSC_LINK` delivery path. Recommendation: add
   it, as a separate and explicitly approved edit. The README already lists notarization and
   `win.signtoolOptions` as prerequisites of first distribution, so it is where a future signer
   will look, and a plan file in `flowcharge/` is not.
2. **Azure Trusted Signing or an OV certificate for Windows?** The earlier consultation named
   Azure Trusted Signing as one recommended option, and this plan cannot stub it, because
   `WindowsAzureSigningConfiguration` has three non-optional fields. So the config shape for
   Windows cannot be finished until the choice is made. Options: choose Azure now and add
   `azureSignOptions` in a later workstream once the account exists; or choose an OV
   certificate and fill in `signtoolOptions`, which this plan has already created. No action
   is needed today either way. Recommendation: defer to whoever buys the certificate, and note
   that the two are mutually exclusive — setting both logs a warning and Azure silently wins.
3. **How are the Windows and Linux paths verified?** `npm run package:win` and
   `npm run package:linux` cannot run on a plain macOS host without Wine or Docker, and
   `release/` holds only macOS artefacts today. Windows also has its own integrity-manifest
   path — the hash goes into executable resources rather than into `Info.plist` — so the fuse
   is genuinely unverified there, even though `electron` 43.4.0 is well past the `>= 30`
   requirement. Options: verify on the next real cross-platform build; set up the tooling now;
   or accept the macOS evidence and mark the Windows criteria as expected but unverified.
   Recommendation: verify on the next real build. Linux needs nothing either way, since
   `electron-builder` does not sign Linux output and the fuses are set per build, not per
   platform.
4. **Who executes the signing configuration once a certificate exists, and when?** This plan
   deliberately leaves that work unwritten, because none of it can be verified without the
   certificate. Recommendation: a follow-up workstream, opened by whoever completes row 17 of
   the Praxis-Business pre-launch checklist. Recorded so the dormant keys are not left
   orphaned.
5. **Should `resetAdHocDarwinSignature` be removed after real signing is verified?** Answered
   in Design as this plan's judgment — worthwhile cleanup, not required for correctness — and
   deliberately not tasked, since it depends on a signing setup that does not exist yet. Listed
   here so that WS-61's own open question is visibly closed rather than silently dropped.

## Alternatives considered and rejected

- **Wait for a real certificate before touching any of this, which is WS-63's original
  framing.** This was the leading candidate and it is now rejected on evidence. The framing
  rests on "integrity checking without a signature adds almost nothing", which is true of the
  *manifest's* trustworthiness and false of the *check's* operation. The hash is already in
  today's `Info.plist`, verified above. Waiting means shipping builds that carry a
  tamper-detection manifest nobody reads, for however long the certificate takes. The correct
  reading is that the fuse is worth having now and gets strictly stronger later.
- **Enable `enableEmbeddedAsarIntegrityValidation` alone and defer `onlyLoadAppFromAsar`.**
  Rejected. The deferred key is what closes the trivial bypass of deleting `app.asar` and
  dropping an unpacked `app/` beside it. Half the change costs the same and protects against
  strictly less.
- **Add `mac.identity: "-"` so builds are at least ad-hoc signed and the manifest gains some
  seal.** Rejected on two grounds. It changes today's behaviour, which the Context forbids.
  And ad-hoc signing combined with the default `hardenedRuntime: true` enforces library
  validation, which rejects the pre-signed Electron framework and can produce an app that will
  not launch. Fixing that needs a
  `com.apple.security.cs.disable-library-validation` entitlement in a plist file this plan is
  not scoped to create. An ad-hoc seal is also not a trust anchor: anyone can re-apply one.
- **Add `forceCodeSigning: true` so a future silent signing failure is loud.** Rejected. It
  converts today's silent skip into a hard build failure immediately, breaking every
  `package:*` script until a certificate exists. It is the right key to add on the day signing
  is verified working, and the wrong one today.
- **Add `mac.entitlements: "build/entitlements.mac.plist"` now, so the slot is ready.**
  Rejected. Pointing at a file that does not exist is a dangling reference, and creating the
  file means designing an entitlement set for a hardened runtime that never engages today. The
  Context is explicit: add the key only alongside the file, or not at all. Not at all.
- **Add `win.azureSignOptions` with placeholder strings.** Rejected because it cannot be done.
  `publisherName`, `endpoint` and `certificateProfileName` are all non-optional in
  `WindowsAzureSigningConfiguration`, so there is no empty or partial form, and placeholder
  values would also silently disable the `signtoolOptions` path this plan does create.
- **Add `win.signtoolOptions.publisherName` as a placeholder.** Rejected, against the
  investigation's tentative reading. The value must match the certificate's common name
  exactly, and its default is to be read from the certificate. A placeholder is a committed
  claim about a certificate that does not exist, whose only symptom surfaces much later as a
  verification mismatch. Omitting the key gets the right value for free.
- **Move the whole `build` block into `electron-builder.yml` so YAML comments can carry the
  credential note.** Rejected. It relocates configuration this plan does not own, produces a
  large diff for zero functional change, and breaks the stated `package.json`-only boundary.
  The note is better placed in the README, which is Open question 1.
- **Fold these keys into WS-61's fuse commit and land one change.** Rejected. WS-61 is already
  executing, the two sets of keys answer different questions, and the fuses here need runtime
  tamper tests that WS-61's keys do not. Separate commits also keep the revert paths separate.
- **Also remove `resetAdHocDarwinSignature` now, since the investigation shows it becomes
  redundant under real signing.** Rejected. It becomes redundant *once real signing exists and
  is verified*. Neither is true today, and removing it now would strand WS-61's Apple Silicon
  launch fix. It is recorded as a future cleanup in Design, not tasked.

## Final summary

- **Approach:** enable both ASAR integrity fuses now, because the hash manifest is already
  being written into every build this repository produces, and pair them with the three
  signing keys that are provably inert without a certificate. Refuse every key that would
  change today's build or point at something that does not exist.
- **Size:** three phases, one file, five keys. Phase 1 is medium because of its verification;
  phases 2 and 3 are small.
- **Effect today:** the packaged macOS app refuses to run a tampered or a replaced `app.asar`.
  Everything else is byte-identical: same installers, same skipped signing, same dev
  behaviour, no new dependency, no credential.
- **Effect later:** when a certificate arrives, the config needs no design work. Environment
  variables activate it, and the integrity manifest becomes tamper-evident rather than merely
  tamper-detecting.
- **Risks:** one real one, contained. The fuses change runtime behaviour, so phase 1 carries
  direct tamper and replacement tests against both a new build and a pre-change control.
  Rollback is deleting the keys and repackaging.
- **Needs a decision:** whether `README.md` gains the credential note, Azure Trusted Signing
  versus an OV certificate for Windows, and how the Windows path gets verified.
