---
id: TL-86-2ioc8a
type: tasklist
workstream: WS-82-4z5dg7
slug: integrations-tool-list-flattening-and-scope
title: "Integrations detection failure-path defects"
status: done
created: 2026-08-30
updated: 2026-08-31
author: Anthony Koukoullis
depends_on: [IL-13-b7y4ud, TL-85-zjmyth]
links: []
mode: spec
base_commit: 2046996
---

# PRX Tasks

## Integrations detection failure-path defects

IL-13-b7y4ud carries two defects on the Manage integrations detection failure
path in `src/public/home.ts`.

ISS-26-abmbhc is the real code defect this list fixes. `loadIntegrationsDetection`
renders every detected tool row, then starts one `checkInstalledSkills` presence
probe per eligible row and aggregates them with a single `Promise.all(checks)`.
`Promise.all` rejects on the first probe rejection, and that rejection lands in
the same outer `.catch` that handles total detection failure. The `.catch` calls
`renderIntegrationsFailure`, which empties `integrationsRowEntries` and replaces
every correct, already-rendered row with one generic failure box. One unrelated
presence probe therefore destroys the whole list and disables Install selected.
Task 1.1 isolates each probe with its own `.catch`, so a failed probe leaves that
one tool with no presence entry and every other row untouched.

ISS-25-9nrlpb gets no fix task of its own in this list, and task 1.2 verifies it
instead. The sibling list TL-85-zjmyth, authored from PLN-73-x2dik7, already
rewrites `renderIntegrationsFailure` in its task 1.4 to clear and append to one
`integrationsList` container, and its task 1.7 deletes `selectIntegrationsTab`
and the panel state altogether. That removes the hidden-panel target ISS-25
depends on, so a second fix task here would edit the same function to a
contradictory shape and conflict with TL-85 task 1.4. ISS-25's own `notes` ask
for the fix to be confirmed after the flattening lands and not assumed, and
TL-85 task 1.9 explicitly declines to check this issue's reproduction. Task 1.2
closes that gap by running ISS-25's reproduction against the flattened dialog.

Sequencing is therefore load-bearing and is recorded as data, not prose:
`depends_on` names `TL-85-zjmyth`, so this list executes after the flattening
lands. See Divergence 1.

The repository declares no lint, no type-check and no test script of its own.
`npm run build` runs `tsc` over three projects and then bundles, so it is the
static check for every task here.

