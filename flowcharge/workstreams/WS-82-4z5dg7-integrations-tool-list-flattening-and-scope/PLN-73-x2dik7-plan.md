---
id: PLN-73-x2dik7
type: plan
workstream: WS-82-4z5dg7
slug: integrations-tool-list-flattening-and-scope
title: "Flatten the integrations CLI/desktop tool tabs into one list"
status: done
created: 2026-08-30
updated: 2026-08-30
depends_on: []
links: []
---

# Flatten the integrations CLI/desktop tool tabs into one list

## Summary

The Manage integrations dialog renders its four tools into two ARIA tab panels,
"Command-line tools" and "Desktop apps", chosen by each catalogue entry's
`category` field. That split no longer describes the tools: Claude Code and
OpenCode are both a command-line tool and a desktop app. This plan removes the
tablist and both panels, and renders all four tools into one container in
catalogue order.

The chosen approach is a straight deletion: remove the tablist markup and both
tab panels from `src/public/index.html`, put one `<div id="integrations-list">`
in their place, delete the tab state and tab key handling from
`src/public/home.ts`, and append every row to that single container. Nothing
about detection, install, scope or eligibility changes. `category` stays exactly
where it is on the data side, because `src/lib/agentic-tools-detect.ts:11-20`
switches on it to pick the CLI or GUI-app detection strategy. Only the UI's use
of `category` for layout goes away.

The Global/Project segmented control (`#integrations-scope-seg`,
`src/public/index.html:62-68`) is not touched. The flattened list renders the
same way under both scopes, because scope only changes per-row eligibility,
notes and chips, never which rows exist or where they go.

**Related work, not owned here.** A separate issue list for this same workstream
records the bug where `renderIntegrationsFailure` always appends its failure box
to the CLI panel, so a detection failure while the "Desktop apps" tab is active
renders into the hidden panel. That issue list delegates the fix to this plan:
flattening removes the second panel, so after this change there is exactly one
container to append into and the failure box is always visible. The issue list
keeps ownership of confirming and closing that issue on evidence, in a
verification-only task that declares a dependency on this plan's task list and
therefore runs after it. The issue list's own code edit sits in
`loadIntegrationsDetection`, a different function from the two this plan edits,
so there is no concurrent-edit conflict to sequence around.

## Scope

### Acceptance criteria

1. The Manage integrations dialog shows one tool list; no "Command-line tools" or "Desktop apps" control exists anywhere in it.
2. The list shows all four tools in catalogue order: Claude Code, Cursor, Windsurf, OpenCode.
3. Selecting Global or Project shows the same four rows in the same order; only per-row eligibility, note text and chips re-derive, exactly as today.
4. The Global/Project segmented control, the project `<select>`, eligibility, the Global-only "Already installed" chip, Re-scan and Install selected all behave as they do before this change.
5. A detection failure renders one failure box into the single list container, and it is visible at both Global and Project scope.
6. No ARIA tablist markup, roving `tabindex`, or Arrow/Home/End key handling remains in the integrations dialog; the Global/Project control keeps its current keyboard behaviour.
7. Closing and reopening the dialog clears the single list and disables Install selected; no tab state exists to reset.
8. `category` remains on `ToolDefinition`, `ToolDetectionRow`, the `detectTools` IPC payload and the `/api/integrations/tools` response, and still selects the detection strategy; no code under `src/public/` reads it.

### Out of scope

- The Global/Project segmented control, its install-destination behaviour, its eligibility logic, and its Global-only "Already installed" chip.
- Any deliberate, tab-aware fix for the failure-box-lands-in-the-wrong-panel bug. That issue stays owned by this workstream's issue list; this stage removes it structurally by leaving only one container, and the issue list confirms it afterwards.
- Any change to detection strategies, the catalogue's `configDir` data, or install behaviour.
- The `.ws-modal-tabs` CSS rules (`src/public/styles.css:895-918`, under their comment at 893-894), which `src/public/board.html:139` still uses for the board modal's own tablist.
- Adding a second `category` value, or per-form config directories for tools that ship in both a CLI and an app-bundle form.

### Assumptions

- **Ordering.** Rows render in the order they arrive, which is `TOOL_CATALOGUE` order from both transports: Claude Code, Cursor, Windsurf, OpenCode. Both `electron/agentic-tools-ipc-handlers.cts:467-472` and `src/server.ts:448-453` build rows with `TOOL_CATALOGUE.map`, so the catalogue is already the single ordering authority and no sort code is needed. Alphabetical or confidence ordering would add a sort that no requirement asks for.
- **No list heading.** The tab labels were the only headings above the rows. The flattened list gets no replacement heading; the dialog title "Manage integrations" and the scope control are the only labels above the rows.
- **No new ARIA role.** The container is a plain `<div>`. Removing the tab panels removes an ARIA obligation rather than creating one, and each row's checkbox already carries its own `aria-label` (`src/public/home.ts:474`).
- **Release constraints.** This is a local desktop app and local server with no live users and no production data. The change ships in one commit with no feature flag and no dark launch. See Open questions 1.

