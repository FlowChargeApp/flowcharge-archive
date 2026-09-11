---
id: IL-19-f2xpx5
type: issuelist
workstream: WS-106-1xers0
slug: skill-install-target-resolution-and-lifecycle
title: "Release host disagreement between PLN-88 and ISS-50"
status: ready
created: 2026-09-11
updated: 2026-09-11
depends_on: []
links: [PLN-88-tpbc8f, IL-16-78bnrq, ISS-50-92mh3i, ISS-42-q1t9bh]
---

# FlowCharge Issue List

- [ ] ISS-51-kc70n7. PLN-88 and ISS-50 name different release hosts for the canonical skill list

  ```yaml
  id: ISS-51-kc70n7
  status: ready
  severity: medium
  author: Anthony Koukoullis
  description: "Two artefacts in workstream WS-106-1xers0 disagree about the release host that FlowCharge Core must fetch the published skill list from. Open question 1 of PLN-88-tpbc8f-plan.md (about lines 195-202) names akoukoullis/Praxis, renamed flowcharge-core-archive, and recommends leaving that constant alone. Issue ISS-50-92mh3i in IL-16-78bnrq-issuelist.md (about line 348) names https://github.com/FlowChargeApp/flowcharge-core and records that this host was verified live on 2026-09-11, the day the issue was filed. PLN-88's release-derived approach to rebuilding the canonical skill-id list depends on the host it names being the correct one."
  steps_to_reproduce:
    - "Open flowcharge/workstreams/WS-106-1xers0-skill-install-target-resolution-and-lifecycle/PLN-88-tpbc8f-plan.md and read Open question 1, about lines 195-202."
    - "Open flowcharge/workstreams/WS-106-1xers0-skill-install-target-resolution-and-lifecycle/IL-16-78bnrq-issuelist.md and read ISS-50-92mh3i, about line 348."
    - "Compare the two release hosts named."
  expected: "Both artefacts in the workstream name the same release host, so that any later execution of PLN-88's release-derived approach fetches the canonical skill-id list from the host the workstream has verified."
  actual: "PLN-88 names akoukoullis/Praxis (renamed flowcharge-core-archive) and ISS-50-92mh3i names https://github.com/FlowChargeApp/flowcharge-core. An executor following PLN-88 fetches from a host that a more recently verified issue in the same workstream states is not the real one, so the rebuilt canonical skill list is stale, wrong, or the fetch fails outright."
  affected: "flowcharge/workstreams/WS-106-1xers0-skill-install-target-resolution-and-lifecycle/PLN-88-tpbc8f-plan.md (Open question 1), flowcharge/workstreams/WS-106-1xers0-skill-install-target-resolution-and-lifecycle/IL-16-78bnrq-issuelist.md (ISS-50-92mh3i)"
  environment: ""
  tasks: []
  notes: "This does not block today's chosen fix for the Missing skills chip. That fix is the hand-updated skill-id list recorded directly on ISS-42-q1t9bh, not the release-derived approach. It blocks PLN-88's own release-derived design if that design is executed later. Confidence is high: both host values are quoted from the two named artefacts, and ISS-50-92mh3i states its host was verified live. Resolving this issue means reconciling the two artefacts to one host, not changing any source code."
  ```
