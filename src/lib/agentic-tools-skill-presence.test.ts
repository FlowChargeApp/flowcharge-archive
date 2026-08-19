// Unit tests for agentic-tools-skill-presence.ts's checkSkillPresence.
// Follows agentic-tools-format.test.ts's node:test + node:assert/strict
// pattern and its fixture-over-real-I/O style: a fake FsAccess test double
// resolves pathExists by membership in a per-test Set of 'existing' paths —
// no real filesystem access.
//
// Run with `node --test dist/lib/agentic-tools-skill-presence.test.js` after
// `npm run build`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { IntegrationFormat } from './agentic-tools-catalogue.js';
import { TOOL_CATALOGUE } from './agentic-tools-catalogue.js';
import type { FsAccess } from './agentic-tools-signals.js';
import { checkSkillPresence } from './agentic-tools-skill-presence.js';

function catalogueTool(id: string) {
  const tool = TOOL_CATALOGUE.find((t) => t.id === id);
  if (tool === undefined) throw new Error(`${id} missing from TOOL_CATALOGUE`);
  return tool;
}

function fakeFsAccess(existingPaths: Iterable<string>): FsAccess {
  const existing = new Set(existingPaths);
  return {
    pathExists: async (path: string) => existing.has(path),
    isDirectory: async () => {
      throw new Error('isDirectory: unused stub');
    },
    resolveBinaryOnPath: async () => {
      throw new Error('resolveBinaryOnPath: unused stub');
    },
    expandTokens: async (path: string) => path,
  };
}

const skillDirectoryFormat: IntegrationFormat = {
  kind: 'skill-directory',
  pathTemplate: 'skills/<name>/SKILL.md',
};

const singleRuleFileFormat: IntegrationFormat = {
  kind: 'single-rule-file',
  pathTemplate: '.windsurfrules',
};

const mcpJsonFormat: IntegrationFormat = {
  kind: 'mcp-json',
  pathTemplate: '.mcp.json',
};

function skillDirectoryTool() {
  return {
    id: 'fixture-skill-directory-tool',
    displayName: 'Fixture Skill Directory Tool',
    category: 'cli' as const,
    configDir: {},
    integrationFormats: [skillDirectoryFormat],
  };
}

function singleRuleFileTool() {
  return {
    id: 'fixture-single-rule-file-tool',
    displayName: 'Fixture Single Rule File Tool',
    category: 'gui-app' as const,
    configDir: {},
    integrationFormats: [singleRuleFileFormat],
  };
}

function mcpJsonOnlyTool() {
  return {
    id: 'fixture-mcp-json-only-tool',
    displayName: 'Fixture MCP JSON Only Tool',
    category: 'cli' as const,
    configDir: {},
    integrationFormats: [mcpJsonFormat],
  };
}

const skillIds = ['prx-alpha', 'prx-beta', 'prx-gamma'];

test('checkSkillPresence returns per-skill/fully-installed when every canonical skill path exists', async () => {
  const fsAccess = fakeFsAccess([
    '/base/skills/prx-alpha/SKILL.md',
    '/base/skills/prx-beta/SKILL.md',
    '/base/skills/prx-gamma/SKILL.md',
  ]);
  const result = await checkSkillPresence(skillDirectoryTool(), '/base', skillIds, fsAccess);
  assert.deepEqual(result, {
    checkKind: 'per-skill',
    status: 'fully-installed',
    presentSkillIds: ['prx-alpha', 'prx-beta', 'prx-gamma'],
    missingSkillIds: [],
  });
});

test('checkSkillPresence returns per-skill/missing-incomplete with correct present/missing ids when only some exist', async () => {
  const fsAccess = fakeFsAccess(['/base/skills/prx-alpha/SKILL.md']);
  const result = await checkSkillPresence(skillDirectoryTool(), '/base', skillIds, fsAccess);
  assert.deepEqual(result, {
    checkKind: 'per-skill',
    status: 'missing-incomplete',
    presentSkillIds: ['prx-alpha'],
    missingSkillIds: ['prx-beta', 'prx-gamma'],
  });
});

test('checkSkillPresence returns per-skill/not-installed when no canonical skill path exists', async () => {
  const fsAccess = fakeFsAccess([]);
  const result = await checkSkillPresence(skillDirectoryTool(), '/base', skillIds, fsAccess);
  assert.deepEqual(result, {
    checkKind: 'per-skill',
    status: 'not-installed',
    presentSkillIds: [],
    missingSkillIds: ['prx-alpha', 'prx-beta', 'prx-gamma'],
  });
});

test('checkSkillPresence returns shared-file/exists:true for a single-rule-file format whose shared path exists', async () => {
  const fsAccess = fakeFsAccess(['/base/.windsurfrules']);
  const result = await checkSkillPresence(singleRuleFileTool(), '/base', skillIds, fsAccess);
  assert.deepEqual(result, { checkKind: 'shared-file', exists: true });
});

test('checkSkillPresence returns shared-file/exists:false for a single-rule-file format whose shared path is missing', async () => {
  const fsAccess = fakeFsAccess([]);
  const result = await checkSkillPresence(singleRuleFileTool(), '/base', skillIds, fsAccess);
  assert.deepEqual(result, { checkKind: 'shared-file', exists: false });
});

test('checkSkillPresence returns no-format for a tool whose only format is mcp-json', async () => {
  const fsAccess = fakeFsAccess([]);
  const result = await checkSkillPresence(mcpJsonOnlyTool(), '/base', skillIds, fsAccess);
  assert.deepEqual(result, { checkKind: 'no-format' });
});

test('checkSkillPresence resolves the real OpenCode catalogue entry via skill-directory, not by throwing', async () => {
  const opencode = catalogueTool('opencode');
  const fsAccess = fakeFsAccess(['/base/skills/prx-orchestrate/SKILL.md']);
  const result = await checkSkillPresence(opencode, '/base', ['prx-orchestrate', 'prx-git'], fsAccess);
  assert.equal(result.checkKind, 'per-skill');
  if (result.checkKind === 'per-skill') {
    assert.equal(result.status, 'missing-incomplete');
    assert.deepEqual(result.presentSkillIds, ['prx-orchestrate']);
    assert.deepEqual(result.missingSkillIds, ['prx-git']);
  }
});
