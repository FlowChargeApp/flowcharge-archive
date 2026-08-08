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

// What the board route sends: the extractor's payload plus the fields the server
// adds at the transport layer. PraxisData itself stays exactly what
// extractPraxisData() returns and what `npm run refresh` dumps.
interface BoardPayload extends PraxisData {
  branch: string | null;
}

interface ProjectEntry {
  id: string;     // 8 lowercase hex chars: sha1 of `path`, truncated
  name: string;   // display only, never an identifier: path.basename(path) at add time, then whatever a rename sets
  path: string;   // absolute, path.resolve'd
  added: string;  // YYYY-MM-DD
}

interface ProjectList {
  projects: ProjectEntry[];
}

type PraxisYamlValue = string | PraxisYamlValue[] | { [key: string]: PraxisYamlValue };

interface PraxisDetailArtefact {
  id: string;       // IL-1 / TL-5
  file: string;     // basename, e.g. "prxtasklist-status-colour-fix.md"
  title: string;
  status: string;
  updated: string;
}

interface PraxisIssueDetail {
  id: string;       // ISS-1
  title: string;
  checked: boolean;
  fields: Record<string, PraxisYamlValue>;   // {} when the item has no yaml fence
}

interface PraxisTaskDetail {
  number: string;   // "1" or "1.1"
  title: string;
  checked: boolean;
  fields: Record<string, PraxisYamlValue>;
  children: PraxisTaskDetail[];              // always present; [] for a leaf
}

interface PraxisIssueListDetail { artefact: PraxisDetailArtefact; items: PraxisIssueDetail[]; }
interface PraxisTaskListDetail  { artefact: PraxisDetailArtefact; tasks: PraxisTaskDetail[]; }

interface PraxisWorkstreamDetail {
  id: string;
  slug: string;
  title: string;
  status: string;
  archived: boolean;
  issueLists: PraxisIssueListDetail[];
  taskLists: PraxisTaskListDetail[];
}
