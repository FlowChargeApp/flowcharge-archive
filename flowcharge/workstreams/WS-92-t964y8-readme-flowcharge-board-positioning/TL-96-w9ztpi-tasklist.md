---
id: TL-96-w9ztpi
type: tasklist
workstream: WS-92-t964y8
slug: readme-flowcharge-board-positioning
title: "Reauthor README.md around FlowCharge's product positioning and binary distribution"
status: done
created: 2026-09-04
updated: 2026-09-04
author: Anthony Koukoullis
depends_on: [PLN-83-nn4sj3]
links: []
mode: spec
base_commit: 1ea1552
---

# FlowCharge Tasks

## README positioning and binary distribution rewrite

This list implements `PLN-83-nn4sj3`. It reauthors one file — `/Users/akoukoullis/Work/AK/Praxis-Dashboard/README.md` — in place. Nothing else changes: no code, no `package.json`, no CI file, no script.

The README still describes FlowCharge as a passive, read-only board viewer. It links FlowCharge Core to the placeholder URL `https://github.com`, presents the unsigned Electron builds as the only distribution path, omits the shipped skill-install and skill-sync feature, and omits the D-26 CLI-binary release model. Its developer sections have also drifted: the Scripts table lists three of twelve typeable scripts, the layout tree omits `electron/`, `.github/scripts/`, `release/` and two of three `tools/` scripts, and two Notes bullets are false against the current `package.json`.

The four parent tasks below carry the plan's four stages in the plan's order. Stage 1 fixes the positioning and the Core link, stage 2 adds the distribution section, stage 3 reframes the Electron section, stage 4 sweeps the developer sections for accuracy. Task 5 is the plan's whole-workstream close-out check.

The file is `mode: spec`. Where the plan calls for a small, mechanical, single-location edit — the Electron retitle, the prerequisites bullet, and the two Notes bullets — the task carries a literal SEARCH/REPLACE block, copied from `README.md` as read at `1ea1552`. Where the plan calls for a substantial rewrite of a whole section's prose — the positioning paragraph, the two new sections, the layout tree, the Scripts table — the task states the required content instead, because a block there would only be this author writing the section under a diff's name while leaving the executor no room to read the surrounding file.

Every `verify` count and file state below was measured against `README.md` at `1ea1552` before it was written down. Steps that pass unchanged at `1ea1552` are marked as regression guards, with the reason they cannot fail there.

