---
id: TL-64-tpuyz6
type: tasklist
workstream: WS-63-2ad774
slug: code-signing-and-asar-integrity
title: "Enable the ASAR integrity fuses and wire dormant signing config"
status: done
created: 2026-08-22
updated: 2026-08-22
author: Anthony Koukoullis
depends_on: [PLN-53-ybyb01]
links: []
mode: spec
base_commit: 0d81cff
---

# PRX Tasks

## Enable the ASAR integrity fuses and wire dormant signing config

`package.json` gets five new keys, in three blocks of the existing `build` object. Nothing
else in the repository changes.

Two keys are live today. `build.electronFuses.enableEmbeddedAsarIntegrityValidation: true`
and `build.electronFuses.onlyLoadAppFromAsar: true` make the packaged app refuse to run a
tampered or a replaced `app.asar`. They work with no certificate, because
`electron-builder` already writes the SHA256 hash manifest into every build this repository
produces. PLN-53-ybyb01 verified that against the current unsigned build's
`Contents/Info.plist`. The fuse is what starts consuming the manifest.

Three keys are dormant. `build.mac.hardenedRuntime: true`, `build.mac.notarize: true`, and
`build.win.signtoolOptions.rfc3161TimeStampServer` are each either the installed default or
an unreachable code path while no signing identity exists. They change no byte of today's
output. They exist so that the day a real certificate arrives, only environment variables
remain to set.

No certificate, no Apple enrolment, and no credential is needed to execute or to verify any
task here. No dependency is added. No runtime code changes. The three phases are
independent and may run in any order; each leaves the repository packageable.

The plan refuses these keys deliberately, and no task may reintroduce them: `forceCodeSigning`,
`mac.identity` (including `identity: "-"`), `mac.entitlements`, `win.azureSignOptions`, any
`certificateFile` path, and `win.signtoolOptions.publisherName`.

Five items are left undecided by the plan and are therefore untasked: the `README.md`
credential-trap note (a separate, explicitly approved follow-up edit, not part of this list);
the choice between Azure Trusted Signing and an OV Windows certificate; the Windows and
Linux verification path, deferred to the next real cross-platform build; who executes the
signing configuration once a certificate exists; and whether `resetAdHocDarwinSignature` is
removed after real signing is verified.

