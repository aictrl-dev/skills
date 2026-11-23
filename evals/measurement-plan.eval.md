# Eval for measurement-plan

Run each prompt in a fresh read-only session with the skill loaded. Treat
the supplied source notes as the only available technical evidence.

## 1. Bulk editing from an epic

> Create a measurement plan from this epic. Ticket operators can change the
> status of multiple tickets in one action. We want to decide whether to expand
> it to all support teams based on how much time it saves and whether accidental
> status changes increase. The pilot covers the internal triage team. There is
> no agreed minimum time saving. You have the epic only.

- [ ] Drafts all five sections immediately and uses the stated audience,
  decision, and guardrail.
- [ ] Gives a reproducible task-time metric and identifies the evidence needed
  to calculate it. Marks the threshold and source as open or unverified.
- [ ] Keeps questions focused on unresolved product decisions and verification
  gaps. Adds no fabricated target, event, or schema.

## 2. CSV exports using existing backend state

> Create a measurement plan to decide whether to support CSV exports of up to
> 250,000 rows. During the pilot, reliability means at least 99% of export
> requests produce a file within ten minutes. The durable `export_jobs` table
> records a unique request ID, row count, submitted and finished timestamps,
> and the final status (succeeded, failed, or cancelled). Success guarantees
> the file is available. Worker retries update the same row. The browser event
> `export_clicked` records intent. All requests in the pilot are eligible and
> no experiment is planned.

- [ ] Uses the backend job table for the reliability metric and treats the
  click as intent. Defines timing, eligible requests, and how retries,
  cancellations, and requests still within the window affect the rate.
- [ ] Proposes no new event, warehouse table, pipeline, or rollout assignment
  to calculate the requested metric.
- [ ] Includes pre-release checks for timeout and retry handling and sets a
  review after requests have had time to reach the threshold window.

## 3. Invoice reconciliation and a business review cycle

> Create a measurement plan to decide when Finance can retire a manual invoice
> reconciliation check. Finance reviews this decision after two month-end
> closes. The payment ledger stores invoice IDs, settled amounts, and posting
> dates. The current reconciliation job only logs aggregate counts, and those
> counts expire after seven days. The job can access per-invoice match results
> and discrepancy reasons as it runs. Finance needs to audit the mismatches.

- [ ] Reuses the ledger and identifies the missing durable per-invoice result
  as the gap. Describes the fields, join, and metric the proposed change serves.
- [ ] Explains the limits of historical reconciliation results and includes
  pre-release match and mismatch checks, plus a live reconciliation check.
- [ ] Aligns the decision review to two month-end closes and assigns it to
  Finance. Adds no product event mandate.
