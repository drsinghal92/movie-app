# Movie Info App Design

## 1. Design direction

Editorial, poster-forward browsing, not a transactional booking flow. Public
site reads like Netflix/IMDb, confident and dark; the founder's editing area
stays visually the same product but drops the marquee tone for a plain
form-and-table register, so curation never gets mistaken for content.
Brand basis: docs/style-guide.html (Movie Info App, non-KaizenRise, dark
default, Bebas Neue + Inter, red/yellow accents).

## 2. Tokens

Referenced from docs/style-guide.html, not forked here.

- Color: `--accent` (red, primary actions), `--accent-2` (yellow, rating/eyebrow only, max two accent elements per surface), `--ink`, `--dark`, `--dark-elev`, `--dark-elev-2`, `--white`, `--muted`, `--faint`, `--hairline`
- Type: `--font-heading` (Bebas Neue, display/H1-H4), `--font-body` (Inter, body/UI/forms), `--font-mono` (JetBrains Mono, chips/labels only)
- Spacing: `--s-2xs` through `--s-2xl`
- Radius: `--r-sm`, `--r-md`, `--r-lg`
- Shadow: `--sh-ring`, `--sh-card`, `--sh-hover`
- Motion: `--d-fast` 150ms, `--d-base` 250ms, `--e-standard` easing

## 3. Screens

Site vs tool per UX-PRINCIPLES: the public site is a site (top nav, shallow,
5 destinations: Years, Search, Watchlist, Sign up/Log in, a Year page).
The founder area is a small tool nested inside it (login gate, one working
screen with a persistent left-lite list of years/movies, since it is a
long-session editing surface not a page you scroll once).

### 3.1 Home / Years (index.html) — S-001

Purpose: entry point, list every year with a published list.
Layout:
```
[ header: mark + name -------- Search  Watchlist  Log in ]
[ hero: "10 BEST MOVIES · EVERY YEAR" eyebrow + lead line ]
[ grid of year cards, most recent first, each -> Year page ]
```
Primary action: pick a year (each year card is a link, no other competing CTA).
Components: nav bar, year card (year number in display type, movie-count sub-line).
States:
- Empty: no years published yet -> centered message, no year cards (still valid per AC3, unpublished years never appear, so an empty list is a legitimate first-run state, not an error).
- Loading: skeleton year cards (see style guide `.sk`).
- Error: inline errnote block, "Something went wrong, retry."

### 3.2 Year page (year-1994.html pattern) — S-001

Purpose: show one year's top 10 in rank order.
Layout:
```
[ header: back-to-years breadcrumb ]
[ display heading: "TOP 10 · 1994" ]
[ poster grid, rank badge 1-10, title, genre/meta -> Movie detail ]
```
Primary action: open a movie (poster is the whole hit target).
Components: poster card (rank badge, hover lift+scale per style guide), breadcrumb.
States: loading (skeleton poster row), error (errnote), no true empty state
(a year only exists once published with movies, per AC3 of S-001; an
in-progress year the founder hasn't published is simply absent from index).

### 3.3 Movie detail (movie-detail.html / movie-detail-no-links.html) — S-002, S-007

Purpose: give a visitor everything needed to decide to watch, and let a
logged-in visitor save it.
Layout:
```
[ back-to-year breadcrumb ]
[ poster (left) | title, rating pill, cast, synopsis (right) ]
[ "Why it made the list" — founder's personal note, set apart, quieter card ]
[ Streaming links row ]
[ primary action: Add to watchlist ]
```
Primary action: Add to watchlist (secondary: streaming link buttons, which are
each equally weighted external actions, not competing with the primary).
Components: rating pill, cast list, note card, streaming-link button row,
watchlist toggle button.
States:
- No streaming link available (movie-detail-no-links.html): AC4, replace the
  link row with a plain "No streaming link available yet" line, same errnote
  visual language, no dead links.
- Not logged in and clicks Add to watchlist: inline prompt "Log in or sign up
  to save this" replacing the button state, links to signup-login.html (AC3
  of S-007), not a hard redirect that loses their place.
