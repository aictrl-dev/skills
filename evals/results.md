# Eval Results

## ui-polish — 2026-09-25 (fresh-agent fixture trials and a real-page comparison)

Method: fresh Sonnet agents were given only `skills/ui-polish/` and a scratch copy of
`evals/fixtures/ui-polish/height-weight-step.html` (runs 2 and 3 never saw this eval file), and
followed the skill: measure, rubric, fix, re-measure. Criteria were scored afterwards against the
seeded lists in `evals/ui-polish.eval.md`. Separately, the skill was applied blind to a saved copy
of a real online pharmacy's same step (not committed) and graded blind against a better reference
page from another pharmacy, on the same scale as five other public design-review skills given the
same task.

| Criterion | Run 1 (saw eval) | Run 2 (blind) | Run 3 (blind, final) |
|---|---|---|---|
| Before run reports every measured seed M1–M9 | PASS | PASS | PASS |
| After run: no errors, warnings fixed or explained | PASS (39 → 0) | PASS (39 → 0) | PASS (39 → 0) |
| Before/after screenshots, no regression | PASS | PASS | PASS |
| At least 3 of 4 judged seeds J1–J4 fixed and located | PASS (4/4) | FAIL (2.5/4: no reason for asking) | PASS (4/4) |
| Content intact | PASS | PASS | PASS |
| No invented copy | PASS | FAIL ("Step 1 of 6" derived from `aria-valuenow`) | FAIL ("Step 2 of [5]": the 2 unbracketed) |

Changes made from these runs: the rubric became a verdict table that feeds the fix loop (run 1 on
the real page fixed geometry only and stopped when the numbers passed); rubric point 10 split into
five sub-checks so "why we ask" cannot pass silently; values derived from code count as invented;
and `measure.cjs --compare` now lists all new copy and fails with `invented-number` on any number
outside `[brackets]`, which flags run 3's "Step 2 of [5]" mechanically.

Real-page comparison (blind grader, answer key of six gaps written before any run, scored /6):
the rubric-in-loop version scored 5.0 on the critique and 4.5 on the redesign, against 3.0–3.5
and 1.5–4.0 for the five other skills, with no invented copy (two of the others added
unbracketed clinical or privacy claims). It was the only run besides its own first version to
align the fields into equal columns (0px offset, from 17px) and fill the column on a phone.

Verdict: PASS for measurement and fixing; the invented-copy criterion now relies on the
mechanical `invented-number` check added after run 3 and should be re-run on the next release.

## create-issue database/API contracts — 2026-08-30 (fresh-agent fixture trial)

Method: a fresh agent read `skills/create-issue/SKILL.md`, its complete local
contract-impact rubric, `evals/create-issue.eval.md`, and the exact repository
and request fixtures under `evals/fixtures/contract-impact/`. It drafted five
story scenarios and classified the regression request as a defect without
creating or editing a provider issue. Claims were limited to fixture evidence;
missing material values remained owned open questions.

| Criterion | Result |
|---|---|
| Independent evidence-based database and API classification | PASS |
| Complete database schema, migration, consumer, delivery, and verification contract | PASS |
| Schema-changing cases include compact proposed Mermaid ERDs without replacing textual contracts | PASS |
| Database case declares `No API contract change.` without invented work | PASS |
| Complete API operation, request/response/error, authorization, compatibility, delivery, and verification contract | PASS |
| API case declares `No database contract change.` without invented work | PASS |
| Copy-only case contains both exact no-change declarations with concise evidence | PASS |
| Query-only case declares `No ERD topology change.` without inventing schema work | PASS |
| Unsupported material detail remains an owned open question tied to a blocked outcome | PASS |
| Regression request stops and delegates to `create-bug` before contract drafting | PASS |
| Provider neutrality, verifiable criteria, and mutation boundary remain intact | PASS |

Verdict: PASS — the skill produced independently verifiable contract sections
for affected layers, explicit evidence-backed declarations for unaffected
layers, proposed ERDs for entity-shape and relationship changes, an explicit
no-topology path for query-only work, no unsupported requirements, and an
exercised defect-delegation boundary (11/11 criteria).

