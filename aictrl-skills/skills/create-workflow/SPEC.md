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
2. Remove stale release-state annotations and internal-only references without changing validation keywords.
3. Run `evals/create-workflow.eval.md` and all repository skill checks.
4. Record the source tag or commit and checksums in the release provenance file.
