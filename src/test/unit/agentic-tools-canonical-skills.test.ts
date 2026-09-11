// Unit tests for agentic-tools-canonical-skills.ts's CANONICAL_PRAXIS_SKILL_IDS.
// Pins the list against the hand-maintained golden literal in
// src/test/expected-skill-ids.ts, so a drift in either one must be a
// deliberate edit made in both places. Deterministic and offline: it compares
// two literals and makes no network call.
//
// Run with `node --test dist/test/unit/agentic-tools-canonical-skills.test.js` after
// `npm run build`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CANONICAL_PRAXIS_SKILL_IDS } from '../../lib/agentic-tools-canonical-skills.js';
import { EXPECTED_CANONICAL_SKILL_IDS } from '../expected-skill-ids.js';

test('CANONICAL_PRAXIS_SKILL_IDS holds exactly the expected skill ids', () => {
  // Sort a copy — Array.prototype.sort mutates, and reordering the exported
  // array would leak into every later case in the same process. Sorting both
  // sides pins membership and count, and deliberately does not pin the
  // declaration order in the source file.
  const sorted = CANONICAL_PRAXIS_SKILL_IDS.slice().sort();
  assert.deepEqual(sorted, EXPECTED_CANONICAL_SKILL_IDS);
});

test('CANONICAL_PRAXIS_SKILL_IDS contains no duplicate id', () => {
  const unique = new Set(CANONICAL_PRAXIS_SKILL_IDS);
  assert.equal(CANONICAL_PRAXIS_SKILL_IDS.length, unique.size);
});

test('CANONICAL_PRAXIS_SKILL_IDS excludes ak-prx-migrate', () => {
  // The source file's own header comment names 'ak-prx-migrate' as a real
  // skill deliberately excluded from this suite. Hold that exclusion.
  assert.equal(CANONICAL_PRAXIS_SKILL_IDS.includes('ak-prx-migrate'), false);
});
