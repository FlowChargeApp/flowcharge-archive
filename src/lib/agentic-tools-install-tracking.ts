// Install-state tracking registry for the agentic-tools skill install engine.
// This file knows only InstallRecord shape and pure parse/serialize/upsert/
// find/remove operations over an in-memory InstallRecord[] — never
// filesystem access, per Design > 'What each module knows / must not know'
// in PLN-32-m51bp8. installToTarget (agentic-tools-install.ts) owns reading
// and persisting the registry file itself; this module is the canonical
// owner of InstallScope, which agentic-tools-install.ts imports rather than
// redefining locally.

import type { IntegrationFormat } from './agentic-tools-catalogue.js';

export type InstallScope = { kind: 'global' } | { kind: 'project'; projectPath: string };

export interface InstallRecord {
  toolId: string;
  resolvedPath: string; // the FIRST path written; kept for readers written against the single-path shape
  // Every path the install wrote. Optional, because .praxis-installs.json
  // is a live on-disk format: a record written before this field existed
  // carries resolvedPath alone, and readers fall back to it rather than
  // treating the record as unreadable.
  resolvedPaths?: string[];
  format: IntegrationFormat['kind'];
  scope: InstallScope;
  installedAt: string;
  updatedAt: string;
  contentHash: string;
  version?: string; // release tag as published; absent only for pre-feature install records
}

function scopesEqual(a: InstallScope, b: InstallScope): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'project' && b.kind === 'project') return a.projectPath === b.projectPath;
  return true;
}

// The shape check the comment below promises. Plain TypeScript and no
// schema library, because this project ships zero runtime dependencies.
// `format` is checked as a string rather than against the kind union: that
// union lives in agentic-tools-catalogue.ts and restating its members here
// would be a second copy to keep in step.
function isInstallRecordShape(value: unknown): value is InstallRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  const requiredStrings = ['toolId', 'resolvedPath', 'format', 'installedAt', 'updatedAt', 'contentHash'];
  if (!requiredStrings.every((key) => typeof record[key] === 'string')) return false;
  if (record.version !== undefined && typeof record.version !== 'string') return false;
  if (record.resolvedPaths !== undefined
    && !(Array.isArray(record.resolvedPaths) && record.resolvedPaths.every((p) => typeof p === 'string'))) {
    return false;
  }
  const scope = record.scope;
  if (typeof scope !== 'object' || scope === null) return false;
  const kind = (scope as Record<string, unknown>).kind;
  if (kind === 'global') return true;
  return kind === 'project' && typeof (scope as Record<string, unknown>).projectPath === 'string';
}

// Returns [] on any parse failure (malformed JSON, wrong shape), matching
// src/lib/projects.ts's readProjects own corrupted-file-returns-empty-list
// posture rather than throwing.
export function parseInstallRegistry(raw: string): InstallRecord[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.every(isInstallRecordShape) ? (parsed as InstallRecord[]) : [];
  } catch {
    return [];
  }
}

export function serializeInstallRegistry(records: InstallRecord[]): string {
  return JSON.stringify(records, null, 2);
}

// Replaces any existing record matching the same (toolId, scope) pair rather
// than duplicating.
export function upsertInstallRecord(records: InstallRecord[], record: InstallRecord): InstallRecord[] {
  const index = records.findIndex((r) => r.toolId === record.toolId && scopesEqual(r.scope, record.scope));
  if (index === -1) return [...records, record];
  const next = records.slice();
  next[index] = record;
  return next;
}

export function findInstallRecord(records: InstallRecord[], toolId: string, scope: InstallScope): InstallRecord | undefined {
  return records.find((r) => r.toolId === toolId && scopesEqual(r.scope, scope));
}

export function removeInstallRecord(records: InstallRecord[], toolId: string, scope: InstallScope): InstallRecord[] {
  return records.filter((r) => !(r.toolId === toolId && scopesEqual(r.scope, scope)));
}
