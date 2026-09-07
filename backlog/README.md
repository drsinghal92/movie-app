# backlog/

Stories live here, grouped by epic. Each story is `backlog/E0N/S-NNN.md`, created by /plan from templates/story.md. Self-contained so a fresh builder session has full context.

```
backlog/
  E01/
    S-001.md
    S-002.md
  E02/
    S-003.md
```

One story, one file, one branch, one PR, one gate. Tasks are the layer-tagged execution steps inside a story's `## Tasks` section (`S-001-T1`, `S-001-T2`), written by the planner and ticked by the builder. They never get files of their own.

The story schema and lifecycle are in docs/STRUCTURE.md. The gate record for each story lives in docs/gates/S-NNN.yml.
