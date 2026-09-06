---
id: PLN-49-9vsu8m
type: plan
workstream: WS-59-79vhz6
slug: update-check-notification
title: "Check for a newer release and show a dismissible banner"
status: done
created: 2026-08-22
updated: 2026-08-22
depends_on: [WS-58-06dvnk]
links: []
---

# Check for a newer release and show a dismissible banner

## Summary

The packaged Electron app must learn that a newer build exists and tell the user with a
small, dismissible, non-modal banner. It never downloads and never installs anything.

The chosen approach puts the whole decision in the Electron main process and gives the
renderer a display-only view of the answer. Two new ESM libraries under `src/lib/` hold
the logic: one fetches the distribution repository's "latest release" record with the
global `fetch()` and compares semver, the other reads and writes a small preferences
file with the same atomic temp-file-then-rename idiom `src/lib/projects.ts` already
uses. A new main-process handler module applies the policy — enabled, due, newer, not
already dismissed — and answers one IPC channel with either a notice object or `null`.
A fourth new file, a classic renderer script on both pages, reveals a banner element
that ships `hidden` in the markup.

The renderer never makes the network call, never sees a URL it can act on, and never
learns the policy. A plain browser tab has no `window.praxisUpdateAPI`, so the script
returns immediately and nothing happens there — no fallback path is built.

The feature is purely additive. No existing behaviour changes.

## Scope

### Acceptance criteria

1. A user who launches a packaged build, or `npm run electron:dev`, and whose configured
   release repository publishes a version higher than the running one, sees a banner
   below the masthead that names the newer version.
2. The banner carries four affordances: the version text, a "View release" button, a
   "Turn off update checks" button, and a dismiss control.
3. Clicking "View release" opens the release page in the user's default browser. The
   app's own window does not navigate away from the board.
4. Clicking dismiss hides the banner and records the version. The same version never
   raises the banner again, including after a restart. A later, higher version does.
5. Clicking "Turn off update checks" hides the banner and stops every future check on
   this machine until the preferences file is edited by hand.
6. A user on a board page sees the banner survive the board's five-second poll cycle,
   which rebuilds the KPI strip and the card columns.
7. A user with no network, an unreachable host, a `404` (no release published yet), any
   other non-2xx status, or a timeout sees no banner and no error of any kind. The app
   behaves exactly as it does today.
8. A user who opens `http://localhost:4173` in a plain browser tab after `npm start`
   sees no banner and causes no external request, in every case above.
9. At most one external request per launch, and at most one per 24 hours while the app
   stays open.
10. While the release repository constants still hold their placeholder values, no
    external request is made at all and no banner ever appears.
11. `README.md` states that this outbound check exists, which host it contacts, how
    often, and how to turn it off.

### Out of scope

- `electron-updater`, any download, any install, any app restart. This plan is
  notify-only, because the app is unsigned and Squirrel.Mac would refuse the update.
- Code signing and notarization. Tracked outside this repository.
- Creating the public GitHub distribution repository. A manual, outward-facing action
  tracked in the Praxis-Business pre-launch checklist.
- A settings or preferences screen. See Open question 2.
- WS-58's `getAppVersion()` and the footer version line. Treated as a given.
- The `.praxis-installs.json` / `PRAXIS_DATA_DIR` defect in
  `electron/agentic-tools-ipc-handlers.cts:235`. Noted, not fixed, not copied.
- Any change to the board's filter row, sort, KPI logic, or `flowcharge/` extraction.

### Assumptions

These are decisions taken by this plan because Context left them open. Each is reversible.

1. **The release repository constants are placeholders.** The plan uses
   `RELEASE_REPO_OWNER = 'TODO-REPLACE-OWNER'` and
   `RELEASE_REPO_NAME = 'TODO-REPLACE-REPO'`. Someone must replace both before the
   feature does anything in production. The code guards against the placeholder itself,
   so an unedited build makes no request rather than a request to a nonsense path. This
   is Open question 1.
