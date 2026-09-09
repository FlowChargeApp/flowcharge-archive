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
