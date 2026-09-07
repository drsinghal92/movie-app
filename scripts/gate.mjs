#!/usr/bin/env node
// KaizenOS checks gate (the "checks" phase, called the mechanical gate until
// 2026-08-04). No LLM. Deterministic, fast, free.
// Usage: node scripts/gate.mjs backlog/E01/S-001.md
// Exits 1 on a hard finding (dropped acceptance criteria or a likely secret), else 0.
// Warnings never fail the gate.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

const storyPath = process.argv[2];
const findings = [];
const warnings = [];
let uiSurface = false;
let storyId = null;
let acNums = [];

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

// 1. Acceptance criteria left unchecked in the story file (silently dropped work)
if (storyPath && existsSync(storyPath)) {
  const md = readFileSync(storyPath, 'utf8');
  const section = md.split(/^##\s+/m).find((s) => /^Acceptance criteria/i.test(s)) || '';
  const open = (section.match(/^- \[ \]/gm) || []).length;
  if (open > 0) {
    findings.push(`${open} acceptance criteria still unchecked in ${storyPath}. Satisfy them or move them to a new story.`);
  }
  // A UI-surface story must ship a real end-to-end test. Presence is mechanical here,
  // authenticity (real input vs a substitute payload) is the qa agent's judgment call.
  const frontmatter = md.split(/\n---/).shift() || md;
  uiSurface = /^ui_surface:\s*true\b/m.test(frontmatter);
  const idMatch = frontmatter.match(/^id:\s*(\S+)/m);
  storyId = idMatch ? idMatch[1] : null;
  acNums = [...section.matchAll(/^- \[[ x]\]\s*\**AC(\d+)/gim)].map((m) => m[1]);
} else {
  warnings.push(`story file not found: ${storyPath || '(none given)'}`);
}

// 2. A test script should exist once the app does (code/* slots, root fallback)
const pkgDirs = [];
if (existsSync('code')) {
  for (const d of readdirSync('code')) {
    if (existsSync(`code/${d}/package.json`)) pkgDirs.push(`code/${d}`);
  }
}
if (pkgDirs.length === 0 && existsSync('package.json')) pkgDirs.push('.');
if (pkgDirs.length > 0) {
  let hasTest = false;
  for (const d of pkgDirs) {
    try {
      const pkg = JSON.parse(readFileSync(`${d}/package.json`, 'utf8'));
      if (pkg.scripts && pkg.scripts.test) hasTest = true;
    } catch {
      warnings.push(`${d}/package.json is not valid JSON`);
    }
  }
  if (!hasTest) warnings.push('no "test" script in any package yet');
}

// 3. Scan the branch diff for secrets and orphan TODOs.
// v2, finding 7: resolve the real default branch instead of hardcoding main,
// and include untracked files, a secret in a brand-new file used to slip past
// a diff that only saw tracked changes.

// The default branch, from origin's HEAD when known, else the first of
// main/master that exists, else empty (a fresh repo with no base).
function defaultBranch() {
  const sym = sh('git symbolic-ref --short refs/remotes/origin/HEAD').trim();
  if (sym) return sym.replace(/^origin\//, '');
  for (const b of ['main', 'master']) {
    if (sh(`git rev-parse --verify ${b}`).trim()) return b;
  }
  return '';
}

const base = defaultBranch();
const diff = (base && sh(`git diff ${base}...HEAD`)) || sh('git diff HEAD') || sh('git diff');
const added = diff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1));

// Untracked files the diff cannot see. Read each and scan every line as added.
// Skip anything large or binary so the gate stays fast and never chokes.
const untracked = sh('git ls-files --others --exclude-standard').split('\n').filter(Boolean);
for (const file of untracked) {
  try {
    const buf = readFileSync(file);
    if (buf.length > 256 * 1024 || buf.includes(0)) continue; // large or binary
    for (const line of buf.toString('utf8').split('\n')) added.push(line);
  } catch { /* unreadable, skip */ }
}

const secretRe = /(AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:api[_-]?key|secret|password|token)\s*[:=]\s*['"][^'"]{8,}['"])/i;
for (const line of added) {
  if (secretRe.test(line)) findings.push(`possible hardcoded secret: ${line.trim().slice(0, 80)}`);
}

