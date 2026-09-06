#!/usr/bin/env node
// The formula bump command. It regenerates `Formula/flowcharge.rb` in the
// homebrew-flowcharge tap working copy from the three Homebrew-relevant
// binaries `release.mjs` built, so macOS and Linux users can install FlowCharge
// with `brew install <owner>/flowcharge/flowcharge`.
//
// It is not an outward-facing command. It writes one file into a working copy
// and then prints the `git add`/`commit` and `git push` lines the maintainer
// runs next; it never commits and never pushes, matching the way
// `release.mjs:270-273` hands its outward-facing steps back rather than
// performing them.
//
// It computes no version. The version is this repository's package.json
// `version` field — the same field `release.mjs` and `publish-release.mjs` read
// — and there is no version argument, so the commands cannot disagree about
// which release is being handled.
//
// Module boundary: this file knows the Homebrew formula's text, the three
// Homebrew-relevant platform labels, the artefact filename prefix,
// package.json's version field, both repository roots, and how to read an
// origin remote URL. It does NOT know the CHANGELOG.md heading regex — that
// lives in release-format.mjs alone; it does not know the gh CLI, which is
// publish-release.mjs's contract; it does not know the Bun build or any Bun
// target string, which stay solely in tools/package-cli.mjs; and it knows
// neither the tag shape nor the release's artefact count, which belong to
// release.mjs and publish-release.mjs, not to this command. This file names the
// three platforms it serves outright and reads no total, so the count those two
// files enforce can change without touching anything here. It happens to be
// three as well now that the default build ships macOS and Linux only, with
// Windows deferred — but that is a coincidence, not a coupling. Even were a
// Windows binary built, it would not appear below, because Homebrew does not
// run natively there.
//
// It holds no repository slug. The slug is read from the public repository's
// origin remote, so moving the repository from a personal account to an
// organisation is a remote change with no code change here.
//
// The HELP constant below is this file's usage documentation and the text
// --help prints, so the interface is recorded in one place, not two.

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

import { isBareVersion } from './release-format.mjs';

const HELP = `bump-formula.mjs — regenerates the Homebrew tap's Formula/flowcharge.rb from the built binaries.

Usage:
  node .github/scripts/bump-formula.mjs [--tap-repo=<path>] [--public-repo=<path>] [--repo=<owner>/<name>] [--dry-run]
  node .github/scripts/bump-formula.mjs --help

Run \`node .github/scripts/release.mjs\` first, then publish the release. This
command hashes the binaries that build produced and rewrites the tap's formula;
it builds nothing, tags nothing and publishes nothing.

There is no version argument. The version is read from this repository's
package.json "version" field, the same field the release and publish commands
read.

The formula is regenerated whole from this file's own template. Every value in
it is derived, so a hand edit in the tap does not survive the next bump.

Options:
  --tap-repo=<path>      The homebrew-flowcharge working copy the formula is
                         written into. Defaults to ../homebrew-flowcharge,
                         resolved from this repository's own root.
  --public-repo=<path>   The flowcharge-public working copy whose origin remote
                         supplies the slug. Defaults to ../flowcharge-public.
                         Not read at all when --repo is given.
  --repo=<owner>/<name>  The release repository the urls point at. Overrides the
                         slug derived from the public repository's origin.
  --dry-run              Print the formula text on stdout and exit 0 without
                         writing any file.
  --help                 Print this text on stdout and exit 0, before any
                         option parsing that could fail, before any file read
                         and before any git call.

Before it writes the formula it refuses, in this order, when:
  1. package.json is unreadable, or its version field is not a bare X.Y.Z;
  2. the tap repository path does not exist, or holds no git repository;
  3. the tap repository's tracked working tree is dirty;
  4. the public repository path does not exist or holds no git repository —
     skipped entirely when --repo was given, because nothing in that
     repository is then needed;
  5. no repository slug can be resolved from --repo or from origin;
  6. any of the three release/cli/flowcharge-<version>-<label> artefacts is
     missing or zero bytes.

Exit codes:
  0  The formula was written, or --dry-run printed it.
  1  A refusal. No file was written.
`;

// This script's own directory, and the source repository root two directories
// above it, both derived from its own file location. Never from process.cwd():
// the command must behave the same run from a subdirectory as run from the
// root, and a copy placed inside a fixture repository must act on that fixture
// and on nothing else.
const SELF_DIR = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname));
const SELF_ROOT = path.resolve(SELF_DIR, '..', '..');

// The three platform labels Homebrew can serve, and the whole of what this file
// knows about the build output. There is no Linux arm64 entry because
// tools/package-cli.mjs builds no such artefact, and no Windows entry because
// Homebrew does not run natively there.
const PLATFORM_LABELS = ['darwin-arm64', 'darwin-x64', 'linux-x64'];
const RELEASE_CLI_DIR = path.join(SELF_ROOT, 'release', 'cli');

