# ChatGPT web reviewer rehearsal — 2026-07-22

**Status:** PASS — 5/5 positive and 3/3 negative cases on ChatGPT web.

This is the durable product record for the OpenAI portal reviewer rehearsal run
on 2026-07-22. It records the production setup, observable results, safety
bounds, and exact steps required to reproduce the run. Mobile verification is
out of scope for this record and remains a separate submission-readiness item.

## Scope and environment

- Surface: ChatGPT Work on the web in Google Chrome on Linux.
- Plugin: the submitted `Aictrl.dev` plugin in Developer Mode.
- MCP endpoint: `https://aictrl.dev/mcp`.
- Authentication: the dedicated no-MFA reviewer account, with credentials kept
  outside Git and supplied directly in the OpenAI portal.
- Authorization boundary: the account was a member of only the private
  `Plugin Reviewer` organization.
- Fixture repository:
  [`aictrl-dev/aictrl-plugin-reviewer-fixture`](https://github.com/aictrl-dev/aictrl-plugin-reviewer-fixture).
- Protected fixture revision:
  [`d2c064af2bf93491fbbc3dca18105faddaaa89c7`](https://github.com/aictrl-dev/aictrl-plugin-reviewer-fixture/commit/d2c064af2bf93491fbbc3dca18105faddaaa89c7).
- Fixture issue:
  [`#1`](https://github.com/aictrl-dev/aictrl-plugin-reviewer-fixture/issues/1),
  open at rehearsal time.
- Pre-existing workflow output: branch `add-normalize-label` and
  [PR #4](https://github.com/aictrl-dev/aictrl-plugin-reviewer-fixture/pull/4)
  were created by the separate 2026-07-19 OAuth-to-completion rehearsal; they
  are not output from this portal rehearsal.
- Published workflow: active repository-owned `implement-code-change`, platform
  workflow version 2.
- ChatGPT model label shown during the run: `5.6 Sol Light`.

## Safety contract

The rehearsal is allowed to perform only two bounded writes:

1. P4 resets the dedicated private fixture task to repeatable values.
2. P5 starts or reuses exactly one workflow run using the submitted stable
   idempotency key.

Never approve the P5 manual gate. The run may inspect the issue and prepare a
plan before the gate, but it must not create a branch, change code, push a
commit, open a pull request, merge, deploy, change repository settings, or edit
workflow policy during this rehearsal.

Do not use a production backlog or repository. Do not record the reviewer
password, OAuth authorization code, access token, refresh token, browser
session, GitHub installation token, or recovery material.

## Preconditions

Before each rehearsal:

1. Confirm the production MCP endpoint is reachable.
2. Confirm fixture issue #1 is open.
3. Confirm protected `main` is the revision recorded in
   `reviewer-fixture.md` or a reviewed successor, and update that record if it
   has advanced.
4. Confirm the fixture repository remains connected to the `Plugin Reviewer`
   organization in automatic sync mode.
5. Confirm `implement-code-change` is active and repository-owned.
6. Confirm the reviewer account can access only the intended organization and
   repository.
7. Confirm the private epic `Publishing OpenAI Codex Plugin` and the dedicated
   task `OpenAI plugin reviewer fixture task` exist.
8. Confirm the stable P5 idempotency key resolves to no more than one run.

If the idempotent run already exists, reuse is the expected result. Do not
delete it or improvise a new key during a portal rehearsal. A new key requires
a deliberate fixture-version change and a matching update to the submitted
test case.

## Connect the reviewer identity

Use the submitted plugin itself; do not create a duplicate plugin definition.

1. Open `https://chatgpt.com/?surface=work`.
2. Open **Settings → Plugins → Aictrl.dev**.
3. Open the plugin's overflow menu and select **Reconnect**.
4. On the AICtrl OAuth page, sign in with the dedicated reviewer email and
   password supplied in the portal.
5. Do not save the password in the browser.
6. Confirm ChatGPT reports `Aictrl.dev is now connected`.
7. Start a new Work chat, choose **Plugins**, and attach `Aictrl.dev`.

As an authorization control, P1 must return exactly the reviewer organization.
If it returns a personal or production organization, stop: the browser is using
the wrong AICtrl OAuth identity. Reconnect before continuing.

## Run the cases

Use the exact prompts in [`test-cases.md`](./test-cases.md), in order P1–P5 and
then N1–N3. Use a fresh chat for every case and explicitly attach `Aictrl.dev`
before sending the prompt, including the negative cases.

For every case, record:

- the exact prompt;
- the visible ChatGPT tool-activity trace, if any;
- the final response;
- the run or entity identifiers returned;
- pass or fail against `test-cases.md`;
- a screenshot after the response reaches a stable state.

ChatGPT presents human-readable activity labels rather than raw MCP method names
in the final transcript. Validate the returned data or mutation against the
declared tool sequence in `test-cases.md`; do not claim that the UI exposed a
raw method name when it did not.

### Positive-case assertions

| Case | Required assertion |
|---|---|
| P1 | Exactly `Plugin Reviewer` is visible; `implement-code-change` is active and owned by it. |
| P2 | The result is `.aictrl/workflows/implement-code-change.yaml`; no data changes. |
| P3 | The active epic and `OpenAI plugin reviewer fixture task` are returned; no other organization's backlog appears. |
| P4 | Only the fixture task becomes a `draft`, low-complexity `story` tagged `openai-review-fixture`; title and description remain unchanged. |
| P5 | One run is started or reused with `openai-plugin-review-fixture-v1`; workflow bounds and current state are shown; the gate remains untouched. |

### Negative-case assertions

For N1–N3, `Aictrl.dev` remains attached in the composer, but ChatGPT must answer
without a `Worked for…` plugin-tool trace. A refusal or recommendation to use a
calendar/email connector is acceptable where relevant.

## Observed results

### Setup control

The first P1 attempt used the pre-existing demo OAuth identity. It returned four
unrelated organizations and no published workflow, so the attempt was rejected
as a setup failure. Reconnecting the same plugin with the dedicated reviewer
credentials corrected the boundary. This is evidence that the result is scoped
to the authenticated AICtrl identity rather than to the plugin installation.

### Final reviewer run

| Case | Result | Observed evidence |
|---|---|---|
| P1 | PASS | One organization: `Plugin Reviewer` (`Member`); active `implement-code-change` version 2. |
| P2 | PASS | Returned `.aictrl/workflows/implement-code-change.yaml`. |
| P3 | PASS | Returned active `Publishing OpenAI Codex Plugin` and two draft tasks, including `OpenAI plugin reviewer fixture task`. |
| P4 | PASS | Fixture task `366c277a-68ac-457d-a234-6a02f1d93a66` was reset to the requested repeatable values; title and description were preserved. |
| P5 | PASS | Run `577b3178-113f-524e-b6d3-43e92ddbf3b0` used the stable key and initially reported `queued`, `wave-0`, `0/4`, required action `none`, and `$0.00`; the gate was not approved. |
| N1 | PASS | Calendar request received a direct capability-boundary response; no AICtrl tool trace. |
| N2 | PASS | ChatGPT returned a local Python function directly; no AICtrl tool trace. |
| N3 | PASS | Email request received a direct capability-boundary response; no AICtrl tool trace. |

## Evidence handling

The run produced one stable-state screenshot per case plus expanded P1 and P5
views. Screenshots and any exported transcript must be redacted before they are
attached to a public issue or review record. Keep only the non-secret values
permitted by `reviewer-fixture.md`.

The local capture directory used for this run was
`/tmp/openai-review-validation-2026-07-22/`; it is intentionally not a durable
or shared evidence location. A reproducing operator must create a new evidence
bundle and attach its redacted output to the corresponding review record.

## Completion and cleanup

1. Confirm P4 still has the requested repeatable values.
2. Confirm the P5 idempotency key still resolves to exactly one run.
3. Confirm no manual gate was approved.
4. Compare repository state before and after the run and confirm that it did
   not create a new branch or pull request. The pre-existing
   `add-normalize-label` branch and PR #4 do not fail this check.
5. Record web and mobile results separately; do not infer mobile success from
   this web pass.
6. Leave the reviewer account connected only if the next submission step needs
   it; otherwise reconnect the browser to the operator's normal AICtrl identity.
