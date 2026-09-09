// Adapter for the WorkstreamStore port over the markdown tree on disk. It
// delegates to the four libraries that already do the work — the layout
// resolver, the board extractor, the detail extractor and the branch reader —
// and adds nothing of its own: no parsing, no caching, no logging.
//
// It knows the filesystem and those four libraries. It does not know the
// project list, the transport layer or the packaged binary. It returns facts and
// logs nothing, so the caller decides what a legacy resolution should print.

import { resolveTreeLayout, hasWorkstreamTree } from './tree-layout.js';
import { extractPraxisData } from './extract.js';
import { extractWorkstreamDetail } from './detail.js';
import { readBranch } from './git.js';
import type { WorkstreamStore } from '../ports/workstream-store.js';

export function createMarkdownWorkstreamStore(): WorkstreamStore {
  return {
    resolveLayout: resolveTreeLayout,
    hasTree: hasWorkstreamTree,
    readBoard: extractPraxisData,
    readDetail: extractWorkstreamDetail,
    readBranch,
  };
}
