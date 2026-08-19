// Plain-browser-tab fallback for window.praxisAPI. electron/preload.cts injects
// window.praxisAPI via contextBridge only inside an Electron BrowserWindow; a
// plain browser tab loading index.html/board.html over src/server.ts's HTTP
// server has no such global. This file defines the same six-method surface,
// backed by fetch() against the existing /api/* routes, but installs itself
// only when window.praxisAPI is not already present — checked once here at
// script-load time, never per-call. In Electron, preload.cts's
// contextBridge.exposeInMainWorld call runs before this script, so the guard
// below is a no-op there. No import/export keyword, exactly like
// ipc-adapter.ts — this file relies on that file's ambient, file-scope
// declarations (PraxisIpcResult<T>, PraxisAPI, Window.praxisAPI) being visible
// in the same global scope, per src/public/tsconfig.json's module: "none".

function fetchIpc<T>(method: string, urlPath: string, body?: unknown): Promise<PraxisIpcResult<T>> {
  var init: RequestInit = body === undefined
    ? { method: method }
    : { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };

  return fetch(urlPath, init)
    .then(function (res) {
      return res.text().then(function (raw) {
        var status = res.status;
        var parsed: unknown;
        try {
          parsed = raw ? JSON.parse(raw) : undefined;
        } catch (err) {
          return { ok: false, status: status, error: err instanceof Error ? err.message : String(err) } as PraxisIpcResult<T>;
        }
        if (status < 400) {
          return { ok: true, status: status, data: parsed as T } as PraxisIpcResult<T>;
        }
        var errorMessage =
          parsed && typeof parsed === 'object' && 'error' in parsed
            ? String((parsed as { error: unknown }).error)
            : 'HTTP ' + status;
        return { ok: false, status: status, error: errorMessage } as PraxisIpcResult<T>;
      });
    })
    .catch(function (err) {
      // A rejected fetch() (network failure, server unreachable, aborted) still
      // resolves — never rejects — exactly like loopbackRequest()'s req.on('error').
      return { ok: false, status: 0, error: err instanceof Error ? err.message : String(err) } as PraxisIpcResult<T>;
    });
}

if (!window.praxisAPI) {
  window.praxisAPI = {
    listProjects: function () {
      return fetchIpc('GET', '/api/projects');
    },
    addProject: function (path) {
      return fetchIpc('POST', '/api/projects', { path: path });
    },
    renameProject: function (id, name) {
      return fetchIpc('PATCH', '/api/projects/' + encodeURIComponent(id), { name: name });
    },
    removeProject: function (id) {
      return fetchIpc('DELETE', '/api/projects/' + encodeURIComponent(id));
    },
    getProjectData: function (id) {
      return fetchIpc('GET', '/api/projects/' + encodeURIComponent(id) + '/data');
    },
    getWorkstreamDetail: function (id, wsId) {
      return fetchIpc(
        'GET',
        '/api/projects/' + encodeURIComponent(id) + '/workstreams/' + encodeURIComponent(wsId) + '/detail'
      );
    },
  };
}
