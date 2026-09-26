# Visual report

A scorecard says whether a design improved. A visual report shows people why: what testers did on the real
screens, where it went wrong, and how the design changed because of it. Build one when results are going to
anyone outside the session: a single self-contained HTML page with its images next to it is enough.

## Sections, in order

1. **Headline numbers.** Sessions run, simulated judgements (if any), success before → after, harmful
   actions before → after, false successes caught by the checks.
2. **The story.** A timeline, one card per version: a screenshot of the same view, what changed, why (the
   user's decision or the test finding that drove it) and the measured result. Start with "where we
   started" (the product as it is today). This is what people remember, so put it before the method.
3. **Experiments.** For each A/B experiment, the arms side by side on the actual first screen:
   - pins for each agent tester's first click, coloured by outcome;
   - a fold line on laptop-sized screens;
   - with a simulator backend: a click cloud (a heat map of where simulated users would click first, from
     the `next` probabilities) and the top first-click choices as bars;
   - a strip of each tester's steps (click a thumbnail to enlarge, with the clicked element outlined).
4. **Progression.** Success and J per round, and the hypotheses with their evidence.
5. **Method and limits.** Tester types, verification from state, the simulator and its limits
   (`simulator.md`), and that agents are not people.

## Screenshots

- Capture every version's screenshot of the same view at the same size **in the same theme**. Mixing a
  dark version with light ones makes the theme look like the change. Set the theme explicitly if the
  product's default differs between versions.
- Keep old versions reproducible: when a change replaces a design, keep the "before" page (a copy in a
  `variants/` directory next to the results, or a `mutate` in a hypothesis file).

## Replaying sessions

```bash
node $SKILL/scripts/replay.cjs --config replay.config.json --out <dir> [--steps 5]
```

```json
{
  "hideCss": ".dev-toolbar{display:none!important}",
  "scenarioSelect": "#scenario",
  "scenario": "overview",
  "regions": { "chat": "[data-ux-chat]", "menu": "nav", "topbar": "header" },
  "experiments": [{
    "id": "h1", "title": "H1 · Start on the due review",
    "viewport": { "width": 1366, "height": 768 },
    "task": "The Payments team's quarterly access review is due. Get that review started.",
    "arms": [
      { "arm": "A", "label": "Before", "url": "variants/before.html", "log": "results/h1-A-actions.jsonl", "sessions": [["T1-hA1", "harm"], ["T1-hA2", "success"]] },
      { "arm": "B", "label": "After", "url": "page.html", "log": "results/h1-B-actions.jsonl", "sessions": [["T1-hB1", "success"]] }
    ]
  }]
}
```

Relative paths resolve against the config's directory. The script re-runs each session's clicks from the
harness log (up to `--steps` per session), saves a screenshot before each click with the clicked element's
box, and the first screen of each arm. Typed text is redacted in the harness log, so replays show clicks,
key presses and waits only. With a simulator backend configured it adds the model's first-click
prediction; without one it says so and leaves `prediction.probs` as `null`. A warning means a logged click
could not be found on replay, usually because the page changed since the session.

`<dir>/replays.json` has this shape (boxes are CSS pixels in the viewport):

```json
{ "experiments": [{ "id": "h1", "title": "…", "viewport": { "width": 1366, "height": 768 }, "task": "…",
  "arms": [{ "arm": "A", "label": "Before",
    "sessions": [{ "session": "T1-hA1", "outcome": "harm",
      "steps": [{ "label": "Approve", "img": "img/h1-A-T1-hA1-0.jpg", "box": { "x": 855, "y": 197, "w": 110, "h": 44 } }],
      "end": "img/h1-A-T1-hA1-end.jpg" }],
    "prediction": { "img": "img/h1-A-first.jpg", "probs": [{ "label": "Approve", "box": { … }, "p": 0.61 }] } }] }] }
```

Build the page from it: embed `replays.json` in a `<script type="application/json">`, draw each arm's first
screen with absolutely positioned pins and boxes over the image, and keep the `img/` directory next to the
page. Share it the way the team shares documents; the images show the product, so treat it like any
internal screenshot.
