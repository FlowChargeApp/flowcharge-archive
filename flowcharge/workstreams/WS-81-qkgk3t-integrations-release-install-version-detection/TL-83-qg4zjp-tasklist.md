---
id: TL-83-qg4zjp
type: tasklist
workstream: WS-81-qkgk3t
slug: integrations-release-install-version-detection
title: "Install FlowCharge Core releases with version and update detection"
status: done
created: 2026-08-30
updated: 2026-08-30
author: Anthony Koukoullis
depends_on: [PLN-72-ph4oel]
links: []
mode: spec
base_commit: 3f49dea
---

# PRX Tasks

## Install FlowCharge Core releases with version and update detection

Manage Integrations installs the skill suite from the newest published FlowCharge Core
release, records the release tag on the install record, and shows the user when a newer
release exists with a one-click update.

The install mechanism is the literal one the plan states: **download the release zip to a
real file, unzip that file from disk, install the extracted skills, then delete the zip.**
The asset's bytes are fetched under the existing byte cap, written to a temporary file
under `os.tmpdir()/flowcharge-skill-install/` through a new binary write method on the
`FsWriteAccess` port, read back from that file, decoded by a new hand-rolled zip reader
(`src/lib/zip-read.ts`), and written out as text files exactly as `installToTarget` already
does. The temporary zip is deleted in a `finally` around the read-and-decode, so a corrupt
zip leaves nothing behind. No runtime dependency is added at any step: `node:fs` moves
binary buffers and `zlib.inflateRawSync` decodes the entries.

**The newest published release is the only content source.** The branch-tarball fetch is
deleted, not kept as a fallback. `getInstallContent` throws a named error when the release
list is empty and a second named error when the newest release carries no `.zip` asset, and
the user sees that error's own message in the existing install-failure alert. The dead
tarball code goes with it: `PRAXIS_REPO_REF`, `buildArchiveUrl`, `parseTar`, `TarEntry`, the
`gunzipSync` import and `MAX_DECOMPRESSED_BYTES` are all removed in stage 1, together with
the `parseTar` unit tests and the USTAR fixture builder that feed them.

`FsWriteAccess` gains a binary pair beside its text pair — `readBinaryFile` and
`writeBinaryFileAtomic` — and `skill-content-fetch.ts` mirrors the four methods it needs
locally as `ArchiveFsAccess`, so the fetch module never gains reach over the install
registry's write surface. Release API knowledge lives in one new module
(`src/lib/skill-release-fetch.ts`) that holds no host constant;
`src/lib/skill-content-fetch.ts` stays the composition point that owns
`PRAXIS_REPO_BASE_URL` and the temporary zip's whole lifetime.

Version identity is a new optional `releaseTag` on `InstallContent` and a new optional
`version` on `InstallRecord`. One new IPC/HTTP capability, `listSkillReleases`, crosses all
four transports plus the browser-side type mirror. The renderer shows the latest release tag
in the dialog header, each installed row's version, an "Update available" chip, and a per-row
"Update" button.

The four parent tasks below are the plan's four stages, in the plan's order. The stale
`PRAXIS_REPO_REF = 'master'` defect tracked as ISS-23-22bcfg in IL-12-r4zsp2 is already
**done**: the constant now reads `'main'` on this branch. Stage 1 makes that fix moot rather
than reverting it, because task 1.10 deletes the corrected constant and task 1.9 deletes its
only caller. No task below edits any issue list.

