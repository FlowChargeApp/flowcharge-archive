---
id: IL-6-ngnx6e
type: issuelist
workstream: WS-35-970q8q
slug: new-id-format-compatibility-bugs
title: "New artefact ID format compatibility bugs"
status: done
created: 2026-08-17
updated: 2026-08-17
depends_on: []
links: []
---

# PRX Issue List

- [x] ISS-7-2zokm9. Workstream detail request returns HTTP 400 for suffixed workstream ids

  ```yaml
  id: ISS-7-2zokm9
  status: done
  severity: high
  author: Anthony Koukoullis
  description: "The workstream-detail request handler validates the workstream id with the regex /^WS-\\d+$/. The regex requires the id to end immediately after its digits. An id in the current Praxis shape TYPE-N-SUFFIX, for example WS-16-a3x9k2, fails the test. The handler then returns HTTP 400 and never reads the workstream. The Praxis and Praxis-Website projects that this dashboard already tracks use the suffixed shape today, so the failure is live and not tied to any future migration."
  steps_to_reproduce:
    - "Open the dashboard against a project whose workstream folders use the suffixed id shape, for example Praxis or Praxis-Website."
    - "Request the detail view for a workstream whose id carries a suffix, for example WS-16-a3x9k2."
    - "Read the HTTP response from the server."
  expected: "The server accepts the valid workstream id and returns the workstream detail data."
  actual: "The server returns HTTP 400 with the body { error: 'Malformed workstream id WS-16-a3x9k2' }. No detail data is returned."
  affected: "src/server.ts:262 — the workstream-id shape check in the single-workstream detail request handler."
  environment: ""
  tasks: [TL-31-m0bhqi.3]
  notes: "The shape check also guards against path traversal, because reqPath is already decoded at this point. Any correction must keep that guard intact and must still accept the old unsuffixed shape. Verified by reading the live regex and testing it against a real migrated id."
  ```

- [x] ISS-8-8httpx. Issues with suffixed ids are silently dropped by the issue-line parser

  ```yaml
  id: ISS-8-8httpx
  status: done
  severity: critical
  author: Anthony Koukoullis
  description: "Three separate patterns parse an issue checkbox line, and all three require an issue id followed immediately by a literal dot, in the form ISS-\\d+\\. — the ISSUE_ITEM constant, the block-splitting pattern, and the per-block match pattern. A migrated issue line reads '- [x] ISS-18-awinon.' and carries a suffix before the dot, so none of the three patterns match it. The line is not recognised as an issue line at all. Nothing errors and nothing warns, so the issue disappears from the dashboard data with no signal to the user."
  steps_to_reproduce:
    - "Open the dashboard against a project whose issue lists use the suffixed id shape, for example Praxis or Praxis-Website."
    - "Open a workstream that contains an issue list with lines in the form '- [x] ISS-18-awinon. Some title'."
    - "Compare the issue count and the listed issues in the dashboard against the issue list file."
  expected: "Every issue line in the file is recognised, counted, and shown, whether or not its id carries a suffix."
  actual: "Suffixed issue lines match none of the three patterns. The issues are neither counted nor extracted. They vanish from the dashboard with no error, no warning, and no indication that data is missing."
  affected: "src/lib/extract.ts:53 (ISSUE_ITEM), src/lib/extract.ts:130 (block split pattern), src/lib/extract.ts:132 (per-block match pattern). Line 123 consumes ISSUE_ITEM for the done/total counts."
  environment: ""
  tasks: [TL-31-m0bhqi.1]
  notes: "Severity is critical because the failure is silent data loss, not a visible error. All three patterns must be corrected together, because a fix to one alone leaves the counts and the extracted list disagreeing. Verified by running the parsing logic against the live migrated form '- [x] ISS-18-awinon.' and confirming no match."
  ```

