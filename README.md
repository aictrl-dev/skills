[![GitHub Stars](https://img.shields.io/github/stars/aictrl-dev/skills?style=flat-square&label=stars)](https://github.com/aictrl-dev/skills) [![Skills](https://img.shields.io/badge/skills-11-blue?style=flat-square)](https://github.com/aictrl-dev/skills/tree/main/aictrl-skills/skills)

# aictrl Skills

Eleven free, vendor-neutral AI engineering-workflow skills. Eight cover the core
issue → implementation → review loop and work locally before you connect AICtrl.

## Install

**Codex, Claude Code, OpenCode, and compatible agents**
```bash
npx skills add aictrl-dev/skills
```

**Claude Code marketplace**
```
/plugin marketplace add aictrl-dev/skills
/plugin install aictrl-skills@aictrl-oss
```

**Cursor / OpenCode** — skills use the cross-tool [Agent Skills](https://agentskills.io) standard:
```
git clone https://github.com/aictrl-dev/skills && cd skills
./scripts/install.sh cursor       # or: opencode | all
```
…or copy `skills/*` into your tool's skills dir (`~/.cursor/skills`, `~/.config/opencode/skills`).

Then ask for the task naturally or invoke a supported slash command, for example
`/create-issue`, `/implement-code-change`, `/code-review`, or `/create-workflow`.

## The Skills

| Skill | What it does | Try it |
|-------|-------------|--------|
| [create-issue](aictrl-skills/skills/create-issue/SKILL.md) | Vague feature or chore → code-grounded issue with scope, acceptance criteria, tests, risks, and open questions. | `/create-issue` |
| [create-bug](aictrl-skills/skills/create-bug/SKILL.md) | Symptoms or regression → reproducible, evidence-backed bug and regression-test requirement. | `/create-bug` |
| [spec-review](aictrl-skills/skills/spec-review/SKILL.md) | Issue/spec → repository-grounded readiness verdict and concrete gap fixes. | `/spec-review` |
| [implement-code-change](aictrl-skills/skills/implement-code-change/SKILL.md) | Issue → tested, reviewed, merge-ready PR locally or through an optional connected workflow. | `/implement-code-change` |
| [code-review](aictrl-skills/skills/code-review/SKILL.md) | Exact PR head → actionable correctness, security, reliability, and test findings; no code changes. | `/code-review` |
| [judge-review-findings](aictrl-skills/skills/judge-review-findings/SKILL.md) | Current-head findings → TRUE/FALSE/UNCERTAIN plus FIX/DEFER/IGNORE judgments. | `/judge-review-findings` |
| [reply-to-code-review](aictrl-skills/skills/reply-to-code-review/SKILL.md) | Accepted review findings → fixes, verification, evidence-backed replies, and bounded re-review. | `/reply-to-code-review` |
| [create-workflow](aictrl-skills/skills/create-workflow/SKILL.md) | Workflow intent → validated AICtrl workflow v2 YAML with portable inline task nodes. | `/create-workflow` |
| [design-review](aictrl-skills/skills/design-review/SKILL.md) | Drop an HTML mock or screenshot — get a sharp, located critique across IA, value prop, hierarchy, trust/friction, and a11y. Ends with "Fix these 3 first." | `/design-review path/to/mock.html` |
| [measurement-plan](aictrl-skills/skills/measurement-plan/SKILL.md) | Feature → structured measurement plan: learning objectives, metrics table, product-analytics events, warehouse changes, event pipeline. | `/measurement-plan` |
| [recording-product-demo](aictrl-skills/skills/recording-product-demo/SKILL.md) | Point it at a repo with a web UI — it boots the app, preps demo data/auth, records a narrated time-locked Playwright demo synced to an ElevenLabs voiceover, and builds a publish kit (MP4 + captions + embed). | `/recording-product-demo` |

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

These skills are free and standalone. [AICtrl](https://aictrl.dev/?utm_source=oss-skills&utm_medium=readme&utm_campaign=repo&utm_listing=github-skills&utm_platform=portable)
adds controlled remote execution, approvals, policy, history, integrations, and
cost limits. The first connected path is `implement-code-change`; local mode
remains available for every launch skill.

For pinned public packages and connected install paths across Claude Code,
Codex, and OpenCode, see
[`aictrl-dev/aictrl-plugin`](https://github.com/aictrl-dev/aictrl-plugin).

## Contributing

PRs that add skills are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).
