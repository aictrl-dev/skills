# aictrl.dev workflow authoring guide (v2)

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

**How a file goes live:** aictrl syncs `.aictrl/workflows/` automatically about
20 s after a push to the repository's default branch. There is no manual sync
step; do not add one to your instructions. A file on any other branch has no
effect.

## Top-level fields

```yaml
schemaVersion: aictrl/workflow/v2   # required for new portable workflows
name: my-workflow                   # required; kebab-case, unique within org, 1-64 chars
label: My Workflow                  # optional; human-readable display name
description: What this workflow does # optional
category: code-quality              # optional; UI grouping
icon: code                          # optional; Lucide icon name
failureStrategy: fail-fast          # optional; 'fail-fast' (default) | 'continue-on-error'
failureComment: true                # optional; default true. On failure of a run started by a
                                    # GitHub issue/PR trigger, aictrl comments on that issue/PR;
                                    # false turns that comment off
defaults:                           # optional (v2); workflow-level execution defaults
  model: anthropic/claude-sonnet-5  # optional; for task/template nodes without their own `model`
parameters: [...]                   # optional; workflow-level inputs (see Parameter types)
nodes: [...]                        # required; at least one node
edges: [...]                        # optional; ordering (see Edges)
qualityGates: [...]                 # optional; manual or auto checkpoints
triggers: [...]                     # optional; up to 10 file-declared event triggers
```

**Name the workflow for the organisation, not the repository.** `name` is
unique per aictrl organisation. Two repositories that sync the same `name`
conflict and one fails to sync. When the same workflow runs in several
repositories, prefix the name with the repository
(`web-implement-issue-from-ai-fix`, `api-implement-issue-from-ai-fix`).

**No system fields** in the authored file: no `id` (org-level UUID), `version`,
`status`, timestamps, `runCount`, or canvas `position`. These are populated by
the platform on import. Authoring them is a schema error (`additionalProperties`
is `false` at the top level and on every object).

## Parameter types (14 total)

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
| `repository` | string | Connected repository in owner/name form |
| `pull-request` | string | PR URL |
| `story` | string | Story/ticket URL |
| `issue` | string | aictrl issue; resolved to a snapshot when the run starts |
| `image` | string | Image URL or base64 |
| `github-issue` | string | GitHub issue URL |

Parameter schema:
```yaml
- name: my-param          # required; kebab-case
  label: My Parameter     # optional; defaults to name
  type: string            # required; one of the 14 types above
  description: What it is # optional
  required: false         # optional; default false
  default: some-value     # optional
  options: [a, b, c]      # required for select/multi-select; forbidden otherwise
```

`options` is **required** for `select`/`multi-select` (min 1 item) and
**forbidden** on every other type. Both directions are enforced by the schema.

## Node types (4 total)

v1 files support only `template`, `loop` and `user-input`; the `task` node,
`model`, `defaults` and gate-receipt input mappings are v2-only.

