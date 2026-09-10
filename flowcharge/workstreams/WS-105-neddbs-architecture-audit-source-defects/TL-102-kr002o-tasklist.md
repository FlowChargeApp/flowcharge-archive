---
id: TL-102-kr002o
type: tasklist
workstream: WS-105-neddbs
slug: architecture-audit-source-defects
title: "Source defects found while auditing ARCHITECTURE.md"
status: ready
created: 2026-09-10
updated: 2026-09-10
author: Anthony Koukoullis
depends_on: [IL-15-mza9eb]
links: []
mode: diff
base_commit: f0b0a8c
---

# FlowCharge Tasks

## Architecture audit source defects

IL-15-mza9eb holds four unrelated defects found while auditing `ARCHITECTURE.md`
against the source. They share no root cause and no target file, and none blocks
another.

- ISS-28-uphhhu adds the two missing state-file entries to `.gitignore`.
- ISS-29-m7w4dm gives the two outbound release-host fetches an abort timeout, so a
  stalled host can no longer hang a request forever. The pattern already exists in
  `src/lib/telemetry.ts` and `src/lib/update-check.ts`: a module-level
  `DEFAULT_TIMEOUT_MS` and `signal: AbortSignal.timeout(...)`. `AbortSignal.timeout`
  is a Node built-in, so the zero-runtime-dependency rule holds.
- ISS-30-a05gs5 removes the one `console.*` call under `src/lib/`, so one failure
  produces one report instead of two.
- ISS-31-t8rpze corrects two module header comments that under-count the IPC surface.

Every task carries one literal SEARCH/REPLACE block, copied from the file as read at
`f0b0a8c`. Each `verify` count below was measured at `f0b0a8c` before it was written
down.

- [x] 1. Add the two missing state files to `.gitignore` (ISS-28-uphhhu)
  ```yaml
  description: "List .praxis-installs.json and .praxis-telemetry.json in .gitignore, beside the two entries already there."
  author: Anthony Koukoullis
  issues: [ISS-28-uphhhu]
  implement:
    - |
      .gitignore
      <<<<<<< SEARCH
      .praxis-projects.json
      .praxis-update.json
      =======
      .praxis-projects.json
      .praxis-update.json
      .praxis-installs.json
      .praxis-telemetry.json
      >>>>>>> REPLACE
  pattern: ".gitignore only. No source file changes."
  imports: "None."
  compatibility: "The two new lines take the same bare-filename form as the two above them, so they match the file at any depth, exactly as the existing entries do."
  gotcha: "Do not delete or reorder the existing entries. If either file is already tracked in git, adding the ignore line alone does not untrack it — that is out of scope here and neither file is tracked at f0b0a8c."
  verify:
    - "Run `grep -c '^\\.praxis-' .gitignore`. It must print 4. At f0b0a8c it printed 2."
    - "Run `git check-ignore -v .praxis-installs.json` and then `git check-ignore -v .praxis-telemetry.json`. Each must exit 0 and name .gitignore. At f0b0a8c each exited 1 and printed nothing."
  checklist:
    - "Does .gitignore now list all four .praxis-*.json state files?"
    - "Are the two pre-existing entries unchanged and still in place?"
    - "Does `git check-ignore` report both new files as ignored?"
    - "Did no file other than .gitignore change?"
  self_eval:
    passed: true
    failures: []
  ```

