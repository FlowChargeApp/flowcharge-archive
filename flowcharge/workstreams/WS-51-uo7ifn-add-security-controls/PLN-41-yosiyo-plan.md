---
id: PLN-41-yosiyo
type: plan
workstream: WS-51-uo7ifn
slug: add-security-controls
title: "Request-origin validation, a Content-Security-Policy, and documented unsigned builds"
status: done
created: 2026-08-21
updated: 2026-08-21
depends_on: []
links: []
---

# Add three security controls

## Summary

This plan adds three security controls that the codebase does not have today. None of
them fixes broken code; each closes a class of attack the current design leaves open.

1. **Request-origin validation.** One guard in `src/server.ts` checks the `Host` header
   against an allowlist, and checks `Origin` against `Host` when `Origin` is present.
   A second, smaller check inside `handleApi` requires `Content-Type: application/json`
   on `POST` and `PATCH`. Together these close DNS rebinding and the CORS-free
   cross-origin `POST`.
2. **Content-Security-Policy.** One `Content-Security-Policy` response header on the
   static-file response in `src/server.ts`. Two inline `style` attributes in
   `src/public/board.html` must move to the `hidden` attribute first, because
   `style-src 'self'` blocks style attributes.
3. **Unsigned packaged builds, documented.** No signing or notarization is added. The
   `README.md` records the unsigned status, the one-line quarantine workaround, and
   the exact prerequisites to sign before any distribution to other people.

The chosen approach is **one server-side enforcement point per control**. Both browser
tabs and Electron reach the same `src/server.ts` over loopback, so a check placed in the
server covers both clients with one copy of each rule. This matches how the codebase
already works: `electron/ipc-handlers.cts` states in its own header comment that no
validation logic lives there and every rule keeps running inside `server.ts`.

The three items are independent and ship as three separate phases, riskiest first.

## Scope

### Acceptance criteria — Phase 1, request-origin validation

- A request whose `Host` header hostname is an IP literal is served normally. This
  covers `127.0.0.1:4173`, `[::1]:4173`, and the LAN address a `npm run start:lan`
  user types, such as `192.168.1.10:4173`.
- A request whose `Host` header hostname is `localhost` is served normally.
- A request whose `Host` header hostname is any other name is answered `403` with a
  JSON error body, unless that name appears in the new `ALLOWED_HOSTS` list.
- A request with no `Host` header at all is answered `403`.
- A request that carries an `Origin` header not equal to `http://` plus the raw `Host`
  header value is answered `403`. This includes `Origin: null`.
- A request that carries no `Origin` header passes the `Origin` check. Electron's
  `loopbackRequest` in `electron/ipc-handlers.cts` sends none.
- No response carries any `Access-Control-Allow-*` header. The server never opts in to
  a cross-origin read.
- A `POST /api/projects` or `PATCH /api/projects/<id>` whose `Content-Type` is not
  `application/json` is answered `403` with a JSON error body, before the body is read.
- The home page still adds, renames, and removes projects in a plain browser tab.
- The Electron app still lists projects, opens a board, and opens a detail modal.

### Acceptance criteria — Phase 2, Content-Security-Policy

- `curl -I http://127.0.0.1:4173/board.html` shows a `Content-Security-Policy` header
  carrying the policy in the Design section.
- `curl -I http://127.0.0.1:4173/styles.css` shows the same header.
- Loading `/` and `/board.html?project=<id>` in a browser produces zero CSP violation
  messages in the console.
- The Fraunces heading font still loads. The board still renders cards, KPI strip,
  lower panels, and the detail modal in both light and dark themes.
- The Electron window still renders both pages with no CSP violation in its console.
- `src/public/board.html` contains no `style="..."` attribute.
- The branch line stays hidden until data arrives, then appears when `raw.branch` is
  set. The lower panels stay hidden until data arrives, then appear as a two-column
  grid.

### Acceptance criteria — Phase 3, documented unsigned builds

- `README.md` states that packaged builds are unsigned and unnotarized, and are for the
  author's own machine only.
- `README.md` gives the `xattr -dr com.apple.quarantine "Praxis Board.app"` workaround
  and says when it is needed.
