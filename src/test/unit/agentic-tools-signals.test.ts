// Unit tests for the cli category signal function. Follows extract.test.ts's
// node:test + node:assert/strict + in-memory-fake pattern.
//
// Run with `node --test dist/test/unit/agentic-tools-signals.test.js` after `npm run build`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { FsAccess } from '../../lib/agentic-tools-signals.js';
import { cli } from '../../lib/agentic-tools-signals.js';
import type { ToolDefinition } from '../../lib/agentic-tools-catalogue.js';

const FAKE_TOOL: ToolDefinition = {
  id: 'fake-cli-tool',
  displayName: 'Fake CLI Tool',
  category: 'cli',
  pathBinaryNames: ['faketool'],
  configDir: {
    macos: [{ path: '~/.faketool/', sourceConfidence: 'verified' }],
    linux: [{ path: '~/.faketool/', sourceConfidence: 'verified' }],
    windows: [{ path: '%USERPROFILE%\\.faketool\\', sourceConfidence: 'placeholder-unverified' }],
  },
  integrationFormats: [],
};

// A minimal in-memory fake: binaries and paths are just sets the test seeds.
function fakeFsAccess(opts: { binaryOnPath?: boolean; configDirExists?: boolean }): FsAccess {
  return {
    async pathExists(path: string) {
      return Boolean(opts.configDirExists) && path.includes('faketool');
    },
    async isDirectory() {
      return true;
    },
    async resolveBinaryOnPath(name: string) {
      return opts.binaryOnPath && name === 'faketool' ? '/usr/local/bin/faketool' : null;
    },
    async expandTokens(path: string) {
      return path.replace('~', '/home/fakeuser').replace('%USERPROFILE%', 'C:\\Users\\fakeuser');
    },
  };
}

test('cli returns confirmed when the binary is found on PATH, even without a config dir', async () => {
  const fsAccess = fakeFsAccess({ binaryOnPath: true, configDirExists: false });
  const result = await cli(FAKE_TOOL, fsAccess, 'macos');
  assert.equal(result.confidence, 'confirmed');
  assert.equal(result.toolId, 'fake-cli-tool');
  assert.ok(result.matchedSignals.some((s) => s.startsWith('path-binary:')));
});

test('cli returns likely when only the config dir exists', async () => {
  const fsAccess = fakeFsAccess({ binaryOnPath: false, configDirExists: true });
  const result = await cli(FAKE_TOOL, fsAccess, 'macos');
  assert.equal(result.confidence, 'likely');
  assert.ok(result.matchedSignals.some((s) => s.startsWith('config-dir:')));
});

test('cli returns not-detected when neither the binary nor the config dir is present', async () => {
  const fsAccess = fakeFsAccess({ binaryOnPath: false, configDirExists: false });
  const result = await cli(FAKE_TOOL, fsAccess, 'macos');
  assert.equal(result.confidence, 'not-detected');
  assert.equal(result.resolvedConfigDir, null);
  assert.equal(result.needsManualVerification, false);
});

test('needsManualVerification reflects only the queried OS fact, not another OS entry', async () => {
  const fsAccess = fakeFsAccess({ binaryOnPath: false, configDirExists: true });
  const macosResult = await cli(FAKE_TOOL, fsAccess, 'macos');
  assert.equal(macosResult.needsManualVerification, false, 'macos config dir is verified');

  const windowsResult = await cli(FAKE_TOOL, fsAccess, 'windows');
  assert.equal(windowsResult.needsManualVerification, true, 'windows config dir is placeholder-unverified');
});
