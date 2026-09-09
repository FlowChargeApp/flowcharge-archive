// Boundary regression suite for the PACKAGED CLI binary, driven as a black box.
//
// Nothing here imports the server, and nothing here imports src/lib/. Every case
// builds the real single-file executable with the real packaging command, spawns
// it as a child process, and asserts only what an external caller can observe:
// the readiness line the child prints, the HTTP answers it gives, and the
// directory it creates on disk. That is the whole point — a Bun standalone
// executable resolves `__dirname` inside a read-only embedded filesystem, so a
// packaging regression is invisible to every in-process test in this repository.
//
// The binary is built ONCE per run, not once per case, by calling
// `node tools/package-cli.mjs --target=<label>`. Calling the real packaging
// command is deliberate: a copy of its Bun flags here could drift away from the
// flags a release actually uses, and then this suite would pass while the
// shipped artefact broke.
//
// Every case skips, with a stated reason, on a host this repository has no
// packaging target for and on a host where `bun --version` does not work. CI
// supplies Node only, so the cases skip there and the CI job stays green with no
// workflow change.
//
// Run with `node --test --test-force-exit dist/test/boundary/cli-binary.test.js` after
// `npm run build`. The build is required: tools/package-cli.mjs refuses early
// when dist/public/ holds no files, and `npm test` covers that through pretest.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';

// The repository root, derived from this module's own location rather than from
// process.cwd(), so the file behaves the same however `node --test` was invoked.
// The compiled file is dist/test/boundary/cli-binary.test.js, so the root is
// three levels up.
// `new URL('.', import.meta.url).pathname` is used instead of node:url's
// fileURLToPath to keep this file's imports to the set the task names; every
// host this suite does not skip on is POSIX, where the two agree.
const HERE = decodeURIComponent(new URL('.', import.meta.url).pathname);
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');

// Read, never hardcoded: tools/package-cli.mjs names the artefact after this
// same field, and the unset-PRAXIS_APP_VERSION case asserts the binary reports
// it back.
const PACKAGE_VERSION = (
  JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as { version: string }
).version;

// ---------------------------------------------------------------------------
// The skip gate: an unmapped host, or a host with no usable Bun
// ---------------------------------------------------------------------------

// The three <platform>-<arch> pairs tools/package-cli.mjs can build for and this
// machine could then execute. win-x64 is a valid packaging target but a Windows
// binary cannot be spawned here, so it is deliberately absent.
const HOST_LABELS: Record<string, string> = {
  'darwin-arm64': 'darwin-arm64',
  'darwin-x64': 'darwin-x64',
  'linux-x64': 'linux-x64',
};

const HOST_KEY = `${process.platform}-${process.arch}`;
const LABEL: string | undefined = HOST_LABELS[HOST_KEY];

// bun is a PATH tool, not a devDependency. A spawn failure and a non-zero exit
// both mean the same thing here: this host cannot build the artefact, so the
// cases skip with a reason instead of failing.
function bunProbeReason(): string | false {
  const probe = spawnSync('bun', ['--version'], { encoding: 'utf8' });
  if (probe.error) return 'bun is not resolvable on PATH, so the CLI binary cannot be built here';
  if (probe.status !== 0) return 'bun is on PATH but `bun --version` exited non-zero';
  return false;
}

// `false` means run. A string means skip, and node:test prints it as the reason.
const SKIP: string | false =
  LABEL === undefined
    ? `no packaging target for ${HOST_KEY}, so there is no binary to drive`
    : bunProbeReason();

// ---------------------------------------------------------------------------
// The one build per run
// ---------------------------------------------------------------------------

const BINARY_PATH =
  LABEL === undefined
    ? ''
    : path.join(REPO_ROOT, 'release', 'cli', `flowcharge-${PACKAGE_VERSION}-${LABEL}`);

