#!/usr/bin/env node
// The publish command. It attaches the four Bun binaries that `release.mjs`
// built to a GitHub Release for the tag `release.mjs` created, with the notes
// taken from the public repository's own CHANGELOG.md section.
//
// This is the one outward-facing command of the release process, so every
// refusal runs before the single `gh` call, and `--dry-run` prints the exact
// argument vector instead of making that call.
//
// It computes no version. The version is this repository's package.json
// `version` field — the same field `release.mjs` reads — and there is no
// version argument, so the two commands cannot disagree about which release is
// being published.
//
// Module boundary: this file knows the gh CLI's contract, both repository
// roots, package.json's version field, the artefact filename prefix and count,
// and how to read an origin remote URL. It does NOT know the CHANGELOG.md
// heading regex — that lives in release-format.mjs alone — and it does not know
// the Bun build, any Bun target string, or how the binaries are compiled. That
// knowledge stays solely in tools/package-cli.mjs.
//
// It holds no repository slug. The slug is read from the public repository's
// origin remote, so moving the repository from a personal account to an
// organisation is a remote change with no code change here.
//
// The HELP constant below is this file's usage documentation and the text
// --help prints, so the interface is recorded in one place, not two.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { isBareVersion, sectionBody } from './release-format.mjs';

const HELP = `publish-release.mjs — attaches the built binaries to a GitHub Release for the cut tag.

Usage:
  node .github/scripts/publish-release.mjs [--public-repo=<path>] [--repo=<owner>/<name>] [--dry-run]
  node .github/scripts/publish-release.mjs --help

Run \`node .github/scripts/release.mjs\` first, then push the branch and the
tag. This command publishes what those steps produced; it builds nothing and
tags nothing.

There is no version argument. The version is read from this repository's
package.json "version" field, the same field the release command reads.

Options:
  --public-repo=<path>   The flowcharge-public working copy holding the tag and
                         the CHANGELOG.md. Defaults to ../flowcharge-public,
                         resolved from this repository's own root.
  --repo=<owner>/<name>  The GitHub repository to publish to. Defaults to the
                         slug read from the public repository's origin remote.
  --dry-run              Print the exact gh argument vector and exit 0 without
                         calling gh. Needs no gh on PATH.
  --help                 Print this text on stdout and exit 0, before any
                         option parsing that could fail, before any file read
                         and before any git call.

Before it calls gh it refuses, in this order, when:
  1. package.json is unreadable, or its version field is not a bare X.Y.Z;
  2. the public repository path does not exist or holds no git repository;
  3. no repository slug can be resolved from --repo or from origin;
  4. the tag vX.Y.Z is missing locally, or has not been pushed to origin;
  5. the public CHANGELOG.md names no section for this version, or that
     section holds no text;
  6. there are not exactly four non-empty release/cli/flowcharge-<version>-*
     artefacts in this repository;
  7. gh is not usable on PATH — not checked under --dry-run, which never calls
     it.

Exit codes:
  0  The release was created, or --dry-run printed the vector.
  1  A refusal. Nothing outward-facing happened.
     Otherwise gh's own exit status is propagated unchanged.
`;

// This script's own directory, and the source repository root two directories
// above it, both derived from its own file location. Never from process.cwd():
// the command must behave the same run from a subdirectory as run from the
// root, and a copy placed inside a fixture repository must act on that fixture
// and on nothing else.
const SELF_DIR = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname));
const SELF_ROOT = path.resolve(SELF_DIR, '..', '..');

// The artefact contract, and the whole of what this file knows about the build
// output: four files, each named with the version-qualified prefix below. The
// Windows binary carries a .exe suffix Bun appends, so the four names are not
// uniform — the prefix is matched, never an exact name list.
const ARTEFACT_COUNT = 4;
const RELEASE_CLI_DIR = path.join(SELF_ROOT, 'release', 'cli');

