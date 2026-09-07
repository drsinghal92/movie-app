---
description: Advance the pipeline by one step. In the build phase it runs the build loop. --all auto-advances and drains the backlog, --unattended forces overnight rules. Follows docs/PROTOCOL.md. Never merges.
argument-hint: [--all] [--unattended] [--yolo]
---

`/next` is the one verb that advances KaizenOS. It detects where the repo is and runs the next step. `/help` is its read-only twin, it names the next step, `/next` does it. Args: $ARGUMENTS

## Dispatch

Run `node scripts/phase.mjs --json` and read the result (this is the same detection `/help` uses, so the two never disagree). It returns the current `phase`, the `next` command, whether that step is `guided` (needs you) or `autonomous`, and for the build phase a `build` sub-state. Then act by phase.

- **start** ... no product brief yet. Point at the front door the result names, `/ideate` for a blank slate or `/map` for an existing codebase. Do not run it for them, this is theirs.
- **guided founder step** (ideate, brand, prototype, design) ... run that step's command now unless it needs you. Without `--yolo`, hand it to the human and stop, these pressure-test each section against docs/METHODS.md and are the founder's call. With `--yolo`, run the step's agent straight through. Under `--all`, stop here and say so, `--all` never auto-drives a guided phase unless `--yolo` is also set.
- **autonomous step** (architect, plan) ... run that step's command now (`/architect`, `/plan`). Under `--all`, run it and continue to the next phase in the same invocation.
- **build** ... the roadmap has eligible stories. Fall through to the build branch below.
- **ship** ... backlog drained or pipeline complete. Run `/standup` for the digest, or say there is nothing eligible and stop.

The unifying rule for `--all`, advance through every autonomous step and stop at the first step that needs a human. So a fresh repo stops at ideation, and after you finish the founder phases `/next --all` walks architect, plan, and the full build drain on its own.

## Build branch

First read docs/profile.yaml (models, mode, tracking, thresholds), docs/PROTOCOL.md (the contract), and docs/STRUCTURE.md (artifact schemas).

`--all` drains the backlog until nothing is eligible or something blocks. `--unattended` forces overnight rules, skip supervised stories, never pause, block instead of ask.

RESUME FIRST. Run `node scripts/story.mjs reconcile` before anything else. A run killed mid-phase leaves that phase's open event as the latest word on the story, so every client renders it as executing right now, forever, and nothing inside the dead process can fix that. Reconcile closes each abandoned phase with `status: failed` and `facts.reconciled: true`, which reads differently from a phase that ran and failed on its merits. It is safe when there is nothing to close and it says so. Never run it while a `/next` is in flight, a live phase and an abandoned one look identical from the outside, which is why this is explicit here rather than automatic.

ALSO FIRST, and separately. Run `node scripts/landed.mjs`. Different repair, similar-sounding word, see the note at the end of this paragraph. It names any story still recorded as `in-review` whose branch has already been merged, which is what a human merge leaves behind, since `review.merge: human` means no agent ever wrote the state back (`/land` is that door). **Report what it finds and offer, never apply it here.** `--apply` commits to the default branch and pushing state around is not a side effect phase detection is allowed to have. When it finds nothing, say nothing. When it finds something, name the stories and say that `/land` closes it, then carry on with this run, a stale in-review story does not block picking the next one. The two commands are unrelated despite the wording, `story.mjs reconcile` closes crashed phase events, `landed.mjs` closes the gap between a merge and the state files.

Then check for a story already in flight, a story marked in-progress in ROADMAP whose branch exists with a wip commit or an uncommitted tree (a prior run that a session limit or crash cut short, finding 10). If found, do not restart it. Assess what the tree already contains against the story's Tasks list and acceptance, verify it (run the tests), and continue from the first unmet step. Only when nothing is in flight, pick a new story.

## Reporting

This applies to every step below, so it is stated once rather than repeated twelve times. A run that says nothing until it ends is a run you cannot supervise, and a client cannot render a stage it was never told about.

**Emit an event as each phase opens and as it closes.** `node scripts/story.mjs event S-NNN --phase <phase> --status <status> --summary "<one line>"`, plus `--epic`, `--round` when the phase retried, `--facts '<json>'`, and `--decision "<one line>"` when the phase raised something only a human can settle. The steps map to phases like this, and the phase token is a closed set, never improvise one:

