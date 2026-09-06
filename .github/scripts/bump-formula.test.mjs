// Tests for .github/scripts/bump-formula.mjs.
//
// Every case builds a throwaway set of git repositories under os.tmpdir() and
// copies bump-formula.mjs (and its release-format.mjs sibling) into the
// fixture's own .github/scripts/ folder. That copy is what makes the script's
// self-location root resolution testable: running the real file with a cwd of
// the fixture would still resolve the root to this repository. The fixture
// method is the one .github/scripts/publish-release.test.mjs already
// establishes.
//
// The public fixture is given a fake origin — a second, bare local repository —
// so the slug derivation is exercisable with no network at all.
// /Users/akoukoullis/Work/AK/homebrew-flowcharge and .../flowcharge-public are
// never touched: every case passes an explicit --tap-repo, and an explicit
// --public-repo or --repo.
//
// Proving a refusal wrote nothing needs a positive mechanism, not an exit code:
// every refusal case asserts that <tapRepo>/Formula/flowcharge.rb does not
// exist, and carries an `absent` pattern naming a neighbouring rung's message,
// so a ladder that fires the wrong rung fails rather than passing on the exit
// code alone.
//
// Run with `node --test .github/scripts/bump-formula.test.mjs`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REAL_BUMP_MJS = path.join(__dirname, 'bump-formula.mjs');
const REAL_RELEASE_FORMAT_MJS = path.join(__dirname, 'release-format.mjs');

// The fake origin lives at <root>/remotes/flowcharge/flowcharge-public.git, so
// the slug the script derives from it is exactly this pair of path segments.
const ORIGIN_OWNER = 'flowcharge';
const ORIGIN_NAME = 'flowcharge-public';
const ORIGIN_SLUG = `${ORIGIN_OWNER}/${ORIGIN_NAME}`;

// The three Homebrew-relevant platform labels, in the order the formula emits
// them. These are also the whole of what the default build now produces, since
// a Windows binary is deferred — but bump-formula.mjs names these three
// outright and reads no total, so the two counts agreeing is a coincidence the
// tests below do not rely on.
const PLATFORM_LABELS = ['darwin-arm64', 'darwin-x64', 'linux-x64'];

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
  git(dir, ['config', 'user.name', 'Bump Fixture']);
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

// The three artefact names the formula hashes, for a version.
function artefactNamesFor(version) {
  return PLATFORM_LABELS.map((label) => `flowcharge-${version}-${label}`);
}

// Distinct contents per platform on purpose: three identical files hash
// identically, which would hide a generator that reused one digest for all
// three platforms or transposed a pair.
function artefactContentsFor(label) {
  return `#!/bin/sh\necho "flowcharge fixture ${label}"\n`;
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
  hasTap = true,
  initTapGit = true,
  dirtyTap = false,
  hasPublic = true,
  initPublicGit = true,
  hasOrigin = true,
  artefacts = undefined,
} = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-bump-test-'));
  const source = path.join(root, 'source');
  const tapRepo = path.join(root, 'homebrew-flowcharge');
  const publicRepo = path.join(root, 'flowcharge-public');
  const origin = path.join(root, 'remotes', ORIGIN_OWNER, `${ORIGIN_NAME}.git`);
  const bin = path.join(root, 'bin');

  fs.mkdirSync(path.join(source, '.github', 'scripts'), { recursive: true });
  fs.copyFileSync(REAL_BUMP_MJS, path.join(source, '.github', 'scripts', 'bump-formula.mjs'));
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
    const [name, contents] = Array.isArray(entry)
      ? entry
      : [entry, artefactContentsFor(labelOf(entry, version))];
    fs.writeFileSync(path.join(source, 'release', 'cli', name), contents);
  }

  if (hasTap) {
    fs.mkdirSync(tapRepo, { recursive: true });
    // A tracked file, so rung 3's dirty-tree case has something to modify.
    fs.writeFileSync(path.join(tapRepo, 'README.md'), 'tap fixture\n');
    if (initTapGit) {
      initRepo(tapRepo);
      if (dirtyTap) fs.writeFileSync(path.join(tapRepo, 'README.md'), 'tap fixture, edited\n');
    }
  }

  if (hasPublic) {
    fs.mkdirSync(publicRepo, { recursive: true });
    fs.writeFileSync(path.join(publicRepo, 'tracked.txt'), 'tracked\n');
    if (initPublicGit) {
      initRepo(publicRepo);
      if (hasOrigin) {
        fs.mkdirSync(path.dirname(origin), { recursive: true });
        git(root, ['init', '--bare', '-q', origin]);
        git(publicRepo, ['remote', 'add', 'origin', origin]);
        git(publicRepo, ['push', '-q', 'origin', 'main']);
      }
    }
  }

  // The child process PATH: git alone, because that is the only tool this
  // command runs. Overriding PATH hides every other tool from the child, which
  // is the point — this command must never reach for gh.
  fs.mkdirSync(bin, { recursive: true });
  const realGit = resolveTool('git');
  assert.notEqual(realGit, null, 'git must be resolvable for these fixtures to mean anything');
  fs.symlinkSync(realGit, path.join(bin, 'git'));

  return { root, source, tapRepo, publicRepo, origin, bin, version };
}

