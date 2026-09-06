---
id: WS-66-jqcbvp
type: workstream
workstream: WS-66-jqcbvp
slug: migrate-artefact-filenames-this-repo
title: "This repo's own flowcharge artefact files still use bare, non-ID-prefixed names"
description: "Once the ID-prefix rename script from Praxis's prx-orchestrate skill is available, run it against this repo's own flowcharge/ tree so its existing artefact files gain their ID prefix."
status: done
tags: [flowcharge, filesystem, feature]
created: 2026-08-23
updated: 2026-08-23
author: Anthony Koukoullis
depends_on: []
links: []
---

Run the ID-prefix rename script against this repository's own `flowcharge/` tree, so its existing artefact files gain their ID prefix.

This mirrors WS-55 (`/Users/akoukoullis/Work/AK/Praxis`), the equivalent migration already completed for the Praxis repo itself, using `skills/prx-orchestrate/scripts/prx-rename-artefacts.mjs` from the shared Praxis skill install.

This is a bare workstream: title and description only, no investigation, plan, or tasks yet. Investigate this project's own `flowcharge/` tree, write the plan, and author spec tasks locally, mirroring how WS-55 was worked in the Praxis repo — installed-skill freshness, an untracked-`flowcharge/` backup plan, a dry-run, the apply, and the before/after invariant checks (artefact ID set unchanged, only the legacy-filename warnings cleared).
