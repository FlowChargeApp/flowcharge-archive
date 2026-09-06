// Tests for .github/scripts/publish-release.mjs.
//
// Every case builds a throwaway set of git repositories under os.tmpdir() and
// copies publish-release.mjs (and its release-format.mjs sibling) into the
// fixture's own .github/scripts/ folder. That copy is what makes the script's
// self-location root resolution testable: running the real file with a cwd of
// the fixture would still resolve the root to this repository. The temporary
// directory pattern follows src/lib/projects.test.ts:41-59, and the fixture
// method is the one .github/scripts/release.test.mjs already establishes.
//
// The public fixture is given a fake origin — a second, bare local repository —
// so the slug derivation and the `git ls-remote --tags origin` check are both
// exercisable. /Users/akoukoullis/Work/AK/flowcharge-public has no origin at
// all, and no test points at it.
//
// Proving gh stayed uncalled needs a positive mechanism, not an absence: a stub
// gh is put on the child process PATH, and it appends to a marker file whenever
// it is asked to do anything other than answer --version. Every case then
// asserts the marker file does not exist, which is a real assertion that no
// `gh release create` ran. Answering --version without a marker is deliberate:
// that probe is rung 7 asking whether the tool exists, not an outward call.
//
// Run with `node --test .github/scripts/publish-release.test.mjs`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// The expected release notes are recomputed here from the fixture's own
// changelog text, so the assertion is independent of what publish-release.mjs
// itself read. Copying the script's output into the expectation would assert
// nothing.
import { sectionBody } from './release-format.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REAL_PUBLISH_MJS = path.join(__dirname, 'publish-release.mjs');
const REAL_RELEASE_FORMAT_MJS = path.join(__dirname, 'release-format.mjs');

// The fake origin lives at <root>/remotes/flowcharge/flowcharge-public.git, so
// the slug the script derives from it is exactly this pair of path segments.
const ORIGIN_OWNER = 'flowcharge';
const ORIGIN_NAME = 'flowcharge-public';
const ORIGIN_SLUG = `${ORIGIN_OWNER}/${ORIGIN_NAME}`;

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
// init.defaultBranch is configured there.
function initRepo(dir) {
  git(dir, ['init', '-q']);
  git(dir, ['symbolic-ref', 'HEAD', 'refs/heads/main']);
  git(dir, ['config', 'user.email', 'fixture@example.invalid']);
  git(dir, ['config', 'user.name', 'Publish Fixture']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  git(dir, ['config', 'tag.gpgsign', 'false']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'fixture']);
}

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

// The three artefact names the default build really produces for a version.
// There is no win-x64.exe among them: a Windows binary is deferred until it can
// be submitted to an installer or package-manager channel, so
// tools/package-cli.mjs leaves that target out of its default selection and no
// release carries it.
function artefactNamesFor(version) {
  return [
    `flowcharge-${version}-darwin-arm64`,
    `flowcharge-${version}-darwin-x64`,
    `flowcharge-${version}-linux-x64`,
  ];
}

function defaultChangelog(version) {
  return `# Changelog\n\n## Unreleased\n\n## ${version} - 2026-09-04\n\nFirst release.\n\n- One thing.\n- Another thing.\n`;
}

