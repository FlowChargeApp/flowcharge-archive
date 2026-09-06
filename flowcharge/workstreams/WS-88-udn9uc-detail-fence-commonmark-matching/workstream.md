---
id: WS-88-udn9uc
type: workstream
workstream: WS-88-udn9uc
slug: detail-fence-commonmark-matching
title: "Detail fence parser only accepts exactly three backticks"
description: "src/lib/detail.ts hardcodes a 3-backtick code fence when it parses a task or issue item's attached YAML block, so any valid CommonMark fence that is longer or uses tildes is never recognized and the item expands with empty fields. Replace the hardcoded pattern with CommonMark's real fence rule: capture the opener's delimiter character and length, then accept only a closer of the same character with a length greater than or equal to the opener's."
status: backlog
tags: [parser, markdown, detail-modal, bug]
created: 2026-09-03
updated: 2026-09-03
author: Anthony Koukoullis
depends_on: []
links: []
---
The FENCE regex in src/lib/detail.ts matches only 3 backticks, so a 4-backtick or tilde YAML block in a task or issue item is never parsed and the item expands with no fields.

## The bug

`FENCE` in `src/lib/detail.ts:19` is defined as `/^(\s*)```(.*)$/`. It hardcodes exactly 3
backticks as the code-fence delimiter when parsing a task or issue item's attached YAML
block. This breaks on any well-formed CommonMark fence that uses 4 or more backticks, or a
tilde fence (`~~~` or longer). Both are valid, standard techniques for nesting a fenced
block inside another fenced block, where the outer fence needs a longer or different
delimiter than anything nested inside it.

## How this was found

TL-92-u2hvvl, a task list in the sibling Praxis project (not this one), used 4-backtick
fences for every task's YAML block. Confirmed in Node that the regex mis-parses a
4-backtick opener: the 4th backtick gets folded into the captured language-tag group, so
the captured tag never equals the literal `yaml`, and the block is never recognized as a
fence. Every task and subtask in that file therefore renders with an empty fields object
when expanded in this app's detail modal. The subtask appears in the list, but expanding it
shows nothing. TL-92 itself is not being fixed or touched by this workstream. Only the
parser is in scope.

## The fix, already discussed and agreed

Implement CommonMark's actual fence-matching rule instead of the hardcoded assumption.
Capture the opening fence's delimiter character (backtick or tilde) and its length (3 or
more) at the point it opens. Then accept only a closing fence that uses that same
character, with a length greater than or equal to the opener's length. This handles
arbitrary nesting for free, since a shorter inner fence can never close a longer outer
fence.

## Scope check already done

Only `FENCE` in `src/lib/detail.ts` has this hardcoded 3-backtick pattern.
`src/lib/extract.ts` and `src/lib/yaml-block.ts` were checked and do not share it.

This is a backlog idea only. No plan, no task list, no code change yet.
