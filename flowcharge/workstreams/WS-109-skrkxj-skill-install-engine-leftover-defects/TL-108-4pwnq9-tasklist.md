---
id: TL-108-4pwnq9
type: tasklist
workstream: WS-109-skrkxj
slug: skill-install-engine-leftover-defects
title: "Leftover skill-install-engine defect corrections"
status: ready
created: 2026-09-11
updated: 2026-09-11
author: Anthony Koukoullis
depends_on: [IL-20-cztm5x]
links: []
mode: spec
base_commit: f0d4e2f
---

# FlowCharge Tasks

## Leftover skill-install-engine defect corrections

Four of the six issues in `IL-20-cztm5x-issuelist.md` carry a decided fix direction and
are tasked here. Two carry none and are recorded under `Skipped`.

`ISS-38-gv3p2x` corrects two format writers in `src/lib/agentic-tools-format.ts` that
read only `skill.body` and discard every entry in `skill.files`. `ISS-47-yug5gc` makes
the OpenCode presence probe also test OpenCode's legacy singular `skill/` folder, which
OpenCode 1.18.27 loads from. `ISS-50-92mh3i` repoints `PRAXIS_REPO_BASE_URL` from a
private LAN Gitea address to the public origin
`https://github.com/FlowChargeApp/flowcharge-core`, and adjusts the one URL builder that
does not resolve correctly against GitHub's API. `ISS-51-kc70n7` corrects the release
host named in `PLN-88-tpbc8f-plan.md`'s Open question 1; it edits no source file.

Every baseline in this file was measured at `f0d4e2f` after `npm run build`. The full
suite at that commit reports 387 pass, 0 fail. No correction adds a runtime dependency.

- [x] 1. Emit bundled reference files from the rule-directory and single-document writers

  ```yaml
  description: "Make ruleDirectoryWrites and singleDocumentWrite emit a FileWrite for every entry in skill.files, as skillDirectoryWrites already does."
  author: Anthony Koukoullis
  issues: [ISS-38-gv3p2x]
  implement:
    - "Open src/lib/agentic-tools-format.ts. Read skillDirectoryWrites first, at lines 39-50: for each skill it derives `const resolvedPath = format.pathTemplate.replace('<name>', skill.id)`, derives `const dir = resolvedPath.replace(/\\/[^/]+$/, '')`, pushes the SKILL.md write, then pushes one write per `skill.files ?? []` entry at `${dir}/${file.relativePath}`. That loop is the shape both other writers must match."
    - "Change ruleDirectoryWrites, at lines 56-61. It currently returns `content.skills.map(...)` producing exactly one FileWrite per skill at `format.pathTemplate.replace('*', skill.id)`. Replace the map with an accumulating loop over `content.skills`. Keep the skill's own rule file as the FIRST write emitted for that skill, unchanged in path and content, then emit one further FileWrite per entry in `skill.files ?? []`. Each bundled file must land under a directory named for the skill, beside the rule file, so that two skills shipping the same `relativePath` cannot collide — derive that directory from the resolved rule-file path, not from a second `pathTemplate.replace` call."
    - "Change singleDocumentWrite, at lines 66-69. Keep the combined document as the FIRST write, unchanged: `content.skills.map((skill) => skill.body).join('\\n\\n')` at the format's literal `format.pathTemplate`. Then emit one further FileWrite per entry in each skill's `skill.files ?? []`. The pathTemplate here is a literal file with no per-skill token, so derive the containing directory from it and place each skill's files under a per-skill subdirectory of that directory, again so two skills cannot collide. A pathTemplate with no directory part (for example 'AGENTS.md') must yield paths with no leading slash."
    - "Update the comment blocks above both functions, at lines 52-55 and 63-65, so they describe what the function now emits. Leave skillDirectoryWrites, selectPrimaryFormat, formatForTarget, UNIMPLEMENTED_KINDS and the file header untouched."
  pattern: "src/lib/agentic-tools-format.ts"
  imports: "None. The file already imports only the ToolDefinition/IntegrationFormat and InstallContent types. Add no import."
  compatibility: "Adds no runtime dependency. FileWrite keeps its two fields, relativePath and content. src/ports/ purity and the hexagonal split are untouched — this file already knows no transport and no filesystem. Keep relativePath forward-slash-separated: the write sink joins it onto a base path."
  gotcha: "src/lib/agentic-tools-skill-presence.ts:53-56 carries a comment asserting that skillDirectoryWrites and ruleDirectoryWrites emit exactly one FileWrite per input skill, in order, so writes[i] maps to skillIds[i]. That mapping still holds there because the stubContent built at :47-50 sets no `files` key, so `skill.files ?? []` is empty on the presence path. Do not change src/lib/agentic-tools-skill-presence.ts in this task. Also: the existing fixture at src/test/unit/agentic-tools-format.test.ts:40-56 gives prx-alpha one file and prx-beta none, so a writer that assumes `files` is always present will throw on prx-beta."
  verify:
    - "Run `npm run build`, then run this against the compiled output. At f0d4e2f it printed `rule-directory writes=1`, `single-rule-file writes=1` and `markdown-context-file writes=1`; each must print writes=2 after the change: node -e \"const {formatForTarget}=require('./dist/lib/agentic-tools-format.js');const c={version:'t',skills:[{id:'fc-git',name:'fc-git',description:'',body:'B',files:[{relativePath:'reference.md',content:'R'}]}]};for(const f of [{kind:'rule-directory',pathTemplate:'.cursor/rules/*.mdc',scopes:['global']},{kind:'single-rule-file',pathTemplate:'.windsurfrules',scopes:['global']},{kind:'markdown-context-file',pathTemplate:'AGENTS.md',scopes:['global']}]){const w=formatForTarget(f,c);console.log(f.kind,'writes='+w.length,JSON.stringify(w.map(x=>x.relativePath)));}\""
    - "Read the printed relativePath lists. Every path must be forward-slash-separated with no leading slash, and the two skills in a two-skill run must not produce the same path twice."
    - "Run `npx tsc --noEmit` and confirm it reports nothing."
    - "Run `npm test` and confirm 0 fail. The baseline at f0d4e2f was 387 pass, 0 fail."
  checklist:
    - "Does formatForTarget with a rule-directory format return one write for the rule file plus one per skill.files entry?"
    - "Does formatForTarget with a single-rule-file or markdown-context-file format return the combined document plus one write per skill.files entry?"
    - "Does a skill with no files key still produce exactly its own single write, with no throw?"
    - "Are two skills shipping the same files[].relativePath given distinct output paths?"
    - "Is skillDirectoryWrites unchanged, and is no import added to the file?"
    - "Does npm test report 0 fail?"
  self_eval:
    passed: true
    failures:
      - item: "Does npm test report 0 fail?"
        reason: "First run after the change reported 387 tests, 386 pass, 1 fail. src/test/unit/agentic-tools-install.test.ts:166 'installToTarget writes exactly the expected rule-directory files for Cursor at project scope' asserted the pre-fix path list, which omitted prx-alpha's bundled reference.md, so the corrected writer failed the stale expectation."
        fix: "Updated that one assertion in src/test/unit/agentic-tools-install.test.ts to expect '/home/fakeuser/repo/.cursor/rules/prx-alpha/reference.md' between the two .mdc paths, and re-indexed the content assertions to writeCalls[1] = 'reference content' and writeCalls[2] = 'beta body'. Re-ran npm test: 387 tests, 387 pass, 0 fail."
  ```

