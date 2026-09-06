---
id: WS-16-sg71an
type: workstream
workstream: WS-16-sg71an
slug: tasklist-fence-scanner-data-loss
title: "Task-list fence scanner silently discards tasks"
status: done
created: 2026-08-07
updated: 2026-08-08
depends_on: []
links: [WS-15-o60iyw]
tags: [extraction, parser, detail-modal, bug]
---
The code-fence scanner in `collectItems()` in `src/lib/detail.ts` only accepts a closing fence at the opening fence's exact indentation. When a task list has an unbalanced indented fence, the scan runs to end of file and silently drops every later task. This makes the detail modal's task count disagree with the card's count in 17 of 138 LAD workstreams. Found while investigating WS-15.
