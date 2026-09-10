// Concrete FsWriteAccess adapter on plain node:fs/promises — unblocked under
// Electron (previously blocked under Tauri's capability system). A generic,
// reusable file-write utility only: this file must not import or reference
// any tool, format, or install-tracking concept, per Design > 'What each
// module knows / must not know' in PLN-32-m51bp8.

import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { FsWriteAccess } from './agentic-tools-install.js';
import type { FsAccess } from './agentic-tools-signals.js';

// Expands a leading '~' against os.homedir() and '%VAR%' tokens against
// process.env — the single shared implementation used by both
// createNodeFsAccess() (read side) and createNodeFsWriteAccess() (write
// side), per PLN-33-271zlx's Design section. Unset %VAR% tokens are left
// untouched rather than replaced with an empty string, so a typo'd token
// stays visible instead of silently collapsing the path.
function expandTokensImpl(input: string): string {
  const homeExpanded = input.startsWith('~') ? path.join(os.homedir(), input.slice(1)) : input;
  return homeExpanded.replace(/%([^%]+)%/g, (match, name: string) => process.env[name] ?? match);
}

// Concrete, real-filesystem FsAccess adapter — the read-side counterpart to
// createNodeFsWriteAccess() below. Implements WS-41's FsAccess port exactly
// (pathExists, isDirectory, resolveBinaryOnPath, expandTokens) against real
// node:fs/promises, node:os, and process.env/process.platform — no per-tool
// catalogue knowledge belongs in this file.
export function createNodeFsAccess(): FsAccess {
  return {
    async pathExists(targetPath: string): Promise<boolean> {
      try {
        await fs.access(targetPath);
        return true;
      } catch {
        return false;
      }
    },

    async isDirectory(targetPath: string): Promise<boolean> {
      try {
        const stat = await fs.stat(targetPath);
        return stat.isDirectory();
      } catch {
        return false;
      }
    },

    // Walks process.env.PATH, appending PATHEXT extensions only on win32,
    // and returns the first candidate that exists and is executable.
    async resolveBinaryOnPath(name: string): Promise<string | null> {
      const dirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
      const extensions =
        process.platform === 'win32'
          ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean)
          : [''];

      for (const dir of dirs) {
        for (const ext of extensions) {
          const candidate = path.join(dir, name + ext);
          try {
            await fs.access(candidate, fs.constants.X_OK);
            return candidate;
          } catch {
            // Not a hit — try the next candidate.
          }
        }
      }
      return null;
    },

    async expandTokens(input: string): Promise<string> {
      return expandTokensImpl(input);
    },
  };
}

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

    // Binary counterpart to readTextFile: no encoding argument, so
    // fs.readFile resolves to a Buffer and the bytes survive verbatim.
    // Same null-on-ENOENT / rethrow-everything-else contract.
    async readBinaryFile(path: string): Promise<Buffer | null> {
      try {
        return await fs.readFile(path);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw err;
      }
    },

    // Writes to a sibling temp file first, then renames it over the target
    // — the same reasoning as src/lib/projects.ts's writeProjects
    // (src/lib/projects.ts:42-47), generalized here from one fixed
    // registryPath to any caller-supplied path. The tmp file must be a
    // sibling of the real path (same directory), never under the OS temp
    // directory, or fs.rename can fail with EXDEV across filesystems.
    // The name carries a per-call random suffix as well as the pid: a
    // pid-only name is shared by two concurrent writes to the same path
    // from ONE process, which lets the second writeFile interleave with
    // the first rename and leave a truncated or mixed file behind.
    async writeTextFileAtomic(path: string, content: string): Promise<void> {
      const tmpPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
      await fs.writeFile(tmpPath, content, 'utf8');
      await fs.rename(tmpPath, path);
    },

    // Binary counterpart to writeTextFileAtomic, with the same tmp-sibling
    // then rename dance. The atomicity here is symmetry with the text pair,
    // not a concurrency requirement: the only caller's temporary zip has
    // exactly one reader, in the same process that just wrote it. The tmp
    // file stays a sibling in the same directory, which is what avoids EXDEV.
    // No encoding argument, so the Buffer's bytes are written verbatim.
    async writeBinaryFileAtomic(path: string, content: Buffer): Promise<void> {
      const tmpPath = `${path}.${process.pid}.tmp`;
      await fs.writeFile(tmpPath, content);
      await fs.rename(tmpPath, path);
    },

    async mkdir(path: string): Promise<void> {
      await fs.mkdir(path, { recursive: true });
    },

    async remove(path: string): Promise<void> {
      await fs.rm(path, { recursive: true, force: true });
    },

    async expandTokens(input: string): Promise<string> {
      return expandTokensImpl(input);
    },
  };
}
