// The application service. It composes the two driven ports — the project
// registry and the markdown workstream store — into the six operations the
// driving port declares, and it is the only orchestration module in this app.
//
// It knows the two ports and the result variants. It does not know the transport
// layer, transport status codes, the console, the environment, or any string a
// user reads in an error body. Wire-format validation stays at the route
// boundary; the one domain rule that lives here is that a project is a directory
// holding a workstream tree.

import type { BoardApi, AddProjectResult, BoardResult, DetailResult } from '../ports/app-api.js';
import type { ProjectRegistry } from '../ports/project-registry.js';
import type { WorkstreamStore } from '../ports/workstream-store.js';

export interface BoardApiDeps {
  registry: ProjectRegistry;
  store: WorkstreamStore;
}

export function createBoardApi(deps: BoardApiDeps): BoardApi {
  const { registry, store } = deps;

  // The layout's directory when the resolution is legacy, and null otherwise.
  // The core decides the fact; the caller decides the wording.
  function legacyDirFor(projectRoot: string): string | null {
    const layout = store.resolveLayout(projectRoot);
    return layout !== null && layout.legacy ? layout.dir : null;
  }

  return {
    listProjects() {
      return registry.list();
    },

    addProject(absolutePath: string): AddProjectResult {
      if (!store.hasTree(absolutePath)) {
        return { kind: 'no-tree', path: absolutePath };
      }
      const legacyLayoutDir = legacyDirFor(absolutePath);
      const { entry, created } = registry.add(absolutePath);
      return { kind: 'ok', entry, created, legacyLayoutDir };
    },

    removeProject(id: string) {
      return registry.remove(id);
    },

    renameProject(id: string, name: string) {
      return registry.rename(id, name);
    },

    getBoard(projectId: string): BoardResult {
      const entry = registry.find(projectId);
      if (!entry) return { kind: 'unknown-project' };
      if (!store.hasTree(entry.path)) return { kind: 'tree-missing', path: entry.path };
      const legacyLayoutDir = legacyDirFor(entry.path);
      // Key order is load-bearing: the extraction result spreads first, then
      // branch, then name, so the serialised payload keeps its byte order.
      const payload: BoardPayload = {
        ...store.readBoard(entry.path),
        branch: store.readBranch(entry.path),
        name: entry.name,
      };
      return { kind: 'ok', payload, legacyLayoutDir };
    },

    getDetail(projectId: string, workstreamId: string): DetailResult {
      const entry = registry.find(projectId);
      if (!entry) return { kind: 'unknown-project' };
      if (!store.hasTree(entry.path)) return { kind: 'tree-missing', path: entry.path };
      const legacyLayoutDir = legacyDirFor(entry.path);
      const detail = store.readDetail(entry.path, workstreamId);
      if (!detail) return { kind: 'unknown-workstream' };
      return { kind: 'ok', detail, legacyLayoutDir };
    },
  };
}
