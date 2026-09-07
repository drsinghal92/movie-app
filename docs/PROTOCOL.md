# KaizenOS execution protocol

The contract every build run follows. `/next` and the agents obey this. Kept small on purpose.

## Modes

Set in docs/profile.yaml. The mode decides how much discipline runs.

- **sketch** ... personal or throwaway. Skips the adversarial and security passes. Only the no-secrets check stays. Fast.
- **production** ... shipped, used by others, or touches auth, payments, or personal data. Every gate runs.

KaizenOS itself is production.

## Brand inside prototype

Two founder design steps run before any code, Prototype then Design. The brand is not a step of its own, it is decided inside /prototype's first pass, because you cannot react to a screen that has no paint, and you cannot judge paint except through the screens it lands on. One session sets both and you react to them together.

The brand pass writes docs/style-guide.html, the visual brand the whole product renders in, palette, type, spacing, radius, state colors, one self-contained page.

- **KaizenRise product.** Design System v4 is the source of truth, there is nothing to invent. The pass confirms and renders v4 into style-guide.html, near instant.
- **Non-KaizenRise product** (the common training case). There is no system yet, so this is a real, guided choice. The designer surfaces the load-bearing decisions, the accent, the type pairing, light or dark default, as tradeoffs anchored on the taste references from the ideate interview, and you shape them before it commits.

The pass runs only when style-guide.html is missing, so a later /prototype phase renders in the brand already set. /brand remains as an optional door outside the pipeline, for a re-brand of a shipped product, a token overhaul too large for screen reactions, or a brand for a headless product that gets no prototype. During the reaction loop, token-level notes route to brand mode and edit style-guide.html in place, screen-level notes route to prototype mode, so the two layers stay separately owned even though they land in one session.

## Prototype before design

Before /design, /prototype renders the PRD's screens as clickable HTML you can walk and react to, before any design is fixed and long before any code exists. The point is to let you think in visuals at the altitude where changing your mind is still free.

- **It reads** docs/PRD.md, docs/PRODUCT.md, and docs/style-guide.html (the brand layer its own first pass set). Real tokens, so the prototype is react-able, not a gray wireframe.
- **It may only draw what the product permits.** The PRD says what the product does, PRODUCT.md's non-goals say what it must not do, so the screen graph is checked against them before anything is drawn and reconciled again before you are asked to react. A story that implies a forbidden affordance is a contradiction between two contracts, and it stops the way a drift D3 stops, named and handed back to you. Catching it here is the point, because reversing a picture you already approved is the expensive failure.
- **It writes** prototypes/vN/, one folder per phase, committed. You react in chat, the designer re-renders. When the screens feel right, your reactions distill into docs/DESIGN.md, which is what /design commits.
- **It is a dead-end for the build.** The builder never imports from prototypes/ into code/. Committed means kept as the phase's vision record, not promoted to source. It informs the design, it never becomes the app.
- **It runs before /architect on purpose.** Reacting to a screen must never cost a stack decision.
- **It is skipped for headless products.** No meaningful UI in the PRD, a CLI or a library, the step says so and moves on, the way a skipped gate is always named.

Brand is the input, product design is the output. style-guide.html is the brand layer the prototype renders in, DESIGN.md is the product decision the prototype helps you reach.

## The unit of work

A **story** (S-NNN) is what the loop builds, gates, and ships. One story, one branch, one PR, one gate file, one demoable vertical slice. Its acceptance criteria are the specification it is judged against.

A **task** (S-NNN-T1) is one technical execution step inside a story, layer-tagged `[db]`, `[backend]`, `[frontend]`, `[test]`, `[infra]`, `[docs]`. The planner writes the task list, the builder ticks it off. A task never gets its own branch, PR, or gate, because a backend-only change cannot satisfy a story's acceptance criteria on its own.

Everywhere below, "story" means the shippable unit and "task" means a step inside one. The full hierarchy is in docs/STRUCTURE.md.

## Story autonomy

Each story carries an autonomy tag, set at plan time.

- **unattended** (default) ... safe to run overnight. The gates are the safety net.
- **supervised** ... needs you present. Real OAuth against a live provider, real payment capture, production data migrations, DNS or auth cutovers. The overnight runner skips these and queues them for your morning.

## Confidence check

Before building, the planner rates its confidence 1 to 10 that its task breakdown meets every one of the story's acceptance criteria.

