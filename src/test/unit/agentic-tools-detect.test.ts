// End-to-end test of detectTool() against the real Claude Code catalogue entry.
// Follows extract.test.ts's node:test + node:assert/strict + in-memory-fake
// pattern.
//
// Run with `node --test dist/test/unit/agentic-tools-detect.test.js` after `npm run build`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { FsAccess } from '../../lib/agentic-tools-signals.js';
import { detectTool } from '../../lib/agentic-tools-detect.js';
import { TOOL_CATALOGUE } from '../../lib/agentic-tools-catalogue.js';

const claudeCode = TOOL_CATALOGUE.find((t) => t.id === 'claude-code');
if (!claudeCode) throw new Error('expected a claude-code entry in TOOL_CATALOGUE');

function fakeFsAccess(opts: { binaryOnPath?: boolean; configDirExists?: boolean }): FsAccess {
  return {
    async pathExists(path: string) {
      return Boolean(opts.configDirExists) && path.includes('.claude');
    },
    async isDirectory() {
      return true;
    },
    async resolveBinaryOnPath(name: string) {
      return opts.binaryOnPath && name === 'claude' ? '/usr/local/bin/claude' : null;
    },
    async expandTokens(path: string) {
      return path.replace('~', '/home/fakeuser').replace('%USERPROFILE%', 'C:\\Users\\fakeuser');
    },
  };
}

test('detectTool returns confirmed for Claude Code when the claude binary is on PATH', async () => {
  const fsAccess = fakeFsAccess({ binaryOnPath: true, configDirExists: false });
  const result = await detectTool(claudeCode, fsAccess, 'macos');
  assert.equal(result.confidence, 'confirmed');
  assert.equal(result.toolId, 'claude-code');
});

test('detectTool returns likely for Claude Code when only the config dir exists', async () => {
  const fsAccess = fakeFsAccess({ binaryOnPath: false, configDirExists: true });
  const result = await detectTool(claudeCode, fsAccess, 'macos');
  assert.equal(result.confidence, 'likely');
});

test('detectTool returns not-detected for Claude Code when neither signal is present', async () => {
  const fsAccess = fakeFsAccess({ binaryOnPath: false, configDirExists: false });
  const result = await detectTool(claudeCode, fsAccess, 'macos');
  assert.equal(result.confidence, 'not-detected');
});

// gui-app category cases, against the real Cursor and Windsurf catalogue entries
// (not synthetic fixtures) so these tests also exercise the sourceConfidence tags
// authored on those entries themselves.

const cursor = TOOL_CATALOGUE.find((t) => t.id === 'cursor');
if (!cursor) throw new Error('expected a cursor entry in TOOL_CATALOGUE');

const windsurf = TOOL_CATALOGUE.find((t) => t.id === 'windsurf');
if (!windsurf) throw new Error('expected a windsurf entry in TOOL_CATALOGUE');

// A minimal in-memory fake keyed on the exact expanded paths the test wants to
// report as existing, plus which PATH binaries resolve.
function fakeGuiAppFsAccess(opts: { existingPaths?: string[]; binaryOnPath?: string[] }): FsAccess {
  const existing = new Set(opts.existingPaths ?? []);
  const binaries = new Set(opts.binaryOnPath ?? []);
  return {
    async pathExists(path: string) {
      return existing.has(path);
    },
    async isDirectory() {
      return true;
    },
    async resolveBinaryOnPath(name: string) {
      return binaries.has(name) ? `/usr/local/bin/${name}` : null;
    },
    async expandTokens(path: string) {
      return path
        .replace('~', '/home/fakeuser')
        .replace('%USERPROFILE%', 'C:\\Users\\fakeuser')
        .replace('%LOCALAPPDATA%', 'C:\\Users\\fakeuser\\AppData\\Local');
    },
  };
}

test('detectTool returns confirmed for Cursor when its macOS app bundle is found', async () => {
  const fsAccess = fakeGuiAppFsAccess({ existingPaths: ['/Applications/Cursor.app'] });
  const result = await detectTool(cursor, fsAccess, 'macos');
  assert.equal(result.confidence, 'confirmed');
  assert.equal(result.toolId, 'cursor');
});

test('detectTool caps Cursor at weak on Linux when only the config dir exists', async () => {
  const fsAccess = fakeGuiAppFsAccess({ existingPaths: ['/home/fakeuser/.cursor/'] });
  const result = await detectTool(cursor, fsAccess, 'linux');
  assert.equal(result.confidence, 'weak');
});

test('detectTool sets needsManualVerification true for Windsurf on windows, where the config dir is a placeholder-unverified fact', async () => {
  const fsAccess = fakeGuiAppFsAccess({ existingPaths: ['C:\\Users\\fakeuser\\.codeium\\windsurf\\'] });
  const result = await detectTool(windsurf, fsAccess, 'windows');
  assert.equal(result.needsManualVerification, true);
});

test('detectTool sets needsManualVerification false for Windsurf on macos, where the same fact is verified', async () => {
  const fsAccess = fakeGuiAppFsAccess({ existingPaths: ['/home/fakeuser/.codeium/windsurf/'] });
  const result = await detectTool(windsurf, fsAccess, 'macos');
  assert.equal(result.needsManualVerification, false);
});
