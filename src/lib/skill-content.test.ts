// Unit tests for skill-content.ts's SKILL.md frontmatter parsing and file
// enumeration. The folded-block-scalar case guards a real defect: reusing
// yaml-block.ts unmodified would silently drop prx-dev-principles's
// description into its `_raw` catch-all, since block scalars are explicitly
// outside that module's grammar (src/lib/yaml-block.ts:19).
//
// Run with `node --test dist/lib/skill-content.test.js` after `npm run build`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getInstallContent, readSkillDirectory } from './skill-content.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..', '..');
const skillsDir = path.join(repoRoot, 'skills');

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

test('getInstallContent ignores toolId and returns the same 8-skill result regardless of input', async () => {
  const a = await getInstallContent('claude-code');
  const b = await getInstallContent('some-other-tool-id');

  assert.equal(a.version, 'vendored-skills');
  assert.equal(a.skills.length, 8);
  assert.deepEqual(a.skills.map((s) => s.id), EXPECTED_IDS);
  assert.deepEqual(a.skills.map((s) => s.id), b.skills.map((s) => s.id));
});

test('all 8 skills have non-empty id/name/description/body, and id matches name', async () => {
  const content = await getInstallContent('claude-code');
  for (const skill of content.skills) {
    assert.ok(skill.id.length > 0, `${skill.id}: id must be non-empty`);
    assert.equal(skill.name, skill.id, `${skill.id}: name must equal id`);
    assert.ok(skill.description.length > 0, `${skill.id}: description must be non-empty`);
    assert.ok(skill.body.length > 0, `${skill.id}: body must be non-empty`);
  }
});

test('prx-dev-principles folded-block-scalar description parses to a single non-empty string', async () => {
  const content = await getInstallContent('claude-code');
  const skill = content.skills.find((s) => s.id === 'prx-dev-principles');
  if (!skill) throw new Error('prx-dev-principles missing from getInstallContent result');

  assert.ok(skill.description.length > 0);
  assert.equal(skill.description.includes('\n'), false, 'a folded scalar must join continuation lines with spaces, not newlines');
  assert.equal(skill.description.startsWith('>'), false, 'the ">-" block indicator must not leak into the parsed value');
  assert.ok(skill.description.includes('DRY, KISS,'), 'continuation lines must be joined, not dropped');
  assert.ok(skill.description.includes('modular.'), 'the final continuation line must survive to the end of the join');
});

test("prx-orchestrate's files enumerates its known nested files with forward-slash relativePaths", async () => {
  const content = await getInstallContent('claude-code');
  const skill = content.skills.find((s) => s.id === 'prx-orchestrate');
  if (!skill) throw new Error('prx-orchestrate missing from getInstallContent result');

  const expected = [
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

  assert.ok(skill.files, 'prx-orchestrate must have a files array');
  assert.deepEqual((skill.files ?? []).map((f) => f.relativePath), expected);
  for (const f of skill.files ?? []) {
    assert.equal(f.relativePath.includes('\\'), false, `${f.relativePath} must use forward slashes`);
    assert.ok(f.content.length > 0, `${f.relativePath} must have non-empty content`);
  }
});

test('the other 7 single-file skills have files omitted or empty', async () => {
  const content = await getInstallContent('claude-code');
  for (const skill of content.skills) {
    if (skill.id === 'prx-orchestrate') continue;
    assert.ok(!skill.files || skill.files.length === 0, `${skill.id}: files must be omitted or empty`);
  }
});

function withTempSkillCopy(sourceSkillId: string, run: (dir: string) => void): void {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'praxis-skill-content-test-'));
  try {
    const dest = path.join(tmpRoot, sourceSkillId);
    fs.cpSync(path.join(skillsDir, sourceSkillId), dest, { recursive: true });
    run(dest);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

test('a stray dotfile, .git*, and *.zip entry are excluded from files, without mutating the committed skills/ tree', () => {
  withTempSkillCopy('prx-bug-hunt', (dir) => {
    fs.writeFileSync(path.join(dir, '.DS_Store'), 'stray');
    fs.mkdirSync(path.join(dir, '.git'));
    fs.writeFileSync(path.join(dir, '.git', 'HEAD'), 'stray');
    fs.writeFileSync(path.join(dir, '.gitignore'), 'stray');
    fs.writeFileSync(path.join(dir, 'bundle.zip'), 'stray');
    fs.writeFileSync(path.join(dir, 'reference.md'), 'kept');

    const skill = readSkillDirectory(dir);
    const relativePaths = (skill.files ?? []).map((f) => f.relativePath);

    assert.deepEqual(relativePaths, ['reference.md']);
  });

  // The committed tree must be untouched by the test above.
  assert.ok(fs.existsSync(path.join(skillsDir, 'prx-bug-hunt', 'SKILL.md')));
  assert.equal(fs.existsSync(path.join(skillsDir, 'prx-bug-hunt', 'bundle.zip')), false);
});