- At or above the threshold (docs/profile.yaml, default 7) it proceeds.
- Below it, supervised mode pauses and asks you. Unattended mode does not guess. It writes the open questions into the story file, blocks the story through `story.mjs block --stage plan` so the stop carries a gate record and a reason, and moves to the next story.

That is why an overnight run never ships something it did not understand.

## Where stories come from

Five doors create stories. All five write the PRD, because the PRD is where ids live and a story with no PRD entry has no specification. `scripts/gate.mjs` enforces this rather than leaving it to prose, since prose is what drifted the first time.

| Door | When | Writes |
|------|------|--------|
| `/ideate` | greenfield, up front | the PRD itself, S-001 onward |
| `/map` | brownfield, up front | the PRD entry, then ROADMAP and the story file, for every piece of seeded work including tests, security gaps, and refactors |
| `/plan` | a PRD story too big for one slice | the split written back into the PRD. `/plan` may never mint an id from nothing |
| builder D4 | mid-build, out of scope | the PRD entry at the moment of seeding, then the backlog story |
| `/feedback` | implementation-level or D4 | the PRD entry at the moment of seeding, then ROADMAP and the backlog story |

**The id rule.** The next id is the highest story id in docs/PRD.md plus one. ROADMAP and the backlog are derived, never consulted for the next id. The up-front doors, `/ideate` and `/map`, are the only writer in their run and may number a whole batch in one pass. Every mid-build door reads the max and writes its PRD entry as one step, one story at a time, never batched, because under `--all` a builder D4 and a `/feedback` seed can otherwise read the same max before either writes and collide.

**Order matters.** PRD entry first, then ROADMAP, then the story file. A crash between steps leaves a specified story with no queue entry, which is recoverable. The reverse leaves a story nobody can trace, which is what this rule exists to prevent.

**Every amendment is recorded twice.** The story block in the PRD carries `**Added.**` with the date and the door, and the `## Amendments` section at the bottom of the PRD carries the why in its own dated entry. The marker makes one story traceable on its own, the section makes the spec's history readable. The up-front doors need no Amendments entry, their stories are the original spec, so `/ideate` stories carry `**Added.** /ideate` and `/map` stories carry `**Added.** /map` and that is the whole record.

**Kind.** Each story is `feature`, `chore`, or `fix` (docs/STRUCTURE.md). Doors that seed mid-build produce chores often, a convergence refactor, a deflake, a hardening pass, and they say so rather than inventing a user for the work. A `fix` corrects behavior that already shipped and names what it corrects, see What a failure leaves behind.

## Cancelling work

Requirements go stale. A story, or a whole epic, can stop being wanted before it is built. The `cancelled` status is how that decision is recorded, and it is a decision, not a deletion.

**Never delete, never reuse.** The PRD story block stays where it is and the id is never given to anything else. Cancelling a story that has vanished from the record is indistinguishable from never having specified it, and the point of the four-level model is that neither is possible.

**Recorded the same way an addition is.** The story block gains a `**Cancelled.**` marker carrying the date and the door, mirroring `**Added.**`, and the PRD's `## Amendments` section takes a dated entry naming why it is no longer wanted and what if anything replaces it. Both directions of the spec's history are readable from the same place.

**Then the status.** `node scripts/story.mjs status S-NNN cancelled` moves ROADMAP and the story frontmatter together. A cancelled story never gates, so no gate file is ever written for it, and it is not a missing gate.

**The door is `/feedback`.** Deciding a requirement is obsolete is feedback at product or implementation altitude, so it runs through the same triage and the same approval as everything else. `/revise` cannot cancel. A story-scoped command must not be able to retire work.

**Shipped work is a removal, not a cancellation.** Once a story is `done` the code exists. Taking it back out is real work with its own acceptance criteria and its own gate, so it becomes a new story seeded through `/feedback`, and the shipped story stays `done` because it is a true record of what happened. `scripts/story.mjs` refuses the flip rather than trusting this to prose.

**Cancelled is resolved, blocked is not.** A cancelled story leaves the queue and the build phase can complete over the top of it. A blocked story holds the build phase open, because it is real unfinished work waiting on a human, and the pipeline must never report ship while one is outstanding. Both are visible in the phase line. Cancelling is the honest way to retire a story you have decided never to unblock.

## What a failure leaves behind

