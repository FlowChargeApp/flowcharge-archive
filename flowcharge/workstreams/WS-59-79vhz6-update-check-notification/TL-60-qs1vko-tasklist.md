---
id: TL-60-qs1vko
type: tasklist
workstream: WS-59-79vhz6
slug: update-check-notification
title: "Check for a newer release and show a dismissible banner"
status: done
created: 2026-08-22
updated: 2026-08-22
author: Anthony Koukoullis
depends_on: [PLN-49-9vsu8m]
links: []
mode: spec
base_commit: 0d81cff
---

# PRX Tasks

## Check for a newer release and show a dismissible banner

The packaged Electron app must learn that a newer build exists and tell the user with a
small, dismissible, non-modal banner. It never downloads and never installs anything.

The whole decision sits in the Electron main process. The renderer gets a display-only
view of the answer. Two new ESM libraries under `src/lib/` hold the logic: one fetches the
distribution repository's "latest release" record with the global `fetch()` and compares
semver, the other reads and writes a small preferences file with the atomic
temp-file-then-rename idiom `src/lib/projects.ts` already uses. A new main-process handler
module applies the policy — enabled, due, newer, not already dismissed — and answers one
IPC channel with either a notice object or `null`. A classic renderer script on both pages
reveals a banner element that ships `hidden` in the markup.

The renderer never makes the network call, never sees a URL it can act on, and never learns
the policy. No IPC channel takes an argument, so the renderer cannot steer
`shell.openExternal`. A plain browser tab has no `window.praxisUpdateAPI`, so the script
returns immediately and nothing happens there. No fallback path is built.

The release repository constants ship as the literal placeholders `TODO-REPLACE-OWNER` and
`TODO-REPLACE-REPO`, with a guard that keeps the feature correctly inert until someone
fills in real values. The banner's "Turn off update checks" button is the only in-app off
switch; the README documents `.praxis-update.json` as the way to turn checks back on by
hand. The check runs only when the renderer pulls it on page load — there is no
main-process timer and no `webContents.send`.

The feature is purely additive. No existing behaviour changes.

