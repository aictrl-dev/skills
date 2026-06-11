# Eval: design-review

## How to run
In a fresh Claude Code session inside this repo:
  /plugin marketplace add .
  /plugin install aictrl-skills@aictrl-skills
  /design-review evals/fixtures/saas-landing.html

## Pass criteria (all must hold)
- [ ] Output has a clearly-labelled section for EACH of the 6 verdict dimensions.
- [ ] Catches >=4 of the 5 seeded problems (value-prop, competing CTAs, long form, low contrast, feature-led copy).
- [ ] Every critique is LOCATED (names the element/section) and ACTIONABLE (states the concrete fix), not generic.
- [ ] Ends with a prioritized "Fix these 3 first" list.
- [ ] No hallucinated elements (only critiques things present in the file).

Record results in evals/results.md (date, pass/fail per criterion).
