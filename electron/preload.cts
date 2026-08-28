// This file is the preload script, wired via webPreferences.preload by
// main.cts. It exposes a narrow, typed window.praxisAPI surface to the
// renderer via contextBridge, forwarding each call straight to the matching
// ipcMain.handle channel registered by electron/ipc-handlers.cts. No
// adapter or error-translation logic lives here — each wrapper only
// forwards the raw PraxisIpcResult promise.

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('praxisAPI', {
  listProjects: () => ipcRenderer.invoke('listProjects'),
  addProject: (path: string) => ipcRenderer.invoke('addProject', path),
  renameProject: (id: string, name: string) => ipcRenderer.invoke('renameProject', id, name),
  removeProject: (id: string) => ipcRenderer.invoke('removeProject', id),
  getProjectData: (id: string) => ipcRenderer.invoke('getProjectData', id),
  getWorkstreamDetail: (id: string, wsId: string) =>
    ipcRenderer.invoke('getWorkstreamDetail', id, wsId),
  pickProjectFolder: (): Promise<string | null> => ipcRenderer.invoke('pickProjectFolder'),
  getAppVersion: (): Promise<string | null> => ipcRenderer.invoke('getAppVersion'),
});

// A second, distinct global from praxisAPI above — kept decoupled rather
// than folded into praxisAPI's object literal, per PLN-32-m51bp8's own
// Alternatives considered, so the two concerns' preload wiring stays fully
// separate. Forwards each call straight to the matching ipcMain.handle
// channel registered by electron/agentic-tools-ipc-handlers.cts.
contextBridge.exposeInMainWorld('praxisSkillInstallAPI', {
  installSelected: (targets: unknown) => ipcRenderer.invoke('installSelected', targets),
  getInstallStatus: () => ipcRenderer.invoke('getInstallStatus'),
  removeInstallation: (toolId: string, scope: unknown) =>
    ipcRenderer.invoke('removeInstallation', toolId, scope),
  detectTools: () => ipcRenderer.invoke('detectTools'),
  checkInstalledSkills: (target: unknown) => ipcRenderer.invoke('checkInstalledSkills', target),
});

// A third, distinct global, for a third distinct concern — following the
// precedent the praxisSkillInstallAPI block above set rather than folding
// these methods into praxisAPI's object literal. Forwards each call straight
// to the matching ipcMain.handle channel registered by
// electron/update-check-ipc-handlers.cts. Every wrapper takes no parameter and
// forwards none: the renderer cannot steer the check, the dismissal, or the
// URL that is opened.
contextBridge.exposeInMainWorld('praxisUpdateAPI', {
  getUpdateNotice: () => ipcRenderer.invoke('getUpdateNotice'),
  dismissUpdate: () => ipcRenderer.invoke('dismissUpdate'),
  disableUpdateChecks: () => ipcRenderer.invoke('disableUpdateChecks'),
  openReleasePage: () => ipcRenderer.invoke('openReleasePage'),
});

// A fourth, distinct global, for a fourth distinct concern — following the
// precedent the praxisSkillInstallAPI and praxisUpdateAPI blocks above set
// rather than folding this method into praxisAPI's object literal. Forwards
// the call straight to the matching ipcMain.handle channel registered by
// electron/theme-ipc-handlers.cts, with no error translation, exactly as every
// other block in this file does.
contextBridge.exposeInMainWorld('praxisThemeAPI', {
  setThemeSource: (mode: string): Promise<void> => ipcRenderer.invoke('setThemeSource', mode),
});
