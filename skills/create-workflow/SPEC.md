# SPEC — create-workflow

`create-workflow` is the vendor-neutral authoring skill for portable aictrl.dev workflow-as-code files.

## Contract

- Writes one direct `.yaml` child of `.aictrl/workflows/`.
- Defaults to `schemaVersion: aictrl/workflow/v2` and inline `task` nodes.
- Inspects existing workflow files before selecting names and conventions.
- Defines typed parameters, outputs, mappings, edges, conditions, retries, bounded loops, triggers, and approvals as required by the requested outcome.
- Version-pins skill/workflow references when a resolvable version is available.
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
      pr-review-and-triage.yaml
      review-fix-loop.yaml
```

`reference/workflow.schema.json` is the public v2 authoring schema. The template
and loop examples prove v2 compatibility with established node types; new
portable workflows should prefer the inline-task example.

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

## Last completed release provenance

| Bundle | Source | Source commit | Released | Normalized SHA-256 |
|---|---|---|---|---|
| `reference/workflow.schema.json` | `aictrl-dev/aictrl/schemas/workflow/v2/workflow.schema.json` | `9030c3397d5e36338707617e9e96bde7e0f2ab67` | 2026-09-27 | `36ececff2123ee3dec44e2d167d7e67d36b0cf07396c7169ec985aa4684aefda` |
| `reference/v1/workflow.schema.json` | `aictrl-dev/aictrl/schemas/workflow/v1/workflow.schema.json` | `9030c3397d5e36338707617e9e96bde7e0f2ab67` | 2026-09-27 | `202df36dd25d4cd8a6258da62696969266c19ca7c95fe14398c78b3b214ec2d7` |

## Pending coordinated update

This draft's v1 schema adds the `issue` parameter type from source candidate
`75b96f6d9c8bf8385d93506ff661c4b02a3db130`. Its normalized SHA-256 is
`3220fe19844591ea6c02ca5499ba2587b79cb7cfec0936613a8e9e8fdfcad3cc`.
The [coordinated source release](https://github.com/aictrl-dev/aictrl/pull/5852)
is pending; this is not a claim that this bundle or source candidate has been
released. The completed provenance records above remain unchanged.

Before this draft is merged, verify the actual source release revision/date,
update the v1 completed provenance record and remove this pending section.
The v2 schema and completed provenance are unchanged.
