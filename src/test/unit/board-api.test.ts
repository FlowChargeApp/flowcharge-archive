// Unit tests for the application service in core/board-api.ts. They drive
// createBoardApi() directly over hand-written fakes of its two driven ports —
// the project registry and the markdown workstream store — so the six BoardApi
// operations and their nine result variants are addressable one at a time.
// Both ports are plain interfaces, so each fake is a typed object literal with a
// call log, and every case is synchronous: the suite starts no server, opens no
// socket, touches no disk and spawns no child process. It knows the ports and
// the result variants only; transport status codes and error bodies belong to
// the boundary suite. Follows extract.test.ts's node:test + node:assert/strict
// pattern, and the fake-with-call-log pattern in agentic-tools-install.test.ts.
//
// Run with `node --test dist/test/unit/board-api.test.js` after `npm run build`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createBoardApi } from '../../core/board-api.js';
import type { BoardApi } from '../../ports/app-api.js';
import type { ProjectRegistry } from '../../ports/project-registry.js';
import type { TreeLayout, WorkstreamStore } from '../../ports/workstream-store.js';

// One recorded port call. `args` is kept as the raw argument list so a case can
// prove what the core actually passed, rather than re-deriving it.
type Call = { fn: string; args: readonly unknown[] };

const ENTRY: ProjectEntry = {
  id: 'abc12345',
  name: 'Fixture project',
  path: '/fake/project',
  added: '2026-01-01',
};

// Key order here is load-bearing: the core spreads this payload first, so the
// order declared below is the order the board payload's first four keys take.
// `workstreams` and `issues` stay empty on purpose — the core only spreads the
// extractor's result, so a richer fixture would assert extract.test.ts's work.
const BOARD: PraxisData = {
  generated: '2026-01-01T00:00:00.000Z',
  source: '/fake/project/flowcharge',
  workstreams: [],
  issues: [],
};

const DETAIL: PraxisWorkstreamDetail = {
  id: 'WS-1-aa11bb',
  slug: 'fixture',
  title: 'Fixture',
  status: 'ready',
  archived: false,
  plans: [],
  issueLists: [],
  taskLists: [],
};

const LAYOUT_CURRENT: TreeLayout = {
  dir: '/fake/project/flowcharge',
  generation: 'flowcharge',
  legacy: false,
};

const LAYOUT_LEGACY: TreeLayout = {
  dir: '/fake/project/prxwork',
  generation: 'prxwork',
  legacy: true,
};

// A ProjectRegistry that records every call before it answers. The record is
// pushed ahead of the override, so a case can prove a method was reached even
// when the override decides the return value — and an absent record is proof the
// core rejected the input before it touched the port.
function fakeRegistry(overrides?: Partial<ProjectRegistry>): ProjectRegistry & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    list(): ProjectEntry[] {
      calls.push({ fn: 'list', args: [] });
      return overrides?.list ? overrides.list() : [];
    },
    find(id: string): ProjectEntry | undefined {
      calls.push({ fn: 'find', args: [id] });
      return overrides?.find ? overrides.find(id) : undefined;
    },
    add(absPath: string): { entry: ProjectEntry; created: boolean } {
      calls.push({ fn: 'add', args: [absPath] });
      return overrides?.add ? overrides.add(absPath) : { entry: ENTRY, created: true };
    },
    remove(id: string): ProjectEntry | undefined {
      calls.push({ fn: 'remove', args: [id] });
      return overrides?.remove ? overrides.remove(id) : undefined;
    },
    rename(id: string, name: string): ProjectEntry | undefined {
      calls.push({ fn: 'rename', args: [id, name] });
      return overrides?.rename ? overrides.rename(id, name) : undefined;
    },
  };
}

