---
id: PLN-72-ph4oel
type: plan
workstream: WS-81-qkgk3t
slug: integrations-release-install-version-detection
title: "Install FlowCharge Core releases with version and update detection"
status: done
created: 2026-08-30
updated: 2026-08-30
depends_on: []
links: []
---

# Install FlowCharge Core releases with version and update detection

## Summary

Manage Integrations installs the skill suite from the newest published FlowCharge Core
release instead of a branch tarball, records which release it installed, and shows the
user when a newer release exists with a one-click update. The branch-tarball fetch is
**deleted, not kept as a fallback**: the newest published release is the only content
source, and an absent release or an absent zip asset fails the install with a clear
message.

The chosen approach is the literal one: **download the release zip to a real file, unzip
that file from disk, install the skills, then delete the zip.** Each of the four steps
leaves the artefact a real download flow would leave, in the order the request states it.
The zip asset's bytes are fetched over HTTP under the existing byte cap, written to a
temporary file through a new binary write method on the `FsWriteAccess` port
(`src/lib/agentic-tools-install.ts:35-41`, text-only today), read back from that file,
decoded by a new hand-rolled zip reader, and written out as text files exactly as
`installToTarget` already does. The temporary zip is then removed with the `remove` method
the port already carries.

This needs **no new runtime dependency**. `node:fs` writes and reads binary buffers with
no text or UTF-8 assumption, and the zip container is decoded by a hand-rolled reader over
`zlib.inflateRawSync`, exactly as this repo hand-rolls a USTAR reader today at
`src/lib/skill-content-fetch.ts:149-174` for the same reason — the very reader this plan
deletes, because the release zip replaces the tarball it decodes. The project's
zero-runtime-dependency posture (`package.json` has only devDependencies) therefore
survives this design unchanged. Any earlier claim that a disk-based flow forces the
project's first runtime dependency was wrong and does not survive in this revision.

Version identity is a new optional `version` field on `InstallRecord`, holding the release
tag. Comparison follows the semantics of the pure `isNewer`/`parseSemver` functions this
repo already owns in `src/lib/update-check.ts:52-71`, re-authored as a file-local helper
inside `src/public/home.ts` rather than imported. The import is not possible: the renderer
is compiled by `src/public/tsconfig.json`, which sets `"types": []` and
`"lib": ["dom", "es2020"]`, and `update-check.ts` uses the Node-only `Buffer` global at
lines 98, 110 and 116, so an import from `home.ts` fails the public type-check. No file
under `src/public/` imports from `src/lib/` today; the codebase mirrors shapes into
`src/public/lib/` instead. No version-compare module is added to `src/lib`, and
`update-check.ts` is not modified.

## Scope

### Acceptance criteria

1. With a published release available, "Install selected" downloads that release's zip
   asset to a file on disk, extracts it from that file, and installs the skills it carries,
   so the files written to the install target carry that release's skill ids.
2. The integrations dialog shows the latest release's tag, taken from the first entry of a
   releases list sorted newest-first.
3. After an install sourced from a release, that `(toolId, scope)` install record carries
   the release tag in its `version` field.
4. A row whose recorded version is older than the latest release shows an "Update
   available" chip and an "Update" button.
5. Clicking a row's "Update" button installs the latest release for that row alone, after
   which the row shows the new version and no "Update available" chip.
6. A row whose recorded version equals the latest release tag shows its version and no
   "Update available" chip.
7. When the releases API yields no published release, or the newest published release
   carries no asset whose name ends in `.zip`, "Install selected" installs nothing, writes
   no file, and the user sees the thrown error's own message in the existing install-failure
   alert.
8. A row whose canonical skills are already present on disk shows "Already installed",
   because the canonical skill ids match the ids the release actually ships.
9. During a release-sourced install the downloaded zip exists as a real file under the OS
   temporary directory, and after extraction that file no longer exists.
10. When extraction fails on a corrupt or truncated zip, the install reports the error and
    the temporary zip file is still removed, so no partial download is left behind.
11. The branch-tarball code path no longer exists. `src/lib/skill-content-fetch.ts` exports
    no `buildArchiveUrl`, no `PRAXIS_REPO_REF` and no `parseTar`/`TarEntry`, and imports no
    `gunzipSync`. The project still builds and every remaining test passes.

### Out of scope

- Installing any release other than the newest one. There is no release picker.
- Making the skill-presence check work at Project scope. It stays Global-scope only, as
  today (`src/public/home.ts:517-522`).
- Any change to `removeInstallation`, detection, or the tool catalogue.

### Cross-reference: the separate `PRAXIS_REPO_REF` issue

A separate issue list for this same workstream (ISS-23-22bcfg in IL-12-r4zsp2) fixed the
stale `PRAXIS_REPO_REF = 'master'` 404 defect, and that fix **has already landed** on this
branch: the constant now reads `'main'` in the working tree and the branch-tarball URL
resolves again. That issue is closed. This plan **deletes** the corrected constant and its
only caller, so the fix becomes moot rather than being reverted — stage 1 removes a working
line, not a broken one. Any task that quotes the constant must quote `'main'`, not
`'master'`. This plan edits no issue list itself.

### In scope by explicit decision

`src/lib/agentic-tools-canonical-skills.ts:13-22` lists eight `prx-*` skill ids, but the
release ships `fc-*` skills. `checkSkillPresence` therefore probes paths the installer
never writes, so "Already installed" can never appear. Correcting that list is **in scope**:
acceptance criterion 8 is unreachable without it, the fix is one constant's contents, and
leaving it broken would make a correct install look like a failed one. The fix is limited
to replacing the id strings. The file's structure, its comment, and everything else about
it stay as they are.

### Assumptions