function fail(message) {
  console.error(`publish-release: ${message}`);
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

// A PATH tool, not a dependency. A spawn failure and a non-zero exit both mean
// the tool is not usable here — the same probe tools/package-cli.mjs uses.
function toolIsUsable(tool) {
  const probe = spawnSync(tool, ['--version'], { encoding: 'utf8' });
  return !probe.error && probe.status === 0;
}

// <owner>/<name> from a remote URL, or null when the URL carries no such pair.
// Both forms git writes are accepted — the SSH `git@host:owner/name.git` form
// and the `scheme://host/owner/name.git` form — and a trailing `.git` and
// trailing slashes are stripped. The last two segments are what is taken, so no
// host name and no slug is ever written into this file.
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
  let publicRepo = path.resolve(SELF_ROOT, '..', 'flowcharge-public');
  let slug = null;
  let dryRun = false;
  for (const arg of argv) {
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
  const tag = `v${version}`;

  // Rung 2. The public repository path.
  if (!fs.existsSync(publicRepo)) {
    fail(`the public repository path ${publicRepo} does not exist — pass --public-repo=<path> to point at the flowcharge-public working copy`);
  }
  const isRepo = spawnSync('git', ['rev-parse', '--git-dir'], { cwd: publicRepo, encoding: 'utf8' });
  if (isRepo.error || isRepo.status !== 0) {
    fail(`the public repository path ${publicRepo} holds no git repository — pass --public-repo=<path> to point at the flowcharge-public working copy`);
  }

  // Rung 3. The repository slug. --repo wins when it is given; otherwise the
  // public repository's own origin remote is the single source of truth.
  if (slug === null) {
    const originUrl = git(publicRepo, ['remote', 'get-url', 'origin'], { allowFailure: true });
    const derived = originUrl.status === 0 ? slugFromRemoteUrl(originUrl.stdout) : null;
    if (derived === null) {
      fail(`no GitHub repository could be resolved for ${publicRepo} — give it an origin with \`git -C ${publicRepo} remote add origin <url>\`, or pass --repo=<owner>/<name>`);
    }
    slug = derived;
  }

  // Rung 4. The tag, locally and on the remote. A release cannot be created for
  // a tag GitHub cannot see, so the pushed state is what is checked.
  const localTag = git(publicRepo, ['rev-parse', '-q', '--verify', `refs/tags/${tag}`], { allowFailure: true });
  if (localTag.status !== 0) {
    fail(`the tag ${tag} does not exist in ${publicRepo} — run \`node .github/scripts/release.mjs\` first`);
  }
  const remoteTags = git(publicRepo, ['ls-remote', '--tags', 'origin'], { allowFailure: true });
  if (remoteTags.status !== 0) {
    fail(`could not read the tags on origin from ${publicRepo}:\n${remoteTags.stderr.trimEnd()}`);
  }
  const onRemote = remoteTags.stdout
    .split('\n')
    .some((line) => line.trim().endsWith(`refs/tags/${tag}`));
  if (!onRemote) {
    fail(`the tag ${tag} has not been pushed — run \`git -C ${publicRepo} push origin ${tag}\` first`);
  }

  // Rung 5. The release notes, in their two distinct failure modes. The heading
  // shape itself is not read here: sectionBody owns it.
  const changelogPath = path.join(publicRepo, 'CHANGELOG.md');
  let changelogText;
  try {
    changelogText = fs.readFileSync(changelogPath, 'utf8');
  } catch (error) {
    fail(`could not read ${changelogPath}: ${error.message} — the release notes come from it`);
  }
  const notes = sectionBody(changelogText, version);
  if (notes === null) {
    fail(`${changelogPath} holds no section for ${version} — write the "## ${version}" entry there first`);
  }
  if (notes === '') {
    fail(`${changelogPath}'s "## ${version}" section holds no text — the release notes would be empty`);
  }

  // Rung 6. The artefacts. The prefix is version-qualified, so a release/cli/
  // left holding an older release's binaries cannot satisfy this check. The
  // sort is what makes the argument vector reproducible across runs.
  const prefix = `flowcharge-${version}-`;
  let entries;
  try {
    entries = fs.readdirSync(RELEASE_CLI_DIR, { withFileTypes: true });
  } catch (error) {
    fail(`could not read ${RELEASE_CLI_DIR}: ${error.message} — run \`node .github/scripts/release.mjs\` first`);
  }
  const artefacts = entries
    .filter((entry) => entry.isFile() && entry.name.startsWith(prefix))
    .map((entry) => entry.name)
    .sort()
    .map((name) => path.join(RELEASE_CLI_DIR, name));
  if (artefacts.length !== ARTEFACT_COUNT) {
    fail(`expected ${ARTEFACT_COUNT} ${prefix}* artefacts in ${RELEASE_CLI_DIR}, found ${artefacts.length} — run \`node .github/scripts/release.mjs\` first`);
  }
  const empty = artefacts.filter((file) => fs.statSync(file).size === 0);
  if (empty.length > 0) {
    fail(`these artefacts are empty: ${empty.map((file) => path.basename(file)).join(', ')} — rebuild them with \`node .github/scripts/release.mjs\``);
  }

  // Rung 7. gh, which the real call needs. Not checked under --dry-run: that
  // path never calls gh, so demanding the tool would refuse a run that does
  // nothing outward-facing at all.
  if (!dryRun && !toolIsUsable('gh')) {
    fail('gh is not usable on PATH — install the GitHub CLI, run `gh auth login`, then run this again');
  }

  // Step 8. The argument vector. The notes are one argument, not a temporary
  // file: no shell is involved, so backticks, quotes and newlines in the
  // changelog body need no escaping and nothing needs cleaning up afterwards.
  const args = [
    'release',
    'create',
    tag,
    '--repo',
    slug,
    '--title',
    `FlowCharge ${tag}`,
    '--notes',
    notes,
    ...artefacts,
  ];

  // Step 9. Either print the vector, or make the one outward-facing call.
  // Each element is printed on its own line and JSON-quoted, so a multi-line
  // notes body stays one element and the vector can be read back exactly.
  if (dryRun) {
    console.log('publish-release: --dry-run, gh would be called with:');
    for (const element of ['gh', ...args]) console.log(`  ${JSON.stringify(element)}`);
    process.exit(0);
  }

  const run = spawnSync('gh', args, { stdio: 'inherit' });
  if (run.error) {
    fail(`could not run gh: ${run.error.message} — nothing was published`);
  }
  process.exit(run.status === null ? 1 : run.status);
}

main();
