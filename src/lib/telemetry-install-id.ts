// Telemetry install-ID library: owns .praxis-telemetry.json and nothing else.
// It knows the file name, the file's shape and the atomic-write technique, and
// it mirrors src/lib/update-prefs.ts in that every failure returns a usable
// value rather than throwing.
//
// It must NOT know the analytics vendor, its endpoint, HTTP, the app key, or
// the opt-out environment variable — src/lib/telemetry.ts owns every one of
// those — and it must not know where dataDir came from. Unlike
// src/lib/update-prefs.ts, the directory arrives as an argument: this module
// reads no environment variable at any scope. None of those names appears
// anywhere in this file, deliberately.

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const FILE_NAME = '.praxis-telemetry.json';

export interface InstallIdResult {
  installId: string; // a UUID from node:crypto randomUUID()
  persisted: boolean; // false when the file could not be written
}

// Returns the install ID recorded in <dataDir>/.praxis-telemetry.json, creating
// it on the first run. An absent file, an unreadable file, unparseable JSON, a
// non-object body, or a missing or non-string installId all fall through to a
// fresh UUID and an attempted rewrite. A failed write still returns a usable id
// with persisted false — the run is counted, at the cost of that install being
// counted more than once. Nothing here ever throws.
export function readOrCreateInstallId(dataDir: string): InstallIdResult {
  const filePath = path.join(dataDir, FILE_NAME);

  let raw: string | null = null;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    raw = null;
  }

  if (raw !== null) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = undefined;
    }

    // A JSON file holding `null` parses successfully but is not an object, so
    // the type check must reject a non-object before it reads any field, the
    // way src/lib/update-prefs.ts:60-62 does.
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      if (typeof record.installId === 'string' && record.installId !== '') {
        return { installId: record.installId, persisted: true };
      }
    }
  }

  const installId = randomUUID();

  // The temporary file must be a sibling, because fs.renameSync is atomic only
  // within one filesystem. Same technique as src/lib/update-prefs.ts:78-82.
  try {
    const tmpPath = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, `${JSON.stringify({ installId }, null, 2)}\n`);
    fs.renameSync(tmpPath, filePath);
  } catch {
    return { installId, persisted: false };
  }

  return { installId, persisted: true };
}
