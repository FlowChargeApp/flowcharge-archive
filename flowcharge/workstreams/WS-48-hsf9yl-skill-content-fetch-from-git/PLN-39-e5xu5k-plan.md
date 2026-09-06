---
id: PLN-39-e5xu5k
type: plan
workstream: WS-48-hsf9yl
slug: skill-content-fetch-from-git
title: "Fetch Praxis skill content live from Gitea instead of vendoring it"
status: done
created: 2026-08-20
updated: 2026-08-20
depends_on: []
links: []
---

## Summary

Replace WS-44's vendored `skills/` copy with a new `src/lib/skill-content-fetch.ts` module
that fetches the Praxis skill suite live, on every call, from the self-hosted Gitea
instance's `GET /{owner}/{repo}/archive/{ref}.tar.gz` route (`http://100.87.185.97:8110/akoukoullis/Praxis/archive/master.tar.gz`),
using Node's built-in `fetch` and `node:zlib` plus a small hand-rolled USTAR tar reader (no
new runtime dependency), and wires it into `electron/agentic-tools-ipc-handlers.cts`'s
still-placeholder `getInstallContent`, following that file's existing dynamic-import pattern.
WS-44's vendored deliverables (`skills/`, `tools/sync-praxis-skills.mjs`,
`src/lib/skill-content.ts`, `src/lib/skill-content.test.ts`) are deleted once the new path is
proven working. The chosen approach and every design point below were confirmed against the
real, live Gitea host during reconnaissance for this plan (see Design), not assumed from
Context alone.

## Scope

### Acceptance criteria

1. A user who triggers a skill install (via the existing onboarding "install" flow) causes
   `electron/agentic-tools-ipc-handlers.cts`'s `installSelected` handler to install the real,
   current Praxis skill suite (fetched live from Gitea) into the chosen target — not the
   empty placeholder list, and not a vendored copy.
2. `getInstallContent(toolId)` ignores `toolId` and returns the same `InstallContent`
   (`version` + all 8 `prx-*` skills, each with `id`/`name`/`description`/`body`, and
   `prx-orchestrate` additionally carrying its nested `files[]`) regardless of which tool
   asked, matching the existing `GetInstallContent` port shape
   (`src/lib/agentic-tools-content.ts:26`) and the same `SkillContent`/`InstallContent` field
   shapes the deleted `src/lib/skill-content.ts` used.
