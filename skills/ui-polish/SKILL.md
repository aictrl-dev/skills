---
name: ui-polish
description: Polish an existing UI screen with evidence. Renders it at phone and desktop width, measures what screenshots hide (column alignment, field widths, label placement, tap targets, input font size, contrast, overflow, dead space, distance to the primary action), judges the look against a short polish rubric, fixes the source, then re-measures until the checks pass. Use when the user says "polish this UI", "tighten the details", "this form looks off", "make this screen feel finished", "fix alignment and spacing", or asks to bring a screen closer to a reference design. For information architecture, value proposition or flow critique, use design-review instead.
---

# UI polish

A screen can be well organised and still feel unfinished: two columns of fields that sit 17px out of line, 88px boxes on a 390px phone, a unit word trailing each field, a link you can't hit with a thumb. People feel these instantly; models reviewing screenshots rarely see them. This skill measures first, judges second, and only calls a defect fixed when the measurement says so.

## Inputs

Ask only for what is missing.

1. **Target.** A URL, or an HTML file, or the component in a repository plus a URL where it renders. You need a way to render it; if you cannot render anything, say so and fall back to the rubric alone, marking every measured check as "not measured".
2. **Scope** (optional). A CSS selector for the part of the page to polish, e.g. the form or `main`. Default: `main`, else `body`.
3. **Reference** (optional). A screen the user considers better (a URL, file or screenshot). Measure it too and use it as the direction for the look; never copy its brand, content or claims.

## Workflow

### 1. Measure the current screen

Run the bundled script (needs Node and Playwright with Chromium; install with `npm i -D playwright && npx playwright install chromium` if the project lacks it):

```bash
node <skill-dir>/scripts/measure.cjs <file-or-url> --out ui-polish/before [--scope "<selector>"] [--primary "<selector>"] [--hide "<selector>,…"] [--profile form|content]
```

- It renders at phone (390×844) and desktop (1366×900) (exit 1 while error findings remain, 2 on usage errors, 3 when the run itself fails), writes `measure.json` into `--out` (resolved against the current directory) with two screenshots per viewport, `<viewport>.png` (the first screen) and `<viewport>-scope.png` (the whole scope, including anything below the fold), and prints every finding with a selector.
- Scripts are off by default so the static layout is measured; add `--js` for pages that only render with JavaScript. `--offline` blocks every network request except the target page (hermetic); `--assets-only` also lets remote fonts, stylesheets and images load, for saved copies that need their fonts, and does contact those hosts.
- `--hide` sets `display: none` on overlays such as a cookie banner or chat launcher before measuring and capturing, so they neither cover the screenshots nor add findings.
- `--profile content` is for articles and other long-form pages: it skips the checks built for form steps (`type-scale`, `action-distance`, `action-below-fold`, `dead-space`). The default is `form`.
- Several targets in one run (`measure.cjs <page1> <page2> … --out dir`) each go to `dir/<slug>/`, and `dir/summary.json` merges a finding that repeats across pages into one line listing the pages; fix a shared component once. Compare page by page (`--compare before/<slug>/measure.json after/<slug>/measure.json`).
- Checks and thresholds, and the usual fix for each, are in `reference/checks.md`. Errors fail the run; warnings need a fix or a stated reason.
- State a reason once, not every run: a `ui-polish.config.json` in the current directory (or `--config <file>`) lists accepted decisions, e.g. `{ "ignore": [{ "check": "text-size", "selector": ".eyebrow", "reason": "brand kicker labels" }] }`. Matching findings move to `accepted` with the reason, are printed in their own section, and do not affect the exit code. Only record a decision the owner made; never add one to make the numbers pass.

If a reference was given, measure it the same way into `ui-polish/reference`.

### 2. Look at it

Open the screenshots (the `-scope.png` ones show the whole scope) and walk all ten points of `reference/rubric.md`. Write a verdict table with one row per point (and one row per sub-check of point 10): **pass**, **fail** or **n/a**, the located problem, and the fix. Judge only what is on the screen. The measurements are evidence for the rubric, not a replacement for it: a screen with zero measured findings can still fail hierarchy, labels and units, grouping or trust, and those are usually the failures people notice first.

