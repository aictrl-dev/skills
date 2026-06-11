# Eval Results

## design-roast — 2026-06-11 (dry-run by author)

Method: followed the skill's own Process against `evals/fixtures/saas-landing.html` and checked
the resulting critique against every pass criterion in `evals/design-roast.eval.md`.

| Criterion | Result |
|-----------|--------|
| Section for EACH of the 6 verdict dimensions | PASS |
| Catches >=4 of 5 seeded problems | PASS (5/5) |
| Every critique LOCATED + ACTIONABLE | PASS |
| Ends with prioritized "Fix these 3 first" | PASS |
| No hallucinated elements | PASS |

Seeded problems caught (5/5):
- (a) value-prop — "Welcome to Synthwave" / "Reimagine the future of work" flagged as vague slogan → dim 1.
- (b) competing CTAs — three identical filled `.btn` buttons flagged → dim 3 & 4.
- (c) long form — 7-field signup form above the fold flagged → dim 6.
- (d) low contrast — `#aaa` on white (~2.3:1, fails WCAG AA) flagged → craft pass (dim 4/6).
- (e) feature-led copy — "Built with GraphQL / Written in Rust / Powered by Kubernetes" flagged → dim 5.

Verdict: PASS — all 5 criteria hold; output is screenshot-worthy (located + actionable, no fluff).

(design-roast independently re-reviewed by a second agent on 2026-06-11: Stage 1 spec-compliance PASS, Stage 2 quality APPROVED, 5/5 seeded problems, low hallucination risk.)

## v0.1 publish acceptance — 2026-06-11

Repo: https://github.com/aictrl-dev/skills (PUBLIC), default branch `main`.

| Acceptance criterion | Result |
|----------------------|--------|
| Public, no-auth fetch of `marketplace.json` (anon SHA-pinned raw) | PASS (HTTP 200, valid JSON, 3 plugins) |
| All 3 skills present on remote `main` | PASS (design-roast, measurement-plan, create-issue) |
| design-roast passes its eval | PASS (5/5, reviewer-approved) |
| No aictrl-stack leakage in ported skills | PASS (grep clean; only product-pull URLs reference aictrl) |
| README install block copy-paste-correct | PASS (`aictrl-dev/skills`, `design-roast@aictrl-skills`) |

GitHub-proxy metrics baseline (day 0): stars=0, forks=0.

Pending (human): real interactive install test — in a fresh Claude Code session run
`/plugin marketplace add aictrl-dev/skills` then `/plugin install design-roast@aictrl-skills`
and confirm no auth prompt. (The `/main/` raw CDN may show stale 404s for a few minutes
post-push; SHA-pinned fetch already confirms anonymous availability.)
