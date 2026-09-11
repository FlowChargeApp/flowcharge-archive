---
id: PLN-91-m8rnir
type: plan
workstream: WS-110-ccijqv
slug: skill-update-silent-overwrite-warning
title: "Confirm before Update overwrites skill files FlowCharge did not install"
status: done
created: 2026-09-11
updated: 2026-09-11
depends_on: []
links: []
---

# Confirm before Update overwrites skill files FlowCharge did not install

## Summary

The per-row **Update** button in the Manage Integrations modal calls
`installIntegrationsSelected([entry])` (`src/public/home.ts:549-551`), the same install
path a fresh install uses. It overwrites every file the current format writes, with no
confirmation. For a tool whose skill files arrived by hand-sync, hand-edit or a copy from
another machine, those files are the user's own and the overwrite is silent.

This feature adds one blocking confirmation in front of that click, and only for the case
FlowCharge cannot show it installed the files itself: no record for that tool at the
current scope in the install ledger (`~/.flowcharge/.praxis-installs.json`, reached from the
browser through `GET /api/integrations/installs`). A row with a ledger record updates with
no confirmation, exactly as today.

The rule is ledger presence, not a content comparison. The ledger's `contentHash` hashes
the `InstallContent` FlowCharge was about to write (`src/lib/agentic-tools-content.ts:44-51`),
not the formatted files that landed on disk, so it cannot answer "were these files edited
after we wrote them" without a new server route that re-reads and re-canonicalises every
installed file. Ledger presence answers exactly the case WS-107-do28jk flagged, with no
server change at all.

The confirmation is `window.confirm`, the surface `src/public/home.ts:220` already uses for
the destructive "Remove project" action. It needs no dependency, no markup, and no inline
script, so the strict CSP is untouched. The decision itself lands in
`src/lib/agentic-tools-chip-rules.ts` as a new pure export, beside
`deriveIntegrationsRowDecision`, which keeps `home.ts` free of rules and gives the feature a
`node --test` seam.

## Scope

### Acceptance criteria

1. Clicking **Update** on a row with no install-ledger record for its tool at the current
   scope shows a blocking confirmation before any install call is made.
2. Cancelling that confirmation makes no install call, so no file is written and no chip,
   note or button state on the row changes.
3. Confirming it runs exactly the install today's Update button runs, with the same install
   chip, the same version handling and the same failure alert.
4. Clicking **Update** on a row that does have an install-ledger record for its tool at the
   current scope installs with no confirmation, as today.
5. The confirmation names the tool, states that FlowCharge has no record of installing its
   skill files, and states that the update overwrites those files and loses local changes.
6. When the install-ledger fetch did not succeed in this dialog session, **Update** shows
   the confirmation, because FlowCharge cannot show it installed the files.
7. A row FlowCharge installed or updated earlier in this dialog session shows no
   confirmation on a later **Update** click in that same session.
8. The **Install selected** button's behaviour is unchanged for every row, installed or not.

### Out of scope

- Any change to whether the Update chip and button are offered for a ledger-less install.
  WS-107-do28jk settled that: they stay offered.
- The **Install selected** path. It installs whatever rows the user ticked, with no
  confirmation, before and after this change.
- Detecting a hand edit made *after* a FlowCharge install (a content comparison against
  what FlowCharge wrote). See Alternatives.
- Backing up, diffing, or merging the files an update overwrites.
- Any server route, any ledger field, and any on-disk format.

### Assumptions

1. **Ledger presence is the trigger.** Absence of a record for `(toolId, scope)` means
   FlowCharge did not install those files, so they may be the user's own. This is the case
   WS-107-do28jk's open question described, and it matches this machine's own Claude Code and
   OpenCode installs.
2. **`window.confirm` is the surface.** `src/public/home.ts:220` already uses it for a
   destructive action, it needs no dependency, and it blocks the click until the user
   answers. A custom modal inside the already-open `<dialog>` buys polish and costs focus
   management.