3. If the Gitea host is unreachable or returns a non-2xx response, `getInstallContent`
   rejects with a real error, and that error surfaces to the caller through
   `agentic-tools-ipc-handlers.cts`'s existing `try/catch` → `{ ok: false, status: 500, error
   }` path (already present, unchanged) — no offline/vendored fallback content is ever
   returned.
4. `skills/`, `tools/sync-praxis-skills.mjs`, `src/lib/skill-content.ts`, and
   `src/lib/skill-content.test.ts` no longer exist in the repository, and nothing else
   references them (`npm run build` and the full `node --test dist/lib/*.test.js` suite both
   pass with them gone).
5. Swapping the fetch source to a different host later (e.g. `github.com` once Praxis is
   public) is a one-line change to the base-URL constant in the new module — no rewrite of
   the fetch/extract/parse logic.

### Out of scope

- Any offline/bundled fallback path (Context decision 3 — explicitly rejected).
- Caching fetched content to disk or in memory (left open below, per Context's instruction).
- Browser-tab-mode support for the skill-install engine — it is Electron-only today
  (`src/server.ts` has no route for it and `src/public/browser-ipc-shim.ts` does not stub
  `window.praxisSkillInstallAPI`, confirmed during reconnaissance), and Context does not ask
  this plan to change that.
- Any change to `agentic-tools-install.ts`, `agentic-tools-install-tracking.ts`,
  `agentic-tools-fs-adapter.ts`, `agentic-tools-catalogue.ts`, `agentic-tools-detect.ts`,
  `agentic-tools-skill-presence.ts`, or `agentic-tools-canonical-skills.ts` — none of these
  are named by Context, and `installSelected`'s call site at
  `electron/agentic-tools-ipc-handlers.cts:296` needs no change (same signature, same
  `await`), confirmed by reading the file.
- Authenticating the Gitea fetch — the repo is public-read; no credentials are needed or
  handled.
- Version-pinning the fetched ref (tags/releases) — see Open Questions.

### Assumptions confirmed during reconnaissance (not left open)

- **Archive ref**: the Gitea repo's `default_branch` is `master`, confirmed live via
  `GET /api/v1/repos/akoukoullis/Praxis` during reconnaissance, and
  `GET /akoukoullis/Praxis/archive/master.tar.gz` returns `200 OK` with a real 100KB-ish
  gzip. The new module fetches `master` by name (a plain string constant), not a resolved
  default-branch lookup — simplest option, and matches this whole workstream's
  pre-public/dev-stand-in framing (Context, Background).
- **Archive top-level directory**: confirmed by downloading and inspecting the real archive
  that its single top-level entry is `praxis/` (lowercase, not matching the
  `Content-Disposition` header's `Praxis-master.tar.gz` filename) — extraction strips
  whatever the first path segment actually is, generically, per Context decision 6.
- **Tar format specifics** (load-bearing for the hand-rolled parser, confirmed by direct
  byte-level inspection of the real archive, not assumed): the archive is plain POSIX USTAR
  (`ustar\0` magic at offset 257), the longest real path is exactly 63 characters
  (`praxis/skills/prx-orchestrate/prompts/tasks-from-issues-spec.md`, confirmed via `tar -tzf
  | awk '{print length}' | sort -rn`), and only two typeflags appear among the real entries:
  `'0'` (regular file) and `'5'` (directory) — no symlinks, no GNU long-name extensions.
  **Important, non-obvious finding**: the archive's very first 512-byte header block has
  typeflag `'g'` — a PAX *global extended header* record (`name: pax_global_header`, `size:
  64`) that `git archive` (which Gitea's archive route shells out to) always emits before the
  real entries. `tar -tzf` and Python's `tarfile` both consume this transparently and never
  show it in a listing, which makes it invisible unless the raw bytes are inspected directly
  — exactly what reconnaissance did here. A parser that only recognizes typeflags `'0'` and
  `'5'` and does not know how to skip an unrecognized typeflag's data blocks will
  misinterpret every offset after the first header and fail on the very first real entry.
  The parser design below handles this by advancing past any entry's data blocks regardless
  of typeflag, and only emitting a `SkillContent`-relevant entry for `'0'`/`'5'`.
- **Test network dependency**: the deleted `src/lib/skill-content.test.ts` read from a
  committed `skills/` fixture and needed no network. Once that directory is gone, a
  like-for-like "known 8 skills, known nested-file list" assertion can only be made against
  the live Gitea host. This plan keeps the tar-parsing and frontmatter-parsing logic covered
  by fully offline unit tests (synthetic in-memory fixtures, see Testing strategy), and adds
  one live integration test that calls the real `getInstallContent()` — which fails loudly
  when Gitea is unreachable, matching this feature's own accepted failure mode (Context
  decision 3) rather than inventing a skip-when-offline mechanism nothing asked for.

## Design

### Module boundary

New file: **`src/lib/skill-content-fetch.ts`**, following the exact structure and
header-comment style `src/lib/skill-content.ts` used before deletion. It knows: the
Gitea/GitHub archive URL shape (`GET /{owner}/{repo}/archive/{ref}.tar.gz`), the gzip+USTAR
tar binary format, and `SKILL.md`'s frontmatter grammar (same-line scalar and folded
`>`/`>-`/`>+` block-scalar `description:`, carried forward from the deleted
`src/lib/skill-content.ts:45-112` verbatim, since it is already correct — Context decision 7).
It must **not** know about install targets, tool-specific formats, install tracking, or how
content gets written to disk — those stay `agentic-tools-install.ts`'s and
`agentic-tools-content.ts`'s concern, reached only through the `GetInstallContent` port shape
(`src/lib/agentic-tools-content.ts:26`) this module's `getInstallContent` conforms to
structurally (same technique the deleted file used: TypeScript structural typing needs no
adapter as long as the local `SkillContent`/`InstallContent` interfaces stay shape-identical
to `agentic-tools-content.ts`'s).

The module never writes anything to disk. The `relativePath` strings inside each
`SkillContent.files[]` entry come from the fetched archive's own file names (minus the
stripped top segment) and are not sanitized against path traversal here, because this module
never combines them with a filesystem base path — that already happens, unchanged, inside
`agentic-tools-install.ts`'s existing write path, out of scope for this plan.

### Contracts

```ts
// Local copies of agentic-tools-content.ts's shapes — same technique the deleted
// skill-content.ts used, so getInstallContent is structurally assignable to the
// GetInstallContent port with no adapter.
export interface SkillContent {
  id: string;
  name: string;
  description: string;
  body: string;
  files?: { relativePath: string; content: string }[];
}
export interface InstallContent {
  version: string;
  skills: SkillContent[];
}

// Base-URL-templated so a host swap (e.g. to github.com) is a one-line constant
// change — GitHub serves the identical GET /{owner}/{repo}/archive/{ref}.tar.gz
// path shape, confirmed in Context.
const PRAXIS_REPO_BASE_URL = 'http://100.87.185.97:8110/akoukoullis/Praxis';
const PRAXIS_REPO_REF = 'master';
function buildArchiveUrl(baseUrl: string, ref: string): string; // `${baseUrl}/archive/${ref}.tar.gz`

// Minimal USTAR entry, produced by the hand-rolled parser below.
interface TarEntry {
  name: string;        // raw path from the header, e.g. 'praxis/skills/prx-git/SKILL.md'
  typeflag: string;     // single character: '0' file, '5' directory, anything else = skip
  content: Buffer;      // empty for non-file entries
}

function parseTar(buf: Buffer): TarEntry[];
// Walks 512-byte header blocks. For each: reads name (bytes 0-100, NUL-padded),
// typeflag (byte 156), and size (bytes 124-136, octal ASCII, NUL/space-padded).
// Advances the read offset past ceil(size/512)*512 data bytes regardless of
// typeflag (this is what makes skipping the leading 'g' pax_global_header safe —
// see Assumptions). Only pushes a TarEntry for typeflag '0' or '5'; other
// typeflags (currently only the one leading 'g' record) are skipped entirely.
// Stops at the first all-zero 512-byte block (end-of-archive marker).

async function getInstallContent(_toolId: string): Promise<InstallContent>;
// 1. fetch(buildArchiveUrl(PRAXIS_REPO_BASE_URL, PRAXIS_REPO_REF)); throws if !res.ok.
// 2. gunzipSync(Buffer.from(await res.arrayBuffer())) -> tar buffer.
// 3. parseTar(...) -> TarEntry[].
// 4. Strip each entry's first path segment (name.split('/').slice(1).join('/')),
//    generically — never hardcoding 'praxis' (Context decision 6).
// 5. Keep only stripped paths starting with 'skills/'; group by the next segment
//    (the skill id) into { skillMdContent, files[] }, applying the same three
//    exclusion rules skill-content.ts used (isExcluded: dotfile, .git*, *.zip)
//    per path segment, carried forward unchanged.
// 6. For each skill id with a SKILL.md entry, run parseSkillFrontmatter (carried
//    forward from skill-content.ts:106-112 unchanged) to get name/description/body,
//    sort files[] by relativePath, sort skills by id — same ordering skill-content.ts
//    produced.
// 7. Return { version: 'fetched-from-git', skills }. (version is informational
//    only per agentic-tools-content.ts:19's own comment; no commit-hash tracking
//    is added — nothing consumes more than an informational string today, and
//    hashInstallContent() in agentic-tools-content.ts already owns real change
//    detection, unaffected by this plan.)
```

### Wiring: `electron/agentic-tools-ipc-handlers.cts`

Reconnaissance found **seven** existing dynamic-import blocks inside
`registerAgenticToolsIpcHandlers` (lines 251-273: `installModule`, `trackingModule`,
`fsAdapterModule`, `catalogueModule`, `detectModule`, `skillPresenceModule`,
`canonicalSkillsModule`) — not five, correcting Context's count against the file as it
actually reads today. This plan adds an **eighth**, in the same style:

- Delete the placeholder `async function getInstallContent` (lines 218-223, returning
  `{ version: 'placeholder', skills: [] }`).
- Add a local `type GetInstallContentFn = (toolId: string) => Promise<InstallContent>;` next
  to the file's other locally-mirrored type aliases (the local `InstallContent` interface at
  lines 147-156 already matches the new module's shape and needs no change).
- Add `let getInstallContent!: GetInstallContentFn;` alongside the file's other
  definite-assignment `let`s (lines 235-243).
- Inside `registerAgenticToolsIpcHandlers`, add:
  ```ts
  const skillContentModule = (await dynamicImport('../lib/skill-content-fetch.js')) as {
    getInstallContent: GetInstallContentFn;
  };
  ```
  alongside the seven existing blocks, and assign `getInstallContent =
  skillContentModule.getInstallContent;` alongside the file's other post-import
  assignments (lines 275-283).
- The `installSelected` handler's call site (`const content = await
  getInstallContent(target.toolId);`, line 296) needs no change — same signature, same
  `await`, and its surrounding `try/catch` (lines 288-308) already turns any thrown error
  (including a fetch/gunzip/tar failure) into `{ ok: false, status: 500, error: ... }` for
  free, satisfying acceptance criterion 3 with no new error-handling code.

## Staged task breakdown

### Phase 1 — Fetch/extract/parse module, fully tested in isolation

1. **Build `src/lib/skill-content-fetch.ts`.** Implement the config constants, `fetch` +
   `gunzipSync` download step, the hand-rolled `parseTar`, path-prefix stripping, exclusion
   filtering, frontmatter parsing (carried forward from the pre-deletion
   `src/lib/skill-content.ts`), and `getInstallContent`, per Design above.
   Files: `src/lib/skill-content-fetch.ts` (new). Effort: medium-large (the tar parser is the
   one genuinely novel piece). Depends on: nothing. Verify: exercised by task 2's tests.

2. **Write `src/lib/skill-content-fetch.test.ts`.** Three tiers, per the Assumptions section
   above: (a) offline unit tests for `parseTar` against a small hand-built in-memory USTAR
   buffer covering a regular file, a directory, and a leading unrecognized-typeflag (`'g'`)
   record to prove the skip-and-advance logic; (b) offline unit tests for the frontmatter
   parser using inline fixture strings (same-line `description:` and a folded `>-`
   multi-line case, ported from the deleted `skill-content.test.ts`'s assertions since its
   `skills/` fixture directory is gone); (c) one live-network test calling the real
   `getInstallContent()` and asserting the known 8 `prx-*` ids and `prx-orchestrate`'s known
   nested `files[]` list, mirroring the deleted test's assertions against the live fetch.
   Files: `src/lib/skill-content-fetch.test.ts` (new). Effort: medium. Depends on: task 1.
   Verify: `npm run build && node --test dist/lib/skill-content-fetch.test.js` passes (Gitea
   reachable over Tailscale).

### Phase 2 — Wire the real reader into the IPC handler

3. **Replace the placeholder in `electron/agentic-tools-ipc-handlers.cts`** with the
   dynamic-import-backed real `getInstallContent`, per Design's Wiring section. Files:
   `electron/agentic-tools-ipc-handlers.cts`. Effort: small. Depends on: Phase 1 (the module
   and its exported shape must exist). Verify: `npm run build` succeeds (all three `tsc`
   projects + `copy-assets.mjs`), then `npm run electron:dev`, open the onboarding install
   screen, select a detected tool and the canonical skills, run install, and confirm the
   installed files on disk contain real skill body/description content (not an empty list) —
   a manual smoke test, since this engine has no automated end-to-end coverage today
   (Context's own confirmed Electron-only scope).

### Phase 3 — Remove the superseded vendored deliverables

4. **Delete `skills/`, `tools/sync-praxis-skills.mjs`, `src/lib/skill-content.ts`,
   `src/lib/skill-content.test.ts`.** Files: those four paths (three files, one directory).
   Effort: small. Depends on: Phase 2 (delete only once the replacement is proven wired and
   working, even though nothing today actually calls the old code at runtime — confirmed
   during reconnaissance that `agentic-tools-ipc-handlers.cts`'s real, wired
   `getInstallContent` was always the standalone placeholder, never
   `skill-content.ts`'s implementation, so this deletion carries no runtime regression risk
   at any point). Verify: `grep -rn "skill-content\.\|sync-praxis-skills" --include=*.ts
   --include=*.cts --include=*.mjs .` (excluding `node_modules` and `flowcharge/`) returns
   nothing; `npm run build` and the full `node --test dist/lib/*.test.js` suite both still
   pass; `git status` shows only these four deletions plus Phase 1/2's additions/edits for
   this workstream.

## Data & compatibility

- No persisted data shape changes. `InstallContent`/`SkillContent` are the same shapes
  before and after — only which code produces them changes.
- `.praxis-installs.json` (the install registry, read/written by
  `agentic-tools-install-tracking.ts`, unchanged by this plan) is forward-compatible as-is:
  an existing record's `contentHash` was computed against the placeholder's empty skill list,
  so the first real install after this plan lands will naturally compute a different hash and
  report `status: 'updated'` rather than `'up-to-date'` — correct behavior (the content
  genuinely changed from empty to real), not a compatibility break.
- Rollback: no migration to reverse. Reverting Phase 2's commit alone (redeploying the
  previous build with the placeholder restored) fully reverts the feature's runtime behavior;
  reverting the whole feature branch also restores the vendored files if that is ever wanted,
  though Context does not ask this plan to keep that path open.

## Testing strategy

- **Unit, offline** (Phase 1, task 2a/2b): `parseTar` against a synthetic in-memory tar
  buffer (no network, no real archive needed) and the frontmatter parser against inline
  fixture strings. These run in any environment, including one without Tailscale access.
- **Integration, live-network** (Phase 1, task 2c): one test calling the real
  `getInstallContent()` end-to-end against the actual Gitea host, asserting the known skill
  set and `prx-orchestrate`'s known file list — the direct replacement for the deleted
  `skill-content.test.ts`'s fixture-backed assertions, now exercising the real network path
  instead of a committed copy.
- **Manual smoke test** (Phase 2, task 3): the onboarding install flow end-to-end in
  `npm run electron:dev`, since the whole skill-install engine is Electron-only and has no
  existing automated IPC-level test harness (confirmed during reconnaissance — out of scope
  for this plan to add one, since Context does not ask for it).
- **Regression** (Phase 3, task 4): the full existing `node --test dist/lib/*.test.js` suite
  must stay green after deletion, proving nothing else depended on the removed files.

## Open questions

1. **Cache fetched content, or re-fetch fresh on every `getInstallContent` call?** Since no
   offline fallback is wanted, a cache's only value is speed, not resilience: it adds a
   staleness risk (an upstream Praxis skill change silently not picked up until the cache
   expires or is cleared) and a second failure mode (a stale cache masking a since-fixed
   repo) for a feature that is triggered by an explicit user action, not a hot path. My
   recommendation is **no cache for now** — re-fetch fresh every call, matching this
   codebase's existing "extracted live on request" philosophy (already the stated rationale
   in the pre-deletion `skill-content.ts:148-150`, and in `extract.ts`'s own live-read
   design) and the archive's small size (~100KB). If install actions turn out to be
   triggered often enough that repeated fetches are noticeably slow, a cache can be added
   later as a pure performance layer without changing the `GetInstallContent` port's
   contract — and if it is, `src/lib/projects.ts`'s established `process.env.PRAXIS_DATA_DIR
   || repoRoot` convention (Context decision 10) is the pattern to reuse for a writable cache
   location. This is left open for the user to settle, per Context's explicit instruction.

2. **Should the fetch pin a specific ref (tag/release/commit) instead of always tracking
   `master`'s moving tip?** Not raised by Context, but worth surfacing: fetching `master` by
   name means every install always gets whatever is currently on that branch, with no
   version pinning — an in-progress or momentarily broken commit on the Praxis repo's
   `master` would propagate to the next install immediately, with no way to pin to a known-
   good point. My recommendation is to accept this for now, since it matches the whole
   workstream's explicitly pre-public, dev-stand-in framing (Context, Background: "neither
   Praxis nor Praxis Dashboard is public yet"), and pinning can be introduced later as a
   `PRAXIS_REPO_REF` constant change with zero structural impact, exactly like the
   host-swap flexibility already designed in. Left open for the user to confirm or override.

## Alternatives considered and rejected

- **Add `tar`/`unzipper`/`node-tar` as a real npm dependency** instead of hand-rolling the
  USTAR reader. Rejected: contradicts this repo's own stated "no runtime dependency"
  philosophy (README.md's Notes section), and — more concretely — `package.json`'s
  `build.files` (`["dist/**/*", "package.json"]`) excludes `node_modules` from the packaged
  Electron app entirely, so a declared runtime dependency would silently vanish from a
  packaged build unless that config were also widened, which nothing in Context asks for.
