---
id: PLN-87-k0iwn2
type: plan
workstream: WS-100-t1os8w
slug: usage-telemetry
title: "Anonymous app-start telemetry via Aptabase"
status: ready
created: 2026-09-09
updated: 2026-09-09
depends_on: []
links: []
---

# Anonymous app-start telemetry via Aptabase

## Summary

FlowCharge sends one anonymous `app_started` event to Aptabase each time the packaged
CLI binary starts. The event carries a random install ID, the app version and the OS,
and nothing else. Two small library modules do the work: `src/lib/telemetry-install-id.ts`
owns the persisted ID file, and `src/lib/telemetry.ts` owns the opt-out check, the payload
and the HTTP POST. The only call site is the entry point that `tools/package-cli.mjs`
generates, so a development run, a test run and an unpackaged server send nothing.

This placement is the core decision. The composition root `src/server.ts` runs in every
`npm start`, in the boundary test harness and inside the packaged binary alike, so a ping
fired there would count the maintainer's own runs. The generated entry runs only in a
shipped binary, which is exactly the population the feature must measure.

## Scope

### Acceptance criteria

1. A packaged binary started with no opt-out variable set sends exactly one `app_started` event per process start.
2. With `FLOWCHARGE_NO_TELEMETRY` set to any value other than empty or `0`, the binary makes no network request and writes no telemetry file.
3. The event body carries only a timestamp, a session ID, the event name, `isDebug` false, the OS name, the OS release, the app version, an SDK version string and one prop `installId`.
4. The install ID is a random UUID created once in `<PRAXIS_DATA_DIR>/.praxis-telemetry.json` and reused by every later run that reads the same directory.
5. `npm start`, `npm test` and any unpackaged run send no event, because only the generated CLI entry calls the telemetry module.
6. A refused, slow or failing request never delays the socket bind, never prints anything and never changes an HTTP response.
7. `README.md` gains a telemetry section that states what is sent, what is never sent, where it goes and how to turn it off.
8. The byte-identical `README.md` in the sibling `flowcharge-public` repository — `../flowcharge-public/README.md`, relative to this repository's root — gains the same telemetry section, with the same wording, in the same release.
9. `npm test` passes offline, and the packaged-CLI boundary suite still sees exactly one file in `PRAXIS_DATA_DIR`.

### Out of scope

- Error and crash reporting of any kind. Sentry was considered and rejected before this workstream.
- Any UI, board tile or settings toggle for telemetry. The environment variable is the whole control surface.
- A session-duration or session-end event. See Adjacent opportunities for the reasoning.
- Any change to routes, the board payload, the project registry or the update-check feature.
- The Electron scaffolding under `electron/`. It is not a release path, per `CLAUDE.md`.

### Assumptions

- The endpoint is `https://us.aptabase.com/api/v0/event`, the headers are `App-Key` and `Content-Type: application/json`, and every body key is camelCase. Aptabase publishes no official REST reference; these facts come from the Aptabase server source (`src/Features/Ingestion/EventBody.cs`, `EventsController.cs`) and its own SDK sources. Stage 1 confirms them against the live service before anything else is built on them.
- Opt-out rule: telemetry is off when `FLOWCHARGE_NO_TELEMETRY` is set to any value except the empty string and `0`.
- The ID file is named `.praxis-telemetry.json`, matching the existing `.praxis-installs.json`, `.praxis-update.json` and `.praxis-projects.json` in the same directory.
- The persistent `installId` prop is a settled decision, not an open point. The workstream record asks for an install ID that is generated once and reused, so that the count answers "how many people" rather than "how many launches". The design keeps it for that reason, even though Aptabase itself uses no persistent device identifier.
- The request timeout is 3000 ms.
- `osName` maps `darwin` to `macOS`, `linux` to `Linux`, `win32` to `Windows`, and passes any other platform string through unchanged.
- `osVersion` is `os.release()`, which is the kernel release string, not the marketing OS version.
- `DEVELOPMENT.md` gains one row for `FLOWCHARGE_NO_TELEMETRY` in its environment-variable table, so that table stays the complete list. This row is accepted, deliberate scope, not a stray addition: the table is maintained as the complete variable list, so a new variable that is not listed makes it wrong.
- No release has been cut yet (`DEVELOPMENT.md`, "Cutting a release"), so there are no live users, no data to migrate and no need to dark-launch this behind a flag.

