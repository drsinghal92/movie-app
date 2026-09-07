# KaizenOS build standards

The code rules every product built by this harness follows, whatever its stack. The builder writes against them, the planner plans around them, and QA and the adversarial reviewer judge against them by name.

This file is a contract. It ships to every install and is refreshed by every update, like PROTOCOL.md and UX-PRINCIPLES.md. It holds only what has recurred across more than one story. **A rule about one product's stack does not belong here, it belongs in that product's docs/CONVENTIONS.md**, which is product memory and never travels.

## Why these eight and not others

They are not a survey of good practice. Each one was measured. On the KaizenTasks build of 16 to 20 August 2026 the gate layers raised 162 findings that a repair round then fixed. Reading them one by one, roughly a third were not one-off defects. They were eight shapes returning story after story, and a build round was paid for each return.

That is the argument. A gate finding costs a whole build round. A standard costs one line in a file the builder already reads. Paying the round more than twice for the same shape is a choice, not an accident.

**A rule in prose does not enforce itself.** The sharpest evidence in that data set is a rule that was already written down. `CONVENTIONS.md` in that repo recorded "read the section before citing it" on 19 August, upgraded from an observation to a rule because it had already happened twice. It recurred four more times the next day. So every rule below states **what evidence proves it**, in a form a gate layer can actually look for. A standard nobody can check is a wish.

## The eight

### 1. A citation is a claim, and a claim is checked

A comment, a docstring, or a document line that names a file, a line number, a section, or an invariant is read by the next person as verified fact. They stop looking. So either open the thing you are citing and confirm it says what you say it says, or do not cite it.

An invariant stated in a comment is the same promise. Either the code below it enforces the rule, or the comment says what the code actually does.

*Recurred as:* a docstring describing a conflict error the code had stopped throwing. A root cause written into two shipped test files that a later review disproved experimentally. A design document cited for a rule it does not contain. Four line-number citations invalidated by the same commit that shipped them.

*Evidence that proves it:* the reviewer opens one cited reference per changed file and reads it. A citation broken by the diff carrying it is a defect in that diff.

### 2. Every acceptance criterion needs a test that can fail

A test that passes whatever the code does is not coverage, it is the appearance of coverage, and it is worse than no test because it stops anyone writing the real one.

The check is mechanical. Break the behaviour on purpose and confirm the test goes red. If it stays green, the test is asserting something other than the criterion. Assert the rendered output and its order, never the mere presence of an element. Never assert a test name, a title, or a file's existence as a stand-in for behaviour.

*Recurred as:* a coverage spec that grepped for test names, so an empty test with the right name satisfied it. A concurrency test that ran two calls against a single-writer database in one process and never raced. A specification that asserted whichever branch the app happened to render. A boundary test set two days clear of the boundary.

*Evidence that proves it:* for any criterion the story calls proven, the reviewer can name the assertion that fails when the behaviour is removed.

### 3. A drawn magnitude is measured, not merely visible

Anything whose value is carried by its size is asserted by a measured box, not by a visibility check. Bar heights, widths, proportions, meters, rings, counts of repeated marks. A visible element of the wrong size passes every existence assertion there is.

Layout that can overflow is checked at the real breakpoints, not at one convenient width.

*Recurred as:* a chart that drew every bar at zero height and passed. A proportion whose denominator could be swapped with the suite still green. Seven fixed-width marks bleeding past their card at four viewport widths. The epic review named this one itself, as the same defect three times in one epic.

*Evidence that proves it:* the specification reads a measured dimension and compares it to an expected value or ratio.

### 4. Every write has an in-flight state, a failure path, and a way back

For each write the user can start, three things exist and are proven. Something visible while it is in flight. A failure surface that names what failed, sits beside the control that failed, keeps what the user typed, and offers a retry that actually retries. And a path back out.

The failure surface never lives inside a container that can unmount on its own, a timer, an auto-clearing receipt, a modal that closes on refetch. If it can vanish before the failure arrives, it does not exist.

*Recurred as:* a filing failure swallowed entirely against a design that specified a failure line, a retry, and the typed text restored. A retry that reopened an editor and left the save to the user. A second failure that was silent because the retry path had no handler of its own. A confirm dialog that stayed open behind its own scrim when the delete under it failed. A view shipped with no loading and no error state.

*Evidence that proves it:* a test that forces the failure, not one that only walks the happy path.

### 5. One canonical query per table owns the predicate set

For every table there is one read that carries the full set of predicates the domain requires, ownership, tenancy, soft deletion, status, date window, whatever they are. A new read or write over that table copies that set. It does not re-derive it from memory.

When a new query legitimately needs fewer predicates, that is a decision, and it is written down where the query is.

*Recurred as:* a completed-today read missing the container predicate its sibling read carries, so a screen double counted. A disposition write with no day predicate, retroactively rewriting an earlier day. A join added at four sites with the ownership predicate at none of them. A batch update missing the already-closed guard the single update beside it has.

*Evidence that proves it:* the reviewer diffs the new query's predicates against the canonical one for that table and gets a deliberate answer for every difference.

### 6. Every mutation names what it invalidates

Caches and view state go stale silently. There is one place that maps a write to the reads it invalidates, and a new write adds its entry there. Two queries mounted together, where one writes what the other reads, are ordered on purpose.

*Recurred as:* the same defect in three separate epics. A rename and a delete that did not invalidate the two views reading them, in a second file, reopening a bug an earlier epic had already fixed once. Then at an epic seam, a day write and a progress read mounted concurrently with nothing invalidating the second after the first landed.

*Evidence that proves it:* the invalidation map is a real file, and the reviewer checks the new write is in it.

### 7. Parse model output per element, never per batch

A response from a language model is partly wrong by nature. Validation that rejects the whole response over one bad element throws away everything good in it and reads to the user as total failure.

Validate each element and drop the ones that fail. Cap a list by slicing it, never by rejecting it. Keep a schema strict on the fields the product uses and loose on the fields it discards.

*Recurred as:* a cap that discarded eight good items to punish a ninth. One field left without a per-element fallback, so a single malformed item collapsed the whole array to nothing. Hard limits on fields the story throws away, turning a correct inference into a total failure.

*Evidence that proves it:* a test feeding a response with one bad element and asserting the good ones survive.

### 8. A user-facing string built from data has one owner

Pluralisation, counts, currency, dates, and any other string assembled from a value live in one helper. Written inline they diverge, and each site has to be found again to fix the same bug.

*Recurred as:* a destructive confirm that read "Its 1 steps are deleted". A sweep then found three more sites, and the epic review found the same assembly written inline at five sites across four stories.

*Evidence that proves it:* a search for the pattern returns one implementation.

## How a standard gets added

A finding that a gate layer raises for the **second** time on the same product stops being a fix and becomes a rule. The `/next` learn step writes it into that product's `docs/CONVENTIONS.md`, with the shape, the two occurrences, and the evidence that would prove it.

It is promoted here, into the harness, only when it has recurred on more than one product, or across more than one epic in one product, and only when it is true regardless of stack. Everything else stays in `CONVENTIONS.md` where it belongs. This file is small on purpose. A contract nobody finishes reading is not a contract.

Write the check alongside the rule, always. The one thing this data set proves beyond doubt is that a rule with no way to see it broken does not hold, no matter how plainly it is written.
