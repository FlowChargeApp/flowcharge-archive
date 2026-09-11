---
id: PLN-88-tpbc8f
type: plan
workstream: WS-106-1xers0
slug: skill-install-target-resolution-and-lifecycle
title: "Check skill presence against the published release, not a hand-kept id list"
status: ready
created: 2026-09-11
updated: 2026-09-11
depends_on: []
links: [ISS-42-q1t9bh]
---

# Check skill presence against the published release, not a hand-kept id list

## Summary

The "Missing skills" chip in the Manage-integrations modal compares the target directory
against `CANONICAL_PRAXIS_SKILL_IDS`, a hand-maintained array in
`src/lib/agentic-tools-canonical-skills.ts`. A hand-kept list drifts at the next skill
rename or addition, and nothing detects the drift.

This plan replaces that array with a list derived, on every request, from the newest
published FlowCharge Core release — the same content `getInstallContent` writes when the
user installs. The presence check then compares disk against exactly what the installer
would put there, and it follows every future release with no source edit in this repo.

The release is chosen because it is the only source that is neither circular, barred, nor
hand-kept. A disk-derived source would test disk against itself. The install ledger is
barred by the presence module's own documented independence from it. Vendoring the suite
into this repo is `WS-44-h5cpzp`, whose record carries `status: dropped`.

## Scope

### Acceptance criteria

1. `POST /api/integrations/skill-presence` resolves its expected skill id list from the newest published release on every request, never from a hardcoded array, the install ledger, or the probed directory's own contents.
2. `CANONICAL_PRAXIS_SKILL_IDS` no longer exists, and no hand-kept skill id list remains on the presence path.
3. For Claude Code at global scope, the row shows "Already installed" exactly when every skill id in the newest published release has a `skills/<id>/SKILL.md` file under `~/.claude/`, and "Missing skills" when at least one but not all are absent.
4. The same statement holds for OpenCode at global scope under `~/.config/opencode/`.
5. A skill added to, removed from, or renamed in a newly published release changes the chip on the next modal open, with no source edit in this repo.
6. When the release cannot be resolved, or resolves to zero skills, the route answers an error and the row's chip stays hidden — never "Already installed".
7. `SkillPresenceResult`'s wire shape is unchanged, so `src/public/browser-ipc-shim.ts`, `src/public/home.ts` and `checkSkillPresence`'s own signature need no contract change.
8. `npm test` passes.

### Out of scope

- Widening `checkSkillPresence` to project scope. `ISS-42-q1t9bh` records that as a separate accepted limit.
- Publishing a current FlowCharge Core release, and any change to `PRAXIS_REPO_BASE_URL`.
- Vendoring skill content into this repo. `WS-44-h5cpzp` is dropped.
- Any edit under `electron/`. See Open question 3.
- Broader Manage-integrations modal test coverage, which a separate workstream owns.
- Renaming any `praxis`-named identifier.

### Assumptions

1. The newest published release at `PRAXIS_REPO_BASE_URL` defines the real suite. `src/lib/skill-content-fetch.ts:1-5` already makes that release the installer's only content source, so presence and install agree by construction.
2. That release is `v0.1.0`. Its asset `flowcharge-skills-0.1.0.zip` carries exactly `fc-bug-hunt`, `fc-dev-principles`, `fc-git`, `fc-issue-list`, `fc-orchestrate`, `fc-plain-text-kanban`, `fc-plan-feature` and `fc-task-list` — the same eight ids the hand-kept array names. The array is not yet out of step with the release; the machine's disk is ahead of the release, because the current suite arrived by a hand sync and not through this installer. This fix therefore changes no chip today. It removes the hand-maintenance step and makes the check follow the next release automatically. See Open question 2.
3. A presence request may fetch the release. No cache is added. The catalogue holds four tools, only detected tools are probed, and the asset measures 160 KB.
4. When the release cannot be resolved, the row's chip is hidden with no new message. This matches the existing per-probe failure path at `src/public/home.ts:795-801`.
5. The fix lands at the one shared route call site, so every catalogue tool's chip uses the corrected list. Only Claude Code and OpenCode at global scope are acceptance-verified.
6. There is no production data and there are no live users to protect. The app is a loopback CLI, this change persists nothing, and rollback is a revert of one commit.
7. No new runtime dependency. Every module used is already in the repo.

## Key flows

**Presence chip on modal open** — **Actor:** the user opening Manage integrations.
**Preconditions:** the scope selector is at Global, and at least one catalogue tool is
detected with a resolved config directory. **Main flow:** `loadIntegrationsDetection`
renders the rows, then posts one `checkInstalledSkills` request per detected row; each
request resolves the newest published release's skill ids server-side, probes
`skills/<id>/SKILL.md` under that tool's base path, and answers a `SkillPresenceResult`.
**Outcome:** each row shows "Already installed", "Missing skills", or no chip.
**Edge cases:** the release host is unreachable, the release list is empty, the newest
release carries no `.zip` asset, or the asset decodes to zero skills — each answers a 500,
the browser's per-probe catch records no presence entry, and that row's chip stays hidden
while every other row keeps its own result. Project scope shows no chip at all, unchanged.

