// Unit tests for agentic-tools-install.ts's installToTarget and
// removeInstallation, covering Phase 1/2's skill-directory and rule-directory
// writes plus Phase 3's install/no-op/update/remove lifecycle (plan
// acceptance criteria 4-6). Proven end to end against Claude Code's and
// Cursor's real WS-41 catalogue entries. Follows extract.test.ts's node:test
// + node:assert/strict pattern.
//
// Run with `node --test dist/lib/agentic-tools-install.test.js` after
// `npm run build`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TOOL_CATALOGUE } from './agentic-tools-catalogue.js';
import type { ToolDefinition } from './agentic-tools-catalogue.js';
import type { GetInstallContent, InstallContent } from './agentic-tools-content.js';
import type { FsWriteAccess, InstallTarget } from './agentic-tools-install.js';
import { installAllGlobal, installToTarget, removeInstallation } from './agentic-tools-install.js';

const REGISTRY_PATH = '/home/fakeuser/.praxis-installs.json';

// A fake FsWriteAccess that records every call AND persists an in-memory
// file map, so sequential installToTarget/removeInstallation calls within
// one test see each other's writes (required for the no-op/update/remove
// lifecycle tests below) — a fresh fake per call would defeat the no-op
// assertion entirely.
function fakeFsWriteAccess(): FsWriteAccess & { calls: { fn: string; path: string; content?: string }[] } {
  const calls: { fn: string; path: string; content?: string }[] = [];
  const files = new Map<string, string>();
  return {
    calls,
    async readTextFile(path) {
      calls.push({ fn: 'readTextFile', path });
      return files.has(path) ? files.get(path)! : null;
    },
    async writeTextFileAtomic(path, content) {
      calls.push({ fn: 'writeTextFileAtomic', path, content });
      files.set(path, content);
    },
    async mkdir(path) {
      calls.push({ fn: 'mkdir', path });
    },
    async remove(path) {
      calls.push({ fn: 'remove', path });
      files.delete(path);
    },
    async expandTokens(path) {
      return path;
    },
  };
}

const twoSkillContent: InstallContent = {
  version: '1',
  skills: [
    {
      id: 'prx-alpha',
      name: 'Alpha',
      description: 'Alpha skill',
      body: 'alpha body',
      files: [{ relativePath: 'reference.md', content: 'reference content' }],
    },
    {
      id: 'prx-beta',
      name: 'Beta',
      description: 'Beta skill',
      body: 'beta body',
    },
  ],
};

const twoSkillContentChanged: InstallContent = {
  version: '1',
  skills: [
    {
      id: 'prx-alpha',
      name: 'Alpha',
      description: 'Alpha skill',
      body: 'alpha body v2',
      files: [{ relativePath: 'reference.md', content: 'reference content' }],
    },
    {
      id: 'prx-beta',
      name: 'Beta',
      description: 'Beta skill',
      body: 'beta body',
    },
  ],
};

function claudeCode() {
  const tool = TOOL_CATALOGUE.find((t) => t.id === 'claude-code');
  if (tool === undefined) throw new Error('claude-code missing from TOOL_CATALOGUE');
  return tool;
}

function cursor() {
  const tool = TOOL_CATALOGUE.find((t) => t.id === 'cursor');
  if (tool === undefined) throw new Error('cursor missing from TOOL_CATALOGUE');
  return tool;
}

// Content writes only, excluding the registry file itself — Phase 3's
// registry persistence write is asserted separately in the lifecycle tests
// below, and would otherwise double-count against these Phase 1/2 assertions.
function contentWriteCalls(fsWrite: ReturnType<typeof fakeFsWriteAccess>) {
  return fsWrite.calls.filter((c) => c.fn === 'writeTextFileAtomic' && c.path !== REGISTRY_PATH);
}

test('installToTarget writes exactly the expected files at the expected resolved paths for Claude Code', async () => {
  const fsWrite = fakeFsWriteAccess();
  const target: InstallTarget = { tool: claudeCode(), basePath: '/home/fakeuser/.claude', scope: { kind: 'global' } };

  const result = await installToTarget(target, twoSkillContent, REGISTRY_PATH, { fsWrite });

  assert.equal(result.status, 'installed');
  assert.equal(result.toolId, 'claude-code');
  assert.equal(result.resolvedPath, '/home/fakeuser/.claude/skills/prx-alpha/SKILL.md');

  const writeCalls = contentWriteCalls(fsWrite);
  assert.deepEqual(
    writeCalls.map((c) => c.path),
    [
      '/home/fakeuser/.claude/skills/prx-alpha/SKILL.md',
      '/home/fakeuser/.claude/skills/prx-alpha/reference.md',
      '/home/fakeuser/.claude/skills/prx-beta/SKILL.md',
    ],
  );
  assert.equal(writeCalls[0]?.content, 'alpha body');
  assert.equal(writeCalls[1]?.content, 'reference content');
  assert.equal(writeCalls[2]?.content, 'beta body');
});

