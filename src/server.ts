import http from 'node:http';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractPraxisData, ID_SUFFIX } from './lib/extract.js';
import { hasWorkstreamTree, resolveTreeLayout } from './lib/tree-layout.js';
import { readProjects, findProject, addProject, removeProject, renameProject } from './lib/projects.js';
import { readBranch } from './lib/git.js';
import { extractWorkstreamDetail } from './lib/detail.js';
// The agentic-tools engine, imported statically. This file's ESM output and
// src/lib's are the same compilation, so the dynamic-import wiring
// electron/agentic-tools-ipc-handlers.cts needs does not apply here.
import { detectAllTools } from './lib/agentic-tools-detect.js';
import { checkSkillPresence } from './lib/agentic-tools-skill-presence.js';
import { installToTarget, removeInstallation } from './lib/agentic-tools-install.js';
import { parseInstallRegistry, findInstallRecord } from './lib/agentic-tools-install-tracking.js';
import { createNodeFsAccess, createNodeFsWriteAccess } from './lib/agentic-tools-fs-adapter.js';
import { TOOL_CATALOGUE } from './lib/agentic-tools-catalogue.js';
import { CANONICAL_PRAXIS_SKILL_IDS } from './lib/agentic-tools-canonical-skills.js';
import { getInstallContent } from './lib/skill-content-fetch.js';
import type { DetectionResult } from './lib/agentic-tools-signals.js';
import type { OS } from './lib/agentic-tools-catalogue.js';
import type { InstallResult } from './lib/agentic-tools-install.js';
import type { InstallScope } from './lib/agentic-tools-install-tracking.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, 'public');
const port = process.env.PORT ? Number(process.env.PORT) : 4173;
const host = process.env.HOST || '127.0.0.1';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

// The policy every static response carries. Every asset this server sends is
// same-origin: separate script files, one stylesheet, one local woff2, and
// fetch calls that only ever reach /api/* on this same origin.
const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; " +
  "connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'self'; " +
  "frame-ancestors 'none'; object-src 'none'";

// The POST body's only content is a filesystem path, so 8KB is roughly 10,000x
// the expected size — and it is the one unbounded input this server accepts.
const MAX_BODY_BYTES = 8192;

// The one place the display-name cap lives, so it can be widened in one edit.
const MAX_NAME_LENGTH = 100;

// Shape of a workstream id in a detail request, composed from ID_SUFFIX so this
// server and the extractor cannot disagree about what an id looks like. Hoisted
// here so it compiles once, not once per request. Both anchors are load-bearing:
// they are what make this a shape guard rather than a substring test.
const WORKSTREAM_ID = new RegExp(String.raw`^WS-\d+${ID_SUFFIX}$`);

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

// The app's own version, read from package.json ONCE at module load rather than
// per request. `__dirname` is `dist/` in the compiled output, so package.json
// sits one level up. Any failure — unreadable file, invalid JSON, a missing or
// non-string `version` field — logs once and leaves this null, and the route
// below answers 500 instead of throwing.
const APP_VERSION: string | null = (() => {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8');
    const parsed = JSON.parse(raw) as { version?: string };
    return typeof parsed.version === 'string' ? parsed.version : null;
  } catch (err) {
    console.error('Could not read package.json for the app version:', err);
    return null;
  }
})();

// The install registry both transports share. `__dirname` is `dist/` in the
// compiled output, so this resolves to the same file
// electron/agentic-tools-ipc-handlers.cts:234-235 resolves to. PRAXIS_DATA_DIR
// is deliberately NOT consulted here: both transports must resolve one registry
// file, and the Electron handler does not consult it either.
const INSTALL_REGISTRY_PATH = path.join(__dirname, '..', '.praxis-installs.json');

// The one write adapter the integrations routes hand to the install engine,
// built once at module scope rather than per request.
const installFsWrite = createNodeFsWriteAccess();

function isLoopbackHost(candidate: string): boolean {
  return LOOPBACK_HOSTS.has(candidate);
}

