// Boundary regression suite for the cross-cutting request guards that sit ABOVE
// the route table, driven over a real socket against the real compiled server.
//
// The guards covered here are isJsonContentType, passesOriginCheck and the
// `startsWith(root + path.sep)` traversal check in src/server.ts. None of them
// belongs to a route, so none of them is covered by the route suites: they are
// the checks a new route inherits for free and can therefore lose silently.
//
// Several answers in this file are NOT JSON — the traversal refusal is plain
// text — so those cases are read through requestRaw and asserted against the
// body text directly. requestRaw is also the only way to set a `Host` header at
// all: `Host` is a forbidden header name for fetch.
//
// Assertion strictness, settled for the whole suite: assert the status code and
// the response shape everywhere, and assert only that an `error` string is
// present for a refusal, never its wording. No refusal in this file encodes a
// security decision that the message text carries, so no exact text is pinned
// here.
//
// Run with `node --test --test-force-exit dist/server-guards.test.js` after
// `npm run build`. The --test-force-exit is required for the same reason
// src/server.test.ts needs it: importing the server binds a listening socket as
// a module side effect and nothing exports a close handle. `npm test` already
// passes the flag.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { startTestServer, requestRaw, requestJson } from './server-harness.js';

// Once per file: the harness fixes this process's environment before it imports
// the server, and ESM module caching means that environment cannot be changed
// afterwards.
const { base, dataDir } = await startTestServer();

after(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

// The raw `Host` header value the harness's own requests carry, rebuilt from the
// base URL. The Origin check compares against the RAW Host header INCLUDING the
// port, so a port-less Origin would fail for the wrong reason.
const HOST_HEADER = new URL(base).host;

// An answer body carries an `error` string. The wording is deliberately not
// asserted anywhere in this file.
function assertErrorBody(body: unknown): void {
  assert.equal(typeof body, 'object');
  assert.notEqual(body, null);
  assert.equal(typeof (body as { error?: unknown }).error, 'string');
}

// ---------------------------------------------------------------------------
// The Content-Type guard
// ---------------------------------------------------------------------------

test('POST with a non-JSON Content-Type is refused with 403', async () => {
  const { status, body } = await requestJson(base, '/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: '{}',
  });
  assert.equal(status, 403);
  assertErrorBody(body);
});

test('POST with a charset parameter on application/json passes the Content-Type guard', async () => {
  // The guard splits parameters off at the first semicolon, so this must reach
  // the route rather than the 403 above it. The body is valid JSON with no
  // `path`, so the route's own 400 is what proves the guard let it through.
  const { status, body } = await requestJson(base, '/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: '{}',
  });
  assert.notEqual(status, 403);
  assert.equal(status, 400);
  assertErrorBody(body);
});

// ---------------------------------------------------------------------------
// The Host guard
// ---------------------------------------------------------------------------

test('a Host header that is neither an IP literal, localhost nor allowed is refused with 403', async () => {
  // Every IP literal passes the guard, so a case sending 127.0.0.1 would prove
  // nothing: the refusal needs a non-IP, non-localhost name. `Host` cannot be
  // set through fetch at all, which is why requestRaw exists.
  const raw = await requestRaw(base, '/api/projects', {
    headers: { Host: 'evil.example' },
  });
  assert.equal(raw.status, 403);
  assertErrorBody(JSON.parse(raw.text));
});

// ---------------------------------------------------------------------------
// The Origin guard
// ---------------------------------------------------------------------------

test('an Origin that does not match the Host header is refused with 403', async () => {
  const raw = await requestRaw(base, '/api/projects', {
    headers: { Origin: 'http://evil.example' },
  });
  assert.equal(raw.status, 403);
  assertErrorBody(JSON.parse(raw.text));
});

test('an Origin built from the same host and port passes the Origin guard', async () => {
  const raw = await requestRaw(base, '/api/projects', {
    headers: { Origin: `http://${HOST_HEADER}` },
  });
  assert.equal(raw.status, 200);
});

test('an absent Origin passes the Origin guard', async () => {
  // Electron's loopbackRequest sends no Origin at all, so this branch is the
  // one the desktop app actually takes.
  const { status } = await requestJson(base, '/api/projects');
  assert.equal(status, 200);
});

// ---------------------------------------------------------------------------
// The traversal guard
// ---------------------------------------------------------------------------

test('a path escaping the public root is refused with a plain-text 403', async () => {
  // The path is sent verbatim by requestRaw — no URL object, no normalisation —
  // so the traversal survives to the server. The answer is written with
  // res.writeHead(403) and a plain-text body, so requestJson would throw on it.
  const raw = await requestRaw(base, '/../package.json');
  assert.equal(raw.status, 403);
  assert.equal(raw.text, 'Forbidden');
});

