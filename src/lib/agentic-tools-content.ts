// Install content contracts for the agentic-tools skill install engine. This
// file knows only the SHAPE of content to install and how to hash it for
// change detection — never filesystem access, tool-id-specific logic, or
// format-kind logic. Real content (getInstallContent) stays an injected port
// with only fixture/placeholder implementations throughout this workstream —
// see PLN-32-m51bp8's Out of scope (Gap 1).

import crypto from 'node:crypto';

export interface SkillContent {
  id: string; // assumed prx-prefixed (plan Assumption 2); not enforced here
  name: string;
  description: string;
  body: string;
  files?: { relativePath: string; content: string }[];
}

export interface InstallContent {
  version: string; // caller-supplied content identity, informational only
  releaseTag?: string; // present only for content sourced from a published release
  skills: SkillContent[];
}

// The Gap 1 seam: stays a port with only fixture/placeholder implementations
// everywhere in this workstream, including the real IPC wiring in Phase 6
// (plan Assumption 9).
export type GetInstallContent = (toolId: string) => Promise<InstallContent>;

// Canonicalises a SkillContent for hashing: its own files[] array is sorted by
// relativePath so file order never changes the hash either.
function canonicalSkill(skill: SkillContent): unknown {
  const files = (skill.files ?? [])
    .slice()
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath))
    .map((f) => ({ relativePath: f.relativePath, content: f.content }));
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    body: skill.body,
    files,
  };
}

// Hashes content.skills sorted by id, over a canonical JSON encoding, so
// neither field order nor array order ever changes the hash — only the
// version returned by this function is what installToTarget compares for
// change detection; InstallContent.version itself is informational only.
export function hashInstallContent(content: InstallContent): string {
  const canonical = content.skills
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(canonicalSkill);
  const json = JSON.stringify(canonical);
  return crypto.createHash('sha256').update(json).digest('hex');
}