**One `--facts` key is required rather than optional.** The `qa` close event must carry `--facts '{"verdict":"<PASS|CONCERNS|FAIL>"}'`. `scripts/cost.mjs` reads exactly that key to fill the Gate column in `docs/COST.md`, and until this was written down no contract asked any phase to produce it, so the column showed `-` on every real run. Everything else in `facts` stays phase-specific and free.

| Step | Phase | Label | Runs a model |
|---|---|---|---|
| 1 SYNC AND PICK | `pick` | Picked | no |
| 2 PLAN | `plan` | Plan | planner, Opus |
| 3 BUILD | `build` | Build | builder, Sonnet 5 |
| 4 CHECKS | `checks` | Checks | no |
| 5 QA GATE | `qa` | QA | qa, Sonnet |
| 6 SECURITY PASS | `security` | Security | security-reviewer, Sonnet |
| 8 COMMIT, 9 PUSH AND PR | `pr` | PR | no |
| 10 ADVERSARIAL REVIEW | `review` | Review | pr-reviewer, Opus |
| 11 TRACK, 12 LEARN AND RECORD | `record` | Record | no |
| any stop | `block` | Blocked | no |

**Step 7, GATE FILE, emits no event of its own.** It used to sit inside `record`, which then opened at 7 and closed at 12 with `pr` and `review` running inside that window. Every phase would still have had its two events, but `record` would have wrapped two other phases in its elapsed time, and `scripts/cost.mjs` sums per-phase `ms` into the share column, so the split double-counted. Writing the gate file is bookkeeping between the qa close and the pr open, and the gate file is itself the record, so it needs no second one. Every other step maps to exactly one phase, and no phase spans another.

`--status` is `running` on the open event and one of `ok`, `concerns`, `failed`, `skipped` or `blocked` on the close. Two rules keep the trail honest, the same discipline that already forbids an unmentioned skipped gate:

- **A skipped layer emits a close event with `status: skipped`** and a summary naming why. Silence would read as a layer that passed.
- **A stop emits `phase: block`, `status: blocked`**, with the gate's `blocked.reason` as its summary. A qa FAIL on exhausted retries and a D3 contract stop both reach this, and they are the runs a human most needs to see.

**Every close event carries what the phase cost.** When a step ran a subagent, the Agent tool returns its token count, tool-use count and duration; pass them straight through as `--model <the agent's model> --tokens N --tool-uses N --ms N`. Do not estimate the counts, they are measured and reported. **Never compute a money figure yourself and never pass one**, `story.mjs` derives it from `cost.rates` in profile.yaml, so the one derived number is derived in one place where a slip is catchable. A step that ran no model still passes `--ms`, wall clock counts there too, a failed `checks` costs a whole extra build round. `/cost` projects all of it into docs/COST.md and logs/cost.csv, and its money figures are always labelled estimated.

The `record` close event's summary is **the user-facing outcome in one sentence**, what someone can now do that they could not before, never the implementation. It is the only place the loop states this, and step 12 quotes it into the story's `## Summary` block.

**Print one console line per event**, using the human label from the table, never the raw token:

```
  Plan       running   Planning goal-backward from four acceptance criteria.
  Plan       ok        Nine tasks across frontend and test. Confidence 8 of 10.
  Checks     FAILED    Refused, AC3 has no task claiming it.
```

**Then print the story card once the story ends.** It is a render of that story's events plus its gate file, not a fresh summary, so the console and any client reading the same events cannot disagree. Every value is lifted, never invented. Cap it at 18 lines. The block pairs are ordered by who reads them, analyst first, QA second, developer third, and that order is deliberate, do not reshuffle it.

```
S-088  The Queue tab names why a story is stalled          in-review · CONCERNS

  What changed   <the record event's summary>
  Your call      <every decision raised this run, or the word none>

  Gate           <verdict> · <acceptance> · ui_verified <x>
                 <source>/<severity>  <the one reason it is not clean>
  Proof          <tests> · <counts> · <which layers ran or were skipped, and why>

  Work           <rounds> · <tasks> · <files> · <test delta>
  Cost           <tokens> · <usd est> · <wall>
  Next           <the one command to run>
```

