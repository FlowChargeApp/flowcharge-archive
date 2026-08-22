// Electron main process: brings up the already-compiled HTTP server and
// opens a BrowserWindow pointed at it. This file starts the server module
// and awaits the port that server reports binding — it has no knowledge of the project
// data the server reads or the endpoints it exposes, and no awareness of
// the board's data model. IPC bridging (contextBridge) is WS-37's job, not
// this file's.

import { app, BrowserWindow, dialog } from 'electron';
import path from 'node:path';
import { registerIpcHandlers } from './ipc-handlers.cjs';
import { registerAgenticToolsIpcHandlers } from './agentic-tools-ipc-handlers.cjs';
import { registerUpdateCheckIpcHandlers } from './update-check-ipc-handlers.cjs';

// The URL of the server this process itself started, on the ephemeral port that
// server reported binding — never a compile-time guess about who answers on a
// fixed port. Empty until app.whenReady() below learns the port. Every reader
// runs after that assignment: ipc-handlers.cts's loopback relay resolves this
// per request, and createWindow takes the URL as an argument.
export let SERVER_URL = '';

function createWindow(url: string): void {
  const mainWindow = new BrowserWindow({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  mainWindow.loadURL(url);
}

app.whenReady().then(async () => {
  // Dynamically import the compiled server module — a plain import() of an
  // ESM module from CommonJS code (Node supports this), not a require().
  // The import's module-evaluation side effect (src/server.ts:347) is
  // server.listen(port, host, ...); no exported start function exists or
  // is added here. The module's `serverReady` export reports the outcome of
  // that listen, which is what this callback awaits below.
  //
  // TypeScript's CommonJS output rewrites a literal `import(...)` call into
  // a require()-based helper (`Promise.resolve().then(() => require(...))`),
  // which throws ERR_REQUIRE_ESM against dist/server.js — that file is
  // emitted as ESM because the root package.json sets "type": "module".
  // Routing the call through `new Function` hides the import() syntax from
  // tsc's downlevel transform, so this stays a genuine native dynamic
  // import at runtime, which Node's CommonJS main process can use to load
  // an ESM module.
  // Mirrors src/lib/projects.ts's own PRAXIS_DATA_DIR read: only this
  // packaged-vs-not check belongs here, because only Electron's main process
  // knows app.isPackaged. Unset in `npm run electron:dev` (app.isPackaged is
  // false there), so dev Electron behaves exactly as it does today.
  if (app.isPackaged) {
    process.env.PRAXIS_DATA_DIR = app.getPath('userData');
  }

  // Ask the OS for a private, ephemeral port instead of a fixed one another
  // process may already hold. Mirrors the PRAXIS_DATA_DIR block above: only
  // this process knows it wants a port of its own, and src/server.ts's
  // `process.env.PORT ? ... : 4173` read is already the seam for saying so.
  // This must be set BEFORE the import below, because that module reads PORT
  // at evaluation time and listens immediately. It affects only this process,
  // so plain `npm start` keeps its 4173 default.
  process.env.PORT = '0';

  const dynamicImport = new Function('specifier', 'return import(specifier)') as (
    specifier: string
  ) => Promise<unknown>;
  // Local hand-written shape, never an `import type` from src/server.ts: this
  // file's rootDir cannot reach that tree (see the compatibility note above).
  const serverModule = (await dynamicImport('../server.js')) as {
    serverReady: Promise<number>;
  };

  let boundPort: number;
  try {
    // Awaiting this app's own server's readiness, rather than polling a port
    // and treating any answer as proof: the process that resolves this promise
    // is by construction the server this process just started.
    boundPort = await serverModule.serverReady;
  } catch (err) {
    dialog.showErrorBox(
      'Praxis Dashboard failed to start',
      `The local server could not start: ${err instanceof Error ? err.message : String(err)}`
    );
    app.quit();
    return;
  }

  // Built from the reported port and this process's own loopback default, not
  // from address(), which reports 0.0.0.0 whenever HOST asks for that.
  SERVER_URL = `http://127.0.0.1:${boundPort}`;

  registerIpcHandlers();
  await registerAgenticToolsIpcHandlers();
  await registerUpdateCheckIpcHandlers();
  createWindow(SERVER_URL);
});

// No explicit server shutdown logic: src/server.ts registers no signal
// handlers and calls no process.exit, so Electron's own process teardown on
// window-close takes the in-process HTTP listener down with it.
