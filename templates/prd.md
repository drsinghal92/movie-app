# <Project> PRD

Requirements for <project>. See docs/PRODUCT.md for the why.

The specification, and only the specification. Epics, stories, and acceptance
criteria. No status, no plan, no files. Story ids are assigned here and used
unchanged in ROADMAP.yaml, the backlog filename, the gate filename, and the
branch name. They run in one global sequence and are never renumbered.

Every story that exists anywhere has its entry here. A story seeded later by
`/map`, by a `/plan` split, by a builder D4, or by `/feedback` gets its PRD
entry written at the moment it is seeded, before its story file, with an
`**Added.**` marker and an entry in Amendments at the bottom of this file. The
next id is the highest id in this file plus one. The exact rule, including how
the up-front doors differ from the mid-build ones, is in docs/PROTOCOL.md under
Where stories come from.

Three kinds of story. `feature` is the default, a user-facing outcome in As-a
form. `chore` is work with a real consequence and no user-facing capability, a
convergence refactor, a deflake, a hardening pass. `fix` corrects behavior that
already shipped and names what it corrects, `**Fixes.** S-024`, or `none` when
the code predates the pipeline. All three ship exactly the same way, one branch,
one PR, one gate, one vertical slice, and all three keep numbered acceptance
criteria. A chore states a technical outcome instead of the As-a line. A fix
states the corrected behavior.

## Epics

### E01 <Epic title>

**Goal.** <the one outcome this epic delivers, one line>
**Serves.** <the driver in PRODUCT.md this comes from>
**Done when.** <the observable condition that closes the epic>
**Out of scope.** <what this epic deliberately excludes>

Stories: S-001, S-002

#### S-001 <Story title>

**Kind.** feature
**Added.** /ideate

As a <user>, I want <capability>, so that <value>.

**Acceptance criteria**
- **AC1.** <one observable behavior, checkable, no implementation detail>
- **AC2.** <one observable behavior>
- **AC3.** <the failure or edge case, stated as a behavior>

**Out of scope.** <what a reader would assume is included and is not>
**Depends on.** <other stories, or none>

#### S-002 <Story title>

**Kind.** feature
**Added.** /ideate

As a <user>, I want <capability>, so that <value>.

**Acceptance criteria**
- **AC1.** <one observable behavior>
- **AC2.** <one observable behavior>

**Out of scope.** <none, or what>
**Depends on.** S-001

### E02 <Epic title>

**Goal.** <one line>
**Serves.** <the PRODUCT.md driver>
**Done when.** <the observable condition>
**Out of scope.** <what this epic excludes>

Stories: S-003

#### S-003 <Story title>

**Kind.** feature
**Added.** /ideate

As a <user>, I want <capability>, so that <value>.

**Acceptance criteria**
- **AC1.** <one observable behavior>

**Out of scope.** <none, or what>
**Depends on.** none

## Amendments

Why this specification changed, newest first. One entry per story or epic added
or cancelled after the PRD was first written. The `**Added.**` and
`**Cancelled.**` markers on the story block point here. This is provenance, not
status, so it never carries progress.

A cancelled story keeps its block and its id forever. The spec records what was
decided against, not only what was built.

`/ideate` and `/map` leave this section empty, their stories are the original
spec. The first entry appears the first time a mid-build door seeds a story.

<!-- Shapes below are reference only. Do not copy them into a new PRD, they are
     here so a door that seeds a story knows what to write.

     A chore story block, in place of the As-a line.

     #### S-030 Converge collapsing surfaces onto one component

     **Kind.** chore
     **Added.** 2026-07-25, D4 during S-024. See Amendments.

     **Outcome.** Every collapsing surface renders through one shared component.

     **Acceptance criteria**
     - **AC1.** All four collapsing surfaces import the shared component
     - **AC2.** No local collapse implementation remains in the codebase

     **Out of scope.** Any change to how the sections look
     **Depends on.** none

     An Amendments entry, one per seeded story.

     ### 2026-07-25. S-030 added, chore

     **Door.** D4 during S-024.
     **Why.** what the builder or the reviewer hit that is real work, has no
     user, and does not belong inside the story that surfaced it
     **Alternative considered.** folding it into an existing story as a task or
     an acceptance criterion, and why that was rejected
     **Effect on the spec.** what a reader of the PRD now knows that they did
     not before, and whether any existing story narrowed as a result

     A cancelled story block. The block and the id stay, nothing is deleted.

     #### S-018 Export the board as CSV

     **Kind.** feature
     **Cancelled.** 2026-07-25, /feedback. See Amendments.
     **Added.** /ideate

     As a user, I want to export the board as CSV, so that I can work on it
     elsewhere.

     ... acceptance criteria left in place, unchanged ...

     And its Amendments entry.

     ### 2026-07-25. S-018 cancelled

     **Door.** /feedback.
     **Why.** why the requirement is no longer wanted
     **Replaced by.** the story that covers it instead, or none
-->
