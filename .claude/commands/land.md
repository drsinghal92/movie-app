---
description: Write state back after a merge you made yourself. Flips landed stories to done, updates the pointer, logs, and re-renders. The human merge path's half of what the merger agent does.
argument-hint: [--check]
---

Reconcile the stories a merge already shipped. Args: $ARGUMENTS

Use this after **you** merge a PR. `review.merge` is `human` by default, so no agent merges and no agent writes the state back. Without this step the repo's own board reports shipped work as unfinished, which is the one question the board exists to answer.

Under `agent-on-green` the merger agent runs this same script at the end of its own run, so you never need to. One definition, two callers.

1. **Look first.** Run `node scripts/landed.mjs`. It reads docs/ROADMAP.yaml for every story still at `in-review` and asks GitHub which branches actually merged. It prints three things, the stories that landed and were never written back, the stories it could not decide, and nothing at all when the repo is clean. `--check` means stop here and report, do not apply.

   It asks about branches, not about the story's `pr:` field, on purpose. Under `--all` a story has no PR of its own until the epic PR opens, so `pr:` is legitimately null in exactly the case this exists for.

2. **Read what it could not decide.** A story it lists as undecided is either genuinely unmerged or a question it could not answer, and the line says which. `gh could not be reached` means only branches git can still see were checked, and a merged branch that was deleted is invisible to that. Never treat an undecided story as merged, and never hand-edit it to done. If it really did ship, say so and the fix is to check `gh auth status`, not to overwrite the record.

3. **Apply.** Run `node scripts/landed.mjs --apply` from the default branch, on a clean tree. It refuses both otherwise. A reconcile committed on a story branch lands the fix inside the branch it just called merged, and its commit takes everything it finds, so a dirty tree would ship someone's work in progress under a subject line saying only statuses moved. Per landed story it sets `status: done` in ROADMAP and the story frontmatter, backfills the PR url when the story never had one, and appends one line to logs/PROGRESS.md. Then once for the whole sweep it moves docs/STATE.md, and last of all runs `node scripts/render-docs.mjs`, after every state write, because a render taken earlier draws the board you just changed. It commits all of that to the default branch as one commit and does not push.

   Every write goes through `scripts/story.mjs`. Do not edit ROADMAP.yaml, story frontmatter, STATE.md or PROGRESS.md yourself, ever, for any reason (finding 9).

4. **Report** in three lines. What moved to done and via which PR, anything left undecided and why, and the commit hash. Then remind the human it is not pushed.

Note the name. `node scripts/story.mjs reconcile` is a different command for a different repair, closing phase events a crash left open in logs/events.jsonl. Do not run one expecting the other.

No em dashes.
