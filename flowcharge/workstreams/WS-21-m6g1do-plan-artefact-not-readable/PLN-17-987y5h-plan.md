---
id: PLN-17-987y5h
type: plan
workstream: WS-21-m6g1do
slug: plan-artefact-not-readable
title: "Make a workstream's plan readable in a Plan tab and from the card's PLN row"
status: done
created: 2026-08-08
updated: 2026-08-08
depends_on: []
links: []
---

# Make a workstream's plan readable in a Plan tab and from the card's PLN row

## Summary

`plan.md` is the only Praxis artefact type the dashboard names but cannot open. The detail
modal has no Plan tab. The board card draws a `PLN` row that leads nowhere. WS-20 made that row
sort first on every card that holds a plan, so a dead row now leads most cards.

This plan adds a third tab to the detail modal, renders the plan body with a small DOM-built
Markdown subset renderer, and makes the card's `PLN` row open the modal on that tab.

The server reads the plan file, strips its frontmatter, and puts the raw body string in the
detail payload. It parses nothing else. The browser owns all rendering. The renderer emits
elements through the existing `el(tag, cls, text)` helper, so `textContent` stays the only path
from file content to the DOM. No Markdown library enters the repository, and `innerHTML` keeps
its single existing use as a container clear.

Three things carry most of the risk, and each is addressed directly. First, the tab machinery
hardcodes two tabs in two places; the rewrite makes it list-driven so the three ARIA properties
move together in one loop. Second, plan bodies contain lines that start `---` in ordinary prose,
so the frontmatter strip uses the anchored regex `parseFrontmatter()` already uses, never
`split('---')`. Third, bash comments inside fenced code blocks look like Markdown headings, so
the renderer tracks fence state before it reads any line as a heading.

## Scope

### Acceptance criteria

1. The detail modal shows exactly three tabs: `Plan`, `Issues (n)` and `Tasks (n)`.
2. The `Plan` tab label never carries a count. A plan has no countable set.
3. `Issues` stays the selected tab when a card is opened by a plain click or by keyboard.
4. Clicking a card's `PLN` artefact row opens that card's modal with the `Plan` tab selected.
5. Clicking any other part of the card, including an `IL` or `TL` row, opens it on `Issues`.
6. The `Plan` tab shows one section per plan file, headed by the file's artefact ID and title,
   in the same shape the `Issues` tab uses.
7. A workstream with no plan file shows a plain message in the `Plan` tab. The wording follows
   the pattern the Issues and Tasks panels already use. It is not an error.
8. The plan body renders as headings, paragraphs, code blocks, lists and rules. Long prose lines
   wrap and reflow. The reader never meets a wall of monospace text.
9. Text inside a fenced code block renders verbatim. A `# comment` line inside a fence renders as
   code, never as a heading.
10. Inline markup stays as literal characters. A backtick, a `**` pair or a `[link](url)` shows
    the source characters. No inline parsing happens.
11. The plan body DOM is built the first time the `Plan` tab is selected in a modal session, and
    never on `renderDetail()`. A workstream whose plan is never opened builds no plan DOM.
12. Keyboard tab navigation works across all three tabs. `ArrowLeft` and `ArrowRight` move one
    step and wrap. `Home` selects the first tab and `End` selects the last.
13. `aria-selected`, the roving `tabindex` and each panel's `hidden` attribute always agree.
    Exactly one tab has `aria-selected="true"` and `tabIndex = 0`, and exactly one panel is
    visible.
14. The board payload, the KPI strip, the severity panel, the attention panel and the card
    rendering are unchanged.

### Out of scope

- Rendering plan content inline on the board card.
- Parsing plan bodies into structured items on the Node side.
- Inline Markdown markup of any kind.
- Real `<table>` elements for the pipe tables in the corpus.
- Collapsible per-heading sections in the plan body.
- `walkWorkstreams()`'s own `split('---')` body extraction at `src/lib/extract.ts:92-93`. That
  line has the same defect class as trap 2 below, but it feeds the card's `body` preview, which
  this workstream does not touch. It is recorded, not changed.