// One greppable line per legacy resolution, printed at the route boundary. The
// printing lives here and never in src/lib/, which returns facts and logs
// nothing. There is deliberately NO seen-set and no cross-request dedupe: the
// line exists to show whether the fallback is still load-bearing, and a
// suppressed repeat would hide exactly that.
function warnLegacyLayout(target: string): void {
  const layout = resolveTreeLayout(target);
  if (layout !== null && layout.legacy) {
    console.warn(
      `LEGACY LAYOUT: ${layout.dir} uses prxwork/ — rename it to flowcharge/; ` +
      `support for the old name will be removed`
    );
  }
}

// The extra hostnames this server answers to, beyond IP literals and `localhost`.
// Read once at module scope, exactly as `port` and `host` are above: a
// comma-separated list, trimmed and lowercased, with empty entries dropped.
const ALLOWED_HOSTS: ReadonlySet<string> = new Set(
  (process.env.ALLOWED_HOSTS ?? '')
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter((name) => name !== ''),
);

// The bare hostname from a Host header value, or null when the header is absent
// or unparseable. A WHATWG URL keeps the brackets on an IPv6 literal, so they
// are stripped here — otherwise `[::1]:4173` would never match net.isIP.
function hostnameOf(hostHeader: string | undefined): string | null {
  if (hostHeader === undefined) return null;
  try {
    const hostname = new URL('http://' + hostHeader).hostname;
    return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  } catch {
    return null;
  }
}

// Header-only request-origin validation: it knows nothing about routes, project
// ids, the registry, or the extractor. Returns true when the request may
// proceed; otherwise it writes its own 403 through sendJson and returns false.
// No Access-Control-Allow-* header is ever sent — sending none is the posture.
function passesOriginCheck(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  // Check one: the Host header. An absent or unparseable Host fails.
  const hostname = hostnameOf(req.headers.host);
  if (hostname === null || !(net.isIP(hostname) !== 0 || hostname === 'localhost' || ALLOWED_HOSTS.has(hostname))) {
    sendJson(res, 403, { error: 'Host header not allowed' });
    return false;
  }

  // Check two: the Origin header, when present. Compared against the RAW Host
  // header value so the port is part of the comparison. An absent Origin passes
  // — Electron's loopbackRequest sends none. `Origin: null` fails, because it
  // never equals `http://` plus a host.
  const origin = req.headers.origin;
  if (origin !== undefined && origin.toLowerCase() !== ('http://' + req.headers.host).toLowerCase()) {
    sendJson(res, 403, { error: 'Origin not allowed' });
    return false;
  }

  return true;
}

// The peer-address gate the /api/integrations/* branch sits behind. This is a
// DIFFERENT guard from isLoopbackHost above, which inspects a Host header
// rather than the socket's actual peer; neither replaces the other and both
// stay. Node reports an IPv4 loopback client as '::ffff:127.0.0.1' when the
// socket is IPv6, so that form is accepted too — omitting it would silently
// refuse legitimate local requests. An absent address fails closed.
function isLoopbackRemote(req: http.IncomingMessage): boolean {
  const remote = req.socket.remoteAddress;
  if (remote === undefined) return false;
  return remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
}

// Maps Node's os.platform() to the catalogue's OS union. A hand-mirror of
// electron/agentic-tools-ipc-handlers.cts:100-111 — same switch, kept in sync
// by hand, because that file cannot import from src/lib at compile time. An
// unmapped platform (e.g. 'aix', 'freebsd') returns null rather than guessing a
// bucket, so the caller answers 500 instead of calling detectAllTools with a
// fabricated OS. The OS type itself is imported, not redeclared: src/server.ts
// can import it, unlike the Electron file.
function mapNodePlatformToOs(platform: NodeJS.Platform): OS | null {
  switch (platform) {
    case 'darwin':
      return 'macos';
    case 'linux':
      return 'linux';
    case 'win32':
      return 'windows';
    default:
      return null;
  }
}

// Runs the same detection sweep the /api/integrations/tools route runs, so this
// process derives a global scope's permitted root itself instead of trusting
// the basePath the client chose. A hand-mirror of
// electron/agentic-tools-ipc-handlers.cts:266-273. Called at most once per
// request and never cached across requests: detectAllTools touches the
// filesystem for every catalogue tool, so once per request is right, but a tool
// installed mid-session must become permitted without a restart.
async function detectionsForPermittedRoots(): Promise<DetectionResult[]> {
  const platform = os.platform();
  const mappedOs = mapNodePlatformToOs(platform);
  if (mappedOs === null) {
    throw new Error(`Unsupported OS: ${platform}`);
  }
  return detectAllTools(createNodeFsAccess(), mappedOs);
}

