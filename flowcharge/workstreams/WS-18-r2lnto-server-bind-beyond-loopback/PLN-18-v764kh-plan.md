---
id: PLN-18-v764kh
type: plan
workstream: WS-18-r2lnto
slug: server-bind-beyond-loopback
title: "Configurable HOST bind, default-safe, with a network-exposure warning"
status: done
created: 2026-08-08
updated: 2026-08-08
depends_on: []
links: []
---

## Summary

`src/server.ts` line 318 hardcodes `server.listen(port, '127.0.0.1', ...)`, so the
dashboard is reachable only from the machine it runs on. The chosen approach adds a
`HOST` environment variable, read the same way `PORT` already is at line 12, defaulting
to `127.0.0.1` so today's behaviour is unchanged unless an operator opts in (e.g.
`HOST=0.0.0.0 npm start`). When the resolved bind host is not a loopback address, the
server logs a startup warning stating plainly that the dashboard is now reachable from
the network with no authentication and that registered project paths resolve on this
machine. The README's loopback-only security note is updated to describe this
default-safe, opt-in-to-widen behaviour. This mirrors the existing `PORT` pattern
exactly, needs no new dependency, and touches only `src/server.ts` and `README.md`.

## Scope

**In scope — acceptance criteria:**

- A user who starts the server with no `HOST` set sees it bind `127.0.0.1`, exactly
  today's behaviour — unreachable from other machines on the network.
- A user who runs `HOST=0.0.0.0 npm start` (or any other explicit host string) sees the
  server bind that host instead, making it reachable from other machines where the
  network topology allows it.
- A user who binds to a non-loopback host sees a startup console warning stating: the
  dashboard is reachable from the network, there is no authentication, and project
  registry paths resolve against this machine's filesystem.
- A user who binds to the default loopback host, or explicitly sets `HOST=127.0.0.1`,
  `HOST=localhost`, or `HOST=::1`, sees no such warning — those are all loopback
  addresses and current behaviour is unchanged in spirit.
- The README's existing bullet describing the loopback-only bind as a security property
  is updated to describe the new default (still loopback-only) and the opt-in `HOST`
  override, so the doc no longer states an absolute that is now conditional.

**Out of scope** (per Context, not planned here):

- Authentication or authorization of any kind.
- HTTPS/TLS termination.
- Any other network-hardening feature (rate limiting, allowlists, CORS changes, etc.).
- Changes to `src/lib/projects.ts` or the registry file — Context's investigation
  already established no code change is needed there; the machine-local nature of the
  registry stays a documentation caveat.
- A CLI flag or config file for the host — the project already has exactly one
  precedent (env var) for this kind of setting, and Context asks only for the same
  mechanism `HOST` mirrors from `PORT`.

