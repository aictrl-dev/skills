#!/usr/bin/env bash
# Install aictrl-skills into a tool's skills directory.
# Usage: ./scripts/install.sh [claude|cursor|opencode|all]
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$REPO/skills"
tool="${1:-all}"

link_into() {
  local dest="$1"; mkdir -p "$dest"
  for skill in "$SRC"/*/; do
    name="$(basename "$skill")"
    ln -sfn "$skill" "$dest/$name"
    echo "  linked $name -> $dest/$name"
  done
}

case "$tool" in
  claude)   echo "Claude Code (~/.claude/skills):";       link_into "$HOME/.claude/skills" ;;
  cursor)   echo "Cursor (~/.cursor/skills):";            link_into "$HOME/.cursor/skills" ;;
  opencode) echo "OpenCode (~/.config/opencode/skills):"; link_into "$HOME/.config/opencode/skills" ;;
  all)      "$0" claude; "$0" cursor; "$0" opencode ;;
  *) echo "Usage: $0 [claude|cursor|opencode|all]"; exit 1 ;;
esac
echo "Done. Restart your tool to pick up the skills."
