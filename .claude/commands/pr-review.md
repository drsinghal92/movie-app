---
description: Run the adversarial pr-reviewer on a pull request manually. Use when a lighter tier skipped it, or to re-review.
argument-hint: <pr-number>
---

Run a manual KaizenOS adversarial review on a pull request.

1. Determine the PR. If $ARGUMENTS carries a number, use it. Otherwise run `gh pr list` and ask which.
2. Use the Agent tool with subagent_type "pr-reviewer". Give it the PR number and the repo. It reads the diff, hunts correctness and conformance defects, applies the security lens to any flagged surface, and posts its review with gh. It never approves and never merges.
3. Relay the verdict line and the finding counts by severity, and the story's gate verdict for context.

This is the same reviewer the build loop runs when profile review.pr_reviewer is true. Use it any time the loop skipped the review (a lighter tier), or when you want a second pass on a PR.
