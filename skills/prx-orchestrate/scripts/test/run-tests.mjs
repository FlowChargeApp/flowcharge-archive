#!/usr/bin/env node
// Fixture harness for prx-index.mjs. Each case builds a small prxwork/ tree in
// a temp directory, runs the generator against it as a child process, and
// asserts the exact set of WARN lines it prints. The runner is hand-rolled:
// node >= 16 is the published floor, so node:test's describe/it API is not
// available, and the suite takes no dependency and needs no package.json.
//
// Usage: node run-tests.mjs
//   exit 0  every case passed
//   exit 1  at least one case failed (the runner names it and prints the
//           missing and unexpected WARN lines separately)

import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const HERE = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname));
const GENERATOR = path.resolve(HERE, '..', 'prx-index.mjs');
const FIXTURE_PREFIX = 'prx-harness-';

// ---- fixtures --------------------------------------------------------------

// Builds a fresh tree under os.tmpdir() from a {relative path: content} map.
// prxwork/workstreams/ is always created: the generator exits 1 without it.
function fixture(spec) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), FIXTURE_PREFIX)));
  fs.mkdirSync(path.join(dir, 'prxwork', 'workstreams'), { recursive: true });
  for (const rel of Object.keys(spec)) {
    const filePath = path.join(dir, rel);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, spec[rel]);
  }
  return dir;
}

// Runs fn against a fresh tree and removes the tree afterwards, including when
// fn throws.
function withFixture(spec, fn) {
  const dir = fixture(spec);
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ---- artefact content builders --------------------------------------------

const pad2 = (n) => String(n).padStart(2, '0');
const localDay = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const today = () => localDay(new Date());
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDay(d);
};

// The author --new-ws writes into its scaffold, resolved the same way the
// generator's own readGitAuthor() resolves it. Computed rather than pinned to
// a literal, because it is whatever this machine's git config says, and
// "unknown" on a machine with no user.name set.
const gitAuthor = () => {
  const res = spawnSync('git', ['config', 'user.name'], { cwd: os.tmpdir(), encoding: 'utf8' });
  return (res.status === 0 && (res.stdout || '').trim()) || 'unknown';
};

const arr = (v) => `[${(v || []).join(', ')}]`;

function frontmatter(keys) {
  const lines = Object.keys(keys).map((k) => `${k}: ${keys[k]}`);
  return `---\n${lines.join('\n')}\n---\n`;
}

// One artefact file: frontmatter block, blank line, body.
function record(type, o = {}) {
  const keys = {
    id: o.id,
    type,
    workstream: o.workstream !== undefined ? o.workstream : (type === 'workstream' ? o.id : 'WS-1-abcdef'),
    slug: o.slug !== undefined ? o.slug : 'alpha',
    title: `"${o.title !== undefined ? o.title : 'Fixture artefact'}"`,
    status: o.status !== undefined ? o.status : 'ready',
    created: o.created !== undefined ? o.created : today(),
    updated: o.updated !== undefined ? o.updated : today(),
    depends_on: arr(o.depends_on),
    links: arr(o.links),
  };
  if (type === 'workstream') keys.tags = arr(o.tags);
  if (type === 'tasklist') keys.mode = o.mode !== undefined ? o.mode : 'spec';
  const body = o.body !== undefined ? o.body : 'Fixture body line for this artefact.\n';
  return `${frontmatter(keys)}\n${body}`;
}

const workstream = (o) => record('workstream', o);
const plan = (o) => record('plan', o);
const issuelist = (o) => record('issuelist', { ...o, body: (o.issues || []).join('') });
const tasklist = (o) => record('tasklist', { ...o, body: (o.tasks || []).join('') });

const issueBlock = (id, o = {}) =>
  `- [${o.checked ? 'x' : ' '}] ${id}. ${o.title !== undefined ? o.title : 'Fixture issue'}\n` +
  `  status: ${o.status !== undefined ? o.status : 'ready'}\n` +
  `  severity: ${o.severity !== undefined ? o.severity : 'low'}\n`;

const taskLine = (n, checked, title) =>
  `- [${checked ? 'x' : ' '}] ${n}. ${title !== undefined ? title : 'Fixture task'}\n`;

// Drops one frontmatter key line from a produced record, so a case can omit
// exactly one required key without a second record builder. The pattern anchors
// at column 0, so an indented key inside an issue or task YAML block in the
// body is left alone.
const withoutKey = (text, key) => text.replace(new RegExp(`^${key}: .*\\n`, 'm'), '');

const REG_TYPES = ['WS', 'PLN', 'IL', 'TL', 'ISS'];

// The header text prx-index.mjs owns, pinned here the way the WARN strings are
// pinned: a change to the constant must fail a case rather than pass quietly.
const REGISTRY_HEADER = '# Praxis ID Registry\n\n'
  + 'Last-issued ID per type. To claim IDs, run node <skills-dir>/prx-orchestrate/scripts/prx-index.mjs'
  + ' --root <project-root> --claim <TYPE> [<count>] and use the printed id(s) verbatim.\n\n';

// prxids.md with one counter line per type, under the canonical header. Pass
// omit to leave a type out, or head to give the file a header of its own —
// which is what a stale-header case needs.
function registry(counters = {}, omit = [], head = REGISTRY_HEADER) {
  const lines = REG_TYPES.filter((t) => !omit.includes(t))
    .map((t) => `- ${t}: ${counters[t] !== undefined ? counters[t] : 0}`);
  return `${head}${lines.join('\n')}\n`;
}

// prxtags.md in the same one-per-line shape the real pool file carries. Every
// tag the fixtures use is listed here, so the membership check fires only for
// a case that deliberately carries an unlisted tag. gates and orchestration
// are the two entries the near-match cases measure against.
const TAG_POOL = ['gates', 'generator', 'orchestration', 'skills'];

const tagPool = (tags = TAG_POOL) =>
  `# Praxis Tag Pool\n\n${tags.map((t) => `- ${t}`).join('\n')}\n`;

const WS1 = 'prxwork/workstreams/WS-1-abcdef-alpha/prxworkstream.md';
const WS2 = 'prxwork/workstreams/WS-2-abcdef-beta/prxworkstream.md';

// A tree that produces no WARN at all: one workstream, a matching registry and
// a tag pool. head overrides the registry's header text, which only a header
// case needs. extra is spread last, so a case can replace the pool.
function baseTree(extra = {}, counters = {}, omit = [], head = REGISTRY_HEADER) {
  return {
    'prxwork/prxids.md': registry({ WS: 1, ...counters }, omit, head),
    'prxwork/prxtags.md': tagPool(),
    [WS1]: workstream({ id: 'WS-1-abcdef', slug: 'alpha', title: 'Alpha' }),
    ...extra,
  };
}

// ---- generator invocation and assertions -----------------------------------