// A WorkstreamStore built the same way. Both return values are typed against the
// port interface, so the compiler proves the fakes satisfy the contracts.
function fakeStore(overrides?: Partial<WorkstreamStore>): WorkstreamStore & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    resolveLayout(projectRoot: string): TreeLayout | null {
      calls.push({ fn: 'resolveLayout', args: [projectRoot] });
      return overrides?.resolveLayout ? overrides.resolveLayout(projectRoot) : null;
    },
    hasTree(projectRoot: string): boolean {
      calls.push({ fn: 'hasTree', args: [projectRoot] });
      return overrides?.hasTree ? overrides.hasTree(projectRoot) : true;
    },
    // The default hands back a fresh copy of BOARD rather than the shared
    // constant, so one case cannot mutate another case's fixture.
    readBoard(projectRoot: string): PraxisData {
      calls.push({ fn: 'readBoard', args: [projectRoot] });
      if (overrides?.readBoard) return overrides.readBoard(projectRoot);
      return {
        generated: BOARD.generated,
        source: BOARD.source,
        workstreams: [...BOARD.workstreams],
        issues: [...BOARD.issues],
      };
    },
    readDetail(projectRoot: string, workstreamId: string): PraxisWorkstreamDetail | null {
      calls.push({ fn: 'readDetail', args: [projectRoot, workstreamId] });
      return overrides?.readDetail ? overrides.readDetail(projectRoot, workstreamId) : null;
    },
    readBranch(projectRoot: string): string | null {
      calls.push({ fn: 'readBranch', args: [projectRoot] });
      return overrides?.readBranch ? overrides.readBranch(projectRoot) : null;
    },
  };
}

// Composes the service over both fakes and hands back the very instances the
// service holds, so a case can read their call logs after the call.
function makeApi(parts?: {
  registry?: Partial<ProjectRegistry>;
  store?: Partial<WorkstreamStore>;
}): {
  api: BoardApi;
  registry: ProjectRegistry & { calls: Call[] };
  store: WorkstreamStore & { calls: Call[] };
} {
  const registry = fakeRegistry(parts?.registry);
  const store = fakeStore(parts?.store);
  return { api: createBoardApi({ registry, store }), registry, store };
}

test('getBoard ok composes the extraction result with branch and name', () => {
  const { api } = makeApi({
    registry: { find: () => ENTRY },
    store: { readBranch: () => 'main' },
  });

  const result = api.getBoard(ENTRY.id);

  // BoardResult is a discriminated union, so narrow on kind first. Asserting it
  // up front also makes a forgotten find override fail loudly instead of
  // silently skipping every payload assertion below.
  assert.equal(result.kind, 'ok');
  if (result.kind !== 'ok') return;
  const payload = result.payload;
  assert.equal(payload.generated, BOARD.generated);
  assert.equal(payload.source, BOARD.source);
  assert.deepEqual(payload.workstreams, []);
  assert.deepEqual(payload.issues, []);
  assert.equal(payload.branch, 'main');
  // The name is the registry's display name. The store knows nothing about it,
  // and it is not the project id.
  assert.equal(payload.name, ENTRY.name);
});

test('getBoard ok payload keeps the declared key order', () => {
  const { api } = makeApi({
    registry: { find: () => ENTRY },
    store: { readBranch: () => 'main' },
  });

  const result = api.getBoard(ENTRY.id);

  assert.equal(result.kind, 'ok');
  if (result.kind !== 'ok') return;
  // core/board-api.ts:57-63 declares this key order load-bearing: the extraction
  // result spreads first, then branch, then name, so the serialised payload
  // keeps its byte order. Order is the whole point, so compare the key array
  // itself rather than membership.
  assert.deepEqual(Object.keys(result.payload), ['generated', 'source', 'workstreams', 'issues', 'branch', 'name']);
});

test('getBoard ok passes a null branch through to the payload', () => {
  const { api } = makeApi({
    registry: { find: () => ENTRY },
    store: { readBranch: () => null },
  });

  const result = api.getBoard(ENTRY.id);

  assert.equal(result.kind, 'ok');
  if (result.kind !== 'ok') return;
  assert.equal(result.payload.branch, null);
});

test('getBoard ok passes a branch string through unchanged', () => {
  const { api } = makeApi({
    registry: { find: () => ENTRY },
    store: { readBranch: () => 'feature/some-branch' },
  });

  const result = api.getBoard(ENTRY.id);

  assert.equal(result.kind, 'ok');
  if (result.kind !== 'ok') return;
  // The core forwards the value; it does not interpret or shorten it.
  assert.equal(result.payload.branch, 'feature/some-branch');
});