- `README.md` lists the prerequisites that must be met **before** any distribution to
  other people, and states that signing is a prerequisite of distribution rather than a
  follow-up to it.
- `package.json` is unchanged by this phase.

### Out of scope

- Finding A, "LAN mode has no authentication". The README already records this as a
  deliberate, accepted trade-off. No authentication, no tokens, no sessions are planned.
- The excluded cleartext-skill-fetch finding.
- The Windows NSIS `arm64`-only build-target gap in `package.json`. This is an
  unrelated observation and is not planned here.
- Actually signing or notarizing anything. Phase 3 is a documentation change only.
- Any change to `electron/main.cts`'s `session` or `webRequest`. The server header
  already covers the Electron window, which loads pages from this same server.
- Any change to the startup warning at `src/server.ts:334-343`.
- Removing the now-redundant `.add-form[hidden]` rule at `src/public/styles.css:625`.
  See Open questions, item 4.
- Any new test harness for `src/server.ts`. See Testing strategy.

### Assumptions

These are assumptions, not confirmed decisions. Each is stated so it can be struck.

1. **No production data, no live users, no rollback constraint.** This is a private,
   closed-source, single-developer tool run from the author's own machine, per the
   README's opening lines. The app does not need to stay shippable mid-feature, no
   feature flag is planned, and rollback is `git revert` of the phase's commit.
2. **`ALLOWED_HOSTS` is an environment variable**, read once at startup like the
   existing `PORT` and `HOST` at `src/server.ts:12-13`. Its value is a comma-separated
   list of hostnames. It is empty by default, so the default posture is IP literals and
   `localhost` only. No config file and no CLI flag are added.
3. **All three rejections use `403`**, per the Context's wording, including the
   `Content-Type` rejection. See Open questions, item 1.
4. **Phase 1 adds one line to the README's Notes section** describing `ALLOWED_HOSTS`,
   beside the existing `HOST` note. Without it a `start:lan` user reaching the board by
   a `.local` name gets a bare `403` with no documented remedy. See Open questions,
   item 3.
5. **The guard lives in `src/server.ts`**, beside the existing `LOOPBACK_HOSTS` and
   `isLoopbackHost` helpers at `src/server.ts:38-42`, not in a new `src/lib/` module.
   See Open questions, item 2.

## Design

### Phase 1 — the request-origin guard

**Where it attaches.** `src/server.ts:298-310`. The `createServer` callback already
computes `reqPath`, then runs the path-traversal check, then branches on `/api/`. The
new guard is called immediately after `reqPath` is computed and before the traversal
check, so it covers every route, static files included.

**New module-level constants**, placed beside `LOOPBACK_HOSTS` at `src/server.ts:38`:

```ts
// Extra hostnames the server answers to, beyond IP literals and `localhost`.
// Comma-separated, read once at startup exactly as PORT and HOST are.
const ALLOWED_HOSTS: ReadonlySet<string> = new Set(
  (process.env.ALLOWED_HOSTS ?? '')
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter((name) => name !== '')
);
```

**New function contracts.** Both are defined in `src/server.ts`:

```ts
// Returns the bare hostname from a Host header value, or null when the header is
// absent or unparseable. Strips the port, and strips the brackets an IPv6 literal
// carries in a Host header ("[::1]:4173" -> "::1").
function hostnameOf(hostHeader: string | undefined): string | null;

// Returns true when the request may proceed. Writes its own 403 via sendJson and
// returns false when it may not. Named to read at the call site as a gate.
function passesOriginCheck(req: http.IncomingMessage, res: http.ServerResponse): boolean;
```

`hostnameOf` is built on `new URL('http://' + hostHeader)`. WHATWG `URL.hostname`
returns an IPv6 literal still wrapped in brackets, so the brackets are stripped
afterwards. A malformed `Host` makes the `URL` constructor throw; that is caught and
returns `null`.

**The two checks inside `passesOriginCheck`, in order:**

1. `hostnameOf(req.headers.host)` must be non-null, and must satisfy
   `net.isIP(hostname) !== 0 || hostname === 'localhost' || ALLOWED_HOSTS.has(hostname)`.
   This requires one new import, `import net from 'node:net'` — a Node built-in, so the
   repo's "no runtime dependency" property in the README is preserved.