test('installToTarget returns skipped-no-format rather than throwing when no non-mcp-json format exists', async () => {
  const fsWrite = fakeFsWriteAccess();
  const noFormatTool = {
    id: 'mcp-only-tool',
    displayName: 'MCP Only Tool',
    category: 'cli' as const,
    configDir: {},
    integrationFormats: [{ kind: 'mcp-json' as const, pathTemplate: '.mcp.json' }],
  };
  const target: InstallTarget = { tool: noFormatTool, basePath: '/home/fakeuser/.mcp-only', scope: { kind: 'global' } };

  const result = await installToTarget(target, twoSkillContent, REGISTRY_PATH, { fsWrite });

  assert.equal(result.status, 'skipped-no-format');
  assert.equal(result.resolvedPath, null);
  assert.equal(fsWrite.calls.filter((c) => c.fn === 'writeTextFileAtomic').length, 0);
});

test('installToTarget writes exactly the expected rule-directory files for Cursor at global scope', async () => {
  const fsWrite = fakeFsWriteAccess();
  const target: InstallTarget = { tool: cursor(), basePath: '/home/fakeuser/.cursor', scope: { kind: 'global' } };

  const result = await installToTarget(target, twoSkillContent, REGISTRY_PATH, { fsWrite });

  assert.equal(result.status, 'installed');
  assert.equal(result.toolId, 'cursor');
  // Cursor's real catalogue rule-directory format resolves to a rules entry,
  // never the mcp-json entry that sits alongside it.
  assert.equal(result.resolvedPath, '/home/fakeuser/.cursor/.cursor/rules/prx-alpha.mdc');

  const writeCalls = contentWriteCalls(fsWrite);
  assert.deepEqual(
    writeCalls.map((c) => c.path),
    [
      '/home/fakeuser/.cursor/.cursor/rules/prx-alpha.mdc',
      '/home/fakeuser/.cursor/.cursor/rules/prx-beta.mdc',
    ],
  );
  assert.equal(writeCalls[0]?.content, 'alpha body');
  assert.equal(writeCalls[1]?.content, 'beta body');
});

test('installToTarget install/no-op/update lifecycle against Claude Code (acceptance criteria 4, 5)', async () => {
  const fsWrite = fakeFsWriteAccess();
  const target: InstallTarget = { tool: claudeCode(), basePath: '/home/fakeuser/.claude', scope: { kind: 'global' } };

  // (1) First call writes files and returns 'installed'.
  const first = await installToTarget(target, twoSkillContent, REGISTRY_PATH, { fsWrite });
  assert.equal(first.status, 'installed');
  const firstWriteCount = contentWriteCalls(fsWrite).length;
  assert.equal(firstWriteCount, 3);

  // (2) A second call with byte-identical InstallContent makes zero
  // additional writeTextFileAtomic calls to any content path and returns
  // 'up-to-date' (criterion 4's exact zero-write requirement).
  const callsBeforeSecond = fsWrite.calls.filter((c) => c.fn === 'writeTextFileAtomic').length;
  const second = await installToTarget(target, twoSkillContent, REGISTRY_PATH, { fsWrite });
  assert.equal(second.status, 'up-to-date');
  assert.equal(second.resolvedPath, first.resolvedPath);
  const callsAfterSecond = fsWrite.calls.filter((c) => c.fn === 'writeTextFileAtomic').length;
  assert.equal(callsAfterSecond, callsBeforeSecond, 'no writeTextFileAtomic call at all on a no-op');

  const registryRawAfterFirst = await fsWrite.readTextFile(REGISTRY_PATH);
  assert.ok(registryRawAfterFirst);
  const recordAfterFirst = (
    JSON.parse(registryRawAfterFirst!) as { toolId: string; contentHash: string; installedAt: string; updatedAt: string }[]
  ).find((r) => r.toolId === 'claude-code');
  assert.ok(recordAfterFirst);

  // (3) A third call with a changed skill body overwrites the previously
  // written files and bumps the tracking record's updatedAt/contentHash,
  // while installedAt (set once, on first install) stays fixed. A short
  // delay guarantees the ISO timestamp actually advances past millisecond
  // resolution, so the updatedAt-bump assertion below is not flaky.
  await new Promise((resolve) => setTimeout(resolve, 2));
  const third = await installToTarget(target, twoSkillContentChanged, REGISTRY_PATH, { fsWrite });
  assert.equal(third.status, 'updated');
  const alphaSkillWrites = fsWrite.calls.filter(
    (c) => c.fn === 'writeTextFileAtomic' && c.path === '/home/fakeuser/.claude/skills/prx-alpha/SKILL.md',
  );
  const alphaSkillWrite = alphaSkillWrites[alphaSkillWrites.length - 1];
  assert.equal(alphaSkillWrite?.content, 'alpha body v2');

  const registryRaw = await fsWrite.readTextFile(REGISTRY_PATH);
  assert.ok(registryRaw);
  const records = JSON.parse(registryRaw!) as { toolId: string; contentHash: string; installedAt: string; updatedAt: string }[];
  const record = records.find((r) => r.toolId === 'claude-code');
  assert.ok(record);
  assert.equal(record!.installedAt, recordAfterFirst!.installedAt, 'installedAt stays fixed across an update');
  assert.notEqual(record!.contentHash, recordAfterFirst!.contentHash, 'contentHash changes to reflect the new content');
  assert.notEqual(record!.updatedAt, recordAfterFirst!.updatedAt, 'updatedAt bumps on a content change');
});

