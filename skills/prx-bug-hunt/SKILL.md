---
name: prx-bug-hunt
description: Perform a systematic, read-only hunt for actual and latent bugs in code the user points at — a file, directory, module, the current diff, or the whole codebase (default when no target is named). Finds defects that produce wrong results, crashes, data corruption, resource leaks, or failures under realistic input, timing, or scale; verifies each candidate by tracing a concrete failure scenario; reports findings ranked by severity and then STOPS without fixing anything. Use whenever the user asks to find bugs, hunt for bugs, audit code for issues or defects, asks "what's broken in", "look for problems in", "is there anything wrong with", "check this for bugs", or wants latent/edge-case bugs surfaced — even casually phrased and even when no file is named. Also triggers on /prx-bug-hunt. Do NOT use for pull-request or code review work (a separate skill handles that), do NOT use for style/refactoring/cleanup requests (that belongs to optimize-code), and do NOT use for feature planning, enhancements, or "what is missing from this app" requests (prx-plan-feature owns those) — this skill reports existing code that behaves wrongly, never functionality that ought to be added. Part of the Praxis suite (parallel successor to ak-bug-hunt).
---

# Bug Hunt

You are a detective, not a fixer. The job is to find defects — code that produces
wrong results, crashes, corrupts data, leaks resources, or fails under realistic
conditions — including latent bugs that only fire given the right input, timing, or
scale. You report findings and stop. Fixing is a separate task the user will
explicitly request (usually per-finding) after reviewing the report.

Why this separation matters: a report the user can trust and triage is worth more
than a pile of unreviewed patches. Mixing detection with fixing biases the hunt
toward bugs that are easy to fix rather than bugs that matter, and it changes the
code out from under the user before they've decided anything.

## Ground rules (read before hunting)

- **READ-ONLY.** Never edit, create, or delete code files. The only outputs are the
  report in chat and — only if the user asks — an issue-list file (see "Filing
  findings" below). This includes "trivial" fixes: do not make them.
- **Bugs only, not quality.** Style, naming, duplication, complexity, and
  architecture are out of scope (the optimize-code skill owns those). A finding must
  describe broken or breakable _behavior_. "This is ugly" is not a finding; "this
  returns the wrong value when the list is empty" is.
- **No feature work. An absence is not a bug.** Functionality the code was never
  written to have is out of scope, however obviously useful — missing auth, missing
  middleware, missing validation, missing rollback, an unimplemented option, an
  API that returns less than you'd like. A finding must describe code that _exists
  today_ producing a wrong outcome, not code that ought to exist. Litmus test: if the
  fix is "add X" rather than "correct X", it is a feature request — drop it and move
  on. Never propose, plan, scaffold, or file features; feature planning belongs to
  prx-plan-feature.
- **Every finding must name an observable symptom that fires today.** State the wrong
  output, crash, corruption, leak, or hang a user or caller would actually see given
  the real current code and config. If your own trace concludes "no effect today",
  "benign", "cosmetic", "nil impact", or "latent contract violation" — that is not a
  finding, no matter how real the underlying inconsistency. A latent bug is one that
  fires today only under specific input/timing/scale; a bug that cannot fire today
  under any input because the surrounding code neutralises it is not latent, it is
  absent — drop it. Do not use the `low` tier as a home for impactless observations.
- **Every finding stands on a traced failure scenario**, not on a rule, lint
  pattern, or smell. If you cannot articulate the concrete input, state, timing, or
  sequence that triggers the wrong behavior, it is not a finding — drop it. False
  positives destroy trust in the whole report.
- **Do not run the project's test suites** unless the user explicitly asks. Rely on
  reading and tracing code. Running a small isolated script to confirm a language or
  library behavior (e.g., "does this parse function actually throw on empty input?")
  is fine and encouraged when it settles a question.
- **Deduplicate.** One root cause = one finding, with all affected call sites listed
  under it. Ten symptoms of the same broken helper is one finding, not ten.

## Workflow

Work through these phases in order. Each exists to protect the quality of the final
report: recon prevents shallow pattern-matching, verification kills false positives.

### Phase 1 — Scope confirmation

Determine the target. The user may name a file, directory, module, or "the current
diff" (use `git diff` / `git diff --staged` plus untracked files). If no target is
named, the target is the whole codebase.

Before hunting, state briefly in chat:

- what you're about to hunt through (paths, approximate file count and LOC — a quick
  `find`/`wc` is enough),
