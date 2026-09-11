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
import { CANONICAL_PRAXIS_SKILL_IDS } from '../../lib/agentic-tools-canonical-skills.js';
import { EXPECTED_CANONICAL_SKILL_IDS } from '../expected-skill-ids.js';

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

// The installedVersion cases need real files on disk, and one existing case
// asserts tmpDir stays empty, so their fixtures get their own root. Each case
// still takes its own subdirectory of that root, so the empty-directory case
// cannot see the other case's fixture.
const versionTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'praxis-server-test-version-'));

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.rmSync(versionTmpDir, { recursive: true, force: true });
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

// The version every fixture SKILL.md below carries. Deliberately not '9.9.9',
// so a presence case cannot pass on the version the older case above writes.
const FIXTURE_VERSION = '3.4.5';

// Lays skill files out under <versionTmpDir>/<name>/skills/<id>/SKILL.md and
// answers that base path. The relative layout is written here as a literal and
// is NOT derived from formatForTarget or from the catalogue pathTemplate: a
// fixture built by the code under test would agree with whatever path that
// code produced and would assert nothing. Each caller passes its own name, so
// no case can see another case's fixture, and nothing is written under tmpDir,
// which an existing case asserts stays empty. The body carries a nested
// metadata.version, matching the fixture the installedVersion case above
// writes, so one fixture serves both the presence assertions and the
// installedVersion assertion.
function writeSkillFixture(name: string, skillIds: string[]): string {
  const baseDir = path.join(versionTmpDir, name);
  for (const skillId of skillIds) {
    const skillDir = path.join(baseDir, 'skills', skillId);
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      `---\nname: ${skillId}\nmetadata:\n  version: "${FIXTURE_VERSION}"\n---\nBody text.\n`,
      'utf8',
    );
  }
  return baseDir;
}

// The one id the partial-install fixture leaves out, named literally rather
// than picked by index from EXPECTED_CANONICAL_SKILL_IDS, so the expectation
// cannot silently follow a reordering of that golden list.
const PARTIAL_OMITTED_SKILL_ID = 'fc-git';
const PARTIAL_INSTALL_SKILL_IDS = EXPECTED_CANONICAL_SKILL_IDS.filter(
  (id) => id !== PARTIAL_OMITTED_SKILL_ID,
);

type PresenceBody = {
  checkKind: string;
  status: string;
  presentSkillIds: string[];
  missingSkillIds: string[];
  installedVersion: string | null;
};

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

test('POST /api/integrations/skill-presence answers the version written in an installed SKILL.md', async () => {
  const skillId = CANONICAL_PRAXIS_SKILL_IDS[0];
  if (skillId === undefined) throw new Error('expected at least one canonical skill id');
  // firstTool is claude-code, whose global skill-directory pathTemplate is
  // 'skills/<name>/SKILL.md', so the fixture sits at that path under basePath.
  const installedDir = path.join(versionTmpDir, 'installed');
  const skillDir = path.join(installedDir, 'skills', skillId);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    `---\nname: ${skillId}\nmetadata:\n  version: "9.9.9"\n---\nBody text.\n`,
    'utf8',
  );

  const res = await postJson('/api/integrations/skill-presence', {
    toolId: firstTool.id,
    basePath: installedDir,
    scope: { kind: 'global' },
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { installedVersion: string | null };
  assert.equal(body.installedVersion, '9.9.9');
});

test('POST /api/integrations/skill-presence answers a null installedVersion for an empty directory', async () => {
  const emptyDir = path.join(versionTmpDir, 'empty');
  fs.mkdirSync(emptyDir, { recursive: true });

  const res = await postJson('/api/integrations/skill-presence', {
    toolId: firstTool.id,
    basePath: emptyDir,
    scope: { kind: 'global' },
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { installedVersion: string | null };
  assert.equal(body.installedVersion, null);
});

test('POST /api/integrations/skill-presence answers fully-installed when every canonical skill is on disk', async () => {
  // firstTool is claude-code, whose global format is skill-directory with
  // pathTemplate 'skills/<name>/SKILL.md'. The fixture writes files only; no
  // case here installs anything, because getInstallContent is a live network
  // call.
  const baseDir = writeSkillFixture('full-install', EXPECTED_CANONICAL_SKILL_IDS);

  const res = await postJson('/api/integrations/skill-presence', {
    toolId: firstTool.id,
    basePath: baseDir,
    scope: { kind: 'global' },
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as PresenceBody;
  assert.equal(body.checkKind, 'per-skill');
  assert.equal(body.status, 'fully-installed');
  assert.deepEqual(body.missingSkillIds, []);
  // presentSkillIds arrives in the canonical list's declaration order, so the
  // comparison sorts a copy rather than the response array's own order.
  assert.deepEqual([...body.presentSkillIds].sort(), EXPECTED_CANONICAL_SKILL_IDS);
});

test('POST /api/integrations/skill-presence answers missing-incomplete and names the one absent skill', async () => {
  const baseDir = writeSkillFixture('partial-install', PARTIAL_INSTALL_SKILL_IDS);

  const res = await postJson('/api/integrations/skill-presence', {
    toolId: firstTool.id,
    basePath: baseDir,
    scope: { kind: 'global' },
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as PresenceBody;
  assert.equal(body.checkKind, 'per-skill');
  assert.equal(body.status, 'missing-incomplete');
  assert.deepEqual(body.missingSkillIds, [PARTIAL_OMITTED_SKILL_ID]);
});

test('POST /api/integrations/skill-presence answers a version for a partial install', async () => {
  // The same fixture the missing-incomplete case above drives. Rebuilding it
  // here is idempotent and keeps this case independent of test ordering.
  const baseDir = writeSkillFixture('partial-install', PARTIAL_INSTALL_SKILL_IDS);

  const res = await postJson('/api/integrations/skill-presence', {
    toolId: firstTool.id,
    basePath: baseDir,
    scope: { kind: 'global' },
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as PresenceBody;
  assert.equal(body.installedVersion, FIXTURE_VERSION);
});

test('POST /api/integrations/skill-presence answers not-installed for an empty base path', async () => {
  // Its own subdirectory, not the empty-directory case's, so neither case
  // depends on the other's setup. No SKILL.md is written into it: the route
  // answers 'not-installed' only when presentSkillIds is empty.
  const baseDir = path.join(versionTmpDir, 'presence-empty');
  fs.mkdirSync(baseDir, { recursive: true });

  const res = await postJson('/api/integrations/skill-presence', {
    toolId: firstTool.id,
    basePath: baseDir,
    scope: { kind: 'global' },
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as PresenceBody;
  assert.equal(body.checkKind, 'per-skill');
  assert.equal(body.status, 'not-installed');
  assert.deepEqual(body.presentSkillIds, []);
  assert.deepEqual([...body.missingSkillIds].sort(), EXPECTED_CANONICAL_SKILL_IDS);
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
