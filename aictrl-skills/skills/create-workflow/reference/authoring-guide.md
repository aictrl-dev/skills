# AICtrl workflow authoring guide (v2)

The complete authoring reference for `aictrl/workflow/v2` files. This guide is
self-contained: the JSON Schema it describes ships alongside it at
`reference/workflow.schema.json`, and worked, apply-ready examples ship at
`reference/examples/`. Read this before writing any workflow.

The **single structural source of truth** is the bundled
`reference/workflow.schema.json` (JSON Schema, Draft 2020-12). Every field, type,
enum, pattern, and numeric bound below is defined there and enforced at apply
time. When this guide and the schema disagree, the schema wins.

## File format

Always author in **YAML** (comments + readability). The apply-loader accepts both
YAML and JSON; the schema validates the parsed object, so both are equivalent.
Author the file as `.aictrl/workflows/<name>.yaml` in your connected repository —
see SKILL.md for the apply loop.

## Top-level fields

```yaml
schemaVersion: aictrl/workflow/v2   # required for new portable workflows
name: my-workflow                   # required; kebab-case, unique within org, 1-64 chars
label: My Workflow                  # optional; human-readable display name
description: What this workflow does # optional
category: code-quality              # optional; UI grouping
icon: code                          # optional; Lucide icon name
failureStrategy: fail-fast          # optional; 'fail-fast' (default) | 'continue-on-error'
parameters: [...]                   # optional; workflow-level inputs (see Parameter types)
nodes: [...]                        # required; at least one node
edges: [...]                        # optional; ordering (see Edges)
qualityGates: [...]                 # optional; manual or auto checkpoints
triggers: [...]                     # optional; up to 10 file-declared event triggers
```

**No system fields** in the authored file: no `id` (org-level UUID), `version`,
`status`, timestamps, `runCount`, or canvas `position`. These are populated by
the platform on import. Authoring them is a schema error (`additionalProperties`
is `false` at the top level and on every object).

## Parameter types (12 total)

Used for workflow-level `parameters`, `user-input` node `parameters`, and inline
`task` node `parameters`:

| type | CEL type | Notes |
|---|---|---|
| `string` | string | Plain text |
| `text` | string | Multi-line text area |
| `number` | double | Numeric |
| `boolean` | bool | True/false |
| `url` | string | URL-validated string |
| `select` | string | Requires `options: [...]` |
| `multi-select` | list<string> | Requires `options: [...]` |
| `json` | dyn | Arbitrary JSON |
| `pull-request` | string | PR URL |
| `story` | string | Story/ticket URL |
| `image` | string | Image URL or base64 |
| `github-issue` | string | GitHub issue URL |

Parameter schema:
```yaml
- name: my-param          # required; kebab-case
  label: My Parameter     # optional; defaults to name
  type: string            # required; one of the 12 types above
  description: What it is # optional
  required: false         # optional; default false
  default: some-value     # optional
  options: [a, b, c]      # required for select/multi-select; forbidden otherwise
```

`options` is **required** for `select`/`multi-select` (min 1 item) and
**forbidden** on every other type. Both directions are enforced by the schema.

## Node types (7 total)