2. If `req.headers.origin` is present, it must equal `'http://' + req.headers.host`
   compared case-insensitively. The raw `Host` header is used here, port included, so
   `http://localhost:4173` matches `localhost:4173`. `Origin: null` fails this check
   because it never equals `http://` plus a host.

**Why an IP-literal allowance is enough against DNS rebinding.** A rebinding attack
needs the victim's browser to send the attacker's *name* in the `Host` header while the
name resolves to a loopback or LAN address. An IP literal in `Host` can only come from a
user who typed an address, never from a rebound name. This is why the check cannot be a
loopback-only allowlist: `npm run start:lan` (`package.json`, `HOST=0.0.0.0`) is reached
by typing the machine's LAN IP, and a loopback-only list would break it.

**The `Content-Type` check.** Inside `handleApi` at `src/server.ts:179-181`, after
`method` is computed and before any route match:

```ts
if ((method === 'POST' || method === 'PATCH') && !isJsonContentType(req.headers['content-type'])) {
  sendJson(res, 403, { error: 'Content-Type must be application/json' });
  return;
}

// True when the header's media type is exactly application/json. Parameters such as
// "; charset=utf-8" are allowed and ignored.
function isJsonContentType(header: string | undefined): boolean;
```

This is where the CSRF path without rebinding is actually closed. `PATCH` and `DELETE`
already force a CORS preflight that this server never answers, so they are already
unreachable cross-origin. `POST` is not: a cross-origin form or `fetch` with
`Content-Type: text/plain` is a simple request and needs no preflight. Requiring
`application/json` makes every state-changing route preflighted.

**What this guard knows and does not know.** It knows about HTTP headers only. It must
not know about routes, project ids, the registry, or the extractor. It is called before
`handleApi` and before `fs.readFile`, so no route handler re-checks origin — request
validation stays at the boundary, exactly as `handleAddProject`'s comment at
`src/server.ts:129-133` already states for path validation.

**Client compatibility, verified in the code.** `src/public/browser-ipc-shim.ts:17` sets
`headers: { 'Content-Type': 'application/json' }` on every request with a body.
`electron/ipc-handlers.cts` sets the same header in `loopbackRequest`. `electron/main.cts`
loads `SERVER_URL = 'http://127.0.0.1:4173'`, an IP literal, so the Electron window's
`Host` passes check 1 and its same-origin `Origin` passes check 2. The only two HTTP
clients that exist are covered.

### Phase 2 — the Content-Security-Policy

**The policy.** One constant in `src/server.ts`, sent on the static-file `200` response
at `src/server.ts:326-328`:

```
default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'
```

**Asset audit against this policy.** Every directive was checked against the real
assets:

- No inline `<script>` or `<style>` element exists in `src/public/index.html` or
  `src/public/board.html`. Scripts are separate local files: `ipc-adapter.js`,
  `browser-ipc-shim.js`, `app.js`, `home.js`, `lib/agentic-tools-scope.js`. All are
  same-origin, so `script-src 'self'` is satisfied.
- `styles.css` is a `<link>`, same-origin. The only font is the local
  `src/public/fonts/fraunces-latin.woff2`, referenced by the `@font-face` at
  `src/public/styles.css:1-7` and copied to `dist/` by `tools/copy-assets.mjs`. It is
  served as `font/woff2` by the `MIME` table at `src/server.ts:22`, so `font-src 'self'`
  is satisfied.
- The only `fetch` calls go to `/api/*` from `src/public/browser-ipc-shim.ts`, same
  origin, so `connect-src 'self'` is satisfied.
- No remote origins, no `data:` URIs, no `<img>` elements. The one `<svg>` at
  `src/public/board.html:46` is inline SVG markup, which CSP does not restrict, and its
  `stroke`/`fill` are presentation attributes, not style attributes.
- Scripts set styles through the CSSOM, for example `el.style.display` at
  `src/public/app.ts:1006`. CSP does not block CSSOM writes, only style attributes in
  markup and inline style elements.
- `index.html`'s `<form id="add-form">` has no `action` and is submitted through
  JavaScript, so `form-action 'self'` changes nothing. No `<base>` element exists, so
  `base-uri 'none'` changes nothing. Electron loads the page as a top-level window, not
  a frame, so `frame-ancestors 'none'` changes nothing.
