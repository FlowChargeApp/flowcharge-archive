// Tests for skill-content-fetch.ts. Three tiers:
//   (b) offline frontmatter-parser unit tests against inline fixture strings
//   (c) one live-network integration test against the real Gitea host
//   (d) offline release-path integration against a stubbed fetch and a fake
//       ArchiveFsAccess, covering the temporary zip's whole lifecycle and the
//       two release-only failure paths
//
// Tier (c) has no skip-when-offline mechanism: a Gitea-unreachable failure is
// this feature's accepted, by-design failure mode (acceptance criterion 3),
// not a reason to make the test conditional. It now exercises the release
// path only, so it also fails outright when the host publishes no release or
// the newest release carries no .zip asset — that failure is the feature
// working as designed, not a test defect.
//
// The tier letters are kept as they were, so a reader comparing against the
// plan and the task list still finds tier (b) and tier (c) where those name
// them. Tier (a)'s branch-tarball coverage went with the path it tested.
//
// Run with `node --test dist/test/unit/skill-content-fetch.test.js` after `npm run build`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { deflateRawSync } from 'node:zlib';

import { getInstallContent, parseSkillFrontmatter, PRAXIS_REPO_BASE_URL } from '../../lib/skill-content-fetch.js';
import { createNodeFsWriteAccess } from '../../lib/agentic-tools-fs-adapter.js';

// --- Tier (b): offline frontmatter parsing ---------------------------------

test('parseSkillFrontmatter parses a same-line description scalar', () => {
  const raw = '---\nname: prx-example\ndescription: A short one-line description.\n---\nBody text here.\n';
  const { name, description, body } = parseSkillFrontmatter(raw);

  assert.equal(name, 'prx-example');
  assert.equal(description, 'A short one-line description.');
  assert.equal(body, 'Body text here.\n');
});

test('parseSkillFrontmatter joins a folded \'>-\' multi-line description into a single non-empty string', () => {
  const raw = [
    '---',
    'name: prx-example',
    'description: >-',
    '  First line of the description,',
    '  second line of the description,',
    '  and a final line.',
    '---',
    'Body text here.',
    '',
  ].join('\n');

  const { name, description, body } = parseSkillFrontmatter(raw);

  assert.equal(name, 'prx-example');
  assert.equal(description.includes('\n'), false, 'continuation lines must be joined with spaces, not newlines');
  assert.equal(description.startsWith('>'), false, 'the \'>-\' block indicator must not leak into the parsed value');
  assert.ok(description.includes('First line of the description,'));
  assert.ok(description.includes('second line of the description,'));
  assert.ok(description.endsWith('and a final line.'));
  assert.equal(body, 'Body text here.\n');
});

// --- Tier (c): live network integration ------------------------------------

// Read from the live release asset flowcharge-skills-0.1.0.zip, not from
// memory: the zip's entry names are already relative to the skills root, so
// each name's first segment is the skill id verbatim.
const EXPECTED_IDS = [
  'fc-dev-principles',
  'fc-git',
  'fc-issue-list',
  'fc-plain-text-kanban',
  'fc-plan-feature',
  'fc-task-list',
  'fc-validate',
  'flowcharge',
];

const TMP_INSTALL_DIR = path.join(os.tmpdir(), 'flowcharge-skill-install');

