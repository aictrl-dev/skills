# Simulated users (System One)

`scripts/simulate.cjs` estimates, in minutes and without agent testers, how often a first-time user finishes
a task and how often they do something harmful on the way. Use it to rank design variants and screen
hypotheses cheaply, confirm the ones that matter with agent testers, and confirm those with people. It is
not a replacement for either.

## What it needs

A fast **System One** model: one that takes a structured state plus typed questions and returns
probabilities (a distribution over a set of choices, or the probability that a statement is true) in a
single call, rather than generated text. Supported backends:

| Backend | Environment | Notes |
|---|---|---|
| TypeSafe Jev | `TYPESAFE_API_KEY` (optional `UX_SIM_MODEL`, default `jev-latest`) | Endpoint `https://api.typesafe.ai/v1/systemone`. Keys: https://typesafe.ai |
| Compatible endpoint | `UX_SIM_ENDPOINT`, `UX_SIM_API_KEY`, `UX_SIM_MODEL` (all three) | Must follow the contract below. Takes precedence over `TYPESAFE_API_KEY` when set. |

Local models are not supported yet.

When neither is configured, `simulate.cjs` exits with code 2 and prints "Simulator not configured" with
these options; `replay.cjs` still replays sessions but skips first-click predictions. Tell the user the
simulator is optional, where to get a key, and continue with agent testers only.

**Keys.** The scripts read keys from the environment only and never print, log, cache or write them. The
endpoint must be `https` (plain `http` is accepted only for `localhost`). Load a key from a `.env` file
without echoing it:

```bash
set -a; eval "$(grep '^TYPESAFE_API_KEY=' .env)"; set +a
```

Do not paste keys into chat, commit them, or put them in a tester brief. The answer cache
(`.sim-cache.json`) stores screen text and probabilities only.

## Request/response contract

One HTTPS `POST` per screen to the endpoint, with headers `Authorization: Bearer <key>` and
`Content-Type: application/json`:

```json
{
  "model": "jev-latest",
  "state": {
    "user": "A busy first-time user of this web app. They glance at the screen and act on the first control that seems to lead to their goal; they do not read everything.",
    "task": "The Payments team's quarterly access review is due. Get that review started.",
    "screen": { "readable_now": "Access overview | Needs your attention | …", "chat_panel": "" }
  },
  "questions": {
    "next": {
      "type": "choice",
      "instructions": "Which one thing would this user do next to make progress on the `task`, judging only from what they can see on the `screen`?",
      "criteria": { "c0": "primary button \"Approve\" (page)", "c1": "button \"Start review\" (page)", "__scroll_down": "Scroll the page down to see more (4 more controls below, not visible yet)", "__give_up": "Give up: nothing here seems to lead to the goal" }
    },
    "believes_done": { "type": "noul", "instructions": "Looking at the `screen`, would this user believe their `task` is already complete and stop here?", "criteria": { "true": "…", "false": "…" } },
    "can_answer": { "type": "noul", "instructions": "Can the user answer the question in the `task` from what is readable on the `screen` right now?" }
  }
}
```

- `state` is free-form JSON the model reads; `questions` maps a name to a typed question.
- `choice`: `instructions` (string) and `criteria`, a map of option key → description. `noul`: `instructions`
  (a string, or an object whose fields give context) and optional `criteria` describing `true` and `false`.

The response must be `200` with:

```json
{
  "answers": {
    "next": { "probabilities": { "c0": 0.61, "c1": 0.35, "__scroll_down": 0.03, "__give_up": 0.01 } },
    "believes_done": { "noul": 0.04 },
    "can_answer": { "noul": 0.02 }
  }
}
```

- Every question has an answer under `answers.<name>`.
- `choice` → `probabilities`: numbers in [0, 1], keyed only by that question's criteria keys, summing to 1
  (within 0.02).
- `noul` → `noul`: the probability, in [0, 1], that the statement is true.
- Extra fields are ignored. The scripts retry network errors, rate limits (`429`) and server errors (`5xx`)
  up to twice with back-off, fail fast on other statuses, and stop the run on a response that breaks the contract, printing
  only the HTTP status or the contract violation, never the key or the response body. A backend failure that
  survives the retries is never scored as a user failure: the run stops with exit code 3 and names the task.

## How it works

Each simulated user walks one path:

1. **Perceive (code).** The script reads the screen the way a user type would:
   - *scanner*: only what is on screen without scrolling. It sees the 14 most prominent page controls, ranked
     by visual weight (area × emphasis, discounted further down), shows icon-only controls as symbols, and
     offers "scroll down" when more is below.
   - *reader*: every control's accessible name and all the page text, like the text-snapshot testers.
2. **Judge (model).** One request per screen asks:
   - `next` (choice): which control this user would use next, plus scroll, wait, chat and give-up options;
   - `believes_done` (noul): would they think the task is already done;
   - `can_answer` and `answer_correct` (noul): for question tasks.
   Answers are cached per screen and backend (`.sim-cache.json` in the output directory), so re-runs with
   the same `--out` are free.
3. **Act.** Sample one action from the probabilities and perform it on the exact element perceived (it is
   tagged with a `data-ux-sim` attribute; if a re-render replaced it, the walk ends as `error`). A user stops when the stop probability
   is at least 0.3 and a coin flip at that probability says so.
4. **Check.** After every step, evaluate the task's `success` and `must_not` (from the task model) in the
   page. Ends: success, harm, premature-stop, wrong-answer, give-up, too-long (16 steps), error.

