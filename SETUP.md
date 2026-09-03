---
name: setup
description: Connect the aictrl.dev MCP server bundled with this plugin (OAuth, no API key) and run the first readiness check.
---

# Setting up the aictrl.dev connection

The skills in this plugin work on their own. The bundled MCP server adds
controlled workflow execution, backlog and project-context tools from
`https://aictrl.dev/mcp`; it needs a one-time OAuth sign-in and nothing else.

## Prerequisites

1. An aictrl.dev account (sign in at https://aictrl.dev with Google).
2. Membership of an aictrl organization with at least one GitHub repository
   connected through the aictrl GitHub App. If you have neither yet, the
   `get_started` tool tells you the single next step.

No API key, environment variable or local process is required. The MCP
configuration shipped in `.mcp.json` is:

```json
{ "mcpServers": { "aictrl": { "type": "http", "url": "https://aictrl.dev/mcp" } } }
```

## Connect

**Claude Code** — from the terminal, after installing the plugin:

```bash
claude mcp login plugin:aictrl:aictrl
```

`plugin:aictrl:aictrl` is `plugin:<plugin-name>:<server-name>`; the qualified
form selects the server registered by this plugin. A browser tab opens the
aictrl sign-in page; approve the authorization request and return to the
terminal. `/mcp` then shows `aictrl` as connected.

**Cowork / claude.ai** — enable the plugin, then choose **Connect** on the
`aictrl` server when prompted and complete the same sign-in.

## Verify

Ask: *"Check my aictrl account readiness."* The `get_started` tool returns the
current readiness of your account and repository and one best next action.
Then try *"Which aictrl organizations can I use?"* (`list_organizations`).

## What the tools may do

Read-only tools (`get_started`, `list_organizations`, `query_context`,
`list_workflows`, `get_workflow`, `get_workflow_run`, `list_tasks`,
`get_task_execution`) run without a per-call confirmation. Tools that change
state prompt first: `update_backlog` (creates or updates backlog tasks),
`approve_workflow_step` (a rejection cancels the run), `cancel_workflow_run`.
`start_workflow` and `start_task` start work that a published workflow may
turn into GitHub side effects, only within that workflow's configured gates
and policy. Access is limited to organizations you are a member of; any other
organization id returns not found.

## Troubleshooting

- **"Authentication required"** — run the login command again; tokens are
  rotated and a revoked token gets a 401 challenge by design.
- **Tool missing after install** — restart the client so the plugin's
  `.mcp.json` is loaded, then check `/mcp`.
- **Slow first call** — the server scales to zero outside office hours; a
  cold start can take a few seconds.

Privacy policy: https://aictrl.dev/privacy · Terms: https://aictrl.dev/terms ·
Support: https://aictrl.dev/support
