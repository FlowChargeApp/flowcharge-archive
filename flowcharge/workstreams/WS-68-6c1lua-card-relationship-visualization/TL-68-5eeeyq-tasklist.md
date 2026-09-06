---
id: TL-68-5eeeyq
type: tasklist
workstream: WS-68-6c1lua
slug: card-relationship-visualization
title: "Two-kind relationship display: depends_on and links on board cards"
status: ready
created: 2026-08-25
updated: 2026-08-25
author: Anthony Koukoullis
depends_on: [PLN-57-oevt8p]
links: []
mode: spec
base_commit: b9fe85b
---

# PRX Tasks

## Two-kind relationship display: depends_on and links on board cards

The board shows one relationship kind today. `buildCard` renders `depends_on` as a `⤷` run of
clickable IDs in the card footer, and a card click paints the whole transitive dependency chain.
The `links` relationship is invisible: the extractor does not read it, the payload does not type it,
and nothing draws it.

This task list implements PLN-57-oevt8p, which makes both kinds visible and tells them apart with
four simultaneous cues — glyph, position, ring style, and colour — by extending the WS-25 machinery
in place rather than replacing it. `links` enters the payload with the same array coercion
`depends_on` already uses. The client builds one extra **mirrored** edge map, `linkedWith`, because
the real data is not reciprocal. The footer gains a second `⇄` run as a sibling of `.deps`, built
from `.dep-link` elements carrying `data-dep`, so **neither delegated `#board` listener changes at
all**. A card click paints a **one-hop dashed** ring on the clicked card's direct link neighbours in
a new `--linked` colour, while the transitive solid chain stays exactly as WS-25 built it. The
card-detail modal's meta region gains an uncapped "Depends on" and "Related" block.

Six files change: `src/lib/extract.ts`, `src/types/praxis-data.d.ts`, `src/lib/extract.test.ts`,
`src/public/app.ts`, `src/public/styles.css` and `src/public/board.html`. No SVG overlay, no new
file, no new package, no new network call, no schema or ID change. `depends_on` semantics, its
transitive walk, its glyph, its colour and its `.deps` DOM are out of scope, as are reverse
dependencies, clickable modal IDs, a legend, and any change to the filters, sort, search, KPI strip
or lower panels.

The four parent tasks are the plan's four phases, in the plan's order. Each leaves the board working
and is independently landable: task 2 needs task 1, task 3 needs task 2, task 4 needs task 3.

