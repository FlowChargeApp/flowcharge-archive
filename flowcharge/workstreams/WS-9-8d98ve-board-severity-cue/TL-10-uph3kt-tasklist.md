---
id: TL-10-uph3kt
type: tasklist
workstream: WS-9-8d98ve
slug: board-severity-cue
title: "Per-card dominant-severity dot for the board"
status: done
created: 2026-08-06
updated: 2026-08-06
depends_on: [PLN-9-fe9rs9]
links: []
mode: spec
base_commit: ca41675
---

# PRX Tasks

## Per-card dominant-severity dot for the board

Implements PLN-9. Gives every workstream card a small colored dot next to its ID in
`card-top`, showing that workstream's dominant open-issue severity, readable under any
sort key — not just inferable from position when Severity sort happens to be active.
Reuses the existing `SEV_ORDER`/`SEV_LABEL` vocabulary and `--sev-*` custom properties;
no second color scheme, no server-side change, no wire-shape change. The plan is small
enough for one stage; this file mirrors that with one parent task and one child per
touched file, in the plan's own order, plus the plan's own manual-verification child.

- [x] 1. Stage 1 — Per-card severity dot
  ```yaml
  description: "Unguard the sevMix precompute, add dominantSeverity(), render the dot in buildCard()'s card-top, generalize the .dot-sm CSS selector, then manually verify against temporary fixture data, per PLN-9's single stage."
  ```

  - [x] 1.1 CSS: generalize `.dot-sm` to a bare selector
    ```yaml
    description: "Change the .artefact-row .dot-sm CSS rule to a bare .dot-sm selector so the existing 6x6px dot shape is reusable outside artefact rows."
    issues: []
    implement:
      - "File: src/public/styles.css. Anchor: the `.artefact-row .dot-sm` rule (current line 352). Drop the `.artefact-row` ancestor restriction so the shape rule applies to any `.dot-sm`, matching Design's CSS section."
      - |
        <<<<<<< SEARCH
        .artefact-row .dot-sm { width: 6px; height: 6px; border-radius: 50%; flex: none; }
        =======
        .dot-sm { width: 6px; height: 6px; border-radius: 50%; flex: none; }
        >>>>>>> REPLACE
    pattern: "src/public/styles.css"
    imports: "None."
    compatibility: "The existing artefact-row dot usage (app.ts:101-103) still matches the bare selector — a descendant still matches a class selector with no ancestor restriction — so its rendering is unaffected."
    gotcha: "This is a scope generalization of the existing rule, not a new rule — do not add a second .dot-sm block. Coloring stays inline (dot.style.background) per the existing convention; do not add a color property to this CSS rule."
    verify:
      - "Reload the board; existing artefact-row dots (non-progress artefact rows inside cards) are visually unchanged."
      - "grep -n '\\.dot-sm' src/public/styles.css — exactly one .dot-sm rule remains, with no .artefact-row prefix."
    checklist:
      - "The rule now reads `.dot-sm { width: 6px; height: 6px; border-radius: 50%; flex: none; }` with no ancestor selector."
      - "No new CSS rule was added — this is a selector-scope edit only."
      - "The existing artefact-row dot still renders at 6x6px circular, unchanged visually."
      - "No color property was added to .dot-sm."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.2 Logic: unguard `sevMix` precompute + add `dominantSeverity()`
    ```yaml
    description: "Remove the sortKey === 'severity' guard around the sevMix precompute so it runs unconditionally every renderBoard() call, and add a pure dominantSeverity() helper next to severityCmp."
    issues: []
    implement:
      - "File: src/public/app.ts. Anchor 1: the sevMix precompute block inside renderBoard() (current lines 131-139, `if (sortKey === 'severity') { sevMix = {}; ... }`). Remove the `if (sortKey === 'severity') { ... }` wrapper so the seed-then-bucket body runs unconditionally at the top of every renderBoard() call, exactly once per render — same two-pass cost shape as today (one pass to seed zeros, one pass over issues to bucket), just no longer conditional."
      - |
        // Illustrative — body unchanged, only the guard is removed:
        sevMix = {};
        workstreams.forEach(function (w) { sevMix![w.id] = { critical: 0, high: 0, medium: 0, low: 0 }; });
        issues.forEach(function (i) {
          if (i.status !== 'ready' && i.status !== 'in-progress') return;
          var mix = i.severity != null ? sevMix![i.workstream] : null;
          if (mix && mix[i.severity as keyof SevMix] !== undefined) mix[i.severity as keyof SevMix]++;
        });
      - "Anchor 2: severityCmp (current lines 50-52). Immediately after it, add a new pure dominantSeverity(mix: SevMix): string | null helper that walks SEV_ORDER and returns the first tier with a nonzero count in mix, or null if all four tiers are zero — the same presence-based, worst-tier-first rule severityCmp's own tie-break chain already uses, so the two can never disagree."
      - |
        // Illustrative:
        function dominantSeverity(mix: SevMix): string | null {
          var found = SEV_ORDER.find(function (s) { return mix[s as keyof SevMix] > 0; });
          return found || null;
        }
    pattern: "src/public/app.ts"
    imports: "SEV_ORDER (module scope, app.ts:4), SevMix type (module scope, app.ts:16) — both already exist in this file, no new import."
    compatibility: "Array.prototype.find is available under the es2020 lib target (src/public/tsconfig.json). dominantSeverity's .find() callback must use the function keyword, not an arrow function, matching this file's existing convention (no => callback exists in app.ts today)."
    gotcha: "The precompute must stay a pure function of workstreams/issues with no rendering or sortKey knowledge — removing the guard is what makes buildCard() safe to read sevMix unconditionally in task 1.3; don't move the block or change its two-pass shape while removing the guard. dominantSeverity() must not know how the mix was computed or read sortKey/sortDir — pure function of one SevMix value only. No server file (src/server.ts, src/lib/extract.ts, src/lib/projects.ts, src/lib/git.ts) may be touched; no change to the PraxisData/PraxisIssue wire shape."
    verify:
      - "npx tsc -p tsconfig.json --noEmit"
      - "npx tsc -p src/public/tsconfig.json --noEmit"
      - "npm run build"
      - "Switching sort keys in the board still sorts identically to before this task — no visible change yet, since nothing outside severityCmp reads sevMix until task 1.3."
    checklist:
      - "The if (sortKey === 'severity') guard is gone; the seed-then-bucket body is unconditional and otherwise unchanged."
      - "dominantSeverity(mix) returns the first SEV_ORDER tier with mix[tier] > 0, or null when all four are zero."
      - "dominantSeverity uses a function-keyword callback in .find(), not an arrow function."
      - "The id and name sort branches and the sortDir trailer are byte-for-byte unchanged."
      - "Both tsc -p projects and npm run build complete with zero errors."
      - "No server file touched; no PraxisData/PraxisIssue wire-shape change."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.3 Rendering: dot in `card-top`
    ```yaml
    description: "Replace buildCard()'s card-top block so the ID block wraps a severity dot, shown only when dominantSeverity(sevMix[w.id]) is non-null, colored via the matching --sev-* custom property and titled with SEV_LABEL."
    issues: []
    implement:
      - "File: src/public/app.ts. Anchor: the card-top block inside buildCard() (current lines 71-77). Depends on tasks 1.1 and 1.2 — needs the bare .dot-sm selector to render at the right size, and sevMix/dominantSeverity to be unconditionally ready."
      - |
        <<<<<<< SEARCH
            var top = el('div', 'card-top');
            top.appendChild(el('div', 'card-id', w.id));
            var upd = el('div', 'card-id', fmtDate(w.updated));
            upd.style.fontWeight = '400';
            upd.style.color = 'var(--ink-faint)';
            top.appendChild(upd);
            card.appendChild(top);
        =======
            var top = el('div', 'card-top');
            var idWrap = el('div', 'card-id');
            idWrap.style.display = 'flex';
            idWrap.style.alignItems = 'center';
            idWrap.style.gap = '4px';
            var dominant = dominantSeverity(sevMix![w.id]);
            if (dominant) {
              var sevDot = el('span', 'dot-sm');
              sevDot.style.background = 'var(--sev-' + dominant + ')';
              sevDot.title = SEV_LABEL[dominant] + ' severity (open issues)';
              idWrap.appendChild(sevDot);
            }
            idWrap.appendChild(document.createTextNode(w.id));
            top.appendChild(idWrap);
            var upd = el('div', 'card-id', fmtDate(w.updated));
            upd.style.fontWeight = '400';
            upd.style.color = 'var(--ink-faint)';
            top.appendChild(upd);
            card.appendChild(top);
        >>>>>>> REPLACE
    pattern: "src/public/app.ts"
    imports: "dominantSeverity() and sevMix (task 1.2), SEV_LABEL (module scope, app.ts:5), .dot-sm CSS shape (task 1.1)."
    compatibility: "card-top's CSS (styles.css:318, display: flex; justify-content: space-between) must still see exactly two direct children — the dot lives inside the first child (idWrap), not as a third flex item. The shared .card-id class itself is untouched; only this idWrap instance gets inline flex styles, the same convention upd.style.fontWeight/color already use one line below."
    gotcha: "Must read sevMix![w.id] only — never re-derive a workstream's issues from the full issues array per card, which would regress from O(n) to O(workstreams x issues) per render. Requires task 1.2 (sevMix unconditionally populated) and task 1.1 (bare .dot-sm selector) to have already landed."
    verify:
      - "npm run build"
      - "grep -E \"^\\s*(import|export)\\s\" dist/public/app.js — must return no matches, confirming app.js remains a classic script."
    checklist:
      - "card-top still has exactly two direct children (idWrap, upd) — space-between layout unchanged."
      - "The dot renders only when dominantSeverity(sevMix![w.id]) is non-null; no dot node is appended otherwise."
      - "The dot's background is exactly var(--sev-critical/high/medium/low) as chosen by dominantSeverity, never a hardcoded color."
      - "sevMix![w.id] is the only per-card severity lookup — buildCard() does not iterate issues directly."
      - "npm run build completes with zero errors; dist/public/app.js has no import/export."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.4 Manual verification against fixture data
    ```yaml
    description: "Confirm PLN-9 acceptance criteria 1-6 by eye using temporary fixture edits, then revert them."
    issues: []
    implement:
      - "No source-code changes. Per PLN-9 Assumption 5, this project's own flowcharge/ has zero open issues project-wide today, so the dot cannot be observed without temporary fixture data."
      - "Temporarily edit one or two issues' status to ready or in-progress and vary severity across at least two workstreams' issue lists under flowcharge/workstreams/*/issuelist*.md."
      - "With the temporary data in place: run npm run build, reload the board, and confirm a dot appears only on workstreams with at least one open (ready/in-progress) issue with a recognized severity, in the color of the first nonzero SEV_ORDER tier (criteria 1-3)."
      - "Switch to Severity sort and confirm no card's dot color ever looks less severe than a card ranked above it within the same status column (criterion 4)."
      - "Switch sort key/direction and type into the search filter; confirm every visible card's dot stays correct with no staleness (criterion 5)."
      - "Confirm card hover/focus/click behavior, the detail modal, and every other existing card element (title, tags, artefacts, foot) are visually and functionally unchanged, and card-top's existing two-item space-between layout is unchanged (criterion 6)."
      - "Revert every temporary fixture edit and confirm the touched files are byte-identical to their pre-edit content (diff or checksum) before considering this stage done — flowcharge/ is gitignored, so git status is not a reliable check here."
    pattern: "flowcharge/workstreams/*/issuelist*.md (temporary edits only, reverted before completion); no src/ file is touched by this task."
    imports: "None."
    compatibility: "Fixture edits must be reverted — this task must leave flowcharge/ content unchanged; only tasks 1.1-1.3's src/ changes should remain in the working tree afterward."
    gotcha: "Forgetting to revert leaves fabricated open issues in real flowcharge/ data. Confirm via diff/checksum comparison, not git status, that fixture files are byte-identical to their pre-edit content before marking this task complete."
    verify:
      - "diff or checksum comparison of every temporarily-edited issuelist file against its pre-edit content — must show no difference once the walkthrough is complete."
      - "npm run build — still zero errors after the revert, confirming no source file was inadvertently left mid-edit."
    checklist:
      - "A dot appears only on workstreams with >=1 open (ready/in-progress) issue with a recognized severity; zero-open workstreams show no dot (criteria 1, 3)."
      - "Dot color is exactly one of --sev-critical/high/medium/low, chosen by the first nonzero SEV_ORDER tier (criterion 2)."
      - "Under Severity sort, no card's dot visually contradicts its position within a status column (criterion 4)."
      - "Sort key/direction changes and search-filter typing re-render every dot correctly with no staleness (criterion 5)."
      - "No other card element (hover/focus/click, modal, title, tags, artefacts, foot, card-top layout) visibly changed (criterion 6)."
      - "All temporary fixture edits are reverted; fixture files are confirmed byte-identical to their pre-edit content."
    self_eval:
      passed: true
      failures: []
      note: "Directly confirmed live in a real browser (127.0.0.1:4173), not by code trace. Fixture spread: WS-4's existing ISS-1 temporarily flipped to 1 open critical, a temporary WS-6 issue list added with 1 open medium, WS-1/2/3/5/7/8/9/10/11 left at zero. DOM inspection (getComputedStyle) confirmed WS-4 renders a 6x6px circular dot at rgb(226,83,107) titled 'Critical severity (open issues)', WS-6 at rgb(224,178,79) titled 'Medium severity (open issues)', and all nine zero-open workstreams render no dot at all (criteria 1, 2, 3). Under Severity+Asc, the Done column ordered WS-4 (critical) first, WS-6 (medium) second, then the six no-dot cards — dot colour never contradicted position (criterion 4). Switching to Artefact ID sort and typing into the search filter left both dots exactly correct with no staleness (criterion 5). card-top kept exactly two direct children throughout, and clicking WS-4's card opened its detail modal correctly with no regression (criterion 6). All fixture edits reverted and confirmed byte-identical via diff and md5 before this was marked passed (criterion 7 / the revert-integrity item)."
    ```
