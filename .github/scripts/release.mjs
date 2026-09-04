#!/usr/bin/env node
// The local release command. It refuses a bad state across both repositories,
// triggers the Bun binary build, confirms the four artefacts landed, and
// creates the annotated tag vX.Y.Z in the separate flowcharge-public
// repository. It never pushes: pushing is outward-facing and stays a
// deliberate human act.
//
// It computes no version. The version is this repository's package.json
// `version` field, and there is no version argument, so the two commands of
// this release process cannot disagree about which release is being cut.
//
// Module boundary: this file knows git, both repository roots, package.json's
// version field, the `npm run package:cli` contract, the artefact filename
// prefix and the artefact count, and the tag shape. It does NOT know the
// CHANGELOG.md heading regex — that lives in release-format.mjs alone — and it
// does not know the gh CLI, the GitHub repository slug, or any Bun target
// string, which stays solely in tools/package-cli.mjs.
//
// The HELP constant below is this file's usage documentation and the text
// --help prints, so the interface is recorded in one place, not two.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { isBareVersion, newestVersion } from './release-format.mjs';

const HELP = `release.mjs — cuts the local FlowCharge Board release: the binaries and the annotated tag.

Usage:
  node .github/scripts/release.mjs [--public-repo=<path>]
  node .github/scripts/release.mjs --help

There is no version argument. The version is read from this repository's
package.json "version" field, which is the same field the publish command
reads, so the two cannot disagree.

Edit the public repository's CHANGELOG.md first. This command reads the
newest "## X.Y.Z" heading there and refuses to run when it disagrees with
the package.json version.

Options:
  --public-repo=<path>  The flowcharge-public working copy that receives the
                        tag. Defaults to ../flowcharge-public, resolved from
                        this repository's own root.
  --help                Print this text on stdout and exit 0, before any
                        option parsing that could fail, before any file read
                        and before any git call.

Before it builds anything it refuses, in this order, when:
   1. package.json is unreadable, or its version field is not a bare X.Y.Z;
   2. this repository's current branch is not main;
   3. this repository's tracked working tree is dirty (untracked ignored);
   4. the public repository path does not exist or holds no git repository;
   5. the public repository's current branch is not main;
   6. the public repository's tracked working tree is dirty;
   7. the public CHANGELOG.md is missing, holds no "## X.Y.Z" heading, or its
      newest such heading is not the package.json version;
   8. the tag vX.Y.Z already exists in the public repository;
   9. bun is not usable on PATH;
  10. gh is not usable on PATH — needed by the publish step, checked here so
      the tag is never cut with no way to publish it.

It then runs \`npm run package:cli\`, confirms exactly four non-empty
release/cli/flowcharge-<version>-* artefacts, and creates the annotated tag
vX.Y.Z in the public repository. The tag is the last write, so a failure
anywhere earlier leaves no tag behind.

It never pushes. It prints the two push commands and the publish command to
run next.

Exit codes:
  0  The four binaries exist and the public repository carries the annotated
     tag vX.Y.Z. Nothing has been pushed.
  1  A refusal, or a build failure. No tag was created.
`;

// This script's own directory, and the source repository root two directories
// above it, both derived from its own file location. Never from process.cwd():
// the command must behave the same run from a subdirectory as run from the
// root, and a copy placed inside a fixture repository must act on that fixture
// and on nothing else.
const SELF_DIR = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname));
const SELF_ROOT = path.resolve(SELF_DIR, '..', '..');

// The only branch a release is cut from, in either repository. Hard-coded on
// purpose: there is no flag, because a release from anywhere else is a mistake,
// not an option.
const RELEASE_BRANCH = 'main';

// The artefact contract, and the whole of what this file knows about the build
// output: four files, each named with the version-qualified prefix below. The
// platform labels and the Bun target strings are not knowledge this file holds.
const ARTEFACT_COUNT = 4;
const RELEASE_CLI_DIR = path.join(SELF_ROOT, 'release', 'cli');

