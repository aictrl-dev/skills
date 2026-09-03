# Claude plugin directory listing

Values for the Console submission form (`https://platform.claude.com/plugins/submit`,
steps "Plugin information" and "Submission details"). Identity fields (name,
repository, author, homepage, license, keywords) come from
`.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`; the two
description rows are Console-form drafts that intentionally differ from the
manifests' single `description`, which is quoted below for reference. If a form
field is not listed here, use the manifest value and add it to this file. Do not
submit while any owner-only item in `readiness.md` remains unresolved.

## Plugin information

| Form field | Value |
| --- | --- |
| Plugin name | `aictrl` (the install id; the display name on aictrl.dev is `aictrl.dev`) |
| GitHub repository | `https://github.com/aictrl-dev/skills` (public, MIT) |
| Marketplace / manifest | `.claude-plugin/marketplace.json` (`aictrl-public`), plugin source `./` |
| Manifest `description` (reference, not a form field) | `Essential engineering skills for teams building with AI, with optional controlled AICtrl workflow execution` |
| Short description (form draft) | `Engineering skills and controlled workflows` |
| Long description (form draft) | `Essential engineering skills for teams building with AI — spec review, implementation, code review, root-cause analysis, measurement plans — plus an optional OAuth-connected aictrl.dev workflow server for controlled execution with approvals, evidence and policy.` |
| Category | Developer tools / engineering (choose the closest option offered) |
| Keywords | `engineering`, `sdlc`, `code-review`, `github`, `workflow`, `agent-skills` (identical in `plugin.json` `keywords` and `marketplace.json` `tags`) |
| Developer name | `aictrl.dev` |
| Website | `https://aictrl.dev` |
| Documentation | `https://aictrl.dev/docs/plugin-setup` |
| Support | `https://aictrl.dev/support` |
| Privacy policy | `https://aictrl.dev/privacy` |
| Terms of service | `https://aictrl.dev/terms` |
| Contact email | `info@aictrl.dev` |
| Logo | `assets/icon.svg` (brand color `#4c6ef5`) |

## Bundled MCP server

| Field | Value |
| --- | --- |
| Server | `aictrl` — `https://aictrl.dev/mcp` (Streamable HTTP) |
| Authentication | OAuth 2.1 with PKCE and dynamic client registration; no API key, no environment variables |
| Setup guidance | `SETUP.md` at the plugin root |
| Tools | the public catalogue served by `/mcp`; every tool carries a `title` and `readOnlyHint` / `destructiveHint` (pinned in `aictrl-dev/aictrl` by `test/mcp/public-tool-directory-contract.test.ts`) |
| Connectors Directory status | not yet listed; tracked in `aictrl-dev/aictrl#4960`. Until it is, installs show the standard warning for a remote MCP server outside the directory |

## Skills and starter prompts

Upload nothing: the directory mirrors the repository. Suggested starter prompts
(same three as the Codex listing):

1. `Turn this request into an implementation-ready issue.`
2. `Implement this issue and prepare a merge-ready pull request.`
3. `Review this pull request at its current head revision.`

## Reviewer notes

- Every skill works without an aictrl.dev account; only connected workflow
  execution needs the OAuth sign-in.
- The reviewer test cases in `../codex/test-cases.md` (five positive, three
  negative) apply unchanged. The reviewer account, its fixture organisation and
  the credentials are provided to reviewers out of band by the release owner
  from the internal tracker; none of that is committed here.
- Data handling: first-party API only; no financial transactions; no
  AI-generated media; no sponsored content; the server does not read Claude's
  memory, chat history or user files.