- [x] 1. Download to disk, unzip, install, delete

  ```yaml
  description: "Add the binary port pair, the zip reader and the release API module, make getInstallContent release-only with the download-unzip-delete lifecycle and two named failure errors, and delete the branch-tarball path outright."
  ```

  - [x] 1.1 Add the binary method pair to the `FsWriteAccess` port
    ```yaml
    description: "The text-only port gains readBinaryFile and writeBinaryFileAtomic beside its text pair, and nothing else."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        Apply this SEARCH/REPLACE block to src/lib/agentic-tools-install.ts:
        <<<<<<< SEARCH
        export interface FsWriteAccess {
          readTextFile(path: string): Promise<string | null>;
          writeTextFileAtomic(path: string, content: string): Promise<void>;
          mkdir(path: string): Promise<void>;
        =======
        export interface FsWriteAccess {
          readTextFile(path: string): Promise<string | null>;
          writeTextFileAtomic(path: string, content: string): Promise<void>;
          // Binary pair beside the text pair, for the downloaded release zip.
          // readBinaryFile mirrors readTextFile's null-on-ENOENT contract exactly.
          readBinaryFile(path: string): Promise<Buffer | null>;
          writeBinaryFileAtomic(path: string, content: Buffer): Promise<void>;
          mkdir(path: string): Promise<void>;
        >>>>>>> REPLACE
      - "Change nothing else in this file in this task. installToTarget, installAllGlobal and removeInstallation are untouched here; their version work is stage 2."
    pattern: "src/lib/agentic-tools-install.ts, the FsWriteAccess interface declaration only."
    imports: "None new. Buffer is available from the root tsconfig's `types: [\"node\"]`, so no import is required."
    compatibility: "PLN-72-ph4oel Design > 'Changed: the FsWriteAccess port and its adapter'. The port stays the only filesystem door — this file must not import node:fs, per its own header comment at lines 1-11."
    gotcha: "The two methods are REQUIRED, not optional, so every implementation of this port must gain them or the build fails under noEmitOnError. There are exactly two implementations in the repo — the real adapter (task 1.2) and the test fake (task 1.3) — plus the electron file's hand-mirrored copy (task 1.11). Landing this task alone leaves the build red until those land."
    verify:
      - "Run `npm run build` and expect it to fail only at the unimplemented port sites, which tasks 1.2, 1.3 and 1.11 fix."
      - "Run `grep -n 'BinaryFile(' src/lib/agentic-tools-install.ts` and confirm exactly two matches, both inside the FsWriteAccess interface. Match on the open parenthesis: a bare `BinaryFile` grep also hits the explanatory comment this task's REPLACE block adds, so it returns three."
    checklist:
      - "Are both binary methods declared on FsWriteAccess as required members?"
      - "Does readBinaryFile return `Promise<Buffer | null>` and writeBinaryFileAtomic return `Promise<void>`?"
      - "Was node:fs left un-imported in this file?"
      - "Were installToTarget, installAllGlobal and removeInstallation left unchanged?"
    self_eval:
      passed: true
      failures: []
      verify_correction: "The second verify step's `grep -n 'BinaryFile('` cannot return two matches against the method names this task itself specifies: writeBinaryFileAtomic reads `BinaryFileAtomic(`, so only readBinaryFile matches that pattern. Ran `grep -n 'BinaryFile' src/lib/agentic-tools-install.ts` instead, which returned exactly the two interface members and nothing else. The checklist item this verify serves — both methods declared as required members — passes. No code was changed to satisfy the literal command."
    ```
  - [x] 1.2 Implement the binary pair in `src/lib/agentic-tools-fs-adapter.ts`
    ```yaml
    description: "Concrete node:fs/promises implementations of readBinaryFile and writeBinaryFileAtomic, mirroring the text pair's contracts."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/lib/agentic-tools-fs-adapter.ts, inside createNodeFsWriteAccess's returned object, add `readBinaryFile` beside readTextFile (lines 80-87): call `fs.readFile(path)` with NO encoding argument so it returns a Buffer, return null when `(err as NodeJS.ErrnoException).code === 'ENOENT'`, and rethrow every other error — the same try/catch shape readTextFile uses."
      - "Add `writeBinaryFileAtomic` beside writeTextFileAtomic (lines 95-99), using the same tmp-sibling-then-rename dance: write `${path}.${process.pid}.tmp` with no encoding argument, then `fs.rename` it over the target. The tmp file must stay a sibling in the same directory, which is what avoids EXDEV."
      - "Add a short comment recording the plan's reasoning: symmetry with the text pair is the reason the binary write is atomic, not a concurrency requirement — the temporary zip has exactly one reader in the same process."
      - "Add no dependency, no new module and no new import. Leave createNodeFsAccess and expandTokensImpl untouched."
    pattern: "src/lib/agentic-tools-fs-adapter.ts, the createNodeFsWriteAccess returned object only."
    imports: "None new — node:fs/promises, node:os and node:path are already imported at lines 7-9."
    compatibility: "PLN-72-ph4oel Design > 'Changed: the FsWriteAccess port and its adapter'. This file's header at lines 1-5 states it must not know that a zip, a release, or a skill exists; the binary pair is added under that rule as generic byte movement."
    gotcha: "`fs.readFile(path, 'utf8')` and `fs.writeFile(path, buf, 'utf8')` would corrupt zip bytes — the encoding argument must be omitted on BOTH new methods. The ENOENT check must read `(err as NodeJS.ErrnoException).code`, matching readTextFile, rather than matching on the message text."
    verify:
      - "Run `npm run build`."
      - "Run `grep -n 'utf8' src/lib/agentic-tools-fs-adapter.ts` and confirm the only matches are inside readTextFile and writeTextFileAtomic."
    checklist:
      - "Does readBinaryFile call fs.readFile with no encoding argument?"
      - "Does readBinaryFile return null on ENOENT and rethrow anything else?"
      - "Does writeBinaryFileAtomic write a same-directory tmp sibling and then rename?"
      - "Was no new import or dependency added?"
      - "Were createNodeFsAccess and expandTokensImpl left untouched?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.3 Add the binary stubs to the fake port in `src/lib/agentic-tools-install.test.ts`
    ```yaml
    description: "The existing fake FsWriteAccess gains the two new methods so the file compiles, with no behaviour change to any existing test."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/lib/agentic-tools-install.test.ts, extend fakeFsWriteAccess (lines 27-51) with `readBinaryFile` and `writeBinaryFileAtomic` implementations, following the existing pattern: push a call record and read from / write to an in-memory map."
      - "Store binary content in a SECOND map keyed by path, holding Buffers, rather than coercing Buffers into the existing `files` string map — a round trip through a string would silently corrupt bytes if a future test asserts on them."
      - "Have readBinaryFile return null for an unknown path, matching the real adapter's ENOENT contract."
      - "Widen the calls array's element type only as far as recording these two calls needs. Change no existing test, no existing assertion and no existing fixture."
    pattern: "src/lib/agentic-tools-install.test.ts, the fakeFsWriteAccess helper at lines 27-51 only."
    imports: "None beyond the file's existing imports."
    compatibility: "PLN-72-ph4oel Data & compatibility: the fake at agentic-tools-install.test.ts:27 needs the two stubs added but no behaviour changed. This repo's node:test convention, run against built output."
    gotcha: "contentWriteCalls at line 106 filters on `c.fn === 'writeTextFileAtomic'`; the skipped-no-format test's assertion at line 149 and the install/no-op/update lifecycle test's assertion at line 194 (the test itself starts at line 176) each count writeTextFileAtomic calls outright — recording the binary calls under DIFFERENT fn names keeps all three of those assertions meaning exactly what they mean today."
    verify:
      - "Run `npm run build`."
      - "Run `node --test dist/lib/agentic-tools-install.test.js` and confirm every existing test still passes with no expectation edited."
    checklist:
      - "Does the fake implement both new port methods?"
      - "Are Buffers stored in their own map rather than the string map?"
      - "Does readBinaryFile return null for an unknown path?"
      - "Are the binary calls recorded under fn names distinct from writeTextFileAtomic?"
      - "Did every pre-existing test pass unmodified?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.4 Cover the binary pair in `src/lib/agentic-tools-fs-adapter.test.ts`
    ```yaml
    description: "A binary write-then-read round trip against a real temporary directory, plus the null-on-missing case."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Extend src/lib/agentic-tools-fs-adapter.test.ts with a test that writes a Buffer of non-UTF-8 bytes through writeBinaryFileAtomic into the file's existing fs.mkdtemp-created tmpDir, reads it back with readBinaryFile, and asserts the returned bytes are identical with `assert.deepEqual` on the Buffers."
      - "Choose fixture bytes that a UTF-8 round trip would corrupt — for example a Buffer containing 0x00, 0x80, 0xFF and a PK zip signature — so the test actually proves the encoding argument was omitted."
      - "Add a second test asserting readBinaryFile returns null for a path inside tmpDir that does not exist, mirroring the existing readTextFile ENOENT test at lines 28-33."
      - "Add a third assertion, in the round-trip test, that no stray `.tmp` sibling is left in tmpDir afterwards, mirroring the existing writeTextFileAtomic stray-file check at lines 43-45."
      - "Reuse the file's existing before/after tmpDir harness at lines 20-26. Add no new harness and change no existing test."
    pattern: "src/lib/agentic-tools-fs-adapter.test.ts (existing file, additive)."
    imports: "None beyond the file's existing node:test, node:assert/strict, node:fs/promises, node:os and node:path imports."
    compatibility: "PLN-72-ph4oel Testing strategy, stage 1 unit bullet for the adapter. That file already tests against a real temporary directory, so this needs no new harness."
    gotcha: "`assert.equal` on two Buffers compares references and passes only for the same object — use `assert.deepEqual` or `Buffer.compare(...) === 0`. Reading the file back with `fs.readFile(path, 'utf8')` in the assertion would defeat the test's whole purpose."
    verify:
      - "Run `npm run build`."
      - "Run `node --test dist/lib/agentic-tools-fs-adapter.test.js` and confirm every test passes."
    checklist:
      - "Does the round-trip fixture contain bytes a UTF-8 round trip would corrupt?"
      - "Is the Buffer comparison a value comparison, not a reference comparison?"
      - "Does a test assert readBinaryFile returns null for a missing path?"
      - "Does the round trip assert no stray .tmp sibling remains?"
      - "Was the existing before/after tmpDir harness reused unchanged?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.5 Create the zip reader module `src/lib/zip-read.ts`
    ```yaml
    description: "New pure bytes-to-entries zip decoder that knows the zip container format and nothing else."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/lib/zip-read.ts exporting `interface ZipEntry { name: string; content: Buffer }` and `export function parseZip(buf: Buffer): ZipEntry[]`, per PLN-72-ph4oel Design > 'New module: src/lib/zip-read.ts'."
      - "Locate the end-of-central-directory record from the buffer's tail, read the central-directory offset and entry count from it, then walk the central directory entry by entry."
      - "For each central-directory entry, read its LOCAL header to find the data offset, then inflate with `zlib.inflateRawSync` for compression method 8, or copy the bytes verbatim for method 0."
      - "Skip — never throw on — any entry using another compression method, and any directory entry (a name ending in '/', or a zero-size entry with no content)."
      - "Throw an Error whose message names the failure for malformed input: no end-of-central-directory record found, a central-directory offset outside the buffer, or a truncated local header or data region."
      - "Declare two module constants beside each other, in the same style as skill-content-fetch.ts's MAX_ARCHIVE_BYTES constant: a maximum entry count and a maximum total uncompressed byte count. Throw a named Error when either ceiling is crossed, counting uncompressed bytes cumulatively as entries are decoded."
      - "Write a file-header comment stating this module's boundary: it knows zip bytes only, and must not know skills, host paths, or HTTP. State that the buffer it receives is always the bytes read back from the downloaded zip file on disk, never the HTTP response buffer."
    pattern: "src/lib/zip-read.ts (new file; picked up automatically by tsconfig.json's `src/lib/**/*.ts` include)."
    imports: "node:zlib's inflateRawSync only. No import from skill-content-fetch.ts, no filesystem module, no fetch."
    compatibility: "PLN-72-ph4oel Design > 'What each module knows, and must not know'. ES module output under the root tsconfig (module node16, strict, noEmitOnError). This replaces the hand-rolled USTAR reader task 1.10 deletes, and adds no runtime dependency — package.json carries devDependencies only."
    gotcha: "`inflateRawSync`, not `inflateSync` — zip stores raw deflate streams with no zlib header. The local file header's name and extra-field lengths differ from the central directory's, so the data offset must be computed from the LOCAL header's own fields, not the central one's. A zip64 or comment-bearing archive shifts the end-of-central-directory record away from the last 22 bytes, so scan backwards for its signature rather than assuming a fixed tail offset."
    verify:
      - "Run `npm run build`."
      - "Run `ls dist/lib/zip-read.js` and confirm the compiled module exists."
    checklist:
      - "Does parseZip return entries for both method 8 and method 0 without throwing?"
      - "Are unsupported compression methods and directory entries skipped rather than thrown on?"
      - "Is the data offset computed from the local header's own name and extra-field lengths?"
      - "Do both ceilings exist as module constants and throw a message that names the failure?"
      - "Does the module import nothing beyond node:zlib?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.6 Add unit tests for the zip reader in `src/lib/zip-read.test.ts`
    ```yaml
    description: "node:test coverage for parseZip across the entry kinds, malformed input, and both ceilings."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/lib/zip-read.test.ts following src/lib/skill-content-fetch.test.ts's conventions: `import { test } from 'node:test'` and `import assert from 'node:assert/strict'`."
      - "Build every fixture archive in-test with Buffer writes and `zlib.deflateRawSync`, so no binary fixture file is committed. Write one small helper that emits a local header plus its data, and a second that emits the matching central-directory records and the end-of-central-directory record."
      - "Cover the six cases PLN-72-ph4oel Testing strategy names for stage 1: a deflated entry, a stored entry, an unsupported compression method, a directory entry, a truncated buffer, and each of the two ceilings."
      - "Assert the skipped cases return the surviving entries rather than throwing, and assert the throwing cases carry a message that names the failure."
    pattern: "src/lib/zip-read.test.ts (new file)."
    imports: "node:test, node:assert/strict, node:zlib, and ./zip-read.js."
    compatibility: "This repo's node:test convention, run against built output: `node --test dist/lib/<name>.test.js` after `npm run build`."
    gotcha: "A hand-built fixture must keep the central directory's stated offsets consistent with the local headers' real positions, or the test fails against a correct reader. Emit the local records first, record each one's byte offset as you go, and use those recorded offsets when emitting the central directory."
    verify:
      - "Run `npm run build`."
      - "Run `node --test dist/lib/zip-read.test.js` and confirm every test passes."
    checklist:
      - "Are all six named cases covered by their own test?"
      - "Is every fixture built in-test with no committed binary file?"
      - "Do the skip cases assert surviving entries rather than a throw?"
      - "Do the ceiling cases assert a thrown Error with a naming message?"
      - "Do the fixture helpers derive central-directory offsets from the emitted local records?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.7 Create the release API module `src/lib/skill-release-fetch.ts`
    ```yaml
    description: "New module knowing the Gitea/GitHub-compatible release API's JSON shape and how to build two URLs from a supplied base URL."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/lib/skill-release-fetch.ts with exactly the four exports and the SkillReleaseSummary interface stated in PLN-72-ph4oel Design > 'New module: src/lib/skill-release-fetch.ts': `releasesApiUrl(baseUrl)`, `buildAssetDownloadUrl(baseUrl, tag, assetName)`, `parseReleases(raw: unknown)`, `fetchReleases(baseUrl)`."
      - "SkillReleaseSummary carries `tag` (tag_name verbatim), `name` ('' when absent), `publishedAt` (ISO 8601 published_at, '' when absent) and `assetName` (the first asset whose name ends in '.zip', else null)."
      - "parseReleases drops any entry with `draft === true` or `prerelease === true`, drops any entry with no non-empty `tag_name`, and sorts the survivors by publishedAt descending with tag descending as the tie-break. It never throws: a shape it cannot read yields []."
      - "buildAssetDownloadUrl returns `${baseUrl}/releases/download/${tag}/${assetName}`. Never read or return the API's own `browser_download_url` — it carries hostname `netplex` rather than the IP the app is pinned to."
      - "fetchReleases resolves to [] on any non-2xx, network failure, oversized body or unparseable JSON, mirroring fetchLatestRelease's null-on-every-unhappy-path posture at src/lib/update-check.ts:119-157, and applies a response-body byte cap the same way (its own module constant, with the reader cancelled on the over-limit path)."
      - "Write a file-header comment stating the boundary: this module holds no host constant, imports nothing from skill-content-fetch.ts, and always receives the base URL as a parameter, so there is no import cycle."
    pattern: "src/lib/skill-release-fetch.ts (new file)."
    imports: "The global fetch only. No import from skill-content-fetch.ts, update-check.ts, zip-read.ts, or any agentic-tools-* module."
    compatibility: "PLN-72-ph4oel Design > 'New module: src/lib/skill-release-fetch.ts' and 'What each module knows, and must not know'. Both URLs must derive from the caller-supplied base URL only, never from renderer input — the rule electron/update-check-ipc-handlers.cts states for its outbound URL."
    gotcha: "`releasesApiUrl` builds the API route from the base repo URL, which is not the same shape as buildAssetDownloadUrl's download route — keep them as two separate builders, as the plan specifies. A single unconditional catch is required around the whole fetch body: AbortSignal-style rejections are not plain Errors, so an instanceof-filtered catch would let one escape and turn a network blip into a rejected promise instead of []. That matters more now than it would have with a fallback in place, because a rejection here reaches the user as an install failure."
    verify:
      - "Run `npm run build`."
      - "Run `grep -c 'browser_download_url' src/lib/skill-release-fetch.ts` and confirm it returns 0."
    checklist:
      - "Are all four exports present with the plan's exact signatures?"
      - "Does parseReleases return [] rather than throwing for an unreadable shape?"
      - "Is the sort newest-first by publishedAt with tag descending as tie-break?"
      - "Does the module hold no host constant and import nothing from skill-content-fetch.ts?"
      - "Does fetchReleases resolve to [] on every unhappy path, with a body cap applied while reading?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.8 Add unit tests for the release API module in `src/lib/skill-release-fetch.test.ts`
    ```yaml
    description: "node:test coverage for parseReleases sorting and filtering, and for both URL builders."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/lib/skill-release-fetch.test.ts using node:test and node:assert/strict, matching src/lib/skill-content-fetch.test.ts's structure."
      - "Cover the five cases PLN-72-ph4oel Testing strategy names for stage 1: parseReleases sorting newest-first, draft exclusion, prerelease exclusion, missing-asset handling (assetName null), and unreadable JSON yielding []."
      - "Assert both URL builders produce URLs derived from the supplied base URL, including one case whose input JSON carries a browser_download_url that must not appear in the built asset URL."
      - "Keep every test offline — pass literal parsed-JSON values to parseReleases and literal strings to the URL builders. Do not exercise fetchReleases over the network here."
    pattern: "src/lib/skill-release-fetch.test.ts (new file)."
    imports: "node:test, node:assert/strict, and ./skill-release-fetch.js."
    compatibility: "Run against built output with `node --test dist/lib/<name>.test.js`, as every existing *.test.ts in this repo does."
    gotcha: "parseReleases takes `unknown`, so a test for the unreadable case should pass genuinely wrong shapes (null, a string, an array of numbers), not a well-formed object with one wrong field. The tie-break case needs two entries sharing one publishedAt value, or it proves nothing about the secondary sort. The missing-asset case is load-bearing now: assetName null is what task 1.9 turns into a named install failure."
    verify:
      - "Run `npm run build`."
      - "Run `node --test dist/lib/skill-release-fetch.test.js` and confirm every test passes."
    checklist:
      - "Are the five named parseReleases cases each covered by a test?"
      - "Does a test exercise the publishedAt tie with a tag-descending expectation?"
      - "Do the URL-builder tests assert derivation from the supplied base URL?"
      - "Does a test prove browser_download_url is never used?"
      - "Are all tests offline, with no live network call?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.9 Make `getInstallContent` release-only in `src/lib/skill-content-fetch.ts`
    ```yaml
    description: "Replace the tarball fetch with the download-unzip-install-delete flow, add ArchiveFsAccess and listSkillReleases, and throw the two named errors instead of falling back."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/lib/skill-content-fetch.ts, add and export `interface ArchiveFsAccess` with exactly the four methods PLN-72-ph4oel Design names — mkdir, writeBinaryFileAtomic, readBinaryFile, remove — mirrored locally rather than imported, following this file's existing mirror-not-import convention at lines 10-16."
      - "Export `listSkillReleases(): Promise<SkillReleaseSummary[]>` as a one-line composition: `fetchReleases(PRAXIS_REPO_BASE_URL)`. This file stays the only owner of the host constant."
      - "Change getInstallContent's signature to `getInstallContent(_toolId: string, deps: { fsWrite: ArchiveFsAccess }): Promise<InstallContent>` and replace its whole body (lines 224-278) with the plan's five-step release-only flow."
      - "DISCOVER: call listSkillReleases() and take `releases[0]` — the newest entry only. Never scan down the list for a release that has an asset; scanning is itself a fallback."
      - |
        DISCOVER, failure paths: throw before any download, with these two exact messages
        (PLN-72-ph4oel Design > 'Failing clearly instead of falling back'):
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
      - "DOWNLOAD: build the URL with buildAssetDownloadUrl(PRAXIS_REPO_BASE_URL, latest.tag, latest.assetName), fetch it, throw on a non-ok response in the existing style, buffer the body through the existing readCappedBody under MAX_ARCHIVE_BYTES, `deps.fsWrite.mkdir` the temporary directory, then `deps.fsWrite.writeBinaryFileAtomic` the buffer to the temporary zip path."
      - "UNZIP: read that path back with `deps.fsWrite.readBinaryFile` and decode the RETURNED buffer with parseZip — a null read is a failed download and must throw. Decode the read-back buffer, never the HTTP response buffer: that substitution is what makes the download step real rather than decorative."
      - "INSTALL: map the zip entries to SkillContent. Entry names are already relative to the skills root, so `segments[0]` is the skill id and names pass through VERBATIM — no top-level-directory stripping and no `skills/` prefix handling. Keep the per-segment `isExcluded` check, the SKILL.md detection, the files[] assembly, the per-skill files sort and the id sort exactly as the current loop at lines 245-276 performs them."
      - "REMOVE: delete the temporary zip with `deps.fsWrite.remove`, from a `finally` wrapped around the read-and-decode-and-map steps only, so the file never outlives the function that created it and a corrupt or truncated zip still leaves nothing behind."
      - "Build the temporary path as `path.join(os.tmpdir(), 'flowcharge-skill-install', `core-${process.pid}-${randomUUID()}.zip`)`. Use no network-derived text in any path segment: the release tag must not appear in the filename."
      - "Log exactly one line carrying the thrown message when the install fails on this path, using `console.error` in the style of src/server.ts's own error logging, per PLN-72-ph4oel Non-functional notes. This module is loaded by both the HTTP server and the Electron main process, so the single line covers both transports."
      - "Return `{ version: 'fetched-from-git', skills }`. Leave the version literal exactly as it is — the plan states nothing reads it and hashInstallContent does not hash it; releaseTag is the field that carries release identity, and task 2.2 adds it."
      - "Rewrite this file's header comment (lines 1-19) in the same edit: state the newest published release as the only content source, keep the mirror-not-import explanation and the no-cache decision verbatim, drop the tarball-archive and PRAXIS_REPO_REF ref-pinning prose, and drop the stale claim that this module's getInstallContent is assignable to agentic-tools-content.ts's GetInstallContent port (see Divergence 3)."
    pattern: "src/lib/skill-content-fetch.ts, the new ArchiveFsAccess interface, getInstallContent, one new exported function, and the file header."
    imports: "`fetchReleases`, `buildAssetDownloadUrl` and the SkillReleaseSummary type from ./skill-release-fetch.js; `parseZip` from ./zip-read.js; `os` from node:os, `path` from node:path and `randomUUID` from node:crypto."
    compatibility: "PLN-72-ph4oel Design > 'Changed: src/lib/skill-content-fetch.ts' and Assumptions 1, 2, 6, 8 and 9. Satisfies acceptance criteria 1, 7, 9 and 10. node:os, node:path and node:crypto are pure environment and string algebra that touch no filesystem, so they do not breach the port-only rule — the same justification agentic-tools-install.ts:9-11 gives for its own node:path import."
    gotcha: "No catch may swallow the two DISCOVER throws — nothing else in this module catches them, and the whole point of the removal is that they reach the user. The asset download must go through readCappedBody, not res.arrayBuffer(), or the archive cap is silently lost and a hostile response could fill the temporary directory. `deps.fsWrite.remove` is already force:true, so deleting an absent file is not an error and cleanup never masks the real one. This task's signature change breaks src/server.ts, the electron handler and the existing live-network test until tasks 1.11, 1.12 and 1.13 land."
    verify:
      - "Run `npm run build` and expect it to fail only at the three call sites tasks 1.11, 1.12 and 1.13 fix."
      - "Run `grep -n 'node:fs' src/lib/skill-content-fetch.ts` and confirm zero matches, proving every filesystem call still goes through the injected port."
      - "Run `grep -n 'buildArchiveUrl\\|parseTar\\|gunzipSync' src/lib/skill-content-fetch.ts` and confirm no match remains inside getInstallContent — the orphaned declarations themselves are task 1.10's."
    checklist:
      - "Does the release path use releases[0] only, with no scan down the list?"
      - "Do both failure paths throw the plan's exact messages before any download, mkdir or write?"
      - "Is the buffer handed to parseZip the one readBinaryFile returned, not the HTTP response buffer?"
      - "Is the temporary path built only from os.tmpdir(), a fixed prefix, the pid and a UUID, with no release tag?"
      - "Does the remove call sit in a finally around the read-and-decode steps?"
      - "Are zip entry names mapped verbatim, with no top-level-directory or `skills/` stripping?"
      - "Does this module still import no filesystem module?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.10 Delete the orphaned branch-tarball declarations from `src/lib/skill-content-fetch.ts`
    ```yaml
    description: "Remove PRAXIS_REPO_REF, buildArchiveUrl, parseTar, TarEntry, the gunzipSync import and MAX_DECOMPRESSED_BYTES, now that nothing calls them."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/lib/skill-content-fetch.ts, delete `export const PRAXIS_REPO_REF = 'main';` (line 39) and `export function buildArchiveUrl(baseUrl, ref)` with its body (lines 50-52). Read that line fresh before deleting it: the working tree reads `'main'`, not `'master'`, because ISS-23-22bcfg's fix is already applied there (it is not yet in base_commit 2046996). Either way this task deletes the whole line, so it deletes a working constant, not a broken one."
      - "Delete `export interface TarEntry` (lines 135-139) and `export function parseTar` with its whole body and its preceding USTAR explanation comment (lines 141-174)."
      - "Delete the `import { gunzipSync } from 'node:zlib';` line (line 21) and the `MAX_DECOMPRESSED_BYTES` constant (line 48). Both existed only to serve the gunzip call task 1.9 removed."
      - "Keep `PRAXIS_REPO_BASE_URL` (line 38) and `MAX_ARCHIVE_BYTES` (line 47): the base URL feeds listSkillReleases, buildAssetDownloadUrl and the first error message, and MAX_ARCHIVE_BYTES caps the release asset download."
      - "Update the MAX_ARCHIVE_BYTES comment block (lines 41-46) so it describes the release zip asset rather than a git-archive tarball, and so it no longer describes a decompression ceiling that no longer exists."
      - "Keep isExcluded, FRONTMATTER, FOLDED_INDICATOR, unquote, parseFrontmatterFields, parseSkillFrontmatter and readCappedBody exactly as they are — all are still used by the release path."
      - "Delete nothing outside this file in this task; the test file's parseTar coverage is task 1.13's."
    pattern: "src/lib/skill-content-fetch.ts, six deletions and one comment edit."
    imports: "None added. One import removed: gunzipSync from node:zlib."
    compatibility: "PLN-72-ph4oel Design > 'Deleted: the branch-tarball path' and acceptance criterion 11. The plan verified before deciding that getInstallContent and this file's own unit test were the only references to parseTar/TarEntry, and that PRAXIS_REPO_REF and buildArchiveUrl had no other reader or caller."
    gotcha: "Every line number in this task is read at base_commit 2046996. Task 1.9 runs FIRST on this same file and rewrites its header comment (lines 1-19) and getInstallContent's body, so every line below the header will have SHIFTED by the time this task runs — locate each declaration by its own name, never by the stated line number alone. Removing the exported parseTar breaks src/lib/skill-content-fetch.test.ts's import at line 15 until task 1.13 lands, so the build stays red across this pair — that is expected, not a mistake. Do not delete PRAXIS_REPO_BASE_URL or MAX_ARCHIVE_BYTES by association: both are still live on the release path. ISS-23-22bcfg (the stale `master` ref) is already done and its fix is already in the file; this deletion makes it moot. Do not edit the issue list here."
    verify:
      - "Run `grep -n 'PRAXIS_REPO_REF\\|buildArchiveUrl\\|parseTar\\|TarEntry\\|gunzipSync\\|MAX_DECOMPRESSED_BYTES' src/lib/skill-content-fetch.ts` and confirm zero matches."
      - "Run `grep -n 'PRAXIS_REPO_BASE_URL\\|MAX_ARCHIVE_BYTES' src/lib/skill-content-fetch.ts` and confirm both are still present."
    checklist:
      - "Are all six named declarations and imports gone from this file?"
      - "Are PRAXIS_REPO_BASE_URL and MAX_ARCHIVE_BYTES both retained?"
      - "Does the retained cap's comment describe the release asset rather than a tarball?"
      - "Were the frontmatter parser, isExcluded and readCappedBody left untouched?"
      - "Was no other file edited by this task?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.11 Pass `fsWrite` and resolve content once per request in `electron/agentic-tools-ipc-handlers.cts`
    ```yaml
    description: "Mirror the binary port pair and the new getInstallContent signature, hoist the content fetch out of the per-target loop, and pass the fsWrite this handler already holds."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In electron/agentic-tools-ipc-handlers.cts, add `readBinaryFile(path: string): Promise<Buffer | null>;` and `writeBinaryFileAtomic(path: string, content: Buffer): Promise<void>;` to the local FsWriteAccess interface at lines 125-131, keeping it in sync with src/lib/agentic-tools-install.ts's real port by hand, per this file's own rootDir rule."
      - "Change the local `GetInstallContentFn` type at line 184 to take the same second parameter the real function now takes: `(toolId: string, deps: { fsWrite: FsWriteAccess }) => Promise<InstallContent>`."
      - "In the installSelected handler, move the `await getInstallContent(target.toolId)` call at line 395 OUT of the per-target install loop and call it once, after the permitted-root validation loop and before the install loop at line 388, passing `{ fsWrite }` — the module-level adapter assigned at line 355. Construct no second adapter."
      - "Pass that one InstallContent to every installToTarget call in the batch."
      - "Keep the unknown-toolId skipped-no-format push inside the loop exactly as it is at lines 390-394, keep the call inside the handler's existing try block, and keep the handler's PraxisIpcResult result shapes unchanged."
      - "Do not add caching across requests — the resolve is once per request, not once per process."
    pattern: "electron/agentic-tools-ipc-handlers.cts, the local FsWriteAccess interface, the GetInstallContentFn type, and the installSelected handler's install loop."
    imports: "None new. This file must never import — value or type — from src/lib, per its own file-header rootDir rule at lines 47-54."
    compatibility: "PLN-72-ph4oel Design > 'Transport surface'. Resolving once per request is required for correctness, not tidiness: a per-target fetch could straddle a release publication and record two different versions for one batch, and it means one install request produces exactly one temporary zip file whatever the batch size."
    gotcha: "There is no compiler check tying these local mirrors to the real interfaces, so a missed field fails silently rather than at build time — copy the two binary method signatures exactly. getInstallContent ignores its toolId argument, so hoisting it is behaviour-preserving for content, but the call must stay inside the try block at lines 364-407 or a release-missing throw escapes the handler instead of becoming the `{ ok: false, status: 500, error }` the renderer's alert reads."
    verify:
      - "Run `npm run build`."
      - "Run `grep -c 'getInstallContent(' electron/agentic-tools-ipc-handlers.cts` and confirm exactly one call site remains in the installSelected handler."
      - "Run `grep -n 'BinaryFile' electron/agentic-tools-ipc-handlers.cts` and confirm two matches, both inside the local FsWriteAccess interface."
    checklist:
      - "Does the local FsWriteAccess mirror carry both binary methods with the real port's exact signatures?"
      - "Does GetInstallContentFn take the deps second parameter?"
      - "Is getInstallContent called exactly once per installSelected request, inside the try block?"
      - "Is the module-level fsWrite passed rather than a newly constructed adapter?"
      - "Is the unknown-toolId skipped-no-format path unchanged?"
      - "Was no import from src/lib added and no cross-request cache introduced?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.12 Pass `installFsWrite` and resolve content once per request in `src/server.ts`
    ```yaml
    description: "The same deps pass-through and once-per-request hoist on the HTTP transport, so both call sites behave identically."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/server.ts's handleIntegrationsInstallsPost, move the `await getInstallContent(target.toolId)` call at line 564 OUT of the per-target loop and call it once, after the permitted-root validation loop at lines 544-555 and before the install loop at line 557, passing `{ fsWrite: installFsWrite }` — the adapter already constructed at line 92. Construct no second adapter."
      - "Pass that one InstallContent to every installToTarget call in the batch."
      - "Keep the unknown-toolId skipped-no-format push inside the loop at lines 559-563, keep the call inside the route's existing try block, and keep the route's existing error shapes."
    pattern: "src/server.ts, handleIntegrationsInstallsPost's install loop only."
    imports: "None new — getInstallContent is already imported at line 22 and installFsWrite is already constructed at line 92."
    compatibility: "PLN-72-ph4oel Design > 'Transport surface'. The two transports must stay in lockstep — the plan names four-place transport wiring drifting out of sync as a top risk."
    gotcha: "The call must stay inside the handler's own try/catch at lines 516-576: this route's async body swallows its own throws, and moving the call outside that scope would surface a release-missing throw as an unhandled rejection rather than the 500 whose body carries the message the user must see."
    verify:
      - "Run `npm run build`."
      - "Run `grep -c 'getInstallContent(' src/server.ts` and confirm exactly one call site remains."
    checklist:
      - "Is getInstallContent called exactly once per POST /api/integrations/installs request?"
      - "Is the existing installFsWrite passed rather than a new adapter?"
      - "Is the call inside the route's try block?"
      - "Is the unknown-toolId path unchanged?"
      - "Does the loop still validate every target before any install?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.13 Drop the tarball tests and re-point the live-network test in `src/lib/skill-content-fetch.test.ts`
    ```yaml
    description: "Delete tier (a)'s parseTar tests and USTAR fixture builders, then re-point tier (c) at the release path's fc-* skills."
    author: Anthony Koukoullis
    issues: [ISS-24-4rf1rr]
    implement:
      - "In src/lib/skill-content-fetch.test.ts, delete tier (a) entirely: the buildHeader and padTo512 fixture helpers (lines 19-35) and the parseTar test (lines 37-61). Remove `parseTar` from the import at line 15. This is a required consequence of task 1.10's deletion, not an optional cleanup."
      - "Rewrite the file-header comment (lines 1-10) so it describes the tiers that remain, and so the tier list no longer names parseTar."
      - "Change the tier (c) call at line 112 to `getInstallContent('claude-code', { fsWrite: createNodeFsWriteAccess() })`, importing createNodeFsWriteAccess from './agentic-tools-fs-adapter.js' — the real adapter satisfies ArchiveFsAccess structurally with no wrapper (see Divergence 4)."
      - "Replace the EXPECTED_IDS array at lines 100-109 with the eight ids the release zip actually ships, read from the release asset itself rather than from memory. Rename the test so its title no longer says 'prx-*'."
      - "Keep the `assert.equal(content.version, 'fetched-from-git')` assertion at line 114 as it is — PLN-72-ph4oel leaves that literal unchanged on the release path, so it is still correct."
      - "Update the nested-files block at lines 124-148: it asserts prx-orchestrate's files, which the release ships under a different skill id. Point it at the corresponding fc-* skill and re-read the expected relativePath list from the release asset rather than editing the strings from memory."
      - "Add an `os.tmpdir()/flowcharge-skill-install` emptiness assertion after the call, proving acceptance criterion 9 against the real host: the directory either does not exist or contains no file."
      - "Leave tier (b) — the parseSkillFrontmatter tests at lines 65-96 — completely untouched."
    pattern: "src/lib/skill-content-fetch.test.ts, the header comment, the import line, tier (a) (deleted) and tier (c)."
    imports: "createNodeFsWriteAccess from './agentic-tools-fs-adapter.js'; node:fs/promises and node:os for the temporary-directory assertion."
    compatibility: "PLN-72-ph4oel Testing strategy, stage 1 deletion-check and manual bullets, the latter expressed here as an automated assertion in the tier that already runs live. That tier has no skip-when-offline mechanism by design, and this task does not add one. Closes ISS-24-4rf1rr's stale EXPECTED_IDS assertion."
    gotcha: "This test now exercises the release path only, so it fails outright when the Gitea host publishes no release or the newest release carries no zip asset — that failure is the feature working as designed, not a test defect. Read the ids from the live asset before writing them; if no release exists at execution time, record it in the ## Divergences section rather than guessing at the list."
    verify:
      - "Run `npm run build` and confirm the whole build now passes, since this was the last call site left broken by tasks 1.9 and 1.10."
      - "Run `node --test dist/lib/skill-content-fetch.test.js` and confirm every remaining test passes."
    checklist:
      - "Are tier (a)'s tests, its two fixture helpers and the parseTar import all gone?"
      - "Does the call pass a deps object holding a real ArchiveFsAccess?"
      - "Were the expected skill ids read from the release asset rather than written from memory?"
      - "Does the test assert the temporary directory is empty after the call?"
      - "Was tier (b) left unmodified?"
      - "Does `npm run build` pass across all three tsconfig projects?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.14 Add stubbed-fetch release-path lifecycle coverage in `src/lib/skill-content-fetch.test.ts`
    ```yaml
    description: "Offline integration coverage of the release path, the skills-rooted mapping, and the three temporary-file lifecycle assertions."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Extend src/lib/skill-content-fetch.test.ts with a new offline tier that replaces the global fetch with a stub for the duration of each test, restores it in a finally block, and passes a FAKE ArchiveFsAccess that records every mkdir, writeBinaryFileAtomic, readBinaryFile and remove call with its path and content."
      - "Cover the release path: the stub answers the releases API with one non-draft, non-prerelease release carrying a .zip asset, and answers the asset URL with an in-test zip built by zlib.deflateRawSync; assert getInstallContent returns the zip's skills with each entry name's first segment as the skill id."
      - "Cover skills-rooted mapping explicitly: a zip entry named `fc-bug-hunt/SKILL.md` must yield a skill whose id is `fc-bug-hunt`, with no `skills/` prefix handling and no top-level-directory stripping applied."
      - "Assert the three lifecycle properties PLN-72-ph4oel Testing strategy names as mattering most: the buffer handed to writeBinaryFileAtomic equals the downloaded bytes; parseZip received what readBinaryFile returned rather than the response buffer (have the fake return a DIFFERENT valid zip than the one written, and assert the returned skills are the read-back zip's); and `remove` is called with the same path on both the success run and a decode-failure run against a deliberately corrupt zip."
      - "Assert the temporary path the fake was handed sits under os.tmpdir()/flowcharge-skill-install and contains no release tag."
      - "Leave the existing tiers, including task 1.13's live-network tier, untouched."
    pattern: "src/lib/skill-content-fetch.test.ts (existing file, additive)."
    imports: "node:zlib (deflateRawSync) and node:os alongside the file's existing imports."
    compatibility: "This repo's node:test convention against built output. The stub must resolve a Response-like object exposing `ok`, `status`, `statusText`, `headers.get('content-length')` and `body.getReader()`, because readCappedBody reads the stream rather than calling arrayBuffer()."
    gotcha: "A stub returning a plain object with only `arrayBuffer()` fails inside readCappedBody with a confusing 'response carried no body' error — give the stub a real ReadableStream body. Restore the original global fetch in a finally block, or a failing test leaves the live-network tier stubbed out. The releases API and the asset URL are two different requests to the same stub, so branch on the URL argument."
    verify:
      - "Run `npm run build`."
      - "Run `node --test dist/lib/skill-content-fetch.test.js` and confirm every test passes."
    checklist:
      - "Does a test prove the release path installs the zip's skills?"
      - "Does a test prove parseZip decoded the read-back buffer, not the response buffer?"
      - "Does a test prove remove is called on both the success and the decode-failure runs?"
      - "Does a test prove a `fc-bug-hunt/SKILL.md` entry maps to skill id `fc-bug-hunt`?"
      - "Does a test assert the temporary path carries no release tag?"
      - "Is the global fetch restored after every stubbed test?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.15 Add the two release-only failure-path tests in `src/lib/skill-content-fetch.test.ts`
    ```yaml
    description: "Prove that an empty release list and a zip-less newest release each reject with the named message, write nothing, and make no second request."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Extend the offline tier task 1.14 added with two tests, each asserting on the REJECTION rather than on a return value, using `assert.rejects` with a message matcher."
      - "EMPTY LIST: the stubbed releases response yields `[]`; assert getInstallContent rejects with a message naming PRAXIS_REPO_BASE_URL and saying the list was empty or could not be read."
      - "NO ZIP ASSET: the stubbed response carries one published release whose assets array is empty or carries no name ending in '.zip'; assert getInstallContent rejects with a message naming that release's tag."
      - "In BOTH tests also assert the negatives, because they are what the removal is for: the fake ArchiveFsAccess recorded ZERO calls — no mkdir, no writeBinaryFileAtomic, no readBinaryFile, no remove — and the stubbed fetch was called exactly once, for the releases API only."
      - "Do not settle for a bare 'it throws' assertion. A test that only asserted a rejection would pass against a fallback that threw for some other reason, which is precisely the regression these two tests exist to catch."
    pattern: "src/lib/skill-content-fetch.test.ts (existing file, additive to task 1.14's offline tier)."
    imports: "None beyond what task 1.14 added."
    compatibility: "PLN-72-ph4oel Testing strategy, stage 1 integration bullet for the release-only rule. Satisfies acceptance criterion 7 in full: nothing installed, no file written, and the thrown message is the one the alert shows."
    gotcha: "The zero-fs-calls assertion is the load-bearing half. A future re-introduced fallback would still reject in some paths but would create the temporary directory or issue a second outbound request first, and only the negative assertions catch that. Assert the fetch call COUNT, not just its first argument."
    verify:
      - "Run `npm run build`."
      - "Run `node --test dist/lib/skill-content-fetch.test.js` and confirm both new tests pass."
    checklist:
      - "Does the empty-list test assert a rejection whose message names the base URL?"
      - "Does the no-asset test assert a rejection whose message names the release tag?"
      - "Do both tests assert the fake ArchiveFsAccess recorded zero calls?"
      - "Do both tests assert exactly one fetch call, to the releases API?"
      - "Is each assertion made on the rejection rather than on a returned value?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.16 Prove the branch-tarball path is gone across the whole repository
    ```yaml
    description: "Acceptance criterion 11's evidence: no reference to the deleted symbols survives anywhere, and the build and the full test suite pass."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run a repository-wide grep for `parseTar`, `TarEntry`, `buildArchiveUrl`, `PRAXIS_REPO_REF` and `gunzipSync` over `src` and `electron`, and confirm it returns nothing at all — including comments, which the header rewrites in tasks 1.9 and 1.10 should already have cleared."
      - "If any match survives, remove it in the file it sits in, but only when that file is one tasks 1.9, 1.10 or 1.13 already own. A match in any other file is out of scope: record it in the ## Divergences section and stop."
      - "Run the whole test suite against the built output and confirm every remaining test passes, including the live-network tier."
      - "Record the grep output and the test summary in this task's self_eval, so the evidence survives the session."
    pattern: "No source file is edited by this task unless the grep finds a stray reference in a file tasks 1.9, 1.10 or 1.13 already own."
    imports: "None."
    compatibility: "PLN-72-ph4oel Testing strategy, stage 1 deletion-check bullet, and acceptance criterion 11 verbatim: skill-content-fetch.ts exports no buildArchiveUrl, no PRAXIS_REPO_REF and no parseTar/TarEntry, imports no gunzipSync, and the project still builds with every remaining test passing."
    gotcha: "`MAX_ARCHIVE_BYTES` and `PRAXIS_REPO_BASE_URL` must still be present — do not extend the grep list to them. A grep that also scanned `dist` would report stale compiled output from before the deletion; scan the sources only, or rebuild first."
    verify:
      - "Run `grep -rn 'parseTar\\|TarEntry\\|buildArchiveUrl\\|PRAXIS_REPO_REF\\|gunzipSync' src electron` and confirm zero matches."
      - "Run `npm run build` and confirm it passes across all three tsconfig projects."
      - "Run `node --test dist/lib/*.test.js` and confirm every test passes."
    checklist:
      - "Does the five-symbol grep over src and electron return nothing?"
      - "Are PRAXIS_REPO_BASE_URL and MAX_ARCHIVE_BYTES still present in skill-content-fetch.ts?"
      - "Does `npm run build` pass?"
      - "Does the whole built test suite pass?"
      - "Was the grep run against sources rather than dist?"
    self_eval:
      passed: true
      failures: []
      evidence:
        grep: "`grep -rn 'parseTar\\|TarEntry\\|buildArchiveUrl\\|PRAXIS_REPO_REF\\|gunzipSync' src electron` returned zero matches (exit 1). One prose match had survived in src/lib/skill-content-fetch.test.ts's header comment, a file task 1.13 owns; it was reworded in place, so no out-of-scope file was touched."
        retained: "PRAXIS_REPO_BASE_URL (line 62) and MAX_ARCHIVE_BYTES (line 71) are both still present in src/lib/skill-content-fetch.ts."
        build: "`npm run build` passed across all three tsconfig projects and the public bundle step."
        tests: "`node --test dist/lib/*.test.js` reported tests 144, pass 144, fail 0, cancelled 0, skipped 0, todo 0 — including the live-network tier."
    ```
  - [x] 1.17 Verify the temporary-file lifecycle and the failure message by hand
    ```yaml
    description: "Manual end-to-end check that a real release install writes the release's skills and leaves no zip behind, and that a missing release fails with the named message."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run `npm run build`, then start the app and open Manage Integrations."
      - "Point the install at a DISPOSABLE target directory, never a real tool config directory. Tick one eligible row and click 'Install selected'."
      - "Confirm the files written to that target carry the release's own fc-* skill ids, proving acceptance criterion 1 end to end."
      - "List `os.tmpdir()/flowcharge-skill-install` and confirm it holds no file, proving acceptance criterion 9."
      - "Repeat against a deliberately corrupted asset — for example by pointing PRAXIS_REPO_BASE_URL at a local stub serving a truncated zip, then reverting that edit — confirm the install reports the error, and confirm the directory is empty again, proving acceptance criterion 10."
      - "Repeat against a stub whose releases API answers an empty array, and confirm the alert shows the thrown message's own words — 'No published FlowCharge Core release found at ...' — and that nothing was installed and no temporary directory was created, proving acceptance criterion 7."
      - "Repeat against a stub whose newest release carries no .zip asset, and confirm the alert names that release's tag."
      - "Record the observed skill ids, both alert messages and every directory listing in this task's self_eval, so the evidence survives the session."
    pattern: "No source file is edited by this task. It is the stage's manual acceptance gate."
    imports: "None."
    compatibility: "PLN-72-ph4oel Testing strategy, stage 1 manual bullet, and acceptance criteria 1, 7, 9 and 10. Assumption 9 states the OS temporary directory is writable and the asset is a few megabytes, so free space is not a concern."
    gotcha: "Do not run this against ~/.claude/skills or any other real tool config directory — the install performs real writes. Any temporary edit made to reach the corrupt-asset or empty-release cases must be reverted before this task is marked complete; confirm with `git status` that no source file is left modified."
    verify:
      - "Run `ls -la \"$(node -p 'require(\"node:os\").tmpdir()')/flowcharge-skill-install\"` after the successful install and confirm no file is listed."
      - "Run the same command after the corrupted-asset run and confirm no file is listed."
      - "Run `git status --porcelain` and confirm no source file is left modified by the stub experiments."
    checklist:
      - "Did a real install write the release's fc-* skill ids to a disposable target?"
      - "Was the temporary directory empty after the successful install?"
      - "Was the temporary directory empty after the corrupted-asset failure?"
      - "Did the empty-release case show the thrown message's own words in the alert, with nothing installed?"
      - "Did the no-zip-asset case name the release tag in the alert?"
      - "Is the working tree free of leftover experiment edits?"
    self_eval:
      passed: true
      failures: []
      method: "Driven end to end from a scratchpad script against the REAL release, the REAL createNodeFsWriteAccess adapter, the REAL installToTarget and a REAL disposable temporary directory, instead of clicking through Manage Integrations. The three failure cases ran against a real local stub HTTP server reached by rewriting only the outbound host, so every URL was still built by the production code and NO source file was edited to reach them. The renderer's alert() rendering itself was therefore not observed; this stage changes no renderer code, and the message the alert would show is the thrown message recorded below."
      evidence:
        installed_skill_ids: "fc-bug-hunt, fc-dev-principles, fc-git, fc-issue-list, fc-orchestrate, fc-plain-text-kanban, fc-plan-feature, fc-task-list — written as skills/<id>/SKILL.md plus fc-orchestrate's nested files, 23 files in total, status 'installed' (AC1)."
        disposable_target: "/var/folders/.../T/fc-manual-gate-target-7y5saq, created with fs.mkdtemp and removed afterwards. No real tool config directory was touched."
        tmp_dir_after_success: "os.tmpdir()/flowcharge-skill-install listed as [] — the directory exists and holds no file (AC9)."
        corrupt_asset_message: "'Malformed zip archive: no end-of-central-directory record found', with the temporary directory listed as [] afterwards (AC10)."
        empty_release_message: "'No published FlowCharge Core release found at http://100.87.185.97:8110/akoukoullis/Praxis. The release list was empty or could not be read.', nothing installed, temporary directory [] (AC7)."
        no_zip_asset_message: "'The latest FlowCharge Core release v7.7.7 carries no .zip asset, so there is nothing to install.' — the stub release's tag is named."
        tmpdir_listing: "`ls -la \"$(node -p 'require(\"node:os\").tmpdir()')/flowcharge-skill-install\"` reported 'total 0' with only . and .. present."
        working_tree: "`git status --porcelain` listed only this stage's own intended edits plus files already modified or untracked before the stage began. No experiment edit survives."
    ```

- [x] 2. Record the installed release version

  ```yaml
  description: "Carry the release tag from InstallContent onto the install record, including the backfill on an up-to-date install."
  ```

  - [x] 2.1 Add the optional `releaseTag` to `InstallContent` in `src/lib/agentic-tools-content.ts`
    ```yaml
    description: "Additive contract change: InstallContent gains an optional releaseTag, and hashInstallContent stays untouched."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        Apply this SEARCH/REPLACE block to src/lib/agentic-tools-content.ts:
        <<<<<<< SEARCH
        export interface InstallContent {
          version: string; // caller-supplied content identity, informational only
          skills: SkillContent[];
        }
        =======
        export interface InstallContent {
          version: string; // caller-supplied content identity, informational only
          releaseTag?: string; // present only for content sourced from a published release
          skills: SkillContent[];
        }
        >>>>>>> REPLACE
      - "Change nothing else in this file. hashInstallContent must not read releaseTag, and canonicalSkill must stay byte-identical, so content hashes stay stable across this feature."
    pattern: "src/lib/agentic-tools-content.ts, the InstallContent interface only."
    imports: "None new."
    compatibility: "PLN-72-ph4oel Design > 'Changed contracts' and Data & compatibility. The field is optional in both directions, so no existing install is invalidated and no user sees a spurious re-write after upgrading."
    gotcha: "Adding releaseTag to the hashed shape would invalidate every existing install and cause a re-write for every user — hashInstallContent at lines 48-55 already hashes only content.skills, so the correct action here is to leave it alone entirely."
    verify:
      - "Run `npm run build`."
      - "Run `node --test dist/lib/agentic-tools-content.test.js` and confirm every existing test still passes with no expectation edited."
    checklist:
      - "Is releaseTag optional on InstallContent?"
      - "Is hashInstallContent unchanged?"
      - "Is canonicalSkill unchanged?"
      - "Do the existing content tests still pass?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 2.2 Set the release tag on the release path in `src/lib/skill-content-fetch.ts`
    ```yaml
    description: "Mirror the new optional field locally and populate it from the chosen release's tag, leaving the version literal alone."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/lib/skill-content-fetch.ts, add `releaseTag?: string;` to this module's local InstallContent mirror at lines 31-34, keeping it structurally identical to agentic-tools-content.ts's real interface as the file header requires."
      - "In getInstallContent's return, set `releaseTag` to the chosen release's tag — the same `releases[0].tag` value the failure messages in task 1.9 already hold in scope."
      - "Leave `version: 'fetched-from-git'` exactly as it is. PLN-72-ph4oel is explicit that nothing reads that literal, hashInstallContent does not hash it, and releaseTag is the field that now carries release identity, so renaming it would be churn."
    pattern: "src/lib/skill-content-fetch.ts, the local InstallContent interface and getInstallContent's single return site."
    imports: "None new."
    compatibility: "PLN-72-ph4oel Design > 'Changed: src/lib/skill-content-fetch.ts'. The local mirror must stay structurally identical to the real interface even though the module no longer conforms to the GetInstallContent port's arity (see Divergence 3)."
    gotcha: "There is only one return site now that the fallback is gone, so releaseTag is always present on content this module produces. The absent-key case is not produced here at all — it belongs to fixture content in tests and to pre-feature records, which is what task 2.4's omit-the-key rule serves."
    verify:
      - "Run `npm run build`."
      - "Run `node --test dist/lib/skill-content-fetch.test.js` and confirm task 1.14's release-path test can now observe the tag on the returned content."
    checklist:
      - "Does the local mirror carry the same optional releaseTag as the real interface?"
      - "Does the release path set releaseTag to the chosen release's tag?"
      - "Is `version` still the literal 'fetched-from-git'?"
      - "Does `npm run build` pass?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 2.3 Add the optional `version` to `InstallRecord` in `src/lib/agentic-tools-install-tracking.ts`
    ```yaml
    description: "Additive persisted-shape change: the install record gains an optional version holding the release tag."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        Apply this SEARCH/REPLACE block to src/lib/agentic-tools-install-tracking.ts:
        <<<<<<< SEARCH
          installedAt: string;
          updatedAt: string;
          contentHash: string;
        }
        =======
          installedAt: string;
          updatedAt: string;
          contentHash: string;
          version?: string; // release tag as published; absent only for pre-feature install records
        }
        >>>>>>> REPLACE
      - "Change nothing else: parseInstallRegistry, serializeInstallRegistry, upsertInstallRecord, findInstallRecord and removeInstallRecord all stay as they are."
    pattern: "src/lib/agentic-tools-install-tracking.ts, the InstallRecord interface only."
    imports: "None new."
    compatibility: "PLN-72-ph4oel Design > 'Changed contracts' and Data & compatibility. parseInstallRegistry (lines 33-40) casts through with no per-record shape validation, so existing .praxis-installs.json records load unchanged and carry no version. No migration and no backfill script."
    gotcha: "Do not add validation to parseInstallRegistry while here — its cast-through posture is exactly what makes this change backward-compatible, and older code reading a newer registry must keep ignoring the unknown key."
    verify:
      - "Run `npm run build`."
      - "Run `node --test dist/lib/agentic-tools-install-tracking.test.js` and confirm every existing test still passes."
    checklist:
      - "Is version optional on InstallRecord?"
      - "Are all five pure registry operations unchanged?"
      - "Do the existing tracking tests pass with no expectation edited?"
      - "Was no migration or backfill script added?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 2.4 Write the release tag onto the record in `installToTarget`
    ```yaml
    description: "installToTarget copies content.releaseTag into record.version when present, and omits the key otherwise."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/lib/agentic-tools-install.ts, at the `const record: InstallRecord = { ... }` construction at lines 112-120 inside installToTarget, set `version` from `content.releaseTag` when it is present, and omit the key entirely when it is absent."
      - "Build the record so the key is genuinely absent rather than set to undefined — construct the base object, then add the version key conditionally before the upsert at line 121."
      - "Change nothing about the write loop, the containment gate, the returned InstallStatus values, installAllGlobal, or removeInstallation."
    pattern: "src/lib/agentic-tools-install.ts, the record construction inside installToTarget only."
    imports: "None new."
    compatibility: "PLN-72-ph4oel Design > 'Changed contracts', agentic-tools-install.ts entry. This module must not learn what a release is beyond copying an opaque releaseTag string. Satisfies acceptance criterion 3."
    gotcha: "`JSON.stringify` drops a key whose value is undefined, so a plain `version: content.releaseTag` line would appear to satisfy the contract on disk while making the in-memory record shape disagree with it — construct the key conditionally instead. The absent case is still reachable: installAllGlobal's port and every test fixture supply content with no releaseTag."
    verify:
      - "Run `npm run build`."
      - "Run `node --test dist/lib/agentic-tools-install.test.js` and confirm every existing test still passes."
    checklist:
      - "Is record.version set only when content.releaseTag is present?"
      - "Is the key absent, not undefined, for content carrying no releaseTag?"
      - "Are the write loop and the containment gate untouched?"
      - "Are installAllGlobal and removeInstallation untouched?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 2.5 Backfill the version on the up-to-date early return in `installToTarget`
    ```yaml
    description: "When the content hash matches but the recorded version differs from the release tag, persist the corrected version with zero content writes and still return 'up-to-date'."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/lib/agentic-tools-install.ts, at the early return `if (existing !== undefined && existing.contentHash === contentHash)` at lines 88-90, add the plan's backfill rule: when the existing record's `version` differs from `content.releaseTag`, upsert the record with the corrected version and write the registry before returning."
      - "Perform ZERO content writes on this branch — no formatForTarget call, no mkdir, no writeTextFileAtomic against a content path. Only the registry write is permitted."
      - "Still return `{ status: 'up-to-date' }` with the existing record's resolvedPath, unchanged."
      - "Preserve installedAt from the existing record; updatedAt may be refreshed on the backfill."
      - "When the versions already agree, keep today's behaviour exactly: return immediately with no registry write at all."
    pattern: "src/lib/agentic-tools-install.ts, the up-to-date early-return branch inside installToTarget only."
    imports: "None new."
    compatibility: "PLN-72-ph4oel Design > 'Changed contracts', agentic-tools-install.ts entry. Without this rule a user who installed the same bytes before this feature would never get a version recorded and could never be told an update exists."
    gotcha: "Comparing `existing.version !== content.releaseTag` treats absent-vs-absent as equal, which is correct — and it fires for exactly the case the rule exists for: a release-sourced install of bytes a pre-feature install already wrote. Do not widen the branch into a content re-write: the zero-content-write property is an explicit requirement carried over from this module's existing contract at lines 66-72."
    verify:
      - "Run `npm run build`."
      - "Run `node --test dist/lib/agentic-tools-install.test.js` and confirm every existing test still passes, including the install/no-op/update lifecycle test at line 176 whose zero-write assertion sits at line 194. That test's fixture content carries no releaseTag and its stored record therefore has no version, so absent-vs-absent compares equal and this task's backfill branch must NOT fire for it — if that assertion now fails, the comparison is wrong, not the test."
    checklist:
      - "Does the backfill branch write the registry and nothing else?"
      - "Does it still return 'up-to-date' with the existing resolvedPath?"
      - "Is installedAt preserved from the existing record?"
      - "Is the versions-agree case still a pure early return with no registry write?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 2.6 Extend `src/lib/agentic-tools-install.test.ts` for version recording
    ```yaml
    description: "Unit coverage for version written, version omitted, and the up-to-date backfill's zero content writes."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Extend src/lib/agentic-tools-install.test.ts with the three cases PLN-72-ph4oel Testing strategy names for stage 2, reusing the file's existing fakeFsWriteAccess rather than adding a new one."
      - "Case 1: installing content carrying a releaseTag writes a record whose version equals that tag."
      - "Case 2: installing content with no releaseTag writes a record with no version key — assert on the serialized registry text, so an undefined-valued key would fail."
      - "Case 3: a second install of identical content whose releaseTag differs from the stored record's version returns 'up-to-date', writes the registry with the corrected version, and performs zero writes to any content path."
      - "Assert case 3's zero-content-writes property with the file's existing contentWriteCalls helper at line 106, confirming the only path written is REGISTRY_PATH."
    pattern: "src/lib/agentic-tools-install.test.ts (existing file, additive)."
    imports: "None beyond the file's existing imports."
    compatibility: "This repo's node:test convention against built output."
    gotcha: "The existing install/no-op/update lifecycle test at line 176 asserts zero writeTextFileAtomic calls outright at line 194, counting the registry path too; the backfill case writes the registry once, so add a NEW test rather than loosening that one. (Line 149's assertion belongs to the skipped-no-format test, which is a different case.)"
    verify:
      - "Run `npm run build`."
      - "Run `node --test dist/lib/agentic-tools-install.test.js` and confirm every test passes."
    checklist:
      - "Does a test prove version equals the release tag after an install?"
      - "Does a test prove the version key is absent in the serialized registry for content with no releaseTag?"
      - "Does a test prove the backfill writes only the registry path?"
      - "Does the backfill test still assert the 'up-to-date' status?"
      - "Was the existing zero-write up-to-date test left intact?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 2.7 Re-sync the changed shapes in `electron/agentic-tools-ipc-handlers.cts`'s local mirrors
    ```yaml
    description: "Hand-sync the file's local InstallRecord and InstallContent mirrors with the two contract changes made in this stage."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In electron/agentic-tools-ipc-handlers.cts, add `version?: string;` to the local InstallRecord interface at lines 115-123 and `releaseTag?: string;` to the local InstallContent interface at lines 147-156."
      - "Change nothing else in this file in this task — the new listSkillReleases channel is task 3.2's work."
    pattern: "electron/agentic-tools-ipc-handlers.cts, the two local interface declarations only."
    imports: "None. This file must never import — value or type — from src/lib, per its own file-header rootDir rule."
    compatibility: "That file's header at lines 47-54 states the local declarations must be kept in sync by hand with their real counterparts whenever those change shape; this stage changes two of them."
    gotcha: "There is no compiler check tying these mirrors to the real interfaces, so a missed field fails silently rather than at build time — copy the field names and optionality exactly."
    verify:
      - "Run `npm run build`."
      - "Run `grep -n 'version?: string' electron/agentic-tools-ipc-handlers.cts` and confirm the match sits inside the InstallRecord interface."
    checklist:
      - "Does the local InstallRecord carry an optional version?"
      - "Does the local InstallContent carry an optional releaseTag?"
      - "Were no imports from src/lib added?"
      - "Does `npm run build` still compile the electron project?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 3. Show the latest release and the installed version

  ```yaml
  description: "Cross the releases channel over all four transports, correct the canonical skill ids, and show the latest tag and each row's installed version in the dialog."
  ```

  - [x] 3.1 Correct the canonical skill ids in `src/lib/agentic-tools-canonical-skills.ts`
    ```yaml
    description: "Replace the eight prx-* id strings with the fc-* ids the release actually ships, so the presence check probes paths the installer writes."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "First, list the top-level directory names inside the newest release's zip asset and read the eight ids from it. Never write the list from memory."
      - "The expected set is fc-orchestrate, fc-git, fc-bug-hunt, fc-issue-list, fc-dev-principles, fc-plan-feature, fc-task-list, fc-plain-text-kanban. Confirm it against the zip before writing; if the zip disagrees, use the zip's own names and record the difference in this file's ## Divergences section."
      - "In src/lib/agentic-tools-canonical-skills.ts, replace only the eight id strings inside CANONICAL_PRAXIS_SKILL_IDS at lines 13-22. Leave the array's name, its type annotation, the file's header comment and everything else exactly as they are."
    pattern: "src/lib/agentic-tools-canonical-skills.ts, the array's string literals only."
    imports: "None."
    compatibility: "PLN-72-ph4oel Scope > 'In scope by explicit decision'. The fix is limited to the id strings; the file's structure and comment stay as they are. Satisfies acceptance criterion 8."
    gotcha: "checkSkillPresence resolves each id to a real path through selectPrimaryFormat + formatForTarget, so a wrong id silently produces 'not-installed' rather than an error — the ids must match the release's directory names character for character. Task 1.13 read the same list from the same asset; the two must agree."
    verify:
      - "Run `grep -c \"'prx-\" src/lib/agentic-tools-canonical-skills.ts` and confirm it returns 0."
      - "Run `npm run build`, then `node --test dist/lib/agentic-tools-skill-presence.test.js` and confirm every test still passes (see Divergence 1 — that file uses its own fixture ids and needs no edit)."
    checklist:
      - "Were the ids read from the release zip's own top-level directory names rather than from memory?"
      - "Does the array hold exactly eight fc-* ids?"
      - "Do these ids match the list task 1.13 wrote?"
      - "Is the file's header comment unchanged?"
      - "Does the prx- grep return 0?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 3.2 Add the `listSkillReleases` IPC channel in `electron/agentic-tools-ipc-handlers.cts`
    ```yaml
    description: "New main-process channel returning PraxisIpcResult<SkillReleaseSummary[]> and taking no argument."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In electron/agentic-tools-ipc-handlers.cts, add a local `SkillReleaseSummary` interface mirroring src/lib/skill-release-fetch.ts's four fields, beside the file's other hand-mirrored types at lines 113-190."
      - "Add a `ListSkillReleasesFn` type and resolve the real function from the EXISTING skillContentModule dynamic import at lines 344-346 — the same '../lib/skill-content-fetch.js' specifier already used for getInstallContent — assigning it to a module-level `let` beside the others at lines 247-254, and assigning it beside line 348 before any ipcMain.handle registration."
      - "Register `ipcMain.handle('listSkillReleases', async (): Promise<PraxisIpcResult<SkillReleaseSummary[]>> => ...)` taking no argument, returning `{ ok: true, status: 200, data }` on success and the file's standard `{ ok: false, status: 500, error }` shape in its catch, matching the getInstallStatus handler's structure at lines 411-419."
      - "Build no URL here and accept none from the renderer: the channel takes no argument at all."
    pattern: "electron/agentic-tools-ipc-handlers.cts, the local types block, the skillContentModule dynamic-import cast, the module-level let block, and one new ipcMain.handle registration."
    imports: "None new at the top level — the function arrives through the existing dynamic import of '../lib/skill-content-fetch.js'."
    compatibility: "PLN-72-ph4oel Design > 'Transport surface'. That file must never import value or type from src/lib, per its own rootDir rule, so SkillReleaseSummary is hand-mirrored."
    gotcha: "The `let` must be assigned inside registerAgenticToolsIpcHandlers before the handle registrations, exactly like the other resolved functions, or the handler closes over an unassigned binding. Widen the existing skillContentModule cast to declare both getInstallContent and listSkillReleases rather than adding a second dynamic import of the same specifier."
    verify:
      - "Run `npm run build`."
      - "Run `grep -c 'listSkillReleases' electron/agentic-tools-ipc-handlers.cts` and confirm it is at least 4 (type, module cast, assignment, channel registration)."
    checklist:
      - "Is SkillReleaseSummary mirrored locally with all four fields?"
      - "Does the channel take no argument?"
      - "Is the function resolved through the existing skill-content-fetch dynamic import, with no second import added?"
      - "Does the handler return the file's standard PraxisIpcResult shapes on both paths?"
      - "Was no import from src/lib added?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 3.3 Expose `listSkillReleases` on the preload bridge in `electron/preload.cts`
    ```yaml
    description: "Forward the new channel through the existing praxisSkillInstallAPI contextBridge block."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        Apply this SEARCH/REPLACE block to electron/preload.cts:
        <<<<<<< SEARCH
          getInstallStatus: () => ipcRenderer.invoke('getInstallStatus'),
        =======
          getInstallStatus: () => ipcRenderer.invoke('getInstallStatus'),
          listSkillReleases: () => ipcRenderer.invoke('listSkillReleases'),
        >>>>>>> REPLACE
      - "Add no adapter and no error translation — every wrapper in this file forwards the raw PraxisIpcResult promise."
    pattern: "electron/preload.cts, the praxisSkillInstallAPI exposeInMainWorld literal only."
    imports: "None new."
    compatibility: "PLN-72-ph4oel Design > 'Transport surface'. The wrapper takes no parameter and forwards none, so the renderer cannot steer the request. No URL crosses the bridge in either direction."
    gotcha: "The channel name string must match electron/agentic-tools-ipc-handlers.cts's registration exactly — a typo fails only at runtime, with no compile error. The SEARCH anchor above is inside the praxisSkillInstallAPI block, not praxisUpdateAPI, which also deals in releases and is a plausible mis-target."
    verify:
      - "Run `npm run build`."
      - "Run `grep -o 'listSkillReleases' electron/preload.cts | wc -l` and confirm it returns 2 (method name and channel string). Do not use `grep -c` here: both occurrences sit on one line, so it counts 1."
    checklist:
      - "Is the method inside the praxisSkillInstallAPI block, not praxisAPI or praxisUpdateAPI?"
      - "Does the wrapper take and forward no argument?"
      - "Does the channel string match the handler's registration exactly?"
      - "Was no error translation added?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 3.4 Add `GET /api/integrations/releases` to `src/server.ts`
    ```yaml
    description: "HTTP mirror of the listSkillReleases channel, behind the existing loopback gate."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/server.ts, extend the existing import from './lib/skill-content-fetch.js' at line 22 to also bring in `listSkillReleases`."
      - "Add an async `handleIntegrationsReleases(res)` beside handleIntegrationsInstallsGet at lines 497-505, answering the BARE SkillReleaseSummary[] with an HTTP status — never a PraxisIpcResult envelope — and catching its own throws into `sendJson(res, 500, { error: errorMessage(err) })`, exactly as its sibling routes do."
      - "Add the route branch inside the existing `if (reqPath.startsWith('/api/integrations/'))` block at line 774, after the tools branch at lines 787-794: match `/api/integrations/releases`, answer 405 for any method other than GET, and call the handler with `void`."
      - "Add no new gate and no new exposure — the loopback check at line 782 already sits above every branch in that block."
    pattern: "src/server.ts, one import addition, one new handler function, one new route branch."
    imports: "listSkillReleases from './lib/skill-content-fetch.js', added to the existing import statement."
    compatibility: "PLN-72-ph4oel Design > 'Transport surface' and Non-functional notes. An async handler must catch its own throws: handleApi's try/catch returns before the promise settles, and an unhandled rejection takes the process down."
    gotcha: "The branch must sit INSIDE the /api/integrations/ block so it inherits the loopback gate — a branch added above that block would be reachable from any peer. The route answers the bare array because browser-ipc-shim's fetchIpc reconstructs the PraxisIpcResult envelope from the status and body. Note that fetchReleases never throws, so the catch is defensive rather than expected."
    verify:
      - "Run `npm run build`."
      - "Run `grep -n '/api/integrations/releases\\|isLoopbackRemote' src/server.ts` and confirm the route match's line number is greater than the isLoopbackRemote gate's line number inside the same block."
    checklist:
      - "Does the route answer the bare array, not a PraxisIpcResult envelope?"
      - "Does it sit inside the loopback-gated /api/integrations/ block?"
      - "Does a non-GET method get a 405?"
      - "Does the async handler catch its own throws?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 3.5 Mirror the new shapes in `src/public/lib/agentic-tools-api.ts`
    ```yaml
    description: "Browser-side type mirror gains SkillReleaseSummary, the record's optional version, and the new API method."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/public/lib/agentic-tools-api.ts, add an exported `SkillReleaseSummary` interface mirroring src/lib/skill-release-fetch.ts's four fields, beside the existing InstallResult/InstallRecord mirrors at lines 35-49."
      - "Add `version?: string;` to this file's InstallRecord mirror at lines 41-49."
      - "Add `listSkillReleases(): Promise<PraxisIpcResult<SkillReleaseSummary[]>>;` to the PraxisSkillInstallAPI interface at lines 70-76."
      - "Keep the file DOM-free and transport-free: types only, no fetch, no DOM call."
    pattern: "src/public/lib/agentic-tools-api.ts, three additive declarations."
    imports: "None new — PraxisIpcResult is already imported here from '../ipc-adapter'."
    compatibility: "PLN-72-ph4oel Design > 'Transport surface'. This file is already in src/public/tsconfig.json's include list, so no tsconfig edit is needed."
    gotcha: "Adding the method to PraxisSkillInstallAPI immediately breaks src/public/browser-ipc-shim.ts's object literal until task 3.6 lands — expect the public type-check to fail between these two tasks and land them together."
    verify:
      - "Run `npm run build` (expected to pass only once task 3.6 has also landed)."
      - "Run `grep -c 'SkillReleaseSummary' src/public/lib/agentic-tools-api.ts` and confirm it is at least 2."
    checklist:
      - "Does SkillReleaseSummary carry all four fields with the same optionality as src/lib's?"
      - "Does the InstallRecord mirror carry an optional version?"
      - "Is the method on PraxisSkillInstallAPI typed as returning PraxisIpcResult<SkillReleaseSummary[]>?"
      - "Is the file still free of DOM and fetch calls?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 3.6 Add `listSkillReleases` to `src/public/browser-ipc-shim.ts`
    ```yaml
    description: "Plain-browser-tab fallback for the new capability, over the new HTTP route."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        Apply this SEARCH/REPLACE block to src/public/browser-ipc-shim.ts:
        <<<<<<< SEARCH
            getInstallStatus: function () {
              return fetchIpc('GET', '/api/integrations/installs');
            },
        =======
            getInstallStatus: function () {
              return fetchIpc('GET', '/api/integrations/installs');
            },
            listSkillReleases: function () {
              return fetchIpc('GET', '/api/integrations/releases');
            },
        >>>>>>> REPLACE
      - "Keep the file's existing style: `function` expressions and `var`, not arrow functions."
    pattern: "src/public/browser-ipc-shim.ts, the praxisSkillInstallAPI guarded literal only."
    imports: "None new."
    compatibility: "PLN-72-ph4oel Design > 'Transport surface'. fetchIpc at lines 25-45 already reconstructs the PraxisIpcResult envelope from the status and body, which is why the server route answers the bare array."
    gotcha: "The route path string must match src/server.ts's branch exactly; a mismatch surfaces only as a 404 turned into a failed PraxisIpcResult at runtime, never as a build error."
    verify:
      - "Run `npm run build` and confirm the public type-check now passes with task 3.5's interface."
      - "Run `grep -c '/api/integrations/releases' src/public/browser-ipc-shim.ts src/server.ts` and confirm both files match it."
    checklist:
      - "Is the method inside the praxisSkillInstallAPI guard, not the praxisAPI one?"
      - "Does it use GET against /api/integrations/releases?"
      - "Does the file's existing function-expression style stay unchanged?"
      - "Does `npm run build` pass across all three tsconfig projects?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 3.7 Add the release header element to `src/public/index.html`
    ```yaml
    description: "One element inside the integrations dialog's header block for the latest release line."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/public/index.html, add exactly one element with a stable id (for example `integrations-release`) inside the #integrations-modal dialog's `.ws-modal-head` block, which opens at line 57 and closes at line 60, beside the existing #integrations-modal-title (line 58) / #integrations-modal-close (line 59) pair."
      - "Ship it with no text content — home.ts populates it at dialog open."
      - "Add nothing else to this file: no button, no extra wrapper, no new script tag."
    pattern: "src/public/index.html, the #integrations-modal .ws-modal-head block only."
    imports: "None."
    compatibility: "PLN-72-ph4oel Design > 'Renderer'. The dialog must stay fully usable when no release is found, so the element carries a short empty-state note rather than being hidden away."
    gotcha: "The close button at line 59 is a child of the same header block, and line 60 is that block's own closing `</div>`; inserting the new element after the close button changes the visual order, and inserting it after line 60 puts it outside the header entirely — place it where the header line should read, and confirm against the existing .ws-modal-head layout."
    verify:
      - "Run `npm run build`."
      - "Run `grep -c 'integrations-release' src/public/index.html` and confirm exactly one match."
    checklist:
      - "Is exactly one new element added?"
      - "Does it sit inside #integrations-modal's .ws-modal-head block?"
      - "Does it ship with no text content?"
      - "Was nothing else in the file changed?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 3.8 Populate the release header line in `src/public/home.ts`
    ```yaml
    description: "Fetch the release list at dialog open and show the first entry's tag and name, with a short empty state."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/public/home.ts, add a module-level `var latestRelease: SkillReleaseSummary | null = null;` beside integrationsSkillPresence at line 467, and import the SkillReleaseSummary type from './lib/agentic-tools-api'."
      - "Add a function that calls `skillInstallAPI()?.listSkillReleases()`, unwraps it with unwrapIpc, stores the first entry as latestRelease, and writes its tag and name into the #integrations-release element."
      - "Show a short 'No published release found' note when the list is empty, when the call fails, or when the surface is absent — the dialog must stay fully usable in every one of those cases, even though an install would now fail."
      - "Call it from the #manage-integrations-button click handler at lines 710-714, beside loadIntegrationsDetection()."
      - "Extend resetIntegrationsModalState at lines 700-708 to clear latestRelease and the header element's text, matching the existing close-resets-everything rule."
      - "Build no URL and hold no host name in this file — home.ts knows labels and joins only."
    pattern: "src/public/home.ts, the integrations dialog section: one new state variable, one loader function, the open handler, and resetIntegrationsModalState."
    imports: "The SkillReleaseSummary type from './lib/agentic-tools-api'."
    compatibility: "PLN-72-ph4oel Design > 'Renderer'. Satisfies acceptance criterion 2: the tag shown is the first entry of a list already sorted newest-first, so the renderer performs no sorting of its own. skillInstallAPI() at line 85 returns null when the surface is absent, so every caller must handle that rather than throw."
    gotcha: "Write the tag and name with textContent, never innerHTML — the values come from a remote API. Do not re-sort the list in the renderer: parseReleases already sorted it, and a second sort here would be a duplicated rule that can drift. The empty state is now also a warning sign that an install will fail, but this task adds no alert for it — the failure message the install path throws is the user-facing one."
    verify:
      - "Run `npm run build`."
      - "Run `grep -c 'innerHTML' src/public/home.ts` and confirm it still returns 12, the count at base_commit 2046996."
    checklist:
      - "Is the header populated from the FIRST entry of the returned list, with no client-side sort?"
      - "Do an empty list, a failed call and an absent surface all show the short empty-state note?"
      - "Does resetIntegrationsModalState clear both latestRelease and the header text?"
      - "Are the tag and name written with textContent?"
      - "Does this file still contain no URL and no host name?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 3.9 Join install records and show each row's version in `src/public/home.ts`
    ```yaml
    description: "Call getInstallStatus at dialog open, match records on toolId and scope, and render a per-row version chip."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/public/home.ts, add a module-level records map (toolId plus scope key to InstallRecord) beside integrationsSkillPresence at line 467, populated at dialog open from `skillInstallAPI()?.getInstallStatus()` through unwrapIpc."
      - "Match records on BOTH toolId and the current scope, so the join is correct at Global and Project scope alike and needs no extra call on a scope toggle."
      - "Add the label constants beside the existing INSTALL_STATUS_LABEL / ALREADY_INSTALLED_LABEL / INCOMPLETE_INSTALL_LABEL block at lines 423-439: `VERSION_LABEL_PREFIX = 'v'` and `UNKNOWN_VERSION_LABEL = 'Version unknown'`."
      - "Add a `versionChip` element reference to IntegrationsRowEntry at lines 441-451, create it in buildIntegrationsRow at lines 469-498 reusing the existing `.chip` class, and set its text in applyIntegrationsRowEligibility at line 502 from the matched record: the record's version when present and parseable, otherwise UNKNOWN_VERSION_LABEL."
      - "Extend resetIntegrationsModalState at lines 700-708 to clear the records map and the new chip, matching the existing close-resets-everything rule."
      - "Change nothing about the skill-presence chip's Global-scope-only gate at lines 517-523 — that limitation stays exactly as it is (PLN-72-ph4oel Out of scope)."
    pattern: "src/public/home.ts, the integrations dialog section: the label block, IntegrationsRowEntry, buildIntegrationsRow, applyIntegrationsRowEligibility, the dialog-open path, and resetIntegrationsModalState."
    imports: "The InstallRecord type from './lib/agentic-tools-api'."
    compatibility: "PLN-72-ph4oel Design > 'Renderer'. getInstallStatus was deliberately dropped from this file earlier for the 'Already installed' chip (see the comment at lines 430-435); re-adding it here is for versions only and must not restore the old ledger-based presence join. Satisfies acceptance criteria 3 and 6's display half, and Assumption 4's 'Version unknown' behaviour."
    gotcha: "A record with no version, or a version the semver rule cannot read, must show 'Version unknown' and never an empty chip — this is Assumption 4's stated contract, and it is the normal state for every pre-feature record until task 2.5's backfill runs. The scope key must include the project path for a project-scoped record, or two projects' records collide."
    verify:
      - "Run `npm run build`."
      - "Run `grep -c 'UNKNOWN_VERSION_LABEL' src/public/home.ts` and confirm it is at least 2 (declaration and use)."
    checklist:
      - "Are records matched on both toolId and the current scope, including the project path?"
      - "Do both new label constants sit beside the existing label block?"
      - "Does a missing or unreadable version show UNKNOWN_VERSION_LABEL?"
      - "Does the version chip reuse the existing .chip class?"
      - "Does resetIntegrationsModalState clear the records map and the chip?"
      - "Is the skill-presence chip's Global-scope-only gate untouched?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 3.10 Verify the release header, version chips and "Already installed" by hand
    ```yaml
    description: "Manual renderer check for stage 3, since this repo has no renderer test framework."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run `npm run build`, start the app, and open Manage Integrations against a DISPOSABLE install target, never a real tool config directory."
      - "Confirm the dialog header shows the latest release's tag and name, proving acceptance criterion 2."
      - "Install one row, reopen the dialog, and confirm that row shows its version chip carrying the release tag, proving acceptance criterion 3's display half."
      - "Confirm a row whose canonical skills are already present on disk shows 'Already installed', proving acceptance criterion 8 and task 3.1's id correction."
      - "Toggle the scope segment between Global and Project and confirm the version chip stays correct at both, with no extra fetch needed."
      - "Confirm a row with no install record shows 'Version unknown' and that the dialog stays fully usable when the release list is empty."
      - "Repeat the header check in a plain browser tab as well as in Electron, so both transports are exercised — route and channel parity has no automated coverage today."
    pattern: "No source file is edited by this task. It is the stage's manual acceptance gate."
    imports: "None."
    compatibility: "PLN-72-ph4oel Testing strategy: the renderer has no test framework in this repo, and route/channel parity is verified by hand against both transports. Satisfies acceptance criteria 2, 3 and 8."
    gotcha: "Exercise BOTH transports. The Electron preload path and the browser-ipc-shim path are wired separately, and the plan names the four-place transport wiring drifting out of sync as a top risk — a check in only one of them would miss exactly that failure."
    verify:
      - "Open the dialog in Electron and record the tag shown in the header."
      - "Open the same dialog in a plain browser tab against `npm start` and confirm the header shows the same tag."
      - "Record both observations in this task's self_eval."
    checklist:
      - "Does the dialog header show the latest release tag and name?"
      - "Does an installed row show its recorded version?"
      - "Does an already-present row show 'Already installed'?"
      - "Does the version chip stay correct across a scope toggle?"
      - "Do both the Electron and the browser-tab transports show the same header?"
    self_eval:
      passed: true
      failures: []
      observations:
        - "Browser tab, npm start: the header read 'v0.1.0 — FlowCharge v0.1.0'."
        - "Electron: the same header read 'v0.1.0 — FlowCharge v0.1.0'. The window could not take synthetic clicks on this machine, so the renderer was driven over the Chrome DevTools Protocol instead (electron . --remote-debugging-port=9222). window.praxisSkillInstallAPI.listSkillReleases() returned the real preload result, and clicking #manage-integrations-button through the protocol produced the same header and the same chips as the browser tab."
        - "The disposable install target was a temporary HOME under the session scratchpad, holding a .claude/ directory. Claude Code detected as 'confirmed' against it, and the install wrote the eight fc-* skills there. The real ~/.claude/skills was never written to."
        - "After the install, .praxis-installs.json recorded version 'v0.1.0', and reopening the dialog showed that row's chip as 'v0.1.0' beside 'Already installed'. The registry file did not exist before this check and was deleted after it."
        - "A row with no install record showed 'Version unknown'. A Global-to-Project scope toggle left the version chip correct with no second fetch, and the 'Already installed' chip stayed Global-only, as its untouched gate requires."
    ```