- [ ] 1. Phase 1 — `links` in the payload

  ```yaml
  description: "Read `links` in the extractor, type it on PraxisWorkstream, and cover the four coercion cases with unit tests. Covers acceptance criteria 1 to 3. Depends on nothing."
  ```

  - [ ] 1.1 Type `links` on `PraxisWorkstream`
    ```yaml
    description: "Add a required `links: string[]` field to the PraxisWorkstream interface, one line after depends_on."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Anchor: the `PraxisWorkstream` interface in src/types/praxis-data.d.ts, at its `depends_on: string[];` line."
      - "Add `links: string[];` immediately after it. Required, NOT optional, and deliberately unlike `blocked?: string`: the extractor coerces the field to an array on every record, so an optional type would describe a state that cannot occur."
      - |
        src/types/praxis-data.d.ts
        <<<<<<< SEARCH
          depends_on: string[];
          body: string;
        =======
          depends_on: string[];
          links: string[];        // NEW — always an array, never absent
          body: string;
        >>>>>>> REPLACE
      - "Change nothing else in this file. PraxisArtefact, PraxisIssue, PraxisData, BoardPayload and every detail interface stay exactly as they are."
    pattern: "src/types/praxis-data.d.ts — the PraxisWorkstream interface only."
    imports: "None. This file carries no import and no export on purpose: a top-level import or export would turn it into a module and the interfaces would stop being global to both compilations."
    compatibility: "Both the root tsconfig.json compilation and src/public/tsconfig.json read these ambient globals. Making `links` required is safe because the field is produced and consumed inside one build — src/server.ts calls extractPraxisData() per request, so a payload without the key cannot reach a client that expects it."
    gotcha: "Adding the field here before task 1.2 lands leaves `npm run build` failing on the missing property in extract.ts's `out.push({...})`. Land 1.1 and 1.2 together, or run 1.2 first. Do not silence the error by making the field optional."
    verify:
      - "npm run build"
      - "grep -n 'links: string\\[\\];' src/types/praxis-data.d.ts — must return exactly one line, inside PraxisWorkstream."
    checklist:
      - "Is `links` declared as `string[]` and NOT as `string[] | undefined` or `links?`?"
      - "Does the file still carry no top-level `import` and no top-level `export`?"
      - "Is `links` the only line added, with every other interface byte-identical?"
      - "Does `npm run build` complete all three TypeScript compilations plus the esbuild bundle?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 1.2 Read `links` in `walkWorkstreams`
    ```yaml
    description: "Add the array-coercion read for `links` to the workstream object the extractor pushes, copying the shape depends_on and tags already use."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Anchor: the `out.push({ ... })` object literal at the end of the workstream walk in src/lib/extract.ts, at its `depends_on:` line."
      - "Add one `links:` line immediately after `depends_on:`, using the identical coercion: an array passes through, a scalar is wrapped, and anything falsy becomes `[]`."
      - |
        src/lib/extract.ts
        <<<<<<< SEARCH
              depends_on: Array.isArray(wsFm.depends_on) ? wsFm.depends_on : (wsFm.depends_on ? [wsFm.depends_on] : []),
              body: body.split('\n').filter(Boolean).slice(0, 3).join(' '),
        =======
              depends_on: Array.isArray(wsFm.depends_on) ? wsFm.depends_on : (wsFm.depends_on ? [wsFm.depends_on] : []),
              links: Array.isArray(wsFm.links) ? wsFm.links : (wsFm.links ? [wsFm.links] : []),
              body: body.split('\n').filter(Boolean).slice(0, 3).join(' '),
        >>>>>>> REPLACE
      - "Change nothing else on the Node side. /api/projects/:id/data in src/server.ts and the Electron getProjectData handler in electron/ipc-handlers.cts both proxy whatever extractPraxisData() returns, so the field rides the existing transport with no edit."
    pattern: "src/lib/extract.ts — the workstream `out.push` object literal only."
    imports: "None. `parseFrontmatter` already returns `Record<string, string | string[]>`, so `wsFm.links` types as `string | string[] | undefined` and the ternary narrows it without a cast."
    compatibility: "Matches the two-line shape commit befaec1 used for `blocked`. The same coercion already serves `tags` and `depends_on` in the same literal — do not introduce a shared helper for it, which the plan does not ask for."
    gotcha: "Do not read the field with `fmStr()`; that is for scalars. Do not add a `.filter(Boolean)` or a trim that `depends_on` does not have — any asymmetry here becomes a data difference between the two kinds later."
    verify:
      - "npm run build"
      - "node --test dist/lib/extract.test.js — the existing tests must still pass unchanged."
      - "grep -n 'links: Array.isArray' src/lib/extract.ts — must return exactly one line."
    checklist:
      - "Is the coercion character-for-character the same shape as the `depends_on` line above it?"
      - "Is `links` placed after `depends_on` and before `body`, so the payload key order matches the interface?"
      - "Were src/server.ts and electron/ipc-handlers.cts left untouched?"
      - "Do all pre-existing tests in dist/lib/extract.test.js still pass?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 1.3 Unit-test the four `links` coercion cases
    ```yaml
    description: "Give withFixtureProject an optional workstream-file override, then add four extractor tests: links as a populated array, as an empty array, absent, and as a scalar."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Anchor 1: `function withFixtureProject(run: (root: string) => void): void` in src/lib/extract.test.ts. Give it a second, OPTIONAL parameter carrying the workstream-file text, defaulting to the existing `WORKSTREAM_FILE` constant, and write that value instead of the constant when it creates workstream.md. The default-parameter shape is what guarantees the two existing tests keep passing with no edit to their call sites."
      - "Anchor 2: the `WORKSTREAM_FILE` template literal. Leave it exactly as it is — it declares no `links` key, which makes it the 'absent' case for free."
      - "Add four tests at the end of the file, each opening the fixture with its own workstream frontmatter and asserting the exact array on `extractPraxisData(root).workstreams[0].links` with `assert.deepEqual`."
      - "Case A — `links: [WS-2-bg6ela]` in the frontmatter must extract as `['WS-2-bg6ela']`."
      - "Case B — `links: []` must extract as `[]`."
      - "Case C — no `links` key at all (the default fixture) must extract as `[]`, never `undefined`. Assert this with `assert.deepEqual(ws.links, [])`, and additionally assert the key is present rather than absent."
      - "Case D — a scalar `links: WS-2-bg6ela` must extract as `['WS-2-bg6ela']`."
      - "Build each override by copying WORKSTREAM_FILE's frontmatter shape and adding or changing only its `links` line. Do not restructure the existing constants and do not touch ISSUELIST_FILE."
    pattern: "src/lib/extract.test.ts — withFixtureProject at line 111, and new tests appended after the final `data()` helper."
    imports: "Already present in the file: `test` from node:test, `assert` from node:assert/strict, and `extractPraxisData` from ./extract.js. Add nothing."
    compatibility: "The file is compiled by the root tsconfig.json (`include` covers src/lib/**/*.ts) and run with `node --test dist/lib/extract.test.js` after `npm run build`. There is no `test` npm script and this task does not add one. The fixture root is an mkdtemp directory removed in a `finally`, so a failing assertion still leaves no tree behind — keep that property."
    gotcha: "parseFrontmatter is the project's own minimal parser, not a YAML library: write the inline array exactly as the repository's own frontmatter writes it (`links: [WS-2-bg6ela]`), not as a multi-line block list, or the fixture will assert the parser's behaviour rather than the extractor's. `assert.equal` on two arrays compares references and always fails — use `assert.deepEqual`."
    verify:
      - "npm run build"
      - "node --test dist/lib/extract.test.js — all tests pass, the two pre-existing ones included."
      - "grep -c \"^test(\" src/lib/extract.test.ts — must return 4 more than it did before this task."
    checklist:
      - "Do the two pre-existing tests still call withFixtureProject with one argument and still pass?"
      - "Does every new case assert with `assert.deepEqual` rather than `assert.equal`?"
      - "Is the absent-key case asserting `[]` and proving the key is present, not merely not-undefined?"
      - "Is WORKSTREAM_FILE itself unmodified, and ISSUELIST_FILE untouched?"
      - "Does the fixture still delete its temp root in a `finally` on the failing path?"
    self_eval:
      passed: false
      failures: []
    ```

