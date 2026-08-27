// Unit tests for the id-shape compatibility rules in extract.ts. Praxis ids
// carry an optional six-character suffix (`TYPE-N` and `TYPE-N-SUFFIX` are both
// live), so every case below is asserted over BOTH shapes. These guard a real
// defect: before the fix, `artefactIdNumber('IL-9-000123')` returned 123 — a
// wrong but entirely plausible sort key — and every suffixed issue item was
// silently dropped from the board and the severity panel.
//
// Run with `node --test dist/lib/extract.test.js` after `npm run build`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ISSUE_ITEM, artefactIdNumber, extractPraxisData } from './extract.js';
import { FIXTURE_GENERATIONS, withFixtureProject } from './fixture-project.js';

// Re-exported so the shared builder is reachable under this module's name too.
// The builder itself lives in fixture-project.ts, NOT here: importing one test
// file from another registers the imported file's tests a second time, and the
// detail.ts suite therefore imports fixture-project.js directly.
export { FIXTURE_GENERATIONS, withFixtureProject };

// A regex match is `RegExpMatchArray | null` under `strict`, so the null case is
// discharged here, once, rather than at every index below.
function mustMatch(line: string, re: RegExp): RegExpMatchArray {
  const m = line.match(re);
  if (m === null) throw new Error(`expected ${JSON.stringify(line)} to match ${re}`);
  return m;
}

test('artefactIdNumber reads the sequence number, not the suffix', () => {
  assert.equal(artefactIdNumber('TL-175'), 175);
  assert.equal(artefactIdNumber('TL-175-ab12cd'), 175);
  // The regression case. An all-digit suffix is legal, and reading the segment
  // after the FINAL hyphen returned 123 here.
  assert.equal(artefactIdNumber('IL-9-000123'), 9);
});

test('artefactIdNumber falls back to 0, never NaN, when no number parses', () => {
  const n = artefactIdNumber('NOTANID');
  assert.equal(n, 0);
  assert.ok(Number.isFinite(n), 'sort key must be finite, or sort order is implementation-defined');
});

test('ISSUE_ITEM matches an unsuffixed item and captures mark, whole id and title', () => {
  const m = mustMatch('- [x] ISS-2. Some title', ISSUE_ITEM);
  assert.equal(m[1], 'x');
  assert.equal(m[2], 'ISS-2');
  assert.equal(m[3], 'Some title');
});

test('ISSUE_ITEM matches a suffixed item and captures the WHOLE id', () => {
  const m = mustMatch('- [x] ISS-18-awinon. Some title', ISSUE_ITEM);
  assert.equal(m[1], 'x');
  assert.equal(m[2], 'ISS-18-awinon');
  assert.equal(m[3], 'Some title');
});

test('ISSUE_ITEM captures an unchecked mark over both id shapes', () => {
  assert.equal(mustMatch('- [ ] ISS-2. Some title', ISSUE_ITEM)[1], ' ');
  assert.equal(mustMatch('- [ ] ISS-18-awinon. Some title', ISSUE_ITEM)[1], ' ');
});

// The two remaining issue patterns live inside the issuelist branch of the
// extraction loop and are not exported. They are asserted through the exported
// extraction path rather than by re-declaring the literals here: a copied
// literal would pass while the file's own pattern stayed broken, which is
// exactly the failure these tests exist to catch.

// The two extraction tests below are run once per generation. Their assertions
// are unchanged — only the fixture's name generation varies — so the id-shape
// defect they guard keeps its coverage and gains generation coverage.
for (const generation of FIXTURE_GENERATIONS) {
  test(`the extraction path collects issues of both id shapes (${generation})`, () => {
    withFixtureProject((root) => {
      const data = extractPraxisData(root);
      assert.equal(data.issues.length, 2, 'both the suffixed and the unsuffixed item must survive the split');

      const unsuffixed = data.issues.find((i) => i.id === 'ISS-2');
      if (unsuffixed === undefined) throw new Error('ISS-2 missing from issues[]');
      assert.equal(unsuffixed.title, 'Unsuffixed issue title');
      assert.equal(unsuffixed.checked, true);
      assert.equal(unsuffixed.severity, 'medium');
      assert.equal(unsuffixed.status, 'done');
      assert.equal(unsuffixed.workstream, 'WS-1-aa11bb');

      const suffixed = data.issues.find((i) => i.id === 'ISS-18-awinon');
      if (suffixed === undefined) throw new Error('ISS-18-awinon missing from issues[]');
      assert.equal(suffixed.title, 'Suffixed issue title');
      assert.equal(suffixed.checked, false);
      assert.equal(suffixed.severity, 'high');
      assert.equal(suffixed.status, 'open');
      assert.equal(suffixed.workstream, 'WS-1-aa11bb');
    }, generation);
  });

  test(`the issue counter counts items of both id shapes (${generation})`, () => {
    withFixtureProject((root) => {
      const artefacts = data(root);
      const issuelist = artefacts.find((a) => a.type === 'issuelist');
      if (issuelist === undefined) throw new Error('issuelist artefact missing');
      assert.equal(issuelist.total, 2, 'ISSUE_ITEM must count both item forms');
      assert.equal(issuelist.done, 1);
    }, generation);
  });

  // Acceptance criterion 8, board side. A marker file carries `id` and
  // `type: workstream` in its own frontmatter, so a marker the artefact loop
  // fails to skip lands on the card as a phantom row.
  test(`no marker file reaches the artefact rows (${generation})`, () => {
    withFixtureProject((root) => {
      assert.deepEqual(data(root).filter((a) => a.type === 'workstream'), []);
    }, generation);
  });
}

// The artefact filename changed upstream too, and it must cost zero production
// lines: both parsers key on frontmatter `type`, never on the filename.
test('a bare-named artefact file parses identically to the prx-prefixed one', () => {
  let bare: PraxisArtefact[] = [];
  let prefixed: PraxisArtefact[] = [];
  withFixtureProject((root) => { bare = data(root); }, 'flowcharge');
  withFixtureProject((root) => { prefixed = data(root); }, 'flowcharge', { artefact: 'prxissuelist.md' });
  assert.deepEqual(bare, prefixed);
  assert.equal(bare.length, 1);
  assert.equal(bare[0].type, 'issuelist');
});

// Acceptance criterion 7. A half-renamed tree is a real state, and neither
// direction may lose its card: the tree folder and the marker file are renamed
// by separate upstream steps, so they are found out of step with each other.
test('a flowcharge/ tree holding the legacy marker still yields a workstream', () => {
  withFixtureProject((root) => {
    const ws = extractPraxisData(root).workstreams;
    assert.equal(ws.length, 1, 'prxworkstream.md inside flowcharge/ must not be skipped silently');
    assert.equal(ws[0].id, 'WS-1-aa11bb');
    assert.deepEqual(ws[0].artefacts.filter((a) => a.type === 'workstream'), []);
  }, 'flowcharge', { marker: 'prxworkstream.md' });
});

test('a prxwork/ tree holding the current marker still yields a workstream', () => {
  withFixtureProject((root) => {
    const ws = extractPraxisData(root).workstreams;
    assert.equal(ws.length, 1, 'workstream.md inside prxwork/ must not be skipped silently');
    assert.equal(ws[0].id, 'WS-1-aa11bb');
    assert.deepEqual(ws[0].artefacts.filter((a) => a.type === 'workstream'), []);
  }, 'prxwork', { marker: 'workstream.md' });
});

function data(root: string): PraxisArtefact[] {
  const ws = extractPraxisData(root).workstreams[0];
  if (ws === undefined) throw new Error('fixture workstream missing');
  return ws.artefacts;
}
