# Eval: design-review

## How to run
In a fresh Claude Code session inside this repo:
  /plugin marketplace add .
  /plugin install aictrl-skills@aictrl-oss
  /design-review evals/fixtures/saas-landing.html

## Pass criteria (all must hold)
- [ ] Output classifies the surface (marketing vs product-internal) and has a clearly-labelled section for each universal dimension (U1–U7) plus the matching lens.
- [ ] Catches >=4 of the 5 seeded problems (value-prop, competing CTAs, long form, low contrast, feature-led copy).
- [ ] Every critique is LOCATED (names the element/section) and ACTIONABLE (states the concrete fix), not generic.
- [ ] Ends with a prioritized "Fix these 3 first" list.
- [ ] No hallucinated elements (only critiques things present in the file).

## Cross-screen lens

Run: `/design-review evals/fixtures/multi-screen-app.html`

Pass criteria (all must hold):
- [ ] Output recognises the input as multi-screen and applies the cross-screen lens (X1–X4) after the per-screen dimensions.
- [ ] Includes a concept inventory table (concept → labels used → places).
- [ ] Catches >=4 of the 5 seeded cross-screen problems: one state under three names (Draft / Not ready / Needs work); one job in three places with different counts (Needs attention 4 / Blocked items 2 / Waiting on you 3); three verbs for starting (Run / Launch job / Start); "Plan" used as both a status and a tab; four badges per backlog row.
- [ ] Reports per-screen density numbers (controls, words or badges) for at least the backlog screen.
- [ ] Each cross-screen fix names one label or one home and the places to change.

Record results in evals/results.md (date, pass/fail per criterion).