function runGenerator(dir, extraArgs = []) {
  const res = spawnSync(process.execPath, [GENERATOR, '--root', dir, ...extraArgs], {
    cwd: dir,
    encoding: 'utf8',
  });
  if (res.error) throw res.error;
  return { status: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

// Pins a fixture file's mtime to one calendar day, so a case that turns on the
// updated-vs-mtime drift is deterministic rather than wall-clock dependent. The
// time of day is local noon, which keeps the day the generator reads back equal
// to day, because the generator reads mtime on the local calendar. Call it after
// the file is written: the write resets mtime.
function setMtime(dir, rel, day) {
  const t = new Date(`${day}T12:00:00`);
  fs.utimesSync(path.join(dir, rel), t, t);
}

const warnLines = (stdout) =>
  stdout.split(/\r?\n/).filter((l) => l.startsWith('WARN ')).map((l) => l.slice(5));

function compareLineSets(actual, expected, what) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = [...expectedSet].filter((l) => !actualSet.has(l));
  const unexpected = [...actualSet].filter((l) => !expectedSet.has(l));
  if (!missing.length && !unexpected.length) return;
  const fmt = (label, lines, mark) =>
    lines.length
      ? `  ${label} (${lines.length}):\n${lines.map((l) => `    ${mark} ${l}`).join('\n')}`
      : `  ${label} (0): none`;
  throw new Error(
    [`${what} set does not match`, fmt('missing', missing, '-'), fmt('unexpected', unexpected, '+')].join('\n'),
  );
}

const compareWarnSets = (actual, expected) => compareLineSets(actual, expected, 'WARN');

// Runs the generator in --check mode and compares its WARN lines, as a set,
// against expectedLines. --check exits 2 whenever a warning exists, so the
// exit code is read as data, not as failure.
function expectWarns(dir, expectedLines, extraArgs = []) {
  const { status, stdout, stderr } = runGenerator(dir, ['--check', ...extraArgs]);
  // Compare the sets before the exit code, so a wrong expectation reports the
  // missing and unexpected lines rather than only a code mismatch.
  compareWarnSets(warnLines(stdout), expectedLines);
  const wantStatus = expectedLines.length ? 2 : 0;
  if (status !== wantStatus) {
    throw new Error(
      `--check exited ${status}, expected ${wantStatus}\n` +
      `  stdout:\n${stdout.trimEnd() || '    (empty)'}\n  stderr:\n${stderr.trimEnd() || '    (empty)'}`,
    );
  }
}

// ---- case registry ---------------------------------------------------------
// "case" is a reserved word, so the registrar is testCase(name, fn).

const cases = [];
const testCase = (name, fn) => cases.push({ name, fn });

// ---- cases: missing frontmatter or id (prx-index.mjs:273-276) --------------

testCase('missing frontmatter warns and excludes the file', () => {
  withFixture(baseTree({
    'prxwork/workstreams/WS-1-abcdef-alpha/prxplan.md': 'No frontmatter block at all.\n',
  }), (dir) => {
    expectWarns(dir, [
      'prxwork/workstreams/WS-1-abcdef-alpha/prxplan.md: missing frontmatter or id — excluded from index',
    ]);
  });
});

testCase('clean: a file with frontmatter and an id warns about nothing', () => {
  withFixture(baseTree({
    'prxwork/workstreams/WS-1-abcdef-alpha/prxplan.md': plan({ id: 'PLN-1-abcdef' }),
  }, { PLN: 1 }), (dir) => {
    expectWarns(dir, []);
  });
});

// ---- cases: status enum (prx-index.mjs:283) --------------------------------

testCase('status outside the enum warns', () => {
  withFixture(baseTree({
    [WS1]: workstream({ id: 'WS-1-abcdef', status: 'nope' }),
  }), (dir) => {
    expectWarns(dir, [
      'prxwork/workstreams/WS-1-abcdef-alpha/prxworkstream.md: status "nope" not in enum',
    ]);
  });
});

testCase('clean: a status inside the enum warns about nothing', () => {
  withFixture(baseTree(), (dir) => {
    expectWarns(dir, []);
  });
});

// ---- cases: archived but not done/dropped (prx-index.mjs:284-286) ----------

testCase('archived artefact with an open status warns', () => {
  withFixture(baseTree({
    'prxwork/archive/WS-2-abcdef-beta/prxworkstream.md': workstream({ id: 'WS-2-abcdef', slug: 'beta', status: 'ready' }),
  }, { WS: 2 }), (dir) => {
    expectWarns(dir, [
      'WS-2-abcdef (prxwork/archive/WS-2-abcdef-beta/prxworkstream.md): archived but status is "ready" — only done/dropped belong in archive/',
    ]);
  });
});

testCase('clean: an archived done artefact warns about nothing', () => {
  withFixture(baseTree({
    'prxwork/archive/WS-2-abcdef-beta/prxworkstream.md': workstream({ id: 'WS-2-abcdef', slug: 'beta', status: 'done' }),
  }, { WS: 2 }), (dir) => {
    expectWarns(dir, []);
  });
});

// ---- cases: duplicate artefact id (prx-index.mjs:287) ----------------------

testCase('two artefacts carrying one id warn as a duplicate', () => {
  withFixture(baseTree({
    [WS2]: workstream({ id: 'WS-2-abcdef', slug: 'beta' }),
    'prxwork/workstreams/WS-1-abcdef-alpha/prxplan.md': plan({ id: 'PLN-1-abcdef', workstream: 'WS-1-abcdef' }),
    'prxwork/workstreams/WS-2-abcdef-beta/prxplan.md': plan({ id: 'PLN-1-abcdef', workstream: 'WS-2-abcdef', slug: 'beta' }),
  }, { WS: 2, PLN: 1 }), (dir) => {
    expectWarns(dir, [
      'duplicate id PLN-1-abcdef: prxwork/workstreams/WS-1-abcdef-alpha/prxplan.md and prxwork/workstreams/WS-2-abcdef-beta/prxplan.md',
    ]);
  });
});

testCase('clean: two artefacts with distinct ids warn about nothing', () => {
  withFixture(baseTree({
    [WS2]: workstream({ id: 'WS-2-abcdef', slug: 'beta' }),
    'prxwork/workstreams/WS-1-abcdef-alpha/prxplan.md': plan({ id: 'PLN-1-abcdef', workstream: 'WS-1-abcdef' }),
    'prxwork/workstreams/WS-2-abcdef-beta/prxplan.md': plan({ id: 'PLN-2-abcdef', workstream: 'WS-2-abcdef', slug: 'beta' }),
  }, { WS: 2, PLN: 2 }), (dir) => {
    expectWarns(dir, []);
  });
});

// ---- cases: duplicate issue id (prx-index.mjs:298-301) ---------------------

testCase('two issue records carrying one id warn as a duplicate', () => {
  withFixture(baseTree({
    'prxwork/workstreams/WS-1-abcdef-alpha/prxissuelist.md': issuelist({
      id: 'IL-1-abcdef',
      issues: [issueBlock('ISS-1-abcdef'), issueBlock('ISS-1-abcdef', { title: 'Same id again' })],
    }),
  }, { IL: 1, ISS: 1 }), (dir) => {
    expectWarns(dir, [
      'duplicate issue id ISS-1-abcdef (prxwork/workstreams/WS-1-abcdef-alpha/prxissuelist.md)',
    ]);
  });
});

testCase('clean: two issue records with distinct ids warn about nothing', () => {
  withFixture(baseTree({
    'prxwork/workstreams/WS-1-abcdef-alpha/prxissuelist.md': issuelist({
      id: 'IL-1-abcdef',
      issues: [issueBlock('ISS-1-abcdef'), issueBlock('ISS-2-abcdef')],
    }),
  }, { IL: 1, ISS: 2 }), (dir) => {
    expectWarns(dir, []);
  });
});

// ---- cases: unknown depends_on target (prx-index.mjs:415-419) --------------

testCase('an unresolved depends_on target warns', () => {
  withFixture(baseTree({
    [WS1]: workstream({ id: 'WS-1-abcdef', depends_on: ['WS-99-abcdef'] }),
  }), (dir) => {
    expectWarns(dir, [
      'WS-1-abcdef (prxwork/workstreams/WS-1-abcdef-alpha/prxworkstream.md): depends_on unknown id WS-99-abcdef',
    ]);
  });
});

testCase('clean: a depends_on target that resolves warns about nothing', () => {
  withFixture(baseTree({
    [WS1]: workstream({ id: 'WS-1-abcdef', depends_on: ['WS-2-abcdef'] }),
    [WS2]: workstream({ id: 'WS-2-abcdef', slug: 'beta' }),
  }, { WS: 2 }), (dir) => {
    expectWarns(dir, []);
  });
});

// ---- cases: checkbox/status disagreement (prx-index.mjs:420-425) -----------

testCase('an issue checkbox disagreeing with its status warns', () => {
  withFixture(baseTree({
    'prxwork/workstreams/WS-1-abcdef-alpha/prxissuelist.md': issuelist({
      id: 'IL-1-abcdef',
      issues: [issueBlock('ISS-1-abcdef', { checked: true, status: 'ready' })],
    }),
  }, { IL: 1, ISS: 1 }), (dir) => {
    expectWarns(dir, [
      'ISS-1-abcdef (prxwork/workstreams/WS-1-abcdef-alpha/prxissuelist.md): checkbox [x] disagrees with status "ready"',
    ]);
  });
});

testCase('clean: an issue checkbox agreeing with its status warns about nothing', () => {
  withFixture(baseTree({
    'prxwork/workstreams/WS-1-abcdef-alpha/prxissuelist.md': issuelist({
      id: 'IL-1-abcdef',
      issues: [issueBlock('ISS-1-abcdef', { checked: false, status: 'ready' })],
    }),
  }, { IL: 1, ISS: 1 }), (dir) => {
    expectWarns(dir, []);
  });
});

// ---- cases: all tasks checked, list still open (prx-index.mjs:427-429) -----

testCase('a task list with every task checked but an open status warns', () => {
  withFixture(baseTree({
    'prxwork/workstreams/WS-1-abcdef-alpha/prxtasklist.md': tasklist({
      id: 'TL-1-abcdef',
      status: 'ready',
      tasks: [taskLine(1, true), taskLine(2, true)],
    }),
  }, { TL: 1 }), (dir) => {
    expectWarns(dir, [
      'TL-1-abcdef (prxwork/workstreams/WS-1-abcdef-alpha/prxtasklist.md): all 2 tasks checked but status is "ready" — close it?',
    ]);
  });
});

testCase('clean: a task list with an open task warns about nothing', () => {
  withFixture(baseTree({
    'prxwork/workstreams/WS-1-abcdef-alpha/prxtasklist.md': tasklist({
      id: 'TL-1-abcdef',
      status: 'ready',
      tasks: [taskLine(1, true), taskLine(2, false)],
    }),
  }, { TL: 1 }), (dir) => {
    expectWarns(dir, []);
  });
});

// ---- cases: no open issues, list still open (prx-index.mjs:430-432) --------

testCase('an issue list with every issue closed but an open status warns', () => {
  withFixture(baseTree({
    'prxwork/workstreams/WS-1-abcdef-alpha/prxissuelist.md': issuelist({
      id: 'IL-1-abcdef',
      status: 'ready',
      issues: [issueBlock('ISS-1-abcdef', { checked: true, status: 'done' })],
    }),
  }, { IL: 1, ISS: 1 }), (dir) => {
    expectWarns(dir, [
      'IL-1-abcdef (prxwork/workstreams/WS-1-abcdef-alpha/prxissuelist.md): no open issues left but status is "ready" — close it?',
    ]);
  });
});

testCase('clean: a closed issue list with every issue closed warns about nothing', () => {
  // WS-1-abcdef is closed too: a workstream whose every artefact is closed is itself a
  // reported condition, so leaving it open would make this case assert two.
  withFixture(baseTree({
    [WS1]: workstream({ id: 'WS-1-abcdef', slug: 'alpha', title: 'Alpha', status: 'done' }),
    'prxwork/workstreams/WS-1-abcdef-alpha/prxissuelist.md': issuelist({
      id: 'IL-1-abcdef',
      status: 'done',
      issues: [issueBlock('ISS-1-abcdef', { checked: true, status: 'done' })],
    }),
  }, { IL: 1, ISS: 1 }), (dir) => {
    expectWarns(dir, []);
  });
});

// ---- cases: stale in-progress artefact (prx-index.mjs:433-436) -------------

testCase('an in-progress artefact past the stale window warns with its age', () => {
  withFixture(baseTree({
    [WS1]: workstream({ id: 'WS-1-abcdef', status: 'in-progress', created: daysAgo(100), updated: daysAgo(100) }),
  }), (dir) => {
    // The fixture is written now, so its mtime is pinned back to its updated
    // date to keep the updated-vs-mtime drift check out of this case.
    setMtime(dir, WS1, daysAgo(100));
    expectWarns(dir, [
      'WS-1-abcdef (prxwork/workstreams/WS-1-abcdef-alpha/prxworkstream.md): in-progress but not updated for 100 days',
    ]);
  });
});

testCase('clean: a recently updated in-progress artefact warns about nothing', () => {
  withFixture(baseTree({
    [WS1]: workstream({ id: 'WS-1-abcdef', status: 'in-progress', updated: daysAgo(1) }),
  }), (dir) => {
    expectWarns(dir, []);
  });
});

// ---- cases: registry drift (prx-index.mjs:440-455) -------------------------

testCase('a missing prxids.md warns', () => {
  withFixture({ 'prxwork/prxtags.md': tagPool(), [WS1]: workstream({ id: 'WS-1-abcdef' }) }, (dir) => {
    expectWarns(dir, [
      'prxwork/prxids.md missing — create it before allocating new IDs',
    ]);
  });
});

testCase('clean: a present prxids.md warns about nothing', () => {
  withFixture(baseTree(), (dir) => {
    expectWarns(dir, []);
  });
});

testCase('a registry counter behind the scanned artefacts warns', () => {
  withFixture(baseTree({}, { WS: 0 }), (dir) => {
    expectWarns(dir, [
      'prxids.md: WS counter is 0 but WS-1 exists — registry behind',
    ]);
  });
});

testCase('clean: a registry counter level with the scanned artefacts warns about nothing', () => {
  withFixture(baseTree({}, { WS: 1 }), (dir) => {
    expectWarns(dir, []);
  });
});

testCase('a registry with no counter line for a type warns', () => {
  withFixture(baseTree({}, {}, ['ISS']), (dir) => {
    expectWarns(dir, ['prxids.md: no counter for ISS']);
  });
});

testCase('clean: a registry carrying every counter line warns about nothing', () => {
  withFixture(baseTree({}, {}, []), (dir) => {
    expectWarns(dir, []);
  });
});

// ---- cases: board divergence (prx-index.mjs:457-473) -----------------------

const board = (column, cardId, cardTitle) =>
  `- # ${column}\n\t- ## ${cardId} ${cardTitle}\n\t\t→ prxwork/workstreams/WS-1-abcdef-alpha/\n`;

testCase('a board card in the wrong column warns', () => {
  withFixture(baseTree({
    [WS1]: workstream({ id: 'WS-1-abcdef', status: 'in-progress' }),
    'prxwork/prxkanban.md': board('Ready', 'WS-1-abcdef', 'Alpha'),
  }), (dir) => {
    expectWarns(dir, [
      'board: WS-1-abcdef sits in "Ready" but frontmatter says "in-progress" — frontmatter wins, board regenerated',
    ]);
  });
});

testCase('clean: a board card in the column its status names warns about nothing', () => {
  withFixture(baseTree({
    [WS1]: workstream({ id: 'WS-1-abcdef', status: 'in-progress' }),
    'prxwork/prxkanban.md': board('In Progress', 'WS-1-abcdef', 'Alpha'),
  }), (dir) => {
    expectWarns(dir, []);
  });
});

// ---- case: root resolution --------------------------------------------------
// resolveProjectRoot (prx-index.mjs:47-56) redirects --root to the enclosing
// git repository's common directory. This case runs default mode and asserts
// the summary counts belong to the temp tree, so a misresolution onto this
// repository fails loudly instead of passing silently.

testCase('default mode reports the temp tree own counts, not this repository', () => {
  withFixture(baseTree({
    [WS2]: workstream({ id: 'WS-2-abcdef', slug: 'beta' }),
    'prxwork/workstreams/WS-1-abcdef-alpha/prxissuelist.md': issuelist({
      id: 'IL-1-abcdef',
      issues: [issueBlock('ISS-1-abcdef', { checked: true, status: 'done' }), issueBlock('ISS-2-abcdef')],
    }),
  }, { WS: 2, IL: 1, ISS: 2 }), (dir) => {
    const { status, stdout, stderr } = runGenerator(dir, []);
    assert.strictEqual(status, 0, `default mode exited ${status}\n${stderr}`);
    compareWarnSets(warnLines(stdout), []);
    const lines = stdout.split(/\r?\n/).filter((l) => l.trim());
    assert.strictEqual(
      lines[lines.length - 1],
      'prx-index: 2 workstreams, 3 artefacts, 2 issues (1 open) → prxindex.md + prxkanban.md',
    );
    assert.ok(fs.existsSync(path.join(dir, 'prxwork', 'prxindex.md')), 'prxindex.md was not written into the temp tree');
    assert.ok(fs.existsSync(path.join(dir, 'prxwork', 'prxkanban.md')), 'prxkanban.md was not written into the temp tree');
  });
});

// ---- cases: --sync close mode ----------------------------------------------
// Write-mode cases. They run without --check, so they use --no-board where the
// board is not under test, and they re-read the produced files rather than
// trusting the exit code.

const TL1 = 'prxwork/workstreams/WS-1-abcdef-alpha/prxtasklist.md';
const IL1 = 'prxwork/workstreams/WS-1-abcdef-alpha/prxissuelist.md';
const PLN1 = 'prxwork/workstreams/WS-1-abcdef-alpha/prxplan.md';

const readRel = (dir, rel) => fs.readFileSync(path.join(dir, rel), 'utf8');
const mtimeOf = (dir, rel) => fs.statSync(path.join(dir, rel)).mtimeMs;

// The fixture text with only its status: and updated: frontmatter lines
// changed — the only bytes --sync is permitted to write. Both patterns anchor
// at column 0, so the indented status: lines inside issue and task YAML blocks
// in a body are left alone, exactly as the generator leaves them.
const closedText = (text, day) =>
  text.replace(/^status: .*$/m, 'status: done').replace(/^updated: .*$/m, `updated: ${day}`);

// Runs the generator in --sync mode and compares its SYNC lines, as a set,
// against expectedLines. Returns the full stdout so a case can also inspect
// the WARN lines the same run printed.
function expectSync(dir, expectedLines, extraArgs = ['--no-board']) {
  const { status, stdout, stderr } = runGenerator(dir, ['--sync', ...extraArgs]);
  compareLineSets(stdout.split(/\r?\n/).filter((l) => l.startsWith('SYNC ')), expectedLines, 'SYNC');
  if (status !== 0) {
    throw new Error(
      `--sync exited ${status}, expected 0\n` +
      `  stdout:\n${stdout.trimEnd() || '    (empty)'}\n  stderr:\n${stderr.trimEnd() || '    (empty)'}`,
    );
  }
  return stdout;
}

// Asserts rel is byte-for-byte the fixture text with only those two lines
// substituted, rather than spot-checking the two lines themselves.
function expectClosedFile(dir, rel, fixtureText, day) {
  assert.strictEqual(
    readRel(dir, rel),
    closedText(fixtureText, day),
    `${rel} differs from the fixture by more than its status: and updated: lines`,
  );
}

testCase('--sync closes a task list whose tasks are all checked', () => {
  const day = today();
  const tlText = tasklist({ id: 'TL-1-abcdef', status: 'ready', updated: daysAgo(3), tasks: [taskLine(1, true), taskLine(2, true)] });
  withFixture(baseTree({
    [WS1]: workstream({ id: 'WS-1-abcdef', slug: 'alpha', title: 'Alpha', status: 'done' }),
    [TL1]: tlText,
  }, { TL: 1 }), (dir) => {
    expectSync(dir, [`SYNC TL-1-abcdef (${TL1}): ready → done (all 2 tasks checked)`]);
    expectClosedFile(dir, TL1, tlText, day);
  });
});

testCase('--sync closes an issue list whose issues are all closed', () => {
  const day = today();
  const ilText = issuelist({
    id: 'IL-1-abcdef', status: 'ready', updated: daysAgo(3),
    issues: [issueBlock('ISS-1-abcdef', { checked: true, status: 'done' }), issueBlock('ISS-2-abcdef', { checked: true, status: 'dropped' })],
  });
  withFixture(baseTree({
    [WS1]: workstream({ id: 'WS-1-abcdef', slug: 'alpha', title: 'Alpha', status: 'done' }),
    [IL1]: ilText,
  }, { IL: 1, ISS: 2 }), (dir) => {
    expectSync(dir, [`SYNC IL-1-abcdef (${IL1}): ready → done (all 2 issues closed)`]);
    expectClosedFile(dir, IL1, ilText, day);
  });
});

testCase('--sync closes a workstream whose artefacts are all closed', () => {
  const day = today();
  const wsText = workstream({ id: 'WS-1-abcdef', slug: 'alpha', title: 'Alpha', status: 'ready', updated: daysAgo(3) });
  withFixture(baseTree({
    [WS1]: wsText,
    [TL1]: tasklist({ id: 'TL-1-abcdef', status: 'done', tasks: [taskLine(1, true)] }),
    [IL1]: issuelist({ id: 'IL-1-abcdef', status: 'dropped', issues: [issueBlock('ISS-1-abcdef', { checked: true, status: 'done' })] }),
  }, { TL: 1, IL: 1, ISS: 1 }), (dir) => {
    expectSync(dir, [`SYNC WS-1-abcdef (${WS1}): ready → done (all 2 artefacts closed)`]);
    expectClosedFile(dir, WS1, wsText, day);
  });
});

testCase('--sync closes a task list and then the workstream it completes, in one pass', () => {
  const day = today();
  const wsText = workstream({ id: 'WS-1-abcdef', slug: 'alpha', title: 'Alpha', status: 'in-progress', updated: daysAgo(3) });
  const tlText = tasklist({ id: 'TL-1-abcdef', status: 'in-progress', updated: daysAgo(3), tasks: [taskLine(1, true)] });
  withFixture(baseTree({ [WS1]: wsText, [TL1]: tlText }, { TL: 1 }), (dir) => {
    expectSync(dir, [
      `SYNC TL-1-abcdef (${TL1}): in-progress → done (all 1 tasks checked)`,
      `SYNC WS-1-abcdef (${WS1}): in-progress → done (all 1 artefacts closed)`,
    ]);
    expectClosedFile(dir, TL1, tlText, day);
    expectClosedFile(dir, WS1, wsText, day);
  });
});

testCase('a second --sync run changes no file and prints no SYNC line', () => {
  const day = today();
  const wsText = workstream({ id: 'WS-1-abcdef', slug: 'alpha', title: 'Alpha', status: 'ready', updated: daysAgo(3) });
  const tlText = tasklist({ id: 'TL-1-abcdef', status: 'ready', updated: daysAgo(3), tasks: [taskLine(1, true)] });
  withFixture(baseTree({ [WS1]: wsText, [TL1]: tlText }, { TL: 1 }), (dir) => {
    expectSync(dir, [
      `SYNC TL-1-abcdef (${TL1}): ready → done (all 1 tasks checked)`,
      `SYNC WS-1-abcdef (${WS1}): ready → done (all 1 artefacts closed)`,
    ]);
    const after = [WS1, TL1].map((rel) => ({ rel, text: readRel(dir, rel), mtime: mtimeOf(dir, rel) }));
    expectSync(dir, []);
    for (const f of after) {
      assert.strictEqual(readRel(dir, f.rel), f.text, `${f.rel} was rewritten by the second --sync run`);
      assert.strictEqual(mtimeOf(dir, f.rel), f.mtime, `${f.rel} was touched by the second --sync run`);
      expectClosedFile(dir, TL1, tlText, day);
    }
  });
});

testCase('--sync never closes a workstream owning no artefact', () => {
  const wsText = workstream({ id: 'WS-1-abcdef', slug: 'alpha', title: 'Alpha', status: 'ready' });
  withFixture(baseTree({ [WS1]: wsText }), (dir) => {
    expectSync(dir, []);
    assert.strictEqual(readRel(dir, WS1), wsText, 'a workstream owning no artefact was written');
  });
});

testCase('--sync names the blocking plan and closes neither it nor its workstream', () => {
  const wsText = workstream({ id: 'WS-1-abcdef', slug: 'alpha', title: 'Alpha', status: 'in-progress' });
  const plnText = plan({ id: 'PLN-1-abcdef', status: 'ready' });
  withFixture(baseTree({
    [WS1]: wsText,
    [PLN1]: plnText,
    [TL1]: tasklist({ id: 'TL-1-abcdef', status: 'done', tasks: [taskLine(1, true)] }),
  }, { PLN: 1, TL: 1 }), (dir) => {
    const stdout = expectSync(dir, []);
    assert.ok(
      warnLines(stdout).includes('WS-1-abcdef: every artefact closed except PLN-1-abcdef (ready) — close the plan to close the workstream'),
      `plan-blocker WARN missing from:\n${stdout}`,
    );
    assert.strictEqual(readRel(dir, WS1), wsText, 'the blocked workstream was written');
    assert.strictEqual(readRel(dir, PLN1), plnText, '--sync wrote a plan');
  });
});

testCase('--check warns about a workstream whose artefacts are all closed', () => {
  withFixture(baseTree({
    [WS1]: workstream({ id: 'WS-1-abcdef', slug: 'alpha', title: 'Alpha', status: 'ready' }),
    [TL1]: tasklist({ id: 'TL-1-abcdef', status: 'done', tasks: [taskLine(1, true)] }),
    [IL1]: issuelist({ id: 'IL-1-abcdef', status: 'done', issues: [issueBlock('ISS-1-abcdef', { checked: true, status: 'done' })] }),
  }, { TL: 1, IL: 1, ISS: 1 }), (dir) => {
    expectWarns(dir, [`WS-1-abcdef (${WS1}): all 2 artefacts closed but status is "ready" — close it?`]);
  });
});

testCase('clean: a workstream already closed alongside its artefacts warns about nothing', () => {
  withFixture(baseTree({
    [WS1]: workstream({ id: 'WS-1-abcdef', slug: 'alpha', title: 'Alpha', status: 'done' }),
    [TL1]: tasklist({ id: 'TL-1-abcdef', status: 'done', tasks: [taskLine(1, true)] }),
  }, { TL: 1 }), (dir) => {
    expectWarns(dir, []);
  });
});

for (const combo of [['--check'], ['--list'], ['--claim', 'WS']]) {
  testCase(`--sync ${combo.join(' ')} exits 1 with one stderr line and writes nothing`, () => {
    const wsText = workstream({ id: 'WS-1-abcdef', slug: 'alpha', title: 'Alpha', status: 'ready' });
    const tlText = tasklist({ id: 'TL-1-abcdef', status: 'ready', tasks: [taskLine(1, true)] });
    withFixture(baseTree({ [WS1]: wsText, [TL1]: tlText }, { TL: 1 }), (dir) => {
      const { status, stdout, stderr } = runGenerator(dir, ['--sync', ...combo]);
      assert.strictEqual(status, 1, `expected exit 1, got ${status}\n  stdout:\n${stdout}`);
      const errLines = stderr.split(/\r?\n/).filter((l) => l.trim());
      assert.strictEqual(errLines.length, 1, `expected one stderr line, got:\n${stderr}`);
      assert.strictEqual(stdout, '', `expected no stdout, got:\n${stdout}`);
      assert.strictEqual(readRel(dir, WS1), wsText, 'the workstream was written by a refused run');
      assert.strictEqual(readRel(dir, TL1), tlText, 'the task list was written by a refused run');
      for (const rel of ['prxwork/prxindex.md', 'prxwork/prxkanban.md', 'prxwork/ids']) {
        assert.ok(!fs.existsSync(path.join(dir, rel)), `${rel} was created by a refused run`);
      }
    });
  });
}

testCase('--sync --no-board writes prxindex.md and leaves the board alone', () => {
  withFixture(baseTree({
    [WS1]: workstream({ id: 'WS-1-abcdef', slug: 'alpha', title: 'Alpha', status: 'ready' }),
    [TL1]: tasklist({ id: 'TL-1-abcdef', status: 'ready', tasks: [taskLine(1, true)] }),
  }, { TL: 1 }), (dir) => {
    expectSync(dir, [
      `SYNC TL-1-abcdef (${TL1}): ready → done (all 1 tasks checked)`,
      `SYNC WS-1-abcdef (${WS1}): ready → done (all 1 artefacts closed)`,
    ]);
    assert.ok(fs.existsSync(path.join(dir, 'prxwork', 'prxindex.md')), 'prxindex.md was not written');
    assert.ok(!fs.existsSync(path.join(dir, 'prxwork', 'prxkanban.md')), 'prxkanban.md was written despite --no-board');
  });
});

// ---- cases: required frontmatter keys --------------------------------------
// One case per required key, omitting exactly that key from an otherwise clean
// record. `id` is absent from this list on purpose: a record with no id never
// reaches the schema check, because the scan excludes it first — the case below
// asserts that instead.

const WS_REQUIRED_KEYS = ['type', 'workstream', 'slug', 'title', 'status', 'created', 'updated', 'depends_on', 'links', 'tags'];

for (const key of WS_REQUIRED_KEYS) {
  testCase(`a workstream record missing ${key} warns, naming the key and the type`, () => {
    // Dropping type: leaves the record typeless, so the warning reports the
    // empty type it actually read, and the per-type keys no longer apply.
    const type = key === 'type' ? '' : 'workstream';
    const expected = [`WS-1-abcdef (${WS1}): missing required frontmatter key "${key}" for type "${type}"`];
    // An absent status also leaves the enum check an empty value to report.
    if (key === 'status') expected.push(`${WS1}: status "" not in enum`);
    withFixture(baseTree({
      [WS1]: withoutKey(workstream({ id: 'WS-1-abcdef', slug: 'alpha', title: 'Alpha' }), key),
    }), (dir) => {
      expectWarns(dir, expected);
    });
  });
}

testCase('a record missing id is excluded by the scan before the schema check', () => {
  withFixture(baseTree({
    [WS1]: withoutKey(workstream({ id: 'WS-1-abcdef', slug: 'alpha', title: 'Alpha' }), 'id'),
  }), (dir) => {
    // The excluded record takes WS-1-abcdef out of the scan, which leaves the WS
    // counter with neither an artefact nor a marker behind it. The second line
    // is that counter check firing correctly, not a side effect of the first.
    expectWarns(dir, [
      `${WS1}: missing frontmatter or id — excluded from index`,
      'prxids.md: WS counter is 1 but no WS-1 artefact or marker exists',
    ]);
  });
});

testCase('clean: a workstream record carrying every required key warns about nothing', () => {
  withFixture(baseTree(), (dir) => {
    expectWarns(dir, []);
  });
});

testCase('a task list missing mode warns, naming the key and the type', () => {
  withFixture(baseTree({
    [TL1]: withoutKey(tasklist({ id: 'TL-1-abcdef', tasks: [taskLine(1, false)] }), 'mode'),
  }, { TL: 1 }), (dir) => {
    expectWarns(dir, [`TL-1-abcdef (${TL1}): missing required frontmatter key "mode" for type "tasklist"`]);
  });
});

testCase('a task list whose mode is outside the enum warns', () => {
  withFixture(baseTree({
    [TL1]: tasklist({ id: 'TL-1-abcdef', mode: 'neither', tasks: [taskLine(1, false)] }),
  }, { TL: 1 }), (dir) => {
    expectWarns(dir, [`TL-1-abcdef (${TL1}): mode "neither" not in enum (expected: spec, diff)`]);
  });
});

testCase('clean: a task list whose mode is diff warns about nothing', () => {
  withFixture(baseTree({
    [TL1]: tasklist({ id: 'TL-1-abcdef', mode: 'diff', tasks: [taskLine(1, false)] }),
  }, { TL: 1 }), (dir) => {
    expectWarns(dir, []);
  });
});

// ---- cases: workstream self-reference --------------------------------------

testCase('a workstream whose workstream key names another id warns', () => {
  withFixture(baseTree({
    [WS1]: workstream({ id: 'WS-1-abcdef', slug: 'alpha', title: 'Alpha', workstream: 'WS-2-abcdef' }),
  }), (dir) => {
    expectWarns(dir, [`WS-1-abcdef (${WS1}): workstream key "WS-2-abcdef" is not its own id`]);
  });
});

testCase('clean: a workstream naming itself warns about nothing', () => {
  withFixture(baseTree({
    [WS1]: workstream({ id: 'WS-1-abcdef', slug: 'alpha', title: 'Alpha', workstream: 'WS-1-abcdef' }),
  }), (dir) => {
    expectWarns(dir, []);
  });
});

// ---- cases: updated vs mtime -----------------------------------------------
// Both cases pin the file's mtime, so neither depends on when the run happens.

testCase('an artefact modified two days after its updated date warns with both dates', () => {
  const stale = daysAgo(2);
  const day = today();
  withFixture(baseTree({
    [WS1]: workstream({ id: 'WS-1-abcdef', slug: 'alpha', title: 'Alpha', updated: stale }),
  }), (dir) => {
    setMtime(dir, WS1, day);
    expectWarns(dir, [`WS-1-abcdef (${WS1}): updated ${stale} but file modified ${day} — bump updated on every edit`]);
  });
});

testCase('clean: an artefact modified inside the one-day grace warns about nothing', () => {
  withFixture(baseTree({
    [WS1]: workstream({ id: 'WS-1-abcdef', slug: 'alpha', title: 'Alpha', updated: daysAgo(1) }),
  }), (dir) => {
    setMtime(dir, WS1, today());
    expectWarns(dir, []);
  });
});

// ---- cases: filename, folder and body shape --------------------------------

testCase('a filename outside the allowed set for its type warns', () => {
  const rel = 'prxwork/workstreams/WS-1-abcdef-alpha/prxplan-v2.md';
  withFixture(baseTree({ [rel]: plan({ id: 'PLN-1-abcdef' }) }, { PLN: 1 }), (dir) => {
    expectWarns(dir, [`${rel}: filename not allowed for type "plan" (expected: prxplan.md)`]);
  });
});

testCase('clean: a qualified issue-list filename is allowed', () => {
  withFixture(baseTree({
    'prxwork/workstreams/WS-1-abcdef-alpha/prxissuelist-second.md': issuelist({ id: 'IL-1-abcdef', issues: [issueBlock('ISS-1-abcdef')] }),
  }, { IL: 1, ISS: 1 }), (dir) => {
    expectWarns(dir, []);
  });
});

testCase('a workstream folder disagreeing with its id and slug warns', () => {
  // Not baseTree: the record sits in the wrong folder, and a second folder
  // holding the right name would report a missing record of its own.
  const rel = 'prxwork/workstreams/WS-1-abcdef-wrong/prxworkstream.md';
  withFixture({
    'prxwork/prxids.md': registry({ WS: 1 }),
    'prxwork/prxtags.md': tagPool(),
    [rel]: workstream({ id: 'WS-1-abcdef', slug: 'alpha', title: 'Alpha' }),
  }, (dir) => {
    expectWarns(dir, [`WS-1-abcdef (${rel}): folder "WS-1-abcdef-wrong" should be "WS-1-abcdef-alpha" per its id and slug`]);
  });
});

testCase('clean: a workstream folder matching its id and slug warns about nothing', () => {
  withFixture({
    'prxwork/prxids.md': registry({ WS: 1 }),
    'prxwork/prxtags.md': tagPool(),
    [WS1]: workstream({ id: 'WS-1-abcdef', slug: 'alpha', title: 'Alpha' }),
  }, (dir) => {
    expectWarns(dir, []);
  });
});

testCase('a folder under workstreams holding no prxworkstream.md warns', () => {
  withFixture(baseTree({
    'prxwork/workstreams/WS-2-abcdef-beta/prxplan.md': plan({ id: 'PLN-1-abcdef', workstream: 'WS-2-abcdef', slug: 'beta' }),
  }, { PLN: 1 }), (dir) => {
    expectWarns(dir, ['prxwork/workstreams/WS-2-abcdef-beta/: no prxworkstream.md — not a workstream folder']);
  });
});

testCase('clean: every folder holding its own record warns about nothing', () => {
  withFixture(baseTree({
    [WS2]: workstream({ id: 'WS-2-abcdef', slug: 'beta' }),
    'prxwork/workstreams/WS-2-abcdef-beta/prxplan.md': plan({ id: 'PLN-1-abcdef', workstream: 'WS-2-abcdef', slug: 'beta' }),
  }, { WS: 2, PLN: 1 }), (dir) => {
    expectWarns(dir, []);
  });
});

testCase('a workstream body of headings only warns that the card description is missing', () => {
  withFixture(baseTree({
    [WS1]: workstream({ id: 'WS-1-abcdef', slug: 'alpha', title: 'Alpha', body: '# Heading\n\n## Another heading\n' }),
  }), (dir) => {
    expectWarns(dir, [`WS-1-abcdef (${WS1}): body has no card-description line`]);
  });
});

testCase('clean: a workstream body whose description follows a heading warns about nothing', () => {
  withFixture(baseTree({
    [WS1]: workstream({ id: 'WS-1-abcdef', slug: 'alpha', title: 'Alpha', body: '# Heading\n\nThe card description line.\n' }),
  }), (dir) => {
    expectWarns(dir, []);
  });
});

// The board reads the trimmed line, so the boundary is asserted on the trimmed
// length: 201 characters warns, 200 does not.
testCase('a workstream first body line of 201 characters warns', () => {
  withFixture(baseTree({
    [WS1]: workstream({ id: 'WS-1-abcdef', slug: 'alpha', title: 'Alpha', body: `  ${'x'.repeat(201)}  \n` }),
  }), (dir) => {
    expectWarns(dir, [`WS-1-abcdef (${WS1}): first body line is 201 characters — the board shows only 200`]);
  });
});

testCase('clean: a workstream first body line of 200 characters warns about nothing', () => {
  withFixture(baseTree({
    [WS1]: workstream({ id: 'WS-1-abcdef', slug: 'alpha', title: 'Alpha', body: `  ${'x'.repeat(200)}  \n` }),
  }), (dir) => {
    expectWarns(dir, []);
  });
});

// ---- case: several conditions in one tree ----------------------------------
// A single-condition case cannot see an ordering or duplication bug, so one
// tree carries five faults at once and the whole WARN set is asserted.

testCase('a tree carrying several schema and shape faults warns about each of them', () => {
  const stale = daysAgo(2);
  const day = today();
  const planRel = 'prxwork/workstreams/WS-1-abcdef-alpha/prxplan-v2.md';
  const taskRel = 'prxwork/workstreams/WS-2-abcdef-beta/prxtasklist.md';
  withFixture({
    'prxwork/prxids.md': registry({ WS: 1, PLN: 1, TL: 1 }),
    'prxwork/prxtags.md': tagPool(),
    [WS1]: withoutKey(workstream({ id: 'WS-1-abcdef', slug: 'alpha', title: 'Alpha', body: `${'y'.repeat(201)}\n` }), 'tags'),
    [planRel]: plan({ id: 'PLN-1-abcdef', updated: stale }),
    [taskRel]: tasklist({ id: 'TL-1-abcdef', workstream: 'WS-2-abcdef', slug: 'beta', mode: 'neither', tasks: [taskLine(1, false)] }),
  }, (dir) => {
    setMtime(dir, planRel, day);
    expectWarns(dir, [
      `WS-1-abcdef (${WS1}): missing required frontmatter key "tags" for type "workstream"`,
      `WS-1-abcdef (${WS1}): first body line is 201 characters — the board shows only 200`,
      `${planRel}: filename not allowed for type "plan" (expected: prxplan.md)`,
      `PLN-1-abcdef (${planRel}): updated ${stale} but file modified ${day} — bump updated on every edit`,
      `TL-1-abcdef (${taskRel}): mode "neither" not in enum (expected: spec, diff)`,
      'prxwork/workstreams/WS-2-abcdef-beta/: no prxworkstream.md — not a workstream folder',
    ]);
  });
});

// ---- cases: tag pool membership --------------------------------------------
// The generator's own check is a literal edit-distance backstop, not a synonym
// finder: orchestrator sits two edits from orchestration and draws a
// suggestion, while gating sits three from gates and draws none. Both forms of
// the WARN are asserted in one case, so a change to either string fails here.

testCase('a workstream tag outside the pool warns, with a nearest match only when one is close', () => {
  withFixture(baseTree({
    [WS1]: workstream({ id: 'WS-1-abcdef', slug: 'alpha', title: 'Alpha', tags: ['orchestrator', 'gating'] }),
  }), (dir) => {
    expectWarns(dir, [
      `WS-1-abcdef (${WS1}): tag "#orchestrator" not in the tag pool — nearest defined tag: "#orchestration"`,
      `WS-1-abcdef (${WS1}): tag "#gating" not in the tag pool`,
    ]);
  });
});

testCase('clean: tags listed in the pool warn about nothing', () => {
  withFixture(baseTree({
    [WS1]: workstream({ id: 'WS-1-abcdef', slug: 'alpha', title: 'Alpha', tags: ['orchestration', 'gates'] }),
  }), (dir) => {
    expectWarns(dir, []);
  });
});

// ---- cases: --new-ws scaffold mode -----------------------------------------
// Write-mode cases. They re-read the record the generator wrote rather than
// trusting its exit code, and they count the marker directories under
// prxwork/ids/ so a leaked claim cannot pass unnoticed.

// The exact record --new-ws writes: every required key at a valid value, in
// CONVENTIONS.md's key order, and an empty body.
const newWsRecord = (id, slug, title, o = {}) =>
  [
    '---',
    `id: ${id}`,
    'type: workstream',
    `workstream: ${id}`,
    `slug: ${slug}`,
    `title: "${title}"`,
    `status: ${o.status !== undefined ? o.status : 'backlog'}`,
    `tags: [${(o.tags || []).join(', ')}]`,
    `created: ${o.day}`,
    `updated: ${o.day}`,
    `author: ${gitAuthor()}`,
    'depends_on: []',
    'links: []',
    '---',
    '',
  ].join('\n');

const idsEntries = (dir) => {
  const p = path.join(dir, 'prxwork', 'ids');
  return fs.existsSync(p) ? fs.readdirSync(p).sort() : [];
};

const wsFolders = (dir) => fs.readdirSync(path.join(dir, 'prxwork', 'workstreams')).sort();

const outLines = (s) => s.split(/\r?\n/).filter((l) => l.length);

// A fixture id carries the fixed sample suffix, but an id the generator claims
// carries a suffix drawn at claim time. Such an id is asserted by shape and
// then read back into whatever the case derives from it — never pinned to a
// literal.
const assertIdShape = (id, type, what) =>
  assert.ok(
    new RegExp(`^${type}-\\d+-[0-9a-z]{6}$`).test(id),
    `${what}: "${id}" is not a ${type}-N-SUFFIX id`,
  );

// Asserts one stderr line and no stdout, the shape every refusal takes.
function expectRefusal(res, what) {
  assert.strictEqual(res.status, 1, `${what}: expected exit 1, got ${res.status}\n  stdout:\n${res.stdout}`);
  assert.strictEqual(res.stdout, '', `${what}: expected no stdout, got:\n${res.stdout}`);
  const errLines = outLines(res.stderr);
  assert.strictEqual(errLines.length, 1, `${what}: expected one stderr line, got:\n${res.stderr}`);
}

// An empty spec: fixture() still creates prxwork/workstreams/, which the
// generator requires, so --new-ws claims WS-1-abcdef in a tree holding nothing else.
const EMPTY_TREE = {};

testCase('--new-ws writes a complete record and prints the claimed id and its path', () => {
  const day = today();
  withFixture(EMPTY_TREE, (dir) => {
    const res = runGenerator(dir, ['--new-ws', 'demo', '--title', 'Demo workstream']);
    assert.strictEqual(res.status, 0, `--new-ws exited ${res.status}\n${res.stderr}`);
    // The claimed suffix is random, so the printed id is asserted by shape and
    // the folder, path, record and marker are all derived from it.
    const printed = outLines(res.stdout);
    assertIdShape(printed[0], 'WS', '--new-ws printed id');
    const id = printed[0];
    const rel = `prxwork/workstreams/${id}-demo/prxworkstream.md`;
    assert.deepStrictEqual(printed, [id, rel]);
    // Byte comparison, so an added, missing, misordered or misvalued key fails.
    // Defaults are asserted here: no --tags gives tags: [], no --status gives
    // status: backlog.
    assert.strictEqual(readRel(dir, rel), newWsRecord(id, 'demo', 'Demo workstream', { day }));
    assert.strictEqual(readRel(dir, rel).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, ''), '', 'the body is not empty');
    assert.deepStrictEqual(idsEntries(dir), [id], 'the marker directory for the claimed id is missing');
  });
});

