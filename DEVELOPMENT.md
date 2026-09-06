# Development

Working notes for this repository — the private source of the FlowCharge application.
The package name is still `praxis-dashboard`; the product name is FlowCharge.

`README.md` describes what the application is and how it ships. This file describes how to
build it, test it, and cut a release.

## Prerequisites

| Tool | Needed for | Notes |
|---|---|---|
| Node | Everything | `package.json` declares `"node": ">=20.14"`. |
| npm | Install and every script | Ships with Node. `package-lock.json` is committed. |
| Bun | `npm run package:cli` only | Not a devDependency. It must be on `PATH`, and `bun --version` must work. Install it from <https://bun.sh>. |
| gh | Publishing a release | The GitHub CLI, authenticated with `gh auth login`. `.github/scripts/release.mjs` checks for it early, so a tag is never cut with no way to publish it. |

Bun and gh are needed only for the release path. Normal development needs Node and npm alone.

There is no runtime dependency. The build toolchain (TypeScript, esbuild, electron,
electron-builder, javascript-obfuscator) is all in `devDependencies`, and the shipped code
uses only Node and browser built-ins.

## Setup

```bash
npm install
npm start        # builds first, then serves http://localhost:4173
```

`npm install` is required before anything else. `start`, `refresh` and `test` each compile
first through a `pre*` script, and without `node_modules` they fail on a missing `tsc`.

CI uses `npm ci` instead — see `.github/workflows/ci.yml`.

## Build

```bash
npm run build            # the normal development build
npm run build:release    # the hardened build, used by every packaging script
```

`build:base` compiles three separate TypeScript projects and then copies the static assets:

- `tsconfig.json` — the Node side: `src/server.ts`, `src/lib/`, `src/scripts/`, `src/types/`.
- `src/public/tsconfig.json` — the browser side: DOM libs, no Node types.
- `electron/tsconfig.json` — the Electron main and preload code.
- `node tools/copy-assets.mjs` — the HTML, CSS, fonts and images into `dist/public/`.

`build` then runs `node tools/bundle-public.mjs`, which bundles the browser code into one
IIFE per page: `home.js` for `index.html`, `app.js` for `board.html`. `build:release` runs
the same bundler with `--harden`, which obfuscates the output.

`dist/` and `release/` are both gitignored. There is deliberately no `clean` script;
`rm -rf dist` is safe, because the next build restores everything.

### Environment variables

| Variable | Default | Effect |
|---|---|---|
| `PORT` | `4173` | The port the server listens on. |
| `HOST` | `127.0.0.1` | The bind address. `npm run start:lan` sets `0.0.0.0`. The server logs a warning on any non-loopback bind. |
| `ALLOWED_HOSTS` | empty | Extra hostnames accepted in the `Host` header, comma-separated. IP literals and `localhost` are always accepted. It does not open the server to the network — only `HOST` does that. |
| `PRAXIS_APP_VERSION` | unset | The version the server reports. The CLI binary injects it at build time. |
| `PRAXIS_DATA_DIR` | the repo root | Where the registry and preference files live. The CLI binary points it at `~/.flowcharge`. |

## Test

```bash
npm test
```

`pretest` builds first. The suite then runs `node --test --test-force-exit` over two globs:
`dist/**/*.test.js` (the compiled TypeScript tests from `src/`) and
`.github/scripts/**/*.test.mjs` (the four release-script tests, which run from source and
are never compiled).

To run one compiled test file, build once and then call `node --test` directly:

```bash
npm run build
node --test dist/lib/extract.test.js
```

Test files sit beside the code they cover — `src/lib/extract.ts` and
`src/lib/extract.test.ts`, `.github/scripts/release.mjs` and
`.github/scripts/release.test.mjs`.

CI runs `npm ci` and then `npm test` on every push and pull request against `main`. There
is no release job in CI, by design: the release is local commands, and the tag lands in a
different repository.

## Project layout

