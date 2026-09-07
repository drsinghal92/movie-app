#!/usr/bin/env node
// drift.mjs — does the prose still describe the code? No LLM.
//
// Half the defects in the 2026-08-04 review rounds were not bugs. They were
// contract files describing something the scripts no longer do: a gate renamed
// in the enum and not in PROTOCOL, a stage list that grew in story.mjs and not
// in the templates, a section that went from five lines to four in three files
// out of five. None of those crash. They misinstruct every future story in
// every installed product, silently, which is strictly worse.
//
// A test suite cannot see any of it, because nothing is wrong at runtime. So
// this checks the one thing that is mechanically checkable about prose, that
// every place restating a fact from the code restates the same fact.
//
// Deliberately narrow. A check that cries wolf gets ignored, and an ignored
// check is worse than no check. Every rule here maps to a defect that shipped.
//
// Usage: node scripts/drift.mjs [--quiet]

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const p = (rel) => join(ROOT, rel);
const read = (rel) => readFileSync(p(rel), 'utf8');
const quiet = process.argv.includes('--quiet');

const findings = [];
const fail = (rule, detail) => findings.push({ rule, detail });

// The code is the authority. Every rule below compares prose against these.
const story = read('scripts/story.mjs');
const arrayIn = (name) => {
  const m = story.match(new RegExp(`const ${name} = \\[([^\\]]*)\\]`));
  if (!m) return null;
  return m[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
};

const STAGES = arrayIn('STAGES');
const PHASES = arrayIn('PHASES');
if (!STAGES || !PHASES) fail('source', 'could not read STAGES or PHASES out of scripts/story.mjs, every rule below is unenforced');

// Files that carry contract prose. Anything not here is not checked, on
// purpose: history files (IDEAS, DECISIONS, CONVENTIONS) record what was true
// when written and must NOT be dragged forward.
const CONTRACTS = [
  '.claude/commands/next.md',
  '.claude/commands/cost.md',
  '.claude/commands/standup.md',
  'docs/PROTOCOL.md',
  'docs/STRUCTURE.md',
  'templates/story.md',
  'templates/gate.yml',
  'scripts/update.sh',
  'CLAUDE.md',
];

// --- 1 and 2. every enumeration matches the array it claims to restate -------
// Shipped twice. STAGES gained `pr` and `record` while templates/gate.yml and
// STRUCTURE.md still listed the old six. The `mechanical` to `checks` rename
// reached the enum and the event writer but not every list naming the closed
// set.
//
// Both rules are one pass, because the hard part is not comparing a list, it is
// deciding WHICH set a given list is trying to be. Two earlier attempts got
// this wrong in opposite directions. Keying on `at_stage:` with a colon missed
// the copy update.sh prints into every install, which spans two echo lines and
// has no colon. Routing by content, "if it contains pick or block it must be a
// phase list", meant a stage list that wrongly gained a phase-only token was
// skipped by rule 1 and refused by rule 2, so the one error most worth catching
// fell between them.
//
// Route by the text IMMEDIATELY BEFORE the list instead. That is where a
// document says what it is about, and it is narrow enough that a mention
// elsewhere in the same sentence cannot capture the list. STRUCTURE.md names
// the phase set and blocked.at_stage in one line, and only proximity separates
// them.
const LEAD = 90;
const SETS = [
  {
    rule: 'at_stage enumeration',
    lead: /at_stage/,
    values: STAGES,
    label: 'STAGES',
    // Where a clean tree must find one, per file. A count-based floor cannot
    // see a single site going quiet when the others still match, which is how
    // the previous threshold let exactly that through.
    expect: { 'templates/gate.yml': 1, 'docs/STRUCTURE.md': 1, 'scripts/update.sh': 1 },
  },
  {
    rule: 'phase enumeration',
    lead: /`?phases?`?\s*(?::|is a closed set)|\bphase\b/i,
    values: PHASES,
    label: 'PHASES',
    expect: { 'docs/STRUCTURE.md': 1, 'scripts/update.sh': 1 },
  },
];

for (const set of SETS) {
  if (!set.values) continue;
  // An expect key naming a file that is no longer a contract fails forever and
  // blames the pattern, which is not the problem. Catch the bookkeeping error
  // where it is, rather than as a mystery stale report.
  for (const rel of Object.keys(set.expect)) {
    if (!CONTRACTS.includes(rel)) fail('source', `${set.label} expects an enumeration in ${rel}, which is not in CONTRACTS. Fix the expect map in scripts/drift.mjs`);
  }
  const seen = {};
  for (const rel of CONTRACTS) {
    if (!existsSync(p(rel))) continue;
    const lines = read(rel).split('\n');
    lines.forEach((line, i) => {
      // The two-line window exists only for shell, where update.sh splits the
      // set across a pair of echoes. Applying it to markdown pulled the next
      // table row into the window and false-failed a sentence that merely
      // happened to sit above one.
      const window = rel.endsWith('.sh') ? `${line} ${lines[i + 1] || ''}` : line;
      const m = window.match(/((?:[a-z_]+\s*\|\s*){2,}[a-z_]+)/);
      if (!m) return;
      const before = window.slice(Math.max(0, m.index - LEAD), m.index);
      if (!set.lead.test(before)) return;
      const named = m[1].split('|').map((s) => s.trim());
      // Shell alternation is not an enumeration. `case "$at_stage" in
      // plan|build)` reads identically to a stage list and `|` is syntax there,
      // and .sh is the only place the two-line window is open, so this is the
      // one language where the pattern can be captured by real code.
      if (/\bin\s+$/.test(before)) return;
      // LENGTH decides whether this is the set or a passing mention. An earlier
      // guard required a `#` annotation or the literal phrase "full set", which
      // killed the false positive but left every set stated in ordinary prose
      // unchecked, including any that PROTOCOL.md might grow. A list is only the
      // set if it is nearly as long as the set. The false positive that
      // motivated that guard was three tokens against eight, so length excludes
      // it without excluding prose, and it needs no convention to be obeyed.
      //
      // The floor sits well below the real size so a list that DROPPED entries,
      // which is the defect this whole rule exists for, is still judged. Six
      // stages out of eight is caught. Three is a sentence.
      if (named.length < Math.max(4, Math.ceil(set.values.length * 0.6))) return;
      seen[rel] = (seen[rel] || 0) + 1;
      const missing = set.values.filter((v) => !named.includes(v));
      const extra = named.filter((v) => !set.values.includes(v));
      if (missing.length || extra.length) {
        fail(set.rule, `${rel}:${i + 1} lists ${named.join(' | ')}${missing.length ? `, missing ${missing.join(', ')}` : ''}${extra.length ? `, unknown ${extra.join(', ')}` : ''}`);
      }
    });
  }
  // Per-file self-report. A pattern rule that stops matching exits 0 and reads
  // exactly like a pass, so it has to name the site that went quiet.
  for (const [rel, n] of Object.entries(set.expect)) {
    if ((seen[rel] || 0) < n) {
      fail('stale rule', `the ${set.label} rule found ${seen[rel] || 0} enumeration(s) in ${rel} and expects ${n}. Either the wording changed, or the site was deliberately removed, or the file was renamed. Update the pattern or the expect map in scripts/drift.mjs, do not leave that site unenforced`);
    }
  }
}

// --- 3. the Summary line count agrees everywhere -----------------------------
// Shipped defect three times over. Dropping the Cost line took the block from
// five lines to four, and three separate files kept saying five, one of which
// ships to every downstream product.
{
  // Explicit phrasings, not a general "N lines" sweep. "one line" is ordinary
  // English that appears dozens of times in these files, so a broad rule here
  // produces pages of noise and gets switched off within a week.
  const CLAIMS = [
    ['templates/story.md', /open\.\s*(\w+) lines, never more/i],
    ['.claude/commands/next.md', /`## Summary` block\*\*,\s*(\w+) lines/i],
    ['.claude/commands/next.md', /the (\w+)-line shape/i],
    ['docs/STRUCTURE.md', /Summary \((\w+) lines/i],
    ['scripts/update.sh', /## Summary section, first,\s*(\w+) lines/i],
  ];
  const found = [];
  for (const [rel, re] of CLAIMS) {
    if (!existsSync(p(rel))) continue;
    const body = read(rel);
    const m = body.match(re);
    if (m) {
      const line = body.slice(0, m.index).split('\n').length;
      found.push({ rel, line, word: m[1].toLowerCase() });
    }
  }
  const distinct = [...new Set(found.map((c) => c.word))];
  if (distinct.length > 1) {
    fail('Summary length', `the story Summary is described as ${distinct.join(' and ')}:\n${found.map((c) => `      ${c.rel}:${c.line} says "${c.word}"`).join('\n')}`);
  }
  // A rule that silently stops finding what it checks is worse than no rule,
  // because it reads as a pass. Say so instead.
  if (found.length < CLAIMS.length) {
    const missing = CLAIMS.filter(([rel, re]) => !existsSync(p(rel)) || !re.test(read(rel))).map(([rel]) => rel);
    fail('stale rule', `the Summary length check matched ${found.length} of ${CLAIMS.length} known phrasings. Reworded in ${[...new Set(missing)].join(', ')}, so update the patterns in scripts/drift.mjs rather than leaving them unenforced`);
  }
}

// --- 4. no NUL bytes in scripts ----------------------------------------------
// Shipped defect: render-docs.mjs used NUL as an internal sentinel, so git
// stored it as binary and no change to it was ever reviewable.
// SOURCE files only, by extension. This script ships into every install, and
// scanning a whole directory for NUL bytes fails a product that keeps a legit
// binary test fixture, a PNG or a sample upload. Rejecting someone else's valid
// repo is a far worse failure than missing a binary source file.
//
// tests/ is included because the first version of the test asserting this rule
// put a literal NUL in its own source to build the fixture, so the file proving
// the rule works was itself unreviewable. The rule has to cover the code that
// checks the rule.
const SOURCE = /\.(mjs|cjs|js|sh|json|ya?ml|md)$/;
for (const d of ['scripts', 'tests']) {
  if (!existsSync(p(d))) continue;
  for (const f of readdirSync(p(d))) {
    const rel = `${d}/${f}`;
    if (!statSync(p(rel)).isFile() || !SOURCE.test(f)) continue;
    if (readFileSync(p(rel)).includes(0x00)) fail('binary source', `${rel} contains NUL bytes, so git treats it as binary and its diffs cannot be reviewed`);
  }
}

// --- 5. every script the commands invoke exists ------------------------------
// A command naming a script that was renamed or retired fails at the worst
// possible moment, mid-run, in someone else's repo.
{
  const dir = p('.claude/commands');
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
      const rel = `.claude/commands/${f}`;
      const named = new Set(read(rel).match(/scripts\/[a-z0-9-]+\.(?:mjs|sh)/g) || []);
      for (const s of named) {
        if (!existsSync(p(s))) fail('missing script', `${rel} invokes ${s}, which does not exist`);
      }
    }
  }
}

// --- 6. every script and command docs/TRAPS.md names exists -------------------
// TRAPS.md is mechanics, so it cites the exact file that lied. A trap pointing
// at a renamed script is worse than no trap: it reads as verified, and the
// reader who cannot find the file concludes the trap is obsolete rather than
// that the citation is.
//
// Narrow on purpose. Only paths under scripts/ and .claude/ are checked, and
// only where the entry names one. Traps about git or shell behavior name no
// path and must not be forced to invent one, because a rule that cries wolf
// gets switched off.
//
// tests/ is deliberately NOT checked, and that is a content rule as much as a
// gate one. This file ships into every install and tests/ does not, so a
// citation into it is dangling for every reader outside this repo. Describe the
// fixture pattern in prose there instead of pointing at a file they do not have.
{
  const rel = 'docs/TRAPS.md';
  if (existsSync(p(rel))) {
    const body = read(rel);
    const named = new Set([
      ...(body.match(/scripts\/[a-z0-9.-]+\.(?:mjs|sh)/g) || []),
      ...(body.match(/\.claude\/[a-z0-9/-]+\.(?:json|md)/g) || []),
    ]);
    for (const s of named) {
      if (!existsSync(p(s))) fail('missing script', `${rel} cites ${s}, which does not exist. Fix the citation or the trap, do not leave a reader chasing a renamed file`);
    }
    // Same reason as every other pattern rule here. Finding nothing and there
    // being nothing wrong are the same reading, so say which one this is.
    if (!named.size) {
      fail('stale rule', `the TRAPS citation check found no scripts/ or .claude/ path in ${rel}. Either every entry lost its citation or the paths are written in a shape this pattern no longer matches. Update the pattern in scripts/drift.mjs rather than leaving the file unenforced`);
    }
  }
}

// --- 7. the build standards are numbered, cited, and counted the same everywhere
// docs/BUILD-STANDARDS.md is the only contract a gate agent walks by number, so
// its numbering is an interface. The pr-reviewer names each standard by its
// index at the conformance step, and four files state how many there are in
// prose. Renumber, drop, or add a standard and every one of those sites reads
// as verified while pointing at nothing, which is the exact failure the file
// itself was written about.
//
// Nothing here judges a standard's content. It checks only that the number of
// them, the numbers on them, and the numbers cited against them agree.
{
  const rel = 'docs/BUILD-STANDARDS.md';
  if (existsSync(p(rel))) {
    const body = read(rel);
    const nums = [...body.matchAll(/^### (\d+)\. /gm)].map((m) => Number(m[1]));
    if (!nums.length) {
      fail('stale rule', `the build standards check found no "### N." heading in ${rel}. Either the standards lost their numbers or the heading shape changed. Update the pattern in scripts/drift.mjs rather than leaving the file unenforced`);
    } else {
      const want = nums.map((_, i) => i + 1);
      if (nums.join(',') !== want.join(',')) {
        fail('standards numbering', `${rel} numbers its standards ${nums.join(', ')}, which is not 1 to ${nums.length} in order. The pr-reviewer cites them by index, so a gap or a repeat sends it to the wrong rule`);
      }
      // Every standard is cited by the layer that judges it. A standard no gate
      // walks is a wish, which is the thing this file exists to stop.
      const reviewer = '.claude/agents/pr-reviewer.md';
      if (existsSync(p(reviewer))) {
        const rbody = read(reviewer);
        const uncited = want.filter((n) => !new RegExp(`standard ${n}\\b`).test(rbody));
        if (uncited.length === want.length) {
          fail('stale rule', `the build standards check found no "standard N" citation in ${reviewer}. Either the conformance step stopped naming them or the wording changed. Update the pattern in scripts/drift.mjs rather than leaving them unenforced`);
        } else if (uncited.length) {
          fail('uncited standard', `${rel} defines standard ${uncited.join(', ')}, which ${reviewer} never names. A standard no gate layer walks is not enforced by anything. Cite it there or remove it here`);
        }
      }
      // The spelled count, wherever prose states it. Same rule as the story
      // Summary length check above, a number written in words drifts silently.
      const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
      const word = WORDS[nums.length];
      const SITES = [rel, reviewer, '.claude/agents/builder.md', 'docs/STRUCTURE.md', 'CLAUDE.md', 'scripts/install.sh'];
      let stated = 0;
      for (const site of SITES) {
        if (!existsSync(p(site))) continue;
        for (const m of read(site).matchAll(/\b([a-z]+) (?:build standards|code standards|code rules)\b/g)) {
          if (!WORDS.includes(m[1])) continue;
          stated++;
          if (m[1] !== word) {
            fail('standards count', `${site} says "${m[0]}" while ${rel} defines ${nums.length}. Fix the prose or the file, do not leave a reader counting`);
          }
        }
      }
      if (!stated) {
        fail('stale rule', `the build standards count check matched no spelled count in ${SITES.join(', ')}. Either every site stopped stating how many there are or the phrasing changed. Update the pattern in scripts/drift.mjs rather than leaving the count unenforced`);
      }
    }
  }
}

// --- report ------------------------------------------------------------------
if (!findings.length) {
  if (!quiet) console.log('drift: contracts and code agree');
  process.exit(0);
}
console.error(`drift: ${findings.length} place(s) where the prose no longer matches the code\n`);
for (const f of findings) console.error(`  [${f.rule}] ${f.detail}`);
console.error('\nFix the prose, or the code, but do not leave them disagreeing. A contract');
console.error('file is read literally by every agent in every install.');
process.exit(1);
