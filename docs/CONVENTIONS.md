# Conventions and lessons

Read by the planner and builder before every story. This file grows as the system learns.

## Coding conventions

Filled from docs/ARCHITECTURE.md once the stack is chosen. Add project-specific rules here (naming, error handling, folder layout, test style).

## Lessons

The /next loop appends what broke and how it was fixed, newest at the bottom. Over time this is how KaizenOS stops repeating mistakes.

This file is project state and an update never overwrites it, so **every lesson about this product's own stack, tests, or deploy belongs here.** A lesson about the harness's own scripts and commands belongs in docs/TRAPS.md instead, which is a contract and is refreshed on every update. Putting a product lesson there loses it the next time the kit moves.

<!-- format: - YYYY-MM-DD  S-NNN  what broke -> the fix -->

- 2026-09-07  S-001, S-004  `code/frontend/next.config.ts` was not supported by the pinned `next@14.2.35` (TS config files need Next 15+); `next build` failed immediately with "Configuring Next.js via 'next.config.ts' is not supported". Each independently-branched story that ran the e2e gate for the first time on its own branch hit this fresh, since the fix (rename to `next.config.mjs`) lived only on the branch that made it until that branch merged. Both S-001 and S-004's story Notes log the identical fix independently. Now resolved at the source: `next.config.mjs` is what ships on master as of S-004's merge, so no further branch should rediscover this.

## Rules

- **Rule: every new Vitest/Playwright spec file against the shared real Postgres instance needs serial execution, not per-story config edits.** Seen twice: S-002 (`vitest.config.ts` -> `fileParallelism: false`, `playwright.config.ts` -> `fullyParallel: false` / `workers: 1`, after `movies.test.ts` and `years.test.ts` raced seeding year 1994, and `browse.spec.ts`'s DB-wiping `beforeAll` collided with other specs) and S-003 (the same three settings, this time triggered by a second data-layer test file and unscoped `deleteMany` calls in `beforeAll`/`afterAll`). Both stories independently discovered and applied the identical fix because there is one shared, non-isolated Postgres instance and every spec file seeds/wipes it. Evidence this rule is obsolete: a story adds a new spec file, runs `scripts/test.sh` with parallelism left at its Vitest/Playwright defaults, and the suite stays green with no fixture-collision failures (e.g. because specs moved to isolated per-test transactions or a per-worker database). Until then, treat `fileParallelism: false` in `vitest.config.ts` and `fullyParallel: false` / `workers: 1` in `playwright.config.ts` as fixed project convention, not a story-local decision to re-derive.
