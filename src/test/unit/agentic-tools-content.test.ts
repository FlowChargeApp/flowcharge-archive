// Unit tests for agentic-tools-content.ts's hashInstallContent. Follows
// extract.test.ts's node:test + node:assert/strict pattern.
//
// Run with `node --test dist/test/unit/agentic-tools-content.test.js` after
// `npm run build`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { hashInstallContent } from '../../lib/agentic-tools-content.js';
import type { InstallContent } from '../../lib/agentic-tools-content.js';

const twoSkills: InstallContent = {
  version: '1',
  skills: [
    {
      id: 'prx-alpha',
      name: 'Alpha',
      description: 'Alpha skill',
      body: 'alpha body',
      files: [{ relativePath: 'a.md', content: 'a-content' }],
    },
    {
      id: 'prx-beta',
      name: 'Beta',
      description: 'Beta skill',
      body: 'beta body',
    },
  ],
};

test('hashInstallContent is stable under skills array reordering', () => {
  const reordered: InstallContent = {
    version: '1',
    skills: [twoSkills.skills[1]!, twoSkills.skills[0]!],
  };
  assert.equal(hashInstallContent(twoSkills), hashInstallContent(reordered));
});

test('hashInstallContent is stable under per-skill key reordering', () => {
  const keyReordered: InstallContent = {
    version: '1',
    skills: [
      {
        body: 'alpha body',
        id: 'prx-alpha',
        files: [{ content: 'a-content', relativePath: 'a.md' }],
        description: 'Alpha skill',
        name: 'Alpha',
      },
      twoSkills.skills[1]!,
    ],
  };
  assert.equal(hashInstallContent(twoSkills), hashInstallContent(keyReordered));
});

test('hashInstallContent changes when a skill body changes', () => {
  const changed: InstallContent = {
    version: '1',
    skills: [
      { ...twoSkills.skills[0]!, body: 'alpha body CHANGED' },
      twoSkills.skills[1]!,
    ],
  };
  assert.notEqual(hashInstallContent(twoSkills), hashInstallContent(changed));
});