### Assumptions

- **A1 — Deployment.** There is no production deployment, no live user and no stored data. The
  dashboard is a localhost read-only tool over other projects' folders. The rollback story is
  `git`, and the branch is `feature/plan-artefact-not-readable`. No feature flag is needed and
  none is planned.
- **A2 — Tab order.** The tabs read `Plan | Issues | Tasks`. This matches `ARTEFACT_TYPE_RANK`
  in `src/lib/extract.ts:79`, whose comment defends plan → issues → tasks as the causal chain,
  and it matches the card row order the reader just clicked. `Issues` stays the default
  selection, so the first tab is not the selected tab. That is normal for a tablist.
- **A3 — Corpus.** The findings that drive this plan were re-read today: 16 of 21 workstreams
  here and 34 of 175 in LAD hold a `plan.md`; the filename is always exactly `plan.md`;
  frontmatter is the same ten keys in all 50 files; there are zero checkbox lines in any plan
  body; the largest plan is 1570 lines and 90 KB.
- **A4 — Payload cost.** A 90 KB plan body travels in the detail JSON on every modal open,
  because there is no client-side caching. This is accepted for a localhost tool.

## Design

### Contract 1 — the detail payload

`src/types/praxis-data.d.ts` gains one interface and one field. The file must gain no `import`
and no `export`; its header comment records that either would turn it into a module and the
interfaces would stop being global.

```ts
interface PraxisPlanDetail { artefact: PraxisDetailArtefact; body: string; }
```

`PraxisWorkstreamDetail` gains:

```ts
plans: PraxisPlanDetail[];
```

`body` is the plan file's text with its frontmatter block removed. It is raw Markdown. Nothing
on the Node side reads it.

An **array**, not `PraxisPlanDetail | null`. Two files declaring `type: plan` do not occur in
either corpus today, but the walk loops on frontmatter `type`, not on filename, so a nullable
field would keep one file at `readdir`'s mercy. The array removes that risk instead of
documenting a tie-break for it. It also makes the third collection the same shape as
`issueLists` and `taskLists`, so `renderPlanPanel()` copies `renderIssuesPanel()`'s structure
literally rather than approximately, and the existing `artefactIdNumber` sort is reused a third
time unchanged.

### Contract 2 — the frontmatter strip

`src/lib/extract.ts` hoists the regex `parseFrontmatter()` already uses into a module constant
and exports a stripper beside it:

```ts
const FRONTMATTER = /^---\n([\s\S]*?)\n---/;

export function stripFrontmatter(text: string): string {
  const m = text.match(FRONTMATTER);
  return m ? text.slice(m[0].length).replace(/^\n+/, '') : text;
}
```

`parseFrontmatter()` changes only to use the constant. The behaviour is identical: the regex
carries no `g` flag, so `match` is not stateful and the shared constant cannot develop a
`lastIndex` bug between the two callers.

The regex is anchored at the start of the string, and the slice starts at the end of its match.
That is the whole defence against trap 2 below. A file with no frontmatter returns unchanged
rather than empty.

The stripper lives beside the parser so one definition of "frontmatter" serves both. `detail.ts`
already imports `parseFrontmatter`, `artefactIdNumber`, `ISSUE_ITEM` and `TASK_ITEM` from
`extract.ts`, so one more named export follows the existing seam.

### Contract 3 — the tab list

`src/public/app.ts` replaces the boolean tab state with a list. The three tabs are declared once:

```ts
var TABS = [
  { name: 'plan',   btn: byId('ws-tab-plan'),   panel: byId('ws-panel-plan') },
  { name: 'issues', btn: byId('ws-tab-issues'), panel: byId('ws-panel-issues') },
  { name: 'tasks',  btn: byId('ws-tab-tasks'),  panel: byId('ws-panel-tasks') }
];
var currentTab = 'issues';
```

