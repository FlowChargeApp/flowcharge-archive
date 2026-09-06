# Cross-repo references left by the artefact ID suffix upgrade

This is a plain record, not a Praxis artefact. It carries no frontmatter and no
artefact id, and nothing parses it.

It exists because the Phase 4 migration of Praxis-Launch created a coupling that can be
met from two directions. Someone may arrive from Praxis-Launch and read its own mapping
record, or someone may arrive from this workstream and have no reason to open another
project's files. The same facts are therefore written in both places.

The authoritative copy is the `## Known external references` section of
`/Users/akoukoullis/Work/AK/Praxis-Launch/flowcharge/id-migration-2026-08-17.md`. The text
below is that section, copied here unchanged in substance.

Praxis-Website is out of scope for this workstream. It is not edited, and this record
is the entire handling of the reference it holds.

---

## Known external references

One reference to a Praxis-Launch id lives outside this project, in a different
repository. It is recorded here rather than rewritten, because that repository is
outside this migration's ownership and is not edited by it.

- `/Users/akoukoullis/Work/AK/Praxis-Website/components/Blocks/Hero.tsx`, line 60,
  holds a code comment reading `Provisional headline. WS-31 task 1.2 settles the
  one-sentence description of Praxis, and its wording replaces this line.`
  That `WS-31` is Praxis-Launch's workstream. Its new id is **`WS-31-uvbvjr`**, and the
  cited task 1.2 sits in that workstream's `tasklist.md`, now `TL-26-57fvk6`.
  The comment is left exactly as it is. Anyone resolving it should read `WS-31` there
  as `WS-31-uvbvjr` in Praxis-Launch.

### Why that reference was ambiguous, and why it no longer is

Praxis-Launch's numbers were drawn from the same number space as the separate `Praxis`
project, so a bare `WS-31` written in a third repository could name either project's
workstream. The suffix removes the ambiguity: `WS-31-uvbvjr` names one artefact in one
project and cannot be confused with any other project's number 31.

### Claim markers for these numbers no longer exist in Praxis

The `Praxis` project's own earlier migration deleted `flowcharge/ids/WS-31`,
`flowcharge/ids/PLN-23` and `flowcharge/ids/TL-25` as leaked claims. Those are three of
Praxis-Launch's four live artefact ids, so Praxis-Launch's numbers no longer carry a
protective marker in `Praxis`, and nothing stops `Praxis` from issuing those numbers
again.

That is now harmless, and the new suffix is precisely what makes it harmless. A future
`Praxis` artefact numbered 31 would be `WS-31-<some other suffix>`, which is a
different id from `WS-31-uvbvjr`. Collisions between the two projects can no longer
occur on the number alone. No marker is recreated in `Praxis`, and none is needed.

### Praxis-Launch's own marker gap

Praxis-Launch holds 4 artefacts and 1 claim marker. Only `TL-26` had a marker, and it
was renamed to `TL-26-57fvk6` with its artefact. `WS-31`, `PLN-23` and `TL-25` have no
marker, and the counters in Praxis-Launch's `flowcharge/ids.md` stand ahead of them.
This gap is recorded, not repaired: no marker is created and none is deleted.

## Full Praxis-Launch id map, for resolving any of the above

| Old | New |
|---|---|
| WS-31 | WS-31-uvbvjr |
| PLN-23 | PLN-23-974ghz |
| TL-25 | TL-25-f4c7d8 |
| TL-26 | TL-26-57fvk6 |
