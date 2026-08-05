// Ambient global declarations describing the data.json payload the extractor
// writes and the dashboard reads. Shared by both compilations without an import
// on either side — adding a top-level import or export here would turn this file
// into a module and the interfaces would stop being global.

interface PraxisArtefact {
  id: string;
  type: string;
  status: string;
  updated: string;
  total?: number;   // present only for issuelist/tasklist (line 92)
  done?: number;    // ditto (line 93)
}

interface PraxisWorkstream {
  id: string;
  slug: string;
  title: string;
  status: string;
  tags: string[];
  created: string;
  updated: string;
  depends_on: string[];
  body: string;
  archived: boolean;
  artefacts: PraxisArtefact[];
}

interface PraxisIssue {
  id: string;
  title: string;
  checked: boolean;
  severity: string | null;   // line 108
  status: string | null;     // line 109
  workstream: string;
}

interface PraxisData {
  generated: string;
  source: string;
  workstreams: PraxisWorkstream[];
  issues: PraxisIssue[];
}