## Key flows

**App start ping** — **Actor:** a user running the packaged `flowcharge` binary. **Preconditions:** `FLOWCHARGE_NO_TELEMETRY` is unset; the data directory resolves to `~/.flowcharge` or to `PRAXIS_DATA_DIR`. **Main flow:** the generated entry applies the CLI defaults, imports the server, and then calls the telemetry module without awaiting it; the module reads or creates the install ID, builds the event and POSTs it. **Outcome:** the board serves normally, and one `app_started` event appears in the Aptabase dashboard. **Edge cases:** an offline machine, a 4xx answer, a hung connection and an unwritable data directory all end the same way — nothing is printed, nothing is delayed and the run is unaffected.

**Opt out** — **Actor:** a user who does not want to be counted. **Preconditions:** the user sets `FLOWCHARGE_NO_TELEMETRY=1` in the environment. **Main flow:** the telemetry module tests the variable before it touches the filesystem or the network. **Outcome:** no request is made and `.praxis-telemetry.json` is never created. **Edge cases:** the values `''` and `0` leave telemetry on, which is what the README states.

## Design

### Module 1 — `src/lib/telemetry-install-id.ts`

Owns `.praxis-telemetry.json` and nothing else. It mirrors `src/lib/update-prefs.ts`: every
failure returns a usable value rather than throwing, and the write goes to a sibling
temporary file that is then renamed over the target (`src/lib/update-prefs.ts:78-82`).

```ts
export interface InstallIdResult {
  installId: string;   // a UUID from node:crypto randomUUID()
  persisted: boolean;  // false when the file could not be written
}

export function readOrCreateInstallId(dataDir: string): InstallIdResult;
```

The file's shape is `{ "installId": string }`. An absent file, unparseable JSON, a
non-object body or a missing or non-string `installId` all lead to a fresh UUID and an
attempted rewrite. A failed write returns the fresh UUID with `persisted: false`; the run
is still counted, at the cost of that install being counted more than once.

It knows the file name, the file shape and the atomic-write technique. It must NOT know
Aptabase, HTTP, the app key, the opt-out variable, or where `dataDir` came from.

### Module 2 — `src/lib/telemetry.ts`

Owns the opt-out check, the Aptabase contract and the one outbound request. It reads no
environment variable at module scope, so a static import of it in the generated entry
cannot be affected by the hoisting constraint recorded at `tools/package-cli.mjs:120-130`.

```ts
export const APTABASE_EVENT_URL: string;      // 'https://us.aptabase.com/api/v0/event'
export const APTABASE_APP_KEY: string;        // 'A-US-2875955020' — public, not a secret
export const TELEMETRY_OPT_OUT_VAR: string;   // 'FLOWCHARGE_NO_TELEMETRY'

export interface TelemetryInput {
  dataDir: string;                // where .praxis-telemetry.json lives
  appVersion: string;             // PRAXIS_APP_VERSION, always non-empty by this point
  platform: string;               // process.platform
  osRelease: string;              // os.release()
  env: NodeJS.ProcessEnv;         // read for the opt-out variable only
}

export interface AptabaseEvent {
  timestamp: string;              // ISO 8601, from new Date().toISOString()
  sessionId: string;              // decimal digits, 18 characters
  eventName: string;              // 'app_started'
  systemProps: {
    isDebug: boolean;             // always false
    osName: string;               // 'macOS' | 'Linux' | 'Windows' | the raw platform
    osVersion: string;            // os.release()
    appVersion: string;
    sdkVersion: string;           // `flowcharge-cli@${appVersion}`, cut to 40 characters
  };
  props: { installId: string };
}

export function isTelemetryEnabled(env: NodeJS.ProcessEnv): boolean;
export function osNameFor(platform: string): string;
export function newSessionId(nowMs: number, random8: number): string;
export function buildAppStartedEvent(
  input: TelemetryInput,
  installId: string,
  sessionId: string,
  timestamp: string,
): AptabaseEvent;
export function trackAppStarted(input: TelemetryInput, timeoutMs?: number): Promise<void>;
```

