// render-chrome.mjs — the page shell every rendered HTML view shares. Markdown
// to HTML, the stylesheet, and the <html> wrapper.
//
// Extracted from render-docs.mjs on 2026-08-07 so the board renderer can use
// the same paint without importing the doc renderer, which would be a cycle.
// Nothing here reads the filesystem or knows what a doc or a story is.
//
// KaizenRise Design System v4 (2026-08-06 revision). Both themes ship. Light is
// the default, per v4 5.1, which makes editorial content light and product UI
// dark, and this is documentation. The reader can override, see THEME below.
//
// No geometry. v4 6.2 made shapes opt-in and most surfaces carry none, the
// orange accent bar alone is a complete brand signal.

// ---------------------------------------------------------------------------
// Markdown -> HTML. Focused on the constructs these docs actually use:
// headings, fenced code, tables, lists (nested), blockquotes, hr, and the
// inline set (code, bold, italic, strike, links). Not a general CommonMark
// engine.
// ---------------------------------------------------------------------------

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function inline(text) {
  // Protect inline code spans first so their contents are not further parsed.
  const codes = [];
  let s = String(text).replace(/`([^`]+)`/g, (_, c) => {
    codes.push(`<code>${esc(c)}</code>`);
    return `${codes.length - 1}`;
  });
  s = esc(s);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
    const href = u.replace(/"/g, '&quot;');
    const ext = /^https?:\/\//.test(u);
    return `<a href="${href}"${ext ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  // Strike. Acceptance criteria that were corrected in place keep their strike,
  // because struck text is evidence of a spec change rather than noise. The doc
  // renderer had no rule for it and printed the tildes literally.
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  s = s.replace(/(^|[\s(])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>');
  s = s.replace(/(^|[\s(])_([^_\s][^_]*?)_/g, '$1<em>$2</em>');
  s = s.replace(/(\d+)/g, (_, i) => codes[Number(i)]);
  return s;
}

export const slug = (s) =>
  String(s).toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');

function renderList(items) {
  // items: [{ indent, ordered, text }]. Build nested <ul>/<ol> by indent, keeping
  // each nested list inside its parent <li> so the markup is valid.
  const open = (o) => (o ? '<ol>' : '<ul>');
  const close = (o) => (o ? '</ol>' : '</ul>');
  let html = '';
  const stack = []; // { indent, ordered }
  for (const it of items) {
    if (!stack.length) {
      html += open(it.ordered);
      stack.push(it);
    } else if (it.indent > stack[stack.length - 1].indent) {
      html += open(it.ordered); // nested list, opened inside the still-open <li>
      stack.push(it);
    } else {
      html += '</li>';
      while (stack.length > 1 && it.indent < stack[stack.length - 1].indent) {
        html += close(stack.pop().ordered) + '</li>';
      }
    }
    html += `<li>${inline(it.text)}`;
  }
  html += '</li>';
  while (stack.length) html += close(stack.pop().ordered) + (stack.length ? '</li>' : '');
  return html;
}

// A paragraph whose every line is a `**Label.** value` field. The PRD writes an
// epic as four such lines and a story as two, one per line, and markdown's soft
// wrap joins them into a single block, which is how "Out of scope. ... Depends
// on. S-001" ends up as one run-on sentence. Two lines minimum, so an ordinary
// sentence that merely opens in bold is still a paragraph, and so is a lone
// `**Acceptance criteria**` label, which carries no value and would otherwise
// render as a field row with an empty right-hand side.
const FIELD = /^\*\*([^*]+?)\*\*\s*(.*)$/;
function fieldRows(lines) {
  if (lines.length < 2) return null;
  const rows = lines.map((l) => l.match(FIELD));
  if (rows.some((m) => !m || !m[2].trim())) return null;
  return `<dl class="fields">${rows
    .map((m) => `<dt>${inline(m[1])}</dt><dd>${inline(m[2])}</dd>`)
    .join('')}</dl>`;
}

/**
 * Markdown to HTML.
 *
 * `opts.headings`, when given an array, is filled with { level, id, text } for
 * every heading emitted, in document order. That is what a contents rail is
 * built from, and collecting it here is the only way to be sure the rail's
 * anchors are the ids the document actually carries.
 *
 * `opts.dropFirstH1` drops the document's own opening h1. The page shell prints
 * the title above the body, so rendering the markdown's `# Title` as well put
 * two titles on every doc page.
 */
export function mdToHtml(md, opts = {}) {
  const lines = String(md).replace(/\r\n/g, '\n').replace(/<!--[\s\S]*?-->/g, '').split('\n');
  let html = '';
  let i = 0;
  let para = [];
  // Heading ids are unique per document. slug() is not injective, two sections
  // called Notes collide, and a contents link to a colliding id jumps silently
  // to the wrong one.
  const taken = new Map();
  let firstHeading = true;
  const flushPara = () => {
    if (para.length) {
      html += fieldRows(para) || `<p>${inline(para.join(' '))}</p>`;
      para = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code
    const fence = line.match(/^\s*```(\w*)\s*$/);
    if (fence) {
      flushPara();
      const lang = fence[1];
      const buf = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) buf.push(lines[i++]);
      i++; // closing fence
      html += `<pre><code${lang ? ` class="lang-${lang}"` : ''}>${esc(buf.join('\n'))}</code></pre>`;
      continue;
    }

    // Heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushPara();
      const lvl = h[1].length;
      if (lvl === 1 && firstHeading && opts.dropFirstH1) {
        firstHeading = false;
        i++;
        continue;
      }
      firstHeading = false;
      const base = slug(h[2]) || 'section';
      const n = (taken.get(base) ?? 0) + 1;
      taken.set(base, n);
      const id = n === 1 ? base : `${base}-${n}`;
      html += `<h${lvl} id="${id}">${inline(h[2])}</h${lvl}>`;
      if (opts.headings) opts.headings.push({ level: lvl, id, text: h[2] });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flushPara();
      html += '<hr>';
      i++;
      continue;
    }

    // Table
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      flushPara();
      const cells = (r) => r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
      const head = cells(line);
      i += 2;
      let t = '<div class="table-wrap"><table><thead><tr>';
      head.forEach((c) => (t += `<th>${inline(c)}</th>`));
      t += '</tr></thead><tbody>';
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        const row = cells(lines[i]);
        t += '<tr>' + head.map((_, k) => `<td>${inline(row[k] ?? '')}</td>`).join('') + '</tr>';
        i++;
      }
      t += '</tbody></table></div>';
      html += t;
      continue;
    }

    // Blockquote
    if (/^\s*>\s?/.test(line)) {
      flushPara();
      const buf = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
      html += `<blockquote>${inline(buf.join(' '))}</blockquote>`;
      continue;
    }

    // List (unordered or ordered), with nesting by indent
    if (/^(\s*)([-*+]|\d+\.)\s+/.test(line)) {
      flushPara();
      const items = [];
      while (i < lines.length && /^(\s*)([-*+]|\d+\.)\s+/.test(lines[i])) {
        const m = lines[i].match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
        items.push({ indent: m[1].length, ordered: /\d+\./.test(m[2]), text: m[3] });
        i++;
      }
      html += renderList(items);
      continue;
    }

    // Blank line ends a paragraph
    if (/^\s*$/.test(line)) {
      flushPara();
      i++;
      continue;
    }

    para.push(line.trim());
    i++;
  }
  flushPara();
  return html;
}

// ---------------------------------------------------------------------------
// The shell. One stylesheet, v4 tokens, both themes, no build.
// ---------------------------------------------------------------------------

const FAVICON =
  'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%22-7.7%20-15.4%2088%2088%22%3E%3Cpath%20d%3D%22M37.5795%2057.2715V22.7139H46.0384L34.6859%2010.8169L23.3334%2022.7139L31.7337%2022.7139V25.5374C31.7337%2043.0635%2017.5261%2057.2712%200%2057.2713L1.64266e-06%2019.6917H0.0863986L0.0863994%200L56.7005%202.47468e-06L72.5673%2022.6641L51.7304%2022.6643C64.0531%2028.1042%2072.6538%2040.4308%2072.6538%2054.7665V57.2715L37.5795%2057.2715Z%22%20fill%3D%22%23EF4209%22/%3E%3C/svg%3E';

// Status colors carry meaning and are not the brand accent (v4 5.7). Two of the
// three v4 values do not survive both grounds, so this stylesheet splits them
// by theme. Every ratio below is measured against the ground the token is used
// on, light #F7EBE7 and white #FFFFFC in light theme, dark #0E1124 and
// dark-elevated #181C33 in dark theme.
//
//   positive  light  #1E7A4D  4.56 / 5.31   v4 value, passes
//             dark   #57C88E  8.95 / 8.03   derived, v4's #1E7A4D is 3.51 / 3.15 and fails
//   warning   light  #8C6209  4.65 / 5.42   derived, v4's #B8860B is 2.79 / 3.25 and fails
//             dark   #B8860B  5.74 / 5.15   v4 value, passes
//   critical  light  #C0392B  4.66 / 5.43   v4 value, passes
//             dark   #E8695E  5.88 / 5.28   derived, v4's #C0392B is 3.43 / 3.08 and fails
//
// Two of those are findings against v4 itself rather than against this render.
// v4 5.7 gives one status triple with no ground stated, and #B8860B fails AA on
// the editorial light ground that 5.1 calls the default for docs. Reported to
// Uma on 2026-08-07 for the design system to settle. The design system is not
// edited from this repo.
//
// Status is never signalled by color alone (v4 5.6). Every verdict chip carries
// its word, every criterion carries a glyph.
const CSS = `
:root{
  --orange:#EF4209; --indigo:#18206F;
  --ink:#0B0D1A; --dark:#0E1124; --dark-elev:#181C33;
  --light:#F7EBE7; --white:#FFFFFC;

  --bg:var(--light);
  --surface:var(--white);
  --surface-2:rgba(11,13,26,0.04);
  --text:var(--ink);
  --muted:rgba(11,13,26,0.62);
  --faint:rgba(11,13,26,0.60);
  --hairline:rgba(11,13,26,0.10);
  --link:var(--indigo);
  --link-underline:rgba(24,32,111,0.25);
  --shadow-card:0 4px 8px rgba(0,0,0,0.08);
  --shadow-hover:0 8px 16px rgba(0,0,0,0.10);
  --positive:#1E7A4D; --warning:#8C6209; --critical:#C0392B;

  --font-heading:'Plus Jakarta Sans',system-ui,sans-serif;
  --font-body:'DM Sans',system-ui,sans-serif;
  --font-mono:'DM Mono',ui-monospace,'SF Mono',Menlo,Consolas,monospace;
  --s-2xs:4px; --s-xs:8px; --s-sm:16px; --s-md:32px; --s-lg:64px; --s-xl:96px;
  --r-sm:4px; --r-md:8px; --r-lg:16px; --r-full:9999px;
}
/* Dark tokens live in two places on purpose. The media query is the system
   default and is guarded so an explicit light choice still wins, the attribute
   rule is the reader's explicit choice. No color has its only definition inside
   a media query. */
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --bg:var(--dark);
    --surface:var(--dark-elev);
    --surface-2:rgba(255,255,255,0.04);
    --text:var(--light);
    --muted:rgba(255,255,255,0.62);
    --faint:rgba(255,255,255,0.60);
    --hairline:rgba(255,255,255,0.08);
    --link:#9AA0C9;
    --link-underline:rgba(154,160,201,0.35);
    --shadow-card:none;
    --shadow-hover:none;
    --positive:#57C88E; --warning:#B8860B; --critical:#E8695E;
  }
}
:root[data-theme="dark"]{
  --bg:var(--dark);
  --surface:var(--dark-elev);
  --surface-2:rgba(255,255,255,0.04);
  --text:var(--light);
  --muted:rgba(255,255,255,0.62);
  --faint:rgba(255,255,255,0.60);
  --hairline:rgba(255,255,255,0.08);
  --link:#9AA0C9;
  --link-underline:rgba(154,160,201,0.35);
  --shadow-card:none;
  --shadow-hover:none;
  --positive:#57C88E; --warning:#B8860B; --critical:#E8695E;
}
*{box-sizing:border-box;}
/* Reserve the scrollbar on every page. Without it a short document has no
   scrollbar and a long one does, and the centred column jumps sideways by the
   scrollbar's width as you move between them. */
html{scroll-behavior:smooth;scrollbar-gutter:stable;}
body{margin:0;font-family:var(--font-body);color:var(--text);background:var(--bg);line-height:1.6;}
.accent{height:5px;background:var(--orange);}
/* App shell. A persistent left nav on every page, because this is a wrapper
   over KaizenOS and not a folder of documents. Board is the first section and
   the landing, Docs is the second and opens its own submenu in the same rail. */
.shell{display:flex;align-items:flex-start;}
.side{position:sticky;top:0;flex:0 0 236px;width:236px;max-height:100vh;overflow-y:auto;padding:var(--s-md) var(--s-sm);border-right:1px solid var(--hairline);}
/* The rail's header. The collapse control is the first thing in it and the
   first thing on the page, left of the wordmark, which is where Gmail puts it.
   Its 16px offset is the rail's own padding and does not change when the rail
   narrows, so the button never moves under the reader's hand. */
.side-top{display:flex;align-items:center;}
.side .brand{display:flex;align-items:center;gap:var(--s-xs);padding:0 8px;color:inherit;text-decoration:none;min-width:0;}
.side-nav{margin-top:var(--s-md);}
.side .brand svg.mark{height:22px;width:auto;}
.side .brand .wordmark{display:flex;flex-direction:column;gap:2px;min-width:0;}
.side .brand .name{font-family:var(--font-heading);font-weight:700;font-size:18px;letter-spacing:-0.02em;line-height:1.1;}
.side-nav{display:flex;flex-direction:column;gap:2px;}
.nav-item{display:flex;align-items:center;gap:9px;padding:7px 10px;border-radius:var(--r-sm);color:var(--muted);text-decoration:none;font-size:15px;}
/* An icon per rail item, so the list reads as a set of places rather than a
   paragraph of links. Stroke only, currentColor, one weight, and always the
   same glyph for the same page, which is the only way an icon is faster to
   find than its own label. */
.nav-item svg,.subnav a svg{flex:none;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;opacity:0.75;}
.nav-item svg{width:17px;height:17px;}
.subnav a svg{width:15px;height:15px;}
.nav-item.on svg,.subnav a.on svg{color:var(--orange);opacity:1;}
.nav-item:hover{color:var(--text);background:var(--surface-2);}
.nav-item.on{color:var(--text);background:var(--surface);font-weight:500;}
.subnav{display:flex;flex-direction:column;gap:1px;margin:2px 0 var(--s-xs) 10px;padding-left:8px;}
.subnav a{display:flex;align-items:center;gap:9px;padding:5px 10px;border-radius:var(--r-sm);color:var(--muted);text-decoration:none;font-size:14px;}
.subnav a:hover{color:var(--text);background:var(--surface-2);}
.subnav a.on{color:var(--text);background:var(--surface);font-weight:500;}
.col-main{flex:1;min-width:0;}
/* One width for every page. It was three, 820 for prose, 1084 for a page with a
   rail, 1280 for the board, all centred in the same column, so the content's
   left edge moved every time you followed a link. The reading measure is held
   by the prose itself now (.doc-prose below), not by the shell. */
/* 820 of text, a 64 gap, a 200 rail. Every page is that column and nothing
   else, so a rule on the index is the same length as a rule in a document and
   the content never moves between pages. The board is the one exception, its
   grid is not prose and says so in the .board rule below. */
/* 1084 of content plus the 32 of padding on each side. Set to 1084 flat, the
   padding came out of the content and a page with a rail rendered its prose at
   756 while a page without one rendered 820. */
.wrap{max-width:1148px;margin:0 auto;padding:var(--s-md) var(--s-md) var(--s-xl);}
header.top{display:flex;align-items:center;gap:var(--s-xs);min-height:32px;margin-bottom:var(--s-md);}
/* The crumb takes the auto margin, not the controls. Give it to the last item
   instead and anything added before it splits the space rather than sitting
   right. */
header.top .crumb{color:var(--muted);font-size:14px;margin-right:auto;}
.top-link{display:inline-flex;align-items:center;gap:6px;font-size:14px;color:var(--muted);text-decoration:none;padding:5px 12px;border:1px solid var(--hairline);border-radius:var(--r-full);white-space:nowrap;}
.top-link:hover{color:var(--orange);border-color:var(--orange);}
.top-link svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;}
header.top .crumb a{color:var(--muted);text-decoration:none;}
header.top .crumb a:hover{color:var(--orange);}
@media (max-width:860px){
  .shell{display:block;}
  .side{position:static;width:auto;flex:none;max-height:none;border-right:none;border-bottom:1px solid var(--hairline);}
  .side-nav{flex-direction:row;flex-wrap:wrap;}
  /* The row is horizontal here, so the active item needs an edge that is not
     the fill. Bottom, not left, which is the one this rail does not use. */
  .nav-item{border-bottom:2px solid transparent;}
  .nav-item.on{border-bottom-color:var(--orange);}
  .subnav{flex-direction:row;flex-wrap:wrap;margin:var(--s-xs) 0 0;padding-left:0;border-top:1px solid var(--hairline);padding-top:var(--s-xs);width:100%;}
}
.theme-toggle,.rail-toggle{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;padding:0;border:1px solid var(--hairline);border-radius:var(--r-full);background:var(--surface);color:var(--muted);cursor:pointer;flex:none;}
/* Bare, unlike the theme toggle, which sits in a row of pills and needs an edge
   to belong to it. This one stands next to the logo, and a filled ring the size
   of the mark reads as a second mark. The hover fill is the whole affordance. */
.rail-toggle{border-color:transparent;background:none;}
.rail-toggle:hover{background:var(--surface-2);}
.theme-toggle{margin-left:var(--s-xs);}

.theme-toggle:hover{color:var(--orange);border-color:var(--orange);}
.rail-toggle:hover{color:var(--orange);}
.theme-toggle:focus-visible,.rail-toggle:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(239,66,9,0.30);}
.theme-toggle svg,.rail-toggle svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;}
/* The rail collapses to a strip, not to nothing. On the board it starts
   collapsed, because that page is a six column grid competing with the rail for
   width and its own first nav item is the page you are already on. Every other
   page starts open. An explicit click is remembered and outranks the per-page
   default from then on.
   What goes is the words. The icons stay, so the destinations stay one click
   away, and the strip is exactly the toggle plus the rail's padding wide, which
   is why nothing in the header moves when it closes. */
@media (min-width:861px){
  /* 32 for the button, the rail's own 16 either side, and the 1 its border
     takes out of the box, so the toggle lands on the same pixel it was on. */
  :root[data-rail="closed"] .side{flex:0 0 65px;width:65px;}
  :root[data-rail="closed"] .side-top{flex-direction:column;align-items:center;}
  :root[data-rail="closed"] .side .brand{padding:var(--s-xs) 0 0;}
  :root[data-rail="closed"] .side .wordmark{display:none;}
  :root[data-rail="closed"] .nav-item{justify-content:center;padding:8px 0;}
  :root[data-rail="closed"] .nav-item .lbl{display:none;}
  /* The submenu is a list of titles. With no titles it is a column of near
     identical page glyphs, so it waits for the rail to open. */
  :root[data-rail="closed"] .subnav{display:none;}
}
/* Narrow, the rail is a strip across the top rather than a column, so closing it
   takes the links away and leaves the header row it lives in. */
@media (max-width:860px){
  :root[data-rail="closed"] .side-nav{display:none;}
}
/* Closing the rail has to hand its width to the content, or the page just grows
   two wider margins and the click appears to do nothing. The prose measure does
   not move, it is held at 820 by .doc-prose and the index blocks are capped in
   their own right, so what actually widens is the board, which is the surface
   that wanted the room. The preference is stored, so every page is still one
   width as you move between them, which is the invariant that mattered. */
:root[data-rail="closed"] .wrap{max-width:1400px;}
/* The icon shows what a click does, not what the theme is. In light you see a
   moon because clicking gets you dark. */
.theme-toggle .sun{display:none;}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]) .theme-toggle .sun{display:block;}
  :root:not([data-theme="light"]) .theme-toggle .moon{display:none;}
}
:root[data-theme="dark"] .theme-toggle .sun{display:block;}
:root[data-theme="dark"] .theme-toggle .moon{display:none;}
:root[data-theme="light"] .theme-toggle .sun{display:none;}
:root[data-theme="light"] .theme-toggle .moon{display:block;}
.doc-title{font-family:var(--font-heading);font-weight:700;letter-spacing:-0.03em;font-size:clamp(28px,5vw,40px);line-height:1.08;margin:0 0 var(--s-xs);}
.doc-blurb{color:var(--muted);margin:0 0 var(--s-md);font-size:17px;}
/* The scale has to keep a section ahead of the labels inside it. It did not:
   h4 was 15px uppercase muted while the bold "Acceptance criteria" nested under
   it was 16px in full text colour, so a story title read as quieter than its
   own field label and a PRD came out as one flat sequence. Every level now
   outranks strong, and the old h4 treatment moved down to h5, which is where a
   caption-weight heading belongs. */