testCase('--new-ws honours --tags and --status', () => {
  const day = today();
  withFixture(EMPTY_TREE, (dir) => {
    const res = runGenerator(dir, [
      '--new-ws', 'demo', '--title', 'Demo workstream', '--tags', 'generator,skill-files', '--status', 'ready',
    ]);
    assert.strictEqual(res.status, 0, `--new-ws exited ${res.status}\n${res.stderr}`);
    const id = outLines(res.stdout)[0];
    assertIdShape(id, 'WS', '--new-ws printed id');
    const rel = `prxwork/workstreams/${id}-demo/prxworkstream.md`;
    assert.strictEqual(
      readRel(dir, rel),
      newWsRecord(id, 'demo', 'Demo workstream', { day, tags: ['generator', 'skill-files'], status: 'ready' }),
    );
  });
});

testCase('--new-ws with no --status writes the literal line status: backlog', () => {
  withFixture(EMPTY_TREE, (dir) => {
    const res = runGenerator(dir, ['--new-ws', 'demo', '--title', 'Demo workstream']);
    assert.strictEqual(res.status, 0, `--new-ws exited ${res.status}\n${res.stderr}`);
    const id = outLines(res.stdout)[0];
    assertIdShape(id, 'WS', '--new-ws printed id');
    const rel = `prxwork/workstreams/${id}-demo/prxworkstream.md`;
    // The expected line is written out here, not built from newWsRecord: this
    // case pins the script's own creation default, so the fixture and the
    // script cannot drift together unnoticed.
    assert.ok(
      outLines(readRel(dir, rel)).includes('status: backlog'),
      `the record does not carry the line "status: backlog":\n${readRel(dir, rel)}`,
    );
  });
});

