// Update preferences library: owns .praxis-update.json and nothing else. Its
// directory defaults to the repo root but can be overridden via PRAXIS_DATA_DIR
// (set by electron/main.cts when packaged, since app.asar is read-only). Knows
// the preferences file and its shape; knows nothing about HTTP, releases,
// versions, Electron, or the banner.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// This file compiles to dist/lib/update-prefs.js, so two levels up is the repo
// root. The preferences file lives there in an unpackaged run.
const repoRoot = path.join(__dirname, '..', '..');
// electron/main.cts sets PRAXIS_DATA_DIR only when app.isPackaged, so its mere
// presence doubles as the "are we running from a packaged app.asar" signal
// without this file importing 'electron' or knowing anything about packaging
// beyond one env var. Unset in dev, a plain browser tab, and `npm run
// electron:dev`, so dataDir falls back to repoRoot.
const dataDir = process.env.PRAXIS_DATA_DIR || repoRoot;
const prefsPath = path.join(dataDir, '.praxis-update.json');

export interface UpdatePrefs {
  // false only after the user turns checks off.
  enabled: boolean;
  // ISO 8601, null until the first successful check.
  lastCheckedAt: string | null;
  // The version the user dismissed.
  dismissedVersion: string | null;
}

const DEFAULTS: UpdatePrefs = {
  enabled: true,
  lastCheckedAt: null,
  dismissedVersion: null,
};

// A corrupted preferences file costs the user a preference, never the app: every
// failure mode returns the defaults rather than throwing, mirroring readProjects
// in src/lib/projects.ts. Each field is validated on its own, so one bad field
// does not discard the others. An absent file is a valid state and is never
// created here — only writeUpdatePrefs writes.
export function readUpdatePrefs(): UpdatePrefs {
  let raw: string;
  try {
    raw = fs.readFileSync(prefsPath, 'utf8');
  } catch {
    return { ...DEFAULTS };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULTS };
  }

  // A JSON file holding `null` parses successfully but is not an object, so the
  // type check must reject a non-object before it reads any field.
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ...DEFAULTS };
  }

  const record = parsed as Record<string, unknown>;
  return {
    enabled: typeof record.enabled === 'boolean' ? record.enabled : DEFAULTS.enabled,
    lastCheckedAt: typeof record.lastCheckedAt === 'string' ? record.lastCheckedAt : DEFAULTS.lastCheckedAt,
    dismissedVersion:
      typeof record.dismissedVersion === 'string' ? record.dismissedVersion : DEFAULTS.dismissedVersion,
  };
}

// The one writer for the preferences file. Every write goes to a sibling
// temporary file first and is then renamed over prefsPath, for the reason
// src/lib/projects.ts:44-56 documents: fs.writeFileSync truncates the target
// before it writes, and the temporary file must be a sibling because
// fs.renameSync is atomic only within one filesystem.
export function writeUpdatePrefs(prefs: UpdatePrefs): void {
  const tmpPath = `${prefsPath}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(prefs, null, 2));
  fs.renameSync(tmpPath, prefsPath);
}
