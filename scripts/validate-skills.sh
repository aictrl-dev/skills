#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILLS="$ROOT/skills"

expected=(
  code-review create-bug create-issue create-workflow design-review
  implement-code-change judge-review-findings measurement-plan
  recording-product-demo reply-to-code-review spec-review
)

[[ -f "$ROOT/.claude-plugin/plugin.json" ]] || {
  echo "Missing root Claude Code plugin manifest"
  exit 1
}

required_public_files=(
  .agents/plugins/marketplace.json
  .claude-plugin/marketplace.json
  .codex-plugin/plugin.json
  .mcp.json
  assets/github-social-preview.png
  assets/github-social-preview.svg
  assets/icon.svg
  opencode/bin/install.js
  package.json
)
for required in "${required_public_files[@]}"; do
  [[ -f "$ROOT/$required" ]] || {
    echo "Missing public plugin file: $required"
    exit 1
  }
done

grep -Fq '"source": "./"' "$ROOT/.claude-plugin/marketplace.json" || {
  echo "Claude Code marketplace must install the repository-root plugin"
  exit 1
}

for compatibility_link in .cursor/skills .opencode/skills; do
  [[ -L "$ROOT/$compatibility_link" ]] || {
    echo "$compatibility_link must link to the canonical root skills tree"
    exit 1
  }
  [[ "$(readlink "$ROOT/$compatibility_link")" == "../skills" ]] || {
    echo "$compatibility_link must target ../skills"
    exit 1
  }
done

mapfile -t actual < <(find "$SKILLS" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort)
if [[ "${actual[*]}" != "${expected[*]}" ]]; then
  echo "Skill catalog mismatch"
  printf 'expected: %s\nactual:   %s\n' "${expected[*]}" "${actual[*]}"
  exit 1
fi

for name in "${actual[@]}"; do
  file="$SKILLS/$name/SKILL.md"
  [[ -f "$file" ]] || { echo "Missing $file"; exit 1; }
  [[ "$(head -n 1 "$file")" == "---" ]] || { echo "$name: frontmatter must start on line 1"; exit 1; }
  frontmatter="$(awk 'NR == 1 { next } /^---$/ { exit } { print }' "$file")"
  grep -qx "name: $name" <<<"$frontmatter" || { echo "$name: frontmatter name must match folder"; exit 1; }
  grep -q '^description: .*Use when ' <<<"$frontmatter" || { echo "$name: description must state what it does and when to use it"; exit 1; }
  grep -q "utm_campaign=$name" "$file" || { echo "$name: missing product attribution campaign"; exit 1; }
  attribution="utm_source=oss-skills&utm_medium=skill&utm_campaign=$name&utm_listing=github-skills&utm_platform=portable&utm_skill=$name"
  grep -Fq "$attribution" "$file" || { echo "$name: missing canonical product attribution dimensions"; exit 1; }
  attribution_count="$(grep -Fo "$attribution" "$file" | wc -l)"
  [[ "$attribution_count" -eq 2 ]] || { echo "$name: expected canonical attribution on both product links"; exit 1; }
done

if find "$SKILLS" -type l -print -quit | grep -q .; then
  echo "Canonical skill bundle must not contain symlinks"
  exit 1
fi

if rg -n --hidden -S \
  '(github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|(^|[^A-Za-z0-9])sk-(proj-)?[A-Za-z0-9_-]{20,}|(^|[^A-Za-z0-9])sk_(live|test)_[A-Za-z0-9]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----)' \
  "$ROOT" \
  -g '!.git/**' \
  -g '!node_modules/**' \
  -g '!package-lock.json'; then
  echo "Potential secret found in the public distribution"
  exit 1
fi

if rg -n -S '(aictrl_main|/home/[^/]+/|(^|[[:space:](])#[0-9]{3,}([[:space:],.)]|$)|server/|test/)' \
  "$SKILLS" \
  -g 'SKILL.md' -g 'SPEC.md' -g '*.md'; then
  echo "Internal-only reference found in public documentation"
  exit 1
fi

if rg -n -S 'writing-aictrl-workflows|v2 is not yet|not applyable today' "$ROOT" \
  -g '!evals/results.md' -g '!scripts/validate-skills.sh'; then
  echo "Stale workflow-skill reference found"
  exit 1
fi

echo "Validated ${#actual[@]} public skills."