main h1,main h2,main h3,main h4,main h5,main h6{font-family:var(--font-heading);letter-spacing:-0.02em;line-height:1.2;scroll-margin-top:24px;}
main h1{font-size:30px;font-weight:700;margin:var(--s-lg) 0 var(--s-sm);}
main h2{font-size:24px;font-weight:700;margin:var(--s-lg) 0 var(--s-sm);padding-bottom:8px;border-bottom:1px solid var(--hairline);}
main h3{font-size:20px;font-weight:700;margin:var(--s-lg) 0 var(--s-xs);}
main h4{font-size:17px;font-weight:700;margin:var(--s-md) 0 var(--s-xs);}
main h5,main h6{font-size:15px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:var(--muted);margin:var(--s-md) 0 var(--s-xs);}
main p{margin:0 0 var(--s-sm);}
/* Field lines. Label column wide enough for "Acceptance criteria" and the PRD's
   other leads, and it collapses to stacked rows on a narrow page. */
.fields{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:6px var(--s-sm);margin:0 0 var(--s-sm);}
.fields dt{font-weight:600;color:var(--muted);}
.fields dd{margin:0;}
@media (max-width:640px){
  .fields{grid-template-columns:minmax(0,1fr);gap:2px;}
  .fields dd{margin-bottom:var(--s-xs);}
}
/* A document beside its contents. Same geometry as a story page, 820 of prose
   plus the 200px rail, so the reading measure is unchanged by the rail's
   arrival. */
