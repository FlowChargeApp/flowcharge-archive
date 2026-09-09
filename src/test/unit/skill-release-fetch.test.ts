// Tests for skill-release-fetch.ts's parseReleases and its two URL builders.
// Every test here is offline by design: parseReleases is handed literal
// parsed-JSON values and the builders are handed literal strings, so nothing
// in this file touches the network. fetchReleases is exercised through the
// stubbed-fetch tier in skill-content-fetch.test.ts instead.
//
// Run with `node --test dist/test/unit/skill-release-fetch.test.js` after
// `npm run build`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseReleases, releasesApiUrl, buildAssetDownloadUrl } from '../../lib/skill-release-fetch.js';

const BASE_URL = 'http://100.87.185.97:8110/akoukoullis/Praxis';

function release(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    tag_name: 'v0.1.0',
    name: 'FlowCharge v0.1.0',
    published_at: '2026-08-29T20:31:55+10:00',
    draft: false,
    prerelease: false,
    assets: [{ name: 'flowcharge-skills-0.1.0.zip' }],
    ...overrides,
  };
}

// --- parseReleases: sorting -------------------------------------------------

test('parseReleases sorts newest-first by publishedAt', () => {
  const parsed = parseReleases([
    release({ tag_name: 'v0.1.0', published_at: '2026-08-29T20:31:55+10:00' }),
    release({ tag_name: 'v0.3.0', published_at: '2026-08-31T09:00:00+10:00' }),
    release({ tag_name: 'v0.2.0', published_at: '2026-08-30T09:00:00+10:00' }),
  ]);

  assert.deepEqual(
    parsed.map((r) => r.tag),
    ['v0.3.0', 'v0.2.0', 'v0.1.0'],
  );
});

test('parseReleases breaks a publishedAt tie with tag descending', () => {
  const sameInstant = '2026-08-30T09:00:00+10:00';
  const parsed = parseReleases([
    release({ tag_name: 'v0.2.0', published_at: sameInstant }),
    release({ tag_name: 'v0.4.0', published_at: sameInstant }),
    release({ tag_name: 'v0.3.0', published_at: sameInstant }),
  ]);

  assert.deepEqual(
    parsed.map((r) => r.tag),
    ['v0.4.0', 'v0.3.0', 'v0.2.0'],
  );
});

// --- parseReleases: filtering ----------------------------------------------

test('parseReleases drops a draft release', () => {
  const parsed = parseReleases([
    release({ tag_name: 'v0.9.0', published_at: '2026-09-01T09:00:00+10:00', draft: true }),
    release({ tag_name: 'v0.1.0' }),
  ]);

  assert.deepEqual(
    parsed.map((r) => r.tag),
    ['v0.1.0'],
  );
});

test('parseReleases drops a prerelease', () => {
  const parsed = parseReleases([
    release({ tag_name: 'v0.9.0-rc1', published_at: '2026-09-01T09:00:00+10:00', prerelease: true }),
    release({ tag_name: 'v0.1.0' }),
  ]);

  assert.deepEqual(
    parsed.map((r) => r.tag),
    ['v0.1.0'],
  );
});

test('parseReleases drops an entry with no non-empty tag_name', () => {
  const parsed = parseReleases([release({ tag_name: '   ' }), release({ tag_name: undefined }), release({})]);

  assert.deepEqual(
    parsed.map((r) => r.tag),
    ['v0.1.0'],
  );
});

// --- parseReleases: asset selection and absent fields -----------------------

test('parseReleases reports assetName null when the newest release carries no .zip asset', () => {
  const parsed = parseReleases([
    release({ assets: [{ name: 'flowcharge-skills-0.1.0.tar.gz' }, { name: 'checksums.txt' }] }),
  ]);

  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].assetName, null);
});

test('parseReleases reports assetName null when the assets array is missing or empty', () => {
  assert.equal(parseReleases([release({ assets: [] })])[0].assetName, null);
  assert.equal(parseReleases([release({ assets: undefined })])[0].assetName, null);
});

test('parseReleases picks the first .zip asset and defaults absent name and published_at to empty strings', () => {
  const parsed = parseReleases([
    release({
      name: undefined,
      published_at: undefined,
      assets: [{ name: 'notes.txt' }, { name: 'flowcharge-skills-0.1.0.zip' }, { name: 'extra.zip' }],
    }),
  ]);

  assert.equal(parsed[0].assetName, 'flowcharge-skills-0.1.0.zip');
  assert.equal(parsed[0].name, '');
  assert.equal(parsed[0].publishedAt, '');
  assert.equal(parsed[0].tag, 'v0.1.0', 'tag_name is carried verbatim, with no v-prefix stripping');
});

// --- parseReleases: unreadable shapes --------------------------------------

test('parseReleases returns [] for an unreadable shape rather than throwing', () => {
  for (const raw of [null, undefined, 'a string', 42, { message: 'Not Found' }, [1, 2, 3], [null, 'x']]) {
    assert.deepEqual(parseReleases(raw), [], `unreadable shape ${JSON.stringify(raw)} must yield []`);
  }
});

// --- URL builders -----------------------------------------------------------

test('releasesApiUrl derives the API route from the supplied base URL', () => {
  assert.equal(releasesApiUrl(BASE_URL), 'http://100.87.185.97:8110/api/v1/repos/akoukoullis/Praxis/releases');
  assert.equal(
    releasesApiUrl('https://example.test:9000/owner/repo/'),
    'https://example.test:9000/api/v1/repos/owner/repo/releases',
  );
});

test('buildAssetDownloadUrl derives the asset route from the supplied base URL', () => {
  assert.equal(
    buildAssetDownloadUrl(BASE_URL, 'v0.1.0', 'flowcharge-skills-0.1.0.zip'),
    'http://100.87.185.97:8110/akoukoullis/Praxis/releases/download/v0.1.0/flowcharge-skills-0.1.0.zip',
  );
});

test('the built asset URL never carries the host the API reports for the asset', () => {
  // The live API answers with a download URL on hostname `netplex`, which the
  // app is not pinned to. Parsing must not carry that value anywhere, and the
  // built URL must stay on the supplied base URL's host.
  const parsed = parseReleases([
    release({
      assets: [
        {
          name: 'flowcharge-skills-0.1.0.zip',
          browser_download_url:
            'http://netplex:8110/akoukoullis/Praxis/releases/download/v0.1.0/flowcharge-skills-0.1.0.zip',
        },
      ],
    }),
  ]);

  const summary = parsed[0];
  assert.equal(JSON.stringify(summary).includes('netplex'), false, 'no API-reported URL may survive parsing');

  const url = buildAssetDownloadUrl(BASE_URL, summary.tag, summary.assetName ?? '');
  assert.equal(url.includes('netplex'), false);
  assert.ok(url.startsWith(BASE_URL));
});
