// Workstream tree resolver: turns a project root into the single folder that
// holds its workstreams, and names the marker file a workstream folder is
// recognised by. It owns both name generations — the current `flowcharge/` with
// `workstream.md`, and the legacy `prxwork/` with `prxworkstream.md` — and
// nothing else. It knows a filesystem path and two pairs of names; it knows
// nothing about frontmatter, artefact types, the registry, the transport layer
// or the board payload. It returns facts and logs nothing, so the caller decides
// what a legacy resolution should print.

import fs from 'node:fs';
import path from 'node:path';

export type LayoutGeneration = 'flowcharge' | 'prxwork';

export interface TreeLayout {
  dir: string;
  generation: LayoutGeneration;
  legacy: boolean;
}

// Candidate folder basenames, NEW GENERATION FIRST. Order is the whole of the
// precedence rule: a root holding both folders resolves `flowcharge/`, and the
// legacy tree is never preferred over the current one.
const GENERATIONS: readonly LayoutGeneration[] = ['flowcharge', 'prxwork'];

// The two marker basenames, new generation first. A single list, so the locate
// walk and the artefact-loop skip can never disagree about what a marker file
// is — one of them recognising a name the other does not is how a workstream
// either vanishes from the board or shows up as a phantom artefact row.
export const WORKSTREAM_MARKERS: readonly string[] = ['workstream.md', 'prxworkstream.md'];

export function isWorkstreamMarker(file: string): boolean {
  return WORKSTREAM_MARKERS.includes(file);
}

// `existsSync` followed by `statSync` throws when the entry disappears in
// between, and `statSync` on a dangling symlink throws ENOENT, so the stat sits
// inside its own try/catch and every failure reads as "not a directory". The
// `isDirectory()` test is what separates a real folder from a plain FILE named
// `flowcharge`: existence alone accepts the file, and the walk above then finds
// nothing and reports no error.
function isDirectory(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

// Resolves a project root to its workstream tree, or null when it has none.
// Never throws — every caller treats an unreadable root as "no tree here".
//
// The candidates are joined by EXACT basename. There is no prefix test, no
// glob, no `startsWith` and no `readdir` scan, and that is load-bearing rather
// than defensive: this repository's own root holds `prxwork-bak/` beside
// `flowcharge/` today, and a prefix match would render a board from that stale
// backup with no error at all.
export function resolveTreeLayout(root: string): TreeLayout | null {
  let resolvedRoot: string;
  try {
    resolvedRoot = path.resolve(root);
  } catch {
    return null;
  }
  for (const generation of GENERATIONS) {
    const dir = path.join(resolvedRoot, generation);
    if (isDirectory(dir)) {
      return { dir, generation, legacy: generation === 'prxwork' };
    }
  }
  return null;
}

export function hasWorkstreamTree(root: string): boolean {
  return resolveTreeLayout(root) !== null;
}