- Loading/error: same skeleton/errnote pattern as other content screens.

### 3.4 Search (search.html, search-empty.html) — S-003

Purpose: find a movie by title, or narrow by year and genre, without
browsing year by year.
Layout:
```
[ header ]
[ search input, full width, autofocus ]
[ filter row: year dropdown, genre dropdown ]
[ result grid, same poster-card component as Year page ]
```
Primary action: the search input itself (typing is the action, no submit
button needed for a live-filter pattern; a single "Search" affordance would
violate one-primary-action by competing with the filters).
Components: search input, filter dropdowns (recognition over recall, populated
from real published years/genres, not free text).
States:
- Empty (search-empty.html): AC3, "No movies match your search" message, filters
  stay visible and editable so recovery is immediate, not a dead end.
- Loading: skeleton result grid.
- Error: errnote.

### 3.5 Sign up / Log in (signup-login.html) — S-006

Purpose: create an account or log in as a visitor.
Layout:
```
[ header, minimal nav ]
[ single card: tab or toggle between Sign up / Log in ]
[ email, password fields, one primary submit button ]
[ inline error line under the form on failure ]
```
Primary action: Submit (Sign up or Log in depending on active tab).
Components: form card, tab toggle, text input, primary button, inline error text.
States:
- Error: duplicate email on signup (AC3) or bad credentials on login, shown
  inline under the field, not a page-level error, so the form and its values
  are not lost.
- Loading: submit button shows a busy state (label swap, e.g. "Signing in…"), disabled.

### 3.6 Watchlist (watchlist.html, watchlist-empty.html) — S-007

Purpose: a logged-in visitor's saved movies, and removal.
Layout:
```
[ header, showing logged-in identity/avatar or email ]
[ display heading: "MY WATCHLIST" ]
[ poster grid, same card as Year page, each with a remove affordance ]
```
Primary action: none singular, this is a management surface, each card's
remove control is a tertiary, quiet affordance (small ghost icon/button on
the card), not a page-level primary button (browsing to a movie is the
implicit primary path, via the card itself).
Components: poster card + remove control, empty-state illustration/message.
States:
- Empty (watchlist-empty.html): AC2 implies a visitor can have zero saved movies;
  message "Nothing saved yet" plus a link back to Years or Search so the
  recovery path is one click, not a dead page.
- Loading: skeleton grid.
- Error: errnote.

### 3.7 Founder login (founder-login.html) — S-004

Purpose: gate the editing area behind founder credentials, separate from the
public sign up/log in flow (different audience, different destination).
Layout:
```
[ plain header, no marketing chrome ]
[ single centered card: email/username + password + submit ]
[ inline error on failure ]
```
Primary action: Log in.
Components: form card, primary button, inline error text.
States: error (AC2, wrong credentials -> inline error, no access granted),
loading (button busy state). No empty state (a login form has no data to
be empty).
Access control: any editing route redirects here if not authenticated (AC3),
enforced at the route level, not just by hiding a nav link.

### 3.8 Founder edit (founder-edit.html) — S-005