- `worker-src` and `manifest-src` fall back to `default-src 'none'`; neither is used.

**The blocker, and the fix.** Two inline `style` attributes exist and must go first:

| File and line | Today | After |
|---|---|---|
| `src/public/board.html:23` | `<span id="branch-line" style="display:none">` | `<span id="branch-line" hidden>` |
| `src/public/board.html:59` | `<div class="lower" id="lower" style="display:none">` | `<div class="lower" id="lower" hidden>` |
| `src/public/app.ts:1006` | `byId('branch-line').style.display = '';` | `byId('branch-line').hidden = false;` |
| `src/public/app.ts:1008` | `byId('lower').style.display = '';` | `byId('lower').hidden = false;` |

`.hidden = false` is the codebase's own convention for this, used at
`src/public/app.ts:387`, `src/public/app.ts:802`, and `src/public/home.ts:334-338`.

**The CSS rule, and why it needs `!important`.** `src/public/styles.css` carries no
global `[hidden]` rule today; only the narrow `.add-form[hidden]` at line 625. The base
element section at `src/public/styles.css:120-134` is where the new rule belongs:

```css
/* A hidden element is hidden, whatever a class rule says. `[hidden]` has the same
   specificity as a single class, so without !important the `display: grid` on .lower
   (line 386) and the `display: flex` on .card-tags (line 356) would win on source
   order and re-reveal an element the markup marked hidden. */
[hidden] { display: none !important; }
```

`.lower` sets `display: grid` at `src/public/styles.css:386-392`. Both `[hidden]` and
`.lower` have specificity `(0,1,0)`, so a bare `[hidden]` rule placed in the base
section would lose to `.lower` on source order, and the lower panels would be visible
before data arrives. `!important` makes the rule independent of both source order and
any future class rule, which is what the browser's own default behaviour intends.

**One deliberate side effect.** `.card-tags` sets `display: flex` at
`src/public/styles.css:356`, and `#ws-modal-tags` carries `hidden` in
`src/public/board.html:99` and is toggled at `src/public/app.ts:794` and `:809`. An
author class rule beats the user-agent `[hidden]` rule today, so that element is a
zero-height empty flex box rather than truly hidden, and it still contributes its
`margin-bottom: 6px`. The new rule collapses it properly. This removes 6px of space
above the modal date row when a workstream has no tags. It is a small visual
improvement, not a regression, and it is expected.

**One comment to correct.** `src/public/styles.css:951-957` states that the file
"carries no `[hidden]` rule" and that the modal tab panels rely on the user-agent
default. After this change that sentence is false. The comment must be updated to say
the panels rely on the global `[hidden]` rule in the base section. The rule it warns
about — no display rule may reach a panel div — still stands and is now enforced by
`!important`.

**Where the header is not sent.** The `404` static response at `src/server.ts:321-324`
and the JSON responses from `sendJson` are left unchanged. The policy protects the two
HTML documents and the assets they pull; a JSON error body executes nothing.

**Why the server header, and not the two alternatives.** A `<meta>` tag cannot express
`frame-ancestors` and would duplicate the policy across two HTML files. An Electron
`session.webRequest` policy would be a third copy of the same rule, and is unnecessary
because Electron loads these pages from this same server over loopback and therefore
already receives the header.

### Phase 3 — the README

`README.md` gains a short subsection under **Notes**, or a new **Packaged builds**
subsection, carrying:

- Packaged builds produced by `npm run package:mac`, `package:linux`, and `package:win`
  are unsigned and unnotarized, and are intended for the author's own machine only.
- A build made and run on the same machine carries no quarantine attribute, so
  Gatekeeper never prompts. The unsigned status costs nothing in that use.
- If a build is ever copied to another machine, clear the quarantine attribute with
  `xattr -dr com.apple.quarantine "Praxis Board.app"`.
- Before any distribution to other people, all of the following are prerequisites, not
  follow-ups: an Apple Developer Program membership and a Developer ID certificate; the
  `hardenedRuntime`, entitlements, and `notarize` keys added to the `mac` block of
  `package.json`'s `build` section; a Windows OV certificate or Azure Trusted Signing,
  wired through `win.signtoolOptions`; and all credentials moved into CI secrets, which
  also needs a macOS runner this repo does not have today.
