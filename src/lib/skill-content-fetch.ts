// Fetches the Praxis skill suite live from the self-hosted Gitea instance's
// tarball-archive route and returns it as InstallContent. This module knows
// how to download+extract a git-archive tarball and SKILL.md's frontmatter
// grammar; it knows nothing about install targets, tool-specific formats, or
// install tracking — those stay entirely src/lib/agentic-tools-content.ts's
// concern (and, one level up, agentic-tools-install.ts's), reached only
// through the GetInstallContent port shape this module's getInstallContent
// conforms to.
//
// SkillContent/InstallContent below are local copies of the real interfaces
// agentic-tools-content.ts already defines, kept structurally identical to
// them on purpose: TypeScript's structural typing makes getInstallContent
// assignable to that file's GetInstallContent port with no adapter, as long
// as the shapes stay in sync, without this module importing anything from
// that file's install-target/tracking territory.
//
// No cache: every call re-fetches and re-extracts the archive fresh. No
// ref-pinning: PRAXIS_REPO_REF tracks the branch's moving tip. Both Open
// Questions from the plan are settled this way; neither is revisited here.

import { gunzipSync } from 'node:zlib';

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

// Templated so a future host swap (e.g. github.com) is a one-line constant
// change.
export const PRAXIS_REPO_BASE_URL = 'http://100.87.185.97:8110/akoukoullis/Praxis';
export const PRAXIS_REPO_REF = 'master';

export function buildArchiveUrl(baseUrl: string, ref: string): string {
  return `${baseUrl}/archive/${ref}.tar.gz`;
}

// Same three exclusion rules applied while vendoring, re-applied here as a
// defensive second pass rather than trusted to have already been fully
// enforced upstream.
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

export interface TarEntry {
  name: string;
  typeflag: string;
  content: Buffer;
}

// Hand-rolled USTAR reader: walks 512-byte header blocks, reading name
// (bytes 0-100, NUL-padded), typeflag (byte 156), and size (bytes 124-136,
// octal ASCII). Advances the read offset past ceil(size/512)*512 data bytes
// regardless of typeflag — this is what safely skips the archive's leading
// PAX 'g' pax_global_header record that git archive (which Gitea's archive
// route shells out to) always emits before the real entries — and only
// pushes a TarEntry for typeflag '0' (file) or '5' (directory). Stops at the
// first all-zero 512-byte block.
export function parseTar(buf: Buffer): TarEntry[] {
  const entries: TarEntry[] = [];
  let offset = 0;

  while (offset + 512 <= buf.length) {
    const header = buf.subarray(offset, offset + 512);

    if (header.every((b) => b === 0)) break;

    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/s, '');
    const typeflag = header.subarray(156, 157).toString('utf8');
    const sizeField = header.subarray(124, 136).toString('utf8').replace(/\0.*$/s, '').trim();
    const size = sizeField.length > 0 ? parseInt(sizeField, 8) : 0;

    offset += 512;
    const content = buf.subarray(offset, offset + size);

    if (typeflag === '0' || typeflag === '5') {
      entries.push({ name, typeflag, content: Buffer.from(content) });
    }

    offset += Math.ceil(size / 512) * 512;
  }

  return entries;
}

// Ignores toolId — every tool gets the same InstallContent. Fetches the
// archive fresh on every call: no in-memory cache, matching this repo's
// existing "extracted live on request" philosophy, extended here to a live
// network fetch instead of a vendored on-disk tree.
export async function getInstallContent(_toolId: string): Promise<InstallContent> {
  const res = await fetch(buildArchiveUrl(PRAXIS_REPO_BASE_URL, PRAXIS_REPO_REF));
  if (!res.ok) {
    throw new Error(`Failed to fetch Praxis skill archive: ${res.status} ${res.statusText}`);
  }

  const gz = Buffer.from(await res.arrayBuffer());
  const tarBuf = gunzipSync(gz);
  const entries = parseTar(tarBuf);

  const skillsById = new Map<string, { skillMdContent?: string; files: { relativePath: string; content: string }[] }>();

  for (const entry of entries) {
    if (entry.typeflag !== '0') continue; // only files carry content; directory entries are structural only

    // Strip the archive's single top-level directory generically — never
    // hardcode 'praxis' — so a future host swap needs no change here either.
    const stripped = entry.name.split('/').slice(1).join('/');
    if (!stripped.startsWith('skills/')) continue;

    const withinSkills = stripped.slice('skills/'.length);
    const segments = withinSkills.split('/');
    const skillId = segments[0];
    if (!skillId || segments.some((seg) => isExcluded(seg))) continue;

    const rest = segments.slice(1);
    if (rest.length === 0) continue; // the skill directory entry itself

    let record = skillsById.get(skillId);
    if (!record) {
      record = { files: [] };
      skillsById.set(skillId, record);
    }

    const content = entry.content.toString('utf8');
    if (rest.length === 1 && rest[0] === 'SKILL.md') {
      record.skillMdContent = content;
      continue;
    }

    record.files.push({ relativePath: rest.join('/'), content });
  }

  const skills: SkillContent[] = [];
  for (const [id, record] of skillsById) {
    if (!record.skillMdContent) continue;
    const { name, description, body } = parseSkillFrontmatter(record.skillMdContent);
    record.files.sort((a, b) => (a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0));

    const skill: SkillContent = { id, name: name || id, description, body };
    if (record.files.length > 0) skill.files = record.files;
    skills.push(skill);
  }
  skills.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return { version: 'fetched-from-git', skills };
}