Three rules on filling it, each one earned by desk-checking the format against a real shipped story before it went out.

- **`Your call` prints `none` rather than being dropped**, so its absence is a statement. **One line per distinct call, and one line only.** A call already in the stream is not raised again by a later phase, and when two phases describe the same call in different words the sweep collapses them and keeps the clearest wording. But **distinct calls each get their own line**, and the four-line shape stretches to hold them rather than dropping one. A story can genuinely owe two, an amend-the-contract decision that blocks a merge and a seed-a-follow-up decision are different in kind and different in who acts, and forcing them into one slot loses one of them.
- **No gate is never `clean`.** A cancelled story, or one that never ran, has no gate record, and absence of failures is not a passing verdict. Write `no gate, cancelled` or `no gate, never built`. Reading a missing file as a pass is the one mis-fill that turns this section into a lie.
- **The Gate line follows the blocking state, not just the verdict field.** A gate can read `PASS` on every structured field while the merge is blocked on a D3 and the notes carry several caveats. When there is more than one reason, say how many and name the most severe, `PASS, merge blocked on a D3, plus 3 more in the gate notes`. One reason is the shape, not a cap on the truth. A skipped layer keeps its must-name rule inside `Proof`, with the manual command for anything a tier turned off. Two variants:

- **`--all`.** No story PR exists until the epic boundary, so `Proof` names the epic branch and `Next` reads `/next`. At the epic boundary print the same shape once for the epic from docs/gates/E0N.yml, mirroring the epic PR body below rather than inventing a second layout.
- **Blocked or D3-stopped.** The card still prints. `What changed` reads `Not shipped.`, `Gate` reads `BLOCKED at <phase>`, `Your call` carries the block reason, and `Next` names the command that unblocks it.

**FINDING SEVERITY AND ROUNDS.** This governs steps 5, 6 and 10 together, so it is stated once here rather than three times below. Every gate layer returns findings ranked `high`, `medium` or `low`. **The rank decides whether a finding costs a build round.**

- **`high`** ... routes back to the builder now. A high is a defect that breaks an acceptance criterion, loses data, or leaves the app in a state a user cannot get out of. It is worth a whole round.
- **`medium`** ... does not route back on its own. Mediums accumulate across every layer and go back to the builder **once**, in one batch, after the last gate layer has run. One round for all of them, never one round each.
- **`low` and nits** ... never route back. They go into the gate `findings` with `outcome: recorded`, and anything worth doing later is seeded as a follow-up story under D4. A low that is genuinely a one-line fix may ride along inside a round that was already going to happen for a high or the medium batch, but it never causes one.

This exists because it was not written down. On the KaizenTasks runs of 16 to 20 Aug 2026 the loop ran 23 build rounds for 7 stories and the commit messages read "Fix all 17 findings" and "Fix all 15 findings", because nothing said a low was recordable rather than fixable. One story took 9.1 hours, of which the first build was 52 minutes.

**A review round cap, `review.rounds` in profile.yaml, default 1.** An install whose profile predates the key behaves as if it read `rounds: 1` and `action_floor: high`, an absent key is the default and never a licence to skip the rule. The reviewer at step 10 runs once per story. When its verdict is `needs-work` on a high, the builder clears it and the reviewer runs **one** confirmation round and no more, and only when `review.rounds` is 2. **That confirmation round is given the round 1 finding list and is confined to it.** Its only question is whether those highs are closed. It does not read for new ground, and a finding it raises outside that list is recorded, never actioned. Without this the reviewer never converges, an Opus pass over a clean diff always finds something, so on S-015 round 1 raised seven findings, the builder cleared all seven, and round 2 raised seven fresh lows. Anything still open at the cap is written to the gate with `outcome: recorded` and the card names it. The cap is a stopping rule, not a quality judgement.

For each story:

