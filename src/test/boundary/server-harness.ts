// Shared harness for the HTTP boundary suites. It starts the compiled server on
// an ephemeral port with its data directory redirected into a fresh temporary
// directory, and it performs raw and JSON requests against that server.
//
// The filename carries no `.test.` segment ON PURPOSE, so a test file may import
// it without registering that file's cases a second time in the importing file's
// process. src/test/fixture-project.ts states the same rule in its own header,
// and is the precedent this file follows.
//
// This module's whole knowledge of the application is three environment variable
// names and one exported promise. It names no route path, no payload field and
// no registry field, so a caller's expectations live in the caller and this file
// survives a change of route table untouched.

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// The started server, as the caller needs to see it: where to send a request,
// and which directory to remove afterwards.
export interface TestServer {
  base: string;
  dataDir: string;
}

// One answer, undecoded. `headers` is the raw header bag, because a header the
// caller wants to assert on may legitimately arrive more than once.
export interface RawResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  text: string;
}

// The request shape both helpers accept. Deliberately NOT exported: the module's
// public surface is the two interfaces above and the three functions below.
interface RequestOptions {
  method?: string;
  body?: string;
  headers?: Record<string, string>;
}

// Starts the server in THIS process with a private data directory.
//
// The assignment order below is load-bearing, not stylistic. src/server.ts reads
// `port` and `host` at lines 30-31 and INSTALL_REGISTRY_PATH at line 108, and
// src/lib/projects.ts reads `dataDir` at line 22 — all at module evaluation. An
// assignment made after the import is therefore never observed, and the server
// would fall back to the repository root and write into the maintainer's own
// registry. So every variable is assigned first, and the module is imported only
// afterwards.
//
// ESM module caching means one process observes exactly one environment: a
// second call here would hand back the already-evaluated module with the first
// call's data directory still in force. Call this once per test file.
//
// The temporary directory is deliberately NOT removed here. The caller owns
// `dataDir` and removes it in its own after() hook, so a failing assertion can
// still be investigated against the files the run left behind.
export async function startTestServer(): Promise<TestServer> {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowcharge-harness-'));

  process.env.PRAXIS_DATA_DIR = dataDir;
  // PORT 0 asks the OS for an ephemeral port, so two suites never collide and a
  // developer already running the board does not break the run. The bound port
  // is read back from the promise rather than assumed.
  process.env.PORT = '0';
  process.env.HOST = '127.0.0.1';

  const { serverReady } = await import('../../server.js');
  const port = await serverReady;

  return { base: `http://127.0.0.1:${port}`, dataDir };
}

// One request, built on node:http rather than on fetch, for two reasons that
// both matter to the guard cases: `Host` is a forbidden header name for fetch
// and cannot be set through it, and fetch normalises the request path, which
// would collapse a traversal such as `/../package.json` before the server ever
// saw it.
//
// `route` is therefore passed through verbatim and never through a URL object.
// The response handler is attached at request creation, BEFORE any body is
// written, so an answer that arrives while the request is still being sent — and
// is followed by the server destroying the request — is still observed.
//
// `agent: false` gives every request its own connection. Node's global agent
// keeps connections alive and pools them, so a server that answers and then
// destroys the connection leaves a dead socket in that pool, and the NEXT
// request reuses it and fails with EPIPE before it ever reaches the server. One
// connection per request removes that coupling between cases entirely.
export function requestRaw(
  base: string,
  route: string,
  init: RequestOptions = {},
): Promise<RawResponse> {
  const target = new URL(base);
  return new Promise<RawResponse>((resolve, reject) => {
    let settled = false;
    const req = http.request(
      {
        host: target.hostname,
        port: target.port,
        method: init.method ?? 'GET',
        path: route,
        headers: init.headers,
        agent: false,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('error', (err) => {
          if (settled) return;
          settled = true;
          reject(err);
        });
        res.on('end', () => {
          if (settled) return;
          settled = true;
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            text: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );
    // A server that answers and then destroys the request makes the request
    // stream emit ECONNRESET or EPIPE. Once an answer has already resolved this
    // promise, that error is expected behaviour rather than a failure, so it is
    // dropped instead of rejecting a promise that has already settled.
    req.on('error', (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
    if (init.body !== undefined) req.write(init.body);
    req.end();
  });
}

// The same request, with the body parsed as JSON. Use it only where the answer
// really is JSON: some answers are plain text, and JSON.parse throws on those.
// Read those through requestRaw instead.
export async function requestJson<T = unknown>(
  base: string,
  route: string,
  init: RequestOptions = {},
): Promise<{ status: number; body: T }> {
  const raw = await requestRaw(base, route, init);
  return { status: raw.status, body: JSON.parse(raw.text) as T };
}