`selectTab(name, focusTab)` finds the index, falls back to index 0 for an unknown name, then
sets `aria-selected`, `tabIndex` and `panel.hidden` inside one loop body. Putting all three in
one loop is the point: the invariant that they "always move together" becomes structural instead
of a comment over three paired assignments.

Note that the index-0 fallback now lands on `Plan`, not `Issues`. Today's boolean lands on
`Issues`. No caller passes an unknown name, so this changes no reachable behaviour, but the
fallback is stated here rather than left implied.

The keydown handler reads `currentTab`, finds its index and moves modulo `TABS.length`. `Home`
selects `TABS[0]` and `End` selects `TABS[TABS.length - 1]`. No literal tab name survives in it.

The click handler needs **no change**. It already reads `btn.dataset.tab`.

`setTabLabels(issueCount, taskCount)` needs **no change** either. The `Plan` button ships its
own label in `board.html` and nothing ever rewrites it, because a plan has no count and
`Plan (1)` would imply a countable set. So the third of the three structurally-hardcoded sites
disappears rather than growing an argument.

### Contract 4 — the block renderer

One function inside the existing IIFE in `app.ts`:

```ts
function renderPlanBlocks(body: string): HTMLElement
```

It returns one container element. It walks the body's lines once, in order, and emits through
`el()` only. Its whole grammar, grounded in a census of all 50 plan bodies:

| Source line | Emits | Corpus count |
|---|---|---|
| ` ``` ` opener, then every line up to a closing ` ``` ` | one `<pre>` holding the inner lines joined by `\n` | ~179 blocks |
| `# ` or `## ` outside a fence | `<h4>` | 55 + 393 |
| `### ` outside a fence | `<h5>` | 555 |
| `#### ` or deeper outside a fence | `<h6>` | 5 |
| `---`, `***` or `___` alone on a line | `<hr>` | ~142 in bodies |
| a run of `- `, `* ` or `+ ` lines | one `<ul>` of `<li>` | 1559 lines |
| a run of `N. ` or `N) ` lines | one `<ol>` of `<li>`, with `start` set from the first number | 1230 lines |
| a run of other non-blank lines | one `<p>`, the lines joined by a single space | the rest |
| a blank line | closes any open run | 3512 |

Details that are load-bearing:

- **Fence state is tracked before anything else.** Inside a fence, no line is interpreted. Three
  LAD plans hold more than one `# ` line only because bash comments inside fences look like H1s.
  `collectItems()` in `src/lib/detail.ts:48` is the precedent for the walk.
- **An unterminated fence runs to the end of the body.** This deliberately differs from
  `collectItems()`, which treats an unterminated opener as ordinary text. That rule exists there
  to stop an opener swallowing item lines; there are no item lines here. Running to the end
  matches CommonMark and matches what every Markdown reader expects. Both rules are lossless.
- **The fence info string is dropped.** A language tag from file content would reach a class
  attribute. `textContent` is the only content path, and a class name taken from a file could
  also collide with the page's own CSS classes.
- **Headings start at `<h4>`.** The panel's section header is already an `<h3>`
  (`buildSection`, `app.ts:310`) inside the modal's `<h2>` title, so a plan heading nests below
  it. Three source levels map to three output levels, so the visual hierarchy survives.
- **`<hr>` is tested before the list rules,** so `* * *` cannot be read as a list item. `---`
  cannot match a list rule anyway, because the list rules require a space after the marker.
- **Paragraph lines join with a space.** This repository hard-wraps plan prose near 100
  characters. Without joining, a wrapped sentence would render as a stack of one-line
  paragraphs. LAD barely wraps, so joining costs it nothing.