// A TODO is exempt when it names the work it belongs to, either a story (S-001) or
// a task inside one (S-001-T3).
const orphanTodos = added.filter((l) => /\b(TODO|FIXME)\b/.test(l) && !/S-\d+(-T\d+)?/.test(l)).length;
if (orphanTodos > 0) warnings.push(`${orphanTodos} TODO/FIXME without an S-NNN or S-NNN-TN reference`);

// Acceptance criteria should be traceable to the tests that prove them. The convention
// is that a test title carries the criterion id, test('S-001-AC1 rejects an oversized
// file'). That makes coverage greppable and makes a runner's failure output name the
// criterion that broke. This is a warning, never a hard fail. A brownfield app has a
// suite full of untagged tests that genuinely cover the work, and "no test names AC2"
// is a fact about titles, not a verdict on whether AC2 is met. That call is qa's.
if (storyId && acNums.length > 0) {
  const uncovered = acNums.filter((n) => {
    const token = `${storyId}-AC${n}`;
    if (added.some((l) => l.includes(token))) return false;
    return !sh(`git grep -F -l -- ${JSON.stringify(token)}`).trim();
  });
  if (uncovered.length > 0) {
    const list = uncovered.map((n) => `${storyId}-AC${n}`).join(', ');
    warnings.push(`no test title names ${list}. Name the criterion in the test that proves it.`);
  }
}

