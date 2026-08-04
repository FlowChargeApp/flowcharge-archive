#!/usr/bin/env node
// Reads a Praxis project's prxwork/ frontmatter and writes public/data.json
// for the dashboard to fetch. Source of truth is always the frontmatter files
// themselves — this script never writes back to the project it reads.
//
// Usage:
//   node scripts/extract-praxis-data.mjs --root /path/to/project [--out public/data.json]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = { out: path.join(__dirname, '..', 'public', 'data.json') };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') args.root = argv[++i];
    else if (argv[i] === '--out') args.out = argv[++i];
    else if (argv[i] === '--help' || argv[i] === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`
Praxis Dashboard — data extractor

  node scripts/extract-praxis-data.mjs --root <project-dir> [--out <file.json>]

  --root   Path to the project containing a prxwork/ folder (required)
  --out    Where to write the JSON payload (default: public/data.json)
`);
}

function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split('\n')) {
    const mm = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (!mm) continue;
    let val = mm[2].trim();
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

function countChecks(text) {
  let total = 0;
  let done = 0;
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*-\s*\[( |x|X)\]/);
    if (m) {
      total++;
      if (m[1].toLowerCase() === 'x') done++;
    }
  }
  return { total, done };
}

function walkWorkstreams(base, archived) {
  const out = [];
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
      const entry = { id: fm.id, type: fm.type, status: fm.status, updated: fm.updated };
      if (fm.type === 'issuelist' || fm.type === 'tasklist') {
        const c = countChecks(text);
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
          issuesAccumulator.push({
            id: idm[2],
            title: idm[3].trim(),
            checked: idm[1].toLowerCase() === 'x',
            severity: sevm ? sevm[1].toLowerCase() : null,
            status: statm ? statm[1].toLowerCase() : null,
            workstream: wsFm.id,
          });
        }
      }
    }

    out.push({
      id: wsFm.id,
      slug,
      title: wsFm.title,
      status: wsFm.status,
      tags: Array.isArray(wsFm.tags) ? wsFm.tags : (wsFm.tags ? [wsFm.tags] : []),
      created: wsFm.created,
      updated: wsFm.updated,
      depends_on: Array.isArray(wsFm.depends_on) ? wsFm.depends_on : (wsFm.depends_on ? [wsFm.depends_on] : []),
      body: body.split('\n').filter(Boolean).slice(0, 3).join(' '),
      archived,
      artefacts,
    });
  }
  return out;
}

let issuesAccumulator = [];

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.root) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  const root = path.resolve(args.root);
  const prxwork = path.join(root, 'prxwork');
  if (!fs.existsSync(prxwork)) {
    console.error(`No prxwork/ found under ${root}`);
    process.exit(1);
  }

  issuesAccumulator = [];
  const workstreams = [
    ...walkWorkstreams(path.join(prxwork, 'workstreams'), false),
    ...walkWorkstreams(path.join(prxwork, 'archive'), true),
  ];

  const payload = {
    generated: new Date().toISOString().slice(0, 10),
    source: root,
    workstreams,
    issues: issuesAccumulator,
  };

  const outPath = path.resolve(args.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload));
  console.log(
    `Wrote ${outPath} — ${workstreams.length} workstreams, ${issuesAccumulator.length} issues, from ${root}`
  );
}

main();