// The platform label inside an artefact name, so each fixture binary gets its
// own contents even when a case passes an explicit name list.
function labelOf(name, version) {
  const prefix = `flowcharge-${version}-`;
  return name.startsWith(prefix) ? name.slice(prefix.length) : name;
}

function cleanup(fixture) {
  fs.rmSync(fixture.root, { recursive: true, force: true });
}

// The path the generator writes, inside a fixture's tap working copy.
function formulaPath(fixture) {
  return path.join(fixture.tapRepo, 'Formula', 'flowcharge.rb');
}

// Drives the fixture's own copy of bump-formula.mjs as a child process. The cwd
// is deliberately somewhere unrelated, so a script that resolved its root from
// process.cwd() instead of from its own file location would fail here.
function runBump(fixture, args = []) {
  const res = spawnSync(
    process.execPath,
    [path.join(fixture.source, '.github', 'scripts', 'bump-formula.mjs'), ...args],
    {
      cwd: os.tmpdir(),
      encoding: 'utf8',
      env: { ...process.env, PATH: fixture.bin },
    },
  );
  return { status: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

// The shared assertion every refusal case makes: exit 1, the rung's own message
// on stderr, no neighbouring rung's message, and no formula written.
function assertRefusal(fixture, res, { message, absent = [] }) {
  assert.equal(res.status, 1, `expected exit 1, got ${res.status}. stderr: ${res.stderr}`);
  assert.match(res.stderr, message, `stderr must name the rung's own problem. stderr: ${res.stderr}`);
  for (const pattern of absent) {
    assert.doesNotMatch(res.stderr, pattern, `stderr must not name another rung. stderr: ${res.stderr}`);
  }
  assert.equal(fs.existsSync(formulaPath(fixture)), false, 'a refusal must write no formula');
}

// --- --help ----------------------------------------------------------------

test('--help prints the usage text and exits 0 with no package.json and no repositories present', () => {
  const fixture = makeFixture({ hasPackageJson: false, hasTap: false, hasPublic: false });
  try {
    assert.equal(fs.existsSync(path.join(fixture.source, 'package.json')), false);
    assert.equal(fs.existsSync(fixture.tapRepo), false);
    assert.equal(fs.existsSync(fixture.publicRepo), false);

    const res = runBump(fixture, ['--help']);
    assert.equal(res.status, 0, `--help must exit 0, got ${res.status}: ${res.stderr}`);
    assert.match(res.stdout, /node \.github\/scripts\/bump-formula\.mjs \[--tap-repo=/, 'the usage line must be printed');
    assert.equal(res.stderr, '', '--help must print nothing on stderr');
    assert.equal(fs.existsSync(formulaPath(fixture)), false, '--help must write no formula');
  } finally {
    cleanup(fixture);
  }
});

// --- One refusal case per ladder rung ---------------------------------------

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
      assertRefusal(fixture, runBump(fixture, [`--tap-repo=${fixture.tapRepo}`, `--public-repo=${fixture.publicRepo}`]), {
        message: /not a bare X\.Y\.Z/,
        absent: [/tap repository path/, /artefacts are/],
      });
    } finally {
      cleanup(fixture);
    }
  });
}

test('rung 2 refuses a tap repository path that does not exist', () => {
  const fixture = makeFixture({ hasTap: false });
  try {
    assertRefusal(fixture, runBump(fixture, [`--tap-repo=${fixture.tapRepo}`, `--public-repo=${fixture.publicRepo}`]), {
      message: /the tap repository path .* does not exist/,
      absent: [/holds no git repository/, /not a bare X\.Y\.Z/, /uncommitted tracked changes/],
    });
  } finally {
    cleanup(fixture);
  }
});

