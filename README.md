[![GitHub Stars](https://img.shields.io/github/stars/aictrl-dev/skills?style=flat-square&label=stars)](https://github.com/aictrl-dev/skills) [![Skills](https://img.shields.io/badge/skills-3-blue?style=flat-square)](https://github.com/aictrl-dev/skills/tree/main/plugins)

# aictrl Skills

Free, vendor-neutral AI engineering-workflow skills.

## Install

```
/plugin marketplace add aictrl-dev/skills
/plugin install design-review@aictrl-skills
```

Not on Claude Code? Every skill is plain markdown under `plugins/<name>/commands/` — drop it into your agent's context.

## The Skills

| Skill | What it does | Try it |
|-------|-------------|--------|
| [design-review](plugins/design-review/commands/design-review.md) | Drop an HTML mock or screenshot — get a sharp, located critique across IA, value prop, hierarchy, trust/friction, and a11y. Ends with "Fix these 3 first." | `/design-review path/to/mock.html` |
| [measurement-plan](plugins/measurement-plan/commands/measurement-plan.md) | Feature → structured measurement plan: learning objectives, metrics table, product-analytics events, warehouse changes, event pipeline. | `/measurement-plan` |
| [create-issue](plugins/create-issue/commands/create-issue.md) | Vague idea or bug → well-formed GitHub issue with context, acceptance criteria, and no vague hand-waving. Creates it via `gh` after you confirm. | `/create-issue` |

### design-review in action

Input: a SaaS landing page mock.

```
Value Proposition — WEAK
  Hero headline "Workflows made simple" says nothing about what the product does.
  Fix: replace with a one-liner that names the user, the problem, and the outcome.

Actionability — BROKEN
  Three competing CTAs above the fold (Start free, Book demo, Watch video).
  Fix: one primary CTA above the fold; demote the others below.
```

Every critique names the element. Every fix is concrete. No generic "improve clarity."

## Why these exist

These are the engineering workflows [aictrl](https://aictrl.dev/?utm_source=oss-skills&utm_medium=readme&utm_campaign=repo) automates at scale. The skills teach the method — aictrl operationalizes it, grounded in your backlog, team standards, and codebase knowledge graph. The skills are free and standalone; aictrl is the layer that makes them continuous and codebase-aware.

## Contributing

PRs that add skills are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).