testCase('a tree scaffolded by --new-ws produces no frontmatter WARN in a default scan', () => {
  // The pool file is the one thing the tree carries: --new-ws does not seed it
  // either, and its absence would add an advisory line to the set asserted below.
  withFixture({ 'prxwork/prxtags.md': tagPool() }, (dir) => {
    const scaffold = runGenerator(dir, ['--new-ws', 'demo', '--title', 'Demo workstream']);
    assert.strictEqual(scaffold.status, 0, `--new-ws exited ${scaffold.status}\n${scaffold.stderr}`);
    const id = outLines(scaffold.stdout)[0];
    assertIdShape(id, 'WS', '--new-ws printed id');
    const { status, stdout, stderr } = runGenerator(dir, []);
    // Exactly two warnings, and neither concerns frontmatter: the body the
    // command deliberately leaves for the agent to append, and the registry it
    // deliberately does not write back — the write-back stays in --claim.
    compareWarnSets(warnLines(stdout), [
      `${id} (prxwork/workstreams/${id}-demo/prxworkstream.md): body has no card-description line`,
      'prxwork/prxids.md missing — create it before allocating new IDs',
    ]);
    assert.strictEqual(status, 0, `default mode exited ${status}\n${stderr}`);
    // The scan writes both views into the fixture; that is expected output.
    assert.ok(fs.existsSync(path.join(dir, 'prxwork', 'prxindex.md')), 'prxindex.md was not written');
    assert.ok(fs.existsSync(path.join(dir, 'prxwork', 'prxkanban.md')), 'prxkanban.md was not written');
  });
});