3. **An unreadable ledger warns.** `loadIntegrationsInstallRecords` swallows a failed fetch
   and leaves the map empty (`src/public/home.ts:746-748`), which is indistinguishable from
   "no records" today. The feature's purpose is to avoid a silent overwrite, so the unknown
   case warns rather than proceeds.
4. **No production data and no migration.** The change is browser-side only. It reads state
   the page already holds, writes no file, and changes no persisted shape, so there is
   nothing to migrate and nothing to roll forward.
5. **No feature flag.** The repository has no flag mechanism, and each stage leaves the app
   shippable on its own, so the change ships as an ordinary release.

## Key flows

**Update a tool whose skill files FlowCharge did not install** — **Actor:** a user with the
Manage Integrations modal open. **Preconditions:** the row shows the "Update available" chip
and an enabled Update button; the install-ledger map holds no record for that tool at the
current scope. **Main flow:** the user clicks Update; a confirmation appears naming the tool
and stating that the update overwrites files FlowCharge has no record of installing; the
user confirms; the existing install runs and the row's install chip shows its result.
**Outcome:** the skill files hold the published release, and the user knew before it
happened. **Edge cases:** cancelling makes no install call at all; a row with a ledger
record skips the confirmation; a row FlowCharge already installed in this session skips it;
an install that fails after a confirmation still shows today's failure alert.

## Design

### What changes

Two files change. No route, no port, no type in `src/public/lib/agentic-tools-api.ts`, and no
`src/lib/` module other than the rules module.

**`src/lib/agentic-tools-chip-rules.ts`** — gains one exported type and one exported pure
function, beside the existing `deriveIntegrationsRowDecision`. The module stays
import-free: its header comment, and ARCHITECTURE.md Section 11's `browser-entry-bundles`
rule, allow `home.ts` to import it only while it imports nothing itself. The new function
takes booleans, so it needs no type from anywhere.

```ts
export interface UpdateOverwriteWarningInput {
  // The getInstallStatus fetch resolved in this dialog session.
  ledgerLoaded: boolean;
  // A record exists for this row's toolId at the currently selected scope.
  hasLedgerRecord: boolean;
  // FlowCharge installed or updated this tool at this scope earlier in this
  // dialog session, so the files on disk are its own.
  installedThisSession: boolean;
}

export function updateOverwriteWarningNeeded(input: UpdateOverwriteWarningInput): boolean;
```

The answer is `false` when `installedThisSession` is true, and `false` when `ledgerLoaded`
and `hasLedgerRecord` are both true. It is `true` in every other combination, including an
unloaded ledger. The function is a function of its argument only: no DOM, no fetch, no
user-facing string, in line with the rest of the module.

**`src/public/home.ts`** — gains two pieces of dialog-session state, one message builder, and
one guard in the Update button's click handler.

- `var integrationsInstallRecordsLoaded: boolean` — `false` initially; set `true` in
  `loadIntegrationsInstallRecords`' success branch and `false` in its `.catch`
  (`src/public/home.ts:732-749`); reset to `false` in `resetIntegrationsModalState`
  (`src/public/home.ts:876-888`), beside the `integrationsInstallRecords = {}` line that
  already lives there.
- `var integrationsLiveInstallKeys: Record<string, true>` — keyed with the existing
  `installRecordKey(toolId, scope)` (`src/public/home.ts:487-489`), so a global install and
  a project install of the same tool stay separate. An entry is added in
  `installIntegrationsSelected`'s success branch for each result whose status is not
  `skipped-no-format` (`src/public/home.ts:840-860`), and the whole map is cleared in
  `resetIntegrationsModalState`. Both buttons' installs record a key, because both make the
  files FlowCharge's; this records state only and changes nothing either button does.
- A message builder taking the row's `displayName` and returning the confirmation text.
  `home.ts` keeps every user-facing string, as it does for every label in this modal. The
  text reads:

  > Update the FlowCharge Core skills for <tool name>?
  >
  > FlowCharge has no record of installing these skill files, so they may hold local
  > changes. Updating overwrites every file the current release writes, and any local
  > change to those files is lost.
  >
  > Cancel leaves the files exactly as they are.

