# Public plugin release

This repository is the release source for the aictrl.dev skills, Claude plugin
and Codex plugin. One Git commit and one semantic version identify both. The
canonical skill bodies live only under `skills/`; vendor directories must never
contain generated copies. Nothing is published to npm: every client reads the
tagged repository root.

Repository tooling (tests, validators, Mermaid CLI) lives in `tooling/`. The
plugin root must not contain `package.json` or a lockfile: Claude Code installs
the packages pinned by a lockfile at the plugin root when a user installs the
plugin, so the Claude directory holds every such version for manual review.

## Before a release

From a clean checkout of the candidate commit, run:

```bash
npm ci --prefix tooling
npm test --prefix tooling
npm run validate --prefix tooling
npm run smoke:claude --prefix tooling
npm run smoke:codex --prefix tooling
diff -u CHECKSUMS.sha256 <(./scripts/generate-checksums.sh)
```

Confirm that both plugin manifests and the Claude marketplace entry use the same
version, and that every clean-client test installs and removes the plugin
without changing unrelated client state. Connected workflow execution must use
the single `aictrl` MCP server at `https://aictrl.dev/mcp` and stop at a
merge-ready pull request.

## Releasing

Update the shared version in both plugin manifests and the Claude marketplace
entry; regenerate `CHECKSUMS.sha256`; merge; then publish a GitHub release
tagged exactly `v<version>`. The release workflow re-runs the tests, validators
and checksum check on the tagged commit and fails if the tag and the plugin
version differ.

Claude and Codex consume the same tagged repository root. Publish or submit
their marketplace listing only after the tagged Git artifact and clean-client
tests pass. Portal-issued challenge values, reviewer credentials, OAuth
secrets, and recovery codes are operational secrets and must not be committed
or stored in release evidence.

For Claude directory-policy warnings, use
[`submission/claude/directory-policy.md`](../submission/claude/directory-policy.md)
to distinguish provider credential destinations, non-executable artwork, and
directory-only metadata. Re-run the directory scan against the submitted
revision after changes; passing local tests does not clear a directory hold.

For the OpenAI plugin portal (platform.openai.com/plugins), build the upload
ZIP with `npm run package:openai --prefix tooling -- --name=<portal app id>`. The portal binds
an upload to the existing listing by its `app-...` identifier, so the script
writes that name into the ZIP's manifest only; the repository keeps `aictrl`
for Codex installs. Reviewer test cases ship in `extensions.com.openai.review`
(`tools_triggered` is a comma-separated string), and reviewer credentials are
entered in the portal's Review details, never in the package.

Use `submission/codex/readiness.md` as the Codex submission gate and
`submission/claude/readiness.md` for the Claude directory. Neither submission
nor approval counts as publication; close the vendor issue only
after a clean user installs from the live directory/listing.

## GitHub social preview

The reproducible source and upload-ready image live at:

- `assets/github-social-preview.svg`
- `assets/github-social-preview.png` — 1280 × 640

When the public catalog or supported clients change, update the SVG and render
the PNG at exactly 1280 × 640 before regenerating `CHECKSUMS.sha256`.

Upload the PNG in the `aictrl-dev/skills` repository under **Settings →
General → Social preview → Edit**. GitHub does not provide a supported
repository API for this settings action, so committing the asset does not
activate it. After upload, verify the public repository page's `og:image`
metadata no longer uses the generic `opengraph.githubassets.com` image.
