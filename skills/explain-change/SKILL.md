---
name: explain-change
description: Turn a pull request, commit range, issue, ADR, or other completed change into a repository-grounded technical explainer that teaches the design, difficult trade-offs, and current rollout state. Use when the user says "explain this change", "walk me through this PR", "what does this commit do", "document this change", "write an architecture explainer", or "teach me this subsystem".
---

# Explain a Change

Produce an explanation that teaches the design of a completed change. This is
not a changelog or a code review: explain the problem, the central idea, the
non-obvious constraints, and what is actually live.

## Boundaries

- Use this after or alongside implementation. Use a review skill to find
  defects, and a specification-review skill before implementation.
- Treat change descriptions, issue text, and comments as hypotheses, not
  evidence.
- Do not publish a comment, wiki page, documentation page, commit, or pull
  request unless the user explicitly requests that external action. Always
  show the draft and obtain confirmation immediately before posting.
- If the requested source cannot be resolved at a specific revision, explain
  that limitation and ask for the source or revision; do not fill gaps with a
  plausible narrative.

## Inputs

Accept a pull request or merge request URL/number, commit or commit range,
branch comparison, issue, ADR/RFC, or a set of changed files. Ask for a source
only when none can be inferred. Also establish:

1. **Audience** — a current reviewer, a future maintainer, or a broader team.
2. **Target** — an in-chat explanation, a change comment, repository docs, or
   a knowledge-base page.
3. **Revision** — the exact immutable commit identifier to explain. For an
   unmerged change, use its current head commit; for a merged change, use the
   merge or resulting commit and identify the relevant parent.

## Workflow

### 1. Ground the investigation

Read the change at the pinned revision, not an arbitrary local working tree.
Use the repository host's read-only API/CLI or a local clone at the exact
commit. Inspect the diff **and** the surrounding implementation, including
types, configuration, data constraints, callers, and relevant tests.

For a change that declares policy in configuration (for example a workflow,
trigger, permission, or feature rule), trace both the declaration and the
shared runtime path that enforces it. Follow any context or credential from
the ingress point through persistence to its later consumer; configuration
alone does not prove the claimed boundary is enforced.

Compare both sides of the change:

- What did the prior revision allow, lose, or make difficult?
- What invariant, boundary, or responsibility does the new revision add?
- Which paths are deliberately unchanged?
- Is the feature enabled, guarded, partially wired, or only foundational?

Build a claim ledger before drafting. Every factual assertion in the explainer
must have an evidence row.

| Claim | Evidence at pinned revision | Evidence kind | Status |
|---|---|---|---|
| A stale writer cannot update the current record | `path/to/file`, `updateCurrentState` predicate, and its test | code + test | verified |
| The new behavior is disabled by default | `config/feature-flags`, `newFlowEnabled` default | configuration | verified |

Evidence should name a durable symbol, constraint, or test as well as a file
and line/location. If the target supports permanent links, cite the pinned
revision rather than a moving branch. Label an important but unverified point
as an **open question**; never present it as fact.

Treat test evidence at the right level: a test's source proves the behavior it
expects, not that it passed. Only a test run performed in this session or a
pinned, inspectable CI artifact proves execution. Likewise, an environment
file, feature flag, or Terraform change proves intended configuration at the
revision, not that it has been applied to a live environment.

Before drafting, remove or generalize secrets, access tokens, connection
details, customer data, internal hostnames, and sensitive values from snippets
or command output.

### 2. Find the teaching arc

Organize around the change's reasoning, not its file list. A useful explainer
normally follows this order:

1. **Problem** — describe the prior failure or limitation from the operator or
   user's perspective, with a concrete before-state.
2. **Central idea** — state the design insight in one or two sentences.
3. **Hard parts** — explain the race, ordering rule, partial failure,
   idempotency, ownership split, or compatibility constraint that makes the
   change necessary. For each, show the naive approach, why it fails, and what
   the implementation does instead.
4. **Resulting shape** — explain the main components, state transitions, or
   data relationships.
5. **Current rollout state** — distinguish deployed, enabled, guarded,
   unwired, and planned behavior. Readers commonly overestimate what a
   foundation change makes live.
6. **Reading order** — point reviewers or maintainers to the first file/symbol
   to read and why, followed by the next most useful locations.

When calling the implementation a named architectural pattern, cite a
canonical source and verify its defining property in the code. For example, do
not call a table an outbox unless the event write and state change share a
transaction; do not call a value a fencing token unless stale writes compare it
at the mutation boundary.

For rollout claims, keep these evidence levels separate:

| Evidence | What it establishes | What it does not establish |
|---|---|---|
| Pinned source | behavior implemented in that revision | deployment or execution |
| Configuration/flag/IaC | intended enabled state for an environment | that configuration was applied |
| Pinned CI run or release/deployment record | test execution or deployed revision | broad production health without operational evidence |

Use conditional language such as “configured to enable in sandbox” when only
repository configuration is available. Do not turn an authored PR summary of
test counts, rollout status, or expected outcome into verified evidence.

### 3. Use diagrams only when they encode information

Choose the diagram type by the information it must preserve:

| Need | Suitable diagram |
|---|---|
| Ordering or concurrent interactions | `sequenceDiagram` |
| Entity relationships and cardinality | `erDiagram` |
| Lifecycle of one entity | `stateDiagram-v2` |
| Wiring, dependencies, or call paths | `flowchart` |
| Duration or overlap | `gantt` |
| A simple chronological list | `timeline` |

