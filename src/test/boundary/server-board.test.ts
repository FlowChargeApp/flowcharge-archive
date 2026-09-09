// Boundary regression suite for the board payload route and the workstream
// detail route, driven over a real socket against the real compiled server and
// a real fixture tree on disk.
//
// Every expectation below is an EXTERNAL one: a status code and a JSON shape.
// Nothing here imports a parser from src/lib/extract.js or a function from
// src/lib/projects.js — the only src/lib/ import is the fixture BUILDER, which
// writes files rather than computing an expectation. Every expected value is
// written out in this file, so the assertions do not move when the internals do.
//
// Assertion strictness, settled for the whole suite: assert the status code and
// the response shape everywhere, and assert only that an `error` string is
// present for a refusal, never its wording. The single exception is the
// malformed-workstream-id refusal, whose exact text is pinned because it
// encodes a security decision — see that case for the reasoning.
//
// Run with `node --test --test-force-exit dist/test/boundary/server-board.test.js` after
// `npm run build`. The --test-force-exit is required for the same reason
// src/server-projects.test.ts needs it: importing the server binds a listening
// socket as a module side effect and nothing exports a close handle.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { startTestServer, requestJson } from './server-harness.js';
import { withBoardFixtureProject } from '../fixture-project.js';

// Once per file: the harness fixes this process's environment before it imports
// the server, and ESM module caching means that environment cannot be changed
// afterwards.
const { base, dataDir } = await startTestServer();

after(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

// Every fixture tree the builder writes removes itself in its own finally
// block, so the harness's data directory is the only path this file owns.

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// The branch the fixture writes into .git/HEAD, and the display name every
// fixture project is renamed to. `branch` comes from the TREE and `name` from
// the REGISTRY, so asserting both proves the payload joins the two sources
// rather than reading everything from one of them.
const FIXTURE_BRANCH = 'fixture-branch';
const DISPLAY_NAME = 'Board fixture project';

// The three workstream ids the fixture writes. Restated here rather than
// imported, so a fixture that silently changes an id fails an assertion.
const POPULATED_WS = 'WS-40-brd001';
const BARE_WS = 'WS-41-brd002';
const ARCHIVED_WS = 'WS-42-brd003';

interface ProjectEnvelope {
  project: { id: string; name: string };
}

// The refusal assertion this suite makes almost everywhere: the status, and an
// `error` string that is present and non-empty. The wording is not asserted.
function assertErrorBody(body: unknown): void {
  const shape = body as { error?: unknown };
  assert.equal(typeof shape.error, 'string', 'a refusal must carry an `error` string');
  assert.notEqual(shape.error, '', 'the `error` string must not be empty');
}

// Registers a fixture root through the collection route and renames it, then
// hands back the id the route assigned. The id is always taken from a response
// and never computed here. The rename is what makes the payload's `name` field
// assertable against a value the registry — not the tree — holds.
async function registerFixture(root: string): Promise<string> {
  const created = await requestJson<ProjectEnvelope>(base, '/api/projects', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ path: root }),
  });
  assert.equal(created.status, 201);
  const id = created.body.project.id;

  const renamed = await requestJson<ProjectEnvelope>(base, `/api/projects/${id}`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify({ name: DISPLAY_NAME }),
  });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.body.project.name, DISPLAY_NAME);
  return id;
}

function workstreamById(payload: BoardPayload, id: string): PraxisWorkstream {
  const found = payload.workstreams.find((ws) => ws.id === id);
  assert.ok(found, `the payload must carry workstream ${id}`);
  return found;
}