- [x] 1. Phase 1 — The ASAR integrity fuses

  ```yaml
  description: "Add enableEmbeddedAsarIntegrityValidation and onlyLoadAppFromAsar to build.electronFuses, so the packaged app refuses a tampered or a replaced app.asar. This phase carries all of the behaviour change in the plan."
  ```

  - [x] 1.1 Add the two ASAR integrity fuse keys to `package.json`
    ```yaml
    description: "Add build.electronFuses.enableEmbeddedAsarIntegrityValidation: true and build.electronFuses.onlyLoadAppFromAsar: true, creating the electronFuses object only if it does not already exist."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Read package.json first and branch on what is actually there. Anchor on the build.electronFuses object as a whole, or on the enableNodeCliInspectArguments line. Never anchor on a line number: WS-60's publish block and WS-61's fuse block may have landed since this task was authored, and either shifts the tail of the file."
      - "Branch A — build.electronFuses already exists (WS-61 landed). Add the two keys enableEmbeddedAsarIntegrityValidation: true and onlyLoadAppFromAsar: true into that same object, immediately after enableNodeCliInspectArguments, which is where FuseOptionsV1 declares them in app-builder-lib/out/configuration.d.ts. Leave every existing key byte-identical. Do not create a second electronFuses object. Do not remove or rewrite resetAdHocDarwinSignature or any other WS-61 key."
      - "Branch B — build.electronFuses does not exist. At the base commit of this list it does not: package.json holds appId, productName, directories, files, mac, linux and win under build, and no electronFuses key. Create build.electronFuses as a new key of the build object, holding ONLY this plan's two keys. Do not author WS-61's five keys in that case; a partially specified fuse object is safe, because platformPackager.js builds the @electron/fuses config key by key and skips any entry that is null or undefined, so unnamed fuses keep their Electron defaults."
      - "Illustrative only, not literal — Branch B result: \"electronFuses\": { \"enableEmbeddedAsarIntegrityValidation\": true, \"onlyLoadAppFromAsar\": true }"
      - "Change nothing else. Do not touch build.mac, build.win, build.linux, build.files, scripts, or devDependencies in this task. Do not set asar or disableAsarIntegrity."
    pattern: "package.json only — the build.electronFuses object inside the build block. Nothing under electron/, src/ or tools/ is touched."
    imports: "No new dependency. Uses the installed electron-builder 26.15.3, app-builder-lib 26.15.3, @electron/fuses 1.8.0 and electron 43.4.0. Verification uses npx electron-fuses read, which ships with the installed @electron/fuses."
    compatibility: "app-builder-lib/scheme.json sets additionalProperties: false on FuseOptionsV1, so both key names must be spelled exactly as declared or electron-builder rejects the whole config. Both fuses require asar packing, which is on because build.asar is unset and defaults to true (assumption A3). Both fuses require electron >= 30; 43.4.0 satisfies that. Fuses apply to packaged output only, so npm run electron:dev and npm start are unaffected."
    gotcha: "WS-61 runs concurrently and may have landed its own electronFuses object first; creating a second one, or overwriting WS-61's keys, is the main failure mode — read the live file, never the plan's quoted snippet. onlyLoadAppFromAsar breaks any build that ships an unpacked app/ directory instead of an archive; this repository ships neither, since build.files is [\"dist/**/*\", \"package.json\"] with no asarUnpack and no extraResources. Neither fuse is a one-way transition — that property belongs only to enableCookieEncryption — so deleting the keys and repackaging fully reverts. Any future post-package step that rewrites app.asar after electron-builder computes the hash breaks every build (assumption A4). If a future change ever sets asar: false, both fuses must come out in the same change."
    verify:
      - "node -e 'JSON.parse(require(\"fs\").readFileSync(\"package.json\",\"utf8\"))' exits 0."
      - "grep -c '\"electronFuses\"' package.json returns exactly 1."
      - "git diff package.json shows exactly two added lines inside electronFuses, or one new two-key object. No WS-61 key is modified."
      - "git diff --name-only lists exactly one file: package.json."
      - "npm run build exits 0 — the project's own tsc type-check across its three tsconfig projects, unchanged by this edit."
      - "Before repackaging, copy the current release/mac-arm64/Praxis Board.app to a scratch directory as the pre-change control build for the tamper test below."
      - "npm run package:mac exits 0 with no CSC_* and no APPLE_* variable set. No 'Invalid configuration object' error appears."
      - "The package:mac log contains an 'executing @electron/fuses' line for each packaged architecture."
      - "npx electron-fuses read --app \"release/mac-arm64/Praxis Board.app\" reports EnableEmbeddedAsarIntegrityValidation and OnlyLoadAppFromAsar as enabled."
      - "Launch the freshly packaged app. The board opens and renders as before."
      - "Tamper test. Copy the new .app to a scratch directory, append one byte to Contents/Resources/app.asar in the copy, and launch it. It refuses to start. Repeat the same byte edit on the pre-change control build and confirm that one still starts. Delete both copies afterwards."
      - "Replacement test. Copy the new .app again, delete Contents/Resources/app.asar from the copy, create Contents/Resources/app/ holding a minimal package.json with a main field and a trivial main.js, and launch. It refuses to start. Delete the copy afterwards."
      - "npm run electron:dev still starts and still allows DevTools."
      - "npm start still serves the browser board."
    checklist:
      - "Does package.json contain exactly one electronFuses object, holding both enableEmbeddedAsarIntegrityValidation: true and onlyLoadAppFromAsar: true?"
      - "Are all pre-existing keys of electronFuses, if any were present, byte-identical to before, with resetAdHocDarwinSignature untouched?"
      - "Are the scripts and devDependencies blocks of package.json byte-identical to their pre-task content, and is package.json the only file in git diff --name-only?"
      - "Did npm run package:mac exit 0 with an empty credential environment and no Invalid configuration object error?"
      - "Does electron-fuses read report both fuses enabled on the freshly packaged arm64 app?"
      - "Did both the tamper test and the replacement test refuse to start, while the pre-change control build still started after the same tamper edit?"
    self_eval:
      passed: true
      failures:
        - item: "Tamper test as literally worded — append one byte to Contents/Resources/app.asar."
          reason: "The appended byte lies outside the hashed region. Info.plist ElectronAsarIntegrity holds the SHA256 of the 13508-byte archive header only, not of the whole file. The new build started normally after the append, so the literal edit proved nothing about the fuse."
          fix: "Used a tamper edit inside the hashed header region instead: changed one hex character of a file hash in the header JSON, keeping the JSON valid and the byte length identical. The new build then aborted with FATAL asar_util.cc:146 'Integrity check failed for asar archive entry <header>'. The pre-change control build started normally after the identical edit. The checklist item passes on that evidence."
    ```

