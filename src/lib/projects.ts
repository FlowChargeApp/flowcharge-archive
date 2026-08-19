// Project registry library: owns .praxis-projects.json and the six operations
// over it. Its directory defaults to the repo root but can be overridden via
// PRAXIS_DATA_DIR (set by electron/main.cts when packaged, since app.asar is
// read-only). Knows the registry and its shape; knows nothing about the
// transport layer, prxwork parsing, or the board payload.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// This file compiles to dist/lib/projects.js, so two levels up is the repo root.
// The registry lives there, and the repo root is also the self-entry's path — one
// constant for both, so the two can never drift apart.
const repoRoot = path.join(__dirname, '..', '..');
// electron/main.cts sets PRAXIS_DATA_DIR only when app.isPackaged, so its mere
// presence doubles as the "are we running from a packaged app.asar" signal
// without this file importing 'electron' or knowing anything about packaging
// beyond one env var. Unset in dev, a plain browser tab, and `npm run
// electron:dev`, so dataDir falls back to repoRoot exactly as before.
const dataDir = process.env.PRAXIS_DATA_DIR || repoRoot;
const registryPath = path.join(dataDir, '.praxis-projects.json');
const isPackaged = Boolean(process.env.PRAXIS_DATA_DIR);

export function projectId(absPath: string): string {
  return crypto.createHash('sha1').update(absPath).digest('hex').slice(0, 8);
}

// The dashboard repo is its own first project, built through the same id and name
// logic as every other entry so its board URL is stable and bookmarkable. Synthesised
// at read time, never persisted — the `added` date is simply today.
function selfEntry(): ProjectEntry {
  const resolved = path.resolve(repoRoot);
  return {
    id: projectId(resolved),
    name: path.basename(resolved),
    path: resolved,
    added: new Date().toISOString().slice(0, 10),
  };
}

// The one writer for the registry file. Every write goes to a sibling temporary
// file first and is then renamed over registryPath, because fs.writeFileSync
// truncates the target before it writes: a failure half way through would leave a
// truncated registry, readProjects would then fail to parse it and return [], and
// the user would silently lose the whole project list. The temporary file must be
// a sibling of registryPath — fs.renameSync is only atomic within one filesystem,
// so a temporary file under the OS temp directory can cross a device boundary and
// fail with EXDEV.
function writeProjects(projects: ProjectEntry[]): void {
  const list: ProjectList = { projects };
  const tmpPath = `${registryPath}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(list, null, 2));
  fs.renameSync(tmpPath, registryPath);
}

// A corrupted registry costs the user their list, never their ability to start
// the app: every failure mode returns an empty list rather than throwing. The one
// exception is a registry that was never written — a fresh clone gets the repo's
// own self-entry, so its home page has a working tile out of the box. Once the file
// exists it is authoritative: an empty list in it means an empty list here.
export function readProjects(): ProjectEntry[] {
  let raw: string;
  try {
    raw = fs.readFileSync(registryPath, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') return [];
    return isPackaged ? [] : [selfEntry()];
  }
  try {
    const parsed = JSON.parse(raw) as ProjectList;
    return Array.isArray(parsed.projects) ? parsed.projects : [];
  } catch {
    return [];
  }
}

export function findProject(id: string): ProjectEntry | undefined {
  return readProjects().find((p) => p.id === id);
}

export function addProject(absPath: string): { entry: ProjectEntry; created: boolean } {
  const resolved = path.resolve(absPath);
  const id = projectId(resolved);
  const projects = readProjects();

  const existing = projects.find((p) => p.id === id);
  if (existing) return { entry: existing, created: false };

  const entry: ProjectEntry = {
    id,
    name: path.basename(resolved),
    path: resolved,
    added: new Date().toISOString().slice(0, 10),
  };
  projects.push(entry);
  writeProjects(projects);
  return { entry, created: true };
}

// Removes the registry row only: nothing inside the project's own directory is
// read, moved, or deleted. An unknown id is not an error here — the library does
// not know what a 404 is, so it returns undefined and the caller decides.
export function removeProject(id: string): ProjectEntry | undefined {
  const projects = readProjects();
  const index = projects.findIndex((p) => p.id === id);
  if (index === -1) return undefined;
  const [removed] = projects.splice(index, 1);
  writeProjects(projects);
  return removed;
}

// Changes the stored display name only: `id` is the hash of `path`, so a rename
// moves neither, and `added` records when the row appeared, not when it changed.
// `name` arrives already validated — trimming, the length cap and the single-line
// check all live at the HTTP boundary, the way addProject already receives an
// already-validated path — so a future second caller must validate for itself.
// An unknown id returns undefined here; the 404 decision belongs to the caller.
export function renameProject(id: string, name: string): ProjectEntry | undefined {
  const projects = readProjects();
  const entry = projects.find((p) => p.id === id);
  if (!entry) return undefined;
  entry.name = name;
  writeProjects(projects);
  return entry;
}
