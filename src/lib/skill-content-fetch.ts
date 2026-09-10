// Fetches the FlowCharge Core skill suite from the NEWEST PUBLISHED RELEASE
// on the self-hosted Gitea instance and returns it as InstallContent. That
// release is the only content source: there is no branch fallback, and a
// missing release or a release with no .zip asset is a named failure the user
// sees, never a quiet substitution.
//
// This module is the composition point. It owns PRAXIS_REPO_BASE_URL and the
// downloaded zip's whole lifetime: the asset's bytes are written to a
// temporary file, read back from that file, decoded, and the file deleted in
// a finally, so nothing outlives the call. Release API knowledge lives in
// skill-release-fetch.ts and zip container knowledge lives in zip-read.ts;
// this file knows SKILL.md's frontmatter grammar and how to compose the two.
// It knows nothing about install targets, tool-specific formats, or install
// tracking — those stay entirely src/lib/agentic-tools-content.ts's concern
// (and, one level up, agentic-tools-install.ts's).
//
// Every filesystem call goes through the injected ArchiveFsAccess port; no
// filesystem module is imported here at all.
//
// SkillContent/InstallContent below are local copies of the real interfaces
// agentic-tools-content.ts already defines, kept structurally identical to
// them on purpose, without this module importing anything from that file's
// install-target/tracking territory.
//
// No cache: every call re-fetches and re-extracts the archive fresh. That
// Open Question from the plan is settled this way; it is not revisited here.

import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { fetchReleases, buildAssetDownloadUrl } from './skill-release-fetch.js';
import type { SkillReleaseSummary } from './skill-release-fetch.js';
import { parseZip } from './zip-read.js';

// The four FsWriteAccess methods this module needs, mirrored locally rather
// than imported — the same mirror-not-import convention the interfaces below
// follow. Mirroring keeps this fetch module from gaining reach over the
// install registry's whole write surface.
export interface ArchiveFsAccess {
  mkdir(path: string): Promise<void>;
  writeBinaryFileAtomic(path: string, content: Buffer): Promise<void>;
  readBinaryFile(path: string): Promise<Buffer | null>;
  remove(path: string): Promise<void>;
}

export interface SkillContent {
  id: string; // SKILL.md frontmatter's `name:` value, e.g. 'prx-bug-hunt'
  name: string; // same value as id
  description: string;
  body: string; // SKILL.md content with the frontmatter block stripped
  files?: { relativePath: string; content: string }[]; // forward-slash paths; omitted/[] if none
}

export interface InstallContent {
  version: string; // static literal, informational only
  releaseTag?: string; // present only for content sourced from a published release
  skills: SkillContent[]; // sorted by id ascending
}

// Templated so a future host swap (e.g. github.com) is a one-line constant
// change.
export const PRAXIS_REPO_BASE_URL = 'http://100.87.185.97:8110/akoukoullis/Praxis';

// Hard ceiling on the release asset download. The real asset is a zip of a
// skills directory — a few hundred kilobytes, orders of magnitude below this
// limit. It is generous headroom against a hostile or broken response, not a
// tuning value, and it sits well below Node's own maximum buffer length so an
// over-limit response fails with the explicit message below rather than an
// allocation error. The uncompressed side is capped separately, inside
// zip-read.ts, where the decoding actually happens.
const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024; // compressed bytes, as received

// Ceiling on the whole asset download, headers and body. The signal stays
// armed while the body streams, so this budgets the entire transfer rather
// than only the response headers — which is why it is longer than the
// metadata-only call in src/lib/update-check.ts uses.
const DEFAULT_TIMEOUT_MS = 30000;

// Same three exclusion rules applied while vendoring, re-applied here as a
// defensive second pass rather than trusted to have already been fully
// enforced upstream. The segment-shape rules exist for a second reason: these
// segments reach a write sink that joins them onto a base path, so a segment
// that carries its own separators, a drive-relative colon, or an upward
// traversal must never pass, whatever character it happens to start with.
function isExcluded(name: string): boolean {
  if (name.includes('\\') || name.includes('/') || name.includes(':')) return true;
  if (name === '..') return true;
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

// Buffers a response body under a running byte cap. res.arrayBuffer() takes
// whatever the server sends with no limit at all, so the cap has to be
// applied while reading rather than after. Content-Length is consulted first
// for a fast refusal, but it is only a hint — a chunked response carries no
// such header — so the running total over the stream is what actually
// enforces the limit. The reader is cancelled on the over-limit path so the
// connection does not stay open behind the abandoned read.
async function readCappedBody(res: Response, maxBytes: number): Promise<Buffer> {
  const declaredHeader = res.headers.get('content-length');
  if (declaredHeader !== null) {
    const declared = Number(declaredHeader);
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new Error(`FlowCharge Core skill archive exceeds ${maxBytes} bytes (Content-Length ${declared})`);
    }
  }

  const body = res.body;
  if (!body) {
    throw new Error('Failed to fetch FlowCharge Core skill archive: response carried no body');
  }

  const reader = body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error(`FlowCharge Core skill archive exceeds ${maxBytes} bytes`);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, total);
}