- The guard sits in the Update button's own click handler in `buildIntegrationsRow`
  (`src/public/home.ts:549-551`), not inside `installIntegrationsSelected`. That placement
  is what keeps the **Install selected** path structurally untouched: the shared install
  function is not modified for this feature beyond recording a live-install key. The handler
  calls `updateOverwriteWarningNeeded`, and on `true` returns early unless `window.confirm`
  answers true.

Reading the ledger here does not reopen the decision recorded at `src/public/home.ts:475-481`,
because the two reads answer different questions: the filesystem presence check answers "are
the files on disk", the ledger answers "did FlowCharge write them", and only the ledger can
answer the second.

### What each part knows

- `agentic-tools-chip-rules.ts` knows three booleans and the rule joining them. It must not
  know what a ledger is, what a scope key looks like, what the confirmation says, or that a
  confirmation exists at all.
- `home.ts` knows the state, the words and the DOM. It must not hold the rule, in line with
  its own comment at `src/public/home.ts:559-565`.
- Nothing on the server changes, so `src/http/` keeps its current reads: the ledger still
  reaches the browser only through `GET /api/integrations/installs`
  (`src/http/routes-integrations.ts:222-234`).

### Consequence worth stating

The rule applies to every row that shows the Update button, not only the tools the per-skill
presence check covers, because the trigger is ledger presence and not presence-check coverage.

At Project scope the Update button only appears when a ledger record exists: the presence
check is gated to Global scope in the rules module (`src/lib/agentic-tools-chip-rules.ts:109`),
so `effectiveVersion` at Project scope can only come from `ledgerVersion`, and `updateOffered`
requires a version. The confirmation therefore fires at Global scope in practice. The rule is
still expressed per scope, using the scope-keyed record map, so it stays correct if the
project-scope gate ever changes.

## Stages

1. **The confirmation for a ledger-less row.** Adds `updateOverwriteWarningNeeded` with the
   full, final three-field `UpdateOverwriteWarningInput` shape defined above, and its unit
   cases, then wires the guard into the Update click handler using the record map that
   `home.ts` already holds. The function's input shape is complete from the start, so it does
   not change between stages; at this stage `home.ts` passes `ledgerLoaded: true` and
   `installedThisSession: false` as literals, because the state that answers them does not
   exist yet. It is first because it is the whole user-visible behaviour and carries the one
   real risk: reading the right scope-keyed state at click time. When it ends, clicking Update
   on a row with no ledger record shows the confirmation, Cancel writes nothing, and a row
   with a record is untouched.
2. **The two secondary states.** Adds the `home.ts` dialog-session state that feeds the
   already-complete `ledgerLoaded` and `installedThisSession` inputs, its reset on dialog
   close, and the unit cases for those two inputs. It adds no field and changes no signature.
   It is second because both inputs only refine when the stage 1 confirmation appears. When it
   ends, a failed ledger fetch warns, and a tool FlowCharge just installed in this session does
   not warn again.

## Data & compatibility

- No migration. No file on disk changes shape, and `.praxis-installs.json` is read exactly as
  it is read today.
- No API or contract change. `GET /api/integrations/installs`, `InstallRecord`, and
  `PraxisSkillInstallAPI` are all untouched, so the browser shim stays in sync with no edit.
- Backward compatible with every existing ledger file, including a record written before
  `version` or `resolvedPaths` existed: the rule reads presence only, never a field.
- `IntegrationsRowDecision` keeps its current shape, so every existing case in
  `src/test/unit/agentic-tools-chip-rules.test.ts` stays valid.
- ARCHITECTURE.md Section 8's integration map lists the `homeEntry`-to-`integrationsChipRules`
  named imports as exactly `IntegrationsRowRuleInput` and `IntegrationsRowDecision`
  (ARCHITECTURE.md line 1773). This change adds `updateOverwriteWarningNeeded` and
  `UpdateOverwriteWarningInput` to that same import path, so that row is one more place the
  closing ARCHITECTURE.md review task must update.
