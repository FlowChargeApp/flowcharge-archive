// Main-process IPC bridge for the agentic-tools skill install engine. Unlike
// WS-37's own ipc-handlers.cts, this file calls src/lib/agentic-tools-*.ts's
// functions directly, in-process — no loopback HTTP relay to server.ts,
// because this engine has no HTTP route of its own to relay to. This file
// delegates entirely to agentic-tools-install.ts: it does not know per-tool
// format details itself, and it never touches node:fs directly, only the
// concrete FsWriteAccess from agentic-tools-fs-adapter.ts.
//
// This file must never import — VALUE *or* TYPE — anything from
// src/lib/agentic-tools-*.ts at the top level. Two independent problems rule
// that out, both confirmed by direct testing while fixing this file, not
// assumed:
//
// 1. Runtime (why a VALUE import breaks): electron/tsconfig.json always
//    compiles .cts files to CommonJS, which turns a value import into a
//    require() call — but src/lib/*.ts compiles (via the root tsconfig.json)
//    to real ESM, because the root package.json sets "type": "module".
//    require() cannot synchronously load an ESM module, so a static value
//    import here throws ERR_REQUIRE_ESM at runtime.
//
// 2. Compile-time (why even a TYPE-ONLY import isn't a safe workaround):
//    electron/tsconfig.json sets an explicit narrow rootDir (".", i.e. this
//    directory only, restored after a prior attempt widened it — see below).
//    TypeScript's rootDir/outDir emit-path computation applies to *every*
//    file that ends up part of the program, including files pulled in only
//    for `import type`, not just files that get required at runtime. Even a
//    single, self-contained `import type { Foo } from '../src/lib/x.js'`
//    with zero further imports fails with TS6059 ("File ... is not under
//    'rootDir'") the moment tsc tries to emit — confirmed with an isolated
//    two-file reproduction outside this repo. Widening rootDir to fix that
//    (a real prior attempt, since reverted) makes tsc ALSO compile
//    src/lib/*.ts a second time, as CommonJS, into a stray dist/src/lib/*.js
//    tree with a plain .js extension — which crashes on load exactly like
//    (1) once anything requires it, and is dead, confusing build output even
//    when nothing does.
//
// So this file gets its types from small, hand-mirrored local declarations
// below (never imported from src/lib) and its values from a dynamic
// import(), resolved once before any ipcMain.handle registration. The
// dynamic import mirrors electron/main.cts's own existing dynamicImport
// pattern (see the comment there): routed through
// `new Function('specifier', 'return import(specifier)')` so tsc's
// CommonJS downlevel transform never sees a literal `import(...)` to rewrite
// into a require()-based helper, keeping a genuine native dynamic import at
// runtime — which a CommonJS module can use to load an ESM module.
//
// The local type declarations below must be kept in sync by hand with their
// real counterparts (FsWriteAccess, InstallResult, InstallStatus,
// InstallTarget, InstallScope, InstallRecord in agentic-tools-install.ts /
// agentic-tools-install-tracking.ts; InstallContent in
// agentic-tools-content.ts) if those ever change shape — there is no
// compiler check tying the two together, by construction of this file's
// rootDir boundary.

import { ipcMain } from 'electron';
import path from 'node:path';
import os from 'node:os';

// --- Locally-mirrored types (see file-header comment for why these can't be
// `import type`-ed from src/lib/agentic-tools-*.ts instead). ---

type LocalOS = 'macos' | 'linux' | 'windows';
type LocalToolCategory = 'cli' | 'gui-app';

interface LocalToolDefinition {
  id: string;
  displayName: string;
  category: LocalToolCategory;
  [key: string]: unknown;
}

type DetectionConfidence = 'confirmed' | 'likely' | 'weak' | 'not-detected';

interface DetectionResult {
  toolId: string;
  confidence: DetectionConfidence;
  resolvedConfigDir: string | null;
  matchedSignals: string[];
  needsManualVerification: boolean;
}

export interface ToolDetectionRow {
  toolId: string;
  displayName: string;
  category: LocalToolCategory;
  detection: DetectionResult;
}

interface FsAccess {
  pathExists(path: string): Promise<boolean>;
  isDirectory(path: string): Promise<boolean>;
  resolveBinaryOnPath(name: string): Promise<string | null>;
  expandTokens(path: string): Promise<string>;
}

