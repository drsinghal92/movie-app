#!/usr/bin/env bash
# Install the KaizenOS kit into a project. Copies the harness only, never touches product code.
# Usage: scripts/install.sh /path/to/your/app
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:?usage: install.sh <target-repo>}"
[ -d "$DEST" ] || { echo "not a directory: $DEST"; exit 1; }

mkdir -p "$DEST/.claude" "$DEST/docs/gates" "$DEST/scripts" "$DEST/templates" "$DEST/backlog" "$DEST/logs" "$DEST/code"

# Commands and agents
cp -R "$SRC/.claude/commands" "$SRC/.claude/agents" "$DEST/.claude/"

# Hooks settings, do not clobber an existing one
if [ -f "$DEST/.claude/settings.json" ]; then
  echo "note: $DEST/.claude/settings.json exists. Merge the hooks from $SRC/.claude/settings.json by hand."
else
  cp "$SRC/.claude/settings.json" "$DEST/.claude/settings.json"
fi

# Scripts and templates
cp "$SRC"/scripts/*.sh "$SRC"/scripts/*.mjs "$DEST/scripts/"
cp -R "$SRC/templates/." "$DEST/templates/"
chmod +x "$DEST"/scripts/*.sh 2>/dev/null || true

# Seed the contract and state docs, never overwrite the app's own.
# docs/IDEAS.md is deliberately absent from this list. It is product memory, so
# this repo's own parking lot must never land in someone else's project. The
# target gets an empty stub from the template below instead.
for f in PROTOCOL.md STRUCTURE.md UX-PRINCIPLES.md BUILD-STANDARDS.md TRAPS.md SUCCESSION.md profile.yaml CONVENTIONS.md STATE.md DECISIONS.md; do
  [ -f "$DEST/docs/$f" ] || cp "$SRC/docs/$f" "$DEST/docs/$f"
done
# The narrative walkthrough. Not project state, it says what KaizenOS is and is
# the same for every install, so it is refreshed rather than seeded. The render
# links it from the left rail as Learn, and only when it is present.
cp "$SRC/docs/kaizenos-journey.html" "$DEST/docs/kaizenos-journey.html"
if [ ! -f "$DEST/docs/IDEAS.md" ]; then
  sed -e "s/<Project>/$(basename "$DEST")/g" -e "s/<project>/$(basename "$DEST")/g" \
    "$SRC/templates/ideas.md" > "$DEST/docs/IDEAS.md"
fi
[ -f "$DEST/logs/PROGRESS.md" ]      || cp "$SRC/logs/PROGRESS.md" "$DEST/logs/PROGRESS.md"
# The machine trail. Empty, not stubbed with a format comment the way PROGRESS.md
# is, because a comment line is not JSON and every reader parses line by line.
# The format lives in docs/STRUCTURE.md instead.
[ -f "$DEST/logs/events.jsonl" ]     || : > "$DEST/logs/events.jsonl"
[ -f "$DEST/backlog/README.md" ]     || cp "$SRC/backlog/README.md" "$DEST/backlog/README.md"
[ -f "$DEST/docs/gates/README.md" ]  || cp "$SRC/docs/gates/README.md" "$DEST/docs/gates/README.md"

# CI workflow, independent re-verification on every PR and push to main
mkdir -p "$DEST/.github/workflows"
[ -f "$DEST/.github/workflows/ci.yml" ] || cp "$SRC/templates/github-workflow-ci.yml" "$DEST/.github/workflows/ci.yml"

# Slim CLAUDE.md so a fresh session in the app repo knows the system on arrival
if [ ! -f "$DEST/CLAUDE.md" ]; then
  APP_NAME="$(basename "$DEST")"
  cat > "$DEST/CLAUDE.md" <<EOF
# ${APP_NAME}

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
EOF
  echo "wrote $DEST/CLAUDE.md"
fi

echo "KaizenOS installed into $DEST"

# Closing hint depends on whether product code already exists
if [ -n "$(ls -A "$DEST/code" 2>/dev/null)" ] || [ -f "$DEST/package.json" ] || [ -d "$DEST/src" ]; then
  echo "Next: open $DEST in Claude Code, restart the session so it sees the commands, then run /map (existing code detected)"
else
  echo "Next: open $DEST in Claude Code, restart the session so it sees the commands, then run /ideate (blank slate)"
fi
