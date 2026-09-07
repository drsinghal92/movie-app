---
description: Break the PRD into an epic-structured queue (docs/ROADMAP.yaml) and self-contained story files.
---

Run the Plan step of KaizenOS.

1. Read docs/PRODUCT.md, docs/PRD.md, docs/DESIGN.md, docs/ARCHITECTURE.md. If PRD or ARCHITECTURE is missing, stop and point to the earlier step. Follow the schemas in docs/STRUCTURE.md.

2. Take the stories straight from the PRD, they already carry their ids (S-001 onward) and their acceptance criteria. Do not mint new ids and do not renumber. Check each one is a thin vertical slice, one demoable outcome carrying UI, logic, and data together, small enough to review in a few minutes. A PRD story too big to ship in one slice splits into two stories, and the split gets written back into docs/PRD.md so the spec and the queue never diverge, the new half taking the highest story id in the PRD plus one, carrying its kind and `**Added.**` marker naming `/plan` and the story it split from, plus an entry in the PRD's `## Amendments` section. That write-back is the only way `/plan` may add a story. Order by dependency within and across epics.

3. Write docs/ROADMAP.yaml using the ROADMAP schema in docs/STRUCTURE.md. Epics, each with `stories:` (id, title, depends_on, autonomy, status todo, gate null, pr null). Two levels, no deeper. Tasks do not go in ROADMAP, they live in the story file, and a third level carrying its own `status:` would corrupt phase detection in scripts/phase.mjs. Tag any story needing a live provider, a real payment, or a production migration as autonomy: supervised.

4. For each story, write backlog/E0N/S-NNN.md from templates/story.md (grouped in the epic's folder). Fill the frontmatter, copying `kind` straight from the PRD story block and never deciding it here, the Story line (a technical outcome line instead of the As-a form when the kind is chore), the numbered Acceptance criteria copied from the PRD as checkboxes, Out of scope, Origin (the PRD `**Added.**` marker verbatim), Context (PRD epic and story id, DESIGN, ARCHITECTURE), and a Test plan. Leave Tasks, Notes, and Open questions for the loop, the planner writes the task breakdown at build time.

5. Run `node scripts/render-docs.mjs` to refresh the styled HTML view (docs/html/) and the board. Last thing in this step, after ROADMAP.yaml and every story file are written, for the same reason next.md step 12 puts it last, a render taken before the state is written renders the previous run. This is the first render that has a board to draw.

6. Show the epic and story list with counts and the dependency order, and point the user at docs/html/index.html for the rendered board. Note that /next starts the build and the backlog is ready to arm overnight.

No code in this step.