Outcomes were always recorded. Evidence was not. A gate said what the verdict was, never what went wrong reaching it, and the record thinned out exactly where it should have thickened, since a story blocked on exhausted retries produced no gate file at all. These rules fix that, and they cost no extra model call. The reviewers already produce this information, it simply had nowhere to land.

**Every stop produces a gate record.** A confidence block, a D3 contract change, exhausted retries, a security BLOCKED, all of them run `node scripts/story.mjs block S-NNN --stage <stage> --reason "<one line>"`. That writes the gate with `verdict: BLOCKED`, moves ROADMAP and the story frontmatter together, sets the STATE `blocked:` pointer, and appends to PROGRESS. `story.mjs status S-NNN blocked` is refused, because a story that stopped is the one most worth explaining.

**Findings are appended, never replaced.** Every layer that raises something, checks, QA, security, the adversarial review, writes an entry into the gate's `findings` list with its source, severity, what it was, and what happened to it. A story that failed QA twice and then passed carries both failures with `outcome: fixed-in-loop` alongside `verdict: PASS`. That is how flakiness becomes visible at all, since nothing else on disk distinguishes a clean pass from a third attempt.

**The severity floor. A finding's rank decides whether it costs a build round.** `high` routes the builder back now. `medium` waits and goes back once, in one batch with every other layer's mediums, after the last gate has run. `low` and nits never route back at all, they land in `findings` with `outcome: recorded` and anything worth doing becomes a follow-up story under D4. The default floor is `high`, and `review.action_floor` in profile.yaml names it. An install whose profile predates the key behaves as if it read `high`.

**The review round cap.** The adversarial reviewer runs `review.rounds` times per story, default 1. A second pass exists only where the profile allows it, is handed the first pass's finding list, and is confined to asking whether those highs are closed. Anything it notices outside that list is recorded, never actioned. Both rules exist because an adversarial pass is not idempotent, a reviewer pointed at a clean diff always finds something, so a loop with no floor and no cap converges on nothing. Measured on one project over four days, that was 23 build rounds for 7 stories, and a story whose first build took 52 minutes and whose whole run took 9.1 hours. The floor and the cap are stopping rules. Neither is a claim that the findings they decline to action are false, which is why they are recorded rather than dropped.

**A decision only a human can make never lives in prose alone.** When a layer raises a call that is not the loop's to settle, ship a follow-up or amend the design, it carries `outcome: decision-owed` in `findings`, rides the event stream as a `decision`, and reaches the story's `## Summary` under Your call. The story Notes still carry the full reasoning. What changes is that the call itself is now in three places a reader actually looks, rather than at paragraph nine of a log nobody opens. The sweep runs at step 12 rather than at the gate write, because the adversarial reviewer runs after the gate and can raise one of its own.

**Gate records are write-once.** Re-gating rotates the old record with `story.mjs reopen S-NNN --reason "<one line>" --missed-by <value>`, which keeps it as `S-NNN.r1.yml`. `/revise` used to overwrite the record it contradicted, destroying the PASS that let a defect through. Reopen is also the only sanctioned path out of `blocked` or `done`, and it replaces the hand-edits of ROADMAP and the gate pointer that every other rule forbids.

**Judges report, the loop writes.** The qa, security, and pr-reviewer agents stay read-only. They return findings in a fixed shape and the loop transcribes them verbatim. A judge that writes its own record is a worse gate, and agent-owned writes race the orchestrator.

**A defect that reached a human is a `fix`.** The third story kind. It ships identically and it names what it corrects, `fixes: S-024`, or `none` when the code predates the pipeline. `scripts/gate.mjs` refuses to gate a fix story that names nothing. Its gate carries the `escaped` block, `found_by` and `missed_by`, so the escape is recorded whichever door it came through, a new fix story from `/feedback` or a `/revise` on the shipped story itself. The gate file is the only artifact that exists on both paths, which is why the record lives there.

**`missed_by: spec` is not a gate failure.** A story built exactly to its acceptance criteria where the criteria were wrong is a PRD fault. Charging it to the nearest gate would send you to tune a gate when you should amend the spec. `amend` on a reopen means the change was not a defect at all, so a change of mind never inflates the escape count.

What this makes answerable, from the repo alone.