test('getInstallContent installs the newest live release and returns the known 8 skills with flowcharge\'s known nested files', async () => {
  // The real adapter satisfies ArchiveFsAccess structurally, so it is passed
  // straight through with no wrapper.
  const content = await getInstallContent('claude-code', { fsWrite: createNodeFsWriteAccess() });

  assert.equal(content.version, 'fetched-from-git');
  assert.deepEqual(content.skills.map((s) => s.id), EXPECTED_IDS);

  for (const skill of content.skills) {
    assert.ok(skill.id.length > 0, `${skill.id}: id must be non-empty`);
    assert.equal(skill.name, skill.id, `${skill.id}: name must equal id`);
    assert.ok(skill.description.length > 0, `${skill.id}: description must be non-empty`);
    assert.ok(skill.body.length > 0, `${skill.id}: body must be non-empty`);
  }

  const orchestrate = content.skills.find((s) => s.id === 'flowcharge');
  if (!orchestrate) throw new Error('flowcharge missing from getInstallContent result');

  const expectedFiles = [
    'CONVENTIONS.md',
    'LICENSE',
    'prompts/create-issues.md',
    'prompts/create-plan.md',
    'prompts/execute-parent-task.md',
    'prompts/investigate.md',
    'prompts/kanban-add.md',
    'prompts/tasks-from-issues-diff.md',
    'prompts/tasks-from-issues-spec.md',
    'prompts/tasks-from-plan-diff.md',
    'prompts/tasks-from-plan-spec.md',
    'prompts/validate-issues.md',
    'prompts/validate-plan.md',
    'prompts/validate-tasks.md',
    'scripts/fc-index.mjs',
    'scripts/fc-rename-artefacts.mjs',
    'scripts/test/run-tests.mjs',
  ];

  assert.ok(orchestrate.files, 'flowcharge must have a files array');
  assert.deepEqual((orchestrate.files ?? []).map((f) => f.relativePath), expectedFiles);
  for (const f of orchestrate.files ?? []) {
    assert.equal(f.relativePath.includes('\\'), false, `${f.relativePath} must use forward slashes`);
    assert.ok(f.content.length > 0, `${f.relativePath} must have non-empty content`);
  }

  // Acceptance criterion 9, against the real host: the temporary zip never
  // outlives the call that created it. The directory either does not exist,
  // or holds no file at all.
  let leftovers: string[];
  try {
    leftovers = await fs.readdir(TMP_INSTALL_DIR);
  } catch (err) {
    assert.equal((err as NodeJS.ErrnoException).code, 'ENOENT');
    leftovers = [];
  }
  assert.deepEqual(leftovers, [], `no temporary file may survive, found: ${leftovers.join(', ')}`);
});

// --- Tier (d): offline release-path integration, against a stubbed fetch ---
//
// Everything below replaces the global fetch for the duration of one test and
// restores it in a finally, so a failing test can never leave tier (c) above
// stubbed out. The filesystem port is a fake that records every call, which
// is what lets these tests assert the temporary zip's whole lifecycle.

const RELEASES_API_MARKER = '/repos/';
const ASSET_DOWNLOAD_MARKER = '/releases/download/';

interface FsCall {
  fn: 'mkdir' | 'writeBinaryFileAtomic' | 'readBinaryFile' | 'remove';
  path: string;
  content?: Buffer;
}

// Records every port call, and persists written bytes so readBinaryFile
// returns what writeBinaryFileAtomic stored — unless readBackOverride is
// supplied, which is how the read-back-not-response-buffer test is built.
function fakeArchiveFs(readBackOverride?: Buffer): {
  calls: FsCall[];
  mkdir(p: string): Promise<void>;
  writeBinaryFileAtomic(p: string, content: Buffer): Promise<void>;
  readBinaryFile(p: string): Promise<Buffer | null>;
  remove(p: string): Promise<void>;
} {
  const calls: FsCall[] = [];
  const files = new Map<string, Buffer>();
  return {
    calls,
    async mkdir(p) {
      calls.push({ fn: 'mkdir', path: p });
    },
    async writeBinaryFileAtomic(p, content) {
      calls.push({ fn: 'writeBinaryFileAtomic', path: p, content });
      files.set(p, content);
    },
    async readBinaryFile(p) {
      calls.push({ fn: 'readBinaryFile', path: p });
      return readBackOverride ?? files.get(p) ?? null;
    },
    async remove(p) {
      calls.push({ fn: 'remove', path: p });
      files.delete(p);
    },
  };
}

// readCappedBody reads the stream rather than calling arrayBuffer(), so the
// stub must expose a real ReadableStream body — a plain object carrying only
// arrayBuffer() fails inside it with a confusing 'carried no body' error.
function stubResponse(payload: Buffer, status = 200): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(payload));
      controller.close();
    },
  });
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Stubbed failure',
    headers: new Headers({ 'content-length': String(payload.length) }),
    body,
  } as unknown as Response;
}

async function withStubbedFetch(
  handler: (url: string) => Response,
  run: (urls: string[]) => Promise<void>,
): Promise<void> {
  const original = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (input: unknown): Promise<Response> => {
    const url = String(input);
    urls.push(url);
    return handler(url);
  }) as typeof fetch;
  try {
    await run(urls);
  } finally {
    globalThis.fetch = original;
  }
}

