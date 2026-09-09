---
id: WS-99-qxgzip
type: workstream
workstream: WS-99-qxgzip
slug: domain-logic-unit-test-suite
title: "Unit test the domain logic isolated by the ports-and-adapters refactor"
description: "Once the ports-and-adapters refactor exposes the domain core behind ports, that core becomes cheap to unit-test in isolation, with no server and no filesystem. That payoff is the reason the refactor comes first. This suite is deliberately separate from and later than the boundary-level regression suite of WS-97-7fvoc0, and it cannot be meaningfully authored or executed until WS-98-tbznpw lands."
status: ready
tags: [testing]
created: 2026-09-09
updated: 2026-09-09
author: Anthony Koukoullis
depends_on: [WS-98-tbznpw]
links: []
---

Write a comprehensive unit test suite for the domain logic that the ports-and-adapters refactor isolates behind ports, testing the core with no server and no filesystem.

The application shipped its first public release with no test suite. This suite covers the
domain logic that WS-98-tbznpw, the ports-and-adapters refactor, will isolate.

## Why it is separate from WS-97-7fvoc0

This is deliberately separate from and later than the boundary-level regression suite of
WS-97-7fvoc0. That earlier suite tests boundaries — HTTP routes, CLI behavior, `flowcharge/`
extraction — and exists to give the refactor a safety net. This one tests the domain core.

## Why it comes after the refactor

Once the refactor exposes the domain core behind ports, that core becomes cheap to
unit-test in isolation: no server, no filesystem. That is the whole payoff of doing the
refactor first.

## Ordering

This cannot be meaningfully authored or executed until WS-98-tbznpw lands. The constraint is
recorded in `depends_on`.
