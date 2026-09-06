---
id: TL-48-j9ne6g
type: tasklist
workstream: WS-49-bxknyf
slug: select-folder-button-order
title: "Fix .add-form hidden-attribute override so only one add-project control shows"
status: done
created: 2026-08-20
updated: 2026-08-20
author: Anthony Koukoullis
depends_on: [PLN-40-8txyes]
links: []
mode: spec
base_commit: 0155ef5
---

# PRX Tasks

## Fix .add-form hidden-attribute override so only one add-project control shows

The home page's "Add a project" panel shows both the path-field form and the
"Choose folder" button at once in the Electron build, instead of exactly one
of them. The toggle logic in `src/public/home.ts` is already correct; the
bug is a CSS specificity conflict at `src/public/styles.css:624`, where
`.add-form { display: flex; ... }` overrides the browser's default
`[hidden] { display: none; }` rule for the same element. The fix adds one
scoped override rule, `.add-form[hidden] { display: none; }`, immediately
after the existing `.add-form` rule, restoring the `hidden` attribute's
effect for `.add-form` without touching `home.ts`'s toggle logic,
`index.html`'s markup, or `#choose-folder-button` (which already
hides/shows correctly). This is a single-phase, CSS-only fix verified by
manual checks in both Electron mode and plain-browser-tab mode.

- [x] 1. Phase 1 — Restore mutually-exclusive add-project controls
  ```yaml
  description: "Add the .add-form[hidden] override rule and verify it restores mutually-exclusive add-project controls in both Electron mode and browser-tab mode"
  ```

  - [x] 1.1 Add the `.add-form[hidden]` override rule
    ```yaml
    description: "Insert .add-form[hidden] { display: none; } immediately after the existing .add-form rule in styles.css, restoring the hidden attribute's effect for that element"
    author: Anthony Koukoullis
    issues: []
    implement:
      - "File: src/public/styles.css. Insert one line directly after the existing `.add-form { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }` rule (confirmed at line 624 as read in this session). SEARCH text copied verbatim from the file:"
      - |
        src/public/styles.css
        <<<<<<< SEARCH
        .add-form { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
        =======
        .add-form { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
        .add-form[hidden] { display: none; }
        >>>>>>> REPLACE
      - "Do not modify src/public/home.ts, src/public/index.html, or the #choose-folder-button rule block (styles.css:637-649) — this task's scope is the one new selector only."
    pattern: "src/public/styles.css"
    imports: "None"
    compatibility: "styles.css uses !important nowhere (confirmed via grep -n \"!important\" styles.css returning no matches); .add-form[hidden] specificity (0,2,0) beats plain .add-form (0,1,0) without needing !important"
    gotcha: "Do not widen this into a global [hidden] { display: none; } reset — styles.css:952-955 documents the file's deliberate convention of never putting display on a hidden-toggled element in the first place; .add-form is the sole confirmed exception, and the fix must stay scoped to it"
    verify:
      - "grep -n \"add-form\\[hidden\\]\" src/public/styles.css"
      - "npm run build"
    checklist:
      - "The new rule .add-form[hidden] { display: none; } appears immediately after the .add-form rule in styles.css — YES/NO"
      - "No changes were made to src/public/home.ts — YES/NO"
      - "No changes were made to src/public/index.html — YES/NO"
      - "No !important was introduced — YES/NO"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.2 Verify Electron mode shows only "Choose folder"
    ```yaml
    description: "Run the Electron build and confirm the add-project panel shows only the Choose folder button, with no path field or Add project button visible or occupying layout space"
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run `npm run build && npm run electron:dev` and open the home page."
      - "Confirm the add-project panel shows only the #choose-folder-button; #add-form (the path field and Add project button) is not visible and does not occupy layout space; no stacked or duplicate controls appear."
      - "Click Choose folder, pick a directory, and confirm it is added as a tile via the existing, unchanged addProject flow."
    pattern: "Electron app home page — add-project panel"
    imports: "None"
    compatibility: "Depends on task 1.1's CSS rule being present"
    gotcha: "This mode is only entered when window.praxisAPI.pickProjectFolder is a function; confirm that is the case for this run before judging the result"
    verify:
      - "npm run build && npm run electron:dev"
      - "Visually confirm only #choose-folder-button is visible in the add-project panel and #add-form is hidden and occupies no layout space"
      - "Click Choose folder, pick a directory, confirm the folder is added as a project tile"
    checklist:
      - "#add-form is hidden and occupies no layout space in Electron mode — YES/NO"
      - "#choose-folder-button is visible in Electron mode — YES/NO"
      - "No stacked or duplicate controls appear in the panel — YES/NO"
      - "Choosing a folder adds it as a project tile via the existing addProject flow — YES/NO"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.3 Verify browser-tab mode shows only the path field + Add project button
    ```yaml
    description: "Run the app in a plain browser tab and confirm the add-project panel shows only the path field and Add project button, with no Choose folder button visible or occupying layout space"
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run `npm start` (or open the built dist/public/index.html in a plain browser tab, where praxisAPI.pickProjectFolder is not a function per the browser-ipc-shim.ts WS-45 shim)."
      - "Confirm the add-project panel shows only the path field and Add project button; #choose-folder-button is not visible and does not occupy layout space."
      - "Type an absolute path and submit, and confirm it is added as a tile via the existing, unchanged submitPath() flow."
    pattern: "Browser-tab app home page — add-project panel"
    imports: "None"
    compatibility: "Depends on task 1.1's CSS rule being present"
    gotcha: "This mode is only entered when window.praxisAPI.pickProjectFolder is not a function; confirm that is the case for this run before judging the result"
    verify:
      - "npm start"
      - "Visually confirm only the path field and Add project button are visible in the add-project panel and #choose-folder-button is hidden and occupies no layout space"
      - "Type an absolute path, submit, confirm the path is added as a project tile"
    checklist:
      - "#choose-folder-button is hidden and occupies no layout space in browser-tab mode — YES/NO"
      - "The path field and Add project button are visible in browser-tab mode — YES/NO"
      - "No stacked or duplicate controls appear in the panel — YES/NO"
      - "Submitting a typed path adds it as a project tile via the existing submitPath() flow — YES/NO"
    self_eval:
      passed: true
      failures: []
    ```
