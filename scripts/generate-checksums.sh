#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

find aictrl-skills -type f -print0 \
  | sort -z \
  | xargs -0 sha256sum
