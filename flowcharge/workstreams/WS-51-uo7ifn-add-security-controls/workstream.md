---
id: WS-51-uo7ifn
type: workstream
workstream: WS-51-uo7ifn
slug: add-security-controls
title: "Add request-origin validation, a Content-Security-Policy, and signed/notarized packaged builds"
status: done
tags: [security, server, electron, packaging, feature]
created: 2026-08-21
updated: 2026-08-21
author: Anthony Koukoullis
depends_on: []
links: [WS-50-wnvfyq]
---

Add three new security controls the audit flagged as missing, not as broken: Host/Origin request validation, a Content-Security-Policy, and signed/notarized packaged builds.

These are the three findings from the security audit's "Not filed" list in WS-50-wnvfyq (security-hardening) — Findings C, G, and I — that the create-issues stage correctly declined to file as bug-list issues, because each adds a control the code never had rather than fixing one that exists. Finding A (LAN mode has no authentication) is excluded — the README already records that as a deliberate, accepted trade-off. The plan authored here should decide the best way to implement each of the three, then be broken into spec tasks. Execution and commit are not requested yet.