2. **The distribution channel is GitHub's public Releases API.** The URL is
   `https://api.github.com/repos/OWNER/REPO/releases/latest`, unauthenticated, as
   verified during investigation. This is not the repo's own Gitea origin, which is a
   development remote and the wrong host.
3. **The check interval is 24 hours, and a long-lived window re-asks every 6 hours.**
   The re-ask is a renderer timer; the main process decides whether a request is
   actually due, so the interval value in the renderer cannot cause extra requests.
4. **A failed attempt does not consume the daily budget.** `lastCheckedAt` is written
   only after a successful, parsed response. A failure sets an in-memory retry floor of
   one hour, lost on restart, so a machine that starts offline is not blocked for a day
   and a reload loop cannot hammer the host.
5. **The banner appears on both `index.html` and `board.html`.** One script and one
   markup block on each page, mirroring how WS-58 places its footer version line on both.
6. **Prereleases and drafts never notify.** GitHub's `/releases/latest` route excludes
   both by its own definition, so this needs no code.
7. **The banner text names only the new version**, for example
   `Praxis Board 1.1.0 is available.` The running version is WS-58's footer line and is
   not repeated here.
8. **The `User-Agent` header is the bare string `PraxisBoard`,** with no version and no
   machine detail. GitHub requires the header; nothing requires it to identify the user.

## Design

### Where the feature attaches

| Piece | File | State |
|---|---|---|
| Release fetch and semver compare | `src/lib/update-check.ts` | new |
| Its unit tests | `src/lib/update-check.test.ts` | new |
| Preferences file reader and writer | `src/lib/update-prefs.ts` | new |
| Its unit tests | `src/lib/update-prefs.test.ts` | new |
| Main-process policy and IPC channels | `electron/update-check-ipc-handlers.cts` | new |
| Preload bridge | `electron/preload.cts` | changed, one added block |
| Handler registration | `electron/main.cts` | changed, one added call |
| Electron build list | `electron/tsconfig.json` | changed, one added entry |
| Banner script | `src/public/update-banner.ts` | new |
| Renderer build list | `src/public/tsconfig.json` | changed, one added entry |
| Banner markup and script tag | `src/public/index.html`, `src/public/board.html` | changed |
| Banner styling | `src/public/styles.css` | changed, appended rules |
| Ignore the new state file | `.gitignore` | changed, one line |
| Outbound-call disclosure | `README.md` | changed, one bullet |

`src/lib/skill-content-fetch.ts` and `src/lib/projects.ts` are read-only references. This
plan copies their idioms and modifies neither.

### The dependency on WS-58 is an ordering dependency, not a call

The running version is read in the main process with `app.getVersion()` — the same call
WS-58's own handler makes, per that plan's Design section. This plan does **not** invoke
`window.praxisAPI.getAppVersion()` over IPC, because the comparison happens in main,
where the renderer's answer would be a round trip to a value main already holds. WS-58
still lands first: it establishes the shared-renderer-script placement on both pages that
this plan mirrors, and it owns the `PraxisAPI` interface edits this plan deliberately
avoids touching.

### Contract 1 — the preferences file

`src/lib/update-prefs.ts` owns `.praxis-update.json` and nothing else. It knows the file's
shape; it knows nothing about HTTP, releases, versions, Electron, or the banner.

```ts
export interface UpdatePrefs {
  enabled: boolean;                 // false only after the user turns checks off
  lastCheckedAt: string | null;     // ISO 8601, null until the first successful check
  dismissedVersion: string | null;  // the version the user dismissed, null until then
}

export function readUpdatePrefs(): UpdatePrefs;
export function writeUpdatePrefs(prefs: UpdatePrefs): void;
```

Directory resolution copies `src/lib/projects.ts:12-24` exactly: `__dirname` two levels up
for the repo root, overridden by `process.env.PRAXIS_DATA_DIR`, which `electron/main.cts:52`
sets to `app.getPath('userData')` when packaged. This is the correct precedent. The
`repoRoot`-only path at `electron/agentic-tools-ipc-handlers.cts:234-235` is the known
defect and must not be copied.

