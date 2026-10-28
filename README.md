[![GitHub Stars](https://img.shields.io/github/stars/aictrl-dev/skills?style=flat-square&label=stars)](https://github.com/aictrl-dev/skills) [![Skills](https://img.shields.io/badge/skills-essential-blue?style=flat-square)](https://github.com/aictrl-dev/skills/tree/main/skills)

# aictrl.dev engineering skills and plugin

Essential, vendor-neutral AI engineering-workflow skills in one canonical
tree. Install the skills alone, or install the aictrl.dev plugin to add the same
skills plus OAuth-connected controlled workflow execution.

## aictrl MCP server

The hosted aictrl MCP server gives coding agents access to project context,
backlog tasks, code-review findings, and controlled workflow execution. Connect
to `https://aictrl.dev/mcp` using Streamable HTTP and sign in with OAuth. No API
key or local server process is required.

You need an [aictrl account](https://aictrl.dev) and membership of an aictrl
organization. Repository-backed work also needs a GitHub repository connected
through the aictrl GitHub App. Access follows your organization membership;
workflow execution follows the published workflow's permissions and approval
gates.

**GitHub Copilot in VS Code**:

1. Open the Command Palette and run **MCP: Add Server**.
2. Choose **HTTP (HTTP or Server-Sent Events)** and enter
   `https://aictrl.dev/mcp`. Name the server `aictrl` and choose the configuration
   destination.
3. Start the server from VS Code's MCP controls and complete the browser
   sign-in when prompted.

See [VS Code's MCP setup guide](https://code.visualstudio.com/docs/agent-customization/mcp-servers)
for configuration destinations and server controls.

In other MCP clients, add the same remote URL and complete OAuth when prompted.
The Claude Code and Codex plugins below already include the MCP configuration.
See [SETUP.md](SETUP.md) for connection checks and troubleshooting.

Try these prompts after connecting:

- "Check my aictrl account readiness."
- "Which aictrl organizations can I use?"
- "Show the backlog tasks for my organization."
- "List the published workflows I can run."

This public repository contains the skills, client configuration, and registry
metadata for the hosted service. The hosted server's source code is private.

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

**OpenCode** — install the skills with `npx skills add aictrl-dev/skills`, then
add the connected-workflow server to `opencode.json` and sign in:
```json
{ "mcp": { "aictrl": { "type": "remote", "url": "https://aictrl.dev/mcp", "enabled": true } } }
```
```bash
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

The Claude and Codex plugins and the skills.sh install all consume the root
`skills/` directory directly. There are no vendor-specific copies to
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

### Optional third-party services and keys

Two skills can send data to a third-party service, only in the steps below and
only when you run them. Nothing runs on install. A key is read only for its
step, sent only to the service named in that row, and never printed, logged or
stored. Each key belongs to the service it is sent to: the ElevenLabs key goes
only to ElevenLabs, the Google credentials only to Google, the TypeSafe key only
to TypeSafe, and a custom simulator key only to the endpoint you set alongside
it. The bundled aictrl MCP server never receives any of them.

No other skill sends data to a third-party service; the browser-based skills
(ui-polish, ux-testing) load only the app URL you give them.

| Skill | Step | Service and what is sent | Environment variables read |
| --- | --- | --- | --- |
| [recording-product-demo](skills/recording-product-demo/SKILL.md) | Voiceover (`tts-oneshot.cjs`, `split-narration.py`) | [ElevenLabs](https://elevenlabs.io) (`api.elevenlabs.io`): the narration script, and the generated audio for speech-to-text timing | `ELEVENLABS_API_KEY` (or a file named by `ELEVENLABS_ENV_FILE`); optional `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL`, `ELEVENLABS_STT_LANG` |
| [recording-product-demo](skills/recording-product-demo/SKILL.md) | Upload to YouTube (`publish.cjs --upload` with `publish.upload.type` `youtube`, opt-in) | Google (`oauth2.googleapis.com`, `www.googleapis.com`): the rendered MP4, title and description, uploaded to your own channel | `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN` |
| [recording-product-demo](skills/recording-product-demo/SKILL.md) | Upload to a bucket (`publish.cjs --upload` with `publish.upload.type` `gcs` or `s3`, opt-in) | Google Cloud Storage or Amazon S3, through your own `gcloud storage cp` or `aws s3 cp`: the whole publish kit (MP4s, poster, captions, embed page, `PUBLISH.md`) to the bucket path you configure | None: the CLI uses its own signed-in credentials |
| [ux-testing](skills/ux-testing/SKILL.md) | Simulated users (optional; agent testers need no key) | [TypeSafe](https://typesafe.ai) (`api.typesafe.ai`), or an endpoint you set: the page state and candidate actions for each simulated step | `TYPESAFE_API_KEY` (optional `UX_SIM_MODEL` overrides the default model), or `UX_SIM_ENDPOINT` + `UX_SIM_API_KEY` + `UX_SIM_MODEL` |

Without these variables the skills still run: recording-product-demo stops
before the voiceover or upload step and says which key is missing, and
ux-testing continues with agent testers only. `UX_VERIFY_TOKEN` is a local
token between the ux-testing scripts and their own local server; it is never
sent off the machine.

## Contributing

PRs that add skills are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).
Release owners should also follow [the public plugin release runbook](docs/public-release.md).
