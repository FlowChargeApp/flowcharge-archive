---
id: WS-101-osf5tc
type: workstream
workstream: WS-101-osf5tc
slug: board-core-settings-tile
title: "Show a project's effective FlowCharge Core settings in a board info tile"
description: "The board should surface the FlowCharge Core settings a project can configure in its optional flowcharge/agents.md — default_agent, task_list_mode and prompts — as effective values: the file's value where it sets one, and the orchestrator's built-in default where it does not, with a clear visual distinction between the two."
status: backlog
tags: [board, ui, extraction, flowcharge]
created: 2026-09-09
updated: 2026-09-09
author: Anthony Koukoullis
depends_on: []
links: []
---
Add an info tile near the top of the board that shows the project's effective FlowCharge Core settings — default_agent, task_list_mode and prompts — marking each value as user-set or defaulted.

This is a new UI feature request for the board itself (the web app in this repo, `src/public/`), not a FlowCharge Core orchestration change.

What is wanted: a new section on the board, possibly a new information tile near the top, alongside the existing info-row tiles (the KPI strip), that shows the project's configurable FlowCharge Core settings and their current effective values. Specifically, the settings that live in a project's optional `flowcharge/agents.md` file:

- `default_agent` — which subagent type/model runs each stage.
- `task_list_mode` — `spec` or `diff`.
- `prompts` — `manual`, `assist` or `cruise`.

For each setting: if the project's `flowcharge/agents.md` sets it explicitly, show that value; if it is unset, show the built-in default the orchestrator falls back to instead. The user must always see the effective value, not just what is literally written in the file. It must be visually clear which values are user-set and which are defaulted.

The tile's content must be accurate to `flowcharge/agents.md`'s own format and the flowcharge skill's documented defaults. As documented there at the time of writing:

- The file is optional. Its absence is not an error, and the built-in defaults apply.
- Its format is flat `key: value` lines in this canonical order, with any key omitted entirely when never set: `default_agent: <verbatim string>`, `task_list_mode: spec | diff`, `prompts: manual | assist | cruise`.
- Built-in default for `default_agent`: none — the run requests no explicit model, effort or role, so each stage's subagent inherits the calling agent's.
- Built-in default for `task_list_mode`: `spec`.
- Built-in default for `prompts`: `manual`.

Confirm these three settings and their defaults against `flowcharge/agents.md` and the flowcharge skill's own documentation before building, because the tile must stay accurate to them.

Note that this repository's own `flowcharge/agents.md` is a working example of a partial file: it sets `default_agent` and `prompts` and omits `task_list_mode`.
