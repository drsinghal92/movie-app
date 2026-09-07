# Movie Info App PRD

Requirements for the movie info app. See docs/PRODUCT.md for the why.

The specification, and only the specification. Epics, stories, and acceptance
criteria. No status, no plan, no files. Story ids are assigned here and used
unchanged in ROADMAP.yaml, the backlog filename, the gate filename, and the
branch name. They run in one global sequence and are never renumbered.

## Epics

### E01 Browse the yearly lists

**Goal.** A visitor can pick a year and see the 10 best movies for that year, then open any one for detail.
**Serves.** v1 scope, browse by year and movie detail pages, in docs/PRODUCT.md.
**Done when.** A visitor can navigate from a list of years to a year's top-10 to a single movie's detail page.
**Out of scope.** Editing any list content, accounts, search.

Stories: S-001, S-002, S-003

#### S-001 Browse years and their top-10 lists

**Kind.** feature
**Added.** /ideate

As a visitor, I want to browse the site by year, so that I can see the 10 best movies for that year.

**Acceptance criteria**
- **AC1.** When a visitor opens the site, the system shows a list of years that have a published top-10 list.
- **AC2.** When a visitor selects a year, the system shows that year's 10 movies in rank order.
- **AC3.** When a year has no published list yet, the system does not show it in the year list.

**Out of scope.** Editing the list, movie detail beyond title, poster, and rank.
**Depends on.** none

#### S-002 View a movie's detail page

**Kind.** feature
**Added.** /ideate

As a visitor, I want to open a movie from a yearly list and see its full detail, so that I can decide whether and where to watch it.

**Acceptance criteria**
- **AC1.** When a visitor opens a movie from a yearly list, the system shows its poster, synopsis, rating, and cast.
- **AC2.** The detail page shows the founder's personal note on why the movie made that year's list.
- **AC3.** The detail page shows one or more streaming links for the movie.
- **AC4.** When a streaming link is unavailable for a movie, the system shows that no streaming link is available instead of a broken link.

**Out of scope.** User reviews or ratings, saving the movie to a watchlist.
**Depends on.** S-001

#### S-003 Search and filter movies

**Kind.** feature
**Added.** /ideate

As a visitor, I want to search and filter movies, so that I can find a specific title without browsing year by year.

**Acceptance criteria**
- **AC1.** When a visitor enters a movie title in search, the system shows matching movies across all published years.
- **AC2.** A visitor can filter the movie list by year and by genre.
- **AC3.** When no movie matches the search or filter, the system shows an empty state instead of an error.

**Out of scope.** Saved searches, search suggestions/autocomplete.
**Depends on.** S-001

### E02 Founder curation

**Goal.** The founder can maintain the yearly top-10 lists without developer help.
**Serves.** v1 scope, founder self-editing, in docs/PRODUCT.md.
**Done when.** The founder can log in, create a year, and add, edit, or remove its movies, and the change is visible to visitors immediately.
**Out of scope.** Multi-editor roles, approval workflows.

Stories: S-004, S-005

#### S-004 Founder login

**Kind.** feature
**Added.** /ideate

As the founder, I want to log in to a protected area, so that only I can edit the site's content.

**Acceptance criteria**
- **AC1.** When the founder enters correct credentials, the system grants access to the editing area.
- **AC2.** When anyone enters incorrect credentials, the system denies access and shows an error.
- **AC3.** A visitor who is not logged in cannot reach any editing page.

**Out of scope.** Multiple founder accounts, password reset flow.
**Depends on.** none

#### S-005 Add and edit a yearly top-10 list

**Kind.** feature
**Added.** /ideate

As the founder, I want to add and edit a year's top-10 list, so that visitors always see my current picks.

**Acceptance criteria**
- **AC1.** When logged in, the founder can create a new year and add up to 10 movies to it, each with poster, synopsis, rating, cast, personal note, and streaming links.
- **AC2.** The founder can edit or remove a movie already on a year's list.
- **AC3.** The founder can reorder the rank of movies within a year's list.
- **AC4.** A change the founder saves is visible to visitors without further action.

**Out of scope.** Bulk import of movie data, scheduling a list to publish in the future.
**Depends on.** S-004

### E03 Accounts and watchlist

**Goal.** A visitor can create an account and keep a personal watchlist of movies.
**Serves.** v1 scope, user accounts, in docs/PRODUCT.md.
**Done when.** A visitor can sign up, log in, save a movie to their watchlist, and see their watchlist on return visits.
**Out of scope.** Social features, sharing a watchlist with others.

Stories: S-006, S-007

#### S-006 Create an account and log in

**Kind.** feature
**Added.** /ideate

As a visitor, I want to create an account and log in, so that my preferences are saved across visits.

**Acceptance criteria**
- **AC1.** A visitor can create an account with an email and password.
- **AC2.** A visitor with an existing account can log in and reach their own saved data.
- **AC3.** When someone tries to sign up with an email already in use, the system shows an error instead of creating a duplicate account.

**Out of scope.** Social login providers, email verification.
**Depends on.** none

#### S-007 Save a movie to a watchlist

**Kind.** feature
**Added.** /ideate

As a logged-in visitor, I want to save a movie to my watchlist, so that I can find it again later.

**Acceptance criteria**
- **AC1.** When a logged-in visitor saves a movie from its detail page, the system adds it to that visitor's watchlist.
- **AC2.** A logged-in visitor can view their full watchlist and remove a movie from it.
- **AC3.** When a visitor who is not logged in tries to save a movie, the system prompts them to log in or sign up instead.

**Out of scope.** Sharing a watchlist, notifications about watchlist movies.
**Depends on.** S-002, S-006

## Amendments

Why this specification changed, newest first. One entry per story or epic added
or cancelled after the PRD was first written. The `**Added.**` and
`**Cancelled.**` markers on the story block point here. This is provenance, not
status, so it never carries progress.
