# Measured checks

What `scripts/measure.cjs` measures, the threshold, why it matters, and the usual fix. Thresholds live at the top of the script (`TH`); change them there, not per run.

| Check | Severity | Threshold | Why it matters | Usual fix |
|---|---|---|---|---|
| `column-alignment` | error | Fields in the same column of consecutive rows start within 2px of each other | Misaligned columns read as untidy even when nobody can say why | A grid with fixed column tracks (`display: grid; grid-template-columns: 1fr 1fr`), labels above fields, no trailing text inside the row |
| `equal-widths` | warn | Repeated fields differ by at most 2px | Unequal boxes for equal inputs look accidental | Let the grid size the fields (`width: 100%` inside equal tracks) |
| `field-fill` (phone) | warn | A row of fields spans at least 75% of its column | Small boxes on a phone look unfinished and are harder to hit | Full-width fields inside the column; two per row for paired values |
| `accessible-name` | error | Every field has a label, `aria-label` or `aria-labelledby` | Screen readers announce unnamed fields as "edit text", so paired fields become indistinguishable | `<label for>` above each field, or `aria-labelledby` pointing at the question and the unit |
| `label-after-field` | warn | No short label sits to the right of a field on the same line | Trailing units shift columns and are read after the value | Label above the field ("Feet"), or a unit suffix inside the field's right edge |
| `tap-target` (phone) | error when the smaller side is below 24px, else warn | Controls at least 44×44px. A checkbox or radio counts with its label (see below); a link inside a sentence is exempt | Small targets cause mis-taps, worst for text-link buttons | Pad the control, or turn a text link that switches a mode into a segmented control; for a checkbox, make its label row 44px tall |
| `input-font-size` (phone) | warn | Field text at least 16px | iOS Safari zooms the page when a smaller field is focused | `font-size: 16px` (or larger) on inputs |
| `text-size` | warn; info for eyebrow labels | No text below 14px; one finding per viewport listing each size and style group | Small text is hard to read on phones and for older users | Move helper text to 14px at least; change the token once, not every use |
| `contrast` | error | WCAG AA: 4.5:1 for text, 3:1 for large text | Low-contrast links and hints disappear | Darken the text colour; do not rely on underline alone for a link |
| `type-scale` (form profile) | info | At most 6 distinct font sizes | Too many sizes flatten the hierarchy | Map sizes onto the project's type scale |
| `overflow` | error | Nothing extends past the viewport | Sideways scroll breaks the page on phones | Remove fixed widths; `min-width: 0` on flex and grid children; wrap long rows |
| `heading` | warn; info when the heading is just outside the scope | A visible heading in the content | The question should be the page's heading, for scanning and for screen readers | Make the main question an `h1` (or the step's single heading) |
| `action-distance` (form profile) | warn | The primary action is at most 25% of the viewport height below the last field | A far-away Next reads as disconnected and makes the step feel longer | Place the action right after the fields; pin it to the bottom only on long, scrolling steps |
| `action-below-fold` (form profile) | error | The primary action is on the first screen when the fields are | The user fills everything and then has to hunt for Next | Remove forced full-height layouts (`min-height: 100vh` with `justify-content: space-between`) |
| `dead-space` (form profile) | warn | No empty band inside the content larger than 30% of the viewport height above the action | Large empty areas mid-form look broken | Same as above; use the space for the reason you ask, or nothing |
| `invented-number` (compare) | error | No number in new copy outside `[brackets]` | Step counts, times and doses the screen never stated are the most common invented facts | Put the number in a bracketed placeholder for the owner, or remove it |

## How the checks decide

