---
id: IL-17-1xu0n0
type: issuelist
workstream: WS-106-1xers0
slug: skill-install-target-resolution-and-lifecycle
title: "Skill presence check misses OpenCode's legacy singular skill folder"
status: ready
created: 2026-09-10
updated: 2026-09-10
author: Anthony Koukoullis
depends_on: []
links: []
---

# FlowCharge Issue List

- [ ] ISS-47-yug5gc. The presence check reports OpenCode's legacy singular skill folder as not installed

  ```yaml
  id: ISS-47-yug5gc
  status: ready
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
  tasks: []
  notes: "Confidence is high on the code path and on the measurement. On OpenCode's behaviour, confidence is high for version 1.18.27. It comes from the binary's own discovery constant and bundled reference text, not from OpenCode's public docs, which are known to lag. Scope of today's impact: the presence check runs at global scope only, which src/public/home.ts documents as a deliberate, bounded limit and which is not a defect, so the live case is `~/.config/opencode/skill/`. OpenCode also reads the project-scope equivalent, `.opencode/skill/`, but the presence check cannot reach it until that scope limit changes. Severity is low because FlowCharge never writes the singular folder, so the defect needs a manual or older install, but its consequence is a duplicate install. This is a different defect from ISS-42-q1t9bh, which concerns the same function comparing against a hand-maintained id list. The defect survives TL-103-9npvav unchanged, because TL-103-9npvav still resolves one plural path per skill. This issue concerns OpenCode's own two folder spellings only. OpenCode also reads skill folders that belong to other tools, `.claude/skills/` and `.agents/skills/`, but the maintainer treats every coding tool as separate, so those folders must not count towards OpenCode's presence, and one tool's install never satisfies another's. Context, not a separate defect and not a proposed direction: IntegrationFormat already declares an optional deprecatedFallback field at src/lib/agentic-tools-catalogue.ts:21, and Cursor (:111) and Windsurf (:154) set it. No code outside the catalogue reads it. OpenCode's skill-directory entry does not set it. Nothing here needs a runtime dependency, and none may be added silently."
  ```
