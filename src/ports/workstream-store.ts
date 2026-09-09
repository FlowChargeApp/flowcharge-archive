// Driven port for the markdown workstream store. Types only: no filesystem, no
// transport and no environment reads, and no imports of any kind. The adapter
// that implements it owns the disk and the parsers; this file owns the contract
// between them and its callers.
// PraxisData and PraxisWorkstreamDetail are global from
// src/types/praxis-data.d.ts and are referenced unqualified.

export type LayoutGeneration = 'flowcharge' | 'prxwork';

export interface TreeLayout {
  dir: string;
  generation: LayoutGeneration;
  legacy: boolean;
}

export interface WorkstreamStore {
  resolveLayout(projectRoot: string): TreeLayout | null;
  hasTree(projectRoot: string): boolean;
  // Throws when the project root holds no workstream tree. That failure shape
  // differs from readDetail's on purpose: the caller maps a missing tree and an
  // unknown workstream to two different outcomes.
  readBoard(projectRoot: string): PraxisData;
  // Returns null when the workstream id is not present in the tree.
  readDetail(projectRoot: string, workstreamId: string): PraxisWorkstreamDetail | null;
  readBranch(projectRoot: string): string | null;
}
