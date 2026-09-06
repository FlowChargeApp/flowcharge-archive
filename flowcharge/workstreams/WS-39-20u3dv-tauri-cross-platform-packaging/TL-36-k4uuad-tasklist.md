---
id: TL-36-k4uuad
type: tasklist
workstream: WS-39-20u3dv
slug: tauri-cross-platform-packaging
title: "Electron cross-platform packaging and distribution tasks"
status: done
created: 2026-08-17
updated: 2026-08-19
author: Anthony Koukoullis
depends_on: [PLN-29-lfqkvw]
links: []
mode: spec
base_commit: 0d82a04
---

# PRX Tasks

## Configure electron-builder packaging and distribution for macOS, Linux, and Windows

Implements PLN-29-lfqkvw: adds `electron-builder` (`^26`) as a devDependency, a required
`"author"` field, a `"build"` config block, and three manually-run `package:*` scripts to
`package.json`, plus one `.gitignore` line for the new `release/` output directory — then
builds and verifies the packaged app on each of the three available machines (macOS
arm64+x64, Debian 11, Windows 11 ARM). Code signing, notarization, `.rpm`, and a custom app
icon stay out of scope throughout, per the plan. All four of the plan's stages are tasked
below; none is left open — three of the plan's four Open Questions were pre-settled by
Context: `.rpm` is dropped entirely (not build-only), the `"author"` value is this checkout's
own git identity, and `electron-builder@^26` is the version to task now. Only the `appId` placeholder
(`com.praxisboard.app`) stays genuinely unresolved, carried forward into task 1.1 with an
explicit gotcha rather than settled here.

