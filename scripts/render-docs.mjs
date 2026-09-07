#!/usr/bin/env node
// render-docs.mjs — turns the project's markdown and YAML into styled, structured
// HTML views under docs/html/. The files stay the source of truth (the agents read
// and write them); this is a read-only render layer for the human.
//
// No dependencies, no build. Run: node scripts/render-docs.mjs
// Wired into /design, /architect, /standup, and the record step of /next.
//
// Two things render.
//
//   The documents. Every docs/*.md EXCEPT the machine-contract files named in
//   DENY below. That is the opposite default from the first version, which
//   rendered only a hand-listed set. A hand-maintained list drifts silently,
//   because a doc added to docs/ and left out of the list disappears without a
//   word, and there is no way to tell that from a doc excluded on purpose.
//   Reported upstream by KaizenBridge on 2026-08-06 after the list drifted twice.
//
//   The board. docs/ROADMAP.yaml combined with the story files and the gate
//   records, in scripts/render-board.mjs. Added 2026-08-07 per
//   docs/BOARD-RENDER-SPEC.md. Absent before /plan has run, and its absence is
//   the ordinary early state rather than an error.
//
// This file owns the output directory and the reap. Any *.html in docs/html/
// this run did not produce is deleted, so a doc or a story that goes away does
// not survive as an unreachable page. KaizenBridge carried an orphaned
// IDEAS.html for eleven days that way.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentsRail, esc, mdToHtml, navIcon, page, setProject } from './render-chrome.mjs';
import { readBoard, boardSection, boardPages } from './render-board.mjs';
import { detectPhase } from './phase.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = join(ROOT, 'docs');
const OUT = join(DOCS, 'html');

const readIf = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

// The pipeline as data, the same file /help reads. Absent in an install that
// predates it, and the strip then names the raw phase instead of the step.
const STEPS = (() => {
  try {
    return JSON.parse(readIf(join(DOCS, 'pipeline.json'))).steps || [];
  } catch {
    return [];
  }
})();

// Not rendered. STATE.md is a four-line pointer the loop rewrites every run,
// so a page for it would be stale more often than not and says nothing a reader
// wants. PROTOCOL.md and STRUCTURE.md were here too, by the 2026-07-03 decision
// that machine contracts stay markdown-only. Reversed 2026-08-06: they are the
// two documents a human most needs to read, and being parsed by an agent does
// not stop a person needing them legible. The render is one-directional either
// way, so nothing about the contract changes.
const DENY = new Set(['STATE.md']);

// The narrative walkthrough, hand-authored and shipped with the harness rather
// than rendered from anything. It sits beside docs/style-guide.html, the other
// hand-authored HTML in docs/, and deliberately outside docs/html/, which is a
// generated directory the reap empties of anything this script did not write.
const JOURNEY = 'kaizenos-journey.html';

