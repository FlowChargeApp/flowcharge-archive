// The browser-side owner of the skill-install surface's types. Both home.ts and
// browser-ipc-shim.ts need these shapes, so neither of them can own them — the
// same role ipc-adapter.ts already fills for window.praxisAPI. This module is
// DOM-free and transport-free: it declares types only, performs no fetch, and
// touches no DOM API.
//
// The shapes below are structural mirrors of
// electron/agentic-tools-ipc-handlers.cts's, matching this codebase's
// established mirror-not-import pattern (see that file's own header comment).
// The Window augmentation sits inside a `declare global` block, so it merges
// with the Window that lib.dom.d.ts declares; a bare top-level `interface
// Window` in a module is a local interface and never merges. InstallScope is
// not redeclared here because it is imported from './agentic-tools-scope'.

import type { InstallScope } from './agentic-tools-scope';
import type { PraxisIpcResult } from '../ipc-adapter';

export type DetectionConfidence = 'confirmed' | 'likely' | 'weak' | 'not-detected';

export interface DetectionResult {
  toolId: string;
  confidence: DetectionConfidence;
  resolvedConfigDir: string | null;
  matchedSignals: string[];
  needsManualVerification: boolean;
}

export interface ToolDetectionRow {
  toolId: string;
  displayName: string;
  category: 'cli' | 'gui-app';
  detection: DetectionResult;
}

export interface InstallResult {
  toolId: string;
  status: 'installed' | 'updated' | 'up-to-date' | 'skipped-no-format';
  resolvedPath: string | null;
}

export interface InstallRecord {
  toolId: string;
  resolvedPath: string;
  resolvedPaths?: string[];
  format: string;
  scope: InstallScope;
  installedAt: string;
  updatedAt: string;
  contentHash: string;
  version?: string;
}

// Mirrors src/lib/skill-release-fetch.ts's SkillReleaseSummary — kept in sync
// by hand, same mirror-not-import pattern as every other shape here.
export interface SkillReleaseSummary {
  tag: string;
  name: string;
  publishedAt: string;
  assetName: string | null;
}

// Mirrors agentic-tools-skill-presence.ts's SkillPresenceResult union — kept in
// sync by hand, same mirror-not-import pattern as every other shape here.
export type SkillPresenceResult =
  | {
      checkKind: 'per-skill';
      status: 'fully-installed' | 'missing-incomplete' | 'not-installed';
      presentSkillIds: string[];
      missingSkillIds: string[];
    }
  | { checkKind: 'shared-file'; exists: boolean }
  | { checkKind: 'no-format' };

// The 200 body of POST /api/integrations/skill-presence: the presence union
// above plus the version the route read off the installed skill files. Null
// for a shared-file or no-format result, for nothing installed, and for a
// present file carrying no readable version. SkillPresenceResult itself is
// left alone so the hand-kept mirror of the library union cannot drift.
export type SkillPresenceResponse = SkillPresenceResult & {
  installedVersion: string | null;
};

// Mirrors electron/agentic-tools-ipc-handlers.cts:223-227.
export interface InstallTargetRequest {
  toolId: string;
  basePath: string;
  scope: InstallScope;
}

export interface PraxisSkillInstallAPI {
  detectTools(): Promise<PraxisIpcResult<ToolDetectionRow[]>>;
  installSelected(targets: InstallTargetRequest[]): Promise<PraxisIpcResult<InstallResult[]>>;
  getInstallStatus(): Promise<PraxisIpcResult<InstallRecord[]>>;
  listSkillReleases(): Promise<PraxisIpcResult<SkillReleaseSummary[]>>;
  removeInstallation(toolId: string, scope: InstallScope): Promise<PraxisIpcResult<null>>;
  checkInstalledSkills(target: InstallTargetRequest): Promise<PraxisIpcResult<SkillPresenceResponse>>;
}

declare global {
  interface Window {
    // Optional on purpose: the compiler then forces an existence check at every
    // call site, the same treatment pickProjectFolder? gets at
    // src/public/ipc-adapter.ts:38.
    praxisSkillInstallAPI?: PraxisSkillInstallAPI;
  }
}
