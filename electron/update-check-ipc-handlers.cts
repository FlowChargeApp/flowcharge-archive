// Main-process IPC bridge for the update check. This file owns the whole
// policy — enabled, due, newer, not already dismissed — and answers four
// channels with either a small notice object or nothing at all. The renderer
// never makes the network call, never sees a URL it can act on, and never
// learns the policy.
//
// It delegates the two halves of the work: src/lib/update-check.ts asks
// GitHub for the latest release and compares versions, src/lib/update-prefs.ts
// reads and writes .praxis-update.json. This file adds the scheduling, the
// failure back-off, the dismissal check and the outbound-URL guard.
//
// No channel takes an argument. The URL to open and the version to dismiss are
// both held in this module's own state, taken from the response this process
// itself received — the same rule electron/agentic-tools-ipc-handlers.cts
// already states for permitted roots: derived here, never taken from the
// renderer.
//
// This file must never import — VALUE *or* TYPE — anything from src/lib/*.ts
// at the top level, for the two reasons the header of
// electron/agentic-tools-ipc-handlers.cts sets out at length: a .cts file
// compiles to CommonJS and cannot require() the ESM output in dist/lib, and
// this project's narrow rootDir cannot reach the src tree even for an
// `import type`. So the types below are hand-mirrored local declarations and
// the values arrive through the same `new Function` dynamic-import shim.

import { app, ipcMain, shell } from 'electron';

// --- Locally-mirrored types (see file-header comment for why these can't be
// `import type`-ed from src/lib/update-check.ts and src/lib/update-prefs.ts).
// Keep them in sync by hand: there is no compiler check tying the two
// together, by construction of this file's rootDir boundary. ---

interface LatestRelease {
  version: string;
  releaseUrl: string | null;
}

interface UpdatePrefs {
  enabled: boolean;
  lastCheckedAt: string | null;
  dismissedVersion: string | null;
}

type IsReleaseRepoConfiguredFn = () => boolean;
type FetchLatestReleaseFn = (timeoutMs?: number) => Promise<LatestRelease | null>;
type IsNewerFn = (candidate: string, running: string) => boolean;
type ReadUpdatePrefsFn = () => UpdatePrefs;
type WriteUpdatePrefsFn = (prefs: UpdatePrefs) => void;

// What one answered getUpdateNotice call tells the renderer, and the whole of
// it. hasReleaseUrl says whether "View release" can do anything; the URL
// itself never crosses the bridge.
export interface UpdateNotice {
  version: string;
  hasReleaseUrl: boolean;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

const dynamicImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string
) => Promise<unknown>;

// Populated once, before any channel is registered, by the dynamic
// import resolution in registerUpdateCheckIpcHandlers below. The "!"
// definite-assignment assertions are safe for the same reason they are in
// electron/agentic-tools-ipc-handlers.cts: every handler callback only runs
// after that function's awaits have resolved and assigned these.
let isReleaseRepoConfigured!: IsReleaseRepoConfiguredFn;
let fetchLatestRelease!: FetchLatestReleaseFn;
let isNewer!: IsNewerFn;
let readUpdatePrefs!: ReadUpdatePrefsFn;
let writeUpdatePrefs!: WriteUpdatePrefsFn;

// The last successful release record this session saw. Deliberately in-memory
// only: it is lost on quit, and nothing persists a URL. A not-due call still
// answers from this, so navigating from the home page to a board keeps the
// banner instead of losing it until tomorrow.
let lastKnownLatest: LatestRelease | null = null;

// Epoch milliseconds. After a failed check, no further request is attempted
// before this floor, so a broken network cannot turn every page load into a
// request. In-memory only, and cleared by the next success.
let retryNotBefore = 0;

// The unconfigured-repository warning is worth saying once while developing
// and worth saying only once: this module is asked on every page load.
let warnedUnconfigured = false;

// True when the last recorded check is absent or older than a day, and the
// failure back-off floor has passed. An unparseable timestamp counts as due —
// a preferences file we cannot read must not freeze checking forever.
function isCheckDue(lastCheckedAt: string | null): boolean {
  if (Date.now() < retryNotBefore) return false;
  if (lastCheckedAt === null) return true;
  const last = Date.parse(lastCheckedAt);
  if (Number.isNaN(last)) return true;
  return Date.now() - last >= ONE_DAY_MS;
}

// The one place an outbound URL is allowed to leave this process, and it
// accepts only an https: URL on github.com. The URL never came from the
// renderer, but it did come from a network response, so it is checked here
// rather than trusted. Anything else is a silent no-op: this feature's every
// failure mode is "nothing happens".
function isOpenableReleaseUrl(raw: string | null): boolean {
  if (raw === null) return false;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  return parsed.protocol === 'https:' && parsed.host === 'github.com';
}

