---
name: create-pr
description: Draft or improve a reviewer-ready pull request title and body from an exact revision, linked issue or specification, implementation context, and verification evidence. Use when the user says "create a PR", "draft a PR", "write the PR body", "improve this pull request description", or "update the PR title and body".
---

# Create a Pull Request

Write a concise pull request that lets reviewers distinguish intended behavior
from verified facts. This skill drafts the title and body; it does not create a
branch, commit, request review, merge, deploy, or mutate a pull request without
the user's confirmation immediately before that action.

## Ground the draft

1. Resolve the repository, target base, and immutable head revision. For an
   existing PR, read its stored title/body and confirm that its head is the
   revision being described.
2. Read repository contribution guidance, the exact diff, linked issue or
   specification when present, relevant surrounding code, and relevant tests.
   Do not rely on an unrelated local working tree or authored PR text as proof.
3. Build a compact evidence ledger before drafting. Classify each material
   statement by its strongest source:

   | Claim | Evidence | Evidence kind | Status |
   |---|---|---|---|
   | `<behavior>` | `<pinned file/symbol or diff>` | implementation | verified |
   | `<coverage intent>` | `<test path/name>` | test source | verified coverage source |
   | `<check result>` | `<command output or pinned CI run>` | executed verification | verified |
   | `<rollout state>` | `<runtime/deployment record>` | deployed state | verified |

   Treat authored descriptions as claims to check, test source as evidence of
   coverage intent rather than a passing result, configuration as intended
   setup rather than deployed state, and missing evidence as unknown. Do not
   infer a rollout, test result, benchmark, or user impact from the diff alone.
4. Identify the reviewer-relevant narrative: problem, observable behavior,
   direct or indirect user impact, important boundaries/non-goals, rollout,
   risks, and evidence. Preserve accurate issue links, required metadata, and
   useful operational details from an existing body; remove stale claims and
   duplication.

## Draft

Use the repository's established title convention when one exists (such as
`feat:`, `fix:`, `docs:`, or `chore:`). Make the title name the primary
observable change, not the files changed. Keep it to one concern.

Use this body shape, omitting a section only when it is genuinely inapplicable:

```markdown
Closes #<issue>

## Problem

<Why this change is needed.>

## Behavior

<What changes for users, operators, API consumers, or downstream systems. Say
"No direct user-facing impact" when accurate, then name the indirect impact.>

## Scope

- <Important implementation or contract detail>
- <Deliberate boundary or non-goal>

## Rollout and risks

<Only verified deployment, compatibility, migration, flag, monitoring, and
rollback facts. State an unknown rollout state or remaining risk explicitly.>

## Verification

- `<executed command or pinned CI run>` — <observed result>
- `<test source>` — <coverage it defines; not a claimed result>
```

If no issue is linked, omit the closing keyword and start with `No linked
issue.` Do not mark a checklist item complete or say a test is green without
executed evidence. Prefer durable file, symbol, test, configuration, run, or
revision references where they help review; avoid file-by-file narration and
implementation history that does not affect review or rollback.

## Confirm before mutation

Show the title, body, pinned head revision, and any unknown or unverified
claims. For a proposal or wording review, stop there.

Create or edit the host pull request only after the user explicitly confirms
the final draft immediately before the mutation. Then read the saved title and
body back from the host, verify the issue link and required headings remain
intact, and report the URL and exact head revision. If the head changed, repeat
the grounding and drafting steps before asking for confirmation again.

## Final check

- [ ] The title describes one observable primary change.
- [ ] Every behavior, scope, rollout, risk, and verification claim has a
  classified evidence source or is marked unknown.
- [ ] Authored claims, test sources, configuration, executed verification, and
  deployed state are not conflated.
- [ ] The body names the problem, behavior, scope, rollout and risks, and
  verification without overstatement.
- [ ] No PR mutation occurs without fresh, explicit confirmation.

---
**Built by [aictrl.dev](https://aictrl.dev/?utm_source=oss-skills&utm_medium=skill&utm_campaign=create-pr&utm_listing=github-skills&utm_platform=portable&utm_skill=create-pr).** This skill teaches the workflow; aictrl *operationalizes* it — grounded in your backlog, team standards, and codebase knowledge graph. [See how →](https://aictrl.dev/features?utm_source=oss-skills&utm_medium=skill&utm_campaign=create-pr&utm_listing=github-skills&utm_platform=portable&utm_skill=create-pr)