- Rollback is a revert of the two files. No persisted state is created, so nothing survives
  the revert and nothing needs undoing.

## Testing strategy

- **Stage 1, unit:** extend `src/test/unit/agentic-tools-chip-rules.test.ts` with cases for
  `updateOverwriteWarningNeeded` — a loaded ledger with a record answers false, a loaded
  ledger without one answers true. The file already drives the module with plain object
  literals and `node:test`, so no harness is added.
- **Stage 2, unit:** cases in the same file for an unloaded ledger answering true and for
  `installedThisSession` answering false whatever the other two inputs are.
- **Both stages, manual:** `home.ts` is a single IIFE that resolves elements by id at module
  evaluation time, so nothing in it can be imported into a Node process and the click wiring
  has no automated seam. Verify in the browser against a disposable tool target only — this
  path performs real writes into a real tool config directory.
- **No route or boundary test.** No server file changes.
- Tests run against compiled output, so `npm test` builds first; reason about
  `dist/test/unit/agentic-tools-chip-rules.test.js`, not the source path, when a run fails.

## Open questions

None. The two gaps the brief left open — the trigger and the confirmation surface — are both
recorded as assumptions above, and both are recoverable by a later change: a content
comparison can be added in front of the same guard without moving it, and the confirmation
surface can be replaced without changing the rule.

## Adjacent opportunities

Not requested, listed for the user to promote or drop.

1. Warn on **Install selected** as well, for a ticked row whose presence check already shows
   files on disk with no ledger record — skip, it is out of scope by decision.
2. Compare the installed files against what FlowCharge wrote, so a FlowCharge install that was
   hand-edited afterward also warns — skip here, file it separately if wanted.
3. Refresh the Update chip after a successful update on a ledger-less row, which stays visible
   today because the version bump at `src/public/home.ts:853-859` only runs when a record
   exists — skip, it is a separate defect.

## Alternatives considered and rejected

1. **Content-hash comparison against the ledger's `contentHash`** — the stored hash covers the
   `InstallContent` FlowCharge was about to write (`src/lib/agentic-tools-content.ts:44-51`),
   not the formatted files on disk, so the comparison needs a new server route that re-reads
   and re-canonicalises every installed file. That is new scope beyond what WS-107-do28jk
   flagged, for a case the ledger check already covers.
2. **A custom in-page confirmation modal** — larger, and it must manage focus and Escape
   inside the already-open `<dialog>`, for no gain over the surface `home.ts:220` already uses.
3. **Disable or hide Update for a ledger-less install** — settled the other way in
   WS-107-do28jk, and the workstream record puts it out of bounds here.
4. **Add the warning as a field on `IntegrationsRowDecision`** — it would carry a value only one
   click handler reads, add per-entry storage, and enlarge a shape many existing unit cases
   assert on.
5. **Put the rule inline in `home.ts`** — `home.ts` holds no rules by design
   (`src/public/home.ts:559-565`), and nothing inside its IIFE can be unit-tested.

## Final summary

- **Approach:** confirm with `window.confirm` in the Update button's own click handler,
  triggered by the absence of an install-ledger record for that tool at the current scope.
- **Size:** 2 stages, two files changed (`src/lib/agentic-tools-chip-rules.ts`,
  `src/public/home.ts`) plus unit cases in one existing test file. Small.
- **Risks:** the click-time state must be read at the current scope, or the confirmation
  appears on the wrong rows; the DOM wiring has no automated seam and needs a manual check
  against a disposable target; a failed ledger fetch makes every row warn, which is deliberate
  but will read as noisy if the fetch fails often.
- **Open questions:** none. Two assumptions are worth challenging if the user disagrees: the
  trigger is ledger presence rather than a content comparison, and an unreadable ledger warns
  rather than proceeds.