```
Praxis-Dashboard/
├── src/
│   ├── server.ts        zero-dependency static server plus the /api/ routes
│   ├── lib/             the pure libraries — extract, projects, detail, tree-layout,
│   │                    yaml-block, git, update-check, and the agentic-tools-* engine
│   ├── scripts/         extract-praxis-data.ts, a thin CLI over extract.ts
│   ├── types/           shared payload types, used by both compilations
│   └── public/          the browser side — HTML, CSS, app.ts, home.ts, theme, fonts, img
├── electron/            main.cts, preload.cts and the four IPC handler modules
├── tools/               copy-assets.mjs, bundle-public.mjs, package-cli.mjs
├── .github/
│   ├── scripts/         the release commands and release-format.mjs, with their tests
│   └── workflows/ci.yml the test job
├── dist/                build output (gitignored)
└── release/cli/         the Bun binaries (gitignored)
```

`README.md` holds a fuller, file-by-file version of this tree.

## Scripts

Every script below is defined in `package.json`.

| Command | What it does |
|---|---|
| `npm run build:base` | Compiles the three TypeScript projects into `dist/`, then runs `node tools/copy-assets.mjs`. |
| `npm run build` | `build:base`, then `node tools/bundle-public.mjs`. |
| `npm run build:release` | `build:base`, then `node tools/bundle-public.mjs --harden`. Every packaging script builds from this. |
| `npm start` | Builds (`prestart`), then runs `node dist/server.js` at `http://localhost:4173`. |
| `npm run start:lan` | `npm start` with `HOST=0.0.0.0`, so the server also answers on the local network. |
| `npm run refresh -- --root <dir>` | Builds (`prerefresh`), then dumps `<dir>/flowcharge/` to JSON. Takes `--out <file>`; the default is `dist/public/data.json`. The board never reads this file. |
| `npm test` | Builds (`pretest`), then runs `node --test` over the two globs above. |
| `npm run electron:dev` | Builds, then starts Electron against this working tree. |
| `npm run package:mac` | `build:release`, then `electron-builder --mac --x64 --arm64`. |
| `npm run package:linux` | `build:release`, then `electron-builder --linux deb AppImage`. |
| `npm run package:win` | `build:release`, then `electron-builder --win --x64 --arm64`. |
| `npm run package:cli` | `build:release`, then `node tools/package-cli.mjs` — the four Bun binaries in `release/cli/`. |

`package:cli` is the version 1 build path. `package:mac`, `package:linux` and `package:win`
build the Electron desktop apps, which stay a supported but secondary path. Those desktop
builds are unsigned and unnotarized; see the Electron section of `README.md` before copying
one to another machine.

### What `package:cli` produces

`tools/package-cli.mjs` generates `dist/cli-entry.js`, which embeds every file under
`dist/public/` as a Bun asset, injects the version, and points `PRAXIS_DATA_DIR` at
`~/.flowcharge`. It then runs `bun build --compile` once per target and writes into
`release/cli/`:

- `flowcharge-<version>-darwin-arm64`
- `flowcharge-<version>-darwin-x64`
- `flowcharge-<version>-linux-x64`
- `flowcharge-<version>-win-x64.exe` (Bun appends the `.exe`)

Pass `--target=<label>` one or more times to build a subset, for example
`node tools/package-cli.mjs --target=darwin-arm64`. With no flag it builds all four.

## Cutting a release

No release has been cut yet. The public repository is still private, so the steps below
have not run against a live Releases page.

The release process runs in this order:

```bash
npm run package:cli
node .github/scripts/release.mjs
node .github/scripts/publish-release.mjs
node .github/scripts/bump-formula.mjs
```

Three repositories take part. Each script resolves its siblings from this repository's own
root, and each path is overridable by a flag:

| Repository | Default path | Role |
|---|---|---|
| `Praxis-Dashboard` | this repository | The source, the `version` field, and the built binaries. |
| `flowcharge-public` | `../flowcharge-public` (`--public-repo`) | Holds `CHANGELOG.md`, the tag, and the GitHub Release. |
| `homebrew-flowcharge` | `../homebrew-flowcharge` (`--tap-repo`) | Holds `Formula/flowcharge.rb`. |

No script takes a version argument. All three read the `version` field of this
repository's `package.json`, so they cannot disagree about which release is being cut.
No script bumps that field — edit it by hand, and edit the public repository's
`CHANGELOG.md` to match, before you start.

Every script accepts `--help` and prints its full contract. `publish-release.mjs` and
`bump-formula.mjs` also accept `--dry-run`.

### Before you start

