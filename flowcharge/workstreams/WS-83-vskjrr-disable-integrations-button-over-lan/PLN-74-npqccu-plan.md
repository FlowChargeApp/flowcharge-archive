---
id: PLN-74-npqccu
type: plan
workstream: WS-83-vskjrr
slug: disable-integrations-button-over-lan
title: "Disable Manage integrations when the dashboard is viewed over LAN"
status: ready
created: 2026-08-31
updated: 2026-08-31
depends_on: []
links: []
---

# Disable Manage integrations when the dashboard is viewed over LAN

## Summary

The server already refuses every `/api/integrations/*` request from a non-local peer with
HTTP 403 (`isLoopbackRemote`, `src/server.ts:167`, applied at `src/server.ts:807`). The
"Manage integrations" button (`src/public/index.html:15`, wired at `src/public/home.ts:896`)
does not know this, so a LAN viewer opens the dialog and every action fails with no
explanation.

This plan gives the browser one source of truth for that fact. The server exposes a new
ungated route, `GET /api/local-access`, which answers with the result of the *same*
`isLoopbackRemote` call the gate uses. The home page ships the button `disabled` and enables
it only when that route reports `local: true`. The loopback gate itself is not touched.

The fact is read over HTTP only. The Electron build reaches integrations through native IPC
(`window.praxisSkillInstallAPI` from `electron/preload.cts:27`), which never crosses the
network, and its window is always loaded from `http://127.0.0.1:<port>`
(`electron/main.cts:98`). The same fetch therefore answers `local: true` in Electron by
construction, so no LAN logic is added to the IPC transport.

## Scope

### Acceptance criteria

1. A browser tab served over a non-loopback connection shows the Manage integrations button greyed out and non-interactive.
2. The disabled button carries a `title` that states integrations are available only on the machine that runs the server.
3. A browser tab served over loopback shows the button enabled, and it opens the dialog exactly as it does today.
4. The Electron desktop build shows the button enabled, with no change to any integrations behaviour.
5. `GET /api/local-access` answers 200 with `{"local": true}` to a loopback peer and `{"local": false}` to any other peer.
6. `GET /api/local-access` is reachable from a non-loopback peer, and no request under `/api/integrations/*` changes behaviour.
7. Over LAN the board, project browsing, theme toggle, version row, and update banner behave exactly as they do today.
8. The button ships `disabled` in `index.html`, so no click can reach the dialog before the server's answer arrives.

### Out of scope

- Any change to the loopback gate, `isLoopbackRemote`, `isLoopbackHost`, `LOOPBACK_HOSTS`, or `passesOriginCheck`.
- Any change to the integrations dialog's own contents, rows, scope segment, or install flow.
- Any authentication, session, or per-user permission mechanism.
- Any gating of non-integrations features over LAN, including project add, rename, and remove.
- Any change to `board.html`, which carries no integrations button.

### Assumptions

- No production data and no live users: this is a locally run, single-user dashboard, so the feature ships whole with no feature flag and no dark launch.
- The client fails closed. When `/api/local-access` cannot be reached or answers anything other than 200 with `local: true`, the button stays disabled. A page that cannot reach its own server is already unusable, so a false disable costs nothing.
- The explanation is delivered by the button's own `title` attribute, matching the existing disabled-plus-title precedent at `src/public/home.ts:353-354`. No visible toolbar text is added.
- The new route reveals only whether the caller is loopback, which the caller already knows, so it needs no protection beyond the `passesOriginCheck` every route already sits behind (`src/server.ts:872`).

## Key flows

**LAN viewer opens the home page** — **Actor:** a person on another device on the LAN.
**Preconditions:** the server runs with `HOST=0.0.0.0` (`npm run start:lan`).
**Main flow:** the page loads with the button already disabled; `isLocalAccess()` fetches
`/api/local-access`; the server answers `{"local": false}`; the button stays disabled and
keeps its explanatory title. **Outcome:** the viewer sees a greyed control and a reason,
and cannot open the dialog. **Edge cases:** a slow answer leaves the button disabled, which
is the correct resting state; a failed fetch also leaves it disabled.

**Local viewer opens the home page** — **Actor:** the person at the machine running the
server, in a browser tab or in the Electron window. **Preconditions:** none.
**Main flow:** the page loads with the button disabled; the server answers `{"local": true}`;
`home.ts` removes the `disabled` attribute and the title. **Outcome:** the button behaves
exactly as it does today. **Edge cases:** the server is reached through an `ALLOWED_HOSTS`
alias that resolves to loopback (`src/server.ts:113-119`); the peer address is still
loopback, so the button is correctly enabled.

