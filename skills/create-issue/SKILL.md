---
name: create-issue
description: Create a well-formed GitHub issue from a vague idea, bug report, or feature request. Use when the user says "create an issue", "open a ticket", "file a bug", "log this in GitHub", "make a backlog item", or describes something that should be tracked. Drafts a structured body and creates the issue via gh CLI.
---

# Create a GitHub Issue

Turn a vague idea, bug report, or feature request into a well-formed GitHub issue with a structured body that engineers can act on.

## When to Use

- "Create an issue for X"
- "Open a ticket about Y"
- "File a bug: Z is broken"
- "Make a backlog item for this idea"
- "Log this in GitHub so we don't lose it"
- The user describes something that should be tracked but isn't yet

**Do NOT use this skill for:**
- Triaging existing issues — search first with `gh issue list --search "<keywords>"`
- Adding TODOs to local files — that's not an issue

## Required Inputs

Before creating the issue, gather (or ask for) these inputs. If the user gave you everything in one message, proceed without asking. If something is missing and you can't infer it, ask one focused question and stop.

| Input | Required? | How to determine |
|-------|-----------|-----------------|
| **Title** | Yes | Short, action-oriented, <70 chars. Bug = "Fix: X". Feature = "Add: Y". Chore = "Chore: Z". |
| **Type** | Yes | `Bug` / `Feature` / `Task`. Infer from context; ask only if genuinely ambiguous. |
| **Repo** | Yes | Default to current `gh repo view` repo unless the user specifies another. |
| **Body content** | Yes | Constructed from the template below. |
| **Assignee** | No | Default to unassigned. |
| **Milestone** | No | Optional. If the repo uses milestones and context makes one obvious, suggest it; otherwise leave unset. |

## Issue Body Template

Use this template, adapted by issue type. Skip sections that don't apply, but keep the structure consistent so engineers know where to look.

```markdown
## Context

<1-3 sentences: what is the user-facing situation today? Who hits this? What triggered this issue?>

## Problem / Goal

<For a bug: what's broken, what should happen instead.>
<For a feature: what user need does this address, what does success look like.>
<For a chore: what state is the codebase in, what state do we want.>

## Proposed Approach

<Optional but recommended. Sketch the change at a high level. Don't prescribe implementation if you don't know the codebase well — leave room for the engineer.>

## Acceptance Criteria

- [ ] <Concrete, verifiable criterion 1>
- [ ] <Concrete, verifiable criterion 2>
- [ ] <Concrete, verifiable criterion 3>

## Out of Scope

<Anything explicitly NOT in this issue. Prevents scope creep at PR time.>

## References

- Related issues: #...
- Related PRs: #...
- Related files / docs: ...
```

### Bug-Specific Additions

For bugs, include between **Problem** and **Acceptance Criteria**:

```markdown
## Reproduction

1. <Step 1>
2. <Step 2>
3. <Observed result>
4. <Expected result>

## Environment

- Branch / commit: <SHA or branch>
- Browser / OS: <if UI bug>
- Version: <app or library version, if relevant>

## Logs / Errors

<paste relevant log output, error messages, or screenshots>
```

### Feature-Specific Additions

For features, include after **Proposed Approach**:

```markdown
## User Story

As a <persona>,
I want to <action>,
So that <outcome>.
```

## Labeling (Optional)

If the repo uses labels, apply the most fitting ones:

```bash
gh label list   # see what labels exist in the repo
```

Pick labels that match — common conventions include `bug`, `enhancement`, `good first issue`, `needs-triage`, priority tags (`P0`/`P1`/`P2`), or area tags (`api`, `ui`, `docs`). If the repo has no labels or none fit, skip labeling entirely. Never invent labels that don't exist in the repo.

## Workflow

1. **Gather inputs** — title, type, body content. Ask one focused question if anything critical is missing.

2. **Check for duplicates** — search existing issues first:
   ```bash
   gh issue list --search "<keywords>" --state all
   ```
   If a duplicate exists, link to it rather than creating a new one.

3. **Draft the body** — use the template above, filled with concrete content. Acceptance criteria must be verifiable. No hand-waving.

4. **Check labels (optional)** — run `gh label list` to see what labels exist; pick the most fitting ones or skip if none fit.

5. **Show the user the draft** — output the title, labels (if any), and full body in a markdown block. Ask for confirmation before creating.

