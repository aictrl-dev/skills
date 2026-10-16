# Codex plugin listing

Use these values in the OpenAI plugin submission portal. They mirror the root
manifest and the current official submission requirements. Do not submit while
any owner-only item in `readiness.md` remains unresolved.

## Info

| Portal field | Value |
| --- | --- |
| Plugin name | `aictrl.dev` |
| Short description | `Engineering skills and controlled workflows` |
| Long description | `Use essential engineering skills locally, then hand implementation work to versioned aictrl.dev workflows with approvals, evidence, history, and policy controls.` |
| Category | `Productivity` |
| Developer name | `aictrl.dev` |
| Website | `https://aictrl.dev` |
| Support | `https://aictrl.dev/support` |
| Privacy policy | `https://aictrl.dev/privacy` |
| Terms of service | `https://aictrl.dev/terms` |
| Demo recording | `https://aictrl.dev/plugin-demo/aictrl-chatgpt-developer-mode-demo.mp4` |
| Brand color | `#4c6ef5` |
| Logo | `assets/icon.svg` |

Select the verified `aictrl.dev` business identity. Stop if that identity is
absent, the public URLs do not match it, or the submitter lacks Apps Management
write access.

The public directory name is `aictrl.dev`. The repository-root install ID stays
`aictrl`; do not rename the package or MCP server to match the display name.

## MCP

Choose the submission type **With MCP** and include the final skills tree.

| Portal field | Value |
| --- | --- |
| Production MCP URL | `https://aictrl.dev/mcp` |
| Authentication | OAuth 2.1 |
| Custom UI | None |
| Browser fetch domains | None |
| Content-security-policy allowlists | Empty |

The package contains no `.app.json`, web component, iframe, browser script, or
browser-side fetch. Do not add analytics or website domains to the browser CSP.
If the portal scan discovers a browser dependency, stop and resolve the
unexpected behavior before submission.

When the portal provides a domain challenge, host that exact token at the
well-known URL it specifies and return only the token as plain text. Treat it as
an operational value: never commit it or store it in CI, Terraform, release
evidence, or shell history.

Require exactly these production tools:

1. `list_organizations`
2. `query_context`
3. `update_backlog`
4. `list_workflows`
5. `get_workflow`
6. `start_workflow`
7. `list_workflow_runs`
8. `get_workflow_run`
9. `approve_workflow_step`
10. `cancel_workflow_run`
11. `list_tasks`
12. `start_task`
13. `get_task_execution`
14. `list_pr_findings`
15. `record_finding_verdict`
16. `get_started`

Scan again after any server change. Tool names, descriptions, input/output
schemas, and `readOnlyHint`, `openWorldHint`, `destructiveHint`, and
`idempotentHint` annotations must match deployed behavior.

The sixteen-tool contract is pinned to backend commit
[`12a866d437dcb238f39e491f38597ea8583ece69`](https://github.com/aictrl-dev/aictrl/commit/12a866d437dcb238f39e491f38597ea8583ece69),
deployed by [run 38956595560](https://github.com/aictrl-dev/aictrl/actions/runs/38956595560).
`record_finding_verdict` is a write with `readOnlyHint: false`,
`destructiveHint: true`, and `openWorldHint: true`: a FALSE verdict on an open
minor or nit finding dismisses it and the verdict replaces the latest one. Its
public annotations do not declare `idempotentHint`. `start_workflow` is also
`destructiveHint: true` (with `idempotentHint: true`), because a run can update
existing resources that cancelling it does not undo. The two code-review tools' published
`organization_id` property omits `minLength`, and `list_pr_findings` omits
top-level `additionalProperties`. These are explicit metadata exceptions, not
a claim that the published schema rejects unknown inputs or that handler-side
authorization is optional. Keep every other tool's existing strict contract.

The catalog smoke lists the verdict tool but never invokes it: runtime probes
remain `list_organizations`, no-org `list_workflows`, and the denied-org read.

## Skills, prompts, and tests

Upload the final root `skills/` tree from the tagged release commit. Use exactly
the three starter prompts from `.codex-plugin/plugin.json`:

1. `Turn this request into an implementation-ready issue.`
2. `Implement this issue and prepare a merge-ready pull request.`
3. `Review this pull request at its current head revision.`

Upload exactly the five positive and three negative cases from `test-cases.md`.
Every connected case must use the dedicated fixture and reviewer account
described in `reviewer-fixture.md`.

## Submit and publish

Select only regions covered by current product, support, privacy, and legal
commitments. Complete policy attestations after the final listing, MCP scan,
skills, prompts, tests, credentials, and availability are accurate. Submission
starts review; after approval, the owner must explicitly publish and complete a
clean universal-directory smoke test in both ChatGPT and Codex.
