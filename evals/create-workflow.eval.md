# Eval: create-workflow

## Scenario

Ask a fresh agent to create a workflow that takes a repository and issue ID,
runs `implement-code-change`, pauses for approval before merge, and never deploys.

## Deterministic checks

1. Install `ajv`, `ajv-formats`, and `js-yaml` in a scratch project.
2. Run `node aictrl-skills/skills/create-workflow/validate.mjs` against all examples
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