// Maps Node's os.platform() to WS-41's OS union. An unmapped platform (e.g.
// 'aix', 'freebsd') returns null rather than guessing a bucket — the
// detectTools handler turns that into a failed PraxisIpcResult instead of
// calling detectAllTools with a fabricated OS.
function mapNodePlatformToOs(platform: NodeJS.Platform): LocalOS | null {
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

export type InstallScope = { kind: 'global' } | { kind: 'project'; projectPath: string };

export interface InstallRecord {
  toolId: string;
  resolvedPath: string;
  format: string;
  scope: InstallScope;
  installedAt: string;
  updatedAt: string;
  contentHash: string;
}

interface FsWriteAccess {
  readTextFile(path: string): Promise<string | null>;
  writeTextFileAtomic(path: string, content: string): Promise<void>;
  mkdir(path: string): Promise<void>;
  remove(path: string): Promise<void>;
  expandTokens(path: string): Promise<string>;
}

interface InstallTarget {
  tool: LocalToolDefinition;
  basePath: string;
  scope: InstallScope;
}

type InstallStatus = 'installed' | 'updated' | 'up-to-date' | 'skipped-no-format';

export interface InstallResult {
  toolId: string;
  status: InstallStatus;
  resolvedPath: string | null;
}

export interface InstallContent {
  version: string;
  skills: {
    id: string;
    name: string;
    description: string;
    body: string;
    files?: { relativePath: string; content: string }[];
  }[];
}

// Mirrors agentic-tools-skill-presence.ts's SkillPresenceResult union — kept
// in sync by hand, same caveat as every other locally-mirrored type here.
type SkillPresenceResult =
  | {
      checkKind: 'per-skill';
      status: 'fully-installed' | 'missing-incomplete' | 'not-installed';
      presentSkillIds: string[];
      missingSkillIds: string[];
    }
  | { checkKind: 'shared-file'; exists: boolean }
  | { checkKind: 'no-format' };

type InstallToTargetFn = (
  target: InstallTarget,
  content: InstallContent,
  registryPath: string,
  deps: { fsWrite: FsWriteAccess }
) => Promise<InstallResult>;

type RemoveInstallationFn = (
  toolId: string,
  scope: InstallScope,
  registryPath: string,
  deps: { fsWrite: FsWriteAccess }
) => Promise<void>;

type GetInstallContentFn = (toolId: string) => Promise<InstallContent>;
type ParseInstallRegistryFn = (raw: string) => InstallRecord[];
type FindInstallRecordFn = (
  records: InstallRecord[],
  toolId: string,
  scope: InstallScope
) => InstallRecord | undefined;

// Mirrors src/types/praxis-data.d.ts's ProjectEntry. Only `path` is read here
// — it is the permitted root for a project-scoped install — but the whole
// shape is mirrored so this stays recognisable against its real counterpart,
// same hand-sync caveat as every other local type in this file.
interface LocalProjectEntry {
  id: string;
  name: string;
  path: string;
  added: string;
}

type ReadProjectsFn = () => LocalProjectEntry[];
type CreateNodeFsWriteAccessFn = () => FsWriteAccess;
type CreateNodeFsAccessFn = () => FsAccess;
type DetectAllToolsFn = (fsAccess: FsAccess, os: LocalOS) => Promise<DetectionResult[]>;
type CheckSkillPresenceFn = (
  tool: LocalToolDefinition,
  basePath: string,
  skillIds: string[],
  fsAccess: FsAccess
) => Promise<SkillPresenceResult>;

// Mirrors electron/ipc-handlers.cts's own PraxisIpcResult<T> shape exactly —
// a third mirror of an already-twice-mirrored shape, matching this
// codebase's established pattern, not a new one. See this workstream's task
// list Divergence 2: the WS-37 file this is mirrored from could not be read
// verbatim at authoring time; this mirrors the plan's own stated contract.
export type PraxisIpcResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string };

export interface InstallTargetRequest {
  toolId: string;
  basePath: string;
  scope: InstallScope;
}

// This file compiles to dist/electron/agentic-tools-ipc-handlers.cjs, two
// levels up from the repo root — the same two-levels-up computation
// src/lib/projects.ts:9-14 uses, adapted to this file's plain CommonJS
// __dirname (no import.meta.url available under electron/tsconfig.json's
// "module": "commonjs").
const repoRoot = path.join(__dirname, '..', '..');
const registryPath = path.join(repoRoot, '.praxis-installs.json');

const dynamicImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string
) => Promise<unknown>;

// Populated once, before any ipcMain.handle registration, by the dynamic
// import resolution in registerAgenticToolsIpcHandlers below. The "!"
// definite-assignment assertions are safe here: every ipcMain.handle
// callback below only runs after registerAgenticToolsIpcHandlers's `await`
// has resolved and assigned these, since ipcMain.handle registration itself
// happens after that await.
let getInstallContent!: GetInstallContentFn;
let installToTarget!: InstallToTargetFn;
let removeInstallation!: RemoveInstallationFn;
let parseInstallRegistry!: ParseInstallRegistryFn;
let findInstallRecord!: FindInstallRecordFn;
let readProjects!: ReadProjectsFn;
let TOOL_CATALOGUE!: LocalToolDefinition[];
let fsWrite!: FsWriteAccess;
let detectAllTools!: DetectAllToolsFn;
let createNodeFsAccess!: CreateNodeFsAccessFn;
let checkSkillPresence!: CheckSkillPresenceFn;
let CANONICAL_PRAXIS_SKILL_IDS!: string[];

