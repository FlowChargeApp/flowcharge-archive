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
