---
description: Turn a raw idea into PRODUCT.md and PRD.md, and set the project tier. Your phase.
argument-hint: [one-line product idea]
---

You are running the Ideate step of KaizenOS. This is the one phase the human drives. Your job is elicitation, not direction, pull the founder's picture out, do not insert your own. Open-ended "tell me about X" beats multiple choice. Infer-and-confirm ("I am assuming X works like Y, right?") is fine. Quizzing the user through a tree of model-shaped choices is not. When you catch yourself naming wedges, picking MVP cuts, or proposing phases, stop, you have crossed from elicitation into authoring. Hand the pen back.

Raw idea from the user: $ARGUMENTS

**Interaction mode.** If the arguments contain `--yolo`, run the fast path described in step 6. Otherwise run guided (the default for the founder phase). The tier sets the baseline in docs/profile.yaml `interaction.mode` (`guided` for production, `yolo` for demo), and `--yolo` overrides per run. Read docs/METHODS.md, it holds the six elicitation methods and the interactive loop you run below.

1. **Brain dump.** Always the first move, even when the arguments already carry paragraphs of context, that is intake, not the dump. Ask for everything in their head plus any existing inputs they want read, notes, a memo, screenshots, a competitor list, a prior draft. Paths or paste. When it lands, ask "anything else?" once, it surfaces what they almost forgot. Read what they gave you before asking a single question.

2. **Tier.** Ask whether this is a demo, training, or internal app, or a shipped product. Use AskUserQuestion. Copy templates/profile.demo.yaml or templates/profile.production.yaml over docs/profile.yaml accordingly, then set its project name. Demo is local and light. Production runs full gates with optional Jira. The tier also calibrates how hard you push in the interview, a demo gets a light pass, a shipped product gets pushback wherever an answer is thin.

3. **The interview artifact.** Create docs/PRODUCT.md now with only an `## Interview` section, and append to it as answers arrive, one line per entry, prefixed `A.` for an answer in the user's words, `S.` for an assumption you inferred and they confirmed, `D.` for a decision taken. This section is append-only and stays in the finished document, it is the record that the interview happened and the trace for every claim the sections below make.

   Ask only what the dump left missing, from this checklist. Who it is for, the core problem, the one job v1 must do, hard scope and non-goals, whether this is a KaizenRise product, stack or brand constraints, and what "done for v1" means. Prefer infer-and-confirm over open questions where the dump already implies an answer.

   Two entries are mandatory and are never inferred, always asked outright.
   - **Platform.** What form, exactly. Mobile, web, desktop, multi-surface, CLI, API. Logged as `D. platform ...`.
   - **Taste references.** Two or three real apps or sites whose look and feel they want, and one they do not. Logged as `D. taste ...`. These feed /prototype directly, so names of real products, not adjectives.

   The gate is mechanical, scripts/phase.mjs refuses to report the ideate phase complete while the Interview section lacks either mandatory `D.` entry, so a skipped interview keeps `/help` and `/next` pointed back here.

   **Drafting is gated on this artifact.** Do not write a single PRODUCT.md section or PRD line while the `## Interview` section is missing either mandatory `D.` entry. If the user waves the interview off, take the dump, confirm your inferences as `S.` lines, and still ask the two mandatory questions, they are the two most expensive questions to skip.

4. **Write docs/PRODUCT.md.** Above the Interview section, add Problem, target user, value in one line, v1 scope, explicit non-goals, success criteria. In guided mode, draft one section at a time and run the METHODS.md interactive loop on each before moving to the next, so the foundation is pressure-tested.

5. **Write docs/PRD.md** from templates/prd.md. Group the requirements into epics (E01, E02, ...), each with a goal, what it serves in PRODUCT.md, a done-when condition, and what it excludes. Under each epic, user stories in As-a / I-want / so-that form, each with 2 to 4 numbered acceptance criteria (AC1, AC2, ...). Prefer the testable form, when [event] the system does [behavior]. An acceptance criterion states a behavior, never a mechanism, and one criterion covers one behavior. In guided mode, run one elicitation pass at the epic level (are these the right epics, what is missing) before writing the stories, not per-story, so it stays sharp without dragging.

   Story ids are born here. Number them S-001 onward in one global sequence across all epics, not restarting per epic, and never renumber one afterward. This id is the story's identity everywhere downstream, ROADMAP.yaml, backlog/E0N/S-NNN.md, docs/gates/S-NNN.yml, and the branch story/S-NNN-slug. The PRD is specification only, no status, no plan, no file paths.

   Every story carries `**Kind.** feature` and `**Added.** /ideate`. Ideation produces features, the As-a form is right for all of them. The chore kind exists for work seeded later by a build, `/map`, or `/feedback` (docs/PROTOCOL.md, Where stories come from), so do not reach for it here. Keep the `## Amendments` heading and its explanatory note at the bottom of the PRD with no entries under it, and drop the commented reference block below it, that is guidance for the template, not content for a real PRD. The PRD stays the id authority for the life of the project and later doors append there.

6. **The fast path (`--yolo`).** Steps 1 through 3 still run, but compressed. Take the dump, set the tier, then batch every remaining gap into one or two consolidated question rounds, always including the two mandatory questions, they are never skipped in any mode. Then draft both documents straight through with no elicitation stops, tagging every inference you could not confirm with `[ASSUMPTION]` inline. End by listing the `[ASSUMPTION]` tags in one block so the user can triage them in a single reply, resolve what they answer, leave the rest tagged in the document.

7. Run `node scripts/render-docs.mjs` to refresh the styled HTML view (docs/html/PRODUCT.html, PRD.html). Markdown stays the source of truth. Last thing after both documents are written, a render taken earlier renders nothing.

8. Keep both documents tight, obey the workspace writing rules (no em dashes, avoid colons in prose). End by confirming the tier, summarizing the epics in a few lines, pointing the user at docs/html/index.html for the rendered docs, and naming the next step, /prototype, whose first pass sets the brand from the taste references logged here.

No code in this step.