`trackAppStarted` resolves and never rejects. Its whole body sits inside one unconditional
`catch`, for the reason `src/lib/update-check.ts:118-125` records: `AbortSignal.timeout`
rejects with a `TimeoutError` `DOMException`, which an `instanceof`-filtered catch would
let escape. It logs nothing on any path, including success. It returns immediately when
`isTelemetryEnabled` is false, before the install-ID module is called. The request sets
`signal: AbortSignal.timeout(timeoutMs)`, sends no cookie and no credential, and ignores
the response body entirely.

`newSessionId` builds the ID by string concatenation — the epoch seconds followed by
`random8` padded to eight digits. Arithmetic would be wrong here: `epochSeconds * 1e8` is
about `1.8e17`, well past `Number.MAX_SAFE_INTEGER`. Aptabase reads the first ten digits
back as epoch seconds and rejects a start time older than seven days or more than ten
minutes ahead, so a per-run ID is required and a persistent one is not usable in this field.

`APTABASE_EVENT_URL` is a constant, and no exported function takes a destination argument.
That is the same rule `src/lib/update-check.ts:43-47` follows, so no caller can steer where
this module reaches.

The module knows the Aptabase wire contract, the opt-out variable and the fields listed
above. It must NOT know routes, the board payload, project paths, `flowcharge/` content, the
project registry, or how the data directory was resolved.

### Call site — `tools/package-cli.mjs`

The generated `dist/cli-entry.js` gains three changes to its `entryLines`:

- `applyCliDefaults(...)` is called with its result captured, so `dataDir` is available.
- A static import of `./lib/telemetry.js` is added beside the existing `./cli-bootstrap.js` import.
- After `await import('./server.js')`, one unawaited call to `trackAppStarted` passes `dataDir`, `process.env.PRAXIS_APP_VERSION`, `process.platform`, `os.release()` and `process.env`.

The call is last so nothing precedes the server bind, and it is unawaited so the process
never waits on it. `os` is already imported by the generated entry
(`tools/package-cli.mjs:134`).

### What is deliberately not built

No new port under `src/ports/` and no adapter pair. The workstream requires none, there is
one implementation and one call site, and `src/lib/update-check.ts` is the established
precedent in this repository for an outbound-HTTP library module with no port.

### Non-functional notes

Security: the app key is a public client identifier, so compiling it in is correct and no
secret is added to the binary. The payload carries no path, file name or project content.
Aptabase derives an approximate country from the request IP at its own end; the README
section states this. Observability: the Aptabase dashboard is the whole observability
story, and the app itself logs nothing about telemetry by design.

## Stages

