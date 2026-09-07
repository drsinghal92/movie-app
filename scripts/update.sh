#!/usr/bin/env bash
# Update an existing KaizenOS install in a project. Refreshes the harness only, never touches product state.
# Usage: scripts/update.sh /path/to/your/app
#
# What gets overwritten (harness, safe to replace):
#   .claude/commands/  .claude/agents/  scripts/*.sh|*.mjs  templates/
#   docs/PROTOCOL.md  docs/STRUCTURE.md  docs/UX-PRINCIPLES.md  docs/BUILD-STANDARDS.md
#                  (contracts, not project state)
#   docs/TRAPS.md  docs/SUCCESSION.md  (contracts too. TRAPS is harness mechanics, so a
#                  product's own lessons belong in docs/CONVENTIONS.md, which is never touched)
#   docs/kaizenos-journey.html  (the walkthrough, about KaizenOS and not the project)
# What is never touched (project state):
#   code/  backlog/  logs/  docs/gates/  CLAUDE.md
#   docs/COST.md  (derived per repo from that repo's own events, a refresh would
#                  wipe its spend history)
#   docs/STATE.md  docs/profile.yaml  docs/DECISIONS.md  docs/CONVENTIONS.md
#   docs/HANDOFF.md  (what the last /handoff left the next session, replaced per handoff)
#   .kaizenos-notices  (ledger of one-time migration notices already shown, so a
#                       notice whose evidence is immutable still prints once)
#   docs/IDEAS.md  (this repo's own parking lot never lands in another project)
# What needs a manual merge if it drifted:
#   .claude/settings.json  .github/workflows/ci.yml
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:?usage: update.sh <target-repo>}"
[ -d "$DEST" ] || { echo "not a directory: $DEST"; exit 1; }
[ -d "$DEST/.claude/commands" ] || { echo "no KaizenOS install found in $DEST (run install.sh first)"; exit 1; }

# Ask for a clean tree so the update lands as a reviewable diff
if git -C "$DEST" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if [ -n "$(git -C "$DEST" status --porcelain)" ]; then
    echo "warning: $DEST has uncommitted changes. Commit first so the update is a clean diff."
    read -r -p "Continue anyway? [y/N] " ans
    [ "${ans:-}" = "y" ] || exit 1
  fi
fi

# Harness: overwrite. check.sh is the file most likely to have been tuned in
# place, since it is the hook an operator feels, so name the overwrite instead
# of clobbering silently. A difference means either the kit moved ahead or the
# local copy was tuned, this cannot tell which.
if [ -f "$DEST/scripts/check.sh" ] && ! diff -q "$SRC/scripts/check.sh" "$DEST/scripts/check.sh" >/dev/null 2>&1; then
  echo "note: scripts/check.sh differs from the kit and will be overwritten. If you tuned it locally, review the diff after the update and upstream the improvement."
fi

# EVERY "did this install already have X" probe belongs above the copies below.
# Once scripts/ and the contract docs are overwritten, DEST carries the kit's own
# answer to every question, so a guard placed after them reads what this script
# just wrote and tells you nothing about the install. Both guards here were
# written below the copies first and both were dead on arrival, one always
# silent and one always firing.
#
# blocked.at_stage gained `pr` and `record`. A client that switches on the old
# six needs telling once, so probe the story.mjs that is still on disk.
grep -q "'review', 'pr', 'record'" "$DEST/scripts/story.mjs" 2>/dev/null || stages_extended=1
# Two contracts start shipping. Both land in docs/, which is committed, so the
# diff arrives without being asked for. Probed here because the copy loop below
# is what creates them, and a guard written under it reads what this script just
# wrote.
[ -f "$DEST/docs/TRAPS.md" ] || traps_new=1
[ -f "$DEST/docs/SUCCESSION.md" ] || succession_new=1
# One-time notices need a ledger, not a probe.
#
# Some notices announce a migration whose evidence is IMMUTABLE. The mechanical
# to checks rename is the case: any install that ever blocked at that stage has
# a gate record saying so, and gate records are history this script's own rules
# forbid rewriting. So "does the old token appear" is true forever and a guard
# built on it can never turn off, which is the same always-firing notice one
# round earlier, moved rather than fixed.
#
# The ledger is project state, one token per line, never overwritten by an
# update. A notice fires when its evidence is present AND its token is not yet
# recorded, and records itself after printing.
NOTICES="$DEST/.kaizenos-notices"
seen_notice() { [ -f "$NOTICES" ] && grep -qxF "$1" "$NOTICES"; }
# `|| true` because this script runs under `set -e` and the append is the last
# command in each notice's if-body. An unwritable ledger would otherwise abort
# the whole update AFTER every file had already been copied, turning a cosmetic
# failure into a run that looks half-applied and never prints its closing line.
# Failing to record a notice costs one repeat, which is the thing the ledger was
# already willing to risk.
mark_notice() {
  # Announce the ledger the first time it appears. Without this it shows up as
  # an unexplained untracked dotfile immediately after a script that opened by
  # asking for a clean tree, and nothing anywhere says what it is. It is project
  # state and belongs in the repo, like docs/STATE.md, so a fresh clone does not
  # replay every migration notice.
  if [ ! -f "$NOTICES" ]; then
    ledger_new=1
  fi
  printf '%s\n' "$1" >> "$NOTICES" 2>/dev/null || true
}