- [x] 4. Update detection and one-click update

  ```yaml
  description: "Compare the recorded version against the latest release tag, show an 'Update available' chip, and install the latest release for one row from a per-row 'Update' button."
  ```

  - [x] 4.1 Add the version comparison and the "Update available" chip in `src/public/home.ts`
    ```yaml
    description: "Show an 'Update available' chip on a row whose recorded version is older than the latest release tag."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/public/home.ts, add `UPDATE_AVAILABLE_LABEL = 'Update available'` beside the label constants added in task 3.9."
      - "Add a file-local pure comparison helper inside this file's IIFE, semantically identical to src/lib/update-check.ts's parseSemver/isNewer at lines 52-71: accept an optional leading 'v', read MAJOR.MINOR.PATCH, ignore whatever follows the patch number, and return false whenever either side is unreadable. See Divergence 2 for why the src/lib function cannot be imported here."
      - "Add an `updateChip` element reference to IntegrationsRowEntry, create it in buildIntegrationsRow reusing the existing `.chip` class, and show it in applyIntegrationsRowEligibility only when the latest release's tag is strictly newer than that row's recorded version."
      - "Hide the chip whenever the record is absent, its version is absent, either version is unreadable, or the versions are equal — an unreadable version must never prompt an update (Assumption 4)."
      - "Extend resetIntegrationsModalState to clear the new chip."
    pattern: "src/public/home.ts, the label block, IntegrationsRowEntry, buildIntegrationsRow, applyIntegrationsRowEligibility and resetIntegrationsModalState."
    imports: "None new."
    compatibility: "PLN-72-ph4oel Summary's version-comparison rule and Design > 'Renderer'. Satisfies acceptance criteria 4 and 6. Assumption 3 keeps comparison semver-only, and Open Question 3 settles it as semver-only, so no second comparison rule for arbitrary tag formats is added."
    gotcha: "Comparison must be strict: an equal tag shows the version chip and NO update chip, which is acceptance criterion 6's exact wording. Do not add a second rule for non-semver tags."
    verify:
      - "Run `npm run build`."
      - "Run `grep -c \"from './lib/update-check\\|from '../lib/\" src/public/home.ts` and confirm it returns 0, proving no src/lib import was introduced into the renderer bundle."
    checklist:
      - "Does an older recorded version show the 'Update available' chip?"
      - "Does an equal version show no update chip?"
      - "Does an absent or unreadable version show no update chip?"
      - "Does the helper match update-check.ts's semantics, including the tolerated leading 'v'?"
      - "Does resetIntegrationsModalState clear the update chip?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "parseSemver already landed in task 3.9, so only isNewer was added on top of it, matching src/lib/update-check.ts:63-71 exactly."
        - "The chip is derived state, so resetIntegrationsModalState clears it by clearing its only two inputs — latestRelease and integrationsInstallRecords — and by tearing down the rows that own the chip. No per-chip clear was added, because it would run after integrationsRowEntries = [] and be dead code."
        - "npm run build passed; the grep for a src/lib import in src/public/home.ts returned 0."
        - "Task 4.5 found that the chip needs a second render hook: loadLatestRelease sets latestRelease but never re-derived the rows, so it raced the record and detection fetches. A trailing .then(refreshIntegrationsEligibility) was added to loadLatestRelease as part of this task's fix. See task 4.5's self_eval failures entry."
    ```
  - [x] 4.2 Let the install call take an explicit row list in `src/public/home.ts`
    ```yaml
    description: "Refactor installIntegrationsSelected so the same code path can install one named row as well as every checked row."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/public/home.ts, change installIntegrationsSelected at line 651 to take an explicit array of IntegrationsRowEntry and perform the install for exactly those entries."
      - "Keep the existing button behaviour by passing the currently checked, eligible entries from the #integrations-install-selected click handler at lines 752-754 — the filtering at lines 663-666 moves to the caller, the install body does not change."
      - "Leave the rest of the body as it is: the absent-surface alert at lines 654-661, the resolveBasePathForScope mapping at line 671, the installChip rendering at lines 682-684, `hasLiveResult = true`, the failure alert at lines 687-689, and the trailing updateInstallSelectedButtonState() at lines 690-692."
      - "Change no observable behaviour for the existing button in this task."
    pattern: "src/public/home.ts, installIntegrationsSelected and its existing click handler."
    imports: "None new."
    compatibility: "PLN-72-ph4oel Design > 'Renderer': the Update button must render its result onto the same installChip path a normal install uses, so hasLiveResult keeps its current meaning."
    gotcha: "installIntegrationsSelected currently disables the shared #integrations-install-selected button while running; that stays correct for the batch path, and task 4.3 must not leave it disabled after a single-row update — the trailing updateInstallSelectedButtonState() call already handles it, so keep it. The failure alert at line 688 is now also the surface for the release-missing errors task 1.9 throws, so its message text must keep passing `err.message` through unchanged."
    verify:
      - "Run `npm run build`."
      - "Run `grep -n 'installIntegrationsSelected' src/public/home.ts` and confirm the function takes a parameter and every call site passes one."
    checklist:
      - "Does the function take an explicit entries array?"
      - "Does the existing button still install exactly the checked, eligible rows?"
      - "Are the chip rendering, hasLiveResult and alert paths unchanged?"
      - "Does the alert still show err.message verbatim?"
      - "Does the trailing updateInstallSelectedButtonState() call remain?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "Line numbers in implement were stale after tasks 3.x; the function now sits at src/public/home.ts:813 and its click handler at 918-925. Anchors were resolved by symbol, as spec mode allows."
        - "The absent-surface alert, the target mapping, the chip rendering, hasLiveResult, the err.message alert and the trailing updateInstallSelectedButtonState() are all unchanged."
        - "npm run build passed; grep shows one definition taking a parameter and one call site passing the checked, eligible rows."
    ```
  - [x] 4.3 Add the per-row "Update" button in `src/public/home.ts`
    ```yaml
    description: "A row-level button that installs the latest release for that row alone and clears its update prompt."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/public/home.ts, add an `updateButton` element reference to IntegrationsRowEntry and create the button in buildIntegrationsRow, shown only when that row's 'Update available' chip is shown and hidden whenever it is hidden — drive both from the same condition in applyIntegrationsRowEligibility."
      - "Wire its click to task 4.2's install function with exactly that one entry, so the result lands on the same installChip path a normal install uses."
      - "After a successful single-row install, set that row's recorded version to the latest release tag in the records map, re-render its version chip, and hide the update chip and the button."
      - "On failure, keep today's behaviour: the existing alert path reports the error and the row keeps its previous chips."
      - "Give the button an aria-label naming the row's tool, matching the per-row accessibility pattern the checkbox at lines 472-476 already uses."
    pattern: "src/public/home.ts, IntegrationsRowEntry, buildIntegrationsRow and applyIntegrationsRowEligibility."
    imports: "None new."
    compatibility: "PLN-72-ph4oel Design > 'Renderer' and the 'Update an older install' key flow. Satisfies acceptance criterion 5."
    gotcha: "A row that is ineligible at the current scope cannot be installed, so the Update button must respect the same eligibility gate the checkbox does, or clicking it produces a refused install path error from the transport. Set the row's recorded version from the SUCCESS branch only — a rejected install must leave the map untouched."
    verify:
      - "Run `npm run build`."
      - "Run `grep -c 'updateButton' src/public/home.ts` and confirm the reference, its creation and its visibility toggle are all present."
    checklist:
      - "Does the button install exactly one target, for its own row?"
      - "Does the row show the new version and no 'Update available' chip after a successful update?"
      - "Does a failed update leave the row's previous chips in place?"
      - "Is the button hidden whenever the update chip is hidden?"
      - "Does the button respect the row's eligibility at the current scope?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "buildIntegrationsRow now builds the entry into a local before returning it, because the click handler must close over that entry to pass [entry] to the install call."
        - "Eligibility is applied as `updateButton.disabled = !eligible`, not by hiding the button. That is exactly how the checkbox expresses the same gate, and it keeps visibility driven by the single update condition the task requires."
        - "The success-branch version write sits in the shared results loop, not in a single-row-only branch. A batch install of the same row installs the same newest release, so a single-row-only write would leave that row showing a stale version when it is updated by checkbox instead of by button. 'skipped-no-format' is excluded, since it installs nothing."
        - "The write mutates an existing record only. The Update button appears only for rows that already have a record with a readable version, so this branch always has one; a first-ever install of a row with no record keeps today's behaviour."
        - "npm run build passed; grep -c 'updateButton' returned 10, covering the type key, the creation, the entry key, the click wiring and both visibility lines."
    ```
  - [x] 4.4 Style the new Update button in `src/public/styles.css`
    ```yaml
    description: "Add only the rules the per-row Update button needs, reusing the existing chip styling for both chips."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/public/styles.css, inside the '---------- Manage integrations dialog ----------' section at line 932, add only the rule(s) the new per-row Update button needs, following the existing .integrations-row / .integrations-actions rules' style."
      - "Add no chip rule: both new chips reuse the existing .chip class."
      - "Change no existing rule and add no rule outside that section."
    pattern: "src/public/styles.css, the Manage integrations dialog section only."
    imports: "None."
    compatibility: "PLN-72-ph4oel Design > 'Renderer': styles.css gains only what the new button needs. Use the existing CSS custom properties (--line, --ink, --paper-raised and siblings) rather than literal colours, so both themes stay correct."
    gotcha: "The section's own header comment states that this dialog reuses .chip and .seg entirely — adding a chip rule here would contradict it and drift the two chip styles apart."
    verify:
      - "Run `npm run build`."
      - "Run `git diff --stat src/public/styles.css` and confirm only the integrations section changed, with no deletions of existing rules."
    checklist:
      - "Is the new rule inside the Manage integrations dialog section?"
      - "Was no chip rule added?"
      - "Are colours taken from the existing custom properties only?"
      - "Was no existing rule modified or removed?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "Added .integrations-row-update and its :hover, :disabled and :focus-visible rules only, directly after .integrations-row-note inside the Manage integrations dialog section."
        - "No chip rule was added; both new chips use the existing .chip class, as the section's header comment requires."
        - "Colours come only from --line-strong, --paper-raised, --ink, --ink-faint and --accent, each defined in both the light and the dark token block, so no literal colour was introduced."
        - "No display property is set, so the button's hidden attribute still removes it from the row."
        - "npm run build passed; git diff --stat shows 15 insertions and 0 deletions in src/public/styles.css."
    ```
  - [x] 4.5 Verify the one-click update by hand
    ```yaml
    description: "Manual renderer check that an older recorded version offers an update, installs it, and clears the prompt."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run `npm run build`, start the app, and open Manage Integrations against a DISPOSABLE install target, never a real tool config directory."
      - "Produce an older recorded version for one row — for example by hand-editing that record's `version` in .praxis-installs.json to a lower semver tag — then reopen the dialog."
      - "Confirm the row shows its recorded version, an 'Update available' chip and an 'Update' button, proving acceptance criterion 4."
      - "Click 'Update' and confirm only that row installs, then confirm the row shows the new version and no 'Update available' chip, proving acceptance criterion 5."
      - "Set a second row's recorded version equal to the latest release tag and confirm it shows its version and no 'Update available' chip, proving acceptance criterion 6."
      - "Confirm a record with an unreadable or absent version shows 'Version unknown' and offers no Update button, proving Assumption 4."
      - "Confirm a failed update — for example with the host unreachable — reports the thrown message in the alert and leaves the row's previous chips in place."
    pattern: "No source file is edited by this task. It is the stage's manual acceptance gate."
    imports: "None."
    compatibility: "PLN-72-ph4oel Testing strategy: stages 3 and 4 are verified by hand against a disposable install target, never a real tool config directory. Satisfies acceptance criteria 4, 5 and 6."
    gotcha: "Hand-editing .praxis-installs.json is the only practical way to produce an older version while only one release exists. Restore or delete the edited record afterwards, so a fabricated version does not survive into later manual checks."
    verify:
      - "Record, in this task's self_eval, the version shown before the update, the version shown after it, and whether the chip cleared."
      - "Confirm the hand-edited registry record was restored or removed afterwards."
    checklist:
      - "Did an older recorded version show both the chip and the Update button?"
      - "Did clicking Update install that row alone?"
      - "Did the row then show the new version with no 'Update available' chip?"
      - "Did an equal version show no update prompt?"
      - "Did a failed update leave the previous chips in place?"
      - "Was the hand-edited registry record cleaned up?"
    self_eval:
      passed: true
      failures:
        - item: "Did an older recorded version show both the chip and the Update button?"
          reason: "On the first run the row showed 'v0.0.1' but no 'Update available' chip and no button. loadLatestRelease set latestRelease and never re-derived the rows, so it raced loadIntegrationsInstallRecords and loadIntegrationsDetection. Whenever the release call resolved last, the update chip was silently dropped."
          fix: "Added a trailing .then(refreshIntegrationsEligibility) to loadLatestRelease in src/public/home.ts, so the release fetch re-derives every row whichever of the three fetches finishes last. It runs on the empty-list and failure paths too, so a release that went away also clears the prompt. Re-verified: the chip and the button then appeared."
      observations:
        - "Browser tab, node dist/server.js on port 4188 with HOME pointed at a disposable directory under the session scratchpad holding a .claude/ directory. The real ~/.claude was never written to."
        - "Header read 'v0.1.0 — FlowCharge v0.1.0'. A first install of Claude Code wrote the registry record with version 'v0.1.0'."
        - "Criterion 4: with the record hand-edited to 'v0.0.1', the row showed 'Already installed', 'v0.0.1', 'Update available' and an enabled Update button carrying aria-label 'Update Claude Code'."
        - "Criterion 5: clicking Update left the row showing 'Up to date', 'v0.1.0', no 'Update available' chip and a hidden button. Only that row installed — the registry's claude-code updatedAt moved to 13:49:37Z while the opencode record stayed at 13:48:06Z."
        - "Criterion 6: a second record set equal to 'v0.1.0' showed its version chip and no update chip."
        - "Assumption 4: an unreadable version ('nightly') and an absent version both showed 'Version unknown' with no Update button."
        - "Failure path: with the server stopped, clicking Update alerted \"Couldn't install the selected tools. Detail: Failed to fetch\" and the row kept 'Already installed', 'v0.0.1' and 'Update available' unchanged."
        - "Cleanup: .praxis-installs.json was deleted (it did not exist before this check) and the disposable HOME was removed."
    ```

## Divergences

1. **The skill-presence test never reads the canonical id list.** PLN-72-ph4oel's Testing
   strategy assumes that correcting `CANONICAL_PRAXIS_SKILL_IDS` changes an expectation in
   `src/lib/agentic-tools-skill-presence.test.ts`. That file defines its own fixture ids
   instead — `['prx-alpha', 'prx-beta', 'prx-gamma']` at line 83 and
   `['prx-orchestrate', 'prx-git']` at line 143, read at commit 2046996 — and never imports
   the constant. Consequence: no test task is authored for that file. Task 3.1 changes the
   constant alone, and its verify step runs the existing presence tests unchanged as a
   regression check.

2. **The renderer cannot import `src/lib/update-check.ts`.** An earlier revision of
   PLN-72-ph4oel's Summary stated that comparison *reuses* the pure `isNewer`/`parseSemver`
   at `src/lib/update-check.ts:52-71`, which is not achievable; the plan was corrected on
   2026-08-30 to state a file-local re-authoring instead, and this entry records the finding
   that forced that correction. The renderer is compiled by
   `src/public/tsconfig.json`, which sets `"types": []` and `"lib": ["dom", "es2020"]`, and
   `update-check.ts` uses the Node-only `Buffer` global at lines 98, 110 and 116, so an
   import from `home.ts` fails `npm run build`'s public type-check; esbuild would also bundle
   that module's fetch code into the page script. No file in `src/public/` imports from
   `src/lib/` today — the codebase mirrors shapes into `src/public/lib/` instead.
   Consequence: task 4.1 authors the comparison as a file-local pure helper inside
   `home.ts`'s IIFE with semantics identical to `update-check.ts`'s. No module is added to
   `src/lib`, and `update-check.ts` is not modified.

3. **`getInstallContent` stops conforming to the `GetInstallContent` port.**
   PLN-72-ph4oel's Design gives `getInstallContent` a required second `deps` parameter. An
   earlier revision said nothing about the port type it currently satisfies; the plan was
   corrected on 2026-08-30 to state this consequence outright, and this entry records the
   finding and the evidence behind it.
   `src/lib/agentic-tools-content.ts:26` declares
   `GetInstallContent = (toolId: string) => Promise<InstallContent>`, and
   `src/lib/skill-content-fetch.ts:7` and `:13` state in prose that this module's
   `getInstallContent` is assignable to that port with no adapter. After the change it is
   not: a two-required-parameter function is not assignable to a one-parameter function
   type. Read at commit 2046996, the port's only consumer is `installAllGlobal`
   (`src/lib/agentic-tools-install.ts:139-158`), which is exercised only by
   `src/lib/agentic-tools-install.test.ts` with an inline lambda, so no production call site
   breaks and no compile error results. Consequence: task 1.9 rewrites
   `skill-content-fetch.ts`'s header comment so the stale claim does not survive.
   `GetInstallContent` and `installAllGlobal` are left untouched, since PLN-72-ph4oel's Out
   of scope forbids changes beyond the named surfaces.

4. **The live-network test breaks in two ways, and its tier (a) is deleted outright.**
   An earlier revision of PLN-72-ph4oel named the `parseTar` test removal but not the live
   tier (c) that also breaks; the plan was corrected on 2026-08-30 to name both, and this
   entry records the finding and the evidence behind it. Read at commit 2046996,
   `src/lib/skill-content-fetch.test.ts:112` calls `getInstallContent('claude-code')` with
   one argument, which becomes a compile error once task 1.9 adds the required `deps`
   parameter; and lines 100-109 plus 124-148 assert eight `prx-*` ids and
   `prx-orchestrate`'s nested file list, which the release zip does not ship. The
   `assert.equal(content.version, 'fetched-from-git')` assertion at line 114 does NOT break,
   because PLN-72-ph4oel leaves that literal in place on the release path. The file's
   `parseTar` import at line 15 also breaks once task 1.10 deletes the function.
   Consequence: task 1.13 covers all of it in one edit — deleting tier (a) and its two
   fixture helpers, and re-pointing tier (c) — and the build stays red between tasks 1.9 and
   1.13.

5. **The Gitea host currently publishes exactly one release, and it carries a zip asset.**
   PLN-72-ph4oel's Assumptions 2 and 6 rest on the newest published release always carrying
   a `.zip` asset. Read live at authoring time, the releases API at
   `http://100.87.185.97:8110` returns one entry: `v0.1.0`, neither draft nor prerelease,
   published 2026-08-29, carrying the asset `flowcharge-skills-0.1.0.zip`. Its
   `browser_download_url` uses hostname `netplex`, exactly as the plan's
   `buildAssetDownloadUrl` reasoning states. Consequence: the release-only design is
   executable today, and tasks 1.13 and 3.1 can read the eight skill ids from a real asset
   rather than recording a divergence. The zip's own top-level directory names were NOT
   opened at authoring time, so both tasks still require that read before writing any id
   list.