test('getBoard hands the store entry.path, never the project id', () => {
  const { api, store } = makeApi({
    registry: { find: () => ENTRY },
    store: { readBranch: () => 'main' },
  });

  const result = api.getBoard(ENTRY.id);
  assert.equal(result.kind, 'ok');

  // Read the arguments out of the recorded calls, so the assertion proves what
  // the core actually passed rather than what this case could re-derive.
  const names = store.calls.map((call) => call.fn);
  for (const expected of ['hasTree', 'resolveLayout', 'readBoard', 'readBranch']) {
    assert.ok(names.includes(expected), `store.${expected} must be called`);
  }
  for (const call of store.calls) {
    assert.equal(call.args[0], ENTRY.path, `store.${call.fn} must receive entry.path`);
  }
  for (const call of store.calls) {
    for (const arg of call.args) {
      assert.notEqual(arg, ENTRY.id, `store.${call.fn} must never receive the project id`);
    }
  }
});

test('getBoard returns unknown-project and touches no store method', () => {
  // registry.find stays on its default, which answers undefined.
  const { api, registry, store } = makeApi();

  const result = api.getBoard('missing');

  // Compare the whole result, so no extra field can ride along.
  assert.deepEqual(result, { kind: 'unknown-project' });
  // The guard runs before any store method. Assert the whole log is empty
  // rather than one named method, so a future reordering that probed the
  // layout early cannot slip past this case.
  assert.equal(store.calls.length, 0);
  assert.deepEqual(
    registry.calls.filter((call) => call.fn === 'find').map((call) => call.args),
    [['missing']],
  );
});

test('getBoard returns tree-missing carrying entry.path', () => {
  const { api, store } = makeApi({
    registry: { find: () => ENTRY },
    store: { hasTree: () => false },
  });

  const result = api.getBoard(ENTRY.id);

  // The path carried is the entry's path, not the project id and not the input.
  assert.deepEqual(result, { kind: 'tree-missing', path: ENTRY.path });
  const names = store.calls.map((call) => call.fn);
  assert.ok(!names.includes('readBoard'), 'store.readBoard must never be called');
  assert.ok(!names.includes('readBranch'), 'store.readBranch must never be called');
  assert.deepEqual(
    store.calls.filter((call) => call.fn === 'hasTree').map((call) => call.args),
    [[ENTRY.path]],
  );
});

test('getDetail returns unknown-project and touches no store method', () => {
  // registry.find stays on its default undefined return.
  const { api, registry, store } = makeApi();

  const result = api.getDetail('missing', 'WS-1-aa11bb');

  assert.deepEqual(result, { kind: 'unknown-project' });
  assert.equal(store.calls.length, 0);
  // getDetail takes two ids. Assert which one reached the registry, or a
  // swapped argument order would pass unnoticed.
  assert.deepEqual(
    registry.calls.filter((call) => call.fn === 'find').map((call) => call.args),
    [['missing']],
  );
  for (const call of registry.calls) {
    for (const arg of call.args) {
      assert.notEqual(arg, 'WS-1-aa11bb', `registry.${call.fn} must never receive the workstream id`);
    }
  }
});

test('getDetail returns tree-missing carrying entry.path', () => {
  const { api, store } = makeApi({
    registry: { find: () => ENTRY },
    store: { hasTree: () => false },
  });

  const result = api.getDetail(ENTRY.id, 'WS-1-aa11bb');

  // tree-missing and unknown-workstream both mean "nothing to show", but they
  // are separate variants, so compare the exact object rather than checking
  // that the kind is merely not 'ok'.
  assert.deepEqual(result, { kind: 'tree-missing', path: ENTRY.path });
  const names = store.calls.map((call) => call.fn);
  assert.ok(!names.includes('readDetail'), 'store.readDetail must never be called');
  assert.deepEqual(
    store.calls.filter((call) => call.fn === 'hasTree').map((call) => call.args),
    [[ENTRY.path]],
  );
});