- **Hidden elements are skipped.** Tap targets, text size, contrast, form fields and the copy list ignore what is in the DOM but not on screen: sr-only / visually-hidden text (`clip: rect(0 0 0 0)` or `clip-path: inset(50%)` at 1px or less), elements entirely off-screen (for example `left: -9999px`), anything inside `aria-hidden="true"`, and `tabindex="-1"` controls inside a zero-size clipping wrapper (the usual spam honeypot).
- **Checkbox and radio targets include the label.** Tapping a label toggles its control, so the target is the union of the control and a label that wraps it or sits within `TH.labelGapPx` (12px) of it. A 20px checkbox in a 44px-tall label row passes; when the label helps but the row is still short, the message says "its label extends it to W×Hpx".
- **Inline links are exempt** (WCAG 2.5.8): an inline `<a>` inside a `p` or `li`, or whose parent (or nearest inline ancestor) has words of its own around the link, such as `I agree to the <a>terms</a>.` inside a `label` or `span`. A link standing alone in a `div` is still measured.
- **Small text is one finding per viewport.** Text below 14px is broken down into groups by rounded size and style token (the nearest class naming a size or text role, such as `.text-small`, `.caption` or `.text-[12px]`, else the tag), for example `17 text runs below 14px: 13px × 12 (.text-small), 12px × 5 (.caption)`. The finding's `groups` field keeps each group's size, signature, count and up to three example selectors.
- **Eyebrow labels are info.** A small run of at most four words, with no lower-case letters on screen (usually `text-transform: uppercase`) and letter-spacing of at least 0.04em, is the eyebrow or kicker pattern. It is reported as `info`: small by design, but still worth a look on a phone. Eyebrow groups form their own `info` finding per viewport (each group has `eyebrow: true`), so they never raise the warning.
- **A heading just outside the scope counts.** With `--scope` narrower than `main` (a form, a card), there is no warning when a heading labels the scope through `aria-labelledby`, or when the nearest heading before it ends within one viewport height above the scope's top. The heading check reports `info` ("Heading is outside the scope") instead.

- **One cause, one finding.** Fields in the scope that share a font size below 16px are one `input-font-size` finding ("6 fields use 15px text…"), and controls with the same tag, type, classes and short side are one `tap-target` finding. A grouped finding carries `count`, up to three `examples` and every member's selector and anchor in `members`.
- **Identical on both viewports, reported once.** A finding with the same check, severity, element and message on phone and desktop is written once with `viewports: ["phone", "desktop"]`; `viewport` stays the first of them for older readers, and the printed counts count it once. `--compare` expands both files to (viewport, element) pairs before matching, so merging or grouping is never reported as a fix, and files from older versions still compare.

## Profiles

`--profile form` (default) runs every check. `--profile content` is for articles, docs and other long-form pages: it skips `type-scale`, `action-distance`, `action-below-fold` and `dead-space`, which assume a single form step with one primary action.

## Accepted decisions

A finding the owner has decided to keep goes in `ui-polish.config.json`, read from `--config <file>` or the current directory:

```json
{ "ignore": [{ "check": "text-size", "selector": ".eyebrow", "reason": "brand kicker labels, approved by design" }] }
```

A rule matches a finding when `check` is the same (omit it to match any check) and the finding's element, or an ancestor of it, matches `selector` (omit it to match the whole check). Each rule needs a `reason`. Matching findings move from `findings` to `accepted` in `measure.json` with the reason, are printed in an "Accepted" section, do not change the exit code, and are listed separately by `--compare`. A selector that is not valid CSS is reported and never matches.

## Several targets

`measure.cjs <t1> <t2> … --out dir` writes each target to `dir/<slug>/` (the URL path or file name) and `dir/summary.json`, and prints one rolled-up list. Findings merge when they share a check, a selector with `:nth-of-type` indexes removed (for small text, each size and style group; for grouped findings, the group), and a message with numbers and quoted text blanked; each merged line lists the pages it appears on. Exit 1 if any target has an error, 3 if any target failed to load. One target writes to `dir/` as before.

Limits: the script measures the rendered DOM, not intent. It cannot tell whether a label is the right word, whether the heading says the right thing, or whether the page looks trustworthy; that is the rubric's job. Contrast is skipped on text over images or gradients.
