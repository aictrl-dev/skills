# SPEC — create-workflow

`create-workflow` is the vendor-neutral authoring skill for portable aictrl.dev workflow-as-code files.

## Contract

- Writes one direct `.yaml` child of `.aictrl/workflows/`.
- Defaults to `schemaVersion: aictrl/workflow/v2` and inline `task` nodes.
- Inspects existing workflow files before selecting names and conventions.
- Defines typed parameters, outputs, mappings, edges, conditions, retries, bounded loops, triggers, and approvals as required by the requested outcome.
- Version-pins skill/workflow references when a resolvable version is available.
- Starts Issue → reviewed PR workflows from the bundled canonical example and adapts only its marked values.
- Validates JSON Schema and static DAG constraints with the bundled offline validator.
- Never overwrites, applies, starts, commits, or pushes without explicit authorization.

## Bundle

```text
create-workflow/
  SKILL.md
  SPEC.md
  validate.mjs
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
update the example to match.

## Validation boundary

The offline validator proves schema structure, duplicate/dangling node checks, cycle checks, and bounded loop nesting. Organization-scoped skill/workflow resolution and CEL runtime semantics are validated by aictrl.dev when the file is applied.

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
| `reference/workflow.schema.json` | `aictrl-dev/aictrl/schemas/workflow/v2/workflow.schema.json` | `9030c3397d5e36338707617e9e96bde7e0f2ab67` | 2026-09-27 | `36ececff2123ee3dec44e2d167d7e67d36b0cf07396c7169ec985aa4684aefda` |
| `reference/v1/workflow.schema.json` | `aictrl-dev/aictrl/schemas/workflow/v1/workflow.schema.json` | `9030c3397d5e36338707617e9e96bde7e0f2ab67` | 2026-09-27 | `202df36dd25d4cd8a6258da62696969266c19ca7c95fe14398c78b3b214ec2d7` |