1. SYNC AND PICK. Read docs/STATE.md and docs/ROADMAP.yaml. Walk the epics in order and choose the first todo story whose dependencies are each either done, or in-review with a PASS or CONCERNS gate (stacked chain, see PROTOCOL.md). A cancelled story is never picked and never blocks a dependent, it is a decision already made, so treat a cancelled dependency as satisfied and say so when you do. When unattended, skip stories tagged supervised. None eligible, say why and stop. Its file is backlog/E0N/S-NNN.md. Mark it in-progress with `node scripts/story.mjs status S-NNN in-progress` (it moves the status in ROADMAP and the story frontmatter atomically, never hand-edit those files yourself, finding 9). Then run `node scripts/render-docs.mjs`. The render at step 12 is the only other one, and it fires after the gate is written, so without this one the board's Running column could never hold anything, a story left it before any render saw it in it. Two renders per story is the price of a board that is true while a story is running, not only after it stops.
   Branching splits by mode (PROTOCOL.md, The --all epic shape):
   - Interactive `/next` ... create branch story/S-NNN-slug off the default branch, or off the deepest in-review dependency's branch when chaining, and record the base in the story Notes.
   - `--all` ... create or reuse the epic branch epic/E0N off the default branch. Every story in the epic commits onto this one branch, one clean commit per story, no per-story branches and no stacked PRs. Record the branch base in the story Notes on the epic's first story.

2. PLAN. Agent subagent_type "planner". It writes a Plan into the story file, sets the autonomy tag, and rates confidence. Apply the confidence check from PROTOCOL.md: below the profile threshold, block (unattended) or ask (supervised), then move on.

3. BUILD. Agent subagent_type "builder" (Sonnet 5). It works the story Tasks list, writes tests, and applies drift rules D1 to D4, logging each in the story Notes. A D3 block is recorded and the loop moves on. When the builder returns, wip-commit the tree at once (`git add -A && git commit -q -m "wip: S-NNN build"`) so a crash between build and the real commit loses nothing (finding 10). These wip commits are collapsed into the one story commit at step 8. The Stop hook (scripts/on-stop.sh) is the second net, it autosaves any uncommitted work on a story or epic branch.

4. CHECKS. Run `node scripts/gate.mjs backlog/E0N/S-NNN.md`. A non-zero exit goes back to the builder to fix, counting toward retries.

5. QA GATE. Agent subagent_type "qa". It returns PASS, CONCERNS, or FAIL, plus its findings in the fixed shape. Its close event carries that verdict in `--facts '{"verdict":"..."}'`, which is required, see the Reporting section. Record every finding it returns, it goes into the gate's `findings` list at step 7 with `outcome: fixed-in-loop` once the builder clears it, so a story that passed on the third attempt still shows what it failed on. FAIL routes back to the builder up to profile qa.retries. Its individual findings obey the severity floor above, a CONCERNS verdict carrying only lows costs no round at all. When retries are exhausted, run `node scripts/story.mjs block S-NNN --stage qa --reason "<one line>"`, which writes the BLOCKED gate record with the reason and moves the state, then move on. Never hand-set a story to blocked, the command is refused (docs/PROTOCOL.md, What a failure leaves behind). For a ui_surface story the qa agent also enforces the UI verification clause (docs/PROTOCOL.md), the feature must be proven by a real browser end-to-end test that drives the actual input path, not a substitute API call. If you are running interactively and a flagged story wants a human eye (or its E2E could not be automated and the planner tagged it supervised), drive the screen yourself with the `verify` skill or Claude in Chrome before accepting it. This interactive check is a supervised-session fallback, the durable test in scripts/test.sh is the path that survives overnight.

6. SECURITY PASS. Production mode only, and only if the story touches a surface in profile qa.security_review_on. Agent subagent_type "security-reviewer". BLOCKED routes back to the builder, and WARN findings obey the severity floor above rather than each buying a round, on exhausted retries run `story.mjs block S-NNN --stage security --reason "<one line>"`. Its WARN and BLOCKED items go into the gate's `findings` with `source: security`. If it is skipped (sketch mode, or no flagged surface), emit the skipped close event with the reason, name it in the card, and write `security: skipped` in the gate, never `n/a`. A layer that was switched off must be legible later, otherwise it looks like a gate that passed.

