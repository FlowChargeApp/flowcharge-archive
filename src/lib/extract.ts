// Pure extraction library: reads a project's workstream tree frontmatter and
// returns the PraxisData payload. Which folder that tree lives in, and which
// marker filename names a workstream, are both owned by ./tree-layout.js — this
// file holds neither name as a literal. Knows nothing about argv, stdout, HTTP
// or where the payload ends up — callers decide that.

import fs from 'node:fs';
import path from 'node:path';

import {
  WORKSTREAM_MARKERS,
  isWorkstreamMarker,
  resolveTreeLayout,
} from './tree-layout.js';

// One definition of "frontmatter" for both readers below. Two load-bearing
// facts. First, the pattern carries NO `g` flag, so `match` is not stateful and
// the shared constant cannot develop a `lastIndex` bug between its two callers.
// Second, the `^` anchor plus a slice from the match END is the whole defence
// against a `split('---')` implementation: 19 plan files in the corpus hold body
// lines that start `---`, up to 31 of them in one file, and splitting would
// corrupt every one of them.
const FRONTMATTER = /^---\n([\s\S]*?)\n---/;

export function parseFrontmatter(text: string): Record<string, string | string[]> {
  const m = text.match(FRONTMATTER);
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

// The body of a file, with its frontmatter block removed. Slices from the END of
// the anchored match, so a body line that starts `---` is never a delimiter. A
// file with no frontmatter comes back unchanged, never empty.
export function stripFrontmatter(text: string): string {
  const m = text.match(FRONTMATTER);
  if (!m) return text;
  return text.slice(m[0].length).replace(/^\n+/, '');
}

// Asserts — never coerces. The call sites below already assume these frontmatter
// keys hold scalars; a fallback here would change what lands in the payload.
function fmStr(v: string | string[] | undefined): string { return v as string; }

// The optional final segment of a FlowCharge artefact id: `TYPE-N` became
// `TYPE-N-SUFFIX`, where SUFFIX is exactly six lowercase base-36 characters,
// `[0-9a-z]{6}`. A source fragment rather than a RegExp, because most consumers
// embed it inside a larger pattern. The group MUST stay OPTIONAL: both id shapes
// are live at the same time — this project's own prxwork/ tree holds bare and
// suffixed ids together — so one pattern has to match both. It is also NON-capturing,
// so an id capture that embeds it keeps its own group index.
export const ID_SUFFIX = '(?:-[0-9a-z]{6})?';

// Composed from ID_SUFFIX, exactly as the two issues[] block patterns below are,
// so all three stay identical in shape and the modal and the board's shallow
// issues[] array cannot disagree about what counts as an issue.
// The checkbox mark is capture group 1.
export const ISSUE_ITEM = new RegExp(String.raw`^-\s*\[([ xX])\]\s*(ISS-\d+${ID_SUFFIX})\.\s*(.*)$`);

// The trailing period is OPTIONAL because both forms are in use: parents are
// written `- [x] 1. Phase 1 — …` and children `- [x] 1.1 Capture the …`.
// Capture 1 is the leading whitespace, captured but deliberately unused —
// nesting comes from the number's dot depth, never from indentation.
// The checkbox mark is capture group 2, NOT group 1.
export const TASK_ITEM = /^(\s*)-\s*\[([ xX])\]\s*(\d+(?:\.\d+)*)\.?\s+(.*)$/;

// Composed from ID_SUFFIX and hoisted here so it compiles once, not once per
// call. Anchored at end-of-string, which is what makes the match deterministic —
// without the `$` the pattern can settle on the wrong hyphen. It carries NO `g`
// flag, for the same reason recorded at lines 8-14.
const ID_TAIL = new RegExp(String.raw`-(\d+)${ID_SUFFIX}$`);

// Sort key for an artefact id such as 'IL-84', 'TL-175' or 'TL-175-ab12cd': the
// SEQUENCE NUMBER. The optional six-character suffix is skipped, never read — it
// is random, so reading it would order artefacts arbitrarily. Exported for
// detail.ts, so one rule serves both surfaces. The number alone orders a set of
// ids that ALREADY share a prefix; on the board side, grouping by artefact type
// is what supplies that precondition, because a workstream's artefacts array
// mixes PLN, IL and TL ids. String order would put IL-9 after IL-85, which is
// the defect this exists to avoid. An id that carries no parsable number falls
// back to 0, never NaN, because a NaN sort key makes sort order
// implementation-defined.
export function artefactIdNumber(id: string): number {
  const m = id.match(ID_TAIL);
  const n = m ? Number(m[1]) : NaN;
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
// the issues and the tasks. 'workstream' is deliberately absent: every marker
// filename in WORKSTREAM_MARKERS is skipped inside the walk, so a
// workstream-typed file only reaches the array under some other name, and the
// trailing bucket is where it belongs.
const ARTEFACT_TYPE_RANK: Record<string, number> = { plan: 0, issuelist: 1, tasklist: 2 };
const UNRANKED_TYPE = 3;

function walkWorkstreams(base: string, archived: boolean, issues: PraxisIssue[]): PraxisWorkstream[] {
  const out: PraxisWorkstream[] = [];
  if (!fs.existsSync(base)) return out;
  for (const slug of fs.readdirSync(base)) {
    const dir = path.join(base, slug);
    if (!fs.statSync(dir).isDirectory()) continue;
    // EITHER marker names a workstream, whichever generation the tree folder
    // itself resolved as. A half-renamed tree is a real state — a flowcharge/
    // folder still holding prxworkstream.md — and testing one filename would
    // `continue` past it with no error and no log, which is how such a tree
    // loses its cards silently. The PATH of whichever marker was found is what
    // is kept, because the next line reads that same file.
    const wsFile = WORKSTREAM_MARKERS
      .map((marker) => path.join(dir, marker))
      .find((candidate) => fs.existsSync(candidate));
    if (wsFile === undefined) continue;
    const wsText = fs.readFileSync(wsFile, 'utf8');
    const wsFm = parseFrontmatter(wsText);

    const artefacts = [];
    for (const f of fs.readdirSync(dir)) {
      // BOTH markers are skipped, not just the one this tree resolved as. A
      // marker let through here carries `id` and `type: workstream` in its own
      // frontmatter, so it clears the `fm.id` test below and lands on the card
      // as a phantom artefact row in the UNRANKED_TYPE bucket.
      if (isWorkstreamMarker(f)) continue;
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
        const blocks = text.split(new RegExp(String.raw`\n(?=-\s*\[[ xX]\]\s*ISS-\d+${ID_SUFFIX}\.)`));
        for (const b of blocks) {
          const idm = b.match(new RegExp(String.raw`-\s*\[([ xX])\]\s*(ISS-\d+${ID_SUFFIX})\.\s*(.*)`));
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
      body: stripFrontmatter(wsText).trim(),
      archived,
      artefacts,
      description: typeof wsFm.description === 'string' ? wsFm.description : undefined,
      blocked: typeof wsFm.blocked === 'string' ? wsFm.blocked : undefined,
    });
  }
  return out;
}

export function extractPraxisData(root: string): PraxisData {
  const resolvedRoot = path.resolve(root);
  // Resolved ONCE per call, and the resolved dir is passed down. Resolving
  // inside walkWorkstreams would stat the root twice and could let the
  // workstreams/ and archive/ walks disagree about which tree they are reading.
  const layout = resolveTreeLayout(resolvedRoot);
  if (layout === null) {
    throw new Error(`No flowcharge/ or prxwork/ found under ${resolvedRoot}`);
  }

  const issues: PraxisIssue[] = [];
  const workstreams = [
    ...walkWorkstreams(path.join(layout.dir, 'workstreams'), false, issues),
    ...walkWorkstreams(path.join(layout.dir, 'archive'), true, issues),
  ];

  return {
    generated: new Date().toISOString().slice(0, 10),
    source: resolvedRoot,
    workstreams,
    issues,
  };
}