function releaseListPayload(assets: { name: string }[]): Buffer {
  return Buffer.from(
    JSON.stringify([
      {
        tag_name: 'v9.9.9',
        name: 'Stub release',
        published_at: '2026-08-29T20:31:55+10:00',
        draft: false,
        prerelease: false,
        assets,
      },
    ]),
    'utf8',
  );
}

// A minimal deflate-only zip writer. Central-directory offsets are derived
// from the local records' real positions as they are emitted, so the fixture
// stays consistent with what a correct reader expects.
function buildZip(files: { name: string; text: string }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, 'utf8');
    const plain = Buffer.from(file.text, 'utf8');
    const data = deflateRawSync(plain);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8); // method: deflated
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(plain.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(Buffer.concat([local, nameBuf, data]));

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(plain.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([central, nameBuf]));

    offset += 30 + nameBuf.length + data.length;
  }

  const centralSize = centrals.reduce((sum, b) => sum + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, ...centrals, eocd]);
}

function skillMd(id: string, description: string): string {
  return `---\nname: ${id}\ndescription: ${description}\n---\nBody of ${id}.\n`;
}

test('release path: getInstallContent installs the newest release zip\'s skills, mapping entry names verbatim from the skills root', async () => {
  const assetZip = buildZip([
    { name: 'fc-bug-hunt/SKILL.md', text: skillMd('fc-bug-hunt', 'Hunts bugs.') },
    { name: 'fc-git/SKILL.md', text: skillMd('fc-git', 'Does git.') },
    { name: 'fc-git/prompts/commit.md', text: 'commit prompt body' },
  ]);
  const fsWrite = fakeArchiveFs();

  await withStubbedFetch(
    (url) => {
      if (url.includes(RELEASES_API_MARKER)) {
        return stubResponse(releaseListPayload([{ name: 'flowcharge-skills-9.9.9.zip' }]));
      }
      assert.ok(url.includes(ASSET_DOWNLOAD_MARKER), `unexpected outbound URL: ${url}`);
      return stubResponse(assetZip);
    },
    async (urls) => {
      const content = await getInstallContent('claude-code', { fsWrite });

      assert.equal(urls.length, 2, 'exactly two requests: the release list, then the asset');
      assert.equal(content.version, 'fetched-from-git');

      // Skills-rooted mapping: an entry named `fc-bug-hunt/SKILL.md` yields a
      // skill whose id is `fc-bug-hunt`, with NO `skills/` prefix handling and
      // NO top-level-directory stripping applied.
      assert.deepEqual(content.skills.map((s) => s.id), ['fc-bug-hunt', 'fc-git']);
      assert.equal(content.skills[0].description, 'Hunts bugs.');
      assert.deepEqual(
        (content.skills[1].files ?? []).map((f) => f.relativePath),
        ['prompts/commit.md'],
      );

      // Lifecycle 1: the bytes written to the temporary file are the bytes
      // that came down the wire, unaltered.
      const writes = fsWrite.calls.filter((c) => c.fn === 'writeBinaryFileAtomic');
      assert.equal(writes.length, 1, 'exactly one temporary zip per call');
      assert.deepEqual(writes[0].content, assetZip);

      // The temporary path is built from os.tmpdir(), a fixed prefix, the pid
      // and a UUID only — no network-derived text, so no release tag.
      const zipPath = writes[0].path;
      assert.equal(path.dirname(zipPath), TMP_INSTALL_DIR);
      assert.equal(zipPath.includes('v9.9.9'), false, 'the release tag must not reach any path segment');
      assert.deepEqual(
        fsWrite.calls.filter((c) => c.fn === 'mkdir').map((c) => c.path),
        [TMP_INSTALL_DIR],
      );

      // Lifecycle 3a: the temporary file is deleted on the success path.
      assert.deepEqual(
        fsWrite.calls.filter((c) => c.fn === 'remove').map((c) => c.path),
        [zipPath],
      );
    },
  );
});

