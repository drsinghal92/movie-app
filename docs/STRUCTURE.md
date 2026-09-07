# KaizenOS structure

Every artifact, where it lives, what shape it takes, who writes it, and when. This is the contract for the whole project. The structure is BMAD-grade. The execution stays lean.

## The work hierarchy

PRODUCT (why) -> PRD (epics -> stories -> acceptance criteria) -> ROADMAP (the queue) -> story files (stories -> tasks) -> gate files

Four levels, each with one job and one id. Ids are assigned once, in the PRD, and never renumbered. The PRD is the id authority, and every door that creates a story writes its PRD entry first (Where stories come from, in docs/PROTOCOL.md).

| Level | Id | Lives in | Is |
|-------|-----|----------|----|
| Epic | E01 | PRD section, ROADMAP | a body of work with one outcome |
| Story | S-001 | PRD section, backlog/E01/S-001.md | the shippable unit. A `feature` is a user-facing outcome, a `chore` is work with a real consequence and no user, a `fix` corrects what already shipped |
| Acceptance criterion | S-001-AC1 | inside the story | specification, a checkable behavior |
| Task | S-001-T1 | the story file's `## Tasks` section | one technical execution step, layer-tagged |

**Three kinds of story.** `feature` is the default, a user-facing outcome in As-a form. `chore` is work with a real consequence and no user-facing capability, a convergence refactor, a deflake, a hardening pass the user will never see. `fix` corrects behavior that already shipped, and carries `fixes:` naming the story that shipped the defect, or `none` when the code predates the pipeline. A chore branches, gates, and ships exactly like a feature and keeps numbered acceptance criteria. It states a technical outcome instead of the As-a line. The kind is decided in the PRD story block and copied into the story file frontmatter, never decided in the story file, so a later door cannot reclassify a story behind the spec's back. Without this kind, real work is either dressed in invented user-story prose, buried as a task inside an unrelated story, or left with no spec at all.

**The story is the unit that ships.** One story, one branch, one PR, one gate file, one demoable vertical slice carrying UI, logic, and data together. Tasks are the execution breakdown inside it, `[db]`, `[backend]`, `[frontend]`, `[test]`, `[infra]`, `[docs]`. A task never gets its own branch, PR, or gate, because a backend-only change cannot satisfy a story's acceptance criteria on its own.

Acceptance criteria are specification, not work. They are numbered so QA, `/feedback`, and `/revise` have something to point at. The gate records one `acceptance_met` for the story.

Rules that keep the spec honest:

- An AC states a behavior, never a mechanism. "The upload rejects a file over 10MB with a visible error" is an AC. "Validate size in the upload handler" is a task.
- One AC, one behavior. If it needs "and", split it.
- ACs and tasks are numbered at write time and never renumbered. Add AC4, never reuse a retired number.
- Every AC must be claimed by at least one task. An unclaimed AC is a planning miss.

Nothing is flat. Stories live under epics, tasks live inside stories. Every story that is built gets a gate. A `cancelled` story is the one exception, it never builds so it never gates, and the absence of its gate file is correct rather than a miss.

**Cancelling.** A requirement that goes stale is cancelled, never deleted. The PRD block stays, the id is never reused, the block gains a `**Cancelled.**` marker and the `## Amendments` section takes an entry saying why. `/feedback` is the only door that can do it, and a `done` story cannot be cancelled at all, since removing shipped code is a new story with its own gate. Full rule in docs/PROTOCOL.md under Cancelling work.

The story id is global, not epic-scoped, so a story keeps its id if it moves epics. The same id is used unchanged in every place the story appears:

```
docs/PRD.md            #### S-001 <title>
docs/ROADMAP.yaml      epics: -> stories: -> id: S-001
backlog/E01/S-001.md   the story file
docs/gates/S-001.yml   the gate record
branch                 story/S-001-slug
```

## Artifact map