// Ordering, title and blurb for the docs the harness knows about. Not a gate.
// A docs/*.md absent from here still renders, titled from its filename, which is
// the property the old MANIFEST lacked.
// `group` sorts the index into sections. A reader opening the front door wants
// their own product first. The harness contracts are the same bytes in every
// install and belong under their own heading rather than mixed in at equal
// weight, which is how PROTOCOL ended up sitting beside PRD looking like a
// document this project wrote. Anything unlisted lands in `also`.
const KNOWN = [
  { file: 'PRODUCT.md', title: 'Product', blurb: 'Why this exists and who it is for.', group: 'project', icon: 'product' },
  { file: 'PRD.md', title: 'PRD', blurb: 'Epics and stories with acceptance.', group: 'project', icon: 'prd' },
  { file: 'DESIGN.md', title: 'Design', blurb: 'UI, screens, flows, states.', group: 'project', icon: 'design' },
  { file: 'ARCHITECTURE.md', title: 'Architecture', blurb: 'Stack, data model, system design.', group: 'project', icon: 'architecture' },
  { file: 'DECISIONS.md', title: 'Decisions', blurb: 'Append-only decision log.', group: 'project', icon: 'decisions' },
  { file: 'CONVENTIONS.md', title: 'Conventions', blurb: 'Conventions and harvested lessons.', group: 'project', icon: 'conventions' },
  { file: 'METHODS.md', title: 'Methods', blurb: 'Elicitation methods for the guided phases.', group: 'harness', icon: 'methods' },
  { file: 'PROTOCOL.md', title: 'Protocol', blurb: 'The contract. Modes, drift rules, the feedback loop.', group: 'harness', icon: 'protocol' },
  { file: 'STRUCTURE.md', title: 'Structure', blurb: 'The artifact map. What writes what, and when.', group: 'harness', icon: 'structure' },
  { file: 'UX-PRINCIPLES.md', title: 'UX principles', blurb: 'The principles design mode draws against.', group: 'harness', icon: 'ux' },
  { file: 'BUILD-STANDARDS.md', title: 'Build standards', blurb: 'The code rules the builder writes against and the gates judge by.', group: 'harness', icon: 'standards' },
  { file: 'IDEAS.md', title: 'Ideas', blurb: 'The parking lot. Nothing here is committed.', group: 'project', icon: 'ideas' },
  { file: 'LEARNING.md', title: 'Learning', blurb: 'What the loop learned, harvested per story.', group: 'project', icon: 'learning' },
  { file: 'TRAINING.md', title: 'Training', blurb: 'The curriculum for handing this to a team.', group: 'harness', icon: 'training' },
  { file: 'SHAKEDOWN.md', title: 'Shakedown', blurb: 'Findings from a full run, end to end.', group: 'harness', icon: 'shakedown' },
  { file: 'STANDUP.md', title: 'Standup', blurb: 'Latest morning digest.', group: 'project', icon: 'standup' },
  { file: 'COST.md', title: 'Cost', blurb: 'What the build has cost, per story and per phase.', group: 'project', icon: 'cost' },
];

const GROUPS = [
  { key: 'project', title: 'Your project' },
  { key: 'harness', title: 'The harness' },
  { key: 'also', title: 'Also here' },
];

// Title a doc nobody listed. FIELD-NOTES.md -> Field notes. Doc filenames are
// all caps by convention, so lowercasing is right for words and wrong for the
// acronyms this project is full of, UX, PRD, QA. Short tokens keep their case,
// which is a heuristic and is why KNOWN exists, a listed doc never comes here.
//
// A run of numeric tokens rejoins with the hyphen it was split on, because the
// separator inside a date is not a word break. UPSTREAM-2026-08-07.md came out
// as "Upstream 2026 08 07" until this was here.
function derive(file) {
  const raw = file.replace(/\.md$/, '').split(/[-_\s]+/).filter(Boolean);
  const words = [];
  for (const w of raw) {
    const last = words[words.length - 1];
    if (/^\d+$/.test(w) && last && /^\d+(-\d+)*$/.test(last)) words[words.length - 1] = `${last}-${w}`;
    else words.push(w);
  }
  const title = words
    .map((w, k) => {
      if (/\d/.test(w)) return w;
      if (w.length <= 3 && w === w.toUpperCase()) return w;
      const lower = w.toLowerCase();
      return k === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
    })
    .join(' ');
  return { file, title, blurb: '', group: 'also', icon: 'doc' };
}

// Disk is the source of the set, KNOWN is only the order. Listed docs first in
// their listed order, then anything else alphabetically so a new doc lands in a
// stable place rather than wherever the filesystem happened to return it.
function manifest() {
  const present = readdirSync(DOCS).filter((f) => f.endsWith('.md') && !DENY.has(f));
  const listed = KNOWN.filter((e) => present.includes(e.file));
  const rest = present.filter((f) => !KNOWN.some((e) => e.file === f)).sort();
  return [...listed, ...rest.map(derive)];
}

