// render-board.mjs — renders the queue. Combines docs/ROADMAP.yaml with the
// story files under backlog/ and the gate records under docs/gates/ into a
// board and one page per story and per epic.
//
// Spec: docs/BOARD-RENDER-SPEC.md. Called by render-docs.mjs, which owns the
// output directory and the reap, so this module returns pages and never writes.
//
// Who this is for. A project manager reading where the build is, not an
// engineer driving it. That is why the gate reads as sentences rather than a
// field dump, why findings show what and how bad and what happened to them and
// nothing else, and why branch names and file paths do not appear. The terminal
// is one keystroke away for anyone who wants the rest.
//
// Three rules from the spec, restated because they are the ones easy to break:
//
//   Everything is lifted, never invented. A missing gate is "no gate record",
//   never a pass. That single mis-fill is what would turn this into a lie.
//   Absent SECTIONS render nothing. Absent FIELDS inside a record that exists
//   say so, because silence there is indistinguishable from a passing value.
//   Degrade per record. One unreadable story costs that story its page and
//   earns a visible notice, never the whole render.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { esc, inline, mdToHtml, page } from './render-chrome.mjs';

// ---------------------------------------------------------------------------
// YAML. A subset reader, not a parser for the language.
//
// No dependency is vendored, the same call story.mjs made. Unlike story.mjs,
// which reads one scoped block at a time, this needs whole trees, so a line
// scan will not do. Handled: nested maps, block sequences, flow sequences,
// quoted and bare scalars, null/true/false/numbers, and comments outside
// quotes. Not handled and not present in any artifact this reads: anchors,
// multi-document files, block scalars (| and >), and complex keys.
// ---------------------------------------------------------------------------

// A `#` starts a comment only at the start of a line or after whitespace, and
// never inside quotes. A gate finding reads
//   what: "revoke fires before download starts, src/lib/blob.ts:41"
// so a naive split on `#` or on `:` corrupts real data.
function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === '\\' && quote === '"') { i++; continue; }
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '#' && (i === 0 || /[ \t]/.test(line[i - 1]))) {
      return line.slice(0, i).replace(/[ \t]+$/, '');
    }
  }
  return line.replace(/[ \t]+$/, '');
}

const isSeqLine = (t) => t === '-' || /^-[ \t]/.test(t);

// Key, then either an inline value or nothing (a nested block follows).
const KEY_RE = /^(?:"((?:[^"\\]|\\.)*)"|'((?:[^']|'')*)'|([^:]+?))[ \t]*:(?:[ \t]+(.*))?$/;

function splitFlow(body) {
  const out = [];
  let depth = 0;
  let quote = null;
  let cur = '';
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quote) {
      cur += c;
      if (c === '\\' && quote === '"') { cur += body[++i] ?? ''; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; cur += c; continue; }
    if (c === '[' || c === '{') { depth++; cur += c; continue; }
    if (c === ']' || c === '}') { depth--; cur += c; continue; }
    if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim() !== '') out.push(cur.trim());
  return out;
}

function scalar(v) {
  if (v === '' || v === '~' || /^null$/i.test(v)) return null;
  if (/^true$/i.test(v)) return true;
  if (/^false$/i.test(v)) return false;
  if (/^"(?:[^"\\]|\\.)*"$/.test(v)) return v.slice(1, -1).replace(/\\(.)/g, '$1');
  if (/^'(?:[^']|'')*'$/.test(v)) return v.slice(1, -1).replace(/''/g, "'");
  if (/^\[[\s\S]*\]$/.test(v)) return splitFlow(v.slice(1, -1)).map(scalar);
  if (/^\{[\s\S]*\}$/.test(v)) {
    const obj = {};
    for (const pair of splitFlow(v.slice(1, -1))) {
      const at = pair.indexOf(':');
      if (at === -1) continue;
      obj[scalar(pair.slice(0, at).trim())] = scalar(pair.slice(at + 1).trim());
    }
    return obj;
  }
  if (/^-?\d+$/.test(v) || /^-?\d*\.\d+$/.test(v)) return Number(v);
  return v;
}

function parseNode(lines, i, indent) {
  if (isSeqLine(lines[i].text)) return parseSeq(lines, i, indent);
  if (KEY_RE.test(lines[i].text)) return parseMap(lines, i, indent);
  return [scalar(lines[i].text), i + 1];
}

function parseSeq(lines, i, indent) {
  const out = [];
  while (i < lines.length && lines[i].indent === indent && isSeqLine(lines[i].text)) {
    const prefix = lines[i].text.match(/^-[ \t]*/)[0];
    const rest = lines[i].text.slice(prefix.length);
    const item = [];
    if (rest !== '') item.push({ indent: indent + prefix.length, text: rest });
    let j = i + 1;
    while (j < lines.length && lines[j].indent > indent) item.push(lines[j]), j++;
    if (item.length) {
      // The virtual first line's column comes from the dash prefix, which can
      // sit deeper than the item's own continuation lines when the source pads
      // the dash. Align it down so the map's keys are all at one indent.
      const base = Math.min(...item.map((l) => l.indent));
      item[0] = { ...item[0], indent: Math.min(item[0].indent, base) };
      out.push(parseNode(item, 0, item[0].indent)[0]);
    } else {
      out.push(null);
    }
    i = j;
  }
  return [out, i];
}