// Answers, for one (toolId, scope) pair, the single filesystem root this
// process permits a write or a delete under — derived here, never taken from
// the client. A hand-mirror of
// electron/agentic-tools-ipc-handlers.cts:284-309. A 'project' scope is
// permitted only at a path that is in the project registry right now; a
// 'global' scope only at that tool's own detected config directory, read from
// `detections` at the tool's index in TOOL_CATALOGUE — the same index alignment
// the tools route relies on. Returns null when there is no permitted root,
// including for an unrecognised scope kind, so the caller refuses rather than
// guesses.
function permittedRootFor(
  toolId: string,
  scope: InstallScope,
  detections: DetectionResult[],
): string | null {
  if (scope.kind === 'project') {
    if (typeof scope.projectPath !== 'string' || scope.projectPath === '') return null;
    const resolved = path.resolve(scope.projectPath);
    // readProjects() is re-read per call on purpose, exactly as the Electron
    // handler re-reads it: a project registered during this session must not be
    // wrongly refused.
    const registered = readProjects().some(
      (entry) => typeof entry.path === 'string' && path.resolve(entry.path) === resolved,
    );
    return registered ? resolved : null;
  }
  if (scope.kind === 'global') {
    const index = TOOL_CATALOGUE.findIndex((tool) => tool.id === toolId);
    if (index === -1) return null;
    const detection = detections[index];
    if (detection === undefined || detection.resolvedConfigDir === null) return null;
    return path.resolve(detection.resolvedConfigDir);
  }
  return null;
}

// True only when the header's media type is exactly application/json. Real
// requests attach parameters, so `application/json; charset=utf-8` must pass:
// the parameters are split off at the first semicolon before the comparison.
// An absent header returns false.
function isJsonContentType(header: string | undefined): boolean {
  if (header === undefined) return false;
  return header.split(';')[0].trim().toLowerCase() === 'application/json';
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

// Collects the request body, refusing anything over MAX_BODY_BYTES with a 413
// and destroying the request so the client stops streaming into a void. The log
// label is a parameter because more than one route reads a body: a hardcoded
// label would name the wrong method for every caller but the first.
function readRequestBody(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  logLabel: string,
  onBody: (raw: string) => void,
): void {
  const chunks: Buffer[] = [];
  let size = 0;
  let settled = false;

  req.on('data', (chunk: Buffer) => {
    if (settled) return;
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      settled = true;
      sendJson(res, 413, { error: 'Request body too large' });
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });

  req.on('end', () => {
    if (settled) return;
    settled = true;
    onBody(Buffer.concat(chunks).toString('utf8'));
  });

  req.on('error', (err) => {
    if (settled) return;
    settled = true;
    console.error(logLabel, err);
    sendJson(res, 400, { error: 'Could not read the request body' });
  });
}

function handleAddProject(req: http.IncomingMessage, res: http.ServerResponse): void {
  readRequestBody(req, res, 'POST /api/projects — request stream error:', (raw) => {
    try {
      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        sendJson(res, 400, { error: 'Request body must be valid JSON of the form {"path": "/absolute/path"}' });
        return;
      }

      const candidate = (body as { path?: unknown } | null)?.path;
      if (typeof candidate !== 'string' || candidate.trim() === '') {
        sendJson(res, 400, { error: 'Missing `path` — send a JSON body of the form {"path": "/absolute/path"}' });
        return;
      }

      const input = candidate.trim();
      if (input.startsWith('~')) {
        sendJson(res, 400, { error: '~ is not expanded — enter the full absolute path instead' });
        return;
      }
      if (!path.isAbsolute(input)) {
        sendJson(res, 400, { error: 'Path must be absolute — enter a full path starting with /' });
        return;
      }
      if (!hasWorkstreamTree(input)) {
        sendJson(res, 400, { error: `No flowcharge/ folder found under ${input} — a project is a directory containing flowcharge/ (a legacy prxwork/ folder is still accepted)` });
        return;
      }
      warnLegacyLayout(input);

      const { entry, created } = addProject(input);
      sendJson(res, created ? 201 : 200, { project: entry });
    } catch (err) {
      console.error('POST /api/projects failed:', err);
      sendJson(res, 500, { error: 'Could not write the project registry' });
    }
  });
}