## Design

### Server contract — `src/server.ts`

A new route inside `handleApi`, placed immediately after the `/api/version` block
(`src/server.ts:790-797`) and before the `/api/integrations/` branch (`src/server.ts:799`),
so the gate at `src/server.ts:807` never sees it.

- `GET /api/local-access` → 200, body `{ "local": boolean }`. The `local` field is required,
  is always a boolean, and is never null.
- Its value is `isLoopbackRemote(req)` (`src/server.ts:167`) — the identical call the gate
  makes, with no second implementation and no new helper.
- Any other method → 405, body `{ "error": "Method not allowed" }`, matching the shape used
  by the integrations routes.
- The route adds no new module-scope state and reads no filesystem.

The path deliberately does not begin with `/api/integrations/`. A route under that prefix
would be answered with 403 by the gate before any route match, which is exactly the case
this route exists to report.

### Client contract — `src/public/lib/integrations-access.ts` (new)

```ts
export function isLocalAccess(): Promise<boolean>;
```

- Resolves `true` only when the fetch answers status 200 and the parsed body's `local` is
  exactly `true`. Resolves `false` for every other status, an unparseable body, and a
  network failure. It never rejects.
- It knows two things: the route's URL and its response shape.
- It must NOT know about the button, the dialog, the DOM, `window.praxisSkillInstallAPI`,
  `window.praxisAPI`, or `PraxisIpcResult`. It performs its own `fetch` rather than reusing
  `browser-ipc-shim.ts`'s module-private `fetchIpc`, because it needs a boolean, not the
  status-and-error envelope that helper builds.
- It lives beside `src/public/lib/agentic-tools-api.ts` and
  `src/public/lib/agentic-tools-scope.ts`, and reaches `home.js` through `home.ts`'s import,
  so it needs no script tag and no bundler change. `connect-src 'self'` in the server's CSP
  (`src/server.ts:47-50`) already permits the request.

### Markup — `src/public/index.html:15`

The button ships with `disabled` and a `title` giving the reason. The disabled state is the
resting state, so the enabled state is only ever reached by an explicit answer.

### Wiring — `src/public/home.ts`

At the existing integrations wiring block (`src/public/home.ts:896`), one call to
`isLocalAccess()` at init time. On `true` it clears `disabled` and removes the `title`,
mirroring `src/public/home.ts:357-358`. On `false` it does nothing, because the resting
state is already correct. This file owns the DOM effect and nothing about how the answer is
computed. The dialog needs no separate guard: the button at `src/public/home.ts:896` is its
only opener.

### Styling — `src/public/styles.css`

A `.tb-button:disabled` rule giving the greyed, non-interactive appearance, and the existing
hover rule at `src/public/styles.css:247` narrowed so it does not apply while disabled. The
button keeps its box and its place in the flex row, so
`.toolbar .tb-button { margin-left: auto }` (`src/public/styles.css:254`) keeps
right-aligning the toolbar.

## Stages

1. **Server fact.** Add `GET /api/local-access` and its tests. First because it is the only
   part that can be wrong in a way the UI cannot reveal, and because it must be proven
   reachable from a non-loopback peer. Observable at the end: a request from loopback answers
   `{"local":true}` and a request to the machine's LAN address answers `{"local":false}`.
2. **Client gate.** Add `src/public/lib/integrations-access.ts`, ship the button disabled in
   `index.html`, enable it from `home.ts`, and add the disabled styling. Observable at the
   end: the button is greyed over LAN, enabled over loopback, and unchanged in Electron.

## Data & compatibility

- No migration. No persisted data, no registry field, and no stored preference is added or changed.
- The new route is purely additive. No existing route, response shape, or status code changes, so an older client that never calls it is unaffected.
- A browser holding a cached `home.js` against a freshly served `index.html` leaves the button disabled until a reload. The static handler sets no `Cache-Control` or `ETag` (`src/server.ts:902-906`), so this is heuristic caching only, and both files change together in one build.
- Rollback: revert stage 2 as a unit. Reverting only the `home.ts` enabler while leaving `disabled` in `index.html` would disable the button for every user, including local ones. Stage 1 can be left in place after a stage 2 revert, because nothing else calls the route.

## Testing strategy