- **A line starting `|` ends the current paragraph run and becomes its own paragraph.** Pipe
  tables are not parsed; they fall through as paragraphs, one row per paragraph. Without this
  break, the paragraph joiner would fuse a whole table into one unreadable line of pipes.
- **Nested list indentation is flattened.** Only 73 of 1559 list lines in the corpus are
  indented at all. One flat `<ul>` or `<ol>` per run is enough.
- **Blockquotes have no rule.** 18 lines corpus-wide. A `> ` line falls through to a paragraph
  and keeps its literal `> `.
- **Inline markup is never parsed.** Backticks, `**`, and link brackets stay as characters.

Expected size is 70 to 90 lines.

### Contract 5 — deferred body build

The plan body must not be built on `renderDetail()`. A 1570-line plan would build roughly a
thousand elements for a tab nobody opened. It must also not sit behind a `<details>` that the
reader has to expand, because the card's `PLN` row deep-links straight to this tab, and a
collapsed body there would be a second dead end.

So the build is deferred to the first selection of the `Plan` tab within one modal session:

```ts
var planData: PraxisPlanDetail[] | null = null;   // null = detail not fetched yet
var planBuilt = false;

function maybeBuildPlan() {
  if (planBuilt || planData === null || currentTab !== 'plan') return;
  planBuilt = true;
  renderPlanPanel(planData);
}
```

`openModal()` resets both to `null` and `false`. `renderDetail()` sets `planData` and calls
`maybeBuildPlan()`. `selectTab()` calls `maybeBuildPlan()` after it switches.

Both call sites are needed, and the order between them is not fixed. A deep-link selects the
`Plan` tab before the fetch resolves, so `selectTab()` runs first and finds no data; the fetch
then arrives and `renderDetail()` builds. A plain open selects `Issues`, so the fetch arrives
first and builds nothing; the build happens when the reader clicks `Plan`. Either way the panel
is built exactly once per modal open.

`renderPlanPanel()` copies `renderIssuesPanel()`'s shape: an empty-state message when
`plans.length` is zero, otherwise one `buildSection(list.artefact)` per file with the rendered
body appended. `lazyBody()` is **not** used here, and `buildItem()`, `buildTaskGroup()`,
`renderValue()` and `renderMap()` are not reachable from this path — all four take a YAML field
set, and a plan has none.

### Contract 6 — the card deep-link

`buildCard()` in `app.ts:107` gives each artefact row its type:

```ts
row.dataset.artefactType = a.type;
```

The board's existing delegated click listener reads it:

```ts
var row = target.closest('.artefact-row') as HTMLElement | null;
openModal(card.dataset.ws, row && row.dataset.artefactType === 'plan' ? 'plan' : 'issues');
```

`openModal(wsId, initialTab)` passes `initialTab` to its existing `selectTab(..., false)` call
in place of the literal `'issues'`.

No new listener, and no new focusable element. Artefact rows stay non-interactive; making them
buttons would add three tab stops to every card.

The keydown path passes `'issues'` unconditionally. The card is the focus target and the row is
not, so the keyboard has no row context to read. A keyboard reader still reaches the plan with
one `Tab` and one `ArrowLeft` inside the modal.

### What each piece must not know

- `src/lib/detail.ts` reads the plan file and strips its frontmatter. It must **not** parse the
  body, count anything in it, or know that a renderer exists.
- `renderPlanBlocks()` takes a string and returns an element. It must **not** know about tabs,
  panels, artefacts, fetching or the modal.
- `renderPlanPanel()` knows about the panel and the section header. It must **not** know the
  block grammar.
- `selectTab()` knows the tab list and the deferred build hook. It must **not** know what any
  panel contains.

### Files this touches

