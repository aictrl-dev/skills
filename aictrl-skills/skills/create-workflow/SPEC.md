# SPEC — create-workflow

`create-workflow` is the vendor-neutral authoring skill for portable AICtrl workflow-as-code files.

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
    examples/
      inline-review-fix.yaml
      pr-review-and-triage.yaml
      review-fix-loop.yaml
```

`reference/workflow.schema.json` is the public v2 authoring schema. The template
and loop examples prove v2 compatibility with established node types; new
portable workflows should prefer the inline-task example.

## Validation boundary

The offline validator proves schema structure, duplicate/dangling node checks, cycle checks, and bounded loop nesting. Organization-scoped skill/workflow resolution and CEL runtime semantics are validated by AICtrl when the file is applied.

## Sync procedure

When the public workflow schema changes:

1. Copy the released v2 schema and examples from the public AICtrl source release.
2. Copy the released v1 schema into `reference/v1/workflow.schema.json` so v2 references resolve offline.
3. Remove stale release-state annotations and internal-only references without changing validation keywords.
4. Compare normalized schemas with `description` annotations removed; every remaining validation keyword and value must match the source release.
5. Run `evals/create-workflow.eval.md` and all repository skill checks.
6. Update the provenance record below and regenerate `CHECKSUMS.sha256`.

## Provenance

| Bundle | Source | Source commit | Released | Normalized SHA-256 |
|---|---|---|---|---|
| `reference/v1/workflow.schema.json` | `aictrl-dev/aictrl/schemas/workflow/v1/workflow.schema.json` | `58dd5b2d5182b94dae638b212aa329b83aec5704` | 2026-07-15 | `82b1b1b5a4bb4a36068760b540b8ccc7211e088d7c4e80c5941935c69adc3872` |