- Which defects escaped, `grep -l '^escaped:$' docs/gates/*.yml`. Anchor the line, since an unset record reads `escaped: null` and would otherwise match.
- Which gate let each one through, `grep -h 'missed_by:' docs/gates/*.yml | sort | uniq -c`. Read it against `grep -hc 'source: qa' docs/gates/*.yml` for what that layer did catch, and against `grep -c 'review: skipped' docs/gates/*.yml` for how often it was not running at all. A gate with many misses and few catches is weak. A gate with many misses and a high skipped count is not weak, it is off, and those are different fixes.
- What keeps breaking, `grep -h '  fixes:' docs/gates/*.yml | sort | uniq -c`. A story appearing three times is the project naming its own worst module.

## Drift rules

When the builder hits something the task breakdown did not cover, it picks one of four and logs the choice in the story Notes.

- **D1 Trivial.** A typo or an obvious one-line correction. Fix it, note it.
- **D2 In-scope gap.** An obvious missing piece needed to meet the acceptance criteria. Add it as a new task in the story's Tasks list, note it.
- **D3 Contract change.** Anything that alters the architecture, a shared interface, or a data model. Stop. Supervised mode asks. Unattended mode writes the decision request into Notes and blocks the story through `story.mjs block --stage build`, so the stop leaves a gate record, then moves on. Never silently rearchitect.
- **D4 Out of scope.** A new capability or idea. Do not build it now. Write its PRD entry first, taking the next id, with its kind, its `**Added.**` marker naming this story as the trigger, and an Amendments entry saying why. Then seed the backlog story and keep going. See Where stories come from.

D1 and D2 keep the loop moving. D3 and D4 protect you from drift.

## The feedback loop

The pipeline runs both ways. Once an app exists, `/feedback` is the door back in. It reads free-form feedback, splits it into points, and routes each by altitude, using the same drift vocabulary in reverse.

- **Product-level** feedback amends PRODUCT.md / PRD and can re-open `/ideate` on the affected epic.
- **Design-level** feedback routes to the designer and amends DESIGN.md. A visual note may first re-open /prototype so you see the change before it is written down, then it hardens into DESIGN.md.
- **Architecture-level** feedback is a D3 contract change. It stops, writes a decision request into DECISIONS.md, and waits for your call. It never rearchitects silently.
- **Implementation-level** feedback seeds a story, PRD entry first under the rules in Where stories come from, then the backlog. A trivial D1 fix may run `/next` immediately after you approve the triage; D2 and D4 queue for the next run.

`/feedback` always shows the triage before acting, so you approve the routing. For a change scoped to a single already-shipped story, `/revise S-NNN` re-opens that one story, amends it, and re-gates it through the full sequence. Anything above D2 inside a revise stops and routes back through `/feedback`.

## The gate sequence inside /next

1. **Plan** (planner, Opus). Goal-backward from the acceptance criteria into the story's Tasks list, each task layer-tagged and naming the files it touches, then the confidence check.
2. **Build** (builder, Sonnet 5). Implement the slice, write tests, apply the drift rules.
3. **Checks gate** (scripts/gate.mjs, no model). Deterministic. Confirms every acceptance box is ticked, a test exists, the diff has no hardcoded secrets or orphan TODOs, and the roster holds, meaning the story under gate has a PRD entry, no id is defined twice in the PRD, and a cancelled story is never gated. Other backlog stories missing a PRD entry warn rather than fail, so a repo that predates this rule keeps running and its shipped work is untouched. That warning is not a reprieve though. Each of those stories hard-fails the moment the loop picks it up, so anything still intended for build gets backfilled first, and anything that is not gets cancelled. Instant and free.
4. **QA gate** (qa, Sonnet). Reruns tests, judges the diff against acceptance, and for a ui_surface story enforces the UI verification clause below. PASS, CONCERNS, or FAIL. Can block.
5. **Security pass** (security-reviewer, Sonnet). Production only, and only when the story touches a flagged surface. OWASP-style check. PASS, WARN, or BLOCKED.
6. **Commit and PR.** One commit per story. Interactively, one PR per story. Under `--all`, stories commit onto one epic branch, pushed after every story, and the single PR opens at the epic boundary (The --all epic shape, below).
7. **Adversarial review** (pr-reviewer, Opus). Hunts the bugs the builder's own family would miss. Does not merge. Interactively it posts to the story PR. Under `--all` the story-level verdict lands in the gate file at story time and is posted onto the epic PR once it exists, and a second, epic-level review runs at the boundary (The --all epic shape, below).
8. **Record.** Write the gate file docs/gates/S-NNN.yml. Append lessons to docs/CONVENTIONS.md and any contract decision to docs/DECISIONS.md. Update docs/STATE.md. If tracking.backend is jira or both, mirror the verdict to Jira. Local backend does nothing here.

