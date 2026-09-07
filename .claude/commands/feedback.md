---
description: Route free-form feedback on a built app back into the pipeline. Classifies each point by altitude and applies the drift rules in reverse.
argument-hint: [your feedback in plain words]
---

You are running the Feedback step of KaizenOS. This is the door back into the pipeline after a build exists. You do not fix anything blindly. You triage, you show the routing, you act only on what the user approves.

Feedback from the user: $ARGUMENTS

If no feedback was given, ask for it in one line and stop.

## 1. Read the context

Read docs/PRODUCT.md, docs/PRD.md, docs/DESIGN.md, docs/ARCHITECTURE.md, and docs/ROADMAP.yaml. You are classifying feedback against what the app claims to be, so you need the current truth.

## 2. Split and classify

Break the feedback into discrete points. Classify each by **altitude**, and tag each with the matching drift rule.

- **Product** ... it solves the wrong problem, targets the wrong user, or the value is off. Routes to PRODUCT.md / PRD. This is a D3-level change to the brief.
- **Design** ... a screen, flow, layout, or interaction feels wrong. Routes to the designer and DESIGN.md.
- **Architecture** ... the data model, a shared interface, auth, or the system shape cannot do what is asked. This is a **D3 contract change**. It stops for the user, never rearchitects silently.
- **Implementation** ... a bug, misalignment, copy, or an obvious in-scope gap. D1 (trivial) or D2 (in-scope). Seeds a backlog story. When the point is a defect in behavior that already shipped, rather than a gap in something unfinished, it seeds a `fix` story and the escape gets recorded, see below. For a change scoped to one shipped story, `/revise S-NNN` is the tighter door and records the same facts.
- **Out of scope** ... a genuinely new capability. D4. Becomes a new epic or story, not built now.
- **Obsolete** ... a story or epic that is queued but no longer wanted. Not a new unit of work, the retirement of one. Cancels it.

## 3. Show the triage, get approval

Before touching any file, present a short table: each feedback point, its altitude, its drift tag, and the proposed action. Use AskUserQuestion to confirm the routing, or let the user correct a classification. Do not proceed on any point the user has not approved.

## 4. Act on approved points

- **Product** ... amend PRODUCT.md / PRD, and offer to re-open `/ideate` on the affected epic in guided mode.
- **Design** ... hand the point to the designer agent (subagent_type "designer") to amend DESIGN.md, then run `node scripts/render-docs.mjs`.
- **Architecture (D3)** ... do not change ARCHITECTURE.md yourself. Write a decision request into docs/DECISIONS.md stating the conflict and the options, and stop for the user's call. Offer to re-open `/architect` once they decide.
- **Implementation (D1)** ... seed the story, PRD entry first (below), then ROADMAP.yaml, and since the tier allows it, offer to run `/next` on it immediately. A trivial fix should not need a second command.
- **Implementation (D2) and Out of scope (D4)** ... seed the story or new epic, PRD entry first (below), then ROADMAP.yaml and the backlog. Do not build now. The next `/next` run picks it up.
- **Obsolete** ... cancel it. Never delete the PRD block and never reuse the id. Add a `**Cancelled.**` marker to the PRD story block carrying today's date and `/feedback`, add an Amendments entry saying why it is no longer wanted and what if anything replaces it, then run `node scripts/story.mjs status S-NNN cancelled`, which moves ROADMAP and the story frontmatter together. Never hand-edit those two files. A cancelled story never gates, so do not write a gate file for it. For an epic, cancel each of its stories and mark the epic block the same way. If the story is already `done` this is not a cancellation, the code exists and taking it out is real work, so seed a removal story instead and leave the shipped one `done`. The script refuses the flip. Full rule in docs/PROTOCOL.md under Cancelling work.

**A defect in shipped behavior is a `fix`.** Seed it with `**Kind.** fix` in the PRD block and `kind: fix` in the story frontmatter, plus `fixes:` naming the story that shipped the defect, or `none` when the code predates the pipeline. Ask the user which shipped story it came from if it is not obvious, and do not guess. `scripts/gate.mjs` refuses to gate a fix story that names nothing. When the fix is gated, its gate record carries the `escaped` block, `found_by` (usually `user`), `missed_by` naming the layer that should have caught it, and the report date. `missed_by` is one of `checks`, `qa`, `security`, `review`, `spec`, or `none`, where `spec` means the acceptance criteria were themselves wrong and the answer is a PRD amendment rather than a gate to tune. This is what makes which gate is weakest answerable later (docs/PROTOCOL.md, What a failure leaves behind).

**Seeding a story always starts in the PRD.** The PRD is the id authority, so a story with no PRD entry has no specification and no traceable id (docs/PROTOCOL.md, Where stories come from). For each seeded story, in this order and one story at a time, write the docs/PRD.md story block under its epic taking the highest story id in the PRD plus one, with `**Kind.** feature` or `**Kind.** chore`, `**Added.**` carrying today's date and `/feedback`, and its numbered acceptance criteria. Then add a dated entry to the PRD's `## Amendments` section naming the door, why the spec changed, what was considered instead, and the effect on the rest of the spec. Then write ROADMAP.yaml and the backlog story file. Feedback that is a constraint rather than a capability, a hardening pass or a convergence refactor, is a chore, state its technical outcome instead of inventing a user for it.

Log every seeded story and every D3 decision request the same way the build loop logs drift, so the round trip is visible.

## 5. Close

Summarize in a few lines: what was routed where, what is now queued, what is waiting on the user's decision. Name the next command for each open thread (`/next` for queued fixes, `/architect` after a D3 call, `/design` review if design changed). Obey the workspace writing rules, no em dashes, avoid colons in prose.

For a change scoped to a single already-shipped story rather than broad feedback, `/revise S-NNN` is the tighter door.
