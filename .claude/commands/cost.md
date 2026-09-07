---
description: What the build has cost. Tokens, estimated spend and wall clock, per story and per phase, projected from the event trail.
argument-hint: [S-NNN] [--since YYYY-MM-DD]
---

Report what this project's build loop has cost. Args: $ARGUMENTS

1. Run `node scripts/cost.mjs` (add `--story S-NNN` or `--since YYYY-MM-DD` when the args name one). It reads logs/events.jsonl and prints the rollup. An UNFILTERED run also writes docs/COST.md and logs/cost.csv, both derived and never hand-edited. A filtered run writes nothing and says so, because both files describe every story the trail has ever carried and their headings say so, so writing a window into them would replace the whole history with a slice that reads like the whole history.

2. Read the rollup back in three lines, not more. The total, the phase taking the largest share, and one thing worth acting on if there is one. Worth acting on means a real asymmetry, an Opus reviewer costing more than the Sonnet builder it reviews, a phase whose retries dominate, one story an order of magnitude above its neighbours. If nothing stands out, say the spread looks ordinary and stop.

3. **Always state that the money figures are estimated and that orchestration is not measured.** Tokens, tool uses and durations are measured, reported back by the Agent tool when each subagent finishes. Amounts are derived from `cost.rates` in docs/profile.yaml, blended per million tokens because the harness reports one token figure rather than an input and output split. And every figure covers the subagents only, the planner, builder, qa, security and review calls. The main `/next` loop's own spend, reading the contracts on every story, composing gate files, writing PR bodies, is real and invisible here. The totals are a floor, not a bill. Never present them as complete.

4. If the tuning conversation comes up, the knob is `models:` in docs/profile.yaml, and the dispatch that actually runs is the `model:` frontmatter in .claude/agents/*.md, so the two must move together. Name the tradeoff rather than recommending a downgrade on price alone, the builder and the reviewer are deliberately different models so a reviewer catches the blind spots the builder shares with itself.

No em dashes.
