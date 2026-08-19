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
});
