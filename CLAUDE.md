# movie-app

This repo runs on KaizenOS, an agentic build harness on Claude Code primitives. Read docs/STATE.md first to know where things stand.

## Pipeline

/ideate (new product) or /map (existing code) -> /prototype -> /design -> /architect -> /plan -> /next -> /standup. /prototype's first pass sets the visual brand (style-guide.html, v4 for KaizenRise or newly chosen otherwise), then renders the PRD as clickable HTML you react to, paint and screens together, before the design is fixed (/prototype is skipped for headless products, and /brand is the optional door for revisiting the brand alone). Once code exists, /feedback routes feedback back in by altitude and /revise re-opens one story, both under the drift rules. /merge lands gated PR stacks when docs/profile.yaml review.merge allows. Lost, run /help.

## Where truth lives

- docs/ ... product memory. PRODUCT, PRD (epics -> stories -> acceptance criteria), DESIGN, ARCHITECTURE, ROADMAP.yaml (the queue), gates/ (one verdict per story), DECISIONS, CONVENTIONS (+ lessons), STATE (the pointer), profile.yaml (tier, models, merge policy).
- backlog/E0N/S-NNN.md ... one self-contained story, carrying its acceptance criteria and its task breakdown (S-NNN-T1 onward, layer-tagged).
- code/ ... ALL product code, in slots (frontend/, backend/, db/). The architect picks which exist, recorded in ARCHITECTURE.md. Never write app code at the repo root.
- scripts/test.sh ... the enforced gate, runs every code/* package's tests.
- docs/PROTOCOL.md, docs/STRUCTURE.md, docs/UX-PRINCIPLES.md, and docs/BUILD-STANDARDS.md ... the contracts every agent follows (modes, confidence check, drift rules D1-D4, gate sequence, artifact schemas, and the eight code standards the builder writes against and the gates judge by).

## Rules of the loop

One story per branch (story/S-NNN-slug), one PR per story, gates before commits, agents never merge unless profile review.merge is agent-on-green. Tasks are the execution steps inside a story, they never get their own branch, PR, or gate. Status lives in ROADMAP.yaml and story frontmatter, not in chat.
