// The /api/integrations/* branch: the loopback peer gate and the five routes
// behind it. Every one of them is a hand-mirror of a channel in
// electron/agentic-tools-ipc-handlers.cts, so each handler below names the
// channel it mirrors and the two must be changed together.
//
// This module derives no path of its own and reads no environment variable. The
// install registry path, the write adapter, the read-adapter factory and the
// project registry all arrive as IntegrationsDeps, so .praxis-projects.json is
// reached only through the ProjectRegistry port.

import type http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import { sendJson, readRequestBody, errorMessage } from './json.js';
import { isLoopbackRemote } from './guards.js';

import type { ProjectRegistry } from '../ports/project-registry.js';

import { detectAllTools } from '../lib/agentic-tools-detect.js';
import { checkSkillPresence } from '../lib/agentic-tools-skill-presence.js';
import { installToTarget, removeInstallation, recordedInstallPaths } from '../lib/agentic-tools-install.js';
import { parseInstallRegistry, findInstallRecord } from '../lib/agentic-tools-install-tracking.js';
import { TOOL_CATALOGUE } from '../lib/agentic-tools-catalogue.js';
import { CANONICAL_PRAXIS_SKILL_IDS } from '../lib/agentic-tools-canonical-skills.js';
import { getInstallContent, listSkillReleases } from '../lib/skill-content-fetch.js';
import type { DetectionResult, FsAccess } from '../lib/agentic-tools-signals.js';
import type { OS } from '../lib/agentic-tools-catalogue.js';
import type { FsWriteAccess, InstallResult } from '../lib/agentic-tools-install.js';
import type { InstallScope } from '../lib/agentic-tools-install-tracking.js';

export interface IntegrationsDeps {
  registry: ProjectRegistry;
  installRegistryPath: string;
  fsWrite: FsWriteAccess;
  createFsAccess: () => FsAccess;
}

// The one target shape every mutating integrations route accepts, matching
// electron/agentic-tools-ipc-handlers.cts:223-227.
interface InstallTargetRequest {
  toolId: string;
  basePath: string;
  scope: InstallScope;
}

// Shape guards for a body that arrived over HTTP and is structurally typed
// only. Both live at the route boundary, exactly as the add-project route's
// path validation does, and never in src/lib.
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

