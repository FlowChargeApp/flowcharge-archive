---
id: TL-5-g4wjoi
type: tasklist
workstream: WS-3-9gbugs
slug: multi-project-home-page
title: "Multi-project home page with project tiles"
status: done
created: 2026-08-05
updated: 2026-08-06
depends_on: [PLN-4-eppxms]
links: []
mode: spec
base_commit: 67fd39c
---

# PRX Tasks

## Multi-project home page with project tiles

Implements PLN-4. The dashboard is single-project today because of exactly two hardcoded
facts: `src/public/app.ts:21` fetches `./data.json`, and `src/server.ts` is a pure static file
server with no route table. This list makes three structural moves in five strictly ordered
phases, each of which ends with `npm start` serving a working application.

1. **Split the extractor into a pure library and a thin CLI** — `src/lib/extract.ts` exports
   `extractPraxisData(root)` and `hasPrxwork(root)` with no `process`, no `console`, and no
   module-level mutable state; `src/scripts/extract-praxis-data.ts` keeps `parseArgs`, `usage`
   and `main()`. Proven by a byte-parity diff against the pre-refactor output.
2. **Add three `/api/` routes to `src/server.ts`**, before the existing static fallthrough, in
   Node's `http` with zero new dependencies. Registered projects persist in a gitignored
   `.praxis-projects.json` at the repo root. Board data comes from
   `GET /api/projects/<id>/data`, which runs the extractor on demand.
3. **Split the page in two** — `src/public/index.html` becomes the home page (project tiles plus
   an add-project form, driven by a new `home.ts`); the current board markup moves verbatim to
   `src/public/board.html`, reached at `/board.html?project=<id>`. Navigation is plain anchors,
   so the browser back button, deep links, bookmarks and cmd-click all work with no router.

**Two properties that must survive every task in this list:**

1. The board's rendering logic — `boot` and the four renderers in `src/public/app.ts` — is NOT
   modified beyond its data source and the load-failure panel text. The two-document navigation
   design exists specifically so this 333-line, WS-1-verified file needs no idempotency or
   listener-rebinding surgery. Any change to `app.ts` beyond what task 4.1 specifies is out of
   scope.
2. Every `/api/` branch in `src/server.ts` is wrapped in `try/catch` → 500 + `console.error`. An
   uncaught throw inside an `http.createServer` handler takes the whole process down. A task
   that omits it is incomplete.

Out of scope throughout, per the plan: any UI framework, bundler or runtime dependency;
authentication; removing or deprecating the `npm run refresh` CLI; path sanitising beyond
`path.isAbsolute` plus the `flowcharge/` existence check; `~` expansion; caching extraction
results; a project-removal UI; per-tile summary figures; any change to the board's DOM, sort
or filter behaviour or the `PraxisData` payload shape; and a test framework, linter or
formatter.