// Validation lives here at the route boundary, never in the registry library,
// exactly as handleAddProject validates the path before addProject sees it. The
// trimmed value is what is length-checked and what is stored, so it is computed
// once and reused. The character class covers the C0 range (which includes \n,
// \r and \t), DEL, and the C1 range: a display name is a single line of text.
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/;

function handleRenameProject(req: http.IncomingMessage, res: http.ServerResponse, id: string): void {
  readRequestBody(req, res, `PATCH /api/projects/${id} — request stream error:`, (raw) => {
    try {
      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        sendJson(res, 400, { error: 'Request body must be valid JSON of the form {"name": "New name"}' });
        return;
      }

      const candidate = (body as { name?: unknown } | null)?.name;
      // typeof first: a `name` of 42 has no .trim() to call.
      if (typeof candidate !== 'string' || candidate.trim() === '') {
        sendJson(res, 400, { error: 'Missing `name` — send a JSON body of the form {"name": "New name"}' });
        return;
      }

      const name = candidate.trim();
      if (name.length > MAX_NAME_LENGTH) {
        sendJson(res, 400, { error: `Name must be ${MAX_NAME_LENGTH} characters or fewer` });
        return;
      }
      if (CONTROL_CHARS.test(name)) {
        sendJson(res, 400, { error: 'Name must be a single line of plain text' });
        return;
      }

      const entry = renameProject(id, name);
      if (!entry) {
        sendJson(res, 404, { error: `Unknown project ${id}` });
        return;
      }
      sendJson(res, 200, { project: entry });
    } catch (err) {
      console.error(`PATCH /api/projects/${id} failed:`, err);
      sendJson(res, 500, { error: 'Could not write the project registry' });
    }
  });
}

// The one target shape every mutating integrations route accepts, matching
// electron/agentic-tools-ipc-handlers.cts:223-227.
interface InstallTargetRequest {
  toolId: string;
  basePath: string;
  scope: InstallScope;
}

// Shape guards for a body that arrived over HTTP and is structurally typed
// only. Both live at the route boundary, exactly as handleAddProject's path
// validation does, and never in src/lib.
function isInstallScope(value: unknown): value is InstallScope {
  if (typeof value !== 'object' || value === null) return false;
  const scope = value as { kind?: unknown; projectPath?: unknown };
  if (scope.kind === 'global') return true;
  if (scope.kind === 'project') {
    return typeof scope.projectPath === 'string' && scope.projectPath !== '';
  }
  return false;
}

function isInstallTargetRequest(value: unknown): value is InstallTargetRequest {
  if (typeof value !== 'object' || value === null) return false;
  const target = value as { toolId?: unknown; basePath?: unknown; scope?: unknown };
  return (
    typeof target.toolId === 'string' &&
    target.toolId !== '' &&
    typeof target.basePath === 'string' &&
    target.basePath !== '' &&
    isInstallScope(target.scope)
  );
}

const INSTALL_TARGET_SHAPE =
  'Each target must be of the form {"toolId": "...", "basePath": "/absolute/path", ' +
  '"scope": {"kind": "global"}} or {"kind": "project", "projectPath": "/absolute/path"}';

// The wording every integrations route uses for an unexpected throw: the
// error's own message, matching what the Electron channels put in their failed
// PraxisIpcResult.
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// GET /api/integrations/tools — mirrors the detectTools IPC channel
// (electron/agentic-tools-ipc-handlers.cts:459-477). Answers the BARE
// ToolDetectionRow[] with an HTTP status, never a PraxisIpcResult envelope: the
// shim's fetchIpc reconstructs that client-side from the status and body.
// Async handlers catch their own throws, because handleApi's try/catch returns
// before the promise settles and an unhandled rejection would take the process
// down.
async function handleIntegrationsTools(res: http.ServerResponse): Promise<void> {
  try {
    const platform = os.platform();
    const mappedOs = mapNodePlatformToOs(platform);
    if (mappedOs === null) {
      sendJson(res, 500, { error: `Unsupported OS: ${platform}` });
      return;
    }
    const results = await detectAllTools(createNodeFsAccess(), mappedOs);
    const rows = TOOL_CATALOGUE.map((tool, index) => ({
      toolId: tool.id,
      displayName: tool.displayName,
      category: tool.category,
      detection: results[index],
    }));
    sendJson(res, 200, rows);
  } catch (err) {
    sendJson(res, 500, { error: errorMessage(err) });
  }
}

