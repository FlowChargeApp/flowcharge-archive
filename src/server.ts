// The composition root. It reads the environment, derives the three paths that
// only dist/server.js's own location can give, constructs the adapters and the
// application service, hands them to createHttpServer, and binds the socket. It
// holds no route handler and no validation predicate.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// ID_SUFFIX only: a constant, not a parser. src/http/ may not import extract.js,
// so the WORKSTREAM_ID pattern is built here and passed in as configuration.
import { ID_SUFFIX } from './lib/extract.js';
import { createJsonFileProjectRegistry } from './lib/projects.js';
import type { ProjectRegistry } from './ports/project-registry.js';
import { createMarkdownWorkstreamStore } from './lib/workstream-store.js';
import type { WorkstreamStore } from './ports/workstream-store.js';
import { createBoardApi } from './core/board-api.js';
import type { BoardApi } from './ports/app-api.js';
import { createHttpServer } from './http/create-server.js';
// The agentic-tools write and read adapters, wired here and injected into the HTTP
// layer. Statically imported: this file's ESM output and src/lib's are one
// compilation, so the Electron IPC layer's dynamic-import wiring is not needed.
import { createNodeFsAccess, createNodeFsWriteAccess } from './lib/agentic-tools-fs-adapter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, 'public');
const port = process.env.PORT ? Number(process.env.PORT) : 4173;
const host = process.env.HOST || '127.0.0.1';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

// The app's own version. PRAXIS_APP_VERSION wins when set to a non-empty string:
// a Bun standalone executable carries no package.json on its read-only embedded
// filesystem, so dist/cli-entry.js injects the version at build time. Otherwise
// package.json is read ONCE at module load, one level up from `dist/`. Any
// failure logs once and leaves this null; the version route then answers 500. An
// explicit emptiness test, never `??=`: '' must fall through to package.json.
const APP_VERSION: string | null = (() => {
  const injected = process.env.PRAXIS_APP_VERSION;
  if (typeof injected === 'string' && injected !== '') return injected;
  try {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8');
    const parsed = JSON.parse(raw) as { version?: string };
    return typeof parsed.version === 'string' ? parsed.version : null;
  } catch (err) {
    console.error('Could not read package.json for the app version:', err);
    return null;
  }
})();

// The install registry the integrations routes use. PRAXIS_DATA_DIR wins when set
// and non-empty, mirroring src/lib/projects.ts:22 and src/lib/update-prefs.ts:20,
// so the codebase carries one data-directory seam rather than two: a Bun
// standalone executable resolves `__dirname` inside the read-only /$bunfs, where
// nothing can be written, and dist/cli-entry.js sets PRAXIS_DATA_DIR before this
// module evaluates. Unset, the path is byte-for-byte the previous one, one level
// up from `dist/`.
const INSTALL_REGISTRY_PATH = path.join(
  process.env.PRAXIS_DATA_DIR || path.join(__dirname, '..'),
  '.praxis-installs.json',
);

// The one ProjectRegistry this transport uses. Its config repeats what
// src/lib/projects.ts derives for its own default instance: `__dirname` is `dist/`
// here and `dist/lib/` there, so one level up and two levels up name the same repo
// root, with the same PRAXIS_DATA_DIR fallback and packaged rule.
const PROJECT_REGISTRY_ROOT = path.join(__dirname, '..');
const registry: ProjectRegistry = createJsonFileProjectRegistry({
  dataDir: process.env.PRAXIS_DATA_DIR || PROJECT_REGISTRY_ROOT,
  repoRoot: PROJECT_REGISTRY_ROOT,
  packaged: Boolean(process.env.PRAXIS_DATA_DIR),
});

// The only door to the markdown tree, and the service composed over both ports.
const store: WorkstreamStore = createMarkdownWorkstreamStore();
const api: BoardApi = createBoardApi({ registry, store });

// The one write adapter the install engine gets, built once, not per request.
const installFsWrite = createNodeFsWriteAccess();

// The extra hostnames this server answers to, beyond IP literals and `localhost`:
// a comma-separated list, trimmed and lowercased, with empty entries dropped.
// Read once at module scope, exactly as `port` and `host` are above.
const ALLOWED_HOSTS: ReadonlySet<string> = new Set(
  (process.env.ALLOWED_HOSTS ?? '')
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter((name) => name !== ''),
);

// Shape of a workstream id in a detail request, composed from ID_SUFFIX so this
// server and the extractor cannot disagree about what an id looks like. Hoisted
// here so it compiles once, not once per request, and passed to the detail route
// as configuration. Both anchors are load-bearing: they make it a shape guard.
const WORKSTREAM_ID = new RegExp(String.raw`^WS-\d+${ID_SUFFIX}$`);

function isLoopbackHost(candidate: string): boolean {
  return LOOPBACK_HOSTS.has(candidate);
}

const server = createHttpServer({
  api,
  integrations: {
    registry,
    installRegistryPath: INSTALL_REGISTRY_PATH,
    fsWrite: installFsWrite,
    createFsAccess: createNodeFsAccess,
  },
  publicRoot: root,
  allowedHosts: ALLOWED_HOSTS,
  appVersion: APP_VERSION,
  workstreamIdPattern: WORKSTREAM_ID,
});

// Readiness and the bound port are one fact, so one export carries both: it
// resolves with the port the socket actually bound and rejects with whatever the
// 'error' listener receives. The listen call still runs as this module's startup
// side effect, so `npm start` behaves exactly as it did without this export.
export const serverReady: Promise<number> = new Promise<number>((resolve, reject) => {
  // Without this listener any bind failure becomes an uncaught exception in
  // whichever process imported this module. Not narrowed to one error code.
  server.on('error', (err) => {
    console.error(`FlowCharge could not bind ${host}:${port}:`, err);
    reject(err);
  });

  server.listen(port, host, () => {
    // Read back rather than reported from `port`: when PORT is 0 the OS picks an
    // ephemeral port, and address() is null until the socket is listening.
    const address = server.address();
    resolve(typeof address === 'object' && address !== null ? address.port : port);

    console.log(`FlowCharge running at http://${host}:${port}`);
    if (!isLoopbackHost(host)) {
      console.warn(
        `WARNING: bound to ${host}, which is not loopback-only — FlowCharge is now ` +
        `reachable from other devices on the network. There is no authentication: any ` +
        `device that can reach ${host}:${port} can read every registered project's ` +
        `flowcharge/ content and can add, rename, or remove project registry entries. ` +
        `Registered project paths are resolved on THIS machine's filesystem regardless ` +
        `of which machine's browser makes the request.`
      );
    }
  });
});

// `npm start` imports nothing and awaits nothing, so a bind failure would raise an
// unhandled rejection on top of the error listener's own report. Already surfaced
// there; this only marks the rejection as observed.
serverReady.catch(() => {});
