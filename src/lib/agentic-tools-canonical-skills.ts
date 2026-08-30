// Provisional, hand-maintained duplicate of the canonical FlowCharge Core skill suite.
// WS-44-h5cpzp ("Vendor the Praxis skill suite into this repo as the
// installer's real content source", status: ready, not yet implemented as of
// this session) will eventually vendor the real skill content into this repo.
// Once that lands, this array should be replaced or derived from the real
// skills/ directory it adds, or from getInstallContent()'s returned skill
// ids, instead of being hand-maintained here.
//
// 'ak-prx-migrate' — a real skill present in this machine's own
// ~/.claude/skills/, per ISS-12-yngl4x's own repro steps — is NOT part of
// this suite and is deliberately excluded, so a future editor is not
// tempted to add it.
export const CANONICAL_PRAXIS_SKILL_IDS: string[] = [
  'fc-orchestrate',
  'fc-git',
  'fc-bug-hunt',
  'fc-issue-list',
  'fc-dev-principles',
  'fc-plan-feature',
  'fc-task-list',
  'fc-plain-text-kanban',
];
