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
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ISSUE_ITEM, artefactIdNumber, extractPraxisData } from './extract.js';

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
const WORKSTREAM_FILE = `---
id: WS-1-aa11bb
type: workstream
slug: fixture
title: "Fixture workstream"
status: in-progress
created: 2026-01-01
updated: 2026-01-01
tags: []
depends_on: []
---

# Fixture
`;

const ISSUELIST_FILE = `---
id: IL-1-cc22dd
type: issuelist
workstream: WS-1-aa11bb
slug: fixture
title: "Fixture issues"
status: in-progress
created: 2026-01-01
updated: 2026-01-01
depends_on: []
links: []
---

# PRX Issue List

- [x] ISS-2. Unsuffixed issue title

  \`\`\`yaml
  id: ISS-2
  status: done
  severity: medium
  \`\`\`

- [ ] ISS-18-awinon. Suffixed issue title

  \`\`\`yaml
  id: ISS-18-awinon
  status: open
  severity: high
  \`\`\`
`;

function withFixtureProject(run: (root: string) => void): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'praxis-extract-test-'));
  try {
    const dir = path.join(root, 'prxwork', 'workstreams', 'WS-1-aa11bb-fixture');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'prxworkstream.md'), WORKSTREAM_FILE);
    fs.writeFileSync(path.join(dir, 'prxissuelist.md'), ISSUELIST_FILE);
    run(root);
  } finally {
    // Removed even when an assertion throws, so a failing run leaves no tree behind.
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('the extraction path collects issues of both id shapes', () => {
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
  });
});

test('the issue counter counts items of both id shapes', () => {
  withFixtureProject((root) => {
    const artefacts = data(root);
    const issuelist = artefacts.find((a) => a.type === 'issuelist');
    if (issuelist === undefined) throw new Error('issuelist artefact missing');
    assert.equal(issuelist.total, 2, 'ISSUE_ITEM must count both item forms');
    assert.equal(issuelist.done, 1);
  });
});

function data(root: string): PraxisArtefact[] {
  const ws = extractPraxisData(root).workstreams[0];
  if (ws === undefined) throw new Error('fixture workstream missing');
  return ws.artefacts;
}