## Key flows

**Open the dialog** — **Actor:** the user. **Preconditions:** the app is running.
**Main flow:** the user clicks Manage integrations; the dialog opens at Global
scope; `loadIntegrationsDetection` calls `detectTools`; all four rows render into
the one list container in catalogue order; the presence checks then fill in the
"Already installed" chips. **Outcome:** one list of four rows with confidence
chips, no tabs. **Edge cases:** the integrations surface is absent in this build,
so the failure box renders into the same container instead of rows.

**Switch scope** — **Actor:** the user. **Preconditions:** the dialog is open with
rows rendered. **Main flow:** the user clicks Project and picks a project;
`refreshIntegrationsEligibility` re-derives each row's disabled state, note text
and chip visibility in place. **Outcome:** the same four rows in the same order,
with project-scope eligibility applied. **Edge cases:** no projects registered,
so the Project button stays disabled, unchanged from today.

**Detection fails** — **Actor:** the user. **Preconditions:** the dialog is open at
either scope. **Main flow:** `detectTools` rejects; `renderIntegrationsFailure`
clears the one container and appends the failure box. **Outcome:** the failure box
is visible at whichever scope is selected. **Edge cases:** none; there is no
hidden panel left for the box to land in.

## Design

No contract changes. No function signature, type, IPC payload or HTTP response
shape changes. The change is confined to markup and to the DOM-writing code in
`src/public/home.ts`.

### Markup — `src/public/index.html`

Replace `div.ws-modal-tabs#integrations-tabs` (lines 69-72), which is a sibling
directly above `.ws-modal-body`, together with both `div[role="tabpanel"]`
panels (lines 74-75), which are the first two children inside `.ws-modal-body`,
with one element:

- `<div id="integrations-list"></div>`, placed where the panels were, before
  `.integrations-actions`.
- No `role`, no `aria-*` attributes, no class, and no `hidden` attribute. No code
  path may ever set `hidden` on it, which is what makes acceptance criterion 5
  hold by construction.

`div.ws-modal-meta` above it, holding `#integrations-scope-seg` and
`#integrations-project-select`, is unchanged.

### Rendering — `src/public/home.ts`

Deletions:

- `integrationsTabsEl` (line 333).
- `INTEGRATIONS_TABS` (lines 340-345) and `currentIntegrationsTab` (line 346).
- `selectIntegrationsTab` (lines 350-363).
- The `integrationsTabsEl` click and keydown listeners (lines 716-739).
- The `selectIntegrationsTab('cli', false)` call in `resetIntegrationsModalState`
  (line 701).

Additions and edits:

- One cached element, `var integrationsList = byId('integrations-list');`,
  declared beside the other cached dialog elements near line 333.
- `renderIntegrationsRows(rows: ToolDetectionRow[])` (lines 564-579): clear
  `integrationsList` once, build entries with `buildIntegrationsRow` as today,
  and append every `entry.rowEl` to `integrationsList`. The
  `entry.row.category === 'gui-app' ? panelGuiApp : panelCli` ternary at line 572
  is removed. Signature unchanged.
- `renderIntegrationsFailure(heading, detail)` (lines 585-597): clear
  `integrationsList` and append the box to it. Signature unchanged.
- `resetIntegrationsModalState` (lines 700-708): clear `integrationsList` in
  place of the two panel clears at lines 705-706.
- The block comments at lines 326-328, 337-339, 560-563 and 695-699 name tabs and
  tabpanels. They are updated to describe the single list. The comment at 337-339
  and the one above `selectIntegrationsTab` at 348-349 are deleted with the code
  they describe.

After this change, no code under `src/public/` reads `category`. The rendering
layer knows the row order given to it and how to build a row. It must not know
which detection strategy produced a row. `src/lib/agentic-tools-detect.ts` keeps
sole ownership of `category` as a strategy selector.

### Atomicity

`byId` is a null-asserted `document.getElementById` (`src/public/home.ts:80`).
Removing the tablist markup without removing the JS makes
`integrationsTabsEl.querySelector` throw at module init and kills the whole home
script. The markup edit and the `home.ts` edit must land in the same commit.

### CSS — `src/public/styles.css`