# The mechanical -> checks rename. Evidence is PROJECT STATE only, never the
# contract docs, because STRUCTURE.md and PROTOCOL.md both document the old
# token on purpose and are themselves overwritten here.
if grep -rq 'mechanical' "$DEST/docs/gates" "$DEST/backlog" 2>/dev/null && ! seen_notice 'rename-mechanical-to-checks'; then
  mechanical_present=1
fi
# render-docs.mjs now reaps. Any docs/html/*.html with no matching docs/*.md is
# deleted on the next render, and docs/html/ is committed project state, so this
# update hands over a script that will delete a tracked file. Say so before it
# happens rather than leaving it to be discovered in a git status. Ledgered, so
# the orphan scan only runs while the notice is still owed. Probed here because
# docs/ is project state the copies below never touch, but the file's rule is
# that every probe lives above them.
seen_notice 'render-docs-derives-and-reaps' || render_docs_changed=1
# The walkthrough starts shipping. It lands in docs/, which is committed, so an
# 88KB file arrives in the diff without being asked for. Probed above the copies
# because the copy below is what creates it.
[ -f "$DEST/docs/kaizenos-journey.html" ] || journey_new=1
# The renderer now also renders the queue, so an install with a roadmap gains a
# page per story and per epic in a committed directory. Probed above the copies
# for the same reason, and only where there is a queue to render.
if [ -f "$DEST/docs/ROADMAP.yaml" ] && ! seen_notice 'board-renders-static'; then
  board_render_new=1
  board_story_count="$(grep -c '^ *- id: S-' "$DEST/docs/ROADMAP.yaml" 2>/dev/null || echo 0)"
fi
# Every rendered document gains its own contents rail and a repaired heading
# scale, so the next render rewrites every file in docs/html/, which is
# committed. Same reason as the two notices above, the diff arrives without
# being asked for. Ledgered, and only where there is a render to change.
if [ -d "$DEST/docs/html" ] && ! seen_notice 'docs-carry-contents'; then
  docs_structured=1
fi
# Reconcile-after-merge gains a door the human merge path can use. Ledgered
# rather than probed for the drift itself, because deciding whether a story
# actually merged needs gh and a network, and an update must not depend on
# either. Fires for any install with a queue, since every such project merges,
# and the point is to say the command exists before it is needed.
if [ -f "$DEST/docs/ROADMAP.yaml" ] && ! seen_notice 'reconcile-has-a-human-door'; then
  land_new=1
  land_in_review="$(grep -c '^ *status: in-review' "$DEST/docs/ROADMAP.yaml" 2>/dev/null || echo 0)"
fi
# The index stops being a folder listing and becomes the project's front door,
# which means it reads docs/PRODUCT.md and docs/STATE.md for the first time.
# Same reason as above, the next render rewrites committed state.
if [ -d "$DEST/docs/html" ] && ! seen_notice 'index-is-the-front-door'; then
  front_door_new=1
