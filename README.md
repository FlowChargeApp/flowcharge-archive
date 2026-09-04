# FlowCharge

**Private repository.** This is closed-source software for internal use. It is not
published, licensed for reuse, or intended for external redistribution.

FlowCharge is the application and the primary product here — a desktop and local-server
app for running FlowCharge Core project management, not a viewer bolted onto someone
else's tool.

It reads a project's `flowcharge/` folder and renders every workstream as a card in a
five-column board (Backlog · Ready · In Progress · Done · Dropped), sortable by artefact
ID or name, with panels for open issues by severity and artefacts that have gone quiet.
It also installs the FlowCharge Core skill files into your agentic coding tools, tracks
which version each tool has, and updates them in one click from the `Manage integrations`
screen.

The board itself is read-only and non-interactive by design — no drag-and-drop, no writes
back to the source project — and all board movement still happens through the `fc-*`
skills. That read-only boundary covers the board only: installing and syncing Core writes
into your coding tools' own configuration directories.

## How FlowCharge ships

Version 1 ships as a Bun-compiled native binary for macOS, Linux and Windows. Running the
binary starts a local server, and you open the board in a browser.

`npm run package:cli` produces the four artefacts. It runs `tools/package-cli.mjs`, which
writes into `release/cli`: `flowcharge-<version>-darwin-arm64`,
`flowcharge-<version>-darwin-x64`, `flowcharge-<version>-linux-x64` and
`flowcharge-<version>-win-x64.exe`. Bun appends the `.exe` itself for the Windows target.

There are two routes to the binary. The first is the Releases page of the public
flowcharge-public repository. The second is the Homebrew tap:

```bash
brew install <owner>/flowcharge/flowcharge
```

The `<owner>` placeholder stands for the GitHub account, which is not decided yet.