1. Set the new `X.Y.Z` in this repository's `package.json` and commit it.
2. Add the matching `## X.Y.Z` section to `CHANGELOG.md` in `flowcharge-public` and
   commit it. `release.mjs` refuses when the newest heading there is not the
   `package.json` version.
3. Both repositories must be on `main` with a clean tracked working tree.

### Step 1 — `npm run package:cli`

Builds the four Bun binaries into `release/cli/`. `release.mjs` runs this itself, so this
first command is really a rehearsal: it proves the build works before any check or tag.

### Step 2 — `node .github/scripts/release.mjs`

Refuses first, builds second, tags last. It checks the version format, both branches, both
working trees, the `CHANGELOG.md` heading, whether the tag `vX.Y.Z` already exists, and
whether `bun` and `gh` are usable. It then runs `npm run package:cli`, confirms exactly
four non-empty `flowcharge-<version>-*` artefacts, and creates the annotated tag `vX.Y.Z`
in `flowcharge-public`. This repository is not tagged; its short HEAD sha goes into the
tag message instead, so a binary traces back to its source.

The tag is the last write, so any earlier failure leaves no tag behind.

It never pushes. It prints the two push commands to run yourself:

```bash
git -C ../flowcharge-public push origin main
git -C ../flowcharge-public push origin vX.Y.Z
```

Run both before the next step. `publish-release.mjs` refuses when the tag is missing
locally or has not reached `origin`.

### Step 3 — `node .github/scripts/publish-release.mjs`

The one outward-facing command. It attaches the four binaries to a GitHub Release for the
tag, with the title `FlowCharge vX.Y.Z` and notes taken from that version's `CHANGELOG.md`
section. It builds nothing and tags nothing.

The repository slug is read from `flowcharge-public`'s `origin` remote, so moving that
repository between accounts needs no code change. `--repo=<owner>/<name>` overrides it.
`--dry-run` prints the exact `gh` argument vector and calls nothing.

### Step 4 — `node .github/scripts/bump-formula.mjs`

Regenerates `Formula/flowcharge.rb` in the tap working copy from scratch, so a hand edit
there does not survive. It hashes three of the four binaries — `darwin-arm64`,
`darwin-x64` and `linux-x64` — because Homebrew does not run natively on Windows. Run it
after step 3, so the download URLs it writes already resolve.

It writes one file and stops. It prints the commit and push commands to run yourself:

```bash
git -C ../homebrew-flowcharge add Formula/flowcharge.rb && git -C ../homebrew-flowcharge commit -m "flowcharge X.Y.Z"
git -C ../homebrew-flowcharge push origin main
```

After that push, `brew install <owner>/flowcharge/flowcharge` serves the new version.

## Troubleshooting

**`tsc: command not found`, or any script failing before it prints anything.**
`node_modules` is missing. Run `npm install`.

**A stale asset or an old bundle appears in the browser.**
`rm -rf dist`, then build again. Nothing is lost: every board is extracted live on request,
and the project registry lives in `.praxis-projects.json` at the repo root, outside `dist/`.

**`bun is not resolvable on PATH`.**
`package:cli` shells out to Bun; it is not a devDependency. Install Bun and confirm
`bun --version` works.

**`gh is not usable on PATH`.**
Install the GitHub CLI and run `gh auth login`. `release.mjs` checks for it before it
builds, so this refusal costs you nothing.

**`release.mjs` refuses on the CHANGELOG.**
The newest `## X.Y.Z` heading in `flowcharge-public/CHANGELOG.md` does not match this
repository's `package.json` version. An `## Unreleased` heading above it is read past, but
a version heading that disagrees is a hard stop.

**`release.mjs` refuses on a dirty working tree.**
Untracked files are ignored; tracked modifications are not. Commit or stash them. Both
repositories are checked.

**`publish-release.mjs` says the tag has not been pushed.**
Run the two `git push` lines `release.mjs` printed. The tag must exist on `origin` first.

**A copied macOS Electron build will not open.**
The copy carries `com.apple.quarantine`, applied by whatever downloaded it. Clear it:
`xattr -dr com.apple.quarantine "FlowCharge.app"`. A build made and run on the same machine
never has this problem.

**A `npm run start:lan` server answers `403`.**
The `Host` header names a hostname the server does not accept. Add it, for example
`ALLOWED_HOSTS=board.local npm run start:lan`. IP literals and `localhost` always work.
