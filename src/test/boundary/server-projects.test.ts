// Boundary regression suite for the project registry routes, driven over a real
// socket against the real compiled server.
//
// Every expectation below is an EXTERNAL one: a status code, a JSON shape, or an
// observable side effect on a later request. Nothing here imports src/lib/, and
// no case computes a project id for itself — the id always comes back out of a
// route response. That is what lets the internals move without this file moving
// with them.
//
// Assertion strictness, settled for the whole suite: assert the status code and
// the response shape everywhere, and assert only that an `error` string is
// present for a refusal, never its wording. No refusal in this file encodes a
// security decision, so no exact text is pinned here.
//
// Run with `node --test --test-force-exit dist/test/boundary/server-projects.test.js` after
// `npm run build`. The --test-force-exit is required for the same reason
// src/server.test.ts needs it: importing the server binds a listening socket as
// a module side effect and nothing exports a close handle. `npm test` already
// passes the flag.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { startTestServer, requestJson } from './server-harness.js';

// Once per file: the harness fixes this process's environment before it imports
// the server, and ESM module caching means that environment cannot be changed
// afterwards.
const { base, dataDir } = await startTestServer();

// Every temporary directory this file creates, the harness's data directory
// included, removed together when the file finishes.
const tempDirs: string[] = [dataDir];

after(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// A throwaway directory the server accepts as a project: it holds a workstream
// tree, which is the whole of what the registration check looks for.
function makeProjectDir(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'flowcharge-project-'));
  tempDirs.push(root);
  fs.mkdirSync(path.join(root, 'flowcharge', 'workstreams'), { recursive: true });
  return root;
}

// A throwaway directory with no workstream tree in it, for the refusal case.
function makePlainDir(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'flowcharge-plain-'));
  tempDirs.push(root);
  return root;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

interface ProjectEnvelope {
  project: { id: string; name: string; path: string; added: string };
}

interface ProjectListBody {
  projects: { id: string; name: string; path: string; added: string }[];
}

function postProjects(body: string): Promise<{ status: number; body: unknown }> {
  return requestJson(base, '/api/projects', { method: 'POST', headers: JSON_HEADERS, body });
}

// The one refusal assertion this suite makes: the status, and an `error` string
// that is present and non-empty. The wording is deliberately not asserted.
function assertErrorBody(body: unknown): void {
  const shape = body as { error?: unknown };
  assert.equal(typeof shape.error, 'string', 'a refusal must carry an `error` string');
  assert.notEqual(shape.error, '', 'the `error` string must not be empty');
}

// THE ISOLATION PROOF, and the reason this case runs first. With the data
// directory redirected, the registry library treats the process as packaged and
// answers an empty list for a registry file that does not exist yet. With the
// redirection broken it would instead answer this repository's own list, which
// is never empty. A failure here means the harness leaked to the repository
// root, and every later case in this file would then be writing there.
test('GET /api/projects answers an empty list in a fresh data directory', async () => {
  const res = await requestJson<ProjectListBody>(base, '/api/projects');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { projects: [] });
});

test('POST /api/projects registers a project once and repeats it without duplicating', async () => {
  const root = makeProjectDir();

  const created = await requestJson<ProjectEnvelope>(base, '/api/projects', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ path: root }),
  });
  assert.equal(created.status, 201);
  const entry = created.body.project;
  assert.equal(typeof entry.id, 'string');
  assert.notEqual(entry.id, '');
  assert.equal(entry.name, path.basename(root));
  assert.equal(entry.path, root);
  assert.match(entry.added, /^\d{4}-\d{2}-\d{2}$/);

  // The second registration is an existing row, not a new one: 200, not 201,
  // and the same id the first answer handed out.
  const repeated = await requestJson<ProjectEnvelope>(base, '/api/projects', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ path: root }),
  });
  assert.equal(repeated.status, 200);
  assert.equal(repeated.body.project.id, entry.id);

  // The list route is the external proof that exactly one row was written.
  const listed = await requestJson<ProjectListBody>(base, '/api/projects');
  assert.equal(listed.status, 200);
  assert.equal(listed.body.projects.length, 1);
  assert.equal(listed.body.projects[0].id, entry.id);
  assert.equal(listed.body.projects[0].path, root);
});

test('POST /api/projects refuses a body that is not valid JSON with 400', async () => {
  const res = await postProjects('{');
  assert.equal(res.status, 400);
  assertErrorBody(res.body);
});

test('POST /api/projects refuses a body with no path with 400', async () => {
  const res = await postProjects(JSON.stringify({}));
  assert.equal(res.status, 400);
  assertErrorBody(res.body);
});

// Refused on the leading character alone, before any filesystem call, so this
// case needs no directory on disk.
test('POST /api/projects refuses a ~ path with 400', async () => {
  const res = await postProjects(JSON.stringify({ path: '~/some/project' }));
  assert.equal(res.status, 400);
  assertErrorBody(res.body);
});