- [x] 2. Give both outbound release-host fetches an abort timeout (ISS-29-m7w4dm)

  ```yaml
  description: "Add a module-level DEFAULT_TIMEOUT_MS and an AbortSignal.timeout signal to the release-list fetch and the asset-download fetch, following the pattern in src/lib/telemetry.ts and src/lib/update-check.ts."
  ```

  - [x] 2.1 Declare `DEFAULT_TIMEOUT_MS` in `src/lib/skill-release-fetch.ts`
    ```yaml
    description: "Add the module-level timeout constant beside the existing MAX_BODY_BYTES ceiling."
    author: Anthony Koukoullis
    issues: [ISS-29-m7w4dm]
    implement:
      - |
        src/lib/skill-release-fetch.ts
        <<<<<<< SEARCH
        // Ceiling on the release-list response body. A release list is a few
        // kilobytes of JSON; this is generous headroom against a hostile or broken
        // response, not a tuning value.
        const MAX_BODY_BYTES = 4 * 1024 * 1024;
        =======
        // Ceiling on the release-list response body. A release list is a few
        // kilobytes of JSON; this is generous headroom against a hostile or broken
        // response, not a tuning value.
        const MAX_BODY_BYTES = 4 * 1024 * 1024;

        // Ceiling on the whole release-list request, headers and body. Without it a
        // host that accepts the connection and never answers leaves the request
        // hanging forever. Same value as src/lib/update-check.ts uses for its own
        // release-metadata call.
        const DEFAULT_TIMEOUT_MS = 10000;
        >>>>>>> REPLACE
    pattern: "src/lib/skill-release-fetch.ts, module scope, immediately after MAX_BODY_BYTES."
    imports: "None. AbortSignal is a Node built-in and needs no import."
    compatibility: "A plain module-level const, matching src/lib/telemetry.ts and src/lib/update-check.ts. Do not export it and do not add a timeout parameter to any exported function — no caller needs one."
    gotcha: "This module holds no host constant and imports nothing from src/lib/skill-content-fetch.ts. Add no import here, or the no-import-cycle rule stated in the file header breaks."
    verify:
      - "Run `grep -c 'const DEFAULT_TIMEOUT_MS' src/lib/skill-release-fetch.ts`. It must print 1. At f0b0a8c it printed 0."
      - "Run `npx tsc --noEmit -p tsconfig.json`. It must exit 0. This step is a regression guard: it also exited 0 at f0b0a8c, so the grep above is the discriminating step."
    checklist:
      - "Is DEFAULT_TIMEOUT_MS declared at module scope in this file?"
      - "Is the constant unexported and left as a plain const?"
      - "Was MAX_BODY_BYTES left unchanged?"
      - "Were no import statements added to this file?"
      - "Does the Node type-check still exit 0?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.2 Pass the abort signal in `fetchReleases`
    ```yaml
    description: "Give the release-list fetch a signal built from DEFAULT_TIMEOUT_MS."
    author: Anthony Koukoullis
    issues: [ISS-29-m7w4dm]
    implement:
      - |
        src/lib/skill-release-fetch.ts
        <<<<<<< SEARCH
            const res = await fetch(releasesApiUrl(baseUrl), {
              // No token, no credential, no cookie.
              headers: { Accept: 'application/json', 'User-Agent': 'FlowCharge' },
            });
        =======
            const res = await fetch(releasesApiUrl(baseUrl), {
              // No token, no credential, no cookie.
              headers: { Accept: 'application/json', 'User-Agent': 'FlowCharge' },
              signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
            });
        >>>>>>> REPLACE
    pattern: "src/lib/skill-release-fetch.ts, inside fetchReleases (line 143 at f0b0a8c)."
    imports: "None. Requires task 2.1 to have run first, because it uses DEFAULT_TIMEOUT_MS."
    compatibility: "fetchReleases keeps its single baseUrl parameter and its Promise<SkillReleaseSummary[]> return type, so no caller changes."
    gotcha: "The existing catch already handles the timeout — it is one unconditional `catch { return []; }`, so the TimeoutError DOMException cannot escape it. Do not add an instanceof filter, and do not change the catch (see Divergence 1). The signal stays armed while readCappedBody streams the body, so the value caps the whole call, not only the headers."
    verify:
      - "Run `grep -c 'signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)' src/lib/skill-release-fetch.ts`. It must print 1. At f0b0a8c it printed 0."
      - "Run `npx tsc --noEmit -p tsconfig.json`. It must exit 0."
      - "Run `npm run build`, then `node --test --test-force-exit dist/test/unit/skill-release-fetch.test.js`. It must report 12 pass and 0 fail, the same counts it reported at f0b0a8c. This suite is offline by design and touches no network."
    checklist:
      - "Does the fetch options object now carry a signal key?"
      - "Is the signal built with AbortSignal.timeout and the module constant, not a literal?"
      - "Were the headers and the surrounding comment left unchanged?"
      - "Is the catch clause still one unconditional catch, unmodified?"
      - "Do the 12 offline unit tests still pass?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.3 Declare `DEFAULT_TIMEOUT_MS` in `src/lib/skill-content-fetch.ts`
    ```yaml
    description: "Add the module-level timeout constant beside the existing MAX_ARCHIVE_BYTES ceiling."
    author: Anthony Koukoullis
    issues: [ISS-29-m7w4dm]
    implement:
      - |
        src/lib/skill-content-fetch.ts
        <<<<<<< SEARCH
        const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024; // compressed bytes, as received
        =======
        const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024; // compressed bytes, as received

        // Ceiling on the whole asset download, headers and body. The signal stays
        // armed while the body streams, so this budgets the entire transfer rather
        // than only the response headers — which is why it is longer than the
        // metadata-only call in src/lib/update-check.ts uses.
        const DEFAULT_TIMEOUT_MS = 30000;
        >>>>>>> REPLACE
    pattern: "src/lib/skill-content-fetch.ts, module scope, immediately after MAX_ARCHIVE_BYTES."
    imports: "None. AbortSignal is a Node built-in and needs no import."
    compatibility: "A plain module-level const, matching src/lib/telemetry.ts and src/lib/update-check.ts. Do not export it and do not add a timeout parameter to getInstallContent — no caller needs one."
    gotcha: "Every filesystem call in this module goes through the injected ArchiveFsAccess port and no filesystem module is imported here. Add no import."
    verify:
      - "Run `grep -c 'const DEFAULT_TIMEOUT_MS' src/lib/skill-content-fetch.ts`. It must print 1. At f0b0a8c it printed 0."
      - "Run `npx tsc --noEmit -p tsconfig.json`. It must exit 0. This step is a regression guard: it also exited 0 at f0b0a8c, so the grep above is the discriminating step."
    checklist:
      - "Is DEFAULT_TIMEOUT_MS declared at module scope in this file?"
      - "Is the constant unexported and left as a plain const?"
      - "Was MAX_ARCHIVE_BYTES left unchanged, comment included?"
      - "Were no import statements added to this file?"
      - "Does the Node type-check still exit 0?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.4 Pass the abort signal on the asset download in `getInstallContent`
    ```yaml
    description: "Give the release asset download a signal built from DEFAULT_TIMEOUT_MS."
    author: Anthony Koukoullis
    issues: [ISS-29-m7w4dm]
    implement:
      - |
        src/lib/skill-content-fetch.ts
        <<<<<<< SEARCH
            const assetUrl = buildAssetDownloadUrl(PRAXIS_REPO_BASE_URL, latest.tag, latest.assetName);
            const res = await fetch(assetUrl);
        =======
            const assetUrl = buildAssetDownloadUrl(PRAXIS_REPO_BASE_URL, latest.tag, latest.assetName);
            const res = await fetch(assetUrl, { signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS) });
        >>>>>>> REPLACE
    pattern: "src/lib/skill-content-fetch.ts, inside getInstallContent's DOWNLOAD step (line 289 at f0b0a8c)."
    imports: "None. Requires task 2.3 to have run first, because it uses DEFAULT_TIMEOUT_MS."
    compatibility: "getInstallContent keeps its (_toolId, deps) signature and its Promise<InstallContent> return type, so neither src/http/routes-integrations.ts nor any test caller changes."
    gotcha: "A timeout rejects with a TimeoutError DOMException. The function's catch is unconditional and re-throws untouched, so the DOMException reaches src/http/routes-integrations.ts, whose errorMessage helper treats it as an Error and puts its message in the 500 body. Do not add an instanceof filter and do not change the catch (see Divergence 1). The download precedes the temporary-file write, so an aborted download leaves no file behind."
    verify:
      - "Run `grep -c 'await fetch(assetUrl, { signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS) })' src/lib/skill-content-fetch.ts`. It must print 1. At f0b0a8c it printed 0."
      - "Run `grep -c 'const res = await fetch(assetUrl);' src/lib/skill-content-fetch.ts`. It must print 0. At f0b0a8c it printed 1."
      - "Run `npx tsc --noEmit -p tsconfig.json`. It must exit 0."
    checklist:
      - "Does the asset fetch now pass an options object carrying a signal?"
      - "Is the signal built with AbortSignal.timeout and the module constant, not a literal?"
      - "Was the assetUrl line left unchanged?"
      - "Is the catch clause still unconditional and still re-throwing?"
      - "Does the Node type-check still exit 0?"
    self_eval:
      passed: true
      failures: []
    ```

- [ ] 3. Remove the one `console.*` call under `src/lib/` (ISS-30-a05gs5)
  ```yaml
  description: "Delete the console.error line in getInstallContent's catch, keep the re-throw, and let the route boundary own the single failure report."
  author: Anthony Koukoullis
  issues: [ISS-30-a05gs5]
  implement:
    - |
      src/lib/skill-content-fetch.ts
      <<<<<<< SEARCH
        } catch (err) {
          // One line, carrying the thrown message. This module is loaded by both the
          // HTTP server and the Electron main process, so the single line covers
          // both transports. The error is re-thrown untouched: the caller turns it
          // into the failure the user actually reads.
          console.error(`FlowCharge Core skill install failed: ${(err as Error).message}`);
          throw err;
        }
      =======
        } catch (err) {
          // Nothing is logged here. This module reports no wording of its own, the
          // same rule src/lib/tree-layout.ts, src/lib/workstream-store.ts and
          // src/lib/git.ts state in their own headers. The error is re-thrown
          // untouched and the route boundary that called it owns the one failure
          // report the user reads.
          throw err;
        }
      >>>>>>> REPLACE
  pattern: "src/lib/skill-content-fetch.ts, getInstallContent's catch clause (console.error at line 330 at f0b0a8c)."
  imports: "None."
  compatibility: "getInstallContent still throws on every failure path, so src/http/routes-integrations.ts keeps answering 500 with errorMessage(err) and the Electron transport keeps its own handling. No caller changes."
  gotcha: "Keep the `throw err;` line. Removing the log must not swallow the failure. Keep the try/catch frame too: this is a one-line removal, and deleting the frame would re-indent the whole function body and invalidate the blocks in tasks 2.3 and 2.4 against this same file."
  verify:
    - "Run `grep -rn 'console\\.' src/lib | wc -l`. It must print 0. At f0b0a8c it printed 1, the console.error at src/lib/skill-content-fetch.ts:330."
    - "Run `grep -c 'throw err;' src/lib/skill-content-fetch.ts`. It must print 1, the same count as at f0b0a8c, proving the re-throw survived."
    - "Run `npx tsc --noEmit -p tsconfig.json`. It must exit 0."
  checklist:
    - "Is the console.error line gone from this file?"
    - "Does `grep -rn 'console\\.' src/lib` now match nothing at all?"
    - "Is `throw err;` still present inside the catch clause?"
    - "Is the try/catch frame intact, with the function body indentation unchanged?"
    - "Does the Node type-check still exit 0?"
  self_eval:
    passed: false
    failures: []
  ```

- [ ] 4. Correct the two header comments that under-count the IPC surface (ISS-31-t8rpze)

  ```yaml
  description: "Both headers say six. The PraxisAPI interface at src/public/ipc-adapter.ts:30-39 declares eight members. Comments only, no runtime change."
  ```

  - [ ] 4.1 Correct the header in `src/public/ipc-adapter.ts`
    ```yaml
    description: "State the eight-channel surface size that PraxisAPI actually declares."
    author: Anthony Koukoullis
    issues: [ISS-31-t8rpze]
    implement:
      - |
        src/public/ipc-adapter.ts
        <<<<<<< SEARCH
        // Shared renderer-side adapter for window.praxisAPI, the six-channel IPC
        // surface electron/preload.cts exposes via contextBridge. This file is an ES
        =======
        // Shared renderer-side adapter for window.praxisAPI, the eight-channel IPC
        // surface electron/preload.cts exposes via contextBridge. This file is an ES
        >>>>>>> REPLACE
    pattern: "src/public/ipc-adapter.ts line 1, the first line of the module header comment."
    imports: "None. Comment text only."
    compatibility: "This file compiles under src/public/tsconfig.json, which sets \"types\": []. The change is a comment, so it adds no identifier and no Node global."
    gotcha: "Eight is the count PraxisAPI declares: listProjects, addProject, renameProject, removeProject, getProjectData, getWorkstreamDetail, getAppVersion and the optional pickProjectFolder. Change nothing else on the line and change no interface member."
    verify:
      - "Run `grep -c 'six-channel' src/public/ipc-adapter.ts`. It must print 0. At f0b0a8c it printed 1."
      - "Run `grep -c 'eight-channel' src/public/ipc-adapter.ts`. It must print 1. At f0b0a8c it printed 0."
      - "Run `npx tsc --noEmit -p src/public/tsconfig.json`. It must exit 0."
    checklist:
      - "Does the header now say eight-channel?"
      - "Is the word six-channel gone from the file?"
      - "Is the PraxisAPI interface untouched?"
      - "Does the browser type-check still exit 0?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 4.2 Correct the header in `src/public/browser-ipc-shim.ts`
    ```yaml
    description: "State that the shim implements seven of PraxisAPI's eight members, omitting the optional Electron-only pickProjectFolder."
    author: Anthony Koukoullis
    issues: [ISS-31-t8rpze]
    implement:
      - |
        src/public/browser-ipc-shim.ts
        <<<<<<< SEARCH
        // server has no such global. This file defines the same six-method surface,
        // backed by fetch() against the existing /api/* routes, but installs itself
        =======
        // server has no such global. This file defines seven of that eight-member
        // surface's methods — all but the optional, Electron-only pickProjectFolder —
        // backed by fetch() against the existing /api/* routes, but installs itself
        >>>>>>> REPLACE
    pattern: "src/public/browser-ipc-shim.ts line 4, inside the module header comment."
    imports: "None. Comment text only."
    compatibility: "This file compiles under src/public/tsconfig.json, which sets \"types\": []. The change is a comment, so it adds no identifier and no Node global."
    gotcha: "The shim genuinely omits pickProjectFolder, which is optional because it is Electron-only, so the correct wording is seven of eight, not eight. Leave the second header paragraph about praxisSkillInstallAPI alone — it counts a different surface."
    verify:
      - "Run `grep -c 'six-method' src/public/browser-ipc-shim.ts`. It must print 0. At f0b0a8c it printed 1."
      - "Run `grep -c 'eight-member' src/public/browser-ipc-shim.ts`. It must print 1. At f0b0a8c it printed 0."
      - "Run `npx tsc --noEmit -p src/public/tsconfig.json`. It must exit 0."
    checklist:
      - "Does the header now state seven of eight members?"
      - "Is the word six-method gone from the file?"
      - "Is pickProjectFolder named as the omitted member?"
      - "Was the praxisSkillInstallAPI paragraph left unchanged?"
      - "Does the browser type-check still exit 0?"
    self_eval:
      passed: false
      failures: []
    ```

## Divergences

1. **Neither catch clause needs correcting — an author-side observation, not a
   divergence from the issue.** ISS-29-m7w4dm asks for no catch change. It only
   observes that the comment at `src/lib/skill-release-fetch.ts:138-140` discusses a
   DOMException. The author checked both catch clauses anyway, because an
   `instanceof`-filtered catch could narrow the set of rejections it catches.
   Both were already unconditional as read at `f0b0a8c`. `fetchReleases` at
   `src/lib/skill-release-fetch.ts:141-155`
   wraps its whole body in one unconditional `catch { return []; }`, and its header at
   lines 135-140 records that choice for exactly this reason. `getInstallContent` at
   `src/lib/skill-content-fetch.ts:325-333` uses `catch (err)` with no `instanceof`
   filter and re-throws. Neither is `instanceof`-filtered, so a `TimeoutError`
   DOMException cannot escape either one. Consequence: tasks 2.2 and 2.4 change only
   the fetch call, and both forbid touching the catch.