testCase('--new-ws refuses a slug an existing folder carries and leaks no marker', () => {
  withFixture(EMPTY_TREE, (dir) => {
    const first = runGenerator(dir, ['--new-ws', 'demo', '--title', 'Demo workstream']);
    assert.strictEqual(first.status, 0, `the first --new-ws exited ${first.status}\n${first.stderr}`);
    const id = outLines(first.stdout)[0];
    assertIdShape(id, 'WS', '--new-ws printed id');
    const markersBefore = idsEntries(dir);
    const second = runGenerator(dir, ['--new-ws', 'demo', '--title', 'Demo again']);
    expectRefusal(second, '--new-ws on a taken slug');
    assert.deepStrictEqual(idsEntries(dir), markersBefore, 'the refused run leaked a marker directory');
    assert.deepStrictEqual(wsFolders(dir), [`${id}-demo`], 'the refused run created a folder');
  });
});

testCase('--claim prints its ids and writes the registry back after the allocateIds refactor', () => {
  withFixture(baseTree(), (dir) => {
    const res = runGenerator(dir, ['--claim', 'TL', '2']);
    assert.strictEqual(res.status, 0, `--claim exited ${res.status}\n${res.stderr}`);
    // Two ids of the right shape, numbered 1 and 2: the suffixes are random, so
    // only the numbering and the shape are pinned, and the marker directories
    // are compared against the ids the run actually printed.
    const printed = outLines(res.stdout);
    assert.strictEqual(printed.length, 2, `--claim stdout changed:\n${res.stdout}`);
    for (const id of printed) assertIdShape(id, 'TL', '--claim printed id');
    assert.deepStrictEqual(printed.map((id) => id.split('-')[1]), ['1', '2'], '--claim numbering changed');
    assert.strictEqual(res.stderr, '', `--claim wrote to stderr:\n${res.stderr}`);
    assert.deepStrictEqual(idsEntries(dir), [...printed].sort(), '--claim did not create its marker directories');
    assert.strictEqual(
      readRel(dir, 'prxwork/prxids.md'),
      registry({ WS: 1, TL: 2 }),
      '--claim registry write-back changed',
    );
  });
});

