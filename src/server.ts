import http from 'node:http';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractPraxisData, hasPrxwork, ID_SUFFIX } from './lib/extract.js';
import { readProjects, findProject, addProject, removeProject, renameProject } from './lib/projects.js';
import { readBranch } from './lib/git.js';
import { extractWorkstreamDetail } from './lib/detail.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, 'public');
const port = process.env.PORT ? Number(process.env.PORT) : 4173;
const host = process.env.HOST || '127.0.0.1';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
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

// The POST body's only content is a filesystem path, so 8KB is roughly 10,000x
// the expected size — and it is the one unbounded input this server accepts.
const MAX_BODY_BYTES = 8192;

// The one place the display-name cap lives, so it can be widened in one edit.
const MAX_NAME_LENGTH = 100;

// Shape of a workstream id in a detail request, composed from ID_SUFFIX so this
// server and the extractor cannot disagree about what an id looks like. Hoisted
// here so it compiles once, not once per request. Both anchors are load-bearing:
// they are what make this a shape guard rather than a substring test.
const WORKSTREAM_ID = new RegExp(String.raw`^WS-\d+${ID_SUFFIX}$`);

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

function isLoopbackHost(candidate: string): boolean {
  return LOOPBACK_HOSTS.has(candidate);
}

// The extra hostnames this server answers to, beyond IP literals and `localhost`.
// Read once at module scope, exactly as `port` and `host` are above: a
// comma-separated list, trimmed and lowercased, with empty entries dropped.
const ALLOWED_HOSTS: ReadonlySet<string> = new Set(
  (process.env.ALLOWED_HOSTS ?? '')
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter((name) => name !== ''),
);

// The bare hostname from a Host header value, or null when the header is absent
// or unparseable. A WHATWG URL keeps the brackets on an IPv6 literal, so they
// are stripped here — otherwise `[::1]:4173` would never match net.isIP.
function hostnameOf(hostHeader: string | undefined): string | null {
  if (hostHeader === undefined) return null;
  try {
    const hostname = new URL('http://' + hostHeader).hostname;
    return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  } catch {
    return null;
  }
}

// Header-only request-origin validation: it knows nothing about routes, project
// ids, the registry, or the extractor. Returns true when the request may
// proceed; otherwise it writes its own 403 through sendJson and returns false.
// No Access-Control-Allow-* header is ever sent — sending none is the posture.
function passesOriginCheck(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  // Check one: the Host header. An absent or unparseable Host fails.
  const hostname = hostnameOf(req.headers.host);
  if (hostname === null || !(net.isIP(hostname) !== 0 || hostname === 'localhost' || ALLOWED_HOSTS.has(hostname))) {
    sendJson(res, 403, { error: 'Host header not allowed' });
    return false;
  }

  // Check two: the Origin header, when present. Compared against the RAW Host
  // header value so the port is part of the comparison. An absent Origin passes
  // — Electron's loopbackRequest sends none. `Origin: null` fails, because it
  // never equals `http://` plus a host.
  const origin = req.headers.origin;
  if (origin !== undefined && origin.toLowerCase() !== ('http://' + req.headers.host).toLowerCase()) {
    sendJson(res, 403, { error: 'Origin not allowed' });
    return false;
  }

  return true;
}