test('rung 2 refuses a tap path that holds no git repository', () => {
  const fixture = makeFixture({ initTapGit: false });
  try {
    assertRefusal(fixture, runBump(fixture, [`--tap-repo=${fixture.tapRepo}`, `--public-repo=${fixture.publicRepo}`]), {
      message: /the tap repository path .* holds no git repository/,
      absent: [/does not exist/, /uncommitted tracked changes/],
    });
  } finally {
    cleanup(fixture);
  }
});

test('rung 3 refuses a tap repository with a modified tracked file', () => {
  const fixture = makeFixture({ dirtyTap: true });
  try {
    assertRefusal(fixture, runBump(fixture, [`--tap-repo=${fixture.tapRepo}`, `--public-repo=${fixture.publicRepo}`]), {
      message: /has uncommitted tracked changes/,
      absent: [/holds no git repository/, /does not exist/, /artefacts are/],
    });
  } finally {
    cleanup(fixture);
  }
});

test('rung 4 refuses a public repository path that does not exist', () => {
  const fixture = makeFixture({ hasPublic: false });
  try {
    assertRefusal(fixture, runBump(fixture, [`--tap-repo=${fixture.tapRepo}`, `--public-repo=${fixture.publicRepo}`]), {
      message: /the public repository path .* does not exist/,
      absent: [/tap repository path/, /uncommitted tracked changes/, /no GitHub repository could be resolved/],
    });
  } finally {
    cleanup(fixture);
  }
});

test('rung 4 refuses a public path that holds no git repository', () => {
  const fixture = makeFixture({ initPublicGit: false });
  try {
    assertRefusal(fixture, runBump(fixture, [`--tap-repo=${fixture.tapRepo}`, `--public-repo=${fixture.publicRepo}`]), {
      message: /the public repository path .* holds no git repository/,
      absent: [/does not exist/, /tap repository path/],
    });
  } finally {
    cleanup(fixture);
  }
});

test('rung 4 is skipped entirely when --repo is supplied', () => {
  const fixture = makeFixture({ hasPublic: false });
  try {
    assert.equal(fs.existsSync(fixture.publicRepo), false, 'the fixture must have no public repository at all');
    const res = runBump(fixture, [`--tap-repo=${fixture.tapRepo}`, '--repo=someone/elsewhere']);
    assert.equal(res.status, 0, `--repo must skip rung 4, got ${res.status}: ${res.stderr}`);
    assert.doesNotMatch(res.stderr, /public repository path/, '--repo must make the public repository irrelevant');
    assert.equal(fs.existsSync(formulaPath(fixture)), true, 'the run must have written the formula');
  } finally {
    cleanup(fixture);
  }
});

test('rung 5 refuses when no slug resolves, naming git remote add origin', () => {
  const fixture = makeFixture({ hasOrigin: false });
  try {
    const res = runBump(fixture, [`--tap-repo=${fixture.tapRepo}`, `--public-repo=${fixture.publicRepo}`]);
    assertRefusal(fixture, res, {
      message: /no GitHub repository could be resolved/,
      absent: [/public repository path/, /uncommitted tracked changes/, /artefacts are/],
    });
    assert.match(res.stderr, /remote add origin/, 'the refusal must name the fix');
    assert.match(res.stderr, /--repo=<owner>\/<name>/, 'the refusal must name the flag alternative');
  } finally {
    cleanup(fixture);
  }
});

test('rung 6 refuses when one artefact is missing', () => {
  const fixture = makeFixture({ artefacts: artefactNamesFor('0.1.0').slice(0, 2) });
  try {
    assertRefusal(fixture, runBump(fixture, [`--tap-repo=${fixture.tapRepo}`, `--public-repo=${fixture.publicRepo}`]), {
      message: /these artefacts are missing from .*flowcharge-0\.1\.0-linux-x64/s,
      absent: [/artefacts are empty/, /no GitHub repository could be resolved/],
    });
  } finally {
    cleanup(fixture);
  }
});

