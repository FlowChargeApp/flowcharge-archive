// Formatting contracts for the agentic-tools skill install engine. This file
// knows how to pick a non-mcp-json IntegrationFormat and how to turn
// InstallContent into the concrete file writes each format kind requires. It
// must never know about FsWriteAccess, tool ids, or IPC — see Design > 'What
// each module knows / must not know' in PLN-32-m51bp8.

import type { ToolDefinition, IntegrationFormat } from './agentic-tools-catalogue.js';
import type { InstallContent } from './agentic-tools-content.js';

export interface FileWrite {
  relativePath: string;
  content: string;
}

// Kinds formatForTarget does not implement (it throws for both — 'mcp-json'
// explicitly, 'structured-config-file' via its generic fallback). This set
// duplicates that knowledge on purpose: there is no compiler check tying the
// two together, so a future kind added to IntegrationFormat['kind'], or a
// future kind implemented in formatForTarget, must update this set too, or
// selectPrimaryFormat will silently start returning either a now-implemented
// kind it still filters out, or a still-unimplemented kind it forgot to filter.
const UNIMPLEMENTED_KINDS = new Set<IntegrationFormat['kind']>(['mcp-json', 'structured-config-file']);

// Returns the first integrationFormats entry whose kind formatForTarget
// actually implements (i.e. skips every kind in UNIMPLEMENTED_KINDS) AND
// that declares itself valid at the requested scope, or null if the tool
// has no such format at all. The scope filter is what stops a
// project-relative pathTemplate being joined to a configDir base, and a
// configDir-relative one being joined to a project root.
export function selectPrimaryFormat(
  tool: ToolDefinition,
  scopeKind: 'global' | 'project',
): IntegrationFormat | null {
  return tool.integrationFormats.find(
    (f) => !UNIMPLEMENTED_KINDS.has(f.kind) && f.scopes.includes(scopeKind),
  ) ?? null;
}

function skillDirectoryWrites(format: IntegrationFormat, content: InstallContent): FileWrite[] {
  const writes: FileWrite[] = [];
  for (const skill of content.skills) {
    const resolvedPath = format.pathTemplate.replace('<name>', skill.id);
    const dir = resolvedPath.replace(/\/[^/]+$/, '');
    writes.push({ relativePath: resolvedPath, content: skill.body });
    for (const file of skill.files ?? []) {
      writes.push({ relativePath: `${dir}/${file.relativePath}`, content: file.content });
    }
  }
  return writes;
}

// rule-directory pathTemplates in the real WS-41 catalogue use a '*' glob
// token (e.g. Cursor's '.cursor/rules/*.mdc'), not the '<name>' token
// skill-directory pathTemplates use — '*' is substituted with skill.id so
// each skill resolves to its own distinct file under the rules directory.
function ruleDirectoryWrites(format: IntegrationFormat, content: InstallContent): FileWrite[] {
  return content.skills.map((skill) => ({
    relativePath: format.pathTemplate.replace('*', skill.id),
    content: skill.body,
  }));
}

// single-rule-file and markdown-context-file both resolve to exactly one
// FileWrite: every skill concatenated under one document, at the format's
// literal pathTemplate (no per-skill token to substitute).
function singleDocumentWrite(format: IntegrationFormat, content: InstallContent): FileWrite[] {
  const combined = content.skills.map((skill) => skill.body).join('\n\n');
  return [{ relativePath: format.pathTemplate, content: combined }];
}

// Turns InstallContent into the concrete FileWrite list a given
// IntegrationFormat requires. Guards the mcp-json exclusion itself — never
// relying solely on selectPrimaryFormat's own filtering — because a caller
// that bypasses selectPrimaryFormat could otherwise silently write content
// into an mcp-json target (Gap 2).
export function formatForTarget(format: IntegrationFormat, content: InstallContent): FileWrite[] {
  if (format.kind === 'mcp-json') {
    throw new Error('formatForTarget: mcp-json is not a valid skill install target');
  }
  if (format.kind === 'skill-directory') {
    return skillDirectoryWrites(format, content);
  }
  if (format.kind === 'rule-directory') {
    return ruleDirectoryWrites(format, content);
  }
  if (format.kind === 'single-rule-file' || format.kind === 'markdown-context-file') {
    return singleDocumentWrite(format, content);
  }
  throw new Error(`formatForTarget: kind '${format.kind}' is not yet implemented`);
}
