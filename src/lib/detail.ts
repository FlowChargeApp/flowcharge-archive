// Detail extraction library: reads ONE workstream's artefact files and returns
// the modal's detail-only payload. Deliberately separate from extract.ts's board
// payload — nothing here feeds /api/projects/<id>/data. Knows Praxis markdown
// structure (folder layout, which frontmatter type means what) but nothing about
// HTTP, the project registry or YAML syntax.

import fs from 'node:fs';
import path from 'node:path';
import { ISSUE_ITEM, TASK_ITEM, artefactIdNumber, parseFrontmatter, stripFrontmatter } from './extract.js';
import { parseYamlBlock } from './yaml-block.js';

// A fence opener is matched loosely (trailing whitespace is common); its closer
// must be a bare ``` at the fence's own indentation, or a nested fence inside a
// description string would end the block early. An opener whose closer never
// appears at its own indentation is not treated as a fence at all. The search
// for that closer also stops at a fence OPENER at the same indentation, because
// a well-formed block closes before another block opens beside it.
const FENCE = /^(\s*)```(.*)$/;

interface CollectedItem {
  m: RegExpExecArray;
  fields: Record<string, PraxisYamlValue>;
}

// parseYamlBlock's contract assumes the common leading indentation is already
// gone — that stripping is a markdown-layout concern and therefore lives here.
function stripCommonIndent(lines: string[]): string[] {
  let min = Infinity;
  for (const line of lines) {
    if (!line.trim()) continue;
    min = Math.min(min, /^[ \t]*/.exec(line)![0].length);
  }
  if (!isFinite(min) || min === 0) return lines;
  return lines.map((line) => (line.trim() ? line.slice(min) : line));
}

// Walks a file body once, pairing each item line with the FIRST ```yaml fence
// that follows it before the next item line. Item lines are never looked for
// inside a fence, so a checkbox bullet in an item's own body is not an item.
// An opener whose closer never appears at its own indentation is not treated as
// a fence: the walk resumes on the very next line rather than ending the file,
// and that opener's block attaches no fields, because its extent is unknown.
// That applies to both unterminated shapes — an opener that reaches end of file,
// and an opener met by a later fence opener at its own indentation, which can
// therefore never adopt a closer belonging to a later block.
// Shared by the issue and task paths — if the two ever attach fences
// differently, that is a bug in one of them.
function collectItems(text: string, itemRe: RegExp): CollectedItem[] {
  const lines = text.split('\n');
  const out: CollectedItem[] = [];
  let current: CollectedItem | null = null;
  let attached = false;
  let i = 0;

  while (i < lines.length) {
    const fm = FENCE.exec(lines[i]);
    if (fm) {
      const closer = fm[1] + '```';
      let j = i + 1;
      let unclosed = false;
      while (j < lines.length && lines[j].replace(/\s+$/, '') !== closer) {
        // A fence OPENER at this opener's own indentation ends the search: a
        // well-formed block closes before another block opens beside it. The
        // closer comparison above is evaluated first, so a bare closer written
        // with trailing whitespace can never be mistaken for an opener. The
        // indentation is compared as an exact string, the way `closer` itself is
        // built, so a tab-indented opener never matches a space-indented one.
        const g = FENCE.exec(lines[j]);
        if (g && g[1] === fm[1] && g[2].trim() !== '') {
          unclosed = true;
          break;
        }
        j++;
      }
      // No closer below, or another opener beside it: this opener is not a
      // fence. Step over it as ordinary text so the remaining item lines are
      // still examined, and attach nothing — lines.slice(i + 1, j) is not a
      // block body here.
      if (unclosed || j >= lines.length) {
        i++;
        continue;
      }
      if (fm[2].trim() === 'yaml' && current && !attached) {
        current.fields = parseYamlBlock(stripCommonIndent(lines.slice(i + 1, j)));
        attached = true;
      }
      i = j + 1;
      continue;
    }

    const m = itemRe.exec(lines[i]);
    if (m) {
      current = { m, fields: {} };
      attached = false;
      out.push(current);
    }
    i++;
  }

  return out;
}

// Items only — the file's narrative preamble between frontmatter and the first
// item is deliberately never read (assumption A2).
function parseIssueItems(text: string): PraxisIssueDetail[] {
  return collectItems(text, ISSUE_ITEM).map(function (entry): PraxisIssueDetail {
    return {
      id: entry.m[2],
      title: entry.m[3].trim(),
      checked: entry.m[1].toLowerCase() === 'x',
      fields: entry.fields,
    };
  });
}

// The flat, file-ordered task list. Same collectItems walk as the issues, so
// fence attachment cannot drift between the two paths.
function flatTasks(text: string): PraxisTaskDetail[] {
  return collectItems(text, TASK_ITEM).map(function (entry): PraxisTaskDetail {
    return {
      number: entry.m[3],
      title: entry.m[4].trim(),
      checked: entry.m[2].toLowerCase() === 'x',
      fields: entry.fields,
      children: [],
    };
  });
}

