# aictrl.dev 1.2.0 — Codex release notes

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