// The left rail, the same on every page. Two sections, Board then Docs, because
// this is a wrapper over a build and the queue is what a reader opens it for.
//
// This rail names documents. The sections inside one document are the contents
// rail on the page itself, built by contentsRail from the headings the render
// collected, because a PRD's thirteen stories in a 236px column would bury the
// document list they sit under.
//
// Docs carries a submenu, and the submenu only appears on a doc page. Clicking
// Docs from anywhere else lands on the first document, which is PRODUCT.md
// wherever there is one, since KNOWN orders it first. That keeps the whole nav
// static, with no disclosure state to hold and no JavaScript to hold it.
//
// `active` is { kind: 'board' } or { kind: 'doc', file }. Story and epic pages
// are board pages, they sit under the queue and not beside it.
function navFor(docs, hasBoard, active) {
  // Icon then label. The icon is decoration on top of a word that is already
  // there, never the label itself, so the rail still reads with images off and
  // to a screen reader. title carries the label into the collapsed strip, where
  // the words are hidden and the glyph is all that is left.
  const item = (href, label, on, icon) =>
    `<a class="nav-item${on ? ' on' : ''}" href="${href}" title="${esc(label)}"${on ? ' aria-current="page"' : ''}>${navIcon(icon)}<span class="lbl">${esc(label)}</span></a>`;
  const out = [];
  if (hasBoard) out.push(item('./index.html', 'Board', active.kind === 'board', 'board'));
  if (docs.length) {
    const onDoc = active.kind === 'doc';
    // With no board, index.html IS the document index, so Docs points there
    // rather than at the first document and the landing keeps a home.
    out.push(item(hasBoard ? `./${docs[0].out}` : './index.html', 'Docs', onDoc, 'docs'));
    if (onDoc) {
      out.push(
        `<div class="subnav">${docs
          .map((d) => `<a class="${d.file === active.file ? 'on' : ''}" href="./${d.out}" title="${esc(d.title)}"${d.file === active.file ? ' aria-current="page"' : ''}>${navIcon(d.icon)}<span class="lbl">${esc(d.title)}</span></a>`)
          .join('')}</div>`
      );
    }
  }
  return `<nav class="side-nav">${out.join('')}</nav>`;
}

// Who this project is, for the title of its own front door. The word "Docs" is
// what the index said before, which is true of every install and tells a reader
// nothing. PRODUCT.md's h1 and its opening paragraph are the brief the founder
// already wrote, so the page says it back rather than inventing a line.
//
// Falls back to the roadmap's project name, then to the directory. A pipeline
// that has not run yet has no name to show and the old word is right there.
function identity(model) {
  const md = existsSync(join(DOCS, 'PRODUCT.md')) ? readFileSync(join(DOCS, 'PRODUCT.md'), 'utf8') : '';
  const h1 = md.match(/^#\s+(.+)$/m);
  const body = h1 ? md.slice(md.indexOf(h1[0]) + h1[0].length) : '';
  const brief = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))[0];
  const name = (h1 && h1[1].trim()) || model?.project || basename(ROOT);
  return { name: name || 'Docs', brief: brief || '' };
}

