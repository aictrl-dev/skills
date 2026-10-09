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
| `reference/workflow.schema.json` | `aictrl-dev/aictrl/schemas/workflow/v2/workflow.schema.json` | `44c8c44de4a528c849472d6c3e1d9a5692f1927b` | 2026-10-09 | `22ae2803fe66a8f2a418af2a6cd58f9c1030fd08141498009d82c9df3a1ba120` |
| `reference/v1/workflow.schema.json` | `aictrl-dev/aictrl/schemas/workflow/v1/workflow.schema.json` | `44c8c44de4a528c849472d6c3e1d9a5692f1927b` | 2026-10-09 | `3220fe19844591ea6c02ca5499ba2587b79cb7cfec0936613a8e9e8fdfcad3cc` |

The source commit is the head of the aictrl release that ships the
code-review parameter rule and `failureComment`. Hashes use the platform's
normalization: every `description` annotation stripped (property names called
`description` kept) and object keys sorted, array order preserved.
