#!/usr/bin/env bash
set -euo pipefail
# Byte-order sort keeps CHECKSUMS.sha256 identical under every locale.
export LC_ALL=C

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

find \
  .agents \
  .claude-plugin \
  .codex-plugin \
  .mcp.json \
  assets \
  README.md \
  SETUP.md \
  LICENSE \
  skills \
  -type f -print0 \
  | sort -z \
  | xargs -0 sha256sum
