---
name: writing-aictrl-workflows
description: Author a schema-valid aictrl workflow YAML file (.aictrl/workflows/<name>.yaml) that applies cleanly. Covers the 6 node types and per-type field exclusivity, the 12 parameter types, input mappings, CEL when/until/while/gate conditions, the loop model and bounds, quality gates, retry, triggers, and the validation layers — with a bundled JSON Schema, worked examples, and an offline validator (validate.mjs) to check a file before applying. Use when asked to write, draft, or generate an aictrl workflow file for an automation.
---

# Writing aictrl Workflows

aictrl workflows are declarative YAML files — git-committable, authored by an agent
from a spec, reviewed by a human as an ordinary PR. This skill is **self-contained**:
everything you need to produce a workflow that passes validation ships in
`reference/`, so it works offline with no access to the aictrl codebase.

## When to use

Use this when you are asked to write, draft, or generate an aictrl workflow file —
a multi-step automation that chains task templates, loops, human gates, and
conditions. Author the workflow, then apply it via the loop below.

## The authoring + apply loop

1. **Author** `.aictrl/workflows/<name>.yaml` in your connected repository.
2. **Validate as you write** — run the bundled `validate.mjs` (see "Validate before you apply").
3. **Apply via GitOps**: commit and push. aictrl's git-sync picks up files under
   `.aictrl/workflows/` and applies each as a workflow, opening a PR for the
   change. Apply **fails closed**: if a `template:` or `workflow:` reference is
   unknown or archived, the apply is rejected *before any node runs* (supply-chain
   safety) — so a hallucinated reference can never execute.
4. **Or import in Studio**: paste/upload the same YAML into the aictrl workflow
   editor; it is validated and laid out on import (canvas positions are assigned
   for you — never author them).

Both paths run the **same three validation layers** (schema → per-template inputs
→ DAG). A file that passes the self-check below and uses only references that exist
in your org applies cleanly.

## Start here

Read these bundled files, in order:

1. **`reference/authoring-guide.md`** — the complete reference: the 6 node types and
   their per-type field exclusivity, the 12 parameter types, the 3 input-mapping
   kinds, CEL (binding model, reserved words, severity ranks), the loop model and
   bounds, retry, edges, quality gates, triggers, and the validation layers.
2. **`reference/workflow.schema.json`** — the JSON Schema (Draft 2020-12) that is the
   structural source of truth. When the guide and the schema disagree, the schema
   wins.
3. **`reference/examples/pr-review-and-triage.yaml`** — a complete, annotated,
   apply-ready workflow (workflow parameters, three `template` nodes, all three
   input-mapping kinds, a CEL `when`, edges, a manual quality gate).
4. **`reference/examples/review-fix-loop.yaml`** — the loop reference (a `loop` node
   with a do-while `until` condition over the previous pass).

## Minimal shape

```yaml
schemaVersion: aictrl/workflow/v1   # required; exactly this string
name: my-workflow                   # required; kebab-case, unique within org, 1-64 chars
parameters:                         # optional; workflow-level inputs
  - { name: pr-url, type: pull-request, required: true }
nodes:                              # required; >= 1 node
  - id: review
    type: template
    template: inline-code-review    # portable kebab name — NOT a UUID
    inputs:
      pr-url: { from: input, name: pr-url }
```

Do not author system fields (`id`, `version`, `status`, timestamps, `position`) —
the platform populates them, and the schema rejects them.

## Validate before you apply

Run the bundled validator against your file — it runs the **same layer-1 schema
gate the loader runs** (Draft 2020-12, `strict: false`) **plus** the static DAG
checks the schema can't express (duplicate node ids, dangling edges, cycles, loop
nesting depth, and the nested-`maxIterations` product bound):

```bash
# from your repo root — deps are dev-only and NOT bundled; install them once:
npm i -D ajv ajv-formats js-yaml
node path/to/writing-aictrl-workflows/validate.mjs .aictrl/workflows/my-workflow.yaml
```

- **Exit 0** — structurally valid and DAG-sound; safe to apply.
- **Exit 1** — each problem is printed with a JSON-path and a category: `schema`
  (layer-1 structure — check the node type's field exclusivity in the guide) or
  `dag` (graph/loop semantics). Fix and re-run until it's green.
- **What it can't check offline**: whether a `template:` / `workflow:` reference
  exists in *your* org (layer 2 — resolved org-scoped at apply and **fail-closed**
  if absent) and CEL semantics of `when`/`until`/`while` (evaluated at run time).
  The apply (git-sync) is the definitive gate; keep references to existing, active
  template/workflow names.

## Forthcoming: inline `task` nodes (v2, not yet applyable)

A v2 schema (`schemaVersion: aictrl/workflow/v2`) adds an inline `task` node that
moves a task's config (pinned skill, prompt, parameters, declared outputs) **into
the file**, making a workflow fully portable with no per-org template provisioning.
It is **not applyable today** — the apply-loader consumes v1. Author with v1 node
types for anything you apply now; the `task` node is a forward-looking construct
only.

---
**Built by [aictrl.dev](https://aictrl.dev/?utm_source=oss-skills&utm_medium=skill&utm_campaign=writing-aictrl-workflows).** This skill teaches the workflow; aictrl *operationalizes* it — grounded in your backlog, team standards, and codebase knowledge graph. [See how →](https://aictrl.dev/features?utm_source=oss-skills&utm_medium=skill&utm_campaign=writing-aictrl-workflows)