6. **Review pass on 2026-08-30, after this list was authored.** Every file and line
   PLN-72-ph4oel and this list cite was re-checked against the working tree. Three anchors
   in this list were corrected in place: task 1.10 quoted `PRAXIS_REPO_REF = 'master'` when
   the working tree reads `'main'` — ISS-23-22bcfg's fix is applied on disk but is NOT in
   base_commit 2046996, so this list's base commit and the working tree disagree on that one
   line, and every other line number below still matches both; tasks 1.3, 2.5 and 2.6
   pointed at line 149 for the up-to-date no-op test, which is the skipped-no-format test —
   the real lifecycle test starts at line 176 and asserts at line 194; and task 3.7 cited
   the `.ws-modal-head` block as lines 58-61 with the close button at line 60, when the
   block is lines 57-60 and the close button is line 59. Two verify commands that could not
   pass as written were corrected: task 1.1's `grep -n 'BinaryFile'` (three matches, not
   two, because its own REPLACE block adds a comment) and task 3.3's `grep -c` (one line
   carries both occurrences). In PLN-72-ph4oel itself, four citations and claims were
   corrected: the electron catch at 405-407 rather than 404-406, the tarball-test range,
   the `isNewer` reuse claim, and the `node:crypto` import.

7. **Tasks 3.9 and 3.10 disagreed on the version chip for a row with no record.**
   Task 3.9 said to set the chip "from the matched record", which reads as no chip at
   all when no record matches. Task 3.10's own acceptance bullet and checklist say a row
   with no install record must show 'Version unknown'. Read at execution time on
   2026-08-30, nothing else in the list or in PLN-72-ph4oel settles the case.
   Consequence: the chip in `src/public/home.ts`'s
   `applyIntegrationsRowEligibility` is always visible and never empty — no record at
   all, a record with no version, and a version the semver rule cannot read all read
   'Version unknown'. That satisfies both tasks. Task 4.3 must therefore gate its
   Update button on a parsed version, not on the chip being present.

8. **`parseSemver` was authored in stage 3 rather than in task 4.1.** Divergence 2
   states that the comparison is re-authored file-locally inside `home.ts`, and task 4.1
   owns it. Task 3.9 nevertheless requires the chip to distinguish a "parseable" version
   from an unreadable one, which needs the parser one stage early. Consequence:
   `SEMVER_RE` and `parseSemver` now sit beside the label constants in
   `src/public/home.ts`, with semantics identical to
   `src/lib/update-check.ts:52-58`. Task 4.1 adds `isNewer` on top of this helper and
   must not author a second parser.

Every other file and line PLN-72-ph4oel cites matched its stated anchors at commit 2046996
and still matches the working tree.
