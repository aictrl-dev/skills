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
   it must exit 0.
2. Every node with `taskType: code-review` has exactly one parameter, with
   `type: pull-request` and `required: true`:

   ```bash
   node -e "const y=require('js-yaml'),f=require('fs');const d=y.load(f.readFileSync(process.argv[1],'utf8'));const w=n=>(n||[]).flatMap(x=>[x,...w(x.body&&x.body.nodes)]);const bad=w(d.nodes).filter(n=>n.taskType==='code-review'&&!(n.parameters?.length===1&&n.parameters[0].type==='pull-request'&&n.parameters[0].required===true));if(bad.length){console.error('bad code-review nodes:',bad.map(n=>n.id));process.exit(1)}" .aictrl/workflows/<name>.yaml
   ```

### Pass criteria

- [ ] The agent starts from `reference/examples/issue-to-reviewed-pr.yaml` and
      changes only the name, label, base branch (`develop`) and skills; the
      prompts are otherwise unchanged.
- [ ] Rule 1: every `taskType: code-review` node has exactly one parameter,
      `type: pull-request`, `required: true`.
- [ ] Rule 2: `name` is prefixed with the repository (for example
      `web-implement-issue-from-ai-fix`) and the file lives in `acme/web`'s own
      `.aictrl/workflows/`.
- [ ] Rule 3: the report says the workflow syncs about 20 s after the file
      reaches the default branch, with no manual sync step.
- [ ] Rule 4: the PR lookup uses `closedByPullRequestsReferences`, not
      `linkedBranches`, and the agent flags that it lists only PRs into the
      default branch when `develop` is not the default branch.
- [ ] Rule 5: read-only steps post no comments; every step that comments or
      pushes checks ownership against `issue-url`/`repository` trigger inputs,
      not PR-controlled data.
- [ ] The file passes the bundled schema and static DAG validator.