| File | Change |
|---|---|
| `src/types/praxis-data.d.ts` | add `PraxisPlanDetail`; add `plans` to `PraxisWorkstreamDetail` |
| `src/lib/extract.ts` | hoist `FRONTMATTER`; export `stripFrontmatter()` |
| `src/lib/detail.ts` | admit `plan` in the type filter; collect and sort `plans` |
| `src/public/board.html` | third tab button and third panel div |
| `src/public/app.ts` | `TABS` list, `selectTab`, keydown, `renderPlanPanel`, `renderPlanBlocks`, `maybeBuildPlan`, `openModal` argument, `data-artefact-type`, board click handler |
| `src/public/styles.css` | plan body typography |

`src/server.ts` needs **no change**. Its detail route passes the result straight to `sendJson`,
so a wider payload flows through untouched. `src/scripts/extract-praxis-data.ts` needs **no
change**; it never calls `extractWorkstreamDetail()`.

### Correctness traps

1. **No plan is the majority case.** 5 of 21 workstreams here and 141 of 175 in LAD have none.
   The empty state is a plain message in the pattern the Issues and Tasks panels already use, not
   an error.
2. **Never `split('---')`.** 19 of the 50 plan files hold body lines starting `---`, up to 31 of
   them in one LAD file. Splitting would corrupt every one. Use the anchored regex and slice from
   its match end.
3. **Headings inside fences.** Track fence state before reading any line as a heading.
4. **Malformed frontmatter.** `parseFrontmatter()` returns `{}`, `type` is empty, and the walk
   skips the file, so the plan vanishes from both surfaces. This matches today's behaviour for
   issue and task lists, so it stays. It is a deliberate choice, recorded here, not an accident.
5. **More than one plan file.** Removed by the array shape in Contract 1.
6. **DOM cost.** Built once, on first selection of the tab. See Contract 5.
7. **The ARIA contract.** One loop body sets all three properties. See Contract 3.
8. **The tab label is `Plan`,** with no parenthesis and no count.
9. **New CSS must not put a `display` rule on a panel div.** The panels rely on the `hidden`
   attribute and the user-agent `display: none` that comes with it. `styles.css` carries no
   `[hidden]` rule today. A `display` rule on `#ws-panel-plan` would make a hidden panel visible.
   Style a container inside the panel instead.

The modal already scrolls: `.ws-modal-body` sets `overflow: auto` and `.ws-modal-inner` caps the
height, so a 1570-line plan needs no new scroll container.

## Rejected approaches

- **Parse plans into structured items and reuse `buildItem()`.** Rejected on evidence. There are
  zero checkbox lines across all 50 files, so nothing matches `ISSUE_ITEM` or `TASK_ITEM`, and
  the H2 vocabulary is a fixed set here but has a long one-off tail in LAD. There is no item
  structure to find.
- **Put the whole body in one `<pre>`.** Rejected as the shipping design. LAD's p99 line is 347
  characters and its longest is 978, so this would show the plan while leaving it unreadable —
  the exact failure this work exists to fix. It is used for one phase as a scaffold, and deleted.
- **A Markdown library.** Rejected. `package.json` declares zero runtime dependencies, and that
  has been defended in every workstream to date.
- **A hand-rolled parser writing `innerHTML`.** Rejected. Every `innerHTML` assignment in `src/`
  is `= ''`, a container clear. Comments in `app.ts` and `home.ts` record this as a deliberate
  guard against parsing file content as markup.
- **Render plan content inline on the card.** Rejected. A card is a fixed-width tile with
  10.8px artefact rows. Nothing useful from a 300-to-1500-line prose document fits there.
- **`plan: PraxisPlanDetail | null`.** Rejected in favour of the array. See Contract 1.
- **Split the plan into collapsible per-heading sections.** Deferred, not rejected. It is
  tempting for the 754-line and 1570-line files, but the H2 vocabulary is reliable in only one of
  the two corpora, and it adds a heading-classification decision on top of the block renderer.
  The block renderer already emits headings, so turning them into `<details>` later is an
  additive change to one function.

