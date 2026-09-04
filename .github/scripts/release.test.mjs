// Tests for .github/scripts/release.mjs.
//
// Every case builds a throwaway pair of git repositories under os.tmpdir() and
// copies release.mjs (and its release-format.mjs sibling) into the fixture's
// own .github/scripts/ folder. That copy is what makes the script's
// self-location root resolution testable: running the real file with a cwd of
// the fixture would still resolve the root to this repository. The temporary
// directory pattern follows src/lib/projects.test.ts:41-59.
//
// release.mjs is always driven as a child process, so each case asserts on the
// real command's exit status and stderr rather than on an imported function.
//
// No test points at /Users/akoukoullis/Work/AK/flowcharge-public, and no case
// passes every rung, so no case reaches `npm run package:cli`.
//
// Run with `node --test .github/scripts/release.test.mjs`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REAL_RELEASE_MJS = path.join(__dirname, 'release.mjs');
const REAL_RELEASE_FORMAT_MJS = path.join(__dirname, 'release-format.mjs');

// A git call inside a fixture. Fixture setup must never fail silently, so a
// non-zero exit throws with the tool's own stderr attached.
function git(cwd, args) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed in ${cwd}: ${res.stderr}`);
  }
  return res.stdout || '';
}

// A fixture repository on an explicit main branch with a local identity, so the
// commits succeed on a machine with no global git identity and whatever
// init.defaultBranch is configured there. symbolic-ref rather than `git init
// -b`, so the branch name is set the same way on every git version.
function initRepo(dir) {
  git(dir, ['init', '-q']);
  git(dir, ['symbolic-ref', 'HEAD', 'refs/heads/main']);
  git(dir, ['config', 'user.email', 'fixture@example.invalid']);
  git(dir, ['config', 'user.name', 'Release Fixture']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  git(dir, ['config', 'tag.gpgsign', 'false']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'fixture']);
}