function parseMap(lines, i, indent) {
  const out = {};
  while (i < lines.length && lines[i].indent === indent && !isSeqLine(lines[i].text)) {
    const m = lines[i].text.match(KEY_RE);
    if (!m) break;
    const key =
      m[1] !== undefined ? m[1].replace(/\\(.)/g, '$1')
        : m[2] !== undefined ? m[2].replace(/''/g, "'")
          : m[3].trim();
    const raw = (m[4] ?? '').trim();
    if (raw !== '') {
      out[key] = scalar(raw);
      i += 1;
      continue;
    }
    const j = i + 1;
    // A nested block is indented deeper, or is a sequence at the same indent,
    // which is ordinary YAML and appears in ROADMAP.yaml under `epics:`.
    if (j < lines.length && (lines[j].indent > indent || (lines[j].indent === indent && isSeqLine(lines[j].text)))) {
      const [value, next] = parseNode(lines, j, lines[j].indent);
      out[key] = value;
      i = next;
    } else {
      out[key] = null;
      i += 1;
    }
  }
  return [out, i];
}

export function parseYaml(text) {
  const lines = [];
  for (const raw of String(text).replace(/\r\n/g, '\n').split('\n')) {
    const line = stripComment(raw);
    if (line.trim() === '') continue;
    if (line.trim() === '---' || line.trim() === '...') continue;
    lines.push({ indent: line.match(/^[ \t]*/)[0].length, text: line.trim() });
  }
  if (!lines.length) return {};
  return parseNode(lines, 0, lines[0].indent)[0];
}

// ---------------------------------------------------------------------------
// Reading the project
// ---------------------------------------------------------------------------

// Split a story's markdown body on `## ` headings. Returns { heading: body }.
function sections(md) {
  const out = {};
  let key = null;
  let buf = [];
  for (const line of String(md).split('\n')) {
    const h = line.match(/^##\s+(.*?)\s*$/);
    if (h) {
      if (key !== null) out[key] = buf.join('\n').trim();
      key = h[1];
      buf = [];
      continue;
    }
    if (key !== null) buf.push(line);
  }
  if (key !== null) out[key] = buf.join('\n').trim();
  return out;
}

// `- [x] **AC1.** the behavior` and its unticked twin. The template's bold id
// is stripped from the text so the id renders in its own column, and the strike
// survives into the render.
//
// A criterion corrected in place opens `~~`. It is retired, not failed, so its
// id is still lifted from inside the strike and it is counted separately. Read
// as unmet it would make an amended story look like a story that missed.
function parseCriteria(md) {
  const out = [];
  for (const line of String(md || '').split('\n')) {
    const m = line.match(/^\s*[-*+]\s+\[( |x|X)\]\s+(.*)$/);
    if (!m) continue;
    let text = m[2].trim();
    let id = '';
    const struck = /^~~/.test(text);
    const body = struck ? text.slice(2) : text;
    const withId = body.match(/^\*\*(AC\d+)\.?\*\*\s*(.*)$/) || body.match(/^(AC\d+)\.\s*(.*)$/);
    if (withId) { id = withId[1]; text = (struck ? '~~' : '') + withId[2]; }
    out.push({ id, met: m[1].toLowerCase() === 'x', struck, text });
  }
  return out;
}

// `- [x] **T1** \`[backend]\` do the thing -> files -> satisfies AC1`.
// The trailing file list is dropped, a project manager does not need it and the
// story file is one click away for anyone who does.
function parseTasks(md) {
  const out = [];
  for (const line of String(md || '').split('\n')) {
    const m = line.match(/^\s*[-*+]\s+\[( |x|X)\]\s+(.*)$/);
    if (!m) continue;
    let text = m[2].trim();
    let id = '';
    let layer = '';
    const withId = text.match(/^\*\*(T\d+)\*\*\s*(.*)$/) || text.match(/^(T\d+)\.?\s+(.*)$/);
    if (withId) { id = withId[1]; text = withId[2]; }
    const withLayer = text.match(/^`\[([a-z]+)\]`\s*(.*)$/) || text.match(/^\[([a-z]+)\]\s*(.*)$/);
    if (withLayer) { layer = withLayer[1]; text = withLayer[2]; }
    text = text.split('->')[0].trim();
    out.push({ id, done: m[1].toLowerCase() === 'x', layer, text });
  }
  return out;
}

function readStoryFile(root, id) {
  const base = join(root, 'backlog');
  if (!existsSync(base)) return null;
  for (const epic of readdirSync(base)) {
    const path = join(base, epic, `${id}.md`);
    if (existsSync(path)) return { path, rel: `backlog/${epic}/${id}.md`, text: readFileSync(path, 'utf8') };
  }
  return null;
}

function parseStoryFile(text) {
  const fm = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!fm) throw new Error('the file has no frontmatter block');
  const front = parseYaml(fm[1]);
  if (!front || typeof front !== 'object') throw new Error('the frontmatter did not read as a map');
  const body = sections(fm[2]);
  return {
    front,
    criteria: parseCriteria(body['Acceptance criteria']),
    tasks: parseTasks(body['Tasks']),
    summary: body['Summary'] || '',
    goal: body['Story'] || '',
    origin: body['Origin'] || '',
    notes: body['Notes'] || '',
    openQuestions: body['Open questions'] || '',
    outOfScope: body['Out of scope'] || '',
  };
}

