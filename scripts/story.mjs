#!/usr/bin/env node
// story.mjs — mechanical state transitions for one story. No LLM, deterministic.
//
// Finding 9: the orchestrator raced agent-owned files, it grepped and committed
// a mid-write plan while hand-editing ROADMAP and story frontmatter. State
// transitions belong in one small deterministic tool, not in prose the loop
// improvises. /next calls this to move a story's status, pr, and gate, to
// update the STATE pointer, and to append the progress log, atomically per file.
//
// No dependencies, node built-ins only (no yaml parser vendored, same as
// phase.mjs). The edits are field-scoped, they touch only the named story's
// block in ROADMAP.yaml and only the frontmatter block in the story file.
//
// Usage:
//   node scripts/story.mjs status S-001 in-progress
//   node scripts/story.mjs pr     S-001 https://github.com/org/repo/pull/5
//   node scripts/story.mjs gate   S-001 docs/gates/S-001.yml
//   node scripts/story.mjs block  S-001 --stage qa --reason "AC2 unmet after 2 retries"
//   node scripts/story.mjs reopen S-001 --reason "upload silently fails" --missed-by qa
//   node scripts/story.mjs state  --current S-001 --last "built S-001" --next "S-002"
//   node scripts/story.mjs log    "S-001 in-review, gate CONCERNS"
//   node scripts/story.mjs event  S-001 --phase qa --status concerns --summary "..." [--epic E01]
//                                       [--round 2] [--facts '{"findings":1}'] [--decision "..."]
//                                       [--model claude-sonnet-5 --tokens 96400 --tool-uses 29 --ms 704000]
//                                       usd is computed from cost.rates in docs/profile.yaml, never passed in
//   node scripts/story.mjs reconcile
//                                       closes phases a crash left open. Run at RESUME FIRST,
//                                       never while a /next is in flight.

