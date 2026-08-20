// Tests for skill-content-fetch.ts. Three tiers:
//   (a) offline parseTar unit tests against a small in-memory USTAR buffer
//   (b) offline frontmatter-parser unit tests against inline fixture strings
//   (c) one live-network integration test against the real Gitea host
//
// Tier (c) has no skip-when-offline mechanism: a Gitea-unreachable failure is
// this feature's accepted, by-design failure mode (acceptance criterion 3),
// not a reason to make the test conditional.
//
// Run with `node --test dist/lib/skill-content-fetch.test.js` after `npm run build`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getInstallContent, parseTar, parseSkillFrontmatter } from './skill-content-fetch.js';

// --- Tier (a): offline parseTar -------------------------------------------

// Builds one 512-byte USTAR header block. Only the fields parseTar actually
// reads are populated: name (0-100), typeflag (156), size (124-136, octal
// ASCII, NUL-terminated).
function buildHeader(name: string, typeflag: string, size: number): Buffer {
  const block = Buffer.alloc(512);
  block.write(name, 0, 'utf8');
  block.write(typeflag, 156, 'utf8');
  const sizeOctal = size.toString(8).padStart(11, '0') + '\0';
  block.write(sizeOctal, 124, 'utf8');
  return block;
}

function padTo512(buf: Buffer): Buffer {
  const remainder = buf.length % 512;
  if (remainder === 0) return buf;
  return Buffer.concat([buf, Buffer.alloc(512 - remainder)]);
}

test('parseTar skips a leading unrecognized-typeflag (\'g\') record and correctly parses a file and a directory entry', () => {
  const paxContent = Buffer.from('30 comment=irrelevant pax global header content\n');
  const paxBlock = Buffer.concat([buildHeader('pax_global_header', 'g', paxContent.length), padTo512(paxContent)]);

  const dirBlock = buildHeader('praxis-master/skills/prx-example/', '5', 0);

  const fileContent = Buffer.from('hello world');
  const fileBlock = Buffer.concat([
    buildHeader('praxis-master/skills/prx-example/SKILL.md', '0', fileContent.length),
    padTo512(fileContent),
  ]);

  const endOfArchive = Buffer.alloc(1024); // two all-zero blocks terminate the archive

  const archive = Buffer.concat([paxBlock, dirBlock, fileBlock, endOfArchive]);

  const entries = parseTar(archive);

  assert.equal(entries.length, 2, 'the \'g\' record must be skipped, not emitted as an entry');
  assert.equal(entries[0]!.typeflag, '5');
  assert.equal(entries[0]!.name, 'praxis-master/skills/prx-example/');
  assert.equal(entries[1]!.typeflag, '0');
  assert.equal(entries[1]!.name, 'praxis-master/skills/prx-example/SKILL.md');
  assert.equal(entries[1]!.content.toString('utf8'), 'hello world');
});

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

const EXPECTED_IDS = [
  'prx-bug-hunt',
  'prx-dev-principles',
  'prx-git',
  'prx-issue-list',
  'prx-orchestrate',
  'prx-plain-text-kanban',
  'prx-plan-feature',
  'prx-task-list',
];

test('getInstallContent fetches the live archive and returns the known 8 prx-* skills with prx-orchestrate\'s known nested files', async () => {
  const content = await getInstallContent('claude-code');

  assert.equal(content.version, 'fetched-from-git');
  assert.deepEqual(content.skills.map((s) => s.id), EXPECTED_IDS);

  for (const skill of content.skills) {
    assert.ok(skill.id.length > 0, `${skill.id}: id must be non-empty`);
    assert.equal(skill.name, skill.id, `${skill.id}: name must equal id`);
    assert.ok(skill.description.length > 0, `${skill.id}: description must be non-empty`);
    assert.ok(skill.body.length > 0, `${skill.id}: body must be non-empty`);
  }

  const orchestrate = content.skills.find((s) => s.id === 'prx-orchestrate');
  if (!orchestrate) throw new Error('prx-orchestrate missing from getInstallContent result');

  const expectedFiles = [
    'CONVENTIONS.md',
    'prompts/bug-hunt.md',
    'prompts/create-issues.md',
    'prompts/create-plan.md',
    'prompts/execute-parent-task.md',
    'prompts/investigate.md',
    'prompts/kanban-add.md',
    'prompts/tasks-from-issues-diff.md',
    'prompts/tasks-from-issues-spec.md',
    'prompts/tasks-from-plan-diff.md',
    'prompts/tasks-from-plan-spec.md',
    'scripts/prx-index.mjs',
    'scripts/test/run-tests.mjs',
  ];

  assert.ok(orchestrate.files, 'prx-orchestrate must have a files array');
  assert.deepEqual((orchestrate.files ?? []).map((f) => f.relativePath), expectedFiles);
  for (const f of orchestrate.files ?? []) {
    assert.equal(f.relativePath.includes('\\'), false, `${f.relativePath} must use forward slashes`);
    assert.ok(f.content.length > 0, `${f.relativePath} must have non-empty content`);
  }
});