- Linux `deb` and `AppImage` have no signature gate, so nothing is needed there.

No code, no `package.json`, and no build-configuration change is part of this phase.

## Staged task breakdown

Ordered riskiest first. Each phase leaves the app working and is verifiable on its own.

### Phase 1 — request-origin validation (medium)

Riskiest first: this is the only phase that can break both clients. It ships first so
any breakage surfaces while the change is the only one in the working tree.

**Task 1.1 — Host and Origin guard.** Add `ALLOWED_HOSTS`, `hostnameOf`, and
`passesOriginCheck` to `src/server.ts` beside the existing `LOOPBACK_HOSTS` helpers, and
call the guard at the top of the `createServer` callback. Add the `node:net` import.
Files: `src/server.ts`. Effort: small. Depends on: nothing.
Verify: `npm start`, then `curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4173/`
returns `200`; `curl -H 'Host: evil.example' http://127.0.0.1:4173/api/projects` returns
`403`; `curl -H 'Origin: http://evil.example' http://127.0.0.1:4173/api/projects`
returns `403`; `ALLOWED_HOSTS=board.local npm start` then
`curl -H 'Host: board.local' ...` returns `200`. Open the home page and a board in a
browser and confirm both still load and the project list still renders.

**Task 1.2 — JSON Content-Type requirement.** Add `isJsonContentType` and the
`POST`/`PATCH` check at the top of `handleApi` in `src/server.ts`.
Files: `src/server.ts`. Effort: small. Depends on: task 1.1 only for sharing the file.
Verify: `curl -X POST -H 'Content-Type: text/plain' --data '{"path":"/tmp"}' http://127.0.0.1:4173/api/projects`
returns `403`; the same request with `-H 'Content-Type: application/json'` returns the
existing `400` about `flowcharge/`, proving the check runs before the body is read but does
not change valid requests. Add a project and rename it from the home page in a browser
tab, and again in `npm run electron:dev`, and confirm both still work.

**Task 1.3 — `ALLOWED_HOSTS` note in the README.** One line in the Notes section beside
the existing `HOST` note, naming the variable, its comma-separated format, and the fact
that IP literals and `localhost` are always accepted.
Files: `README.md`. Effort: small. Depends on: task 1.1.
Verify: read the Notes section; the `HOST` sentence and the new sentence agree.
This task rests on assumption 4 and open question 3. Strike it if the answer is no.

### Phase 2 — Content-Security-Policy (medium)

**Task 2.1 — replace the two inline style attributes.** Apply the four edits in the
Design table, add the global `[hidden] { display: none !important; }` rule to the base
element section of `src/public/styles.css`, and correct the stale comment at
`src/public/styles.css:951-957`.
Files: `src/public/board.html`, `src/public/app.ts`, `src/public/styles.css`.
Effort: small. Depends on: nothing.
Verify: `npm start` and open a board. Before data arrives the lower panels and the
branch line are not visible. After data arrives the lower panels appear as a two-column
grid, and the branch line appears when the project is a git repository. Open the detail
modal on a workstream with no tags and confirm no empty gap sits above the dates row.
`grep -c 'style="' src/public/board.html` returns `0`.

**Task 2.2 — send the CSP header.** Add the policy constant to `src/server.ts` and
include it in the `res.writeHead(200, ...)` object on the static-file response.
Files: `src/server.ts`. Effort: small. Depends on: task 2.1. Shipping 2.2 before 2.1
would break the two inline styles.
Verify: `curl -sI http://127.0.0.1:4173/board.html | grep -i content-security-policy`
prints the policy. Open `/` and `/board.html?project=<id>` in a browser and confirm the
console shows zero CSP violations, the Fraunces headings render, the board and both
lower panels render, and the detail modal opens and switches tabs. Repeat inside
`npm run electron:dev` and confirm the same in its console.

### Phase 3 — document the unsigned build status (small)

