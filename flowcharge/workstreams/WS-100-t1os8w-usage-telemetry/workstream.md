---
id: WS-100-t1os8w
type: workstream
workstream: WS-100-t1os8w
slug: usage-telemetry
title: "Add usage telemetry to the app"
status: ready
tags: [telemetry]
created: 2026-09-09
updated: 2026-09-09
author: Anthony Koukoullis
depends_on: [WS-99-qxgzip]
links: []
---

Add lightweight, not-too-invasive usage telemetry to the app, to learn how many people use it day to day rather than only how many downloaded it.

The goal is to learn how many people actually use the application day to day, not just how
many downloaded it. The telemetry must stay lightweight and not too invasive.

## Package decision — settled

The pending decision is resolved. After a research pass comparing hosted free-tier analytics
services (PostHog, Aptabase, TelemetryDeck) against a DIY Cloudflare Worker + D1 approach, the
maintainer chose **Aptabase**: purpose-built for indie apps, free tier of 20,000 events/month
with no overage billing, anonymous by design (no persistent device IDs, no cookies, no
fingerprinting), open source, and the simplest integration path — one `fetch()` POST to
`https://US.aptabase.com/api/v0/event` (US data region, chosen for no particular compliance
reason since Aptabase is GDPR/CCPA/PECR-compliant in either region — the anonymous data makes
region a non-issue) with an `App-Key` header, no SDK dependency required.

**App Key:** `A-US-2875955020` — this is Aptabase's public app identifier, meant to be embedded
in the client/app itself (not a secret), safe to compile directly into the CLI binary.

Telemetry design, unchanged from the original ask: send only an anonymous random install ID
(generated once, stored locally, reused on every ping), the app version, and the OS. No project
paths, file names, or workstream content, ever. Respect an opt-out environment variable (e.g.
`FLOWCHARGE_NO_TELEMETRY=1`), document it in the README the same release it ships, and never let
a failed or slow request delay or block the app (fire-and-forget, short timeout, swallow errors).

This workstream is now ready to plan.

## Ordering

`depends_on: [WS-99-qxgzip]` places this fourth and last in the recommended execution chain
WS-97-7fvoc0 → WS-98-tbznpw → WS-99-qxgzip → WS-100-t1os8w, set when all four were sequenced
together. It is not a technical dependency — telemetry doesn't need the refactor or the domain
test suite to exist — just the maintainer's chosen execution order.
