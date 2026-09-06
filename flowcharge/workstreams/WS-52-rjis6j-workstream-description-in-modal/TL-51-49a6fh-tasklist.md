---
id: TL-51-49a6fh
type: tasklist
workstream: WS-52-rjis6j
slug: workstream-description-in-modal
title: "Show the workstream description field in the detail modal"
status: done
created: 2026-08-21
updated: 2026-08-21
author: Anthony Koukoullis
depends_on: [PLN-42-oldpkh]
links: []
mode: spec
base_commit: ab29357
---

# PRX Tasks

## Workstream description in the detail modal

Praxis workstream records carry an optional `description` frontmatter key. This
dashboard ignores it today. This work reads the value during extraction, carries
it on the `PraxisWorkstream` payload type, and paints it at the top of the
workstream detail modal's meta block, above the tags row and the dates line.

The value comes from the board's already-loaded `PraxisWorkstream` array, not
from the per-workstream detail fetch. `renderModalMeta` runs synchronously at the
top of `openModal`, so the description paints the instant the modal opens. There
is no loading placeholder and no window in which the previous workstream's
description is still on screen.

Five files change: `src/types/praxis-data.d.ts`, `src/lib/extract.ts`,
`src/public/board.html`, `src/public/styles.css`, and `src/public/app.ts`. No new
dependency. The board card, `matches()`, `src/lib/detail.ts`, `src/server.ts`,
and `electron/ipc-handlers.cts` stay untouched.

Phase 1 is verifiable on its own through the HTTP payload with no UI change, so a
stop between the two phases still leaves the app working.

