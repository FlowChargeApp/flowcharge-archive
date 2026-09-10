// Unit tests for telemetry.ts. Every case here is offline: the pure functions
// reach nothing, and the trackAppStarted cases below stub globalThis.fetch and
// restore it in a finally block, so no case ever reaches the real endpoint.
//
// isTelemetryEnabled is driven with plain object literals cast to
// NodeJS.ProcessEnv rather than by mutating process.env, so no case can leak
// into another case or into another suite.
//
// Run with `node --test dist/test/unit/telemetry.test.js` after `npm run build`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  APTABASE_APP_KEY,
  APTABASE_EVENT_URL,
  buildAppStartedEvent,
  isTelemetryEnabled,
  newSessionId,
  osNameFor,
  trackAppStarted,
} from '../../lib/telemetry.js';
import type { TelemetryInput } from '../../lib/telemetry.js';

function envWith(value: string | undefined): NodeJS.ProcessEnv {
  if (value === undefined) return {} as NodeJS.ProcessEnv;
  return { FLOWCHARGE_NO_TELEMETRY: value } as NodeJS.ProcessEnv;
}

function inputWith(overrides: Partial<TelemetryInput> = {}): TelemetryInput {
  return {
    dataDir: '/tmp/does-not-need-to-exist',
    appVersion: '0.1.0',
    platform: 'darwin',
    osRelease: '24.6.0',
    env: {} as NodeJS.ProcessEnv,
    ...overrides,
  };
}

test('telemetry is ON when the opt-out variable is unset, empty or 0', () => {
  assert.equal(isTelemetryEnabled(envWith(undefined)), true);
  assert.equal(isTelemetryEnabled(envWith('')), true);
  assert.equal(isTelemetryEnabled(envWith('0')), true);
});

test('telemetry is OFF for any other value of the opt-out variable', () => {
  assert.equal(isTelemetryEnabled(envWith('1')), false);
  assert.equal(isTelemetryEnabled(envWith('true')), false);
  assert.equal(isTelemetryEnabled(envWith('no')), false);
});

test('newSessionId is eighteen decimal digits', () => {
  const id = newSessionId(Date.parse('2026-09-09T00:00:00.000Z'), 12345678);
  assert.equal(id.length, 18);
  assert.match(id, /^[0-9]{18}$/);
});

test('the first ten digits of a session ID are the epoch seconds', () => {
  const nowMs = Date.parse('2026-09-09T01:23:45.678Z');
  const id = newSessionId(nowMs, 12345678);
  // Compared as strings: a numeric comparison would reintroduce the precision
  // loss the string concatenation exists to avoid.
  assert.equal(id.slice(0, 10), String(Math.floor(nowMs / 1000)));
  assert.equal(id.slice(10), '12345678');
});

test('a small random8 is zero-padded to eight digits', () => {
  const nowMs = Date.parse('2026-09-09T01:23:45.678Z');
  const id = newSessionId(nowMs, 7);
  assert.equal(id.length, 18);
  assert.equal(id.slice(10), '00000007');
  assert.equal(id, `${Math.floor(nowMs / 1000)}00000007`);
});

test('a present-day timestamp loses no low digits', () => {
  // 1e17-scale arithmetic would round; concatenation does not. Every digit of
  // both halves must survive intact.
  const nowMs = Date.parse('2026-09-09T12:34:56.000Z');
  const id = newSessionId(nowMs, 99999999);
  assert.equal(id, `${Math.floor(nowMs / 1000)}99999999`);
  assert.equal(id.slice(10), '99999999');
});

test('osNameFor maps the three known platforms', () => {
  assert.equal(osNameFor('darwin'), 'macOS');
  assert.equal(osNameFor('linux'), 'Linux');
  assert.equal(osNameFor('win32'), 'Windows');
});

test('osNameFor passes an unknown platform through unchanged', () => {
  assert.equal(osNameFor('freebsd'), 'freebsd');
  assert.equal(osNameFor('aix'), 'aix');
});