// POST /api/integrations/skill-presence — mirrors the checkInstalledSkills IPC
// channel (electron/agentic-tools-ipc-handlers.cts:479-493) exactly. There is
// deliberately NO permitted-root check on basePath: this route is an
// arbitrary-path existence probe by design, matching the Electron path, and the
// loopback gate is what bounds it. Adding a check here would make the two
// transports differ.
function handleIntegrationsSkillPresence(req: http.IncomingMessage, res: http.ServerResponse): void {
  readRequestBody(req, res, 'POST /api/integrations/skill-presence — request stream error:', async (raw) => {
    try {
      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        sendJson(res, 400, { error: `Request body must be valid JSON. ${INSTALL_TARGET_SHAPE}` });
        return;
      }
      if (!isInstallTargetRequest(body)) {
        sendJson(res, 400, { error: INSTALL_TARGET_SHAPE });
        return;
      }
      const tool = TOOL_CATALOGUE.find((t) => t.id === body.toolId);
      if (tool === undefined) {
        sendJson(res, 404, { error: `Unknown toolId: ${body.toolId}` });
        return;
      }
      const result = await checkSkillPresence(tool, body.basePath, CANONICAL_PRAXIS_SKILL_IDS, createNodeFsAccess());
      sendJson(res, 200, result);
    } catch (err) {
      sendJson(res, 500, { error: errorMessage(err) });
    }
  });
}

// GET /api/integrations/installs — mirrors the getInstallStatus IPC channel
// (electron/agentic-tools-ipc-handlers.cts:411-419). readTextFile answers null
// for a missing file rather than throwing, so the null check is what keeps a
// first run a 200 with [] instead of a 500.
async function handleIntegrationsInstallsGet(res: http.ServerResponse): Promise<void> {
  try {
    const raw = await installFsWrite.readTextFile(INSTALL_REGISTRY_PATH);
    const records = raw === null ? [] : parseInstallRegistry(raw);
    sendJson(res, 200, records);
  } catch (err) {
    sendJson(res, 500, { error: errorMessage(err) });
  }
}

// POST /api/integrations/installs — mirrors the installSelected IPC channel
// (electron/agentic-tools-ipc-handlers.cts:361-408), including its ordering.
// This route performs REAL file writes into real tool config directories, so
// every target is validated against a root this process derived BEFORE any
// target is installed: validating inside the install loop would let a bad path
// be smuggled in behind earlier good ones. Overlapping requests are left
// unserialized, identical to today's Electron behaviour.
function handleIntegrationsInstallsPost(req: http.IncomingMessage, res: http.ServerResponse): void {
  readRequestBody(req, res, 'POST /api/integrations/installs — request stream error:', async (raw) => {
    try {
      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        sendJson(res, 400, { error: `Request body must be valid JSON of the form {"targets": [...]}. ${INSTALL_TARGET_SHAPE}` });
        return;
      }
      const rawTargets = (body as { targets?: unknown } | null)?.targets;
      if (!Array.isArray(rawTargets)) {
        sendJson(res, 400, { error: `Missing \`targets\` — send a JSON body of the form {"targets": [...]}. ${INSTALL_TARGET_SHAPE}` });
        return;
      }
      const targets: InstallTargetRequest[] = [];
      for (const candidate of rawTargets) {
        if (!isInstallTargetRequest(candidate)) {
          sendJson(res, 400, { error: INSTALL_TARGET_SHAPE });
          return;
        }
        targets.push(candidate);
      }

      // Exact equality is the right comparison, not containment: the client's
      // resolveBasePathForScope returns exactly resolvedConfigDir or exactly
      // projectPath, so a legitimate basePath always equals the permitted root
      // and is never merely inside it.
      const needsDetection = targets.some((target) => target.scope.kind === 'global');
      const detections = needsDetection ? await detectionsForPermittedRoots() : [];
      for (const target of targets) {
        // An unknown toolId never reaches installToTarget — the loop below
        // records it as skipped-no-format — so it needs no permitted root.
        if (!TOOL_CATALOGUE.some((t) => t.id === target.toolId)) continue;
        const permittedRoot = permittedRootFor(target.toolId, target.scope, detections);
        if (permittedRoot === null || path.resolve(target.basePath) !== permittedRoot) {
          sendJson(res, 400, {
            error: `Refused install path outside the permitted root for ${target.toolId}: ${target.basePath}`,
          });
          return;
        }
      }

      const results: InstallResult[] = [];
      for (const target of targets) {
        const tool = TOOL_CATALOGUE.find((t) => t.id === target.toolId);
        if (tool === undefined) {
          results.push({ toolId: target.toolId, status: 'skipped-no-format', resolvedPath: null });
          continue;
        }
        const content = await getInstallContent(target.toolId);
        const result = await installToTarget(
          { tool, basePath: target.basePath, scope: target.scope },
          content,
          INSTALL_REGISTRY_PATH,
          { fsWrite: installFsWrite },
        );
        results.push(result);
      }
      sendJson(res, 200, results);
    } catch (err) {
      sendJson(res, 500, { error: errorMessage(err) });
    }
  });
}