- **Stage 1, integration, Node.** `src/server.test.ts` already drives a real server bound to `127.0.0.1` (`src/server.test.ts:23-27`). Add the loopback case there: `GET /api/local-access` answers 200 with `local: true`, and a non-GET answers 405.
- **Stage 1, integration, non-loopback peer.** A separate test file is required, because `src/server.test.ts:23` forces `HOST=127.0.0.1` before its single module import. The new file binds `HOST=0.0.0.0`, finds a non-internal IPv4 address from `os.networkInterfaces()`, requests `/api/local-access` at that address, and asserts `local: false`. It skips when the host has no such interface. This is also the first single-machine reproduction of the non-loopback path that WS-82 could not obtain.
- **Stage 2, manual.** `src/public/` carries no test harness and this plan adds none. Verify by running `npm run start:lan`, opening `http://<lan-ip>:4173` (the peer address is the LAN address, not loopback, so the disabled state reproduces without a second device, and a second device is the fallback), and confirming the button is greyed with its title while the board and project list stay fully usable. Then verify `npm start` at `http://127.0.0.1:4173` and `npm run electron:dev` both show the button enabled and the dialog working.
- No unit test is written for `isLocalAccess()` itself: it has no branching beyond its own failure handling, and the manual checks above cover both of its outcomes.

## Open questions

1. Should the disabled button be accompanied by visible toolbar text, rather than the `title` tooltip alone? Native tooltips on disabled controls have been inconsistent across browsers. Options: title only, title plus a short toolbar note, or a note inside a still-openable read-only dialog. Recommendation: ship title only, and add the note only if the tooltip proves invisible in practice.
2. Are there release constraints this plan should respect — a pending release, a packaged build already in users' hands, or a version the change must land after? This plan assumes none and treats the change as shippable on `main` immediately.
3. Is `/api/local-access` the name you want for the route? It is a public URL and renaming it after release is a breaking change for any future caller. Alternatives: `/api/access`, `/api/environment`. Recommendation: keep `/api/local-access`, which names the fact it reports.

## Adjacent opportunities

Not requested, and none is written into a stage, a criterion, or a contract.

1. Log one line per refused `/api/integrations/*` request, so a LAN viewer's dead-end attempts are visible in the server console — skip, the UI change removes the attempts.
2. Reuse `/api/local-access` to warn LAN viewers that registered project paths resolve on the server's filesystem, as the startup warning already says (`src/server.ts:938-945`) — skip, the brief requires everything else to stay unchanged.
3. Show the disabled button's reason in the update banner's slot when the app is viewed over LAN — skip, it would couple two unrelated surfaces.

## Alternatives considered and rejected

1. **Infer LAN from `window.location.hostname` in the client.** Rejected: it re-implements the gate's decision in a second place using a different input, and disagrees with it whenever the server is reached through an `ALLOWED_HOSTS` alias resolving to loopback (`src/server.ts:113-119`), disabling the button for a genuinely local user.
2. **Add an `isLocalAccess()` method to `PraxisSkillInstallAPI`.** Rejected: it forces `electron/preload.cts` and `electron/agentic-tools-ipc-handlers.cts` to implement a fact the IPC transport can never mean, which the brief rules out.
3. **Hide the button instead of disabling it.** Rejected: the user chose a disabled state, and removing the element also removes the `margin-left: auto` anchor that right-aligns the toolbar (`src/public/styles.css:254`).
4. **Let the click through and surface the 403 inside the dialog.** Rejected: the whole point is to tell the viewer before the click, not after six failed calls.
5. **Probe an existing `/api/integrations/*` route and read its 403 as the signal.** Rejected: it conflates "not local" with every other 403 `passesOriginCheck` can produce (`src/server.ts:140-160`), and spends a gated call on every page load.

## Final summary

- **Approach:** the server exposes `GET /api/local-access` returning the same `isLoopbackRemote` result the gate uses, and the home page ships the button disabled and enables it only on `local: true`.
- **Size:** 2 stages, small. One new route, one new 20-line browser module, and three small edits to `index.html`, `home.ts`, and `styles.css`.
- **Risks:** a stage 2 partial revert would leave the button disabled for everyone; a cached `home.js` can briefly do the same; native tooltips on disabled buttons may not render, which would leave the reason unsaid.
- **Needs your answer:** whether visible text should back up the tooltip; whether any release constraint applies; whether `/api/local-access` is the route name you want.
