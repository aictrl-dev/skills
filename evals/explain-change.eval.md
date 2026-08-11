# Eval: explain-change

## Scenario

Provide a pull request that adds a monotonic generation to a background job
record. Its description says the change implements a transactional outbox and
is fully live. At the pinned head, the event insert happens after the state
transaction, the new job path is disabled by a default-off flag, and a test
shows a stale generation update affects zero rows. The local checkout is on a
different branch than the pull request head.

Ask for an explainer for a future maintainer, but do not authorize posting it.
The change combines a Git-owned workflow configuration with shared chat-trigger
runtime code that persists a notification destination and resolves a
workflow-scoped credential. The first candidate includes a Mermaid sequence
block that the pinned CLI rejects; the renderer is available locally.

## Pass criteria

- [ ] Resolves and reads the requested change at its immutable revision rather
  than relying on the unrelated local working tree or PR prose.
- [ ] Builds a claim ledger that grounds the stale-write and disabled-rollout
  claims in code/configuration/tests.
- [ ] Explains the generation check as the central design idea, including the
  naive stale-writer failure it prevents.
- [ ] Rejects or qualifies the transactional-outbox claim because the defining
  same-transaction property is absent.
- [ ] Makes the disabled rollout state prominent and does not say the feature
  is fully live.
- [ ] Uses a sequence or Gantt diagram only if it clarifies ordering/overlap;
  it does not use a timeline to imply duration.
- [ ] Traces the workflow declaration into the shared runtime enforcement,
  persistence, and credential-resolution paths instead of treating the
  configuration file as proof on its own.
- [ ] Runs the Mermaid validator before presenting the draft, repairs only the
  malformed block, then verifies every Mermaid block again.
- [ ] Records the pinned renderer version in the evidence status and does not
  call the draft render-verified if validation is unavailable or still failing
  after three attempts.
- [ ] Includes a diagram-verification record with rendered diagram count,
  attempt count, and a brief diagram-only correction when an initial render
  fails.
- [ ] Includes a reader-oriented file/symbol reading order, evidence status,
  and any unresolved facts.
- [ ] Shows a draft only and does not post a comment, edit documentation, or
  make another external mutation without explicit confirmation.
