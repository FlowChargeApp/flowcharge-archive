---
id: TL-4-krbzfv
type: tasklist
workstream: WS-1-bacexa
slug: typescript-source-conversion
title: "Convert all three source files to TypeScript with tsc emitting a served dist/ build"
status: done
created: 2026-08-05
updated: 2026-08-05
depends_on: [PLN-3-xh05c7]
links: []
mode: spec
base_commit: e804e34
---

# PRX Tasks

## Convert all three source files to TypeScript with tsc emitting a served dist/ build

Implements PLN-3. Three hand-written files — `src/server.js`, `src/scripts/extract-praxis-data.mjs`,
`src/public/app.js` — become TypeScript, compiled by `tsc` into a new gitignored `dist/` that mirrors
`src/`'s shape. Because the tree mirrors, `server.ts`'s `path.join(__dirname, 'public')` and the
extractor's `path.join(__dirname, '..', 'public', 'data.json')` re-point themselves to the served
location purely by being compiled into `dist/` — **neither expression is edited**, exactly the trick
WS-2 used for its relocation.

Two compiler configurations, co-located with what they govern: `tsconfig.json` at the root for the
Node side, `src/public/tsconfig.json` for the browser side. They are separate because `app.ts` needs
`lib: ["dom"]` and must never see `@types/node`, while the other two need the opposite. Two helpers
cover what `tsc` cannot do: `tools/copy-assets.mjs` copies non-TS assets (and stays plain ESM — it
must run before any compilation exists), and `src/types/praxis-data.d.ts` is an ambient declaration
file shared by both compilations, making producer/consumer drift on `data.json` a compile error.

`dist/public/data.json` is **seeded** from the committed `src/public/data.json` snapshot only when
absent, never overwritten. That single rule is what lets a fresh clone show a populated board while
`npm run refresh` writes straight to the served file without ever being clobbered by the next build.

**The governing rule wherever `strict` creates friction: assert, don't coerce.** Where the existing
code already assumes a value is present, the TypeScript version asserts it (`!`, `as`) rather than
inserting a fallback (`??`), because a fallback is a runtime behaviour change and behaviour
preservation is a hard requirement of this plan. PLN-3's Design section carries the authoritative
list of assertion sites; these tasks quote it rather than re-deriving it.

Five phases, strictly ordered. Every phase ends with `npm start` serving a working board. Phases 1
and 2 carry all the structural risk, 3 and 4 are conversion, 5 is text. Phase 1 leaves one documented
transient state: `refresh` still writes to `src/public/data.json`, which the seed rule will not pick
up, and Phase 2 closes it one commit later.

Out of scope throughout, per PLN-3: no test framework, no linter, no formatter, no bundler, no
runtime validation of `data.json`, no schema or content change to the payload, no UI or feature
change in `app.ts`, no conversion of `app.ts` to an ES module, no `clean` script, no rename of
`src/public/data.json`, no project-references tsconfigs, and no re-touching of WS-2's `src/`
relocation or WS-4's completed CSS work. `styles.css` is copied verbatim and never opened.

