# Directory-policy review notes

Use these notes when reviewing or resubmitting the repository-root plugin.
The directory scan must run again against the submitted revision; local tests
cannot establish that a directory warning or review hold has cleared.

## Credential destinations

The root `.mcp.json` declares only an HTTP URL, `https://aictrl.dev/mcp`.
It has no credential headers, environment forwarding, subprocess, or credential
helper. Authentication uses the host's OAuth flow. Optional local skill helpers
do not send their provider credentials to this MCP server.

| Helper | Credential source | Destination and behavior |
| --- | --- | --- |
| Demo narration and clip verification | User-supplied `ELEVENLABS_API_KEY` in the command environment | Only `https://api.elevenlabs.io` for TTS/STT; redirects rejected. Sends narration text or audio. No dotenv-file fallback. |
| Demo YouTube upload | User-supplied `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN` | Google OAuth token exchange at `https://oauth2.googleapis.com/token`, then Google YouTube upload API. Requires `--upload`; redirects rejected. |
| Demo GCS/S3 upload | User-configured `gcloud` or `aws` CLI authentication | The vendor CLI uploads the publish kit to the configured bucket only with `--upload`. The plugin does not parse the CLI's credential files. |
| TypeSafe simulator | User-supplied `TYPESAFE_API_KEY` | Only `https://api.typesafe.ai/v1/systemone`; redirects rejected. Sends screen state and questions. |
| Compatible simulator | Separately supplied `UX_SIM_API_KEY` with `UX_SIM_ENDPOINT` and `UX_SIM_MODEL` | The key must be issued by the selected endpoint's provider. It never falls back to `TYPESAFE_API_KEY`. HTTPS required except loopback; redirects rejected. |
| UX browser harness | Per-run locally generated token in a private temporary directory | Local harness authentication, unrelated to provider API keys or the aictrl MCP server. |
| Reviewer fixture test | Empty subprocess environment | Runs the dependency-free fixture with Node; does not inherit the installer's credentials. |

Provider credentials sent to their own vendor still need the directory
reviewer's confirmation. The compatible simulator's user-selected destination
also needs review; configuration alone cannot prove who issued a key. Do not
give it another vendor's key or retrieve credentials from the user's files.

If a future integration sends a credential to a host other than its issuing
vendor, declare a `userConfig` option with `sensitive: true` and wire the chosen
`${user_config.KEY}` through a supported component. Merely declaring an option
does not connect it to a Bash-launched skill script: sensitive substitutions in
skill content become placeholders, and plugin-option environment variables are
available to hooks. See the [manifest reference](https://code.claude.com/docs/en/plugins/manifest-reference#user-configuration).

## Readable execution

`split-narration.py` now prints a command invoking the bundled
`scripts/verify-clip-starts.cjs` instead of an inline `curl`/Python shell program.
The helper extracts four seconds per scene with `ffmpeg`, transcribes through
ElevenLabs, and removes its private temporary audio directory on success or
failure. No API key is placed in command arguments.

## Assets and listing fields

`assets/icon-512.png` is the Claude listing icon; `assets/icon.svg` is the Codex
UI icon. `assets/github-social-preview.svg` and
`assets/github-social-preview.png` are GitHub social-preview artwork. References
in release docs, listing copy, validation, tests, and `CHECKSUMS.sha256` check,
describe, or hash those assets; they do not execute them. `scripts/install.sh`
links the canonical skill directories. The UX skill's screenshots are evidence
for visual testing. These references can legitimately require manual asset
review; deleting checks or artwork only to hide the notice is unnecessary.

The directory supports `icon`, `documentationUrl`, `supportUrl`,
`privacyPolicyUrl`, and `termsOfServiceUrl` as listing fields even though
Claude Code does not use them at load time. Their `UNKNOWN_KEY` notices need
no change when they supply listing metadata. The current Claude manifest sets
all five fields explicitly, using `./assets/icon-512.png` for the icon and
HTTPS URLs for the directory links; `listing.md` records the same values.
Compare the scan's submitted revision with the local manifest before acting
on a field notice.
See [directory listing fields](https://code.claude.com/docs/en/plugins/manifest-reference#directory-listing-fields).