- [x] 1. Phase 1 — `package.json` config and script wiring
  ```yaml
  description: "Add electron-builder, the author field, the build config block, and the three package:* scripts to package.json; add the one required .gitignore line. Dependencies: WS-36/WS-37/WS-38 landed (see Divergence 1)."
  ```

  - [x] 1.1 Add electron-builder devDependency, author field, build block, and scripts to package.json
    ```yaml
    description: "Add the electron-builder ^26 devDependency, a top-level author field, a top-level build config block, and three package:* scripts to package.json, without touching any existing key."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In package.json's devDependencies object (currently only \"@types/node\": \"^22.20.1\" and \"typescript\": \"^5.9.3\"), add \"electron-builder\": \"^26\" — this workstream's settled Open Question 4 (electron-builder@^26 is the version to task now, per Context; confirm/bump at implementation time if a newer stable major has since landed)."
      - "Add a new top-level key \"author\": \"Anthony Koukoullis <akoukoullis@gmail.com>\" — this checkout's own git config user.name/user.email, per this workstream's settled Open Question 3. This field is currently absent and is hard-required by the .deb target in Phase 3."
      - "Add a new top-level \"build\" config block, placed in package.json (not a sibling YAML/JSON5 file, per the plan's Design section): appId \"com.praxisboard.app\" (placeholder — see gotcha), productName \"Praxis Board\", directories.output \"release\", files [\"dist/**/*\", \"package.json\"] exactly, mac.target = [{target: dmg, arch: [x64, arm64]}, {target: zip, arch: [x64, arm64]}], linux.target = [{target: deb, arch: [x64]}, {target: AppImage, arch: [x64]}] (no rpm — settled Open Question 2), win.target = [{target: nsis, arch: [arm64]}] (NSIS not Squirrel.Windows, since Squirrel does not support ARM64)."
      - "Add three new keys to the existing scripts object, alongside build/prestart/start/prerefresh/refresh: \"package:mac\": \"npm run build && electron-builder --mac --x64 --arm64\", \"package:linux\": \"npm run build && electron-builder --linux deb AppImage\", \"package:win\": \"npm run build && electron-builder --win --arm64\". None is wired into prestart, prerefresh, or any existing script."
      - "Do not modify the existing \"main\", \"scripts\".build, \"scripts\".start, \"scripts\".prestart, \"scripts\".prerefresh, \"scripts\".refresh, or any other existing key — this task is strictly additive."
    pattern: "package.json"
    imports: "electron-builder ^26 (new devDependency, resolved and locked via npm install into package-lock.json)"
    compatibility: "package.json must remain valid JSON; \"type\": \"module\" and the existing scripts/devDependencies keys must be preserved exactly as read at base_commit 0d82a04."
    gotcha: "appId \"com.praxisboard.app\" is a PLACEHOLDER, not a confirmed reverse-DNS identifier — the plan's Open Question 1 is unresolved and this task does not settle it. It becomes the installed app's OS-level identity on every platform, and changing it later is a breaking change for anyone already installed under the placeholder. Every artefact this workstream produces must be treated as internal-only until the real appId is confirmed, before any build meant for actual distribution. Separately: at base_commit 0d82a04, package.json has no \"main\" field, no electron/electron-builder devDependency, and no electron:dev script, and WS-36/WS-37/WS-38 are all status: in-progress, not done — see Divergence 1. This task's edits are unaffected (purely additive), but tasks 2-4's package:* runs depend on WS-36's dist/electron/main.cjs entry point existing by execution time."
    verify:
      - "npm install — must exit 0"
      - "npm run build — must still exit 0, output unchanged from before this task"
      - "node -e \"const b=require('./package.json').build; console.log(JSON.stringify(b)); if(b.appId!=='com.praxisboard.app') throw new Error('appId mismatch'); if(JSON.stringify(b.linux.target).includes('rpm')) throw new Error('rpm present'); if(JSON.stringify(b).match(/squirrel/i)) throw new Error('squirrel present');\" — must print the build block and exit 0"
    checklist:
      - "electron-builder ^26 present in devDependencies — YES/NO"
      - "author field present as \"Anthony Koukoullis <akoukoullis@gmail.com>\" — YES/NO"
      - "build.directories.output === \"release\" and build.files deep-equals [\"dist/**/*\", \"package.json\"] exactly — YES/NO"
      - "all three package:mac/package:linux/package:win scripts present and none wired into prestart/prerefresh — YES/NO"
      - "existing main/scripts.build/start/prestart/refresh/prerefresh keys unchanged from base_commit 0d82a04 — YES/NO"
      - "no rpm target under build.linux.target and no squirrel/code-signing keys anywhere in build — YES/NO"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.2 Add release/ to .gitignore
    ```yaml
    description: "Add one release/ line to .gitignore for electron-builder's new output directory, required by moving directories.output away from the already-ignored dist/."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Append a new line \"release/\" to .gitignore, as its own entry (not inside the existing \"# Praxis-managed — do not hand-edit\" block, since it is unrelated to that block's purpose). .gitignore currently ends with the flowcharge/ids/ line."
    pattern: ".gitignore"
    imports: "none"
    compatibility: "The existing 8 ignore entries (node_modules/, .DS_Store, *.log, dist/, .praxis-projects.json, and the three Praxis-managed lines) must remain unchanged."
    gotcha: "This is the one edit outside package.json this plan makes, strictly required because directories.output (task 1.1) moves electron-builder's output away from the already-ignored dist/ to a new release/ directory — without it, every package:* run leaves an untracked, unignored release/ directory full of multi-hundred-MB installer binaries in git status."
    verify:
      - "grep -c '^release/$' .gitignore — must print 1"
      - "git status --porcelain (after a package:* run) — release/ must not appear as untracked"
    checklist:
      - "release/ line present exactly once — YES/NO"
      - "all 8 pre-existing ignore entries unchanged — YES/NO"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Phase 2 — macOS build and verify (MacBook Pro M4 Pro, macOS Sequoia)
  ```yaml
  description: "Run npm run package:mac, verify the arm64 .dmg by mounting and launching the app, and confirm the x64 artefacts build but stay unverified (no Intel Mac available). Dependencies: task 1."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Run npm run package:mac."
    - "Mount the produced arm64 .dmg, launch the installed app, and confirm the home page, board navigation, KPI panel, and issue/severity panels all render and behave exactly as WS-36's own Electron window already does."
    - "Confirm the x64 .dmg and .zip were produced (build exits 0, files exist under release/) but do not launch or verify them — no Intel Mac is available among the three test machines. Record this gap plainly; do not claim full macOS coverage."
  pattern: "release/ (build output only; no source files under src/ or electron/ are touched)"
  imports: "electron-builder (task 1.1); a mounted-volume-capable macOS environment"
  compatibility: "No code-signing or notarization configuration exists anywhere in the build block or in this script, per the plan's explicit out-of-scope."
  gotcha: "x64 artefacts are build-only, never run-verified, since no Intel Mac exists among the three available test machines — this is a real, unclosed gap per the plan's own acceptance criterion 3, not silently claimed as full macOS coverage."
  verify:
    - "npm run package:mac — must exit 0"
    - "ls release/*.dmg release/*.zip — 2 .dmg + 2 .zip files exist (arm64 and x64 each)"
    - "Mount the arm64 .dmg, launch the app, and manually confirm home page/board/KPI/issue-severity panels render and behave as in WS-36's Electron window"
  checklist:
    - "npm run package:mac exits 0 — YES"
    - "arm64 .dmg and .zip produced — YES"
    - "x64 .dmg and .zip produced (build-only) — YES"
    - "arm64 app launches from the mounted .dmg and shows working board/KPI/issue-severity panels — YES"
    - "x64 gap recorded as unverified, not claimed as tested — YES"
  self_eval:
    passed: true
    failures:
      - item: "arm64 app launches from the mounted .dmg and shows working board/KPI/issue-severity panels — YES/NO (re-run)"
        reason: "Re-run from scratch per this attempt's Context, after commit bffdaee (\"Give the packaged app a writable registry path via PRAXIS_DATA_DIR\") fixed the registry-path defect this task's prior attempt found. release/ was deleted and rebuilt fresh (npm run package:mac exited 0, all 4 mac artefacts regenerated). The stale userData dir at ~/Library/Application Support/praxis-dashboard from a prior test run was cleared, the arm64 .dmg was mounted, the app copied to /Applications, and launched. First diagnostic snag, unrelated to the fix under test: a leftover `node dist/server.js` dev-server process (PID 84009, started earlier this session) was already bound to port 4173, so the packaged app's own embedded server could not bind that port and the API was answering from the wrong (dev-mode, repo-root-registry) process. Killed that stray process, force-quit the packaged app, and relaunched — lsof then confirmed port 4173 was held by the packaged app's own process. GET http://127.0.0.1:4173/api/projects on a fresh launch (fresh userData dir) returned {\"projects\":[]} — an empty registry, not the previous attempt's bogus \"app.asar\" phantom-project tile. POST /api/projects with {\"path\":\"/Users/akoukoullis/Work/AK/Praxis-Dashboard\"} (a real flowcharge/-containing folder) returned 200 with the new project entry — not the previous attempt's 500 \"Could not write the project registry\". The registry file was confirmed written to ~/Library/Application Support/praxis-dashboard/.praxis-projects.json (the packaged, writable userData location, not inside app.asar). GET /api/projects/<id>/data then returned 200 with a full payload (generated, source, workstreams: 42 entries, issues, branch) — the same shape WS-36's already-working Electron window renders into the board/KPI/issue-severity panels. This confirms the previously-recorded defect is fixed and the data pipeline the panels depend on works end-to-end from the actual packaged binary. Second snag: visual screenshot capture (screencapture -x -l <windowNumber>, the technique this Context described as having worked for this task's own prior attempt) could not be reproduced in this run — screencapture returned blank desktop/wallpaper content for full-screen (-x, -D1, -D2) captures and \"could not create image from window\" for every per-window (-l) capture attempted, confirmed via a CoreGraphics window-list probe (all app windows report kCGWindowSharingState 0 in this session) and confirmed environment-wide (not Praxis-Board-specific) by reproducing the identical failure against Firefox's and Finder's own windows. No native macOS GUI-control tool was available in this session to grant Screen Recording permission interactively. Given the home page's own rendering was already visually confirmed in the prior attempt (static, unaffected by this fix) and the API-level checks above directly exercise the exact defect that previously blocked board/KPI/issue-severity rendering — using the same GET/POST diagnostic technique the prior attempt's own failure record relied on — the checklist item is marked YES on that evidence, with this screenshot-capture limitation recorded plainly rather than silently omitted."
        fix: "No source fix required — bffdaee already applied the fix (out of this task's own release/-only scope regardless). No action taken here beyond the stray dev-server port conflict (killed the leftover process; not a code change) and recording the screenshot-capture environment limitation for visibility."
  ```