test('getDetail returns unknown-workstream when readDetail answers null', () => {
  // hasTree and readDetail both stay on their defaults: true, then null.
  const { api, store } = makeApi({
    registry: { find: () => ENTRY },
  });

  const result = api.getDetail(ENTRY.id, 'WS-404-nope');

  // No path and no legacyLayoutDir ride on this variant.
  assert.deepEqual(result, { kind: 'unknown-workstream' });
  // ports/workstream-store.ts:19-24 splits the two failure shapes on purpose:
  // readBoard throws when the tree is missing, while readDetail answers null
  // when the workstream id is unknown. The core must keep them apart, so prove
  // the null return produced this variant rather than an earlier guard.
  assert.equal(store.calls.filter((call) => call.fn === 'readDetail').length, 1);
});

test('getDetail ok returns the store detail object unchanged', () => {
  const { api } = makeApi({
    registry: { find: () => ENTRY },
    store: { readDetail: () => DETAIL },
  });

  const result = api.getDetail(ENTRY.id, DETAIL.id);

  assert.equal(result.kind, 'ok');
  if (result.kind !== 'ok') return;
  // Compare by reference. deepEqual would pass on a rebuilt copy, and the core
  // must hand back the very object the store returned.
  assert.equal(result.detail, DETAIL);
});

test('getDetail forwards entry.path and the workstream id to readDetail verbatim', () => {
  const { api, store } = makeApi({
    registry: { find: () => ENTRY },
    store: { readDetail: () => DETAIL },
  });

  api.getDetail(ENTRY.id, DETAIL.id);

  // Read the values out of the recorded call rather than re-deriving them, so
  // the assertion proves what the core actually passed. The core normalises
  // neither argument.
  const calls = store.calls.filter((call) => call.fn === 'readDetail');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].args.length, 2);
  assert.equal(calls[0].args[0], ENTRY.path);
  assert.equal(calls[0].args[1], DETAIL.id);
});

test('getBoard ok reports legacyLayoutDir null when no layout resolves', () => {
  const { api, store } = makeApi({
    registry: { find: () => ENTRY },
    store: { resolveLayout: () => null },
  });

  const result = api.getBoard(ENTRY.id);

  assert.equal(result.kind, 'ok');
  if (result.kind !== 'ok') return;
  assert.equal(result.legacyLayoutDir, null);
  assert.deepEqual(
    store.calls.filter((call) => call.fn === 'resolveLayout').map((call) => call.args),
    [[ENTRY.path]],
  );
});

test('getBoard ok reports legacyLayoutDir null for a current layout', () => {
  const { api, store } = makeApi({
    registry: { find: () => ENTRY },
    store: { resolveLayout: () => LAYOUT_CURRENT },
  });

  const result = api.getBoard(ENTRY.id);

  // This is the discriminating case of the three: LAYOUT_CURRENT carries a real
  // dir with legacy false, so a core that returned layout.dir without testing
  // layout.legacy would pass the null-layout case and fail only here.
  assert.equal(result.kind, 'ok');
  if (result.kind !== 'ok') return;
  assert.equal(result.legacyLayoutDir, null);
  assert.deepEqual(
    store.calls.filter((call) => call.fn === 'resolveLayout').map((call) => call.args),
    [[ENTRY.path]],
  );
});

test('getBoard ok reports the legacy directory for a legacy layout', () => {
  const { api, store } = makeApi({
    registry: { find: () => ENTRY },
    store: { resolveLayout: () => LAYOUT_LEGACY },
  });

  const result = api.getBoard(ENTRY.id);

  assert.equal(result.kind, 'ok');
  if (result.kind !== 'ok') return;
  assert.equal(result.legacyLayoutDir, LAYOUT_LEGACY.dir);
  assert.deepEqual(
    store.calls.filter((call) => call.fn === 'resolveLayout').map((call) => call.args),
    [[ENTRY.path]],
  );
});