test('rung 6 refuses when one artefact is present but zero bytes', () => {
  const names = artefactNamesFor('0.1.0');
  const fixture = makeFixture({ artefacts: [names[0], names[1], [names[2], '']] });
  try {
    assertRefusal(fixture, runBump(fixture, [`--tap-repo=${fixture.tapRepo}`, `--public-repo=${fixture.publicRepo}`]), {
      message: /these artefacts are empty: flowcharge-0\.1\.0-linux-x64/,
      absent: [/artefacts are missing from/, /no GitHub repository could be resolved/],
    });
  } finally {
    cleanup(fixture);
  }
});

// --- The success path -------------------------------------------------------
//
// The digests are recomputed here from the fixture's own release/cli/ bytes, so
// the assertion is independent of what bump-formula.mjs itself read. Copying a
// digest out of the script's stdout, or back out of the file it wrote, would
// assert nothing about correctness.

function expectedDigests(fixture) {
  const digests = {};
  for (const label of PLATFORM_LABELS) {
    const file = path.join(fixture.source, 'release', 'cli', `flowcharge-${fixture.version}-${label}`);
    digests[label] = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  }
  return digests;
}

// The three platform blocks, sliced apart by the fixed markers the formula
// contract fixes. A digest merely present somewhere in the file is not enough:
// a transposed pair would satisfy that, so each digest is checked inside its
// own block and against the other two blocks as well.
function platformBlocks(text) {
  const macos = text.indexOf('on_macos do');
  const arm = text.indexOf('on_arm do', macos);
  const macIntel = text.indexOf('on_intel do', arm);
  const linux = text.indexOf('on_linux do');
  const linuxIntel = text.indexOf('on_intel do', linux);
  assert.ok(macos !== -1 && arm !== -1 && macIntel !== -1, 'the formula must carry on_macos/on_arm/on_intel');
  assert.ok(linux !== -1 && linuxIntel !== -1, 'the formula must carry on_linux/on_intel');
  assert.ok(macIntel < linux, 'the macOS intel block must close before on_linux opens');
  return {
    'darwin-arm64': text.slice(arm, macIntel),
    'darwin-x64': text.slice(macIntel, linux),
    'linux-x64': text.slice(linuxIntel),
  };
}

// The complete formula the generator must produce, written out here rather than
// obtained from the script's own template function — an expectation built by
// calling the code under test asserts nothing.
function expectedFormula(slug, version, digests) {
  return `class Flowcharge < Formula
  desc "Local Kanban board for FlowCharge project-management workstreams"
  homepage "https://github.com/${slug}"
  license :cannot_represent

  on_macos do
    on_arm do
      url "https://github.com/${slug}/releases/download/v${version}/flowcharge-${version}-darwin-arm64"
      sha256 "${digests['darwin-arm64']}"
    end
    on_intel do
      url "https://github.com/${slug}/releases/download/v${version}/flowcharge-${version}-darwin-x64"
      sha256 "${digests['darwin-x64']}"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/${slug}/releases/download/v${version}/flowcharge-${version}-linux-x64"
      sha256 "${digests['linux-x64']}"
    end
  end

  def install
    bin.install Dir["flowcharge-*"].first => "flowcharge"
  end

  test do
    assert_predicate bin/"flowcharge", :executable?
  end
end
`;
}

test('a good run writes the formula with each digest under its own platform block', () => {
  const fixture = makeFixture();
  try {
    const res = runBump(fixture, [`--tap-repo=${fixture.tapRepo}`, `--public-repo=${fixture.publicRepo}`]);
    assert.equal(res.status, 0, `a good run must exit 0, got ${res.status}: ${res.stderr}`);
    assert.equal(fs.existsSync(formulaPath(fixture)), true, 'the formula must have been written');

    const digests = expectedDigests(fixture);
    assert.equal(new Set(Object.values(digests)).size, 3, 'the three fixture binaries must hash differently');

    const text = fs.readFileSync(formulaPath(fixture), 'utf8');
    const blocks = platformBlocks(text);
    for (const label of PLATFORM_LABELS) {
      assert.match(blocks[label], new RegExp(`sha256 "${digests[label]}"`), `the ${label} digest must sit in the ${label} block`);
      assert.match(blocks[label], new RegExp(`flowcharge-${fixture.version}-${label}"`), `the ${label} url must sit in the ${label} block`);
      for (const other of PLATFORM_LABELS) {
        if (other === label) continue;
        assert.doesNotMatch(blocks[label], new RegExp(digests[other]), `the ${other} digest must not appear in the ${label} block`);
      }
    }
  } finally {
    cleanup(fixture);
  }
});

