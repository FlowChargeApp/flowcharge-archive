// Unit tests for update-check.ts's pure comparison logic and its
// unconfigured-repository guard. Every case here is offline: the suite stubs
// nothing and reaches nothing. fetchLatestRelease's network branches are not
// exercised, because the distribution repository named by the placeholder
// constants does not exist yet — a live test becomes worth writing only once the
// real owner and repository name are filled in.
//
// Run with `node --test dist/lib/update-check.test.js` after `npm run build`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  RELEASE_REPO_NAME,
  RELEASE_REPO_OWNER,
  fetchLatestRelease,
  isNewer,
  isReleaseRepoConfigured,
  latestReleaseUrl,
  parseSemver,
} from './update-check.js';

test('isNewer is true only for a strictly greater version tuple', () => {
  assert.equal(isNewer('1.0.1', '1.0.0'), true);
  assert.equal(isNewer('1.1.0', '1.0.9'), true);
  assert.equal(isNewer('2.0.0', '1.9.9'), true);
});

test('isNewer is false for an equal version', () => {
  assert.equal(isNewer('1.0.0', '1.0.0'), false);
  assert.equal(isNewer('0.4.12', '0.4.12'), false);
});

test('isNewer is false for a lower version', () => {
  assert.equal(isNewer('1.0.0', '1.0.1'), false);
  assert.equal(isNewer('1.0.9', '1.1.0'), false);
  assert.equal(isNewer('1.9.9', '2.0.0'), false);
});

test('isNewer is false when either side fails to parse', () => {
  assert.equal(isNewer('not-a-version', '1.0.0'), false);
  assert.equal(isNewer('2.0.0', 'not-a-version'), false);
  assert.equal(isNewer('', '1.0.0'), false);
  assert.equal(isNewer('1.0.0', ''), false);
  assert.equal(isNewer('1.2', '1.0.0'), false);
  assert.equal(isNewer('9.9.9', '1.2'), false);
});

test('isNewer tolerates a leading v on either side', () => {
  assert.equal(isNewer('v1.0.1', '1.0.0'), true);
  assert.equal(isNewer('1.0.1', 'v1.0.0'), true);
  assert.equal(isNewer('v1.0.1', 'v1.0.0'), true);
  assert.equal(isNewer('v1.0.0', 'v1.0.0'), false);
});

test('parseSemver ignores any suffix after the patch number', () => {
  assert.deepEqual(parseSemver('v1.2.3-beta'), { major: 1, minor: 2, patch: 3 });
  assert.deepEqual(parseSemver('1.2.3-rc.1+build9'), { major: 1, minor: 2, patch: 3 });
});

test('parseSemver reads a bare version and a v-prefixed one alike', () => {
  assert.deepEqual(parseSemver('1.2.3'), { major: 1, minor: 2, patch: 3 });
  assert.deepEqual(parseSemver('v1.2.3'), { major: 1, minor: 2, patch: 3 });
  assert.deepEqual(parseSemver('10.20.30'), { major: 10, minor: 20, patch: 30 });
});

test('parseSemver returns null on anything that is not MAJOR.MINOR.PATCH', () => {
  assert.equal(parseSemver(''), null);
  assert.equal(parseSemver('1'), null);
  assert.equal(parseSemver('1.2'), null);
  assert.equal(parseSemver('latest'), null);
  assert.equal(parseSemver('v'), null);
  assert.equal(parseSemver('a.b.c'), null);
});

test('latestReleaseUrl is built from the two constants and ends at the latest release', () => {
  const url = latestReleaseUrl();
  assert.ok(url.includes(RELEASE_REPO_OWNER), `${url} must carry the owner constant`);
  assert.ok(url.includes(RELEASE_REPO_NAME), `${url} must carry the repository constant`);
  assert.ok(url.endsWith('/releases/latest'), `${url} must end in /releases/latest`);
});

test('isReleaseRepoConfigured is false while the placeholders stand', () => {
  assert.equal(isReleaseRepoConfigured(), false);
});

test('fetchLatestRelease resolves to null while the repository is unconfigured', async () => {
  assert.equal(await fetchLatestRelease(), null);
});