// Where the pipeline stands, and the one command that moves it. Read from
// scripts/phase.mjs, the same detector /help signposts with and /next
// dispatches on, so a page and a prompt can never disagree about where you are.
// Rendered above everything on the landing, because a reader opening this at
// 9am wants the next action before a list of documents.
//
// detectPhase names the step that has NOT happened yet, so the label reads as
// what comes next rather than what is finished.
function statusStrip() {
  let info;
  try {
    info = detectPhase();
  } catch {
    return ''; // an install without phase.mjs still renders, one row poorer
  }
  const step = STEPS.find((s) => s.command === info.command);
  const rows = [];
  // wide rows carry a sentence rather than a phrase, so they take the whole
  // grid instead of a third of it.
  const row = (k, v, wide = false) =>
    rows.push(
      `<div class="fd-row${wide ? ' wide' : ''}"><div class="k">${esc(k)}</div><div class="v">${v}</div></div>`
    );

  const stage = step
    ? `${esc(step.name)}<span class="sub">step ${step.n} of ${STEPS.length}</span>`
    : esc(info.phase.charAt(0).toUpperCase() + info.phase.slice(1));
  row('Up next', stage);
  row(
    'Command',
    `<code>${esc(info.command)}</code><span class="sub">${info.guided ? 'guided, needs you' : 'autonomous'}</span>`
  );
  if (info.build) {
    const b = info.build;
    row(
      'Build',
      `${b.done} done · ${b.inReview} in review · ${b.eligible} ready${b.blocked ? ` · <span class="bad">${b.blocked} blocked</span>` : ''}`
    );
  }
  const state = readIf(join(DOCS, 'STATE.md'));
  const last = state.match(/^-\s*last action:\s*(.+)$/im);
  if (last) row('Last action', esc(last[1].trim()), true);
  const blocked = state.match(/^-\s*blocked:\s*(.+)$/im);
  if (blocked && !/^none$/i.test(blocked[1].trim())) row('Blocked', `<span class="bad">${esc(blocked[1].trim())}</span>`);

  return `<div class="front-door">${rows.join('')}</div>`;
}

// What KaizenOS is, for someone who opened the board without knowing.
//
// Not a rail item. The rail is where this app's own pages live, and the journey
// page is not one, it is hand-authored with its own type, its own tokens and its
// own embedded font. Wrapping it in this shell would mean merging two
// stylesheets that both define :root, body and h1, on an 88KB asset, forever.
// So it stays a separate page and stops pretending to be a destination inside
// the nav. It sits beside the theme toggle, says what it is rather than being
// labelled, and carries the outbound arrow, because it does leave.
//
// Conditional on the file, the same derive-from-disk rule the document set
// follows, so an install that predates it shipping has no dead link.
function topLinkFor() {
  if (!existsSync(join(DOCS, JOURNEY))) return '';
  return `<a class="top-link" href="../${JOURNEY}" target="_blank" rel="noopener">Understand the process<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg></a>`;
}

