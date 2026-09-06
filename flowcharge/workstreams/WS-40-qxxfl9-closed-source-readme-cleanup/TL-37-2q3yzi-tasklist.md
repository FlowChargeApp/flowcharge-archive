---
id: TL-37-2q3yzi
type: tasklist
workstream: WS-40-qxxfl9
slug: closed-source-readme-cleanup
title: "Closed-source reframe of README.md"
status: done
created: 2026-08-18
updated: 2026-08-19
author: Anthony Koukoullis
depends_on: [PLN-30-dos4hw]
links: []
mode: spec
base_commit: 0d82a04
---

# PRX Tasks

## Closed-source reframe of README.md

Implements PLN-30-dos4hw: rework four specific spots in `README.md` — add a
closed-source notice, reword the title/intro, reword the Quick start framing, and
lightly reword one Notes-section line — leaving "How it fits together" and the
Scripts table byte-for-byte unchanged. The closed-source notice uses the plan's
proposed wording verbatim, placed immediately after the H1 and before the existing
intro paragraph (both of the plan's open questions are settled on this basis). No
LICENSE file, license section, or Contributing content is added; the placeholder
`https://github.com` link on line 3 is left as-is; no file other than `README.md` is
touched. `README.md` as read at `base_commit` 0d82a04 matches the plan's assumed line
numbers exactly (H1 at line 1, intro block lines 1-11, Quick start lines 13-29, Notes
bullet at line 98), so all four of the plan's tasks are tasked below with no
divergence.

- [x] 1. Phase 1 — README closed-source reframe

  ```yaml
  description: "Rework README.md in four disjoint edits per PLN-30-dos4hw: add a closed-source notice, reword the title/intro, reword the Quick start framing, and reword the Notes convention bullet. Single phase, single file."
  ```

  - [x] 1.1 Add the closed-source notice
    ```yaml
    description: "Insert the closed-source notice paragraph immediately after the README.md H1, before the existing intro paragraph, using the plan's proposed wording verbatim."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Target `README.md`. Anchor: immediately after line 1 (`# Praxis Board`) and before the existing intro paragraph beginning `A local, bird's-eye Kanban dashboard...` (line 3)."
      - |
        README.md
        <<<<<<< SEARCH
        # Praxis Board

        A local, bird's-eye Kanban dashboard for [Praxis](https://github.com) (`prx`) project-management
        =======
        # Praxis Board

        **Private repository.** This is closed-source software for internal use. It is not
        published, licensed for reuse, or intended for external redistribution.

        A local, bird's-eye Kanban dashboard for [Praxis](https://github.com) (`prx`) project-management
        >>>>>>> REPLACE
      - "Do not alter any other line; this is a pure insertion of one blank-line-separated paragraph."
    pattern: "README.md"
    imports: "None — prose-only edit."
    compatibility: "Markdown syntax only; no front matter in README.md to preserve (it has none)."
    gotcha: "This is a pure insertion — the diff must contain only added lines, no removed lines. Must land before task 1.2, which edits the adjacent intro paragraph and depends on this insertion having happened first."
    verify:
      - "git diff README.md"
      - "grep -n 'Private repository' README.md   # must report a line number <= 15"
      - "git diff README.md | grep -c '^-[^-]'   # must print 0 (pure insertion, no deleted content lines)"
    checklist:
      - "Is the notice visible within the first ~15 lines of README.md? YES/NO"
      - "Does the notice state plainly that the repository is private and not for redistribution? YES/NO"
      - "Is the diff a pure insertion with zero deleted content lines? YES/NO"
      - "Is every other line of README.md unchanged by this task? YES/NO"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.2 Reword the title/intro section
    ```yaml
    description: "Rework the README.md title/intro block (the H1's two intro paragraphs, originally lines 3-11) so it no longer reads as inviting an external audience to adopt or self-host the project, while preserving the functional description and leaving the `[Praxis](https://github.com)` link byte-for-byte unchanged."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Target `README.md`, the intro block: the paragraph beginning `A local, bird's-eye Kanban dashboard...` through `...just a way to see the result at a glance.` (originally lines 3-11; shifted down 4 lines once task 1.1's notice is inserted — anchor on the paragraph text, not the line numbers). Depends on task 1.1 landing first, since it edits the paragraph immediately below the inserted notice."
      - "Keep the functional description intact: what the board renders, the six-column layout, and its read-only/non-interactive design. Do not touch the `[Praxis](https://github.com)` link text or URL — copy it through unchanged, byte-for-byte."
      - "Reword any phrasing that presumes an external reader discovering the project for the first time into phrasing that documents the tool for its own continued internal use. Illustrative only, not literal: '...just a way to see the result at a glance, kept here for this project's own ongoing use of the board.'"
      - "Leave '## How it fits together' and the Scripts table untouched — out of scope for this task and this plan."
    pattern: "README.md"
    imports: "None — prose-only edit."
    compatibility: "Preserve the exact Markdown link syntax `[Praxis](https://github.com)`, byte-for-byte."
    gotcha: "Absolute line numbers shift by +4 once task 1.1's notice is inserted above this block — anchor on content (the paragraph text), not the plan's original line numbers. Do not touch the H1 line, the notice from task 1.1, or the Quick start section (task 1.3's region)."
    verify:
      - "git diff README.md"
      - "grep -nF '[Praxis](https://github.com)' README.md   # must still match, confirming the link is byte-for-byte unchanged"
      - "grep -n '^## How it fits together' README.md   # confirms this heading and everything below it is untouched by this task's diff hunk"
    checklist:
      - "Is the `[Praxis](https://github.com)` link text and URL byte-for-byte unchanged? YES/NO"
      - "Does the reworded intro keep the functional description (board rendering, six-column layout, read-only design)? YES/NO"
      - "Is the external-adoption framing removed from the intro? YES/NO"
      - "Are 'How it fits together' and the Scripts table untouched by this task's diff? YES/NO"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.3 Reword the Quick start section
    ```yaml
    description: "Rework the prose surrounding the Quick start code block in README.md (currently lines 20, 23-24, 26-29) from 'anyone who clones this repo' framing to 'how to run this locally for development' framing, leaving the `npm install` / `npm start` fenced code block verbatim."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Target `README.md`, the `## Quick start` section. Do not touch the fenced code block containing `npm install` and `npm start` (currently lines 15-18) — copy it through verbatim, unchanged, including its inline comments."
      - "Reword the surrounding prose: the sentence starting 'Then open the home page and add a project...', the sentence starting '`npm install` is a genuine prerequisite...', and the paragraph starting 'The board works out of the box with nothing added...'. Change their address from a generic new adopter cloning the repo to documentation of this project's own local dev workflow."
      - "Illustrative only, not literal: 'Then open the home page and add a project you're working on: paste the absolute path of any directory containing a `flowcharge/` folder into the form...' — same instructions, reframed as internal usage documentation rather than onboarding copy for a stranger."
    pattern: "README.md"
    imports: "None — prose-only edit."
    compatibility: "The fenced ```bash code block content (`npm install`, `npm start`, and their inline comments) must stay byte-for-byte identical."
    gotcha: "Independent of tasks 1.1/1.2/1.4 (different region of the file) but its absolute line numbers shift once task 1.1's notice lands — anchor on the `## Quick start` heading and the surrounding sentence text, not the plan's original line numbers."
    verify:
      - "git diff README.md"
      - "grep -n 'npm install' README.md; grep -n 'npm start' README.md   # both must still appear inside the fenced code block, verbatim"
      - "git diff README.md | grep -E '^-.*npm (install|start)'   # must print nothing, confirming the code-block lines were not touched"
    checklist:
      - "Does the fenced code block still contain `npm install` and `npm start` verbatim with their original comments? YES/NO"
      - "Is the surrounding prose reworded away from 'anyone who clones this repo' framing? YES/NO"
      - "Does the reworded prose still accurately describe the steps to run the project locally? YES/NO"
      - "Is the diff scoped only to this section's prose lines, with no code-block lines removed? YES/NO"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.4 Reword the Notes-section line
    ```yaml
    description: "Reword the README.md Notes-section bullet 'Works with any project that follows the Praxis `flowcharge/` convention, not just LAD — add whichever projects you want to inspect on the home page, and switch between their boards from there.' so it reads as internal technical documentation of a true fact, not a public-facing feature pitch, while preserving the technical claim."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Target `README.md`, the `## Notes` section bullet beginning 'Works with any project that follows the Praxis `flowcharge/` convention, not just LAD' (currently line 98, wrapped across lines 98-100; content shifts if task 1.1 lands first — anchor on the bullet's own text, not the line number)."
      - "Keep the technical claim: the extraction logic is not LAD-specific and works with any `flowcharge/`-convention project. Remove the second-person sales framing ('add whichever projects you want to inspect... and switch between their boards from there')."
      - "Illustrative only, not literal: 'Works with any project that follows the Praxis `flowcharge/` convention, not just LAD — the extractor has no LAD-specific logic.'"
      - "Do not touch the other Notes bullets (compile step, no `clean` script, server binding/auth, 'Needs attention' clock) — leave them byte-for-byte unchanged."
    pattern: "README.md"
    imports: "None — prose-only edit."
    compatibility: "None beyond Markdown bullet-list syntax."
    gotcha: "Independent of tasks 1.1-1.3 (different region of the file) but anchor on the bullet's own text, since absolute line numbers shift once task 1.1's notice lands."
    verify:
      - "git diff README.md"
      - "grep -n 'flowcharge/' README.md   # confirm the technical claim (works with any flowcharge/-convention project) still reads correctly in the Notes section"
      - "git diff README.md   # confirm only this bullet's wrapped lines changed; the other four Notes bullets show no diff hunk"
    checklist:
      - "Does the reworded bullet keep the technical claim (works with any flowcharge/-convention project, not just LAD)? YES/NO"
      - "Is the second-person 'add whichever projects you want' sales framing removed? YES/NO"
      - "Are the other four Notes bullets byte-for-byte unchanged? YES/NO"
    self_eval:
      passed: true
      failures: []
    ```
