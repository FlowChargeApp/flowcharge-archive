// Unit tests for the workstream tree resolver in tree-layout.ts. Two name
// generations are live at the same time — `flowcharge/` with `workstream.md`,
// and the legacy `prxwork/` with `prxworkstream.md` — so the cases below fix
// which one wins, and fix what must NOT resolve. The stale-backup case is the
// highest-value test here: folders named `prxwork-bak/` and
// `prxwork-pre-migration-<date>/` sit beside live trees on real machines, and a
// prefix or glob match would render a board from months-old data with no error.
//
// Run with `node --test dist/test/unit/tree-layout.test.js` after `npm run build`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { isWorkstreamMarker, resolveTreeLayout } from '../../lib/tree-layout.js';

// Builds a throwaway root holding exactly the named entries, and removes it in a
// finally block so a failing assertion leaves no tree behind.
function withRoot(entries: readonly string[], run: (root: string) => void): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'praxis-tree-layout-test-'));
  try {
    for (const entry of entries) {
      fs.mkdirSync(path.join(root, entry), { recursive: true });
    }
    run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('a flowcharge/ tree resolves as the current generation', () => {
  withRoot(['flowcharge/workstreams'], (root) => {
    const layout = resolveTreeLayout(root);
    if (layout === null) throw new Error('flowcharge/ must resolve');
    assert.equal(layout.generation, 'flowcharge');
    assert.equal(layout.legacy, false);
  });
});

test('a prxwork/ tree resolves as the legacy generation', () => {
  withRoot(['prxwork/workstreams'], (root) => {
    const layout = resolveTreeLayout(root);
    if (layout === null) throw new Error('prxwork/ must resolve');
    assert.equal(layout.generation, 'prxwork');
    assert.equal(layout.legacy, true);
  });
});

test('a root holding BOTH folders resolves the current generation', () => {
  withRoot(['flowcharge/workstreams', 'prxwork/workstreams'], (root) => {
    const layout = resolveTreeLayout(root);
    if (layout === null) throw new Error('a root holding both folders must resolve');
    assert.equal(layout.generation, 'flowcharge');
    assert.equal(layout.legacy, false);
    assert.equal(path.basename(layout.dir), 'flowcharge');
  });
});

test('a root holding neither folder resolves to null', () => {
  withRoot(['docs', 'src'], (root) => {
    assert.equal(resolveTreeLayout(root), null);
  });
});

// The regression case. These sibling names exist on real machines beside live
// trees, and every one of them must be invisible to the resolver.
test('a stale backup sibling never resolves', () => {
  withRoot(['prxwork-bak/workstreams'], (root) => {
    assert.equal(resolveTreeLayout(root), null, 'prxwork-bak/ is not a workstream tree');
  });
  withRoot(['prxwork-pre-migration-2026-08-17/workstreams'], (root) => {
    assert.equal(resolveTreeLayout(root), null, 'a dated backup folder is not a workstream tree');
  });
  withRoot(['flowcharge-bak/workstreams'], (root) => {
    assert.equal(resolveTreeLayout(root), null, 'flowcharge-bak/ is not a workstream tree');
  });
});

test('a plain FILE named flowcharge resolves to null, not a layout', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'praxis-tree-layout-test-'));
  try {
    fs.writeFileSync(path.join(root, 'flowcharge'), 'not a directory\n');
    assert.equal(resolveTreeLayout(root), null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a root that does not exist returns null rather than throwing', () => {
  const missing = path.join(os.tmpdir(), 'praxis-tree-layout-test-absent-does-not-exist');
  assert.equal(fs.existsSync(missing), false, 'the fixture path must genuinely be absent');
  assert.equal(resolveTreeLayout(missing), null);
});

test('isWorkstreamMarker accepts both markers and rejects every other name', () => {
  assert.equal(isWorkstreamMarker('workstream.md'), true);
  assert.equal(isWorkstreamMarker('prxworkstream.md'), true);
  assert.equal(isWorkstreamMarker('plan.md'), false);
  assert.equal(isWorkstreamMarker('prxplan.md'), false);
  assert.equal(isWorkstreamMarker('.lease'), false);
});

// A caller joins 'workstreams' straight onto `dir`, so it must be absolute and
// must end with the basename that resolved. The full string is deliberately not
// compared against the mkdtemp root: on macOS os.tmpdir() returns a /var symlink
// to /private/var, and an exact-path assertion fails on that alone.
test('dir is an absolute path ending in the resolved basename', () => {
  withRoot(['flowcharge/workstreams'], (root) => {
    const layout = resolveTreeLayout(root);
    if (layout === null) throw new Error('flowcharge/ must resolve');
    assert.equal(path.isAbsolute(layout.dir), true);
    assert.equal(path.basename(layout.dir), layout.generation);
    assert.equal(fs.existsSync(path.join(layout.dir, 'workstreams')), true);
  });
});
