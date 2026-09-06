---
id: WS-49-bxknyf
type: workstream
workstream: WS-49-bxknyf
slug: select-folder-button-order
title: "Add-project panel shows path field and Choose folder button together in Electron"
status: done
tags: [electron, ui]
created: 2026-08-20
updated: 2026-08-20
author: Anthony Koukoullis
depends_on: []
links: []
---

Fix the CSS bug that shows the path field and "Choose folder" button at the same time in the Electron app, instead of just one at a time as designed.

Originally reported as a button-placement request: the path field, "Add project" button, and "Choose folder" button all appear together on the home page's add-project panel in the Electron build. Investigation found the real cause: `src/public/home.ts`'s `initAddProjectControl()` correctly sets `add-form.hidden = true` in Electron mode, but `styles.css:624`'s `.add-form { display: flex; ... }` rule overrides the browser's default `hidden`-attribute behavior, so the form renders anyway. `#choose-folder-button` has no such override and hides/shows correctly.

Decision: restore the original single-control-at-a-time design — fix the CSS so `hidden` actually hides `.add-form` in Electron mode, leaving only "Choose folder" (pick-and-add in one click). The path field + "Add project" button stay for browser-tab mode only, where there is no native picker. No button repositioning is needed once only one control shows at a time.
