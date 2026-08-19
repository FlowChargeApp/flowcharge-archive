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

// --- Locally-mirrored types (see file-header comment for why these can't be
// `import type`-ed from src/lib/agentic-tools-*.ts instead). ---

interface LocalToolDefinition {
  id: string;
  [key: string]: unknown;
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

type ParseInstallRegistryFn = (raw: string) => InstallRecord[];
type CreateNodeFsWriteAccessFn = () => FsWriteAccess;

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

// The still-placeholder Gap 1 port (plan Assumption 9): real skill content
// stays out of scope for this workstream, including here in the real IPC
// wiring. Returns an empty skill set for every toolId.
async function getInstallContent(_toolId: string): Promise<InstallContent> {
  return { version: 'placeholder', skills: [] };
}

const dynamicImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string
) => Promise<unknown>;

// Populated once, before any ipcMain.handle registration, by the dynamic
// import resolution in registerAgenticToolsIpcHandlers below. The "!"
// definite-assignment assertions are safe here: every ipcMain.handle
// callback below only runs after registerAgenticToolsIpcHandlers's `await`
// has resolved and assigned these, since ipcMain.handle registration itself
// happens after that await.
let installToTarget!: InstallToTargetFn;
let removeInstallation!: RemoveInstallationFn;
let parseInstallRegistry!: ParseInstallRegistryFn;
let TOOL_CATALOGUE!: LocalToolDefinition[];
let fsWrite!: FsWriteAccess;

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
  };
  const fsAdapterModule = (await dynamicImport('../lib/agentic-tools-fs-adapter.js')) as {
    createNodeFsWriteAccess: CreateNodeFsWriteAccessFn;
  };
  const catalogueModule = (await dynamicImport('../lib/agentic-tools-catalogue.js')) as {
    TOOL_CATALOGUE: LocalToolDefinition[];
  };

  installToTarget = installModule.installToTarget;
  removeInstallation = installModule.removeInstallation;
  parseInstallRegistry = trackingModule.parseInstallRegistry;
  TOOL_CATALOGUE = catalogueModule.TOOL_CATALOGUE;
  fsWrite = fsAdapterModule.createNodeFsWriteAccess();

  ipcMain.handle(
    'installSelected',
    async (_event, targets: InstallTargetRequest[]): Promise<PraxisIpcResult<InstallResult[]>> => {
      try {
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
        await removeInstallation(toolId, scope, registryPath, { fsWrite });
        return { ok: true, status: 200, data: null };
      } catch (err) {
        return { ok: false, status: 500, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );
}
