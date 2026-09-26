# Eval: ui-polish

Fixture: `evals/fixtures/ui-polish/height-weight-step.html`, one step of an online pharmacy consultation (height in feet and inches, weight in stones and pounds, a switch to metric under each, Next). It renders without JavaScript.

## Seeded defects

Measured (the script must report each one on the untouched fixture):

| # | Check | Where |
|---|---|---|
| M1 | `column-alignment` | Inches and Pounds fields sit out of line, because "Feet" and "Stones" differ in width |
| M2 | `accessible-name` | All four fields; the unit words are `<p>`, not labels |
| M3 | `label-after-field` | Feet, Inches, Stones and Pounds follow their fields |
| M4 | `field-fill` | 88px fields fill about two thirds of a phone column |
| M5 | `input-font-size` | Field text is 14px |
| M6 | `tap-target` | "Switch to centimetres / kilograms" are 14px tall |
| M7 | `contrast` | The switch links are about 3:1 |
| M8 | `heading` | The question is a `legend` styled as bold text; no heading |
| M9 | `action-below-fold` / `dead-space` | A forced full-height layout pushes Next below the first phone screen |

Judged (visible only to the rubric):

| # | Point |
|---|---|
| J1 | No progress in words, only a bar |
| J2 | No reason given for asking height and weight |
| J3 | The unit choice is two text links under the fields, not one control before them |
| J4 | The form has no focal point: small question text, bare fields, nothing groups the task |

## Noise fixtures

`measure.cjs` must not report what a reviewer would drop by hand. One generic page per false-positive class sits in `evals/fixtures/ui-polish/noise/`; `test/ui-polish-measure.test.mjs` runs them (it needs Playwright with Chromium and skips without it).

| # | Fixture | Run with | Must not warn or error on | Must report |
|---|---|---|---|---|
| N1 | `checkbox-label.html` | | `tap-target` (20px checkbox and radio in 44px label rows) | |
| N2 | `honeypot.html` | | `tap-target`, `text-size`, `contrast`, `input-font-size`, `accessible-name` (off-screen, `aria-hidden`, `tabindex="-1"` honeypots, sr-only text) | hidden text absent from `copy` |
| N3 | `inline-link.html` | | `tap-target` (links inside a sentence in a `label` and a `span`) | |
| N4 | `eyebrow.html` | | `text-size` | the uppercase labels as `info` |
| N5 | `scoped-heading.html` | `--scope "#signup"`, `--scope "#prefs"` | `heading` | `info` "Heading is outside the scope" |
| N6 | `content-page.html` | `--profile content` | `type-scale`, `action-distance`, `action-below-fold`, `dead-space` | the four fire under the default profile |
| N7 | `config-ignore.html` | `--config` with a `.fine-print` rule | `text-size` | the finding under `accepted` with its reason |
| N8 | `overlay.html` | `--hide ".cookie-banner"` | `tap-target`, `text-size` | |

Positive controls (must still fire): `controls-bare-checkbox.html` (a bare 20px checkbox is an error; a 30px label row is a warning that says the label extends it; a standalone link is measured), `controls-small-body.html` (a 13px paragraph is a `text-size` warning, not info), `controls-missing-heading.html` with `--scope "#bare"` or `"#far"` (a `heading` warning).

## How to run

Run it blind: the agent under test gets the skill and the fixture only, never this file (the seeded lists would tell it what to fix). Grade afterwards against the seeded lists above.

1. Copy the fixture to a scratch directory and point the skill at the copy:
   `Polish the UI of <copy>/height-weight-step.html`
2. The skill measures, fixes the copy and re-measures (see SKILL.md).

## Pass criteria (all must hold)

- [ ] The before run reports every measured seed M1–M9.
- [ ] The after run reports no errors; any remaining warning has a stated reason in the report.
- [ ] Before and after screenshots at phone and desktop are included, and the after screenshots show no regression (nothing clipped, overlapping or harder to use than before).
- [ ] At least three of the four judged seeds J1–J4 are fixed visibly, each located in the report.
- [ ] The content is intact: feet, inches, stones and pounds fields, a way to switch to centimetres and kilograms, and Next.
- [ ] No invented copy: the `--compare` step reports no `invented-number`, and every new claim about purpose, privacy or treatment is a bracketed placeholder listed for the owner.
- [ ] Noise: every fixture N1–N8 is quiet for its checks and reports what the table requires, and every positive control still fires (`npm test` with Playwright available).
- [ ] Noise on a real page: the before run has no finding the agent must drop as a false positive of the N1–N8 classes (hidden fields, label-row checkboxes, links in a sentence, eyebrow labels, a heading beside a scoped form, form-step checks on a content page, overlays given to `--hide`).

Record results in evals/results.md (date, pass/fail per criterion, and the before/after finding counts).
