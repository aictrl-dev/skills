---
name: measurement-plan
description: Turn a feature spec, epic, or product change into a Goal-Question-Metric (GQM) plan with decision criteria, implementation, and validation grounded in available data. Use when the user says "measurement plan", "tracking plan", "analytics requirements", "feature KPIs", "define KPIs for", "GQM", "goal question metric", "goal-question-metric", "measurement goal", "how do we measure this", "what metrics for this feature", or "how do we know if this works", or when planning data collection for a product change.
---

# Measurement Plan

Create one plan that a product manager can review and a product engineer or
coding agent can use to implement measurement. Trace the decision through the
goal, learning objectives, metrics, implementation, and validation.

## Start with the available context

1. Read the supplied or linked epic, ticket, spec, and existing measurement plan
   when accessible. Extract the change, audience, decision, expected outcome,
   timing, constraints, and exclusions. Update an existing plan when requested.
2. Inspect accessible sources relevant to the feature, such as code, database
   schemas, job records, event definitions, and existing queries or dashboards.
   Look for where the outcome occurs and what is already captured there.
3. Draft all five sections in one pass when the change and decision are clear
   enough. Label assumptions and unverified facts. Ask the user only about
   missing product context that materially affects the plan. If access is
   missing, draft from what is available and record the technical gaps for
   the engineer or agent to verify. If the change or decision cannot be
   inferred, ask a focused question first.

## 1. Goal

State what to evaluate, why, which quality matters, whose perspective matters,
and any applicable scope or time window. Name the decision the evidence will
inform, such as whether to expand, revise, or retire a change.

GQM form: Analyze **[object]** for **[purpose]** with respect to
**[quality focus]**, from **[viewpoint]**, within **[context]**.

## 2. Learning Objectives

Give each question an ID (`Q1`, `Q2`) and connect it to the goal. Include a
guardrail when the change could harm an adjacent outcome. Capture the baseline,
success criteria, and trade-offs the team has agreed to. Mark unknown baselines
or decision thresholds as open. Label each suggested target as a proposal for
review. Use the feature's timing and scope.

## 3. Metrics

Assign each metric an ID (`M1`, `M2`) and link it to the questions it answers.
Each definition should be precise enough to reproduce. Specify the population,
unit of analysis, calculation (including numerator and denominator for rates),
observation window, and any breakdowns required for the decision. Spell out
status, retry, deduplication, or incomplete-window handling where it affects the
result. Keep the stated eligibility and success criteria in the primary
definition. Flag alternative definitions for review.

| ID | Metric | Answers | Population and calculation | Window and breakdowns | Source and evidence |
|----|--------|---------|----------------------------|-----------------------|---------------------|
| M1 | … | Q1 | … | … | … |

Choose the source that directly records the fact being measured. A click can
measure intent. A durable job record can measure a backend outcome. Cite the
relevant schema, code path, event definition, or query when available. Mark a
source as proposed or unverified when its existence, meaning, or coverage is
uncertain. For comparisons that depend on rollout or experiment groups, verify
the unit, where assignment or exposure is recorded, and when the record becomes
available. State what history can support and what needs future collection.

## 4. Implementation

For each metric, identify the source or query to reuse and any specific gap.
Propose the smallest change that closes it, including zero instrumentation
changes when existing data suffices. Make proposed changes conditional on
checking any unverified sources. Keep optional diagnostics and their extra
collection separate from the work needed for the decision. Follow the project's
conventions and use application or backend records, product events, warehouse
models, and pipelines where each contributes to a metric.

For each proposed change, link its metric IDs and give the affected component
when known, the trigger or state transition, and the fields and identifiers
needed to calculate or join the metric. Include required aggregation or
pipeline work and ownership when relevant. Label unresolved implementation
details and explain what evidence will settle them.

## 5. Validation

Define runnable checks for key metrics before release. Include a typical
outcome and a relevant failure or boundary case, with the expected result of
each check. Specify how to verify the live data after release, including
expected coverage, freshness, or reconciliation against the authoritative
source as applicable.

For completeness checks, compare with an independent count of what should
have been recorded when available. Set the decision review for when the
required observation window, sample, or business cycle is complete. Identify
the reviewer when known.

## Deliver the plan

Use the five numbered sections, from Goal through Validation, as the plan
headings. Put the decision and open product questions near the top so the PM
can review them without digging through the implementation details. Save the plan to
`docs/measurement-plans/{feature-name}.md` by default when the workspace is
writable, or return it inline in a read-only or chat-only workflow. Use the
plan as the handoff for a separate implementation task.

---
**Built by [aictrl.dev](https://aictrl.dev/?utm_source=oss-skills&utm_medium=skill&utm_campaign=measurement-plan&utm_listing=github-skills&utm_platform=portable&utm_skill=measurement-plan).** This skill teaches the workflow; aictrl *operationalizes* it — grounded in your backlog, team standards, and codebase knowledge graph. [See how →](https://aictrl.dev/features?utm_source=oss-skills&utm_medium=skill&utm_campaign=measurement-plan&utm_listing=github-skills&utm_platform=portable&utm_skill=measurement-plan)