1. The release asset's zip is rooted at the skills directory: entries look like
   `fc-bug-hunt/SKILL.md`, with no top-level directory and no `skills/` prefix.
2. The chosen asset is the first asset whose name ends in `.zip`, on the newest published
   release only. Older releases are never scanned for one.
3. Release tags follow `vMAJOR.MINOR.PATCH`, which `parseSemver` accepts.
4. An install record with no `version`, or with a version `parseSemver` cannot read, shows
   "Version unknown" and offers no update prompt. Update remains reachable through the
   normal checkbox and "Install selected".
5. This is a single-user local app with no live users and no production data. The feature
   ships whole, with no feature flag and no migration.
6. Every published release carries a zip asset, so no fallback content source is needed.
   This rests on the project's real CI, read directly: `release.mjs` is a maintainer-only
   manual command that tags and commits but never uploads an asset, and the CI `release`
   job — triggered on every `v*.*.*` tag push — always builds the zip with
   `build-release-zip.mjs` (which itself refuses to write an asset carrying zero skill
   folders) and always attaches it with a `curl -f` call under `set -eu`. No path in that
   pipeline deliberately publishes a release without a zip.
7. One caveat is accepted rather than designed around: "create the release row" and "attach
   the asset" are separate, non-atomic CI steps, so a transient failure between them
   (network blip, expired token, runner crash) could leave a briefly published, asset-less
   release. That is a CI failure to fix in CI. The app's answer is a clear error and a
   retry once CI republishes, not a second content source.
8. Only the newest release is offered. Older releases are not installable.
9. The OS temporary directory is writable and holds the release zip. The asset is a few
   megabytes, far below the existing download cap, so free space is not a design concern.

## Key flows

**Install the latest release** — **Actor:** a user in Manage Integrations.
**Preconditions:** the Gitea host is reachable and has at least one non-draft release with
a zip asset. **Main flow:** the dialog opens, shows the latest release tag in its header,
the user ticks one or more eligible rows and clicks "Install selected"; the app resolves
the releases list once, downloads the newest release's zip once to a temporary file, reads
that file back, decodes it, deletes the file, installs every selected target from that one
decoded content, and each row's chip shows its install status plus the installed version.
**Outcome:** each installed `(toolId, scope)` record carries the release tag, and no
temporary zip remains on disk. **Edge cases:** the release API is unreachable, publishes no
release, or the newest release carries no zip asset, so `getInstallContent` throws before
any download and the existing alert shows that error's own message, with nothing installed
and no temporary file created; the download or the decode fails, so the temporary file is
removed and the existing error path reports the failure; a target whose content is
byte-identical returns "Up to date" with no
content writes; an unknown tool id or a tool with no supported format returns "No format
for this tool" as today.

**Update an older install** — **Actor:** a user whose recorded version is older than the
latest release. **Preconditions:** an install record exists for that `(toolId, scope)` and
both versions parse. **Main flow:** the dialog shows the row's recorded version, an "Update
available" chip and an "Update" button; the user clicks "Update"; the app installs the
latest release for that one target. **Outcome:** the row shows the new version, "Updated",
and no "Update available" chip. **Edge cases:** the recorded version is absent or
unreadable, so the row shows "Version unknown" and no update prompt; the release fetch
fails during the update, so the existing alert path reports the error and the row keeps its
previous chips.

## Design

### New module: `src/lib/zip-read.ts`

Pure bytes-to-entries decoding. It knows the zip container format and nothing about skills,
install targets, or the filesystem. The buffer it receives is always the bytes **read back
from the downloaded zip file on disk**, never the HTTP response buffer — the file is the
source of truth for the decode, which is what makes the download step real rather than
decorative. Keeping the reader itself pure, over a buffer rather than a path, is what makes
it testable with no temporary directory and keeps every filesystem call behind the injected
port.

```ts
export interface ZipEntry { name: string; content: Buffer }
export function parseZip(buf: Buffer): ZipEntry[]
```

Reads the end-of-central-directory record, walks the central directory, and inflates each
file entry with `zlib.inflateRawSync` for method 8 or copies it verbatim for method 0. Any
other compression method, and any directory entry, is skipped rather than thrown on.
Malformed input throws an `Error` whose message names the failure. Two hard ceilings guard
a hostile archive, stated as module constants beside the existing
`MAX_ARCHIVE_BYTES`/`MAX_DECOMPRESSED_BYTES` style: a maximum entry count and a maximum
total uncompressed byte count.

### New module: `src/lib/skill-release-fetch.ts`

Knows the Gitea/GitHub-compatible release API's JSON shape, and nothing else. It holds no
host constant and imports nothing from `skill-content-fetch.ts`, so there is no import
cycle. The base URL always arrives as a parameter.

```ts
export interface SkillReleaseSummary {
  tag: string;               // tag_name verbatim, e.g. 'v0.1.0'
  name: string;              // release name; '' when absent
  publishedAt: string;       // ISO 8601 published_at; '' when absent
  assetName: string | null;  // chosen .zip asset name; null when the release has none
}

export function releasesApiUrl(baseUrl: string): string
export function buildAssetDownloadUrl(baseUrl: string, tag: string, assetName: string): string
export function parseReleases(raw: unknown): SkillReleaseSummary[]
export function fetchReleases(baseUrl: string): Promise<SkillReleaseSummary[]>
```

`parseReleases` drops any entry with `draft === true` or `prerelease === true`, drops any
entry with no non-empty `tag_name`, and sorts the survivors by `publishedAt` descending
with `tag` descending as the tie-break. It never throws: a shape it cannot read yields `[]`.
`fetchReleases` resolves to `[]` on any non-2xx, network failure, oversized body or
unparseable JSON, following `fetchLatestRelease`'s null-on-every-unhappy-path posture at
`src/lib/update-check.ts:119-157`, and applies a response body cap the same way.