**Task 3.1 — README packaged-build section.** Write the content listed in the Phase 3
Design section.
Files: `README.md`. Effort: small. Depends on: nothing. May ship before phases 1 and 2
if convenient; it is ordered last only because it carries no risk.
Verify: read the section. It states the unsigned status, gives the `xattr` command, and
lists the prerequisites as prerequisites of distribution. `git diff --stat` shows
`README.md` as the only changed file.

## Data & compatibility

- **No migrations.** No schema, no persisted data, and no file format changes. The
  project registry `.praxis-projects.json` is untouched by all three phases.
- **No API contract change.** Every route keeps its path, method, request body, and
  success response. Only new rejection paths are added, all `403`, all through the
  existing `sendJson` helper so the error-body shape stays `{ "error": string }` — the
  shape `src/public/browser-ipc-shim.ts:36-40` and `electron/ipc-handlers.cts` already
  parse.
- **Both existing clients are unaffected**, verified against their source in the Design
  section. There is no third client.
- **One user-visible behaviour change.** After Phase 1, reaching a `start:lan` server by
  a hostname rather than an IP address returns `403` until that name is listed in
  `ALLOWED_HOSTS`. Reaching it by IP address is unchanged. This is the intended effect
  of the control, and assumption 4 exists so a user meeting it has a documented remedy.
- **One user-visible layout change.** After Phase 2, a `hidden` element whose class sets
  `display` truly collapses. The one live instance is the modal tag row, described in
  Design.
- **Rollback.** Each phase is one commit and reverts cleanly with `git revert`. Nothing
  is written to disk that a revert would leave behind, and no state is created that a
  revert would strand. Phase 2's revert must take task 2.1 and 2.2 together, because
  reverting only 2.1 would restore inline styles under a live CSP. Phases are
  independent of each other, so any one may be reverted alone.

## Testing strategy

The repo's test convention is `node:test` with `node:assert/strict`, per
`src/lib/agentic-tools-format.test.ts:1-9`, compiled by `npm run build` and run with
`node --test dist/lib/<name>.test.js`. Every test file in the repo sits in `src/lib/`.
`src/server.ts` has no automated test today: it calls `server.listen` as a module
evaluation side effect at `src/server.ts:332`, so importing it starts a listener.

This plan therefore verifies both server phases by observable behaviour, using the
`curl` and browser checks written into each task, and adds no test harness. That is a
deliberate limit, recorded here rather than hidden: it is what open question 2 is about.

- **Phase 1.** Integration-style verification only, through the task 1.1 and 1.2 `curl`
  matrix plus one manual pass through each client. If open question 2 is answered "yes,
  extract", `hostnameOf` and `isJsonContentType` become pure functions in a `src/lib/`
  module and get a unit test file covering: IPv4, IPv6 with brackets, `localhost`, a
  bare name, a name in `ALLOWED_HOSTS`, an absent header, a malformed header, and
  `application/json` with and without a `charset` parameter.
- **Phase 2.** Manual browser and Electron verification only. A CSP is a browser-enforced
  control, and the repo has no browser test runner. Asserting the header string from a
  unit test would restate the constant and prove nothing about enforcement.
- **Phase 3.** No tests. It is prose.

A later test-writing pass, if wanted, should target the extracted pure helpers from
open question 2 and nothing else.

## Open questions

1. **Which status code rejects a wrong `Content-Type`?** The Context says to reject
   with `403`, in a bullet list that also covers the `Host` and `Origin` checks, so
   `403` is what this plan assumes. `415 Unsupported Media Type` is the semantically
   correct code for this specific rejection. Recommendation: keep `403` for all three,
   for one uniform rejection shape and one sentence of reasoning; switch the
   `Content-Type` case to `415` only if you want the response to be self-describing.
2. **Should the pure helpers move to `src/lib/` so they can be unit-tested?** This plan
   keeps them in `src/server.ts`, beside the `LOOPBACK_HOSTS` helpers the Context points
   at, which keeps the diff to one file and avoids refactoring existing helpers. The
   cost is that `hostnameOf` and `isJsonContentType` stay untested, verified only by
   `curl`. Recommendation: keep them in `src/server.ts` now. The header-parsing edge
   cases — bracketed IPv6, absent header, malformed header — are the kind that a unit
   test catches and `curl` does not, so revisit this if Phase 1 proves fiddly.