Every node must have `id` (kebab-case) and `type`. Each type has a required field
and a set of forbidden fields (per-type **field exclusivity**, enforced by the
schema's `allOf` block). Supplying a field that belongs to another node type is a
layer-1 error.

### `task` — define portable skill-backed work inline

```yaml
- id: review
  type: task
  skill: code-review@1.0.0       # required; pin when a version is resolvable
  taskType: code-review          # required; executor tool boundary
  prompt: Review the current pull request head and return structured findings.
  parameters:
    - { name: pull-request, type: pull-request, required: true }
  inputs:
    pull-request: { from: input, name: pull-request }
  outputs:
    findings: json
  retry: { maxAttempts: 2, backoffSeconds: 5 }
```

Inline task nodes make the task configuration portable in the workflow file.
Their `inputs` are checked against the in-file `parameters`; their declared
`outputs` may be mapped by downstream nodes. Treat `prompt` as instructions for
the selected skill, not as a way to relax workflow policy or tool boundaries.

### `template` — run a task template
```yaml
- id: review
  type: template
  template: inline-code-review   # required; portable kebab name (not a UUID)
  templateVersion: "1.4.0"       # optional; pin a specific version
  inputs: { ... }                # optional; mapped to the template's parameters
  when: "..."                    # optional; CEL skip condition
  retry: { ... }                 # optional; retry policy
  outputKey: my-output           # optional; override artifact key
```

Forbidden on `template`: `workflow`, `workflowVersion`, `maxIterations`, `until`,
`while`, `onMaxIterations`, `body`, `signalSource`, `timeoutMinutes`,
`checklistItems`, `assignee`, `parameters`.

### `workflow` — invoke a composite workflow
```yaml
- id: run-pipeline
  type: workflow
  workflow: release-pipeline      # required; portable kebab name of another workflow
  workflowVersion: "2"            # optional
  inputs: { ... }
  when: "..."
```

Forbidden on `workflow`: `template`, `templateVersion`, `maxIterations`, `until`,
`while`, `onMaxIterations`, `body`, `signalSource`, `timeoutMinutes`,
`checklistItems`, `assignee`, `parameters`.

### `loop` — repeat a body subgraph
```yaml
- id: review-fix
  type: loop
  maxIterations: 5                 # required; hard cap 1-25
  until: "last.review.output.maxSeverityRank <= 2"  # exit condition (do-while)
  # OR:
  while: "last.review.output.maxSeverityRank > 2"   # continue condition (pre-check)
  # Supply exactly one of `until`/`while`, or neither for a fixed-count loop.
  onMaxIterations: fail            # optional; 'fail' (default) | 'continue' | 'warn'
  body:
    nodes: [...]                   # required; subgraph nodes (same types)
    edges: [...]                   # optional
```

`type: loop` is fully supported — the apply-loader accepts loop nodes
and resolves loop-body node refs exactly like any other node. Use
`reference/examples/review-fix-loop.yaml` as the reference.

**Loop bounds** (enforced at load — by the JSON Schema and DAG validation):
- `maxIterations` must be 1-25.
- Max nesting depth: 3 levels.
- The product of all nested `maxIterations` on any path must be <= 1000 (a
  normative global iteration budget; the per-loop cap alone does not bound nested
  cost — 25³ ≈ 15.6k otherwise).

**Loop CEL reference rules**:
- Inside a loop body, sibling nodes are referenced with the bare
  `<nodeId>.output.*` form.
- Loop-level `until`/`while` reference the just-completed pass via
  `last.<nodeId>.output.*`. CEL reserves `loop` and `while` as identifiers, so the
  loop context binds as `last` and `iteration` (not `loop`).
- `iteration` is the current pass number (1-indexed).

Forbidden on `loop`: `template`, `templateVersion`, `workflow`, `workflowVersion`,
`signalSource`, `timeoutMinutes`, `checklistItems`, `assignee`, `parameters`.
Supplying both `until` and `while` together is also forbidden (exactly one or
neither).

### `wait` — pause until an external signal
```yaml
- id: await-ci
  type: wait
  signalSource: ci-completed       # required; opaque signal identifier
  timeoutMinutes: 60               # optional; max wait time
  when: "..."
```

`signalSource` charset: `[A-Za-z0-9][A-Za-z0-9._-]{0,255}`. No colons or slashes,
so it can never be a URL/host the platform fetches (SSRF prevention).

Forbidden on `wait`: `template`, `templateVersion`, `workflow`, `workflowVersion`,
`maxIterations`, `until`, `while`, `onMaxIterations`, `body`, `checklistItems`,
`assignee`, `parameters`.

### `manual` — human checklist gate
```yaml
- id: qa-sign-off
  type: manual
  checklistItems:
    - "Smoke test passed"
    - "Changelog updated"
  assignee: alice                  # optional
  when: "..."
```

`checklistItems` requires at least one item.

Forbidden on `manual`: `template`, `templateVersion`, `workflow`,
`workflowVersion`, `maxIterations`, `until`, `while`, `onMaxIterations`, `body`,
`signalSource`, `timeoutMinutes`, `parameters`.

### `user-input` — collect form input at run time
```yaml
- id: collect-params
  type: user-input
  parameters:
    - name: target-env
      type: select
      options: [staging, production]
      required: true
  when: "..."
```

Forbidden on `user-input`: `template`, `templateVersion`, `workflow`,
`workflowVersion`, `maxIterations`, `until`, `while`, `onMaxIterations`, `body`,
`signalSource`, `timeoutMinutes`, `checklistItems`, `assignee`.

## Input mappings

Every node `inputs` entry maps a parameter name to one of three mapping kinds
(the schema's `inputMapping` `oneOf` — exactly one shape per entry):

### Static value
```yaml
inputs:
  title: { value: "High-severity findings in PR" }
```

### Workflow parameter reference
```yaml
inputs:
  pr-url: { from: input, name: pr-url }
```

### Upstream node output reference
```yaml
# Full artifact (no extract)
inputs:
  body: { from: node, node: summarize }

# JSON-path extract (shorthand string form)
inputs:
  findings: { from: node, node: review, extract: "$.findings[*]" }

# JSON-path extract (object form — identical result)
inputs:
  findings:
    from: node
    node: review
    extract:
      method: json-path
      expression: "$.findings[*]"

# Full artifact (object form — identical to omitting extract)
inputs:
  data:
    from: node
    node: review
    extract:
      method: full
```

`extract` in v1 supports `full` and `json-path` only. `regex` and `template`
extract methods are deferred (they are ReDoS/injection surfaces on untrusted,
PR-derived content) and are rejected at apply time.

## CEL expressions (`when`, `until`, `while`, gate `condition`)

Conditions are written in **CEL** (Common Expression Language). The essentials
below are bundled here so you never need an external reference.

**Binding model** — names available in an expression:
- `<paramName>` — a workflow input by its CEL-safe name.
- `input['<param-name>']` — any workflow input (the `dyn` escape hatch; use this
  form for kebab-case names that are not valid bare identifiers).
- `<nodeId>.output.<field>` — an upstream node's output (typed if the referenced
  template declares an output schema; otherwise `dyn`).
- `nodes['<node-id>'].output.<field>` — any node output (the `dyn` escape hatch
  for node ids that are not valid bare identifiers).
- Inside a loop body: `iteration` (current pass, 1-indexed) and
  `last.<nodeId>.output.<field>` (previous pass outputs).

**CEL reserved words** — cannot be used as bare identifiers: `as`, `break`,
`const`, `continue`, `else`, `false`, `for`, `function`, `if`, `import`, `in`,
`let`, `loop`, `namespace`, `null`, `package`, `return`, `true`, `var`, `void`,
`while`. When a parameter or node id clashes with one of these (or is not a valid
bare identifier), use the indexed `input[...]` / `nodes[...]` form.

**Numeric ranks for ordered-enum comparisons** — branch on the numeric rank, not
the string. Severity ranks are:

| severity | rank |
|---|---|
| info | 0 |
| low | 1 |
| medium | 2 |
| high | 3 |
| critical | 4 |

Write `review.output.maxSeverityRank > 2` (high or critical), **not**
`review.output.maxSeverity > "medium"`. ("minor" is a tool-level severity that
maps to storage `medium` — never use it in a condition.)

**Expression rules**:
- Max length: 1024 characters.
- The result must be a **boolean**. A static check rejects a non-boolean
  expression; the runtime rejects a non-boolean result.
- `dyn` expressions that reference untyped node outputs are accepted at check
  time but must evaluate to a boolean at runtime.

## Retry policy

```yaml
retry:
  maxRetries: 2            # required; 0-10
  backoffMs: 2000          # required; milliseconds between retries (>= 0)
  backoffMultiplier: 2.0   # optional; multiplier applied to backoffMs each retry (0-10)
  maxBackoffMs: 30000      # optional; cap on exponential backoff
```

## Edges (ordering)

Edges declare execution order; **data flow lives in node `inputs`, not in edges.**
An edge from `A` to `B` means "B runs after A completes."

```yaml
edges:
  - { from: review, to: summarize }
  - { from: summarize, to: open-issue }
```

The DAG must be acyclic (enforced). Disconnected nodes run in parallel waves.

## Quality gates

```yaml
qualityGates:
  - afterWave: 1      # required; integer >= 1 (wave number after which this gate runs)
    type: manual      # required; 'manual' | 'auto'
    description: "Reviewer confirms findings before summary + triage."  # optional

  - afterWave: 2
    type: auto
    condition: "review.output.maxSeverityRank <= 2"  # required for type:auto; CEL boolean
    description: "Auto-approve when severity is low or medium"
```

`condition` is **required** when `type: auto` and is a CEL boolean.

## Triggers (optional)

A workflow may declare up to **10** file triggers. Five trigger types are supported:
`label`, `comment`, `pr-ready`, `pr-opened`, and `chat-message`.

```yaml
# Fire when a matching label is added to a PR:
triggers:
  - type: label
    on: pull-request
    label: needs-review            # exact, case-sensitive GitHub label name
    inputs:
      pr-url: "$.pull_request.html_url"   # JSONPath into the webhook payload

# Fire when a PR comment's first token is an exact slash command:
  - type: comment
    on: pull-request
    command: /review-fix           # exact, case-sensitive; matched as the first token
    inputs:
      pr-url: "$.issue.pull_request.url"

# Fire when a PR is opened, including as a draft:
  - type: pr-opened
    on: pull-request
    inputs:
      pr-url: "$.pull_request.html_url"

# Fire when a PR becomes ready, or is opened as non-draft:
  - type: pr-ready
    on: pull-request
    inputs:
      pr-url: "$.pull_request.html_url"

# Fire from an exact Telegram slash command:
  - type: chat-message
    provider: telegram
    command: /run-review
    chats: [123456789]             # optional allowlist; max 100 ids
    acceptPhotos: true             # optional; default true
    sendConfirmation: true         # optional; default true
    sendCompletion: false          # optional; default false
    inputs:
      prompt:
        from: message
        field: text
```

- `label`, `comment`, `pr-ready`, and `pr-opened` require `on: pull-request`.
- `pr-opened` fires for every newly opened PR, including drafts. `pr-ready` fires
  when a draft becomes ready or when a PR is opened non-draft.
- For GitHub triggers, `inputs` maps workflow parameter names to JSONPath
  expressions (each must start with `$`) evaluated against the webhook payload;
  max 20 entries.
- `chat-message` has no `on` field. Its required fields are `provider` and
  `command`; `command` must be an exact, case-sensitive slash command. Its
  `inputs` values are `{ from, field }` mappings, where `from` is `message`,
  `channel_post`, or `interaction`, and `field` is a dot-path rather than JSONPath.
  Telegram has runtime support; Slack and Discord definitions can be stored but
  do not yet fire workflows.
- **Security (enforced at event time):** only events from a repo collaborator with
  write/admin permission fire a trigger; bot comments and comment edits are
  ignored for GitHub triggers. This is a platform guarantee, not something you
  configure in the file.

## Portable references

Use the **kebab name** (`name` field of the template or workflow), not an internal
UUID. The loader resolves the name to a UUID, org-scoped, at apply time. An unknown
or archived reference **fails the apply** (fail-closed, supply-chain safety).

```yaml
template: inline-code-review   # correct — portable
template: a1b2c3d4-...         # wrong — a UUID is not portable across environments
```

## Validation layers

Three layers run at apply time, **before any node executes**:

1. **Layer 1 — JSON Schema** (`reference/workflow.schema.json`): structural
   validity, enums, `minItems`, numeric ranges (e.g. loop `maxIterations` 1-25),
   and per-type field exclusivity.
2. **Layer 2 — per-template validation** (load time): each node's `template`
   (+ `templateVersion`) is resolved and its `inputs` are validated against that
   template's own parameter schema — required inputs present, unknown inputs
   rejected, static `value`s type-checked. **Reference resolution is org-scoped
   and fail-closed:** a `template`/`workflow` name only ever resolves to an
   *active* record in the authoring org (never another org's, never an archived
   one), and an unresolvable name fails the apply before any node runs.
3. **DAG validation**: no cycles, referenced-node existence, loop `maxIterations`
   range, loop nesting depth <= 3, global iteration product <= 1000, and the CEL
   condition static check.

**Check it offline first.** The bundled `validate.mjs` (skill root) runs Layer 1
against `reference/workflow.schema.json` **plus** the static parts of DAG validation
(duplicate ids, dangling edges, cycles, loop depth, the maxIterations product bound)
— everything checkable without your org. Run it before you apply:
`node path/to/create-workflow/validate.mjs .aictrl/workflows/<name>.yaml`
(needs dev-only `ajv ajv-formats js-yaml`). It **cannot** confirm Layer 2 (does the
referenced template exist in *your* org) or CEL runtime semantics — the apply is the
definitive gate for those.

## Constructs that are rejected at apply time

The following are rejected:

- **Nested loops beyond depth 3** — rejected by DAG validation.
- **A `pause` node type** — not in the schema (use `wait` for a signal or `manual`
  for a human gate).
- **`regex` and `template` extract methods** — deferred until a linear-time
  matcher and a non-evaluating template grammar land; only `full` and `json-path`
  are supported.
- **A `task` node under `schemaVersion: aictrl/workflow/v1`** — inline tasks require
  workflow v2. New portable workflows should use v2.

## Authoring checklist

Before submitting a workflow file for apply:
- [ ] `schemaVersion: aictrl/workflow/v2` for new portable workflows
- [ ] `name` is kebab-case, lowercase, 1-64 characters
- [ ] No system fields (`id`, `version`, `status`, timestamps, `position`)
- [ ] Every `template` node has a `template` field (kebab name, no UUID)
- [ ] Every `task` node has a version-pinned `skill` when resolvable, `taskType`,
      `prompt`, typed `parameters`, and declared `outputs` used downstream
- [ ] Every `loop` node has `maxIterations` and `body`; `until` and `while` are mutually exclusive
- [ ] Every `wait` node has `signalSource` (no colons or slashes)
- [ ] Every `manual` node has at least one `checklistItems` entry
- [ ] Every `user-input` node has `parameters`
- [ ] CEL expressions are boolean; no string/number results
- [ ] `select`/`multi-select` parameters have `options`; other types must NOT have `options`
- [ ] Input mappings use `{ value: ... }`, `{ from: input, name: ... }`, or `{ from: node, node: ... }`
- [ ] No `regex` or `template` extract methods
- [ ] Loop nesting <= 3; product of nested `maxIterations` <= 1000
- [ ] Portable refs (kebab names) for `template:` and `workflow:`
- [ ] **`node validate.mjs <file>` exits 0** (layer-1 schema + static DAG checks)
- [ ] At most 10 entries in `triggers:`; each matches one of the five trigger shapes
