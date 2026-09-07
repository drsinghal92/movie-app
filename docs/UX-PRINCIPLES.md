# KaizenOS UX principles

The UX reference the designer agent anchors on, alongside the KaizenRise Design System v4. The Design System owns the paint (color, type, spacing, motion). This file owns the thinking (structure, hierarchy, navigation, states). Read this before laying out a screen, read v4 before styling one.

## The one principle everything hangs on

Match the interface to the user's mental model and their task frequency, not to the database schema or the org chart. Every rule below is a consequence of this. Users arrive with an existing model of how things work. The job is to shrink the gap between what they expect and what they get. Confusion is that gap made visible.

## The eight fundamentals

1. **Hierarchy of clarity.** Every screen answers three questions in order. Where am I, what can I do here, what happens next. Fail any of these in the first two seconds and the screen is broken no matter how it looks.
2. **One primary action per screen.** Exactly one thing you most want the user to do. Make it the loudest element, everything else is secondary or tertiary and should look it. Five equally weighted buttons means no primary action.
3. **Progressive disclosure.** Show the minimum needed now, reveal complexity on demand. Do not dump every option up front. This is the practical form of "subtraction is the design."
4. **Recognition over recall.** Let people pick from what is visible instead of remembering. Menus, autocomplete, recently used. Human memory is the scarcest resource in the UI.
5. **Feedback and system status.** Every action gets an immediate, visible response. Loading, success, and error states that say what to do next. Silence reads as failure.
6. **Consistency.** The same thing looks and behaves the same everywhere. Consistency is what lets a user's learning transfer, which is the whole point of a system.
7. **Forgiveness.** Undo, confirmation on destructive actions, easy exits. Design the recovery path, not just the happy path.
8. **Accessibility is not optional.** Contrast, focus states, keyboard paths, hit targets, prefers-reduced-motion. Designing for the edge improves the center.

## Navigation, top vs left

Placement is downstream of two questions. Answer them and the choice makes itself.

**How many top-level destinations, and how deep the hierarchy.**

- **Top / horizontal nav** fits shallow, few destinations (roughly 3 to 7). Marketing sites, content sites, consumer apps with a handful of sections. Horizontal space is limited, so it forces you to stay shallow, which for these products is a feature.
- **Left / vertical sidebar** fits deep, many destinations, and tool-like apps where people live for long sessions and switch between many areas. Dashboards, admin panels, SaaS, IDEs, email. Vertical lists scroll and nest, so a sidebar scales to dozens of items where a top bar cannot.

**The deciding question. Is this a site you visit or a tool you work in.** Sites lean top, tools lean left. The reason is dwell time and switching frequency. In a tool you change sections constantly, so the nav must be persistent, glanceable, and expandable. On a site you navigate rarely and mostly scroll, so the top bar stays out of the way.

**Mobile changes it.** Horizontal space collapses, so the pattern becomes a bottom tab bar (up to five thumb-reachable items) or a hamburger drawer. Bottom tabs for the few most frequent destinations, drawer for the long tail.

**The common hybrid** most serious tools land on is a top bar for global and account-level things (logo, search, profile, notifications) plus a left rail for the working sections. Global identity on top, workspace on the side.

## The design order

Work in this order and layout stops being guesswork.

1. List the top-level destinations. The count and depth alone often decides top vs left.
2. Decide site vs tool. That confirms it.
3. Name the single primary action for each screen.
4. Strip anything whose removal does not break the screen.
5. Check the three clarity questions on every screen (where am I, what can I do, what next).
6. Design the empty, loading, and error states, not just the full happy state.

The last two are where most screens fail. A screen is not done until its empty and error states exist.