Purpose: the working tool where the founder creates a year, adds/edits/removes
its movies, and reorders rank. Deliberately plainer than the public site,
dense and functional, a tool you work in, not a page you browse (per
UX-PRINCIPLES' site-vs-tool test), so it earns the one exception to the
public site's top-nav-only rule.
Layout:
```
[ founder header: "EDITING" label, log out ]
[ left rail: list of years (existing + "+ New year") ]
[ main: selected year's movie list, drag-to-reorder rank, "+ Add movie" ]
[ movie row expands inline to an edit form: poster upload, title, synopsis,
  rating, cast, personal note, streaming links, Save / Remove ]
```
Primary action: Save (on whichever row/form is open). Add movie and reorder
are secondary tool actions, not competing primaries, since only one form is
open at a time (progressive disclosure, AC1's long field list only appears
when adding/editing a movie, never all at once).
Components: left-rail year list, movie row (drag handle, rank number, title,
edit/remove), inline edit form, streaming-link repeater field, save/cancel
buttons, destructive-remove confirmation (forgiveness, per UX-PRINCIPLES
fundamental 7, removing a movie asks for confirmation before it disappears).
States:
- Empty: a new year with zero movies yet -> "No movies added yet, add up to 10"
  message inline where the movie list would be.
- Loading: save button busy state, skeleton row list on first load of a year.
- Error: inline errnote under the form on save failure, values preserved
  (never clear a founder's in-progress edit on error).
- Saved: AC4, an inline confirmation ("Saved, live now") since the change
  must be visible to visitors without further action, the founder needs to
  know it actually went live, not just that the form submitted.

## 4. Primary flows

**Browse to watch (S-001, S-002, S-003)**
1. Land on Home, see published years.
2. Pick a year, or use Search/filters instead.
3. Open a movie from the grid.
4. Read synopsis, cast, personal note, pick a streaming link (or see "not
   available" if none).

**Save and return (S-006, S-007)**
1. From a movie detail page, click Add to watchlist while logged out.
2. Prompted to log in or sign up, land on signup-login.html.
3. Create account or log in, return to the movie, save it.
4. Visit Watchlist any time, remove a saved movie.

**Founder curates a year (S-004, S-005)**
1. Go to founder-login.html, authenticate.
2. In founder-edit.html, create a new year or select an existing one.
3. Add a movie, fill poster/synopsis/rating/cast/note/links, save.
4. Reorder rank by dragging, or edit/remove an existing movie.
5. Confirm the "saved, live now" state; the public Year page reflects it
   immediately with no further action.

## 5. Component inventory

- Top nav bar (public) / founder header (editing)
- Year card
- Poster card (rank badge, hover lift, title, meta) — reused on Home... no,
  reused on Year page, Search results, and Watchlist
- Rating pill
- Search input + filter dropdowns
- Auth form card (shared shape, two instances: visitor signup/login, founder login)
- Founder left-rail year list
- Founder movie row (drag handle, inline expand)
- Founder inline edit form + streaming-link repeater
- Primary / secondary / ghost buttons
- Skeleton loading block
- Errnote (inline error block)
- Empty-state message block
- Confirmation banner ("Saved, live now")
- Destructive-action confirm (remove movie)
- Breadcrumb (back-to-years, back-to-year)

Roughly 16 reusable components across the two registers (public site, founder tool).

## 6. Interaction and motion

Product type is a website (public, browsable), so the richer motion
vocabulary applies, scaled to demo/internal tier, kept tasteful rather than
elaborate.

- Micro-interactions everywhere (shared with the app baseline): hover/focus
  transitions at `--d-fast` (150ms), state changes at `--d-base` (250ms),
  `--e-standard` easing. Poster cards get the slightly stronger tactile lift
  (-4px, 1.02x scale) defined in the style guide, everything else uses the
  standard -2px hover lift.
- Website-only additions, used sparingly:
  - Poster grids reveal on scroll with a short fade+rise (staggered by
    ~40ms per card, capped at the first row so it never feels slow on
    repeat visits).
  - Year cards on Home stagger in on first load only, not on every
    navigation back to Home.
  - No scroll-driven choreography, no parallax, no animation library. Given
    demo/internal tier and the modest list sizes (≤10 movies per year), CSS
    `@keyframes` and `IntersectionObserver`-triggered classes are enough;
    this does not rise to the complexity bar for recording a motion library
    in ARCHITECTURE.md.
- The founder editing tool (3.8) uses micro-interactions only, no scroll
  reveal or stagger, it is a tool you work in and motion there should be
  invisible, not editorial.
- `prefers-reduced-motion: reduce` disables all transitions and animations,
  scroll-reveal included (elements render in their final state immediately).