6. **Create the issue** via `gh`:
   ```bash
   # Without labels:
   gh issue create \
     --title "Fix: skill content truncated on import" \
     --body "$(cat <<'EOF'
   ## Context
   ...
   EOF
   )"

   # With labels:
   gh issue create \
     --title "Fix: skill content truncated on import" \
     --label "bug,P0" \
     --body "$(cat <<'EOF'
   ## Context
   ...
   EOF
   )"

   # With milestone (if applicable):
   gh issue create \
     --title "Add: Slack notification on execution completion" \
     --label "enhancement" \
     --milestone "v2.0" \
     --body "$(cat <<'EOF'
   ## Context
   ...
   EOF
   )"
   ```

7. **Report back** — return the issue URL and number to the user.

## Quick Reference: Issue Types

| Type | Title prefix | Required body sections |
|------|--------------|------------------------|
| Bug | `Fix: ...` | Context, Reproduction, Environment, Acceptance Criteria, References |
| Feature | `Add: ...` | Context, User Story, Goal, Proposed Approach, Acceptance Criteria, Out of Scope |
| Chore | `Chore: ...` | Context, Goal, Acceptance Criteria |
| Spike | `Spike: ...` | Context, Question, Investigation Plan, Definition of Done |
| Docs | `Docs: ...` | Context, What's missing, Acceptance Criteria |
| Refactor | `Refactor: ...` | Context, Goal, Acceptance Criteria |

## Anti-Patterns to Avoid

- **Don't create duplicates** — always search with `gh issue list --search "<keywords>"` before creating
- **Don't invent labels** — only use labels that already exist in the repo (`gh label list`); if none fit, skip labeling
- **Don't write vague acceptance criteria** — "make it better" is not testable. "Reduce p99 latency below 200ms" is.
- **Don't bypass the user** — always show the draft and get confirmation before creating; issues are public artifacts
- **Don't skip context** — a good issue explains *why* it matters, not just *what* to do

## Examples

### Example 1: Bug report

User input: *"The skill content gets truncated when I import from GitHub"*

Output draft:

```
Title: Fix: skill content truncated on GitHub import
Labels: bug

## Context
Users importing skills from GitHub see the SKILL.md content truncated,
losing instructions and examples beyond a certain file size.

## Reproduction
1. Trigger the import flow pointing at a repo containing a SKILL.md > 4KB
2. Observe that content is cut off after the threshold
3. Expected: full content imported

## Environment
- Branch: main
- Affects: all users of the import feature

## Acceptance Criteria
- [ ] Skills > 4KB import without truncation
- [ ] Test added covering a large-file import scenario
- [ ] No regression in existing import tests

## References
- Reported by: <user>
```

### Example 2: Feature request

User input: *"We should add a Slack notification when an execution finishes"*

Output draft:

```
Title: Add: Slack notification on execution completion
Labels: enhancement

## Context
Engineers running task executions currently have to poll the dashboard
to know when an agent finishes. Push notifications in Slack would reduce
the feedback-loop delay.

## User Story
As an engineer running task executions,
I want to receive a Slack message when my execution completes,
So that I can review the result without polling the dashboard.

## Proposed Approach
Add an outbound webhook adapter in the execution callback handler. When an
execution finishes, POST a formatted message to a configured Slack incoming
webhook URL. Configuration lives at the org level (one webhook per org for v1).

## Acceptance Criteria
- [ ] Users can configure a Slack incoming webhook URL in settings
- [ ] On execution completion, a message is POSTed including: job name, status,
      duration, and link to the result
- [ ] Delivery failures are logged but do not block the execution callback
- [ ] Test coverage using a mock webhook receiver

## Out of Scope
- Per-user notification routing (v2)
- Teams / Discord integration (separate issues)
```

## Related Skills

- **`stack-planning`** — when an issue needs to be broken down into stories with stack-layer subtasks

---
**Built by [aictrl.dev](https://aictrl.dev/?utm_source=oss-skills&utm_medium=skill&utm_campaign=create-issue).** This skill teaches the workflow; aictrl *operationalizes* it — grounded in your backlog, team standards, and codebase knowledge graph. [See how →](https://aictrl.dev/features?utm_source=oss-skills&utm_medium=skill&utm_campaign=create-issue)