- [x] 1. Phase 1 — Release fetch and version comparison

  ```yaml
  description: "Build src/lib/update-check.ts per the plan's Contract 2, plus its node:test unit tests. Pure logic and one HTTP call, no preferences, no Electron, no banner."
  ```

  - [x] 1.1 Create `src/lib/update-check.ts`
    ```yaml
    description: "New ESM library that asks one GitHub endpoint for a release record and compares two version strings."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "This is a NEW file. There is nothing to read and no SEARCH/REPLACE block — author it as a full-file creation."
      - "Export the constants exactly as the plan fixes them: RELEASES_API_BASE = 'https://api.github.com', RELEASE_REPO_OWNER = 'TODO-REPLACE-OWNER', RELEASE_REPO_NAME = 'TODO-REPLACE-REPO'. Do not invent a real owner or repository name. Carry a TODO comment above the two placeholders saying they must be replaced before shipping and that the feature is inert until then."
      - "Export isReleaseRepoConfigured(): boolean. It returns false while either constant still equals its own placeholder literal. This is the guard that makes an unedited build make no request at all."
      - "Export latestReleaseUrl(): string, building `${RELEASES_API_BASE}/repos/${RELEASE_REPO_OWNER}/${RELEASE_REPO_NAME}/releases/latest` from the compile-time constants only. It never takes an argument."
      - "Export interface LatestRelease { version: string; releaseUrl: string | null }. `version` is tag_name with any leading 'v' stripped. `releaseUrl` is html_url, or null when the field is absent."
      - "Export parseSemver(raw: string): { major: number; minor: number; patch: number } | null. Accept `v?MAJOR.MINOR.PATCH` and ignore any suffix after the patch number, so 'v1.2.3-beta' parses as 1.2.3. Return null on anything else."
      - "Export isNewer(candidate: string, running: string): boolean. Return true only when the candidate tuple is strictly greater, comparing major, then minor, then patch. If either side fails to parse, return false — an unreadable version must never raise a banner."
      - "Export async fetchLatestRelease(timeoutMs?: number): Promise<LatestRelease | null>, defaulting timeoutMs to 10000. Mirror the shape of `getInstallContent` in src/lib/skill-content-fetch.ts: the Node 18+ global fetch(), no HTTP client dependency, an explicit `!res.ok` branch, and a byte-capped body read."
      - "fetchLatestRelease returns null instead of throwing on EVERY unhappy path: unconfigured repo, non-2xx including 404, network error, timeout, over-cap body, unparseable JSON, missing tag_name. There is no error for a caller to handle. Wrap the whole body so nothing escapes."
      - "Set the timeout with AbortSignal.timeout(timeoutMs) passed as the request's `signal`. Node 18+ provides it; add no dependency."
      - "Carry a local capped-body reader with a 256 KB ceiling. src/lib/skill-content-fetch.ts's readCappedBody is not exported and that file is a read-only reference here, so this duplication is forced. Consult content-length first as a fast refusal, then enforce the running total over the stream, and cancel the reader on the over-limit path."
      - "Send exactly two request headers: `Accept: application/vnd.github+json` and `User-Agent: PraxisBoard`. GitHub rejects an API request with no User-Agent. Send no token, no credential and no cookie, and put no version or machine detail in the User-Agent."
      - "Return early with null when isReleaseRepoConfigured() is false, BEFORE any fetch() call is reached."
      - "Open the file with a short header comment naming what it owns and what it does not know: no preferences, no scheduling, no dismissal, no Electron, no banner."
    pattern: "src/lib/update-check.ts (new). Compiles under the root tsconfig.json (rootDir src, outDir dist) to dist/lib/update-check.js as ESM."
    imports: "Node 18+ globals only — fetch, Response, AbortSignal.timeout. No package import, no dependency added to package.json. Buffer is available under @types/node if the capped reader wants it."
    compatibility: "ESM output, `\"type\": \"module\"` at the repo root. strict + noEmitOnError are on, so every branch must type-check. The module is imported from a .cts CommonJS file later in Phase 3, so it must have no top-level side effect and no top-level await."
    gotcha: "AbortSignal.timeout rejects with a TimeoutError DOMException, not a plain Error — the catch must be unconditional rather than instanceof-filtered. GitHub answers 404 for a repository with no published release yet, which is a normal outcome, not an error. Stripping the leading 'v' must happen before parseSemver, and parseSemver must also tolerate it, because tag conventions vary. Do not throw anywhere: a thrown error here would surface as an unhandled rejection in the main process."
    verify:
      - "npm run build"
      - "node -e \"import('./dist/lib/update-check.js').then(m=>{if(m.isReleaseRepoConfigured())throw new Error('guard must be false while placeholders stand');return m.fetchLatestRelease()}).then(r=>{if(r!==null)throw new Error('must return null while unconfigured');console.log('OK')})\" — prints OK and makes no network request."
      - "grep -c 'TODO-REPLACE-OWNER\\|TODO-REPLACE-REPO' src/lib/update-check.ts — must be at least 2, confirming the placeholders shipped as literals."
      - "node -e \"const p=require('./package.json');if(p.dependencies)throw new Error('no runtime dependency may be added')\" — passes."
    checklist:
      - "Does fetchLatestRelease return null on every unhappy path and throw on none?"
      - "Does isReleaseRepoConfigured() return false while either constant holds its placeholder, and does fetchLatestRelease check it before any fetch()?"
      - "Are the request headers exactly Accept: application/vnd.github+json and User-Agent: PraxisBoard, with no credential of any kind?"
      - "Is the body read capped at 256 KB and the request aborted after 10 seconds by default?"
      - "Does isNewer return false when either side fails to parse, and true only on a strictly greater major/minor/patch tuple?"
      - "Were zero new dependencies added to package.json?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.2 Create `src/lib/update-check.test.ts`
    ```yaml
    description: "node:test unit tests for the pure comparison logic and the unconfigured-repo guard."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "This is a NEW file. Author it as a full-file creation, no SEARCH/REPLACE block."
      - "Follow the convention every other test in src/lib/ uses: `import { test } from 'node:test'` and `import assert from 'node:assert/strict'`, tests beside the module, run from the compiled dist/ output."
      - "Cover isNewer across higher, equal, lower, unparseable, and 'v'-prefixed inputs on both sides."
      - "Cover parseSemver on a suffixed tag such as 'v1.2.3-beta', on a bare '1.2.3', and on inputs that must yield null."
      - "Cover latestReleaseUrl's string shape — it must contain the two constants and end in '/releases/latest'."
      - "Assert isReleaseRepoConfigured() is false while the placeholders stand."
      - "Assert fetchLatestRelease() resolves to null while unconfigured. Do not stub fetch and do not write a live-network test: the target repository does not exist yet, so the network branches are verified by hand in this phase's optional live check instead."
    pattern: "src/lib/update-check.test.ts (new), beside its module. Compiles to dist/lib/update-check.test.js."
    imports: "node:test, node:assert/strict, and the compiled sibling module via a relative './update-check.js' specifier."
    compatibility: "node --test over the compiled dist/ output, matching src/lib/projects.test.ts and src/lib/extract.test.ts. No test framework dependency exists in this repo and none may be added."
    gotcha: "Import the sibling with the '.js' extension, not '.ts' — the source is TypeScript but the specifier must name the emitted ESM file. Do not copy src/lib/skill-content-fetch.test.ts's live-network tier: it calls a repository that exists, and this plan's does not. A matching live test becomes worth writing only once the real owner and repository name are filled in."
    verify:
      - "npm run build && node --test dist/lib/update-check.test.js — every test passes."
      - "node --test dist/lib/*.test.js — the whole existing suite still passes, confirming no regression."
    checklist:
      - "Does the suite cover isNewer for higher, equal, lower, unparseable, and v-prefixed inputs?"
      - "Does it assert parseSemver ignores a suffix after the patch number?"
      - "Does it assert the placeholder guard is false and fetchLatestRelease resolves null while unconfigured?"
      - "Does the suite make zero network requests?"
      - "Does it use only node:test and node:assert/strict, with no new dependency?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Phase 2 — The preferences file

  ```yaml
  description: "Build src/lib/update-prefs.ts per the plan's Contract 1, its unit tests, and the .gitignore line. Independent of Phase 1."
  ```

  - [x] 2.1 Create `src/lib/update-prefs.ts`
    ```yaml
    description: "New ESM library owning .praxis-update.json and nothing else."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "This is a NEW file. Author it as a full-file creation, no SEARCH/REPLACE block."
      - "Export interface UpdatePrefs { enabled: boolean; lastCheckedAt: string | null; dismissedVersion: string | null }, with the plan's own field comments: enabled is false only after the user turns checks off, lastCheckedAt is ISO 8601 and null until the first successful check, dismissedVersion is the version the user dismissed."
      - "Copy the directory resolution from src/lib/projects.ts lines 12-24 exactly in shape: derive __dirname from fileURLToPath(import.meta.url), go two levels up for the repo root, then `const dataDir = process.env.PRAXIS_DATA_DIR || repoRoot`, then join '.praxis-update.json' onto dataDir."
      - "Do NOT copy the repoRoot-only path at electron/agentic-tools-ipc-handlers.cts:234-235. That is the known defect the plan names and explicitly excludes from this workstream — read it if you like, change nothing in it."
      - "Export readUpdatePrefs(): UpdatePrefs. It never throws. A missing file, unparseable JSON, or a field of the wrong type each yields the defaults { enabled: true, lastCheckedAt: null, dismissedVersion: null }, mirroring readProjects's 'a corrupted file costs the user a preference, never the app'."
      - "Validate each field independently, so one bad field does not discard the others: a file with a good dismissedVersion and a numeric enabled must keep the dismissedVersion and default only enabled."
      - "Export writeUpdatePrefs(prefs: UpdatePrefs): void. Write `${prefsPath}.${process.pid}.tmp` and fs.renameSync it over the target, for the reason src/lib/projects.ts:44-56 documents — the temporary file must be a sibling, because fs.renameSync is atomic only within one filesystem."
      - "Open the file with a short header comment naming what it owns and what it does not know: no HTTP, no releases, no versions, no Electron, no banner."
    pattern: "src/lib/update-prefs.ts (new). Compiles under the root tsconfig.json to dist/lib/update-prefs.js as ESM."
    imports: "node:fs, node:path, node:url (fileURLToPath). Nothing else, and no dependency added."
    compatibility: "ESM output. Read PRAXIS_DATA_DIR at module top level exactly as projects.ts does, so the packaged run (electron/main.cts:52-54 sets it to app.getPath('userData')) and the unpackaged run resolve differently by construction. The module is imported from a .cts CommonJS file in Phase 3, so no top-level await and no top-level side effect beyond the two path constants."
    gotcha: "Reading PRAXIS_DATA_DIR once at module top level means a test that changes the env var after import sees the old value — this is exactly the module-caching problem src/lib/projects.test.ts solves with a child process, and task 2.2 must do the same. A JSON file holding `null` parses successfully but is not an object, so the type check must reject a non-object before it reads fields. Do not create the file on read — an absent file is a valid state that must stay absent until something writes."
    verify:
      - "npm run build"
      - "node --test dist/lib/update-prefs.test.js — after task 2.2 lands, every test passes."
      - "grep -n 'PRAXIS_DATA_DIR' src/lib/update-prefs.ts — must show the override read, confirming the packaged path is honoured."
    checklist:
      - "Does readUpdatePrefs return the documented defaults for a missing file, invalid JSON, and a non-object payload, without throwing in any case?"
      - "Is each field validated independently, so one bad field does not discard the others?"
      - "Does writeUpdatePrefs write a sibling .tmp file named with process.pid and rename it over the target?"
      - "Does the data directory honour PRAXIS_DATA_DIR and fall back to the repo root two levels up from the compiled file?"
      - "Does the module import nothing from electron and nothing about HTTP, releases, or the banner?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.2 Create `src/lib/update-prefs.test.ts`
    ```yaml
    description: "node:test unit tests for defaults, corruption tolerance, per-field validation, round trip, and the PRAXIS_DATA_DIR override."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "This is a NEW file. Author it as a full-file creation, no SEARCH/REPLACE block."
      - "Cover: defaults when the file is absent; defaults when it holds invalid JSON; per-field fallback when exactly one field has the wrong type, asserting the other two survive; a write-then-read round trip."
      - "Cover the PRAXIS_DATA_DIR override in a fresh child process. Copy the technique src/lib/projects.test.ts already documents for its own module-caching problem: execFileSync(process.execPath, ['--input-type=module', '-e', driver], { env: { ...process.env, PRAXIS_DATA_DIR: dataDir } }) against a temp directory from os.tmpdir()."
      - "Assert the override test's write lands inside the temp directory and NOT at the real repo root."
      - "Clean up every temp directory the suite creates."
    pattern: "src/lib/update-prefs.test.ts (new), beside its module. Compiles to dist/lib/update-prefs.test.js."
    imports: "node:test, node:assert/strict, node:fs, node:os, node:path, node:child_process (execFileSync), node:url (fileURLToPath)."
    compatibility: "node --test over the compiled dist/ output. Match the child-process driver shape src/lib/projects.test.ts uses, including its --input-type=module flag, because the module under test is ESM."
    gotcha: "A test that writes at the real repo root leaves an untracked .praxis-update.json behind and will fail the git-status check below. Point every write at a temp directory. The child-process driver's import specifier is resolved from the child's cwd, so pass an absolute file:// URL or set cwd deliberately, as projects.test.ts does. Do not assert on the real repo root path itself — it differs per machine."
    verify:
      - "npm run build && node --test dist/lib/update-prefs.test.js — every test passes."
      - "git status --porcelain | grep -c '.praxis-update.json' — must return 0, confirming no untracked state file was left behind."
      - "node --test dist/lib/*.test.js — the whole existing suite still passes."
    checklist:
      - "Does the suite cover absent file, invalid JSON, one-bad-field fallback, and a round trip?"
      - "Does the PRAXIS_DATA_DIR test run in a fresh child process rather than mutating process.env in-process?"
      - "Does every write target a temp directory, leaving the repo root clean?"
      - "Does git status show no untracked .praxis-update.json after the run?"
      - "Does the suite use only node:test and node:assert/strict, with no new dependency?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.3 Add `.praxis-update.json` to `.gitignore`
    ```yaml
    description: "Ignore the new machine-local state file, beside the existing .praxis-projects.json line."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "One mechanical single-location edit. Apply this block verbatim. See Divergence 2 — the SEARCH text is the working-tree content, which already carries lines beyond base_commit 0d81cff."
      - |
        .gitignore
        <<<<<<< SEARCH
        dist/
        .praxis-projects.json
        # Praxis-managed — do not hand-edit (see prx-index.mjs)
        =======
        dist/
        .praxis-projects.json
        .praxis-update.json
        # Praxis-managed — do not hand-edit (see prx-index.mjs)
        >>>>>>> REPLACE
    pattern: ".gitignore at the repo root."
    imports: "None."
    compatibility: "Plain gitignore syntax. The new entry sits with the other machine-local state files, above the Praxis-managed block."
    gotcha: "The file has uncommitted modifications relative to HEAD, so a block anchored on HEAD's content would not match. This block is anchored on the working tree as read at authoring time. If it still fails, re-read the file and re-anchor on the .praxis-projects.json line."
    verify:
      - "git check-ignore -v .praxis-update.json — names .gitignore and the new line."
      - "git status --porcelain .gitignore — shows the file modified and nothing else changed."
    checklist:
      - "Does git check-ignore confirm .praxis-update.json is ignored?"
      - "Is .praxis-projects.json still ignored, unchanged?"
      - "Was exactly one line added, with no other line reordered or removed?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 3. Phase 3 — Main-process policy, IPC channels and preload bridge

  ```yaml
  description: "Build electron/update-check-ipc-handlers.cts per the plan's Contract 3, the praxisUpdateAPI preload block, the registration call in main.cts, and the electron/tsconfig.json include entry. Depends on Phases 1 and 2."
  ```

  - [x] 3.1 Create `electron/update-check-ipc-handlers.cts`
    ```yaml
    description: "New main-process module holding the whole update policy and the four IPC channels."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "This is a NEW file. Author it as a full-file creation, no SEARCH/REPLACE block."
      - "Export interface UpdateNotice { version: string; hasReleaseUrl: boolean }. hasReleaseUrl says whether View release can do anything."
      - "Register exactly four channels, all returning RAW values rather than the PraxisIpcResult<T> envelope: 'getUpdateNotice' => Promise<UpdateNotice | null>, 'dismissUpdate' => Promise<void>, 'disableUpdateChecks' => Promise<void>, 'openReleasePage' => Promise<void>. This follows pickProjectFolder (electron/preload.cts:18, electron/ipc-handlers.cts:105-108), the existing precedent for a direct handler with no status to report."
      - "NO channel takes an argument. The URL to open and the version to dismiss are both held in main-process module state from the response main itself received. This is the same rule electron/agentic-tools-ipc-handlers.cts:284-288 already states for permitted roots — derived here, never taken from the renderer."
      - "Hold two module-level variables, both lost on quit: `let lastKnownLatest: LatestRelease | null = null` (the last successful response) and `let retryNotBefore = 0` (epoch ms, the failure back-off floor)."
      - "Implement the getUpdateNotice policy in exactly this order; any step that yields null stops. 1) readUpdatePrefs().enabled === false -> null. 2) isReleaseRepoConfigured() === false -> null, with ONE console.warn per session, not per call. 3) A check is due when lastCheckedAt is null, or older than 24 hours, AND Date.now() >= retryNotBefore; when it is not due, skip the network and fall through to step 6 using the existing lastKnownLatest. 4) Due: await fetchLatestRelease(); on null set retryNotBefore = Date.now() + one hour, leave lastCheckedAt untouched, and return null. 5) On success: assign lastKnownLatest, clear retryNotBefore, and write lastCheckedAt = new Date().toISOString() through writeUpdatePrefs. 6) isNewer(lastKnownLatest.version, app.getVersion()) === false -> null. 7) prefs.dismissedVersion === lastKnownLatest.version -> null. 8) Otherwise return { version, hasReleaseUrl: releaseUrl !== null }."
      - "dismissUpdate writes dismissedVersion = lastKnownLatest.version, or does nothing when lastKnownLatest is null. disableUpdateChecks writes enabled = false. Both go through readUpdatePrefs/writeUpdatePrefs so the other fields survive."
      - "openReleasePage calls shell.openExternal(lastKnownLatest.releaseUrl) ONLY when that URL parses, its protocol is exactly 'https:', and its host is exactly 'github.com'. Anything else is a silent no-op. `shell` is a new import from 'electron' in this file; nothing else in the app registers shell.openExternal today."
      - "Read the running version with app.getVersion() in this file. Do NOT call window.praxisAPI.getAppVersion() and do NOT add anything to the PraxisAPI interface — the comparison happens in main, where the renderer's answer would be a round trip to a value main already holds. See Divergence 1."
      - "Export `async function registerUpdateCheckIpcHandlers(): Promise<void>` following registerAgenticToolsIpcHandlers (electron/agentic-tools-ipc-handlers.cts:311 onward): resolve the dist/lib/*.js ESM imports through the `new Function('specifier', 'return import(specifier)')` dynamic-import shim BEFORE calling ipcMain.handle, because a .cts file compiles to CommonJS and cannot require the ESM output."
      - "The dynamic import specifiers are relative to this file's COMPILED location (dist/electron/update-check-ipc-handlers.cjs), so they are '../lib/update-check.js' and '../lib/update-prefs.js' — not relative to the .cts source."
      - "Declare the imported bindings as module-level `let name!: Fn` with definite-assignment assertions and local hand-written function types, exactly as agentic-tools-ipc-handlers.cts does. Do not `import type` from src/lib — this file's rootDir cannot reach that tree."
    pattern: "electron/update-check-ipc-handlers.cts (new). Compiles under electron/tsconfig.json to dist/electron/update-check-ipc-handlers.cjs as CommonJS."
    imports: "ipcMain, shell and app from 'electron'. src/lib/update-check.js and src/lib/update-prefs.js resolved at runtime through the dynamic-import shim, never via a static import."
    compatibility: "module: commonjs, moduleResolution: node10, strict, noEmitOnError — see electron/tsconfig.json. Electron 43. The four raw-value channels must NOT be wrapped in PraxisIpcResult. No change to src/public/ipc-adapter.ts's PraxisAPI interface and no change to src/public/browser-ipc-shim.ts."
    gotcha: "A literal `import(...)` in a .cts file is rewritten by tsc into a require()-based helper that throws ERR_REQUIRE_ESM against dist/lib/*.js — the `new Function` shim exists solely to hide that syntax from tsc's downlevel transform, so it must be used verbatim. app.getVersion() reads package.json's version (1.0.0 today), so a live test needs a target repository whose latest release is higher. console.warn output is visible under `npm run electron:dev` and not in a packaged build, which is acceptable for a feature whose every failure mode is 'show nothing'. Guard the once-per-session warn with a module-level boolean, not a per-call check. Step 3's not-due branch must still run steps 6 and 7 against the cached lastKnownLatest, otherwise navigating from the home page to a board loses the banner."
    verify:
      - "npm run build — the electron project type-checks and emits dist/electron/update-check-ipc-handlers.cjs."
      - "grep -c 'ipcMain.handle' electron/update-check-ipc-handlers.cts — must be exactly 4."
      - "Read every ipcMain.handle callback in the new file and confirm each one declares zero parameters, not even the IpcMainInvokeEvent — no channel may accept a value from the renderer."
      - "grep -c 'praxisUpdateAPI\\|getUpdateNotice' src/public/browser-ipc-shim.ts src/public/ipc-adapter.ts — must be 0 for both files, confirming the plan's exclusion held."
      - "npm run electron:dev, then in the DevTools console run `await window.praxisUpdateAPI.getUpdateNotice()` — with the placeholder constants it returns null and no external request is made. This step needs task 3.2 to have landed."
    checklist:
      - "Are all four channels registered, returning raw values rather than a PraxisIpcResult envelope?"
      - "Does every channel take zero arguments from the renderer?"
      - "Does openReleasePage refuse anything that is not an https: URL on github.com, silently?"
      - "Does the getUpdateNotice ladder run the plan's eight steps in the plan's order, with the not-due branch still consulting lastKnownLatest?"
      - "Is lastCheckedAt written only after a successful, parsed response, with a failure setting a one-hour in-memory retry floor instead?"
      - "Are the two src/lib modules resolved through the new Function dynamic-import shim rather than a static import?"
      - "Is the placeholder console.warn emitted at most once per session?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.2 Add the `praxisUpdateAPI` bridge to `electron/preload.cts`
    ```yaml
    description: "Expose a third contextBridge global forwarding the four update channels."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Append a new block at the END of electron/preload.cts, after the existing praxisSkillInstallAPI block that closes at line 33. Do not touch the praxisAPI object literal at lines 10-19 and do not touch the praxisSkillInstallAPI block — WS-58 edits the praxisAPI literal and this plan must stay out of it. See Divergence 1."
      - "Call contextBridge.exposeInMainWorld('praxisUpdateAPI', { ... }) with exactly four zero-argument wrappers: getUpdateNotice: () => ipcRenderer.invoke('getUpdateNotice'), dismissUpdate: () => ipcRenderer.invoke('dismissUpdate'), disableUpdateChecks: () => ipcRenderer.invoke('disableUpdateChecks'), openReleasePage: () => ipcRenderer.invoke('openReleasePage')."
      - "None of the four wrappers may accept or forward a parameter. A wrapper that took one would defeat the whole reason the channels take no argument."
      - "Precede the block with a short comment in the style of the existing praxisSkillInstallAPI comment at lines 21-25: a third distinct global for a distinct concern, following the precedent that block set, forwarding to the channels registered by electron/update-check-ipc-handlers.cts."
      - "Add no import — contextBridge and ipcRenderer are already imported at line 8."
    pattern: "electron/preload.cts, appended after the existing praxisSkillInstallAPI block."
    imports: "None added. contextBridge and ipcRenderer are already in scope."
    compatibility: "contextIsolation: true and sandbox: true are set at electron/main.cts:23-25, so the bridge is the only way the renderer reaches these channels. The file forwards raw promises and holds no adapter or error-translation logic, matching its own header comment."
    gotcha: "This file is one of four shared with WS-58. WS-58 adds a key to the existing praxisAPI literal; this task appends a separate global. Landing WS-58 first avoids the textual collision — see Divergence 1. Do not fold these four methods into praxisAPI: the plan rejects that explicitly, because it forces either four optional members on PraxisAPI or four dead implementations in src/public/browser-ipc-shim.ts."
    verify:
      - "npm run build — the electron project type-checks."
      - "grep -c 'exposeInMainWorld' electron/preload.cts — must be exactly 3."
      - "git diff --unified=0 electron/preload.cts | grep -c '^-' — must return 0, confirming the edit is purely additive and removed no existing line."
    checklist:
      - "Is praxisUpdateAPI a separate exposeInMainWorld call rather than keys added to praxisAPI?"
      - "Do all four wrappers take zero parameters and forward none?"
      - "Were the praxisAPI and praxisSkillInstallAPI blocks left byte-for-byte unchanged?"
      - "Was no new import added to the file?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.3 Register the handlers in `electron/main.cts`
    ```yaml
    description: "Import and call registerUpdateCheckIpcHandlers beside the two existing registration calls."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Two edits in one file, so this is prose rather than a block."
      - "First: after the existing `import { registerAgenticToolsIpcHandlers } from './agentic-tools-ipc-handlers.cjs';` at line 11, add `import { registerUpdateCheckIpcHandlers } from './update-check-ipc-handlers.cjs';`. Note the .cjs extension — that is the compiled-output specifier this file already uses for its two siblings."
      - "Second: in the app.whenReady() callback, in the three-line block that reads registerIpcHandlers(); / await registerAgenticToolsIpcHandlers(); / createWindow(SERVER_URL); at lines 93-95, add `await registerUpdateCheckIpcHandlers();` between the agentic-tools call and createWindow."
      - "Change nothing else in this file. The PRAXIS_DATA_DIR block at lines 52-54 and the PORT = '0' assignment at line 63 must both stay exactly as they are — registration must happen after them, which the chosen position already guarantees."
    pattern: "electron/main.cts — one import line and one call line."
    imports: "registerUpdateCheckIpcHandlers from './update-check-ipc-handlers.cjs'."
    compatibility: "The registration is awaited because the handler module resolves its ESM dependencies through the dynamic-import shim before it registers, exactly as registerAgenticToolsIpcHandlers does. It must complete before createWindow(SERVER_URL), so the first page load finds the channels already registered."
    gotcha: "Registering after createWindow would let the renderer's page-load call reach an unregistered channel and reject. The import specifier must end in .cjs, not .cts or .js — this file's two existing sibling imports show the convention. electron/main.cts is NOT shared with WS-58, so no collision applies here."
    verify:
      - "npm run build — the electron project type-checks."
      - "grep -n 'registerUpdateCheckIpcHandlers' electron/main.cts — must show exactly two lines, the import and the awaited call."
      - "npm run electron:dev — the app launches, the window opens on the home page, and no error appears in the main-process output."
    checklist:
      - "Is registerUpdateCheckIpcHandlers awaited before createWindow(SERVER_URL)?"
      - "Does the import specifier end in .cjs, matching the two existing sibling imports?"
      - "Were the PRAXIS_DATA_DIR block and the PORT = '0' assignment left unchanged?"
      - "Does the app still launch and open its window with no new error?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.4 Add the new handler to `electron/tsconfig.json`
    ```yaml
    description: "Add update-check-ipc-handlers.cts to the electron project's include array."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "One mechanical single-location edit. Apply this block verbatim."
      - |
        electron/tsconfig.json
        <<<<<<< SEARCH
          "include": ["main.cts", "preload.cts", "ipc-handlers.cts", "agentic-tools-ipc-handlers.cts"]
        =======
          "include": ["main.cts", "preload.cts", "ipc-handlers.cts", "agentic-tools-ipc-handlers.cts", "update-check-ipc-handlers.cts"]
        >>>>>>> REPLACE
    pattern: "electron/tsconfig.json, the include array only."
    imports: "None."
    compatibility: "compilerOptions must not change — target es2022, module commonjs, rootDir '.', outDir '../dist/electron'. The new entry inherits all of them, so the file emits as dist/electron/update-check-ipc-handlers.cjs."
    gotcha: "Without this entry the new .cts file is never compiled, and the import added in task 3.3 fails at runtime with a module-not-found error rather than at build time. electron/tsconfig.json is NOT one of the four files shared with WS-58."
    verify:
      - "npm run build && test -f dist/electron/update-check-ipc-handlers.cjs — the file exists."
      - "node -e \"const c=require('./electron/tsconfig.json');if(c.include.length!==5)throw new Error('include must hold 5 entries')\" — passes."
    checklist:
      - "Does the include array now hold exactly five entries, with the four originals unchanged and in order?"
      - "Were compilerOptions left byte-for-byte unchanged?"
      - "Does npm run build emit dist/electron/update-check-ipc-handlers.cjs?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 4. Phase 4 — The banner

  ```yaml
  description: "Build src/public/update-banner.ts per the plan's Contract 4, the markup and script tag on both pages, the renderer include entry, and the .update-banner rules. Depends on Phase 3."
  ```

  - [x] 4.1 Create `src/public/update-banner.ts`
    ```yaml
    description: "New classic renderer script that reveals the banner element and wires its three buttons."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "This is a NEW file. Author it as a full-file creation, no SEARCH/REPLACE block."
      - "It must be a CLASSIC script: no import and no export anywhere in the file. src/public/tsconfig.json sets \"module\": \"none\", so an added import becomes a compile error."
      - "Declare an `interface Window { praxisUpdateAPI?: { getUpdateNotice(): Promise<{ version: string; hasReleaseUrl: boolean } | null>; dismissUpdate(): Promise<void>; disableUpdateChecks(): Promise<void>; openReleasePage(): Promise<void> } }` block at file scope. It merges with the existing declarations in src/public/ipc-adapter.ts:38-40 and src/public/home.ts:57-70. The property must be OPTIONAL — that is what makes the browser-tab guard type-check."
      - "Wrap the body in an IIFE so nothing leaks to the global scope, matching how the other classic scripts in this directory are written."
      - "Guard first: `if (!window.praxisUpdateAPI) return;` — a plain browser tab runs nothing, degrades nothing, and causes no external request."
      - "Define ask(): call getUpdateNotice(); on a null notice do nothing; on a non-null notice set #update-banner-text to `Praxis Board <version> is available.`, hide #update-banner-view when hasReleaseUrl is false, and set #update-banner.hidden = false. Catch and ignore a rejected promise."
      - "Call ask() once at load, then setInterval(ask, 6 * 60 * 60 * 1000). The interval value cannot cause extra requests — main decides whether a request is actually due."
      - "Wire the three buttons: #update-banner-view calls openReleasePage(); #update-banner-off calls disableUpdateChecks() then hides the banner; #update-banner-dismiss calls dismissUpdate() then hides the banner. Each call is fire-and-forget with its rejection caught and ignored."
      - "Query no element other than the five ids in the banner markup. The script knows nothing about versions beyond the string it is handed, nothing about HTTP, GitHub, or preferences."
    pattern: "src/public/update-banner.ts (new). Compiles under src/public/tsconfig.json to dist/public/update-banner.js."
    imports: "None — a classic script. Only the DOM lib and the ambient Window declaration."
    compatibility: "target es2020, lib [dom, es2020], types [] (no @types/node), module none, strict, noEmitOnError. rootDir '..' puts the output at dist/public/update-banner.js. The declaration merge relies on the interface Window block sitting at file scope in a script file, not inside the IIFE."
    gotcha: "Because the file is a classic script, any top-level `const` shares one global scope with app.ts, home.ts, ipc-adapter.ts and browser-ipc-shim.ts — a name collision is a runtime redeclaration error, so keep every binding inside the IIFE. `return` is illegal at the top level of a script, which is a second reason the guard must live inside a function. Optional chaining on window.praxisUpdateAPI is still needed inside async callbacks, because strict narrowing does not survive an await in every position. Do not add anything to browser-ipc-shim.ts — the browser-tab path must stay exactly as it is today."
    verify:
      - "npm run build — the renderer project type-checks and emits dist/public/update-banner.js."
      - "grep -cE '^\\s*(import|export)\\b' src/public/update-banner.ts — must return 0, confirming a classic script."
      - "grep -c 'praxisUpdateAPI' src/public/browser-ipc-shim.ts — must return 0."
      - "npm start, open http://localhost:4173 and /board.html in a browser tab: no banner on either page, no console error, and no request to api.github.com in the Network tab."
    checklist:
      - "Does the file contain zero import and zero export statements?"
      - "Is window.praxisUpdateAPI declared as an optional property, and is the guard the first thing that runs?"
      - "Are all bindings scoped inside the IIFE, colliding with no global in app.ts, home.ts, ipc-adapter.ts or browser-ipc-shim.ts?"
      - "Is every promise rejection caught and ignored, so no failure surfaces to the user?"
      - "Does a plain browser tab show no banner, log no error, and make no external request?"
      - "Is the View release button hidden when hasReleaseUrl is false?"
    self_eval:
      passed: true
      failures:
        - item: "RESOLVED on re-run — verify: npm run build emits dist/public/update-banner.js"
          reason: "On the first pass the file was authored and type-checked cleanly, but src/public/tsconfig.json's include array did not name it, so tsc never compiled it. Task 4.4, which adds that entry, had aborted as a stale block."
          fix: "Applied — task 4.4 was re-anchored on the live seven-entry array and applied on this re-run. npm run build now emits dist/public/update-banner.js. No change to src/public/update-banner.ts itself was needed."
        - item: "RESOLVED on re-run — does a plain browser tab show no banner, log no error, and make no external request?"
          reason: "The optional-property guard, the IIFE scoping and the caught rejections were always in place, so the script itself is silent and makes no request. While 4.4 was unapplied the <script src=\"update-banner.js\"> tags resolved to a missing file, so a tab logged a 404 for the script asset."
          fix: "Applied — with 4.4 landed the asset is emitted and copied. A local server run answers 200 for /update-banner.js, /index.html and /board.html, so the 404 is gone. The in-browser visual check itself was skipped as a manual step outside an automated verify."
        - item: "Authoring note, not a checklist failure — recorded so the deviation is traceable."
          reason: "ask() was first written as a hoisted `function ask()` declaration. TypeScript drops the five element null-guards' narrowing inside a hoisted declaration, producing TS18047 on text, viewButton and banner."
          fix: "Applied — ask is now a `const ask = function ()` expression created after the guards, which keeps the narrowing. Every other instruction in the subtask was followed verbatim."
    ```

  - [x] 4.2 Add the banner markup and script tag to `src/public/index.html`
    ```yaml
    description: "Ship the banner element hidden, immediately after the masthead, and load the compiled script."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Two edits in one file, so this is prose rather than a block."
      - "First: insert the banner markup immediately after the closing </div> of .masthead — the div opened at line 11 and closed at line 20 — and before the <section class=\"home\"> at line 22."
      - "The markup is exactly, and identically on both pages: a <div class=\"update-banner\" id=\"update-banner\" hidden role=\"status\"> containing <span id=\"update-banner-text\"></span>, <button type=\"button\" id=\"update-banner-view\">View release</button>, <button type=\"button\" id=\"update-banner-off\">Turn off update checks</button>, and <button type=\"button\" id=\"update-banner-dismiss\" aria-label=\"Dismiss\">×</button>."
      - "Second: add <script src=\"update-banner.js\"></script> after the existing <script src=\"browser-ipc-shim.js\"></script> at line 71. Placing it after the shim matches the plan and keeps the load order with the other classic scripts."
      - "Change nothing else on the page. Do not touch the masthead, the manage-integrations button, the add form, or any existing script tag."
    pattern: "src/public/index.html — one markup block after the masthead, one script tag in the tail block."
    imports: "dist/public/update-banner.js, produced by task 4.1 and copied by tools/copy-assets.mjs alongside the other assets."
    compatibility: "The `hidden` attribute in markup plus a script-side `.hidden = false` reveal is the idiom board.html and app.ts already use for #lower and #branch-line. role=\"status\" makes the reveal an assertive-free live region, so a screen reader announces it without stealing focus."
    gotcha: "index.html is one of the four files shared with WS-58, which adds a footer element and a footer script tag to it. The two edits touch different lines, but landing WS-58 first avoids the collision entirely — see Divergence 1. The dismiss glyph is the multiplication sign U+00D7, not the letter x, and the aria-label is what makes it announceable."
    verify:
      - "npm run build && grep -c 'update-banner' dist/public/index.html — must be at least 6, confirming the markup and the script tag both landed and were copied."
      - "grep -c 'id=\"update-banner\"' src/public/index.html — must be exactly 1."
      - "npm run electron:dev — the home page renders exactly as before, with no visible banner while the repository constants hold their placeholders."
    checklist:
      - "Does the banner element sit as a sibling immediately after the .masthead div, outside it?"
      - "Does it ship with the hidden attribute and role=\"status\"?"
      - "Does it carry all four affordances — the text span and the view, off, and dismiss buttons — with the plan's exact ids?"
      - "Is the script tag placed after browser-ipc-shim.js?"
      - "Was every other element on the page left unchanged?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 4.3 Add the banner markup and script tag to `src/public/board.html`
    ```yaml
    description: "The identical banner element and script tag on the board page, positioned so no rebuild can reach it."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Two edits in one file, so this is prose rather than a block."
      - "First: insert the banner markup immediately after the closing </div> of .masthead — the div opened at line 11 and closed at line 26 — and before <div class=\"kpi-strip\" id=\"kpi-strip\"></div> at line 28."
      - "Use the same markup as task 4.2, byte for byte."
      - "That position is load-bearing. The banner must be a SIBLING of #kpi-strip, #board and #lower, contained by none of them, so none of app.ts's innerHTML = '' rebuilds — renderKpis at app.ts:1200-1202, renderBoard at app.ts:73 and app.ts:386 — can reach it."
      - "Second: add <script src=\"update-banner.js\"></script> after the existing <script src=\"browser-ipc-shim.js\"></script> at line 129."
      - "Do not add any listener or query for the banner to src/public/app.ts. app.ts must neither bind to it nor query it."
      - "Change nothing else on the page — not the controls row, not the filter row, not the KPI strip, not the board columns, not the lower panels."
    pattern: "src/public/board.html — one markup block between the masthead and the KPI strip, one script tag in the tail block."
    imports: "dist/public/update-banner.js."
    compatibility: "The board polls every five seconds and rebuilds the KPI strip and the card columns by clearing their innerHTML. The banner survives only because it is outside all three containers."
    gotcha: "Putting the banner inside #kpi-strip would make it vanish within seconds and take its listeners with it — the plan rejects that placement explicitly. board.html is one of the four files shared with WS-58, which adds a footer element and script tag; the two edits touch different lines, but landing WS-58 first avoids the collision — see Divergence 1. This plan must not change the board's filter row, sort, KPI logic, or flowcharge/ extraction."
    verify:
      - "npm run build && grep -c 'update-banner' dist/public/board.html — must be at least 6."
      - "grep -c 'update-banner' src/public/app.ts — must return 0, confirming app.ts neither queries nor binds the banner."
      - "git diff --stat src/public/app.ts — must show no change to app.ts."
      - "npm run electron:dev with the repository constants temporarily pointed at a public repository whose latest release is higher than package.json's version: the banner appears below the masthead and survives at least three five-second poll cycles while the KPI strip rebuilds. Revert the constants and delete .praxis-update.json afterwards."
    checklist:
      - "Is the banner a sibling of #kpi-strip, #board and #lower, contained by none of them?"
      - "Is the markup byte-for-byte identical to index.html's?"
      - "Does the banner survive three or more poll cycles on a live board?"
      - "Was src/public/app.ts left entirely unchanged?"
      - "Were the controls row, filter row, KPI strip, board columns and lower panels all left unchanged?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 4.4 Add the banner script to `src/public/tsconfig.json`
    ```yaml
    description: "Add update-banner.ts to the renderer project's include array."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "One mechanical single-location edit. Apply this block verbatim."
      - |
        src/public/tsconfig.json
        <<<<<<< SEARCH
          "include": ["app.ts", "home.ts", "ipc-adapter.ts", "browser-ipc-shim.ts", "app-version.ts", "../types/praxis-data.d.ts", "lib/agentic-tools-scope.ts"]
        =======
          "include": ["app.ts", "home.ts", "ipc-adapter.ts", "browser-ipc-shim.ts", "app-version.ts", "update-banner.ts", "../types/praxis-data.d.ts", "lib/agentic-tools-scope.ts"]
        >>>>>>> REPLACE
    pattern: "src/public/tsconfig.json, the include array only."
    imports: "None."
    compatibility: "compilerOptions must not change. \"module\": \"none\" is what guarantees the new file stays a classic script, and \"types\": [] is load-bearing — without it tsc auto-includes @types/node. rootDir '..' places the output at dist/public/update-banner.js."
    gotcha: "src/public/tsconfig.json is one of the four files shared with WS-58, which adds its own footer script to the same array — see Divergence 1. Without this entry the new file is never compiled and the script tag added in tasks 4.2 and 4.3 requests a 404."
    verify:
      - "npm run build && test -f dist/public/update-banner.js — the file exists."
      - "node -e \"const c=require('./src/public/tsconfig.json');if(c.include.length!==8)throw new Error('include must hold 8 entries')\" — passes."
    checklist:
      - "Does the include array now hold exactly eight entries, with the seven originals unchanged and in order?"
      - "Were compilerOptions left byte-for-byte unchanged, module none and types [] included?"
      - "Does npm run build emit dist/public/update-banner.js?"
    self_eval:
      passed: true
      failures:
        - item: "RESOLVED on re-run — the first-pass block was stale and the subtask aborted"
          reason: "On the first pass neither the block's SEARCH text nor its REPLACE text was present in src/public/tsconfig.json. WS-58 landed after this list's base_commit 0d81cff, at commit d70ac06, and inserted \"app-version.ts\" into the include array, so the live line held seven entries and not the block's six. Divergence 1 named this ordering risk. Per the execution rules the block was not approximated or re-derived."
          fix: "Applied — the block was re-anchored on the live seven-entry line and applied verbatim on this re-run. The array now holds eight entries, with \"update-banner.ts\" after \"app-version.ts\" and the seven originals unchanged and in order."
        - item: "RESOLVED on re-run — the checklist and verify both named seven entries"
          reason: "Stale alongside the block. The array already held seven entries before this task ran, so the target count is eight."
          fix: "Applied — the checklist item and the verify assertion both read eight entries now."
        - item: "RESOLVED on re-run — does npm run build emit dist/public/update-banner.js?"
          reason: "NO on the first pass. Without the include entry tsc never compiled src/public/update-banner.ts, so nothing was emitted and the script tags added by tasks 4.2 and 4.3 requested a missing asset."
          fix: "Applied — with the include entry in place npm run build emits dist/public/update-banner.js and a local server answers 200 for it."
        - item: "Note on the verify command, recorded for traceability — not an outstanding failure."
          reason: "The verify step runs node -e with require('./src/public/tsconfig.json'). That file is JSONC and carries trailing // comments, so require throws a SyntaxError regardless of the array's contents."
          fix: "Substituted an equivalent automated check that strips the // comments before JSON.parse. It reports eight entries in the documented order."
    ```

  - [x] 4.5 Append the `.update-banner` rules to `src/public/styles.css`
    ```yaml
    description: "Style the banner as one full-width row using the existing token set."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Append the new rules at the END of the file, after the existing .ws-plan-more-count block. Change no existing rule."
      - "Reuse the existing token set only: --accent-soft for the band background, --accent-ink for the text, and --line for the bottom border, matching the .masthead rules at styles.css:142-190."
      - "Style .update-banner as one full-width row that pushes the page down. It must never overlay content and it is not a dialog — no position: fixed, no position: absolute, no z-index, no backdrop."
      - "Lay the row out with flex, a small gap, and vertical centring, so the text span takes the free space and the three buttons sit at the end."
      - "Style the three buttons to match the existing button treatment in the file rather than inventing a new one, and give each a :focus-visible outline consistent with the .ws-plan-more:focus-visible rule at the end of the file."
      - "Add no @media dark-mode block of your own — the tokens are already redefined for dark mode at styles.css:61-65 and 96-97, so using them is what makes the banner theme-correct."
      - "Add no new CSS custom property."
    pattern: "src/public/styles.css, appended rules only. The file is 1086 lines at authoring time."
    imports: "None — the tokens --accent-soft, --accent-ink and --line already exist."
    compatibility: "The banner must respect the same light and dark token definitions the rest of the page uses. The element ships with the hidden attribute, so no rule may set `display` in a way that defeats it — if a display value is set on .update-banner, pair it with `.update-banner[hidden] { display: none; }`."
    gotcha: "Setting `display: flex` on .update-banner overrides the browser's default `display: none` for the hidden attribute, and the banner would then be visible on every load. That is the single most likely defect in this task. Do not touch the .masthead rules or any existing selector — this is a pure append."
    verify:
      - "npm run build && grep -c 'update-banner' dist/public/styles.css — must be at least 1, confirming the rules were copied."
      - "git diff --unified=0 src/public/styles.css | grep -c '^-[^-]' — must return 0, confirming the change is a pure append that removed no existing line."
      - "npm run electron:dev — with the placeholder constants the banner is invisible on both pages; with the constants temporarily pointed at a higher release it renders as a full-width band below the masthead that pushes the content down, in both light and dark appearance."
    checklist:
      - "Does the hidden attribute still hide the banner, with a [hidden] rule present if any display value was set?"
      - "Does the banner use only --accent-soft, --accent-ink and --line, adding no new custom property?"
      - "Is it a full-width row in normal flow, with no fixed or absolute positioning and no z-index?"
      - "Does it render correctly in both the light and the dark token sets, with no new media query added?"
      - "Was every pre-existing rule in the file left unchanged?"
    self_eval:
      passed: true
      failures:
        - item: "Note on the token checklist item, recorded for traceability — not an outstanding failure."
          reason: "The checklist asks for only --accent-soft, --accent-ink and --line, but the same subtask's implement step requires a :focus-visible outline consistent with .ws-plan-more:focus-visible, and that rule is `outline: 2px solid var(--accent)`. The two cannot both hold literally."
          fix: "Resolved as tightly as possible — the band, the button fill, the button border and the hover state use only the three named tokens, and --accent appears exactly once, in the mandated focus-visible outline. No new custom property was added, which is the checklist item's stated intent."
    ```

