// Skill install orchestration for the agentic-tools install engine. Knows how
// to turn one InstallTarget + InstallContent into concrete filesystem writes,
// via the injected FsWriteAccess port — never node:fs or node:fs/promises
// directly, per Design > 'What each module knows / must not know' in
// PLN-32-m51bp8. Phase 3 adds install-state tracking: installToTarget now
// reads the registry to detect up-to-date/updated content, and
// removeInstallation reverses an install.

// node:path is pure path algebra and touches no filesystem, so it does not
// breach the "no direct filesystem access" rule above — every actual write
// still goes through the injected FsWriteAccess port.
import path from 'node:path';

import type { ToolDefinition } from './agentic-tools-catalogue.js';
import type { InstallContent, GetInstallContent } from './agentic-tools-content.js';
import { hashInstallContent } from './agentic-tools-content.js';
import { selectPrimaryFormat, formatForTarget } from './agentic-tools-format.js';
import type { InstallScope, InstallRecord } from './agentic-tools-install-tracking.js';
import {
  parseInstallRegistry,
  serializeInstallRegistry,
  upsertInstallRecord,
  findInstallRecord,
  removeInstallRecord,
} from './agentic-tools-install-tracking.js';

// Re-exported for callers that imported InstallScope from this module before
// agentic-tools-install-tracking.ts existed; agentic-tools-install-tracking.ts
// is now the canonical definition.
export type { InstallScope };

// A pure port type — no implementation in this file. A concrete
// node:fs/promises-backed implementation lands in Phase 5's
// agentic-tools-fs-adapter.ts.
export interface FsWriteAccess {
  readTextFile(path: string): Promise<string | null>;
  writeTextFileAtomic(path: string, content: string): Promise<void>;
  // Binary pair beside the text pair, for the downloaded release zip.
  // readBinaryFile mirrors readTextFile's null-on-ENOENT contract exactly.
  readBinaryFile(path: string): Promise<Buffer | null>;
  writeBinaryFileAtomic(path: string, content: Buffer): Promise<void>;
  mkdir(path: string): Promise<void>;
  remove(path: string): Promise<void>;
  expandTokens(path: string): Promise<string>;
}

export interface InstallTarget {
  tool: ToolDefinition;
  basePath: string;
  scope: InstallScope;
}

export type InstallStatus = 'installed' | 'updated' | 'up-to-date' | 'skipped-no-format';

export interface InstallResult {
  toolId: string;
  status: InstallStatus;
  resolvedPath: string | null;
}

async function readRegistry(registryPath: string, fsWrite: FsWriteAccess): Promise<InstallRecord[]> {
  const raw = await fsWrite.readTextFile(registryPath);
  return raw === null ? [] : parseInstallRegistry(raw);
}

async function writeRegistry(registryPath: string, records: InstallRecord[], fsWrite: FsWriteAccess): Promise<void> {
  await fsWrite.writeTextFileAtomic(registryPath, serializeInstallRegistry(records));
}

