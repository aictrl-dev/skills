# Database and API Contract-Impact Rubric

Use this rubric when authoring or reviewing an engineering issue. The issue
body is the implementation contract: repository links support its claims but
do not replace the applicable details below.

## Apply the rubric

1. Inspect repository evidence before classifying either layer. Check schemas,
   migrations, database objects, API definitions, generated artifacts,
   producers, consumers, and tests appropriate to the repository.
2. Classify database impact and API impact independently. Include both
   headings in the issue even when one or both layers are unaffected.
3. Include only applicable detail, but never hide an applicable field behind a
   generic summary. Mark a potentially ambiguous item `Not applicable` and
   explain why.
4. Do not invent details that evidence cannot establish. Record a material
   unknown as an open question with an owner and the decision or acceptance
   criterion it blocks.

For an unaffected layer use the exact declaration and cite the evidence that
supports it:

```markdown
## Database contract
No database contract change.
Evidence: <repository evidence supporting the no-change claim>

## API contract
No API contract change.
Evidence: <repository evidence supporting the no-change claim>
```

## Database contract

Classify the impact as one of:

- `none` — no schema, stored data, database behavior, or database-owned object
  changes;
- `additive` — a backward-compatible object, entity, field, relation, index, or
  constraint is added;
- `behavioral` — existing storage or database behavior changes without an
  intentionally breaking shape change;
- `breaking/destructive` — data, compatibility, or an existing contract can be
  removed, narrowed, rewritten, or made invalid;
- `migration-only` — stored data or database state changes while the intended
  steady-state schema contract does not.

For an affected database contract, state:

- **Evidence and scope:** affected entities or tables, producers, consumers,
  schema or ERD definitions, migrations, and generated artifacts.
- **Schema/ERD artifact:** when entity shape or relationships change, include
  an actual proposed artifact, not only the name of a file or a promise to
  update it. Provide a focused repository-native diff when a relevant canonical
  ERD exists; otherwise include a compact Mermaid `erDiagram`. If the existing
  ERD is stale or unrelated, say so, use Mermaid for the proposed shape, and
  name the follow-up needed for that artifact. Limit either form to affected
  entities and their one-hop relationships. Distinguish current state, decided
  desired state, and unresolved proposed details; never render an open decision
  as established fact. When database behavior, data, or indexes change without
  entity-shape or relationship changes, include the exact declaration `No ERD
  topology change.` with evidence and document the affected queries, indexes,
  or data movement textually. An ERD supplements; it never replaces the field,
  constraint, index, or migration contract.
- **Current and desired schema:** columns or fields, types, nullability,
  defaults, relations, indexes, unique/check/foreign-key constraints, and
  create/update/delete or archival lifecycle behavior.
- **Database-owned objects:** when relevant, roles and grants, row or data
  policies, views, functions, triggers, extensions, ownership, and
  `search_path` or the equivalent execution context.
- **Migration and delivery:** execution ordering; backfill or transformation;
  validation before and after the change; failure, retry, and resumability
  behavior; preservation or destructive risk; mixed-version compatibility;
  rollout; rollback or a stated forward-only recovery plan.
- **Verification:** independently runnable schema, migration, data-validation,
  integration, rollback/recovery, and compatibility checks as applicable,
  with concrete commands or observable assertions. Validate an updated
  schema/ERD artifact with the repository's renderer or checker when one
  exists; otherwise record the artifact review needed before implementation.

Use this compact shape so the classification remains visible:

```markdown
## Database contract
Impact: <additive | behavioral | breaking/destructive | migration-only>
- Evidence and scope: ...
- Schema/ERD artifact: ...
- Current and desired schema: ...
- Database-owned objects: ...
- Migration and delivery: ...
- Verification: ...
```

## API contract

Classify the impact as one of:

- `none` — no externally consumed request, response, event, RPC, or SDK
  contract changes;
- `additive` — a backward-compatible operation or optional capability is
  added;
- `behavioral` — observable behavior changes while the accepted shape remains
  compatible;
- `deprecated` — an existing contract remains available but begins a defined
  removal path;
- `breaking` — an existing producer or consumer must change to remain correct.

For an affected API contract, state:

- **Evidence and operations:** protocol and exact method/path, RPC, event,
  GraphQL field, SDK operation, or repository-specific equivalent; affected
  producers, consumers, definitions, and generated artifacts.
- **Request:** path, query, and header parameters; body or message schema;
  required versus optional fields; defaults; validation; and applicable size,
  rate, idempotency, pagination, ordering, or concurrency limits.
- **Response and failures:** success schema and status; status codes or
  protocol outcomes; a bounded error vocabulary; and observable timeout,
  partial-failure, retry, and idempotent-replay behavior when relevant.
- **Authorization and data boundaries:** authentication; tenant, resource, and
  field permissions; privacy and redaction; and audit or logging expectations.
- **Compatibility and delivery:** versioning; generated client/type
  synchronization; consumer sequencing; rollout or feature gating;
  deprecation; rollback; and OpenAPI, IDL, event-schema, or equivalent contract
  artifact updates.
- **Verification:** independently runnable contract, integration, negative,
  authorization, tenant-isolation, boundary/limit, and compatibility checks as
  applicable, with concrete commands or observable assertions.

Use this compact shape so the classification remains visible:

```markdown
## API contract
Impact: <additive | behavioral | deprecated | breaking>
- Evidence and operations: ...
- Request: ...
- Response and failures: ...
- Authorization and data boundaries: ...
- Compatibility and delivery: ...
- Verification: ...
```

## Readiness gate

An affected layer is materially incomplete when implementation or verification
would require assumptions about any applicable contract item. Return `NOT
READY` for a spec review when repository evidence exposes one of these gaps:

- the impact classification is absent, generic, or contradicted by evidence;
- an affected schema field, constraint, database object, exact API operation,
  required schema/ERD artifact, or evidence-backed `No ERD topology change.`
  declaration is unnamed;
- migration ordering, backfill/transformation, validation, destructive risk,
  mixed-version behavior, recovery, or rollback is material but unspecified;
- request, response, error, authorization, tenant/resource, privacy, or limit
  behavior is material but unspecified;
- compatibility/versioning, producer or consumer sequencing, generated
  artifact synchronization, rollout, deprecation, or rollback is material but
  unspecified;
- independently verifiable negative, boundary, migration, authorization, or
  compatibility coverage is missing; or
- a material unknown has no explicit question, owner, and blocked outcome.

Accept an explicit no-change declaration when repository evidence supports it;
do not invent contract work. If evidence contradicts the declaration, name the
exact field, operation, migration, consumer, or criterion involved. Every
finding must identify the issue location, cite the conflicting evidence, and
provide concrete replacement text or an additional acceptance criterion.