`buildAssetDownloadUrl` returns
`` `${baseUrl}/releases/download/${tag}/${assetName}` ``. The API's own
`browser_download_url` is never followed: it carries hostname `netplex` rather than the IP
the app is pinned to.

Both the releases API URL and the asset URL are derived from the caller-supplied base URL
only, never from renderer input — the same rule `electron/update-check-ipc-handlers.cts`
states for its outbound URL.

### Changed: the `FsWriteAccess` port and its adapter

The port at `src/lib/agentic-tools-install.ts:35-41` is text-only today. It gains a binary
pair beside the text pair, and nothing else:

```ts
export interface FsWriteAccess {
  readTextFile(path: string): Promise<string | null>;
  writeTextFileAtomic(path: string, content: string): Promise<void>;
  readBinaryFile(path: string): Promise<Buffer | null>;              // new
  writeBinaryFileAtomic(path: string, content: Buffer): Promise<void>; // new
  mkdir(path: string): Promise<void>;
  remove(path: string): Promise<void>;
  expandTokens(path: string): Promise<string>;
}
```

`createNodeFsWriteAccess` in `src/lib/agentic-tools-fs-adapter.ts:78-113` implements both
with plain `node:fs/promises` and no encoding argument: `fs.readFile(path)` returns a
`Buffer` when no encoding is given, and `fs.writeFile(path, buffer)` writes those bytes
verbatim. No dependency, no new module, no new import in that file.

Three deliberate choices here:

- **Both directions, not just write.** Unzipping from disk means reading the file back, and
  the port's only read method returns a UTF-8 string, which would corrupt zip bytes.
  `readBinaryFile` mirrors `readTextFile`'s `null`-on-ENOENT contract exactly.
- **Atomic, mirroring the text method.** `writeBinaryFileAtomic` uses the same
  tmp-sibling-then-rename dance as `writeTextFileAtomic` (`agentic-tools-fs-adapter.ts:95-99`),
  including the same-directory rule that avoids `EXDEV`. A plain non-atomic write would also
  be safe here, because the temporary zip has exactly one reader in the same process. Symmetry
  wins: one write pattern in the adapter is easier to reason about than two, and the extra
  rename costs nothing at this size.
- **The port stays the only filesystem door.** `zip-read.ts` never opens a file, and
  `skill-content-fetch.ts` never imports `node:fs`. Both keep the rule
  `agentic-tools-install.ts:1-11` already states for itself.

### Changed: `src/lib/skill-content-fetch.ts`

This file stays the composition point that owns the host constant. It becomes the only
place that knows the download-unzip-delete lifecycle.

```ts
// The narrow slice of FsWriteAccess this module needs, mirrored locally rather
// than imported, exactly as SkillContent/InstallContent are mirrored today.
export interface ArchiveFsAccess {
  mkdir(path: string): Promise<void>;
  writeBinaryFileAtomic(path: string, content: Buffer): Promise<void>;
  readBinaryFile(path: string): Promise<Buffer | null>;
  remove(path: string): Promise<void>;
}

export function listSkillReleases(): Promise<SkillReleaseSummary[]>   // fetchReleases(PRAXIS_REPO_BASE_URL)
export async function getInstallContent(
  _toolId: string,
  deps: { fsWrite: ArchiveFsAccess },
): Promise<InstallContent>
```

The local `ArchiveFsAccess` mirror follows this file's existing mirror-not-import
convention (`skill-content-fetch.ts:10-16`) and lists only the four methods this module
actually calls, so the fetch module never gains reach over the install registry's write
surface. `createNodeFsWriteAccess()`'s return value satisfies it structurally with no
adapter, which is why both call sites can pass the concrete object they already hold.

`getInstallContent` becomes **release-only**, in the request's own order:

1. **Discover.** List releases and take the newest entry, `releases[0]`. Throw if the list
   is empty, or if that one entry's `assetName` is `null`. Older releases are never
   scanned for a zip: scanning down the list is itself a fallback, and this feature
   installs the latest release or nothing.
2. **Download.** Fetch the asset URL, buffer the body through the existing `readCappedBody`
   under `MAX_ARCHIVE_BYTES`, `mkdir` the temporary directory, and write the buffer to the
   temporary zip path with `writeBinaryFileAtomic`.
3. **Unzip.** Read that path back with `readBinaryFile` and decode the returned buffer with
   `parseZip`. A `null` read is treated as a failed download and throws.
4. **Install.** Map the entries to `SkillContent` and return the `InstallContent`. The
   caller's `installToTarget` writes the skill files with the unchanged
   `writeTextFileAtomic` path — skill files are text, so that half of the mechanism was
   already correct and is not touched.
5. **Remove.** Delete the temporary zip with `remove`.

**Failing clearly instead of falling back.** Step 1 throws, and nothing else in the module
catches it. Two distinct messages, chosen so the log line and the alert name the actual
condition rather than a generic failure:

```ts
// releases[] is empty
throw new Error(
  `No published FlowCharge Core release found at ${PRAXIS_REPO_BASE_URL}. `
  + 'The release list was empty or could not be read.'
);

// releases[0].assetName === null
throw new Error(
  `The latest FlowCharge Core release ${latest.tag} carries no .zip asset, `
  + 'so there is nothing to install.'
);
```

Reasoning for these exact messages and their placement:

- **Thrown in `getInstallContent`, before any download.** That is where the decision is
  made and where the offending values are in hand. No temporary directory is created and
  no file is written on this path, so nothing needs cleaning up.
- **Two messages, not one.** "No release at all" and "a release with no asset" have
  different causes and different fixes — the first points at the host, the token or an
  empty repository, the second at exactly the CI gap assumption 7 accepts. Collapsing them
  would throw away the only diagnostic the user gets.
