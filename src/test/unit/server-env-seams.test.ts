// Unit tests for the two environment seams in server.ts: PRAXIS_APP_VERSION,
// which APP_VERSION reads, and PRAXIS_DATA_DIR, which INSTALL_REGISTRY_PATH
// reads. Both are read ONCE at module scope, so ESM module caching means a
// single test process cannot exercise both the set and the unset branch — one
// import fixes the values for the life of that process. Every case below
// therefore spawns the compiled server in a fresh child process with a
// controlled environment, exactly as src/lib/projects.test.ts does.
//
// These cases deliberately do NOT live in src/server.test.ts. That file imports
// ./server.js in-process at module scope, so its environment is already fixed
// and a second set of values cannot be observed there.
//
// Run with `node --test dist/test/unit/server-env-seams.test.js` after `npm run build`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverJsPath = path.join(__dirname, '../../server.js');
const packageJsonPath = path.join(__dirname, '../../../package.json');

// The version the package.json fallback must produce, read here rather than
// hardcoded so a future version bump does not break these tests.
const PACKAGE_VERSION: string = (
  JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { version: string }
).version;

// The server logs its bound URL on stdout, so the driver prefixes its own one
// line and the parent picks that line out rather than parsing all of stdout.
const RESULT_PREFIX = 'SEAM-RESULT ';

interface DriverResult {
  status: number;
  body: unknown;
}

// Drives the compiled server from a child process: imports it with the supplied
// environment already in place (so the module's top-level consts observe it),
// awaits the exported serverReady promise for the bound port, performs one fetch
// against `route`, and prints the status and parsed body as one JSON line.
//
// PORT=0 is load-bearing. A fixed 4173 would make two children collide and would
// make this suite fail whenever the developer already has the board running.
function runInChildProcess(env: Record<string, string | undefined>, route: string): DriverResult {
  const childEnv: Record<string, string> = { ...process.env } as Record<string, string>;
  // The unset cases must not inherit a value from the parent shell, so an
  // explicit undefined deletes the variable rather than overriding it.
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete childEnv[key];
    else childEnv[key] = value;
  }
  childEnv.PORT = '0';
  childEnv.HOST = '127.0.0.1';

  const driver = `
    const mod = await import(${JSON.stringify(serverJsPath)});
    const port = await mod.serverReady;
    const res = await fetch('http://127.0.0.1:' + port + ${JSON.stringify(route)});
    const body = await res.json();
    console.log(${JSON.stringify(RESULT_PREFIX)} + JSON.stringify({ status: res.status, body }));
    process.exit(0);
  `;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', driver], {
    env: childEnv,
    encoding: 'utf8',
  });
  const line = output
    .split('\n')
    .find((candidate) => candidate.startsWith(RESULT_PREFIX));
  assert.ok(line, `child process printed no ${RESULT_PREFIX} line. Output was:\n${output}`);
  return JSON.parse(line.slice(RESULT_PREFIX.length)) as DriverResult;
}

test('PRAXIS_APP_VERSION set is what /api/version answers', () => {
  const sentinel = '9.9.9-seam-test';
  assert.notEqual(sentinel, PACKAGE_VERSION, 'the sentinel must differ from package.json version');
  const result = runInChildProcess({ PRAXIS_APP_VERSION: sentinel }, '/api/version');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { version: sentinel });
});

test('PRAXIS_APP_VERSION unset or empty falls back to package.json', () => {
  const unset = runInChildProcess({ PRAXIS_APP_VERSION: undefined }, '/api/version');
  assert.equal(unset.status, 200);
  assert.deepEqual(unset.body, { version: PACKAGE_VERSION }, 'unset must read package.json');

  // The case that proves '' falls through rather than becoming the answer.
  const empty = runInChildProcess({ PRAXIS_APP_VERSION: '' }, '/api/version');
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.body, { version: PACKAGE_VERSION }, "'' must read package.json too");
});

// The seeded registry record. A fixed toolId lets the unset case below assert
// this exact record is absent. No real install is performed: getInstallContent
// is a live network call, and seeding the file keeps this suite offline.
const SEEDED_TOOL_ID = 'seam-test-tool';
const SEEDED_RECORD = {
  toolId: SEEDED_TOOL_ID,
  resolvedPath: '/tmp/seam-test/skill',
  format: 'folder',
  scope: { kind: 'global' },
  installedAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  contentHash: 'seamtesthash',
};

test('PRAXIS_DATA_DIR set is where the install registry is read from', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'praxis-seams-test-'));
  try {
    fs.writeFileSync(
      path.join(tmpDir, '.praxis-installs.json'),
      JSON.stringify([SEEDED_RECORD]),
      'utf8'
    );
    const result = runInChildProcess({ PRAXIS_DATA_DIR: tmpDir }, '/api/integrations/installs');
    assert.equal(result.status, 200);
    const records = result.body as Array<{ toolId?: string }>;
    assert.ok(
      records.some((record) => record.toolId === SEEDED_TOOL_ID),
      `the record seeded inside PRAXIS_DATA_DIR (${tmpDir}) must be read back`
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('PRAXIS_DATA_DIR unset still resolves the registry at the repository root', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'praxis-seams-test-'));
  try {
    fs.writeFileSync(
      path.join(tmpDir, '.praxis-installs.json'),
      JSON.stringify([SEEDED_RECORD]),
      'utf8'
    );
    const result = runInChildProcess({ PRAXIS_DATA_DIR: undefined }, '/api/integrations/installs');
    assert.equal(result.status, 200);
    const records = result.body as Array<{ toolId?: string }>;
    assert.ok(
      !records.some((record) => record.toolId === SEEDED_TOOL_ID),
      'with PRAXIS_DATA_DIR unset the temp registry must NOT be read; the fallback is the repository root'
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
