// Unit tests for the id-shape compatibility rules in extract.ts. FlowCharge ids
// carry an optional six-character suffix (`TYPE-N` and `TYPE-N-SUFFIX` are both
// live), so every case below is asserted over BOTH shapes. These guard a real
// defect: before the fix, `artefactIdNumber('IL-9-000123')` returned 123 — a
// wrong but entirely plausible sort key — and every suffixed issue item was
// silently dropped from the board and the severity panel.
//
// Run with `node --test dist/test/unit/extract.test.js` after `npm run build`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ISSUE_ITEM, artefactIdNumber, extractPraxisData } from '../../lib/extract.js';
import { FIXTURE_GENERATIONS, withFixtureProject } from '../fixture-project.js';

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

// The frontmatter block every body fixture below sits under. It is a MINIMAL
// valid block — `---` on its own first line, keys, then a closing `---` — and
// the closing delimiter is load-bearing: without it stripFrontmatter returns the
// whole file and every case would assert against frontmatter text instead of a
// body. The trailing blank line is stripped by stripFrontmatter, so a body is
// read from its first non-newline character.
const BODY_FIXTURE_FRONTMATTER = `---
id: WS-1-aa11bb
type: workstream
slug: fixture
title: "Body fixture"
status: in-progress
created: 2026-01-01
updated: 2026-01-01
tags: []
depends_on: []
---

`;

// Writes a one-workstream tree carrying the CALLER'S body, runs `run` against
// its root, and removes the tree again. The body is written verbatim, so a
// caller can pass a body holding a `---` line, blank lines, or no text at all.
//
// Module-local on purpose: it is neither exported nor imported anywhere, unlike
// the shared builder in fixture-project.ts, which both suites import. That
// builder is left untouched — detail.test.ts asserts against its body today.
function withBodyProject(body: string, run: (root: string) => void): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'praxis-body-test-'));
  try {
    const dir = path.join(root, 'flowcharge', 'workstreams', 'WS-1-aa11bb-fixture');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'workstream.md'), BODY_FIXTURE_FRONTMATTER + body);
    run(root);
  } finally {
    // Removed even when an assertion throws, so a failing run leaves no tree behind.
    fs.rmSync(root, { recursive: true, force: true });
  }
}

// The split('---') corruption guard. A body line that starts `---` was cut at
// that line before the fix, because the old computation split on the delimiter
// instead of slicing from the END of the anchored frontmatter match.
test('a body line that starts --- survives intact', () => {
  withBodyProject('Intro line.\n--- a body line, not a delimiter\nTail line.', (root) => {
    const ws = extractPraxisData(root).workstreams[0];
    if (ws === undefined) throw new Error('fixture workstream missing');
    assert.equal(ws.body, 'Intro line.\n--- a body line, not a delimiter\nTail line.');
  });
});

test('a multi-paragraph body keeps its blank lines and its newlines', () => {
  withBodyProject('First paragraph.\n\nSecond paragraph.\n\nThird paragraph.', (root) => {
    const ws = extractPraxisData(root).workstreams[0];
    if (ws === undefined) throw new Error('fixture workstream missing');
    assert.equal(ws.body, 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.');
  });
});

// The three-line truncation guard: the old computation kept the first three
// lines and joined them with a space, so a longer body reached the payload as a
// one-line blurb.
test('a body of more than three lines comes back whole, not joined by spaces', () => {
  withBodyProject('Line one.\nLine two.\nLine three.\nLine four.\nLine five.', (root) => {
    const ws = extractPraxisData(root).workstreams[0];
    if (ws === undefined) throw new Error('fixture workstream missing');
    assert.equal(ws.body, 'Line one.\nLine two.\nLine three.\nLine four.\nLine five.');
  });
});

// `body` is typed `string` and is read straight into the modal, so an absent
// body has to be an empty string. `undefined` would print as an empty slot here
// but fails the type contract the modal reads under.
test('a workstream with frontmatter and no body yields an empty string', () => {
  withBodyProject('', (root) => {
    const ws = extractPraxisData(root).workstreams[0];
    if (ws === undefined) throw new Error('fixture workstream missing');
    assert.equal(ws.body, '');
  });
});
