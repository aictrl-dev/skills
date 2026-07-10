# SPEC — writing-aictrl-workflows

The specification behind the `writing-aictrl-workflows` skill: what it is, the
design decisions that shape it, the provenance of the bundled schema, and the
manual procedure for keeping it in sync with the upstream schema.

## Purpose

Give any external developer or agent (Claude Code, Cursor, OpenCode, …) a
**self-contained, vendor-neutral** reference for authoring schema-valid aictrl
workflow YAML — with no access to the aictrl codebase. This public skill is the
**canonical authoring reference**; the project-local skill inside the aictrl
monorepo is maintained as a thin internal delta on top of it (that slimming is
tracked separately and is out of scope here).

## What ships

```
writing-aictrl-workflows/
  SKILL.md                       # lean entry: what/when, the authoring+apply loop, self-check, pointers
  SPEC.md                        # this file
  reference/
    authoring-guide.md           # the complete reference (node types, params, CEL, loops, validation, triggers)
    workflow.schema.json         # the v1 JSON Schema (see Provenance)
    examples/
      pr-review-and-triage.yaml  # apply-ready worked example
      review-fix-loop.yaml       # loop reference
```

## Design decisions (locked)

1. **Self-contained bundle.** The skill ships its own schema, examples, and
   authoring guide so it works offline in any agent. It does not point at
   monorepo paths or private URLs.
2. **Public canonical / internal = delta.** This public skill is the source of
   truth for workflow authoring. The internal project-local skill becomes a thin
   delta on top of it.
3. **Vendor-neutral, observable behavior only.** No internal file paths, no issue
   numbers, no private-wiki links. Loader behavior is described in terms an
   external reader can observe (e.g. "apply fails closed on an unknown reference
   before any node runs"), not by naming internal modules.
4. **v1 is the applyable surface.** The guide teaches `aictrl/workflow/v1` — what
   applies today. The v2 inline `task` node gets a short forward-looking note only
   and is explicitly marked not-yet-applyable.
5. **The bundled schema is the structural source of truth.** When the prose guide
   and the schema disagree, the schema wins. Self-consistency (examples validate
   against the bundled schema) is the acceptance gate.

## Provenance

`reference/workflow.schema.json` is copied from the upstream canonical schema:

| Field | Value |
|---|---|
| Upstream file | `workflow.schema.json` (aictrl monorepo, v1) |
| Source commit | `8ee36d05036de8105efeecd39af167ef1bab5dcb` |
| Source commit date | 2026-07-09 |
| Skill version | v1 (`schemaVersion: aictrl/workflow/v1`) |

**Verbatim except for annotation-only edits.** Every validation-affecting part of
the schema — types, `pattern`s, `enum`s, `required`, numeric bounds, `allOf` /
`oneOf` exclusivity, `additionalProperties` — is **byte-identical** to the source
commit. The only modifications are inside `description` annotation strings, where
four kinds of monorepo-internal anchor were removed because they are inaccessible
to a public reader and carry no authoring value:

- internal issue-number references (e.g. `(#NNNN)`);
- a private-wiki ADR URL (replaced with a pointer to `reference/authoring-guide.md`);
- internal function/type names (an internal DAG-validation function; the internal
  input-mapping type names) — reworded to observable behavior;
- a monorepo-relative `README` pointer (repointed to `reference/authoring-guide.md`).

AJV ignores `description` annotations, so these edits have **zero effect on
validation behavior**: any document that validates against this copy also validates
against the upstream schema, and vice versa. The schema's public canonical `$id` (a
URI on the public aictrl.dev domain) is retained unchanged.

To reproduce from a fresh upstream copy: within `description` strings only, strip
issue-number references and the private-wiki ADR URL, reword internal
function/type names to observable behavior, and repoint the `README` reference to
`reference/authoring-guide.md`; change nothing that affects validation.

## Self-consistency ("golden") check

Both bundled examples MUST validate against the bundled schema using the same AJV
configuration the loader uses: **Draft 2020-12**, `strict: false`, `allErrors: true`,
with `ajv-formats` registered. See `evals/writing-aictrl-workflows.eval.md` for the
runnable check and `evals/results.md` for the recorded result.

## Manual monorepo → skill sync procedure

The bundled schema is a point-in-time copy. There is intentionally **no automated
cross-repo drift detection** in this repo (tracked separately in the upstream
project). Keep the copy current manually whenever the upstream v1 schema changes:

1. **Diff** the upstream v1 `workflow.schema.json` against
   `reference/workflow.schema.json`. Ignore the three sanitized `description`
   lines and the retained `$id`.
2. **Re-copy** the upstream schema over `reference/workflow.schema.json`.
3. **Re-sanitize**: remove any `(#NNNN)` issue references and any private-wiki
   URLs that appear in `description` fields (see Provenance). Change nothing that
   affects validation.
4. **Re-copy the examples** from the upstream v1 `examples/` directory if they
   changed.
5. **Update the provenance stamp** above (source commit + date).
6. **Re-run the self-consistency check** (`evals/writing-aictrl-workflows.eval.md`)
   and record the result in `evals/results.md`.
7. **Re-run the leakage check** and confirm it is clean.
8. **Reconcile the prose** in `authoring-guide.md` / `SKILL.md` with any new or
   changed fields, enums, or bounds.

### Leakage check

`evals/writing-aictrl-workflows.eval.md` carries the exact leakage grep and the
self-consistency validator; re-run both after any sync. The only acceptable grep
match is the schema's public canonical `$id` (a public aictrl.dev URI) — every
other match is a monorepo-internal anchor and must be fixed.