- **The first message admits its own ambiguity.** `fetchReleases` resolves to `[]` for an
  unreachable host as well as for an empty list, so the message says "empty or could not be
  read" rather than claiming a fact it does not have.
- **The second names the tag.** The tag is the one value that lets the user check the
  release page and re-run CI against it.
- **The base URL is safe to print.** It is the local `PRAXIS_REPO_BASE_URL` constant, never
  renderer or network input.

No new UI mechanism carries these. The throw propagates exactly like every existing install
failure: the IPC handler's `catch` returns `{ ok: false, status: 500, error: err.message }`
(`electron/agentic-tools-ipc-handlers.cts:405-407`), the equivalent `catch` in `src/server.ts`
answers the same way, `unwrapIpc` rethrows in the renderer, and
`installIntegrationsSelected`'s existing `.catch` shows
`"Couldn't install the selected tools. Detail: " + err.message`
(`src/public/home.ts:687-689`). `renderIntegrationsFailure` is the *detection* surface and
is not involved: this error is raised on the install path, not at dialog open.

**Temporary file location and naming.** The zip is written to
`path.join(os.tmpdir(), 'flowcharge-skill-install', 'core-<pid>-<random>.zip')`, where
`<random>` is `crypto.randomUUID()`. Reasoning:

- The OS temporary directory, not a directory beside the install destination. The install
  destination is another tool's real config directory (`~/.claude/skills` and its siblings),
  and dropping a zip there — even briefly — puts a foreign file inside a directory the app
  does not own. The OS temp directory is the conventional place for a file whose whole life
  is one function call, and it is cleaned by the OS if the process dies mid-flight.
- A dedicated subdirectory, so everything this feature writes is under one recognisable
  name and a stale file is obviously ours.
- The pid and a random component, so two concurrent installs — the Electron main process
  and the HTTP server can both run — never collide on one path.
- **No network-derived text in the path.** The release tag would be more readable in a
  filename, but it arrives from the network, and path segments built from network strings
  are exactly the class of input `isExcluded` exists to refuse. A fixed prefix plus locally
  generated identifiers cannot traverse.

**When the zip is deleted: after extraction, not after install.** The delete sits in a
`finally` around steps 3 and 4 inside `getInstallContent`, so the file never outlives the
function that created it. Reasoning:

- The file's only purpose is to be the source of the decode. Once `parseZip` has returned,
  nothing reads it again.
- Deleting after the install would force the temporary path to escape this module and
  travel back through the caller's per-target install loop, giving two modules joint
  ownership of one file's lifetime — the exact shape that produces leaked temp files.
- One install request installs many targets from one decoded `InstallContent`. "After the
  install" has no single moment; "after extraction" has exactly one.
- `finally` also covers the failure paths, so a corrupt zip or a decode error leaves no
  file behind. `remove` is already `force: true` (`agentic-tools-fs-adapter.ts:105-107`), so
  a delete of an already-absent file is not an error and cleanup never masks the real one.

`node:os` (`os.tmpdir()`), `node:path` and `node:crypto` (`randomUUID`) are the only new
Node built-in imports in this module, alongside the two new local modules
(`skill-release-fetch.ts` and `zip-read.ts`). All three built-ins are pure environment,
string algebra and randomness that touch no filesystem, so they do not breach the port-only
rule — the same justification `agentic-tools-install.ts:9-11` already gives for its own
`node:path` import. Every actual read, write, mkdir and delete goes through `deps.fsWrite`.

**One consequence of the new second parameter.** `getInstallContent` gains a required
`deps` argument, so it stops being assignable to `agentic-tools-content.ts:26`'s
`GetInstallContent = (toolId: string) => Promise<InstallContent>` port: a
two-required-parameter function is not assignable to a one-parameter function type. That
port's only consumer is `installAllGlobal` (`src/lib/agentic-tools-install.ts:139-158`),
which is exercised only by `agentic-tools-install.test.ts` with an inline lambda, so no
production call site breaks and no compile error results. `GetInstallContent` and
`installAllGlobal` are therefore left unchanged; only the prose claim in this module's own
header (`skill-content-fetch.ts:7` and `:13`) has to go, in the header rewrite below.

Entry-to-skill mapping has one path and needs no shared normaliser. Zip entry names are
already relative to the skills root, so `segments[0]` is the skill id and the names pass
through verbatim. The tarball's strip-one-top-level-directory and `skills/` prefix rules
(today at lines 240-243) go with the tarball. Every path segment still passes `isExcluded`
before use, which is what keeps a zip-slip entry name out of the write sink.

The module's local `InstallContent` mirror gains the same optional `releaseTag` field the
real interface gains (below), set to the release tag. The existing `version` literal
`'fetched-from-git'` is left exactly as it is: nothing reads it, `hashInstallContent`
(`src/lib/agentic-tools-content.ts:48-55`) does not hash it, and `releaseTag` is the field
that now carries release identity. Renaming a string no code reads would be churn.

### Deleted: the branch-tarball path

The tarball fetch is removed outright rather than left unreachable, because unreachable
code is dead code that still has to be read, tested and kept compiling. From
`src/lib/skill-content-fetch.ts`, this plan deletes:

- `PRAXIS_REPO_REF` (line 39) and `buildArchiveUrl` (lines 50-52) — the ref constant has no
  other reader and the URL builder has no other caller.
- `parseTar` (lines 149-174) and `TarEntry` (lines 135-139) — **verified before deciding**:
  a repo-wide grep for `parseTar`/`TarEntry` finds `getInstallContent` at line 231 and the
  file's own unit test as the only references. Nothing else in this file or any other uses
  them, so both go. Leaving an unused exported parser behind would be exactly the dead
  weight this removal exists to avoid.