- roughly how deep the pass will be (e.g., "full pass over all 40 files" vs.
  "prioritized pass: entry points and data-mutating paths first, utility/config
  last").

This is a statement of intent, not a request for permission — proceed immediately
after stating it, unless the scope is genuinely ambiguous (e.g., a monorepo where
"the backend" could mean two things), in which case ask.

If the target is large (roughly >20k LOC or >100 files), hunt in prioritized order:
entry points and data-mutating paths first, then external boundaries, then pure
logic, then utilities. Say up front what may not get covered, and confirm what was
and wasn't covered in the final report.

### Phase 2 — Reconnaissance

Bugs live at the seams; map the seams before hunting. Build a working model of the
target before reading anything with suspicion:

- **Entry points**: where execution starts — HTTP routes, CLI commands, message
  handlers, cron jobs, exported public API.
- **Data flow**: what data comes in, how it's transformed, where it's persisted or
  sent out.
- **External boundaries**: APIs called, databases, filesystem, network, environment
  variables, third-party libraries. Every boundary is a place where assumptions can
  be wrong.
- **Concurrency model**: threads, async tasks, event loops, queues, shared state,
  background jobs. What runs at the same time as what?
- **Error-handling strategy**: how does this codebase intend to handle failure —
  exceptions, result types, error codes, middleware? Deviations from the intended
  strategy are prime hunting ground.

Skim broadly rather than reading deeply here; the goal is a map, not findings. Note
suspicious areas for Phase 3, but don't record findings yet.

### Phase 3 — Detection

Sweep the target category by category using the checklist below. For each suspected
bug, trace the actual code path before recording it as a candidate: read the
callers, the callees, and the data shapes involved. Pattern-matching alone ("this
looks like a classic off-by-one") is not enough — the pattern is where you start
looking, the trace is what earns the candidate a place on the list.

#### Category checklist

Sweep every category; say so in the report if one was skipped and why. The examples
keep passes consistent between runs — they are illustrations of the shape of bug to
look for, not an exhaustive list.

This is a list of symptoms to search for in code that _already exists_, not a list
of properties the code ought to have. Several items below describe something being
absent (no rollback, no eviction, no validation). That phrasing points you at where
wrong behavior tends to hide — it does not license a finding for the absence itself.
A hit requires a concrete wrong outcome you can trace today; "the code doesn't do X
yet" is a feature request, not a hit (see the ground rules).

1. **Logic errors** — wrong operators or inverted conditions (`<` for `<=`, `&&`
   for `||`, negation dropped during a refactor); off-by-one and incorrect boundary
   handling (loop bounds, slice indices, pagination edges); copy-paste errors
   between similar blocks (second branch still using the first branch's variable);
   branches that were meant to be reachable but never are.
2. **Null/absent values & type holes** — optional/nullable values dereferenced
   without a check; unsafe casts or type assertions that silence the checker while
   the runtime shape differs; escape hatches (`any`, `Object`, `void*`, dynamic
   typing) hiding a real mismatch; wrong assumptions about data shape (field
   renamed, list where an object was expected, absent vs. empty).
3. **Async & concurrency** — async operations started but never awaited or joined,
   so failures vanish and ordering is accidental; check-then-act windows (check a
   record exists, then act on it after it could have changed); shared mutable state
   accessed from concurrent paths without synchronization; unhandled rejections or
   uncaught errors in background work; deadlocks from inconsistent lock ordering.
4. **Error handling gaps** — swallowed exceptions (empty catch, catch-and-log for
   errors that should abort), where the caller then acts on a result that was never
   produced; catch blocks that discard the original cause so a real failure surfaces
   as a misleading one; failure paths that leave state half-mutated, so the next read
   observes an impossible state; retries of non-idempotent operations that double an
   effect (retrying a payment call that may have succeeded).
5. **Resource leaks** — handles, connections, streams, or listeners opened but not
   closed on all paths (especially the error path); timers or intervals never
   cleared; caches, queues, or collections that grow without eviction on a path that
   runs repeatedly, until memory is exhausted; subscriptions without teardown.
6. **Data integrity & state** — multi-step writes without a transaction, so a crash
   mid-sequence leaves inconsistent data; invariants that can be violated between
   operations; stale reads (cached or captured value used after the source
   changed); serialization/deserialization mismatches; timezone, encoding, or
   numeric-precision bugs (naive datetimes compared to aware ones, floats for
   money).
7. **Boundary & input validation** — external input used without validating bounds,
   size, or format; client-supplied data trusted for authorization or pricing
   decisions; injection risks (input concatenated into queries, shell commands, or
   paths). Rate a security finding against the code's _intended deployment and threat
   model_, not in the abstract: a control that was deliberately never built (no auth
   on a localhost-only dev tool, permissive CORS on a single-user local server) is a
   feature absence, not a defect — the ground rules apply, drop it. A security
   finding is a control the code _claims or relies on_ that is defeatable by a
   reachable input (a validation that can be bypassed, an escape that can be
   injected, a check that a caller can skip). Reserve `critical` for such reachable
   exploits against the real threat model, and state that threat model in the finding.
8. **Integration & contract mismatches** — caller and callee disagreeing on shape,
   units, or semantics (one side sends milliseconds, the other reads seconds);
   drift between API/schema definitions and actual usage; wrong assumptions about
   third-party behavior (assuming sorted results, assuming a call is atomic);
   config or environment values that differ between dev and production.
9. **Edge cases & scale** — empty collections, zero, negative, and max values;
   unicode and multi-byte input where lengths or offsets matter; first-run and
   concurrent-first-run states (empty DB, missing directories); behavior at
   10,000× typical input size (quadratic loops that hang, memory that grows with
   input until it OOMs, an unpaginated query whose result set grows with data volume
   until it times out); clock changes, timeouts, and network partitions mid-operation.

### Phase 4 — Verification

For each candidate from Phase 3, attempt to confirm it by tracing one concrete
failure scenario end-to-end through the real code: this input arrives here, flows
through these functions, and produces this wrong outcome.

Before classifying, run each candidate through two gates — a candidate that fails
either is not a finding, discard it:

- **Existence gate.** Does this describe code that exists today behaving wrongly, or
  code that is missing? If the honest answer is "the code doesn't do X yet" — no
  auth, no middleware, no rollback, no eviction, an unhandled option — it is a
  feature request. Drop it, however valuable X would be.
- **Impact gate.** Does the traced scenario produce a symptom a user or caller sees
  today under real current code and config? If your trace concludes "no effect
  today", "benign", "cosmetic", "nil impact", or "the value happens to make this
  safe" — the surrounding code neutralises it, so it is not a finding. An
  inconsistency between two code sites is only a finding if one of them is reachably
  wrong now; "these two should match" is a quality observation for optimize-code.

Then classify:

- **CONFIRMED** — you traced a specific input/state to a specific wrong outcome
  through the actual code.
- **PLAUSIBLE** — genuinely suspicious, but full confirmation would require running
  the system (e.g., a race whose window depends on runtime timing). State the open
  question that blocks confirmation.

**Discard** anything that turns out to be handled correctly upstream or downstream —
a missing null check doesn't matter if every caller validates first (but note: one
unvalidated caller makes it a finding again). When torn between reporting a maybe
and staying silent, trace deeper first; only if it's still unresolvable, report it
as PLAUSIBLE with the open question stated explicitly.

### Phase 5 — Report, then stop

Deliver the report in chat, findings ranked by severity (critical first), each in
the exact format below. Then STOP. Do not edit or create any file: no fixes, no new
source files, no tests, no scaffolding, no migrations, no design or roadmap
documents, no "while I was in there" changes. The chat report (plus, only if the
user asks, the issue-list file in "Filing findings") is the entire deliverable. If
the user wants a fix, they will ask for it — usually per finding.

End with a short summary:

- counts by severity and by confidence,
- how many candidates were investigated and dropped as feature requests or
  no-impact-today, so the boundary the hunt held is visible,
- the top findings restated in one line each,
- what was and wasn't covered (areas unswept, categories skipped, depth caveats).

Keep the summary tight — it's the part the user reads first and forwards to others.

## Finding format

Every finding uses exactly this structure:

```markdown
### [SEVERITY] <one-line title>

- **Location**: path/to/file.ext:123 (list all affected sites if one root cause has several)
- **Summary**: one sentence stating the defect.
- **Failure scenario**: the concrete input, state, timing, or sequence that triggers
  it, and the resulting wrong behavior (wrong output, crash, data loss, hang, leak).
- **Severity**: critical | high | medium | low
- **Confidence**: CONFIRMED | PLAUSIBLE (for PLAUSIBLE, state the open question)
- **Fix class**: `correction` — every finding must be a correction to existing code.
  If the only fix you can write is `new capability` (adding a component, subsystem,
  validation, or option the code never had), the candidate is a feature request and
  does not belong in this report; you should have dropped it at the existence gate.
  This field exists so that anything downstream (a task generator reading the issue
  file, a triaging human) can trust that no entry here asks for something to be built.
- **Fix direction**: one line sketching the shape of the correction — for the user's
  planning only; do not apply it, and do not write code in it. Phrase it as "correct
  X to Y", naming the existing code that changes. If you cannot sketch it without
  introducing a new module, file, or subsystem, the finding is a feature request:
  go back and drop it.
```

Severity scale:

- **critical** — data loss/corruption, security vulnerability, or crash on a main path.
- **high** — wrong results, or crash on an edge path.
- **medium** — degraded behavior, resource leak, reliability problems under load.
- **low** — latent hazard requiring unlikely conditions to fire.

## Filing findings to an issue list (optional)

After delivering the chat report, offer to also record the findings in an
issue-tracking file — but only write one if the user says yes or asked for it up
front. This is the single exception to read-only, and it touches tracking files,
never code.

If an issue-list skill is available in the session (e.g., `prx-issue-list`, which
manages per-workstream Markdown issue files at
`prxwork/workstreams/<WS-N>-<slug>/prxissuelist.md`), use it and
follow its schema — one issue per finding, carrying over location, severity,
confidence, and the failure scenario. Otherwise, write a plain Markdown findings
file wherever the user directs.

The issue file must map 1:1 to the findings already delivered in the chat report:
one issue per finding, no issue for anything not in that report, and no new findings
discovered while filing. Every issue is a `correction` (see Fix class) — never file a
feature request, an enhancement, or a no-impact-today observation as an issue, even
if you were tempted to during the hunt. Remember why this matters: a later session
generating tasks reads only the issue file, not this hunt's reasoning, and its only
forward-looking text is your fix direction. An issue whose fix reads "add auth" or
"mount middleware" is indistinguishable from a feature spec at that point and will be
built. Keep the file free of anything you would not want silently turned into code.

Write only to the issue-list file. Never create or edit source files, tests, config,
or docs. Filing issues is still not fixing. After filing, stop.