function fail(message) {
  console.error(`release: ${message}`);
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

function main() {
  const argv = process.argv.slice(2);

  // Step 0. --help takes precedence over everything else, so it always answers
  // — before any option parsing that could fail, before any file read, and
  // before any git call.
  if (argv.includes('--help')) {
    process.stdout.write(HELP);
    process.exit(0);
  }

  // Step 0b. The argument vector. There is no positional argument, and
  // --public-repo is the only option besides --help.
  let publicRepo = path.resolve(SELF_ROOT, '..', 'flowcharge-public');
  for (const arg of argv) {
    if (arg.startsWith('--public-repo=')) {
      publicRepo = path.resolve(arg.slice('--public-repo='.length));
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

  // Rung 2. This repository's branch.
  const sourceBranch = git(SELF_ROOT, ['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim();
  if (sourceBranch !== RELEASE_BRANCH) {
    fail(`this repository's current branch is ${JSON.stringify(sourceBranch)}, not ${RELEASE_BRANCH} — a release is cut from ${RELEASE_BRANCH} only`);
  }

  // Rung 3. This repository's tracked working tree. Untracked files are ignored
  // on purpose: a maintainer's scratch file is not a reason to refuse, and
  // nothing untracked reaches the release.
  const sourceDirty = git(SELF_ROOT, ['status', '--porcelain', '--untracked-files=no']).stdout;
  if (sourceDirty.trim() !== '') {
    fail(`this repository's tracked working tree is dirty — commit or stash it first:\n${sourceDirty.trimEnd()}`);
  }

  // Rung 4. The public repository path.
  if (!fs.existsSync(publicRepo)) {
    fail(`the public repository path ${publicRepo} does not exist — pass --public-repo=<path> to point at the flowcharge-public working copy`);
  }
  const isRepo = spawnSync('git', ['rev-parse', '--git-dir'], { cwd: publicRepo, encoding: 'utf8' });
  if (isRepo.error || isRepo.status !== 0) {
    fail(`the public repository path ${publicRepo} holds no git repository — pass --public-repo=<path> to point at the flowcharge-public working copy`);
  }

  // Rung 5. The public repository's branch.
  const publicBranch = git(publicRepo, ['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim();
  if (publicBranch !== RELEASE_BRANCH) {
    fail(`the public repository's current branch is ${JSON.stringify(publicBranch)}, not ${RELEASE_BRANCH} — the tag is cut on ${RELEASE_BRANCH} only`);
  }

  // Rung 6. The public repository's tracked working tree.
  const publicDirty = git(publicRepo, ['status', '--porcelain', '--untracked-files=no']).stdout;
  if (publicDirty.trim() !== '') {
    fail(`the public repository's tracked working tree is dirty — commit or stash it first:\n${publicDirty.trimEnd()}`);
  }

  // Rung 7. The public changelog, in its three distinct failure modes. The
  // heading shape itself is not read here: newestVersion owns it.
  const changelogPath = path.join(publicRepo, 'CHANGELOG.md');
  if (!fs.existsSync(changelogPath)) {
    fail(`no CHANGELOG.md at ${publicRepo} — write the ${version} entry there first`);
  }
  const changelogVersion = newestVersion(fs.readFileSync(changelogPath, 'utf8'));
  if (changelogVersion === null) {
    fail(`${changelogPath} holds no "## X.Y.Z" release heading — write the ${version} entry first, unbracketed`);
  }
  if (changelogVersion !== version) {
    fail(`${changelogPath}'s newest release heading is ${changelogVersion}, not ${version} — the changelog and package.json must agree`);
  }

  // Rung 8. The tag. Checked before the build, not after it: a re-run of a
  // finished release must cost seconds, not a multi-minute compile.
  const existingTag = git(publicRepo, ['rev-parse', '-q', '--verify', `refs/tags/${tag}`], { allowFailure: true });
  if (existingTag.status === 0) {
    fail(`the tag ${tag} already exists in ${publicRepo} — that release is cut; nothing was built and no tag was created`);
  }

  // Rung 9. bun, which the build needs.
  if (!toolIsUsable('bun')) {
    fail('bun is not usable on PATH — install Bun from https://bun.sh and make sure `bun --version` works, then run this again');
  }

  // Rung 10. gh, which this command never calls but the publish step does.
  // Checked here so the maintainer is never left holding a tag with no way to
  // publish it.
  if (!toolIsUsable('gh')) {
    fail('gh is not usable on PATH — the publish step needs it, so it is checked before the tag is cut; install the GitHub CLI, then run this again');
  }

  // Step 11. The build. Every rung has passed, so this is the first slow step
  // and the first step that writes anything.
  console.log(`release: building the ${version} binaries with \`npm run package:cli\`...`);
  const build = spawnSync('npm', ['run', 'package:cli'], { cwd: SELF_ROOT, stdio: 'inherit' });
  if (build.error) {
    fail(`could not run \`npm run package:cli\`: ${build.error.message} — nothing was tagged`);
  }
  if (build.status !== 0) {
    fail(`\`npm run package:cli\` exited ${build.status} — nothing was tagged`);
  }

  // Step 12. The artefacts. The prefix is version-qualified, so a release/cli/
  // left holding an older release's binaries cannot satisfy this check.
  const prefix = `flowcharge-${version}-`;
  let entries;
  try {
    entries = fs.readdirSync(RELEASE_CLI_DIR, { withFileTypes: true });
  } catch (error) {
    fail(`could not read ${RELEASE_CLI_DIR} after the build: ${error.message} — nothing was tagged`);
  }
  const artefacts = entries
    .filter((entry) => entry.isFile() && entry.name.startsWith(prefix))
    .map((entry) => path.join(RELEASE_CLI_DIR, entry.name))
    .sort();
  if (artefacts.length !== ARTEFACT_COUNT) {
    fail(`expected ${ARTEFACT_COUNT} ${prefix}* artefacts in ${RELEASE_CLI_DIR}, found ${artefacts.length} — nothing was tagged`);
  }
  const empty = artefacts.filter((file) => fs.statSync(file).size === 0);
  if (empty.length > 0) {
    fail(`these artefacts are empty: ${empty.map((file) => path.basename(file)).join(', ')} — nothing was tagged`);
  }

  // Step 13. The annotated tag, in the public repository only. This repository
  // is not tagged; its HEAD is recorded in the tag message instead, so the
  // published binaries can always be traced back to the source they were built
  // from. This is the last write, which is what keeps the run all-or-nothing.
  const sourceSha = git(SELF_ROOT, ['rev-parse', '--short', 'HEAD']).stdout.trim();
  git(publicRepo, ['tag', '-a', tag, '-m', `FlowCharge ${tag} (Praxis-Dashboard ${sourceSha})`]);

  // Step 14. Report, and hand the outward-facing steps back to the maintainer.
  console.log('');
  console.log(`  tag     ${tag}  (annotated, "FlowCharge ${tag} (Praxis-Dashboard ${sourceSha})")`);
  console.log(`  repo    ${publicRepo}`);
  console.log('  files');
  for (const file of artefacts) console.log(`          ${file}`);
  console.log('');
  console.log('Nothing has been pushed. Run these three commands yourself when you are ready:');
  console.log(`  git -C ${publicRepo} push origin ${RELEASE_BRANCH}`);
  console.log(`  git -C ${publicRepo} push origin ${tag}`);
  console.log('  node .github/scripts/publish-release.mjs');
  process.exit(0);
}

main();