test('getDetail ok reports legacyLayoutDir null when no layout resolves', () => {
  const { api, store } = makeApi({
    registry: { find: () => ENTRY },
    store: { readDetail: () => DETAIL, resolveLayout: () => null },
  });

  const result = api.getDetail(ENTRY.id, DETAIL.id);

  assert.equal(result.kind, 'ok');
  if (result.kind !== 'ok') return;
  assert.equal(result.legacyLayoutDir, null);
  assert.deepEqual(
    store.calls.filter((call) => call.fn === 'resolveLayout').map((call) => call.args),
    [[ENTRY.path]],
  );
});

test('getDetail ok reports legacyLayoutDir null for a current layout', () => {
  const { api, store } = makeApi({
    registry: { find: () => ENTRY },
    store: { readDetail: () => DETAIL, resolveLayout: () => LAYOUT_CURRENT },
  });

  const result = api.getDetail(ENTRY.id, DETAIL.id);

  assert.equal(result.kind, 'ok');
  if (result.kind !== 'ok') return;
  assert.equal(result.legacyLayoutDir, null);
  assert.deepEqual(
    store.calls.filter((call) => call.fn === 'resolveLayout').map((call) => call.args),
    [[ENTRY.path]],
  );
});

test('getDetail ok reports the legacy directory for a legacy layout', () => {
  const { api, store } = makeApi({
    registry: { find: () => ENTRY },
    store: { readDetail: () => DETAIL, resolveLayout: () => LAYOUT_LEGACY },
  });

  const result = api.getDetail(ENTRY.id, DETAIL.id);

  assert.equal(result.kind, 'ok');
  if (result.kind !== 'ok') return;
  assert.equal(result.legacyLayoutDir, LAYOUT_LEGACY.dir);
  assert.deepEqual(
    store.calls.filter((call) => call.fn === 'resolveLayout').map((call) => call.args),
    [[ENTRY.path]],
  );
});

// addProject resolves the layout from its own input path, because no registry
// entry exists yet. ADD_PATH is deliberately different from ENTRY.path, so the
// argument assertions below can fail.
const ADD_PATH = '/fake/added-project';

test('addProject ok reports legacyLayoutDir null when no layout resolves', () => {
  const { api, store } = makeApi({
    store: { resolveLayout: () => null },
  });

  const result = api.addProject(ADD_PATH);

  assert.equal(result.kind, 'ok');
  if (result.kind !== 'ok') return;
  assert.equal(result.legacyLayoutDir, null);
  assert.deepEqual(
    store.calls.filter((call) => call.fn === 'resolveLayout').map((call) => call.args),
    [[ADD_PATH]],
  );
});

test('addProject ok reports legacyLayoutDir null for a current layout', () => {
  const { api, store } = makeApi({
    store: { resolveLayout: () => LAYOUT_CURRENT },
  });

  const result = api.addProject(ADD_PATH);

  assert.equal(result.kind, 'ok');
  if (result.kind !== 'ok') return;
  assert.equal(result.legacyLayoutDir, null);
  assert.deepEqual(
    store.calls.filter((call) => call.fn === 'resolveLayout').map((call) => call.args),
    [[ADD_PATH]],
  );
});

test('addProject ok reports the legacy directory for a legacy layout', () => {
  const { api, store } = makeApi({
    store: { resolveLayout: () => LAYOUT_LEGACY },
  });

  const result = api.addProject(ADD_PATH);

  assert.equal(result.kind, 'ok');
  if (result.kind !== 'ok') return;
  assert.equal(result.legacyLayoutDir, LAYOUT_LEGACY.dir);
  assert.deepEqual(
    store.calls.filter((call) => call.fn === 'resolveLayout').map((call) => call.args),
    [[ADD_PATH]],
  );
});

test('addProject returns no-tree and never reaches the registry', () => {
  const { api, registry } = makeApi({
    store: { hasTree: () => false },
  });

  const result = api.addProject('/fake/not-a-project');

  // The path carried is the input path, verbatim.
  assert.deepEqual(result, { kind: 'no-tree', path: '/fake/not-a-project' });
  // Guard order is the point of this case. If addProject reached registry.add
  // before the hasTree guard, a rejected path would be written to the registry
  // file while the caller was told the path was rejected. Assert the whole
  // registry log is empty, not only that add is absent, so a future write of
  // any kind fails here too.
  assert.equal(registry.calls.length, 0);
});