// Built once at module scope, before any case runs, and never per case: the
// compile takes a fraction of a second but the artefact is tens of megabytes,
// and every case drives the same one.
let buildFailure: string | false = false;
if (SKIP === false) {
  const build = spawnSync('node', [path.join('tools', 'package-cli.mjs'), `--target=${LABEL}`], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  if (build.error) buildFailure = `packaging command could not be spawned: ${build.error.message}`;
  else if (build.status !== 0) {
    buildFailure = `packaging command exited ${build.status}: ${build.stderr}${build.stdout}`;
  }
}

// ---------------------------------------------------------------------------
// Spawning the binary
// ---------------------------------------------------------------------------

interface Started {
  base: string;
  host: string;
  port: number;
  home: string;
  readyLine: string;
  stdout: () => string;
}

const children: ReturnType<typeof spawn>[] = [];
const tempDirs: string[] = [];

after(() => {
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

// A throwaway directory the server accepts as a project: it holds a workstream
// tree, which is the whole of what the registration check looks for.
function makeProjectDir(): string {
  const root = makeTempDir('flowcharge-cli-project-');
  fs.mkdirSync(path.join(root, 'flowcharge', 'workstreams'), { recursive: true });
  return root;
}

// The parent picks the port, because a black-box child cannot report a port it
// bound for itself: with PORT=0 the readiness line still prints the CONFIGURED
// value, so the only port this suite can know is one it chose.
function freePort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const probe = net.createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

// A key present with an `undefined` value is DELETED from the child environment,
// never set to ''. Both dist/cli-entry.js and src/server.ts test for emptiness
// explicitly, so '' is a value that falls through to the default and would prove
// the opposite of what a "variable unset" case means to prove.
type EnvOverrides = Record<string, string | undefined>;

const READY_TIMEOUT_MS = 20_000;

function startOnce(
  overrides: EnvOverrides,
  port: number,
): Promise<Started | 'EADDRINUSE'> {
  const host = typeof overrides.HOST === 'string' ? overrides.HOST : '127.0.0.1';

  // HOME points at a fresh temporary directory for EVERY child, so the
  // ~/.flowcharge default is observed inside that directory and the maintainer's
  // real home directory is never written to.
  const home = makeTempDir('flowcharge-cli-home-');

  const env: NodeJS.ProcessEnv = { ...process.env };
  // Never inherited from the runner: each case states these itself.
  delete env.PRAXIS_DATA_DIR;
  delete env.PRAXIS_APP_VERSION;
  env.HOME = home;
  env.HOST = host;
  env.PORT = String(port);
  // The default: a private data directory, so no case writes into a real one
  // unless it explicitly asks to.
  env.PRAXIS_DATA_DIR = makeTempDir('flowcharge-cli-data-');
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }

  const child = spawn(BINARY_PATH, [], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);

  const expected = `FlowCharge running at http://${host}:${port}`;

  return new Promise<Started | 'EADDRINUSE'>((resolve, reject) => {
    let out = '';
    let err = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(
        new Error(
          `the binary printed no readiness line within ${READY_TIMEOUT_MS}ms.\n` +
            `stdout: ${out}\nstderr: ${err}`,
        ),
      );
    }, READY_TIMEOUT_MS);
    timer.unref();

    const finish = (value: Started | 'EADDRINUSE') => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      out += chunk;
      if (out.includes(expected)) {
        finish({
          base: `http://${host}:${port}`,
          host,
          port,
          home,
          readyLine: expected,
          stdout: () => out,
        });
      }
    });

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      err += chunk;
      // The port the parent picked can be taken between the probe socket closing
      // and the child binding it. That is a race, not a defect, so it is
      // reported back for one retry rather than failed.
      if (err.includes('EADDRINUSE')) finish('EADDRINUSE');
    });

    child.on('error', (spawnErr) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(spawnErr);
    });
  });
}