- [x] 1. Phase 1 — the field reaches the browser

  ```yaml
  description: "Add the optional description key to the payload type and read it during extraction, so it rides the GET /api/projects/<id>/data response."
  ```

  - [x] 1.1 Add `description?: string` to the `PraxisWorkstream` interface
    ```yaml
    description: "Declare the new optional key on the PraxisWorkstream ambient interface in src/types/praxis-data.d.ts."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        src/types/praxis-data.d.ts
        <<<<<<< SEARCH
          archived: boolean;
          artefacts: PraxisArtefact[];
        }
        =======
          archived: boolean;
          artefacts: PraxisArtefact[];
          description?: string;
        }
        >>>>>>> REPLACE
    pattern: "src/types/praxis-data.d.ts — the PraxisWorkstream interface only. No other interface in the file changes."
    imports: "None. This file is an ambient global declaration and must stay import-free and export-free — a top-level import or export turns it into a module and every interface stops being global."
    compatibility: "Optional, not nullable: `description?: string`, never `description: string | null` and never a required key. JSON.stringify drops an undefined key, which is what keeps the payload byte-identical for records with no description. Every existing producer and consumer of PraxisWorkstream must still typecheck with no edit."
    gotcha: "Writing the key as required breaks src/lib/extract.ts, the scripts, and the Electron proxy at compile time. Writing it as `string | null` forces a null into the JSON payload and breaks acceptance criterion 9. The file is shared by three tsconfig projects, so a mistake here surfaces in all three compiles at once."
    verify:
      - "Run `npm run build` at the project root. All three tsc passes compile clean."
      - "Run `grep -n 'description?: string' src/types/praxis-data.d.ts` and confirm exactly one match, inside the PraxisWorkstream interface."
      - "Run `grep -cE '^(import|export) ' src/types/praxis-data.d.ts` and confirm it returns 0, so the file is still an ambient global declaration."
    checklist:
      - "Is the new key declared exactly as `description?: string;` — optional, not nullable, not required?"
      - "Is PraxisWorkstream the only interface in the file that changed?"
      - "Does the file still contain no top-level import and no top-level export?"
      - "Does `npm run build` compile clean across all three tsconfig projects?"
      - "Did no other file change in this task?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.2 Read the `description` key into the workstream object in `extract.ts`
    ```yaml
    description: "Add a typeof-guarded description key to the workstream out.push object literal in src/lib/extract.ts, so the value reaches the payload."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        src/lib/extract.ts
        <<<<<<< SEARCH
              body: body.split('\n').filter(Boolean).slice(0, 3).join(' '),
              archived,
              artefacts,
            });
        =======
              body: body.split('\n').filter(Boolean).slice(0, 3).join(' '),
              archived,
              artefacts,
              description: typeof wsFm.description === 'string' ? wsFm.description : undefined,
            });
        >>>>>>> REPLACE
      - "Leave parseFrontmatter untouched. Its line regex /^([a-zA-Z_]+):\\s*(.*)$/ already matches a description key, and its val.replace(/^\"(.*)\"$/, '$1') already strips the surrounding double quotes."
      - "Do not trim, truncate, sanitise, validate, or escape the value here. Extraction reads a frontmatter key and knows nothing about where the value is displayed."
    pattern: "src/lib/extract.ts — the workstream out.push({...}) object literal only. parseFrontmatter, stripFrontmatter, fmStr, and the artefact walk stay exactly as they are."
    imports: "None. No new module, no new dependency."
    compatibility: "Use the inline `typeof` guard, not the existing fmStr helper. fmStr is documented at src/lib/extract.ts:46 as asserting rather than coercing — it would type an absent description as string and put undefined behind a type that promises a string, a lie every consumer inherits. The guard also handles the one odd input the parser can produce: an unquoted value that both starts with `[` and ends with `]` is parsed into an array, and the guard turns that into undefined, which is the correct graceful outcome."
    gotcha: "parseFrontmatter is single-line only, so a multi-line or folded YAML value is not supported and is not planned for (assumption A2). Neither this dashboard nor upstream Praxis unescapes \\\" sequences inside a quoted scalar, and this task deliberately keeps that behaviour (assumption A4). No transport change is needed: extractPraxisData returns the workstream objects whole, src/server.ts spreads the payload with no per-field mapping, and the Electron proxy passes the same object through."
    verify:
      - "Run `npm run build` at the project root. It compiles clean."
      - "Add the line `description: \"Test description with <angle> & \\\"quotes\\\".\"` to one workstream record's frontmatter in a local flowcharge/ tree, directly under its title line. This is a temporary local edit, reverted in task 2.3."
      - "Start the server with `npm start` and request `GET /api/projects/<id>/data`. Confirm the edited workstream object carries \"description\" with that exact text."
      - "Count the occurrences of the string \"description\" in that same response body. It must be exactly one — every other workstream object carries no description key at all."
      - "Run `git diff --name-only` and confirm it lists neither src/lib/detail.ts, nor src/server.ts, nor electron/ipc-handlers.cts."
    checklist:
      - "Does a workstream record with a description produce that exact text on its payload object?"
      - "Does a workstream record with no description produce no `description` key at all in the JSON, rather than a null or an empty string?"
      - "Was the inline typeof guard used, and fmStr left out of the new line?"
      - "Are parseFrontmatter, stripFrontmatter, and fmStr byte-for-byte unchanged?"
      - "Are src/lib/detail.ts, src/server.ts, and electron/ipc-handlers.cts all unchanged?"
      - "Does `npm run build` compile clean?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Phase 2 — the modal shows it

  ```yaml
  description: "Add the description element to the modal markup, style it, and write it from renderModalMeta. Depends on Phase 1."
  ```

  - [x] 2.1 Add the description element to the modal markup
    ```yaml
    description: "Add a hidden paragraph as the first child of .ws-modal-meta in src/public/board.html."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        src/public/board.html
        <<<<<<< SEARCH
            <div class="ws-modal-meta" id="ws-modal-meta">
              <div class="card-tags" id="ws-modal-tags" hidden></div>
        =======
            <div class="ws-modal-meta" id="ws-modal-meta">
              <p id="ws-modal-description" class="ws-modal-description" hidden></p>
              <div class="card-tags" id="ws-modal-tags" hidden></div>
        >>>>>>> REPLACE
      - "Leave the .ws-modal-head block above it untouched, so the severity dot, workstream id, title, and status keep their current order and position."
    pattern: "src/public/board.html — the .ws-modal-meta block only. The head block, the tabs block, and the body block stay as they are."
    imports: "None."
    compatibility: "The element must be the FIRST child of .ws-modal-meta, above #ws-modal-tags and #ws-modal-dates. It ships with the `hidden` attribute already set, so a record with no description shows nothing on the very first paint, before any script runs. It is written only by renderModalMeta; nothing else reads or writes it."
    gotcha: "The hidden attribute is load-bearing, not cosmetic. .ws-modal-meta is a flex column with `gap: 6px`, so a present-but-empty child would still add a 6px gap and break acceptance criterion 3. Placing the paragraph inside .ws-modal-head instead would push the id, title, and status below free text and sit beside the close button — rejected by the plan."
    verify:
      - "Run `npm run build`, which runs tools/copy-assets.mjs and republishes board.html."
      - "Run `grep -n 'ws-modal-description' src/public/board.html` and confirm exactly one match, on a line above the #ws-modal-tags line."
      - "Run `grep -n 'ws-modal-description' dist/public/board.html` and confirm the built copy carries it too."
    checklist:
      - "Is the new paragraph the first child of .ws-modal-meta, above the tags row and the dates line?"
      - "Does it carry the id `ws-modal-description`, the class `ws-modal-description`, and the `hidden` attribute in the markup as shipped?"
      - "Is the .ws-modal-head block, and the order of the severity dot, id, title, and status inside it, unchanged?"
      - "Is board.html the only file changed by this task?"
      - "Does `npm run build` complete and copy the updated board.html into dist/public/?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 2.2 Style the description as plain body text
    ```yaml
    description: "Add a .ws-modal-description rule to src/public/styles.css beside the existing .ws-modal-meta rules."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/public/styles.css and find the `.ws-modal-meta` rule block. Its two follower rules are `.ws-modal-meta .card-tags` and `.ws-modal-dates`."
      - "Add one new `.ws-modal-description` rule immediately after the `.ws-modal-dates` rule, keeping the file's existing single-line and multi-line rule formatting conventions."
      - "The rule sets `margin: 0` to kill the browser's default paragraph margin, a body font size, a soft ink colour consistent with the surrounding meta block, and `overflow-wrap: anywhere` — copy that last declaration's intent from the existing `.ws-modal-title` rule, which already uses it."
      - "Illustrative only, not literal — derive the exact values from the neighbouring rules and the file's own custom properties: `.ws-modal-description { margin: 0; font-size: 12.5px; color: var(--ink-soft); overflow-wrap: anywhere; }`"
      - "Add nothing beyond that: no italic, no extra weight, no accent colour, no icon, no border, and no background. The description renders as ordinary body text and must not be visually distinguished from the dates line."
      - "Do not add a `display` declaration of any kind, and do not touch the global `[hidden] { display: none !important; }` rule."
    pattern: "src/public/styles.css — one new rule next to the existing .ws-modal-meta rules. No existing rule is edited."
    imports: "None. Use the stylesheet's existing custom properties (--ink, --ink-soft, --ink-faint) rather than a literal colour."
    compatibility: "The colour must read as body text, not as metadata: --ink-faint is already the dates line's faint treatment, so the description should sit above it in contrast. The global `[hidden] { display: none !important; }` rule carries the !important that makes the attribute win over any later class rule — the new rule must not reintroduce a display declaration that competes with it."
    gotcha: "A `p` element carries a browser default margin, which would add vertical space to the flex column on top of its 6px gap; `margin: 0` is what stops that. Omitting `overflow-wrap: anywhere` lets a single long unbroken token force horizontal overflow inside the modal and breaks acceptance criterion 8. styles.css is copied into dist/ by tools/copy-assets.mjs during `npm run build`, so an unbuilt change will not appear in the browser."
    verify:
      - "Run `npm run build` so copy-assets.mjs republishes styles.css."
      - "Run `grep -n 'ws-modal-description' src/public/styles.css` and confirm exactly one rule, positioned near the .ws-modal-meta rules."
      - "Run `grep -n 'overflow-wrap' src/public/styles.css` and confirm the new rule is among the matches."
      - "Run `git diff -- src/public/styles.css` and confirm the diff is purely additive — no existing rule was modified or removed."
    checklist:
      - "Does the new rule set margin: 0, a body font size, a soft ink colour, and overflow-wrap: anywhere?"
      - "Does it sit beside the existing .ws-modal-meta rules rather than elsewhere in the file?"
      - "Does it use the stylesheet's existing custom properties rather than a hard-coded colour?"
      - "Is the rule free of italic, extra weight, accent colour, icon, border, and background, so the description reads as plain body text?"
      - "Does the rule add no `display` declaration, leaving the global [hidden] rule authoritative?"
      - "Is the diff on styles.css purely additive?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 2.3 Write and hide the description from `renderModalMeta`
    ```yaml
    description: "Extend renderModalMeta in src/public/app.ts to paint the description via textContent and to hide it when absent, empty, or whitespace-only."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/public/app.ts and find the `renderModalMeta(w: PraxisWorkstream | undefined)` function. It already owns the .ws-modal-meta block: it writes the severity dot, the tags row, and the dates line, and it already handles the `w === undefined` case by hiding everything."
      - "Follow the exact shape the existing tags row already uses. Fetch the new element with the existing byId helper, alongside the tagsEl and datesEl lookups at the top of the function, and match the file's surrounding declaration style."
      - "In the `if (!w)` early-return branch, clear the element's textContent and set its hidden property to true, beside the existing tagsEl and datesEl resets."
      - "In the main path, immediately before the datesEl.textContent assignment, trim w.description into a local. If the trimmed value is a non-empty string, assign it with textContent and set hidden = false. Otherwise clear textContent and set hidden = true. An absent, empty, or whitespace-only value must take the same branch."
      - "Assign the text with textContent and nothing else. Do not add an HTML-escaping helper and do not introduce an innerHTML content write — every innerHTML reference in this file is a clear (`= ''`), and every text write goes through textContent or the el() helper."
      - "Add no reset in openModal. renderModalMeta already runs synchronously at the top of openModal, before modal.showModal(), so every open rewrites the element and no stale description can survive a close-and-reopen."
      - "Change nothing else in the file. Leave matches() and its haystack of id, title, slug, and tags exactly as they are, and leave the board card renderer and the card tooltip with no knowledge that description exists."
      - "Do not fetch anything here and do not read detail-payload state. The value comes from the workstreams array the board already holds."
    pattern: "src/public/app.ts — the renderModalMeta function only. openModal, matches(), the card renderer, renderDetail, and the panel renderers are all untouched."
    imports: "None. Reuse the file's existing byId helper. The el() helper is not needed, because the description is a text write into an element that already exists in the markup."
    compatibility: "The element is provided by task 2.1 and styled by task 2.2; the description?: string key on PraxisWorkstream comes from task 1.1, so w.description is typed string | undefined and the trim must tolerate undefined. Match the file's existing ES5-flavoured style — the surrounding code uses `var` and function expressions, not newer syntax."
    gotcha: "Setting textContent to a value without also clearing the hidden attribute leaves the description invisible; setting hidden = false without a value leaves an empty paragraph that still contributes the meta block's 6px gap. Both branches must set both properties. A `w.description.trim()` with no undefined guard throws on every workstream that has no description, which is almost all of them. Reaching for innerHTML would open an injection path that textContent closes — acceptance criterion 7 depends on textContent."
    verify:
      - "Run `npm run build`. It compiles clean and copy-assets.mjs republishes the front-end assets."
      - "Run `grep -n 'description' src/public/app.ts` and confirm every match falls inside the renderModalMeta function — none in matches(), none in the card renderer, none in openModal."
      - "Run `grep -n 'innerHTML' src/public/app.ts` and confirm every match is still a clear (`= ''`), with no HTML content write added."
      - "Run `git diff -- src/public/app.ts | grep -c 'matches'` and confirm it returns 0, proving the search haystack was not touched."
      - "With the Phase 1 test description still in place, start the server and open the edited workstream's card. The description appears as the first line under the id/title/status header, above tags and dates, and the <angle> text shows literally as <angle> rather than as an element."
      - "Close that modal and open a workstream that has no description. No description line appears, and the meta block spacing matches a pre-change screenshot."
      - "Set the test value to `description: \"   \"`, reload, and confirm the modal shows no description line."
      - "Set the test value to 500 characters of text and confirm the paragraph wraps inside the modal with no horizontal scrolling."
      - "Confirm no board card shows the description, and that searching for a word that appears only in the description matches nothing."
      - "Remove the temporary `description` line from the workstream record, then run `git status` in that flowcharge/ tree and confirm the record is back to unmodified."
    checklist:
      - "Does a workstream with a description show it as the first line inside the meta block, above the tags row and the dates line, with the identity header still visually first?"
      - "Does a workstream with an absent, empty, or whitespace-only description show no description element and add no vertical gap?"
      - "Does opening a described workstream, closing it, then opening an undescribed one show no stale text?"
      - "Does a value containing <, &, \" or ' render as literal text, because the write goes through textContent?"
      - "Are matches(), the board card renderer, and the card tooltip all unchanged, so the description appears nowhere outside the detail modal?"
      - "Was the temporary test description removed from the workstream record, leaving no data change committed?"
    self_eval:
      passed: true
      failures: []
    ```
