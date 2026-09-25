# Measured checks

What `scripts/measure.cjs` measures, the threshold, why it matters, and the usual fix. Thresholds live at the top of the script (`TH`); change them there, not per run.

| Check | Severity | Threshold | Why it matters | Usual fix |
|---|---|---|---|---|
| `column-alignment` | error | Fields in the same column of consecutive rows start within 2px of each other | Misaligned columns read as untidy even when nobody can say why | A grid with fixed column tracks (`display: grid; grid-template-columns: 1fr 1fr`), labels above fields, no trailing text inside the row |
| `equal-widths` | warn | Repeated fields differ by at most 2px | Unequal boxes for equal inputs look accidental | Let the grid size the fields (`width: 100%` inside equal tracks) |
| `field-fill` (phone) | warn | A row of fields spans at least 75% of its column | Small boxes on a phone look unfinished and are harder to hit | Full-width fields inside the column; two per row for paired values |
| `accessible-name` | error | Every field has a label, `aria-label` or `aria-labelledby` | Screen readers announce unnamed fields as "edit text", so paired fields become indistinguishable | `<label for>` above each field, or `aria-labelledby` pointing at the question and the unit |
| `label-after-field` | warn | No short label sits to the right of a field on the same line | Trailing units shift columns and are read after the value | Label above the field ("Feet"), or a unit suffix inside the field's right edge |
| `tap-target` (phone) | error below 24px, else warn | Controls at least 44×44px | Small targets cause mis-taps, worst for text-link buttons | Pad the control, or turn a text link that switches a mode into a segmented control |
| `input-font-size` (phone) | warn | Field text at least 16px | iOS Safari zooms the page when a smaller field is focused | `font-size: 16px` (or larger) on inputs |
| `text-size` | warn | No text below 14px | Small text is hard to read on phones and for older users | Move helper text to 14px at least |
| `contrast` | error | WCAG AA: 4.5:1 for text, 3:1 for large text | Low-contrast links and hints disappear | Darken the text colour; do not rely on underline alone for a link |
| `type-scale` | info | At most 6 distinct font sizes | Too many sizes flatten the hierarchy | Map sizes onto the project's type scale |
| `overflow` (phone) | error | Nothing extends past the viewport | Sideways scroll breaks the page on phones | Remove fixed widths; `min-width: 0` on flex and grid children; wrap long rows |
| `heading` | warn | A visible heading in the content | The question should be the page's heading, for scanning and for screen readers | Make the main question an `h1` (or the step's single heading) |
| `action-distance` | warn | The primary action is at most 25% of the viewport height below the last field | A far-away Next reads as disconnected and makes the step feel longer | Place the action right after the fields; pin it to the bottom only on long, scrolling steps |
| `action-below-fold` | error | The primary action is on the first screen when the fields are | The user fills everything and then has to hunt for Next | Remove forced full-height layouts (`min-height: 100vh` with `justify-content: space-between`) |
| `dead-space` | warn | No empty band inside the content larger than 30% of the viewport height above the action | Large empty areas mid-form look broken | Same as above; use the space for the reason you ask, or nothing |
| `invented-number` (compare) | error | No number in new copy outside `[brackets]` | Step counts, times and doses the screen never stated are the most common invented facts | Put the number in a bracketed placeholder for the owner, or remove it |

Limits: the script measures the rendered DOM, not intent. It cannot tell whether a label is the right word, whether the heading says the right thing, or whether the page looks trustworthy; that is the rubric's job. Contrast is skipped on text over images or gradients.
