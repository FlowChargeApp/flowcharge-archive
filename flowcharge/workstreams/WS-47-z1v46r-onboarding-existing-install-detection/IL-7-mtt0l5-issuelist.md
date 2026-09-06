---
id: IL-7-mtt0l5
type: issuelist
workstream: WS-47-z1v46r
slug: onboarding-existing-install-detection
title: "Manage integrations dialog: install status not read from persisted registry on open"
status: done
created: 2026-08-19
updated: 2026-08-19
depends_on: []
links: []
---

# PRX Issue List

- [x] ISS-11-sbxv53. Integrations dialog never calls getInstallStatus() on open, so pre-existing Praxis installs show no install-status chip

  ```yaml
  id: ISS-11-sbxv53
  status: done
  severity: medium
  author: Anthony Koukoullis
  description: "The 'Manage integrations' dialog (#integrations-modal, WS-43) only calls window.praxisSkillInstallAPI.detectTools() when it loads or when 'Re-scan' is clicked. It never calls window.praxisSkillInstallAPI.getInstallStatus() — the fourth IPC method WS-42 built and WS-43 already exposes on the preload bridge, which reads the persisted .praxis-installs.json tracking registry maintained by installToTarget()/installAllGlobal(). detectTools() only reports whether the external tool itself is present on the machine (PATH binary and/or config-dir existence); it has no knowledge of whether Praxis's own skill files were already written to that target by a prior install run. As a result, buildIntegrationsRow() only ever populates a target's install-status chip from a fresh installSelected() call made in the current dialog session — never from the persisted registry — so a target that Praxis already installed to in a previous session or a previous dialog open renders identically to a target that has never been installed to."
  steps_to_reproduce:
    - "Run the app and use 'Manage integrations' (Global scope) to install Praxis's skill to a detected tool (e.g. Claude Code), so installToTarget() writes an entry for it into the persisted .praxis-installs.json registry."
    - "Close the 'Manage integrations' dialog (or restart the app / start a new session)."
    - "Re-open 'Manage integrations' with Global scope and the 'Command-line tools' tab; do not click 'Install selected' or 'Re-scan' beyond the automatic open-time load."
    - "Observe the row for the previously-installed tool."
  expected: "On open, loadIntegrationsDetection() also calls getInstallStatus() and buildIntegrationsRow() reflects the persisted registry, so a target Praxis already installed to shows its real install-status chip (e.g. up-to-date) immediately, without requiring the user to re-run install."
  actual: "The row's checkbox is unchecked and its install-status chip is blank/hidden — identical in appearance to a target that has never had Praxis installed — even though the tool itself correctly shows a 'confirmed' detection-status chip from detectTools(). The true state only surfaces if the user clicks 'Install selected' again, which then resolves via WS-42's hash comparison to 'up-to-date'."
  affected: "src/public/home.ts: loadIntegrationsDetection(), buildIntegrationsRow(), installIntegrationsSelected(); electron/preload.cts (window.praxisSkillInstallAPI.getInstallStatus); electron/agentic-tools-ipc-handlers.cts (getInstallStatus IPC handler)"
  environment: ""
  tasks: [TL-45-s0t4ii.1]
  notes: "Fixed and live-verified 2026-08-19: loadIntegrationsDetection() now fetches getInstallStatus() alongside detectTools(), joined client-side by toolId+scope. A matched record renders a distinct 'Already installed' chip (kept separate from the live install-result vocabulary) and stays unchecked, per the investigation's recommendation. Verified live against a real InstallRecord written to a disposable throwaway project — confirmed via screenshot and DevTools Protocol inspection, not just code review."
  ```

