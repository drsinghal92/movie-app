#!/usr/bin/env node
// phase.mjs — the shared "where am I" helper. One truth for /help and /next.
//
// Both commands need the same answer, which pipeline phase is this repo in and
// what is the one next command. /help reads it to signpost, /next reads it to
// dispatch. Keeping the detection here means the two can never disagree.
//
// No dependencies, node built-ins only.
// Run:  node scripts/phase.mjs           human line
//       node scripts/phase.mjs --json     the full object, for tooling
//
// The build sub-state is scanned from docs/ROADMAP.yaml text (no yaml parser is
// vendored here). It is a signpost, /next does the authoritative epic walk.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const has = (p) => existsSync(join(ROOT, p));
const read = (p) => (has(p) ? readFileSync(join(ROOT, p), 'utf8') : '');

// A directory that exists and holds at least one entry.
function dirHasEntries(p) {
  try { return readdirSync(join(ROOT, p)).length > 0; } catch { return false; }
}

// The next-up line from the resumable pointer, if any. Advisory annotation only.
function statePointer() {
  const m = read('docs/STATE.md').match(/^-\s*next up:\s*(.+)$/im);
  return m ? m[1].trim() : null;
}

// The ideate interview gate. /ideate creates docs/PRODUCT.md with an append-only
// "## Interview" section and must log two mandatory decisions before drafting,
// "D. platform ..." and "D. taste ...". When the section exists, the phase is not
// complete until both entries do, so a PRD written over a skipped interview keeps
// the pipeline honest instead of advancing. A PRODUCT.md with no Interview
// section at all predates this contract and is grandfathered, not failed.
function interviewGap() {
  const t = read('docs/PRODUCT.md');
  if (!t || !/^##\s+Interview\b/im.test(t)) return null;
  const missing = ['platform', 'taste'].filter(
    (k) => !new RegExp(`^[-*]?\\s*D\\.\\s+${k}\\b`, 'im').test(t)
  );
  return missing.length ? `interview is missing the mandatory ${missing.join(' and ')} ${missing.length > 1 ? 'entries' : 'entry'}` : null;
}

// Count story statuses in ROADMAP.yaml by scanning status: tokens. Approximate.
function buildState() {
  const y = read('docs/ROADMAP.yaml');
  const count = (s) => (y.match(new RegExp(`status:\\s*${s}\\b`, 'gi')) || []).length;
  const todo = count('todo');
  const inProgress = count('in-progress');
  const inReview = count('in-review');
  const done = count('done');
  const cancelled = count('cancelled');
  const blocked = count('blocked');
  // Every status is counted. cancelled and blocked look symmetrical and are not.
  // Cancelled is resolved, the decision is made and no work remains, so it just
  // leaves the queue. Blocked is unresolved, someone owes a decision, so it is
  // counted separately and holds the build phase open (see the build phase
  // below). Before this, blocked was in neither total nor eligible, so nine done
  // stories plus one blocked read as ship while that story still waited on a
  // human. Cancelling is now the honest way to retire a story you will never
  // unblock, which is why holding the phase open no longer traps the pipeline.
  const total = todo + inProgress + inReview + done + cancelled + blocked;
  return {
    started: has('docs/gates') && dirHasEntries('docs/gates'),
    eligible: todo + inProgress,   // rough, /next resolves real dependency eligibility
    inReview,
    done,
    cancelled,
    blocked,
    total,
  };
}

// The pipeline, in order. done() decides if a phase is complete. The first phase
// whose done() is false is the current phase. guided phases need the human.
const PHASES = [
  { key: 'ideate',    step: 1, command: '/ideate',    guided: true,  done: () => has('docs/PRODUCT.md') && has('docs/PRD.md') && !interviewGap() },
  // The brand is set inside /prototype's first pass (style-guide.html), so it is
  // not a phase of its own. /brand remains as an optional door for re-branding.
  // prototype is recommended, not gating. Done when a prototype exists, else it does not block design.
  { key: 'prototype', step: 2, command: '/prototype', guided: true,  optional: true, done: () => dirHasEntries('prototypes') || has('docs/DESIGN.md') },
  { key: 'design',    step: 3, command: '/design',    guided: true,  done: () => has('docs/DESIGN.md') },
  { key: 'architect', step: 4, command: '/architect', guided: false, done: () => has('docs/ARCHITECTURE.md') },
  { key: 'plan',      step: 5, command: '/plan',      guided: false, done: () => has('docs/ROADMAP.yaml') },
  // Build is finished when there is work on record, none of it is still waiting
  // to be picked up, and nothing is blocked on a human. A blocked story is real
  // unfinished work, so the pipeline must not report ship over the top of it.
  { key: 'build',     step: 6, command: '/next',      guided: false, done: () => { const b = buildState(); return b.total > 0 && b.eligible === 0 && b.blocked === 0; } },
];

export function detectPhase() {
  // Front doors first. No product brief means the pipeline has not started.
  if (!has('docs/PRODUCT.md') && !has('docs/PRD.md')) {
    return {
      phase: 'start', step: 0, command: '/ideate', guided: true, autonomous: false,
      door: has('code') || has('src') ? 'brownfield' : 'greenfield',
      reason: 'no docs/PRODUCT.md yet',
      next: (has('code') || has('src')) ? '/map' : '/ideate',
      state: statePointer(),
    };
  }

  for (const p of PHASES) {
    if (p.done()) continue;
    const out = {
      phase: p.key, step: p.step, command: p.command,
      guided: !!p.guided, autonomous: !p.guided,
      optional: !!p.optional,
      reason: (p.key === 'ideate' && interviewGap()) || `${p.key} not complete`,
      next: p.command,
      state: statePointer(),
    };
    if (p.key === 'build') out.build = buildState();
    return out;
  }

  // Every phase complete, or build drained. Ship / observe.
  const b = buildState();
  return {
    phase: 'ship', step: 7, command: '/standup', guided: false, autonomous: true,
    reason: b.total > 0 ? 'backlog drained' : 'pipeline complete',
    next: '/standup',
    build: b,
    state: statePointer(),
  };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const info = detectPhase();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(info, null, 2));
  } else {
    const extra = info.build
      ? `${info.build.blocked ? `, ${info.build.blocked} blocked` : ''}${info.build.cancelled ? `, ${info.build.cancelled} cancelled` : ''}`
      : '';
    const b = info.build ? `  (${info.build.eligible} eligible, ${info.build.inReview} in review, ${info.build.done} done${extra})` : '';
    console.log(`phase: ${info.phase}${b}`);
    console.log(`next:  ${info.next}${info.guided ? '  [guided, needs you]' : '  [autonomous]'}`);
  }
}