/* The first section of a document opens against the blurb, not 64px below it.
   A section rule earns its space between sections, at the top it is a gap. */
main .doc-prose>:first-child{margin-top:0;}
/* Prose holds its own measure, so a document reads the same whether or not it
   has a contents rail beside it, and whatever the page is wide enough for. */
main .doc-prose{max-width:820px;}
main .doc-body{display:grid;grid-template-columns:minmax(0,820px) 200px;gap:var(--s-lg);align-items:start;}
@media (max-width:1140px){main .doc-body{grid-template-columns:minmax(0,1fr);}main .doc-body .rail{display:none;}}
/* A long document's contents outruns the viewport, so the rail scrolls inside
   itself. Its scrollbar is hidden until the pointer is on it, because two
   scrollbars side by side on one page read as a layout fault. The rail is
   redundant navigation, every heading it lists is reachable by scrolling the
   page, so the affordance costs nothing when it is out of sight. */
.rail.contents{max-height:calc(100vh - var(--s-md));overflow-y:auto;scrollbar-width:thin;scrollbar-color:transparent transparent;}
.rail.contents:hover{scrollbar-color:var(--hairline) transparent;}
.rail.contents::-webkit-scrollbar{width:6px;}
.rail.contents::-webkit-scrollbar-thumb{background:transparent;border-radius:3px;}
.rail.contents:hover::-webkit-scrollbar-thumb{background:var(--hairline);}
.rail.contents a.l3{padding-left:20px;}
.rail.contents a.l4{padding-left:30px;font-size:12px;}
.rail.contents a.on{color:var(--text);border-left-color:var(--orange);}
main a{color:var(--link);text-decoration:none;border-bottom:1px solid var(--link-underline);}
main a:hover{color:var(--orange);border-color:var(--orange);}
main ul,main ol{margin:0 0 var(--s-sm);padding-left:24px;}
main li{margin:4px 0;}
main li>ul,main li>ol{margin:4px 0;}
strong{font-weight:600;}
del{color:var(--muted);}
code{font-family:var(--font-mono);font-size:0.88em;background:var(--surface);border:1px solid var(--hairline);border-radius:var(--r-sm);padding:1px 5px;}
pre{background:var(--ink);color:#E8EAF2;border-radius:var(--r-md);padding:var(--s-sm);overflow-x:auto;margin:0 0 var(--s-sm);}
pre code{background:none;border:none;color:inherit;padding:0;font-size:13px;line-height:1.45;}
blockquote{margin:0 0 var(--s-sm);padding:8px var(--s-sm);border-left:3px solid var(--orange);background:var(--surface);color:var(--muted);border-radius:0 var(--r-sm) var(--r-sm) 0;}
hr{border:none;border-top:1px solid var(--hairline);margin:var(--s-md) 0;}
.table-wrap{overflow-x:auto;margin:0 0 var(--s-sm);}
table{border-collapse:collapse;width:100%;font-size:15px;}
th,td{text-align:left;padding:8px 12px;border-bottom:1px solid var(--hairline);vertical-align:top;}
th{font-family:var(--font-heading);font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:0.03em;color:var(--muted);}
tbody tr:hover{background:var(--surface);}
footer.foot{margin-top:var(--s-xl);padding-top:var(--s-sm);border-top:1px solid var(--hairline);color:var(--faint);font-size:13px;}
footer.foot code{background:none;border:none;padding:0;}
/* The front door's status strip. No surface, no border, no fill. Three facts
   in three columns, each labelled above rather than beside, so the page opens
   on the answer instead of on a box drawn around it. It was a card with an
   orange spine and a rule between every row, which is a lot of furniture for
   three lines of text. Subtraction is the design. */
.doc-index{max-width:820px;}
/* Capped in its own right, so it is the same block on a board landing as on a
   document index, where the board grid beside it is wider. */
.front-door{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--s-md);margin:var(--s-md) 0 var(--s-lg);max-width:820px;}
/* A row whose value is a sentence takes the whole width. In a third of the
   grid a paragraph renders as a ten-word-tall column beside two empty ones. */