**Assumptions** (Context did not settle these; treated as non-blocking per the
skill's ambiguity rule since none change the module structure):

- "Loopback" for the purpose of suppressing the warning means an exact match against
  `127.0.0.1`, `localhost`, or `::1` — the three strings Node's own docs and common
  practice treat as loopback. Any other value, including `0.0.0.0` or a specific LAN
  IP, triggers the warning. This is a small fixed allowlist, not a general
  IP-range/CIDR check, which would be over-engineering for a three-line warning guard.
- An empty `HOST` value falls back to the default exactly as an empty `PORT` already
  does at line 12 (`process.env.PORT ? ... : 4173`), so `HOST=` behaves identically to
  `HOST` unset.
- This is a local, single-user dev tool with no production deployment pipeline, no
  live user base, and no data migration surface — Context confirms there is no
  authentication today and frames this as a same-repo dev tool, so there is no
  flag/dark-launch or rollback machinery beyond "unset `HOST`" to plan for. (This is
  the deployment/release read the skill asks to always surface; recorded here as an
  explicit assumption rather than left implicit.)
- The warning is a `console.warn`/`console.error`-style startup log, matching the
  existing `console.log`/`console.error` usage already in `src/server.ts` (lines 70,
  109, 174, 319) — no new logging library or format.

## Design

**Contract — the `HOST` environment variable:**

- Type: string, read once at module load.
- Default: `'127.0.0.1'` (unchanged current behaviour).
- Resolution: `const host = process.env.HOST || '127.0.0.1';` — placed immediately
  after the existing `const port = process.env.PORT ? Number(process.env.PORT) :
  4173;` at `src/server.ts` line 12, following the same "read env, fall back to
  hardcoded default" shape already established for `PORT`. Unlike `PORT`, no numeric
  coercion is needed since `http.Server.listen`'s host parameter is already a string.

**Contract — loopback classification:**

```ts
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

function isLoopbackHost(candidate: string): boolean {
  return LOOPBACK_HOSTS.has(candidate);
}
```

This sits near the other small constants at the top of `src/server.ts` (alongside
`MAX_BODY_BYTES` and `MAX_NAME_LENGTH`, lines 25 and 28), following the file's existing
convention of naming a magic value once so it can be found and changed in one place.

**Changed call site** (`src/server.ts` line 318, currently
`server.listen(port, '127.0.0.1', () => { ... })`):

```ts
server.listen(port, host, () => {
  console.log(`Praxis Dashboard running at http://${host}:${port}`);
  if (!isLoopbackHost(host)) {
    console.warn(
      `WARNING: bound to ${host}, which is not loopback-only — this dashboard is now ` +
      `reachable from other devices on the network. There is no authentication: any ` +
      `device that can reach ${host}:${port} can read every registered project's ` +
      `flowcharge/ content and can add, rename, or remove project registry entries. ` +
      `Registered project paths are resolved on THIS machine's filesystem regardless ` +
      `of which machine's browser makes the request.`
    );
  }
});
```

The startup log line changes from a hardcoded `localhost` to the actual `host`, so an
operator who set `HOST=0.0.0.0` sees an accurate (if not directly browsable) bind
address rather than a misleading `localhost` URL — a small, self-contained fix that
falls out of the same edit and needs no separate task.

**What this code knows and must not know:** the `host`/`isLoopbackHost` logic knows
only the bind address string; it does not know about the project registry, routing, or
static-file serving, and does not change any of them — matching Context's finding that
`server.listen` is the only call site requiring a functional change. No other file is
touched by this design.

**README update** (`README.md`, the bullet at lines 89–91 under **Notes**):

Current text:

> - The server binds `127.0.0.1`, so it is reachable only from this machine. That
>   matters because the API reads any registered project's directory and will
>   register any absolute path posted to it — it is a local single-user tool, not
>   something to expose on a network.

Replacement describes the new default-safe, opt-in behaviour: the server still binds
`127.0.0.1` by default and is reachable only from this machine unless `HOST` is set;
setting `HOST` (e.g. `HOST=0.0.0.0`) opens it to the network, at which point the
existing exposure (any reachable device can read every registered project's content
and can add/rename/remove registry entries, and paths resolve on this machine) applies,
and the server logs a warning at startup when this is the case.

## Staged task breakdown

**Phase 1 — Configurable `HOST` with default-safe bind**
*What:* Add the `host` constant reading `process.env.HOST` with the `127.0.0.1`
fallback; change the `server.listen(port, '127.0.0.1', ...)` call to
`server.listen(port, host, ...)`; update the existing startup `console.log` to
interpolate `host` instead of the hardcoded `localhost`.
*Files:* `src/server.ts` (lines ~12, ~318–320).
*Effort:* Small.
*Dependencies:* None.
*Verify:* `npx tsc --noEmit -p tsconfig.json` passes; `npm run build` succeeds; run
`npm start` with no `HOST` set and confirm the dashboard is reachable at
`http://localhost:4173` exactly as before; run `HOST=0.0.0.0 npm start` and confirm the
console prints `http://0.0.0.0:4173` and the dashboard is reachable from another
device on the same network at `http://<this-machine's-LAN-IP>:4173`.

**Phase 2 — Non-loopback startup warning**
*What:* Add the `LOOPBACK_HOSTS` set and `isLoopbackHost` helper; wrap the warning
`console.warn` call in the `server.listen` callback, firing only when `host` is not in
the loopback set.
*Files:* `src/server.ts` (new constant/helper near lines 25–28, warning added to the
callback introduced in Phase 1 at line ~318).
*Effort:* Small.
*Dependencies:* Phase 1 (the callback and `host` variable it extends).
*Verify:* `npx tsc --noEmit -p tsconfig.json` passes; `npm run build` succeeds; `npm
start` with no `HOST` set (and separately with `HOST=127.0.0.1`, `HOST=localhost`)
prints no warning; `HOST=0.0.0.0 npm start` prints the warning text on startup,
before the first request is served.

