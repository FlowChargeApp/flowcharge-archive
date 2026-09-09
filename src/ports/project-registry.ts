// Driven port for .praxis-projects.json. Types only: no filesystem, no HTTP and
// no environment reads, and no imports of any kind. The adapter that implements
// it owns the filesystem and the environment; this file owns the contract
// between them and its callers.
// ProjectEntry is global from src/types/praxis-data.d.ts and is referenced
// unqualified, exactly as src/lib/projects.ts does today.

export interface ProjectRegistry {
  list(): ProjectEntry[];
  find(id: string): ProjectEntry | undefined;
  // Returns `created` as well as the entry, because the HTTP layer maps a newly
  // created row to 201 and an already-present row to 200.
  add(absPath: string): { entry: ProjectEntry; created: boolean };
  remove(id: string): ProjectEntry | undefined;
  rename(id: string, name: string): ProjectEntry | undefined;
}

export interface ProjectRegistryConfig {
  dataDir: string; // where .praxis-projects.json lives
  repoRoot: string; // the self-entry's path
  packaged: boolean; // suppresses the self-entry on a missing file
}