// The whole fixture, built so that every default passes every rung. Each case
// overrides only the one thing its own rung is about.
//
// version: the package.json version field. hasVersion: false omits the field
// entirely — a separate flag rather than `version: undefined`, because a
// destructuring default treats an explicit undefined as absent and would
// silently restore the default version.
function makeFixture({
  version = '0.1.0',
  hasVersion = true,
  hasPackageJson = true,
  hasPublic = true,
  initPublicGit = true,
  hasOrigin = true,
  tag = 'v0.1.0',
  pushTag = true,
  changelog = undefined,
  artefacts = undefined,
  ghOnPath = true,
} = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-publish-test-'));
  const source = path.join(root, 'source');
  const publicRepo = path.join(root, 'flowcharge-public');
  const origin = path.join(root, 'remotes', ORIGIN_OWNER, `${ORIGIN_NAME}.git`);
  const marker = path.join(root, 'gh-called.log');
  const bin = path.join(root, 'bin');

  fs.mkdirSync(path.join(source, '.github', 'scripts'), { recursive: true });
  fs.copyFileSync(REAL_PUBLISH_MJS, path.join(source, '.github', 'scripts', 'publish-release.mjs'));
  fs.copyFileSync(REAL_RELEASE_FORMAT_MJS, path.join(source, '.github', 'scripts', 'release-format.mjs'));
  fs.mkdirSync(path.join(source, 'release', 'cli'), { recursive: true });

  if (hasPackageJson) {
    const pkg = { name: 'flowcharge', private: true };
    if (hasVersion) pkg.version = version;
    fs.writeFileSync(path.join(source, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
  }

  // Each entry is a name, or a [name, contents] pair when the case needs a
  // specific size — a zero-length artefact, for instance.
  const files = artefacts ?? artefactNamesFor(version);
  for (const entry of files) {
    const [name, contents] = Array.isArray(entry) ? entry : [entry, 'binary\n'];
    fs.writeFileSync(path.join(source, 'release', 'cli', name), contents);
  }

  const changelogText = changelog === undefined ? defaultChangelog(version) : changelog;

  if (hasPublic) {
    fs.mkdirSync(publicRepo, { recursive: true });
    fs.writeFileSync(path.join(publicRepo, 'tracked.txt'), 'tracked\n');
    if (changelogText !== null) fs.writeFileSync(path.join(publicRepo, 'CHANGELOG.md'), changelogText);
    if (initPublicGit) {
      initRepo(publicRepo);
      if (hasOrigin) {
        fs.mkdirSync(path.dirname(origin), { recursive: true });
        git(root, ['init', '--bare', '-q', origin]);
        git(publicRepo, ['remote', 'add', 'origin', origin]);
        git(publicRepo, ['push', '-q', 'origin', 'main']);
      }
      if (tag !== null) {
        git(publicRepo, ['tag', '-a', tag, '-m', `FlowCharge ${tag} (fixture)`]);
        if (hasOrigin && pushTag) git(publicRepo, ['push', '-q', 'origin', tag]);
      }
    }
  }

  // The child process PATH: git, because the script needs it, and the stub gh,
  // whose marker file is what proves no outward call happened. Overriding PATH
  // hides every tool from the child, so the ones a rung must still reach are
  // put back here by name.
  fs.mkdirSync(bin, { recursive: true });
  const realGit = resolveTool('git');
  assert.notEqual(realGit, null, 'git must be resolvable for these fixtures to mean anything');
  fs.symlinkSync(realGit, path.join(bin, 'git'));
  if (ghOnPath) {
    const stub = path.join(bin, 'gh');
    fs.writeFileSync(
      stub,
      `#!/bin/sh\nif [ "$1" = "--version" ]; then\n  echo "gh version 0.0.0 (stub)"\n  exit 0\nfi\nprintf '%s\\n' "$*" >> ${JSON.stringify(marker)}\nexit 0\n`,
    );
    fs.chmodSync(stub, 0o755);
  }

  return { root, source, publicRepo, origin, marker, bin };
}

function cleanup(fixture) {
  fs.rmSync(fixture.root, { recursive: true, force: true });
}

// Drives the fixture's own copy of publish-release.mjs as a child process. The
// cwd is deliberately somewhere unrelated, so a script that resolved its root
// from process.cwd() instead of from its own file location would fail here.
function runPublish(fixture, args = []) {
  const res = spawnSync(
    process.execPath,
    [path.join(fixture.source, '.github', 'scripts', 'publish-release.mjs'), ...args],
    {
      cwd: os.tmpdir(),
      encoding: 'utf8',
      env: { ...process.env, PATH: fixture.bin },
    },
  );
  return { status: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

// The shared assertion every refusal case makes: exit 1, the rung's own message
// on stderr, and no outward gh call.
function assertRefusal(fixture, res, { message, absent = [] }) {
  assert.equal(res.status, 1, `expected exit 1, got ${res.status}. stderr: ${res.stderr}`);
  assert.match(res.stderr, message, `stderr must name the rung's own problem. stderr: ${res.stderr}`);
  for (const pattern of absent) {
    assert.doesNotMatch(res.stderr, pattern, `stderr must not name another rung. stderr: ${res.stderr}`);
  }
  assert.equal(fs.existsSync(fixture.marker), false, 'gh must never be invoked by a refusal');
}

// --- One refusal case per ladder rung -------------------------------------

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
      assertRefusal(fixture, runPublish(fixture), { message: /not a bare X\.Y\.Z/ });
    } finally {
      cleanup(fixture);
    }
  });
}

test('rung 2 refuses a public repository path that does not exist', () => {
  const fixture = makeFixture({ hasPublic: false });
  try {
    assertRefusal(fixture, runPublish(fixture, [`--public-repo=${path.join(fixture.root, 'nowhere')}`]), {
      message: /does not exist/,
    });
  } finally {
    cleanup(fixture);
  }
});