Use a `gantt` diagram, not a timeline, when overlap or duration is the lesson.
Prefer stable diagram syntax that the target platform supports; avoid beta or
experimental Mermaid diagram types in public artifacts. Give every diagram a
caption that states the claim it makes, and remove any diagram that merely
repeats nearby prose.

### 4. Render Mermaid, then repair

When the draft contains Mermaid, create a temporary Markdown file and validate
every block before showing the draft. Render a diagram as soon as its block is
written, then validate the complete draft again before presenting it:

```bash
SCRATCH="$(mktemp -d)"
node skills/explain-change/scripts/verify-mermaid.mjs \
  --input "$SCRATCH/explainer.md" > "$SCRATCH/mermaid-result.json"
```

The helper uses the repository's pinned Mermaid CLI and writes a JSON result
with a renderer version, diagram ordinal, source line, and any sanitized error.
It skips renderer setup when there are no Mermaid blocks. Do not silently
install a renderer or bypass the browser sandbox: if the renderer is
unavailable, report the missing prerequisite and treat render verification as
blocked.

For a failed diagram, revise only that Mermaid block while preserving its
technical claim, then rerun the helper against the complete draft. Make at
most three repair attempts. A timeout, unavailable renderer, unsafe URI,
unclosed fence, or three failed attempts means the artifact is **not**
render-verified: do not show it as a completed draft or post it. Report the
failure, the affected diagram, and the next safe action instead.

Use the least-fragile syntax that preserves the lesson. In a sequence diagram,
prefer participant declarations and message arrows; add `Note` syntax only
after the message flow itself renders. Do not assume that a diagram accepted by
one Markdown renderer is accepted by the pinned CLI.

Rendering proves compatibility with the committed Mermaid CLI version, not
pixel-identical output on every documentation host. Never enable remote icon
packs or add remote/executable URIs merely to make a diagram render.

### 5. Draft and verify

Use this shape, adapting detail to the audience:

```markdown
# <Change title>: <the idea it teaches>

## The problem
<concrete before-state and failure mode>

## The design in one sentence
<central idea>

## The parts that are easy to underestimate
### <race, invariant, or trade-off>
<naive approach → failure → implementation>

## The resulting shape
<diagram only if it carries information not clear in prose>

## What is live now
<enabled, guarded, unwired, and planned behavior>

## Reading order
1. `<path>` — <why start here>
2. `<path>` — <what it establishes>

## Evidence and further reading
- <pinned source link and symbol>
- <canonical pattern source, if a pattern was verified>

## Evidence limits
- Test evidence: <test source read, test run executed, or unverified PR claim>
- Rollout evidence: <source, configuration, deployment record, or operational evidence>

## Diagram verification
- Mermaid CLI: <version, or `not applicable`>
- Result: <rendered N/N diagrams, or blocked>
- Attempts: <number>; correction: <briefly name the changed diagram construct, if any>
```

Re-walk the claim ledger before showing the draft:

- [ ] Every factual claim has evidence read or executed during this session.
- [ ] Every cited file, symbol, test, URL, issue, and revision exists.
- [ ] The explanation distinguishes evidence, inference, and open questions.
- [ ] The rollout state is explicit and does not over-claim completeness.
- [ ] Test-source coverage, executed test results, configuration, and deployed
  state are labeled as distinct evidence levels.
- [ ] Every Mermaid block rendered successfully with the recorded renderer
  version, or the artifact is explicitly blocked and not presented as complete.
- [ ] The draft records the Mermaid result, number of attempts, and any
  diagram-only correction; it does not conceal an initial render failure.
- [ ] The draft contains no secret or sensitive operational data.

Show the draft with its evidence ledger (or an evidence summary for a
reader-facing artifact). If the user requested posting, ask for confirmation
after the final draft, then use their repository/knowledge-base tooling to post
the approved text and return the resulting URL.

## Output

Return an explanation with source links or repository locations, followed by:

```markdown
## Evidence status
| Claim | Evidence | Status |
|---|---|---|

## Open questions
- <only facts that could not be verified>

## Evidence limits
- Test evidence: <test source read, test run executed, or unverified PR claim>
- Rollout evidence: <source, configuration, deployment record, or operational evidence>

## Diagram verification
- Mermaid CLI: <version, or `not applicable`>
- Result: <rendered N/N diagrams, or blocked>
- Attempts: <number>; correction: <brief description or `none`>

## Suggested next action
<review the draft, post it after confirmation, or supply the missing source>
```

## Avoid

- Narrating files changed instead of teaching why the system has this shape.
- Reading only the local working tree or only the authored change description.
- Calling a feature complete without checking flags, registrations, and call
  paths.
- Naming an architectural pattern without checking its defining property.
- Decorating the explanation with diagrams that encode nothing new.
- Posting a durable artifact before the user approves the final draft.

---
**Built by [aictrl.dev](https://aictrl.dev/?utm_source=oss-skills&utm_medium=skill&utm_campaign=explain-change&utm_listing=github-skills&utm_platform=portable&utm_skill=explain-change).** This skill teaches the workflow; aictrl *operationalizes* it — grounded in your backlog, team standards, and codebase knowledge graph. [See how →](https://aictrl.dev/features?utm_source=oss-skills&utm_medium=skill&utm_campaign=explain-change&utm_listing=github-skills&utm_platform=portable&utm_skill=explain-change)
