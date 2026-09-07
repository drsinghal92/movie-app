# Conventions and lessons

Read by the planner and builder before every story. This file grows as the system learns.

## Coding conventions

Filled from docs/ARCHITECTURE.md once the stack is chosen. Add project-specific rules here (naming, error handling, folder layout, test style).

## Lessons

The /next loop appends what broke and how it was fixed, newest at the bottom. Over time this is how KaizenOS stops repeating mistakes.

This file is project state and an update never overwrites it, so **every lesson about this product's own stack, tests, or deploy belongs here.** A lesson about the harness's own scripts and commands belongs in docs/TRAPS.md instead, which is a contract and is refreshed on every update. Putting a product lesson there loses it the next time the kit moves.

<!-- format: - YYYY-MM-DD  S-NNN  what broke -> the fix -->

- 2026-09-07  S-001, S-004  `code/frontend/next.config.ts` was not supported by the pinned `next@14.2.35` (TS config files need Next 15+); `next build` failed immediately with "Configuring Next.js via 'next.config.ts' is not supported". Each independently-branched story that ran the e2e gate for the first time on its own branch hit this fresh, since the fix (rename to `next.config.mjs`) lived only on the branch that made it until that branch merged. Both S-001 and S-004's story Notes log the identical fix independently. Now resolved at the source: `next.config.mjs` is what ships on master as of S-004's merge, so no further branch should rediscover this.