// THE SHARED EXPECTATION. Both name generations run through this one function,
// so the two cases cannot drift apart: a payload field that is asserted for
// flowcharge is asserted for prxwork by construction.
function assertBoardPayload(payload: BoardPayload, root: string): void {
  // `source` is the path that was REGISTERED, compared without realpath on
  // either side. On macOS os.tmpdir() sits under /var/folders/..., which
  // path.resolve does not dereference, so dereferencing one side only would
  // fail for a reason that has nothing to do with the route.
  assert.equal(payload.source, root);
  assert.match(payload.generated, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(payload.branch, FIXTURE_BRANCH);
  assert.equal(payload.name, DISPLAY_NAME);

  // The walk does not sort its listing, so the id SET is asserted rather than
  // the array order.
  assert.equal(payload.workstreams.length, 3);
  assert.deepEqual(
    payload.workstreams.map((ws) => ws.id).slice().sort(),
    [POPULATED_WS, BARE_WS, ARCHIVED_WS],
  );

  const populated = workstreamById(payload, POPULATED_WS);
  assert.equal(populated.slug, 'WS-40-brd001-board-fixture');
  assert.equal(populated.title, 'Board fixture workstream');
  assert.equal(populated.status, 'in-progress');
  assert.equal(populated.archived, false);
  assert.deepEqual(populated.tags, ['board', 'fixture']);
  assert.equal(populated.created, '2026-02-01');
  assert.equal(populated.updated, '2026-02-02');
  assert.deepEqual(populated.depends_on, [BARE_WS]);
  assert.ok(populated.body.includes('The first paragraph'), 'the body must survive whole');
  assert.ok(populated.body.includes('The second paragraph'), 'a multi-paragraph body must not be truncated');

  // Reading order is plan, issue list, task list. The fixture numbers the ids
  // against that order, so an ordering that falls back to the id number alone
  // comes back exactly reversed.
  assert.deepEqual(
    populated.artefacts.map((artefact) => artefact.id),
    ['PLN-30-p1a2n3', 'IL-20-i1s2s3', 'TL-10-t1a2s3'],
  );
  assert.deepEqual(
    populated.artefacts.map((artefact) => artefact.type),
    ['plan', 'issuelist', 'tasklist'],
  );
  const [plan, issueList, taskList] = populated.artefacts;
  assert.equal(plan.status, 'done');
  assert.equal(plan.updated, '2026-02-02');
  // Counters exist only for the two counted types.
  assert.equal(plan.total, undefined);
  assert.equal(plan.done, undefined);
  assert.equal(issueList.total, 2);
  assert.equal(issueList.done, 1);
  assert.equal(taskList.total, 3);
  assert.equal(taskList.done, 2);

  // A workstream folder holding only its marker: artefacts is observable as [].
  const bare = workstreamById(payload, BARE_WS);
  assert.equal(bare.status, 'ready');
  assert.equal(bare.archived, false);
  assert.deepEqual(bare.artefacts, []);

  const archived = workstreamById(payload, ARCHIVED_WS);
  assert.equal(archived.status, 'done');
  assert.equal(archived.archived, true);

  // The aggregated shallow issues[] the board filters on: one unsuffixed id and
  // one suffixed one, one checked and one unchecked, each with its severity and
  // its status.
  assert.deepEqual(
    payload.issues.map((issue) => ({
      id: issue.id,
      checked: issue.checked,
      severity: issue.severity,
      status: issue.status,
      workstream: issue.workstream,
    })),
    [
      { id: 'ISS-50', checked: true, severity: 'high', status: 'done', workstream: POPULATED_WS },
      { id: 'ISS-51-iss001', checked: false, severity: 'low', status: 'open', workstream: POPULATED_WS },
    ],
  );
}

test('GET /api/projects/:id/data renders the whole board payload for a flowcharge tree', async () => {
  await withBoardFixtureProject(async (root) => {
    const id = await registerFixture(root);
    const res = await requestJson<BoardPayload>(base, `/api/projects/${id}/data`);
    assert.equal(res.status, 200);
    assertBoardPayload(res.body, root);
  }, { branch: FIXTURE_BRANCH });
});

// The legacy generation of the same route. It runs through the SAME shared
// expectation as the case above, so the two generations cannot diverge.
// Running this case prints a LEGACY LAYOUT warning on the parent process's
// stderr. That is expected output rather than a failure, and it is deliberately
// not asserted: it is a side effect of the server, not part of the response.
test('GET /api/projects/:id/data renders the same board payload for a legacy prxwork tree', async () => {
  await withBoardFixtureProject(async (root) => {
    const id = await registerFixture(root);
    const res = await requestJson<BoardPayload>(base, `/api/projects/${id}/data`);
    assert.equal(res.status, 200);
    assertBoardPayload(res.body, root);
  }, { generation: 'prxwork', branch: FIXTURE_BRANCH });
});

test('GET /api/projects/:id/data answers 404 for an unknown project id', async () => {
  const res = await requestJson(base, '/api/projects/no-such-project-id/data');
  assert.equal(res.status, 404);
  assertErrorBody(res.body);
});

// Content-Type is set so the POST clears the guard above the route table and
// the 405 that comes back is the route's own method guard.
test('POST /api/projects/:id/data answers 405', async () => {
  const res = await requestJson(base, '/api/projects/no-such-project-id/data', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 405);
  assertErrorBody(res.body);
});

test('GET /api/projects/:id/data answers 410 once the registered tree is gone', async () => {
  await withBoardFixtureProject(async (root) => {
    const id = await registerFixture(root);
    // Removed while the callback is still running: the builder removes the root
    // when it RETURNS, which would be far too late for this request.
    fs.rmSync(root, { recursive: true, force: true });
    const res = await requestJson(base, `/api/projects/${id}/data`);
    assert.equal(res.status, 410);
    assertErrorBody(res.body);
  });
});

// ---------------------------------------------------------------------------
// GET /api/projects/:id/workstreams/:wsId/detail — the modal's payload.
// ---------------------------------------------------------------------------

test('GET .../workstreams/:wsId/detail returns the plan body, the issue items and the task tree', async () => {
  await withBoardFixtureProject(async (root) => {
    const id = await registerFixture(root);
    const res = await requestJson<PraxisWorkstreamDetail>(
      base,
      `/api/projects/${id}/workstreams/${POPULATED_WS}/detail`,
    );
    assert.equal(res.status, 200);
    const detail = res.body;

    assert.equal(detail.id, POPULATED_WS);
    assert.equal(detail.slug, 'WS-40-brd001-board-fixture');
    assert.equal(detail.title, 'Board fixture workstream');
    assert.equal(detail.status, 'in-progress');
    assert.equal(detail.archived, false);

    assert.equal(detail.plans.length, 1);
    assert.equal(detail.plans[0].artefact.id, 'PLN-30-p1a2n3');
    assert.equal(detail.plans[0].artefact.title, 'Board fixture plan');
    assert.equal(typeof detail.plans[0].body, 'string');
    assert.ok(
      detail.plans[0].body.includes('One plan paragraph'),
      'the plan body must cross the wire as raw markdown',
    );

    assert.equal(detail.issueLists.length, 1);
    assert.equal(detail.issueLists[0].artefact.id, 'IL-20-i1s2s3');
    const items = detail.issueLists[0].items;
    assert.deepEqual(
      items.map((item) => ({
        id: item.id,
        title: item.title,
        checked: item.checked,
        status: item.status,
      })),
      [
        { id: 'ISS-50', title: 'Unsuffixed board issue', checked: true, status: 'done' },
        { id: 'ISS-51-iss001', title: 'Suffixed board issue', checked: false, status: 'open' },
      ],
    );
    assert.deepEqual(items[0].fields, { id: 'ISS-50', status: 'done', severity: 'high' });
    assert.deepEqual(items[1].fields, { id: 'ISS-51-iss001', status: 'open', severity: 'low' });

    assert.equal(detail.taskLists.length, 1);
    assert.equal(detail.taskLists[0].artefact.id, 'TL-10-t1a2s3');
    const tasks = detail.taskLists[0].tasks;
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].number, '1');
    assert.equal(tasks[0].title, 'The parent task');
    assert.equal(tasks[0].checked, true);
    assert.deepEqual(tasks[0].fields, { description: 'Parent task fence' });
    assert.deepEqual(
      tasks[0].children.map((child) => ({
        number: child.number,
        title: child.title,
        checked: child.checked,
      })),
      [
        { number: '1.1', title: 'The first child task', checked: true },
        { number: '1.2', title: 'The second child task', checked: false },
      ],
    );
    assert.deepEqual(tasks[0].children[0].fields, { description: 'First child fence' });
    assert.deepEqual(tasks[0].children[1].fields, {});
    assert.deepEqual(tasks[0].children[0].children, []);
  });
});

