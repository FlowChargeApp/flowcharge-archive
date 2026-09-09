// Port for the CLI entry point's bootstrap step, today embedded as generated
// string lines in tools/package-cli.mjs. Types only: no filesystem, no
// environment reads and no imports of any kind. The adapter that implements it
// owns the filesystem; this file owns the contract between them and its
// callers.
// NodeJS.ProcessEnv is an ambient type and is referenced unqualified.

export interface CliBootstrapInput {
  version: string; // injected at build time from package.json
  homeDir: string; // os.homedir()
  // Mutated in place, not copied and returned. That is what lets the generated
  // entry call the adapter as a statement whose effects are visible to the
  // server it then imports dynamically.
  env: NodeJS.ProcessEnv;
}

export interface CliBootstrapResult {
  dataDir: string; // the resolved data directory, created if it was absent
}
