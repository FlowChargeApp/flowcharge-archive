// Concrete FsWriteAccess adapter on plain node:fs/promises — unblocked under
// Electron (previously blocked under Tauri's capability system). A generic,
// reusable file-write utility only: this file must not import or reference
// any tool, format, or install-tracking concept, per Design > 'What each
// module knows / must not know' in PLN-32-m51bp8.

import fs from 'node:fs/promises';
import os from 'node:os';
import type { FsWriteAccess } from './agentic-tools-install.js';

export function createNodeFsWriteAccess(): FsWriteAccess {
  return {
    async readTextFile(path: string): Promise<string | null> {
      try {
        return await fs.readFile(path, 'utf8');
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw err;
      }
    },

    // Writes to a sibling `${path}.${process.pid}.tmp` file first, then
    // renames it over the target — the same reasoning as src/lib/projects.ts's
    // writeProjects (src/lib/projects.ts:42-47), generalized here from one
    // fixed registryPath to any caller-supplied path. The tmp file must be a
    // sibling of the real path (same directory), never under the OS temp
    // directory, or fs.rename can fail with EXDEV across filesystems.
    async writeTextFileAtomic(path: string, content: string): Promise<void> {
      const tmpPath = `${path}.${process.pid}.tmp`;
      await fs.writeFile(tmpPath, content, 'utf8');
      await fs.rename(tmpPath, path);
    },

    async mkdir(path: string): Promise<void> {
      await fs.mkdir(path, { recursive: true });
    },

    async remove(path: string): Promise<void> {
      await fs.rm(path, { recursive: true, force: true });
    },

    // Resolves a leading '~' against os.homedir() and '%VAR%' tokens against
    // process.env. Unset %VAR% tokens are left untouched rather than replaced
    // with an empty string, so a typo'd token stays visible instead of
    // silently collapsing the path.
    async expandTokens(path: string): Promise<string> {
      let expanded = path;
      if (expanded === '~' || expanded.startsWith('~/')) {
        expanded = os.homedir() + expanded.slice(1);
      }
      expanded = expanded.replace(/%([^%]+)%/g, (match, name: string) => {
        const value = process.env[name];
        return value !== undefined ? value : match;
      });
      return expanded;
    },
  };
}