**Phase 3 — README update**
*What:* Replace the Notes bullet at `README.md` lines 89–91 with text describing the
default-safe (`127.0.0.1` unless `HOST` is set) behaviour, the opt-in override, and
the exposure it carries once opened, per the Design section above.
*Files:* `README.md`.
*Effort:* Small.
*Dependencies:* Phases 1–2 (the doc describes their behaviour, so it is written last
and matches what actually ships).
*Verify:* Manual read-through — the bullet no longer states the bind is unconditionally
loopback-only, and accurately describes both the default and the `HOST` override.

Each phase leaves the app fully working and independently demonstrable: after Phase 1
alone the bind is already configurable; Phase 2 adds only a log line; Phase 3 touches
no code.

## Data & compatibility

No data model, no schema, and no migration — this feature touches only a startup
constant and a log statement. `src/lib/projects.ts` and `.praxis-projects.json` are
unchanged, per Context's finding that no code change is needed there.

Backward compatibility: default behaviour (`HOST` unset) is byte-for-byte identical to
today's hardcoded bind, so every existing consumer, script, and workflow that starts
the server without `HOST` sees no change at all. The only new behaviour is additive
and opt-in.

Rollback: unset `HOST` (or don't set it) to return to loopback-only binding — no
migration or data to reverse. If the change needs to be pulled entirely, reverting the
`src/server.ts` and `README.md` edits is a plain code revert with nothing else to clean
up.

## Testing strategy

This project has no automated test framework; verification is the three commands
Context specifies:

- `npx tsc --noEmit -p tsconfig.json` after each phase — type-checks the new
  `host`/`isLoopbackHost` code and the unchanged call sites around it.
- `npm run build` after each phase — confirms the compiled `dist/server.js` runs.
- Manual/browser checks, one set per phase, as listed under each phase's *Verify*
  above: default bind unchanged (Phase 1), warning fires only for non-loopback hosts
  and is silent for loopback aliases (Phase 2), README bullet reads correctly
  (Phase 3). The Phase 1 network-reachability check needs a second device (or a
  second machine's browser) on the same LAN pointed at this machine's LAN IP; if none
  is available, `curl -v http://0.0.0.0:4173` or `curl -v http://<LAN-IP>:4173` from
  the same machine after `HOST=0.0.0.0 npm start` is an acceptable substitute, since it
  exercises the same bind address.

## Open questions

1. Is the fixed loopback allowlist (`127.0.0.1`, `localhost`, `::1`) the right set for
   suppressing the warning, or should the warning fire on anything except the exact
   string `127.0.0.1` (i.e. treat `HOST=localhost` as also warning-worthy since it is a
   different value from the hardcoded default)? Recommendation: keep the three-item
   allowlist — `localhost` and `::1` are loopback in effect, and warning on them would
   be a false positive that trains the operator to ignore the warning.
2. Should the startup warning also be written somewhere more durable than stdout (e.g.
   a one-time note the first time a device other than loopback actually connects), or
   is a startup-only console warning sufficient? Recommendation: startup-only is
   sufficient — Context asks for a "startup warning" specifically, and per-connection
   logging would be a new observability feature beyond what was scoped.
3. Confirm there really is no deployment pipeline or CI step that starts this server
   with a fixed `HOST` value already set, which would silently change behaviour under
   this plan without the operator having opted in via that variable at that call site.
   Recommendation/assumption used in this plan: none exists, since this is described
   as a local single-user dev tool with no production deployment (see Scope
   assumptions).

## Alternatives considered and rejected

- **CLI flag (e.g. `--host 0.0.0.0`) instead of an environment variable.** Rejected:
  the project has zero argument-parsing code today, and adding it would mean either a
  hand-rolled `process.argv` scan or a new dependency — both disproportionate to one
  setting, and inconsistent with the existing `PORT` precedent this feature is asked
  to mirror.
- **Default to `0.0.0.0` (open by default) with opt-out.** Rejected outright by
  Context, which is explicit that the default must stay loopback-only and widening
  must be opt-in; an open-by-default server with no authentication would silently
  expose every registered project on first run after upgrade.
- **A config file (e.g. `praxis.config.json`) for host/port settings.** Rejected: the
  project already has a working, simple env-var convention for exactly this kind of
  setting (`PORT`); introducing a second, file-based configuration mechanism for a
  single additional value is unnecessary complexity the codebase doesn't already have
  a pattern for.
- **General CIDR/IP-range-aware "is this a private network address" check to decide
  when to warn.** Rejected: the goal is a warning for "not loopback," not a network
  topology classifier; a fixed three-item loopback allowlist is simpler, sufficient,
  and matches YAGNI — nothing in Context asks for distinguishing LAN-private
  addresses from public ones.