On any gate failure the builder gets the report and retries, up to the retry count in profile.yaml. Still failing, the story is marked blocked and the loop moves on. **Which findings buy a retry is decided by severity, not by count**, see The severity floor below.

## Tests and traceability

Tests are code. They live in the app under `code/<slot>/`, in whatever framework the architect chose, and `scripts/test.sh` is the suite that runs every slot and fails if any slot fails. There is no separate test-case artifact and no test-case id, because a test file already is the record and duplicating it into a doc guarantees the two drift.

What is missing without a convention is the link back to the specification. A red suite tells you something broke, not which acceptance criterion stopped being true.

**The rule. A test that proves an acceptance criterion names it in its title.**

```
test('S-001-AC1 rejects a file over 10MB with a visible error', ...)
```

That one habit does the work, and it is framework-agnostic because every runner prints test titles.

- Coverage is greppable. `git grep S-001-AC1` answers "what proves this" without a mapping file to maintain.
- Failure output names the criterion. When the suite goes red, the failing title carries the id, so the builder and the reviewer know which part of the spec broke rather than which function threw.
- It survives refactors. The link lives in the test itself, not in a doc that has to be kept in sync.

How it is enforced, deliberately lightly.

- **The planner** names in each `[test]` task which criteria that test proves.
- **The builder** puts the id in the title of the test it writes.
- **Checks, scripts/gate.mjs.** For each acceptance criterion in the story it looks for a test naming it, and warns for any it cannot find. This is a warning and never a hard fail. A brownfield app has a suite full of untagged tests that genuinely cover the work, and "no test names AC2" is a fact about titles, not a verdict on whether AC2 is met.
- **Judgment, the qa agent.** It decides whether the criteria are actually met, and when the suite is red it reports the failing test titles so the gate file records them.

The gate records `tests: green | red` for the run and `failing_cases` when it is red. Acceptance stays one `acceptance_met` field for the story. Acceptance criteria are the specification the story is judged against, not units of work to be tracked one by one, and splitting the gate per criterion would turn them into exactly that.

## UI verification

A feature is not finished until the real UI has been driven. This is a correctness gate, not an adversarial one, so it runs in every mode, sketch included. A lighter tier may skip the adversarial and security passes, it never skips proving the feature works.

The rule. When the planner sets `ui_surface: true` on a story (any acceptance criterion that runs through a screen or a real input mechanism, upload, drag-and-drop, form submit, clipboard), the story must be proven through that real mechanism before its gate is green. An API call with a substitute payload does not count. A typed path is not an upload, a direct POST is not a form submit. An API check proves the API is correct, it does not prove the feature works. The failure mode this guards against is real, an upload handed to the app as a `blob:` object URL can be rejected by a path guard the API-level smoke test never exercised, so every direct call passes and the real upload always fails.

How it is enforced, three layers keyed off the one flag.

- **Primary, a durable end-to-end test in scripts/test.sh.** The builder writes a Playwright test that drives the actual input path the user takes (the real file chooser, the real drag-drop, the real submit), and it lands in the app's own suite. It is then re-run by qa, by CI, and forever after. This is the path that survives, and it is the only one guaranteed to exist in an unattended overnight run where no interactive browser is available.
- **Checks, scripts/gate.mjs.** For a flagged story it fails when no browser end-to-end test is present at all. Presence is mechanical, authenticity is not its job.
- **Judgment, the qa agent.** It confirms the test drives the real input path and is not a substitute payload dressed up as one, and records `ui_verified` in the gate file. This is the call gate.mjs cannot make.

The interactive fallback. In a supervised session the operator or the main loop can verify a screen by hand with the `verify` skill or Claude in Chrome. That is a fallback for the moment, not a substitute for the durable test, the subagents cannot reach a browser and an overnight run may have none. If a ui_surface story's real input cannot be driven by an automated test, the planner tags it supervised so it is verified by hand and never ships unverified overnight. For UI products the architect makes scripts/test.sh capable of an end-to-end browser run, or the builder has nothing to write the real-input test against.

Skipped steps are surfaced, never silent. When the mode or tier turns a gate off, the security pass in sketch mode, or the adversarial review when review.pr_reviewer is false, the loop names it in its report and gives the command to run it manually (/pr-review for the review). The operator always knows which safety layers were active and which were not.