- The `gunzipSync` import (line 21) and `MAX_DECOMPRESSED_BYTES` (line 48) — both exist only
  to serve the gunzip call at line 230. `MAX_ARCHIVE_BYTES` **stays**: it caps the release
  asset download.
- The tarball-specific entry normalisation at lines 240-243 — the strip-one-top-level-
  directory and `skills/` prefix rules describe a `git archive` tarball, not the release
  zip, whose entries are already rooted at the skills directory.

`PRAXIS_REPO_BASE_URL` (line 38) **stays and is still needed**: `listSkillReleases` passes
it to `fetchReleases` for the releases API URL, `buildAssetDownloadUrl` derives the asset
URL from it, and the first error message above prints it.

The module header comment (lines 1-19) is rewritten in the same edit. It currently
describes a "tarball-archive route" and states a `PRAXIS_REPO_REF` ref-pinning decision that
no longer has a constant. The rewrite keeps the no-cache decision verbatim and restates the
source as the newest published release. It keeps the mirror-not-import *reasoning* for
`SkillContent`/`InstallContent` but **drops the assignability claim at lines 7 and 13**:
after the `deps` parameter lands, this module's `getInstallContent` is no longer assignable
to `agentic-tools-content.ts`'s `GetInstallContent` port, so that sentence would be false.

`src/lib/skill-content-fetch.test.ts` changes in two ways, both required consequences of
the deletion rather than optional cleanups:

- Tier (a) goes entirely: the `buildHeader`/`padTo512` USTAR fixture builders (lines 19-35)
  and the `parseTar` test (lines 37-61), plus `parseTar` in the import at line 15, since the
  function under test no longer exists.
- Tier (c), the live-network test (lines 98-149), is **re-pointed rather than deleted**. It
  calls `getInstallContent('claude-code')` with one argument at line 112, which becomes a
  compile error once the `deps` parameter lands, and it asserts eight `prx-*` ids
  (lines 100-109) and `prx-orchestrate`'s nested file list (lines 124-148), none of which the
  release zip ships. It is re-pointed at the release path: a real `createNodeFsWriteAccess()`
  passed as `deps.fsWrite` (it satisfies `ArchiveFsAccess` structurally), and the expected
  ids and file list read from the release asset itself rather than written from memory. The
  `assert.equal(content.version, 'fetched-from-git')` assertion at line 114 does **not**
  change, because this plan leaves that literal in place on the release path. Acceptance
  criterion 11's "every remaining test passes" is unreachable without this re-point.

### Changed contracts

`src/lib/agentic-tools-content.ts`:

```ts
export interface InstallContent {
  version: string;
  releaseTag?: string;   // present only for content sourced from a published release
  skills: SkillContent[];
}
```

`hashInstallContent` is not changed and does not read `releaseTag`, so content hashes stay
stable across this feature.

`src/lib/agentic-tools-install-tracking.ts`:

```ts
export interface InstallRecord {
  // ...unchanged fields...
  contentHash: string;
  version?: string;   // release tag as published; absent only for pre-feature install records
}
```

`src/lib/agentic-tools-install.ts` — `installToTarget` writes `content.releaseTag` into
`record.version` when it is present, and omits the key otherwise. The up-to-date early
return at lines 88-90 gains one contract: when the content hash matches but the existing
record's `version` differs from `content.releaseTag`, the record is upserted and the
registry written with the corrected version, while still performing **zero content writes**
and still returning `'up-to-date'`. Without that rule a user who installed the same bytes
before this feature would never get a version recorded, and could never be told an update
exists.

`src/lib/agentic-tools-canonical-skills.ts` — `CANONICAL_PRAXIS_SKILL_IDS` holds the eight
`fc-*` ids the release ships. The expected set is `fc-orchestrate`, `fc-git`, `fc-bug-hunt`,
`fc-issue-list`, `fc-dev-principles`, `fc-plan-feature`, `fc-task-list`,
`fc-plain-text-kanban`. The exact list is verified against the release zip's own top-level
directory names before it is written, never taken from memory.

### Transport surface

One new capability crosses the bridge, wired in all four places this codebase already
requires, plus the browser-side type mirror:

- `electron/agentic-tools-ipc-handlers.cts` — new `listSkillReleases` channel returning
  `PraxisIpcResult<SkillReleaseSummary[]>`, taking no argument. `SkillReleaseSummary` is
  hand-mirrored locally, per that file's own rootDir rule against importing from `src/lib`.
- `electron/preload.cts` — `listSkillReleases: () => ipcRenderer.invoke('listSkillReleases')`.
- `src/server.ts` — `GET /api/integrations/releases`, behind the existing loopback gate,
  answering the bare array with an HTTP status like every sibling route.
- `src/public/browser-ipc-shim.ts` — `listSkillReleases` over that route.
- `src/public/lib/agentic-tools-api.ts` — mirrors `SkillReleaseSummary`, adds
  `version?: string` to its `InstallRecord` mirror, and adds the method to
  `PraxisSkillInstallAPI`.

No URL crosses the bridge in either direction.

Both install call sites — the IPC handler's loop at
`electron/agentic-tools-ipc-handlers.cts:388-403` and the equivalent loop in `src/server.ts`
— resolve `getInstallContent` **once per install request** and pass that one
`InstallContent` to every target in the batch. This is required for correctness, not
tidiness: a per-target fetch could straddle a release publication and record two different
versions for one batch. It also removes the per-target re-download the workstream record
notes, and it means one install request produces exactly one temporary zip file, whatever
the batch size.

