# Tooling traps

Mechanics, not policy. PROTOCOL.md and STRUCTURE.md say what the loop must do. This file records the
commands and scripts in this harness that fail in a way which looks like success, so the next agent
does not pay for the same measurement twice.

**Why it exists.** Every entry below was found once, written into one session's own head or one
script's comment block, and then hit again by somebody who could not have read it there. Knowledge
kept where only its author can reach it is, for the system, undocumented.

**Which file a lesson goes in.**

- Here, if it is about this harness's own scripts and commands. It is true in every install, so it
  ships with the kit and `scripts/update.sh` refreshes it.
- In `docs/CONVENTIONS.md`, if it is about this product's stack, its tests, or its deploy. That file
  is project state and is never overwritten by an update.

**A harness trap found inside a product repo goes upstream, not into the local copy of this file.**
`scripts/update.sh` overwrites this file on every update, so an entry appended here in a product repo
is destroyed the next time the kit moves, silently, and the agent who wrote it will never know. Send
it to the KaizenOS repo and let the update carry it back to every install. That path already works.
The render-docs reaping notice in `scripts/update.sh` credits KaizenBridge for reporting it on
2026-08-06.

Never summarise an entry out. The detail is the part that saves the next reader. Add one to the
KaizenOS repo whenever a tool lies to you, newest at the bottom of its section.

## The shape most of these share

A real measurement under the wrong label is a false claim, and it survives every "did you check?"
challenge, because the answer is yes. State what was measured and when, not what you believe it
represents.

## The scripts write state, they do not answer questions

**Every `scripts/story.mjs` subcommand is a writer.** Running one to see what it does is not a
query. A throwaway `block S-999` wrote a real gate file, appended to `logs/PROGRESS.md`, and moved
the blocked pointer in `docs/STATE.md`. Every script resolves its root from its own location, so
copy it into a scratch directory with its own `docs/` and `logs/` and probe there. Two `cp` calls,
and nothing real moves.

**`node --check` proves a file parses, never that it runs.** It passed on a `story.mjs` that called
`mkdirSync` without importing it. Exercise the changed path in a fixture before claiming a fix works.

**A string prefix is not a path check.** A guard meant to keep `scripts/update.sh` pointed at a
throwaway directory compared strings. `${tmpdir()}/../../etc` starts with the temp directory and is
not inside it, so the prefix form waved it through and `update.sh` deleted `.claude/commands` out of
a directory that was never a target. Resolve with `realpathSync` first, and refuse a path that will
not resolve at all rather than letting it fail later as an ENOENT from somewhere deeper.

## A guard placed after the thing it guards reads what you just wrote

**In `scripts/update.sh`, every "did this install already have X" probe belongs above the copy
block.** Once `scripts/` and the contract docs are overwritten, the target carries the kit's own
answer to every question. Two guards were written below the copies and both were dead on arrival,
one permanently silent and one permanently firing.

**A notice whose evidence is immutable can never switch itself off.** Gate records are history and
are never rewritten, so "does an old token appear in `docs/gates/`" stays true forever. That is why
`.kaizenos-notices` exists. A one-time notice needs a ledger, not a probe.

## A check that stops matching reads exactly like a check that passed

**`scripts/drift.mjs` rules are patterns over prose, and prose gets reworded.** A rule that finds
nothing is indistinguishable from a rule that found nothing wrong. Every pattern rule there reports
itself stale instead of passing quietly, and a new rule must do the same.

**An empty result needs a positive control.** A broken instrument and a clean bill of health look
identical without one.

**Verify every member of a set, never a sample plus a summary sentence.** If the claim covers a set,
the check has to cover the set.

## Reading the record instead of the artifact

**`scripts/landed.mjs` asks git and GitHub which branches merged, not the story's `pr:` field.**
Under `/next --all` a story legitimately has no PR of its own until the epic PR opens, so `pr:` is
null in exactly the case the script exists for.

**Undecided is not unmerged.** When `gh` cannot be reached, only branches git can still see are
checked, and a merged branch that was deleted is invisible to that. Never hand-edit an undecided
story to done. Fix `gh auth status` instead.

**A merged PR is not a moved pointer, and a green check is not a shipped artifact.** Measure the
thing that runs.

## Hooks

**`Stop` does not fire on Ctrl-C.** Measured 2026-08-03 under `claude -p`. `Stop` fires on normal
completion and on SIGTERM, `SessionEnd` fires on all three including SIGINT. Both are registered in
`.claude/settings.json` for that reason, and registering both does not double-commit, because
`scripts/on-stop.sh` no-ops on a clean tree. Removing either one leaves an interrupted unattended run
with a dirty tree and no autosave.

## File formats that break their own review

**NUL bytes make a source file binary to git, and its diffs stop existing.** `scripts/render-docs.mjs`
used NUL as an internal sentinel, so no change to it was ever reviewable. `scripts/drift.mjs` rule 4
now fails on this, for `scripts/` and `tests/` by extension only, because rejecting a product's
legitimate binary fixture is a worse failure than missing one source file.

## Config read order

**`docs/profile.yaml` puts `cost:` last, and the rate lookup broke on exactly that shape** for the
whole life of the feature. So the awkward order is the default any profile reader is tested against,
not an edge case tucked into one extra case at the bottom of a suite. A new reader gets a key that
appears after the one it wants.
