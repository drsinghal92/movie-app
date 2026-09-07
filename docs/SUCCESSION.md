# Succession

How one session hands the project to the next. Invoked by `/handoff`.

A session ends when its context fills or its era finishes. What it wrote down survives, what it only
knew does not. This file covers the second part, because the first part already has homes.

**Scope.** KaizenOS runs one main loop and subagents that die with it. There is no hub seat and no
standing fleet of sessions to notify, so nothing here choreographs other sessions. It handles one
session ending and one session starting.

## What lives where, so nothing is written twice

- `docs/STATE.md` is the resumable pointer. Current story, last action, next up, blocked. Written by
  the loop, never by hand here.
- `docs/ROADMAP.yaml`, the gate records, and `logs/PROGRESS.md` are the history.
- `docs/HANDOFF.md` is the only thing this command writes. It holds what those three structurally
  cannot say. What is mid-flight, what was parked, and what this session knows that is nowhere on
  disk.

A handoff that restates the pointer creates a second pointer, and two pointers drift. Cite, do not
restate. If a line in `HANDOFF.md` could have been read out of `STATE.md`, delete it.

## Before the handoff. Finish, do not start

From the moment `/handoff` runs, open no new fronts. No new stories, no new subagents, no new
investigations. Findings arriving from work already running go into the handoff.

Finishing is not starting, and the difference is the rule. Anything already diagnosed is completed in
this same turn, because you hold the measurement and the reason and a successor would have to
re-derive both from a paragraph.

Two hard conditions before handing over.

- **The default branch is green.** A red `main` blocks the next session and it cannot tell your
  breakage from its own.
- **The tree is clean, or the dirt is named.** `scripts/on-stop.sh` autosaves on story and epic
  branches only, so work anywhere else is not covered.

## What `docs/HANDOFF.md` contains

Under 60 lines, citing rather than restating.

- The era that just finished, one line, with the story ids or the PR numbers.
- The next objective, including the operator's `/handoff` note verbatim if one was given.
- Exactly what is pending, with links. Open PRs, unmerged gated stories, decisions the operator owes.
- Live hazards. Anything mid-flight, any parked branch or worktree, any trap that cost this session
  real time and is not yet in `docs/TRAPS.md`.
- The close-out answers below.

## The close-out questions

Ask them before the session ends, and put anything substantial in the file rather than in the reply.
A transcript is not a system of record and this one is about to be gone.

This is an extraction, not an audit. A session that thinks it is being examined writes a defence.

1. **What was the intended outcome?** In your own words, not the brief's. A session that cannot
   restate its charter has usually drifted, and the drift is the finding.
2. **What actually happened, and was the outcome fully achieved?** The gap between one and two is why
   both are asked. "Done" is not an answer. If the outcome was partial, the story must not be sitting
   at done, and if it is, fix that now.
3. **What was deferred?** By name and location. The expensive failure is not a refusal, it is a
   mid-flight park that nobody finds for two days. "Nothing deferred" is a valid answer and has to be
   said out loud, because silence and completeness read identically afterwards.
4. **For each deferral, who owns it and how does it reach done?** Every parked item leaves with an
   owner, a specific next action, and a trigger that makes it urgent. "The next session" is nobody.
   An item that cannot be given all three is dropped, not deferred, and it gets recorded as dropped.
5. **What did we learn, and what mechanism now enforces it?** Both halves. Filing a learning is not
   fixing it. Name the gate, the drift rule, the hook, or the contract line. "Wrote it down" is a
   plan to remember, and remembering is what failed. Where no mechanism is possible, say so and say
   why, that is a real answer.
6. **Who verified the work, and how do we know it is closed?** A name and a method. A builder
   re-reading its own diff is not verification and a green run nobody pinned is not either. If
   nothing independent verified it, record that, and it is a reason to keep going rather than stop.
7. **What have you reported that is no longer true?** A session reports state as of when it measured
   it and the repo moves underneath. It does not occur to a session that its own earlier statement
   has expired, so it has to be asked.
8. **Did the conditions attached to your work actually land?** A one-time measurement in a note and a
   standing assertion in the gate look identical in a report and are not the same thing. A straight
   yes or no, and a no now is cheaper than the discovery later.
9. **What are you still holding?** Branch, worktree, dev server, port, lock, and specifically which
   directory you are sitting in. A process cannot delete its own working directory, so cleaning up
   around a live session is how husks get made. End the session first, then clean up.

## When not to hand off

- Mid-work. Drafts open, a gate running, a PR open and unmerged. Finishing is cheaper than
  re-deriving.
- The PR merged but the work is unproven, a check still running or a live look outstanding. This
  session is the cheapest place to fix what that turns up.
- You are the only holder of context for an open question the operator has not yet answered.

Idle is not finished. Read the board before deciding an era is over.

## The next session

It reads `docs/STATE.md`, then `docs/HANDOFF.md`, then this pack. Then, before acting on anything the
handoff claims, it verifies live state itself. Fetch, read the board, check what is actually on disk.
**A handoff is a claim, not evidence.**

## Anti-debt

If a rule here is superseded, delete it in the same change that supersedes it. Two copies of a rule
is one rule and one future bug.