- [x] 2. Probe OpenCode's legacy singular skill folder in the presence check

  ```yaml
  description: "Make checkSkillPresence treat an OpenCode skill as present when it sits under either OpenCode's plural skills/ folder or its legacy singular skill/ folder."
  author: Anthony Koukoullis
  issues: [ISS-47-yug5gc]
  implement:
    - "Open src/lib/agentic-tools-skill-presence.ts. The per-skill branch at lines 53-73 builds `const fullPath = path.join(basePath, writes[i].relativePath)` at :62 and calls `await fsAccess.pathExists(fullPath)` at :63, then pushes skillIds[i] into presentSkillIds or missingSkillIds. That single probe is what this task widens."
    - "Inside that loop, derive the candidate relative paths for skillIds[i] instead of the one path. The first candidate stays `writes[i].relativePath`, unchanged. Add a second candidate only when both conditions hold: `tool.id === 'opencode'`, and `writes[i].relativePath` starts with the plural segment `skills/`. The second candidate is that same path with the leading `skills/` segment replaced by the singular `skill/`. Derive it from the resolved path, never from a literal rebuilt from skillIds[i]."
    - "Probe the candidates in order with `fsAccess.pathExists`, each joined to basePath with `path.join` as before, and stop at the first that exists. Count the skill present when any candidate exists, missing when none does. Leave the status derivation at :70-71 and both returned id arrays unchanged."
    - "Keep the change confined to OpenCode. Do not read or set IntegrationFormat.deprecatedFallback, which Cursor and Windsurf also set — using it would change their presence behaviour too. Do not alter the shared-file branch at :75-82, the 'global' literal at :42, the no-format return at :43-45, or the stubContent at :47-50. Do not touch src/lib/agentic-tools-catalogue.ts and do not touch src/public/lib/agentic-tools-scope.ts."
    - "Extend the comment at lines 54-56 to say that an OpenCode skill may resolve to either of OpenCode's two folder spellings, so the one-write-per-skill mapping it describes is now a mapping to a candidate set."
  pattern: "src/lib/agentic-tools-skill-presence.ts"
  imports: "None. node:path is already imported at :9. Add no import."
  compatibility: "SkillPresenceResult keeps all three of its variants and all its field names. The module stays read-only: FsAccess.pathExists is the only filesystem call it may make, per its own header at :1-5. Adds no runtime dependency."
  gotcha: "Presence checking runs at global scope only — the 'global' literal at :42 is deliberate and documented, so OpenCode's project-scope entry is never the selected format here. One tool's install must never satisfy another's: do not probe .claude/skills/ or .agents/skills/, which OpenCode also reads. The existing test at src/test/unit/agentic-tools-skill-presence.test.ts:146-156 supplies only '/base/skills/prx-orchestrate/SKILL.md' and expects missing-incomplete; it must still pass, because the singular path is absent there too."
  verify:
    - "Run `npm run build`, then run this against the compiled output. At f0d4e2f it printed status \"not-installed\", presentSkillIds [] and missingSkillIds [\"a\",\"b\"]; it must print status \"fully-installed\" with both ids present after the change: node -e \"const {checkSkillPresence}=require('./dist/lib/agentic-tools-skill-presence.js');const {TOOL_CATALOGUE}=require('./dist/lib/agentic-tools-catalogue.js');const t=TOOL_CATALOGUE.find(x=>x.id==='opencode');const ids=['a','b'];const s=new Set(ids.map(i=>'/base/skill/'+i+'/SKILL.md'));checkSkillPresence(t,'/base',ids,{pathExists:async p=>s.has(p)}).then(r=>console.log(JSON.stringify(r)));\""
    - "Re-run the same command with the set built from '/base/skills/'+i+'/SKILL.md' instead, and confirm it still prints status \"fully-installed\" — the plural path must not regress."
    - "Re-run it once more with an empty set and confirm it prints status \"not-installed\" with both ids missing."
    - "Run `npm test` and confirm 0 fail. The baseline at f0d4e2f was 387 pass, 0 fail."
  checklist:
    - "Are all skills reported present when they sit only under OpenCode's singular skill/ folder?"
    - "Are all skills still reported present when they sit only under the plural skills/ folder?"
    - "Is the second candidate added for tool.id 'opencode' alone, and for no other tool?"
    - "Does the module still call nothing but FsAccess.pathExists?"
    - "Are src/lib/agentic-tools-catalogue.ts and src/public/lib/agentic-tools-scope.ts both unmodified?"
    - "Does npm test report 0 fail?"
  self_eval:
    passed: true
    failures: []
  ```

