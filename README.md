[![GitHub Stars](https://img.shields.io/github/stars/aictrl-dev/skills?style=flat-square&label=stars)](https://github.com/aictrl-dev/skills) [![Skills](https://img.shields.io/badge/skills-essential-blue?style=flat-square)](https://github.com/aictrl-dev/skills/tree/main/skills)

# aictrl.dev engineering skills and plugin

Essential, vendor-neutral AI engineering-workflow skills in one canonical
tree. Install the skills alone, or install the aictrl.dev plugin to add the same
skills plus OAuth-connected controlled workflow execution.

## Install

**Skills only — Codex, Claude Code, OpenCode, and compatible agents**
```bash
npx skills add aictrl-dev/skills
```

**Claude Code plugin**
```
/plugin marketplace add aictrl-dev/skills
/plugin install aictrl@aictrl-public
```

**Codex plugin**
```bash
codex plugin marketplace add aictrl-dev/skills --ref main
codex plugin add aictrl@aictrl-public
```

**OpenCode plugin package**
```bash
npx @aictrl/opencode@beta
opencode mcp auth aictrl
```

**Cursor / direct OpenCode skills** — skills use the cross-tool [Agent Skills](https://agentskills.io) standard:
```
git clone https://github.com/aictrl-dev/skills && cd skills
./scripts/install.sh cursor       # or: opencode | all
```
…or copy `skills/*` into your tool's skills dir (`~/.cursor/skills`, `~/.config/opencode/skills`).

Then ask for the task naturally or invoke a supported slash command, for example
`/create-issue`, `/implement-code-change`, `/code-review`, `/create-workflow`,
or `/execute-workflow`.

## The Skills

| Skill | What it does | Try it |
|-------|-------------|--------|
| [create-issue](skills/create-issue/SKILL.md) | Vague feature or chore → code-grounded issue with scope, acceptance criteria, tests, risks, and open questions. | `/create-issue` |
| [create-bug](skills/create-bug/SKILL.md) | Symptoms or regression → reproducible, evidence-backed bug and regression-test requirement. | `/create-bug` |
| [spec-review](skills/spec-review/SKILL.md) | Issue/spec → repository-grounded readiness verdict and concrete gap fixes. | `/spec-review` |
| [implement-code-change](skills/implement-code-change/SKILL.md) | Issue → tested, reviewed, merge-ready PR locally or through an optional connected workflow. | `/implement-code-change` |
| [create-pr](skills/create-pr/SKILL.md) | Exact revision + evidence → concise reviewer-ready PR title and body, with rollout and verification claims kept honest. | `/create-pr` |
| [code-review](skills/code-review/SKILL.md) | Exact PR head → actionable correctness, security, reliability, and test findings; no code changes. | `/code-review` |
| [judge-review-findings](skills/judge-review-findings/SKILL.md) | Current-head findings → TRUE/FALSE/UNCERTAIN plus FIX/DEFER/IGNORE judgments. | `/judge-review-findings` |
| [reply-to-code-review](skills/reply-to-code-review/SKILL.md) | Accepted review findings → fixes, verification, evidence-backed replies, and bounded re-review. | `/reply-to-code-review` |
| [root-cause-analysis](skills/root-cause-analysis/SKILL.md) | Incident or recurring failure → evidence-driven causal analysis, sibling exposure map, and prevention portfolio. | `/root-cause-analysis` |
| [create-workflow](skills/create-workflow/SKILL.md) | Workflow intent → validated aictrl.dev workflow v2 YAML with portable inline task nodes. | `/create-workflow` |
| [execute-workflow](skills/execute-workflow/SKILL.md) | Published workflow → explicitly authorized, idempotent start with safe monitoring, gates, cancellation, and durable handoff. | `/execute-workflow` |
| [design-review](skills/design-review/SKILL.md) | Drop an HTML mock or screenshot — get a sharp, located critique across IA, value prop, hierarchy, trust/friction, and a11y. Ends with "Fix these 3 first." | `/design-review path/to/mock.html` |
| [measurement-plan](skills/measurement-plan/SKILL.md) | Feature → structured measurement plan: learning objectives, metrics table, product-analytics events, warehouse changes, event pipeline. | `/measurement-plan` |
| [recording-product-demo](skills/recording-product-demo/SKILL.md) | Point it at a repo with a web UI — it boots the app, preps demo data/auth, records a narrated time-locked Playwright demo synced to an ElevenLabs voiceover, and builds a publish kit (MP4 + captions + embed). | `/recording-product-demo` |
| [explain-change](skills/explain-change/SKILL.md) | PR, commit range, or design document → a grounded technical explainer of the design, difficult trade-offs, and real rollout state. | `/explain-change` |
| [ui-polish](skills/ui-polish/SKILL.md) | Point it at a screen — it renders phone and desktop, measures what screenshots hide (column alignment, field widths, labels, tap targets, contrast, dead space), fixes the source and re-measures until the checks pass. | `/ui-polish` |
| [ux-testing](skills/ux-testing/SKILL.md) | Point it at a page or prototype and a few tasks — AI testers act as first-time users through the accessibility tree or screenshots, success is verified from page state (not the tester's claim), then a design-review and fix loop re-tests into a before/after scorecard. Optional simulated users screen layout hypotheses. | `/ux-testing path/to/page.html` |

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

### ux-testing in action

On an internal work-queue design, novice agent testers asked to start the most important ready work
approved a security review instead (v5: 2 of 2). After the fix loop moved the ready work above the
approvals, 3 of 3 started the right issue. Simulated users reproduced the same trap (72% clicked
Approve), and checks against page state caught a tester who reported success after creating nothing. Write-up:
[AI usability testing on a backlog design](https://aictrl.dev/blog/ai-usability-testing-backlog-design).

## Why these exist

These skills are free and standalone. [aictrl.dev](https://aictrl.dev/?utm_source=oss-skills&utm_medium=readme&utm_campaign=repo&utm_listing=github-skills&utm_platform=portable)
adds controlled remote execution, approvals, policy, history, integrations, and
cost limits. `implement-code-change` can use an optional connected workflow,
and `execute-workflow` safely operates an existing published workflow; local
mode remains available for every launch skill except the connected-only
`execute-workflow`.

The Claude, Codex, and OpenCode distributions in this repository all consume
the root `skills/` directory directly. There are no vendor-specific copies to
repin or hand-edit. Connected execution always uses the `aictrl` MCP identity at
`https://aictrl.dev/mcp`; OAuth is requested only when a connected workflow is
used.

## Privacy, terms and support

The skills run locally and send nothing to aictrl.dev. The bundled `aictrl`
MCP server is used only when you connect it with OAuth; what it collects and
keeps is described in the [privacy policy](https://aictrl.dev/privacy) and
[terms](https://aictrl.dev/terms). Support: [aictrl.dev/support](https://aictrl.dev/support)
or [info@aictrl.dev](mailto:info@aictrl.dev). Security reports:
[security.txt](https://aictrl.dev/.well-known/security.txt). Setup guidance for
the MCP connection is in [SETUP.md](SETUP.md).

## Contributing

PRs that add skills are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).
Release owners should also follow [the public plugin release runbook](docs/public-release.md).
