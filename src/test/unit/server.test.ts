// Integration test for the /api/integrations/* routes, driven over a real
// socket. Follows agentic-tools-detect.test.ts's node:test + node:assert/strict
// pattern.
//
// Run with `node --test --test-force-exit dist/test/unit/server.test.js` after
// `npm run build`. The --test-force-exit is required: importing the server binds
// a listening socket as a module side effect and nothing exports a close
// handle, so the runner would otherwise never exit.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { TOOL_CATALOGUE } from '../../lib/agentic-tools-catalogue.js';

// Set BEFORE the server module is imported: it reads both at evaluation time,
// so assigning them afterwards would be too late. PORT 0 asks the OS for an
// ephemeral port, which is why the bound port has to be read back rather than
// hardcoded.
process.env.PORT = '0';
process.env.HOST = '127.0.0.1';

const { serverReady } = await import('../../server.js');
const port = await serverReady;
const base = `http://127.0.0.1:${port}`;

// Every path this suite could touch lives under here. No case points at a real
// tool config directory, and no case performs a real install: getInstallContent
// is a live network call.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'praxis-server-test-'));

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function postJson(route: string, body: unknown): Promise<Response> {
  return fetch(base + route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const firstTool = TOOL_CATALOGUE[0];
if (firstTool === undefined) throw new Error('expected at least one entry in TOOL_CATALOGUE');

test('GET /api/integrations/tools answers one row per catalogue tool', async () => {
  const res = await fetch(`${base}/api/integrations/tools`);
  assert.equal(res.status, 200);
  const rows = (await res.json()) as { toolId: string; detection: { confidence: string } }[];
  assert.ok(Array.isArray(rows));
  assert.equal(rows.length, TOOL_CATALOGUE.length);
  assert.deepEqual(
    rows.map((row) => row.toolId),
    TOOL_CATALOGUE.map((tool) => tool.id),
  );
  assert.equal(typeof rows[0].detection.confidence, 'string');
});

test('GET /api/integrations/installs answers a bare array', async () => {
  const res = await fetch(`${base}/api/integrations/installs`);
  assert.equal(res.status, 200);
  const records = await res.json();
  assert.ok(Array.isArray(records));
});

test('POST /api/integrations/skill-presence refuses an unknown toolId with 404', async () => {
  const res = await postJson('/api/integrations/skill-presence', {
    toolId: 'no-such-tool',
    basePath: tmpDir,
    scope: { kind: 'global' },
  });
  assert.equal(res.status, 404);
  const body = (await res.json()) as { error: string };
  assert.equal(body.error, 'Unknown toolId: no-such-tool');
});

test('POST /api/integrations/skill-presence refuses a malformed body with 400', async () => {
  const res = await postJson('/api/integrations/skill-presence', 'not json at all');
  assert.equal(res.status, 400);
});

test('POST /api/integrations/skill-presence answers a presence result for a real tool', async () => {
  const res = await postJson('/api/integrations/skill-presence', {
    toolId: firstTool.id,
    basePath: tmpDir,
    scope: { kind: 'global' },
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { checkKind: string };
  assert.equal(typeof body.checkKind, 'string');
});

test('POST /api/integrations/installs refuses a basePath outside the permitted root', async () => {
  // A project scope whose projectPath is not in the project registry has no
  // permitted root at all, so the batch is refused before any install runs and
  // before any content is fetched.
  const res = await postJson('/api/integrations/installs', {
    targets: [{ toolId: firstTool.id, basePath: tmpDir, scope: { kind: 'project', projectPath: tmpDir } }],
  });
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error: string };
  assert.ok(
    body.error.startsWith('Refused install path outside the permitted root for'),
    `unexpected error string: ${body.error}`,
  );
  assert.deepEqual(fs.readdirSync(tmpDir), []);
});

test('POST /api/integrations/installs refuses a malformed body with 400', async () => {
  const res = await postJson('/api/integrations/installs', { targets: [{ toolId: '' }] });
  assert.equal(res.status, 400);
});

test('POST /api/integrations/installs/remove answers null for an untracked toolId', async () => {
  const res = await postJson('/api/integrations/installs/remove', {
    toolId: 'no-such-tool',
    scope: { kind: 'global' },
  });
  assert.equal(res.status, 200);
  assert.equal(await res.json(), null);
});

test('an unmatched /api/integrations/ path answers 404', async () => {
  const res = await fetch(`${base}/api/integrations/nothing`);
  assert.equal(res.status, 404);
});

test('a matched integrations path with the wrong method answers 405', async () => {
  const res = await fetch(`${base}/api/integrations/tools`, { method: 'PUT' });
  assert.equal(res.status, 405);
});
