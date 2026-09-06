---
id: TL-79-ztieal
type: tasklist
workstream: WS-78-0ayqeh
slug: modal-body-replaces-description
title: "Render the workstream Markdown body in the detail modal's description slot"
status: done
created: 2026-08-30
updated: 2026-08-30
author: Anthony Koukoullis
depends_on: [PLN-68-xa5h9a]
links: []
mode: spec
base_commit: 0dabddf
---

# PRX Tasks

## Modal body replaces description

The workstream detail modal shows the `description` frontmatter field today. This
work changes the data source to the workstream's Markdown body, in the same slot,
with the same "Show more" button and the same four-line CSS clamp.

`PraxisWorkstream.body` already exists on the board payload and is already shipped
on every poll, but nothing reads it and its value is lossy twice over: a
`split('---')` slice corrupts any body line that starts `---`, and a three-line
join reduces the body to a blurb. Stage 1 makes the field full-fidelity with the
file's own `stripFrontmatter` helper. Stage 2 swaps one line in `renderModalMeta`
to read `w.body`. Stage 3 adds unit cases for the new extraction behaviour.

The body stays plain text, written with `textContent` (plan A1). No Markdown
renderer is added. No element id, CSS class, function name, type shape, route or
IPC channel changes. `description` stays extracted and stays on the wire (plan A4).