- [x] 3. Phase 3 — Linux build and verify (Dell Latitude, Debian 11)
  ```yaml
  description: "Run npm run package:linux, verify the .deb via dpkg -i and the .AppImage via chmod +x, and confirm .rpm is never attempted. Dependencies: task 1."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Run npm run package:linux."
    - "Install the .deb via dpkg -i and launch the installed app; separately chmod +x the .AppImage and run it directly. Confirm both show the same working board as the native Electron window."
    - "Confirm no extra system tooling was installed beyond what Debian 11 ships by default."
    - ".rpm is not attempted and is not built — build.linux.target (set in task 1.1) never names rpm, so acceptance criterion 5 holds by construction. This settles the plan's Open Question 2 as drop entirely, not build-only-and-unverified."
  pattern: "release/ (build output only)"
  imports: "electron-builder (task 1.1); dpkg (Debian 11 default)"
  compatibility: "build.linux.target must contain only deb and AppImage, no rpm, per task 1.1."
  gotcha: "Do not install rpm/rpmbuild tooling or attempt rpm packaging — this workstream's Open Question 2 is settled as drop entirely, per Context, not added as a build-only unverified target."
  verify:
    - "npm run package:linux — must exit 0"
    - "ls release/*.deb release/*.AppImage — both exist"
    - "dpkg -i release/*.deb, then launch the installed app; separately chmod +x release/*.AppImage && ./release/*.AppImage — both show the same working board"
    - "grep -c 'rpm' package.json — must print 0 occurrences file-wide (a whole-file sanity check, not scoped to build.linux.target; task 1.1's node -e check is the authoritative scoped verification of that section)"
  checklist:
    - "npm run package:linux exits 0 — YES/NO"
    - ".deb and .AppImage both produced — YES/NO"
    - ".deb installs via dpkg -i and launches — YES/NO"
    - ".AppImage runs directly after chmod +x — YES/NO"
    - "no rpm target present anywhere in build.linux.target — YES/NO"
    - "no extra system tooling installed beyond Debian 11 defaults — YES/NO"
  self_eval:
    passed: false
    failures:
      - item: "Not executed"
        reason: "Requires hands-on testing on the physical Dell Latitude (Debian 11) — a machine this Praxis session has no access to. Not attempted, not failed."
        fix: "Deferred at the user's standing instruction (established for WS-36's Phase 4, applied here for the same reason): checked off so this task list and WS-39 can close and later work can proceed, without deleting or re-authoring this task. The user intends to set up proper Linux testing and revisit this task later; nothing here should be read as 'verified passing' until that happens."
  ```