## Design

### New contract

`src/lib/agentic-tools-canonical-skills.ts` is rewritten. It imports nothing.

```ts
export interface PublishedSuite {
  skills: { id: string }[];
}

export async function resolveCanonicalSkillIds(
  fetchSuite: () => Promise<PublishedSuite>,
): Promise<string[]>;
```

It returns the fetched suite's ids in the order the suite reports them;
`getInstallContent` already sorts its `skills` by id ascending. It throws an `Error` with a
named message when that array is empty, because an empty expected list would make
`checkSkillPresence` answer `fully-installed` with nothing checked. It never catches a
`fetchSuite` rejection.

The module knows two things: that a published suite is a list of skills carrying ids, and
that an empty suite is not an answer. It must NOT know HTTP, status codes, the release
host, the zip container, the filesystem, the install ledger, tool ids, install targets, or
any user-facing chip wording. Taking the fetcher as a parameter is what keeps it
import-free and unit-testable without a network.

### Changed call site

`handleIntegrationsSkillPresence` in `src/http/routes-integrations.ts:205` replaces its
`CANONICAL_PRAXIS_SKILL_IDS` argument with the ids
`resolveCanonicalSkillIds` returns, fetched through
`getInstallContent('', { fsWrite: deps.fsWrite })` — the same call shape the install route
already uses at `src/http/routes-integrations.ts:305`. The import of
`CANONICAL_PRAXIS_SKILL_IDS` is removed. The handler's existing `try`/`catch` turns any
throw into the route's 500, so no new error path is added. `IntegrationsDeps` is unchanged:
`fsWrite` is already a field, and the composition root needs no edit.

### Unchanged by design

`src/lib/agentic-tools-skill-presence.ts` keeps its signature, its read-only `FsAccess`
contract, and its documented independence from `agentic-tools-install-tracking.ts`. It
keeps receiving ids only, never the fetched `InstallContent`: the stub it builds at
`src/lib/agentic-tools-skill-presence.ts:47-51` must carry no `files`, or
`skillDirectoryWrites` would emit extra writes and break the `writes[i]` to `skillIds[i]`
alignment its comment at `:55-58` depends on.

`src/public/home.ts:629-634` needs no change. `SkillPresenceResult` and both chip labels
keep their meaning, and an absent presence entry already hides the chip.

### Path-segment safety

