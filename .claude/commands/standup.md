---
description: Morning digest. What shipped overnight, open PRs and their reviews, what is blocked, what needs your call.
---

Produce the KaizenOS standup for the human. Keep it under 20 lines, scannable, no filler.

1. Gather. Read docs/ROADMAP.yaml and logs/PROGRESS.md. Run `gh pr list --state open` and `git log --oneline -20`. Also run `node scripts/landed.mjs`, which names any story still recorded as in-review whose branch already merged. Report only, never `--apply`, the digest is a read.

2. Report:
   - Shipped. Stories moved to in-review since the last standup, each with its PR link and the pr-reviewer verdict.
   - Blocked. Any blocked stories with the one-line reason, read from each story's gate record (`blocked.reason` and `blocked.at_stage` in docs/gates/S-NNN.yml, which now always exists for a blocked story), and what they need from you.
   - Escaped. Any defect that reached a human since the last standup, from gate records carrying an `escaped:` block, naming the story it broke and the gate that missed it. A quiet line when there are none.
   - Queue. How many todo remain, and the next three up. Name anything cancelled since the last standup with its one-line reason from the PRD Amendments entry, so a shrinking queue is never mistaken for progress.
   - Your calls. PRs waiting to merge, and any decision the agents flagged. Lead with anything `landed.mjs` found, a merged story still reading in-review means the board is lying about shipped work, and `/land` closes it in one command. Say nothing when it found nothing. Include every gate finding carrying `outcome: decision-owed`, these are calls only you can make and nothing else surfaces them.
   - Spend. One line. Run `node scripts/cost.mjs --since <last standup date>` and state the tokens and estimated spend since then, with the phase taking the largest share. Say `estimated, subagent work only` on the same line, never present it as a complete bill. Skip the line entirely when logs/events.jsonl is absent or empty rather than reporting a zero.

3. End with the single most useful next action, then one quiet line, not sure what to do, run /help.

4. Write the same digest to docs/STANDUP.md (plain markdown, dated heading `## Standup YYYY-MM-DD`, newest at top, keep the last few) and run `node scripts/render-docs.mjs` so docs/html/STANDUP.html and the docs index are fresh. The digest in chat stays the primary read, the HTML is the durable one to point back to.