function main() {
  mkdirSync(OUT, { recursive: true });

  // The document set is resolved before anything renders, because the nav on
  // every page names it and the nav is built once.
  const written = manifest()
    .filter((entry) => existsSync(join(DOCS, entry.file)))
    .map((entry) => ({ ...entry, out: entry.file.replace(/\.md$/, '.html') }));

  // The board. Null before /plan has run, which is ordinary rather than wrong.
  const model = readBoard(ROOT);
  const hasBoard = Boolean(model);
  // Built once, before anything renders, because every page carries it.
  const topLink = topLinkFor();

  // Who these documents belong to. Set before the first page is built, since
  // the shell puts the name in the wordmark and the tab title of every page,
  // doc and board alike.
  const me = identity(model);
  setProject(me.name);

  for (const entry of written) {
    const md = readFileSync(join(DOCS, entry.file), 'utf8');
    // Every document carries its own contents beside it. A PRD is not one
    // document, it is a section per epic and a section per story, and until the
    // headings were navigable the only way to find S-011 was to scroll for it.
    // The rail is absent on a document too short to need one, and that page
    // keeps the plain reading width rather than an empty column.
    const headings = [];
    const html = mdToHtml(md, { headings, dropFirstH1: true });
    const rail = contentsRail(headings);
    writeFileSync(
      join(OUT, entry.out),
      page({
        title: entry.title,
        blurb: entry.blurb,
        body: rail
          ? `<div class="doc-body"><div class="doc-prose">${html}</div>${rail}</div>`
          : `<div class="doc-prose">${html}</div>`,
        crumb: '',
        nav: navFor(written, hasBoard, { kind: 'doc', file: entry.file }),
        topLink,
        footer: `Rendered from <code>docs/${esc(entry.file)}</code> · markdown stays the source of truth · <code>node scripts/render-docs.mjs</code>`,
      })
    );
  }

  // With no board the index IS the document index, so the rail opens its
  // submenu there rather than showing a single Docs link beside the page it
  // links to. A navigation of one item is not a navigation.
  const boardNav = navFor(written, hasBoard, hasBoard ? { kind: 'board' } : { kind: 'doc', file: null });
  const boardWritten = [];
  if (model) {
    for (const p of boardPages(model, { nav: boardNav, topLink })) {
      writeFileSync(join(OUT, p.name), p.html);
      boardWritten.push(p.name);
    }
  }

  // Index. The front door either way. It carries the project's own name and
  // brief, then where the pipeline stands and the one command that moves it,
  // then the board if there is one and the documents in named groups if there
  // is not. Before this it was titled "Docs" and printed every document as an
  // identical card, which is a folder listing rather than a home page and told
  // a reader nothing about the project they had just opened.
  const rowsFor = (rows) =>
    rows
      .map(
        (r) =>
          `<a href="./${r.out}"><span class="t">${esc(r.title)}</span><span class="b">${esc(r.blurb)}</span></a>`
      )
      .join('');
  const sections = GROUPS.map((g) => {
    const rows = written.filter((r) => (r.group || 'also') === g.key);
    if (!rows.length) return '';
    return `<div class="section-lead"><h2>${esc(g.title)}</h2><span class="count">${rows.length}</span></div><div class="doc-rows">${rowsFor(rows)}</div>`;
  }).join('');
  const docsIndex = written.length
    ? sections
    : '<p>No human-facing docs rendered yet. Run the pipeline first.</p>';

  writeFileSync(
    join(OUT, 'index.html'),
    page({
      title: me.name,
      blurb: me.brief,
      // The strip sits above both bodies. The board keeps its own story count
      // line, which answers a different question than the next command does.
      // The board wants the full width, a document index does not. Capped at
      // the prose plus the rail, so its rules end where a doc page's do.
      body: model
        ? `${statusStrip()}${boardSection(model)}`
        : `<div class="doc-index">${statusStrip()}${docsIndex}</div>`,
      // No crumb. The rail already says where you are, and a trail of one item
      // is not a trail. Story and epic pages keep theirs, they have two.
      crumb: '',
      nav: boardNav,
      topLink,
      // The board arrives with the rail collapsed. It is a six column grid that
      // competes with the rail for width, and the rail's own first item is the
      // page you are already standing on. A document index is prose and keeps
      // its rail, so this turns on only when there is a board to widen.
      railClosed: Boolean(model),
      footer: model
        ? 'Rendered from <code>docs/ROADMAP.yaml</code>, <code>backlog/</code> and <code>docs/gates/</code> · the files stay the source of truth · <code>node scripts/render-docs.mjs</code>'
        : 'Rendered from <code>docs/</code> · markdown stays the source of truth · <code>node scripts/render-docs.mjs</code>',
    })
  );

  // Reap. The renderer only ever wrote, so a doc removed from the set left its
  // page behind, linked from nothing and dated from whenever it last rendered.
  // The keep set must name EVERY page kind this run produced. It once held only
  // the doc pages, which would have deleted each story and epic page on the same
  // run that wrote it.
  const keep = new Set([...written.map((r) => r.out), ...boardWritten, 'index.html']);
  const reaped = readdirSync(OUT).filter((f) => f.endsWith('.html') && !keep.has(f));
  for (const f of reaped) unlinkSync(join(OUT, f));

  const names = written.map((r) => r.title).join(', ') || 'none';
  console.log(`render-docs: ${written.length} doc(s) -> docs/html/  [${names}]`);
  if (model) {
    console.log(
      `render-docs: board ${model.stories.length} stor(y|ies) across ${model.epics.length} epic(s) -> ${boardWritten.length} page(s)`
    );
    for (const p of model.problems) console.log(`render-docs: ${p}`);
  } else {
    console.log('render-docs: no docs/ROADMAP.yaml, board not rendered');
  }
  if (reaped.length) console.log(`render-docs: reaped ${reaped.length} orphan(s)  [${reaped.join(', ')}]`);
}

main();
