#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="$ROOT/aictrl-skills/skills"
DESTINATION="$ROOT/skills"

[[ -d "$SOURCE" ]] || { echo "Missing canonical skill tree: $SOURCE"; exit 1; }
[[ ! -L "$DESTINATION" ]] || { echo "Refusing to replace symlink: $DESTINATION"; exit 1; }

mkdir -p "$DESTINATION"
find "$DESTINATION" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
cp -a "$SOURCE"/. "$DESTINATION"/

echo "Synchronized public discovery tree from aictrl-skills/skills to skills/."
