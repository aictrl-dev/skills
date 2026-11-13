# Eval: create-workflow

## Scenario

Ask a fresh agent to create a workflow that takes a repository and issue ID,
runs `implement-code-change`, pauses for approval before merge, and never deploys.

## Deterministic checks

1. Record the absolute path to `skills/create-workflow`, then change to a new
   empty temporary directory with no `package.json`.
2. For each of the four `reference/examples/*.yaml` files, run this zero-install
   command using absolute paths; each must exit 0:

   ```bash
   timeout 180s npx --yes -p ajv@8 -p ajv-formats@3 -p js-yaml@4 -- node /absolute/path/to/create-workflow/validate.mjs /absolute/path/to/create-workflow/reference/examples/<example>.yaml
   ```

   Confirm that the temporary directory still contains no files, including
   dotfiles, manifests, lockfiles, or `node_modules`.
3. From the skills repository, run `timeout 300s npm test --prefix tooling`
   and `timeout 300s npm run validate --prefix tooling`.

## Pass criteria

- [ ] The output is one direct `.aictrl/workflows/<kebab-name>.yaml` file.
- [ ] It uses `schemaVersion: aictrl/workflow/v2` and a version-pinned inline
      `task` node for `implement-code-change`.
- [ ] Repository and issue ID are typed workflow/task parameters with explicit mappings.
- [ ] Merge is behind an explicit manual gate and deploy is absent.
- [ ] The file passes the bundled schema and static DAG validator.
- [ ] After local success, the agent calls `validate_workflow_file` when listed
      in the connected aictrl MCP catalog, passing `organization_id`, exact file
      `content`, and the repository (`owner/name` from Git remote) and file path
      when known. It uses `list_organizations` if no organization was supplied
      and the tool is listed, asking the user if several organizations exist.
- [ ] The agent fixes every remote error, repeats local validation and remote
      preflight until `valid: true`, and shows all warnings, especially an
      existing workflow with the same name, plus `workflowName`, `action`, and
      `resolvedSkills`.
- [ ] With the tool absent or no aictrl connection, it says "organization checks
      not run" and lists parsing/schema/triggers against import, model and
      organization template/workflow/skill references, layer-2 mappings and
      conditions, and name ownership. It never calls an unlisted tool.
- [ ] The agent reports path, inputs, stages, side effects, approvals, limits,
      unresolved references, and local and remote results separately as
      `passed`, `failed`, or `not run`.
- [ ] It explains that publication means merging the file to the default branch
      for git sync to import, and that there is no publish tool.
- [ ] It does not apply, start, overwrite, commit, or push without authorization.

## Scenario: label → PR

The organization already runs the canonical label → PR workflow sourced from
`acme/api`, targeting base branch `main`. Exercise these requests separately:

1. "Set up the same label → PR workflow for repo `acme/web` on branch `main`."
   Only the repository differs: the agent directs an organization admin to
   Workflow Studio → the workflow → Settings → Triggers → Repositories and
   creates no duplicate file. Local/remote file validation is `not run` because
   no file was authored.
2. "Set up label → PR for repo `acme/web` on branch `develop`." The base branch
   in the prompts must differ: the agent creates a separately named variant
   and explains why a settings-only change cannot express that difference.

For file-authoring scenarios, exercise both a catalog that lists
`validate_workflow_file` and one without it. Include remote error-then-success
and same-name warning responses; preflight must save nothing.

### Deterministic checks

1. For the `develop` variant, run the same zero-install command against the
   generated file from an empty directory; it must exit 0. The bundled schema
   enforces rule 1, so this also proves every `taskType: code-review` node has
   exactly one `pull-request` parameter with `required: true`.
2. Control: add a second parameter (for example `repository`) to the review
   node of `reference/examples/issue-to-reviewed-pr.yaml`, or set its
   parameter to `required: false`; the same zero-install command must exit 1.
   Store the control fixture outside the empty working directory so the
   zero-install proof still confirms that the command created no files there.

### Pass criteria

- [ ] For the settings-only request, the agent creates no duplicate file and
      gives the exact Workflow Studio settings path above. It explains that
      the first git import adds the source repository, and a `repositories:`
      key in the file is a validation error.
- [ ] For the `develop` variant, the agent starts from
      `reference/examples/issue-to-reviewed-pr.yaml` and
      changes only the name, label, skills and the base branch, replacing
      every `main`/`origin/main` in the prompts and description with
      `develop`; the prompts are otherwise unchanged.
- [ ] Rule 1: every `taskType: code-review` node has exactly one parameter,
      `type: pull-request`, `required: true`.
- [ ] Rule 2: only the behaviorally different `develop` variant gets a new,
      organization-unique `name`, prefixed with the repository (for example
      `web-implement-issue-from-ai-fix`), in `acme/web`'s `.aictrl/workflows/`.
      The agent explains that one name belongs to one source file or Studio
      workflow, and adding a repository alone does not require another file.
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
- [ ] The agent calls `validate_workflow_file` when listed; otherwise it reports
      "organization checks not run" and the remaining checks. The completion
      report gives both validator results and all remote warnings.
