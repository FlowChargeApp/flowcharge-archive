# CLAUDE.md

**FlowCharge** is the product. This repository is a TypeScript CLI that starts a
loopback HTTP server on port 4173 and serves a hand-written DOM browser UI, rendering
any project's `flowcharge/` markdown tree as a Kanban board.

The product renamed to FlowCharge. The code namespace did not. `praxis` survives in
`PraxisData` and its interface family, `window.praxisAPI`, `extractPraxisData()`,
`PRAXIS_DATA_DIR`, `PRAXIS_REPO_REF`, the `.praxis-projects.json` and
`.praxis-update.json` files, and the package name `praxis-dashboard`. Do not rename
these on sight. They are a browser global, a wire format and an on-disk format, so a
rename breaks the bundle, the Electron preload and existing user data together. Rename
them only in a task that asks for it.

## Project facts

> [!IMPORTANT]
> **No Electron.** FlowCharge ships as a CLI binary only (a Bun single-file
> executable). `electron/`, the `electron`/`electron-builder` devDependencies, and the
> `package:mac`/`package:linux`/`package:win` scripts are leftover scaffolding, not a
> release path. `package:cli` is the only real release path. Treat any doc, plan, or
> task that calls Electron supported, or asks for an `npm run electron:dev` check, as
> acting on stale information. Flag it. Do not act on it.

- The product name is "FlowCharge", never "FlowCharge Board" or "FlowCharge
  Dashboard". The board is a view inside the app, not the app's name.
- FlowCharge the application is not open source. FlowCharge Core, the skill suite
  published separately, is MIT.

## Commands

- `npm run build` — chains three `tsc` runs (`tsconfig.json` for Node,
  `src/public/tsconfig.json` for the browser, `electron/tsconfig.json` for Electron),
  then copies static assets, then bundles the browser code with esbuild.
- `npm test` — `pretest` builds first. Tests run against **compiled output**
  (`dist/**/*.test.js`), plus `.github/scripts/**/*.test.mjs` from source. Build
  before you reason about a failing test file path.
- `npm start` — builds, then serves `http://localhost:4173`.
- `npm run package:cli` — the only real release command. Builds the hardened bundle,
  then produces the Bun binaries in `release/cli/`.

## Invariants (breaking these breaks the build or the product)

- The shipped code has no runtime dependencies today. Every entry in `package.json` is
  a `devDependency`, and the app uses only Node and browser built-ins. This is a
  starting position, not a permanent ban. Adding a runtime dependency is allowed, but
  it is a deliberate choice — read ADR-002 and section 9 of `ARCHITECTURE.md` first,
  and record the new dependency there.
- Hexagonal split: `src/ports/` files carry no imports of any kind. `src/core/` knows
  no transport, no status code, no user-facing string. `src/lib/` and `src/http/` are
  the adapters.
- `src/http/` reads no environment variable and never touches the filesystem for
  project data. Config arrives as `HttpServerConfig` fields; every read goes through
  the injected `BoardApi`.
- The board is derived fresh from markdown on every request. No cache, no snapshot,
  no database on the read path. Do not add a state store.
- Browser code never sees Node types; Node code never sees DOM types (`"types": []` in
  `src/public/tsconfig.json`, no `"dom"` lib entry in `tsconfig.json`). Keep the three
  `tsconfig.json` files separate.
- No source maps under `dist/`, and no `eval(`/`Function(` in any browser bundle. The
  build fails on either.
- Loopback-only by default, with `Host`/`Origin` validation and a strict CSP with no
  inline script.
- A test file with no assertions must not carry `.test.` in its name (it would
  double-register the importing file's cases).

## Do / Don't

- Don't add a runtime dependency silently. Ask first, then record it in section 9 of
  `ARCHITECTURE.md`.
- Don't hand-edit generated output under `dist/` or `release/`. Both are gitignored
  and rebuilt.
- Don't add a caching layer to the board read path.
- Don't touch `electron/` to make a feature work. It is scaffolding, not a target.
- Don't push from a release script. The release scripts print the push commands; a
  human runs them.

## Architecture

`ARCHITECTURE.md` at the repository root is the whole-of-system design document,
about 2,160 lines across 11 fixed sections: project identity and ADRs, system
boundaries (C4 container), component architecture (C4 component), file and directory
manifest, data and type definitions, application flows (sequence diagrams), state
model (state machines), integration map, approved libraries, architecture
constraints, and layer implementation constraints.

**It is too large to load in full. Read it on demand, by section.**

| Before you... | Read section |
| --- | --- |
| Make a decision that might contradict an accepted one | 1 (ADRs) |
| Change a component boundary | 2 and 3 (C4 diagrams) |
| Look for where something lives | 4 (manifest) |
| Change a payload or port signature | 5 (types) |
| Change a request/response path | 6 (flows) |
| Change a status or lifecycle | 7 (state model) |
| Touch an external call | 8 (integration map) |
| Add any dependency | 9 (approved libraries) |
| Write code in a layer | 10 and 11 (constraints) |

A small fix with no design impact needs none of it.

`ARCHITECTURE.md` is authored and regenerated by the `atd-generate-architecture`
skill, in the owner's own 11-section format. Regenerate through that skill rather than
hand-editing whole sections. Update the sections your change affects when you change a
component boundary, a port signature, an ADR-level decision, or an external
integration. Never write it as a bare `@` import — link it or wrap it in backticks.

At the end of every completed workstream, review `ARCHITECTURE.md` against what the
workstream changed, and update every section that no longer matches the code.

## Hygiene

This file has a high bar for new rules. Add one only after an agent has actually got
it wrong here. Prefer deleting a rule the codebase or a build check already enforces.
No drive-by additions.
