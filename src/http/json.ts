// The transport primitives every route in src/http/ answers through: the JSON
// writer, the bounded request-body reader, the body-size cap, and the wording an
// unexpected throw becomes. Knows node:http types only — no filesystem, no
// environment reads, no routes.

import type http from 'node:http';

// The POST body's only content is a filesystem path, so 8KB is roughly 10,000x
// the expected size — and it is the one unbounded input this server accepts.
export const MAX_BODY_BYTES = 8192;

export function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

// Collects the request body, refusing anything over MAX_BODY_BYTES with a 413
// and destroying the request so the client stops streaming into a void. The log
// label is a parameter because more than one route reads a body: a hardcoded
// label would name the wrong method for every caller but the first.
export function readRequestBody(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  logLabel: string,
  onBody: (raw: string) => void,
): void {
  const chunks: Buffer[] = [];
  let size = 0;
  let settled = false;

  req.on('data', (chunk: Buffer) => {
    if (settled) return;
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      settled = true;
      sendJson(res, 413, { error: 'Request body too large' });
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });

  req.on('end', () => {
    if (settled) return;
    settled = true;
    onBody(Buffer.concat(chunks).toString('utf8'));
  });

  req.on('error', (err) => {
    if (settled) return;
    settled = true;
    console.error(logLabel, err);
    sendJson(res, 400, { error: 'Could not read the request body' });
  });
}

// The wording every integrations route uses for an unexpected throw: the
// error's own message, matching what the Electron channels put in their failed
// PraxisIpcResult.
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
