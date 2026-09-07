---
description: Onboard KaizenOS onto an existing codebase (brownfield). Reads the code, infers the docs, seeds a backlog. The sibling of /ideate.
argument-hint: [what you want to work on: features, bugs, refactors]
---

Run the Map step of KaizenOS, the brownfield entry. Use this when the app already exists. Do not invent, read the code and document what is really there.

1. Tier. Ask demo or production with AskUserQuestion, copy the matching preset over docs/profile.yaml, set the project name.

2. Map. Use the Agent tool with subagent_type "mapper". It reads the codebase and writes, inferred from the code:
   - docs/PRODUCT.md, what the app does and who for.
   - docs/ARCHITECTURE.md, the stack, structure, and data model as built, load-bearing pieces flagged.
   - docs/CONVENTIONS.md, the house style read from the code so the builder matches it.
   - docs/PRD.md, existing features catalogued as epics, plus one epic for the work you want.
   It also detects the test command and wires scripts/test.sh to it.

3. Seed the backlog. From the mapper's findings and the user's goal ($ARGUMENTS), write the work into docs/PRD.md first, then docs/ROADMAP.yaml, then backlog/E0N/S-NNN.md story files, covering the visible work, missing or failing tests, security gaps, clear bugs, risky TODOs, refactors, and the requested features. Every seeded story gets a PRD entry, no exceptions, because the PRD is the id authority and a story with no PRD entry has no specification (docs/PROTOCOL.md, Where stories come from). Mark each one `**Kind.** feature` or `**Kind.** chore` and `**Added.** /map`. Deflakes, convergence refactors, and hardening passes are chores, state their technical outcome rather than inventing a user for them. Number the stories S-001 onward in one global sequence, group them under epics, and give each one numbered acceptance criteria stating the observable behavior that closes it, not the mechanism. Leave the Tasks section empty, the planner writes the execution breakdown at build time. Tag risky migrations or live-provider work as supervised.

4. Render. After the docs, ROADMAP.yaml and every story file are written, run `node scripts/render-docs.mjs` to refresh the styled HTML view (docs/html/) and the board. Markdown and the yaml stay the source of truth. A render taken before the backlog is seeded renders no board.

5. Confirm. Show the inferred product summary, the stack, the health read, and the seeded backlog, and point the user at docs/html/index.html for the rendered docs and the board. Nothing in their code was changed.

Then /next runs the same loop, respecting the existing conventions. The drift rules keep it from rearchitecting the app without asking.

No code changes in this step. Read and document only.
