# Architecture — Movie Info App

Read alongside docs/PRODUCT.md, docs/PRD.md, docs/DESIGN.md. This is a demo/internal
tier product (docs/profile.yaml, mode: sketch), so the stack is the smallest
coherent set of boring tools that satisfies the PRD, not the most complete one.

## 1. Stack

| Choice | Why |
|---|---|
| Next.js 14 (App Router) + TypeScript | One fullstack framework covers public pages, the founder tool, and the API surface. No separate backend service is justified at this scale (7 stories, one editor, low traffic), so a second deployable would only add ops overhead with no benefit. |
| PostgreSQL | Relational shape (years -> movies -> streaming links, users -> watchlist entries) is a natural fit, and it is the project's default per the environment's global conventions. |
| Prisma ORM | Typed queries against the schema below, migrations as code, and it is the default ORM alongside Postgres in this environment. |
| Auth.js (NextAuth v5), Credentials provider, JWT session | One auth system serves both audiences (visitor accounts and the founder), distinguished by a `role` column rather than two parallel systems. JWT session avoids a session table for a project this size. |
| bcrypt for password hashing | Standard, no reason to roll anything custom for a login form. |
| Next.js Route Handlers (`app/api/**`) as the API | Satisfies "REST API" without a second server. Requests are JSON over HTTP, resource-oriented paths, so the shape is REST even though it is not exposed as a public/versioned API. See Decision 5 on why a formal OpenAPI/Swagger spec is deferred. |
| Vitest | Fast, native ESM/TS unit and integration test runner for the Route Handlers and data-layer logic. |
| Playwright | Drives the real browser for the UI verification clause (browse, search, founder CRUD, watchlist save are all `ui_surface` stories). |
| Tailwind CSS | Implements the token set in docs/style-guide.html (color, type, spacing, radius, motion) without hand-rolled CSS per component; config maps directly to the CSS custom properties the style guide already defines. |
| Docker (optional, for local Postgres) | `docker-compose.yml` gives a one-command local Postgres for development and CI; no other infra is needed at this tier. |

Not adopted, and why: NestJS/Express (no second service exists to run them on, see Decision 1), a message queue or cache (no scale pressure), S3/object storage for posters (out of scope for v1, posters are external URLs or files under `public/`, see Decision 6), a formal OpenAPI generator (see Decision 5).

## 2. Data model

All tables live in one Postgres database via Prisma (`code/frontend/prisma/schema.prisma`).

```
User
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String
  role          Role     @default(VISITOR)   // VISITOR | FOUNDER
  createdAt     DateTime @default(now())
  watchlist     WatchlistEntry[]

Year
  id            String   @id @default(cuid())
  year          Int      @unique              // e.g. 1994
  published     Boolean  @default(false)      // AC3 S-001: unpublished years never list
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  movies        Movie[]

Movie
  id            String   @id @default(cuid())
  yearId        String
  year          Year     @relation(fields: [yearId], references: [id])
  rank          Int                            // 1..10 within a year, unique per year
  title         String
  poster        String                         // URL or /public path
  synopsis      String
  rating        Float                          // founder's own rating, not an aggregate
  cast          String[]                       // Postgres text[] via Prisma
  genre         String
  personalNote  String                         // "why it made the list"
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  streamingLinks StreamingLink[]
  watchlistedBy  WatchlistEntry[]
  @@unique([yearId, rank])

StreamingLink
  id       String @id @default(cuid())
  movieId  String
  movie    Movie  @relation(fields: [movieId], references: [id])
  provider String                              // "Netflix", "Prime Video", ...
  url      String

WatchlistEntry
  id       String   @id @default(cuid())
  userId   String
  user     User     @relation(fields: [userId], references: [id])
  movieId  String
  movie    Movie    @relation(fields: [movieId], references: [id])
  createdAt DateTime @default(now())
  @@unique([userId, movieId])
```

