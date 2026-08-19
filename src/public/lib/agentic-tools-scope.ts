// Classic script (module: "none" — no import/export statements permitted). Loaded via a
// <script> tag on index.html ahead of home.js.
//
// Knows one rule: resolve or reject a base path given a scope and a (possibly absent)
// detection result shape. Must not know about the DOM, TOOL_CATALOGUE contents by id, or
// any specific tool.

type InstallScope = { kind: 'global' } | { kind: 'project'; projectPath: string };

interface DetectionResultLike {
  resolvedConfigDir: string | null;
}

// 'project' scope always resolves to the project's own root — every catalogued format's
// pathTemplate is relative to the project root or configDir either way, so no detection
// lookup is needed. 'global' scope defers entirely to whatever detection already resolved;
// a tool with no global configDir for the running OS is handled automatically, because this
// only reads what detection already worked out — no per-tool special-casing here.
function resolveBasePathForScope(
  scope: InstallScope,
  detection: DetectionResultLike | undefined
): string | null {
  if (scope.kind === 'project') return scope.projectPath;
  return detection ? detection.resolvedConfigDir : null;
}

function isEligibleAtScope(
  scope: InstallScope,
  detection: DetectionResultLike | undefined
): boolean {
  return resolveBasePathForScope(scope, detection) !== null;
}