- [x] 5. Phase 5 — Disclosure in the README
  ```yaml
  description: "Add one bullet to README.md's Notes section disclosing the outbound check, and document .praxis-update.json as the way to turn checks back on by hand."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "One coherent change to one file, so this is an adult task with no children."
    - "Add ONE bullet to the existing Notes section of README.md — the section headed `## Notes`, which today runs from the no-runtime-dependency bullet through the 'Works with any project' bullet. Place it with the other behavioural notes and do not restructure the section."
    - "The bullet must state, and every claim in it must match Contracts 1 to 3 as actually built: that the packaged app asks GitHub's public Releases API (api.github.com) for the latest release; that it does so once per launch and at most once per day; that the request carries no identifier beyond the IP address any HTTPS request reveals; that nothing is downloaded and nothing is installed; and that the banner's 'Turn off update checks' button writes `enabled: false` into `.praxis-update.json` in the app's user-data directory."
    - "Say explicitly that `.praxis-update.json` is also where the value can be set back to `true` by hand, because there is no settings screen and none is planned. This is the documented way to turn checks back on."
    - "Do not add a settings screen, a configuration table entry, or any other section. One bullet only."
    - "Do not change the Quick start, the Scripts table, the How it fits together tree, or the Packaged builds section."
  pattern: "README.md, the ## Notes section only."
  imports: "None."
  compatibility: "Match the surrounding bullets' voice and line width. The README already discloses the server's network posture in the same section, so this bullet belongs beside those."
  gotcha: "Every claim is checkable against the code, so a bullet written before Phase 3 and 4 landed can drift — write it against the shipped behaviour, not against the plan. The host is api.github.com, not the repo's own Gitea origin, which is a development remote and the wrong host to name. The file name is .praxis-update.json, distinct from the existing .praxis-projects.json the tree already documents."
  verify:
    - "grep -c 'api.github.com' README.md — must be at least 1."
    - "grep -c '.praxis-update.json' README.md — must be at least 1."
    - "Read the bullet against the shipped behaviour and confirm each of host, frequency, no-download, the file name, and the enabled key matches electron/update-check-ipc-handlers.cts and src/lib/update-prefs.ts."
    - "git diff --stat README.md — shows README.md as the only changed file for this task."
  checklist:
    - "Does the bullet name api.github.com as the host and the public Releases API as the endpoint?"
    - "Does it state once per launch and at most once per day?"
    - "Does it state that nothing is downloaded and nothing is installed?"
    - "Does it name .praxis-update.json, the enabled key, and the user-data directory, and say the value can be set back to true by hand?"
    - "Was exactly one bullet added, with no other section of the README changed?"
  self_eval:
    passed: true
    failures: []
  ```

## Divergences

1. **WS-58 has not executed, so the four shared files carry none of its changes.** The
   plan's Data and compatibility section assumes WS-58 lands first, and its Design section
   treats `getAppVersion()` and the footer version line as a given. In fact
   `flowcharge/workstreams/WS-58-06dvnk-app-version-display/workstream.md:8` reads
   `status: backlog`, and at short SHA `0d81cff` none of the four shared files carries
   WS-58 content: `electron/preload.cts` exposes only `praxisAPI` and
   `praxisSkillInstallAPI` with no `getAppVersion` key, `src/public/index.html` and
   `src/public/board.html` carry no footer version element and no footer script tag, and
   `src/public/tsconfig.json`'s `include` array holds six entries with no footer script.
   The consequence is narrow: no task in this list depends on a WS-58 symbol, because the
   plan deliberately reads the running version with `app.getVersion()` in the main process
   and adds a third `contextBridge` global rather than editing the `PraxisAPI` interface.
   Every stage is therefore tasked. What remains is an ordering risk, not a blocked task —
   tasks 3.2, 4.2, 4.3 and 4.4 edit the same four files WS-58 will edit, at different
   lines. Execute WS-58 first and the collision cannot occur; execute this list first and
   WS-58's own author must re-anchor against the added lines.

2. **`.gitignore` in the working tree is ahead of `base_commit`.** Task 2.3 carries a
   SEARCH/REPLACE block, and this file's `base_commit` is `0d81cff`. At that commit
   `.gitignore` ends at the `.praxis-projects.json` line, but the working tree read at
   authoring time carries five further uncommitted lines — the Praxis-managed block and
   `release/`. The block in task 2.3 is anchored on the working-tree content, which is what
   the executor will actually see. If the uncommitted lines are committed or discarded
   before execution, re-read the file and re-anchor on the `.praxis-projects.json` line.

Every other file the plan cites — `src/lib/projects.ts`, `src/lib/projects.test.ts`,
`src/lib/skill-content-fetch.ts`, `electron/main.cts`, `electron/tsconfig.json`,
`electron/agentic-tools-ipc-handlers.cts`, `src/public/styles.css` and `README.md` — matched
the plan's description at authoring time.