- **Shell out to the system's `tar`/`curl` binaries via `child_process`** instead of using
  Node's built-in `fetch`/`node:zlib` plus a hand-rolled parser. Rejected: adds a dependency
  on external binaries being present and resolvable on `PATH` from inside a packaged
  Electron app's process environment, with platform-specific availability and quoting
  differences across macOS/Linux/Windows — strictly worse than Node's built-ins, which
  already cover the whole job.
- **Fetch a `.zip` archive instead of `.tar.gz`.** Both Gitea and GitHub serve a matching zip
  route. Rejected: `node:zlib` gives gzip decompression for free, but ZIP's central-directory
  format needs meaningfully more hand-rolled parsing (or a real dependency like `unzipper`)
  for no benefit over tar.gz, which Context's decision 5 already anticipated and this plan's
  reconnaissance confirmed works cleanly.
- **Keep the vendored `skills/` copy as a permanent fallback** alongside the new live fetch.
  Rejected outright per Context decision 3 — no fallback content is wanted, and a fetch
  failure is an acceptable failure for this pre-public workstream.

---

**Recap:** one approach — a hand-rolled, dependency-free fetch/gunzip/tar-parse module
(`src/lib/skill-content-fetch.ts`) wired into the existing placeholder via
`agentic-tools-ipc-handlers.cts`'s established dynamic-import pattern — delivered as 3
phases / 4 tasks (medium-large, small, small effort respectively), with WS-44's vendored
deliverables deleted last, once the replacement is proven working end-to-end. Top risks: the
hand-rolled tar parser is the one genuinely novel piece of code (mitigated by the confirmed,
byte-level-verified format details in Assumptions, including the easy-to-miss leading PAX
global-header record); the live-network integration test and the feature itself both depend
on the Gitea host being reachable over Tailscale, with no fallback by design. Two open
questions need the user's call: whether to cache fetched content (recommendation: no, for
now), and whether to pin a specific ref instead of tracking `master`'s moving tip
(recommendation: accept the moving tip for now, given the pre-public framing).
