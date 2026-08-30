// Knows the Gitea/GitHub-compatible release API's JSON shape, and nothing
// else. This module holds NO host constant and imports nothing from
// src/lib/skill-content-fetch.ts, so there is no import cycle: the base URL
// always arrives as a parameter, and skill-content-fetch.ts stays the one
// owner of PRAXIS_REPO_BASE_URL and the composition point above this file.
//
// It knows nothing about skills, zip containers, install targets, or the
// filesystem. Both URLs it builds derive from the caller-supplied base URL
// only, never from renderer input — the same rule
// electron/update-check-ipc-handlers.cts states for its outbound URL.

export interface SkillReleaseSummary {
  tag: string; // tag_name verbatim, e.g. 'v0.1.0'
  name: string; // release name; '' when absent
  publishedAt: string; // ISO 8601 published_at; '' when absent
  assetName: string | null; // chosen .zip asset name; null when the release has none
}

// Ceiling on the release-list response body. A release list is a few
// kilobytes of JSON; this is generous headroom against a hostile or broken
// response, not a tuning value.
const MAX_BODY_BYTES = 4 * 1024 * 1024;

// The base URL is the repository's own web URL
// (e.g. http://host:8110/owner/repo). The API route is a different shape
// entirely — it hangs off the origin, not off the repository path — which is
// why this is a separate builder from buildAssetDownloadUrl below.
export function releasesApiUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  const repoPath = url.pathname.replace(/\/+$/, '');
  return `${url.origin}/api/v1/repos${repoPath}/releases`;
}

// The download route hangs off the repository URL itself. The download URL
// the API reports for an asset is never read or returned: it carries hostname
// `netplex` rather than the IP the app is pinned to, so this URL is always
// rebuilt from the caller's own base URL instead.
export function buildAssetDownloadUrl(baseUrl: string, tag: string, assetName: string): string {
  return `${baseUrl}/releases/download/${tag}/${assetName}`;
}

function firstZipAssetName(assets: unknown): string | null {
  if (!Array.isArray(assets)) return null;
  for (const asset of assets) {
    if (asset === null || typeof asset !== 'object') continue;
    const name = (asset as { name?: unknown }).name;
    if (typeof name === 'string' && name.endsWith('.zip')) return name;
  }
  return null;
}

// Never throws. A shape this cannot read yields [] — the caller above turns
// an empty list into the user-facing "no published release" failure, so a
// parse accident and a genuinely empty list are deliberately the same outcome.
export function parseReleases(raw: unknown): SkillReleaseSummary[] {
  if (!Array.isArray(raw)) return [];

  const summaries: SkillReleaseSummary[] = [];
  for (const entry of raw) {
    if (entry === null || typeof entry !== 'object') continue;
    const record = entry as {
      tag_name?: unknown;
      name?: unknown;
      published_at?: unknown;
      draft?: unknown;
      prerelease?: unknown;
      assets?: unknown;
    };

    if (record.draft === true || record.prerelease === true) continue;
    if (typeof record.tag_name !== 'string' || record.tag_name.trim() === '') continue;

    summaries.push({
      tag: record.tag_name,
      name: typeof record.name === 'string' ? record.name : '',
      publishedAt: typeof record.published_at === 'string' ? record.published_at : '',
      assetName: firstZipAssetName(record.assets),
    });
  }

  // Newest first by publishedAt, with tag descending as the tie-break, so two
  // releases published in the same second still order deterministically.
  summaries.sort((a, b) => {
    if (a.publishedAt !== b.publishedAt) return a.publishedAt < b.publishedAt ? 1 : -1;
    if (a.tag !== b.tag) return a.tag < b.tag ? 1 : -1;
    return 0;
  });

  return summaries;
}

// Buffers a response body under a running byte cap. res.text() takes whatever
// the server sends with no limit at all, so the cap has to be applied while
// reading. Content-Length is consulted first for a fast refusal, but it is
// only a hint — a chunked response carries no such header — so the running
// total over the stream is what actually enforces the limit. The reader is
// cancelled on the over-limit path so the connection does not stay open
// behind the abandoned read.
async function readCappedBody(res: Response, maxBytes: number): Promise<string> {
  const declaredHeader = res.headers.get('content-length');
  if (declaredHeader !== null) {
    const declared = Number(declaredHeader);
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new Error(`Release list exceeds ${maxBytes} bytes (Content-Length ${declared})`);
    }
  }

  const body = res.body;
  if (!body) {
    throw new Error('Release list response carried no body');
  }

  const reader = body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error(`Release list exceeds ${maxBytes} bytes`);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, total).toString('utf8');
}

// Resolves to the published releases, newest first, or to [] on every unhappy
// path: a non-2xx, a network failure, an oversized body, or unparseable JSON.
// The whole body sits inside ONE unconditional catch on purpose — an
// AbortSignal-style rejection is a DOMException rather than a plain Error, so
// an instanceof-filtered catch would let it escape and turn a network blip
// into a rejected promise instead of an empty list.
export async function fetchReleases(baseUrl: string): Promise<SkillReleaseSummary[]> {
  try {
    const res = await fetch(releasesApiUrl(baseUrl), {
      // No token, no credential, no cookie.
      headers: { Accept: 'application/json', 'User-Agent': 'FlowCharge' },
    });

    if (!res.ok) return [];

    const raw = await readCappedBody(res, MAX_BODY_BYTES);
    return parseReleases(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}