| File | Holds | Written by | Lifecycle |
|------|-------|-----------|-----------|
| docs/PRODUCT.md | Brief. Problem, users, value, scope, non-goals, success, plus the append-only Interview record | /ideate | once, edited rarely |
| docs/PRD.md | The specification, and the id authority. Epics, each with its stories (S-NNN), their kind, their `**Added.**` origin marker, a `**Cancelled.**` marker once retired, and their numbered acceptance criteria. An `## Amendments` section at the bottom carries why the spec changed in either direction. No status, no plan | /ideate, then every door that seeds a story (/map, /plan splits, builder D4, /feedback) | live, amended whenever a story or epic is added or cancelled |
| docs/style-guide.html | The brand layer rendered, type, color, buttons, spacing, states, motion. The paint the prototype and the app render in. A self-contained page, no build. v4 for KaizenRise products, newly defined otherwise | designer (/prototype first pass, or the /brand door) | set on the first prototype pass, edited on reaction |
| prototypes/vN/*.html | Clickable HTML of a phase's screens in the brand, no logic. Reacted to, distilled into DESIGN.md, then kept as the phase's vision record. Never imported into code/ | designer (/prototype) | committed, one folder per phase |
| docs/DESIGN.md | The product decision. Screens, flows, states, components, and interaction (motion scaled by product type). Consumes the brand, does not redefine it. The output of reacting to the prototype | designer (/design) | evolves with design |
| docs/html/*.html | Styled, structured HTML view of the human-facing docs, rendered from the markdown. Read-only, not a source | scripts/render-docs.mjs | regenerated on /design, /architect, /standup, and at /next step 12 |
| docs/html/index.html | The board above the document index. Every story in its column, and where each one is | scripts/render-board.mjs, via render-docs.mjs | regenerated with the docs |
| docs/html/story-S-NNN.html | One story, read end to end. Summary, why it is blocked, goal, acceptance criteria, work, drift notes, what the gate said, and how the run went | scripts/render-board.mjs, via render-docs.mjs | one per story in ROADMAP.yaml |
| docs/html/epic-E0N.html | One epic. Its goal, its stories in dependency order, and its own gate record when it has one | scripts/render-board.mjs, via render-docs.mjs | one per epic in ROADMAP.yaml |
| docs/kaizenos-journey.html | The narrative walkthrough, idea to shipped app. What KaizenOS is, for a reader who opened the board without knowing. Hand-authored, not rendered from anything, and the same in every project | the harness, refreshed by update.sh | stable reference |
| docs/ARCHITECTURE.md | Stack, data model, system design, conventions, the test command | architect | amended by decisions |
| docs/ROADMAP.yaml | Work breakdown and queue. Epics with their stories and status. Tasks are not listed here, they live in the story file | /plan | live, every story |
| backlog/E0N/S-NNN.md | One self-contained story. Acceptance criteria, context, the task breakdown, tests, notes | /plan, then planner and builder | per story |
| docs/gates/S-NNN.yml | The gate record and the evidence. Verdict, tests, failing cases, acceptance, security, review, every finding any layer raised, and the escape block when it closes a defect that reached a human. Write-once, rotated to S-NNN.rN.yml on reopen | /next, scripts/story.mjs | per story, per gate cycle |
| docs/DECISIONS.md | Append-only log of architecture and scope calls | architect, /next drift D3 | grows |
| docs/IDEAS.md | Parking lot. Raw ideas for this product, not yet in the pipeline, newest first. Not a queue and never built from directly, an idea graduates by becoming a PRD story through a door | you, by hand | grows, pruned when ideas graduate or die |
| docs/CONVENTIONS.md | Conventions plus harvested lessons | architect, /next learn step | grows |
| docs/STATE.md | The resumable pointer | /next | live |
| docs/profile.yaml | Config. Models, mode, tracking, thresholds | you | edited to tune |
| logs/PROGRESS.md | One line per story event. The human trail | /next | append-only |
| logs/events.jsonl | One JSON object per phase event, twice per phase (open and close). The machine trail. The only source for LIVE PER-PHASE progress, which PROGRESS.md does not carry. It does not supersede PROGRESS.md, see below | /next, scripts/story.mjs event | append-only, per phase |
| docs/COST.md | What the build cost, per story and per phase. Derived from the events, never hand-edited | scripts/cost.mjs (/cost, /standup) | regenerated |
| logs/cost.csv | The same projection, one flat row per phase event, for a spreadsheet | scripts/cost.mjs | regenerated |
| docs/UX-PRINCIPLES.md | The structure and navigation reference the designer anchors on in design mode. Hierarchy, one primary action per screen, nav placement, the empty and error states, and the design order. A contract, so it ships to every install | seeded, rarely edited | stable reference |
| docs/BUILD-STANDARDS.md | The eight code standards every product built by this harness follows, whatever its stack. Citations, non-vacuous tests, measured visuals, failure paths, canonical query predicates, invalidation, per-element parsing of model output, one owner per assembled string. Each states the evidence that proves it. A contract, so it ships to every install, and a rule about one product's stack goes in CONVENTIONS.md instead | seeded, then overwritten by every update like the other contracts. A ninth rule is added in the harness repo, never in an install, where the next update would erase it | stable reference |
| docs/TRAPS.md | Harness mechanics. The commands and scripts in this kit that fail in a way which looks like success. A contract, so it ships to every install and this product's own lessons go in CONVENTIONS.md instead | seeded, appended when a tool lies | stable reference |
| docs/SUCCESSION.md | How one session hands the project to the next. The two hard conditions and the nine close-out questions, run by /handoff. A contract | seeded, rarely edited | stable reference |
| docs/HANDOFF.md | What /handoff wrote. Mid-flight work, parked items with an owner and a trigger, and the close-out answers. Never restates STATE.md, cites it. Overwritten by each handoff, not appended to | /handoff | replaced per handoff |
| docs/METHODS.md | The six elicitation methods and the interactive loop, used by /ideate, /design, /feedback in guided mode | seeded, rarely edited | stable reference |
| docs/pipeline.json | The pipeline steps as data. `/help` reads it to name the next command. The pipeline tables in CLAUDE.md and README.md are hand-maintained prose | you, when a step changes | stable source |

**Product memory is per project and never travels.** PRODUCT, PRD, DESIGN, ARCHITECTURE, DECISIONS, CONVENTIONS, STATE, the backlog, the gates, and IDEAS belong to the repo they sit in. The harness seeds them empty at install and never overwrites them again. Only the contracts, PROTOCOL.md, STRUCTURE.md, UX-PRINCIPLES.md, BUILD-STANDARDS.md, TRAPS.md, and SUCCESSION.md, are refreshed by an update, because they are the same for every project by definition. This is why an installed project has its own IDEAS.md rather than a copy of the harness repo's, and why the two cross-reference each other by date and title when one depends on the other.

Templates live in `templates/` (prd.md, epic.md, story.md, ideas.md, gate.yml, style-guide.html, and the two profile presets). `epic.md` and the story section of `prd.md` are section shapes used inside docs/PRD.md, not standalone files.

`/feedback` and `/revise` are the doors back in. They do not own a new artifact, they amend the existing ones (PRODUCT, PRD, DESIGN, DECISIONS, ROADMAP, story files) under the drift rules, so the round trip stays inside the same contract.

## The HTML view layer

Markdown is the source of truth for every doc, because the agents read and write those files every run and markdown is the cheapest, most diffable, most parseable shape for that. Humans read markdown poorly, so `scripts/render-docs.mjs` renders them into styled, structured HTML under `docs/html/`, on one shared KaizenRise v4 stylesheet, no build and no framework. Open `docs/html/index.html`.

**Two things render, the board and the documents.** The documents are every `docs/*.md`, below. The board is `docs/ROADMAP.yaml` combined with the story files and the gate records, written by `scripts/render-board.mjs` and composed into the same output by `render-docs.mjs`, which owns the directory and the reap. A project with no roadmap renders documents only, and says so, because that is the ordinary state before `/plan` has run.

The board is for reading, not driving. It shows where every story is, what is inside one, and what its gate said. It dispatches nothing, writes nothing outside `docs/html/`, and needs no server. Nothing is invented from an absent file, in particular a story with no gate record says which kind of nothing that is and never reads as a pass. A section with nothing to say renders nothing, while a field missing from a record that does exist says `not recorded`, because a blank there is indistinguishable from a passing value. One unreadable story costs that story its detail and earns a visible notice, never the whole render.

A story page also reads the run, by pairing the open and close events for that story in `logs/events.jsonl`. Ordered by file position and never by parsing `ts`, per the rule below. A phase that opened and never closed renders as interrupted, never as a pass, for the same reason a missing gate does not read as green. Durations and tokens are measured, money is derived and always labelled estimated, in the currency `cost.currency` names, and the total says it is a floor because the loop's own orchestration is not counted. Per-phase money is deliberately absent, one total is what a reader needs and the rest is in `docs/COST.md`.

Both themes ship, light by default. The only JavaScript on the page is the theme toggle, and every page is complete without it.

**Every `docs/*.md` renders except `docs/STATE.md`.** The script's `DENY` set is the whole exclusion, and its `KNOWN` list only supplies ordering, a title, and a blurb, so a new founder doc appears in the index without a harness edit and an unlisted one is titled from its filename. This used to be the other way round, a hand-listed set was the gate, and a doc added to `docs/` and left off the list disappeared with no message, which reads exactly like an exclusion made on purpose. It drifted twice that way before KaizenBridge reported it on 2026-08-06.

`PROTOCOL.md` and `STRUCTURE.md` render. They were held back until 2026-08-06 as machine contracts, which was never a reason a person should not read them legibly, and they are the two documents a reader most needs. `STATE.md` stays out because the loop rewrites it every run, so a page for it would be stale more often than current, and it is four lines of pointer.

The render also reaps. Any `.html` in `docs/html/` this run did not produce is deleted, because the script only ever wrote before and a page dropped from the set survived as an unreachable copy that looked current.

What has no HTML view is what is not markdown, plus the one pointer: ROADMAP.yaml, backlog story files, gate files, profile.yaml, and STATE.md. The render is one-directional, markdown in, HTML out. Never edit `docs/html/` by hand, it is regenerated.

## Code layout

All product code lives under `code/`, separated from the harness and the docs. Three canonical slots, use only what the product needs:

```
code/
  frontend/    the UI app, its own package.json and test script
  backend/     API or services, only when the product needs a separate one
  db/          schema, migrations, seeds, only when server-side persistence exists
```

Rules:
- The architect decides which slots exist and records it in ARCHITECTURE.md. A fullstack framework (Next.js with API routes) occupies `code/frontend` alone until a separate service is justified.
- Each slot owns its package.json. `scripts/test.sh` runs every slot's test script and fails if any fails. `scripts/check.sh` does the same for typecheck and lint, advisory.
- The repo root holds only the harness (.claude/, scripts/, templates/), the product memory (docs/, backlog/, logs/, prototypes/), and git files. No app code at root.
- `prototypes/` is a committed design record, one subfolder per phase (`v1/`, `v2/`, ...), not product code. The builder is forbidden from importing from it into `code/`. Committed means kept, not promoted to source.
- Brownfield exception, `/map` never moves existing code. An existing app keeps its own layout, the mapper documents it in ARCHITECTURE.md, and the `code/` convention applies to greenfield builds.

## ROADMAP.yaml schema

```yaml
project: <slug>
epics:
  - id: E01
    title: <epic title>
    goal: <one line>
    stories:
      - id: S-001
        title: <story title>
        depends_on: []          # e.g. [S-000]
        autonomy: unattended    # unattended | supervised
        status: todo            # todo | in-progress | in-review | blocked | done | cancelled
        gate: null              # docs/gates/S-001.yml once gated
        pr: null
```

ROADMAP is the queue, two levels deep and no deeper. Tasks are deliberately absent, they live in the story file. This is load-bearing, `scripts/phase.mjs` counts `status:` tokens across the whole file to derive the build phase, so exactly one `status:` per story must appear here. A third level carrying its own status would double-count and corrupt phase detection for `/next` and `/help`.

## Story file schema (backlog/E0N/S-NNN.md)

Frontmatter: id, epic, title, status, autonomy, ui_surface, depends_on, branch, pr, gate, confidence.
Sections: Summary (four lines, the only part most readers open, assembled by /next at the record phase from logs/events.jsonl and never authored by hand), Story (as-a / I-want / so-that, or a technical outcome line when `kind: chore`), Origin (the PRD `**Added.**` marker verbatim), Acceptance criteria (numbered checkboxes, the spec), Out of scope, Context (PRD / DESIGN / ARCHITECTURE references), Tasks (the planner's layer-tagged execution breakdown), Test plan, Notes (builder + drift decisions), Open questions. Full shape in templates/story.md.

Summary is first because the depth below it is the point of the file and also the reason nobody reads it. Before the story is gated the section is exactly one line, `- Not gated yet.`, so an in-progress story renders a real statement rather than a row of placeholders.

The spec half (story, acceptance criteria, out of scope) comes from the PRD. The execution half (tasks) is written by the planner. Tasks are checkboxes the builder ticks as it goes, and they carry no status, branch, PR, or gate of their own.

## Gate file schema (docs/gates/S-NNN.yml)

```yaml
story: S-001
title: <story title>
verdict: PASS            # PASS | CONCERNS | FAIL | BLOCKED | WAIVED
gated_at: <YYYY-MM-DD HH:MM>
tests: green             # green | red | n/a
failing_cases: []        # when red, the failing test titles verbatim
acceptance_met: true
ui_verified: n/a         # PASS | FAIL | n/a. real browser e2e drove the input path, or n/a when not ui_surface
security: n/a            # PASS | WARN | BLOCKED | skipped | n/a
review: n/a              # ship | nits | needs-work | skipped | n/a. the adversarial reviewer's verdict
findings: []             # every finding any layer raised, appended never replaced
  # - source: qa         # checks | qa | security | review | ci
  #   severity: high     # high | medium | low
  #   what: "<one line, with file and line where there is one>"
  #   outcome: fixed-in-loop   # fixed-in-loop | recorded | follow-up S-NNN | accepted | waived | decision-owed
escaped: null            # set only when this gate closes a defect that reached a human
  # fixes: S-024         # the story that shipped the defect, or none if the code predates the pipeline
  # found_by: user       # user | operator | ci | monitoring | reviewer
  # missed_by: qa        # checks | qa | security | review | spec | none
  # reported: <YYYY-MM-DD>
blocked: null            # set only when verdict is BLOCKED, written by scripts/story.mjs block
  # at_stage: qa         # plan | build | checks | qa | security | review | pr | record
  # reason: "<one line>"
pr: <url>
notes: <one line>
waiver:                  # only when verdict is WAIVED
  reason: null
  approved_by: null
```

**Gate records are write-once.** A story is gated once per cycle. Re-gating requires rotating the existing record first with `node scripts/story.mjs reopen S-NNN`, which renames it to `S-NNN.r1.yml` and clears the pointer. `scripts/gate.mjs` refuses to gate a story that already has a record, so a verdict is never overwritten by the verdict that contradicts it. Gate files are committed, so git holds the full history and the rotation only makes it findable.

**A skipped gate says so.** `security: skipped` and `review: skipped` mean the tier or the surface turned that layer off. This matters because you cannot blame a gate that was not running, and it is the difference between a weak gate and an absent one.

**A missing field reads as unknown.** Records written before this schema simply lack `review`, `findings`, `escaped`, and `blocked`. Never read an absent field as a pass, a skip, or a failure.

## Event schema (logs/events.jsonl)

The machine trail. One JSON object per line, no wrapper array, newest last, append-only. Written by `scripts/story.mjs event`, never by hand. A crash mid-write costs one line rather than the file, and a client tails it by byte offset.

```json
{"ts":"2026-08-04T04:11:08.000Z","story":"S-088","epic":"E06","phase":"build","round":1,"status":"ok","summary":"Built the stall reason line and its derivation. One D1 drift logged.","facts":{"files":5,"tests_added":11},"decision":null,"cost":{"model":"claude-sonnet-5","tokens":214600,"tool_uses":68,"ms":2066000,"usd":1.29,"usd_basis":"estimated"}}
```

`phase` is a closed set, `pick | plan | build | checks | qa | security | pr | review | record | block`. Closed because a client renders a stage chip off these tokens and has nothing to show for one it does not know. `checks` was called `mechanical` until 2026-08-04; the word named nothing a reader could act on, so it was renamed to what the step does. Old gate records still carry the old token in `blocked.at_stage`, `story.mjs` accepts it on input and normalises on write, and readers must accept both.

`status` is `running | ok | concerns | failed | skipped | blocked`. **Two events per phase**, one as it opens with `running` and one as it closes. The open event is what lets a live view name the phase actually executing; a close-only trail would leave a stage chip reading `plan` for the whole of a forty-minute build.

`round` appears only when the phase actually retried. `summary` is one or two sentences under 25 words, the string a client shows and the console prints. `facts` is a small flat object, phase-specific, never prose, with exactly one required key across the whole schema, the `qa` close event carries `verdict`, because `scripts/cost.mjs` reads it to fill the Gate column and a key no contract mandates is a column that never fills. `decision` carries a one-line call only a human can settle, and every such entry must also reach the gate's `findings` with `outcome: decision-owed`, so a decision never exists only in prose. A close event carrying `facts.reconciled: true` was not written by the phase it names. `node scripts/story.mjs reconcile` writes it at resume to close a phase a crash abandoned, with `status: failed` and the original open event's timestamp in `facts.opened_at`. Without it the abandoned open stays the latest word on that story and a live stage chip reads as executing forever. A client should render it as interrupted rather than as a failure on the merits, and it carries no `cost` because none was ever measured. `cost` rides close events only. `usd_basis` has three honest states, `none` when the phase ran no model so zero is true, `estimated` when tokens are measured and an amount derived from `cost.rates` in profile.yaml, and `unknown` with `usd: null` when no rate matches the model. The field is named `usd` and the CSV column with it, whatever `cost.currency` says. It is a schema key, not a claim about the currency, and renaming it per project would break every client that reads the trail. The currency is stated in `docs/COST.md` and nowhere inferred from the field name. Never a confident zero standing in for a gap. `story.mjs` computes the figure, the loop never passes one in.

**PROGRESS.md and events.jsonl are not the same trail.** PROGRESS.md stays one human-readable line per story. This is the per-phase machine record. Neither replaces the other.

**Order by file position, not by parsing `ts`.** Appends happen in run order, so the file is already chronological. `logs/PROGRESS.md` in one real repo carries an in-review line stamped 09:40 for a story whose gate reads 14:51, because those lines were written from different clocks, and a reader sorting on the stamp reconstructs that run backwards. `ts` is for display and for durations, never for sequencing.

**Cost lives on the event and nowhere else.** `docs/COST.md` and `logs/cost.csv` are projections of this file written by `scripts/cost.mjs`, so they can never disagree with it, the same one-directional rule `render-docs.mjs` follows. `tokens`, `tool_uses` and `ms` are measured, returned by the harness when a subagent finishes. `usd` is derived from `cost.rates` in profile.yaml and is always labelled estimated. Both projections state `orchestration: not measured`, because every figure covers the subagents only and the loop's own spend has no counter, so the totals are a floor rather than a bill. Both are project state, an update never overwrites them.

## Tracking, local by default

docs/profile.yaml `tracking.backend` decides where work is tracked.

- **local** (default) ... ROADMAP.yaml, the story files, and the gate files are the whole system of record. Nothing leaves the repo. This is the opt-out, and it is the default.
- **jira** ... the same local files stay the source of truth, and /next mirrors epics, stories, and gate verdicts into Jira via the Atlassian MCP. The hierarchy maps directly, E01 to an Epic, S-001 to a Story, S-001-T1 to a Sub-task. The wiring is deferred, the mapping is not in question.
- **both** ... local is truth, Jira is a live mirror.

Local loses nothing. Epics, stories, acceptance, gates, decisions, and history are all on disk and greppable. Jira is a convenience layer, never a dependency.

## Tiers and presets

Two presets ship in templates/. /ideate copies one over docs/profile.yaml.

- **demo** (templates/profile.demo.yaml) ... local tracking, sketch mode, lighter gates, no adversarial pass. For training, the KaizenOS demo, and internal or small apps.
- **production** (templates/profile.production.yaml) ... full gates, adversarial and security passes, Jira optional. For shipped work.

Same pipeline either way. The tier only changes how many gates run and where work is tracked.