Note also that a comment in `app.ts:327` reads "Two files means two sections in the ONE Issues
tab — never a third tab". That is a rule about multiple issue-list **files**. It is not a ban on
a Plan tab.

## Staged task breakdown

Four phases. Each leaves the app working and each is demonstrable on its own. They are ordered
riskiest-first within what the dependencies allow.

### Phase 1 — Server reads the plan (small)

**Build.** Add `PraxisPlanDetail` and the `plans` field to `src/types/praxis-data.d.ts`. Hoist
`FRONTMATTER` and export `stripFrontmatter()` from `src/lib/extract.ts`. In `src/lib/detail.ts`,
widen the type filter at line 229 to admit `plan`, push
`{ artefact, body: stripFrontmatter(text) }` into a `plans` array, sort it by
`artefactIdNumber`, and return it.

**Files.** `src/types/praxis-data.d.ts`, `src/lib/extract.ts`, `src/lib/detail.ts`.

**Depends on.** Nothing.

**Verify.**
- `npx tsc --noEmit -p tsconfig.json` and `npx tsc --noEmit -p src/public/tsconfig.json` pass.
- `npm run build` then `npm start`, and
  `curl -s 'http://localhost:4173/api/projects/3c975ac5/workstreams/WS-5/detail' | head -c 400`
  shows a `plans` array whose one entry's `body` starts at the plan's H1, not at `---`.
- `WS-21` (no plan file yet) returns `"plans":[]`.
- The LAD replay in Testing strategy passes over all 175 LAD workstreams.
- The board still renders. The browser ignores the new field.

### Phase 2 — A third tab that shows the plan verbatim (medium)

**Build.** Add the `Plan` button and the `ws-panel-plan` div to `src/public/board.html`, first in
the tablist per assumption A2, with `aria-selected="false"` and `tabindex="-1"`. Replace
`selectTab()` and the tablist keydown handler in `app.ts` with the list-driven versions from
Contract 3. Add `currentTab`, `planData`, `planBuilt` and `maybeBuildPlan()` from Contract 5.
Write `renderPlanPanel()` with its empty state and its per-file sections, and have it render each
body into a temporary `<pre>` — two lines, deleted in Phase 3.

The `<pre>` is a scaffold, not the shipping renderer. It is here so this phase's acceptance check
is purely about the tab machinery, the deferral and the empty state, with no renderer output to
confuse the reading. It also makes this phase independently worth shipping: after it, a plan is
readable at all, which it is not today.

**Files.** `src/public/board.html`, `src/public/app.ts`.

**Depends on.** Phase 1.

**Verify.**
- Open `WS-5`. Three tabs show, `Issues` is selected, the `Plan` label carries no count.
- Click `Plan`. The plan text appears.
- Open `WS-21`. The `Plan` tab shows the empty-state message, not an error.
- With the modal open and a tab focused: `ArrowRight` steps forward and wraps from `Tasks` to
  `Plan`; `ArrowLeft` steps back and wraps; `Home` selects `Plan`; `End` selects `Tasks`.
- In devtools, at every step, exactly one tab has `aria-selected="true"` and `tabIndex 0`, and
  exactly two panels carry `hidden`.
- Open a workstream that has a plan, close it without touching `Plan`, and confirm
  `#ws-panel-plan` holds only the `Loading…` message — the body was never built.
- Reopen the same card and confirm the `Plan` tab is not inherited: it opens on `Issues`.

### Phase 3 — The block renderer (medium)

**Build.** Write `renderPlanBlocks()` per Contract 4 and replace the Phase 2 `<pre>` with it.
Add the plan body typography to `src/public/styles.css` under a `.ws-plan` container class: sizes
for `h4`/`h5`/`h6`, paragraph spacing, list indent, and a `<pre>` block reusing the `.ws-raw`
treatment already in the file. Put no `display` rule on the panel div (trap 9).

**Files.** `src/public/app.ts`, `src/public/styles.css`.

**Depends on.** Phase 2.

