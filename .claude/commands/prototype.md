---
description: Render the PRD as clickable HTML you can walk and react to, before the design is fixed. First pass sets the brand, then you react to paint and screens together.
argument-hint: [--yolo] [vN] [notes]
---

Run the Prototype step of KaizenOS. It exists so you can think in visuals at the altitude where changing your mind is free, before /design commits and long before any code exists. The first pass also decides the brand, so paint and screens land in one session and you react to them together. Read docs/PROTOCOL.md "Prototype before design" for the contract.

Args: $ARGUMENTS

1. Read docs/PRD.md and docs/PRODUCT.md. If either is missing, stop and tell the user to run /ideate first. Decide the phase folder: default `prototypes/v1`, or the `vN` named in the args, or the next unused vN if the user asks for a new phase.

2. **The brand pass, first run only.** If docs/style-guide.html does not exist, the brand is decided now, before any screen is drawn. Use the Agent tool with subagent_type "designer" in **brand mode**. Pass it the brief, the PRD, whether this is a KaizenRise product (check docs/PRODUCT.md, ask if unclear), and the taste references from PRODUCT.md's Interview section (the `D. taste` entry), they are the strongest signal of what the founder wants to see.
   - KaizenRise product ... Design System v4 is the source of truth, the designer confirms and renders it, near nothing to decide. Fast.
   - Non-KaizenRise product (the common training case) ... there is no system yet, so this is a real choice. In guided mode the designer surfaces the load-bearing brand decisions, the accent, the type pairing, light or dark default, as options with tradeoffs anchored on the taste references, and you shape them before it commits. `--yolo` picks sensible defaults and renders one pass.

   The output is docs/style-guide.html. Do not run a separate reaction loop on it, the founder reacts to the brand through the screens it paints, that is the point of merging the passes. If style-guide.html already exists, skip this step and use it as-is, `/brand` is the door for revisiting the brand on its own.

3. Use the Agent tool with subagent_type "designer" in **prototype mode**. Pass it docs/PRD.md, docs/PRODUCT.md (both for the non-goals and hard constraints that bound what may be drawn, and for whether this is a KaizenRise product), docs/style-guide.html, the target phase folder, and any notes in the args. It renders clickable, brand-styled HTML screens into that folder, no logic, no code. It never writes docs/DESIGN.md or code/ in this mode.

4. If the designer reports the PRD has no meaningful UI to prototype (a CLI, a library, a headless service), relay that plainly and stop. The step is skipped, say so, do not invent screens. If the brand pass already ran, style-guide.html stays, a headless product can still have a brand for its docs and site.

5. When it returns, relay its non-goal reconciliation first if anything crossed one, before the user is asked to react. A PRD story that implies something PRODUCT.md forbids is a contradiction between two contracts, so it goes back to the founder as a call, not to the designer as a drawing problem. Then tell the user to open `prototypes/vN/index.html` and walk the flow. This is the reaction loop, and it is the whole point. React in chat, "the rail is too wide", "move this above the fold", "this state is missing". Route each reaction to the right layer, a token-level note ("accent too loud", "warmer background") re-runs the designer in brand mode to edit style-guide.html in place, a screen-level note re-runs prototype mode against the same folder, and a re-render after a brand edit picks the new paint up. Stay here until the screens feel right.

6. When the user is happy, offer to distill the reactions into docs/DESIGN.md, which is the hand-off to /design. Do not do it unasked. The prototype is committed as the phase's vision record either way, it is never imported into code/.

`--yolo` renders one pass without the guided reaction loop, for when the user just wants to see something fast. No code in this step.
