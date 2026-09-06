---
id: TL-49-e92ogd
type: tasklist
workstream: WS-51-uo7ifn
slug: add-security-controls
title: "Add security controls — origin guard, CSP, documented unsigned builds"
status: done
created: 2026-08-21
updated: 2026-08-21
author: Anthony Koukoullis
depends_on: [PLN-41-yosiyo]
links: []
mode: spec
base_commit: ba07d0b
---

# PRX Tasks

## Add three security controls

This list implements `PLN-41-yosiyo`. It adds three independent security controls to a
dashboard that has none of them today. Each control has one server-side enforcement
point, because both clients — a browser tab and the Electron window — reach the same
`src/server.ts` over loopback.

Phase 1 adds request-origin validation to `src/server.ts`. One guard checks the `Host`
header against IP literals, `localhost`, and a new `ALLOWED_HOSTS` environment variable,
and checks `Origin` against `Host` when `Origin` is present. A second, smaller check
inside `handleApi` requires `Content-Type: application/json` on `POST` and `PATCH`.
Together they close DNS rebinding and the CORS-free cross-origin `POST`. All three
rejections answer `403` through the existing `sendJson` helper.

Phase 2 adds one `Content-Security-Policy` header to the static-file response. Two
inline `style` attributes in `src/public/board.html` must move to the `hidden` attribute
first, because `style-src 'self'` blocks style attributes. A global
`[hidden] { display: none !important; }` rule replaces the removed inline styles.

Phase 3 records in `README.md` that packaged builds are unsigned and unnotarized, gives
the quarantine workaround, and lists signing as a prerequisite of any distribution.
No signing, no notarization, and no `package.json` change is part of this work.

Out of scope, per the plan: LAN-mode authentication, the cleartext-skill-fetch finding,
the Windows NSIS build-target gap, any change to `electron/main.cts`, any change to the
startup warning at `src/server.ts:332-344`, removing the `.add-form[hidden]` rule at
`src/public/styles.css:625`, and any new test harness for `src/server.ts`.