// The archive branch of the lookup: the same route, a workstream that lives
// under archive/ rather than workstreams/.
test('GET .../workstreams/:wsId/detail answers 200 with archived true for an archived workstream', async () => {
  await withBoardFixtureProject(async (root) => {
    const id = await registerFixture(root);
    const res = await requestJson<PraxisWorkstreamDetail>(
      base,
      `/api/projects/${id}/workstreams/${ARCHIVED_WS}/detail`,
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.id, ARCHIVED_WS);
    assert.equal(res.body.archived, true);
    assert.equal(res.body.title, 'Board fixture archived workstream');
    assert.deepEqual(res.body.plans, []);
    assert.deepEqual(res.body.issueLists, []);
    assert.deepEqual(res.body.taskLists, []);
  });
});

// One of the two places the settled strictness decision requires the EXACT
// wording. The message encodes a security decision: the shape check runs before
// any filesystem work, and the request path is decodeURIComponent'd before it is
// matched, so a percent-encoded traversal segment reaches this guard and is
// refused on its shape rather than on where it would have pointed.
test('GET .../workstreams/:wsId/detail answers 400 with the exact text for a malformed workstream id', async () => {
  await withBoardFixtureProject(async (root) => {
    const id = await registerFixture(root);
    const res = await requestJson<{ error: string }>(
      base,
      `/api/projects/${id}/workstreams/not-a-ws-id/detail`,
    );
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Malformed workstream id not-a-ws-id');
  });
});

