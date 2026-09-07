---
id: S-001
epic: E01
title: <story title>
kind: feature           # feature | chore | fix. Copied from the PRD story block, never decided here. A chore is real work with no user-facing capability (convergence refactor, deflake, hardening). A fix corrects behavior that already shipped. All three branch, gate, and ship identically.
fixes: n/a              # fix only. The story that shipped the defect, or none when the code predates the pipeline. n/a for feature and chore. Enforced by scripts/gate.mjs.
status: todo            # todo | in-progress | in-review | blocked | done | cancelled
autonomy: unattended    # unattended | supervised
ui_surface: false       # true when any acceptance criterion runs through a real UI or input mechanism (upload, drag-drop, form, clipboard). Set by the planner. Forces UI verification (docs/PROTOCOL.md).
depends_on: []          # e.g. [S-000]
branch: null            # story/S-001-slug once building
pr: null                # PR url once opened
gate: null              # docs/gates/S-001.yml once gated
confidence: null        # planner rates 1 to 10 against the acceptance criteria
---

## Summary
- Not gated yet.

<!-- The only part of this file most people will open. Four lines, never more,
     written by /next at the record phase from this story's own events in
     logs/events.jsonl. Never hand-written, and never re-authored from memory,
     every figure below already exists in the trail:

     - Outcome. <what someone can now do that they could not before. The record
       event's summary, quoted. Never the implementation. A story that shipped
       nothing says so, "Not shipped.", rather than describing an intention.>
     - Gate. <verdict, then the reason, or the word clean. Follow the blocking
       state and not only the verdict field, a gate can read PASS on every
       structured field while the merge is blocked on a D3. More than one
       reason, say how many and name the most severe. NO gate record at all is
       never "clean", it is "no gate, cancelled" or "no gate, never built",
       because absence of failures is not a passing verdict.>
     - Your call. <the decision owed to a human, or the word none. Every event
       carrying a `decision`, and every Notes entry tagged decision-owed. One
       line per distinct call. Two layers raising the same gap is agreement, not
       two decisions, so collapse those. Two genuinely different calls each keep
       their own line and this block runs to five, an amend-the-contract decision
       and a seed-a-follow-up decision are not interchangeable.>
     - Work. <rounds, tasks, files, test delta>

     Cost is deliberately NOT a line here. It lives in docs/COST.md, which
     scripts/cost.mjs projects from the same event trail, so a story would
     be restating a figure that already has a home and a reader comparing
     the two would have two places to look for one number. Changed
     2026-08-04 on Uma's call, reported from the first product to render
     the block. If you want spend while reading a story, /cost is one
     command and the doc is one click.

     Until the story is gated this stays the single line above, because a row of
     empty placeholders reads worse than a statement that nothing has happened.
     If a line cannot be filled from the events, the events are wrong and the fix
     is upstream, not here. -->

## Story
As a <user>, I want <capability>, so that <value>.

<!-- kind: chore instead uses a technical outcome line, one sentence, no As-a
     form, because a chore has no user and no capability. Example, "Every
     collapsing surface renders through one shared component." -->

## Origin
PRD story block, `**Added.**` marker. <e.g. /ideate, or 2026-07-25 D4 during
S-024. If it is not /ideate, the PRD Amendments section carries the why.>

## Acceptance criteria
The specification. What must be observably true when this story is done.

- [ ] **AC1.** <one observable behavior, checkable, no implementation detail>
- [ ] **AC2.** <one observable behavior>
- [ ] **AC3.** <the failure or edge case, stated as a behavior>

## Out of scope
<what a reader would assume is included and is not>

## Context
PRD: E01 / S-001. DESIGN: <screens>. ARCHITECTURE: <sections>.

## Tasks
The execution breakdown, written by the planner goal-backward from the acceptance
criteria. Each task names its layer and the files it touches. No task gets its own
branch, PR, or gate. The story is the unit that ships.

A task line is an instruction, imperative, under 25 words. Rationale, truth
tables, precedent and the reasoning behind a call belong in the plan prose above
this list, which is written for exactly that. A task line carrying its own
argument is unreadable and hides the instruction inside it.

- [ ] **T1** `[db]` <schema or migration change> -> `<files>`
- [ ] **T2** `[backend]` <handler, service, or API change> -> `<files>` -> satisfies AC1
- [ ] **T3** `[frontend]` <screen or component change> -> `<files>` -> satisfies AC2
- [ ] **T4** `[test]` <the durable test that proves it> -> `<files>` -> proves AC1, AC2

Layer tags: `db` | `backend` | `frontend` | `test` | `infra` | `docs`

## Test plan
How this story is proven. The command scripts/test.sh runs.

## Notes
The deep record. Every drift-rule choice, every finding, anything the reviewer
should know. Depth here is the point, it is what catches the second-round bug the
first round's fix was too narrow for. What is capped is the header, not the prose.

Each entry opens with one scannable line, then as much prose beneath it as the
entry needs:

    - YYYY-MM-DD | round N | D1 | high | fixed | <headline under 20 words>
      <prose beneath, uncapped>

Fields: date, round (`-` when not in a build round), drift rule `D1`..`D4` or `-`,
severity `high`/`medium`/`low`/`-`, disposition, headline. Disposition is one of
`fixed`, `logged`, `follow-up`, `decision-owed`, `blocked`.

**A `decision-owed` entry must also leave this file.** It goes into the event
stream as a `--decision` and into the gate's `findings` with
`outcome: decision-owed`. A call only a human can make must never exist solely as
a paragraph nine entries down, where nothing surfaces it.

## Open questions
(planner fills this only when confidence is below the profile threshold)
