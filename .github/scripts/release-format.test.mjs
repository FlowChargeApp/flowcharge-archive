// Unit tests for .github/scripts/release-format.mjs.
//
// The module under test takes text and returns text, so every fixture below is
// an inline string. No test reads a file from disk and no test creates a
// temporary directory.
//
// Run with `node --test .github/scripts/release-format.test.mjs`, or through the
// repository's canonical `npm test`, which discovers this file in place — it is
// .mjs, it lives outside src/, so tsc never compiles it and it never lands in
// dist/.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBareVersion, newestVersion, sectionBody } from './release-format.mjs';

test('release-format isBareVersion accepts a bare three-part version', () => {
  assert.equal(isBareVersion('0.1.0'), true);
  assert.equal(isBareVersion('10.20.30'), true);
});

test('release-format isBareVersion rejects a leading v, a two-part version, a pre-release and the empty string', () => {
  assert.equal(isBareVersion('v0.1.0'), false);
  assert.equal(isBareVersion('0.2'), false);
  assert.equal(isBareVersion('0.2.0-rc.1'), false);
  assert.equal(isBareVersion(''), false);
});

test('release-format newestVersion reads past an Unreleased heading to the release heading below it', () => {
  const changelog = ['# Changelog', '', '## Unreleased', '', '### Added', '', '- a note', '', '## 0.2.0', '', 'newer body', '', '## 0.1.0', '', 'older body', ''].join('\n');
  assert.equal(newestVersion(changelog), '0.2.0');
});

test('release-format newestVersion tolerates the date tail flowcharge-public writes', () => {
  assert.equal(newestVersion('## Unreleased\n\n## 0.1.0 - 2026-09-04\n\nbody\n'), '0.1.0');
});

test('release-format newestVersion returns null for text holding no release heading', () => {
  assert.equal(newestVersion('# Changelog\n\n## Unreleased\n\n- nothing released yet\n'), null);
  assert.equal(newestVersion(''), null);
});

test('release-format newestVersion ignores a version quoted mid-line in prose', () => {
  const prose = 'A release heading is written as `## 1.2.3 - YYYY-MM-DD`, with no brackets.\n\n## Unreleased\n';
  assert.equal(newestVersion(prose), null);
});

test('release-format sectionBody returns the body of a release section that is not the newest one', () => {
  const changelog = '## 0.2.0 - 2026-02-02\n\nnewer body\n\n## 0.1.0 - 2026-01-01\n\nolder body\nsecond line\n\n## 0.0.9\n\noldest\n';
  assert.equal(sectionBody(changelog, '0.1.0'), 'older body\nsecond line');
});

test('release-format sectionBody stops at the next ## line whichever heading it is', () => {
  const beforeRelease = '## 0.2.0\n\nbody\n\n## 0.1.0\n\nother\n';
  assert.equal(sectionBody(beforeRelease, '0.2.0'), 'body');

  const beforeUnreleased = '## 0.2.0\n\nbody\n\n## Unreleased\n\nnot part of the section\n';
  assert.equal(sectionBody(beforeUnreleased, '0.2.0'), 'body');
});

test('release-format sectionBody trims blank lines at both ends but keeps the ones inside', () => {
  const changelog = '## 0.1.0\n\n\n### Added\n\n- one\n\n\n';
  assert.equal(sectionBody(changelog, '0.1.0'), '### Added\n\n- one');
});

test('release-format sectionBody returns the empty string for a heading whose section holds no text', () => {
  assert.equal(sectionBody('## 0.1.0 - 2026-09-04\n\n\n## 0.0.9\n\nbody\n', '0.1.0'), '');
  assert.equal(sectionBody('## 0.1.0\n', '0.1.0'), '');
});

test('release-format sectionBody returns null for a version no heading names', () => {
  assert.equal(sectionBody('## 0.1.0\n\nbody\n', '9.9.9'), null);
  assert.equal(sectionBody('## Unreleased\n\nbody\n', '0.1.0'), null);
});

test('release-format sectionBody distinguishes the null case from the empty-string case', () => {
  const missing = sectionBody('## 0.2.0\n\nbody\n', '0.1.0');
  const empty = sectionBody('## 0.1.0\n\n## 0.0.9\n\nbody\n', '0.1.0');
  assert.equal(missing, null);
  assert.equal(empty, '');
  assert.notEqual(missing, empty);
});

test('release-format sectionBody reads the last section to the end of the text', () => {
  assert.equal(sectionBody('## 0.2.0\n\nnewer\n\n## 0.1.0\n\nfinal body\n', '0.1.0'), 'final body');
});
