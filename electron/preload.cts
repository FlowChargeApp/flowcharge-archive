// This file is the preload script, wired via webPreferences.preload by
// main.cts. It exists so that path points at a real compiled file, proving
// the source-to-dist/electron/*.cjs build pipeline end-to-end. It stays a
// near-empty structural stub with no renderer-exposed API surface, since
// there is nothing to expose yet; building the IPC bridge is WS-37's job.

export {};