test('POST /api/projects refuses a relative path with 400', async () => {
  const res = await postProjects(JSON.stringify({ path: 'some/relative/project' }));
  assert.equal(res.status, 400);
  assertErrorBody(res.body);
});

test('POST /api/projects refuses an absolute path with no workstream tree with 400', async () => {
  const res = await postProjects(JSON.stringify({ path: makePlainDir() }));
  assert.equal(res.status, 400);
  assertErrorBody(res.body);
});

test('PUT /api/projects answers 405', async () => {
  const res = await requestJson(base, '/api/projects', { method: 'PUT' });
  assert.equal(res.status, 405);
  assertErrorBody(res.body);
});

// ---------------------------------------------------------------------------
// /api/projects/:id — the entry route.
//
// Each group below registers its OWN project through the collection route, so
// no case depends on the ordering or the survival of another case's row.
// ---------------------------------------------------------------------------

interface DeletedEnvelope {
  deleted: { id: string; name: string; path: string; added: string };
}

// Registers a fresh project and hands back the id the route assigned to it. The
// id is always taken from a response and never computed here.
async function registerFreshProject(): Promise<{ id: string; root: string }> {
  const root = makeProjectDir();
  const res = await requestJson<ProjectEnvelope>(base, '/api/projects', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ path: root }),
  });
  assert.equal(res.status, 201);
  return { id: res.body.project.id, root };
}

// Content-Type is set on EVERY PATCH. The guard at the top of the API handler
// runs above every route match and before any body is read, so a PATCH without
// it answers 403 and the case would prove nothing about the rename path.
function patchProject(id: string, body: string): Promise<{ status: number; body: unknown }> {
  return requestJson(base, `/api/projects/${id}`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body,
  });
}

test('PATCH /api/projects/:id renames the entry and the list reflects it', async () => {
  const { id } = await registerFreshProject();
  const renamed = 'Renamed board';

  const res = await requestJson<ProjectEnvelope>(base, `/api/projects/${id}`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify({ name: renamed }),
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.project.name, renamed);

  const listed = await requestJson<ProjectListBody>(base, '/api/projects');
  assert.equal(listed.status, 200);
  const entry = listed.body.projects.find((candidate) => candidate.id === id);
  assert.ok(entry, 'the renamed project must still be listed');
  assert.equal(entry.name, renamed);
});

test('PATCH /api/projects/:id refuses a body that is not valid JSON with 400', async () => {
  const { id } = await registerFreshProject();
  const res = await patchProject(id, '{');
  assert.equal(res.status, 400);
  assertErrorBody(res.body);
});

test('PATCH /api/projects/:id refuses a body with no name with 400', async () => {
  const { id } = await registerFreshProject();
  const res = await patchProject(id, JSON.stringify({}));
  assert.equal(res.status, 400);
  assertErrorBody(res.body);
});

// The cap itself is a constant in src/server.ts. This length is chosen to sit
// comfortably above it rather than to restate it, so widening the cap does not
// silently make the case meaningless.
test('PATCH /api/projects/:id refuses an over-long name with 400', async () => {
  const { id } = await registerFreshProject();
  const res = await patchProject(id, JSON.stringify({ name: 'x'.repeat(500) }));
  assert.equal(res.status, 400);
  assertErrorBody(res.body);
});

test('PATCH /api/projects/:id refuses a name holding a control character with 400', async () => {
  const { id } = await registerFreshProject();
  const res = await patchProject(id, JSON.stringify({ name: 'First line\nSecond line' }));
  assert.equal(res.status, 400);
  assertErrorBody(res.body);
});

test('PATCH /api/projects/:id refuses an unknown id with 404', async () => {
  const res = await patchProject('no-such-project-id', JSON.stringify({ name: 'Anything' }));
  assert.equal(res.status, 404);
  assertErrorBody(res.body);
});

test('DELETE /api/projects/:id removes the entry and a second delete answers 404', async () => {
  const { id } = await registerFreshProject();

  const deleted = await requestJson<DeletedEnvelope>(base, `/api/projects/${id}`, {
    method: 'DELETE',
  });
  assert.equal(deleted.status, 200);
  assert.equal(deleted.body.deleted.id, id);

  const listed = await requestJson<ProjectListBody>(base, '/api/projects');
  assert.equal(listed.status, 200);
  assert.equal(
    listed.body.projects.some((candidate) => candidate.id === id),
    false,
    'the deleted project must be gone from the list',
  );

  const again = await requestJson(base, `/api/projects/${id}`, { method: 'DELETE' });
  assert.equal(again.status, 404);
  assertErrorBody(again.body);
});

// The entry-route pattern is end-anchored, so this must be the entry route's own
// method guard and never the /data route below it.
test('GET /api/projects/:id answers 405', async () => {
  const { id } = await registerFreshProject();
  const res = await requestJson(base, `/api/projects/${id}`);
  assert.equal(res.status, 405);
  assertErrorBody(res.body);
});