// The source and public fixtures, built as siblings under one throwaway root so
// the default --public-repo resolution (<source root>/../flowcharge-public) can
// also be exercised.
//
// version: the package.json version field. hasVersion: false omits the field
// entirely — a separate flag rather than `version: undefined`, because a
// destructuring default treats an explicit undefined as absent and would
// silently restore the default version.
// hasPackageJson / initSourceGit / initPublicGit / hasPublic: each false leaves
// that part of the fixture out, to reach a specific rung.
function makeFixture({
  version = '0.1.0',
  hasVersion = true,
  hasPackageJson = true,
  initSourceGit = true,
  sourceBranch = 'main',
  dirtySource = false,
  hasPublic = true,
  initPublicGit = true,
  publicBranch = 'main',
  dirtyPublic = false,
  changelog = '# Changelog\n\n## 0.1.0 - 2026-09-04\n\nFirst release.\n',
  tag = null,
  artefacts = [],
} = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-release-test-'));
  const source = path.join(root, 'source');
  const publicRepo = path.join(root, 'flowcharge-public');

  fs.mkdirSync(path.join(source, '.github', 'scripts'), { recursive: true });
  fs.copyFileSync(REAL_RELEASE_MJS, path.join(source, '.github', 'scripts', 'release.mjs'));
  fs.copyFileSync(REAL_RELEASE_FORMAT_MJS, path.join(source, '.github', 'scripts', 'release-format.mjs'));
  fs.mkdirSync(path.join(source, 'release', 'cli'), { recursive: true });
  fs.writeFileSync(path.join(source, 'tracked.txt'), 'tracked\n');

  if (hasPackageJson) {
    const pkg = { name: 'flowcharge', private: true };
    if (hasVersion) pkg.version = version;
    fs.writeFileSync(path.join(source, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
  }
  for (const name of artefacts) {
    fs.writeFileSync(path.join(source, 'release', 'cli', name), 'x');
  }

  if (initSourceGit) {
    initRepo(source);
    if (sourceBranch !== 'main') git(source, ['checkout', '-q', '-b', sourceBranch]);
    if (dirtySource) fs.writeFileSync(path.join(source, 'tracked.txt'), 'modified\n');
  }

  if (hasPublic) {
    fs.mkdirSync(publicRepo, { recursive: true });
    fs.writeFileSync(path.join(publicRepo, 'tracked.txt'), 'tracked\n');
    if (changelog !== null) fs.writeFileSync(path.join(publicRepo, 'CHANGELOG.md'), changelog);
    if (initPublicGit) {
      initRepo(publicRepo);
      if (publicBranch !== 'main') git(publicRepo, ['checkout', '-q', '-b', publicBranch]);
      if (tag !== null) git(publicRepo, ['tag', '-a', tag, '-m', `fixture ${tag}`]);
      if (dirtyPublic) fs.writeFileSync(path.join(publicRepo, 'tracked.txt'), 'modified\n');
    }
  }

  return { root, source, publicRepo };
}

function cleanup(fixture) {
  fs.rmSync(fixture.root, { recursive: true, force: true });
}

// Drives the fixture's own copy of release.mjs as a child process. The cwd is
// deliberately somewhere unrelated, so a script that resolved its root from
// process.cwd() instead of from its own file location would fail here.
function runRelease(fixture, args = [], env = undefined) {
  const res = spawnSync(
    process.execPath,
    [path.join(fixture.source, '.github', 'scripts', 'release.mjs'), ...args],
    { cwd: os.tmpdir(), encoding: 'utf8', env: env ?? process.env },
  );
  return { status: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

// The names of every file in the fixture's release/cli/, used to prove a
// refusal built nothing.
function artefactNames(fixture) {
  return fs.readdirSync(path.join(fixture.source, 'release', 'cli')).sort();
}

// The fixture public repository's tags, used to prove a refusal tagged nothing.
function publicTags(fixture) {
  if (!fs.existsSync(path.join(fixture.publicRepo, '.git'))) return '';
  return git(fixture.publicRepo, ['tag']).trim();
}

test('--help exits 0 with usage on stdout when package.json is unreadable', () => {
  const fixture = makeFixture({ hasPackageJson: false });
  try {
    const res = runRelease(fixture, ['--help']);
    assert.equal(res.status, 0, `--help must exit 0, got ${res.status}: ${res.stderr}`);
    assert.match(res.stdout, /release\.mjs —/, '--help must print the usage text on stdout');
    assert.match(res.stdout, /--public-repo/, 'the usage text must document --public-repo');
    assert.equal(res.stderr, '', '--help must print nothing on stderr');
  } finally {
    cleanup(fixture);
  }
});

test('--help exits 0 with usage on stdout when the fixture holds no git repository', () => {
  const fixture = makeFixture({ initSourceGit: false, hasPublic: false });
  try {
    assert.equal(
      fs.existsSync(path.join(fixture.source, '.git')),
      false,
      'this case is only meaningful with no git repository present',
    );
    const res = runRelease(fixture, ['--help']);
    assert.equal(res.status, 0, `--help must exit 0, got ${res.status}: ${res.stderr}`);
    assert.match(res.stdout, /release\.mjs —/, '--help must print the usage text on stdout');
    assert.equal(res.stderr, '', '--help must print nothing on stderr');
  } finally {
    cleanup(fixture);
  }
});

// --- One refusal case per ladder rung -------------------------------------
//
// Every case below asserts three things: the exit status is 1, stderr names
// the problem that rung is about, and the public fixture carries no tag
// afterwards. Each also asserts release/cli/ is unchanged, which proves the
// refusal happened before the build. Every rung is reachable without a build,
// which is what keeps this whole file fast.

// The first executable named `name` on the current PATH, or null.
function resolveTool(name) {
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (dir === '') continue;
    const candidate = path.join(dir, name);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return fs.realpathSync(candidate);
    } catch {
      // Not here; keep looking.
    }
  }
  return null;
}

// A throwaway bin directory holding symlinks to exactly the named tools, for
// the cases that need a tool to be missing. Overriding PATH for the child hides
// every tool, so the ones the rung under test must still reach are put back by
// name. Returns null when one of them cannot be found at all.
function makeBinDir(fixture, tools) {
  const bin = path.join(fixture.root, 'bin');
  fs.mkdirSync(bin, { recursive: true });
  for (const name of tools) {
    const real = resolveTool(name);
    if (real === null) return null;
    fs.symlinkSync(real, path.join(bin, name));
  }
  return bin;
}

const BUN_ON_PATH = resolveTool('bun') !== null;

// The shared assertion every refusal case makes.
function assertRefusal(fixture, res, { message, absent = [], artefactsBefore = [] }) {
  assert.equal(res.status, 1, `expected exit 1, got ${res.status}. stderr: ${res.stderr}`);
  assert.match(res.stderr, message, `stderr must name the rung's own problem. stderr: ${res.stderr}`);
  for (const pattern of absent) {
    assert.doesNotMatch(res.stderr, pattern, `stderr must not name a later rung. stderr: ${res.stderr}`);
  }
  assert.equal(publicTags(fixture), '', 'a refusal must leave no tag behind');
  assert.deepEqual(artefactNames(fixture), artefactsBefore, 'a refusal must build nothing');
}

// Rung 1, four ways: the version field missing, carrying a leading v, holding
// two parts, and carrying a pre-release suffix.
for (const [label, options] of [
  ['missing', { hasVersion: false }],
  ['v-prefixed', { version: 'v0.1.0' }],
  ['two-part', { version: '0.2' }],
  ['pre-release', { version: '0.2.0-rc.1' }],
]) {
  test(`rung 1 refuses a ${label} package.json version`, () => {
    const fixture = makeFixture(options);
    try {
      assertRefusal(fixture, runRelease(fixture), { message: /not a bare X\.Y\.Z/ });
    } finally {
      cleanup(fixture);
    }
  });
}

test('rung 2 refuses a source repository that is not on main', () => {
  const fixture = makeFixture({ sourceBranch: 'feature/not-main' });
  try {
    assertRefusal(fixture, runRelease(fixture), {
      message: /this repository's current branch is "feature\/not-main", not main/,
    });
  } finally {
    cleanup(fixture);
  }
});

test('rung 3 refuses a dirty source working tree', () => {
  const fixture = makeFixture({ dirtySource: true });
  try {
    assertRefusal(fixture, runRelease(fixture), {
      message: /this repository's tracked working tree is dirty/,
    });
  } finally {
    cleanup(fixture);
  }
});

test('rung 4 refuses a public repository path that does not exist', () => {
  const fixture = makeFixture({ hasPublic: false });
  try {
    assertRefusal(fixture, runRelease(fixture, [`--public-repo=${path.join(fixture.root, 'nowhere')}`]), {
      message: /does not exist/,
    });
  } finally {
    cleanup(fixture);
  }
});

test('rung 4 refuses a public path that holds no git repository', () => {
  const fixture = makeFixture({ initPublicGit: false });
  try {
    assertRefusal(fixture, runRelease(fixture), { message: /holds no git repository/ });
  } finally {
    cleanup(fixture);
  }
});

test('rung 5 refuses a public repository that is not on main', () => {
  const fixture = makeFixture({ publicBranch: 'feature/not-main' });
  try {
    assertRefusal(fixture, runRelease(fixture), {
      message: /the public repository's current branch is "feature\/not-main", not main/,
    });
  } finally {
    cleanup(fixture);
  }
});

test('rung 6 refuses a dirty public working tree', () => {
  const fixture = makeFixture({ dirtyPublic: true });
  try {
    assertRefusal(fixture, runRelease(fixture), {
      message: /the public repository's tracked working tree is dirty/,
    });
  } finally {
    cleanup(fixture);
  }
});

test('rung 7 refuses a public repository with no CHANGELOG.md', () => {
  const fixture = makeFixture({ changelog: null });
  try {
    assertRefusal(fixture, runRelease(fixture), { message: /no CHANGELOG\.md at/ });
  } finally {
    cleanup(fixture);
  }
});

test('rung 7 refuses a CHANGELOG.md holding no release heading', () => {
  const fixture = makeFixture({ changelog: '# Changelog\n\n## Unreleased\n\nNothing yet.\n' });
  try {
    assertRefusal(fixture, runRelease(fixture), { message: /holds no "## X\.Y\.Z" release heading/ });
  } finally {
    cleanup(fixture);
  }
});

test('rung 7 refuses a CHANGELOG.md whose newest heading names another version', () => {
  const fixture = makeFixture({
    version: '0.1.0',
    changelog: '# Changelog\n\n## 0.2.0 - 2026-09-04\n\nSomething else.\n',
  });
  try {
    assertRefusal(fixture, runRelease(fixture), {
      message: /newest release heading is 0\.2\.0, not 0\.1\.0/,
    });
  } finally {
    cleanup(fixture);
  }
});

test('rung 8 refuses when the tag already exists in the public repository', () => {
  const fixture = makeFixture({ tag: 'v0.1.0' });
  try {
    const res = runRelease(fixture);
    assert.equal(res.status, 1, `expected exit 1, got ${res.status}. stderr: ${res.stderr}`);
    assert.match(res.stderr, /the tag v0\.1\.0 already exists in/);
    // The pre-existing fixture tag is the point of this case, so the shared
    // "no tag afterwards" assertion is replaced by "no new tag".
    assert.equal(publicTags(fixture), 'v0.1.0', 'the refusal must not add a tag of its own');
    assert.deepEqual(artefactNames(fixture), [], 'a refusal must build nothing');
  } finally {
    cleanup(fixture);
  }
});

test('rung 9 refuses when bun is not usable on PATH', () => {
  const fixture = makeFixture();
  try {
    const bin = makeBinDir(fixture, ['git']);
    assert.notEqual(bin, null, 'git must be resolvable for this case to mean anything');
    const res = runRelease(fixture, [], { ...process.env, PATH: bin });
    assertRefusal(fixture, res, {
      message: /bun is not usable on PATH/,
      absent: [/gh is not usable on PATH/],
    });
  } finally {
    cleanup(fixture);
  }
});

test('rung 10 refuses when gh is not usable on PATH', { skip: BUN_ON_PATH ? false : 'bun is not installed on this machine, so rung 10 cannot be reached' }, () => {
  const fixture = makeFixture();
  try {
    const bin = makeBinDir(fixture, ['git', 'bun']);
    assert.notEqual(bin, null, 'git and bun must be resolvable for this case to mean anything');
    const res = runRelease(fixture, [], { ...process.env, PATH: bin });
    assertRefusal(fixture, res, {
      message: /gh is not usable on PATH/,
      absent: [/bun is not usable on PATH/],
    });
  } finally {
    cleanup(fixture);
  }
});

// --- Ladder ordering -------------------------------------------------------
//
// A fixture wrong on two rungs at once must report the earlier one. Asserting
// only "exit 1" would prove nothing here, because both rungs exit 1, so each
// case asserts the earlier rung's own message text and asserts the later
// rung's message is absent. That pins the ladder table: a reordering fails
// loudly instead of passing silently.

test('ladder order: rung 1 is reported before rung 2', () => {
  const fixture = makeFixture({ version: 'v0.1.0', sourceBranch: 'feature/not-main' });
  try {
    const res = runRelease(fixture);
    assert.equal(res.status, 1, `expected exit 1, got ${res.status}. stderr: ${res.stderr}`);
    assert.match(res.stderr, /not a bare X\.Y\.Z/, 'the version rung must be reported');
    assert.doesNotMatch(res.stderr, /current branch is/, 'the branch rung must not be reached');
    assert.equal(publicTags(fixture), '', 'a refusal must leave no tag behind');
    assert.deepEqual(artefactNames(fixture), [], 'a refusal must build nothing');
  } finally {
    cleanup(fixture);
  }
});

test('ladder order: rung 3 is reported before rung 4', () => {
  const fixture = makeFixture({ dirtySource: true, hasPublic: false });
  try {
    const res = runRelease(fixture, [`--public-repo=${path.join(fixture.root, 'nowhere')}`]);
    assert.equal(res.status, 1, `expected exit 1, got ${res.status}. stderr: ${res.stderr}`);
    assert.match(
      res.stderr,
      /this repository's tracked working tree is dirty/,
      'the source-tree rung must be reported',
    );
    assert.doesNotMatch(res.stderr, /does not exist/, 'the public-path rung must not be reached');
    assert.equal(publicTags(fixture), '', 'a refusal must leave no tag behind');
    assert.deepEqual(artefactNames(fixture), [], 'a refusal must build nothing');
  } finally {
    cleanup(fixture);
  }
});

test('ladder order: rung 7 is reported before rung 8', () => {
  const fixture = makeFixture({
    version: '0.1.0',
    changelog: '# Changelog\n\n## 0.2.0 - 2026-09-04\n\nSomething else.\n',
    tag: 'v0.1.0',
  });
  try {
    const res = runRelease(fixture);
    assert.equal(res.status, 1, `expected exit 1, got ${res.status}. stderr: ${res.stderr}`);
    assert.match(
      res.stderr,
      /newest release heading is 0\.2\.0, not 0\.1\.0/,
      'the changelog rung must be reported',
    );
    assert.doesNotMatch(res.stderr, /already exists/, 'the existing-tag rung must not be reached');
    assert.equal(publicTags(fixture), 'v0.1.0', 'the refusal must not add a tag of its own');
    assert.deepEqual(artefactNames(fixture), [], 'a refusal must build nothing');
  } finally {
    cleanup(fixture);
  }
});