### 3. Plan the fixes

List every measured finding and every failed rubric point with its fix, grouped by the element it touches. Prefer structural fixes that remove several findings at once (for example, labels above fields in a two-column grid fixes alignment, equal widths, field fill, label placement and accessible names together) over patching each finding. Order by impact on the person using the screen.

### 4. Apply the fixes to the source

Edit the real source: the component and its styles in a repository, or the HTML file. Rules:

- **Keep the job and content.** Same questions, same inputs and units, same actions, same brand. Do not remove features to make a check pass.
- **Invent nothing.** Do not add facts the screen did not state in words: step counts, times, prices, clinical, legal or privacy claims. A value you worked out from the code (a progress bar's `aria-valuenow`, a CSS width, a route name) is still not stated; bracket it too. If the design needs such copy, use a bracketed placeholder (`Question [n] of [N]`, `[~3] minutes`, `[Why we ask: …]`) and list it for the owner to fill.
- **Use the system that exists.** Reuse the project's tokens, components and spacing scale; add new values only when none fit.
- **Keep it working.** Every control must still do what it did (and, where it was broken, work). Keep keyboard focus visible.

### 5. Re-measure until it passes

```bash
node <skill-dir>/scripts/measure.cjs <file-or-url> --out ui-polish/after [same options]
node <skill-dir>/scripts/measure.cjs --compare ui-polish/before/measure.json ui-polish/after/measure.json
```

The compare step also lists every piece of new copy for the owner to review, and fails with `invented-number` when new copy contains a number outside `[brackets]` (for example "Step 2 of [5]": the 2 was never stated).

Repeat steps 4–5 until there are no errors, every remaining warning is fixed or has a stated reason, **and** every failed rubric point is fixed or has a stated reason, at most three rounds. Re-walk the rubric on the new screenshots each round. Zero errors is not done: warnings such as 36px tap targets or trailing labels are exactly the details this skill exists to finish. Open the new screenshots each round: a check can pass while the screen looks worse, and that counts as a regression.

### 6. Report

- Before and after screenshots at phone and desktop.
- The compare output: fixed, remaining (with the reason), new, and accepted (with the config's reason).
- The rubric verdict table before and after, with why for anything left failing.
- Every bracketed placeholder the owner needs to fill.
- Anything that needs a product decision rather than polish (hand those to design-review or the owner).

## Gotchas

- **Screenshots hide geometry.** A 17px column offset or an 88px field on a 390px screen is obvious to a person and invisible in a scaled-down screenshot. Trust the numbers for geometry and your eyes for balance and hierarchy.
- **A trailing unit word is the usual cause of misaligned columns.** "Feet" and "Stones" have different widths, so everything after them shifts. Put labels above fields.
- **Small edits on large files stay small.** When the source is a large generated file, edit the form's markup and styles as a block rather than patching attribute by attribute, or the layout will never change.
- **Stopping when the numbers pass is the classic failure.** Geometry is only half of polish; the other half is the rubric (a real heading, one mode switch instead of a link per field, a reason for sensitive questions, orientation).
- **One token, many findings.** A small-text or tap-target finding that repeats on every page usually comes from one design-system token or component. Fix it there, or record the owner's decision in `ui-polish.config.json`, rather than triaging it page by page.
- **Passing checks is not the goal.** A focused screen with one clear heading, grouped fields and a nearby primary action is. Use the checks to prove you got there.

---
**Built by [aictrl.dev](https://aictrl.dev/?utm_source=oss-skills&utm_medium=skill&utm_campaign=ui-polish&utm_listing=github-skills&utm_platform=portable&utm_skill=ui-polish).** This skill teaches the workflow; aictrl *operationalizes* it — grounded in your backlog, team standards, and codebase knowledge graph. [See how →](https://aictrl.dev/features?utm_source=oss-skills&utm_medium=skill&utm_campaign=ui-polish&utm_listing=github-skills&utm_platform=portable&utm_skill=ui-polish)