for (const combo of [['--list'], ['--claim', 'WS'], ['--check'], ['--sync']]) {
  testCase(`--new-ws ${combo.join(' ')} exits 1 with one stderr line and writes nothing`, () => {
    withFixture(EMPTY_TREE, (dir) => {
      const res = runGenerator(dir, ['--new-ws', 'demo', '--title', 'Demo workstream', ...combo]);
      expectRefusal(res, `--new-ws ${combo.join(' ')}`);
      assert.deepStrictEqual(wsFolders(dir), [], 'a refused run created a workstream folder');
      assert.deepStrictEqual(idsEntries(dir), [], 'a refused run claimed an id');
    });
  });
}

// ---- cases: ID graph — orphan markers, counters ahead, links: and issues: ---
// The marker cases pin the marker directory's mtime rather than accepting
// whatever the filesystem set at creation, because the age the WARN reports is
// derived from it. The two grace-period cases sit half a day and three days
// out, clearly on each side of the one-day boundary, so neither can flake.

// Creates prxwork/ids/<id>/ as a directory — a marker is a directory, not a
// file, so fixture()'s spec map cannot express it — and ages it by ageDays.
function marker(dir, id, ageDays = 0) {
  const p = path.join(dir, 'prxwork', 'ids', id);
  fs.mkdirSync(p, { recursive: true });
  if (ageDays) {
    const t = new Date(Date.now() - ageDays * 86400000);
    fs.utimesSync(p, t, t);
  }
}

