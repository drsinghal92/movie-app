# docs/gates/

One gate record per story, `S-NNN.yml`, written by /next from the qa and security verdicts. Schema in templates/gate.yml and docs/STRUCTURE.md. Under `--all` an epic-level record also lands here as `E0N.yml`.

Verdicts: PASS, CONCERNS, FAIL, BLOCKED, WAIVED. WAIVED needs a reason and an approver. BLOCKED is written by `scripts/story.mjs block` when a story stops, so a stop leaves a record rather than an absence.

Records are write-once. Re-gating rotates the old one to `S-NNN.r1.yml` via `story.mjs reopen`, so a verdict is never overwritten by the verdict contradicting it. A record whose `escaped:` block is set closes a defect that reached a human, and its `missed_by` names the layer that should have caught it.

Tasks inside a story are not gated separately. `acceptance_met` is one field for the whole story, because a single task cannot satisfy an acceptance criterion on its own.

These files are the audit trail for quality. Greppable, diffable, and never lost in a chat scroll.
