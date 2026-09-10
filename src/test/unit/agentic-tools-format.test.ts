// Unit tests for agentic-tools-format.ts's selectPrimaryFormat and
// formatForTarget. Follows extract.test.ts's node:test + node:assert/strict
// pattern.
//
// Run with `node --test dist/test/unit/agentic-tools-format.test.js` after
// `npm run build`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { IntegrationFormat } from '../../lib/agentic-tools-catalogue.js';
import { TOOL_CATALOGUE } from '../../lib/agentic-tools-catalogue.js';
import type { InstallContent } from '../../lib/agentic-tools-content.js';
import { selectPrimaryFormat, formatForTarget } from '../../lib/agentic-tools-format.js';

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
  scopes: ['global'],
};

const mcpJsonFormat: IntegrationFormat = {
  kind: 'mcp-json',
  pathTemplate: '.mcp.json',
  scopes: ['global'],
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
  const structuredConfigFile: IntegrationFormat = { kind: 'structured-config-file', pathTemplate: 'settings.json', scopes: ['global'] };
  assert.throws(() => formatForTarget(structuredConfigFile, twoSkillContent));
});

test('selectPrimaryFormat returns the first non-mcp-json entry valid at the scope', () => {
  const tool = {
    id: 'fixture-tool',
    displayName: 'Fixture Tool',
    category: 'cli' as const,
    configDir: {},
    integrationFormats: [mcpJsonFormat, skillDirectoryFormat],
  };
  assert.deepEqual(selectPrimaryFormat(tool, 'global'), skillDirectoryFormat);
});

test('selectPrimaryFormat returns null when only mcp-json is available', () => {
  const tool = {
    id: 'fixture-tool',
    displayName: 'Fixture Tool',
    category: 'cli' as const,
    configDir: {},
    integrationFormats: [mcpJsonFormat],
  };
  assert.equal(selectPrimaryFormat(tool, 'global'), null);
});

test('selectPrimaryFormat returns null for a format the tool does not declare at that scope', () => {
  const tool = {
    id: 'fixture-tool',
    displayName: 'Fixture Tool',
    category: 'cli' as const,
    configDir: {},
    integrationFormats: [skillDirectoryFormat],
  };
  assert.equal(selectPrimaryFormat(tool, 'project'), null);
});

test('selectPrimaryFormat resolves the real Cursor catalogue entry to its rules format at project scope only', () => {
  const cursor = catalogueTool('cursor');
  const atProject = selectPrimaryFormat(cursor, 'project');
  assert.equal(atProject?.kind, 'rule-directory');
  assert.equal(atProject?.pathTemplate, '.cursor/rules/*.mdc');
  // Cursor reads no user-level rules directory, so a global install has
  // no target at all rather than a doubled configDir path.
  assert.equal(selectPrimaryFormat(cursor, 'global'), null);
});

test('selectPrimaryFormat resolves the real Windsurf catalogue entry to its rules format at project scope only', () => {
  const windsurf = catalogueTool('windsurf');
  const atProject = selectPrimaryFormat(windsurf, 'project');
  assert.equal(atProject?.kind, 'rule-directory');
  assert.equal(atProject?.pathTemplate, '.devin/rules/*.md');
  // Windsurf's one user-level surface is memories/global_rules.md, the
  // user-authored rules document, which the catalogue declares at no
  // scope. A global install therefore has no target at all rather than
  // one combined document written over that file.
  assert.equal(selectPrimaryFormat(windsurf, 'global'), null);
});

test('selectPrimaryFormat resolves the real OpenCode catalogue entry to its skill-directory format, never structured-config-file', () => {
  const opencode = catalogueTool('opencode');
  const resolved = selectPrimaryFormat(opencode, 'global');
  assert.notEqual(resolved, null);
  assert.equal(resolved?.kind, 'skill-directory');
  assert.notEqual(resolved?.kind, 'structured-config-file');
});

test('formatForTarget throws when called directly with Cursor\'s real mcp-json entry', () => {
  const cursor = catalogueTool('cursor');
  assert.throws(() => formatForTarget(mcpJsonEntry(cursor), twoSkillContent));
});

test('formatForTarget throws when called directly with Windsurf\'s real mcp-json entry', () => {
  const windsurf = catalogueTool('windsurf');
  assert.throws(() => formatForTarget(mcpJsonEntry(windsurf), twoSkillContent));
});