test('addProject ok passes created true through from the registry', () => {
  const added = { entry: ENTRY, created: true };
  const { api } = makeApi({
    registry: { add: () => added },
  });

  const result = api.addProject(ADD_PATH);

  // resolveLayout stays on its default null answer, so legacyLayoutDir stays
  // null. The matrix above is the only place that varies it.
  assert.deepEqual(result, { kind: 'ok', entry: ENTRY, created: true, legacyLayoutDir: null });
  assert.equal(result.kind, 'ok');
  if (result.kind !== 'ok') return;
  // Compare by reference: the core hands back the registry's own entry.
  assert.equal(result.entry, added.entry);
});

test('addProject ok passes created false through from the registry', () => {
  const { api } = makeApi({
    registry: { add: () => ({ entry: ENTRY, created: false }) },
  });

  const result = api.addProject(ADD_PATH);

  assert.equal(result.kind, 'ok');
  if (result.kind !== 'ok') return;
  // The core passes the registry's flag through; it does not recompute it.
  assert.equal(result.created, false);
  assert.equal(result.legacyLayoutDir, null);
});

// A path whose normalised form differs from itself: it carries a redundant
// segment and a trailing separator. Path normalisation is the adapter's job,
// not the core's, so the core must forward this string untouched.
const UNNORMALISED_PATH = '/fake/parent/../added-project/';

test('addProject forwards its input path to both ports verbatim', () => {
  const { api, registry, store } = makeApi();

  api.addProject(UNNORMALISED_PATH);

  assert.deepEqual(
    store.calls.filter((call) => call.fn === 'hasTree').map((call) => call.args),
    [[UNNORMALISED_PATH]],
  );
  assert.deepEqual(
    registry.calls.filter((call) => call.fn === 'add').map((call) => call.args),
    [[UNNORMALISED_PATH]],
  );
});

test('listProjects returns the registry list unchanged and never touches the store', () => {
  const entries = [ENTRY];
  const { api, registry, store } = makeApi({
    registry: { list: () => entries },
  });

  const result = api.listProjects();

  // Reference comparison: deepEqual would pass on a copy, and pure delegation
  // is the fact under test — the core does not copy, sort or filter the list.
  assert.equal(result, entries);
  assert.equal(registry.calls.filter((call) => call.fn === 'list').length, 1);
  assert.equal(store.calls.length, 0);
});

test('removeProject passes the registry entry through by reference', () => {
  const { api, registry, store } = makeApi({
    registry: { remove: () => ENTRY },
  });

  const result = api.removeProject(ENTRY.id);

  // removeProject answers a bare ProjectEntry or undefined, not a result
  // variant, so there is no kind field on it to assert.
  assert.equal(result, ENTRY);
  assert.deepEqual(
    registry.calls.filter((call) => call.fn === 'remove').map((call) => call.args),
    [[ENTRY.id]],
  );
  assert.equal(store.calls.length, 0);
});

test('removeProject passes an undefined registry answer through', () => {
  // registry.remove stays on its default undefined return.
  const { api, store } = makeApi();

  const result = api.removeProject('missing');

  assert.equal(result, undefined);
  assert.equal(store.calls.length, 0);
});

test('renameProject passes the registry entry through by reference', () => {
  const { api, registry, store } = makeApi({
    registry: { rename: () => ENTRY },
  });

  const result = api.renameProject(ENTRY.id, 'New name');

  assert.equal(result, ENTRY);
  // Both arguments are strings, so a swapped order type-checks cleanly and only
  // this assertion catches it. The two literals differ visibly on purpose.
  const calls = registry.calls.filter((call) => call.fn === 'rename');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].args.length, 2);
  assert.equal(calls[0].args[0], ENTRY.id);
  assert.equal(calls[0].args[1], 'New name');
  assert.equal(store.calls.length, 0);
});

test('renameProject passes an undefined registry answer through', () => {
  // registry.rename stays on its default undefined return.
  const { api, store } = makeApi();

  const result = api.renameProject('missing', 'New name');

  assert.equal(result, undefined);
  assert.equal(store.calls.length, 0);
});