// Reads the registry first: on a matching contentHash for this target's
// (toolId, scope), skips every content write and returns 'up-to-date' with
// the record's resolvedPath (plan acceptance criterion 4's exact zero-write
// requirement). The one write that branch may still make is the registry
// itself, and only to backfill a version the record does not yet carry —
// see the branch's own comment. Otherwise formats and writes
// as before, then upserts and persists the tracking record — always AFTER
// the content writes succeed, so a failed content write never leaves a
// tracking record for content that was never actually written to disk.
export async function installToTarget(
  target: InstallTarget,
  content: InstallContent,
  registryPath: string,
  deps: { fsWrite: FsWriteAccess },
): Promise<InstallResult> {
  const format = selectPrimaryFormat(target.tool);
  if (format === null) {
    return { toolId: target.tool.id, status: 'skipped-no-format', resolvedPath: null };
  }

  const contentHash = hashInstallContent(content);
  const records = await readRegistry(registryPath, deps.fsWrite);
  const existing = findInstallRecord(records, target.tool.id, target.scope);

  if (existing !== undefined && existing.contentHash === contentHash) {
    // Version backfill: the bytes already on disk are correct, but the record
    // names a different version than the content carries — the case being a
    // record written before versions were tracked at all, which would
    // otherwise never gain one and could never be told an update exists.
    // Absent-vs-absent compares equal, so the ordinary no-op stays a pure
    // early return. The correction is a REGISTRY write only: no format, no
    // mkdir and no content write happen on this branch, so the zero-content-
    // write contract above still holds, and the status stays 'up-to-date'.
    if (existing.version !== content.releaseTag) {
      const backfilled: InstallRecord = { ...existing, updatedAt: new Date().toISOString() };
      if (content.releaseTag === undefined) delete backfilled.version;
      else backfilled.version = content.releaseTag;
      await writeRegistry(registryPath, upsertInstallRecord(records, backfilled), deps.fsWrite);
    }
    return { toolId: target.tool.id, status: 'up-to-date', resolvedPath: existing.resolvedPath };
  }

  const writes = formatForTarget(format, content);

  let resolvedPath: string | null = null;
  for (const write of writes) {
    const fullPath = `${target.basePath}/${write.relativePath}`;
    // Containment gate in front of the write: resolve both sides with the
    // host's own rules and compare on a separator boundary, so a sibling
    // directory whose name merely begins with the base's name is refused.
    const resolvedBase = path.resolve(target.basePath);
    const resolvedFull = path.resolve(fullPath);
    if (!resolvedFull.startsWith(resolvedBase + path.sep)) {
      throw new Error(`Refusing to write outside the install target: ${write.relativePath}`);
    }
    const dir = fullPath.replace(/\/[^/]+$/, '');
    await deps.fsWrite.mkdir(dir);
    await deps.fsWrite.writeTextFileAtomic(fullPath, write.content);
    if (resolvedPath === null) resolvedPath = fullPath;
  }

  const now = new Date().toISOString();
  const record: InstallRecord = {
    toolId: target.tool.id,
    resolvedPath: resolvedPath ?? '',
    format: format.kind,
    scope: target.scope,
    installedAt: existing?.installedAt ?? now,
    updatedAt: now,
    contentHash,
  };
  // The version key is added conditionally, never assigned undefined: this
  // module treats releaseTag as an opaque string it copies and nothing more,
  // and JSON.stringify would drop an undefined-valued key on the way to disk
  // while leaving the in-memory record disagreeing with what was persisted.
  if (content.releaseTag !== undefined) record.version = content.releaseTag;
  const nextRecords = upsertInstallRecord(records, record);
  await writeRegistry(registryPath, nextRecords, deps.fsWrite);

  return { toolId: target.tool.id, status: existing === undefined ? 'installed' : 'updated', resolvedPath };
}

// Runs installToTarget for every catalogue tool at global scope, resolving
// each tool's basePath via the caller-supplied resolveGlobalBasePath and its
// InstallContent via the caller-supplied getInstallContent (the still-
// placeholder Gap 1 port) — one getInstallContent call per target per run, no
// caching layer, per plan Assumption 6. Each tool is isolated in its own
// try/catch: a tool whose selectPrimaryFormat resolves to null already
// returns 'skipped-no-format' from installToTarget without throwing, but a
// tool whose primary format is a kind formatForTarget does not implement
// (e.g. OpenCode's real catalogue entry resolves to a structured-config-file
// format, out of scope for this workstream) throws instead — caught here and
// folded into the same 'skipped-no-format' result, so one tool's failure
// never aborts the batch for the remaining tools.
export async function installAllGlobal(
  catalogue: ToolDefinition[],
  resolveGlobalBasePath: (tool: ToolDefinition) => string,
  registryPath: string,
  deps: { fsWrite: FsWriteAccess; getInstallContent: GetInstallContent },
): Promise<InstallResult[]> {
  const results: InstallResult[] = [];
  for (const tool of catalogue) {
    try {
      const basePath = resolveGlobalBasePath(tool);
      const content = await deps.getInstallContent(tool.id);
      const target: InstallTarget = { tool, basePath, scope: { kind: 'global' } };
      const result = await installToTarget(target, content, registryPath, { fsWrite: deps.fsWrite });
      results.push(result);
    } catch {
      results.push({ toolId: tool.id, status: 'skipped-no-format', resolvedPath: null });
    }
  }
  return results;
}

// Deletes the tracked file/directory at the record's resolvedPath (if any),
// then removes the record and persists the registry. No-op (does not throw)
// if no record exists for the (toolId, scope) pair, matching the port's
// documented idempotent-remove contract.
export async function removeInstallation(
  toolId: string,
  scope: InstallScope,
  registryPath: string,
  deps: { fsWrite: FsWriteAccess },
): Promise<void> {
  const records = await readRegistry(registryPath, deps.fsWrite);
  const existing = findInstallRecord(records, toolId, scope);
  if (existing === undefined) return;

  await deps.fsWrite.remove(existing.resolvedPath);
  const nextRecords = removeInstallRecord(records, toolId, scope);
  await writeRegistry(registryPath, nextRecords, deps.fsWrite);
}