`readUpdatePrefs` never throws. A missing file, unparseable JSON, or a field of the wrong
type each yields the defaults `{ enabled: true, lastCheckedAt: null, dismissedVersion: null }`,
mirroring `readProjects`'s "a corrupted file costs the user a preference, never the app".
Each field is validated independently, so one bad field does not discard the others.

`writeUpdatePrefs` writes `${prefsPath}.${process.pid}.tmp` and renames it over the target,
for the reason `src/lib/projects.ts:44-56` documents: the temporary file must be a sibling,
because `fs.renameSync` is atomic only within one filesystem.

`.gitignore` gains `.praxis-update.json` beside the existing `.praxis-projects.json` line.

### Contract 2 — the release check library

`src/lib/update-check.ts` knows how to ask one HTTP endpoint for a release record and how
to compare two version strings. It knows nothing about preferences, scheduling,
dismissal, Electron, or the banner.

```ts
export const RELEASES_API_BASE = 'https://api.github.com';
// TODO — replace both before shipping. The public GitHub repository that will hold
// Praxis Board release binaries does not exist yet. While either constant still holds
// its placeholder value, isReleaseRepoConfigured() returns false and no request is made.
export const RELEASE_REPO_OWNER = 'TODO-REPLACE-OWNER';
export const RELEASE_REPO_NAME = 'TODO-REPLACE-REPO';

export function isReleaseRepoConfigured(): boolean;
export function latestReleaseUrl(): string;

export interface LatestRelease {
  version: string;          // tag_name with any leading 'v' stripped
  releaseUrl: string | null; // html_url, or null when absent
}

export async function fetchLatestRelease(timeoutMs?: number): Promise<LatestRelease | null>;
export function parseSemver(raw: string): { major: number; minor: number; patch: number } | null;
export function isNewer(candidate: string, running: string): boolean;
```

`fetchLatestRelease` mirrors `src/lib/skill-content-fetch.ts:223-231`: the Node 18+ global
`fetch()`, no HTTP client dependency, an explicit `!res.ok` branch, and a byte-capped body
read. Three deliberate differences:

- It **returns `null` instead of throwing** on every unhappy path — unconfigured repo,
  non-2xx including 404, network error, timeout, over-cap body, unparseable JSON, missing
  `tag_name`. Context settles that "no release yet" and "host unreachable" are normal
  outcomes, so there is no error for a caller to handle.
- It sets a timeout with `AbortSignal.timeout(timeoutMs)` (Node 18+, no dependency),
  defaulting to 10 seconds. `skill-content-fetch.ts` has no timeout because its fetch is
  user-initiated and its progress is visible; a silent background check must not hang.
- It carries its own small capped-body reader with a 256 KB ceiling. The equivalent
  helper in `skill-content-fetch.ts:170-217` is not exported and that file is a read-only
  reference, so the duplication is forced rather than chosen.

Request headers: `Accept: application/vnd.github+json` and `User-Agent: PraxisBoard`.
GitHub rejects an API request with no `User-Agent`. No token, no credential, no cookie.

`parseSemver` accepts `v?MAJOR.MINOR.PATCH` and ignores any suffix after the patch number.
`isNewer` returns `true` only when the candidate tuple is strictly greater, comparing
major, then minor, then patch. If either side fails to parse, it returns `false` — an
unreadable version never raises a banner.

### Contract 3 — the IPC surface

`electron/update-check-ipc-handlers.cts` registers four channels and exposes them as a
**third** `contextBridge` global, `praxisUpdateAPI`. This follows the precedent
`electron/preload.cts:26-33` set for `praxisSkillInstallAPI`: a distinct concern gets its
own global rather than four more keys on `praxisAPI`. It also keeps this plan out of
`src/public/ipc-adapter.ts`'s `PraxisAPI` interface, which WS-58 is editing, and out of
`src/public/browser-ipc-shim.ts`, which must not gain a browser implementation.