// POST /api/integrations/installs/remove — mirrors the removeInstallation IPC
// channel (electron/agentic-tools-ipc-handlers.cts:421-457). The engine's
// removeInstallation deletes the record's resolvedPath recursively, so the
// boundary check runs first, against a root this process derived rather than
// one the client supplied. The 200 body is the literal null, because the shim's
// fetchIpc assigns the parsed body straight to `data`.
function handleIntegrationsInstallRemove(req: http.IncomingMessage, res: http.ServerResponse): void {
  readRequestBody(req, res, 'POST /api/integrations/installs/remove — request stream error:', async (raw) => {
    try {
      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        sendJson(res, 400, { error: 'Request body must be valid JSON of the form {"toolId": "...", "scope": {"kind": "global"}}' });
        return;
      }
      const candidate = body as { toolId?: unknown; scope?: unknown } | null;
      const toolId = candidate?.toolId;
      const scope = candidate?.scope;
      if (typeof toolId !== 'string' || toolId === '' || !isInstallScope(scope)) {
        sendJson(res, 400, { error: 'Missing `toolId` or `scope` — send a JSON body of the form {"toolId": "...", "scope": {"kind": "global"}}' });
        return;
      }

      const rawRegistry = await installFsWrite.readTextFile(INSTALL_REGISTRY_PATH);
      const records = rawRegistry === null ? [] : parseInstallRegistry(rawRegistry);
      const record = findInstallRecord(records, toolId, scope);
      if (record === undefined) {
        // No record: removeInstallation is documented idempotent and would
        // return without touching the filesystem, so keep that silent no-op
        // rather than turning it into a failure.
        sendJson(res, 200, null);
        return;
      }

      const detections = scope.kind === 'global' ? await detectionsForPermittedRoots() : [];
      const permittedRoot = permittedRootFor(toolId, scope, detections);
      const resolvedTarget = path.resolve(record.resolvedPath);
      // The trailing path.sep is what makes this a boundary rather than a bare
      // prefix: without it a sibling whose name merely begins with the root's
      // name would pass. Equality with the root is refused too — a tracked
      // install is always a path under its base, never the base.
      if (permittedRoot === null || !resolvedTarget.startsWith(permittedRoot + path.sep)) {
        sendJson(res, 400, {
          error: `Refused remove path outside the permitted root for ${toolId}: ${record.resolvedPath}`,
        });
        return;
      }
      await removeInstallation(toolId, scope, INSTALL_REGISTRY_PATH, { fsWrite: installFsWrite });
      sendJson(res, 200, null);
    } catch (err) {
      sendJson(res, 500, { error: errorMessage(err) });
    }
  });
}