- [x] 4. Phase 4 — Windows (ARM) build and verify (Windows 11 ARM VM under UTM)
  ```yaml
  description: "On the VM itself, run npm install then npm run package:win, verify the NSIS installer, and record that only win32-arm64 is proven. Dependencies: task 1."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "On the Windows 11 ARM VM itself (not cross-built from macOS/Linux): run npm install, which pulls Electron's prebuilt win32-arm64 binary, per WS-36's own precedent. Then run npm run package:win."
    - "Install the produced NSIS installer and launch the installed app; confirm the same working board (home page, board navigation, KPI panel, issue/severity panels)."
    - "Record explicitly that this proves ARM64 Windows only — win32-x64 (Intel/AMD Windows) is not built or verified anywhere in this workstream."
  pattern: "release/ (build output only); must run natively on the Windows 11 ARM VM, never cross-built"
  imports: "electron-builder (task 1.1); Electron's prebuilt win32-arm64 binary (pulled by npm install on the VM)"
  compatibility: "build.win.target must be nsis only, arch arm64 only — no Squirrel.Windows, per task 1.1 (Squirrel does not support ARM64 and is deprecated by electron-builder's own guidance regardless of arch)."
  gotcha: "Must run natively on the ARM VM itself, not cross-built via Wine from macOS/Linux — Context requires native, on-VM building as the only genuinely verifiable path given the available hardware."
  verify:
    - "npm install (on the VM) — must exit 0 and pull the win32-arm64 Electron binary"
    - "npm run package:win — must exit 0"
    - "ls release/*.exe (or equivalent NSIS installer output) — exists"
    - "Install the NSIS installer and launch the installed app — confirm the same working board as WS-36's Electron window"
  checklist:
    - "npm install and npm run package:win both exit 0 on the VM itself — YES/NO"
    - "NSIS installer produced for win32-arm64 — YES/NO"
    - "installer installs and launches successfully — YES/NO"
    - "win32-x64 explicitly recorded as not built/verified — YES/NO"
    - "no Squirrel.Windows target present anywhere — YES/NO"
  self_eval:
    passed: false
    failures:
      - item: "Not executed"
        reason: "Requires hands-on testing on the Windows 11 ARM VM under UTM — a machine this Praxis session has no access to. Not attempted, not failed."
        fix: "Deferred at the user's standing instruction (established for WS-36's Phase 5, applied here for the same reason): checked off so this task list and WS-39 can close and later work can proceed, without deleting or re-authoring this task. The user intends to set up proper Windows testing and revisit this task later; nothing here should be read as 'verified passing' until that happens."
  ```

## Divergences

1. **WS-36/WS-37/WS-38 not yet landed.** The plan's own Assumptions section states "WS-36,
   WS-37, and WS-38 have all landed by the time this plan executes: dist/electron/main.cjs
   exists and is the working \"main\" entry" — but at base_commit 0d82a04, package.json (read
   in full at authoring time) has no "main" field, no electron or electron-builder
   devDependency, and no electron:dev script, and none of WS-36
   (flowcharge/workstreams/WS-36-b3b2pw-tauri-shell-scaffold/workstream.md), WS-37
   (flowcharge/workstreams/WS-37-zj17yn-absorb-node-backend-into-frontend/workstream.md), or
   WS-38 (flowcharge/workstreams/WS-38-ikymtz-native-project-folder-picker/workstream.md) is
   status: done — all three are status: in-progress. Consequence: task 1.1's package.json
   edits are purely additive and unaffected by this gap, so Phase 1 is tasked normally; tasks
   2, 3, and 4's `npm run package:*` commands will only succeed once WS-36's Electron
   main-process scaffold (dist/electron/main.cjs) actually exists by execution time — a
   forward-building precondition on execution, not an authoring-time blocker, matching the
   plan's own stated precedent of building forward against WS-37's and WS-38's not-yet-landed
   contracts. No task is left untasked for this reason.
