// The Manage Integrations row rules, lifted out of src/public/home.ts so they can be
// driven by `node --test`. home.ts is a single IIFE that resolves page elements by id
// at module evaluation time, so nothing inside it can be imported into a Node process.
// This module holds the decisions; home.ts keeps the painting and every user-facing
// string.
//
// THIS MODULE MUST NEVER GAIN AN import STATEMENT. Not a type-only one, and not
// 'node:path'. ARCHITECTURE.md section 11's browser-entry-bundles rule otherwise bars a
// browser entry from reaching src/lib/ at all; PLN-90-37gi0l Decision 4 narrows that rule
// to permit exactly one import path, home.ts -> this file, and the narrowing holds only
// while this file imports nothing. One import here silently pulls server code into
// home.js with a green build: tools/bundle-public.mjs guards only `eval(` and `Function(`,
// tools/copy-assets.mjs guards source maps, and no check anywhere reads the import graph.
// This comment is the only guard.
//
// SkillPresenceLike is therefore declared structurally rather than imported from
// src/lib/agentic-tools-skill-presence.ts, whose SkillPresenceResult would drag node:path
// in behind it.
//
// Compiled twice: by the root tsconfig.json to dist/lib/agentic-tools-chip-rules.js, which
// the unit test imports, and by src/public/tsconfig.json as part of the browser
// type-check. Stay inside the intersection of the two projects — ES2020 syntax and the
// ES2020 library only, because the browser project targets es2020.

export type IntegrationsScopeKind = 'global' | 'project';

export type SkillPresenceLike =
  | {
      checkKind: 'per-skill';
      status: 'fully-installed' | 'missing-incomplete' | 'not-installed';
      presentSkillIds: string[];
      missingSkillIds: string[];
    }
  | { checkKind: 'shared-file'; exists: boolean }
  | { checkKind: 'no-format' };

export interface IntegrationsRowRuleInput {
  scopeKind: IntegrationsScopeKind;
  // resolveBasePathForScope's answer at the current scope; null means the row
  // has no installable target there.
  basePath: string | null;
  needsManualVerification: boolean;
  hasLiveResult: boolean;
  // Passed unconditionally. The project-scope gate lives in this module.
  presence: SkillPresenceLike | undefined;
  installedVersion: string | null | undefined;
  ledgerVersion: string | undefined;
  latestReleaseTag: string | null;
}

export type InstallChipDecision =
  'hidden' | 'already-installed' | 'missing-skills' | 'unchanged';

export type VersionChipDecision =
  | { kind: 'hidden' }
  | { kind: 'unknown' }
  | { kind: 'version'; major: number; minor: number; patch: number };

export type RowNote = 'not-supported-at-scope' | 'path-unverified';

export interface IntegrationsRowDecision {
  eligible: boolean;
  installChip: InstallChipDecision;
  versionChip: VersionChipDecision;
  updateOffered: boolean;
  notes: RowNote[];
}

// Accepts `v?MAJOR.MINOR.PATCH` and ignores whatever follows the patch number,
// matching src/lib/update-check.ts's rule exactly. Re-authored here rather than
// imported: that module uses the Node-only Buffer global and is excluded from this
// page's type-check and bundle (see task list Divergence 2).
var SEMVER_RE = /^v?(\d+)\.(\d+)\.(\d+)/;