```ts
export interface UpdateNotice {
  version: string;           // the newer version, e.g. '1.1.0'
  hasReleaseUrl: boolean;    // whether View release can do anything
}

// channels
'getUpdateNotice': () => Promise<UpdateNotice | null>;
'dismissUpdate':   () => Promise<void>;
'disableUpdateChecks': () => Promise<void>;
'openReleasePage': () => Promise<void>;
```

Raw values, not the `PraxisIpcResult<T>` envelope. This follows `pickProjectFolder`
(`electron/preload.cts:18`, `electron/ipc-handlers.cts:105-108`), the existing precedent
for a direct handler that is not an HTTP relay and therefore has no status to report.

**No channel takes an argument.** The URL to open and the version to dismiss are both
held in main-process module state from the response main itself received. This mirrors
the rule `electron/agentic-tools-ipc-handlers.cts:284-288` already states for permitted
roots — derived here, never taken from the renderer — and means the renderer cannot ask
this app to open an arbitrary URL in the user's browser.

Module state, all lost on quit:

```ts
let lastKnownLatest: LatestRelease | null = null; // the last successful response
let retryNotBefore = 0;                           // epoch ms, failure back-off floor
```

`getUpdateNotice` policy, in order. Any step that yields `null` stops.

1. `readUpdatePrefs().enabled === false` → `null`.
2. `isReleaseRepoConfigured() === false` → `null`, with one `console.warn` per session.
3. A check is due when `lastCheckedAt` is null, or older than 24 hours, and
   `Date.now() >= retryNotBefore`. When it is not due, skip the network and fall through
   to step 6 using the existing `lastKnownLatest` — so navigating from the home page to a
   board re-shows the banner without a second request.
4. Due: `await fetchLatestRelease()`. On `null`, set `retryNotBefore = Date.now() + 1h`,
   leave `lastCheckedAt` untouched, and return `null`.
5. On success: assign `lastKnownLatest`, clear `retryNotBefore`, and write
   `lastCheckedAt = new Date().toISOString()` through `writeUpdatePrefs`.
6. `isNewer(lastKnownLatest.version, app.getVersion()) === false` → `null`.
7. `prefs.dismissedVersion === lastKnownLatest.version` → `null`.
8. Otherwise return `{ version, hasReleaseUrl: releaseUrl !== null }`.

`dismissUpdate` writes `dismissedVersion = lastKnownLatest.version`, or does nothing when
`lastKnownLatest` is null. `disableUpdateChecks` writes `enabled = false`.

`openReleasePage` calls `shell.openExternal(lastKnownLatest.releaseUrl)` only when that
URL parses, its protocol is `https:`, and its host is `github.com`. Anything else is a
silent no-op. `shell` is a new import from `electron` in this file; nothing else in the
app registers `shell.openExternal` today.

Registration follows `registerAgenticToolsIpcHandlers`: an exported async function that
resolves its `dist/lib/*.js` ESM imports through the `new Function('specifier', ...)`
dynamic-import shim (`electron/agentic-tools-ipc-handlers.cts:237-239`) before it calls
`ipcMain.handle`, because a `.cts` file compiles to CommonJS and cannot `require` the ESM
output. `electron/main.cts:93-95` gains one `await registerUpdateCheckIpcHandlers();`
beside the two existing registration calls, and `electron/tsconfig.json`'s `include` array
gains the new file.

### Contract 4 — the renderer

`src/public/update-banner.ts` is a classic script — no `import`, no `export`, per
`src/public/tsconfig.json`'s `"module": "none"` — added to that file's `include` array and
to a `<script>` tag on both pages after `browser-ipc-shim.js`. It declares its own
`interface Window { praxisUpdateAPI?: { ... } }` block at file scope, merging with the
declarations in `src/public/ipc-adapter.ts:38-40` and `src/public/home.ts:57-70`. The
property is optional, which is what makes the browser-tab guard type-check.

The script knows how to show and hide one element and which four methods to call. It
knows nothing about versions, HTTP, GitHub, intervals that matter, or preferences.

```
if (!window.praxisUpdateAPI) return;   // a plain browser tab: nothing runs, nothing degrades
ask();                                 // once at load
setInterval(ask, 6 * 60 * 60 * 1000);  // main decides whether a request is actually due
```

