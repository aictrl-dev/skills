---
name: measurement-plan
description: Create a measurement plan for a feature — defines learning objectives, metrics, and implementation (product analytics events, warehouse tables, event pipeline). Use when user says 'measurement plan', 'how do we measure this', 'what metrics for this feature', 'tracking plan', 'analytics requirements', 'how do we know if this works', 'define KPIs for', or when planning a new feature and analytics instrumentation is needed.
---

# Measurement Plan

Create a structured measurement plan that connects business questions to metrics to implementation. The plan flows top-down:

```
Learning Objectives (questions/hypotheses)
    ↓
Metrics & Definitions (what to measure, linked to questions)
    ↓
Implementation Plan
    ├── Product-analytics events (e.g. PostHog, Amplitude, Mixpanel)
    ├── Warehouse / fact tables (e.g. BigQuery, Snowflake, Postgres)
    └── Event pipeline (e.g. Pub/Sub, Kafka, Segment)
```

## Process

### Phase 1: Learning Objectives

Before defining any metrics, establish what you need to learn. There are two categories:

**Feature Impact** — Does this feature achieve its goal?
- Frame as hypotheses: "We believe that [change] will result in [outcome] for [audience]"
- Or as questions: "How does X affect Y?"
- These are specific to the feature being built

**Business Performance** — How does this affect the broader business?
- Upstream/downstream effects on key business metrics
- Revenue, retention, adoption, engagement implications
- Guard-rail metrics: things that should NOT get worse

Ask the user:

1. **What is the feature?** Brief description of what's being built.
2. **What problem does it solve?** The user need or business case.
3. **How will you know it worked?** What would success look like in 30/60/90 days?
4. **What could go wrong?** Negative outcomes to watch for (guard-rail metrics).

Then draft 3-6 learning objectives. Format:

```markdown
## Learning Objectives

### Feature Impact
- **Q1**: Does [feature] increase [desired outcome]?
  - Hypothesis: [feature] will increase [metric] by [X]% within [timeframe]
- **Q2**: Which user segment benefits most from [feature]?
- **Q3**: What is the adoption curve — how quickly do users discover and use [feature]?

### Business Performance
- **Q4**: Does [feature] affect overall [business metric]? (e.g., retention, revenue)
- **Q5**: Guard rail — does [feature] negatively impact [adjacent metric]?
```

Get user approval before proceeding.

### Phase 2: Metrics & Definitions

For each learning objective, define the metric(s) that answer it. Every metric needs:

| Field | Description |
|-------|-------------|
| **ID** | M1, M2, M3... |
| **Name** | Human-readable name |
| **Definition** | Precise calculation (numerator/denominator for rates, aggregation for counts) |
| **Answers** | Which learning objective(s) this addresses (Q1, Q2...) |
| **Type** | `counter`, `rate`, `duration`, `ratio`, `funnel` |
| **Granularity** | How often to compute (daily, weekly, per-event) |
| **Segments** | Breakdowns needed (by org, by user, by plan tier, by source) |
| **Data source** | Where the raw data comes from (your product-analytics tool / warehouse / billing system) |

Format as a table:

```markdown
## Metrics

| ID | Metric | Definition | Answers | Type | Source |
|----|--------|-----------|---------|------|--------|
| M1 | Feature adoption rate | Users who used feature / Total active users (7d) | Q1, Q3 | rate | product analytics |
| M2 | Time to first use | Median days from account creation to first feature use | Q3 | duration | warehouse |
| M3 | Completion rate | Successful completions / Total attempts | Q1 | rate | warehouse |
| M4 | Revenue per user (guard rail) | MRR / Active users, pre vs post launch | Q5 | ratio | billing system + product analytics |
```

Validate:
- Every learning objective (Q) has at least one metric (M)
- Every metric links to at least one question
- No orphan metrics (metrics without a question are waste)
- Guard-rail metrics are included

### Phase 3: Implementation Plan

For each metric, define the data collection needed. Three layers:

#### 3a. Product-Analytics Events (frontend/product analytics)

For user-facing interactions and product analytics. Tools like PostHog, Amplitude, or Mixpanel are the right choice when:
- Tracking UI interactions (clicks, page views, form submissions)
- Measuring user journeys and funnels
- A/B test variant assignment and conversion
- Session-level analysis

Format:

```markdown
### Product-Analytics Events

| Event Name | Trigger | Properties | Metric |
|------------|---------|------------|--------|
| `feature_viewed` | User opens the feature page | `org_id`, `user_id`, `source` (sidebar/link/search) | M1, M3 |
| `feature_action_completed` | User completes the core action | `org_id`, `user_id`, `duration_ms`, `result` | M3 |
| `feature_error_shown` | Error state displayed | `org_id`, `error_type`, `step` | M3 |
```

