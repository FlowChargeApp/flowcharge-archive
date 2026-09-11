// Unit tests for agentic-tools-chip-rules.ts's deriveIntegrationsRowDecision and
// updateOverwriteWarningNeeded — the Manage Integrations row rules lifted out of
// src/public/home.ts so a Node process can
// drive them. Plain node:test with object literals: no DOM, no fetch, no temporary
// directory and no fixture beyond the literals below. Every assertion reads the returned
// IntegrationsRowDecision; the module holds no user-facing string, so none is asserted.
//
// Run with `node --test dist/test/unit/agentic-tools-chip-rules.test.js` after
// `npm run build`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveIntegrationsRowDecision,
  updateOverwriteWarningNeeded
} from '../../lib/agentic-tools-chip-rules.js';
import type {
  IntegrationsRowRuleInput,
  SkillPresenceLike,
  UpdateOverwriteWarningInput
} from '../../lib/agentic-tools-chip-rules.js';

// Each presence literal is a member of the SkillPresenceLike union. A 'per-skill' member
// missing presentSkillIds or missingSkillIds does not type-check under strict.
const PER_SKILL_FULL: SkillPresenceLike = {
  checkKind: 'per-skill',
  status: 'fully-installed',
  presentSkillIds: ['fc-git', 'flowcharge'],
  missingSkillIds: []
};
const PER_SKILL_INCOMPLETE: SkillPresenceLike = {
  checkKind: 'per-skill',
  status: 'missing-incomplete',
  presentSkillIds: ['flowcharge'],
  missingSkillIds: ['fc-git']
};
const PER_SKILL_NONE: SkillPresenceLike = {
  checkKind: 'per-skill',
  status: 'not-installed',
  presentSkillIds: [],
  missingSkillIds: ['fc-git', 'flowcharge']
};
const SHARED_FILE_PRESENT: SkillPresenceLike = { checkKind: 'shared-file', exists: true };
const SHARED_FILE_ABSENT: SkillPresenceLike = { checkKind: 'shared-file', exists: false };
const NO_FORMAT: SkillPresenceLike = { checkKind: 'no-format' };

// An eligible, verified, global row with nothing installed and no release to compare
// against. Every case states only the fields it is about.
function input(overrides: Partial<IntegrationsRowRuleInput>): IntegrationsRowRuleInput {
  const base: IntegrationsRowRuleInput = {
    scopeKind: 'global',
    basePath: '/base',
    needsManualVerification: false,
    hasLiveResult: false,
    presence: undefined,
    installedVersion: undefined,
    ledgerVersion: undefined,
    latestReleaseTag: null
  };
  return { ...base, ...overrides };
}

// --- The decision table, one case per row ------------------------------------------

test('project scope ignores presence and reads the version from the ledger record', () => {
  const decision = deriveIntegrationsRowDecision(input({
    scopeKind: 'project',
    presence: PER_SKILL_FULL,
    installedVersion: '9.9.9',
    ledgerVersion: '1.0.0'
  }));
  assert.equal(decision.installChip, 'hidden');
  assert.deepEqual(decision.versionChip, { kind: 'version', major: 1, minor: 0, patch: 0 });
  assert.equal(decision.updateOffered, false);
});

test('a live install result leaves the install chip unchanged, whatever presence says', () => {
  const decision = deriveIntegrationsRowDecision(input({
    hasLiveResult: true,
    presence: PER_SKILL_INCOMPLETE,
    installedVersion: '2.0.0',
    latestReleaseTag: '2.1.0'
  }));
  assert.equal(decision.installChip, 'unchanged');
  assert.deepEqual(decision.versionChip, { kind: 'version', major: 2, minor: 0, patch: 0 });
  assert.equal(decision.updateOffered, true);
});

test('an absent presence result hides the install chip and leaves the ledger version', () => {
  const decision = deriveIntegrationsRowDecision(input({
    presence: undefined,
    ledgerVersion: '1.2.3'
  }));
  assert.equal(decision.installChip, 'hidden');
  assert.deepEqual(decision.versionChip, { kind: 'version', major: 1, minor: 2, patch: 3 });
  assert.equal(decision.updateOffered, false);
});

test('a fully installed per-skill result reads already-installed', () => {
  const decision = deriveIntegrationsRowDecision(input({
    presence: PER_SKILL_FULL,
    installedVersion: '1.0.0',
    latestReleaseTag: '1.0.1'
  }));
  assert.equal(decision.installChip, 'already-installed');
  assert.deepEqual(decision.versionChip, { kind: 'version', major: 1, minor: 0, patch: 0 });
  assert.equal(decision.updateOffered, true);
});

