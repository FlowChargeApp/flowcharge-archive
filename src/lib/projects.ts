// Project registry library: owns .praxis-projects.json at the repo root and the
// four operations over it. Knows the registry and its shape; knows nothing about
// the transport layer, prxwork parsing, or the board payload.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// This file compiles to dist/lib/projects.js, so two levels up is the repo root.
// The registry lives there, and the repo root is also the self-entry's path — one
// constant for both, so the two can never drift apart.
const repoRoot = path.join(__dirname, '..', '..');
const registryPath = path.join(repoRoot, '.praxis-projects.json');

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
    return (err as NodeJS.ErrnoException).code === 'ENOENT' ? [selfEntry()] : [];
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
  const list: ProjectList = { projects };
  fs.writeFileSync(registryPath, JSON.stringify(list, null, 2));
  return { entry, created: true };
}