3. **Should `ALLOWED_HOSTS` be documented in the README?** Assumption 4 says yes and
   task 1.3 plans one line for it. It is a new user-facing environment variable, and
   without it a `start:lan` user reaching the board by a `.local` name sees an
   unexplained `403`. Recommendation: yes, one line. Strike task 1.3 if you want
   Phase 1 to touch code only.
4. **Should the now-redundant `.add-form[hidden]` rule at `src/public/styles.css:625`
   be removed?** The new global rule makes it dead. This plan leaves it in place because
   the Context did not ask for it and it is harmless. Recommendation: leave it, or fold
   its removal into task 2.1 as a one-line deletion if you want it gone.

## Alternatives considered and rejected

- **A loopback-only `Host` allowlist**, reusing `isLoopbackHost` directly. Rejected: it
  would return `403` for every request to a `npm run start:lan` server, since those
  arrive with a LAN IP in `Host`. The `package.json` `start:lan` script exists precisely
  to serve that case.
- **A `<meta http-equiv="Content-Security-Policy">` tag in each HTML file.** Rejected on
  two grounds. A `<meta>` policy cannot express `frame-ancestors`, which is one of the
  directives this policy wants. And it would put two copies of the same policy in
  `src/public/index.html` and `src/public/board.html`, which drift apart the first time
  one is edited.
- **An Electron `session.webRequest` CSP in `electron/main.cts`.** Rejected: it would be
  a third copy of the same policy, and it is unnecessary. `electron/main.cts:14` points
  the window at `http://127.0.0.1:4173`, the same server, so the response header already
  applies inside Electron.
- **A CSRF token issued by the server and echoed by both clients.** Rejected as heavier
  than the threat needs. Requiring `application/json` on `POST` and `PATCH` forces a
  preflight this server never answers, which closes the same path with no token store,
  no token lifetime, and no change to either client.
- **Adding CORS headers with a narrow allowlist.** Rejected: sending no
  `Access-Control-Allow-*` header at all is strictly stronger. Any allowlist is a
  surface to get wrong later, and nothing in this app needs a cross-origin read.
- **Signing and notarizing now (macOS Developer ID plus a Windows OV or Azure Trusted
  Signing certificate).** Rejected on cost against benefit. It needs an Apple Developer
  Program membership at 99 USD per year, a Windows certificate at roughly 200-400 USD
  per year or Azure Trusted Signing at roughly 10 USD per month with a verified
  organization or a three-year individual identity, minutes of `notarytool` time on
  every release build, private keys moved into CI secrets, and a macOS CI runner in a
  repo that has no CI at all. A build made and run on the same machine carries no
  quarantine attribute, so Gatekeeper never prompts, and the only user is the author.
  The cost buys nothing today. The README instead records signing as a prerequisite of
  the first distribution.
- **Bare `[hidden] { display: none; }` without `!important`, placed at the end of
  `src/public/styles.css`.** Rejected: it works only by source order, because
  `[hidden]` and a class selector have the same specificity. The first class rule added
  below it, or any later reordering of the file, silently re-reveals a hidden element.

## Final summary

Three independent server-side controls, riskiest first: a `Host`/`Origin`/`Content-Type`
guard in `src/server.ts`, one CSP response header on the static-file route, and a README
section recording that packaged builds are deliberately unsigned. Three phases, six
tasks, all small; roughly one sitting per phase.

Top risks:

1. The `Host` allowlist returns `403` for a `start:lan` server reached by hostname
   rather than IP address. `ALLOWED_HOSTS` is the remedy, and task 1.3 documents it.
2. The global `[hidden]` rule must beat `.lower`'s `display: grid`, or the lower panels
   flash visible before data arrives. `!important` and the task 2.1 check cover it.
3. Neither server phase gets an automated test, because `src/server.ts` starts listening
   on import and has no harness. Verification is `curl` plus a manual pass in both
   clients.

Four open questions need your answer: the rejection code for a wrong `Content-Type`,
whether the pure helpers move to `src/lib/` for unit tests, whether `ALLOWED_HOSTS` is
documented in the README, and whether the redundant `.add-form[hidden]` rule is removed.
