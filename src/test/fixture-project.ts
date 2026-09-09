// Shared fixture builder for the extract.ts and detail.ts test suites: writes a
// one-workstream project tree in either name generation, runs a callback against
// its root, and removes it again.
//
// It lives in its OWN module rather than in extract.test.ts because importing
// one test file from another registers the imported file's tests a second time,
// in the importing file's process — `node --test dist/lib/detail.test.js
// dist/lib/extract.test.js` then reports every extract case twice. This file
// carries no `.test.` in its name and declares no test, so both suites can
// import it and neither grows the other's cases.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const WORKSTREAM_FILE = `---
id: WS-1-aa11bb
type: workstream
slug: fixture
title: "Fixture workstream"
status: in-progress
created: 2026-01-01
updated: 2026-01-01
tags: []
depends_on: []
---

# Fixture
`;

const ISSUELIST_FILE = `---
id: IL-1-cc22dd
type: issuelist
workstream: WS-1-aa11bb
slug: fixture
title: "Fixture issues"
status: in-progress
created: 2026-01-01
updated: 2026-01-01
depends_on: []
links: []
---

# PRX Issue List

- [x] ISS-2. Unsuffixed issue title

  \`\`\`yaml
  id: ISS-2
  status: done
  severity: medium
  \`\`\`

- [ ] ISS-18-awinon. Suffixed issue title

  \`\`\`yaml
  id: ISS-18-awinon
  status: open
  severity: high
  \`\`\`
`;

// The three filesystem names a fixture tree needs, per generation. They live in
// this table rather than inside the helper, so the helper body derives every
// name from its argument and holds no literal of its own. Only these three
// names changed upstream — `workstreams/` and the slug folder are the same in
// both generations.
export const FIXTURE_GENERATIONS = ['flowcharge', 'prxwork'] as const;
export type FixtureGeneration = (typeof FIXTURE_GENERATIONS)[number];

export interface FixtureNames {
  tree: string;
  marker: string;
  artefact: string;
}

const GENERATION_NAMES: Record<FixtureGeneration, FixtureNames> = {
  flowcharge: { tree: 'flowcharge', marker: 'workstream.md', artefact: 'IL-1-cc22dd-issuelist.md' },
  prxwork: { tree: 'prxwork', marker: 'prxworkstream.md', artefact: 'prxissuelist.md' },
};