test('an incomplete per-skill result reads missing-skills and still carries a version', () => {
  const decision = deriveIntegrationsRowDecision(input({
    presence: PER_SKILL_INCOMPLETE,
    installedVersion: '1.0.0',
    latestReleaseTag: '1.0.1'
  }));
  assert.equal(decision.installChip, 'missing-skills');
  assert.deepEqual(decision.versionChip, { kind: 'version', major: 1, minor: 0, patch: 0 });
  assert.equal(decision.updateOffered, true);
});

test('a not-installed per-skill result hides the install chip, the version and the update', () => {
  const decision = deriveIntegrationsRowDecision(input({
    presence: PER_SKILL_NONE,
    installedVersion: null,
    ledgerVersion: '1.0.0',
    latestReleaseTag: '9.9.9'
  }));
  assert.equal(decision.installChip, 'hidden');
  assert.deepEqual(decision.versionChip, { kind: 'hidden' });
  assert.equal(decision.updateOffered, false);
});

test('a present shared file reads already-installed', () => {
  const decision = deriveIntegrationsRowDecision(input({
    presence: SHARED_FILE_PRESENT,
    ledgerVersion: '1.0.0',
    latestReleaseTag: '1.1.0'
  }));
  assert.equal(decision.installChip, 'already-installed');
  assert.deepEqual(decision.versionChip, { kind: 'version', major: 1, minor: 0, patch: 0 });
  assert.equal(decision.updateOffered, true);
});

test('an absent shared file hides the install chip and leaves the other rules alone', () => {
  const decision = deriveIntegrationsRowDecision(input({
    presence: SHARED_FILE_ABSENT,
    ledgerVersion: '1.0.0',
    latestReleaseTag: '1.1.0'
  }));
  assert.equal(decision.installChip, 'hidden');
  assert.deepEqual(decision.versionChip, { kind: 'version', major: 1, minor: 0, patch: 0 });
  assert.equal(decision.updateOffered, true);
});

test('a no-format result hides the install chip and leaves the other rules alone', () => {
  const decision = deriveIntegrationsRowDecision(input({
    presence: NO_FORMAT,
    ledgerVersion: '1.0.0',
    latestReleaseTag: '1.1.0'
  }));
  assert.equal(decision.installChip, 'hidden');
  assert.deepEqual(decision.versionChip, { kind: 'version', major: 1, minor: 0, patch: 0 });
  assert.equal(decision.updateOffered, true);
});

// --- Version resolution -------------------------------------------------------------

test('the installed version wins over the ledger version', () => {
  const decision = deriveIntegrationsRowDecision(input({
    presence: PER_SKILL_FULL,
    installedVersion: '2.3.4',
    ledgerVersion: '1.0.0'
  }));
  assert.deepEqual(decision.versionChip, { kind: 'version', major: 2, minor: 3, patch: 4 });
});

test('an empty or null installed version falls back to the ledger version', () => {
  const empty = deriveIntegrationsRowDecision(input({
    presence: PER_SKILL_FULL,
    installedVersion: '',
    ledgerVersion: '1.0.0'
  }));
  assert.deepEqual(empty.versionChip, { kind: 'version', major: 1, minor: 0, patch: 0 });

  const nulled = deriveIntegrationsRowDecision(input({
    presence: PER_SKILL_FULL,
    installedVersion: null,
    ledgerVersion: '1.0.0'
  }));
  assert.deepEqual(nulled.versionChip, { kind: 'version', major: 1, minor: 0, patch: 0 });
});

test('no version at either source reads unknown', () => {
  const decision = deriveIntegrationsRowDecision(input({
    presence: PER_SKILL_FULL,
    installedVersion: null,
    ledgerVersion: undefined
  }));
  assert.deepEqual(decision.versionChip, { kind: 'unknown' });
});

test('an unparseable version reads unknown', () => {
  const decision = deriveIntegrationsRowDecision(input({
    presence: PER_SKILL_FULL,
    installedVersion: 'not-a-version'
  }));
  assert.deepEqual(decision.versionChip, { kind: 'unknown' });
});

test('a suffixed version yields the numeric triple only', () => {
  const decision = deriveIntegrationsRowDecision(input({
    presence: PER_SKILL_FULL,
    installedVersion: '1.2.3-beta.1'
  }));
  assert.deepEqual(decision.versionChip, { kind: 'version', major: 1, minor: 2, patch: 3 });
});

// --- The update offer ---------------------------------------------------------------

test('a strictly newer release tag offers the update', () => {
  const decision = deriveIntegrationsRowDecision(input({
    ledgerVersion: '1.0.0',
    latestReleaseTag: 'v1.0.1'
  }));
  assert.equal(decision.updateOffered, true);
});

test('an equal release tag offers no update', () => {
  const decision = deriveIntegrationsRowDecision(input({
    ledgerVersion: '1.0.0',
    latestReleaseTag: 'v1.0.0'
  }));
  assert.equal(decision.updateOffered, false);
});

