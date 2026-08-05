#!/usr/bin/env node
// Dumps a Praxis project's prxwork/ frontmatter to a JSON file on demand — a
// standalone snapshot of the project's state. Source of truth is always the
// frontmatter files themselves — this script never writes back to the project
// it reads.
//
// Usage:
//   npm run refresh -- --root <dir>

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractPraxisData } from '../lib/extract.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface Args { root?: string; out: string; help?: boolean }

function parseArgs(argv: string[]): Args {
  const args: Args = { out: path.join(__dirname, '..', 'public', 'data.json') };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') args.root = argv[++i];
    else if (argv[i] === '--out') args.out = argv[++i];
    else if (argv[i] === '--help' || argv[i] === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`
Praxis Dashboard — standalone data extractor

Writes a project's Praxis state to a JSON file. The dashboard does not read this
file: it extracts each registered project's data live through the server.

  npm run refresh -- --root <project-dir> [--out <file.json>]

  --root   Path to the project containing a prxwork/ folder (required)
  --out    Where to write the JSON payload (default: dist/public/data.json)
`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.root) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  let payload: PraxisData;
  try {
    payload = extractPraxisData(args.root);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
    return;
  }

  const outPath = path.resolve(args.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload));
  console.log(
    `Wrote ${outPath} — ${payload.workstreams.length} workstreams, ${payload.issues.length} issues, from ${payload.source}`
  );
}

main();