.fd-row.wide{grid-column:1 / -1;}
.fd-row .k{font-family:var(--font-heading);font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:var(--muted);margin-bottom:6px;}
.fd-row .v{font-size:16px;}
.fd-row .sub{display:block;color:var(--muted);font-size:13px;margin-top:2px;}
.fd-row .bad{color:var(--critical);}
@media (max-width:760px){.front-door{grid-template-columns:minmax(0,1fr);gap:var(--s-sm);}}
/* docs index. Rows, not tiles. Nine documents fit in the space three rows of
   cards took, and a list of documents reads as a list. */
/* The section lead already draws the line above the first row. Left to itself
   the list drew its own on top of that, two full-width rules 16px apart with
   nothing between them. */
.doc-rows{margin:0 0 var(--s-lg);}
.doc-rows a{display:grid;grid-template-columns:200px minmax(0,1fr);gap:var(--s-sm);padding:11px 0;border-top:1px solid var(--hairline);color:var(--text);text-decoration:none;}
.doc-rows a:first-child{border-top:none;}
.doc-rows a:last-child{border-bottom:1px solid var(--hairline);}
.doc-rows a:hover{color:var(--orange);}
.doc-rows .t{font-family:var(--font-heading);font-weight:600;font-size:16px;}
.doc-rows .b{color:var(--muted);font-size:14px;}
@media (max-width:640px){.doc-rows a{grid-template-columns:minmax(0,1fr);gap:2px;}}
`;

// The board's own rules. Kept next to the shell so one stylesheet ships.
const BOARD_CSS = `
.section-lead{display:flex;align-items:baseline;gap:var(--s-sm);margin:var(--s-lg) 0 var(--s-sm);padding-bottom:8px;border-bottom:1px solid var(--hairline);}
/* The lead owns the rule. main h2 carries one of its own, so without this reset
   every section heading drew two lines 8px apart, the h2's under the words and
   the lead's under the whole row. */