Naming convention: `snake_case`, `object_action` pattern. Follow your tool's own conventions for past vs. present tense.

#### 3b. Warehouse / Fact Table Changes (backend analytics)

For server-side events that need durable, queryable history. Use when:
- The event happens on the server (not the browser)
- You need immutable event history rather than mutable application state
- Cross-referencing with other fact tables
- The data feeds dashboards or scheduled reports

Name fact tables by domain (e.g. `execution_lifecycle`, `payment_events`). Determine:
- **Existing table?** → Add a new `event_type` value (backward-compatible, no schema migration needed if you use a loose schema; coordinate with your data team if the table is strict)
- **New table?** → Define schema + ingestion pipeline for your warehouse (Snowflake stage, BigQuery subscription, Postgres ETL job, etc.)

Format:

```markdown
### Warehouse Changes

#### Additions to existing tables
- Add `event_type: 'execution.retried'` to `execution_lifecycle` table
  - New fields needed: `retry_count INT64`, `retry_reason STRING`

#### New table (if needed)
- Table: `{domain}_lifecycle` (name it by domain, not by tool or team)
- Schema: define alongside your event pipeline setup
```

Link each change to the metric it supports.

#### 3c. Event Pipeline Changes

Derived from the warehouse changes above. For each new or modified fact table, document the pipeline event that feeds it:

```markdown
### Event Pipeline

| Event Type | Stream/Topic | New/Existing | Fields | Metric |
|------------|-------------|-------------|--------|--------|
| `execution.retried` | execution-lifecycle | New event type on existing stream | `retry_count`, `retry_reason` | M3 |
```

For new streams or topics, follow your pipeline tool's setup process (e.g. create a Kafka topic + consumer, a Pub/Sub subscription, or a Segment source).

### Phase 4: Output Document

Produce the measurement plan as a markdown file at `docs/measurement-plans/{feature-name}.md`:

```markdown
# Measurement Plan: {Feature Name}

**Date:** {date}
**Feature:** {brief description}
**Owner:** {who is responsible}

## 1. Learning Objectives

### Feature Impact
- **Q1**: ...
- **Q2**: ...

### Business Performance
- **Q3**: ...

## 2. Metrics

| ID | Metric | Definition | Answers | Type | Granularity | Source |
|----|--------|-----------|---------|------|-------------|--------|
| M1 | ... | ... | Q1 | rate | daily | product analytics |

## 3. Implementation

### 3a. Product-Analytics Events

| Event | Trigger | Properties | Metric |
|-------|---------|------------|--------|
| ... | ... | ... | M1 |

### 3b. Warehouse Changes

...

### 3c. Event Pipeline

| Event Type | Stream/Topic | Status | Metric |
|------------|-------------|--------|--------|
| ... | ... | New | M1 |

## 4. Validation

### How to verify instrumentation
- [ ] Product analytics: events visible in your tool's live-event stream within 24h of deploy
- [ ] Warehouse: verify rows land in your fact table within 24h (query your table for recent rows)
- [ ] Dashboard: metrics rendering correctly in your reporting tool

### Review cadence
- Week 1 post-launch: verify data flowing, fix instrumentation gaps
- Week 4: first metrics review against hypotheses
- Week 12: formal impact assessment
```

## Key Principles

**Start with questions, not data.** If you can't articulate what you'll learn from a metric, don't track it. Every event must trace back to a learning objective.

**Minimize instrumentation.** Fewer, well-defined events beat many sparse ones. Aim for 5-10 events per feature, not 50. Re-use existing events and properties where possible.

**Layer appropriately.** Product analytics for frontend interactions, event pipeline → warehouse for server-side lifecycle events. Don't duplicate — if a server event already captures what you need, don't also track it in your product-analytics tool.

**Plan for segments.** Every metric should be breakable by org, user role, and time period at minimum. Design properties to support this from day one — adding segments later requires re-instrumentation.

**DRY naming across all layers.** Tables, streams, and events are namespaced by domain. Field/property/column names must NOT repeat the entity prefix. Use `version` not `skill_version`, `role` not `user_role`. The namespace provides context. This rule applies to product-analytics event properties, warehouse columns, pipeline event keys, and any application-state fields — all must use the same lean name to avoid mismatches between layers.

---
**Built by [aictrl.dev](https://aictrl.dev/?utm_source=oss-skills&utm_medium=skill&utm_campaign=measurement-plan).** This skill teaches the workflow; aictrl *operationalizes* it — grounded in your backlog, team standards, and codebase knowledge graph. [See how →](https://aictrl.dev/features?utm_source=oss-skills&utm_medium=skill&utm_campaign=measurement-plan)
