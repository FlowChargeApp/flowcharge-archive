// Unit tests for agentic-tools-format.ts's selectPrimaryFormat and
// formatForTarget. Follows extract.test.ts's node:test + node:assert/strict
// pattern.
//
// Run with `node --test dist/lib/agentic-tools-format.test.js` after
// `npm run build`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { IntegrationFormat } from './agentic-tools-catalogue.js';
import { TOOL_CATALOGUE } from './agentic-tools-catalogue.js';
import type { InstallContent } from './agentic-tools-content.js';
import { selectPrimaryFormat, formatForTarget } from './agentic-tools-format.js';

function catalogueTool(id: string) {
  const tool = TOOL_CATALOGUE.find((t) => t.id === id);
  if (tool === undefined) throw new Error(`${id} missing from TOOL_CATALOGUE`);
  return tool;
}

function mcpJsonEntry(tool: ReturnType<typeof catalogueTool>): IntegrationFormat {
  const entry = tool.integrationFormats.find((f) => f.kind === 'mcp-json');
  if (entry === undefined) throw new Error(`${tool.id} has no mcp-json entry`);
  return entry;
}

const skillDirectoryFormat: IntegrationFormat = {
  kind: 'skill-directory',
  pathTemplate: 'skills/<name>/SKILL.md',
};

const mcpJsonFormat: IntegrationFormat = {
  kind: 'mcp-json',
  pathTemplate: '.mcp.json',
};

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

test('formatForTarget produces one SKILL.md FileWrite per skill plus files[] entries, for skill-directory', () => {
  const writes = formatForTarget(skillDirectoryFormat, twoSkillContent);
  assert.deepEqual(writes, [
    { relativePath: 'skills/prx-alpha/SKILL.md', content: 'alpha body' },
    { relativePath: 'skills/prx-alpha/reference.md', content: 'reference content' },
    { relativePath: 'skills/prx-beta/SKILL.md', content: 'beta body' },
  ]);
});

test('formatForTarget throws when called with format.kind === mcp-json', () => {
  assert.throws(() => formatForTarget(mcpJsonFormat, twoSkillContent));
});

test('formatForTarget throws for a not-yet-implemented kind', () => {
  // structured-config-file is out of scope entirely for this workstream's
  // four-tool/three-kind narrowing (rule-directory and single-rule-file /
  // markdown-context-file are implemented as of task 2.1), so it remains the
  // one kind that must still hit the generic throw.
  const structuredConfigFile: IntegrationFormat = { kind: 'structured-config-file', pathTemplate: 'settings.json' };
  assert.throws(() => formatForTarget(structuredConfigFile, twoSkillContent));
});

test('selectPrimaryFormat returns the first non-mcp-json entry', () => {
  const tool = {
    id: 'fixture-tool',
    displayName: 'Fixture Tool',
    category: 'cli' as const,
    configDir: {},
    integrationFormats: [mcpJsonFormat, skillDirectoryFormat],
  };
  assert.deepEqual(selectPrimaryFormat(tool), skillDirectoryFormat);
});

test('selectPrimaryFormat returns null when only mcp-json is available', () => {
  const tool = {
    id: 'fixture-tool',
    displayName: 'Fixture Tool',
    category: 'cli' as const,
    configDir: {},
    integrationFormats: [mcpJsonFormat],
  };
  assert.equal(selectPrimaryFormat(tool), null);
});

test('selectPrimaryFormat resolves the real Cursor catalogue entry to its rules format, never mcp-json', () => {
  const cursor = catalogueTool('cursor');
  const resolved = selectPrimaryFormat(cursor);
  assert.notEqual(resolved, null);
  assert.equal(resolved?.kind, 'rule-directory');
  assert.notEqual(resolved?.kind, 'mcp-json');
});

test('selectPrimaryFormat resolves the real Windsurf catalogue entry to its rules format, never mcp-json', () => {
  const windsurf = catalogueTool('windsurf');
  const resolved = selectPrimaryFormat(windsurf);
  assert.notEqual(resolved, null);
  assert.equal(resolved?.kind, 'rule-directory');
  assert.notEqual(resolved?.kind, 'mcp-json');
});

test('formatForTarget throws when called directly with Cursor\'s real mcp-json entry', () => {
  const cursor = catalogueTool('cursor');
  assert.throws(() => formatForTarget(mcpJsonEntry(cursor), twoSkillContent));
});

test('formatForTarget throws when called directly with Windsurf\'s real mcp-json entry', () => {
  const windsurf = catalogueTool('windsurf');
  assert.throws(() => formatForTarget(mcpJsonEntry(windsurf), twoSkillContent));
});