// Every branch below answers with JSON and swallows its own throws: an uncaught
// exception inside an http.createServer handler takes the whole process down.
function handleApi(req: http.IncomingMessage, res: http.ServerResponse, reqPath: string): void {
  const method = req.method ?? 'GET';

  // Above every route match, so no route added below can miss it, and before any
  // body is read, so readRequestBody never runs for a rejected request. 403, not
  // 415: one uniform rejection shape across every check at this boundary. GET
  // and DELETE carry no body and are left alone.
  if ((method === 'POST' || method === 'PATCH') && !isJsonContentType(req.headers['content-type'])) {
    sendJson(res, 403, { error: 'Content-Type must be application/json' });
    return;
  }

  if (reqPath === '/api/projects') {
    if (method === 'GET') {
      try {
        const list: ProjectList = { projects: readProjects() };
        sendJson(res, 200, list);
      } catch (err) {
        console.error('GET /api/projects failed:', err);
        sendJson(res, 500, { error: 'Could not read the project registry' });
      }
      return;
    }
    if (method === 'POST') {
      handleAddProject(req, res);
      return;
    }
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  // End-anchored on purpose: without the $ this pattern would also swallow
  // /api/projects/<id>/data and the .../workstreams/.../detail route below.
  const entryMatch = reqPath.match(/^\/api\/projects\/([^/]+)$/);
  if (entryMatch) {
    const id = entryMatch[1];
    if (method === 'DELETE') {
      // The id is only ever compared against strings already in the registry and
      // never becomes a filesystem path, so it needs no shape check — the same
      // reasoning the .../data route already relies on.
      try {
        const entry = removeProject(id);
        if (!entry) {
          sendJson(res, 404, { error: `Unknown project ${id}` });
          return;
        }
        sendJson(res, 200, { deleted: entry });
      } catch (err) {
        console.error(`DELETE /api/projects/${id} failed:`, err);
        sendJson(res, 500, { error: 'Could not write the project registry' });
      }
      return;
    }
    if (method === 'PATCH') {
      handleRenameProject(req, res, id);
      return;
    }
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const dataMatch = reqPath.match(/^\/api\/projects\/([^/]+)\/data$/);
  if (dataMatch) {
    if (method !== 'GET') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }
    const id = dataMatch[1];
    try {
      const entry = findProject(id);
      if (!entry) {
        sendJson(res, 404, { error: `Unknown project ${id}` });
        return;
      }
      if (!hasWorkstreamTree(entry.path)) {
        sendJson(res, 410, { error: `${entry.path} no longer contains a flowcharge/ or prxwork/ folder` });
        return;
      }
      warnLegacyLayout(entry.path);
      const payload: BoardPayload = { ...extractPraxisData(entry.path), branch: readBranch(entry.path) };
      sendJson(res, 200, payload);
    } catch (err) {
      console.error(`GET /api/projects/${id}/data failed:`, err);
      sendJson(res, 500, { error: 'Extraction failed' });
    }
    return;
  }

  const detailMatch = reqPath.match(/^\/api\/projects\/([^/]+)\/workstreams\/([^/]+)\/detail$/);
  if (detailMatch) {
    if (method !== 'GET') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }
    const id = detailMatch[1];
    const wsId = detailMatch[2];
    // Shape check before any filesystem work: reqPath is already
    // decodeURIComponent'd, so a decoded single segment such as `../etc` reaches
    // here and is rejected on shape rather than on where it would have pointed.
    if (!WORKSTREAM_ID.test(wsId)) {
      sendJson(res, 400, { error: `Malformed workstream id ${wsId}` });
      return;
    }
    try {
      const entry = findProject(id);
      if (!entry) {
        sendJson(res, 404, { error: `Unknown project ${id}` });
        return;
      }
      if (!hasWorkstreamTree(entry.path)) {
        sendJson(res, 410, { error: `${entry.path} no longer contains a flowcharge/ or prxwork/ folder` });
        return;
      }
      warnLegacyLayout(entry.path);
      const detail = extractWorkstreamDetail(entry.path, wsId);
      if (!detail) {
        sendJson(res, 404, { error: `Unknown workstream ${wsId}` });
        return;
      }
      sendJson(res, 200, detail);
    } catch (err) {
      console.error(`GET /api/projects/${id}/workstreams/${wsId}/detail failed:`, err);
      sendJson(res, 500, { error: 'Detail extraction failed' });
    }
    return;
  }

  if (reqPath === '/api/version' && method === 'GET') {
    if (APP_VERSION === null) {
      sendJson(res, 500, { error: 'Could not read the app version' });
      return;
    }
    sendJson(res, 200, { version: APP_VERSION });
    return;
  }

  if (reqPath.startsWith('/api/integrations/')) {
    // The loopback gate, above every route match and before any body is read,
    // in the same position and with the same uniform rejection shape as the
    // Content-Type check at the top of this function. These routes write and
    // recursively delete files under real tool config directories on a server
    // with no authentication, so they are refused to any non-local peer. This
    // is a peer-address check, distinct from the Host-header check
    // passesOriginCheck already performs; neither replaces the other.
    if (!isLoopbackRemote(req)) {
      sendJson(res, 403, { error: 'Integrations are available only from this machine' });
      return;
    }

    if (reqPath === '/api/integrations/tools') {
      if (method !== 'GET') {
        sendJson(res, 405, { error: 'Method not allowed' });
        return;
      }
      void handleIntegrationsTools(res);
      return;
    }

    if (reqPath === '/api/integrations/skill-presence') {
      if (method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' });
        return;
      }
      handleIntegrationsSkillPresence(req, res);
      return;
    }

    if (reqPath === '/api/integrations/installs') {
      if (method === 'GET') {
        void handleIntegrationsInstallsGet(res);
        return;
      }
      if (method === 'POST') {
        handleIntegrationsInstallsPost(req, res);
        return;
      }
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }

    if (reqPath === '/api/integrations/installs/remove') {
      if (method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' });
        return;
      }
      handleIntegrationsInstallRemove(req, res);
      return;
    }

    // An unmatched /api/integrations/ path falls through to the 404 below.
  }

  sendJson(res, 404, { error: 'Not found' });
}

