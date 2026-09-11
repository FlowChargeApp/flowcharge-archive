---
id: IL-20-cztm5x
type: issuelist
workstream: WS-109-skrkxj
slug: skill-install-engine-leftover-defects
title: "Leftover skill-install-engine defects, relocated from WS-106-1xers0"
status: ready
created: 2026-09-11
updated: 2026-09-11
author: Anthony Koukoullis
depends_on: []
links: [WS-106-1xers0]
---

# FlowCharge Issue List

- [ ] ISS-32-3hfjhe. The install-removal capability is wired end to end but no interface control reaches it

  ```yaml
  id: ISS-32-3hfjhe
  status: blocked
  severity: medium
  author: Anthony Koukoullis
  description: "removeInstallation at src/lib/agentic-tools-install.ts:189 is wired through every layer below the page. The POST /api/integrations/installs/remove route at src/http/routes-integrations.ts:381 calls it, the fetch-backed shim method at src/public/browser-ipc-shim.ts:104 sends that request, and the typed surface at src/public/lib/agentic-tools-api.ts:85 declares it. No caller exists above that. `grep -n \"removeInstallation\" src/public/home.ts` returns nothing, and home.ts is the only module that renders the integrations modal. The modal offers detect, install and rescan controls only."
  steps_to_reproduce:
    - "Open the integrations modal in the app."
    - "Select a detected tool, choose a scope, and install the skill suite into it."
    - "Read every control the modal offers, in every row and in every scope."
    - "Look for any control that undoes the install just performed."
  expected: "An install performed from the integrations modal can be undone from the integrations modal, so the .praxis-installs.json ledger and the installed files stay consistent through the app alone."
  actual: "No control in the interface reaches removeInstallation. A user who installs into the wrong tool, or under the wrong scope, cannot undo it from the app. The installed files must be deleted by hand and .praxis-installs.json must then be hand-edited to match, or the ledger and the filesystem disagree about what is installed."
  affected: "src/lib/agentic-tools-install.ts:189 (removeInstallation); src/http/routes-integrations.ts:381 (POST /api/integrations/installs/remove); src/public/browser-ipc-shim.ts:104; src/public/lib/agentic-tools-api.ts:85; src/public/home.ts (the integrations modal, which has no caller)"
  environment: "Every host that serves the integrations modal. The capability is reachable over HTTP and is covered by unit tests at src/test/unit/agentic-tools-install.test.ts:302 and :320."
  tasks: []
  notes: "The direction is UNDECIDED, and this issue is additionally blocked behind the InstallRecord record-shape change described by ISS-35-m54y06 and ISS-36-vl2cpx in WS-106-1xers0 (both done), because removal must delete every path an install wrote before a control that triggers it is worth building. A maintainer must choose it before any task is authored from this issue, and this issue names no direction. Status is blocked on that decision, not on any other artefact, so depends_on stays empty. Verified twice against the working tree: once by the audit that found it, and once by an independent validation pass. File this for the src/ impact only: the Electron counterpart is leftover scaffolding per CLAUDE.md and is not in scope. ARCHITECTURE.md line 1531 already records the state: the page has no remove control, and homeEntry never calls removeInstallation. Relocated from IL-16-78bnrq-issuelist.md (WS-106-1xers0) on 2026-09-11; content unchanged."
  ```

- [x] ISS-38-gv3p2x. Two format writers silently drop every bundled reference file

  ```yaml
  id: ISS-38-gv3p2x
  status: done
  severity: medium
  author: Anthony Koukoullis
  description: "ruleDirectoryWrites at src/lib/agentic-tools-format.ts:48-53 and singleDocumentWrite at :58-61 read only skill.body. skillDirectoryWrites at :31-42 is the only writer that emits skill.files. mapEntriesToSkills in src/lib/skill-content-fetch.ts collects reference material shipped beside a SKILL.md in the release archive into skill.files, so that content exists on the install path and is then discarded for three of the four implemented format kinds."
  steps_to_reproduce:
    - "Use a release archive in which at least one skill ships a reference file beside its SKILL.md."
    - "Install that content into Claude Code or OpenCode, which use the skill-directory format, and list the skill directory."
    - "Install the same content into Cursor or Windsurf, which use the rule-directory format, and list the target directory."
    - "Compare the two file sets, and read the install result for any indication of a partial write."
  expected: "Either every format writes the bundled reference files, or the install result reports that the write was partial so the user can see it."
  actual: "The skill-directory install writes the reference files. The rule-directory install writes the SKILL.md body alone and discards the rest, with no warning and no result field indicating a partial install. singleDocumentWrite loses the files the same way and serves both single-rule-file and markdown-context-file, which makes three affected kinds out of the four implemented. Neither of those two kinds is selected by any tool today, because selectPrimaryFormat returns the first implemented format in each tool's integrationFormats list and every TOOL_CATALOGUE entry resolves to skill-directory or rule-directory, so they are paths that would drop the files if a tool ever selected them. A skill whose behaviour depends on a reference file is installed in a broken state."
  affected: "src/lib/agentic-tools-format.ts:48-53 (ruleDirectoryWrites), :58-61 (singleDocumentWrite), :31-42 (skillDirectoryWrites); src/lib/skill-content-fetch.ts (mapEntriesToSkills)"
  environment: "Every host that serves the integrations routes. Node >=20.14."
  tasks: [TL-108-4pwnq9.1]
  notes: "Shares the IntegrationFormat model gap with ISS-33-6bxf6h and ISS-34-mpy9n0 (both done, in WS-106-1xers0). Any correction must add no runtime dependency. Relocated from IL-16-78bnrq-issuelist.md (WS-106-1xers0) on 2026-09-11; content unchanged. Closed 2026-09-11: TL-108-4pwnq9 task 1 made ruleDirectoryWrites and singleDocumentWrite emit a FileWrite per skill.files entry, matching skillDirectoryWrites. npm test: 387/387."
  ```

- [ ] ISS-46-j993sr. A ledger record written before resolvedPaths names one path, so a cleanup driven by it cannot find the rest

  ```yaml
  id: ISS-46-j993sr
  status: ready
  severity: medium
  author: Anthony Koukoullis
  description: "InstallRecord at src/lib/agentic-tools-install-tracking.ts:16 carries a single resolvedPath, and every other path an install wrote is named nowhere. Recording the full set in a resolvedPaths field, and driving removal and update cleanup from it, is the ISS-35-m54y06 and ISS-36-vl2cpx correction. That correction covers only records written after the shape change. A record already on disk in .praxis-installs.json in the single-path shape keeps naming one path, so a cleanup driven by it reaches that one path and no other. On a machine that installed the pre-rename prx-* suite, the record names one of the eight prx-* skill directories, and the other seven, with every bundled reference file beside them, are named by no record at all."
  steps_to_reproduce:
    - "Start from a machine carrying a pre-rename install, so .praxis-installs.json holds a record in the single-resolvedPath shape and eight prx-* skill directories exist under the tool config directory."
    - "Apply the record-shape correction behind ISS-35-m54y06 and ISS-36-vl2cpx, so removal and update cleanup read every recorded path."
    - "Open the Manage integrations modal and install again, or call the removal capability for that tool and scope."
    - "List the tool skill directory and read .praxis-installs.json."
  expected: "The cleanup accounts for every file the previous install wrote, whatever shape the record describing that install was written in."
  actual: "The legacy record names one path, so the cleanup reaches that one path. Seven prx-* skill directories and their bundled reference files stay on disk. The record written after the cleanup names the current files only, so nothing in the ledger names the survivors and nothing in the app can find them again. The coding tool keeps loading them."
  affected: "src/lib/agentic-tools-install-tracking.ts:16 (InstallRecord.resolvedPath); src/lib/agentic-tools-install.ts:112-129 (the installToTarget update branch), :199 (removeInstallation); every .praxis-installs.json record written before the shape change"
  environment: "Any machine whose ledger record predates the record-shape change. Node >=20.14."
  tasks: []
  notes: "Recorded in TL-103-9npvav (WS-106-1xers0) as a divergence from ISS-36-vl2cpx. Deriving the unrecorded paths, for example by deleting a whole skills directory, was refused there because it could delete files this app never wrote. This issue names no direction and recommends none. Any correction must add no runtime dependency. Relocated from IL-16-78bnrq-issuelist.md (WS-106-1xers0) on 2026-09-11; content unchanged."
  ```

- [x] ISS-47-yug5gc. The presence check reports OpenCode's legacy singular skill folder as not installed

  ```yaml
  id: ISS-47-yug5gc
  status: done
  severity: low
  author: Anthony Koukoullis
  description: "checkSkillPresence in src/lib/agentic-tools-skill-presence.ts resolves exactly one expected path per skill and tests only that path. It takes the format from `const format = selectPrimaryFormat(tool)` at :35, derives the paths from `formatForTarget(format, stubContent)` at :44, then builds fullPath as `${basePath}/${writes[i].relativePath}` at :53 and calls `fsAccess.pathExists(fullPath)` at :54. For OpenCode that format is the skill-directory entry in src/lib/agentic-tools-catalogue.ts:207-211, with `pathTemplate: 'skills/<name>/SKILL.md'`, which is the plural path FlowCharge itself writes. The check never looks at the singular `skill/` folder. OpenCode 1.18.27 loads skills from both spellings. Its binary contains the discovery constant `SA=\"{skill,skills}/**/SKILL.md\"`, which it applies to each of its own configuration directories: `~/.config/opencode/` globally, and every `.opencode/` found walking up from the working directory. Its bundled reference text lists global skills as `~/.config/opencode/skill(s)/<name>/SKILL.md`. The singular form is a legacy spelling left by OpenCode's migration from singular to plural folder names. The same migration renamed `agent/` to `agents/`, and `~/.config/opencode/agent/` on the measuring machine is still singular."
  steps_to_reproduce:
    - "Build the app at f0b0a8c, so the compiled modules exist in dist/lib/."
    - "Create a scratch directory to stand in for the OpenCode config directory."
    - "Write all 8 canonical skills from CANONICAL_PRAXIS_SKILL_IDS into it as `skill/<id>/SKILL.md`."
    - "Run the compiled checkSkillPresence against that directory with the real OpenCode TOOL_CATALOGUE entry and a pathExists backed by the filesystem, and read the result."
    - "Move the same 8 skills to `skills/<id>/SKILL.md` and run the check again."
  expected: "A skill that OpenCode loads from one of its own configuration directories is reported present, whichever of OpenCode's two folder spellings, `skill/` or `skills/`, holds it. The Manage integrations modal shows the \"Already installed\" chip for a suite OpenCode already loads."
  actual: "Measured with the compiled dist/lib/ at f0b0a8c. All 8 skills under `skill/` give status=not-installed, present=0, missing=8. All 8 skills under `skills/` give status=fully-installed, present=8, missing=0. A user whose FlowCharge Core skills for OpenCode sit in `~/.config/opencode/skill/`, from a manual install or one made before OpenCode's rename, has a suite that OpenCode loads. The integrations modal reports it as not installed and shows no \"Already installed\" chip. The user trusts that and installs again. FlowCharge writes a second copy into `~/.config/opencode/skills/`, and OpenCode then finds two copies of every skill under the same names, one in each folder."
  affected: "src/lib/agentic-tools-skill-presence.ts:35 (selectPrimaryFormat call), :44 (formatForTarget call), :53-54 (the single-path join and pathExists call); src/lib/agentic-tools-catalogue.ts:207-211 (OpenCode skill-directory entry, pathTemplate 'skills/<name>/SKILL.md' at :209)"
  environment: "macOS. OpenCode 1.18.27, installed at ~/.local/share/fnm/node-versions/v24.12.0/installation/lib/node_modules/opencode-ai/bin/opencode.exe. The presence results were measured by running the compiled dist/lib/ modules at f0b0a8c against a scratch directory, not inferred from reading."
  tasks: [TL-108-4pwnq9.2]
  notes: "Closed 2026-09-11: TL-108-4pwnq9 task 2 made checkSkillPresence also probe OpenCode's legacy skill/ path when the plural skills/ path misses, scoped to OpenCode only. npm test: 387/387. Note left open for a later workstream: the sibling skillVersion module (WS-107-do28jk) still reads only the plural path, so a skill found only under the legacy folder is reported present with a null version. Confidence is high on the code path and on the measurement. On OpenCode's behaviour, confidence is high for version 1.18.27. It comes from the binary's own discovery constant and bundled reference text, not from OpenCode's public docs, which are known to lag. Scope of today's impact: the presence check runs at global scope only, which src/public/home.ts documents as a deliberate, bounded limit and which is not a defect, so the live case is `~/.config/opencode/skill/`. OpenCode also reads the project-scope equivalent, `.opencode/skill/`, but the presence check cannot reach it until that scope limit changes. Severity is low because FlowCharge never writes the singular folder, so the defect needs a manual or older install, but its consequence is a duplicate install. This is a different defect from ISS-42-q1t9bh (WS-106-1xers0, done), which concerns the same function comparing against a hand-maintained id list. The defect survives TL-103-9npvav unchanged, because TL-103-9npvav still resolves one plural path per skill. This issue concerns OpenCode's own two folder spellings only. OpenCode also reads skill folders that belong to other tools, `.claude/skills/` and `.agents/skills/`, but the maintainer treats every coding tool as separate, so those folders must not count towards OpenCode's presence, and one tool's install never satisfies another's. Context, not a separate defect and not a proposed direction: IntegrationFormat already declares an optional deprecatedFallback field at src/lib/agentic-tools-catalogue.ts:21, and Cursor (:111) and Windsurf (:154) set it. No code outside the catalogue reads it. OpenCode's skill-directory entry does not set it. Nothing here needs a runtime dependency, and none may be added silently. Relocated from IL-17-1xu0n0-issuelist.md (WS-106-1xers0) on 2026-09-11; content unchanged."
  ```

- [x] ISS-50-92mh3i. The skill-release fetch is pinned to a temporary local Gitea address, not the public FlowCharge Core origin

  ```yaml
  id: ISS-50-92mh3i
  status: done
  severity: high
  author: Anthony Koukoullis
  description: "src/lib/skill-content-fetch.ts:63 hardcodes PRAXIS_REPO_BASE_URL = 'http://100.87.185.97:8110/akoukoullis/Praxis', a private LAN address for a temporary local Gitea instance. The real, public origin is https://github.com/FlowChargeApp/flowcharge-core. A workstream on 2026-08-20 (WS-48-hsf9yl) deliberately templated this constant so a later host swap to github.com would be a one-line change, but no later workstream made that change."
  steps_to_reproduce:
    - "On any machine that is not on the developer's own LAN and cannot reach 100.87.185.97, open Manage integrations and use Install selected, or trigger the skill-presence/update check that reads from the same constant."
    - "Watch the fetch to http://100.87.185.97:8110/... time out or fail to connect."
  expected: "Skill install, update-check and presence machinery fetch release content from the public FlowCharge Core origin, reachable by every user."
  actual: "Every fetch is pinned to a private LAN address unreachable outside the developer's own network, so install/update from a release fails for every other user."
  affected: "src/lib/skill-content-fetch.ts:63 (PRAXIS_REPO_BASE_URL)"
  environment: "Every machine that is not on the developer's own LAN. Node >=20.14."
  tasks: [TL-108-4pwnq9.3.1, TL-108-4pwnq9.3.2, TL-108-4pwnq9.3.3, TL-108-4pwnq9.3.4]
  notes: "Closed 2026-09-11: TL-108-4pwnq9 task 3 repointed PRAXIS_REPO_BASE_URL to https://github.com/FlowChargeApp/flowcharge-core and gave releasesApiUrl a github.com branch resolving to api.github.com/repos/.... The repoint exposed a stale live-test fixture (EXPECTED_IDS and the fc-orchestrate nested-files check in skill-content-fetch.test.ts still pinned the old Gitea mirror's inventory); corrected it against the real downloaded release asset, with the user's explicit approval to fix it inside this task. npm test: 387/387. The public origin (https://github.com/FlowChargeApp/flowcharge-core) is live and does carry a v0.1.0 release. Correction, 2026-09-11: an earlier note here claimed that release's content was stale and pending a republish. That was wrong. It came from querying the app's own hardcoded PRAXIS_REPO_BASE_URL (this issue's own defect), which resolves to the developer's private Gitea mirror, not from checking github.com/FlowChargeApp/flowcharge-core directly. The user confirmed by checking the real GitHub release: it already carries the renamed flowcharge skill correctly, with fc-orchestrate remaining only in CHANGELOG.md's historical entries, which is deliberate. The Gitea mirror is the user's own personal backup, pushed to infrequently and not authoritative; it was offline for part of this investigation and is live again now, but neither state bears on what this issue is about. Repointing this constant corrects the address only. Any correction must add no runtime dependency. Relocated from IL-16-78bnrq-issuelist.md (WS-106-1xers0) on 2026-09-11; content unchanged except this note, corrected 2026-09-11 as above."
  ```

- [x] ISS-51-kc70n7. PLN-88 and ISS-50 name different release hosts for the canonical skill list

  ```yaml
  id: ISS-51-kc70n7
  status: done
  severity: medium
  author: Anthony Koukoullis
  description: "Two artefacts in workstream WS-106-1xers0 disagree about the release host that FlowCharge Core must fetch the published skill list from. Open question 1 of PLN-88-tpbc8f-plan.md (about lines 195-202) names akoukoullis/Praxis, renamed flowcharge-core-archive, and recommends leaving that constant alone. Issue ISS-50-92mh3i (about line 348 of its original file, relocated alongside this issue) names https://github.com/FlowChargeApp/flowcharge-core and records that this host was verified live on 2026-09-11, the day the issue was filed. PLN-88's release-derived approach to rebuilding the canonical skill-id list depends on the host it names being the correct one."
  steps_to_reproduce:
    - "Open flowcharge/workstreams/WS-106-1xers0-skill-install-target-resolution-and-lifecycle/PLN-88-tpbc8f-plan.md and read Open question 1, about lines 195-202."
    - "Open ISS-50-92mh3i in this issue list and read its description and notes."
    - "Compare the two release hosts named."
  expected: "Both artefacts name the same release host, so that any later execution of PLN-88's release-derived approach fetches the canonical skill-id list from the host the workstream has verified."
  actual: "PLN-88 names akoukoullis/Praxis (renamed flowcharge-core-archive) and ISS-50-92mh3i names https://github.com/FlowChargeApp/flowcharge-core. An executor following PLN-88 fetches from a host that a more recently verified issue states is not the real one, so the rebuilt canonical skill list is stale, wrong, or the fetch fails outright."
  affected: "flowcharge/workstreams/WS-106-1xers0-skill-install-target-resolution-and-lifecycle/PLN-88-tpbc8f-plan.md (Open question 1); ISS-50-92mh3i in this issue list"
  environment: ""
  tasks: [TL-108-4pwnq9.4]
  notes: "Closed 2026-09-11: TL-108-4pwnq9 task 4 rewrote PLN-88's Open question 1 to name the confirmed host, https://github.com/FlowChargeApp/flowcharge-core, and changed its Recommendation to repoint rather than leave alone. Documentation only; no source file touched. This does not block the Missing-skills chip fix already closed as ISS-42-q1t9bh (WS-106-1xers0, done). It blocks PLN-88's own release-derived design if that design is executed later, and PLN-88 stays parked in WS-106-1xers0, not moved here, because it is a plan artefact tied to that workstream's own history. Confidence is high: both host values are quoted from the two named artefacts, and ISS-50-92mh3i states its host was verified live. Resolving this issue means reconciling the two artefacts to one host, not changing any source code. Correction, 2026-09-11: the host named by ISS-50-92mh3i, https://github.com/FlowChargeApp/flowcharge-core, is now confirmed correct and current — its release already carries the renamed flowcharge skill, so it was never stale. PLN-88's Open question 1 names the wrong host (an old archive repo, akoukoullis/Praxis / flowcharge-core-archive). Reconciling PLN-88 to name the confirmed host would resolve this issue; that edit has not been made yet. Relocated from IL-19-f2xpx5-issuelist.md (WS-106-1xers0) on 2026-09-11; content unchanged except this note, corrected 2026-09-11 as above."
  ```