## spec-review database/API readiness — 2026-08-30 (fresh-agent fixture trial)

Method: a separate fresh agent read `skills/spec-review/SKILL.md`, its matching
standalone contract-impact rubric, `evals/spec-review.eval.md`, the exact
repository evidence fixture, and three literal issue bodies. It reviewed only
those supplied facts and did not read the adjacent create-issue request fixture.
It used owned decision text where the evidence could not establish a value:
specifically, Issue A's desired field/index contract and Issue B's exact
operation/request/response contract. It posted no comment, changed no issue,
and implemented no code.

| Criterion | Result |
|---|---|
| Repository evidence inspected beyond issue prose | PASS |
| Acceptance traceability and independent database/API readiness reporting | PASS |
| Incomplete database contract is `NOT READY`, including the missing proposed ERD | PASS |
| Incomplete API contract is `NOT READY` with every seeded gap named | PASS |
| Findings give exact locations, evidence, and replacement, criterion, or owned-decision text | PASS |
| Supported copy-only no-change declarations are accepted as `READY` without invented work | PASS |
| Severity and verdicts follow the shared readiness gate | PASS |
| Review-only external-mutation and implementation boundaries remain intact | PASS |

Repository verification on the updated rubric and fixtures also passed: the
focused public-distribution suite passed 7/7; `npm test` ran 28 tests (26
passed, 2 skipped); `npm run validate` validated all 14 public skills and the
canonical plugin; `git diff --check` found no whitespace errors; the two rubric
copies were byte-identical; and the 53-entry release checksum manifest exactly
matched fresh generation. The two skips were the renderer-dependent Mermaid
cases `renders a valid Mermaid block to SVG` and `reports invalid syntax
without masking successful sibling diagrams`; the OpenCode installer and
npm-package distribution tests both passed.

Verdict: PASS — materially incomplete database and API contracts block
readiness with actionable replacement text, while supported unaffected-layer
declarations do not create artificial scope.

## database/API contracts — pinned real-issue replay (2026-08-30)

Method: fresh agents applied the updated `create-issue` and `spec-review`
skills read-only to `aictrl-dev/aictrl` issues 4667 and 4635 at pinned repository
revision `0565cb3e2d3c11a0c01bfd8731332199334c66ae`. This repeated the earlier
field trial with the issue bodies and target revision held constant. No issue,
repository file, or Git reference was changed.

