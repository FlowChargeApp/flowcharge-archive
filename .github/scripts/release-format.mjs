// Owns the two textual shapes a FlowCharge release is written in: the bare
// release version string `X.Y.Z`, and the CHANGELOG.md release heading
// `## X.Y.Z`. Plain ESM on purpose, matching tools/package-cli.mjs and
// tools/bundle-public.mjs — no build framework and no dependency.
//
// This module knows those two shapes and nothing else. It does not know git,
// either repository root, the artefact names, the gh CLI, or what its output
// is used for. It takes text and returns text.
//
// It is a pure module with no command-line interface. It reads no file, runs
// no other program, prints nothing, and has no statement with an effect at
// module scope, so importing it is always safe.

// A release heading, anchored to the start of a line. The multiline flag is
// deliberate: an unanchored pattern would read a real version quoted mid-line
// in prose. The lookahead lets a heading carry a tail, because
// flowcharge-public writes its headings as `## X.Y.Z - YYYY-MM-DD`.
const RELEASE_HEADING = /^##[ \t]+(\d+\.\d+\.\d+)(?=[ \t\r]|$)/;
const RELEASE_HEADING_MULTILINE = /^##[ \t]+(\d+\.\d+\.\d+)(?=[ \t\r]|$)/m;

// True only for three groups of digits separated by dots. A leading `v`, a
// two-part version and a pre-release or build suffix are all rejected.
export function isBareVersion(value) {
  return typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value);
}

// The version named by the first release heading in the text, or null when the
// text names none. The first match wins, so an `## Unreleased` heading above
// the newest release heading is read past.
export function newestVersion(changelogText) {
  if (typeof changelogText !== 'string') return null;
  const match = RELEASE_HEADING_MULTILINE.exec(changelogText);
  return match === null ? null : match[1];
}

// The lines under the heading that names `version`, up to the next line
// beginning `## ` or the end of the text, with blank lines removed from both
// ends. Any release section can be read, not only the newest one, and the
// section is closed by whichever `## ` heading comes next — an `## Unreleased`
// heading closes it exactly as a release heading does.
//
// Returns null when no heading names the version, and the empty string when
// the heading exists but the section holds no text. The two outcomes stay
// distinguishable on purpose, because the caller reports them differently.
export function sectionBody(changelogText, version) {
  if (typeof changelogText !== 'string' || typeof version !== 'string') return null;

  const lines = changelogText.split('\n');

  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const match = RELEASE_HEADING.exec(lines[i]);
    if (match !== null && match[1] === version) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return null;

  let end = lines.length;
  for (let i = start; i < lines.length; i += 1) {
    if (lines[i].startsWith('## ')) {
      end = i;
      break;
    }
  }

  const body = lines.slice(start, end);
  while (body.length > 0 && body[0].trim() === '') body.shift();
  while (body.length > 0 && body[body.length - 1].trim() === '') body.pop();
  return body.join('\n');
}
