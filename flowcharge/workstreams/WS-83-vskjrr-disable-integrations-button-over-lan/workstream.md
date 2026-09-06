---
id: WS-83-vskjrr
type: workstream
workstream: WS-83-vskjrr
slug: disable-integrations-button-over-lan
title: "Disable Manage Integrations over LAN access"
description: "The Manage Integrations button and dialog stay visible and clickable when the dashboard is viewed over LAN, even though the server's loopback gate rejects every /api/integrations/* request from a non-local origin with HTTP 403. A LAN viewer hits a dead end instead of a clear, disabled control. The rest of the app, including the Kanban board, must stay fully usable over LAN."
status: backlog
tags: [agentic-tools, ui, ux, security, feature]
created: 2026-08-31
updated: 2026-08-31
author: Anthony Koukoullis
depends_on: []
links: [WS-55-xrubq1, WS-84-sxdmbl]
---

Disable the Manage Integrations button when the dashboard is viewed over LAN, since the server already refuses every integrations action from a non-local origin.

## What the user said

While discussing why WS-82's task 1.2 could not get a live repro of the loopback-gate 403 path, the user asked why a second computer on the LAN was needed. After the explanation — that the server's loopback gate rejects any `/api/integrations/*` request that does not originate from the same machine, and the UI has no way to know this in advance — the user said: "I think a solution here would be to disable that button if you're accessing it over the LAN. You can still view the Kanban board, you can still look at the app, you just can't do the integration management." Confirmed correct by Claude in that discussion: the button is currently visible and clickable over LAN, and a click just fails with a 403; the idea is to grey out or hide the Manage Integrations button (and, by extension, its dialog) when the app detects it is running over LAN, while every other part of the app, including the board, stays fully usable.

## Background, from the WS-82 handoff this idea came out of

The loopback gate lives in `src/server.ts` (around lines 774-786 as of the WS-82 work), and answers every `/api/integrations/*` request with HTTP 403 unless the request originates from the same machine the server runs on. This is existing, already-shipped behaviour — not new. WS-82 (workstream `WS-82-4z5dg7`, merged to `main` in the same session as this workstream was opened) flattened the Manage Integrations dialog's CLI/desktop-app tabs into one list; it did not touch the loopback gate or how the UI reacts to it.

## Net ask

Detect, from the browser tab, whether the dashboard is being viewed over LAN (non-local origin) rather than locally. When it is, disable (or hide, if disabling reads better once designed) the "Manage Integrations" button, so a LAN viewer is not invited into a dialog whose every action will 403. Every other part of the app — the Kanban board, project browsing, and anything else that does not depend on the loopback-gated integrations API — must keep working exactly as it does today, on both LAN and local access.
