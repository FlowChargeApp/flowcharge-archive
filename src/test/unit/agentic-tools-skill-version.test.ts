// Unit tests for agentic-tools-skill-version.ts's parseSkillVersion and
// readInstalledSkillVersion. Follows agentic-tools-skill-presence.test.ts's
// node:test + node:assert/strict pattern and its fixture-over-real-I/O style:
// a fake FsAccess test double answers readTextFile from a per-test map of
// path -> contents — no real filesystem access.
//
// Run with `node --test dist/test/unit/agentic-tools-skill-version.test.js` after
// `npm run build`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { IntegrationFormat } from '../../lib/agentic-tools-catalogue.js';
import type { FsAccess } from '../../lib/agentic-tools-signals.js';
import {
  parseSkillVersion,
  readInstalledSkillVersion,
} from '../../lib/agentic-tools-skill-version.js';

// A local fixture rather than a TOOL_CATALOGUE entry, so these cases stay
// independent of what the catalogue happens to hold.
const skillDirectoryFormat: IntegrationFormat = {
  kind: 'skill-directory',
  pathTemplate: 'skills/<name>/SKILL.md',
  scopes: ['global'],
};

const singleRuleFileFormat: IntegrationFormat = {
  kind: 'single-rule-file',
  pathTemplate: '.windsurfrules',
  scopes: ['global'],
};

const mcpJsonFormat: IntegrationFormat = {
  kind: 'mcp-json',
  pathTemplate: '.mcp.json',
  scopes: ['global'],
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

// Counts its own reads so a "no read at all" expectation can be asserted
// directly rather than inferred from the returned value.
function fakeFsAccess(files: Record<string, string>): FsAccess & { readCount: () => number } {
  let reads = 0;
  return {
    pathExists: async () => {
      throw new Error('pathExists: unused stub');
    },
    isDirectory: async () => {
      throw new Error('isDirectory: unused stub');
    },
    readTextFile: async (path: string) => {
      reads++;
      return Object.prototype.hasOwnProperty.call(files, path) ? files[path] : null;
    },
    resolveBinaryOnPath: async () => {
      throw new Error('resolveBinaryOnPath: unused stub');
    },
    expandTokens: async (path: string) => path,
    readCount: () => reads,
  };
}

test('parseSkillVersion reads a quoted nested metadata.version', () => {
  const text = '---\nname: alpha\nmetadata:\n  version: "1.2.3"\n---\nBody text.\n';
  assert.equal(parseSkillVersion(text), '1.2.3');
});

test('parseSkillVersion reads an unquoted nested metadata.version', () => {
  const text = '---\nname: alpha\nmetadata:\n  version: 1.2.3\n---\nBody text.\n';
  assert.equal(parseSkillVersion(text), '1.2.3');
});

test('parseSkillVersion returns null when the frontmatter has no metadata key', () => {
  const text = '---\nname: alpha\ndescription: no metadata here\n---\nBody text.\n';
  assert.equal(parseSkillVersion(text), null);
});

test('parseSkillVersion returns null when metadata carries no version key', () => {
  const text = '---\nname: alpha\nmetadata:\n  author: someone\n---\nBody text.\n';
  assert.equal(parseSkillVersion(text), null);
});

test('parseSkillVersion returns null when metadata.version is a list, not a string', () => {
  const text = '---\nname: alpha\nmetadata:\n  version:\n    - 1.2.3\n    - 4.5.6\n---\nBody text.\n';
  assert.equal(parseSkillVersion(text), null);
});

test('parseSkillVersion returns null for a file with no frontmatter block', () => {
  const text = '# Alpha\n\nmetadata:\n  version: 1.2.3\n';
  assert.equal(parseSkillVersion(text), null);
});

test('parseSkillVersion is not split by a body line starting with ---', () => {
  const text = '---\nname: alpha\nmetadata:\n  version: 1.2.3\n---\nIntro.\n\n---\n\nMore body.\n';
  assert.equal(parseSkillVersion(text), '1.2.3');
});

test('parseSkillVersion reads a version from a CRLF file', () => {
  const text = '---\r\nname: alpha\r\nmetadata:\r\n  version: 1.2.3\r\n---\r\nBody text.\r\n';
  assert.equal(parseSkillVersion(text), '1.2.3');
});

test('readInstalledSkillVersion answers the version on the first present skill', async () => {
  const fsAccess = fakeFsAccess({
    '/base/skills/prx-alpha/SKILL.md': '---\nmetadata:\n  version: 2.0.0\n---\nAlpha.\n',
    '/base/skills/prx-beta/SKILL.md': '---\nmetadata:\n  version: 9.9.9\n---\nBeta.\n',
  });
  const version = await readInstalledSkillVersion(
    skillDirectoryTool(),
    '/base',
    ['prx-alpha', 'prx-beta'],
    fsAccess,
  );
  assert.equal(version, '2.0.0');
});

test('readInstalledSkillVersion falls through to a later file when the first has no version', async () => {
  const fsAccess = fakeFsAccess({
    '/base/skills/prx-alpha/SKILL.md': '---\nname: alpha\n---\nAlpha.\n',
    '/base/skills/prx-beta/SKILL.md': '---\nmetadata:\n  version: 3.1.0\n---\nBeta.\n',
  });
  const version = await readInstalledSkillVersion(
    skillDirectoryTool(),
    '/base',
    ['prx-alpha', 'prx-beta'],
    fsAccess,
  );
  assert.equal(version, '3.1.0');
});

test('readInstalledSkillVersion returns null when no present file yields a version', async () => {
  const fsAccess = fakeFsAccess({
    '/base/skills/prx-alpha/SKILL.md': 'no frontmatter at all\n',
  });
  const version = await readInstalledSkillVersion(
    skillDirectoryTool(),
    '/base',
    ['prx-alpha', 'prx-beta'],
    fsAccess,
  );
  assert.equal(version, null);
});

test('readInstalledSkillVersion reads nothing for an empty presentSkillIds', async () => {
  const fsAccess = fakeFsAccess({
    '/base/skills/prx-alpha/SKILL.md': '---\nmetadata:\n  version: 2.0.0\n---\nAlpha.\n',
  });
  const version = await readInstalledSkillVersion(skillDirectoryTool(), '/base', [], fsAccess);
  assert.equal(version, null);
  assert.equal(fsAccess.readCount(), 0);
});

test('readInstalledSkillVersion returns null for a single-rule-file tool', async () => {
  const fsAccess = fakeFsAccess({
    '/base/.windsurfrules': '---\nmetadata:\n  version: 2.0.0\n---\nRules.\n',
  });
  const version = await readInstalledSkillVersion(
    singleRuleFileTool(),
    '/base',
    ['prx-alpha'],
    fsAccess,
  );
  assert.equal(version, null);
});

test('readInstalledSkillVersion returns null for a tool with no implemented format', async () => {
  const fsAccess = fakeFsAccess({});
  const version = await readInstalledSkillVersion(
    mcpJsonOnlyTool(),
    '/base',
    ['prx-alpha'],
    fsAccess,
  );
  assert.equal(version, null);
});