`ask()` calls `getUpdateNotice()`, and on a non-null notice sets the text, hides the
"View release" button when `hasReleaseUrl` is false, and sets `.hidden = false`. That is
the `board.html:50` / `app.ts:487` idiom — ship the element `hidden` in markup, reveal it
from script. A rejected promise is caught and ignored.

Markup, identical on `src/public/index.html` and `src/public/board.html`, placed
immediately after the closing `</div>` of `.masthead`:

```html
<div class="update-banner" id="update-banner" hidden role="status">
  <span id="update-banner-text"></span>
  <button type="button" id="update-banner-view">View release</button>
  <button type="button" id="update-banner-off">Turn off update checks</button>
  <button type="button" id="update-banner-dismiss" aria-label="Dismiss">×</button>
</div>
```

That position is load-bearing on `board.html`. It is a sibling of `#kpi-strip`, `#board`
and `#lower`, none of which contains it, so none of `app.ts`'s `innerHTML = ''` rebuilds —
`renderKpis` at `app.ts:1200-1202`, `renderBoard` at `app.ts:73` and `app.ts:386` — can
reach it. `app.ts` binds no listener to it and never queries it.

Styling in `src/public/styles.css` reuses the existing token set: `--accent-soft` for the
band, `--accent-ink` for the text, `--line` for the bottom border, matching the
`.masthead` rules at `styles.css:142-190`. The banner is one full-width row that pushes
the page down; it never overlays content and it is not a dialog.

## Staged task breakdown

Phases 1 and 2 build libraries with no user-visible change, which is normally the wrong
cut. It is right here: the version comparison and the response handling are the parts most
likely to be wrong, they are the only parts unit-testable in isolation, and wiring a UI to
an unverified comparison would make Phase 4's manual verification ambiguous. Phase 3 makes
the whole decision path callable and observable; Phase 4 makes it visible.

### Phase 1 — Release fetch and version comparison

**Build.** `src/lib/update-check.ts` per Contract 2, and `src/lib/update-check.test.ts`
beside it.

**Files.** `src/lib/update-check.ts` (new), `src/lib/update-check.test.ts` (new).

**Effort.** Medium.

**Depends on.** Nothing.

**Verify.** `npm run build && node --test dist/lib/update-check.test.js` passes. Tests
cover: `isNewer` across higher, equal, lower, unparseable, and `v`-prefixed inputs;
`parseSemver` on suffixed tags such as `v1.2.3-beta`; `latestReleaseUrl` string shape;
`isReleaseRepoConfigured` false while the placeholders stand. Optionally, temporarily
point the two constants at any public repository with releases, run
`node -e "import('./dist/lib/update-check.js').then(m=>m.fetchLatestRelease()).then(console.log)"`,
and confirm a `{ version, releaseUrl }` object — then revert the constants.

### Phase 2 — The preferences file

**Build.** `src/lib/update-prefs.ts` per Contract 1, `src/lib/update-prefs.test.ts`, and
the `.praxis-update.json` line in `.gitignore`.

**Files.** `src/lib/update-prefs.ts` (new), `src/lib/update-prefs.test.ts` (new),
`.gitignore` (changed).

**Effort.** Small.

**Depends on.** Nothing. Independent of Phase 1.

**Verify.** `node --test dist/lib/update-prefs.test.js` passes. Tests cover: defaults when
the file is absent; defaults when it holds invalid JSON; per-field fallback when one field
has the wrong type; a write-then-read round trip; and the `PRAXIS_DATA_DIR` override in a
fresh child process, copying the child-process technique
`src/lib/projects.test.ts` already documents for its own module-caching problem. After the
run, `git status` shows no untracked `.praxis-update.json`.

### Phase 3 — Main-process policy, IPC channels and preload bridge

**Build.** `electron/update-check-ipc-handlers.cts` per Contract 3, the `praxisUpdateAPI`
block in `electron/preload.cts`, the registration call in `electron/main.cts`, and the
`include` entry in `electron/tsconfig.json`.

