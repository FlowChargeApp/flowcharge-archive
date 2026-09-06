---
id: WS-87-yh1alm
type: workstream
workstream: WS-87-yh1alm
slug: workstream-depends-on-chain-sort
title: "Sort workstreams by depends_on dependency-chain position"
description: "Chained workstreams are meant to run in a set order, but --list and index.md can only sort by id, created, updated, status or title, so the execution sequence is invisible. Add a sort that orders each chain from first link to last, ascending or descending, falls back to workstream id for unlinked workstreams, orders separate chains against each other by most recent updated date, and puts all chains above the unlinked workstreams in one list."
status: backlog
tags: [sort, dependencies]
created: 2026-09-02
updated: 2026-09-02
author: Anthony Koukoullis
depends_on: []
links: []
---

Add a `depends_on` chain-position sort to `fc-index.mjs --list` and to `index.md`'s workstream table, so a linked sequence reads first-to-last instead of only by id/created/updated/status/title.

## The request, as given

"I want to be able to sort the workstreams by their depends_on relationship links, ascending or descending, because some workstreams — ones I've actually created and linked up — can have many workstreams linked into a chain, when I want a sequence to be executed in a certain order. I'd love to be able to sort to see which is the first one that's going to be executed and which is the last one. For workstreams that are not linked in any way, it should fall back to sorting by workstream ID. For multiple separate sets of linked workstreams (multiple distinct chains), those sets should be ordered relative to each other by their most recent updated date — most recent first or last, ascending or descending. All chains should appear at the top of the list, with any non-linked workstreams appearing underneath them, in the same list."

## What the request asks for

- A new sort key, next to the existing ones, that orders workstreams by their position in a `depends_on` chain.
- Ascending or descending, so the user can read a chain from its first link or from its last.
- Within one chain, the order is the execution order: the workstream that runs first sorts first.
- A workstream linked to nothing falls back to sorting by workstream ID, the same fallback the other sorts already use for ties.
- Where several separate chains exist, the chains are ordered against each other by their most recent `updated` date, most recent first or last according to the direction.
- One single list, not two: every chain sits at the top, and every unlinked workstream sits underneath the chains.

## Where this lands in the existing behaviour

- `--sort` today accepts `id` (the default), `created`, `updated`, `status` and `title`, plus `severity` for `--list issues` only. `--desc` reverses the chosen sort, and ties break on `id` ascending. This is documented in `skills/flowcharge/CONVENTIONS.md` under "IDs" and in `skills/flowcharge/SKILL.md` under "Listing artefacts".
- `depends_on` is a frontmatter array of IDs carried by every artefact type, and it already drives the execute-tasks dependency gate. This feature is about the workstream-to-workstream chains only, not the artefact-level uses.

## Open design question — not resolved here

How the chains themselves are ordered relative to each other is deliberately unresolved. "Most recent updated" fixes the direction, but not the semantics or the tie-break. Which workstream's `updated` date represents the chain's date:

1. the most recently updated member of the chain,
2. the chain's root workstream, or
3. the chain's most recently completed link?

The tie-break between two chains sharing the same date is also undecided. Work this out at plan time, with the user, before any task list is authored.

## Status of this record

Backlog idea only. No plan, no task list and no code change yet. The record exists so a later `/flowcharge plan this` has everything it needs without the user re-explaining.
