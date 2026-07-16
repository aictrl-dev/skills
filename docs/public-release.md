# Public plugin release

This repository is the release source for the AICtrl skills, Claude plugin,
Codex plugin, and `@aictrl/opencode` package. One Git commit and one semantic
version identify all of them. The canonical skill bodies live only under
`skills/`; vendor directories must never contain generated copies.

## Before a release

From a clean checkout of the candidate commit, run:

```bash
npm ci
npm test
npm run validate
npm run smoke:claude
npm run smoke:codex
npm run smoke:opencode
diff -u CHECKSUMS.sha256 <(./scripts/generate-checksums.sh)
npm pack . --dry-run --json --ignore-scripts
```

Confirm that all manifests and `package.json` use the same version, the packed
npm artifact contains all eleven root skills, and every clean-client test
installs and removes the package without changing unrelated client state.
Connected workflow execution must use the single `aictrl` MCP server at
`https://aictrl.dev/mcp` and stop at a merge-ready pull request.

## First npm publication

The first `@aictrl/opencode` version must be created by an authenticated owner
of the `@aictrl` npm organization. Publish only the tested, merged release
commit:

```bash
npm install --global npm@11.18.0
npm whoami
npm publish . --access public --tag beta
```

Do not add an npm token to GitHub. After the package exists, configure npm
trusted publishing for organization `aictrl-dev`, repository `skills`, workflow
`publish.yml`, and environment `release`. Creating the matching GitHub release
`v<package.json version>` then verifies the manually published package has the
same integrity and skips a duplicate publication.

## Later releases

Update the shared version in `package.json`, both plugin manifests, and the
Claude marketplace entry; regenerate `CHECKSUMS.sha256`; merge; then publish a
GitHub release tagged exactly `v<version>`. The release workflow re-runs the
package and production OAuth-boundary checks before publishing npm through OIDC.

Verify the result from an unauthenticated clean environment:

```bash
npm view @aictrl/opencode version dist-tags --json
npx @aictrl/opencode@beta --project .
opencode mcp list
npx @aictrl/opencode@beta --project . --uninstall
```

Claude and Codex consume the same tagged repository root. Publish or submit
their marketplace listing only after the tagged Git artifact and clean-client
tests pass. Portal-issued challenge values, reviewer credentials, OAuth
secrets, and recovery codes are operational secrets and must not be committed
or stored in release evidence.

Use `submission/codex/readiness.md` as the Codex submission gate and
`submission/opencode/ecosystem.md` for the OpenCode upstream sequence. Neither
submission nor approval counts as publication; close the vendor issue only
after a clean user installs from the live directory/listing.
