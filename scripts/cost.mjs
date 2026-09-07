#!/usr/bin/env node
// cost.mjs — what a run cost, projected from logs/events.jsonl. No LLM.
//
// One source, two derived files. Cost lives on the event and nowhere else, so
// docs/COST.md and logs/cost.csv are projections that cannot disagree with the
// trail. Same one-directional rule render-docs.mjs already follows.
//
// What this cannot see: the main /next loop's own spend. Every figure here comes
// from a subagent's returned usage, so plan, build, qa, security and review are
// covered, while reading the contracts on every story, composing gate files and
// writing PR bodies are not. That exclusion is printed in the artifact itself
// rather than buried in a footnote, because a cost report that quietly
// undercounts is worse than no cost report.
//
// Usage:
//   node scripts/cost.mjs            # write docs/COST.md and logs/cost.csv, print the rollup
//   node scripts/cost.mjs --story S-088   # console only, writes nothing
//   node scripts/cost.mjs --since 2026-08-01   # console only, writes nothing
//
// A FILTERED run never writes the artifacts. Both files describe every story
// the trail has ever carried, and their headings say so, so writing a window
// into them replaces the whole history with a slice that reads like the whole
// history. /standup calls this with --since on every morning digest, which
// would have quietly truncated docs/COST.md daily. --story had the identical
// defect and is fixed with it.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const p = (rel) => join(ROOT, rel);

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
};

const EVENTS = 'logs/events.jsonl';
if (!existsSync(p(EVENTS))) {
  console.log(`cost: no ${EVENTS} yet. It fills as /next runs.`);
  process.exit(0);
}

// A malformed line is skipped and counted, never thrown on. This file is
// appended during runs, so a read racing a half-written final line is normal.
let skipped = 0;
const events = readFileSync(p(EVENTS), 'utf8')
  .split('\n')
  .filter((l) => l.trim())
  .map((l) => {
    try {
      return JSON.parse(l);
    } catch {
      skipped++;
      return null;
    }
  })
  .filter(Boolean)
  // Close events only. An open event has no cost and would double every count.
  .filter((e) => e.status !== 'running')
  .filter((e) => (flag('story') ? e.story === flag('story') : true))
  .filter((e) => (flag('since') ? e.ts >= flag('since') : true));

// Any filter makes this a window, and a window is console-only. See the note
// at the top of the file.
const windowed = Boolean(flag('story') || flag('since'));

const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const tokensOf = (e) => n(e.cost?.tokens);
// usd is null when the event's model had no rate in the table. Those tokens are
// real and stay in the token totals; only the dollar figure is missing, and it
// is counted and reported rather than silently added as zero.
const usdOf = (e) => n(e.cost?.usd);
const unpriced = events.filter((e) => e.cost?.usd_basis === 'unknown');
const msOf = (e) => n(e.cost?.ms);

const k = (t) => (t >= 1000 ? `${(t / 1000).toFixed(t >= 100000 ? 0 : 1)}k` : `${t}`);