// The shape guard runs ABOVE findProject, so a malformed workstream id under an
// unknown project id still answers 400 rather than 404.
test('GET .../workstreams/:wsId/detail answers 400 before it looks the project up', async () => {
  const res = await requestJson<{ error: string }>(
    base,
    '/api/projects/no-such-project-id/workstreams/not-a-ws-id/detail',
  );
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Malformed workstream id not-a-ws-id');
});

// Well-formed, so it clears the shape guard and reaches the lookup — which is
// what makes this the 404 branch rather than the 400 branch.
test('GET .../workstreams/:wsId/detail answers 404 for an unknown workstream id', async () => {
  await withBoardFixtureProject(async (root) => {
    const id = await registerFixture(root);
    const res = await requestJson(base, `/api/projects/${id}/workstreams/WS-999-zzzzzz/detail`);
    assert.equal(res.status, 404);
    assertErrorBody(res.body);
  });
});

test('GET .../workstreams/:wsId/detail answers 404 for an unknown project id', async () => {
  const res = await requestJson(
    base,
    `/api/projects/no-such-project-id/workstreams/${POPULATED_WS}/detail`,
  );
  assert.equal(res.status, 404);
  assertErrorBody(res.body);
});

test('POST .../workstreams/:wsId/detail answers 405', async () => {
  const res = await requestJson(
    base,
    `/api/projects/no-such-project-id/workstreams/${POPULATED_WS}/detail`,
    { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({}) },
  );
  assert.equal(res.status, 405);
  assertErrorBody(res.body);
});

test('GET .../workstreams/:wsId/detail answers 410 once the registered tree is gone', async () => {
  await withBoardFixtureProject(async (root) => {
    const id = await registerFixture(root);
    fs.rmSync(root, { recursive: true, force: true });
    const res = await requestJson(base, `/api/projects/${id}/workstreams/${POPULATED_WS}/detail`);
    assert.equal(res.status, 410);
    assertErrorBody(res.body);
  });
});
