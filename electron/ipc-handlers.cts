// Main-process IPC bridge: relays window.praxisAPI.* calls (exposed by
// preload.cts) to src/server.ts's existing /api/* HTTP routes via a loopback
// request to SERVER_URL. No validation logic lives here — every rule (path/
// tilde/absolute, name length/control-chars, WORKSTREAM_ID shape) keeps
// running exactly where it runs today, inside server.ts, exercised as an
// ordinary HTTP request from server.ts's point of view.

import { ipcMain } from 'electron';
import http from 'node:http';
import { SERVER_URL } from './main.cjs';

export type PraxisIpcResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string };

function loopbackRequest<T>(
  method: string,
  urlPath: string,
  body?: unknown
): Promise<PraxisIpcResult<T>> {
  return new Promise((resolve) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const target = new URL(urlPath, SERVER_URL);

    const req = http.request(
      target,
      {
        method,
        headers: payload
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            }
          : undefined,
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          raw += chunk;
        });
        res.on('end', () => {
          const status = res.statusCode ?? 0;
          let parsed: unknown;
          try {
            parsed = raw ? JSON.parse(raw) : undefined;
          } catch (err) {
            resolve({
              ok: false,
              status,
              error: err instanceof Error ? err.message : String(err),
            });
            return;
          }
          if (status < 400) {
            resolve({ ok: true, status, data: parsed as T });
          } else {
            const errorMessage =
              parsed && typeof parsed === 'object' && 'error' in parsed
                ? String((parsed as { error: unknown }).error)
                : `HTTP ${status}`;
            resolve({ ok: false, status, error: errorMessage });
          }
        });
      }
    );

    req.on('error', (err) => {
      resolve({ ok: false, status: 0, error: err.message });
    });

    if (payload !== undefined) {
      req.write(payload);
    }
    req.end();
  });
}

export function registerIpcHandlers(): void {
  ipcMain.handle('listProjects', () => loopbackRequest('GET', '/api/projects'));

  ipcMain.handle('addProject', (_event, projectPath: string) =>
    loopbackRequest('POST', '/api/projects', { path: projectPath })
  );

  ipcMain.handle('renameProject', (_event, id: string, name: string) =>
    loopbackRequest('PATCH', `/api/projects/${encodeURIComponent(id)}`, { name })
  );

  ipcMain.handle('removeProject', (_event, id: string) =>
    loopbackRequest('DELETE', `/api/projects/${encodeURIComponent(id)}`)
  );

  ipcMain.handle('getProjectData', (_event, id: string) =>
    loopbackRequest('GET', `/api/projects/${encodeURIComponent(id)}/data`)
  );

  ipcMain.handle('getWorkstreamDetail', (_event, id: string, wsId: string) =>
    loopbackRequest(
      'GET',
      `/api/projects/${encodeURIComponent(id)}/workstreams/${encodeURIComponent(wsId)}/detail`
    )
  );
}