fi
if [ "${render_docs_changed:-0}" = "1" ] && [ -d "$DEST/docs/html" ]; then
  doc_orphans=""
  for h in "$DEST"/docs/html/*.html; do
    [ -e "$h" ] || break
    base="$(basename "$h" .html)"
    case "$base" in
      # index.html belongs to every run. STATE is the renderer's DENY set,
      # restated because this script cannot import it. An install that rendered
      # it under an older list has a page the new renderer drops even though the
      # markdown is still there, which a "does the .md exist" check would miss.
      index|STATE) [ "$base" = "index" ] || doc_orphans="$doc_orphans $base.html"; continue ;;
    esac
    [ -f "$DEST/docs/$base.md" ] || doc_orphans="$doc_orphans $base.html"
  done
fi
rm -rf "$DEST/.claude/commands" "$DEST/.claude/agents"
cp -R "$SRC/.claude/commands" "$SRC/.claude/agents" "$DEST/.claude/"
cp "$SRC"/scripts/*.sh "$SRC"/scripts/*.mjs "$DEST/scripts/"
cp -R "$SRC/templates/." "$DEST/templates/"
chmod +x "$DEST"/scripts/*.sh 2>/dev/null || true

# Retired harness files. cp only adds, so a renamed script would linger and the
# loop could call the stale copy. Remove them explicitly.
for stale in "scripts/task.mjs"; do
  [ -f "$DEST/$stale" ] && rm -f "$DEST/$stale" && echo "retired $stale (now scripts/story.mjs)"
done

# Contracts: overwrite (project state docs are never listed here)
[ -f "$DEST/docs/UX-PRINCIPLES.md" ] || ux_principles_new=1
[ -f "$DEST/docs/BUILD-STANDARDS.md" ] || build_standards_new=1
# kaizenos-journey.html joins the contracts here rather than the seeded docs,
# for the same reason they are here. It is about KaizenOS and not about the
# project, so every install should carry the current one.
for f in PROTOCOL.md STRUCTURE.md UX-PRINCIPLES.md BUILD-STANDARDS.md TRAPS.md SUCCESSION.md kaizenos-journey.html; do
  cp "$SRC/docs/$f" "$DEST/docs/$f"
done

# Hand-merge zone: report drift, do not clobber
for pair in ".claude/settings.json" ".github/workflows/ci.yml:templates/github-workflow-ci.yml"; do
  dest_rel="${pair%%:*}"; src_rel="${pair#*:}"; [ "$src_rel" = "$pair" ] && src_rel="$dest_rel"
  if [ -f "$DEST/$dest_rel" ]; then
    if ! diff -q "$SRC/$src_rel" "$DEST/$dest_rel" >/dev/null 2>&1; then
      echo "note: $dest_rel differs from the latest kit. Merge by hand from $SRC/$src_rel"
    fi
  else
    mkdir -p "$DEST/$(dirname "$dest_rel")"
    cp "$SRC/$src_rel" "$DEST/$dest_rel"
  fi
done

echo "KaizenOS updated in $DEST"
if git -C "$DEST" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Changed files:"
  git -C "$DEST" status --porcelain | sed 's/^/  /'
  echo "Review with: git -C $DEST diff"
fi
if ls "$DEST"/backlog/*/T-*.md >/dev/null 2>&1; then
  echo
  echo "migration: this install still has T-NNN backlog files. The harness now uses"
  echo "  S-NNN for stories (backlog/E0N/S-NNN.md, docs/gates/S-NNN.yml, branch story/S-NNN-slug)"
  echo "  with tasks as the layer-tagged breakdown inside each story file."
  echo "  Existing T-NNN work still resolves, the scripts do not validate the id shape."
  echo "  Rename when convenient, or let the next stories start at S-NNN."