**Verify.**
- `WS-5`'s plan shows headings, wrapped paragraphs, code blocks, bullet lists and numbered lists.
- A hard-wrapped paragraph in this repository's plans reflows to the panel width instead of
  breaking at the source line ends.
- The LAD workstream `WS-179-hosted-engine-pivot` (1570 lines, 31 body `---` lines) opens
  without error and its rules render as `<hr>`, with no content lost after the first one.
- The LAD workstream `WS-86-lad-opencode-client-unit-tests` (3 lines starting `# `, two of them
  bash comments inside fences) shows those two lines inside a code block, not as headings.
- A plan holding a pipe table renders one paragraph per row, not one fused line.
- A plan holding a backtick or a `**` pair shows those characters literally.
- View source on the panel: every text node came from `textContent`; the DOM holds no element
  named by the file's content.

### Phase 4 — The card's PLN row deep-links to the Plan tab (small)

**Build.** Set `row.dataset.artefactType = a.type` in `buildCard()`. Give `openModal()` an
`initialTab` parameter and pass it to its `selectTab()` call. Read the closest `.artefact-row` in
the board's existing delegated click handler and pass `'plan'` or `'issues'`. Pass `'issues'`
from the keydown handler.

**Files.** `src/public/app.ts`.

**Depends on.** Phase 2. It is last because it is the smallest change and because it is the only
one that is meaningless until the tab it targets is worth landing on.

**Verify.**
- Click a card's `PLN` row. The modal opens on `Plan` with the body rendered.
- Click the same card's `IL` or `TL` row. The modal opens on `Issues`.
- Click the card's title, tags or footer. The modal opens on `Issues`.
- Focus a card and press `Enter`. The modal opens on `Issues`.
- Sort and search the board, then click a `PLN` row again. The single delegated listener still
  works after `renderBoard()` has rebuilt the DOM.

## Data & compatibility

- **No migration.** The dashboard reads other projects' folders and writes nothing back. There
  is no schema, no store and no persisted state beyond `.praxis-projects.json`, which this
  workstream does not touch.
- **Payload compatibility.** `plans` is an added field on the detail response only. The board
  payload from `/api/projects/<id>/data` is unchanged, so the KPI strip, severity panel,
  attention panel and card rendering cannot regress. An old browser tab left open against a new
  server ignores the new field and keeps working with two tabs.
- **Read-only over source projects.** `flowcharge/` is gitignored in the projects the dashboard
  reads, so those files exist on disk only. The LAD replay in Testing strategy must open files
  for reading and must never write into LAD.
- **Rollback.** Per assumption A1, the branch is the rollback. Every phase is revertible on its
  own: Phase 4 alone leaves a working three-tab modal with no deep link; Phase 3 alone leaves the
  Phase 2 `<pre>`; Phase 2 alone leaves an unused `plans` field in the payload; Phase 1 alone
  leaves today's behaviour.
- **Scale.** The renderer is a single forward pass over the body's lines with no backtracking, so
  it is linear in file size. The corpus maximum is 90 KB and 1570 lines. A pathological plan
  hundreds of times larger would block the main thread for one build. No limit is planned: this
  is a localhost tool reading a human-authored planning corpus, and the build already happens
  once, on demand.
- **Observability.** The existing paths suffice. The detail route already logs a failure and
  answers `500 { error }`, and `openModal()` already surfaces that message in every panel.

## Testing strategy

This repository has no test framework and no lint script. `package.json` defines only `build`,
`prestart`, `start`, `prerefresh` and `refresh`. Verification is therefore compilation, a
read-only replay over a second corpus, and a browser walkthrough.

**Type checks, every phase.**

```bash
npx tsc --noEmit -p tsconfig.json
npx tsc --noEmit -p src/public/tsconfig.json
npm run build
```

The second check is the one that guards the browser constraint: `src/public/tsconfig.json` sets
`"module": "none"`, so any `import` or `export` added to `app.ts` becomes a compile error rather
than a broken page.

