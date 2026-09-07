---
description: End this session cleanly and set up the next one. Writes docs/HANDOFF.md with what is mid-flight, what is parked, and the close-out answers. Use when context is heavy or an era is done.
argument-hint: [note about what the next session should focus on]
---

Close out this session. Note for the next one, if given: $ARGUMENTS

Read `docs/SUCCESSION.md` first and follow it. It is the contract, this file is the procedure. If it
is missing, stop and say so rather than improvising a handover from memory.

From this point, **finish, do not start.** No new stories, no new subagents, no new investigations.
Anything already diagnosed gets landed in this same turn.

1. **Check whether it is too early.** Read `docs/SUCCESSION.md`, When not to hand off. A story
   mid-build, an open unmerged PR, a check still running, or an unanswered question only you hold,
   any of those means say so and stop. Idle is not finished.

2. **Measure live state yourself, do not recall it.** Run `node scripts/phase.mjs --json` for where
   the pipeline stands, `node scripts/landed.mjs` for stories that merged and were never written
   back, and `git status --porcelain` plus the default branch's latest run for green and clean. Fix
   what you find. A merged story that never reconciled is fixed with `/land`, not described.

3. **Leave the two hard conditions satisfied.** The default branch green, and the tree clean or the
   dirt named by path in the handoff. `scripts/on-stop.sh` autosaves on story and epic branches only,
   so anything else is on you.

4. **Answer the nine close-out questions** in `docs/SUCCESSION.md`. Ask all nine by name, do not trim
   to the ones that feel relevant. Answer them as this session, plainly. Where an answer names a
   deferral, it carries an owner, a next action, and a trigger, or it is recorded as dropped.

5. **Route each learning to a mechanism.** A trap about this harness's own scripts goes into
   `docs/TRAPS.md`. A lesson about this product's stack goes into `docs/CONVENTIONS.md`. A contract
   change goes into `docs/PROTOCOL.md` or `docs/STRUCTURE.md`. A rule that can be checked without a
   model goes into `scripts/drift.mjs` or `scripts/gate.mjs`. Writing a learning down is not the same
   as enforcing it, so name which one you did.

6. **Write `docs/HANDOFF.md`.** Under 60 lines, the shape in `docs/SUCCESSION.md`. It overwrites the
   previous handoff, it is not an append log. Never restate anything `docs/STATE.md` already says,
   cite it. Include the note in $ARGUMENTS verbatim if one was given.

7. **Re-render and report.** Run `node scripts/render-docs.mjs` so the board matches, then print the
   handoff's pending items and hazards to the operator in under fifteen lines, and say plainly what
   the next session should run first.

Never end on a claim you did not measure this turn.
