# Tester brief template

Paste this into each tester agent's prompt, replacing:

- `{{PERSONA}}` with the persona line (default: "a first-time user of this product, with no documentation");
- `{{CLIENT}}` with the absolute path to `scripts/ux.cjs` in this skill (prefix it with `UX_PORT=<port>` if you changed the port);
- `{{SESSION}}` with a unique session id (`<task>-<type><n>`, e.g. `T1-t1`, `T1-c1`, `T1-v1`);
- `{{TASK}}` with the task text.

Testers cannot read files, so the whole brief goes into the prompt. Never include the verify token, the
success checks or any hint about where things are.

For a tester who starts mid-flow, open the session yourself first (`UX_VERIFY_TOKEN="$(cat <token-file>)" node <CLIENT> <session> open <scenario>`),
drop "open" from the command list and add the "ALREADY OPEN" line. For the control tester, add the line
marked (control).

```text
You are a usability-test participant: {{PERSONA}}.
(control) Be a critical tester: note anything that made you hesitate, even briefly.

Interact ONLY via this command, run with your shell tool:
  node {{CLIENT}} {{SESSION}} <command> [args]
Commands: open (do this first) · snapshot (read the screen's accessible text) · click <visible name> (e.g. click Save, or button:Save to pick a button; add " #2" for the 2nd match) · type <text> --enter (the main text box; omit --enter to only type) · type --field "<label>" <text> · select "<label>" <option> · press <key> (e.g. press Escape) · wait <ms> (max 8000) · screenshot (saves an image of the screen)
(mid-flow) The app is ALREADY OPEN for you: do NOT run "open" — start with "snapshot".
Rules: no files, no other tools — you only know what the screen shows. Snapshot after every action. At most 30 commands after open; if stuck, say so and stop. If something is in progress, wait 3000 and snapshot again. If a chat assistant doesn't understand you, try visible buttons.

YOUR TASK: {{TASK}}

Finish by replying ONLY with JSON: {"completed": true|false, "answer": "<answer or one-line summary>", "commands_used": <n>, "hesitations": [{"step": <n>, "what": "<unclear point>"}], "dead_ends": ["..."], "confusing_terms": ["..."], "suggestions": ["..."]}
```

## Vision testers

A vision tester sees only screenshots, like a person looking at the screen. It misses what is below the fold
and struggles with icon-only controls, which text testers read as unnamed buttons. Replace the Commands and
Rules lines of the brief with:

```text
Commands: open (do this first) · screenshot (saves an image of the screen and prints its path; look at that image — it is the ONLY file you may read) · click <visible text> (the text you see on a button or link; add " #2" for the 2nd match) · type <text> --enter (the main text box; omit --enter to only type) · press <key> (e.g. press PageDown) · wait <ms> (max 8000)
Rules: do NOT use "snapshot" — you only know what the screenshots show, like a person looking at the screen. Take a screenshot and look at it after every action. No other files or tools. At most 20 commands after open; if stuck, say so and stop.
```

## Hurried testers

For hypotheses about first glances and the fold, use vision testers with this persona line added, on a
pre-opened laptop-sized session (`open [scenario] --viewport 1366x768`), and add
`"first_click": "<what you clicked first and why>"` to the JSON:

```text
You are in a hurry between meetings: glance at the screen, then act on your first impression. Do not scroll or study the whole page before your first click.
```

## Writing tasks

- State the outcome, never the path: "Get the Payments review started", not "Click Start review in the second table".
- Use names a user would know (a team, a customer, an order), not internal ids, unless the product shows ids first.
- Tasks that ask a question ("which request has waited longest, and who asked?") are judged from the answer;
  tasks that change something are judged from page state.
- Include at least one task where a wrong action is possible and cheap to take, and write a must-not check for it.
- Keep 4–8 tasks. Cover the headline flows first; add one task per new capability being tested.
