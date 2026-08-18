// Electron main process: brings up the already-compiled HTTP server and
// opens a BrowserWindow pointed at it. This file starts the server module
// and waits for its port to answer — it has no knowledge of the project
// data the server reads or the endpoints it exposes, and no awareness of
// the board's data model. IPC bridging (contextBridge) is WS-37's job, not
// this file's.

import { app, BrowserWindow, dialog } from 'electron';
import http from 'node:http';
import path from 'node:path';
import { registerIpcHandlers } from './ipc-handlers.cjs';

// Matches src/server.ts:12-13's own hardcoded host/port defaults exactly.
export const SERVER_URL = 'http://127.0.0.1:4173';
const POLL_INTERVAL_MS = 100;
const POLL_TIMEOUT_MS = 10_000;

function waitForServer(url: string, timeoutMs: number, intervalMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() >= deadline) {
          reject(new Error(`Server did not become ready at ${url} within ${timeoutMs}ms`));
          return;
        }
        setTimeout(attempt, intervalMs);
      });
    };
    attempt();
  });
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  mainWindow.loadURL(SERVER_URL);
}

app.whenReady().then(async () => {
  // Dynamically import the compiled server module — a plain import() of an
  // ESM module from CommonJS code (Node supports this), not a require().
  // The import's module-evaluation side effect (src/server.ts:332) is
  // server.listen(port, host, ...); no exported start function exists or
  // is added here.
  //
  // TypeScript's CommonJS output rewrites a literal `import(...)` call into
  // a require()-based helper (`Promise.resolve().then(() => require(...))`),
  // which throws ERR_REQUIRE_ESM against dist/server.js — that file is
  // emitted as ESM because the root package.json sets "type": "module".
  // Routing the call through `new Function` hides the import() syntax from
  // tsc's downlevel transform, so this stays a genuine native dynamic
  // import at runtime, which Node's CommonJS main process can use to load
  // an ESM module.
  const dynamicImport = new Function('specifier', 'return import(specifier)') as (
    specifier: string
  ) => Promise<unknown>;
  await dynamicImport('../server.js');

  try {
    await waitForServer(SERVER_URL, POLL_TIMEOUT_MS, POLL_INTERVAL_MS);
  } catch {
    dialog.showErrorBox(
      'Praxis Dashboard failed to start',
      `The local server did not respond at ${SERVER_URL} within ${POLL_TIMEOUT_MS / 1000}s.`
    );
    app.quit();
    return;
  }

  registerIpcHandlers();
  createWindow();
});

// No explicit server shutdown logic: src/server.ts registers no signal
// handlers and calls no process.exit, so Electron's own process teardown on
// window-close takes the in-process HTTP listener down with it.
