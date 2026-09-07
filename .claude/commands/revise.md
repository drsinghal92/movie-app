---
description: Re-open one already-shipped story, amend it against new feedback, and re-gate it. The tight door for a single S-NNN.
argument-hint: [S-NNN] [what to change]
---

You are running the Revise step of KaizenOS. This is the narrow door, scoped to one story that already shipped or is in review. For broad feedback across the app, use `/feedback` instead.

Input: $ARGUMENTS

Expect a story id (S-NNN) and a plain description of the change. If the story id is missing, ask which story, showing the recent done and in-review stories from docs/ROADMAP.yaml.

## 1. Load the story

Read backlog/E0N/S-NNN.md, its gate file docs/gates/S-NNN.yml, and the PRD, DESIGN, or ARCHITECTURE sections it references. You are amending a known unit of work, not opening a new one.

## 2. Check the altitude

Apply the drift rules to the requested change before doing anything.

- **D1 or D2**, within the story's existing goal and contract ... proceed. Amend the story's acceptance criteria and Notes to record the revision, then re-run the build loop on it.
- **D3**, the change alters the architecture, a shared interface, or the data model ... stop. This is bigger than a revision. Write the decision request into docs/DECISIONS.md and tell the user to route it through `/feedback` or `/architect`. Do not rearchitect inside a revise.
- **D4**, the change is a new capability ... stop. Seed it as a new story via `/feedback`, do not graft it onto this one.

## 3. Revise and re-gate

For an approved D1 or D2 change:
- Update backlog/E0N/S-NNN.md. Add the new acceptance criteria with the next free numbers, never renumbering or reusing a retired one, and a Notes line stating what changed and why. Untick any existing criterion the revision reopens. Clear the ticks on the Tasks list so the planner rebuilds the breakdown against the amended spec, and mirror the amended criteria back into that story's section of docs/PRD.md so the spec and the backlog never diverge. If the story has no section in the PRD at all, it predates the rule that the PRD is the id authority, so write its block first, its kind, an `**Added.**` marker reconstructed from docs/DECISIONS.md and the story's own Notes rather than invented, and its acceptance criteria. Without it the checks gate hard-fails the re-gate and the revision cannot land.
- Run `node scripts/story.mjs reopen S-NNN --reason "<one line>" --missed-by <value>`. It rotates the existing gate record to S-NNN.rN.yml so the verdict this revision contradicts survives, sets the status back to todo, clears the gate pointer, and logs the reopen. Never hand-edit ROADMAP or the story frontmatter. `--missed-by` is one of `amend`, `checks`, `qa`, `security`, `review`, `spec`, or `none`. Use `amend` when the change is not a defect at all, so a change of mind never inflates the escape count. Use `spec` when the story was built exactly to acceptance criteria that were themselves wrong, because that is a PRD fault and not a gate fault.
- Run `/next` scoped to this story. The full gate sequence re-runs, so the revision is verified, not trusted. When the revision closes a defect that reached a human, fill the new gate's `escaped` block, `fixes` naming this same story, `found_by`, `missed_by` matching what you passed to reopen, and `reported`. This is the escape record for a defect fixed in place rather than through a new fix story.

## 4. Close

State what changed, the new gate verdict once `/next` completes, and the PR. Obey the workspace writing rules, no em dashes, avoid colons in prose.