fi
# Story origin migration. The PRD is now the id authority and every story that
# exists anywhere has a PRD entry (docs/PROTOCOL.md, Where stories come from).
# Installs that predate this were free to seed backlog stories the PRD never
# learned about, so report the gap and let the project close it. Never edit the
# project's PRD or backlog here, both are project state.
if [ -f "$DEST/docs/PRD.md" ] && ls "$DEST"/backlog/*/S-*.md >/dev/null 2>&1; then
  orphans=""
  for f in "$DEST"/backlog/*/S-*.md; do
    sid="$(basename "$f" .md)"
    # Any heading level, an older PRD may not use #### for story blocks.
    grep -qE "^#{2,6} +$sid\b" "$DEST/docs/PRD.md" || orphans="$orphans $sid"
  done
  if [ -n "$orphans" ]; then
    echo
    echo "migration: these backlog stories have no entry in docs/PRD.md"
    echo " $orphans"
    echo "  The PRD is now the id authority. Every story carries a PRD block with its"
    echo "  kind (feature or chore), an **Added.** marker naming the door it came from,"
    echo "  and an entry in the PRD's ## Amendments section saying why it exists."
    echo "  Read docs/PROTOCOL.md, Where stories come from, for the full rule."
    echo
    echo "  To close this, backfill one PRD block per story above. Reconstruct each"
    echo "  **Added.** marker from docs/DECISIONS.md and the story's own Notes rather"
    echo "  than inventing one. Work with no user (a convergence refactor, a deflake,"
    echo "  a hardening pass) is kind chore, state its technical outcome instead of"
    echo "  dressing it in an As-a line. Do not renumber anything, do not touch shipped"
    echo "  stories' ids, gate files, or PR history. Backfill adds PRD blocks only."
    echo
    echo "  Until then, shipped stories and everything already gated are unaffected,"
    echo "  the loop keeps running, and this notice is a report, not a failure. But an"
    echo "  unbuilt story above will not pass the checks gate when /next picks it"
    echo "  up, scripts/gate.mjs hard-fails a story with no PRD entry. Backfill the"
    echo "  ones you still intend to build before the next run, or cancel them."
  fi
  if ! grep -qE '^## Amendments' "$DEST/docs/PRD.md"; then
    echo
    echo "migration: docs/PRD.md has no ## Amendments section. Add one at the bottom."
    echo "  Every story added or cancelled after the PRD was first written gets a dated"
    echo "  entry there carrying why the spec changed. See templates/prd.md for the shape."
  fi
fi
# Failure-evidence migration. Gate records grew review, findings, escaped, and
# blocked, and blocking now goes through story.mjs so a stop leaves a record.
# Existing gate files and story files are project state and are never rewritten.
if [ -d "$DEST/docs/gates" ] && ls "$DEST"/docs/gates/S-*.yml >/dev/null 2>&1; then
  if ! grep -lq '^findings:' "$DEST"/docs/gates/S-*.yml 2>/dev/null; then
    echo
    echo "migration: this install's gate records predate the evidence fields."
    echo "  New gates carry review, findings, escaped, and blocked (docs/PROTOCOL.md,"
    echo "  What a failure leaves behind). Old records simply lack them, and a missing"
    echo "  field reads as unknown, never as a pass or a skip. Nothing is rewritten."
    echo "  Blocking now runs through scripts/story.mjs block, which writes the gate"
    echo "  record, the reason, and the STATE pointer together, so a blocked story"
    echo "  stops being the one story with no record of why it stopped."
  fi
fi
if [ -f "$DEST/docs/STATE.md" ] && ! grep -q '^- blocked:' "$DEST/docs/STATE.md"; then
  echo
  echo "note: docs/STATE.md has no '- blocked:' line. story.mjs appends it the first"
  echo "  time a story blocks, so nothing needs doing. STATE.md is project state and"
  echo "  this update does not touch it."
fi
if [ -f "$DEST/docs/profile.yaml" ] && ! grep -q '^  action_floor:' "$DEST/docs/profile.yaml"; then
  echo
  echo "migration: docs/profile.yaml has no review.rounds or review.action_floor. The loop"
  echo "  now decides whether a finding buys a build round from its severity, and caps how"
  echo "  many times the adversarial reviewer runs. Without a cap the reviewer never"
  echo "  converges, a pass over a clean diff always finds something, and without a floor a"
  echo "  low costs the same as a high. On one measured run that was 23 build rounds for 7"
  echo "  stories and a 9.1 hour story whose first build took 52 minutes. Add under review:"
  echo "    rounds: 1"
  echo "    action_floor: high"
  echo "  profile.yaml is project state, so this update never rewrites it for you. The"
  echo "  contract text in .claude/ is already updated and defaults to these values when"
  echo "  the keys are absent."
fi
if [ -f "$DEST/docs/profile.yaml" ] && grep -q '^default_task_autonomy:' "$DEST/docs/profile.yaml"; then
  echo
  echo "migration: docs/profile.yaml still has default_task_autonomy. Rename the key to"
  echo "  default_story_autonomy to match the refreshed contracts. profile.yaml is project"
  echo "  state, so this update never rewrites it for you."