No rule changes. Row styling is class-based (`.integrations-row` and friends,
lines 958-967) and no selector is keyed to a panel id, so the rows style
identically in the new container. `.integrations-row:last-child` now applies to
the last row of the whole list rather than the last row of a panel, which is the
correct result. The `.ws-modal-tabs` rules stay, because `src/public/board.html`
still uses that class. The section comment at line 935 mentions "each tabpanel"
and is updated; that is a comment-only touch.

### Build output

`dist/public/index.html` and `dist/public/home.js` are generated by
`npm run build`. They are not hand-edited.

## Stages

**Stage 1 — Flatten the tool list.** Remove the tablist markup, both tab panels
and all tab JS, and render every row and the failure box into one
`#integrations-list` container. It is the only stage because the markup and the
JS are mutually load-bearing: splitting them leaves the home script throwing at
init, so no intermediate state is demonstrable. Observable at the end: opening
Manage integrations shows four rows in one list with no tabs, at both Global and
Project scope, with install, re-scan, eligibility and chips behaving as before.

## Data & compatibility

- No migrations. No persisted data of any kind is touched.
- No API or IPC compatibility concern. `category` still ships in the
  `detectTools` IPC payload and in the `GET /api/integrations/tools` response;
  the browser client simply stops reading it. An older client served the same
  payload keeps working.
- Both transports already return rows in `TOOL_CATALOGUE` order, so the rendered
  order is identical in the Electron build and in a plain browser tab.
- Rollback is a revert of the single commit. Nothing is irreversible.

## Testing strategy

The repository has no test runner and no test directory; `package.json` declares
only build and start scripts. Verification for this stage is therefore manual,
and this section is a pointer for a later write-tests pass rather than a set of
tests to write now.

- Manual, Electron build: `npm run electron:dev`, then open Manage integrations
  and check acceptance criteria 1, 2, 6 and 7 at Global scope, then 3 and 4 after
  switching to Project scope.
- Manual, browser build: `npm start`, then repeat the same checks in a plain tab,
  which exercises the fetch-backed shim path rather than the IPC path.
- Manual, failure path: check acceptance criterion 5 by making a real detection
  call fail. The reachable route is `loadIntegrationsDetection`'s `.catch`: open
  the dialog in a browser tab, stop `npm start`, then click Re-scan. The shim
  resolves `{ ok: false, status: 0 }` (`src/public/browser-ipc-shim.ts:53`),
  `unwrapIpc` throws (`src/public/ipc-adapter.ts:23-28`) and
  `renderIntegrationsFailure` runs. The `api === null` branch renders the same
  box through the same renderer, but it needs a build with no integrations
  surface at all, so it is the harder of the two to stage.
- Static: `npm run build` must pass with no TypeScript error, which catches any
  leftover reference to the deleted tab identifiers.
- If a DOM test harness is added later, `renderIntegrationsRows` is the unit
  worth covering: given four rows, it appends four children to one container in
  input order.

## Open questions

1. **Release constraints — settled.** Anthony Koukoullis, chat, 2026-08-30: no
   packaged release is pending. Ship now, on `main`, no flag, one commit.
2. **The forward-looking `category` concern — settled.** Anthony Koukoullis, chat,
   2026-08-30: track it separately, as its own future workstream, if/when it
   becomes real. Not part of this plan.

## Alternatives considered and rejected

- Hide the tablist with CSS and leave the markup and JS in place: leaves dead ARIA, dead key handling and a hidden tab state that reset must still manage.
- Keep both panels and render all four rows into the CLI panel: leaves a hidden second panel that `renderIntegrationsFailure` and `resetIntegrationsModalState` must still clear, for no benefit.
- Rename `#integrations-panel-cli` to `#integrations-list` and delete only the gui-app panel: a smaller diff, but it carries a `role="tabpanel"` with no tablist, which is invalid ARIA.
- Sort the flattened list alphabetically or by detection confidence: adds sort code that no requirement asks for, and displaces the catalogue as the single ordering authority.
- Remove `category` from the catalogue entirely: breaks the strategy dispatch at `src/lib/agentic-tools-detect.ts:11-20`, and the workstream explicitly requires the field to stay.

## Final summary

- Approach: delete the tablist and both tab panels, render all four rows into one `#integrations-list` container in catalogue order, keep `category` as a detection-strategy field only.
- One stage, roughly one sitting: two files edited, `src/public/index.html` and `src/public/home.ts`, plus one comment line in `src/public/styles.css`.
- Risks: the markup and JS edits must land together or the home script throws at init; the workstream's separate failure-box issue depends on this stage for its structural fix, so this stage lands first and that issue is confirmed after it; there is no automated test coverage, so verification is manual at both scopes and on both the Electron and browser paths.
- Needs your answer: whether a packaged release is pending that this should wait for, and whether the forward-looking `category` detection concern gets its own workstream.