**Files.** `electron/update-check-ipc-handlers.cts` (new), `electron/preload.cts`,
`electron/main.cts`, `electron/tsconfig.json`.

**Effort.** Medium.

**Depends on.** Phases 1 and 2.

**Verify.** Run `npm run electron:dev`, open the DevTools console, and run
`await window.praxisUpdateAPI.getUpdateNotice()`. With the placeholder constants it
returns `null` and no request appears in the Network tab of the main process. Then
temporarily set the constants to a public repository whose latest release is higher than
`package.json`'s `version`, relaunch, and confirm the same call returns a notice object
and that `.praxis-update.json` now holds a `lastCheckedAt`. Call it a second time and
confirm no second request is made. Call `dismissUpdate()`, relaunch, and confirm
`getUpdateNotice()` now returns `null`. Revert the constants and delete
`.praxis-update.json` afterwards.

### Phase 4 — The banner

**Build.** `src/public/update-banner.ts`, the markup and script tag on both pages, the
`include` entry in `src/public/tsconfig.json`, and the `.update-banner` rules in
`src/public/styles.css`.

**Files.** `src/public/update-banner.ts` (new), `src/public/index.html`,
`src/public/board.html`, `src/public/tsconfig.json`, `src/public/styles.css`.

**Effort.** Medium.

**Depends on.** Phase 3.

**Verify.** With the constants temporarily pointed at a repository whose latest release is
higher than the running version, run `npm run electron:dev`. The banner appears below the
masthead on the home page and on a board page. On the board, watch it survive at least
three five-second poll cycles while the KPI strip rebuilds. Click "View release" and
confirm the page opens in the default browser while the app window stays on the board.
Click dismiss, reload, and confirm it stays hidden. Delete `.praxis-update.json`, relaunch
to bring the banner back, click "Turn off update checks", relaunch, and confirm no banner
and no request. Finally, run `npm start`, open `http://localhost:4173` in a browser tab,
and confirm no banner on either page and no console error.

### Phase 5 — Disclosure in the README

**Build.** One bullet in `README.md`'s **Notes** section stating that the packaged app
asks GitHub's public Releases API for the latest release once per launch and at most once
per day, that the request carries no identifier beyond the IP address any HTTPS request
reveals, that nothing is downloaded or installed, and that the banner's "Turn off update
checks" button writes `enabled: false` into `.praxis-update.json` in the app's user-data
directory, which is also where it can be set back to `true` by hand.

**Files.** `README.md`.

**Effort.** Small.

**Depends on.** Phase 4.

**Verify.** Read the bullet against the shipped behaviour. Every claim in it — host,
frequency, no download, the file name and the key — matches Contracts 1 to 3.

## Data and compatibility

- **New state.** One new file, `.praxis-update.json`, in `PRAXIS_DATA_DIR` when packaged
  and at the repo root otherwise. No migration: an absent file means defaults, which is
  the state every existing installation is already in.
- **Existing data.** `.praxis-projects.json`, `.praxis-installs.json` and every
  `flowcharge/` tree are untouched. No reader of any of them changes.
- **Existing contracts.** No `/api/*` route, no payload type, and no method on
  `PraxisAPI` changes. `src/public/browser-ipc-shim.ts` is not edited, so the browser-tab
  path compiles and behaves exactly as today.
- **WS-58 coordination.** The two workstreams share four files —
  `electron/preload.cts`, `src/public/index.html`, `src/public/board.html`,
  `src/public/tsconfig.json` — and touch different lines in each. WS-58 adds a key to the
  existing `praxisAPI` literal, a footer element, and a footer script; this plan adds a
  separate `contextBridge` global, a banner element after the masthead, and a second
  script. Landing WS-58 first avoids every textual collision.
- **Rollback.** Four independent levers, strongest last. Leave the repository constants at
  their placeholders and the feature is inert. Set `enabled: false` in the preferences
  file and no check runs. Remove the two markup blocks and the two script tags and the
  banner cannot appear while the main-process side keeps compiling. Revert all of Phase 3
  to 5 and the app is byte-for-byte the app before this workstream. Nothing else reads
  `.praxis-update.json`, so deleting it is always safe.

