// The HTTP adapter's assembly point. createHttpServer builds the server from an
// injected configuration and returns it. It never binds a socket, never reads
// the environment, and never ends the process — the composition root owns all
// three.
//
// The request pipeline order below is load-bearing and is preserved exactly:
// origin check, then the static traversal boundary, then the /api/ dispatch,
// then the Content-Type check, then the loopback peer gate on
// /api/integrations/, which now lives at the top of
// src/http/routes-integrations.ts. src/test/boundary/server-guards.test.ts is
// the gate on that order.

import http from 'node:http';

import { sendJson } from './json.js';
import { passesOriginCheck, isJsonContentType } from './guards.js';
import { resolveStaticPath, serveStaticFile } from './static-files.js';
import { handleProjectRoutes } from './routes-projects.js';
import { handleBoardRoutes } from './routes-board.js';
import { handleIntegrationsRoutes } from './routes-integrations.js';

import type { BoardApi } from '../ports/app-api.js';
import type { IntegrationsDeps } from './routes-integrations.js';

export type { IntegrationsDeps };

export interface HttpServerConfig {
  api: BoardApi;
  integrations: IntegrationsDeps;
  publicRoot: string;
  allowedHosts: ReadonlySet<string>;
  appVersion: string | null;
  // The workstream-id shape pattern, built once in the composition root from the
  // extractor's ID_SUFFIX. It arrives as configuration because src/http/ may not
  // import the extractor module. See the task list's tasks 5.5 and 5.6 self_eval.
  workstreamIdPattern: RegExp;
}

export function createHttpServer(config: HttpServerConfig): http.Server {
  const { api, integrations, publicRoot, allowedHosts, appVersion, workstreamIdPattern } = config;

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

    if (handleProjectRoutes(req, res, reqPath, method, api)) return;
    if (handleBoardRoutes(res, reqPath, method, api, workstreamIdPattern)) return;

    if (reqPath === '/api/version' && method === 'GET') {
      if (appVersion === null) {
        sendJson(res, 500, { error: 'Could not read the app version' });
        return;
      }
      sendJson(res, 200, { version: appVersion });
      return;
    }

    // Returns false for an unmatched /api/integrations/ path, so it still falls
    // through to the 404 below rather than being answered from inside the
    // integrations module.
    if (handleIntegrationsRoutes(req, res, reqPath, method, integrations)) return;

    sendJson(res, 404, { error: 'Not found' });
  }

  return http.createServer((req, res) => {
    // req.url is string | undefined under @types/node but always set here; assert, don't fall back.
    const reqPath = decodeURIComponent(req.url!.split('?')[0]);

    // Before the traversal check, so every route is covered — static files included.
    if (!passesOriginCheck(req, res, allowedHosts)) return;

    // Prevent path traversal outside public/. Applied to every request, api
    // routes included, exactly as it was before the split.
    const filePath = resolveStaticPath(publicRoot, reqPath, res);
    if (filePath === null) return;

    if (reqPath.startsWith('/api/')) {
      try {
        handleApi(req, res, reqPath);
      } catch (err) {
        console.error(`${req.method} ${reqPath} failed:`, err);
        sendJson(res, 500, { error: 'Internal server error' });
      }
      return;
    }

    serveStaticFile(filePath, reqPath, res);
  });
}
