---
name: create-issue
description: Create a code-grounded engineering story or task with scope, acceptance criteria, test expectations, risks, and open questions. Use when the user says "create an issue", "open a ticket", "make a backlog item", or describes a feature or chore that should be tracked; delegate defects to create-bug.
---

# Create an Engineering Issue

Turn a vague feature, chore, or engineering request into a provider issue that another engineer can implement without reconstructing intent. Use `create-bug` for broken or regressed behavior.

Read the [shared contract-impact rubric](reference/contract-impact.md) before
inspecting or drafting the issue. This authoring copy is mirrored byte-for-byte
at `skills/spec-review/reference/contract-impact.md`; change both together.

## Workflow

1. Classify the request. If it describes symptoms, an exception, a regression, or expected-versus-actual behavior, stop and use `create-bug`.
2. Resolve the target repository and issue provider from the request, repository remote, or native provider tools. If no writable provider is available, produce provider-neutral Markdown.
3. Search open and closed issues for the outcome, component, and distinctive terms. Link a real duplicate instead of creating another issue.
4. Inspect repository guidance, relevant code, architecture, schemas, migrations, database objects, APIs, generated artifacts, UI, tests, and recent changes. Ground scope in evidence; do not invent an implementation.
5. Apply the contract-impact rubric: classify database impact and API impact independently from repository evidence before drafting. Trace affected producers, consumers, compatibility, migration, authorization, data-boundary, delivery, and verification work. Record evidence for an explicit no-change declaration when a layer is unaffected.
6. Define the user or operator, current situation, desired outcome, and why the work matters now.
7. Trace the remaining work across affected layers and identify dependencies, privacy, observability, and rollout concerns not already captured by the contracts.
8. Write independently verifiable acceptance criteria, including negative, boundary, compatibility, migration, authorization, and regression cases appropriate to the change.
9. Separate required scope, explicit out-of-scope items, risks, and open decisions. Ask only when an unresolved choice materially changes the ticket; leave unsupported material details as owned open questions.
10. Draft the issue with the template below. Show it before external creation unless the user already explicitly authorized creation.
11. Create with the provider's native capability and existing labels/milestone conventions when available. Return the URL and summarize any provider metadata you could not set.

## Template

```markdown
## Context
<current user-facing situation and repository evidence>

## Goal
<specific desired outcome and success definition>

## User story
As a <persona>,
I want <capability>,
so that <outcome>.

## Proposed approach
<high-level implementation constraints supported by evidence; leave design room>

## Database contract
<complete applicable contract from the shared rubric, or "No database contract change." with supporting evidence>

## API contract
<complete applicable contract from the shared rubric, or "No API contract change." with supporting evidence>

## Acceptance criteria
- [ ] <observable behavior and verification>
- [ ] <negative or boundary behavior>
- [ ] <test, migration, authorization, or rollout requirement>

## Out of scope
- <explicit boundary>

## Risks and dependencies
- <risk/dependency plus mitigation or owner>

## Open questions
- <only decisions that could change scope or outcome>

## References
- <code paths, docs, related issues/PRs>
```

## Quality bar

- Titles are short, action-oriented, and name the outcome.
- Every criterion can be demonstrated by a test, command, API response, rendered state, or recorded external result.
- Database and API impacts are independently classified and complete under the shared rubric; unaffected layers are declared explicitly and supported by evidence.
- Findings name concrete paths or contracts; generic “improve” language is rejected.
- External mutation, assignment, and milestone changes stay within the user's authorization.
- Never include secrets, credentials, private customer data, or unnecessary source excerpts.

---
**Built by [aictrl.dev](https://aictrl.dev/?utm_source=oss-skills&utm_medium=skill&utm_campaign=create-issue&utm_listing=github-skills&utm_platform=portable&utm_skill=create-issue).** This skill teaches the workflow; aictrl *operationalizes* it — grounded in your backlog, team standards, and codebase knowledge graph. [See how →](https://aictrl.dev/features?utm_source=oss-skills&utm_medium=skill&utm_campaign=create-issue&utm_listing=github-skills&utm_platform=portable&utm_skill=create-issue)