export function parseSemver(raw: string): { major: number; minor: number; patch: number } | null {
  if (typeof raw !== 'string') return null;
  var m = raw.trim().match(SEMVER_RE);
  if (m === null) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

// True only when candidate is strictly greater than running, comparing major,
// then minor, then patch. An unreadable version on either side returns false: a
// version we cannot read must never prompt an update. Same semantics as
// src/lib/update-check.ts's isNewer, re-authored here for the same reason
// parseSemver above is (see task list Divergence 2).
export function isNewer(candidate: string, running: string): boolean {
  var a = parseSemver(candidate);
  var b = parseSemver(running);
  if (a === null || b === null) return false;
  if (a.major !== b.major) return a.major > b.major;
  if (a.minor !== b.minor) return a.minor > b.minor;
  return a.patch > b.patch;
}

// The whole row decision, from values home.ts already holds. A function of its
// argument only: no DOM, no fetch, no user-facing string and no side effect.
export function deriveIntegrationsRowDecision(
  input: IntegrationsRowRuleInput
): IntegrationsRowDecision {
  // A row with no resolvable base path at this scope has no installable target.
  // Ineligibility disables controls; it never hides a chip.
  var eligible = input.basePath !== null;

  // checkInstalledSkills is only ever fetched at Global scope, so showing its result
  // under Project scope would be a stale, wrong-scope result mislabelled as current.
  // The gate that used to sit inline in home.ts lives here now, and it covers the
  // version the same check read off disk as well as the presence status itself.
  var presence = input.scopeKind === 'global' ? input.presence : undefined;

  // A row with zero skills installed hides all three of the version chip, the update
  // chip and the Update button: there is no installation to carry a version. A failed
  // or pending presence probe leaves no entry in the map, so this stays false there and
  // the chip stays visible reading an unknown version.
  var zeroInstalled = presence !== undefined
    && presence.checkKind === 'per-skill'
    && presence.status === 'not-installed';

  // The version is read disk-first and ledger-second: the version the presence route
  // read off the installed skill files wins; the once-fetched record map supplies it
  // only when the presence response carries none. No version at either source, and a
  // version the semver rule cannot read, both read unknown.
  var diskVersion = presence !== undefined
    && typeof input.installedVersion === 'string'
    && input.installedVersion !== ''
    ? input.installedVersion
    : undefined;
  var effectiveVersion = diskVersion === undefined ? input.ledgerVersion : diskVersion;
  var parsed = effectiveVersion === undefined ? null : parseSemver(effectiveVersion);

  var versionChip: VersionChipDecision;
  if (zeroInstalled) {
    versionChip = { kind: 'hidden' };
  } else if (parsed === null) {
    versionChip = { kind: 'unknown' };
  } else {
    versionChip = { kind: 'version', major: parsed.major, minor: parsed.minor, patch: parsed.patch };
  }

  // Strict comparison only: an equal tag offers nothing, and an absent version or a
  // version either side cannot read offers nothing either — isNewer returns false for
  // every unreadable input, so an unparseable tag can never prompt an update.
  var updateOffered = !zeroInstalled
    && effectiveVersion !== undefined
    && input.latestReleaseTag !== null
    && isNewer(input.latestReleaseTag, effectiveVersion);

  // A live installSelected() result already reflects real, current install state, so
  // 'unchanged' tells the painter to leave both the chip's text and its hidden flag
  // exactly as they are — the presence check is fetched once at dialog open and cannot
  // see a live install that happened afterward.
  var installChip: InstallChipDecision;
  if (input.hasLiveResult) {
    installChip = 'unchanged';
  } else if (presence !== undefined && (
    (presence.checkKind === 'per-skill' && presence.status === 'fully-installed') ||
    (presence.checkKind === 'shared-file' && presence.exists)
  )) {
    installChip = 'already-installed';
  } else if (presence !== undefined
    && presence.checkKind === 'per-skill' && presence.status === 'missing-incomplete') {
    installChip = 'missing-skills';
  } else {
    installChip = 'hidden';
  }

  // Ineligibility first, then the unverified path — the order home.ts appends them in,
  // and therefore the order the user reads them in.
  var notes: RowNote[] = [];
  if (!eligible) notes.push('not-supported-at-scope');
  if (input.needsManualVerification) notes.push('path-unverified');

  return {
    eligible: eligible,
    installChip: installChip,
    versionChip: versionChip,
    updateOffered: updateOffered,
    notes: notes
  };
}