fi
# Prototype non-goals migration. Prototype mode now reads docs/PRODUCT.md and
# checks what it draws against the non-goals. Anything already committed under
# prototypes/ was drawn without that check, and a committed prototype is the
# phase's vision record, so it is project state and is never rewritten here.
if [ -d "$DEST/prototypes" ] && ls -d "$DEST"/prototypes/v*/ >/dev/null 2>&1; then
  echo
  echo "migration: this install has prototypes drawn before the non-goals check existed."
  echo "  Prototype mode's inputs did not include docs/PRODUCT.md, so a prototype could"
  echo "  render an affordance the non-goals forbid and nothing in the step caught it."
  echo "  It now checks before drawing and reconciles before you react (docs/PROTOCOL.md,"
  echo "  Prototype before design). Existing prototypes/ folders are the committed vision"
  echo "  record and this update leaves them alone. Worth re-reading them against"
  echo "  docs/PRODUCT.md's non-goals yourself, an approved picture that crosses one is"
  echo "  the failure this fixes, and the correction is a call for this project's own"
  echo "  session, not for the harness."
fi
# The doc renderer's set now comes from disk, and it reaps. Both halves change
# what appears in a committed directory, so both get said. Ledgered, because an
# install never stops having docs/ and an unguarded echo here would print on
# every update forever, which is how a notice stops being read.
if [ "${render_docs_changed:-0}" = "1" ]; then
  echo
  echo "note: scripts/render-docs.mjs no longer keeps its own list of what a founder"
  echo "  doc is. It renders every docs/*.md except STATE.md, so a new doc reaches"
  echo "  docs/html/index.html with no harness edit. Docs this install has that the old"
  echo "  list never rendered appear on the next render, PROTOCOL and STRUCTURE among"
  echo "  them, which were held back until now on the grounds that agents parse them."
  echo "  It also reaps now. Any docs/html/*.html it did not produce is deleted, because"
  echo "  before this it only ever wrote and a page dropped from the list survived"
  echo "  unreachable and looking current. Reported by KaizenBridge on 2026-08-06."
  if [ -n "${doc_orphans:-}" ]; then
    echo
    echo "  This install has such a page. The next render deletes:"
    echo "   $doc_orphans"
    echo "  docs/html/ is committed, so that lands as a tracked deletion. The markdown is"
    echo "  untouched, only the projection goes. Render before you commit anything else so"
    echo "  the removal is its own reviewable diff: node scripts/render-docs.mjs"
  fi
  mark_notice 'render-docs-derives-and-reaps'
fi
if [ "${journey_new:-0}" = "1" ]; then
  echo
  echo "new: docs/kaizenos-journey.html, the narrative walkthrough of one worked"
  echo "  example, idea to shipped app. It is about KaizenOS rather than about this"
  echo "  project, so it is refreshed on every update like the contracts are. The"
  echo "  rendered docs link it from the left rail as Learn, for someone who opens"
  echo "  the board without knowing what this is. It is 88KB and docs/ is committed."
fi
if [ "${board_render_new:-0}" = "1" ]; then
  echo
  echo "new: the render includes the board. scripts/render-docs.mjs now combines"
  echo "  docs/ROADMAP.yaml with the story files and the gate records, so"
  echo "  docs/html/index.html opens on where every story stands, with a page per"
  echo "  story and per epic under it. No server and no app, the same one command."
  echo "  This install has ${board_story_count:-0} stor(y|ies), so the next render adds that many"
  echo "  story pages plus one per epic to docs/html/, which is committed. Render"
  echo "  before you commit anything else so the addition is its own reviewable diff:"
  echo "  node scripts/render-docs.mjs"
  mark_notice 'board-renders-static'
fi
if [ "${docs_structured:-0}" = "1" ]; then
  echo
  echo "new: a rendered document now carries its own contents. The left rail still"
  echo "  lists the documents, and a rail on the page lists the sections inside the"
  echo "  one you are reading, three levels deep, so a PRD reads as its epics and"
  echo "  its stories instead of one scroll. The heading scale was repaired to match,"
  echo "  a story title outranks the labels inside it now, and field lines like"
  echo "  '**Goal.**' and '**Depends on.**' render as rows rather than running into"
  echo "  one paragraph. Nothing in docs/*.md changes, this is the render only. Every"
  echo "  file in docs/html/ is rewritten, and that directory is committed, so render"
  echo "  before you commit anything else and the change is its own reviewable diff:"
  echo "  node scripts/render-docs.mjs"
  mark_notice 'docs-carry-contents'
