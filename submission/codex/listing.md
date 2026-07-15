# Codex plugin listing

Use these values in the OpenAI plugin submission portal. They mirror the root
manifest and the current official submission requirements. Do not submit while
any owner-only item in `readiness.md` remains unresolved.

## Info

| Portal field | Value |
| --- | --- |
| Plugin name | `AICtrl` |
| Short description | `Engineering skills and controlled workflows` |
| Long description | `Use eleven portable engineering skills locally, then hand implementation work to versioned AICtrl workflows with approvals, evidence, history, and policy controls.` |
| Category | `Productivity` |
| Developer name | `aictrl.dev` |
| Website | `https://aictrl.dev` |
| Support | `https://aictrl.dev/support` |
| Privacy policy | `https://aictrl.dev/privacy` |
| Terms of service | `https://aictrl.dev/terms` |
| Brand color | `#4c6ef5` |
| Logo | `assets/icon.svg` |

Select the verified `aictrl.dev` business identity. Stop if that identity is
absent, the public URLs do not match it, or the submitter lacks Apps Management
write access.

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

1. `list_workflows`
2. `get_workflow`
3. `start_workflow`
4. `get_workflow_run`
5. `approve_workflow_step`
6. `cancel_workflow_run`

Scan again after any server change. Tool names, descriptions, input/output
schemas, and `readOnlyHint`, `openWorldHint`, and `destructiveHint` annotations
must match deployed behavior.

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
