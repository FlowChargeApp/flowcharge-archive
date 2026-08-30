// Plain-browser-tab fallback for window.praxisAPI. electron/preload.cts injects
// window.praxisAPI via contextBridge only inside an Electron BrowserWindow; a
// plain browser tab loading index.html/board.html over src/server.ts's HTTP
// server has no such global. This file defines the same six-method surface,
// backed by fetch() against the existing /api/* routes, but installs itself
// only when window.praxisAPI is not already present — checked once here at
// script-load time, never per-call. In Electron, preload.cts's
// contextBridge.exposeInMainWorld call runs before this script, so the guard
// below is a no-op there. This file is a module, and it takes only a type from
// ipc-adapter — PraxisIpcResult<T>, imported with the `type` modifier — so it
// carries no runtime dependency on that module. Window.praxisAPI is typed by
// ipc-adapter's `declare global` block, which applies program-wide and needs no
// import here. Both entry files, home.ts and app.ts, import this module first,
// so the guard below runs before any page code touches window.praxisAPI.
//
// This file now installs TWO guarded surfaces: window.praxisAPI over /api/*, and
// window.praxisSkillInstallAPI over /api/integrations/*. Each one installs itself
// only when the global is absent. In Electron, preload.cts runs before this script
// and injects both, so both guards are no-ops there. The second surface's type
// reaches this file through lib/agentic-tools-api.ts's `declare global` block,
// which applies program-wide and needs no import here.

import type { PraxisIpcResult } from './ipc-adapter';

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
    getAppVersion: function () {
      // No .catch: fetchIpc already resolves rather than rejects on a network
      // failure, so the ok test alone covers every failure path.
      return fetchIpc<{ version: string }>('GET', '/api/version').then(function (result) {
        return result.ok ? result.data.version : null;
      });
    },
  };
}

if (!window.praxisSkillInstallAPI) {
  window.praxisSkillInstallAPI = {
    detectTools: function () {
      return fetchIpc('GET', '/api/integrations/tools');
    },
    installSelected: function (targets) {
      return fetchIpc('POST', '/api/integrations/installs', { targets: targets });
    },
    getInstallStatus: function () {
      return fetchIpc('GET', '/api/integrations/installs');
    },
    removeInstallation: function (toolId, scope) {
      return fetchIpc('POST', '/api/integrations/installs/remove', { toolId: toolId, scope: scope });
    },
    checkInstalledSkills: function (target) {
      return fetchIpc('POST', '/api/integrations/skill-presence', target);
    },
  };
}
