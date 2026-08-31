# Create-workflow evaluation tasks

## Shared fixture catalog

The evaluation organization provides exactly these skill references:

- `implement-code-change@1.0.0`
- `code-review@1.4.0`
- `create-issue@1.0.0`
- `apply-fixes@2.0.0`

Use only those skills. Their references are resolvable in this fixture
organization. All five tasks require a direct
`.aictrl/workflows/<kebab-name>.yaml` file using
`schemaVersion: aictrl/workflow/v2`. Do not publish, start, commit, push,
merge, or deploy anything.

## CW1 — Implement a planned issue

Create a workflow for a repository and GitHub issue number. It must run the
pinned implementation skill, surface a pull-request URL and test result, and
pause for human review before any downstream merge action. Deployment is not
part of the workflow.

Expected shape:

- workflow and inline task both declare typed `repository` and `issue-id`
  parameters with explicit input mappings;
- one `task` node uses `implement-code-change@1.0.0` with `taskType: general`;
- the task declares `pullRequestUrl` and `testResult` outputs;
- a manual quality gate follows the implementation wave;
- no deploy, merge, workflow publish, or implicit Git mutation node exists.

Reference shape: `expected/implement-issue.yaml`.

## CW2 — Repair a confirmed regression

Create a workflow for a repository and a confirmed GitHub bug issue. The task
must require a reproduction and a regression test before proposing the smallest
safe fix. A human must review the reproduction and test evidence before a
potential merge; the workflow must not deploy.

Expected shape:

- typed `repository` and `issue-id` inputs are mapped into a pinned
  `implement-code-change@1.0.0` task;
- the task prompt explicitly requires reproduce → regression test → minimal
  fix, and declares evidence outputs;
- a manual quality gate follows the task;
- no invented `fix-bug` dependency, deploy, or merge node exists.

Reference shape: `expected/fix-regression.yaml`.

## CW3 — Review a pull request and create a tracking issue only for severe findings

Create a pull-request workflow that runs the pinned code review skill and
creates a tracking issue only when the review reports a high or critical finding
(rank above `2`). A human must see the review before triage runs.

Expected shape:

- typed `pr-url` input is mapped into `code-review@1.4.0` with
  `taskType: code-review`;
- the review declares `findings` and `maxSeverityRank` outputs;
- a downstream `create-issue@1.0.0` task receives review findings and is
  guarded by `review.output.maxSeverityRank > 2`;
- graph edges order review before triage and a manual gate follows review;
- no issue is created for lower-severity findings.

Reference shape: `expected/review-and-triage.yaml`.

## CW4 — Bound a review/fix convergence loop

Create a pull-request workflow that reviews a PR, applies fixes only when high
or critical findings remain, and stops after at most three passes. It must fail
when it cannot converge and must require human review before a hypothetical
merge; no merge or deploy action belongs in the file.

Expected shape:

- a `loop` has `maxIterations: 3`, a terminating `until` condition, and
  `onMaxIterations: fail`;
- its body runs pinned `code-review@1.4.0` and `apply-fixes@2.0.0` tasks;
- the fix consumes declared review findings and is conditional on rank above
  `2`;
- the body graph orders review before fix, and a manual quality gate follows
  the loop;
- no unbounded loop, deploy, or implicit merge action exists.

Reference shape: `expected/review-fix-loop.yaml`.

## CW5 — Run a review from an authorized pull-request comment

Create a workflow that begins only when an authorized collaborator comments
`/review` on a pull request. The trigger must provide the pull-request URL to a
pinned review task. The workflow only reviews and returns findings; it must not
post, merge, deploy, or start another workflow.

Expected shape:

- exactly one file-declared `comment` trigger has `on: pull-request`,
  `command: /review`, and a JSONPath mapping for the typed `pr-url` parameter;
- a pinned `code-review@1.4.0` task declares findings output and consumes
  `pr-url` from the workflow input;
- the configuration relies on the platform's collaborator authorization for
  comment triggers and does not add a fake token or webhook secret field;
- no external side-effect node is present.

Reference shape: `expected/comment-triggered-review.yaml`.
