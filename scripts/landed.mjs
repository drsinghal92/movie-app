#!/usr/bin/env node
// landed.mjs — which stories are already merged but still recorded as in-review,
// and the write-back that closes the gap. No LLM, deterministic.
//
// NOT to be confused with `story.mjs reconcile`, which is a different job under a
// word that reads the same. That one closes phase events a crash left open in
// logs/events.jsonl. This one closes the gap between a merge that happened on the
// default branch and the state files that never heard about it. Two repairs, two
// commands, deliberately different names, because a single `reconcile` verb would
// make a run that repaired one look like a run that repaired both.
//
// Why this exists. Reconcile-after-merge was written down in exactly one place,
// step 5 of .claude/agents/merger.md, and the merger agent runs only when
// docs/profile.yaml has review.merge set to agent-on-green. `human` is the
// default and the production-tier default, so on the default setting a merged
// epic left every one of its stories reading in-review, with the repo's own
// board reporting shipped work as unfinished. Observed twice on KaizenTasks in
// one day (docs/UPSTREAM-2026-08-18.md in that repo), both times repaired by
// hand, and the first hand pass still missed two of the five actions. A
// checklist a human follows from memory is a checklist followed partially, so
// the checklist became this script and merger.md step 5 now calls it.
//
// Every write goes through scripts/story.mjs. This script never edits
// ROADMAP.yaml, story frontmatter, STATE.md or PROGRESS.md itself (finding 9,
// state transitions belong in one deterministic tool, not in prose or in a
// second tool that races the first).
//
// No dependencies, node built-ins only, same as phase.mjs and story.mjs.
//
// Usage:
//   node scripts/landed.mjs             report the drift, exit 1 if any
//   node scripts/landed.mjs --json      the same finding as an object, for tooling
//   node scripts/landed.mjs --apply     perform the write-back and commit it

import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const p = (rel) => join(ROOT, rel);
const has = (rel) => existsSync(p(rel));
const read = (rel) => (has(rel) ? readFileSync(p(rel), 'utf8') : '');

const argv = process.argv.slice(2);
const wantJson = argv.includes('--json');
const wantApply = argv.includes('--apply');

const die = (msg) => {
  console.error(`landed: ${msg}`);
  process.exit(2);
};

