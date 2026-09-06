---
id: TL-12-iq97kz
type: tasklist
workstream: WS-11-vtcy55
slug: sort-button-severity-cue
title: "Board-wide severity dot on the Severity sort button"
status: done
created: 2026-08-06
updated: 2026-08-06
depends_on: [PLN-11-gj0gib]
links: []
mode: spec
base_commit: 7429882
---

# PRX Tasks

## Board-wide severity dot on the Severity sort button

Implements PLN-11. Adds a small colored dot to the "Severity" pill in
`#sort-key-seg` (`src/public/board.html:36`), showing the board's single worst
open-issue severity project-wide, reusing `SEV_ORDER`/`SEV_LABEL`
(`src/public/app.ts:4-5`), `dominantSeverity()` and the `.dot-sm` shape class WS-9
already generalized (`src/public/styles.css:352`) — the same visual language as
WS-9's per-card dot. The computation is free: `renderSeverity()`
(`src/public/app.ts:726-751`) already builds `counts` on every `applyData()` call;
this plan adds ~10 lines inside that existing IIFE plus one scoped CSS rule. No
server change, no wire-shape change. The plan is small enough for one stage; this
file mirrors that with one parent task and one child per touched file, in the
plan's own order, plus the plan's own manual-verification child.

- [x] 1. Stage 1 — Severity-button dot
  ```yaml
  description: "Add the scoped CSS layout rule, render/update the dot inside renderSeverity(), then manually verify against temporary fixture data, per PLN-11's single stage."
  ```

  - [x] 1.1 CSS: add the scoped layout rule
    ```yaml
    description: "Add a layout rule scoped to the Severity pill only, so a .dot-sm child can render inline inside it."
    issues: []
    implement:
      - "File: src/public/styles.css. Anchor: the existing `.seg` rule block (current lines 238-251), specifically right after the `.seg button.active` rule (current line 250). Add one new rule scoped to `.seg button[data-key=\"severity\"]` only — not the bare `.seg button` selector all five pills share — setting `display: inline-flex; align-items: center; gap: 4px;` so a `.dot-sm` span can render as a 6x6px circle inside this one button, matching Design's CSS section in PLN-11."
      - |
        <<<<<<< SEARCH
        .seg button.active { background: var(--accent); color: #fff; }
        .seg button:focus-visible, input:focus-visible, .card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        =======
        .seg button.active { background: var(--accent); color: #fff; }
        .seg button[data-key="severity"] { display: inline-flex; align-items: center; gap: 4px; }
        .seg button:focus-visible, input:focus-visible, .card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        >>>>>>> REPLACE
    pattern: "src/public/styles.css"
    imports: "None. `.dot-sm` (styles.css:352) already exists as a bare selector since WS-9 — no new shape rule needed."
    compatibility: "Scoped to `.seg button[data-key=\"severity\"]` specifically, not the shared `.seg button` selector (styles.css:239-247) — the other four pills (Artefact ID, Name, Created, Updated) must not gain this rule."
    gotcha: "No dot exists yet at this point in the sequence (task 1.2 adds it), so this rule has no visible effect until task 1.2 lands — the board must render identically to before after this task alone."
    verify:
      - "Reload the board; all five sort-key pills render identically to before (no dot exists yet to lay out)."
      - "grep -n 'data-key=\"severity\"' src/public/styles.css — exactly one rule matches, scoped to that attribute selector."
    checklist:
      - "The new rule reads exactly `.seg button[data-key=\"severity\"] { display: inline-flex; align-items: center; gap: 4px; }`."
      - "The rule is scoped to `[data-key=\"severity\"]` only — the shared `.seg button` rule (lines 239-247) is untouched."
      - "`.dot-sm`'s own shape rule (styles.css:352) is untouched."
      - "No visible change to the board after this task alone (no dot exists yet)."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.2 Logic: render/update the dot inside `renderSeverity()`
    ```yaml
    description: "Insert the dot render/update/remove block directly after counts is populated in the existing renderSeverity() IIFE, reusing dominantSeverity(counts) unchanged."
    issues: []
    implement:
      - "File: src/public/app.ts. Anchor: the existing `renderSeverity()` IIFE (current lines 726-751), directly after the `openIssues.forEach` line that populates `counts` (current line 731) and before `var bar = byId('sev-bar');` (current line 732). Depends on task 1.1 (the dot needs the layout rule to render at the right size)."
      - "Look up the Severity button fresh by its `data-key` attribute (matching this file's existing convention of `querySelector`/`querySelectorAll` at point of use, e.g. app.ts:191-204) — do not cache it in a module-scope var, since `#sort-key-seg`'s five buttons are static HTML that never rebuild."
      - "Pass `counts` (Record<string, number>) directly to `dominantSeverity(mix: SevMix)` with no cast — its index signature structurally satisfies SevMix's four required number properties, the same fact WS-9's own `sevMix![w.id]` call site relies on."
      - "When `dominant` is a tier: reuse an existing `.dot-sm` child if present (idempotence — no duplicate node on repeat calls), else create and insert one via `el('span', 'dot-sm')`; set its `background` to `var(--sev-' + dominant + ')` and set the button's `title` to `'Worst open severity, board-wide: ' + SEV_LABEL[dominant]` every call."
      - "When `dominant` is null (zero open issues): remove the existing dot node and the button's `title` attribute if present, so no stale dot or tooltip survives a poll-triggered re-render."
      - |
        <<<<<<< SEARCH
              openIssues.forEach(function (i) { if (i.severity != null && counts[i.severity] != null) counts[i.severity]++; });
              var bar = byId('sev-bar');
        =======
              openIssues.forEach(function (i) { if (i.severity != null && counts[i.severity] != null) counts[i.severity]++; });

              var sevBtn = document.querySelector('#sort-key-seg button[data-key="severity"]') as HTMLElement | null;
              if (sevBtn) {
                var dominant = dominantSeverity(counts);
                var dot = sevBtn.querySelector('.dot-sm') as HTMLElement | null;
                if (dominant) {
                  if (!dot) {
                    dot = el('span', 'dot-sm');
                    sevBtn.insertBefore(dot, sevBtn.firstChild);
                  }
                  dot.style.background = 'var(--sev-' + dominant + ')';
                  sevBtn.title = 'Worst open severity, board-wide: ' + SEV_LABEL[dominant];
                } else if (dot) {
                  dot.remove();
                  sevBtn.removeAttribute('title');
                }
              }

              var bar = byId('sev-bar');
        >>>>>>> REPLACE
    pattern: "src/public/app.ts"
    imports: "dominantSeverity() (app.ts:54-57, WS-9), SEV_LABEL (module scope, app.ts:5), el() (app.ts:19-24), .dot-sm CSS shape + task 1.1's layout rule — all already exist, no new import."
    compatibility: "Must not read or write sortKey/sortDir — the cue is identical regardless of active sort. Must not reference sevMix (the per-workstream structure) — board-wide counts and per-workstream sevMix are deliberately independent aggregates over the same issues array."
    gotcha: "Idempotence: the dot must be looked up before creation and reused if present, only background/title updated on a repeat call with unchanged dominant — no duplicate .dot-sm nodes across repeated applyData() calls. When dominant flips to null, the existing dot node and title attribute must be explicitly removed, not left stale. dominant is narrowed from string | null to string by the `if (dominant)` check before indexing SEV_LABEL[dominant], the same pattern WS-9 uses at app.ts:81-86."
    verify:
      - "npx tsc -p tsconfig.json --noEmit"
      - "npx tsc -p src/public/tsconfig.json --noEmit"
      - "npm run build"
      - "grep -E \"^\\s*(import|export)\\s\" dist/public/app.js — must return no matches, confirming app.js remains a classic script."
    checklist:
      - "The block is inserted directly after the openIssues.forEach line that populates counts, before var bar = byId('sev-bar')."
      - "dominantSeverity(counts) is called with no cast; counts is not renamed or restructured."
      - "A repeat call with the same dominant leaves exactly one .dot-sm node under the Severity button and does not create a duplicate."
      - "When dominant is null, any existing dot node and the button's title attribute are removed."
      - "No code in this block reads sortKey/sortDir or sevMix."
      - "Both tsc -p projects and npm run build complete with zero errors; dist/public/app.js has no import/export."
    self_eval:
      passed: true
      failures: []
      note: "The execute-parent-task subagent correctly found and refused to silently work around a real type error: dominantSeverity(mix: SevMix) does not structurally accept a Record<string, number> argument at a call site (TypeScript requires the named properties, not just a compatible index signature) — the task's own compatibility note was wrong on this point. Resolved directly rather than looping back: widened dominantSeverity's parameter from SevMix to Record<string, number> (app.ts, next to severityCmp) and simplified its body from mix[s as keyof SevMix] to mix[s], since the function only ever does presence-checked numeric indexing and never needed SevMix's specific named shape. Both existing call sites still satisfy the widened signature with no cast: sevMix![w.id] (a SevMix) is structurally assignable to Record<string, number>, and counts (already Record<string, number>) matches directly. No cast introduced, no restructuring of counts, WS-9's per-card dot call site unaffected. npx tsc -p tsconfig.json --noEmit, npx tsc -p src/public/tsconfig.json --noEmit, and npm run build all pass clean afterward; dist/public/app.js confirmed to still have no import/export."
    ```

  - [x] 1.3 Manual verification against fixture data
    ```yaml
    description: "Confirm PLN-11 acceptance criteria 1-7 by eye using temporary fixture edits, then revert them."
    issues: []
    implement:
      - "No source-code changes. Per PLN-11 Assumption 3, this project's own flowcharge/ has zero open issues project-wide today, so the dot cannot be observed without temporary fixture data."
      - "Temporarily edit one or two issues' status to ready or in-progress, varying severity, under flowcharge/workstreams/*/issuelist*.md."
      - "With zero open issues (before the fixture edit): confirm the Severity pill shows no dot and no title attribute (criterion 2)."
      - "With the temporary fixture data in place: run npm run build, reload the board, confirm the Severity pill shows a dot colored by the first nonzero SEV_ORDER tier board-wide (criterion 1), and that its title reads 'Worst open severity, board-wide: {Label}' present exactly when the dot is present (criterion 4)."
      - "Click the Severity pill to make it the active sort key; confirm the dot stays visible and correctly colored against .seg button.active's solid background (criterion 3)."
      - "Trigger two applyData() cycles with unchanged fixture data (e.g. reload twice, or wait for a poll tick); confirm no duplicate dot node and no stale title (criterion 6)."
      - "Toggle the fixture data between zero and nonzero open issues across two applyData()/poll cycles; confirm the dot appears/disappears correctly each time (criterion 5)."
      - "Confirm the other four pills (Artefact ID, Name, Created, Updated) and the click-to-sort .active-toggling behavior are visually and functionally unchanged (criterion 7)."
      - "Revert every temporary fixture edit and confirm the touched files are byte-identical to their pre-edit content (diff or checksum) before considering this stage done — flowcharge/ is gitignored, so git status is not a reliable check here."
    pattern: "flowcharge/workstreams/*/issuelist*.md (temporary edits only, reverted before completion); no src/ file is touched by this task."
    imports: "None."
    compatibility: "Fixture edits must be reverted — this task must leave flowcharge/ content unchanged; only tasks 1.1-1.2's src/ changes should remain in the working tree afterward."
    gotcha: "Forgetting to revert leaves fabricated open issues in real flowcharge/ data. Confirm via diff/checksum comparison, not git status, that fixture files are byte-identical to their pre-edit content before marking this task complete."
    verify:
      - "diff or checksum comparison of every temporarily-edited issuelist file against its pre-edit content — must show no difference once the walkthrough is complete."
      - "npm run build — still zero errors after the revert, confirming no source file was inadvertently left mid-edit."
    checklist:
      - "With zero open issues, the Severity pill shows no dot and no title attribute (criterion 2)."
      - "With >=1 open issue, the dot is colored by the first nonzero SEV_ORDER tier board-wide, with a matching board-wide-worded title (criteria 1, 4)."
      - "The dot and title survive the Severity pill becoming the active sort key (criterion 3)."
      - "The dot updates correctly across applyData()/poll cycles, including toggling to/from zero open issues, with no duplicate node or stale title (criteria 5, 6)."
      - "The other four pills and click-to-sort .active behavior are unchanged (criterion 7)."
      - "All temporary fixture edits are reverted; fixture files are confirmed byte-identical to their pre-edit content."
    self_eval:
      passed: true
      failures: []
      note: "Directly confirmed live in a real browser (127.0.0.1:4173), not by code trace. Baseline (zero open issues): Severity pill had no dot, no title. Fixture: ISS-1 (inline-css-extraction) temporarily set to open+high, then escalated to open+critical across two separate poll-triggered re-renders — the dot updated colour (amber → red) and title text ('...High' → '...Critical') both times with exactly one .dot-sm node under the button throughout (no duplicate), confirming idempotent update-in-place (criteria 1, 4, 5, 6). Clicking the Severity pill to make it the active sort key was confirmed via computed style: the button's own background/text flipped to the accent/.active colours while the dot's background stayed its own critical-red, independent of the button's background — the exact scenario the plan's CSS approach (an appended dot rather than a background tint) was chosen to survive (criterion 3). Reverting the fixture to zero open issues removed both the dot and the title on the next poll tick (criterion 2/5). Artefact ID and the other three pills' active-toggling were unaffected throughout (criterion 7). Fixture reverted and confirmed byte-identical via diff and md5 before this was marked passed."
    ```