fi
if [ "${front_door_new:-0}" = "1" ]; then
  echo
  echo "new: docs/html/index.html is this project's front door. It carries the name"
  echo "  and the opening line from docs/PRODUCT.md, then where the pipeline stands"
  echo "  and the one command that moves it, read from scripts/phase.mjs, the same"
  echo "  detector /help and /next use. The documents below it are grouped, yours"
  echo "  first and the harness contracts second, instead of one flat grid titled"
  echo "  Docs. Render before you commit anything else:"
  echo "  node scripts/render-docs.mjs"
  mark_notice 'index-is-the-front-door'
fi
if [ "${land_new:-0}" = "1" ]; then
  echo
  echo "new: /land writes state back after a merge you made yourself. Until now the"
  echo "  reconcile lived only inside the merger agent, which runs only when"
  echo "  profile review.merge is agent-on-green. On the default, human, nothing"
  echo "  flipped a merged story to done, so the board reported shipped work as"
  echo "  unfinished until somebody noticed. Run this now to see whether that"
  echo "  already happened here (it reads only, and reports):"
  echo "  node scripts/landed.mjs"
  if [ "${land_in_review:-0}" -gt 0 ] 2>/dev/null; then
    echo "  docs/ROADMAP.yaml carries $land_in_review story(s) at in-review right now,"
    echo "  which is worth checking before you build anything else."
  fi
  echo "  Then /land, or node scripts/landed.mjs --apply, from the default branch."
  echo "  Different command from story.mjs reconcile, which closes crashed phase"
  echo "  events. Similar word, unrelated repair."
  mark_notice 'reconcile-has-a-human-door'
fi
if [ "${traps_new:-0}" = "1" ]; then
  echo
  echo "new: docs/TRAPS.md, the harness mechanics file. It records the commands and"
  echo "  scripts in this kit that fail in a way which looks like success, so the next"
  echo "  agent does not pay for the same measurement twice. It is a contract, refreshed"
  echo "  on every update like PROTOCOL.md, so do NOT add this product's own lessons to"
  echo "  it, they would be lost on the next update. Those go in docs/CONVENTIONS.md,"
  echo "  which is project state and is never overwritten. The boundary is written into"
  echo "  the file's own header. scripts/drift.mjs now fails if a trap cites a script"
  echo "  under scripts/ or .claude/ that does not exist."
fi
if [ "${succession_new:-0}" = "1" ]; then
  echo
  echo "new: docs/SUCCESSION.md and /handoff, for ending one session and starting the"
  echo "  next. docs/STATE.md stays the resumable pointer and is unchanged. The handoff"
  echo "  holds only what a pointer cannot say, what is mid-flight, what was parked with"
  echo "  an owner and a trigger, and the nine close-out questions a session answers"
  echo "  before its context is gone. It writes docs/HANDOFF.md, which is project state"
  echo "  and is overwritten by each handoff rather than appended to."
fi
if [ "${build_standards_new:-0}" = "1" ]; then
  echo
  echo "new: docs/BUILD-STANDARDS.md now ships with the harness. Eight code rules every"
  echo "  product built by this harness follows, whatever its stack, each one measured"
  echo "  from a defect shape that bought a repair round more than once on a real build."
  echo "  The builder and planner read it, and qa and the pr-reviewer judge against it by"
  echo "  name. It is a contract, refreshed on every update like PROTOCOL.md. A rule about"
  echo "  YOUR stack still goes in docs/CONVENTIONS.md, which is project state and is"
  echo "  never touched. The /next learn step now promotes a finding shape into"
  echo "  CONVENTIONS.md the second time a gate raises it."
fi
if [ "${ux_principles_new:-0}" = "1" ]; then
  echo
  echo "new: docs/UX-PRINCIPLES.md now ships with the harness. Design mode already"
  echo "  named it as an input but no install ever received it, so the designer was"
  echo "  told to read a file that was not there. It is a contract, refreshed on every"
  echo "  update like PROTOCOL.md and STRUCTURE.md."