// True only when the header's media type is exactly application/json. Real
// requests attach parameters, so `application/json; charset=utf-8` must pass:
// the parameters are split off at the first semicolon before the comparison.
// An absent header returns false.
function isJsonContentType(header: string | undefined): boolean {
  if (header === undefined) return false;
  return header.split(';')[0].trim().toLowerCase() === 'application/json';
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

// Collects the request body, refusing anything over MAX_BODY_BYTES with a 413
// and destroying the request so the client stops streaming into a void. The log
// label is a parameter because more than one route reads a body: a hardcoded
// label would name the wrong method for every caller but the first.
function readRequestBody(
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

function handleAddProject(req: http.IncomingMessage, res: http.ServerResponse): void {
  readRequestBody(req, res, 'POST /api/projects — request stream error:', (raw) => {
    try {
      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        sendJson(res, 400, { error: 'Request body must be valid JSON of the form {"path": "/absolute/path"}' });
        return;
      }

      const candidate = (body as { path?: unknown } | null)?.path;
      if (typeof candidate !== 'string' || candidate.trim() === '') {
        sendJson(res, 400, { error: 'Missing `path` — send a JSON body of the form {"path": "/absolute/path"}' });
        return;
      }

      const input = candidate.trim();
      if (input.startsWith('~')) {
        sendJson(res, 400, { error: '~ is not expanded — enter the full absolute path instead' });
        return;
      }
      if (!path.isAbsolute(input)) {
        sendJson(res, 400, { error: 'Path must be absolute — enter a full path starting with /' });
        return;
      }
      if (!hasPrxwork(input)) {
        sendJson(res, 400, { error: `No prxwork/ folder found under ${input} — a project is a directory containing prxwork/` });
        return;
      }

      const { entry, created } = addProject(input);
      sendJson(res, created ? 201 : 200, { project: entry });
    } catch (err) {
      console.error('POST /api/projects failed:', err);
      sendJson(res, 500, { error: 'Could not write the project registry' });
    }
  });
}

// Validation lives here at the route boundary, never in the registry library,
// exactly as handleAddProject validates the path before addProject sees it. The
// trimmed value is what is length-checked and what is stored, so it is computed
// once and reused. The character class covers the C0 range (which includes \n,
// \r and \t), DEL, and the C1 range: a display name is a single line of text.
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/;

function handleRenameProject(req: http.IncomingMessage, res: http.ServerResponse, id: string): void {
  readRequestBody(req, res, `PATCH /api/projects/${id} — request stream error:`, (raw) => {
    try {
      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        sendJson(res, 400, { error: 'Request body must be valid JSON of the form {"name": "New name"}' });
        return;
      }

      const candidate = (body as { name?: unknown } | null)?.name;
      // typeof first: a `name` of 42 has no .trim() to call.
      if (typeof candidate !== 'string' || candidate.trim() === '') {
        sendJson(res, 400, { error: 'Missing `name` — send a JSON body of the form {"name": "New name"}' });
        return;
      }

      const name = candidate.trim();
      if (name.length > MAX_NAME_LENGTH) {
        sendJson(res, 400, { error: `Name must be ${MAX_NAME_LENGTH} characters or fewer` });
        return;
      }
      if (CONTROL_CHARS.test(name)) {
        sendJson(res, 400, { error: 'Name must be a single line of plain text' });
        return;
      }

      const entry = renameProject(id, name);
      if (!entry) {
        sendJson(res, 404, { error: `Unknown project ${id}` });
        return;
      }
      sendJson(res, 200, { project: entry });
    } catch (err) {
      console.error(`PATCH /api/projects/${id} failed:`, err);
      sendJson(res, 500, { error: 'Could not write the project registry' });
    }
  });
}

