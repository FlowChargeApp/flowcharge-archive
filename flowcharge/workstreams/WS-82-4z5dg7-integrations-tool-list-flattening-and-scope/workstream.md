---
id: WS-82-4z5dg7
type: workstream
workstream: WS-82-4z5dg7
slug: integrations-tool-list-flattening-and-scope
title: "Flatten the Manage Integrations CLI/desktop-app tool tabs into one list"
description: "The Manage Integrations dialog splits its four tools across a Command-line tools / Desktop apps ARIA tablist, nested under the (unrelated, untouched) Global/Project scope tabs. Claude Code and OpenCode are each both a command-line tool and a desktop app now, so the CLI/desktop split no longer means anything and should become one list, under both Global and Project scope. The category field must stay alive because src/lib/agentic-tools-detect.ts switches on it to pick a CLI or GUI-app detection strategy; only the UI's use of it for layout goes away. Earlier investigation wrongly read 'the project tab' as a second ask to flatten the Global/Project scope control itself — corrected: the user meant the CLI/desktop tabs specifically appear while viewing the Project tab too, not a second flattening target. Global/Project stays exactly as it is."
status: done
tags: [agentic-tools, ui, ux]
created: 2026-08-30
updated: 2026-08-31
author: Anthony Koukoullis
depends_on: []
links: []
---

Drop the Command-line tools / Desktop apps tabs in Manage Integrations for one tool list, under both the Global and Project scope tabs, which stay exactly as they are.

## What the user said

"Currently there is just an install button next to the coding environment of choice. There are four listed. On the command-line tools tab, there's just Claude Code and OpenCode. On the desktop apps tab, there is Cursor and Windsurf. This is where the line blurs — Claude Code is both a command-line tool and a desktop app, same as OpenCode now. It shouldn't matter whether it's command-line or desktop — there should be one list, no tabs. A global config file is a global config file. And the same goes for 'the project tab' — same thing, one list, no tabs."

## Correction, from the user directly (chat, 2026-08-30)

The user does not mean the Global/Project tabs. The actual dialog has a Global tab and a Project tab at the top; underneath either one sit two headings, "Command-line tools" and "Desktop apps", that act like tabs — clicking either changes the visible tool list. It is this CLI/desktop-app split, appearing under both Global and Project, that the user wants flattened into one list. "The same goes for the project tab" meant the CLI/desktop split should be flattened there too, not that the Project tab itself is a second flattening target. Global/Project is not being touched by this workstream.

## Current state, confirmed by direct investigation

### 1. The user's count is exactly right

`TOOL_CATALOGUE` in `src/lib/agentic-tools-catalogue.ts` has exactly four tools: Claude Code (`category: 'cli'`), OpenCode (`category: 'cli'`), Cursor (`category: 'gui-app'`), Windsurf (`category: 'gui-app'`) — two and two, matching the user's description precisely.

### 2. The cli/gui-app tab split is real and is a literal ARIA tablist

`#integrations-tabs` in `src/public/index.html:69-75`, labelled `Command-line tools` / `Desktop apps`, backed by `INTEGRATIONS_TABS`/`selectIntegrationsTab` in `home.ts`. The single place `category` decides which panel a row renders into is one ternary at `home.ts:572`. Flattening this into one list is close to a pure rendering change: delete the tablist markup and its two panels for one container, delete the tab-selection JS, drop the ternary so every row appends to the same list, and update two other functions (`renderIntegrationsFailure`, `resetIntegrationsModalState`) that also name the two panel ids.

### 3. `category` is NOT purely a UI label — it drives which detection algorithm runs

`agentic-tools-detect.ts:11-20` switches on `category` to choose between a CLI detection strategy (PATH binary -> `confirmed`, config dir -> `likely` only) and a GUI-app detection strategy (install path -> `confirmed`, config dir capped lower). So the underlying detection code must keep the `category` field and its behavior — only the UI's use of it (which tab a row lands in) goes away. Confirmed: the actual catalogue data does NOT already track two separate config-dir families (a CLI form and a desktop-app form) for Claude Code or OpenCode — each has exactly one `configDir` per OS today. So the user's point that "the line blurs" is a real, forward-looking labelling concern (if either tool ships an app-bundle form later, today's `cli`-only categorization would miss it as a detection signal), not something the data model already contradicts.

### 4. The Global/Project scope control is a separate, untouched thing — confirmed correct as previously investigated, but NOT part of this workstream's ask

The actual UI element is a Global/Project **segmented control** (`#integrations-scope-seg` in `index.html:62-68`, two buttons with `data-scope="global"`/`data-scope="project"` and an `.active` class, plus a project `<select>`) — visually and semantically a different construct from the CLI/desktop-app tablist. The user confirmed directly (see Correction above) that this control is not being flattened: it stays as the Global/Project tab pair it already is. The CLI/desktop-app tablist this workstream flattens renders underneath it regardless of which scope tab is selected — flattening it must work identically at both Global and Project scope, since the user explicitly named both.

## Net ask

Flatten the cli/gui-app tool-list tabs into one unified list, rendered the same way under both Global and Project scope, keeping `category` alive as a detection-strategy field the UI simply stops using for layout. The Global/Project scope control itself is untouched — its install-destination behaviour, its eligibility logic, and its Global-scope-only "Already installed" chip all stay exactly as they are.

## Files in play

`src/public/home.ts`, `src/public/index.html`, `src/lib/agentic-tools-catalogue.ts`, `src/lib/agentic-tools-detect.ts`, `electron/agentic-tools-ipc-handlers.cts`, and the `/api/integrations/*` routes in `src/server.ts`.
