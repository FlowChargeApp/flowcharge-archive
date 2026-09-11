// Golden list of the FlowCharge Core skill ids, pinned for the test suite.
//
// This literal pins the exact membership and count of
// CANONICAL_PRAXIS_SKILL_IDS in src/lib/agentic-tools-canonical-skills.ts.
//
// It is a deliberate, hand-maintained duplicate. It is NOT derived from the
// code under test, and it must never be: a list derived from the subject
// would agree with whatever that subject happens to hold, and would pin
// nothing. Any edit to CANONICAL_PRAXIS_SKILL_IDS therefore requires an edit
// to this file in the same change, so the canonical list cannot drift by
// accident.
//
// This list matches the skill folders installed on the owner's machine, NOT
// the published v0.1.0 release archive. A later reader must not "correct" it
// against that release.
//
// This is a fixture module, not a test file. It declares no test case, and
// its name carries no '.test.' segment — a '.test.' name would make the
// runner double-register the cases of whichever file imports it.
export const EXPECTED_CANONICAL_SKILL_IDS: string[] = [
  'fc-dev-principles',
  'fc-git',
  'fc-issue-list',
  'fc-plain-text-kanban',
  'fc-plan-feature',
  'fc-task-list',
  'fc-validate',
  'flowcharge',
];
