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

import { createNodeFsAccess, createNodeFsWriteAccess } from './agentic-tools-fs-adapter.js';

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

// Fixture bytes chosen so a UTF-8 round trip would visibly corrupt them:
// a NUL, a lone 0x80 continuation byte and 0xFF are all unrepresentable, so
// this only survives if BOTH new methods omitted the encoding argument. The
// leading 'PK\x03\x04' is a real zip local-file-header signature, which is
// what the production caller actually moves through this pair.
const BINARY_FIXTURE = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x80, 0xff, 0xfe, 0x7f, 0x00, 0x01]);

test('writeBinaryFileAtomic / readBinaryFile round trip preserves non-UTF-8 bytes and leaves no stray tmp file', async () => {
  const fsWrite = createNodeFsWriteAccess();
  const target = path.join(tmpDir, 'binary-roundtrip.bin');
  await fsWrite.writeBinaryFileAtomic(target, BINARY_FIXTURE);

  const readBack = await fsWrite.readBinaryFile(target);
  assert.deepEqual(readBack, BINARY_FIXTURE);

  const entries = await fs.readdir(tmpDir);
  const stray = entries.filter((e) => e.includes('.tmp'));
  assert.deepEqual(stray, [], `no stray .tmp file should remain, found: ${stray.join(', ')}`);
});

test('readBinaryFile returns null on ENOENT rather than throwing', async () => {
  const fsWrite = createNodeFsWriteAccess();
  const missing = path.join(tmpDir, 'binary-does-not-exist.bin');
  const result = await fsWrite.readBinaryFile(missing);
  assert.equal(result, null);
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

test('createNodeFsAccess: pathExists returns true for a real file and false for a missing path', async () => {
  const fsAccess = createNodeFsAccess();
  const target = path.join(tmpDir, 'read-pathexists.txt');
  await fs.writeFile(target, 'hi', 'utf8');

  assert.equal(await fsAccess.pathExists(target), true);
  assert.equal(await fsAccess.pathExists(path.join(tmpDir, 'does-not-exist-either.txt')), false);
});

test('createNodeFsAccess: isDirectory returns true for a real directory and false for a file or missing path', async () => {
  const fsAccess = createNodeFsAccess();
  const dir = path.join(tmpDir, 'read-isdirectory-dir');
  await fs.mkdir(dir);
  const file = path.join(tmpDir, 'read-isdirectory-file.txt');
  await fs.writeFile(file, 'hi', 'utf8');

  assert.equal(await fsAccess.isDirectory(dir), true);
  assert.equal(await fsAccess.isDirectory(file), false);
  assert.equal(await fsAccess.isDirectory(path.join(tmpDir, 'does-not-exist-dir')), false);
});

test('createNodeFsAccess: resolveBinaryOnPath finds an executable fixture on PATH and rejects a non-executable one', async () => {
  const fsAccess = createNodeFsAccess();
  const binDir = path.join(tmpDir, 'fixture-bin');
  await fs.mkdir(binDir);

  const executableName = 'agentic-tools-fixture-exe';
  const executablePath = path.join(binDir, executableName);
  await fs.writeFile(executablePath, '#!/bin/sh\necho hi\n', { mode: 0o755 });

  const nonExecutableName = 'agentic-tools-fixture-not-exe';
  const nonExecutablePath = path.join(binDir, nonExecutableName);
  await fs.writeFile(nonExecutablePath, 'not a script\n', { mode: 0o644 });

  const originalPath = process.env.PATH;
  process.env.PATH = binDir + path.delimiter + (originalPath ?? '');
  try {
    const resolved = await fsAccess.resolveBinaryOnPath(executableName);
    assert.equal(resolved, executablePath);

    const resolvedMissing = await fsAccess.resolveBinaryOnPath(nonExecutableName);
    assert.equal(resolvedMissing, null);
  } finally {
    process.env.PATH = originalPath;
  }
});

test('createNodeFsAccess: expandTokens resolves ~ against os.homedir() and %VAR% against process.env', async () => {
  const fsAccess = createNodeFsAccess();
  const expandedHome = await fsAccess.expandTokens('~/some/sub/path');
  assert.equal(expandedHome, path.join(os.homedir(), 'some/sub/path'));

  process.env.AGENTIC_TOOLS_FS_ADAPTER_TEST_VAR = 'test-value';
  try {
    const expandedVar = await fsAccess.expandTokens('%AGENTIC_TOOLS_FS_ADAPTER_TEST_VAR%/rest');
    assert.equal(expandedVar, 'test-value/rest');
  } finally {
    delete process.env.AGENTIC_TOOLS_FS_ADAPTER_TEST_VAR;
  }
});