// A ui_surface story must carry a real browser end-to-end test (the UI verification
// clause, docs/PROTOCOL.md). Look for a Playwright signal in the added lines or an
// e2e spec / playwright config anywhere in the tree. Presence only, qa judges whether
// it drives the real input path. Missing entirely is a hard fail.
if (uiSurface) {
  const addedSignal = added.some((l) => /@playwright\/test|playwright|\.(spec|e2e)\.|toBeVisible|getByRole|setInputFiles/.test(l));
  const tree = sh('git ls-files').split('\n').filter(Boolean);
  const treeSignal = tree.some((f) => /playwright\.config\.[jt]s$|\.(e2e|spec)\.[jt]sx?$|(^|\/)e2e\//.test(f));
  if (!addedSignal && !treeSignal) {
    findings.push('story is ui_surface but no browser end-to-end test is present. A UI story must be proven through the real input mechanism (Playwright), not an API call. See docs/PROTOCOL.md.');
  }
}

// 6. Roster. The PRD is the id authority, so every story that exists anywhere has
// a PRD entry (docs/PROTOCOL.md, Where stories come from). Enforced here rather
// than left to prose, because prose is what already drifted.
//
// The story under gate is a hard fail. Anything going through the loop after this
// rule exists must be specified, and that is the forcing function. Other orphans
// in the repo are warnings, because a repo that predates this rule has shipped
// stories that will never re-enter the loop and failing their unrelated siblings
// helps nobody. They surface every run until someone backfills them.
if (existsSync('docs/PRD.md')) {
  const prd = readFileSync('docs/PRD.md', 'utf8');
  // Any heading level, an older PRD may not use #### for story blocks.
  const prdIds = [...prd.matchAll(/^#{2,6} +(S-\d+)\b/gm)].map((m) => m[1]);
  const prdSet = new Set(prdIds);

  const dupes = [...new Set(prdIds.filter((id, i) => prdIds.indexOf(id) !== i))];
  if (dupes.length > 0) {
    findings.push(`docs/PRD.md defines ${dupes.join(', ')} more than once. An id is assigned once and never reused, so the next id cannot be derived from this file until that is fixed.`);
  }

  if (storyId && !prdSet.has(storyId)) {
    findings.push(`${storyId} has no entry in docs/PRD.md. The PRD is the id authority, a story with no PRD block has no specification. Write its block (kind, **Added.** marker, acceptance criteria) and an ## Amendments entry, then re-run. See docs/PROTOCOL.md, Where stories come from.`);
  }

  if (existsSync('backlog')) {
    const orphans = [];
    for (const epic of readdirSync('backlog')) {
      let entries = [];
      try {
        entries = readdirSync(`backlog/${epic}`);
      } catch { continue; } // a file, not an epic folder
      for (const f of entries) {
        const m = f.match(/^(S-\d+)\.md$/);
        if (m && m[1] !== storyId && !prdSet.has(m[1])) orphans.push(m[1]);
      }
    }
    if (orphans.length > 0) {
      warnings.push(`${orphans.length} backlog stor${orphans.length === 1 ? 'y has' : 'ies have'} no docs/PRD.md entry (${orphans.sort().join(', ')}). Backfill their PRD blocks, see docs/PROTOCOL.md, Where stories come from.`);
    }
  }
}

// 7. A cancelled story is a decision not to build, so it never reaches a gate.
// Gating one means the loop picked up work someone retired.
if (storyPath && existsSync(storyPath)) {
  const fm = readFileSync(storyPath, 'utf8').split(/\n---/).shift() || '';
  if (/^status:\s*cancelled\b/m.test(fm)) {
    findings.push(`${storyId || storyPath} is cancelled and must not be gated. A cancelled story never builds and never gets a gate file. See docs/PROTOCOL.md, Cancelling work.`);
  }
}

// 8. Gate records are write-once ACROSS cycles, and accumulate WITHIN one.
// The distinction matters and this check used to miss it.
//
// A story that has left the loop (done, or blocked) and is being gated again
// is a second cycle. Its existing verdict still stands and overwriting it
// would destroy the record the new one contradicts, so it rotates.
//
// A story still inside its cycle is a different case. /next writes the gate at
// step 7 and its adversarial review at step 10 can send the story back to the
// builder, so a post-review retry legitimately re-gates a story whose record
// already exists. PROTOCOL's findings-are-appended rule is what carries both
// rounds, one record accumulating rather than two records rotating.
//
// Firing here regardless deadlocked exactly that path, and the error message
// recommended `reopen`, which CONVENTIONS records as the WRONG remedy
// mid-cycle: it resets status to todo, nulls the gate pointer, and writes an
// escape record claiming a defect got past a completed gate when in fact the
// review caught it inside the loop. Observed twice, on S-057 (2026-08-03,
// rotation performed then reverted) and on S-061 (2026-08-04, the loop had to
// move the record aside to run the other checks at all).
const gateExists = storyId && existsSync(`docs/gates/${storyId}.yml`);
if (gateExists) {
  const fm = storyPath && existsSync(storyPath)
    ? (readFileSync(storyPath, 'utf8').split(/\n---/).shift() || '')
    : '';
  const closed = /^status:\s*(done|blocked)\b/m.test(fm);
  if (closed) {
    findings.push(`docs/gates/${storyId}.yml already exists and the story has left the loop. Gate records are write-once across cycles. Rotate it with "node scripts/story.mjs reopen ${storyId} --reason \"...\" --missed-by <value>" before re-gating. See docs/PROTOCOL.md, What a failure leaves behind.`);
  }
  // Mid-cycle, say nothing. The record is completed in place and its findings
  // list carries every round, which is what PROTOCOL means by appended.
}

// 9. A fix story names the defect it closes. Without this a defect that reached
// a human is indistinguishable from a new feature, and no one can later ask
// which gate let it through.
if (storyPath && existsSync(storyPath)) {
  const fm = readFileSync(storyPath, 'utf8').split(/\n---/).shift() || '';
  if (/^kind:\s*fix\b/m.test(fm)) {
    const fixes = (fm.match(/^fixes:\s*(\S+)/m) || [])[1];
    if (!fixes || fixes === 'null' || fixes === 'n/a') {
      findings.push(`${storyId} is kind: fix but names no defect. Set "fixes:" to the story that shipped the defect, or to none when the code predates the pipeline. See docs/PROTOCOL.md, What a failure leaves behind.`);
    } else if (fixes !== 'none' && !/^S-\d+$/.test(fixes)) {
      findings.push(`${storyId} has "fixes: ${fixes}", which is neither an S-NNN story id nor none.`);
    } else if (fixes === storyId) {
      findings.push(`${storyId} lists itself in "fixes:". A fix story names the story it corrects, not itself.`);
    }
  }
}

// Report
for (const w of warnings) console.log(`warn  ${w}`);
for (const f of findings) console.log(`FAIL  ${f}`);
if (findings.length === 0) console.log('gate: pass');
process.exit(findings.length ? 1 : 0);
