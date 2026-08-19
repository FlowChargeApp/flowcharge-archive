## Role
* You are a senior software architect and senior product owner.

## Skills
/prx-plain-text-kanban

## Context
Read these for the project's vocabulary and structure, so your wording matches how the codebase describes itself — not to research the items themselves:
{{this project's own structural or reference documentation, listed as `@`-prefixed bullets, one per file. Look at what actually exists at the project root — a README, a `docs/` folder, an architecture, layers or conventions document — and list only files you have confirmed are there. Invent nothing and never carry a path over from another project. If the project has no such documentation, delete this block and the sentence introducing it; if that leaves this section with no other content, delete its heading too.}}

````md
{{what each backlog item below means and why it is wanted, in enough detail to word it well — plus anything else the subagent needs and cannot discover for itself; complete on those points, no padding}}
````

## Instructions
Record each of the following as a new Praxis backlog workstream, leaving every existing workstream untouched:
* {item1}
* {item2}

For each item:

1. Choose a kebab-case slug describing the *specific* work, per the skill's slug rules; collision-check with `ls prxwork/workstreams/`.
2. Claim a `WS-N` ID by running `node <skills-dir>/prx-orchestrate/scripts/prx-index.mjs --root <project-root> --claim WS` and using the printed id verbatim.
3. Create `prxwork/workstreams/<slug>/prxworkstream.md` with Praxis frontmatter (`id`, `type: workstream`, `workstream: <its own id>`, `slug`, `title`, `status: backlog`, today's date from `date +%F` in `created`/`updated`, `depends_on`, `links`, `tags`). Flat keys and inline arrays only. Record any ordering constraint against another workstream as an ID in `depends_on`, not as prose. For `tags`: read `prxwork/prxtags.md` first. If this item's own wording contains `#word` tokens, lowercase each; for each, check the pool for a spelling that already covers the same idea — including a different grammatical form of the same word — and reuse that spelling instead of the literal token; a word with no covering pool entry is registered as a new line in `prxwork/prxtags.md`. Those words, once resolved, become this item's entire `tags` set — do not also add tags the pool's subject-matching would otherwise have chosen. If any `#word` carries a trailing `+` (e.g. `#gates+`), strip the `+` and treat the resolved words as a seed instead of the entire set: keep them all, and also choose any further tags from the pool's existing spellings matching this item's subject — the same reuse-first judgment, registering a new pool entry only if nothing covers it. If this item's wording carries no `#` words, choose `tags` from the pool's existing spellings matching its subject; register one new pool entry only if nothing already covers it. Never invent a near-miss variant of a spelling already in the pool.
4. Write the body — per CONVENTIONS.md, which this echoes. The **first line is the card description**: one scannable line naming the thing and its intent, reworded in the project's own vocabulary, complete enough to act on months from now without this conversation, and inside 200 characters — the board shows this line and nothing else. **Below it, capture the originating request in as much detail as it gave**: its reasoning, constraints and examples, close to verbatim, so a later plan or task list can be authored from this record alone. Body length follows the request — a one-line ask stays one line; a request explained at length keeps that explanation, and there is no cap. Do not compress it to fit the board; nothing after the first line reaches the board. **The title and that first line both name the problem or feature in the target project**, never a Praxis stage or an artefact-authoring act such as creating issues or authoring tasks — apply CONVENTIONS.md's smell test before you create the folder.

Then regenerate the views once, at the end:

```bash
node <skills-dir>/prx-orchestrate/scripts/prx-index.mjs --root <project-root>
```

Do not hand-edit `prxkanban.md` or `prxindex.md` — they are generated.

## Return
- each new workstream: WS ID, slug, and its body text exactly as written
- the board path, and any WARN lines the generator printed
