// Ambient global declarations describing the data.json payload the extractor
// writes and the app reads. Shared by both compilations without an import
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
  description?: string;
  blocked?: string;
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
// extractPraxisData() returns and what `npm run refresh` dumps. `name` is the
// project registry's display name, which the extractor knows nothing about.
interface BoardPayload extends PraxisData {
  branch: string | null;
  name: string;
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
  status: string;   // per-item YAML status, '' when the item has no fence
  fields: Record<string, PraxisYamlValue>;   // {} when the item has no yaml fence
}

interface PraxisTaskDetail {
  number: string;   // "1" or "1.1"
  title: string;
  checked: boolean;
  fields: Record<string, PraxisYamlValue>;
  children: PraxisTaskDetail[];              // always present; [] for a leaf
}

// `body` is the plan file's text with its frontmatter block removed. It is raw
// markdown, and nothing on the Node side reads it — the browser owns rendering.
// An ARRAY, not a nullable single object: the detail walk loops on frontmatter
// `type`, not on filename, so a second file declaring `type: plan` would
// otherwise be left at readdir's mercy. The array also makes this the third
// collection of the same shape as the two below.
interface PraxisPlanDetail      { artefact: PraxisDetailArtefact; body: string; }
interface PraxisIssueListDetail { artefact: PraxisDetailArtefact; items: PraxisIssueDetail[]; }
interface PraxisTaskListDetail  { artefact: PraxisDetailArtefact; tasks: PraxisTaskDetail[]; }

interface PraxisWorkstreamDetail {
  id: string;
  slug: string;
  title: string;
  status: string;
  archived: boolean;
  plans: PraxisPlanDetail[];
  issueLists: PraxisIssueListDetail[];
  taskLists: PraxisTaskListDetail[];
}
