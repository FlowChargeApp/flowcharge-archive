// Unit tests for PRAXIS_DATA_DIR support in projects.ts. dataDir/isPackaged are
// read from process.env.PRAXIS_DATA_DIR once at module top-level, so ESM module
// caching means a single test process can't exercise both the unset and set
// branches by importing the module twice. Each set-branch case below spawns the
// compiled module in a fresh child process with a controlled environment instead.
//
// Run with `node --test dist/test/unit/projects.test.js` after `npm run build`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectsJsPath = path.join(__dirname, '../../lib/projects.js');

// Drives the compiled module from a child process: imports it with
// PRAXIS_DATA_DIR already set in the environment (so the module's top-level
// consts observe it), calls addProject() with the given path, then prints
// readProjects() as JSON so the parent process can assert on it.
function runInChildProcess(dataDir: string, projectPathToAdd: string | null): unknown {
  const driver = `
    import(${JSON.stringify(projectsJsPath)}).then(async (mod) => {
      if (${JSON.stringify(projectPathToAdd)} !== null) {
        mod.addProject(${JSON.stringify(projectPathToAdd)});
      }
      console.log(JSON.stringify(mod.readProjects()));
    });
  `;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', driver], {
    env: { ...process.env, PRAXIS_DATA_DIR: dataDir },
    encoding: 'utf8',
  });
  return JSON.parse(output.trim());
}

test('PRAXIS_DATA_DIR override redirects the registry file', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'praxis-projects-test-'));
  try {
    const projectToAdd = fs.mkdtempSync(path.join(os.tmpdir(), 'praxis-projects-test-project-'));
    try {
      runInChildProcess(tmpDir, projectToAdd);
      const registryPath = path.join(tmpDir, '.praxis-projects.json');
      assert.ok(
        fs.existsSync(registryPath),
        `.praxis-projects.json must be created inside PRAXIS_DATA_DIR (${tmpDir}), not at the real repo root`
      );
      const written = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
      assert.equal(written.projects.length, 1);
      assert.equal(written.projects[0].path, path.resolve(projectToAdd));
    } finally {
      fs.rmSync(projectToAdd, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('packaged first run starts empty, not with a self-entry', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'praxis-projects-test-'));
  try {
    // No addProject() call: registryPath inside tmpDir has never been written,
    // so readProjects()'s first call hits ENOENT with isPackaged true.
    const projects = runInChildProcess(tmpDir, null);
    assert.deepEqual(projects, [], 'a packaged first run must start with an empty list, not a self-entry');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
