// Shared renderer-side adapter for window.praxisAPI, the six-channel IPC
// surface electron/preload.cts exposes via contextBridge. Declared at file
// scope with no import/export keyword, exactly like src/types/praxis-data.d.ts
// — adding either here would turn this file into a module and these
// declarations would stop being global, which src/public/tsconfig.json's
// module: "none" setting is specifically configured to reject at compile time.

type PraxisIpcResult<T> =
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

function unwrapIpc<T>(result: PraxisIpcResult<T>): T {
  if (!result.ok) {
    throw httpError(result.status, result.error);
  }
  return result.data;
}

interface PraxisAPI {
  listProjects(): Promise<PraxisIpcResult<ProjectList>>;
  addProject(path: string): Promise<PraxisIpcResult<{ project: ProjectEntry }>>;
  renameProject(id: string, name: string): Promise<PraxisIpcResult<{ project: ProjectEntry }>>;
  removeProject(id: string): Promise<PraxisIpcResult<{ deleted: ProjectEntry }>>;
  getProjectData(id: string): Promise<PraxisIpcResult<BoardPayload>>;
  getWorkstreamDetail(id: string, wsId: string): Promise<PraxisIpcResult<PraxisWorkstreamDetail>>;
  getAppVersion(): Promise<string | null>;
  pickProjectFolder?(): Promise<string | null>;
}

interface Window {
  praxisAPI: PraxisAPI;
}