// ---------------------------------------------------------------------------
// The oversize-body guard
// ---------------------------------------------------------------------------

test('a request body over the size cap is refused with 413', async () => {
  // readRequestBody answers 413 on the first chunk that crosses the cap and
  // then calls req.destroy(), so the answer can arrive while the body is still
  // being written. requestRaw attaches its response handler at request creation,
  // BEFORE any body is written, and drops an ECONNRESET or EPIPE that follows a
  // settled promise — the destroy is expected behaviour, not a failure. Writing
  // the whole body before listening for a response is the flake this avoids.
  //
  // The length is derived from a value comfortably above the cap rather than
  // restated as an assertion, so widening the cap later cannot silently make
  // this case meaningless.
  const oversize = JSON.stringify({ path: 'x'.repeat(64 * 1024) });
  const raw = await requestRaw(base, '/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: oversize,
  });
  assert.equal(raw.status, 413);
  assertErrorBody(JSON.parse(raw.text));
});

// ---------------------------------------------------------------------------
// The method guard of GET /api/integrations/releases
// ---------------------------------------------------------------------------

test('POST /api/integrations/releases is refused with 405', async () => {
  // Content-Type: application/json is sent so the request passes the
  // Content-Type guard above the route table. Without it the answer would be
  // the 403 of that guard, and this case would prove nothing about the route's
  // own method guard.
  //
  // The /api/integrations/ branch also sits behind a loopback peer-address
  // gate. The harness binds 127.0.0.1, so the gate passes and the 405 below is
  // reached. The non-loopback 403 branch is out of scope: producing a non-local
  // peer needs a second host.
  //
  // The 200 path of this route is deliberately NOT covered. listSkillReleases
  // in src/lib/skill-content-fetch.ts calls a fixed URL and takes no injectable
  // source, so an offline test of its body would need a production seam this
  // workstream does not authorize. The 405 answers before any of that runs, so
  // this case makes no network call.
  // No request body is sent. The method guard answers before any body is read
  // and the server then closes the connection without draining the request, so
  // a body written here would race that close and surface as an EPIPE on the
  // request stream instead of as the answer.
  const { status, body } = await requestJson(base, '/api/integrations/releases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  assert.equal(status, 405);
  assertErrorBody(body);
});

// ---------------------------------------------------------------------------
// Static serving and the CSP header
// ---------------------------------------------------------------------------
//
// These cases run against dist/public/, which `npm run build` fills, so this
// file depends on the build step the `pretest` script already performs. Every
// answer below is HTML, CSS or plain text rather than JSON, so all of them are
// read through requestRaw.
//
// The Content-Security-Policy header is sent only on the static branch, never
// on an /api/ JSON answer, so it is never asserted on a route response.

// The directives the policy in src/server.ts sets. Asserted individually rather
// than as one exact byte string, so reordering the policy does not break this.
const CSP_DIRECTIVES = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "img-src 'self'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
];

function assertCspHeader(headers: Record<string, string | string[] | undefined>): void {
  const csp = headers['content-security-policy'];
  assert.equal(typeof csp, 'string');
  for (const directive of CSP_DIRECTIVES) {
    assert.ok(
      (csp as string).includes(directive),
      `Content-Security-Policy is missing the directive ${directive}`,
    );
  }
}

test('GET / answers 200 with HTML and the CSP header', async () => {
  const raw = await requestRaw(base, '/');
  assert.equal(raw.status, 200);
  assert.equal(raw.headers['content-type'], 'text/html; charset=utf-8');
  assertCspHeader(raw.headers);
});

test('GET /board.html answers 200 with HTML and the CSP header', async () => {
  const raw = await requestRaw(base, '/board.html');
  assert.equal(raw.status, 200);
  assert.equal(raw.headers['content-type'], 'text/html; charset=utf-8');
  assertCspHeader(raw.headers);
});

test('GET /styles.css answers 200 with its documented MIME type and the CSP header', async () => {
  // The MIME string comes from the MIME table in src/server.ts.
  const raw = await requestRaw(base, '/styles.css');
  assert.equal(raw.status, 200);
  assert.equal(raw.headers['content-type'], 'text/css; charset=utf-8');
  assertCspHeader(raw.headers);
});

test('an unknown static path answers 404', async () => {
  // The 404 static answer is text/plain, so it is read as text and never
  // parsed as JSON.
  const raw = await requestRaw(base, '/no-such-file.css');
  assert.equal(raw.status, 404);
  assert.equal(raw.headers['content-type'], 'text/plain');
});
