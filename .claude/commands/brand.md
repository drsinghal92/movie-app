---
description: Revisit the visual brand on its own, palette, type, spacing, states, in docs/style-guide.html. Optional door, /prototype's first pass sets the brand in the normal flow.
argument-hint: [--yolo] [notes]
---

Run the Brand door of KaizenOS. This is not a pipeline step, /prototype's first pass establishes the brand and you react to it through the screens it paints. This door exists for working the brand layer in isolation, a re-brand of a product that already shipped, a token-level overhaul too large to route through screen reactions, or establishing a brand for a headless product that gets no prototype. Read docs/PROTOCOL.md "Prototype before design" for how the brand layer fits.

Args: $ARGUMENTS

1. Read docs/PRODUCT.md and docs/PRD.md. If either is missing, stop and tell the user to run /ideate first. Decide the basis: is this a KaizenRise product (check docs/PRODUCT.md, ask if unclear)?

2. Use the Agent tool with subagent_type "designer" in **brand mode**. Pass it the brief, the PRD, whether this is a KaizenRise product, the taste references from PRODUCT.md's Interview section (the `D. taste` entry) if present, and any notes in the args. If docs/style-guide.html already exists this is a revision, pass it too and say what is changing and why, so the designer edits with intent instead of starting over.
   - KaizenRise product ... Design System v4 is the source of truth, the designer confirms and renders it, near nothing to decide. Fast.
   - Non-KaizenRise product ... the designer surfaces the load-bearing brand decisions, the accent, the type pairing, light or dark default, as options with tradeoffs, and you shape them before it commits. `--yolo` picks sensible defaults and renders one pass.

3. The output is docs/style-guide.html, a self-contained page. Tell the user to open it and react, "accent is too loud", "bigger type", "warmer background". Each round, re-run the designer in brand mode to re-render in place. Stay here until the brand feels right.

4. If prototypes/ or a built UI already exist, they now render in the old paint. Say so plainly and name the doors, re-run /prototype for a fresh phase folder in the new brand, or /feedback to route the restyle into the build as stories. This door changes the paint, it does not repaint the rooms.

No code and no screens in this step, this is the paint, not the rooms.