test('rung 2 refuses a public path that holds no git repository', () => {
  const fixture = makeFixture({ initPublicGit: false });
  try {
    assertRefusal(fixture, runPublish(fixture, [`--public-repo=${fixture.publicRepo}`]), {
      message: /holds no git repository/,
    });
  } finally {
    cleanup(fixture);
  }
});

test('rung 3 refuses when no slug can be resolved, naming git remote add origin', () => {
  const fixture = makeFixture({ hasOrigin: false });
  try {
    assertRefusal(fixture, runPublish(fixture, [`--public-repo=${fixture.publicRepo}`]), {
      message: /no GitHub repository could be resolved/,
    });
    const res = runPublish(fixture, [`--public-repo=${fixture.publicRepo}`]);
    assert.match(res.stderr, /remote add origin/, 'the refusal must name the fix');
    assert.match(res.stderr, /--repo=<owner>\/<name>/, 'the refusal must name the flag alternative');
  } finally {
    cleanup(fixture);
  }
});

test('rung 4 refuses when the tag does not exist locally', () => {
  const fixture = makeFixture({ tag: null });
  try {
    assertRefusal(fixture, runPublish(fixture, [`--public-repo=${fixture.publicRepo}`]), {
      message: /the tag v0\.1\.0 does not exist in/,
      absent: [/has not been pushed/],
    });
  } finally {
    cleanup(fixture);
  }
});

test('rung 4 refuses when the tag exists locally but not on origin, naming the push command', () => {
  const fixture = makeFixture({ pushTag: false });
  try {
    const res = runPublish(fixture, [`--public-repo=${fixture.publicRepo}`]);
    assertRefusal(fixture, res, {
      message: /the tag v0\.1\.0 has not been pushed/,
      absent: [/does not exist in/],
    });
    assert.match(res.stderr, /push origin v0\.1\.0/, 'the refusal must name the push command');
  } finally {
    cleanup(fixture);
  }
});

test('rung 5 refuses when no changelog section names the version', () => {
  const fixture = makeFixture({ changelog: '# Changelog\n\n## Unreleased\n\nNothing yet.\n' });
  try {
    assertRefusal(fixture, runPublish(fixture, [`--public-repo=${fixture.publicRepo}`]), {
      message: /holds no section for 0\.1\.0/,
      absent: [/holds no text/],
    });
  } finally {
    cleanup(fixture);
  }
});

test('rung 5 refuses an empty changelog section with its own distinct message', () => {
  const fixture = makeFixture({
    changelog: '# Changelog\n\n## 0.1.0 - 2026-09-04\n\n## Older\n\nSomething.\n',
  });
  try {
    assertRefusal(fixture, runPublish(fixture, [`--public-repo=${fixture.publicRepo}`]), {
      message: /section holds no text/,
      absent: [/holds no section for/],
    });
  } finally {
    cleanup(fixture);
  }
});

test('rung 6 refuses fewer than three artefacts', () => {
  const fixture = makeFixture({ artefacts: artefactNamesFor('0.1.0').slice(0, 2) });
  try {
    assertRefusal(fixture, runPublish(fixture, [`--public-repo=${fixture.publicRepo}`]), {
      message: /expected 3 flowcharge-0\.1\.0-\* artefacts .*found 2/s,
    });
  } finally {
    cleanup(fixture);
  }
});

test('rung 6 refuses more than three artefacts', () => {
  const fixture = makeFixture({
    artefacts: [...artefactNamesFor('0.1.0'), 'flowcharge-0.1.0-linux-arm64'],
  });
  try {
    assertRefusal(fixture, runPublish(fixture, [`--public-repo=${fixture.publicRepo}`]), {
      message: /expected 3 flowcharge-0\.1\.0-\* artefacts .*found 4/s,
    });
  } finally {
    cleanup(fixture);
  }
});

// A stray win-x64.exe is the specific "more than three" a deferred Windows
// target invites: the maintainer runs --target=win-x64 by hand and leaves the
// binary behind. Rung 6 must refuse it rather than publish a fourth asset.
test('rung 6 refuses a leftover Windows artefact alongside the three', () => {
  const fixture = makeFixture({
    artefacts: [...artefactNamesFor('0.1.0'), 'flowcharge-0.1.0-win-x64.exe'],
  });
  try {
    assertRefusal(fixture, runPublish(fixture, [`--public-repo=${fixture.publicRepo}`]), {
      message: /expected 3 flowcharge-0\.1\.0-\* artefacts .*found 4/s,
    });
  } finally {
    cleanup(fixture);
  }
});

