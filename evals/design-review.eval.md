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

Record results in evals/results.md (date, pass/fail per criterion).
