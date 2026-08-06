// Git branch reader: resolves a project directory to the name of the branch its
// checkout is on, by reading .git/HEAD. Knows a filesystem path and git's on-disk
// HEAD format; knows nothing about the registry, the transport layer, prxwork, or
// the board payload.

import fs from 'node:fs';
import path from 'node:path';

// Every failure mode returns null rather than throwing — a missing .git, an
// unreadable HEAD, a detached HEAD and a dangling gitdir: pointer are all normal
// states here, so the whole body sits inside one try/catch and nothing is logged.
export function readBranch(root: string): string | null {
  try {
    const gitPath = path.join(path.resolve(root), '.git');
    const stat = fs.statSync(gitPath);

    let gitDir: string;
    if (stat.isDirectory()) {
      gitDir = gitPath;
    } else {
      // A .git *file* holds a `gitdir:` pointer — this covers both linked
      // worktrees and submodules. One hop and only one hop: the directory it
      // points at contains a real HEAD. The pointer is absolute in git's normal
      // output but is legally relative, and path.resolve handles both.
      const pointer = fs.readFileSync(gitPath, 'utf8').match(/^gitdir:\s*(.+)$/m);
      if (!pointer) return null;
      gitDir = path.resolve(path.dirname(gitPath), pointer[1].trim());
    }

    // The branch NAME is literally the text in HEAD; it never needs resolving to
    // a SHA, so there is no ref, packed-refs or object-store read here. A bare
    // 40-hex SHA (detached HEAD) simply fails to match and yields null.
    const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
    const ref = head.match(/^ref:\s*refs\/heads\/(.+)$/);
    if (!ref) return null;
    return ref[1].trim();
  } catch {
    return null;
  }
}
