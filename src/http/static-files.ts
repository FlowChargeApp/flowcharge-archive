// Static asset serving: the MIME table, the Content-Security-Policy every
// static response carries, the traversal boundary and the file response.
//
// This module derives no path from its own location. publicRoot arrives as an
// argument, because it is computed from dist/server.js's own location and would
// resolve to the wrong directory from dist/http/ — including inside the packaged
// binary, where it is the path Bun's embedded read-only asset filesystem
// resolves against.

import type http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

// The policy every static response carries. Every asset this server sends is
// same-origin: separate script files, one stylesheet, one local woff2, and
// fetch calls that only ever reach /api/* on this same origin.
const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; " +
  "connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'self'; " +
  "frame-ancestors 'none'; object-src 'none'";

// The traversal boundary, applied to every request before the /api/ dispatch so
// no route can miss it. Returns the joined file path when the request stays
// inside publicRoot; otherwise it writes its own plain-text 403 and returns
// null.
//
// path.join has already collapsed any '..', so the only remaining gap is a bare
// prefix match: a sibling of publicRoot whose name merely begins with
// publicRoot's name. Compare against publicRoot plus path.sep so the boundary is
// a real directory separator on every platform.
export function resolveStaticPath(
  publicRoot: string,
  reqPath: string,
  res: http.ServerResponse,
): string | null {
  const filePath = path.join(publicRoot, reqPath === '/' ? '/index.html' : reqPath);

  if (!filePath.startsWith(publicRoot + path.sep)) {
    res.writeHead(403);
    res.end('Forbidden');
    return null;
  }

  return filePath;
}

// The file response. A missing file is a plain-text 404 rather than JSON, and
// the CSP header rides on the 200 path only.
export function serveStaticFile(
  filePath: string,
  reqPath: string,
  res: http.ServerResponse,
): void {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found: ' + reqPath);
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Security-Policy': CSP,
    });
    res.end(data);
  });
}
