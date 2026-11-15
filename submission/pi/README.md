# aictrl skills for Pi

17 MIT engineering skills, plus an optional
[aictrl](https://aictrl.dev/?utm_source=pi.dev&utm_medium=package&utm_campaign=pi-package&utm_listing=pi-package&utm_platform=pi)
connection for cloud code review and backlog work. Tested with Pi 1.5.2.

## Install

```sh
pi install npm:@aictrl/skills
```

Restart Pi, then ask for a workflow or invoke a skill with `/skill:code-review`.

## Skills

These 14 skills work without an aictrl connection, using your agent's local
tools and any provider access needed for the task:

`code-review`, `create-bug`, `create-issue`, `create-pr`, `design-review`,
`explain-change`, `judge-review-findings`, `measurement-plan`,
`recording-product-demo`, `reply-to-code-review`, `root-cause-analysis`,
`spec-review`, `ui-polish`, `ux-testing`.

`create-workflow` authors and validates YAML locally; publishing it to aictrl
requires a connected repository and an authorized Git publication.
`implement-code-change` works locally, with an optional connected workflow mode.
`execute-workflow` requires an authenticated aictrl connection and an existing
published workflow. Browser testing, diagrams and recording have their own
dependencies, documented in each skill.

See the [skill sources and documentation](https://github.com/aictrl-dev/skills#readme).

## Optional aictrl connection

In Pi, open `/mcp`, select `aictrl`, and choose **Enable**. Then run:

```text
/mcp login aictrl
```

This opens aictrl sign-in. The server starts disabled so installation and
startup stay quiet; Pi requires enabling a server before its login command.
Pi 1.5.2 keeps extension-server enablement for the current session; enable it
again in each new session. Sign-in credentials are managed by Pi.

The connection lets you start cloud Code Review on a PR, pull findings into Pi,
judge and record verdicts, use `reply-to-code-review` to fix and reply through
your Git provider, and claim backlog issues. Connected workflow tools support
`execute-workflow` and the connected mode of `implement-code-change`. Actions
follow the authorization rules in each skill.

Only review, findings, tasks, backlog/context and workflow tools, plus
organization selection, are exposed to the model. `query_context` and
`update_backlog` are shared multi-action tools; Pi filters tool names, not their
individual actions. A user-defined `aictrl` server in `mcp.json` overrides this
extension's configuration. Inspect the extension server with `/mcp` in a Pi
session; shell `pi mcp list` only lists file-configured servers.

[Run reviews in the cloud on your own model key, including a GLM Coding Plan](https://aictrl.dev/glm-coding-plan?utm_source=pi.dev&utm_medium=package&utm_campaign=pi-package&utm_listing=pi-package&utm_platform=pi).
