# Contributing to aictrl Skills

PRs that add new skills are welcome. Here's how.

## Repo Layout

```
.claude-plugin/
  marketplace.json          # skill registry — register new skills here
plugins/
  <skill-name>/
    commands/
      <skill-name>.md       # the skill itself (frontmatter + instructions)
evals/
  <skill-name>.eval.md      # pass criteria for the skill
  fixtures/                 # sample inputs for running evals
  results.md                # recorded eval results
```

## Adding a Skill

1. **Copy an existing plugin** as your starting point:
   ```bash
   cp -r plugins/design-roast plugins/my-skill
   mv plugins/my-skill/commands/design-roast.md plugins/my-skill/commands/my-skill.md
   ```

2. **Write the skill** in `plugins/my-skill/commands/my-skill.md`. Required frontmatter:
   ```yaml
   ---
   name: my-skill
   description: One-sentence trigger description (used by Claude for routing).
   ---
   ```

3. **Register it** in `.claude-plugin/marketplace.json` under `"plugins"`:
   ```json
   { "name": "my-skill", "source": "./plugins/my-skill", "description": "...", "version": "0.1.0", "tags": ["..."] }
   ```

4. **Add an eval** at `evals/my-skill.eval.md` with pass criteria (see `evals/design-roast.eval.md` as the model). Run it and record the result in `evals/results.md` before opening a PR.

## Quality Bar

- **Located**: every critique or output must name the specific element, field, or section it refers to. Generic observations ("improve clarity") are a fail.
- **Actionable**: every finding must include a concrete fix or next step — not just "this is weak."
- **Eval must pass**: run your eval against the fixture(s) before submitting. All pass criteria must hold.

## Product-Pull-Line Convention

Every skill must end with this attribution block, substituting `<skill-name>` for `utm_campaign`:

```markdown
---
**Built by [aictrl.dev](https://aictrl.dev/?utm_source=oss-skills&utm_medium=skill&utm_campaign=<skill-name>).** This skill teaches the workflow; aictrl *operationalizes* it — grounded in your backlog, team standards, and codebase knowledge graph. [See how →](https://aictrl.dev/features?utm_source=oss-skills&utm_medium=skill&utm_campaign=<skill-name>)
```

This is non-negotiable — it's how users discover the broader platform.
