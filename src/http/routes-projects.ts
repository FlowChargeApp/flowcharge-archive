// The project registry routes: /api/projects and /api/projects/:id. Every
// registry read and write goes through the injected BoardApi — this module
// never imports the registry adapter.
//
// Every string-shape rule stays here at the route boundary: the trim, the ~
// refusal, path.isAbsolute, MAX_NAME_LENGTH and CONTROL_CHARS.

import type http from 'node:http';
import path from 'node:path';
import { sendJson, readRequestBody } from './json.js';
import { MAX_NAME_LENGTH, CONTROL_CHARS } from './guards.js';
// The LEGACY LAYOUT warn line lives with the board routes, which are its main
// caller; the add-project route prints the same line for the same fact.
import { warnLegacyLayout } from './routes-board.js';
import type { BoardApi } from '../ports/app-api.js';

function handleAddProject(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  api: BoardApi,
): void {
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
      const result = api.addProject(input);
      if (result.kind === 'no-tree') {
        sendJson(res, 400, { error: `No flowcharge/ folder found under ${result.path} — a project is a directory containing flowcharge/ (a legacy prxwork/ folder is still accepted)` });
        return;
      }
      warnLegacyLayout(result.legacyLayoutDir);
      sendJson(res, result.created ? 201 : 200, { project: result.entry });
    } catch (err) {
      console.error('POST /api/projects failed:', err);
      sendJson(res, 500, { error: 'Could not write the project registry' });
    }
  });
}

function handleRenameProject(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  id: string,
  api: BoardApi,
): void {
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

      const entry = api.renameProject(id, name);
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

// Answers true when it handled the request, false when the path is not one of
// this module's two routes and the dispatcher should keep looking.
export function handleProjectRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  reqPath: string,
  method: string,
  api: BoardApi,
): boolean {
  if (reqPath === '/api/projects') {
    if (method === 'GET') {
      try {
        const list: ProjectList = { projects: api.listProjects() };
        sendJson(res, 200, list);
      } catch (err) {
        console.error('GET /api/projects failed:', err);
        sendJson(res, 500, { error: 'Could not read the project registry' });
      }
      return true;
    }
    if (method === 'POST') {
      handleAddProject(req, res, api);
      return true;
    }
    sendJson(res, 405, { error: 'Method not allowed' });
    return true;
  }

  // End-anchored on purpose: without the $ this pattern would also swallow
  // /api/projects/<id>/data and the .../workstreams/.../detail route below it.
  const entryMatch = reqPath.match(/^\/api\/projects\/([^/]+)$/);
  if (entryMatch) {
    const id = entryMatch[1];
    if (method === 'DELETE') {
      // The id is only ever compared against strings already in the registry and
      // never becomes a filesystem path, so it needs no shape check — the same
      // reasoning the .../data route already relies on.
      try {
        const entry = api.removeProject(id);
        if (!entry) {
          sendJson(res, 404, { error: `Unknown project ${id}` });
          return true;
        }
        sendJson(res, 200, { deleted: entry });
      } catch (err) {
        console.error(`DELETE /api/projects/${id} failed:`, err);
        sendJson(res, 500, { error: 'Could not write the project registry' });
      }
      return true;
    }
    if (method === 'PATCH') {
      handleRenameProject(req, res, id, api);
      return true;
    }
    sendJson(res, 405, { error: 'Method not allowed' });
    return true;
  }

  return false;
}
