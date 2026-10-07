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
| `reference/v1/workflow.schema.json` | `aictrl-dev/aictrl/schemas/workflow/v1/workflow.schema.json` | `5b92d99661e538b1a4edb5f163219ba4579922ca` | 2026-10-04 | `3220fe19844591ea6c02ca5499ba2587b79cb7cfec0936613a8e9e8fdfcad3cc` |

The new v1 source contract adds the `issue` parameter type. The [source release](https://github.com/aictrl-dev/aictrl/pull/5852) was deployed to production from the exact commit above; [deployment verification](https://github.com/aictrl-dev/aictrl/actions/runs/37185116290) passed on 2026-10-04 at 07:25:09 UTC with both application and database health reported as `ok`. Both historical provenance records remain unchanged. This records the released app source; publication of this public bundle remains a separate approval step.

## Pending source release — 2026-10-07

Prepared for [platform release #5962](https://github.com/aictrl-dev/aictrl/pull/5962), from source candidate `a4750e490143e6e3f5f439f8f3765192f32b81ff`. This candidate has not yet been released; public bundle readiness, merge and publication remain separate approval steps. No package version or publication is changed.

| Bundle | Candidate normalized SHA-256 |
|---|---|
| `reference/workflow.schema.json` | `4080e37a65b2ffd58ff15ddefa98f7fc53d026e7ec4bcb252d313c2b86ce3d33` |
| `reference/v1/workflow.schema.json` | `3220fe19844591ea6c02ca5499ba2587b79cb7cfec0936613a8e9e8fdfcad3cc` |

The v2 candidate adds required authenticated GitHub issue context on inline task parameters and typed output descriptors for verifying issue comments and literal issue labels. Primitive output declarations remain supported. The offline schema enforces structural restrictions; aictrl.dev verifies parameter references and external effects at apply and execution time.
