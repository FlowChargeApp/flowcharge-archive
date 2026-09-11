// Shared, category-level detection signal functions plus the FsAccess port they
// run behind. Knows the two category rules and the FsAccess port shape; must
// never reference a specific tool id by name — a ToolDefinition (from
// ./agentic-tools-catalogue.js) is a plain argument, never a switch target.

import type { OS, ToolDefinition } from './agentic-tools-catalogue.js';

export interface FsAccess {
  pathExists(path: string): Promise<boolean>;
  isDirectory(path: string): Promise<boolean>;
  // Answers null for a missing file and throws for every other failure,
  // matching FsWriteAccess.readTextFile's existing contract in
  // ./agentic-tools-install.js.
  readTextFile(path: string): Promise<string | null>;
  resolveBinaryOnPath(name: string): Promise<string | null>;
  expandTokens(path: string): Promise<string>; // resolves '~', '%APPDATA%', '%USERPROFILE%', '%LOCALAPPDATA%'
}

export type DetectionConfidence = 'confirmed' | 'likely' | 'weak' | 'not-detected';

export interface DetectionResult {
  toolId: string;
  confidence: DetectionConfidence;
  resolvedConfigDir: string | null;
  matchedSignals: string[];
  needsManualVerification: boolean; // true iff any fact this result relied on is 'placeholder-unverified' for the queried OS
}

// cli category (Claude Code, OpenCode). Primary signal: resolveBinaryOnPath() on
// each of pathBinaryNames — a match on any of them is sufficient for 'confirmed',
// independent of config-dir state. This is what defeats the lazily-created-
// config-dir false negative: a freshly installed CLI tool may not have written
// its config dir yet, but its binary is already on PATH. Corroborating-only
// fallback: pathExists() on configDir[os], capped at 'likely'. Neither → 'not-detected'.
export async function cli(definition: ToolDefinition, fsAccess: FsAccess, os: OS): Promise<DetectionResult> {
  const matchedSignals: string[] = [];

  for (const name of definition.pathBinaryNames ?? []) {
    const resolved = await fsAccess.resolveBinaryOnPath(name);
    if (resolved !== null) {
      matchedSignals.push(`path-binary:${name}`);
      // A binary match alone already decides 'confirmed'; the config dir is only
      // resolved here for reporting/needsManualVerification, never as a signal.
      const matchedConfig = await findExistingConfigDir(definition, fsAccess, os);
      return {
        toolId: definition.id,
        confidence: 'confirmed',
        resolvedConfigDir: matchedConfig ? matchedConfig.expanded : null,
        matchedSignals,
        needsManualVerification: matchedConfig !== null && matchedConfig.sourceConfidence === 'placeholder-unverified',
      };
    }
  }

  const matchedConfig = await findExistingConfigDir(definition, fsAccess, os);
  if (matchedConfig !== null) {
    matchedSignals.push(`config-dir:${matchedConfig.expanded}`);
    return {
      toolId: definition.id,
      confidence: 'likely',
      resolvedConfigDir: matchedConfig.expanded,
      matchedSignals,
      needsManualVerification: matchedConfig.sourceConfidence === 'placeholder-unverified',
    };
  }

  return {
    toolId: definition.id,
    confidence: 'not-detected',
    resolvedConfigDir: null,
    matchedSignals,
    needsManualVerification: false,
  };
}

// gui-app category (Cursor, Windsurf). Primary signal: pathExists() across the
// queried OS's app-bundle/install-location candidate list (definition.installPaths[os])
// — a match is sufficient for 'confirmed' on its own, never requiring configDir too.
// Corroborating signals when no install-path candidate matches: pathExists() on
// configDir[os], plus (Linux only) resolveBinaryOnPath() on pathBinaryNames if
// present. Rule: configDir (or, on Linux, configDir OR a PATH-binary match) →
// 'likely' on macOS/Windows, but capped at 'weak' on Linux specifically — Linux
// packaging (AppImage/.deb/.tar.gz) has no single authoritative install path, so a
// missing bundle match there is far less informative than on the other two OSes.
// Never 'confirmed' from configDir or a PATH-binary match alone, on any OS.
// Neither → 'not-detected'.
export async function guiApp(definition: ToolDefinition, fsAccess: FsAccess, os: OS): Promise<DetectionResult> {
  const matchedSignals: string[] = [];

  for (const candidate of definition.installPaths?.[os] ?? []) {
    const expanded = await fsAccess.expandTokens(candidate.path);
    if (await fsAccess.pathExists(expanded)) {
      matchedSignals.push(`install-path:${expanded}`);
      const matchedConfig = await findExistingConfigDir(definition, fsAccess, os);
      return {
        toolId: definition.id,
        confidence: 'confirmed',
        resolvedConfigDir: matchedConfig ? matchedConfig.expanded : null,
        matchedSignals,
        // The fact actually used to produce 'confirmed' here is the install-path
        // candidate itself, not whatever configDir happens to also resolve to.
        needsManualVerification: candidate.sourceConfidence === 'placeholder-unverified',
      };
    }
  }

  const matchedConfig = await findExistingConfigDir(definition, fsAccess, os);
  let binaryMatched = false;
  if (os === 'linux') {
    for (const name of definition.pathBinaryNames ?? []) {
      const resolved = await fsAccess.resolveBinaryOnPath(name);
      if (resolved !== null) {
        matchedSignals.push(`path-binary:${name}`);
        binaryMatched = true;
        break;
      }
    }
  }

  if (matchedConfig !== null) {
    matchedSignals.push(`config-dir:${matchedConfig.expanded}`);
  }

  if (matchedConfig !== null || binaryMatched) {
    return {
      toolId: definition.id,
      confidence: os === 'linux' ? 'weak' : 'likely',
      resolvedConfigDir: matchedConfig ? matchedConfig.expanded : null,
      matchedSignals,
      needsManualVerification: matchedConfig !== null && matchedConfig.sourceConfidence === 'placeholder-unverified',
    };
  }

  return {
    toolId: definition.id,
    confidence: 'not-detected',
    resolvedConfigDir: null,
    matchedSignals,
    needsManualVerification: false,
  };
}

// Resolves the first existing configDir[os] candidate, along with the exact
// OsPath fact it came from. needsManualVerification is derived from only this
// fact — the one actually used to produce the result for the queried os — never
// from any other candidate on the same tool/OS that did not match, and never
// from another OS entry entirely.
async function findExistingConfigDir(
  definition: ToolDefinition,
  fsAccess: FsAccess,
  os: OS,
): Promise<{ expanded: string; sourceConfidence: string } | null> {
  for (const candidate of definition.configDir[os] ?? []) {
    const expanded = await fsAccess.expandTokens(candidate.path);
    if (await fsAccess.pathExists(expanded)) {
      return { expanded, sourceConfidence: candidate.sourceConfidence };
    }
  }
  return null;
}