- [ ] 2. Phase 2 — the mirrored index and the footer link run

  ```yaml
  description: "Build the mirrored linkedWith index and render the second, capped `⇄` footer run beside the existing `.deps` run. Covers acceptance criteria 4 to 11, including criterion 8: the dependency run stays uncapped by user decision — see Divergence 1 (resolved). Depends on task 1."
  ```

  - [ ] 2.1 Add the mirrored link index and wire it into `applyData`
    ```yaml
    description: "Add linkedWith module state, factor out knownIds, add buildLinkIndex, and call it beside the existing buildDepIndex() call."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Anchor 1: the module-scope state block in src/public/app.ts, at the `dependsOn` / `dependedBy` / `chainRoot` / `chainSet` declarations. Add `var linkedWith: Record<string, string[]> = {};` beside them, with a comment recording that the map is undirected and MIRRORED, deduped, self-edges dropped, and that an edge is recorded only when both ends name a workstream that exists."
      - "Anchor 2: `function buildDepIndex(): void`. Extract its `var known` construction into a new `function knownIds(): Record<string, true>` declared beside it, and have buildDepIndex call it. This is a one-line body change; buildDepIndex's contract, its dangling-edge rule and its output are unchanged. Stating the rule once is what stops it drifting between the two indexes."
      - "Anchor 3: beside buildDepIndex, add `function buildLinkIndex(): void`. It resets `linkedWith`, takes `knownIds()`, then for every workstream `w` and every id in `w.links`: skip an id that is not known, skip `w.id` itself, then push each end onto the other's list unless it is already there. One pass, mirrored both ways, deduped on both sides."
      - "buildLinkIndex and knownIds must touch no DOM, must not read `query`, `sortKey`, `activeTags` or `blockedOnly`, and must not know a highlight exists."
      - "Anchor 4: `function applyData(raw: BoardPayload)`, at its existing `buildDepIndex();` call under the comment about rebuilding the graph where the data changes. Add `buildLinkIndex();` on the next line, inside the same comment's group, so both indexes are rebuilt on every data change and never in renderBoard."
      - "Add the `REL_FOOTER_MAX` constant in this task if it is convenient to place it with the other module constants; task 2.2 is its only consumer. Its value is 3."
      - "Do not add a linkSet, do not touch setChain or paintChain, and do not touch buildCard here. Those belong to tasks 2.2 and 3.1."
    pattern: "src/public/app.ts — module scope at lines 44-66, buildDepIndex at 169-184, and applyData at 1189-1194."
    imports: "None. Everything is module-scope state inside the existing IIFE. Nothing goes on `window` and nothing is persisted."
    compatibility: "Keep the file's existing style: `var` declarations, `function` statements, and `forEach` callbacks rather than arrow functions or `const`/`let`. The plan deliberately keeps a new module file out of scope — the code goes where its state already lives, inside app.ts's IIFE."
    gotcha: "Mirroring is mandatory and is the whole point: WS-16-sg71an names WS-15-o60iyw while WS-15-o60iyw names nothing back. A dedupe on one side only breaks the reciprocal pair WS-1-bacexa / WS-2-bg6ela, which would then show each other twice. A dangling `links` id is dropped silently by design (assumption A2); do NOT extend that filter to the dependency run, which still renders raw `w.depends_on` including dangling ids — that would regress WS-25."
    verify:
      - "npm run build — src/public/tsconfig.json type-checks the browser code, so a wrong type or a missing narrowing fails here."
      - "grep -n 'buildLinkIndex()' src/public/app.ts — must return the declaration and exactly one call site, inside applyData."
      - "grep -c 'var known: Record<string, true> = {};' src/public/app.ts — must return 1, proving the rule was factored out rather than duplicated."
    checklist:
      - "Does buildDepIndex produce byte-identical output to before, now sourcing its known-id map from knownIds()?"
      - "Is every `links` edge recorded in BOTH directions, and never twice in the same direction?"
      - "Are self-edges and unknown ids skipped before either push?"
      - "Do knownIds and buildLinkIndex read no DOM and no view state?"
      - "Is buildLinkIndex called from applyData only, and never from renderBoard?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 2.2 Render both footer runs through one shared builder
    ```yaml
    description: "Add the pure footerRun helper and rewrite buildCard's footer block to emit the existing `.deps` run and a new `.rels` run from one element-builder, dependency first."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Anchor 1: beside the other pure helpers in src/public/app.ts, add `function footerRun(ids: string[]): { shown: string[]; hidden: string[] }`. It splits an id array at REL_FOOTER_MAX and returns the visible slice and the hidden remainder, so one call gives the caller both the run and the `+k` marker. It is pure over an array and knows nothing about kinds, glyphs, colours or the DOM."
      - "Anchor 2: the footer block in `buildCard`, which today appends `.updated` and then, when `w.depends_on` is non-empty, one `.deps` span holding a `⤷ ` text node and one `.dep-link` per id separated by `, ` text nodes."
      - "Factor that id-run construction into one shared element-builder taking the container class, the glyph prefix, the `title` text, and the already-resolved id array. It must emit the same DOM the current code emits: a container span, a glyph text node, `, ` text nodes between ids, and one `span.dep-link` per id carrying `data-dep`, `role=\"link\"` and `tabIndex = 0`."
      - "Dependency run: container class `deps`, glyph `⤷ `, title `Depends on`, built when `w.depends_on` is non-empty, from `w.depends_on` raw — dangling ids included, exactly as today (assumption A2)."
      - "Link run: container class `rels`, glyph `⇄ `, title `Related to`, built when `linkedWith[w.id]` is non-empty, from `linkedWith[w.id]` — the mirrored index, not `w.links`. This is what makes criterion 5 true: a card named by another workstream's `links` shows that id in its own run."
      - "Append the dependency run first and the link run second, always, so position is a cue independent of glyph and colour. The two runs are independent siblings: a card with links and no dependencies gets `.rels` alone."
      - "Cap the LINK run at REL_FOOTER_MAX via footerRun. When footerRun returns a non-empty `hidden`, append one `span.rel-more` with text `+k` and a `title` naming every hidden id, comma-separated. The marker is inert by design: no `role`, no `tabindex`, no listener, so a click on it bubbles to the card and opens the modal, which is where the uncapped list lives (assumption A6)."
      - "Do NOT cap the dependency run. The user confirmed REL_FOOTER_MAX gates the link run only, leaving the dependency run uncapped — see Divergence 1 (resolved). Keep the dependency run's id list exactly what the current code renders, and do not route `w.depends_on` through footerRun."
      - "Add the `title` attribute to the `.deps` container as described above. That is additive and changes no behaviour (assumption A9). Beyond the title, `.deps` keeps its class, its glyph, its `.dep-link` children, its `data-dep` attributes and its comma text nodes."
      - "Do not add a `data-link` attribute, do not add a modifier class to the link elements, and do not touch either delegated `#board` listener. Reusing `.dep-link` and `data-dep` is what makes the WS-25 click and keyboard path regression-free by construction; the kind is carried by the container, which is where the colour rule needs it."
      - "buildCard must read `linkedWith` and never write it."
    pattern: "src/public/app.ts — buildCard's footer block at lines 305-322, plus the new footerRun helper."
    imports: "The existing `el(tag, cls, text)` helper at line 68 builds every new element. Add no new helper beyond footerRun and the shared run-builder."
    compatibility: "Every id must reach the DOM through `textContent` and `dataset`, matching the file's existing rule — no `innerHTML` anywhere in this task. Keep the file's `var` / `function` / `forEach` style."
    gotcha: "A card with neither kind must be pixel-identical to today, so the shared builder must not append an empty container or a stray separator. `linkedWith[w.id]` is undefined for most cards — guard the length read. The `+k` marker must stay inert: giving it a role or a tabindex would break criterion 9, because the click would stop reaching the card."
    verify:
      - "npm run build"
      - "grep -n \"data-link\\|dataset.link\" src/public/app.ts — must return zero lines."
      - "Confirm the two delegated #board listeners are untouched: `git diff -- src/public/app.ts` shows no change inside either `byId('board').addEventListener(...)` block."
      - "npm start, then on this repository's own board: WS-16-sg71an shows `⇄ WS-15-o60iyw` and WS-15-o60iyw shows `⇄ WS-16-sg71an` although its own `links` is empty — the mirroring proof. WS-3-9gbugs shows two link ids it declares none of. WS-1-bacexa and WS-2-bg6ela name each other and must each show the other exactly once, not twice — the dedupe proof."
      - "Click a `⇄` id: the board scrolls to the target and flashes it, and the detail modal stays closed. Tab to a `⇄` id and press Enter: same result."
      - "Hand-edit one workstream.md to carry both a `depends_on` list and a `links` list: its `⤷` run must come first and its `⇄` run second. Hand-edit one to carry five `links` entries: the footer shows three and a `+2` whose tooltip names the other two, and clicking the `+2` opens the modal. Revert both edits afterwards."
    checklist:
      - "Does a card with neither kind render a footer identical to today?"
      - "Is the link run sourced from `linkedWith[w.id]` and never from `w.links`?"
      - "Does the dependency run still render raw `w.depends_on`, uncapped and with dangling ids intact?"
      - "Do the link ids carry `.dep-link` and `data-dep`, with no third attribute and no modifier class?"
      - "Is the `+k` marker free of `role`, `tabindex` and any listener?"
      - "Are both delegated #board listeners byte-identical to before this task?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 2.3 Style the second footer run and let the footer wrap
    ```yaml
    description: "Add a provisional --linked token to the four theme blocks, add .rels to the existing .deps rule, add the .rels .dep-link and .rel-more rules, and add flex-wrap to .card-foot."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Anchor 1: the four theme blocks in src/public/styles.css — `:root` at line 9, the `@media (prefers-color-scheme: dark)` block at line 53, `:root[data-theme=\"dark\"]` at line 93, and `:root[data-theme=\"light\"]` at line 106. Add one `--linked` declaration to each, beside that block's own `--chain` declaration, in that block's own formatting: one declaration per line in the first two blocks, packed lines in the last two."
      - "Use a PROVISIONAL value here — task 4.3 replaces it with the tuned pair. Keep the light value identical between `:root` and `:root[data-theme=\"light\"]`, and the dark value identical between the media block and `:root[data-theme=\"dark\"]`."
      - "Add no `--linked-soft`. The link treatment has no halo, because the halo is the root card's exclusive cue."
      - "Anchor 2: the existing `.card-foot .deps { font-family: var(--font-mono); font-size: 10px; color: var(--ink-faint); }` rule at line 414. Add `.card-foot .rels` as a SECOND SELECTOR on that same rule. One rule, not two."
      - "Anchor 3: after the card block's existing `.card-foot .deps .dep-link` rules, add `.card-foot .rels .dep-link { color: var(--linked); cursor: pointer; }` and `.card-foot .rel-more { color: var(--ink-faint); margin-left: 3px; cursor: pointer; }`."
      - "Anchor 4: the `.card-foot` rule at line 412. Add `flex-wrap: wrap;` to it, and nothing else. The column is 268px wide and the `created … · updated …` span alone is close to the card's usable width at 10px mono, so a second run without wrapping would overflow into .column-body's clipped horizontal axis. It is a no-op whenever the footer already fits, so a one-relationship card looks exactly as it does today."
      - "Do not touch `.card.is-chain`, `.card.is-chain-root`, `.card.is-flash`, the `--chain` pair, or the `.card-foot .deps .dep-link` colour rule."
    pattern: "src/public/styles.css — theme blocks at 9, 53, 93 and 106; .card-foot at 412; the .deps rule at 414; new rules after 422."
    imports: "None. No new file, no new import, no new build step."
    compatibility: "--linked carries both the dashed ring colour (task 3.2) and the footer and modal link-id text colour, so it must clear text contrast against the card background; clearing that automatically clears the ring's lower bar. --chain already does exactly this dual duty at 7.4:1 light and 6.2:1 dark, so the precedent holds."
    gotcha: "There are FOUR declaration sites, not two: the `prefers-color-scheme` media block and the explicit `data-theme` blocks must stay in step, or the toggle and the system default will disagree. Adding `.card-foot .rels` as a second rule rather than a second selector duplicates the font declarations and drifts on the next edit."
    verify:
      - "npm run build"
      - "grep -c -- '--linked:' src/public/styles.css — must return exactly 4."
      - "grep -n '.card-foot .deps, .card-foot .rels' src/public/styles.css — must return exactly one line, proving one shared rule."
      - "npm start: confirm no card's footer overflows its 268px column, that a long footer wraps onto a second line, and that link ids render in the new colour while dependency ids keep the accent colour."
    checklist:
      - "Are there exactly four --linked declarations, one per theme block, each in its own block's formatting?"
      - "Does the light value match between `:root` and `:root[data-theme=\"light\"]`, and the dark value between the media block and `:root[data-theme=\"dark\"]`?"
      - "Is `.rels` a second selector on the existing `.deps` rule rather than a duplicated rule?"
      - "Was `--linked-soft` NOT added?"
      - "Are `.card.is-chain`, `.card.is-chain-root`, `.card.is-flash` and the `--chain` pair unchanged?"
    self_eval:
      passed: false
      failures: []
    ```

- [ ] 3. Phase 3 — the one-hop dashed link highlight

  ```yaml
  description: "Paint the clicked card's direct link neighbours with a dashed ring, with root beating chain beating link, while the transitive solid chain stays exactly as WS-25 built it. Covers acceptance criteria 12 to 17. Depends on task 2 for linkedWith and --linked."
  ```

  - [ ] 3.1 Compute and paint `linkSet`
    ```yaml
    description: "Add linkSet state, widen setChain to compute it with the root and every chain member removed, widen paintChain to toggle is-linked, and seed the class in buildCard."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Anchor 1: the module-scope state block in src/public/app.ts, beside `chainRoot` and `chainSet`. Add `var linkSet: Record<string, true> | null = null;` with a comment recording that it holds the clicked card's DIRECT link neighbours, with the root and every chain member already removed, and is null when nothing is highlighted."
      - "Anchor 2: `function setChain(id: string | null): void`. Widen it to be the only writer of linkSet as well as chainRoot and chainSet. After it computes chainSet, it sets linkSet to the one-hop neighbours of `id` in `linkedWith`, minus `id` itself and minus every member of chainSet. A null `id` clears all three. It must still never call renderBoard."
      - "Resolving precedence in the DATA, not only in CSS, is deliberate (assumption A4): a card never carries two highlight classes at once, the rule reads in one place, and CSS source order stops being load-bearing. Root beats chain beats link."
      - "One hop only, from the clicked card only (assumption A3). Do not reach link neighbours of chain members and do not walk further along `links`. A soft link is explicitly non-transitive, and a second hop on a board this dense would outline most of a column."
      - "Anchor 3: `function paintChain(): void`. Add one `classList.toggle('is-linked', ...)` beside the two existing toggles, reading linkSet the same way the others read chainSet and chainRoot. It stays a class-only pass: it must not walk a graph, must not call renderBoard and must not open the modal."
      - "Anchor 4: buildCard's class seeding, where `cls` gains ` is-chain` and ` is-chain-root`. Seed ` is-linked` the same way, so a sort, search or data-change re-render restores it with no post-render fix-up."
      - "Update the comment on setChain and paintChain to record the widened contract. Do NOT rename setChain, paintChain, chainOf, jumpToDep or the .dep-link class — the smallest diff is the strongest evidence the dependency path is untouched, and the readability cost is taken knowingly (assumption A12). Add one line to jumpToDep's comment saying it now serves both relationship kinds; change none of its code."
      - "Do not touch chainOf. It stays depends_on only, transitive, both directions."
      - "applyData's stale-root prune already re-runs setChain after a poll, so linkSet is recomputed from the rebuilt indexes with no edit there."
    pattern: "src/public/app.ts — module scope at 44-66, setChain at 210-214, paintChain at 218-226, buildCard class seeding at 229-235, jumpToDep's comment at 140-141."
    imports: "None."
    compatibility: "linkSet is `Record<string, true> | null`, matching chainSet, so src/public/tsconfig.json's strict narrowing rules apply identically. Keep the file's `var` / `function` style."
    gotcha: "Subtract chainSet AFTER it is computed, not before, or a card that is both a chain member and a link neighbour will paint dashed instead of solid and break criterion 14. The root must be removed too. A card more than one hop away — WS-3-9gbugs is two link hops from WS-27-wg5q18 through WS-7-c5ispw — must not paint at all."
    verify:
      - "npm run build"
      - "npm start. Dependency regression check FIRST: click WS-9-8d98ve and confirm WS-8-nlelsj, WS-9-8d98ve and WS-11-vtcy55 paint the same solid chain with the same root treatment as before this task, and that no dashed ring appears, because WS-9-8d98ve has no link in either direction."
      - "Link check: click WS-27-wg5q18. It paints as root, WS-5-kxteoh and WS-7-c5ispw paint dashed, and WS-3-9gbugs must not paint at all. Close the modal: the rings remain. Change the sort key, the sort direction and the search text: the rings remain on every card still on the board. Click the column background: they clear."
      - "Edit a source workstream.md so the next poll finds changed data: within five seconds the board re-renders with both ring kinds intact. Revert the edit afterwards."
      - "Precedence check: add a `links` entry to a workstream already inside a dependency chain, then click that chain's root. The overlapping card must paint solid, not dashed, and the root must keep its halo. Revert the edit afterwards."
    checklist:
      - "Is setChain still the only writer of chainRoot and chainSet, and now also the only writer of linkSet?"
      - "Is linkSet computed with the root AND every chain member removed?"
      - "Is chainOf unchanged, and is the transitive dependency closure it returns identical to before?"
      - "Does paintChain still walk the cards once, toggling classes only, with no graph walk and no re-render?"
      - "Is `is-linked` seeded in buildCard so a re-render restores it without a fix-up?"
      - "Were jumpToDep's code, setChain's name and paintChain's name all left unchanged?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 3.2 Add the dashed link ring
    ```yaml
    description: "Add position: relative to the existing .card rule and the .card.is-linked::after pseudo-element ring."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Anchor 1: the existing `.card { ... }` rule in src/public/styles.css at line 355. Add ONE declaration, `position: relative;`, so the ring can be positioned against the card. Change nothing else in that rule."
      - "Anchor 2: after the existing `.card.is-chain-root` and `.card-foot .deps .dep-link` rules in the card block, add the ring: `.card.is-linked::after { content: ''; position: absolute; inset: -3px; border: 2px dashed var(--linked); border-radius: 8px; pointer-events: none; }`."
      - "It MUST be a pseudo-element, not an `outline`. `.card:focus-visible` sets outline in the shared controls rule at line 276, at the same (0,2,0) specificity `.card.is-linked` would carry, and a card rule down in the card block sits later in the source — it would therefore beat the focus ring and hide keyboard focus on any link-highlighted card. Moving the rule above line 276 would put a card rule inside the controls section. The pseudo-element sidesteps the collision for the cost of one declaration."
      - "It must also not be a `border`: the card's 1px border already carries the hover cue at `.card:hover { border-color: var(--line-strong) }`, so a dashed border would cost the card its hover feedback, and a 1px dash reads as noise rather than as a ring."
      - "`pointer-events: none` is required, or the ring would swallow clicks on the card edge."
      - "Do not touch `.card.is-chain`, `.card.is-chain-root` or `.card.is-flash`, and do not add a transition. The ring is a state, not a flash: as a pseudo-element the `.card` transition inside the reduced-motion block at line 511-513 does not reach it, which is the intended behaviour (assumption A10)."
    pattern: "src/public/styles.css — the .card rule at 355-361 and a new rule after 422."
    imports: "Depends on the --linked token added by task 2.3."
    compatibility: "Solid versus dashed is the cue that survives a colour-blind reader; colour and weight alone would be a weak at-a-glance difference on a 268px card. That is why the plan rejected a box-shadow ring distinguished by colour only."
    gotcha: "Without `position: relative` on .card the ring positions against the nearest positioned ancestor and lands somewhere else entirely. `inset: -3px` with `border-radius: 8px` keeps the ring outside the card's own 6px radius without clipping — do not reuse the card's own radius value."
    verify:
      - "npm run build"
      - "grep -n 'is-linked' src/public/styles.css — must return exactly one rule, using ::after and no outline property."
      - "npm start: click a card with link neighbours and Tab to a highlighted card. The dashed ring is visible AND the accent focus ring is still visible on top of it — the collision this rule exists to avoid."
      - "Click the card edge over the ring: the modal opens, proving pointer-events: none."
    checklist:
      - "Is the ring a ::after pseudo-element with no `outline` declaration anywhere?"
      - "Is `position: relative` the only declaration added to the .card rule?"
      - "Does `.card:focus-visible` still show its accent outline on a link-highlighted card?"
      - "Are `.card.is-chain`, `.card.is-chain-root` and `.card.is-flash` unchanged?"
      - "Does the ring carry `pointer-events: none`?"
    self_eval:
      passed: false
      failures: []
    ```

- [ ] 4. Phase 4 — modal relationships block, colour tuning, presentation pass

  ```yaml
  description: "Add the uncapped relationships block to the modal's meta region, replace the provisional --linked value with tuned light and dark values, and walk the presentation cases. Covers acceptance criteria 18 to 21. Depends on task 3."
  ```

  - [ ] 4.1 Add the modal relationships markup
    ```yaml
    description: "Add the #ws-modal-rels block to board.html, inside #ws-modal-meta, between the tags row and the dates row."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Anchor: the `<div class=\"ws-modal-meta\" id=\"ws-modal-meta\">` region in src/public/board.html, between the `<div class=\"card-tags\" id=\"ws-modal-tags\" hidden></div>` row and the `<div class=\"ws-modal-dates\" id=\"ws-modal-dates\"></div>` row."
      - "Insert a `div#ws-modal-rels.ws-modal-rels`, `hidden`, holding exactly TWO rows in this order: `div#ws-modal-rels-deps.ws-modal-rel-row` (hidden) with a `span.ws-modal-rel-label` reading `Depends on` and an empty `span#ws-modal-rels-deps-ids.ws-modal-rel-ids`; then `div#ws-modal-rels-linked.ws-modal-rel-row` (hidden) with a `span.ws-modal-rel-label` reading `Related` and an empty `span#ws-modal-rels-linked-ids.ws-modal-rel-ids`."
      - "Exactly two rows. Do NOT add a third 'Depended on by' reverse-dependency row — reverse dependencies are out of scope, as WS-25 decided and this plan keeps."
      - "The ids are plain text and stay plain text: no `role`, no `tabindex`, no anchor, no click behaviour, matching the tags and dates already in that region. Making them jump targets is out of scope."
      - "The words `Depends on` and `Related` are what satisfy the no-legend constraint, so the glyphs are never the only place the two kinds are named. Do not replace them with the glyphs."
      - "Change nothing else in board.html — not the head, not the modal head, not the tabs, not the panels, not the script tag."
    pattern: "src/public/board.html — the #ws-modal-meta region at lines 115-125 only."
    imports: "None."
    compatibility: "The block sits above the tabs, inside the meta region, so it is covered by the existing `#ws-modal-meta { max-height: 40vh; overflow-y: auto; }` cap that WS-65 built — a taller meta region already scrolls rather than clipping."
    gotcha: "Both rows and the wrapper start `hidden`; task 4.2 is what reveals them. Ship the markup without the renderer and the modal simply shows nothing new, which is the safe intermediate state. Keep the ids exactly as named — task 4.2 looks them up by id."
    verify:
      - "npm run build"
      - "grep -c 'ws-modal-rel' src/public/board.html — must return 7, one per new element and label class."
      - "grep -n 'Depended on by' src/public/board.html — must return zero lines."
      - "npm start and open any card: the modal renders exactly as before, because every new element is still hidden."
    checklist:
      - "Does the block sit between the tags row and the dates row, inside #ws-modal-meta?"
      - "Are there exactly two rows, 'Depends on' first and 'Related' second?"
      - "Do the wrapper and both rows carry the `hidden` attribute in the markup?"
      - "Are the id containers empty, with no `role`, no `tabindex` and no anchor?"
      - "Is the rest of board.html byte-identical?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 4.2 Fill the modal relationships block in `renderModalMeta`
    ```yaml
    description: "Extend renderModalMeta with one show/hide block for the two relationship rows, including its !w early-return branch."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Anchor: `function renderModalMeta(w: PraxisWorkstream | undefined)` in src/public/app.ts. Look up the wrapper and the two id containers with the existing `byId` helper, beside the other element lookups at the top of the function."
      - "Follow the same show/hide shape the tags block already uses: clear both id containers, append one `span.ws-modal-rel-id` per id built with `el('span', 'ws-modal-rel-id', id)` so the text goes through `textContent`, hide a row whose list is empty, and hide the wrapper when both rows are hidden."
      - "Sources, deliberately different per row and matching the footer: the 'Depends on' row reads `w.depends_on`, raw and UNCAPPED, dangling ids included. The 'Related' row reads `linkedWith[w.id]`, mirrored and UNCAPPED, known ids only. Neither row uses footerRun — the modal is where the complete list survives the footer cap."
      - "Extend the `!w` early-return branch too: it must clear both id containers and hide all three elements, matching how it already clears and hides the tags, blocked and description elements."
      - "renderModalMeta reads `linkedWith` the same way it already reads `sevMix`. It must not write the index and must not trigger a repaint."
      - "Do not make the ids clickable and do not add a third row."
    pattern: "src/public/app.ts — renderModalMeta at lines 942-999, including its !w branch at 951-963."
    imports: "The existing `el` and `byId` helpers. Add nothing."
    compatibility: "Use `textContent` via `el`, never `innerHTML`, matching the file's existing rule. Note the function already clears `tagsEl.innerHTML = ''` before the !w branch — clearing the two new containers the same way is consistent, but every id itself must still be appended as a text node."
    gotcha: "The !w branch returns early, so a clear placed after it will not run on that path and a stale list from the previous card will survive into the next open. `linkedWith[w.id]` is undefined for most cards — guard the length read."
    verify:
      - "npm run build"
      - "npm start. Open WS-13-6ul85v: the meta region lists 'Depends on WS-5-kxteoh, WS-9-8d98ve' above the tabs and shows no 'Related' row. Open WS-15-o60iyw: it lists 'Related WS-16-sg71an' and shows no 'Depends on' row. Open WS-24-u88wfx, which has neither: no block and no stray label."
      - "Open the card hand-edited in task 2.2 to five links: the modal lists all five while the footer still shows three and a `+2`. Open the card hand-edited to both kinds: both rows appear, 'Depends on' above 'Related'."
      - "grep -n 'innerHTML' src/public/app.ts — no new occurrence inside renderModalMeta beyond the existing tags clear."
    checklist:
      - "Does the 'Depends on' row render `w.depends_on` raw, uncapped, with dangling ids included?"
      - "Does the 'Related' row render `linkedWith[w.id]`, mirrored and uncapped?"
      - "Does the !w branch clear both containers and hide all three elements?"
      - "Is the wrapper hidden whenever both rows are empty, leaving no empty label?"
      - "Does every id reach the DOM through textContent, with no innerHTML and no interactivity?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 4.3 Style the modal block and tune the final `--linked` values
    ```yaml
    description: "Add the modal relationship rules near the meta styles, and replace the provisional --linked value with a blue-indigo pair chosen against the light and dark palettes side by side."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Anchor 1: the modal meta rules in src/public/styles.css near the `#ws-modal-meta` cap and the `.ws-modal-dates` rule. Add rules for `.ws-modal-rels`, `.ws-modal-rel-row`, `.ws-modal-rel-label` and `.ws-modal-rel-ids`, plus `.ws-modal-rel-id` for each id chip. Match the surrounding meta styles: `var(--font-mono)`, a small size in line with `.ws-modal-dates`' 10px, `var(--ink-faint)` for the label, and `var(--linked)` for a 'Related' id only where it reinforces the kind."
      - "Anchor 2: the four theme blocks at lines 9, 53, 93 and 106. Replace the provisional `--linked` value from task 2.3 with the tuned pair, keeping `:root` identical to `:root[data-theme=\"light\"]` and the `prefers-color-scheme: dark` block identical to `:root[data-theme=\"dark\"]`."
      - "Pick a BLUE-INDIGO, separated from `--st-ready` by chroma and lightness rather than by hue. The free room in the palette is narrow: violet is `--chain`, teal is `--accent`, blue is `--st-ready`, amber is `--st-in-progress`, rose is `--st-blocked`, green is `--st-done`. Pick both hex values here, with the two themes side by side, exactly as WS-25 did for `--chain`."
      - "The value must not be `--chain`, not `--accent`, and not any `--st-*` or `--sev-*` value, and must not be confusable with any of them, with the focus ring, or with the chain ring."
      - "It carries both the dashed ring colour and the link-id text colour, so it must clear text contrast against the card background; clearing that clears the ring's lower bar automatically. `--chain` sets the precedent at 7.4:1 light and 6.2:1 dark."
      - "Add no `--linked-soft` and do not touch the `--chain` pair."
    pattern: "src/public/styles.css — the four theme blocks at 9, 53, 93 and 106, and new modal rules near line 785."
    imports: "None."
    compatibility: "The block must scroll with the description inside the existing 40vh `#ws-modal-meta` cap rather than clipping, and must not disturb `.ws-modal-meta .card-tags { margin-bottom: 0; }` or the dates rule."
    gotcha: "Four declaration sites again, not two, and the light/dark pairs must match across the media block and the data-theme block or the toggle and the system default will disagree. A colour chosen against one theme only will fail contrast in the other — hold both open while picking."
    verify:
      - "npm run build"
      - "grep -c -- '--linked:' src/public/styles.css — must still return exactly 4, with no provisional value left."
      - "npm start: check the relationships block and both ring kinds in all four theme combinations — the prefers-color-scheme default light and dark, and the explicit data-theme light and dark overrides."
      - "Shrink the window until #ws-modal-meta hits its 40vh cap: the relationships block scrolls with the description rather than clipping."
    checklist:
      - "Is `--linked` a blue-indigo that is not --chain, not --accent and not any --st-* or --sev-* value?"
      - "Do the light values match between `:root` and `:root[data-theme=\"light\"]`, and the dark values between the media block and `:root[data-theme=\"dark\"]`?"
      - "Does the link colour clear text contrast against the card background in both themes?"
      - "Does the meta region still scroll rather than clip at its 40vh cap?"
      - "Was `--linked-soft` still not added, and the --chain pair left unchanged?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 4.4 End-of-feature presentation and regression walk
    ```yaml
    description: "Walk the plan's repeat-once matrix across all four theme combinations, the dropped column, reduced motion, and the keyboard path, fixing only presentation defects the walk finds."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "This is the plan's own end-of-Phase-4 verification pass. Run it after tasks 4.1 to 4.3 have landed. Change code only where the walk finds a defect, and only in the six files this task list already touches."
      - "Walk a card with dependencies only, links only, both, and neither."
      - "Walk a non-reciprocal link pair from BOTH ends — WS-16-sg71an and WS-15-o60iyw."
      - "Walk a reciprocal link pair and check for a duplicated id in the run — WS-1-bacexa and WS-2-bg6ela."
      - "Walk a `links` entry naming a workstream that does not exist, and one naming the card itself. Both are dropped silently from the mirrored index by design; the dependency run's dangling-id behaviour must be unchanged."
      - "Walk the hand-edited card carrying more than three relationships of each kind, and a card whose `depends_on` and `links` name the same id."
      - "Walk a link target in the same column and in a different column, a chain that overlaps a link neighbour, and a root that is also a link neighbour."
      - "Walk the footer-wrap case, the dropped column, and reduced motion on and off."
      - "Walk the keyboard path: Tab to a `⇄` id and press Enter; Tab to a card, press Enter, then Tab through the modal meta."
      - "Revert every hand-edited workstream.md when the walk is finished, and confirm `git status` shows no change under flowcharge/."
    pattern: "src/public/app.ts, src/public/styles.css and src/public/board.html — presentation fixes only. No new behaviour, no new abstraction, no new control."
    imports: "None."
    compatibility: "The repository has no browser test harness and this task must not add one; adding one is a separate decision. Verification here is the plan's manual matrix plus the project's own build."
    gotcha: "Do not fold in the pre-existing out-of-scope defects the plan reports and does not action: jumpToDep's silent no-op on a target absent from the DOM, its string-concatenated selector, and WS-67-o2byn9's dependency on a workstream folder that does not exist. Report them if they surface; do not fix them here."
    verify:
      - "npm run build"
      - "node --test dist/lib/extract.test.js"
      - "npm start, then walk every case in `implement` above and record any defect found."
      - "git status --short flowcharge/ — must return zero lines, proving every hand-edited fixture was reverted."
    checklist:
      - "Did every case in the walk behave as its acceptance criterion states?"
      - "Is the dashed ring readable and unconfusable in all four theme combinations?"
      - "Does the keyboard path reach a `⇄` id, jump from it, and leave the modal closed?"
      - "Were the three reported out-of-scope defects left unfixed?"
      - "Is flowcharge/ free of leftover hand-edited fixtures?"
    self_eval:
      passed: false
      failures: []
    ```

## Divergences

1. **The footer cap on the dependency run — resolved: option (b), dependency run stays uncapped.**
   The plan's own Open question 4 offered option (a), `REL_FOOTER_MAX = 3` gating both relationship
   kinds so the existing `depends_on` footer run would be capped too, against option (b), capping the
   new `links` run only and leaving `depends_on` exactly as it renders today. This was left open at
   authoring time because capping a pre-existing, already-shipped run changes established rendering
   behaviour with no reader opt-out. The user has since confirmed option (b). Task 2.2 caps the new
   `links` run only and leaves the dependency run rendering `w.depends_on` raw and uncapped exactly as
   `src/public/app.ts:307-321` does at `b9fe85b` — this is now the final, confirmed behaviour, not a
   placeholder. Acceptance criterion 8 is satisfied by this asymmetric-by-design outcome for both
   runs. No further decision or task-content change is needed here.

Every file the plan cites was read at `b9fe85b` and matched the plan's assumptions, including the
line anchors it names: `src/lib/extract.ts:189,192`, `src/types/praxis-data.d.ts:23`,
`src/lib/extract.test.ts:64,111`, `src/public/app.ts:44-66,142-164,169-184,191-226,229-235,305-322,942-999,1057-1084,1189-1205`,
`src/public/styles.css:9,53,93,106,276,355-361,412,414,417-422,511-513,781-784` and
`src/public/board.html:115-125`.