- [x] ISS-9-xzo6ao. artefactIdNumber reads the sort key from the random suffix, not the sequence number

  ```yaml
  id: ISS-9-xzo6ao
  status: done
  severity: high
  author: Anthony Koukoullis
  description: "artefactIdNumber produces the numeric sort key for an artefact id by reading the text after the id's LAST hyphen. That is correct for the old shape TYPE-N, where the last hyphen precedes the sequence number. It is wrong for the current shape TYPE-N-SUFFIX, where the last hyphen precedes the random alphanumeric suffix. The function therefore parses the suffix instead of the sequence number. It always returns a number and never throws, so the wrong key is not visible at the call site."
  steps_to_reproduce:
    - "Call artefactIdNumber('TL-175-ab12cd') and record the return value."
    - "Call artefactIdNumber('IL-9-000123') and record the return value."
    - "Open a workstream detail view for a project that uses suffixed ids and read the order of the artefacts list."
  expected: "artefactIdNumber('TL-175-ab12cd') returns 175 and artefactIdNumber('IL-9-000123') returns 9, so artefacts sort by their sequence number."
  actual: "artefactIdNumber('TL-175-ab12cd') returns 0, because 'ab12cd' is not a finite number and the function falls back to 0. artefactIdNumber('IL-9-000123') returns 123, because the random suffix happens to parse as a number. Both keys are wrong, and the resulting artefact order is wrong but looks plausible."
  affected: "src/lib/extract.ts:70 (artefactIdNumber). Consumed by the artefact sort comparator at src/lib/extract.ts:160-161."
  environment: ""
  tasks: [TL-31-m0bhqi.2]
  notes: "The function exists to stop string ordering placing IL-9 after IL-85, so any correction must keep that intent and must still handle the old unsuffixed shape. It must also keep the non-NaN fallback, because a NaN sort key makes the sort order implementation-defined. Verified by running the function against both example inputs and recording the actual outputs."
  ```

- [x] ISS-10-5b1rra. wsIdNum fuses the sequence number with the suffix digits and mis-sorts the board

  ```yaml
  id: ISS-10-5b1rra
  status: done
  severity: high
  author: Anthony Koukoullis
  description: "wsIdNum builds the numeric sort key for a workstream id by removing every non-digit character and parsing what remains as one number. That is correct for the old shape TYPE-N, for example WS-16, which yields 16. It is wrong for the current shape TYPE-N-SUFFIX, because the hyphens are removed and the sequence number is joined to any digit characters inside the random suffix. The function always returns a number and never throws, so the wrong key is not visible at the call site. This is the same class of silently wrong comparison as ISS-9-xzo6ao, but in the browser-side code instead of the server-side code."
  steps_to_reproduce:
    - "Call wsIdNum('WS-16-a3x9k2') and record the return value."
    - "Open the board for a project whose workstream ids carry a suffix, for example Praxis or Praxis-Website."
    - "Set the board sort control to 'id' and read the order of the cards in each column."
  expected: "wsIdNum('WS-16-a3x9k2') returns 16, so the board sorts the cards by their workstream sequence number."
  actual: "wsIdNum('WS-16-a3x9k2') returns 16392. The digits 3, 9 and 2 inside the suffix a3x9k2 are joined to the sequence number 16. The board card order under the id sort is therefore wrong, and no error or warning is shown anywhere."
  affected: "src/public/app.ts:60 (wsIdNum). Its only call site is the board card sort comparator at src/public/app.ts:284, for sortKey === 'id'."
  environment: "Browser-side dashboard code."
  tasks: [TL-31-m0bhqi.4]
  notes: "The function exists to stop string ordering placing WS-9 after WS-85, so any correction must keep that intent and must still handle the old unsuffixed shape. It must also keep the non-NaN fallback, because a NaN sort key makes the sort order implementation-defined. Found during the fix-approach investigation for this workstream and filed afterwards. Verified by running the live function against 'WS-16-a3x9k2' and recording the actual output 16392."
  ```
