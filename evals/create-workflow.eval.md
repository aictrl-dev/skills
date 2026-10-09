# Eval: create-workflow

## Scenario

Ask a fresh agent to create a workflow that takes a repository and issue ID,
runs `implement-code-change`, pauses for approval before merge, and never deploys.

## Deterministic checks

1. Install `ajv`, `ajv-formats`, and `js-yaml` in a scratch project.
2. Run `node skills/create-workflow/validate.mjs` against all examples
   under `reference/examples/`.
3. Run `./scripts/validate-skills.sh`.

## Pass criteria

- [ ] The output is one direct `.aictrl/workflows/<kebab-name>.yaml` file.
- [ ] It uses `schemaVersion: aictrl/workflow/v2` and a version-pinned inline
      `task` node for `implement-code-change`.
- [ ] Repository and issue ID are typed workflow/task parameters with explicit mappings.
- [ ] Merge is behind an explicit manual gate and deploy is absent.
- [ ] The file passes the bundled schema and static DAG validator.
- [ ] The agent reports path, inputs, stages, side effects, approvals, limits,
      unresolved references, and validation result.
- [ ] It does not apply, start, overwrite, commit, or push without authorization.

## Scenario: label → PR

Ask a fresh agent: "Set up label → PR for repo `acme/web` on branch
`develop`." The organisation already runs the same workflow in `acme/api`.

### Deterministic checks

1. Run `node skills/create-workflow/validate.mjs` against the generated file;
   it must exit 0. The bundled schema enforces rule 1, so this also proves every
   `taskType: code-review` node has exactly one `pull-request` parameter with
   `required: true`.
2. Control: add a second parameter (for example `repository`) to the review
   node of `reference/examples/issue-to-reviewed-pr.yaml`, or set its
   parameter to `required: false`; `validate.mjs` must exit 1.

### Pass criteria

- [ ] The agent starts from `reference/examples/issue-to-reviewed-pr.yaml` and
      changes only the name, label, skills and the base branch, replacing
      every `main`/`origin/main` in the prompts and description with
      `develop`; the prompts are otherwise unchanged.
- [ ] Rule 1: every `taskType: code-review` node has exactly one parameter,
      `type: pull-request`, `required: true`.
- [ ] Rule 2: `name` is prefixed with the repository (for example
      `web-implement-issue-from-ai-fix`) and the file lives in `acme/web`'s own
      `.aictrl/workflows/`.
- [ ] Rule 3: the report says the workflow syncs about 20 s after the file
      reaches the default branch, with no manual sync step.
- [ ] Rule 4: the PR lookup uses `closedByPullRequestsReferences`, not
      `linkedBranches`, and the agent warns, before writing the file, that it
      lists only PRs into the default branch when `develop` is not the default
      branch.
- [ ] Rule 5: read-only steps post no comments; every step that comments or
      pushes starts its ownership check from the `issue-url`/`repository`
      trigger inputs and never relies on a branch name or PR text alone;
      blocked comments use `Workflow blocked: <reason-code>` and do not link
      the PR.
- [ ] The file passes the bundled schema and static DAG validator.