- [x] 2. Phase 2 — Dormant macOS signing keys

  ```yaml
  description: "Add hardenedRuntime: true and notarize: true to build.mac. Both are inert with no signing identity present, and exist to record intent inside a file that cannot hold a comment."
  ```

  - [x] 2.1 Add `hardenedRuntime` and `notarize` to `build.mac` in `package.json`
    ```yaml
    description: "Add hardenedRuntime: true and notarize: true beside the existing target array in build.mac, and add nothing else."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Anchor on the build.mac object in package.json and add the two keys after its target array. Add nothing else. Do not add identity, do not add entitlements, and do not add entitlementsInherit."
      - "Apply this block. Re-anchor it against the live file if build.mac has changed since base_commit 0d81cff."
      - |
        package.json
        <<<<<<< SEARCH
            "mac": {
              "target": [
                { "target": "dmg", "arch": ["x64", "arm64"] },
                { "target": "zip", "arch": ["x64", "arm64"] }
              ]
            },
        =======
            "mac": {
              "target": [
                { "target": "dmg", "arch": ["x64", "arm64"] },
                { "target": "zip", "arch": ["x64", "arm64"] }
              ],
              "hardenedRuntime": true,
              "notarize": true
            },
        >>>>>>> REPLACE
    pattern: "package.json only — the build.mac object. build.linux and build.win are not touched in this task."
    imports: "No new dependency. No credential, Apple ID, team ID, or token is set anywhere."
    compatibility: "app-builder-lib/scheme.json sets additionalProperties: false on MacConfiguration, so both keys must be spelled exactly and no _comment key can be added. hardenedRuntime: true is already the installed default per the @default true annotation, so it changes nothing. In this installed version notarizeIfProvided only short-circuits on notarize === false, so notarize: true is behaviourally identical to omitting the key — it is documentation, not a switch."
    gotcha: "macPackager.js sign() returns false at 'if (!identity) { return false; }' before notarizeIfProvided is reached, so with no identity in the keychain and no CSC_* variable notarization is unreachable and cannot fail the build. That safety depends on identity staying absent: hardenedRuntime paired with ad-hoc signing enforces library validation, which rejects the pre-signed Electron framework and can produce an app that will not launch. This is exactly why mac.identity is refused. Once a real certificate lands, MacTargetHelper.getNotarizeOptions accepts only three complete credential sets — APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID, or APPLE_API_KEY + APPLE_API_KEY_ID + APPLE_API_ISSUER, or APPLE_KEYCHAIN_PROFILE — and throws InvalidConfigurationError on any partial one. That trap cannot fire today and is not a task here."
    verify:
      - "node -e 'JSON.parse(require(\"fs\").readFileSync(\"package.json\",\"utf8\"))' exits 0."
      - "grep -iE '\"identity\"|entitlements' package.json returns nothing."
      - "git diff --name-only lists exactly one file: package.json."
      - "npm run build exits 0 — the project's own tsc type-check, unchanged by this edit."
      - "npm run package:mac exits 0 with no CSC_* and no APPLE_* variable set."
      - "The package:mac log shows no notarization step, no InvalidConfigurationError, and no new warning compared with the previous run."
      - "codesign -dv \"release/mac-arm64/Praxis Board.app\" reports the same ad-hoc, linker-signed state as before, with Info.plist=not bound and Sealed Resources=none. Signing is still skipped, not attempted and failed."
      - "release/ holds the same four macOS installers as before: the dmg and the zip for x64 and for arm64."
      - "Launch the packaged app and confirm it still opens the board."
    checklist:
      - "Does build.mac contain hardenedRuntime: true and notarize: true, and no other new key?"
      - "Is package.json free of identity, entitlements and entitlementsInherit keys, per the grep above returning nothing?"
      - "Are the scripts and devDependencies blocks byte-identical, and is package.json the only file in git diff --name-only?"
      - "Did npm run package:mac exit 0 with an empty credential environment, producing no notarization step and no InvalidConfigurationError?"
      - "Does codesign -dv report the same skipped, ad-hoc signing state as before the edit?"
      - "Did the packaged app launch and render the board?"
    self_eval:
      passed: true
      failures:
        - item: "codesign -dv reports Info.plist=not bound and Sealed Resources=none."
          reason: "The wording did not match this repository's actual pre-change state. The control build already reported Info.plist entries=32 and Sealed Resources version=2 rules=13 files=11, because electron-builder's resetAdHocDarwinSignature fuse step re-seals the bundle ad-hoc after packaging."
          fix: "Checked the real requirement instead — that the signing state is unchanged by this edit. The post-edit codesign -dv output is byte-identical to the pre-edit control: flags=0x2(adhoc), Signature=adhoc, TeamIdentifier=not set, and no 0x10000(runtime) flag. The absent runtime flag is the direct proof that hardenedRuntime stayed inert. The checklist item passes on that evidence."
        - item: "git diff --name-only lists exactly one file: package.json."
          reason: "git diff --name-only also lists .gitignore. That modification predates this task and belongs to earlier session work; it is untracked scope, not an edit made here."
          fix: "Confirmed by git diff that package.json is the only file this task changed, and that its diff is exactly the two added lines hardenedRuntime and notarize inside build.mac. Left .gitignore untouched."
    ```