import { existsSync, readFileSync, writeFileSync, readdirSync, renameSync, appendFileSync, mkdirSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const p = (rel) => join(ROOT, rel);
const read = (rel) => readFileSync(p(rel), 'utf8');
// Creates the directory first. Found by the test suite on its first run: a
// repo whose docs/gates/ did not exist yet threw a raw ENOENT stack out of
// `block`, which is the same defect already fixed for the event trail and the
// same one every other path avoids by failing through die(). A story that
// blocks is already having a bad run and must still leave its record.
//
// The id is validated separately, in idOr, because a recursive mkdir turns a
// malformed id into a silently created directory. `block oops/S-001` used to
// throw and would otherwise now exit 0 having invented docs/gates/oops/.
const write = (rel, s) => {
  mkdirSync(dirname(p(rel)), { recursive: true });
  writeFileSync(p(rel), s);
};

// Append whole JSONL lines, never onto a partial one. A crash during a previous
// append can leave the trail without its closing newline, and appending straight
// onto that fuses the truncated line and the new event into one unparseable
// line, so the damage spreads from the record that was already lost to the one
// being written. Readers skip a malformed line and count it, which is the right
// behaviour for one casualty and the wrong outcome for two. Costs a single byte
// read of the tail.
function appendLines(rel, objects) {
  mkdirSync(dirname(p(rel)), { recursive: true });
  let lead = '';
  if (existsSync(p(rel))) {
    const { size } = statSync(p(rel));
    if (size > 0) {
      // try/finally because this is the only raw descriptor in the file. The
      // process is one-shot so a leak costs nothing today, which is exactly the
      // reasoning that makes the next caller's leak someone else's bug.
      const fd = openSync(p(rel), 'r');
      try {
        const tail = Buffer.alloc(1);
        readSync(fd, tail, 0, 1, size - 1);
        if (tail[0] !== 0x0a) lead = '\n';
      } finally {
        closeSync(fd);
      }
    }
  }
  appendFileSync(p(rel), `${lead}${objects.map((o) => JSON.stringify(o)).join('\n')}\n`);
}

const STATUSES = ['todo', 'in-progress', 'in-review', 'blocked', 'done', 'cancelled'];
// Where a story can stop. A subset of PHASES, so where stories stall can be
// compared against where the time and the tokens went. It OVERLAPS MISSED_BY
// rather than sharing its vocabulary, and the two diverged when `pr` and
// `record` were added here: a run can stop while pushing, but pushing is not a
// gate, so it can never be the layer that should have caught a defect.
// `pr` and `record` are here because a run can stop in them. Step 9 can fail to
// push and step 12 can fail to write state, and without these tokens `block`
// refused the only stage that was true, so the event trail carried a blocked
// phase that no gate record could name. `pick` is deliberately absent, a story
// that fails before it is picked is not a story that stopped.
const STAGES = ['plan', 'build', 'checks', 'qa', 'security', 'review', 'pr', 'record'];
// Which layer should have caught a defect. `spec` is its own bucket because a
// story built exactly to wrong acceptance criteria is a PRD fault, not a gate
// fault, and charging it to the nearest gate would send you to tune the wrong
// thing. `amend` means the change was not a defect at all.
const MISSED_BY = ['amend', 'checks', 'qa', 'security', 'review', 'spec', 'none'];
// `checks` was called `mechanical` until 2026-08-04. The word meant nothing to
// a reader, so it was renamed to what the step does. Old installs and old gate
// records still carry the old token, so accept it on input and normalise on
// write, and never emit it again. Readers downstream (KaizenBridge parses
// blocked.at_stage) must accept both for the same reason.
const STAGE_ALIASES = { mechanical: 'checks' };
const alias = (v) => (v && STAGE_ALIASES[v]) || v;

// The phases a /next run passes through, in order. Closed set, because the
// clients that render a live stage chip key off these tokens and an unknown one
// has nothing to show. Emitted by `event`, documented in docs/STRUCTURE.md.
const PHASES = ['pick', 'plan', 'build', 'checks', 'qa', 'security', 'pr', 'review', 'record', 'block'];
const EVENT_STATUSES = ['running', 'ok', 'concerns', 'failed', 'skipped', 'blocked'];

function die(msg) {
  console.error(`story: ${msg}`);
  process.exit(1);
}

// Blended rate per million tokens for a model, from the cost.rates block in
// docs/profile.yaml. Line-scoped like every other read here, no yaml parser.
//
// The loop must never do this arithmetic itself. A dollar figure computed in
// prose twelve times per story has no check that can catch a slip, and a step
// that forgets the flag would report a confident $0.00, which reads as free
// rather than as unknown. One derived number, derived in one place.
//
// Rate keys are short families (opus, sonnet, haiku) matching the models: table
// in the same file, while events carry full ids like claude-opus-5, so an exact
// key wins and a family substring is the fallback.
function rateFor(model) {
  if (!model) return null;
  const rel = 'docs/profile.yaml';
  if (!existsSync(p(rel))) return null;
  // Scoped to the `cost:` block, then to `rates:` inside it. Searching the whole
  // file for `rates:` took whichever came first, so an unrelated `rates:` under
  // another key silently became the price table, and the regex is not global so
  // nothing said a second one existed. Anchoring on the parent removes both.
  //
  // Each block runs to the next line starting at column zero, or to end of
  // input. `\Z` is NOT a JavaScript anchor, it matches a literal Z, so the
  // original form failed whenever the block was last in the file and every
  // event silently came back unpriced. End of input is `(?![\s\S])`, the only
  // spelling that works under /m. `[ \t]*(?:#.*)?` and not `\s*`, because a
  // trailing comment is ordinary YAML and `\s` would swallow the newline and
  // let the key match mid-line.
  const cost = read(rel).match(/^cost:[ \t]*(?:#.*)?$([\s\S]*?)(?=^\S|(?![\s\S]))/m);
  if (!cost) return null;
  // The rates block is found by INDENT, not by a fixed-width lookahead. A
  // lookahead assuming two-space siblings ended the block at its own first
  // entry when the table was tab-indented, so every event came back unpriced
  // and nothing said why. It also read a numeric sibling key as a rate name
  // under four-space indentation. Comparing each line's indent against the
  // `rates:` line's own indent is agnostic to both, which matters because the
  // rest of these patterns accept tabs everywhere else.
  const lines = cost[1].split('\n');
  const at = lines.findIndex((l) => /^[ \t]*rates:[ \t]*(?:#.*)?$/.test(l));
  if (at === -1) return null;
  const indentOf = (l) => (l.match(/^[ \t]*/) || [''])[0].length;
  const base = indentOf(lines[at]);
  const rates = {};
  for (const line of lines.slice(at + 1)) {
    if (!line.trim()) continue;
    // A line at or left of `rates:` ends the table, it is a sibling or a parent.
    if (indentOf(line) <= base) break;
    const m = line.match(/^[ \t]+([A-Za-z0-9._-]+):[ \t]*([\d.]+)[ \t]*(?:#.*)?$/);
    if (m) rates[m[1]] = Number(m[2]);
  }
  if (rates[model] !== undefined) return rates[model];
  // Longest matching family first, so "claude-sonnet-5" cannot match a shorter
  // key that happens to be a substring of a more specific one.
  const key = Object.keys(rates)
    .filter((k) => model.includes(k))
    .sort((a, b) => b.length - a.length)[0];
  return key ? rates[key] : null;
}

// Find backlog/E0N/S-NNN.md for a story id by scanning the epic subfolders.
function storyPath(id) {
  const base = 'backlog';
  if (!existsSync(p(base))) return null;
  for (const epic of readdirSync(p(base))) {
    const rel = `${base}/${epic}/${id}.md`;
    if (existsSync(p(rel))) return rel;
  }
  return null;
}

// Replace a `key: value` field only inside the block for `- id: <id>` in
// ROADMAP.yaml. The block runs from that id line to the next list item at the
// same indent or shallower, so a field in a sibling story is never touched.
function setRoadmapField(id, key, value) {
  const rel = 'docs/ROADMAP.yaml';
  if (!existsSync(p(rel))) return false;
  const lines = read(rel).split('\n');
  const idRe = new RegExp(`^(\\s*)-\\s+id:\\s*${id}\\b`);
  let start = -1;
  let indent = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(idRe);
    if (m) { start = i; indent = m[1].length; break; }
  }
  if (start === -1) die(`${id} not found in ${rel}`);
  // Block end: next line that is a list item at indent <= the id's indent.
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)-\s+/);
    if (m && m[1].length <= indent) { end = i; break; }
  }
  const fieldRe = new RegExp(`^(\\s*)${key}:\\s*.*$`);
  for (let i = start; i < end; i++) {
    const m = lines[i].match(fieldRe);
    if (m) {
      lines[i] = `${m[1]}${key}: ${value}`;
      write(rel, lines.join('\n'));
      return true;
    }
  }
  die(`field "${key}" not present in ${id} block of ${rel}`);
}

// Replace a `key: value` line inside the leading --- frontmatter of the story.
function setFrontmatterField(id, key, value) {
  const rel = storyPath(id);
  if (!rel) return false;
  const src = read(rel);
  const fm = src.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) die(`${rel} has no frontmatter block`);
  const fieldRe = new RegExp(`^(${key}:\\s*).*$`, 'm');
  // Insert the key when it is absent rather than dying. The frontmatter schema
  // grows over time (kind, fixes) and story files are project state that no
  // update rewrites, so an older story missing a newer key would otherwise kill
  // a command halfway through and leave the story in a partial state.
  const nextFm = fieldRe.test(fm[1])
    ? fm[1].replace(fieldRe, `$1${value}`)
    : `${fm[1]}\n${key}: ${value}`;
  write(rel, src.replace(fm[1], nextFm));
  return true;
}

// Read a frontmatter field from the story file. Null when the story or the
// field is absent, callers decide whether that is fatal.
function getFrontmatterField(id, key) {
  const rel = storyPath(id);
  if (!rel) return null;
  const fm = read(rel).match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return null;
  // Capture the rest of the line, not the first token. `status` is one word but
  // `title` is not, and a truncated title silently corrupted the gate record.
  const m = fm[1].match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  return m ? m[1].trim() : null;
}

// Set a `- key: value` bullet line in STATE.md, tolerant of the current value.
function setStateField(key, value) {
  const rel = 'docs/STATE.md';
  if (!existsSync(p(rel))) die(`${rel} not found`);
  const src = read(rel);
  const re = new RegExp(`^(-\\s*${key}:\\s*).*$`, 'm');
  // Append the bullet when it is absent rather than dying. docs/STATE.md is
  // project state and update.sh never rewrites it, so an install predating a
  // newly added key would otherwise hard-fail mid-run the first time the key
  // is written. This is how `blocked` reaches older installs.
  if (!re.test(src)) {
    write(rel, `${src.replace(/\n*$/, '')}\n- ${key}: ${value}\n`);
    return;
  }
  write(rel, src.replace(re, `$1${value}`));
}

function appendProgress(message) {
  const rel = 'logs/PROGRESS.md';
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const line = `- ${stamp} ${message}\n`;
  write(rel, (existsSync(p(rel)) ? read(rel) : '') + line);
}

// --- CLI -------------------------------------------------------------------

const [cmd, ...rest] = process.argv.slice(2);

function flag(name) {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : null;
}

// Every command below that takes an id builds a file path out of it, and write()
// now creates the directory it is handed. Without this, `block oops/S-001`
// silently invents docs/gates/oops/ and exits 0 where it used to throw. Checked
// once, here, rather than in each of the six commands that would have to
// remember. Deliberately narrow, it rejects a path, not a naming convention,
// because story and epic ids do not share one shape.
const ID_COMMANDS = new Set(['status', 'pr', 'gate', 'block', 'reopen', 'event']);
if (ID_COMMANDS.has(cmd) && rest[0] && /[/\\]|\.\./.test(rest[0])) {
  die(`"${rest[0]}" is not an id. An id never contains a path separator, and treating one as a path would write outside the record it names.`);
}

switch (cmd) {
  case 'status': {
    const [id, value] = rest;
    if (!id || !value) die('usage: status <S-NNN> <status>');
    if (!STATUSES.includes(value)) die(`status must be one of ${STATUSES.join(', ')}`);
    // A shipped story cannot be cancelled. Taking shipped code back out is a
    // removal, real work with its own acceptance criteria and its own gate, so
    // it becomes a new story. Cancelling here would erase a shipped unit from
    // the counts and leave the code in place (docs/PROTOCOL.md, Cancelling work).
    if (value === 'cancelled' && getFrontmatterField(id, 'status') === 'done') {
      die(`${id} is done, a shipped story cannot be cancelled. Removing shipped work is a new story, seed it through /feedback.`);
    }
    // Blocking must carry its evidence, so it goes through `block`, which writes
    // the gate record, the reason, and the STATE pointer together. A story that
    // stopped is the one most worth explaining, and it used to explain the least.
    if (value === 'blocked') {
      die(`use "block ${id} --stage <stage> --reason \\"<one line>\\"" instead. A blocked story must record why it stopped.`);
    }
    setRoadmapField(id, 'status', value);
    setFrontmatterField(id, 'status', value);
    console.log(`story: ${id} status -> ${value}`);
    break;
  }
  case 'pr': {
    const [id, url] = rest;
    if (!id || !url) die('usage: pr <S-NNN> <url>');
    setRoadmapField(id, 'pr', url);
    setFrontmatterField(id, 'pr', url);
    console.log(`story: ${id} pr -> ${url}`);
    break;
  }
  case 'gate': {
    const [id, path] = rest;
    if (!id || !path) die('usage: gate <S-NNN> <gate-file>');
    setRoadmapField(id, 'gate', path);
    setFrontmatterField(id, 'gate', path);
    console.log(`story: ${id} gate -> ${path}`);
    break;
  }
  // Block a story and record why, in one step. Writes the gate file itself
  // rather than filling templates/gate.yml, so the script and the template
  // cannot drift. Before this, a story blocked on exhausted retries produced no
  // gate file at all, because /next blocks at step 5 and gates at step 7.
  case 'block': {
    const [id] = rest;
    const stage = alias(flag('stage'));
    const reason = flag('reason');
    if (!id || !stage || !reason) die('usage: block <S-NNN> --stage <plan|build|checks|qa|security|review> --reason "<one line>"');
    if (!STAGES.includes(stage)) die(`stage must be one of ${STAGES.join(', ')}`);
    if (getFrontmatterField(id, 'status') === 'done') {
      die(`${id} is done. A shipped story is not blocked, re-open it with "reopen ${id}".`);
    }
    const gateRel = `docs/gates/${id}.yml`;
    if (existsSync(p(gateRel))) {
      die(`${gateRel} already exists. Gate records are write-once, rotate it first with "reopen ${id}".`);
    }
    const title = getFrontmatterField(id, 'title') || '<untitled>';
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    write(gateRel, [
      `story: ${id}`,
      `title: ${JSON.stringify(title)}`,
      'verdict: BLOCKED',
      `gated_at: ${stamp}`,
      'tests: n/a',
      'failing_cases: []',
      'acceptance_met: false',
      'ui_verified: n/a',
      'security: n/a',
      'review: n/a',
      'findings: []',
      'escaped: null',
      'blocked:',
      `  at_stage: ${stage}`,
      `  reason: ${JSON.stringify(reason)}`,
      'pr: null',
      `notes: blocked at ${stage}`,
      '',
    ].join('\n'));
    setRoadmapField(id, 'status', 'blocked');
    setFrontmatterField(id, 'status', 'blocked');
    setRoadmapField(id, 'gate', gateRel);
    setFrontmatterField(id, 'gate', gateRel);
    setStateField('blocked', `${id}, ${reason}`);
    appendProgress(`${id} blocked at ${stage}, ${reason}`);
    console.log(`story: ${id} blocked at ${stage}, gate ${gateRel}`);
    break;
  }
  // Rotate a gate record and put the story back in the queue. The only
  // sanctioned way out of blocked or done. Gate files are committed, so git
  // already archives every verdict, what was missing was a path that does not
  // overwrite the record it contradicts (finding 9 forbids hand-edits here).
  case 'reopen': {
    const [id] = rest;
    const reason = flag('reason');
    const missedBy = alias(flag('missed-by'));
    if (!id || !reason || !missedBy) die('usage: reopen <S-NNN> --reason "<one line>" --missed-by <amend|checks|qa|security|review|spec|none>');
    if (!MISSED_BY.includes(missedBy)) die(`missed-by must be one of ${MISSED_BY.join(', ')}`);
    const gateRel = `docs/gates/${id}.yml`;
    if (!existsSync(p(gateRel))) die(`${gateRel} not found, there is no gate to reopen`);
    const prior = read(gateRel);
    const priorVerdict = (prior.match(/^verdict:\s*(\S+)/m) || [])[1] || 'unknown';
    const priorAt = (prior.match(/^gated_at:\s*(.+)$/m) || [])[1] || 'unknown';
    let n = 1;
    while (existsSync(p(`docs/gates/${id}.r${n}.yml`))) n++;
    renameSync(p(gateRel), p(`docs/gates/${id}.r${n}.yml`));
    setRoadmapField(id, 'status', 'todo');
    setFrontmatterField(id, 'status', 'todo');
    setRoadmapField(id, 'gate', 'null');
    setFrontmatterField(id, 'gate', 'null');
    setStateField('blocked', 'none');
    appendProgress(`${id} reopened, prior gate ${priorVerdict} ${priorAt} kept at docs/gates/${id}.r${n}.yml, missed_by ${missedBy}, ${reason}`);
    console.log(`story: ${id} reopened, prior gate -> docs/gates/${id}.r${n}.yml`);
    break;
  }
  case 'state': {
    const current = flag('current');
    const last = flag('last');
    const next = flag('next');
    if (current !== null) setStateField('current', current);
    if (last !== null) setStateField('last action', last);
    if (next !== null) setStateField('next up', next);
    console.log('story: state updated');
    break;
  }
  case 'log': {
    const message = rest.join(' ').trim();
    if (!message) die('usage: log "<message>"');
    appendProgress(message);
    console.log('story: logged');
    break;
  }
  // One phase event. /next calls this twice per phase, once as the phase opens
  // (--status running) and once as it closes. The open event is what lets a
  // client name the phase actually executing, a close-only trail would have a
  // stage chip reading "plan" for the whole of a forty-minute build.
  //
  // logs/PROGRESS.md stays the human trail, one line per story. This is the
  // machine trail, and clients read it instead of scraping runner output.
  case 'event': {
    const [id] = rest;
    const phase = alias(flag('phase'));
    const status = flag('status');
    const summary = flag('summary');
    if (!id || !phase || !status || !summary) {
      die('usage: event <S-NNN> --phase <phase> --status <status> --summary "<one line>" [--epic E0N] [--round N] [--facts \'{}\'] [--decision "..."] [--model M --tokens N --tool-uses N --ms N]');
    }
    if (!PHASES.includes(phase)) die(`phase must be one of ${PHASES.join(', ')}`);
    if (!EVENT_STATUSES.includes(status)) die(`status must be one of ${EVENT_STATUSES.join(', ')}`);

    let facts = {};
    const factsRaw = flag('facts');
    if (factsRaw) {
      try {
        facts = JSON.parse(factsRaw);
      } catch {
        die('--facts must be a JSON object, e.g. --facts \'{"findings":1}\'');
      }
      if (facts === null || typeof facts !== 'object' || Array.isArray(facts)) die('--facts must be a JSON object');
    }

    // `round` only when the phase actually retried. A skipped security pass
    // never ran, so it carries no round, and a first-and-only round says
    // nothing worth a key. Spread in position so the line reads in order.
    const round = flag('round');
    const event = {
      ts: new Date().toISOString(),
      story: id,
      epic: flag('epic') || getFrontmatterField(id, 'epic') || null,
      phase,
      ...(round ? { round: Number(round) } : {}),
      status,
      summary,
      facts,
      decision: flag('decision') || null,
    };

    // Cost rides the close event. Every figure here is measured, reported back
    // by the Agent tool when a subagent finishes, except usd, which is derived
    // from the rate table in docs/profile.yaml and is always tagged as such.
    // A phase that runs no model still carries a real ms, wall clock counts.
    if (status !== 'running') {
      const tokens = Number(flag('tokens') || 0);
      const model = flag('model') || null;
      const rate = rateFor(model);
      // Three honest states, never a confident zero standing in for a gap.
      // none      the phase ran no model, so zero is the true cost.
      // estimated tokens measured, dollars derived against the rate table.
      // unknown   tokens measured but no rate for this model, so usd is null
      //           rather than 0. A projection can skip a null, it cannot
      //           un-add a zero it was told to trust.
      const basis = !tokens ? 'none' : rate === null ? 'unknown' : 'estimated';
      event.cost = {
        model,
        tokens,
        tool_uses: Number(flag('tool-uses') || 0),
        ms: Number(flag('ms') || 0),
        usd: basis === 'estimated' ? Number(((tokens * rate) / 1e6).toFixed(4)) : basis === 'none' ? 0 : null,
        usd_basis: basis,
      };
      if (basis === 'unknown') {
        console.error(`story: no cost.rates entry matches "${model}" in docs/profile.yaml, usd left null for this event`);
      }
    }

    // appendFileSync, not the read-then-write appendProgress uses. This file
    // grows once per phase rather than once per story, and a crash mid-write
    // should cost one line rather than the whole trail.
    // A repo can reach its first event before it has logs/, and every other
    // path here fails through die() rather than a raw ENOENT stack. appendLines
    // creates the directory and refuses to fuse onto a truncated final line.
    appendLines('logs/events.jsonl', [event]);
    console.log(`story: ${id} ${phase}${round ? ` ${round}` : ''} ${status}`);
    break;
  }
  // Close the phases a crash left open. An open event is the load-bearing half
  // of the pair, so a run killed mid-phase leaves `status: running` as the
  // latest word on that story and every client renders it as executing NOW,
  // forever. Nothing else in the loop can notice, because noticing requires a
  // process that outlived the one that died.
  //
  // Only ever run this when no /next is in flight. A genuinely running phase is
  // indistinguishable from an abandoned one by inspection, which is why this is
  // an explicit command at RESUME FIRST and never automatic.
  case 'reconcile': {
    const rel = 'logs/events.jsonl';
    let malformed = 0;
    if (!existsSync(p(rel))) {
      console.log('story: no event trail yet, nothing to reconcile');
      break;
    }
    // Key on story + phase, NOT story + phase + round. `round` is written only
    // when a phase actually retried, so an open and its own close can disagree
    // on whether the key is even present, and a stricter key reads a properly
    // closed retry as abandoned and writes a false `failed` over it.
    //
    // Each key holds a STACK of unmatched opens, not one. Two opens in a row
    // for the same phase is precisely what a crash mid-retry leaves behind, and
    // holding one slot let the second overwrite the first, after which the
    // second's close cleared both and the first stayed `running` forever with
    // no later run able to find it. That is the exact state this command exists
    // to repair, so losing it silently was worse than the bug it replaced. A
    // close pops the most recent open, which is the one it belongs to.
    const open = new Map();
    const push = (k, e) => open.set(k, [...(open.get(k) || []), e]);
    const pop = (k) => {
      const stack = open.get(k);
      if (!stack || !stack.length) return;
      stack.pop();
      if (!stack.length) open.delete(k);
    };
    for (const line of read(rel).split('\n')) {
      if (!line.trim()) continue;
      let e;
      try {
        e = JSON.parse(line);
      } catch {
        // A truncated or corrupt line. Skipping is right, but it means an open
        // event lost this way can never be closed, so say so rather than let
        // the count read as a clean sweep.
        malformed++;
        continue;
      }
      const key = `${e.story}|${e.phase}`;
      if (e.status === 'running') push(key, e);
      else pop(key);
    }
    const abandoned = [...open.values()].flat();
    // Oldest first, so the repair lines read in the order the phases opened.
    abandoned.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
    if (malformed) console.error(`story: ${malformed} unparseable line(s) skipped, an open event lost in one of them cannot be reconciled`);
    if (!abandoned.length) {
      // Never the clean-sweep wording when a line could not be read. An
      // automated resume has only this line to go on and must be able to tell a
      // complete sweep from one that swallowed something unrecoverable.
      console.log(
        malformed
          ? `story: nothing reconcilable found, but ${malformed} line(s) were unparseable, so this sweep is incomplete`
          : 'story: every phase is closed, nothing to reconcile',
      );
      break;
    }
    const closes = abandoned.map((o) => ({
      ts: new Date().toISOString(),
      story: o.story,
      epic: o.epic ?? null,
      phase: o.phase,
      ...(o.round ? { round: o.round } : {}),
      status: 'failed',
      // Named so a reader can tell an interrupted phase from one that ran and
      // failed on its merits. No cost, because none was ever measured.
      summary: 'Phase never closed. The run was interrupted, reconciled at resume.',
      facts: { reconciled: true, opened_at: o.ts },
      decision: null,
    }));
    appendLines(rel, closes);
    for (const c of closes) console.log(`story: closed ${c.story} ${c.phase}${c.round ? ` ${c.round}` : ''}, opened ${c.facts.opened_at}`);
    console.log(
      malformed
        ? `story: reconciled ${closes.length} interrupted phase(s), but ${malformed} line(s) were unparseable, so this sweep is incomplete`
        : `story: reconciled ${closes.length} interrupted phase(s)`,
    );
    break;
  }
  default:
    die(`unknown command "${cmd || ''}". Commands: status, pr, gate, block, reopen, state, log, event, reconcile`);
}
