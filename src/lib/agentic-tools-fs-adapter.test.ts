// Tests for createNodeFsWriteAccess against a REAL fs.mkdtemp-created
// temporary directory — the one deliberate exception to this workstream's
// fake-based testing approach, per plan Testing strategy / Open question 2.
// The temp directory is created before all tests and removed after, even
// when an assertion throws.
//
// Run with `node --test dist/lib/agentic-tools-fs-adapter.test.js` after
// `npm run build`.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createNodeFsWriteAccess } from './agentic-tools-fs-adapter.js';

let tmpDir: string;

before(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentic-tools-fs-adapter-'));
});

after(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

test('readTextFile returns null on ENOENT rather than throwing', async () => {
  const fsWrite = createNodeFsWriteAccess();
  const missing = path.join(tmpDir, 'does-not-exist.txt');
  const result = await fsWrite.readTextFile(missing);
  assert.equal(result, null);
});

test('writeTextFileAtomic writes exact content and leaves no stray tmp file', async () => {
  const fsWrite = createNodeFsWriteAccess();
  const target = path.join(tmpDir, 'write-atomic.txt');
  await fsWrite.writeTextFileAtomic(target, 'hello world');

  const content = await fs.readFile(target, 'utf8');
  assert.equal(content, 'hello world');

  const entries = await fs.readdir(tmpDir);
  const stray = entries.filter((e) => e.includes('.tmp'));
  assert.deepEqual(stray, [], `no stray .tmp file should remain, found: ${stray.join(', ')}`);
});

test('writeTextFileAtomic can be read back via readTextFile', async () => {
  const fsWrite = createNodeFsWriteAccess();
  const target = path.join(tmpDir, 'roundtrip.txt');
  await fsWrite.writeTextFileAtomic(target, 'round trip content');
  const readBack = await fsWrite.readTextFile(target);
  assert.equal(readBack, 'round trip content');
});

test('remove on an already-absent path does not throw', async () => {
  const fsWrite = createNodeFsWriteAccess();
  const missing = path.join(tmpDir, 'never-existed');
  await assert.doesNotReject(() => fsWrite.remove(missing));
});

test('remove deletes a real file', async () => {
  const fsWrite = createNodeFsWriteAccess();
  const target = path.join(tmpDir, 'to-remove.txt');
  await fs.writeFile(target, 'bye', 'utf8');
  await fsWrite.remove(target);
  await assert.rejects(() => fs.access(target));
});

test('mkdir on an already-existing directory does not throw', async () => {
  const fsWrite = createNodeFsWriteAccess();
  const dir = path.join(tmpDir, 'existing-dir');
  await fsWrite.mkdir(dir);
  await assert.doesNotReject(() => fsWrite.mkdir(dir));

  const stat = await fs.stat(dir);
  assert.ok(stat.isDirectory());
});

test('expandTokens resolves a leading ~ against os.homedir()', async () => {
  const fsWrite = createNodeFsWriteAccess();
  const expanded = await fsWrite.expandTokens('~/some/sub/path');
  assert.equal(expanded, path.join(os.homedir(), 'some/sub/path'));
});

test('expandTokens resolves a %VAR% token against process.env', async () => {
  const fsWrite = createNodeFsWriteAccess();
  process.env.AGENTIC_TOOLS_FS_ADAPTER_TEST_VAR = 'test-value';
  try {
    const expanded = await fsWrite.expandTokens('%AGENTIC_TOOLS_FS_ADAPTER_TEST_VAR%/rest');
    assert.equal(expanded, 'test-value/rest');
  } finally {
    delete process.env.AGENTIC_TOOLS_FS_ADAPTER_TEST_VAR;
  }
});