// Maps Node's os.platform() to the catalogue's OS union. A hand-mirror of
// electron/agentic-tools-ipc-handlers.cts:100-111 — same switch, kept in sync
// by hand, because that file cannot import from src/lib at compile time. An
// unmapped platform (e.g. 'aix', 'freebsd') returns null rather than guessing a
// bucket, so the caller answers 500 instead of calling detectAllTools with a
// fabricated OS. The OS type itself is imported, not redeclared.
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
async function detectionsForPermittedRoots(deps: IntegrationsDeps): Promise<DetectionResult[]> {
  const platform = os.platform();
  const mappedOs = mapNodePlatformToOs(platform);
  if (mappedOs === null) {
    throw new Error(`Unsupported OS: ${platform}`);
  }
  return detectAllTools(deps.createFsAccess(), mappedOs);
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
  registry: ProjectRegistry,
): string | null {
  if (scope.kind === 'project') {
    if (typeof scope.projectPath !== 'string' || scope.projectPath === '') return null;
    const resolved = path.resolve(scope.projectPath);
    // registry.list() is re-read per call on purpose, exactly as the Electron
    // handler re-reads it: a project registered during this session must not be
    // wrongly refused.
    const registered = registry.list().some(
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

// GET /api/integrations/tools — mirrors the detectTools IPC channel
// (electron/agentic-tools-ipc-handlers.cts:459-477). Answers the BARE
// ToolDetectionRow[] with an HTTP status, never a PraxisIpcResult envelope: the
// shim's fetchIpc reconstructs that client-side from the status and body.
// Async handlers catch their own throws, because handleApi's try/catch returns
// before the promise settles and an unhandled rejection would take the process
// down.
async function handleIntegrationsTools(res: http.ServerResponse, deps: IntegrationsDeps): Promise<void> {
  try {
    const platform = os.platform();
    const mappedOs = mapNodePlatformToOs(platform);
    if (mappedOs === null) {
      sendJson(res, 500, { error: `Unsupported OS: ${platform}` });
      return;
    }
    const results = await detectAllTools(deps.createFsAccess(), mappedOs);
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
function handleIntegrationsSkillPresence(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  deps: IntegrationsDeps,
): void {
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
      const result = await checkSkillPresence(tool, body.basePath, CANONICAL_PRAXIS_SKILL_IDS, deps.createFsAccess());
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
async function handleIntegrationsInstallsGet(res: http.ServerResponse, deps: IntegrationsDeps): Promise<void> {
  try {
    const raw = await deps.fsWrite.readTextFile(deps.installRegistryPath);
    const records = raw === null ? [] : parseInstallRegistry(raw);
    sendJson(res, 200, records);
  } catch (err) {
    sendJson(res, 500, { error: errorMessage(err) });
  }
}

// GET /api/integrations/releases — mirrors the listSkillReleases IPC channel.
// Answers the BARE array, never a PraxisIpcResult envelope: the browser shim's
// fetchIpc rebuilds that envelope from the status and body. listSkillReleases
// resolves to [] on every unhappy path rather than throwing, so the catch here
// is defensive rather than expected — but an async handler must still catch its
// own throws, since handleApi's try/catch returns before this promise settles.
async function handleIntegrationsReleases(res: http.ServerResponse): Promise<void> {
  try {
    const releases = await listSkillReleases();
    sendJson(res, 200, releases);
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
function handleIntegrationsInstallsPost(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  deps: IntegrationsDeps,
): void {
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
      const detections = needsDetection ? await detectionsForPermittedRoots(deps) : [];
      for (const target of targets) {
        // An unknown toolId never reaches installToTarget — the loop below
        // records it as skipped-no-format — so it needs no permitted root.
        if (!TOOL_CATALOGUE.some((t) => t.id === target.toolId)) continue;
        const permittedRoot = permittedRootFor(target.toolId, target.scope, detections, deps.registry);
        if (permittedRoot === null || path.resolve(target.basePath) !== permittedRoot) {
          sendJson(res, 400, {
            error: `Refused install path outside the permitted root for ${target.toolId}: ${target.basePath}`,
          });
          return;
        }
      }

      // Resolved ONCE per request, not once per target: a per-target fetch
      // could straddle a release publication and record two different versions
      // for one batch, and this way one install request produces exactly one
      // temporary zip file whatever the batch size. It stays inside this try
      // block so a release-missing throw becomes the 500 whose body carries
      // the message the user must see. getInstallContent ignores its toolId —
      // every tool gets the same content — which is what makes the hoist
      // behaviour-preserving. Kept in lockstep with the Electron transport's
      // installSelected handler.
      const content = await getInstallContent('', { fsWrite: deps.fsWrite });

      const results: InstallResult[] = [];
      for (const target of targets) {
        const tool = TOOL_CATALOGUE.find((t) => t.id === target.toolId);
        if (tool === undefined) {
          results.push({ toolId: target.toolId, status: 'skipped-no-format', resolvedPath: null });
          continue;
        }
        const result = await installToTarget(
          { tool, basePath: target.basePath, scope: target.scope },
          content,
          deps.installRegistryPath,
          { fsWrite: deps.fsWrite },
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
// removeInstallation deletes EVERY path recordedInstallPaths answers for the
// record, recursively, so the boundary check runs first over that same list,
// against a root this process derived rather than one the client supplied,
// and the whole request is refused before anything is deleted. The 200 body
// is the literal null, because the shim's fetchIpc assigns the parsed body
// straight to `data`.
function handleIntegrationsInstallRemove(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  deps: IntegrationsDeps,
): void {
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

      const rawRegistry = await deps.fsWrite.readTextFile(deps.installRegistryPath);
      const records = rawRegistry === null ? [] : parseInstallRegistry(rawRegistry);
      const record = findInstallRecord(records, toolId, scope);
      if (record === undefined) {
        // No record: removeInstallation is documented idempotent and would
        // return without touching the filesystem, so keep that silent no-op
        // rather than turning it into a failure.
        sendJson(res, 200, null);
        return;
      }

      const detections = scope.kind === 'global' ? await detectionsForPermittedRoots(deps) : [];
      const permittedRoot = permittedRootFor(toolId, scope, detections, deps.registry);
      // The list checked here is the list the engine deletes, read through
      // the same recordedInstallPaths the engine reads, so a ledger that is
      // corrupt, hand-edited or tampered with cannot pass one path inside
      // the root and have a second one outside it deleted. Every path is
      // checked before any is removed, and one failure refuses the whole
      // request.
      for (const recorded of recordedInstallPaths(record)) {
        const resolvedTarget = path.resolve(recorded);
        // The trailing path.sep is what makes this a boundary rather than a bare
        // prefix: without it a sibling whose name merely begins with the root's
        // name would pass. Equality with the root is refused too — a tracked
        // install is always a path under its base, never the base.
        if (permittedRoot === null || !resolvedTarget.startsWith(permittedRoot + path.sep)) {
          sendJson(res, 400, {
            error: `Refused remove path outside the permitted root for ${toolId}: ${recorded}`,
          });
          return;
        }
      }
      await removeInstallation(toolId, scope, deps.installRegistryPath, { fsWrite: deps.fsWrite });
      sendJson(res, 200, null);
    } catch (err) {
      sendJson(res, 500, { error: errorMessage(err) });
    }
  });
}

// Answers true when it handled the request, false when the path is not in this
// branch — or is in the branch but matches no route, which keeps an unmatched
// /api/integrations/ path on the dispatcher's outer 404 rather than answering
// it from here.
export function handleIntegrationsRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  reqPath: string,
  method: string,
  deps: IntegrationsDeps,
): boolean {
  if (!reqPath.startsWith('/api/integrations/')) return false;

  // The loopback gate, above every route match and before any body is read,
  // in the same position and with the same uniform rejection shape as the
  // Content-Type check at the top of the dispatcher. These routes write and
  // recursively delete files under real tool config directories on a server
  // with no authentication, so they are refused to any non-local peer. This
  // is a peer-address check, distinct from the Host-header check
  // passesOriginCheck already performs; neither replaces the other.
  if (!isLoopbackRemote(req)) {
    sendJson(res, 403, { error: 'Integrations are available only from this machine' });
    return true;
  }

  if (reqPath === '/api/integrations/tools') {
    if (method !== 'GET') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return true;
    }
    void handleIntegrationsTools(res, deps);
    return true;
  }

  if (reqPath === '/api/integrations/releases') {
    if (method !== 'GET') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return true;
    }
    void handleIntegrationsReleases(res);
    return true;
  }

  if (reqPath === '/api/integrations/skill-presence') {
    if (method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return true;
    }
    handleIntegrationsSkillPresence(req, res, deps);
    return true;
  }

  if (reqPath === '/api/integrations/installs') {
    if (method === 'GET') {
      void handleIntegrationsInstallsGet(res, deps);
      return true;
    }
    if (method === 'POST') {
      handleIntegrationsInstallsPost(req, res, deps);
      return true;
    }
    sendJson(res, 405, { error: 'Method not allowed' });
    return true;
  }

  if (reqPath === '/api/integrations/installs/remove') {
    if (method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return true;
    }
    handleIntegrationsInstallRemove(req, res, deps);
    return true;
  }

  // An unmatched /api/integrations/ path falls through to the dispatcher's 404.
  return false;
}
