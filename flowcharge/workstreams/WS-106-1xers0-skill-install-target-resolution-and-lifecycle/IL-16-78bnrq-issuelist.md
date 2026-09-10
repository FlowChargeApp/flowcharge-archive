---
id: IL-16-78bnrq
type: issuelist
workstream: WS-106-1xers0
slug: skill-install-target-resolution-and-lifecycle
title: "Skill install target resolution and lifecycle defects"
status: ready
created: 2026-09-10
updated: 2026-09-10
depends_on: []
links: []
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
  notes: "The direction is UNDECIDED, and this issue is additionally blocked behind the InstallRecord record-shape change described by ISS-35-m54y06 and ISS-36-vl2cpx in this workstream, because removal must delete every path an install wrote before a control that triggers it is worth building. A maintainer must choose it before any task is authored from this issue, and this issue names no direction. Status is blocked on that decision, not on any other artefact, so depends_on stays empty. Verified twice against the working tree: once by the audit that found it, and once by an independent validation pass. File this for the src/ impact only: the Electron counterpart is leftover scaffolding per CLAUDE.md and is not in scope. ARCHITECTURE.md line 1531 already records the state: the page has no remove control, and homeEntry never calls removeInstallation."
  ```

- [x] ISS-33-6bxf6h. Global installs for Cursor and Windsurf write to a path the tool never reads

  ```yaml
  id: ISS-33-6bxf6h
  status: done
  severity: critical
  author: Anthony Koukoullis
  description: "selectPrimaryFormat at src/lib/agentic-tools-format.ts:27 returns the first entry in tool.integrationFormats whose kind is implemented, and it takes no scope argument. resolveBasePathForScope at src/public/lib/agentic-tools-scope.ts:19 returns detection.resolvedConfigDir for global scope, and it takes no format argument. Whether a pathTemplate is relative to the tool config directory or to a project root is stated only inside the free-text notes string of IntegrationFormat (src/lib/agentic-tools-catalogue.ts:17-23), which no code reads. At global scope the join at src/lib/agentic-tools-install.ts:116 therefore appends a project-relative rule-directory template to a configDir. Measured by running the compiled modules in dist/lib/ against the real TOOL_CATALOGUE: cursor resolves configDir '~/.cursor/' and format '.cursor/rules/*.mdc', so a global install writes /Users/<user>/.cursor//.cursor/rules/fc-git.mdc; windsurf resolves configDir '~/.codeium/windsurf/' and format '.devin/rules/*.md', so it writes /Users/<user>/.codeium/windsurf//.devin/rules/fc-git.md. Cursor reads .cursor/rules/*.mdc from a project root. Windsurf reads .devin/rules/*.md from a project root, and its user-level surface is memories/global_rules.md relative to configDir. Windsurf already declares that correct global format at src/lib/agentic-tools-catalogue.ts:162-166, but selectPrimaryFormat never reaches it because rule-directory sits earlier in the array."
  steps_to_reproduce:
    - "Install Cursor on the machine, so detection resolves its configDir to ~/.cursor/."
    - "Open the Manage integrations modal and leave the scope on Global."
    - "Select Cursor and click Install selected."
    - "List ~/.cursor/.cursor/rules/ and compare it with the project-level .cursor/rules/ directory Cursor actually reads."
    - "Repeat the run with Windsurf, whose user-level surface is memories/global_rules.md under ~/.codeium/windsurf/."
  expected: "A global install writes into the directory the tool reads at user level, or the row reports the tool as ineligible at global scope. Windsurf's declared user-level surface, memories/global_rules.md, is the user-authored rules document, and the markdown-context-file writer replaces its whole target with one combined document, so Windsurf must be reported ineligible at global scope rather than installed over that file."
  actual: "The install writes eight .mdc files into ~/.cursor/.cursor/rules/, records a ledger entry, and the row reports Installed. Cursor loads none of them. Windsurf behaves the same way under ~/.codeium/windsurf/.devin/rules/. The user believes FlowCharge Core is installed and it is not, and nothing reports a failure."
  affected: "src/lib/agentic-tools-format.ts:27 (selectPrimaryFormat); src/public/lib/agentic-tools-scope.ts:19 (resolveBasePathForScope); src/lib/agentic-tools-install.ts:116 (the path join); src/lib/agentic-tools-catalogue.ts:17-23 (IntegrationFormat), :107-119 (Cursor formats), :150-172 (Windsurf formats)"
  environment: "macOS, Node >=20.14. The paths were measured by running the compiled modules in dist/lib/ against the real TOOL_CATALOGUE with real detection, not inferred from reading."
  tasks: []
  notes: "Shares one root cause with ISS-34-mpy9n0 and ISS-38-gv3p2x: IntegrationFormat carries no machine-readable statement of what its pathTemplate is relative to, or which scopes it is valid at. The workstream record puts that format-model change first in the fix order. The project has no runtime dependency and must keep none, so any correction uses Node and browser built-ins only."
  ```

- [x] ISS-34-mpy9n0. Project installs for Claude Code and OpenCode omit the tool config prefix

  ```yaml
  id: ISS-34-mpy9n0
  status: done
  severity: critical
  author: Anthony Koukoullis
  description: "The same gap as ISS-33-6bxf6h, in the other direction. At project scope resolveBasePathForScope (src/public/lib/agentic-tools-scope.ts:19) returns scope.projectPath, and selectPrimaryFormat (src/lib/agentic-tools-format.ts:27) returns a skill-directory format whose pathTemplate is written relative to the tool config directory. Claude Code's own catalogue note at src/lib/agentic-tools-catalogue.ts:53 states the template is relative to configDir at user level or to .claude/ at the project root at project level. That project-level prefix exists only in the note, never in code. OpenCode's note at :210 states configDir-relative and names no project-level form at all. Measured by running the compiled modules against the real TOOL_CATALOGUE: both claude-code and opencode write <projectRoot>/skills/fc-orchestrate/SKILL.md at project scope. Claude Code reads project skills from <projectRoot>/.claude/skills/."
  steps_to_reproduce:
    - "Open the Manage integrations modal and switch the scope to Project."
    - "Pick a registered project."
    - "Select Claude Code and click Install selected."
    - "List the project root and compare the new skills/ directory with the .claude/skills/ path Claude Code reads."
    - "Repeat the run with OpenCode."
  expected: "A project install writes into the directory the tool reads inside a project, or the row reports the tool as ineligible at project scope."
  actual: "Eight SKILL.md files appear in a new top-level skills/ directory at the project root. That directory belongs to no tool, is not gitignored, and Claude Code never reads it. The row reports Installed. OpenCode behaves the same way."
  affected: "src/lib/agentic-tools-format.ts:27 (selectPrimaryFormat); src/public/lib/agentic-tools-scope.ts:19 (resolveBasePathForScope); src/lib/agentic-tools-install.ts:116 (the path join); src/lib/agentic-tools-catalogue.ts:50-54 (Claude Code skill-directory), :207-211 (OpenCode skill-directory)"
  environment: "macOS, Node >=20.14. The paths were measured by running the compiled modules in dist/lib/ against the real TOOL_CATALOGUE."
  tasks: []
  notes: "Shares its root cause with ISS-33-6bxf6h and ISS-38-gv3p2x. The workstream record puts the IntegrationFormat model change first, because one change addresses all three. Both tools have a documented project-level target: Claude Code reads <projectRoot>/.claude/skills/<name>/SKILL.md, and OpenCode reads <projectRoot>/.opencode/skills/<name>/SKILL.md (https://opencode.ai/docs/skills/, checked 2026-09-10), so neither needs to be reported ineligible at project scope. Any correction must add no runtime dependency."
  ```

- [x] ISS-35-m54y06. removeInstallation deletes one installed file out of many and orphans the rest

  ```yaml
  id: ISS-35-m54y06
  status: done
  severity: high
  author: Anthony Koukoullis
  description: "InstallRecord.resolvedPath at src/lib/agentic-tools-install-tracking.ts:16 is a single string. The write loop at src/lib/agentic-tools-install.ts:128 keeps only the first path, with `if (resolvedPath === null) resolvedPath = fullPath;`, and every later path is discarded before the record is built at :134. An install of the canonical suite writes one SKILL.md per skill, eight from CANONICAL_PRAXIS_SKILL_IDS, plus one write per bundled reference file, because skillDirectoryWrites at src/lib/agentic-tools-format.ts:31-42 emits an extra FileWrite for every entry in skill.files and mapEntriesToSkills in src/lib/skill-content-fetch.ts populates skill.files from the release archive. Exactly one of those paths is recorded, and removeInstallation at src/lib/agentic-tools-install.ts:199 removes only that one."
  steps_to_reproduce:
    - "Install the canonical skill suite into Claude Code at global scope, so eight skill directories are written."
    - "Read .praxis-installs.json and note that the record carries a single resolvedPath."
    - "Call the removal capability for that tool and scope, for example with POST /api/integrations/installs/remove."
    - "List ~/.claude/skills/ and read .praxis-installs.json again."
  expected: "Removal deletes every file and directory the install wrote, so the filesystem and the ledger agree that nothing is installed."
  actual: "fsWrite.remove runs with force and recursive set, so it deletes the single recorded path, which is one skill's SKILL.md. removeInstallRecord then drops the ledger entry and the registry is rewritten. Seven skill directories and every bundled reference file stay on disk with no ledger entry naming them, so nothing in the app can find or remove them again. checkSkillPresence keeps reporting those skills present while getInstallStatus reports nothing installed."
  affected: "src/lib/agentic-tools-install-tracking.ts:16 (InstallRecord.resolvedPath); src/lib/agentic-tools-install.ts:128, :134, :199; src/lib/agentic-tools-format.ts:31-42 (skillDirectoryWrites); src/lib/skill-content-fetch.ts (mapEntriesToSkills)"
  environment: "Every host that serves the integrations routes. Node >=20.14."
  tasks: []
  notes: "The recorded-path arithmetic was confirmed by running the modules. InstallRecord must carry the set of paths written, or a single containing directory, and that same change is the prerequisite for ISS-36-vl2cpx. ISS-37-niiof1 pins the current behaviour in a test and must be corrected in the same change. The correction in TL-103-9npvav records the files written, not the directories the install created with mkdir, so the per-skill directories stay behind empty after a removal; the tool loads nothing from an empty directory, and TL-103-9npvav Divergence 5 records the residue. Any correction must add no runtime dependency."
  ```

- [x] ISS-36-vl2cpx. An update writes the new skill set and never deletes the previous install

  ```yaml
  id: ISS-36-vl2cpx
  status: done
  severity: high
  author: Anthony Koukoullis
  description: "installToTarget compares the content hash at src/lib/agentic-tools-install.ts:94, and on a mismatch the branch at :112-129 computes the FileWrite list for the new content and writes it. Nothing enumerates or deletes what the previous install wrote. This is live rather than hypothetical, because the skill suite was renamed from prx-* to fc-*: CANONICAL_PRAXIS_SKILL_IDS now lists fc-orchestrate, fc-git, fc-bug-hunt, fc-issue-list, fc-dev-principles, fc-plan-feature, fc-task-list and fc-plain-text-kanban."
  steps_to_reproduce:
    - "Start from a machine that installed the prx-era suite, so eight prx-* skill directories exist under the tool config directory."
    - "Open the Manage integrations modal and install again, which resolves the current fc-* release."
    - "List the tool skill directory."
    - "Read .praxis-installs.json and count the records for that tool and scope."
  expected: "An update leaves only the current release on disk, so the tool loads one generation of the suite."
  actual: "The eight fc-* skill directories are written alongside the eight orphaned prx-* directories, which are never removed. The coding tool then loads sixteen skills, two full generations of the same suite, with overlapping trigger descriptions. The ledger records one install and gives no indication that the old set is still on disk."
  affected: "src/lib/agentic-tools-install.ts:112-129 (installToTarget update branch); src/lib/agentic-tools-install-tracking.ts:16 (InstallRecord.resolvedPath); src/lib/agentic-tools-canonical-skills.ts (CANONICAL_PRAXIS_SKILL_IDS)"
  environment: "Any machine carrying a pre-rename install. Node >=20.14."
  tasks: []
  notes: "Depends on the same InstallRecord shape change as ISS-35-m54y06: an update cannot clean up what the ledger never recorded. Any correction must add no runtime dependency."
  ```

- [x] ISS-37-niiof1. Two unit tests assert the defective install and remove behaviour as correct

  ```yaml
  id: ISS-37-niiof1
  status: done
  severity: high
  author: Anthony Koukoullis
  description: "src/test/unit/agentic-tools-install.test.ts:177 asserts `assert.equal(result.resolvedPath, '/home/fakeuser/.cursor/.cursor/rules/prx-alpha.mdc');` — the doubled Cursor path from ISS-33-6bxf6h, written down as the expected value. Line 312 asserts `assert.deepEqual(removeCalls.map((c) => c.path), [installed.resolvedPath]);`, which requires exactly one remove call. The fixture twoSkillContent at lines 68-85 of the same file carries two skills, prx-alpha and prx-beta, so prx-beta survives the removal described by ISS-35-m54y06 and the assertion still passes."
  steps_to_reproduce:
    - "Read src/test/unit/agentic-tools-install.test.ts:177 and compare the asserted path with the path Cursor reads."
    - "Read src/test/unit/agentic-tools-install.test.ts:312 with the twoSkillContent fixture at lines 68-85."
    - "Run the unit suite and note that it passes."
    - "Correct either the path resolution or the removal, and run the suite again."
  expected: "The tests assert the paths the target tools read, and assert that removal deletes every path the install wrote, so a regression in either behaviour fails the suite."
  actual: "The suite is green and stays green while both defects are present. Anyone correcting the path resolution or the removal breaks these two assertions, and without knowing why they exist may revert the correction to make them pass. The tests actively defend the defects."
  affected: "src/test/unit/agentic-tools-install.test.ts:177, :312, and the twoSkillContent fixture at :68-85"
  environment: "Node >=20.14 test runner. The CI test job runs this suite."
  tasks: []
  notes: "The workstream record requires these two assertions to be corrected in the same change that fixes ISS-33-6bxf6h and ISS-35-m54y06, or they will block that change."
  ```

- [ ] ISS-38-gv3p2x. Two format writers silently drop every bundled reference file

  ```yaml
  id: ISS-38-gv3p2x
  status: ready
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
  tasks: []
  notes: "Shares the IntegrationFormat model gap with ISS-33-6bxf6h and ISS-34-mpy9n0, and the workstream record groups all three behind that one change. Any correction must add no runtime dependency."
  ```

- [x] ISS-39-mu5wkq. installAllGlobal reports every thrown failure as skipped-no-format

  ```yaml
  id: ISS-39-mu5wkq
  status: dropped
  severity: medium
  author: Anthony Koukoullis
  description: "The per-tool try/catch in installAllGlobal at src/lib/agentic-tools-install.ts:171-181 pushes `{ status: 'skipped-no-format' }` for any thrown error, with no discrimination between a format the engine does not implement and a filesystem failure. The client maps that status to the user-facing string 'No format for this tool' in INSTALL_STATUS_LABEL in src/public/home.ts."
  steps_to_reproduce:
    - "Call installAllGlobal with a target whose base path is read-only, or on a full disk."
    - "Let the write inside installToTarget throw."
    - "Read the InstallResult returned for that tool."
    - "Map that status through INSTALL_STATUS_LABEL in src/public/home.ts."
  expected: "A write failure is reported as a write failure, distinct from a tool that genuinely has no implemented format."
  actual: "The result says the tool has no supported format, which is false. A user reading that message investigates the tool catalogue instead of the permissions, the disk, or the read-only target that actually caused the failure."
  affected: "src/lib/agentic-tools-install.ts:171-181 (installAllGlobal); src/public/home.ts (INSTALL_STATUS_LABEL)"
  environment: "Node >=20.14."
  tasks: []
  notes: "This function is currently unreachable, which is recorded separately as ISS-43-xszeei, so the defect is latent rather than live. It is the error handling any future caller inherits. Any correction must add no runtime dependency. Dropped: task 3 of TL-103-9npvav deleted installAllGlobal under ISS-43-xszeei, so the code this issue describes no longer exists and its failure scenario cannot occur."
  ```

- [x] ISS-40-798x06. parseInstallRegistry documents a wrong-shape rejection it does not perform

  ```yaml
  id: ISS-40-798x06
  status: done
  severity: medium
  author: Anthony Koukoullis
  description: "The comment above parseInstallRegistry at src/lib/agentic-tools-install-tracking.ts:31-33 states that it returns an empty list on any parse failure, naming malformed JSON and wrong shape. The body at :34-41 is `Array.isArray(parsed) ? (parsed as InstallRecord[]) : []`, which is a blind cast. Malformed JSON is handled by the catch. Wrong shape is not checked at all, so any array of arbitrary objects is returned as InstallRecord[]."
  steps_to_reproduce:
    - "Write .praxis-installs.json by hand as an array of objects that carry a toolId and a scope but no resolvedPath, which is also what a crash mid-write or an older format can leave behind."
    - "Start the app and let readRegistry parse that file."
    - "Call the removal capability for a toolId and scope present in that file, for example with POST /api/integrations/installs/remove."
    - "Read the HTTP response and the server output."
  expected: "A record that does not match InstallRecord is rejected, so parseInstallRegistry returns an empty list and removal is the documented idempotent no-op."
  actual: "The malformed records are returned as InstallRecord[]. findInstallRecord matches on toolId and scope and returns one. On the HTTP path the throw happens in the route, before removeInstallation is ever called: src/http/routes-integrations.ts:370 runs `const resolvedTarget = path.resolve(record.resolvedPath);` to build the permitted-root containment check, and path.resolve rejects an undefined argument with ERR_INVALID_ARG_TYPE. The removeInstallation call at :381 is never reached. On a direct, non-HTTP call the throw happens further in, where removeInstallation passes the same undefined value to fsWrite.remove at src/lib/agentic-tools-install.ts:199 and fs.rm rejects it the same way. Either path throws rather than performing the documented no-op. The HTTP route answers 500 from its own catch."
  affected: "src/lib/agentic-tools-install-tracking.ts:31-41 (parseInstallRegistry); src/lib/agentic-tools-install.ts:199 (removeInstallation); the POST /api/integrations/installs/remove route"
  environment: "Any host reading .praxis-installs.json. Node >=20.14."
  tasks: []
  notes: "The comparable posture the comment cites, readProjects in src/lib/projects.ts, is named in the comment itself. Any correction must add no runtime dependency, so the shape check uses plain Node and TypeScript, never a schema library."
  ```

- [x] ISS-41-qbdzgt. The install registry read-modify-write has no locking and its atomic write is keyed on pid alone

  ```yaml
  id: ISS-41-qbdzgt
  status: done
  severity: medium
  author: Anthony Koukoullis
  description: "installToTarget reads the registry at src/lib/agentic-tools-install.ts:91 and writes it at :147, with the whole install between them and nothing serializing the pair. src/http/routes-integrations.ts states in its own comment at line 248 that overlapping install requests are left unserialized. Separately, writeTextFileAtomic at src/lib/agentic-tools-fs-adapter.ts:107-111 writes to `${path}.${process.pid}.tmp` and then renames it over the target, so two concurrent writes to the same registry path from the same process share one temp filename."
  steps_to_reproduce:
    - "Open the app in two browser tabs against the same server process."
    - "Start an install of one tool in the first tab."
    - "Start an install of a different tool in the second tab before the first finishes, or retry a slow request so two are in flight."
    - "Read .praxis-installs.json when both requests have returned."
  expected: "Both installs are recorded. The registry file is well formed after any interleaving of concurrent writes."
  actual: "Both requests read the registry, both compute a next state from their own stale copy, and both write. One tool record is lost, so that tool files are on disk and untracked. Because both writes target the same registry path from the same pid, they share one temp filename, so the second fs.writeFile can interleave with the first fs.rename and produce a truncated or mixed registry file."
  affected: "src/lib/agentic-tools-install.ts:91 (read), :147 (write); src/lib/agentic-tools-fs-adapter.ts:107-111 (writeTextFileAtomic); src/http/routes-integrations.ts:248 (the comment recording the unserialized posture)"
  environment: "Any server process serving two concurrent install requests. Node >=20.14."
  tasks: []
  notes: "The lost-update path is the primary defect. The temp-file interleave is a narrower race with the same root. Any correction must add no runtime dependency, so serialization uses an in-process queue or a unique temp suffix from Node built-ins."
  ```

- [ ] ISS-42-q1t9bh. Skill presence is checked against a hand-maintained id list, not against what was installed

  ```yaml
  id: ISS-42-q1t9bh
  status: ready
  severity: medium
  author: Anthony Koukoullis
  description: "src/http/routes-integrations.ts passes CANONICAL_PRAXIS_SKILL_IDS to checkSkillPresence, and the ledger record of what the install actually wrote is never consulted. The header of src/lib/agentic-tools-canonical-skills.ts calls the array a provisional, hand-maintained duplicate of the canonical FlowCharge Core skill suite, and names WS-44-h5cpzp as the workstream meant to replace it. Nothing detects drift between that array and the published release."
  steps_to_reproduce:
    - "Install the current suite into a detected tool so every published skill is present on disk."
    - "Change the published release so it adds, removes or renames a skill, while CANONICAL_PRAXIS_SKILL_IDS keeps the old set."
    - "Reopen the Manage integrations modal and let the presence check run."
    - "Read the chip on the tool row and compare it with the files on disk."
  expected: "The presence check compares what is on disk against what the install actually wrote, so the chip matches reality after any change to the published suite."
  actual: "checkSkillPresence resolves expected paths from the hardcoded list. A correctly and completely installed tool reports Missing skills for a skill the release no longer ships, or reports Already installed while a newly added skill is absent. The chip is wrong in both directions and nothing detects the drift."
  affected: "src/lib/agentic-tools-canonical-skills.ts (CANONICAL_PRAXIS_SKILL_IDS); src/http/routes-integrations.ts (the checkSkillPresence call); src/lib/agentic-tools-skill-presence.ts (checkSkillPresence)"
  environment: "Every host that serves the integrations routes. Node >=20.14."
  tasks: []
  notes: "checkSkillPresence running only at global scope is a documented, bounded scope limit and is not part of this issue. Any correction must add no runtime dependency."
  ```

- [x] ISS-43-xszeei. installAllGlobal is exported and tested but no caller reaches it

  ```yaml
  id: ISS-43-xszeei
  status: done
  severity: low
  author: Anthony Koukoullis
  description: "installAllGlobal is defined at src/lib/agentic-tools-install.ts:164 and covered by a unit test at src/test/unit/agentic-tools-install.test.ts:328. `grep -rn \"installAllGlobal\" src/ electron/` with the tests excluded returns the definition and nothing else, so no production code path reaches it."
  steps_to_reproduce:
    - "Run `grep -rn \"installAllGlobal\" src/ electron/` and exclude the test directory from the results."
    - "Read the only hit, the definition at src/lib/agentic-tools-install.ts:164."
    - "Read the route handlers in src/http/routes-integrations.ts and confirm none of them calls it."
  expected: "Every exported function in the install engine is reached by a production caller, or is removed."
  actual: "The function is maintained, compiled and tested code that nothing calls. It carries the error-handling defect recorded as ISS-39-mu5wkq into any future caller that adopts it, and a reader auditing the install engine has to establish that it is unused before reasoning about the rest."
  affected: "src/lib/agentic-tools-install.ts:164 (installAllGlobal); src/test/unit/agentic-tools-install.test.ts:328"
  environment: ""
  tasks: []
  notes: "No runtime failure. If the function is kept rather than removed, ISS-39-mu5wkq applies to it."
  ```

- [x] ISS-44-mm57nt. An install that writes nothing records an empty path, which removal then passes to fs.rm

  ```yaml
  id: ISS-44-mm57nt
  status: done
  severity: low
  author: Anthony Koukoullis
  description: "resolvedPath starts as null at src/lib/agentic-tools-install.ts:114 and is only assigned inside the write loop. The record at :134 persists `resolvedPath: resolvedPath ?? ''`, so an install that produced no writes is stored with an empty string. removeInstallation at :199 passes that stored value straight to fsWrite.remove, and the only production caller, the POST /api/integrations/installs/remove route, first runs `path.resolve(record.resolvedPath)` on it at src/http/routes-integrations.ts:370 for the permitted-root check at :375."
  steps_to_reproduce:
    - "Supply an InstallContent whose skills array is empty, which a release archive whose entries all fail the SKILL.md requirement in mapEntriesToSkills would produce."
    - "Run installToTarget for any tool and scope."
    - "Read .praxis-installs.json and note the record with an empty resolvedPath."
    - "Call the removal capability for that tool and scope."
  expected: "An install that writes nothing records no install, or removal treats an empty path as nothing to delete."
  actual: "formatForTarget returns no writes, the loop body never runs, and the record is persisted with resolvedPath set to an empty string. On a direct engine call, fs.rm('') with the recursive and force options resolves without an error on Node 24.12.0 and Bun 1.3.14, because the empty path answers ENOENT and force suppresses it, so removeInstallation deletes nothing and drops the record. On the HTTP route, path.resolve('') at src/http/routes-integrations.ts:370 resolves to the server's working directory, which is never under the permitted root, so the check at :375 answers 400 'Refused remove path outside the permitted root' and the record stays in the ledger. Measured by driving the compiled route in-process against a ledger holding one such record: the route answers 400 and the record survives. Through the app, the empty record can never be removed."
  affected: "src/lib/agentic-tools-install.ts:114, :134, :199; src/http/routes-integrations.ts:370-380 (the remove route's permitted-root check); src/lib/skill-content-fetch.ts (mapEntriesToSkills, which produces the empty skills array)"
  environment: "Node >=20.14. The engine call and the route were executed against a scratch ledger; the empty-archive precondition itself is plausible rather than observed."
  tasks: []
  notes: "mapEntriesToSkills returns an empty skills array without throwing when the release archive holds no SKILL.md, so getInstallContent hands the route empty content and the precondition is reachable. The InstallRecord shape change behind ISS-35-m54y06 touches the same field. Any correction must add no runtime dependency."
  ```

- [x] ISS-45-fugjwv. Install paths are assembled with a hardcoded forward slash

  ```yaml
  id: ISS-45-fugjwv
  status: done
  severity: low
  author: Anthony Koukoullis
  description: "src/lib/agentic-tools-install.ts:116 builds the target with `${target.basePath}/${write.relativePath}`, and :125 derives the directory to create by calling fullPath.replace with a regular expression that strips the final segment, matching forward slashes only. src/lib/agentic-tools-skill-presence.ts:53 and :71 join the same way. The catalogue carries Windows configDir values written with backslashes, for example '%USERPROFILE%\\\\.claude\\\\' at src/lib/agentic-tools-catalogue.ts:47."
  steps_to_reproduce:
    - "Read the Windows configDir entries in src/lib/agentic-tools-catalogue.ts, for example line 47."
    - "Read the join at src/lib/agentic-tools-install.ts:116 and the directory derivation at :125."
    - "Trace an expanded Windows base path through both, and note that the derivation regular expression matches forward slashes only."
    - "Compare with the containment check at :120-122, which normalises through path.resolve."
  expected: "Paths are joined and split with the host path separator rules, so the directory the engine creates matches the file it then writes on every platform."
  actual: "The expanded Windows base path uses backslashes and is joined to a forward-slash template, giving a mixed-separator path. path.resolve normalises it for the containment check at :120-122, but the directory derivation at :125 mis-derives the mkdir target because it matches forward slashes only."
  affected: "src/lib/agentic-tools-install.ts:116, :125; src/lib/agentic-tools-skill-presence.ts:53, :71; src/lib/agentic-tools-catalogue.ts:47 (Windows configDir values)"
  environment: "Windows only. tools/package-cli.mjs defaults to darwin-arm64, darwin-x64 and linux-x64, so Windows is not a shipping target and this is latent."
  tasks: []
  notes: "The code is read directly. The Windows impact is reasoned, not executed. node:path is a built-in, so any correction adds no runtime dependency."
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
  notes: "Recorded in TL-103-9npvav as a divergence from ISS-36-vl2cpx. Deriving the unrecorded paths, for example by deleting a whole skills directory, was refused there because it could delete files this app never wrote. This issue names no direction and recommends none. Any correction must add no runtime dependency."
  ```
