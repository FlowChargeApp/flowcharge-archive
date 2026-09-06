---
id: TL-23-8unke0
type: tasklist
workstream: WS-18-r2lnto
slug: server-bind-beyond-loopback
title: "Configurable HOST bind, default-safe, with a network-exposure warning"
status: done
created: 2026-08-08
updated: 2026-08-08
depends_on: [PLN-18-v764kh]
links: []
mode: spec
base_commit: fd7c92e
---

# PRX Tasks

## Configurable HOST bind, default-safe, with a network-exposure warning

Implements PLN-18: `src/server.ts` hardcodes `server.listen(port, '127.0.0.1', ...)`. This
adds a `HOST` environment variable read the same way `PORT` already is, defaulting to
`127.0.0.1` so today's behaviour is unchanged unless an operator opts in (e.g.
`HOST=0.0.0.0 npm start`). When the resolved host is not in a small loopback allowlist, the
server logs a startup warning that the dashboard is now network-reachable with no
authentication and that registered project paths resolve on this machine. The README's
Notes bullet documenting the bind as an unconditional security property is updated to
describe the new default-safe, opt-in-to-widen behaviour. Zero new dependencies; only
`src/server.ts` (phases 1–2) and `README.md` (phase 3) are touched.

- [x] 1. Phase 1 — Configurable `HOST` with default-safe bind
  ```yaml
  description: "Add a HOST env var read the same way PORT is, defaulting to 127.0.0.1, and use it in the server.listen call and its startup log line."
  issues: []
  implement:
    - "In src/server.ts, immediately after the existing `const port = process.env.PORT ? Number(process.env.PORT) : 4173;` at line 12, add `const host = process.env.HOST || '127.0.0.1';` — no numeric coercion needed since http.Server.listen's host parameter is already a string, and `HOST=` (empty) falls back to the default exactly as an empty PORT does."
    - "Change the server.listen call (line 318) from `server.listen(port, '127.0.0.1', () => {` to `server.listen(port, host, () => {`."
    - "Change the startup console.log (line 319) from `console.log(\\`Praxis Dashboard running at http://localhost:${port}\\`);` to interpolate the actual host: `console.log(\\`Praxis Dashboard running at http://${host}:${port}\\`);` — this falls out of the same edit per the plan's Design section."
  pattern: "src/server.ts"
  imports: "None — no new dependency; uses process.env exactly as PORT already does at line 12."
  compatibility: "Must match the existing PORT pattern's shape (read env, fall back to hardcoded default) so the two constants read as one convention."
  gotcha: "Do not add numeric coercion for host (PORT uses Number(), HOST must stay a string). Do not touch src/public/app.ts or src/types/praxis-data.d.ts — out of scope per Context."
  verify:
    - "npx tsc --noEmit -p tsconfig.json"
    - "npm run build"
    - "grep -n \"const host = process.env.HOST\" src/server.ts and grep -n \"server.listen(port, host,\" src/server.ts each return exactly one match"
  checklist:
    - "Does src/server.ts declare `host` reading process.env.HOST with a 127.0.0.1 fallback, placed immediately after the `port` constant?"
    - "Does server.listen now pass `host` instead of the hardcoded '127.0.0.1' string?"
    - "Does the startup console.log interpolate `host` instead of the hardcoded 'localhost'?"
    - "Do both tsc --noEmit commands and npm run build succeed with no errors?"
    - "Are src/public/app.ts and src/types/praxis-data.d.ts left untouched?"
  self_eval:
    passed: true
    failures: []
  ```

- [x] 2. Phase 2 — Non-loopback startup warning
  ```yaml
  description: "Add a LOOPBACK_HOSTS allowlist and isLoopbackHost helper, and warn on startup when the resolved host is not loopback."
  issues: []
  implement:
    - "In src/server.ts, near the other small constants at the top of the file (MAX_BODY_BYTES at line 25, MAX_NAME_LENGTH at line 28), add the constant and helper exactly as specified in the plan's Design section: `const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);` followed by `function isLoopbackHost(candidate: string): boolean { return LOOPBACK_HOSTS.has(candidate); }`."
    - "Inside the server.listen callback introduced in Phase 1 (after the console.log line), add: `if (!isLoopbackHost(host)) { console.warn(...) }` where the warning text states plainly that the dashboard is now reachable from other devices on the network, that there is no authentication, that any device reaching host:port can read every registered project's flowcharge/ content and can add/rename/remove registry entries, and that registered project paths are resolved on this machine's filesystem regardless of which machine's browser makes the request — matching the exact wording in the plan's Design section's changed-call-site block."
  pattern: "src/server.ts"
  imports: "None — no new dependency; console.warn matches the existing console.log/console.error usage already in this file (lines 70, 109, 174)."
  compatibility: "The warning must fire only inside the server.listen callback established in task 1, using the same `host` constant and `isLoopbackHost` helper — no separate check elsewhere in the file."
  gotcha: "The loopback allowlist is an exact-match Set of three strings only (127.0.0.1, localhost, ::1) — not a CIDR/IP-range check, per the plan's explicit YAGNI rejection of that approach. HOST=127.0.0.1, HOST=localhost, and HOST=::1 must all suppress the warning; anything else, including 0.0.0.0, must trigger it."
  verify:
    - "npx tsc --noEmit -p tsconfig.json"
    - "npm run build"
    - "grep -c \"LOOPBACK_HOSTS\\|isLoopbackHost\" src/server.ts returns at least 2 (declaration plus call site)"
  checklist:
    - "Does LOOPBACK_HOSTS contain exactly '127.0.0.1', 'localhost', and '::1', no more and no fewer?"
    - "Does isLoopbackHost return true only for an exact match against that set (no substring or prefix matching)?"
    - "Does the console.warn fire only when isLoopbackHost(host) is false, inside the server.listen callback?"
    - "Does the warning text state all three required facts: network-reachable, no authentication, and that project paths resolve on this machine?"
    - "Do both tsc --noEmit commands and npm run build succeed with no errors?"
  self_eval:
    passed: true
    failures: []
  ```

- [x] 3. Phase 3 — README update
  ```yaml
  description: "Replace the README's Notes bullet that documents the 127.0.0.1 bind as an unconditional security property with text describing the new default-safe, opt-in-to-widen behaviour."
  issues: []
  implement:
    - "In README.md, replace the Notes bullet (currently: \"The server binds `127.0.0.1`, so it is reachable only from this machine. That matters because the API reads any registered project's directory and will register any absolute path posted to it — it is a local single-user tool, not something to expose on a network.\") with text stating: the server still binds `127.0.0.1` by default and is reachable only from this machine unless `HOST` is set; setting `HOST` (e.g. `HOST=0.0.0.0`) opens it to the network; once opened, any reachable device can read every registered project's content and can add/rename/remove registry entries, and paths still resolve on this machine's filesystem; and the server logs a startup warning when this is the case — per the plan's Design section README update."
  pattern: "README.md"
  imports: "None."
  compatibility: "Must accurately describe the behaviour implemented in tasks 1 and 2, so this task is done last and matches what actually ships."
  gotcha: "Do not touch any other README section — only the Notes bullet identified in the plan (originally lines 89-91) is in scope. Do not touch src/public/app.ts or src/types/praxis-data.d.ts."
  verify:
    - "Manual read-through of the updated Notes bullet in README.md"
    - "grep -n \"HOST\" README.md confirms the bullet now mentions the HOST override"
  checklist:
    - "Does the updated bullet no longer state the bind is unconditionally loopback-only?"
    - "Does it describe the 127.0.0.1 default explicitly?"
    - "Does it describe HOST as the opt-in override, with an example?"
    - "Does it describe the exposure (no authentication, paths resolve on this machine, registry read/write) once HOST widens the bind?"
    - "Does it mention the startup warning that fires in that case?"
    - "Is every other README section left unchanged?"
  self_eval:
    passed: true
    failures: []
  ```