**The LAD replay, Phase 1 and again after Phase 3.** A throwaway Node script in the session
scratchpad, never committed and never writing to LAD. It imports `dist/lib/detail.js`, calls
`extractWorkstreamDetail('/Users/akoukoullis/Work/AK/AgenticCodingTests/LAD', id)` for every
`WS-N` in LAD, and asserts:

- no call throws;
- exactly 34 workstreams return a non-empty `plans` array, and none returns more than one entry;
- no `body` contains the file's frontmatter block, checked by asserting that no body's first
  non-blank line is `---`;
- every `body` is non-empty;
- the count of body lines equal to `---` matches the count found by grep on the source file, so
  the strip removed the frontmatter delimiters and nothing else.

The last assertion is the direct regression check for trap 2, and it is the one that would have
caught `split('---')`.

**Browser walkthrough, per phase.** The per-phase Verify lists above are the script. The three
checks worth repeating at the end are: the ARIA triple agreeing at every tab transition; a plan
never built until its tab is selected; and a fenced `# comment` rendering as code.

**A note for a later test-writing pass.** If this repository ever gains a test framework,
`stripFrontmatter()` and `renderPlanBlocks()` are the two pure functions worth unit tests, and
the fixtures already exist: the 50 real plan bodies, plus the four LAD files named in the Phase 3
verification. `renderPlanBlocks()` returns a detached element, so it is testable in any DOM
environment without the modal. Nothing else added here is worth a unit test; the rest is wiring
best checked in the browser.

## Open questions

1. **Tab order.** This plan puts `Plan` first, matching `ARTEFACT_TYPE_RANK`'s documented
   plan → issues → tasks chain and the card's own row order, with `Issues` still the default
   selection. The alternative is appending `Plan` last, which keeps the first tab and the default
   tab the same. **Recommendation: `Plan | Issues | Tasks`.** It is a one-line change either way,
   in `board.html` and in the `TABS` array.
2. **Pipe tables.** 573 lines across the corpus, in 10 of 16 plans here and 24 of 34 in LAD, will
   render as one paragraph per row. That is honest but plain. Real `<table>` output would need a
   header-separator rule and cell splitting, roughly 25 more lines in the renderer.
   **Recommendation: ship the paragraph fall-through, look at it in Phase 3, and decide then.**
3. **Very long plans.** LAD's largest plan is 1570 lines. This plan renders it whole and defers
   collapsible per-heading sections. **Recommendation: keep the deferral, and revisit only after
   reading that file in the panel in Phase 3.** The block renderer already emits the headings,
   so the change stays additive to one function.
4. **What I would have asked about deployment.** Assumption A1 states there is no production
   deployment, no live user, no stored data and no migration, and that `git` is the rollback. I
   would have confirmed that, and confirmed that no other consumer reads the detail endpoint's
   JSON shape. If either is wrong, the phase ordering still holds, but Phase 1 would need the
   `plans` field treated as an external contract rather than an internal one.

## Final summary

Add a third `Plan` tab to the detail modal, fed by a raw body string from the server and rendered
by a small DOM-built Markdown subset renderer, and make the card's `PLN` row open the modal on
it.

Four phases: server read (small), third tab with a scaffold `<pre>` (medium), the block renderer
(medium), the card deep link (small). Roughly one sitting each.

Top three risks: the ARIA tab rewrite silently breaking `aria-selected`, the roving `tabindex` or
`hidden`; the frontmatter strip corrupting the 19 files that hold body lines starting `---`; and
bash comments inside fenced code blocks rendering as headings. Each has a named check in the
verification lists.

Needs a decision: tab order (question 1), whether pipe tables get real `<table>` output
(question 2), and whether a 1570-line plan is readable un-collapsed (question 3). None of the
three blocks Phase 1 or Phase 2.