// Every branch below answers with JSON and swallows its own throws: an uncaught
// exception inside an http.createServer handler takes the whole process down.
function handleApi(req: http.IncomingMessage, res: http.ServerResponse, reqPath: string): void {
  const method = req.method ?? 'GET';

  // Above every route match, so no route added below can miss it, and before any
  // body is read, so readRequestBody never runs for a rejected request. 403, not
  // 415: one uniform rejection shape across every check at this boundary. GET
  // and DELETE carry no body and are left alone.
  if ((method === 'POST' || method === 'PATCH') && !isJsonContentType(req.headers['content-type'])) {
    sendJson(res, 403, { error: 'Content-Type must be application/json' });
    return;
  }

  if (reqPath === '/api/projects') {
    if (method === 'GET') {
      try {
        const list: ProjectList = { projects: readProjects() };
        sendJson(res, 200, list);
      } catch (err) {
        console.error('GET /api/projects failed:', err);
        sendJson(res, 500, { error: 'Could not read the project registry' });
      }
      return;
    }
    if (method === 'POST') {
      handleAddProject(req, res);
      return;
    }
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  // End-anchored on purpose: without the $ this pattern would also swallow
  // /api/projects/<id>/data and the .../workstreams/.../detail route below.
  const entryMatch = reqPath.match(/^\/api\/projects\/([^/]+)$/);
  if (entryMatch) {
    const id = entryMatch[1];
    if (method === 'DELETE') {
      // The id is only ever compared against strings already in the registry and
      // never becomes a filesystem path, so it needs no shape check — the same
      // reasoning the .../data route already relies on.
      try {
        const entry = removeProject(id);
        if (!entry) {
          sendJson(res, 404, { error: `Unknown project ${id}` });
          return;
        }
        sendJson(res, 200, { deleted: entry });
      } catch (err) {
        console.error(`DELETE /api/projects/${id} failed:`, err);
        sendJson(res, 500, { error: 'Could not write the project registry' });
      }
      return;
    }
    if (method === 'PATCH') {
      handleRenameProject(req, res, id);
      return;
    }
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const dataMatch = reqPath.match(/^\/api\/projects\/([^/]+)\/data$/);
  if (dataMatch) {
    if (method !== 'GET') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }
    const id = dataMatch[1];
    try {
      const entry = findProject(id);
      if (!entry) {
        sendJson(res, 404, { error: `Unknown project ${id}` });
        return;
      }
      if (!hasPrxwork(entry.path)) {
        sendJson(res, 410, { error: `${entry.path} no longer contains a prxwork/ folder` });
        return;
      }
      const payload: BoardPayload = { ...extractPraxisData(entry.path), branch: readBranch(entry.path) };
      sendJson(res, 200, payload);
    } catch (err) {
      console.error(`GET /api/projects/${id}/data failed:`, err);
      sendJson(res, 500, { error: 'Extraction failed' });
    }
    return;
  }

  const detailMatch = reqPath.match(/^\/api\/projects\/([^/]+)\/workstreams\/([^/]+)\/detail$/);
  if (detailMatch) {
    if (method !== 'GET') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }
    const id = detailMatch[1];
    const wsId = detailMatch[2];
    // Shape check before any filesystem work: reqPath is already
    // decodeURIComponent'd, so a decoded single segment such as `../etc` reaches
    // here and is rejected on shape rather than on where it would have pointed.
    if (!WORKSTREAM_ID.test(wsId)) {
      sendJson(res, 400, { error: `Malformed workstream id ${wsId}` });
      return;
    }
    try {
      const entry = findProject(id);
      if (!entry) {
        sendJson(res, 404, { error: `Unknown project ${id}` });
        return;
      }
      if (!hasPrxwork(entry.path)) {
        sendJson(res, 410, { error: `${entry.path} no longer contains a prxwork/ folder` });
        return;
      }
      const detail = extractWorkstreamDetail(entry.path, wsId);
      if (!detail) {
        sendJson(res, 404, { error: `Unknown workstream ${wsId}` });
        return;
      }
      sendJson(res, 200, detail);
    } catch (err) {
      console.error(`GET /api/projects/${id}/workstreams/${wsId}/detail failed:`, err);
      sendJson(res, 500, { error: 'Detail extraction failed' });
    }
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
}

const server = http.createServer((req, res) => {
  // req.url is string | undefined under @types/node but always set here; assert, don't fall back.
  const reqPath = decodeURIComponent(req.url!.split('?')[0]);

  // Before the traversal check, so every route is covered — static files included.
  if (!passesOriginCheck(req, res)) return;

  let filePath = path.join(root, reqPath === '/' ? '/index.html' : reqPath);

  // Prevent path traversal outside public/. path.join has already collapsed any
  // '..', so the only remaining gap is a bare prefix match: a sibling of root
  // whose name merely begins with root's name. Compare against root plus
  // path.sep so the boundary is a real directory separator on every platform.
  if (!filePath.startsWith(root + path.sep)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (reqPath.startsWith('/api/')) {
    try {
      handleApi(req, res, reqPath);
    } catch (err) {
      console.error(`${req.method} ${reqPath} failed:`, err);
      sendJson(res, 500, { error: 'Internal server error' });
    }
    return;
  }

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
});

// Readiness and the bound port are one fact, so one export carries both: it
// resolves with the port the socket actually bound and rejects with whatever
// the 'error' listener receives. The listen call still runs as this module's
// startup side effect — the executor below runs synchronously on module
// evaluation — so `npm start` behaves exactly as it did without this export.
export const serverReady: Promise<number> = new Promise<number>((resolve, reject) => {
  // Without this listener an EADDRINUSE (or an EACCES on a privileged port, or
  // any other bind failure) becomes an uncaught exception in whichever process
  // imported this module. Not narrowed to one code, because any of them means
  // the same thing here: this server never started.
  server.on('error', (err) => {
    console.error(`Praxis Dashboard could not bind ${host}:${port}:`, err);
    reject(err);
  });

  server.listen(port, host, () => {
    // Read back rather than reported from `port`: when PORT is 0 the OS picks
    // an ephemeral port, and address() is null until the socket is listening,
    // which is why this can only be read from inside this callback.
    const address = server.address();
    resolve(typeof address === 'object' && address !== null ? address.port : port);

    console.log(`Praxis Dashboard running at http://${host}:${port}`);
    if (!isLoopbackHost(host)) {
      console.warn(
        `WARNING: bound to ${host}, which is not loopback-only — this dashboard is now ` +
        `reachable from other devices on the network. There is no authentication: any ` +
        `device that can reach ${host}:${port} can read every registered project's ` +
        `prxwork/ content and can add, rename, or remove project registry entries. ` +
        `Registered project paths are resolved on THIS machine's filesystem regardless ` +
        `of which machine's browser makes the request.`
      );
    }
  });
});

// `npm start` imports nothing and awaits nothing, so a bind failure would raise
// an unhandled rejection on top of the error listener's own report. The failure
// is already surfaced there; this only marks the rejection as observed.
serverReady.catch(() => {});
