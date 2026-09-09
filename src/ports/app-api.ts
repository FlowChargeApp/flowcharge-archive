// The driving port. It is what the transport adapter and the CLI adapter reach
// the application through, and it is where the route handlers' branch decisions
// become data. Types only: no transport, no filesystem and no environment reads,
// and no imports of any kind. Statuses stay in the transport adapter; the core
// returns variants.
// ProjectEntry, BoardPayload and PraxisWorkstreamDetail are global from
// src/types/praxis-data.d.ts and are referenced unqualified.
//
// The status mapping the transport adapter must preserve, recorded here for its
// benefit and deliberately not encoded in any type below:
//   unknown-project     -> 404
//   tree-missing        -> 410
//   unknown-workstream  -> 404
//   no-tree             -> 400, with the existing message text
//   addProject ok       -> 201 when `created`, else 200
//
// legacyLayoutDir rides on every `ok` variant. It is the fact that lets the
// transport layer print its LEGACY LAYOUT line without importing the layout
// resolver: the core decides whether the layout is legacy and which directory it
// resolved to, and the caller decides the wording.

export type BoardResult =
  | { kind: 'ok'; payload: BoardPayload; legacyLayoutDir: string | null }
  | { kind: 'unknown-project' }
  | { kind: 'tree-missing'; path: string };

export type DetailResult =
  | { kind: 'ok'; detail: PraxisWorkstreamDetail; legacyLayoutDir: string | null }
  | { kind: 'unknown-project' }
  | { kind: 'tree-missing'; path: string }
  | { kind: 'unknown-workstream' };

export type AddProjectResult =
  | { kind: 'ok'; entry: ProjectEntry; created: boolean; legacyLayoutDir: string | null }
  | { kind: 'no-tree'; path: string };

export interface BoardApi {
  listProjects(): ProjectEntry[];
  addProject(absolutePath: string): AddProjectResult;
  removeProject(id: string): ProjectEntry | undefined;
  renameProject(id: string, name: string): ProjectEntry | undefined;
  getBoard(projectId: string): BoardResult;
  getDetail(projectId: string, workstreamId: string): DetailResult;
}
