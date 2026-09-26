# Task model

A task model says who uses the UI, what they are trying to achieve, and which tasks matter most, so every
design variant is scored the same way and trade-offs are explicit. Write one before a test round that spans
more than a handful of tasks, or whenever two variants have to be compared. It is a YAML (or JSON) file next
to the target, e.g. `<name>.ux-model.yaml`. A complete worked example (6 tasks, 2 roles, checks, simulator
config and a hypothesis) is the ux-testing eval fixture in the aictrl-dev/skills repository
(`evals/fixtures/ux-testing/`).

## Structure

```yaml
meta:
  target: access-console.html
  state_hook: __state           # checks read window.__state as S (default __state)

roles:
  approver:
    name: Access approver
    description: Keeps access requests and reviews moving for the teams they own.
    objectives: [O1 Keep access reviews on schedule, O2 Remove access nobody should have]

tasks:
  - id: T1                      # sessions are logged as T1-t1, T1-v1, T1-c1, ...
    role: approver
    objective: O1
    prompt: The Payments team's quarterly access review is due. Get that review started.
    paraphrase: kick off the payments access review          # the goal in a user's own words (simulator)
    start: { mode: cold }       # cold = tester runs `open`; preopen = you open it; scenario: <name>; viewport: [w, h]
    frequency: monthly          # daily 5 · weekly 3 · monthly 1
    criticality: 3              # 1 a miss costs time · 2 a miss blocks work · 3 a wrong action has consequences
    ideal_steps: 3              # shortest known path in tester commands (clicks plus a snapshot after each)
    success: S.reviews.find(r => r.team === 'Payments').status === 'in_progress'
    must_not: S.requests.find(r => r.id === 'REQ-311').status === 'approved'   # harmful side effect to rule out
    status: ready               # ready | needs-target (the target cannot express it yet; simulate.cjs skips it)

  - id: Q1                      # a question task: no success check, graded on the answer
    role: approver
    prompt: Which pending access request has been waiting the longest, and who asked for it?
    frequency: weekly
    criticality: 1
    ideal_steps: 2
    answer: [REQ-298, Sam Okafor]   # facts the reply must contain

hypotheses:                     # design bets, with their evidence once tested (see simulator.md)
  - id: H1
    statement: A Start button on the due-review item stops hurried approvers approving the risky request.
    result: pending
```

- `success` and `must_not` are JavaScript expressions evaluated in the page. `S` is the page's state hook
  (`window[meta.state_hook]`), when it has one; expressions can also query the DOM
  (`document.querySelector(...)`). The same expressions, wrapped as `(() => { const S = window.__state; return
  { success: …, harm: … }; })()`, are what you pass to `verify.cjs`.
- Every task that changes state needs `success` and, when a wrong action is possible, `must_not`. Check both
  from state with `scripts/verify.cjs`; never from the tester's report.
- Write `must_not` for every criticality-3 task. It is what catches the costly failures (approving something
  nobody asked about).
- Keep weights and frequencies as drafts for the product owner to confirm; say so in the file.

## Sampling

Per task, per round (the same rule as SKILL.md): 2 text testers (small model, accessibility snapshot) and 1
control (stronger model, text); add 1 vision tester (small model, screenshots only) when the layout or the fold
matters for that task. Use 5 samples for criticality-3 tasks. Add a **hurried** persona (see
`tester-brief.md`) when testing a hypothesis about first glances.

Void, don't score, runs broken by the harness (a crashed browser, a click routed to the wrong control) and
say how many were voided.

## Scoring

Record outcomes per session in a results file (`{"T1": {"t1": 1, "t2": 0, "v1": 1, "c1": null}}`,
null = voided; the suffix's first letter is the tester type: t text, v vision, c control, h hurried), then:

```bash
python3 $SKILL/scripts/score.py <model.yaml> results.json $UX_OUT/actions.jsonl --out scorecard.json
python3 $SKILL/scripts/score.py <model.yaml> results-after.json $UX_OUT/actions.jsonl --before scorecard.json
```

```
weight = frequency × criticality, normalised to sum 1 over the scored tasks
cost   = weight × (failure_rate × 10 + median_commands / ideal_steps)
J      = Σ cost          (lower is better)
```

A variant is accepted only if J improves **and** no criticality-3 task regresses. The per-task cost column
is the fix list: sort by it and fix from the top. Report success by role too; a role stuck below the others
usually means a whole job is missing a place in the UI.

## Tester types see different things

- Text testers read the whole accessibility tree, so they find things below the fold that people miss, and
  they cannot use a control that has no accessible name.
- Vision testers see only screenshots, so they miss anything below the fold and guess at icon-only controls.
  When only vision testers fail, suspect the fold or the visual hierarchy, and check at 1366×768
  (`open --viewport 1366x768`).
- The simulator (see `simulator.md`) sits between the two: its scanner sees the fold like a vision tester.
