---
id: PLN-71-lo4omy
type: plan
workstream: WS-80-lgot3j
slug: flowcharge-prose-rename-sweep
title: "Sweep the remaining Praxis prose to FlowCharge across UI text, README and code comments"
status: done
created: 2026-08-30
updated: 2026-08-30
depends_on: []
links: []
---

# Sweep the remaining Praxis prose to FlowCharge

## Summary

This app still calls itself "Praxis", "Praxis Board" and "Praxis Dashboard" in browser tab
titles, runtime dialogs, server output, the README and source comments, while its own
masthead already reads FlowCharge. This plan sweeps that remaining prose to "FlowCharge",
and names the sibling skill suite "FlowCharge Core" where the app refers to it.

The chosen approach is a **hand-audited, per-file staged edit driven by an explicit
decision table**, not a mechanical find-and-replace. Reconnaissance proved a mechanical
sweep would be wrong: 427 of the repo's `praxis|prx` hits are structural identifiers that
must not move, and two comments that look like simple `prxwork/` → `flowcharge/` fixes
would become **false statements** if rewritten that way (see Design, "The folder-name
trap"). Every file gets an individually decided edit, and every decision is recorded here
so no downstream task has to re-judge one.

Seven stages, ordered by user visibility. Each stage is text-only, independent of the
others, and leaves the app building and running.

## Scope

**Acceptance criteria**

1. Both browser tabs read a FlowCharge title; neither document's `<title>` contains "Praxis".
2. Every string a running user can read — the remove-project confirm, the update banner, the
   Electron startup-failure dialog — names FlowCharge, and no such string says "Praxis" or
   "the dashboard". The board loading line is the one exception by design: it replaces "the
   dashboard server" with "the local server" rather than naming the product a second time in
   a sentence that already reads `flowcharge/` — see Contracts for `src/public/board.html:89`.
3. The packaged macOS app is named FlowCharge, and the README's quarantine command quotes the
   matching bundle filename.
4. The README's H1, `package.json` description, and body prose name FlowCharge and describe the
   data folder as `flowcharge/`, with no sentence contradicting another.
5. The server's bind-failure, startup and non-loopback warning messages, and the extractor's
   `--help` text, name FlowCharge.
6. The skill-fetch error text raised from the "Manage integrations" dialog's "Install selected"
   action names the "FlowCharge Core skill archive". That text surfaces in a `window.alert`
   (`src/public/home.ts:688`), not in the dialog's own error box, which serves the tool-detection
   path only.
7. No source comment describes this product as "Praxis", "Praxis Board", "Praxis Dashboard" or
   "the dashboard". The single exception is `src/public/styles.css:105`, a design-provenance
   note about the pre-rebrand app, which Assumptions keeps unchanged.
8. No identifier, file name, CSS class, API route, data field, `appId` or URL constant changes:
   `npm run build` passes and `git diff` shows only string-literal, comment and Markdown edits.

**Out of scope**

- Every structural name: `praxisAPI`, `PraxisWorkstream`, `PraxisData`, `BoardPayload`,
  `CANONICAL_PRAXIS_SKILL_IDS`, `PRAXIS_DATA_DIR`, `.praxis-projects.json`,
  `.praxis-update.json`, `.praxis-installs.json`, `board.html`, the `.board` CSS class,
  `extract-praxis-data.ts`, `praxis-data.d.ts`, `package.json`'s `name` and `appId`.
- The sibling repo, and everything under `flowcharge/`, `prxwork-bak/`, `release/`,
  `mockups/`, `node_modules/`, `dist/`.
- Renaming the on-disk checkout directory `Praxis-Dashboard/`. That is an OS-level action
  with risk unrelated to a prose sweep (it breaks the open working tree, IDE state and
  absolute paths elsewhere on this machine).
- Introducing the name "FlowCharge Core" into the "Manage integrations" dialog
  (`src/public/index.html` lines 59-79, `src/public/home.ts` lines 435, 439, 615-617, 637,
  656-658). Those strings do not name the product today — they say "skills", "Install
  selected", "Missing skills" — so there is nothing to rename. Adding the name is new copy
  authoring with its own product-copy decisions, and it is offered under Adjacent
  opportunities instead.
- Correcting the stale technical fact in `src/lib/extract.ts:62`, whose clause carries no
  branding. `src/lib/projects.ts:5` and `src/lib/git.ts:3` name `prxwork` only as a parsing
  concern and make no claim about this repo's tree or its id shapes; legacy layout support in
  `src/lib/tree-layout.ts` keeps both accurate. All three stay untouched. See Design.

**Assumptions taken (each is a decision a reviewer may overturn)**

- `productName` becomes "FlowCharge". It is the most user-visible name the app carries on
  macOS, which is exactly what this workstream exists to fix. `appId` stays
  `com.praxisboard.app`, so app identity and update continuity are untouched.
- Page titles become `FlowCharge — Projects` and `FlowCharge — Board`. The product name
  leads, so a truncated tab still reads "FlowCharge", and the two documents stay
  distinguishable when both are open.
- `board.html:34` (`<h1 class="tb-title" id="board-title">Board</h1>`) and `src/public/app.ts:1251`
  (`: 'Board';`) both stay verbatim. They are the static markup and the JS fallback for the
  *same rendered element*, which shows the project name once data loads
  (`raw.source.split('/').pop()`). "Board" there is the plain UI noun for the kanban screen,
  not product branding, and removing it leaves the heading with no noun.
- The README's tree diagram keeps `Praxis-Dashboard/` as its root. The diagram is a map of
  the real filesystem, and the checkout is genuinely named that. A tree diagram that does not
  match the tree is worse than one carrying the old name.
- `src/lib/update-check.ts:136`'s `'User-Agent': 'PraxisBoard'` becomes `'FlowCharge'`. The
  comment three lines above calls it "the product name", it is this app's identity to a third
  party, and GitHub only requires the header to be non-empty — nothing keys off the value.
- `src/public/styles.css:105` ("the original dashboard's page background") stays unchanged. It
  is a design-provenance note about the pre-rebrand app, not current branding; renaming it
  produces nonsense and deleting it loses the provenance.
- `.gitignore` lines 7-10 (the `# Praxis-managed` block) stay byte-for-byte. Rewording the
  comment to FlowCharge would falsely label legacy `prxwork/` paths as FlowCharge-managed,
  and deleting the block changes ignore behaviour, which is outside a prose sweep. It retires
  with legacy `prxwork/` support itself.
- No test asserts any string this plan changes. Verified by grep across `src` and `electron`
  for `Praxis Dashboard`, `Praxis Board`, `PraxisBoard` and `Praxis skill archive` in
  `*.test.ts` — zero hits.

## Design

### Decision rule 1 — branding versus structure

A word changes only when it names *this product* or describes it. It stays when it names a
thing: a symbol, a file, a route, a field, a URL, or the kanban screen this app renders.
`src/public/app.ts:1207` ("This board renders one project at a time…") is the reference case
for a legitimate "board" that stays.

### Decision rule 2 — the folder-name trap

Reconnaissance overturned one of the investigation's suggested edits. Two source comments —
`src/public/app.ts:27` and `src/lib/extract.ts:62` — say this repo's own tree is `prxwork/`.
That folder no longer exists here — only `flowcharge/` does — but rewriting them to
`flowcharge/` makes them **false**, because both comments justify an *optional* id-suffix
group by claiming the tree holds bare and suffixed ids together. Measured: `flowcharge/` holds
**zero bare ids** (228 suffixed ids at the time of writing; that count grows as artefacts are
added). No bare id exists anywhere in this repo — `prxwork-bak/` holds none either — so the
"holds both shapes" claim is already false as written, whichever folder it names.

Therefore, in source comments this sweep **changes only the branding noun and never the
folder name**:

- `src/public/app.ts:27` — "this dashboard's own `prxwork/` tree" becomes "this app's own
  `prxwork/` tree". The branding word goes; the factual clause is left exactly as found.
- `src/lib/extract.ts:62` carries no branding in its clause and is not touched at all, stale
  fact and all. `src/lib/projects.ts:5` names `prxwork` only as a parsing concern, makes no
  claim about id shapes, and is likewise untouched.

The correct restatement (the group stays optional because registered *user* projects may
still carry legacy `prxwork/` trees and bare ids — `src/lib/tree-layout.ts:13-30` still
supports them) is a correctness fix, not a rename, and belongs to a separate workstream.

The README is the one exception: it is a single document read top to bottom, and it describes
current app behaviour rather than making claims about this repo's own id shapes. Leaving line 9
saying "Reads a project's `prxwork/` frontmatter" two lines below a rebranded line 7 produces a
self-contradicting document. The README therefore gets a whole-document pass on both the product
name and the data-folder name. Inside its tree fence, real path names stay (`Praxis-Dashboard/`,
`.praxis-projects.json`, `extract-praxis-data.ts`, `praxis-data.d.ts`) while descriptive text
after a path is corrected (line 43's `prxwork/ → PraxisData` becomes `flowcharge/ → PraxisData`).

### Decision rule 3 — where "FlowCharge Core" is introduced

"FlowCharge Core" names the sibling skill suite a user installs, and appears in exactly five
places: `src/lib/agentic-tools-canonical-skills.ts:1`,
`src/lib/agentic-tools-skill-presence.ts:1`, `src/lib/skill-content-fetch.ts:1`, the four
error strings in that same file (lines 188, 194, 208, 226 — the only ones a user reads), and
the README where it names the sibling and its skills.

### Contracts — the wordings that are a judgement call

Mechanical substitutions ("Praxis Dashboard" → "FlowCharge") are left to the task list. These
are decided here because the wording is a choice, not a substitution:

- `src/public/index.html:6` — `<title>FlowCharge — Projects</title>`
- `src/public/board.html:6` — `<title>FlowCharge — Board</title>`
- `src/public/board.html:89` — "Reading the project's `flowcharge/` folder through the local
  server. Larger projects take a moment." Chosen over "the FlowCharge server": the folder name
  in the same sentence already reads `flowcharge/`, so naming the product again is noise, and
  "local server" is accurate — `src/server.ts` binds loopback by default.
- `package.json:4` description — "Local Kanban view of FlowCharge project-management
  workstreams — a bird's-eye view of any project's `flowcharge/` state." "View" replaces
  "dashboard"; the word "dashboard" leaves the product description entirely.
- `README.md:6-7` lead — a reworded sentence, not a substitution. It must drop "dashboard",
  name the product FlowCharge, name the sibling FlowCharge Core, say the convention folder is
  `flowcharge/`, and name the skill `fc-orchestrate`. The existing bracketed link target
  (`https://github.com`) is a placeholder and stays as found.
- `README.md:13, 70-71` — `prx-*` becomes `fc-*` and `prx-index.mjs` becomes `fc-index.mjs`.
  Both confirmed real: `/Users/akoukoullis/.claude/skills/` holds `fc-orchestrate` and its
  `scripts/fc-index.mjs`. "Board movement" at line 13 stays — legitimate technical use.
- `README.md:133` — the quarantine command quotes `"FlowCharge.app"`, tracking `productName`.

### Per-file decision record

Every AMBIGUOUS item raised in the investigation resolves here.

| File and line | Decision |
|---|---|
| `README.md:39` tree root `Praxis-Dashboard/` | Keep — real on-disk path |
| `README.md:104` `ALLOWED_HOSTS=board.local` | Keep — example hostname |
| `README.md:133` `.app` filename | Change with `productName` |
| `package.json:36` `productName` | Change to `FlowCharge` |
| `package.json:2,35` `name`, `appId` | Keep — identity and update continuity |
| `src/public/board.html:34` + `src/public/app.ts:1251` | Keep both — one element's markup and fallback |
| `src/public/app.ts:27` | Branding noun only; folder name untouched |
| `src/lib/extract.ts:62`, `src/lib/projects.ts:5` | No change — stale fact, no branding |
| `src/lib/update-check.ts:136` User-Agent | Change to `FlowCharge` |
| `src/public/styles.css:105` | No change — design provenance |
| `.gitignore:7-10` | No change — retires with legacy `prxwork/` |
| `src/lib/agentic-tools-canonical-skills.ts:1` | Change to "FlowCharge Core skill suite" |
| `src/lib/agentic-tools-canonical-skills.ts:2-4` | Quoted WS-44 title stays verbatim; status clause deferred — see Open questions |
| Integrations dialog copy | No change — new authoring, not a rename |

### Known coupling, flagged not fixed

`src/lib/skill-content-fetch.ts:38` holds
`PRAXIS_REPO_BASE_URL = 'http://100.87.185.97:8110/akoukoullis/Praxis'`. The sibling repo is
still literally named "Praxis" at that URL. This constant is out of scope and must not change,
but it is a live coupling: if the sibling repo is ever renamed for real, this constant breaks
and the integrations dialog stops fetching skills.

## Stages

Ordering is by user visibility descending. The conventional riskiest-first rule does not
apply: every stage is text-only, no stage depends on another, and none can break the build.
The one stage with an effect outside this repo — product identity — is placed third so it is
reviewed on its own rather than buried in a large README diff.

1. **Browser tab titles** (`src/public/index.html:6`, `src/public/board.html:6`) — the single
   most visible artefact of the half-finished migration, since both pages already render the
   FlowCharge wordmark while their tabs read "Praxis". Ends when both tabs read FlowCharge.
2. **Runtime user-facing strings** (`src/public/home.ts:217`, `src/public/update-banner.ts:78`,
   `src/public/board.html:89`, `electron/main.cts:90`) — everything else a user can read on
   screen. Ends when the remove-project confirm, the update banner, the board loading line and
   the Electron failure dialog all name FlowCharge.
3. **Product identity** (`package.json:4` and `:36`, `README.md:133`,
   `src/lib/update-check.ts:136`) — how the product names itself to macOS, to a reader of the
   package manifest, and to GitHub. Held to its own stage because it changes the packaged
   bundle's filename. Ends when a `package:mac` build would produce `FlowCharge.app`.
4. **README whole-document pass** (`README.md`) — the largest single diff, covering both the
   product name and the stale `flowcharge/` folder name, under Decision rule 2. Ends when no
   sentence in the README contradicts another and the file names no `prxwork/` outside a
   deliberate legacy mention.
5. **Server and CLI output** (`src/server.ts:888, 899, 902, 905`,
   `src/scripts/extract-praxis-data.ts:32, 34, 39`) — text an operator reads in a terminal.
   Includes the stale `prxwork/` in the non-loopback warning and in the `--root` help line,
   because both sit in clauses this stage rebrands anyway. Ends when startup, bind-failure and
   `npm run refresh -- --help` all name FlowCharge.
6. **FlowCharge Core naming** (`src/lib/skill-content-fetch.ts:1, 188, 194, 208, 226`,
   `src/lib/agentic-tools-canonical-skills.ts:1`,
   `src/lib/agentic-tools-skill-presence.ts:1`) — the sibling suite gets its new name, with the
   four fetch-failure strings the integrations dialog surfaces. Ends when a forced fetch failure
   shows "FlowCharge Core skill archive" in the alert the dialog's "Install selected" action
   raises.
7. **Source comment branding** (`src/public/app.ts:27`, `src/lib/detail.ts:3`,
   `src/lib/extract.ts:57`, `src/types/praxis-data.d.ts:2`, `src/lib/projects.ts:30`,
   `src/lib/extract.test.ts:1`) — developer-facing prose only, last because nothing user-facing
   depends on it. Ends when no comment in these files names the product "Praxis" or "the
   dashboard".

## Data & compatibility

- **No data migration.** Nothing this plan changes is read back as data. Registry files, the
  update-preference file and the extracted payload keep their existing names and shapes.
- **Packaged bundle filename.** Stage 3 changes the next `npm run package:mac` output from
  `Praxis Board.app` to `FlowCharge.app`. An existing `Praxis Board.app` on disk is not
  replaced or removed by the new build — the author deletes the old bundle by hand. `appId`
  is unchanged, so app identity and the update check are unaffected.
- **Rollback.** Every stage is a text-only commit; `git revert` restores the previous wording
  with no other consequence. Nothing is irreversible.
- **Residual "Praxis" the user will still see, by design.** Two sources are outside any source
  edit and must not be treated as acceptance failures:
  - `src/lib/projects.ts:37` builds this repo's own home-page tile name with
    `path.basename(resolved)`, where `resolved` is `path.resolve(repoRoot)` (line 34), so the
    tile reads "Praxis-Dashboard" purely because the checkout folder is named that. Only an
    actual directory rename changes it, which is out of scope.
  - `.praxis-projects.json` is gitignored machine-local data holding tile entries literally
    named "Praxis-Board" and "Praxis". It is user data, not source, and is not an edit target.
- **Known coupling.** The Gitea URL in `src/lib/skill-content-fetch.ts:38` — see Design.

## Testing strategy

There is no `test` script in `package.json`; the suites are the repo's `*.test.ts` files, and
`npm run build` is the compile gate.

- **Every stage:** `npm run build` passes, and `git diff --stat` for the stage shows only the
  files that stage names.
- **Stages 1, 2, 6:** manual observation — open both pages and read the tabs; trigger the
  remove-project confirm; force a skill-fetch failure from the integrations dialog's "Install
  selected" action and read the alert it raises. These are string swaps in existing rendered
  elements, so no new automated coverage is warranted.
- **Stage 3:** confirm `electron-builder` output is named `FlowCharge.app` before the next
  release is cut. Do not add a test asserting `productName`.
- **Stage 7 and overall:** a closing grep is the real regression check — `Praxis Dashboard`,
  `Praxis Board`, `PraxisBoard` and `[Tt]he dashboard` return zero hits across `src`,
  `electron`, `README.md` and `package.json`, while every structural `Praxis*` identifier still
  resolves (proved by the build passing). The bracket is load-bearing: `src/lib/projects.ts:30`
  reads "The dashboard repo" with a capital T, and a plain case-sensitive `the dashboard` misses
  it. Keep the rest case-sensitive, so `praxis-dashboard` in `package.json` and "the original
  dashboard's" in `src/public/styles.css:105` — both kept on purpose — do not match.
- **No test changes.** Grep confirmed no `*.test.ts` asserts any string this plan edits, so a
  passing suite before and after is the compatibility proof.

## Open questions

1. **The stale WS-44 status claim in `src/lib/agentic-tools-canonical-skills.ts:2-4`.**
   Reconnaissance contradicts the investigation brief here. The comment says WS-44-h5cpzp is
   "status: ready, not yet implemented" and "will eventually vendor the real skill content into
   this repo". The brief states WS-44 has since shipped. The workstream record actually reads
   `status: dropped`, and `src/lib/skill-content-fetch.ts` shows the app now fetches skills live
   instead. So the comment is stale in a third way the brief did not anticipate, and writing
   "status: done" would be a fabrication. **Recommendation:** Stage 6 renames line 1's branding
   and keeps the quoted WS-44 title verbatim (it is a citation — rewriting it makes the record
   untraceable), and leaves the status clause exactly as found. Correcting it needs a decision
   about what this array's future actually is now that vendoring was dropped, which is a
   correctness fix for its own workstream. Confirm this deferral, or say what the comment should
   claim instead.
2. **`productName` and existing distribution — settled.** Anthony Koukoullis, chat,
   2026-08-30: no already-distributed `Praxis Board.app` exists anywhere; nothing has
   been released yet. No coordinated cutover is needed for the next packaged release.

## Adjacent opportunities

Not requested, and none is written into a stage or criterion.

1. Name "FlowCharge Core" in the "Manage integrations" dialog, so the onboarding surface says
   what it installs rather than just "skills" — **build later**, as its own copy workstream.
2. Correct the stale factual claims in `src/lib/extract.ts:62` and `src/public/app.ts:27` to
   state the real reason the id-suffix group stays optional. Both say this repo's own tree holds
   bare and suffixed ids together, and no bare id exists anywhere in this repo — **build later**,
   bundled with open question 1 as one comment-accuracy workstream.
3. Retire the `.gitignore` legacy `prxwork/` block and the legacy layout support behind it —
   **skip for now**; it is a behaviour change that belongs with removing `prxwork/` support.

## Alternatives considered and rejected

- **Scripted find-and-replace across the repo** — rejected: 427 of the `praxis|prx` hits are
  structural, and Decision rule 2 shows two "obvious" replacements would produce false comments.
- **One commit for the whole sweep** — rejected: it buries the one edit with an off-repo
  consequence (`productName`) inside a large README diff, and makes a partial revert impossible.
- **Bare `<title>FlowCharge</title>` on both pages** — rejected: the two documents become
  indistinguishable in the tab strip when a user has the home page and a board open together.
- **Rename `Praxis-Dashboard/` on disk so the tile and the README tree agree** — rejected: an
  OS-level action that breaks the open working tree and machine-local absolute paths, for a
  cosmetic gain, and explicitly out of scope.
- **Deferring the README's stale `prxwork/` references to a separate cleanup** — rejected: the
  same sentences carry the product name, so the file would be left self-contradicting mid-sweep.

## Final summary

Hand-audited, per-file prose sweep to FlowCharge, driven by an explicit decision table rather
than find-and-replace. Seven text-only stages ordered by user visibility, each a small, reviewable,
independently revertible commit; a short session in total. Top risks: `productName` changes the
packaged bundle's filename on disk (stage 3); a mechanical `prxwork/` → `flowcharge/` rewrite in
comments would introduce false statements (Decision rule 2 forbids it); and residual "Praxis"
remains visible in the home-page tile and local registry after the sweep, by design. Two answers
needed: whether to defer the stale WS-44 status clause as recommended, and whether any distributed
`Praxis Board.app` needs a coordinated cutover.