test('rung 6 refuses three artefacts when one is zero-length', () => {
  const names = artefactNamesFor('0.1.0');
  const fixture = makeFixture({
    artefacts: [names[0], names[1], [names[2], '']],
  });
  try {
    assertRefusal(fixture, runPublish(fixture, [`--public-repo=${fixture.publicRepo}`]), {
      message: /these artefacts are empty: flowcharge-0\.1\.0-linux-x64/,
    });
  } finally {
    cleanup(fixture);
  }
});

test('rung 7 refuses when gh is not usable on PATH', () => {
  const fixture = makeFixture({ ghOnPath: false });
  try {
    assertRefusal(fixture, runPublish(fixture, [`--public-repo=${fixture.publicRepo}`]), {
      message: /gh is not usable on PATH/,
    });
  } finally {
    cleanup(fixture);
  }
});

// --- The --dry-run argument vector -----------------------------------------
//
// This is the whole verification the publish path receives: no `gh release
// create` is ever run for real. The vector is therefore asserted element by
// element rather than merely being printed.

// The vector publish-release.mjs printed, read back from its own output. Each
// element is printed JSON-quoted on its own line, so a multi-line notes body
// stays exactly one element.
function parseVector(stdout) {
  const lines = stdout.split('\n');
  const header = lines.findIndex((line) => line.includes('--dry-run, gh would be called with:'));
  assert.notEqual(header, -1, `the dry run must announce itself. stdout: ${stdout}`);
  return lines
    .slice(header + 1)
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line.trim()));
}

test('--dry-run prints the whole gh release create vector and calls nothing', () => {
  const version = '0.1.0';
  const fixture = makeFixture({ version });
  try {
    const res = runPublish(fixture, [`--public-repo=${fixture.publicRepo}`, '--dry-run']);
    assert.equal(res.status, 0, `--dry-run must exit 0, got ${res.status}: ${res.stderr}`);

    const notes = sectionBody(defaultChangelog(version), version);
    assert.notEqual(notes, null, 'the fixture changelog must hold a section for this version');
    assert.notEqual(notes, '', 'the fixture changelog section must hold text');

    // The real path of the fixture root, not the path mkdtemp handed back: on
    // macOS os.tmpdir() is /var/..., a symlink to /private/var/..., and the
    // script resolves its own root from its own module URL, which is already
    // resolved. The expected asset paths must be written the same way.
    const sourceRoot = fs.realpathSync(fixture.source);
    const assets = artefactNamesFor(version)
      .slice()
      .sort()
      .map((name) => path.join(sourceRoot, 'release', 'cli', name));

    assert.deepEqual(parseVector(res.stdout), [
      'gh',
      'release',
      'create',
      `v${version}`,
      '--repo',
      ORIGIN_SLUG,
      '--title',
      `FlowCharge v${version}`,
      '--notes',
      notes,
      ...assets,
    ]);

    // The three assets carry the real names, and they are last and in a fixed
    // order. No Windows binary appears: that target is deferred, so the sorted
    // set ends at linux-x64.
    assert.deepEqual(parseVector(res.stdout).slice(-3), assets);
    assert.equal(path.basename(assets[2]), `flowcharge-${version}-linux-x64`);
    assert.deepEqual(
      assets.filter((asset) => /-win-x64/.test(path.basename(asset))),
      [],
      'a deferred Windows binary must never reach the gh vector',
    );

    // Reproducible: a second run of the same fixture prints the same vector.
    const again = runPublish(fixture, [`--public-repo=${fixture.publicRepo}`, '--dry-run']);
    assert.equal(again.status, 0);
    assert.deepEqual(parseVector(again.stdout), parseVector(res.stdout), 'the asset order must be stable');

    assert.equal(fs.existsSync(fixture.marker), false, 'a dry run must never invoke gh');
  } finally {
    cleanup(fixture);
  }
});

test('--dry-run with --repo overrides the origin-derived slug', () => {
  const version = '0.1.0';
  const fixture = makeFixture({ version });
  try {
    const res = runPublish(fixture, [
      `--public-repo=${fixture.publicRepo}`,
      '--repo=someone-else/another-name',
      '--dry-run',
    ]);
    assert.equal(res.status, 0, `--dry-run must exit 0, got ${res.status}: ${res.stderr}`);

    const vector = parseVector(res.stdout);
    const repoIndex = vector.indexOf('--repo');
    assert.notEqual(repoIndex, -1, 'the vector must carry --repo');
    assert.equal(vector[repoIndex + 1], 'someone-else/another-name', '--repo must win over origin');
    assert.equal(vector.includes(ORIGIN_SLUG), false, 'the origin-derived slug must not appear');

    assert.equal(fs.existsSync(fixture.marker), false, 'a dry run must never invoke gh');
  } finally {
    cleanup(fixture);
  }
});
