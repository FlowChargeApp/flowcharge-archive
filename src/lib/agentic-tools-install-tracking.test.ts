// Unit tests for agentic-tools-install-tracking.ts's pure registry functions,
// per plan Phase 3 task 1's verify line. Follows extract.test.ts's node:test
// + node:assert/strict pattern.
//
// Run with `node --test dist/lib/agentic-tools-install-tracking.test.js`
// after `npm run build`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseInstallRegistry,
  serializeInstallRegistry,
  upsertInstallRecord,
  findInstallRecord,
  removeInstallRecord,
} from './agentic-tools-install-tracking.js';
import type { InstallRecord } from './agentic-tools-install-tracking.js';

function record(overrides: Partial<InstallRecord> = {}): InstallRecord {
  return {
    toolId: 'claude-code',
    resolvedPath: '/home/fakeuser/.claude/skills/prx-alpha/SKILL.md',
    format: 'skill-directory',
    scope: { kind: 'global' },
    installedAt: '2026-08-19T00:00:00.000Z',
    updatedAt: '2026-08-19T00:00:00.000Z',
    contentHash: 'abc123',
    ...overrides,
  };
}

test('parseInstallRegistry(serializeInstallRegistry(records)) round-trips to an equivalent InstallRecord[]', () => {
  const records = [record(), record({ toolId: 'cursor', scope: { kind: 'project', projectPath: '/repo' } })];
  const roundTripped = parseInstallRegistry(serializeInstallRegistry(records));
  assert.deepEqual(roundTripped, records);
});

test('parseInstallRegistry returns [] on malformed input rather than throwing', () => {
  assert.deepEqual(parseInstallRegistry('not json'), []);
  assert.deepEqual(parseInstallRegistry('{"not":"an array"}'), []);
  assert.deepEqual(parseInstallRegistry(''), []);
});

test('upsertInstallRecord called twice for the same (toolId, scope) leaves exactly one record for that pair', () => {
  const first = record({ contentHash: 'hash-1' });
  const second = record({ contentHash: 'hash-2' });

  let records: InstallRecord[] = [];
  records = upsertInstallRecord(records, first);
  records = upsertInstallRecord(records, second);

  assert.equal(records.length, 1);
  assert.equal(records[0]?.contentHash, 'hash-2');
});

test('upsertInstallRecord keeps records with different scopes for the same toolId distinct', () => {
  const globalRecord = record({ scope: { kind: 'global' } });
  const projectRecord = record({ scope: { kind: 'project', projectPath: '/repo' } });

  let records: InstallRecord[] = [];
  records = upsertInstallRecord(records, globalRecord);
  records = upsertInstallRecord(records, projectRecord);

  assert.equal(records.length, 2);
});

test('findInstallRecord finds by (toolId, scope), matching project scope by projectPath', () => {
  const records = [
    record({ scope: { kind: 'project', projectPath: '/repo-a' } }),
    record({ scope: { kind: 'project', projectPath: '/repo-b' }, contentHash: 'repo-b-hash' }),
  ];

  const found = findInstallRecord(records, 'claude-code', { kind: 'project', projectPath: '/repo-b' });
  assert.equal(found?.contentHash, 'repo-b-hash');

  const notFound = findInstallRecord(records, 'claude-code', { kind: 'project', projectPath: '/repo-c' });
  assert.equal(notFound, undefined);
});

test('removeInstallRecord removes only the record matching (toolId, scope)', () => {
  const records = [
    record({ scope: { kind: 'global' } }),
    record({ toolId: 'cursor', scope: { kind: 'global' } }),
  ];

  const next = removeInstallRecord(records, 'claude-code', { kind: 'global' });
  assert.equal(next.length, 1);
  assert.equal(next[0]?.toolId, 'cursor');
});