.section-lead h2{font-family:var(--font-heading);font-size:23px;font-weight:600;letter-spacing:-0.02em;margin:0;padding-bottom:0;border-bottom:none;}
.section-lead .count{color:var(--muted);font-size:14px;}
/* Six columns inside the text column. A kanban is not prose, so it is allowed
   the full 1084 the rail reaches, and it scrolls rather than reflowing once
   there is not enough room for a readable card. */
/* The track list is written per render, not fixed here, because six equal
   columns spend the same width on an empty column as on one holding twelve
   cards. At 166px a card title wrapped to three lines while the three columns
   holding nothing each kept a full share of the row. render-board.mjs
   sets --board-cols and --board-cols-narrow once it knows which columns are
   empty. Both breakpoints read a variable so fixing one cannot leave the other
   behind. The fallbacks are the old values, so a board rendered by an older
   script still lays out. */
.board{display:grid;grid-template-columns:var(--board-cols,repeat(6,minmax(166px,1fr)));gap:var(--s-sm);overflow-x:auto;padding-bottom:var(--s-xs);}
@media (max-width:1000px){.board{grid-template-columns:var(--board-cols-narrow,repeat(6,minmax(200px,220px)));}}
/* An empty column is a label, not a lane. It keeps its name and its ground so
   the six columns still read as one row, and gives its width back. */
