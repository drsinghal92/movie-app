#!/usr/bin/env bash
# Stop hook. Safety net for overnight runs. If we are on a story or epic branch with
# uncommitted work, wip-commit it so nothing is lost. Stays quiet on main.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 0

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"

case "$branch" in
  story/*|epic/*)
    if ! git diff --quiet || ! git diff --cached --quiet; then
      # Autosave everything except OS junk. This repo ignores .DS_Store, but
      # the hook ships into installed kits whose .gitignore may not, and an
      # unattended autosave is exactly where it would get committed unseen.
      git add -A -- ':(exclude).DS_Store' ':(exclude)**/.DS_Store'
      git commit -m "wip: autosave on ${branch}" >/dev/null 2>&1 || true
      mkdir -p logs
      echo "- $(date '+%Y-%m-%d %H:%M') wip autosave on ${branch}" >> logs/PROGRESS.md
    fi
    ;;
  *)
    : # on main or elsewhere, do nothing
    ;;
esac
exit 0
