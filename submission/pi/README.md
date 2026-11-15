# aictrl skills for Pi

17 MIT-licensed engineering skills for Pi: code review, spec review, bug and
issue writing, root-cause analysis, design review and more. Built by
[aictrl](https://aictrl.dev/?utm_source=pi.dev&utm_medium=package&utm_campaign=pi-package&utm_listing=pi-package&utm_platform=pi).
Tested with Pi 1.5.2.

## Install

```sh
pi install npm:@aictrl/skills
```

Restart Pi, then ask for the workflow you want, or call a skill directly, for
example `/skill:code-review`.

## Skills

These 14 work on their own, with your agent's local tools:

`code-review`, `create-bug`, `create-issue`, `create-pr`, `design-review`,
`explain-change`, `judge-review-findings`, `measurement-plan`,
`recording-product-demo`, `reply-to-code-review`, `root-cause-analysis`,
`spec-review`, `ui-polish`, `ux-testing`.

Three use the optional aictrl connection below:

- `create-workflow` writes and validates workflow YAML locally. Publishing it
  to aictrl needs the connection.
- `implement-code-change` works locally, and can also run as a connected
  workflow.
- `execute-workflow` needs the connection and a published workflow.

Browser testing, diagrams and recording have their own requirements, listed in
each skill. Sources: [aictrl-dev/skills](https://github.com/aictrl-dev/skills#readme).

## Optional: connect aictrl

```sh
pi mcp add aictrl --url https://aictrl.dev/mcp
pi mcp login aictrl
```

The second command opens aictrl sign-in in your browser; Pi keeps the
credentials. Once connected, you can start a cloud code review on a pull
request, pull its findings into Pi, judge them with `judge-review-findings`,
and fix and reply with `reply-to-code-review`. You can also claim issues from
your aictrl backlog.

Reviews run in the cloud on your own model key, including a
[GLM Coding Plan](https://aictrl.dev/glm-coding-plan?utm_source=pi.dev&utm_medium=package&utm_campaign=pi-package&utm_listing=pi-package&utm_platform=pi).