- [x] 1. Phase 1 — Split the extractor into a library and a CLI

  ```yaml
  description: "Move the parsing functions out of src/scripts/extract-praxis-data.ts into a pure, importable src/lib/extract.ts, thread the issues accumulator as a parameter, and reduce the CLI to argv/exit/file-write. No user-visible change; byte parity is the proof."
  ```

  - [x] 1.1 Capture the pre-refactor byte-parity baseline
    ```yaml
    description: "Run the current, unmodified extractor against a known root and keep the output at /tmp/before.json. It cannot be regenerated once Phase 1 lands."
    issues: []
    implement:
      - "MUST run before any file in Phase 1 is edited. Do not start task 1.2 until /tmp/before.json exists."
      - "From the repo root, run: npm run refresh -- --root /Users/akoukoullis/Work/AK/Praxis-Dashboard --out /tmp/before.json"
      - "Record the exact --root value used in the task result — task 1.5's byte-parity diff must use the identical directory, or the comparison proves nothing."
      - "Do not delete /tmp/before.json until task 1.5 has completed its diff."
    pattern: "No source files. Produces /tmp/before.json only."
    imports: "The existing dist/scripts/extract-praxis-data.js, built by the prerefresh hook."
    compatibility: "The payload's `generated` field is new Date().toISOString().slice(0,10) — a date, not a timestamp — so before.json and after.json stay comparable across a same-day run. If the refactor spans midnight the diff will show a one-line `generated` difference; re-capture the baseline rather than accepting it."
    gotcha: "npm run refresh has a prerefresh hook that runs npm run build first — the baseline is therefore taken from freshly compiled current source, which is what is wanted. Do not hand-run node dist/... against a stale dist/."
    verify:
      - "test -s /tmp/before.json && echo baseline-captured"
      - "node -e \"const d=require('/tmp/before.json'); console.log(d.source, d.workstreams.length, d.issues.length)\" — note these three values in the task result for cross-checking in tasks 1.5 and 2.5."
    checklist:
      - "Was /tmp/before.json written before any Phase 1 source edit?"
      - "Is the file non-empty and valid JSON?"
      - "Is the --root directory recorded in the task result verbatim?"
      - "Was the baseline produced by npm run refresh (so the build ran) rather than a stale dist/ artefact?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.2 Create `src/lib/extract.ts` — the pure extraction library
    ```yaml
    description: "New file holding parseFrontmatter, fmStr, countChecks and walkWorkstreams moved verbatim from the CLI, plus hasPrxwork and the exported extractPraxisData. No process, no console, no module-level mutable state."
    issues: []
    implement:
      - "Create src/lib/extract.ts. Move parseFrontmatter (currently lines 38-55), fmStr (57-59), countChecks (61-72) and walkWorkstreams (74-137) out of src/scripts/extract-praxis-data.ts VERBATIM — same regexes, same field order, same comments. Byte parity in task 1.5 depends on nothing changing in these bodies."
      - "Change walkWorkstreams's signature to walkWorkstreams(base: string, archived: boolean, issues: PraxisIssue[]) and replace the `issuesAccumulator.push({...})` call inside its issuelist branch with `issues.push({...})`. Delete the module-level `let issuesAccumulator: PraxisIssue[] = [];` (currently line 139) — it does not move to the library."
      - "Export exactly these two functions, with these signatures, and no others:"
      - |
        export function hasPrxwork(root: string): boolean;          // fs.existsSync(resolve(root)/flowcharge)
        export function extractPraxisData(root: string): PraxisData; // throws on unreadable tree
      - "hasPrxwork(root) resolves root and returns fs.existsSync(path.join(resolvedRoot, 'flowcharge'))."
      - "extractPraxisData(root): resolve root; if hasPrxwork is false throw new Error('No flowcharge/ found under ' + root) — where the message uses the RESOLVED root, matching the CLI's current `No flowcharge/ found under ${root}` after path.resolve at line 148; create a FRESH `const issues: PraxisIssue[] = []` per call; run walkWorkstreams(path.join(flowcharge,'workstreams'), false, issues) then walkWorkstreams(path.join(flowcharge,'archive'), true, issues) concatenated in that order; return { generated: new Date().toISOString().slice(0,10), source: root, workstreams, issues } with the keys in that exact order."
      - "The fresh-array-per-call is what makes acceptance criterion 15 true by construction rather than by remembering to reset."
      - "This file must NOT reference process.argv, process.exit, console, HTTP, or where the payload ends up. It performs no file I/O beyond reading."
      - "Keep the `// Asserts — never coerces.` comment above fmStr — WS-1's assert-don't-coerce rule is what that comment records."
    pattern: "src/lib/extract.ts (new). Source material: src/scripts/extract-praxis-data.ts lines 38-139."
    imports: "node:fs and node:path only. PraxisWorkstream, PraxisArtefact, PraxisIssue and PraxisData come from the ambient src/types/praxis-data.d.ts — they are global interfaces, so do NOT import them and do NOT redeclare them."
    compatibility: "Root tsconfig is module/moduleResolution node16 with package.json `\"type\": \"module\"`, so this compiles to ESM at dist/lib/extract.js. strict + noEmitOnError are on. rootDir is `src`, outDir `dist`, so the file lands at dist/lib/extract.js — which is what task 1.3's `../lib/extract.js` specifier and Phase 2's server import both assume."
    gotcha: "Under node16 resolution an importer must write the `.js` extension; that affects the importers, not this file. `fmStr` returns `v as string` deliberately — do not add a fallback while moving it, it would change what lands in the payload. The archive walk must run second: swapping the two walks reorders both `workstreams` and `issues` and breaks byte parity. The payload key order matters for byte parity because JSON.stringify emits insertion order."
    verify:
      - "npm run build — compiles clean with no emit errors."
      - "grep -n 'process\\.\\|console\\.' src/lib/extract.ts — returns nothing."
      - "grep -nE '^(import|export)' src/lib/extract.ts — shows only the two node: imports and the two named function exports."
      - "grep -n 'issuesAccumulator' src/lib/extract.ts — returns nothing."
    checklist:
      - "Do the four moved function bodies match the originals character-for-character apart from walkWorkstreams's new third parameter and its issues.push call?"
      - "Is the module-level issuesAccumulator absent from src/lib/extract.ts?"
      - "Does extractPraxisData allocate a new issues array on every call?"
      - "Are the two exported signatures exactly hasPrxwork(root: string): boolean and extractPraxisData(root: string): PraxisData?"
      - "Does grep confirm zero references to process. and console. in the file?"
      - "Are the PraxisData keys emitted in the order generated, source, workstreams, issues?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.3 Reduce `src/scripts/extract-praxis-data.ts` to a thin CLI wrapper
    ```yaml
    description: "Strip the moved parsing functions out of the CLI, import from ../lib/extract.js, and keep parseArgs, usage and main() with identical argv semantics, exit codes, stderr message, output path and success log line."
    issues: []
    implement:
      - "In src/scripts/extract-praxis-data.ts delete lines 38-139 — parseFrontmatter, fmStr, countChecks, walkWorkstreams and `let issuesAccumulator` — all of which now live in src/lib/extract.ts."
      - "Add `import { extractPraxisData } from '../lib/extract.js';` alongside the existing node: imports. The `.js` extension is mandatory under node16 resolution."
      - "Leave parseArgs (17-25) and usage (27-36) exactly as they are, including the default `--out` expression path.join(__dirname, '..', 'public', 'data.json') at line 18 and the __dirname derivation at line 13. Task 5.2 revises the header comment and usage() text — do not pre-empt it here."
      - "Rewrite main() to: parse argv; on args.help || !args.root call usage() and process.exit(args.help ? 0 : 1) exactly as today; then `let payload: PraxisData;` and `try { payload = extractPraxisData(args.root); } catch (err) { console.error((err as Error).message); process.exit(1); }` — the caught message is the library's `No flowcharge/ found under <resolved root>`, which is byte-identical to today's stderr line."
      - "Keep the tail of main() unchanged: const outPath = path.resolve(args.out); fs.mkdirSync(path.dirname(outPath), { recursive: true }); fs.writeFileSync(outPath, JSON.stringify(payload)); and the same success log line, now reading its counts off the returned payload — `Wrote ${outPath} — ${payload.workstreams.length} workstreams, ${payload.issues.length} issues, from ${payload.source}`. The rendered text must be identical to today's."
      - "Keep the trailing bare `main();` call and the #!/usr/bin/env node shebang."
      - "Do not remove the CLI's standalone usability — --root, --out, --help/-h semantics and exit codes 0/1 are unchanged. That is an explicit plan exclusion."
    pattern: "src/scripts/extract-praxis-data.ts"
    imports: "node:fs, node:path, node:url (all already present) plus { extractPraxisData } from '../lib/extract.js'. hasPrxwork is NOT needed here — the library's own throw covers the CLI's missing-flowcharge path."
    compatibility: "Exit codes must stay 0 on success and on --help, 1 on missing --root and on a --root with no flowcharge/. The success log line's wording, spacing and em dash must not change. `npm run refresh` with no --out must still write dist/public/data.json."
    gotcha: "TypeScript's control-flow analysis does not know process.exit never returns, so a `let payload: PraxisData;` assigned only inside try will be reported as used-before-assigned after the catch. Either assign inside the try and `return`/`process.exit` in the catch with an explicit `process.exit(1); return;`, or type the catch branch so tsc sees the narrowing — resolve it in whichever way keeps strict happy without changing observable behaviour. The file ends up around 40 lines; if it is much longer something was not moved."
    verify:
      - "npm run build — compiles clean."
      - "npm run refresh -- --help; echo $? — prints usage, exits 0."
      - "npm run refresh; echo $? — no --root, prints usage, exits 1."
      - "npm run refresh -- --root /tmp; echo $? — prints exactly `No flowcharge/ found under /tmp` on stderr, exits 1."
      - "wc -l src/scripts/extract-praxis-data.ts — roughly 40 lines."
    checklist:
      - "Are parseFrontmatter, fmStr, countChecks, walkWorkstreams and issuesAccumulator all gone from the CLI file?"
      - "Does the import specifier carry the .js extension?"
      - "Is the default --out expression at line 18 untouched?"
      - "Do --help, missing --root and no-flowcharge still produce exit codes 0, 1, 1 respectively?"
      - "Is the success log line's rendered text identical to the pre-refactor wording?"
      - "Are the shebang and the bare main() call still present?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.4 Add `src/lib/**/*.ts` to the root tsconfig include
    ```yaml
    description: "Make the new library an explicit member of the Node-side compilation rather than something tsc only picks up transitively through an import."
    issues: []
    implement:
      - "Apply this block to tsconfig.json:"
      - |
        tsconfig.json
        <<<<<<< SEARCH
          "include": ["src/server.ts", "src/scripts/**/*.ts", "src/types/**/*.d.ts"]
        =======
          "include": ["src/server.ts", "src/lib/**/*.ts", "src/scripts/**/*.ts", "src/types/**/*.d.ts"]
        >>>>>>> REPLACE
      - "No other key in tsconfig.json changes — rootDir stays `src`, outDir stays `dist`."
    pattern: "tsconfig.json"
    imports: "None."
    compatibility: "The include array is the only line touched; the inline comment on the esModuleInterop line and every compilerOption stay exactly as they are."
    gotcha: "The array is a single line — keep it one line and keep the two-space indent. Adding the glob does not change output paths: rootDir `src` already maps src/lib/extract.ts to dist/lib/extract.js."
    verify:
      - "npm run build — compiles clean."
      - "test -f dist/lib/extract.js && echo emitted-at-expected-path"
    checklist:
      - "Did the SEARCH block apply cleanly on first attempt?"
      - "Is `src/lib/**/*.ts` present in the include array, ahead of src/scripts?"
      - "Are all compilerOptions byte-identical to before?"
      - "Does dist/lib/extract.js exist after a build?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.5 Phase 1 verification gate
    ```yaml
    description: "Run the plan's six Phase 1 checks, chief among them the byte-parity diff that is the extractor refactor's regression test. Do not start Phase 2 until every check passes."
    issues: []
    implement:
      - "Run the verify sequence below in order, using the same --root directory recorded in task 1.1."
      - "If the byte-parity diff is non-empty, do NOT adjust before.json or accept the difference: re-read the diff, find which moved function changed behaviour, and fix src/lib/extract.ts until the diff is empty. A non-empty diff means the refactor changed the payload."
      - "Delete /tmp/before.json, /tmp/after.json and the throwaway repeat-call script once the gate passes."
    pattern: "No source edits. Verification only, across src/lib/extract.ts, src/scripts/extract-praxis-data.ts and tsconfig.json."
    imports: "dist/lib/extract.js for the repeat-call check."
    compatibility: "Acceptance criteria 13, 14 and 15 are settled here."
    gotcha: "The repeat-call check must import the COMPILED dist/lib/extract.js, not the .ts source — there is no ts runtime in this project. Run it with plain `node --input-type=module -e` or a temp .mjs file, matching the project's ESM entrypoint convention."
    verify:
      - "Byte parity, the decisive check: npm run refresh -- --root <the task 1.1 dir> --out /tmp/after.json, then diff /tmp/before.json /tmp/after.json — output is empty (acceptance criterion 14)."
      - "npm run refresh -- --help exits 0 and prints usage; with no --root exits 1; with a --root that has no flowcharge/ prints `No flowcharge/ found under <root>` and exits 1 (acceptance criterion 13)."
      - "npm run refresh -- --root <dir> with no --out still writes dist/public/data.json and the printed path is unchanged: test -f dist/public/data.json."
      - "Repeat-call check (acceptance criterion 15): a throwaway one-liner importing dist/lib/extract.js that calls extractPraxisData(root) twice and prints both issues.length values — the two numbers are equal. Delete the script afterwards."
      - "grep -n 'process\\.\\|console\\.' src/lib/extract.ts returns nothing."
      - "npm start still serves the board unchanged — this phase touched nothing it reads. Confirm the six columns, four KPI cards and both lower panels render, console clean."
    checklist:
      - "Is diff /tmp/before.json /tmp/after.json empty?"
      - "Do the three CLI exit-code paths still return 0, 1 and 1?"
      - "Does a no---out run still write dist/public/data.json?"
      - "Do two successive extractPraxisData calls in one process report equal issues.length?"
      - "Does the board still render identically under npm start?"
      - "Were /tmp/before.json, /tmp/after.json and the throwaway script deleted afterwards?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Phase 2 — Registry and API routes, dark-launched

  ```yaml
  description: "Add the project registry library and the three /api/ routes to src/server.ts, placed before the existing static fallthrough. No page calls these routes yet — the whole phase is verified by curl. Depends on Phase 1."
  ```

  - [x] 2.1 Add `ProjectEntry` and `ProjectList` to `src/types/praxis-data.d.ts`
    ```yaml
    description: "Extend the existing ambient declaration file with the registry's two shapes, so both the Node and browser compilations see them without an import on either side."
    issues: []
    implement:
      - "Append these two interfaces to src/types/praxis-data.d.ts, after the existing PraxisData interface, transcribed exactly including the comments:"
      - |
        interface ProjectEntry {
          id: string;     // 8 lowercase hex chars: sha1 of `path`, truncated
          name: string;   // path.basename(path) — display only, never an identifier
          path: string;   // absolute, path.resolve'd
          added: string;  // YYYY-MM-DD
        }

        interface ProjectList {
          projects: ProjectEntry[];
        }
      - "ProjectList is deliberately both the on-disk registry shape and the GET /api/projects response body — they are the same thing, so they get one type. Do not split them."
      - "After editing, confirm the file still has no top-level import or export statement."
    pattern: "src/types/praxis-data.d.ts"
    imports: "None — and none may be added."
    compatibility: "This file is the mechanism WS-1 built for sharing shapes between the Node and browser compilations. Adding a top-level import or export turns it into a module and every interface in it silently stops being global, breaking both app.ts and the extractor."
    gotcha: "The file's header comment describes it as declaring 'the data.json payload' — leave the comment alone in this task; the ProjectEntry/ProjectList additions do not require rewording it and task 5.x does not cover it either. Use `interface`, not `type` or `export interface`."
    verify:
      - "grep -nE '^(import|export)' src/types/praxis-data.d.ts — returns nothing."
      - "npm run build — both tsc projects compile clean."
      - "node -e \"1\" is not a check here; instead confirm the interfaces are visible by using them in task 2.2 and building."
    checklist:
      - "Are both ProjectEntry and ProjectList declared with the exact field names, types and order given above?"
      - "Does the file still contain zero top-level import or export statements?"
      - "Are the field comments transcribed verbatim?"
      - "Do both tsconfig projects still compile after the edit?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.2 Create `src/lib/projects.ts` — the registry read/write library
    ```yaml
    description: "New file owning the .praxis-projects.json registry file and its four exported functions. Knows the registry and its shape; knows nothing about HTTP, request/response objects, the extractor, or PraxisData."
    issues: []
    implement:
      - "Create src/lib/projects.ts exporting exactly these four functions, with these signatures, and no others:"
      - |
        export function projectId(absPath: string): string;
        export function readProjects(): ProjectEntry[];
        export function findProject(id: string): ProjectEntry | undefined;
        export function addProject(absPath: string): { entry: ProjectEntry; created: boolean };
      - "projectId(absPath): sha1 of absPath via node:crypto, hex digest, truncated to 8 lowercase hex chars. Deterministic, so re-adding the same path is idempotent and a bookmarked board URL survives the registry being recreated."
      - "readProjects(): reads the registry file and returns its `projects` array. A missing or unreadable or unparseable file returns [] — never throws, never an error. A corrupted registry must cost the user their list, never their ability to start the app. (Task 4.5 later replaces the missing-file [] with a pre-registered self-entry; do not anticipate that here.)"
      - "findProject(id): readProjects().find(p => p.id === id)."
      - "addProject(absPath): path.resolve the input, compute the id, and if that id is already present return { entry: <the existing entry>, created: false }; otherwise build { id, name: path.basename(resolved), path: resolved, added: <YYYY-MM-DD> }, append it to the list, write the WHOLE file back as a ProjectList, and return { entry, created: true }."
      - "The registry file lives at the repo root as .praxis-projects.json, located __dirname-relative and cwd-independent, matching the convention already used at src/server.ts:7, src/scripts/extract-praxis-data.ts:13 and tools/copy-assets.mjs:8."
      - "This file must NOT import from ../lib/extract.js, must not reference http or req/res objects, and must not mention PraxisData."
    pattern: "src/lib/projects.ts (new)"
    imports: "node:fs, node:path, node:crypto, and node:url for the __dirname derivation. ProjectEntry and ProjectList are ambient globals from src/types/praxis-data.d.ts — do NOT import them."
    compatibility: "package.json sets \"type\": \"module\" and the root tsconfig is node16, so this is ESM: __dirname does not exist and must be derived as `const __dirname = path.dirname(fileURLToPath(import.meta.url));`, exactly as src/server.ts:6 does. `added` is YYYY-MM-DD — use new Date().toISOString().slice(0, 10), the same expression the extractor uses for `generated`. The written JSON is a ProjectList object ({ projects: [...] }), not a bare array."
    gotcha: "PLN-4's Design section writes the registry path as path.join(__dirname, '..', '.praxis-projects.json') and asserts that resolves to the repo root — it does not. This file compiles to dist/lib/projects.js, so __dirname is <repo>/dist/lib and one `..` lands in dist/, which the plan itself explicitly rules out (dist/ is gitignored and README documents `rm -rf dist` as the clean procedure, so a registry there would be silently disposable). Use path.join(__dirname, '..', '..', '.praxis-projects.json'). Honour the plan's stated intent — repo root — over its arithmetic. Second gotcha: the read-modify-write has no locking; two simultaneous adds would lose one entry. PLN-4 assumption 6 accepts this for a single local user — do not add locking."
    verify:
      - "npm run build — compiles clean."
      - "test -f dist/lib/projects.js && echo emitted"
      - "node --input-type=module -e \"import {projectId} from './dist/lib/projects.js'; const a=projectId('/tmp/x'); console.log(a, /^[0-9a-f]{8}$/.test(a), a===projectId('/tmp/x'));\" — prints an 8-char lowercase hex id, true, true."
      - "grep -nE \"extract|PraxisData|http|req\\.|res\\.\" src/lib/projects.ts — returns nothing."
    checklist:
      - "Are exactly the four named functions exported, with the exact signatures given?"
      - "Does the registry path resolve to <repo root>/.praxis-projects.json and NOT to dist/?"
      - "Does readProjects() return [] rather than throwing for a missing, unreadable or malformed file?"
      - "Does addProject return created: false with the existing entry when the resolved path is already registered?"
      - "Is projectId deterministic and 8 lowercase hex characters?"
      - "Does the file avoid all knowledge of HTTP, the extractor and PraxisData?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.3 Add `.praxis-projects.json` to `.gitignore`
    ```yaml
    description: "The registry is machine-local. Keep git status clean after a user adds a project."
    issues: []
    implement:
      - "Apply this block to .gitignore:"
      - |
        .gitignore
        <<<<<<< SEARCH
        *.log
        dist/
        =======
        *.log
        dist/
        .praxis-projects.json
        >>>>>>> REPLACE
    pattern: ".gitignore"
    imports: "None."
    compatibility: "Acceptance criterion 18 — git status clean after adding a project."
    gotcha: "The file has no trailing-newline surprises; keep the existing entries in order and append the new line at the end."
    verify:
      - "git check-ignore -v .praxis-projects.json — reports the .gitignore rule."
      - "git status --porcelain — after a subsequent POST creates the file, it is not listed."
    checklist:
      - "Did the SEARCH block apply cleanly on first attempt?"
      - "Are node_modules/, .DS_Store, *.log and dist/ all still present and in their original order?"
      - "Does git check-ignore confirm the new rule matches?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.4 Add the `/api/` route branch, body reader and localhost bind to `src/server.ts`
    ```yaml
    description: "Insert a request-body reader and an if (reqPath.startsWith('/api/')) branch above the existing static logic, implementing the three routes exactly as the plan's HTTP contract specifies, each wrapped in try/catch → 500 + console.error. Also bind the listener to 127.0.0.1."
    issues: []
    implement:
      - "In src/server.ts, import { extractPraxisData, hasPrxwork } from './lib/extract.js' and { readProjects, findProject, addProject } from './lib/projects.js' — both specifiers carry the .js extension, required under node16 resolution."
      - "Add a request-body reader used only by the POST route. The whole addition is: collect chunks → if the running total exceeds 8192 bytes, respond 413 and destroy the request → otherwise JSON.parse in a try/catch, 400 on failure. 8KB is the '10,000x the expected size' answer for an endpoint whose only input is a filesystem path; it is the only unbounded input this feature introduces."
      - "Insert `if (reqPath.startsWith('/api/')) { ... return; }` immediately after the existing traversal-guard block and BEFORE `fs.readFile(filePath, ...)` — the API branch must never reach the traversal guard's filePath logic. Everything below the branch (the guard, fs.readFile, the MIME table, the 404 body) is untouched."
      - "Every response from the branch is Content-Type application/json; charset=utf-8."
      - "Implement this route table exactly — statuses, paths, methods and response bodies as written:"
      - |
        GET /api/projects
          200  { "projects": ProjectEntry[] }
               A missing or unreadable registry file yields { "projects": [] }, never an error.

        POST /api/projects        request body: application/json, max 8192 bytes
          request   { "path": "/Users/x/Work/LAD" }
          201       { "project": ProjectEntry }   newly registered
          200       { "project": ProjectEntry }   already registered (same absolute path)
          400       { "error": "…" }              unparseable body, missing/non-string `path`,
                                                  path not absolute, or no flowcharge/ under it
          413       { "error": "Request body too large" }
          500       { "error": "…" }              registry could not be written

        GET /api/projects/<id>/data
          200       PraxisData                    freshly extracted, identical shape to today's data.json
          404       { "error": "Unknown project …" }
          410       { "error": "… no longer contains a flowcharge/ folder" }
          500       { "error": "Extraction failed" }   details go to console.error server-side

        any other /api/… path      404  { "error": "Not found" }
        wrong method on the above  405  { "error": "Method not allowed" }
      - "POST validation order: parse the body (400 on failure); reject a missing or non-string `path` (400); reject a leading `~` with a message that says explicitly that `~` is not expanded — do NOT expand it (PLN-4 Open Question 3's committed default); reject a non-absolute path via path.isAbsolute with a message naming the absolute-path requirement (400); reject a path where hasPrxwork is false with a message naming that as the reason (400). Then call addProject and respond 201 when created is true, 200 when it is false."
      - "GET /api/projects/<id>/data: match the id with a regex over reqPath; findProject(id) undefined → 404 with an `Unknown project …` error string; hasPrxwork(entry.path) false → 410 with a `… no longer contains a flowcharge/ folder` error string; otherwise extractPraxisData(entry.path) and write the returned PraxisData straight to the response as the 200 body."
      - "Wrap EVERY branch in try/catch responding 500 + console.error. An uncaught throw inside an http.createServer handler takes the whole process down — this is the plan's central safety property, not a nicety. It matters most for extractPraxisData, which parses arbitrary markdown from a directory the server does not control."
      - "Change server.listen(port, ...) to server.listen(port, '127.0.0.1', ...) — PLN-4 Open Question 2's committed default. After this change the server exposes an API that reads arbitrary registered directories and registers any absolute path posted to it; one line makes the 'local single-user tool' assumption actually true. Leave the startup log line's text as it is."
      - "Do not add any dependency. Node's node:http only."
    pattern: "src/server.ts"
    imports: "node:http, node:fs, node:path, node:url (all already present), plus ./lib/extract.js and ./lib/projects.js."
    compatibility: "Acceptance criterion 20 — static serving must be unchanged for every non-/api/ path: the MIME table, the traversal guard's semantics, the 404 body and the PORT override all behave exactly as they do today. Acceptance criterion 16 — still exactly two devDependencies and zero runtime dependencies. The existing `req.url!` non-null assertion at line 21 is WS-1's assert-don't-coerce rule; keep it. The route table transcribed above is the authority; do not re-derive equivalent-but-different status codes or body shapes."
    gotcha: "reqPath is already computed as decodeURIComponent(req.url!.split('?')[0]) at line 21 — reuse it, do not recompute. The API branch must sit AFTER that line so reqPath exists, and BEFORE fs.readFile. `filePath` is computed at line 22 before the branch; it is simply unused on the API path, which is fine — do not restructure the static code to avoid it. The 413 path must destroy the request as well as respond, or the client keeps streaming. The client renders the `error` string verbatim in both the 404 and 410 cases; the distinct status codes exist because they are accurate, not because the client branches on them — so the strings must be human-readable. JSON.parse of an empty body throws — that is a 400, not a 500."
    verify:
      - "npm run build — compiles clean."
      - "npm start, then run the full curl sequence in task 2.5."
      - "grep -n \"server.listen\" src/server.ts — shows the 127.0.0.1 host argument."
      - "grep -c \"catch\" src/server.ts — at least one catch per API branch."
    checklist:
      - "Is the /api/ branch placed after the traversal guard and before fs.readFile, with the static code below it byte-unchanged?"
      - "Does every API branch sit inside a try/catch that responds 500 and console.errors the reason?"
      - "Are all three routes' status codes and response body shapes exactly as the transcribed contract specifies, including 405 for a wrong method and 404 for an unknown /api/ path?"
      - "Is the body reader capped at 8192 bytes, responding 413 and destroying the request above that?"
      - "Is a leading ~ rejected with an explicit message rather than expanded?"
      - "Does server.listen now bind 127.0.0.1, and does package.json still list exactly two devDependencies and zero dependencies?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.5 Phase 2 verification gate — the twelve curl checks
    ```yaml
    description: "curl is the API's integration test. Twelve requests cover every route, every status code and every rejection path, plus the static-serving regression set. Do not start Phase 3 until every check passes."
    issues: []
    implement:
      - "Start the server with npm start and run the verify sequence below in order against http://127.0.0.1:4173."
      - "Use curl -s -o /dev/null -w '%{http_code}' for status assertions and a plain curl for body inspection."
      - "Keep the twelve requests as a shell snippet in this phase's commit message — there is nowhere else in this repo to put them, and no test framework is being added."
      - "Delete .praxis-projects.json between checks 1 and 2 if a registry already exists, so check 1 genuinely exercises the missing-file path."
    pattern: "No source edits. Verification only, across src/server.ts, src/lib/projects.ts, src/types/praxis-data.d.ts and .gitignore."
    imports: "curl, git."
    compatibility: "Settles acceptance criteria 16, 18 and 20, and the server-side halves of 3, 4, 5, 6, 8 and 12."
    gotcha: "The server now binds 127.0.0.1 — curl against localhost still works, but a request from another machine on the LAN will not, and that is the intended change. Check 10 renames a real flowcharge/ folder aside; rename it back immediately, and pick a registered project that is not the dashboard repo itself if that is more comfortable."
    verify:
      - "GET /api/projects on a machine with no registry file → 200 {\"projects\":[]}."
      - "POST /api/projects with {\"path\":\"/Users/akoukoullis/Work/AK/Praxis-Dashboard\"} → 201, and .praxis-projects.json now exists containing that entry with an 8-hex id."
      - "The same POST again → 200, same id, still one entry in the file."
      - "POST with {\"path\":\"./relative\"} → 400, message names the absolute-path requirement."
      - "POST with {\"path\":\"~/anything\"} → 400, message says ~ is not expanded."
      - "POST with an absolute path that has no flowcharge/ → 400, message names that reason."
      - "POST with a malformed body → 400. POST with a 20KB body → 413."
      - "GET /api/projects/<id>/data → 200 with a payload whose `source` is the project root, and whose workstreams.length and issues.length match a npm run refresh -- --root <same> run against the same directory."
      - "GET /api/projects/deadbeef/data → 404. PUT /api/projects → 405. GET /api/nope → 404."
      - "Rename the project's flowcharge/ folder aside, re-request its data → 410 and the server is still running. Rename it back."
      - "Regression: /, /styles.css, /app.js, /data.json all still 200 with the correct Content-Type; /../package.json still 403; the board still renders. PORT=5000 npm start still works."
      - "git status is clean. node -e \"const p=require('./package.json'); console.log(Object.keys(p.devDependencies).length, p.dependencies||'none')\" prints 2 and none (acceptance criterion 16)."
    checklist:
      - "Do all twelve checks pass with the exact status codes listed?"
      - "Is the server process still running after the 410 check — i.e. did an extraction-path failure not take it down?"
      - "Does the /api/projects/<id>/data payload's workstreams.length and issues.length match an equivalent npm run refresh run?"
      - "Are /, /styles.css, /app.js and /data.json all still served with the correct Content-Type, and /../package.json still 403?"
      - "Is git status clean with .praxis-projects.json present on disk?"
      - "Does package.json still list exactly two devDependencies and zero runtime dependencies?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 3. Phase 3 — Home page at `/`, board moved to `/board.html`

  ```yaml
  description: "Move the board markup verbatim to board.html with a back link, create the new index.html home page and home.ts, and wire the styles, the browser tsconfig and the asset copier. The board still fetches ./data.json at the end of this phase — navigation is the only deliverable. Depends on Phase 2."
  ```

  - [x] 3.1 `git mv src/public/index.html → src/public/board.html` and add the back link
    ```yaml
    description: "Move the board markup to its own document, preserving git history, and add a plain-anchor back control to the masthead. The markup is otherwise untouched."
    issues: []
    implement:
      - "Run: git mv src/public/index.html src/public/board.html"
      - "In board.html's masthead (the <div class=\"masthead\"> block at lines 11-23), add `<a class=\"back-link\" href=\"/\">← Projects</a>`. Place it inside the masthead's first <div>, above the .brand-row, so it reads as a breadcrumb above the title."
      - "A plain anchor, not a click-handled element, so middle-click, cmd-click and the context menu all behave (acceptance criterion 9)."
      - "Change NOTHING else in this file in this task. The <title>, the kpi-strip, the controls, the board div, the lower panels, the footer note and the <script src=\"app.js\"></script> tag all stay exactly as they are. Task 4.2 revises the loading-panel and footer text; do not pre-empt it."
    pattern: "src/public/index.html → src/public/board.html"
    imports: "None. Still loads styles.css and app.js by the same relative names, both of which sit alongside it in dist/public/."
    compatibility: "The document keeps every id app.ts reads: tagline, gen-date, meta-counts, kpi-strip, sort-key-seg, sort-dir-seg, search, result-count, board, lower, attn-count, attn-list, sev-total, sev-bar, sev-legend. Removing or renaming any of them breaks a byId() non-null assertion at runtime."
    gotcha: "Use git mv, not a copy-and-delete, so the file's history follows it. After this task /  will 404 until task 3.2 lands a new index.html — that is expected mid-phase, and is why 3.2 follows immediately. The .back-link class has no styling until task 3.4; that is fine and intentional ordering."
    verify:
      - "git status --porcelain — shows the rename as R, not as a delete plus an add."
      - "grep -n 'back-link' src/public/board.html — one occurrence, inside the masthead."
      - "diff <(git show HEAD:src/public/index.html) src/public/board.html — the only difference is the added back-link line."
    checklist:
      - "Did git record a rename rather than a delete-plus-add?"
      - "Is the back control a plain <a href=\"/\"> and not a button or a click-handled div?"
      - "Is the diff against the original index.html limited to the single added line?"
      - "Are all fifteen element ids app.ts reads still present?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.2 Create the new `src/public/index.html` — the home page shell
    ```yaml
    description: "New home page document: the same head and masthead brand as the board, a heading, the tiles container, the add-project form and its error slot, a footer note, and the home.js script tag."
    issues: []
    implement:
      - "Create src/public/index.html with the same <head> as board.html — charset, viewport, <link rel=\"stylesheet\" href=\"styles.css\"> — and a <title> naming the project list rather than the board."
      - "Reuse the board's masthead brand markup (<div class=\"masthead\">, .brand-row, the `P` mark span, an <h1>) so the two pages read as one application. The home page has no gen-date or meta-counts."
      - "Add a heading, then `<div id=\"project-tiles\"></div>` — home.ts renders into this and clears it before each render."
      - "Add the add-project form: `<input id=\"project-path\">` (type text, an autocomplete=off attribute and a placeholder showing an absolute path), a submit button, and `<div id=\"add-error\"></div>` for messages."
      - "Add a footer note in the same <footer class=\"note\"> shape the board uses, explaining that a project is any directory containing a flowcharge/ folder and that the list is stored machine-locally."
      - "Add `<script src=\"home.js\"></script>` as the last element before </body> — the same position and classic-script form the board uses for app.js."
      - "All styling goes in styles.css (task 3.4), not inline — WS-4's rule. The only inline style permitted anywhere in this codebase is the board's one-off display:none, which is not repeated here."
    pattern: "src/public/index.html (new)"
    imports: "styles.css and home.js, both by bare relative name, both siblings in dist/public/."
    compatibility: "Ids project-tiles, project-path and add-error are the contract between this file and src/public/home.ts — they must match exactly what task 3.3 reads. Do not reuse any id that board.html declares; the two documents never load together, but keeping the id spaces distinct keeps the CSS unambiguous."
    gotcha: "If the form is a real <form> element, its submit handler must call preventDefault or the page will reload and the no-reload requirement (acceptance criterion 3) fails. Either use a <form> plus preventDefault in home.ts, or a plain button with a click handler — pick one and make task 3.3 match. The tiles container must start empty: any placeholder markup left inside it would be wiped by the first render anyway, and an empty state is home.ts's job."
    verify:
      - "npm run build && npm start, open http://127.0.0.1:4173/ — the page loads with the masthead, heading, empty tiles container and the form. Console clean."
      - "grep -n 'id=\"project-tiles\"\\|id=\"project-path\"\\|id=\"add-error\"\\|home.js' src/public/index.html — all four present."
      - "grep -n 'style=' src/public/index.html — returns nothing."
    checklist:
      - "Are the ids project-tiles, project-path and add-error all present and spelled exactly as task 3.3 expects?"
      - "Is <script src=\"home.js\"></script> present as a classic script with no type=\"module\"?"
      - "Does the file carry zero inline style attributes?"
      - "Does the head link styles.css by the same relative name board.html uses?"
      - "Is the tiles container empty in the markup?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.3 Create `src/public/home.ts` — the home page script
    ```yaml
    description: "Fetches /api/projects, renders one anchor tile per entry, handles the add-project form, and shows the server's error string on failure. Its renderer clears its container before appending — deliberately unlike the board's three append-only renderers."
    issues: []
    implement:
      - "Create src/public/home.ts with its ENTIRE body inside an IIFE — `(function () { ... })();` — exactly as src/public/app.ts does at lines 1 and 334. This is load-bearing, see compatibility."
      - "On load, fetch('/api/projects') and render. The render function CLEARS #project-tiles before appending, because it re-renders after every successful add. This is the opposite of the board's renderKpis/renderAttention/renderSeverity, which append without clearing — do not copy their shape."
      - "Render one `<a class=\"tile\" href=\"/board.html?project=<id>\">` per entry, showing the entry's name, its path and its added date (acceptance criterion 1). Anchors, not click-handled divs, so deep-linking, bookmarking, cmd-click, middle-click and keyboard Enter all work for free."
      - "When the list is empty, render an empty state naming what to do — not a blank grid and not an error (acceptance criterion 2)."
      - "Submitting the form POSTs { path: <input value> } as JSON to /api/projects. On success, re-fetch the list and re-render, with no page reload (acceptance criterion 3)."
      - "On a non-2xx response, show the response body's `error` string verbatim in #add-error and leave the input's value alone, so the user can correct it rather than retype it."
      - "Client-side, reject a non-absolute path before sending, using the same message the server uses. The server remains the authority; this is only for instant feedback."
      - "This file must NOT know about PraxisData, the board's rendering, or the filesystem."
    pattern: "src/public/home.ts (new)"
    imports: "None. Browser built-ins only — fetch, document, JSON. ProjectEntry and ProjectList are ambient globals; the browser tsconfig includes ../types/praxis-data.d.ts, so they are in scope without an import."
    compatibility: "src/public/tsconfig.json has \"module\": \"none\", so app.ts and home.ts compile as ONE global program. Anything home.ts declares at top level collides with app.ts's top-level declarations and tsc reports a duplicate identifier — the IIFE wrapper is what prevents that. \"types\": [] on that config mechanically prevents this file from reaching for Node globals. Output must be a classic script: no import, no export, no module wrapper (acceptance criterion 17). \"rootDir\": \"..\" already places the emit at dist/public/home.js."
    gotcha: "app.ts declares el, byId, fmtDate, daysSince, STATUS_ORDER and friends — all inside its IIFE, so home.ts may reuse those names inside its own IIFE, but never at top level. Do not import helpers from app.ts; there is no module system here and duplicating a small el() helper inside the IIFE is the correct answer under module: none. fetch('/api/projects') must use an absolute path, not './api/projects', so it resolves the same from / and from /board.html. Whichever form task 3.2 chose for the form, match it: a <form> needs preventDefault, a bare button needs a click listener."
    verify:
      - "npm run build — compiles clean, with no duplicate-identifier error across app.ts and home.ts."
      - "grep -nE '^\\s*(import|export)' dist/public/home.js — returns nothing (acceptance criterion 17)."
      - "npm start, open /: the project registered in Phase 2 appears as a tile with its name, path and added date. Console clean."
      - "Delete .praxis-projects.json and reload: the empty state appears, not an error."
    checklist:
      - "Is the entire file body wrapped in an IIFE with zero top-level declarations?"
      - "Does the render function clear #project-tiles before appending?"
      - "Are tiles <a> elements with href=\"/board.html?project=<id>\"?"
      - "Does a non-2xx add response show the server's `error` string in #add-error and leave the input value intact?"
      - "Is a non-absolute path rejected client-side with the same message the server uses?"
      - "Does dist/public/home.js contain no import or export statements?"
    self_eval:
      passed: true
      failures:
        - item: "Is a non-absolute path rejected client-side with the same message the server uses?"
          reason: "A ~-prefixed path is non-absolute, so the client rejected it with the generic absolute-path message and the server's explicit ~-is-not-expanded message was never reached. Found during task 3.7 check 4."
          fix: "Added a TILDE_MESSAGE constant carrying the server's exact ~ string and a leading-~ branch ahead of the absolute-path branch in src/public/home.ts, so each client-side rejection reproduces the server message for that case. Re-verified in the browser: ~/Work/... now shows `~ is not expanded — enter the full absolute path instead`."
    ```

  - [x] 3.4 Add tile grid, add-form and back-link styles to `src/public/styles.css`
    ```yaml
    description: "Style the home page and the board's new back link using the existing custom properties, so both colour schemes work with no new palette."
    issues: []
    implement:
      - "Append rules to src/public/styles.css for: the tile grid container (#project-tiles), the .tile anchor, the tile's name/path/date lines, the empty state, the add-project form and its input and button, #add-error, and .back-link."
      - "Reuse the existing custom properties — --paper-raised, --line, --radius, --shadow, --font-mono — plus the ink variables already in the file. Introduce NO new palette values: the file already defines both schemes at lines 6-99 (a prefers-color-scheme block plus explicit [data-theme] overrides) and a hardcoded colour would break one of them."
      - "Model the tile on the existing .card rules (lines ~273-281): var(--paper-raised) background, 1px solid var(--line) border, var(--radius) corners, var(--shadow). Model the input on the existing search input (line ~255) and the button on the .seg buttons (line ~236)."
      - "Give .tile a visible :focus-visible outline — it is a keyboard-reachable anchor and acceptance criterion 8's keyboard check depends on the focus being visible."
      - "Set .tile { text-decoration: none; color: inherit; } so the anchor does not render as a blue underlined link."
      - "Use var(--font-mono) for the tile's path line and the added date, matching how the file treats every other machine-readable string."
      - "Static styling goes here, not inline in the HTML — WS-4's rule."
    pattern: "src/public/styles.css"
    imports: "None."
    compatibility: "The file already carries the full board stylesheet; append the new rules at the end, alongside the existing .load-state block (lines 424-441), and do not reorder or reformat anything above. The final @media (prefers-reduced-motion) block at the end may stay last or be preceded by the new rules — either is fine, but do not modify it."
    gotcha: "The dark scheme is defined twice — once under @media (prefers-color-scheme: dark) at lines 46-75 and once under an explicit selector at lines 79-88. Because the new rules only reference custom properties, both are handled automatically; the moment a literal hex is used, only one scheme gets it. .back-link is a masthead child, so check its contrast against the masthead background specifically, which differs from the page background."
    verify:
      - "npm run build && npm start, open / — the tile grid and the form are laid out and legible."
      - "Toggle the OS appearance between light and dark and reload: both schemes are legible, with no invisible text and no washed-out borders (acceptance criterion covered by Phase 3 verify 7)."
      - "grep -nE '#[0-9a-fA-F]{3,8}' src/public/styles.css | tail -20 — the newly appended rules contain no literal colours."
      - "Tab to a tile: the focus ring is clearly visible."
    checklist:
      - "Do the new rules reference only existing custom properties, with zero literal colour values?"
      - "Is .tile styled with text-decoration: none and an inherited colour so it does not look like a default link?"
      - "Does .tile have a visible :focus-visible state?"
      - "Are both colour schemes legible after an OS appearance toggle?"
      - "Was every pre-existing rule in the file left byte-unchanged?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.5 Add `home.ts` to the browser tsconfig include
    ```yaml
    description: "Bring the second browser file into the same module: none compilation that emits app.js."
    issues: []
    implement:
      - "Apply this block to src/public/tsconfig.json:"
      - |
        src/public/tsconfig.json
        <<<<<<< SEARCH
          "include": ["app.ts", "../types/praxis-data.d.ts"]
        =======
          "include": ["app.ts", "home.ts", "../types/praxis-data.d.ts"]
        >>>>>>> REPLACE
      - "No compilerOption changes. \"module\": \"none\", \"types\": [], \"rootDir\": \"..\" and \"outDir\": \"../../dist\" all stay exactly as they are, including their inline comments."
    pattern: "src/public/tsconfig.json"
    imports: "None."
    compatibility: "Both files now emit as separate classic scripts into dist/public/, loaded by their own page's <script> tag. rootDir \"..\" already places the output correctly for both."
    gotcha: "Under module: none the two files form one global program — this is the change that makes a top-level name collision between app.ts and home.ts a build error. If tsc reports a duplicate identifier after this edit, the fix belongs in home.ts's IIFE (task 3.3), never in app.ts."
    verify:
      - "npm run build — compiles clean, no duplicate-identifier diagnostics."
      - "test -f dist/public/app.js && test -f dist/public/home.js && echo both-emitted"
      - "grep -nE '^\\s*(import|export)' dist/public/app.js dist/public/home.js — returns nothing (acceptance criterion 17)."
    checklist:
      - "Did the SEARCH block apply cleanly on first attempt?"
      - "Are all four compilerOptions and their inline comments unchanged?"
      - "Do both dist/public/app.js and dist/public/home.js exist after a build?"
      - "Are both emitted files free of import and export statements?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.6 Add `board.html` to the `tools/copy-assets.mjs` copy list
    ```yaml
    description: "The asset copier must place both HTML documents into dist/public/, or /board.html 404s."
    issues: []
    implement:
      - "Apply this block to tools/copy-assets.mjs:"
      - |
        tools/copy-assets.mjs
        <<<<<<< SEARCH
        for (const name of ['index.html', 'styles.css']) {
        =======
        for (const name of ['index.html', 'board.html', 'styles.css']) {
        >>>>>>> REPLACE
      - "Leave the data.json seeding branch (lines 20-31) alone in this task — task 4.3 removes it, after the board has stopped fetching that file."
    pattern: "tools/copy-assets.mjs"
    imports: "None."
    compatibility: "The loop already copies unconditionally and logs each name; board.html gets the same treatment with no other change."
    gotcha: "Stale output: if dist/public/index.html predates task 3.1, a build overwrites it with the new home page correctly — but a leftover dist/public/board.html from a prior experiment would also be overwritten, which is fine. No rm -rf dist is needed. Do NOT remove the seeding branch here; the board still fetches ./data.json until Phase 4."
    verify:
      - "npm run build — logs `copied index.html`, `copied board.html`, `copied styles.css`."
      - "test -f dist/public/board.html && test -f dist/public/index.html && echo both-copied"
      - "npm start, open /board.html — the board document is served."
    checklist:
      - "Did the SEARCH block apply cleanly on first attempt?"
      - "Does the build log all three copied names?"
      - "Do both HTML files exist under dist/public/ after a build?"
      - "Is the data.json seeding branch still present and untouched?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.7 Phase 3 verification gate
    ```yaml
    description: "Run the plan's eight Phase 3 checks — navigation, the add-project flow, its three rejection paths, the classic-script check, both colour schemes and keyboard access. Do not start Phase 4 until every check passes."
    issues: []
    implement:
      - "Run the verify sequence below in order with npm start running."
      - "The board still fetches ./data.json at this point. Its rendering from the seeded file is the expected result of check 5 — do not 'fix' it here; task 4.1 changes the data source."
      - "Restore .praxis-projects.json (or re-add the project through the form) after check 2 deletes it."
    pattern: "No source edits. Verification only, across src/public/index.html, board.html, home.ts, styles.css, tsconfig.json and tools/copy-assets.mjs."
    imports: "A browser, and the OS appearance toggle."
    compatibility: "Settles acceptance criteria 1, 2, 3, 4, 5, 6, 9, 10 and 17."
    gotcha: "Check 5's browser-back assertion is the whole reason the plan chose two documents over a display toggle — if back does not return to /, something turned a tile into a click handler and the design's central property has been lost. Treat that as a blocking failure, not a polish item."
    verify:
      - "npm start, open /: the home page lists the project registered in Phase 2 as a tile with its name, path and date. Console clean (acceptance criterion 1)."
      - "Delete the registry file, reload: the empty state appears, not an error (acceptance criterion 2)."
      - "Add a valid path through the form: a tile appears without a page reload. Add it again: still one tile, no duplicate. Reload: the tile is still there (acceptance criteria 3 and 6)."
      - "Add a relative path, then ~/something, then an absolute path with no flowcharge/: each shows its message in #add-error and adds no tile (acceptance criteria 4 and 5)."
      - "Click a tile: /board.html?project=<id> opens and renders the full board (from data.json for now). The back link returns to /. The browser back button also returns to /, and forward returns to the board (acceptance criteria 9 and 10)."
      - "grep -E '^\\s*(import|export)' dist/public/home.js returns nothing; tsc reported no duplicate identifiers across app.ts and home.ts (acceptance criterion 17)."
      - "Both colour schemes: toggle the OS appearance and confirm tiles and form are legible in each."
      - "Keyboard: tab to a tile and press Enter — it navigates, because it is an anchor."
    checklist:
      - "Does the home page render one tile per registered project with name, path and date?"
      - "Does the empty state appear — rather than an error — when no registry file exists?"
      - "Do all three rejection paths show a message and register nothing?"
      - "Does the browser back button return to / and forward return to the board?"
      - "Is dist/public/home.js free of import and export statements?"
      - "Is the home page legible in both colour schemes and navigable by keyboard?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 4. Phase 4 — The board renders its own project

  ```yaml
  description: "Point app.ts at /api/projects/<id>/data via the ?project= parameter, rewrite the load-failure panel, re-point board.html's loading and footer text, remove the data.json seeding branch, delete src/public/data.json, and pre-register the dashboard repo's own root so a fresh clone still works. Depends on Phase 3."
  ```

  - [x] 4.1 `src/public/app.ts` — read `?project=`, fetch the API, rewrite the failure panel
    ```yaml
    description: "The board's only two changes: where it gets its URL, and the text of the panel it shows when loading fails. boot and the four renderers are not touched."
    issues: []
    implement:
      - "In src/public/app.ts, replace the fetch at line 21 — currently `fetch('./data.json', { cache: 'no-store' })` — with logic that first reads the `project` parameter from location.search (new URLSearchParams(location.search).get('project'))."
      - "If the parameter is absent, render the guidance panel with a link home and DO NOT fetch (acceptance criterion 11)."
      - "Otherwise fetch('/api/projects/' + encodeURIComponent(id) + '/data', { cache: 'no-store' }) — keep the no-store cache option, which is what makes acceptance criterion 8's reload-shows-current-data behaviour reliable."
      - "Rewrite the existing catch-branch panel (lines 27-39). It currently reads \"Couldn't load data.json\" and prints the npm run refresh command in a <pre>. It must now render the API's `error` message when the response carried one, plus a link back to the project list. Keep the same .load-state markup shape — a div.load-state containing an h2 and paragraphs — and the same styling; the <pre> with the refresh command goes, since that command is no longer the fix."
      - "To surface the API's error string, the .then that currently does `if (!r.ok) throw new Error('HTTP ' + r.status)` must read the JSON body on a non-ok response and throw with its `error` field when present, falling back to the status code when it is not. The client renders that string verbatim for both the 404 and the 410 case — it does not branch on the status code."
      - "CHANGE NOTHING ELSE. boot (line 41 onward), renderKpis, renderAttention, renderSeverity, buildCard, renderBoard, the three addEventListener calls and the sort/filter logic are all out of scope. The two-document design exists precisely so this 333-line, WS-1-verified file needs no idempotency or listener-rebinding surgery."
    pattern: "src/public/app.ts, lines 21-39 only."
    imports: "None. Browser built-ins only — URLSearchParams, fetch. The file's existing el()/byId() helpers build the panel."
    compatibility: "The file's IIFE wrapper (lines 1 and 334) and its `var`-style, no-import shape stay as they are — src/public/tsconfig.json is module: none and any import turns into a build error. `raw.source` still drives the masthead tagline at lines 46-48 and needs no change: the API returns the project root in that field, so the tagline names the project for free."
    gotcha: "Reading a JSON body inside the !r.ok branch means the promise chain has to await r.json() before throwing — a naive `throw new Error(await r.json())` inside a non-async .then callback will not compile. Use a nested .then, or return r.json().then(...) from that branch, keeping the existing non-async callback style. Guard against the error body itself being unparseable (a proxy or a truncated response) — fall back to 'HTTP ' + r.status rather than letting a second exception replace the first. The no-parameter case must not fetch at all, or an /api/projects/null/data request appears in the network log."
    verify:
      - "npm run build — compiles clean."
      - "grep -n \"data.json\" src/public/app.ts — returns nothing."
      - "npm start, click a tile: the board renders that project's data and the masthead tagline names it."
      - "Open /board.html with no parameter, and with ?project=deadbeef: the guidance panel with a link home appears in both cases, with no uncaught error in the console (acceptance criterion 11)."
      - "git diff --stat src/public/app.ts — the change is confined to the fetch and catch region; boot and the renderers show no modified lines."
    checklist:
      - "Is the change confined to the fetch call and the catch-branch panel, with boot and all four renderers byte-unchanged?"
      - "Does a missing ?project= parameter render the guidance panel without issuing any fetch?"
      - "Does the failure panel render the API's `error` string verbatim, with a link back to /?"
      - "Is { cache: 'no-store' } still passed to fetch?"
      - "Does the file still contain zero import or export statements and keep its IIFE wrapper?"
      - "Does grep confirm no remaining reference to data.json in app.ts?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 4.2 `src/public/board.html` — re-point the loading panel and footer text
    ```yaml
    description: "Two text regions still describe data.json and npm run refresh as the board's feed. Both now point at the API and the project's own flowcharge/."
    issues: []
    implement:
      - "In src/public/board.html, rewrite the initial loading panel inside <div class=\"board\" id=\"board\"> — currently the .load-state block with the h2 `Loading data.json…`, the paragraph `If this doesn't resolve, run the extractor first, then reload:` and the <pre> carrying the npm run refresh command. It now describes loading the project's data from the API. The <pre> with the refresh command has no purpose here any more; drop it."
      - "Rewrite the <footer class=\"note\"> block. It currently says the page reads dist/public/data.json produced by src/scripts/extract-praxis-data.ts, and tells the reader to run npm run refresh and reload. It now says the board reads the selected project's flowcharge/ live through the server on each page load, so a reload always shows current state."
      - "Keep the footer's final sentence about “Needs attention” recomputing elapsed days from each artefact's own `updated` date against the viewer's clock — that behaviour is unchanged and the sentence stays true. Keep the <code> element styling convention for any path or command named."
      - "Keep the .load-state and footer.note class names and markup shape — styles.css targets both and this task adds no CSS."
      - "Change nothing else in the document: the masthead, the back link from task 3.1, the kpi-strip, controls, lower panels and the app.js script tag all stay as they are."
    pattern: "src/public/board.html — the .load-state block (currently lines 47-51) and the footer.note block (currently lines 68-73)."
    imports: "None."
    compatibility: "The .load-state div sits inside #board and is wiped by app.ts's renderBoard on a successful load and by the catch branch on failure — so it is genuinely only the pre-fetch placeholder. Its markup shape must stay compatible with the .load-state rules at styles.css lines 424-441."
    gotcha: "Do not delete the placeholder entirely: with it gone, a slow extraction leaves a blank board area with no explanation. Task 5.3 re-reads this footer on the rendered page, so write it to be read by a human, not just to be technically accurate."
    verify:
      - "npm run build && npm start, open a project's board — the loading panel is briefly visible and describes the API, then the board replaces it."
      - "Read the rendered footer: it names no stale mechanism and no longer instructs the reader to run npm run refresh."
      - "grep -n 'data\\.json\\|npm run refresh' src/public/board.html — returns nothing."
    checklist:
      - "Does the loading panel still exist, with the .load-state class and no npm run refresh <pre>?"
      - "Does the footer describe live per-page-load extraction rather than a generated file?"
      - "Is the “Needs attention” sentence retained and still accurate?"
      - "Does grep confirm no remaining data.json or npm run refresh reference in board.html?"
      - "Are the masthead, back link, controls, panels and script tag all unchanged?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 4.3 `tools/copy-assets.mjs` — delete the data.json seeding branch
    ```yaml
    description: "Nothing fetches data.json any more, so copying a 281KB file into dist/public/ that no page requests must stop. Strictly required by the change, not a tidy-up."
    issues: []
    implement:
      - "In tools/copy-assets.mjs delete lines 20-31 in their entirety: the four-line comment beginning `// src/public/data.json is a seed fixture, not the live artefact:` and the whole branch below it — const dataSrc, const dataDest, and the if/else that logs `skipped data.json (destination already exists)` or `seeded data.json from src/public/data.json`."
      - "Keep everything above: the header comment, the four imports, the __dirname/repoRoot/srcPublic/distPublic constants, the mkdirSync and its `ensured` log, and the copy loop with its three filenames from task 3.6."
      - "The file ends after the copy loop's closing brace."
    pattern: "tools/copy-assets.mjs"
    imports: "None removed — fs, path and fileURLToPath are all still used by the surviving code."
    compatibility: "npm run build must no longer log anything about seeding data.json."
    gotcha: "Read the file as it stands before deleting — task 3.6 already edited the copy loop above this region, so the line numbers quoted here may have shifted by zero lines but the loop's contents have changed. Anchor on the comment's first line, not on a line number."
    verify:
      - "npm run build — no `seeded data.json` and no `skipped data.json` line in the output."
      - "grep -n 'data.json' tools/copy-assets.mjs — returns nothing."
      - "test -f dist/public/index.html && test -f dist/public/board.html && test -f dist/public/styles.css && echo copier-still-works"
    checklist:
      - "Are the seeding branch and its comment both gone?"
      - "Does the copy loop still copy index.html, board.html and styles.css?"
      - "Does the build output contain no data.json log line?"
      - "Are all four imports still used by the remaining code?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 4.4 Delete `src/public/data.json`
    ```yaml
    description: "The committed 281KB LAD snapshot has no consumer once the board fetches the API. Removing it reverses WS-1 acceptance criterion 9 and WS-2 acceptance criterion 10 deliberately; the out-of-box promise is kept by task 4.5's pre-registered self-entry."
    issues: []
    implement:
      - "Run: git rm src/public/data.json"
      - "Do this only AFTER tasks 4.1 and 4.3 have landed — the board must already be fetching the API and the copier must already have stopped seeding, or the intermediate state serves a board with no data."
      - "This is the single act in the whole plan that git revert alone does not fully undo in place; it is recoverable from history, which is why it lands in the last reversible phase."
    pattern: "src/public/data.json (deleted)"
    imports: "None."
    compatibility: "PLN-4 Open Question 1's committed default. Do not replace it with a smaller fixture, a sample file, or a .gitkeep."
    gotcha: "A stale dist/public/data.json may still be on disk from an earlier build and will keep being served at /data.json — harmless, since nothing requests it, and it disappears on the next rm -rf dist. Do not add a clean step for it; the plan explicitly keeps the no-clean-script decision."
    verify:
      - "git status --porcelain — shows the deletion staged."
      - "git ls-files src/public — no longer lists data.json (Phase 4 verify 9)."
      - "npm run build && npm start — a tile's board still renders, now from the API."
    checklist:
      - "Was the file removed with git rm rather than a plain filesystem delete?"
      - "Did tasks 4.1 and 4.3 land before this deletion?"
      - "Does git ls-files src/public no longer list data.json?"
      - "Was no replacement fixture, sample or placeholder added in its place?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 4.5 `src/lib/projects.ts` — pre-register the dashboard repo's own root when the registry is absent
    ```yaml
    description: "readProjects() returns a single self-entry for this repo when .praxis-projects.json does not exist, so a fresh clone shows one tile whose board renders live from this repo's own flowcharge/."
    issues: []
    implement:
      - "In src/lib/projects.ts, change readProjects() so that when the registry file is absent it returns a single-element array containing a ProjectEntry for the dashboard repo's own root, built through the same projectId/basename logic every other entry uses so its id is stable and its board URL is bookmarkable."
      - "The repo root is the same __dirname-relative location the registry file itself resolves to — the directory containing .praxis-projects.json. Derive both from one constant so they cannot drift apart."
      - "Once the registry file exists, this default no longer applies: a file present but containing an empty projects array means the user has an empty list, and readProjects() returns [] rather than re-injecting the self-entry."
      - "Keep the unreadable/unparseable-file path returning [] as task 2.2 established — a corrupted registry degrades to the empty list, never to an error and never to the self-entry."
      - "Do not add a `builtin` or `default` flag to ProjectEntry. The shape stays exactly the four fields task 2.1 declared; the home page must not distinguish the self-entry from a user-added one."
    pattern: "src/lib/projects.ts — readProjects() only. The other three exported functions are unchanged."
    imports: "None new."
    compatibility: "Acceptance criterion 19 — a fresh clone followed by npm install && npm start shows a home page with one working tile whose board renders populated. addProject must keep working: adding a project writes the whole file back, at which point the self-entry stops being synthesised, so the first user-added project must not silently displace the repo's own tile if the user still wants it — that is accepted behaviour per the plan, not a bug to solve."
    gotcha: "The `added` date for a synthesised self-entry is computed at read time, so it shows today's date on every fresh clone. That is acceptable and requires no persistence. The path must be the REPO root — see task 2.2's gotcha about the plan's __dirname arithmetic; from dist/lib/projects.js that is path.join(__dirname, '..', '..'), not one level up. findProject() reads through readProjects(), so the self-entry becomes findable by id for free — verify that, because the board URL for the fresh-clone tile depends on it."
    verify:
      - "npm run build, then: rm -f .praxis-projects.json && npm start; open / — one tile for this repo appears."
      - "Click it: the board renders this repo's own workstreams, populated."
      - "curl -s http://127.0.0.1:4173/api/projects — returns one entry whose path is the repo root and whose id is 8 hex chars."
      - "Add a different project through the form, then curl /api/projects again — the registry file now exists and the returned list reflects the file, with the self-entry no longer synthesised."
    checklist:
      - "Does readProjects() return exactly one self-entry when the registry file is absent?"
      - "Does the self-entry's path resolve to the repo root rather than dist/?"
      - "Is the self-entry findable via findProject(id), so its board URL works?"
      - "Does a present-but-empty registry file return [] rather than the self-entry?"
      - "Does an unreadable or malformed registry file still return [] without throwing?"
      - "Is ProjectEntry still exactly the four fields, with no added flag?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 4.6 Phase 4 verification gate — including the board behavioural pass
    ```yaml
    description: "Run the plan's nine Phase 4 checks, including the manual behavioural pass against a capture taken before Phase 3. Do not start Phase 5 until every check passes."
    issues: []
    implement:
      - "Run the verify sequence below in order with npm start running."
      - "Check 2 is the board's only regression test. Compare against a screenshot or note capture of the board taken BEFORE Phase 3 — if none was taken, take the comparison against git stash / a checkout of the pre-Phase-3 commit before proceeding. This manual pass is acceptable ONLY because the two-document design left app.ts's 333 lines structurally untouched."
      - "Check 7 is destructive to local state: it removes dist, node_modules and .praxis-projects.json. Run it last, and be prepared to re-add any locally registered projects afterwards."
    pattern: "No source edits. Verification only, across src/public/app.ts, board.html, tools/copy-assets.mjs, src/lib/projects.ts and the deleted src/public/data.json."
    imports: "A browser, git, npm."
    compatibility: "Settles acceptance criteria 7, 8, 11, 12 and 19, and confirms 13 still holds after four phases."
    gotcha: "Check 4's live-data assertion is the criterion that on-demand extraction exists to deliver — if a reload does not show the frontmatter edit, something cached the payload, most likely a dropped { cache: 'no-store' } in task 4.1. Check 6 must leave the server running; a crash there means an API branch is missing its try/catch."
    verify:
      - "Click a tile: the board renders that project's data. The masthead tagline names it (it already derives from raw.source, so this needs no code — confirm it is right)."
      - "Behavioural pass against a capture taken before Phase 3: all four KPI cards with the same values and bar segments, all six columns with the same card counts, both sort toggles, both direction toggles, the search box filtering and the result count updating, the severity legend, the attention panel. Console clean (acceptance criterion 7)."
      - "Register a second project and confirm its board shows different data, and that going home and into the first one again shows the first project's data."
      - "Live data: edit a workstream's `status` in a registered project's flowcharge/, reload the board, confirm the card moved column — with no npm run refresh (acceptance criterion 8)."
      - "/board.html with no parameter, and with ?project=deadbeef: guidance panel with a link home, in both cases. No uncaught error (acceptance criterion 11)."
      - "Rename a registered project's flowcharge/ aside and open its board: the 410 message is shown and the server survives. Rename it back (acceptance criterion 12)."
      - "Fresh-clone simulation: rm -rf dist node_modules .praxis-projects.json && npm install && npm start → home page with one tile for this repo, whose board renders populated (acceptance criterion 19)."
      - "npm run refresh -- --root <dir> still succeeds and still writes dist/public/data.json; npm run build no longer logs anything about seeding data.json (acceptance criterion 13)."
      - "git status clean; git ls-files src/public no longer lists data.json."
    checklist:
      - "Does the board match the pre-Phase-3 capture across all four KPI cards, all six columns, both toggle pairs, the search count, the severity legend and the attention panel?"
      - "Does a frontmatter edit plus a reload change the board with no npm run refresh in between?"
      - "Do the no-parameter and unknown-id cases both show the guidance panel with no uncaught error?"
      - "Does the 410 case display its message with the server still running?"
      - "Does the fresh-clone simulation produce one working tile with a populated board?"
      - "Does npm run refresh still write dist/public/data.json, and is git status clean?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 5. Phase 5 — Documentation

  ```yaml
  description: "README, the extractor's header and usage text, and a read-through of board.html's footer. All documentation, no logic. Depends on Phase 4."
  ```

  - [x] 5.1 Rewrite `README.md` for the multi-project model
    ```yaml
    description: "Quick start, the out-of-box paragraph, the directory tree, the Scripts table and the Notes list all describe a single-project, data.json-fed dashboard that no longer exists."
    issues: []
    implement:
      - "Quick start (lines 15-19): becomes npm install → npm start → add a project in the UI. The npm run refresh line is no longer a step and comes out of the block. Keep the following paragraph about npm install being a genuine prerequisite — it is still true."
      - "Rewrite the committed-snapshot paragraph (lines 24-28) entirely. It currently explains the src/public/data.json seed and the copy-if-absent rule. It now describes the pre-registered self-entry: with no registry file, the home page shows one tile for this repo, whose board renders live from the dashboard's own flowcharge/."
      - "Update the directory tree (lines 32-53): add src/lib/ with extract.ts and projects.ts; add src/public/board.html and src/public/home.ts; remove the src/public/data.json line; update the copy-assets.mjs description, which no longer seeds anything; update the dist/ listing, which now holds lib/, public/index.html, public/board.html, public/app.js and public/home.js and no longer holds a data.json the board reads."
      - "Add .praxis-projects.json to the tree with a line saying it is the machine-local registry and gitignored."
      - "Scripts table (lines 61-67): describe npm run refresh as a standalone JSON dump of a project's Praxis state that no longer feeds the board. Keep npm run build and npm start rows accurate, including the PORT override."
      - "Notes (lines 69-81): rewrite the no-clean-script bullet, which currently says the next build reseeds dist/public/data.json from the committed demo snapshot — no longer true. Add a line recording that the API reads any registered project's directory and that the server binds 127.0.0.1, so it is reachable only from this machine (PLN-4 Open Question 2's committed default). Keep the zero-runtime-dependency bullet and the “Needs attention” bullet as they are."
      - "Do not document a project-removal flow, per-tile summaries, or ~ expansion — none of them exist and the plan explicitly declines all three."
    pattern: "README.md"
    imports: "None."
    compatibility: "Every path the README names must exist after npm run build — that is this phase's verify. The README is the only place the pre-registered self-entry and the localhost bind get explained to a reader."
    gotcha: "The tree currently ends dist/public/ with `index.html, styles.css, app.js, data.json` on one line — that line needs both new files and the removal. Read the file fresh before editing; tasks 4.x changed nothing in it but the line numbers quoted here are from the pre-Phase-1 state and the file has not been touched since, so they should still hold."
    verify:
      - "npm run build, then check every path named in the README exists: for each path in the tree, test -e it."
      - "Run the three quick-start commands as written from a fresh clone."
      - "grep -rn 'data\\.json' README.md — only the extractor's own default-output references remain."
      - "grep -n 'refresh' README.md — every mention describes a standalone dump, not the board's feed."
    checklist:
      - "Does the quick start consist of npm install, npm start and adding a project in the UI, with no npm run refresh step?"
      - "Does the out-of-box paragraph describe the pre-registered self-entry rather than a committed snapshot?"
      - "Does the directory tree list src/lib/, board.html, home.ts and .praxis-projects.json, and omit src/public/data.json?"
      - "Does the Scripts table describe npm run refresh as a standalone JSON dump?"
      - "Do the Notes record the 127.0.0.1 bind and that the API reads any registered project's directory?"
      - "Does every path named in the README exist after a build?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 5.2 `src/scripts/extract-praxis-data.ts` — correct the header comment and `usage()` text
    ```yaml
    description: "The header says the script writes the file 'for the dashboard to fetch'. That is no longer true. Correct it and the usage text to present the script as a standalone JSON dump."
    issues: []
    implement:
      - "Rewrite the header comment (lines 2-7). It currently reads: 'Reads a Praxis project's flowcharge/ frontmatter and writes dist/public/data.json for the dashboard to fetch. Source of truth is always the frontmatter files themselves — this script never writes back to the project it reads.' Keep the second sentence, which is still true and still worth stating; replace the first so it describes dumping a project's Praxis state to a JSON file, with no claim about the dashboard fetching it."
      - "Keep the Usage line in the header showing npm run refresh -- --root <dir>."
      - "Update usage() (lines 27-36): the title line and the --out description still say the output default is dist/public/data.json, which remains factually correct as a default path — keep it, but make the surrounding text present the command as a standalone dump rather than a step the dashboard depends on."
      - "Change no behaviour: parseArgs, the exit codes, the default --out expression, the extractPraxisData call and the success log line all stay exactly as task 1.3 left them. This task edits comment text and console.log strings only."
      - "The printed usage must name a command that runs verbatim — copy it from usage() and run it to confirm."
    pattern: "src/scripts/extract-praxis-data.ts — the header comment block and the usage() template literal."
    imports: "None."
    compatibility: "Acceptance criterion 13 — --root, --out and --help semantics and exit codes stay unchanged. This is a text-only edit."
    gotcha: "usage() is a template literal with deliberate leading and trailing newlines and two-space indentation on the option lines; preserve that shape or the printed help reflows. Do not remove the CLI or mark it deprecated — keeping it standalone-usable is an explicit plan exclusion."
    verify:
      - "npm run build — compiles clean."
      - "npm run refresh -- --help; echo $? — prints the revised usage, exits 0."
      - "Copy the command shown in the printed usage, substitute a real project directory, run it verbatim — it succeeds."
      - "grep -n 'for the dashboard to fetch' src/scripts/extract-praxis-data.ts — returns nothing."
    checklist:
      - "Is the 'for the dashboard to fetch' claim gone from the header?"
      - "Is the 'never writes back to the project it reads' sentence retained?"
      - "Does --help still exit 0 and print correctly formatted usage?"
      - "Does the command printed by usage() run verbatim?"
      - "Are parseArgs, the exit codes and the default --out expression all behaviourally unchanged?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 5.3 `src/public/board.html` — read-through of the footer on the rendered page
    ```yaml
    description: "Confirm task 4.2's footer edit reads correctly to a human on the rendered board, and correct the wording if it does not."
    issues: []
    implement:
      - "Open a project's board in a browser and read the footer as a first-time reader would."
      - "If it reads awkwardly, names a mechanism that no longer exists, or leaves the reader unsure where the data comes from, revise the wording in src/public/board.html."
      - "This is a wording pass only. Do not change the footer's markup shape, its class names, or any other part of the document."
      - "If the footer already reads well, make no edit and record that in the task result."
    pattern: "src/public/board.html — the <footer class=\"note\"> block only."
    imports: "None."
    compatibility: "footer.note and its nested <code> rules are styled at styles.css lines 411-422; keep the element and class names so the styling continues to apply."
    gotcha: "This task may legitimately end with no diff. That is a pass, not a skipped task — record the read-through as done."
    verify:
      - "npm start, open a project's board, read the rendered footer end to end."
      - "grep -n 'data\\.json\\|npm run refresh' src/public/board.html — still returns nothing."
      - "If edited: npm run build && reload, and confirm the footer still renders with its usual styling."
    checklist:
      - "Was the footer read on the rendered page rather than only in the source?"
      - "Does it name only mechanisms that currently exist?"
      - "Is the markup shape and class name unchanged?"
      - "Does the footer still render with its usual styling if it was edited?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 5.4 Phase 5 verification gate
    ```yaml
    description: "Run the plan's Phase 5 checks — every README path exists, the quick-start commands run as written, the printed usage command runs verbatim, and no stale data.json reference survives outside the extractor's own default."
    issues: []
    implement:
      - "Run the verify sequence below with a built tree."
      - "The final grep is the phase's completeness test: any data.json hit outside src/scripts/extract-praxis-data.ts's own --out default is a documentation miss from tasks 5.1 or 5.2, or a leftover from Phase 4."
    pattern: "No source edits. Verification only, across README.md, src/scripts/extract-praxis-data.ts and src/public/board.html."
    imports: "npm, grep."
    compatibility: "Closes out the whole list. When this passes and every task line is [x], set the frontmatter status to done and regenerate the Praxis index."
    gotcha: "The fresh-clone quick-start check must run in a clean checkout or after rm -rf dist node_modules, or a warm dist/ will mask a missing build step."
    verify:
      - "npm run build, then confirm every path named in the README exists."
      - "Run the three quick-start commands as written, from a fresh clone."
      - "npm run refresh -- --help prints a command that runs verbatim."
      - "grep -rn 'data\\.json' README.md src/ tools/ — returns only the extractor's own default-output references."
    checklist:
      - "Does every path named in the README exist after npm run build?"
      - "Do the three quick-start commands run as written from a fresh clone?"
      - "Does the command printed by npm run refresh -- --help run verbatim?"
      - "Does the final grep return only the extractor's own default-output references?"
      - "Are all twenty acceptance criteria now settled across the five phase gates?"
    self_eval:
      passed: true
      failures: []
    ```
