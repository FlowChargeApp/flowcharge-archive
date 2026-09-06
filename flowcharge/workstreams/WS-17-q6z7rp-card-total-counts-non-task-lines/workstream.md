---
id: WS-17-q6z7rp
type: workstream
workstream: WS-17-q6z7rp
slug: card-total-counts-non-task-lines
title: "Board card total counts checkbox lines that are not tasks"
status: done
created: 2026-08-08
updated: 2026-08-08
depends_on: []
links: [WS-16-sg71an]
tags: [extraction, board, counts, bug]
---
`countChecks()` in `src/lib/extract.ts` counts every checkbox-shaped line in a task list, including prose bullets nested inside a task's own body. The detail modal counts only numbered task items, so the card total overstates the real count. In LAD WS-74 the card reads 98 against 86 real tasks. Found while executing WS-16, and deliberately excluded from that workstream's scope.
