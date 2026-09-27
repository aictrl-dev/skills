# Claude plugin directory submission readiness

The Claude plugin directory (Cowork and Claude Code; surfaced in Claude Code as
the `claude-plugins-official` marketplace) is separate from the Claude
Connectors Directory, which lists the MCP server itself. This checklist covers
the plugin submission only; the connector submission is tracked in
`aictrl-dev/aictrl` (#3882, #4960).

## Package

- [x] The repository is public under the MIT license; closed-source plugins are not accepted.
- [x] `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` describe one plugin, `aictrl`, sourced from the repository root.
- [x] `claude plugin validate .` passes on the submitted head.
- [x] `.mcp.json` bundles only the remote server `https://aictrl.dev/mcp` (Streamable HTTP, OAuth 2.1); no local processes, environment variables or API keys.
- [x] `SETUP.md` at the plugin root guides the MCP sign-in and the first readiness check.
- [x] The README links the privacy policy, terms and support contact.
- [x] Skill descriptions and the MCP tool descriptions describe function only (no instructions to Claude beyond the tool's purpose); tool titles and read-only / destructive hints are present on every tool.

## Submission form (Console, `platform.claude.com/plugins/submit`)

- [x] Submitter signed in with a Developer, Admin or Owner role on the Console organization (Admin, 2026-09-04).
- [x] Consent to be contacted and to the Software Directory Terms given by the release owner (2026-09-04).
- [x] Plugin information entered from `listing.md` (2026-09-04).
- [x] Submission details entered from `listing.md`; GitHub link `https://github.com/aictrl-dev/skills`; license MIT; the three example use cases listed in `listing.md` (2026-09-04).
- [x] Submitted on 2026-09-04 from repository head `61195bf0f`; submission acknowledged by the Console and tracked there. Review outcome: pending.

## After listing

- [ ] A clean Claude Code install from the official marketplace completes one local skill without an aictrl.dev account.
- [ ] The same install signs in to the bundled MCP server with OAuth and runs `get_started` and `list_organizations`.
- [ ] Repository pushes are mirrored automatically; no re-submission for updates. Keep `claude plugin validate` green in CI.
- [ ] Once the MCP server is listed in the Connectors Directory, note it here: the plugin's bundled server then counts as a directory connector, which removes install warnings and is a prerequisite for the "Anthropic Verified" badge.
