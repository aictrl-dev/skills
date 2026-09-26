---
name: ux-testing
description: Usability-test any web page or HTML prototype with AI agents acting as first-time users, then improve it in a measured loop. Tester agents drive the page through a local Playwright harness that shows them only the accessibility tree (or only screenshots, for vision testers); success is verified from page state, never from the tester's claim. Produces a baseline scorecard, stops for approval, then runs design review, fixes and a re-test into a before/after report. Optional extras are a role and task model with a weighted cost score, simulated users from a fast System One model to screen layout hypotheses, and session replays for a visual report. Use when the user says "usability-test this page", "run agent UX tests", "can a new user complete these tasks", "test this prototype with users", "simulate users on this design", or "test this UX hypothesis". For a critique without testing use design-review; for measured visual polish use ui-polish.
---

# UX testing

Measure whether a first-time user can complete real tasks in a UI, find out where they get stuck, and improve the UI with evidence. Testers are subagents that see only what a screen reader would: the page's accessibility tree. That keeps them honest about what the UI actually communicates and doubles as an accessible-name check. Vision testers see only screenshots, which catches what the tree hides: the fold, icon-only controls and visual hierarchy.

## Requirements

- **Node 18+ and Playwright with Chromium.** Install in the project with `npm i -D playwright && npx playwright install chromium`, or set `NODE_PATH` to a `node_modules` that has it. The scripts look for `playwright` or `playwright-core` next to the skill, then in the current directory.
- **Python 3** for `summarize.py` and `score.py`. A YAML task model needs PyYAML (`pip install pyyaml`) in Python and js-yaml (`npm i -D js-yaml`) for the simulator; or write the task model as JSON.
- **Subagents.** Testers run as separate agents. Use your platform's smallest fast model as the novice proxy and a stronger, mid-sized model as the control. If your agent can only run one model, run all testers on it and say so in the report.
- **Optional: a simulator backend** for simulated users (see "Simulate hypotheses" below).

`SKILL` below means the directory this file is in.

## Inputs

Ask only for what is missing.

1. **Target.** An HTML file or a URL. For a page behind sign-in, use a test account: pass `UX_SETUP=<module.cjs>` (exports `async (page, ctx) => {}` that signs in) or `UX_STORAGE_STATE=<state.json>`. Never test against real customer data.
2. **Persona.** One line on who the tester is, e.g. "a clinic manager using this booking app for the first time, with no documentation". Default: "a first-time user of this product, with no documentation".
3. **Tasks.** 4–8 outcome tasks for one flow (see `reference/tester-brief.md`). For a UI that serves several roles, or when variants will be compared, write a task model instead: roles, objectives, weighted tasks with success and must-not checks (`reference/task-model.md`).
4. **Success checks.** One per task that changes state: a JavaScript expression evaluated in the tester's page that returns a value. Either
   - over a read-only **state hook** the author adds next to the app's state in a prototype or test build (`window.__state = state; // test hook, read-only`), e.g. `(() => ({ success: window.__state.orders.some((o) => o.status === 'paid') }))()`; or
   - over **plain DOM queries**, e.g. `(() => ({ success: !!document.querySelector('[data-order-status="paid"]') }))()`.

   For an app with a backend you can also check the API or database from your own shell. Question tasks ("which order is late?") are graded from the tester's answer.

## Workflow

### 1. Start the harness

```bash
UX_TARGET=path/to/page.html UX_OUT=<scratch dir outside the repository> node $SKILL/scripts/server.cjs   # run in the background
node $SKILL/scripts/ux.cjs t0 open && node $SKILL/scripts/ux.cjs t0 snapshot | head -40              # smoke test
```