test('buildAppStartedEvent produces exactly the agreed camelCase field set', () => {
  const event = buildAppStartedEvent(
    inputWith({ platform: 'linux', osRelease: '6.8.0-generic', appVersion: '1.2.3' }),
    'install-abc',
    '175750000012345678',
    '2026-09-09T01:23:45.678Z'
  );

  // Asserted exactly, so an extra field added later fails the suite.
  assert.deepEqual(Object.keys(event).sort(), [
    'eventName',
    'props',
    'sessionId',
    'systemProps',
    'timestamp',
  ]);
  assert.deepEqual(Object.keys(event.systemProps).sort(), [
    'appVersion',
    'isDebug',
    'osName',
    'osVersion',
    'sdkVersion',
  ]);
  assert.deepEqual(Object.keys(event.props), ['installId']);

  assert.equal(event.eventName, 'app_started');
  assert.equal(event.timestamp, '2026-09-09T01:23:45.678Z');
  assert.equal(event.sessionId, '175750000012345678');
  assert.equal(event.systemProps.isDebug, false);
  assert.equal(event.systemProps.osName, 'Linux');
  assert.equal(event.systemProps.osVersion, '6.8.0-generic');
  assert.equal(event.systemProps.appVersion, '1.2.3');
  assert.equal(event.systemProps.sdkVersion, 'flowcharge-cli@1.2.3');
  assert.equal(event.props.installId, 'install-abc');
});

test('isDebug is strictly false, never a falsy stand-in', () => {
  const event = buildAppStartedEvent(inputWith(), 'install-abc', '175750000012345678', 'ts');
  assert.strictEqual(event.systemProps.isDebug, false);
});

test('osVersion carries the input osRelease unchanged', () => {
  const event = buildAppStartedEvent(
    inputWith({ osRelease: '10.0.22631' }),
    'install-abc',
    '175750000012345678',
    'ts'
  );
  assert.equal(event.systemProps.osVersion, '10.0.22631');
});

test('sdkVersion is cut to forty characters for a long app version', () => {
  const longVersion = '1.2.3-a-very-long-prerelease-identifier-indeed';
  const event = buildAppStartedEvent(
    inputWith({ appVersion: longVersion }),
    'install-abc',
    '175750000012345678',
    'ts'
  );

  assert.equal(event.systemProps.sdkVersion.length, 40);
  assert.equal(event.systemProps.sdkVersion, `flowcharge-cli@${longVersion}`.slice(0, 40));
  // appVersion itself is not cut — only sdkVersion is.
  assert.equal(event.systemProps.appVersion, longVersion);
});

// --- trackAppStarted -------------------------------------------------------
//
// Every case below stubs globalThis.fetch and restores it in a finally block,
// following the template at src/test/unit/skill-content-fetch.test.ts:206-222.
// No case reaches the real endpoint, and no case relies on the 3000 ms default
// timeout — the hanging case passes an explicit short one so the suite stays
// fast.

interface FetchCall {
  url: string;
  init: RequestInit;
}

async function withStubbedFetch(
  handler: (url: string, init: RequestInit) => Promise<Response>,
  run: (calls: FetchCall[]) => Promise<void>
): Promise<void> {
  const original = globalThis.fetch;
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: unknown, init: RequestInit = {}): Promise<Response> => {
    calls.push({ url: String(input), init });
    return handler(String(input), init);
  }) as typeof fetch;
  try {
    await run(calls);
  } finally {
    // Restored even when an assertion above fails, so the stub can never leak
    // into a later case or a later suite.
    globalThis.fetch = original;
  }
}

// Records anything the module under test sends to console, at any level, for
// the duration of one call. The module logs nothing on any path, success
// included, so every case below asserts this list came back empty.
//
// The hooks sit on console rather than on process.stdout.write, because the
// node:test runner writes its own result protocol to stdout while these cases
// run — a raw stream hook captures that traffic too and can never be empty.
const CONSOLE_LEVELS = ['log', 'info', 'warn', 'error', 'debug'] as const;

