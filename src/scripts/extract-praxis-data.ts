#!/usr/bin/env node
// Dumps a project's flowcharge/ frontmatter to a JSON file on demand — a
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
import { resolveTreeLayout } from '../lib/tree-layout.js';

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
FlowCharge — standalone data extractor

Writes a project's FlowCharge state to a JSON file. The app does not read this
file: it extracts each registered project's data live through the server.

  npm run refresh -- --root <project-dir> [--out <file.json>]

  --root   Path to the project containing a flowcharge/ folder (required)
  --out    Where to write the JSON payload (default: dist/public/data.json)
`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.root) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  // The same fixed, greppable line src/server.ts prints, byte for byte, so one
  // grep finds both entry points. It goes to console.warn rather than
  // console.log so a caller piping stdout to a file still sees it.
  const layout = resolveTreeLayout(args.root);
  if (layout !== null && layout.legacy) {
    console.warn(
      `LEGACY LAYOUT: ${layout.dir} uses prxwork/ — rename it to flowcharge/; ` +
      `support for the old name will be removed`
    );
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
