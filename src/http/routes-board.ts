// The two board routes: the project's board payload and one workstream's
// detail. Both reach the markdown tree only through the injected BoardApi, so
// this module imports none of the four markdown-tree libraries.

import type http from 'node:http';
import { sendJson } from './json.js';
import type { BoardApi } from '../ports/app-api.js';

// One greppable line per legacy resolution, printed at the route boundary. The
// printing lives here and never in src/lib/ or src/core/, which return facts and
// log nothing: the core hands back the legacy directory, and this decides the
// wording. There is deliberately NO seen-set and no cross-request dedupe: the
// line exists to show whether the fallback is still load-bearing, and a
// suppressed repeat would hide exactly that.
export function warnLegacyLayout(legacyLayoutDir: string | null): void {
  if (legacyLayoutDir !== null) {
    console.warn(
      `LEGACY LAYOUT: ${legacyLayoutDir} uses prxwork/ — rename it to flowcharge/; ` +
      `support for the old name will be removed`
    );
  }
}

// Answers true when it handled the request, false when the path is not one of
// this module's two routes and the dispatcher should keep looking.
//
// The workstream-id shape pattern arrives as a parameter. It is composed from
// the extractor's own ID_SUFFIX so this server and the extractor cannot disagree
// about what an id looks like, and it is built once at module scope in the
// composition root — src/http/ may not import the extractor module, so the pattern
// crosses the boundary rather than the constant it is built from. Both anchors
// are load-bearing: they are what make it a shape guard rather than a substring
// test.
export function handleBoardRoutes(
  res: http.ServerResponse,
  reqPath: string,
  method: string,
  api: BoardApi,
  workstreamId: RegExp,
): boolean {
  const dataMatch = reqPath.match(/^\/api\/projects\/([^/]+)\/data$/);
  if (dataMatch) {
    if (method !== 'GET') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return true;
    }
    const id = dataMatch[1];
    try {
      const result = api.getBoard(id);
      if (result.kind === 'unknown-project') {
        sendJson(res, 404, { error: `Unknown project ${id}` });
        return true;
      }
      if (result.kind === 'tree-missing') {
        sendJson(res, 410, { error: `${result.path} no longer contains a flowcharge/ or prxwork/ folder` });
        return true;
      }
      warnLegacyLayout(result.legacyLayoutDir);
      const payload: BoardPayload = result.payload;
      sendJson(res, 200, payload);
    } catch (err) {
      console.error(`GET /api/projects/${id}/data failed:`, err);
      sendJson(res, 500, { error: 'Extraction failed' });
    }
    return true;
  }

  const detailMatch = reqPath.match(/^\/api\/projects\/([^/]+)\/workstreams\/([^/]+)\/detail$/);
  if (detailMatch) {
    if (method !== 'GET') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return true;
    }
    const id = detailMatch[1];
    const wsId = detailMatch[2];
    // Shape check before any filesystem work: reqPath is already
    // decodeURIComponent'd, so a decoded single segment such as `../etc` reaches
    // here and is rejected on shape rather than on where it would have pointed.
    if (!workstreamId.test(wsId)) {
      sendJson(res, 400, { error: `Malformed workstream id ${wsId}` });
      return true;
    }
    try {
      const result = api.getDetail(id, wsId);
      if (result.kind === 'unknown-project') {
        sendJson(res, 404, { error: `Unknown project ${id}` });
        return true;
      }
      if (result.kind === 'tree-missing') {
        sendJson(res, 410, { error: `${result.path} no longer contains a flowcharge/ or prxwork/ folder` });
        return true;
      }
      if (result.kind === 'unknown-workstream') {
        sendJson(res, 404, { error: `Unknown workstream ${wsId}` });
        return true;
      }
      warnLegacyLayout(result.legacyLayoutDir);
      sendJson(res, 200, result.detail);
    } catch (err) {
      console.error(`GET /api/projects/${id}/workstreams/${wsId}/detail failed:`, err);
      sendJson(res, 500, { error: 'Detail extraction failed' });
    }
    return true;
  }

  return false;
}
