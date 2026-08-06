// A parser for a small, fully-specified YAML subset.
//
// This module knows one grammar and nothing else. It has no idea what a
// workstream, an issue, a task or a file is; it takes a list of lines with the
// common leading indentation already stripped and returns a value tree. Every
// leaf is a string, a string array or a nested map — never a number, a boolean
// or null, so the renderer never has to care about types.
//
// The grammar, at each indentation level:
//   (a) `key: <non-empty>` is a scalar.
//   (b) `key:` with nothing after it takes its value from the more-indented
//       lines below: a list if they all start with `- `, otherwise a nested map.
//   (c) A list item `- <text>` is a string; one whose text is itself
//       `key: value` is a map, absorbing the sibling lines at the item's own
//       content indentation.
//   (d) Anything the grammar cannot read is appended verbatim to the enclosing
//       map under `_raw`. The parser never throws and never drops a line.
//
// Not supported, because nothing in the schema produces it: block scalars
// (`|`, `>`), anchors, aliases, multi-document streams, flow maps. Each lands
// in `_raw`, which is the committed failure mode rather than an oversight.

const KEY = /^([A-Za-z_][A-Za-z0-9_]*):(.*)$/;
const ITEM = /^-(\s+)(.*)$/;
// A block-scalar indicator, with any chomping or indentation modifier.
const BLOCK_SCALAR = /^[|>][0-9+-]*$/;

interface Line {
  raw: string;      // verbatim, for _raw
  indent: number;
  text: string;     // raw with its leading whitespace removed
  blank: boolean;
  tabbed: boolean;  // a tab in the leading whitespace breaks indentation arithmetic
}

function scan(lines: string[]): Line[] {
  return lines.map(function (raw): Line {
    const ws = /^[ \t]*/.exec(raw)![0];
    const text = raw.slice(ws.length);
    return {
      raw,
      indent: ws.length,
      text,
      blank: text.trim() === '',
      tabbed: ws.indexOf('\t') !== -1,
    };
  });
}

// Only \" and \\ are unescaped, per the grammar; every other backslash sequence
// passes through verbatim rather than being guessed at.
function unquote(s: string): string {
  const body = s.slice(1, -1);
  let out = '';
  for (let i = 0; i < body.length; i++) {
    const ch = body.charAt(i);
    if (ch === '\\' && i + 1 < body.length) {
      const next = body.charAt(i + 1);
      if (next === '"' || next === '\\') {
        out += next;
        i++;
        continue;
      }
    }
    out += ch;
  }
  return out;
}

function parseScalar(s: string): PraxisYamlValue {
  const t = s.trim();
  if (t.length >= 2 && t.charAt(0) === '"' && t.charAt(t.length - 1) === '"') return unquote(t);
  if (t.length >= 2 && t.charAt(0) === '[' && t.charAt(t.length - 1) === ']') {
    const inner = t.slice(1, -1).trim();
    // Split on commas only — an element may itself contain spaces.
    return inner ? inner.split(',').map(function (e) { return e.trim(); }).filter(Boolean) : [];
  }
  return t;
}

// Index of the first non-blank line at or beyond `from`, or `to`.
function nextContent(ls: Line[], from: number, to: number): number {
  let i = from;
  while (i < to && ls[i].blank) i++;
  return i;
}

// The half-open range of lines belonging to whatever construct starts at
// `from`: everything below it that is blank or more deeply indented.
function childRange(ls: Line[], from: number, to: number, indent: number): number {
  let j = from;
  while (j < to && (ls[j].blank || ls[j].indent > indent)) j++;
  return j;
}

function parseMap(ls: Line[], from: number, to: number, indent: number): Record<string, PraxisYamlValue> {
  const out: Record<string, PraxisYamlValue> = {};
  const raw: string[] = [];
  let i = from;

  while (i < to) {
    const line = ls[i];
    // A blank line carries no shape, so skipping it drops no content and keeps
    // whitespace out of the `Unparsed` block.
    if (line.blank) { i++; continue; }
    if (line.tabbed || line.indent !== indent) { raw.push(line.raw); i++; continue; }

    const m = KEY.exec(line.text);
    if (!m) { raw.push(line.raw); i++; continue; }

    const key = m[1];
    const rest = m[2].trim();

    // Block scalars are outside the grammar, so the whole construct — its
    // indicator line and its body — goes to _raw rather than leaving a bare
    // "|" behind as a value.
    if (BLOCK_SCALAR.test(rest)) {
      const blockEnd = childRange(ls, i + 1, to, indent);
      for (let k = i; k < blockEnd; k++) if (!ls[k].blank) raw.push(ls[k].raw);
      i = blockEnd;
      continue;
    }

    if (rest) { out[key] = parseScalar(rest); i++; continue; }

    // Rule (b): the value lives in the more-indented lines below.
    const end = childRange(ls, i + 1, to, indent);
    const first = nextContent(ls, i + 1, end);
    if (first === end) { out[key] = ''; i = end; continue; }

    const childIndent = ls[first].indent;
    let allItems = true;
    for (let k = first; k < end; k++) {
      if (ls[k].blank || ls[k].indent !== childIndent) continue;
      if (!ITEM.test(ls[k].text)) { allItems = false; break; }
    }

    out[key] = allItems
      ? parseList(ls, first, end, childIndent, raw)
      : parseMap(ls, first, end, childIndent);
    i = end;
  }

  // Appended last so the file's own field order survives into the payload.
  if (raw.length) out._raw = raw;
  return out;
}

// `raw` is the enclosing map's catch-all: a list has nowhere of its own to put
// a line it cannot read, so unreadable lines surface one level up.
function parseList(ls: Line[], from: number, to: number, indent: number, raw: string[]): PraxisYamlValue[] {
  const out: PraxisYamlValue[] = [];
  let i = from;

  while (i < to) {
    const line = ls[i];
    if (line.blank) { i++; continue; }

    const m = line.tabbed || line.indent !== indent ? null : ITEM.exec(line.text);
    if (!m) { raw.push(line.raw); i++; continue; }

    const end = childRange(ls, i + 1, to, indent);
    const contentIndent = indent + 1 + m[1].length;
    const itemText = m[2];
    const km = KEY.exec(itemText);

    if (km) {
      // Rule (c): the item is a map. Re-present its own line at the content
      // indentation so the sibling lines below it parse as the same map.
      const head: Line = {
        raw: line.raw,
        indent: contentIndent,
        text: itemText,
        blank: false,
        tabbed: false,
      };
      out.push(parseMap([head].concat(ls.slice(i + 1, end)), 0, 1 + (end - i - 1), contentIndent));
    } else if (end > i + 1) {
      // A plain item that owns continuation lines is outside the grammar — a
      // block scalar (`- |`) is the case this catches. The whole item goes to
      // _raw rather than half of it becoming a bogus string.
      for (let k = i; k < end; k++) if (!ls[k].blank) raw.push(ls[k].raw);
    } else {
      out.push(parseScalar(itemText));
    }
    i = end;
  }

  return out;
}

export function parseYamlBlock(lines: string[]): Record<string, PraxisYamlValue> {
  const ls = scan(lines);
  const first = nextContent(ls, 0, ls.length);
  if (first === ls.length) return {};
  return parseMap(ls, 0, ls.length, ls[first].indent);
}
