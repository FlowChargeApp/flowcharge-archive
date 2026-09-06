---
id: IL-1-ub7gho
type: issuelist
workstream: WS-4-50vnol
slug: inline-css-extraction
title: "Inline CSS extraction findings"
status: done
created: 2026-08-04
updated: 2026-08-04
depends_on: []
links: []
---

# PRX Issue List

- [x] ISS-1-jkza6i. In-progress status colour resolves to transparent (`--st-in-progress` never defined)

  ```yaml
  id: ISS-1-jkza6i
  status: done
  severity: medium
  description: "public/app.js builds status colour custom-property names by string concatenation, 'var(--st-' + s + ')', where s comes from STATUS_ORDER (app.js:2) and includes the literal value 'in-progress'. This yields the property names --st-in-progress and --st-in-progress-bg. public/styles.css defines only --st-progress and --st-progress-bg (no '-in-' infix), in every one of its theme blocks (:root, the prefers-color-scheme dark block, and the explicit light/dark theme overrides). The names built by app.js therefore match nothing the stylesheet defines. The four call sites are app.js lines 85, 94, 95, 251 and 293. This mismatch predates the extraction of the inline <style> block from public/index.html into public/styles.css and is unaffected by it: the moved CSS is byte-for-byte identical to the block in commit 0b54642, confirmed by exact diff."
  steps_to_reproduce:
    - "Open the dashboard with board data containing at least one workstream or artefact whose status is 'in-progress' (the normal case)."
    - "Look at the 'In Progress' column header dot, and any KPI bar segment or status chip representing the in-progress status."
    - "Inspect the element and read its computed background colour."
  expected: "The in-progress dot, bar segment and chip render in the amber status colour the stylesheet holds under --st-progress (#A8721B light, #E0A83F dark), consistent with every other status."
  actual: "The undefined custom property resolves to nothing and the computed colour falls back to rgba(0, 0, 0, 0) — fully transparent. The in-progress dot and bar segment render invisible/uncoloured while every other status renders in its assigned colour. Directly observed in a live browser render: the 'In Progress' column dot computed to rgba(0, 0, 0, 0)."
  affected: "public/app.js (STATUS_ORDER at line 2; var(--st-...) construction at lines 85, 94, 95, 251, 293), public/styles.css (--st-progress / --st-progress-bg definitions)"
  environment: "Any browser; static app, no build step."
  tasks: [TL-2-iexi8i task 1]
  notes: "Cosmetic only — no data loss, no crash, no incorrect data — but reproducible on every page load, for every user, on the most commonly shown status, with no user-side workaround. The mismatch can be closed from either side: rename the CSS custom properties --st-progress / --st-progress-bg to --st-in-progress / --st-in-progress-bg across every block that defines them, or normalise the status string in app.js before building the variable name. Whichever side is changed, all other STATUS_ORDER values must keep resolving: --st-backlog, --st-ready, --st-blocked, --st-done, --st-dropped and their -bg counterparts must not break. Note styles.css also references var(--st-done) at line 347 and var(--st-blocked) at line 396 directly."
  ```