test('an older release tag offers no update', () => {
  const decision = deriveIntegrationsRowDecision(input({
    ledgerVersion: '1.0.0',
    latestReleaseTag: 'v0.9.9'
  }));
  assert.equal(decision.updateOffered, false);
});

test('an unreadable version on either side offers no update', () => {
  const badTag = deriveIntegrationsRowDecision(input({
    ledgerVersion: '1.0.0',
    latestReleaseTag: 'nightly'
  }));
  assert.equal(badTag.updateOffered, false);

  const badVersion = deriveIntegrationsRowDecision(input({
    ledgerVersion: 'nightly',
    latestReleaseTag: 'v9.9.9'
  }));
  assert.equal(badVersion.updateOffered, false);
});

test('a null latest release offers no update', () => {
  const decision = deriveIntegrationsRowDecision(input({
    ledgerVersion: '1.0.0',
    latestReleaseTag: null
  }));
  assert.equal(decision.updateOffered, false);
});

test('no update is offered while the version chip is hidden', () => {
  // A newer tag AND a readable version, so only the hidden version chip can be what
  // withholds the offer.
  const decision = deriveIntegrationsRowDecision(input({
    presence: PER_SKILL_NONE,
    ledgerVersion: '1.0.0',
    latestReleaseTag: 'v9.9.9'
  }));
  assert.deepEqual(decision.versionChip, { kind: 'hidden' });
  assert.equal(decision.updateOffered, false);
});

// --- Eligibility --------------------------------------------------------------------

test('a non-null base path is eligible and carries no scope note', () => {
  const decision = deriveIntegrationsRowDecision(input({ basePath: '/base' }));
  assert.equal(decision.eligible, true);
  assert.deepEqual(decision.notes, []);
});

test('a null base path is ineligible, notes the scope and still reports the same chips', () => {
  const shared: Partial<IntegrationsRowRuleInput> = {
    presence: PER_SKILL_INCOMPLETE,
    installedVersion: '1.0.0',
    latestReleaseTag: 'v1.1.0'
  };
  const eligible = deriveIntegrationsRowDecision(input({ ...shared, basePath: '/base' }));
  const ineligible = deriveIntegrationsRowDecision(input({ ...shared, basePath: null }));

  assert.equal(ineligible.eligible, false);
  assert.deepEqual(ineligible.notes, ['not-supported-at-scope']);
  // Ineligibility disables controls; it never hides a chip.
  assert.equal(ineligible.installChip, eligible.installChip);
  assert.deepEqual(ineligible.versionChip, eligible.versionChip);
  assert.equal(ineligible.updateOffered, eligible.updateOffered);
});

// --- Notes --------------------------------------------------------------------------

test('an ineligible, unverified row reports both notes, scope first', () => {
  const decision = deriveIntegrationsRowDecision(input({
    basePath: null,
    needsManualVerification: true
  }));
  assert.deepEqual(decision.notes, ['not-supported-at-scope', 'path-unverified']);
});

test('an eligible, verified row reports no note', () => {
  const decision = deriveIntegrationsRowDecision(input({
    basePath: '/base',
    needsManualVerification: false
  }));
  assert.deepEqual(decision.notes, []);
});

// --- The update overwrite warning ----------------------------------------------------

// A loaded ledger holding no record for this row, and no install by FlowCharge in this
// dialog session. Every case states only the fields it is about.
function warningInput(
  overrides: Partial<UpdateOverwriteWarningInput>
): UpdateOverwriteWarningInput {
  const base: UpdateOverwriteWarningInput = {
    ledgerLoaded: true,
    hasLedgerRecord: false,
    installedThisSession: false
  };
  return { ...base, ...overrides };
}

test('a loaded ledger holding a record needs no warning', () => {
  assert.equal(updateOverwriteWarningNeeded(warningInput({ hasLedgerRecord: true })), false);
});

test('a loaded ledger holding no record needs the warning', () => {
  assert.equal(updateOverwriteWarningNeeded(warningInput({ hasLedgerRecord: false })), true);
});

test('an unloaded ledger needs the warning, record or no record', () => {
  assert.equal(
    updateOverwriteWarningNeeded(warningInput({ ledgerLoaded: false, hasLedgerRecord: false })),
    true
  );
  // The record's presence must not carry the assertion above: an unloaded ledger's
  // record map is empty either way, so it says nothing about the files on disk.
  assert.equal(
    updateOverwriteWarningNeeded(warningInput({ ledgerLoaded: false, hasLedgerRecord: true })),
    true
  );
});

test('an install by FlowCharge in this session needs no warning', () => {
  assert.equal(
    updateOverwriteWarningNeeded(warningInput({ installedThisSession: true })),
    false
  );
  assert.equal(
    updateOverwriteWarningNeeded(
      warningInput({ ledgerLoaded: false, hasLedgerRecord: false, installedThisSession: true })
    ),
    false
  );
});