- [x] 1. Positioning and the Core link

  ```yaml
  description: "Plan stage 1 — rewrite the positioning paragraph and add the FlowCharge Core section, removing the placeholder URL"
  ```

  - [x] 1.1 Rewrite the positioning paragraph (README section 2)
    ```yaml
    description: "Replace README.md lines 6-16 with a positioning paragraph naming both of FlowCharge's jobs and carrying no placeholder link"
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Approach: prose, not a SEARCH/REPLACE block. The plan (PLN-83-nn4sj3, Design section 2) rewrites this whole paragraph's substance and fixes only the order of its claims, so the executor writes the prose against the file it reads."
      - "Target: README.md, the unheaded paragraph between the private-repository banner (lines 3-4) and the `## Quick start` heading (line 18). That is lines 6-16 at 1ea1552."
      - "Leave lines 1-4 untouched. The `# FlowCharge` heading and the two-line **Private repository.** banner survive byte-for-byte."
      - "State the claims in this order: (1) FlowCharge is the application and the primary product; (2) it reads a project's `flowcharge/` folder and renders every workstream as a card in the five-column board, with the existing sorting, open-issues-by-severity and gone-quiet panels; (3) it installs the FlowCharge Core skill files into the user's agentic coding tools, tracks their installed versions, and updates them in one click; (4) the board itself is read-only and non-interactive — no drag-and-drop, no writes back to the source project — and all board movement still happens through the `fc-*` skills."
      - "Do not describe the skill-install feature as read-only. It writes into the user's tool configuration directories. The read-only claim applies to the board only, and the paragraph must make that boundary explicit."
      - "Delete the placeholder link `[FlowCharge Core](https://github.com)`. Do not put the real Core URL here — task 1.2 owns the linked Core section. Refer to Core by name in this paragraph."
      - "Grounded facts, all verified at 1ea1552: the feature ships in the UI as the `Manage integrations` button (src/public/index.html:15); it covers four tools — Claude Code, Cursor, Windsurf, OpenCode (src/lib/agentic-tools-catalogue.ts, `displayName` at lines 41, 77, 127, 178 — see Divergence 1); it reaches the browser build over the `/api/integrations/*` routes (src/server.ts:822) as well as Electron's IPC bridge (src/public/browser-ipc-shim.ts installs `window.praxisAPI` at line 57 and `window.praxisSkillInstallAPI` at line 90)."
      - "Use the phrase `agentic coding tools` for the install targets, matching the plan's own wording, so the claim is greppable."
      - "Keep the paragraph the same rough length as the one it replaces. This is the opening of a README, not a feature list."
    pattern: "/Users/akoukoullis/Work/AK/Praxis-Dashboard/README.md, lines 6-16 only"
    imports: "None. Docs-only."
    compatibility: "PLN-83-nn4sj3 Design section 2 and acceptance criteria 1 and 2. Product name is FlowCharge throughout per D-19 and D-21; do not introduce FlowCharge Board."
    gotcha: "The banner at lines 3-4 sits immediately above the target and is easy to sweep into a paragraph rewrite. Acceptance criterion 1 requires it byte-for-byte, so the md5 check below exists to catch that."
    verify:
      - "Run `grep -c '](https://github.com)' README.md` from the repo root — must print 0. It printed 1 at 1ea1552."
      - "Run `grep -ci 'agentic coding tool' README.md` — must print 1 or more. It printed 0 at 1ea1552."
      - "Run `sed -n '3,4p' README.md | md5` — must print 544bd836e8f0b0dbcd615c05bbe0de20, the banner's checksum at 1ea1552. Regression guard: it passes unchanged at 1ea1552 by design, because its whole job is to prove the banner was not touched."
      - "Read lines 1-20 of README.md and confirm the four claims appear in the order listed in `implement`."
    checklist:
      - "Does the paragraph state that FlowCharge is the primary product, not a viewer of someone else's?"
      - "Does it name both jobs — rendering the board, and installing and syncing FlowCharge Core skill files into agentic coding tools?"
      - "Is the read-only claim scoped to the board, with the skill-install feature never described as read-only?"
      - "Is the placeholder link `https://github.com` gone, with no replacement URL added in this paragraph?"
      - "Do lines 1-4 still match 1ea1552 byte-for-byte?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.2 Add the `## FlowCharge Core` section
    ```yaml
    description: "Insert a short ## FlowCharge Core section immediately above ## Quick start, linking the real Core repository"
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Approach: prose, not a SEARCH/REPLACE block. This section does not exist at 1ea1552, so there is no anchor text to search for; the change is an insertion of new prose."
      - "Target: README.md. Insert the new section immediately above the `## Quick start` heading (line 18 at 1ea1552). Task 2.1 later inserts `## How FlowCharge ships` above this one, giving the plan's final order: positioning, How FlowCharge ships, FlowCharge Core, Quick start."
      - "Write one short block — a heading and two or three sentences. No sub-headings, no bullet list."
      - "Link `https://github.com/FlowChargeApp/flowcharge-core` verbatim. Copy the URL character-for-character; the verify step below extracts it from /Users/akoukoullis/Work/AK/flowcharge-public/README.md and greps this file for it."
      - "State that Core is the open-source skill and JavaScript suite, that it is free, complete and fully usable on its own, and that FlowCharge installs and orchestrates it."
      - "Do not write a primer on what Core does. The plan rejects that explicitly: Core's own repository owns that text, and a second copy drifts."
      - "Do not imply this repository's own source becomes public. It is private and closed-source, as the banner at lines 3-4 says."
    pattern: "/Users/akoukoullis/Work/AK/Praxis-Dashboard/README.md, one new section above ## Quick start"
    imports: "None. Docs-only."
    compatibility: "PLN-83-nn4sj3 Design section 4 and acceptance criterion 2. The Core URL is used as given, from D-21 and flowcharge-public/README.md:48, even though the repository is not created yet."
    gotcha: "The repository at that URL does not exist yet, so the link 404s today. That is expected and the plan accepts it; do not soften the URL to a placeholder or drop the link."
    verify:
      - "Run `grep -c '^## FlowCharge Core$' README.md` — must print 1. It printed 0 at 1ea1552."
      - "Run `URL=$(grep -oE 'https://github\\.com/[A-Za-z0-9._-]+/flowcharge-core' /Users/akoukoullis/Work/AK/flowcharge-public/README.md | head -1); grep -cF \"$URL\" README.md` — must print 1 or more. It printed 0 at 1ea1552, with URL resolving to https://github.com/FlowChargeApp/flowcharge-core."
      - "Run `grep -n '^## ' README.md` and confirm `## FlowCharge Core` appears immediately before `## Quick start`."
    checklist:
      - "Is the section exactly one short block, with no sub-headings and no bullet list?"
      - "Does it link https://github.com/FlowChargeApp/flowcharge-core character-for-character as flowcharge-public/README.md writes it?"
      - "Does it state that Core is free, complete and usable on its own, and that FlowCharge installs and orchestrates it?"
      - "Does it sit above `## Quick start` and below the positioning paragraph?"
      - "Does it avoid restating what Core's own repository documents?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. The distribution section

  ```yaml
  description: "Plan stage 2 — add the ## How FlowCharge ships section describing the D-26 Bun-binary release model"
  ```

  - [x] 2.1 Add the `## How FlowCharge ships` section
    ```yaml
    description: "Insert ## How FlowCharge ships above ## FlowCharge Core, naming the binary targets, the local-server model, both acquisition routes, and Electron's secondary status"
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Approach: prose, not a SEARCH/REPLACE block. The section does not exist at 1ea1552 and has no anchor text; it is an insertion of new prose with several external facts to get right."
      - "Target: README.md. Insert immediately above the `## FlowCharge Core` heading added by task 1.2, and therefore above `## Quick start`. Everything from `## Quick start` down describes working on this repository's source; sections 3 and 4 describe the product, so they sit above it."
      - "State that version 1 ships as a Bun-compiled native binary for macOS, Linux and Windows."
      - "State that running the binary starts a local server, and the user opens the board in a browser."
      - "Name `npm run package:cli` as the command that produces the four artefacts, and name them: flowcharge-<version>-darwin-arm64, flowcharge-<version>-darwin-x64, flowcharge-<version>-linux-x64, and flowcharge-<version>-win-x64.exe. Bun appends the .exe itself for the Windows target (tools/package-cli.mjs:139-140). The script is tools/package-cli.mjs and it writes into release/cli (tools/package-cli.mjs:23)."
      - "Name both acquisition routes in a few lines: the public flowcharge-public repository's Releases page, and the Homebrew tap one-liner `brew install <owner>/flowcharge/flowcharge`."
      - "Write the Homebrew line with the literal `<owner>` placeholder, exactly as /Users/akoukoullis/Work/AK/homebrew-flowcharge/README.md:8 writes it. The GitHub account is undecided — package.json:108 still says TODO-REPLACE-OWNER — so do not substitute a real owner, and do not hyperlink the flowcharge-public repository. Name it, do not link it."
      - "State that Electron stays a supported build path — `npm run electron:dev` and `npm run package:mac|linux|win` — but is not the version 1 release form, and point at the `## Building the Electron app` section for it. That section is retitled by task 3.1, so use that title."
      - "Keep the section a pointer, not a download page. Do not write `chmod +x` steps, a localhost URL walkthrough, or any other instruction already written in /Users/akoukoullis/Work/AK/flowcharge-public/README.md."
      - "Carry no live download URL and no version number. No release is cut yet and no GitHub repository exists for flowcharge-public or the tap, so describe where a user will get the binary."
    pattern: "/Users/akoukoullis/Work/AK/Praxis-Dashboard/README.md, one new section above ## FlowCharge Core"
    imports: "None. Docs-only."
    compatibility: "PLN-83-nn4sj3 Design section 3 and acceptance criteria 3, 4 and 5. Depends on task 1.2 having created ## FlowCharge Core, and names the section title task 3.1 introduces."
    gotcha: "This is the section most at risk of overrunning into flowcharge-public's territory. The plan's rejected alternative was copying that README's download instructions verbatim; the `chmod +x` absence check below guards the most likely way that happens."
    verify:
      - "Run `grep -c '^## How FlowCharge ships$' README.md` — must print 1. It printed 0 at 1ea1552."
      - "Run `grep -cE 'darwin-arm64|darwin-x64|linux-x64|win-x64' README.md` — must print 1 or more. It printed 0 at 1ea1552."
      - "Run `grep -c 'package:cli' README.md` — must print 1 or more. It printed 0 at 1ea1552."
      - "Run `grep -c 'flowcharge-public' README.md` — must print 1 or more. It printed 0 at 1ea1552."
      - "Run `BREW=$(grep -F 'brew install' /Users/akoukoullis/Work/AK/homebrew-flowcharge/README.md | head -1); grep -cF \"$BREW\" README.md` — must print 1 or more. It printed 0 at 1ea1552, with BREW resolving to `brew install <owner>/flowcharge/flowcharge`."
      - "Run `grep -c 'chmod +x' README.md` — must print 0. Regression guard: it printed 0 at 1ea1552 too, because the string was never in this file; the step exists to catch this task importing flowcharge-public's download steps."
      - "Run `grep -n '^## ' README.md` and confirm the order reads: How FlowCharge ships, FlowCharge Core, Quick start."
    checklist:
      - "Does the section state the Bun-compiled native binary for macOS, Linux and Windows as the version 1 form?"
      - "Does it state that running the binary starts a local server and the board opens in a browser?"
      - "Does it name both acquisition routes, with the Homebrew line carrying the literal `<owner>` placeholder?"
      - "Does it state that Electron is a supported build path and not the version 1 release form?"
      - "Is it free of `chmod +x`, localhost walkthroughs, live download URLs and version numbers?"
      - "Is the flowcharge-public repository named rather than hyperlinked?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 3. The Electron section reframe

  ```yaml
  description: "Plan stage 3 — retitle and reopen the packaged-builds section, and correct its false prerequisites bullet"
  ```

  - [x] 3.1 Retitle `## Packaged builds` and add its reframing opening line
    ```yaml
    description: "Rename the section to ## Building the Electron app and open it with a line placing it as the secondary path"
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Approach: SEARCH/REPLACE block. The change is one unambiguous location, the heading string is unique in the file (`grep -c '^## Packaged builds$' README.md` printed 1 at 1ea1552), and the plan fixes both the new title and the substance of the opening line, so no design decision is left to the executor."
      - "Keep everything below the replaced paragraph unchanged: the quarantine bullets, the `xattr -dr` command, the Linux note, and the prerequisites list. Task 3.2 owns the one prerequisites bullet that changes."
      - "The section stays last in the file. Its position is part of the reframe — the Electron path must read as a build option, not as the release."
      - |
        README.md
        <<<<<<< SEARCH
        ## Packaged builds

        The desktop builds produced by `npm run package:mac`, `npm run package:linux` and
        =======
        ## Building the Electron app

        Electron is the secondary build path, not the version 1 release form — see
        [How FlowCharge ships](#how-flowcharge-ships) for the artefact users actually download.

        The desktop builds produced by `npm run package:mac`, `npm run package:linux` and
        >>>>>>> REPLACE
    pattern: "/Users/akoukoullis/Work/AK/Praxis-Dashboard/README.md, lines 120-122 at 1ea1552"
    imports: "None. Docs-only."
    compatibility: "PLN-83-nn4sj3 Design section 9 and acceptance criteria 5 and 6. The anchor link target `#how-flowcharge-ships` is the GitHub slug of the heading task 2.1 adds, so task 2.1 must land first."
    gotcha: "The anchor link only resolves once `## How FlowCharge ships` exists. Executing this task before task 2.1 leaves a dead in-page link."
    verify:
      - "Run `grep -c '^## Building the Electron app$' README.md` — must print 1. It printed 0 at 1ea1552."
      - "Run `grep -c '^## Packaged builds$' README.md` — must print 0. It printed 1 at 1ea1552."
      - "Run `grep -c 'com.apple.quarantine' README.md` — must print 2. Regression guard: it printed 2 at 1ea1552, and the step exists to prove acceptance criterion 6's Gatekeeper explanation survived the retitle."
      - "Run `grep -c 'xattr -dr com.apple.quarantine' README.md` — must print 1, unchanged from 1ea1552. Same regression-guard reasoning as above."
    checklist:
      - "Is the heading now `## Building the Electron app`, with `## Packaged builds` gone?"
      - "Does the opening line state that Electron is the secondary path and point at the How FlowCharge ships section?"
      - "Do the `com.apple.quarantine` explanation, the `xattr -dr` command and the Linux note survive unchanged?"
      - "Is the section still last in the file?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 3.2 Correct the second signing-prerequisites bullet
    ```yaml
    description: "Restate the hardenedRuntime/notarize prerequisite as missing credentials, not missing configuration"
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Approach: SEARCH/REPLACE block. One unique location (`grep -c 'notarize` keys added to the' README.md` printed 1 at 1ea1552) and the plan dictates the exact correction — the credentials are missing, the configuration is not."
      - "The bullet is false as written. package.json:73-74 already sets `hardenedRuntime: true` and `notarize: true` in the `mac` block of the `build` section, so the keys do not need adding. There is no `entitlements` key, and the plan does not ask for one to be added."
      - "Keep the list at four bullets. Do not touch the Apple Developer Program bullet, the Windows certificate bullet, or the CI secrets bullet."
      - "Do not edit package.json. This workstream is docs-only; the claim about package.json changes, package.json itself does not."
      - |
        README.md
        <<<<<<< SEARCH
        - The `hardenedRuntime`, `entitlements` and `notarize` keys added to the `mac` block of the
          `build` section in `package.json`.
        =======
        - Apple notarization credentials available to the build. The configuration is already in
          place — `package.json` sets `hardenedRuntime: true` and `notarize: true` in the `mac`
          block of the `build` section — so what is missing here is the credentials, not the
          configuration.
        >>>>>>> REPLACE
    pattern: "/Users/akoukoullis/Work/AK/Praxis-Dashboard/README.md, lines 143-144 at 1ea1552"
    imports: "None. Docs-only."
    compatibility: "PLN-83-nn4sj3 Design section 9 and acceptance criteria 6 and 8. Matches what the WS-94-ked1ye record states."
    gotcha: "Scope drift risk: the plan lists fixing build.publish.owner and build.publish.repo at package.json:108-109 as out of scope. Correcting a claim about package.json must not turn into editing package.json."
    verify:
      - "Run `grep -c 'keys added to the' README.md` — must print 0. It printed 1 at 1ea1552."
      - "Run `grep -c 'hardenedRuntime' README.md` — must print 1, unchanged from 1ea1552, confirming the key is still named in the restated bullet."
      - "Run `node -e \"const b=JSON.parse(require('fs').readFileSync('package.json','utf8')).build.mac;console.log(b.hardenedRuntime,b.notarize)\"` — must print `true true`, confirming the claim the bullet now makes. Regression guard: it printed `true true` at 1ea1552, because package.json is not edited by this workstream."
      - "Run `git diff --name-only` — must not list package.json."
    checklist:
      - "Does the prerequisites list still have exactly four bullets?"
      - "Does the second bullet now say the credentials are missing and the configuration is present?"
      - "Is package.json unmodified?"
      - "Are the other three bullets byte-for-byte unchanged?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 4. Developer-section accuracy sweep

  ```yaml
  description: "Plan stage 4 — correct the layout tree, the Scripts table and the two false Notes bullets"
  ```

  - [x] 4.1 Correct the `## How it fits together` layout tree
    ```yaml
    description: "Rewrite the fenced tree so it matches the repository's real top-level layout"
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Approach: prose, not a SEARCH/REPLACE block. The tree is a ~30-line fenced block gaining six clusters of entries, and the plan leaves the grouping to judgement — 'a grouped one-line entry per cluster is sufficient; a file-by-file listing of 20 modules is not the point of the tree'. A block would encode one grouping as if it were dictated."
      - "Target: README.md, the fenced code block under `## How it fits together` (lines 39-68 at 1ea1552)."
      - "Add `electron/` — main.cts, preload.cts, the four IPC handler modules (ipc-handlers.cts, agentic-tools-ipc-handlers.cts, theme-ipc-handlers.cts, update-check-ipc-handlers.cts) and tsconfig.json. All seven exist on disk at 1ea1552."
      - "Complete `tools/` — it currently lists copy-assets.mjs only. Add bundle-public.mjs and package-cli.mjs."
      - "Add `.github/scripts/` — release.mjs, publish-release.mjs, bump-formula.mjs, release-format.mjs and their four .test.mjs siblings. Name them as one-line entries only; the plan puts a release runbook out of scope."
      - "Extend `src/lib/` — it currently lists extract.ts, git.ts and projects.ts only. Add grouped entries for the skill-install engine (agentic-tools-*.ts, skill-content-fetch.ts, skill-release-fetch.ts, zip-read.ts), the update-check modules (update-check.ts, update-prefs.ts), and detail.ts, tree-layout.ts and yaml-block.ts. Use grouped one-liners, not 20 separate rows."
      - "Extend `src/public/` — add fonts/, img/, lib/, ipc-adapter.ts, browser-ipc-shim.ts, the theme modules (theme.ts, theme-init.ts, theme-toggle.ts) and update-banner.ts, in the same grouped style."
      - "Add `release/` — the output directory for both electron-builder (package.json:41) and package-cli.mjs, which writes its binaries into release/cli (tools/package-cli.mjs:23). Show `cli/` under it."
      - "Keep the existing accurate entries — src/server.ts, src/scripts/, src/types/, tsconfig.json, .praxis-projects.json and dist/ — and keep the existing two-column style with the description aligned to the right of each path."
      - "Every path written must exist on disk. The second verify step sweeps the whole tree for that."
    pattern: "/Users/akoukoullis/Work/AK/Praxis-Dashboard/README.md, the fenced block under ## How it fits together"
    imports: "None. Docs-only."
    compatibility: "PLN-83-nn4sj3 Design section 6 and acceptance criteria 7 and 8."
    gotcha: "release/ and dist/ are both generated and gitignored, so they are present on this machine but absent on a fresh clone. The tree already documents dist/ that way; document release/ the same way rather than omitting it."
    verify:
      - "Run this required-entries sweep from the repo root — it must print nothing. Every one of these printed 0 matches inside the tree section at 1ea1552, so it fails loudly there: `sec=$(awk '/^## How it fits together/,/^## Scripts/' README.md); for p in 'electron/' 'main.cts' 'preload.cts' 'ipc-handlers.cts' 'bundle-public.mjs' 'package-cli.mjs' '.github/' 'release.mjs' 'publish-release.mjs' 'bump-formula.mjs' 'release-format.mjs' 'agentic-tools' 'skill-content-fetch.ts' 'update-check.ts' 'detail.ts' 'tree-layout.ts' 'yaml-block.ts' 'fonts/' 'img/' 'ipc-adapter.ts' 'browser-ipc-shim.ts' 'update-banner.ts' 'release/'; do printf '%s\\n' \"$sec\" | grep -q -- \"$p\" || echo \"MISSING FROM TREE: $p\"; done`"
      - "Run this existence sweep from the repo root — it must print nothing: `awk '/^## How it fits together/,/^## Scripts/' README.md | grep -oE '(├──|└──) [^ ]+' | sed 's/.*── //; s#/$##' | sort -u | while read -r n; do [ -e \"$n\" ] || find . -not -path './node_modules/*' -name \"$(basename \"$n\")\" -print -quit | grep -q . || echo \"NOT FOUND: $n\"; done`. Regression guard: it printed nothing at 1ea1552 because the tree's existing entries are all real; it cannot fail there, and it exists to catch a path invented while adding the new clusters."
    checklist:
      - "Does the tree list electron/ with main.cts, preload.cts, all four IPC handler modules and tsconfig.json?"
      - "Does tools/ list all three of copy-assets.mjs, bundle-public.mjs and package-cli.mjs?"
      - "Does the tree list .github/scripts/ with its four scripts and their .test.mjs siblings?"
      - "Are src/lib/ and src/public/ extended with grouped one-line cluster entries rather than a file-by-file listing?"
      - "Is release/ present, with cli/ shown under it?"
      - "Does every path named in the tree exist on disk?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 4.2 Rewrite the `## Scripts` table with all twelve typeable scripts
    ```yaml
    description: "Extend the Scripts table from three rows to the twelve non-pre scripts package.json defines"
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Approach: prose, not a SEARCH/REPLACE block. The table grows from three rows to twelve, and the 'Does' column of each new row is prose the executor writes from package.json. The plan dictates the row set, not the row text."
      - "Target: README.md, the table under `## Scripts` (lines 76-80 at 1ea1552)."
      - "package.json:12-28 defines fifteen scripts. Three are `pre*` hooks nobody types — prestart, prerefresh, pretest — leaving twelve. The table must carry all twelve: build, build:base, build:release, start, start:lan, refresh, test, electron:dev, package:mac, package:linux, package:win, package:cli. Nine of those twelve are missing at 1ea1552."
      - "State that build:release is build:base plus `node tools/bundle-public.mjs --harden` (package.json:15), and that every packaging script runs build:release, not build (package.json:24-27)."
      - "State that `npm test` runs `node --test` over `dist/**/*.test.js` and `.github/scripts/**/*.test.mjs` (package.json:22)."
      - "Keep the existing three rows' descriptions where they are still true, including the PORT override note on start and the --out note under the table for refresh."
      - "Do not add a script to package.json and do not rename one. The table describes package.json; it does not change it."
    pattern: "/Users/akoukoullis/Work/AK/Praxis-Dashboard/README.md, the table under ## Scripts"
    imports: "None. Docs-only."
    compatibility: "PLN-83-nn4sj3 Design section 7 and acceptance criteria 7 and 8."
    gotcha: "A one-directional check passes on a table missing a row, which is exactly the defect here. The verify command below checks both directions, and it parses rows by the leading `| `npm run <name>`` or `| `npm <name>`` pattern — keep each row's first cell in that form or the check will report a false extra."
    verify:
      - "Run this bidirectional check from the repo root — it must print `missing: none` and `extra: none` and exit 0. At 1ea1552 it printed `missing: build:base,build:release,start:lan,test,electron:dev,package:mac,package:linux,package:win,package:cli` and exited 1: `node -e 'const fs=require(\"fs\");const pkg=JSON.parse(fs.readFileSync(\"package.json\",\"utf8\"));const keys=Object.keys(pkg.scripts).filter(k=>!k.startsWith(\"pre\"));const md=fs.readFileSync(\"README.md\",\"utf8\");const tbl=md.split(/^## Scripts$/m)[1]?.split(/^## /m)[0]??\"\";const rows=[...tbl.matchAll(/^\\|\\s*`npm (?:run )?([a-z:]+)/gm)].map(m=>m[1]);const missing=keys.filter(k=>!rows.includes(k));const extra=rows.filter(r=>!keys.includes(r));console.log(\"missing:\",missing.join(\",\")||\"none\");console.log(\"extra:\",extra.join(\",\")||\"none\");process.exit(missing.length||extra.length?1:0);'`"
      - "Run `git diff --name-only` — must not list package.json."
      - "Read the table and confirm the build:release and npm test descriptions match package.json:15 and package.json:22."
    checklist:
      - "Does the table carry exactly the twelve typeable scripts, with no `pre*` hook listed?"
      - "Is every command in the table a real key of package.json's scripts object?"
      - "Does the table state that build:release adds `tools/bundle-public.mjs --harden` and that the packaging scripts run build:release?"
      - "Does the test row state what `node --test` runs over?"
      - "Is package.json unmodified?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 4.3 Correct the devDependencies Notes bullet
    ```yaml
    description: "Rewrite the 'two devDependencies … no framework and no bundler' bullet, which is false against package.json"
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Approach: SEARCH/REPLACE blocks, two of them. Both locations are unique — `grep -c 'two devDependencies (`typescript`, `@types/node`), but' README.md` and `grep -c 'TypeScript toolchain' README.md` each printed 1 at 1ea1552 — and the plan states exactly which claim survives — only the no-runtime-dependency claim."
      - "The bullet is false as written. package.json:29-36 lists six devDependencies: @types/node, electron, electron-builder, esbuild, javascript-obfuscator and typescript. esbuild is a bundler, driven by tools/bundle-public.mjs, so 'no bundler' is wrong and 'two devDependencies' is wrong."
      - "The surviving true claim is that the shipped code carries no runtime dependency. The replacement says only that."
      - "Do not add a count of devDependencies to the bullet. A number drifts the next time one is added; the plan asks for the runtime claim alone."
      - |
        README.md
        <<<<<<< SEARCH
        - There is a TypeScript compile step and two devDependencies (`typescript`, `@types/node`), but
          no runtime dependency, no framework and no bundler — `server.ts` and `app.ts` use only
          Node/browser built-ins, and `tsc` just strips the types.
        =======
        - There is a TypeScript compile step and a build toolchain in `devDependencies`, but the
          shipped code has no runtime dependency — `server.ts` and `app.ts` use only Node/browser
          built-ins, and nothing is installed alongside the built output.
        >>>>>>> REPLACE
      - "The Quick start comment at README.md:21 is stale in the same way. It calls `npm install` a TypeScript-toolchain install, but the same six devDependencies also include electron, electron-builder, esbuild and javascript-obfuscator. Left as it is, that comment also disagrees with the Notes bullet the block above produces, in the same file."
      - "Rewrite the comment so it no longer claims the install is TypeScript-toolchain-only. Keep the `(devDependencies only)` part — it is true — and keep the `#` in the same column, so it stays aligned with the comment on the `npm start` line below it."
      - "Do not touch the `npm start` line, the fence, or any prose under the Quick start heading. This is one comment on one line."
      - |
        README.md
        <<<<<<< SEARCH
        npm install     # TypeScript toolchain (devDependencies only)
        =======
        npm install     # build toolchain (devDependencies only)
        >>>>>>> REPLACE
    pattern: "/Users/akoukoullis/Work/AK/Praxis-Dashboard/README.md, lines 88-90 and line 21 at 1ea1552"
    imports: "None. Docs-only."
    compatibility: "PLN-83-nn4sj3 Design section 8, first bullet, and acceptance criterion 8."
    gotcha: "Every other bullet in Notes is verified true by the plan and stays. Do not sweep neighbouring bullets while editing this one."
    verify:
      - "Run `grep -c 'two devDependencies' README.md` — must print 0. It printed 1 at 1ea1552."
      - "Run `grep -c 'no framework and no bundler' README.md` — must print 0. It printed 1 at 1ea1552."
      - "Run `grep -c 'no runtime dependency' README.md` — must print 1. Regression guard: it printed 1 at 1ea1552, and the step exists to prove the one true claim in the old bullet survived the rewrite."
      - "Run `grep -c 'TypeScript toolchain' README.md` — must print 0. It printed 1 at 1ea1552."
      - "Run `grep -c '^npm install .*(devDependencies only)$' README.md` — must print 1. Regression guard: it printed 1 at 1ea1552, and the step exists to prove the Quick start comment was rewritten in place rather than deleted."
    checklist:
      - "Is the false devDependencies count gone?"
      - "Is the false 'no bundler' claim gone, given esbuild is a devDependency?"
      - "Does the bullet still state that the shipped code has no runtime dependency?"
      - "Are the other Notes bullets untouched?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 4.4 Scope the update-check Notes bullet to the Electron build
    ```yaml
    description: "Rename 'the packaged app' to the Electron build, now that two packaged forms exist"
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Approach: SEARCH/REPLACE block. One unique location (`grep -c \"^- The packaged app asks GitHub's public Releases API\" README.md` printed 1 at 1ea1552) and the plan dictates the correction — name the Electron build specifically."
      - "Once the `## How FlowCharge ships` section names two packaged forms, 'the packaged app' is ambiguous. The update banner is wired only to the Electron IPC channels registered in electron/update-check-ipc-handlers.cts (src/public/update-banner.ts:1-4). The browser shim installs window.praxisAPI and window.praxisSkillInstallAPI only (src/public/browser-ipc-shim.ts:57 and :90), and src/server.ts exposes no update route."
      - "Leave the rest of the bullet unchanged — the once-per-launch-and-once-a-day policy, the no-identifier statement, the dismissible banner, the .praxis-update.json file and the no-settings-screen note."
      - |
        README.md
        <<<<<<< SEARCH
        - The packaged app asks GitHub's public Releases API (`api.github.com`) for the latest release —
          once per launch, and at most once a day. The request carries no identifier beyond the IP address
        =======
        - The Electron build asks GitHub's public Releases API (`api.github.com`) for the latest release —
          once per launch, and at most once a day. The check is wired only to the Electron IPC channels in
          `electron/update-check-ipc-handlers.cts`; the CLI binary serves the board over HTTP and has no
          update route, so it never makes this call. The request carries no identifier beyond the IP address
        >>>>>>> REPLACE
    pattern: "/Users/akoukoullis/Work/AK/Praxis-Dashboard/README.md, lines 107-108 at 1ea1552"
    imports: "None. Docs-only."
    compatibility: "PLN-83-nn4sj3 Design section 8, second bullet, and acceptance criterion 8. Depends on task 2.1 for the two-packaged-forms framing this disambiguates."
    gotcha: "The SEARCH text ends mid-sentence at 'beyond the IP address'; line 109 continues 'any HTTPS request reveals,'. Keep that continuation intact so the sentence still reads."
    verify:
      - "Run `grep -c \"^- The packaged app asks GitHub\" README.md` — must print 0. It printed 1 at 1ea1552."
      - "Run `grep -c '^- The Electron build asks GitHub' README.md` — must print 1. It printed 0 at 1ea1552."
      - "Run `grep -c 'update-check-ipc-handlers.cts' README.md` — must print 1 or more. It printed 0 at 1ea1552."
      - "Read the bullet end to end and confirm the sentence beginning 'The request carries no identifier' still completes correctly."
    checklist:
      - "Does the bullet now name the Electron build rather than 'the packaged app'?"
      - "Does it state that the CLI binary makes no update call?"
      - "Does the sentence spanning the SEARCH boundary still read correctly?"
      - "Is the rest of the bullet — the policy, the banner and .praxis-update.json — unchanged?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 5. Workstream close-out check
  ```yaml
  description: "Run the plan's whole-workstream verification — the test suite still passes and README.md is the only modified path"
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Approach: verification only. This task realises the 'Whole workstream' bullet of PLN-83-nn4sj3's Testing strategy. It edits no file."
    - "Run the project's own test suite as evidence that nothing outside README.md was touched. Nothing in this repository reads README.md — tools/copy-assets.mjs copies src/public/ assets only, and package.json:43-46 ships dist/**/* and package.json into the Electron bundle — so a passing suite is a scope check, not a docs check."
    - "Confirm README.md is the only modified path in the working tree."
    - "Confirm flowcharge/ is not staged. It is deliberately untracked in this repository and must stay that way."
    - "If any check fails, do not fix it by widening scope. Revert the offending change; rollback for the whole workstream is `git checkout README.md`."
  pattern: "/Users/akoukoullis/Work/AK/Praxis-Dashboard — working tree state, no file edited"
  imports: "None. Uses the repository's own npm test script."
  compatibility: "PLN-83-nn4sj3 Testing strategy, whole-workstream bullet, and the Out of scope list."
  gotcha: "`npm test` runs pretest, which runs a full build, so dist/ is rewritten. dist/ is gitignored, so this does not affect the git status check."
  verify:
    - "Run `npm test` — must report `pass 231` and `fail 0`, matching the counts measured at 1ea1552. Regression guard: it passed at 1ea1552 by design; a change in the counts means something outside README.md moved."
    - "Run `git diff --name-only` — must print exactly one line, `README.md`. It printed nothing at 1ea1552, so this step fails there."
    - "Run `git status --porcelain` — must print exactly two lines, ` M README.md` and `?? flowcharge/`. It printed only `?? flowcharge/` at 1ea1552."
    - "Run `git status --porcelain | grep -c '^[AMDR]' ` — must print 0, confirming nothing is staged, flowcharge/ included."
  checklist:
    - "Does `npm test` still report 231 passing and 0 failing?"
    - "Is README.md the only path listed by `git diff --name-only`?"
    - "Is flowcharge/ still untracked and unstaged?"
    - "Is the index empty, with nothing staged?"
    - "Were package.json, any CI file and any script left unmodified?"
  self_eval:
    passed: true
    failures: []
  ```

## Divergences

1. **Catalogue line anchors drift by one.** The plan cites the four supported tools at
   `src/lib/agentic-tools-catalogue.ts:40,76,126,177`. Read at `1ea1552`, the four
   `displayName` lines are 41, 77, 127 and 178 — the plan's numbers point one line above
   each entry. The four tools themselves — Claude Code, Cursor, Windsurf, OpenCode — are
   unchanged, so no task was dropped; task 1.1 carries the corrected line numbers so its
   executor does not read the wrong lines.

Every other file the plan cites matched it at `1ea1552`: `README.md` lines 3-4, 6, 88-90,
107-113 and 120-149; `package.json` lines 12-28, 29-36, 41, 43-46, 73-74 and 108-109;
`src/server.ts:822`; `src/public/index.html:15`; the Core URL at
`flowcharge-public/README.md:48`; and the Homebrew line at `homebrew-flowcharge/README.md:8`.
