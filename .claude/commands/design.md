---
description: Produce docs/DESIGN.md (UI/UX, screens, flows, states) via the designer agent.
argument-hint: [optional design constraints]
---

Run the Design step of KaizenOS.

**Interaction mode.** If the arguments contain `--yolo`, fire the designer once and commit the result, today's one-shot behavior. Otherwise run guided (the default for the founder phase): surface the load-bearing design decisions and let the user react before the design is committed. The tier sets the baseline in docs/profile.yaml `interaction.mode`, and `--yolo` overrides per run. Read docs/METHODS.md for the six elicitation methods and the loop.

1. Read docs/PRODUCT.md and docs/PRD.md. If either is missing, stop and tell the user to run /ideate first. If prototypes/ exists, read the latest phase folder, it holds the screens the founder already walked and reacted to, and DESIGN.md should harden those reactions rather than start fresh. If no prototype exists, suggest /prototype first for a UI product, it is cheaper to react to HTML than to a written design, then proceed if the user declines.

2. In guided mode, before writing the full design, have the designer propose the directions and the two or three load-bearing decisions (layout density, navigation model, and the screens that carry the product) as short options with tradeoffs. Surface them, run the METHODS.md interactive loop so the user shapes the direction, and only then commit. In yolo mode, skip straight to step 3.

3. Use the Agent tool with subagent_type "designer" in design mode. Pass it the product brief, the PRD, docs/style-guide.html (the brand set in /prototype's first pass, which design consumes and never overwrites), the latest prototypes/ folder if one exists, whether this is a KaizenRise product (check docs/PRODUCT.md, ask if unclear), the product type, application or website, so motion scales correctly (apps get micro-interactions only, websites get the richer motion vocabulary), the direction agreed in step 2 if guided, and any constraints given here: $ARGUMENTS

4. When the agent returns, run `node scripts/render-docs.mjs` to refresh the styled HTML view of the docs (docs/html/). Markdown stays the source of truth, this is the readable render for the human.

5. Show a five-line summary, the screen list, the key flows, and the component count. Point the user at docs/style-guide.html for the brand (set in /prototype's first pass) and docs/html/DESIGN.html for the rendered design doc. Note the next step is /architect.

No code in this step.
