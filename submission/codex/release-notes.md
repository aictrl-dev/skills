# AICtrl 1.1.0-beta.2 — Codex release notes

Maintenance release of AICtrl's engineering plugin for Codex and ChatGPT.

- Eleven portable, local-first skills cover issue creation, bug reporting, spec
  review, implementation, code review, finding judgment, review replies,
  workflow authoring, design review, measurement planning, and demo recording.
- Connected `implement-code-change` uses native OAuth and the six lifecycle-tool
  subset of the nine-tool public catalog, with explicit approvals, cancellation,
  revision evidence, and bounds.
- Claude, Codex, and OpenCode consume the same canonical root `skills/` tree and
  `https://aictrl.dev/mcp` declaration from one release commit.
- The plugin contains no API keys, access tokens, client secrets, repository
  credentials, telemetry hook, or generated secret-bearing file.
