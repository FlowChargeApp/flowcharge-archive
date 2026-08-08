// Pure extraction library: reads a Praxis project's prxwork/ frontmatter and
// returns the PraxisData payload. Knows nothing about argv, stdout, HTTP or
// where the payload ends up — callers decide that.

import fs from 'node:fs';
import path from 'node:path';

export function parseFrontmatter(text: string): Record<string, string | string[]> {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const fm: Record<string, string | string[]> = {};
  for (const line of m[1].split('\n')) {
    const mm = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (!mm) continue;
    let val: string | string[] = mm[2].trim();
    if (val.startsWith('[') && val.endsWith(']')) {
      const inner = val.slice(1, -1).trim();
      val = inner ? inner.split(',').map((s) => s.trim()).filter(Boolean) : [];
    } else {
      val = val.replace(/^"(.*)"$/, '$1');
    }
    fm[mm[1]] = val;
  }
  return fm;
}

// Asserts — never coerces. The call sites below already assume these frontmatter
// keys hold scalars; a fallback here would change what lands in the payload.
function fmStr(v: string | string[] | undefined): string { return v as string; }

// Character-identical in shape to the pattern the issues[] block below already
// matches, so the modal and the board's shallow issues[] array cannot disagree
// about what counts as an issue.
// The checkbox mark is capture group 1.
export const ISSUE_ITEM = /^-\s*\[([ xX])\]\s*(ISS-\d+)\.\s*(.*)$/;

// The trailing period is OPTIONAL because both forms are in use: parents are
// written `- [x] 1. Phase 1 — …` and children `- [x] 1.1 Capture the …`.
// Capture 1 is the leading whitespace, captured but deliberately unused —
// nesting comes from the number's dot depth, never from indentation.
// The checkbox mark is capture group 2, NOT group 1.
export const TASK_ITEM = /^(\s*)-\s*\[([ xX])\]\s*(\d+(?:\.\d+)*)\.?\s+(.*)$/;

// Sort key for an artefact id such as 'IL-84' or 'TL-175': the number after the
// final hyphen. Exported for detail.ts, so one rule serves both surfaces. The
// number alone orders a set of ids that ALREADY share a prefix; on the board
// side, grouping by artefact type is what supplies that precondition, because a
// workstream's artefacts array mixes PLN, IL and TL ids. String order would put
// IL-9 after IL-85, which is the defect this exists to avoid. An id that carries
// no parsable number falls back to 0, never NaN, because a NaN sort key makes
// sort order implementation-defined.
export function artefactIdNumber(id: string): number {
  const n = Number(id.slice(id.lastIndexOf('-') + 1));
  return Number.isFinite(n) ? n : 0;
}

// The mark's capture index differs between the two shapes, so it is passed in
// rather than assumed: ISSUE_ITEM holds it in group 1 and TASK_ITEM in group 2.
function countChecks(text: string, itemRe: RegExp, markGroup: number) {
  let total = 0;
  let done = 0;
  for (const line of text.split('\n')) {
    const m = line.match(itemRe);
    if (m) {
      total++;
      if (m[markGroup].toLowerCase() === 'x') done++;
    }
  }
  return { total, done };
}

// Reading order for a card's artefact rows: plan, then issue list, then task
// list. That is the causal chain, and it is deliberately NOT alphabetical —
// neither the labels (IL, PLN, TL) nor the frontmatter keys (issuelist, plan,
// tasklist) sort into that order, and both would put the plan second, between
// the issues and the tasks. 'workstream' is deliberately absent: prxworkstream.md
// is skipped by filename inside the walk, so a workstream-typed file only reaches
// the array under some other name, and the trailing bucket is where it belongs.
const ARTEFACT_TYPE_RANK: Record<string, number> = { plan: 0, issuelist: 1, tasklist: 2 };
const UNRANKED_TYPE = 3;