// Runs the same detection sweep the detectTools handler runs, so the main
// process can derive a global scope's permitted root itself instead of
// trusting the basePath the renderer chose. Called at most once per IPC call
// and never cached across calls: detectAllTools touches the filesystem for
// every catalogue tool, so once per batch is right, but a tool installed
// mid-session must become permitted without an app restart.
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
// the renderer. A 'project' scope is permitted only at a path that is in the
// project registry right now; a 'global' scope only at that tool's own
// detected config directory, read from `detections` at the tool's index in
// TOOL_CATALOGUE, the same index alignment the detectTools handler relies on.
// Returns null when there is no permitted root — including for an
// unrecognised scope kind, since the scope arrives over IPC and is
// structurally typed only — so the caller refuses rather than guesses.
function permittedRootFor(
  toolId: string,
  scope: InstallScope,
  detections: DetectionResult[]
): string | null {
  if (scope.kind === 'project') {
    if (typeof scope.projectPath !== 'string' || scope.projectPath === '') return null;
    const resolved = path.resolve(scope.projectPath);
    // readProjects() is re-read per call on purpose: it reads
    // .praxis-projects.json out of PRAXIS_DATA_DIR when that is set, so a
    // packaged run and an unpackaged run see different registries, and a
    // project added during this session must not be wrongly refused.
    const registered = readProjects().some(
      (entry) => typeof entry.path === 'string' && path.resolve(entry.path) === resolved
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

export async function registerAgenticToolsIpcHandlers(): Promise<void> {
  // Specifiers below are relative to this file's *compiled* location
  // (dist/electron/agentic-tools-ipc-handlers.cjs), which is how Node
  // resolves a relative dynamic import() specifier from a CommonJS module —
  // NOT relative to this .cts source file. dist/lib/*.js is where the root
  // tsconfig.json (rootDir "src", outDir "dist") emits src/lib/*.ts as ESM.
  const installModule = (await dynamicImport('../lib/agentic-tools-install.js')) as {
    installToTarget: InstallToTargetFn;
    removeInstallation: RemoveInstallationFn;
  };
  const trackingModule = (await dynamicImport('../lib/agentic-tools-install-tracking.js')) as {
    parseInstallRegistry: ParseInstallRegistryFn;
    findInstallRecord: FindInstallRecordFn;
  };
  const projectsModule = (await dynamicImport('../lib/projects.js')) as {
    readProjects: ReadProjectsFn;
  };
  const fsAdapterModule = (await dynamicImport('../lib/agentic-tools-fs-adapter.js')) as {
    createNodeFsWriteAccess: CreateNodeFsWriteAccessFn;
    createNodeFsAccess: CreateNodeFsAccessFn;
  };
  const catalogueModule = (await dynamicImport('../lib/agentic-tools-catalogue.js')) as {
    TOOL_CATALOGUE: LocalToolDefinition[];
  };
  const detectModule = (await dynamicImport('../lib/agentic-tools-detect.js')) as {
    detectAllTools: DetectAllToolsFn;
  };
  const skillPresenceModule = (await dynamicImport('../lib/agentic-tools-skill-presence.js')) as {
    checkSkillPresence: CheckSkillPresenceFn;
  };
  const canonicalSkillsModule = (await dynamicImport('../lib/agentic-tools-canonical-skills.js')) as {
    CANONICAL_PRAXIS_SKILL_IDS: string[];
  };
  const skillContentModule = (await dynamicImport('../lib/skill-content-fetch.js')) as {
    getInstallContent: GetInstallContentFn;
  };

  getInstallContent = skillContentModule.getInstallContent;
  installToTarget = installModule.installToTarget;
  removeInstallation = installModule.removeInstallation;
  parseInstallRegistry = trackingModule.parseInstallRegistry;
  findInstallRecord = trackingModule.findInstallRecord;
  readProjects = projectsModule.readProjects;
  TOOL_CATALOGUE = catalogueModule.TOOL_CATALOGUE;
  fsWrite = fsAdapterModule.createNodeFsWriteAccess();
  createNodeFsAccess = fsAdapterModule.createNodeFsAccess;
  detectAllTools = detectModule.detectAllTools;
  checkSkillPresence = skillPresenceModule.checkSkillPresence;
  CANONICAL_PRAXIS_SKILL_IDS = canonicalSkillsModule.CANONICAL_PRAXIS_SKILL_IDS;

  ipcMain.handle(
    'installSelected',
    async (_event, targets: InstallTargetRequest[]): Promise<PraxisIpcResult<InstallResult[]>> => {
      try {
        // Validate every target's basePath against a root this process
        // derived for itself BEFORE installing any of them, so a single bad
        // path in the batch cannot be smuggled in behind earlier good ones.
        // Exact equality is the right comparison, not containment: the
        // renderer's resolveBasePathForScope returns exactly
        // resolvedConfigDir or exactly projectPath, so a legitimate basePath
        // always equals the permitted root and is never merely inside it.
        const needsDetection = targets.some((target) => target.scope.kind === 'global');
        const detections = needsDetection ? await detectionsForPermittedRoots() : [];
        for (const target of targets) {
          // An unknown toolId never reaches installToTarget — the loop below
          // records it as skipped-no-format — so it needs no permitted root.
          if (!TOOL_CATALOGUE.some((t) => t.id === target.toolId)) continue;
          const permittedRoot = permittedRootFor(target.toolId, target.scope, detections);
          if (permittedRoot === null || path.resolve(target.basePath) !== permittedRoot) {
            return {
              ok: false,
              status: 400,
              error: `Refused install path outside the permitted root for ${target.toolId}: ${target.basePath}`,
            };
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
            registryPath,
            { fsWrite }
          );
          results.push(result);
        }
        return { ok: true, status: 200, data: results };
      } catch (err) {
        return { ok: false, status: 500, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );

  ipcMain.handle('getInstallStatus', async (): Promise<PraxisIpcResult<InstallRecord[]>> => {
    try {
      const raw = await fsWrite.readTextFile(registryPath);
      const records = raw === null ? [] : parseInstallRegistry(raw);
      return { ok: true, status: 200, data: records };
    } catch (err) {
      return { ok: false, status: 500, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(
    'removeInstallation',
    async (_event, toolId: string, scope: InstallScope): Promise<PraxisIpcResult<null>> => {
      try {
        // removeInstallation deletes the record's resolvedPath recursively,
        // so the path that delete lands on is checked here first, against a
        // root this process derived rather than one the renderer supplied.
        const raw = await fsWrite.readTextFile(registryPath);
        const records = raw === null ? [] : parseInstallRegistry(raw);
        const record = findInstallRecord(records, toolId, scope);
        if (record === undefined) {
          // No record: removeInstallation is documented idempotent and would
          // return without touching the filesystem, so keep that silent
          // no-op rather than turning it into a new failure.
          return { ok: true, status: 200, data: null };
        }
        const detections = scope.kind === 'global' ? await detectionsForPermittedRoots() : [];
        const permittedRoot = permittedRootFor(toolId, scope, detections);
        const resolvedTarget = path.resolve(record.resolvedPath);
        // The trailing path.sep is what makes this a boundary rather than a
        // bare prefix: without it a sibling whose name merely begins with the
        // root's name would pass. Equality with the root is refused too — a
        // tracked install is always a path under its base, never the base.
        if (permittedRoot === null || !resolvedTarget.startsWith(permittedRoot + path.sep)) {
          return {
            ok: false,
            status: 400,
            error: `Refused remove path outside the permitted root for ${toolId}: ${record.resolvedPath}`,
          };
        }
        await removeInstallation(toolId, scope, registryPath, { fsWrite });
        return { ok: true, status: 200, data: null };
      } catch (err) {
        return { ok: false, status: 500, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );

  ipcMain.handle('detectTools', async (): Promise<PraxisIpcResult<ToolDetectionRow[]>> => {
    try {
      const platform = os.platform();
      const mappedOs = mapNodePlatformToOs(platform);
      if (mappedOs === null) {
        return { ok: false, status: 500, error: `Unsupported OS: ${platform}` };
      }
      const results = await detectAllTools(createNodeFsAccess(), mappedOs);
      const rows: ToolDetectionRow[] = TOOL_CATALOGUE.map((tool, index) => ({
        toolId: tool.id,
        displayName: tool.displayName,
        category: tool.category,
        detection: results[index],
      }));
      return { ok: true, status: 200, data: rows };
    } catch (err) {
      return { ok: false, status: 500, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(
    'checkInstalledSkills',
    async (_event, request: InstallTargetRequest): Promise<PraxisIpcResult<SkillPresenceResult>> => {
      try {
        const tool = TOOL_CATALOGUE.find((t) => t.id === request.toolId);
        if (tool === undefined) {
          return { ok: false, status: 404, error: `Unknown toolId: ${request.toolId}` };
        }
        const result = await checkSkillPresence(tool, request.basePath, CANONICAL_PRAXIS_SKILL_IDS, createNodeFsAccess());
        return { ok: true, status: 200, data: result };
      } catch (err) {
        return { ok: false, status: 500, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );
}
