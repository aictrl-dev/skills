# Eval: create-workflow

## Scenarios

Run a fresh agent against the five task requests in
`evals/fixtures/create-workflow/tasks.md`. Give the agent the public
`create-workflow` skill and the task request, but not the corresponding file
under `evals/fixtures/create-workflow/expected/`.

The suite covers:

1. issue implementation with a merge-review gate;
2. confirmed-regression repair with reproduction and regression-test evidence;
3. conditional PR review triage;
4. bounded review/fix convergence; and
5. collaborator-authorized comment-triggered review.

## Deterministic checks

1. Install `ajv`, `ajv-formats`, and `js-yaml` in a scratch project.
2. Run `node skills/create-workflow/validate.mjs` against every generated
   workflow and every `evals/fixtures/create-workflow/expected/*.yaml` shape.
3. Check each generated workflow against its task-specific shape assertions in
   `evals/fixtures/create-workflow/tasks.md`.
4. Run `./scripts/validate-skills.sh`.

## Pass criteria

- [ ] Each output is one direct `.aictrl/workflows/<kebab-name>.yaml` file.
- [ ] Every output uses `schemaVersion: aictrl/workflow/v2`, declared typed
      inputs, explicit mappings, and only the fixture's available pinned skills.
- [ ] Each generated file and each expected shape passes the bundled schema and
      static DAG validator.
- [ ] The agent satisfies the scenario-specific gate, condition, loop, output,
      and trigger requirements rather than merely producing schema-valid YAML.
- [ ] The agent reports path, inputs, stages, side effects, approvals, limits,
      unresolved references, and validation result.
- [ ] It does not apply, publish, start, overwrite, commit, push, merge, or
      deploy without the separately required authorization and capability.