// A task line carrying an indented issues: inline array below it, the way the
// key is written in task YAML. taskLine() above produces the bare line.
const taskIssues = (n, ids) => `- [ ] ${n}. Fixture task\n  issues: [${ids.join(', ')}]\n`;
const childTaskIssues = (n, ids) => `  - [ ] ${n} Fixture child task\n    issues: [${ids.join(', ')}]\n`;

testCase('a marker directory past the grace period with no artefact warns with its age', () => {
  withFixture(baseTree({}, { PLN: 2 }), (dir) => {
    marker(dir, 'PLN-2-abcdef', 3);
    expectWarns(dir, ['prxwork/ids/PLN-2-abcdef: claimed 3 days ago but no artefact carries it']);
  });
});

testCase('clean: a marker directory inside the grace period warns about nothing', () => {
  withFixture(baseTree({}, { PLN: 2 }), (dir) => {
    marker(dir, 'PLN-2-abcdef', 0.5);
    expectWarns(dir, []);
  });
});

testCase('clean: an aged marker whose id an artefact carries warns about nothing', () => {
  withFixture(baseTree({
    'prxwork/workstreams/WS-1-abcdef-alpha/prxplan.md': plan({ id: 'PLN-1-abcdef' }),
  }, { PLN: 1 }), (dir) => {
    marker(dir, 'PLN-1-abcdef', 5);
    expectWarns(dir, []);
  });
});

// Resolution goes through byId, which holds issue ids as well as artefact ids,
// so an ISS marker resolves against its issue record. Asserted, not assumed.
testCase('clean: an aged ISS marker resolving against an issue record warns about nothing', () => {
  withFixture(baseTree({
    'prxwork/workstreams/WS-1-abcdef-alpha/prxissuelist.md': issuelist({ id: 'IL-1-abcdef', issues: [issueBlock('ISS-1-abcdef')] }),
  }, { IL: 1, ISS: 1 }), (dir) => {
    marker(dir, 'ISS-1-abcdef', 5);
    expectWarns(dir, []);
  });
});

testCase('a registry counter ahead of both the artefacts and the markers warns', () => {
  withFixture(baseTree({}, { PLN: 4 }), (dir) => {
    expectWarns(dir, ['prxids.md: PLN counter is 4 but no PLN-4 artefact or marker exists']);
  });
});

// A counter with no artefact but a matching marker is a claim in flight, not
// drift: the marker is a source, so the counter is justified.
testCase('clean: a counter matched by a marker with no artefact yet warns about nothing', () => {
  withFixture(baseTree({}, { PLN: 4 }), (dir) => {
    marker(dir, 'PLN-4-abcdef', 0.5);
    expectWarns(dir, []);
  });
});

testCase('the counter-behind warning still fires with its original string beside the new checks', () => {
  withFixture(baseTree({}, { WS: 0 }), (dir) => {
    marker(dir, 'WS-1-abcdef', 0.5);
    expectWarns(dir, ['prxids.md: WS counter is 0 but WS-1 exists — registry behind']);
  });
});

testCase('an unresolved links target warns', () => {
  withFixture(baseTree({
    [WS1]: workstream({ id: 'WS-1-abcdef', slug: 'alpha', title: 'Alpha', links: ['PLN-99-abcdef'] }),
  }), (dir) => {
    expectWarns(dir, [`WS-1-abcdef (${WS1}): links unknown id PLN-99-abcdef`]);
  });
});

testCase('clean: a links target that resolves warns about nothing', () => {
  withFixture(baseTree({
    [WS1]: workstream({ id: 'WS-1-abcdef', slug: 'alpha', title: 'Alpha', links: ['PLN-1-abcdef'] }),
    'prxwork/workstreams/WS-1-abcdef-alpha/prxplan.md': plan({ id: 'PLN-1-abcdef' }),
  }, { PLN: 1 }), (dir) => {
    expectWarns(dir, []);
  });
});

testCase('an unresolved issues target on a task line warns, naming the task number', () => {
  withFixture(baseTree({
    [TL1]: tasklist({ id: 'TL-1-abcdef', tasks: [taskIssues(1, ['ISS-99-abcdef'])] }),
  }, { TL: 1 }), (dir) => {
    expectWarns(dir, [`TL-1-abcdef (${TL1}) task 1: issues unknown id ISS-99-abcdef`]);
  });
});

testCase('an unresolved issues target on a child task line names the child number', () => {
  withFixture(baseTree({
    [TL1]: tasklist({ id: 'TL-1-abcdef', tasks: [taskLine(1, false), childTaskIssues('1.1', ['ISS-99-abcdef'])] }),
  }, { TL: 1 }), (dir) => {
    expectWarns(dir, [`TL-1-abcdef (${TL1}) task 1.1: issues unknown id ISS-99-abcdef`]);
  });
});

testCase('clean: an issues target that resolves warns about nothing', () => {
  withFixture(baseTree({
    [IL1]: issuelist({ id: 'IL-1-abcdef', issues: [issueBlock('ISS-1-abcdef')] }),
    [TL1]: tasklist({ id: 'TL-1-abcdef', tasks: [taskIssues(1, ['ISS-1-abcdef'])] }),
  }, { IL: 1, TL: 1, ISS: 1 }), (dir) => {
    expectWarns(dir, []);
  });
});

testCase('clean: an empty issues array on a task line is not a reference', () => {
  withFixture(baseTree({
    [TL1]: tasklist({ id: 'TL-1-abcdef', tasks: [taskIssues(1, [])] }),
  }, { TL: 1 }), (dir) => {
    expectWarns(dir, []);
  });
});

// ---- cases: leases and the registry header ---------------------------------
// The lease cases fix the acquired timestamp in the fixture rather than letting
// the clock decide it, because the age the WARN reports is derived from it. The
// two ages sit clearly on each side of the sixty-minute boundary.

const LEASE1 = 'prxwork/workstreams/WS-1-abcdef-alpha/.prxlease';

const lease = (session, minutesAgo) =>
  `session: ${session}\nacquired: ${new Date(Date.now() - minutesAgo * 60000).toISOString()}\n`;

// The header a registry carried before the script owned the text: the
// read-and-write-back method, which --claim replaced.
const STALE_HEADER = '# Praxis ID Registry\n\n'
  + 'Last-issued ID per type. To claim IDs: read this file, take the next N numbers for\n'
  + 'your type, write the incremented counter back IMMEDIATELY, then use them.\n\n';

const HEADER_WARN = 'prxids.md: header text is out of date — rewritten';

testCase('clean: a lease acquired five minutes ago warns about nothing', () => {
  withFixture(baseTree({ [LEASE1]: lease('sess-fresh', 5) }), (dir) => {
    expectWarns(dir, []);
  });
});