- [x] ISS-12-yngl4x. Integrations dialog still misses real pre-existing Praxis installs because install status is derived only from the app's own install-tracking ledger, not from actual filesystem presence

  ```yaml
  id: ISS-12-yngl4x
  status: done
  severity: medium
  author: Anthony Koukoullis
  description: "ISS-11-sbxv53 fixed the dialog to read its own app-internal install-tracking ledger (.praxis-installs.json) via getInstallStatus() on open. That fix is correct as far as it goes, but the ledger only records installs performed BY THIS APP's own installSelected() action. It has no way to know about Praxis skill files that exist on disk for any OTHER reason (manually placed, installed by an earlier tool version, or set up independently of this app entirely). Confirmed directly on this machine: .praxis-installs.json does not exist at all (zero app-driven installs have ever happened), yet the real global folders both already contain the full real Praxis skill suite: ~/.claude/skills/ (prx-orchestrate, prx-git, prx-bug-hunt, prx-issue-list, prx-dev-principles, prx-plan-feature, prx-task-list, prx-plain-text-kanban, plus one unrelated skill, ak-prx-migrate, not part of the prx- suite) and ~/.config/opencode/skills/ (the same 8 prx-* skills). The dialog should instead check for the actual presence of the canonical Praxis skill folders/files on the real filesystem at each detected target's resolved path — independent of whatever the app's own install-tracking ledger says — and report three states: fully installed (all 8 canonical skills present), missing/incomplete installation (some but not all present), or not installed (none present). The canonical skill suite is exactly: prx-orchestrate, prx-git, prx-bug-hunt, prx-issue-list, prx-dev-principles, prx-plan-feature, prx-task-list, prx-plain-text-kanban — ak-prx-migrate is not part of it."
  steps_to_reproduce:
    - "On a machine where the real Praxis skill suite was set up in a detected tool's real global config folder by some means other than this app's own 'Install selected' action (manually placed, an earlier tool version, or independent setup) — do not use this app's installSelected() at all, so .praxis-installs.json has no entry for that target."
    - "Confirm the target's canonical skill files are genuinely present on disk (e.g. `ls ~/.claude/skills/` shows all 8 prx-* skill folders)."
    - "Run the app and open 'Manage integrations' (Global scope), 'Command-line tools' tab."
    - "Observe the row for that tool."
  expected: "The dialog checks the real filesystem for the presence of the 8 canonical Praxis skill folders/files at the target's resolved path and shows a distinct 'fully installed' status when all 8 are present, 'missing/incomplete' when some but not all are present, and 'not installed' when none are present — regardless of whether this app's own install ledger has a record for that target."
  actual: "The row shows the tool as merely 'Confirmed' (detected) with no 'Already installed' indication and an unchecked box — identical in appearance to a target where Praxis has never been set up — because the app's own install-tracking ledger has no record of installs it did not perform itself."
  affected: "src/public/home.ts (Manage integrations dialog, status-derivation logic reading integrationsInstallRecords from getInstallStatus() per ISS-11-sbxv53's fix); src/lib/agentic-tools-format.ts (formatForTarget, which already resolves a skill id to its target format-specific file/folder path per tool); potentially a new function/IPC surface to read real filesystem skill presence — exact fix location not yet settled"
  environment: ""
  tasks: [TL-45-s0t4ii.3.1, TL-45-s0t4ii.3.2, TL-45-s0t4ii.3.3, TL-45-s0t4ii.3.4, TL-45-s0t4ii.3.5, TL-45-s0t4ii.3.6]
  notes: "Fixed and live-verified 2026-08-19: new src/lib/agentic-tools-canonical-skills.ts (the 8-skill list) and agentic-tools-skill-presence.ts check real filesystem presence per skill via formatForTarget's resolved paths, exposed as a new checkInstalledSkills IPC channel and wired into the dialog, replacing the ledger-based pre-action chip entirely. Verified live on this machine's real, pre-existing data (no app-driven install involved): Claude Code and OpenCode both correctly show 'Already installed' (their real ~/.claude/skills/ and ~/.config/opencode/skills/ genuinely have all 8 skills); Cursor and Windsurf correctly show not-detected. Screenshots taken. Depended on ISS-13-hwhz6b's fix landing first."
  ```

- [x] ISS-13-hwhz6b. selectPrimaryFormat() picks OpenCode's unimplemented structured-config-file entry over its working skill-directory entry, so OpenCode installs always fail as skipped-no-format

  ```yaml
  id: ISS-13-hwhz6b
  status: done
  severity: high
  author: Anthony Koukoullis
  description: "selectPrimaryFormat(tool) in src/lib/agentic-tools-format.ts returns the FIRST entry in tool.integrationFormats whose kind !== 'mcp-json', with no other selection logic. For OpenCode's real catalogue entry in src/lib/agentic-tools-catalogue.ts, integrationFormats is ordered [structured-config-file(opencode.json), structured-config-file(tui.json), skill-directory(skills/<name>/SKILL.md), markdown-context-file(AGENTS.md)]. selectPrimaryFormat therefore returns the structured-config-file (opencode.json) entry — but formatForTarget's kind-dispatch never implemented 'structured-config-file' (explicitly out of scope per WS-42's own plan) and throws 'formatForTarget: kind ... is not yet implemented' for it. WS-42's task 4.1 (installAllGlobal) wraps each per-tool call in try/catch specifically to survive this throw, folding it into InstallResult.status: 'skipped-no-format' — so OpenCode currently ALWAYS resolves to skipped-no-format on every install attempt, even though OpenCode's own catalogue entry lists a working, implemented skill-directory format (the third entry in the array) that exactly matches OpenCode's real, observed layout (confirmed on this machine: ~/.config/opencode/skills/<id>/SKILL.md)."
  steps_to_reproduce:
    - "Run the app and use 'Manage integrations' (Global scope) with OpenCode detected as an installable target."
    - "Select OpenCode and click 'Install selected'."
    - "Observe the resulting InstallResult for OpenCode."
  expected: "Since OpenCode's catalogue entry includes a working, implemented skill-directory format (skills/<name>/SKILL.md, matching OpenCode's real on-disk layout), the install should succeed by writing to that format, resulting in InstallResult.status reflecting a real write (e.g. installed/up-to-date)."
  actual: "installSelected()/installAllGlobal() always resolves OpenCode to InstallResult.status: 'skipped-no-format', because selectPrimaryFormat picks the first non-mcp-json entry (structured-config-file, opencode.json) rather than the working skill-directory entry, and formatForTarget throws for structured-config-file (never implemented, out of scope per WS-42). The generic 'skipped' status gives the user no indication a working alternative format exists."
  affected: "src/lib/agentic-tools-format.ts (selectPrimaryFormat, formatForTarget); src/lib/agentic-tools-catalogue.ts (OpenCode's integrationFormats array order)"
  environment: ""
  tasks: [TL-45-s0t4ii.2.1, TL-45-s0t4ii.2.2]
  notes: "Fixed 2026-08-19: selectPrimaryFormat now skips every IntegrationFormat kind formatForTarget doesn't implement (mcp-json and structured-config-file), not just mcp-json — OpenCode now correctly resolves to its real skill-directory format. Verified against real catalogue data and via a full test-suite sweep (69/69 pass) after also correcting two other tests whose hardcoded expectations depended on the old buggy behavior."
  ```