test('the whole generated formula text equals the contract, with no version stanza and no unsupported url', () => {
  const fixture = makeFixture();
  try {
    const res = runBump(fixture, [`--tap-repo=${fixture.tapRepo}`, `--public-repo=${fixture.publicRepo}`]);
    assert.equal(res.status, 0, `a good run must exit 0, got ${res.status}: ${res.stderr}`);

    const text = fs.readFileSync(formulaPath(fixture), 'utf8');
    assert.equal(text, expectedFormula(ORIGIN_SLUG, fixture.version, expectedDigests(fixture)));

    assert.doesNotMatch(text, /^\s*version\s+"/m, 'Homebrew scans the version from the release path; an explicit stanza is redundant');
    assert.doesNotMatch(text, /linux-arm64/, 'no Linux arm64 artefact is built, so no url may name one');
    // The leading hyphen is load-bearing: a bare /win-x64/ also matches the
    // legitimate `darwin-x64`, so it would fail a correct formula.
    assert.doesNotMatch(text, /-win-x64/, 'Homebrew does not run natively on Windows, so no url may name it');
  } finally {
    cleanup(fixture);
  }
});

test('--dry-run prints the formula text on stdout and writes no file', () => {
  const fixture = makeFixture();
  try {
    const res = runBump(fixture, [`--tap-repo=${fixture.tapRepo}`, `--public-repo=${fixture.publicRepo}`, '--dry-run']);
    assert.equal(res.status, 0, `--dry-run must exit 0, got ${res.status}: ${res.stderr}`);

    const digests = expectedDigests(fixture);
    assert.equal(res.stdout, expectedFormula(ORIGIN_SLUG, fixture.version, digests), 'the printed text must be the whole formula');
    for (const label of PLATFORM_LABELS) {
      assert.match(res.stdout, new RegExp(digests[label]), `the printed text must carry the ${label} digest`);
    }

    assert.equal(fs.existsSync(formulaPath(fixture)), false, '--dry-run must write no file');
    assert.equal(fs.existsSync(path.join(fixture.tapRepo, 'Formula')), false, '--dry-run must create no Formula directory');
  } finally {
    cleanup(fixture);
  }
});

test('a good run adds no commit to the tap repository', () => {
  const fixture = makeFixture();
  try {
    const before = git(fixture.tapRepo, ['rev-list', '--count', 'HEAD']).trim();
    const res = runBump(fixture, [`--tap-repo=${fixture.tapRepo}`, `--public-repo=${fixture.publicRepo}`]);
    assert.equal(res.status, 0, `a good run must exit 0, got ${res.status}: ${res.stderr}`);

    const after = git(fixture.tapRepo, ['rev-list', '--count', 'HEAD']).trim();
    assert.equal(after, before, 'the generator must write but never commit');

    // --untracked-files=all names the file itself; the default collapses a new
    // directory to `?? Formula/` and would hide which file was written.
    const status = git(fixture.tapRepo, ['status', '--porcelain', '--untracked-files=all']);
    assert.match(status, /Formula\/flowcharge\.rb/, 'the written formula must show as an uncommitted path');
    assert.match(res.stdout, /git -C .* commit/, 'the run must print the commit command rather than running it');
    assert.match(res.stdout, /git -C .* push origin main/, 'the run must print the push command rather than running it');
  } finally {
    cleanup(fixture);
  }
});

test('--repo overrides the origin-derived slug in the homepage and all three urls', () => {
  const fixture = makeFixture();
  try {
    const slug = 'someone-else/another-name';
    const res = runBump(fixture, [`--tap-repo=${fixture.tapRepo}`, `--public-repo=${fixture.publicRepo}`, `--repo=${slug}`]);
    assert.equal(res.status, 0, `a good run must exit 0, got ${res.status}: ${res.stderr}`);

    const text = fs.readFileSync(formulaPath(fixture), 'utf8');
    assert.equal(text, expectedFormula(slug, fixture.version, expectedDigests(fixture)));
    assert.match(text, new RegExp(`homepage "https://github.com/${slug}"`), 'the homepage must carry the override slug');
    assert.equal(text.split(`https://github.com/${slug}/releases/download/`).length - 1, 3, 'all three urls must carry the override slug');
    assert.equal(text.includes(ORIGIN_SLUG), false, 'the origin-derived slug must not appear');
  } finally {
    cleanup(fixture);
  }
});