Notes:
- No `Genre` table. Genre is a plain string on `Movie`; search/filter (S-003) queries `DISTINCT genre` for the filter dropdown. A join table is unwarranted at ~10 movies/year.
- No aggregate/critic rating anywhere (PRODUCT.md non-goal: no recommendation algorithm, no third-party scores). `rating` is the founder's own number.
- The founder is a `User` row with `role: FOUNDER`, seeded once (`prisma/seed.ts`), not self-service signup. S-004's "founder login" and S-006's "visitor signup/login" hit the same `users` table and the same Credentials provider; the founder-only routes check `role`, they do not use a different table.
- `Movie.rank` uniqueness per year plus `Year.published` are what make S-001-AC3 ("unpublished years never show") and S-005-AC3 (reorder rank) enforceable at the schema level, not just in UI logic.

## 3. System design

Single Next.js app, three route groups:

```
/                         public site (Years, Year, Movie detail, Search, Watchlist, Sign up/Log in)
/founder/*                founder tool (login, edit), gated by middleware
/api/*                    Route Handlers backing both, plus NextAuth's own /api/auth/*
```

Request flow, public browse (S-001, S-002, S-003):
Browser -> Next.js Server Component -> Prisma query directly against Postgres (no extra network hop for reads that render server-side) -> HTML streamed to the browser. Search/filter (S-003) is a client component that calls `GET /api/movies?q=&year=&genre=` (a Route Handler), since it needs live re-querying as the visitor types/filters.

Request flow, founder curation (S-004, S-005):
Founder authenticates via `/founder/login` (Credentials provider) -> session cookie carries `role: FOUNDER` -> `/founder/edit` is a client-heavy tool page that calls `POST/PATCH/DELETE /api/founder/years`, `/api/founder/movies` Route Handlers -> each handler re-checks `session.role === 'FOUNDER'` server-side before touching Prisma (the middleware gate is UX, the handler check is the actual authorization boundary) -> Prisma writes -> public pages re-render on next request since Next.js reads straight from Postgres, satisfying AC4 ("visible without further action") with no cache to invalidate.

Request flow, visitor accounts and watchlist (S-006, S-007):
Visitor signs up/logs in via `/login` (same Credentials provider, `role: VISITOR` default) -> session cookie -> `POST /api/watchlist` / `DELETE /api/watchlist/:movieId` Route Handlers check `session.user.id` -> Prisma upsert/delete on `WatchlistEntry`. A logged-out visitor hitting "Add to watchlist" never reaches the API, the client checks session state first and shows the inline prompt (S-007-AC3, matches DESIGN.md 3.3).

Auth approach: one Auth.js instance, Credentials provider, JWT session strategy (no session table), `role` on the JWT/session claims distinguishes visitor vs founder. Passwords hashed with bcrypt, never stored or logged plain. `middleware.ts` redirects unauthenticated requests to `/founder/*` to `/founder/login` (S-004-AC3); each founder API handler independently re-verifies role, since middleware alone is not an authorization boundary for POST/PATCH/DELETE.

External services: none required for v1. Posters and streaming links are plain URLs the founder enters; no image upload pipeline, no third-party movie database integration (PRODUCT.md is explicit the founder curates by hand). Email delivery (e.g. verification, password reset) is out of scope per S-006's own "out of scope" line, so no email provider is wired in.

## 4. Code layout

Only `code/frontend` exists. No `code/backend` (Next.js Route Handlers are the API, and no second service is justified, see Decision 1). No separate `code/db` (the Prisma schema, migrations, and seed are small enough to live inside the one app that owns them, `code/frontend/prisma/`, and nothing else consumes the database directly).

```
code/
  frontend/
    package.json           # scripts: dev, build, test, typecheck, e2e
    tsconfig.json
    next.config.ts
    tailwind.config.ts
    playwright.config.ts
    vitest.config.ts
    prisma/
      schema.prisma
      seed.ts              # seeds the founder user + nothing else
    src/
      app/
        (public)/          # /, /years/[year], /movies/[id], /search, /login, /watchlist
        founder/            # /founder/login, /founder/edit
        api/                # Route Handlers: movies, years, watchlist, founder/*, auth/[...nextauth]
      components/           # shared UI: PosterCard, YearCard, RatingPill, Skeleton, Errnote, ...
      lib/
        db.ts               # Prisma client singleton
        auth.ts             # Auth.js config, role helpers
      middleware.ts          # gates /founder/*
    tests/
      unit/                 # vitest, data-layer and API handler logic
      e2e/                  # playwright, drives the real UI (upload/submit/etc.)
```

