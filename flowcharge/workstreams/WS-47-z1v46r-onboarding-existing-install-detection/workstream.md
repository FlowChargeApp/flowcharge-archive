---
id: WS-47-z1v46r
type: workstream
workstream: WS-47-z1v46r
slug: onboarding-existing-install-detection
title: "Onboarding dialog doesn't reflect already-installed Praxis skills"
status: done
tags: [bug, ui, agentic-tools, group2]
created: 2026-08-19
updated: 2026-08-19
author: Anthony Koukoullis
depends_on: [WS-43-4cpdch]
links: []
---
The "Manage integrations" dialog's checkboxes don't reflect whether Praxis is already installed at a detected target — only whether the tool itself is detected.

Found by the user testing the real app: with Global scope and the "Command-line tools" tab open, both Claude Code and OpenCode show a "confirmed" detection-status chip, but neither row's checkbox is pre-ticked. The user's own diagnosis, confirmed against the code: `detectTools()` (WS-41) answers "is this tool present on the machine" — PATH binary and/or config-dir existence — it has no knowledge of whether Praxis's own skill files already live inside that config dir. `getInstallStatus()` (WS-42, already wired as a fourth method on `window.praxisSkillInstallAPI` since WS-43) answers the actual question — it reads the `.praxis-installs.json` tracking registry WS-42's `installToTarget`/`installAllGlobal` maintain — but WS-43's dialog never calls it. So a target that already has Praxis installed looks identical, in the UI, to one that has never been touched: same "confirmed" detection chip, same unchecked box.

Open question the user raised, not settled here (belongs to this workstream's own investigation/plan): should an already-installed, up-to-date target come pre-checked, or just show a distinct "already installed" status alongside an unchecked box? Either way, the dialog needs to call `getInstallStatus()` (or fold its result into the same `detectTools()` response) and render that state, not just detection confidence.

The user explicitly asked for a new workstream rather than an ad hoc fix, to be investigated and planned properly rather than assumed. It depends on WS-43-4cpdch (the dialog this fixes) and, transitively, on WS-42-7fm9ak (the install-tracking registry it needs to read). Positioned as the next item in this same Group 2 sequence — the user is fine with it running either immediately after WS-43 or later; no other workstream's ordering was disturbed by inserting it, since WS-43 was the last item in the original three-item batch.