fi
# Stage events. logs/ is project state, so seed the file rather than overwrite it,
# then print the contract in full. A client session reads this to build the reader,
# so it is a spec and not a heads-up.
if [ ! -f "$DEST/logs/events.jsonl" ]; then
  mkdir -p "$DEST/logs"
  : > "$DEST/logs/events.jsonl"
  echo
  echo "new: logs/events.jsonl, the per-phase machine trail. /next now emits an event"
  echo "  as each phase opens and as it closes, so a run in flight is visible instead of"
  echo "  silent until the end. logs/PROGRESS.md is unchanged and stays the human trail."
  echo "  Full schema in docs/STRUCTURE.md, Event schema. The contract, for any client"
  echo "  that renders it:"
  echo
  echo "    One JSON object per line, append-only, newest last. Tail it by byte offset."
  echo "    Never parse runner output, this file is the only source for live progress."
  echo "    Fields: ts, story, epic, phase, round, status, summary, facts, decision, cost."
  echo "    phase: pick | plan | build | checks | qa | security | pr | review | record | block"
  echo "    status: running | ok | concerns | failed | skipped | blocked"
  echo "    Two events per phase. status running means that phase is executing NOW."
  echo "    Anything else means it has ended. A stage chip is the latest event for a"
  echo "    story; without the open event the chip reads plan through the whole build."
  echo "    cost is on close events only, {model, tokens, tool_uses, ms, usd, usd_basis}."
  echo "    usd is derived from profile.yaml rates, so show it as estimated or not at all."
  echo
  echo "  Two other contract changes land with it:"
  echo "    Story files gain a ## Summary section, first, four lines, or the single line"
  echo "      '- Not gated yet.' before the story is gated. It is assembled from the"
  echo "      events at the record phase, never hand-written."
  echo "    Gate findings gain outcome: decision-owed, the one outcome that needs a human."
  echo "      Surface it apart from accepted and follow-up."
fi
if [ "${stages_extended:-0}" = "1" ]; then
  echo
  echo "note: blocked.at_stage gained two values, 'pr' and 'record'. The full set is"
  echo "  plan | build | checks | qa | security | review | pr | record. A run can stop"
  echo "  while pushing or while writing state, and until now story.mjs refused the only"
  echo "  stage that was true, so the event trail carried a blocked phase that no gate"
  echo "  record could name. Anything switching on at_stage must handle both new values."
fi
# Cost rates. docs/profile.yaml is project state and is never overwritten, so an
# install that predates cost accounting has no cost.rates block and every event
# comes back usd null with usd_basis unknown. Nothing else tells the operator
# that, and an empty dollar column reads as a free build rather than a missing
# table. Guarded on the block being absent, so it stops once it is added.
if [ -f "$DEST/docs/profile.yaml" ] && ! grep -q '^[[:space:]]*rates:' "$DEST/docs/profile.yaml"; then
  echo
  echo "action needed: docs/profile.yaml has no cost.rates block, so /cost will report"
  echo "  tokens with no dollars. Add one, blended per million tokens, keys matched"
  echo "  exactly first then as a family substring of the event's model id:"
  echo
  echo "    cost:"
  echo "      currency: USD"
  echo "      rates:"
  echo "        opus: 30.00"
  echo "        sonnet: 6.00"
  echo "        haiku: 1.00"
  echo
  echo "  Unpriced events keep their tokens in the totals and are named in docs/COST.md"
  echo "  rather than counted as zero, so nothing is silently lost until you add it."
fi
# The mechanical -> checks rename. Only the word changed, but blocked.at_stage is
# the one place this vocabulary reaches a client's parsed contract, so say it.
# Fires when the old token is in this install's own records AND the notice has
# not been recorded before. The evidence is immutable, gate records are never
# rewritten, so the ledger and not the evidence is what makes this one-time.
if [ "${mechanical_present:-0}" = "1" ]; then
  echo
  echo "note: the phase called 'mechanical' is now called 'checks'. Same step,"
  echo "  scripts/gate.mjs, the no-model structural gate. The old word named nothing a"
  echo "  reader could act on. story.mjs accepts either token on input and writes only"
  echo "  'checks', so existing gate records keep parsing. Anything reading"
  echo "  blocked.at_stage, findings[].source, or escaped.missed_by must accept both."
  mark_notice 'rename-mechanical-to-checks'
fi
if [ "${ledger_new:-0}" = "1" ]; then
  echo
  echo "new: .kaizenos-notices, a one-line-per-token ledger of the migration notices"
  echo "  this update already showed you. It exists because some notices announce a"
  echo "  change whose evidence is permanent, a gate record naming an old phase for"
  echo "  instance, so 'has this install got the old thing' stays true forever and"
  echo "  cannot be used to print once. Commit it. It is project state like"
  echo "  docs/STATE.md, and a fresh clone without it replays every notice."
fi
echo "Restart the Claude Code session in $DEST so it picks up the refreshed commands."
