---
description: Produce docs/ARCHITECTURE.md (stack, data model, system design, conventions) via the architect agent.
argument-hint: [optional stack or constraint hints]
---

Run the Architecture step of KaizenOS.

1. Read docs/PRODUCT.md, docs/PRD.md, and docs/DESIGN.md if present. If PRODUCT or PRD is missing, stop and point to the earlier step.

2. Use the Agent tool with subagent_type "architect". Pass the docs and any constraints: $ARGUMENTS

3. The architect must state the exact test command scripts/test.sh should run, and record the load-bearing choices in docs/DECISIONS.md. After it returns, if a scaffold and its package.json test script now exist, confirm scripts/test.sh picks them up.

4. Run `node scripts/render-docs.mjs` to refresh the styled HTML view (docs/html/ARCHITECTURE.html, DECISIONS.html). Markdown stays the source of truth.

5. Show the stack choice and the top three architectural decisions. Point the user at docs/html/index.html for the rendered docs. Note the next step is /plan.

No feature code in this step. Project scaffold only if the architect needs it to lock the stack.
