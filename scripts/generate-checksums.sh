#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

find \
  .agents \
  .claude-plugin \
  .codex-plugin \
  .mcp.json \
  assets \
  opencode/bin \
  package.json \
  README.md \
  LICENSE \
  skills \
  -type f -print0 \
  | sort -z \
  | xargs -0 sha256sum
