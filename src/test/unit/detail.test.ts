// Unit tests for detail.ts — the modal's per-workstream payload. This is the
// file's first test, and it opens with the name-generation compatibility cases
// rather than backfilling parser coverage: the parser is exercised through the
// board tests already, and the resolver move is what is new here.
//
// The fixture builder is SHARED with the extract.ts suite rather than copied — a
// copied fixture drifts, and then the two suites disagree about what a tree
// looks like. It is imported from ../fixture-project.js, not from
// ./extract.test.js: importing one test file from another registers the imported
// file's tests a second time, and a combined `node --test` run then reports
// every extract case twice.
//
// Run with `node --test dist/test/unit/detail.test.js` after `npm run build`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { extractWorkstreamDetail } from '../../lib/detail.js';
import { FIXTURE_GENERATIONS, withFixtureProject } from '../fixture-project.js';

// The fixture's workstream folder name. `slug` on the payload comes from the
// readdirSync DIRECTORY name, never from frontmatter — locateWorkstream sets it
// that way so a folder named by bare slug resolves like one named in the
// documented <WS-N>-<slug> form. The fixture's frontmatter slug is `fixture`,
// so asserting that value instead would fail against correct behaviour.
const FIXTURE_DIR = 'WS-1-aa11bb-fixture';
const FIXTURE_ID = 'WS-1-aa11bb';

// Builds an EMPTY project root — no tree folder of either generation. Not a
// duplicate of withFixtureProject: it deliberately writes nothing at all, which
// is the one shape that helper cannot express.
function withEmptyProject(run: (root: string) => void): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'praxis-detail-test-'));
  try {
    run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

for (const generation of FIXTURE_GENERATIONS) {
  test(`a workstream resolves its detail (${generation})`, () => {
    withFixtureProject((root) => {
      const detail = extractWorkstreamDetail(root, FIXTURE_ID);
      if (detail === null) throw new Error(`no detail for ${FIXTURE_ID} in a ${generation} tree`);
      assert.equal(detail.id, FIXTURE_ID);
      assert.equal(detail.status, 'in-progress');
      // The folder's basename, not the frontmatter slug — see FIXTURE_DIR above.
      assert.equal(detail.slug, FIXTURE_DIR);
      assert.equal(detail.archived, false);
      assert.equal(detail.issueLists.length, 1, 'the fixture issue list must reach the modal');
    }, generation);
  });

  test(`an unknown workstream id returns null (${generation})`, () => {
    withFixtureProject((root) => {
      assert.equal(extractWorkstreamDetail(root, 'WS-999-zzzzzz'), null);
    }, generation);
  });

  // Acceptance criterion 8, modal side. A marker file carries `id` and
  // `type: workstream` in its own frontmatter, so a marker the artefact loop
  // fails to skip would reach one of the three collections.
  test(`no marker file reaches the modal's collections (${generation})`, () => {
    withFixtureProject((root) => {
      const detail = extractWorkstreamDetail(root, FIXTURE_ID);
      if (detail === null) throw new Error('fixture detail missing');
      const files = [...detail.plans, ...detail.issueLists, ...detail.taskLists].map((e) => e.artefact.file);
      assert.deepEqual(files.filter((f) => f === 'workstream.md' || f === 'prxworkstream.md'), []);
    }, generation);
  });
}

// Acceptance criterion 7, modal side. The tree folder and the marker file are
// renamed by separate upstream steps, so a half-renamed tree is a real state,
// and the modal must not 404 on a card the board already renders.
test('a flowcharge/ tree holding the legacy marker still resolves its detail', () => {
  withFixtureProject((root) => {
    const detail = extractWorkstreamDetail(root, FIXTURE_ID);
    if (detail === null) throw new Error('prxworkstream.md inside flowcharge/ must not be skipped silently');
    assert.equal(detail.id, FIXTURE_ID);
    assert.equal(detail.slug, FIXTURE_DIR);
  }, 'flowcharge', { marker: 'prxworkstream.md' });
});

test('a prxwork/ tree holding the current marker still resolves its detail', () => {
  withFixtureProject((root) => {
    const detail = extractWorkstreamDetail(root, FIXTURE_ID);
    if (detail === null) throw new Error('workstream.md inside prxwork/ must not be skipped silently');
    assert.equal(detail.id, FIXTURE_ID);
  }, 'prxwork', { marker: 'workstream.md' });
});

// A root with no tree of either generation is a null detail, never a throw: the
// route turns null into a 404, and an exception here would be a 500 instead.
test('a root holding neither folder returns null rather than throwing', () => {
  withEmptyProject((root) => {
    assert.equal(extractWorkstreamDetail(root, FIXTURE_ID), null);
  });
});