- [x] 1. Stage 1 — make `body` the true workstream body

  ```yaml
  description: "Repair the lossy body computation in the extractor, so the board payload carries the whole workstream body."
  ```

  - [x] 1.1 Compute `body` from `stripFrontmatter` in `walkWorkstreams`
    ```yaml
    description: "Replace the split('---') slice and the three-line truncation with stripFrontmatter(wsText).trim(), so PraxisWorkstream.body carries the whole body with its newlines intact."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/lib/extract.ts, inside walkWorkstreams, delete the two lines that sit directly under `const wsFm = parseFrontmatter(wsText);` and build a raw body from `wsText.split('---')` (lines 145-146 at base_commit 0dabddf)."
      - "In the same function, in the `out.push({ ... })` record (line 214 at base_commit 0dabddf), set the `body` key to `stripFrontmatter(wsText).trim()` in place of the `.filter(Boolean).slice(0, 3).join(' ')` truncation expression."
      - "Make both edits in one pass. Deleting the local const alone leaves the push record referring to a removed name, so the file would not compile between the two edits."
      - "Use the file's own `stripFrontmatter`, exported at src/lib/extract.ts:47. Add no import, no helper, no export and no option."
      - "Leave every other key of the pushed record exactly as it is, including `description`, which stays extracted and stays on the wire per PLN-68-xa5h9a A4."
    pattern: "src/lib/extract.ts only. No other file changes in this task."
    imports: "None added. stripFrontmatter is already defined in this file, so the change adds no import line."
    compatibility: "Contract in PLN-68-xa5h9a §4. PraxisWorkstream.body stays typed `string`. A workstream with frontmatter and no body must yield '', never undefined. A file with no frontmatter yields its whole text, because stripFrontmatter returns its input unchanged."
    gotcha: "Two call sites in one function, not one — the deletion and the push record must move together. src/types/praxis-data.d.ts needs no edit: PraxisWorkstream.body at line 24 carries no comment describing the old three-line value, which is the condition the plan attached to that edit. The change is inside the WORKSTREAM_MARKERS loop, so both tree generations are covered at once and no generation-specific branch is wanted."
    verify:
      - "npm run build"
      - "node --test dist/lib/extract.test.js — the existing suite stays green"
      - "grep -n 'wsText.split(' src/lib/extract.ts — must return zero lines"
      - "git diff --name-only — must list src/lib/extract.ts and nothing else"
      - "npm run refresh, then npm start, then open the board and confirm no card visibly changes; nothing reads body yet, so this stage is invisible in the UI by design"
    checklist:
      - "Does walkWorkstreams set body from stripFrontmatter(wsText).trim(), with the split('---') lines removed?"
      - "Does `grep -n 'wsText.split(' src/lib/extract.ts` return zero lines?"
      - "Is the change free of any added import, helper, export or new option?"
      - "Is src/types/praxis-data.d.ts unchanged, because PraxisWorkstream.body carries no comment describing the old value?"
      - "Is `description` still extracted into the same push record and still on the wire?"
      - "Does the board still render with no visible card change?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Stage 2 — swap the modal's data source

  ```yaml
  description: "Read the workstream body instead of the description frontmatter field in the detail modal's meta block."
  ```

  - [x] 2.1 Read `w.body` in `renderModalMeta`
    ```yaml
    description: "Change the one line in renderModalMeta that seeds the clamped paragraph, so it reads w.body instead of w.description. Everything around it stays as it is."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Apply this block to src/public/app.ts. It targets the single occurrence of this line, inside renderModalMeta (line 1019 at base_commit 0dabddf)."
      - |
        src/public/app.ts
        <<<<<<< SEARCH
            var desc = w.description ? w.description.trim() : '';
        =======
            var desc = w.body ? w.body.trim() : '';
        >>>>>>> REPLACE
      - "Change nothing else. The `if (desc) { … } else { … }` block keeps its descEl.textContent write, its is-clamped class add, and both hidden flags. The `if (!w)` early-return branch above it is untouched."
      - "Change nothing in syncDescriptionOverflow(), in openModal, or in the ws-modal-description-more click handler at src/public/app.ts:1149-1152."
      - "Do not rename the element ids, the CSS classes or the function. They stay ws-modal-description, ws-modal-description-more and syncDescriptionOverflow, per PLN-68-xa5h9a A5. Do not touch src/public/board.html or src/public/styles.css."
      - "Write the text with textContent, never innerHTML. No Markdown renderer is added: the body is plain text, per PLN-68-xa5h9a A1 and the workstream's straight-source-swap constraint."
    pattern: "src/public/app.ts only. No other file changes in this task."
    imports: "None. The workstream object is already held synchronously by renderModalMeta."
    compatibility: "Depends on task 1.1 landing first — the three-line body would rarely exceed four rendered lines and the show-more button would almost never appear. The clamp threshold is CSS (-webkit-line-clamp: 4) and is measured, not counted in JavaScript, so a longer text needs no code change. No fallback to description when the body is empty (PLN-68-xa5h9a A3)."
    gotcha: "renderModalMeta runs before modal.showModal(), and syncDescriptionOverflow() runs immediately after it — that call order is the only moment the height reads are valid, so it must not move. `w.body` is typed `string` and not optional, but the truthiness test still guards the empty-body case and must stay. The other `description` reads in this file are task.fields.description at line 897 and comment text; they are a different field and stay."
    verify:
      - "npm run build"
      - "grep -n 'w\\.description' src/public/app.ts — must return zero lines"
      - "grep -n 'descEl.innerHTML' src/public/app.ts — must return zero lines"
      - "npm start, then open a workstream card and confirm the modal shows that workstream's Markdown body text in the slot the description used"
      - "In the same run, open a card whose body is over four rendered lines and confirm Show more appears, reveals the rest on click, and then hides itself"
    checklist:
      - "Does the modal show the workstream's body text in the slot the description used?"
      - "Does a body over four rendered lines show Show more, and a body of four lines or fewer show no button?"
      - "Does a workstream with an empty body show an empty, hidden slot and no button, exactly as an absent description did?"
      - "Is the text still written with textContent and never with innerHTML?"
      - "Does `grep -n 'w\\.description' src/public/app.ts` return zero lines?"
      - "Are the element ids, CSS classes, syncDescriptionOverflow, board.html and styles.css all unchanged?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 3. Stage 3 — tests

  ```yaml
  description: "Cover the new extraction behaviour with unit cases against a bespoke temp tree."
  ```

  - [x] 3.1 Add a local body fixture helper to the extract suite
    ```yaml
    description: "Add a helper to src/lib/extract.test.ts that writes a one-workstream temp tree with a caller-supplied body, runs a callback against its root, and removes the tree again."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/lib/extract.test.ts, add a module-local helper — for example `withBodyProject(body, run)` — that creates a temp root with fs.mkdtempSync, writes flowcharge/workstreams/WS-1-aa11bb-fixture/workstream.md with a minimal valid frontmatter block followed by the supplied body, calls run(root), and removes the tree in a finally block."
      - "Take the body verbatim from the argument, so a caller can pass a body holding a `---` line, blank lines, or no text at all."
      - "Do not modify src/lib/fixture-project.ts and do not extend its WORKSTREAM_FILE body. That builder is shared with src/lib/detail.test.ts, and PLN-68-xa5h9a §5 Stage 3 prefers a bespoke temp tree."
      - "Do not export the helper and do not import it from another test file. Importing one test file from another registers that file's tests twice, which is why fixture-project.ts exists as its own module."
      - "Add no test case in this task. The helper lands first so the cases in task 3.2 have one construction path."
    pattern: "src/lib/extract.test.ts only."
    imports: "node:fs, node:os and node:path, if the file does not already import them. extractPraxisData is already imported."
    compatibility: "The suite runs with `node --test dist/lib/extract.test.js` after `npm run build`, as recorded at src/lib/extract.test.ts:8. The tree layout must satisfy resolveTreeLayout — a `flowcharge/workstreams/<WS-id>-<slug>/` path with a `workstream.md` marker."
    gotcha: "The frontmatter block must parse: `---` on its own first line, keys, then a closing `---`. A missing closing delimiter makes stripFrontmatter return the whole file and every case would then assert against frontmatter text. Remove the temp tree in a finally block, so a failing assertion leaves nothing behind."
    verify:
      - "npm run build"
      - "node --test dist/lib/extract.test.js — the existing cases stay green and no case is registered twice"
      - "node --test dist/lib/detail.test.js — unaffected, because fixture-project.ts is untouched"
      - "git diff --name-only — must list src/lib/extract.test.ts and nothing else"
    checklist:
      - "Does the helper write the caller's body verbatim under a valid frontmatter block?"
      - "Is src/lib/fixture-project.ts unchanged?"
      - "Is the helper module-local, neither exported nor imported by another test file?"
      - "Does the helper remove its temp tree even when the callback throws?"
      - "Do both existing suites still pass with no case reported twice?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.2 Add the four body-fidelity cases for `walkWorkstreams`
    ```yaml
    description: "Assert, through extractPraxisData, that the workstream body survives a --- line, keeps its blank lines, is returned whole beyond three lines, and comes back as '' when absent."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/lib/extract.test.ts, add four cases that build a tree with the task 3.1 helper, call extractPraxisData(root), and assert on workstreams[0].body."
      - "Case 1: a body holding a line that starts `---` comes back with that line intact. This is the split('---') corruption guard."
      - "Case 2: a body of several paragraphs comes back with its blank lines and its newlines preserved."
      - "Case 3: a body of more than three lines comes back whole, not reduced to three lines and not joined by spaces."
      - "Case 4: a workstream with frontmatter and no body comes back as '', never undefined."
      - "Assert on the exact expected string with assert.equal where the body is short enough to write out. Compute the expectation in the test, never by calling the code under test."
      - "Add nothing beyond these four cases. No case for the description field, for payload size, or for the modal."
    pattern: "src/lib/extract.test.ts only."
    imports: "node:test and node:assert/strict are already imported by this file, as is extractPraxisData."
    compatibility: "Depends on task 1.1. These cases fail against the pre-change extractor by design. Acceptance criteria carried from PLN-68-xa5h9a §5 Stage 1."
    gotcha: "trim() is applied by the extractor, so an expectation must not carry a leading or trailing newline. stripFrontmatter also strips the newlines directly after the closing delimiter, so the body starts at its first non-newline character."
    verify:
      - "npm run build"
      - "node --test dist/lib/extract.test.js — all four new cases pass and every pre-existing case stays green"
      - "node --test dist/lib/detail.test.js — still green"
      - "git diff --name-only — must list src/lib/extract.test.ts and nothing else"
    checklist:
      - "Does a body line starting `---` survive intact?"
      - "Does a multi-paragraph body keep its blank lines and its newlines?"
      - "Is a body longer than three lines returned whole, not joined by spaces?"
      - "Does a workstream with frontmatter and no body yield '' rather than undefined?"
      - "Is every expectation computed in the test rather than by the code under test?"
      - "Is src/lib/fixture-project.ts still unchanged?"
    self_eval:
      passed: true
      failures: []
    ```