1. **Live ping, opted out everywhere it must be.** Build both modules, wire the generated entry, and add `FLOWCHARGE_NO_TELEMETRY=1` to the environment the packaged-CLI boundary suite spawns its children with. First because the wire contract is reconstructed from Aptabase's source rather than an official reference, and a rejected payload changes the design. Observable at the end: a packaged binary run once puts an `app_started` event with an `installId` prop in the Aptabase dashboard, `~/.flowcharge/.praxis-telemetry.json` exists, and `npm test` passes offline.
2. **Unit coverage for both modules.** Second because it locks the contract stage 1 proved. Observable at the end: new suites under `src/test/unit/` cover the opt-out matrix, the session-ID format, the payload shape and every failure path, and `npm test` passes.
3. **User-facing documentation.** Last because it describes behaviour the first two stages settled. Steps: write the telemetry section in this repository's `README.md`; copy the same section, with the same wording, into the sibling public repository's byte-identical `README.md` at `../flowcharge-public/README.md` (relative to this repository's root); add the `FLOWCHARGE_NO_TELEMETRY` row to `DEVELOPMENT.md`'s environment-variable table. Observable at the end: both `README.md` files carry the same telemetry section, and `DEVELOPMENT.md`'s environment-variable table lists `FLOWCHARGE_NO_TELEMETRY`.

## Data & compatibility

- One new file, `.praxis-telemetry.json`, in the same directory as the existing `.praxis-*` files. There is no migration: an absent file means a first run.
- No HTTP route, board payload, registry file or preference file changes shape.
- One existing assertion is affected. `src/test/boundary/cli-binary.test.ts:328` asserts that `PRAXIS_DATA_DIR` holds exactly one file after a project is registered. Opting that suite's children out keeps the count at one and keeps the suite offline; without it the suite both fails and sends real events on every developer machine that has Bun.
- Rollback for a user is the environment variable. Rollback for the maintainer is deleting the one call line in `tools/package-cli.mjs` and repackaging; a leftover `.praxis-telemetry.json` is then inert. Events already accepted are removable only from the Aptabase dashboard.
- No release has been cut, so no shipped version's behaviour changes underneath anybody.

## Testing strategy

- **Stage 1** has no automated coverage of the live endpoint, by design: the verification is one packaged run plus the Aptabase dashboard. `npm test` is re-run to prove the boundary suite still passes and still sees one file.
- **Stage 2** adds `src/test/unit/telemetry.test.ts` and `src/test/unit/telemetry-install-id.test.ts`, following the placement rule in `DEVELOPMENT.md` ("Test files under `src/` sit in two folders, not beside the code they cover"). Coverage:
  - `isTelemetryEnabled` across unset, `''`, `0`, `1`, `true` and `no`.
  - `newSessionId` returns eighteen digits whose first ten are the epoch seconds, with no floating-point loss.
  - `buildAppStartedEvent` field names and casing, the `osNameFor` mapping including an unknown platform, and `sdkVersion` cut to forty characters for a long app version.
  - `trackAppStarted` resolves and throws nothing when the stubbed `globalThis.fetch` answers 400, throws, or hangs past the timeout. The stub-and-restore pattern already used at `src/test/unit/skill-content-fetch.test.ts:210-220` is the template.
  - `trackAppStarted` with the opt-out set calls neither the stubbed fetch nor the filesystem.
  - `readOrCreateInstallId` creates the file with a UUID, returns the same ID on a second call, rewrites a corrupt or non-object file, and returns `persisted: false` for an unwritable directory.
- No boundary or HTTP coverage is added. Telemetry touches no route and no request path.

## Open questions

None. The sibling-repository README question is settled and recorded as acceptance
criterion 8 and a Stage 3 step, not left open; the installId question is settled and
recorded as an Assumption.

## Adjacent opportunities

Not requested; listed only so they can be promoted deliberately.

1. Honour the cross-vendor `DO_NOT_TRACK=1` convention alongside the FlowCharge variable — skip for now.
2. A session-duration or periodic heartbeat event — skip. A long-lived local server ends by `Ctrl-C`, a closed terminal or a killed process, so no end signal is reliable, and a heartbeat multiplies events against the 20,000-per-month free tier for a weak measurement.
3. A one-line first-run notice on stdout saying telemetry is on and naming the opt-out variable — skip for now; the README section is the documented control surface this workstream asks for.

## Alternatives considered and rejected

- Use the persistent install ID as Aptabase's `sessionId` — rejected: every run from one machine would look like one endless session, and Aptabase's session count, its natural daily-active measure, would stop meaning anything.
- Fire the ping from `src/server.ts` or `src/http/create-server.ts` — rejected: every `npm start`, every boundary test child and every unpackaged run would ping, polluting the exact numbers the feature exists to produce.
- Fire the ping from `src/cli-bootstrap.ts` — rejected: that module's stated territory is two environment defaults and one `mkdir`, and a network call there widens the `src/ports/cli-bootstrap.ts` contract and puts a `fetch` inside the code path the environment-seam unit tests exercise.
- Add the official Aptabase SDK as a dependency — rejected: this repository has no runtime dependency at all (`DEVELOPMENT.md`, "Prerequisites"), and the whole protocol is one `fetch` POST.
- Batch events through `https://us.aptabase.com/api/v0/events` — rejected: there is one event per process start, so batching adds a queue and a flush policy for no gain.

## Final summary

Two small library modules plus one call from the generated CLI entry send one anonymous
`app_started` event per packaged-binary start; nothing fires in development or in tests.
Three stages, roughly a day of work: live wire-up, unit coverage, documentation. Top risks
are the reconstructed Aptabase payload contract (stage 1 proves it live before anything
rests on it), and the existing boundary assertion that counts files in `PRAXIS_DATA_DIR`.
No open questions remain: the public repository's README section and the persistent
`installId` prop are both settled decisions, recorded above rather than left open.
