---
id: IL-13-b7y4ud
type: issuelist
workstream: WS-82-4z5dg7
slug: integrations-tool-list-flattening-and-scope
title: "Integrations detection failure-path defects"
status: done
created: 2026-08-30
updated: 2026-08-31
depends_on: []
links: []
---

# PRX Issue List

- [x] ISS-25-9nrlpb. Detection failure box renders into the hidden CLI panel, leaving the Desktop apps panel blank

  ```yaml
  id: ISS-25-9nrlpb
  status: done
  severity: low
  author: Anthony Koukoullis
  description: "renderIntegrationsFailure in src/public/home.ts (lines 585-597) clears both integrations tab panels, then appends the error box unconditionally to panelCli ('integrations-panel-cli'). It never reads currentIntegrationsTab and never checks which panel is active. selectIntegrationsTab (home.ts:350-363) hides the inactive panel with .hidden = true, and styles.css:164 applies [hidden] { display: none !important; }, so a hidden panel is fully invisible. When a detection failure occurs while the Desktop apps tab is selected, the error box lands in the hidden CLI panel and the visible Desktop apps panel is left empty. Both failure call sites reach this code: the missing-API guard at home.ts:615 and the trailing .catch at home.ts:637. The Re-scan and Install selected buttons sit outside both panels and stay visible, with Install selected disabled and no explanation. Origin traced to commit bec0548 (2026-08-19, WS-43), which shipped the two-panel tab layout; the hardcoded panelCli target was carried forward unchanged when the code was extracted into renderIntegrationsFailure in commit 4be85ca (2026-08-30, WS-79)."
  steps_to_reproduce:
    - "Open Manage Integrations and let detection succeed, so four tool rows render."
    - "Click the 'Desktop apps' tab."
    - "Make the next detection call fail. Option A: stop and restart the local server while the dialog stays open, so fetchIpc resolves {ok:false, status:0} and unwrapIpc throws. Option B: widen the HOST environment variable beyond loopback and open the dashboard from a non-local device, so the loopback gate in src/server.ts:774-786 answers every /api/integrations/* request with HTTP 403."
    - "Click 'Re-scan'."
    - "Look at the visible Desktop apps panel."
  expected: "The failure box appears in the panel the user is looking at, so the user sees the heading and the detail text for the failure."
  actual: "The Desktop apps panel is empty. The failure box is appended to the hidden Command-line tools panel, so nothing explains the failure. Install selected is disabled with no visible reason."
  affected: "src/public/home.ts (renderIntegrationsFailure lines 585-597, call sites at 615 and 637, selectIntegrationsTab lines 350-363), src/public/styles.css:164, src/server.ts:774-786 (loopback gate, one trigger path)"
  environment: "Browser-tab transport of the dashboard. Reproduces deterministically, with no race and no timing dependency."
  tasks: [TL-86-2ioc8a.1.2]
  notes: "A sibling change in this same workstream flattens the two tab panels into one list, which removes this defect structurally because only one container remains. File and fix verification still apply, so the fix is confirmed after the flattening lands and not assumed. Closed 2026-08-31 on TL-86-2ioc8a.1.2's static/structural evidence, accepted by Anthony Koukoullis as sufficient in place of a live reproduction (src/server.ts is off-limits per that task's pattern key, and no second LAN device was available to trigger the loopback-gate path)."
  ```

- [x] ISS-26-abmbhc. One failed presence check discards every already-rendered detection row

  ```yaml
  id: ISS-26-abmbhc
  status: done
  severity: medium
  author: Anthony Koukoullis
  description: "In loadIntegrationsDetection (src/public/home.ts:621-638), renderIntegrationsRows(rows) renders all detected tool rows first. A checkInstalledSkills presence probe then runs for each row eligible at Global scope, and all probes are aggregated with a single Promise.all(checks). Promise.all rejects as soon as one promise rejects, and that rejection is caught by the same outer .catch at line 637 that handles total detection failure. The .catch calls renderIntegrationsFailure, which sets integrationsRowEntries = [] and clears both panels. Correct, already-rendered rows are therefore destroyed and replaced by a generic 'Couldn't detect installed tools' box because one unrelated presence probe failed. updateInstallSelectedButtonState() then disables Install selected, so the known-good rows cannot be installed either. No per-check error isolation exists."
  steps_to_reproduce:
    - "Open Manage Integrations with at least one tool detected as eligible at Global scope, so detection succeeds and the tool rows render."
    - "Make exactly one tool's checkInstalledSkills call fail, for example an HTTP 500 from handleIntegrationsSkillPresence in src/server.ts:466-489, or a network interruption that affects only that one request."
    - "Let the other tools' presence probes resolve normally."
    - "Look at the integrations list."
  expected: "The rows that detected correctly stay on screen. Only the tool whose presence probe failed shows a failed or unknown presence state."
  actual: "Every rendered row is discarded and replaced by a single generic 'Couldn't detect installed tools' failure box, and Install selected becomes disabled."
  affected: "src/public/home.ts:621-638 (loadIntegrationsDetection, the Promise.all aggregation and the shared outer .catch), src/public/home.ts:585-597 (renderIntegrationsFailure), src/server.ts:466-489 (handleIntegrationsSkillPresence)"
  environment: "Browser-tab transport of the dashboard."
  tasks: [TL-86-2ioc8a.1.1]
  notes: "The tab-panel flattening in this workstream does not fix this defect. Flattening only changes which container an error box lands in, not the promise aggregation. This needs its own fix."
  ```
