---
id: TL-11-5krz7r
type: tasklist
workstream: WS-10-4lwv20
slug: board-sort-by-date
title: "Add Created and Updated as two more board sort keys"
status: done
created: 2026-08-06
updated: 2026-08-06
depends_on: [PLN-10-rk09u2]
links: []
mode: spec
base_commit: 01d386b
---

# PRX Tasks

## Add Created and Updated as two more board sort keys

Implements PLN-10. Adds `data-key="created"` and `data-key="updated"` pills to
`#sort-key-seg` in `src/public/board.html`, two new `else if` branches in
`renderBoard()`'s comparator in `src/public/app.ts` (plain `localeCompare` on the
raw `YYYY-MM-DD` string, "Asc" = literal ascending, matching `id`/`name`'s
convention rather than `severity`'s reversed one, no `Date` parsing, no synthetic
tie-break), and extends `buildCard()`'s footer to show `created` alongside the
already-shown `updated` so the user can see the value they're sorting by. Client-
only, one stage (matches PLN-10's own staging — small enough not to split further),
three tasks in dependency order: markup, comparator, card display. No wire-shape,
server, or CSS changes; `id`/`name`/`severity` sorting is unmodified.

- [x] 1. Markup: add the Created/Updated pills
  ```yaml
  description: "Add data-key=\"created\" and data-key=\"updated\" buttons to #sort-key-seg in src/public/board.html, after the existing Severity button."
  issues: []
  implement:
    - "File: src/public/board.html. Anchor: the `#sort-key-seg` div (lines 33-36), whose three existing buttons (`id`, `name`, `severity`) are unmodified. Append two more `<button data-key=\"...\">` lines after the Severity button, in this order: `created` labelled \"Created\", then `updated` labelled \"Updated\"."
    - "SEARCH block below, copied verbatim from board.html as read this session."
    - |
      ```html
      <<<<<<< SEARCH
          <div class="seg" id="sort-key-seg">
            <button data-key="id" class="active">Artefact ID</button>
            <button data-key="name">Name</button>
            <button data-key="severity">Severity</button>
          </div>
      =======
          <div class="seg" id="sort-key-seg">
            <button data-key="id" class="active">Artefact ID</button>
            <button data-key="name">Name</button>
            <button data-key="severity">Severity</button>
            <button data-key="created">Created</button>
            <button data-key="updated">Updated</button>
          </div>
      >>>>>>> REPLACE
      ```
  pattern: "src/public/board.html"
  imports: "None."
  compatibility: "The click handler at app.ts:189-195 already reads btn.dataset.key generically — no handler change needed. No CSS change: .seg (styles.css:238) has no fixed width or child-count assumption."
  gotcha: "Do not touch the three existing buttons or the click handler. Indentation in the SEARCH block must match the file exactly (it is nested inside .group, two levels of indent)."
  verify:
    - "npx tsc -p tsconfig.json --noEmit"
    - "npx tsc -p src/public/tsconfig.json --noEmit"
    - "npm run build"
    - "Reload board.html in a browser and confirm five pills render under Sort, in order: Artefact ID, Name, Severity, Created, Updated, all clickable (reordering not expected until task 2 lands)."
  checklist:
    - "Do the three existing buttons (id/name/severity) remain byte-for-byte unchanged, including the `class=\"active\"` on the id button?"
    - "Are the two new buttons appended after Severity, in the order Created then Updated?"
    - "Does data-key on the new buttons read exactly `created` and `updated` (lowercase, matching PraxisWorkstream field names)?"
    - "Does the click handler require no edit for the new buttons to work?"
  self_eval:
    passed: true
    failures: []
    note: "Also confirmed live in a real browser: five pills render (Artefact ID, Name, Severity, Created, Updated), all clickable."
  ```

- [x] 2. Logic: comparator branches for created/updated
  ```yaml
  description: "Add two else-if branches to renderBoard()'s sort comparator in src/public/app.ts for sortKey === 'created' and sortKey === 'updated', ahead of the existing severity catch-all."
  issues: []
  implement:
    - "File: src/public/app.ts. Anchor: the `items.sort(function (a, b) {...})` comparator inside `renderBoard()` (lines 160-166). Insert two new `else if` branches after the `name` branch and before the `severity` else, each doing a plain `localeCompare` on the raw string field — no `Date` construction, no reformatting, same idiom as the `name` branch."
    - "SEARCH block below, copied verbatim from app.ts as read this session."
    - |
      ```ts
      <<<<<<< SEARCH
            items.sort(function (a, b) {
              var cmp;
              if (sortKey === 'id') cmp = wsIdNum(a.id) - wsIdNum(b.id);
              else if (sortKey === 'name') cmp = a.title.localeCompare(b.title);
              else cmp = severityCmp(sevMix![a.id], sevMix![b.id]);
              return sortDir === 'asc' ? cmp : -cmp;
            });
      =======
            items.sort(function (a, b) {
              var cmp;
              if (sortKey === 'id') cmp = wsIdNum(a.id) - wsIdNum(b.id);
              else if (sortKey === 'name') cmp = a.title.localeCompare(b.title);
              else if (sortKey === 'created') cmp = a.created.localeCompare(b.created);
              else if (sortKey === 'updated') cmp = a.updated.localeCompare(b.updated);
              else cmp = severityCmp(sevMix![a.id], sevMix![b.id]);
              return sortDir === 'asc' ? cmp : -cmp;
            });
      >>>>>>> REPLACE
      ```
  pattern: "src/public/app.ts"
  imports: "None. a.created/a.updated/b.created/b.updated are already typed string on PraxisWorkstream (src/types/praxis-data.d.ts:21-22)."
  compatibility: "sortDir === 'asc' ? cmp : -cmp' trailer is untouched, so 'Asc' means literal ascending (earliest first) for created/updated, matching id/name's convention, not severity's reversed operand trick. No secondary tie-break key is added — Array.prototype.sort stability (es2020 target, src/public/tsconfig.json) is relied on, same precedent as id/name/severity."
  gotcha: "Use localeCompare, not < / >, to keep one string-comparison idiom for every string-valued key in this function, matching the name branch's own style. Do not touch severity's role as the else catch-all. Do not add Date parsing — the plan explicitly rejects it (timezone risk, no benefit for zero-padded YYYY-MM-DD)."
  verify:
    - "npx tsc -p tsconfig.json --noEmit"
    - "npx tsc -p src/public/tsconfig.json --noEmit"
    - "npm run build"
    - "grep -c 'import\\|export' dist/public/app.js — must return 0 (dist/public/app.js remains a classic script, module: \"none\")"
    - "In the browser, click Created + Asc/Desc and Updated + Asc/Desc and confirm each status column reorders by the visible date; click id/name/severity again and confirm their ordering is unchanged from before this task."
  checklist:
    - "Are the two new branches inserted after `name` and before the `severity` else, preserving severity as the catch-all?"
    - "Do both new branches use localeCompare on the raw string field with no Date object construction?"
    - "Is the shared `sortDir === 'asc' ? cmp : -cmp` trailer unchanged and applied to the new branches too?"
    - "Does `npm run build` complete with zero errors and does dist/public/app.js contain no import/export?"
  self_eval:
    passed: true
    failures: []
    note: "Also confirmed live in a real browser: Created+Asc grouped all 2026-08-04-created workstreams before all 2026-08-06-created ones (earliest first); Desc inverted with stable ties preserved; Updated+Asc correctly relocated WS-3 (created 08-04, updated 08-06) out of the created-sort's early cluster into the updated-sort's later cluster, proving the two keys read genuinely independent fields; Artefact ID sort afterward still produced correct numeric order, confirming no regression."
  ```

- [x] 3. Card display: show created in the footer
  ```yaml
  description: "Extend buildCard()'s footer line in src/public/app.ts to render both created and updated, reusing the existing .updated span."
  issues: []
  implement:
    - "File: src/public/app.ts. Anchor: the footer line inside `buildCard()` (line 129), `foot.appendChild(el('span', 'updated', 'updated ' + fmtDate(w.updated)));`. Change its text content to `'created ' + fmtDate(w.created) + ' · updated ' + fmtDate(w.updated)`, keeping the same element type, span class ('updated'), and DOM position — no new element, no CSS change."
    - "SEARCH block below, copied verbatim from app.ts as read this session."
    - |
      ```ts
      <<<<<<< SEARCH
          foot.appendChild(el('span', 'updated', 'updated ' + fmtDate(w.updated)));
      =======
          foot.appendChild(el('span', 'updated', 'created ' + fmtDate(w.created) + ' · updated ' + fmtDate(w.updated)));
      >>>>>>> REPLACE
      ```
  pattern: "src/public/app.ts"
  imports: "fmtDate() (app.ts:26), unchanged — a missing value still renders as '—'."
  compatibility: "Same DOM node, same CSS class (.card-foot .updated, styles.css:354) — zero stylesheet change. Runs for every card regardless of the active sort key; buildCard() does not read sortKey, keeping its existing statelessness with respect to sort state. The top-right `upd` element (app.ts:90-93, card-top) is left as-is per the plan — do not touch it."
  gotcha: "Do not add a third flex child to .card-foot (would change justify-content: space-between spacing when `deps` is also present) — extend the existing span's text only, per the plan's rejected-alternatives analysis."
  verify:
    - "npx tsc -p tsconfig.json --noEmit"
    - "npx tsc -p src/public/tsconfig.json --noEmit"
    - "npm run build"
    - "In the browser, confirm every card's footer now reads 'created <date> · updated <date>' regardless of which sort pill is active, that id/name/severity sorting remains unchanged, and that two workstreams sharing the same created (or updated) date keep a stable relative order across a couple of re-renders (e.g. toggling the search box on/off without changing the underlying data)."
  checklist:
    - "Does the footer span keep the same element, class ('updated'), and position in .card-foot?"
    - "Does the new text read 'created <date> · updated <date>' using fmtDate() for both fields?"
    - "Is the display identical regardless of the active sortKey (no conditional on sortKey introduced)?"
    - "Is .card-foot's child count unchanged (still at most two: this span and deps)?"
  self_eval:
    passed: true
    failures: []
    note: "Also confirmed live in a real browser: every card's footer reads 'created <date> · updated <date>', e.g. WS-9 shows 'created 2026-08-06 · updated 2026-08-06'; identical text regardless of the active sort key."
  ```
</content>