## 5. Conventions

- **Naming.** Prisma models PascalCase singular (`Movie`, `WatchlistEntry`); Route Handlers use plural REST-y paths (`/api/movies`, `/api/watchlist`). React components PascalCase, files kebab-case matching the component (`poster-card.tsx` exports `PosterCard`).
- **Error handling.** Route Handlers return `{ error: string }` with a matching 4xx/5xx status, never a bare 500 with no body. Server Components that hit a Prisma error render the shared `Errnote` component (DESIGN.md 3.1) rather than throwing to a blank Next.js error page in the demo screens. Founder-tool save failures preserve the in-progress form values (DESIGN.md 3.8), never clear on error.
- **Testing.** `vitest` for unit/integration (Prisma query logic, Route Handler behavior, auth role checks), `playwright` for end-to-end. Every `ui_surface` story's Playwright test drives the real input path per docs/PROTOCOL.md (real form submit for login/signup, the real "Add to watchlist" click, the real search input, the founder's real drag-to-reorder and save). Test titles carry the acceptance criterion id, e.g. `test('S-007-AC1 saves a movie to the watchlist from its detail page', ...)`.
- **Migrations.** `prisma migrate dev` in development, `prisma migrate deploy` in CI/deploy. Schema changes are never hand-edited in the generated client.
- **Secrets.** `DATABASE_URL`, `NEXTAUTH_SECRET`, founder seed credentials all come from environment variables (`.env`, gitignored); `.env.example` documents the shape with no real values.

### Test command (what scripts/test.sh runs)

`scripts/test.sh` auto-discovers `code/*/package.json`. `code/frontend/package.json` defines:

```
"typecheck": "tsc --noEmit -p ."
"test": "vitest run && playwright test"
```

So the gate runs, from the repo root, effectively:
```
cd code/frontend && npm run typecheck && npm test
```
which is `tsc --noEmit` followed by `vitest run` (unit/integration) then `playwright test` (the real-browser e2e suite, headless, against a `next build && next start` instance started by `playwright.config.ts`'s `webServer`). No change to scripts/test.sh itself was needed, it discovers this by convention.

## 6. Decisions (see docs/DECISIONS.md for the full log)

1. One Next.js app, no separate backend service, until a story genuinely needs one.
2. One Auth.js Credentials instance for both visitor and founder auth, split by a `role` column, not two systems.
3. Postgres + Prisma, single database, no cache/queue layer.
4. `code/frontend` is the only slot; Prisma schema lives inside it rather than in a `code/db` slot.
5. No formal OpenAPI/Swagger spec generated for this tier; Route Handlers are documented in this file instead of a machine-readable contract.
6. Posters/streaming links are plain URLs entered by the founder; no object storage or upload pipeline in v1.

## 7. Security-sensitive surfaces (flagged for review)

- **Auth (S-004, S-006).** Credentials provider, password hashing (bcrypt), JWT session claims carrying `role`. Wrong-credential paths must not leak whether an email exists (S-004-AC2, S-006-AC3 already require a generic error, not "email not found" vs "wrong password").
- **Authorization boundary (S-004, S-005).** Every `/api/founder/*` Route Handler must independently check `session.role === 'FOUNDER'` server-side. `middleware.ts` alone is UX, not the security boundary, since middleware can be bypassed by calling the API route directly.
- **Input handling on founder writes (S-005).** Movie/year create-edit accepts free-text fields (synopsis, personal note, streaming URLs) that render back to the public site; must be escaped/sanitized on render (React/JSX does this by default for text, but streaming link `href`s must be validated as `http(s)://` URLs before being rendered as an anchor, to avoid `javascript:` link injection).
- **PII (S-006, S-007).** User table holds email + password hash only; watchlist entries are keyed to user id. No other PII is collected. Password hashes must never appear in logs or API responses.
- **Rate limiting / brute force.** Not implemented in v1 (demo tier, sketch mode skips the adversarial/security pass per profile.yaml), flagged here as a known gap if this product ever moves to production tier.