Both call sites also pass the `fsWrite` they already hold into `getInstallContent`'s new
`deps` argument — `fsWrite` in `electron/agentic-tools-ipc-handlers.cts:355`, and
`installFsWrite` in `src/server.ts:92`. Neither site constructs a second adapter. The
electron file's local `GetInstallContentFn` mirror
(`electron/agentic-tools-ipc-handlers.cts:184`) gains the same second parameter, per that
file's hand-mirroring rule.

### Renderer

`src/public/home.ts` owns all new UI. It gains three things:

- A release header line, populated at dialog open from `listSkillReleases()`, showing the
  first entry's tag and name. Its empty state is a short "No published release found" note,
  and the dialog stays fully usable.
- A version join. `getInstallStatus()` is called at dialog open — a call this file
  deliberately dropped earlier (`src/public/home.ts:433-435` explains that removal, which
  concerned the "Already installed" chip, not versions). Records are matched on both
  `toolId` and the current scope, so unlike the presence map this join is correct at both
  Global and Project scope and needs no extra call on a scope toggle.
- Per-row version chip, "Update available" chip, and an "Update" button. Label constants sit
  beside the existing `INSTALL_STATUS_LABEL`, `ALREADY_INSTALLED_LABEL` and
  `INCOMPLETE_INSTALL_LABEL` block: `VERSION_LABEL_PREFIX = 'v'`,
  `UNKNOWN_VERSION_LABEL = 'Version unknown'`, `UPDATE_AVAILABLE_LABEL = 'Update available'`.
  The "Update" button calls the existing `installSelected` with exactly that one target and
  renders the result onto the same `installChip` path a normal install uses, so
  `hasLiveResult` keeps its current meaning.

`IntegrationsRowEntry` gains the element references for the new chip and button.
`resetIntegrationsModalState` clears the release summary, the records map and the new chips,
matching the existing close-resets-everything rule.

`src/public/index.html` gains one element for the release header inside the dialog header
block. `src/public/styles.css` gains only what the new button needs; both chips reuse the
existing `.chip` class.

### What each module knows, and must not know

- `zip-read.ts` knows zip bytes. It must not know skills, paths on the host, or HTTP.
- `skill-release-fetch.ts` knows the release API's JSON and how to build two URLs from a
  supplied base. It must not know the host constant, skills, install targets, or the
  registry.
- `skill-content-fetch.ts` knows the host constant, the one content source, SKILL.md
  grammar, and the temporary zip's whole lifetime — where it is written, when it is read,
  when it is deleted. It must not know install targets, formats, or tracking, exactly as its
  header states today, and it must not call `node:fs` itself.
- `agentic-tools-fs-adapter.ts` knows how to move bytes and strings to and from real paths.
  It must not know that a zip, a release, or a skill exists. Its header already states this
  rule; the binary pair is added under it.
- `agentic-tools-install.ts` knows how to turn content plus a target into writes and a
  record. It must not know where content came from or what a release is, beyond copying an
  opaque `releaseTag` string.
- `home.ts` knows labels and joins. It must not know URLs, hosts, or the release API's
  shape.

### Non-functional notes

The new route sits behind the same loopback gate as every `/api/integrations/*` route, so
it adds no new exposure. Response and archive sizes are capped on every new path: the
release JSON body, the asset download, the zip entry count, and the total uncompressed
bytes. The download cap is applied while streaming, **before** any bytes reach the disk, so
a hostile response cannot fill the temporary directory. Path safety is unchanged and doubly
enforced — `isExcluded` per segment on the way in and `installToTarget`'s containment check
on the way out. The temporary zip's own path is built entirely from local values
(`os.tmpdir()`, a fixed prefix, the pid, a UUID), so no network string ever reaches a path
join. The extracted entries are written only to the install target, never beside the zip,
so the temporary directory holds one file and never a tree. Observability needs one
addition: when the release path yields nothing and the install therefore fails, the server
and main process log a single line carrying the thrown message, matching the existing
`console.error` style in `src/server.ts`. The alert tells the user; the log gives whoever
looks at CI the same sentence.

## Stages

1. **Download to disk, unzip, install, delete.** The riskiest work — a hand-rolled zip
   reader, the binary port pair, and a new fetch path — comes first, because everything
   else is unreachable if the release asset cannot be downloaded and decoded. It covers, in
   this order: the `readBinaryFile`/`writeBinaryFileAtomic` methods on `FsWriteAccess` and
   their adapter implementations; `zip-read.ts`; `skill-release-fetch.ts`; and the
   release-only path in `getInstallContent` with its temporary-file lifecycle; and the
   deletion of the branch-tarball code listed above, in the same stage, so no dead path is
   ever committed. Ends when "Install selected" writes the release's `fc-*` skills to a
   disposable target, the temporary zip is gone afterwards, and a host with no published
   release produces the stated error in the alert instead of any install.
2. **Record the installed release version.** Adds `releaseTag`/`version` and the
   backfill-on-up-to-date rule. It follows stage 1 because there is no tag to record until
   installs come from releases. Ends when `.praxis-installs.json` shows the tag after an
   install, and shows it after a second no-op install too.
3. **Show the latest release and the installed version.** Adds the releases channel across
   all four transports, the dialog header, the `getInstallStatus` join, the version chip,
   and the corrected canonical skill ids. Ends when the dialog shows the latest tag, each
   installed row shows its version, and an already-installed row shows "Already installed".