Electron stays a supported build path — `npm run electron:dev` for development, and
`npm run package:mac`, `npm run package:linux` and `npm run package:win` for desktop
builds — but it is not the version 1 release form. See
[Building the Electron app](#building-the-electron-app) for that path.

## FlowCharge Core

FlowCharge installs and orchestrates FlowCharge Core, the companion open-source skill and
JavaScript suite: <https://github.com/FlowChargeApp/flowcharge-core>. Core is free,
complete, and fully usable on its own — its own repository documents what it does and how
to use it. This application is separate: it stays private and closed-source, as the banner
above says.

## Quick start

```bash
npm install     # TypeScript toolchain (devDependencies only)
npm start       # build, then serve at http://localhost:4173
```

Then open the home page and add a project you're working on: paste the absolute path of any
directory containing a `flowcharge/` folder into the form, and it appears as a tile. Click the tile to
open its board.

`npm install` is required before running this locally: both `npm start` and `npm run refresh`
compile first, and without `node_modules` they fail on a missing `tsc`.

The board works out of the box with nothing added. Until a registry file exists, the home page
shows a single pre-registered tile for this repository itself, and its board renders live from
FlowCharge's own `flowcharge/` tree. As soon as a project is added the registry file is written and the
list becomes exactly what it contains.

## How it fits together

```
Praxis-Dashboard/
├── src/                             hand-written source
│   ├── server.ts                    zero-dependency static server + /api/ routes (npm start)
│   ├── lib/
│   │   ├── extract.ts               pure extraction library — flowcharge/ → PraxisData
│   │   ├── git.ts                   current branch reader — .git/HEAD → branch name
│   │   └── projects.ts              the project registry: read, find, add, rename, remove
│   ├── scripts/
│   │   └── extract-praxis-data.ts   thin CLI over extract.ts — standalone JSON dump
│   ├── types/
│   │   └── praxis-data.d.ts         shared payload types (both compilations, no imports)
│   └── public/
│       ├── index.html               home page shell — project tiles and the add form
│       ├── board.html               the board document, opened at /board.html?project=<id>
│       ├── styles.css               all page styling
│       ├── app.ts                   fetches the project's data, renders KPIs, board, panels
│       ├── home.ts                  fetches /api/projects, renders the tiles and the add form
│       └── tsconfig.json            browser-side compiler config (DOM, no Node types)
├── tools/
│   └── copy-assets.mjs              copies the non-TS assets into dist/public/
├── tsconfig.json                    Node-side compiler config (server, lib, extractor)
├── .praxis-projects.json            machine-local project registry — gitignored, created on
│                                    your first added project
└── dist/                            generated by npm run build — gitignored
    ├── server.js
    ├── lib/                         extract.js, projects.js
    ├── scripts/extract-praxis-data.js
    └── public/                      index.html, board.html, styles.css, app.js, home.js
```

`extract-praxis-data.ts` parses each workstream's frontmatter and its linked plans, issue
lists, and task lists directly from the markdown — the same source of truth the `fc-*`
skills and `fc-index.mjs` use. It never writes back to the project it reads.

## Scripts

| Command | Does |
|---|---|
| `npm run build` | Compiles both TypeScript projects into `dist/` and copies the static assets |
| `npm start` | Builds, then serves the pages and the `/api/` routes at `http://localhost:4173` (override with `PORT=xxxx npm start`) |
| `npm run refresh -- --root <dir>` | Builds, then dumps `<dir>/flowcharge/` to a JSON file — a standalone snapshot, not the board's feed |

`npm run refresh` is a convenience for anyone who wants the extracted payload as a file: the board
never reads it, and there is no need to run it before opening a board. It accepts `--out <file>` to
write somewhere other than its `dist/public/data.json` default.

## Notes

- There is a TypeScript compile step and two devDependencies (`typescript`, `@types/node`), but
  no runtime dependency, no framework and no bundler — `server.ts` and `app.ts` use only
  Node/browser built-ins, and `tsc` just strips the types.
- There is deliberately no `clean` script. `rm -rf dist` is safe and costs nothing: every board
  is extracted live on request, so the next build restores everything the pages need. Your
  project list is unaffected — it lives in `.praxis-projects.json` at the repo root, outside
  `dist/`.
- The server binds `127.0.0.1` by default, so it is reachable only from this machine unless you
  set `HOST` (for example `HOST=0.0.0.0`) to open it to the network. There is no authentication,
  so once opened, any device that can reach it can read every registered project's content and
  can add, rename, or remove registry entries — and registered project paths still resolve on
  this machine's filesystem regardless of which machine's browser makes the request. The server
  logs a startup warning whenever it is bound to a non-loopback host.
- `ALLOWED_HOSTS` is a comma-separated list of extra hostnames the server will answer to. It
  does not open the server to the network — only `HOST` does that — it just widens the `Host`
  header the server accepts. IP literals and `localhost` are always accepted, so the default
  empty value needs no configuration. Set it when you reach a `npm run start:lan` server by a
  hostname rather than by its IP address (for example `ALLOWED_HOSTS=board.local npm run
  start:lan`); without the name listed, every request to that hostname is answered `403`.
- The packaged app asks GitHub's public Releases API (`api.github.com`) for the latest release —
  once per launch, and at most once a day. The request carries no identifier beyond the IP address
  any HTTPS request reveals, and nothing is downloaded and nothing is installed: the app only shows
  a dismissible banner telling you a newer release exists. The banner's "Turn off update checks"
  button writes `"enabled": false` into `.praxis-update.json` in the app's user-data directory.
  There is no settings screen and none is planned, so that file is also where you set `enabled`
  back to `true` by hand to turn the checks on again.
- "Needs attention" (artefacts `in-progress` for 14+ days) is computed in the browser
  against the *viewer's* clock from each artefact's own `updated` date, so it stays
  accurate no matter how long ago the data was last refreshed.
- Works with any project that follows the FlowCharge `flowcharge/` convention, not just LAD — the
  extractor has no LAD-specific logic.

## Building the Electron app

Electron is the secondary build path, not the version 1 release form — see
[How FlowCharge ships](#how-flowcharge-ships) for the artefact users actually download.

The desktop builds produced by `npm run package:mac`, `npm run package:linux` and
`npm run package:win` are unsigned and unnotarized. They are intended for the author's own
machine only, in keeping with the private, closed-source status stated at the top of this file.

- A build made and run on the same machine carries no `com.apple.quarantine` attribute, because
  quarantine is applied by the browser, mail client or AirDrop that downloads a file, not by
  `electron-builder`. Gatekeeper therefore never prompts, and the unsigned status costs nothing
  in that use.
- Copy a macOS build to another machine and that copy does get quarantined, so Gatekeeper blocks
  it. Clear the attribute on the copied bundle before the first launch:

  ```bash
  xattr -dr com.apple.quarantine "FlowCharge.app"
  ```

- Linux `deb` and `AppImage` have no signature gate, so a copied Linux build needs nothing.

Distribution to other people is a different matter. These are prerequisites of the first such
distribution, not later improvements — none of them is in place today:

- An Apple Developer Program membership and a Developer ID Application certificate.
- Apple notarization credentials available to the build. The configuration is already in
  place — `package.json` sets `hardenedRuntime: true` and `notarize: true` in the `mac`
  block of the `build` section — so what is missing here is the credentials, not the
  configuration.
- A Windows OV code-signing certificate, or Azure Trusted Signing, wired through
  `win.signtoolOptions`.
- All of those credentials moved into CI secrets, which also needs a macOS runner this repo
  does not have today.