// Retries exactly once, and only on the port race above.
async function startBinary(overrides: EnvOverrides = {}): Promise<Started> {
  assert.ok(fs.existsSync(BINARY_PATH), `the packaged binary is missing at ${BINARY_PATH}`);
  const first = await startOnce(overrides, await freePort());
  if (first !== 'EADDRINUSE') return first;
  const second = await startOnce(overrides, await freePort());
  assert.notEqual(second, 'EADDRINUSE', 'the chosen port was taken twice in a row');
  return second as Started;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// ---------------------------------------------------------------------------
// The build itself
// ---------------------------------------------------------------------------

test('the packaging command builds a non-empty binary for this host', { skip: SKIP }, () => {
  assert.equal(buildFailure, false, typeof buildFailure === 'string' ? buildFailure : '');
  assert.ok(fs.existsSync(BINARY_PATH), `expected a binary at ${BINARY_PATH}`);
  assert.ok(fs.statSync(BINARY_PATH).size > 0, 'the packaged binary is empty');
});

// ---------------------------------------------------------------------------
// PRAXIS_APP_VERSION, set and unset
// ---------------------------------------------------------------------------

test('PRAXIS_APP_VERSION set wins over the version injected at build time', { skip: SKIP }, async () => {
  const sentinel = '9.9.9-cli-binary-sentinel';
  const server = await startBinary({ PRAXIS_APP_VERSION: sentinel });

  const res = await fetch(`${server.base}/api/version`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { version: sentinel });
});

test('PRAXIS_APP_VERSION unset falls back to the injected build-time version', { skip: SKIP }, async () => {
  // Deleted, not set to '': dist/cli-entry.js only injects the version when the
  // variable is empty or unset, and '' would take the same branch for the wrong
  // reason.
  const server = await startBinary({ PRAXIS_APP_VERSION: undefined });

  const res = await fetch(`${server.base}/api/version`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { version: PACKAGE_VERSION });
});

// ---------------------------------------------------------------------------
// PRAXIS_DATA_DIR, and the ~/.flowcharge default
// ---------------------------------------------------------------------------

test('PRAXIS_DATA_DIR set puts the registry inside that directory and nowhere else', { skip: SKIP }, async () => {
  const dataDir = makeTempDir('flowcharge-cli-explicit-data-');
  const server = await startBinary({ PRAXIS_DATA_DIR: dataDir });

  const empty = await fetch(`${server.base}/api/projects`);
  assert.equal(empty.status, 200);
  assert.deepEqual(await empty.json(), { projects: [] });

  const projectRoot = makeProjectDir();
  const created = await fetch(`${server.base}/api/projects`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ path: projectRoot }),
  });
  assert.equal(created.status, 201);

  // The registry file is found by READING the directory, never by naming it.
  // Acceptance criterion 2 of PLN-84-c6d01h forbids a new test file from naming
  // the repository's own registry, and this suite keeps to that by naming no
  // registry filename at all — which is also the more black-box assertion: the
  // registered path has to be readable back out of whatever file was written.
  const written = fs.readdirSync(dataDir);
  assert.equal(written.length, 1, `expected exactly one file in PRAXIS_DATA_DIR, saw ${written.join(', ')}`);
  const stored = fs.readFileSync(path.join(dataDir, written[0] as string), 'utf8');
  assert.ok(stored.includes(projectRoot), 'the written file does not hold the registered path');

  // And nowhere else: with the variable set, the ~/.flowcharge default branch in
  // dist/cli-entry.js is never taken, so the child's own HOME stays empty.
  assert.equal(
    fs.existsSync(path.join(server.home, '.flowcharge')),
    false,
    'the home-directory default was created even though PRAXIS_DATA_DIR was set',
  );

  const listed = await fetch(`${server.base}/api/projects`);
  assert.equal(listed.status, 200);
  const body = (await listed.json()) as { projects: { path: string }[] };
  assert.equal(body.projects.length, 1);
  assert.equal(body.projects[0]?.path, projectRoot);
});

test('PRAXIS_DATA_DIR unset creates ~/.flowcharge under the overridden HOME', { skip: SKIP }, async () => {
  // dist/cli-entry.js creates the directory eagerly with fs.mkdirSync before it
  // imports the server, so the readiness line is enough — no request is needed.
  const server = await startBinary({ PRAXIS_DATA_DIR: undefined });

  const created = path.join(server.home, '.flowcharge');
  assert.ok(fs.existsSync(created), `the binary did not create ${created}`);
  assert.ok(fs.statSync(created).isDirectory(), `${created} is not a directory`);
});

// ---------------------------------------------------------------------------
// HOST and PORT
// ---------------------------------------------------------------------------

test('the binary answers on the HOST and PORT the parent set, and says so', { skip: SKIP }, async () => {
  const server = await startBinary({});

  // The startup line names the configured pair, which is the only externally
  // visible statement the binary makes about where it is listening.
  assert.equal(server.readyLine, `FlowCharge running at http://${server.host}:${server.port}`);
  assert.ok(server.stdout().includes(server.readyLine));
  assert.equal(server.host, '127.0.0.1');

  // And the same pair really answers, so the line is not merely printed.
  const res = await fetch(`http://${server.host}:${server.port}/api/version`);
  assert.equal(res.status, 200);
});

// ---------------------------------------------------------------------------
// The embedded asset filesystem
// ---------------------------------------------------------------------------

test('GET / is served from the binary embedded read-only asset filesystem', { skip: SKIP }, async () => {
  const server = await startBinary({});

  const res = await fetch(`${server.base}/`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/html; charset=utf-8');
  const html = await res.text();
  assert.ok(html.length > 0, 'the HTML body was empty');
  assert.match(html, /<html/i);
});