testCase('a lease held past sixty minutes warns with its session and its age', () => {
  withFixture(baseTree({ [LEASE1]: lease('sess-stale', 90.5) }), (dir) => {
    expectWarns(dir, [
      'prxwork/workstreams/WS-1-abcdef-alpha/.prxlease: held by session sess-stale for 90 minutes — stale',
    ]);
  });
});

// The generator reports a stale lease and never removes one: a lock deleted by
// a process that never held it is worse than a lock held too long.
testCase('no mode deletes a lease', () => {
  withFixture(baseTree({ [LEASE1]: lease('sess-stale', 90.5) }), (dir) => {
    const leasePath = path.join(dir, LEASE1);
    runGenerator(dir, ['--check']);
    assert.ok(fs.existsSync(leasePath), '--check deleted the lease');
    runGenerator(dir, []);
    assert.ok(fs.existsSync(leasePath), 'default mode deleted the lease');
  });
});

// The counters are the user's data: they survive the header rewrite exactly,
// which is why the fixture's counters are not all zero.
testCase('default mode rewrites a stale registry header and keeps every counter line', () => {
  const counters = { WS: 1, TL: 3 };
  withFixture(baseTree({}, counters, [], STALE_HEADER), (dir) => {
    marker(dir, 'TL-3-abcdef', 0.5); // justifies the TL counter, so only the header warns
    const { status, stdout, stderr } = runGenerator(dir, []);
    compareWarnSets(warnLines(stdout), [HEADER_WARN]);
    assert.strictEqual(status, 0, `default mode exited ${status}\n${stderr}`);
    assert.strictEqual(readRel(dir, 'prxwork/prxids.md'), registry(counters));
  });
});

testCase('--check reports the stale registry header and leaves the file byte-identical', () => {
  const counters = { WS: 1, TL: 3 };
  const fixtureText = registry(counters, [], STALE_HEADER);
  withFixture(baseTree({}, counters, [], STALE_HEADER), (dir) => {
    marker(dir, 'TL-3-abcdef', 0.5);
    expectWarns(dir, [HEADER_WARN]);
    assert.strictEqual(readRel(dir, 'prxwork/prxids.md'), fixtureText, '--check rewrote prxids.md');
  });
});

// A correct registry is left alone rather than rewritten identically. The mtime
// is pinned to a past day first, so a repeated write shows up whatever the
// filesystem's timestamp resolution; the byte comparison backs it up.
testCase('default mode skips the write when the registry header already matches', () => {
  withFixture(baseTree({}, { WS: 1 }), (dir) => {
    setMtime(dir, 'prxwork/prxids.md', daysAgo(2));
    const before = mtimeOf(dir, 'prxwork/prxids.md');
    const text = readRel(dir, 'prxwork/prxids.md');
    const { status, stdout } = runGenerator(dir, []);
    compareWarnSets(warnLines(stdout), []);
    assert.strictEqual(status, 0, `default mode exited ${status}`);
    assert.strictEqual(mtimeOf(dir, 'prxwork/prxids.md'), before, 'prxids.md was rewritten');
    assert.strictEqual(readRel(dir, 'prxwork/prxids.md'), text);
  });
});

testCase('the registry --claim seeds carries the same canonical header', () => {
  withFixture(EMPTY_TREE, (dir) => {
    const res = runGenerator(dir, ['--claim', 'WS']);
    assert.strictEqual(res.status, 0, `--claim exited ${res.status}\n${res.stderr}`);
    assert.strictEqual(readRel(dir, 'prxwork/prxids.md'), registry({ WS: 1 }));
    assert.ok(readRel(dir, 'prxwork/prxids.md').startsWith(REGISTRY_HEADER), 'the seeded header is not canonical');
  });
});

// ---- cases: --help ---------------------------------------------------------
// --help prints the script's whole interface on stdout and exits 0 before every
// other mode runs. The cases pin the output's head and tail, the flag and enum
// inventory the text must document, and — in two different trees — that the run
// reads no file and writes none.

// Every flag prx-index.mjs parses. A flag added to the script without an entry
// in HELP fails the completeness case below by name.
const HELP_FLAGS = [
  '--root', '--no-board', '--check', '--sync', '--list', '--ws', '--sort',
  '--desc', '--archived', '--claim', '--new-ws', '--title', '--tags',
  '--status', '--whoami', '--help',
];

// The four enum lists, each pinned as the exact unwrapped substring the help
// text carries on one line. A bare enum word such as id or title is
// deliberately not pinned on its own: those words occur in the surrounding
// prose, so such an assertion would pass whatever the enum lines said.
const HELP_ENUMS = [
  'workstreams | plans | issuelists | tasklists | issues | all',
  'id | created | updated | status | title | severity',
  'WS | PLN | IL | TL | ISS',
  'backlog | ready | in-progress | blocked | done | dropped',
];

testCase('--help prints the interface on stdout and exits 0', () => {
  withFixture(baseTree(), (dir) => {
    const { status, stdout, stderr } = runGenerator(dir, ['--help']);
    assert.strictEqual(status, 0, `--help exited ${status}\n${stderr}`);
    assert.strictEqual(stderr, '', `--help wrote to stderr:\n${stderr}`);
    assert.ok(stdout.startsWith('prx-index.mjs'), `--help stdout starts:\n${stdout.slice(0, 80)}`);
    assert.ok(stdout.includes('Usage:'), '--help printed no Usage: block');
    assert.ok(stdout.endsWith('\n'), '--help output does not end in a newline');
  });
});

testCase('--help documents every flag and every enum the script accepts', () => {
  withFixture(baseTree(), (dir) => {
    const { status, stdout, stderr } = runGenerator(dir, ['--help']);
    assert.strictEqual(status, 0, `--help exited ${status}\n${stderr}`);
    for (const flag of HELP_FLAGS) {
      assert.ok(stdout.includes(flag), `--help does not document ${flag}`);
    }
    for (const line of HELP_ENUMS) {
      assert.ok(stdout.includes(line), `--help does not carry the enum list "${line}"`);
    }
  });
});

testCase('--help answers in a tree with no prxwork/ and creates nothing', () => {
  // fixture() and withFixture() always create prxwork/workstreams/, which is
  // the one thing this case must not have: the point of the case is that help
  // answers outside a Praxis tree, where every other mode exits 1.
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), FIXTURE_PREFIX)));
  try {
    const { status, stdout, stderr } = runGenerator(dir, ['--help']);
    assert.strictEqual(status, 0, `--help exited ${status}\n${stderr}`);
    assert.strictEqual(stderr, '', `--help wrote to stderr:\n${stderr}`);
    assert.ok(stdout.startsWith('prx-index.mjs'), `--help stdout starts:\n${stdout.slice(0, 80)}`);
    // Zero entries, which is also the assertion that no .gitignore was created.
    assert.deepStrictEqual(fs.readdirSync(dir), [], '--help wrote into the directory');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

for (const combo of [['--check'], ['--claim', 'WS'], ['--sync'], ['--list', 'all']]) {
  testCase(`--help takes precedence over ${combo.join(' ')} in either order and writes nothing`, () => {
    // EMPTY_TREE, not baseTree(): baseTree() writes prxwork/prxids.md itself,
    // so the registry assertion below would pass for the wrong reason.
    withFixture(EMPTY_TREE, (dir) => {
      // Both orders, so neither one can regress on its own.
      for (const args of [[...combo, '--help'], ['--help', ...combo]]) {
        const what = `--help with ${args.join(' ')}`;
        const { status, stdout, stderr } = runGenerator(dir, args);
        assert.strictEqual(status, 0, `${what}: exited ${status}\n${stderr}`);
        assert.strictEqual(stderr, '', `${what}: wrote to stderr:\n${stderr}`);
        assert.ok(
          stdout.startsWith('prx-index.mjs'),
          `${what}: printed something other than help:\n${stdout.slice(0, 80)}`,
        );
        assert.strictEqual(warnLines(stdout).length, 0, `${what}: printed a WARN line`);
        assert.ok(!outLines(stdout).some((l) => l.startsWith('SYNC ')), `${what}: printed a SYNC line`);
        assert.deepStrictEqual(idsEntries(dir), [], `${what}: claimed an id`);
        assert.deepStrictEqual(wsFolders(dir), [], `${what}: created a workstream folder`);
        for (const rel of ['prxwork/prxindex.md', 'prxwork/prxkanban.md', 'prxwork/prxids.md', '.gitignore']) {
          assert.ok(!fs.existsSync(path.join(dir, rel)), `${what}: wrote ${rel}`);
        }
      }
    });
  });
}

// ---- runner ----------------------------------------------------------------

// A fixture tree inside a git repository would be silently redirected by
// resolveProjectRoot, so refuse to run at all in that situation.
function assertTmpdirOutsideRepo() {
  const res = spawnSync('git', ['rev-parse', '--git-common-dir'], { cwd: os.tmpdir(), encoding: 'utf8' });
  if (res.status === 0) {
    console.error(`run-tests: ${os.tmpdir()} sits inside a git repository (${(res.stdout || '').trim()}).`);
    console.error('run-tests: prx-index.mjs would redirect --root away from the fixture. Set TMPDIR elsewhere.');
    process.exit(1);
  }
}

assertTmpdirOutsideRepo();

let failed = 0;
for (const c of cases) {
  try {
    c.fn();
    console.log(`ok   ${c.name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${c.name}`);
    console.log(String(e && e.message ? e.message : e).split('\n').map((l) => `     ${l}`).join('\n'));
  }
}
console.log(`\n${cases.length - failed}/${cases.length} cases passed`);
process.exit(failed ? 1 : 0);
