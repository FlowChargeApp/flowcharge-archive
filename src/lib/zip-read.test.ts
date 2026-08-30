// Unit tests for zip-read.ts's parseZip, covering the entry kinds it must
// decode, the entry kinds it must skip rather than throw on, malformed input,
// and both ceilings. Every fixture archive is built in-test with Buffer
// writes and zlib.deflateRawSync, so no binary fixture file is committed.
// Follows skill-content-fetch.test.ts's node:test + node:assert/strict pattern.
//
// Run with `node --test dist/lib/zip-read.test.js` after `npm run build`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';

import { parseZip } from './zip-read.js';

const METHOD_STORED = 0;
const METHOD_DEFLATED = 8;

interface FixtureEntry {
  name: string;
  method: number;
  data: Buffer; // the bytes as stored, already compressed for method 8
  uncompressedSize: number; // what the headers declare, not necessarily data.length
}

// Emits one local file header followed by its stored data. The caller records
// the offset this record was written at, and feeds that same offset back into
// centralRecord below — deriving the central directory's stated offsets from
// the local records' real positions is what keeps a hand-built fixture honest.
function localRecord(entry: FixtureEntry): Buffer {
  const name = Buffer.from(entry.name, 'utf8');
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4); // version needed
  header.writeUInt16LE(0, 6); // flags
  header.writeUInt16LE(entry.method, 8);
  header.writeUInt16LE(0, 10); // mod time
  header.writeUInt16LE(0, 12); // mod date
  header.writeUInt32LE(0, 14); // crc32, never verified by parseZip
  header.writeUInt32LE(entry.data.length, 18);
  header.writeUInt32LE(entry.uncompressedSize, 22);
  header.writeUInt16LE(name.length, 26);
  header.writeUInt16LE(0, 28); // extra length
  return Buffer.concat([header, name, entry.data]);
}

function centralRecord(entry: FixtureEntry, localOffset: number): Buffer {
  const name = Buffer.from(entry.name, 'utf8');
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4); // version made by
  header.writeUInt16LE(20, 6); // version needed
  header.writeUInt16LE(0, 8); // flags
  header.writeUInt16LE(entry.method, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt16LE(0, 14);
  header.writeUInt32LE(0, 16);
  header.writeUInt32LE(entry.data.length, 20);
  header.writeUInt32LE(entry.uncompressedSize, 24);
  header.writeUInt16LE(name.length, 28);
  header.writeUInt16LE(0, 30); // extra length
  header.writeUInt16LE(0, 32); // comment length
  header.writeUInt16LE(0, 34); // disk start
  header.writeUInt16LE(0, 36); // internal attrs
  header.writeUInt32LE(0, 38); // external attrs
  header.writeUInt32LE(localOffset, 42);
  return Buffer.concat([header, name]);
}

function buildZip(entries: FixtureEntry[], declaredEntryCount?: number): Buffer {
  const locals: Buffer[] = [];
  const offsets: number[] = [];
  let cursor = 0;
  for (const entry of entries) {
    offsets.push(cursor);
    const record = localRecord(entry);
    locals.push(record);
    cursor += record.length;
  }

  const centrals = entries.map((entry, i) => centralRecord(entry, offsets[i]));
  const centralOffset = cursor;
  const centralSize = centrals.reduce((sum, b) => sum + b.length, 0);
  const count = declaredEntryCount ?? entries.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // central directory start disk
  eocd.writeUInt16LE(count, 8);
  eocd.writeUInt16LE(count, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...locals, ...centrals, eocd]);
}

function deflated(name: string, text: string): FixtureEntry {
  const plain = Buffer.from(text, 'utf8');
  return { name, method: METHOD_DEFLATED, data: deflateRawSync(plain), uncompressedSize: plain.length };
}

function stored(name: string, text: string): FixtureEntry {
  const plain = Buffer.from(text, 'utf8');
  return { name, method: METHOD_STORED, data: plain, uncompressedSize: plain.length };
}

test('parseZip decodes a deflated entry', () => {
  const zip = buildZip([deflated('fc-bug-hunt/SKILL.md', 'deflated body content')]);
  const entries = parseZip(zip);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].name, 'fc-bug-hunt/SKILL.md');
  assert.equal(entries[0].content.toString('utf8'), 'deflated body content');
});

test('parseZip decodes a stored entry', () => {
  const zip = buildZip([stored('fc-git/SKILL.md', 'stored body content')]);
  const entries = parseZip(zip);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].name, 'fc-git/SKILL.md');
  assert.equal(entries[0].content.toString('utf8'), 'stored body content');
});

test('parseZip skips an unsupported compression method rather than throwing', () => {
  const odd: FixtureEntry = {
    name: 'fc-odd/compressed.bin',
    method: 99, // not stored, not deflated
    data: Buffer.from([1, 2, 3, 4]),
    uncompressedSize: 4,
  };
  const zip = buildZip([odd, deflated('fc-git/SKILL.md', 'survivor')]);

  const entries = parseZip(zip);
  assert.deepEqual(
    entries.map((e) => e.name),
    ['fc-git/SKILL.md'],
  );
  assert.equal(entries[0].content.toString('utf8'), 'survivor');
});

test('parseZip skips a directory entry rather than throwing', () => {
  const dir: FixtureEntry = {
    name: 'fc-git/',
    method: METHOD_STORED,
    data: Buffer.alloc(0),
    uncompressedSize: 0,
  };
  const zip = buildZip([dir, deflated('fc-git/SKILL.md', 'inside the directory')]);

  const entries = parseZip(zip);
  assert.deepEqual(
    entries.map((e) => e.name),
    ['fc-git/SKILL.md'],
  );
});

test('parseZip throws a naming error on a truncated buffer', () => {
  const zip = buildZip([deflated('fc-git/SKILL.md', 'body')]);
  const truncated = zip.subarray(0, zip.length - 10);
  assert.throws(() => parseZip(truncated), /end-of-central-directory/);
});

test('parseZip throws a naming error when the entry-count ceiling is crossed', () => {
  // The EOCD declares far more entries than the archive holds, which is what
  // a hostile archive does; the ceiling must refuse before any walk begins.
  const zip = buildZip([deflated('fc-git/SKILL.md', 'body')], 60000);
  assert.throws(() => parseZip(zip), /entry ceiling/);
});

test('parseZip throws a naming error when the uncompressed-byte ceiling is crossed', () => {
  const plain = Buffer.from('small payload, enormous declared size', 'utf8');
  const liar: FixtureEntry = {
    name: 'fc-bomb/huge.bin',
    method: METHOD_DEFLATED,
    data: deflateRawSync(plain),
    uncompressedSize: 300 * 1024 * 1024,
  };
  const zip = buildZip([liar]);
  assert.throws(() => parseZip(zip), /uncompressed ceiling/);
});
