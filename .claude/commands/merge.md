---
description: Merge the open PR stack bottom-up via the merger agent, gate-checked, then verify main and reconcile state. Only runs when profile review.merge is agent-on-green.
argument-hint: [optional PR numbers to limit to]
---

Run the KaizenOS Merge step.

1. Read docs/profile.yaml. If review.merge is human, stop and tell the user this project keeps merging manual, they can flip review.merge to agent-on-green to delegate it.

2. List open PRs with `gh pr list` and determine stack order from their base branches (a PR based on the default branch is the bottom).

3. Use the Agent tool with subagent_type "merger". Pass it the project root, the ordered PR list (or the subset in $ARGUMENTS), and remind it of the eligibility rules, gate PASS or CONCERNS plus a shippable review verdict, merge commits with branch deletion, stop on any conflict or red test, reconcile after, and render the board as part of that reconcile so the view is not left describing the state the merges just replaced.

4. Relay the merger's report, what merged, what was skipped and why, and the state of the default branch.