4. **Update detection and one-click update.** Adds the semver comparison (a file-local
   helper in `home.ts` with `isNewer`'s semantics, per Summary), the "Update
   available" chip and the per-row "Update" button. It is last because it consumes
   everything the three previous stages produce. Ends when a row holding an older version
   offers an update that installs the latest and clears the chip.

## Data & compatibility

The only persisted shape that changes is `InstallRecord` in `.praxis-installs.json`, and it
changes additively with one optional key. `parseInstallRegistry`
(`src/lib/agentic-tools-install-tracking.ts:33-40`) casts through with no per-record shape
validation, so existing records load unchanged and simply carry no version. No migration
runs and no backfill script exists: the record gains its version the next time that target
is installed or found up to date, by the rule in Design.

Older code reading a newer registry ignores the unknown key, so a downgrade loses the
version display but corrupts nothing.

The install-content contract stays compatible in both directions: `releaseTag` is optional,
and `hashInstallContent` ignores it, so no existing install is invalidated and no user sees
a spurious re-write after upgrading.

Nothing else persists. The temporary zip is not state: it is created and deleted inside one
function call, and no code path reads it on a later run. The two new `FsWriteAccess`
methods are additive, so every existing implementation of that port — including the fake in
`agentic-tools-install.test.ts:27` — needs the two stubs added but no behaviour changed.

Rollback: reverting stages 4 and 3 removes the whole user-visible surface and leaves a
harmless extra key in the registry. Stage 1 has no in-code pull-cord, by decision: the
branch tarball is deleted, not retained as a switchable second source. Rolling back the
content source means reverting the stage 1 commit, which restores the tarball path from git
history. This is the accepted cost of removing the dead path. It is acceptable because the
app is a single-user local build with no distributed installs to strand, and because the
failure the fallback guarded against is a CI failure that CI fixes.

## Testing strategy

Tests follow this repo's `node:test` + `node:assert/strict` convention, run against built
output (`node --test dist/lib/<name>.test.js`), as the existing `*.test.ts` files do.

- Stage 1, unit: `zip-read.test.ts` — a deflated entry, a stored entry, an unsupported
  method, a directory entry, a truncated buffer, and both ceilings. Fixtures are built
  in-test with `zlib.deflateRawSync`, so no binary fixture file is committed.
- Stage 1, unit: `skill-release-fetch.test.ts` — `parseReleases` sorting newest-first,
  draft and prerelease exclusion, missing-asset handling, unreadable JSON yielding `[]`, and
  both URL builders producing base-URL-derived URLs.
- Stage 1, unit: extend `agentic-tools-fs-adapter.test.ts` — a binary write-then-read
  round trip against a real `fs.mkdtemp` directory, asserting the bytes come back
  identical, and `readBinaryFile` returning `null` for a missing path. That file already
  tests against a real temporary directory, so this needs no new harness.
- Stage 1, integration: extend `skill-content-fetch`'s coverage with a stubbed `fetch` and
  a fake `ArchiveFsAccess` that records every call, covering the release path and the
  skills-rooted entry mapping. Three lifecycle assertions matter most: the buffer handed to
  `writeBinaryFileAtomic` equals the downloaded bytes, `parseZip` receives what
  `readBinaryFile` returned rather than the response buffer, and `remove` is called with the
  same path on both the success and the decode-failure runs.
- Stage 1, integration: two failure cases for the release-only rule, each asserting on the
  rejection rather than on a return value. **Empty list** — the stubbed releases response
  yields `[]`, and `getInstallContent` rejects with a message naming the base URL. **No zip
  asset** — the stubbed response carries one published release whose assets are empty or
  carry no `.zip`, and `getInstallContent` rejects with a message naming that tag. What
  these prove is the whole point of the removal, so each also asserts the negative: the fake
  `ArchiveFsAccess` recorded **zero** calls — no `mkdir`, no `writeBinaryFileAtomic`, no
  `remove` — and the stubbed `fetch` was called once, for the releases API only. A silent
  fallback, a stray temporary directory, or a second outbound request would each fail these
  tests. A test that only asserted "it throws" would pass against a fallback that threw for
  some other reason.
- Stage 1, deletion check: `skill-content-fetch.test.ts` loses its `parseTar` tests and
  USTAR fixture builder with the function they cover, and its live-network tier is
  re-pointed at the release path in the same edit, per Design > 'Deleted: the branch-tarball
  path'. A grep for `parseTar`, `TarEntry`, `buildArchiveUrl`, `PRAXIS_REPO_REF` and
  `gunzipSync` over `src` and `electron` returns nothing, and the build passes. That grep is
  acceptance criterion 11's evidence.
- Stage 2, unit: extend `agentic-tools-install.test.ts` — version written on install,
  version omitted when `releaseTag` is absent, and the up-to-date backfill writing the
  registry while performing zero content writes.
- Stage 3, unit: extend `agentic-tools-skill-presence.test.ts` only where the corrected id
  list changes an expectation. Route and channel parity is verified by hand against both
  transports, since neither has automated coverage today.
- Stage 1, manual: run one real install against a disposable target, then list
  `os.tmpdir()/flowcharge-skill-install` and confirm it is empty. Repeat against a
  deliberately corrupted asset and confirm it is empty again.
- Stages 3 and 4, manual: the renderer has no test framework in this repo, so the dialog
  header, the chips, the scope toggle and the "Update" button are verified by hand against a
  disposable install target, never a real tool config directory.

## Open questions

1. **Latest-only, or a release picker?** The plan installs only the newest release and shows
   its tag; older releases are not listed or installable. The alternative is a release
   `<select>` in the dialog. Recommendation: stay latest-only. Nothing in the request asks
   for installing an older release, and a picker adds a control, a state and an install path
   for a capability with no stated use.
2. **Deployment and release constraints.** This plan assumes a single-user local app with no
   production data, no live users, no migration and no need for a feature flag, so it ships
   whole. If packaged Electron builds are already distributed to other machines, or a build
   must stay shippable between stages, say so: the answer changes only whether the stage 3
   and 4 UI hides behind a flag, not the design.
3. **Non-semver release tags.** Update detection rests on `parseSemver` reading
   `vMAJOR.MINOR.PATCH`. A tag it cannot read shows "Version unknown" and prompts no update.
   Recommendation: keep this and keep tagging releases as semver, rather than adding a
   second comparison rule for arbitrary tag formats.

## Adjacent opportunities

Not requested. Listed as offers only; none is written into a stage, criterion or contract.

1. Show the release's changelog body in the dialog beside its tag. Skip — the request asks
   for version and update detection, not release notes.
2. Extract the `readCappedBody` helper duplicated between `src/lib/update-check.ts:83-117`
   and `src/lib/skill-content-fetch.ts:183-217` into one shared module. Skip — it is a
   cleanup with no bearing on this feature.
3. Run the skill-presence check at Project scope so its chip stops hiding there. Skip — it
   is a pre-existing, deliberate limitation with its own divergence note.

## Alternatives considered and rejected

1. **Decode the zip entirely in memory, never writing it to disk** — an earlier revision of
   this plan chose this, reasoning from the tar.gz path's in-memory pattern and from a wish
   to avoid touching the `FsWriteAccess` port. Rejected, and the rejection is deliberate:
   the request states a download-unzip-install-delete flow in plain terms, and an internal
   preference for an existing in-memory pattern is not a reason to deliver something else.
   The cost that revision cited was also overstated. Adding a binary method pair beside the
   text pair is a few lines in one port and one adapter, the temp-file lifetime is one
   `finally` block inside one function, and `remove` already exists on the port. No new
   dependency is involved either way.
2. **Add a zip library as a runtime dependency.** Rejected: `package.json` has zero runtime
   dependencies today, the packaged Electron build depends on that, and the needed subset of
   the format is small and already precedented by the `parseTar` this plan replaces. This
   applies equally to the
   disk-based design chosen above — reading a zip file from disk needs `node:fs` and
   `zlib.inflateRawSync`, both in the standard library, and nothing more. Any claim that
   downloading and unzipping a real file forces a first runtime dependency is wrong.
3. **Keep the temporary zip until after the whole batch installs.** Rejected: it splits one
   file's lifetime across two modules and a per-target loop, and "after the install" has no
   single moment when one decoded content serves many targets. Deleting after extraction
   keeps creation and deletion in the same function.
4. **Write the temporary zip beside the install destination instead of the OS temp
   directory.** Rejected: the destination is another tool's real config directory, and the
   app should not put a foreign file there, even briefly. It also risks a half-written zip
   surviving a crash inside a directory the user's other tools scan.
5. **Keep the branch tarball as a fallback for when no release carries a zip asset** — an
   earlier revision of this plan chose this, and this revision reverses it after reading the
   project's real Gitea Actions pipeline. Rejected: the pipeline has no path that
   deliberately publishes an asset-less release. `release.mjs` is a maintainer-only manual
   command that only tags and commits, and the CI `release` job always builds the zip with
   `build-release-zip.mjs` and always attaches it with `curl -f` under `set -eu`. The
   fallback therefore guarded a state the release process cannot deliberately reach, at the
   price of a second content source, a second archive format, a second install-record shape
   (version present or absent) and a permanently untested branch. The one real gap — the
   non-atomic create-row-then-attach-asset pair — is a CI failure mode with a CI fix, and
   the honest answer to it is a clear error and a retry, not a silent install of different
   content from a different source. Silently installing branch-tip content while the user
   believes they installed a release is worse than failing.
6. **Keep the tarball code but make it unreachable, in case it is wanted later.** Rejected:
   unreachable code still has to compile, still has to be read by the next person, and still
   claims test coverage it no longer earns. Git history is the archive. This is why the
   deletion lands inside stage 1 rather than in a follow-up.
7. **Scan older releases for one carrying a zip when the newest has none.** Rejected: it is
   the same fallback wearing a different coat. It would install content the user did not ask
   for and record a version older than the tag the dialog is showing, which is precisely the
   confusion the version display exists to prevent.
8. **Derive the canonical skill ids from the downloaded release instead of a constant.**
   Rejected: the presence check runs at dialog open, so this would force a zip download
   every time the dialog opens, to replace a list that changes once per release.
9. **Compare versions by tag inequality instead of semver ordering.** Rejected: the request
   asks specifically whether the installed version is *older*, and `isNewer` already exists
   in this repo as a pure, tested function whose semantics the renderer's file-local helper
   copies (it cannot import it — see Summary).

## Final summary

- Approach: download the newest release's zip asset to a real temporary file, unzip that
  file with a new hand-rolled zip reader, install the skills, delete the zip, and record the
  release tag on the install record. No new runtime dependency at any step. The newest
  published release is the only content source: the branch-tarball fetch and its tar reader
  are deleted, and no release or no zip asset fails the install with a named error.
- Four stages, riskiest first; roughly one focused sitting each, with stage 3 the largest
  because it crosses all four transports.
- Top risks: the hand-rolled zip reader against a real Gitea asset; the up-to-date branch
  silently skipping the version backfill; the four-place transport wiring drifting out of
  sync between Electron and the HTTP server; a temporary zip left behind on an error path
  that misses the `finally`; and, with no fallback left, a CI run that publishes a release
  row without its asset blocking installs until CI is fixed.
- Decisions taken rather than deferred: the literal download-unzip-install-delete flow over
  an in-memory decode; the OS temporary directory with a locally generated filename; delete
  after extraction rather than after install; the branch-tarball path and `parseTar` deleted
  outright rather than kept as a fallback or left unreachable; the newest release only, with
  no scan down the list; the two named error messages thrown from `getInstallContent` and
  surfaced through the existing install alert; and the `fc-*` canonical skill id correction
  pulled into scope.
- Needs your answer: latest-only versus a release picker, and whether any packaged-build or
  live-user constraint should force the new UI behind a flag.