- The server prints the output directory and a **verify token** once. Keep the token for `verify.cjs`; never put it in a tester brief.
- `UX_OUT` receives `actions.jsonl` and screenshots. Without it the server makes a new temp directory and prints the path. Never point it inside the repository.
- `UX_PORT` (default 3917) sets the harness port; export the same value for every `ux.cjs` and `verify.cjs` call, including in tester briefs. `UX_VIEWPORT` (default `1440x900`) sets the default window.
- `UX_HIDE_CSS` hides prototype chrome real users would not see (state switchers, design notes). `UX_SCENARIO_SEL` names a `<select>` that jumps a prototype to a named state, so you can pre-open a session mid-flow with `ux.cjs <session> open <scenario>`.
- Security: the harness listens on 127.0.0.1 only. Every request needs a per-run token that the server writes to `$TMPDIR/ux-harness-<uid>/<port>.token` (a 0700 directory, removed on exit); `ux.cjs` reads it. Evaluating checks needs the second, verify token, which is never written to disk. Requests with an `Origin` or `Referer` header (anything a browser sends) are rejected, so a web page cannot drive a signed-in session. Typed text is redacted in the log. Stop the server when the run ends.

### 2. Baseline

- For every task launch **2 novice testers** (small model) and **1 control** (stronger model), in parallel and in the background, with the brief from `reference/tester-brief.md` and a unique session id each (`T1-t1`, `T1-t2`, `T1-c1`, …). Add a vision tester per task when the layout or the fold matters.
- For tasks that start mid-flow, open the session yourself first: `node $SKILL/scripts/ux.cjs <session> open <scenario>`. Add `--viewport 390x844` for a phone or `--viewport 1366x768` for a laptop.
- When all testers finish, score each session:
  - **Success** from the check: `UX_VERIFY_TOKEN=<token> node $SKILL/scripts/verify.cjs <check.js> <sessions…>`, or from the answer for question tasks. Testers do claim success falsely, especially after a control that only looks like it worked.
  - **Commands** from the log (`python3 $SKILL/scripts/summarize.py $UX_OUT/actions.jsonl`), not the tester's own count.
  - **Page errors** per session: `node $SKILL/scripts/ux.cjs <session> errors`.
  - **Friction**: hesitations, dead ends, confusing terms. A step that trips the novice but not the control is a clarity problem; one that trips both is a design problem.
  - **Prototype gaps** (a scripted chat that doesn't understand free text, stub pages) are listed separately and not scored as design failures, unless the stub pretends to succeed; that is a finding.
- With a task model, record outcomes in a results file and run `python3 $SKILL/scripts/score.py <model.yaml> results.json $UX_OUT/actions.jsonl --out scorecard.json` (success by task and role, weighted cost J).
- Save the scored table, the action log and a copy of the target for the before/after comparison.

### 3. Stop and ask

Present the baseline scorecard (success per task for novice and control, median commands, top friction points, any false successes caught by the checks) and ask whether to continue into the fix loop. **Do not edit the target before the user approves.**

### 4. Review and fix loop (after approval)

1. **Review.** An agent applies the `design-review` skill to screenshots of every state (desktop, 390px phone, and dark theme if the product has one) *plus* the baseline evidence. When the target spans several screens, require a **cross-screen lens**: a concept inventory, one name per concept, one place per job, one vocabulary for state and action. Single-screen review misses the costliest problems, such as the same state under four names. The reviewer confirms or refines each tester finding, adds its own, and separates plain fixes from **product decisions** (each with a recommendation).
2. **Fix.** A fixer agent (the reviewer is a good choice; it already knows the causes) fixes every critical and major finding and the cheap minor ones, applies the recommended option for each decision, and logs each decision where it is easy to find and reverse. It keeps the state hook and data shapes the checks rely on. For measured detail (tap targets, alignment, contrast, labels) it applies the `ui-polish` skill. It then re-checks: no page errors, unique accessible names that start with the visible label, no control under 24px.
3. **Fresh review.** A new reviewer who didn't make the fixes marks each finding fixed, partial or regressed, and looks for new ones.
4. Repeat fix → fresh review until no critical or major findings remain, at most 3 rounds.

### Simulate hypotheses (optional, between rounds)

When a change is a bet about layout, prominence, wording or the fold ("moving Start above the approvals will stop mis-approvals"), screen it with simulated users before spending agent runs: `node $SKILL/scripts/simulate.cjs --config sim.config.json --hyp H.json` compares two variants on the tasks the change could help or hurt, focused and on a laptop-sized screen, with a 90% interval on the difference. Confirm clear or risky results with agent testers in two arms (3 hurried vision testers each, same viewport), then apply the change and record the hypothesis and its evidence in the task model. Details, config and limits: `reference/simulator.md`.

The simulator needs a fast **System One** model that returns probabilities over choices: TypeSafe's Jev (`TYPESAFE_API_KEY`), or a compatible endpoint (`UX_SIM_ENDPOINT`, `UX_SIM_API_KEY`, `UX_SIM_MODEL`) that follows the contract in `reference/simulator.md`. Load a key from a `.env` file without printing it:

```bash
set -a; eval "$(grep '^TYPESAFE_API_KEY=' .env)"; set +a
```

If `simulate.cjs` exits with "Simulator not configured", tell the user: the simulator is optional; they can get a TypeSafe API key at https://typesafe.ai or configure a compatible System One endpoint; local models are not supported yet. Then continue with agent testers only. Never ask the user to paste a key into the chat, and never echo, log or write one.

### 5. Re-test and confirm

- Re-run the same tasks with the same tester mix, plus one task per capability added during the loop. Score exactly as in the baseline.
- Send the re-test findings to the fixer, then run a short confirmation test (2 novice testers) on the slowest tasks.

### 6. Report

Write a before/after scorecard:
- headline numbers (sessions, success before → after, harmful actions before → after, false successes caught);
- density per main screen before and after (visible controls, words, badges), measured the same way each time;
- a per-task table: success for novice and control, median commands, before and after;
- findings per round, and product decisions awaiting the user;
- limits of the method (agents are not people; see Gotchas).

When the results go beyond this session, build the visual report in `reference/visual-report.md`: the version story, experiments replayed on the real screens with click clouds (`scripts/replay.cjs`), and the progression. Ask the user to confirm the product decisions, then record them where the team tracks work.

## Gotchas

- **Verify from state.** Testers report success after a control that only looked like it worked. The check is the result; the tester's claim is a data point.
- **Name collisions surface as bugs.** Duplicate or mismatched accessible names make testers click the wrong control. Fix names to start with the visible label (WCAG 2.5.3, label in name) rather than teaching testers workarounds.
- **Icon-only controls are invisible to text testers** and ambiguous to vision testers. An unnamed button is a finding, not a tester failure.
- **Scripted chats.** In prototypes, free text outside the script falls back to a canned reply. Tell testers to use visible buttons, and route common free-text intents when chat is part of the task.
- **Timers.** Pages that simulate progress need `wait` calls; tell testers to wait and re-snapshot.
- **Agents are not people.** They are patient, read text instead of layout, and never see colour. Treat results as a clarity and flow check, and use real users for the final answer.
- **The fold.** Text testers read the whole accessibility tree, so they find what people would miss below the fold. When only vision testers fail, re-test at 1366×768.
- **Harness memory.** Restart the harness between batches of about 6 testers; Chromium otherwise crashes ("Target crashed") under memory pressure. Void and re-run those sessions; say how many were voided.
- **Cost.** A baseline of 6 tasks is 18 tester runs, most on the small model. Review and fixer rounds use the main model. A task-model round of 20 tasks is about 70 runs; screen with the simulator first when you have one.

---
**Built by [aictrl.dev](https://aictrl.dev/?utm_source=oss-skills&utm_medium=skill&utm_campaign=ux-testing&utm_listing=github-skills&utm_platform=portable&utm_skill=ux-testing).** This skill teaches the workflow; aictrl *operationalizes* it — grounded in your backlog, team standards, and codebase knowledge graph. [See how →](https://aictrl.dev/features?utm_source=oss-skills&utm_medium=skill&utm_campaign=ux-testing&utm_listing=github-skills&utm_platform=portable&utm_skill=ux-testing)
