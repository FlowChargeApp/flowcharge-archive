// Reads the version recorded inside an installed skill's own SKILL.md, which
// is independent of this app's install-tracking ledger
// (agentic-tools-install-tracking.ts / .praxis-installs.json). Read-only:
// only ever calls FsAccess.readTextFile, never anything from FsWriteAccess
// (agentic-tools-install.ts) — this module reads a version, it never writes.

// node:path is pure path algebra and touches no filesystem, so it does
// not breach this module's read-only, FsAccess-only contract.
import path from 'node:path';

import type { ToolDefinition } from './agentic-tools-catalogue.js';
import type { FsAccess } from './agentic-tools-signals.js';
import { selectPrimaryFormat, formatForTarget } from './agentic-tools-format.js';
import type { InstallContent } from './agentic-tools-content.js';
import { parseYamlBlock } from './yaml-block.js';

// One definition of "frontmatter" for this module. The pattern carries NO `g`
// flag, so `match` is not stateful, and the `^` anchor is what stops a body
// line that starts `---` from splitting the block. `\r?` tolerates CRLF files.
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;

// The version a SKILL.md records under a nested `metadata.version` key, or null.
// parseFrontmatter from ./extract.js cannot serve here: it reads flat keys
// only, and this value is nested one level down, so the nested-map grammar of
// parseYamlBlock is the right parser. Never throws — every unreadable shape,
// including a missing block, a missing key and a non-string value, is null.
export function parseSkillVersion(text: string): string | null {
  const m = text.match(FRONTMATTER);
  if (!m) return null;
  const lines = m[1].split('\n').map((line) => line.replace(/\r$/, ''));
  const fields = parseYamlBlock(lines);
  const metadata = fields.metadata;
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) return null;
  const version = metadata.version;
  return typeof version === 'string' ? version : null;
}

// Resolves each present skill's on-disk path via selectPrimaryFormat +
// formatForTarget (never a hand-rolled path guess), reads them in order, and
// answers the first version that parses. Null for an empty presentSkillIds
// (read before any filesystem access), for a tool with no implemented format,
// for a format whose kind collapses every skill into one shared document, and
// when no present file carries a readable version.
export async function readInstalledSkillVersion(
  tool: ToolDefinition,
  basePath: string,
  presentSkillIds: string[],
  fsAccess: FsAccess,
): Promise<string | null> {
  if (presentSkillIds.length === 0) return null;

  // 'global' is a literal, not a parameter, for the same reason as in
  // checkSkillPresence: this is a global-scope-only capability.
  const format = selectPrimaryFormat(tool, 'global');
  if (format === null) return null;
  if (format.kind !== 'skill-directory' && format.kind !== 'rule-directory') return null;

  const stubContent: InstallContent = {
    version: 'version-read-stub',
    skills: presentSkillIds.map((id) => ({ id, name: '', description: '', body: '' })),
  };
  // skillDirectoryWrites/ruleDirectoryWrites each emit exactly one FileWrite
  // per input skill, in the same order as content.skills, so writes[i]
  // corresponds to presentSkillIds[i].
  const writes = formatForTarget(format, stubContent);

  for (let i = 0; i < presentSkillIds.length; i++) {
    // path.join, not a hardcoded '/', so the read path matches what the
    // install engine writes on every platform.
    const fullPath = path.join(basePath, writes[i].relativePath);
    const text = await fsAccess.readTextFile(fullPath);
    if (text === null) continue;
    const version = parseSkillVersion(text);
    if (version !== null) return version;
  }

  return null;
}
