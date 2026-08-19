// Reads the vendored skills/ tree (tools/sync-praxis-skills.mjs's output) and
// returns it as InstallContent. This module knows the on-disk layout of a
// vendored prx-* skill directory and SKILL.md's frontmatter grammar; it knows
// nothing about install targets, tool-specific formats, or install tracking —
// those stay entirely src/lib/agentic-tools-content.ts's concern (and, one
// level up, agentic-tools-install.ts's), reached only through the
// GetInstallContent port shape this module's getInstallContent conforms to.
//
// SkillContent/InstallContent below are local copies of the real interfaces
// agentic-tools-content.ts already defines, kept structurally identical to
// them on purpose: TypeScript's structural typing makes getInstallContent
// assignable to that file's GetInstallContent port with no adapter, as long
// as the shapes stay in sync, without this module importing anything from
// that file's install-target/tracking territory.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface SkillContent {
  id: string; // SKILL.md frontmatter's `name:` value, e.g. 'prx-bug-hunt'
  name: string; // same value as id
  description: string;
  body: string; // SKILL.md content with the frontmatter block stripped
  files?: { relativePath: string; content: string }[]; // forward-slash paths; omitted/[] if none
}

export interface InstallContent {
  version: string; // static literal, informational only
  skills: SkillContent[]; // sorted by id ascending
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// This file compiles to dist/lib/skill-content.js, so two levels up is the
// repo root — same arithmetic as projects.ts's own repoRoot constant.
const repoRoot = path.join(__dirname, '..', '..');

// Same three exclusion rules tools/sync-praxis-skills.mjs applies while
// vendoring, re-applied here as a defensive second pass rather than trusted
// to have already been fully enforced on disk.
function isExcluded(name: string): boolean {
  return name.startsWith('.') || name.startsWith('.git') || name.endsWith('.zip');
}

// One definition of "frontmatter" for this file's own grammar, matching
// extract.ts's FRONTMATTER pattern's anchoring approach: `^` plus a slice
// from the match's END, never a `split('---')`, so a body line that starts
// `---` (several skills' Markdown bodies use `---` as a section rule) is
// never mistaken for a delimiter.
const FRONTMATTER = /^---\n([\s\S]*?)\n---/;

// A block-scalar indicator on the `description:` line: `>`/`>-`/`>+`, the
// folded-scalar forms SKILL.md's frontmatter actually uses (per Open
// Question 1: `|` literal scalars are out of scope, since no source file
// uses one).
const FOLDED_INDICATOR = /^>[0-9]*[+-]?$/;

function unquote(s: string): string {
  return s.replace(/^"(.*)"$/, '$1');
}

// Reads exactly SKILL.md's two-key frontmatter grammar: a same-line `name:`
// scalar, and a `description:` that is either a same-line scalar or a folded
// block scalar (`description: >-` followed by more-indented continuation
// lines). Continuation lines are joined with single spaces, per YAML folding
// rules, and the block ends at the first blank or unindented line — which is
// also where the next top-level key would start, since this grammar's own
// keys are never indented.
function parseFrontmatterFields(fmBlock: string): { name: string; description: string } {
  const lines = fmBlock.split('\n');
  let name = '';
  let description = '';

  for (let i = 0; i < lines.length; i++) {
    const nameMatch = lines[i].match(/^name:\s*(.*)$/);
    if (nameMatch) {
      name = unquote(nameMatch[1].trim());
      continue;
    }

    const descMatch = lines[i].match(/^description:\s*(.*)$/);
    if (!descMatch) continue;

    const rest = descMatch[1].trim();
    if (!FOLDED_INDICATOR.test(rest)) {
      description = unquote(rest);
      continue;
    }

    const parts: string[] = [];
    let j = i + 1;
    while (j < lines.length && /^[ \t]+\S/.test(lines[j])) {
      parts.push(lines[j].trim());
      j++;
    }
    description = parts.join(' ');
    i = j - 1;
  }

  return { name, description };
}

// Splits raw SKILL.md content into its three parts. A file with no
// frontmatter comes back with an empty name/description and its body
// unchanged, never throws.
export function parseSkillFrontmatter(raw: string): { name: string; description: string; body: string } {
  const m = raw.match(FRONTMATTER);
  if (!m) return { name: '', description: '', body: raw };
  const { name, description } = parseFrontmatterFields(m[1]);
  const body = raw.slice(m[0].length).replace(/^\n+/, '');
  return { name, description, body };
}

// Walks everything under `dir` except the skill's own top-level SKILL.md and
// the sync script's exclusion set, collecting forward-slash relativePaths
// relative to `root` (the skill's own directory, not the recursion depth).
function walkFiles(root: string, dir: string, out: { relativePath: string; content: string }[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (isExcluded(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(root, full, out);
      continue;
    }
    if (dir === root && entry.name === 'SKILL.md') continue;
    const relativePath = path.relative(root, full).split(path.sep).join('/');
    out.push({ relativePath, content: fs.readFileSync(full, 'utf8') });
  }
}

// Parses one vendored prx-* directory into a SkillContent. Exported so tests
// can exercise the exclusion rules against a throwaway temp copy without
// mutating the committed skills/ tree.
export function readSkillDirectory(dir: string): SkillContent {
  const raw = fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8');
  const { name, description, body } = parseSkillFrontmatter(raw);

  const files: { relativePath: string; content: string }[] = [];
  walkFiles(dir, dir, files);
  files.sort((a, b) => (a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0));

  const skill: SkillContent = { id: name, name, description, body };
  if (files.length > 0) skill.files = files;
  return skill;
}

// Ignores toolId — every tool gets the same eight-skill InstallContent.
// Reads <repoRoot>/skills/ fresh on every call: no in-memory cache, matching
// this repo's existing "extracted live on request" philosophy.
export async function getInstallContent(_toolId: string): Promise<InstallContent> {
  const skillsDir = path.join(repoRoot, 'skills');
  const skills = fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !isExcluded(entry.name))
    .map((entry) => readSkillDirectory(path.join(skillsDir, entry.name)))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return { version: 'vendored-skills', skills };
}
