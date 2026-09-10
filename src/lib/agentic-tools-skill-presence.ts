// Real filesystem presence detection for the canonical FlowCharge Core skill suite,
// independent of this app's own install-tracking ledger
// (agentic-tools-install-tracking.ts / .praxis-installs.json). Read-only:
// only ever calls FsAccess.pathExists, never anything from FsWriteAccess
// (agentic-tools-install.ts) — this module checks presence, it never writes.

// node:path is pure path algebra and touches no filesystem, so it does
// not breach this module's read-only, FsAccess-only contract.
import path from 'node:path';

import type { ToolDefinition } from './agentic-tools-catalogue.js';
import type { FsAccess } from './agentic-tools-signals.js';
import { selectPrimaryFormat, formatForTarget } from './agentic-tools-format.js';
import type { InstallContent } from './agentic-tools-content.js';

export type SkillPresenceResult =
  | {
      checkKind: 'per-skill';
      status: 'fully-installed' | 'missing-incomplete' | 'not-installed';
      presentSkillIds: string[];
      missingSkillIds: string[];
    }
  | { checkKind: 'shared-file'; exists: boolean }
  | { checkKind: 'no-format' };

// Resolves each canonical skill's expected on-disk path via
// selectPrimaryFormat + formatForTarget (never a hand-rolled path guess) and
// checks it with fsAccess.pathExists. skill-directory/rule-directory formats
// get a real per-skill result; single-rule-file/markdown-context-file
// formats collapse every skill into one shared document, so only a coarser
// shared-file result is possible for them (Gap 1 — a real, intentional scope
// limit, not an oversight).
export async function checkSkillPresence(
  tool: ToolDefinition,
  basePath: string,
  skillIds: string[],
  fsAccess: FsAccess,
): Promise<SkillPresenceResult> {
  // 'global' is a literal, not a parameter: presence checking is a
  // documented global-scope-only capability, so this module has no
  // project scope to forward.
  const format = selectPrimaryFormat(tool, 'global');
  if (format === null) {
    return { checkKind: 'no-format' };
  }

  const stubContent: InstallContent = {
    version: 'presence-check-stub',
    skills: skillIds.map((id) => ({ id, name: '', description: '', body: '' })),
  };
  const writes = formatForTarget(format, stubContent);

  if (format.kind === 'skill-directory' || format.kind === 'rule-directory') {
    // skillDirectoryWrites/ruleDirectoryWrites each emit exactly one
    // FileWrite per input skill, in the same order as content.skills, so
    // writes[i] corresponds to skillIds[i].
    const presentSkillIds: string[] = [];
    const missingSkillIds: string[] = [];
    for (let i = 0; i < skillIds.length; i++) {
      // path.join, not a hardcoded '/', so the probed path matches what
      // the install engine writes on every platform.
      const fullPath = path.join(basePath, writes[i].relativePath);
      const exists = await fsAccess.pathExists(fullPath);
      if (exists) {
        presentSkillIds.push(skillIds[i]);
      } else {
        missingSkillIds.push(skillIds[i]);
      }
    }
    const status =
      missingSkillIds.length === 0 ? 'fully-installed' : presentSkillIds.length === 0 ? 'not-installed' : 'missing-incomplete';
    return { checkKind: 'per-skill', status, presentSkillIds, missingSkillIds };
  }

  // format.kind is 'single-rule-file' or 'markdown-context-file': formatForTarget's
  // singleDocumentWrite always emits exactly one shared FileWrite regardless
  // of skill count, so no individual skill's presence can be distinguished
  // within it — return the coarser shared-file result from a single
  // pathExists call on that one resolved path.
  const fullPath = path.join(basePath, writes[0].relativePath);
  const exists = await fsAccess.pathExists(fullPath);
  return { checkKind: 'shared-file', exists };
}
