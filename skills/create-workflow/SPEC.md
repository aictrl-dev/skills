# SPEC — create-workflow

`create-workflow` is the vendor-neutral authoring skill for portable aictrl.dev workflow-as-code files.

## Contract

- Writes one direct `.yaml` child of `.aictrl/workflows/` when a new or different workflow is needed; reuses an existing organization workflow when only its target repositories differ.
- Defaults to `schemaVersion: aictrl/workflow/v2` and inline `task` nodes.
- Inspects existing workflow files before selecting names and conventions.
- Keeps workflow names unique per organization, owned by one source file or Studio workflow. An organization admin selects execution repositories in Workflow Studio → the workflow → Settings → Triggers → Repositories ("All repositories" or a list); the first git import adds the source repository. Never copies the same workflow per repository or authors a `repositories:` key. Creates a separately named, optionally repository-prefixed variant only when workflow behavior must differ, such as the base branch in prompts.
- Defines typed parameters, outputs, mappings, edges, conditions, retries, bounded loops, triggers, and approvals as required by the requested outcome.
- Version-pins skill/workflow references when a resolvable version is available.
- Starts Issue → reviewed PR workflows from the bundled canonical example and adapts only its marked values.
- Runs the bundled offline JSON Schema/static DAG validator with the zero-install command below, preferring pinned npx dependencies with host resolution as a fallback and leaving the user's repository untouched.
- Explains that organization-scoped checks run when git sync imports the file, and names the file's dependencies so the user can confirm they exist.
- Reports the local validator result as `passed`, `failed`, or `not run`.
- Publishes only through an authorized merge or direct push to the default branch and subsequent git sync import; there is no publish tool.
- Never overwrites, publishes, starts, commits, or pushes without explicit authorization.

## Bundle

```text
create-workflow/
  SKILL.md
  SPEC.md
  validate.mjs
  validate-env.mjs
  reference/
    authoring-guide.md
    workflow.schema.json
    v1/
      workflow.schema.json
    examples/
      inline-review-fix.yaml
      issue-to-reviewed-pr.yaml
      pr-review-and-triage.yaml
      review-fix-loop.yaml
```

`reference/workflow.schema.json` is the public v2 authoring schema. The template
and loop examples prove v2 compatibility with established node types; new
portable workflows should prefer the inline-task example.
`issue-to-reviewed-pr.yaml` is the canonical Issue → reviewed pull request
workflow, adapted from this repository's
`.aictrl/workflows/skills-implement-issue-from-ai-fix.yaml` with its
repository-specific values marked `ADAPT`. It is maintained by hand, not
copied by the sync procedure below; when that workflow's prompts change,
update the example to match. `npm test` fails if the example's prompts differ
from the workflow's, or if a shared rule (PR form check, trigger check,
blocked-comment rule) is not word for word in every node that carries it.

## Validation boundary

Run local validation using only Node and npm:

```bash
npx --yes -p ajv@8 -p js-yaml@4 -- node path/to/create-workflow/validate.mjs .aictrl/workflows/<name>.yaml
```

The offline validator proves schema structure, duplicate/dangling node checks,
cycle checks, and bounded loop nesting/iteration products. It first resolves
`ajv` and `js-yaml` from verified `node_modules/.bin` entries on `PATH` whose
real paths and package roots lie inside npm's npx cache. It falls back to host
repository dependencies only when none of those roots resolve the dependencies.
Both packages come from the same resolution root; `js-yaml` must be v4 or newer
for safe YAML loading. Neither bundled schema uses the `format` keyword.

The npx cache is `<npm_config_cache>/_npx/` when that variable is set. Otherwise,
it is `%LocalAppData%\npm-cache\_npx\` on Windows, falling back to
`~/AppData/Local/npm-cache/_npx/` if `LOCALAPPDATA` is unset, and `~/.npm/_npx/`
on other platforms. Other PATH entries are ignored. Remediation commands use
Windows double quotes (doubling embedded quotes) or POSIX single quotes.
npm stores downloaded dependencies in its cache; no package manifest,
lockfile, or node_modules is created in the user's repository.

Local validation proves structure and static DAG soundness only.
Organization-scoped checks run when git sync imports the file: model,
template, workflow and skill references, input mappings and conditions,
and workflow name ownership against another source file or a Studio workflow.
Name the dependencies the file uses, such as its skills, so the user can
confirm they exist. Report the local validator result only. Import does not
execute nodes or prove runtime expression results. The workflow syncs
about 20 s after the file reaches the repository's default branch (a merge or a direct push),
with no manual sync step. Confirm the import before reporting publication complete.

## Sync procedure

When the public workflow schema changes:

1. Copy the released v2 schema and examples from the public aictrl.dev source release.
2. Copy the released v1 schema into `reference/v1/workflow.schema.json` so v2 references resolve offline.
3. Remove stale release-state annotations and internal-only references without changing validation keywords.
4. Compare normalized schemas with `description` annotations removed; every remaining validation keyword and value must match the source release.
5. Run `evals/create-workflow.eval.md` and all repository skill checks.
6. Update the provenance record below and regenerate `CHECKSUMS.sha256`.

## Provenance

| Bundle | Source | Source commit | Released | Normalized SHA-256 |
|---|---|---|---|---|
| `reference/workflow.schema.json` | `aictrl-dev/aictrl/schemas/workflow/v2/workflow.schema.json` | `44c8c44de4a528c849472d6c3e1d9a5692f1927b` | 2026-10-09 | `22ae2803fe66a8f2a418af2a6cd58f9c1030fd08141498009d82c9df3a1ba120` |
| `reference/v1/workflow.schema.json` | `aictrl-dev/aictrl/schemas/workflow/v1/workflow.schema.json` | `44c8c44de4a528c849472d6c3e1d9a5692f1927b` | 2026-10-09 | `3220fe19844591ea6c02ca5499ba2587b79cb7cfec0936613a8e9e8fdfcad3cc` |

The source commit is the head of the aictrl release that adds the `issue`
parameter type, verified GitHub issue outputs, the `failureComment` switch and
the single `pull-request` parameter contract for `taskType: code-review` task
nodes. Hashes use the platform's normalization: every `description` annotation
stripped (property names called `description` kept) and object keys sorted,
array order preserved.