The ids now come from the network and reach `path.join(basePath, ...)` inside
`checkSkillPresence`. `mapEntriesToSkills`'s `isExcluded` at
`src/lib/skill-content-fetch.ts:86-90` already drops any entry whose first segment carries
`/`, `\` or `:`, is `..`, or starts with `.`, so no id can escape the base path. No new
guard is added; a unit case pins the existing one.

### Non-functional notes

Performance: a presence request costs one release fetch, one temporary file, and one unzip,
against at most four probed rows per modal open and a 160 KB asset. No cache is added, per
the read-path rule. Security: no new outbound host, and the probe stays read-only.
Observability: an unresolvable release surfaces as a route 500 and a hidden chip; the
per-probe catch at `src/public/home.ts:795-801` keeps one failure from clearing the other
rows.

## Stages

1. **Presence compares against the published release.** Rewrite the canonical-skills module
   to the contract above, wire the presence route to it, refuse an empty suite, and repair
   the one existing case in `src/test/unit/server.test.ts:85-95` that the change
   invalidates, so the suite stays green. It holds this position because it carries every
   risk in the change: a read path gains a live network dependency and the chip's meaning
   changes. Observable at the end: each detected row's chip reports the release-versus-disk
   comparison, and no chip appears when the release cannot be reached.
2. **Lock the new source with unit coverage.** Cover the derivation, the empty-suite
   refusal, error propagation, the Claude Code and OpenCode global path shapes, and the
   id-segment filtering the content mapper provides. It holds this position because it pins
   behaviour stage 1 must first make real. Observable at the end: `npm test` green, with
   the new cases failing against the pre-change code.

## Data & compatibility

Nothing persisted changes. `.praxis-installs.json` and its record shape are untouched, and
no migration is needed. The `SkillPresenceResult` wire shape is unchanged, so the browser
shim and the modal stay compatible with an older or newer server. Rollback is a revert of
the single commit; nothing survives it. The Electron `checkInstalledSkills` channel, which
dynamic-imports the removed export, degrades from a wrong answer to an IPC error — see
Open question 3.

## Testing strategy

**Stage 1, integration.** `src/test/unit/server.test.ts` keeps its 404 and 400 cases
unchanged. Its "answers a presence result for a real tool" case must stop asserting a bare
200, because that status now depends on the release host being reachable from the machine
running the suite. It asserts instead that a well-formed request answers either a body
carrying a `checkKind` string or a 500 carrying an `error` string, and the case names why.

**Stage 2, unit.** A new `src/test/unit/agentic-tools-canonical-skills.test.ts` covers
three cases against a fake fetcher: the returned ids match the suite's skills in order; an
empty `skills` array throws the named error; a fetcher rejection propagates unchanged.
`src/test/unit/agentic-tools-skill-presence.test.ts` keeps its existing fake-id cases,
which exercise format mechanics and need no real suite, and gains one case per real global
target — Claude Code and OpenCode — proving the probed path is `skills/<id>/SKILL.md` under
that tool's base path. `src/test/unit/skill-content-fetch.test.ts` gains one offline case
proving `mapEntriesToSkills` drops an entry whose first segment is `..` or starts with `.`,
which is the guarantee the presence path now relies on.

Manual verification covers the chip itself, at global scope, for Claude Code and OpenCode:
compare the chip against the published release's ids and the files on disk, then remove one
of those skill directories and confirm the chip changes.

## Open questions

1. **Which repository's release is the source of truth?** `PRAXIS_REPO_BASE_URL` names
   `akoukoullis/Praxis`, a repository now renamed `flowcharge-core-archive` that answers
   only through a 301 redirect and holds the single release `v0.1.0`. A separate
   `akoukoullis/flowcharge-core` repository exists on the same host and publishes no
   release at all. Options: leave the constant alone, or repoint it.
   **Recommendation:** leave the constant alone in this change, and publish a current
   release under the repository it already names. Repointing that constant also repoints
   the real installer's write content, which is a larger decision with its own blast radius.
2. **Does `ISS-42-q1t9bh` close on the mechanism fix alone?** Release `v0.1.0` genuinely
   ships `fc-bug-hunt` and `fc-orchestrate` and ships neither `fc-validate` nor
   `flowcharge`, so "Missing skills (6/8)" is a true statement about that release versus
   disk. After this fix the chip reads the same until a current release is published.
   **Recommendation:** close `ISS-42-q1t9bh` on the mechanism fix and track the stale
   release separately. No source available to this repo can make today's chip read
   "Already installed" without becoming circular or reading the barred install ledger.
3. **May the Electron mirror be updated in the same change?**
   `electron/agentic-tools-ipc-handlers.cts:276`, `:360`, `:379` and `:532` dynamic-import
   and pass the removed export, so the `checkInstalledSkills` channel starts answering an
   IPC error. `CLAUDE.md` forbids touching `electron/` to make a feature work, while
   `src/http/routes-integrations.ts:1-4` states the route and its channel must change
   together. Options: leave `electron/` untouched, or make the matching two-line edit.
   **Recommendation:** leave `electron/` untouched. Electron is documented dead scaffolding
   and not a release path, and an error is a safer degradation than a wrong answer.

## Adjacent opportunities

Neither was requested.

1. A batched presence endpoint answering every tool in one request, so a modal open costs one release fetch instead of one per detected row — skip; at most four 160 KB fetches is not yet a problem.
2. A visible "Suite unknown" chip state when the release cannot be reached, instead of a hidden chip — skip; it widens `SkillPresenceResult` and both transports.

## Alternatives considered and rejected

1. Keep the hand-kept array and add a test that diffs it against the release — the chip stays wrong at runtime between edits, and the test needs the private release host to run.
2. Derive the expected list from the probed directory's own contents — circular; it tests disk against itself and can only ever report fully installed.
3. Derive it from `.praxis-installs.json` — barred by the presence module's documented independence from the ledger, and blind to a suite installed by any other means, which is how this machine's suite arrived.
4. Read the skill directory names from the Gitea contents API at the release tag instead of the asset — cheaper, but it creates a second source that can disagree with the asset the installer writes, and it adds a repository-layout assumption and a new outbound endpoint.
5. Have the browser fetch the id list once and post it with each presence request — one release fetch per modal open instead of one per row, but it turns network-derived path segments into client-supplied ones on a route that joins them onto a base path.

## Final summary

Derive the presence check's expected skill ids from the newest published release on every
request, and delete the hand-kept array. Two stages, roughly half a day including tests.
Top risks: the only published release is stale, so the visible chip does not change until a
new one ships; a read path gains a live network dependency, so an unreachable host hides
every chip; and the Electron mirror keeps a dangling reference. Three open questions need
an answer: which repository's release is authoritative, whether `ISS-42-q1t9bh` closes on
the mechanism fix alone, and whether the Electron mirror may be updated here.