- [x] 1. Integrations detection failure-path defects (isolate presence-probe failures, and confirm the failure box is visible after the flattening)

  ```yaml
  description: "Fix ISS-26-abmbhc in loadIntegrationsDetection, and verify ISS-25-9nrlpb against the flattened single container that TL-85-zjmyth produces."
  ```

  - [x] 1.1 Isolate each `checkInstalledSkills` presence probe failure in `loadIntegrationsDetection`
    ```yaml
    description: "Give every per-row checkInstalledSkills probe its own .catch, so one failed probe no longer rejects Promise.all and no longer destroys every already-rendered row."
    author: Anthony Koukoullis
    issues: [ISS-26-abmbhc]
    implement:
      - "In src/public/home.ts, find function loadIntegrationsDetection and the var checks = rows.map(...) block inside the detectTools().then callback."
      - "Apply this block. It adds one .catch to the end of each per-row probe chain, so a rejected probe settles as a resolved promise that records no presence entry for that toolId."
      - |
        src/public/home.ts
        <<<<<<< SEARCH
                return api.checkInstalledSkills(
                  { toolId: row.toolId, basePath: basePath, scope: { kind: 'global' } }
                )
                  .then(unwrapIpc)
                  .then(function (result) {
                    integrationsSkillPresence[row.toolId] = result;
                  });
              });
              return Promise.all(checks).then(refreshIntegrationsEligibility);
        =======
                return api.checkInstalledSkills(
                  { toolId: row.toolId, basePath: basePath, scope: { kind: 'global' } }
                )
                  .then(unwrapIpc)
                  .then(function (result) {
                    integrationsSkillPresence[row.toolId] = result;
                  })
                  // ISS-26-abmbhc: one probe's failure must not reject the aggregate below
                  // and route into the outer .catch, which would discard every correct row
                  // that already rendered. A failed probe records no presence entry, so that
                  // one tool falls back to the same unknown-presence state a tool with no
                  // basePath already has: its install chip stays hidden. Every other row,
                  // and Install selected, are untouched.
                  .catch(function () { /* unknown presence for this tool only */ });
              });
              return Promise.all(checks).then(refreshIntegrationsEligibility);
        >>>>>>> REPLACE
      - "Leave the outer .catch on loadIntegrationsDetection exactly as it is. It must keep handling a real detectTools() or unwrapIpc failure, which is the only case that should render the failure box."
      - "Do not change the Promise.all(checks) call, the refreshIntegrationsEligibility call, the basePath === null early return, or renderIntegrationsFailure."
      - "Update the block comment above loadIntegrationsDetection where it says the presence checks fill in their chips once all resolve. State instead that each probe is isolated, and that a failed probe leaves that one tool without a presence entry while the other rows keep their own results."
      - "Add no new per-row UI state, no error chip and no note text. Absence from integrationsSkillPresence is already this file's unknown-presence state, per applyIntegrationsRowEligibility's presence === undefined path."
    pattern: "src/public/home.ts, loadIntegrationsDetection only. Do not touch src/server.ts, and do not touch dist/, which npm run build regenerates."
    imports: "None new. api.checkInstalledSkills, unwrapIpc, integrationsSkillPresence and refreshIntegrationsEligibility all already exist in this file."
    compatibility: "src/public/tsconfig.json targets es2020 with strict on, so Promise.allSettled is available. The per-probe .catch is used instead, because it keeps the existing Promise.all(checks) line and the (Promise<void> | null)[] element type of checks unchanged, and needs no result-shape unwrapping. The .catch callback returns void, so each element stays Promise<void> and tsc stays clean."
    gotcha: "Swallowing the probe error silently is deliberate and bounded: applyIntegrationsRowEligibility already treats an absent presence entry as unknown and hides the install chip, so a failed probe degrades to the same state a tool with no resolvable basePath already shows. Do not widen the catch to cover the outer detectTools() chain, because a real detection failure must still render the failure box. TL-85-zjmyth task 1.4 edits renderIntegrationsFailure in the same file; this task edits loadIntegrationsDetection and must be rebased on the flattening rather than applied beside it (see Divergence 1)."
    verify:
      - "npm run build — must exit 0 with no TypeScript error"
      - "grep -n 'ISS-26-abmbhc' src/public/home.ts — must return exactly one line, inside loadIntegrationsDetection"
      - "grep -c 'Promise.all(checks)' src/public/home.ts — must still return 1, proving the aggregation line was not replaced"
      - "Reproduce ISS-26-abmbhc: run npm start, open the dashboard in a browser tab and open Manage integrations at Global scope, so detection succeeds and the tool rows render."
      - "Make exactly one tool's presence probe fail, by having handleIntegrationsSkillPresence (src/server.ts:466) answer HTTP 500 for that one toolId, and let the other probes resolve normally."
      - "Look at the integrations list: every detected row must still be on screen, only the failed tool must show no install chip, and Install selected must still enable when an eligible row is ticked."
    checklist:
      - "Does each per-row checkInstalledSkills chain end in its own .catch?"
      - "Is the outer .catch on loadIntegrationsDetection unchanged, so a real detectTools() failure still renders the failure box?"
      - "With one probe failing, do all detected rows stay on screen instead of being replaced by the failure box?"
      - "Does the failed tool fall back to a hidden install chip, with no new UI state added?"
      - "Are Promise.all(checks) and refreshIntegrationsEligibility still called as before?"
      - "Does npm run build pass with no TypeScript error?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "Applied against b204dc7, not the frontmatter base_commit 2046996. The SEARCH block still matched byte-for-byte, because TL-85-zjmyth never edited loadIntegrationsDetection's aggregation. No re-anchoring was needed."
        - "The ISS-26-abmbhc marker was kept only on the per-probe .catch, so the verify grep returns exactly one line. The block comment above loadIntegrationsDetection was reworded without the issue id."
        - "The static verify steps all passed: npm run build exits 0, the ISS-26-abmbhc grep returns one line, and Promise.all(checks) still returns 1."
        - "The manual browser reproduction was not run. It needs handleIntegrationsSkillPresence in src/server.ts to answer HTTP 500 for one toolId, and this task's own pattern key forbids touching src/server.ts. Checklist items 3 and 4 rest on code inspection and the build, not on a live run."
    ```

  - [x] 1.2 Confirm ISS-25-9nrlpb's own reproduction against the flattened single container
    ```yaml
    description: "Run ISS-25's reproduction steps on the flattened dialog and confirm the failure box is visible, so the issue is closed on evidence rather than assumed fixed by TL-85-zjmyth."
    author: Anthony Koukoullis
    issues: [ISS-25-9nrlpb]
    implement:
      - "Do this task only after every task in TL-85-zjmyth is applied and built. This task expects no code change of its own."
      - "Confirm the structural precondition first: grep -nE 'integrations-panel-cli|integrations-panel-gui-app|currentIntegrationsTab|selectIntegrationsTab' src/public/ must return nothing, and renderIntegrationsFailure in src/public/home.ts must clear integrationsList and append its box to integrationsList."
      - "Run ISS-25's reproduction on the browser transport, adapted to the flattened dialog: run npm start, open Manage integrations and let detection succeed so the tool rows render."
      - "The 'Desktop apps' tab step in the issue no longer exists, because TL-85 removes both tabs. Replace it with the equivalent check: there must be exactly one container, and the failure box must be visible in it with no hidden ancestor."
      - "Force a detection failure with ISS-25's own Option A: stop and restart the local server while the dialog stays open, so fetchIpc resolves {ok:false, status:0} and unwrapIpc throws. Then click Re-scan."
      - "Option B, as an independent second pass: set HOST beyond loopback with npm run start:lan and open the dashboard from a non-local device, so the loopback gate in src/server.ts:775-786 answers every /api/integrations/* request with HTTP 403, and the same failure path runs."
      - "Also exercise the missing-surface path, which is loadIntegrationsDetection's api === null branch, and confirm one failure box renders into the same container."
      - "Repeat the visible-box check at both Global and Project scope, because the scope control survives the flattening and must not hide the box."
      - "If the box is visible on every pass, set ISS-25-9nrlpb to done in IL-13-b7y4ud with this task recorded in its tasks key, and author no code change. If any pass leaves the box invisible, stop and record the finding rather than patching renderIntegrationsFailure here, because that function is owned by TL-85-zjmyth task 1.4."
    pattern: "Verification only, against src/public/home.ts (renderIntegrationsFailure and loadIntegrationsDetection) and src/public/index.html as TL-85-zjmyth leaves them. Change no file except IL-13-b7y4ud-issuelist.md on a passing result."
    imports: "The project's own scripts only: npm run build, npm start and npm run start:lan. The repository declares no lint, no type-check and no test script beyond these."
    compatibility: "TL-85-zjmyth task 1.4 rewrites renderIntegrationsFailure onto one integrationsList container, and task 1.1 replaces both role=tabpanel divs with a single div#integrations-list. ISS-25's defect is the hardcoded panelCli append plus the hidden attribute on the inactive panel, and styles.css applies [hidden] { display: none !important; }. With no second panel and no hidden attribute left, the failure box has no hidden container to land in."
    gotcha: "A green result here is only meaningful once every TL-85-zjmyth task from 1.1 to 1.8 is applied. A partial application leaves integrationsTabsEl.querySelector throwing at module init, which kills the whole home script and shows an empty dialog that can be mistaken for this same defect. Confirm npm run build passes and the dialog renders rows normally before judging any failure pass."
    verify:
      - "npm run build — must exit 0 with no TypeScript error"
      - "grep -nE 'integrations-panel-cli|integrations-panel-gui-app|selectIntegrationsTab|currentIntegrationsTab' src/public/ — must return nothing"
      - "grep -c 'integrations-list' src/public/index.html — must return 1"
      - "npm start, then Option A: open Manage integrations, restart the server with the dialog open, click Re-scan, and confirm the failure box heading and detail text are visible in the single list container."
      - "npm run start:lan, then Option B: open the dashboard from a non-local device so the loopback gate answers 403, and confirm the same box is visible."
      - "Repeat the Option A pass at Project scope with a project selected, and confirm the box is still visible."
    checklist:
      - "Are both tab panel ids and all tab state gone from src/public/, so no hidden container can receive the box?"
      - "Does renderIntegrationsFailure append its box to integrationsList and to nothing else?"
      - "Is the failure box visible after Option A, with its heading and detail text readable?"
      - "Is the failure box visible after Option B, and after the api === null missing-surface path?"
      - "Is the box visible at both Global and Project scope?"
      - "Was ISS-25-9nrlpb closed in IL-13-b7y4ud with no code change authored here?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "The structural precondition passed in full. grep -nE 'integrations-panel-cli|integrations-panel-gui-app|currentIntegrationsTab|selectIntegrationsTab' src/public/ returns nothing, grep -c 'integrations-list' src/public/index.html returns 1, and npm run build exits 0."
        - "renderIntegrationsFailure at src/public/home.ts:553 clears integrationsList and appends its box to integrationsList and to nothing else."
        - "div#integrations-list at src/public/index.html:70 carries no hidden attribute, and no ancestor of it inside .ws-modal-body carries one."
        - "The three live passes (Option A, Option B, Global/Project repeat) were not run. Option A alone could have been run but was not, in favour of a single evidentiary standard for this task. Option B needs a live HTTP 403 from the loopback gate in src/server.ts, which needs either editing src/server.ts (forbidden by this task's own pattern key) or a second device on the LAN (not available in this environment)."
        - "Anthony Koukoullis reviewed both blocked routes on 2026-08-31 and explicitly accepted the structural evidence above as sufficient proof that ISS-25-9nrlpb is fixed, authorizing this task to close without a live reproduction. self_eval.passed set to true on that basis, not on a live pass of the checklist's visibility items."
    ```