- [x] 3. Phase 3 — Dormant Windows timestamp key

  ```yaml
  description: "Add build.win.signtoolOptions holding only rfc3161TimeStampServer. The value is the documented default, so the key is inert without a certificate, and it records where the next editor has to look."
  ```

  - [x] 3.1 Add `signtoolOptions.rfc3161TimeStampServer` to `build.win` in `package.json`
    ```yaml
    description: "Add signtoolOptions to build.win holding exactly one key, rfc3161TimeStampServer set to http://timestamp.digicert.com."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Anchor on the build.win object in package.json and add signtoolOptions after its target array. The object holds exactly one key. Add no other signtoolOptions key, and do not add publisherName, certificateFile, certificatePassword, certificateSubjectName, certificateSha1 or azureSignOptions."
      - "Apply this block. Re-anchor it against the live file if build.win has changed since base_commit 0d81cff."
      - |
        package.json
        <<<<<<< SEARCH
            "win": {
              "target": [
                { "target": "nsis", "arch": ["x64", "arm64"] }
              ]
            }
        =======
            "win": {
              "target": [
                { "target": "nsis", "arch": ["x64", "arm64"] }
              ],
              "signtoolOptions": {
                "rfc3161TimeStampServer": "http://timestamp.digicert.com"
              }
            }
        >>>>>>> REPLACE
    pattern: "package.json only — the build.win object. build.mac and build.linux are not touched in this task. Linux is out of scope entirely, because electron-builder does not sign Linux output."
    imports: "No new dependency and no account. timestamp.digicert.com is a public, free RFC3161 service."
    compatibility: "app-builder-lib/scheme.json sets additionalProperties: false on WindowsConfiguration and on WindowsSigntoolConfiguration, so the nesting and the key name must both be exact. In electron-builder 26.x the old flat win.certificateFile and win.certificateSubjectName keys no longer exist at the top level; they live under win.signtoolOptions, which is why creating that object now records where the next editor has to look. http://timestamp.digicert.com is the documented @default value, so writing it is a deliberate no-op."
    gotcha: "windowsSignToolManager.js:156 logs 'no signing info identified, signing is skipped' at debug level and returns false before any timestamp server is consulted, so the key cannot affect a build with no certificate. win.azureSignOptions is refused because WindowsAzureSigningConfiguration declares publisherName, endpoint and certificateProfileName as non-optional, so it has no valid partial form, and it is mutually exclusive with signtoolOptions — setting both logs a warning and Azure silently wins. win.signtoolOptions.publisherName is refused because its value must match the certificate's common name exactly and its default is read from the certificate itself; a placeholder would be a committed claim about a certificate that does not exist, surfacing much later as a signature verification mismatch."
    verify:
      - "node -e 'JSON.parse(require(\"fs\").readFileSync(\"package.json\",\"utf8\"))' exits 0."
      - "grep -iE 'certificate|publisherName|azureSign' package.json returns nothing."
      - "grep -iE '\"identity\"|entitlements|certificate|publisherName|azureSign|forceCodeSigning' package.json returns nothing — the plan's whole-file exclusion check, run once all three phases have landed."
      - "git diff --name-only lists exactly one file: package.json."
      - "npm run build exits 0 — the project's own tsc type-check, unchanged by this edit."
      - "npm run package:mac exits 0 and is unaffected. This is the available proof that the Windows key is schema-valid, because schema validation runs on the whole config regardless of the target platform, so a rejected key would fail this run."
      - "Deferred to the next real cross-platform build, per Open question 3 — npm run package:win cannot run on a plain macOS host without Wine or Docker. On the next occasion it can run, confirm it exits 0, that the log contains 'no signing info identified, signing is skipped' at debug level, and that the nsis installer is produced unsigned as before."
    checklist:
      - "Does build.win.signtoolOptions exist and hold exactly one key, rfc3161TimeStampServer set to http://timestamp.digicert.com?"
      - "Is package.json free of every certificate, publisherName, azureSignOptions and forceCodeSigning key, per the greps above returning nothing?"
      - "Are the scripts and devDependencies blocks byte-identical, and is package.json the only file in git diff --name-only?"
      - "Did npm run package:mac still exit 0, proving electron-builder accepted the new Windows key?"
      - "Is build.linux unchanged?"
      - "Is the deferred npm run package:win check recorded as outstanding rather than claimed as passed?"
    self_eval:
      passed: true
      failures:
        - item: "The SEARCH block as literally worded — build.win closing brace with no trailing comma."
          reason: "WS-60's publish block landed after this list was authored, so build.win is no longer the last key of build. The live closing line reads `},` and the literal SEARCH text is absent."
          fix: "Re-anchored the block against the live file, as the task's own implement step directs. The added text is byte-identical to the REPLACE side, with the pre-existing trailing comma preserved. No other line changed."
        - item: "git diff --name-only lists exactly one file: package.json."
          reason: "git diff --name-only also lists .gitignore. That modification predates this task and belongs to earlier session work; it is untracked scope, not an edit made here."
          fix: "Confirmed by git diff that package.json is the only file this task changed, and that its diff is exactly the four added lines of the signtoolOptions object inside build.win. Left .gitignore untouched."
        - item: "npm run package:win — deferred cross-platform build check."
          reason: "This macOS host has no Wine and no wine64 on PATH, so electron-builder cannot produce Windows output. The task already defers this check under Open question 3."
          fix: "Recorded as outstanding, not claimed as passed. Schema acceptance of the new Windows key is proved instead by npm run package:mac exiting 0, because electron-builder validates the whole config regardless of target platform."
    ```