## Testing strategy

This repository's convention is `node:test` unit tests beside the module, compiled and run
as `node --test dist/lib/<name>.test.js`, with a child process where module-level state
must be exercised twice. There is no renderer test harness and no Electron test harness,
so the two new `.cts` and `.ts` renderer files are verified by hand, as every existing file
in those two directories is.

- **`src/lib/update-check.ts` — unit, Phase 1.** `parseSemver` and `isNewer` are pure and
  get full coverage including malformed input. `fetchLatestRelease` is covered by
  injecting nothing and asserting the guard path: with the placeholder constants it must
  return `null` without a request. Its network branches are verified by hand in Phase 1's
  optional live check, not by an automated test. `src/lib/skill-content-fetch.test.ts`
  sets the opposite precedent — its tier (c) is a live-network integration test with no
  skip-when-offline mechanism — and this plan cannot copy it, because the repository the
  test would call does not exist yet. Once Open question 1 is answered, a matching live
  test becomes writable and is worth adding then.
- **`src/lib/update-prefs.ts` — unit, Phase 2.** Defaults, corruption tolerance, per-field
  validation, round trip, and the `PRAXIS_DATA_DIR` override in a child process.
- **`electron/update-check-ipc-handlers.cts` — manual, Phase 3.** The policy ladder is
  eight ordered branches over two module-level variables; the DevTools console steps in
  Phase 3's verification walk every one of them.
- **`src/public/update-banner.ts` — manual, Phase 4.** Reveal, survive the poll, the three
  buttons, and the browser-tab no-op.
- **Regression.** After Phase 4, `node --test dist/lib/*.test.js` must still pass whole.
  No existing test's subject is modified by this plan.

## Non-functional notes

- **Security.** The external call originates only in the main process, so the CSP at
  `src/server.ts:29-32` stays exactly as it is. The URL is built from compile-time
  constants and never from renderer input. No IPC channel accepts an argument, so the
  renderer cannot steer `shell.openExternal`, which additionally refuses anything that is
  not an `https:` URL on `github.com`. The response body is capped at 256 KB and the
  request is aborted after 10 seconds. No credential is sent or stored.
- **Privacy.** The request discloses the machine's IP address and the string
  `PraxisBoard` to GitHub, once per launch and at most once per day. That is the whole
  disclosure Phase 5 writes into the README, and the "Turn off update checks" button ends
  it permanently.
- **Rate limits.** GitHub's unauthenticated limit is 60 requests per hour per IP. The
  worst realistic case is one request per app launch; the daily throttle and the one-hour
  failure floor keep a normal session at one or two per day.
- **Observability.** One `console.warn` in the main process when the repository constants
  are still placeholders, once per session. Failures are silent by design, per Context.
  Main-process output is visible under `npm run electron:dev` and not in a packaged build,
  which is acceptable for a feature whose every failure mode is "show nothing".

## Open questions

1. **Which owner and repository name does the check target?** The public GitHub repository
   for release binaries does not exist yet, so the plan ships
   `TODO-REPLACE-OWNER/TODO-REPLACE-REPO` and guards against it. Options: (a) fill both in
   when the repository is created, which is the intended path; (b) point them at an
   existing private repository, which will not work — the API needs a token for a private
   repository, and Context rules a token out. **Recommendation: (a).** Until then the
   feature is correctly inert, and Phase 4's verification is done by temporarily editing
   the two constants.
2. **Is "hand-edit the JSON file" an acceptable way to turn the check back on?** The
   banner can turn checks off, but nothing in the UI can turn them back on, because there
   is no settings screen and building one is out of scope. Options: (a) keep the button
   and document the file in the README, which is what this plan does; (b) drop the button
   and make the file the only control, which is honest but leaves no in-app answer to "how
   do I stop this"; (c) build a small settings surface, which is a separate workstream.
   **Recommendation: (a),** with (c) filed separately if a second preference ever appears.