function walkWorkstreams(base: string, archived: boolean, issues: PraxisIssue[]): PraxisWorkstream[] {
  const out: PraxisWorkstream[] = [];
  if (!fs.existsSync(base)) return out;
  for (const slug of fs.readdirSync(base)) {
    const dir = path.join(base, slug);
    if (!fs.statSync(dir).isDirectory()) continue;
    const wsFile = path.join(dir, 'prxworkstream.md');
    if (!fs.existsSync(wsFile)) continue;
    const wsText = fs.readFileSync(wsFile, 'utf8');
    const wsFm = parseFrontmatter(wsText);
    const parts = wsText.split('---');
    const body = (parts.length >= 3 ? parts.slice(2).join('---') : '').trim();

    const artefacts = [];
    for (const f of fs.readdirSync(dir)) {
      if (f === 'prxworkstream.md') continue;
      const fp = path.join(dir, f);
      if (!fs.statSync(fp).isFile()) continue;
      const text = fs.readFileSync(fp, 'utf8');
      const fm = parseFrontmatter(text);
      if (!fm.id) continue;
      const entry: PraxisArtefact = { id: fmStr(fm.id), type: fmStr(fm.type), status: fmStr(fm.status), updated: fmStr(fm.updated) };
      if (fm.type === 'issuelist' || fm.type === 'tasklist') {
        const c = fm.type === 'issuelist' ? countChecks(text, ISSUE_ITEM, 1) : countChecks(text, TASK_ITEM, 2);
        entry.total = c.total;
        entry.done = c.done;
      }
      artefacts.push(entry);

      if (fm.type === 'issuelist') {
        const blocks = text.split(/\n(?=-\s*\[[ xX]\]\s*ISS-\d+\.)/);
        for (const b of blocks) {
          const idm = b.match(/-\s*\[([ xX])\]\s*(ISS-\d+)\.\s*(.*)/);
          if (!idm) continue;
          const sevm = b.match(/^\s*severity:\s*([a-zA-Z]+)/m);
          const statm = b.match(/^\s*status:\s*([a-zA-Z-]+)/m);
          issues.push({
            id: idm[2],
            title: idm[3].trim(),
            checked: idm[1].toLowerCase() === 'x',
            severity: sevm ? sevm[1].toLowerCase() : null,
            status: statm ? statm[1].toLowerCase() : null,
            workstream: fmStr(wsFm.id),
          });
        }
      }
    }

    // Sorted here, after the loop closes, so the array is complete — sorting
    // inside the loop would re-sort a partial array on every file.
    // The id-string tie-break is what makes this comparator TOTAL, and that is
    // load-bearing rather than tidy: a stable sort only preserves readdirSync
    // order, and this walk never sorts its listing, unlike detail.ts which sorts
    // its listing explicitly. Plain < and > are used, never a locale-aware
    // string comparison, which depends on the runtime's locale and ICU build —
    // the very machine dependence the tie-break exists to remove.
    artefacts.sort((a, b) => {
      const ra = ARTEFACT_TYPE_RANK[a.type] ?? UNRANKED_TYPE;
      const rb = ARTEFACT_TYPE_RANK[b.type] ?? UNRANKED_TYPE;
      if (ra !== rb) return ra - rb;
      const na = artefactIdNumber(a.id);
      const nb = artefactIdNumber(b.id);
      if (na !== nb) return na - nb;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

    out.push({
      id: fmStr(wsFm.id),
      slug,
      title: fmStr(wsFm.title),
      status: fmStr(wsFm.status),
      tags: Array.isArray(wsFm.tags) ? wsFm.tags : (wsFm.tags ? [wsFm.tags] : []),
      created: fmStr(wsFm.created),
      updated: fmStr(wsFm.updated),
      depends_on: Array.isArray(wsFm.depends_on) ? wsFm.depends_on : (wsFm.depends_on ? [wsFm.depends_on] : []),
      body: body.split('\n').filter(Boolean).slice(0, 3).join(' '),
      archived,
      artefacts,
    });
  }
  return out;
}

export function hasPrxwork(root: string): boolean {
  return fs.existsSync(path.join(path.resolve(root), 'prxwork'));
}

export function extractPraxisData(root: string): PraxisData {
  const resolvedRoot = path.resolve(root);
  if (!hasPrxwork(resolvedRoot)) {
    throw new Error(`No prxwork/ found under ${resolvedRoot}`);
  }

  const prxwork = path.join(resolvedRoot, 'prxwork');
  const issues: PraxisIssue[] = [];
  const workstreams = [
    ...walkWorkstreams(path.join(prxwork, 'workstreams'), false, issues),
    ...walkWorkstreams(path.join(prxwork, 'archive'), true, issues),
  ];

  return {
    generated: new Date().toISOString().slice(0, 10),
    source: resolvedRoot,
    workstreams,
    issues,
  };
}