- [x] 3. Repoint the skill-release fetch to the public FlowCharge Core origin

  ```yaml
  description: "Move PRAXIS_REPO_BASE_URL from the private LAN Gitea address to https://github.com/FlowChargeApp/flowcharge-core, and make the release API URL builder resolve correctly against GitHub. Child order keeps the suite green at every step."
  ```

  - [x] 3.1 Make the release-API marker in the content-fetch test host-agnostic
    ```yaml
    description: "Widen RELEASES_API_MARKER so it matches both the Gitea and the GitHub release-API route, before the host swap lands."
    author: Anthony Koukoullis
    issues: [ISS-50-92mh3i]
    implement:
      - "Open src/test/unit/skill-content-fetch.test.ts. Line 146 reads `const RELEASES_API_MARKER = '/api/v1/repos/';` and line 147 reads `const ASSET_DOWNLOAD_MARKER = '/releases/download/';`. Five tests match outbound URLs against the first marker, at lines 301, 361, 382, 432 and 456."
      - "Change RELEASES_API_MARKER's value to '/repos/'. Leave its name, its `const` declaration and ASSET_DOWNLOAD_MARKER untouched. '/repos/' is a substring of the current Gitea route 'http://100.87.185.97:8110/api/v1/repos/akoukoullis/Praxis/releases' and of the GitHub route 'https://api.github.com/repos/FlowChargeApp/flowcharge-core/releases', so the tests pass before and after task 3.3."
      - "Confirm the widened marker cannot match an asset URL: 'https://github.com/FlowChargeApp/flowcharge-core/releases/download/v0.1.0/flowcharge-skills-0.1.0.zip' contains no '/repos/' segment, which is what keeps the asset-URL assertions at lines 304, 433 and 457 meaningful — 304 asserts the asset marker is present, and 433 and 457 assert it is absent. Change no other line in the file."
    pattern: "src/test/unit/skill-content-fetch.test.ts"
    imports: "None."
    compatibility: "Tests run against compiled output under dist/test/, so npm run build must precede npm test. Adds no runtime dependency."
    gotcha: "The tests here use a stubbed fetch and never reach the network; do not convert any of them into a live request. Do not touch the PRAXIS_REPO_BASE_URL import at :28 or the assertion at :421 that the failure message names the constant — that assertion reads the imported value and adapts to the new host on its own."
    verify:
      - "Run `grep -c \"api/v1/repos\" src/test/unit/skill-content-fetch.test.ts`. It returned 1 at f0d4e2f and must return 0."
      - "Run `grep -n \"RELEASES_API_MARKER = \" src/test/unit/skill-content-fetch.test.ts` and confirm the value is '/repos/'."
      - "Run `npm test` and confirm 0 fail. The baseline at f0d4e2f was 387 pass, 0 fail."
    checklist:
      - "Is RELEASES_API_MARKER's value now '/repos/'?"
      - "Is ASSET_DOWNLOAD_MARKER unchanged?"
      - "Is the file otherwise byte-identical, with no test converted to a live request?"
      - "Does npm test report 0 fail?"
    self_eval:
      passed: true
      failures: []
      evidence:
        - "npm test initially reported 387 tests, 386 pass, 1 fail — the tier (c) live-network test in this same file, caused by task 3.3's host repoint exposing a stale EXPECTED_IDS fixture, not by this widened marker. The user approved fixing EXPECTED_IDS directly (see task 3.3's self_eval); after that fix, npm test reports 387/387."
    ```

  - [x] 3.2 Build GitHub's release-API route in releasesApiUrl
    ```yaml
    description: "Give releasesApiUrl a github.com branch so a github.com base URL resolves to api.github.com/repos/<owner>/<repo>/releases, while the Gitea route stays as it is."
    author: Anthony Koukoullis
    issues: [ISS-50-92mh3i]
    implement:
      - "Open src/lib/skill-release-fetch.ts. releasesApiUrl at lines 34-38 reads `const url = new URL(baseUrl)`, strips trailing slashes into `const repoPath = url.pathname.replace(/\\/+$/, '')`, then returns `${url.origin}/api/v1/repos${repoPath}/releases`. That is Gitea's route shape. Measured at f0d4e2f, releasesApiUrl('https://github.com/FlowChargeApp/flowcharge-core') returns 'https://github.com/api/v1/repos/FlowChargeApp/flowcharge-core/releases', which GitHub does not serve."
      - "Add a branch on the parsed host, before the existing return. When `url.hostname` is 'github.com' or 'www.github.com', return `https://api.github.com/repos${repoPath}/releases`. Otherwise return the existing Gitea route unchanged. Keep the trailing-slash strip shared by both branches, and keep the function's single string parameter and string return type."
      - "Leave buildAssetDownloadUrl at lines 44-46 exactly as it is. It returns `${baseUrl}/releases/download/${tag}/${assetName}`, which is already GitHub's own asset route — verified live on 2026-09-11 against https://github.com/FlowChargeApp/flowcharge-core/releases/download/v0.1.0/flowcharge-skills-0.1.0.zip, which answered 200 after GitHub's own redirect."
      - "Leave parseReleases, fetchReleases, readCappedBody, firstZipAssetName, MAX_BODY_BYTES and DEFAULT_TIMEOUT_MS untouched. GitHub's release JSON was checked live on 2026-09-11 and carries the same tag_name, name, published_at, draft, prerelease and assets[].name fields parseReleases already reads, so the parser needs no change."
      - "Update the comment above releasesApiUrl, at lines 30-33, so it states both route shapes rather than only Gitea's. Leave the file header at lines 1-10 alone apart from nothing — it already says 'Gitea/GitHub-compatible'."
    pattern: "src/lib/skill-release-fetch.ts"
    imports: "None. The module uses the global URL and fetch. Add no import and add no runtime dependency."
    compatibility: "The module must keep holding NO host constant, per its own header at :1-5 — the base URL always arrives as a parameter. It must keep importing nothing from src/lib/skill-content-fetch.ts, so there is no import cycle. Node >=20.14."
    gotcha: "Do not read or forward the asset's own browser_download_url from the API response; the test at src/test/unit/skill-release-fetch.test.ts:148-171 asserts no API-reported URL survives parsing. Do not send an auth token, cookie or credential on the GitHub call — fetchReleases sends Accept and User-Agent only, at :151, and that must stay true. The existing assertions at src/test/unit/skill-release-fetch.test.ts:134-140 cover the Gitea and example.test hosts and must keep passing unchanged."
    verify:
      - "Run `npm run build`, then run `node -e \"const {releasesApiUrl}=require('./dist/lib/skill-release-fetch.js');console.log(releasesApiUrl('https://github.com/FlowChargeApp/flowcharge-core'));\"`. At f0d4e2f it printed 'https://github.com/api/v1/repos/FlowChargeApp/flowcharge-core/releases'; it must print 'https://api.github.com/repos/FlowChargeApp/flowcharge-core/releases'."
      - "Run the same command with the base URL 'http://100.87.185.97:8110/akoukoullis/Praxis' and confirm it still prints 'http://100.87.185.97:8110/api/v1/repos/akoukoullis/Praxis/releases'."
      - "Run `npx tsc --noEmit` and confirm it reports nothing."
      - "Run `npm test` and confirm 0 fail."
    checklist:
      - "Does a github.com base URL now resolve to an api.github.com/repos/... release route?"
      - "Does a non-github.com base URL still resolve to the /api/v1/repos/... route?"
      - "Is buildAssetDownloadUrl unchanged?"
      - "Does the module still declare no host constant and import nothing from skill-content-fetch.ts?"
      - "Does the outbound request still carry only Accept and User-Agent headers?"
      - "Does npm test report 0 fail?"
    self_eval:
      passed: true
      failures: []
      evidence:
        - "npm test initially reported 1 fail, the same tier (c) live-network test named in task 3.1's self_eval, unrelated to this branch's own change. After the approved EXPECTED_IDS fix (task 3.3's self_eval), npm test reports 387/387."
    ```

  - [x] 3.3 Repoint PRAXIS_REPO_BASE_URL to the public origin
    ```yaml
    description: "Replace the private LAN Gitea address in PRAXIS_REPO_BASE_URL with https://github.com/FlowChargeApp/flowcharge-core."
    author: Anthony Koukoullis
    issues: [ISS-50-92mh3i]
    implement:
      - "Open src/lib/skill-content-fetch.ts. Line 63 reads `export const PRAXIS_REPO_BASE_URL = 'http://100.87.185.97:8110/akoukoullis/Praxis';`, under the comment at lines 61-62 that reads 'Templated so a future host swap (e.g. github.com) is a one-line constant change.' Make that swap: set the value to 'https://github.com/FlowChargeApp/flowcharge-core'."
      - "Keep the export name PRAXIS_REPO_BASE_URL. CLAUDE.md bars renaming the praxis namespace on sight, and src/test/unit/skill-content-fetch.test.ts:28 imports this symbol by name."
      - "Correct the file header at lines 1-5, which says the suite is fetched 'from the NEWEST PUBLISHED RELEASE on the self-hosted Gitea instance'. Name the public origin instead. Leave the rest of that header intact: the release is still the only content source, there is still no branch fallback, and there is still no cache."
      - "Update the comment at lines 61-62 so it no longer forecasts a swap that has now happened."
      - "Change nothing else in the file. listSkillReleases at :207-209, the failure message at :281, the buildAssetDownloadUrl call at :294, mapEntriesToSkills and getInstallContent all read the constant and need no edit."
    pattern: "src/lib/skill-content-fetch.ts"
    imports: "None. Add no import and add no runtime dependency."
    compatibility: "The constant stays a plain exported string literal, read from no environment variable — src/http/ reads no environment variable and this module is its supplier. https://github.com/FlowChargeApp/flowcharge-core was checked live on 2026-09-11: its release API answers 200 and lists one published, non-draft, non-prerelease release, v0.1.0, carrying the asset flowcharge-skills-0.1.0.zip."
    gotcha: "Task 3.2 must land first, or every release-list fetch resolves to a github.com URL that GitHub does not serve and fetchReleases silently returns [], surfacing as 'No published FlowCharge Core release found'. Task 3.1 must also land first, or the five outbound-URL marker matches in src/test/unit/skill-content-fetch.test.ts stop matching. Do not add a fallback to the old Gitea host: the private mirror is the user's personal backup and is not authoritative."
    verify:
      - "Run `grep -c \"100.87.185.97\" src/lib/skill-content-fetch.ts`. It returned 1 at f0d4e2f and must return 0."
      - "Run `grep -n \"PRAXIS_REPO_BASE_URL = \" src/lib/skill-content-fetch.ts` and confirm the value is 'https://github.com/FlowChargeApp/flowcharge-core'."
      - "Run `npm run build`, then `node -e \"const {PRAXIS_REPO_BASE_URL}=require('./dist/lib/skill-content-fetch.js');const {releasesApiUrl}=require('./dist/lib/skill-release-fetch.js');console.log(releasesApiUrl(PRAXIS_REPO_BASE_URL));\"` and confirm it prints 'https://api.github.com/repos/FlowChargeApp/flowcharge-core/releases'."
      - "Run `npm test` and confirm 0 fail."
    checklist:
      - "Does PRAXIS_REPO_BASE_URL now name https://github.com/FlowChargeApp/flowcharge-core?"
      - "Is the export still named PRAXIS_REPO_BASE_URL?"
      - "Does no LAN address or port 8110 reference remain in src/lib/skill-content-fetch.ts?"
      - "Was no fallback to the old host introduced?"
      - "Does the file header now name the public origin rather than a self-hosted Gitea instance?"
      - "Does npm test report 0 fail?"
    self_eval:
      passed: true
      failures: []
      evidence:
        - "npm test initially reported 1 fail: the tier (c) case at src/test/unit/skill-content-fetch.test.ts:84, which downloads the newest live release and compares its skill ids against EXPECTED_IDS at :71-80. The repointed host now serves the public GitHub release, which ships a different inventory than the old LAN Gitea mirror: it drops fc-bug-hunt and fc-orchestrate and adds fc-validate and flowcharge. The count is still 8. The failure confirmed the repoint reaches the real GitHub release and that EXPECTED_IDS was a stale snapshot of the old mirror."
        - "The user was asked whether to fix EXPECTED_IDS inside this task, file it as a separate issue, or defer to the closing test gate, and chose to fix it now. Downloaded the real v0.1.0 release asset directly (flowcharge-skills-0.1.0.zip) and read its actual contents to derive the correct fixture rather than guessing: EXPECTED_IDS updated to the real 8 ids, and the 'fc-orchestrate' nested-files check in the same file (test name, variable, and the expectedFiles list) updated to target 'flowcharge' with its real bundled files (adds LICENSE, validate-issues.md, validate-plan.md, validate-tasks.md; drops the old bug-hunt.md prompt). npm test now reports 387/387."
    ```

  - [x] 3.4 Lock the GitHub release-API route into the release-fetch test
    ```yaml
    description: "Add one offline assertion proving releasesApiUrl builds GitHub's api.github.com route, so the repointed host cannot silently regress."
    author: Anthony Koukoullis
    issues: [ISS-50-92mh3i]
    implement:
      - "Open src/test/unit/skill-release-fetch.test.ts. The test named 'releasesApiUrl derives the API route from the supplied base URL' sits at lines 134-140 and already asserts two hosts: the LAN base URL held in the BASE_URL constant at :15, and 'https://example.test:9000/owner/repo/'."
      - "Add one further assert.equal inside that same test: releasesApiUrl('https://github.com/FlowChargeApp/flowcharge-core') must equal 'https://api.github.com/repos/FlowChargeApp/flowcharge-core/releases'. Keep the two existing assertions exactly as they are — they are what prove the non-GitHub route did not regress."
      - "Keep the test offline. The file header at lines 1-8 states every test here is offline by design and touches no network; pass literal strings only and issue no fetch."
      - "Add no new test function, no new import and no new fixture. Leave BASE_URL at :15, the release() helper at :17-27, and every other test in the file untouched."
    pattern: "src/test/unit/skill-release-fetch.test.ts"
    imports: "None. releasesApiUrl is already imported at :13. Add no import."
    compatibility: "node:test with node:assert/strict, matching every other case in the file. Tests run against compiled output under dist/test/, so npm run build must precede npm test."
    gotcha: "This file has no assertion-free helper module beside it, so keep the change inside the existing .test.ts file — a new assertion-free file carrying .test. in its name would double-register the importing file's cases, which CLAUDE.md bars. Task 3.2 must land first, or this assertion fails."
    verify:
      - "Run `grep -c \"api.github.com\" src/test/unit/skill-release-fetch.test.ts`. It returned 0 at f0d4e2f and must return 1."
      - "Run `npm run build`, then `node --test dist/test/unit/skill-release-fetch.test.js` and confirm 0 fail."
      - "Run `npm test` and confirm 0 fail, with a total test count equal to the 387 measured at f0d4e2f. The assertion goes inside the existing case, so the count must not rise."
    checklist:
      - "Does the file now assert the api.github.com route for a github.com base URL?"
      - "Are both pre-existing releasesApiUrl assertions unchanged?"
      - "Does the file still issue no network request?"
      - "Was no new file created and no new import added?"
      - "Does npm test report 0 fail?"
    self_eval:
      passed: true
      failures: []
      evidence:
        - "npm test initially reported 387 total (equal to the f0d4e2f baseline, so this task's assertion went inside the existing case and raised no count) with 1 fail — the same tier (c) live-network test named in task 3.1's self_eval. This file's own run reported 12 tests, 12 pass, 0 fail throughout. After the approved EXPECTED_IDS fix (task 3.3's self_eval), npm test reports 387/387."
    ```

- [x] 4. Correct the release host named in PLN-88's Open question 1

  ```yaml
  description: "Reconcile PLN-88-tpbc8f-plan.md's Open question 1 to name the confirmed release host, https://github.com/FlowChargeApp/flowcharge-core. Documentation only; no source file is edited."
  author: Anthony Koukoullis
  issues: [ISS-51-kc70n7]
  implement:
    - "Open flowcharge/workstreams/WS-106-1xers0-skill-install-target-resolution-and-lifecycle/PLN-88-tpbc8f-plan.md and read Open question 1 in full, at lines 195-202. As it stands it is titled 'Which repository's release is the source of truth?' and states that PRAXIS_REPO_BASE_URL names `akoukoullis/Praxis`, 'a repository now renamed `flowcharge-core-archive` that answers only through a 301 redirect and holds the single release `v0.1.0`', and that 'A separate `akoukoullis/flowcharge-core` repository exists on the same host and publishes no release at all.' Its Options line reads 'leave the constant alone, or repoint it', and its Recommendation is to leave the constant alone and publish a current release under the repository it already names."
    - "Rewrite the body of Open question 1 so it names https://github.com/FlowChargeApp/flowcharge-core as the confirmed release host. Record what makes it confirmed: it was verified live on 2026-09-11, it publishes release v0.1.0 carrying the asset flowcharge-skills-0.1.0.zip, and that release already holds the renamed FlowCharge skill set. Drop the claim that the archive repository is the source of truth and drop the `akoukoullis/flowcharge-core` sentence, which described a repository on the old host."
    - "Rewrite the Recommendation line so it says the constant is repointed to that confirmed host rather than left alone. Note that ISS-50-92mh3i in IL-20-cztm5x-issuelist.md carries that correction, so the reader is not left looking for it in this plan."
    - "Keep the numbered item as item 1, keep its bold question-sentence opening, and keep the Options-then-Recommendation shape the other open questions in the section use. Edit nothing outside Open question 1 — leave open questions 2 and 3, and every other line of the plan, byte-identical. Edit no source file in this task."
  pattern: "flowcharge/workstreams/WS-106-1xers0-skill-install-target-resolution-and-lifecycle/PLN-88-tpbc8f-plan.md"
  imports: "None."
  compatibility: "Markdown prose only. Do not edit the plan's frontmatter, including its status and its updated date — the plan is parked in a closed workstream and this is a factual correction to one open question, not a re-opening of the plan."
  gotcha: "PLN-88 lives in WS-106-1xers0, a different workstream from this task list's own. It stays there; do not move, copy or rename the file. Introduce no checkbox line: a `- [ ]` line inside a flowcharge artefact is counted as a task by the index generator. The repository named `flowcharge-core-archive` is a real archive and the sentence describing it may be kept as history, but it must no longer be presented as the source of truth."
  verify:
    - "Run `grep -c \"FlowChargeApp/flowcharge-core\" flowcharge/workstreams/WS-106-1xers0-skill-install-target-resolution-and-lifecycle/PLN-88-tpbc8f-plan.md`. It returned 0 at f0d4e2f and must return 1 or more."
    - "Run `grep -n \"leave the constant alone\" flowcharge/workstreams/WS-106-1xers0-skill-install-target-resolution-and-lifecycle/PLN-88-tpbc8f-plan.md` and confirm it no longer appears in Open question 1's Recommendation."
    - "Run `git diff --stat f0d4e2f -- flowcharge/workstreams/WS-106-1xers0-skill-install-target-resolution-and-lifecycle/PLN-88-tpbc8f-plan.md` and confirm this task changed that one file only."
    - "Run `sed -n '190,215p' flowcharge/workstreams/WS-106-1xers0-skill-install-target-resolution-and-lifecycle/PLN-88-tpbc8f-plan.md` and read the result: open questions 2 and 3 must be unchanged."
  checklist:
    - "Does Open question 1 now name https://github.com/FlowChargeApp/flowcharge-core as the confirmed host?"
    - "Does its Recommendation now say the constant is repointed rather than left alone?"
    - "Does it cite ISS-50-92mh3i as the artefact carrying that correction?"
    - "Are open questions 2 and 3, and the plan's frontmatter, unchanged?"
    - "Was no source file edited and no checkbox line introduced?"
  self_eval:
    passed: true
    failures: []
    evidence:
      - "`grep -c \"FlowChargeApp/flowcharge-core\" ...PLN-88-tpbc8f-plan.md` returned 0 before the edit and returns 1 after it."
      - "`grep -n \"leave the constant alone\" ...PLN-88-tpbc8f-plan.md` matched line 199 and line 200 before the edit and now returns no match (exit 1)."
      - "`git diff --stat f0d4e2f -- ...PLN-88-tpbc8f-plan.md` reports 1 file changed, 12 insertions, 8 deletions. The full diff shows one hunk at `@@ -192,14 +192,18 @@`, inside Open question 1 only."
      - "`sed -n '190,222p' ...PLN-88-tpbc8f-plan.md` shows open questions 2 and 3 byte-identical to the base, and the diff touches no frontmatter line."
      - "`git diff f0d4e2f -- ...PLN-88-tpbc8f-plan.md | grep -c \"^+.*- \\[ \\]\"` returns 0, so no checkbox line was introduced. No source file was edited."
  ```

- [ ] 5. Test gate

  ```yaml
  description: "Build and run the full suite. Do not merge while anything fails."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Run the full suite with `npm test`. Its pretest step builds first, so no separate build call is needed."
    - "If anything fails, do not merge. Record every failure in a new issue list in this workstream, author tasks for those issues, execute them on this same branch, then run the gate again. Repeat until the suite is green. No fix goes in unrecorded."
  pattern: "The whole repository."
  imports: "None."
  compatibility: "Tests run against compiled output under dist/, plus .github/scripts/**/*.test.mjs from source."
  gotcha: "A failure here may come from a task in this list or from anything else on the branch. Record it either way; the gate is a gate, not a change detector."
  verify:
    - "Run `npm test` and confirm it exits 0 with 0 fail."
  checklist:
    - "Did npm test complete without a build error?"
    - "Does the run report 0 fail?"
    - "Is every failure, if any, recorded in a new issue list in this workstream?"
    - "Is the branch left unmerged while any failure stands?"
  self_eval:
    passed: false
    failures: []
  ```

- [ ] 6. ARCHITECTURE.md review

  ```yaml
  description: "Review every section of ARCHITECTURE.md against this branch's real diff and update what no longer matches the code."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Produce the branch's real diff with `git diff f0d4e2f..HEAD`, and read it in full."
    - "Review every section of ARCHITECTURE.md against that diff. Update what no longer matches the code. Decide the edits from the diff itself; this task names no section and forecasts no edit."
    - "Regenerate through the atd-generate-architecture skill rather than hand-editing whole sections."
  pattern: "ARCHITECTURE.md"
  imports: "None."
  compatibility: "ARCHITECTURE.md keeps its fixed 11-section structure. It is too large to load in full; read it by section."
  gotcha: "The review passes only when every Mermaid block still parses and each component, type and endpoint keeps the same name across sections."
  verify:
    - "Confirm every section of ARCHITECTURE.md has been read against `git diff f0d4e2f..HEAD`."
    - "Confirm every Mermaid block in ARCHITECTURE.md still parses."
    - "Confirm each component, type and endpoint name is spelled identically in every section that mentions it."
  checklist:
    - "Was the real diff read before any edit was made?"
    - "Does every section that the diff affects now match the code?"
    - "Does every Mermaid block still parse?"
    - "Is each component, type and endpoint name consistent across sections?"
  self_eval:
    passed: false
    failures: []
  ```

## Skipped

Two issues in `IL-20-cztm5x` carry no decided fix direction, so no task is authored from
either. Both stay open in the issue list.

1. **ISS-32-3hfjhe — the install-removal capability has no interface control.** Its own
   notes state that the direction is undecided and that a maintainer must choose one
   before any task is authored from it. Its status is `blocked` on that decision. Authoring
   a task here would mean designing an interface control the issue deliberately does not
   name.
2. **ISS-46-j993sr — a legacy single-path ledger record leaves a cleanup unable to find
   the rest.** Its own notes record that deriving the unrecorded paths was already refused
   once, because it could delete files this app never wrote, and that the issue names no
   direction and recommends none. Any task here would have to invent that direction.

## Divergences

1. **ISS-38-gv3p2x cites line numbers the file no longer carries.** The issue names
   `ruleDirectoryWrites` at `src/lib/agentic-tools-format.ts:48-53`, `singleDocumentWrite`
   at `:58-61` and `skillDirectoryWrites` at `:31-42`. Read at `f0d4e2f`, those three
   functions sit at `:56-61`, `:66-69` and `:39-50`. The functions, their names and the
   defect are unchanged; only the offsets moved. Task 1's anchors are taken from the file
   as read, not from the issue.
2. **ISS-50-92mh3i's fix does not fit in the one line the issue names.** The issue names
   `src/lib/skill-content-fetch.ts:63` alone. Measured at `f0d4e2f`,
   `releasesApiUrl(baseUrl)` in `src/lib/skill-release-fetch.ts:34-38` returns
   `https://github.com/api/v1/repos/FlowChargeApp/flowcharge-core/releases` for the new
   host, which GitHub does not serve — GitHub's route is
   `https://api.github.com/repos/<owner>/<repo>/releases`. Separately,
   `RELEASES_API_MARKER` at `src/test/unit/skill-content-fetch.test.ts:146` is
   `'/api/v1/repos/'`, which four tests match outbound URLs against and which stops
   matching once the host changes. The issue asked for neither of those two edits: its
   notes say `Repointing this constant corrects the address only`. This task list widened
   the scope on its own finding that `releasesApiUrl` in `src/lib/skill-release-fetch.ts`
   and the test constant must change as well before the new URL resolves correctly, so
   ISS-50-92mh3i is tasked as parent task 3 over four files rather than as one line.
   `buildAssetDownloadUrl` at
   `src/lib/skill-release-fetch.ts:44-46` needs no change: its output was verified live on
   2026-09-11 and answered 200 against the GitHub release asset.
3. **ISS-47-yug5gc cites line numbers the two files no longer carry.** The issue names the
   `selectPrimaryFormat` call at `src/lib/agentic-tools-skill-presence.ts:35`, the
   `formatForTarget` call at `:44` and the single-path join and `pathExists` call at
   `:53-54`, plus `deprecatedFallback` at `src/lib/agentic-tools-catalogue.ts:21` and the
   Cursor and Windsurf entries that set it at `:111` and `:154`. Read at `f0d4e2f`, those
   anchors sit at `:42`, `:51` and `:62-63` in the first file, and at `:28`, `:132` and
   `:177` in the second. The functions, their names and the defect are unchanged; only the
   offsets moved. Task 2's anchors are taken from the files as read, not from the issue.
