# aictrl.dev 1.2.1 — Codex release notes

Maintenance release of aictrl.dev's engineering plugin for Codex and ChatGPT.
Essential, local-first skills are unchanged in scope; this release fixes and
hardens three of them.

- `create-workflow`: the local validator resolves its pinned dependencies
  from trusted roots only, no longer needs `ajv-formats`, uses the platform's
  npm cache, and prints a shell-safe, cross-platform remediation command.
  aictrl imports a workflow once it is merged to the default branch of a
  connected repository.
- `recording-product-demo`: narration is provider-neutral; prepared audio and
  narration inputs are validated consistently, and the media environment and
  optional provider credentials are isolated.
- `ux-testing`: simulator keys come only from the environment the user
  supplies; the skill no longer reads `.env` files, a custom endpoint never
  falls back to another vendor's key, and requests reject redirects.
- The same skills are now also published to npm as `@aictrl/skills` for Pi.
- Claude, Codex, OpenCode and Pi consume the same canonical root `skills/`
  tree from one release commit.

## 1.2.0

Feature release of aictrl.dev's engineering plugin for Codex and ChatGPT.

- Essential, local-first skills cover issue creation, bug reporting, spec
  review, implementation, pull-request creation, code review, finding judgment,
  review replies, root-cause analysis, workflow authoring and execution, design
  review, measured UI polish, agent usability testing, measurement planning,
  demo recording, and change explanation.
- Code-review findings are now reachable from the connector: list every
  recorded finding on a pull request, then record a TRUE / FALSE / UNCERTAIN
  verdict bound to the exact commit you read, with an auditable reasoning chain.
- Workflow runs can be listed and filtered, so an assistant can find an
  existing run before starting a new one.
- Connected `implement-code-change` uses native OAuth and the public workflow
  lifecycle tools, with explicit approvals, cancellation, revision evidence,
  and bounds.
- Security hardening: patched development dependencies, and the bundled
  usability-test harness declares plain-text responses with `nosniff`.
- Claude, Codex, and OpenCode consume the same canonical root `skills/` tree and
  `https://aictrl.dev/mcp` declaration from one release commit.
- The plugin contains no API keys, access tokens, client secrets, repository
  credentials, telemetry hook, or generated secret-bearing file.
