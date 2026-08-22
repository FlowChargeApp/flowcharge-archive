// Unit tests for update-prefs.ts. prefsPath is derived from
// process.env.PRAXIS_DATA_DIR once at module top-level, so ESM module caching
// means a test that changes the env var after import still sees the old value —
// the same problem src/lib/projects.test.ts solves. Every case below therefore
// drives the compiled module from a fresh child process with PRAXIS_DATA_DIR
// pointed at a temporary directory, which also keeps every write away from the
// real repo root.
//
// Run with `node --test dist/lib/update-prefs.test.js` after `npm run build`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prefsJsPath = path.join(__dirname, 'update-prefs.js');

// Drives the compiled module from a child process: imports it with
// PRAXIS_DATA_DIR already set in the environment (so the module's top-level
// consts observe it), runs `body` with the module bound to `mod`, and prints the
// body's return value as JSON so the parent process can assert on it. The import
// specifier is an absolute path, so the child's cwd never matters.
function runInChildProcess(dataDir: string, body: string): unknown {
  const driver = `
    import(${JSON.stringify(prefsJsPath)}).then(async (mod) => {
      const result = await (async () => { ${body} })();
      console.log(JSON.stringify(result));
    });
  `;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', driver], {
    env: { ...process.env, PRAXIS_DATA_DIR: dataDir },
    encoding: 'utf8',
  });
  return JSON.parse(output.trim());
}

// Every test runs against its own temporary directory and removes it afterwards.
function withTempDir(fn: (dataDir: string) => void): void {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'praxis-update-prefs-test-'));
  try {
    fn(tmpDir);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

const DEFAULTS = { enabled: true, lastCheckedAt: null, dismissedVersion: null };

test('an absent file yields the defaults and is not created on read', () => {
  withTempDir((dataDir) => {
    const prefs = runInChildProcess(dataDir, 'return mod.readUpdatePrefs();');
    assert.deepEqual(prefs, DEFAULTS);
    assert.equal(
      fs.existsSync(path.join(dataDir, '.praxis-update.json')),
      false,
      'readUpdatePrefs must not create the file'
    );
  });
});

test('an unparseable file yields the defaults without throwing', () => {
  withTempDir((dataDir) => {
    fs.writeFileSync(path.join(dataDir, '.praxis-update.json'), '{ not json at all');
    const prefs = runInChildProcess(dataDir, 'return mod.readUpdatePrefs();');
    assert.deepEqual(prefs, DEFAULTS);
  });
});

test('a non-object payload yields the defaults', () => {
  withTempDir((dataDir) => {
    fs.writeFileSync(path.join(dataDir, '.praxis-update.json'), 'null');
    assert.deepEqual(runInChildProcess(dataDir, 'return mod.readUpdatePrefs();'), DEFAULTS);
  });
  withTempDir((dataDir) => {
    fs.writeFileSync(path.join(dataDir, '.praxis-update.json'), '[1, 2, 3]');
    assert.deepEqual(runInChildProcess(dataDir, 'return mod.readUpdatePrefs();'), DEFAULTS);
  });
});

test('one bad field falls back on its own and the other two survive', () => {
  withTempDir((dataDir) => {
    fs.writeFileSync(
      path.join(dataDir, '.praxis-update.json'),
      JSON.stringify({ enabled: 7, lastCheckedAt: '2026-08-22T00:00:00.000Z', dismissedVersion: '2.0.0' })
    );
    assert.deepEqual(runInChildProcess(dataDir, 'return mod.readUpdatePrefs();'), {
      enabled: true,
      lastCheckedAt: '2026-08-22T00:00:00.000Z',
      dismissedVersion: '2.0.0',
    });
  });
  withTempDir((dataDir) => {
    fs.writeFileSync(
      path.join(dataDir, '.praxis-update.json'),
      JSON.stringify({ enabled: false, lastCheckedAt: 12345, dismissedVersion: '2.0.0' })
    );
    assert.deepEqual(runInChildProcess(dataDir, 'return mod.readUpdatePrefs();'), {
      enabled: false,
      lastCheckedAt: null,
      dismissedVersion: '2.0.0',
    });
  });
});

test('write then read round trips every field', () => {
  withTempDir((dataDir) => {
    const written = { enabled: false, lastCheckedAt: '2026-08-22T12:34:56.000Z', dismissedVersion: '3.1.4' };
    const readBack = runInChildProcess(
      dataDir,
      `mod.writeUpdatePrefs(${JSON.stringify(written)}); return mod.readUpdatePrefs();`
    );
    assert.deepEqual(readBack, written);
  });
});

test('PRAXIS_DATA_DIR redirects the write into the temp directory, not the repo root', () => {
  withTempDir((dataDir) => {
    const repoRoot = path.join(__dirname, '..', '..');
    runInChildProcess(
      dataDir,
      'mod.writeUpdatePrefs({ enabled: false, lastCheckedAt: null, dismissedVersion: null }); return null;'
    );
    const overriddenPath = path.join(dataDir, '.praxis-update.json');
    assert.ok(
      fs.existsSync(overriddenPath),
      `.praxis-update.json must be created inside PRAXIS_DATA_DIR (${dataDir}), not at the real repo root`
    );
    assert.equal(
      fs.existsSync(path.join(repoRoot, '.praxis-update.json')),
      false,
      'no preferences file may be left at the repo root'
    );
    assert.deepEqual(JSON.parse(fs.readFileSync(overriddenPath, 'utf8')), {
      enabled: false,
      lastCheckedAt: null,
      dismissedVersion: null,
    });
    // No temporary file may survive the atomic rename.
    assert.deepEqual(
      fs.readdirSync(dataDir).filter((name) => name.endsWith('.tmp')),
      [],
      'writeUpdatePrefs must rename its temporary file away'
    );
  });
});