3. **Should a check ever run while the app is packaged but the user has never opened a
   page?** The check is pulled by the renderer on page load, so an app launched and left
   on a load-error screen never checks. Options: (a) accept it, since the app always loads
   a page on launch; (b) move the schedule into the main process with a timer and push the
   notice to the window, which introduces a `webContents.send` direction this codebase
   does not use anywhere today. **Recommendation: (a).**

## Alternatives considered and rejected

1. **`electron-updater` or any auto-installing mechanism.** Rejected by Context and
   confirmed by the code: `package.json`'s `build.mac` block configures no signing, and
   Squirrel.Mac refuses an update not signed by the same team. Notify-only is the only
   thing that can work today.
2. **A main-process timer pushing the notice with `webContents.send`.** Rejected. It
   introduces a second IPC direction that appears nowhere in this codebase, and it needs
   window-lifetime handling for a window that may not exist yet when the timer fires. The
   pull model reuses `ipcMain.handle` and `ipcRenderer.invoke` exactly as all twelve
   existing channels do.
3. **Adding the four methods to the existing `praxisAPI` global.** Rejected. It forces
   either four optional members on `PraxisAPI` or four dead implementations in
   `src/public/browser-ipc-shim.ts`, and it edits the same interface WS-58 is editing. A
   third `contextBridge` global follows the precedent `praxisSkillInstallAPI` already set
   at `electron/preload.cts:26` for a separate concern.
4. **Comparing versions in the renderer using WS-58's `getAppVersion()`.** Rejected. It
   splits one policy across two processes and would require handing the renderer the raw
   release payload — including a URL it could then ask the app to open.
5. **`localStorage` for the dismissal state.** Rejected on a concrete, fatal ground:
   `electron/main.cts:63` sets `PORT = '0'`, so the BrowserWindow's origin is a different
   ephemeral port on every launch, and per-origin storage would be empty every time. A
   dismissed banner would return on the next start.
6. **A full settings or preferences screen for the on/off toggle.** Rejected as scope. No
   such screen exists, and one preference does not justify inventing one. See Open
   question 2.
7. **Widening the CSP's `connect-src` so the renderer could fetch directly.** Rejected by
   Context, and correctly: `src/server.ts:29-32` applies one policy to the whole document,
   so widening it for this would widen it for everything the page loads.
8. **Putting the banner in the KPI strip.** Rejected. `renderKpis` at `app.ts:1200-1202`
   clears `#kpi-strip` with `innerHTML = ''` on every five-second poll, so the banner
   would vanish within seconds and take its listeners with it.
9. **An environment variable such as `PRAXIS_UPDATE_CHECK=0` as the off switch.**
   Rejected. A packaged application launched from Finder or a desktop shortcut inherits no
   shell environment, so the one switch a packaged user needs would be the one they cannot
   reach.
10. **A new HTTP route on `src/server.ts` doing the fetch, with the renderer calling it.**
    Rejected. It would satisfy the CSP, but it puts an outbound proxy on a server that
    binds `0.0.0.0` whenever `HOST` says so and has no authentication — anyone on the
    network could drive it. The main process is reachable only by this app's own window.

## Final summary

One line: the Electron main process asks GitHub's public Releases API at most once a day,
compares semver against `app.getVersion()`, and answers one IPC channel that a small
renderer script turns into a dismissible banner below the masthead.

Five phases: two small libraries with unit tests, one main-process and preload phase, one
UI phase, one README phase. Two medium, one small, one medium, one small — roughly two to
three sittings.

Top risks:

1. The distribution repository does not exist, so the feature ships inert behind two
   placeholder constants and cannot be verified against its real target.
2. Four files are shared with WS-58; landing WS-58 first is the whole mitigation.
3. Every failure is silent by design, so a misconfigured constant looks exactly like a
   working app with no new release.

Needs your answer: the real owner and repository name (Open question 1), and whether
hand-editing `.praxis-update.json` is an acceptable way to turn the check back on after
the banner's off button (Open question 2).
