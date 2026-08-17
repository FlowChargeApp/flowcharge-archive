import http from 'node:http';
import fs from 'node:fs';
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
  let filePath = path.join(root, reqPath === '/' ? '/index.html' : reqPath);

  // Prevent path traversal outside public/
  if (!filePath.startsWith(root)) {
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
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(port, host, () => {
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
