// The request-boundary guards: the header-only origin check, the peer-address
// loopback check, the Content-Type shape test, and the two string-shape
// constants every route validates a display name against.
//
// This module reads no environment variable. The set of extra hostnames this
// server answers to arrives as a parameter, computed once in the composition
// root, so this file stays a pure request-boundary module.

import type http from 'node:http';
import net from 'node:net';
import { sendJson } from './json.js';

// The one place the display-name cap lives, so it can be widened in one edit.
export const MAX_NAME_LENGTH = 100;

// Validation lives here at the route boundary, never in the registry library,
// exactly as the add-project route validates the path before addProject sees
// it. The trimmed value is what is length-checked and what is stored, so it is
// computed once and reused. The character class covers the C0 range (which
// includes \n, \r and \t), DEL, and the C1 range: a display name is a single
// line of text. Module-scope so it compiles once, not once per request.
export const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/;

// The bare hostname from a Host header value, or null when the header is absent
// or unparseable. A WHATWG URL keeps the brackets on an IPv6 literal, so they
// are stripped here — otherwise `[::1]:4173` would never match net.isIP.
export function hostnameOf(hostHeader: string | undefined): string | null {
  if (hostHeader === undefined) return null;
  try {
    const hostname = new URL('http://' + hostHeader).hostname;
    return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  } catch {
    return null;
  }
}

// Header-only request-origin validation: it knows nothing about routes, project
// ids, the registry, or the extractor. Returns true when the request may
// proceed; otherwise it writes its own 403 through sendJson and returns false.
// No Access-Control-Allow-* header is ever sent — sending none is the posture.
// The extra permitted hostnames arrive as a parameter rather than being read
// from the environment here.
export function passesOriginCheck(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  allowedHosts: ReadonlySet<string>,
): boolean {
  // Check one: the Host header. An absent or unparseable Host fails.
  const hostname = hostnameOf(req.headers.host);
  if (hostname === null || !(net.isIP(hostname) !== 0 || hostname === 'localhost' || allowedHosts.has(hostname))) {
    sendJson(res, 403, { error: 'Host header not allowed' });
    return false;
  }

  // Check two: the Origin header, when present. Compared against the RAW Host
  // header value so the port is part of the comparison. An absent Origin passes
  // — Electron's loopbackRequest sends none. `Origin: null` fails, because it
  // never equals `http://` plus a host.
  const origin = req.headers.origin;
  if (origin !== undefined && origin.toLowerCase() !== ('http://' + req.headers.host).toLowerCase()) {
    sendJson(res, 403, { error: 'Origin not allowed' });
    return false;
  }

  return true;
}

// The peer-address gate the /api/integrations/* branch sits behind. This is a
// DIFFERENT guard from isLoopbackHost in the composition root, which inspects a
// Host header rather than the socket's actual peer; neither replaces the other
// and both stay. Node reports an IPv4 loopback client as '::ffff:127.0.0.1'
// when the socket is IPv6, so that form is accepted too — omitting it would
// silently refuse legitimate local requests. An absent address fails closed.
export function isLoopbackRemote(req: http.IncomingMessage): boolean {
  const remote = req.socket.remoteAddress;
  if (remote === undefined) return false;
  return remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
}

// True only when the header's media type is exactly application/json. Real
// requests attach parameters, so `application/json; charset=utf-8` must pass:
// the parameters are split off at the first semicolon before the comparison.
// An absent header returns false.
export function isJsonContentType(header: string | undefined): boolean {
  if (header === undefined) return false;
  return header.split(';')[0].trim().toLowerCase() === 'application/json';
}