function fail(message) {
  console.error(`bump-formula: ${message}`);
  process.exit(1);
}

// git against a named repository root. A non-zero exit is a hard failure unless
// the caller is asking a question whose answer is the exit code itself.
function git(cwd, args, { allowFailure = false } = {}) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (res.error) fail(`could not run git ${args.join(' ')}: ${res.error.message}`);
  if (!allowFailure && res.status !== 0) {
    fail(`git ${args.join(' ')} failed in ${cwd}:\n${(res.stderr || '').trimEnd()}`);
  }
  return { status: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

// <owner>/<name> from a remote URL, or null when the URL carries no such pair.
// Both forms git writes are accepted — the SSH `git@host:owner/name.git` form
// and the `scheme://host/owner/name.git` form — and a trailing `.git` and
// trailing slashes are stripped. The last two segments are what is taken, so no
// host name and no slug is ever written into this file.
//
// Copied byte-for-byte from publish-release.mjs:121-141. It is duplicated
// rather than shared because that file's contracts are frozen — exporting the
// helper would change it — and a fourth shared module would still leave two
// copies in the tree.
function slugFromRemoteUrl(url) {
  if (typeof url !== 'string') return null;
  let rest = url.trim();
  if (rest === '') return null;

  const scheme = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.exec(rest);
  if (scheme !== null) {
    rest = rest.slice(scheme[0].length);
    const slash = rest.indexOf('/');
    if (slash === -1) return null;
    rest = rest.slice(slash + 1);
  } else {
    const sshHost = /^[^/]*@[^/:]+:/.exec(rest);
    if (sshHost !== null) rest = rest.slice(sshHost[0].length);
  }

  rest = rest.replace(/\.git$/, '').replace(/\/+$/, '');
  const segments = rest.split('/').filter((segment) => segment !== '');
  if (segments.length < 2) return null;
  return segments.slice(-2).join('/');
}

// The lowercase 64-character hex digest of a file's bytes. There is no existing
// hashing helper in this repository, so node:crypto is used directly.
function sha256OfFile(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

// The whole formula, regenerated from one template this file owns. Nothing is
// patched into an existing file and no anchored regular expression is used:
// three near-identical sha256 lines are exactly where a surgical replacement
// silently updates two of three.
//
// No `version` stanza is emitted — Homebrew scans the version from the
// github.com release path and `brew audit` reports an explicit version line as
// redundant.
function formulaText({ slug, version, digests }) {
  const urlFor = (label) =>
    `https://github.com/${slug}/releases/download/v${version}/flowcharge-${version}-${label}`;
  return `class Flowcharge < Formula
  desc "Local Kanban board for FlowCharge project-management workstreams"
  homepage "https://github.com/${slug}"
  license :cannot_represent

  on_macos do
    on_arm do
      url "${urlFor('darwin-arm64')}"
      sha256 "${digests['darwin-arm64']}"
    end
    on_intel do
      url "${urlFor('darwin-x64')}"
      sha256 "${digests['darwin-x64']}"
    end
  end

  on_linux do
    on_intel do
      url "${urlFor('linux-x64')}"
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

function main() {
  const argv = process.argv.slice(2);

  // Step 0. --help takes precedence over everything else, so it always answers
  // — before any option parsing that could fail, before any file read, and
  // before any git call.
  if (argv.includes('--help')) {
    process.stdout.write(HELP);
    process.exit(0);
  }

  // Step 0b. The argument vector. There is no positional argument.
  let tapRepo = path.resolve(SELF_ROOT, '..', 'homebrew-flowcharge');
  let publicRepo = path.resolve(SELF_ROOT, '..', 'flowcharge-public');
  let slug = null;
  let dryRun = false;
  for (const arg of argv) {
    if (arg.startsWith('--tap-repo=')) {
      tapRepo = path.resolve(arg.slice('--tap-repo='.length));
      continue;
    }
    if (arg.startsWith('--public-repo=')) {
      publicRepo = path.resolve(arg.slice('--public-repo='.length));
      continue;
    }
    if (arg.startsWith('--repo=')) {
      slug = arg.slice('--repo='.length);
      continue;
    }
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    fail(`unexpected argument ${JSON.stringify(arg)} — this command takes no version and no other option; run --help`);
  }

  // Rung 1. The version, read from this repository's package.json.
  const packageJsonPath = path.join(SELF_ROOT, 'package.json');
  let packageJson;
  try {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  } catch (error) {
    fail(`could not read the version from ${packageJsonPath}: ${error.message}`);
  }
  const version = packageJson.version;
  if (!isBareVersion(version)) {
    fail(`package.json's version field is ${JSON.stringify(version === undefined ? '' : version)}, which is not a bare X.Y.Z — expected three groups of digits, e.g. 0.2.0`);
  }

  // Rungs 2 and 3 come before the slug and the artefacts on purpose: a run that
  // cannot write anywhere must refuse before it reads a remote or hashes a
  // byte.

  // Rung 2. The tap repository path.
  if (!fs.existsSync(tapRepo)) {
    fail(`the tap repository path ${tapRepo} does not exist — pass --tap-repo=<path> to point at the homebrew-flowcharge working copy`);
  }
  const isRepo = spawnSync('git', ['rev-parse', '--git-dir'], { cwd: tapRepo, encoding: 'utf8' });
  if (isRepo.error || isRepo.status !== 0) {
    fail(`the tap repository path ${tapRepo} holds no git repository — pass --tap-repo=<path> to point at the homebrew-flowcharge working copy`);
  }

  // Rung 3. The tap's tracked working tree. Untracked files are ignored: a
  // formula written for the first time is untracked and must not block itself.
  const dirty = git(tapRepo, ['status', '--porcelain', '--untracked-files=no']);
  if (dirty.stdout.trim() !== '') {
    fail(`the tap repository ${tapRepo} has uncommitted tracked changes — commit or stash them with \`git -C ${tapRepo} status\` first`);
  }

  // Rung 4. The public repository path, whose origin supplies the slug. Skipped
  // entirely when --repo was given: nothing in that repository is then needed,
  // and demanding it would refuse a run that has an explicit slug already.
  if (slug === null) {
    if (!fs.existsSync(publicRepo)) {
      fail(`the public repository path ${publicRepo} does not exist — pass --public-repo=<path>, or pass --repo=<owner>/<name> to skip it`);
    }
    const isPublicRepo = spawnSync('git', ['rev-parse', '--git-dir'], { cwd: publicRepo, encoding: 'utf8' });
    if (isPublicRepo.error || isPublicRepo.status !== 0) {
      fail(`the public repository path ${publicRepo} holds no git repository — pass --public-repo=<path>, or pass --repo=<owner>/<name> to skip it`);
    }

    // Rung 5. The repository slug, from the public repository's own origin
    // remote — the single source of truth when --repo is absent.
    const originUrl = git(publicRepo, ['remote', 'get-url', 'origin'], { allowFailure: true });
    const derived = originUrl.status === 0 ? slugFromRemoteUrl(originUrl.stdout) : null;
    if (derived === null) {
      fail(`no GitHub repository could be resolved for ${publicRepo} — give it an origin with \`git -C ${publicRepo} remote add origin <url>\`, or pass --repo=<owner>/<name>`);
    }
    slug = derived;
  }

  // Rung 6. The three artefacts Homebrew serves. The prefix is
  // version-qualified, so a release/cli/ left holding an older release's
  // binaries cannot satisfy this check.
  const files = PLATFORM_LABELS.map((label) => ({
    label,
    file: path.join(RELEASE_CLI_DIR, `flowcharge-${version}-${label}`),
  }));
  const missing = files.filter(({ file }) => !fs.existsSync(file) || !fs.statSync(file).isFile());
  if (missing.length > 0) {
    fail(`these artefacts are missing from ${RELEASE_CLI_DIR}: ${missing.map(({ file }) => path.basename(file)).join(', ')} — run \`node .github/scripts/release.mjs\` first`);
  }
  const empty = files.filter(({ file }) => fs.statSync(file).size === 0);
  if (empty.length > 0) {
    fail(`these artefacts are empty: ${empty.map(({ file }) => path.basename(file)).join(', ')} — rebuild them with \`node .github/scripts/release.mjs\``);
  }

  // Step 7. The digests, one per platform, each over that platform's own bytes.
  const digests = {};
  for (const { label, file } of files) digests[label] = sha256OfFile(file);

  const text = formulaText({ slug, version, digests });

  // Step 8. Either print the formula, or write it into the tap working copy.
  if (dryRun) {
    process.stdout.write(text);
    process.exit(0);
  }

  const formulaDir = path.join(tapRepo, 'Formula');
  const formulaPath = path.join(formulaDir, 'flowcharge.rb');
  fs.mkdirSync(formulaDir, { recursive: true });
  fs.writeFileSync(formulaPath, text);

  // Step 9. Report, and hand the outward-facing steps back to the maintainer.
  // Nothing is committed and nothing is pushed here.
  console.log(`bump-formula: wrote ${formulaPath}`);
  console.log('');
  console.log(`  version ${version}`);
  console.log(`  repo    ${slug}`);
  for (const { label } of files) console.log(`  sha256  ${label}  ${digests[label]}`);
  console.log('');
  console.log('Nothing has been committed and nothing has been pushed. Run these two commands yourself when you are ready:');
  console.log(`  git -C ${tapRepo} add Formula/flowcharge.rb && git -C ${tapRepo} commit -m ${JSON.stringify(`flowcharge ${version}`)}`);
  console.log(`  git -C ${tapRepo} push origin main`);
  process.exit(0);
}

main();