test('release path: parseZip decodes the buffer readBinaryFile returned, not the HTTP response buffer', async () => {
  // Two DIFFERENT valid zips. The response carries one; the fake hands back
  // the other. The skills that come out prove which buffer was decoded.
  const responseZip = buildZip([
    { name: 'fc-from-response/SKILL.md', text: skillMd('fc-from-response', 'Never installed.') },
  ]);
  const readBackZip = buildZip([
    { name: 'fc-from-disk/SKILL.md', text: skillMd('fc-from-disk', 'Read back from the temporary file.') },
  ]);
  const fsWrite = fakeArchiveFs(readBackZip);

  await withStubbedFetch(
    (url) =>
      url.includes(RELEASES_API_MARKER)
        ? stubResponse(releaseListPayload([{ name: 'flowcharge-skills-9.9.9.zip' }]))
        : stubResponse(responseZip),
    async () => {
      const content = await getInstallContent('claude-code', { fsWrite });

      assert.deepEqual(content.skills.map((s) => s.id), ['fc-from-disk']);
      // And the response buffer really was the one written to disk, so the
      // difference above can only have come from the read-back step.
      const write = fsWrite.calls.find((c) => c.fn === 'writeBinaryFileAtomic');
      assert.deepEqual(write?.content, responseZip);
    },
  );
});

test('release path: the temporary zip is removed on a decode failure too', async () => {
  const corrupt = Buffer.from('this is not a zip archive at all', 'utf8');
  const fsWrite = fakeArchiveFs();

  await withStubbedFetch(
    (url) =>
      url.includes(RELEASES_API_MARKER)
        ? stubResponse(releaseListPayload([{ name: 'flowcharge-skills-9.9.9.zip' }]))
        : stubResponse(corrupt),
    async () => {
      await assert.rejects(
        () => getInstallContent('claude-code', { fsWrite }),
        /end-of-central-directory/,
      );

      const write = fsWrite.calls.find((c) => c.fn === 'writeBinaryFileAtomic');
      assert.ok(write, 'the corrupt asset is still written before decoding is attempted');
      assert.deepEqual(
        fsWrite.calls.filter((c) => c.fn === 'remove').map((c) => c.path),
        [write.path],
        'a corrupt zip must still leave nothing behind',
      );
    },
  );
});

// The two release-only failure paths. Each asserts on the REJECTION, and each
// also asserts the negatives — zero filesystem calls and exactly one outbound
// request — because those negatives are what the branch-tarball removal is
// for. A bare 'it throws' assertion would still pass against a re-introduced
// fallback that threw for some other reason, after creating the temporary
// directory or issuing a second request, which is precisely the regression
// these two tests exist to catch.

test('release path: an empty release list rejects with the named message, writes nothing, and makes no second request', async () => {
  const fsWrite = fakeArchiveFs();

  await withStubbedFetch(
    () => stubResponse(Buffer.from('[]', 'utf8')),
    async (urls) => {
      await assert.rejects(
        () => getInstallContent('claude-code', { fsWrite }),
        (err: unknown) => {
          const message = (err as Error).message;
          assert.ok(
            message.includes(PRAXIS_REPO_BASE_URL),
            `message must name the base URL, got: ${message}`,
          );
          assert.ok(message.includes('No published FlowCharge Core release found'));
          assert.ok(message.includes('empty or could not be read'));
          return true;
        },
      );

      assert.deepEqual(fsWrite.calls, [], 'no mkdir, no write, no read, no remove may happen');
      assert.equal(urls.length, 1, 'exactly one request, for the releases API only');
      assert.ok(urls[0].includes(RELEASES_API_MARKER));
      assert.equal(urls[0].includes(ASSET_DOWNLOAD_MARKER), false);
    },
  );
});

test('release path: a newest release with no .zip asset rejects naming that tag, writes nothing, and makes no second request', async () => {
  const fsWrite = fakeArchiveFs();

  await withStubbedFetch(
    () => stubResponse(releaseListPayload([{ name: 'flowcharge-skills-9.9.9.tar.gz' }, { name: 'checksums.txt' }])),
    async (urls) => {
      await assert.rejects(
        () => getInstallContent('claude-code', { fsWrite }),
        (err: unknown) => {
          const message = (err as Error).message;
          assert.ok(message.includes('v9.9.9'), `message must name the release tag, got: ${message}`);
          assert.ok(message.includes('carries no .zip asset'));
          return true;
        },
      );

      assert.deepEqual(fsWrite.calls, [], 'no mkdir, no write, no read, no remove may happen');
      assert.equal(urls.length, 1, 'exactly one request, for the releases API only');
      assert.ok(urls[0].includes(RELEASES_API_MARKER));
      assert.equal(urls[0].includes(ASSET_DOWNLOAD_MARKER), false);
    },
  );
});