export async function registerUpdateCheckIpcHandlers(): Promise<void> {
  // Specifiers below are relative to this file's *compiled* location
  // (dist/electron/update-check-ipc-handlers.cjs), which is how Node resolves
  // a relative dynamic import() specifier from a CommonJS module — NOT
  // relative to this .cts source file. dist/lib/*.js is where the root
  // tsconfig.json (rootDir "src", outDir "dist") emits src/lib/*.ts as ESM.
  const updateCheckModule = (await dynamicImport('../lib/update-check.js')) as {
    isReleaseRepoConfigured: IsReleaseRepoConfiguredFn;
    fetchLatestRelease: FetchLatestReleaseFn;
    isNewer: IsNewerFn;
  };
  const updatePrefsModule = (await dynamicImport('../lib/update-prefs.js')) as {
    readUpdatePrefs: ReadUpdatePrefsFn;
    writeUpdatePrefs: WriteUpdatePrefsFn;
  };

  isReleaseRepoConfigured = updateCheckModule.isReleaseRepoConfigured;
  fetchLatestRelease = updateCheckModule.fetchLatestRelease;
  isNewer = updateCheckModule.isNewer;
  readUpdatePrefs = updatePrefsModule.readUpdatePrefs;
  writeUpdatePrefs = updatePrefsModule.writeUpdatePrefs;

  // Answers a raw UpdateNotice or null, not a PraxisIpcResult envelope, for
  // the reason pickProjectFolder (electron/ipc-handlers.cts:105-108) does the
  // same: there is no status for the renderer to report, because every
  // unhappy outcome is simply "no banner".
  //
  // The callback takes zero parameters, not even the IpcMainInvokeEvent, so
  // there is nothing for the renderer to pass and nothing for this process to
  // trust.
  ipcMain.handle('getUpdateNotice', async (): Promise<UpdateNotice | null> => {
    // 1. The user turned checks off.
    const prefs = readUpdatePrefs();
    if (prefs.enabled === false) return null;

    // 2. The distribution repository constants still hold their placeholders,
    //    so the feature is inert by construction.
    if (isReleaseRepoConfigured() === false) {
      if (!warnedUnconfigured) {
        warnedUnconfigured = true;
        console.warn(
          'Update checks are inert: the release repository constants in src/lib/update-check.ts still hold their placeholders.'
        );
      }
      return null;
    }

    // 3. Is a check due? When it is not, skip the network entirely and answer
    //    from lastKnownLatest below.
    if (isCheckDue(prefs.lastCheckedAt)) {
      // 4. Due: ask. A null answer costs one hour of back-off and leaves
      //    lastCheckedAt untouched, so a failure never counts as a check.
      const latest = await fetchLatestRelease();
      if (latest === null) {
        retryNotBefore = Date.now() + ONE_HOUR_MS;
        return null;
      }

      // 5. Success: remember it, clear the back-off, and record the check.
      lastKnownLatest = latest;
      retryNotBefore = 0;
      writeUpdatePrefs({ ...prefs, lastCheckedAt: new Date().toISOString() });
    }

    // 6. Nothing known yet, or the published release is not newer than the
    //    running one.
    if (lastKnownLatest === null) return null;
    if (isNewer(lastKnownLatest.version, app.getVersion()) === false) return null;

    // 7. The user already dismissed exactly this version.
    if (prefs.dismissedVersion === lastKnownLatest.version) return null;

    // 8. Show it.
    return { version: lastKnownLatest.version, hasReleaseUrl: lastKnownLatest.releaseUrl !== null };
  });

  // The version dismissed is the one this process last fetched, never a value
  // the renderer names. Read-modify-write through the preferences library, so
  // the other two fields survive.
  ipcMain.handle('dismissUpdate', async (): Promise<void> => {
    if (lastKnownLatest === null) return;
    const prefs = readUpdatePrefs();
    writeUpdatePrefs({ ...prefs, dismissedVersion: lastKnownLatest.version });
  });

  // The banner's "Turn off update checks" button, which is the only in-app off
  // switch. README.md documents .praxis-update.json as the way to set this
  // back to true by hand.
  ipcMain.handle('disableUpdateChecks', async (): Promise<void> => {
    const prefs = readUpdatePrefs();
    writeUpdatePrefs({ ...prefs, enabled: false });
  });

  // Opens the release page in the user's browser, and only when the URL this
  // process itself received passes the https://github.com guard above.
  ipcMain.handle('openReleasePage', async (): Promise<void> => {
    if (lastKnownLatest === null) return;
    const url = lastKnownLatest.releaseUrl;
    if (url === null || !isOpenableReleaseUrl(url)) return;
    await shell.openExternal(url);
  });
}
