# Production MCP rehearsal of P3 — 2026-10-16

**Status:** PASS — P3 (judge a recorded code-review finding) against production
`https://aictrl.dev/mcp`.

**Scope:** this record covers the tool contract only. The calls came from an
MCP client (Claude Code) authenticated as an owner of the `Plugin Reviewer`
organization, not from the portal reviewer identity, and not from ChatGPT web.
The ChatGPT web run of the 1.2.0 P3 remains open in
[`readiness.md`](./readiness.md).

## Case

The prompt is P3 in [`test-cases.md`](./test-cases.md). It was run against
fixture
[PR #4](https://github.com/aictrl-dev/aictrl-plugin-reviewer-fixture/pull/4).

| Item | Value |
|------|-------|
| Organization | `Plugin Reviewer` (`78bbed0f-9ff1-4d1d-ba7d-1ec1a7e70adb`) |
| Finding | `40793185978424b1` — MINOR, `JSDoc step order (trim then lowercase) mismatches code` |
| Review | `bee6eaec-fed7-4ad1-8326-d07f5190a7cf` |
| Reviewed commit | `8587f86996681be971fae71e9d3bf547a4efb778` (code lowercases, then trims; the JSDoc says trim first) |
| PR head | `4c5f0ba6d5be34ccdfe5c19c986d47e44b4e1d3c` (reorders the code to match the JSDoc) |

## Tool trace

1. `list_organizations` returned `Plugin Reviewer`.
2. `list_pr_findings` for PR 4 returned four open, unjudged findings with their
   exact IDs and context snippets, including `40793185978424b1`.
3. `record_finding_verdict` with `finding_id: 40793185978424b1`,
   `verdict: TRUE`, `action: FIX`,
   `judged_at_sha: 8587f86996681be971fae71e9d3bf547a4efb778`, evidence
   `src/labels.mjs` lines 9 and 24, and an observed / root-cause / proof
   reasoning chain.

## Observed result (2026-10-16T13:03:35Z)

| Field | Value |
|-------|-------|
| `judgmentId` | `2cc18db3-c9cb-4169-b9ee-7bce87fff03e` |
| `judgedShaVerified` | `true` |
| `evidenceProvenance` | `verified` (both evidence lines `verifiedAtJudgedSha: true`) |
| `lifecycleStatus` | `open` |
| `autoDismissed` | `false` (`verdict-not-false`) |

Nothing was posted to GitHub.

## Correction

An earlier attempt the same day (12:46Z) judged the finding at the PR head
`4c5f0ba`. The server accepted it, but it was wrong, because that commit fixes
the mismatch. The verdict above replaced it as the finding's latest verdict.
The earlier judgment is still in the append-only history. P3 now pins the
reviewed commit.
