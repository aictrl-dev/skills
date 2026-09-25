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

Record results in evals/results.md (date, pass/fail per criterion, and the before/after finding counts).