// Two levels, derived from the DOT DEPTH of the number and from nothing else.
// Markdown indentation is presentational and drifts between files; the numbering
// does not, which is why capture 1 of TASK_ITEM is never consulted here.
function buildTaskTree(flat: PraxisTaskDetail[]): PraxisTaskDetail[] {
  const top: PraxisTaskDetail[] = [];
  // Keyed by first segment as a STRING: parseInt('1.10') is 1, so numeric
  // comparison would attach a task 10.1 to task 1. A Map, not an object, so a
  // number can never collide with an inherited property name.
  const recent = new Map<string, PraxisTaskDetail>();

  for (const task of flat) {
    const head = task.number.split('.')[0];
    if (task.number.indexOf('.') === -1) {
      top.push(task);
      // Most recent wins: a file that reopens a number later attaches the
      // following children to the later parent, in file order.
      recent.set(head, task);
      continue;
    }
    // More than one dot is not produced by the prx skills; such a task attaches
    // to its first-segment parent rather than growing a third level.
    const parent = recent.get(head);
    // An orphan is promoted, never dropped — nothing in the flat list may
    // disappear between here and the payload.
    if (parent) parent.children.push(task);
    else top.push(task);
  }

  let total = top.length;
  for (const parent of top) total += parent.children.length;
  if (total !== flat.length) {
    throw new Error('task tree lost ' + (flat.length - total) + ' of ' + flat.length + ' tasks');
  }
  return top;
}

function parseTaskItems(text: string): PraxisTaskDetail[] {
  return buildTaskTree(flatTasks(text));
}

// parseFrontmatter yields string | string[]; every field the detail payload
// carries is a scalar. Narrow locally — extract.ts's own fmStr is not exported
// and must not become exported by this workstream.
function str(v: string | string[] | undefined): string {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.join(', ');
  return '';
}

interface WorkstreamLocation {
  dir: string;
  slug: string;
  archived: boolean;
  fm: Record<string, string | string[]>;
}

// Resolution scans frontmatter ids rather than joining workstreamId into a path:
// the URL segment therefore cannot escape the tree, and folders named by bare
// slug (card-detail-modal-issues-tasks/) resolve identically to folders named in
// the documented <WS-N>-<slug> form (WS-5-cross-platform-adapter-layer/).
function locateWorkstream(base: string, archived: boolean, workstreamId: string): WorkstreamLocation | null {
  if (!fs.existsSync(base)) return null;
  for (const slug of fs.readdirSync(base).sort()) {
    const dir = path.join(base, slug);
    if (!fs.statSync(dir).isDirectory()) continue;
    const wsFile = path.join(dir, 'prxworkstream.md');
    if (!fs.existsSync(wsFile)) continue;
    const fm = parseFrontmatter(fs.readFileSync(wsFile, 'utf8'));
    if (str(fm.id) !== workstreamId) continue;
    return { dir, slug, archived, fm };
  }
  return null;
}

export function extractWorkstreamDetail(root: string, workstreamId: string): PraxisWorkstreamDetail | null {
  const resolvedRoot = path.resolve(root);
  const prxwork = path.join(resolvedRoot, 'prxwork');

  const found =
    locateWorkstream(path.join(prxwork, 'workstreams'), false, workstreamId) ??
    locateWorkstream(path.join(prxwork, 'archive'), true, workstreamId);
  if (!found) return null;

  const plans: PraxisPlanDetail[] = [];
  const issueLists: PraxisIssueListDetail[] = [];
  const taskLists: PraxisTaskListDetail[] = [];

  // readdirSync order is not guaranteed sorted on every platform; sort explicitly
  // so the walk visits the files in the same order everywhere. Display order is
  // set after the walk, by artefact id.
  for (const file of fs.readdirSync(found.dir).sort()) {
    if (file === 'prxworkstream.md') continue;
    const filePath = path.join(found.dir, file);
    if (!fs.statSync(filePath).isFile()) continue;
    const text = fs.readFileSync(filePath, 'utf8');
    const fm = parseFrontmatter(text);

    // Frontmatter `type` is the sole source of truth — same decision
    // walkWorkstreams already makes. Filename is ordering and display only.
    const type = str(fm.type);
    if (type !== 'plan' && type !== 'issuelist' && type !== 'tasklist') continue;

    const artefact: PraxisDetailArtefact = {
      id: str(fm.id),
      file,
      title: str(fm.title),
      status: str(fm.status),
      updated: str(fm.updated),
    };

    // The plan's body crosses the wire raw. Nothing here reads it — the browser
    // owns every decision about how it is rendered.
    if (type === 'plan') plans.push({ artefact, body: stripFrontmatter(text) });
    else if (type === 'issuelist') issueLists.push({ artefact, items: parseIssueItems(text) });
    else taskLists.push({ artefact, tasks: parseTaskItems(text) });
  }

  // The section header prints the artefact id, so the reader sees ids, never
  // filenames. Order each list by its id number, ascending. The two lists stay
  // separate collections feeding two separate tabs.
  plans.sort((a, b) => artefactIdNumber(a.artefact.id) - artefactIdNumber(b.artefact.id));
  issueLists.sort((a, b) => artefactIdNumber(a.artefact.id) - artefactIdNumber(b.artefact.id));
  taskLists.sort((a, b) => artefactIdNumber(a.artefact.id) - artefactIdNumber(b.artefact.id));

  return {
    id: str(found.fm.id),
    slug: found.slug,
    title: str(found.fm.title),
    status: str(found.fm.status),
    archived: found.archived,
    plans,
    issueLists,
    taskLists,
  };
}
