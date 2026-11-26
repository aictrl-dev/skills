# measurement-plan

A free, MIT-licensed agent skill for deciding how to measure a feature before it ships. Give it a feature brief and it uses Goal–Question–Metric to turn the decision your team needs to make into measurable questions, metric definitions, and a tracking plan.

## Try it in Claude Code

```sh
npx skills add aictrl-dev/skills --skill measurement-plan -a claude-code
```

Open your project in Claude Code and try this prompt. The skill drafts the whole plan in one pass and asks only about missing product context that would change it.

```text
/measurement-plan We're simplifying onboarding to help new users complete their first successful workflow run. Measure success within seven days of signup and watch for first-run failures.
```

## Example plan for onboarding

In this illustrative example, the team wants more new users to complete a workflow within seven days while keeping first runs reliable.

| Question | Metric | Definition |
| --- | --- | --- |
| Do more new users complete a workflow? | Seven-day activation rate | Users with at least one successful run within seven days of signup divided by all signups with a full seven days of observation. |
| How often does the first attempt fail? | First-run failure rate | Among users in that cohort who start a workflow within seven days, failed first runs divided by first runs with a recorded terminal outcome. |

Join signups to workflow starts by user ID, then match each start to its terminal outcome by run ID. Use the start timestamp to identify the first attempt. A later success within seven days counts toward activation. The first attempt supplies the reliability guardrail.

## What you get

The skill drafts `docs/measurement-plans/<feature-name>.md`, or returns the plan inline in a read-only workspace. The plan states the goal and the decision it informs, the learning objectives, metric definitions grounded in your existing data, the smallest instrumentation or pipeline changes that close the gaps, and checks for validating the data.

For a full walkthrough of the template, read [Feature measurement plan template for product teams](https://aictrl.dev/blog/feature-measurement-plan-template?utm_source=github&utm_medium=referral&utm_campaign=skills&utm_content=2026-11-26-skills-measurement-plan-readme).

[Read the skill instructions](SKILL.md) · [Browse all skills](../../README.md) · [MIT license](../../LICENSE)