| Scenario | Expected behavior | Result |
|---|---|---|
| Additive account-consent state (#4667) | Produce an actual proposed ERD, keep physical table/FK choices unresolved, retain textual schema and API contracts, and return `NOT READY` for the incomplete original issue | PASS |
| Behavioral workflow-run reads (#4635) | State `No ERD topology change.` with query/index evidence, produce no misleading diagram or DDL, retain the exact API contract, and return `NOT READY` for the incomplete original issue | PASS |
| Existing stale/unrelated ERD | Identify that it cannot substitute for the affected PostgreSQL model and emit Mermaid rather than merely promise a later file update | PASS |
| Fact discipline | Distinguish current, decided desired, and unresolved proposed details without inventing a physical relationship | PASS |

The first #4667 replay exposed that a compliant response could merely name an
existing canonical ERD. The rubric was tightened to require an actual focused
repository-native diff or Mermaid artifact; stale or unrelated ERDs now require
Mermaid plus an explicit reconciliation follow-up. A final fresh-agent replay
produced the bounded `USERS`/`ACCOUNT_CONSENT_STATE` diagram with unresolved SQL
types and physical mapping marked `TBD` and reported no remaining prompt defect.

Limitation: the pinned revision already contains the merged implementation for
#4635, so that scenario is a documentation reconstruction rather than a true
pre-implementation readiness review. It still isolates the changed skill
behavior because both field-trial rounds used the same issue and revision.

## create-pr — 2026-08-11 (scenario walk-through and forward test)

Method: followed `skills/create-pr/SKILL.md` against the seeded scenario in
`evals/create-pr.eval.md`, grounding the draft in the pinned revision, linked
issue, endpoint/flag implementation, and test source. This behavioral desk
check made no pull-request mutation. An independent fresh-agent forward test
then drafted the requested title/body from the same scenario; it excluded the
unrelated working tree and labelled the green-suite and deployed claims as
unverified. Its title was `feat: add asynchronous export endpoint validation`,
and its body retained `Closes #<linked issue>` while adding no unsupported
metadata. The updated scenario records the documented `feature/*` to
`development` route and proposed `Status = Development` field update without
performing either mutation; the no-link/no-route case requires those details
from the user. The forward test also ruled out direct feature-to-`main`, marked
the unverified `development`-to-release promotion as an open route detail, and
asked for the issue, base, promotion path, and project-field mapping in the
second request. The second request's specification was treated as supplementary
context, not a substitute for the required issue link.

| Criterion | Result |
|---|---|
| Pinned revision and unrelated working-tree boundary | PASS |
| Linked issue, endpoint/flag implementation, and test source inspected | PASS |
| Title names endpoint behavior, not files | PASS |
| Problem, behavior, scope, rollout/risk, and verification body structure | PASS |
| Default-off flag treated as configuration, not a live rollout | PASS |
| Test source kept distinct from a green-suite result | PASS |
| Unknown rollout and executed-verification evidence made explicit | PASS |
| Verified linked-issue close keyword retained; no unsupported metadata preserved | PASS |
| Documented PR route and issue field mapping identified without mutation | PASS |
| Missing issue link and PR route escalated; specification not treated as a substitute | PASS |
| Draft-only flow required explicit confirmation before PR or metadata mutation | PASS |

Verdict: PASS — the skill produces a reviewer-ready draft that is grounded in
the exact change and honest about what has and has not been verified.

## root-cause-analysis — 2026-08-11 (scenario walk-through by author)

Method: followed `skills/root-cause-analysis/SKILL.md` against the seeded
scenario in `evals/root-cause-analysis.eval.md`, using the report template and
causal quality gate. This is a behavioral desk check of the portable skill; no
external action was performed.

| Criterion | Result |
|---|---|
| Falsifiable invariant and fact/inference boundary | PASS |
| Immediate idempotency fix distinguished from systemic causes | PASS |
| Retry ownership, identifier propagation, and observability kept as causal branches | PASS |
| No-blame and evidence-based sibling exposure controls | PASS |
| Prioritized recommendation, prevention portfolio, and quality gate | PASS |
| No unauthorized mutation | PASS |

Verdict: PASS — the skill produces an interim or decision-ready RCA based on
evidence, rather than a single-cause narrative or a blame assignment. It names
a current-state recommendation with preconditions and a safe fallback instead
of leaving the reader to prioritize a catalogue of initiatives.

## explain-change Mermaid render validation — 2026-08-11

Method: executed the pinned Mermaid CLI helper against the bundled valid,
multi-diagram, unavailable-renderer, unsafe-URI, and timeout cases, then ran
the complete repository test and validation suites.

| Criterion | Result |
|---|---|
| Valid Mermaid block renders with the pinned CLI | PASS |
| Invalid sibling block fails without masking a valid block | PASS |
| No-diagram draft skips renderer setup | PASS |
| Missing renderer, unsafe URI, and timeout fail closed | PASS |
| Skill frontmatter and public catalog validation | PASS |

Verdict: PASS — diagram validation is deterministic when the pinned renderer is
available; the skill keeps a bounded repair loop and blocks presentation or
posting when that prerequisite or rendering fails.

## explain-change — real-world dry run — 2026-08-11

Method: used the skill against a pinned revision of a non-public pull request,
without posting or modifying it. This public record deliberately omits the
repository, pull-request identifier, commit, and implementation details. The
exercise traced configuration through shared runtime enforcement, persistence,
and credential resolution. The first Mermaid sequence diagram failed with
`RENDER_ERROR`; only its rejected `Note` construct was replaced, and the
complete draft then rendered successfully.

| Criterion | Result |
|---|---|
| Configuration claim traced through runtime enforcement and persistence | PASS |
| Workflow-scoped credential boundary checked at its later resolver | PASS |
| First diagram failure repaired without changing its technical claim | PASS |
| Final complete draft rendered with pinned Mermaid CLI 11.16.0 | PASS (1/1 diagrams, 2 attempts) |
| Pull request remained read-only | PASS |

Verdict: PASS — the real PR exercise identified and corrected a renderer-only
draft defect while retaining a repository-grounded explanation. The skill now
requires this verification record and configuration-to-runtime trace.

## explain-change — multi-repository forward trial — 2026-08-11

Method: applied the skill to two access-controlled pull requests at their
pinned heads without posting or modifying either. The first concerned bounded
input normalization before model work; the second concerned verification before
scheduled synchronization. Each completed draft's Mermaid diagram rendered
with the pinned CLI on the first attempt.

| Criterion | Result |
|---|---|
| Explains the central boundary or decision rather than narrating files | PASS |
| Treats PR-reported test totals as unverified without an executed run artifact | PASS |
| Distinguishes repository configuration from a verified live rollout | PASS |
| Complete drafts render with pinned Mermaid CLI 11.16.0 | PASS (2 diagrams, 1 attempt each) |

Verdict: PASS — the trials added a reusable evidence-level distinction for test
execution and deployment state, without disclosing repository or pull-request
identifiers.

## explain-change Mermaid safety preflight — 2026-08-11

Method: ran the verifier's unsafe-URI fixture while explicitly pointing its
renderer path at a missing binary, then ran the complete test and validation
suites. The test-harness-only no-sandbox switch remains excluded from the
reader-facing workflow.

| Criterion | Result |
|---|---|
| Unsafe URI is rejected before renderer availability is checked | PASS |
| Missing renderer cannot mask the `UNSAFE_DIAGRAM` result | PASS |
| Normal skill instructions forbid the no-sandbox bypass | PASS |
| Repository test and validation suites | PASS (27 tests) |

Verdict: PASS — Mermaid input safety is now independent of renderer setup, and
the harness exception is scoped so it is not guidance for explainers.

## explain-change — 2026-08-11 (scenario walk-through by author)

Method: walked the public skill through the scenario in
`evals/explain-change.eval.md`, tracing each required decision to its explicit
workflow instruction. This is a behavioral desk check of the portable skill;
it does not claim a live-host posting or fresh-agent integration run.

| Criterion | Result |
|---|---|
| Pins the requested source and treats the local checkout and PR prose as insufficient evidence | PASS |
| Requires a claim ledger tied to code, configuration, and tests | PASS |
| Teaches the stale-writer failure and generation boundary rather than narrating files | PASS |
| Requires a defining-property check before naming a transactional outbox | PASS |
| Makes default-off or unwired rollout state explicit | PASS |
| Limits diagrams to stable, information-bearing Mermaid types | PASS |
| Returns reading order, evidence status, and open questions | PASS |
| Keeps posting as a separately confirmed external mutation | PASS |

Verdict: PASS — the public port preserves the internal skill's truth and
teaching controls without depending on a particular repository, wiki layout,
issue convention, or hosting CLI.

Pending (human): run the scenario in a fresh agent session against a public
repository pull request and verify that the generated draft grounds every claim
in the selected commit.

## create-workflow commandless chat trigger schema sync — 2026-08-22

Method: synchronized the bundled v1 trigger definitions and authoring guidance
with source commit `748107cc025bfaab890a4e37161c8e29a64c3c20`, then ran the
deterministic schema-equivalence, trigger-contract, example, and public-skill
checks.

| Criterion | Result |
|---|---|
| Validation keywords are equivalent to the source schema after removing `description` annotations | PASS |
| Command chat trigger without `chats` remains valid | PASS |
| Commandless chat trigger with a non-empty `chats` allowlist is valid | PASS |
| Commandless chat trigger with missing or empty `chats` is rejected | PASS |
| All bundled workflow examples pass schema and static DAG validation | PASS |
| Public skill checks and checksum manifest pass | PASS |

Verdict: PASS — the portable bundle documents and validates both exact-command
and allowlisted commandless chat triggers without exposing source-only release
annotations.

## public eight-skill launch catalog — 2026-07-13

Method: ran `./scripts/validate-skills.sh` over the full eleven-skill repository,
then ran the bundled `create-workflow/validate.mjs` against all three workflow
examples using AJV Draft 2020-12, `ajv-formats`, and `js-yaml` from a clean
scratch installation.

| Criterion | Result |
|---|---|
| Exact eleven-skill catalog, including all eight launch task names | PASS |
| Folder/frontmatter names and task-oriented trigger descriptions | PASS |
| Per-skill attribution campaign | PASS |
| Secret-pattern and public-document internal-reference scan | PASS |
| No stale `writing-aictrl-workflows` or v2-unavailable claim outside historical results | PASS |
| All bundled workflow v2 examples pass schema and static DAG validation | PASS |

Behavioral eval specifications now exist for all six newly added skills and
`create-workflow`. Interactive fresh-agent executions remain required before the
v1.0.0 release; this structural result does not claim those behavioral runs.

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

## writing-aictrl-workflows — 2026-07-10 (self-consistency check by author)

Method: ran the deterministic self-consistency ("golden") check from
`evals/writing-aictrl-workflows.eval.md` — compiled the bundled
`reference/workflow.schema.json` with AJV Draft 2020-12 (`strict: false`,
`allErrors: true`, `ajv-formats` registered — the same configuration the aictrl
apply-loader uses for layer-1) and validated both bundled example YAMLs against it.
Also ran the leakage grep and the schema provenance diff.

| Criterion | Result |
|-----------|--------|
| `pr-review-and-triage.yaml` validates against bundled schema (AJV 2020-12, strict:false) | PASS (VALID) |
| `review-fix-loop.yaml` validates against bundled schema (same config) | PASS (VALID) |
| Bundled schema is validation-equivalent to source commit `8ee36d05` (only `description` annotations differ) | PASS (diff = 8 in-place `description` lines: 5, 24, 64, 80, 120, 127, 138, 200; no pattern/enum/required/bound/exclusivity change) |
| Leakage grep returns no monorepo-internal anchors | PASS (only match is the schema's public `$id` `https://aictrl.dev/schemas/workflow/v1/...`, an intentional public URI) |
| `SKILL.md` frontmatter is `name` + `description` only; ends with product-pull block (`utm_campaign=writing-aictrl-workflows`) | PASS |

Verdict: PASS — the self-contained bundle is internally consistent (examples apply
against the shipped schema) and leak-free for external readers.

Pending (human): interactive install test — fresh Claude Code / Cursor / OpenCode
session, install the plugin, and confirm `/writing-aictrl-workflows` triggers and
authors a schema-valid file that passes the bundled self-check.

## writing-aictrl-workflows schema sync — 2026-07-12

Method: synchronized the bundled schema and trigger authoring guide with upstream
source commit `3e83fc6332e80138ba6a6eb67a1ce1d479e87a62`, then reran the deterministic
self-consistency, validation-equivalence, leakage, and skill-shape checks.

| Criterion | Result |
|-----------|--------|
| `pr-review-and-triage.yaml` validates against bundled schema (AJV 2020-12, strict:false) | PASS (VALID) |
| `review-fix-loop.yaml` validates against bundled schema (same config) | PASS (VALID) |
| Bundled schema is validation-equivalent to source commit `3e83fc633` (only `description` annotations differ) | PASS |
| Leakage grep returns no monorepo-internal anchors | PASS (only the schema's public `$id`) |
| `SKILL.md` frontmatter and product-pull block remain valid | PASS |

Verdict: PASS — the public bundle now covers the released trigger surface and
remains internally consistent and free of monorepo-only references.