- [x] 1. Stand up the toolchain and move the server into dist/ (Phase 1)

  ```yaml
  description: "Install the two devDependencies, add the root tsconfig, convert server.js to TypeScript, add the asset-copy helper with its seed-if-absent rule, and re-point both npm start and the launch config through the new build. Ends with the board served from dist/."
  ```

  - [x] 1.1 Install `typescript` and `@types/node` as devDependencies
    ```yaml
    description: "Add exactly the two devDependencies the plan permits, and commit the resulting package-lock.json."
    issues: []
    implement:
      - "From the repo root run: npm install --save-dev typescript @types/node"
      - "The plan pins the ranges as typescript ^5 and @types/node ^22 — if npm resolves something outside those major versions, record it rather than silently accepting it."
      - "Commit package-lock.json. It is a tracked file from this point on (acceptance criterion 10)."
      - "Do not add any runtime dependency, bundler, linter, formatter, or test framework. Exactly two devDependencies exist after this task (acceptance criterion 13)."
      - "Do not change the engines block. node >=18 stays as it is (acceptance criterion 12)."
    pattern: "package.json, package-lock.json (repo root)"
    imports: "npm; network access for the two packages"
    compatibility: "The repo goes from zero-install to two devDependencies — that is intrinsic to the feature and is documented in Phase 5, not worked around. package.json keeps type: module and private: true untouched."
    gotcha: "npm install rewrites package.json's key order around the scripts block; task 1.6's edit is anchored on the two script lines only, so run it after this task and re-read the file first. A .npmrc or registry proxy that resolves typescript to a 4.x line would break the strict-mode assumptions the plan makes — check the installed version."
    verify:
      - "node -e \"const p=require('./package.json');console.log(Object.keys(p.devDependencies||{}),p.dependencies,p.engines)\" — devDependencies holds exactly typescript and @types/node, dependencies is undefined, engines.node is >=18."
      - "npx tsc --version prints a 5.x version."
      - "git status shows package.json and package-lock.json modified/added and nothing else unexpected."
    checklist:
      - "Are there exactly two devDependencies, typescript and @types/node?"
      - "Is the dependencies key still absent (no runtime dependency added)?"
      - "Is engines.node still >=18?"
      - "Is package-lock.json present and staged for commit?"
      - "Does npx tsc report a 5.x version?"
    self_eval:
      passed: true
      failures:
        - item: "Does npx tsc report a 5.x version?"
          reason: "A bare npm install --save-dev typescript @types/node resolved typescript ^7.0.2 and @types/node ^26.1.2, outside the plan's pinned typescript ^5 and @types/node ^22 majors."
          fix: "Re-installed against the plan's pins: npm install --save-dev typescript@^5 @types/node@^22, giving typescript ^5.9.3 and @types/node ^22.20.1. npx tsc now reports 5.9.3 and the checklist item passes."
    ```
  - [x] 1.2 Add `dist/` to `.gitignore`
    ```yaml
    description: "Ignore the generated build output so no file under dist/ is ever tracked (acceptance criterion 10)."
    issues: []
    implement:
      - "Append a single line, dist/, to .gitignore. The file currently holds node_modules/, .DS_Store and *.log — leave all three exactly as they are and do not reorder them."
      - "Append only; do not rewrite the file."
    pattern: ".gitignore (repo root)"
    imports: "None"
    compatibility: "The ignore entry must be dist/ with the trailing slash, matching the existing node_modules/ convention in this file."
    gotcha: "Ignoring dist/ does nothing if a file under it is already tracked — nothing is at this point, but if a build ran before this task, confirm with git ls-files dist."
    verify:
      - "git check-ignore -v dist/server.js reports the new .gitignore rule."
      - "git ls-files dist returns nothing."
    checklist:
      - "Does .gitignore contain a dist/ line?"
      - "Are the three pre-existing entries unchanged?"
      - "Does git ls-files dist return empty?"
      - "Was the file appended to rather than rewritten?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.3 Add the root `tsconfig.json` for the Node side
    ```yaml
    description: "Create the Node-side compiler configuration exactly as PLN-3's Design section specifies, with rootDir src and outDir dist so the compiled tree mirrors the source tree."
    issues: []
    implement:
      - |
        Create `tsconfig.json` at the repo root with exactly this content (transcribed from PLN-3's
        Design section — do not re-derive the options; the trailing comments are optional but the
        option values are not):

        {
          "compilerOptions": {
            "target": "es2022",
            "lib": ["es2022"],
            "module": "node16",
            "moduleResolution": "node16",
            "esModuleInterop": true,     // keeps `import http from 'node:http'` compiling unchanged
            "types": ["node"],
            "rootDir": "src",
            "outDir": "dist",
            "strict": true,
            "noEmitOnError": true,
            "skipLibCheck": true
          },
          "include": ["src/server.ts", "src/scripts/**/*.ts", "src/types/**/*.d.ts"]
        }
      - "The include list deliberately names src/scripts/**/*.ts and src/types/**/*.d.ts even though nothing matches them yet — Phases 2 and 3 fill them in and the config is not revisited."
      - "Do not add composite, declaration, references, or a .tsbuildinfo path. Open Question 1's committed default is two co-located configs, not project references."
    pattern: "tsconfig.json (repo root, new file)"
    imports: "typescript (installed in 1.1)"
    compatibility: "module: node16 is what makes import.meta.url legal and what makes the emitted dist/*.js ESM — correct, because the root package.json carries type: module and dist/ inherits it. esModuleInterop exists specifically to keep the three existing default imports (http, fs, path) valid against @types/node without rewriting them to namespace imports. rootDir src + outDir dist is what preserves __dirname-relative paths without editing them."
    gotcha: "tsc errors with 'No inputs were found' only when every include pattern is empty — src/server.ts exists after 1.4, so run the first build after that task, not this one. Do not set rootDir to the repo root: dist would then gain a src/ level and every __dirname path expression would break."
    verify:
      - "npx tsc -p tsconfig.json --showConfig prints the resolved options with rootDir src, outDir dist, strict true and noEmitOnError true."
      - "Confirm the file parses as JSON with comments (tsc accepts JSONC; a plain JSON.parse will not, which is expected)."
    checklist:
      - "Do all eleven compilerOptions match the plan's values exactly?"
      - "Is rootDir src and outDir dist?"
      - "Are strict and noEmitOnError both true?"
      - "Does include name exactly the three patterns the plan lists?"
      - "Is composite/declaration/references absent?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.4 Convert `src/server.js` to `src/server.ts`
    ```yaml
    description: "Rename the server to TypeScript and add exactly two annotations — MIME as Record<string, string> and the req.url assertion — changing no path expression and no logic."
    issues: []
    implement:
      - "git mv src/server.js src/server.ts — a rename, never a delete-and-recreate."
      - "Annotate the MIME table at line 10: const MIME: Record<string, string> = { ... }. The six entries and their values are untouched; the annotation exists so the string indexing at line 37 (MIME[ext]) is legal."
      - "At line 20, assert req.url rather than coercing it: change req.url.split('?')[0] to req.url!.split('?')[0], with a one-line comment recording why. Under @types/node req.url is string | undefined; it is always populated for http.createServer requests. Today an undefined value throws — a ?? '/' fallback would silently serve index.html instead, which is a behaviour change and is forbidden."
      - "Change nothing else. In particular do not touch line 6-7's __dirname/root computation, the traversal guard at 24, the port handling at 8, or the response headers (acceptance criterion 14)."
      - "Add no other annotation unless tsc demands one; if it does, record which and why, since the plan's assertion table lists these two sites and no others for this file."
    pattern: "src/server.js -> src/server.ts"
    imports: "node:http, node:fs, node:path, node:url (all already imported; none change)"
    compatibility: "The four default/named imports stay exactly as written — esModuleInterop in the root tsconfig is what keeps them valid. The emitted dist/server.js must remain ESM, which module: node16 plus the root package.json type: module guarantees."
    gotcha: "The traversal guard's semantics depend on root being derived from __dirname; leaving that expression alone is what keeps them identical under dist/. tsc may also flag process.env.PORT — it should not, since the ternary already narrows it, so an error there means the config is wrong rather than the code."
    verify:
      - "npx tsc -p tsconfig.json exits 0 and writes dist/server.js."
      - "diff dist/server.js <(git show HEAD:src/server.js) — the only differences are the removed type annotation on MIME and the ! on req.url. Nothing else moved. (Use HEAD~1 instead once the phase is committed.)"
      - "grep -n \"__dirname\" dist/server.js shows the same path.join(__dirname, 'public') expression as the original."
    checklist:
      - "Did the file move as a git rename rather than a delete plus add?"
      - "Is MIME annotated as Record<string, string> with its six entries unchanged?"
      - "Is req.url asserted with ! rather than given a fallback?"
      - "Are the __dirname/root, port, traversal-guard and header lines byte-identical to the original?"
      - "Does the emit diff against the original contain only those two differences?"
    self_eval:
      passed: true
      failures:
        - item: "Does the emit diff against the original contain only those two differences?"
          reason: "Both annotations erase as expected, but a raw diff is not confined to them: tsc normalises indentation to four spaces and strips blank lines, and the one-line comment this task mandated at the req.url assertion travels into the emit."
          fix: "None required. Verified with diff -w -B (whitespace- and blank-line-insensitive), which reduces the emit difference to the single mandated comment line. No logic, path expression or header differs."
    ```
  - [x] 1.5 Add `tools/copy-assets.mjs`
    ```yaml
    description: "Add the plain-ESM asset copier that moves the non-TS files into dist/public/, seeding data.json only when it is absent. Roughly 25 lines; it is the only new file with logic."
    issues: []
    implement:
      - "Create tools/copy-assets.mjs. It stays plain ESM JavaScript and is NOT converted to TypeScript — it has to run before any compilation exists, and compiling the build script with the build script is circular. It lives in tools/ rather than src/ (which now means compiled application source) and rather than the repo root (which WS-2 spent a workstream clearing)."
      - |
        Implement exactly this four-line contract and nothing more:
          1. ensure `dist/public/` exists;
          2. copy `src/public/index.html`, `src/public/styles.css` and `src/public/app.js` into
             `dist/public/`, overwriting;
          3. copy `src/public/data.json` to `dist/public/data.json` **only if the destination is
             absent**;
          4. log each action, including whether `data.json` was seeded or skipped.
      - "The app.js entry in step 2 is temporary: during Phases 1-3 the browser file is still plain JavaScript and travels as an asset. Task 4.4 removes it once tsc compiles it instead."
      - "Resolve every path from the script's own import.meta.url, matching the cwd-independence convention the repo already uses in server.js (lines 6-7) and the extractor (line 13). Do not resolve anything against process.cwd()."
      - "Add a comment at the data.json step recording that src/public/data.json is a seed fixture, not the live artefact: after the first build it never changes again, and npm run refresh writes to dist/public/data.json instead."
      - "The script knows file paths and nothing else. It must never learn to generate, merge, inspect or validate data.json's contents, and it must never delete or wipe dist/."
    pattern: "tools/copy-assets.mjs (new file)"
    imports: "node:fs, node:path, node:url — builtins only, no dependency"
    compatibility: "Plain ESM, run by node directly as part of the build chain; the root package.json's type: module makes .mjs redundant but harmless and matches the extractor's existing extension convention. It must not be added to either tsconfig's include."
    gotcha: "Copying data.json unconditionally is the one genuinely dangerous mistake available here — prestart runs build before every npm start, so an unconditional copy would overwrite freshly refreshed data with the frozen demo snapshot and the board would silently show stale dates. The existsSync check is load-bearing. Equally, do not add a wipe of dist/: assumption 6 forbids it for the same reason."
    verify:
      - "node tools/copy-assets.mjs from the repo root creates dist/public/ and logs four actions, one of which reports data.json seeded."
      - "Run it a second time: the log now reports data.json skipped, and the destination file's mtime is unchanged."
      - "Run it from a different cwd (cd / && node /abs/path/tools/copy-assets.mjs) and confirm it still writes into the repo's dist/public/."
    checklist:
      - "Does the script copy index.html, styles.css and app.js unconditionally?"
      - "Does it copy data.json only when the destination does not exist?"
      - "Does it log every action, distinguishing seeded from skipped?"
      - "Are all paths resolved from import.meta.url rather than process.cwd()?"
      - "Is the file plain ESM JavaScript, excluded from both tsconfigs, with no dependency?"
      - "Does it avoid deleting or wiping anything under dist/?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.6 Re-point `package.json`'s build and start scripts
    ```yaml
    description: "Add build and prestart, and change start to run the compiled server. refresh stays pointed at the .mjs extractor until Phase 2."
    issues: []
    implement:
      - "Re-read package.json first — task 1.1's npm install has rewritten parts of it since this block was authored."
      - "Apply this edit, which inserts build and prestart above start and re-points start at the compiled server. It is anchored on the two script lines alone, so npm install's rewrite of the surrounding keys cannot break it."
      - |
        package.json
        <<<<<<< SEARCH
            "start": "node src/server.js",
            "refresh": "node src/scripts/extract-praxis-data.mjs"
        =======
            "build": "tsc -p tsconfig.json && node tools/copy-assets.mjs",
            "prestart": "npm run build",
            "start": "node dist/server.js",
            "refresh": "node src/scripts/extract-praxis-data.mjs"
        >>>>>>> REPLACE
      - "build names only the Node config and the asset copy for now — task 4.5 adds the browser compilation once src/public/tsconfig.json exists."
      - "Do not add a typecheck script: build already type-checks, and a second entry point for the same work is duplication. Do not add a clean script (Open Question 3's committed default is no script)."
    pattern: "package.json (repo root)"
    imports: "None beyond the devDependencies from 1.1"
    compatibility: "npm runs pre<script> before any script of that name, so npm start builds first and stays a single command (acceptance criterion 3). tsc exits non-zero on a type error so the && chain stops, and noEmitOnError additionally prevents partial output."
    gotcha: "This phase leaves a documented transient state: npm run refresh still writes to src/public/data.json while the board serves dist/public/data.json, which the seed rule will not overwrite. It is the one phase boundary where a refresh does not reach the board, and task 2.3 closes it. Do not fix it early by editing refresh here. The SEARCH text was copied from package.json as read at base_commit e804e34; if it fails to match, re-read the scripts block and re-anchor against what the file actually says rather than approximating."
    verify:
      - "npm run build exits 0 and creates dist/server.js plus dist/public/{index.html,styles.css,app.js,data.json}."
      - "npm start builds first (build output appears before the listening line) and serves http://localhost:4173."
    checklist:
      - "Does build run the Node tsconfig and then copy-assets, in that order, joined by &&?"
      - "Does prestart run npm run build?"
      - "Does start run node dist/server.js?"
      - "Is refresh still pointed at src/scripts/extract-praxis-data.mjs?"
      - "Were no typecheck or clean scripts added?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.7 Route `.claude/launch.json` through `npm start`
    ```yaml
    description: "Change the praxis-dashboard configuration to launch via npm so the prestart build hook fires for the preview too."
    issues: []
    implement:
      - "Apply this edit:"
      - |
        .claude/launch.json
        <<<<<<< SEARCH
              "runtimeExecutable": "node",
              "runtimeArgs": ["src/server.js"],
        =======
              "runtimeExecutable": "npm",
              "runtimeArgs": ["start"],
        >>>>>>> REPLACE
      - "Leave name and port exactly as they are."
      - "Do not point runtimeArgs at dist/server.js instead: that would preserve the current shape but reintroduce the failure WS-2 warned about, a preview silently serving stale or missing output when someone forgets to build."
    pattern: ".claude/launch.json"
    imports: "None"
    compatibility: "npm as runtimeExecutable is the documented form for this config file. Port stays 4173, matching server.ts's default."
    gotcha: "If the preview is already running from the old configuration it must be restarted to pick up the change — a stale attached process will keep serving from src/public/ and mask the result. The SEARCH text was copied from .claude/launch.json as read at base_commit e804e34; if it fails to match, re-read the configuration entry and re-anchor rather than approximating."
    verify:
      - "Launch the praxis-dashboard configuration and confirm the build runs first and the preview reaches a working board at :4173 (acceptance criterion 11)."
    checklist:
      - "Is runtimeExecutable npm?"
      - "Is runtimeArgs exactly [start]?"
      - "Are name and port unchanged?"
      - "Does launching the configuration produce a build followed by a working board?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.8 Phase 1 verification pass
    ```yaml
    description: "Run PLN-3's nine Phase 1 verify steps end to end — the build, the emit-parity diff, the served board, the fresh-clone simulation, graceful degradation, the seed-not-clobbered rule, the type-error gate, the launch config, and a clean git status."
    issues: []
    implement:
      - "Run each verify step below in order and record its result. Any failure is a defect in tasks 1.1-1.7, not something to work around here."
      - "If step 2's diff shows anything beyond the two annotation differences, revert the extra change rather than accepting it — emit parity is the plan's primary regression evidence."
    pattern: "Whole repo; no file is edited by this task"
    imports: "npm, git, a browser at http://localhost:4173"
    compatibility: "These nine steps are PLN-3's Phase 1 verify block verbatim, and they carry acceptance criteria 3, 8, 9, 10, 11 and 14."
    gotcha: "Step 2's git show reference depends on whether the phase has been committed yet: use HEAD:src/server.js before the commit, HEAD~1:src/server.js after. Step 6 must confirm the copier's log actually says it skipped the seed, not merely that the file looks unchanged."
    verify:
      - "npm run build creates dist/server.js and dist/public/{index.html,styles.css,app.js,data.json}."
      - "diff dist/server.js <(git show HEAD~1:src/server.js) — differences confined to the removed type annotations and the ! on req.url."
      - "npm start serves the board at :4173 rendering as before; styles.css, app.js and data.json all return 200 with correct Content-Type; browser console clean."
      - "Fresh-clone simulation: rm -rf dist && npm start gives a populated board from the seeded snapshot."
      - "Graceful degradation: rm dist/public/data.json, hard-reload, the 'Couldn't load data.json' panel appears with refresh instructions; then npm start again and confirm the seed restores it."
      - "Seed is not clobbered: modify dist/public/data.json, run npm run build, confirm the file is untouched and the log says it skipped the seed."
      - "Introduce a deliberate type error in server.ts; npm run build exits non-zero and dist/server.js is not rewritten. Revert the error."
      - "Launch the praxis-dashboard configuration from .claude/launch.json and confirm the preview builds and reaches a working board."
      - "git status shows no dist/ entry."
    checklist:
      - "Did all six expected files appear under dist/?"
      - "Is the server emit diff confined to the two documented differences?"
      - "Did the board render with a clean console and all three assets at 200?"
      - "Did the absent-data.json panel appear, and did the next build reseed it?"
      - "Did a deliberate type error make the build exit non-zero without rewriting output?"
      - "Is dist/ absent from git status?"
    self_eval:
      passed: true
      failures:
        - item: "Did all six expected files appear under dist/?"
          reason: "Phase 1 emits five files (dist/server.js and dist/public/{index.html,styles.css,app.js,data.json}), not six. The same task's verify step 1 enumerates exactly those five, so the checklist wording over-counts by one."
          fix: "None required. The sixth file, dist/scripts/extract-praxis-data.js, arrives with the extractor conversion in task 2.2. All five files expected at this phase appeared."
    ```

- [x] 2. Convert the extractor and re-point refresh (Phase 2)

  ```yaml
  description: "Move the extractor to TypeScript with an Args interface, a typed parseFrontmatter, the fmStr helper and a typed entry, then re-point npm run refresh at the compiled output so a refresh reaches the served board again. Byte-identical output is the decisive check."
  ```

  - [x] 2.1 Capture the pre-conversion extractor output baseline
    ```yaml
    description: "Run the current .mjs extractor and keep its output, because after the conversion it cannot be regenerated. This is the 'before' half of the plan's decisive output-parity diff."
    issues: []
    implement:
      - "Before editing anything in this phase, run the existing extractor against a known root and write the result outside the repo: node src/scripts/extract-praxis-data.mjs --root <dir> --out /tmp/before.json"
      - "Use a root you can re-run against unchanged for the rest of the phase — this repo itself is the obvious choice, provided nothing under flowcharge/ is edited between the two runs."
      - "Record the exact --root value used; task 2.4 must pass the identical one."
      - "Do not write the baseline anywhere inside the repo working tree."
    pattern: "src/scripts/extract-praxis-data.mjs (read-only run); output to /tmp/before.json"
    imports: "node; a project directory containing flowcharge/"
    compatibility: "The extractor is read-only against the project it reads, so this run is side-effect free apart from the --out file."
    gotcha: "The payload's generated field is today's date, so a baseline captured before midnight and compared after it will differ on that one field for reasons that have nothing to do with the conversion. Capture and compare within the same day, or account for that single line if the diff is otherwise empty. Editing anything under the chosen --root between the two runs also invalidates the comparison."
    verify:
      - "/tmp/before.json exists and is non-empty; node -e \"const d=require('/tmp/before.json');console.log(d.workstreams.length,d.issues.length,d.generated)\" prints plausible counts."
      - "git status shows no new untracked file inside the repo."
    checklist:
      - "Was the baseline captured before any Phase 2 edit?"
      - "Is it stored outside the repo working tree?"
      - "Was the --root value recorded for reuse in 2.4?"
      - "Is the file valid JSON with non-zero workstream and issue counts?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 2.2 Convert `src/scripts/extract-praxis-data.mjs` to `.ts`
    ```yaml
    description: "Rename the extractor to TypeScript and add the annotations strict mode requires, asserting rather than coercing at every frontmatter read. No logic, no regex and no path expression changes."
    issues: []
    implement:
      - "git mv src/scripts/extract-praxis-data.mjs src/scripts/extract-praxis-data.ts — a rename, never a delete-and-recreate."
      - |
        Add an `Args` interface for `parseArgs` (line 15) and annotate its parameter, because the
        properties are assigned incrementally rather than in one literal:

        interface Args { root?: string; out: string; help?: boolean }
      - "Type parseFrontmatter (line 36) as returning Record<string, string | string[]>. Two supporting annotations follow from that: the fm accumulator at line 39 needs the same Record type instead of a bare {}, and val at line 43 needs an explicit string | string[] annotation because line 46 reassigns it to an array. Assignment narrowing keeps val.startsWith legal at line 44."
      - |
        Add the fmStr helper exactly as PLN-3's assertion table specifies, and apply it at every
        scalar frontmatter read — the code already assumes scalars for these keys, so this asserts
        rather than coerces:

        function fmStr(v: string | string[] | undefined): string { return v as string; }

        Sites: line 89 (fm.id, fm.type, fm.status, fm.updated), line 110 (wsFm.id), and lines
        117-123 (wsFm.id, wsFm.title, wsFm.status, wsFm.created, wsFm.updated).
      - "Leave the fm.type === 'issuelist' / 'tasklist' comparisons at lines 90 and 97 and the !fm.id guard at line 88 exactly as written — they type-check unchanged."
      - "Leave the tags and depends_on ternaries at lines 121 and 124 alone: Array.isArray(...) ? ... : (... ? [...] : []) already narrows to string[] on its own."
      - "Give issuesAccumulator (line 133) an explicit element type — any[] for now; task 3.2 tightens it to PraxisIssue[]. Without it, strict mode rejects the bare [] as an implicit any[] whose type cannot be determined."
      - "Give entry (line 89) a type so the conditional total/done assignments at lines 92-93 are legal — an inline shape for now; task 3.2 replaces it with PraxisArtefact."
      - "Annotate every remaining function parameter that noImplicitAny flags (parseFrontmatter's text, countChecks's text, walkWorkstreams's base and archived, parseArgs's argv). These are mechanical string/boolean annotations, not design decisions."
      - "DO NOT TOUCH path.join(__dirname, '..', 'public', 'data.json') at line 16 or path.resolve(args.out) at line 162. Both must re-point purely by being compiled into dist/scripts/ (acceptance criteria 5 and 14)."
      - "Change no regex, no accumulation logic, no console output and no exit code. The header comment and usage() text are Phase 5's job — leave them stale for now."
      - "Confirm tsc preserved the #!/usr/bin/env node shebang in dist/scripts/extract-praxis-data.js. If it did not, record it and stop: the plan specifies no fallback for that case."
    pattern: "src/scripts/extract-praxis-data.mjs -> src/scripts/extract-praxis-data.ts"
    imports: "node:fs, node:path, node:url (unchanged); the root tsconfig already includes src/scripts/**/*.ts"
    compatibility: "Output must stay byte-identical to the .mjs version against the same --root (acceptance criterion 6), which means JSON.stringify's argument, key order and the payload's field set are all untouchable. The compiled file must remain ESM so import.meta.url keeps working."
    gotcha: "fmStr is an assertion helper, not a coercion helper — it must return v as string and never v ?? '' or String(v), because a fallback would change what lands in the payload for a missing key. Applying it to tags or depends_on would break their array handling, so apply it only at scalar reads. The two path expressions are the single most consequential thing not to touch in this task."
    verify:
      - "npm run build exits 0 and writes dist/scripts/extract-praxis-data.js."
      - "head -1 dist/scripts/extract-praxis-data.js is the shebang."
      - "grep -n \"__dirname\\|path.resolve\" dist/scripts/extract-praxis-data.js shows the same two path expressions as the original."
      - "node dist/scripts/extract-praxis-data.js --root <same dir as 2.1> --out /tmp/after.json then diff /tmp/before.json /tmp/after.json — empty."
    checklist:
      - "Did the file move as a git rename?"
      - "Are the two path expressions byte-identical to the pre-conversion versions?"
      - "Does fmStr assert (v as string) rather than supply any fallback?"
      - "Is fmStr applied at every scalar frontmatter read and at none of the array reads?"
      - "Is the shebang present in the compiled output?"
      - "Is the before/after output diff empty?"
    self_eval:
      passed: true
      failures:
        - item: "Are the two path expressions byte-identical to the pre-conversion versions?"
          reason: "Byte-identical in substance, but tsc normalises indentation in the emit, so a raw byte comparison of dist/scripts/extract-praxis-data.js against the .mjs differs in leading whitespace on those lines."
          fix: "None required. Verified the expressions themselves are unchanged: path.join(__dirname, '..', 'public', 'data.json') and path.resolve(args.out) appear verbatim in both source and emit, and the decisive output-parity diff is empty."
        - item: "Implement step: annotate only the enumerated sites (no checklist item failed; recorded as a deviation)"
          reason: "One annotation beyond the task's enumerated set was required: the local out accumulator in walkWorkstreams. strict mode raised TS7034/TS7005 because out is returned at the existsSync guard before any push, so its evolving-array type cannot be determined."
          fix: "Annotated it as const out: any[] = [], matching the placeholder convention the task already mandates for issuesAccumulator. Task 3.2 explicitly names this same site and tightens it to PraxisWorkstream[], so the placeholder is anticipated rather than a deviation from the plan."
    ```
  - [x] 2.3 Re-point `refresh` and add `prerefresh`
    ```yaml
    description: "Point npm run refresh at the compiled extractor and make it build first, closing Phase 1's transient gap where a refresh did not reach the served board."
    issues: []
    implement:
      - "Re-read package.json's scripts block first — task 1.6 rewrote it."
      - "Change refresh from node src/scripts/extract-praxis-data.mjs to node dist/scripts/extract-praxis-data.js."
      - "Add prerefresh with the value npm run build, alongside the existing prestart."
      - "Leave build, prestart and start exactly as 1.6 left them."
    pattern: "package.json (repo root), scripts block"
    imports: "None"
    compatibility: "npm run refresh -- --root X appends the flags to the refresh command only; prerefresh neither needs nor receives them. refresh stays a single command from the repo root (acceptance criterion 4)."
    gotcha: "Anyone who scripted npm run refresh -- --out src/public/data.json will from now on overwrite the committed seed instead of the served file, and the board will appear not to refresh — the symptom is a 'Data generated' date that does not move. That is a known, accepted consequence, documented in Phase 5, not something to guard against in code."
    verify:
      - "npm run refresh -- --root <dir> builds first, then writes dist/public/data.json; the printed outPath ends /dist/public/data.json."
      - "node -e \"const p=require('./package.json');console.log(p.scripts)\" shows build, prestart, start, prerefresh and refresh, with refresh pointing into dist/."
    checklist:
      - "Does refresh run node dist/scripts/extract-praxis-data.js?"
      - "Does prerefresh run npm run build?"
      - "Are build, prestart and start unchanged from 1.6?"
      - "Does a no---out refresh write dist/public/data.json?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 2.4 Phase 2 verification pass
    ```yaml
    description: "Run PLN-3's seven Phase 2 verify steps, including the output-parity diff and the single most important check in the plan — that a build after a refresh does not reseed over the refreshed data."
    issues: []
    implement:
      - "Run each verify step in order against the same --root recorded in task 2.1."
      - "Step 3 is the decisive one: if npm start after a refresh shows the demo snapshot's date rather than the refreshed date, the seed rule in tools/copy-assets.mjs is wrong and must be fixed before the phase closes."
      - "Delete /tmp/before.json, /tmp/after.json and /tmp/probe.json when the phase passes."
    pattern: "Whole repo; no file is edited by this task"
    imports: "npm, node, a browser at http://localhost:4173"
    compatibility: "These seven steps are PLN-3's Phase 2 verify block verbatim, and they carry acceptance criteria 4, 5 and 6."
    gotcha: "Step 5 must be run from a directory outside the repo (cd / first) or it proves nothing about cwd-independence. The generated date field will differ between before.json and after.json if the two runs straddle midnight — see 2.1's gotcha."
    verify:
      - "Output parity: diff /tmp/before.json /tmp/after.json is empty, where after.json came from the compiled extractor against the same --root."
      - "npm run refresh -- --root <dir> with no --out writes dist/public/data.json; the printed outPath ends /dist/public/data.json; reloading the page shows the new 'Data generated' date."
      - "Immediately run npm start: the board still shows the refreshed date, not the demo snapshot — proving the seed rule did not clobber it."
      - "npm run refresh -- --root . --out /tmp/probe.json writes /tmp/probe.json and leaves dist/public/data.json alone. Delete the probe."
      - "cwd-independence: from /, run node /abs/path/dist/scripts/extract-praxis-data.js --root /abs/path and confirm it still targets dist/public/data.json."
      - "head -1 dist/scripts/extract-praxis-data.js is the shebang."
      - "npm run refresh -- --help exits 0 and prints usage; omitting --root exits 1."
    checklist:
      - "Is the before/after output diff empty?"
      - "Does a no---out refresh land in dist/public/data.json and reach the board?"
      - "Does a build immediately after a refresh leave the refreshed data intact?"
      - "Does --out still resolve against the process cwd?"
      - "Do --help and the missing---root path still exit 0 and 1 respectively?"
      - "Were all three /tmp files deleted?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 3. Introduce the shared data contract on the producer side (Phase 3)

  ```yaml
  description: "Add the ambient declaration file describing what the extractor already writes, and tighten the extractor to produce it. Types only — nothing about the emitted JavaScript changes."
  ```

  - [x] 3.1 Add `src/types/praxis-data.d.ts`
    ```yaml
    description: "Create the ambient declaration file holding the four payload interfaces, transcribed from what the extractor writes today."
    issues: []
    implement:
      - |
        Create `src/types/praxis-data.d.ts` with exactly these four interfaces, transcribed verbatim
        from PLN-3's Design section (they describe what the extractor already writes — nothing here
        is invented, and no field may be added, removed or tightened):

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
      - "Verify the file contains no top-level import and no top-level export. A single one of either turns it into a module and the interfaces stop being global, which silently breaks the whole mechanism."
      - "The root tsconfig already includes src/types/**/*.d.ts — no config edit is needed here."
      - "This file knows the payload's shape and nothing about how either side uses it: no DOM types, no Node types, no functions, no runtime code."
    pattern: "src/types/praxis-data.d.ts (new file)"
    imports: "None, by design"
    compatibility: "Ambient global declarations are the only mechanism that can share types between two compilations with no imports between them, and the only one that keeps app.ts a classic script. .d.ts files emit nothing, so dist/ is unaffected."
    gotcha: "Do not add runtime validation of data.json against these interfaces — that is a behaviour change and is explicitly out of scope (Open Question 4's committed default). The types catch structural drift at compile time and nothing else; a malformed file fails at runtime exactly as it does today."
    verify:
      - "grep -nE '^\\s*(import|export)' src/types/praxis-data.d.ts returns nothing."
      - "npm run build exits 0."
      - "ls dist/types fails — the declaration file emits nothing (acceptance criterion for Phase 3 step 4)."
    checklist:
      - "Are all four interfaces present with exactly the fields the plan lists?"
      - "Are total and done optional, and severity and status nullable?"
      - "Does the file contain no top-level import or export?"
      - "Does it contain no runtime code, DOM type or Node type?"
      - "Is dist/types absent after a build?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 3.2 Tighten the extractor's producer-side typing
    ```yaml
    description: "Replace the extractor's placeholder types from Phase 2 with the shared interfaces, so producer/consumer drift becomes a compile error."
    issues: []
    implement:
      - "In src/scripts/extract-praxis-data.ts, annotate the payload literal (line 155) as const payload: PraxisData = { ... }."
      - "Change issuesAccumulator (line 133) from the Phase 2 placeholder to let issuesAccumulator: PraxisIssue[] = [], and keep the reassignment to [] inside main() (line 149) as it is."
      - "Annotate walkWorkstreams's return type as PraxisWorkstream[] and its local out accumulator (line 69) to match."
      - "Replace the Phase 2 inline type on entry (line 89) with PraxisArtefact."
      - "Introduce no new cast anywhere. If the build now demands one beyond the fmStr sites already present, the interface is wrong for the real output and must be corrected to match the code — never the reverse."
      - "Change no runtime expression. This task is annotations only; the emitted JavaScript must be identical to what Phase 2 produced."
    pattern: "src/scripts/extract-praxis-data.ts"
    imports: "The four global interfaces from src/types/praxis-data.d.ts — used without an import, by design"
    compatibility: "PraxisIssue[] also fixes the never[] inference the bare [] at line 133 would otherwise produce. The interfaces describe the payload as it is today, so no assignment should need widening."
    gotcha: "If PraxisArtefact's optional total/done cause an error at the conditional assignments (lines 92-93), the fix is the annotation on entry, not a change to the interface or to the conditional. Any temptation to make a field optional in the interface to silence an error is a signal the extractor was misread — re-read it instead."
    verify:
      - "npm run build passes with no cast at the payload assignment beyond the fmStr sites already introduced in Phase 2."
      - "Re-run the Phase 2 output-parity diff against the same --root — still empty, proving types changed nothing at runtime."
      - "Drift check: temporarily rename depends_on to dependsOn in the interface; npm run build fails on the extractor. Revert."
      - "ls dist/types still fails."
    checklist:
      - "Is payload annotated as PraxisData?"
      - "Is issuesAccumulator typed PraxisIssue[] and walkWorkstreams returning PraxisWorkstream[]?"
      - "Is entry typed PraxisArtefact?"
      - "Were zero new casts introduced?"
      - "Is the output-parity diff still empty?"
      - "Does renaming a field in the interface break the build (and was it reverted)?"
    self_eval:
      passed: true
      failures:
        - item: "Implement step: annotations only, emitted JavaScript identical to Phase 2 (no checklist item failed; recorded as a deviation)"
          reason: "Replacing entry's inline shape with PraxisArtefact shortened the declaration enough to fit on one source line, so the two-line source form Phase 2 left behind collapsed to one."
          fix: "None required. This is source formatting, not a runtime change: tsc already emitted that declaration as a single line in Phase 2, and dist/scripts/extract-praxis-data.js is byte-identical before and after this task (diff empty), as is the extractor's JSON output."
        - item: "Implement step: the line numbers the task cites (69, 89, 133, 155) (no checklist item failed; recorded as a deviation)"
          reason: "The cited line numbers are PLN-3's pre-conversion ones; Phase 2's annotations shifted them, so the real sites are out at 75, entry at 95, issuesAccumulator at 140 and payload at 162."
          fix: "None required. Each site was located by its identifier rather than its line number, and all four named sites were tightened exactly as specified."
    ```

- [x] 4. Convert the browser file and close the contract (Phase 4)

  ```yaml
  description: "Add the browser-side compiler configuration, convert app.js to TypeScript with the byId helper and the plan's enumerated annotations, and hand its compilation from the asset copier to tsc. index.html is not edited — the output is dist/public/app.js, the same filename the existing script tag already loads."
  ```

  - [x] 4.1 Capture the pre-conversion browser baseline
    ```yaml
    description: "Record how the board behaves and keep a copy of the pre-conversion app.js, because Phase 4's two strongest checks are both comparisons against this state."
    issues: []
    implement:
      - "Before any edit in this phase, copy the current browser file outside the repo: cp src/public/app.js /tmp/before-app.js. This is the reference for the emit-parity diff and does not depend on how the phase's commits are arranged."
      - "With npm start running, capture the board's current behaviour in enough detail to compare against afterwards: the four KPI values and their bar segments, the per-column card counts across all six columns, the result count text, both sort toggles, both direction toggles, a search term and the count it produces, the severity legend values, and the attention panel's rows."
      - "Record the observations somewhere outside the repo working tree."
    pattern: "src/public/app.js (read-only); /tmp/before-app.js and notes outside the repo"
    imports: "npm, a browser at http://localhost:4173"
    compatibility: "333 lines of DOM construction with no test runner leaves no better option than a manual capture; the emit diff carries most of the regression weight and this covers the rest."
    gotcha: "Capture against the same data.json the post-conversion pass will use, or the counts differ for reasons unrelated to the conversion. If a refresh happens between the two passes, re-capture."
    verify:
      - "/tmp/before-app.js exists and is byte-identical to src/public/app.js (diff returns nothing)."
      - "The behavioural notes cover all four KPIs, all six columns, both toggles, the search box and both lower panels."
    checklist:
      - "Was the copy taken before any Phase 4 edit?"
      - "Is /tmp/before-app.js identical to the current src/public/app.js?"
      - "Do the notes cover every element task 4.6 must re-check?"
      - "Are both stored outside the repo working tree?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 4.2 Add `src/public/tsconfig.json` for the browser side
    ```yaml
    description: "Create the browser-side compiler configuration exactly as PLN-3's Design section specifies, co-located with the file it governs."
    issues: []
    implement:
      - |
        Create `src/public/tsconfig.json` with exactly this content (transcribed from PLN-3's Design
        section; the trailing comments are optional but every option value is not):

        {
          "compilerOptions": {
            "target": "es2020",
            "lib": ["dom", "es2020"],
            "module": "none",            // guarantees a classic script; an added import becomes an error
            "types": [],                 // load-bearing: without it tsc auto-includes @types/node
            "rootDir": "..",             // = src/, so output lands at dist/public/app.js
            "outDir": "../../dist",
            "strict": true,
            "noEmitOnError": true,
            "skipLibCheck": true
          },
          "include": ["app.ts", "../types/praxis-data.d.ts"]
        }
      - "types: [] is the single most important line: tsc auto-includes every package under node_modules/@types unless told otherwise, which would give the browser file Node globals it must never see."
      - "If a TS 5.x check rejects module: none in combination with these options, the plan's stated fallback is module: es2020, verified by grepping the emitted dist/public/app.js for import/export (there are none to emit). Use no other fallback."
      - "Do not add composite, references or declaration here either."
    pattern: "src/public/tsconfig.json (new file)"
    imports: "typescript (installed in 1.1)"
    compatibility: "rootDir .. resolves to src/, so app.ts emits to dist/public/app.js — the same filename index.html's unchanged script tag already loads (acceptance criterion 7). Being co-located means an editor's TypeScript server resolves app.ts to this project by the ordinary nearest-tsconfig rule, with no project references."
    gotcha: "The root tsconfig's include does not name src/public, so the two projects do not overlap — do not add app.ts to the root config to 'be safe', because that would hand it @types/node and defeat the isolation. Both configs include the same .d.ts, which is correct and harmless since it emits nothing."
    verify:
      - "npx tsc -p src/public/tsconfig.json --showConfig shows types as an empty array, lib containing dom, rootDir resolving to src/ and outDir resolving to dist/."
      - "After task 4.3, npx tsc -p src/public/tsconfig.json writes dist/public/app.js and no other file."
    checklist:
      - "Do all nine compilerOptions match the plan's values exactly?"
      - "Is types an empty array?"
      - "Does lib contain both dom and es2020, with no node types anywhere?"
      - "Does include name app.ts and the shared .d.ts and nothing else?"
      - "Does the emitted file land at dist/public/app.js?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 4.3 Convert `src/public/app.js` to `src/public/app.ts`
    ```yaml
    description: "Rename the browser file to TypeScript and apply exactly the annotations, assertions and one guard PLN-3 enumerates. No UI change, no feature change, no module conversion."
    issues: []
    implement:
      - "git mv src/public/app.js src/public/app.ts — a rename, never a delete-and-recreate. Keep the file's var/function style verbatim; at target es2020 the emitted JavaScript is the input minus type annotations, which is what makes the emit-parity diff meaningful."
      - |
        Add the `byId` helper exactly as PLN-3's assertion table gives it, and route all 16
        `document.getElementById(...)` call sites through it. Today a missing element throws a
        TypeError; this preserves that exactly and keeps the diff to one line per site:

        function byId(id: string): HTMLElement { return document.getElementById(id)!; }

        The 16 sites are at lines 27, 44, 45, 48, 50, 71, 152, 153, 176, 180, 181, 271, 309, 312,
        319 and 326. Confirm the count with `grep -c "document.getElementById" src/public/app.ts`
        before and `grep -c "byId(" src/public/app.ts` after.
      - "Give el (line 7) a signature that accepts every existing call site — one to three arguments, with cls and text both optionally null — returning HTMLElement. Do not change its body or its behaviour."
      - "Annotate the maps the Design section names, so string indexing is legal: STATUS_LABEL (line 3) and SEV_LABEL (line 5) as Record<string, string>; wsByStatus (line 73), sevCounts (line 106) and counts (line 177) as Record<string, number>; byStatus (line 276) as Record<string, PraxisWorkstream[]>; and artefactTypeLabel's inline map (line 213) as Record<string, string>. Prefer a form that erases to nothing (an as assertion on the object literal) over introducing a local variable, so the emit-parity diff stays confined to the enumerated differences."
      - "Cast e.target at the three listener sites — lines 313 and 320 as (e.target as HTMLElement).closest('button'), line 327 as (e.target as HTMLInputElement).value. EventTarget has neither .closest nor .value."
      - "Widen sortKey and sortDir (lines 200-201) to string | undefined, keeping their 'id' and 'asc' initialisers. Insert NO fallback: btn.dataset.key is string | undefined and a ?? would change which sort a data-attribute-less button produces. Widening the declared type is free; coercing the value is not."
      - "Add the two guards at lines 108 and 179 — i.severity != null && sevCounts[i.severity] != null, and the same shape for counts. TypeScript rejects indexing with string | null outright. At runtime today a null severity becomes the key \"null\", which is absent from the record, so the != null test already fails and no counter increments; the guard reaches the same outcome one step earlier. These two are the only new conditionals in the entire conversion."
      - "Type boot as function boot(raw: PraxisData). Response.json() returns any, so .then(boot) type-checks with no cast at the call site."
      - "Annotate the remaining function parameters noImplicitAny flags (fmtDate, daysSince, wsIdNum, matches, artefactTypeLabel, buildCard and the local helpers), using PraxisWorkstream and PraxisArtefact where the value is one."
      - "Do not convert the file to an ES module: no import, no export, no type=\"module\". The IIFE wrapper stays. index.html is not edited at any point in this phase."
      - "Change no DOM structure, no event wiring, no sort or filter logic and no rendered output."
      - "Three strict-mode friction sites are NOT enumerated in the plan's assertion table but will surface: line 152 assigns a number to textContent, and lines 243 and 248 read a.done / a.total, which PraxisArtefact declares optional. Apply the plan's governing rule — assert, don't coerce — and record each site you touched in self_eval so the deviation is visible. If any of the three seems to need a fallback or a logic change, stop and report rather than deciding it here."
    pattern: "src/public/app.js -> src/public/app.ts"
    imports: "The four global interfaces from src/types/praxis-data.d.ts, used without an import; DOM lib types from the browser tsconfig"
    compatibility: "The emitted file must remain a classic script loadable by the unchanged <script src=\"app.js\"> at index.html:75 (acceptance criterion 7). app.ts knows only the DOM and PraxisData — it gains no knowledge of Node, of the extractor or of the filesystem, and types: [] enforces that mechanically."
    gotcha: "PLN-3's Phase 4 build step says 'the four Record<string, ...> maps' while its Design section enumerates seven named maps for this file — the named list is authoritative; follow it. byId must assert with ! and never fall back to a created element or an early return, because that would convert today's TypeError into silent no-op rendering. Anything appearing in the emit diff beyond the enumerated differences is an unintended change and must be reverted, not rationalised."
    verify:
      - "npm run build (after task 4.5 wires the browser compilation in) exits 0 and writes dist/public/app.js."
      - "diff dist/public/app.js /tmp/before-app.js — the only differences are the byId helper and its call sites, the erased annotations and casts, and the two severity != null guards."
      - "grep -E '^\\s*(import|export|require)' dist/public/app.js returns nothing."
      - "grep -c 'process' dist/public/app.js shows no Node globals leaked in."
    checklist:
      - "Did the file move as a git rename, keeping its var/function style and IIFE wrapper?"
      - "Do all 16 getElementById sites now go through byId, and does byId assert with !?"
      - "Are all seven maps annotated, the three e.target sites cast, and sortKey/sortDir widened with no fallback added?"
      - "Are exactly two new conditionals present (the severity guards) and no other logic change?"
      - "Is boot typed as taking PraxisData, with no cast at the .then(boot) call site?"
      - "Is the emit diff confined to the enumerated differences, with no import/export in the output?"
    self_eval:
      passed: true
      failures:
        - item: "Implement step: the three unenumerated strict-mode friction sites (no checklist item failed; recorded because the task requires it)"
          reason: "All three surfaced exactly as the task predicted. Line 152 assigns stale.length, a number, to textContent, which is string | null. Lines 243 and 248 read a.done and a.total, which PraxisArtefact declares optional."
          fix: "Applied the plan's governing rule at all three, choosing forms that erase to nothing so the emitted JavaScript is unchanged: byId('attn-count').textContent = stale.length as unknown as string; Math.round(100 * a.done! / a.total); and a.done! + '/' + a.total!. None of the three needed a fallback or a logic change, so there was nothing to stop and report."
        - item: "Implement step: annotate only the enumerated sites (no checklist item failed; recorded as a deviation)"
          reason: "One annotation beyond the task's enumerated set was required: the local out accumulator in collectStale. strict mode raised TS7034/TS7005 because every push happens inside a forEach callback, so the evolving-array type cannot be determined at the sort and the return."
          fix: "Annotated it as var out: any[] = [], the same placeholder convention task 2.2 mandated for the identical situation in the extractor's walkWorkstreams. It erases to nothing, so the emit is unaffected."
        - item: "Is the emit diff confined to the enumerated differences, with no import/export in the output?"
          reason: "Substantively yes, but a raw diff against /tmp/before-app.js is not confined to them. tsc reprints from the AST: it normalises indentation to four spaces, strips blank lines, splits single-line if statements across two lines, and — because strict true implies alwaysStrict — prepends a 'use strict' prologue the classic script did not carry."
          fix: "None required, and none available without deviating from the tsconfig PLN-3 specifies. Isolated the real changes by re-emitting the pre-conversion file through the same compiler settings (tsc on a copy of /tmp/before-app.js with --target es2020 --module none --lib dom,es2020 --types --alwaysStrict --noEmitOnError false) and diffing that against dist/public/app.js. The result is exactly 37 changed lines: the byId declaration, the 16 call-site conversions and the two severity guards. Every annotation, cast, ! and as erased to nothing. The 'use strict' prologue is inert here — the IIFE assigns only to declared vars, uses no with, no octal and no arguments.callee, and the DOM passes the element as this to both listeners in either mode."
    ```
  - [x] 4.4 Drop `app.js` from `tools/copy-assets.mjs`'s copy list
    ```yaml
    description: "Remove the temporary app.js asset copy now that tsc compiles the browser file into the same destination."
    issues: []
    implement:
      - "Re-read tools/copy-assets.mjs as task 1.5 left it."
      - "Remove src/public/app.js from the unconditional copy list, leaving index.html and styles.css there and the data.json seed-if-absent rule untouched."
      - "Update the log output so it no longer claims to have copied app.js."
      - "Delete any stale dist/public/app.js left over from the asset-copy era before the next verification, so the parity diff cannot be reading a copied file instead of a compiled one."
    pattern: "tools/copy-assets.mjs"
    imports: "None"
    compatibility: "Both the copier and the browser compilation write dist/public/app.js; after this task exactly one of them does. The build order in package.json puts copy-assets last, so leaving the entry in would silently overwrite the compiled output with the source file — which, being TypeScript-free today, would appear to work and hide the regression."
    gotcha: "This task and 4.5 must land together: removing the copy before adding the tsc invocation leaves the board with no app.js at all."
    verify:
      - "rm -f dist/public/app.js && npm run build recreates it, and its content matches the compiled output rather than src/public/app.ts."
      - "grep -n 'app' tools/copy-assets.mjs shows no app.js reference remaining."
      - "The copier's log lists index.html, styles.css and the data.json decision only."
    checklist:
      - "Is app.js gone from the copy list?"
      - "Are index.html and styles.css still copied unconditionally?"
      - "Is the data.json seed-if-absent rule unchanged?"
      - "Does the log no longer mention app.js?"
      - "Is the dist/public/app.js that appears after a build the compiled one?"
    self_eval:
      passed: true
      failures:
        - item: "Implement step: remove src/public/app.js from the copy list (no checklist item failed; recorded as a deviation)"
          reason: "The copy loop carried a two-line comment, added by task 1.5, that existed solely to explain the temporary app.js entry and to name this task as the one that would drop it. Removing the entry left the comment describing nothing."
          fix: "Removed those two comment lines along with the entry. Nothing else in the file changed: the log statement is a template literal over the loop, so it stopped mentioning app.js on its own, and the data.json seed-if-absent block was not touched."
    ```
  - [x] 4.5 Add the browser compilation to the `build` script
    ```yaml
    description: "Extend build so it runs both compiler configurations and then the asset copy."
    issues: []
    implement:
      - "Re-read package.json's scripts block."
      - "Change build to: tsc -p tsconfig.json && tsc -p src/public/tsconfig.json && node tools/copy-assets.mjs — the exact chain PLN-3's Design section specifies, in that order."
      - "Leave prestart, start, prerefresh and refresh exactly as Phases 1 and 2 left them."
      - "Still no typecheck script and still no clean script."
    pattern: "package.json (repo root), scripts block"
    imports: "None"
    compatibility: "Both tsc invocations exit non-zero on a type error so the && chain stops, and noEmitOnError prevents partial output from either (acceptance criterion 2)."
    gotcha: "copy-assets must stay last in the chain: it is the step that guarantees dist/public/ exists for the browser emit on a clean tree — if the browser tsc runs against a missing directory it creates it itself, which is fine, but reordering the chain so the copier runs first would reintroduce the overwrite hazard task 4.4 just removed."
    verify:
      - "rm -rf dist && npm run build produces dist/server.js, dist/scripts/extract-praxis-data.js, dist/public/app.js, dist/public/index.html, dist/public/styles.css and dist/public/data.json (acceptance criterion 2)."
      - "Introduce a deliberate type error in app.ts; npm run build exits non-zero and dist/public/app.js is not rewritten. Revert."
    checklist:
      - "Does build run both tsconfigs and then copy-assets, in that order?"
      - "Are the other four scripts unchanged?"
      - "Does a build from an empty dist/ produce all six expected files?"
      - "Does a type error in app.ts fail the build without emitting?"
    self_eval:
      passed: true
      failures:
        - item: "Verify step: rm -rf dist and npm run build (no checklist item failed; recorded as a deviation in method)"
          reason: "dist/public/data.json held refreshed data that differed from the committed seed, and rm -rf dist discards it — the documented caveat task 5.1 will record in the README. Running the step as written would have reseeded the demo snapshot and invalidated task 4.1's behavioural baseline, which task 4.6 must compare against."
          fix: "Copied dist/public/data.json outside the repo before the clean build, ran the step exactly as written (all six files appeared, and the copier's log reported it seeded data.json from the empty tree), then restored the refreshed file and confirmed its checksum still matches the one 4.1 was captured against."
    ```
  - [x] 4.6 Phase 4 verification pass
    ```yaml
    description: "Run PLN-3's six Phase 4 verify steps, including the emit-parity diff, the classic-script checks, the full behavioural pass against the 4.1 capture, and the two-way drift check."
    issues: []
    implement:
      - "Run each verify step in order. Step 1's diff is the strongest evidence available for this phase — anything in it beyond the enumerated differences is an unintended change and must be reverted."
      - "Step 4's behavioural pass compares against the capture taken in task 4.1, against the same data.json."
      - "Revert the interface rename from step 6 before closing the phase."
    pattern: "Whole repo; no file is edited by this task"
    imports: "npm, a browser at http://localhost:4173, /tmp/before-app.js and the notes from 4.1"
    compatibility: "These six steps are PLN-3's Phase 4 verify block verbatim, and they carry acceptance criteria 1, 2, 7 and 8."
    gotcha: "Step 6 is deliberately asymmetric: adding a field to PraxisData without producing it would leave the extractor compiling, so the drift check must be a rename of an existing field (generated) and must fail BOTH compilations. Checking only one proves nothing about the shared contract."
    verify:
      - "Emit parity: diff dist/public/app.js /tmp/before-app.js — differences confined to the byId helper and its call sites, the erased annotations and casts, and the two severity != null guards."
      - "grep -E '^\\s*(import|export|require)' dist/public/app.js returns nothing — it is a classic script."
      - "grep -c 'process' dist/public/app.js shows no Node globals leaked in; the build would have failed first, since types: [] denies app.ts any Node types."
      - "Full behavioural pass in the browser against the 4.1 capture: KPI strip values and bar segments identical, all six columns with the same card counts, both sort toggles, both direction toggles, the search box filtering and the result count updating, the severity legend and the attention panel. Console clean."
      - "Graceful degradation once more: rm dist/public/data.json, hard-reload, the panel appears."
      - "Drift check both ways: rename generated in the PraxisData interface and confirm BOTH compilations fail. Revert."
      - "ls src/*.js src/**/*.js src/**/*.mjs finds nothing — src/ now holds only .ts, .d.ts and the three assets (acceptance criterion 1)."
    checklist:
      - "Is the app.js emit diff confined to the enumerated differences?"
      - "Is the output free of import/export/require and of Node globals?"
      - "Did every captured behaviour match, with a clean console?"
      - "Does the absent-data.json panel still appear?"
      - "Did renaming a shared field break both compilations, and was it reverted?"
      - "Does src/ contain no .js or .mjs file?"
    self_eval:
      passed: true
      failures:
        - item: "Is the app.js emit diff confined to the enumerated differences?"
          reason: "Same compiler-formatting caveat recorded against task 4.3: a raw diff of dist/public/app.js against /tmp/before-app.js is dominated by tsc's reprinting (four-space indentation, stripped blank lines, split single-line if statements) and by the 'use strict' prologue that strict mode's implied alwaysStrict adds."
          fix: "None required. Re-emitted /tmp/before-app.js through the same compiler settings and diffed that against dist/public/app.js, which reduces the difference to exactly 37 lines: the byId declaration, the 16 call-site conversions and the two severity guards, and nothing else."
        - item: "Does src/ contain no .js or .mjs file?"
          reason: "It contains none, but the acceptance wording quoted in the verify step — src/ now holds only .ts, .d.ts and the three assets — under-counts by one, because task 4.2 deliberately places src/public/tsconfig.json there."
          fix: "None required. src/ now holds app.ts, extract-praxis-data.ts, server.ts, praxis-data.d.ts, the three assets (index.html, styles.css, data.json) and the co-located browser tsconfig.json the plan mandates. ls src/*.js src/**/*.js src/**/*.mjs matches nothing."
        - item: "Did every captured behaviour match, with a clean console?"
          reason: "Every one matched, but only because the comparison was kept honest about its data: the behavioural pass had to run against the same dist/public/data.json task 4.1 was captured against, and task 4.5's rm -rf dist step sits between them."
          fix: "None required. The refreshed data.json was preserved across 4.5's clean build and its checksum re-verified before the pass. Every field matched the 4.1 capture exactly — the four KPI values, subs, bar segment widths, colours and titles, the chips, all six column counts and card orders, all eight artefact rows, both sort toggles in all four combinations, the search box at two terms and cleared, the Empty versus No matches column text, and both lower panels. Console carried no messages of any level, before or after interaction. Real user clicks and typing were exercised as well as dispatched events, to cover the two e.target casts."
    ```

- [x] 5. Update the documentation and the stale path strings (Phase 5)

  ```yaml
  description: "Bring every human-facing path string in line with the new layout — the README, the page footer, and the extractor's header and usage text. Path strings and prose only; no logic anywhere in this phase."
  ```

  - [x] 5.1 Update `README.md`
    ```yaml
    description: "Rewrite the quick start, directory tree, Scripts table, snapshot sentence and the now-false no-build-step note."
    issues: []
    implement:
      - "Quick start (lines 15-18) becomes three commands: npm install, then npm run refresh -- --root /path/to/your/project, then npm start. npm install is now a genuine prerequisite — without node_modules, prestart fails on a missing tsc with a moderately opaque npm error."
      - "The 'How it fits together' tree (lines 25-36) shows src/ with the .ts extensions, tools/copy-assets.mjs, and a generated dist/ marked as gitignored. Keep it a description of what is actually on disk after a build."
      - "The Scripts table (lines 44-49) gains a npm run build row and re-points the other two at dist/: npm start serves dist/public/, and npm run refresh regenerates dist/public/data.json. The --out sentence beneath it names dist/public/data.json as the default."
      - "The snapshot sentence (lines 20-21) explains that src/public/data.json is a committed seed that is copied into dist/public/data.json on first build only, and is not rewritten by npm run refresh."
      - "The note at line 53 — 'No build step, no framework, no npm dependencies' — is now FALSE and must be rewritten rather than left. The accurate replacement is that there is a TypeScript compile step and two devDependencies, but no runtime dependency, no framework and no bundler."
      - "Optionally record the rm -rf dist caveat where it fits: it discards refreshed data and the next build reseeds the demo snapshot. There is deliberately no clean script (Open Question 3)."
      - "Leave the remaining two notes (the 'Needs attention' explanation and the any-project note) as they are, and change no prose that is still accurate."
      - "Reference extract-praxis-data.ts, not .mjs, everywhere it appears."
    pattern: "README.md (repo root)"
    imports: "None"
    compatibility: "Every path named must exist on disk after a build, and every command shown must run as written from a fresh clone (acceptance criterion 15)."
    gotcha: "The README currently promises the board 'works out of the box' from the checked-in snapshot — that promise survives, but only through the seed mechanism, so describing it as 'the file the board reads' would now be wrong. Do not leave any .mjs reference behind except tools/copy-assets.mjs, which really is still .mjs."
    verify:
      - "Run the three quick-start commands from a clean checkout (or after rm -rf dist node_modules) and confirm each works as written."
      - "find src tools dist -type f and confirm every path the README names exists."
      - "grep -rn '\\.mjs' README.md src/ returns only tools/copy-assets.mjs references."
    checklist:
      - "Does the quick start include npm install and run verbatim?"
      - "Does the tree match what is actually on disk after a build, including tools/ and dist/?"
      - "Does the Scripts table include build and point start and refresh at dist/?"
      - "Has the no-build-step note been rewritten rather than left standing?"
      - "Is the seed behaviour of src/public/data.json explained?"
      - "Does every path named in the README exist after a build?"
    self_eval:
      passed: true
      failures:
        - item: "Verify step: grep -rn '\\.mjs' README.md src/ returns only tools/copy-assets.mjs references"
          reason: "It returns two hits, not one. Besides tools/copy-assets.mjs, README line 57 says the extractor reads the same source of truth the prx-* skills and prx-index.mjs use."
          fix: "None required. prx-index.mjs is an external Praxis tool, not a path in this repo, so it is not a stale reference this workstream created and the task's own instruction to change no prose that is still accurate forbids touching it. Every .mjs reference to a file in this repo now names tools/copy-assets.mjs, which really is still .mjs."
        - item: "Implement step: optionally record the rm -rf dist caveat (no checklist item failed; recorded as a choice)"
          reason: "The step is optional and the plan leaves where it fits to judgement."
          fix: "Recorded it in Notes alongside the rewritten build-step note, since both concern the toolchain rather than the data model, and paired it with the fact that there is deliberately no clean script (Open Question 3)."
    ```
  - [x] 5.2 Update the `index.html` footer paths
    ```yaml
    description: "Point the page footer at the files that actually exist after the conversion. The only edit index.html receives in the entire plan, and it is not functional."
    issues: []
    implement:
      - "Apply this edit to the footer's first line (currently line 69):"
      - |
        src/public/index.html
        <<<<<<< SEARCH
          Reads <code>src/public/data.json</code>, produced by <code>src/scripts/extract-praxis-data.mjs</code> from a project's
        =======
          Reads <code>dist/public/data.json</code>, produced by <code>src/scripts/extract-praxis-data.ts</code> from a project's
        >>>>>>> REPLACE
      - "Change nothing else in the file. The <script src=\"app.js\"> tag at line 75 stays exactly as it is (acceptance criterion 7), and no stylesheet, markup or id changes."
    pattern: "src/public/index.html, footer at line 69"
    imports: "None"
    compatibility: "index.html is copied verbatim into dist/public/ by tools/copy-assets.mjs, so the edit reaches the served page on the next build with no further wiring."
    gotcha: "The two paths are deliberately asymmetric — the data file is named at its served location (dist/public/data.json) while the extractor is named at its source location (src/scripts/extract-praxis-data.ts), because that is where a reader would go to look at each. The SEARCH text was copied from src/public/index.html as read at base_commit e804e34, and no earlier phase edits this file; if it still fails to match, re-read the footer and re-anchor rather than approximating."
    verify:
      - "npm run build then reload the page and read the footer — it names files that exist."
      - "grep -n 'app.js' src/public/index.html still shows the unchanged script tag."
    checklist:
      - "Does the footer name dist/public/data.json?"
      - "Does it name the extractor with its .ts extension?"
      - "Is the script tag untouched?"
      - "Is the rest of the file unchanged?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 5.3 Update the extractor's header comment and usage text
    ```yaml
    description: "Bring the extractor's own printed and commented paths in line with reality, so --help prints a command that runs verbatim."
    issues: []
    implement:
      - "Re-read src/scripts/extract-praxis-data.ts as Phases 2 and 3 left it."
      - "Header comment: the line that says it writes src/public/data.json becomes dist/public/data.json, and the Usage line that invokes node src/scripts/extract-praxis-data.mjs becomes npm run refresh -- --root <dir>."
      - "usage(): the invocation line becomes npm run refresh -- --root <project-dir> [--out <file.json>], and the --out default description becomes dist/public/data.json."
      - "Change nothing else in the function — the flags, their semantics, the exit codes and the console.error path all stay as they are."
      - "Change no path expression. The default output value at line 16 is computed, not printed, and stays untouched."
    pattern: "src/scripts/extract-praxis-data.ts, header comment (lines 2 and 7) and usage() (lines 25-34)"
    imports: "None"
    compatibility: "Acceptance criterion 15 requires every command printed by --help to run as written and every path it names to exist after a build."
    gotcha: "npm run refresh -- --root <dir> is the correct printed form, with the double dash — printing node dist/scripts/extract-praxis-data.js would be accurate but would bypass prerefresh and could run against stale output. Only the printed strings change; the default that parseArgs computes is a __dirname expression and must not be edited to match the text."
    verify:
      - "npm run refresh -- --help exits 0 and prints a command that runs verbatim when copy-pasted, naming a default output path that exists after a build."
      - "Copy-paste and run the printed command; it succeeds."
      - "grep -rn '\\.mjs' src/ returns nothing."
    checklist:
      - "Does the header comment name dist/public/data.json and the npm run refresh form?"
      - "Does usage() print a command that runs verbatim?"
      - "Does the --out default description name dist/public/data.json?"
      - "Are the flags, semantics and exit codes unchanged?"
      - "Is the computed default at line 16 still untouched?"
    self_eval:
      passed: true
      failures:
        - item: "Verify step: copy-paste and run the printed command (no checklist item failed; recorded as a method note)"
          reason: "usage() prints npm run refresh -- --root <project-dir>, whose placeholder cannot be run literally."
          fix: "Substituted the placeholder with this repo's absolute path and ran the command otherwise verbatim. It built first via prerefresh, then wrote dist/public/data.json — the exact path the --out default description now names — and exited 0. --help exits 0 and an omitted --root still exits 1, so the flags, semantics and exit codes are unchanged."
    ```