.col.is-empty{padding:var(--s-xs) 10px;}
.col.is-empty .col-head{margin-bottom:6px;}
.col.is-empty .col-head .t{font-size:13px;color:var(--muted);}
.col.is-empty .empty{font-size:12px;line-height:1.4;}
.col{background:var(--surface-2);border-radius:var(--r-md);padding:var(--s-sm);min-width:0;}
.col-head{display:flex;align-items:center;gap:var(--s-xs);margin-bottom:var(--s-sm);}
.col-head .t{font-family:var(--font-heading);font-weight:600;font-size:15px;}
.col-head .n{font-size:12px;color:var(--muted);background:var(--surface);border:1px solid var(--hairline);border-radius:var(--r-full);padding:0 7px;}
.col .empty{color:var(--faint);font-size:13px;}
.scard{display:block;background:var(--surface);border:1px solid var(--hairline);border-radius:var(--r-md);padding:12px;margin-bottom:var(--s-xs);text-decoration:none;color:var(--text);transition:box-shadow 150ms,transform 150ms;}
.scard:hover{box-shadow:var(--shadow-hover);transform:translateY(-1px);border-color:rgba(239,66,9,0.4);}
.scard .ids{display:flex;align-items:center;gap:6px;font-family:var(--font-mono);font-size:12px;color:var(--muted);margin-bottom:6px;white-space:nowrap;}
.scard .ids span{flex:none;}
.scard .ids .pr{margin-left:auto;color:var(--link);}
.scard .t{font-family:var(--font-heading);font-weight:600;font-size:15px;line-height:1.3;letter-spacing:-0.01em;}
.scard .why{color:var(--muted);font-size:13px;margin-top:6px;}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;}
.chip{font-size:12px;line-height:1.6;padding:1px 8px;border-radius:var(--r-full);background:var(--surface-2);color:var(--muted);border:1px solid var(--hairline);white-space:nowrap;}
.chip.pass{color:var(--positive);border-color:currentColor;}
.chip.warn{color:var(--warning);border-color:currentColor;}
.chip.bad{color:var(--critical);border-color:currentColor;}
.chip.here{background:var(--ink);color:var(--white);border-color:var(--ink);}
:root[data-theme="dark"] .chip.here{background:var(--light);color:var(--ink);border-color:var(--light);}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) .chip.here{background:var(--light);color:var(--ink);border-color:var(--light);}}
/* story page */
.story-head{margin-bottom:var(--s-md);}
.story-head .line{display:flex;align-items:center;gap:8px;font-family:var(--font-mono);font-size:13px;color:var(--muted);margin-bottom:var(--s-xs);}
.story-head .line .pr{margin-left:auto;font-family:var(--font-body);}
.story-head .origin{color:var(--muted);font-size:15px;margin:var(--s-xs) 0 0;}
.story-body{display:grid;grid-template-columns:minmax(0,1fr) 200px;gap:var(--s-lg);align-items:start;}
@media (max-width:900px){.story-body{grid-template-columns:minmax(0,1fr);}.rail{display:none;}}
.rail{position:sticky;top:var(--s-sm);font-size:13px;}
.rail .h{font-family:var(--font-heading);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.14em;color:var(--muted);margin-bottom:var(--s-xs);}
.rail a{display:block;padding:4px 0 4px 10px;border:none;border-left:2px solid var(--hairline);color:var(--muted);text-decoration:none;}
.rail a:hover{color:var(--orange);border-left-color:var(--orange);}
.panel{background:var(--surface);border:1px solid var(--hairline);border-radius:var(--r-md);padding:var(--s-sm);margin:0 0 var(--s-sm);}
.panel .h{font-family:var(--font-heading);font-weight:600;font-size:15px;margin-bottom:var(--s-xs);}
.ac{list-style:none;padding:0;margin:0;}
.ac li{display:grid;grid-template-columns:20px 44px minmax(0,1fr);gap:8px;margin:0 0 10px;align-items:baseline;}
.ac .mark{font-family:var(--font-mono);}
.ac .mark.met{color:var(--positive);}
.ac .mark.open{color:var(--faint);}
.ac .id{font-family:var(--font-mono);font-size:13px;color:var(--muted);}
.tasks{list-style:none;padding:0;margin:0;}
.tasks li{display:grid;grid-template-columns:20px 32px auto minmax(0,1fr);gap:8px;margin:0 0 8px;align-items:baseline;}
.tasks .layer{font-family:var(--font-mono);font-size:12px;color:var(--muted);background:var(--surface-2);border-radius:var(--r-sm);padding:0 6px;}
.gate-facts{list-style:none;padding:0;margin:0;}
.gate-facts li{display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--hairline);font-size:15px;}
.gate-facts li:last-child{border-bottom:none;}
.gate-facts .k{color:var(--muted);min-width:140px;}
.gate-facts.run li{align-items:baseline;}
.gate-facts.run .k{min-width:110px;}
.meta{color:var(--muted);font-size:13px;}
.meta p{margin:4px 0 0;}
.finding .top .meta{margin-left:auto;}
.finding{padding:10px 0;border-bottom:1px solid var(--hairline);}
.finding:last-child{border-bottom:none;}
.finding .top{display:flex;flex-wrap:wrap;gap:8px;align-items:baseline;margin-bottom:4px;}
.finding .what{font-size:15px;}
.owed{border-left:3px solid var(--orange);padding-left:12px;}
.notice{background:var(--surface);border:1px solid var(--critical);border-radius:var(--r-md);padding:var(--s-sm);margin:0 0 var(--s-sm);color:var(--critical);font-size:15px;}
`;

const FONTS =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&family=Plus+Jakarta+Sans:wght@600;700&display=swap" rel="stylesheet">';

const LOGO =
  '<svg class="mark" viewBox="-7.7 -15.4 88 88" aria-hidden="true"><path d="M37.5795 57.2715V22.7139H46.0384L34.6859 10.8169L23.3334 22.7139L31.7337 22.7139V25.5374C31.7337 43.0635 17.5261 57.2712 0 57.2713L1.64266e-06 19.6917H0.0863986L0.0863994 0L56.7005 2.47468e-06L72.5673 22.6641L51.7304 22.6643C64.0531 28.1042 72.6538 40.4308 72.6538 54.7665V57.2715L37.5795 57.2715Z" fill="#EF4209"/></svg>';

// Three theme states, not two. No attribute means follow the system. The head
// script runs before the body paints so an explicit choice never flashes the
// other theme first. Everything on the page is readable with JavaScript off,
// the system preference still applies, only the manual toggle is lost.
const THEME_HEAD =
  `<script>(function(){try{var t=localStorage.getItem("kaizenos-theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t);}catch(e){}})();</script>`;

const THEME_BUTTON =
  '<button class="theme-toggle" type="button" aria-label="Switch between light and dark">' +
  '<svg class="sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>' +
  '<svg class="moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>' +
  '</button>';

// The rail's collapsed state, decided the same way the theme is. The page ships
// its own default in the html attribute, so the board arrives collapsed with no
// flash and no JavaScript. A stored choice, written only when the reader clicks,
// overrides that default on every page from then on.
const RAIL_HEAD =
  `<script>(function(){try{var r=localStorage.getItem("kaizenos-rail");if(r==="closed")document.documentElement.setAttribute("data-rail","closed");else if(r==="open")document.documentElement.removeAttribute("data-rail");}catch(e){}})();</script>`;

/**
 * The rail's icon set. One glyph per page kind, drawn on the same 24 grid with
 * the same stroke, so the column reads as one family. `doc` is the fallback and
 * the reason an unlisted document still gets a mark instead of a ragged gap.
 *
 * Names are page kinds, not shapes, so a doc can change its glyph here without
 * every caller learning what a compass was for.
 */
const NAV_ICONS = {
  board: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="11" rx="1"/><rect x="17" y="4" width="4" height="7" rx="1"/>',
  docs: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/><path d="M9 12h7M9 16h7"/>',
  doc: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>',
  product: '<circle cx="12" cy="12" r="9"/><path d="m15.6 8.4-2.2 5.0-5.0 2.2 2.2-5.0z"/>',
  prd: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  design: '<path d="M4 20h4L18.5 9.5a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5 17.5 10.5"/>',
  architecture: '<rect x="3" y="3" width="7" height="6" rx="1"/><rect x="14" y="15" width="7" height="6" rx="1"/><path d="M6.5 9v4.5h11V15"/>',
  decisions: '<circle cx="12" cy="12" r="9"/><path d="m8 12.4 2.6 2.6L16 9.6"/>',
  conventions: '<rect x="2.5" y="9" width="19" height="6" rx="1.5"/><path d="M7.5 9v2.6M12 9v3.4M16.5 9v2.6"/>',
  methods: '<circle cx="7.5" cy="7.5" r="2.6"/><circle cx="16.5" cy="7.5" r="2.6"/><circle cx="7.5" cy="16.5" r="2.6"/><circle cx="16.5" cy="16.5" r="2.6"/>',
  protocol: '<path d="M12 3 19 6v6c0 4-3 7.2-7 9-4-1.8-7-5-7-9V6z"/><path d="m9 12 2 2 4-4"/>',
  structure: '<rect x="9" y="3" width="6" height="5" rx="1"/><rect x="3" y="16" width="6" height="5" rx="1"/><rect x="15" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M6 16v-4h12v4"/>',
  ux: '<path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/>',
  standards: '<path d="M12 3 4 6.2v5.4c0 4.3 3.3 7.9 8 9.4 4.7-1.5 8-5.1 8-9.4V6.2z"/><path d="M8.6 12.2h6.8M8.6 9.2h6.8M8.6 15.2h4"/>',
  ideas: '<path d="M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z"/><path d="M9.5 19h5M10.5 21.5h3"/>',
  learning: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M9 3v15"/>',
  training: '<path d="m12 4-10 4.5 10 4.5 10-4.5z"/><path d="M6.5 11v4.8c0 1.6 2.5 2.9 5.5 2.9s5.5-1.3 5.5-2.9V11"/>',
  shakedown: '<path d="M8.5 3h7"/><path d="M10 3v5.6l-4 8A2 2 0 0 0 7.8 20h8.4a2 2 0 0 0 1.8-3.4l-4-8V3"/>',
  standup: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 2"/>',
  cost: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
};

export function navIcon(name) {
  const d = NAV_ICONS[name] || NAV_ICONS.doc;
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
}

const RAIL_BUTTON =
  '<button class="rail-toggle" type="button" aria-controls="site-rail" aria-label="Show or hide the navigation">' +
  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></svg>' +
  '</button>';

const RAIL_SCRIPT =
  `<script>(function(){var b=document.querySelector(".rail-toggle");if(!b)return;var r=document.documentElement;function s(){b.setAttribute("aria-expanded",r.getAttribute("data-rail")==="closed"?"false":"true");}s();b.addEventListener("click",function(){var c=r.getAttribute("data-rail")==="closed";if(c)r.removeAttribute("data-rail");else r.setAttribute("data-rail","closed");s();try{localStorage.setItem("kaizenos-rail",c?"open":"closed");}catch(e){}});})();</script>`;

const THEME_SCRIPT =
  `<script>(function(){var b=document.querySelector(".theme-toggle");if(!b)return;b.addEventListener("click",function(){var r=document.documentElement,c=r.getAttribute("data-theme"),d=c?c==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches,n=d?"light":"dark";r.setAttribute("data-theme",n);try{localStorage.setItem("kaizenos-theme",n);}catch(e){}});})();</script>`;

/**
 * The contents rail for one document, built from the headings mdToHtml
 * collected. h1 is the document title the shell already prints, so the tree
 * starts at h2 and goes three levels down, which is exactly a PRD's section,
 * epic, story.
 *
 * Returns '' for a document too short to navigate, and the caller then keeps
 * the plain reading width. Three entries is the floor, below that the rail is
 * furniture rather than navigation.
 */
export function contentsRail(headings) {
  const items = headings.filter((h) => h.level >= 2 && h.level <= 4);
  if (items.length < 3) return '';
  const links = items
    .map((h) => `<a class="l${h.level}" href="#${h.id}">${esc(h.text)}</a>`)
    .join('');
  return `<nav class="rail contents"><div class="h">On this page</div>${links}</nav>`;
}

// Marks where the reader is in the contents rail. Decoration only, and the
// whole rail works without it, every link is a plain anchor. Nothing in the
// navigation holds state in JavaScript, which is still true of the left rail
// and now true of this one.
const CONTENTS_SCRIPT =
  `<script>(function(){var r=document.querySelector(".rail.contents");if(!r)return;` +
  `var l=[].slice.call(r.querySelectorAll("a")),t=l.map(function(a){return document.getElementById(a.getAttribute("href").slice(1));});` +
  `var q=false;function u(){q=false;var k=0;for(var j=0;j<t.length;j++){if(t[j]&&t[j].getBoundingClientRect().top<=120)k=j;}` +
  `l.forEach(function(a,j){a.classList.toggle("on",j===k);});}` +
  `addEventListener("scroll",function(){if(!q){q=true;requestAnimationFrame(u);}},{passive:true});u();})();</script>`;

// Which product these pages belong to. The shell used to say KaizenOS in the
// wordmark and in every <title>, which is true of every install and so tells a
// reader nothing about whose PRD is open. With several projects' docs in tabs
// the only in-page label of the product was a sentence of prose in the intro.
//
// The name is set, not read. Resolving it means reading docs/PRODUCT.md and
// this module reads no files, which is the reason it can be shared by the doc
// and board renderers without a cycle. render-docs owns the resolution and
// calls setProject once before anything renders, so board pages get it too
// without threading a parameter through boardPages. Left unset, the shell
// falls back to the harness name and reads exactly as it did before.
const HARNESS = 'KaizenOS';
let PROJECT = '';
export function setProject(name) {
  PROJECT = String(name || '').trim();
}

/**
 * The page wrapper. `body`, `footer`, `lead` and `nav` are trusted HTML the
 * caller already escaped. `lead` sits above the title, which is where a story
 * page puts its epic, id, status and PR. `nav` is the left rail, built once by
 * render-docs.mjs, which is the only module that knows the whole document set.
 * `crumb` is rendered as given and should carry more than one item, since a
 * trail of one repeats what the rail already says.
 */
export function page({
  title,
  blurb,
  body,
  crumb = '',
  footer = '',
  lead = '',
  nav = '',
  topLink = '',
  railClosed = false,
}) {
  // The index is titled with the project's own name, so suffixing it there
  // would say the word twice. The wordmark names the project alone. The harness
  // is the same word in every install, so under the mark it was a label that
  // told a reader nothing and doubled the height of the rail's header.
  const owner = PROJECT || HARNESS;
  const tab = title === owner ? owner : `${title} · ${owner}`;
  return `<!DOCTYPE html>
<html lang="en"${railClosed ? ' data-rail="closed"' : ''}>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(tab)}</title>
<link rel="icon" type="image/svg+xml" href="${FAVICON}">
${FONTS}
<style>${CSS}${BOARD_CSS}</style>
${THEME_HEAD}
${RAIL_HEAD}
</head>
<body>
<div class="accent"></div>
<div class="shell">
<aside class="side" id="site-rail">
<div class="side-top">${RAIL_BUTTON}<a class="brand" href="./index.html">${LOGO}<span class="wordmark"><span class="name">${esc(owner)}</span></span></a></div>
${nav}
</aside>
<div class="col-main">
<div class="wrap">
<header class="top"><span class="crumb">${crumb}</span>${topLink}${THEME_BUTTON}</header>
${lead}
<h1 class="doc-title">${esc(title)}</h1>
${blurb ? `<p class="doc-blurb">${esc(blurb)}</p>` : ''}
<main>${body}</main>
<footer class="foot">${footer}</footer>
</div>
</div>
</div>
${RAIL_SCRIPT}
${THEME_SCRIPT}
${CONTENTS_SCRIPT}
</body>
</html>`;
}
