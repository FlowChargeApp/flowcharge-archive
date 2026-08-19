// Full-catalogue integration test for detectAllTools() plus a "golden catalogue"
// data-shape test over TOOL_CATALOGUE itself. Follows extract.test.ts's
// node:test + node:assert/strict + in-memory-fake pattern.
//
// Run with `node --test dist/lib/agentic-tools-catalogue.test.js` after
// `npm run build`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { FsAccess } from './agentic-tools-signals.js';
import { detectAllTools } from './agentic-tools-detect.js';
import { TOOL_CATALOGUE } from './agentic-tools-catalogue.js';

// A minimal fake that reports nothing as present — detectAllTools() just needs
// to run cleanly end to end across every catalogue entry; the confidence value
// each entry lands on is already covered by the per-tool tests elsewhere.
function fakeFsAccess(): FsAccess {
  return {
    async pathExists() {
      return false;
    },
    async isDirectory() {
      return false;
    },
    async resolveBinaryOnPath() {
      return null;
    },
    async expandTokens(path: string) {
      return path
        .replace('~', '/home/fakeuser')
        .replace('%USERPROFILE%', 'C:\\Users\\fakeuser')
        .replace('%LOCALAPPDATA%', 'C:\\Users\\fakeuser\\AppData\\Local')
        .replace('%APPDATA%', 'C:\\Users\\fakeuser\\AppData\\Roaming');
    },
  };
}

test('detectAllTools returns exactly one DetectionResult per catalogue entry, matched by toolId', async () => {
  const results = await detectAllTools(fakeFsAccess(), 'macos');
  assert.equal(results.length, TOOL_CATALOGUE.length);
  assert.equal(results.length, 4);

  const catalogueIds = TOOL_CATALOGUE.map((t) => t.id).sort();
  const resultIds = results.map((r) => r.toolId).sort();
  assert.deepEqual(resultIds, catalogueIds);
});

// Golden-catalogue shape test: cheap structural insurance against a future
// catalogue edit silently leaving a tool's entry incomplete. Asserts shape
// only (category present, a signal source appropriate to that category,
// macOS/Linux path data present) — not exact string values, which are already
// pinned by the per-tool tests in agentic-tools-detect.test.ts.
test('every TOOL_CATALOGUE entry has a category and macOS/Linux path data', () => {
  for (const entry of TOOL_CATALOGUE) {
    assert.ok(entry.category === 'cli' || entry.category === 'gui-app', `${entry.id} has a valid category`);
    assert.ok(entry.configDir.macos && entry.configDir.macos.length > 0, `${entry.id} has macOS configDir data`);
    assert.ok(entry.configDir.linux && entry.configDir.linux.length > 0, `${entry.id} has Linux configDir data`);
  }
});

test('every cli-category entry has at least one pathBinaryNames signal source', () => {
  for (const entry of TOOL_CATALOGUE.filter((t) => t.category === 'cli')) {
    assert.ok(entry.pathBinaryNames && entry.pathBinaryNames.length > 0, `${entry.id} has pathBinaryNames`);
  }
});

test('every gui-app-category entry has at least one install-path signal source', () => {
  for (const entry of TOOL_CATALOGUE.filter((t) => t.category === 'gui-app')) {
    const hasInstallPath = entry.installPaths
      && Object.values(entry.installPaths).some((candidates) => (candidates ?? []).length > 0);
    assert.ok(hasInstallPath, `${entry.id} has at least one installPaths candidate`);
  }
});