// Builds a one-workstream fixture project and runs `run` against its root.
// SHARED by both test suites — a copied fixture drifts, and then the two
// surfaces disagree about what a tree looks like. `generation` picks the name
// set; `overrides` mixes them, which is how the half-renamed-tree cases are
// built.
export function withFixtureProject(
  run: (root: string) => void,
  generation: FixtureGeneration = 'flowcharge',
  overrides: Partial<FixtureNames> = {},
): void {
  const names = { ...GENERATION_NAMES[generation], ...overrides };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'praxis-extract-test-'));
  try {
    const dir = path.join(root, names.tree, 'workstreams', 'WS-1-aa11bb-fixture');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, names.marker), WORKSTREAM_FILE);
    fs.writeFileSync(path.join(dir, names.artefact), ISSUELIST_FILE);
    run(root);
  } finally {
    // Removed even when an assertion throws, so a failing run leaves no tree behind.
    fs.rmSync(root, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// The BOARD fixture builder.
//
// BoardFixtureOptions and withBoardFixtureProject below serve the board and
// detail HTTP suites — src/server-board.test.ts drives a whole board payload
// and a whole workstream detail payload against the tree they write, so that
// tree has to be rich enough to make artefact ORDER, the total and done
// COUNTERS, the aggregated issues[] and the archived flag all observable.
//
// withFixtureProject above stays the SINGLE-workstream builder that the
// extract and detail unit suites use. The two builders are deliberately kept
// apart: widening the small one would rewrite the expectations of
// src/lib/extract.test.ts and src/lib/detail.test.ts for no gain, and this
// module's whole reason to exist is that a shared fixture must not drift.
//
// Like withFixtureProject, this builder derives both the tree folder name and
// the marker filename from GENERATION_NAMES, so one definition serves both
// name generations and the body below holds no generation name of its own.
// ---------------------------------------------------------------------------

// The populated workstream. Its frontmatter carries a DISTINCT value in every
// field the board payload exposes, so a field that is dropped, swapped or
// defaulted on the way out is visible in an assertion. The body is
// multi-paragraph on purpose: a body reader that stops at the first blank line
// fails against it.
const BOARD_WORKSTREAM_FILE = `---
id: WS-40-brd001
type: workstream
slug: board-fixture
title: "Board fixture workstream"
status: in-progress
created: 2026-02-01
updated: 2026-02-02
tags: [board, fixture]
depends_on: [WS-41-brd002]
---

# Board fixture

The first paragraph of the body, which the board payload carries verbatim.

The second paragraph, so a body that keeps only its first paragraph is
detectable.
`;

// The three artefact ids are numbered AGAINST their reading order — the plan is
// 30, the issue list 20 and the task list 10 — so a walk that orders artefacts
// by id number alone, instead of by type rank first, comes back exactly
// reversed and the ordering assertion fails loudly.
const BOARD_PLAN_FILE = `---
id: PLN-30-p1a2n3
type: plan
workstream: WS-40-brd001
slug: board-fixture
title: "Board fixture plan"
status: done
created: 2026-02-01
updated: 2026-02-02
---

# Board fixture plan

One plan paragraph. The detail route carries this text as the plan body.
`;

// One unsuffixed id and one suffixed one, one checked and one unchecked, each
// with its own severity and status in a yaml fence. Two items, one of them
// done, so the counters here (2 and 1) differ from the task list's (3 and 2)
// and a swapped pair of counters cannot pass.
const BOARD_ISSUELIST_FILE = `---
id: IL-20-i1s2s3
type: issuelist
workstream: WS-40-brd001
slug: board-fixture
title: "Board fixture issues"
status: in-progress
created: 2026-02-01
updated: 2026-02-02
---

# FlowCharge Issue List

- [x] ISS-50. Unsuffixed board issue

  \`\`\`yaml
  id: ISS-50
  status: done
  severity: high
  \`\`\`

- [ ] ISS-51-iss001. Suffixed board issue

  \`\`\`yaml
  id: ISS-51-iss001
  status: open
  severity: low
  \`\`\`
`;

// One parent and two children, two of the three checked. The nesting makes the
// detail payload's task tree observable, and the counters (3 and 2) differ from
// the issue list's.
const BOARD_TASKLIST_FILE = `---
id: TL-10-t1a2s3
type: tasklist
workstream: WS-40-brd001
slug: board-fixture
title: "Board fixture tasks"
status: in-progress
created: 2026-02-01
updated: 2026-02-02
---

# FlowCharge Tasks

- [x] 1. The parent task

  \`\`\`yaml
  description: "Parent task fence"
  \`\`\`

  - [x] 1.1 The first child task

    \`\`\`yaml
    description: "First child fence"
    \`\`\`

  - [ ] 1.2 The second child task
`;

// A workstream folder holding its marker and nothing else, so an EMPTY
// artefacts array is covered beside the populated one.
const BOARD_EMPTY_WORKSTREAM_FILE = `---
id: WS-41-brd002
type: workstream
slug: board-fixture-empty
title: "Board fixture workstream with no artefacts"
status: ready
created: 2026-02-01
updated: 2026-02-01
tags: []
depends_on: []
---

# No artefacts

This workstream holds its marker file and nothing else.
`;

// Written under archive/ rather than workstreams/, which is the only thing that
// sets archived: true in the payload.
const BOARD_ARCHIVED_WORKSTREAM_FILE = `---
id: WS-42-brd003
type: workstream
slug: board-fixture-archived
title: "Board fixture archived workstream"
status: done
created: 2026-01-01
updated: 2026-01-15
tags: [archived]
depends_on: []
---

# Archived board fixture

This workstream lives under archive/, so the payload marks it archived.
`;

export interface BoardFixtureOptions {
  // Which name generation to write. Defaults to the FIRST entry of
  // FIXTURE_GENERATIONS — read from the table rather than written out, so this
  // body holds no generation name.
  generation?: FixtureGeneration;
  // When a string, a .git/HEAD naming that branch is written at the project
  // root, so the board payload's `branch` field is observable as something
  // other than null. Defaults to null, which leaves no .git directory at all.
  branch?: string | null;
}

// Builds a realistic multi-workstream fixture project, awaits `run` against its
// root, and removes the whole tree again. The callback is awaited, so an HTTP
// suite can drive requests against the tree while it still exists.
export async function withBoardFixtureProject(
  run: (root: string) => Promise<void>,
  options: BoardFixtureOptions = {},
): Promise<void> {
  const names = GENERATION_NAMES[options.generation ?? FIXTURE_GENERATIONS[0]];
  const branch = options.branch ?? null;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'praxis-board-test-'));
  try {
    const tree = path.join(root, names.tree);

    const populated = path.join(tree, 'workstreams', 'WS-40-brd001-board-fixture');
    fs.mkdirSync(populated, { recursive: true });
    fs.writeFileSync(path.join(populated, names.marker), BOARD_WORKSTREAM_FILE);
    fs.writeFileSync(path.join(populated, 'PLN-30-p1a2n3-plan.md'), BOARD_PLAN_FILE);
    fs.writeFileSync(path.join(populated, 'IL-20-i1s2s3-issuelist.md'), BOARD_ISSUELIST_FILE);
    fs.writeFileSync(path.join(populated, 'TL-10-t1a2s3-tasklist.md'), BOARD_TASKLIST_FILE);

    const bare = path.join(tree, 'workstreams', 'WS-41-brd002-board-fixture-empty');
    fs.mkdirSync(bare, { recursive: true });
    fs.writeFileSync(path.join(bare, names.marker), BOARD_EMPTY_WORKSTREAM_FILE);

    const archived = path.join(tree, 'archive', 'WS-42-brd003-board-fixture-archived');
    fs.mkdirSync(archived, { recursive: true });
    fs.writeFileSync(path.join(archived, names.marker), BOARD_ARCHIVED_WORKSTREAM_FILE);

    if (typeof branch === 'string') {
      const gitDir = path.join(root, '.git');
      fs.mkdirSync(gitDir, { recursive: true });
      fs.writeFileSync(path.join(gitDir, 'HEAD'), `ref: refs/heads/${branch}\n`);
    }

    await run(root);
  } finally {
    // Removed even when the callback rejects, so a failing assertion leaves no
    // tree behind. `force` also covers the 410 case, whose callback removes the
    // root itself before this runs.
    fs.rmSync(root, { recursive: true, force: true });
  }
}
