# Eval Results

## design-review — 2026-06-11 (dry-run by author)

(skill renamed from `design-roast` → `design-review` on 2026-06-11; eval evidence unchanged)

Method: followed the skill's own Process against `evals/fixtures/saas-landing.html` and checked
the resulting critique against every pass criterion in `evals/design-review.eval.md`.

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

(design-review independently re-reviewed by a second agent on 2026-06-11: Stage 1 spec-compliance PASS, Stage 2 quality APPROVED, 5/5 seeded problems, low hallucination risk.)

## v0.1 publish acceptance — 2026-06-11

Repo: https://github.com/aictrl-dev/skills (PUBLIC), default branch `main`.

| Acceptance criterion | Result |
|----------------------|--------|
| Public, no-auth fetch of `marketplace.json` (anon SHA-pinned raw) | PASS (HTTP 200, valid JSON, 3 plugins) |
| All 3 skills present on remote `main` | PASS (design-review, measurement-plan, create-issue) |
| design-review passes its eval | PASS (5/5, reviewer-approved) |
| No aictrl-stack leakage in ported skills | PASS (grep clean; only product-pull URLs reference aictrl) |
| README install block copy-paste-correct | PASS (`aictrl-dev/skills`, `design-review@aictrl-skills`) |

GitHub-proxy metrics baseline (day 0): stars=0, forks=0.

Pending (human): real interactive install test — in a fresh Claude Code session run
`/plugin marketplace add aictrl-dev/skills` then `/plugin install design-review@aictrl-skills`
and confirm no auth prompt. (The `/main/` raw CDN may show stale 404s for a few minutes
post-push; SHA-pinned fetch already confirms anonymous availability.)

## recording-product-demo — 2026-06-12 (engine check by author)

Method: ran the deterministic engine check from `evals/recording-product-demo.eval.md`
against the fixtures in `evals/fixtures/recording-product-demo/`, plus a full no-API
pipeline smoke (local static site + synthetic silent narration + canned STT →
record → assemble → publish).

| Criterion | Result |
|-----------|--------|
| Timeline golden (fuzzy STT alignment, "Dashboard"→"dash board" rewrite) | PASS (boundaries 2.37s / 4.67s, exact) |
| Assembly dry-run synthesis (-ss from t0, -t = end+1.4, crop/scale chain) | PASS |
| All scripts parse (6 × .cjs + splitter) | PASS |
| Config example contract (app/auth/brand/voice/record/publish) | PASS |

Pipeline smoke (not part of the eval, recorded as evidence): framework recorder loaded
`demo/blocks.cjs`, produced a zero-WARN time-locked take of a local static site with
anonymisation verified in the frames (textMap rewrite visible in the recording, source
untouched); assemble produced main/final/grid from `take-meta.json` alone; publish built
the complete kit (faststart, 720p, poster, captions.srt with correct card offset,
embed.html, PUBLISH.md).

Engine provenance: the same pipeline (pre-generalization) produced a real published
product demo (3:38, ElevenLabs eleven_v3, two card VOs, YouTube + site embed) on
2026-06-12 — the TTS/STT phases are exercised by that production run rather than the
no-API eval.

Pending (human): agent-level check — fresh session in a small web-app repo, confirm
Phase 0 produces demo/boot.sh + demo.config.json and prerequisites are checked up front.
