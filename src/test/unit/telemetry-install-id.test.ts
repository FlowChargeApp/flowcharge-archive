// Unit tests for telemetry-install-id.ts. Unlike src/test/unit/update-prefs.test.ts,
// no child process is needed: readOrCreateInstallId takes dataDir as an argument
// and reads no environment variable at any scope, so the compiled module can be
// imported directly and driven with a temporary directory per case.
//
// Every case writes into its own directory under os.tmpdir() and removes it
// afterwards — nothing is written to the repository root or to ~/.flowcharge.
//
// Run with `node --test dist/test/unit/telemetry-install-id.test.js` after `npm run build`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { readOrCreateInstallId } from '../../lib/telemetry-install-id.js';

const FILE_NAME = '.praxis-telemetry.json';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Every test runs against its own temporary directory and removes it afterwards.
function withTempDir(fn: (dataDir: string) => void): void {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'praxis-telemetry-id-test-'));
  try {
    fn(tmpDir);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function readBody(dataDir: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(dataDir, FILE_NAME), 'utf8'));
}

test('an empty directory gets a fresh UUID persisted in the ID file', () => {
  withTempDir((dataDir) => {
    const result = readOrCreateInstallId(dataDir);

    assert.equal(result.persisted, true);
    assert.match(result.installId, UUID_RE);

    const body = readBody(dataDir);
    assert.deepEqual(body, { installId: result.installId });
    assert.deepEqual(
      Object.keys(body as Record<string, unknown>),
      ['installId'],
      'the file body must hold exactly the one installId key'
    );

    // No temporary file may survive the atomic rename.
    assert.deepEqual(
      fs.readdirSync(dataDir).filter((name) => name.endsWith('.tmp')),
      [],
      'readOrCreateInstallId must rename its temporary file away'
    );
  });
});

test('a second call on the same directory returns the identical id', () => {
  withTempDir((dataDir) => {
    const first = readOrCreateInstallId(dataDir);
    const second = readOrCreateInstallId(dataDir);

    assert.equal(second.installId, first.installId);
    assert.equal(second.persisted, true);
    assert.deepEqual(readBody(dataDir), { installId: first.installId });
  });
});

test('an unparseable file is rewritten with a fresh UUID', () => {
  withTempDir((dataDir) => {
    fs.writeFileSync(path.join(dataDir, FILE_NAME), '{ not json at all');

    const result = readOrCreateInstallId(dataDir);

    assert.equal(result.persisted, true);
    assert.match(result.installId, UUID_RE);
    assert.deepEqual(readBody(dataDir), { installId: result.installId });
  });
});

test('a non-object body is rewritten rather than trusted', () => {
  // `null` parses successfully but is not an object, and an array is an object
  // that carries no installId — both must fall through to a fresh UUID.
  for (const body of ['null', '[1, 2, 3]', '"a string"']) {
    withTempDir((dataDir) => {
      fs.writeFileSync(path.join(dataDir, FILE_NAME), body);

      const result = readOrCreateInstallId(dataDir);

      assert.equal(result.persisted, true, `body ${body} must be replaced`);
      assert.match(result.installId, UUID_RE);
      assert.deepEqual(readBody(dataDir), { installId: result.installId });
    });
  }
});

test('a missing or non-string installId is rewritten with a fresh UUID', () => {
  for (const body of ['{}', '{"installId": 42}', '{"installId": null}', '{"installId": ""}']) {
    withTempDir((dataDir) => {
      fs.writeFileSync(path.join(dataDir, FILE_NAME), body);

      const result = readOrCreateInstallId(dataDir);

      assert.equal(result.persisted, true, `body ${body} must be replaced`);
      assert.match(result.installId, UUID_RE);
      assert.deepEqual(readBody(dataDir), { installId: result.installId });
    });
  }
});

// chmod 0o500 does not stop a process running as root, so under root the case
// would pass vacuously — it is skipped there rather than asserted falsely.
const runningAsRoot = typeof process.getuid === 'function' && process.getuid() === 0;

test(
  'an unwritable directory still returns a usable id, with persisted false',
  { skip: runningAsRoot ? 'chmod does not restrain root' : false },
  () => {
    withTempDir((dataDir) => {
      fs.chmodSync(dataDir, 0o500);
      try {
        // The assertion is on the returned flag, not only on the absence of the
        // file: a vacuous pass must not look like a real one.
        const result = readOrCreateInstallId(dataDir);

        assert.equal(result.persisted, false);
        assert.match(result.installId, UUID_RE);
        assert.equal(
          fs.existsSync(path.join(dataDir, FILE_NAME)),
          false,
          'no file may be written into an unwritable directory'
        );
      } finally {
        // Restored so withTempDir's cleanup can still remove the directory.
        fs.chmodSync(dataDir, 0o700);
      }
    });
  }
);

test('an unwritable directory does not throw', () => {
  withTempDir((dataDir) => {
    fs.chmodSync(dataDir, 0o500);
    try {
      assert.doesNotThrow(() => readOrCreateInstallId(dataDir));
    } finally {
      fs.chmodSync(dataDir, 0o700);
    }
  });
});