7. GATE FILE. From templates/gate.yml, write docs/gates/S-NNN.yml with verdict, tests, failing_cases, acceptance_met, ui_verified, security, review, findings, gated_at, and the PR url once known. Fill `findings` with every item any layer raised this run, verbatim from what the agent returned, each with its source, severity, what, and outcome. An empty `findings` alongside `verdict: CONCERNS` is a contradiction, a concern with nothing named. Write `security: skipped` or `review: skipped` when the tier turned a layer off. If a gate record already exists for this story, do not overwrite it, rotate it first with `story.mjs reopen` (docs/PROTOCOL.md, What a failure leaves behind). Set ui_verified to PASS or FAIL from the qa agent's UI verification for a ui_surface story, n/a otherwise. When tests are red, fill `failing_cases` with the failing test titles the qa agent reported, verbatim, else leave it `[]`. Point the story frontmatter `gate:` at it.

8. COMMIT. Collapse any wip commits from step 3 into one clean story commit, soft-reset to the last real commit on the branch (`git reset --soft <base>`, the branch base recorded in the story Notes, or the previous story's commit on an epic branch), leaving all work staged, then commit once. Message "S-NNN: <title>" with trailer:
   Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

9. PUSH AND PR. Push the branch now in both modes, the push is the crash net that survives the machine dying overnight, on-stop.sh only saves locally. If no GitHub remote exists yet, ask the user once whether to create it (default private) before pushing.
   - Interactive `/next` ... open the story PR with gh. A chained story's PR targets its dependency's branch as base (stacked PR), independent stories target the default branch. Say in the PR body which PR it stacks on. Morning merges cascade bottom-up.
   - `--all` ... no story PR. The epic branch is pushed after every story commit, and the one epic PR opens at the epic boundary (see EPIC PR below).

10. ADVERSARIAL REVIEW. If profile review.pr_reviewer is true, Agent subagent_type "pr-reviewer" (Opus). It reviews the story diff and never merges. On interactive `/next` it posts to the story PR with gh. Under `--all` there is no story PR yet, so its verdict and findings go into the gate file and story Notes now, and are posted onto the epic PR as a commit-scoped comment once that PR exists. Its verdict goes into the gate's `review` field as one of ship, nits, or needs-work, and its findings into `findings` with `source: review`. **Obey the severity floor and `review.rounds` from the contract above**, a `nits` verdict never buys a build round and the reviewer runs at most `review.rounds` times per story. If pr_reviewer is false, do not silently skip. Write `review: skipped` in the gate, emit the skipped close event, and name in the card that the adversarial review was skipped by this tier and that it can be run manually with /pr-review <n>. A skipped review is always named, never omitted, and now it is durable rather than only spoken.

11. TRACK. Only if profile tracking.backend is jira or both, mirror the story status and gate verdict to Jira via the Atlassian MCP. When backend is local, do nothing here.

12. LEARN AND RECORD. **This step runs once per story, after the final round, never once per round.** It writes the story's narrative and refreshes the board, and both are statements about the finished story, so running it mid-loop produces a narrative that the next round makes false. On the KaizenTasks runs it fired three times on one story and wrote three different summaries of it. Append any lesson to docs/CONVENTIONS.md and any D3 contract decision to docs/DECISIONS.md.
    **A finding shape a gate layer has now raised twice on this product stops being a fix and becomes a rule.** Before writing the lessons, read this story's findings against docs/CONVENTIONS.md and the gates already on disk. A shape seen a second time is written into CONVENTIONS.md as a rule, naming the shape, both occurrences by story id, and the evidence that would prove it, in the form docs/BUILD-STANDARDS.md uses. A shape that has now recurred across more than one epic, and that is true regardless of stack, is a candidate for BUILD-STANDARDS.md itself, which is a harness contract, so say so in the card and leave the promotion to a human. This step exists because on the KaizenTasks build of 16 to 20 August 2026 the same eight shapes bought a repair round over and over, and one of them was already written down as a rule the day before it recurred four more times. Fixing a finding twice and never writing it down is how a loop pays for the same defect all epic. Then drive all state through scripts/story.mjs, never by hand (finding 9): `story.mjs pr S-NNN <url>`, `story.mjs gate S-NNN docs/gates/S-NNN.yml`, `story.mjs status S-NNN in-review`, `story.mjs state --current <next-or-none> --last "<what happened>" --next "<next command or story>"`, and `story.mjs log "S-NNN in-review, gate <verdict>"`.
    Two more things happen here and nowhere else.
    - **Sweep the decisions.** Re-read the story Notes and append any entry whose disposition is `decision-owed` to the gate's `findings` with `outcome: decision-owed`, unless it is already there. This runs at 12 rather than at 7 on purpose: the reviewer at step 10 can raise its own decision, and the builder writes Notes across several rounds, so collecting at 7 would let a call sit in prose and never reach the record.
    - **Write the story's `## Summary` block**, four lines, by reading this story's events with `grep '"story":"S-NNN"' logs/events.jsonl`. Outcome quotes the `record` event's summary. Gate comes from the gate file's verdict plus the one reason. Your call lists every `decision` in the stream, or `none`. Work is counted from the events. Cost is NOT a line here, it lives in docs/COST.md which /cost projects from this same trail. Nothing here is authored twice, if a line cannot be filled from the events then the events are wrong and the fix is upstream.
    - **Refresh the render.** Last thing in this step, after the frontmatter, the gate and ROADMAP.yaml are all written, run `node scripts/render-docs.mjs`. That is the moment the board goes stale, so that is the moment to regenerate it. Regenerating before the state is written renders the previous run.

EPIC PR AND EPIC REVIEW (--all only). When the story just finished was the last todo in its epic (or --all is about to cross into the next epic), close out the epic branch.

**Every bullet below emits its open and close event, exactly like a story phase.** Pass the epic id in the id slot, `node scripts/story.mjs event E0N --phase <phase> --epic E0N --status <status> --summary "<one line>"`, with the same cost flags. The phase tokens are the same closed set, `checks` for the suite run, `pr` for the epic PR, `review` for the epic review, `build` for any round that clears it, `record` for the write-back. The id slot takes an epic id without complaint and `/cost` then reports the boundary as its own row. This is written down because it was not, and on the KaizenTasks run of 19 Aug 2026 the event trail stopped at 18:55 while the epic gate, PR #12, the epic review and its fix round ran on until 00:25. Nearly five hours of a nine hour story were invisible to `/cost` and `/standup`, so every measurement of this loop was understated by however long its boundary took.

- Run the full suite once with `scripts/test.sh` and write docs/gates/E0N.yml from the gate template with the verdict and gated_at, swapping the leading `story:` key for `epic: E0N` since this record covers the whole epic. This is the one verdict the epic PR leads with, per-story gates cannot see a cross-story regression.
- Open one PR for epic/E0N against the default branch with gh. The body leads with the epic verdict, then lists every story in the epic with its gate verdict, which safety layers ran or were skipped per story, and any story that blocked mid-epic. A blocked story does not hold the PR, the PR opens with the completed prefix and names the block. A red epic verdict still opens the PR (the work is pushed and visible) but the loop stops at this boundary and does not open the next epic. Record the PR url on each story with `story.mjs pr`.
- Post each story's per-story review verdict (from step 10) onto the PR as a commit-scoped comment.
- Run the epic-level adversarial review, Agent subagent_type "pr-reviewer" (Opus), over the full epic diff. **Seams only.** Its job is the cross-story seams no per-story review can see, interactions between stories, shared state two stories both touch, ordering between them, drift across the epic, duplicated or contradicting logic. **It does not re-review the internals of a story diff that already passed its own review at step 10.** Say so in its prompt and name which stories were already reviewed. This runs even when every story was individually reviewed, the altitudes are different, but only the higher altitude is its job. Without that scoping it repeats work already done twice, which is where S-023's 46 minute fifth build round came from, and the one finding that justified the pass was a seam finding, a completed container collapsed leaving the day permanently unclearable across the S-015 to S-016 boundary. The severity floor and `review.rounds` above apply here unchanged.

Loop if --all, else stop. Each story ends with the card from Reporting above, which already carries which layers ran and which were skipped, with the manual command for anything a tier turned off (/pr-review <n>). Name the epic verdict whenever an epic closed. A safety layer that was off is never left unmentioned. Never merge, merging is yours.
