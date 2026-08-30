// Asks the distribution repository's GitHub "latest release" endpoint what the
// newest published version is, and compares two version strings. That is the
// whole of this module's territory.
//
// It knows nothing about preferences (no .praxis-update.json, no enabled flag,
// no dismissal), nothing about scheduling (it never decides whether a check is
// due), nothing about Electron, and nothing about the banner. Those belong to
// src/lib/update-prefs.ts, electron/update-check-ipc-handlers.cts and
// src/public/update-banner.ts respectively.
//
// Nothing here ever throws. Every unhappy path — an unconfigured repository, a
// non-2xx response, a network error, a timeout, an oversized body, unparseable
// JSON, a missing tag — resolves to null. A thrown error would surface in the
// Electron main process as an unhandled rejection, and this feature's every
// failure mode is "show nothing".

export const RELEASES_API_BASE: string = 'https://api.github.com';

// TODO: replace both placeholders below with the real distribution repository's
// owner and name before shipping. While either one still holds its placeholder
// literal, isReleaseRepoConfigured() returns false and the whole update-check
// feature stays inert — no request is ever made and no banner can appear.
export const RELEASE_REPO_OWNER: string = 'TODO-REPLACE-OWNER';
export const RELEASE_REPO_NAME: string = 'TODO-REPLACE-REPO';

// Ceiling on the response body. A GitHub release record is a few kilobytes; this
// is generous headroom against a hostile or broken response, not a tuning value.
const MAX_BODY_BYTES = 256 * 1024;

const DEFAULT_TIMEOUT_MS = 10000;

export interface LatestRelease {
  version: string; // tag_name with any leading 'v' stripped
  releaseUrl: string | null; // html_url, or null when the field is absent
}

// False while either repository constant still equals its own placeholder. This
// is the guard that makes an unedited build make no request at all.
export function isReleaseRepoConfigured(): boolean {
  return RELEASE_REPO_OWNER !== 'TODO-REPLACE-OWNER' && RELEASE_REPO_NAME !== 'TODO-REPLACE-REPO';
}

// Built from the compile-time constants only. It takes no argument, so no caller
// — least of all the renderer — can steer where this module reaches.
export function latestReleaseUrl(): string {
  return `${RELEASES_API_BASE}/repos/${RELEASE_REPO_OWNER}/${RELEASE_REPO_NAME}/releases/latest`;
}

// Accepts `v?MAJOR.MINOR.PATCH` and ignores whatever follows the patch number,
// so 'v1.2.3-beta' parses as 1.2.3. Tag conventions vary, which is why the
// leading 'v' is tolerated here as well as stripped at the call site.
const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)/;

export function parseSemver(raw: string): { major: number; minor: number; patch: number } | null {
  if (typeof raw !== 'string') return null;
  const m = raw.trim().match(SEMVER);
  if (m === null) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

// True only when candidate is strictly greater than running, comparing major,
// then minor, then patch. An unreadable version on either side returns false: a
// version we cannot read must never raise a banner.
export function isNewer(candidate: string, running: string): boolean {
  const a = parseSemver(candidate);
  const b = parseSemver(running);
  if (a === null || b === null) return false;
  if (a.major !== b.major) return a.major > b.major;
  if (a.minor !== b.minor) return a.minor > b.minor;
  return a.patch > b.patch;
}

// Buffers a response body under a running byte cap. res.text() takes whatever
// the server sends with no limit at all, so the cap has to be applied while
// reading rather than after. Content-Length is consulted first for a fast
// refusal, but it is only a hint — a chunked response carries no such header —
// so the running total over the stream is what actually enforces the limit. The
// reader is cancelled on the over-limit path so the connection does not stay
// open behind the abandoned read.
//
// src/lib/skill-content-fetch.ts carries the same reader, but does not export it
// and is a read-only reference here, so this duplication is forced.
async function readCappedBody(res: Response, maxBytes: number): Promise<string> {
  const declaredHeader = res.headers.get('content-length');
  if (declaredHeader !== null) {
    const declared = Number(declaredHeader);
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new Error(`Release record exceeds ${maxBytes} bytes (Content-Length ${declared})`);
    }
  }

  const body = res.body;
  if (!body) {
    throw new Error('Release record response carried no body');
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
        throw new Error(`Release record exceeds ${maxBytes} bytes`);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, total).toString('utf8');
}

// Resolves to the latest published release, or to null on every unhappy path.
// There is no error for a caller to handle, which is why the whole body sits
// inside one unconditional catch: AbortSignal.timeout rejects with a
// TimeoutError DOMException rather than a plain Error, so an instanceof-filtered
// catch would let it escape. A 404 is a normal outcome too — GitHub answers 404
// for a repository that has published no release yet.
export async function fetchLatestRelease(timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<LatestRelease | null> {
  // Before any fetch() call is reached: an unedited build makes no request.
  if (!isReleaseRepoConfigured()) return null;

  try {
    const res = await fetch(latestReleaseUrl(), {
      // No token, no credential, no cookie. GitHub rejects an API request that
      // sends no User-Agent, and that header carries no version or machine
      // detail beyond the product name.
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'FlowCharge',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) return null;

    const raw = await readCappedBody(res, MAX_BODY_BYTES);
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return null;

    const record = parsed as { tag_name?: unknown; html_url?: unknown };
    if (typeof record.tag_name !== 'string' || record.tag_name.trim() === '') return null;

    const version = record.tag_name.trim().replace(/^v/, '');
    const releaseUrl = typeof record.html_url === 'string' ? record.html_url : null;

    return { version, releaseUrl };
  } catch {
    return null;
  }
}