// cost.currency was carried in all three profile files and read by nothing,
// while every figure printed a hardcoded dollar sign. A rate table written in
// another currency rendered as dollars and said nothing, which is the same
// class of quiet wrongness as a confident zero. Symbols for the few that have
// an unambiguous one, the ISO code otherwise, so an unrecognised setting is
// visible rather than silently reinterpreted as USD.
const SYMBOLS = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥' };
const currency = (() => {
  const rel = 'docs/profile.yaml';
  if (!existsSync(p(rel))) return 'USD';
  // Scoped to the `cost:` block. An unscoped search took the first `currency:`
  // anywhere in the file, so an unrelated one under another key won.
  const cost = readFileSync(p(rel), 'utf8').match(/^cost:[ \t]*(?:#.*)?$([\s\S]*?)(?=^\S|(?![\s\S]))/m);
  if (!cost) return 'USD';
  // Quotes are optional in YAML and `currency: "INR"` is as ordinary as the
  // bare form. Capture ANY value, then validate, because matching only a
  // well-formed one made a malformed one indistinguishable from an absent one
  // and both fell back to dollars without a word. A typo is now visible.
  const m = cost[1].match(/^[ \t]*currency:[ \t]*["']?([^"'#\s]*)["']?[ \t]*(?:#.*)?$/m);
  if (!m) return 'USD';
  const code = m[1].toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    console.error(`cost: cost.currency in docs/profile.yaml is "${m[1]}", which is not a three-letter code. Falling back to USD, so every figure below is labelled in dollars.`);
    return 'USD';
  }
  return code;
})();
const money = (u) => (SYMBOLS[currency] ? `${SYMBOLS[currency]}${u.toFixed(2)}` : `${u.toFixed(2)} ${currency}`);
const wall = (ms) => {
  const m = Math.round(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m` : `${m}m`;
};

// --- per story ---------------------------------------------------------------
const stories = new Map();
for (const e of events) {
  if (!stories.has(e.story)) {
    stories.set(e.story, { story: e.story, epic: e.epic, tokens: 0, usd: 0, ms: 0, rounds: 0, gate: null, first: e.ts, last: e.ts });
  }
  const s = stories.get(e.story);
  s.tokens += tokensOf(e);
  s.usd += usdOf(e);
  s.ms += msOf(e);
  // Rounds are build rounds, the number a reader means by "how many tries".
  if (e.phase === 'build') s.rounds = Math.max(s.rounds, n(e.round) || 1);
  if (e.phase === 'qa' && e.facts?.verdict) s.gate = e.facts.verdict;
  if (e.status === 'blocked') s.gate = 'BLOCKED';
  if (e.ts < s.first) s.first = e.ts;
  if (e.ts > s.last) s.last = e.ts;
}

// Wall clock is first event to last, not the sum of phase durations. The phases
// are sequential but the gaps between them are real time too.
for (const s of stories.values()) {
  const span = Date.parse(s.last) - Date.parse(s.first);
  s.wallMs = Number.isFinite(span) && span > 0 ? span : s.ms;
}

// --- per phase ---------------------------------------------------------------
const phases = new Map();
for (const e of events) {
  if (!phases.has(e.phase)) phases.set(e.phase, { phase: e.phase, calls: 0, tokens: 0, usd: 0, ms: 0 });
  const f = phases.get(e.phase);
  f.calls++;
  f.tokens += tokensOf(e);
  f.usd += usdOf(e);
  f.ms += msOf(e);
}

const totalUsd = [...phases.values()].reduce((a, f) => a + f.usd, 0);
const totalTokens = [...phases.values()].reduce((a, f) => a + f.tokens, 0);
const share = (u) => (totalUsd > 0 ? `${Math.round((u / totalUsd) * 100)}%` : '0%');
const byUsd = (a, b) => b.usd - a.usd || b.tokens - a.tokens;

// --- docs/COST.md ------------------------------------------------------------
const storyRows = [...stories.values()].map(
  (s) => `| ${s.story} | ${s.rounds || '-'} | ${k(s.tokens)} | ${money(s.usd)} | ${wall(s.wallMs)} | ${s.gate || '-'} |`,
);
const phaseRows = [...phases.values()]
  .sort(byUsd)
  .map((f) => `| ${f.phase} | ${f.calls} | ${k(f.tokens)} | ${money(f.usd)} | ${share(f.usd)} |`);

const md = [
  '# Cost',
  '',
  'Derived from `logs/events.jsonl` by `scripts/cost.mjs`. Regenerated, never hand-edited.',
  '',
  '## Per story',
  '',
  `| Story | Rounds | Tokens | Est ${currency} | Wall | Gate |`,
  '|-------|--------|--------|---------|------|------|',
  ...(storyRows.length ? storyRows : ['| (none yet) | - | - | - | - | - |']),
  '',
  '## Per phase, all stories',
  '',
  `| Phase | Calls | Tokens | Est ${currency} | Share |`,
  '|-------|-------|--------|---------|-------|',
  ...(phaseRows.length ? phaseRows : ['| (none yet) | - | - | - | - |']),
  '',
  `**Total, subagent work only.** ${k(totalTokens)} tokens, ${money(totalUsd)} estimated.`,
  '',
  ...(unpriced.length
    ? [
        `**${unpriced.length} event(s) have no ${currency} figure.** Their model has no entry in`,
        '`cost.rates` in `docs/profile.yaml`, so the tokens are counted above and the amounts',
        `are not: ${[...new Set(unpriced.map((e) => e.cost.model))].join(', ')}. Add the rate and re-run.`,
        '',
      ]
    : []),
  '**orchestration: not measured.** These figures cover the subagents only, the',
  'planner, builder, qa, security and review calls whose usage the harness reports',
  'back. The main `/next` loop reading the contracts on every story, composing gate',
  'files, writing PR bodies and driving its twelve steps is real spend that no event',
  'can see. Read the totals above as a floor, not a bill.',
  '',
  `**Amounts are estimated, in ${currency}.** Rates come from \`cost.rates\` in \`docs/profile.yaml\`,`,
  'blended per million tokens, because the harness reports one token figure rather',
  'than an input and output split. Tokens, tool uses and durations are measured.',
  '',
].join('\n');
// A repo can carry events before it carries docs/, this runs from anywhere the
// trail exists and must not die on a missing directory.
if (!windowed) {
  mkdirSync(p('docs'), { recursive: true });
  mkdirSync(p('logs'), { recursive: true });
  writeFileSync(p('docs/COST.md'), md);
}

// --- logs/cost.csv -----------------------------------------------------------
// One row per close event, flat. No total row, because a total here would read
// as the complete cost and the orchestration tail is missing from it.
const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
// usd is EMPTY, never 0.00, when the event carries no dollar figure. A confident
// zero in a spreadsheet column sums silently and understates the total, which is
// the same defect the COST.md unpriced note exists to prevent. usd_basis rides
// alongside so a reader can tell a true zero (`none`, no model ran) from a
// missing rate (`unknown`) without opening the trail.
const usdCell = (e) => (e.cost?.usd === null || e.cost?.usd === undefined ? '' : n(e.cost.usd).toFixed(2));
const csv = [
  'ts,story,epic,phase,round,status,model,tokens,tool_uses,ms,usd,usd_basis',
  ...events.map((e) =>
    [e.ts, e.story, e.epic, e.phase, e.round ?? '', e.status, e.cost?.model ?? '', tokensOf(e), n(e.cost?.tool_uses), msOf(e), usdCell(e), e.cost?.usd_basis ?? '']
      .map(csvCell)
      .join(','),
  ),
  '',
].join('\n');
if (!windowed) writeFileSync(p('logs/cost.csv'), csv);

// --- console -----------------------------------------------------------------
console.log(`cost: ${events.length} phase events across ${stories.size} stories`);
if (skipped) console.log(`cost: ${skipped} unparseable line(s) skipped`);
if (unpriced.length) console.log(`cost: ${unpriced.length} event(s) unpriced, no cost.rates entry for ${[...new Set(unpriced.map((e) => e.cost.model))].join(', ')}`);
for (const f of [...phases.values()].sort(byUsd)) {
  console.log(`  ${f.phase.padEnd(9)} ${String(f.calls).padStart(3)} calls  ${k(f.tokens).padStart(7)}  ${money(f.usd).padStart(8)}  ${share(f.usd).padStart(4)}`);
}
console.log(`  ${'total'.padEnd(9)} ${''.padStart(3)}         ${k(totalTokens).padStart(7)}  ${money(totalUsd).padStart(8)}`);
console.log('  orchestration: not measured. Subagent spend only, see docs/COST.md.');
if (windowed) {
  const by = [flag('story') ? `--story ${flag('story')}` : null, flag('since') ? `--since ${flag('since')}` : null].filter(Boolean).join(' ');
  console.log(`cost: window (${by}), console only. Nothing written, run with no filter to refresh docs/COST.md and logs/cost.csv.`);
} else {
  console.log('cost: wrote docs/COST.md and logs/cost.csv');
}