test('removeInstallation deletes the tracked file and the record for that (toolId, scope) pair (acceptance criterion 6)', async () => {
  const fsWrite = fakeFsWriteAccess();
  const target: InstallTarget = { tool: claudeCode(), basePath: '/home/fakeuser/.claude', scope: { kind: 'global' } };

  const installed = await installToTarget(target, twoSkillContent, REGISTRY_PATH, { fsWrite });
  assert.ok(installed.resolvedPath);

  await removeInstallation('claude-code', { kind: 'global' }, REGISTRY_PATH, { fsWrite });

  const removeCalls = fsWrite.calls.filter((c) => c.fn === 'remove');
  assert.deepEqual(removeCalls.map((c) => c.path), [installed.resolvedPath]);

  const registryRaw = await fsWrite.readTextFile(REGISTRY_PATH);
  assert.ok(registryRaw);
  const records = JSON.parse(registryRaw!) as { toolId: string }[];
  assert.equal(records.find((r) => r.toolId === 'claude-code'), undefined);
});

test('removeInstallation against a nonexistent (toolId, scope) pair does not throw', async () => {
  const fsWrite = fakeFsWriteAccess();
  await assert.doesNotReject(() =>
    removeInstallation('claude-code', { kind: 'global' }, REGISTRY_PATH, { fsWrite }),
  );
  assert.equal(fsWrite.calls.filter((c) => c.fn === 'remove').length, 0);
});

test('installAllGlobal runs across the real four-tool TOOL_CATALOGUE with no write ever reaching mcp-json', async () => {
  const fsWrite = fakeFsWriteAccess();
  const resolveGlobalBasePath = (tool: ToolDefinition) => `/home/fakeuser/.${tool.id}`;
  const getInstallContent: GetInstallContent = async () => twoSkillContent;

  const results = await installAllGlobal(TOOL_CATALOGUE, resolveGlobalBasePath, REGISTRY_PATH, {
    fsWrite,
    getInstallContent,
  });

  // One InstallResult per catalogue entry, in catalogue order.
  assert.equal(results.length, 4);
  assert.deepEqual(results.map((r) => r.toolId), TOOL_CATALOGUE.map((t) => t.id));

  // Claude Code, Cursor, Windsurf, and OpenCode all resolve to a real,
  // implemented format and install successfully. (installAllGlobal's
  // try/catch around each per-tool install remains defensive for any future
  // catalogue entry that resolves to an unimplemented format — it just isn't
  // exercised by any of these four tools today.)
  for (const toolId of ['claude-code', 'cursor', 'windsurf', 'opencode']) {
    const result = results.find((r) => r.toolId === toolId);
    assert.ok(result, `missing InstallResult for ${toolId}`);
    assert.equal(result!.status, 'installed', `expected ${toolId} to install`);
  }

  // No recorded write ever targets an mcp-json path — mcp-json is excluded
  // by selectPrimaryFormat and guarded independently inside formatForTarget,
  // so it should never be reachable from installAllGlobal for any tool.
  const writeCalls = contentWriteCalls(fsWrite);
  assert.ok(writeCalls.length > 0);
  for (const call of writeCalls) {
    assert.ok(!call.path.endsWith('.cursor/mcp.json'), `unexpected mcp-json write: ${call.path}`);
    assert.ok(!call.path.endsWith('mcp_config.json'), `unexpected mcp-json write: ${call.path}`);
  }
});