// Run a command and return its stdout, or null when it fails for any reason.
// Null is a real answer here and never an empty result, because "gh is not
// installed" and "gh found no merged PRs" must not reduce to the same value.
// Conflating them is how a detector reports a clean sweep it never performed.
function tryRun(cmd, args) {
  try {
    return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

// Run a command that must succeed. Used only on the apply path, where a failed
// write must stop the run rather than let the next write build on a state that
// was not reached.
function run(cmd, args) {
  return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}

// ---------------------------------------------------------------------------
// 1. The candidates. Every story ROADMAP.yaml records as in-review.
// ---------------------------------------------------------------------------

// in-review is the status the loop leaves a story in once its PR is open
// (.claude/commands/next.md step 12). done is set by whoever merges, which is
// the step that had no owner. No other status can be affected by a merge, so no
// other status is a candidate.
// Scanned line by line rather than parsed, the same choice story.mjs and
// phase.mjs make and for the same reason. No yaml parser is vendored anywhere in
// scripts/, and the one that does exist lives inside the renderer, which drags
// the whole HTML chrome in behind it. A state script must not fail to read the
// roadmap because a stylesheet module moved.
//
// The shape it reads is fixed by docs/STRUCTURE.md, `epics:` is a list of epic
// blocks and each carries a `stories:` list. An epic id and a story id are told
// apart by indent, a story block is always nested deeper than its epic.
function candidates() {
  const stories = [];
  const inProgress = [];
  if (!has('docs/ROADMAP.yaml')) return { stories, inProgress };

  const lines = read('docs/ROADMAP.yaml').split('\n');
  let epicId = null;
  let epicIndent = -1;
  let block = null; // the story block being read

  const flush = () => {
    if (!block) return;
    if (block.status === 'in-progress') inProgress.push(block.id);
    if (block.status === 'in-review') stories.push(block);
    block = null;
  };

  for (const line of lines) {
    const item = line.match(/^(\s*)-\s+id:\s*(\S+)/);
    if (item) {
      const indent = item[1].length;
      const id = item[2];
      // The first `- id:` in the file sets the epic indent. Anything deeper is a
      // story, anything at that same indent is the next epic.
      if (epicIndent === -1 || indent <= epicIndent) {
        flush();
        epicId = id;
        epicIndent = indent;
        continue;
      }
      flush();
      block = { id, epic: epicId, indent, title: '', status: 'todo', pr: null };
      continue;
    }
    if (!block) continue;
    // A line shallower than the block's own fields has left the block. Fields sit
    // deeper than the `- id:` line they belong to.
    const field = line.match(/^(\s*)(\w+):\s*(.*)$/);
    if (!field) continue;
    if (field[1].length <= block.indent) { flush(); continue; }
    const [, , key, raw] = field;
    const value = raw.replace(/\s+#.*$/, '').trim().replace(/^["']|["']$/g, '');
    if (key === 'title') block.title = value;
    if (key === 'status') block.status = value;
    if (key === 'pr') block.pr = value && value !== 'null' ? value : null;
  }
  flush();
  return { stories, inProgress };
}

// ---------------------------------------------------------------------------
// 2. The evidence. Which branches have actually been merged.
// ---------------------------------------------------------------------------

// The merged PR list, keyed by the branch it came from.
//
// This is the primary signal rather than the story's own `pr:` field, and the
// reason is the shape that produced the bug. Under `--all` the loop commits a
// whole epic onto epic/E0N and opens one PR at the boundary, so an individual
// story has no PR of its own to record and `pr:` is legitimately null right up
// to the moment the epic PR opens. A detector keyed on `pr:` would no-op in
// precisely the case it exists for. It is also why this asks GitHub rather than
// git: merger.md step 2c deletes the branch after merging it, so by the time
// anyone checks, `git merge-base --is-ancestor` has no ref left to resolve. The
// PR record outlives the branch.
//
// Returns null when gh cannot answer at all, which is a different outcome from
// an empty list and is reported as such.
function mergedByBranch() {
  const out = tryRun('gh', ['pr', 'list', '--state', 'merged', '--limit', '200', '--json', 'number,headRefName,url,mergedAt']);
  if (out === null) return null;
  let rows;
  try {
    rows = JSON.parse(out);
  } catch {
    return null;
  }
  const byBranch = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || !r.headRefName) continue;
    // Newest merge wins when a branch name was reused, which is what a reader
    // means by "the PR that landed this".
    const prev = byBranch.get(r.headRefName);
    if (prev && String(prev.mergedAt) > String(r.mergedAt)) continue;
    byBranch.set(String(r.headRefName), { number: r.number, url: String(r.url || ''), mergedAt: r.mergedAt });
  }
  return byBranch;
}

// The git fallback, for a repo with no gh and for a branch that still exists.
// Deliberately second. It answers only for refs git can still see, so a merged
// and deleted branch is invisible to it and must fall through to unknown.
//
// It asks whether a merge commit on the default branch has this branch's tip as
// a merged-in parent, NOT whether the tip is an ancestor. Ancestry is the
// obvious test and it is wrong: a branch created and not yet committed to is
// trivially an ancestor of the branch it was cut from, so ancestry reports work
// that does not exist as merged. Caught in the fixture on the first run. The
// parent test is exact here because docs/PROTOCOL.md fixes the merge policy,
// merge commits only and never squash, so a branch that landed always left a
// merge commit naming its tip.
function mergedLocally(branchPatterns) {
  const base = defaultBranch();
  const target = [`origin/${base}`, base].find(
    (t) => tryRun('git', ['rev-parse', '--verify', '--quiet', t]) !== null,
  );
  if (!target) return new Map();

  // Every merged-in parent on the default branch. %P lists all parents of a
  // merge, first is the branch it merged into, the rest are what it absorbed.
  const mergesOut = tryRun('git', ['log', '--merges', '--format=%P', target]);
  if (mergesOut === null) return new Map();
  const absorbed = new Set();
  for (const line of mergesOut.split('\n')) {
    const parents = line.trim().split(/\s+/).filter(Boolean);
    for (const sha of parents.slice(1)) absorbed.add(sha);
  }

  const refsOut = tryRun('git', ['for-each-ref', '--format=%(objectname) %(refname:short)', 'refs/heads', 'refs/remotes']);
  if (refsOut === null) return new Map();
  const found = new Map();
  for (const raw of refsOut.split('\n')) {
    const [sha, ref] = raw.trim().split(/\s+/);
    if (!sha || !ref) continue;
    // origin/epic/E01 and epic/E01 are the same branch to this question.
    const name = ref.replace(/^origin\//, '');
    if (!branchPatterns.some((re) => re.test(name))) continue;
    if (absorbed.has(sha)) found.set(name, { number: null, url: '', mergedAt: null });
  }
  return found;
}

// The default branch, from the profile, falling back to git's own answer and
// then to main. profile.yaml is read as text on purpose, the same way every
// other script here reads it, no yaml parser is vendored for one field.
function defaultBranch() {
  const m = read('docs/profile.yaml').match(/^\s*default_branch:\s*(\S+)/m);
  if (m && m[1] && m[1] !== 'null') return m[1];
  const head = tryRun('git', ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']);
  if (head) return head.trim().replace(/^origin\//, '');
  return 'main';
}

// ---------------------------------------------------------------------------
// 3. The finding.
// ---------------------------------------------------------------------------

// A story matches a merged branch when that branch is its own story branch or
// the epic branch its epic commits onto. Both shapes ship (docs/PROTOCOL.md,
// Git and CI), so both are asked about.
function branchRes(story, prefix) {
  return [
    // story/S-001-slug, and story/S-001 with no slug at all.
    new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${story.id}(-|$)`),
    new RegExp(`^epic/${story.epic}$`),
  ];
}

function storyPrefix() {
  const m = read('docs/profile.yaml').match(/^\s*branch_prefix:\s*(\S+)/m);
  return m && m[1] && m[1] !== 'null' ? m[1] : 'story/';
}

function findDrift() {
  const { stories, inProgress } = candidates();
  const prefix = storyPrefix();
  if (!stories.length) return { landed: [], unknown: [], inProgress, ghAvailable: null, prefix };

  const gh = mergedByBranch();
  const patterns = stories.flatMap((s) => branchRes(s, prefix));
  // Only pay for the git sweep when gh could not answer. When gh answered, a
  // branch it did not name was not merged through a PR, and this repo merges
  // only through PRs.
  const local = gh === null ? mergedLocally(patterns) : new Map();
  const source = gh === null ? local : gh;

  const landed = [];
  const unknown = [];
  for (const s of stories) {
    const res = branchRes(s, prefix);
    let hit = null;
    let hitBranch = null;
    for (const [branch, rec] of source) {
      if (!res.some((re) => re.test(branch))) continue;
      // Prefer the story's own branch over its epic branch when both merged.
      if (!hit || branch.startsWith(prefix)) { hit = rec; hitBranch = branch; }
    }
    if (hit) landed.push({ ...s, branch: hitBranch, mergedPr: hit.number, mergedUrl: hit.url });
    else unknown.push(s);
  }
  return { landed, unknown, inProgress, ghAvailable: gh !== null, prefix };
}

// ---------------------------------------------------------------------------
// 4. The write-back. merger.md step 5, performed rather than remembered.
// ---------------------------------------------------------------------------

function apply(drift) {
  const base = defaultBranch();
  const branchNow = (tryRun('git', ['branch', '--show-current']) || '').trim();
  // The same guard PROTOCOL.md puts on every harness commit. A working tree can
  // be left on a story branch by another session, and a reconcile committed
  // there lands the state fix inside the very branch it says is already merged.
  if (branchNow !== base) {
    die(`the working tree is on "${branchNow || 'a detached HEAD'}", not the default branch "${base}". A reconcile commits to the default branch. Check it out first.`);
  }
  // Start clean. The commit at the end is `git add -A`, because the render
  // rewrites a whole directory and listing its output would be a second list to
  // drift. That makes anything already dirty part of this commit, which is how a
  // reconcile quietly ships someone's unrelated work under a subject line saying
  // it only moved statuses.
  const dirty = (tryRun('git', ['status', '--porcelain']) || '').trim();
  if (dirty) {
    die(`the working tree has uncommitted changes. A reconcile commits everything it finds, so it would carry them along under a subject line that says otherwise. Commit or stash first.\n${dirty}`);
  }

  const ids = drift.landed.map((s) => s.id);
  for (const s of drift.landed) {
    run('node', ['scripts/story.mjs', 'status', s.id, 'done']);
    // Backfill the PR url when the story never got one, which is the normal
    // case under the epic shape. Never overwrite one that is already recorded.
    if (!s.pr && s.mergedUrl) run('node', ['scripts/story.mjs', 'pr', s.id, s.mergedUrl]);
    const via = s.mergedPr ? `PR #${s.mergedPr}` : `branch ${s.branch}`;
    run('node', ['scripts/story.mjs', 'log', `${s.id} done, merged via ${via}`]);
  }

  // One state write for the whole sweep, not one per story. The pointer names
  // where the human is, and mid-sweep values were never true.
  const stateArgs = ['scripts/story.mjs', 'state', '--last', `landed ${ids.join(', ')}`, '--next', '/next'];
  // Only clear the current pointer when nothing is actually in flight. A story
  // still in-progress is the current work and a merge elsewhere does not end it.
  if (!drift.inProgress.length) stateArgs.push('--current', 'none');
  run('node', stateArgs);

  // Last, after every state file is written. A render taken before the state is
  // written draws the board you just changed (merger.md step 5 says the same).
  run('node', ['scripts/render-docs.mjs']);

  run('git', ['add', '-A']);
  const subject = `chore: reconcile ${ids.length} landed ${ids.length === 1 ? 'story' : 'stories'} after merge`;
  const body = drift.landed
    .map((s) => `- ${s.id} done, merged via ${s.mergedPr ? `PR #${s.mergedPr}` : `branch ${s.branch}`}`)
    .join('\n');
  // No Co-Authored-By trailer. Every other commit in this repo names the model
  // that wrote it, and nothing here was written by one. This commit is a
  // mechanical projection of a merge that already happened, so a model trailer
  // would credit a judgement that was never made.
  run('git', ['commit', '-m', subject, '-m', body]);
  const sha = (tryRun('git', ['rev-parse', '--short', 'HEAD']) || '').trim();
  console.log(`landed: reconciled ${ids.length} ${ids.length === 1 ? 'story' : 'stories'} (${ids.join(', ')}) in ${sha}`);
  console.log('landed: not pushed. Push when you are ready.');
  return 0;
}

// ---------------------------------------------------------------------------
// 5. Report.
// ---------------------------------------------------------------------------

const drift = findDrift();

if (wantJson) {
  console.log(JSON.stringify({
    landed: drift.landed.map((s) => ({ id: s.id, epic: s.epic, branch: s.branch, pr: s.mergedPr, url: s.mergedUrl })),
    unknown: drift.unknown.map((s) => ({ id: s.id, epic: s.epic })),
    gh_available: drift.ghAvailable,
  }, null, 2));
  process.exit(drift.landed.length ? 1 : 0);
}

if (wantApply) {
  if (!drift.landed.length) {
    console.log('landed: nothing merged is still recorded as in-review, nothing to reconcile');
    process.exit(0);
  }
  process.exit(apply(drift));
}

if (!drift.landed.length && !drift.unknown.length) {
  console.log('landed: no story is in-review, nothing could be out of date');
  process.exit(0);
}

if (drift.landed.length) {
  console.log(`landed: ${drift.landed.length} merged ${drift.landed.length === 1 ? 'story is' : 'stories are'} still recorded as in-review`);
  for (const s of drift.landed) {
    console.log(`  ${s.id}  ${s.title}`.trimEnd());
    console.log(`         merged via ${s.mergedPr ? `PR #${s.mergedPr}` : `branch ${s.branch}`}`);
  }
  console.log('landed: run /land, or `node scripts/landed.mjs --apply`, to write the state back.');
}

// Never silent about what could not be decided. An undecidable story printed as
// nothing reads exactly like a story that is fine, which is the failure this
// whole script is a response to.
if (drift.unknown.length) {
  const why = drift.ghAvailable === false
    ? 'gh could not be reached, so only branches git can still see were checked'
    : 'no merged PR names their branch';
  console.log(`landed: ${drift.unknown.length} in-review ${drift.unknown.length === 1 ? 'story' : 'stories'} not yet merged, or undecidable (${why})`);
  console.log(`         ${drift.unknown.map((s) => s.id).join(', ')}`);
}

process.exit(drift.landed.length ? 1 : 0);