## Cross-family review

The builder runs on Sonnet 5. The adversarial pr-reviewer runs on Opus. A reviewer on a different model catches the blind spots a model shares with itself.

## Stacked chains

A story is eligible when every dependency is either done, or in-review with a PASS or CONCERNS gate. In the second case the loop chains, the story branch is created off the dependency's branch instead of the default branch, and its PR targets that branch as base. Your morning merges cascade in dependency order, merge the bottom PR first and the stack follows. A FAIL or blocked dependency never chains, the loop stops there and says why.

This is what makes a linear backlog drain overnight instead of yielding one PR per night.

## The --all epic shape

Stacked per-story PRs are the interactive shape. A backlog drain (`--all`, and `/loop /next`) batches at the epic instead, because a drain produces many stories per night and the stack is what makes the morning heavy and the bookkeeping files re-conflict.

- **One epic branch.** Stories commit onto epic/E0N off the default branch, one clean commit per story, no per-story branches and no stacked PRs. The branch is pushed after every story commit, the push is the crash net that survives the machine, on-stop.sh only saves locally.
- **One epic verdict.** At the boundary the full suite runs once with `scripts/test.sh` and the verdict is written to docs/gates/E0N.yml. Per-story gates cannot see a cross-story regression, this run can.
- **One epic PR.** Opens at the epic boundary, after the epic verdict. The body leads with that verdict, then lists every story with its gate verdict, which safety layers ran or were skipped per story, and any story that blocked mid-epic. A blocked story does not hold the PR, it opens with the completed prefix and names the block. A red epic verdict still opens the PR so the work is visible, and the loop stops at the boundary.
- **Review at two altitudes.** Stories keep their per-story adversarial review at story time, verdict into the gate file, posted onto the epic PR as a commit-scoped comment once it exists. At the boundary a second, epic-level review runs over the full diff for the cross-story seams no per-story review can see, interactions, drift across the epic, duplicated or contradicting logic. The epic pass runs even when every story was individually reviewed, the altitudes are different.
- **Morning.** One PR per epic instead of a cascade. Merging is unchanged, human by default, merger agent only under agent-on-green, and the loop itself still never merges.

## Git and CI

One repo per product, trunk-based. Interactively one story, one branch (story/S-NNN-slug), one PR; under `--all` one epic, one branch (epic/E0N), one PR at the boundary. Tasks inside a story never branch. Merge commits only, never squash, stacks depend on parent commits existing. Policy, config, and harness-sync commits land on the default branch directly, never inside a story branch, and before any such commit you verify the default branch is actually checked out (`git branch --show-current`), a working tree can be left on a story branch by another session. No force-pushes, no history rewrites, by anyone.

CI (.github/workflows/ci.yml, installed by the kit) independently re-runs the test gate and typecheck on every PR and every push to the default branch. It is the second verification layer, the qa agent is the first, and it answers to no one's story file. Where CI exists, nothing merges red.

## Merging

Default is yours. docs/profile.yaml review.merge decides:

- **human** (default, and the production-tier default) ... no agent merges, ever. PRs wait for your morning. Run `/land` after you merge, see Reconcile below.
- **agent-on-green** ... the merger agent may merge a PR only when its gate verdict is PASS or CONCERNS and its PR review verdict is ship it or ship with nits. FAIL, WAIVED, or needs work always waits for you. It merges stacks bottom-up with merge commits, verifies the default branch is green afterward, and stops cold on any conflict or red test. It never force-pushes. It reconciles by calling the same command the human path calls.

### Reconcile, either way

A merge ships the code and nothing else. Story status, the state pointer, the progress log and the rendered board all still say in-review, and the repo's own board reports shipped work as unfinished until something writes them back.

That write-back belongs to the merge, not to the merge policy. `node scripts/landed.mjs --apply`, or `/land`, is the one command that performs it, and both policies call it, the merger agent as its last step and you by hand after your morning merge. It is deterministic, it runs no model, and it refuses to run anywhere but the default branch.

This was written down inside the merger agent alone until 2026-08-19, so on the default policy it never ran at all. Two epics on KaizenTasks merged and left every story reading in-review, and the hand repairs that followed each missed part of the list, because a checklist a human follows from memory is followed partially. `/next` and `/standup` now name the gap when they see it. Neither of them closes it, an entry check does not get to commit to the default branch.

The build loop itself still never merges. Merge authority lives only in the merger agent behind this flag.