async function withRecordedConsole(run: () => Promise<void>): Promise<string[]> {
  const originals = CONSOLE_LEVELS.map((level) => [level, console[level]] as const);
  const lines: string[] = [];
  for (const level of CONSOLE_LEVELS) {
    console[level] = ((...args: unknown[]): void => {
      lines.push(`${level}: ${args.map((arg) => String(arg)).join(' ')}`);
    }) as typeof console.log;
  }
  try {
    await run();
  } finally {
    // Restored even when an assertion above fails, so no stub leaks into a
    // later case or a later suite.
    for (const [level, fn] of originals) console[level] = fn;
  }
  return lines;
}

function withTempDir(fn: (dataDir: string) => Promise<void>): Promise<void> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'praxis-telemetry-test-'));
  return fn(tmpDir).finally(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
}

function stubResponse(status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Stubbed failure',
    headers: new Headers(),
  } as unknown as Response;
}

test('the happy path posts the event to the Aptabase endpoint', async () => {
  await withTempDir(async (dataDir) => {
    await withStubbedFetch(
      async () => stubResponse(200),
      async (calls) => {
        const logged = await withRecordedConsole(async () => {
          await trackAppStarted(inputWith({ dataDir }), 200);
        });

        assert.equal(calls.length, 1);
        assert.equal(calls[0]!.url, APTABASE_EVENT_URL);
        assert.equal(calls[0]!.init.method, 'POST');

        const headers = calls[0]!.init.headers as Record<string, string>;
        assert.equal(headers['App-Key'], APTABASE_APP_KEY);
        assert.equal(headers['Content-Type'], 'application/json');

        const body = JSON.parse(String(calls[0]!.init.body)) as {
          props: { installId: string };
          eventName: string;
        };
        assert.equal(body.eventName, 'app_started');
        assert.equal(typeof body.props.installId, 'string');
        assert.notEqual(body.props.installId, '');

        // Nothing is logged on the success path either.
        assert.deepEqual(logged, []);
      }
    );
  });
});

test('a 400 answer resolves without throwing and logs nothing', async () => {
  await withTempDir(async (dataDir) => {
    await withStubbedFetch(
      async () => stubResponse(400),
      async (calls) => {
        const logged = await withRecordedConsole(async () => {
          await trackAppStarted(inputWith({ dataDir }), 200);
        });
        assert.equal(calls.length, 1);
        assert.deepEqual(logged, []);
      }
    );
  });
});

test('a fetch that throws a plain Error resolves without throwing', async () => {
  await withTempDir(async (dataDir) => {
    await withStubbedFetch(
      async () => {
        throw new Error('stubbed network failure');
      },
      async (calls) => {
        const logged = await withRecordedConsole(async () => {
          await trackAppStarted(inputWith({ dataDir }), 200);
        });
        assert.equal(calls.length, 1);
        assert.deepEqual(logged, []);
      }
    );
  });
});

test('a request that hangs past the timeout resolves without throwing', async () => {
  // This is the case that proves the unconditional catch: AbortSignal.timeout
  // rejects with a TimeoutError DOMException rather than a plain Error, so an
  // instanceof-filtered catch would let it escape
  // (src/lib/update-check.ts:119-125).
  await withTempDir(async (dataDir) => {
    await withStubbedFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init.signal;
          assert.ok(signal, 'trackAppStarted must pass an abort signal');
          signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        }),
      async (calls) => {
        const logged = await withRecordedConsole(async () => {
          await trackAppStarted(inputWith({ dataDir }), 20);
        });
        assert.equal(calls.length, 1);
        assert.deepEqual(logged, []);
      }
    );
  });
});

test('the opt-out path calls neither fetch nor the filesystem', async () => {
  await withTempDir(async (dataDir) => {
    await withStubbedFetch(
      async () => {
        throw new Error('the opt-out path must not reach fetch');
      },
      async (calls) => {
        const logged = await withRecordedConsole(async () => {
          await trackAppStarted(
            inputWith({ dataDir, env: envWith('1') }),
            200
          );
        });

        assert.deepEqual(calls, [], 'no request may be made on the opt-out path');
        assert.deepEqual(
          fs.readdirSync(dataDir),
          [],
          'no file may be written on the opt-out path'
        );
        assert.deepEqual(logged, []);
      }
    );
  });
});
