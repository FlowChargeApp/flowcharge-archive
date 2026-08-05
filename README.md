# Praxis Board

A local, bird's-eye Kanban dashboard for [Praxis](https://github.com) (`prx`) project-management
workstreams — the `prxwork/` markdown convention used by the `prx-orchestrate` Claude Code skill.

Reads a project's `prxwork/` frontmatter and renders every workstream as a card in a
six-column board (Backlog · Ready · In Progress · Blocked · Done · Dropped), sortable by
artefact ID or name, with panels for open issues by severity and artefacts that have gone
quiet. It's read-only and non-interactive by design — no drag-and-drop, no writes back to
the source project. All board movement still happens through the `prx-*` skills; this is
just a way to see the result at a glance.

## Quick start

```bash
npm run refresh -- --root /path/to/your/project   # extract prxwork/ into public/data.json
npm start                                          # serve the board at http://localhost:4173
```

A snapshot of the LAD project is checked in at `public/data.json` so the board works out of
the box — re-run `npm run refresh` whenever you want current data.

## How it fits together

```
Praxis-Dashboard/
├── server.js                        zero-dependency static file server (npm start)
├── scripts/
│   └── extract-praxis-data.mjs      reads <project>/prxwork/ → writes public/data.json
└── public/
    ├── index.html                   page shell and markup
    ├── styles.css                   all page styling
    ├── app.js                       fetches data.json, renders KPIs, board, panels
    └── data.json                    generated data (not hand-edited)
```

`extract-praxis-data.mjs` parses each workstream's frontmatter and its linked plans, issue
lists, and task lists directly from the markdown — the same source of truth the `prx-*`
skills and `prx-index.mjs` use. It never writes back to the project it reads.

## Scripts

| Command | Does |
|---|---|
| `npm start` | Serves `public/` at `http://localhost:4173` (override with `PORT=xxxx npm start`) |
| `npm run refresh -- --root <dir>` | Regenerates `public/data.json` from `<dir>/prxwork/` |

`npm run refresh` accepts `--out <file>` to write somewhere other than `public/data.json`.

## Notes

- No build step, no framework, no npm dependencies — `server.js` and `app.js` use only
  Node/browser built-ins.
- "Needs attention" (artefacts `in-progress` for 14+ days) is computed in the browser
  against the *viewer's* clock from each artefact's own `updated` date, so it stays
  accurate no matter how long ago the data was last refreshed.
- Works with any project that follows the Praxis `prxwork/` convention, not just LAD —
  point `--root` at whichever project you want to inspect.
