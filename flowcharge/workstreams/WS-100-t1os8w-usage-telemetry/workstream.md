---
id: WS-100-t1os8w
type: workstream
workstream: WS-100-t1os8w
slug: usage-telemetry
title: "Add usage telemetry to the app"
blocked: "The maintainer must first research telemetry options and decide the telemetry package or service. No plan, issue list or task list may be authored for this workstream before that decision."
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

## Not ready to plan

This item is explicitly NOT ready to be planned. Before any plan, issue list or task list is
authored for it, the maintainer first needs to research telemetry options and decide which
telemetry package or service to use. Do not treat this as a normal ready backlog item. The
reason is recorded in the `blocked` frontmatter key.

## Not blocked by the other work

This item does not depend on WS-98-tbznpw, the ports-and-adapters refactor, or on
WS-99-qxgzip, the domain unit test suite. It is blocked by the pending package or service
decision, not by that other work, so `depends_on` stays empty.