// The one composition point that pairs this module's host constant with
// skill-release-fetch.ts's host-agnostic API knowledge. Resolves to [] on
// every unhappy path, exactly as fetchReleases does.
export async function listSkillReleases(): Promise<SkillReleaseSummary[]> {
  return fetchReleases(PRAXIS_REPO_BASE_URL);
}

// Turns decoded zip entries into sorted SkillContent. Entry names in the
// release asset are ALREADY relative to the skills root — 'fc-git/SKILL.md',
// not 'praxis-main/skills/fc-git/SKILL.md' — so segments[0] is the skill id
// and names pass through verbatim. There is no top-level-directory stripping
// and no 'skills/' prefix handling here, and adding either would silently
// drop every skill.
function mapEntriesToSkills(entries: { name: string; content: Buffer }[]): SkillContent[] {
  const skillsById = new Map<string, { skillMdContent?: string; files: { relativePath: string; content: string }[] }>();

  for (const entry of entries) {
    const segments = entry.name.split('/');
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

  return skills;
}

// Ignores toolId — every tool gets the same InstallContent. Fetches fresh on
// every call: no in-memory cache, matching this repo's existing "extracted
// live on request" philosophy.
//
// Five steps, in order: DISCOVER the newest published release, DOWNLOAD its
// .zip asset to a real temporary file, UNZIP the bytes read BACK from that
// file, INSTALL-map the entries, then REMOVE the file. The remove sits in a
// finally around the read-and-decode steps, so a corrupt or truncated zip
// still leaves nothing behind.
export async function getInstallContent(
  _toolId: string,
  deps: { fsWrite: ArchiveFsAccess },
): Promise<InstallContent> {
  try {
    // --- DISCOVER -----------------------------------------------------------
    // The newest entry only. Scanning down the list for a release that happens
    // to carry an asset would itself be a fallback, which is the thing this
    // design removes.
    const releases = await listSkillReleases();
    const latest = releases[0];

    if (!latest) {
      throw new Error(
        `No published FlowCharge Core release found at ${PRAXIS_REPO_BASE_URL}. `
          + 'The release list was empty or could not be read.',
      );
    }

    if (latest.assetName === null) {
      throw new Error(
        `The latest FlowCharge Core release ${latest.tag} carries no .zip asset, `
          + 'so there is nothing to install.',
      );
    }

    // --- DOWNLOAD -----------------------------------------------------------
    const assetUrl = buildAssetDownloadUrl(PRAXIS_REPO_BASE_URL, latest.tag, latest.assetName);
    const res = await fetch(assetUrl, { signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS) });
    if (!res.ok) {
      throw new Error(`Failed to fetch FlowCharge Core skill archive: ${res.status} ${res.statusText}`);
    }
    const downloaded = await readCappedBody(res, MAX_ARCHIVE_BYTES);

    // No network-derived text goes into any path segment — the release tag
    // never appears in the filename.
    const zipDir = path.join(os.tmpdir(), 'flowcharge-skill-install');
    const zipPath = path.join(zipDir, `core-${process.pid}-${randomUUID()}.zip`);
    await deps.fsWrite.mkdir(zipDir);
    await deps.fsWrite.writeBinaryFileAtomic(zipPath, downloaded);

    let skills: SkillContent[];
    try {
      // --- UNZIP ------------------------------------------------------------
      // Decode the buffer READ BACK from disk, never the HTTP response buffer:
      // that substitution is what makes the download step real rather than
      // decorative.
      const readBack = await deps.fsWrite.readBinaryFile(zipPath);
      if (readBack === null) {
        throw new Error(
          `The downloaded FlowCharge Core release zip is missing at ${zipPath}, so the download failed.`,
        );
      }

      // --- INSTALL ----------------------------------------------------------
      skills = mapEntriesToSkills(parseZip(readBack));
    } finally {
      // --- REMOVE -----------------------------------------------------------
      // remove is force:true, so deleting an absent file is not an error and
      // this cleanup never masks the real failure.
      await deps.fsWrite.remove(zipPath);
    }

    return { version: 'fetched-from-git', releaseTag: latest.tag, skills };
  } catch (err) {
    // Nothing is logged here. This module reports no wording of its own, the
    // same rule src/lib/tree-layout.ts, src/lib/workstream-store.ts and
    // src/lib/git.ts state in their own headers. The error is re-thrown
    // untouched and the route boundary that called it owns the one failure
    // report the user reads.
    throw err;
  }
}
