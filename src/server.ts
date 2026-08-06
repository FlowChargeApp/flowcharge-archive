import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractPraxisData, hasPrxwork } from './lib/extract.js';
import { readProjects, findProject, addProject } from './lib/projects.js';
import { extractWorkstreamDetail } from './lib/detail.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, 'public');
const port = process.env.PORT ? Number(process.env.PORT) : 4173;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// The POST body's only content is a filesystem path, so 8KB is roughly 10,000x
// the expected size — and it is the one unbounded input this server accepts.
const MAX_BODY_BYTES = 8192;

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

// Collects the request body, refusing anything over MAX_BODY_BYTES with a 413
// and destroying the request so the client stops streaming into a void.
function readRequestBody(
  req: http.IncomingMessage,
  res: http.ServerResponse,
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
    console.error('POST /api/projects — request stream error:', err);
    sendJson(res, 400, { error: 'Could not read the request body' });
  });
}

function handleAddProject(req: http.IncomingMessage, res: http.ServerResponse): void {
  readRequestBody(req, res, (raw) => {
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
      sendJson(res, 200, extractPraxisData(entry.path));
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
    if (!/^WS-\d+$/.test(wsId)) {
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

server.listen(port, '127.0.0.1', () => {
  console.log(`Praxis Dashboard running at http://localhost:${port}`);
});