function readGate(root, relOrNull, id) {
  const rel = relOrNull || `docs/gates/${id}.yml`;
  const path = join(root, rel);
  if (!existsSync(path)) return { rel, present: false, data: null, error: null };
  try {
    const data = parseYaml(readFileSync(path, 'utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('the file did not read as a map');
    return { rel, present: true, data, error: null };
  } catch (e) {
    return { rel, present: true, data: null, error: e.message };
  }
}

/**
 * Read the queue. Returns null when the project has no roadmap yet, which is
 * the ordinary state before /plan has run and is not an error.
 */
export function readBoard(root) {
  const roadmapRel = 'docs/ROADMAP.yaml';
  const roadmapPath = join(root, roadmapRel);
  if (!existsSync(roadmapPath)) return null;

  let roadmap;
  try {
    roadmap = parseYaml(readFileSync(roadmapPath, 'utf8'));
  } catch (e) {
    return { epics: [], stories: [], problems: [`${roadmapRel} could not be read, ${e.message}`] };
  }
  const problems = [];
  const rawEpics = Array.isArray(roadmap?.epics) ? roadmap.epics : [];
  if (!rawEpics.length) problems.push(`${roadmapRel} lists no epics`);

  const epics = [];
  const stories = [];
  for (const e of rawEpics) {
    if (!e || !e.id) { problems.push(`${roadmapRel} carries an epic with no id, skipped`); continue; }
    const epic = {
      id: String(e.id),
      title: e.title ? String(e.title) : '',
      goal: e.goal ? String(e.goal) : '',
      pr: e.pr || null,
      gate: readGate(root, typeof e.gate === 'string' ? e.gate : null, String(e.id)),
      stories: [],
    };
    for (const s of Array.isArray(e.stories) ? e.stories : []) {
      if (!s || !s.id) { problems.push(`${epic.id} carries a story with no id, skipped`); continue; }
      const id = String(s.id);
      const story = {
        id,
        epic: epic.id,
        title: s.title ? String(s.title) : '',
        status: s.status ? String(s.status) : 'todo',
        depends_on: Array.isArray(s.depends_on) ? s.depends_on.map(String) : [],
        autonomy: s.autonomy ? String(s.autonomy) : null,
        pr: s.pr || null,
        gate: readGate(root, typeof s.gate === 'string' ? s.gate : null, id),
        file: null,
        error: null,
      };
      const raw = readStoryFile(root, id);
      if (!raw) {
        story.error = 'no story file under backlog/';
      } else {
        try {
          story.file = parseStoryFile(raw.text);
          story.rel = raw.rel;
        } catch (err) {
          // Degrade per record. This story loses its detail and says so, the
          // rest of the board is unaffected.
          story.error = `${raw.rel} could not be read, ${err.message}`;
        }
      }
      if (story.error) problems.push(`${id}, ${story.error}`);
      epic.stories.push(story);
      stories.push(story);
    }
    epics.push(epic);
  }
  // The run trail and the currency ride the model so a page renderer never
  // reads the filesystem itself. Absent trail is ordinary, a project that has
  // not built anything has no events.
  const trail = readEvents(root);
  if (trail.malformed) problems.push(`logs/events.jsonl has ${trail.malformed} unreadable line(s), skipped`);
  return {
    project: roadmap?.project ? String(roadmap.project) : '',
    epics,
    stories,
    problems,
    events: trail.events,
    currency: currencyOf(root),
  };
}

// ---------------------------------------------------------------------------
// The run trail, logs/events.jsonl
//
// Second pass, deferred from the first build on Uma's call. Two events per
// phase, one as it opens and one as it closes, so a story's run is read by
// pairing them. Ordered by FILE POSITION and never by parsing `ts`, which
// docs/STRUCTURE.md is explicit about: appends happen in run order, and one
// real repo carries a PROGRESS line stamped 09:40 for a story whose gate reads
// 14:51, so a reader sorting on the stamp reconstructs the run backwards.
// ---------------------------------------------------------------------------

const PHASE_LABEL = {
  pick: 'Picked', plan: 'Plan', build: 'Build', checks: 'Checks', qa: 'QA',
  security: 'Security', pr: 'PR', review: 'Review', record: 'Record', block: 'Blocked',
};

const STATUS_TONE = { ok: 'pass', concerns: 'warn', skipped: '', failed: 'bad', blocked: 'bad' };

export function readEvents(root) {
  const rel = 'logs/events.jsonl';
  const path = join(root, rel);
  if (!existsSync(path)) return { present: false, events: [], malformed: 0 };
  let malformed = 0;
  const events = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    // Degrade per line. A crash mid-write costs one line rather than the file,
    // which is the property the format was chosen for, so a reader that throws
    // on one bad line throws away the whole run instead.
    try { events.push(JSON.parse(line)); } catch { malformed++; }
  }
  return { present: true, events, malformed };
}

// The currency the money is in. `usd` is a schema key and not a claim about the
// currency, so it is never inferred from the field name. Same validation
// scripts/cost.mjs applies, a value that is not a three-letter code falls back
// to USD visibly rather than being silently reinterpreted.
const SYMBOLS = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥' };
function currencyOf(root) {
  const path = join(root, 'docs/profile.yaml');
  if (!existsSync(path)) return 'USD';
  try {
    const code = String(parseYaml(readFileSync(path, 'utf8'))?.cost?.currency || 'USD').toUpperCase();
    return /^[A-Z]{3}$/.test(code) ? code : 'USD';
  } catch {
    return 'USD';
  }
}

const money = (amount, currency) =>
  SYMBOLS[currency] ? `${SYMBOLS[currency]}${amount.toFixed(2)}` : `${amount.toFixed(2)} ${currency}`;

function duration(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return null;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

/**
 * Pair a story's events into phases, in file order. No phase spans another
 * (docs/STRUCTURE.md says so and step 7 exists because of it), so one open at a
 * time is the whole state machine.
 *
 * An open with no close is INTERRUPTED, never a pass. It means the run died
 * mid-phase, or is still going. Rendering it as anything else is the same
 * mis-fill as reading a missing gate as green.
 */
export function phasesOf(events, storyId) {
  const mine = events.filter((e) => e && e.story === storyId);
  const out = [];
  let open = null;
  const push = (o, close) => {
    const reconciled = close?.facts?.reconciled === true;
    out.push({
      phase: o?.phase ?? close?.phase ?? null,
      label: PHASE_LABEL[o?.phase ?? close?.phase] || String(o?.phase ?? close?.phase ?? 'unknown'),
      round: close?.round ?? o?.round ?? null,
      status: close ? String(close.status ?? 'not recorded') : 'interrupted',
      reconciled,
      summary: close?.summary ?? o?.summary ?? '',
      cost: close?.cost ?? null,
    });
  };
  for (const e of mine) {
    if (e.status === 'running') {
      if (open) push(open, null); // a second open means the first never closed
      open = e;
      continue;
    }
    if (open && open.phase === e.phase) { push(open, e); open = null; continue; }
    // A close with no open of its own. Kept rather than dropped, it is still
    // evidence that the phase ran.
    if (open) { push(open, null); open = null; }
    push(null, e);
  }
  if (open) push(open, null);
  return out;
}

// ---------------------------------------------------------------------------
// Placement
// ---------------------------------------------------------------------------

export const COLUMNS = ['Backlog', 'Queued', 'Blocked', 'Running', 'Waits on you', 'Done'];

// The width an empty column keeps. Enough for its name and its short line, and
// small enough that the six tracks still fit the 1084 the content column gives
// them however many come out empty. 116 plus a populated floor of 166 is 946 at
// worst, under 1004 once the five gaps are paid, so the board never gains a
// horizontal scrollbar it did not have before. That floor is the old track
// width, kept on purpose, because 166 was chosen so six columns fit exactly.
// Populated columns take 1fr, so emptying a column hands its width to the ones
// holding cards rather than to a fixed larger card.
const EMPTY_TRACK = '116px';
const FULL_TRACK = 'minmax(166px,1fr)';
// The narrow board scrolls by design, so there a card gets a real width.
const FULL_TRACK_NARROW = 'minmax(240px,260px)';

// An empty column renders in a narrow lane now, so the line has to survive at
// about 148px. Each still says which kind of nothing it is, in fewer words.
const COLUMN_EMPTY = {
  Backlog: 'Nothing waiting.',
  Queued: 'Nothing ready.',
  Blocked: 'Nothing blocked.',
  Running: 'Nothing running.',
  'Waits on you': 'Nothing for you.',
  Done: 'Nothing shipped.',
};

// Statuses come from the files. The one derived placement is Queued, a
// readiness view, because ROADMAP.yaml carries no such status. A todo story is
// Queued when every dependency is resolved, else Backlog. Cancelled counts as
// resolved, it never builds so it can never unblock anything by being built.
//
// This mapping is lifted from KaizenBridge's Board (code/frontend/src/tabs/
// board/Board.tsx, columnOf), which is where the reading of PROTOCOL's stacked
// chain rule was worked out. One difference. That client could not admit a
// dependency that is in-review with a passing gate, because its board had file
// paths and not verdicts. This render reads the gate files anyway, so it can.
export function columnOf(story, all) {
  if (story.status === 'in-review') return 'Waits on you';
  if (story.status === 'in-progress') return 'Running';
  if (story.status === 'blocked') return 'Blocked';
  if (story.status === 'done' || story.status === 'cancelled') return 'Done';
  const resolved = (dep) => {
    const d = all.find((s) => s.id === dep);
    if (!d) return false; // an unknown dependency is not proof of readiness
    if (d.status === 'done' || d.status === 'cancelled') return true;
    if (d.status === 'in-review') {
      const v = d.gate.present && d.gate.data ? String(d.gate.data.verdict || '') : '';
      return v === 'PASS' || v === 'CONCERNS';
    }
    return false;
  };
  return story.depends_on.every(resolved) ? 'Queued' : 'Backlog';
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const VERDICT_TONE = { PASS: 'pass', CONCERNS: 'warn', WAIVED: 'warn', FAIL: 'bad', BLOCKED: 'bad' };

const chip = (text, cls = '') => `<span class="chip${cls ? ` ${cls}` : ''}">${esc(text)}</span>`;

// The one mis-fill that would make this a lie has its own function. A story
// with no gate file says which kind of nothing it is, and never nothing at all.
function gateChip(story) {
  if (!story.gate.present) {
    if (story.status === 'cancelled') return chip('no gate, cancelled');
    if (story.status === 'done') return chip('no gate record', 'bad');
    return chip('no gate');
  }
  if (!story.gate.data) return chip('gate unreadable', 'bad');
  const verdict = story.gate.data.verdict;
  if (verdict === undefined) return chip('gate records no verdict', 'bad');
  if (verdict === null) return chip('gate verdict empty', 'bad');
  return chip(`gate ${String(verdict).toLowerCase()}`, VERDICT_TONE[String(verdict)] || '');
}

// On the board a card sits under a column that already states its status, and
// most cards carry the same defaults, so three chips reading `todo` `no gate`
// `feature` appeared identically on every card and stopped being read. In
// column context the defaults are dropped and only the departures show. An epic
// page has no columns, so it still gets the full set.
//
// `supervised` is the one field worth adding rather than removing. It lives in
// the story frontmatter, it means the overnight runner skips this story and a
// human has to drive it, and it was invisible on the board.
function storyCard(story, here = false, inColumn = false) {
  const chips = [];
  // Cancelled and done share the Done column, so cancelled still has to say so.
  if (!inColumn || story.status === 'cancelled') {
    chips.push(chip(story.status, here ? 'here' : story.status === 'blocked' ? 'warn' : ''));
  }
  const gate = gateChip(story);
  // A plain `no gate` on an ungated story is the expected state and carries no
  // signal. Every other gate chip does, including the `no gate record` that a
  // done story with no gate file gets, which is the one mis-fill this render
  // exists to make loud.
  if (gate && !(inColumn && gate === chip('no gate'))) chips.push(gate);
  if (story.file?.front?.autonomy === 'supervised') chips.push(chip('supervised', 'warn'));
  const kind = story.file?.front?.kind;
  if (kind && !(inColumn && String(kind) === 'feature')) chips.push(chip(String(kind)));
  const pr = story.pr ? `<span class="pr">PR ${esc(prLabel(story.pr))}</span>` : '';
  const why = story.error
    ? `<div class="why">${esc(story.error)}</div>`
    : story.status === 'blocked' && story.gate.data?.blocked?.reason
      ? `<div class="why">${esc(String(story.gate.data.blocked.reason))}</div>`
      : '';
  return `<a class="scard" href="./story-${esc(story.id)}.html">
<div class="ids"><span>${esc(story.epic)}</span><span>/</span><span>${esc(story.id)}</span>${pr}</div>
<div class="t">${esc(story.title || story.id)}</div>
${why}
${chips.length ? `<div class="chips">${chips.join('')}</div>` : ''}
</a>`;
}

function prLabel(url) {
  const m = String(url).match(/\/pull\/(\d+)/);
  return m ? `#${m[1]}` : String(url);
}

const prLink = (url) =>
  `<a href="${esc(String(url))}" target="_blank" rel="noopener">PR ${esc(prLabel(url))}</a>`;

/** The board itself, for the index page. */
export function boardSection(model) {
  const stories = model.stories;
  const done = stories.filter((s) => s.status === 'done').length;
  const buckets = new Map(COLUMNS.map((c) => [c, []]));
  for (const s of stories) buckets.get(columnOf(s, stories)).push(s);

  const cols = COLUMNS.map((name) => {
    const items = buckets.get(name);
    const body = items.length
      ? items.map((s) => storyCard(s, false, true)).join('')
      : `<p class="empty">${esc(COLUMN_EMPTY[name])}</p>`;
    return `<section class="col${items.length ? '' : ' is-empty'}"><div class="col-head"><span class="t">${esc(name)}</span>${items.length ? `<span class="n">${items.length}</span>` : ''}</div>${body}</section>`;
  }).join('');

  // The track list, written here because only this function knows which columns
  // came out empty. An empty column is a fixed narrow lane, a populated one
  // takes a real card width and shares what is left. Both breakpoints are set
  // together, the wide one shares the row and the narrow one scrolls.
  const track = (name) => (buckets.get(name).length ? FULL_TRACK : EMPTY_TRACK);
  const trackNarrow = (name) => (buckets.get(name).length ? FULL_TRACK_NARROW : EMPTY_TRACK);
  const boardStyle = esc(
    `--board-cols:${COLUMNS.map(track).join(' ')};` +
      `--board-cols-narrow:${COLUMNS.map(trackNarrow).join(' ')}`,
  );

  const notice = model.problems.length
    ? `<div class="notice">${model.problems.length} record${model.problems.length === 1 ? '' : 's'} could not be read. ${esc(model.problems.join(' · '))}</div>`
    : '';

  const epicLinks = model.epics.length
    ? `<p class="doc-blurb" style="margin-top:var(--s-sm)">Epics: ${model.epics
        .map((e) => `<a href="./epic-${esc(e.id)}.html">${esc(e.id)}</a>`)
        .join(' · ')}</p>`
    : '';

  // No heading of its own. The page is titled Board and the rail says Board, a
  // third one in the body is the same word three times on one screen.
  return `<p class="doc-blurb">${stories.length} stor${stories.length === 1 ? 'y' : 'ies'} · ${done} done</p>
${notice}
<div class="board" style="${boardStyle}">${cols}</div>
${epicLinks}`;
}

// Dependency order within an epic. A story sorts after everything it depends on
// that lives in the same epic. Declared order is the tie-break and the fallback,
// so a cycle degrades to the roadmap's own order rather than dropping a story.
function inDependencyOrder(stories) {
  const byId = new Map(stories.map((s) => [s.id, s]));
  const out = [];
  const state = new Map();
  const visit = (s) => {
    if (state.get(s.id) === 'done') return;
    if (state.get(s.id) === 'open') return; // cycle, keep the declared order
    state.set(s.id, 'open');
    for (const dep of s.depends_on) {
      const d = byId.get(dep);
      if (d) visit(d);
    }
    state.set(s.id, 'done');
    out.push(s);
  };
  stories.forEach(visit);
  return out;
}

const FOOT = 'Rendered from <code>docs/ROADMAP.yaml</code>, <code>backlog/</code> and <code>docs/gates/</code> · the files stay the source of truth · <code>node scripts/render-docs.mjs</code>';

function epicPage(epic, model, shell) {
  const ordered = inDependencyOrder(epic.stories);
  const rows = ordered.length
    ? `<div class="board" style="grid-template-columns:minmax(0,1fr)">${ordered.map((s) => storyCard(s)).join('')}</div>`
    : '<p class="empty">This epic carries no stories.</p>';

  let gate = '';
  if (epic.gate.present) {
    gate = `<div class="section-lead"><h2>Epic gate</h2></div>${gateFacts(epic.gate, epic.id)}`;
  }
  const pr = epic.pr ? `<p>${prLink(epic.pr)}</p>` : '';

  const done = epic.stories.filter((s) => s.status === 'done').length;
  const body = `${epic.goal ? `<p>${inline(epic.goal)}</p>` : ''}${pr}
<div class="section-lead"><h2>Stories</h2><span class="count">${epic.stories.length} in dependency order · ${done} done</span></div>
${rows}
${gate}`;

  return page({
    title: epic.title || epic.id,
    blurb: epic.id,
    body,
    crumb: '<a href="./index.html">Board</a> · Epic',
    ...shell,
    footer: FOOT,
  });
}

// The gate, as sentences. A field the record does not carry says so, because a
// blank reads exactly like a passing value. A layer that was skipped says
// skipped, never nothing, or a reader cannot tell it from one that ran clean.
function gateFacts(gate, id) {
  if (!gate.present) {
    return `<div class="panel"><p>No gate record at <code>${esc(gate.rel)}</code>. This story has not been gated.</p></div>`;
  }
  if (!gate.data) {
    return `<div class="notice">The gate record at ${esc(gate.rel)} could not be read. ${esc(gate.error || '')}</div>`;
  }
  const g = gate.data;
  const missing = 'not recorded';
  const say = (v) => (v === undefined ? missing : v === null ? missing : String(v));

  const verdict = g.verdict === undefined ? missing : String(g.verdict);
  const tone = VERDICT_TONE[verdict] || '';
  const tests =
    g.tests === undefined ? missing
      : g.tests === 'green' ? 'green'
        : g.tests === 'red'
          ? `red${Array.isArray(g.failing_cases) && g.failing_cases.length ? `, ${g.failing_cases.length} failing` : ''}`
          : say(g.tests);

  const facts = [
    ['Verdict', `<span class="chip ${tone}">${esc(verdict)}</span>`],
    ['Gated', esc(say(g.gated_at))],
    ['Tests', esc(tests)],
    ['Acceptance met', g.acceptance_met === undefined ? missing : g.acceptance_met === true ? 'yes' : g.acceptance_met === false ? 'no' : esc(say(g.acceptance_met))],
    ['UI verified', esc(say(g.ui_verified))],
    ['Security pass', esc(say(g.security))],
    ['Adversarial review', esc(say(g.review))],
  ];
  if (g.blocked && typeof g.blocked === 'object') {
    facts.push(['Blocked at', esc(say(g.blocked.at_stage))]);
    facts.push(['Because', esc(say(g.blocked.reason))]);
  }
  // A waived verdict without its reason is one word and no why, which is the
  // same failure a blank skipped layer would be. The verdict is the loudest
  // thing on the page and a waiver is the only kind a human granted by hand.
  if (g.waiver && typeof g.waiver === 'object' && (g.waiver.reason || g.waiver.approved_by)) {
    facts.push(['Waived because', esc(say(g.waiver.reason))]);
    facts.push(['Waived by', esc(say(g.waiver.approved_by))]);
  }
  // An escape means a defect reached a human. For the reader this page is for,
  // that outranks every other field here, so it gets its own block rather than
  // a row. Absent on almost every gate, and absent renders nothing.
  const e = g.escaped;
  const escapedBlock = e && typeof e === 'object'
    ? `<div class="panel"><div class="h">A defect reached a human</div><ul class="gate-facts">
<li><span class="k">Shipped by</span><span>${esc(say(e.fixes))}</span></li>
<li><span class="k">Found by</span><span>${esc(say(e.found_by))}</span></li>
<li><span class="k">Missed by</span><span>${esc(say(e.missed_by))}</span></li>
<li><span class="k">Reported</span><span>${esc(say(e.reported))}</span></li>
</ul></div>`
    : '';

  const failing = g.tests === 'red' && Array.isArray(g.failing_cases) && g.failing_cases.length
    ? `<div class="panel"><div class="h">Failing cases</div><ul>${g.failing_cases.map((c) => `<li>${esc(String(c))}</li>`).join('')}</ul></div>`
    : '';

  return `<div class="panel"><ul class="gate-facts">${facts
    .map(([k, v]) => `<li><span class="k">${esc(k)}</span><span>${v}</span></li>`)
    .join('')}</ul></div>${escapedBlock}${failing}`;
}

// How the run went, from the paired events. Durations and tokens are measured,
// money is derived and always labelled estimated. Per-phase money is left out
// on purpose, it is engineer detail and the one total is what a reader needs.
function timelineBlock(phases, currency) {
  if (!phases.length) return '';

  const rows = phases.map((p) => {
    const tone = p.status === 'interrupted' ? 'bad' : STATUS_TONE[p.status] ?? '';
    const word = p.reconciled ? 'interrupted' : p.status;
    const bits = [];
    if (p.round && p.round > 1) bits.push(`round ${p.round}`);
    const d = duration(p.cost?.ms);
    if (d) bits.push(d);
    return `<li><span class="k">${esc(p.label)}</span><span>${chip(word, tone)}${bits.length ? ` <span class="meta">${esc(bits.join(' · '))}</span>` : ''}${p.summary ? `<div class="meta">${inline(p.summary)}</div>` : ''}</span></li>`;
  }).join('');

  const priced = phases.filter((p) => p.cost?.usd_basis === 'estimated' && typeof p.cost.usd === 'number');
  const unpriced = phases.filter((p) => p.cost?.usd_basis === 'unknown');
  const tokens = phases.reduce((n, p) => n + (Number(p.cost?.tokens) || 0), 0);
  const ms = phases.reduce((n, p) => n + (Number(p.cost?.ms) || 0), 0);
  const spend = priced.reduce((n, p) => n + p.cost.usd, 0);

  const totals = [];
  if (ms) totals.push(`${duration(ms)} of measured work`);
  if (tokens) totals.push(`${tokens.toLocaleString('en-US')} tokens`);
  if (priced.length) totals.push(`${money(spend, currency)} estimated`);
  // Never a confident total. Every figure covers the subagents only, the loop's
  // own orchestration has no counter, so this is a floor rather than a bill.
  const foot = totals.length
    ? `<p class="meta">${esc(totals.join(' · '))}. Orchestration is not measured, so this is a floor.${unpriced.length ? ` ${unpriced.length} phase${unpriced.length === 1 ? '' : 's'} carr${unpriced.length === 1 ? 'ies' : 'y'} no price, no rate matches the model.` : ''}</p>`
    : '';

  return `<div class="panel"><ul class="gate-facts run">${rows}</ul></div>${foot}`;
}

// The drift record. The story file writes each entry as a six-field pipe line
// with uncapped prose beneath it, which read as a log rather than as a record
// on a page built for a project manager. The fields become the chip treatment
// the findings already use, and the prose stays prose.
//
// A Notes section that does not match the shape renders as plain markdown. The
// format is a convention in templates/story.md, not something this render can
// require, and dropping an entry it failed to parse would lose the drift record
// entirely, which is the one thing this section exists to carry.
const NOTE_RE = /^\s*[-*+]\s+(\d{4}-\d{2}-\d{2})\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*)$/;

function notesBlock(md) {
  if (!md || !md.trim()) return '';
  const lines = String(md).split('\n');
  const entries = [];
  let cur = null;
  let preamble = [];
  for (const line of lines) {
    const m = line.match(NOTE_RE);
    if (m) {
      if (cur) entries.push(cur);
      cur = { date: m[1], round: m[2], rule: m[3], severity: m[4], disposition: m[5], headline: m[6], prose: [] };
      continue;
    }
    if (cur) cur.prose.push(line);
    else preamble.push(line);
  }
  if (cur) entries.push(cur);
  if (!entries.length) return mdToHtml(md);

  const none = (v) => !v || v === '-' || v === '—';
  const one = (e) => {
    const chips = [];
    if (!none(e.rule)) chips.push(chip(e.rule, e.rule === 'D3' || e.rule === 'D4' ? 'warn' : ''));
    if (!none(e.severity)) chips.push(chip(e.severity, SEVERITY_TONE[e.severity] ?? ''));
    if (!none(e.disposition)) chips.push(chip(e.disposition, e.disposition === 'decision-owed' || e.disposition === 'blocked' ? 'warn' : ''));
    const when = none(e.round) ? e.date : `${e.date} · ${e.round}`;
    const prose = e.prose.join('\n').trim();
    return `<div class="finding${e.disposition === 'decision-owed' ? ' owed' : ''}">
<div class="top">${chips.join('')}<span class="meta">${esc(when)}</span></div>
<div class="what">${inline(e.headline)}</div>
${prose ? `<div class="meta">${mdToHtml(prose)}</div>` : ''}
</div>`;
  };
  const lead = preamble.join('\n').trim();
  return `${lead ? mdToHtml(lead) : ''}<div class="panel">${entries.map(one).join('')}</div>`;
}

const SEVERITY_TONE = { high: 'bad', medium: 'warn', low: '' };

function findingsBlock(gate) {
  const list = gate.data && Array.isArray(gate.data.findings) ? gate.data.findings.filter(Boolean) : [];
  if (!list.length) return ''; // an empty list is an absent block
  const owed = list.filter((f) => String(f.outcome || '') === 'decision-owed');
  const rest = list.filter((f) => String(f.outcome || '') !== 'decision-owed');
  const one = (f, isOwed) => `<div class="finding${isOwed ? ' owed' : ''}">
<div class="top">${chip(String(f.severity || 'severity not recorded'), SEVERITY_TONE[String(f.severity)] ?? '')}${chip(String(f.source || 'source not recorded'))}${chip(String(f.outcome || 'outcome not recorded'), isOwed ? 'warn' : '')}</div>
<div class="what">${inline(String(f.what || 'The record carries no text for this finding.'))}</div>
</div>`;
  const owedBlock = owed.length
    ? `<div class="panel"><div class="h">Needs your call</div>${owed.map((f) => one(f, true)).join('')}</div>`
    : '';
  const restBlock = rest.length
    ? `<div class="panel"><div class="h">Settled${owed.length ? '' : ''}</div>${rest.map((f) => one(f, false)).join('')}</div>`
    : '';
  return owedBlock + restBlock;
}

function storyPage(story, model, shell) {
  const epic = model.epics.find((e) => e.id === story.epic);
  // The lead sits above the title, the order the founder's own board used. Epic,
  // id and status first, so a reader knows what they are looking at before they
  // read what it is called.
  const lead = `<div class="story-head"><div class="line"><a href="./epic-${esc(story.epic)}.html">${esc(story.epic)}</a><span>/</span><span>${esc(story.id)}</span><span>—</span><span>${esc(story.status)}</span>${story.pr ? `<span class="pr">${prLink(story.pr)}</span>` : ''}</div></div>`;

  if (story.error) {
    return page({
      title: story.title || story.id,
      blurb: '',
      lead,
      body: `<div class="notice">${esc(story.error)}</div>${gateFacts(story.gate, story.id)}`,
      crumb: '',
      ...shell,
      footer: FOOT,
    });
  }

  const f = story.file;
  const chips = [];
  chips.push(chip(story.status, story.status === 'blocked' ? 'warn' : ''));
  chips.push(gateChip(story));
  if (f.front.kind) chips.push(chip(String(f.front.kind)));
  if (f.front.autonomy) chips.push(chip(String(f.front.autonomy)));
  if (f.front.ui_surface === true) chips.push(chip('ui surface'));
  for (const dep of story.depends_on) chips.push(chip(`needs ${dep}`));

  const blocks = [];
  const rail = [];
  const add = (id, label, html) => {
    if (!html) return;
    rail.push(`<a href="#${id}">${esc(label)}</a>`);
    blocks.push(`<h2 id="${id}">${esc(label)}</h2>${html}`);
  };

  add('summary', 'Summary', f.summary ? mdToHtml(f.summary) : '');

  if (story.status === 'blocked' || f.openQuestions || f.front.confidence != null) {
    const conf = f.front.confidence != null
      ? `<p><strong>Confidence ${esc(String(f.front.confidence))} out of 10</strong></p>`
      : '';
    const q = f.openQuestions
      ? mdToHtml(f.openQuestions)
      : '<p>The story file records no open questions.</p>';
    if (story.status === 'blocked') {
      add('why-blocked', 'Why it is blocked', `<div class="panel">${q}${conf}</div>`);
    } else if (conf) {
      add('confidence', 'Confidence', `<div class="panel">${conf}</div>`);
    }
  }

  add('goal', 'Goal', f.goal ? mdToHtml(f.goal) : '');

  if (f.criteria.length) {
    const items = f.criteria
      .map((c) => {
        const mark = c.struck ? ['open', '—'] : c.met ? ['met', '✓'] : ['open', '○'];
        const tag = c.struck ? ' <span class="chip">struck</span>' : c.met ? '' : ' <span class="chip">not met</span>';
        return `<li><span class="mark ${mark[0]}" aria-hidden="true">${mark[1]}</span><span class="id">${esc(c.id || '')}</span><span>${inline(c.text)}${tag}</span></li>`;
      })
      .join('');
    const live = f.criteria.filter((c) => !c.struck);
    const met = live.filter((c) => c.met).length;
    const struck = f.criteria.length - live.length;
    const count = `${met} of ${live.length} met${struck ? ` · ${struck} struck` : ''}`;
    add('acceptance', 'Acceptance criteria', `<p class="doc-blurb" style="margin-bottom:var(--s-sm)">${count}</p><ul class="ac">${items}</ul>`);
  }

  if (f.tasks.length) {
    const items = f.tasks
      .map((t) => `<li><span class="mark" aria-hidden="true">${t.done ? '✓' : '○'}</span><span class="id">${esc(t.id || '')}</span><span class="layer">${esc(t.layer || '—')}</span><span>${inline(t.text)}</span></li>`)
      .join('');
    const done = f.tasks.filter((t) => t.done).length;
    add('work', 'Work', `<p class="doc-blurb" style="margin-bottom:var(--s-sm)">${done} of ${f.tasks.length} done</p><ul class="tasks">${items}</ul>`);
  }

  add('notes', 'Drift notes', notesBlock(f.notes));
  add('gate', 'Gate', gateFacts(story.gate, story.id) + findingsBlock(story.gate));
  add('run', 'How it ran', timelineBlock(phasesOf(model.events || [], story.id), model.currency || 'USD'));

  const origin = f.origin ? `<p class="origin">${inline(f.origin)}</p>` : '';
  const body = `${origin}
<div class="chips" style="margin-top:var(--s-sm)">${chips.join('')}</div>
<div class="story-body">
<div>${blocks.join('')}</div>
<nav class="rail"><div class="h">On this page</div>${rail.join('')}</nav>
</div>`;

  return page({
    title: story.title || story.id,
    blurb: '',
    lead,
    body,
    crumb: `<a href="./index.html">Board</a> · <a href="./epic-${esc(story.epic)}.html">${esc(epic?.title || story.epic)}</a>`,
    ...shell,
    footer: FOOT,
  });
}

/**
 * Every page this module owns. The caller writes them and keeps the names, and
 * hands in `shell`, the chrome slots (`nav`, `topLink`) that render-docs.mjs
 * builds because it is the only module that knows the whole document set.
 */
export function boardPages(model, shell = {}) {
  const pages = [];
  for (const epic of model.epics) pages.push({ name: `epic-${epic.id}.html`, html: epicPage(epic, model, shell) });
  for (const story of model.stories) pages.push({ name: `story-${story.id}.html`, html: storyPage(story, model, shell) });
  return pages;
}