- [x] 1. Phase 1 — request-origin validation

  ```yaml
  description: "Add the Host/Origin guard and the JSON Content-Type requirement to src/server.ts, and document the new ALLOWED_HOSTS variable. Riskiest phase: it is the only one that can break both clients."
  ```

  - [x] 1.1 Host and Origin guard in `src/server.ts`
    ```yaml
    description: "Add ALLOWED_HOSTS, hostnameOf, and passesOriginCheck, and call the guard at the top of the createServer callback."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Add `import net from 'node:net'` to the import block at the top of src/server.ts, beside the existing node: built-in imports. It is a Node built-in, so the repo keeps its no-runtime-dependency property."
      - "Add a module-level `ALLOWED_HOSTS: ReadonlySet<string>` constant immediately after the `LOOPBACK_HOSTS` / `isLoopbackHost` helpers (currently src/server.ts:38-42). Build it from `process.env.ALLOWED_HOSTS ?? ''`, split on commas, trim and lowercase each name, and drop empty entries. Read it once at module scope exactly as `port` and `host` are read at src/server.ts:12-13. Comment it as the extra hostnames the server answers to beyond IP literals and `localhost`."
      - "Add `function hostnameOf(hostHeader: string | undefined): string | null` beside it. Return the bare hostname from a Host header value, or null when the header is absent or unparseable. Build it on `new URL('http://' + hostHeader)` and read `.hostname`. Strip the brackets a WHATWG URL keeps on an IPv6 literal, so `[::1]:4173` yields `::1`. Catch the constructor throw for a malformed Host and return null."
      - "Add `function passesOriginCheck(req: http.IncomingMessage, res: http.ServerResponse): boolean` beside it. It returns true when the request may proceed, and writes its own 403 through the existing `sendJson` helper and returns false when it may not."
      - "Check one, inside passesOriginCheck: `hostnameOf(req.headers.host)` must be non-null, and must satisfy `net.isIP(hostname) !== 0 || hostname === 'localhost' || ALLOWED_HOSTS.has(hostname)`. An absent Host header therefore fails. Reject with sendJson(res, 403, { error: ... })."
      - "Check two, in that order after check one: when `req.headers.origin` is present it must equal `'http://' + req.headers.host`, compared case-insensitively against the RAW Host header value so the port is included. An absent Origin passes — Electron's loopbackRequest sends none. `Origin: null` fails, because it never equals `http://` plus a host. Reject with 403 through sendJson."
      - "Call the guard in the `http.createServer` callback (currently src/server.ts:298-308), immediately after `reqPath` is computed and BEFORE the path-traversal check, so it covers every route including static files. Shape: `if (!passesOriginCheck(req, res)) return;`"
      - "Keep the guard header-only. It must not know about routes, project ids, the registry, or the extractor, and no route handler re-checks origin — validation stays at the boundary, as the comment at src/server.ts:129-133 already states for path validation."
      - "Add no Access-Control-Allow-* header anywhere. Sending none is the intended posture."
      - "Leave the startup warning inside server.listen (src/server.ts:332-344) untouched."
    pattern: "src/server.ts only. No other file changes in this task."
    imports: "node:net (new, built-in). Uses the existing http import, the existing sendJson helper, and process.env."
    compatibility: "Both HTTP clients must keep working. src/public/browser-ipc-shim.ts sends a same-origin Origin from the page. electron/main.cts loads http://127.0.0.1:4173, an IP literal, so its Host passes check one and its same-origin Origin passes check two. electron/ipc-handlers.cts sends no Origin at all. Error bodies must keep the { error: string } shape that src/public/browser-ipc-shim.ts and electron/ipc-handlers.cts already parse — use sendJson, never a raw res.end."
    gotcha: "An IP-literal allowance is required, not optional — `npm run start:lan` is reached by typing the machine's LAN IP, so a loopback-only allowlist would 403 that whole mode. WHATWG URL.hostname returns an IPv6 literal still wrapped in brackets, so strip them or `::1` never matches net.isIP. Compare Origin against the raw Host header, not the parsed hostname, or the port makes every comparison fail. The guard must sit before the traversal check, not after, or static files stay unguarded."
    verify:
      - "npm run build — compiles cleanly with no TypeScript error."
      - "Start the server with npm start in one shell, then in another: curl -sS -o /dev/null -w '%{http_code}\\n' http://127.0.0.1:4173/ returns 200."
      - "curl -sS -o /dev/null -w '%{http_code}\\n' -H 'Host: evil.example' http://127.0.0.1:4173/api/projects returns 403."
      - "curl -sS -o /dev/null -w '%{http_code}\\n' -H 'Origin: http://evil.example' http://127.0.0.1:4173/api/projects returns 403."
      - "curl -sS -o /dev/null -w '%{http_code}\\n' -H 'Origin: null' http://127.0.0.1:4173/api/projects returns 403."
      - "Stop the server, run ALLOWED_HOSTS=board.local npm start, then curl -sS -o /dev/null -w '%{http_code}\\n' -H 'Host: board.local' http://127.0.0.1:4173/api/projects returns 200."
      - "curl -sI http://127.0.0.1:4173/ | grep -ci 'access-control-allow' returns 0."
      - "Open the home page and a board in a browser tab; both still load and the project list still renders."
    checklist:
      - "Does an IP-literal Host (127.0.0.1, ::1 in brackets, a LAN address) still get served?"
      - "Does a Host of localhost still get served, and any other bare name get 403 unless listed in ALLOWED_HOSTS?"
      - "Does a request with no Host header get 403, and a request with no Origin header pass?"
      - "Does every rejection go through sendJson with a { error: string } body and status 403?"
      - "Is the guard called before the path-traversal check, so static files are covered?"
      - "Is src/server.ts the only file changed, with no Access-Control-Allow-* header added anywhere?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.2 JSON `Content-Type` requirement in `src/server.ts`
    ```yaml
    description: "Add isJsonContentType and require application/json on POST and PATCH at the top of handleApi."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Add `function isJsonContentType(header: string | undefined): boolean` at module level in src/server.ts, beside the other small header helpers. It returns true only when the header's media type is exactly application/json. Split off any parameters at the first semicolon, trim, and lowercase, so `application/json; charset=utf-8` passes. An absent header returns false."
      - "Inside handleApi (currently src/server.ts:179-181), immediately after `const method = req.method ?? 'GET'` and BEFORE any route match, reject a POST or PATCH whose Content-Type is not JSON: when `(method === 'POST' || method === 'PATCH') && !isJsonContentType(req.headers['content-type'])`, call sendJson(res, 403, { error: 'Content-Type must be application/json' }) and return."
      - "Use 403, not 415 — the settled decision is one uniform rejection shape across all three checks in this phase."
      - "Place the check before any body is read, so readRequestBody never runs for a rejected request."
      - "Leave GET and DELETE untouched. They carry no body and are already unreachable cross-origin through the preflight they force."
    pattern: "src/server.ts only. Shares the file with task 1.1 but is an independent change."
    imports: "None beyond what src/server.ts already imports. Uses the existing sendJson helper."
    compatibility: "Both clients already send the header: src/public/browser-ipc-shim.ts:17 sets 'Content-Type': 'application/json' on every request with a body, and electron/ipc-handlers.cts:31 sets the same. Neither needs a change. The existing 400 responses for a bad path or a missing flowcharge/ folder must still be reachable for a correctly typed request."
    gotcha: "The header arrives with parameters attached in real requests, so a naive === 'application/json' comparison rejects the browser's own charset-suffixed value. Do not move the check inside a route branch: it belongs above every route match so no future route can be added below it and miss it."
    verify:
      - "npm run build — compiles cleanly with no TypeScript error."
      - "With the server running: curl -sS -o /dev/null -w '%{http_code}\\n' -X POST -H 'Content-Type: text/plain' --data '{\"path\":\"/tmp\"}' http://127.0.0.1:4173/api/projects returns 403."
      - "The same request with -H 'Content-Type: application/json' returns the existing 400 about flowcharge/, proving the check runs before the body is read and does not change valid requests."
      - "curl -sS -o /dev/null -w '%{http_code}\\n' http://127.0.0.1:4173/api/projects (a GET) still returns 200."
      - "In a browser tab, add a project and rename it from the home page; both still work."
      - "Run npm run electron:dev and confirm the app still lists projects, opens a board, and opens a detail modal."
    checklist:
      - "Is a POST or PATCH with a non-JSON Content-Type answered 403 with a { error: string } body?"
      - "Is a Content-Type of application/json; charset=utf-8 accepted?"
      - "Is an absent Content-Type on POST or PATCH rejected?"
      - "Does the check run before readRequestBody, and before any route match?"
      - "Do GET and DELETE routes behave exactly as before?"
      - "Is src/server.ts the only file changed, with no client-side change needed?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.3 Document `ALLOWED_HOSTS` in `README.md`
    ```yaml
    description: "Add one line to the Notes section describing the new ALLOWED_HOSTS environment variable, beside the existing HOST note."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In README.md, in the Notes section (heading at README.md:85), add one bullet immediately after the existing bullet that starts 'The server binds `127.0.0.1` by default' (README.md:94-99)."
      - "State three things in that one bullet: the variable is named ALLOWED_HOSTS, its value is a comma-separated list of hostnames the server will also answer to, and IP literals and `localhost` are always accepted so the default empty value needs no configuration."
      - "Say why it exists: reaching a `npm run start:lan` server by a hostname rather than an IP address returns 403 until that name is listed."
      - "Match the surrounding prose style. Change no other section of README.md, and do not touch the packaged-build content that task 3 adds."
    pattern: "README.md only, the Notes section."
    imports: "None."
    compatibility: "The wording must agree with the guard as built in task 1.1 — the same allowlist rule, the same comma-separated format, the same 403 status. Keep the existing HOST bullet intact; the two bullets are read together."
    gotcha: "Do not describe ALLOWED_HOSTS as a way to open the server to the network — HOST does that, and this variable only widens the accepted Host header. Conflating the two would misdescribe the security posture the README already documents."
    verify:
      - "Read the Notes section: the HOST sentence and the new sentence agree and do not contradict each other."
      - "grep -c 'ALLOWED_HOSTS' README.md returns at least 1."
      - "git diff --stat shows README.md as the only file changed by this task."
    checklist:
      - "Does the new line name ALLOWED_HOSTS and state its comma-separated format?"
      - "Does it state that IP literals and localhost are always accepted?"
      - "Does it explain the 403 a start:lan user reaching the board by hostname would otherwise see?"
      - "Does it sit in the Notes section beside the existing HOST bullet?"
      - "Is the rest of README.md unchanged?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Phase 2 — Content-Security-Policy

  ```yaml
  description: "Remove the two inline style attributes and add the global [hidden] rule first, then send the CSP header from the static-file response. Order matters: the header must not ship before the inline styles are gone."
  ```

  - [x] 2.1 Replace the two inline `style` attributes in `src/public/board.html`
    ```yaml
    description: "Change the branch line and the lower panels from style=\"display:none\" to the hidden attribute."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/public/board.html at line 23, the `<span id=\"branch-line\" style=\"display:none\">` inside the .meta div: replace the style attribute with a bare `hidden` attribute. Change nothing else on the line — the `<br>Branch <strong id=\"branch-name\"></strong>` content and the trailing `<br>` stay exactly as they are."
      - "In src/public/board.html at line 59, `<div class=\"lower\" id=\"lower\" style=\"display:none\">`: replace the style attribute with a bare `hidden` attribute, keeping the class and id."
      - "Add no other attribute, and change no other element. The inline `<svg>` at src/public/board.html:46 keeps its stroke and fill presentation attributes — CSP does not restrict those, and they are not style attributes."
      - "Do not add a <meta http-equiv=\"Content-Security-Policy\"> tag. The policy is sent as a response header by task 2.4."
    pattern: "src/public/board.html only, lines 23 and 59."
    imports: "None."
    compatibility: "The hidden attribute is the codebase's own convention for this — see the already-hidden `<div class=\"card-tags\" id=\"ws-modal-tags\" hidden>` at src/public/board.html:99. The elements are revealed by script in task 2.2, and the global CSS rule that makes hidden win over the class display rules comes in task 2.3."
    gotcha: "Between this task and task 2.3, #lower is styled `display: grid` by .lower at src/public/styles.css:386, which has the same specificity as a bare [hidden] rule and no !important yet — so the panels may briefly appear before data arrives if this task ships alone. Ship 2.1, 2.2, and 2.3 together."
    verify:
      - "npm run build — the copy-assets step succeeds and dist/public/board.html carries the change."
      - "grep -c 'style=\"' src/public/board.html returns 0."
      - "grep -c 'hidden' src/public/board.html shows the branch-line and lower elements now carry the attribute."
    checklist:
      - "Does src/public/board.html contain zero style=\"...\" attributes?"
      - "Do #branch-line and #lower each carry a bare hidden attribute?"
      - "Is the content and structure of both elements otherwise unchanged?"
      - "Was no meta CSP tag added to the file?"
      - "Is src/public/board.html the only file changed by this task?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.2 Reveal both elements through `.hidden` in `src/public/app.ts`
    ```yaml
    description: "Replace the two style.display writes with hidden = false, matching the file's own convention."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/public/app.ts at line 1006, inside the `if (raw.branch)` block that also sets byId('branch-name').textContent: replace `byId('branch-line').style.display = '';` with `byId('branch-line').hidden = false;`."
      - "In src/public/app.ts at line 1008, immediately after that block: replace `byId('lower').style.display = '';` with `byId('lower').hidden = false;`."
      - "Change nothing else in the function. Leave every other style.display write in the file alone — CSP does not restrict CSSOM writes, and only these two pair with the markup edited in task 2.1."
    pattern: "src/public/app.ts, the two lines at 1006 and 1008 inside the data-render path."
    imports: "None. byId is already defined in the file."
    compatibility: "`.hidden = false` is this codebase's own convention, used at src/public/app.ts:387, src/public/app.ts:802, and src/public/home.ts:334-338. byId's return type must allow .hidden — it is an HTMLElement property, so no cast should be needed under the browser tsconfig at src/public/tsconfig.json."
    gotcha: "The branch line is revealed only inside `if (raw.branch)`, so it must stay inside that block — moving it out would show an empty Branch label for a non-git project. #lower is revealed unconditionally after it; keep that ordering."
    verify:
      - "npm run build — the browser tsconfig project compiles with no TypeScript error."
      - "grep -n \"style.display\" src/public/app.ts shows neither branch-line nor lower among the remaining hits."
      - "npm start, then open a board: before data arrives neither the lower panels nor the branch line is visible; after data arrives the lower panels appear and the branch line appears when the project is a git repository."
    checklist:
      - "Are both writes now `.hidden = false` rather than style.display?"
      - "Does the branch-line reveal still sit inside the `if (raw.branch)` block?"
      - "Does the #lower reveal still run for every project, git or not?"
      - "Do the other style.display writes elsewhere in the file remain untouched?"
      - "Is src/public/app.ts the only file changed by this task?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.3 Global `[hidden]` rule and comment correction in `src/public/styles.css`
    ```yaml
    description: "Add [hidden] { display: none !important; } to the base element section, and correct the stale comment that says the file carries no [hidden] rule."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Add `[hidden] { display: none !important; }` to the base element section of src/public/styles.css — the block of element-level rules at lines 120-134 that holds `* { box-sizing: border-box; }`, `html, body`, `::selection`, `a`, `.tab`, and `button`."
      - "Comment the rule with why !important is required: [hidden] has the same specificity as a single class, so without it the `display: grid` on .lower (src/public/styles.css:386) and the `display: flex` on .card-tags (src/public/styles.css:356) would win on source order and re-reveal an element the markup marked hidden."
      - "Correct the stale comment in the Plan body section at src/public/styles.css:951-957. It currently states that the panels rely on the user-agent default and that 'this file carries no [hidden] rule'. That sentence becomes false. Rewrite it to say the panels rely on the global [hidden] rule in the base element section. Keep the rule it states — no display rule may reach a panel div — and note that it is now enforced by !important."
      - "Leave the `.add-form[hidden] { display: none; }` rule at src/public/styles.css:625 exactly as it is. Removing it is explicitly out of scope for this plan."
      - "Expect one deliberate visual change: #ws-modal-tags at src/public/board.html:99 carries hidden but is styled `display: flex` by .card-tags, so today it is a zero-height flex box that still contributes its margin-bottom: 6px. The new rule collapses it properly, removing 6px above the modal date row when a workstream has no tags. This is expected, not a regression."
    pattern: "src/public/styles.css — one new rule in the base element section, and one comment correction in the Plan body section."
    imports: "None."
    compatibility: "The rule must beat both .lower (display: grid, src/public/styles.css:386) and .card-tags (display: flex, src/public/styles.css:356), which is what !important buys independently of source order. The modal tab panels already depend on the hidden attribute, so the rule reinforces their behaviour rather than changing it."
    gotcha: "A bare [hidden] { display: none; } is not enough and must not be substituted — it works only by source order, and the first class rule added below it silently re-reveals a hidden element. Place the rule in the base section, not at the end of the file. Do not delete src/public/styles.css:625 while doing this."
    verify:
      - "npm run build — copy-assets succeeds and dist/public/styles.css carries the rule."
      - "grep -n '\\[hidden\\]' src/public/styles.css shows the new global rule in the base section and the untouched .add-form[hidden] rule at its original place."
      - "grep -c 'carries no \\[hidden\\] rule' src/public/styles.css returns 0."
      - "npm start and open a board: before data arrives the lower panels are not visible; after data arrives they appear as a two-column grid."
      - "Open the detail modal on a workstream with no tags and confirm no empty gap sits above the dates row, and that the modal tabs still switch panels correctly."
    checklist:
      - "Does the base element section contain [hidden] { display: none !important; } with a comment explaining !important?"
      - "Do the lower panels stay hidden before data and render as a two-column grid after data?"
      - "Does the corrected comment describe the global rule instead of claiming the file has none?"
      - "Is .add-form[hidden] at src/public/styles.css:625 still present and unmodified?"
      - "Do the modal tab panels still show exactly one panel at a time?"
      - "Is src/public/styles.css the only file changed by this task?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.4 Send the `Content-Security-Policy` header from `src/server.ts`
    ```yaml
    description: "Add the policy constant and include it in the static-file 200 response head."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Add a module-level constant in src/server.ts, beside the MIME table at src/server.ts:15-23, holding exactly this policy string: default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'"
      - "Include it as a 'Content-Security-Policy' entry in the `res.writeHead(200, { 'Content-Type': ... })` object on the static-file success path (currently src/server.ts:326-328), so every HTML, JS, CSS, and font response carries it."
      - "Leave the 404 static response at src/server.ts:321-324 unchanged, and leave sendJson unchanged. The policy protects the two HTML documents and the assets they pull; a JSON error body executes nothing."
      - "Do not add a <meta http-equiv> policy to either HTML file, and do not add a session.webRequest policy in electron/main.cts. Electron loads these pages from this same server over loopback, so it already receives this header — a second copy would drift."
      - "Ship this only after tasks 2.1, 2.2, and 2.3 are done. Shipping it first would break the two inline styles."
    pattern: "src/server.ts — one new constant and one added header on the static-file 200 response."
    imports: "None. Uses the existing http and fs imports."
    compatibility: "Every asset was audited against this policy: scripts are separate same-origin files (ipc-adapter.js, browser-ipc-shim.js, app.js, home.js, lib/agentic-tools-scope.js); styles.css is a same-origin <link>; the only font is the local src/public/fonts/fraunces-latin.woff2 served as font/woff2 by the MIME table at src/server.ts:22; the only fetch calls go to /api/* from src/public/browser-ipc-shim.ts. There are no remote origins, no data: URIs, and no <img> elements."
    gotcha: "The header must go on the 200 branch inside the fs.readFile callback, not on the outer request, or /api/ JSON responses would carry it too. If any style attribute survives in src/public/board.html, style-src 'self' blocks it and the branch line or lower panels break — confirm task 2.1's grep returns 0 first. The Fraunces @font-face at src/public/styles.css:1-7 is same-origin and must keep loading; a CSP violation on font-src means copy-assets did not place the woff2 in dist/."
    verify:
      - "npm run build — compiles cleanly with no TypeScript error."
      - "npm start, then curl -sI http://127.0.0.1:4173/board.html | grep -i content-security-policy prints the policy."
      - "curl -sI http://127.0.0.1:4173/styles.css | grep -i content-security-policy prints the same header."
      - "Open / and /board.html?project=<id> in a browser: the console shows zero CSP violation messages, the Fraunces headings render, the board cards, KPI strip, and both lower panels render, and the detail modal opens and switches tabs — in both light and dark themes."
      - "Run npm run electron:dev and confirm the window renders both pages with no CSP violation in its console."
      - "git diff --stat for this task shows src/server.ts as the only changed file — electron/main.cts and package.json are untouched."
    checklist:
      - "Does every static 200 response carry the exact policy string, including frame-ancestors 'none'?"
      - "Do both pages load with zero CSP violations in a browser console and in the Electron console?"
      - "Does the local Fraunces font still load under font-src 'self'?"
      - "Are the 404 static response and all sendJson responses left without the header?"
      - "Was no <meta> CSP tag and no Electron session policy added?"
      - "Is src/server.ts the only file changed by this task?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 3. Phase 3 — document the unsigned packaged-build status in `README.md`
  ```yaml
  description: "Record that packaged builds are unsigned and unnotarized, give the quarantine workaround, and list signing as a prerequisite of any distribution. Documentation only."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Add a short packaged-build subsection to README.md — either under the existing Notes heading at README.md:85, or as its own 'Packaged builds' subsection near it."
    - "State that builds produced by npm run package:mac, npm run package:linux, and npm run package:win are unsigned and unnotarized, and are intended for the author's own machine only."
    - "State that a build made and run on the same machine carries no quarantine attribute, so Gatekeeper never prompts and the unsigned status costs nothing in that use."
    - "Give the workaround for a build copied to another machine, and say when it is needed: xattr -dr com.apple.quarantine \"Praxis Board.app\"."
    - "List, as prerequisites of any distribution to other people rather than as follow-ups: an Apple Developer Program membership and a Developer ID certificate; the hardenedRuntime, entitlements, and notarize keys added to the mac block of package.json's build section; a Windows OV certificate or Azure Trusted Signing wired through win.signtoolOptions; and all credentials moved into CI secrets, which also needs a macOS runner this repo does not have today."
    - "State that Linux deb and AppImage have no signature gate, so nothing is needed there."
    - "Change no code, no package.json, and no build configuration. This phase is prose only."
  pattern: "README.md only. It may ship before phases 1 and 2 — it is ordered last only because it carries no risk."
  imports: "None."
  compatibility: "The named scripts must match package.json as it stands: package:mac, package:linux, package:win. The mac, linux, and win target blocks described must match the build section of package.json without changing it. Match the README's existing prose style and its opening statement that this is private, closed-source software."
  gotcha: "Do not present signing as a later improvement — the plan's point is that it is a prerequisite of the first distribution. Do not add the signing keys to package.json while documenting them; package.json must be unchanged by this phase. Do not describe the Windows arm64-only NSIS target as a gap to fix — that is explicitly out of scope."
  verify:
    - "Read the new section: it states the unsigned and unnotarized status, gives the xattr command with the condition under which it is needed, and lists the prerequisites as prerequisites of distribution."
    - "grep -c 'com.apple.quarantine' README.md returns at least 1."
    - "git diff --stat shows README.md as the only changed file for this task, and git diff package.json is empty."
  checklist:
    - "Does the section state that packaged builds are unsigned, unnotarized, and for the author's own machine only?"
    - "Does it give xattr -dr com.apple.quarantine \"Praxis Board.app\" and say when it is needed?"
    - "Does it list the macOS, Windows, and CI prerequisites as prerequisites of distribution rather than follow-ups?"
    - "Does it state that Linux deb and AppImage need nothing?"
    - "Is package.json unchanged, and is README.md the only file touched?"
  self_eval:
    passed: true
    failures: []
  ```
