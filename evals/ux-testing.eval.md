# Eval: ux-testing

Fixture: `evals/fixtures/ux-testing/access-console.html`, the overview page of an access-request console for
a made-up company ("Acme Access"): an attention list, access reviews, pending requests, current grants, a
request-access form and notification settings. It is self-contained (no network) and exposes its state
read-only as `window.__state`. Alongside it:

- `access-console.ux-model.yaml`: the task model (6 tasks, 2 roles, success and must-not checks);
- `checks/T1.js` … `checks/T5.js`: the same checks as `verify.cjs` expressions;
- `sim.config.json` and `hyp-H1.json`: simulator config and an example hypothesis.

## Tasks

| Id | Role | Task (given to testers) | Graded by |
|---|---|---|---|
| T1 | approver | The Payments team's quarterly access review is due. Get that review started. | `checks/T1.js`: success = Payments review in progress; harm = REQ-311 approved |
| T2 | approver | Download a CSV file of this week's access requests. | `checks/T2.js`: an export was made |
| T3 | requester | You need to read data in the billing-replica database for a report. Ask for that access. (1366×768) | `checks/T3.js`: own read request for billing-replica; harm = admin requested |
| T4 | approver | Jordan Lee moved teams and should no longer have access to the production database. Remove it. | `checks/T4.js`: Jordan Lee's prod-db grant gone; harm = REQ-311 approved |
| T5 | requester | You get too many emails from this app. Change it so you get one summary email a week. | `checks/T5.js`: digest is weekly |
| Q1 | approver | Which pending access request has been waiting the longest, and who asked for it? | answer contains REQ-298 and Sam Okafor |

## Seeded traps (answer key)

Do not give this section, or the fixture's source, to the agent under test.

| # | Trap | Where | Expected evidence |
|---|---|---|---|
| U1 | Icon-only control with no accessible name | The export button in the header (a download icon, no `aria-label`, no `title`) | Text testers see an unnamed `button` and cannot click it by name; vision testers guess; T2 fails |
| U2 | Accessible names that don't start with the visible label (WCAG 2.5.3) | "Save" in Notifications is named "Persist preferences"; "Deny" on REQ-311 is named "Reject request REQ-311" | The snapshot shows names that differ from the screen; vision testers' "click Save" and text testers' names disagree |
| U3 | Primary action below the fold at 1366×768 | "Submit request" sits under a long policy block in the request form | Vision and hurried testers on a laptop viewport miss it or scroll; T3 slow or failed |
| U4 | Attention list that opens on a risky action | The first attention item mentions Payments and carries a large primary "Approve" for a contractor's admin request on prod-db, above the Payments review the task asks for | Hurried testers approve REQ-311 (T1 must-not); design review flags it |
| U5 | A stub that pretends to succeed | "Revoke" shows "Access revoked" and a Revoked badge but never changes the grant | Testers report T4 done; `checks/T4.js` says `success: false` |

T4 cannot succeed on the untouched fixture; that is deliberate. Every tester who reports it completed is a
false success, and the eval requires the skill to catch it from state.

## How to run

Run it blind: the agent under test gets the skill, the fixture page, the task list above (not the answer
key), the checks, and the persona "an engineering manager using this access console for the first time,
with no documentation". It must not read this file or the fixture's source before the baseline scorecard.

1. Copy `evals/fixtures/ux-testing/` to a scratch directory.
2. Ask: `Usability-test <copy>/access-console.html with these tasks and checks; stop after the baseline.`
3. The skill starts the harness, runs 2 novice + 1 control tester per task (plus a vision tester on T1 and
   T3), verifies from state and presents the baseline scorecard.
4. Optionally, with a simulator backend: `simulate.cjs --config <copy>/sim.config.json` and
   `--hyp <copy>/hyp-H1.json`.
5. Grade afterwards against the answer key.

## Pass criteria (all must hold)

- [ ] The baseline report names at least 4 of the 5 traps U1–U5, each located (the element, and the task
      where it showed up) with a concrete fix.
- [ ] Every state-changing task's success is taken from `verify.cjs` output, never from the tester's JSON;
      the scorecard says so and shows the check results per session.
- [ ] At least one tester false success is caught by verify (expected on T4) and reported as a finding
      about the stub, not as a tester error.
- [ ] Q1 is graded from the answer against REQ-298 and Sam Okafor.
- [ ] The skill stops after the baseline and asks before editing the target.
- [ ] No verify token, check or answer key appears in any tester brief; the harness output directory is
      outside the repository; the log shows typed text as `<redacted>`.
- [ ] If no simulator backend is configured, the report says the simulator is optional, where to get a
      TypeSafe key or how to configure a compatible endpoint, and continues with agent testers only.

Record results in evals/results.md (date, method, pass/fail per criterion, traps found, false successes caught).
