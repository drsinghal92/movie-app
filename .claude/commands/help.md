---
description: Lost? Show what KaizenOS is, where you are right now, and the one command to run next. /help <command> explains a single command in plain language.
argument-hint: [command]
---

Orient a possibly non-technical user. They may have forgotten which command comes next, or what /next, /feedback, or /revise even do. Be plain, warm, and short. Follow the brand writing rules: no em dashes, avoid colons in the prose you show, no AI openers, no filler.

Args: $ARGUMENTS

## If an argument is given (a command name, with or without the leading slash)

Explain just that one command, in four short lines, for someone who is not a developer:
- What it does, in one plain sentence.
- When you reach for it.
- What it produces (the file or the outcome).
- The one command before it and the one after it, so they can place it.

Read `.claude/commands/<name>.md` for the accurate description, and `docs/pipeline.json` to find its neighbours. If the name is not a real command, say so and show the full map instead (fall through to the no-argument path).

## If no argument is given

Do two things, in this order. You are here first, the map second, because a confused user wants direction before a menu.

1. GATHER, quietly, no narration. Run `node scripts/phase.mjs --json`, this is the authoritative "where am I", the same detector `/next` dispatches on, so the signpost and the action never disagree. It returns the current phase, the next command, and whether that step is guided or autonomous. Then read `docs/pipeline.json` (the doors, the steps in order, the feedback commands) so the map is never stale. The artifact checks below are the fallback if the script is unavailable:
   - `docs/PRODUCT.md`, `docs/PRD.md` ... ideation done
   - `docs/style-guide.html` ... brand set (in /prototype's first pass, or /brand)
   - `prototypes/` ... prototype exists (skip if the folder is absent)
   - `docs/DESIGN.md` ... design done
   - `docs/ARCHITECTURE.md` ... architecture done
   - `docs/ROADMAP.yaml` ... planned
   - `docs/gates/*.yml` ... building has started
   - Read `docs/STATE.md` if it exists, it holds the resumable pointer and is the most reliable "where am I."
   Also run `gh pr list --state open` if a remote exists, open PRs waiting on the user matter for the next action.

2. SHOW, in three small blocks:

   **What this is.** One line. KaizenOS runs the build, you run the ideas.

   **You are here.** Name the phase they are in from the artifacts and STATE.md, then the single most useful next command with a half-line on why. If no PRODUCT.md exists yet, point at the two front doors instead, /ideate for a new idea, /map for an existing codebase. If PRs are waiting, that is likely the next action.

   **The commands.** Render the pipeline from pipeline.json as a short grouped list, command then a plain half-line, in this grouping:
   - Start ... the doors (/ideate, /map)
   - Build it ... the ordered steps (/prototype, /design, /architect, /plan, /next, /standup), each one plain-language. Note the see-it-first steps run before code, prototype's first pass sets the paint and renders the screens you react to, design commits the decisions. /next is the loop that writes the code and never merges
   - Change your mind ... the feedback commands (/feedback to route notes back in, /revise to reopen one shipped story), and /merge and /pr-review if the profile uses them
   - After you merge a PR yourself ... /land, which writes the state back. The default profile has no agent doing that, so without it a shipped story keeps reading in-review
   - When a session is done ... /handoff, which ends this one cleanly and leaves docs/HANDOFF.md for the next
   - /help <command> for any one of these in detail

Keep the whole thing under about 20 lines. End with the one next command on its own line so it is impossible to miss. Do not dump file contents, do not explain the internals, this is a signpost, not a manual.