Every node must have `id` (kebab-case) and `type`. Each type has a required field
and a set of forbidden fields (per-type **field exclusivity**, enforced by the
schema's `allOf` block). Supplying a field that belongs to another node type is a
schema error.

`wait`, `manual` and composite `workflow` node types are **not supported** and are
rejected by the schema. For a human step use a `user-input` node or a manual
quality gate; a later node can read the gate's approval receipt (see
[Approval receipts](#approval-receipts)).

### `task` — define portable skill-backed work inline (v2)

```yaml
- id: review
  type: task
  skill: code-review@1.0.0       # required; pin when a version is resolvable
  taskType: code-review          # required; executor tool boundary
  prompt: Review the current pull request head and return structured findings.
  model: anthropic/claude-sonnet-5  # optional; overrides defaults.model for this node
  timeoutMinutes: 10             # optional; executor runtime, integer 1-60
  parameters:
    - { name: pull-request, type: pull-request, required: true }
  inputs:
    pull-request: { from: input, name: pull-request }
  outputs:
    findings: json
```

**`taskType: code-review` takes exactly one parameter: the pull request.**
Declare it as `{ name: <any>, type: pull-request, required: true }` and map it
to the PR URL. Add no other parameter (no `issue-url`, `repository` or
findings). The schema enforces this, so `validate.mjs` and aictrl's save/sync
both reject any other shape; older releases accepted it and then failed the
step at dispatch with `template_unavailable`. Do context checks that need the
issue in a later `general` step.

**Code-review outputs are written by the platform.** For `taskType:
code-review`, aictrl adds the recorded `findings` (an empty list when there are
none) and `maxSeverityRank` to the step output; `maxSeverityRank` is `null` for
an empty review. Declare `findings: json` only. A declared `number` output
cannot be null-guarded (`!= null` is a CEL type error at apply), and a `when`
on an undeclared output of a task node fails apply. So gate a later step on
the findings, which bind as `dyn`:
`has(review.output.findings) && review.output.findings != null && size(review.output.findings) > 0`.
A loop's `until`/`while` may use the guarded
`last.review.output.maxSeverityRank` (see the Issue → PR example).

Inline task nodes make the task configuration portable in the workflow file.
Their `inputs` are checked against the in-file `parameters`; their declared
`outputs` may be mapped by downstream nodes. Treat `prompt` as instructions for
the selected skill, not as a way to relax workflow policy or tool boundaries.
`timeoutMinutes` is an optional hard executor bound from 1 to 60 minutes.
`model` is an optional portable model reference (for example
`anthropic/claude-sonnet-5`); it is resolved against the organization's model
connections when the file is applied. A node without `model` uses
`defaults.model`, then the organization default.

An output can be a primitive type name or a descriptor with `type`, optional
`nullable` and `description`, and an optional `verify` block. With `verify`,
aictrl checks the GitHub issue effect after the task runs instead of trusting
the reported value. `issueParameter` names the task parameter that holds the
issue; mark that parameter `githubIssueContext: true` (it must be a required
`string` or `github-issue` parameter):

```yaml
- id: triage
  type: task
  skill: issue-triage@1.0.0
  taskType: general
  prompt: Triage the issue, comment with the plan and label it ready.
  parameters:
    - { name: issue, type: github-issue, required: true, githubIssueContext: true }
  inputs:
    issue: { from: input, name: issue }
  outputs:
    summary: string
    planComment:                 # URL of the comment the task posted
      type: string               # github-issue-comment requires string, not nullable
      verify: { kind: github-issue-comment, issueParameter: issue }
    labelled:
      type: boolean
      verify: { kind: github-issue-labels, issueParameter: issue, labels: [ready] }
```

`labels` takes 1-8 unique literal names. A node declares at most 64 outputs, and
`__aictrlFailure` is reserved and cannot be an output name.

Forbidden on `task`: `template`, `templateVersion`, `workflow`, `workflowVersion`,
`maxIterations`, `until`, `while`, `onMaxIterations`, `body`, `signalSource`,
`checklistItems`, `assignee`.

### `template` — run a task template
```yaml
- id: review
  type: template
  template: inline-code-review   # required; portable kebab name (not a UUID)
  templateVersion: "1.4.0"       # optional; pin a specific version
  model: anthropic/claude-sonnet-5  # optional (v2); overrides defaults.model
  inputs: { ... }                # optional; mapped to the template's parameters
  when: "..."                    # optional; CEL skip condition
  outputKey: my-output           # optional; override artifact key
```

Forbidden on `template`: `workflow`, `workflowVersion`, `maxIterations`, `until`,
`while`, `onMaxIterations`, `body`, `signalSource`, `timeoutMinutes`,
`checklistItems`, `assignee`, `parameters`, and the task-only fields `skill`,
`taskType`, `prompt` and `outputs`. Type-specific fields it permits:
`templateVersion` and (v2) `model`.

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
`signalSource`, `timeoutMinutes`, `checklistItems`, `assignee`, `parameters`,
`skill`, `taskType`, `prompt`, `outputs` and `model`.
Supplying both `until` and `while` together is also forbidden (exactly one or
neither).

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
`signalSource`, `timeoutMinutes`, `checklistItems`, `assignee`, `skill`,
`taskType`, `prompt`, `outputs` and `model`.

### Replacing unsupported node types

`wait`, `manual` and composite `workflow` nodes are rejected in both v1 and v2
files. To update an existing file:

- **`manual` node** → remove the node and add a manual quality gate after the
  wave it followed (`qualityGates: [{ afterWave: N, type: manual }]`). Move its
  checklist into the gate's `description`. In a v2 file, a later node can read
  the decision with `{ from: gate, afterWave: N }` (see
  [Approval receipts](#approval-receipts)); v1 files have no gate mapping, so
  migrate the file to `schemaVersion: aictrl/workflow/v2` to consume receipts.
- **`wait` node** → there is no signal-wait node. For input a person provides at
  run time use a `user-input` node; to react to an external event, start the
  workflow from a trigger instead.
- **`workflow` (composite) node** → inline the called workflow's steps as `task`
  or `template` nodes, or run it as its own workflow with its own trigger.

## Input mappings

Every node `inputs` entry maps a parameter name to one of four mapping kinds
(the schema's `inputMapping` `oneOf` — exactly one shape per entry): a static
value, a workflow parameter, an upstream node output, or (v2 only) a manual
gate's approval receipt (see [Approval receipts](#approval-receipts)).

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
  maxRetries: 0            # required; schema allows 0-10, apply rejects above 0
  backoffMs: 2000          # required; milliseconds between retries (>= 0)
  backoffMultiplier: 2.0   # optional; multiplier applied to backoffMs each retry (0-10)
  maxBackoffMs: 30000      # optional; cap on exponential backoff
```

Each node is attempted once. A retry policy with `maxRetries` above 0 passes
the schema but is rejected when the file is applied; use `maxRetries: 0` (or omit
`retry`).

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

### Approval receipts

Every decision on a manual gate records an approval receipt. A node that runs
**after** the gate can take it as an input with `{ from: gate, afterWave: N }`
(add `gateIndex` only when that wave has more than one gate):

```yaml
nodes:
  - id: preflight
    type: task
    skill: spec-review@1.0.0
    taskType: general
    prompt: "Read-only preflight. Report the baseline commit SHA as `revision`."
    parameters:
      - { name: repository, type: repository, required: true }
    inputs:
      repository: { from: input, name: repository }
    outputs: { ready: boolean, revision: string }
  - id: execute
    type: task
    skill: implement-code-change@1.0.0
    taskType: general
    prompt: "Proceed only if the receipt's revision and digest match what you will change."
    parameters:
      - { name: repository, type: repository, required: true }
      - { name: approval-receipt, type: json, required: true }
    inputs:
      repository: { from: input, name: repository }
      approval-receipt: { from: gate, afterWave: 1 }
    outputs: { changed: boolean }
edges:
  - { from: preflight, to: execute }
qualityGates:
  - afterWave: 1
    type: manual
    description: Approve the preflight before any change is made.
```

The receipt contains `decision`, `approver` (id, display name, email, org role),
`channel` (`ui`, `api` or `mcp`), `decidedAt`, `revision`, `note`,
`approvedOutputs` (per upstream node: status, execution id, and the sha256 of its
output) and `digest` (sha256 over `approvedOutputs`).

`revision` is the 40-character `revision` output of the latest node before the
gate; declare a `revision: string` output on that node to bind the gate to a
commit. When deciding through MCP, pass the `expectedRevision` and
`approvalDigest` shown by `get_workflow_run` as `expected_revision` and
`expected_digest` to `approve_workflow_step`; a decision made on a stale view is
refused.

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

# Fire for ordinary non-command messages from an explicit Telegram chat:
  - type: chat-message
    provider: telegram
    chats: [123456789]             # required and non-empty when command is omitted
    inputs:
      prompt:
        from: message
        field: text
```

- `comment`, `pr-ready`, and `pr-opened` require `on: pull-request`. `label`
  takes `on: pull-request` (a label added to a pull request) or `on: issue` (a
  label added to an issue; map inputs from `$.issue.*` and `$.repository.*`).
- A label trigger fires only for the repository whose `.aictrl/workflows/`
  declares it. The same label in two repositories does not cross-fire; each
  repository needs its own file (with its own `name`).
- `pr-opened` fires for every newly opened PR, including drafts. `pr-ready` fires
  when a draft becomes ready or when a PR is opened non-draft.
- For GitHub triggers, `inputs` maps workflow parameter names to JSONPath
  expressions (each must start with `$`) evaluated against the webhook payload;
  max 20 entries.
- `chat-message` has no `on` field. `provider` is required. When present,
  `command` must be an exact, case-sensitive slash command; a command trigger may
  omit `chats` to accept any chat. When `command` is omitted, the trigger matches
  ordinary non-command messages and requires a non-empty `chats` allowlist. Its
  `inputs` values are `{ from, field }` mappings, where `from` is `message`,
  `channel_post`, or `interaction`, and `field` is a dot-path rather than JSONPath.
  Telegram has runtime support; Slack and Discord definitions can be stored but
  do not yet fire workflows.
- **Security (enforced at event time):** only events from a repo collaborator with
  write/admin permission fire a trigger; bot comments and comment edits are
  ignored for GitHub triggers. This is a platform guarantee, not something you
  configure in the file.

## Issue → reviewed pull request workflows

For "label an issue → get a reviewed PR", start from
`reference/examples/issue-to-reviewed-pr.yaml`. It is the production workflow
with its repository-specific values marked `ADAPT`. Change only the name,
label, base branch and skills; the base-branch substitution (`main` →
your branch) is the only edit inside the prompts. Its prompts already encode
these rules:

- **Find the issue's PR through `closedByPullRequestsReferences`.** GitHub lists
  a branch made with `createLinkedBranch` in the issue's `linkedBranches` only
  until its PR opens; after that it is gone. `closedByPullRequestsReferences`
  (GraphQL) lists the PRs that close the issue, but only those whose base is the
  repository's default branch. If the workflow targets another base branch,
  the lookup finds nothing, a re-run opens a new PR and the ownership checks
  below block; tell the user.
- **Read-only steps stay read-only.** A review step reads the PR and records
  findings; it does not post comments, push or edit anything. It checks only
  what the PR URL supports (base branch, head repository equals base
  repository, branch form) and leaves the issue match to the writing steps. On
  a failed check it records no findings and finishes without failing, so the
  run still reaches the notify step, which repeats the check and reports it.
- **Check ownership in the steps that write.** Before a step comments, pushes or
  changes the PR, it confirms the PR belongs to the triggering issue. Start the
  check from trigger inputs: look up the issue from `issue-url` and confirm it
  lists the PR in `closedByPullRequestsReferences`, that the PR is in
  `repository` with its head in `repository` (not a fork), and that it targets
  the base branch. A branch name or PR text (title, body) alone is never proof:
  anyone who can push to the PR controls it.
- **Ownership is identity, not state.** A PR merged mid-run still belongs to
  the issue: the fix step writes nothing and the notify step reports it as
  merged. A PR closed without merging blocks.
- **The code-review step takes only the PR** (see the `task` node section).
- **Write blocked runs back to the issue in a fixed form.** A writing step that
  must stop posts one comment on the triggering issue, `Workflow blocked:
  <reason-code>`, with one reason-code vocabulary shared by every node, then
  fails. The comment contains no URL and never links the PR or quotes issue,
  PR or branch text. Agents read only their own node's prompt, so repeat the
  rule word for word in each node that posts rather than referring to a
  comment or another node. aictrl also comments on the
  triggering issue or PR when a run fails (`failureComment`, default `true`),
  which covers steps that crash or time out.
- **Keep the success comment short and idempotent.** The notify step writes
  its summary in its own words, quotes no issue, PR or branch text, contains no
  URL other than the verified PR URL, and ends with a fixed marker line; it
  posts nothing if a comment with that marker already exists.
- **Read the PR URL back, never compose it.** The implement step lists open PRs
  for its branch and base (`gh pr list --head <branch> --base <base> --state
  open --json url`) and requires exactly one result.

## Portable references

Use the **kebab name** (`name` field of the template), not an internal
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
- **`wait`, `manual`, composite `workflow` or `pause` node types** — not in the
  schema. For a human step use a `user-input` node or a manual quality gate.
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
- [ ] Every `taskType: code-review` node has exactly one parameter:
      `type: pull-request`, `required: true`
- [ ] `name` is prefixed with the repository when the workflow runs in several
      repositories
- [ ] Read-only steps post no comments; writing steps start ownership checks
      from trigger inputs, never from a branch name or PR text alone
- [ ] Blocked comments use `Workflow blocked: <reason-code>` and never link the
      PR or quote issue, PR or branch text
- [ ] A `taskType: code-review` node declares `findings: json` only; later
      steps gate on the null-guarded `findings`
- [ ] An issue's PR is found through `closedByPullRequestsReferences`, not
      `linkedBranches`
- [ ] An Issue → PR workflow starts from `reference/examples/issue-to-reviewed-pr.yaml`
- [ ] Every `loop` node has `maxIterations` and `body`; `until` and `while` are mutually exclusive
- [ ] Every `user-input` node has `parameters`
- [ ] CEL expressions are boolean; no string/number results
- [ ] `select`/`multi-select` parameters have `options`; other types must NOT have `options`
- [ ] Input mappings use `{ value: ... }`, `{ from: input, name: ... }`, `{ from: node, node: ... }`, or (v2) `{ from: gate, afterWave: ... }`
- [ ] No `regex` or `template` extract methods
- [ ] `model` only on `task`/`template` nodes (or `defaults.model`); no `retry` with `maxRetries` above 0
- [ ] Loop nesting <= 3; product of nested `maxIterations` <= 1000
- [ ] Portable refs (kebab names) for `template:`
- [ ] **`node validate.mjs <file>` exits 0** (layer-1 schema + static DAG checks)
- [ ] At most 10 entries in `triggers:`; each matches one of the five trigger shapes
