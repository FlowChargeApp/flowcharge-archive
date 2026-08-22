// Shared renderer-side adapter for window.praxisAPI, the six-channel IPC
// surface electron/preload.cts exposes via contextBridge. This file is an ES
// module. Its published surface — PraxisIpcResult, unwrapIpc and PraxisAPI —
// is consumed by home.ts, app.ts and browser-ipc-shim.ts, which reach it by
// import rather than through a shared global scope. The Window augmentation
// sits inside a global-augmentation block for that same reason: a bare
// top-level `interface Window` in a module is a local interface and never
// merges with the Window that lib.dom.d.ts declares.

export type PraxisIpcResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string };

// Carries the HTTP status alongside the message, so a caller can tell one failure
// status from another. A rejected fetch chain otherwise arrives as a bare Error and
// the status is lost by the time the .catch runs.
function httpError(status: number, message: string): Error & { status: number } {
  var err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

export function unwrapIpc<T>(result: PraxisIpcResult<T>): T {
  if (!result.ok) {
    throw httpError(result.status, result.error);
  }
  return result.data;
}

export interface PraxisAPI {
  listProjects(): Promise<PraxisIpcResult<ProjectList>>;
  addProject(path: string): Promise<PraxisIpcResult<{ project: ProjectEntry }>>;
  renameProject(id: string, name: string): Promise<PraxisIpcResult<{ project: ProjectEntry }>>;
  removeProject(id: string): Promise<PraxisIpcResult<{ deleted: ProjectEntry }>>;
  getProjectData(id: string): Promise<PraxisIpcResult<BoardPayload>>;
  getWorkstreamDetail(id: string, wsId: string): Promise<PraxisIpcResult<PraxisWorkstreamDetail>>;
  getAppVersion(): Promise<string | null>;
  pickProjectFolder?(): Promise<string | null>;
}

declare global {
  interface Window {
    praxisAPI: PraxisAPI;
  }
}