## Divergences

1. **ISS-25-9nrlpb is fixed by the sibling list, so this list verifies it instead of
   re-fixing it.** The issue describes `renderIntegrationsFailure` appending its box to
   a hardcoded `panelCli`, which is hidden whenever the Desktop apps tab is active. The
   live file at `2046996` matches that description exactly: `src/public/home.ts` lines
   585-597 look up `integrations-panel-cli` and `integrations-panel-gui-app`, clear both,
   and append the box to `panelCli`. The sibling list `TL-85-zjmyth`, authored from
   `PLN-73-x2dik7`, already rewrites that same function in its task 1.4 onto one
   `integrationsList` container, and removes both panels in its task 1.1 and all tab
   state in its task 1.7. A separate fix task here would target the same function with a
   contradictory shape and conflict with TL-85 task 1.4, whichever landed second. TL-85
   task 1.9 also states outright that it does not fix this issue's own defect, so nothing
   in that list checks ISS-25's reproduction. The consequence is that no fix task was
   authored for ISS-25. Task 1.2 runs its reproduction against the flattened dialog and
   closes the issue on evidence, and `TL-85-zjmyth` is recorded in this file's
   `depends_on` so the sequencing is data rather than prose.

2. **ISS-26-abmbhc's cited lines are accurate, and its fix is untouched by the
   flattening.** The issue cites `src/public/home.ts:621-638`. The live file at `2046996`
   matches: line 634 is `return Promise.all(checks).then(refreshIntegrationsEligibility);`
   and lines 636-638 are the shared outer `.catch` that calls
   `renderIntegrationsFailure`. `TL-85-zjmyth` edits `renderIntegrationsFailure`,
   `renderIntegrationsRows` and `resetIntegrationsModalState`, and never edits
   `loadIntegrationsDetection`'s aggregation. The consequence is that task 1.1 is a real
   fix task with no overlap with TL-85, but it still needs rebasing onto the flattening
   because both changes land in the same file.

Every other file cited by IL-13-b7y4ud matched the issue list: `src/public/styles.css`
still carries `[hidden] { display: none !important; }`, and
`handleIntegrationsSkillPresence` still begins at `src/server.ts:466`.