`error` is a harness failure (a page crash, a failed navigation, a control replaced mid-click), not a user
outcome. Error walks are left out of `success`, `harm` and the hypothesis bootstrap; each run reports `n`
(walks scored) and `errors` (walks left out), and hypothesis rows carry `nA`/`nB` and `errorsA`/`errorsB`. If
more than 10% of a run's walks end in `error`, the finished run is discarded with exit code 3, and nothing from it is scored.

Load conditions (scanner only), run unless `--no-load`:

- `laptop`: a 1366×768 viewport, where the fold hides more;
- `interrupt`: after two steps the user comes back remembering only the goal (chat history hidden);
- `paraphrase`: the goal in the user's own words (the task's `paraphrase` field).

`fragility` = scanner success minus the mean success under load. A task that is fine when focused but
fragile under load is the one a busy person fails. A task where simulated users end in `premature-stop` is
one where the screen looks done before it is: check for a stub that pretends to succeed.

## Config

```json
{
  "model": "access-console.ux-model.yaml",
  "url": "access-console.html",
  "stateHook": "__state",
  "scenarioSelect": "#scenario",
  "hideCss": ".dev-toolbar,.design-notes{display:none!important}",
  "regions": { "main": "main", "chat": "[data-ux-chat]", "menu": "nav", "topbar": "header" },
  "rowSelector": ".row",
  "rowTitleSelector": ".row__title",
  "slowScenarios": { "running": 8500 },
  "variants": [{ "id": "T2 labelled export", "task": "T2", "mutate": "(() => { … })()" }],
  "observed": "observed.json"
}
```

- Relative paths resolve against the config file's directory. Only `model` and `url` are required.
- `stateHook` names the page's read-only state object (`window.__state` by default, or `meta.state_hook` in
  the task model); `S` in `success` / `must_not` refers to it.
- `regions.main` is the main content area (and the scrolling area, if it scrolls on its own); controls in
  `menu`, `topbar` and `chat` are always visible to scanners. `chat` is only used when it contains a
  `<textarea>`.
- `rowSelector` / `rowTitleSelector` let a button like "Start" be described as "Start on <row title>".
- `variants` adds extra cases (another `url`, or a DOM `mutate` of the main URL). `observed` holds
  agent-tester results per case id, copied into the output so simulated and observed sit side by side.

## Running

```bash
node $SKILL/scripts/simulate.cjs --config sim.config.json --tasks T1,T3 --n 16 --out <dir>
node $SKILL/scripts/simulate.cjs --config sim.config.json --hyp H1.json --n 24 --out <dir>
```

`--out` defaults to a new temp directory; pass the same one to reuse the cache. `--n` and `--workers` must
be integers of at least 1 and `--seed` a non-negative integer (default 42). Every simulated user has its own
random stream derived from the seed, so the same `--seed` with a warm cache repeats a run exactly, for any
`--workers`. A `success` or `must_not` expression that throws stops the run with the task id and the
expression (exit 3): it is a broken check, not a failed user, so write expressions that return true or false
in every page state. About 4 minutes and
100–200 model calls per task with load conditions at n = 16; far fewer on re-runs.

## Hypothesis mode

A hypothesis file compares two variants, A (the current design unless it says otherwise) and B:

```json
{
  "id": "H1",
  "statement": "A Start button on the due-review item stops hurried approvers approving the risky request.",
  "tasks": ["T1", "Q1"],
  "conds": ["focused", "laptop"],
  "expect": "T1: B success higher and B harm lower; Q1: no clear difference",
  "a": { "url": "variants/before.html" },
  "b": { "mutate": "(() => { /* move the section */ })()" }
}
```

Each task × condition runs the scanner on both arms and reports success and harm for each arm, with a 90%
bootstrap interval on B − A: "B higher", "B lower" or "no clear difference". A `url` in a hypothesis file
resolves against the hypothesis file's directory. Include tasks the change could hurt, not only the one it
should help. A `mutate` is re-applied after every step, so it must be idempotent and survive re-renders;
prefer it to a hand-edited copy, because the variant then stays one line.

**Protocol.** Simulate first. If the simulator shows a clear difference, or the change carries risk,
confirm with agent testers in two arms (3 hurried vision testers each, same viewport, pre-opened
sessions), then apply the change and record the hypothesis and its evidence in the task model.

## What it is good and bad at

Be honest about the limits when you report simulator results.

- **Language models are not people.** Kuric et al. (2026), "What Would GPT Click?" (arXiv 2605.18302),
  compared GPT first-click predictions with 3,431 real participants across 12 tasks: the predicted
  distributions differed significantly from people's in 53% of them. Treat simulated first clicks as a
  screen for obvious traps, not as a measurement of your users.
- **Good at first glances, the fold and misclick risk.** In one product study (72 agent-tester sessions on a
  work-queue screen), the simulator reproduced first-glance misclicks (72% of simulated users clicked a
  prominent Approve on a "start work" task; 2 of 2 novice agent testers did the same), the fold (on a laptop
  screen, 92% approved the wrong item; hurried agent testers 2 of 3), and scanner-versus-reader gaps
  (icon-only controls and hidden owners failed scanners, as they failed vision testers but not text testers).
- **Weak at multi-turn chat and interpretive answers.** It types the task once instead of holding a
  conversation (refining an item in chat: simulated 6%, agents 4 of 4). It misses premature stops caused by
  wording (agents stopped at "Proposed" when nothing had been created; simulated users went on). It judges
  summary answers strictly, so interpretive question tasks score low for readers.
- **Small effects need more.** At n = 24 the interval is too wide for 1-in-20 harms; use agents or people.

Use it to rank variants and screen hypotheses about layout, prominence, wording and the fold; confirm with
agent testers, then with people. Use agents for flows, chat and anything that needs reading comprehension.