const server = http.createServer((req, res) => {
  // req.url is string | undefined under @types/node but always set here; assert, don't fall back.
  const reqPath = decodeURIComponent(req.url!.split('?')[0]);

  // Before the traversal check, so every route is covered — static files included.
  if (!passesOriginCheck(req, res)) return;

  let filePath = path.join(root, reqPath === '/' ? '/index.html' : reqPath);

  // Prevent path traversal outside public/. path.join has already collapsed any
  // '..', so the only remaining gap is a bare prefix match: a sibling of root
  // whose name merely begins with root's name. Compare against root plus
  // path.sep so the boundary is a real directory separator on every platform.
  if (!filePath.startsWith(root + path.sep)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (reqPath.startsWith('/api/')) {
    try {
      handleApi(req, res, reqPath);
    } catch (err) {
      console.error(`${req.method} ${reqPath} failed:`, err);
      sendJson(res, 500, { error: 'Internal server error' });
    }
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found: ' + reqPath);
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Security-Policy': CSP,
    });
    res.end(data);
  });
});

// Readiness and the bound port are one fact, so one export carries both: it
// resolves with the port the socket actually bound and rejects with whatever
// the 'error' listener receives. The listen call still runs as this module's
// startup side effect — the executor below runs synchronously on module
// evaluation — so `npm start` behaves exactly as it did without this export.
export const serverReady: Promise<number> = new Promise<number>((resolve, reject) => {
  // Without this listener an EADDRINUSE (or an EACCES on a privileged port, or
  // any other bind failure) becomes an uncaught exception in whichever process
  // imported this module. Not narrowed to one code, because any of them means
  // the same thing here: this server never started.
  server.on('error', (err) => {
    console.error(`FlowCharge could not bind ${host}:${port}:`, err);
    reject(err);
  });

  server.listen(port, host, () => {
    // Read back rather than reported from `port`: when PORT is 0 the OS picks
    // an ephemeral port, and address() is null until the socket is listening,
    // which is why this can only be read from inside this callback.
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

// `npm start` imports nothing and awaits nothing, so a bind failure would raise
// an unhandled rejection on top of the error listener's own report. The failure
// is already surfaced there; this only marks the rejection as observed.
serverReady.catch(() => {});
