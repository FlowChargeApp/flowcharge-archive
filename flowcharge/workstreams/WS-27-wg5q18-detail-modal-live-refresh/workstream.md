---
id: WS-27-wg5q18
type: workstream
workstream: WS-27-wg5q18
slug: detail-modal-live-refresh
title: "Open workstream detail modal doesn't reflect live source changes"
status: backlog
created: 2026-08-12
updated: 2026-08-18
depends_on: []
links: [WS-5-kxteoh, WS-7-c5ispw]
tags: [bug, ui, server]
---

The whole dashboard polls to update and reflect any changes occurring in the source praxis markdown files. But when a workstream's detail modal is open, the contents of its tabs do not update: while one is perusing the issues list, the task list, or the plan, they stay stale. If, for example, a task is added whilst this detail modal is open and one is on the tasks tab, the new task is not visible until the modal is closed and reopened.

Root cause not yet investigated. Likely candidates: the modal was built by WS-5 (card detail modal with issues/tasks tabs, done) on top of the live-refresh plumbing from WS-7 (live board refresh from flowcharge changes, done), and the modal's contents are snapshotted from the extractor payload rather than re-fetched on each poll; or the modal subscribes to the poll/SSE stream only at mount time and drops the subscription / holds a stale payload snapshot after the first update.

Expected behaviour: an open detail modal refreshes its issues list, task list and plan tab in place whenever the source markdown changes, with no close-and-reopen required. Detail should be scoped to whatever the built-in refresh cadence already is for the surrounding dashboard.