// Hand-rolled zip container reader: bytes in, named entries out. This module
// knows the zip container format and nothing else — it must not know that
// skills, host paths, releases, or HTTP exist, and it performs no I/O of its
// own. Its only import is node:zlib, so no runtime dependency is added.
//
// The buffer it receives is always the bytes read back from the downloaded
// zip FILE on disk, never the HTTP response buffer. That substitution is what
// makes src/lib/skill-content-fetch.ts's download step real rather than
// decorative, so this module must never be handed a response body directly.

import { inflateRawSync } from 'node:zlib';

export interface ZipEntry {
  name: string; // the entry's path within the archive, verbatim, forward-slashed
  content: Buffer;
}

// Hard ceilings on what one archive may expand to. The real archive is a
// release asset holding a skills directory — a few hundred files and a few
// megabytes at most, orders of magnitude below either limit. These are
// generous headroom against a hostile or broken archive (a zip bomb declares
// a small compressed size and expands without bound), not tuning values.
const MAX_ZIP_ENTRIES = 10000;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 256 * 1024 * 1024;

// Fixed-size prefixes, before the variable-length name/extra/comment fields.
const EOCD_SIGNATURE = 0x06054b50;
const EOCD_FIXED_SIZE = 22;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const CENTRAL_HEADER_FIXED_SIZE = 46;
const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const LOCAL_HEADER_FIXED_SIZE = 30;

const METHOD_STORED = 0;
const METHOD_DEFLATED = 8;

// Scans backwards for the end-of-central-directory signature rather than
// assuming the record sits in the last 22 bytes: a zip carrying an archive
// comment, or a zip64 locator, shifts it away from the tail.
function findEndOfCentralDirectory(buf: Buffer): number {
  for (let offset = buf.length - EOCD_FIXED_SIZE; offset >= 0; offset--) {
    if (buf.readUInt32LE(offset) === EOCD_SIGNATURE) return offset;
  }
  return -1;
}

export function parseZip(buf: Buffer): ZipEntry[] {
  const eocd = findEndOfCentralDirectory(buf);
  if (eocd < 0) {
    throw new Error('Malformed zip archive: no end-of-central-directory record found');
  }

  const declaredEntries = buf.readUInt16LE(eocd + 10);
  const centralSize = buf.readUInt32LE(eocd + 12);
  const centralOffset = buf.readUInt32LE(eocd + 16);

  if (declaredEntries > MAX_ZIP_ENTRIES) {
    throw new Error(
      `Zip archive declares ${declaredEntries} entries, above the ${MAX_ZIP_ENTRIES} entry ceiling`,
    );
  }

  if (centralOffset > buf.length || centralOffset + centralSize > buf.length) {
    throw new Error('Malformed zip archive: central directory offset lies outside the buffer');
  }

  const entries: ZipEntry[] = [];
  let totalUncompressed = 0;
  let cursor = centralOffset;

  for (let i = 0; i < declaredEntries; i++) {
    if (cursor + CENTRAL_HEADER_FIXED_SIZE > buf.length) {
      throw new Error('Malformed zip archive: truncated central-directory header');
    }
    if (buf.readUInt32LE(cursor) !== CENTRAL_HEADER_SIGNATURE) {
      throw new Error('Malformed zip archive: central-directory header signature not found');
    }

    const method = buf.readUInt16LE(cursor + 10);
    const compressedSize = buf.readUInt32LE(cursor + 20);
    const uncompressedSize = buf.readUInt32LE(cursor + 24);
    const centralNameLength = buf.readUInt16LE(cursor + 28);
    const centralExtraLength = buf.readUInt16LE(cursor + 30);
    const centralCommentLength = buf.readUInt16LE(cursor + 32);
    const localOffset = buf.readUInt32LE(cursor + 42);

    const nameEnd = cursor + CENTRAL_HEADER_FIXED_SIZE + centralNameLength;
    if (nameEnd > buf.length) {
      throw new Error('Malformed zip archive: truncated central-directory entry name');
    }
    const name = buf.subarray(cursor + CENTRAL_HEADER_FIXED_SIZE, nameEnd).toString('utf8');

    cursor = nameEnd + centralExtraLength + centralCommentLength;

    // A directory entry carries no content. Both spellings are skipped, never
    // thrown on: a trailing slash, and a zero-length entry with no data.
    const isDirectory = name.endsWith('/') || (uncompressedSize === 0 && compressedSize === 0);
    if (isDirectory) continue;

    // An unsupported compression method is skipped too — one odd entry must
    // not cost the caller the whole archive.
    if (method !== METHOD_STORED && method !== METHOD_DEFLATED) continue;

    // The data offset must come from the LOCAL header's own name and extra
    // field lengths: they routinely differ from the central directory's.
    if (localOffset + LOCAL_HEADER_FIXED_SIZE > buf.length) {
      throw new Error(`Malformed zip archive: truncated local header for entry ${name}`);
    }
    if (buf.readUInt32LE(localOffset) !== LOCAL_HEADER_SIGNATURE) {
      throw new Error(`Malformed zip archive: local header signature not found for entry ${name}`);
    }
    const localNameLength = buf.readUInt16LE(localOffset + 26);
    const localExtraLength = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + LOCAL_HEADER_FIXED_SIZE + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buf.length) {
      throw new Error(`Malformed zip archive: truncated data region for entry ${name}`);
    }

    const remainingBudget = MAX_TOTAL_UNCOMPRESSED_BYTES - totalUncompressed;
    if (uncompressedSize > remainingBudget) {
      throw new Error(
        `Zip archive expands past the ${MAX_TOTAL_UNCOMPRESSED_BYTES} byte uncompressed ceiling at entry ${name}`,
      );
    }

    const raw = buf.subarray(dataStart, dataEnd);
    let content: Buffer;
    if (method === METHOD_STORED) {
      content = Buffer.from(raw);
    } else {
      try {
        // inflateRawSync, not inflateSync: a zip stores a raw deflate stream
        // with no zlib header. maxOutputLength is a backstop against a header
        // that understates its own uncompressed size.
        content = inflateRawSync(raw, { maxOutputLength: remainingBudget });
      } catch {
        throw new Error(`Malformed zip archive: entry ${name} could not be inflated`);
      }
    }

    totalUncompressed += content.length;
    if (totalUncompressed > MAX_TOTAL_UNCOMPRESSED_BYTES) {
      throw new Error(
        `Zip archive expands past the ${MAX_TOTAL_UNCOMPRESSED_BYTES} byte uncompressed ceiling at entry ${name}`,
      );
    }

    entries.push({ name, content });
    if (entries.length > MAX_ZIP_ENTRIES) {
      throw new Error(`Zip archive holds more than the ${MAX_ZIP_ENTRIES} entry ceiling`);
    }
  }

  return entries;
}
